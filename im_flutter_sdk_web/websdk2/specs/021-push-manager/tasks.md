---
description: '021 PushManager 实现任务清单'
---

# Tasks: PushManager 推送与免打扰管理

**Input**: 设计文档来自 `/specs/021-push-manager/`  
**Prerequisites**: plan.md（必需）、spec.md（必需）、research.md、data-model.md、contracts/、quickstart.md  
**Tests**: 需要，包含单元测试、契约测试与类型回归测试  
**Organization**: 任务按用户故事分组，支持独立实现与独立验证

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行（不同文件、无前置依赖）
- **[Story]**: 仅用户故事阶段使用（`[US1]...[US3]`）
- 每个任务描述都包含明确文件路径

## Phase 1: Setup（共享准备）

**Purpose**: 建立 021 所需的 manager、类型与测试骨架

- [x] T001 创建 PushManager 目录与导出骨架 `src/managers/push/index.ts`
- [x] T002 创建 PushManager 主文件骨架 `src/managers/push-manager.ts`
- [x] T003 [P] 创建 push 领域类型骨架 `src/types/push.ts`
- [x] T004 [P] 创建 PushManager 单元测试骨架 `tests/unit/managers/push-manager.test.ts`
- [x] T005 [P] 创建 PushManager 契约测试骨架 `tests/contract/push-manager.contract.test.ts`
- [x] T006 [P] 创建 PushManager 类型测试骨架 `tests/types/push-manager-types.test.ts`

---

## Phase 2: Foundational（阻塞基础）

**Purpose**: 完成所有用户故事共享的类型、错误、挂载与公共校验能力

**⚠️ CRITICAL**: 此阶段完成前不得进入任何用户故事实现

- [x] T007 在 `src/types/push.ts` 定义 PushToken/SilentMode/Language/Pagination 公共接口与联合类型
- [x] T008 [P] 在 `src/types/index.ts` 导出 PushManager 相关公共类型
- [x] T009 [P] 在 `src/index.ts` 导出 `PushManager` 与 push 类型
- [x] T010 在 `src/chat-client.ts` 补充 PushManager 注册与挂载支持（与现有 manager 机制一致）
- [x] T011 [P] 在 `src/rest/api-errors.json` 增加 Push 业务错误映射（1500-1502 区间）
- [x] T012 [P] 在 `src/utils/error-codes.ts` 增加 PushManager 所需错误码常量映射
- [x] T013 在 `src/managers/push-manager.ts` 实现共享的 REST 客户端获取、统一错误转换与回调封装
- [x] T014 在 `src/managers/push-manager.ts` 实现共享参数校验工具（含 `details.fields` 结构）
- [x] T015 [P] 在 `tests/unit/managers/push-manager.test.ts` 增加基础校验与错误契约测试
- [x] T016 [P] 在 `tests/types/push-manager-types.test.ts` 增加强类型约束测试（无 `any`、联合类型可判别）

**Checkpoint**: PushManager 共享基础能力就绪，用户故事可并行推进

---

## Phase 3: User Story 1 - 注册推送设备并配置全局免打扰（Priority: P1） 🎯 MVP

**Goal**: 实现 push token 上传与全局免打扰设置/查询三种模式，且满足幂等覆盖与本地时区约束

**Independent Test**: 使用合法登录态完成 token 上传、全局免打扰三模式设置与查询回读；重复 `deviceId` 上传覆盖成功；非法参数 fail-fast 返回 `INVALID_PARAM (110)`

### Tests for User Story 1

- [x] T017 [P] [US1] 在 `tests/contract/push-manager.contract.test.ts` 增加上传 token 与全局免打扰契约用例
- [x] T018 [P] [US1] 在 `tests/unit/managers/push-manager.test.ts` 增加 token 参数校验与错误码断言用例
- [x] T019 [P] [US1] 在 `tests/unit/managers/push-manager.test.ts` 增加 token 重复上传幂等覆盖用例
- [x] T020 [P] [US1] 在 `tests/unit/managers/push-manager.test.ts` 增加全局免打扰三模式设置/查询用例
- [x] T021 [P] [US1] 在 `tests/unit/managers/push-manager.test.ts` 增加时间区间按设备本地时区语义用例

### Implementation for User Story 1

