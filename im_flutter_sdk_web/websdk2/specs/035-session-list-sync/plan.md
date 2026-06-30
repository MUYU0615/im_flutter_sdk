# 实施方案：会话列表同步与 SessionItem

**Branch**: `035-session-list-ws-protobuf` | **Date**: 2026-05-15 | **Spec**: `specs/035-session-list-sync/spec.md`  
**Input**: Feature specification from `/specs/035-session-list-sync/spec.md`

## Summary

本特性在不回滚 `031-chat-manager-replace-channel` 与 `034-conversation-rest-api` 既有边界的前提下，为现有 `ChatManager + conversation cache + 登录后同步调度` 增加一条“新会话列表同步”主线。整体方案保持以下约束：

1. 不新增 `ConversationManager`，而是在现有 `ChatManager` 上补充 `getSessionList()` 与 `refreshSessionList()` 两个公开入口，并沿用现有 `addEventHandler/removeEventHandler` 风格暴露 `onSyncDataStart` / `onSyncDataFinished`；
2. 保留旧会话列表 REST 能力与旧 DTO，不强迫旧调用方迁移；新增 `SessionItem` 作为“新会话列表”的稳定公开业务对象，新旧两套能力并行存在；
3. 登录后调度顺序改为“新会话列表同步优先 -> 好友同步 -> Session 内漫游消息加载”，但若同一登录周期确认“服务端不支持新协议”或“未配置同步链路”，仅会话列表能力回退旧逻辑，后续其他同步链路继续走新体系；
4. 新链路复用 `024-contact-sync` 已落地的 WSS 配置与 transport 心智：设备维度游标、独立同步上下文、按批次处理、幂等写库、失败可诊断；但本期会话列表使用 session-list 专用缓存 schema/key，不混入现有联系人缓存；
5. 新链路不再沿用当前 session-list 的 JSON 协议草稿，而是切到真实 websocket protobuf 协议：`GetSessionListRequest(type=10)`、`GetSessionListResponse(type=11)`、`ErrorDetail(type=5)`，客户端按帧接收多个响应批次，直到 `is_last_batch=true`；
6. 对外 `SessionItem` 统一承载业务核心字段与顶层 `conversationName` / `conversationAvatar` 展示字段，`lastMessage` 符合当前消息结构并仅暴露最小展示字段，`conversationType` / `remindType` 都遵循“协议数值 -> SDK 稳定公开枚举”的分层策略；其中 `remindType` 最终公开值为 `DEFAULT | ALL | AT | NONE`，与 Push/REST remindType 保持一致。

本期同时包含一个明确的缓存与同步语义升级目标：SDK 需要在本地维护一份 session-list 专用真相缓存与 `sessions_last_sync_ts` 检查点，支持完整快照覆盖、删除本地多余会话、保留服务端排序语义、与 MSync 实时事件做最终收敛，并通过 demo 并行展示“旧会话列表面板”和“新 SessionItem 面板”。

## Technical Context

