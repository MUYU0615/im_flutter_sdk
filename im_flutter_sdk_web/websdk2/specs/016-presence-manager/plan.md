# PresenceManager 实现计划

**创建时间**: 2026-02-11  
**范围**: 基于 `specs/016-presence-manager/spec.md` 与旧工程 `presenceApi.ts` 实现 PresenceManager（不新建分支）

## 目标

- 完整实现旧工程 presenceApi.ts 的核心 API（发布/订阅/取消/查询/订阅列表），并以 `getSubscribedPresenceList` 为标准命名。
- 错误处理与参数校验对齐 `specs/005-error-handling/spec.md`，参数错误统一 `INVALID_PARAM (110)`，并标明具体参数字段。
- REST 请求风格与当前工程一致，使用统一的 REST 客户端与错误映射。
- 事件派发遵循现有事件系统，支持 presence 变更通知。

## 需求映射（旧工程 → 新工程）

- `publishPresence({ customStatus })`
- `subscribePresence({ userIds, expiry })`
- `unsubscribePresence({ userIds })`
- `getSubscribedPresenceList({ pageNum, pageSize })`
- `getPresenceStatus({ userIds })`

## 实施步骤

1. **类型与事件定义**
   - 新增 Presence 相关类型（状态、订阅结果、订阅列表）并补齐 `import type` 使用。
   - 增加 Presence 事件名与事件载荷类型，确保事件系统可派发/订阅。

2. **REST 访问能力**
   - 设计 Presence REST 请求入口（保持统一 RestClient/错误处理风格）。
   - 明确 REST 所需上下文字段（restBaseUrl、appKey、userId、token、clientResource），补齐 ChatClient 可获取/校验的访问上下文。

3. **PresenceManager 实现**
   - 新建 `PresenceManager`，实现 `ManagerBase` 绑定能力。
   - 逐一实现 API：发布、订阅、取消、查询、分页订阅列表。
   - 所有参数校验失败统一抛出 `ValidationError`，错误码 `INVALID_PARAM (110)`，并附带 `details.fields` 指明具体字段。

4. **事件派发接入**
   - 接入底层 presence 状态推送（若走现有事件系统/协议），在 Manager 中转发为 Presence 事件。
   - 提供 addEventHandler/removeEventHandler 语法糖，限制事件类型范围。

5. **测试与校验**
   - 新增单元测试覆盖参数校验、REST 调用与错误映射、事件派发。
   - 运行 `npm run test:run -- tests/unit` 与 `npm run lint`。

6. **版本与文档**
   - 迭代 `package.json` 版本号。
   - 更新 `CHANGELOG.md`，记录 PresenceManager 实现内容与验证结果。

## 风险与注意事项

- REST 基础地址与 token 的获取路径需统一，避免未登录或未初始化时误发请求。
- presence 业务错误码在 `api-errors.json` 中尚未定义时，需确认是否补充映射或使用通用错误。
- Presence 事件的来源与触发时机需与现有协议保持一致，避免事件缺失或重复派发。

## 测试计划

- 单元测试：参数校验、REST 错误映射、事件派发。
- 现有测试：`npm run test:run -- tests/unit`、`npm run lint`。
