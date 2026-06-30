# Tasks: ChatClient Multi-Device Listener

**Input**: Design documents from `/specs/042-multi-device-listener/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/multi-device-listener.md, quickstart.md

**Tests**: 本功能新增公开 ChatClient 事件、协议 notify 归一和跨模块派发链路，必须落 unit、integration、types、E2E API 测试；真实多设备服务触发不可稳定时，必须用 fixture 覆盖并在 quickstart 记录真实环境限制。

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Single SDK project: `src/`, `tests/`, `specs/`, `docs/` at repository root

## Phase 1: Setup (Shared Planning and References)

**Purpose**: Lock protocol references, mobile operation mapping, and existing event-system constraints before implementation.

- [ ] T001 [P] Review Android MultiDevice documentation and record operation mapping notes in `specs/042-multi-device-listener/contracts/multi-device-listener.md`
- [ ] T002 [P] Review mobile `EMMultiDevicesListener` references under `/Users/zhangdong/code/emclient-linux/src` and update mapping gaps in `specs/042-multi-device-listener/research.md`
- [ ] T003 [P] Review old Web SDK mSync multi-device handling in `/Users/zhangdong/code/websdk-new/packages/IM/sdk/src/engineCore/mSync.ts` and document reusable protocol fields in `specs/042-multi-device-listener/research.md`
- [ ] T004 [P] Review current ChatClient event typing and EventHub dispatch behavior in `src/types/event-system.ts`, `src/chat-client.ts`, and `src/core/events/event-hub.ts`
- [ ] T005 [P] Review current ROSTER/MUC/NOTIFY decode paths in `src/protocol/msync/codec.ts` and notify dispatch paths in `src/core/message/message-receiver.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared public contracts, constants, and pure normalizer entry points that MUST be complete before user-story implementation.

**CRITICAL**: No user story implementation should begin until these shared types and event names are stable.

- [X] T006 Define MultiDevice operation unions, payload interfaces, and handler map types in `src/types/multi-device.ts`
- [X] T007 Add `onMultiDeviceContact`, `onMultiDeviceGroup`, `onMultiDeviceThread`, `onMultiDeviceConversation`, and `onMultiDeviceMessageRemoved` event names and payload mappings in `src/types/event-system.ts`
- [X] T008 Export MultiDevice public types from `src/types/index.ts` and `src/index.ts`
- [X] T009 [P] Add type-level coverage for ChatClient MultiDevice handlers in `tests/types/chat-client-multi-device-events.d.ts`
- [X] T010 [P] Add MultiDevice fixture builders for ROSTER, MUC, thread, conversation, and message-removed notifies in `tests/unit/multi-device/multi-device-fixtures.ts`
- [X] T011 [P] Add pure helper skeleton for device-source normalization and same-device checks in `src/protocol/msync/multi-device-normalizer.ts`
- [X] T012 [P] Add unit test skeleton for device-source normalization in `tests/unit/multi-device/multi-device-normalizer.test.ts`

**Checkpoint**: Public event names, payload types, exports, and fixture entry points are ready.

---

## Phase 3: User Story 1 - 统一订阅多设备事件 (Priority: P1) MVP

**Goal**: Business applications can subscribe to current-account other-device operations through ChatClient category callbacks and receive standardized payloads.

**Independent Test**: Feed representative decoded notify fixtures into the SDK path and verify the matching ChatClient MultiDevice callback receives the normalized payload.

### Tests for User Story 1

- [X] T013 [P] [US1] Unit test contact MultiDevice operation mapping and required fields in `tests/unit/multi-device/multi-device-contact.test.ts`
- [X] T014 [P] [US1] Unit test group MultiDevice operation mapping, related user IDs, and deviceId normalization in `tests/unit/multi-device/multi-device-group.test.ts`
- [X] T015 [P] [US1] Unit test thread MultiDevice operation mapping and parent/thread IDs in `tests/unit/multi-device/multi-device-thread.test.ts`
- [X] T016 [P] [US1] Unit test conversation MultiDevice pin/mark/mute/delete mapping in `tests/unit/multi-device/multi-device-conversation.test.ts`
- [X] T017 [P] [US1] Unit test message-removed payload requires `messageIds` or `beforeTimestamp` in `tests/unit/multi-device/multi-device-message-removed.test.ts`
- [X] T018 [P] [US1] Unit test same-device echo filtering and missing device source behavior in `tests/unit/multi-device/multi-device-normalizer.test.ts`
- [X] T019 [P] [US1] Integration test codec -> MessageReceiver -> ChatClient handler for one contact, group, thread, conversation, and message-removed fixture in `tests/integration/multi-device/multi-device-listener.integration.test.ts`
- [X] T020 [P] [US1] E2E API test all five MultiDevice handler names can be registered and removed in `tests/e2e/api/multi-device.spec.ts`

### Implementation for User Story 1