**Language/Version**: TypeScript 5.x（strict）  
**Primary Dependencies**: 现有 `ChatClient`、`ChatManager`、`CacheManager`、`EventHub`、`024-contact-sync` 的 WSS transport 思路、MSync protobuf 编解码链路、`protobufjs/light` 静态编解码适配层、Vitest、Vite、Playwright  
**Storage**: 新增 session-list 专用 schema/key；旧 conversation cache 继续保留供旧会话列表逻辑使用；session-list checkpoint 单独持久化 `sessions_last_sync_ts`  
**Testing**: `npm run test:run`、`npm run lint`、`npm run type-check`、`npm run test:gate:pr`、必要时 `npm run test:e2e`  
**Target Platform**: Web SDK 主库 + 浏览器 demo  
**Project Type**: 单仓库 SDK 库项目（`src/`、`tests/`、`demo/`）  
**Performance Goals**:
- `getSessionList()` 纯读缓存、同步返回，不引入额外网络等待
- `refreshSessionList()` 在新链路可用时优先走 WSS，但同一登录周期内对“不支持/未配置”仅探测一次，避免持续报错与重复阻塞
- 完整快照写库、排序收敛与 `SessionItem` 归一化不得对登录后主链路引入明显卡顿
- WSS 同步与 MSync 实时事件并发时，不允许出现明显的列表抖动、重复项或旧数据回写
**Constraints**:
- 不新增 `ConversationManager`，继续收口到 `ChatManager`
- 事件注册风格必须沿用 `addEventHandler/removeEventHandler`
- 新会话列表回调字段名固定为 `onSyncDataStart` / `onSyncDataFinished`
- `getSessionList()` 纯读缓存；`refreshSessionList()` 才触发网络
- 同一登录周期内若已确认“服务端不支持新协议”或“未配置同步链路”，则后续 `refreshSessionList()` 不再重复探测
- `refreshSessionList()` 并发调用必须复用同一个 Promise
- `SessionItem` 不再暴露 `display`，顶层至少包含 `conversationName/conversationAvatar`
- `SessionItem.lastMessage` 至少暴露 `msgServerId/from/to/sender/timestamp/body`，其中 `sender` 为包含 `userId` 且可携带 `nickname/avatarUrl` 的对象；可在链路能提供时补充 `conversationId/conversationType/type/status/direct`，`body` 内不得包含 `type`
- `SessionListRemindType` 复用 Push/REST remindType 字符串口径；对外固定为 `DEFAULT | ALL | AT | NONE`
- 漫游消息 API 不改；仍复用原有 `fetchMessagesFromServer` 主语义
- session-list 缓存与 checkpoint 使用新 schema/key；不直接复用旧 conversation cache 真相
- demo 保留旧会话列表面板，同时新增新面板并行展示
- 请求必须使用 protobuf 二进制编码而不是 JSON 文本；`GetSessionListRequest.type` 固定为 `10`
- 响应必须支持多帧 `GetSessionListResponse.type=11` 收包，并在 `is_last_batch=true` 后才允许推进 `last_sync_finished_ts`
- 错误响应固定为 `ErrorDetail.type=5`，错误码至少覆盖 `1001/1002/1003/1501/1502/1503`
**Scale/Scope**: 涉及 `ChatManager` 公开面、`ChatClient` 登录后同步调度、session-list WSS 协议接入、session-list 缓存层、事件系统、demo 主路径，以及 unit/integration/e2e/文档与 gate 测试的系统性升级

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

预检结果：

- [x] **性能优先**: 保持 `getSessionList()` 同步读缓存、`refreshSessionList()` 独立异步同步；同一登录周期失败探测结果缓存化，避免重复探测阻塞主路径
- [x] **类型安全**: `SessionItem`、`SessionMessageSnippet`、`SessionListRemindType`、事件 handler map、缓存 schema 与同步上下文全部采用 strict typing；不对外暴露协议数值
- [x] **测试驱动**: spec 已明确 unit / integration / e2e 三层覆盖；计划继续补 data model、contract、quickstart 以支撑后续 tasks
- [x] **可靠性**: 明确完整快照覆盖、批次事务、`request_id` 去重、游标推进条件、失败回退边界与应用恢复语义
- [x] **协议一致性**: 计划已对齐真实 websocket protobuf 请求/响应结构，避免继续基于当前 JSON 草稿实现错误链路
- [x] **可扩展性**: 保持 `ChatManager` 作为消息/会话域主门面；session-list WSS 链路复用 `024` transport 心智，便于后续扩展其他同步类型
- [x] **可观测性**: 同步开始/结束、回退原因、批次处理、游标推进、MSync/WSS 收敛、Promise 复用命中都可接入现有结构化日志
- [x] **版本管理**: 本期含新公开类型、新缓存 schema、新 demo 主路径与文档变更；实现阶段必须补版本号、`CHANGELOG.md` 与迁移说明

