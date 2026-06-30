# Public API Coverage Matrix

Last updated: 2026-06-02

This matrix tracks real-environment browser E2E coverage under `tests/e2e/api/`.
It is scoped to public SDK APIs that can be exercised from the browser test harness.
The matrix is intentionally stricter than module-level migration status: an API is only "covered" when the test asserts stable return fields, observable events, or error payloads instead of just checking that the call does not throw.

## Legend

| Status | Meaning |
|--------|---------|
| ✅ Covered | Success path has field-level assertions; error/event assertions are present when applicable. |
| 🟡 Partial | Some success path is covered, but error, event, pagination, or edge behavior is missing or intentionally relaxed. |
| ❌ Missing | No browser real-env API case currently covers this public API. |
| ⏸ Blocked | Coverage depends on missing real-env setup or external service capability. |
| N/A | Not a business API case target, or covered indirectly by the fixture/harness. |

## Current Summary

- Current files: 13 spec files under `tests/e2e/api/`.
- Current cases: 121 Playwright `test(...)` cases.
- Latest targeted runs: `chatroom.spec.ts` -> `17 passed`; `ChatManager`/conversation targeted runs and manager-specific runs are recorded in `CHANGELOG.md`.
- Skipped cases: `chatroom.spec.ts` skips only when `EASEMOB_CHATROOM_ID` is not configured.
- Deferred scope: `ChatThreadManager` is a public manager follow-up phase and is intentionally excluded from the current 041 robot mainline closure.
- Highest remaining non-deferred gaps: uploaded media download/combine download success paths, voice-to-text success paths, remaining validation/error branches, and real-env/SDK behavior mismatches listed in the manager rows.

## Auth / ChatClient

| API | Success | Error | Event | Current Case | Status | Gap / Next Step |
|-----|---------|-------|-------|--------------|--------|-----------------|
| `ChatClient.init` | ✅ | N/A | N/A | `auth.spec.ts`, fixture initialization | ✅ Covered | Keep as harness smoke coverage. |
| `login` | ✅ | ✅ | connection state | `auth.spec.ts` | ✅ Covered | Invalid token is asserted as `ConnectionError(202 AUTH_UNAUTHORIZED)`, `retryable=false`, final `disconnected`, and one connection attempt. |
| `logout` | ✅ | N/A | connection state | `auth.spec.ts` | ✅ Covered | Logged-in, not-logged-in, and repeated logout idempotency are covered. |
| `getConnectionState` | ✅ | N/A | N/A | `auth.spec.ts` | ✅ Covered | No action. |
| `addEventHandler` / `removeEventHandler` | ✅ | N/A | direct `onMessage`, `onOfflineMessageSyncStart`, `onOfflineMessageSyncFinish` | `auth.spec.ts`, `fixtures/sdk-api.ts` | ✅ Covered | Direct add/remove is covered by sending messages and asserting removed handlers receive no second event; offline-message sync start/finish handler registration is covered through the ChatClient event bus. |
| `addEventHandler` / `removeEventHandler` | ✅ | N/A | direct `onMessage` for ordinary and combine messages; `onStreamMessage` retained by unit/type coverage | `message-single.spec.ts`, `fixtures/sdk-api.ts`, unit/type tests | ✅ Covered | 043 event cleanup reuses existing E2E/API browser message coverage; combine dispatch and stream retention are covered precisely by unit/integration/type tests, with no dedicated E2E added. |
| `addEventHandler` / `removeEventHandler` | ✅ | N/A | direct `onMultiDeviceContact`, `onMultiDeviceGroup`, `onMultiDeviceThread`, `onMultiDeviceConversation`, `onMultiDeviceMessageRemoved` | `multi-device.spec.ts`, `fixtures/sdk-api.ts` | ✅ Covered | Handler registration/removal is covered through fixture-driven public `addInternalEvent` dispatch and a removal assertion that later events no longer reach the removed handler ID. |

## ContactManager

| API | Success | Error | Event | Current Case | Status | Gap / Next Step |
|-----|---------|-------|-------|--------------|--------|-----------------|
| `getContacts` | ✅ | N/A | N/A | `contact.spec.ts` | ✅ Covered | Add explicit empty-list and pagination-adjacent assertions if needed. |
| `addContact` | ✅ | ✅ validation; ⚠ nonexistent resolves | ✅ `onContactInvited` | `contact.spec.ts` | 🟡 Partial | Success, empty `userId`, invalid `message`, event payload, and current nonexistent-user behavior are covered. Already-friend/blocked/limit need dedicated server state or quota fixture. |
| `acceptContactInvite` | ✅ | ✅ validation; ⚠ nonexistent resolves | ✅ `onContactAgreed`, `onContactAdded` | `contact.spec.ts` | 🟡 Partial | Success, empty `userId`, events, and current nonexistent-user behavior are covered. Missing-invite behavior currently resolves in real-env and is recorded as observed behavior. |
| `declineContactInvite` | ✅ | ✅ validation; ⚠ nonexistent resolves | ✅ `onContactRefuse` | `contact.spec.ts` | 🟡 Partial | Success, empty `userId`, event payload, and current nonexistent-user behavior are covered. Missing-invite behavior currently resolves in real-env and is recorded as observed behavior. |
| `deleteContact` | ✅ | ✅ validation + unmapped `303` | ✅ `onContactDeleted` | `contact.spec.ts` | ✅ Covered | Existing contact deletion and nonexistent user `service_resource_not_found` -> unmapped `303` are asserted. |
| `setContactRemark` | ✅ | ✅ | N/A | `contact.spec.ts` | ✅ Covered | Non-friend error, invalid type, empty remark clear, and success state are covered. |
| `getBlocklist` | ✅ | N/A | N/A | `contact.spec.ts` | ✅ Covered | No action. |
| `addUsersToBlocklist` | ✅ | ✅ | N/A | `contact.spec.ts` | ✅ Covered | Empty list, invalid item, success result, list state, and nonexistent user `204` details are covered. |
| `removeUserFromBlocklist` | ✅ | ✅ validation | N/A | `contact.spec.ts` | ✅ Covered | Empty list, invalid item, success removal, and not-in-blocklist idempotency are covered. |
| `addEventHandler` / `removeEventHandler` | ✅ | N/A | ✅ direct `onContactInvited` | `contact.spec.ts`, fixture + contact events | ✅ Covered | Direct ContactManager handler add/remove is covered and verifies no event after removal. |

