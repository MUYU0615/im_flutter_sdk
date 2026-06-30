import type { MessageSnippet } from '../cache/cache-types';

/**
 * [zh-CN] 创建 ChatThread 的参数。
 * [en-US] Parameters for creating a chat thread.
 */
export interface CreateChatThreadParams {
  /** [zh-CN] 子区所属群组 ID。 [en-US] Parent group ID. */
  readonly parentId: string;
  /** [zh-CN] 子区名称。 [en-US] Chat thread name. */
  readonly name: string;
  /** [zh-CN] 父消息 ID。 [en-US] Parent message ID. */
  readonly messageId: string;
}

/**
 * [zh-CN] 创建 ChatThread 的结果。
 * [en-US] Result returned after creating a chat thread.
 */
export interface CreateChatThreadResult {
  /** [zh-CN] 新建子区 ID。 [en-US] Created chat thread ID. */
  readonly chatThreadId: string;
}

/**
 * [zh-CN] 查询指定群组内 ChatThread 列表的参数。
 * [en-US] Parameters for listing chat threads in a group.
 */
export interface GetChatThreadListParams {
  /** [zh-CN] 子区所属群组 ID。 [en-US] Parent group ID. */
  readonly parentId: string;
  /** [zh-CN] 每页数量，默认 20，范围 1-50。 [en-US] Page size, defaults to 20, range 1-50. */
  readonly pageSize?: number;
  /** [zh-CN] 分页游标。 [en-US] Pagination cursor. */
  readonly cursor?: string;
}

/**
 * [zh-CN] 查询当前用户已加入 ChatThread 列表的参数。
 * [en-US] Parameters for listing chat threads joined by the current user.
 */
export interface GetJoinedChatThreadListParams {
  /** [zh-CN] 可选的父级群组 ID。 [en-US] Optional parent group ID. */
  readonly parentId?: string;
  /** [zh-CN] 每页数量，默认 20，范围 1-50。 [en-US] Page size, defaults to 20, range 1-50. */
  readonly pageSize?: number;
  /** [zh-CN] 分页游标。 [en-US] Pagination cursor. */
  readonly cursor?: string;
}

/**
 * [zh-CN] 查询 ChatThread 详情的参数。
 * [en-US] Parameters for getting chat thread details.
 */
export interface GetChatThreadInfoParams {
  /** [zh-CN] 子区 ID。 [en-US] Chat thread ID. */
  readonly chatThreadId: string;
}

/**
 * [zh-CN] 查询 ChatThread 成员列表的参数。
 * [en-US] Parameters for listing chat thread members.
 */
export interface GetChatThreadMemberListParams {
  /** [zh-CN] 子区 ID。 [en-US] Chat thread ID. */
  readonly chatThreadId: string;
  /** [zh-CN] 每页数量，默认 20，范围 1-50。 [en-US] Page size, defaults to 20, range 1-50. */
  readonly pageSize?: number;
  /** [zh-CN] 分页游标。 [en-US] Pagination cursor. */
  readonly cursor?: string;
}

/**
 * [zh-CN] 批量查询 ChatThread 最后一条消息的参数。
 * [en-US] Parameters for getting the last messages of chat threads in batch.
 */
export interface GetChatThreadLastMessageListParams {
  /** [zh-CN] 子区 ID 列表，最多 20 个。 [en-US] Chat thread ID list, up to 20 items. */
  readonly chatThreadIds: ReadonlyArray<string>;
}

/**
 * [zh-CN] ChatThread 生命周期操作的目标。
 * [en-US] Target for chat thread lifecycle operations.
 */
export interface ChatThreadMutationTarget {
  /** [zh-CN] 子区 ID。 [en-US] Chat thread ID. */
  readonly chatThreadId: string;
}

/**
 * [zh-CN] 更新 ChatThread 名称的参数。
 * [en-US] Parameters for updating a chat thread name.
 */
export interface UpdateChatThreadNameParams extends ChatThreadMutationTarget {
  /** [zh-CN] 新子区名称。 [en-US] New chat thread name. */
  readonly name: string;
}

/**
 * [zh-CN] 移除 ChatThread 成员的参数。
 * [en-US] Parameters for removing a member from a chat thread.
 */
