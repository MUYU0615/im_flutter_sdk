# Data Model: ChatClient Multi-Device Listener

## MultiDeviceCategory

Stable category union used to classify callbacks.

```ts
type MultiDeviceCategory =
  | 'contact'
  | 'group'
  | 'thread'
  | 'conversation'
  | 'messageRemoved';
```

Validation rules:
- Category is derived internally from protocol notify source.
- Chatroom notify MUST NOT map to a MultiDevice category in this feature.

## MultiDeviceEventBase

Common envelope shared by all MultiDevice payloads.

Fields:
- `category: MultiDeviceCategory` - event category.
- `operation: string` - stable Web operation union for the category.
- `deviceId?: string` - normalized source device/resource/clientResource.
- `timestamp?: number` - server event timestamp when available.
- `raw?: Readonly<Record<string, unknown>>` - optional diagnostic fields, not required for business logic.

Validation rules:
- `deviceId` is omitted/`undefined` when upstream source is missing.
- Empty string device values are treated as missing.
- If `deviceId` equals current client resource, the event is filtered before dispatch.

## MultiDeviceContactEvent

Payload for `onMultiDeviceContact`.

Operations:
- `CONTACT_REMOVE`
- `CONTACT_ACCEPT`
- `CONTACT_DECLINE`
- `CONTACT_BAN`
- `CONTACT_ALLOW`
- `UNKNOWN`

Fields:
- `category: 'contact'`
- `operation: MultiDeviceContactOperation`
- `targetUserId: string`
- `rosterVersion?: string`
- `ext?: string`
- `deviceId?: string`
- `timestamp?: number`
- `raw?: Readonly<Record<string, unknown>>`

Validation rules:
- `targetUserId` is required.
- ROSTER payloads without a usable target user ID are discarded.

## MultiDeviceGroupEvent

Payload for `onMultiDeviceGroup`.

Operations:
- `GROUP_CREATE`
- `GROUP_DESTROY`
- `GROUP_JOIN`
- `GROUP_LEAVE`
- `GROUP_APPLY`
- `GROUP_APPLY_ACCEPT`
- `GROUP_APPLY_DECLINE`
- `GROUP_INVITE`
- `GROUP_INVITE_ACCEPT`
- `GROUP_INVITE_DECLINE`
- `GROUP_KICK`
- `GROUP_BAN`
- `GROUP_ALLOW`
- `GROUP_BLOCK`
- `GROUP_UNBLOCK`
- `GROUP_ASSIGN_OWNER`
- `GROUP_ADD_ADMIN`
- `GROUP_REMOVE_ADMIN`
- `GROUP_ADD_MUTE`
- `GROUP_REMOVE_MUTE`
- `GROUP_ADD_USER_WHITE_LIST`
- `GROUP_REMOVE_USER_WHITE_LIST`
- `GROUP_ALL_BAN`
- `GROUP_REMOVE_ALL_BAN`
- `GROUP_MEMBER_METADATA_CHANGED`
- `GROUP_UPDATED`
- `UNKNOWN`

Fields:
- `category: 'group'`
- `operation: MultiDeviceGroupOperation`
- `groupId: string`
- `userIds?: ReadonlyArray<string>`
- `operatorId?: string`
- `deviceId?: string`
- `timestamp?: number`
- `raw?: Readonly<Record<string, unknown>>`

Validation rules:
- `groupId` is required.
- Chatroom MUC payloads are excluded even if they share protocol structures with groups.

## MultiDeviceThreadEvent

Payload for `onMultiDeviceThread`.

Operations:
- `THREAD_CREATE`
- `THREAD_JOIN`
- `THREAD_UPDATE`
- `THREAD_LEAVE`
- `THREAD_DESTROY`
- `THREAD_KICK`
- `UNKNOWN`

Fields:
- `category: 'thread'`
- `operation: MultiDeviceThreadOperation`
- `threadId: string`
- `parentId?: string`
- `userIds?: ReadonlyArray<string>`
- `operatorId?: string`
- `deviceId?: string`
- `timestamp?: number`
- `raw?: Readonly<Record<string, unknown>>`

Validation rules:
- `threadId` is required.
- `parentId` is included when protocol payload provides the parent conversation/group ID.

## MultiDeviceConversationEvent

Payload for `onMultiDeviceConversation`.

Operations:
- `CONVERSATION_DELETED`
- `CONVERSATION_PINNED`
- `CONVERSATION_UNPINNED`
- `CONVERSATION_MARK`
- `CONVERSATION_MUTE_INFO_CHANGED`
- `UNKNOWN`

Fields:
- `category: 'conversation'`
- `operation: MultiDeviceConversationOperation`
- `conversationId: string`
- `conversationType?: 'singleChat' | 'groupChat' | 'chatRoom'`
- `mark?: number`
- `remindType?: string`
- `silentMode?: Readonly<Record<string, unknown>>`
- `deviceId?: string`
- `timestamp?: number`
- `raw?: Readonly<Record<string, unknown>>`

Validation rules:
- `conversationId` is required.
- `conversationType` is included only when it can be normalized safely.

## MultiDeviceMessageRemovedEvent

Payload for `onMultiDeviceMessageRemoved`.

Operations:
- `MESSAGE_REMOVED`
- `UNKNOWN`

Fields:
- `category: 'messageRemoved'`
- `operation: MultiDeviceMessageRemovedOperation`
- `conversationId: string`
- `conversationType?: 'singleChat' | 'groupChat' | 'chatRoom'`
- `messageIds?: ReadonlyArray<string>`
- `beforeTimestamp?: number`
- `deviceId?: string`
- `timestamp?: number`
- `raw?: Readonly<Record<string, unknown>>`

Validation rules:
- `conversationId` is required.
- At least one of `messageIds` or `beforeTimestamp` MUST exist.
- Empty `messageIds` arrays are treated as missing.

## MultiDeviceEventHandlerMap

Public handler shape accepted by `ChatClient.addEventHandler`.

Fields:
- `onMultiDeviceContact?: (payload: MultiDeviceContactEvent) => void | Promise<void>`
- `onMultiDeviceGroup?: (payload: MultiDeviceGroupEvent) => void | Promise<void>`
- `onMultiDeviceThread?: (payload: MultiDeviceThreadEvent) => void | Promise<void>`
- `onMultiDeviceConversation?: (payload: MultiDeviceConversationEvent) => void | Promise<void>`
- `onMultiDeviceMessageRemoved?: (payload: MultiDeviceMessageRemovedEvent) => void | Promise<void>`

Validation rules:
- Handler errors are isolated by existing EventHub behavior.
- Removing one handler ID MUST NOT remove handlers registered under another ID.