### ContactManager Observed Deviations

- `addContact({ userId: nonexistent })` resolves with no payload in the current real environment instead of returning the configured `204 USER_NOT_FOUND`.
- `acceptContactInvite({ userId: nonexistent })` and `declineContactInvite({ userId: nonexistent })` resolve with no payload in the current real environment instead of returning a missing-user or missing-invite error.
- `deleteContact({ userId: nonexistent })` returns `RestBusinessError(303)` with `details.serverCode = "service_resource_not_found"` and `details.mapped = false`; `src/rest/api-errors.json` currently documents this branch as `204 USER_NOT_FOUND`.
- `addUsersToBlocklist({ userIds: [nonexistent] })` returns mapped `RestBusinessError(204)` with `details.canonicalCode = 204`, which matches the current SDK mapping.

## UserInfoManager

| API | Success | Error | Event | Current Case | Status | Gap / Next Step |
|-----|---------|-------|-------|--------------|--------|-----------------|
| `getUserInfoByUserId` | ✅ | ✅ | N/A | `user-info.spec.ts` | ✅ Covered | Empty `userIds` validation covered; add nonexistent user if contract is stable. |
| `getUserInfoByAttribute` | ✅ | ❌ | N/A | `user-info.spec.ts` | 🟡 Partial | Add invalid attribute / empty userIds errors. |
| `updateOwnInfo` | ✅ | ❌ | ✅ `onOwnInfoUpdated` | `user-info.spec.ts` | 🟡 Partial | Add oversized fields and invalid payload errors. |
| `updateOwnInfoByAttribute` | ✅ | ❌ | ✅ `onOwnInfoUpdated`, `onUserInfoUpdated` | `user-info.spec.ts` | 🟡 Partial | Add invalid attribute and oversized value errors. |
| `subscribeUsersInfo` | ✅/conditional | ✅ | ✅ | `user-info.spec.ts` | 🟡 Partial | Stranger subscription may return `303`; document or map if SDK should normalize it. |
| `unsubscribeUsersInfo` | ✅ | ❌ | ✅ no event after unsubscribe | `user-info.spec.ts` | 🟡 Partial | Add empty userIds validation. |
| `getSubscribedUsers` | ✅ | N/A | N/A | `user-info.spec.ts` | ✅ Covered | No action. |
| `addEventHandler` / `removeEventHandler` | ✅ | ❌ | ✅ | fixture + user-info events | 🟡 Partial | Covered by event receipt, not by direct handler API assertions. |

## PresenceManager

| API | Success | Error | Event | Current Case | Status | Gap / Next Step |
|-----|---------|-------|-------|--------------|--------|-----------------|
| `publishPresence` | ✅ | ✅ validation + not-login | ✅ conditional `onPresenceStatusChange` | `presence.spec.ts` | 🟡 Partial | Success, invalid `customStatus`, not-login validation, and status-query effects are covered; push event remains conditional because real-env delivery is timing-sensitive. |
| `subscribePresence` | ✅ | ✅ | N/A | `presence.spec.ts` | ✅ Covered | Success, empty/invalid `userIds`, invalid `expiry`, self-subscribe, over-limit, and not-login validation are covered; over-limit currently returns generic `110`. |
| `unsubscribePresence` | ✅ | ✅ validation + not-login | N/A | `presence.spec.ts` | ✅ Covered | Success/list removal, empty/invalid `userIds`, not-login validation, and current self-unsubscribe idempotent behavior are covered. |
| `getSubscribedPresenceList` | ✅ | ✅ | N/A | `presence.spec.ts` | ✅ Covered | Invalid pagination details covered. |
| `getPresenceStatus` | ✅ | ✅ validation + not-login | N/A | `presence.spec.ts` | ✅ Covered | Success, empty/invalid `userIds`, nonexistent user offline shape, and not-login validation are covered. |
| `addEventHandler` / `removeEventHandler` | ✅ | N/A | ✅ conditional direct handler | `presence.spec.ts`, fixture + presence events | 🟡 Partial | Direct handler add/remove is exercised; payload is asserted when real-env event arrives, but event delivery is not deterministic enough for mandatory assertion. |

