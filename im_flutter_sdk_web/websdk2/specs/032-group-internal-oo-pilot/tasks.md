---
description: '032 Group 内部对象化试点实现任务清单'
---

# Tasks: Group 内部对象化试点

**Input**: 设计文档来自 `/specs/032-group-internal-oo-pilot/`  
**Prerequisites**: plan.md（必需）、spec.md（必需）、research.md、data-model.md、contracts/、quickstart.md  
**Tests**: 需要，包含单元测试、集成测试与类型回归；E2E 本期不新增 group 专项用例，但必须在本文件中显式记录复用依据 / 不适用依据  
**Organization**: 任务按用户故事分组，支持独立实现与独立验证

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行（不同文件、无前置依赖）
- **[Story]**: 仅用户故事阶段使用（`[US1]...[US4]`）
- 每个任务描述都包含明确文件路径

## Phase 1: Setup（共享准备）

**Purpose**: 建立 032 所需的内部对象化实现与测试骨架

- [x] T001 创建 group 内部对象化实现骨架 `src/managers/group/internal/internal-group.ts`、`src/managers/group/internal/group-repository.ts`、`src/managers/group/internal/group-event-sync.ts`、`src/managers/group/internal/group-snapshot-mapper.ts`
- [x] T002 [P] 创建 032 单元测试骨架 `tests/unit/group/internal-group.test.ts`、`tests/unit/group/group-repository.test.ts`、`tests/unit/group/group-event-sync.test.ts`、`tests/unit/group/group-snapshot-mapper.test.ts`
- [x] T003 [P] 预留 032 集成与契约验证位点 `tests/integration/group-manager/group-manager.integration.test.ts`、`tests/integration/group-manager/group-events.integration.test.ts`、`tests/contract/group-manager.contract.test.ts`、`tests/types/group-manager-types.test.ts`

---

## Phase 2: Foundational（阻塞基础）

**Purpose**: 建立所有用户故事共享的内部真相、唯一访问入口和公开边界约束

**⚠️ CRITICAL**: 此阶段完成前不得进入任何用户故事实现

- [x] T004 在 `src/managers/group/internal/internal-group.ts` 定义 `InternalGroup` 的基础字段、状态迁移和失效语义
- [x] T005 [P] 在 `src/managers/group/internal/group-repository.ts` 定义 `GroupRepository` 的 identity map、获取/创建、合并、失效和清理接口
- [x] T006 [P] 在 `src/managers/group/internal/group-snapshot-mapper.ts` 定义 `GroupSummary` / `GroupDetail` / 事件群对象快照导出边界，并确保输出为独立快照
- [x] T007 [P] 在 `src/managers/group/internal/group-event-sync.ts` 定义事件 patch、标记 stale 和受控详情补拉的基础协作接口
- [x] T008 在 `src/managers/group-manager.ts`、`src/managers/group/group.ts` 建立 repository 注入 / 获取通道，替代仅依赖 `groupRegistry` 的旧结构
- [x] T009 [P] 在 `tests/unit/group/internal-group.test.ts`、`tests/unit/group/group-repository.test.ts`、`tests/types/group-manager-types.test.ts` 增加基础边界测试：内部对象不外泄、同一 `groupId` 唯一运行时真相、公开 `Group` 类型不变

**Checkpoint**: 032 的内部对象化基础设施就绪，用户故事可以围绕同一运行时真相推进

---

## Phase 3: User Story 1 - 对外调用方式保持稳定，但内部状态模型完成收敛（Priority: P1） 🎯 MVP

**Goal**: 在不改变 027 既有公开 API 形态的前提下，把 `GroupManager` 和 `Group` 主路径切换到 repository + internal runtime 驱动

**Independent Test**: 保持 `getJoinedGroupList()`、`getGroup(groupId)`、`group.getDetail()`、`group.getMembers()` 与现有事件监听方式不变，并验证公开返回仍是 plain data / public handle

### Tests for User Story 1

- [x] T010 [P] [US1] 在 `tests/unit/managers/group-manager.test.ts`、`tests/unit/managers/group.test.ts` 增加“公开 `Group` handle 保持不变、manager 主路径不回归”的单测
- [x] T011 [P] [US1] 在 `tests/integration/group-manager/group-manager.integration.test.ts` 增加列表、详情、`getGroup(groupId)` 主路径兼容集成用例
- [x] T012 [P] [US1] 在 `tests/contract/group-manager.contract.test.ts` 增加 032 的公开行为契约回归：列表仍为 plain data、`getGroup(groupId)` 仍返回 `Group`
- [x] T013 [US1] 在 `specs/032-group-internal-oo-pilot/tasks.md` 记录 US1 不新增 group 专项 E2E 的依据（当前公开主路径未新增浏览器群组交互，核心风险由单元+集成+契约覆盖）