Phase 1 设计复检预期：通过。当前 spec 已对 manager 归属、命名、缓存语义、事件签名、失败探测策略与展示模型完成澄清。

## Project Structure

### Documentation (this feature)

```text
specs/035-session-list-sync/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/
│   └── requirements.md
├── contracts/
│   └── session-list-sync.openapi.yaml
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── chat-client.ts
├── index.ts
├── cache/
│   ├── cache-manager.ts
│   ├── cache-types.ts
│   ├── cache-keys.ts
│   ├── conversation-cache.ts
│   └── session-list-cache.ts              # new
├── core/
│   ├── contact-sync/
│   │   └── sync-transport-client.ts
│   └── session-list-sync/                 # new
│       ├── session-list-sync-controller.ts
│       ├── session-list-sync-session.ts
│       ├── session-list-sync-types.ts
│       ├── session-list-sync-normalizer.ts
│       └── session-list-sync-merge.ts
├── managers/
│   └── chat-manager.ts
├── protocol/
│   └── session-list/                      # protobuf session-list gateway adapter
│       ├── codec.ts
│       ├── types.ts
│       ├── gateway.ts
│       └── proto.ts
├── rest/
│   └── conversation-management.ts
└── types/
    ├── conversation.ts
    ├── event-system.ts
    ├── chat-manager.ts
    └── chat-client.ts

tests/
├── unit/
│   ├── cache/
│   ├── managers/
│   ├── protocol/
│   └── session-list-sync/
├── integration/
│   └── session-list-sync/
├── e2e/
└── contract/

demo/
├── src/App.tsx
├── src/types.ts
└── src/components/
    ├── ConversationPanel.tsx
    └── SessionListPanel.tsx              # new
```

**Structure Decision**: 不新增 manager 工程层次，保持单仓库单项目结构。实现层将新增 `session-list-sync` 领域模块，承接 WSS 请求编排、批次处理、快照收敛、缓存写库与 `SessionItem` 归一化；`ChatManager` 仅新增公开入口与事件接线，`ChatClient` 负责登录后调度编排。

## Phase 0: Research

输出：

- `specs/035-session-list-sync/research.md`

研究与确认项：

1. 固化 `ChatManager` 内新增 session-list 公开入口的边界：
   - 与现有 `getConversationList/getPinnedConversationList/getConversationListByMark` 的职责区分
   - `getSessionList()` 的纯缓存读取语义
   - `refreshSessionList()` 与登录后自动同步的复用关系
2. 固化 session-list 缓存与旧 conversation cache 的并存策略：
   - 新 schema/key 的命名
   - 是否复用现有 `CacheManager` flush/ttl/indexing 能力
   - 新旧两套列表如何同时存活而不互相污染
3. 固化 session-list WSS 协议接入与 `024-contact-sync` transport 复用策略：
   - 是直接抽象公共 transport 还是以 session-list 轻包装复用现有 transport client
   - `request_id`、批次识别、终态关闭与空闲连接策略
   - 同一登录周期“不支持/未配置”探测结果的运行时缓存边界
   - protobuf message type / field 编号、`bytes payload` 到 `MessageBody` 的解码映射，以及 `GatewayHeader.request_id` 对齐
4. 固化 `SessionItem` 与 `SessionMessageSnippet` 的归一化策略：
   - 单聊联系人展示投影优先级
   - 群名称/群头像与单聊 metadata 到 `conversationName/conversationAvatar` 的映射
   - `readAt` 与 `remindType` 的公开字段形态
5. 固化 WSS 与 MSync 并发收敛规则：
   - 新消息、新会话、删除/退出、置顶/标记/未读、免打扰变化的覆盖优先级
   - 完整快照覆盖与本地事件 patch 的先后关系
   - 何时允许删除本地多余会话
6. 固化错误码与回退策略：
   - `INVALID_TOKEN` / `KICKED` / `RATE_LIMIT` / `SYNC_IN_PROGRESS` / `DATA_VERSION_MISMATCH`
   - 哪些错误终止本轮同步，哪些允许退避重试或复用在途结果
   - `finish(error)` 的错误对象封装策略