export interface RemoveChatThreadMemberParams extends ChatThreadMutationTarget {
  /** [zh-CN] 要移除的成员用户 ID。 [en-US] User ID of the member to remove. */
  readonly memberId: string;
}

/**
 * [zh-CN] ChatThread 摘要信息。
 * [en-US] Chat thread summary.
 */
export interface ChatThreadSummary {
  /** [zh-CN] 子区 ID。 [en-US] Chat thread ID. */
  readonly chatThreadId: string;
  /** [zh-CN] 子区所属群组 ID。 [en-US] Parent group ID. */
  readonly parentId: string;
  /** [zh-CN] 子区名称。 [en-US] Chat thread name. */
  readonly name: string;
  /** [zh-CN] 子区所有者用户 ID。 [en-US] Chat thread owner user ID. */
  readonly ownerId?: string;
  /** [zh-CN] 子区成员数。 [en-US] Chat thread member count. */
  readonly memberCount?: number;
  /** [zh-CN] 子区消息数。 [en-US] Chat thread message count. */
  readonly messageCount?: number;
  /** [zh-CN] 子区父消息 ID。 [en-US] Parent message ID of the chat thread. */
  readonly messageId?: string;
  /** [zh-CN] 子区最后一条消息摘要。 [en-US] Last message snippet in the chat thread. */
  readonly lastMessage?: MessageSnippet | null;
  /** [zh-CN] 子区创建时间戳。 [en-US] Chat thread creation timestamp. */
  readonly createdAt?: number;
}

/**
 * [zh-CN] ChatThread 详情。
 * [en-US] Chat thread detail.
 */
export type ChatThreadDetail = ChatThreadSummary;

/**
 * [zh-CN] ChatThread 列表结果。
 * [en-US] Chat thread list result.
 */
export interface ChatThreadListResult {
  /** [zh-CN] 当前页子区列表。 [en-US] Chat threads in the current page. */
  readonly items: ReadonlyArray<ChatThreadSummary>;
  /** [zh-CN] 下一页游标，空字符串表示没有更多或未知。 [en-US] Next cursor, empty when no more or unknown. */
  readonly cursor: string;
}

/**
 * [zh-CN] ChatThread 成员条目。
 * [en-US] Chat thread member entry.
 */
export interface ChatThreadMemberEntry {
  /** [zh-CN] 成员用户 ID。 [en-US] Member user ID. */
  readonly memberId: string;
  /** [zh-CN] 成员加入时间戳。 [en-US] Timestamp when the member joined. */
  readonly joinedAt?: number;
}

/**
 * [zh-CN] ChatThread 成员列表结果。
 * [en-US] Chat thread member list result.
 */
export interface ChatThreadMemberListResult {
  /** [zh-CN] 当前页成员列表。 [en-US] Members in the current page. */
  readonly items: ReadonlyArray<ChatThreadMemberEntry>;
  /** [zh-CN] 下一页游标。 [en-US] Next cursor. */
  readonly cursor: string;
}

/**
 * [zh-CN] ChatThread 最后一条消息条目。
 * [en-US] Last message entry for a chat thread.
 */
export interface ChatThreadLastMessageEntry {
  /** [zh-CN] 子区 ID。 [en-US] Chat thread ID. */
  readonly chatThreadId: string;
  /** [zh-CN] 最后一条消息摘要；没有可用消息时为 null。 [en-US] Last message snippet, or null when unavailable. */
  readonly lastMessage: MessageSnippet | null;
}

/**
 * [zh-CN] ChatThread 最后一条消息批量查询结果。
 * [en-US] Batch result for chat thread last messages.
 */
export interface ChatThreadLastMessageListResult {
  /** [zh-CN] 最后一条消息结果列表。 [en-US] Last message entries. */
  readonly items: ReadonlyArray<ChatThreadLastMessageEntry>;
}

/**
 * [zh-CN] ChatThread 公开事件的基础载荷。
 * [en-US] Base payload shared by public chat thread events.
 */
