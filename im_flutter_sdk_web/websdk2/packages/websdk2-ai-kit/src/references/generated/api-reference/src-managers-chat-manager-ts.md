---
id: generated/api-reference/src-managers-chat-manager-ts
title: websdk2 API Reference - ChatManager API
description: 来自 docs/reference/api-reference.zh-CN.md 的 src/managers/chat-manager.ts API Reference 分段。
---

## src/managers/chat-manager.ts

### ChatManager

### sendMessage(message: Message, options: SendMessageOptions) => Promise<Message>

#### 说明

发送一条已创建的消息。文本、图片、文件、语音、视频、位置、命令、自定义和合并消息均通过该入口发送。

事件触发：接收方（含发送方的其他设备）会收到 `onMessage` 事件。
附件类消息（图片/文件/语音/视频）会先自动上传到服务器，上传成功后再发送。

#### 调用示例

```ts
const message = chatManager.createTextMessage({
  conversationId: 'user_2',
  conversationType: 'singleChat',
  content: 'hello',
});
const sent = await chatManager.sendMessage(message);
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| message | `Message` | 待发送消息对象。 |
| options | `SendMessageOptions` | 发送过程回调。 |

#### 返回值

发送成功后的消息对象。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | 消息发送者缺失、发送者与当前用户不一致，或尝试发送当前不支持的流式消息 | 先通过 ChatManager 的 create*Message 方法创建消息，并确保当前用户与消息 sender.userId 一致 |
| 300 | not_connected | 发送消息时 SDK 未连接到消息服务器 | 等待连接成功后重试 |
| 500 | encode_failed | 消息内容无法编码为协议数据 | 检查消息体、扩展字段和附件信息是否合法 |
| 1200 | MESSAGE_BLOCKED | 第三方内容审核拒绝 | - |
| 215 | USER_MUTED | 用户被禁言 | - |

### createTextMessage(params: CreateTextMessageParams) => Message

#### 说明

创建文本消息对象。创建后需调用 {@link ChatManager.sendMessage} 发送。

#### 调用示例

```ts
const message = chatManager.createTextMessage({
  conversationId: 'user_2',
  conversationType: 'singleChat',
  content: 'hello',
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `CreateTextMessageParams` | 文本消息创建参数。 |

#### 返回值

文本消息对象。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | 会话 ID、会话类型、文本内容、扩展字段或定向接收配置非法 | 传入合法的 conversationId、conversationType 和非空 content；receiverList 与 needGroupReadReceipt 仅用于群聊 |

### createImageMessage(params: CreateImageMessageParams) => Message

#### 说明

创建图片消息对象。支持传入本地文件或远程图片地址。

#### 调用示例

```ts
const message = chatManager.createImageMessage({
  conversationId: 'group_1',
  conversationType: 'groupChat',
  data: imageFile,
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `CreateImageMessageParams` | 图片消息创建参数。 |

#### 返回值

图片消息对象。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | 会话参数非法，或图片消息缺少 data/originalUrl，或文件、宽高、文件大小字段非法 | 至少传入 data 或 originalUrl，并确保图片元数据为合法类型和值 |

### createFileMessage(params: CreateFileMessageParams) => Message

#### 说明

创建文件消息对象。支持传入本地文件或远程文件地址。

#### 调用示例

```ts
const message = chatManager.createFileMessage({
  conversationId: 'user_2',
  conversationType: 'singleChat',
  data: file,
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `CreateFileMessageParams` | 文件消息创建参数。 |

#### 返回值

文件消息对象。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | 会话参数非法，或文件消息缺少 data/originalUrl，或文件名、文件类型、文件大小字段非法 | 至少传入 data 或 originalUrl，并确保文件元数据合法 |

### createVoiceMessage(params: CreateVoiceMessageParams) => Message

#### 说明

创建语音消息对象。支持传入本地语音文件或远程语音地址。

#### 调用示例

```ts
const message = chatManager.createVoiceMessage({
  conversationId: 'user_2',
  conversationType: 'singleChat',
  data: voiceFile,
  duration: 3,
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `CreateVoiceMessageParams` | 语音消息创建参数。 |

#### 返回值

语音消息对象。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | 会话参数非法，或语音消息缺少 data/originalUrl，或 duration、文件信息非法 | 至少传入 data 或 originalUrl，并传入大于 0 的 duration |

### createVideoMessage(params: CreateVideoMessageParams) => Message

#### 说明

创建视频消息对象。支持传入本地视频文件或远程视频地址。

#### 调用示例

```ts
const message = chatManager.createVideoMessage({
  conversationId: 'group_1',
  conversationType: 'groupChat',
  data: videoFile,
  duration: 12,
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `CreateVideoMessageParams` | 视频消息创建参数。 |

#### 返回值

视频消息对象。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | 会话参数非法，或视频消息缺少 data/originalUrl，或 duration、宽高、文件信息非法 | 至少传入 data 或 originalUrl，并传入大于 0 的 duration |

### createLocationMessage(params: CreateLocationMessageParams) => Message

#### 说明

创建位置消息对象。

#### 调用示例

```ts
const message = chatManager.createLocationMessage({
  conversationId: 'user_2',
  conversationType: 'singleChat',
  latitude: 39.9042,
  longitude: 116.4074,
  address: 'Beijing',
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `CreateLocationMessageParams` | 位置消息创建参数。 |

#### 返回值

位置消息对象。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | 会话参数非法，或经纬度、地址、建筑名称字段非法 | 传入合法的 conversationId、conversationType、latitude 和 longitude |

### createCmdMessage(params: CreateCmdMessageParams) => Message

#### 说明

创建命令消息对象。命令消息通常用于业务自定义控制信令。

#### 调用示例

```ts
const message = chatManager.createCmdMessage({
  conversationId: 'user_2',
  conversationType: 'singleChat',
  action: 'typing',
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `CreateCmdMessageParams` | 命令消息创建参数。 |

#### 返回值

命令消息对象。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | 会话参数非法，或 action 为空 | 传入合法的 conversationId、conversationType 和非空 action |

### createCustomMessage(params: CreateCustomMessageParams) => Message

#### 说明

创建自定义消息对象。可通过 `event` 与 `params` 承载业务自定义内容。

#### 调用示例

```ts
const message = chatManager.createCustomMessage({
  conversationId: 'user_2',
  conversationType: 'singleChat',
  event: 'gift',
  params: { id: 'rose' },
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `CreateCustomMessageParams` | 自定义消息创建参数。 |

#### 返回值

自定义消息对象。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | 会话参数非法，或 event、params 字段非法 | 传入合法的 conversationId、conversationType 和非空 event；params 使用字符串键值 |

### createCombineMessage(params: CreateCombineMessageParams) => Message

#### 说明

创建合并消息对象，用于发送聊天记录合集。

#### 调用示例

```ts
const message = chatManager.createCombineMessage({
  conversationId: 'group_1',
  conversationType: 'groupChat',
  title: '聊天记录',
  summary: '3 条消息',
  messageList: selectedMessages,
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `CreateCombineMessageParams` | 合并消息创建参数。 |

#### 返回值

合并消息对象。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | 会话参数非法，或 title、summary、messageList 为空，或合并消息条目格式非法 | 传入合法的标题、摘要和 1 到 300 条可合并消息 |
| 4 | combine_level_exceeded | 合并消息嵌套层级超过 SDK 限制 | 减少合并消息嵌套层级后重试 |
| 500 | combine_encode_failed | 合并消息内容无法编码 | 检查被合并消息的消息体和扩展字段是否合法 |

### getConversationList(params: GetConversationListParams) => Promise<ConversationPage>

#### 说明

从本地新会话列表缓存中分页获取会话摘要。

#### 调用示例

```ts
const page = await chatManager.getConversationList({ pageSize: 20 });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `GetConversationListParams` | 会话列表分页参数。 |

#### 返回值

会话摘要分页结果。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | 分页游标、pageSize 或 includeEmptyConversations 类型非法 | 使用 SDK 上一次返回的 cursor，并确保 pageSize 为正整数、includeEmptyConversations 为布尔值 |

### getSessionList() => ReadonlyArray<SessionItem>

#### 说明

获取当前内存中的新会话列表快照。

#### 调用示例

```ts
const sessions = chatManager.getSessionList();
```

#### 返回值

会话列表快照。

### refreshSessionList(params: RefreshSessionListParams) => Promise<ReadonlyArray<SessionItem>>

#### 说明

主动向服务端刷新新会话列表，并返回刷新后的快照。

#### 调用示例

```ts
const sessions = await chatManager.refreshSessionList({ needSessionMark: true });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `RefreshSessionListParams` | 刷新会话列表的选项。 |

#### 返回值

刷新后的会话列表。

### getPinnedConversationList(params: GetConversationListParams) => Promise<ConversationPage>

#### 说明

从本地新会话列表缓存中分页获取置顶会话。

#### 调用示例

```ts
const page = await chatManager.getPinnedConversationList({ pageSize: 20 });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `GetConversationListParams` | 置顶会话列表分页参数。 |

#### 返回值

置顶会话摘要分页结果。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | 分页游标、pageSize 或 includeEmptyConversations 类型非法 | 使用 SDK 上一次返回的 cursor，并确保 pageSize 为正整数、includeEmptyConversations 为布尔值 |

### getConversationListByMark(params: GetConversationListByMarkParams) => Promise<ConversationPage>

#### 说明

从本地新会话列表缓存中按会话标记分页获取会话。

#### 调用示例

```ts
const page = await chatManager.getConversationListByMark({ mark: 0 });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `GetConversationListByMarkParams` | 会话标记与分页参数。 |

#### 返回值

匹配标记的会话摘要分页结果。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | mark 不是 0 到 19 之间的整数，或分页参数非法 | 传入 0 到 19 之间的整数 mark，并使用合法分页参数 |

### deleteConversation(params: DeleteConversationParams) => Promise<ConversationMutationResult>

#### 说明

删除指定会话，可选择同时删除服务端漫游消息。

#### 调用示例

```ts
await chatManager.deleteConversation({
  conversationId: 'user_2',
  conversationType: 'singleChat',
  deleteRoamingMessages: false,
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `DeleteConversationParams` | 删除会话参数。 |

#### 返回值

会话删除结果。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | conversationId、conversationType 或 deleteRoamingMessages 参数非法 | 传入合法会话 ID、会话类型，并确保 deleteRoamingMessages 为布尔值 |

### setConversationPinned(params: SetConversationPinnedParams) => Promise<ConversationMutationResult>

#### 说明

设置或取消设置会话置顶状态。

#### 调用示例

```ts
await chatManager.setConversationPinned({
  conversationId: 'group_1',
  conversationType: 'groupChat',
  pinned: true,
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `SetConversationPinnedParams` | 会话置顶参数。 |

#### 返回值

会话置顶变更结果。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | conversationId、conversationType 或 pinned 参数非法 | 传入合法会话 ID、会话类型，并确保 pinned 为布尔值 |

### addConversationMark(params: ConversationMarkParams) => Promise<ConversationMarkMutationResult>

#### 说明

为单个或多个会话添加标记。

#### 调用示例

```ts
await chatManager.addConversationMark({
  conversationId: 'user_2',
  conversationType: 'singleChat',
  mark: 0,
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `ConversationMarkParams` | 会话标记参数。 |

#### 返回值

会话标记添加结果。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | mark 不是 0 到 19 之间的整数，或会话目标列表非法 | 传入合法 mark，并确保 conversations 为非空数组或传入单个合法会话 |

### removeConversationMark(params: ConversationMarkParams) => Promise<ConversationMarkMutationResult>

#### 说明

从单个或多个会话移除标记。

#### 调用示例

```ts
await chatManager.removeConversationMark({
  conversations: [
    { conversationId: 'user_2', conversationType: 'singleChat' },
  ],
  mark: 0,
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `ConversationMarkParams` | 会话标记参数。 |

#### 返回值

会话标记移除结果。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | mark 不是 0 到 19 之间的整数，或会话目标列表非法 | 传入合法 mark，并确保 conversations 为非空数组或传入单个合法会话 |

### clearAllMessagesAndConversations() => Promise<void>

#### 说明

清空当前用户的所有会话和服务端漫游消息。

#### 调用示例

```ts
await chatManager.clearAllMessagesAndConversations();
```

#### 返回值

清空完成后 resolve。

### pinMessage(params: PinMessageParams) => Promise<void>

#### 说明

在指定会话中置顶一条消息。

事件触发：会话中的所有成员会收到 `onPinnedMessageChanged` 事件（operation='pin'）。

#### 调用示例

```ts
await chatManager.pinMessage({
  conversationId: 'group_1',
  conversationType: 'groupChat',
  messageId: 'msg_1',
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `PinMessageParams` | 置顶消息参数。 |

#### 返回值

置顶消息结果。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | pin_msg_id_illegal | param pin_msg_id illegal, please check it! | - |
| 4 | pin_message_limit | 置顶消息数量达到上限 | - |
| 110 | pin_message_not_found | 待置顶消息不存在 | - |

### unpinMessage(params: PinMessageParams) => Promise<void>

#### 说明

取消置顶指定会话中的一条消息。

事件触发：会话中的所有成员会收到 `onPinnedMessageChanged` 事件（operation='unpin'）。

#### 调用示例

```ts
await chatManager.unpinMessage({
  conversationId: 'group_1',
  conversationType: 'groupChat',
  messageId: 'msg_1',
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `PinMessageParams` | 取消置顶消息参数。 |

#### 返回值

取消置顶消息结果。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | pin_msg_id_illegal | param pin_msg_id illegal, please check it! | - |
| 110 | pin_message_not_found | 待取消置顶消息不存在 | - |

### getPinnedMessageList(params: GetPinnedMessageListParams) => Promise<PinnedMessageListResult>

#### 说明

获取指定会话内的置顶消息列表。该接口不分页，不接收 messageId，最多返回 20 条。

#### 调用示例

```ts
const result = await chatManager.getPinnedMessageList({
  conversationId: 'group_1',
  conversationType: 'groupChat',
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `GetPinnedMessageListParams` | 会话定位参数。 |

#### 返回值

置顶消息列表。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 111 | operation_unsupported | 当前服务端不支持获取置顶消息列表 | - |
| 110 | pin_message_not_found | 置顶消息不存在 | - |

### addEventHandler(id: EventHandlerId, handlers: ChatEventHandlerMap) => void

#### 说明

注册消息域事件处理器。

#### 调用示例

```ts
chatManager.addEventHandler('chat-page', {
  onMessage: event => {
    console.log(event.messages);
  },
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| id | `EventHandlerId` | 事件处理器唯一标识。 |
| handlers | `ChatEventHandlerMap` | 消息事件处理器集合。 |

#### 返回值

无返回值。

### removeEventHandler(id: EventHandlerId) => void

#### 说明

移除已注册的消息域事件处理器。

#### 调用示例

```ts
chatManager.removeEventHandler('chat-page');
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| id | `EventHandlerId` | 事件处理器唯一标识。 |

#### 返回值

无返回值。

### markConversationRead(params: MarkConversationReadParams) => Promise<void>

#### 说明

将指定会话标记为已读。

事件触发：对方会收到 `onConversationRead` 事件（仅单聊；群聊仅清除服务端未读数，不触发对方事件）。

#### 调用示例

```ts
await chatManager.markConversationRead({
  conversationId: 'user_2',
  conversationType: 'singleChat',
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `MarkConversationReadParams` | 会话定位参数。 |

#### 返回值

标记完成后 resolve。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | conversationId 为空或 conversationType 非法 | 传入合法会话 ID，并使用 singleChat、groupChat 或 chatRoom |
| 201 | not_login | 未登录 | - |
| 300 | not_connected | 未连接服务器 | - |
| 500 | message_invalid | 会话中无消息 | - |

### sendMessageReadAck(params: SendMessageReadAckParams) => Promise<void>

#### 说明

发送单聊消息已读回执。仅能对收到的单聊消息发送。

事件触发：消息的原始发送方会收到 `onMessageRead` 事件。

#### 调用示例

```ts
await chatManager.sendMessageReadAck({
  conversationId: 'user_2',
  messageId: 'msg_1',
  message,
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `SendMessageReadAckParams` | 单聊已读回执参数。 |

#### 返回值

发送完成后 resolve。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | messageId、conversationId 为空，或传入的消息不是收到的单聊消息 | 仅对收到的单聊消息发送已读回执，并传入合法 messageId 和 conversationId |
| 110 | invalid_direction | 只能对接收的消息发送已读回执 | - |
| 300 | not_connected | 未连接服务器 | - |

### sendGroupMessageReadAck(params: SendGroupMessageReadAckParams) => Promise<void>

#### 说明

发送群消息已读回执。仅能对收到的群聊消息发送。

事件触发：消息的原始发送方在线时会收到 `onMessageRead` 事件（isGroupAck=true）。
注意：群聊已读回执有效期为 3 天，最多支持 200 人的群。需要在控制台开通。

#### 调用示例

```ts
await chatManager.sendGroupMessageReadAck({
  groupId: 'group_1',
  messageId: 'msg_1',
  ackContent: 'read',
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `SendGroupMessageReadAckParams` | 群已读回执参数。 |

#### 返回值

发送完成后 resolve。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | messageId、groupId 为空，或传入的消息不是收到的群聊消息 | 仅对收到的群聊消息发送已读回执，并传入合法 messageId 和 groupId |
| 110 | invalid_direction | 只能对接收的消息发送已读回执 | - |
| 300 | not_connected | 未连接服务器 | - |

### recallMessage(params: RecallMessageParams) => Promise<ChatActionResult>

#### 说明

撤回一条已发送消息。

事件触发：会话中的所有成员（含撤回者的其他设备）会收到 `onMessageRecalled` 事件。
注意：默认 2 分钟内可撤回（可在控制台配置最长 7 天）；群主/管理员可撤回他人消息；除 CMD 外所有类型均支持。

#### 调用示例

```ts
const result = await chatManager.recallMessage({
  conversationId: 'user_2',
  conversationType: 'singleChat',
  messageId: 'msg_1',
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `RecallMessageParams` | 撤回消息参数。 |

#### 返回值

撤回动作结果。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | conversationId、conversationType 或 messageId 参数非法 | 传入合法会话定位参数和待撤回消息 ID |
| 110 | message_invalid | 消息无效或未发送成功 | - |
| 201 | not_login | 未登录 | - |
| 300 | not_connected | 未连接服务器 | - |
| 504 | recall_time_limit | 超过撤回时间限制 | - |
| 505 | recall_disabled | 撤回功能未开通 | - |

### modifyMessage(params: UpdateMessageParams) => Promise<Message>

#### 说明

编辑一条消息内容。当前仅支持文本消息和自定义消息。

事件触发：会话中的所有成员（含编辑者的其他设备）会收到 `onMessageUpdated` 事件。
注意：最多编辑 10 次；无时间限制；编辑后消息漫游有效期重新计算；需要在控制台开通。

#### 调用示例

```ts
const updated = await chatManager.modifyMessage({
  conversationId: 'user_2',
  conversationType: 'singleChat',
  messageId: 'msg_1',
  message: {
    type: 'text',
    body: { content: 'updated text' },
    ext: {},
  },
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `UpdateMessageParams` | 编辑消息参数。 |

#### 返回值

编辑后的消息对象。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | conversationId、conversationType 或 messageId 参数非法 | 传入合法会话定位参数和待编辑消息 ID |
| 111 | unsupported_type | 当前仅支持编辑文本消息和自定义消息 | 仅传入 type 为 text 或 custom 的消息内容 |
| 110 | message_invalid | 消息无效 | - |
| 111 | unsupported_type | 仅支持编辑文本和自定义消息 | - |
| 201 | not_login | 未登录 | - |
| 210 | permission_denied | 无权编辑该消息 | - |
| 300 | not_connected | 未连接服务器 | - |
| 511 | edit_failed | 消息编辑失败 | - |

### getHistoryMessages(params: GetHistoryMessagesParams) => Promise<MessageHistoryPage>

#### 说明

从服务端获取历史消息。

#### 调用示例

```ts
const page = await chatManager.getHistoryMessages({
  conversationId: 'group_1',
  conversationType: 'groupChat',
  pageSize: 20,
  searchDirection: 'up',
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `GetHistoryMessagesParams` | 历史消息查询参数。 |

#### 返回值

历史消息分页结果。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | conversationId、conversationType 或 pageSize 参数非法 | 传入合法会话定位参数，并确保 pageSize 为正整数 |
| 505 | service_not_enabled | this appKey not open message roaming | - |
| 110 | page_size_exceeded | 分页参数超限 | - |

### downloadAttachment(params: DownloadAttachmentParams) => Promise<MessageAttachmentDownloadResult>

#### 说明

下载消息附件，适用于图片、语音、视频和文件等附件消息。

#### 调用示例

```ts
const attachment = await chatManager.downloadAttachment({ message });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `DownloadAttachmentParams` | 附件下载参数。 |

#### 返回值

附件下载结果。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 401 | validation_invalid | 消息不包含可下载附件，或附件 URL 缺失 | 仅对包含远程附件地址的图片、语音、视频或文件消息调用 |
| 400 | not_found | 附件不存在 | - |
| 401 | invalid | 附件无效或消息类型不支持下载 | - |
| 403 | download_failed | 附件下载失败 | - |
| 407 | expired | 附件已过期 | - |

### downloadAndParseCombineMessage(params: DownloadCombineMessageInput) => Promise<ReadonlyArray<Message>>

#### 说明

下载并解析合并消息内容，返回合并消息中的子消息列表。

#### 调用示例

```ts
const messages = await chatManager.downloadAndParseCombineMessage({
  message: combineMessage,
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `DownloadCombineMessageInput` | 合并消息解析参数。 |

#### 返回值

合并消息中的子消息列表。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | 传入消息不是合并消息，或合并消息缺少下载地址 | 仅传入 type 为 combine 且包含有效 url 的消息 |
| 110 | invalid_param | 消息为空 | - |
| 500 | invalid_type | 消息不是合并消息类型 | - |
| 401 | parse_failed | 合并消息解析失败 | - |
| 403 | download_failed | 合并消息下载失败 | - |

### removeHistoryMessages(params: RemoveHistoryMessagesParams) => Promise<void>

#### 说明

删除服务端历史消息，可按消息 ID 列表或时间戳删除。

#### 调用示例

```ts
await chatManager.removeHistoryMessages({
  conversationId: 'user_2',
  conversationType: 'singleChat',
  messageIds: ['msg_1'],
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `RemoveHistoryMessagesParams` | 删除历史消息参数。 |

#### 返回值

删除完成后 resolve。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | 缺少 messageIds/beforeTimestamp，或 messageIds 为空，或 beforeTimestamp 不是正整数 | 传入非空 messageIds，或传入大于 0 的 beforeTimestamp |
| 505 | service_not_enabled | this appKey not open message roaming | - |
| 112 | query_param_reaches_limit | 删除消息数量超限 | - |

### getGroupMessageReadUsers(params: GroupMessageReadUsersParams) => Promise<GroupMessageReadUsersResult>

#### 说明

获取指定群消息的已读成员列表。

#### 调用示例

```ts
const page = await chatManager.getGroupMessageReadUsers({
  groupId: 'group_1',
  messageId: 'msg_1',
  pageSize: 20,
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `GroupMessageReadUsersParams` | 群消息已读成员查询参数。 |

#### 返回值

群消息已读成员分页结果。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | groupId、messageId 为空，或 pageSize 不是正整数 | 传入合法 groupId、messageId，并确保 pageSize 为正整数 |
| 500 | message_not_found | 消息不存在 | - |

### addReaction(params: ReactionOperationParams) => Promise<void>

#### 说明

为消息添加 Reaction。

事件触发：会话中的所有成员会收到 `onReactionChanged` 事件。
注意：仅支持单聊和群聊，不支持聊天室；每个用户对同一消息的同一 Reaction 只能添加一次。

#### 调用示例

```ts
await chatManager.addReaction({
  messageId: 'msg_1',
  reaction: '👍',
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `ReactionOperationParams` | 添加 Reaction 参数。 |

#### 返回值

添加完成后 resolve。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | messageId 或 reaction 为空 | 传入合法 messageId 和非空 reaction |
| 1301 | reaction_already_operated | the user is already operation this message | - |
| 1300 | reaction_reach_limit | The quantity has exceeded the limit! | - |
| 602 | group_not_joined | The user not in this group! | - |
| 1302 | reaction_operation_illegal | the user operation is illegal! | - |
| 505 | service_not_enabled | this appKey is not open reaction service! | - |
| 302 | server_busy | this message is creating reaction, please try again. | - |

### removeReaction(params: ReactionOperationParams) => Promise<void>

#### 说明

删除当前用户在消息上添加的 Reaction。

事件触发：会话中的所有成员会收到 `onReactionChanged` 事件。

#### 调用示例

```ts
await chatManager.removeReaction({
  messageId: 'msg_1',
  reaction: '👍',
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `ReactionOperationParams` | 删除 Reaction 参数。 |

#### 返回值

删除完成后 resolve。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | messageId 或 reaction 为空 | 传入合法 messageId 和非空 reaction |
| 505 | service_not_enabled | this appKey is not open reaction service! | - |
| 1302 | reaction_operation_illegal | the user operation is illegal! | - |

### getReactionList(params: GetReactionListParams) => Promise<ReadonlyArray<MessageReactionListItem>>

#### 说明

获取一条或多条消息的 Reaction 汇总列表。

#### 调用示例

```ts
const list = await chatManager.getReactionList({
  messageId: ['msg_1', 'msg_2'],
  conversationType: 'groupChat',
  groupId: 'group_1',
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `GetReactionListParams` | Reaction 汇总查询参数。 |

#### 返回值

消息 Reaction 汇总列表。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | messageId 为空，或群聊查询缺少 groupId | 传入合法 messageId；conversationType 为 groupChat 时同时传入 groupId |
| 505 | service_not_enabled | this appKey is not open reaction service! | - |
| 600 | group_invalid_id | groupId can not be null! | - |

### getReactionDetail(params: GetReactionDetailParams) => Promise<MessageReactionDetailPage>

#### 说明

获取指定消息 Reaction 的用户明细。

#### 调用示例

```ts
const page = await chatManager.getReactionDetail({
  messageId: 'msg_1',
  reaction: '👍',
  pageSize: 20,
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `GetReactionDetailParams` | Reaction 详情查询参数。 |

#### 返回值

Reaction 用户明细分页结果。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | messageId、reaction 为空，或 pageSize 不是正整数 | 传入合法 messageId、非空 reaction，并确保 pageSize 为正整数 |
| 505 | service_not_enabled | this appKey is not open reaction service! | - |
| 1302 | reaction_operation_illegal | the user operation is illegal! | - |

### getSupportedTranslationLanguages() => Promise<ReadonlyArray<TranslationLanguage>>

#### 说明

获取翻译服务支持的语言列表。

#### 调用示例

```ts
const languages = await chatManager.getSupportedTranslationLanguages();
```

#### 返回值

翻译支持语言列表。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 505 | service_not_enabled | 翻译服务未开通 | - |

### translateMessage(params: TranslateMessageParams) => Promise<MessageTranslationResult>

#### 说明

翻译文本消息内容到一个或多个目标语言。

#### 调用示例

```ts
const result = await chatManager.translateMessage({
  message,
  targetLanguages: ['en'],
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `TranslateMessageParams` | 消息翻译参数。 |

#### 返回值

消息翻译结果。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 1110 | validation_invalid | 消息不是文本消息、文本内容为空，或 targetLanguages 为空/包含非法语言代码 | 仅传入包含非空文本内容的文本消息，并指定至少一个合法目标语言代码 |
| 1110 | translate_text_too_long | The input text is too long. | - |
| 1110 | translate_param_invalid | The target language is not valid. | - |
| 1111 | service_not_enabled | 翻译服务未开通 | - |
| 1112 | translate_usage_limit | 翻译服务配额已达上限 | - |
| 1113 | translate_failed | 翻译服务异常 | - |

### voiceMessageToText(voiceMessageBody: VoiceMessageBody, voiceParams: VoiceParams) => Promise<VoiceToTextResult>

#### 说明

将已发送或已接收的语音消息体转为文字。

#### 调用示例

```ts
const result = await chatManager.voiceMessageToText(voiceMessage.body, {
  format: 'amr',
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| voiceMessageBody | `VoiceMessageBody` | 语音消息体。 |
| voiceParams | `VoiceParams` | 语音识别参数。 |

#### 返回值

语音转文字结果。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 407 | validation_invalid | 语音消息体格式非法、语音 URL 缺失，或语音识别参数类型非法 | 传入带有效 url 的语音消息体，并确保 format、sampleRate、bitsPerSample、channels 类型合法 |
| 410 | file_not_found | 语音消息体中没有可识别的文件 ID | 确认语音消息已成功上传且 url 有效 |
| 202 | unauthorized | 语音转文字服务鉴权失败 | 刷新 token 后重试 |
| 410 | file_not_found | 服务端找不到语音文件 | 确认语音文件已上传且未过期 |
| 407 | file_invalid | 语音文件格式或内容非法 | 更换合法语音文件后重试 |
| 408 | duration_too_long | 语音时长超过 60 秒 | 缩短语音时长后重试 |
| 411 | file_too_large | 上传语音文件超过服务端大小限制 | 压缩或缩短语音文件后重试 |
| 505 | service_not_enabled | 当前应用未开通语音转文字服务 | 开通服务后重试 |
| 4 | service_limit_exceeded | 语音转文字服务用量达到限制 | 稍后重试或提升服务配额 |
| 409 | voice_to_text_failed | 语音转文字服务处理失败 | 稍后重试；如果持续失败，联系服务端排查 |

### voiceFileToText(file: VoiceSourceFile, voiceParams: VoiceParams) => Promise<VoiceToTextResult>

#### 说明

上传本地语音文件并转换为文字。

#### 调用示例

```ts
const result = await chatManager.voiceFileToText(file, {
  format: 'amr',
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| file | `VoiceSourceFile` | 本地语音文件。 |
| voiceParams | `VoiceParams` | 语音识别参数。 |

#### 返回值

语音转文字结果。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 407 | validation_invalid | 本地文件对象非法，或语音识别参数类型非法 | 传入浏览器 File 或小程序 MiniAppFile，并确保语音识别参数类型合法 |
| 110 | upload_required | 当前平台缺少上传能力 | 在支持上传的环境中调用，或为当前平台配置上传适配器 |
| 202 | unauthorized | 语音转文字服务鉴权失败 | 刷新 token 后重试 |
| 402 | upload_failed | 语音文件上传失败 | 检查网络和文件后重试 |
| 407 | file_invalid | 语音文件格式或内容非法 | 更换合法语音文件后重试 |
| 408 | duration_too_long | 语音时长超过 60 秒 | 缩短语音时长后重试 |
| 411 | file_too_large | 上传语音文件超过服务端大小限制 | 压缩或缩短语音文件后重试 |
| 505 | service_not_enabled | 当前应用未开通语音转文字服务 | 开通服务后重试 |
| 4 | service_limit_exceeded | 语音转文字服务用量达到限制 | 稍后重试或提升服务配额 |
| 409 | voice_to_text_failed | 语音转文字服务处理失败 | 稍后重试；如果持续失败，联系服务端排查 |