### PresenceManager Observed Deviations

- `subscribePresence` over-limit currently returns generic `ValidationError(110)` instead of the robot/mobile-specific `1100`.
- `unsubscribePresence({ userIds: [self] })` currently resolves with no payload in the browser real environment instead of returning `1101`.
- Calling presence APIs before login currently fails at `ChatClient.getRestContext()` with `ValidationError(110)` and `details.fields[0].path = "restBaseUrl"`; mobile robot expects a not-login style `201`.
- Presence status push remains timing-sensitive in full serial runs, so E2E asserts query results mandatorily and validates event payload only when the event is delivered.

## ChatManager - Message Creation / Send

| API | Success | Error | Event | Current Case | Status | Gap / Next Step |
|-----|---------|-------|-------|--------------|--------|-----------------|
| `createTextMessage` | ✅ | ❌ | N/A | `message-single.spec.ts`, `message-group.spec.ts`, `chatroom.spec.ts`, `reaction.spec.ts` | 🟡 Partial | Single, group, and chatroom creation/send paths are covered. Add invalid conversation/user/body validation in API E2E or keep in unit tests if pure validation only. |
| `createLocationMessage` | ✅ | ❌ | N/A | `message-single.spec.ts`, `message-group.spec.ts` | 🟡 Partial | Add invalid latitude/longitude validation. |
| `createCmdMessage` | ✅ | ❌ | N/A | `message-single.spec.ts`, `message-group.spec.ts`, `chatroom.spec.ts` | 🟡 Partial | Single, group, and chatroom creation/send paths are covered. Add empty action validation. |
| `createCustomMessage` | ✅ | ❌ | N/A | `message-single.spec.ts`, `message-group.spec.ts`, `chatroom.spec.ts` | 🟡 Partial | Single, group, and chatroom creation/send paths are covered. Add empty event / invalid params validation. |
| `createImageMessage` | ✅ | ✅ | N/A | `chat-manager-advanced.spec.ts` | ✅ Covered | Remote URL body derivation and missing `originalUrl/data` validation are covered; browser `File` upload send path remains a separate media-upload gap. |
| `createFileMessage` | ✅ | ❌ | N/A | `chat-manager-advanced.spec.ts` | 🟡 Partial | Remote URL body projection is covered; add file-object upload/send and create validation branches if needed. |
| `createVoiceMessage` | ✅ | ❌ | N/A | `chat-manager-advanced.spec.ts` | 🟡 Partial | Remote URL body projection is covered; uploaded voice send/download remains pending. |
| `createVideoMessage` | ✅ | ❌ | N/A | `chat-manager-advanced.spec.ts` | 🟡 Partial | Remote URL body projection is covered; uploaded video send/download remains pending. |
| `createCombineMessage` | ✅ | ✅ | N/A | `chat-manager-advanced.spec.ts` | ✅ Covered | Nested text message, combine level, compatible text, and empty `messageList` validation are covered. |
| `sendMessage` | ✅ | ❌ | ✅/history | `message-single.spec.ts`, `message-group.spec.ts`, `chatroom.spec.ts` | 🟡 Partial | Single-chat delivery event covered for text/cmd/location/custom; chatroom delivery event covered for text/cmd/custom; group delivery verified through history because group push event is unstable in current real-env. Add send failure/blocked/muted cases. |

## ChatManager - Conversation APIs

| API | Success | Error | Event | Current Case | Status | Gap / Next Step |
|-----|---------|-------|-------|--------------|--------|-----------------|
| `getConversationList` | ✅ | ❌ | N/A | `conversation-manage.spec.ts` | 🟡 Partial | List shape, pagination cursor, lastMessage/unread/marks/access fields are covered; invalid cursor/pageSize remains. |
| `refreshSessionList` | ✅ | 🟡 fallback error payload | ✅ `onSyncDataStart/Finished(conversation)` | `conversation-manage.spec.ts`, fixture | 🟡 Partial | Start/finish events and returned cache are covered through unified sync events; feature fallback error is accepted when the session-list service is unavailable. |
| `getPinnedConversationList` | ✅ | ❌ | N/A | `conversation-manage.spec.ts` | 🟡 Partial | Pinned-only local cache projection is covered; invalid pageSize remains. |
| `getConversationListByMark` | ✅ | ❌ | N/A | `conversation-manage.spec.ts` | 🟡 Partial | Add invalid mark/pageSize errors and empty result shape. |
| `deleteConversation` | ✅ | ❌ | ✅ local `onConversationListUpdate` covered by unit test | `conversation-manage.spec.ts`, `chat-manager.test.ts` | 🟡 Partial | Delete mutation result and local cache update are covered. Add invalid conversationType/conversationId and real-env local-cache event assertion when fixture state is stable. |
| `setConversationPinned` | ✅ | ❌ | ✅ `onConversationListUpdate` | `conversation-manage.spec.ts` | 🟡 Partial | Add invalid conversationType/conversationId and repeated mutation behavior. |
| `addConversationMark` | ✅ | ❌ | N/A | `conversation-manage.spec.ts` | 🟡 Partial | Add invalid mark and mixed valid/invalid conversation errors. |
| `removeConversationMark` | ✅ | ❌ | N/A | `conversation-manage.spec.ts` | 🟡 Partial | Add remove missing mark and invalid payload errors. |
| `clearAllMessagesAndConversations` | ✅ | ❌ | ✅ local `onConversationListUpdate` covered by unit test | `conversation-manage.spec.ts`, `chat-manager.test.ts` | 🟡 Partial | Destructive call and local cache clearing are covered. Add real-env local-cache event assertion when fixture state is stable. |

