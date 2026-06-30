# Contract: ChatClient Multi-Device Listener

## Listener Registration

Applications register MultiDevice callbacks through the existing ChatClient event API:

```ts
client.addEventHandler('multi-device-ui', {
  onMultiDeviceContact: event => {},
  onMultiDeviceGroup: event => {},
  onMultiDeviceThread: event => {},
  onMultiDeviceConversation: event => {},
  onMultiDeviceMessageRemoved: event => {},
});

client.removeEventHandler('multi-device-ui');
```

Contract rules:
- Registration and removal use the same handler ID semantics as existing ChatClient events.
- A failing callback MUST NOT prevent other registered callbacks for the same event from running.
- Existing business callbacks remain valid and do not need `deviceId` to express MultiDevice semantics.

## Callback Payloads

### `onMultiDeviceContact`

Required:
- `category: 'contact'`
- `operation`
- `targetUserId`

Optional:
- `deviceId`
- `rosterVersion`
- `ext`
- `timestamp`
- `raw`

### `onMultiDeviceGroup`

Required:
- `category: 'group'`
- `operation`
- `groupId`

Optional:
- `deviceId`
- `userIds`
- `operatorId`
- `timestamp`
- `raw`

### `onMultiDeviceThread`

Required:
- `category: 'thread'`
- `operation`
- `threadId`

Optional:
- `deviceId`
- `parentId`
- `userIds`
- `operatorId`
- `timestamp`
- `raw`

### `onMultiDeviceConversation`

Required:
- `category: 'conversation'`
- `operation`
- `conversationId`

Optional:
- `deviceId`
- `conversationType`
- `mark`
- `remindType`
- `silentMode`
- `timestamp`
- `raw`

### `onMultiDeviceMessageRemoved`

Required:
- `category: 'messageRemoved'`
- `operation`
- `conversationId`
- At least one of `messageIds` or `beforeTimestamp`

Optional:
- `deviceId`
- `conversationType`
- `messageIds`
- `beforeTimestamp`
- `timestamp`
- `raw`

## Operation Coverage

| Category | Web operations | Mobile/documentation source |
|----------|----------------|-----------------------------|
| Contact | `CONTACT_REMOVE`, `CONTACT_ACCEPT`, `CONTACT_DECLINE`, `CONTACT_BAN`, `CONTACT_ALLOW`, `UNKNOWN` | `EMMultiDeviceListener` contact callbacks |
| Group | `GROUP_CREATE`, `GROUP_DESTROY`, `GROUP_JOIN`, `GROUP_LEAVE`, `GROUP_APPLY`, `GROUP_APPLY_ACCEPT`, `GROUP_APPLY_DECLINE`, `GROUP_INVITE`, `GROUP_INVITE_ACCEPT`, `GROUP_INVITE_DECLINE`, `GROUP_KICK`, `GROUP_BAN`, `GROUP_ALLOW`, `GROUP_BLOCK`, `GROUP_UNBLOCK`, `GROUP_ASSIGN_OWNER`, `GROUP_ADD_ADMIN`, `GROUP_REMOVE_ADMIN`, `GROUP_ADD_MUTE`, `GROUP_REMOVE_MUTE`, `GROUP_ADD_USER_WHITE_LIST`, `GROUP_REMOVE_USER_WHITE_LIST`, `GROUP_ALL_BAN`, `GROUP_REMOVE_ALL_BAN`, `GROUP_MEMBER_METADATA_CHANGED`, `GROUP_UPDATED`, `UNKNOWN` | `EMMultiDeviceListener` group callbacks |
| Thread | `THREAD_CREATE`, `THREAD_JOIN`, `THREAD_UPDATE`, `THREAD_LEAVE`, `THREAD_DESTROY`, `THREAD_KICK`, `UNKNOWN` | `EMMultiDeviceListener` thread callbacks |
| Conversation | `CONVERSATION_DELETED`, `CONVERSATION_PINNED`, `CONVERSATION_UNPINNED`, `CONVERSATION_MARK`, `CONVERSATION_MUTE_INFO_CHANGED`, `UNKNOWN` | `EMMultiDeviceListener` conversation callbacks |
| Message removed | `MESSAGE_REMOVED`, `UNKNOWN` | `EMMultiDeviceListener` remote message removed callback |

## Device Source Normalization

Input candidates:
- protocol `deviceId`
- protocol `resource`
- protocol JID `clientResource`

Output:
- `deviceId?: string`

Rules:
- First non-empty source value is exposed as `deviceId`.
- Missing source is represented as `undefined`.
- Source matching current `clientResource` is treated as same-device echo and filtered.

## Unsupported Scope

Chatroom membership, admin, mute, allowlist, announcement and attribute operations are not MultiDevice events in this feature. Existing chatroom business events remain unchanged.

## Cache Responsibility

MultiDevice callbacks are notification contracts only. They do not guarantee local contact, group, thread, conversation or message cache convergence. Applications or existing managers may refresh state after receiving callbacks when needed.
