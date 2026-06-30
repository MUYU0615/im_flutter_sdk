# Tasks: ChatManager 事件面收敛

**Input**: Design documents from `/specs/043-chat-manager-event-cleanup/`
**Prerequisites**: `plan.md`、`spec.md`、`research.md`、`data-model.md`、`contracts/chat-manager-event-cleanup.md`、`quickstart.md`

**Tests**: 本功能按 spec 要求必须包含 unit、integration、type 测试；E2E 复用现有 API/浏览器用例，不新增专门 E2E。

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 明确当前事件面、测试位置和文档引用，避免实现阶段遗漏旧事件名。

- [X] T001 [P] Audit current ChatManager event type definitions in `src/types/event-system.ts`
- [X] T002 [P] Audit current message dispatch and send-status paths in `src/core/message/message-receiver.ts` and `src/core/message/message-sender.ts`
- [X] T003 [P] Audit public docs containing removed event names in `docs/reference/api.md`, `docs/reference/chat-manager-api.md`, `docs/reference/websdk2-api-review-chat-manager.md`, and `docs/reference/sdk-naming-conventions.md`
- [X] T004 [P] Audit existing tests for removed event names in `tests/unit/core/message/`, `tests/integration/`, `tests/types/`, and `tests/e2e/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 收敛公开事件类型和共享事件 contract，后续所有 user story 依赖该基础。

**CRITICAL**: No user story implementation should start until this phase is complete.

- [X] T005 Remove `COMBINE_MESSAGE`, `MESSAGE_STATUS`, and `MESSAGE_PIN_CHANGE` from `ChatEventName` in `src/types/event-system.ts`
- [X] T006 Remove `onCombineMessage`, `onMessageStatus`, and `onMessagePinChange` from `EventPayloadMap` in `src/types/event-system.ts`
- [X] T007 Update `ChatEventPayloadMap` and `ChatEventHandlerMap` typing in `src/types/event-system.ts` so removed event names are not accepted by ChatManager handlers
- [X] T008 [P] Update retained event type assertions in `tests/types/chat-manager-events.d.ts` for `onMessage`, `onStreamMessage`, and `onPinnedMessageChanged`
- [X] T009 [P] Add negative type assertions for removed ChatManager events in `tests/types/chat-manager-events.d.ts`

**Checkpoint**: 公开事件类型面已收敛，后续实现不再能使用被移除的公开事件名。

---

## Phase 3: User Story 1 - 合并消息统一从 onMessage 接收 (Priority: P1) MVP

**Goal**: 普通非流式消息和合并消息都通过 `onMessage` 接收，合并消息仅通过 `message.type === 'combine'` 识别。

**Independent Test**: 注册 `onMessage` 后接收 combine 消息，应收到标准 `Message`；`onStreamMessage` 保持不受影响；旧 `onCombineMessage` 不再存在。

### Tests for User Story 1

- [X] T010 [P] [US1] Update combine receive unit test to expect `onMessage` in `tests/unit/core/message/combine-message-receiver.test.ts`
- [X] T011 [P] [US1] Add unit regression that ordinary non-stream messages and combine messages both dispatch `onMessage` in `tests/unit/core/message/message-receiver.test.ts`
- [X] T012 [P] [US1] Add integration coverage for combine message through ChatManager handler in `tests/integration/mock/chat-manager-public-api.test.ts`
- [X] T013 [US1] Record E2E reused-coverage basis for combine message event cleanup in `tests/e2e/api/public-api-coverage-matrix.md`

### Implementation for User Story 1

- [X] T014 [US1] Update `dispatchMessage` to dispatch combine messages through `onMessage` in `src/core/message/message-receiver.ts`
- [X] T015 [US1] Remove all implementation references to `ChatEventName.COMBINE_MESSAGE` from `src/core/message/message-receiver.ts`
- [X] T016 [US1] Verify combine message still keeps `message.type === 'combine'` and existing combine payload fields in `src/types/index.ts`

**Checkpoint**: User Story 1 can be validated independently by unit and integration tests for combine messages.

---

## Phase 4: User Story 2 - 发送状态不再作为全局公开事件暴露 (Priority: P1)

**Goal**: 删除公开 `onMessageStatus`，发送状态继续通过 `sendMessage` options 回调和 Promise 表达，内部 sent 上下文不回退。

**Independent Test**: `sendMessage` 的 `onSending/onSuccess/onFailed` 仍触发；外部 handler 不能注册 `onMessageStatus`；撤回/编辑/置顶等依赖 sent 上下文的通知仍可定位会话。

### Tests for User Story 2

- [X] T017 [P] [US2] Update send-status unit tests to assert options callbacks instead of `onMessageStatus` in `tests/unit/core/message/message-sender.test.ts`
- [X] T018 [P] [US2] Add unit test for internal sent context recording without public `onMessageStatus` in `tests/unit/core/message/message-receiver-chat-actions.test.ts`
- [X] T019 [P] [US2] Update session-list or send-path tests that dispatch `onMessageStatus` in `tests/unit/managers/chat-manager-session-list.test.ts`
- [X] T020 [P] [US2] Add integration coverage that `chatManager.sendMessage` forwards options callbacks in `tests/integration/mock/chat-manager-public-api.test.ts`
- [X] T021 [US2] Record E2E reused-coverage basis for send outcome behavior in `tests/e2e/api/public-api-coverage-matrix.md`

### Implementation for User Story 2

- [X] T022 [US2] Remove public `ChatEventName.MESSAGE_STATUS` dispatches from `src/core/message/message-sender.ts`
- [X] T023 [US2] Preserve `options.onSending`, `options.onSuccess`, and `options.onFailed` behavior in `src/core/message/message-sender.ts`
- [X] T024 [US2] Replace `MessageReceiver` constructor dependency on `ChatEventName.MESSAGE_STATUS` with an internal sent-context mechanism in `src/core/message/message-receiver.ts`
- [X] T025 [US2] Connect ACK success handling to the internal sent-context mechanism from `src/core/message/message-sender.ts` or the owning core wiring
- [X] T026 [US2] Remove all remaining runtime references to public `onMessageStatus` from `src/core/`, `src/managers/`, and `src/types/`

**Checkpoint**: User Story 2 can be validated independently by send-path unit tests, type tests, and action-notification context tests.

---

## Phase 5: User Story 3 - 消息置顶事件只保留一个公开名称 (Priority: P1)

**Goal**: 保留 `onPinnedMessageChanged` 作为唯一消息置顶变化事件，删除 `onMessagePinChange`。

**Independent Test**: 本地 pin/unpin 和远端 pin/unpin 通知仍触发 `onPinnedMessageChanged`；`onMessagePinChange` 不能注册也不会出现在文档中。

### Tests for User Story 3

- [X] T027 [P] [US3] Update pin event type tests in `tests/types/chat-manager-events.d.ts`
- [X] T028 [P] [US3] Verify local pin/unpin integration tests still use `onPinnedMessageChanged` in `tests/integration/chat-manager/message-interactions.integration.test.ts`
- [X] T029 [P] [US3] Verify remote pin notify unit tests still use `onPinnedMessageChanged` in `tests/unit/core/message/message-receiver-chat-actions.test.ts`
- [X] T030 [US3] Confirm existing E2E pin/unpin coverage remains on `onPinnedMessageChanged` in `tests/e2e/api/chat-manager-advanced.spec.ts`

### Implementation for User Story 3

- [X] T031 [US3] Remove `MessagePinMutationResult` import if it only served `onMessagePinChange` in `src/types/event-system.ts`
- [X] T032 [US3] Remove `MESSAGE_PIN_CHANGE` from event constants and payload maps in `src/types/event-system.ts`
- [X] T033 [US3] Preserve local `PINNED_MESSAGE_CHANGED` dispatch in `src/managers/chat-manager.ts`
- [X] T034 [US3] Preserve remote `PINNED_MESSAGE_CHANGED` dispatch in `src/core/message/message-receiver.ts`

**Checkpoint**: User Story 3 can be validated independently by type tests, integration tests, and existing E2E pin/unpin tests.

---

## Phase 6: User Story 4 - 流式消息事件保持现状 (Priority: P2)

**Goal**: `onStreamMessage` 保持公开且行为不变，流式消息不进入 `onMessage`。

**Independent Test**: 注册 `onStreamMessage` 后仍收到流式分片；流式消息继续不触发 `onMessage`；乱序、去重、完成和错误语义保持。

### Tests for User Story 4

- [X] T035 [P] [US4] Verify `onStreamMessage` remains accepted by type tests in `tests/types/stream-event-types.test.ts`
- [X] T036 [P] [US4] Keep stream regression test expecting no `onMessage` dispatch in `tests/unit/core/message/message-receiver-stream-regression.test.ts`
- [X] T037 [P] [US4] Run existing stream behavior tests in `tests/unit/core/message/stream-message-ordering.test.ts`, `tests/unit/core/message/stream-message-dedup.test.ts`, and `tests/unit/core/message/stream-message-fallback-full.test.ts`
- [X] T038 [US4] Record E2E reused-coverage basis for stream event retention in `tests/e2e/api/public-api-coverage-matrix.md`

### Implementation for User Story 4

- [X] T039 [US4] Ensure `ChatEventName.STREAM_MESSAGE` and `onStreamMessage` payload typing remain in `src/types/event-system.ts`
- [X] T040 [US4] Ensure `MessageReceiver.dispatchMessage` still routes `isStreamMessage(message)` to `StreamMessageHandler` in `src/core/message/message-receiver.ts`
- [X] T041 [US4] Ensure `StreamMessageHandler` still dispatches `ChatEventName.STREAM_MESSAGE` in `src/core/message/stream-message-handler.ts`

**Checkpoint**: User Story 4 can be validated independently by stream type and stream unit tests.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 文档、发布治理、全量验证和提交。

- [X] T042 [P] Remove removed event names from active ChatManager docs in `docs/reference/chat-manager-api.md`
- [X] T043 [P] Remove removed event names from API review matrix in `docs/reference/websdk2-api-review-chat-manager.md`
- [X] T044 [P] Remove removed event examples from public API docs in `docs/reference/api.md`
- [X] T045 [P] Remove obsolete removed-event naming guidance from `docs/reference/sdk-naming-conventions.md`
- [X] T046 [P] Search and remove remaining public-doc mentions of removed events in `docs/reference/`
- [X] T047 Update version according to breaking public API policy in `package.json`
- [X] T048 Update release notes for removed events in `CHANGELOG.md`
- [X] T049 Run targeted tests from `specs/043-chat-manager-event-cleanup/quickstart.md`
- [X] T050 Run full validation gates `npm run test:run`, `npm run lint`, `npm run type-check`, and `npm run docs:api:check`（已执行；`npm run test:run` 仅剩既有 `user-info-manager.contract` operationId 不一致失败）
- [X] T051 Review `git diff` to ensure unrelated existing workspace changes are not included
- [X] T052 Create final Chinese git commit for 043 event cleanup changes

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - blocks all user stories
- **US1 / US2 / US3 / US4**: Depend on Foundational phase completion
- **Polish (Phase 7)**: Depends on completed desired user stories

### User Story Dependencies

- **US1 合并消息统一从 onMessage 接收**: Can start after Foundational; MVP scope
- **US2 发送状态不再作为全局公开事件暴露**: Can start after Foundational; independent but touches shared sender/receiver files
- **US3 消息置顶事件只保留一个公开名称**: Can start after Foundational; independent but shares `event-system.ts`
- **US4 流式消息事件保持现状**: Can start after Foundational; should be verified after US1 because both touch `dispatchMessage`

### Within Each User Story

- Tests should be updated or added before implementation when feasible
- Type tests must fail before event type implementation changes are complete
- `src/types/event-system.ts` changes should be coordinated because US1/US2/US3/US4 all rely on the same event map
- `src/core/message/message-receiver.ts` changes in US1, US2, and US4 must be sequenced carefully
- Documentation updates happen after code and tests confirm the final event surface

---

## Parallel Opportunities

- T001-T004 can run in parallel
- T008-T009 can run in parallel after T005-T007 are planned, because they touch type tests only
- T010-T013 can run in parallel within US1
- T017-T021 can run in parallel within US2
- T027-T030 can run in parallel within US3
- T035-T038 can run in parallel within US4
- T042-T046 can run in parallel after implementation stabilizes

---

## Parallel Example: User Story 1

```bash
Task: "Update combine receive unit test to expect onMessage in tests/unit/core/message/combine-message-receiver.test.ts"
Task: "Add integration coverage for combine message through ChatManager handler in tests/integration/mock/chat-manager-public-api.test.ts"
Task: "Record E2E reused-coverage basis in tests/e2e/api/public-api-coverage-matrix.md"
```

## Parallel Example: User Story 2

```bash
Task: "Update send-status unit tests in tests/unit/core/message/message-sender.test.ts"
Task: "Update session-list send-path tests in tests/unit/managers/chat-manager-session-list.test.ts"
Task: "Add integration coverage in tests/integration/mock/chat-manager-public-api.test.ts"
```

## Parallel Example: User Story 3

```bash
Task: "Update pin event type tests in tests/types/chat-manager-events.d.ts"
Task: "Verify local pin/unpin integration tests in tests/integration/chat-manager/message-interactions.integration.test.ts"
Task: "Confirm E2E pin/unpin coverage in tests/e2e/api/chat-manager-advanced.spec.ts"
```

## Parallel Example: User Story 4

```bash
Task: "Verify stream type tests in tests/types/stream-event-types.test.ts"
Task: "Keep stream regression test in tests/unit/core/message/message-receiver-stream-regression.test.ts"
Task: "Run existing stream behavior tests in tests/unit/core/message/stream-message-ordering.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational event type cleanup
3. Complete Phase 3: US1 combine messages through `onMessage`
4. Validate US1 unit/integration/type tests
5. Stop and review before touching send-status internals

### Incremental Delivery

1. Setup + Foundational -> final public event type surface
2. US1 -> combine messages use `onMessage`
3. US2 -> public send-status event removed, send options retained
4. US3 -> pin event canonicalized to `onPinnedMessageChanged`
5. US4 -> stream event retention verified
6. Polish -> docs, version, changelog, validation, commit

### Parallel Team Strategy

With multiple developers:

1. One developer owns `src/types/event-system.ts` and type tests first
2. One developer owns message receiver changes for US1/US4
3. One developer owns send-status internals for US2
4. One developer owns docs and E2E coverage matrix after implementation stabilizes

## Notes

- [P] tasks = different files, no dependency on incomplete same-file edits
- Avoid editing unrelated dirty files already present in the workspace
- This feature is a breaking public API cleanup; version and changelog updates are mandatory before commit
- Do not add migration guidance for removed events; docs should completely remove those names