### Implementation for User Story 1

- [x] T014 [US1] 在 `src/managers/group-manager.ts` 将 `getGroup`、`getPublicGroupList`、`getJoinedGroupList`、`getGroupInfo`、`getGroupInfoList` 接到 `GroupRepository`，由 repository 维护内部真相
- [x] T015 [P] [US1] 在 `src/managers/group/group.ts` 将 `getDetail()`、`refresh()`、`getMembers()` 等公开句柄读取路径改为通过 repository 访问内部真相，而不再直接依赖 manager 中的零散状态
- [x] T016 [P] [US1] 在 `src/managers/group/internal/group-repository.ts`、`src/managers/group/internal/group-snapshot-mapper.ts` 实现列表结果与详情结果写入内部真相后再导出快照的主路径

**Checkpoint**: US1 完成后，032 已在不破坏公开 API 的前提下，把 group 读取主路径收敛到 internal runtime + repository 模式

---

## Phase 4: User Story 2 - 群列表、详情与事件围绕同一运行时真相协作（Priority: P1）

**Goal**: 让同一 `groupId` 的列表读取、详情读取、handle 调用和生命周期切换围绕同一运行时真相协作，并解决快照污染与跨会话残留

**Independent Test**: 模拟同一 `groupId` 先后经历列表读取、详情读取、再次读取和会话切换，验证内部状态收敛正确、快照隔离成立、旧会话状态不会泄漏

### Tests for User Story 2

- [x] T017 [P] [US2] 在 `tests/unit/group/internal-group.test.ts`、`tests/unit/group/group-repository.test.ts` 增加 summary/detail 合并、stale 状态迁移、identity map 复用和会话清理用例
- [x] T018 [P] [US2] 在 `tests/unit/group/group-snapshot-mapper.test.ts` 增加快照隔离测试，验证外部 DTO 修改不会污染内部真相
- [x] T019 [P] [US2] 在 `tests/integration/group-manager/group-manager.integration.test.ts` 增加同一 `groupId` 跨列表/详情/handle 路径共享内部真相与跨会话清理集成用例
- [x] T020 [US2] 在 `specs/032-group-internal-oo-pilot/tasks.md` 记录 US2 不新增 group 专项 E2E 的依据（核心风险在状态合并、会话隔离和 DTO 边界，不在浏览器交互层）

### Implementation for User Story 2

- [x] T021 [US2] 在 `src/managers/group/internal/internal-group.ts`、`src/managers/group/internal/group-repository.ts` 实现 `summaryKnown/detailKnown/stale` 等运行时状态与合并逻辑
- [x] T022 [P] [US2] 在 `src/managers/group/internal/group-snapshot-mapper.ts`、`src/managers/group-manager.ts`、`src/managers/group/group.ts` 实现公开快照的克隆/隔离导出
- [x] T023 [P] [US2] 在 `src/managers/group-manager.ts`、`src/chat-client.ts` 明确 repository 的 bind/重建/会话切换清理边界，避免跨会话污染

**Checkpoint**: US2 完成后，group 域已经具备单一运行时真相、快照隔离和基础生命周期清理能力

---

## Phase 5: User Story 3 - 事件链路先更新内部状态，再对外导出标准化 payload（Priority: P1）

**Goal**: 让 `onSpecificationChanged`、`onStateChanged` 及其他关键群事件在对外派发前，先完成内部真相 patch、失效标记和必要的受控补偿

**Independent Test**: 喂入关键群事件 fixture，验证内部真相先更新，再导出标准化 payload，且后续主动查询结果与事件看到的结果一致

### Tests for User Story 3

- [x] T024 [P] [US3] 在 `tests/unit/group/group-event-sync.test.ts`、`tests/unit/group/group-event-mapper.test.ts` 增加事件 patch、mark stale、reload 决策和完整 payload 导出单测
- [x] T025 [P] [US3] 在 `tests/unit/group/group-event-user-info-resolver.test.ts` 增加事件与主动查询共享用户资料补齐规则、补齐失败最小回退的单测
- [x] T026 [P] [US3] 在 `tests/integration/group-manager/group-events.integration.test.ts` 增加 `onSpecificationChanged` / `onStateChanged` / 成员类事件的“先更新内部再派发”集成用例
- [x] T027 [US3] 在 `specs/032-group-internal-oo-pilot/tasks.md` 记录 US3 不新增 group 事件 E2E 的依据（当前无浏览器群事件主路径，风险集中在 EventHub/patch/reload 协作）

