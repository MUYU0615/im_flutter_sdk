---
description: 'Task list for PresenceManager implementation'
---

# Tasks: PresenceManager 在线状态管理

**Input**: Design documents from `/specs/016-presence-manager/`
**Prerequisites**: `plan.md`, `spec.md`

**Tests**: 未在 spec 中要求强制新增测试，仅保留执行现有测试与 lint 的任务。

**Organization**: 任务按用户故事分组，确保每个用户故事可独立交付与验证。

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 建立 PresenceManager 相关基础文件结构

- [x] T001 创建 Presence 类型定义文件 `src/types/presence.ts`
- [x] T002 [P] 创建 Presence Manager 子路径导出 `src/managers/presence/index.ts`
- [x] T003 创建 PresenceManager 基础骨架 `src/managers/presence-manager.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 支撑所有 Presence 相关能力的公共基础

- [x] T004 更新事件系统类型以支持 Presence 事件 `src/types/event-system.ts`
- [x] T005 更新类型出口导出 Presence 类型 `src/types/index.ts`
- [x] T006 更新 SDK 入口导出 PresenceManager `src/index.ts`
- [x] T007 [P] 补充 Presence 业务错误码映射（旧工程 1100）`src/rest/api-errors.json`
- [x] T008 更新 ChatClient 暴露 REST 上下文（restBaseUrl/token/userId/clientResource）`src/chat-client.ts`
- [x] T009 更新 ChatClient 类型约束以描述 REST 上下文 `src/types/chat-client.ts`

**Checkpoint**: Foundation ready - user story implementation can begin

---

## Phase 3: User Story 1 - 订阅用户在线状态并接收变更 (Priority: P1) 🎯 MVP

**Goal**: 支持订阅/取消订阅在线状态并派发状态变更事件

**Independent Test**: 订阅用户后可获得订阅结果，触发 presence 变更事件并派发给 handler

### Implementation for User Story 1

- [x] T010 [US1] 实现用户名列表与订阅时长参数校验（INVALID_PARAM + details.fields）`src/managers/presence-manager.ts`
- [x] T011 [US1] 实现订阅/取消订阅 REST 调用 `src/managers/presence-manager.ts`
- [x] T012 [US1] 实现 Presence 事件注册/移除语法糖并限制事件类型 `src/managers/presence-manager.ts`
- [x] T013 [US1] 接入 Presence 变更通知并派发事件 `src/core/message/message-receiver.ts`

---

## Phase 4: User Story 2 - 发布自身在线状态 (Priority: P2)

**Goal**: 支持发布自定义在线状态描述

**Independent Test**: 发布后可通过查询接口读取到一致的状态描述

### Implementation for User Story 2

- [x] T014 [US2] 实现发布在线状态接口与参数校验 `src/managers/presence-manager.ts`

---

## Phase 5: User Story 3 - 查询在线状态与管理订阅列表 (Priority: P3)

**Goal**: 支持查询在线状态与分页订阅列表

**Independent Test**: 查询与分页返回结构符合预期

### Implementation for User Story 3

- [x] T015 [US3] 实现查询在线状态接口 `src/managers/presence-manager.ts`
- [x] T016 [US3] 实现分页查询订阅列表接口 `src/managers/presence-manager.ts`

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 统一版本与验证流程

- [x] T017 更新版本号与变更日志 `package.json`
- [x] T018 更新变更日志说明与验证记录 `CHANGELOG.md`
- [x] T019 运行单元测试与 lint 校验 `package.json`
- [x] T020 [P] 补充 PresenceManager 返回结构与行为回归测试（事件注册、发布/取消订阅、错误回调）`tests/unit/managers/presence-manager.test.ts`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** → **Foundational (Phase 2)** → **User Stories (Phase 3-5)** → **Polish (Phase 6)**

### User Story Dependencies

- **US1 (P1)**: 依赖 Phase 2 完成后可独立实现
- **US2 (P2)**: 依赖 Phase 2 完成后可独立实现
- **US3 (P3)**: 依赖 Phase 2 完成后可独立实现

### Parallel Opportunities

- T002 与 T001 可并行（不同文件）
- T007 与 T008/T009 可并行（不同文件）

---

## Parallel Example: User Story 1

```bash
Task: "实现用户名列表与订阅时长参数校验（INVALID_PARAM + details.fields）" -> src/managers/presence-manager.ts
Task: "实现订阅/取消订阅 REST 调用" -> src/managers/presence-manager.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 + Phase 2 完成
2. 实现 US1 并独立验证
3. 确认订阅与事件派发可用后再进入 US2/US3

### Incremental Delivery

- US1 完成后交付订阅与事件
- US2 完成后交付发布能力
- US3 完成后交付查询与订阅列表管理
