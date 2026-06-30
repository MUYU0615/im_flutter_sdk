# 实施方案：Channel 模块（统一会话/群组/联系人）

**Branch**: `010-channel-module` | **Date**: 2026-01-30 | **Spec**: `specs/010-channel-module/spec.md`  
**Input**: 规范文档 `/specs/010-channel-module/spec.md`

## 概述

新增 ChannelManager 作为唯一入口，负责创建、列表与查询 Channel 实例。Channel 实例作为 ChannelManager 的产物，提供创建消息与发送消息语法糖，底层复用 ChatClient 现有能力。

## 设计要点

1. **Channel 类型设计**
   - `Channel` 包含 `channelId` 与 `type`（`'single' | 'group' | 'room'`）。
   - 采用只读属性，保证通道标识不可被外部修改。

2. **ChannelManager 入口**
   - `ChannelManager` 作为唯一入口，提供 `getChannels`、`getChannel`、`createChannel`。
   - 管理器由 ChatClient 注入并持有 client 引用，负责生成 Channel 实例。

3. **Channel 消息操作**
   - Channel 实例提供 `createTextMessage` 等创建方法与 `sendMessage`。
   - 内部直接调用 ChatClient 对应能力，并确保 `channel` 字段写入。

4. **绑定与错误**
   - Channel 必须绑定 ChatClient；未绑定调用时抛出 `ValidationError`（`ERROR_CODES.VALIDATION_REQUIRED`）。
   - ChannelManager 在创建/获取 Channel 时完成绑定。

5. **Channel 事件语法糖与类型限制**
   - `ChannelManager` 提供 `addEventHandler/removeEventHandler` 语法糖。
   - 仅允许注册 Channel 相关事件（如 `onMessage`），类型约束在编译期生效。

6. **数据来源与缓存**
   - 初期不实现复杂缓存；`ChannelManager` 可直接返回临时实例。
   - 未来若需要列表缓存/排序，在后续 spec 扩展。

## 实施步骤

1. 定义 `Channel` 类型与基础字段（`src/types/channel.ts`）。
2. 新增 `Channel` 实体与 `ChannelManager` 类（`src/managers/ChannelManager.ts`）。
3. 在 `ChatClient` 增加 `channelManager` 注册入口与 `use(ChannelManager)` 支持。
4. 在 `Channel` 中实现 `createMessage/sendMessage` 语法糖，复用 ChatClient。
5. 在 `ChannelManager` 增加 `addEventHandler/removeEventHandler` 语法糖并配置类型限制。
6. 补充单元测试覆盖 Channel 绑定、消息创建与发送。
7. 增补类型测试，确保 `channelManager` 只能注册 Channel 事件。

## 测试策略

- `ChannelManager.getChannel` 返回的 Channel 包含正确 `channelId/type`。
- Channel 未绑定时调用 `sendMessage` 抛出明确错误。
- Channel 创建消息时自动填充 `channel` 信息并可发送。
- `channelManager.addEventHandler` 仅允许 Channel 事件，注册非 Channel 事件需在类型层报错。

## 风险与权衡

- **风险**：Channel 语法糖与 ChatClient 功能重复。
  - **应对**：明确 Channel 仅作为语法糖，核心逻辑保持在 ChatClient。
- **风险**：Channel 需要填充 channel 字段，可能与现有消息结构冲突。
  - **应对**：先明确 Message 的 channel 字段结构，必要时在类型层加约束。
