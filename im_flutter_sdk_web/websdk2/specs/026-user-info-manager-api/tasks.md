---
description: '026 UserInfoManager API 实现任务清单'
---

# Tasks: UserInfoManager API 补齐与语义收敛

**Input**: 设计文档来自 `/specs/026-user-info-manager-api/`  
**Prerequisites**: plan.md（必需）、spec.md（必需）、research.md、data-model.md、contracts/、quickstart.md  
**Tests**: 需要，包含单元测试、集成测试、契约测试与类型/JSDoc 回归；E2E 若本期无 demo 用户资料入口，则必须显式记录不新增依据  
**Organization**: 任务按用户故事分组，支持独立实现与独立验证

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行（不同文件、无前置依赖）
- **[Story]**: 仅用户故事阶段使用（`[US1]...[US3]`）
- 每个任务描述都包含明确文件路径

## Phase 1: Setup（共享准备）

**Purpose**: 建立 026 所需的类型、REST、文档与测试骨架

- [x] T001 创建用户资料 REST 适配骨架 `src/rest/user-info.ts`
- [x] T002 创建 UserInfoManager 查询测试骨架 `tests/unit/managers/user-info-manager-fetch.test.ts`
- [x] T003 [P] 创建 UserInfoManager 更新测试骨架 `tests/unit/managers/user-info-manager-update.test.ts`
- [x] T004 [P] 创建 UserInfoManager 集成测试骨架 `tests/integration/user-info-manager/user-info-manager.integration.test.ts`
- [x] T005 [P] 创建 UserInfoManager 契约测试骨架 `tests/contract/user-info-manager.contract.test.ts`
- [x] T006 [P] 创建 UserInfoManager 类型回归测试骨架 `tests/types/user-info-manager-types.test.ts`
- [x] T007 [P] 创建用户资料 API 对照文档骨架 `docs/reference/user-info-manager-api.md`

---

## Phase 2: Foundational（阻塞基础）

**Purpose**: 完成所有用户故事共享的类型、归一化、缓存桥接、导出与迁移基础

**⚠️ CRITICAL**: 此阶段完成前不得进入任何用户故事实现

- [x] T008 在 `src/types/user-info.ts` 定义 `UserInfo`、`UserInfoAttribute`、查询/更新参数与 envelope 内部类型
- [x] T009 [P] 在 `src/index.ts` 更新 UserInfoManager 公开类型导出并移除旧查询名/旧更新名的主导出
- [x] T010 [P] 在 `src/rest/user-info.ts` 实现共享的 `attribute` 映射、`userIds` 去重与请求体构造工具
- [x] T011 在 `src/managers/user-info-manager.ts` 实现共享的 REST 客户端获取、统一错误转换与日志辅助方法
- [x] T012 [P] 在 `src/managers/user-info-manager.ts` 增加查询/更新 envelope 归一化 helper，基于真实 `{ timestamp, data, lastModified, duration }` 结构解析
- [x] T013 [P] 在 `src/managers/user-info-manager.ts`、`src/cache/cache-types.ts` 实现 `UserInfo -> UserInfoSummary` 缓存桥接 helper
- [x] T014 [P] 在 `tests/types/user-info-manager-types.test.ts` 增加新 API 类型签名、旧名移除与 `client.userInfoManager` 访问方式的基础回归
- [x] T015 [P] 在 `docs/reference/api.md` 预留 026 示例替换位点并标记旧 UserInfoManager 示例待移除区域

**Checkpoint**: 026 共享基础能力就绪，用户故事可并行推进

---

## Phase 3: User Story 1 - 按移动端语义查询用户资料，并获得完整字段投影（Priority: P1） 🎯 MVP

**Goal**: 实现 `fetchUserInfoByUserId` 与 `fetchUserInfoByAttribute`，基于真实查询响应 envelope 归一化为 `UserInfo[]`

**Independent Test**: 在已登录场景下独立调用两个查询 API，验证请求体、属性映射、部分未命中、真实 envelope 解析与缓存写回

### Tests for User Story 1