## ChatManager - Message Actions / History / Reaction

| API | Success | Error | Event | Current Case | Status | Gap / Next Step |
|-----|---------|-------|-------|--------------|--------|-----------------|
| `markConversationRead` | ✅ | ❌ | ✅ remote `onConversationRead` | `chat-manager-advanced.spec.ts`, fixture | 🟡 Partial | Generated unread message and remote single-chat channel ack event are covered; local caller must not receive `onConversationRead`. Add invalid locator error. |
| `markMessageRead` | ✅ | ✅ | ✅ remote `onMessageRead` | `message-single.spec.ts`, `message-group.spec.ts`, `chat-manager-advanced.spec.ts` | ✅ Covered | Single-chat and group-chat received-message ack payloads are covered; local caller must not receive `onMessageRead`. |
| `recallMessage` | ✅ | ✅ | ✅ `onMessageRecalled` | `message-single.spec.ts`, `message-group.spec.ts` | ✅ Covered | Single missing message currently returns `SDKError(1) message not exist`; group member unauthorized returns `SDKError(1) no permission to recall message`; group recall event is asserted when delivered because current real-env delivery can be timing-sensitive. |
| `modifyMessage` | ✅ | ❌ | ✅ `onMessageUpdated` | `message-single.spec.ts` | 🟡 Partial | Text and custom edit success/event are covered. Add unsupported media edit error. |
| `getHistoryMessages` | ✅ | ❌ | N/A | `message-single.spec.ts`, `message-group.spec.ts` | 🟡 Partial | Single-chat newest-first order and group delivery history payload are covered. Add cursor/pageSize/type/time/sender filters and invalid pageSize error. |
| `removeHistoryMessages` | ✅ | ✅ validation | N/A | `chat-manager-advanced.spec.ts` | 🟡 Partial | Empty selector validation and receive-side `messageIds` deletion are covered. Sending-side immediate roaming lookup did not return the just-sent message in real env, so the case uses receiver history. Add `beforeTimestamp` separately. |
| `getGroupMessageReadUsers` | ✅ | ❌ | N/A | `message-group.spec.ts` | 🟡 Partial | Success after group ack is covered with `ackContent` and timestamp. Add invalid group/message and empty list behavior. |
| `addReaction` | ✅ | ✅ | ✅ `onReactionChanged` | `reaction.spec.ts` | ✅ Covered | Single/group success, duplicate, missing message, group-not-joined, and limit branches are covered. Current group-not-joined/limit errors surface as unmapped `ValidationError(110)`. |
| `removeReaction` | ✅ | ✅ | ✅ `onReactionChanged` | `reaction.spec.ts` | ✅ Covered | Success and remove-not-added current behavior are covered; remove-not-added currently surfaces as unmapped `ValidationError(110)`. |
| `getReactionList` | ✅ | ✅ validation | N/A | `reaction.spec.ts` | 🟡 Partial | Single success, empty `messageId`, missing groupId validation, and group current empty-list behavior are covered. Add invalid server-side groupId if needed. |
| `getReactionDetail` | ✅ | ✅ validation | N/A | `reaction.spec.ts` | 🟡 Partial | Single/group detail and invalid `pageSize` are covered. Add cursor pagination and missing reaction detail behavior if needed. |
| `pinMessage` | ✅ | ❌ | ✅ `onPinnedMessageChanged` | `chat-manager-advanced.spec.ts`, fixture | 🟡 Partial | Pin mutation, local event, and list state are covered; invalid message/not-found remains. |
| `unpinMessage` | ✅ | ❌ | ✅ `onPinnedMessageChanged` | `chat-manager-advanced.spec.ts`, fixture | 🟡 Partial | Unpin mutation, local event, and list state are covered; invalid message/not-pinned remains. |
| `getPinnedMessageList` | ✅ | ❌ | N/A | `chat-manager-advanced.spec.ts` | 🟡 Partial | List shape and pinned/unpinned state are covered; invalid conversation params remain. |
| `downloadAttachment` | ❌ | ✅ validation | N/A | `chat-manager-advanced.spec.ts` | 🟡 Partial | Non-attachment validation is covered. Uploaded attachment success remains pending because it requires browser file upload cleanup. |
| `downloadAndParseCombineMessage` | ❌ | ✅ validation | N/A | `chat-manager-advanced.spec.ts` | 🟡 Partial | Non-combine and combine-without-url validation are covered. Uploaded combine payload success remains pending. |
| `getSupportedTranslationLanguages` | ✅/feature-gated | ✅ current service error shape | N/A | `chat-manager-advanced.spec.ts` | 🟡 Partial | Case accepts success shape or exact error envelope when translation service is feature-gated in real env. |
| `translateMessage` | ✅/feature-gated | ✅ validation/current service error | N/A | `chat-manager-advanced.spec.ts` | 🟡 Partial | Text translation success shape is asserted when enabled; non-text validation is covered; service-gated error shape is recorded. |
| `voiceMessageToText` | ❌ | ✅ validation | N/A | `chat-manager-advanced.spec.ts` | 🟡 Partial | Missing URL and invalid params are covered. Successful transcription requires uploaded valid voice fixture/service capability. |
| `voiceFileToText` | ❌ | ✅ validation | N/A | `chat-manager-advanced.spec.ts` | 🟡 Partial | Invalid browser source is covered. Successful transcription requires valid voice file and service capability. |