- [X] T021 [US1] Implement device-source normalization and same-device filter helpers in `src/protocol/msync/multi-device-normalizer.ts`
- [X] T022 [US1] Implement contact MultiDevice operation normalization from ROSTER payloads in `src/protocol/msync/multi-device-normalizer.ts`
- [X] T023 [US1] Implement group MultiDevice operation normalization from non-chatroom MUC payloads in `src/protocol/msync/multi-device-normalizer.ts`
- [X] T024 [US1] Implement thread MultiDevice operation normalization from thread notify payloads in `src/protocol/msync/multi-device-normalizer.ts`
- [X] T025 [US1] Implement conversation MultiDevice operation normalization from conversation notify payloads in `src/protocol/msync/multi-device-normalizer.ts`
- [X] T026 [US1] Implement message-removed MultiDevice normalization with `messageIds` / `beforeTimestamp` validation in `src/protocol/msync/multi-device-normalizer.ts`
- [X] T027 [US1] Integrate MultiDevice normalized notify output into `src/protocol/msync/codec.ts`
- [X] T028 [US1] Dispatch MultiDevice notify events through `src/core/message/message-receiver.ts`
- [X] T029 [US1] Add sanitized debug/warn logs for unknown or discarded MultiDevice operations in `src/protocol/msync/multi-device-normalizer.ts`

**Checkpoint**: US1 works independently: all five category callbacks can receive normalized MultiDevice events.

---

## Phase 4: User Story 2 - 与现有业务事件边界清晰 (Priority: P1)

**Goal**: Existing business events stay backward-compatible, and MultiDevice events become the authoritative source for cross-device metadata.

**Independent Test**: Existing event payload type tests continue to pass, while new MultiDevice events carry optional `deviceId` without requiring existing business events to add it.

### Tests for User Story 2

- [ ] T030 [P] [US2] Type test existing `ConnectionEventHandlerMap` and ChatClient business events still reject unrelated chat handlers in `tests/types/chat-client-events.d.ts`
- [X] T031 [P] [US2] Type test existing contact/group/thread/conversation business payloads are not required to include `deviceId` in `tests/types/chat-client-multi-device-events.d.ts`
- [ ] T032 [P] [US2] Unit regression test group `source: 'multiDevice'` compatibility remains unchanged in `tests/unit/group/group-event-mapper.test.ts`
- [ ] T033 [P] [US2] Unit regression test existing contact roster events still dispatch original payloads in `tests/unit/core/message/message-receiver-contact.test.ts`
- [ ] T034 [P] [US2] Integration test same upstream fixture can dispatch business event and MultiDevice event without requiring business payload `deviceId` in `tests/integration/multi-device/multi-device-boundary.integration.test.ts`
- [ ] T035 [P] [US2] E2E API regression test existing offline sync and connection handlers still register after MultiDevice handler additions in `tests/e2e/api/auth.spec.ts`

### Implementation for User Story 2

- [ ] T036 [US2] Keep `ChatClient.addEventHandler` signature backward-compatible while accepting MultiDevice callbacks in `src/chat-client.ts` and `src/types/event-system.ts`
- [ ] T037 [US2] Ensure existing contact/group/thread/conversation notify handlers in `src/core/message/message-receiver.ts` continue to dispatch their current business events
- [ ] T038 [US2] Ensure existing group mapper compatibility fields such as `source: 'multiDevice'` are preserved in `src/managers/group/group-event-mapper.ts`
- [ ] T039 [US2] Add explicit comments or internal docs explaining business-event versus MultiDevice-event boundaries in `src/types/multi-device.ts`
- [ ] T040 [US2] Update API reference or public docs for the compatibility boundary in `docs/reference/api-reference.zh-CN.md` and `docs/reference/api-reference.en-US.md`

**Checkpoint**: US2 works independently: existing applications compile and existing business event semantics remain unchanged.

---

## Phase 5: User Story 3 - 覆盖移动端已有多设备事件集合 (Priority: P2)

**Goal**: SDK maintainers have a complete Web operation list aligned with mobile MultiDevice capabilities, including unsupported chatroom scope and reserved/unknown behavior.

**Independent Test**: Operation unions, docs tables, and fixture tests show every supported mobile operation is mapped or explicitly documented as unsupported/not applicable.

### Tests for User Story 3

- [X] T041 [P] [US3] Type test operation unions are exhaustively switchable for all five categories in `tests/types/chat-client-multi-device-events.d.ts`
- [X] T042 [P] [US3] Unit test unsupported chatroom MUC payloads never produce MultiDevice events in `tests/unit/multi-device/multi-device-group.test.ts`
- [X] T043 [P] [US3] Unit test unknown operation maps to `UNKNOWN` or is safely discarded with a log in `tests/unit/multi-device/multi-device-normalizer.test.ts`
- [X] T044 [P] [US3] Integration test all category fixtures include mobile operation names in raw/diagnostic data where available in `tests/integration/multi-device/multi-device-listener.integration.test.ts`
- [X] T045 [P] [US3] E2E or quickstart task records real-env availability for each category in `specs/042-multi-device-listener/quickstart.md`

### Implementation for User Story 3