### Implementation for User Story 3

- [x] T028 [US3] 在 `src/managers/group/internal/group-event-sync.ts` 实现原始群事件到内部 patch、stale 标记和受控详情补拉的收敛逻辑
- [x] T029 [P] [US3] 在 `src/managers/group-manager.ts`、`src/core/message/message-receiver.ts` 将群事件派发链路切到 repository + event sync + snapshot mapper 流程
- [x] T030 [P] [US3] 在 `src/managers/group/group-event-user-info-resolver.ts`、`src/managers/group/internal/group-event-sync.ts` 收敛事件与主动查询共享的用户资料补齐调用时机

**Checkpoint**: US3 完成后，032 已建立“事件先更新内部真相，再对外导出 payload”的核心规则

---

## Phase 6: User Story 4 - 为后续 chatroom/contact/user-info 迁移提供稳定模板（Priority: P2）

**Goal**: 把 group 试点中验证过的内部对象边界、可复用模式和不应复用的领域特例沉淀清楚，供后续模块 spec/plan 直接引用

**Independent Test**: 维护者可以从 032 的文档、代码边界和测试中明确识别哪些模式可复用、哪些仍是 group 领域特有

### Tests for User Story 4

- [x] T031 [P] [US4] 在 `tests/unit/group/group-repository.test.ts`、`tests/types/group-manager-types.test.ts` 增加公开/内部边界回归，锁定 `Group` handle 与 `InternalGroup` 非同一概念
- [x] T032 [US4] 在 `specs/032-group-internal-oo-pilot/tasks.md` 记录 US4 不新增 E2E 的依据（该故事是维护者架构模板沉淀，不对应新的浏览器用户路径）

### Implementation for User Story 4

- [x] T033 [US4] 在 `specs/032-group-internal-oo-pilot/contracts/group-internal-oo-pilot.md`、`specs/032-group-internal-oo-pilot/data-model.md`、`specs/032-group-internal-oo-pilot/quickstart.md` 补充可复用边界和 follow-up 模板说明
- [x] T034 [P] [US4] 在 `src/managers/group/internal/internal-group.ts`、`src/managers/group/internal/group-repository.ts`、`src/managers/group/internal/group-event-sync.ts` 添加简洁职责注释，明确哪些是 group 试点模式、哪些是 group 特有规则
- [x] T035 [P] [US4] 在 `plans/active/plan-sdk-internal-oo-architecture-2026-04-22.md` 回填 032 试点落地约束与后续 chatroom/contact/user-info 的承接位点

**Checkpoint**: US4 完成后，group 试点不只是“代码可跑”，还形成了后续模块可直接引用的模板和边界说明

---

## Phase 7: Polish & Cross-Cutting

**Purpose**: 收尾验证、记录结果、版本治理与提交

- [x] T036 [P] 同步 032 设计文档与实现现实到 `specs/032-group-internal-oo-pilot/research.md`、`specs/032-group-internal-oo-pilot/data-model.md`、`specs/032-group-internal-oo-pilot/contracts/group-internal-oo-pilot.md`、`specs/032-group-internal-oo-pilot/quickstart.md`
- [x] T037 执行聚焦 032 的验证并记录结果到 `specs/032-group-internal-oo-pilot/quickstart.md`（至少包含 `tests/unit/group/`、`tests/integration/group-manager/`、`tests/types/group-manager-types.test.ts`）
- [x] T038 执行 `npm run lint`、`npm run type-check`、`npm run test:gate:pr` 并把 032 相关结果记录到 `specs/032-group-internal-oo-pilot/quickstart.md`
- [x] T039 更新版本与变更记录 `package.json`、`package-lock.json`、`CHANGELOG.md`
- [x] T040 基于 `specs/032-group-internal-oo-pilot/`、`src/`、`tests/` 提交 032 实现变更（不 push）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 可立即开始
- **Phase 2 (Foundational)**: 依赖 Phase 1 完成，且阻塞所有用户故事
- **Phase 3-6 (User Stories)**: 依赖 Phase 2 完成；建议按 P1 → P2 推进，也可在团队允许时部分并行
- **Phase 7 (Polish)**: 依赖已选用户故事完成

