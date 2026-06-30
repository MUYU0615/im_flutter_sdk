# Contract: Message Conversation Fields

## Purpose

定义 `037-message-conversation-fields` 对 SDK 公开消息模型、消息创建入参、事件 payload 和类型导出面的契约。
这是 SDK TypeScript API 契约，不是 HTTP / REST 契约。

## 1. Public Types

### 1.1 `ChatConversationType`

```ts
type ChatConversationType = 'singleChat' | 'groupChat' | 'chatRoom';
```

**Contract**

- MUST 作为消息域公开会话类型取值集合。
- MUST 与现有 ChatManager / Conversation API 的 canonical naming 对齐。
- MUST NOT 公开 `single | group | room` 作为消息会话类型。

### 1.2 `Message`

```ts
interface Message {
  msgServerId: string;
  msgLocalId: string;
  sender: Sender;
  conversationId: string;
  conversationType: ChatConversationType;
  type: MessageType;
  status: MessageStatus;
  ext: Record<string, unknown>;
  timestamp: number;
  body: MessageBody;
  direct?: MessageDirect;
}
```

**Contract**

- MUST include `conversationId`.
- MUST include `conversationType`.
- MUST NOT include public `channel`.
- Single chat incoming messages MUST use the peer user ID as `conversationId`.
- Group and chatroom messages MUST use group ID / chatroom ID as `conversationId`.

## 2. Message Creation

### 2.1 Text message

```ts
const message = client.chatManager.createTextMessage({
  conversationId: 'user-2',
  conversationType: 'singleChat',
  content: 'hello',
});
```

**Contract**

- All `chatManager.createXMessage` methods MUST accept `conversationId/conversationType`.
- All `createXMessage` methods MUST reject missing or invalid conversation fields with existing validation errors.
- `channel` MUST NOT be accepted as a public compatibility input.

### 2.2 Group targeted message

```ts
const message = client.chatManager.createTextMessage({
  conversationId: 'group-1',
  conversationType: 'groupChat',
  content: 'hello',
  receiverList: ['user-2'],
});
```

**Contract**

- `receiverList` MUST only be valid when `conversationType === 'groupChat'`.
- Non-group messages with `receiverList` MUST fail validation.

### 2.3 Chatroom priority message

```ts
const message = client.chatManager.createTextMessage({
  conversationId: 'room-1',
  conversationType: 'chatRoom',
  content: 'hello',
  priority: 'high',
});
```

**Contract**

- Chatroom priority mapping MUST continue to work from `conversationType`.
- Upload and protocol metadata MUST use `conversationId` as target.

## 3. Combine Message Items

```ts
interface CombineMessageItem {
  type: Exclude<MessageType, 'cmd'>;
  sender: Sender;
  conversationId: string;
  conversationType: ChatConversationType;
  timestamp: number;
  body: Record<string, unknown>;
}
```

**Contract**

- Each item MUST carry its own `conversationId/conversationType`.
- Items MUST NOT rely on the parent combine message conversation.
- Items MUST NOT expose `channel`.

## 4. Events

**Contract**

- `onMessage` payload MUST be a `Message` using `conversationId/conversationType`.
- `onMessageStatus` payload MUST be a `Message` using `conversationId/conversationType`.
- Combine, stream, recall, update, read, reaction and pin event payloads MUST NOT expose `channel` when they include message objects or message locators.

## 5. Public Export Surface

**Contract**

- SDK root exports MUST NOT expose message-domain `ChannelReference`.
- SDK root exports MUST NOT expose message-domain `ChannelType`.
- Internal private types MAY exist for protocol mapping, but MUST NOT appear in public type declarations.

## 6. Error Contract

**Contract**

- Missing `conversationId` MUST fail with existing validation error behavior.
- Invalid `conversationType` MUST fail with existing validation error behavior.
- Legacy `channel` input MUST NOT be transformed into new fields.
- No migration-specific error code is required.

## 7. Migration Contract

### Before

```ts
client.chatManager.createTextMessage({
  channel: { channelId: 'user-2', type: 'single' },
  content: 'hello',
});
```

### After

```ts
client.chatManager.createTextMessage({
  conversationId: 'user-2',
  conversationType: 'singleChat',
  content: 'hello',
});
```

**Mapping**

| Old field | New field |
|-----------|-----------|
| `channel.channelId` | `conversationId` |
| `channel.type === 'single'` | `conversationType === 'singleChat'` |
| `channel.type === 'group'` | `conversationType === 'groupChat'` |
| `channel.type === 'room'` | `conversationType === 'chatRoom'` |
