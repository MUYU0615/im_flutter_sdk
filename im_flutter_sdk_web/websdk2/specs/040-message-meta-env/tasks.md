# Tasks: 消息 webhookEnv 出站路由字段

**Input**: Design documents from `/specs/040-message-meta-env/`
**Prerequisites**: plan.md, spec.md

**Tests**: 本 feature 涉及公开消息创建入参、协议编码和 demo 发送面板，必须覆盖 unit 测试，并提供 demo UI 验证路径；实现后需完成 `type-check` 与 `test:run`。

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Path Conventions

- SDK source: `src/`
- Demo source: `demo/src/`
- Tests: `tests/`
- Planning docs: `specs/040-message-meta-env/`

## Phase 1: Setup (Shared Context)

**Purpose**: Freeze implementation scope and inspect current message create/send/demo surfaces before edits.

- [ ] T001 [P] Review current public message types and create params in `src/types/index.ts` and `src/types/message-create.ts`
- [ ] T002 [P] Review current message creation and validation flow in `src/message/create-message.ts` and `src/validators/message-create.ts`
- [ ] T003 [P] Review current MSync outbound encoding path in `src/protocol/msync/proto-source.json`, `src/protocol/msync/proto.ts`, and `src/protocol/msync/codec.ts`
- [ ] T004 [P] Review current demo send form and message creation path in `demo/src/components/SendPanel.tsx`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Put the shared protocol and type foundation in place before story-level behavior work.

**CRITICAL**: No user story implementation should begin until these core contracts are aligned.

- [ ] T005 Add `Meta.env` field with id `13` to `src/protocol/msync/proto-source.json`
- [ ] T006 Sync `Meta.env` field with id `13` in `src/protocol/msync/proto.ts`
- [ ] T007 Add `webhookEnv?: string` to public `Message` in `src/types/index.ts`
- [ ] T008 Add `webhookEnv?: string` to `CreateMessageBaseParams` in `src/types/message-create.ts`
- [ ] T009 [P] Allow optional string `webhookEnv` in create-message validation schema in `src/validators/message-create.ts`
- [ ] T010 [P] Confirm SDK root export surface still exposes updated create-message parameter types through `src/index.ts`

**Checkpoint**: Protocol definition, public message type, and base create params all include `webhookEnv`.

---

## Phase 3: User Story 1 - 创建消息与出站编码支持 webhookEnv (Priority: P1) MVP

**Goal**: All message creation entrypoints and direct `sendMessage(message)` path support `webhookEnv`, and outbound chat encoding writes `Meta.env`.

**Independent Test**: Create a text message with `webhookEnv`, encode/send it, and assert the decoded `CommSyncUL.meta.env` matches the original value.

### Tests for User Story 1

- [ ] T011 [P] [US1] Add create-message unit coverage for `webhookEnv` normal value, empty string, and omitted value in `tests/unit/message/create-text-message.test.ts`
- [ ] T012 [P] [US1] Add protocol encoding unit coverage for `Meta.env` in `tests/unit/protocol/need-group-read-receipt-codec.test.ts` or a dedicated `tests/unit/protocol/message-meta-env.test.ts`
- [ ] T013 [P] [US1] Add at least one non-text create-message regression test proving shared base params carry `webhookEnv` in `tests/unit/message/create-media-message.test.ts` or `tests/unit/message/create-cmd-custom-message.test.ts`

### Implementation for User Story 1

- [ ] T014 [US1] Pass `params.webhookEnv` through shared `buildMessage()` in `src/message/create-message.ts`
- [ ] T015 [US1] Encode `message.webhookEnv` into `Meta.env` in `src/protocol/msync/codec.ts`
- [ ] T016 [US1] Ensure direct public `Message` send path remains compatible when `message.webhookEnv` is `undefined` or `''` by reviewing `src/core/message/message-sender.ts` and `src/managers/chat-manager.ts`

**Checkpoint**: SDK public create/send path supports `webhookEnv` end-to-end for outbound messages.

---

## Phase 4: User Story 2 - Demo 发送面板可填写 webhookEnv (Priority: P2)

**Goal**: Demo users can input `webhookEnv` from the send panel and have it flow into the corresponding `createXMessage(...)` call.

**Independent Test**: Fill `webhookEnv` in the demo send panel, send a text message, and confirm the built message log contains the same `webhookEnv`.