## GroupManager

| API | Success | Error | Event | Current Case | Status | Gap / Next Step |
|-----|---------|-------|-------|--------------|--------|-----------------|
| `createGroup` | ✅ | ❌ | N/A | `group.spec.ts`, `message-group.spec.ts` | 🟡 Partial | Add invalid name/maxMembers/memberIds errors. |
| `getJoinedGroupList` | ✅ | ❌ | N/A | `group.spec.ts`, `message-group.spec.ts` | ✅ Covered | Add empty state if isolated account is available. |
| `getGroup` handle | ✅ | ✅ validation | N/A | `group.spec.ts` | ✅ Covered | Handle binding, detail/member/announcement proxy, and invalid `groupId` validation are covered. |
| `getGroupInfo` | ✅ | ✅ | N/A | `group.spec.ts` | ✅ Covered | Detail fields and current not-found behavior are covered; `getGroupInfo` not-found currently surfaces as unmapped `RestBusinessError(303)`. |
| `getGroupInfoList` | ✅ | ✅ | N/A | `group.spec.ts` | ✅ Covered | Batch detail and empty `groupIds` validation are covered. |
| `updateGroupInfo` | ✅ | ❌ | `onGroupInfoChanged` optional | `group.spec.ts` | 🟡 Partial | Name/description/ext update and detail projection are covered; current real-env does not reliably emit `onGroupInfoChanged`. |
| `changeGroupOwner` | ✅ | ❌ | ✅ `onOwnerChanged` | `group.spec.ts` | ✅ Covered | Transfer success, event payload, and role/owner projection are covered. |
| `destroyGroup` | ✅ | ❌ | `onGroupDestroyed` not asserted | `group.spec.ts`, cleanup | 🟡 Partial | Add not-found error and member destroy event. |
| `leaveGroup` | ✅ | ❌ | `onMembersExited` optional | `group.spec.ts` | 🟡 Partial | Member leave and member list cleanup are covered; current real-env does not reliably emit `onMembersExited`. |
| `joinGroup` | ✅ | ❌ | ✅ `onRequestToJoinReceived`, `onRequestToJoinAccepted`, `onRequestToJoinDeclined` | `group.spec.ts` | ✅ Covered | Approval-group join, accept, and reject flows are covered with exact payload assertions. |
| `inviteUsersToGroup` | ✅ | ❌ | ✅ `onInvitationReceived`; `onInvitationAccepted` / `onInvitationDeclined` optional | `group.spec.ts` | 🟡 Partial | Invitation receive flow is covered; accept/decline callbacks are recorded as current SDK/real-env gaps. |
| `acceptGroupJoinRequest` | ✅ | ❌ | ✅ `onRequestToJoinAccepted` | `group.spec.ts` | ✅ Covered | Success path and event payload are covered. |
| `rejectGroupJoinRequest` | ✅ | ❌ | ✅ `onRequestToJoinDeclined` | `group.spec.ts` | ✅ Covered | Success path and event payload are covered. |
| `acceptInvitation` | ✅ | ❌ | `onInvitationAccepted` optional | `group.spec.ts` | 🟡 Partial | Membership update is covered; current real-env does not reliably emit `onInvitationAccepted`. |
| `rejectInvitation` | ✅ | ❌ | `onInvitationDeclined` optional | `group.spec.ts` | 🟡 Partial | Membership cleanup is covered; current real-env does not reliably emit `onInvitationDeclined`. |
| `getGroupMemberList` | ✅ | ✅ | N/A | `group.spec.ts` | ✅ Covered | Member list shape and not-found mapping are covered. |
| `removeGroupMembers` | ✅ | ❌ | ✅ `onUserRemoved` | `group.spec.ts` | ✅ Covered | Remove-member flow and event payload are covered. |
| `getGroupAdminList` | ✅ | ❌ | N/A | `group.spec.ts` | 🟡 Partial | Add not-found error. |
| `addGroupAdmin` | ✅ | ✅ | ✅ `onAdminAdded` | `group.spec.ts` | ✅ Covered | Current member permission error returns `AuthenticationError(108)` in real-env; record as observed mismatch. |
| `removeGroupAdmin` | ✅ | ❌ | ✅ `onAdminRemoved` | `group.spec.ts` | 🟡 Partial | Add not-found/non-admin error. |
| `getGroupMuteList` | ✅ current empty | ❌ | N/A | `group.spec.ts` | 🟡 Partial | Covered current real-env behavior: mute succeeds and check API returns true, but `getGroupMuteList(v3)` remains empty. Add not-found error separately if needed. |
| `muteGroupMembers` | ✅ | ✅ permission | ✅ `onMuteListAdded` | `group.spec.ts` | ✅ Covered | Owner success/event and member permission error are covered; member permission currently surfaces as `AuthenticationError(108)`. |
| `unmuteGroupMembers` | ✅ | ❌ | ✅ `onMuteListRemoved` | `group.spec.ts` | 🟡 Partial | Success/event covered; add not-found/non-muted errors if needed. |
| `muteAllGroupMembers` | ✅ | ❌ | `onAllMemberMuteStateChanged` optional | `group.spec.ts` | 🟡 Partial | Detail mutation is covered; current real-env does not reliably emit the callback. |
| `unmuteAllGroupMembers` | ✅ | ❌ | `onAllMemberMuteStateChanged` optional | `group.spec.ts` | 🟡 Partial | Detail mutation is covered; current real-env does not reliably emit the callback. |
| `getGroupBlocklist` | ✅ | ❌ | N/A | `group.spec.ts` | 🟡 Partial | Add not-found error if needed. |
| `blockGroupMembers` | ✅ | ❌ | N/A | `group.spec.ts` | 🟡 Partial | Block/unblock list state is covered; add join-blocked behavior if needed. |
| `unblockGroupMembers` | ✅ | ❌ | N/A | `group.spec.ts` | 🟡 Partial | Block/unblock list state is covered; add not-found/not-blocked errors if needed. |
| `getGroupAllowlist` | ✅ | ✅ | N/A | `group.spec.ts` | ✅ Covered | List shape and not-found mapping are covered. Owner appears in allowlist by default in current real-env. |
| `addUsersToGroupAllowlist` | ✅ | ❌ | ✅ `onAllowListAdded` | `group.spec.ts` | 🟡 Partial | Success/event covered; add not-found/user-not-found errors if needed. |
| `removeUsersFromGroupAllowlist` | ✅ | ❌ | ✅ `onAllowListRemoved` | `group.spec.ts` | 🟡 Partial | Success/event covered. Current `checkIfInGroupAllowList` still returns true after removal while list removes userB. |
| `checkIfInGroupAllowList` | ✅ current behavior | ❌ | N/A | `group.spec.ts` | 🟡 Partial | Add/remove flow covered; current real-env returns true even after userB is removed from allowlist. |
| `checkIfInGroupMuteList` | ✅ | ❌ | N/A | `group.spec.ts` | 🟡 Partial | Mute/unmute boolean state is covered; add invalid group errors if needed. |
| `getGroupAnnouncement` | ✅ | ❌ | N/A | `group.spec.ts` | 🟡 Partial | Add not-found error. |
| `updateGroupAnnouncement` | ✅ | ✅ permission | ✅ optional | `group.spec.ts` | 🟡 Partial | Owner success and member permission error are covered; add not-found error if needed. |
| `getGroupSharedFileList` | ✅ | ❌ | `onSharedFileAdded` / `onSharedFileDeleted` optional | `group.spec.ts` | ✅ Covered | Upload/list/download/delete round trip is covered; callback delivery remains optional in current real-env. |
| `uploadGroupSharedFile` | ✅ | ❌ | `onSharedFileAdded` optional | `group.spec.ts` | 🟡 Partial | Upload/list path is covered; current real-env callback delivery is optional. |
| `deleteGroupSharedFile` | ✅ | ❌ | `onSharedFileDeleted` optional | `group.spec.ts` | 🟡 Partial | Delete/list cleanup is covered; current real-env callback delivery is optional. |
| `downloadGroupSharedFile` | ✅ | ❌ | N/A | `group.spec.ts` | ✅ Covered | Download round trip is covered with exact file content assertion. |
| `setGroupMemberAttributes` | ✅ | ❌ | `onGroupMemberAttributeChanged` optional | `group.spec.ts` | 🟡 Partial | Set/get/batch attribute round trip is covered; current real-env callback delivery is optional. |
| `getGroupMembersAttributes` | ✅ | ❌ | N/A | `group.spec.ts` | ✅ Covered | Batch attribute read is covered; single-member read uses `userIds: [userId]`. |

