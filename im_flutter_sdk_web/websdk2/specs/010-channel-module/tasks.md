---

description: "Channel 模块（统一会话/群组/联系人）"
---

# 任务清单：Channel 模块（统一会话/群组/联系人）

**Input**: `/specs/010-channel-module/`  
**Prerequisites**: plan.md、spec.md  
**Tests**: 建议包含单元测试  
**Organization**: 任务按用户故事分组

## 格式: `[ID] [P?] [Story] 描述`

---

## 阶段 1：基础类型与结构

- [x] T001 [P] 新增 `src/types/channel.ts` 定义 Channel 类型与基础字段
- [x] T002 [P] 在 `src/types/index.ts` 导出 Channel 相关类型

---

## 阶段 2：用户故事 1 - Channel 列表 (P1)

- [x] T003 [US1] 新增 `src/managers/ChannelManager.ts`，实现 `getChannels`/`getChannel` 基础接口
- [x] T004 [US1] 新增 `tests/unit/managers/channel-manager.test.ts` 覆盖列表与查询基础行为

---

## 阶段 3：用户故事 2 - Channel 消息操作 (P1)

- [x] T005 [US2] 新增 `src/managers/Channel.ts` 实体，提供 `createMessage`/`sendMessage` 语法糖
- [x] T006 [US2] 在 `tests/unit/managers/channel-message.test.ts` 覆盖创建消息与发送消息行为

---

## 阶段 4：用户故事 3 - Channel 创建与管理 (P2)

- [x] T007 [US3] 在 `ChannelManager` 实现 `createChannel` 并返回绑定实例
- [x] T008 [US3] 在 `tests/unit/managers/channel-manager.test.ts` 覆盖创建与绑定行为

---

## 阶段 5：注册与集成

- [x] T009 [P] 通过 `ChatClient.use(ChannelManager)` 支持注入并暴露 `channelManager`
- [x] T010 [P] 新增 `tests/unit/chat-client/channel-manager-use.test.ts` 覆盖注入与访问

---

## 阶段 6：用户故事 4 - Channel 事件监听语法糖 (P2)

**Goal**: ChannelManager 提供事件语法糖并限制事件类型

### Tests for User Story 4

- [ ] T011 [P] 新增/更新类型测试，验证 `channelManager` 仅允许注册 Channel 事件

### Implementation for User Story 4

- [ ] T012 [US4] 在 `ChannelManager` 增加 `addEventHandler/removeEventHandler` 语法糖
- [ ] T013 [US4] 补充 Channel 事件类型映射（如 `ChannelEventMap`）并限制 handler 类型
