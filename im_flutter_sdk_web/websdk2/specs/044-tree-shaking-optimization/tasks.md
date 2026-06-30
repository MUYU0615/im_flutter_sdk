# Tasks: ChatClient Tree-Shaking 优化

**Input**: Design documents from `/specs/044-tree-shaking-optimization/`
**Prerequisites**: `plan.md`、`spec.md`、`research.md`、`data-model.md`、`contracts/manager-boundary-contract.md`、`quickstart.md`

**Tests**: 本功能按 spec 要求必须包含 unit、integration、bundle/import-graph gate、E2E 或等价构建验证；若某层复用现有覆盖，必须在任务中明确记录依据。

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 建立当前依赖泄漏基线和实现入口，避免后续重构只凭体感判断 tree-shaking。

- [X] T001 [P] Audit current `ChatClient` runtime imports and hard references in `src/chat-client.ts`
- [X] T002 [P] Audit current manager subpath exports and package entrypoints in `src/index.ts`, `src/managers/*/index.ts`, `package.json`, and `vite.config.ts`
- [X] T003 [P] Audit current raw notify dispatch flow in `src/core/message/message-receiver.ts`, `src/core/index.ts`, and `src/chat-client.ts`
- [X] T004 [P] Audit current optional domain REST imports in `src/chat-client.ts`, `src/rest/group-management.ts`, `src/rest/chatroom-management.ts`, and `src/rest/user-info.ts`
- [X] T005 [P] Create tree-shaking fixture directory for consumption scenarios in `tests/fixtures/tree-shaking/`
- [X] T006 Create initial bundle/import graph check script scaffold in `scripts/check-tree-shaking.mjs`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 定义 Manager/capability 边界、依赖校验模型和 bundle gate，使所有 user story 有统一 contract。

**CRITICAL**: No user story implementation should start until this phase is complete.

- [X] T007 Define raw notify and optional capability types in `src/types/manager.ts`
- [X] T008 Define manager capability registry APIs on `ChatClient` internals in `src/chat-client.ts`
- [X] T009 Add user-actionable missing capability validation error helper in `src/chat-client.ts`
- [X] T010 [P] Add core-only fixture entry in `tests/fixtures/tree-shaking/core-only.ts`
- [X] T011 [P] Add core-chat fixture entry in `tests/fixtures/tree-shaking/core-chat.ts`
- [X] T012 [P] Add core-group fixture entry in `tests/fixtures/tree-shaking/core-group.ts`
- [X] T013 Implement forbidden runtime module assertions for tree-shaking scenarios in `scripts/check-tree-shaking.mjs`
- [ ] T014 [P] Add unit tests for capability registration and lookup in `tests/unit/chat-client-tree-shaking/capability-registry.test.ts`
- [ ] T015 [P] Add contract test for forbidden `ChatClient` optional Manager imports in `tests/unit/chat-client-tree-shaking/import-boundary.test.ts`

**Checkpoint**: Foundation ready - bundle gate, capability registry, and import boundary tests exist before domain logic moves.

---

## Phase 3: User Story 1 - 只使用核心能力时不打包未注册 Manager (Priority: P1) MVP

**Goal**: 只导入并初始化 `ChatClient` 或只注册少量 Manager 时，未注册 Manager runtime 不进入消费端依赖图。

**Independent Test**: `node scripts/check-tree-shaking.mjs --scenario core-only` 和 `--scenario core-chat` 应通过，并确认依赖图不包含未注册 Manager runtime。

### Tests for User Story 1

- [ ] T016 [P] [US1] Add failing core-only dependency graph assertion in `tests/unit/chat-client-tree-shaking/core-only-boundary.test.ts`
- [ ] T017 [P] [US1] Add failing core-chat dependency graph assertion in `tests/unit/chat-client-tree-shaking/core-chat-boundary.test.ts`
- [ ] T018 [P] [US1] Add integration test that importing `ChatClient` from package entry does not require optional Manager runtime in `tests/integration/tree-shaking/core-entry.integration.test.ts`
- [ ] T019 [US1] Record E2E/equivalent build validation basis for core-only and core-chat scenarios in `tests/e2e/api/public-api-coverage-matrix.md`

### Implementation for User Story 1

- [X] T020 [US1] Remove runtime import of `UserInfoManager` and optional manager helper modules from `src/chat-client.ts`
- [X] T021 [US1] Remove runtime import of group/chatroom optional REST modules from `src/chat-client.ts`
- [X] T022 [US1] Replace optional Manager type references with `import type` or abstract capability references in `src/chat-client.ts`
- [X] T023 [US1] Ensure `src/index.ts` keeps public exports without forcing runtime inclusion in package consumption
- [X] T024 [US1] Update `package.json` exports guidance if needed to keep Manager subpath entries available
- [X] T025 [US1] Run and tune `scripts/check-tree-shaking.mjs` for `core-only` and `core-chat` scenarios

