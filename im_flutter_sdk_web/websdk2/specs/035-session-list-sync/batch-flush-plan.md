# 实施增补：会话列表按 Batch 立即落库

**Feature**: `035-session-list-sync`  
**Date**: `2026-05-18`  
**Scope**: 将当前“聚合所有 batch 后一次性写 session-list 缓存”的实现，调整为“每个 batch 到达即写缓存，最后一批成功后才推进 checkpoint”。

## 背景

当前 Web 端 `session-list` 主链路已经具备：

- protobuf 二进制请求/响应
- 多帧 `GetSessionListResponse` 收包
- `request_id` 匹配
- `is_last_batch=true` 终态判定
- `last_sync_finished_ts` checkpoint 持久化
- 全量 / 增量两种缓存写入分支

但当前实现仍存在一个与后端/iOS 设计文档不一致的核心点：

- 现在是“先在内存聚合所有 batch，再一次性写缓存”
- 目标是“每个 batch 到达即写缓存；只有最后一批成功后才推进 checkpoint”

该差异会影响失败恢复语义、问题排查粒度以及大列表同步的中间态可观测性，因此需要单独收敛。

## 目标

本次改动只解决“按 batch 立即落库”这一件事，不在同一轮里同时处理：

- 增量同步的置顶会话覆盖语义
- Session 内消息加载 WSS 化
- retry/backoff 机制补全
- demo UI 行为变更

交付目标：

1. 每个 batch 到达即写 `session-list` 缓存
2. 非最后一批不得推进 `sessionsLastSyncTs`
3. 最后一批写入成功后才推进 checkpoint
4. 任一批失败、连接断开、最后一批推进 checkpoint 失败时，checkpoint 保持旧值
5. 保留当前 `refreshSessionList()` 的公开返回语义和 start/finish 事件语义

## 设计约束

### 1. 不引入半包持久化状态表

Web 端当前无数据库事务概念，也没有额外 sync task state 表。本次不新增新的持久化介质或状态表。

因此本次采用的最小一致性策略为：

- `items` 每批可见、立即落盘
- `checkpoint` 只在最后一批成功后更新
- 若中途失败，下次仍使用旧 checkpoint 重新请求，由幂等 merge 吸收重复数据

这与后端文档要求的“旧游标重发整次请求”是一致的。

### 2. 不改变当前全量/增量模式判定

仍沿用：

- `sessionsLastSyncTs === 0` => full
- `sessionsLastSyncTs > 0` => incremental

### 3. 不改变当前排序函数

仍沿用现有 `SessionListCache` / `sortSessionListRecords`：

- `pinnedTimestamp` 降序
- `lastMessageAt / updatedAt` 降序
- `conversationId` 作为稳定 tie-breaker

### 4. 不改变公开返回值

`refreshSessionList()` 仍在整轮同步完成后返回最终 `ReadonlyArray<SessionItem>`，不会把“每个 batch 的中间结果”暴露给用户 API。

## 改动方案

### A. 将“batch 写缓存”从 controller 末尾前移到 runner / session 驱动路径

当前结构：

- `runSessionListSync()` 负责收包并聚合 `aggregate`
- `SessionListSyncController.runRefresh()` 在 Promise resolve 后统一写缓存

目标结构：

- `runSessionListSync()` 每收到一批合法 `GetSessionListResponse`，就调用 cache 写入一批
- controller 只负责：
  - start / finish 事件
  - capability state
  - 成功后更新旧 conversation cache 映射
  - 失败后的 fallback 与 checkpoint reset

原因：

- batch 的业务边界在 runner 最清晰，那里已经能拿到 `isLastBatch`
- 可以避免 controller 末尾再次按整包重放一遍写入逻辑

### B. 新增“按 batch 应用 session-list 响应”的 cache API

在 `CacheManager` 中新增类似如下的入口：

- `applySessionListBatch(items, options)`

建议入参：

- `items`
- `mode: 'full' | 'incremental'`
- `isLastBatch`
- `syncStartedAt`
- `checkpointOnSuccess?`

语义：

- full：
  - 需要维护“当前 full 同步已收到的快照前缀”
  - 每一批都在已有 full 快照基础上继续扩展并落盘
  - 非最后一批不推进 checkpoint
  - 最后一批成功时再推进 checkpoint
