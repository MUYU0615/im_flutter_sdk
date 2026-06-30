/**
 * [zh-CN] Conversation 公开类型定义。
 * [en-US] Public conversation type definitions.
 */

import type { Sender } from './sender';
import type {
  Message,
  MessageDirect,
  MessageModifiedInfo,
  MessageStatus,
  MessageType,
} from './index';
export type { Sender } from './sender';

export const CONVERSATION_TYPE = {
  SINGLE_CHAT: 'singleChat',
  GROUP_CHAT: 'groupChat',
  CHAT_ROOM: 'chatRoom',
} as const;

export type ConversationType = (typeof CONVERSATION_TYPE)[keyof typeof CONVERSATION_TYPE];

/**
 * [zh-CN] 会话标记槽位常量，实际业务含义由开发者维护。
 * [en-US] Conversation mark slot constants; applications define the business meaning.
 */
export const CONVERSATION_MARK = {
  MARK_0: 0,
  MARK_1: 1,
  MARK_2: 2,
  MARK_3: 3,
  MARK_4: 4,
  MARK_5: 5,
  MARK_6: 6,
  MARK_7: 7,
  MARK_8: 8,
  MARK_9: 9,
  MARK_10: 10,
  MARK_11: 11,
  MARK_12: 12,
  MARK_13: 13,
  MARK_14: 14,
  MARK_15: 15,
  MARK_16: 16,
  MARK_17: 17,
  MARK_18: 18,
  MARK_19: 19,
} as const;

export type ConversationMark = (typeof CONVERSATION_MARK)[keyof typeof CONVERSATION_MARK];

/**
 * [zh-CN] 会话唯一标识。
 * [en-US] Unique conversation identifier.
 */
export interface ConversationIdentifier {
  /** [zh-CN] 会话 ID；单聊为用户 ID，群聊为 groupId，聊天室为 chatroomId。 [en-US] Conversation ID; user ID for one-to-one chat, groupId for group chat, and chatroomId for chat room. */
  readonly conversationId: string;
  /** [zh-CN] 会话类型。 [en-US] Conversation type. */
  readonly conversationType: ConversationType;
}

export type ConversationMarkTarget = ConversationIdentifier;

/**
 * [zh-CN] 会话列表过滤条件。
 * [en-US] Filter criteria for conversation list queries.
 */
export interface ConversationFilter {
  /** [zh-CN] 为 true 时只返回置顶会话。 [en-US] When true, returns only pinned conversations. */
  readonly isPinned?: boolean;
  /** [zh-CN] 按会话标记槽位过滤，取值 0 到 19。 [en-US] Filters by conversation mark slot, from 0 to 19. */
  readonly mark?: ConversationMark;
}

/**
 * [zh-CN] 删除会话的参数。
 * [en-US] Parameters for deleting a conversation.
 */
export interface DeleteConversationParams extends ConversationIdentifier {
  /** [zh-CN] 是否同时删除服务端漫游消息。 [en-US] Whether to also delete server-side roaming messages. */
  readonly deleteRoamingMessages?: boolean;
}

/**
 * [zh-CN] 设置会话置顶的参数。
 * [en-US] Parameters for setting the pinned status of a conversation.
 */
export interface SetConversationPinnedParams extends ConversationIdentifier {
  /** [zh-CN] `true` 表示置顶，`false` 表示取消置顶。 [en-US] `true` pins the conversation and `false` unpins it. */
  readonly pinned: boolean;
}

/**
 * [zh-CN] 添加或移除会话标记的参数，支持单会话或批量会话。
 * [en-US] Parameters for adding or removing a conversation mark, supporting one conversation or a batch.
 */
export type ConversationMarkParams =
  | {
      /** [zh-CN] 需要操作的会话列表。 [en-US] Conversations to mutate. */
      readonly conversations: ReadonlyArray<ConversationMarkTarget>;
      /** [zh-CN] 会话标记槽位，取值 0 到 19。 [en-US] Conversation mark slot, from 0 to 19. */
      readonly mark: ConversationMark;
    }
  | (ConversationIdentifier & {
      /** [zh-CN] 会话标记槽位，取值 0 到 19。 [en-US] Conversation mark slot, from 0 to 19. */
      readonly mark: ConversationMark;
    });

/**
 * [zh-CN] 单个会话标记变更结果。
 * [en-US] Mutation result for one conversation mark target.
 */