- [x] T022 [US1] 在 `src/managers/push-manager.ts` 实现 `uploadPushToken`（幂等覆盖语义）
- [x] T023 [US1] 在 `src/managers/push-manager.ts` 实现 `setGlobalSilentMode`（REMIND_TYPE/DURATION/INTERVAL）
- [x] T024 [US1] 在 `src/managers/push-manager.ts` 实现 `getGlobalSilentMode`
- [x] T025 [US1] 在 `src/types/push.ts` 细化全局免打扰请求/响应类型并收敛字段命名
- [x] T026 [US1] 在 `src/managers/push-manager.ts` 增加 US1 相关结构化日志（避免敏感字段）

**Checkpoint**: US1 可独立完成“设备注册 + 全局免打扰”闭环

---

## Phase 4: User Story 2 - 管理会话级免打扰并批量查询（Priority: P1）

**Goal**: 实现会话级设置/清除/查询与批量查询，并严格执行会话类型与批量上限约束

**Independent Test**: 单聊与群聊会话可设置并查询规则；清除提醒类型后恢复默认；批量查询返回正确；`chatRoom` 或列表 >20 时返回 `INVALID_PARAM (110)`

### Tests for User Story 2

- [x] T027 [P] [US2] 在 `tests/contract/push-manager.contract.test.ts` 增加会话级免打扰与批量查询契约用例
- [x] T028 [P] [US2] 在 `tests/unit/managers/push-manager.test.ts` 增加会话设置/查询/清除用例
- [x] T029 [P] [US2] 在 `tests/unit/managers/push-manager.test.ts` 增加 `chatRoom` 参数错误用例
- [x] T030 [P] [US2] 在 `tests/unit/managers/push-manager.test.ts` 增加批量查询上限 20 与超限错误用例
- [x] T031 [P] [US2] 在 `tests/types/push-manager-types.test.ts` 增加会话类型仅允许 `singleChat | groupChat` 的类型约束用例

### Implementation for User Story 2

- [x] T032 [US2] 在 `src/managers/push-manager.ts` 实现 `setConversationSilentMode`
- [x] T033 [US2] 在 `src/managers/push-manager.ts` 实现 `getConversationSilentMode`
- [x] T034 [US2] 在 `src/managers/push-manager.ts` 实现 `clearConversationRemindType`
- [x] T035 [US2] 在 `src/managers/push-manager.ts` 实现 `getConversationSilentModes`（批量查询）
- [x] T036 [US2] 在 `src/types/push.ts` 细化会话快照与批量查询响应类型（单聊/群聊映射明确）
- [x] T037 [US2] 在 `src/managers/push-manager.ts` 增加 US2 错误细分（`conversationList`、`type` 字段路径）

**Checkpoint**: US2 可独立完成“会话级规则 + 批量查询”闭环

---

## Phase 5: User Story 3 - 管理推送翻译语言与免打扰会话分页（Priority: P2）

**Goal**: 实现语言设置/查询与按提醒类型分页查询，且保持新 API 边界清晰

**Independent Test**: 语言设置后可回读；分页查询 cursor 翻页正确且无重复漏项；旧 API 名称不作为可用入口

### Tests for User Story 3

- [x] T038 [P] [US3] 在 `tests/contract/push-manager.contract.test.ts` 增加语言与分页查询契约用例
- [x] T039 [P] [US3] 在 `tests/unit/managers/push-manager.test.ts` 增加语言设置/查询用例
- [x] T040 [P] [US3] 在 `tests/unit/managers/push-manager.test.ts` 增加分页 cursor 翻页与空 cursor 用例
- [x] T041 [P] [US3] 在 `tests/types/push-manager-types.test.ts` 增加分页返回类型约束用例
- [x] T042 [P] [US3] 在 `tests/unit/managers/push-manager.test.ts` 增加旧 API 不兼容语义用例（无兼容别名）

### Implementation for User Story 3

- [x] T043 [US3] 在 `src/managers/push-manager.ts` 实现 `setPushLanguage`
- [x] T044 [US3] 在 `src/managers/push-manager.ts` 实现 `getPushLanguage`
- [x] T045 [US3] 在 `src/managers/push-manager.ts` 实现 `getConversationListByRemindType`
- [x] T046 [US3] 在 `src/types/push.ts` 细化语言与分页模型（含 `cursor` 与会话列表项）
- [x] T047 [US3] 在 `src/managers/push-manager.ts` 增加旧 API 不兼容错误语义输出与日志

**Checkpoint**: US3 可独立完成“语言 + 分页查询”能力

---

## Phase 6: Polish & Cross-Cutting

**Purpose**: 跨用户故事收尾、验证与发布