- [x] T016 [P] [US1] 在 `tests/unit/managers/user-info-manager-fetch.test.ts` 增加 `userIds` 校验、去重与顺序保持用例
- [x] T017 [P] [US1] 在 `tests/unit/managers/user-info-manager-fetch.test.ts` 增加 `attributes` 驼峰字段校验、空属性数组错误与 `avatarUrl -> avatarurl` 映射用例
- [x] T018 [P] [US1] 在 `tests/unit/managers/user-info-manager-fetch.test.ts` 增加真实查询响应 `{ timestamp, data, lastModified, duration }` 的归一化用例
- [x] T019 [P] [US1] 在 `tests/integration/user-info-manager/user-info-manager.integration.test.ts` 增加 `fetchUserInfoByUserId` / `fetchUserInfoByAttribute` 的请求组装与缓存写回集成用例
- [x] T020 [P] [US1] 在 `tests/contract/user-info-manager.contract.test.ts` 增加查询 envelope 与 `contracts/user-info-manager.openapi.yaml` 的契约用例
- [x] T021 [P] [US1] 在 `tests/types/user-info-manager-types.test.ts` 增加两个查询 API 的参数与返回类型回归
- [x] T022 [US1] [US1] 在 `specs/026-user-info-manager-api/tasks.md` 记录本期不新增查询 demo E2E 的依据（当前无用户资料 demo 入口，先由单元+集成+契约测试覆盖）

### Implementation for User Story 1

- [x] T023 [US1] 在 `src/rest/user-info.ts` 实现查询请求适配，支持默认字段查询与显式属性查询的请求体构造
- [x] T024 [US1] 在 `src/managers/user-info-manager.ts` 实现 `fetchUserInfoByUserId`
- [x] T025 [US1] 在 `src/managers/user-info-manager.ts` 实现 `fetchUserInfoByAttribute`
- [x] T026 [US1] 在 `src/managers/user-info-manager.ts` 接入真实查询 envelope 归一化与 `lastModified` 内部映射处理
- [x] T027 [US1] 在 `src/managers/user-info-manager.ts` 接入查询成功后的缓存桥接写回
- [x] T028 [US1] 在 `src/types/user-info.ts`、`src/managers/user-info-manager.ts` 补齐两个查询 API 的双语 JSDoc

**Checkpoint**: US1 可独立完成“移动端语义查询 + 真实响应归一化 + 完整字段投影”闭环

---

## Phase 4: User Story 2 - 按移动端语义更新当前用户资料，并获得一致的更新结果（Priority: P1）

**Goal**: 实现 `updateOwnInfo` 与 `updateOwnInfoByAttribute`，基于真实更新响应 envelope 归一化为统一的 `UserInfo`

**Independent Test**: 在已登录场景下独立调用两个更新 API，验证表单请求体、`''`/`false`/`0` 处理、真实响应解析、返回一致性与缓存写回

### Tests for User Story 2

- [x] T029 [P] [US2] 在 `tests/unit/managers/user-info-manager-update.test.ts` 增加 `updateOwnInfo` 至少一个字段必填、空字符串清空与 `false/0` 保留用例
- [x] T030 [P] [US2] 在 `tests/unit/managers/user-info-manager-update.test.ts` 增加 `updateOwnInfoByAttribute` 的属性校验、缺失值错误与返回一致性用例
- [x] T031 [P] [US2] 在 `tests/unit/managers/user-info-manager-update.test.ts` 增加真实更新响应 `{ timestamp, data, lastModified, duration }` 的归一化用例
- [x] T032 [P] [US2] 在 `tests/integration/user-info-manager/user-info-manager.integration.test.ts` 增加两个更新 API 的表单请求体与缓存写回集成用例
- [x] T033 [P] [US2] 在 `tests/contract/user-info-manager.contract.test.ts` 增加更新 envelope 与 `contracts/user-info-manager.openapi.yaml` 的契约用例
- [x] T034 [P] [US2] 在 `tests/types/user-info-manager-types.test.ts` 增加两个更新 API 的参数与返回类型回归
- [x] T035 [US2] [US2] 在 `specs/026-user-info-manager-api/tasks.md` 记录本期不新增更新 demo E2E 的依据（当前无用户资料 demo 入口，先由单元+集成+契约测试覆盖）

### Implementation for User Story 2