7. 固化 demo 并行展示策略：
   - 旧 `ConversationPanel` 继续如何保留
   - 新 `SessionListPanel` 的最小展示字段与日志打印方式
   - 是否需要在 demo 中显式展示“当前登录周期已禁用新探测”状态

## Phase 1: Design & Contracts

输出：

- `specs/035-session-list-sync/data-model.md`
- `specs/035-session-list-sync/contracts/session-list-sync.openapi.yaml`
- `specs/035-session-list-sync/quickstart.md`

设计要点：

### 1. ChatManager 公开面扩展

- 在 `ChatManager` 上新增：
  - `getSessionList(): ReadonlyArray<SessionItem>`
  - `refreshSessionList(): Promise<ReadonlyArray<SessionItem>>`
- 在 `ChatEventHandlerMap` 或等价 event map 中新增：
  - `onSyncDataStart?: (payload: SyncDataStartPayload) => void`
  - `onSyncDataFinished?: (payload: SyncDataFinishedPayload) => void`
- 保持 `getConversationList` 等旧 REST API 不变，形成“旧 conversation DTO / 新 SessionItem”双轨并行

### 2. SessionItem 公开模型

- 新增 `SessionItem` 公开类型，至少包括：
  - `conversationId`
  - `conversationType`
  - `unreadCount`
  - `lastMessage`
  - `lastMessageAt`
  - `isPinned`
  - `pinnedTimestamp`
  - `marks`
  - `readAt`
  - `remindType`
  - `conversationName`
  - `conversationAvatar`
- `SessionMessageSnippet` 固定为最小展示字段：
  - `msgServerId`
  - `from`
  - `to`
  - `sender`
  - `conversationId`（可选）
  - `conversationType`（可选）
  - `type`（可选）
  - `status`（可选）
  - `timestamp`
  - `direct`（可选）
  - `body`
- `SessionListRemindType` 固定公开值：
  - `DEFAULT`
  - `ALL`
  - `AT`
  - `NONE`

### 3. Session-list cache 与 checkpoint

- 新增 session-list 专用缓存结构：
  - `SessionListCacheRecord`
  - `SessionListCheckpoint`
  - `SessionListCapabilityState`（本登录周期是否已确认 unsupported/unconfigured）
- 新增 session-list 专用 key：
  - 列表真相缓存
  - `sessions_last_sync_ts`
  - 当前登录周期探测结果（仅运行时，不持久化）
- 保持旧 conversation cache 不变，旧逻辑继续使用原缓存
- 新缓存排序必须保持：
  - `pinnedTimestamp` 降序
  - `lastMessageAt/updatedAt` 降序

### 4. 登录后调度与主动刷新协作

- `ChatClient.login()` 后增加 session-list 同步前置步骤：
  1. 读取 session-list 缓存
  2. 判定当前登录周期是否允许探测新链路
  3. 若允许，则发起新会话列表同步
  4. 无论成功/失败/回退，均继续后续联系人同步与消息调度
- `refreshSessionList()` 与登录后自动同步共享同一 controller/service：
  - 若已有在途任务，复用同一个 Promise
  - 若当前登录周期已确认 unsupported/unconfigured，则直接回退旧逻辑
  - 若新链路成功，写新缓存并返回 `SessionItem[]`
  - 若新链路失败或回退，走旧会话列表映射 `SessionItem[]`

### 5. Session-list WSS 协议与 transport

- 复用 `024-contact-sync` 的同步 transport 心智，但会话列表保持独立业务上下文：
  - `GetSessionListRequest.type = 10`
  - `GetSessionListResponse.type = 11`
  - `ErrorDetail.type = 5`
  - `request_id`
  - `resource`
  - `last_sync_time`
  - `need_empty_session`
  - `need_session_mark`
  - `last_sync_finished_ts`
  - `is_last_batch`
