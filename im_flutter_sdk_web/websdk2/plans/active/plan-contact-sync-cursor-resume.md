# 联系人同步 Cursor 续传计划

## 目标

- 为联系人同步 websocket 增加“单轮同步内的 cursor 续传”能力。
- 当联系人同步过程中 socket 中断、切换候选 `sync-ws` 地址或在同一轮恢复重试时，SDK 可以基于已确认的 `cursor` 继续拉取剩余分页，而不是回退到 `cursor: 0` 整轮重来。
- 保持当前“整轮完成后一次性应用联系人快照”的一致性语义，不让业务侧观察到中间态。

## 范围

- 仅覆盖同一轮联系人同步生命周期内的**内存态续传**。
- 仅调整联系人同步内部状态机与测试，不改对外 `ContactManager` 事件语义。
- 不引入跨页面刷新、跨 SDK 重建、跨账号切换的持久化 checkpoint。

## 非目标

- 不做联系人同步中间结果落盘。
- 不做“刷新页面后继续未完成联系人同步”。
- 不修改联系人同步协议结构，不要求服务端新增字段。

## 现状

- 当前联系人同步请求固定从 `cursor: 0` 发起，见 `src/chat-client.ts`。
- websocket 响应中包含 `cursor`，SDK 当前仅用它判断“本轮是否结束”和“分页是否合法”，见 `src/core/contact-sync/roster-sync-session.ts`。
- `RosterSyncClient` 中途断线后会直接失败，本轮已收到的分页只存在内存中，且不会在下一次请求里复用。
- 当前 controller 只有在整轮成功结束后才调用 `applySyncResult`，因此一旦中断，前面已收到的数据也会丢失。

## 方案概述

### 1. 以 session 维护可恢复同步状态

在 `src/core/contact-sync/roster-sync-session.ts` 扩展分页会话状态，至少包含：

- `pages`
- `version`
- `responseType`
- `requestId`
- `pageCount`
- `nextCursor`
- `completed`

会话职责：

- 接收并校验每一页 `RosterResponse`
- 记录“已成功处理的最后一页之后应使用的 `cursor`”
- 在全量/增量模式切换、重复 cursor、非法 cursor 场景下抛出可诊断错误
- 暴露当前是否已完成、下一次恢复应使用的 `cursor`、已累计分页结果

### 2. 请求构造支持显式 cursor

调整 `src/chat-client.ts` 中联系人同步请求构造逻辑：

- 现状：`buildContactRosterRequest(version)` 固定写入 `cursor: 0`
- 目标：`buildContactRosterRequest(version, cursor, requestId?)`

使用规则：

- 首次同步请求使用 `cursor: 0`
- 中途恢复使用 session 维护的 `nextCursor`
- `requestId` 是否复用由联调结果决定，默认同一轮恢复时保持同一 `requestId`

### 3. RosterSyncClient 支持失败后基于 cursor 恢复

调整 `src/core/contact-sync/roster-sync-client.ts`：

- 将当前“每个 URL 独立创建新 session”的实现改为“整轮 sync 共享同一个 session”
- socket 中途失败时：
  - 保留当前 session
  - 切换下一个候选 URL 或等待同轮重试
  - 使用 `version + session.nextCursor (+ requestId)` 重新发起同步请求
- 只要恢复成功，继续把后续分页追加到同一个 session
- 直到收到 `cursor === 0` 才视为本轮完成

### 4. 保持最终一致性，不暴露中间态

不改变 `RosterSyncController` 的最终应用时机：

- 仍然只在整轮完成后调用 `applySyncResult`
- 不把半成品联系人分页写入 cache
- 不提前派发成功事件

这样可以保证：

- 业务侧只看到完整快照
- 失败时不会污染现有 cache
- 续传逻辑仅属于同步内部实现细节

## 关键决策

### 决策 1：只做内存态续传

- 原因：当前需求重点是“中途断线后不要从头重来”，不是“跨刷新恢复未完成同步”。
- 收益：显著降低缓存一致性与清理复杂度。

### 决策 2：恢复点使用“最后一页成功处理后的 nextCursor”

- 不使用“当前正在请求的 cursor”
- 避免 socket 在页边界断开时出现跳页或重复应用风险

### 决策 3：整轮完成后再 apply

- 不引入增量落盘和中间态回滚
- 与现有联系人快照一致性语义保持一致

## 实施步骤

1. 扩展 `RosterSyncSession`
- 增加 `nextCursor/requestId/pageCount/completed` 等状态
- 提供恢复所需的状态读取方法
- 明确 cursor 校验与完成判定

2. 改造请求构造
- 让联系人同步请求支持传入 cursor
- 梳理首次请求与恢复请求的入参来源

3. 改造 `RosterSyncClient`
- 整轮共享一个 session
- 当前 URL 失败时切换候选地址并基于 session 恢复
- 将恢复失败、cursor 非法、候选地址耗尽等情况映射为统一错误

4. 校准 `RosterSyncController`
- 确认 controller 无需感知分页恢复细节
- 仅在必要时补充日志与失败阶段信息

5. 补测试
- 单元测试：
  - session 正常推进 `nextCursor`
  - session 在重复 cursor / 非法分页时失败
  - client 在中途断线后使用恢复 cursor 重试
  - client 在多个 URL 间切换时不丢已收分页
- 集成测试：
  - 一轮同步收到第 1 页后断线，恢复时从剩余分页继续
  - 恢复后最终联系人结果正确
  - 无新变更时不重复产生业务更新

## 主要风险

- **服务端 requestId 语义不明确**
  - 需要确认恢复时是否允许复用同一 `requestId`
- **cursor 恢复边界与服务端实现不一致**
  - 需要通过联调确认“恢复请求带上次返回的 cursor”是否符合网关预期
- **重复分页导致数据重复**
  - 通过 session 层 cursor 校验和最终应用前的关系合并兜底
- **恢复期间用户切换或登出**
  - 继续沿用现有 `cancel/resetCore` 机制，旧用户同步不得污染新用户

## 验证

- `npx eslint src/chat-client.ts src/core/contact-sync/roster-sync-client.ts src/core/contact-sync/roster-sync-session.ts tests/unit/contact-sync/roster-sync-client.test.ts tests/unit/contact-sync/roster-sync-session.test.ts tests/integration/contact-sync --ext .ts`
- `npm run test:run -- tests/unit/contact-sync/roster-sync-client.test.ts tests/unit/contact-sync/roster-sync-session.test.ts`
- `npm run test:run -- tests/integration/contact-sync`
- `npm run docs:api:comments`

## 待确认

- 恢复请求是否必须复用同一 `requestId`
- 候选 URL 切换与“连接恢复后再触发新一轮同步”是否共享同一恢复策略
- 本次是否一并补 `specs/024-contact-sync/tasks.md` 中 T036 的实现与任务状态
