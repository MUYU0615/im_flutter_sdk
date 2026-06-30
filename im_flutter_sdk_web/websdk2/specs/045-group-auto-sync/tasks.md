# Tasks: 登录后自动同步群组数据

**Input**: Design documents from `/specs/045-group-auto-sync/`
**Prerequisites**: `plan.md`、`spec.md`、`research.md`、`data-model.md`、`contracts/group-auto-sync.openapi.yaml`、`quickstart.md`

**Tests**: 本功能按 spec 要求必须包含 unit、integration、E2E/API 浏览器验证；同时包含公开类型测试、协议 codec 测试和破坏性迁移边界测试。若 E2E 复用现有 demo 登录主路径，必须在任务中记录复用依据。

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行（不同文件、无未完成依赖）
- **[Story]**: 仅用户故事阶段使用（`[US1]...[US4]`）
- 每个任务描述都包含明确文件路径

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 建立 045 所需目录、类型、协议、缓存和测试骨架，避免后续实现散落到旧联系人同步语义里。

- [X] T001 [P] Audit current contact auto-sync config and event usage in `src/chat-client.ts`, `src/types/chat-client.ts`, `src/types/event-system.ts`, `src/core/contact-sync/`, `demo/`, and `tests/`
- [X] T002 [P] Audit current group repository, MUC merge, and `getGroup(groupId)` behavior in `src/managers/group-manager.ts`, `src/managers/group/group.ts`, and `src/managers/group/internal/`
- [X] T003 [P] Audit current sync transport reuse points in `src/core/contact-sync/sync-transport-client.ts`, `src/core/session-list-sync/`, and DNS sync-ws resolution code
- [X] T004 Create group-sync module skeleton in `src/core/group-sync/group-sync-controller.ts`, `src/core/group-sync/group-sync-session.ts`, `src/core/group-sync/group-sync-normalizer.ts`, `src/core/group-sync/group-sync-merge.ts`, `src/core/group-sync/group-sync-types.ts`, and `src/core/group-sync/index.ts`
- [X] T005 [P] Create joined-groups protocol skeleton in `src/protocol/joined-groups/codec.ts`, `src/protocol/joined-groups/types.ts`, `src/protocol/joined-groups/gateway.ts`, `src/protocol/joined-groups/proto.ts`, and `src/protocol/joined-groups/index.ts`
- [X] T006 [P] Create joined group preview cache skeleton in `src/cache/joined-group-preview-cache.ts`
- [X] T007 [P] Create sync-data public type skeleton in `src/types/sync-data.ts`
- [X] T008 [P] Create test directories for 045 in `tests/unit/sync-data/`, `tests/unit/group-sync/`, `tests/unit/protocol/`, `tests/integration/group-sync/`, `tests/integration/sync-data/`, and `tests/e2e/api/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 完成所有 user story 共享的公开类型、协议类型、缓存模型、事件模型和基础导出。

**CRITICAL**: 此阶段完成前不得进入任何用户故事实现。

- [X] T009 Define `SyncDataType`, `SyncDataStartPayload`, `SyncDataFinishedPayload`, and `SyncDataError` in `src/types/sync-data.ts`
- [X] T010 Update `ChatClient` init config types to use `enableSyncData?: ReadonlyArray<'contact' | 'group'>` and remove `enableAutoSyncContacts` in `src/types/chat-client.ts`
- [X] T011 [P] Update event handler map types for ChatClient-level `onSyncDataStart` and `onSyncDataFinished` in `src/types/event-system.ts`
- [X] T012 [P] Export sync-data and joined group public types from `src/index.ts` and `src/types/index.ts`
- [X] T013 [P] Define `JoinedGroupSummary`, `JoinedGroupSnapshot`, `JoinedGroupSnapshotMeta`, and local preview cache types in `src/types/group.ts`
- [X] T014 [P] Define group-sync runtime/session/batch/error-stage types in `src/core/group-sync/group-sync-types.ts`
- [X] T015 [P] Define joined-groups WSS request/response enums, `GatewayHeader`, `GroupItem`, and normalized protocol types in `src/protocol/joined-groups/types.ts`
- [X] T016 [P] Add cache key and cache manager access points for joined group preview cache in `src/cache/cache-keys.ts`, `src/cache/cache-types.ts`, and `src/cache/cache-manager.ts`
- [X] T017 Implement 100-item preview read/write/delete/user-isolation skeleton in `src/cache/joined-group-preview-cache.ts`
- [ ] T018 [P] Add foundational type tests for `enableSyncData`, sync event payloads, and joined group snapshot meta in `tests/types/sync-data-types.test.ts` and `tests/types/group-manager-types.test.ts`
- [ ] T019 [P] Add foundational cache tests for user isolation, `storageLimit=100`, preview meta, and corrupted cache fallback in `tests/unit/cache/joined-group-preview-cache.test.ts`
- [X] T020 [P] Add foundational protocol type/codec smoke tests for message type 12/13/5 and ping/pong in `tests/unit/protocol/joined-groups-codec.test.ts`

**Checkpoint**: 共享类型、缓存骨架、协议骨架和基础测试就绪，用户故事可按优先级推进。

---

## Phase 3: User Story 1 - 登录后按统一开关自动同步群组 (Priority: P1) MVP

**Goal**: `enableSyncData` 成为联系人/群组自动同步唯一配置入口，登录后只启动被启用的数据同步类型。

**Independent Test**: 初始化 `[]`、`['contact']`、`['group']`、`['contact', 'group']`，验证登录后只启动对应同步；旧 `enableAutoSyncContacts` 不再通过类型/校验。

### Tests for User Story 1

- [X] T021 [P] [US1] Add unit tests for `enableSyncData` default, dedupe, unknown value failure, and old `enableAutoSyncContacts` rejection in `tests/unit/sync-data/enable-sync-data.test.ts`
- [ ] T022 [P] [US1] Add type tests proving `enableAutoSyncContacts` is removed and `enableSyncData` supports only `contact | group` in `tests/types/sync-data-types.test.ts`
- [X] T023 [P] [US1] Add integration tests for login dispatch matrix `[]`, `['contact']`, `['group']`, `['contact', 'group']` in `tests/integration/sync-data/sync-data-login.integration.test.ts`
- [ ] T024 [P] [US1] Add E2E/API test for `enableSyncData: ['group']` login not blocking main connection in `tests/e2e/api/group-sync.spec.ts`

### Implementation for User Story 1

- [X] T025 [US1] Implement `enableSyncData` validation and normalization in `src/validators/chat-client.ts`
- [X] T026 [US1] Remove `enableAutoSyncContacts` config handling and compatibility branches from `src/chat-client.ts`
- [X] T027 [US1] Update login-time sync dispatcher to route `contact` and `group` by normalized `enableSyncData` in `src/chat-client.ts`
- [X] T028 [US1] Add group-sync controller construction and lifecycle ownership in `src/chat-client.ts`
- [X] T029 [US1] Ensure disabled group sync creates no group-sync websocket or controller work in `src/chat-client.ts` and `src/core/group-sync/group-sync-controller.ts`
- [X] T030 [US1] Preserve 024 contact sync behavior when `enableSyncData` contains `contact` in `src/core/contact-sync/` and `src/chat-client.ts`
- [ ] T031 [US1] Update public initialization examples away from `enableAutoSyncContacts` in `README.md` and `docs/reference/`

**Checkpoint**: US1 可独立验证统一开关、破坏性移除旧联系人开关和登录后按需调度。

---

## Phase 4: User Story 2 - 通过第二通道全量追平已加入群组列表 (Priority: P1)

**Goal**: 群组同步复用第二通道 WSS，每次登录全量同步本轮最多 3000 个轻量群组，localStorage 只保存最多 100 个预览，并正确处理多批、错误、MUC 冲突和 3000 受限状态。

**Independent Test**: mock 第二通道返回全量、多批、空结果、错误、重复/乱序批次、3000 上限和 MUC 冲突，验证运行时快照、100 预览、完成元信息和事件闭环。

### Tests for User Story 2

- [X] T032 [P] [US2] Add unit tests for `GetJoinedGroupsRequest(type=12)` encoding with `lastSyncTime=0`, `GetJoinedGroupsResponse(type=13)` decoding, response cursor, `ErrorDetail(type=5)` decoding, and official `GroupItem` fields in `tests/unit/protocol/joined-groups-codec.test.ts`
- [X] T033 [P] [US2] Add unit tests for `GroupItem` to `JoinedGroupSummary` normalization, role mapping, `mute_expiration`, `remind_type`, `create_at`, `update_at`, `joined_timestamp`, and missing optional fields in `tests/unit/group-sync/group-sync-normalizer.test.ts`
- [X] T034 [P] [US2] Add unit tests for merge rules covering 100 preview persistence, runtime 3000 snapshot, duplicate group ids, limited state, empty list, no-delete-on-missing, and cursor resume state isolation in `tests/unit/group-sync/group-snapshot-merge.test.ts`
- [ ] T035 [P] [US2] Add unit tests for `update_at` vs MUC update clock and MUC removal state no-resurrection in `tests/unit/group-sync/group-sync-decision.test.ts`
- [X] T036 [P] [US2] Add unit tests for controller in-flight reuse, same-round cursor resume, cancel on logout, auth/config/socket/decode/error-frame/preview persistence failure stages in `tests/unit/group-sync/group-sync-controller.test.ts`
- [ ] T037 [P] [US2] Add integration tests for group-sync transport success, multi-batch, cursor resume, empty result, and WSS error in `tests/integration/group-sync/group-sync-transport.integration.test.ts`
- [ ] T038 [P] [US2] Add integration tests for MUC update/delete/destroy precedence over second-channel data in `tests/integration/group-sync/group-sync-muc-merge.integration.test.ts`
- [X] T039 [P] [US2] Add integration tests for 100 localStorage preview vs 3000 runtime snapshot and account isolation in `tests/integration/group-sync/group-auto-sync.integration.test.ts`
- [ ] T040 [P] [US2] Add E2E/API test for 3000 limited meta and sync failure not blocking login in `tests/e2e/api/group-sync.spec.ts`

### Implementation for User Story 2

- [X] T041 [US2] Implement joined-groups static protobuf adapter and codec for `GetJoinedGroupsRequest(type=12)`, `GetJoinedGroupsResponse(type=13)`, `ErrorDetail(type=5)`, cursor, and official `GroupItem` fields in `src/protocol/joined-groups/codec.ts`, `src/protocol/joined-groups/gateway.ts`, and `src/protocol/joined-groups/proto.ts`
- [ ] T042 [US2] Add or extend protobuf generation script for joined-groups static output in `scripts/generate-joined-groups-proto.js`
- [X] T043 [US2] Implement group-sync session request/response loop, request id filtering, ping/pong, batch collection, cursor resume, and terminal states in `src/core/group-sync/group-sync-session.ts`
- [X] T044 [US2] Implement `SyncTransportClient` reuse and sync-ws candidate resolution for group-sync in `src/core/group-sync/group-sync-controller.ts`
- [X] T045 [US2] Implement `GroupItem` normalizer into stable `JoinedGroupSummary` in `src/core/group-sync/group-sync-normalizer.ts`
- [X] T046 [US2] Implement runtime snapshot merge, duplicate dedupe, missing-item no-delete, `update_at` conflict decisions, and MUC removal-state filtering in `src/core/group-sync/group-sync-merge.ts`
- [X] T047 [US2] Implement 100-item localStorage preview persistence and completion meta update in `src/cache/joined-group-preview-cache.ts`
- [X] T048 [US2] Connect group-sync merge results into `GroupRepository` without clearing richer group detail fields in `src/managers/group/internal/group-repository.ts`
- [ ] T049 [US2] Connect MUC group update/delete/leave/kick/destroy events to runtime update clocks and removal states in `src/managers/group/internal/group-event-sync.ts`
- [X] T050 [US2] Implement controller cancellation on logout, account switch, kicked, and token invalidation in `src/core/group-sync/group-sync-controller.ts` and `src/chat-client.ts`
- [X] T051 [US2] Add structured diagnostic logs for start, finish, failure stage, server limit, preview persistence, and MUC conflict decisions in `src/core/group-sync/`
- [X] T051A [US2] Map service `ErrorDetail(type=5)` codes `1601`, `1602`, `1002`, and `1003` into `SyncDataError` stage/code/retryable guidance in `src/core/group-sync/group-sync-controller.ts` and `src/core/group-sync/group-sync-session.ts`

**Checkpoint**: US2 可独立验证第二通道同步、100/3000 分层、MUC 优先级和受限/失败状态。

---

## Phase 5: User Story 3 - 统一感知同步过程和结果类型 (Priority: P1)

**Goal**: 联系人和群组自动同步都通过 `ChatClient` 级 `onSyncDataStart` / `onSyncDataFinished` 观察，payload 携带 `dataType`、状态和失败阶段；旧联系人同步事件移除。

**Independent Test**: 注册 ChatClient 级统一事件后触发联系人、群组、失败和并行同步，验证每轮都是 start -> finished 闭环，manager 级旧同步事件不再可用。

### Tests for User Story 3

- [X] T052 [P] [US3] Add unit tests for sync event payload shape, exact once start/finished, failed payload, no public limited/cancelled status, and dataType separation in `tests/unit/sync-data/sync-data-events.test.ts`
- [X] T053 [P] [US3] Add unit tests for contact sync bridge from old 024 controller events into unified `dataType: 'contact'` events in `tests/unit/sync-data/contact-sync-event-bridge.test.ts`
- [ ] T054 [P] [US3] Add type tests proving `onContactSyncStart` and `onContactSyncFinish` are removed from public handler maps in `tests/types/sync-data-types.test.ts`
- [ ] T055 [P] [US3] Add integration tests for concurrent contact/group sync event isolation and one failure not swallowing the other in `tests/integration/sync-data/sync-data-login.integration.test.ts`
- [ ] T056 [P] [US3] Add E2E/API test for observing `onSyncDataStart` and `onSyncDataFinished` through ChatClient-level handlers in `tests/e2e/api/group-sync.spec.ts`

### Implementation for User Story 3

- [X] T057 [US3] Implement ChatClient-level unified sync event dispatch helper in `src/chat-client.ts`
- [X] T058 [US3] Bridge contact sync start/finish/failure into unified sync events in `src/core/contact-sync/` and `src/chat-client.ts`
- [X] T059 [US3] Bridge group sync start/finish/failure into unified sync events in `src/core/group-sync/group-sync-controller.ts` and `src/chat-client.ts`
- [X] T060 [US3] Remove public `onContactSyncStart` and `onContactSyncFinish` handler names from `src/types/contact.ts`, `src/types/event-system.ts`, and related exports
- [X] T061 [US3] Ensure `ContactManager` and `GroupManager` do not expose manager-level sync start/finish registration surfaces in `src/managers/contact-manager.ts` and `src/managers/group-manager.ts`
- [X] T062 [US3] Update demo event registration and logs to use ChatClient-level unified sync events in `demo/src/App.tsx` and `demo/src/types.ts`
- [ ] T063 [US3] Update API docs and migration notes for unified sync events in `docs/reference/` and `README.md`

**Checkpoint**: US3 可独立验证统一事件面、联系人同步迁移和旧事件破坏性移除。

---

## Phase 6: User Story 4 - 通过 GroupManager 与 getGroup 消费本地群组信息 (Priority: P2)

**Goal**: `GroupManager` 提供纯本地快照读取入口，`getGroup(groupId)` 能绑定同步/预览里的轻量群组信息，但不隐式请求完整详情。

**Independent Test**: 同步前读取 100 预览，同步后读取 runtime snapshot；`getGroup(groupId)` 对已知群携带轻量字段，对未知群保持无网络 facade；账号切换不串数据。

### Tests for User Story 4

- [X] T064 [P] [US4] Add unit tests for `getJoinedGroupList()` local joined-group array and pure local-read semantics in `tests/unit/managers/group-manager-local-groups.test.ts`
- [X] T065 [P] [US4] Add unit tests for `getGroup(groupId)` binding known lightweight summary without calling detail API in `tests/unit/managers/group-manager-local-groups.test.ts`
- [X] T066 [P] [US4] Add unit tests for `Group` facade exposing known summary fields while keeping `getDetail()` explicit in `tests/unit/managers/group.test.ts`
- [X] T067 [P] [US4] Add integration tests for local preview before sync, runtime snapshot after sync, account switch isolation, and MUC update visibility in `tests/integration/group-sync/group-auto-sync.integration.test.ts`
- [X] T068 [P] [US4] Add E2E/API test for reading local group snapshot and known `getGroup(groupId)` fields after login sync in `tests/e2e/api/group-sync.spec.ts`

### Implementation for User Story 4

- [X] T069 [US4] Add `getJoinedGroupList()` local snapshot public API to `src/managers/group-manager.ts`
- [X] T070 [US4] Add repository read path for local preview and runtime joined-group snapshot in `src/managers/group/internal/group-repository.ts`
- [X] T071 [US4] Update `groupManager.getGroup(groupId)` to bind known lightweight summary from repository or preview cache in `src/managers/group-manager.ts`
- [X] T072 [US4] Update `Group` facade to expose or internally carry known lightweight summary without marking full detail loaded in `src/managers/group/group.ts`
- [X] T073 [US4] Ensure `getJoinedGroupList()` and `getGroup(groupId)` do not trigger REST detail requests implicitly in `src/managers/group-manager.ts` and `src/rest/group-management.ts`
- [X] T074 [US4] Remove public `getJoinedGroupList(params)` network pagination semantics from `src/managers/group-manager.ts`
- [X] T075 [US4] Update public group types and docs for local snapshot, preview meta, and lightweight-vs-detail distinction in `src/types/group.ts` and `docs/reference/`
- [X] T075A [US4] Patch local group-chat session-list display fields from joined-group sync results and dispatch conversation-list update events when changed in `src/cache/cache-manager.ts` and `src/chat-client.ts`

**Checkpoint**: US4 可独立验证本地群组读取、`getGroup` 轻量信息消费和无隐式详情请求。

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 跨故事一致性、文档、版本、验证和提交。

- [X] T076 [P] Update `specs/045-group-auto-sync/quickstart.md` with actual command results and any real-env limitations
- [ ] T077 [P] Update `specs/045-group-auto-sync/contracts/group-auto-sync.openapi.yaml` if final public API names differ from plan
- [X] T078 [P] Search and remove stale `enableAutoSyncContacts`, `onContactSyncStart`, and `onContactSyncFinish` references in `src/`, `tests/`, `demo/`, `docs/`, and `README.md`
- [X] T079 [P] Update API Reference generation inputs for new group local snapshot API and unified sync events in `docs/reference/` and TypeDoc source comments
- [ ] T080 [P] Update `demo/README.md` with unified sync event and group local snapshot verification steps
- [X] T081 Run targeted unit tests for 045 in `tests/unit/sync-data/`, `tests/unit/group-sync/`, `tests/unit/protocol/joined-groups-codec.test.ts`, `tests/unit/cache/joined-group-preview-cache.test.ts`, and `tests/unit/managers/group-manager-local-groups.test.ts`
- [X] T082 Run targeted integration tests for 045 in `tests/integration/sync-data/` and `tests/integration/group-sync/`
- [ ] T083 Run browser API E2E for 045 with `npx playwright test tests/e2e/api/group-sync.spec.ts --project=chromium`
- [ ] T084 Run full validation gates `npm run test:run`, `npm run lint`, `npm run type-check`, and `npm run test:gate:pr`
- [X] T085 Run docs/error checks `npm run docs:api:check` and `npm run errors:check` if public API docs or REST error docs changed
- [X] T086 Update version in `package.json` and `package-lock.json`
- [X] T087 Update release notes for 045 implementation in `CHANGELOG.md`
- [ ] T088 Review `git diff` to ensure unrelated workspace changes are not included
- [ ] T089 Create final Chinese git commit for 045 group auto sync changes

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 可立即开始
- **Phase 2 (Foundational)**: 依赖 Phase 1 完成，且阻塞所有 user story
- **Phase 3 (US1)**: 依赖 Phase 2；建议作为 MVP 先完成
- **Phase 4 (US2)**: 依赖 Phase 2；需要 US1 的 group-sync 调度入口才能做完整登录集成
- **Phase 5 (US3)**: 依赖 Phase 2；可与 US2 并行，但最终事件闭环需要接入 US1/US2 controller
- **Phase 6 (US4)**: 依赖 Phase 2；本地读取 API 可先做，完整同步后 runtime snapshot 依赖 US2
- **Phase 7 (Polish)**: 依赖已选 user story 完成

### User Story Dependencies

- **US1 登录后按统一开关自动同步群组**: MVP；先交付配置、破坏性移除旧开关和登录后调度
- **US2 第二通道全量追平已加入群组列表**: 依赖 US1 的 group-sync 调度入口；实现协议、transport、merge、100/3000 存储分层
- **US3 统一感知同步过程和结果类型**: 可与 US2 并行推进类型和联系人桥接；最终需要接入 US2 的 group-sync terminal states
- **US4 GroupManager 与 getGroup 消费本地群组信息**: 可与 US2 并行推进 API 形状；完整数据语义依赖 US2 的 repository 写入

### Within Each User Story

- 新增或修改测试任务先完成，并确认初始失败符合预期
- 类型/协议/缓存模型先于 controller/session 实现
- controller/session 先于 ChatClient 登录调度集成
- merge/repository 写入先于 GroupManager 本地读取和 `getGroup` 消费
- 文档与 demo 更新在 public API 形状稳定后完成

### Parallel Opportunities

- T001-T003 audit tasks can run in parallel
- T005-T008 setup skeleton tasks can run in parallel after T004 scope is agreed
- T011-T016 foundational type/protocol/cache tasks can run in parallel
- T018-T020 foundational tests can run in parallel
- T021-T024 US1 tests can run in parallel
- T032-T040 US2 tests can run in parallel by test layer/file
- T045-T049 US2 normalizer/merge/cache/repository/MUC tasks can run in parallel after protocol types settle
- T052-T056 US3 tests can run in parallel
- T064-T068 US4 tests can run in parallel
- T076-T080 polish documentation updates can run in parallel

---

## Parallel Example: User Story 2

```bash
Task: "T032 Add joined-groups codec tests in tests/unit/protocol/joined-groups-codec.test.ts"
Task: "T033 Add group-sync normalizer tests in tests/unit/group-sync/group-sync-normalizer.test.ts"
Task: "T034 Add group snapshot merge tests in tests/unit/group-sync/group-snapshot-merge.test.ts"
Task: "T035 Add update_at and MUC removal tests in tests/unit/group-sync/group-sync-decision.test.ts"
```

## Parallel Example: User Story 3

```bash
Task: "T052 Add unified sync event payload tests in tests/unit/sync-data/sync-data-events.test.ts"
Task: "T053 Add contact sync event bridge tests in tests/unit/sync-data/contact-sync-event-bridge.test.ts"
Task: "T054 Add old contact sync event removal type tests in tests/types/sync-data-types.test.ts"
Task: "T055 Add concurrent contact/group sync event integration tests in tests/integration/sync-data/sync-data-login.integration.test.ts"
```

## Parallel Example: User Story 4

```bash
Task: "T064 Add local snapshot tests in tests/unit/managers/group-manager-local-groups.test.ts"
Task: "T065 Add getGroup known summary tests in tests/unit/managers/group-manager-local-groups.test.ts"
Task: "T066 Add Group facade known summary tests in tests/unit/managers/group.test.ts"
Task: "T067 Add local preview/runtime snapshot integration tests in tests/integration/group-sync/group-auto-sync.integration.test.ts"
```

---

## Implementation Strategy

### MVP First (US1)

1. 完成 Phase 1 和 Phase 2
2. 完成 US1：`enableSyncData`、旧联系人开关移除、登录后按需调度
3. **STOP and VALIDATE**：运行 US1 unit/type/integration/E2E/API 用例
4. 确认主登录链路不被 group-sync 配置影响后，再推进协议和数据同步

### Incremental Delivery

1. Setup + Foundational 打底
2. 交付 US1（统一开关与登录调度）
3. 交付 US2（第二通道同步、100/3000 存储分层、MUC 裁决）
4. 交付 US3（统一同步事件与联系人事件迁移）
5. 交付 US4（GroupManager 本地读取与 `getGroup` 消费轻量信息）
6. Phase 7 完成文档、demo、验证、版本和提交

### Parallel Team Strategy

- 开发 A：US1 + US3（配置、事件、联系人同步迁移、ChatClient 接线）
- 开发 B：US2 protocol/session/controller（joined-groups codec、WSS、错误阶段、取消）
- 开发 C：US2 merge/cache + US4（100 预览、3000 runtime repository、GroupManager 本地读取、`getGroup`）
- 开发 D：测试与浏览器验证（unit/integration/E2E、quickstart 记录、docs）

---

## Notes

- 所有任务均遵循 `- [ ] Txxx [P] [USx] 描述+路径` 规范
- 用户故事阶段均带 `[USx]` 标签，便于追踪与独立验收
- 本期是破坏性公开 API 收敛：不得保留 `enableAutoSyncContacts`、`onContactSyncStart`、`onContactSyncFinish` 作为公开兼容入口
- 本期 localStorage 只保存 100 个群组预览；不得把 3000 个同步结果全部持久化
- 本期每次登录仍全量 group sync；不得用本地 completion meta 跳过下一次登录同步
- 实现阶段仍需遵守：先验证，再更新版本号和 `CHANGELOG.md`，最后中文 commit，不 push
