# Data Model: 消息模型替换 channel 为会话字段

## 1. MessageConversationLocator

**描述**: 消息域唯一公开会话定位模型，替代旧 `ChannelReference`。

**字段**:

- `conversationId: string`: 会话目标 ID。单聊为对端用户 ID，群聊为群组 ID，聊天室为聊天室 ID。
- `conversationType: ChatConversationType`: 会话类型，取值为 `singleChat | groupChat | chatRoom`。

**校验规则**:

- `conversationId` 必须为非空字符串。
- `conversationType` 必须属于 canonical 取值集合。
- 公开输入不得使用 `channel` 替代该模型。

## 2. ChatConversationType

**描述**: 公开 canonical 会话类型。

**取值**:

- `singleChat`: 单聊。
- `groupChat`: 群聊。
- `chatRoom`: 聊天室。

**映射规则**:

- 内部 `single` / `SINGLECHAT` / 单聊协议类型 -> `singleChat`
- 内部 `group` / `GROUPCHAT` / 群聊协议类型 -> `groupChat`
- 内部 `room` / `CHATROOM` / 聊天室协议类型 -> `chatRoom`

## 3. Message

**描述**: SDK 公开消息对象。

**核心字段**:

- `msgServerId: string`
- `msgLocalId: string`
- `sender: Sender`
- `conversationId: string`
- `conversationType: ChatConversationType`
- `type: MessageType`
- `status: MessageStatus`
- `ext: Record<string, unknown>`
- `timestamp: number`
- `body: MessageBody`
- `direct?: MessageDirect`
- `receiverList?: string[]`
- `deliverOnlineOnly?: boolean`
- `priority?: MessagePriority`
- `isBroadcast?: boolean`
- `isContentReplaced?: boolean`
- `combineLevel?: number`
- `stream?: StreamMessageMeta`

**移除字段**:

- `channel`

**校验规则**:

- 发送侧 `conversationId` 表示目标会话。
- 接收侧单聊 `conversationId` 必须表示当前用户以外的对端用户。
- 群聊与聊天室消息必须分别输出 `groupChat` 与 `chatRoom`。
- 不允许公开输出旧 `channel`。

## 4. CreateMessageBaseParams

**描述**: 所有 `createXMessage` 公开入参的公共字段。

**字段**:

- `conversationId: string`
- `conversationType: ChatConversationType`
- `ext?: Record<string, unknown>`
- `msgLocalId?: string`
- `timestamp?: number`
- `receiverList?: string[]`
- `deliverOnlineOnly?: boolean`
- `priority?: MessagePriority`

**校验规则**:

- `receiverList` 仅允许在 `conversationType === 'groupChat'` 时使用。
- 聊天室消息可以继续使用 `priority` 表达聊天室优先级。
- 旧 `channel` 字段不参与转换。

## 5. CombineMessageItem

**描述**: 合并消息详情中的子消息项。

**字段**:

- `msgServerId?: string`
- `msgLocalId?: string`
- `type: Exclude<MessageType, 'cmd'>`
- `sender: Sender`
- `conversationId: string`
- `conversationType: ChatConversationType`
- `timestamp: number`
- `body: Record<string, unknown>`
- `ext?: Record<string, unknown>`
- `combineLevel?: number`

**校验规则**:

- 每条子消息必须携带自己的会话定位字段。
- 子消息不得默认继承外层合并消息的会话定位。
- 子消息不得继续包含公开 `channel` 字段。

## 6. Message Event Payload

**描述**: `onMessage`、`onMessageStatus`、合并消息、流式消息以及消息动作事件中承载的公开消息对象。

**约束**:

- 若 payload 包含 `Message`，该 `Message` 必须使用 `conversationId/conversationType`。
- 若 payload 只包含消息定位信息，也应使用 `conversationId/conversationType`。
- 不得输出 `channel.channelId` 或 `channel.type`。

## 关系说明

- `CreateMessageBaseParams` --(createXMessage)--> `Message`
- MSync 下行协议 --(decode)--> `Message`
- `Message` --(send/upload/cache/event/profile sync)--> 内部协议目标或会话摘要
- `CombineMessageBody.messageList[]` --(encode/decode)--> `CombineMessageItem[]`

## 状态与生命周期

### 发送侧

- `draft input` -> `Message(status=sending)` -> `uploading` -> `sending` -> `sent`
- 任一阶段失败输出的 `Message` 仍必须使用 `conversationId/conversationType`

### 接收侧

- protocol meta/body -> decode message -> normalize conversation locator -> dispatch event/cache/profile sync
- 若无法解析非空 `conversationId`，不得生成公开空会话消息
