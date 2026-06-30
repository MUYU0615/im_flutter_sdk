---
id: generated/api-reference/src-types-chat-thread-ts
title: websdk2 API Reference - src/types/chat-thread.ts
description: 来自 docs/reference/api-reference.zh-CN.md 的 src/types/chat-thread.ts API Reference 分段。
---

## src/types/chat-thread.ts

### CreateChatThreadParams

#### 说明

创建 ChatThread 的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| parentId | `string` | 子区所属群组 ID。 |
| name | `string` | 子区名称。 |
| messageId | `string` | 父消息 ID。 |

### CreateChatThreadResult

#### 说明

创建 ChatThread 的结果。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatThreadId | `string` | 新建子区 ID。 |

### GetChatThreadListParams

#### 说明

查询指定群组内 ChatThread 列表的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| parentId | `string` | 子区所属群组 ID。 |
| pageSize | `number` | 每页数量，默认 20，范围 1-50。 |
| cursor | `string` | 分页游标。 |

### GetJoinedChatThreadListParams

#### 说明

查询当前用户已加入 ChatThread 列表的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| parentId | `string` | 可选的父级群组 ID。 |
| pageSize | `number` | 每页数量，默认 20，范围 1-50。 |
| cursor | `string` | 分页游标。 |

### GetChatThreadInfoParams

#### 说明

查询 ChatThread 详情的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatThreadId | `string` | 子区 ID。 |

### GetChatThreadMemberListParams

#### 说明

查询 ChatThread 成员列表的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatThreadId | `string` | 子区 ID。 |
| pageSize | `number` | 每页数量，默认 20，范围 1-50。 |
| cursor | `string` | 分页游标。 |

### GetChatThreadLastMessageListParams

#### 说明

批量查询 ChatThread 最后一条消息的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatThreadIds | `ReadonlyArray<string>` | 子区 ID 列表，最多 20 个。 |

### ChatThreadMutationTarget

#### 说明

ChatThread 生命周期操作的目标。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatThreadId | `string` | 子区 ID。 |

### UpdateChatThreadNameParams

#### 说明

更新 ChatThread 名称的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| name | `string` | 新子区名称。 |

### RemoveChatThreadMemberParams

#### 说明

移除 ChatThread 成员的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| memberId | `string` | 要移除的成员用户 ID。 |

### ChatThreadSummary

#### 说明

ChatThread 摘要信息。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatThreadId | `string` | 子区 ID。 |
| parentId | `string` | 子区所属群组 ID。 |
| name | `string` | 子区名称。 |
| ownerId | `string` | 子区所有者用户 ID。 |
| memberCount | `number` | 子区成员数。 |
| messageCount | `number` | 子区消息数。 |
| messageId | `string` | 子区父消息 ID。 |
| lastMessage | `MessageSnippet | null` | 子区最后一条消息摘要。 |
| createdAt | `number` | 子区创建时间戳。 |

### ChatThreadListResult

#### 说明

ChatThread 列表结果。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| items | `ReadonlyArray<ChatThreadSummary>` | 当前页子区列表。 |
| cursor | `string` | 下一页游标，空字符串表示没有更多或未知。 |

### ChatThreadMemberEntry

#### 说明

ChatThread 成员条目。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| memberId | `string` | 成员用户 ID。 |
| joinedAt | `number` | 成员加入时间戳。 |

### ChatThreadMemberListResult

#### 说明

ChatThread 成员列表结果。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| items | `ReadonlyArray<ChatThreadMemberEntry>` | 当前页成员列表。 |
| cursor | `string` | 下一页游标。 |

### ChatThreadLastMessageEntry

#### 说明

ChatThread 最后一条消息条目。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatThreadId | `string` | 子区 ID。 |
| lastMessage | `MessageSnippet | null` | 最后一条消息摘要；没有可用消息时为 null。 |

### ChatThreadLastMessageListResult

#### 说明

ChatThread 最后一条消息批量查询结果。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| items | `ReadonlyArray<ChatThreadLastMessageEntry>` | 最后一条消息结果列表。 |

### ChatThreadBaseEventPayload

#### 说明

ChatThread 公开事件的基础载荷。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatThreadId | `string` | 子区 ID。 |
| parentId | `string` | 子区所属群组 ID。 |
| operatorId | `string` | 操作者用户 ID。 |
| timestamp | `number` | 事件时间戳。 |

### ChatThreadCreatedEventPayload

#### 说明

ChatThread 创建事件载荷。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatThreadName | `string` | 子区名称。 |
| messageId | `string` | 父消息 ID。 |
| thread | `ChatThreadSummary` | 归一化后的子区摘要。 |

### ChatThreadDestroyedEventPayload

#### 说明

ChatThread 解散事件载荷。

### ChatThreadUpdatedEventPayload

#### 说明

ChatThread 更新事件载荷。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatThreadName | `string` | 子区名称。 |
| messageId | `string` | 父消息 ID。 |
| messageCount | `number` | 子区消息数。 |
| lastMessage | `MessageSnippet | null` | 子区最后一条消息摘要。 |
| thread | `ChatThreadSummary` | 归一化后的子区摘要。 |

### ChatThreadUserRemovedEventPayload

#### 说明

当前登录用户被移出 ChatThread 的事件载荷。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| memberId | `string` | 被移出的成员用户 ID。 |

### ChatThreadEventHandlerMap

#### 说明

ChatThread 公开事件处理器映射。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| onChatThreadCreated | `(
    event: ChatThreadCreatedEventPayload
  ) => void | Promise<void>` | - |
| onChatThreadDestroyed | `(
    event: ChatThreadDestroyedEventPayload
  ) => void | Promise<void>` | - |
| onChatThreadUpdated | `(
    event: ChatThreadUpdatedEventPayload
  ) => void | Promise<void>` | - |
| onChatThreadUserRemoved | `(
    event: ChatThreadUserRemovedEventPayload
  ) => void | Promise<void>` | - |
