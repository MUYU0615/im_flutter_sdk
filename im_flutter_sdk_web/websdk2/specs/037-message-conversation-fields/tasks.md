# Tasks: 消息模型替换 channel 为会话字段

**Input**: Design documents from `/specs/037-message-conversation-fields/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/message-conversation-fields.md, quickstart.md

**Tests**: 本 feature 修改公开消息模型和核心消息链路，必须覆盖 unit、integration、E2E、types 与 docs gate。新增测试应先写并在实现前失败。

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Planning Artifacts)

**Purpose**: Lock the planning artifacts and shared migration references before code work starts.

- [x] T001 Review and align 037 contract examples in `specs/037-message-conversation-fields/contracts/message-conversation-fields.md`
- [x] T002 [P] Review 037 data model field names in `specs/037-message-conversation-fields/data-model.md`
- [x] T003 [P] Review migration examples and validation commands in `specs/037-message-conversation-fields/quickstart.md`
- [x] T004 [P] Confirm generated agent context includes 037 in `AGENTS.md`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared type and mapping foundation that MUST be complete before any user story implementation.

**CRITICAL**: No user story implementation should start until this phase is complete.

- [x] T005 Add shared message conversation locator helpers and protocol mapping functions in `src/types/message-conversation.ts`
- [x] T006 Export `ChatConversationType` / message conversation locator types and remove public `ChannelReference` / `ChannelType` exports in `src/types/index.ts`
- [x] T007 Update SDK root export surface to remove public channel types in `src/index.ts`
- [x] T008 [P] Update imports that only need conversation types in `src/types/message-create.ts`
- [x] T009 [P] Add type-level assertions for removed public channel exports in `tests/types/message-conversation-fields.d.ts`
- [x] T010 Run initial type-check to capture expected failures from old `channel` references using `package.json`

**Checkpoint**: Public type direction is fixed; story work can now migrate concrete chains.

---

## Phase 3: User Story 1 - 使用统一会话字段创建和发送消息 (Priority: P1) MVP

**Goal**: All `createXMessage` methods accept `conversationId/conversationType`, output messages without `channel`, and sending maps new fields into protocol targets.

**Independent Test**: Create single, group and chatroom messages with new fields; send them through mocked MSync sender and verify target/type mapping without using `channel`.

### Tests for User Story 1

- [x] T011 [P] [US1] Add text message creation tests for `conversationId/conversationType` in `tests/unit/message/create-text-message.test.ts`
- [x] T012 [P] [US1] Add media/location/cmd/custom creation tests for new fields in `tests/unit/message/create-media-message.test.ts` and `tests/unit/message/create-cmd-custom-message.test.ts`
- [x] T013 [P] [US1] Add combine message creation tests for parent and child new fields in `tests/unit/message/create-combine-message.test.ts`
- [x] T014 [P] [US1] Add validation tests rejecting missing `conversationId` / invalid `conversationType` / non-group `receiverList` in `tests/unit/message/create-text-message.test.ts`
- [x] T015 [P] [US1] Add MSync send mapping tests for single/group/chatroom targets in `tests/unit/core/message/message-sender.test.ts`
- [x] T016 [P] [US1] Add integration test for `chatManager.createXMessage + chatManager.sendMessage` new fields in `tests/integration/chat-manager/message-send-conversation-fields.integration.test.ts`

### Implementation for User Story 1

- [x] T017 [US1] Replace `CreateMessageBaseParams.channel` with `conversationId/conversationType` in `src/types/message-create.ts`
- [x] T018 [US1] Replace `channelReferenceSchema` with conversation locator schema and receiverList rule in `src/validators/message-create.ts`
- [x] T019 [US1] Update `buildMessage` and all create message functions to output new fields in `src/message/create-message.ts`
- [x] T020 [US1] Update combine constraints and payload encoding to read child `conversationId/conversationType` in `src/message/combine-message-constraints.ts` and `src/message/combine-payload-codec.ts`
- [x] T021 [US1] Update `Message` and `CombineMessageItem` public interfaces in `src/types/index.ts`
- [x] T022 [US1] Update `MsyncCodec.encodeChatMessage` send target, message type, route type and directed-users logic in `src/protocol/msync/codec.ts`
- [x] T023 [US1] Update `MessageSender` logging and ACK status handling to use new fields in `src/core/message/message-sender.ts`
- [x] T024 [US1] Update `ChatManager` message validation from `message.channel.type` to `message.conversationType` in `src/managers/chat-manager.ts`

**Checkpoint**: User Story 1 is functional; message creation and send path no longer require `channel`.

---

## Phase 4: User Story 2 - 接收消息和消息事件只暴露 conversationId/conversationType (Priority: P1)

**Goal**: All decoded messages and message event payloads expose `conversationId/conversationType` and never expose public `channel`.

**Independent Test**: Decode single, group and chatroom fixtures; assert `onMessage`, `onMessageStatus` and message action payloads use the new fields.

### Tests for User Story 2

- [x] T025 [P] [US2] Add MSync decode tests for single/group/chatroom messages in `tests/unit/core/message/message-receiver.test.ts`
- [x] T026 [P] [US2] Add chatroom decode regression tests for `conversationType: 'chatRoom'` in `tests/unit/core/message/message-receiver-chatroom.test.ts`
- [x] T027 [P] [US2] Add stream and combine event payload tests for new fields in `tests/unit/core/message/stream-message-single-full.test.ts` and `tests/unit/core/message/combine-message-receiver.test.ts`
- [x] T028 [P] [US2] Add message action event payload tests for read/recall/update/reaction/pin locators in `tests/unit/core/message/message-receiver-chat-actions.test.ts`
- [x] T029 [P] [US2] Add ChatClient event typing tests that reject `message.channel` in `tests/types/chat-client-events.d.ts`
- [x] T030 [P] [US2] Add integration event test for inbound message dispatch with new fields in `tests/integration/chat-manager/message-events-conversation-fields.integration.test.ts`

### Implementation for User Story 2

- [x] T031 [US2] Update `MsyncCodec.decodeChatMessage` to emit `conversationId/conversationType` in `src/protocol/msync/codec.ts`
- [x] T032 [US2] Update action message context helpers to use new message fields in `src/protocol/msync/codec.ts`
- [x] T033 [US2] Update message context memory and event dispatch context in `src/core/message/message-receiver.ts`
- [x] T034 [US2] Update stream handler/cache message assumptions in `src/core/message/stream-message-handler.ts` and `src/core/message/stream-message-cache.ts`
- [x] T035 [US2] Update event payload public types to remove channel usage in `src/types/event-system.ts`
- [x] T036 [US2] Update ChatClient event bridge and incoming message handling to use new fields in `src/chat-client.ts`

**Checkpoint**: User Stories 1 and 2 work independently; send and receive public messages share the same model.

---

## Phase 5: User Story 3 - 会话缓存、上传、历史消息和资料同步统一使用 canonical conversationType (Priority: P2)

**Goal**: Upload, cache, history, combine detail and profile sync chains all derive message ownership from `conversationId/conversationType`.

**Independent Test**: Send/receive messages through upload and cache paths; verify upload headers, conversation summary keys and profile sync queues use new fields.

### Tests for User Story 3

- [x] T037 [P] [US3] Add upload target tests for simple and multipart upload using new fields in `tests/unit/core/message/message-sender.test.ts`
- [x] T038 [P] [US3] Add attachment downloader tests for messages without `channel` in `tests/unit/core/message/attachment-downloader.test.ts`
- [x] T039 [P] [US3] Add conversation cache update tests from new message fields in `tests/unit/cache/conversation-cache.test.ts`
- [x] T040 [P] [US3] Add message queue filter tests replacing `getByChannel` expectations in `tests/unit/core/message/message-queue.test.ts`
- [x] T041 [P] [US3] Add profile sync hydration tests for group messages using `conversationType` in `tests/unit/chat-client/profile-sync-enable-user-info-sync.test.ts`
- [x] T042 [P] [US3] Add integration test for attachment upload + conversation update using new fields in `tests/integration/chat-manager/message-auxiliary.integration.test.ts`

### Implementation for User Story 3

- [x] T043 [US3] Update upload request types to replace `channel` with `conversationId/conversationType` in `src/upload/types.ts`
- [x] T044 [US3] Update attachment upload preparation and headers in `src/upload/attachment-uploader.ts`
- [x] T045 [US3] Update simple upload target mapping in `src/upload/simple-upload.ts`
- [x] T046 [US3] Update multipart upload target mapping in `src/upload/multipart-upload.ts`
- [x] T047 [US3] Replace upload chat type helper input with `ChatConversationType` in `src/upload/utils.ts`
- [x] T048 [US3] Update conversation summary derivation from message fields in `src/cache/cache-manager.ts`
- [x] T049 [US3] Rename or replace message queue channel lookup with conversation lookup in `src/core/message/message-queue.ts`
- [x] T050 [US3] Update attachment download and combine download message assumptions in `src/core/message/attachment-downloader.ts` and `src/core/message/combine-message-downloader.ts`
- [x] T051 [US3] Update profile sync group namecard logic in `src/chat-client.ts` and `src/core/message/profile-sync/latest-message-version-projector.ts`
- [x] T052 [US3] Update protobuf message schema/encoder/decoder if still public-message-shaped in `src/protocol/protobuf/messages.proto`, `src/protocol/protobuf/encoder.ts`, and `src/protocol/protobuf/decoder.ts`

**Checkpoint**: Core side effects no longer read `message.channel`; uploads, cache and profile sync use canonical conversation fields.

---

## Phase 6: User Story 4 - 升级用户获得明确迁移边界和文档 (Priority: P2)

**Goal**: Docs, demo, examples and migration notes show the new message model and no public example constructs `channel`.

**Independent Test**: Run docs/api checks and demo E2E; grep public docs and demo for old message creation shape.

### Tests for User Story 4

- [x] T053 [P] [US4] Add browser E2E coverage for send flow using new fields in `tests/e2e/message-actions.spec.ts`
- [x] T054 [P] [US4] Update E2E send helper selectors and message construction assumptions in `tests/e2e/fixtures/sdk-flow.ts`
- [x] T055 [P] [US4] Add docs/API validation expectation for new message examples in `tests/types/chat-manager-events.d.ts`
- [x] T056 [P] [US4] Add miniapp demo integration coverage for new message creation fields in `tests/integration/miniapp-demo/message-send.integration.test.ts`

### Implementation for User Story 4

- [x] T057 [US4] Update Web demo send panel to create messages with `conversationId/conversationType` in `demo/src/components/SendPanel.tsx`
- [x] T058 [US4] Update ChatManager demo fixture message creation in `demo/src/components/ChatManagerPanel.tsx`
- [x] T059 [US4] Update profile sync demo message rendering from `message.channel` to new fields in `demo/src/components/ProfileSyncPanel.tsx`
- [x] T060 [US4] Update public API reference examples for message creation in `docs/reference/api-reference.zh-CN.md` and `docs/reference/chat-manager-api.md`
- [x] T061 [US4] Add migration notes for `channel.channelId/type` to `conversationId/conversationType` in `README.md`
- [x] T062 [US4] Update generated or source JSDoc comments for public message types in `src/types/index.ts` and `src/types/message-create.ts`

**Checkpoint**: Upgrade path is documented; demo and public examples no longer use old `channel` message shape.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, cleanup and release governance.

- [x] T063 [P] Remove stale channel-based imports and dead helpers from `src/types/channel.ts`
- [x] T064 [P] Grep and update remaining public `message.channel` usages in `src/`, `tests/`, `demo/`, and `docs/`
- [x] T065 [P] Run unit and integration tests via `npm run test:run` from `package.json`
- [x] T066 [P] Run type checking via `npm run type-check` from `package.json`
- [x] T067 [P] Run lint via `npm run lint` from `package.json`
- [x] T068 [P] Run API docs check via `npm run docs:api:check` from `package.json`
- [x] T069 Run E2E verification via `npm run test:e2e` from `package.json`
- [x] T070 Update version and breaking-change entry after implementation in `package.json`, `package-lock.json`, `packages/websdk2-ai-kit/package.json`, and `CHANGELOG.md`
- [x] T071 Re-run Speckit consistency analysis for 037 using `specs/037-message-conversation-fields/spec.md`
- [x] T072 Commit final implementation with Chinese commit message using `CHANGELOG.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: No dependencies.
- **Phase 2 Foundational**: Depends on Phase 1 and blocks all user stories.
- **US1 (Phase 3)**: Depends on Phase 2 and is the MVP.
- **US2 (Phase 4)**: Depends on Phase 2; can run in parallel with US1 after shared type helpers exist, but final event payloads depend on `Message` type from US1.
- **US3 (Phase 5)**: Depends on Phase 2; practically easier after US1/US2 because upload/cache paths consume the migrated `Message`.
- **US4 (Phase 6)**: Depends on migrated public API from US1 and event/rendering behavior from US2/US3.
- **Polish**: Depends on selected user stories and should run before release commit.

