# Quickstart: ChatManager 事件面收敛

## Scope

本功能只收敛 ChatManager 公开事件面：

- 删除 `onCombineMessage`
- 删除 `onMessageStatus`
- 删除 `onMessagePinChange`
- 保留 `onStreamMessage`
- 保留 `onPinnedMessageChanged`
- 合并消息改走 `onMessage`

## Recommended Validation

### 1. Type checks

```bash
npm run type-check
```

Expected coverage:
- `ChatManager.addEventHandler` 不再接受 `onCombineMessage`
- `ChatManager.addEventHandler` 不再接受 `onMessageStatus`
- `ChatManager.addEventHandler` 不再接受 `onMessagePinChange`
- `onStreamMessage` 仍可注册
- `onPinnedMessageChanged` 仍可注册

### 2. Unit tests

```bash
npm run test:run -- tests/unit/core/message tests/unit/managers/chat-manager.test.ts
```

Expected coverage:
- combine 消息触发 `onMessage`
- combine 消息不再触发专用事件
- stream 消息仍触发 `onStreamMessage`
- `sendMessage` options 回调仍表达 sending/success/failed
- pin/unpin 仍触发 `onPinnedMessageChanged`

### 3. Integration tests

```bash
npm run test:run -- tests/integration/chat-manager tests/integration/mock/chat-manager-public-api.test.ts
```

Expected coverage:
- ChatManager handler 注册与 EventHub 协作正常
- 合并消息进入 `onMessage` 后不影响消息链路
- 删除公开 `onMessageStatus` 后发送主链路仍可观测
- 删除 `onMessagePinChange` 后置顶事件仍可观测

### 4. Reused E2E/API checks

```bash
npm run test:e2e -- tests/e2e/api/message-single.spec.ts tests/e2e/api/chat-manager-advanced.spec.ts
```

Expected coverage:
- 现有消息接收主路径不回退
- 现有置顶事件用例继续使用 `onPinnedMessageChanged`

Note: 本功能不新增专门 E2E。E2E 只复用现有 API/浏览器用例验证主路径。

### 5. Documentation/API checks

```bash
npm run docs:api:check
```

Expected coverage:
- Public reference docs no longer mention `onCombineMessage`
- Public reference docs no longer mention `onMessageStatus`
- Public reference docs no longer mention `onMessagePinChange`

## Manual Smoke Example

```ts
client.chatManager.addEventHandler('message-list', {
  onMessage: message => {
    if (message.type === 'combine') {
      // handle combine message
    }
  },
  onStreamMessage: message => {
    console.log(message.stream.deltaText);
  },
  onPinnedMessageChanged: event => {
    console.log(event.operation);
  },
});

await client.chatManager.sendMessage(message, {
  onSending: sending => console.log(sending.status),
  onSuccess: sent => console.log(sent.status),
  onFailed: (failed, error) => console.error(failed.status, error),
});
```

The following handler keys should no longer compile:

```ts
client.chatManager.addEventHandler('removed-events', {
  onCombineMessage: message => {},
  onMessageStatus: message => {},
  onMessagePinChange: event => {},
});
```