**Checkpoint**: User Story 1 can be validated independently by bundle gate and import-boundary tests.

---

## Phase 4: User Story 2 - Manager 事件只在对应 Manager 注册后处理 (Priority: P1)

**Goal**: Group、ChatRoom、Contact、ChatThread、UserInfo 等域通知只由已注册 Manager/capability 处理，未注册时忽略。

**Independent Test**: 注册某 Manager 后模拟该域 raw notify 能得到既有公开事件；未注册时模拟同类 raw notify 不派发公开事件且不加载该域实现。

### Tests for User Story 2

- [ ] T026 [P] [US2] Add group raw notify registered-manager unit test in `tests/unit/managers/group-manager-raw-notify.test.ts`
- [ ] T027 [P] [US2] Add chatroom raw notify registered-manager unit test in `tests/unit/managers/chatroom-manager-raw-notify.test.ts`
- [ ] T028 [P] [US2] Add contact raw notify registered-manager unit test in `tests/unit/managers/contact-manager-raw-notify.test.ts`
- [ ] T029 [P] [US2] Add chat-thread raw notify registered-manager unit test in `tests/unit/managers/chat-thread-manager-raw-notify.test.ts`
- [ ] T030 [P] [US2] Add user-info raw notify registered-manager unit test in `tests/unit/managers/user-info-manager-raw-notify.test.ts`
- [ ] T031 [P] [US2] Add integration test for unregistered domain notify ignore behavior in `tests/integration/tree-shaking/raw-notify-routing.integration.test.ts`
- [ ] T032 [US2] Record E2E reused-coverage basis for registered Manager event compatibility in `tests/e2e/api/public-api-coverage-matrix.md`

### Implementation for User Story 2

- [X] T033 [US2] Add raw notify routing from core to registered Manager/capability in `src/chat-client.ts`
- [X] T034 [US2] Remove group event payload construction and dispatch from `src/chat-client.ts`
- [X] T035 [US2] Move group raw notify handling, detail resolution, user enrichment, and public dispatch into `src/managers/group-manager.ts`
- [X] T036 [US2] Remove chatroom event payload construction and dispatch from `src/chat-client.ts`
- [X] T037 [US2] Move chatroom raw notify handling, detail resolution, user enrichment, and public dispatch into `src/managers/chatroom-manager.ts`
- [X] T038 [US2] Move contact roster event user-info hydration ownership from `src/chat-client.ts` into `src/managers/contact-manager.ts`
- [X] T039 [US2] Move chat-thread raw notify normalization and dispatch from `src/chat-client.ts` into `src/managers/chat-thread-manager.ts`
- [X] T040 [US2] Move user-info notify normalization and dispatch from `src/chat-client.ts` into `src/managers/user-info-manager.ts`
- [X] T041 [US2] Delete obsolete domain helper methods from `src/chat-client.ts`
- [X] T042 [US2] Verify registered Manager public event payload compatibility in `src/types/event-system.ts`

**Checkpoint**: User Story 2 can be validated independently by raw notify unit/integration tests and existing Manager event tests.

---

## Phase 5: User Story 3 - 自动同步开关显式声明依赖能力 (Priority: P1)

**Goal**: 联系人自动同步、profile-sync 和未来群组自动同步开启时必须显式注册依赖能力；缺失时 fail fast，关闭时不加载可选能力。

**Independent Test**: 开启 `enableAutoSyncContacts` 但缺少用户资料能力应抛明确配置错误；注册 `UserInfoManager` 后同步能力正常工作。

### Tests for User Story 3

- [X] T043 [P] [US3] Add unit test for `enableAutoSyncContacts` missing user-info capability error in `tests/unit/chat-client-tree-shaking/auto-sync-dependencies.test.ts`
- [X] T044 [P] [US3] Add unit test for profile-sync missing user-info capability error in `tests/unit/chat-client-tree-shaking/profile-sync-dependencies.test.ts`
- [ ] T045 [P] [US3] Add unit test for future group auto-sync dependency contract placeholder in `tests/unit/chat-client-tree-shaking/group-sync-dependencies.test.ts`
- [ ] T046 [P] [US3] Add integration test for contact auto-sync with explicit `UserInfoManager` in `tests/integration/tree-shaking/contact-auto-sync.integration.test.ts`
- [ ] T047 [P] [US3] Add integration test that disabled auto-sync does not require user-info capability in `tests/integration/tree-shaking/disabled-auto-sync.integration.test.ts`
- [ ] T048 [US3] Record E2E/equivalent validation basis for auto-sync dependency errors in `tests/e2e/api/public-api-coverage-matrix.md`

