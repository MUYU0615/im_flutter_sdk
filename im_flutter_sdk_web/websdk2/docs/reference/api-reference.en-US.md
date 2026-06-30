# IM SDK Web API Reference (en-US)

This document is generated from JSDoc comments.

## src/chat-client.ts

### ChatClient

### init(config: Omit<InitConfig, 'managers'> & { managers?: Managers }) => WithManagers<ChatClient, Managers>

#### Description

Initializes the ChatClient singleton. The first call creates the instance; later calls with the same config reuse it and can register additional managers.

#### Examples

Initialize with managers
```ts
const client = ChatClient.init({
  appKey: 'org#app',
  managers: [ChatManager, GroupManager],
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| config | `Omit<InitConfig, 'managers'> & { managers?: Managers }` | Initialization options including appKey, service access options, and optional managers. |

#### Returns

Returns the ChatClient instance enhanced with registered manager typings.

### login(params: AuthContext) => Promise<void>

#### Description

Logs in and establishes the long-lived connection to the messaging service. After success, local cache is restored, session list is synced, and configured contact/profile sync flows are triggered.

#### Examples

Log in to the SDK
```ts
await client.login({
  userId: 'alice',
  token: 'your-im-token',
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `AuthContext` | Login parameters including user ID and IM token. |

#### Returns

Resolves on successful login with no business payload.

### logout() => Promise<void>

#### Description

Logs out and closes the current connection, clearing authentication state, runtime cache references, and log-report status.

#### Examples

Log out from the SDK
```ts
await client.logout();
```

#### Returns

Resolves when logout is finished with no business payload.

### getConnectionState() => ConnectionState

#### Description

Gets the current connection state.

#### Examples

Read connection state
```ts
const state = client.getConnectionState();
```

#### Returns

Returns the current connection-state enum value.

### getCurrentUserId() => string | null

#### Description

Gets the current logged-in user ID.

#### Examples

Read current logged-in user
```ts
const userId = client.getCurrentUserId();
```

#### Returns

Returns the current user ID, or `null` when not logged in.

### getClientResource() => string | null

#### Description

Gets the device resource identifier of the current connection.

#### Examples

Read current device resource
```ts
const clientResource = client.getClientResource();
```

#### Returns

Returns the current device resource identifier, or `null` before connection/login handshake completes.

### getRestContext() => RestContext

#### Description

Gets the REST access context for the current authenticated session so public SDK modules or extensions can reuse consistent auth and endpoint information.

#### Examples

Read REST context
```ts
const context = client.getRestContext();
```

#### Returns

Returns the REST context for the current authenticated session.

### renewToken(token: string) => Promise<TokenRenewalResult>

#### Description

Renews the IM token for the current authenticated session and resets token lifecycle timers.

#### Examples

Renew IM token
```ts
const result = await client.renewToken(newToken);
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| token | `string` | New IM token. |

#### Returns

Returns the applied token and its expiration time.

### getRTCTokenInfo(params: GetRTCTokenInfoParams) => Promise<RTCTokenInfo>

#### Description

Gets RTC token information for the current user.

#### Examples

Query RTC token
```ts
const rtc = await client.getRTCTokenInfo({ channelName: 'demo' });
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `GetRTCTokenInfoParams` | RTC token query parameters. |

#### Returns

Returns RTC app ID, token, channel name, UID, and expiration time.

### getUserIdsWithRTCUids(rtcUids: ReadonlyArray<number>) => Promise<RTCUidUserIdMap>

#### Description

Batch maps RTC UIDs to IM user IDs.

#### Examples

Query RTC UID mapping
```ts
const users = await client.getUserIdsWithRTCUids([123456]);
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| rtcUids | `ReadonlyArray<number>` | RTC UID list. |

#### Returns

Returns the RTC-UID-to-IM-userId map; unmatched UIDs are omitted.

### getSelfIdsOnOtherPlatform() => Promise<SelfIdsOnOtherPlatform>

#### Description

Gets login IDs of the current user on other signed-in devices.

#### Examples

Query login IDs on other platforms
```ts
const ids = await client.getSelfIdsOnOtherPlatform();
```

#### Returns

Returns the `userId/resource` list of the current user on other devices; the current device is filtered out automatically.

### getCacheManager() => CacheManager | null

#### Description

Gets the cache-manager instance bound to the current session.

#### Examples

Read cache manager
```ts
const cacheManager = client.getCacheManager();
```

#### Returns

Returns the cache manager, or `null` when not logged in or cache is not initialized.

### getUploadAdapter() => UploadAdapter | null

#### Description

Gets the upload adapter exposed by the current platform adapter.

#### Examples

Read upload adapter
```ts
const uploadAdapter = client.getUploadAdapter();
```

#### Returns

Returns the upload adapter, or `null` when the current platform does not provide one.

### getServerUrlsConfig() => ServerUrlsConfig | undefined

#### Description

Gets the current fixed-service endpoint configuration. It is defined only when the client was initialized with `serviceConfig.serverUrls`.

#### Examples

Read fixed service configuration
```ts
const serverUrls = client.getServerUrlsConfig();
```

#### Returns

Returns the fixed service configuration, or `undefined` when not configured.

### getContactSnapshot() => ContactSnapshot | null

#### Description

Gets the current cached contact snapshot.

#### Examples

Read contact snapshot
```ts
const snapshot = client.getContactSnapshot();
```

#### Returns

Returns the contact snapshot, or `null` when cache is not initialized.

### addEventHandler(id: EventHandlerId, handlers: EventHandlerMap) => void

#### Description

Registers ChatClient event handlers for public SDK events such as connection, message, contact, and group events.

#### Examples

Listen for connection-state changes
```ts
client.addEventHandler('client-events', {
  onConnected: () => console.log('connected'),
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| id | `EventHandlerId` | Unique handler ID used for later removal. |
| handlers | `EventHandlerMap` | Handler collection with callbacks implemented as needed. |

#### Returns

Returns nothing after registration.

### removeEventHandler(id: EventHandlerId) => void

#### Description

Removes the specified ChatClient event handler set.

#### Examples

Remove event handlers
```ts
client.removeEventHandler('client-events');
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| id | `EventHandlerId` | Handler ID to remove. |

#### Returns

Returns nothing after removal.

### use(ManagerCtor: ManagerConstructor<ChatClient, Manager, Key>) => WithManager<this, Key, Manager>

#### Description

Registers a manager constructor and returns the ChatClient instance enhanced with that manager typing.

#### Examples

Register a manager manually
```ts
const client = ChatClient.init({ appKey: 'org#app' }).use(ChatManager);
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| ManagerCtor | `ManagerConstructor<ChatClient, Manager, Key>` | Manager constructor. |

#### Returns

Returns the current ChatClient instance enhanced with the manager typing.

### sendMessage(message: Message, options: SendMessageOptions) => Promise<Message>

#### Description

Sends a message. The message is typically created first through `ChatManager` or one of the `create*Message` helpers and then passed to this method.

#### Examples

Send a message
```ts
const sent = await client.sendMessage(message);
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| message | `Message` | Message object to send. |
| options | `SendMessageOptions` | Optional send options such as progress callbacks. |

#### Returns

Returns the message object after the send pipeline completes.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in send message | Check validation invalid and try again |
| 300 | not_connected | not connected occurred in send message | Check not connected and try again |
| 500 | encode_failed | encode failed occurred in send message | Check encode failed and try again |
| 1200 | MESSAGE_BLOCKED | Rejected by third-party content moderation | - |
| 215 | USER_MUTED | User is muted | - |

### emitConversationListUpdate(reason: ConversationListUpdateReason, reset: boolean) => void

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| reason | `ConversationListUpdateReason` | - |
| reset | `boolean` | - |

## src/types/chat-client.ts

### ServerUrlsConfig

#### Description

Fixed service endpoint configuration.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| restApiUrl | `string` | REST API base URL. |
| wsUrl | `string` | Message WebSocket URL. |
| syncRestApiUrl | `string` | Session/contact sync REST API base URL. |
| syncWsUrl | `string` | Session/contact sync WebSocket URL. |

### ServiceConfig

#### Description

Service access configuration.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| dnsConfigUrls | `string[]` | DNS_CONFIG URL list; SDK still resolves service endpoints through DNS_CONFIG. |
| serverUrls | `ServerUrlsConfig` | Fixed service URLs; SDK connects directly and skips DNS_CONFIG. |

### ProfileSyncConfig

#### Description

Message profile-hydration throttling configuration.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| userInfoWindowMs | `number` | Aggregation window for user-info hydration in milliseconds. |
| userInfoBatchSize | `number` | Batch size for one user-info hydration request. |
| groupNamecardWindowMs | `number` | Aggregation window for group-namecard hydration in milliseconds. |
| groupNamecardMaxConcurrency | `number` | Maximum concurrency for group-namecard hydration. |

### SyncConversationListConfig

#### Description

Session-list sync configuration.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| includeEmpty | `boolean` | Whether empty sessions should be synced; session marks are always synced. |

### InitConfig

#### Description

ChatClient initialization options.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| appKey | `string` | Unique application key in `org#app` format. |
| enableUserInfoSync | `boolean` | Whether to enable enhanced user-profile sync. |
| enableSyncData | `ReadonlyArray<SyncDataType>` | Data types to synchronize automatically after login. |
| enableDeliveryReceipt | `boolean` | Whether to enable delivery receipts. When enabled, the SDK automatically sends a delivery ack to the sender upon receiving a single-chat message; the sender receives `onMessageDelivered` event. |
| syncConversationListConfig | `SyncConversationListConfig` | Session-list synchronization options. |
| useCustomAttachmentUpload | `boolean` | Whether to use custom attachment upload. |
| useFixedDeviceId | `boolean` | Whether to reuse a fixed device identifier in the same browser. |
| deviceId | `string` | Custom device identifier; SDK default is used when omitted. |
| serviceConfig | `ServiceConfig` | Service endpoint configuration; omitted means SDK default DNS_CONFIG. |
| useReplacedMessageContents | `boolean` | Whether to return moderation-replaced message content to the sender. |
| customDeviceName | `string` | Custom device name, usually used with `customOsPlatform`. |
| customOsPlatform | `number` | Custom platform code. |
| uiKitVersion | `string` | UI Kit version used for reporting. |
| loginExtensionInfo | `string` | Custom login extension string. When this device is kicked out by multi-device login policy, the string is delivered to the kicked device. Maximum length is 1024 characters. |
| managers | `ReadonlyArray<ManagerRegistration<unknown>>` | Managers to auto-register during initialization. |

### AuthContext

#### Description

Login parameters.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| userId | `string` | User ID to log in with. |
| token | `string` | IM login token. |

### TokenRenewalResult

#### Description

IM token renewal result.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| token | `string` | The renewed IM token that has been applied. |
| expireAt | `number` | Token expiration timestamp in milliseconds. |

### GetRTCTokenInfoParams

#### Description

Parameters for requesting RTC token information.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| channelName | `string` | RTC channel name; omitted means service default. |

### RTCTokenInfo

#### Description

RTC token information.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| appId | `string` | RTC App ID. |
| rtcToken | `string` | RTC token used for joining the channel. |
| channelName | `string` | RTC channel name. |
| rtcUid | `number` | RTC UID for the current user. |
| expireAt | `number` | RTC token expiration timestamp in milliseconds. |

### RestContext

#### Description

REST access context.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| restBaseUrl | `string` | REST base URL. |
| appKey | `string` | appKey of the current application. |
| userId | `string` | Current logged-in user ID. |
| token | `string` | Current access token. |
| clientResource | `string` | Device resource identifier of the current connection. |

### DnsHost

#### Description

DNS host information.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| protocol | `string` | Endpoint protocol. |
| domain | `string` | Domain name. |
| ip | `string` | IP address. |
| port | `string | number` | Port number. |

### DnsConfig

#### Description

DNSConfig response structure.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| rest | `{ hosts: DnsHost[] }` | REST service host set. |
| 'msync-wx' | `{ hosts: DnsHost[] }` | Message WebSocket host set. |
| 'sync-ws' | `{ hosts: DnsHost[] }` | Session/contact sync WebSocket host set. |
| enableReportLogs | `'true' | 'false'` | Log-report switch delivered by DNS. |

## src/types/connection.ts

### ConnectionEventPayload

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| state | `ConnectionStatus` | - |
| reason | `ConnectionEventReason` | - |
| attempt | `number` | - |
| maxAttempts | `number` | - |
| isLoginPhase | `boolean` | - |
| isOnline | `boolean` | - |
| errorCode | `number` | - |
| errorMessage | `string` | - |
| timestamp | `number` | - |

### SendTimeoutEventPayload

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| reason | `typeof ConnectionEventReason.SEND_TIMEOUT` | - |
| timestamp | `number` | - |

## src/types/event-system.ts

### EventPayloadMap

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| onConnecting | `ConnectionEventPayload` | Connecting to server (including auto-reconnect). |
| onConnected | `ConnectionEventPayload` | Successfully connected to server. |
| onDisconnected | `ConnectionEventPayload` | Disconnected from server. Reasons include: logout, token expired, kicked, device limit exceeded, etc. |
| onReconnectFailed | `ConnectionEventPayload` | Auto-reconnect failed (max retries reached). |
| onTokenWillExpire | `TokenLifecycleEventPayload` | Token will expire soon (triggered at ~80% lifetime). Fetch a new token and call renewToken. |
| onTokenExpired | `TokenLifecycleEventPayload` | Token has expired, re-login required. |
| onOfflineMessageSyncStart | `undefined` | Offline message sync started. |
| onOfflineMessageSyncFinish | `undefined` | Offline message sync finished. |
| onMessage | `Message` | New message received.
Triggered when: a new message arrives (single/group/chatroom).
Received by: message recipient (including sender's other devices). |
| onStreamMessage | `StreamMessage` | Stream message update.
Triggered when: a stream message (e.g., AI-generated content) has incremental updates.
Received by: message recipient. |
| onConversationListUpdate | `ConversationListUpdatePayload` | Conversation list updated. The payload always contains the current full and ordered ConversationItem snapshot; apps that preserve app-local fields can merge incrementally with patch.reset, patch.upserted, patch.removed, and patch.orderChanged. |
| onMessageRead | `ReadonlyArray<MessageReadEventPayload>` | Message read receipt list.
Triggered when: recipient sends one or more read receipts.
Received by: original message sender. |
| onMessageDelivered | `MessageDeliveredEventPayload` | Message delivery receipt.
Triggered when: recipient's SDK auto-sends delivery ack.
Received by: original message sender. |
| onConversationRead | `ConversationReadEventPayload` | Conversation read receipt.
Triggered when: the other party marks the entire conversation as read.
Received by: the other party in single chat (not triggered in group chat). |
| onMessageRecalled | `MessageRecalledEventPayload` | Message recalled.
Triggered when: sender recalls a message, or group owner/admin recalls another's message.
Received by: all members in the conversation (including recaller's other devices). |
| onMessageUpdated | `MessageUpdatedEventPayload` | Message updated (edited).
Triggered when: sender edits a sent message.
Received by: all members in the conversation (including editor's other devices). |
| onReactionChanged | `ReactionChangedEventPayload` | Message reaction changed.
Triggered when: a member adds or removes a reaction.
Received by: all members in the conversation (single/group chat only). |
| onPinnedMessageChanged | `PinnedMessageChangedEventPayload` | Pinned message changed.
Triggered when: a member pins or unpins a message.
Received by: all members in the conversation. |
| onChatThreadCreated | `ChatThreadCreatedEventPayload` | Chat thread created event. Received by all members of the parent group. |
| onChatThreadDestroyed | `ChatThreadDestroyedEventPayload` | Chat thread destroyed event. Received by all members of the parent group. |
| onChatThreadUpdated | `ChatThreadUpdatedEventPayload` | Chat thread updated event. Triggered when the thread name changes, or a reply message is added or recalled. Received by all members of the parent group. |
| onChatThreadUserRemoved | `ChatThreadUserRemovedEventPayload` | Current user removed from a chat thread by the group owner or admin. Received by the removed current user. |
| onMultiDeviceContact | `MultiDeviceContactEvent` | Multi-device contact event.
Received by: current user's other online devices. |
| onMultiDeviceGroup | `MultiDeviceGroupEvent` | Multi-device group event.
Received by: current user's other online devices. |
| onMultiDeviceThread | `MultiDeviceThreadEvent` | Multi-device thread event.
Received by: current user's other online devices. |
| onMultiDeviceConversation | `MultiDeviceConversationEvent` | Multi-device conversation event.
Received by: current user's other online devices. |
| onMultiDeviceMessageRemoved | `MultiDeviceMessageRemovedEvent` | Multi-device message removed event.
Received by: current user's other online devices. |
| onSyncDataStart | `SyncDataStartPayload` | Automatic data sync started. |
| onSyncDataFinished | `SyncDataFinishedPayload` | Automatic data sync finished. |
| onPresenceStatusChange | `ReadonlyArray<PresenceState>` | Subscribed user presence status changed.
Triggered when: a subscribed user's presence status changes.
Received by: the subscriber. |
| onContactInvited | `ContactRosterEventPayload` | Contact invitation received.
Received by: the invited user. |
| onContactDeleted | `ContactRosterEventPayload` | Removed from contact list by the other party.
Received by: the removed user. |
| onContactAdded | `ContactRosterEventPayload` | New contact added.
Triggered when: friend relationship established.
Received by: both parties. |
| onContactRefuse | `ContactRosterEventPayload` | Contact invitation declined.
Received by: the invitation sender. |
| onContactAgreed | `ContactRosterEventPayload` | Contact invitation accepted.
Received by: the invitation sender. |
| onContactInfoUpdated | `ContactInfoUpdatedEvent` | Contact info updated.
Received by: the subscriber. |
| onOwnInfoUpdated | `UserInfo` | Own user info updated.
Received by: all devices of the current user. |
| onUserInfoUpdated | `ReadonlyArray<UserInfo>` | Subscribed user info updated.
Received by: the subscriber. |
| onInvitationReceived | `GroupInvitationReceivedEventPayload` | Group invitation received. Received by: the invited user. |
| onRequestToJoinReceived | `GroupRequestToJoinReceivedEventPayload` | Group join request received. Received by: group owner and admins. |
| onRequestToJoinAccepted | `GroupRequestToJoinAcceptedEventPayload` | Group join request accepted. Received by: the applicant. |
| onRequestToJoinDeclined | `GroupRequestToJoinDeclinedEventPayload` | Group join request declined. Received by: the applicant. |
| onInvitationAccepted | `GroupInvitationAcceptedEventPayload` | Group invitation accepted. Received by: the invitation sender. |
| onInvitationDeclined | `GroupInvitationDeclinedEventPayload` | Group invitation declined. Received by: the invitation sender. |
| onUserRemoved | `GroupUserRemovedEventPayload` | Removed from group. Received by: the removed user + all group members. |
| onGroupDestroyed | `GroupDestroyedEventPayload` | Group destroyed. Received by: all group members. |
| onAutoAcceptInvitationFromGroup | `GroupAutoAcceptInvitationEventPayload` | Auto-accepted group invitation. Received by: the invited user. |
| onMuteListAdded | `GroupMuteListAddedEventPayload` | Member muted. Received by: all group members. |
| onMuteListRemoved | `GroupMuteListRemovedEventPayload` | Member unmuted. Received by: all group members. |
| onAllowListAdded | `GroupAllowListAddedEventPayload` | Member added to allowlist. Received by: all group members. |
| onAllowListRemoved | `GroupAllowListRemovedEventPayload` | Member removed from allowlist. Received by: all group members. |
| onAllMemberMuteStateChanged | `GroupAllMemberMuteStateChangedEventPayload` | All-member mute state changed. Received by: all group members. |
| onAdminAdded | `GroupAdminAddedEventPayload` | Admin added. Received by: all group members. |
| onAdminRemoved | `GroupAdminRemovedEventPayload` | Admin removed. Received by: all group members. |
| onOwnerChanged | `GroupOwnerChangedEventPayload` | Group owner changed. Received by: all group members. |
| onMembersJoined | `GroupMembersJoinedEventPayload` | New member joined group. Received by: all group members. |
| onMembersExited | `GroupMembersExitedEventPayload` | Member left group. Received by: all group members. |
| onAnnouncementChanged | `GroupAnnouncementChangedEventPayload` | Group announcement changed. Received by: all group members. |
| onSharedFileAdded | `GroupSharedFileAddedEventPayload` | Group shared file added. Received by: all group members. |
| onSharedFileDeleted | `GroupSharedFileDeletedEventPayload` | Group shared file deleted. Received by: all group members. |
| onGroupInfoChanged | `GroupInfoChangedEventPayload` | Group info changed. Received by: all group members. |
| onGroupDisabledChanged | `GroupDisabledChangedEventPayload` | Group disabled state changed. Received by: all group members. |
| onGroupMemberAttributeChanged | `GroupMemberAttributeChangedEventPayload` | Group member attribute changed. Received by: all group members. |
| onUserGroupNamecardUpdated | `GroupUserGroupNamecardUpdatedEventPayload` | Group namecard updated. Received by: all group members. |
| '__chatroom:onChatRoomDestroyed' | `ChatRoomDestroyedEventPayload` | Chat room destroyed. Received by: all chat room members. |
| '__chatroom:onMembersJoined' | `ChatRoomMembersJoinedEventPayload` | Member joined chat room. Received by: all chat room members. |
| '__chatroom:onMembersExited' | `ChatRoomMembersExitedEventPayload` | Member left chat room. Received by: all chat room members. |
| '__chatroom:onRemovedFromChatRoom' | `ChatRoomRemovedFromChatRoomEventPayload` | Removed from chat room. Received by: removed user + all chat room members. |
| '__chatroom:onMuteListAdded' | `ChatRoomMuteListAddedEventPayload` | Member muted. Received by: all chat room members. |
| '__chatroom:onMuteListRemoved' | `ChatRoomMuteListRemovedEventPayload` | Member unmuted. Received by: all chat room members. |
| '__chatroom:onAllowListAdded' | `ChatRoomAllowListAddedEventPayload` | Member added to allowlist. Received by: all chat room members. |
| '__chatroom:onAllowListRemoved' | `ChatRoomAllowListRemovedEventPayload` | Member removed from allowlist. Received by: all chat room members. |
| '__chatroom:onAllMemberMuteStateChanged' | `ChatRoomAllMemberMuteStateChangedEventPayload` | All-member mute state changed. Received by: all chat room members. |
| '__chatroom:onAdminAdded' | `ChatRoomAdminAddedEventPayload` | Admin added. Received by: all chat room members. |
| '__chatroom:onAdminRemoved' | `ChatRoomAdminRemovedEventPayload` | Admin removed. Received by: all chat room members. |
| '__chatroom:onOwnerChanged' | `ChatRoomOwnerChangedEventPayload` | Chat room owner changed. Received by: all chat room members. |
| '__chatroom:onAnnouncementChanged' | `ChatRoomAnnouncementChangedEventPayload` | Chat room announcement changed. Received by: all chat room members. |
| '__chatroom:onChatRoomInfoChanged' | `ChatRoomInfoChangedEventPayload` | Chat room info changed. Received by: all chat room members. |
| '__chatroom:onAttributesUpdate' | `ChatRoomAttributesUpdateEventPayload` | Chat room attributes updated. Received by: all chat room members. |
| '__chatroom:onAttributesRemoved' | `ChatRoomAttributesRemovedEventPayload` | Chat room attributes removed. Received by: all chat room members. |

## src/platform/types.ts

### PlatformAdapterError

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| code | `PlatformErrorCode` | - |
| stage | `PlatformErrorStage` | - |
| retryable | `boolean` | - |
| details | `Record<string, unknown>` | - |

### PlatformErrorOptions

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| code | `PlatformErrorCode` | - |
| stage | `PlatformErrorStage` | - |
| retryable | `boolean` | - |
| details | `Record<string, unknown>` | - |

### RequestConfig

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| url | `string` | - |
| method | `HttpMethod` | - |
| headers | `Record<string, string>` | - |
| body | `string | Record<string, unknown> | Uint8Array` | - |
| responseType | `'json' | 'text' | 'arraybuffer'` | - |
| timeoutMs | `number` | - |
| signal | `AbortSignal` | - |

### RequestResponse

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| status | `number` | - |
| headers | `Record<string, string>` | - |
| data | `TData` | - |

### RequestAdapter

#### Fields

| Name | Type | Description |
| --- | --- | --- |

### UploadSource

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| sourceType | `UploadSourceType` | - |
| file | `File | Blob` | - |
| path | `string` | - |
| uri | `string` | - |
| name | `string` | - |
| mimeType | `string` | - |
| size | `number` | - |

### ImageInfoResult

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| width | `number` | - |
| height | `number` | - |
| mimeType | `string` | - |
| fileSize | `number` | - |
| isGif | `boolean` | - |

### ImageGenerateOptions

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| maxShortEdge | `number` | - |
| quality | `number` | - |

### GeneratedImageResult

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| source | `UploadSource` | - |
| width | `number` | - |
| height | `number` | - |
| fileName | `string` | - |
| fileType | `string` | - |
| fileSize | `number` | - |
| webFile | `File` | - |

### ImageProcessor

#### Fields

| Name | Type | Description |
| --- | --- | --- |

### UploadProgress

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| loaded | `number` | - |
| total | `number` | - |
| percent | `number` | - |

### UploadConfig

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| url | `string` | - |
| headers | `Record<string, string>` | - |
| source | `UploadSource` | - |
| fields | `Record<string, string>` | - |
| timeoutMs | `number` | - |
| signal | `AbortSignal` | - |
| onProgress | `(progress: UploadProgress) => void` | - |

### UploadResult

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| status | `number` | - |
| body | `string` | - |

### UploadAdapter

#### Fields

| Name | Type | Description |
| --- | --- | --- |

### SocketConnectConfig

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| url | `string` | - |
| protocols | `string | string[]` | - |

### SocketLike

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| readyState | `number` | - |

### SocketAdapter

#### Fields

| Name | Type | Description |
| --- | --- | --- |

### RuntimeAdapter

#### Fields

| Name | Type | Description |
| --- | --- | --- |

### StorageAdapter

#### Fields

| Name | Type | Description |
| --- | --- | --- |

### ProtoAdapter

#### Fields

| Name | Type | Description |
| --- | --- | --- |

### PlatformAdapter

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| platform | `RuntimePlatform` | - |
| request | `RequestAdapter` | - |
| upload | `UploadAdapter` | - |
| socket | `SocketAdapter` | - |
| runtime | `RuntimeAdapter` | - |
| proto | `ProtoAdapter` | - |
| storage | `StorageAdapter` | - |
| imageProcessor | `ImageProcessor` | - |

### PlatformCapability

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| request | `boolean` | - |
| upload | `boolean` | - |
| socket | `boolean` | - |
| runtime | `boolean` | - |
| proto | `boolean` | - |
| storage | `boolean` | - |
| imageProcessor | `boolean` | - |

### PlatformAdapterProfile

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| platformId | `RuntimePlatform` | - |
| capability | `PlatformCapability` | - |

### PlatformAdapterOverrides

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| request | `RequestAdapter` | - |
| upload | `UploadAdapter` | - |
| socket | `SocketAdapter` | - |
| runtime | `RuntimeAdapter` | - |
| proto | `ProtoAdapter` | - |
| storage | `StorageAdapter` | - |
| imageProcessor | `ImageProcessor` | - |

### CreatePlatformAdapterOptions

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| prefer | `RuntimePlatform` | - |
| overrides | `PlatformAdapterOverrides | PlatformAdapterOverridesResolver` | - |

## src/cache/cache-types.ts

### ConversationListUpdatePatch

#### Description

Patch for a conversation-list update. Simple UIs can use `ConversationListUpdatePayload.items` directly; read this patch only when preserving app-local fields or doing fine-grained merges.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| reset | `boolean` | Whether this update rebuilds or replaces the whole conversation-list baseline. When `true`, the SDK established a new authoritative list, for example after cache load on login, full server sync, or fallback full refresh. Apps that keep app-local fields should reconcile against `items` by conversation key; simple UIs can use `items` directly. |
| upserted | `ReadonlyArray<ConversationItem>` | Conversations inserted or changed in SDK-owned fields during this update. |
| removed | `ReadonlyArray<ConversationIdentifier>` | Conversation identifiers removed in this update. |
| affectedKeys | `ReadonlyArray<string>` | Affected conversation keys in `${conversationType}:${conversationId}` format. |
| orderChanged | `boolean` | Whether the conversation-list order changed. The order may change even when `upserted` is empty, for example due to pinning, last-message time, or server ordering baseline changes. Patch-merging consumers should reorder their local list according to `items` when this is `true`; consumers using `items` directly need no extra handling. |

### ConversationListUpdatePayload

#### Description

Payload of `onConversationListUpdate`. `items` is always the SDK's current full, ordered `ConversationItem` snapshot; `patch` helps apps merge incrementally while preserving custom local fields.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| version | `number` | Conversation-list snapshot version, incremented for each effective dispatch and useful for ignoring stale events. |
| items | `ReadonlyArray<ConversationItem>` | Current full and ordered conversation-list snapshot. Simple UIs are recommended to render this field directly. |
| reason | `ConversationListUpdateReason` | Reason for this list update. |
| patch | `ConversationListUpdatePatch` | Patch for this update, useful for preserving app-local fields. |

## src/managers/chat-manager.ts

### ChatManager

### sendMessage(message: Message, options: SendMessageOptions) => Promise<Message>

#### Description

Sends a created message. Text, image, file, voice, video, location, command, custom, and combine messages are all sent through this API.

Event triggered: recipients (including sender's other devices) receive `onMessage`.
Attachment messages (image/file/voice/video) are auto-uploaded before sending.

#### Examples

```ts
const message = chatManager.createTextMessage({
  conversationId: 'user_2',
  conversationType: 'singleChat',
  content: 'hello',
});
const sent = await chatManager.sendMessage(message);
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| message | `Message` | Message object to send. |
| options | `SendMessageOptions` | Callbacks for the send lifecycle. |

#### Returns

Message object after it is sent successfully.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in send message | Check validation invalid and try again |
| 300 | not_connected | not connected occurred in send message | Check not connected and try again |
| 500 | encode_failed | encode failed occurred in send message | Check encode failed and try again |
| 1200 | MESSAGE_BLOCKED | Rejected by third-party content moderation | - |
| 215 | USER_MUTED | User is muted | - |

### createTextMessage(params: CreateTextMessageParams) => Message

#### Description

Creates a text message object. Call {@link ChatManager.sendMessage} to send it.

#### Examples

```ts
const message = chatManager.createTextMessage({
  conversationId: 'user_2',
  conversationType: 'singleChat',
  content: 'hello',
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `CreateTextMessageParams` | Parameters for creating a text message. |

#### Returns

Text message object.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | Conversation ID, conversation type, text content, extension, or receiver configuration is invalid | Pass a valid conversationId, conversationType, and non-empty content; receiverList and needGroupReadReceipt are only for group chat |

### createImageMessage(params: CreateImageMessageParams) => Message

#### Description

Creates an image message object. Supports a local file or a remote image URL.

#### Examples

```ts
const message = chatManager.createImageMessage({
  conversationId: 'group_1',
  conversationType: 'groupChat',
  data: imageFile,
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `CreateImageMessageParams` | Parameters for creating an image message. |

#### Returns

Image message object.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in create image message | Check validation invalid and try again |

### createFileMessage(params: CreateFileMessageParams) => Message

#### Description

Creates a file message object. Supports a local file or a remote file URL.

#### Examples

```ts
const message = chatManager.createFileMessage({
  conversationId: 'user_2',
  conversationType: 'singleChat',
  data: file,
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `CreateFileMessageParams` | Parameters for creating a file message. |

#### Returns

File message object.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in create file message | Check validation invalid and try again |

### createVoiceMessage(params: CreateVoiceMessageParams) => Message

#### Description

Creates a voice message object. Supports a local voice file or a remote voice URL.

#### Examples

```ts
const message = chatManager.createVoiceMessage({
  conversationId: 'user_2',
  conversationType: 'singleChat',
  data: voiceFile,
  duration: 3,
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `CreateVoiceMessageParams` | Parameters for creating a voice message. |

#### Returns

Voice message object.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in create voice message | Check validation invalid and try again |

### createVideoMessage(params: CreateVideoMessageParams) => Message

#### Description

Creates a video message object. Supports a local video file or a remote video URL.

#### Examples

```ts
const message = chatManager.createVideoMessage({
  conversationId: 'group_1',
  conversationType: 'groupChat',
  data: videoFile,
  duration: 12,
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `CreateVideoMessageParams` | Parameters for creating a video message. |

#### Returns

Video message object.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in create video message | Check validation invalid and try again |

### createLocationMessage(params: CreateLocationMessageParams) => Message

#### Description

Creates a location message object.

#### Examples

```ts
const message = chatManager.createLocationMessage({
  conversationId: 'user_2',
  conversationType: 'singleChat',
  latitude: 39.9042,
  longitude: 116.4074,
  address: 'Beijing',
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `CreateLocationMessageParams` | Parameters for creating a location message. |

#### Returns

Location message object.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in create location message | Check validation invalid and try again |

### createCmdMessage(params: CreateCmdMessageParams) => Message

#### Description

Creates a command message object. Command messages are usually used for business-defined control signaling.

#### Examples

```ts
const message = chatManager.createCmdMessage({
  conversationId: 'user_2',
  conversationType: 'singleChat',
  action: 'typing',
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `CreateCmdMessageParams` | Parameters for creating a command message. |

#### Returns

Command message object.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in create cmd message | Check validation invalid and try again |

### createCustomMessage(params: CreateCustomMessageParams) => Message

#### Description

Creates a custom message object. Use `event` and `params` to carry business-defined content.

#### Examples

```ts
const message = chatManager.createCustomMessage({
  conversationId: 'user_2',
  conversationType: 'singleChat',
  event: 'gift',
  params: { id: 'rose' },
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `CreateCustomMessageParams` | Parameters for creating a custom message. |

#### Returns

Custom message object.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in create custom message | Check validation invalid and try again |

### createCombineMessage(params: CreateCombineMessageParams) => Message

#### Description

Creates a combine message object for sending a collection of chat records.

#### Examples

```ts
const message = chatManager.createCombineMessage({
  conversationId: 'group_1',
  conversationType: 'groupChat',
  title: '聊天记录',
  summary: '3 条消息',
  messageList: selectedMessages,
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `CreateCombineMessageParams` | Parameters for creating a combine message. |

#### Returns

Combine message object.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in create combine message | Check validation invalid and try again |
| 4 | combine_level_exceeded | combine level exceeded occurred in create combine message | Check combine level exceeded and try again |
| 500 | combine_encode_failed | combine encode failed occurred in create combine message | Check combine encode failed and try again |

### getConversationList(filter: ConversationFilter) => ReadonlyArray<ConversationItem>

#### Description

Gets conversations from the local session-list cache, with optional filtering.

#### Examples

```ts
// 获取全部会话
const all = chatManager.getConversationList();
// 获取置顶会话
const pinned = chatManager.getConversationList({ isPinned: true });
// 获取指定标记的会话
const marked = chatManager.getConversationList({ mark: 3 });
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| filter | `ConversationFilter` | Optional filter criteria. |

#### Returns

Array of conversations matching the filter.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | Pagination cursor, pageSize, or includeEmptyConversations type is invalid | Use the cursor returned by the SDK and ensure pageSize is a positive integer and includeEmptyConversations is boolean |

### setCurrentConversation(params: ConversationLocator) => void

#### Description

Sets the conversation currently being viewed. After it is set, online messages received in this conversation still update the last message and list order, but do not increase the local unread count. This state is kept only in the current SDK session memory; call `resetCurrentConversation()` when leaving or closing the conversation.

#### Examples

```ts
chatManager.setCurrentConversation({
  conversationId: 'user_2',
  conversationType: 'singleChat',
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `ConversationLocator` | Locator of the conversation currently being viewed. |

#### Returns

No return value.

### resetCurrentConversation() => void

#### Description

Resets the conversation currently being viewed. After resetting it, online messages increase the local unread count according to the default rule.

#### Examples

```ts
chatManager.resetCurrentConversation();
```

#### Returns

No return value.

### getCurrentConversation() => ConversationLocator | null

#### Description

Gets the conversation currently being viewed, or `null` when none is set.

#### Examples

```ts
const current = chatManager.getCurrentConversation();
```

#### Returns

Locator of the conversation currently being viewed, or `null` when none is set.

### refreshSessionList(params: RefreshSessionListParams) => Promise<ReadonlyArray<ConversationItem>>

#### Description

Refreshes the conversation list from the server and returns the updated public conversation list.

#### Examples

```ts
const conversations = await chatManager.refreshSessionList({ includeEmpty: true });
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `RefreshSessionListParams` | Options for refreshing the session list. |

#### Returns

Refreshed public conversation list.

### deleteConversation(params: DeleteConversationParams) => Promise<ConversationMutationResult>

#### Description

Deletes a conversation and can optionally delete server-side roaming messages.
After deletion succeeds, the SDK also removes the local conversation-list cache entry. If the local conversation list changes, `onConversationListUpdate` is dispatched with `reason` set to `local`.

#### Examples

```ts
await chatManager.deleteConversation({
  conversationId: 'user_2',
  conversationType: 'singleChat',
  deleteRoamingMessages: false,
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `DeleteConversationParams` | Parameters for deleting a conversation. |

#### Returns

Conversation deletion result.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in delete conversation | Check validation invalid and try again |

### setConversationPinned(params: SetConversationPinnedParams) => Promise<ConversationMutationResult>

#### Description

Pins or unpins a conversation.

#### Examples

```ts
await chatManager.setConversationPinned({
  conversationId: 'group_1',
  conversationType: 'groupChat',
  pinned: true,
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `SetConversationPinnedParams` | Parameters for setting the pinned status. |

#### Returns

Conversation pinned-status mutation result.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in set conversation pinned | Check validation invalid and try again |

### addConversationMark(params: ConversationMarkParams) => Promise<ConversationMarkMutationResult>

#### Description

Adds a mark to one or more conversations.

#### Examples

```ts
await chatManager.addConversationMark({
  conversationId: 'user_2',
  conversationType: 'singleChat',
  mark: 0,
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `ConversationMarkParams` | Conversation mark parameters. |

#### Returns

Result of adding the conversation mark.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in add conversation mark | Check validation invalid and try again |

### removeConversationMark(params: ConversationMarkParams) => Promise<ConversationMarkMutationResult>

#### Description

Removes a mark from one or more conversations.

#### Examples

```ts
await chatManager.removeConversationMark({
  conversations: [
    { conversationId: 'user_2', conversationType: 'singleChat' },
  ],
  mark: 0,
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `ConversationMarkParams` | Conversation mark parameters. |

#### Returns

Result of removing the conversation mark.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in remove conversation mark | Check validation invalid and try again |

### clearAllMessagesAndConversations() => Promise<void>

#### Description

Clears all conversations and server-side roaming messages of the current user.
After clearing succeeds, the SDK also clears the local conversation/session-list cache. If the local conversation list changes, `onConversationListUpdate` is dispatched with `reason` set to `local`.

#### Examples

```ts
await chatManager.clearAllMessagesAndConversations();
```

#### Returns

Resolves after the cleanup completes.

### pinMessage(params: PinMessageParams) => Promise<void>

#### Description

Pins a message in the specified conversation.

Event triggered: all members in the conversation receive `onPinnedMessageChanged` (operation='pin').

#### Examples

```ts
await chatManager.pinMessage({
  conversationId: 'group_1',
  conversationType: 'groupChat',
  messageId: 'msg_1',
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `PinMessageParams` | Parameters for pinning a message. |

#### Returns

Pin-message mutation result.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | pin_msg_id_illegal | param pin_msg_id illegal, please check it! | - |
| 4 | pin_message_limit | pin message failed: pin message limit | - |
| 110 | pin_message_not_found | pin message failed: pin message not found | - |

### unpinMessage(params: PinMessageParams) => Promise<void>

#### Description

Unpins a message in the specified conversation.

Event triggered: all members in the conversation receive `onPinnedMessageChanged` (operation='unpin').

#### Examples

```ts
await chatManager.unpinMessage({
  conversationId: 'group_1',
  conversationType: 'groupChat',
  messageId: 'msg_1',
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `PinMessageParams` | Parameters for unpinning a message. |

#### Returns

Unpin-message mutation result.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | pin_msg_id_illegal | param pin_msg_id illegal, please check it! | - |
| 110 | pin_message_not_found | unpin message failed: pin message not found | - |

### getPinnedMessageList(params: GetPinnedMessageListParams) => Promise<PinnedMessageListResult>

#### Description

Gets pinned messages in a conversation. This API is not paginated, does not accept messageId, and returns at most 20 items.

#### Examples

```ts
const result = await chatManager.getPinnedMessageList({
  conversationId: 'group_1',
  conversationType: 'groupChat',
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `GetPinnedMessageListParams` | Conversation locator. |

#### Returns

Pinned message list.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 111 | operation_unsupported | get pinned message list failed: operation unsupported | - |
| 110 | pin_message_not_found | get pinned message list failed: pin message not found | - |

### addEventHandler(id: EventHandlerId, handlers: ChatEventHandlerMap) => void

#### Description

Registers chat-domain event handlers.

#### Examples

```ts
chatManager.addEventHandler('chat-page', {
  onMessage: event => {
    console.log(event.messages);
  },
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| id | `EventHandlerId` | Unique event handler ID. |
| handlers | `ChatEventHandlerMap` | Chat event handler map. |

#### Returns

No return value.

### removeEventHandler(id: EventHandlerId) => void

#### Description

Removes registered chat-domain event handlers.

#### Examples

```ts
chatManager.removeEventHandler('chat-page');
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| id | `EventHandlerId` | Unique event handler ID. |

#### Returns

No return value.

### markConversationRead(params: MarkConversationReadParams) => Promise<void>

#### Description

Marks the specified conversation as read.

Event triggered: the other party in a single chat receives `onConversationRead`; the local caller does not receive this event. Group chat only clears the server unread count and does not trigger a peer event.
After the mark succeeds, the SDK also clears the local conversation-list unread count. If the local conversation list changes, the local caller receives `onConversationListUpdate` with `reason` set to `local`.

#### Examples

```ts
await chatManager.markConversationRead({
  conversationId: 'user_2',
  conversationType: 'singleChat',
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `MarkConversationReadParams` | Conversation locator. |

#### Returns

Resolves after the conversation is marked as read.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in mark conversation read | Check validation invalid and try again |
| 201 | not_login | User is not logged in | - |
| 300 | not_connected | Not connected to server | - |
| 500 | message_invalid | No message in the conversation | - |

### markMessageRead(params: MarkMessageReadParams) => Promise<void>

#### Description

Marks messages as read in batch. Only received one-to-one or group messages in the same conversation can be acknowledged.

Event triggered: the original message sender receives `onMessageRead`; the local caller does not receive this event.
Note: group read receipts are valid for 3 days, max 200 members. Requires console activation.

#### Examples

```ts
await chatManager.markMessageRead({
  messages: [{ message }],
});

await chatManager.markMessageRead({
  messages: [
    { message: groupMessage1, ackContent: 'read-1' },
    { message: groupMessage2, ackContent: 'read-2' },
  ],
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `MarkMessageReadParams` | Parameters for marking messages as read. |

#### Returns

Resolves after all read receipts are sent.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in mark message read | Check validation invalid and try again |
| 110 | invalid_direction | Read receipts can only be sent for received messages | - |
| 300 | not_connected | Not connected to server | - |

### recallMessage(params: RecallMessageParams) => Promise<ChatActionResult>

#### Description

Recalls a sent message.

Event triggered: all members in the conversation (including recaller's other devices) receive `onMessageRecalled`.
Note: default 2-min window (configurable up to 7 days); group owner/admin can recall others' messages; all types except CMD supported.

#### Examples

```ts
const result = await chatManager.recallMessage({
  conversationId: 'user_2',
  conversationType: 'singleChat',
  messageId: 'msg_1',
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `RecallMessageParams` | Parameters for recalling a message. |

#### Returns

Recall action result.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in recall message | Check validation invalid and try again |
| 110 | message_invalid | Message is invalid or was not sent successfully | - |
| 201 | not_login | User is not logged in | - |
| 300 | not_connected | Not connected to server | - |
| 504 | recall_time_limit | Message recall time limit exceeded | - |
| 505 | recall_disabled | Message recall is not enabled | - |

### modifyMessage(params: UpdateMessageParams) => Promise<Message>

#### Description

Edits the content of a message. Currently only text and custom messages are supported.

Event triggered: all members in the conversation (including editor's other devices) receive `onMessageUpdated`.
Note: max 10 edits; no time limit; message roaming lifetime resets; requires console activation.

#### Examples

```ts
const updated = await chatManager.modifyMessage({
  conversationId: 'user_2',
  conversationType: 'singleChat',
  messageId: 'msg_1',
  message: {
    type: 'text',
    body: { content: 'updated text' },
    ext: {},
  },
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `UpdateMessageParams` | Parameters for editing a message. |

#### Returns

Edited message object.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in update message | Check validation invalid and try again |
| 111 | unsupported_type | Currently only text and custom messages can be edited | Check unsupported type and try again |
| 110 | message_invalid | Invalid message | - |
| 111 | unsupported_type | Currently only text and custom messages can be edited | Check unsupported type and try again |
| 201 | not_login | User is not logged in | - |
| 210 | permission_denied | No permission to edit this message | - |
| 300 | not_connected | Not connected to server | - |
| 511 | edit_failed | Message edit failed | - |

### getHistoryMessages(params: GetHistoryMessagesParams) => Promise<MessageHistoryPage>

#### Description

Fetches history messages from the server.

#### Examples

```ts
const page = await chatManager.getHistoryMessages({
  conversationId: 'group_1',
  conversationType: 'groupChat',
  pageSize: 20,
  searchDirection: 'up',
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `GetHistoryMessagesParams` | History-message query parameters. |

#### Returns

Paginated history-message result.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in get history messages | Check validation invalid and try again |
| 505 | service_not_enabled | this appKey not open message roaming | - |
| 110 | page_size_exceeded | get history messages failed: page size exceeded | - |

### searchMessages(params: SearchMessagesParams) => Promise<SearchMessagesResult>

#### Description

Server-side message search by keywords and filters. Requires enabling Message Search in Console.

#### Examples

```ts
const result = await chatManager.searchMessages({
  option: { keywordList: ['hello'] },
  pageNum: 1,
  pageSize: 20,
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `SearchMessagesParams` | Search parameters. |

#### Returns

Search result.

### downloadAttachment(params: DownloadAttachmentParams) => Promise<MessageAttachmentDownloadResult>

#### Description

Downloads a message attachment, such as image, voice, video, or file content.

#### Examples

```ts
const attachment = await chatManager.downloadAttachment({ message });
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `DownloadAttachmentParams` | Parameters for downloading an attachment. |

#### Returns

Attachment download result.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 401 | validation_invalid | validation invalid occurred in download message attachment | Check validation invalid and try again |
| 400 | not_found | Attachment does not exist | - |
| 401 | invalid | Attachment is invalid or the message type does not support download | - |
| 403 | download_failed | Attachment download failed | - |
| 407 | expired | Attachment has expired | - |

### downloadAndParseCombineMessage(params: DownloadCombineMessageInput) => Promise<ReadonlyArray<Message>>

#### Description

Downloads and parses a combine message, returning the child messages inside it.

#### Examples

```ts
const messages = await chatManager.downloadAndParseCombineMessage({ message: combineMessage });

const messagesFromBody = await chatManager.downloadAndParseCombineMessage({
  url: combineMessage.body.url,
  secret: combineMessage.body.secret,
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `DownloadCombineMessageInput` | Parameters for parsing a combine message; pass either the full combine message or the minimal download parameters from the combine message body. |

#### Returns

Child messages inside the combine message.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in download and parse combine message | Check validation invalid and try again |
| 110 | invalid_param | Message is empty | - |
| 500 | invalid_type | Message is not a combine message | - |
| 401 | parse_failed | Failed to parse combine message | - |
| 403 | download_failed | Failed to download combine message | - |

### removeHistoryMessages(params: RemoveHistoryMessagesParams) => Promise<void>

#### Description

Removes server-side history messages by message IDs or by timestamp.

#### Examples

```ts
await chatManager.removeHistoryMessages({
  conversationId: 'user_2',
  conversationType: 'singleChat',
  messageIds: ['msg_1'],
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `RemoveHistoryMessagesParams` | Parameters for removing history messages. |

#### Returns

Resolves after the messages are removed.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in remove history messages | Check validation invalid and try again |
| 505 | service_not_enabled | this appKey not open message roaming | - |
| 112 | query_param_reaches_limit | remove history messages failed: query param reaches limit | - |

### getGroupMessageReadUsers(params: GroupMessageReadUsersParams) => Promise<GroupMessageReadUsersResult>

#### Description

Gets the list of users who have read a specified group message.

#### Examples

```ts
const page = await chatManager.getGroupMessageReadUsers({
  groupId: 'group_1',
  messageId: 'msg_1',
  pageSize: 20,
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `GroupMessageReadUsersParams` | Parameters for querying group-message read users. |

#### Returns

Paginated result of group-message read users.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in get group message read users | Check validation invalid and try again |
| 500 | message_not_found | Message does not exist | - |

### addReaction(params: ReactionOperationParams) => Promise<void>

#### Description

Adds a reaction to a message.

Event triggered: all members in the conversation receive `onReactionChanged`.
Note: only single/group chat supported (not chatroom); each user can add the same reaction only once per message.

#### Examples

```ts
await chatManager.addReaction({
  messageId: 'msg_1',
  reaction: '👍',
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `ReactionOperationParams` | Parameters for adding a reaction. |

#### Returns

Resolves after the reaction is added.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in add reaction | Check validation invalid and try again |
| 1301 | reaction_already_operated | the user is already operation this message | - |
| 1300 | reaction_reach_limit | The quantity has exceeded the limit! | - |
| 602 | group_not_joined | The user not in this group! | - |
| 1302 | reaction_operation_illegal | the user operation is illegal! | - |
| 505 | service_not_enabled | this appKey is not open reaction service! | - |
| 302 | server_busy | this message is creating reaction, please try again. | - |

### removeReaction(params: ReactionOperationParams) => Promise<void>

#### Description

Removes the current user's reaction from a message.

Event triggered: all members in the conversation receive `onReactionChanged`.

#### Examples

```ts
await chatManager.removeReaction({
  messageId: 'msg_1',
  reaction: '👍',
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `ReactionOperationParams` | Parameters for removing a reaction. |

#### Returns

Resolves after the reaction is removed.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in remove reaction | Check validation invalid and try again |
| 505 | service_not_enabled | this appKey is not open reaction service! | - |
| 1302 | reaction_operation_illegal | the user operation is illegal! | - |

### getReactionList(params: GetReactionListParams) => Promise<ReadonlyArray<MessageReactionListItem>>

#### Description

Gets reaction summaries for one or more messages.

#### Examples

```ts
const list = await chatManager.getReactionList({
  messageId: ['msg_1', 'msg_2'],
  conversationType: 'groupChat',
  groupId: 'group_1',
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `GetReactionListParams` | Parameters for querying reaction summaries. |

#### Returns

Message reaction summary list.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in get reaction list | Check validation invalid and try again |
| 505 | service_not_enabled | this appKey is not open reaction service! | - |
| 600 | group_invalid_id | groupId can not be null! | - |

### getReactionDetail(params: GetReactionDetailParams) => Promise<MessageReactionDetailPage>

#### Description

Gets user details for a specified message reaction.

#### Examples

```ts
const page = await chatManager.getReactionDetail({
  messageId: 'msg_1',
  reaction: '👍',
  pageSize: 20,
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `GetReactionDetailParams` | Parameters for querying reaction details. |

#### Returns

Paginated reaction user detail result.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in get reaction detail | Check validation invalid and try again |
| 505 | service_not_enabled | this appKey is not open reaction service! | - |
| 1302 | reaction_operation_illegal | the user operation is illegal! | - |

### getSupportedTranslationLanguages() => Promise<ReadonlyArray<TranslationLanguage>>

#### Description

Gets the list of languages supported by the translation service.

#### Examples

```ts
const languages = await chatManager.getSupportedTranslationLanguages();
```

#### Returns

Supported translation language list.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 505 | service_not_enabled | Translation service is not enabled | - |

### translateMessage(params: TranslateMessageParams) => Promise<MessageTranslationResult>

#### Description

Translates a text message into one or more target languages.

#### Examples

```ts
const result = await chatManager.translateMessage({
  message,
  targetLanguages: ['en'],
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `TranslateMessageParams` | Parameters for translating a message. |

#### Returns

Message translation result.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 1110 | validation_invalid | validation invalid occurred in translate message | Check validation invalid and try again |
| 1110 | translate_text_too_long | The input text is too long. | - |
| 1110 | translate_param_invalid | The target language is not valid. | - |
| 1111 | service_not_enabled | Translation service is not enabled | - |
| 1112 | translate_usage_limit | Translation quota has been reached | - |
| 1113 | translate_failed | Translation service error | - |

### voiceMessageToText(voiceMessageBody: VoiceMessageBody, voiceParams: VoiceParams) => Promise<VoiceToTextResult>

#### Description

Converts the body of a sent or received voice message to text.

#### Examples

```ts
const result = await chatManager.voiceMessageToText(voiceMessage.body, {
  format: 'amr',
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| voiceMessageBody | `VoiceMessageBody` | Voice message body. |
| voiceParams | `VoiceParams` | Voice recognition parameters. |

#### Returns

Voice-to-text result.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 407 | validation_invalid | validation invalid occurred in voice message to text | Check validation invalid and try again |
| 410 | file_not_found | file not found occurred in voice message to text | Check file not found and try again |
| 202 | unauthorized | unauthorized occurred in voice message to text | Refresh the token and try again |
| 410 | file_not_found | file not found occurred in voice message to text | Check file not found and try again |
| 407 | file_invalid | Voice file format or content is invalid | Check file invalid and try again |
| 408 | duration_too_long | duration too long occurred in voice message to text | Check duration too long and try again |
| 411 | file_too_large | file too large occurred in voice message to text | Check file too large and try again |
| 505 | service_not_enabled | service not enabled occurred in voice message to text | Check service not enabled and try again |
| 4 | service_limit_exceeded | Voice-to-text usage limit reached | Check service limit exceeded and try again |
| 409 | voice_to_text_failed | voice to text failed occurred in voice message to text | Check voice to text failed and try again |

### voiceFileToText(file: VoiceSourceFile, voiceParams: VoiceParams) => Promise<VoiceToTextResult>

#### Description

Uploads a local voice file and converts it to text.

#### Examples

```ts
const result = await chatManager.voiceFileToText(file, {
  format: 'amr',
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| file | `VoiceSourceFile` | Local voice file. |
| voiceParams | `VoiceParams` | Voice recognition parameters. |

#### Returns

Voice-to-text result.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 407 | validation_invalid | validation invalid occurred in voice file to text | Check validation invalid and try again |
| 110 | upload_required | upload required occurred in voice file to text | Check upload required and try again |
| 202 | unauthorized | unauthorized occurred in voice file to text | Refresh the token and try again |
| 402 | upload_failed | Voice file upload failed | Check upload failed and try again |
| 407 | file_invalid | Voice file format or content is invalid | Check file invalid and try again |
| 408 | duration_too_long | duration too long occurred in voice file to text | Check duration too long and try again |
| 411 | file_too_large | file too large occurred in voice file to text | Check file too large and try again |
| 505 | service_not_enabled | service not enabled occurred in voice file to text | Check service not enabled and try again |
| 4 | service_limit_exceeded | Voice-to-text usage limit reached | Check service limit exceeded and try again |
| 409 | voice_to_text_failed | voice to text failed occurred in voice file to text | Check voice to text failed and try again |

## src/types/chat-manager.ts

### MarkMessageReadItem

#### Description

Single message item to mark as read.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| message | `Message` | Received message to mark as read. The SDK reads the conversation, type, and server message ID from this message. |
| ackContent | `string` | Optional group read-receipt content. Only applies to group chat. |

### MarkMessageReadParams

#### Description

Parameters for marking messages as read in batch.

All messages must belong to the same one-to-one or group conversation; the SDK sends server read receipts one by one.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| messages | `ReadonlyArray<MarkMessageReadItem>` | Messages to mark as read. Must be non-empty and belong to the same conversation. |

### RecallMessageParams

#### Description

Parameters for recalling a message.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| messageId | `string` | ID of the message to recall. |
| ext | `Record<string, unknown>` | Extension payload for the recall operation. |

### UpdateMessageParams

#### Description

Parameters for editing a message.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| messageId | `string` | ID of the message to edit. |
| message | `Pick<Message, 'type' | 'body' | 'ext'>` | New message content; currently only text and custom messages are supported. |

### RemoveHistoryMessagesParams

#### Description

Parameters for removing history messages.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| messageIds | `ReadonlyArray<string>` | Message IDs to remove. |
| beforeTimestamp | `number` | Removes history messages before this timestamp in milliseconds. |

### GetHistoryMessagesParams

#### Description

Parameters for fetching history messages.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| cursor | `string` | Pagination cursor; omit it for the first request. |
| pageSize | `number` | Number of messages per page. |
| searchDirection | `'up' | 'down'` | Search direction; `up` fetches older messages and `down` fetches newer messages. |
| senderIds | `ReadonlyArray<string>` | Sender IDs used to filter group-chat history. |
| messageTypes | `ReadonlyArray<Message['type']>` | Message types used for filtering. |
| startTime | `number` | Query start timestamp in milliseconds. |
| endTime | `number` | Query end timestamp in milliseconds. |

### MessageHistoryPage

#### Description

Paginated history-message result.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| items | `ReadonlyArray<Message>` | Messages in the current page. |
| cursor | `string` | Cursor for the next page; an empty string means no next cursor is available. |
| hasMore | `boolean` | Whether more history messages are available. |

### DownloadAttachmentParams

#### Description

Parameters for downloading a message attachment.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| message | `Message` | Message whose attachment should be downloaded, usually an image, voice, video, or file message. |

### MessageAttachmentDownloadResult

#### Description

Message attachment download result.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| filename | `string` | Attachment filename. |
| mimeType | `string` | Attachment MIME type. |
| size | `number` | Attachment size in bytes. |
| data | `Uint8Array` | Attachment binary data. |
| downloadUrl | `string` | Actual download URL. |

### DownloadCombineMessageByMessageInput

#### Description

Parameters for downloading and parsing a combine message with the full combine message object.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| message | `Message` | Combine message object. The SDK reads the download URL and secret from `message.body`. |
| timeoutMs | `number` | Download timeout in milliseconds; omitted to use the SDK default. |
| maxItems | `number` | Maximum number of messages to decode in one request; omitted to use the SDK default. |

### GroupMessageReadUsersParams

#### Description

Parameters for querying users who have read a group message.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | Group ID. |
| messageId | `string` | Group message ID. |
| cursor | `string` | Pagination cursor. |
| pageSize | `number` | Number of users per page. |

### GroupMessageReadUser

#### Description

User entry for group-message read receipt.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| userId | `string` | User ID. |
| user | `UserInfo` | User profile summary. |
| ackId | `string` | Server receipt ID. |
| timestamp | `number` | Read timestamp in milliseconds. |
| ackContent | `string` | Custom read-receipt content. |

### GroupMessageReadUsersResult

#### Description

Paginated result of users who have read a group message.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | Group ID. |
| messageId | `string` | Group message ID. |
| users | `ReadonlyArray<GroupMessageReadUser>` | Users in the current page. |
| count | `number` | Total number of users who have read the message. |
| cursor | `string` | Cursor for the next page. |
| hasMore | `boolean` | Whether more users are available. |

### ReactionOperationParams

#### Description

Parameters for adding or removing a message reaction.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| messageId | `string` | Message ID. |
| reaction | `string` | Reaction content, such as an emoji or business-defined identifier. |

### GetReactionListParams

#### Description

Parameters for fetching message reaction summaries.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| messageId | `string | ReadonlyArray<string>` | A message ID or a list of message IDs. |
| conversationType | `Extract<ChatConversationType, 'singleChat' | 'groupChat'>` | Conversation type; currently supports one-to-one and group chat. |
| groupId | `string` | Required group ID for group-chat reactions. |

### MessageReactionSummary

#### Description

Summary of a single reaction.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| reaction | `string` | Reaction content. |
| count | `number` | Number of users who added this reaction. |
| isAddedBySelf | `boolean` | Whether the current user has added this reaction. |
| userIds | `ReadonlyArray<string>` | User IDs that added this reaction. |

### MessageReactionListItem

#### Description

Reaction summary for one message.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| messageId | `string` | Message ID. |
| reactions | `ReadonlyArray<MessageReactionSummary>` | Reaction summaries on this message. |

### GetReactionDetailParams

#### Description

Parameters for fetching reaction details.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| cursor | `string` | Pagination cursor. |
| pageSize | `number` | Number of users per page. |

### ReactionUser

#### Description

User detail entry for a reaction.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| userId | `string` | User ID. |
| user | `UserInfo` | User profile summary. |
| createdAt | `string` | Time when the reaction was added. |

### MessageReactionDetailPage

#### Description

Paginated reaction detail result.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| reaction | `string` | Reaction content. |
| count | `number` | Number of users who added this reaction. |
| isAddedBySelf | `boolean` | Whether the current user has added this reaction. |
| reactionUsers | `ReadonlyArray<ReactionUser>` | Detailed user entries for this reaction. |
| cursor | `string` | Cursor for the next page. |
| hasMore | `boolean` | Whether more users are available. |
| createdAt | `string` | Reaction creation time. |

### TranslationLanguage

#### Description

Language supported by the translation service.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| code | `string` | Language code. |
| name | `string` | English name or server-returned language name. |
| nativeName | `string` | Native language name. |

### TranslateMessageParams

#### Description

Parameters for translating a message.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| message | `Message` | Text message to translate. |
| targetLanguages | `ReadonlyArray<string>` | Target language codes. |

### VoiceParams

#### Description

Optional parameters for voice-to-text recognition.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| format | `string` | Voice format such as `amr`, `mp3`, or `pcm`. |
| sampleRate | `number` | Audio sample rate. |
| bitsPerSample | `number` | Bits per sample. |
| channels | `number` | Channel count. |

### VoiceToTextResult

#### Description

Voice-to-text business result.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| text | `string` | Transcribed text. |

### MessageTranslation

#### Description

Single translation result.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| text | `string` | Translated text. |
| to | `string` | Target language code. |

### MessageTranslationResult

#### Description

Message translation result.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| detectedLanguage | `{
    /** [zh-CN] 源语言代码。 [en-US] Source language code. */
    language: string;
    /** [zh-CN] 识别置信度。 [en-US] Detection confidence score. */
    score: number;
  }` | Source language detected by the server. |
| translations | `ReadonlyArray<MessageTranslation>` | Translation result list. |

### MessageDeliveredEventPayload

#### Description

Message delivered event payload.

Triggered when: the recipient's SDK auto-sends a delivery ack, and the sender receives it.
Received by: the original message sender.
Prerequisite: the recipient initialized with `enableDeliveryReceipt: true`.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| messageId | `string` | ID of the original message that was delivered. |
| conversationId | `string` | Conversation ID. |
| conversationType | `'singleChat'` | Conversation type (always singleChat). |

### MessageReadEventPayload

#### Description

Message read receipt event payload.

Triggered when: the recipient sends a read receipt for a single-chat message,
or a group member sends a group message read receipt.
Received by: the original message sender.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| messageId | `string` | ID of the message marked as read. |
| ackContent | `string` | Content attached to the group read receipt. |

### ConversationReadEventPayload

#### Description

Conversation read receipt event payload.

Triggered when: the other party calls `markConversationRead` to mark the entire conversation as read.
Received by: the other party in a single chat (group chat read marking only clears server unread count without triggering this event).

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| timestamp | `number` | Timestamp when the conversation was marked as read. |

### MessageRecalledEventPayload

#### Description

Message recalled event payload.

Triggered when: the sender recalls a message, or a group owner/admin recalls another member's message.
Received by: all members in the conversation (including the recaller's other devices).

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| messageId | `string` | ID of the recalled message. |
| timestamp | `number` | Recall timestamp. |

### MessageUpdatedEventPayload

#### Description

Message updated (edited) event payload.

Triggered when: the sender edits a sent message.
Received by: all members in the conversation (including the editor's other devices).

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| messageId | `string` | ID of the edited message. |
| message | `Pick<Message, 'type' | 'body' | 'ext' | 'modifiedInfo'>` | Updated message content. |
| timestamp | `number` | Edit timestamp. |

### ReactionChangedEventPayload

#### Description

Reaction changed event payload.

Triggered when: a member adds or removes a reaction on a message.
Received by: all members in the conversation.
Note: only supported in single chat and group chat, NOT in chat rooms.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| messageId | `string` | Message ID. |
| reaction | `string` | Reaction emoji. |
| operation | `'add' | 'remove'` | Operation type. |

### PinnedMessageChangedEventPayload

#### Description

Pinned message changed event payload.

Triggered when: a member pins or unpins a message in the conversation.
Received by: all members in the conversation.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| messageId | `string` | Message ID. |
| operation | `'pin' | 'unpin'` | Operation type. |
| pinTime | `number` | Pin timestamp. |
| operatorId | `string` | Operator user ID. |

### ChatActionResult

#### Description

Message action result used by action-channel operations such as recall.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| messageId | `string` | Message ID. |
| conversationId | `string` | Conversation ID. |
| conversationType | `ChatConversationType` | Conversation type. |
| timestamp | `number` | Timestamp when the action completed, in milliseconds. |

### ChatMessageAction

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| kind | `'conversationRead' | 'messageRead' | 'groupMessageRead' | 'recall' | 'update'` | - |
| conversationId | `string` | - |
| conversationType | `ChatConversationType` | - |
| messageId | `string` | - |
| ackContent | `string` | - |
| body | `MessageBody` | - |
| type | `Message['type']` | - |
| ext | `Record<string, unknown>` | - |

### MessageSearchOption

#### Description

Message search option.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| keywordList | `ReadonlyArray<string>` | Search keyword list (required, max 5, each max 512 chars). |
| keywordListMatchType | `MessageSearchKeywordMatchType` | Keyword match type, defaults to 'or'. |
| conversationId | `string` | Conversation ID for in-conversation search. |
| msgTypes | `ReadonlyArray<SearchableMessageType>` | Message type filter (audio and cmd not supported). |
| startTime | `number` | Query start timestamp in ms, must be provided with endTime. |
| endTime | `number` | Query end timestamp in ms, must be provided with startTime. |
| searchScope | `MessageSearchScope` | Search scope: 'none' body only | 'with' body+ext | 'only' ext only. |
| direction | `MessageSearchDirection` | Sort direction: 'up' oldest first | 'down' newest first. |

### SearchMessagesParams

#### Description

Server message search parameters.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| option | `MessageSearchOption` | Search options. |
| pageNum | `number` | Page number starting from 1, defaults to 1. |
| pageSize | `number` | Page size, range 1-100, defaults to 20. |

### SearchResultMessage

#### Description

Single message in search result.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| highlight | `ReadonlyArray<string>` | Highlight snippets from server. |
| text | `string` | Summary text from server. |

### SearchMessagesResult

#### Description

Server message search result.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| messages | `ReadonlyArray<SearchResultMessage>` | Search result message list. |
| pageNum | `number` | Current page number. |
| pageSize | `number` | Requested page size. |
| totalPages | `number` | Total pages. |
| isLast | `boolean` | Whether this is the last page. |

## src/managers/chat-thread-manager.ts

### ChatThreadManager

### bind(client: ChatClient, context: ManagerEventContext) => void

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| client | `ChatClient` | - |
| context | `ManagerEventContext` | - |

### addEventHandler(id: EventHandlerId, handlers: ChatThreadEventHandlerMap) => void

#### Description

Registers chat thread event handlers. Only the four mobile-aligned public events are supported; `onChatThreadChange` is not exposed.

#### Examples

Usage example (listen for thread creation)
```ts
client.chatThreadManager.addEventHandler('thread-ui', {
  onChatThreadCreated: event => {
    console.log(event.chatThreadId);
  },
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| id | `EventHandlerId` | Event handler ID; using the same ID replaces the previous handler. |
| handlers | `ChatThreadEventHandlerMap` | Chat thread event handler map. |

#### Returns

Returns nothing.

### removeEventHandler(id: EventHandlerId) => void

#### Description

Removes a chat thread event handler by ID.

#### Examples

Usage example (remove listener)
```ts
client.chatThreadManager.removeEventHandler('thread-ui');
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| id | `EventHandlerId` | Event handler ID to remove. |

#### Returns

Returns nothing.

### getChatThread(chatThreadId: string) => ChatThread

#### Description

Gets a ChatThread facade bound to the specified `chatThreadId`.

#### Examples

Usage example (get facade)
```ts
const thread = client.chatThreadManager.getChatThread('thread-1');
const detail = await thread.getInfo();
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| chatThreadId | `string` | Chat thread ID. |

#### Returns

Returns a reusable ChatThread facade.

### createChatThread(params: CreateChatThreadParams) => Promise<CreateChatThreadResult>

#### Description

Creates a chat thread.

#### Examples

Usage example (create thread)
```ts
const result = await client.chatThreadManager.createChatThread({
  parentId: 'group-1',
  name: 'Topic',
  messageId: 'msg-1',
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `CreateChatThreadParams` | Creation parameters including parent group ID, thread name, and parent message ID. |

#### Returns

Returns the created chat thread ID.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in create chat thread | Check validation invalid and try again |
| 201 | not_login | Current user login state is unavailable or token is invalid | Log in again before creating a thread |
| 210 | permission_denied | permission denied occurred in create chat thread | Check permission denied and try again |
| 606 | resource_not_found | resource not found occurred in create chat thread | Check resource not found and try again |
| 4 | service_limit_exceeded | Thread count or creation frequency exceeds server limits | Check service limit exceeded and try again |
| 301 | request_timeout | Server processing timed out or network timed out | Try again later |
| 303 | service_error | Server returned an unspecified thread creation error | Try again later or contact the server team |

### getChatThreadList(params: GetChatThreadListParams) => Promise<ChatThreadListResult>

#### Description

Lists chat threads under a parent group.

#### Examples

Usage example (list group threads)
```ts
const page = await client.chatThreadManager.getChatThreadList({
  parentId: 'group-1',
  pageSize: 20,
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `GetChatThreadListParams` | Query parameters including parent group ID, page size, and cursor. |

#### Returns

Returns chat threads and the next cursor.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in get chat thread list | Check validation invalid and try again |
| 201 | not_login | Current user login state is unavailable or token is invalid | Log in again before querying the thread list |
| 210 | permission_denied | permission denied occurred in get chat thread list | Check permission denied and try again |
| 606 | resource_not_found | resource not found occurred in get chat thread list | Check resource not found and try again |
| 301 | request_timeout | Server processing timed out or network timed out | Try again later |
| 303 | service_error | Server returned an unspecified thread list query error | Try again later or contact the server team |

### getJoinedChatThreadList(params: GetJoinedChatThreadListParams) => Promise<ChatThreadListResult>

#### Description

Lists chat threads joined by the current user.

#### Examples

Usage example (list joined threads)
```ts
const page = await client.chatThreadManager.getJoinedChatThreadList({
  parentId: 'group-1',
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `GetJoinedChatThreadListParams` | Query parameters; `parentId` is optional. |

#### Returns

Returns joined chat threads and the next cursor.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in get joined chat thread list | Check validation invalid and try again |
| 201 | not_login | Current user login state is unavailable or token is invalid | Log in again before querying joined threads |
| 210 | permission_denied | permission denied occurred in get joined chat thread list | Check permission denied and try again |
| 606 | resource_not_found | resource not found occurred in get joined chat thread list | Check resource not found and try again |
| 301 | request_timeout | Server processing timed out or network timed out | Try again later |
| 303 | service_error | Server returned an unspecified joined thread query error | Try again later or contact the server team |

### getChatThreadInfo(params: GetChatThreadInfoParams) => Promise<ChatThreadDetail>

#### Description

Gets chat thread details.

#### Examples

Usage example (get detail)
```ts
const detail = await client.chatThreadManager.getChatThreadInfo({
  chatThreadId: 'thread-1',
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `GetChatThreadInfoParams` | Query parameters including the chat thread ID. |

#### Returns

Returns chat thread details.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in get chat thread info | Check validation invalid and try again |
| 201 | not_login | Current user login state is unavailable or token is invalid | Log in again before querying thread details |
| 210 | permission_denied | permission denied occurred in get chat thread info | Check permission denied and try again |
| 606 | resource_not_found | resource not found occurred in get chat thread info | Check resource not found and try again |
| 301 | request_timeout | Server processing timed out or network timed out | Try again later |
| 303 | service_error | Server returned an unspecified thread detail query error | Try again later or contact the server team |

### joinChatThread(params: ChatThreadMutationTarget) => Promise<void>

#### Description

Joins a chat thread.

#### Examples

Usage example (join thread)
```ts
await client.chatThreadManager.joinChatThread({ chatThreadId: 'thread-1' });
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `ChatThreadMutationTarget` | Operation target including the chat thread ID. |

#### Returns

Resolves with no business payload on success.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in join chat thread | Check validation invalid and try again |
| 201 | not_login | Current user login state is unavailable or token is invalid | Log in again before joining the thread |
| 210 | permission_denied | permission denied occurred in join chat thread | Check permission denied and try again |
| 606 | resource_not_found | resource not found occurred in join chat thread | Check resource not found and try again |
| 4 | service_limit_exceeded | service limit exceeded occurred in join chat thread | Check service limit exceeded and try again |
| 301 | request_timeout | Server processing timed out or network timed out | Try again later |
| 303 | service_error | Server returned an unspecified thread join error | Try again later or contact the server team |

### leaveChatThread(params: ChatThreadMutationTarget) => Promise<void>

#### Description

Leaves a chat thread.

#### Examples

Usage example (leave thread)
```ts
await client.chatThreadManager.leaveChatThread({ chatThreadId: 'thread-1' });
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `ChatThreadMutationTarget` | Operation target including the chat thread ID. |

#### Returns

Resolves with no business payload on success.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in leave chat thread | Check validation invalid and try again |
| 201 | not_login | Current user login state is unavailable or token is invalid | Log in again before leaving the thread |
| 210 | permission_denied | permission denied occurred in leave chat thread | Check permission denied and try again |
| 606 | resource_not_found | resource not found occurred in leave chat thread | Check resource not found and try again |
| 301 | request_timeout | Server processing timed out or network timed out | Try again later |
| 303 | service_error | Server returned an unspecified thread leave error | Try again later or contact the server team |

### destroyChatThread(params: ChatThreadMutationTarget) => Promise<void>

#### Description

Destroys a chat thread.

#### Examples

Usage example (destroy thread)
```ts
await client.chatThreadManager.destroyChatThread({ chatThreadId: 'thread-1' });
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `ChatThreadMutationTarget` | Operation target including the chat thread ID. |

#### Returns

Resolves with no business payload on success.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in destroy chat thread | Check validation invalid and try again |
| 201 | not_login | Current user login state is unavailable or token is invalid | Log in again before destroying the thread |
| 210 | permission_denied | permission denied occurred in destroy chat thread | Check permission denied and try again |
| 606 | resource_not_found | resource not found occurred in destroy chat thread | Check resource not found and try again |
| 301 | request_timeout | Server processing timed out or network timed out | Try again later |
| 303 | service_error | Server returned an unspecified thread destroy error | Try again later or contact the server team |

### updateChatThreadName(params: UpdateChatThreadNameParams) => Promise<void>

#### Description

Updates a chat thread name.

#### Examples

Usage example (update name)
```ts
await client.chatThreadManager.updateChatThreadName({
  chatThreadId: 'thread-1',
  name: 'New topic',
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `UpdateChatThreadNameParams` | Update parameters including the chat thread ID and new name. |

#### Returns

Resolves with no business payload on success.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in update chat thread name | Check validation invalid and try again |
| 201 | not_login | Current user login state is unavailable or token is invalid | Log in again before updating the thread name |
| 210 | permission_denied | permission denied occurred in update chat thread name | Check permission denied and try again |
| 606 | resource_not_found | resource not found occurred in update chat thread name | Check resource not found and try again |
| 301 | request_timeout | Server processing timed out or network timed out | Try again later |
| 303 | service_error | Server returned an unspecified thread name update error | Try again later or contact the server team |

### getChatThreadMemberList(params: GetChatThreadMemberListParams) => Promise<ChatThreadMemberListResult>

#### Description

Lists chat thread members.

#### Examples

Usage example (list members)
```ts
const page = await client.chatThreadManager.getChatThreadMemberList({
  chatThreadId: 'thread-1',
  pageSize: 20,
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `GetChatThreadMemberListParams` | Query parameters including chat thread ID, page size, and cursor. |

#### Returns

Returns members and the next cursor.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in get chat thread member list | Check validation invalid and try again |
| 201 | not_login | Current user login state is unavailable or token is invalid | Log in again before querying thread members |
| 210 | permission_denied | permission denied occurred in get chat thread member list | Check permission denied and try again |
| 606 | resource_not_found | resource not found occurred in get chat thread member list | Check resource not found and try again |
| 301 | request_timeout | Server processing timed out or network timed out | Try again later |
| 303 | service_error | Server returned an unspecified thread member list query error | Try again later or contact the server team |

### removeChatThreadMember(params: RemoveChatThreadMemberParams) => Promise<void>

#### Description

Removes a member from a chat thread.

#### Examples

Usage example (remove member)
```ts
await client.chatThreadManager.removeChatThreadMember({
  chatThreadId: 'thread-1',
  memberId: 'user-1',
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `RemoveChatThreadMemberParams` | Removal parameters including chat thread ID and member ID. |

#### Returns

Resolves with no business payload on success.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in remove chat thread member | Check validation invalid and try again |
| 201 | not_login | Current user login state is unavailable or token is invalid | Log in again before removing a thread member |
| 210 | permission_denied | permission denied occurred in remove chat thread member | Check permission denied and try again |
| 606 | resource_not_found | resource not found occurred in remove chat thread member | Check resource not found and try again |
| 301 | request_timeout | Server processing timed out or network timed out | Try again later |
| 303 | service_error | Server returned an unspecified thread member removal error | Try again later or contact the server team |

### getChatThreadLastMessageList(params: GetChatThreadLastMessageListParams) => Promise<ChatThreadLastMessageListResult>

#### Description

Gets the last messages of chat threads in batch.

#### Examples

Usage example (get last messages)
```ts
const result = await client.chatThreadManager.getChatThreadLastMessageList({
  chatThreadIds: ['thread-1', 'thread-2'],
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `GetChatThreadLastMessageListParams` | Query parameters including up to 20 chat thread IDs. |

#### Returns

Returns the last message snippet for each chat thread.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in get chat thread last message list | Check validation invalid and try again |
| 201 | not_login | Current user login state is unavailable or token is invalid | Log in again before querying thread last messages |
| 210 | permission_denied | permission denied occurred in get chat thread last message list | Check permission denied and try again |
| 606 | resource_not_found | resource not found occurred in get chat thread last message list | Check resource not found and try again |
| 301 | request_timeout | Server processing timed out or network timed out | Try again later |
| 303 | service_error | Server returned an unspecified thread last message query error | Try again later or contact the server team |

## src/managers/chat-thread/chat-thread.ts

### ChatThread

### getInfo() => Promise<ChatThreadDetail>

#### Description

Gets details of the current chat thread.

#### Examples

Usage example (get detail)
```ts
const thread = client.chatThreadManager.getChatThread('thread-1');
const detail = await thread.getInfo();
```

#### Returns

Returns chat thread details.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in get chat thread info | Check validation invalid and try again |
| 201 | not_login | Current user login state is unavailable or token is invalid | Log in again before querying thread details |
| 210 | permission_denied | permission denied occurred in get chat thread info | Check permission denied and try again |
| 606 | resource_not_found | resource not found occurred in get chat thread info | Check resource not found and try again |
| 301 | request_timeout | Server processing timed out or network timed out | Try again later |
| 303 | service_error | Server returned an unspecified thread detail query error | Try again later or contact the server team |

### refresh() => Promise<ChatThreadDetail>

#### Description

Refreshes and returns the current chat thread detail; equivalent to `getInfo()`.

#### Examples

Usage example (refresh detail)
```ts
const detail = await thread.refresh();
```

#### Returns

Returns the latest chat thread details.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in get chat thread info | Check validation invalid and try again |
| 201 | not_login | Current user login state is unavailable or token is invalid | Log in again before querying thread details |
| 210 | permission_denied | permission denied occurred in get chat thread info | Check permission denied and try again |
| 606 | resource_not_found | resource not found occurred in get chat thread info | Check resource not found and try again |
| 301 | request_timeout | Server processing timed out or network timed out | Try again later |
| 303 | service_error | Server returned an unspecified thread detail query error | Try again later or contact the server team |

### join() => Promise<void>

#### Description

Joins the current chat thread.

#### Examples

Usage example (join thread)
```ts
await thread.join();
```

#### Returns

Resolves with no business payload on success.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in join chat thread | Check validation invalid and try again |
| 201 | not_login | Current user login state is unavailable or token is invalid | Log in again before joining the thread |
| 210 | permission_denied | permission denied occurred in join chat thread | Check permission denied and try again |
| 606 | resource_not_found | resource not found occurred in join chat thread | Check resource not found and try again |
| 4 | service_limit_exceeded | service limit exceeded occurred in join chat thread | Check service limit exceeded and try again |
| 301 | request_timeout | Server processing timed out or network timed out | Try again later |
| 303 | service_error | Server returned an unspecified thread join error | Try again later or contact the server team |

### leave() => Promise<void>

#### Description

Leaves the current chat thread.

#### Examples

Usage example (leave thread)
```ts
await thread.leave();
```

#### Returns

Resolves with no business payload on success.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in leave chat thread | Check validation invalid and try again |
| 201 | not_login | Current user login state is unavailable or token is invalid | Log in again before leaving the thread |
| 210 | permission_denied | permission denied occurred in leave chat thread | Check permission denied and try again |
| 606 | resource_not_found | resource not found occurred in leave chat thread | Check resource not found and try again |
| 301 | request_timeout | Server processing timed out or network timed out | Try again later |
| 303 | service_error | Server returned an unspecified thread leave error | Try again later or contact the server team |

### destroy() => Promise<void>

#### Description

Destroys the current chat thread.

#### Examples

Usage example (destroy thread)
```ts
await thread.destroy();
```

#### Returns

Resolves with no business payload on success.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in destroy chat thread | Check validation invalid and try again |
| 201 | not_login | Current user login state is unavailable or token is invalid | Log in again before destroying the thread |
| 210 | permission_denied | permission denied occurred in destroy chat thread | Check permission denied and try again |
| 606 | resource_not_found | resource not found occurred in destroy chat thread | Check resource not found and try again |
| 301 | request_timeout | Server processing timed out or network timed out | Try again later |
| 303 | service_error | Server returned an unspecified thread destroy error | Try again later or contact the server team |

### updateName(input: { readonly name: string }) => Promise<void>

#### Description

Updates the current chat thread name.

#### Examples

Usage example (update name)
```ts
await thread.updateName({ name: 'New topic' });
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| input | `{ readonly name: string }` | Update input; `name` is the new chat thread name. |

#### Returns

Resolves with no business payload on success.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in update chat thread name | Check validation invalid and try again |
| 201 | not_login | Current user login state is unavailable or token is invalid | Log in again before updating the thread name |
| 210 | permission_denied | permission denied occurred in update chat thread name | Check permission denied and try again |
| 606 | resource_not_found | resource not found occurred in update chat thread name | Check resource not found and try again |
| 301 | request_timeout | Server processing timed out or network timed out | Try again later |
| 303 | service_error | Server returned an unspecified thread name update error | Try again later or contact the server team |

### getMemberList(query: {
    readonly pageSize?: number;
    readonly cursor?: string;
  }) => Promise<ChatThreadMemberListResult>

#### Description

Lists members of the current chat thread.

#### Examples

Usage example (list members)
```ts
const page = await thread.getMemberList({ pageSize: 20 });
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| query | `{
    readonly pageSize?: number;
    readonly cursor?: string;
  }` | Cursor pagination parameters. |

#### Returns

Returns members and the next cursor.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in get chat thread member list | Check validation invalid and try again |
| 201 | not_login | Current user login state is unavailable or token is invalid | Log in again before querying thread members |
| 210 | permission_denied | permission denied occurred in get chat thread member list | Check permission denied and try again |
| 606 | resource_not_found | resource not found occurred in get chat thread member list | Check resource not found and try again |
| 301 | request_timeout | Server processing timed out or network timed out | Try again later |
| 303 | service_error | Server returned an unspecified thread member list query error | Try again later or contact the server team |

### removeMember(input: Omit<RemoveChatThreadMemberParams, 'chatThreadId'>) => Promise<void>

#### Description

Removes a member from the current chat thread.

#### Examples

Usage example (remove member)
```ts
await thread.removeMember({ memberId: 'user-1' });
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| input | `Omit<RemoveChatThreadMemberParams, 'chatThreadId'>` | Removal input including the member ID. |

#### Returns

Resolves with no business payload on success.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in remove chat thread member | Check validation invalid and try again |
| 201 | not_login | Current user login state is unavailable or token is invalid | Log in again before removing a thread member |
| 210 | permission_denied | permission denied occurred in remove chat thread member | Check permission denied and try again |
| 606 | resource_not_found | resource not found occurred in remove chat thread member | Check resource not found and try again |
| 301 | request_timeout | Server processing timed out or network timed out | Try again later |
| 303 | service_error | Server returned an unspecified thread member removal error | Try again later or contact the server team |

## src/types/chat-thread.ts

### CreateChatThreadParams

#### Description

Parameters for creating a chat thread.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| parentId | `string` | Parent group ID. |
| name | `string` | Chat thread name. |
| messageId | `string` | Parent message ID. |

### CreateChatThreadResult

#### Description

Result returned after creating a chat thread.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| chatThreadId | `string` | Created chat thread ID. |

### GetChatThreadListParams

#### Description

Parameters for listing chat threads in a group.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| parentId | `string` | Parent group ID. |
| pageSize | `number` | Page size, defaults to 20, range 1-50. |
| cursor | `string` | Pagination cursor. |

### GetJoinedChatThreadListParams

#### Description

Parameters for listing chat threads joined by the current user.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| parentId | `string` | Optional parent group ID. |
| pageSize | `number` | Page size, defaults to 20, range 1-50. |
| cursor | `string` | Pagination cursor. |

### GetChatThreadInfoParams

#### Description

Parameters for getting chat thread details.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| chatThreadId | `string` | Chat thread ID. |

### GetChatThreadMemberListParams

#### Description

Parameters for listing chat thread members.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| chatThreadId | `string` | Chat thread ID. |
| pageSize | `number` | Page size, defaults to 20, range 1-50. |
| cursor | `string` | Pagination cursor. |

### GetChatThreadLastMessageListParams

#### Description

Parameters for getting the last messages of chat threads in batch.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| chatThreadIds | `ReadonlyArray<string>` | Chat thread ID list, up to 20 items. |

### ChatThreadMutationTarget

#### Description

Target for chat thread lifecycle operations.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| chatThreadId | `string` | Chat thread ID. |

### UpdateChatThreadNameParams

#### Description

Parameters for updating a chat thread name.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| name | `string` | New chat thread name. |

### RemoveChatThreadMemberParams

#### Description

Parameters for removing a member from a chat thread.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| memberId | `string` | User ID of the member to remove. |

### ChatThreadSummary

#### Description

Chat thread summary.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| chatThreadId | `string` | Chat thread ID. |
| parentId | `string` | Parent group ID. |
| name | `string` | Chat thread name. |
| ownerId | `string` | Chat thread owner user ID. |
| memberCount | `number` | Chat thread member count. |
| messageCount | `number` | Chat thread message count. |
| messageId | `string` | Parent message ID of the chat thread. |
| lastMessage | `MessageSnippet | null` | Last message snippet in the chat thread. |
| createdAt | `number` | Chat thread creation timestamp. |

### ChatThreadListResult

#### Description

Chat thread list result.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| items | `ReadonlyArray<ChatThreadSummary>` | Chat threads in the current page. |
| cursor | `string` | Next cursor, empty when no more or unknown. |

### ChatThreadMemberEntry

#### Description

Chat thread member entry.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| memberId | `string` | Member user ID. |
| joinedAt | `number` | Timestamp when the member joined. |

### ChatThreadMemberListResult

#### Description

Chat thread member list result.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| items | `ReadonlyArray<ChatThreadMemberEntry>` | Members in the current page. |
| cursor | `string` | Next cursor. |

### ChatThreadLastMessageEntry

#### Description

Last message entry for a chat thread.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| chatThreadId | `string` | Chat thread ID. |
| lastMessage | `MessageSnippet | null` | Last message snippet, or null when unavailable. |

### ChatThreadLastMessageListResult

#### Description

Batch result for chat thread last messages.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| items | `ReadonlyArray<ChatThreadLastMessageEntry>` | Last message entries. |

### ChatThreadBaseEventPayload

#### Description

Base payload shared by public chat thread events.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| chatThreadId | `string` | Chat thread ID. |
| parentId | `string` | Parent group ID. |
| operatorId | `string` | Operator user ID. |
| timestamp | `number` | Event timestamp. |

### ChatThreadCreatedEventPayload

#### Description

Payload for a chat thread created event.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| chatThreadName | `string` | Chat thread name. |
| messageId | `string` | Parent message ID. |
| thread | `ChatThreadSummary` | Normalized chat thread summary. |

### ChatThreadUpdatedEventPayload

#### Description

Payload for a chat thread updated event.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| chatThreadName | `string` | Chat thread name. |
| messageId | `string` | Parent message ID. |
| messageCount | `number` | Chat thread message count. |
| lastMessage | `MessageSnippet | null` | Last message snippet in the chat thread. |
| thread | `ChatThreadSummary` | Normalized chat thread summary. |

### ChatThreadUserRemovedEventPayload

#### Description

Payload for the current user being removed from a chat thread.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| memberId | `string` | Removed member user ID. |

### ChatThreadEventHandlerMap

#### Description

Public chat thread event handler map.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| onChatThreadCreated | `(
    event: ChatThreadCreatedEventPayload
  ) => void | Promise<void>` | - |
| onChatThreadDestroyed | `(
    event: ChatThreadDestroyedEventPayload
  ) => void | Promise<void>` | - |
| onChatThreadUpdated | `(
    event: ChatThreadUpdatedEventPayload
  ) => void | Promise<void>` | - |
| onChatThreadUserRemoved | `(
    event: ChatThreadUserRemovedEventPayload
  ) => void | Promise<void>` | - |

## src/types/index.ts

### MessageModifiedInfo

#### Description

Message modification information.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| operatorId | `string` | User ID of the operator who modified the message last time. |
| operationCount | `number` | Number of times the message has been modified. |
| operationTime | `number` | Timestamp of the last message modification in milliseconds. |

### MiniAppFile

#### Description

小程序/uniapp 本地文件对象

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| path | `string` | - |
| size | `number` | - |
| name | `string` | - |
| type | `string` | - |

### ReactNativeFile

#### Description

React Native 本地文件对象

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| uri | `string` | - |
| size | `number` | - |
| name | `string` | - |
| type | `string` | - |

### TextMessageBody

#### Description

文本消息体

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| content | `string` | - |
| targetLanguages | `string[]` | - |
| translations | `Record<string, string>` | - |

### ImageMessageBody

#### Description

图片消息体

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| localUrl | `string` | - |
| filename | `string` | - |
| filetype | `string` | - |
| width | `number` | - |
| height | `number` | - |
| isGif | `boolean` | - |
| isOriginalImage | `boolean` | - |
| originalImageUrl | `string` | - |
| bigImageUrl | `string` | - |
| secret | `string` | - |
| fileLength | `number` | - |
| thumbnailUrl | `string` | - |

### FileMessageBody

#### Description

文件消息体

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| url | `string` | - |
| filename | `string` | - |
| filetype | `string` | - |
| fileSize | `number` | - |
| fileLength | `number` | - |
| secret | `string` | - |

### VoiceMessageBody

#### Description

语音消息体

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| url | `string` | - |
| filename | `string` | - |
| filetype | `string` | - |
| duration | `number` | - |
| fileLength | `number` | - |
| secret | `string` | - |

### VideoMessageBody

#### Description

视频消息体

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| url | `string` | - |
| filename | `string` | - |
| filetype | `string` | - |
| duration | `number` | - |
| width | `number` | - |
| height | `number` | - |
| fileLength | `number` | - |
| secret | `string` | - |
| thumbnailUrl | `string` | - |

### LocationMessageBody

#### Description

位置消息体

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| latitude | `number` | - |
| longitude | `number` | - |
| address | `string` | - |
| buildingName | `string` | - |

### CmdMessageBody

#### Description

命令消息体

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| action | `string` | - |
| params | `Record<string, string>` | - |
| deliverOnlineOnly | `boolean` | - |

### CustomMessageBody

#### Description

自定义消息体

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| event | `string` | - |
| params | `Record<string, string>` | - |

### CombineMessageBody

#### Description

合并消息体

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| title | `string` | - |
| summary | `string` | - |
| compatibleText | `string` | - |
| messageList | `ReadonlyArray<Message>` | - |
| url | `string` | - |
| filename | `string` | - |
| filetype | `string` | - |
| fileLength | `number` | - |
| secret | `string` | - |
| combineLevel | `number` | - |

### Message

#### Description

Message object.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| msgServerId | `string` | Server message ID. |
| msgLocalId | `string` | Local message ID. |
| from | `string` | Sender user ID. |
| to | `string` | Receiver identifier: userId for one-to-one chat, groupId for group chat, and chatroomId for chat room. |
| sender | `Sender` | Sender profile summary. |
| conversationId | `string` | Conversation ID. |
| conversationType | `ChatConversationType` | Conversation type. |
| type | `MessageType` | Message type. |
| status | `MessageStatus` | Message status. |
| ext | `Record<string, unknown>` | Message extension payload. |
| timestamp | `number` | Message timestamp in milliseconds. |
| body | `MessageBody` | Message body. |
| direct | `MessageDirect` | Message direction. |
| isOnline | `boolean` | Whether this is an online message; `false` means an offline message. |
| receiverList | `string[]` | Target receiver list for directed messages. |
| deliverOnlineOnly | `boolean` | Whether to deliver only to online users. |
| webhookEnv | `string` | The webhookEnv field in the sending message protocol. |
| priority | `MessagePriority` | Message priority. |
| isBroadcast | `boolean` | Whether this is a broadcast message, mainly for chat-room inbound semantics. |
| isContentReplaced | `boolean` | Whether the content was replaced by moderation. |
| combineLevel | `number` | Combine message level, meaningful only when `type=combine`. |
| stream | `StreamMessageMeta` | Stream message metadata, provided only in stream-message callbacks. |
| reactions | `MessageReaction[]` | Message reaction list. |
| groupReadCount | `number` | Group message read count. |
| needGroupReadReceipt | `boolean` | Whether group read receipt is requested. |
| modifiedInfo | `MessageModifiedInfo` | Message modification information returned or delivered after the message is edited. |

### MessageReaction

#### Description

消息表情回应
Message reaction

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| reaction | `string` | 表情标识。Reaction emoji identifier. |
| count | `number` | 该表情的回应人数。Count of users who reacted with this emoji. |
| userList | `string[]` | 回应的用户 ID 列表。List of user IDs who reacted. |
| isAddedBySelf | `boolean` | 当前用户是否已添加该表情。Whether the current user has added this reaction. |

### CombineMessage

#### Description

合并消息对象

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| type | `'combine'` | - |
| body | `CombineMessageBody` | - |
| combineLevel | `number` | - |

### StreamMessageMeta

#### Description

流式消息元信息

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| customType | `string` | - |
| seq | `number` | - |
| status | `StreamMessageStatus` | - |
| errorType | `number` | - |
| finishReason | `number` | - |
| deltaText | `string` | - |
| fullText | `string` | - |

### StreamMessage

#### Description

流式消息事件

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| type | `'text'` | - |
| body | `TextMessageBody` | - |
| stream | `StreamMessageMeta` | - |

### FileUploadProgress

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| loaded | `number` | Uploaded bytes. |
| total | `number` | Total bytes. |
| percent | `number` | Upload progress percentage. |

### FileUploadResult

#### Description

File upload completion result.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| url | `string` | Remote file URL. |
| isOriginalImage | `boolean` | Whether the upload uses original-image semantics. |
| originalImageUrl | `string` | Original image URL. |
| bigImageUrl | `string` | Large image URL. |
| secret | `string` | Download secret. |
| fileLength | `number` | File size in bytes. |
| filetype | `string` | File MIME type. |
| filename | `string` | Filename. |
| thumbnailUrl | `string` | Thumbnail URL. |
| width | `number` | Image or video width in pixels. |
| height | `number` | Image or video height in pixels. |

### SendMessageOptions

#### Description

Optional callbacks for sending a message.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| onSending | `(message: Message) => void` | Called when the message starts sending. |
| onSuccess | `(message: Message) => void` | Called when the message is sent successfully. |
| onFailed | `(message: Message, error: Error) => void` | Called when sending fails. |
| onFileUploadProgress | `(progress: FileUploadProgress) => void` | Attachment upload progress callback. |
| onFileUploadComplete | `(result: FileUploadResult) => void` | Attachment upload completion callback. |
| onFileUploadError | `(error: Error) => void` | Attachment upload failure callback. |
| onFileUploadCanceled | `() => void` | Attachment upload cancellation callback. |

### DownloadCombineMessageParams

#### Description

Minimal parameters for downloading and parsing a combine message, usually taken from `url` and `secret` in the combine message body.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| url | `string` | Download URL for the combine message detail payload. |
| secret | `string` | Download secret; omit it when the server does not provide one. |
| timeoutMs | `number` | Download timeout in milliseconds; omitted to use the SDK default. |
| maxItems | `number` | Maximum number of messages to decode in one request; omitted to use the default limit of 300. |

### Connection

#### Description

连接对象（内存对象，不持久化）

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| status | `ConnectionStatus` | - |
| serverUrl | `string` | - |
| userId | `string` | - |
| token | `string` | - |
| lastConnectedAt | `number` | - |
| reconnectAttempts | `number` | - |
| error | `Error` | - |

## src/types/message-create.ts

### CreateMessageBaseParams

#### Description

Common parameters for creating messages.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| conversationId | `string` | Conversation ID; peer user ID for one-to-one chat, groupId for group chat, and chatroomId for chat room. |
| conversationType | `ChatConversationType` | Conversation type. |
| ext | `Record<string, unknown>` | Message extension payload, which should be JSON-serializable. |
| timestamp | `number` | Local timestamp in milliseconds; generated by the SDK when omitted. |
| receiverList | `string[]` | Target receiver list for directed messages. |
| deliverOnlineOnly | `boolean` | Whether to deliver only to online users. |
| webhookEnv | `string` | The webhookEnv field in the sending message protocol. |
| priority | `MessagePriority` | Message priority. |
| needGroupReadReceipt | `boolean` | Whether group read receipt is requested; only valid for group chat. |

### CreateTextMessageParams

#### Description

Parameters for creating a text message.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| content | `string` | Text message content. |
| targetLanguages | `string[]` | Target languages to translate to when sending. |

### CreateImageMessageParams

#### Description

Parameters for creating an image message. Either `data` or `originalUrl` is required. When `data` is provided, the SDK fills file metadata and resolves image dimensions before sending.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| data | `CompatibleFile` | Local file object. |
| originalUrl | `string` | Remote original image URL. |
| filename | `string` | Filename; auto-resolved from `data` when available. |
| filetype | `string` | File MIME type; auto-resolved from `data` when available. |
| width | `number` | Image width in pixels. |
| height | `number` | Image height in pixels. |
| isGif | `boolean` | Whether the image is a GIF. |
| isOriginalImage | `boolean` | Whether to send with original-image semantics. |
| fileLength | `number` | File size in bytes. |
| thumbnailUrl | `string` | Thumbnail URL. |

### CreateFileMessageParams

#### Description

Parameters for creating a file message. Either `data` or `originalUrl` is required.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| data | `CompatibleFile` | Local file object. |
| originalUrl | `string` | Remote file URL. |
| filename | `string` | Filename; auto-resolved from `data` when available. |
| filetype | `string` | File MIME type; auto-resolved from `data` when available. |
| fileSize | `number` | File size in bytes. |
| fileLength | `number` | File length in bytes; compatible with the server field. |

### CreateVoiceMessageParams

#### Description

Parameters for creating a voice message. Either `data` or `originalUrl` is required.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| data | `CompatibleFile` | Local voice file object. |
| originalUrl | `string` | Remote voice URL. |
| filename | `string` | Filename; auto-resolved from `data` when available. |
| filetype | `string` | File MIME type; auto-resolved from `data` when available. |
| duration | `number` | Voice duration in seconds. |
| fileLength | `number` | File size in bytes. |

### CreateVideoMessageParams

#### Description

Parameters for creating a video message. Either `data` or `originalUrl` is required.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| data | `CompatibleFile` | Local video file object. |
| originalUrl | `string` | Remote video URL. |
| filename | `string` | Filename; auto-resolved from `data` when available. |
| filetype | `string` | File MIME type; auto-resolved from `data` when available. |
| duration | `number` | Video duration in seconds. |
| width | `number` | Video width in pixels. |
| height | `number` | Video height in pixels. |
| fileLength | `number` | File size in bytes. |
| thumbnailUrl | `string` | Video thumbnail URL. |

### CreateLocationMessageParams

#### Description

Parameters for creating a location message.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| latitude | `number` | Latitude. |
| longitude | `number` | Longitude. |
| address | `string` | Address description. |
| buildingName | `string` | Building name. |

### CreateCmdMessageParams

#### Description

Parameters for creating a command message.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| action | `string` | Command action. |

### CreateCustomMessageParams

#### Description

Parameters for creating a custom message.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| event | `string` | Custom event name. |
| params | `Record<string, string>` | Custom parameters. |

### CreateCombineMessageParams

#### Description

Parameters for creating a combine message.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| title | `string` | Combine message title. |
| summary | `string` | Combine message summary. |
| compatibleText | `string` | Fallback display text, defaults to `[聊天记录]`. |
| messageList | `ReadonlyArray<Message>` | Messages included in the combine message. |

## src/types/message-conversation.ts

### MessageConversationLocator

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| conversationId | `string` | - |
| conversationType | `ChatConversationType` | - |

## src/types/conversation.ts

### ConversationIdentifier

#### Description

Unique conversation identifier.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| conversationId | `string` | Conversation ID; user ID for one-to-one chat, groupId for group chat, and chatroomId for chat room. |
| conversationType | `ConversationType` | Conversation type. |

### ConversationFilter

#### Description

Filter criteria for conversation list queries.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| isPinned | `boolean` | When true, returns only pinned conversations. |
| mark | `ConversationMark` | Filters by conversation mark slot, from 0 to 19. |

### DeleteConversationParams

#### Description

Parameters for deleting a conversation.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| deleteRoamingMessages | `boolean` | Whether to also delete server-side roaming messages. |

### SetConversationPinnedParams

#### Description

Parameters for setting the pinned status of a conversation.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| pinned | `boolean` | `true` pins the conversation and `false` unpins it. |

### ConversationMarkMutationItem

#### Description

Mutation result for one conversation mark target.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| reason | `string` | Failure reason; successful items do not include this field. |

### ConversationMarkMutationResult

#### Description

Conversation mark mutation result.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| succeeded | `ReadonlyArray<ConversationMarkMutationItem>` | Conversations that successfully applied this mark mutation. |
| failed | `ReadonlyArray<ConversationMarkMutationItem>` | Conversations that failed to apply this mark mutation. |
| mark | `ConversationMark` | Mark slot mutated by this operation. |
| operation | `'addMark' | 'removeMark'` | Mark operation type. |

### PinMessageParams

#### Description

Parameters for pinning or unpinning a message.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| messageId | `string` | Message ID. |

### ConversationMutationResult

#### Description

Conversation mutation result.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| conversationId | `string` | Conversation ID. |
| conversationType | `ConversationType` | Conversation type. |
| operation | `'delete' | 'setPinned'` | Operation type. |
| isPinned | `boolean` | Whether the conversation is pinned. |
| pinnedTime | `number` | Pinned timestamp in milliseconds. |

### MessagePinMutationResult

#### Description

Result of pinning or unpinning a message.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| conversationId | `string` | Conversation ID. |
| conversationType | `ConversationType` | Conversation type. |
| messageId | `string` | Message ID. |
| operation | `'pin' | 'unpin'` | Operation type. |

### PinnedMessageSummary

#### Description

Pinned message summary.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| messageId | `string` | Message ID. |
| conversationId | `string` | Conversation ID. |
| conversationType | `ConversationType` | Conversation type. |
| operatorId | `string` | User ID of the operator who pinned the message. |
| pinnedAt | `number` | Pinned timestamp in milliseconds. |
| message | `Message` | Full pinned message. |

### PinnedMessageListResult

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| items | `ReadonlyArray<PinnedMessageSummary>` | Pinned message summaries in the conversation, at most 20 items. |

### RefreshSessionListParams

#### Description

Request parameters for refreshing the new session list.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| includeEmpty | `boolean` | Whether empty sessions should be returned. |

### SessionMessageSnippet

#### Description

Minimal message snippet used by session list.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| msgServerId | `string` | Server message ID. |
| from | `string` | Sender user ID. |
| to | `string` | Receiver id; userId for one-to-one chat, groupId for group chat, and chatroomId for chat room. |
| sender | `Sender` | Sender information. |
| conversationId | `string` | Conversation ID. |
| conversationType | `ConversationType` | Conversation type. |
| type | `MessageType` | Message type. |
| status | `MessageStatus` | Message status. |
| timestamp | `number` | Message timestamp in milliseconds. |
| direct | `MessageDirect` | Message direction. |
| modifiedInfo | `MessageModifiedInfo` | Message modification information; present when the last message has been edited. |
| userInfoUpdateTime | `number` | Sender user-profile version timestamp in seconds; used for profile hydration. |
| namecardUpdateTime | `number` | Group member name-card version timestamp in seconds; present only for group-chat last messages. |
| body | `Record<string, unknown>` | Message body snippet; must not contain the `type` field. |

### ConversationItem

#### Description

Public conversation list item projected from the local conversation-list cache.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| conversationId | `string` | Conversation ID. |
| conversationType | `ConversationType` | Conversation type. |
| unreadCount | `number` | Unread message count. |
| lastMessage | `SessionMessageSnippet | null` | Last message snippet. |
| lastMessageAt | `number` | Timestamp of the last message in milliseconds. |
| isPinned | `boolean` | Whether the session is pinned. |
| pinnedTimestamp | `number` | Pinned timestamp in milliseconds. |
| marks | `ReadonlyArray<ConversationMark>` | Session mark list. |
| readAt | `number` | Read receipt position or timestamp. |
| remindType | `SessionListRemindType` | Session reminder type. |
| conversationName | `string` | Conversation display name. |
| conversationAvatar | `string` | Conversation avatar URL. |

## src/types/multi-device.ts

### MultiDeviceEventBase

#### Description

Shared base payload for MultiDevice events.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| category | `MultiDeviceEventCategory` | Event category. |
| operation | `| MultiDeviceContactOperation
    | MultiDeviceGroupOperation
    | MultiDeviceThreadOperation
    | MultiDeviceConversationOperation
    | MultiDeviceMessageRemovedOperation` | Normalized operation name. |
| deviceId | `string` | Source device id. |
| timestamp | `number` | Event timestamp. |
| raw | `Readonly<Record<string, unknown>>` | Raw diagnostic data. |

### MultiDeviceContactEvent

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| category | `'contact'` | - |
| operation | `MultiDeviceContactOperation` | - |
| targetUserId | `string` | - |
| rosterVersion | `string` | - |
| ext | `string` | - |

### MultiDeviceGroupEvent

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| category | `'group'` | - |
| operation | `MultiDeviceGroupOperation` | - |
| groupId | `string` | - |
| userIds | `ReadonlyArray<string>` | - |
| operatorId | `string` | - |
| groupName | `string` | - |

### MultiDeviceThreadEvent

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| category | `'thread'` | - |
| operation | `MultiDeviceThreadOperation` | - |
| threadId | `string` | - |
| parentId | `string` | - |
| userIds | `ReadonlyArray<string>` | - |
| operatorId | `string` | - |
| threadName | `string` | - |

### MultiDeviceConversationEvent

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| category | `'conversation'` | - |
| operation | `MultiDeviceConversationOperation` | - |
| conversationId | `string` | - |
| conversationType | `ConversationType` | - |
| mark | `number` | - |
| remindType | `string` | - |
| silentMode | `Readonly<Record<string, unknown>>` | - |
| operatorId | `string` | - |

### MultiDeviceMessageRemovedEvent

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| category | `'messageRemoved'` | - |
| operation | `MultiDeviceMessageRemovedOperation` | - |
| conversationId | `string` | - |
| conversationType | `ConversationType` | - |
| messageIds | `ReadonlyArray<string>` | - |
| beforeTimestamp | `number` | - |

### MultiDeviceEventHandlerMap

#### Description

ChatClient multi-device handler map.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| onMultiDeviceContact | `(
    event: MultiDeviceContactEvent
  ) => void | Promise<void>` | Contact multi-device event. |
| onMultiDeviceGroup | `(
    event: MultiDeviceGroupEvent
  ) => void | Promise<void>` | Group multi-device event. |
| onMultiDeviceThread | `(
    event: MultiDeviceThreadEvent
  ) => void | Promise<void>` | Chat-thread multi-device event. |
| onMultiDeviceConversation | `(
    event: MultiDeviceConversationEvent
  ) => void | Promise<void>` | Conversation multi-device event. |
| onMultiDeviceMessageRemoved | `(
    event: MultiDeviceMessageRemovedEvent
  ) => void | Promise<void>` | Roaming-message-removal multi-device event. |

## src/managers/chatroom-manager.ts

### ChatRoomManager

### addEventHandler(id: EventHandlerId, handlers: ChatRoomEventHandlerMap) => void

#### Description

Registers chat room event handlers, including member, mute, allowlist, announcement, and attribute changes.

#### Examples

Usage example (listen for members joined)
```ts
client.chatRoomManager.addEventHandler('chatroom-ui', {
  onMembersJoined: event => {
    console.log(event.chatRoomId, event.members);
  },
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| id | `EventHandlerId` | Unique handler ID used for later removal. |
| handlers | `ChatRoomEventHandlerMap` | Chat room event handler map; implement only callbacks you need. |

#### Returns

Returns nothing after registration.

#### Possible Errors

- Error code `110`: event context is not bound. Initialize the SDK and register ChatRoomManager first.

### removeEventHandler(id: EventHandlerId) => void

#### Description

Removes the chat room event handler registered with the given ID.

#### Examples

Usage example (remove a listener)
```ts
client.chatRoomManager.removeEventHandler('chatroom-ui');
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| id | `EventHandlerId` | Handler ID to remove. |

#### Returns

Returns nothing after removal.

#### Possible Errors

- Error code `110`: event context is not bound. Initialize the SDK and register ChatRoomManager first.

### getChatRoomList(params: GetChatRoomListParams) => Promise<{
    readonly items: ReadonlyArray<ChatRoomSummary>;
    readonly pageNum?: number;
    readonly pageSize?: number;
    readonly total?: number;
    readonly hasMore?: boolean;
  }>

#### Description

Gets the public chat room list by page and hydrates owner profiles when possible.

#### Examples

Usage example (get first page)
```ts
const result = await client.chatRoomManager.getChatRoomList({
  pageNum: 1,
  pageSize: 20,
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `GetChatRoomListParams` | Pagination parameters; `pageNum` starts from 1 and `pageSize` uses the server default when omitted. |

#### Returns

Returns chat room summaries and pagination information.

#### Possible Errors

- Throws a normalized SDK error when the REST request fails or login state is unavailable.

### getChatRoom(chatRoomId: string) => ChatRoom

#### Description

Gets a single-chatroom object bound to the given `chatRoomId` for member, announcement, attribute, and other operations.

#### Examples

Usage example (get a chat room object)
```ts
const chatRoom = client.chatRoomManager.getChatRoom('chatroom-1');
const detail = await chatRoom.getInfo();
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | Required chat room ID; must not be an empty string. |

#### Returns

Returns a reusable single-chatroom object.

#### Possible Errors

- Error code `110`: `chatRoomId` is empty. Pass a valid chat room ID.

### joinChatRoom(params: JoinChatRoomParams) => Promise<void>

#### Description

Joins the specified chat room. This method sends the join request through the realtime connection.

#### Examples

Usage example (join a chat room)
```ts
await client.chatRoomManager.joinChatRoom({
  chatRoomId: 'chatroom-1',
  ext: 'from-web',
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `JoinChatRoomParams` | Join parameters containing required `chatRoomId` and optional `ext` and `leaveOtherRooms`. |

#### Returns

Resolves with no business payload on success.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 4 | exceed_limit | exceed limit occurred in join chat room | Check exceed limit and try again |
| 704 | members_full | Chat room member count has reached the limit | Check members full and try again |
| 707 | user_in_blocklist | user in blocklist occurred in join chat room | Check user in blocklist and try again |
| 606 | resource_not_found | resource not found occurred in join chat room | Check resource not found and try again |

## src/managers/chatroom/chatroom.ts

### ChatRoom

### getInfo() => Promise<ChatRoomDetail>

#### Description

Gets details of the current chat room.

#### Examples

Usage example (get detail)
```ts
const chatRoom = client.chatRoomManager.getChatRoom('chatroom-1');
const detail = await chatRoom.getInfo();
```

#### Returns

Returns chat room details, announcement, permission, and current user status.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 606 | resource_not_found | resource not found occurred in get chat room info | Check resource not found and try again |

### refresh() => Promise<ChatRoomDetail>

#### Description

Refreshes and returns the current chat room detail; equivalent to `getInfo()`.

#### Examples

Usage example (refresh detail)
```ts
const detail = await chatRoom.refresh();
```

#### Returns

Returns the latest chat room detail.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 606 | resource_not_found | resource not found occurred in get chat room info | Check resource not found and try again |

### updateInfo(input: ChatRoomUpdateInfoInput) => Promise<ChatRoomUpdateResult>

#### Description

Updates the current chat room name, description, or maximum members.

#### Examples

Usage example (update chat room info)
```ts
await chatRoom.updateInfo({ name: 'SDK room' });
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| input | `ChatRoomUpdateInfoInput` | Update fields; at least one of `name/description/maxMembers` must be provided. |

#### Returns

Returns whether each field was updated.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | Current user is not chat room owner/admin and cannot update chat room info | Try again with a chat room owner/admin account |
| 110 | forbidden_op | forbidden op occurred in update chat room info | Check forbidden op and try again |
| 110 | illegal_argument | illegal argument occurred in update chat room info | Check illegal argument and try again |
| 606 | resource_not_found | resource not found occurred in update chat room info | Check resource not found and try again |

### leaveChatRoom() => Promise<void>

#### Description

Leaves the current chat room.

#### Examples

Usage example (leave chat room)
```ts
await chatRoom.leaveChatRoom();
```

#### Returns

Resolves with no business payload on success.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 606 | resource_not_found | resource not found occurred in leave chat room | Check resource not found and try again |

### getMembers(query: CursorPageParams) => Promise<ChatRoomMemberListResult>

#### Description

Gets members of the current chat room.

#### Examples

Usage example (get members)
```ts
const members = await chatRoom.getMembers({ pageSize: 20 });
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| query | `CursorPageParams` | Cursor pagination parameters; server defaults are used when omitted. |

#### Returns

Returns members, cursor, and whether another page may be available.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 606 | resource_not_found | resource not found occurred in get chat room member list | Check resource not found and try again |

### removeMembers(input: ChatRoomUserBatchInput) => Promise<ChatRoomMemberActionListResult>

#### Description

Removes members from the current chat room.

#### Examples

Usage example (remove members)
```ts
const result = await chatRoom.removeMembers({ userIds: ['user-1'] });
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| input | `ChatRoomUserBatchInput` | Removal input; `userIds` is required and must contain at least one user ID. |

#### Returns

Returns removal result for each target user.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | group authorization occurred in remove chat room members | Try again with a chat room owner/admin account |
| 606 | resource_not_found | resource not found occurred in remove chat room members | Check resource not found and try again |

### getAdminList() => Promise<ReadonlyArray<UserInfo>>

#### Description

Gets administrators of the current chat room.

#### Examples

Usage example (get administrators)
```ts
const admins = await chatRoom.getAdminList();
```

#### Returns

Returns administrator user profiles.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 606 | resource_not_found | resource not found occurred in get chat room admin list | Check resource not found and try again |

### addAdmin(input: ChatRoomAdminInput) => Promise<void>

#### Description

Sets a user as an administrator of the current chat room.

#### Examples

Usage example (add administrator)
```ts
await chatRoom.addAdmin({ userId: 'user-1' });
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| input | `ChatRoomAdminInput` | Administrator input; `userId` is required. |

#### Returns

Resolves with no business payload on success.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | group authorization occurred in set chat room admin | Check group authorization and try again |
| 606 | resource_not_found | resource not found occurred in set chat room admin | Check resource not found and try again |
| 204 | service_resource_not_found | service resource not found occurred in set chat room admin | Check service resource not found and try again |

### removeAdmin(input: ChatRoomAdminInput) => Promise<void>

#### Description

Removes an administrator from the current chat room.

#### Examples

Usage example (remove administrator)
```ts
await chatRoom.removeAdmin({ userId: 'user-1' });
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| input | `ChatRoomAdminInput` | Administrator input; `userId` is required. |

#### Returns

Resolves with no business payload on success.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | group authorization occurred in remove chat room admin | Check group authorization and try again |
| 606 | resource_not_found | resource not found occurred in remove chat room admin | Check resource not found and try again |

### getMuteList(page: ChatRoomPageParams) => Promise<ReadonlyArray<ChatRoomMuteEntry>>

#### Description

Gets the mute list of the current chat room.

#### Examples

Usage example (get mute list)
```ts
const mutes = await chatRoom.getMuteList({ pageNum: 1, pageSize: 20 });
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| page | `ChatRoomPageParams` | Page pagination parameters; server defaults are used when omitted. |

#### Returns

Returns muted users and expiration information.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 606 | resource_not_found | resource not found occurred in get chat room mute list | Check resource not found and try again |

### muteMembers(input: ChatRoomMuteMembersInput) => Promise<void>

#### Description

Mutes members in the current chat room.

#### Examples

Usage example (mute members)
```ts
await chatRoom.muteMembers({ userIds: ['user-1'], duration: 3600 });
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| input | `ChatRoomMuteMembersInput` | Mute input containing non-empty `userIds` and `duration` in seconds. |

#### Returns

Resolves with no business payload on success.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | illegal_argument | illegal argument occurred in mute chat room members | Check illegal argument and try again |
| 210 | group_authorization | group authorization occurred in mute chat room members | Try again with a chat room owner/admin account |
| 606 | resource_not_found | resource not found occurred in mute chat room members | Check resource not found and try again |

### unmuteMembers(input: ChatRoomUserBatchInput) => Promise<void>

#### Description

Unmutes members in the current chat room.

#### Examples

Usage example (unmute members)
```ts
await chatRoom.unmuteMembers({ userIds: ['user-1'] });
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| input | `ChatRoomUserBatchInput` | Unmute input; `userIds` is required and must contain at least one user ID. |

#### Returns

Resolves with no business payload on success.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | group authorization occurred in unmute chat room members | Try again with a chat room owner/admin account |
| 606 | resource_not_found | resource not found occurred in unmute chat room members | Check resource not found and try again |

### muteAllMembers() => Promise<void>

#### Description

Enables all-member mute in the current chat room.

#### Examples

Usage example (mute all members)
```ts
await chatRoom.muteAllMembers();
```

#### Returns

Resolves with no business payload on success.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | group authorization occurred in mute all chat room members | Try again with a chat room owner/admin account |
| 606 | resource_not_found | resource not found occurred in mute all chat room members | Check resource not found and try again |

### unmuteAllMembers() => Promise<void>

#### Description

Disables all-member mute in the current chat room.

#### Examples

Usage example (unmute all members)
```ts
await chatRoom.unmuteAllMembers();
```

#### Returns

Resolves with no business payload on success.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | group authorization occurred in unmute all chat room members | Try again with a chat room owner/admin account |
| 606 | resource_not_found | resource not found occurred in unmute all chat room members | Check resource not found and try again |

### checkIfInMuteList() => Promise<ChatRoomMuteStatus>

#### Description

Checks whether the current user is muted in the current chat room.

#### Examples

Usage example (check mute status)
```ts
const status = await chatRoom.checkIfInMuteList();
```

#### Returns

Returns whether the current user is muted and the expiration timestamp.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 606 | resource_not_found | resource not found occurred in is current user muted in chat room | Check resource not found and try again |

### getBlocklist(page: ChatRoomPageParams) => Promise<ReadonlyArray<ChatRoomBlocklistEntry>>

#### Description

Gets the blocklist of the current chat room.

#### Examples

Usage example (get blocklist)
```ts
const blocklist = await chatRoom.getBlocklist({ pageNum: 1, pageSize: 20 });
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| page | `ChatRoomPageParams` | Page pagination parameters; server defaults are used when omitted. |

#### Returns

Returns blocked users.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 606 | resource_not_found | resource not found occurred in get chat room blocklist | Check resource not found and try again |

### blockMembers(input: ChatRoomUserBatchInput) => Promise<ChatRoomMemberActionListResult>

#### Description

Adds members to the blocklist of the current chat room.

#### Examples

Usage example (block members)
```ts
const result = await chatRoom.blockMembers({ userIds: ['user-1'] });
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| input | `ChatRoomUserBatchInput` | Block input; `userIds` is required and must contain at least one user ID. |

#### Returns

Returns block result for each target user.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | group authorization occurred in block chat room members | Try again with a chat room owner/admin account |
| 606 | resource_not_found | resource not found occurred in block chat room members | Check resource not found and try again |
| 204 | service_resource_not_found | service resource not found occurred in block chat room members | Check service resource not found and try again |

### unblockMembers(input: ChatRoomUserBatchInput) => Promise<ChatRoomMemberActionListResult>

#### Description

Removes members from the blocklist of the current chat room.

#### Examples

Usage example (unblock members)
```ts
const result = await chatRoom.unblockMembers({ userIds: ['user-1'] });
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| input | `ChatRoomUserBatchInput` | Removal input; `userIds` is required and must contain at least one user ID. |

#### Returns

Returns unblock result for each target user.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | group authorization occurred in unblock chat room members | Try again with a chat room owner/admin account |
| 606 | resource_not_found | resource not found occurred in unblock chat room members | Check resource not found and try again |

### getAllowlist() => Promise<ReadonlyArray<{ readonly user: UserInfo }>>

#### Description

Gets the allowlist of the current chat room.

#### Examples

Usage example (get allowlist)
```ts
const allowlist = await chatRoom.getAllowlist();
```

#### Returns

Returns allowlisted users.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 606 | resource_not_found | resource not found occurred in get chat room allowlist | Check resource not found and try again |

### addUsersToAllowlist(input: ChatRoomUserBatchInput) => Promise<ChatRoomMemberActionListResult>

#### Description

Adds users to the allowlist of the current chat room.

#### Examples

Usage example (add users to allowlist)
```ts
const result = await chatRoom.addUsersToAllowlist({ userIds: ['user-1'] });
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| input | `ChatRoomUserBatchInput` | Add input; `userIds` is required and must contain at least one user ID. |

#### Returns

Returns add result for each target user.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | group authorization occurred in add users to chat room allowlist | Try again with a chat room owner/admin account |
| 606 | resource_not_found | resource not found occurred in add users to chat room allowlist | Check resource not found and try again |
| 204 | service_resource_not_found | service resource not found occurred in add users to chat room allowlist | Check service resource not found and try again |

### removeUsersFromAllowlist(input: ChatRoomUserBatchInput) => Promise<ChatRoomMemberActionListResult>

#### Description

Removes users from the allowlist of the current chat room.

#### Examples

Usage example (remove users from allowlist)
```ts
const result = await chatRoom.removeUsersFromAllowlist({ userIds: ['user-1'] });
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| input | `ChatRoomUserBatchInput` | Removal input; `userIds` is required and must contain at least one user ID. |

#### Returns

Returns removal result for each target user.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | group authorization occurred in remove users from chat room allowlist | Try again with a chat room owner/admin account |
| 606 | resource_not_found | resource not found occurred in remove users from chat room allowlist | Check resource not found and try again |

### checkIfInAllowList() => Promise<boolean>

#### Description

Checks whether the current user is in the allowlist of the current chat room.

#### Examples

Usage example (check allowlist status)
```ts
const status = await chatRoom.checkIfInAllowList();
```

#### Returns

Returns whether the current user is in the allowlist.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 606 | resource_not_found | resource not found occurred in check if in chat room allow list | Check resource not found and try again |

### getAnnouncement() => Promise<ChatRoomAnnouncement>

#### Description

Gets the announcement of the current chat room.

#### Examples

Usage example (get announcement)
```ts
const announcement = await chatRoom.getAnnouncement();
```

#### Returns

Returns the chat room ID and announcement content.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 606 | resource_not_found | resource not found occurred in get chat room announcement | Check resource not found and try again |

### updateAnnouncement(input: ChatRoomAnnouncementUpdateInput) => Promise<void>

#### Description

Updates the announcement of the current chat room.

#### Examples

Usage example (update announcement)
```ts
await chatRoom.updateAnnouncement({ announcement: 'Welcome' });
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| input | `ChatRoomAnnouncementUpdateInput` | Announcement update input; `announcement` is required. |

#### Returns

Resolves with no business payload on success.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | group authorization occurred in update chat room announcement | Try again with a chat room owner/admin account |
| 110 | forbidden_op | forbidden op occurred in update chat room announcement | Check forbidden op and try again |
| 606 | resource_not_found | resource not found occurred in update chat room announcement | Check resource not found and try again |

### getAttributes(input: GetChatRoomAttributesInput) => Promise<ChatRoomAttributesSnapshot>

#### Description

Gets attributes of the current chat room.

#### Examples

Usage example (get attributes)
```ts
const snapshot = await chatRoom.getAttributes({ keys: ['topic'] });
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| input | `GetChatRoomAttributesInput` | Query input; pass `keys` to get selected attributes or omit it to get all attributes. |

#### Returns

Returns a chat room attributes snapshot.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | illegal_argument | illegal argument occurred in get chat room attributes | Check illegal argument and try again |
| 606 | resource_not_found | resource not found occurred in get chat room attributes | Check resource not found and try again |

### setAttributes(input: SetChatRoomAttributesInput) => Promise<ChatRoomAttributeMutationResult>

#### Description

Sets attributes of the current chat room.

#### Examples

Usage example (set attributes)
```ts
const result = await chatRoom.setAttributes({
  attributes: { topic: 'sdk' },
  autoDelete: true,
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| input | `SetChatRoomAttributesInput` | Set input containing non-empty `attributes` and optional `autoDelete/isForced`. |

#### Returns

Returns applied and failed attribute keys.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | illegal_argument | illegal argument occurred in set chat room attributes | Check illegal argument and try again |
| 702 | chatroom_not_joined | Current user has not joined the target chat room and cannot set attributes | Join the chat room and try again |
| 703 | chatroom_permission_denied | chatroom permission denied occurred in set chat room attributes | Check chatroom permission denied and try again |
| 4 | exceed_limit | exceed limit occurred in set chat room attributes | Delete unused attributes and try again, or contact the server team to increase the quota |
| 210 | MetadataException | metadata exception occurred in set chat room attributes | Check metadata exception and try again |

### removeAttributes(input: RemoveChatRoomAttributesInput) => Promise<ChatRoomAttributeMutationResult>

#### Description

Removes attributes of the current chat room.

#### Examples

Usage example (remove attributes)
```ts
const result = await chatRoom.removeAttributes({ keys: ['topic'] });
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| input | `RemoveChatRoomAttributesInput` | Removal input; `keys` is required and must contain at least one attribute key, with optional `isForced`. |

#### Returns

Returns removed and failed attribute keys.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | illegal_argument | illegal argument occurred in remove chat room attributes | Check illegal argument and try again |
| 702 | chatroom_not_joined | chatroom not joined occurred in remove chat room attributes | Join the chat room and try again |
| 703 | chatroom_permission_denied | chatroom permission denied occurred in remove chat room attributes | Check chatroom permission denied and try again |
| 4 | exceed_limit | exceed limit occurred in remove chat room attributes | Check exceed limit and try again |
| 210 | MetadataException | metadata exception occurred in remove chat room attributes | Check metadata exception and try again |

## src/types/chatroom.ts

### ChatRoomSummary

#### Description

Summary information returned in chat room lists.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | Chat room ID. |
| name | `string` | Chat room name. |
| owner | `UserInfo` | Owner profile; the SDK hydrates it from cache or the user profile API when possible. |
| memberCount | `number` | Current member count. |
| disabled | `boolean` | Whether the chat room is disabled. |

### ChatRoomListResult

#### Description

Paginated chat room list result.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| items | `ReadonlyArray<ChatRoomSummary>` | Chat room summaries in the current page. |
| pageNum | `number` | Current page number starting from 1 when returned by the server. |
| pageSize | `number` | Page size of the current result. |
| total | `number` | Total count returned by the server. |
| hasMore | `boolean` | Whether another page may be available. |

### ChatRoomCurrentUserStatus

#### Description

Current user's status in a chat room.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| inAllowlist | `boolean` | Whether the current user is in the allowlist. |
| muted | `boolean` | Whether the current user is muted. |
| muteExpireAt | `number` | Mute expiration timestamp for the current user. |
| permissionType | `ChatRoomPermissionType` | Permission type of the current user. |

### ChatRoomDetail

#### Description

Chat room detail.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| description | `string` | Chat room description. |
| maxMembers | `number` | Maximum number of members allowed in the chat room. |
| createdAt | `number` | Creation timestamp, using the unit returned by the server. |
| ext | `string` | Chat room extension data. |
| announcement | `string` | Chat room announcement. |
| permissionType | `ChatRoomPermissionType` | Permission type of the current user. |
| currentUserStatus | `ChatRoomCurrentUserStatus` | Current user's status snapshot in the chat room. |

### ChatRoomPageParams

#### Description

Page-number pagination parameters.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| pageNum | `number` | Page number starting from 1; server default is used when omitted. |
| pageSize | `number` | Page size; server default is used when omitted. |

### GetChatRoomInfoParams

#### Description

Parameters for querying chat room detail.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | Required chat room ID. |

### ChatRoomUpdateInfoInput

#### Description

Input fields for updating chat room information.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| name | `string` | New chat room name; omitted fields are not changed. |
| description | `string` | New chat room description; omitted fields are not changed. |
| maxMembers | `number` | New maximum member count; omitted fields are not changed. |

### UpdateChatRoomInfoParams

#### Description

Parameters for updating chat room information.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | Required chat room ID. |

### ChatRoomUpdateResult

#### Description

Result of updating chat room information.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| nameUpdated | `boolean` | Whether the name was updated. |
| descriptionUpdated | `boolean` | Whether the description was updated. |
| maxMembersUpdated | `boolean` | Whether the maximum member count was updated. |

### ChatRoomMutationTarget

#### Description

Common operation target containing only a chat room ID.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | Required chat room ID. |

### JoinChatRoomParams

#### Description

Parameters for joining a chat room.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| ext | `string` | Extension data sent to the server when joining the chat room. |
| leaveOtherRooms | `boolean` | Whether to leave other joined chat rooms; server default applies when omitted. |

### ChatRoomUserBatchInput

#### Description

Input for batch user operations.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| userIds | `ReadonlyArray<string>` | Required user ID list with at least one valid user ID. |

### ChatRoomUserBatchParams

#### Description

Batch user operation parameters with a chat room ID.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| userIds | `ReadonlyArray<string>` | Required user ID list with at least one valid user ID. |

### ChatRoomAdminInput

#### Description

Input for a single administrator operation.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| userId | `string` | Required target user ID. |

### ChatRoomAdminParams

#### Description

Administrator operation parameters with a chat room ID.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| userId | `string` | Required target user ID. |

### ChatRoomMemberEntry

#### Description

Chat room member entry.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| user | `UserInfo` | Member user profile. |
| role | `ChatRoomRole` | Member role. |
| joinedAt | `number` | Timestamp when the member joined. |

### ChatRoomMemberListParams

#### Description

Parameters for querying chat room members.

### ChatRoomMemberListResult

#### Description

Chat room member list result.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| items | `ReadonlyArray<ChatRoomMemberEntry>` | Member entries. |
| cursor | `string` | Cursor for the next page; empty when the server does not return one. |
| hasMore | `boolean` | Whether another page may be available. |

### ChatRoomMemberActionResult

#### Description

Result of a single member operation.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | Chat room ID. |
| user | `UserInfo` | Target user profile. |
| action | `string` | Operation name. |
| reason | `string` | Failure reason, returned only when the operation fails. |

### ChatRoomMemberActionListResult

#### Description

Result of a batch member operation.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| succeeded | `ReadonlyArray<ChatRoomMemberActionResult>` | Target user results that succeeded. |
| failed | `ReadonlyArray<ChatRoomMemberActionResult>` | Target user results that failed. |

### ChatRoomMuteEntry

#### Description

Mute list entry.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| user | `UserInfo` | Muted user profile. |
| muteExpire | `number` | Mute expiration timestamp. |
| duration | `number` | Mute duration, usually in seconds, depending on server response. |

### ChatRoomMuteMembersInput

#### Description

Input for muting members.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| userIds | `ReadonlyArray<string>` | Required user IDs to mute. |
| duration | `number` | Mute duration in seconds. |

### ChatRoomMuteMembersParams

#### Description

Parameters for muting members with a chat room ID.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| userIds | `ReadonlyArray<string>` | Required user IDs to mute. |
| duration | `number` | Mute duration in seconds. |

### ChatRoomMuteStatus

#### Description

Mute status of the current user.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| muted | `boolean` | Whether the current user is muted. |
| muteExpireAt | `number` | Mute expiration timestamp. |

### ChatRoomMuteListParams

#### Description

Parameters for querying the mute list.

### ChatRoomAllowlistEntry

#### Description

Allowlist entry.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| user | `UserInfo` | Allowlisted user profile. |

### ChatRoomBlocklistEntry

#### Description

Blocklist entry.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| user | `UserInfo` | Blocked user profile. |

### ChatRoomBlocklistParams

#### Description

Parameters for querying the blocklist.

### ChatRoomAnnouncement

#### Description

Chat room announcement.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| announcement | `string` | Announcement content. |

### ChatRoomAnnouncementUpdateInput

#### Description

Input for updating the announcement.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| announcement | `string` | Required new announcement content. |

### ChatRoomAnnouncementUpdateParams

#### Description

Announcement update parameters with a chat room ID.

### ChatRoomSharedFile

#### Description

Chat room shared file entry.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| fileId | `string` | File ID. |
| fileName | `string` | File name. |
| fileOwner | `UserInfo` | File owner profile. |
| fileSize | `number` | File size in bytes. |
| createdAt | `number` | File creation timestamp. |

### ChatRoomSharedFileListParams

#### Description

Parameters for querying chat room shared files.

### ChatRoomSharedFileListResult

#### Description

Chat room shared file list result.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| items | `ReadonlyArray<ChatRoomSharedFile>` | Shared file entries. |
| pageNum | `number` | Current page number. |
| pageSize | `number` | Current page size. |
| cursor | `string` | Cursor for the next page. |
| hasMore | `boolean` | Whether another page may be available. |

### ChatRoomDeleteSharedFileInput

#### Description

Input for deleting a shared file.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| fileId | `string` | Required file ID. |

### DeleteChatRoomSharedFileParams

#### Description

Shared file deletion parameters with a chat room ID.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| fileId | `string` | Required file ID. |

### GetChatRoomAttributesInput

#### Description

Input for querying chat room attributes.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| keys | `ReadonlyArray<string>` | Attribute keys to query; all attributes are returned when omitted. |

### GetChatRoomAttributesParams

#### Description

Attribute query parameters with a chat room ID.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| keys | `ReadonlyArray<string>` | Attribute keys to query; all attributes are returned when omitted. |

### SetChatRoomAttributesInput

#### Description

Input for setting chat room attributes.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| attributes | `Readonly<Record<string, string>>` | Attribute key-value map to set; both keys and values must be strings. |
| autoDelete | `boolean` | Whether to auto-delete attributes set by the member when they leave. Defaults to `true`. |
| isForced | `boolean` | Whether to allow overwriting attributes set by other members. Defaults to `false`. |

### SetChatRoomAttributesParams

#### Description

Attribute set parameters with a chat room ID.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| attributes | `Readonly<Record<string, string>>` | Attribute key-value map to set; both keys and values must be strings. |
| autoDelete | `boolean` | Whether to auto-delete attributes set by the member when they leave. Defaults to `true`. |
| isForced | `boolean` | Whether to allow overwriting attributes set by other members. Defaults to `false`. |

### RemoveChatRoomAttributesInput

#### Description

Input for removing chat room attributes.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| keys | `ReadonlyArray<string>` | Required attribute keys to remove. |
| isForced | `boolean` | Whether to allow removing attributes set by other members. Defaults to `false`. |

### RemoveChatRoomAttributesParams

#### Description

Attribute removal parameters with a chat room ID.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| keys | `ReadonlyArray<string>` | Required attribute keys to remove. |
| isForced | `boolean` | Whether to allow removing attributes set by other members. Defaults to `false`. |

### ChatRoomAttributesSnapshot

#### Description

Chat room attributes snapshot.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | Chat room ID. |
| attributes | `Readonly<Record<string, string>>` | Attribute key-value map. |

### ChatRoomAttributeMutationResult

#### Description

Result of mutating chat room attributes.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | Chat room ID. |
| appliedKeys | `ReadonlyArray<string>` | Attribute keys that were applied successfully. |
| failedKeys | `Readonly<
    Record<string, { readonly code: number; readonly message: string }>
  >` | Map from failed attribute key to error details. |

### ChatRoomDestroyedEventPayload

#### Description

Payload for the chat room destroyed event.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | Chat room ID. |
| chatRoomName | `string` | Chat room name. |

### ChatRoomMembersJoinedEventPayload

#### Description

Payload for the members joined event.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | Chat room ID. |
| chatRoomName | `string` | Chat room name. |
| members | `ReadonlyArray<UserInfo>` | Members that joined the chat room. |
| ext | `string` | Extension data sent with the join operation. |

### ChatRoomMembersExitedEventPayload

#### Description

Payload for the members exited event.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | Chat room ID. |
| chatRoomName | `string` | Chat room name. |
| members | `ReadonlyArray<UserInfo>` | Members that exited the chat room. |

### ChatRoomRemovedFromChatRoomEventPayload

#### Description

Payload for the current user removed from chat room event.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| reason | `number` | Reason code for the removal. |
| chatRoomId | `string` | Chat room ID. |
| chatRoomName | `string` | Chat room name. |
| participant | `UserInfo` | Participant profile related to the removal. |

### ChatRoomMuteListAddedEventPayload

#### Description

Payload for the mute list added event.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | Chat room ID. |
| mutes | `ReadonlyArray<ChatRoomMuteEntry>` | Newly muted entries. |
| muteExpire | `number` | Mute expiration timestamp. |

### ChatRoomMuteListRemovedEventPayload

#### Description

Payload for the mute list removed event.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | Chat room ID. |
| mutes | `ReadonlyArray<UserInfo>` | User profiles removed from the mute list. |

### ChatRoomAllowListAddedEventPayload

#### Description

Payload for the allowlist added event.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | Chat room ID. |
| allowlist | `ReadonlyArray<UserInfo>` | User profiles added to the allowlist. |

### ChatRoomAllowListRemovedEventPayload

#### Description

Payload for the allowlist removed event.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | Chat room ID. |
| allowlist | `ReadonlyArray<UserInfo>` | User profiles removed from the allowlist. |

### ChatRoomAllMemberMuteStateChangedEventPayload

#### Description

Payload for the all-member mute state changed event.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | Chat room ID. |
| isMuted | `boolean` | Whether all-member mute is currently enabled. |

### ChatRoomAdminAddedEventPayload

#### Description

Payload for the administrator added event.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | Chat room ID. |
| admin | `UserInfo` | Newly added administrator profile. |

### ChatRoomAdminRemovedEventPayload

#### Description

Payload for the administrator removed event.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | Chat room ID. |
| admin | `UserInfo` | Removed administrator profile. |

### ChatRoomOwnerChangedEventPayload

#### Description

Payload for the owner changed event.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | Chat room ID. |
| newOwner | `UserInfo` | New owner profile. |
| oldOwner | `UserInfo` | Previous owner profile. |

### ChatRoomAnnouncementChangedEventPayload

#### Description

Payload for the announcement changed event.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | Chat room ID. |
| announcement | `string` | Latest announcement content. |

### ChatRoomInfoChangedEventPayload

#### Description

Payload for the chat room information changed event.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | Chat room ID. |
| chatRoomInfo | `ChatRoomDetail` | Latest chat room detail. |

### ChatRoomAttributesUpdateEventPayload

#### Description

Payload for the attributes update event.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | Chat room ID. |
| attributes | `Readonly<Record<string, string>>` | Updated attribute key-value map. |
| from | `UserInfo` | User profile that triggered the update. |

### ChatRoomAttributesRemovedEventPayload

#### Description

Payload for the attributes removed event.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | Chat room ID. |
| keyList | `ReadonlyArray<string>` | Removed attribute keys. |
| from | `UserInfo` | User profile that triggered the removal. |

### ChatRoomEventPayloadMap

#### Description

Mapping from chat room event names to payload types.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| onChatRoomDestroyed | `ChatRoomDestroyedEventPayload` | Payload for the chat room destroyed event. |
| onMembersJoined | `ChatRoomMembersJoinedEventPayload` | Payload for the members joined event. |
| onMembersExited | `ChatRoomMembersExitedEventPayload` | Payload for the members exited event. |
| onRemovedFromChatRoom | `ChatRoomRemovedFromChatRoomEventPayload` | Payload for the removed from chat room event. |
| onMuteListAdded | `ChatRoomMuteListAddedEventPayload` | Payload for the mute list added event. |
| onMuteListRemoved | `ChatRoomMuteListRemovedEventPayload` | Payload for the mute list removed event. |
| onAllowListAdded | `ChatRoomAllowListAddedEventPayload` | Payload for the allowlist added event. |
| onAllowListRemoved | `ChatRoomAllowListRemovedEventPayload` | Payload for the allowlist removed event. |
| onAllMemberMuteStateChanged | `ChatRoomAllMemberMuteStateChangedEventPayload` | Payload for the all-member mute state changed event. |
| onAdminAdded | `ChatRoomAdminAddedEventPayload` | Payload for the administrator added event. |
| onAdminRemoved | `ChatRoomAdminRemovedEventPayload` | Payload for the administrator removed event. |
| onOwnerChanged | `ChatRoomOwnerChangedEventPayload` | Payload for the owner changed event. |
| onAnnouncementChanged | `ChatRoomAnnouncementChangedEventPayload` | Payload for the announcement changed event. |
| onChatRoomInfoChanged | `ChatRoomInfoChangedEventPayload` | Payload for the chat room information changed event. |
| onAttributesUpdate | `ChatRoomAttributesUpdateEventPayload` | Payload for the attributes update event. |
| onAttributesRemoved | `ChatRoomAttributesRemovedEventPayload` | Payload for the attributes removed event. |

## src/managers/contact-manager.ts

### ContactManager

### getContacts() => ReadonlyArray<Contact>

#### Description

Gets the current in-memory contact list view.

#### Examples

Usage example (read contact list)
```ts
const contacts = client.contactManager.getContacts();
console.log(contacts[0]?.userId);
```

#### Returns

Returns the current contact list, or an empty array when no usable data is available.

### addContact(params: AddContactParams) => Promise<void>

#### Description

Sends a contact invitation.

#### Examples

Usage example (send a contact invitation)
```ts
await client.contactManager.addContact({
  userId: 'user-1',
  message: '我是 Alice',
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `AddContactParams` | Target user and optional invitation message. |

#### Returns

Resolves on success with no business payload.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in add contact | Check validation invalid and try again |
| 204 | USER_NOT_FOUND | Target user does not exist | Confirm the user ID is correct |
| 1000 | ALREADY_FRIEND | add contact failed: already friend | - |
| 210 | BLOCKED_BY_USER | add contact failed: blocked by user | - |
| 1001 | CONTACT_REACH_LIMIT | contact reach limit occurred in add contact | Check contact reach limit and try again |
| 1002 | CONTACT_REACH_LIMIT_PEER | contact reach limit peer occurred in add contact | Check contact reach limit peer and try again |

### deleteContact(params: ContactMutationTarget) => Promise<void>

#### Description

Deletes a contact and immediately patches the in-session contact snapshot.

#### Examples

Usage example (delete a contact)
```ts
await client.contactManager.deleteContact({
  userId: 'user-1',
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `ContactMutationTarget` | Target user. |

#### Returns

Resolves on success with no business payload.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in delete contact | Check validation invalid and try again |
| 204 | USER_NOT_FOUND | Target user does not exist | Confirm the user ID is correct |

### acceptContactInvite(params: ContactMutationTarget) => Promise<void>

#### Description

Accepts a contact invitation and triggers a controlled contact refresh.

#### Examples

Usage example (accept a contact invitation)
```ts
await client.contactManager.acceptContactInvite({
  userId: 'user-1',
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `ContactMutationTarget` | Target user. |

#### Returns

Resolves on success with no business payload.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in accept contact invite | Check validation invalid and try again |
| 204 | USER_NOT_FOUND | Target user does not exist | Confirm the user ID is correct |
| 1001 | CONTACT_REACH_LIMIT | contact reach limit occurred in accept contact invite | Check contact reach limit and try again |
| 1002 | CONTACT_REACH_LIMIT_PEER | contact reach limit peer occurred in accept contact invite | Check contact reach limit peer and try again |

### declineContactInvite(params: ContactMutationTarget) => Promise<void>

#### Description

Declines a contact invitation.

#### Examples

Usage example (decline a contact invitation)
```ts
await client.contactManager.declineContactInvite({
  userId: 'user-1',
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `ContactMutationTarget` | Target user. |

#### Returns

Resolves on success with no business payload.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in decline contact invite | Check validation invalid and try again |
| 204 | USER_NOT_FOUND | Target user does not exist | Confirm the user ID is correct |

### setContactRemark(params: SetContactRemarkParams) => Promise<void>

#### Description

Sets a contact remark. Empty string is allowed to clear the remark.

#### Examples

Usage example (set a contact remark)
```ts
await client.contactManager.setContactRemark({
  userId: 'user-1',
  remark: '产品同学',
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `SetContactRemarkParams` | Target user and remark content. |

#### Returns

Resolves on success with no business payload.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in set contact remark | Check validation invalid and try again |
| 223 | illegal_argument | Target user is not a friend of the current user | Add the user as a friend before setting a remark |
| 4 | remark_length_exceeded | remark length exceeded occurred in set contact remark | Shorten the remark and try again |

### getBlocklist() => Promise<ReadonlyArray<UserInfo>>

#### Description

Gets the current user's blocklist.

#### Examples

Usage example (get blocklist)
```ts
const blocklist = await client.contactManager.getBlocklist();
console.log(blocklist.map(item => item.userId));
```

#### Returns

Returns blocked user profiles.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 606 | resource_not_found | resource not found occurred in get chat room blocklist | Check resource not found and try again |

### addUsersToBlocklist(params: BlocklistMutationParams) => Promise<BlocklistAddResult>

#### Description

Adds users to the blocklist. Duplicate values are deduplicated before request while preserving input order.

#### Examples

Usage example (add users to blocklist)
```ts
const result = await client.contactManager.addUsersToBlocklist({
  userIds: ['user-1', 'user-2'],
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `BlocklistMutationParams` | User ids to add to the blocklist. |

#### Returns

Returns succeeded and failed user profile lists.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in add users to blocklist | Check validation invalid and try again |
| 204 | service_resource_not_found | Target user does not exist | Confirm the user ID is correct |
| 4 | blocklist_limit_exceeded | Blocklist size reaches the server limit | Remove unnecessary blocked users and try again |

### removeUserFromBlocklist(params: BlocklistMutationParams) => Promise<void>

#### Description

Removes users from the blocklist. Duplicate values are deduplicated before request while preserving input order.

#### Examples

Usage example (remove users from blocklist)
```ts
await client.contactManager.removeUserFromBlocklist({
  userIds: ['user-1'],
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `BlocklistMutationParams` | User ids to remove from the blocklist. |

#### Returns

Resolves on success with no business payload.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in remove user from blocklist | Check validation invalid and try again |

### addEventHandler(id: string, handlers: ContactEventHandlerMap) => void

#### Description

Registers contact event handlers for contact relation events. Observe automatic sync progress through ChatClient-level unified sync events.

#### Examples

Usage example (listen for contact added events)
```ts
client.contactManager.addEventHandler('contact-ui', {
  onContactAdded: event => {
    console.log(event.from);
  },
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| id | `string` | Unique handler id used for later removal. |
| handlers | `ContactEventHandlerMap` | Contact handler collection with callbacks implemented as needed. |

#### Returns

Returns nothing after registration.

### removeEventHandler(id: string) => void

#### Description

Removes a previously registered contact sync event handler.

#### Examples

Usage example (remove a contact event handler)
```ts
client.contactManager.removeEventHandler('contact-ui');
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| id | `string` | Handler id to remove. |

#### Returns

Returns nothing after removal.

## src/types/contact.ts

### Contact

#### Description

Contact view object.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| userId | `string` | Contact user id. |
| userInfo | `UserInfo` | Contact user info view backed by the shared `UserInfo` model. |
| remark | `string` | Remark set by current user for this contact. |
| addTs | `number` | Timestamp when the contact relation was created. |

### ContactInfoUpdatedEvent

#### Description

Event payload of friend profile changes.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| userInfo | `UserInfo` | Latest friend profile. |
| contact | `Contact` | Contact snapshot when available in the current session. |

### ContactMutationTarget

#### Description

Shared target object for contact mutation APIs.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| userId | `string` | Target user id. |

### AddContactParams

#### Description

Input parameters for adding a contact.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| message | `string` | Optional invitation message. |

### SetContactRemarkParams

#### Description

Input parameters for updating a contact remark.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| remark | `string` | Contact remark. Empty string is allowed to clear the remark. |

### BlocklistMutationParams

#### Description

Input parameters for blocklist mutation APIs.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| userIds | `ReadonlyArray<string>` | User ids to mutate. |

### BlocklistAddResult

#### Description

Successful result of adding users to the blocklist.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| succeeded | `ReadonlyArray<UserInfo>` | User profiles successfully added to the blocklist. |
| failed | `ReadonlyArray<UserInfo>` | User profiles that failed to be added. |

### BlocklistSnapshot

#### Description

Session-scoped blocklist snapshot.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| items | `ReadonlyArray<UserInfo>` | Current blocklist entries. |
| loaded | `boolean` | Whether the current session has loaded blocklist data from server. |
| source | `'server' | 'mutation_patch'` | Snapshot source. |

### ContactRosterEventPayload

#### Description

Normalized payload of legacy contact roster events.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| type | `ContactRosterEventType` | Legacy relation type carried by the original event. |
| from | `string` | Sender user id of the roster event. |
| to | `string` | Receiver user id of the roster event. |
| status | `string` | Status or reason string returned by the server. |
| rosterVersion | `string` | Current roster version carried by the event. |
| userInfo | `UserInfo` | User info view for the event target. It is enriched before public dispatch and always includes at least `userId`. |

### ContactSnapshot

#### Description

Contact snapshot including list, source, version, and completeness metadata.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| items | `ReadonlyArray<Contact>` | Contact list contained in the current snapshot. |
| source | `ContactSyncSource` | Whether the snapshot comes from cache or sync result. |
| version | `string` | Contact version associated with the snapshot. |
| complete | `boolean` | Whether the snapshot is complete enough to be used as the full contact result. |

### ContactSyncError

#### Description

Contact sync error object.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| code | `ErrorCode` | SDK error code. |
| stage | `ContactSyncStage` | Stage where the error occurred. |
| message | `string` | Caller-facing error message. |
| retryable | `boolean` | Whether retry is recommended for this error. |

### ContactSyncFinishPayload

#### Description

Internal contact sync finish payload; public sync events are unified under ChatClient-level `onSyncDataFinished`.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| error | `ContactSyncError` | Error details when the sync finishes with an error. |

## src/managers/group-manager.ts

### GroupManager

### addEventHandler(id: EventHandlerId, handlers: GroupEventHandlerMap) => void

#### Description

Registers group event handlers.

#### Examples

Listen for members joined events
```ts
client.groupManager.addEventHandler('group-events', {
  onMembersJoined: event => console.log(event.groupId, event.members),
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| id | `EventHandlerId` | Unique handler id used for later removal. |
| handlers | `GroupEventHandlerMap` | Group event handler collection. |

#### Returns

Returns nothing after registration.

### removeEventHandler(id: EventHandlerId) => void

#### Description

Removes group event handlers.

#### Examples

Remove a handler
```ts
client.groupManager.removeEventHandler('group-events');
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| id | `EventHandlerId` | Handler id to remove. |

#### Returns

Returns nothing after removal.

### createGroup(params: CreateGroupParams) => Promise<CreateGroupResult>

#### Description

Creates a group with initial members, visibility, join joinApprovalRequired, invitation policy, and member limit.

#### Examples

Create a public group
```ts
const result = await client.groupManager.createGroup({
  name: 'Developers',
  description: 'SDK discussion',
  memberIds: ['user-1', 'user-2'],
  public: true,
  joinApprovalRequired: false,
  allowInvites: true,
  inviteNeedConfirm: true,
  maxMembers: 200,
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `CreateGroupParams` | Group creation parameters. |

#### Returns

Returns the created group id.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | invalid_parameter | invalid parameter occurred in create group | Check invalid parameter and try again |
| 110 | illegal_argument | illegal argument occurred in create group | Check illegal argument and try again |
| 4 | exceed_limit | exceed limit occurred in create group | Check exceed limit and try again |
| 608 | group_name_violation | group name violation occurred in create group | Check group name violation and try again |
| 204 | resource_not_found | resource not found occurred in create group | Check resource not found and try again |

### getJoinedGroupList() => ReadonlyArray<JoinedGroupSummary>

#### Description

Reads the local synced list of groups joined by the current user. This method only reads local cache and current-session runtime data, and never sends network requests.

#### Examples

Read local joined groups
```ts
const groups = client.groupManager.getJoinedGroupList();
```

#### Returns

Returns lightweight local joined groups.

### getGroup(groupId: string) => Group

#### Description

Gets a single-group operation facade bound to the specified group id; this method does not send a network request.

#### Examples

Get a group facade
```ts
const group = client.groupManager.getGroup('group-1');
await group.getDetail();
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | Group id. |

#### Returns

Returns a `Group` facade bound to the group id.

#### Possible Errors

- Error code `100`: `groupId` is empty.

### getGroupInfo(params: GetGroupInfoParams) => Promise<GroupDetail>

#### Description

Gets one group detail from the server.

#### Examples

Get group detail
```ts
const detail = await client.groupManager.getGroupInfo({ groupId: 'group-1' });
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `GetGroupInfoParams` | Group detail query parameters. |

#### Returns

Returns the normalized group detail.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 606 | resource_not_found | groupId does not exist or the group has been destroyed | Confirm the groupId is correct and the group still exists |

### getGroupInfoList(params: GetGroupInfoListParams) => Promise<ReadonlyArray<GroupDetail>>

#### Description

Gets details for multiple groups.

#### Examples

Get multiple group details
```ts
const groups = await client.groupManager.getGroupInfoList({
  groupIds: ['group-1', 'group-2'],
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `GetGroupInfoListParams` | Group id list. |

#### Returns

Returns normalized group details.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 606 | resource_not_found | resource not found occurred in get group info list | Check resource not found and try again |

### joinGroup(params: GroupJoinParams) => Promise<void>

#### Description

Applies to join or directly joins a group depending on the group's join joinApprovalRequired setting.

#### Examples

Join a group
```ts
await client.groupManager.joinGroup({
  groupId: 'group-1',
  message: 'Please approve my request',
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `GroupJoinParams` | Group id and optional join request message. |

#### Returns

Resolves with no payload on success.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 600 | group_invalid_id | group invalid id occurred in join group | Check group invalid id and try again |
| 601 | already_joined | Current user has already joined the target group | Check already joined and try again |
| 602 | not_joined | not joined occurred in join group | Check not joined and try again |
| 603 | group_authorization | group authorization occurred in join group | Check group authorization and try again |
| 604 | group_full | group full occurred in join group | Check group full and try again |
| 606 | resource_not_found | groupId does not exist or the group has been destroyed | Confirm the groupId is correct and the group still exists |
| 607 | group_disabled | group disabled occurred in join group | Check group disabled and try again |
| 613 | group_user_in_blocklist | group user in blocklist occurred in join group | Check group user in blocklist and try again |

### inviteUsersToGroup(params: GroupUserBatchParams) => Promise<void>

#### Description

Invites users to a group.

#### Examples

Invite members
```ts
await client.groupManager.inviteUsersToGroup({
  groupId: 'group-1',
  userIds: ['user-2', 'user-3'],
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `GroupUserBatchParams` | Group id and invited user ids. |

#### Returns

Resolves with no payload on success.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 603 | group_authorization | group authorization occurred in invite users to group | Check group authorization and try again |
| 204 | resource_not_found | resource not found occurred in invite users to group | Check resource not found and try again |
| 606 | group_not_found | group not found occurred in invite users to group | Confirm the groupId is correct and the group still exists |
| 607 | group_disabled | group disabled occurred in invite users to group | Check group disabled and try again |

### acceptGroupJoinRequest(params: AcceptGroupJoinRequestParams) => Promise<void>

#### Description

Accepts a user's group join request.

#### Examples

Accept a join request
```ts
await client.groupManager.acceptGroupJoinRequest({
  groupId: 'group-1',
  userId: 'user-2',
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `AcceptGroupJoinRequestParams` | Group id and applicant user id. |

#### Returns

Resolves with no payload on success.

#### Possible Errors

- Error code `110`: invalid applicant id, request not found, or group not found.
- Error code `202`: authentication failed or permission denied.

### rejectGroupJoinRequest(params: RejectGroupJoinRequestParams) => Promise<void>

#### Description

Rejects a user's group join request.

#### Examples

Reject a join request
```ts
await client.groupManager.rejectGroupJoinRequest({
  groupId: 'group-1',
  userId: 'user-2',
  reason: 'Group is full',
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `RejectGroupJoinRequestParams` | Group id, applicant user id, and rejection reason. |

#### Returns

Resolves with no payload on success.

#### Possible Errors

- Error code `110`: invalid applicant id or reason, request not found, or group not found.
- Error code `202`: authentication failed or permission denied.

### acceptInvitation(params: GroupMutationTarget) => Promise<void>

#### Description

Accepts a group invitation received by the current user.

#### Examples

Accept a group invitation
```ts
await client.groupManager.acceptInvitation({ groupId: 'group-1' });
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `GroupMutationTarget` | Group id. |

#### Returns

Resolves with no payload on success.

#### Possible Errors

- Error code `110`: invalid group id, invitation not found, or group not found.
- Error code `202`: authentication failed.

### rejectInvitation(params: GroupMutationTarget) => Promise<void>

#### Description

Rejects a group invitation received by the current user.

#### Examples

Reject a group invitation
```ts
await client.groupManager.rejectInvitation({ groupId: 'group-1' });
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `GroupMutationTarget` | Group id. |

#### Returns

Resolves with no payload on success.

#### Possible Errors

- Error code `110`: invalid group id, invitation not found, or group not found.
- Error code `202`: authentication failed.

### hydrateMessageProfileGroupNamecards(groupId: string, targets: ReadonlyArray<GroupNamecardHydrationTarget>) => Promise<void>

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| targets | `ReadonlyArray<GroupNamecardHydrationTarget>` | - |

## src/managers/group/group.ts

### Group

### getSummary() => JoinedGroupSummary | null

#### Description

Reads the known lightweight joined-group summary from the current session or local preview. This method never sends a network request and does not represent full group detail.

#### Examples

Read local lightweight summary
```ts
const group = client.groupManager.getGroup('group-1');
const summary = group.getSummary();
```

#### Returns

Returns the known local lightweight summary, or `null` when unknown.

### getDetail() => Promise<GroupDetail>

#### Description

Gets the current group detail, reusing the in-session snapshot when available and refreshing from the server when needed.

#### Examples

Get group detail
```ts
const group = client.groupManager.getGroup('group-1');
const detail = await group.getDetail();
```

#### Returns

Returns the normalized group detail.

#### Possible Errors

- Error code `110`: invalid group id or group not found.
- Error code `202`: authentication failed.

### refresh() => Promise<GroupDetail>

#### Description

Forces a server refresh for the current group detail.

#### Examples

Refresh group detail
```ts
const detail = await client.groupManager.getGroup('group-1').refresh();
```

#### Returns

Returns the refreshed normalized group detail.

#### Possible Errors

- Error code `110`: invalid group id or group not found.
- Error code `202`: authentication failed.

### updateInfo(input: GroupUpdateInfoInput) => Promise<void>

#### Description

Updates basic profile fields of the current group, such as name, description, avatar, or extension.

#### Examples

Update group name
```ts
await client.groupManager.getGroup('group-1').updateInfo({ name: 'New group name' });
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| input | `GroupUpdateInfoInput` | Group profile fields to update. |

#### Returns

Resolves with no payload on success.

#### Possible Errors

- Error code `110`: invalid parameters or group not found.
- Error code `202`: authentication failed.

### updateConfigs(input: GroupUpdateConfigsInput) => Promise<void>

#### Description

Updates current group settings, such as visibility, join joinApprovalRequired, invite permission, or member limit.

#### Examples

Disable member invitations
```ts
await client.groupManager.getGroup('group-1').updateConfigs({ allowInvites: false });
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| input | `GroupUpdateConfigsInput` | Group setting fields to update. |

#### Returns

Resolves with no payload on success.

#### Possible Errors

- Error code `110`: invalid parameters or group not found.
- Error code `202`: authentication failed.

### changeOwner(input: GroupOwnerChangeInput) => Promise<void>

#### Description

Transfers ownership of the current group.

#### Examples

Transfer group owner
```ts
await client.groupManager.getGroup('group-1').changeOwner({ newOwner: 'user-2' });
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| input | `GroupOwnerChangeInput` | New owner user id. |

#### Returns

Resolves with no payload on success.

#### Possible Errors

- Error code `110`: invalid new owner, user not in group, or group not found.
- Error code `202`: authentication failed.

### destroy() => Promise<void>

#### Description

Destroys the current group.

#### Examples

Destroy a group
```ts
await client.groupManager.getGroup('group-1').destroy();
```

#### Returns

Resolves with no payload on success.

#### Possible Errors

- Error code `110`: invalid group id or group not found.
- Error code `202`: authentication failed or permission denied.

### leave() => Promise<void>

#### Description

Leaves the current group as the current signed-in user.

#### Examples

Leave a group
```ts
await client.groupManager.getGroup('group-1').leave();
```

#### Returns

Resolves with no payload on success.

#### Possible Errors

- Error code `110`: invalid group id, group not found, or current user not in group.
- Error code `202`: authentication failed.

### getMembers(query: GroupMemberListQuery) => Promise<GroupMemberListResult>

#### Description

Gets members of the current group by page.

#### Examples

Get group members
```ts
const page = await client.groupManager.getGroup('group-1').getMembers({ pageSize: 20 });
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| query | `GroupMemberListQuery` | Optional paging parameters. |

#### Returns

Returns the member page result.

#### Possible Errors

- Error code `110`: invalid group id or paging parameters.
- Error code `202`: authentication failed.

### removeMembers(input: GroupUserBatchInput) => Promise<void>

#### Description

Removes members from the current group.

#### Examples

Remove group members
```ts
await client.groupManager.getGroup('group-1').removeMembers({ userIds: ['user-2'] });
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| input | `GroupUserBatchInput` | User ids to remove. |

#### Returns

Resolves with no payload on success.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | group authorization occurred in remove chat room members | Try again with a chat room owner/admin account |
| 606 | resource_not_found | resource not found occurred in remove chat room members | Check resource not found and try again |

### getAdmins() => Promise<ReadonlyArray<UserInfo>>

#### Description

Gets the admin list of the current group.

#### Examples

Get admins
```ts
const admins = await client.groupManager.getGroup('group-1').getAdmins();
```

#### Returns

Returns admin user profiles.

#### Possible Errors

- Error code `110`: invalid group id or group not found.
- Error code `202`: authentication failed.

### addAdmin(input: { userId: string }) => Promise<void>

#### Description

Adds a group admin.

#### Examples

Add an admin
```ts
await client.groupManager.getGroup('group-1').addAdmin({ userId: 'user-2' });
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| input | `{ userId: string }` | Admin user id. |

#### Returns

Resolves with no payload on success.

#### Possible Errors

- Error code `110`: invalid user id, user not in group, or group not found.
- Error code `202`: authentication failed or permission denied.

### removeAdmin(input: { userId: string }) => Promise<void>

#### Description

Removes a group admin.

#### Examples

Remove an admin
```ts
await client.groupManager.getGroup('group-1').removeAdmin({ userId: 'user-2' });
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| input | `{ userId: string }` | Admin user id. |

#### Returns

Resolves with no payload on success.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | group authorization occurred in remove chat room admin | Check group authorization and try again |
| 606 | resource_not_found | resource not found occurred in remove chat room admin | Check resource not found and try again |

### getMuteList(page: GroupMuteListQuery) => Promise<ReadonlyArray<GroupMuteEntry>>

#### Description

Gets the mute list of the current group.

#### Examples

Get mute list
```ts
const mutes = await client.groupManager.getGroup('group-1').getMuteList({ pageSize: 20 });
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| page | `GroupMuteListQuery` | Optional paging parameters. |

#### Returns

Returns muted member entries.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 606 | resource_not_found | resource not found occurred in get chat room mute list | Check resource not found and try again |

### muteMembers(input: GroupMuteMembersInput) => Promise<void>

#### Description

Mutes specified members in the current group.

#### Examples

Mute members
```ts
await client.groupManager.getGroup('group-1').muteMembers({
  userIds: ['user-2'],
  muteDuration: 3600,
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| input | `GroupMuteMembersInput` | User ids and mute duration in seconds. |

#### Returns

Resolves with no payload on success.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | illegal_argument | illegal argument occurred in mute chat room members | Check illegal argument and try again |
| 210 | group_authorization | group authorization occurred in mute chat room members | Try again with a chat room owner/admin account |
| 606 | resource_not_found | resource not found occurred in mute chat room members | Check resource not found and try again |

### unmuteMembers(input: GroupUserBatchInput) => Promise<void>

#### Description

Unmutes specified members in the current group.

#### Examples

Unmute members
```ts
await client.groupManager.getGroup('group-1').unmuteMembers({ userIds: ['user-2'] });
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| input | `GroupUserBatchInput` | User ids to unmute. |

#### Returns

Resolves with no payload on success.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | group authorization occurred in unmute chat room members | Try again with a chat room owner/admin account |
| 606 | resource_not_found | resource not found occurred in unmute chat room members | Check resource not found and try again |

### muteAllMembers() => Promise<void>

#### Description

Enables all-member mute for the current group.

#### Examples

Enable all-member mute
```ts
await client.groupManager.getGroup('group-1').muteAllMembers();
```

#### Returns

Resolves with no payload on success.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | group authorization occurred in mute all chat room members | Try again with a chat room owner/admin account |
| 606 | resource_not_found | resource not found occurred in mute all chat room members | Check resource not found and try again |

### unmuteAllMembers() => Promise<void>

#### Description

Disables all-member mute for the current group.

#### Examples

Disable all-member mute
```ts
await client.groupManager.getGroup('group-1').unmuteAllMembers();
```

#### Returns

Resolves with no payload on success.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | group authorization occurred in unmute all chat room members | Try again with a chat room owner/admin account |
| 606 | resource_not_found | resource not found occurred in unmute all chat room members | Check resource not found and try again |

### getBlocklist(page: NumberPageParams) => Promise<ReadonlyArray<GroupBlocklistEntry>>

#### Description

Gets the blocklist of the current group.

#### Examples

Get group blocklist
```ts
const blocklist = await client.groupManager.getGroup('group-1').getBlocklist({ pageSize: 20 });
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| page | `NumberPageParams` | Optional paging parameters. |

#### Returns

Returns blocked member entries.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 606 | resource_not_found | resource not found occurred in get chat room blocklist | Check resource not found and try again |

### blockMembers(input: GroupUserBatchInput) => Promise<void>

#### Description

Adds specified members to the current group blocklist.

#### Examples

Add members to blocklist
```ts
await client.groupManager.getGroup('group-1').blockMembers({ userIds: ['user-2'] });
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| input | `GroupUserBatchInput` | User ids to block. |

#### Returns

Resolves with no payload on success.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | group authorization occurred in block chat room members | Try again with a chat room owner/admin account |
| 606 | resource_not_found | resource not found occurred in block chat room members | Check resource not found and try again |
| 204 | service_resource_not_found | service resource not found occurred in block chat room members | Check service resource not found and try again |

### unblockMembers(input: GroupUserBatchInput) => Promise<void>

#### Description

Removes specified members from the current group blocklist.

#### Examples

Remove members from blocklist
```ts
await client.groupManager.getGroup('group-1').unblockMembers({ userIds: ['user-2'] });
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| input | `GroupUserBatchInput` | User ids to unblock. |

#### Returns

Resolves with no payload on success.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | group authorization occurred in unblock chat room members | Try again with a chat room owner/admin account |
| 606 | resource_not_found | resource not found occurred in unblock chat room members | Check resource not found and try again |

### getAllowlist() => Promise<ReadonlyArray<GroupAllowlistEntry>>

#### Description

Gets the allowlist of the current group.

#### Examples

Get allowlist
```ts
const allowlist = await client.groupManager.getGroup('group-1').getAllowlist();
```

#### Returns

Returns allowlisted member entries.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 606 | resource_not_found | resource not found occurred in get chat room allowlist | Check resource not found and try again |

### addUsersToAllowlist(input: GroupUserBatchInput) => Promise<void>

#### Description

Adds specified members to the current group allowlist.

#### Examples

Add members to allowlist
```ts
await client.groupManager.getGroup('group-1').addUsersToAllowlist({ userIds: ['user-2'] });
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| input | `GroupUserBatchInput` | User ids to add to the allowlist. |

#### Returns

Resolves with no payload on success.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | group authorization occurred in add users to chat room allowlist | Try again with a chat room owner/admin account |
| 606 | resource_not_found | resource not found occurred in add users to chat room allowlist | Check resource not found and try again |
| 204 | service_resource_not_found | service resource not found occurred in add users to chat room allowlist | Check service resource not found and try again |

### removeUsersFromAllowlist(input: GroupUserBatchInput) => Promise<void>

#### Description

Removes specified members from the current group allowlist.

#### Examples

Remove members from allowlist
```ts
await client.groupManager.getGroup('group-1').removeUsersFromAllowlist({ userIds: ['user-2'] });
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| input | `GroupUserBatchInput` | User ids to remove from the allowlist. |

#### Returns

Resolves with no payload on success.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | group authorization occurred in remove users from chat room allowlist | Try again with a chat room owner/admin account |
| 606 | resource_not_found | resource not found occurred in remove users from chat room allowlist | Check resource not found and try again |

### checkIfInAllowList() => Promise<boolean>

#### Description

Checks whether the current user is in the current group allowlist.

#### Examples

Check allowlist membership
```ts
const inAllowlist = await client.groupManager.getGroup('group-1').checkIfInAllowList();
```

#### Returns

Returns `true` when the current user is in the allowlist.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 606 | resource_not_found | resource not found occurred in check if in chat room allow list | Check resource not found and try again |

### checkIfInMuteList() => Promise<boolean>

#### Description

Checks whether the current user is in the current group mute list.

#### Examples

Check mute-list membership
```ts
const muted = await client.groupManager.getGroup('group-1').checkIfInMuteList();
```

#### Returns

Returns `true` when the current user is muted.

#### Possible Errors

- Error code `110`: invalid group id or group not found.
- Error code `202`: authentication failed.

### getAnnouncement() => Promise<GroupAnnouncement>

#### Description

Gets the current group announcement.

#### Examples

Get group announcement
```ts
const announcement = await client.groupManager.getGroup('group-1').getAnnouncement();
```

#### Returns

Returns the group announcement object.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 606 | resource_not_found | resource not found occurred in get chat room announcement | Check resource not found and try again |

### updateAnnouncement(input: GroupAnnouncementUpdateInput) => Promise<void>

#### Description

Updates the current group announcement.

#### Examples

Update group announcement
```ts
await client.groupManager.getGroup('group-1').updateAnnouncement({ announcement: 'Welcome' });
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| input | `GroupAnnouncementUpdateInput` | New announcement content. |

#### Returns

Resolves with no payload on success.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | group authorization occurred in update chat room announcement | Try again with a chat room owner/admin account |
| 110 | forbidden_op | forbidden op occurred in update chat room announcement | Check forbidden op and try again |
| 606 | resource_not_found | resource not found occurred in update chat room announcement | Check resource not found and try again |

### getSharedFileList(query: GroupSharedFileListQuery) => Promise<GroupSharedFileListResult>

#### Description

Gets shared files of the current group by page.

#### Examples

Get shared files
```ts
const files = await client.groupManager.getGroup('group-1').getSharedFileList({ pageSize: 20 });
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| query | `GroupSharedFileListQuery` | Optional paging parameters. |

#### Returns

Returns the shared-file page result.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 606 | resource_not_found | resource not found occurred in get chat room shared file list | Check resource not found and try again |

### uploadSharedFile(input: GroupUploadSharedFileInput) => Promise<void>

#### Description

Uploads a file to the current group shared-file list.

#### Examples

Upload a shared file
```ts
await client.groupManager.getGroup('group-1').uploadSharedFile({
  file,
  onFileUploadProgress: event => console.log(event.loaded),
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| input | `GroupUploadSharedFileInput` | File object and upload callbacks. |

#### Returns

Resolves with no payload on success.

#### Possible Errors

- Error code `110`: invalid group id or file parameter.
- Error code `202`: authentication failed or permission denied.
- Error code `1`: upload cancelled or platform upload failed.

### deleteSharedFile(input: GroupDeleteSharedFileInput) => Promise<void>

#### Description

Deletes a shared file from the current group.

#### Examples

Delete a shared file
```ts
await client.groupManager.getGroup('group-1').deleteSharedFile({ fileId: 'file-1' });
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| input | `GroupDeleteSharedFileInput` | Shared file id. |

#### Returns

Resolves with no payload on success.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | group authorization occurred in delete chat room shared file | Try again with a chat room owner/admin account |
| 606 | resource_not_found | resource not found occurred in delete chat room shared file | Check resource not found and try again |

### downloadSharedFile(input: GroupDownloadSharedFileInput) => Promise<void>

#### Description

Downloads a shared file of the current group and returns Blob data through callbacks.

#### Examples

Download a shared file
```ts
await client.groupManager.getGroup('group-1').downloadSharedFile({
  fileId: 'file-1',
  onFileDownloadComplete: blob => console.log(blob.size),
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| input | `GroupDownloadSharedFileInput` | File id, optional secret, and download callbacks. |

#### Returns

Resolves when the download flow finishes.

#### Possible Errors

- Error code `110`: invalid group id or file id.
- Error code `202`: authentication failed.
- Error code `303`: HTTP download failed.

### setMemberAttributes(input: GroupSetMemberAttributesInput) => Promise<void>

#### Description

Sets custom member attributes in the current group, commonly used for group name cards.

#### Examples

Set a group name card
```ts
await client.groupManager.getGroup('group-1').setMemberAttributes({
  userId: 'user-1',
  memberAttributes: { groupNamecard: 'Alice' },
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| input | `GroupSetMemberAttributesInput` | Member user id and attribute key-value pairs. |

#### Returns

Resolves with no payload on success.

#### Possible Errors

- Error code `110`: invalid user id, attribute key, or attribute value.
- Error code `4`: attribute count or length exceeds service limits.
- Error code `202`: authentication failed or permission denied.

### getMembersAttributes(input: GroupGetMembersAttributesInput) => Promise<GroupMembersAttributesResult>

#### Description

Gets custom member attributes for multiple members in the current group.

#### Examples

Get multiple members' attributes
```ts
const result = await client.groupManager.getGroup('group-1').getMembersAttributes({
  userIds: ['user-1', 'user-2'],
  keys: ['groupNamecard'],
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| input | `GroupGetMembersAttributesInput` | Member user ids and optional attribute keys. |

#### Returns

Returns attributes indexed by member user id.

#### Possible Errors

- Error code `110`: empty member list, invalid user id, or invalid attribute key.
- Error code `202`: authentication failed.

## src/types/group.ts

### GroupSummary

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | Group id. |
| name | `string` | Group name. |
| description | `string` | Group description. |
| memberCount | `number` | Current group member count. |
| public | `boolean` | Whether the group is public. |
| joinApprovalRequired | `boolean` | Whether joining the group requires admin joinApprovalRequired. |
| allowInvites | `boolean` | Whether regular members can invite users to the group. |
| maxMembers | `number` | Maximum group member count. |
| role | `GroupRole` | Current user's role in the group. |
| disabled | `boolean` | Whether the group is disabled. |

### GroupListResult

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| items | `ReadonlyArray<GroupSummary>` | Group summary list. |
| pageNum | `number` | Current page number. |
| pageSize | `number` | Page size. |
| cursor | `string` | Cursor for the next page. |
| hasMore | `boolean` | Whether another page is available. |

### GroupDetail

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| owner | `UserInfo` | Group owner profile. |
| inviteNeedConfirm | `boolean` | Whether invitees need to accept invitations before joining. |
| muteAllMembers | `boolean` | Whether all-member mute is enabled. |
| ext | `string` | Group extension payload. |
| createdAt | `number` | Group creation timestamp. |
| joinedAt | `number` | Timestamp when the current user joined the group. |
| avatarUrl | `string` | Group avatar URL. |
| messageBlocked | `boolean` | Whether the current user has blocked messages from this group. |

### JoinedGroupSummary

#### Description

Lightweight summary of a joined group for the current user; not a full group detail.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| ownerId | `string` | Group owner user id. |
| avatarUrl | `string` | Group avatar URL. |
| muteAllMembers | `boolean` | Whether all-member mute is enabled. |
| muteExpiration | `number` | Current user's mute expiration timestamp; 0 means not muted. |
| remindType | `SessionListRemindType` | Conversation remind type. |
| createdAt | `number` | Group creation timestamp. |
| updatedAt | `number` | Group update timestamp. |
| joinedAt | `number` | Timestamp when the current user joined the group. |

### JoinedGroupSnapshotMeta

#### Description

Metadata of a local joined-group snapshot.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| integrity | `JoinedGroupSnapshotIntegrity` | Snapshot integrity. |
| limited | `boolean` | Whether the result is limited by the server cap. |
| storageLimit | `number` | Local preview storage limit. |
| serverLimit | `number` | Server limit for one sync round. |
| source | `JoinedGroupSnapshotSource` | Snapshot source. |
| lastSyncFinishedTs | `number` | Completion timestamp from the final server batch. |
| lastSuccessfulAt | `number` | Local timestamp of the last successful sync. |
| reason | `string` | State reason. |

### JoinedGroupSnapshot

#### Description

Local joined-group snapshot.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| items | `ReadonlyArray<JoinedGroupSummary>` | Lightweight joined-group summaries. |
| meta | `JoinedGroupSnapshotMeta` | Snapshot metadata. |

### GroupUpdateInfoInput

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| name | `string` | New group name. |
| description | `string` | New group description. |
| avatar | `string` | New group avatar URL or identifier. |
| ext | `string` | New group extension payload. |

### GroupUpdateConfigsInput

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| public | `boolean` | Whether the group is public. |
| joinApprovalRequired | `boolean` | Whether joining requires admin joinApprovalRequired. |
| allowInvites | `boolean` | Whether regular members can invite other users. |
| inviteNeedConfirm | `boolean` | Whether invitees need to accept invitations before joining. |
| maxMembers | `number` | Maximum group member count. |

### GroupOwnerChangeInput

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| newOwner | `string` | New owner user id. |

### GroupMemberEntry

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| user | `UserInfo` | Member user profile. |
| role | `GroupRole` | Member role. |
| joinedAt | `number` | Timestamp when the member joined the group. |

### GroupMemberListResult

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| items | `ReadonlyArray<GroupMemberEntry>` | Member list. |
| pageNum | `number` | Current page number. |
| pageSize | `number` | Page size. |
| cursor | `string` | Cursor for the next page. |
| hasMore | `boolean` | Whether another page is available. |

### GroupMuteEntry

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| user | `UserInfo` | Muted member profile. |
| muteExpire | `number` | Mute expiration timestamp. |
| muteDuration | `number` | Mute duration in seconds. |

### GroupAllowlistEntry

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| user | `UserInfo` | Allowlisted member profile. |

### GroupBlocklistEntry

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| user | `UserInfo` | Blocked member profile. |

### GroupAnnouncement

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| announcement | `string` | Group announcement content. |

### GroupSharedFile

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| fileId | `string` | Shared file id. |
| fileName | `string` | File name. |
| fileOwner | `UserInfo` | File owner profile. |
| fileSize | `number` | File size in bytes. |
| createdAt | `number` | File creation timestamp. |

### GroupSharedFileListResult

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| items | `ReadonlyArray<GroupSharedFile>` | Shared file list. |
| pageNum | `number` | Current page number. |
| pageSize | `number` | Page size. |
| cursor | `string` | Cursor for the next page. |
| hasMore | `boolean` | Whether another page is available. |

### CursorPageParams

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| pageSize | `number` | Page size. |
| cursor | `string` | Cursor for the next page. |

### NumberPageParams

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| pageNum | `number` | Page number. |
| pageSize | `number` | Page size. |

### GroupUserBatchInput

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| userIds | `ReadonlyArray<string>` | User id list. |

### GroupMuteMembersInput

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| userIds | `ReadonlyArray<string>` | User ids to mute. |
| muteDuration | `number` | Mute duration in seconds. |

### GroupAnnouncementUpdateInput

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| announcement | `string` | New group announcement content. |

### GetJoinedGroupListParams

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| needMemberCount | `boolean` | Whether to include member counts. |
| needRole | `boolean` | Whether to include the current user's role. |

### GetGroupInfoParams

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | Group id. |

### GetGroupInfoListParams

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| groupIds | `ReadonlyArray<string>` | Group id list. |

### CreateGroupParams

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| name | `string` | Group name. |
| description | `string` | Group description. |
| memberIds | `ReadonlyArray<string>` | Initial member id list. |
| public | `boolean` | Whether the group is public. |
| joinApprovalRequired | `boolean` | Whether joining requires admin joinApprovalRequired. |
| allowInvites | `boolean` | Whether regular members can invite other users. |
| inviteNeedConfirm | `boolean` | Whether invitees need to accept invitations before joining. |
| maxMembers | `number` | Maximum group member count. |
| ext | `string` | Group extension payload. |
| avatar | `string` | Group avatar URL or identifier. |

### CreateGroupResult

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | Created group id. |

### UpdateGroupInfoParams

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | Group id. |
| name | `string` | New group name. |
| description | `string` | New group description. |
| avatar | `string` | New group avatar URL or identifier. |
| public | `boolean` | Whether the group is public. |
| joinApprovalRequired | `boolean` | Whether joining requires admin joinApprovalRequired. |
| allowInvites | `boolean` | Whether regular members can invite other users. |
| inviteNeedConfirm | `boolean` | Whether invitees need to accept invitations before joining. |
| maxMembers | `number` | Maximum group member count. |
| ext | `string` | Group extension payload. |

### GroupMutationTarget

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | Group id. |

### GroupUserBatchParams

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| userIds | `ReadonlyArray<string>` | User id list. |

### GroupAdminMutationParams

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| userId | `string` | Admin user id. |

### GroupOwnerChangeParams

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| newOwner | `string` | New owner user id. |

### GroupJoinParams

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| message | `string` | Join request reason or message. |

### AcceptGroupJoinRequestParams

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| userId | `string` | Applicant user id. |

### RejectGroupJoinRequestParams

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| userId | `string` | Applicant user id. |
| reason | `string` | Rejection reason. |

### GroupMuteMembersParams

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| userIds | `ReadonlyArray<string>` | User ids to mute. |
| muteDuration | `number` | Mute duration in seconds. |

### GroupAnnouncementUpdateParams

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| announcement | `string` | New group announcement content. |

### UploadGroupSharedFileCallbacks

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| onFileUploadProgress | `(event: ProgressEvent) => void` | File upload progress callback. |
| onFileUploadComplete | `(payload: unknown) => void` | File upload completion callback. |
| onFileUploadError | `(payload: unknown) => void` | File upload error callback. |
| onFileUploadCanceled | `() => void` | File upload cancellation callback. |

### UploadGroupSharedFileParams

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| file | `File | Blob | Record<string, unknown>` | File to upload. |

### GroupUploadSharedFileInput

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| file | `File | Blob | Record<string, unknown>` | File to upload. |

### DeleteGroupSharedFileParams

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| fileId | `string` | Shared file id. |

### GroupDeleteSharedFileInput

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| fileId | `string` | Shared file id. |

### DownloadGroupSharedFileCallbacks

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| onFileDownloadComplete | `(data: Blob) => void` | File download completion callback with Blob data. |
| onFileDownloadError | `(error: unknown) => void` | File download error callback. |

### DownloadGroupSharedFileParams

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| fileId | `string` | Shared file id. |
| secret | `string` | File download secret. |

### GroupDownloadSharedFileInput

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| fileId | `string` | Shared file id. |
| secret | `string` | File download secret. |

### SetGroupMemberAttributesParams

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| userId | `string` | Member user id. |
| memberAttributes | `Readonly<Record<string, string>>` | Member attribute key-value object. |

### GroupSetMemberAttributesInput

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| userId | `string` | Member user id. |
| memberAttributes | `Readonly<Record<string, string>>` | Member attribute key-value object. |

### GetGroupMembersAttributesParams

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| userIds | `ReadonlyArray<string>` | Member user id list. |
| keys | `ReadonlyArray<string>` | Optional attribute keys; returns all attributes when omitted. |

### GroupGetMembersAttributesInput

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| userIds | `ReadonlyArray<string>` | Member user id list. |
| keys | `ReadonlyArray<string>` | Optional attribute keys; returns all attributes when omitted. |

### GroupMembersAttributesResult

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| items | `Readonly<Record<string, Readonly<Record<string, string>>>>` | Attributes indexed by member user id. |

### GroupInvitationReceivedEventPayload

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| groupName | `string` | - |
| inviter | `UserInfo` | - |
| reason | `string` | - |

### GroupRequestToJoinReceivedEventPayload

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| groupName | `string` | - |
| applicant | `UserInfo` | - |
| reason | `string` | - |

### GroupRequestToJoinAcceptedEventPayload

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| groupName | `string` | - |
| accepter | `UserInfo` | - |

### GroupRequestToJoinDeclinedEventPayload

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| groupName | `string` | - |
| decliner | `UserInfo` | - |
| reason | `string` | - |
| applicant | `UserInfo` | - |

### GroupInvitationAcceptedEventPayload

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| invitee | `UserInfo` | - |
| reason | `string` | - |

### GroupInvitationDeclinedEventPayload

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| invitee | `UserInfo` | - |
| reason | `string` | - |

### GroupUserRemovedEventPayload

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| groupName | `string` | - |

### GroupDestroyedEventPayload

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| groupName | `string` | - |

### GroupAutoAcceptInvitationEventPayload

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| inviter | `UserInfo` | - |
| inviteMessage | `string` | - |

### GroupMuteListAddedEventPayload

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| mutes | `ReadonlyArray<UserInfo>` | - |
| muteExpire | `number` | - |

### GroupMuteListRemovedEventPayload

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| mutes | `ReadonlyArray<UserInfo>` | - |

### GroupAllowListAddedEventPayload

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| allowlist | `ReadonlyArray<UserInfo>` | - |

### GroupAllowListRemovedEventPayload

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| allowlist | `ReadonlyArray<UserInfo>` | - |

### GroupAllMemberMuteStateChangedEventPayload

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| isMuted | `boolean` | - |

### GroupAdminAddedEventPayload

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| administrator | `UserInfo` | - |

### GroupAdminRemovedEventPayload

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| administrator | `UserInfo` | - |

### GroupOwnerChangedEventPayload

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| newOwner | `UserInfo` | - |
| oldOwner | `UserInfo` | - |

### GroupMembersJoinedEventPayload

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| members | `ReadonlyArray<UserInfo>` | - |

### GroupMembersExitedEventPayload

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| members | `ReadonlyArray<UserInfo>` | - |

### GroupAnnouncementChangedEventPayload

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| announcement | `string` | - |

### GroupSharedFileAddedEventPayload

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| sharedFile | `GroupSharedFile` | - |

### GroupSharedFileDeletedEventPayload

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| fileId | `string` | - |

### GroupInfoChangedEventPayload

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| groupInfo | `GroupDetail` | - |

### GroupDisabledChangedEventPayload

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| groupInfo | `GroupDetail` | - |
| disabled | `boolean` | - |

### GroupMemberAttributeChangedEventPayload

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| user | `UserInfo` | - |
| attribute | `Readonly<Record<string, string>>` | - |
| from | `string` | - |
| source | `'direct' | 'multiDevice'` | - |

### GroupUserGroupNamecardUpdatedEventPayload

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| userId | `string` | - |
| namecard | `string` | - |

### GroupManagerListener

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| onUserGroupNamecardUpdated | `(groupId: string, userId: string, namecard: string) => void` | - |

## src/managers/presence-manager.ts

### PublishPresenceParams

#### Description

Parameters for publishing the current user's presence.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| customStatus | `string` | Custom presence status mapped to server `ext` field. |

### SubscribePresenceParams

#### Description

Parameters for subscribing to users' presence.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| userIds | `ReadonlyArray<string>` | Target user id list to subscribe, must contain at least one entry. |
| expiry | `number` | Subscription duration in seconds, must be greater than or equal to 0. |

### UnsubscribePresenceParams

#### Description

Parameters for unsubscribing from users' presence.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| userIds | `ReadonlyArray<string>` | User id list to unsubscribe, must contain at least one entry. |

### GetSubscribedPresenceListParams

#### Description

Parameters for querying the current user's presence subscription list.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| pageNum | `number` | Page number starting from 0. |
| pageSize | `number` | Page size, must be greater than or equal to 0. |

### GetPresenceStatusParams

#### Description

Parameters for querying users' presence status.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| userIds | `ReadonlyArray<string>` | Target user id list to query, must contain at least one entry. |

### PresenceManager

### addEventHandler(id: EventHandlerId, handlers: PresenceEventHandlerMap) => void

#### Description

Registers a Presence event handler to receive presence state updates.

#### Examples

Usage example (register presence handler)
```ts
client.presenceManager.addEventHandler('presence-ui', {
  onPresenceStatusChange: (states) => {
    console.log(states);
  },
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| id | `EventHandlerId` | Unique handler id used for later removal. |
| handlers | `PresenceEventHandlerMap` | Handler collection with callbacks implemented as needed. |

#### Returns

Returns nothing when registration succeeds.

### removeEventHandler(id: EventHandlerId) => void

#### Description

Removes a Presence event handler.

#### Examples

Usage example (remove presence handler)
```ts
client.presenceManager.removeEventHandler('presence-ui');
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| id | `EventHandlerId` | Handler id to remove. |

#### Returns

Returns nothing when removal succeeds.

### publishPresence(params: PublishPresenceParams) => Promise<void>

#### Description

Publishes the current user's custom presence status, which is saved as the presence extension description and delivered to subscribers.

#### Examples

Usage example (publish presence)
```ts
await client.presenceManager.publishPresence({
  customStatus: 'busy',
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `PublishPresenceParams` | Publish parameters with presence extension description and optional callbacks. |

#### Returns

Resolves on success with no business payload.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 1100 | PRESENCE_PARAM_EXCEED | presence param exceed occurred in publish presence | Check presence param exceed and try again |

### subscribePresence(params: SubscribePresenceParams) => Promise<SubscribePresenceResponse>

#### Description

Subscribes to target users' presence. After success, Presence event callbacks are triggered when these users' presence changes.

#### Examples

Usage example (subscribe presence)
```ts
const result = await client.presenceManager.subscribePresence({
  userIds: ['userA'],
  expiry: 3600,
});
console.log(result[0]?.publisher);
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `SubscribePresenceParams` | Subscribe parameters including user list, expiry, and optional callbacks. |

#### Returns

Returns normalized presence list.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 1101 | cannot_subscribe_yourself | Subscription list contains the current user | Remove the current user from the subscription list |
| 1100 | param_length_exceed | param length exceed occurred in subscribe presences | Reduce the number of users per subscription request |

### unsubscribePresence(params: UnsubscribePresenceParams) => Promise<void>

#### Description

Unsubscribes from target users' presence; after success, presence change events for these users are no longer received.

#### Examples

Usage example (unsubscribe presence)
```ts
await client.presenceManager.unsubscribePresence({
  userIds: ['userA'],
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `UnsubscribePresenceParams` | Unsubscribe parameters including user list and optional callbacks. |

#### Returns

Resolves on success with no business payload.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 1100 | param_length_exceed | param length exceed occurred in unsubscribe presence | Reduce the number of users per unsubscribe request |

### getSubscribedPresenceList(params: GetSubscribedPresenceListParams) => Promise<SubscribedPresenceListResponse>

#### Description

Uses pagination to get the list of users whose presence states the current user has subscribed to.

#### Examples

Usage example (query subscribed list by page)
```ts
const list = await client.presenceManager.getSubscribedPresenceList({
  pageNum: 1,
  pageSize: 20,
});
console.log(list);
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `GetSubscribedPresenceListParams` | Paging parameters including page number, page size, and optional callbacks. |

#### Returns

Returns subscribed user id list.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 1100 | param_length_exceed | param length exceed occurred in get subscribed presence list | Adjust pageNum or pageSize and try again |

### getPresenceStatus(params: GetPresenceStatusParams) => Promise<SubscribePresenceResponse>

#### Description

Gets the current presence states of target users without creating subscriptions.

#### Examples

Usage example (query presence status)
```ts
const status = await client.presenceManager.getPresenceStatus({
  userIds: ['userA'],
});
console.log(status[0]?.statusList);
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `GetPresenceStatusParams` | Query parameters including user list and optional callbacks. |

#### Returns

Returns normalized presence list.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 1100 | param_length_exceed | param length exceed occurred in get presence status | Check param length exceed and try again |

## src/types/presence.ts

### PresenceStatusDetails

#### Description

Presence details for a single device.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| device | `string` | Device identifier (for example, web/mobile). |
| status | `number` | Presence status value of the device. |

### PresenceState

#### Description

Presence event payload.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| userId | `string` | User id that owns this presence state. |
| statusDetails | `ReadonlyArray<PresenceStatusDetails>` | Presence details across multiple devices. |
| ext | `string` | Extended description field. |
| lastTime | `number` | Update time in milliseconds timestamp. |
| expire | `number` | Subscription expire time in milliseconds timestamp. |

### PresenceInfo

#### Description

Presence business object aligned with Android Presence semantics.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| publisher | `string` | Publisher of this presence state (user id). |
| statusList | `Readonly<Record<string, number>>` | Device-status map (key=device, value=status). |
| ext | `string` | Extended description field. |
| latestTime | `number` | Latest update time in milliseconds timestamp. |
| expiryTime | `number` | Presence expire time in milliseconds timestamp. |

### SubscribePresenceRawResponse

#### Description

Raw subscribe/query presence response from server.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| result | `ReadonlyArray<{
    /** [zh-CN] 服务端用户 ID。 [en-US] User id from server. */
    readonly uid?: string;
    /** [zh-CN] 服务端设备状态映射。 [en-US] Device-status map from server. */
    readonly status?: Record<string, unknown>;
    /** [zh-CN] 服务端扩展字段。 [en-US] Extension field from server. */
    readonly ext?: string;
    /** [zh-CN] 服务端更新时间（毫秒时间戳）。 [en-US] Update time from server in milliseconds timestamp. */
    readonly last_time?: number;
    /** [zh-CN] 服务端到期时间（毫秒时间戳）。 [en-US] Expire time from server in milliseconds timestamp. */
    readonly expiry?: number;
  }>` | Result list returned by server. |

### SubscribedPresenceListRawResponse

#### Description

Raw subscribed-list response from server.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| result | `{
    /** [zh-CN] 订阅条目列表。 [en-US] Subscribed entry list. */
    readonly sublist?: ReadonlyArray<{
      /** [zh-CN] 服务端用户 ID。 [en-US] User id from server. */
      readonly uid?: string;
      /** [zh-CN] 服务端到期时间（毫秒时间戳）。 [en-US] Expire time from server in milliseconds timestamp. */
      readonly expiry?: number;
    }>;
    /** [zh-CN] 服务端总条目数。 [en-US] Total entry count from server. */
    readonly totalnum?: number;
  }` | Result object returned by server. |

## src/managers/push-manager.ts

### PushManager

### uploadPushToken(params: UploadPushTokenParams) => Promise<void>

#### Description

Uploads or replaces the device push token. On success it only resolves and returns no business payload.

#### Examples

Usage example (upload device token)
```ts
await client.pushManager.uploadPushToken({
  deviceId: 'web-device-001',
  deviceToken: 'token-from-push-provider',
  notifierName: 'FCM',
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `UploadPushTokenParams` | Upload parameters including device id, device token, and notifier name. |

#### Returns

Resolves on success with no return value.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in upload push token | Check validation invalid and try again |
| 1500 | TOKEN_UPLOAD_FAILED | token upload failed occurred in upload push token | Check token upload failed and try again |

### setGlobalSilentMode(params: SetGlobalSilentModeParams) => Promise<GlobalSilentModeResponse>

#### Description

Sets app-level (global) silent mode rule, supporting remind type, duration, and interval modes.

#### Examples

Usage example (set global remind type)
```ts
const result = await client.pushManager.setGlobalSilentMode({
  rule: { mode: 'REMIND_TYPE', remindType: 'AT' },
});
console.log(result.rule.remindType);
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `SetGlobalSilentModeParams` | Parameters for setting global silent mode. |

#### Returns

Returns the global silent mode snapshot.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in set global silent mode | Check validation invalid and try again |
| 1501 | SILENT_MODE_OPERATION_FAILED | silent mode operation failed occurred in set global silent mode | Check silent mode operation failed and try again |

### getGlobalSilentMode(params: GetGlobalSilentModeParams) => Promise<GlobalSilentModeResponse>

#### Description

Gets the app-level (global) silent mode rule.

#### Examples

Usage example (get global rule)
```ts
const result = await client.pushManager.getGlobalSilentMode();
console.log(result.rule);
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `GetGlobalSilentModeParams` | Query parameters (currently empty). |

#### Returns

Returns the global silent mode snapshot.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 1501 | SILENT_MODE_OPERATION_FAILED | Silent mode operation failed | - |

### setConversationSilentMode(params: SetConversationSilentModeParams) => Promise<ConversationSilentModeResponse>

#### Description

Sets silent mode rule for a specific conversation, supporting only single chat and group chat.

#### Examples

Usage example (set conversation duration mode)
```ts
const result = await client.pushManager.setConversationSilentMode({
  conversationId: 'group_123',
  conversationType: 'groupChat',
  rule: { mode: 'DURATION', duration: 3600 },
});
console.log(result.rule.expireTimestamp);
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `SetConversationSilentModeParams` | Conversation-level silent mode parameters. |

#### Returns

Returns target conversation with its rule snapshot.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in set conversation silent mode | Check validation invalid and try again |
| 1501 | SILENT_MODE_OPERATION_FAILED | silent mode operation failed occurred in set conversation silent mode | Check silent mode operation failed and try again |

### getConversationSilentMode(params: GetConversationSilentModeParams) => Promise<ConversationSilentModeResponse>

#### Description

Gets silent mode rule for a specific conversation.

#### Examples

Usage example (get conversation rule)
```ts
const result = await client.pushManager.getConversationSilentMode({
  conversationId: 'user_001',
  conversationType: 'singleChat',
});
console.log(result.rule.remindType);
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `GetConversationSilentModeParams` | Conversation query parameters. |

#### Returns

Returns rule snapshot of the target conversation.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in get conversation silent mode | Check validation invalid and try again |
| 1501 | SILENT_MODE_OPERATION_FAILED | Silent mode operation failed | - |

### clearConversationRemindType(params: ClearConversationRemindTypeParams) => Promise<ConversationSilentModeResponse>

#### Description

Clears conversation remind type and restores server-side default remind policy.

#### Examples

Usage example (clear conversation remind type)
```ts
const result = await client.pushManager.clearConversationRemindType({
  conversationId: 'group_123',
  conversationType: 'groupChat',
});
console.log(result.rule.remindType);
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `ClearConversationRemindTypeParams` | Parameters required to clear conversation remind type. |

#### Returns

Returns conversation rule snapshot after clearing.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in clear conversation remind type | Check validation invalid and try again |
| 1501 | SILENT_MODE_OPERATION_FAILED | Silent mode operation failed | - |

### getConversationSilentModes(params: GetConversationSilentModesParams) => Promise<BatchConversationSilentModeResponse>

#### Description

Batch queries silent mode rules for multiple conversations, up to 20 items per request.

#### Examples

Usage example (batch query)
```ts
const result = await client.pushManager.getConversationSilentModes({
  conversationList: [
    { conversationId: 'user_001', conversationType: 'singleChat' },
    { conversationId: 'group_123', conversationType: 'groupChat' },
  ],
});
console.log(result.conversations);
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `GetConversationSilentModesParams` | Batch query parameters. |

#### Returns

Returns conversation rules aligned with the input order.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in get conversation silent modes | Check validation invalid and try again |
| 1501 | SILENT_MODE_OPERATION_FAILED | Silent mode operation failed | - |

### setPushLanguage(params: SetPushLanguageParams) => Promise<void>

#### Description

Sets push notification translation language.

#### Examples

Usage example (set push language)
```ts
await client.pushManager.setPushLanguage({ language: 'zh-Hans' });
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `SetPushLanguageParams` | Language setting parameters. |

#### Returns

Resolves on success with no return value.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in set push language | Check validation invalid and try again |
| 1502 | PUSH_LANGUAGE_OPERATION_FAILED | push language operation failed occurred in set push language | Check push language operation failed and try again |

### getPushLanguage(params: GetPushLanguageParams) => Promise<PushLanguageResponse>

#### Description

Gets current push notification translation language.

#### Examples

Usage example (get push language)
```ts
const result = await client.pushManager.getPushLanguage();
console.log(result.language);
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `GetPushLanguageParams` | Query parameters (currently empty). |

#### Returns

Returns the current language value.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 1502 | PUSH_LANGUAGE_OPERATION_FAILED | Push language operation failed | - |

### getConversationListByRemindType(params: GetConversationListByRemindTypeParams) => Promise<MutedConversationPageResponse>

#### Description

Paginates conversations that have explicit remind type settings.

#### Examples

Usage example (pagination query)
```ts
const result = await client.pushManager.getConversationListByRemindType({
  pageSize: 20,
  cursor: '',
});
console.log(result.conversations, result.cursor);
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `GetConversationListByRemindTypeParams` | Paging parameters including page size and optional cursor. |

#### Returns

Returns conversation list and next cursor.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in get conversation list by remind type | Check validation invalid and try again |

## src/types/push.ts

### PushTimePoint

#### Description

Time point in 24-hour format.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| hours | `number` | Hour in range 0-23. |
| minutes | `number` | Minute in range 0-59. |

### PushSilentModeRemindTypeRuleInput

#### Description

Input for remind-type mode.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| mode | `'REMIND_TYPE'` | Fixed value `REMIND_TYPE`. |
| remindType | `PushRemindTypeWithoutDefault` | Remind type, supports `ALL/AT/NONE`. |

### PushSilentModeDurationRuleInput

#### Description

Input for duration mode.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| mode | `'DURATION'` | Fixed value `DURATION`. |
| duration | `number` | Duration in seconds, must be a positive integer. |

### PushSilentModeIntervalRuleInput

#### Description

Input for interval mode.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| mode | `'INTERVAL'` | Fixed value `INTERVAL`. |
| startTime | `PushTimePoint` | Interval start time point. |
| endTime | `PushTimePoint` | Interval end time point. |

### PushSilentModeRuleView

#### Description

Silent mode rule view (fields can coexist).

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| remindType | `PushRemindType` | Current remind type. |
| expireTimestamp | `number` | Expire timestamp in milliseconds. |
| silentModeStartTime | `PushTimePoint` | Daily silent mode start time. |
| silentModeEndTime | `PushTimePoint` | Daily silent mode end time. |

### GlobalSilentModeResponse

#### Description

Global silent mode response.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| scope | `'global'` | Scope, fixed to `global`. |
| rule | `PushSilentModeRuleView` | Global silent mode rule. |

### ConversationSilentModeResponse

#### Description

Conversation silent mode response.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| conversationId | `string` | Conversation ID. |
| conversationType | `PushConversationType` | Conversation type. |
| rule | `PushSilentModeRuleView` | Conversation silent mode rule. |

### ConversationIdentifier

#### Description

Conversation identifier.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| conversationId | `string` | Conversation ID. |
| conversationType | `PushConversationType` | Conversation type. |

### BatchConversationSilentModeResponse

#### Description

Batch conversation silent mode response.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| conversations | `ReadonlyArray<ConversationSilentModeResponse>` | Conversation result list. |

### PushLanguageResponse

#### Description

Push language response.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| language | `string` | Current effective language. |

### MutedConversationItem

#### Description

Muted conversation item.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| conversationId | `string` | Conversation ID. |
| conversationType | `PushConversationType` | Conversation type. |
| remindType | `PushRemindTypeWithoutDefault` | Remind type (without DEFAULT). |

### MutedConversationPageResponse

#### Description

Paged muted conversation response.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| conversations | `ReadonlyArray<MutedConversationItem>` | Conversation list for current page. |
| cursor | `string` | Next-page cursor; empty string means no more data. |

### UploadPushTokenParams

#### Description

Upload push token parameters.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| deviceId | `string` | Unique device identifier. |
| deviceToken | `string` | Device push token. |
| notifierName | `string` | Push notifier name (for example, FCM). |

### SetGlobalSilentModeParams

#### Description

Parameters for setting global silent mode.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| rule | `PushSilentModeRuleInput` | Silent mode rule input. |

### SetConversationSilentModeParams

#### Description

Parameters for setting conversation silent mode.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| conversationId | `string` | Conversation ID. |
| conversationType | `PushConversationType` | Conversation type. |
| rule | `PushSilentModeRuleInput` | Conversation silent mode rule. |

### GetConversationSilentModeParams

#### Description

Parameters for querying conversation silent mode.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| conversationId | `string` | Conversation ID. |
| conversationType | `PushConversationType` | Conversation type. |

### ClearConversationRemindTypeParams

#### Description

Parameters for clearing conversation remind type.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| conversationId | `string` | Conversation ID. |
| conversationType | `PushConversationType` | Conversation type. |

### GetConversationSilentModesParams

#### Description

Parameters for batch querying conversation silent modes.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| conversationList | `ReadonlyArray<ConversationIdentifier>` | Conversation list, maximum 20 items per request. |

### SetPushLanguageParams

#### Description

Parameters for setting push language.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| language | `string` | Language value (for example, `zh-Hans`, `en`). |

### GetConversationListByRemindTypeParams

#### Description

Parameters for paging conversations by remind type.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| pageSize | `number` | Page size, must be a positive integer. |
| cursor | `string` | Paging cursor (optional). |

## src/managers/user-info-manager.ts

### UserInfoManager

### addEventHandler(id: EventHandlerId, handlers: UserInfoEventHandlerMap) => void

#### Description

Registers user profile event handlers for current-user updates and subscribed profile changes.

#### Examples

Usage example (register event handlers)
```ts
client.userInfoManager.addEventHandler('profile-listener', {
  onOwnInfoUpdated: profile => {
    console.log(profile.nickname);
  },
  onUserInfoUpdated: users => {
    console.log(users.map(user => user.userId));
  },
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| id | `EventHandlerId` | Event handler ID; registering the same ID again replaces the previous handler. |
| handlers | `UserInfoEventHandlerMap` | User profile event handler map. |

#### Returns

Returns nothing.

### removeEventHandler(id: EventHandlerId) => void

#### Description

Removes the user profile event handler with the specified ID and stops its callbacks.

#### Examples

Usage example (remove an event handler)
```ts
client.userInfoManager.removeEventHandler('profile-listener');
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| id | `EventHandlerId` | Event handler ID used during registration. |

#### Returns

Returns nothing.

### getUserInfoByUserId(params: FetchUserInfoByUserIdParams) => Promise<ReadonlyArray<UserInfo>>

#### Description

Fetches user profile attributes by user IDs; when no attribute projection is provided, SDK default profile fields are returned.

#### Examples

Usage example (fetch by user IDs)
```ts
const users = await client.userInfoManager.getUserInfoByUserId({
  userIds: ['alice', 'bob'],
});
console.log(users[0]?.avatarUrl);
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `FetchUserInfoByUserIdParams` | Parameter object containing `userIds` and optional success/error callbacks. |

#### Returns

Returns normalized user profiles and only includes users returned by the server.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in get user info by user id | Check validation invalid and try again |
| 900 | usercount_exceed | User count in one query exceeds the server limit | Reduce the user count per query and try again |
| 204 | resource_not_found | Queried user does not exist | Confirm the user ID is correct |
| 4 | rate_limit | Requests are too frequent | Reduce request frequency and try again |

### getUserInfoByAttribute(params: FetchUserInfoByAttributeParams) => Promise<ReadonlyArray<UserInfo>>

#### Description

Fetches selected user profile attributes by user IDs, useful when only fields such as nickname or avatar are needed.

#### Examples

Usage example (fetch by attribute projection)
```ts
const users = await client.userInfoManager.getUserInfoByAttribute({
  userIds: ['alice'],
  attributes: ['nickname', 'avatarUrl'],
});
console.log(users[0]?.nickname);
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `FetchUserInfoByAttributeParams` | Parameter object containing `userIds`, `attributes`, and optional callbacks. |

#### Returns

Returns normalized user profiles.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in get user info by attribute | Check validation invalid and try again |
| 900 | usercount_exceed | User count in one query exceeds the server limit | Reduce the user count per query and try again |
| 204 | resource_not_found | Queried user does not exist | Confirm the user ID is correct |
| 4 | rate_limit | Requests are too frequent | Reduce request frequency and try again |

### subscribeUsersInfo(params: SubscribeUsersInfoParams) => Promise<void>

#### Description

Subscribes to profile change notifications of target strangers; after subscription, changes can be received through user profile event handlers.

#### Examples

Usage example (subscribe to profile changes)
```ts
await client.userInfoManager.subscribeUsersInfo({
  userIds: ['alice', 'bob'],
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `SubscribeUsersInfoParams` | Parameter object containing `userIds` and optional callbacks. |

#### Returns

Resolves with no payload on success.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 202 | unauthorized | Unauthorized | Refresh token |
| 210 | forbidden | Service forbidden | Check service permission |
| 1600 | subscriber_limit_exceeded | Subscriber limit exceeded | Reduce subscription targets |
| 1601 | target_limit_exceeded | Target limit exceeded | Change subscription target |
| 4 | rate_limit | Requests are too frequent | Reduce request frequency and try again |
| 303 | server_unknown_error | Server unknown error | Try again later or contact the server team |

### unsubscribeUsersInfo(params: UnsubscribeUsersInfoParams) => Promise<void>

#### Description

Unsubscribes from profile change notifications of target strangers; after removal, their profile changes are no longer delivered.

#### Examples

Usage example (unsubscribe from profile changes)
```ts
await client.userInfoManager.unsubscribeUsersInfo({
  userIds: ['alice'],
});
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `UnsubscribeUsersInfoParams` | Parameter object containing `userIds` and optional callbacks. |

#### Returns

Resolves with no payload on success.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 202 | unauthorized | Unauthorized | Refresh token |
| 210 | forbidden | Service forbidden | Check service permission |
| 1600 | subscriber_limit_exceeded | Subscriber limit exceeded | Reduce subscription targets |
| 1601 | target_limit_exceeded | Target limit exceeded | Change subscription target |
| 4 | rate_limit | Requests are too frequent | Reduce request frequency and try again |
| 303 | server_unknown_error | Server unknown error | Try again later or contact the server team |

### getSubscribedUsers() => Promise<ReadonlyArray<UserInfo>>

#### Description

Gets the strangers whose profile changes are subscribed by the current user and returns their normalized profiles.

#### Examples

Usage example (list subscribed users)
```ts
const users = await client.userInfoManager.getSubscribedUsers();
console.log(users.map(user => user.userId));
```

#### Returns

Returns normalized subscribed user profiles.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 202 | unauthorized | Unauthorized | Refresh token |
| 210 | forbidden | Service forbidden | Check service permission |
| 1600 | subscriber_limit_exceeded | Subscriber limit exceeded | Reduce subscription targets |
| 1601 | target_limit_exceeded | Target limit exceeded | Change subscription target |
| 4 | rate_limit | Requests are too frequent | Reduce request frequency and try again |
| 303 | server_unknown_error | Server unknown error | Try again later or contact the server team |

### updateOwnInfo(params: UpdateOwnInfoParams) => Promise<UserInfo>

#### Description

Updates one or more profile attributes of the currently logged-in user, such as nickname, avatar, email, phone, signature, or extension data.

#### Examples

Usage example (patch current profile)
```ts
const profile = await client.userInfoManager.updateOwnInfo({
  nickname: 'Alice',
  avatarUrl: 'https://example.com/avatar.png',
});
console.log(profile.userId, profile.nickname);
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| params | `UpdateOwnInfoParams` | Patch parameter object that must contain at least one updatable field. |

#### Returns

Returns the normalized current user profile.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in update own user info | Check validation invalid and try again |
| 901 | data_length_exceed | data length exceed occurred in update own user info | Check data length exceed and try again |
| 204 | resource_not_found | Current user does not exist | Confirm the user is registered |
| 4 | rate_limit | Requests are too frequent | Reduce request frequency and try again |

### updateOwnInfoByAttribute(attribute: UserInfoAttribute, value: string | number | boolean) => Promise<UserInfo>

#### Description

Updates one profile attribute of the currently logged-in user, suitable when only one field such as nickname or avatar needs to change.

#### Examples

Usage example (single-attribute update)
```ts
const profile = await client.userInfoManager.updateOwnInfoByAttribute(
  'avatarUrl',
  'https://example.com/avatar.png'
);
console.log(profile.avatarUrl);
```

#### Parameters

| Name | Type | Description |
| --- | --- | --- |
| attribute | `UserInfoAttribute` | The profile attribute to update. |
| value | `string | number | boolean` | Attribute value; empty string, `false`, and `0` are valid. |

#### Returns

Returns the normalized current user profile.

#### Error Matrix

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | validation invalid occurred in update own user info | Check validation invalid and try again |
| 901 | data_length_exceed | data length exceed occurred in update own user info | Check data length exceed and try again |
| 204 | resource_not_found | Current user does not exist | Confirm the user is registered |
| 4 | rate_limit | Requests are too frequent | Reduce request frequency and try again |

## src/types/user-info.ts

### UserInfo

#### Description

Normalized user profile returned by UserInfoManager fetch/update APIs.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| userId | `string` | User ID. |
| nickname | `string` | Nickname. |
| avatarUrl | `string` | Avatar URL. |
| mail | `string` | Email. |
| phone | `string` | Phone number. |
| gender | `UserInfoAttributeValue` | Gender or custom gender marker. |
| sign | `string` | Signature. |
| birth | `string` | Birthday. |
| ext | `string` | Extension field. |

### UserInfoListener

#### Description

User profile event listener.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| onOwnInfoUpdated | `(userInfo: UserInfo) => void` | Triggered when the current user's profile is updated. |
| onUserInfoUpdated | `(userInfos: ReadonlyArray<UserInfo>) => void` | Triggered when other users' profiles are hydrated from messages. |

### FetchUserInfoByUserIdParams

#### Description

Parameters for fetching default profile fields by user IDs.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| userIds | `ReadonlyArray<string>` | Target user ID list. |

### FetchUserInfoByAttributeParams

#### Description

Parameters for fetching profiles by user IDs with an explicit attribute projection.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| userIds | `ReadonlyArray<string>` | Target user ID list. |
| attributes | `ReadonlyArray<UserInfoAttribute>` | Requested profile attributes. |

### SubscribeUsersInfoParams

#### Description

Parameters for subscribing to stranger profile change notifications.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| userIds | `ReadonlyArray<string>` | Target user ID list to subscribe. |

### UnsubscribeUsersInfoParams

#### Description

Parameters for unsubscribing stranger profile change notifications.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| userIds | `ReadonlyArray<string>` | Target user ID list to unsubscribe. |

### UpdateOwnInfoParams

#### Description

Patch-style update parameters for the current user's profile.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| nickname | `string` | Nickname; pass an empty string to clear it. |
| avatarUrl | `string` | Avatar URL; pass an empty string to clear it. |
| mail | `string` | Email; pass an empty string to clear it. |
| phone | `string` | Phone number; pass an empty string to clear it. |
| gender | `UserInfoAttributeValue` | Gender; `false` and `0` are valid values. |
| sign | `string` | Signature; pass an empty string to clear it. |
| birth | `string` | Birthday; pass an empty string to clear it. |
| ext | `string` | Extension field; pass an empty string to clear it. |

### UpdateOwnInfoByAttributeParams

#### Description

Data model for updating a single attribute of the current user's profile.

#### Fields

| Name | Type | Description |
| --- | --- | --- |
| attribute | `UserInfoAttribute` | Target attribute. |
| value | `UserInfoAttributeValue` | Attribute value. |