## ChatRoomManager

| API | Success | Error | Event | Current Case | Status | Gap / Next Step |
|-----|---------|-------|-------|--------------|--------|-----------------|
| `getChatRoomList` | ✅ | ❌ | N/A | `chatroom.spec.ts` | 🟡 Partial | Summary/page shape covered; add invalid pagination if needed. |
| `getChatRoom` handle | ✅ | ✅ validation | N/A | `chatroom.spec.ts` | ✅ Covered | OO facade delegates info/members/announcement/attributes. |
| `getChatRoomInfo` | ✅ | ✅ validation | N/A | `chatroom.spec.ts` | ✅ Covered | Owner/detail/member-count fields and invalid `chatRoomId` are covered. |
| `updateChatRoomInfo` | ✅ | ❌ | ✅ optional `onGroupInfoChanged` | `chatroom.spec.ts` | 🟡 Partial | Success/detail round trip covered; callback delivery is optional in current real-env. |
| `joinChatRoom` | ✅ | ✅ validation | ✅ optional `onMembersJoined` | `chatroom.spec.ts` | 🟡 Partial | WebSocket MUC join/list state covered with exact validation; callback delivery is optional in current real-env. |
| `leaveChatRoom` | ✅ | ❌ | ✅ optional `onMembersExited` | `chatroom.spec.ts` | 🟡 Partial | WebSocket MUC leave/list cleanup covered; add invalid-room/server-error mapping if needed. |
| `getMemberList` | ✅ | ✅ via `getChatRoomInfo` validation | N/A | `chatroom.spec.ts` | ✅ Covered | Owner and member-state projection are covered. |
| `removeMembers` | ✅ | ❌ | ✅ optional `onRemovedFromChatRoom` | `chatroom.spec.ts` | 🟡 Partial | Success/list cleanup covered; callback delivery is optional in current real-env. |
| `getAdminList` | ✅ | ❌ | N/A | `chatroom.spec.ts` | 🟡 Partial | Admin add/list/remove round trip covered; add invalid room errors if needed. |
| `addAdmin` | ✅ | ❌ | ✅ optional `onAdminAdded` | `chatroom.spec.ts` | 🟡 Partial | Success/event optional covered. |
| `removeAdmin` | ✅ | ❌ | ✅ optional `onAdminRemoved` | `chatroom.spec.ts` | 🟡 Partial | Success/event optional covered. |
| `getMuteList` | ✅ | ❌ | N/A | `chatroom.spec.ts` | 🟡 Partial | Mute list state covered; add invalid room errors if needed. |
| `muteMembers` | ✅ | ✅ empty userIds | ✅ optional `onMuteListAdded` | `chatroom.spec.ts` | 🟡 Partial | Success/list/event optional covered. |
| `unmuteMembers` | ✅ | ❌ | ✅ optional `onMuteListRemoved` | `chatroom.spec.ts` | 🟡 Partial | Success/list cleanup/event optional covered. |
| `muteAllMembers` | ✅ | ❌ | ✅ optional `onAllMemberMuteStateChanged` | `chatroom.spec.ts` | 🟡 Partial | Success and optional event are covered; detail no longer exposes group-only mute flag. |
| `unmuteAllMembers` | ✅ | ❌ | ✅ optional `onAllMemberMuteStateChanged` | `chatroom.spec.ts` | 🟡 Partial | Success and optional event are covered; detail no longer exposes group-only mute flag. |
| `checkIfInMuteList` | 🟡 list-backed | ✅ current 303 | N/A | `chatroom.spec.ts` | 🟡 Partial | `getMuteList` verifies state; current single-user check returns `RestBusinessError(303)` in real-env. |
| `getBlocklist` | ✅ | ❌ | N/A | `chatroom.spec.ts` | 🟡 Partial | Block/unblock list state covered; add invalid room errors if needed. |
| `blockMembers` | ✅ | ❌ | ✅ optional `onRemovedFromChatRoom` | `chatroom.spec.ts` | 🟡 Partial | Success/list/event optional covered. |
| `unblockMembers` | ✅ | ❌ | N/A | `chatroom.spec.ts` | 🟡 Partial | Success/list cleanup covered. |
| `getAllowlist` | ✅ | ❌ | N/A | `chatroom.spec.ts` | 🟡 Partial | Allowlist add/remove state covered. |
| `addUsersToAllowlist` | ✅ | ❌ | ✅ optional `onAllowListAdded` | `chatroom.spec.ts` | 🟡 Partial | Success/event optional covered. |
| `removeUsersFromAllowlist` | ✅ | ❌ | ✅ optional `onAllowListRemoved` | `chatroom.spec.ts` | 🟡 Partial | Success/event optional covered. |
| `checkIfInAllowList` | ✅ | ❌ | N/A | `chatroom.spec.ts` | 🟡 Partial | True/false state covered after add/remove. |
| `getAnnouncement` | ✅ | ❌ | N/A | `chatroom.spec.ts` | 🟡 Partial | Read/update round trip covered; add invalid room errors if needed. |
| `updateAnnouncement` | ✅ | ✅ member permission | ✅ optional `onAnnouncementChanged` | `chatroom.spec.ts` | 🟡 Partial | Owner success, member permission failure and event optional covered. |
| `getAttributes` | ✅ | ❌ | N/A | `chatroom.spec.ts` | ✅ Covered | Key-level read and empty-after-remove are covered. |
| `setAttributes` | ✅ | ❌ | ✅ optional `onAttributesUpdate` | `chatroom.spec.ts` | 🟡 Partial | Exact mutation result and event optional covered. |
| `removeAttributes` | ✅ | ❌ | ✅ optional `onAttributesRemoved` | `chatroom.spec.ts` | 🟡 Partial | Exact mutation result and event optional covered. |