### Implementation for User Story 3

- [ ] T049 [US3] Add optional capability dependency declarations for contact auto-sync and profile-sync in `src/types/chat-client.ts`
- [X] T050 [US3] Validate auto-sync capability dependencies during `ChatClient.init` or before login in `src/chat-client.ts`
- [X] T051 [US3] Remove implicit profile-sync `UserInfoManager` construction from `src/chat-client.ts`
- [X] T052 [US3] Move user-info hydration queue ownership behind explicit user-info capability in `src/managers/user-info-manager.ts`
- [X] T053 [US3] Move group namecard hydration ownership behind explicit group capability in `src/managers/group-manager.ts`
- [X] T054 [US3] Ensure disabled auto-sync and disabled profile-sync do not instantiate queues or resolver dependencies in `src/chat-client.ts`
- [ ] T055 [US3] Update validator schemas for explicit dependency errors if needed in `src/validators/chat-client.ts`

**Checkpoint**: User Story 3 can be validated independently by dependency error tests and contact auto-sync integration tests.

---

## Phase 6: User Story 4 - 小程序用户获得明确的按需导入路径和体积验收 (Priority: P2)

**Goal**: 小程序/size-sensitive 用户有明确子路径导入文档和可执行包体积/依赖图验收。

**Independent Test**: 小程序等价消费入口使用子路径导入后，bundle gate 只包含显式使用 Manager；文档提供 core-only、core-chat、core-group 示例。

### Tests for User Story 4

- [ ] T056 [P] [US4] Add miniapp-equivalent core-only fixture in `tests/fixtures/tree-shaking/miniapp-core-only.ts`
- [ ] T057 [P] [US4] Add miniapp-equivalent core-chat fixture in `tests/fixtures/tree-shaking/miniapp-core-chat.ts`
- [ ] T058 [P] [US4] Add miniapp-equivalent core-group fixture in `tests/fixtures/tree-shaking/miniapp-core-group.ts`
- [ ] T059 [P] [US4] Add bundle gate tests for miniapp-equivalent fixtures in `tests/integration/tree-shaking/miniapp-equivalent.integration.test.ts`
- [ ] T060 [US4] Add E2E or equivalent build validation command reference in `tests/e2e/api/public-api-coverage-matrix.md`

### Implementation for User Story 4

- [ ] T061 [US4] Extend `scripts/check-tree-shaking.mjs` with miniapp-equivalent scenario support
- [ ] T062 [US4] Document Manager subpath imports for size-sensitive usage in `docs/reference/tree-shaking.md`
- [ ] T063 [US4] Update package usage examples to avoid recommending aggregate Manager imports for miniapp in `README.md`
- [ ] T064 [US4] Update demo or miniapp docs to use subpath Manager imports in `demo/README.md`
- [ ] T065 [US4] Document IIFE as all-capabilities distribution in `docs/reference/tree-shaking.md`

**Checkpoint**: User Story 4 can be validated independently by miniapp-equivalent bundle gate and documentation review.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 全局回归、文档一致性、版本治理和提交。

- [ ] T066 [P] Search for forbidden `ChatClient` optional Manager imports using `rg` and record result in `specs/044-tree-shaking-optimization/quickstart.md`
- [ ] T067 [P] Search for outdated aggregate import recommendations in `README.md`, `docs/`, and `demo/`
- [ ] T068 [P] Update API reference or public docs if Manager usage comments changed in `docs/reference/`
- [X] T069 Run targeted tree-shaking checks from `specs/044-tree-shaking-optimization/quickstart.md`
- [X] T070 Run targeted unit and integration tests for 044 in `tests/unit/chat-client-tree-shaking/`, `tests/unit/managers/`, and `tests/integration/tree-shaking/`
- [ ] T071 Run full validation gates `npm run test:run`, `npm run lint`, `npm run type-check`, and `npm run docs:api:check` if docs/API comments changed
- [X] T072 Update version according to feature impact in `package.json`
- [X] T073 Update release notes for tree-shaking and explicit auto-sync dependency behavior in `CHANGELOG.md`
- [X] T074 Review `git diff` to ensure unrelated workspace changes are not included
- [ ] T075 Create final Chinese git commit for 044 tree-shaking optimization changes

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - blocks all user stories
- **US1 / US2 / US3**: Depend on Foundational phase completion
- **US4**: Depends on Foundational and benefits from US1 bundle gate stabilization
- **Polish (Phase 7)**: Depends on completed desired user stories