- [x] T036 [US2] 在 `src/rest/user-info.ts` 实现 `application/x-www-form-urlencoded` 的更新请求构造与属性映射
- [x] T037 [US2] 在 `src/managers/user-info-manager.ts` 实现 `updateOwnInfo`
- [x] T038 [US2] 在 `src/managers/user-info-manager.ts` 实现 `updateOwnInfoByAttribute`
- [x] T039 [US2] 在 `src/managers/user-info-manager.ts` 接入真实更新 envelope 归一化，并保证返回与 `updateOwnInfoByAttribute` 一致
- [x] T040 [US2] 在 `src/managers/user-info-manager.ts` 接入更新成功后的缓存桥接写回
- [x] T041 [US2] 在 `src/types/user-info.ts`、`src/managers/user-info-manager.ts` 补齐两个更新 API 的双语 JSDoc

**Checkpoint**: US2 可独立完成“移动端语义更新 + 真实响应归一化 + 统一返回结构”闭环

---

## Phase 5: User Story 3 - UserInfoManager 的公开使用方式与 009 Manager 规范保持一致（Priority: P2）

**Goal**: 修正文档、示例、导出与迁移说明，使 UserInfoManager 的注册/访问方式及新旧 API 切换都符合 009 规范

**Independent Test**: 通过 `client.use(UserInfoManager)`、`ChatClient.init({ managers: [UserInfoManager] })`、公开文档与类型导出回归，独立验证 009 对齐与旧名移除

### Tests for User Story 3

- [x] T042 [P] [US3] 在 `tests/types/user-info-manager-types.test.ts` 增加 `client.use(UserInfoManager)` 与 `client.userInfoManager` 的 009 访问方式回归
- [x] T043 [P] [US3] 在 `tests/integration/mock/manager-public-api.test.ts` 替换旧 UserInfoManager 调用为新 API 并验证公开入口可用性
- [x] T044 [P] [US3] 在 `tests/unit/managers/user-info-manager-fetch.test.ts` 或 `tests/unit/managers/user-info-manager-update.test.ts` 增加旧名不可作为公开主入口的编译/导出回归依据
- [x] T045 [US3] [US3] 在 `specs/026-user-info-manager-api/tasks.md` 记录本期不新增 009 接入 E2E 的依据（无 demo 管理器注册页面，类型+集成测试足以兜底）

### Implementation for User Story 3

- [x] T046 [US3] 在 `src/index.ts`、`src/managers/user-info/index.ts`、`src/types/user-info.ts` 移除旧查询名与旧更新名的公开主导出
- [x] T047 [US3] 在 `docs/reference/api.md` 修正 `client.use(UserInfoManager)` 的示例和全部 UserInfoManager 方法名
- [x] T048 [US3] 在 `docs/reference/RESTful-API-Body-Formats.md` 同步更新 UserInfoManager 的请求体说明
- [x] T049 [US3] 在 `docs/reference/user-info-manager-api.md` 新增 REST 与 SDK 返回对照文档，结构对齐 `docs/reference/contact-manager-api.md`
- [x] T050 [US3] 在 `CHANGELOG.md`、必要文档注释与迁移说明中记录旧名移除和新 API 映射关系

**Checkpoint**: US3 可独立完成“009 接入方式对齐 + 旧名移除 + 对照文档齐备”闭环

---

## Phase 6: Polish & Cross-Cutting

**Purpose**: 跨用户故事收尾、验证与发布

- [x] T051 [P] 对齐 026 文档术语、测试层说明与 E2E 不新增依据于 `specs/026-user-info-manager-api/spec.md`、`specs/026-user-info-manager-api/plan.md`、`specs/026-user-info-manager-api/tasks.md`
- [x] T052 [P] 回填 `specs/026-user-info-manager-api/quickstart.md` 的实测结果、已知限制与 fixture 使用说明
- [x] T053 执行 `npm run test:run -- tests/unit/managers/user-info-manager-fetch.test.ts tests/unit/managers/user-info-manager-update.test.ts tests/integration/user-info-manager/user-info-manager.integration.test.ts tests/integration/mock/manager-public-api.test.ts tests/contract/user-info-manager.contract.test.ts tests/types/user-info-manager-types.test.ts` 并记录输出到 `specs/026-user-info-manager-api/quickstart.md`
- [x] T054 执行 `npm run lint`、`npm run type-check`、`npm run docs:api:check`、`npm run test:gate:pr` 并记录 026 相关结果到 `specs/026-user-info-manager-api/quickstart.md`
- [x] T055 更新版本与变更记录于 `package.json`、`package-lock.json`、`CHANGELOG.md`
- [x] T056 基于 `specs/026-user-info-manager-api/`、`src/`、`tests/`、`docs/` 提交 026 实现变更（不 push）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 可立即开始
- **Phase 2 (Foundational)**: 依赖 Phase 1 完成，且阻塞所有用户故事
- **Phase 3-5 (User Stories)**: 依赖 Phase 2 完成；可并行或按优先级推进
- **Phase 6 (Polish)**: 依赖已选用户故事完成

