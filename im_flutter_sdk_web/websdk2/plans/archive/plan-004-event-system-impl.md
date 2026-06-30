# 计划：事件系统实现（ChatClient 仅连接事件）

## 目标
- ChatClient 对外事件只保留连接事件（类型层限制）。
- Manager 事件通过语法糖注册，且类型只允许本 Manager 事件。
- 内部仍复用统一 EventHub 分发消息/状态事件。

## 实施步骤
1. **类型收敛**
   - 在 `src/types/event-system.ts` 增加 `ConnectionEventName/ConnectionEventHandlerMap`。
   - 在 `src/types/manager.ts` 增加 `ManagerEventContext`（提供 add/remove 事件入口），`bind` 增加可选 context。

2. **ChatClient 对外限制**
   - `ChatClient.addEventHandler` 入参改为 `ConnectionEventHandlerMap`。
   - 在注册 Manager 时传入 `ManagerEventContext`，内部使用 EventHub 仍允许完整事件注册。

3. **Manager 语法糖落地**
   - `ChannelManager.bind` 接收 context，并在 `add/removeEventHandler` 中使用。
   - 未绑定时保持明确错误。

4. **类型测试**
   - 新增类型测试，验证 `ChatClient.addEventHandler` 不允许 `onMessage`。
   - 现有 ChannelManager 类型测试保持通过。

5. **验证与提交**
   - 运行 `npm run type-check` 与 `npm test -- --run`（联网）。
   - 迭代版本号与更新 `CHANGELOG.md`。
   - 提交本次变更。

## 风险与处理
- ManagerBase 类型变更：使用可选参数避免破坏已有调用。
- 若 EventHub 注册流程变化导致事件缺失，优先回退到 EventHub 直连并补单测。
