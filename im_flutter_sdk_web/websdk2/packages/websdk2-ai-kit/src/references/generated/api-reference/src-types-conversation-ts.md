---
id: generated/api-reference/src-types-conversation-ts
title: websdk2 API Reference - 会话类型
description: 来自 docs/reference/api-reference.zh-CN.md 的 src/types/conversation.ts API Reference 分段。
---

## src/types/conversation.ts

### ConversationIdentifier

#### 说明

会话唯一标识。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| conversationId | `string` | 会话 ID；单聊为用户 ID，群聊为 groupId，聊天室为 chatroomId。 |
| conversationType | `ConversationType` | 会话类型。 |

### ConversationItem

#### 说明

公开会话摘要，来源于本地新会话列表投影。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| lastMessage | `{
    readonly msgId: string;
    readonly type: string;
    readonly body: Record<string, unknown>;
    readonly timestamp: number;
  } | null` | 最后一条消息摘要。 |
| unreadCount | `number` | 未读消息数。 |
| isPinned | `boolean` | 是否置顶。 |
| pinnedTime | `number` | 置顶时间戳，单位毫秒。 |
| marks | `ReadonlyArray<ConversationMark>` | 会话标记列表。 |
| lastAccess | `number` | 最近访问时间戳。 |
| lastUpdate | `number` | 最近更新时间戳。 |

### ConversationPage

#### 说明

会话分页结果。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| items | `ReadonlyArray<ConversationItem>` | 当前页会话列表。 |
| cursor | `string` | 下一页游标；空字符串表示没有更多数据。 |
| hasMore | `boolean` | 是否还有更多数据。 |

### GetConversationListParams

#### 说明

获取会话列表的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| pageSize | `number` | 每页数量。 |
| cursor | `string` | 分页游标。 |
| includeEmptyConversations | `boolean` | 是否包含空会话。 |

### GetConversationListByMarkParams

#### 说明

按会话标记获取会话列表的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| mark | `ConversationMark` | 会话标记槽位，取值 0 到 19。 |

### DeleteConversationParams

#### 说明

删除会话的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| deleteRoamingMessages | `boolean` | 是否同时删除服务端漫游消息。 |

### SetConversationPinnedParams

#### 说明

设置会话置顶的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| pinned | `boolean` | `true` 表示置顶，`false` 表示取消置顶。 |

### ConversationMarkMutationItem

#### 说明

单个会话标记变更结果。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| reason | `string` | 操作失败原因；成功项不包含该字段。 |

### ConversationMarkMutationResult

#### 说明

会话标记变更结果。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| succeeded | `ReadonlyArray<ConversationMarkMutationItem>` | 成功应用本次标记变更的会话。 |
| failed | `ReadonlyArray<ConversationMarkMutationItem>` | 未能应用本次标记变更的会话。 |
| mark | `ConversationMark` | 本次操作的标记槽位。 |
| operation | `'addMark' | 'removeMark'` | 标记操作类型。 |

### PinMessageParams

#### 说明

置顶或取消置顶消息的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| messageId | `string` | 消息 ID。 |

### ConversationMutationResult

#### 说明

会话变更结果。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| conversationId | `string` | 会话 ID。 |
| conversationType | `ConversationType` | 会话类型。 |
| operation | `'delete' | 'setPinned'` | 操作类型。 |
| isPinned | `boolean` | 会话是否置顶。 |
| pinnedTime | `number` | 置顶时间戳，单位毫秒。 |

### MessagePinMutationResult

#### 说明

置顶或取消置顶消息的结果。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| conversationId | `string` | 会话 ID。 |
| conversationType | `ConversationType` | 会话类型。 |
| messageId | `string` | 消息 ID。 |
| operation | `'pin' | 'unpin'` | 操作类型。 |

### PinnedMessageSummary

#### 说明

置顶消息摘要。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| messageId | `string` | 消息 ID。 |
| conversationId | `string` | 会话 ID。 |
| conversationType | `ConversationType` | 会话类型。 |
| operatorId | `string` | 置顶操作者用户 ID。 |
| pinnedAt | `number` | 置顶时间戳，单位毫秒。 |

### PinnedMessageListResult

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| items | `ReadonlyArray<PinnedMessageSummary>` | 会话内置顶消息摘要列表，最多 20 条。 |

### RefreshSessionListParams

#### 说明

主动刷新新会话列表时的请求参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| needEmptySession | `boolean` | 是否需要返回空会话。 |
| needSessionMark | `boolean` | 是否需要返回会话标记。 |

### SessionDisplayProjection

#### 说明

SessionItem 统一展示投影。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| displayName | `string` | 会话展示名称。 |
| avatarUrl | `string` | 会话头像地址。 |
| remark | `string` | 联系人备注。 |
| source | `SessionDisplaySource` | 展示信息来源。 |

### SessionMessageSnippet

#### 说明

会话列表最小消息摘要。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| messageId | `string` | 消息 ID。 |
| type | `string` | 消息类型。 |
| from | `string` | 发送者用户 ID。 |
| timestamp | `number` | 消息时间戳，单位毫秒。 |
| body | `Record<string, unknown>` | 消息体摘要。 |

### SessionItem

#### 说明

新会话列表公开业务对象。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| sessionId | `string` | 会话 ID。 |
| type | `ConversationType` | 会话类型。 |
| unreadCount | `number` | 未读消息数。 |
| lastMessage | `SessionMessageSnippet | null` | 最后一条消息摘要。 |
| lastMessageAt | `number` | 最后一条消息时间戳，单位毫秒。 |
| isPinned | `boolean` | 是否置顶。 |
| pinnedTime | `number` | 置顶时间戳，单位毫秒。 |
| marks | `ReadonlyArray<ConversationMark>` | 会话标记列表。 |
| readReceipt | `number` | 已读位置或已读时间戳。 |
| remindType | `SessionListRemindType` | 会话提醒类型。 |
| display | `SessionDisplayProjection` | 会话展示信息。 |
