---
id: generated/api-reference/src-types-chat-manager-ts
title: websdk2 API Reference - ChatManager 类型
description: 来自 docs/reference/api-reference.zh-CN.md 的 src/types/chat-manager.ts API Reference 分段。
---

## src/types/chat-manager.ts

### SendMessageReadAckParams

#### 说明

发送单聊消息已读回执的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| messageId | `string` | 已读消息 ID。 |
| conversationId | `string` | 单聊对端用户 ID。 |
| message | `Message` | 可选消息对象；传入时 SDK 会校验必须是收到的单聊消息。 |

### SendGroupMessageReadAckParams

#### 说明

发送群消息已读回执的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| messageId | `string` | 已读消息 ID。 |
| groupId | `string` | 群组 ID。 |
| ackContent | `string` | 自定义回执内容。 |
| message | `Message` | 可选消息对象；传入时 SDK 会校验必须是收到的群聊消息。 |

### RecallMessageParams

#### 说明

撤回消息的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| messageId | `string` | 待撤回消息 ID。 |
| ext | `Record<string, unknown>` | 撤回操作扩展字段。 |

### UpdateMessageParams

#### 说明

编辑消息的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| messageId | `string` | 待编辑消息 ID。 |
| message | `Pick<Message, 'type' | 'body' | 'ext'>` | 新消息内容；当前仅支持文本和自定义消息。 |

### RemoveHistoryMessagesParams

#### 说明

删除历史消息的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| messageIds | `ReadonlyArray<string>` | 指定删除的消息 ID 列表。 |
| beforeTimestamp | `number` | 删除该时间戳之前的历史消息，单位毫秒。 |

### GetHistoryMessagesParams

#### 说明

获取历史消息的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| cursor | `string` | 分页游标；首次请求可不传。 |
| pageSize | `number` | 每页消息数量。 |
| searchDirection | `'up' | 'down'` | 拉取方向，`up` 表示更早消息，`down` 表示更新消息。 |
| senderIds | `ReadonlyArray<string>` | 群聊场景下按发送者过滤。 |
| messageTypes | `ReadonlyArray<Message['type']>` | 按消息类型过滤。 |
| startTime | `number` | 查询起始时间戳，单位毫秒。 |
| endTime | `number` | 查询结束时间戳，单位毫秒。 |

### MessageHistoryPage

#### 说明

历史消息分页结果。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| items | `ReadonlyArray<Message>` | 当前页消息列表。 |
| cursor | `string` | 下一页游标；为空表示没有后续游标。 |
| hasMore | `boolean` | 是否还有更多历史消息。 |

### DownloadAttachmentParams

#### 说明

下载消息附件的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| message | `Message` | 需要下载附件的消息，通常为图片、语音、视频或文件消息。 |

### MessageAttachmentDownloadResult

#### 说明

消息附件下载结果。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| filename | `string` | 附件文件名。 |
| mimeType | `string` | 附件 MIME 类型。 |
| size | `number` | 附件大小，单位字节。 |
| data | `Uint8Array` | 附件二进制数据。 |
| downloadUrl | `string` | 实际下载地址。 |

### DownloadCombineMessageInput

#### 说明

下载并解析合并消息的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| message | `Message` | 合并消息对象。 |

### GroupMessageReadUsersParams

#### 说明

查询群消息已读成员的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | 群组 ID。 |
| messageId | `string` | 群消息 ID。 |
| cursor | `string` | 分页游标。 |
| pageSize | `number` | 每页成员数量。 |

### GroupMessageReadUser

#### 说明

群消息已读成员条目。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userId | `string` | 用户 ID。 |
| user | `UserInfo` | 用户资料摘要。 |
| ackId | `string` | 服务端回执 ID。 |
| timestamp | `number` | 已读时间戳，单位毫秒。 |
| ackContent | `string` | 自定义回执内容。 |

### GroupMessageReadUsersResult

#### 说明

群消息已读成员分页结果。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | 群组 ID。 |
| messageId | `string` | 群消息 ID。 |
| users | `ReadonlyArray<GroupMessageReadUser>` | 当前页已读成员列表。 |
| count | `number` | 已读成员总数。 |
| cursor | `string` | 下一页游标。 |
| hasMore | `boolean` | 是否还有更多成员。 |

### ReactionOperationParams

#### 说明

添加或删除消息 Reaction 的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| messageId | `string` | 消息 ID。 |
| reaction | `string` | Reaction 内容，例如表情或业务标识。 |

### GetReactionListParams

#### 说明

获取消息 Reaction 列表的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| messageId | `string | ReadonlyArray<string>` | 单个消息 ID 或消息 ID 列表。 |
| conversationType | `Extract<ChatConversationType, 'singleChat' | 'groupChat'>` | 会话类型；当前支持单聊和群聊。 |
| groupId | `string` | 群聊时必填的群组 ID。 |

### MessageReactionSummary

#### 说明

单个 Reaction 汇总信息。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| reaction | `string` | Reaction 内容。 |
| count | `number` | 添加该 Reaction 的用户数量。 |
| isAddedBySelf | `boolean` | 当前用户是否已添加该 Reaction。 |
| userIds | `ReadonlyArray<string>` | 添加该 Reaction 的用户 ID 列表。 |

### MessageReactionListItem

#### 说明

单条消息的 Reaction 汇总。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| messageId | `string` | 消息 ID。 |
| reactions | `ReadonlyArray<MessageReactionSummary>` | 该消息上的 Reaction 汇总列表。 |

### GetReactionDetailParams