## PushManager

PushManager is covered by browser real-env API tests. It does not expose callback-event APIs; event coverage is therefore N/A. `getConversationListByRemindType` is a local session-list projection API, so the E2E case sets conversation silent mode, refreshes session-list cache, and then asserts the local paged projection.

| API | Success | Error | Event | Current Case | Status | Gap / Next Step |
|-----|---------|-------|-------|--------------|--------|-----------------|
| `uploadPushToken` | ✅/feature-gated | ✅ validation; service error shape | N/A | `push.spec.ts` | 🟡 Partial | Dummy Web token success is accepted when enabled; if real service rejects notifier/device fixture, exact `RestBusinessError(1500)` shape is asserted. |
| `setGlobalSilentMode` | ✅ | ✅ validation | N/A | `push.spec.ts` | ✅ Covered | Reminder type and interval modes are covered with exact return fields. |
| `getGlobalSilentMode` | ✅ | N/A | N/A | `push.spec.ts` | ✅ Covered | Set/get round trip covered. |
| `setConversationSilentMode` | ✅ | ✅ validation | N/A | `push.spec.ts` | ✅ Covered | Reminder type and duration modes are covered with exact target/rule fields. |
| `getConversationSilentMode` | ✅ | N/A | N/A | `push.spec.ts` | ✅ Covered | Set/get/after-clear round trip covered. |
| `clearConversationRemindType` | ✅ | N/A | N/A | `push.spec.ts` | ✅ Covered | Clear returns `DEFAULT` and follow-up query accepts default/empty service shape. |
| `getConversationSilentModes` | ✅ | ✅ validation | N/A | `push.spec.ts` | ✅ Covered | Batch query preserves input target and rule fields. |
| `setPushLanguage` | ✅ | ✅ validation | N/A | `push.spec.ts` | ✅ Covered | Set/get language round trip covered. |
| `getPushLanguage` | ✅ | N/A | N/A | `push.spec.ts` | ✅ Covered | Set/get language round trip covered. |
| `getConversationListByRemindType` | ✅ current empty projection | ✅ validation | N/A | `push.spec.ts` | 🟡 Partial | Local session-list projection shape is covered; current SDK does not update/sync session-list remindType after `setConversationSilentMode`, so the list stays empty even though direct get returns `AT`. |