export interface ConversationMarkMutationItem extends ConversationIdentifier {
  /** [zh-CN] 操作失败原因；成功项不包含该字段。 [en-US] Failure reason; successful items do not include this field. */
  readonly reason?: string;
}

/**
 * [zh-CN] 会话标记变更结果。
 * [en-US] Conversation mark mutation result.
 */
export interface ConversationMarkMutationResult {
  /** [zh-CN] 成功应用本次标记变更的会话。 [en-US] Conversations that successfully applied this mark mutation. */
  readonly succeeded: ReadonlyArray<ConversationMarkMutationItem>;
  /** [zh-CN] 未能应用本次标记变更的会话。 [en-US] Conversations that failed to apply this mark mutation. */
  readonly failed: ReadonlyArray<ConversationMarkMutationItem>;
  /** [zh-CN] 本次操作的标记槽位。 [en-US] Mark slot mutated by this operation. */
  readonly mark: ConversationMark;
  /** [zh-CN] 标记操作类型。 [en-US] Mark operation type. */
  readonly operation: 'addMark' | 'removeMark';
}

/**
 * [zh-CN] 置顶或取消置顶消息的参数。
 * [en-US] Parameters for pinning or unpinning a message.
 */
export interface PinMessageParams extends ConversationIdentifier {
  /** [zh-CN] 消息 ID。 [en-US] Message ID. */
  readonly messageId: string;
}

/**
 * [zh-CN] 获取会话内置顶消息列表的参数。该接口不分页，服务端最多返回 20 条置顶消息。
 * [en-US] Parameters for listing pinned messages in a conversation. This API is not paginated and returns at most 20 pinned messages.
 */
export type GetPinnedMessageListParams = ConversationIdentifier;

/**
 * [zh-CN] 会话变更结果。
 * [en-US] Conversation mutation result.
 */
export interface ConversationMutationResult {
  /** [zh-CN] 会话 ID。 [en-US] Conversation ID. */
  readonly conversationId: string;
  /** [zh-CN] 会话类型。 [en-US] Conversation type. */
  readonly conversationType: ConversationType;
  /** [zh-CN] 操作类型。 [en-US] Operation type. */
  readonly operation: 'delete' | 'setPinned';
  /** [zh-CN] 会话是否置顶。 [en-US] Whether the conversation is pinned. */
  readonly isPinned?: boolean;
  /** [zh-CN] 置顶时间戳，单位毫秒。 [en-US] Pinned timestamp in milliseconds. */
  readonly pinnedTime?: number;
}

/**
 * [zh-CN] 置顶或取消置顶消息的结果。
 * [en-US] Result of pinning or unpinning a message.
 */
export interface MessagePinMutationResult {
  /** [zh-CN] 会话 ID。 [en-US] Conversation ID. */
  readonly conversationId: string;
  /** [zh-CN] 会话类型。 [en-US] Conversation type. */
  readonly conversationType: ConversationType;
  /** [zh-CN] 消息 ID。 [en-US] Message ID. */
  readonly messageId: string;
  /** [zh-CN] 操作类型。 [en-US] Operation type. */
  readonly operation: 'pin' | 'unpin';
}

/**
 * [zh-CN] 置顶消息摘要。
 * [en-US] Pinned message summary.
 */
export interface PinnedMessageSummary {
  /** [zh-CN] 消息 ID。 [en-US] Message ID. */
  readonly messageId: string;
  /** [zh-CN] 会话 ID。 [en-US] Conversation ID. */
  readonly conversationId: string;
  /** [zh-CN] 会话类型。 [en-US] Conversation type. */
  readonly conversationType: ConversationType;
  /** [zh-CN] 置顶操作者用户 ID。 [en-US] User ID of the operator who pinned the message. */
  readonly operatorId?: string;
  /** [zh-CN] 置顶时间戳，单位毫秒。 [en-US] Pinned timestamp in milliseconds. */
  readonly pinnedAt: number;
  /** [zh-CN] 被置顶的完整消息。 [en-US] Full pinned message. */
  readonly message: Message;
}

export interface PinnedMessageListResult {
  /**
   * [zh-CN] 会话内置顶消息摘要列表，最多 20 条。
   * [en-US] Pinned message summaries in the conversation, at most 20 items.
   */
  readonly items: ReadonlyArray<PinnedMessageSummary>;
}

/**
 * [zh-CN] 主动刷新新会话列表时的请求参数。
 * [en-US] Request parameters for refreshing the new session list.
 */
