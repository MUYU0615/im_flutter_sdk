# Tasks: ChatClient Token 续期与 RTC Token 能力

**Input**: Design documents from `/specs/039-chatclient-token-rtc/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: 本功能涉及公开 API、连接状态机、事件系统和 REST 鉴权上下文，单元测试与集成测试必需；E2E/真实环境验证需按 quickstart 记录可行性和结果。

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Single SDK project: `src/`, `tests/`, `specs/` at repository root

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prepare shared type, event, REST, and test surfaces before user-story work.

- [X] T001 [P] Review old token renewal and RTC REST references in `/Users/zhangdong/code/websdk-new/packages/IM/sdk/src/engineCore/connection.ts` and `/Users/zhangdong/code/websdk-new/packages/IM/sdk/src/apis/index.ts`
- [X] T002 [P] Review current connection/event/token context surfaces in `src/chat-client.ts`, `src/core/index.ts`, `src/core/connection/connection-manager.ts`, `src/types/connection.ts`, and `src/types/event-system.ts`
- [X] T003 [P] Review current REST helper and manager request patterns in `src/rest/client.ts`, `src/managers/chat-manager.ts`, and `src/managers/push-manager.ts`
- [ ] T004 [P] Create shared test fixtures and fake timers helpers for token lifecycle tests in `tests/unit/chat-client-token-rtc/token-lifecycle-test-utils.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core shared contracts that MUST be complete before ANY user story can be implemented.

**CRITICAL**: No user story implementation should begin until these shared types and constants are in place.

- [X] T005 Define `TokenRenewalResult`, `GetRTCTokenInfoParams`, `RTCTokenInfo`, and `RTCUidUserIdMap` public types in `src/types/chat-client.ts`
- [X] T006 Add `onTokenWillExpire` and `onTokenExpired` event names, payload mappings, and handler typings in `src/types/connection.ts` and `src/types/event-system.ts`
- [X] T007 Export the new public types and event typings from `src/types/index.ts` and `src/index.ts`
- [X] T008 Add `TOKEN_EXPIRED` connection reason or equivalent typed token-expired disconnect reason in `src/types/connection.ts`
- [X] T009 [P] Add validation helpers for non-empty token, RTC channelName, and RTC UID list inputs in `src/validators/chat-client.ts`
- [X] T010 [P] Add REST helper skeletons for token expires, RTC token info, and RTC UID mapping in `src/rest/rtc-token.ts`
- [ ] T011 [P] Add unit test skeletons for public type exports in `tests/unit/types/chat-client-token-rtc.test-d.ts`
- [ ] T012 [P] Add mock REST response fixtures for token expires, RTC token, and RTC UID mapper in `tests/unit/rest/rtc-token.fixtures.ts`

**Checkpoint**: Shared public contracts, validation entry points, and REST helper skeletons are ready.

---

## Phase 3: User Story 1 - 登录态 token 过期前续期 (Priority: P1) MVP

**Goal**: Applications can receive a final-20% token warning and call `renewToken` to update the current IM token without forcing logout.

**Independent Test**: Login with a short-lived token, trigger `onTokenWillExpire`, call `renewToken(newToken)`, then verify subsequent connection and REST contexts use the new token and `renewToken` returns `{ token, expireAt }`.

### Tests for User Story 1

- [X] T013 [P] [US1] Unit test `renewToken` rejects uninitialized, disconnected, empty-token, and expired-token inputs in `tests/unit/chat-client-token-rtc/renew-token.test.ts`
- [X] T014 [P] [US1] Unit test token expires REST normalizer returns `expireAt` and maps invalid responses to `SDKError` in `tests/unit/rest/rtc-token.test.ts`
- [X] T015 [P] [US1] Unit test token lifecycle timers emit `onTokenWillExpire` exactly once when remaining lifecycle enters final 20% in `tests/unit/core/connection/token-lifecycle.test.ts`
- [ ] T016 [P] [US1] Unit type test `renewToken` returns `Promise<TokenRenewalResult>` in `tests/unit/types/chat-client-token-rtc.test-d.ts`
- [ ] T017 [P] [US1] Integration test `renewToken` updates ChatClient REST token, CoreSDK token, ConnectionManager token, and MSync codec context in `tests/integration/chat-client-token-rtc/renew-token.integration.test.ts`
- [ ] T018 [US1] Record E2E/real-env feasibility for token will-expire and renew flow in `specs/039-chatclient-token-rtc/quickstart.md`