- session-list controller 负责：
  - 建连
  - 鉴权
  - 发送 protobuf request
  - 分批接收 protobuf response
  - request/batch 去重
  - 最后一批终态提交
  - `finish(error)` 派发
- session-list codec 负责：
  - `GatewayHeader`
  - `GetSessionListRequest`
  - `GetSessionListResponse`
  - `SessionItem`
  - `Meta/JID`
  - `ErrorDetail`
  - `Meta.payload(bytes)` 到 `MessageBody` 的 protobuf 解码与最小公开消息摘要映射
- `RATE_LIMIT` 支持有限次退避重试
- `SYNC_IN_PROGRESS` 同账号同设备同业务优先复用在途任务
- `DATA_VERSION_MISMATCH` 清 checkpoint 后从 0 重拉

### 6. 快照覆盖、删除与 MSync 并发收敛

- 每个 batch 到达立即事务落库
- 最后一批：
  - 成功入库
  - 完整快照覆盖
  - 删除本地多余会话
  - 推进 `sessions_last_sync_ts`
  - 触发 `finish(success)`
- 与 MSync 并发时：
  - 新消息、新会话：以更晚更新时间覆盖
  - 删除/退出：先标记待删除，待完整快照统一收敛
  - 置顶/标记/未读：覆盖式写入
  - `remindType`：本地可先更新，但仅下一次完整快照为最终真相

### 7. 旧逻辑回退与映射

- 旧逻辑来源：
  - `chatManager.getConversationList()` / 相关现有缓存
- 回退仅限会话列表能力：
  - 新公开接口 `getSessionList/refreshSessionList`
  - 登录后自动列表同步
- 回退映射要求：
  - 返回统一 `SessionItem`
  - `conversationName` 与 `conversationAvatar` 尽最大能力从现有缓存/联系人快照推导
  - 无法推导的字段保持可诊断降级，不伪造完整值

### 8. Demo、导出与文档

- demo 新增 `SessionListPanel`
  - 展示 `getSessionList()` 缓存读取结果
  - 提供 `refreshSessionList()` 按钮
  - 打印 `onSyncDataStart/Finish`
  - 与旧 `ConversationPanel` 并行展示
- `src/index.ts` 导出：
  - `SessionItem`
  - `SessionMessageSnippet`
  - `SessionListRemindType`
- quickstart / API reference：
  - 明确旧接口与新接口分工
  - 明确 `getSessionList` 不走网络
  - 明确登录后自动同步与本登录周期回退语义

## Agent Context Update

执行命令：

```bash
SPECIFY_FEATURE=035-session-list-sync .specify/scripts/bash/update-agent-context.sh codex
```

预期：将 035 的 `ChatManager` 会话列表新公开面、session-list 专用缓存 schema/key、WSS 同步与旧会话列表回退并行策略、以及 `SessionItem` 对外模型同步到 agent context，避免后续实现继续按 `ConversationManager` 或旧 conversation DTO 心智推进。

## Phase 2: Task Planning Approach

由 `/speckit.tasks` 继续拆解任务，按以下主线生成：

1. 新增 `SessionItem` / `SessionMessageSnippet` / `SessionListRemindType` 与 event handler 类型
2. 扩展 `ChatManager` 公开面：`getSessionList` / `refreshSessionList` / 同步回调事件
3. 新增 session-list cache schema/key、checkpoint 与 capability state
4. 新增 session-list WSS controller/session/normalizer/merge 模块，并接入 transport
5. 改造 `ChatClient.login()` 调度：会话列表同步前置、失败仅本能力回退、后续链路继续
6. 实现旧会话列表到 `SessionItem` 的回退映射
7. 实现 WSS/MSync 并发收敛、排序保持、删除本地多余会话与 Promise 复用
8. 更新 demo、导出、quickstart、contract 与文档
9. 补 unit / integration / e2e / contract 测试，最后再做版本号、`CHANGELOG.md` 与中文 commit

## Complexity Tracking

无额外豁免项。
