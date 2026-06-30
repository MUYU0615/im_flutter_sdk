---

description: "统一事件系统实现任务清单"
---

# 任务清单：统一事件系统（addEventHandler 模式）

**Input**: 设计文档 `/specs/004-event-system/`  
**Prerequisites**: plan.md（必需）, spec.md（必需）  
**Tests**: 包含单元测试任务  
**Organization**: 任务按用户故事分组，确保每个故事可独立验证

## 格式: `[ID] [P?] [Story] 描述`

- **[P]**: 可并行执行（不同文件/无依赖）
- **[Story]**: 对应用户故事（US1/US2/US3/US4）

---

## 阶段 1：基础结构

- [x] T001 新增 `src/core/events/event-hub.ts`，实现 add/remove/dispatch
- [x] T002 [P] 新增 `src/types/event-system.ts`，定义事件名称与 payload 类型映射

---

## 阶段 2：用户故事 1 - 批量注册/移除事件 (P1)

**Goal**: addEventHandler/removeEventHandler 支持事件分组管理

### Tests for User Story 1

- [x] T003 [P] 编写事件系统单元测试 `tests/unit/events/event-hub.test.ts`
  - 重复 id 覆盖
  - 移除不存在 id 不报错
  - handler 抛错不影响其他 handler

### Implementation for User Story 1

- [x] T004 [US1] 在 `event-hub.ts` 中实现 handler 分组存储与 dispatch

---

## 阶段 3：用户故事 2 - 连接状态事件统一化 (P1)

**Goal**: `onConnecting/onConnected/onDisconnected` 通过 EventHub 统一触发

### Tests for User Story 2

- [x] T005 [P] 更新 `tests/unit/chat-client/connection-events.test.ts` 验证 `onConnecting/onConnected/onDisconnected`

### Implementation for User Story 2

- [x] T006 [US2] CoreSDK/ChatClient 通过 EventHub 触发 `onConnecting/onConnected/onDisconnected`
- [x] T007 [US2] 移除 `onConnectionStateChange` 对外 API

---

## 阶段 4：用户故事 3 - 内外事件迁移 (P2)

**Goal**: 现有事件全部通过 EventHub 对外触发，内部模块改用 EventHub

### Tests for User Story 3

- [x] T008 [P] 更新消息/错误相关单元测试（若存在）以使用新事件系统

### Implementation for User Story 3

- [x] T009 [US3] 迁移 `message`/`error` 事件到 EventHub（CoreSDK 作为出口）
- [x] T010 [US3] 内部模块改用 EventHub（ConnectionManager/MessageSender/MessageReceiver 等）
- [x] T011 [US3] 统一对外 API，仅保留 add/remove

---

## 阶段 5：收尾与文档

- [x] T012 [P] 更新使用说明与示例（docs/ 或 README）

---

## 阶段 6：用户故事 4 - Manager 事件语法糖与类型限制 (P2)

**Goal**: Manager 提供事件语法糖入口，并通过类型约束限制事件范围

### Tests for User Story 4

- [ ] T013 [P] 新增/更新类型测试，验证 `channelManager` 只允许注册 Channel 事件

### Implementation for User Story 4

- [ ] T014 [US4] 在 `src/types/event-system.ts` 补充 `ManagerEventMap` 与 handler 类型定义
- [ ] T015 [US4] 为各 Manager 增加 `addEventHandler/removeEventHandler` 语法糖（至少覆盖 ChannelManager）