- incremental：
  - 每一批都按 `conversationType + conversationId` upsert 进现有缓存
  - 非最后一批不推进 checkpoint
  - 最后一批成功时再推进 checkpoint

### C. Session 级暂存从“最终 aggregate”改为“已接收快照状态”

`SessionListSyncSession` 当前只记录：

- `seenBatchKeys`
- `items[]`
- `status`

本次需要增加“本轮已应用快照”的概念，至少在内存中能区分：

- full 模式下，当前已收到的快照前缀
- incremental 模式下，当前已接收的增量集合

建议：

- `SessionListSyncSession` 继续保留 `getItems()`，用于最终返回值
- 新增 `appendAcceptedBatch(batchItems)` / 或等价方法，显式记录“已接收且已写缓存”的批次数据

### D. checkpoint 推进必须与最后一批绑定

必须保证：

- 中间批次绝不更新 checkpoint
- 最后一批失败时 checkpoint 不变
- 最后一批写缓存成功但 checkpoint 写失败时，要把本次 finish 视为失败

Web 端当前 localStorage 无事务，因此“最后一批 items 已写、checkpoint 没写”这种不一致无法完全避免。

本次接受的工程语义是：

- 这类情况视为同步失败
- 下次仍用旧 checkpoint 重拉
- 由于 session-list 写入是幂等 merge / 覆盖，重复批次不会造成最终脏数据

这与当前持久化能力相符。

### E. 旧 conversation cache 的更新延后到整轮成功后

当前 controller 在整轮成功后会把 `SessionItem` 映射回旧 `ConversationSummary`。

本次保持这一点不变，不在每个 batch 时都更新旧 conversation cache，避免：

- 旧面板频繁抖动
- 两套缓存中间态不一致复杂化

即：

- `session-list cache`：每 batch 立即更新
- `conversation cache`：整轮成功后再统一映射更新

## 代码改动点

预计修改文件：

- `src/core/session-list-sync/session-list-sync-runner.ts`
- `src/core/session-list-sync/session-list-sync-session.ts`
- `src/core/session-list-sync/session-list-sync-controller.ts`
- `src/cache/cache-manager.ts`
- 视需要补充 `src/core/session-list-sync/session-list-sync-types.ts`

测试预计修改：

- `tests/unit/session-list-sync/session-list-sync-controller.test.ts`
- 新增或补充 `tests/unit/cache/session-list-cache.test.ts`
- 新增或补充 `tests/integration/session-list-sync/*.test.ts`

## 测试方案

### 单测

1. full 模式，多 batch：
   - 第 1 批到达后，`session-list cache` 已包含第 1 批内容
   - checkpoint 仍为旧值
   - 最后一批到达后，cache 为完整列表，checkpoint 推进

2. incremental 模式，多 batch：
   - 第 1 批到达后，本地已有缓存已发生 upsert
   - 未返回的旧普通会话仍保留
   - checkpoint 仍为旧值
   - 最后一批成功后 checkpoint 推进

3. 中间批失败：
   - 已到达批次保留在 `session-list cache`
   - checkpoint 不推进
   - `finish(error)` 触发

4. 最后一批 checkpoint 写失败：
   - 视为失败
   - checkpoint 保持旧值

### 集成测试

1. 登录后 full 多批响应：
   - `start -> finish`
   - 最终列表完整
   - checkpoint 更新

2. 登录后空结果：
   - 维持现有“不清空本地列表”的保护语义

3. incremental 多批响应：
   - 中间批已写入缓存
   - 最终列表正确
   - checkpoint 更新

## 风险

1. 当前 full 模式还保留了“保护同步期间实时新消息会话不被误删”的 merge 语义  
这会让“full 每批立即落库”实现比“纯快照替换”更复杂，需要谨慎保持现有保护。

2. Web localStorage 不支持事务  
最后一批 items 与 checkpoint 无法做到真正原子提交，只能用“checkpoint 成功才视为同步成功”的逻辑兜底。

3. 现有部分集成测试仍滞后于当前 session-list 协议实现  
本次要优先补能证明 batch 写库语义的测试，避免被旧断言误导。

## 待确认

请确认是否按以下边界执行：

1. 本轮只做“每个 batch 立即落库”
2. 不在同一轮顺带改“增量置顶会话覆盖语义”
3. 允许 Web 端继续使用“items 先写入、checkpoint 最后推进”的弱事务模型

确认后我再开始改代码。