### Implementation for User Story 1

- [X] T019 [US1] Implement token expires REST request and response normalization in `src/rest/rtc-token.ts`
- [X] T020 [US1] Add token lifecycle state, will-expire timer, expired timer, and timer cleanup to `src/core/connection/connection-manager.ts`
- [X] T021 [US1] Add `renewToken(token)` support to update ConnectionManager config, connection state, and MSync codec context in `src/core/connection/connection-manager.ts`
- [X] T022 [US1] Expose `renewToken(token)` delegation from `CoreSDK` to `ConnectionManager` in `src/core/index.ts`
- [X] T023 [US1] Implement `ChatClient.renewToken(token)` validation, token expires request, auth context update, CoreSDK delegation, and `TokenRenewalResult` return in `src/chat-client.ts`
- [X] T024 [US1] Ensure `RestClient` instances used by ChatClient-created requests receive the renewed token in `src/chat-client.ts`
- [X] T025 [US1] Add token renewal structured logs without token values in `src/chat-client.ts` and `src/core/connection/connection-manager.ts`

**Checkpoint**: US1 works independently: token warning and renewal path are functional and tested.

---

## Phase 4: User Story 2 - token 过期后明确断开 (Priority: P1)

**Goal**: SDK emits `onTokenExpired`, disconnects the current long connection with a token-expired reason, and does not perform full logout or reconnect with the expired token.

**Independent Test**: Use fake timers to expire the current token and verify `onTokenExpired` fires before disconnected state, old-token reconnect is paused, and registered event handlers remain.

### Tests for User Story 2

- [X] T026 [P] [US2] Unit test token expiration emits `onTokenExpired` once before closing the socket in `tests/unit/core/connection/token-lifecycle.test.ts`
- [ ] T027 [P] [US2] Unit test token-expired disconnect reason is distinct from normal close/offline/error in `tests/unit/chat-client-token-rtc/token-expired-disconnect.test.ts`
- [ ] T028 [P] [US2] Integration test token expiration disconnects without invoking full `logout` cleanup in `tests/integration/chat-client-token-rtc/token-expired.integration.test.ts`
- [ ] T029 [P] [US2] Integration test expired token does not trigger automatic reconnect with old token in `tests/integration/chat-client-token-rtc/token-expired.integration.test.ts`
- [ ] T030 [US2] Record E2E/real-env feasibility for token-expired disconnect flow in `specs/039-chatclient-token-rtc/quickstart.md`

### Implementation for User Story 2

- [X] T031 [US2] Implement token-expired close path that emits `onTokenExpired`, pauses reconnect, closes WebSocket, and updates disconnected state in `src/core/connection/connection-manager.ts`
- [X] T032 [US2] Ensure token-expired close path does not clear ChatClient cache, current user ID, manager registry, or external event handlers in `src/chat-client.ts` and `src/core/connection/connection-manager.ts`
- [X] T033 [US2] Map server-side token-expired provision/auth failures to `onTokenExpired` and token-expired disconnect where applicable in `src/core/connection/connection-manager.ts`
- [X] T034 [US2] Add token-expired reason propagation to `ConnectionEventPayload` dispatch in `src/core/connection/connection-manager.ts`
- [X] T035 [US2] Add token-expired diagnostic logs without token values in `src/core/connection/connection-manager.ts`

**Checkpoint**: US2 works independently: expiration disconnect semantics are explicit and tested.

---

## Phase 5: User Story 3 - 获取 RTC token 信息 (Priority: P2)

**Goal**: Applications can call `ChatClient.getRTCTokenInfo({ channelName? })` and receive lower camelCase RTC join credential fields.

**Independent Test**: With logged-in REST context and mocked RTC token response, verify returned `appId`, `rtcToken`, `channelName`, `rtcUid`, and `expireAt` fields and no raw server wrapper leakage.

### Tests for User Story 3