#### 说明

获取 Reaction 详情的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| cursor | `string` | 分页游标。 |
| pageSize | `number` | 每页用户数量。 |

### ReactionUser

#### 说明

Reaction 用户明细条目。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userId | `string` | 用户 ID。 |
| user | `UserInfo` | 用户资料摘要。 |
| createdAt | `string` | 添加 Reaction 的时间。 |

### MessageReactionDetailPage

#### 说明

Reaction 详情分页结果。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| reaction | `string` | Reaction 内容。 |
| count | `number` | 添加该 Reaction 的用户数量。 |
| isAddedBySelf | `boolean` | 当前用户是否已添加该 Reaction。 |
| reactionUsers | `ReadonlyArray<ReactionUser>` | 添加该 Reaction 的用户明细列表。 |
| cursor | `string` | 下一页游标。 |
| hasMore | `boolean` | 是否还有更多用户。 |
| createdAt | `string` | Reaction 创建时间。 |

### TranslationLanguage

#### 说明

翻译服务支持的语言。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| code | `string` | 语言代码。 |
| name | `string` | 语言英文名或服务端返回名称。 |
| nativeName | `string` | 语言本地名称。 |

### TranslateMessageParams

#### 说明

翻译消息的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| message | `Message` | 待翻译文本消息。 |
| targetLanguages | `ReadonlyArray<string>` | 目标语言代码列表。 |

### VoiceParams

#### 说明

语音转文字可选参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| format | `string` | 语音格式，例如 `amr`、`mp3`、`pcm`。 |
| sampleRate | `number` | 采样率。 |
| bitsPerSample | `number` | 位深。 |
| channels | `number` | 声道数。 |

### VoiceToTextResult

#### 说明

语音转文字业务结果。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| text | `string` | 转写得到的文本。 |

### MessageTranslation

#### 说明

单条翻译结果。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| text | `string` | 翻译后的文本。 |
| to | `string` | 目标语言代码。 |

### MessageTranslationResult

#### 说明

消息翻译结果。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| detectedLanguage | `{
    /** [zh-CN] 源语言代码。 [en-US] Source language code. */
    language: string;
    /** [zh-CN] 识别置信度。 [en-US] Detection confidence score. */
    score: number;
  }` | 服务端识别出的源语言。 |
| translations | `ReadonlyArray<MessageTranslation>` | 翻译结果列表。 |

### MessageReadEventPayload

#### 说明

消息已读回执事件载荷。

触发时机：对方发送单聊消息已读回执，或群成员发送群消息已读回执。
接收方：消息的原始发送方。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| messageId | `string` | 被标记已读的消息 ID。 |
| isGroupAck | `boolean` | 是否为群消息已读回执。 |
| ackContent | `string` | 群已读回执附带的内容。 |

### ConversationReadEventPayload

#### 说明

会话已读回执事件载荷。

触发时机：对方调用 `markConversationRead` 标记整个会话为已读。
接收方：单聊对方（仅单聊触发此事件；群聊标记已读仅清除服务端未读数，不触发此事件）。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| timestamp | `number` | 标记已读的时间戳。 |

### MessageRecalledEventPayload

#### 说明

消息撤回事件载荷。

触发时机：发送方撤回消息，或群主/管理员撤回群内他人消息。
接收方：会话中的所有成员（含撤回者的其他设备）。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| messageId | `string` | 被撤回的消息 ID。 |
| timestamp | `number` | 撤回时间戳。 |

### MessageUpdatedEventPayload

#### 说明

消息编辑事件载荷。

触发时机：发送方编辑已发送的消息。
接收方：会话中的所有成员（含编辑者的其他设备）。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| messageId | `string` | 被编辑的消息 ID。 |
| message | `Pick<Message, 'type' | 'body' | 'ext'>` | 编辑后的消息内容。 |
| timestamp | `number` | 编辑时间戳。 |

### ReactionChangedEventPayload

#### 说明

Reaction 变更事件载荷。

触发时机：会话中有成员对消息添加或移除 Reaction。
接收方：会话中的所有成员。
注意：仅支持单聊和群聊，不支持聊天室。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| messageId | `string` | 消息 ID。 |
| reaction | `string` | Reaction 表情。 |
| operation | `'add' | 'remove'` | 操作类型。 |

### PinnedMessageChangedEventPayload

#### 说明

消息置顶变更事件载荷。

触发时机：会话中有成员置顶或取消置顶消息。
接收方：会话中的所有成员。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| messageId | `string` | 消息 ID。 |
| operation | `'pin' | 'unpin'` | 操作类型。 |
| pinTime | `number` | 置顶时间戳。 |
| operatorId | `string` | 操作者用户 ID。 |

### ChatActionResult

#### 说明

消息动作结果，适用于撤回等基于动作通道完成的操作。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| messageId | `string` | 消息 ID。 |
| conversationId | `string` | 会话 ID。 |
| conversationType | `ChatConversationType` | 会话类型。 |
| timestamp | `number` | 动作完成时间戳，单位毫秒。 |

### SessionListSyncFinishPayload

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| error | `SDKError` | - |

### ChatMessageAction

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| kind | `'conversationRead' | 'messageRead' | 'groupMessageRead' | 'recall' | 'update'` | - |
| conversationId | `string` | - |
| conversationType | `ChatConversationType` | - |
| messageId | `string` | - |
| ackContent | `string` | - |
| body | `MessageBody` | - |
| type | `Message['type']` | - |
| ext | `Record<string, unknown>` | - |
