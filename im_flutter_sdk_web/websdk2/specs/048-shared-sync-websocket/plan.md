# 048 Shared Sync WebSocket Plan

## 背景

当前登录后的自动同步包含三类数据：

- `conversation`：会话列表同步，`runSessionListSync()` 内部每次创建 `SyncTransportClient` 并新建 WebSocket。
- `contact`：联系人同步，`RosterSyncClient` 持有自己的 `SyncTransportClient`。
- `group`：已加入群组同步，`GroupSyncClient` 持有自己的 `SyncTransportClient`。

三类同步当前都会使用同步 WebSocket 地址，但不是同一条连接；每类同步各自建连、发送、等待完成并关闭。登录编排上，会话列表先 `await` 完成，然后联系人和群组后台触发。

服务端已确认支持同一条同步 WebSocket 上请求多种数据。同步完成后应关闭连接。

## 当前重试现状

- `SyncTransportClient.run()` 只负责单次 WebSocket 生命周期：connect timeout、idle timeout、message/error/close 处理，失败后直接 reject。
- 会话列表在 `SessionListSyncController` 中已有有限 retry，使用 `retryWithCondition()`，主要针对可恢复的 session-list 错误。
- 联系人同步有多 URL / 多 round 尝试，但不是统一连接重试；没有类似消息 WebSocket 的统一退避重连日志。
- 群组同步有多 URL 尝试，但没有统一连接重试。

结论：同步 WebSocket 没有通用的“连接失败自动重试 + 日志”机制；需要在共享同步 WebSocket 层补齐。

## 协议路由依据

三类协议都有 `type` 和 `header.requestId`：

| 数据类型 | Request type | Response type | Error type |
| --- | ---: | ---: | ---: |
| contact / roster | `3` | `4` | `5` |
| conversation / session-list | `10` | `11` | `5` |
| group / joined-groups | `12` | `13` | `5` |

正常响应可以按 `type` 初步识别；错误响应都使用 `type === 5`，必须依赖 `header.requestId` 路由。最终设计应优先按 `header.requestId` 查找 pending request，`type` 只作为辅助校验和诊断字段。

现有 requestId 支持情况：

- 会话列表：`SessionListSyncSession.pushBatch()` 已严格校验 requestId。
- 群组：`GroupSyncSession.push()` 已按 requestId 过滤。
- 联系人：`RosterResponse` 包含 `header.requestId`，但 `RosterSyncSession.push()` 当前未校验 requestId；共享 WebSocket 前必须补上。

## 目标设计

新增共享同步 WebSocket session：

```ts
class SharedSyncWebSocketSession {
  request<TResult>(options: SharedSyncRequestOptions<TResult>): Promise<TResult>;
  close(reason?: string): void;
}
```

职责：

- 懒创建一条同步 WebSocket。
- 维护 `Map<requestId, PendingSyncRequest>`。
- 发送多类同步请求。
- 收到 frame 后 decode 出 `type` 和 `header.requestId`，按 requestId 路由到对应 pending。
- 支持 roster ping：收到 `type === 1` 时回 pong。
- 所有 pending 完成后关闭 WebSocket。
- logout / relogin / cancel 时关闭 WebSocket 并 reject pending。
- 连接失败自动重试，并记录结构化日志。

## 重试策略

先实现连接级有限重试，不做长期保活重连：

- 触发条件：
  - WebSocket 创建失败
  - open 前 error / close / connect timeout
  - open 后在尚有 pending 请求且非业务终态前异常 close
- 不重试条件：
  - logout / cancel
  - 业务错误明确不可重试
  - request decoder 抛出不可恢复协议错误
- 建议参数：
  - `maxAttempts = 3`
  - `initialDelayMs = 1000`
  - `maxDelayMs = 5000`
  - `backoffMultiplier = 2`
- 每次重试必须重新建立 WebSocket，并重新发送仍 pending 的 request。
- 重试时 requestId 不变，便于服务端和客户端日志关联；如果某个业务 controller 需要新 requestId，应由业务层显式创建新 request。

日志要求：

- `sync websocket connect started`
- `sync websocket connected`
- `sync websocket request sent`
- `sync websocket retry scheduled`
- `sync websocket retry started`
- `sync websocket retry exhausted`
- `sync websocket closed after complete`

日志字段至少包含：

- `attempt`
- `maxAttempts`
- `delayMs`
- `url`
- `pendingCount`
- `dataTypes`
- `requestId`
- `reason`

不得输出 token。

## 实现方案

