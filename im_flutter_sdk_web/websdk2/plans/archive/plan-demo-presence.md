# Demo Presence 功能实现计划

## 目标
- 在 demo 页面新增 Presence 订阅能力，可输入用户列表并发起订阅。
- 监听 Presence 状态变更事件，并在页面实时展示最新状态。

## 现状分析
- demo 已具备 ChatClient 初始化、登录、发送消息、日志面板等基础功能。
- SDK 已实现 PresenceManager，并通过事件系统派发 `onPresenceStatusChange`。

## 方案概述
- UI：新增 PresencePanel 组件，提供订阅输入、订阅时长输入、订阅按钮与状态展示区域。
- 状态：App.tsx 增加 presence 相关状态管理（订阅列表、变更日志/状态列表）。
- 事件：注册 PresenceManager 事件处理器，接收变更并更新 UI。
- SDK 接入：初始化时 `ChatClient.init(...).use(ChannelManager).use(PresenceManager)`。

## 实施步骤
1. 新增 PresencePanel 组件
   - 输入框：订阅用户列表（逗号分隔）
   - 输入框：订阅时长（秒）
   - 按钮：发起订阅、清空展示
   - 列表：展示当前已知用户状态（uid/ext/lastTime/expire/设备状态）
2. App.tsx 接入 PresenceManager
   - 初始化时注册 PresenceManager
   - 注册 Presence 事件处理器（`onPresenceStatusChange`）
   - 增加订阅处理函数，调用 `subscribePresence`
3. types/utils 扩展
   - 新增 presence 状态类型（demo 用）
   - 增加输入解析工具（用户列表解析、时间格式化）
4. 样式补充
   - 根据现有 CSS 风格添加 Presence 面板样式

## 风险与应对
- 事件未触发：确保登录后、订阅成功后再注册 handler，必要时记录日志。
- 输入参数无效：前端校验并展示错误提示，避免触发 SDK 校验异常。

## 测试计划
- 手动验证（demo 页面）
  - 初始化 + 登录成功后订阅目标用户
  - 观察 Presence 事件触发，列表实时更新
  - 输入非法用户/时长提示错误

## 变更影响范围
- demo/src/App.tsx
- demo/src/components/PresencePanel.tsx（新增）
- demo/src/types.ts（新增 demo 类型）
- demo/src/utils.ts（新增工具函数）
- demo/src/index.css（样式）