- [ ] T036 [P] [US3] Unit test `getRTCTokenInfo` parameter validation for optional object and channelName in `tests/unit/chat-client-token-rtc/rtc-token-info.test.ts`
- [X] T037 [P] [US3] Unit test RTC token REST normalizer maps `app_id`, `rtc_token`, `channel_name`, `rtcUid`, and `expires_in` to lower camelCase in `tests/unit/rest/rtc-token.test.ts`
- [ ] T038 [P] [US3] Unit type test `getRTCTokenInfo` accepts optional object params and returns `Promise<RTCTokenInfo>` in `tests/unit/types/chat-client-token-rtc.test-d.ts`
- [ ] T039 [P] [US3] Integration test `getRTCTokenInfo` uses current ChatClient REST context and Bearer token in `tests/integration/chat-client-token-rtc/rtc-token-info.integration.test.ts`
- [X] T040 [US3] Record real-env RTC token validation result or skipped rationale in `specs/039-chatclient-token-rtc/quickstart.md`

### Implementation for User Story 3

- [X] T041 [US3] Implement `requestGetRTCTokenInfo` REST helper in `src/rest/rtc-token.ts`
- [X] T042 [US3] Implement `ChatClient.getRTCTokenInfo(params?)` validation, REST client creation, response normalization, and SDK error propagation in `src/chat-client.ts`
- [X] T043 [US3] Ensure default omitted `channelName` uses service default channel behavior in `src/rest/rtc-token.ts`
- [X] T044 [US3] Add safe operation names and sanitized diagnostics for RTC token requests in `src/rest/rtc-token.ts`

**Checkpoint**: US3 works independently: RTC token info can be fetched and normalized.

---

## Phase 6: User Story 4 - 批量映射 RTC UID 到用户 ID (Priority: P2)

**Goal**: Applications can call `ChatClient.getUserIdsWithRTCUids(rtcUids)` and receive a `Record<RTCUid, userId>` mapping with missing RTC UIDs omitted.

**Independent Test**: With logged-in REST context and mocked partial mapper response, verify invalid input is rejected and partial mappings are returned without failure.

### Tests for User Story 4

- [X] T045 [P] [US4] Unit test RTC UID list validation rejects empty arrays, non-numeric values, negative values, and unsafe integers in `tests/unit/chat-client-token-rtc/rtc-uid-mapping.test.ts`
- [X] T046 [P] [US4] Unit test RTC UID mapper REST normalizer preserves partial mapping objects and omits unknown UIDs in `tests/unit/rest/rtc-token.test.ts`
- [ ] T047 [P] [US4] Unit type test `getUserIdsWithRTCUids` returns `Promise<RTCUidUserIdMap>` in `tests/unit/types/chat-client-token-rtc.test-d.ts`
- [ ] T048 [P] [US4] Integration test `getUserIdsWithRTCUids` posts `{ data: rtcUids }` with current REST auth in `tests/integration/chat-client-token-rtc/rtc-uid-mapping.integration.test.ts`
- [X] T049 [US4] Record real-env RTC UID mapper validation result or skipped rationale in `specs/039-chatclient-token-rtc/quickstart.md`

### Implementation for User Story 4

- [X] T050 [US4] Implement `requestGetUserIdsWithRTCUids` REST helper in `src/rest/rtc-token.ts`
- [X] T051 [US4] Implement `ChatClient.getUserIdsWithRTCUids(rtcUids)` validation, optional dedupe, REST request, response normalization, and SDK error propagation in `src/chat-client.ts`
- [X] T052 [US4] Ensure mapper failures and validation errors do not log IM token or Authorization header in `src/rest/rtc-token.ts` and `src/chat-client.ts`

**Checkpoint**: US4 works independently: RTC UID mapping returns stable partial mapping objects.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, exports, gates, and release hygiene across all user stories.

