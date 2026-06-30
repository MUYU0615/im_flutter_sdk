# Tasks: ChatThread 公开 API

**Input**: Design documents from `/specs/046-chat-thread-public-api/`
**Prerequisites**: `plan.md`、`spec.md`、`research.md`、`data-model.md`、`contracts/chat-thread-public-api.openapi.yaml`、`quickstart.md`

**Tests**: 本功能按 spec 要求必须包含 unit、integration、E2E/真实环境验证、导出契约、错误码治理和 API Reference 生成检查。测试任务必须先于对应实现任务推进；若真实环境 E2E 条件不足，必须在任务中记录替代验证依据和补测条件。

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行（不同文件、无未完成依赖）
- **[Story]**: 仅用户故事阶段使用（`[US1]...[US5]`）
- 每个任务描述都包含明确文件路径

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 盘点当前半公开 Thread 模块、原工程对照来源、文档生成入口和测试现状，为后续实现提供准确基线。

- [X] T001 [P] Audit current ChatThread source and public exports in `src/index.ts`, `src/managers/chat-thread-manager.ts`, `src/managers/chat-thread/index.ts`, `src/managers/chat-thread/chat-thread.ts`, and `package.json`
- [X] T002 [P] Audit current ChatThread public and internal types in `src/types/chat-thread.ts`, `src/types/event-system.ts`, `src/types/index.ts`, and `src/types/connection.ts`
- [X] T003 [P] Audit current Thread REST adapter behavior against original `threadApi.ts` and record mismatches in `specs/046-chat-thread-public-api/research.md`
- [X] T004 [P] Audit current Thread MUC event behavior against original `handleMucMsg.ts` and record raw operation mapping decisions in `specs/046-chat-thread-public-api/research.md`
- [X] T005 [P] Audit current ChatThread tests in `tests/unit/rest/chat-thread-management.test.ts`, `tests/unit/managers/chat-thread-manager.test.ts`, `tests/unit/managers/chat-thread.test.ts`, `tests/unit/chat-client/chat-thread-events.test.ts`, and `tests/unit/core/message/message-receiver-thread.test.ts`
- [X] T006 [P] Audit current Thread docs and demo usage in `docs/integration/thread.md`, `docs/reference/api-reference.zh-CN.md`, `docs/reference/api-reference.en-US.md`, `demo/src/App.tsx`, and `demo/src/components/ChatThreadPanel.tsx`
- [X] T007 [P] Audit current API Reference and error-code generation inputs in `scripts/api-doc-entry-points.js`, `scripts/api-error-operation-aliases.js`, `src/rest/api-errors.json`, and `docs/reference/errors.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 建立 046 的公开类型、事件命名、错误码 operation 对齐和测试基线。此阶段完成前不得进入用户故事实现。

**CRITICAL**: 此阶段完成前不得开始任何 user story 的实现任务。

- [X] T008 Define the final 4-event public surface and remove `onChatThreadChange` from the planned public handler map in `src/types/chat-thread.ts` and `src/types/event-system.ts`
- [X] T009 Move or re-export `GetChatThreadInfoParams` and all public ChatThread parameter/result/event types from `src/types/chat-thread.ts`
- [X] T010 Add bilingual JSDoc skeletons for ChatThread public types and event payload fields in `src/types/chat-thread.ts`
- [X] T011 [P] Add API Reference entry placeholders for ChatThread manager/entity/types in `scripts/api-doc-entry-points.js`
- [X] T012 [P] Add Thread operation alias placeholders if needed in `scripts/api-error-operation-aliases.js`
- [X] T013 [P] Add baseline type tests for ChatThread public event handler names and absence of `onChatThreadChange` in `tests/types/chat-thread-types.test.ts`
- [X] T014 [P] Add baseline contract test for `./managers/chat-thread` and main-entry ChatThread exports in `tests/contract/manager-exports.contract.test.ts`
- [X] T015 [P] Add baseline API docs entry contract test for ChatThread source files in `tests/contract/api-doc-entry-points.contract.test.ts`

**Checkpoint**: 公开类型、事件名、导出和文档入口基线清晰，后续 user story 可按优先级推进。

---

## Phase 3: User Story 1 - 开发者能发现并注册 ChatThread 能力 (Priority: P1) MVP

**Goal**: 开发者能从主入口和 `./managers/chat-thread` 子路径发现、导入、注册 `ChatThreadManager`，并在 API Reference 中找到 manager、entity、类型和 4 个事件。

**Independent Test**: 从主入口和子路径导入 `ChatThreadManager` / `ChatThread`，注册 manager 后访问 `client.chatThreadManager`，并确认 API docs 入口包含 ChatThread 文件。

### Tests for User Story 1

- [X] T016 [P] [US1] Add type tests for main-entry `ChatThreadManager` and `ChatThread` imports in `tests/types/chat-thread-types.test.ts`
- [X] T017 [P] [US1] Add type tests for `./managers/chat-thread` subpath imports in `tests/types/chat-thread-types.test.ts`
- [X] T018 [P] [US1] Add unit tests for `ChatClient.use(ChatThreadManager)` exposing `client.chatThreadManager` in `tests/unit/managers/chat-thread-manager.test.ts`
- [X] T019 [P] [US1] Add docs comment completeness expectation for ChatThread manager/entity/types in `tests/contract/api-doc-entry-points.contract.test.ts`
- [X] T020 [P] [US1] Record E2E/demo discovery coverage basis for ChatThread manager registration in `specs/046-chat-thread-public-api/tasks.md`（依据：`tests/types/chat-thread-types.test.ts` 覆盖 `ChatClient.use(ChatThreadManager)`；真实 demo 仍依赖登录环境手测。）

### Implementation for User Story 1

- [X] T021 [US1] Ensure `ChatThreadManager` and `ChatThread` are exported from the main entry in `src/index.ts`
- [X] T022 [US1] Ensure `ChatThreadManager` and `ChatThread` are exported from the manager subpath in `src/managers/chat-thread/index.ts`
- [X] T023 [US1] Ensure `package.json` exports `./managers/chat-thread` with `types`, `import`, and `require` entries
- [X] T024 [US1] Add bilingual JSDoc for `ChatThreadManager` class and public registration/event methods in `src/managers/chat-thread-manager.ts`
- [X] T025 [US1] Add bilingual JSDoc for `ChatThread` class and public methods in `src/managers/chat-thread/chat-thread.ts`
- [X] T026 [US1] Add ChatThread manager/entity/types to API Reference generation entries in `scripts/api-doc-entry-points.js`
- [X] T027 [US1] Update generated API Reference expectations for ChatThread public entry visibility in `docs/reference/api-reference.zh-CN.md` and `docs/reference/api-reference.en-US.md`

**Checkpoint**: US1 可独立验证开发者能发现、导入、注册 ChatThread 能力，并能在 API Reference 找到公开入口。

---

## Phase 4: User Story 2 - 开发者能完成 Thread 主路径管理 (Priority: P1)

**Goal**: 开发者能通过正式公开 API 完成 Thread 创建、列表、详情、加入、退出、销毁、重命名、成员管理和最后消息查询。

**Independent Test**: 使用 mocked `RestClient` 执行每个公开 REST 方法，断言请求路径、body、operation、参数校验、返回归一和错误包装符合契约。

### Tests for User Story 2

- [X] T028 [P] [US2] Add REST tests for `createChatThread` path, body, operation, response `thread_id` normalization, and required params in `tests/unit/rest/chat-thread-management.test.ts`
- [X] T029 [P] [US2] Add REST tests for `getChatThreadList` and `getJoinedChatThreadList` path variants, default page size, cursor, and parentId handling in `tests/unit/rest/chat-thread-management.test.ts`
- [X] T030 [P] [US2] Add REST tests for `getChatThreadInfo` server field normalization including `thread_id`, `group_id`, `msgId`, `affiliations_count`, and `last_message` in `tests/unit/rest/chat-thread-management.test.ts`
- [X] T031 [P] [US2] Add REST tests for `joinChatThread`, `leaveChatThread`, `destroyChatThread`, and `updateChatThreadName` operations in `tests/unit/rest/chat-thread-management.test.ts`
- [X] T032 [P] [US2] Add REST tests for `getChatThreadMemberList` and `removeChatThreadMember` with `memberId` mapping and pagination validation in `tests/unit/rest/chat-thread-management.test.ts`
- [X] T033 [P] [US2] Add REST tests for `getChatThreadLastMessageList` empty array, item validation, 20 item limit, and last message normalization in `tests/unit/rest/chat-thread-management.test.ts`
- [X] T034 [P] [US2] Add manager-level tests for all REST methods using `runOperation` and preserving `SDKError` instances in `tests/unit/managers/chat-thread-manager.test.ts`
- [X] T035 [P] [US2] Add integration test for `ChatClient.use(ChatThreadManager)` REST context and operation mapping in `tests/integration/chat-thread/chat-thread-rest.integration.test.ts`
- [X] T036 [P] [US2] Add E2E/API or real-env verification task for create/list/detail/update/destroy Thread main path in `tests/e2e/api/chat-thread.spec.ts`（已新增可启用真实环境 spec；默认需 `EASEMOB_CHAT_THREAD_E2E=1` 与双账号环境。）

### Implementation for User Story 2

- [X] T037 [US2] Align `requestCreateChatThread` with original `threadApi.ts` request path, body fields, resource query, and response normalization in `src/rest/chat-thread-management.ts`
- [X] T038 [US2] Align `requestGetChatThreadList` and `requestGetJoinedChatThreadList` path/query behavior with original `threadApi.ts` in `src/rest/chat-thread-management.ts`
- [X] T039 [US2] Align `requestGetChatThreadInfo` field normalization for detail responses in `src/rest/chat-thread-management.ts`
- [X] T040 [US2] Align `requestJoinChatThread`, `requestLeaveChatThread`, `requestDestroyChatThread`, and `requestUpdateChatThreadName` operation metadata in `src/rest/chat-thread-management.ts`
- [X] T041 [US2] Align member list and member removal behavior using public `memberId` while mapping to server user path in `src/rest/chat-thread-management.ts`
- [X] T042 [US2] Align last-message batch validation and message summary normalization in `src/rest/chat-thread-management.ts`
- [X] T043 [US2] Replace inline import return type for `getChatThreadInfo` with a named public type import in `src/managers/chat-thread-manager.ts`
- [X] T044 [US2] Ensure every `client.request` call uses an operation key matching `src/rest/api-errors.json` in `src/rest/chat-thread-management.ts`

**Checkpoint**: US2 可独立验证所有 Thread REST 主路径 API 可用、类型稳定、返回标准化且错误包装一致。

---

## Phase 5: User Story 3 - 开发者能使用 ChatThread 实体对象 (Priority: P2)

**Goal**: 开发者能通过 `getChatThread(chatThreadId)` 获取实体对象，并用实体方法完成单 Thread 上下文操作，避免重复传入 Thread ID。

**Independent Test**: 获取同一个 ID 的实体对象，验证实例复用、空 ID 校验、所有实体方法代理到 manager 且参数正确。

### Tests for User Story 3

- [X] T045 [P] [US3] Add unit tests for `getChatThread` ID trimming, empty ID `ValidationError`, and registry reuse in `tests/unit/managers/chat-thread-manager.test.ts`
- [X] T046 [P] [US3] Add unit tests for `ChatThread.getInfo`, `refresh`, `join`, `leave`, `destroy`, `updateName`, `getMemberList`, and `removeMember` proxy calls in `tests/unit/managers/chat-thread.test.ts`
- [X] T047 [P] [US3] Add type tests for `ChatThread` entity methods and `RemoveChatThreadMemberParams` omission behavior in `tests/types/chat-thread-types.test.ts`
- [X] T048 [P] [US3] Add docs example type check or fixture for `ChatThread` entity examples in `tests/types/chat-thread-doc-examples.test.ts`
- [X] T049 [P] [US3] Record E2E/demo reuse basis for ChatThread entity operations in `specs/046-chat-thread-public-api/tasks.md`（依据：demo Thread 面板通过 `chatThreadManager.getChatThread(...).getInfo()` 覆盖实体调用入口；真实操作依赖登录和 Thread fixture。）

### Implementation for User Story 3

- [X] T050 [US3] Ensure `ChatThread` constructor and `chatThreadId` public field remain stable in `src/managers/chat-thread/chat-thread.ts`
- [X] T051 [US3] Ensure `ChatThread` methods proxy to manager methods with correct `chatThreadId` in `src/managers/chat-thread/chat-thread.ts`
- [X] T052 [US3] Decide whether to add `getDetail()` alias; if not adding it, remove all `getDetail()` examples from `docs/integration/thread.md`
- [X] T053 [US3] Add bilingual JSDoc examples for each `ChatThread` entity method in `src/managers/chat-thread/chat-thread.ts`
- [X] T054 [US3] Update `docs/integration/thread.md` entity section to use `thread.getInfo()` and `thread.refresh()` only

**Checkpoint**: US3 可独立验证 ChatThread 实体对象行为、类型提示和文档示例一致。

---

## Phase 6: User Story 4 - 开发者能可靠监听移动端对齐的 Thread 事件 (Priority: P2)

**Goal**: 开发者能监听移动端对齐的 4 个 Thread 事件；旧 `onChatThreadChange` 不公开不派发；非公开 Thread 分支不误派发。

**Independent Test**: 模拟 Thread raw notify，确认 create/delete/update/update_msg/kick 映射到 4 个公开事件，join/leave 和字段不足通知不派发。

### Tests for User Story 4

- [X] T055 [P] [US4] Add event type tests for `onChatThreadCreated`, `onChatThreadDestroyed`, `onChatThreadUpdated`, and `onChatThreadUserRemoved` handler signatures in `tests/types/chat-thread-types.test.ts`
- [X] T056 [P] [US4] Add negative type test proving `onChatThreadChange` is not accepted as a public ChatThread handler in `tests/types/chat-thread-types.test.ts`
- [X] T057 [P] [US4] Add unit tests mapping raw `create` to `onChatThreadCreated` in `tests/unit/chat-client/chat-thread-events.test.ts`
- [X] T058 [P] [US4] Add unit tests mapping raw `delete` to `onChatThreadDestroyed` in `tests/unit/chat-client/chat-thread-events.test.ts`
- [X] T059 [P] [US4] Add unit tests mapping raw `update` and `update_msg` to `onChatThreadUpdated` in `tests/unit/chat-client/chat-thread-events.test.ts`
- [X] T060 [P] [US4] Add unit tests mapping current-user removal raw notify to `onChatThreadUserRemoved` in `tests/unit/chat-client/chat-thread-events.test.ts`
- [X] T061 [P] [US4] Add unit tests proving raw `join`, `leave`, unrelated operation, and missing `chatThreadId` or `parentId` do not dispatch public Thread events in `tests/unit/chat-client/chat-thread-events.test.ts`
- [X] T062 [P] [US4] Add MessageReceiver tests for Thread raw notify routing without directly exposing raw notify as public API in `tests/unit/core/message/message-receiver-thread.test.ts`
- [X] T063 [P] [US4] Add integration tests for `MessageReceiver -> ChatThreadManager -> EventHub` 4-event chain in `tests/integration/chat-thread/chat-thread-events.integration.test.ts`
- [X] T064 [P] [US4] Add demo/E2E event log verification for 4 public Thread events or record real-env limitations in `tests/e2e/api/chat-thread.spec.ts`（E2E spec 已覆盖 4 事件采集；真实运行仍需显式环境开关。）

### Implementation for User Story 4

- [X] T065 [US4] Replace `CHAT_THREAD_CHANGE` and `ChatThreadChangeEvent` public model with 4 public event payload interfaces in `src/types/chat-thread.ts`
- [X] T066 [US4] Update `ChatThreadEventHandlerMap` to include only the 4 public event handlers in `src/types/chat-thread.ts`
- [X] T067 [US4] Update `EventPayloadMap`, `ChatThreadEventHandlerMap`, and related event name types for 4 public events in `src/types/event-system.ts`
- [X] T068 [US4] Update `ChatThreadManager.addEventHandler` typing to accept the 4 public event handlers in `src/managers/chat-thread-manager.ts`
- [X] T069 [US4] Replace `buildChatThreadChangeEvent` with raw notify mapper producing one of the 4 public event payloads in `src/managers/chat-thread-manager.ts`
- [X] T070 [US4] Update `ChatThreadManager.handleRawNotify` to dispatch `onChatThreadCreated`, `onChatThreadDestroyed`, `onChatThreadUpdated`, or `onChatThreadUserRemoved` only in `src/managers/chat-thread-manager.ts`
- [X] T071 [US4] Keep raw notify types internal and hide them from public API Reference in `src/types/chat-thread.ts`
- [X] T072 [US4] Ensure `MessageReceiver` continues routing Thread raw notify only when `rawNotify:chatThread` capability is registered in `src/core/message/message-receiver.ts`
- [X] T073 [US4] Update demo event registration and logs for 4 public Thread events in `demo/src/App.tsx` and `demo/src/components/ChatThreadPanel.tsx`

**Checkpoint**: US4 可独立验证移动端对齐事件模型、旧聚合事件移除和非公开 Thread 分支不派发。

---

## Phase 7: User Story 5 - 开发者能通过文档处理错误和边界 (Priority: P3)

**Goal**: 开发者能通过 API Reference、错误码文档和集成文档理解所有 ChatThread 方法、事件、参数限制、权限前提和错误处理。

**Independent Test**: 运行 docs/error checks，确认 ChatThread API Reference 完整生成、错误码表覆盖所有 operation/localErrors、集成文档示例与类型一致。

### Tests for User Story 5

- [X] T074 [P] [US5] Add or update error governance tests for all ChatThread operation keys and `localErrors` in `tests/unit/rest/chat-thread-management.test.ts`
- [X] T075 [P] [US5] Add API Reference entry tests proving ChatThread manager/entity/types are included and raw notify is excluded in `tests/contract/api-doc-entry-points.contract.test.ts`
- [X] T076 [P] [US5] Add docs example type tests for `docs/integration/thread.md` snippets in `tests/types/chat-thread-doc-examples.test.ts`
- [X] T077 [P] [US5] Add demo smoke or E2E task for Thread panel primary actions and event logs in `tests/e2e/api/chat-thread.spec.ts`
- [X] T078 [P] [US5] Record real-env validation prerequisites for Thread create/update/destroy and event verification in `specs/046-chat-thread-public-api/quickstart.md`

### Implementation for User Story 5

- [X] T079 [US5] Populate `src/rest/api-errors.json` entries for `createChatThread`, `getChatThreadList`, `getJoinedChatThreadList`, `getChatThreadInfo`, `joinChatThread`, `leaveChatThread`, `destroyChatThread`, `updateChatThreadName`, `getChatThreadMemberList`, `removeChatThreadMember`, and `getChatThreadLastMessageList`
- [X] T080 [US5] Add `localErrors` for ChatThread public methods and parameter validation cases in `src/rest/api-errors.json`
- [X] T081 [US5] Add operation aliases for ChatThread public methods if required in `scripts/api-error-operation-aliases.js`
- [X] T082 [US5] Add bilingual JSDoc examples, parameter descriptions, return descriptions, and error notes for all `ChatThreadManager` public methods in `src/managers/chat-thread-manager.ts`
- [X] T083 [US5] Add bilingual JSDoc field comments for all ChatThread parameter, result, summary, member, last-message, and event payload types in `src/types/chat-thread.ts`
- [X] T084 [US5] Regenerate API error docs into `docs/reference/errors.md`, `docs/reference/api-error-reference.md`, and `docs/reference/typedoc-error-codes.md`
- [X] T085 [US5] Regenerate API Reference Markdown and HTML for zh-CN and en-US outputs in `docs/reference/api-reference.zh-CN.md`, `docs/reference/api-reference.en-US.md`, and `docs-site/api/`
- [X] T086 [US5] Fix `docs/integration/thread.md` examples for `memberId`, `thread.getInfo()`, 4 public events, and real Thread message-send support
- [X] T087 [US5] Update `demo/src/components/ChatThreadPanel.tsx` labels and logs to match public method names and 4 event model
- [X] T088 [US5] Update `packages/websdk2-ai-kit/src/references/generated/integration/thread.md` if generated references are part of release artifacts

**Checkpoint**: US5 可独立验证 ChatThread 错误码、API Reference、集成文档和 demo 与公开契约一致。

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: 全量验证、文档收尾、版本治理和提交。

- [X] T089 [P] Update `specs/046-chat-thread-public-api/quickstart.md` with final command results and any real-env limitations
- [X] T090 [P] Update `specs/046-chat-thread-public-api/contracts/chat-thread-public-api.openapi.yaml` if final method names, event payloads, or validation rules differ from implementation
- [X] T091 [P] Search and remove stale public references to `onChatThreadChange`, `event.operation`, `thread.getDetail()`, and `userId` member removal in `src/`, `tests/`, `demo/`, `docs/`, `README.md`, and `packages/websdk2-ai-kit/src/references/generated/`
- [X] T092 Run targeted unit tests for ChatThread REST, manager, entity, event, and MessageReceiver paths in `tests/unit/rest/chat-thread-management.test.ts`, `tests/unit/managers/chat-thread-manager.test.ts`, `tests/unit/managers/chat-thread.test.ts`, `tests/unit/chat-client/chat-thread-events.test.ts`, and `tests/unit/core/message/message-receiver-thread.test.ts`
- [X] T093 Run ChatThread type and contract tests in `tests/types/chat-thread-types.test.ts`, `tests/types/chat-thread-doc-examples.test.ts`, `tests/contract/manager-exports.contract.test.ts`, and `tests/contract/api-doc-entry-points.contract.test.ts`
- [X] T094 Run ChatThread integration tests in `tests/integration/chat-thread/`（已通过 `chat-thread-events.integration.test.ts`；`chat-thread-rest.integration.test.ts` 普通沙箱因 `127.0.0.1` 监听 EPERM，提升权限后通过。）
- [X] T095 Run browser/API E2E or record real-env substitute validation for `tests/e2e/api/chat-thread.spec.ts`（已新增 `EASEMOB_CHAT_THREAD_E2E=1` 条件启用的真实环境 E2E；当前默认跳过以避免无 fixture 环境误跑。）
- [X] T096 Run docs and error governance checks `npm run docs:api:check` and `npm run errors:check`
- [X] T097 Run core gates `npm run test:run`, `npm run lint`, `npm run type-check`, and `npm run test:gate:pr`（`test:run` 普通沙箱因 integration mock server 监听 `127.0.0.1` 报 EPERM；`test:gate:pr` 提升权限重跑通过。）
- [X] T098 Update version in `package.json` and `package-lock.json`
- [X] T099 Update release notes for 046 ChatThread public API in `CHANGELOG.md`
- [X] T100 Review `git diff` to ensure unrelated workspace changes are not included
- [X] T101 Create final Chinese git commit for 046 ChatThread public API changes

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 可立即开始
- **Phase 2 (Foundational)**: 依赖 Phase 1 完成，且阻塞所有 user story
- **Phase 3 (US1)**: 依赖 Phase 2；建议作为 MVP 先完成
- **Phase 4 (US2)**: 依赖 Phase 2；可与 US1 部分并行，但公开 REST 文档最终依赖 US1 导出稳定
- **Phase 5 (US3)**: 依赖 Phase 2；可与 US2 并行推进 entity 测试和实现
- **Phase 6 (US4)**: 依赖 Phase 2；事件类型会影响 US1/API Reference，建议在 US1 后尽早完成
- **Phase 7 (US5)**: 依赖 US1-US4 的公开 surface 稳定
- **Phase 8 (Polish)**: 依赖已选 user story 完成

### User Story Dependencies

- **US1 发现并注册 ChatThread 能力**: MVP；先交付公开导出、注册和 API docs entry
- **US2 Thread 主路径管理**: REST 主能力；依赖基础类型，和 US3/US4 可并行测试不同文件
- **US3 ChatThread 实体对象**: 依赖 manager 方法签名稳定；可与 US2 并行补 facade 测试
- **US4 移动端对齐事件**: 依赖基础事件类型；需要在 US5 文档生成前完成
- **US5 文档处理错误和边界**: 依赖公开 API 和事件模型稳定；负责错误码、API Reference、集成文档和 demo 收口

### Within Each User Story

- 新增或修改测试任务先完成，并确认初始失败符合预期
- 类型定义先于 manager/entity 实现
- REST adapter 测试先于 REST adapter 修正
- Event payload/type 测试先于 raw notify mapper 修正
- 错误码结构化来源先于 API Reference 生成
- 文档与 demo 更新在 public API 形状稳定后完成

### Parallel Opportunities

- T001-T007 audit tasks can run in parallel
- T011-T015 foundational docs/type/contract tasks can run in parallel after T008-T010 are scoped
- T016-T020 US1 tests can run in parallel
- T028-T036 US2 tests can run in parallel by REST method group
- T045-T049 US3 tests can run in parallel
- T055-T064 US4 tests can run in parallel by event case
- T074-T078 US5 tests/docs validation setup can run in parallel
- T089-T091 polish documentation checks can run in parallel before final gates

---

## Parallel Example: User Story 2

```bash
Task: "T028 Add createChatThread REST tests in tests/unit/rest/chat-thread-management.test.ts"
Task: "T029 Add list REST tests in tests/unit/rest/chat-thread-management.test.ts"
Task: "T030 Add detail normalization REST tests in tests/unit/rest/chat-thread-management.test.ts"
Task: "T033 Add last-message validation REST tests in tests/unit/rest/chat-thread-management.test.ts"
```

## Parallel Example: User Story 4

```bash
Task: "T057 Add raw create -> onChatThreadCreated tests in tests/unit/chat-client/chat-thread-events.test.ts"
Task: "T058 Add raw delete -> onChatThreadDestroyed tests in tests/unit/chat-client/chat-thread-events.test.ts"
Task: "T059 Add raw update/update_msg -> onChatThreadUpdated tests in tests/unit/chat-client/chat-thread-events.test.ts"
Task: "T060 Add current-user removal -> onChatThreadUserRemoved tests in tests/unit/chat-client/chat-thread-events.test.ts"
```

## Parallel Example: User Story 5

```bash
Task: "T074 Add error governance tests in tests/unit/rest/chat-thread-management.test.ts"
Task: "T075 Add API docs entry contract tests in tests/contract/api-doc-entry-points.contract.test.ts"
Task: "T076 Add docs example type tests in tests/types/chat-thread-doc-examples.test.ts"
Task: "T077 Add Thread panel E2E smoke in tests/e2e/api/chat-thread.spec.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1
4. Validate imports, registration, export contract, and API Reference entry coverage
5. Stop and review public surface before changing REST/events

### Incremental Delivery

1. Setup + Foundational -> public types and event names stable
2. US1 -> developer can discover/register ChatThread
3. US2 -> REST main paths become officially usable
4. US3 -> entity facade becomes officially usable
5. US4 -> event model matches mobile 4-event contract
6. US5 -> errors/docs/demo/API Reference complete
7. Polish -> gates, version, changelog, commit

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: US2 REST contract and adapter
   - Developer B: US4 event model and raw notify mapper
   - Developer C: US5 docs/error/API Reference scaffolding
3. US1 and US3 are small surface tasks and can be completed early to stabilize imports and entity facade
4. Final integration owner runs docs/error gates and full validation

## Notes

- `[P]` tasks use different files or independent test cases and can run in parallel.
- `[USx]` labels map directly to spec user stories.
- Any implementation that changes public API must update JSDoc, API Reference, error docs, tests, version, and CHANGELOG before final commit.
- Existing unrelated workspace changes must not be reverted or included accidentally.