### Tests for User Story 2

- [ ] T017 [P] [US2] Add or update demo verification notes for `webhookEnv` send flow in `specs/040-message-meta-env/tasks.md` execution record or follow-up quick verification notes
- [ ] T018 [P] [US2] If there is existing demo integration coverage, extend it to assert `webhookEnv` is passed through in `tests/integration/miniapp-demo/message-send.integration.test.ts` or another relevant demo test file when applicable

### Implementation for User Story 2

- [ ] T019 [US2] Add `webhookEnv` input state, change handler, and form field UI in `demo/src/components/SendPanel.tsx`
- [ ] T020 [US2] Include `webhookEnv` in the shared message creation params for text/image/voice/video/file/location/cmd/custom/combine paths in `demo/src/components/SendPanel.tsx`
- [ ] T021 [US2] Ensure clearing the demo `webhookEnv` input does not block sending and continues to map empty input to an optional outbound field in `demo/src/components/SendPanel.tsx`

**Checkpoint**: Demo UI can drive the new SDK field without code changes outside the panel.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Final verification, release hygiene, and repository-specific closeout.

- [ ] T022 [P] Grep for remaining message-creation surfaces that should mention `webhookEnv` in `src/`, `demo/`, and `tests/`
- [ ] T023 [P] Run targeted unit tests for message creation and protocol encoding using `npm run test:run -- tests/unit/message/create-text-message.test.ts tests/unit/protocol/need-group-read-receipt-codec.test.ts`
- [ ] T024 [P] Run full type check using `npm run type-check`
- [ ] T025 [P] Run broader regression suite using `npm run test:run`
- [ ] T026 Record demo UI manual verification result for `webhookEnv` send flow in `specs/040-message-meta-env/plan.md` or implementation notes referenced from this feature directory
- [ ] T027 Update version and changelog after verification in `package.json`, `package-lock.json`, `packages/websdk2-ai-kit/package.json`, and `CHANGELOG.md`
- [ ] T028 Commit final implementation with a Chinese commit message after all required validation is complete

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: No dependencies
- **Phase 2 Foundational**: Depends on Phase 1 and blocks all user stories
- **US1 (Phase 3)**: Depends on Phase 2; this is the MVP
- **US2 (Phase 4)**: Depends on Phase 2 and practically on US1 because demo must target the stabilized SDK field
- **Polish (Phase 5)**: Depends on selected user stories being implemented

### User Story Dependencies

- **US1**: Independent MVP after foundational work
- **US2**: Depends on the SDK field existing and being stable in US1

### Within Each User Story

- Add tests first where practical and confirm they fail without implementation
- Update shared base types before call sites
- Update protocol definition before relying on runtime encode assertions
- Wire demo UI after SDK field is available
- Run targeted verification before moving to full-suite validation

## Parallel Opportunities

- T001-T004 can run in parallel
- T009-T010 can run in parallel after T005-T008 are scoped
- US1 test tasks T011-T013 can run in parallel
- T019 and T020 can be split if one task handles UI state and the other handles message param plumbing in `SendPanel.tsx`
- Validation tasks T023-T025 can run sequentially after implementation stabilizes

## Parallel Example: User Story 1

```text
Task: "Add create-message unit coverage for webhookEnv in tests/unit/message/create-text-message.test.ts"
Task: "Add protocol encoding unit coverage for Meta.env in tests/unit/protocol/need-group-read-receipt-codec.test.ts"
Task: "Add non-text create-message webhookEnv regression coverage in tests/unit/message/create-media-message.test.ts"
```

## Implementation Strategy

### MVP First

1. Complete Phase 1 and Phase 2.
2. Complete US1 only.
3. Validate `createXMessage + encodeChatMessage` carries `webhookEnv`.
4. Stop and review the SDK behavior before touching demo UI.

### Incremental Delivery

1. US1: SDK public type, create params, validation, outbound encoding
2. US2: demo send panel input and param plumbing
3. Polish: targeted tests, full verification, changelog/version, Chinese commit

### Risk Controls

- Do not accidentally expand the feature into inbound `webhookEnv` decode
- Do not reject empty string `webhookEnv`
- Do not wire demo `webhookEnv` only for text messages and forget the other message types
- Keep `webhookEnv` additive so existing send options continue to work unchanged