- [ ] T046 [US3] Complete mobile-to-Web operation mapping table in `src/types/multi-device.ts`
- [ ] T047 [US3] Ensure chatroom operations are explicitly excluded in `src/protocol/msync/multi-device-normalizer.ts`
- [ ] T048 [US3] Preserve raw protocol operation/category diagnostics without exposing unstable protocol fields as required business fields in `src/protocol/msync/multi-device-normalizer.ts`
- [ ] T049 [US3] Update `contracts/multi-device-listener.md` with final operation coverage and unsupported chatroom status
- [X] T050 [US3] Update `quickstart.md` with real-env coverage status or backlog notes for each MultiDevice category

**Checkpoint**: US3 works independently: operation coverage is complete and documented.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, gates, release hygiene, and final validation.

- [ ] T051 [P] Add bilingual JSDoc for MultiDevice public types and handler payloads in `src/types/multi-device.ts`
- [ ] T052 [P] Update root API export documentation for MultiDevice types in `src/index.ts` and `src/types/index.ts`
- [ ] T053 [P] Update E2E API coverage matrix for MultiDevice handlers in `docs/testing/e2e-api-coverage.md`
- [ ] T054 [P] Update public API review matrix for ChatClient MultiDevice callbacks in `docs/reference/websdk2-api-review-matrix.md`
- [X] T055 Run targeted unit/type tests for 042 using `npm run test:run -- tests/unit/multi-device tests/types`
- [X] T056 Run targeted integration tests using `npm run test:run -- tests/integration/multi-device`
- [X] T057 Run E2E API tests using `npm run test:e2e:api -- tests/e2e/api/multi-device.spec.ts`
- [X] T058 Run `npm run type-check` from `package.json`
- [X] T059 Run `npm run lint` from `package.json`
- [X] T060 Run `npm run docs:api:check` or record the explicit blocker in `specs/042-multi-device-listener/quickstart.md`
- [X] T061 Update `CHANGELOG.md`, `package.json`, and `package-lock.json` after implementation verification
- [ ] T062 Commit implementation with a Chinese commit message using `git commit`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: No dependencies.
- **Phase 2 Foundational**: Depends on Phase 1 and blocks all user stories.
- **US1 (Phase 3)**: Depends on Phase 2 and is the MVP.
- **US2 (Phase 4)**: Depends on Phase 2; can run alongside US1 after event types exist, but final regression validation should happen after US1 dispatch lands.
- **US3 (Phase 5)**: Depends on Phase 2; can proceed in parallel for docs/type coverage, but final operation coverage depends on US1 normalizers.
- **Polish**: Depends on selected user stories and should run before release commit.

### User Story Dependencies

- **US1**: Independent MVP after foundational types and fixtures.
- **US2**: Independent compatibility story after event type surface exists; validates no regression to existing business events.
- **US3**: Independent coverage/documentation story after operation unions are defined.

### Within Each User Story

- Write unit/type/integration/E2E tests first and confirm they fail for missing MultiDevice implementation.
- Implement public types before dispatch code.
- Implement normalizer pure functions before wiring codec and receiver.
- Integrate codec before MessageReceiver dispatch.
- Update docs and quickstart after behavior and operation names stabilize.

## Parallel Opportunities

- T001-T005 can run in parallel.
- T009-T012 can run in parallel after T006-T008 are scoped.
- US1 unit tests T013-T018 can run in parallel.
- US2 regression tests T030-T035 can run in parallel.
- US3 docs/type tests T041-T045 can run in parallel.
- Polish docs tasks T051-T054 can run in parallel after public names stabilize.

## Parallel Example: User Story 1

```text
Task: "T013 Unit test contact MultiDevice operation mapping in tests/unit/multi-device/multi-device-contact.test.ts"
Task: "T014 Unit test group MultiDevice operation mapping in tests/unit/multi-device/multi-device-group.test.ts"
Task: "T015 Unit test thread MultiDevice operation mapping in tests/unit/multi-device/multi-device-thread.test.ts"
Task: "T019 Integration test codec -> receiver -> ChatClient handler in tests/integration/multi-device/multi-device-listener.integration.test.ts"
```

## Parallel Example: User Story 2

```text
Task: "T031 Type test business payloads do not require deviceId in tests/types/chat-client-multi-device-events.d.ts"
Task: "T032 Unit regression test group source compatibility in tests/unit/group/group-event-mapper.test.ts"
Task: "T034 Integration test business event and MultiDevice event boundary in tests/integration/multi-device/multi-device-boundary.integration.test.ts"
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2.
2. Complete US1 only.
3. Validate five category callbacks through unit and integration fixtures.
4. Stop and review public payload shape before expanding docs/E2E.

### Incremental Delivery

1. US1: public event surface and dispatch.
2. US2: compatibility boundary and regression tests.
3. US3: full operation coverage and docs.
4. Polish: docs, E2E API, gates, version, changelog, commit.

### Risk Controls

- Do not add `deviceId` requirements to existing business event payloads.
- Do not map chatroom operations into MultiDevice events.
- Do not trigger implicit full refreshes from MultiDevice dispatch.
- Do not expose unstable protocol numeric operation as the primary public operation.
- Keep same-device filtering based on source resource only when upstream provides it.