export interface RefreshSessionListParams {
  /** [zh-CN] 是否需要返回空会话。 [en-US] Whether empty sessions should be returned. */
  readonly includeEmpty?: boolean;
}

/**
 * [zh-CN] Session list 专用提醒类型。
 * [en-US] Session-list specific remind type.
 */
export type SessionListRemindType = 'DEFAULT' | 'ALL' | 'AT' | 'NONE';

/**
 * [zh-CN] 会话列表最小消息摘要。
 * [en-US] Minimal message snippet used by session list.
 */
export interface SessionMessageSnippet {
  /** [zh-CN] 服务端消息 ID。 [en-US] Server message ID. */
  readonly msgServerId: string;
  /** [zh-CN] 发送者用户 ID。 [en-US] Sender user ID. */
  readonly from: string;
  /** [zh-CN] 接收方 ID；单聊为 userId，群聊为 groupId，聊天室为 chatroomId。 [en-US] Receiver id; userId for one-to-one chat, groupId for group chat, and chatroomId for chat room. */
  readonly to: string;
  /** [zh-CN] 发送者信息。 [en-US] Sender information. */
  readonly sender: Sender;
  /** [zh-CN] 会话 ID。 [en-US] Conversation ID. */
  readonly conversationId?: string;
  /** [zh-CN] 会话类型。 [en-US] Conversation type. */
  readonly conversationType?: ConversationType;
  /** [zh-CN] 消息类型。 [en-US] Message type. */
  readonly type?: MessageType;
  /** [zh-CN] 消息状态。 [en-US] Message status. */
  readonly status?: MessageStatus;
  /** [zh-CN] 消息时间戳，单位毫秒。 [en-US] Message timestamp in milliseconds. */
  readonly timestamp: number;
  /** [zh-CN] 消息方向。 [en-US] Message direction. */
  readonly direct?: MessageDirect;
  /** [zh-CN] 消息修改信息；最后一条消息被编辑后可能存在。 [en-US] Message modification information; present when the last message has been edited. */
  readonly modifiedInfo?: MessageModifiedInfo;
  /** [zh-CN] 发送者用户资料版本时间，单位秒；用于资料补位。 [en-US] Sender user-profile version timestamp in seconds; used for profile hydration. */
  readonly userInfoUpdateTime?: number;
  /** [zh-CN] 群成员名片版本时间，单位秒；仅群聊最后一条消息可能存在。 [en-US] Group member name-card version timestamp in seconds; present only for group-chat last messages. */
  readonly namecardUpdateTime?: number;
  /** [zh-CN] 消息体摘要；不得包含 `type` 字段。 [en-US] Message body snippet; must not contain the `type` field. */
  readonly body: Record<string, unknown>;
}

/**
 * [zh-CN] 公开会话列表项，来源于本地会话列表缓存投影。
 * [en-US] Public conversation list item projected from the local conversation-list cache.
 */
export interface ConversationItem {
  /** [zh-CN] 会话 ID。 [en-US] Conversation ID. */
  readonly conversationId: string;
  /** [zh-CN] 会话类型。 [en-US] Conversation type. */
  readonly conversationType: ConversationType;
  /** [zh-CN] 未读消息数。 [en-US] Unread message count. */
  readonly unreadCount: number;
  /** [zh-CN] 最后一条消息摘要。 [en-US] Last message snippet. */
  readonly lastMessage: SessionMessageSnippet | null;
  /** [zh-CN] 最后一条消息时间戳，单位毫秒。 [en-US] Timestamp of the last message in milliseconds. */
  readonly lastMessageAt?: number;
  /** [zh-CN] 是否置顶。 [en-US] Whether the session is pinned. */
  readonly isPinned?: boolean;
  /** [zh-CN] 置顶时间戳，单位毫秒。 [en-US] Pinned timestamp in milliseconds. */
  readonly pinnedTimestamp?: number;
  /** [zh-CN] 会话标记列表。 [en-US] Session mark list. */
  readonly marks: ReadonlyArray<ConversationMark>;
  /** [zh-CN] 已读位置或已读时间戳。 [en-US] Read receipt position or timestamp. */
  readonly readAt?: number;
  /** [zh-CN] 会话提醒类型。 [en-US] Session reminder type. */
  readonly remindType: SessionListRemindType;
  /** [zh-CN] 会话展示名称。 [en-US] Conversation display name. */
  readonly conversationName: string;
  /** [zh-CN] 会话头像地址。 [en-US] Conversation avatar URL. */
  readonly conversationAvatar?: string;
}
