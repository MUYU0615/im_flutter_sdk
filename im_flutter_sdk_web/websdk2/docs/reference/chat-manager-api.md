# ChatManager 消息域 API 与 SDK 返回对照

> 参考：
>
> - [ChatManager API 错误码对照文档](./chat-manager-api-error-codes.md)
> - [RESTful-API-Body-Formats](./RESTful-API-Body-Formats.md)
> - [SDK 对外 API 命名规范](./sdk-naming-conventions.md)
> - 当前实现：`src/managers/chat-manager.ts`、`src/rest/chat-management.ts`、`src/types/chat-manager.ts`

> 说明：本文档按 031 最新规格收敛为目标公开面，`ChatManager` 的最终落地以实现与合同测试为准。对于服务端返回 envelope 中的 `uri/timestamp/entities/duration/requestStatusCode` 等字段，SDK 当前不直接对外暴露；公开层统一返回业务对象。

本文档说明 `ChatManager` 当前在 `websdk2` 中的：

- 实际入口与 API 范围
- MSync / REST 路径与参数语义
- 服务端原始返回结构与 SDK 归一化规则
- 事件注册入口、事件载荷与兼容边界

---

## 1. 设计原则

- 消息域唯一入口为 `client.chatManager`。
- `ChatManager` 不再暴露 `ChannelManager`、`Channel` 或 `./managers/channel` 子路径。
- 消息创建与发送统一复用 `chatManager.createXMessage(...) + chatManager.sendMessage(...)` 组合。
- 公开读接口统一返回业务对象，不直接透出 REST envelope。
- 除附件下载二进制结果外，所有公开返回都收敛为简单对象或 `Message` 模型。
- 消息域事件统一通过 `chatManager.addEventHandler(id, handlers)` / `removeEventHandler(id)` 注册。
- 用户相关只读结果优先返回最小 `UserInfo` 视图；当前 `Reaction`、群消息已读等场景不强制补拉完整资料。
- 群消息已读、Reaction、置顶、翻译等 REST API 若服务端返回结构非法，SDK 当前会显式抛出 `RestBusinessError(303)`，不再静默吞成空结果。
- `Message` 使用 `conversationId` 与 `conversationType` 作为唯一公开会话定位字段。
  - `conversationId`
  - `conversationType`: `singleChat` / `groupChat` / `chatRoom`

---

## 2. 推荐公开面

### 2.1 ChatManager 对外 API 一览