- [X] T053 [P] Add bilingual JSDoc with examples, parameters, returns, and errors for new ChatClient APIs in `src/chat-client.ts`
- [X] T054 [P] Add bilingual comments for new public types and event payload mappings in `src/types/chat-client.ts`, `src/types/connection.ts`, and `src/types/event-system.ts`
- [ ] T055 [P] Update API reference docs for `renewToken`, `getRTCTokenInfo`, `getUserIdsWithRTCUids`, `onTokenWillExpire`, and `onTokenExpired` in `docs/reference/api.md`
- [ ] T056 [P] Update ChatClient API review matrix for the new public APIs and event callbacks in `docs/reference/websdk2-api-review-matrix.md`
- [ ] T057 [P] Update demo or document no-demo rationale for token lifecycle and RTC helper APIs in `demo/src/App.tsx` or `specs/039-chatclient-token-rtc/quickstart.md`
- [X] T058 Run `npm run type-check` and record result in `specs/039-chatclient-token-rtc/quickstart.md`
- [X] T059 Run `npm run lint` and record result in `specs/039-chatclient-token-rtc/quickstart.md`
- [X] T060 Run targeted tests for 039 and record result in `specs/039-chatclient-token-rtc/quickstart.md`
- [X] T061 Run `npm run test:gate:pr` or record explicit blocker/rationale in `specs/039-chatclient-token-rtc/quickstart.md`
- [X] T062 Run `npm run docs:api:check` and record result in `specs/039-chatclient-token-rtc/quickstart.md`
- [X] T063 Update `CHANGELOG.md`, `package.json`, `package-lock.json`, and `packages/websdk2-ai-kit/package.json` after implementation verification
- [X] T064 Commit implementation with a Chinese commit message after all required validation is complete

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies
- **Foundational (Phase 2)**: Depends on Setup completion; blocks all user stories
- **US1 (Phase 3)**: Depends on Foundational; MVP
- **US2 (Phase 4)**: Depends on Foundational; can run alongside US1 after shared token lifecycle types exist, but final behavior should be validated with US1
- **US3 (Phase 5)**: Depends on Foundational; independent REST helper path
- **US4 (Phase 6)**: Depends on Foundational; independent REST helper path
- **Polish (Phase 7)**: Depends on selected user stories being implemented

### User Story Dependencies

- **US1**: No dependency on other user stories after Foundation
- **US2**: Shares token lifecycle infrastructure with US1; can be tested independently with fake timers
- **US3**: No dependency on US1/US2 except shared REST context and types
- **US4**: No dependency on US1/US2/US3 except shared REST context and types

### Within Each User Story

- Write unit/integration/type tests first and confirm they fail for missing implementation
- Implement REST helpers before ChatClient methods that call them
- Implement connection token state before ChatClient `renewToken`
- Implement event constants/types before dispatching events
- Update quickstart after running or intentionally skipping each validation layer

### Parallel Opportunities

- T001-T004 can run in parallel
- T009-T012 can run in parallel after T005-T008 are understood
- US3 and US4 REST helper work can run in parallel after Foundational
- Documentation tasks T053-T057 can run in parallel after public API signatures stabilize
- Validation tasks T058-T062 should run sequentially after implementation stabilizes

---

## Parallel Example: User Story 1

```bash
# Tests can be prepared in parallel:
Task: "T013 Unit test renewToken validation in tests/unit/chat-client-token-rtc/renew-token.test.ts"
Task: "T014 Unit test token expires normalizer in tests/unit/rest/rtc-token.test.ts"
Task: "T015 Unit test token lifecycle timers in tests/unit/core/connection/token-lifecycle.test.ts"
Task: "T017 Integration test renewToken context update in tests/integration/chat-client-token-rtc/renew-token.integration.test.ts"
```

## Parallel Example: User Stories 3 and 4

```bash
# REST helper tests can be developed independently:
Task: "T037 Unit test RTC token normalizer in tests/unit/rest/rtc-token.test.ts"
Task: "T046 Unit test RTC UID mapper normalizer in tests/unit/rest/rtc-token.test.ts"
Task: "T039 Integration test RTC token auth in tests/integration/chat-client-token-rtc/rtc-token-info.integration.test.ts"
Task: "T048 Integration test RTC UID mapper auth in tests/integration/chat-client-token-rtc/rtc-uid-mapping.integration.test.ts"
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Setup and Foundational tasks.
2. Implement US1 tests and token renewal path.
3. Validate `renewToken` updates all current auth contexts and returns `{ token, expireAt }`.
4. Stop and verify no existing login/send-message behavior regresses.

### Incremental Delivery

1. US1: token will-expire and renewal.
2. US2: token expired event and disconnect semantics.
3. US3: RTC token info helper.
4. US4: RTC UID mapper helper.
5. Polish: docs, demo decision, gates, version, changelog, commit.

### Parallel Team Strategy

- Developer A: US1 token renewal path.
- Developer B: US2 token-expired disconnect path.
- Developer C: US3/US4 REST helper and ChatClient methods.
- One owner should integrate shared types and event names to avoid conflicts.

## Notes

- `[P]` tasks use different files or can be prepared before implementation coupling.
- All public API tasks must include bilingual comments.
- Token values must never be printed in logs or error details.
- Do not implement full `logout` on token expiration.
