# Data Model: ChatManager 事件面收敛

## RetainedChatEventSurface

ChatManager 本期后保留的相关公开事件面。

Fields:
- `onMessage`: 非流式消息接收事件，包含普通消息和合并消息。
- `onStreamMessage`: 流式消息分片事件，继续承载流式状态和增量文本。
- `onPinnedMessageChanged`: 消息置顶/取消置顶变化事件。
- `otherChatEvents`: 未被本规格列为移除的其他 ChatManager 事件，例如已读、撤回、编辑、Reaction、会话同步、多端事件等。

Validation rules:
- `onMessage` MUST accept standard `Message` payload.
- `onStreamMessage` MUST accept `StreamMessage` payload.
- `onPinnedMessageChanged` MUST accept `PinnedMessageChangedEventPayload`.
- Removed event names MUST NOT appear in the public ChatManager handler map.

## RemovedChatEventName

本期直接移除的公开 ChatManager 事件名称。

Values:
- `onCombineMessage`
- `onMessageStatus`
- `onMessagePinChange`

Validation rules:
- These names MUST NOT exist in `ChatEventName`.
- These names MUST NOT exist in `EventPayloadMap`.
- These names MUST NOT be accepted by `ChatEventHandlerMap`.
- These names MUST NOT appear in public reference documentation.
- No deprecated or dual-dispatch behavior is required.

## IncomingMessageEvent

`onMessage` 的公开消息接收事件。

Fields:
- `message: Message`
- `message.type`: existing message type discriminator.
- `message.stream?: StreamMessageMeta`: absent for non-stream messages.

Validation rules:
- Ordinary non-stream messages dispatch through `onMessage`.
- Combine messages dispatch through `onMessage`.
- Combine messages are identified only by `message.type === 'combine'`.
- Stream messages MUST NOT dispatch through `onMessage` in this feature.

State transitions:
- Incoming decoded non-stream message -> remember message context -> dispatch `onMessage`.
- Incoming decoded stream message -> stream handler -> dispatch `onStreamMessage`.

## StreamMessageEvent

`onStreamMessage` 的公开流式消息事件。

Fields:
- `message: StreamMessage`
- `message.stream.seq`
- `message.stream.status`
- `message.stream.deltaText`
- `message.stream.fullText`
- `message.stream.errorType`

Validation rules:
- Existing stream ordering, deduplication, fallback full chunk, completion, and error behavior MUST remain unchanged.
- `onStreamMessage` remains available in ChatManager event registration.

## MessageSendOutcome

发送动作自身表达的消息发送状态。

Fields:
- `onSending?: (message: Message) => void`
- `onSuccess?: (message: Message) => void`
- `onFailed?: (message: Message, error: Error) => void`
- `Promise<Message>` success result
- `Promise` rejection error

Validation rules:
- Sending state MUST be observable through `onSending`.
- ACK success MUST be observable through `onSuccess` and resolved Promise.
- Local failure, timeout, ACK rejection, or socket failure MUST be observable through `onFailed` and rejected Promise.
- Public `onMessageStatus` MUST NOT be required or available.

## InternalSentMessageContext

SDK 内部用于后续消息动作通知定位会话的 sent 消息上下文。

Fields:
- `messageId`: server ID or local ID used as lookup key.
- `conversationId`
- `conversationType`
- `status`: internal lifecycle signal that the sent message reached server ACK success.

Validation rules:
- This context MUST remain internal.
- It MUST NOT be modeled as a ChatManager public event.
- It MUST be updated when a sent message reaches ACK success.
- Existing recall/update/pin/read notification handling MUST keep enough context to resolve conversation fields.

## PinnedMessageChangedEvent

保留的消息置顶变化事件。

Fields:
- `messageId`
- `conversationId`
- `conversationType`
- `operation: 'pin' | 'unpin'`
- `operatorId`
- `pinTime?`

Validation rules:
- Local `pinMessage` and `unpinMessage` operations dispatch `onPinnedMessageChanged`.
- Remote pin/unpin notifications dispatch `onPinnedMessageChanged`.
- `onMessagePinChange` MUST NOT be emitted or accepted.