| Web SDK API                          | 协议 / REST API                                  | SDK 对外返回                                      |
| ------------------------------------ | ------------------------------------------------ | ------------------------------------------------- |
| `createTextMessage()`                | SDK 本地消息工厂                                 | `Message`                                         |
| `createImageMessage()`               | SDK 本地消息工厂                                 | `Message`                                         |
| `createFileMessage()`                | SDK 本地消息工厂                                 | `Message`                                         |
| `createVoiceMessage()`               | SDK 本地消息工厂                                 | `Message`                                         |
| `createVideoMessage()`               | SDK 本地消息工厂                                 | `Message`                                         |
| `createLocationMessage()`            | SDK 本地消息工厂                                 | `Message`                                         |
| `createCmdMessage()`                 | SDK 本地消息工厂                                 | `Message`                                         |
| `createCustomMessage()`              | SDK 本地消息工厂                                 | `Message`                                         |
| `createCombineMessage()`             | SDK 本地消息工厂                                 | `Message`                                         |
| `sendMessage()`                      | MSync 发送消息主链路                             | `Promise<Message>`                                |
| `addEventHandler()`                  | N/A（事件系统本地注册）                          | `void`                                            |
| `removeEventHandler()`               | N/A（事件系统本地注销）                          | `void`                                            |
| `markConversationRead()`             | MSync `CHANNEL_ACK`                              | `Promise<void>`                                   |
| `markMessageRead()`                  | MSync `READ_ACK` / `READ_ACK(isNeedGroupAck)`    | `Promise<void>`                                   |
| `recallMessage()`                    | MSync `RECALL`                                   | `Promise<ChatActionResult>`                       |
| `updateMessage()`                    | MSync `EDIT`                                     | `Promise<Message>`                                |
| `getHistoryMessages()`               | `POST /users/{userId}/messageroaming`            | `Promise<MessageHistoryPage>`                     |
| `downloadMessageAttachment()`        | SDK 内部附件下载链路                             | `Promise<MessageAttachmentDownloadResult>`        |
| `downloadAndParseCombineMessage()`   | SDK 内部合并消息下载解析链路                     | `Promise<ReadonlyArray<Message>>`                 |
| `removeHistoryMessages()`            | `DELETE /sdk/message/roaming/...`                | `Promise<void>`                                   |
| `getGroupMessageReadUsers()`         | `GET /chatgroups/{groupId}/acks/{messageId}`     | `Promise<GroupMessageReadUsersResult>`            |
| `addReaction()`                      | `POST /reaction/user/{userId}`                   | `Promise<void>`                                   |
| `removeReaction()`                   | `DELETE /reaction/user/{userId}`                 | `Promise<void>`                                   |
| `getReactionList()`                  | `GET /reaction/user/{userId}`                    | `Promise<ReadonlyArray<MessageReactionListItem>>` |
| `getReactionDetail()`                | `GET /reaction/user/{userId}/detail`             | `Promise<MessageReactionDetailPage>`              |
| `pinMessage()`                       | `POST /sdk/user/{userId}/user_channel/pin`       | `Promise<void>`                                   |
| `unpinMessage()`                     | `DELETE /sdk/user/{userId}/user_channel/pin`     | `Promise<void>`                                   |
| `getPinnedMessageList()`             | `GET /sdk/user/{userId}/user_channel/pin`        | `Promise<PinnedMessageListResult>`                |
| `getSupportedTranslationLanguages()` | `GET /users/{userId}/translate/support/language` | `Promise<ReadonlyArray<TranslationLanguage>>`     |
| `translateMessage()`                 | `POST /users/{userId}/translate`                 | `Promise<MessageTranslationResult>`               |

### 2.2 迁移映射

旧入口：

```ts
client.use(ChannelManager);
client.channelManager.createChannel(...);
channel.createTextMessage(...);
channel.sendMessage(...);
```

新入口：