### PushManager Observed Deviations

- Global and conversation silent-mode APIs use a field-coexistence view: setting `remindType` can preserve previously configured interval or duration fields in the same rule object. E2E asserts the exact stable fields and treats timestamp values as dynamic positive numbers.
- `clearConversationRemindType` now returns `DEFAULT` via SDK fallback merging, but a subsequent `getConversationSilentMode` can return an empty rule or only `expireTimestamp` because the real service omits `type` after clearing. E2E records that current query shape must not return stale `NONE/AT`.
- `setConversationSilentMode` succeeds and direct `getConversationSilentMode` returns the updated rule, but `getConversationListByRemindType` remains empty after `refreshSessionList`; current SDK/session-list sync does not propagate the silent-mode mutation into local `ConversationItem.remindType`.

## ChatThreadManager

ChatThread is a public manager. Real-env E2E still requires parent group message/thread fixtures and should be covered by a dedicated environment-backed phase.

| API | Success | Error | Event | Current Case | Status | Gap / Next Step |
|-----|---------|-------|-------|--------------|--------|-----------------|
| `createChatThread` | ❌ | ❌ | `onChatThreadCreated` | unit event mapper | ⚠️ Unit only | Requires parent group message setup for real-env E2E. |
| `getChatThreadList` | ❌ | ❌ | N/A | none | ❌ Missing | Requires created thread. |
| `getJoinedChatThreadList` | ❌ | ❌ | N/A | none | ❌ Missing | Requires created/joined thread. |
| `getChatThreadInfo` | ❌ | ❌ | N/A | none | ❌ Missing | Requires created thread. |
| `joinChatThread` | ❌ | ❌ | N/A | none | ❌ Missing | Requires thread and second account. |
| `leaveChatThread` | ❌ | ❌ | N/A | none | ❌ Missing | Requires joined thread. |
| `destroyChatThread` | ❌ | ❌ | `onChatThreadDestroyed` | unit event mapper | ⚠️ Unit only | Requires owner/admin thread. |
| `updateChatThreadName` | ❌ | ❌ | `onChatThreadUpdated` | unit event mapper | ⚠️ Unit only | Requires created thread. |
| `getChatThreadMemberList` | ❌ | ❌ | N/A | none | ❌ Missing | Requires created thread. |
| `removeChatThreadMember` | ❌ | ❌ | `onChatThreadUserRemoved` | unit event mapper | ⚠️ Unit only | Requires owner/admin thread and member. |
| `getChatThreadLastMessageList` | ❌ | ❌ | N/A | none | ❌ Missing | Requires created thread with messages. |

## Recommended Implementation Order

1. Fill deterministic low-cost gaps first: `getGroupInfoList`, group owner/member flows, group allowlist/mute/blocklist invalid parameter branches, and remaining chatroom list/role APIs when fixtures are available.
2. Add message action edge coverage next: invalid single/group read ack, invalid pinned message params, and dedicated history filters such as `beforeTimestamp`.
3. Add uploaded media/attachment success coverage only after browser file fixtures and upload cleanup are stable.
4. Add ChatRoom coverage after `EASEMOB_CHATROOM_ID` points to a room where the test account has owner/admin permissions.
5. Add ChatThread as a separate follow-up phase because it requires parent group message/thread fixtures and remains outside the current 041 robot mainline closure.