### User Story Dependencies

- **US1**: Independent MVP after foundational phase.
- **US2**: Independent for decode/event behavior after foundational phase, but final compile requires US1 message type migration.
- **US3**: Independent side-effect validation after foundational phase, but relies on new message fields being available.
- **US4**: Documentation/demo story; depends on final public shape from US1 and public events from US2.

### Within Each User Story

- Write unit/type/integration/E2E tests first and confirm they fail on old `channel` model.
- Implement type/model changes before call-site changes.
- Implement protocol/upload/cache mapping before demo/docs cleanup.
- Run targeted tests at each checkpoint before moving to the next story.

## Parallel Opportunities

- T002-T004 can run in parallel.
- T008-T009 can run in parallel after T005-T007 are scoped.
- US1 test tasks T011-T016 can run in parallel.
- US2 test tasks T025-T030 can run in parallel.
- US3 test tasks T037-T042 can run in parallel.
- US4 test and documentation tasks T053-T062 can be split by demo/docs/types owner.
- Final validation commands T065-T068 can run in parallel if the environment supports it.

## Parallel Example: User Story 1

```text
Task: "Add text message creation tests for conversationId/conversationType in tests/unit/message/create-text-message.test.ts"
Task: "Add media/location/cmd/custom creation tests for new fields in tests/unit/message/create-media-message.test.ts and tests/unit/message/create-cmd-custom-message.test.ts"
Task: "Add MSync send mapping tests for single/group/chatroom targets in tests/unit/core/message/message-sender.test.ts"
```

## Parallel Example: User Story 3

```text
Task: "Update attachment upload preparation and headers in src/upload/attachment-uploader.ts"
Task: "Update conversation summary derivation from message fields in src/cache/cache-manager.ts"
Task: "Update profile sync group namecard logic in src/chat-client.ts and src/core/message/profile-sync/latest-message-version-projector.ts"
```

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2.
2. Complete US1 only.
3. Validate `createXMessage + sendMessage` with new fields.
4. Stop and review before migrating receive/cache/demo chains.

### Incremental Delivery

1. US1: creation/send model.
2. US2: receive/events model.
3. US3: upload/cache/history/profile side effects.
4. US4: docs/demo/migration.
5. Polish: global grep, docs gate, E2E and release governance.

### Risk Controls

- Do not add compatibility transforms for `channel`.
- Do not introduce a second public alias such as `chatType`.
- Keep server protocol mapping private.
- Keep each story independently testable with concrete unit/integration/type/E2E tasks.
