# 联系人同步事件语义收口计划

## 背景

当前 `024-contact-sync` 的公开语义与本次要求不一致：

- `onContactSyncStart` 目前携带 `decision/version/hasUsableSnapshot`
- `onContactSyncFinish` 目前携带 `decision/version/source/hasUsableSnapshot/error?`
- metadata 预检为 `skip` 时，不派发任何联系人同步事件
- metadata 某些提前失败分支只派发 `finish(error)`，不会先派发 `start`

本次目标是把联系人同步事件收口为更简单、稳定的 UI 契约。

## 本次需求解释

按你的描述，本次按以下 contract 实施：

- `onContactSyncStart`：每一轮联系人同步流程都必须派发，且**不携带任何 payload**
- `onContactSyncFinish`：每一轮联系人同步流程都必须派发；成功时**不携带 payload**，失败时仅携带 `error`

也就是说，对外语义收敛为：

```ts
onContactSyncStart: () => void
onContactSyncFinish: (payload?: { error: ContactSyncError }) => void
```

其中实现层可以继续保留内部 `decision/version/source/hasUsableSnapshot` 等诊断信息，但不再通过公开事件回调暴露。

## 风险说明

这是**破坏性变更**，影响范围不止 demo：

- 已接入 `onContactSyncStart(payload)` / `onContactSyncFinish(payload)` 的业务代码会编译失败或运行时拿不到原字段
- 当前 contact-sync 单元测试、集成测试、类型测试需要整体改写
- 文档、spec、API 注释、demo 日志示例都要同步收口
- “skip 不派发事件”的既有设计将被推翻，事件语义会从“实际同步开始/结束”改成“每轮同步流程开始/结束”

可选替代方案是新增更轻量的事件而保留旧事件，但这会让语义双轨并存，继续增加心智负担；如果以“按你当前要求严格收口”为目标，就应直接改旧 contract。

## 改动范围

### 1. 规格与计划

需要更新：

- `specs/024-contact-sync/spec.md`
- `specs/024-contact-sync/plan.md`
- `specs/024-contact-sync/tasks.md`

重点收口内容：

- 删除“metadata 预检为 skip 时不派发事件”的要求
- 删除 `onContactSyncStart` / `onContactSyncFinish` 对 `decision/version/source/hasUsableSnapshot` 的公开约束
- 改成“每轮联系人同步流程无论成功、失败、skip、metadata 快速失败，都必须形成 `start -> finish` 闭环”
- `finish` 失败时仅暴露 `error`
- 成功时 `finish` 不携带任何业务 payload

### 2. 公开类型与导出

需要更新：

- `src/types/contact.ts`
- `src/types/event-system.ts`
- `src/index.ts`
- 相关 JSDoc 与类型测试

目标：

- 移除 `ContactSyncStartPayload`
- 收口 `ContactSyncFinishPayload` 为仅包含可选 `error`
- 保持 `ContactSyncError` 结构可诊断

### 3. 实现逻辑

需要更新：

- `src/chat-client.ts`
- `src/core/contact-sync/roster-sync-controller.ts`
- `src/managers/contact-manager.ts`

核心改动：

- 无论是 `skip`、metadata 明确失败、metadata 保守失败、DNS 缺少 `sync-ws`、socket 失败、同步成功，都统一走 `start -> finish`
- `onStart()` 改为无参数派发
- `onFinish()` 改为成功时无 payload，失败时仅传 `error`
- 内部诊断字段转为结构化日志，不再暴露给事件监听方

### 4. demo / 文档

需要更新：

- `demo/src/App.tsx`
- `docs/reference/contact-manager-api.md`
- 必要时更新 `CHANGELOG.md`

目标：

- demo 控制台日志改成只打印事件名，失败时打印 `error`
- 文档示例改成 `onContactSyncStart: () => {}` 与 `onContactSyncFinish: payload => {}`

### 5. 测试分层

单元测试：

- `tests/unit/contact-sync/roster-sync-decision.test.ts`
- 相关 `types` / `manager` 单元测试

需要覆盖：

- `skip` 路径也会形成 `start -> finish`
- metadata 失败形成 `start -> finish(error)`
- 成功完成形成 `start -> finish`
- 失败时 `finish` 仅带 `error`

集成测试：

- `tests/integration/contact-sync/contact-sync-login.integration.test.ts`
- 若涉及恢复链路，再评估 `contact-sync-recovery.integration.test.ts`

需要覆盖：

- 登录后开启自动同步时，无论 `skip`、成功、失败，都能观察到事件闭环
- 业务侧监听签名不再依赖 start payload

E2E：

- 继续不新增；原因是当前没有稳定的联系人 UI 主路径，仍由集成测试兜底

## 实施步骤

1. 先修改 `024` 的 spec / plan / tasks，收口事件 contract 与测试要求
2. 再修改公开类型、事件系统与导出
3. 再调整 `chat-client` / `roster-sync-controller` 的事件派发时机与 payload
4. 再同步 demo、文档、测试
5. 最后执行验证、更新版本号、更新 `CHANGELOG.md`、提交 commit

## 验证计划

- `npm run test:run -- tests/unit/contact-sync tests/integration/contact-sync`
- `npm run test:run -- tests/types/contact-manager-types.test.ts tests/unit/managers/contact-manager.test.ts`
- `npx eslint src/chat-client.ts src/core/contact-sync/roster-sync-controller.ts src/types/contact.ts src/types/event-system.ts demo/src/App.tsx --ext .ts,.tsx`
- `npm run type-check`

## 待你确认

- 是否按上面的**破坏性收口方案**执行：`start` 永远无 payload，`finish` 成功无 payload、失败仅带 `error`
- 确认后我会继续修改 `specs/024-contact-sync/*`、代码和测试
