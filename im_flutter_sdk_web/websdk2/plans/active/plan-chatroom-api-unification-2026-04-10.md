# ChatRoom API 统一计划（方案 2）

## 背景

当前仓库存在两套 `chatroom` 设计：

- 已提交的第二阶段发布面兼容方案，仍沿用旧命名：`chatroomId`、`getPublicChatRoomList()`、`acceptChatRoomInvite()` 等
- 工作树中未提交的新设计，采用新命名：`chatRoomId`、`getChatRoomList()`、`getAdminList()`、新的事件 payload / mapper 结构

用户已确认采用方案 2：统一切到新的 `chatroom` API 设计。

## 目标

1. 以当前工作树中的新 `chatroom` 设计为准，统一类型、管理器、REST 封装与事件 mapper
2. 调整 `src/index.ts`、`src/types/event-system.ts`、`src/chat-client.ts` 等外围接线，避免继续引用旧 `chatroom` 名称
3. 同步更新 `chatroom` 相关测试，保证其与新 API 约定一致
4. 恢复 `type-check`、`build`、`test:coverage` 全量通过

## 主要改动范围

### 1. ChatRoom 设计统一

- `src/types/chatroom.ts`
- `src/managers/chatroom-manager.ts`
- `src/managers/chatroom/*`
- `src/rest/chatroom-management.ts`

目标：

- 统一使用 `chatRoomId`
- 统一公开方法命名与返回结构
- 统一事件 payload 字段与 mapper 输出

### 2. 外围接线

- `src/index.ts`
- `src/types/event-system.ts`
- `src/chat-client.ts`
- `src/types/connection.ts`

目标：

- 根导出只暴露新 API 类型
- 事件系统与 `chat-client` 只引用新 `chatroom` 事件名 / payload map
- 移除旧接口残留引用

### 3. 测试与验证

- `tests/types/chatroom-manager-types.test.ts`
- `tests/unit/managers/chatroom-manager.test.ts`
- `tests/unit/chatroom/*`
- 可能影响的 contract test / integration test

目标：

- 测试断言切换到新 API
- 覆盖 manager、entity、event mapper、根导出与主接线

## 风险

1. 新旧 API 命名差异较大，`src/index.ts` 与测试容易遗漏旧名字，导致类型错误蔓延
2. `chatroom` 事件名与 `group` 有同名冲突，需要在事件系统和 `chat-client` 中明确隔离
3. 若 `chat-client` 内部接线仍依赖旧 payload 结构，会出现编译通过但运行时事件映射错误

## 验证计划

- `npm run type-check`
- `npm run build`
- `npm run test:run -- tests/types/chatroom-manager-types.test.ts tests/unit/managers/chatroom-manager.test.ts tests/unit/chatroom/chatroom-event-mapper.test.ts`
- `npm run test:coverage`