```ts
client.use(ChatManager);

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

---

## 3. 共享数据结构

### 3.1 `ConversationLocator`

```ts
{
  conversationId: string;
  conversationType: 'singleChat' | 'groupChat' | 'chatRoom';
}
```

### 3.2 `ChatActionResult`

```ts
{
  messageId: string;
  conversationId: string;
  conversationType: 'singleChat' | 'groupChat' | 'chatRoom';
  timestamp: number;
}
```

说明：

- 用于 `recallMessage()` 这类“动作成功但不依赖服务端返回体”的接口。
- `timestamp` 为 SDK 本地完成动作时的时间戳。

### 3.3 `MessageHistoryPage`

```ts
{
  items: Message[];
  cursor: string;
  hasMore: boolean;
}
```

说明：

- 服务端真实返回里 `next_key` 可能是 `"undefined"` 字符串；SDK 当前会归一化为空字符串。
- `items` 来自 SDK 内部消息元数据解码结果，不直接暴露原始 `msgs[].msg(base64)`。

### 3.4 `MessageAttachmentDownloadResult`

```ts
{
  filename: string;
  mimeType: string;
  size?: number;
  data: Uint8Array;
  downloadUrl: string;
}
```

### 3.5 `GroupMessageReadUsersResult`

```ts
{
  groupId: string;
  messageId: string;
  users: GroupMessageReadUser[];
  count: number;
  cursor: string;
  hasMore: boolean;
}
```

其中 `GroupMessageReadUser`：

```ts
{
  userId: string;
  user: UserInfo;
  ackId?: string;
  timestamp?: number;
  ackContent?: string;
}
```

说明：

- SDK 当前优先使用服务端返回的 `ackmid` 作为结果中的 `messageId`。
- 用户资料当前返回最小视图 `UserInfo { userId }`。

### 3.6 `MessageReactionListItem`

```ts
{
  messageId: string;
  reactions: MessageReactionSummary[];
}
```

其中 `MessageReactionSummary`：

```ts
{
  reaction: string;
  count: number;
  isAddedBySelf: boolean;
  userIds: string[];
}
```

说明：

- 当前公开层不直接暴露服务端 `reactionList` 原始字段。
- 空 reaction 列表会标准化为 `reactions: []`。

### 3.7 `MessageReactionDetailPage`

```ts
{
  reaction: string;
  count: number;
  isAddedBySelf: boolean;
  reactionUsers: MessageReactionUserEntry[];
  cursor: string;
  hasMore: boolean;
  createdAt?: string;
}
```

其中 `MessageReactionUserEntry`：

```ts
{
  userId: string;
  user: UserInfo;
  createdAt?: string;
}
```

说明：

- `users` 是兼容性保留的最小用户列表视图。
- `reactionUsers` 是按真实服务端 `reactionUserList` 收紧后的对象结果。
- 服务端 `cursor: null` 会被归一化为空字符串。

### 3.8 `PinnedMessageListResult`

```ts
{
  items: PinnedMessage[];
}
```

其中 `PinnedMessage`：

```ts
{
  message: Message;
  pinTime: number;
  operatorId: string;
}
```

说明：

- 服务端原始 `message.payload` 当前由 SDK 解析并还原为标准 `Message`。
- 若某条置顶消息的 payload 无法还原，SDK 会跳过该条，而不是把原始结构直接暴露给外部。
- `getPinnedMessageList` 不分页，最多返回 20 条置顶消息。

### 3.9 `TranslationLanguage`

```ts
{
  code: string;
  name: string;
  nativeName: string;
}
```

### 3.10 `MessageTranslationResult`

```ts
{
  detectedLanguage?: {
    language: string;
    score: number;
  };
  translations: Array<{
    text: string;
    to: string;
  }>;
}
```

说明：

- 公开层仅保留翻译结果和语言识别结果，不透出原始 envelope。

---

## 4. 事件模型

消息域当前公开事件包括：

- `onMessage`
- `onStreamMessage`
- `onConversationRead`
- `onMessageRead`
- `onMessageRecalled`
- `onMessageUpdated`
- `onReactionChanged`
- `onPinnedMessageChanged`
- `onConversationListUpdate`

说明：

- 事件注册通过 `chatManager.addEventHandler(id, handlers)` / `removeEventHandler(id)` 完成，不发 REST 请求。
- `markConversationRead()` 本地调用方不会收到 `onConversationRead`；单聊对方会通过 channel ack 收到该事件。`markMessageRead()` 本地调用方不会收到 `onMessageRead`；消息原始发送方会收到该事件。`recallMessage()`、`updateMessage()`、`addReaction()`、`removeReaction()`、`pinMessage()`、`unpinMessage()` 在 SDK 当前实现里会同步派发对应业务事件。
- 事件载荷统一使用 SDK 的对象模型，不直接暴露服务端 notify 原始字段。

### 4.1 关键事件载荷

`onConversationRead`

```ts
{
  conversationId: string;
  conversationType: 'singleChat' | 'groupChat' | 'chatRoom';
  timestamp: number;
}
```

`onMessageRead`

```ts
{
  messageId: string;
  conversationId: string;
  conversationType: 'singleChat' | 'groupChat' | 'chatRoom';
  ackContent?: string;
}
```

`onMessageRecalled`

```ts
{
  messageId: string;
  conversationId: string;
  conversationType: 'singleChat' | 'groupChat' | 'chatRoom';
  timestamp: number;
}
```

`onMessageUpdated`

```ts
{
  messageId: string;
  conversationId: string;
  conversationType: 'singleChat' | 'groupChat' | 'chatRoom';
  message: {
    type: Message['type'];
    body: Message['body'];
    ext?: Record<string, unknown>;
  };
  timestamp: number;
}
```

`onReactionChanged`

```ts
{
  messageId: string;
  reaction: string;
  operation: 'add' | 'remove';
}
```

`onPinnedMessageChanged`

```ts
{
  messageId: string;
  conversationId: string;
  conversationType: 'singleChat' | 'groupChat' | 'chatRoom';
  operation: 'pin' | 'unpin';
  pinTime?: number;
  operatorId?: string;
}
```

---

## 5. API 请求参数与返回结构

> 说明：
>
> - 本节按当前实现整理，分为发送与事件、发送后动作、查询与下载、互动状态、辅助能力五类。
> - 对于 MSync action 类接口，文档记录的是 SDK 当前公开行为，不强依赖服务端返回体。
> - 对于写接口，如服务端成功返回体不稳定，文档会明确写“SDK 当前不依赖返回体”。

## 5.1 发送与事件

### `sendMessage`

**签名**

```ts
sendMessage(message: Message, options?: SendMessageOptions): Promise<Message>
```

**说明**

- 直接委托 `ChatClient.sendMessage(...)`
- 返回发送后的标准 `Message`

### `addEventHandler` / `removeEventHandler`

**签名**

```ts
addEventHandler(id: EventHandlerId, handlers: ChatEventHandlerMap): void
removeEventHandler(id: EventHandlerId): void
```

**说明**

- 本地事件系统注册/注销
- 不发 REST 请求

## 5.2 发送后动作

### `markConversationRead`

**签名**

```ts
markConversationRead(params: MarkConversationReadParams): Promise<void>
```

**协议**

- MSync `CHANNEL_ACK`

**请求参数**

```ts
{
  conversationId: string;
  conversationType: 'singleChat' | 'groupChat' | 'chatRoom';
}
```

**SDK 当前行为**

- 需要已绑定 client 且连接状态为 `CONNECTED`
- 成功后本地调用方不会收到 `onConversationRead`
- 成功后会同步清空本地会话列表未读数；如果本地会话列表发生变化，会派发 `onConversationListUpdate`，`reason` 为 `local`
- 单聊对方会通过 channel ack 收到 `onConversationRead`；群聊仅清除服务端未读数，不触发对方事件
- SDK 当前不依赖服务端成功返回体

### `markMessageRead`

**签名**

```ts
markMessageRead(params: MarkMessageReadParams): Promise<void>
```

**协议**

- 单聊：MSync `READ_ACK`
- 群聊：MSync `READ_ACK(isNeedGroupAck)`

**请求参数**

```ts
{
  messages: Array<{
    message: Message;
    ackContent?: string;
  }>;
}
```

**SDK 当前行为**

- `messages` 必须非空，且所有消息必须属于同一个会话
- SDK 会从每条 `message.msgServerId`、`message.conversationId` 与 `message.conversationType` 获取回执目标
- 仅支持收到的 `singleChat` / `groupChat` 消息；传入发送方向消息会抛出参数错误
- SDK 当前按传入顺序逐条发送服务端已读回执
- 本地调用方不会收到 `onMessageRead`
- 消息原始发送方会收到 `onMessageRead`，事件 payload 始终为 `MessageReadEventPayload[]`
- `ackContent` 仅群聊有效；单聊传入 `ackContent` 会抛出参数错误

### `recallMessage`

**签名**

```ts
recallMessage(params: RecallMessageParams): Promise<ChatActionResult>
```

**协议**

- MSync `RECALL`

**请求参数**

```ts
{
  conversationId: string;
  conversationType: 'singleChat' | 'groupChat' | 'chatRoom';
  messageId: string;
  ext?: Record<string, unknown>;
}
```

**SDK 当前行为**

- 不接收 `message` 参数，仅通过 `messageId`、`conversationId` 与 `conversationType` 定位撤回目标
- 成功返回 `ChatActionResult` 并派发 `onMessageRecalled`

### `updateMessage`

**签名**

```ts
updateMessage(params: UpdateMessageParams): Promise<Message>
```

**协议**

- MSync `EDIT`

**请求参数**

```ts
{
  conversationId: string;
  conversationType: 'singleChat' | 'groupChat' | 'chatRoom';
  messageId: string;
  message: {
    type: 'text' | 'custom';
    body: Message['body'];
    ext?: Record<string, unknown>;
  };
}
```

**SDK 当前行为**

- 当前只支持编辑 `text` / `custom`
- 成功后返回标准化 `Message`
- 会同步派发 `onMessageUpdated`

## 5.3 查询与下载

### `getHistoryMessages`

**签名**

```ts
getHistoryMessages(params: GetHistoryMessagesParams): Promise<MessageHistoryPage>
```

**REST**

```http
POST /{org}/{app}/users/{userId}/messageroaming
Content-Type: application/json
```

**请求参数**

```ts
{
  conversationId: string;
  conversationType: 'singleChat' | 'groupChat' | 'chatRoom';
  cursor?: string;
  pageSize?: number;
  searchDirection?: 'up' | 'down';
  from?: string;
  messageTypes?: ReadonlyArray<Exclude<Message['type'], 'cmd'>>;
  startTime?: number;
  endTime?: number;
}
```

**服务端原始返回（示意）**

```ts
{
  action: 'get message roaming';
  data: {
    msgs: Array<{ msg: string }>;
    next_key: string;
    is_last: boolean;
    timestamp?: number;
  };
}
```

**SDK 归一化**

- `msgs[].msg` 为 base64 的 meta message，SDK 内部会解码为标准消息对象
- `next_key: "undefined"` 归一化为空字符串
- 响应缺少 `data` 或 `data` 非对象时，显式抛 `RestBusinessError(303)`

### `downloadMessageAttachment`

**签名**

```ts
downloadMessageAttachment(params: DownloadMessageAttachmentParams): Promise<MessageAttachmentDownloadResult>
```

**SDK 当前行为**

- 直接委托 SDK 内部下载链路
- 输入消息必须是可下载附件类消息

### `downloadAndParseCombineMessage`

**签名**

```ts
downloadAndParseCombineMessage(params: DownloadCombineMessageInput): Promise<ReadonlyArray<Message>>
```

**SDK 当前行为**

- 接受完整合并消息 `{ message }`，SDK 会从 `message.body` 读取下载地址与密钥
- 也接受合并消息体中的最小下载参数 `{ url, secret, timeoutMs?, maxItems? }`
- 传入 `{ message }` 时仍会校验 `message.type === 'combine'`
- 直接委托内部合并消息下载与解析链路

### `removeHistoryMessages`

**签名**

```ts
removeHistoryMessages(params: RemoveHistoryMessagesParams): Promise<void>
```

**REST**

- 按消息 ID 删除：

```http
DELETE /{org}/{app}/sdk/message/roaming/{chat|group}/user/{userId}
```

- 按时间戳删除：

```http
DELETE /{org}/{app}/sdk/message/roaming/{chat|group}/user/{userId}/time
```

**请求参数**

```ts
{
  conversationId: string;
  conversationType: 'singleChat' | 'groupChat' | 'chatRoom';
  messageIds?: string[];
  beforeTimestamp?: number;
}
```

**SDK 当前行为**

- `messageIds` 和 `beforeTimestamp` 至少要提供一个
- 成功场景不依赖服务端返回体

## 5.4 互动状态

### `getGroupMessageReadUsers`

**签名**

```ts
getGroupMessageReadUsers(params: GroupMessageReadUsersParams): Promise<GroupMessageReadUsersResult>
```

**REST**

```http
GET /{org}/{app}/chatgroups/{groupId}/acks/{messageId}?limit={limit}&key={cursor}
```

**请求参数**

```ts
{
  groupId: string;
  messageId: string;
  cursor?: string;
  pageSize?: number;
}
```

**服务端原始返回（示意）**

```ts
{
  data: {
    ackmid: string;
    userlist: Array<{
      username: string;
      meta_id?: string;
      timestamp?: number;
      ack_content?: string;
    }>;
    total: number;
    next_key: string;
    is_last: boolean;
  }
}
```

**SDK 归一化**

- 当前兼容 `data.group_ack` 和 `data.*` 两种结构
- 用户结果统一返回对象化 `GroupMessageReadUser`
- 响应结构非法时显式抛 `RestBusinessError(303)`

### `addReaction` / `removeReaction`

**签名**

```ts
addReaction(params: ReactionOperationParams): Promise<void>
removeReaction(params: ReactionOperationParams): Promise<void>
```

**REST**

```http
POST   /{org}/{app}/reaction/user/{userId}
DELETE /{org}/{app}/reaction/user/{userId}?msgId={messageId}&message={reaction}
```

**请求参数**

```ts
{
  messageId: string;
  reaction: string;
}
```

**SDK 当前行为**

- 成功场景不依赖服务端返回体
- 成功后分别派发 `onReactionChanged(operation=add/remove)`

### `getReactionList`

**签名**

```ts
getReactionList(params: GetReactionListParams): Promise<ReadonlyArray<MessageReactionListItem>>
```

**REST**

```http
GET /{org}/{app}/reaction/user/{userId}?msgIdList={csv}&msgType={chat|group}&groupId={groupId?}
```

**请求参数**

```ts
{
  messageId: string | string[];
  conversationType: 'singleChat' | 'groupChat';
  groupId?: string;
}
```

**服务端原始返回（示意）**

```ts
{
  requestStatusCode: 'ok';
  data: Array<{
    msgId: string;
    reactionList: Array<{
      reaction: string;
      count: number;
      state?: boolean;
      userList?: string[];
    }>;
  }>;
}
```

**SDK 归一化**

- `reactionList` 转为 `reactions`
- 响应缺少 `data` 或 `data` 非数组时显式抛 `RestBusinessError(303)`

### `getReactionDetail`

**签名**

```ts
getReactionDetail(params: GetReactionDetailParams): Promise<MessageReactionDetailPage>
```

**REST**

```http
GET /{org}/{app}/reaction/user/{userId}/detail?msgId={messageId}&message={reaction}&cursor={cursor}&limit={limit}
```

**请求参数**

```ts
{
  messageId: string;
  reaction: string;
  cursor?: string;
  pageSize?: number;
}
```

**服务端原始返回（示意）**

```ts
{
  requestStatusCode: 'ok';
  data: {
    reaction: string;
    count: number;
    state: boolean;
    userList: string[];
    cursor: string | null;
    reactionUserList?: Array<{
      userId: string;
      createdAt?: string;
    }>;
    createdAt?: string;
  };
}
```

**SDK 归一化**

- `reactionUserList` → `reactionUsers`
- `cursor: null` → `cursor: ''`
- 响应结构非法时显式抛 `RestBusinessError(303)`

### `pinMessage` / `unpinMessage`

**签名**

```ts
pinMessage(params: PinMessageParams): Promise<void>
unpinMessage(params: PinMessageParams): Promise<void>
```

**REST**

```http
POST   /{org}/{app}/sdk/user/{userId}/user_channel/pin?resource={resource}
DELETE /{org}/{app}/sdk/user/{userId}/user_channel/pin?resource={resource}
```

**请求参数**

```ts
{
  conversationId: string;
  conversationType: 'singleChat' | 'groupChat' | 'chatRoom';
  messageId: string;
}
```

**SDK 当前行为**

- 成功场景不依赖服务端返回体
- 成功后分别派发 `onPinnedMessageChanged(operation=pin/unpin)`

### `getPinnedMessageList`

**签名**

```ts
getPinnedMessageList(params: GetPinnedMessageListParams): Promise<PinnedMessageListResult>
```

**REST**

```http
GET /{org}/{app}/sdk/user/{userId}/user_channel/pin?to={conversationId}&type={chat|groupchat|chatroom}&limit=20
```

**请求参数**

```ts
{
  conversationId: string;
  conversationType: 'singleChat' | 'groupChat' | 'chatRoom';
}
```

**SDK 当前行为**

- 不接收 `messageId`
- 不分页，不接收 `cursor` / `pageSize`
- 固定请求最多 20 条置顶消息

**服务端原始返回（示意）**

```ts
{
  data: {
    msg_infos: Array<{
      message: {
        id: string;
        timestamp?: number;
        payload: string | object;
      };
      pin_operator?: string;
      pin_opt_at?: number;
    }>;
  }
}
```

**SDK 归一化**

- `msg_infos[].message.payload` 当前会被解析为标准 `Message`
- 响应结构非法时显式抛 `RestBusinessError(303)`
- 若服务端返回 `error_code=15002`，SDK 公开错误码收敛为 `OPERATION_UNSUPPORTED(111)`，原始服务端码保留在 `details.serverCode`

## 5.5 辅助能力

### `getSupportedTranslationLanguages`

**签名**

```ts
getSupportedTranslationLanguages(): Promise<ReadonlyArray<TranslationLanguage>>
```

**REST**

```http
GET /{org}/{app}/users/{userId}/translate/support/language
```

**服务端成功返回（示意）**

```ts
[
  { code: 'zu', name: 'Zulu', nativeName: 'Isi-Zulu' },
  { code: 'zh-Hant', name: 'Chinese Traditional', nativeName: '繁體中文 (繁體)' },
];
```

或

```ts
{
  data: [...]
}
```

**SDK 归一化**

- 当前兼容顶层数组与 `data` 数组两种结构
- 响应结构非法时显式抛 `RestBusinessError(303)`

### `translateMessage`

**签名**

```ts
translateMessage(params: TranslateMessageParams): Promise<MessageTranslationResult>
```

**REST**

```http
POST /{org}/{app}/users/{userId}/translate
Content-Type: application/json
```

**请求参数**

```ts
{
  message: Message; // 当前仅支持 text
  targetLanguages: string[];
}
```

实际请求体：

```ts
{
  text: string;
  to: string[];
}
```

**服务端成功返回（示意）**

```ts
[
  {
    translations: [
      {
        text: '嗨',
        to: 'zh-Hant',
      },
    ],
    detectedLanguage: {
      language: 'en',
      score: 1,
    },
  },
];
```

或

```ts
{
  data: [...]
}
```

**SDK 归一化**

- 仅保留 `translations` 与 `detectedLanguage`
- 若结果数组为空或首项结构非法，显式抛 `RestBusinessError(303)`

---

## 6. 错误处理与兼容边界

### 6.1 当前统一规则

- 本地参数非法：
  - 统一抛 `ValidationError`
- 未登录 / token 无效：
  - 统一抛 `AuthenticationError`
- WebSocket / MSync 未连接：
  - 统一抛 `ConnectionError`
- REST 网络失败 / 超时：
  - 统一抛 `NetworkError`
- REST 业务错误：
  - 优先按 `src/rest/api-errors.json` 映射
- REST 成功但响应结构非法：
  - 当前统一抛 `RestBusinessError(303)`

### 6.2 当前不做的兼容层

- 不提供 `ChannelManager` / `Channel` 的 deprecated 别名
- 不把服务端 envelope 的 `requestStatusCode`, `action`, `timestamp`, `duration` 直接暴露给外部

---

## 7. 参考

- 快速开始：[specs/031-chat-manager-replace-channel/quickstart.md](/Users/zhangdong/code/websdk2/specs/031-chat-manager-replace-channel/quickstart.md)
- 错误码矩阵：[docs/reference/chat-manager-api-error-codes.md](/Users/zhangdong/code/websdk2/docs/reference/chat-manager-api-error-codes.md)