1. 新增共享 transport 模块：
   - `src/core/sync/shared-sync-websocket-session.ts`
   - `src/core/sync/sync-frame-router.ts`
   - 如需配置，新增 `src/core/sync/sync-retry-policy.ts`

2. 提供 frame envelope 解码：
   - 按现有三套 codec 依次 decode，提取 `{ type, requestId, dataType }`。
   - 正常响应优先由 `type` 快速识别。
   - `type === 5` 错误帧按 `header.requestId` 路由。

3. 改造三类 sync client：
   - 保留各自 codec 和 session 聚合逻辑。
   - 去掉各自持有的 `SyncTransportClient`。
   - 通过共享 session 的 `request()` 发送和接收 frame。

4. ChatClient 持有共享 session：
   - `private syncWebSocketSession: SharedSyncWebSocketSession | null`
   - `getOrCreateSyncWebSocketSession()`
   - logout / resetCore / relogin 时关闭并置空。

5. 同步完成关闭：
   - 自动同步三类数据都完成后关闭。
   - 手动刷新只发单个 request，完成后关闭。
   - 如果短时间内又有新的同步请求，可复用还未关闭的同一条连接；不做长期保活。

6. 补齐联系人 requestId 校验：
   - `RosterSyncSession` 构造时接收 requestId。
   - `push(page)` 校验 `page.header?.requestId`。

## 测试分层

### 单元测试

新增或更新：

- `tests/unit/core/sync/shared-sync-websocket-session.test.ts`
  - 同一 WebSocket 发送 conversation/contact/group 三类 request。
  - 按 requestId 路由不同 response。
  - `type === 5` 错误按 requestId 路由。
  - 所有 pending 完成后关闭 WebSocket。
  - logout/cancel reject pending 并关闭。
  - 连接失败按退避重试，并记录日志。
- `tests/unit/core/contact-sync/roster-sync-session.test.ts`
  - requestId mismatch 拒绝或忽略，按最终设计固定。

### 集成测试

更新：

- `tests/integration/session-list-sync/session-list-sync.integration.test.ts`
  - 登录后 conversation/contact/group 同步共享同一条 sync WebSocket。
  - 会话列表仍先完成，再触发 contact/group。
  - contact/group 可以在同一连接上并发 pending。

### E2E / 真实环境

本改动主要是内部连接模型，不要求新增 E2E。现有真实环境自动同步用例可复用。若后续需要验证连接数，可在浏览器 mock WebSocket 层或真实环境日志中观测。

## 风险与约束

- 三套 protobuf schema 目前独立，错误帧 `type === 5` 可能出现跨 schema decode 成功但字段不完整的情况；必须优先保证 requestId 提取可靠。
- 同一连接上并发 pending 时，业务 session 不能再假设“收到的 frame 一定属于自己”。
- 重试重新发送 pending request 可能导致服务端重复处理；各协议必须依赖 requestId/cursor/lastSyncTime 保证幂等或可接受重复。
- 当前会话列表已有 controller 级 retry；共享 transport retry 引入后要避免双层 retry 造成尝试次数膨胀。

## 已确认约束

- 共享 sync WebSocket 允许并发请求；服务端响应按串行 frame 返回。
- 错误帧 `type === 5` 一定包含原请求的 `header.requestId`。
- 同步 WebSocket 连接失败重试统一使用 `maxAttempts = 3`，不复用消息连接的 `autoReconnectNumMax`。

## 实现状态

- 已新增 `SharedSyncWebSocketSession`，路由、pending request、连接重试、取消和完成后关闭逻辑内聚在 `src/core/sync/shared-sync-websocket-session.ts`。
- `ChatClient` 持有登录会话级共享 sync WebSocket，并在 logout / resetCore 时取消 pending 请求和关闭连接。
- `conversation`、`contact`、`group` 同步均改为通过共享 session 发送请求；业务 codec 与分页聚合逻辑仍保留在各自模块。
- `RosterSyncSession` 已增加 requestId 校验；roster `ErrorDetail` 协议定义补充 `header` 字段，以支持 `type === 5` 错误按 requestId 路由。
- 连接失败、open 前异常、同步中异常关闭按 `maxAttempts = 3` 有限重试，重试日志会记录 attempt / maxAttempts / url / pendingCount / dataTypes / requestId / reason，url 查询参数会被脱敏。
- 所有 pending 完成后通过 0ms 延迟关闭 sync WebSocket，允许登录后会话列表同步完成后紧接着触发的 contact/group 自动同步复用同一条连接。