### User Story Dependencies

- **US1 (P1)**: Phase 2 后可开始，作为 MVP 主路径
- **US2 (P1)**: Phase 2 后可开始；与 US1 共享基础归一化与缓存桥接，但可独立验证
- **US3 (P2)**: Phase 2 后可开始；依赖新 API 名称与 009 接入方式基础，但文档/导出收敛可以相对独立推进

### Within Each User Story

- 先完成故事级测试任务并验证失败预期
- 再实现 REST 适配、归一化与 manager 公开方法
- 再接入缓存桥接与文档/JSDoc
- 最后执行故事级独立验证

### Parallel Opportunities

- Phase 1、2 所有标记 `[P]` 的任务可并行
- Phase 2 完成后，US1/US2/US3 的测试任务可并行推进
- US1 的查询请求适配与归一化测试可并行
- US2 的更新请求适配与更新返回归一化测试可并行
- US3 的文档对照和类型/集成回归可并行

---

## Parallel Example: User Story 1

```bash
Task: "T016 tests/unit/managers/user-info-manager-fetch.test.ts"
Task: "T017 tests/unit/managers/user-info-manager-fetch.test.ts"
Task: "T018 tests/unit/managers/user-info-manager-fetch.test.ts"
Task: "T020 tests/contract/user-info-manager.contract.test.ts"
```

## Parallel Example: User Story 2

```bash
Task: "T029 tests/unit/managers/user-info-manager-update.test.ts"
Task: "T030 tests/unit/managers/user-info-manager-update.test.ts"
Task: "T031 tests/unit/managers/user-info-manager-update.test.ts"
Task: "T033 tests/contract/user-info-manager.contract.test.ts"
```

## Parallel Example: User Story 3

```bash
Task: "T042 tests/types/user-info-manager-types.test.ts"
Task: "T043 tests/integration/mock/manager-public-api.test.ts"
Task: "T048 docs/reference/RESTful-API-Body-Formats.md"
Task: "T049 docs/reference/user-info-manager-api.md"
```

---

## Implementation Strategy

### MVP First（仅 US1）

1. 完成 Phase 1 + Phase 2
2. 完成 US1（查询 API、真实响应归一化、缓存桥接）
3. **STOP and VALIDATE**：仅验证 US1 独立通过
4. 通过后再推进更新与文档收敛

### Incremental Delivery

1. Setup + Foundational 打底
2. 交付 US1（查询 API 完整字段投影）
3. 交付 US2（更新 API 与统一返回结构）
4. 交付 US3（009 接入方式对齐、旧名移除、文档与迁移说明）
5. 收尾发布（Phase 6）

### Parallel Team Strategy

- 开发 A：US1（查询适配、查询归一化、查询测试）
- 开发 B：US2（更新适配、更新归一化、更新测试）
- 开发 C：US3（导出收敛、文档、迁移说明、类型/集成回归）

---

## Notes

- 所有任务均遵循 `- [ ] Txxx [P] [USx] 描述+路径` 规范
- 用户故事阶段均带 `[USx]` 标签，便于追踪与独立验收
- 本期 E2E 通过显式记录“不新增”依据满足 spec 的测试分层要求
- 当前脚手架 active feature 仍指向 `001-im-sdk-refactor`，执行 Speckit 脚本时需显式以 `specs/026-user-info-manager-api/` 为准
- 每轮实现完成后按规则更新版本号、CHANGELOG 并提交 commit
