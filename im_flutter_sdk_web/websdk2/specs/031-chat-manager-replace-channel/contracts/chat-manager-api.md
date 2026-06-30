# Contract: ChatManager Public API

## Purpose

定义 `031-chat-manager-replace-channel` 在扩展后对外公开的 `ChatManager` SDK API 契约。  
这是 SDK 公开接口契约，不是 HTTP / REST 契约。

## 1. Manager Registration

### 1.1 `use(ChatManager)`

```ts
const client = ChatClient.init({ appKey: 'org#app' }).use(ChatManager);
client.chatManager;
```

**Contract**

- `client.use(ChatManager)` MUST 返回同一个 `client` 实例
- 返回值 MUST 具备 `chatManager` 属性
- `chatManager` MUST 已绑定当前 `client`

### 1.2 `init({ managers: [ChatManager] })`

```ts
const client = ChatClient.init({
  appKey: 'org#app',
  managers: [ChatManager],
});
```

**Contract**

- 通过 `init` 注册时，`client.chatManager` MUST 可直接使用
- 若 manager key 冲突，初始化 MUST 抛出 `ValidationError`

## Error Contract

- ChatManager 全部公开方法 MUST 以 Promise 失败抛错表达错误，不返回 `false`、`null` 或服务端 envelope 表达失败
- 错误码矩阵 MUST 与 [chat-manager-api-error-codes.md](/Users/zhangdong/code/websdk2/docs/reference/chat-manager-api-error-codes.md) 保持一致
- 参数错误 MUST 优先抛 `ValidationError`
- 登录态或鉴权错误 MUST 优先抛 `AuthenticationError`
- WebSocket / MSync 发送失败 MUST 优先抛 `ConnectionError`
- HTTP 传输失败 MUST 优先抛 `NetworkError` 或 `RestTransportError`
- 服务端业务错误 MUST 抛 `SDKError` 或 `RestBusinessError`，并挂载稳定的 `ERROR_CODES`

## 2. Message Creation Baseline

### 2.1 `chatManager.createXMessage`

```ts
const message = client.chatManager.createTextMessage({
  conversationId: 'user-2',
  conversationType: 'singleChat',
  content: 'hello',
});
```

**Contract**

- `chatManager.createTextMessage`
- `chatManager.createImageMessage`
- `chatManager.createFileMessage`
- `chatManager.createVoiceMessage`
- `chatManager.createVideoMessage`
- `chatManager.createLocationMessage`
- `chatManager.createCmdMessage`
- `chatManager.createCustomMessage`
- `chatManager.createCombineMessage`

这些入口 MUST 由 `ChatManager` 对外暴露，并由 SDK 内部注入 sender。

**Non-goal**

- 不公开 `ChatClient.createXMessage`
- 不保留 `channel.createXMessage`

## 3. Core Message Actions

### 3.1 `chatManager.sendMessage`

```ts
const sent = await client.chatManager.sendMessage(message);
```

**Contract**

- `chatManager.sendMessage` MUST 接受 `Message`
- `chatManager.sendMessage` MUST 复用现有发送链路
- 未绑定 client 时 MUST 抛出明确错误
- 发送错误语义 MUST 与 `ChatClient.sendMessage` 保持一致

### 3.2 `chatManager.markConversationRead`

```ts
await client.chatManager.markConversationRead({
  conversationId: 'user-2',
  conversationType: 'singleChat',
});
```

**Contract**

- MUST 表达“当前会话已读”的业务语义
- 成功返回 MUST 为 `Promise<void>`
- MUST NOT 透传旧工程 channel ack 响应
- 对移动端 silent-fail 条件 MUST 收敛为幂等成功或显式错误

### 3.3 `chatManager.markMessageRead`

```ts
await client.chatManager.markMessageRead({
  messages: [{ message }],
});

await client.chatManager.markMessageRead({
  messages: [
    { message: groupMessage1, ackContent: 'read-1' },
    { message: groupMessage2, ackContent: 'read-2' },
  ],
});
```

**Contract**

- MUST 作为单聊和群聊消息已读回执的统一入口
- `messages` MUST 为非空数组
- `messages` 中所有消息 MUST 属于同一个会话，且 `conversationId` 与 `conversationType` MUST 完全一致
- MUST 仅允许收到的 `singleChat` / `groupChat` 消息；非接收消息、消息方向不合法或服务端消息 ID 为空时 MUST 抛 `ValidationError`
- `ackContent` MUST 仅允许用于群聊消息；单聊传入 `ackContent` MUST 抛 `ValidationError`
- SDK 当前 MUST 按传入顺序逐条发送底层服务端 read ack