### User Story Dependencies

- **US1 只使用核心能力时不打包未注册 Manager**: MVP; should complete first because it establishes the primary bundle gate
- **US2 Manager 事件只在对应 Manager 注册后处理**: Can start after Foundational; touches shared files with US1 and US3, coordinate `src/chat-client.ts`
- **US3 自动同步开关显式声明依赖能力**: Can start after Foundational; depends conceptually on capability registry from Phase 2
- **US4 小程序用户获得明确的按需导入路径和体积验收**: Can start after bundle gate script is stable; documentation can proceed in parallel with final validation

### Within Each User Story

- Tests should be written or updated before implementation when feasible
- Bundle gate tasks should fail before implementation removes hard references
- `src/chat-client.ts` changes in US1, US2, and US3 must be sequenced carefully
- Manager-specific raw notify tasks can proceed in parallel after routing contract is defined
- Documentation updates happen after the final recommended import contract is stable

---

## Parallel Opportunities

- T001-T005 can run in parallel
- T010-T012 can run in parallel after T006
- T014-T015 can run in parallel after T007-T009
- T016-T019 can run in parallel within US1
- T026-T032 can run in parallel within US2
- T043-T048 can run in parallel within US3
- T056-T060 can run in parallel within US4
- T066-T068 can run in parallel during polish

---

## Parallel Example: User Story 1

```bash
Task: "Add failing core-only dependency graph assertion in tests/unit/chat-client-tree-shaking/core-only-boundary.test.ts"
Task: "Add failing core-chat dependency graph assertion in tests/unit/chat-client-tree-shaking/core-chat-boundary.test.ts"
Task: "Add integration test that importing ChatClient from package entry does not require optional Manager runtime in tests/integration/tree-shaking/core-entry.integration.test.ts"
```

## Parallel Example: User Story 2

```bash
Task: "Add group raw notify registered-manager unit test in tests/unit/managers/group-manager-raw-notify.test.ts"
Task: "Add chatroom raw notify registered-manager unit test in tests/unit/managers/chatroom-manager-raw-notify.test.ts"
Task: "Add contact raw notify registered-manager unit test in tests/unit/managers/contact-manager-raw-notify.test.ts"
Task: "Add chat-thread raw notify registered-manager unit test in tests/unit/managers/chat-thread-manager-raw-notify.test.ts"
```

## Parallel Example: User Story 3

```bash
Task: "Add unit test for enableAutoSyncContacts missing user-info capability error in tests/unit/chat-client-tree-shaking/auto-sync-dependencies.test.ts"
Task: "Add integration test for contact auto-sync with explicit UserInfoManager in tests/integration/tree-shaking/contact-auto-sync.integration.test.ts"
Task: "Add integration test that disabled auto-sync does not require user-info capability in tests/integration/tree-shaking/disabled-auto-sync.integration.test.ts"
```

## Parallel Example: User Story 4

```bash
Task: "Add miniapp-equivalent core-only fixture in tests/fixtures/tree-shaking/miniapp-core-only.ts"
Task: "Add miniapp-equivalent core-chat fixture in tests/fixtures/tree-shaking/miniapp-core-chat.ts"
Task: "Add miniapp-equivalent core-group fixture in tests/fixtures/tree-shaking/miniapp-core-group.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational capability and bundle gate contract
3. Complete Phase 3: US1 core-only/core-chat dependency graph cleanup
4. Validate `core-only` and `core-chat` bundle gates
5. Stop and review before moving domain event handling

### Incremental Delivery

1. Setup + Foundational -> capability registry and bundle gate ready
2. US1 -> core-only/core-chat no longer include unregistered Manager runtime
3. US2 -> domain notifications move to registered Managers
4. US3 -> auto-sync/profile-sync dependencies become explicit and fail fast
5. US4 -> size-sensitive docs and miniapp-equivalent gates
6. Polish -> docs, version, changelog, validation, commit

### Parallel Team Strategy

With multiple developers:

1. One developer owns bundle gate script and fixtures
2. One developer owns `ChatClient` import boundary and capability registry
3. One developer owns Group/ChatRoom raw notify migration
4. One developer owns Contact/UserInfo/ChatThread raw notify migration
5. One developer owns auto-sync dependency validation and docs after contracts stabilize

## Notes

- [P] tasks = different files, no dependency on incomplete same-file edits
- Avoid editing unrelated dirty files already present in the workspace
- Do not run `setup-plan.sh` in this branch for 044 because the user requested no branch switch and prerequisite scripts resolve the current `001-im-sdk-refactor` branch
