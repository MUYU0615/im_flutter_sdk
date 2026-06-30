# 实施增补：会话列表同步 Retry / Backoff

**Feature**: `035-session-list-sync`  
**Date**: `2026-05-18`  
**Scope**: 为 session-list WSS 同步补齐有限范围的 retry/backoff，仅覆盖文档中明确要求的可恢复错误。

## 背景

当前 `session-list` 链路已经具备：

- WSS protobuf 同步
- 多 batch 收包
- 每 batch 立即落 `session-list` 缓存
- 最后一批才推进 checkpoint
- unsupported / unconfigured fallback

但 `retry/backoff` 仍停留在“错误分类里打了 `shouldRetry: true` 标记”，没有真正执行重试。

当前状态：

- `ERROR_CODES.SERVER_BUSY`（服务端 1003 / 限流）=> 标记 `shouldRetry: true`
- `SESSION_LIST_SYNC_IN_PROGRESS`（1103）=> 标记 `shouldRetry: true`
- 但 controller 直接 fallback 并 finish(error)，不会等待 backoff 后重试

这与设计文档不一致。

## 目标

本轮只补齐最小可恢复重试：

1. `RATE_LIMIT / SERVER_BUSY`：指数退避重试
2. `SYNC_IN_PROGRESS`：指数退避重试

明确不在本轮处理：

- token 失效自动续鉴权
- unsupported / unconfigured 重试
- protobuf decode / request invalid / fetch failed 的泛化重试
- 跨登录周期的 retry 状态持久化

## 目标语义

### 1. 可重试错误

仅以下错误进入 retry：

- `ERROR_CODES.SERVER_BUSY`
- `SESSION_LIST_SYNC_IN_PROGRESS`

其余错误保持当前语义：

- 直接结束本轮
- 触发 fallback
- 触发 `onSyncDataFinished({ dataType: 'conversation', error })`

### 2. backoff 策略

采用仓库现有 `retryWithCondition()`：

- `maxAttempts = 3`
  含首次执行在内，总共最多 3 次
- `initialDelay = 3000`
- `maxDelay = 5000`
- `backoffMultiplier = 1`
- `jitter = true`

这样可以贴近文档里的“随机 3-5 秒，最多 2 次重试”：

- 第 1 次失败后等待约 3 秒
- 第 2 次失败后等待约 3 秒
- 第 3 次再失败则彻底失败

### 3. 事件语义

`onSyncDataStart`

- 仍然只触发一次
- 不因内部 retry 重复触发

`onSyncDataFinished`

- 仅在最终成功或最终失败时触发一次
- 中间 retry 失败不触发 finish

### 4. fallback 时机

有 retry 资格的错误：

- 不应在第一次失败后立刻 fallback
- 只有重试用尽后才 fallback

无 retry 资格的错误：

- 保持当前行为，立即 fallback

### 5. checkpoint 与缓存语义

retry 不改变已经完成的 batch 落库语义：

- 某次尝试中已落的中间 batch 仍保留
- checkpoint 仍然只有最后一批成功后才推进
- 若一次尝试失败，下一次 retry 继续使用旧 checkpoint 发起整次请求

## 实现方案

### A. 在 controller 内包裹 `runSessionListSync()`

当前流程：

- `runRefresh()` 里直接 `await runSessionListSync(...)`

目标流程：

- 抽出 `runSessionListSyncWithRetry(session, params)`
- 内部用 `retryWithCondition()`
- 仅对 `SERVER_BUSY / SYNC_IN_PROGRESS` 触发 retry

原因：

- retry 语义属于 controller 级编排，不应塞进 runner
- runner 只负责一次实际 WSS 请求

### B. 每次重试使用新的 session / requestId

不能复用同一个 `SessionListSyncSession`：

- 旧 attempt 的 `requestId`、`seenBatchKeys`、`status` 已经污染
- 设计上“每个 WSS 请求生成唯一 request_id”

因此每次 retry 都应新建一个内部 session：

- 第 1 次尝试：沿用外层 refresh 创建的 session 或其 request context
- 第 2/3 次尝试：新建新的 `SessionListSyncSession`

对外：

- `refresh()` Promise 仍然只有一个
- start/finish 仍然只有一对

### C. 失败分类保留，但改为“最终失败后再 fallback”

`classifyFailure()` 保留现有分类职责，但调用时机变为：

- 如果错误可重试，先交给 retry 机制
- 只有最终抛出的错误再进入 `classifyFailure()`

这样可以避免第一次 `SERVER_BUSY` 就直接把本地列表替换成 fallback。

### D. 可观测性

本轮至少增加轻量日志或可观测点：

- 当前 attempt 序号
- 本次错误是否进入 retry
- 最终是否 fallback

如果本轮不引入正式结构化日志，也要保证测试能断言：

- `runSessionListSync` 被调用次数
- finish 只触发一次

## 代码改动点

预计修改：

- `src/core/session-list-sync/session-list-sync-controller.ts`
- 视需要补 `src/core/session-list-sync/session-list-sync-types.ts`

测试预计修改：

- `tests/unit/session-list-sync/session-list-sync-controller.test.ts`

## 测试方案

### 单测

1. `SERVER_BUSY` 一次后成功：
   - `runSessionListSync` 调用 2 次
   - start 只触发 1 次
   - finish 成功只触发 1 次

2. `SYNC_IN_PROGRESS` 两次后成功：
   - `runSessionListSync` 调用 3 次
   - 最终成功，不走 fallback

3. `SERVER_BUSY` 超过重试上限：
   - 最终 fallback
   - finish(error) 只触发 1 次

4. 不可重试错误（如 token expired）：
   - 不重试
   - 直接 fallback

### 类型与回归

- `npm run type-check`
- 现有 session-list controller/cache/integration 用例保持通过

## 风险

1. retry 期间多次尝试会产生多个 request_id  
这是符合协议预期的，但要避免外层 session 状态与内层 attempt session 混淆。

2. 退避等待会拉长登录后同步时延  
这是预期行为，且仅对可恢复错误生效。

3. 已落过部分 batch 的失败 attempt 后重试，会再次收到重复会话数据  
依赖当前“幂等覆盖/merge + checkpoint 不提前推进”吸收重复。

## 待确认

请确认是否按以下边界执行：

1. 仅对 `SERVER_BUSY` 和 `SYNC_IN_PROGRESS` 做 retry/backoff
2. 重试策略固定为“最多 2 次重试，约 3-5 秒退避”
3. 最终失败后才 fallback，中间失败不触发 finish

确认后我再开始改代码。