### 3.4 `chatManager.recallMessage`

```ts
const recalled = await client.chatManager.recallMessage({
  messageId: 'm1',
  conversationId: 'user-2',
  conversationType: 'singleChat',
});
```

**Contract**

- MUST 对可撤回消息提供统一撤回入口
- 返回值 MUST 为业务结果对象或标准化消息对象
- MUST NOT 返回底层发送回执结构
- 超过撤回时限时 MUST 抛带 `ERROR_CODES.MESSAGE_RECALL_TIME_LIMIT` 的错误

### 3.5 `chatManager.updateMessage`

```ts
const updated = await client.chatManager.updateMessage({
  messageId: 'm1',
  message,
});
```

**Contract**

- MUST 作为唯一公开消息编辑入口
- MUST 对不支持编辑的消息类型抛出明确错误
- 返回值 MUST 为业务结果对象或标准化消息对象
- 编辑失败或不支持编辑时 MUST 使用稳定错误码，如 `OPERATION_UNSUPPORTED` / `MESSAGE_EDIT_FAILED`

## 4. Query, Download and Removal

### 4.1 `chatManager.getHistoryMessages`

```ts
const page = await client.chatManager.getHistoryMessages({
  conversationId: 'group-1',
  conversationType: 'groupChat',
  senderIds: ['user-a', 'user-b'],
  messageTypes: ['text', 'image'],
  startTime: 1716000000000,
  endTime: 1716100000000,
  pageSize: 20,
  searchDirection: 'up',
});
```

**Params**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `conversationId` | `string` | ✅ | 会话 ID |
| `conversationType` | `ChatConversationType` | ✅ | 会话类型 |
| `cursor` | `string` | — | 分页游标，首次不传 |
| `pageSize` | `number` | — | 每页条数，默认 20，最大 50 |
| `searchDirection` | `'up' \| 'down'` | — | 拉取方向，默认 `up`（从新到旧） |
| `senderIds` | `string[]` | — | 按发送者过滤（仅群聊/聊天室有效），服务端参数名 `userIds` |
| `messageTypes` | `Message['type'][]` | — | 按消息类型过滤，不传则查询所有类型 |
| `startTime` | `number` | — | 起始时间戳（ms） |
| `endTime` | `number` | — | 结束时间戳（ms） |

**Contract**

- MUST 返回标准化历史消息分页业务对象
- MUST NOT 暴露旧 `queue/start/isGroup` 风格入参
- 消息项 MUST 复用统一 `Message` 模型
- `senderIds` 传给服务端时字段名 MUST 为 `userIds`
- `messageTypes` MUST 支持所有 `Message['type']` 值（含 `cmd`）

### 4.2 `chatManager.downloadMessageAttachment`

```ts
const result = await client.chatManager.downloadMessageAttachment({
  message,
});
```

**Contract**

- MUST 用于下载附件类消息内容
- 返回值 MUST 为附件下载业务对象
- MUST NOT 透传原始下载响应
- 文件不存在、文件过期或文件损坏时 MUST 使用稳定附件错误码

### 4.3 `chatManager.downloadAndParseCombineMessage`

```ts
const items = await client.chatManager.downloadAndParseCombineMessage({
  message,
});
```

**Contract**

- MUST 返回标准化 `Message[]`
- MUST 复用当前仓库既有合并消息下载解析约束
- 下载成功但解析失败时 MUST 抛稳定解析类错误，不得只返回底层异常字符串

### 4.4 `chatManager.removeHistoryMessages`

```ts
await client.chatManager.removeHistoryMessages({
  conversationId: 'user-2',
  conversationType: 'singleChat',
  messageIds: ['m1', 'm2'],
});
```

**Contract**

- MUST 支持按消息 ID 集合或时间边界删除历史消息
- 成功返回 MUST 为 `Promise<void>`

## 5. Message Interaction State

### 5.1 `chatManager.getGroupMessageReadUsers`

```ts
const result = await client.chatManager.getGroupMessageReadUsers({
  groupId: 'group-1',
  messageId: 'm1',
});
```

**Contract**

- MUST 返回群消息已读业务对象
- MUST NOT 透传原始服务端列表包装

### 5.2 Reaction APIs

