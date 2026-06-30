# Demo Presence API 验证功能扩展计划

## 目标
- 在 demo 页面补齐 PresenceManager 全量 API 验证入口：
  - publishPresence（发布在线状态）
  - subscribePresence（订阅在线状态）
  - unsubscribePresence（取消订阅）
  - getSubscribedPresenceList（分页查询订阅列表）
  - getPresenceStatus（查询在线状态）
- 每次调用后在页面日志中打印 SDK 返回值或错误信息。

## 现状分析
- demo 已具备 Presence 订阅与状态变更监听展示。
- 仍缺少发布、取消订阅、查询订阅列表、查询在线状态等入口。

## 方案概述
- UI：新增 PresenceApiPanel 或在现有 PresencePanel 内扩展多个操作区域。
- 状态：新增订阅列表结果、查询结果、发布状态文本等展示区域。
- 日志：统一在调用完成后记录返回值（JSON 格式）。

## 实施步骤
1. 扩展 PresencePanel
   - 发布在线状态：输入描述并调用 `publishPresence`
   - 取消订阅：输入用户列表并调用 `unsubscribePresence`
   - 查询订阅列表：输入页码/页大小并调用 `getSubscribedPresenceList`
   - 查询在线状态：输入用户列表并调用 `getPresenceStatus`
2. App.tsx 增加回调
   - 增加状态数据存储与清理方法
   - 将 API 返回值透传到面板展示
3. 工具与类型
   - 复用用户列表解析与时间格式化工具
   - 新增 demo 类型定义用于订阅列表/查询结果展示
4. 样式补充
   - 为 API 返回数据展示增加样式与空态提示

## 风险与应对
- 用户输入非法：前端校验并提示，避免触发 SDK 校验错误。
- 返回结构为空：增加空态展示与日志输出。

## 测试计划
- 手动验证：
  - 发布在线状态并记录返回值
  - 订阅/取消订阅目标用户并观察变更
  - 查询订阅列表与查询在线状态并展示结果

## 变更影响范围
- demo/src/App.tsx
- demo/src/components/PresencePanel.tsx
- demo/src/types.ts
- demo/src/utils.ts（如需）
- demo/src/index.css