### User Story Dependencies

- **US1 (P1)**: Phase 2 后即可开始，是 032 的 MVP
- **US2 (P1)**: 依赖 US1 已把主读取路径接到 repository，但可与 US3 并行
- **US3 (P1)**: 依赖 Phase 2 的内部对象和 repository 基础，可与 US2 并行推进
- **US4 (P2)**: 建议在 US1-US3 基本稳定后执行，用于沉淀可复用模板和边界

### Within Each User Story

- 先补故事级测试并确认当前实现尚未满足新约束
- 再实现内部对象、repository、mapper、event sync 或文档沉淀
- 最后完成故事级独立验证和“不新增 E2E”依据记录

### Parallel Opportunities

- Phase 1 中 `T002`、`T003` 可并行
- Phase 2 中 `T005`、`T006`、`T007`、`T009` 可在 `T004` 完成后并行
- US1 中 `T010`、`T011`、`T012` 可并行
- US2 中 `T017`、`T018`、`T019` 可并行
- US3 中 `T024`、`T025`、`T026` 可并行
- US4 中 `T033`、`T034`、`T035` 可并行

---

## Parallel Example: User Story 1

```bash
Task: "T010 tests/unit/managers/group-manager.test.ts and tests/unit/managers/group.test.ts"
Task: "T011 tests/integration/group-manager/group-manager.integration.test.ts"
Task: "T012 tests/contract/group-manager.contract.test.ts"
```

## Parallel Example: User Story 2

```bash
Task: "T017 tests/unit/group/internal-group.test.ts and tests/unit/group/group-repository.test.ts"
Task: "T018 tests/unit/group/group-snapshot-mapper.test.ts"
Task: "T019 tests/integration/group-manager/group-manager.integration.test.ts"
```

## Parallel Example: User Story 3

```bash
Task: "T024 tests/unit/group/group-event-sync.test.ts and tests/unit/group/group-event-mapper.test.ts"
Task: "T025 tests/unit/group/group-event-user-info-resolver.test.ts"
Task: "T026 tests/integration/group-manager/group-events.integration.test.ts"
```

---

## Implementation Strategy

### MVP First（建议）

1. 完成 Phase 1-2，建立 internal runtime、repository、snapshot mapper 和 event sync 骨架
2. 交付 US1，把公开读取主路径稳定切到 repository 驱动
3. **停止并验证**：确认公开 API 不变、列表仍为 plain data、`Group` 仍为 public handle
4. 再推进 US2 和 US3 收紧状态一致性与事件链路

### Incremental Delivery

1. Setup + Foundational 打底
2. 交付 US1（公开 API 不变 + internal runtime 接入）
3. 交付 US2（单一运行时真相、快照隔离、会话清理）
4. 交付 US3（事件先更新内部再派发）
5. 交付 US4（沉淀后续模块模板）
6. 最后收尾验证、版本治理和提交

### Parallel Team Strategy

1. 一人先完成 Phase 1-2
2. Foundation 完成后：
   - 开发者 A：US1 主读取路径和 public handle
   - 开发者 B：US2 repository 状态收敛、快照隔离和生命周期清理
   - 开发者 C：US3 event sync、用户补齐协作和事件一致性
3. US1-US3 稳定后，再由维护者收口 US4 文档模板与 follow-up 边界

---

## Notes

- `[P]` 任务表示不同文件、可并行推进
- 032 是内部重构试点，不应破坏 027 已交付的公开契约
- 本期 E2E 通过显式记录“不新增 / 复用依据”满足 spec 的测试分层要求
- 实现完成后必须先验证，再更新版本号、`CHANGELOG.md`，最后提交中文 commit

## E2E 说明

- US1 不新增 group 专项 E2E：当前公开主路径未新增浏览器群组交互，核心风险由单元 + 集成 + contract 覆盖
- US2 不新增 group 专项 E2E：核心风险在状态合并、会话隔离和 DTO 边界，不在浏览器交互层
- US3 不新增 group 事件 E2E：当前无浏览器群事件主路径，风险集中在 EventHub / patch / reload 协作
- US4 不新增 E2E：该故事用于沉淀维护者模板，不对应新的浏览器用户路径

## 当前阻塞

- T038 已关闭：`npm run lint`、`npm run type-check`、`npm run test:gate:pr` 均已通过；其中 PR gate 在本地需要放开 sandbox 端口监听权限以启动 mock server，详见 `quickstart.md`
