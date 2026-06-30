# Contract: ChatManager 事件面收敛

## 1. ChatManager Event Handler Contract

After this feature, `ChatManager.addEventHandler(id, handlers)` accepts retained ChatManager event keys only.

Allowed keys relevant to this feature:

```ts
chatManager.addEventHandler('handler-id', {
  onMessage: message => {},
  onStreamMessage: streamMessage => {},
  onPinnedMessageChanged: payload => {},
});
```

Removed keys:

```ts
chatManager.addEventHandler('handler-id', {
  // MUST be a type error after this feature
  onCombineMessage: message => {},
  onMessageStatus: message => {},
  onMessagePinChange: payload => {},
});
```

Contract rules:
- `onCombineMessage` is not part of the public handler map.
- `onMessageStatus` is not part of the public handler map.
- `onMessagePinChange` is not part of the public handler map.
- `onStreamMessage` remains part of the public handler map.
- `onPinnedMessageChanged` remains part of the public handler map.
- Other unrelated ChatManager events remain unchanged unless explicitly listed above.

## 2. Incoming Message Dispatch Contract

Non-stream incoming messages dispatch through `onMessage`.

```ts
chatManager.addEventHandler('messages', {
  onMessage: message => {
    if (message.type === 'combine') {
      // combine message handling
    }
  },
});
```

Contract rules:
- Ordinary messages dispatch once through `onMessage`.
- Combine messages dispatch once through `onMessage`.
- Combine messages are identified only by `message.type === 'combine'`.
- Combine messages do not dispatch through `onCombineMessage`.
- Stream messages are excluded from this contract and continue through `onStreamMessage`.

## 3. Stream Message Dispatch Contract

Stream messages keep the existing `onStreamMessage` contract.

```ts
chatManager.addEventHandler('stream', {
  onStreamMessage: message => {
    const delta = message.stream.deltaText;
    const full = message.stream.fullText;
    const status = message.stream.status;
  },
});
```

Contract rules:
- Stream messages dispatch through `onStreamMessage`.
- Existing stream ordering, deduplication, fallback full, completion, and error semantics are preserved.
- Stream messages do not dispatch through `onMessage` in this feature.

## 4. Message Send Outcome Contract

`sendMessage` remains the public source of sending, success, and failure outcomes.

```ts
await chatManager.sendMessage(message, {
  onSending: sendingMessage => {},
  onSuccess: sentMessage => {},
  onFailed: (failedMessage, error) => {},
});
```

Contract rules:
- `onSending` receives the message after send preparation starts.
- `onSuccess` receives the sent message after ACK success.
- `onFailed` receives a failed message and error for local failure, timeout, ACK rejection, or socket failure.
- The returned Promise resolves with the sent message or rejects with the send error.
- Public `onMessageStatus` is not emitted or accepted.

## 5. Internal Sent Context Contract

SDK internals may keep a sent message context for follow-up action notifications.

Contract rules:
- The context is internal-only.
- It must not appear in `ChatEventName`, `EventPayloadMap`, or `ChatEventHandlerMap`.
- ACK success must still update enough message context for recall, update, read, pin, and unpin notifications.

## 6. Pinned Message Changed Contract

`onPinnedMessageChanged` is the only public message pin change event.

```ts
chatManager.addEventHandler('pins', {
  onPinnedMessageChanged: event => {
    const operation = event.operation;
  },
});
```

Contract rules:
- Local `pinMessage` dispatches `onPinnedMessageChanged` with `operation: 'pin'`.
- Local `unpinMessage` dispatches `onPinnedMessageChanged` with `operation: 'unpin'`.
- Remote pin/unpin notifications dispatch `onPinnedMessageChanged`.
- `onMessagePinChange` is not emitted or accepted.

## 7. Documentation Contract

Public reference documentation must reflect only the retained event surface.

Contract rules:
- `onCombineMessage` must not appear in active docs.
- `onMessageStatus` must not appear in active docs.
- `onMessagePinChange` must not appear in active docs.
- No removed/deprecated/migration section is required for these names.