```ts
await client.chatManager.addReaction({ messageId: 'm1', reaction: '👍' });
await client.chatManager.removeReaction({ messageId: 'm1', reaction: '👍' });
const summary = await client.chatManager.getReactionList({ messageId: 'm1' });
const detail = await client.chatManager.getReactionDetail({
  messageId: 'm1',
  reaction: '👍',
});
```

**Contract**

- `addReaction` / `removeReaction` 成功时 MUST 返回 `void`
- `getReactionList` MUST 返回 Reaction 摘要业务对象列表
- `getReactionDetail` MUST 返回带分页信息的用户明细业务对象

### 5.3 Pin APIs

```ts
await client.chatManager.pinMessage({
  conversationId: 'group-1',
  conversationType: 'groupChat',
  messageId: 'm1',
});

await client.chatManager.unpinMessage({
  conversationId: 'group-1',
  conversationType: 'groupChat',
  messageId: 'm1',
});

const pinned = await client.chatManager.getPinnedMessages({
  conversationId: 'group-1',
  conversationType: 'groupChat',
});
```

**Contract**

- `pinMessage` / `unpinMessage` 成功返回 MUST 为 `Promise<void>`
- `getPinnedMessages` MUST 返回置顶消息分页业务对象

## 6. Translation

### 6.2 `chatManager.getSupportedTranslationLanguages`

```ts
const languages = await client.chatManager.getSupportedTranslationLanguages();
```

**Contract**

- MUST 返回翻译语言业务对象列表
- MUST NOT 透传原始 `code/data` 结构
- 403/401/网络失败等错误 MUST 归类到稳定的认证、传输或服务类错误

### 6.3 `chatManager.translateMessage`

```ts
const translated = await client.chatManager.translateMessage({
  message,
  targetLanguages: ['zh-Hans'],
});
```

**Contract**

- MUST 面向“翻译消息内容”的业务语义
- 返回值 MUST 为标准化翻译结果业务对象
- 非文本或不可翻译消息 MUST 抛出明确错误
- 翻译参数错误、服务未开通、配额超限和翻译失败 MUST 使用稳定的 `TRANSLATE_*` 错误码

## 7. Event Registration

### 7.1 `addEventHandler/removeEventHandler`

```ts
client.chatManager.addEventHandler('chat-ui', {
  onMessage: message => {},
  onConversationUpdate: payload => {},
  onMessageRead: payloads => {},
  onMessageRecalled: payload => {},
});

client.chatManager.removeEventHandler('chat-ui');
```

**Contract**

- MUST 继续使用 `addEventHandler/removeEventHandler`
- MUST NOT 新增 `addMessageListener/removeMessageListener`
- `handlers` MUST 只允许 `ChatManager` 事件面中的事件
- `onMessageRead` payload MUST 为 `ReadonlyArray<MessageReadEventPayload>`；单条已读也 MUST 使用数组承载

### 7.2 Supported Events

`ChatManager` 扩展后至少支持：

- `onMessage`
- `onCombineMessage`
- `onStreamMessage`
- `onMessageStatus`
- `onConversationUpdate`
- `onMessageRead`
- `onConversationRead`
- `onMessageRecalled`
- `onMessageUpdated`
- `onReactionChanged`
- `onPinnedMessageChanged`

**Constraint**

- 事件 payload MUST 为消息域业务对象，不得暴露原始下行通知结构

## 8. Removed Public API

以下入口 MUST 直接移除：

```ts
client.use(ChannelManager);
client.channelManager;
client.channelManager.createChannel(...);
client.channelManager.getChannel(...);
client.channelManager.getChannels();

const channel = new Channel(...);
channel.createTextMessage(...);
channel.sendMessage(...);
```

**Contract**

- 不提供 deprecated 别名
- 不提供桥接层
- 文档、demo、导出和测试 MUST 不再使用这些入口

## 9. Manager Export Contract

### Main Entry

```ts
import { ChatClient, ChatManager } from 'im-sdk-web';
```

### Subpath Entry

```ts
import { ChatManager } from 'im-sdk-web/managers/chat';
```

**Contract**

- 主入口 MUST 导出 `ChatManager`
- 子路径 MUST 使用 `./managers/chat`
- `./managers/channel` MUST 被移除

## 10. Explicitly Deferred

以下能力不属于 031：

- `getConversation`
- `getAllConversations`
- `deleteConversation`
- unread 聚合管理 API
- conversation CRUD
- 独立 `TranslationManager` / `ReactionManager`

这些内容将在后续 feature 中补充。
