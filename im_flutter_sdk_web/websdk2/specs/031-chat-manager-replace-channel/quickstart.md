# Quickstart: ChatManager 作为消息域主门面

## 1. 目标

本 quickstart 用于验证 `031-chat-manager-replace-channel` 扩展后的公开能力：

- 使用 `ChatManager` 作为唯一公开消息 manager
- 不再使用 `ChannelManager` / `Channel`
- 使用 `Message.conversationId/conversationType`
- 创建消息入口收敛到 `ChatManager.createXMessage`
- 在 `ChatManager` 上完成消息发送、消息动作、历史查询和消息域辅助能力

## 2. 新用法

### 注册 Manager

```ts
import { ChatClient, ChatManager } from 'im-sdk-web';

const client = ChatClient.init({ appKey: 'org#app' }).use(ChatManager);
```

### 创建并发送文本消息

```ts
const message = client.chatManager.createTextMessage({
  conversationId: 'user-2',
  conversationType: 'singleChat',
  content: 'hello',
});

await client.chatManager.sendMessage(message);
```

### 标记会话已读

```ts
await client.chatManager.markConversationRead({
  conversationId: 'user-2',
  conversationType: 'singleChat',
});
```

### 查询历史消息

```ts
const page = await client.chatManager.getHistoryMessages({
  conversationId: 'user-2',
  conversationType: 'singleChat',
});

console.log(page.items);
```

### 给消息添加 Reaction

```ts
await client.chatManager.addReaction({
  messageId: message.msgServerId,
  reaction: '👍',
});
```

### 获取翻译支持语言并翻译文本消息

```ts
const languages = await client.chatManager.getSupportedTranslationLanguages();

const translated = await client.chatManager.translateMessage({
  message,
  targetLanguages: [languages[0].code],
});
```

### 统一错误处理

```ts
import { AuthenticationError, ConnectionError, ValidationError } from 'im-sdk-web';

try {
  await client.chatManager.sendMessageReadAck({
    messageId: '',
    conversationId: 'user-2',
  });
} catch (error) {
  if (error instanceof ValidationError) {
    console.log('invalid input', error.code, error.details);
  } else if (error instanceof AuthenticationError) {
    console.log('login required', error.code);
  } else if (error instanceof ConnectionError) {
    console.log('connection unavailable', error.code);
  } else {
    console.log('unexpected sdk error', error);
  }
}
```

### 注册消息域事件

```ts
client.chatManager.addEventHandler('chat-ui', {
  onMessage: payload => {
    console.log('message', payload.msgServerId);
  },
  onConversationUpdate: payload => {
    console.log('conversation update', payload.items.length);
  },
  onMessageRead: payloads => {
    console.log('message read', payloads);
  },
  onMessageRecalled: payload => {
    console.log('message recalled', payload);
  },
  onReactionChanged: payload => {
    console.log('reaction changed', payload);
  },
});
```

## 3. 旧用法对比

### 旧用法

```ts
import { ChatClient, ChannelManager } from 'im-sdk-web';

const client = ChatClient.init({ appKey: 'org#app' }).use(ChannelManager);
const channel = client.channelManager.createChannel({
  channelId: 'user-2',
  type: 'single',
});
const message = channel.createTextMessage({ content: 'hello' });
await channel.sendMessage(message);
```

### 新用法

```ts
import { ChatClient, ChatManager } from 'im-sdk-web';

const client = ChatClient.init({ appKey: 'org#app' }).use(ChatManager);
const message = client.chatManager.createTextMessage({
  conversationId: 'user-2',
  conversationType: 'singleChat',
  content: 'hello',
});

await client.chatManager.sendMessage(message);
await client.chatManager.markConversationRead({
  conversationId: 'user-2',
  conversationType: 'singleChat',
});
```

## 4. 升级检查清单

- [x] 主入口导入已从 `ChannelManager` 改为 `ChatManager`
- [x] 子路径导入已从 `im-sdk-web/managers/channel` 改为 `im-sdk-web/managers/chat`
- [x] 代码中不再实例化 `Channel`
- [x] 代码中不再调用 `channel.createXMessage`
- [x] 代码中不再调用 `channel.sendMessage`
- [x] 代码中使用 `Message.conversationId/conversationType`
- [x] 代码中不再调用 `client.createXMessage`
- [x] 代码中改为调用 `client.chatManager.createXMessage`
- [x] 消息动作、历史查询和消息域辅助能力统一从 `client.chatManager.*` 进入
- [x] 事件订阅入口继续统一为 `client.chatManager.addEventHandler`
- [x] read ack / recall / translate / reaction 等失败场景统一改为抛出 SDKError，而不是返回 `false`

## 5. 手工验证步骤

1. 在 demo 中完成初始化和登录。
2. 通过 `use(ChatManager)` 或 `init({ managers: [ChatManager] })` 注册 `ChatManager`。
3. 使用 `chatManager.createTextMessage` 构造文本消息，并通过 `chatManager.sendMessage` 发送。
4. 调用 `markConversationRead` 或 `sendMessageReadAck`，确认不会返回原始服务端 envelope。
5. 调用 `getHistoryMessages`，确认历史消息结果使用统一 `Message` 业务对象。
6. 对一条消息执行一项互动动作，如 `addReaction`、`pinMessage` 或 `updateMessage`。
7. 确认 `addEventHandler` 可以接收到至少一类消息域 action 事件。
8. 确认 demo 和示例代码不再依赖 `createChannel()`。
9. 人为构造一条参数错误或未登录错误，确认公开层抛出的是 `ValidationError`、`AuthenticationError`、`ConnectionError` 或等价归一化错误，而不是 `false` 或原始 HTTP 响应。

## 6. 自动化验证建议

至少执行：

```bash
npm run test:gate:pr
npm run test:e2e
npm run lint
npm run type-check
```

必要时补充针对消息域能力的专项回归：

```bash
npm run test:run -- tests/unit/managers/chat-manager.test.ts tests/types/chat-manager-events.d.ts
npm run test:run -- tests/integration/mock/chat-manager-public-api.test.ts
```

## 7. 当前状态

031 当前已补齐 `ChatManager` 消息域动作、历史消息、互动状态、翻译/举报和事件面的单测、集成测试与浏览器 smoke 入口。

已执行验证：

- `npm run test:run -- tests/unit/managers/chat-manager.test.ts`
- `npm run test:run -- tests/integration/chat-manager/message-actions.integration.test.ts tests/integration/chat-manager/message-history.integration.test.ts tests/integration/chat-manager/message-interactions.integration.test.ts tests/integration/chat-manager/message-auxiliary.integration.test.ts`
- `npm run type-check`

浏览器 smoke 路径：

1. 在 demo 中初始化并登录。
2. 发送一条文本消息。
3. 在“发送消息”页点击“标记当前会话已读”。
4. 在日志页确认同时看到 `会话已读标记成功` 与 `onConversationRead`。

仍建议在发布前继续执行完整门禁，并抽样验证 `docs/reference/chat-manager-api-error-codes.md` 与 `src/utils/error-codes.ts` 的常量和处理策略保持一致。

## 8. 本期明确不包含

- conversation CRUD
- conversation 列表查询 API
- unread 聚合管理 API
- 独立 `TranslationManager` / `ReactionManager`
- 将 `Message.channel` 替换为其他结构

这些内容后续另立 feature 补充。