- [x] T048 [P] 对齐 021 文档术语与 API 命名于 `specs/021-push-manager/spec.md`、`specs/021-push-manager/plan.md`、`specs/021-push-manager/tasks.md`
- [x] T049 [P] 回填 quickstart 实测结果与已知风险于 `specs/021-push-manager/quickstart.md`
- [x] T050 执行 021 相关测试并记录命令输出于 `specs/021-push-manager/quickstart.md`
- [x] T051 执行 lint 并修复 021 相关告警于 `src/managers/push-manager.ts`、`src/types/push.ts`、`tests/unit/managers/push-manager.test.ts`
- [x] T052 更新版本与变更记录于 `package.json`、`package-lock.json`、`CHANGELOG.md`
- [x] T053 提交 021 实现变更（不 push）
- [x] T054 [P] 补充 PresenceManager 行为与返回结构回归测试（跨 manager 回归纳入 021）`tests/unit/managers/presence-manager.test.ts`
- [x] T055 [P] 补充 UserInfoManager/REST 错误映射回归测试（跨 manager 回归纳入 021）`tests/unit/managers/user-info-manager.test.ts`、`tests/unit/rest/client-methods.test.ts`、`tests/unit/utils/provision-error-mapping.test.ts`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 可立即开始
- **Phase 2 (Foundational)**: 依赖 Phase 1 完成，且阻塞所有用户故事
- **Phase 3-5 (User Stories)**: 依赖 Phase 2 完成；可并行或按优先级推进
- **Phase 6 (Polish)**: 依赖已选用户故事完成

### User Story Dependencies

- **US1 (P1)**: Phase 2 后可开始，作为 MVP 主路径
- **US2 (P1)**: Phase 2 后可开始，与 US1 共享基础但可独立验证
- **US3 (P2)**: Phase 2 后可开始，建议在 US1/US2 稳定后推进

### Within Each User Story

- 先完成故事级测试任务并验证失败预期
- 再实现 manager 与类型
- 再完善错误细分与日志
- 最后执行故事级独立验证

### Parallel Opportunities

- Phase 1、2 所有标记 `[P]` 的任务可并行
- Phase 2 完成后，US1/US2/US3 可由不同开发者并行推进
- 各 US 的测试任务（标记 `[P]`）可并行执行
- Phase 6 的文档与验证类任务可并行

---

## Parallel Example: User Story 1

```bash
Task: "T017 tests/contract/push-manager.contract.test.ts"
Task: "T018 tests/unit/managers/push-manager.test.ts"
Task: "T019 tests/unit/managers/push-manager.test.ts"
Task: "T020 tests/unit/managers/push-manager.test.ts"
Task: "T021 tests/unit/managers/push-manager.test.ts"
```

## Parallel Example: User Story 2

```bash
Task: "T027 tests/contract/push-manager.contract.test.ts"
Task: "T028 tests/unit/managers/push-manager.test.ts"
Task: "T029 tests/unit/managers/push-manager.test.ts"
Task: "T030 tests/unit/managers/push-manager.test.ts"
Task: "T031 tests/types/push-manager-types.test.ts"
```

## Parallel Example: User Story 3

```bash
Task: "T038 tests/contract/push-manager.contract.test.ts"
Task: "T039 tests/unit/managers/push-manager.test.ts"
Task: "T040 tests/unit/managers/push-manager.test.ts"
Task: "T041 tests/types/push-manager-types.test.ts"
Task: "T042 tests/unit/managers/push-manager.test.ts"
```

---

## Implementation Strategy

### MVP First（仅 US1）

1. 完成 Phase 1 + Phase 2
2. 完成 US1（token 上传 + 全局免打扰）
3. **STOP and VALIDATE**：仅验证 US1 独立通过
4. 通过后再推进会话级与分页能力

### Incremental Delivery

1. Setup + Foundational 打底
2. 交付 US1（核心推送配置能力）
3. 交付 US2（会话级策略与批量查询）
4. 交付 US3（语言与分页管理）
5. 收尾发布（Phase 6）

### Parallel Team Strategy

- 开发 A：US1（token 上传、全局免打扰）
- 开发 B：US2（会话级规则、批量查询）
- 开发 C：US3（语言设置、分页查询）

---

## Notes

- 所有任务均遵循 `- [x] Txxx [P] [USx] 描述+路径` 规范
- 用户故事阶段均带 `[USx]` 标签，便于追踪与独立验收
- 每个用户故事可独立实现、独立测试、独立演示
- 每轮实现完成后按规则更新版本号、CHANGELOG 并提交 commit