export interface ChatThreadBaseEventPayload {
  /** [zh-CN] 子区 ID。 [en-US] Chat thread ID. */
  readonly chatThreadId: string;
  /** [zh-CN] 子区所属群组 ID。 [en-US] Parent group ID. */
  readonly parentId: string;
  /** [zh-CN] 操作者用户 ID。 [en-US] Operator user ID. */
  readonly operatorId?: string;
  /** [zh-CN] 事件时间戳。 [en-US] Event timestamp. */
  readonly timestamp: number;
}

/**
 * [zh-CN] ChatThread 创建事件载荷。
 * [en-US] Payload for a chat thread created event.
 */
export interface ChatThreadCreatedEventPayload extends ChatThreadBaseEventPayload {
  /** [zh-CN] 子区名称。 [en-US] Chat thread name. */
  readonly chatThreadName?: string;
  /** [zh-CN] 父消息 ID。 [en-US] Parent message ID. */
  readonly messageId?: string;
  /** [zh-CN] 归一化后的子区摘要。 [en-US] Normalized chat thread summary. */
  readonly thread?: ChatThreadSummary;
}

/**
 * [zh-CN] ChatThread 解散事件载荷。
 * [en-US] Payload for a chat thread destroyed event.
 */
export type ChatThreadDestroyedEventPayload = ChatThreadBaseEventPayload;

/**
 * [zh-CN] ChatThread 更新事件载荷。
 * [en-US] Payload for a chat thread updated event.
 */
export interface ChatThreadUpdatedEventPayload extends ChatThreadBaseEventPayload {
  /** [zh-CN] 子区名称。 [en-US] Chat thread name. */
  readonly chatThreadName?: string;
  /** [zh-CN] 父消息 ID。 [en-US] Parent message ID. */
  readonly messageId?: string;
  /** [zh-CN] 子区消息数。 [en-US] Chat thread message count. */
  readonly messageCount?: number;
  /** [zh-CN] 子区最后一条消息摘要。 [en-US] Last message snippet in the chat thread. */
  readonly lastMessage?: MessageSnippet | null;
  /** [zh-CN] 归一化后的子区摘要。 [en-US] Normalized chat thread summary. */
  readonly thread?: ChatThreadSummary;
}

/**
 * [zh-CN] 当前登录用户被移出 ChatThread 的事件载荷。
 * [en-US] Payload for the current user being removed from a chat thread.
 */
export interface ChatThreadUserRemovedEventPayload extends ChatThreadBaseEventPayload {
  /** [zh-CN] 被移出的成员用户 ID。 [en-US] Removed member user ID. */
  readonly memberId?: string;
}

/**
 * [zh-CN] ChatThread 公开事件处理器映射。
 * [en-US] Public chat thread event handler map.
 */
export interface ChatThreadEventHandlerMap {
  readonly onChatThreadCreated?: (
    event: ChatThreadCreatedEventPayload
  ) => void | Promise<void>;
  readonly onChatThreadDestroyed?: (
    event: ChatThreadDestroyedEventPayload
  ) => void | Promise<void>;
  readonly onChatThreadUpdated?: (
    event: ChatThreadUpdatedEventPayload
  ) => void | Promise<void>;
  readonly onChatThreadUserRemoved?: (
    event: ChatThreadUserRemovedEventPayload
  ) => void | Promise<void>;
}

/** @internal thread 原始通知类型。 */
export type ChatThreadRawNotifyOperation =
  | 'create'
  | 'update'
  | 'update_msg'
  | 'delete'
  | 'join'
  | 'leave'
  | 'kick';

/** @internal thread 原始通知载荷。 */
export interface ChatThreadRawNotifyPayload {
  readonly id: string;
  readonly name?: string;
  readonly muc_parent_id: string;
  readonly msg_parent_id?: string;
  readonly timestamp?: number;
  readonly from?: string;
  readonly userIds?: ReadonlyArray<string>;
  readonly operation: ChatThreadRawNotifyOperation;
  readonly last_message?: Record<string, unknown>;
  readonly message_count?: number;
}

/** @internal thread 原始通知事件。 */
export interface ChatThreadRawNotifyEvent {
  readonly eventName: 'onChatThreadChange';
  readonly payload: ChatThreadRawNotifyPayload;
}
