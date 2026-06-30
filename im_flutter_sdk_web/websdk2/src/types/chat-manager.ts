import type {
  DownloadCombineMessageParams,
  Message,
  MessageBody,
  MiniAppFile,
  VoiceMessageBody,
} from './index';
import type { ChatConversationType, MessageConversationLocator } from './message-conversation';
import type { UserInfo } from './user-info';

export type { ChatConversationType } from './message-conversation';

/**
 * [zh-CN] 会话定位参数，包含会话 ID 与会话类型。
 * [en-US] Conversation locator that contains the conversation ID and type.
 */
export type ConversationLocator = MessageConversationLocator;

/**
 * [zh-CN] 标记会话已读的参数。
 * [en-US] Parameters for marking a conversation as read.
 */
export type MarkConversationReadParams = ConversationLocator;

/**
 * [zh-CN] 单条消息已读标记项。
 * [en-US] Single message item to mark as read.
 */
export interface MarkMessageReadItem {
  /** [zh-CN] 要标记已读的收到消息。SDK 会从消息中读取会话、类型与服务端消息 ID。 [en-US] Received message to mark as read. The SDK reads the conversation, type, and server message ID from this message. */
  readonly message: Message;
  /** [zh-CN] 群消息已读回执附带内容，仅群聊有效。 [en-US] Optional group read-receipt content. Only applies to group chat. */
  readonly ackContent?: string;
}

/**
 * [zh-CN] 批量标记消息已读的参数。
 *
 * 所有消息必须属于同一个单聊或群聊会话；SDK 会逐条发送服务端已读回执。
 *
 * [en-US] Parameters for marking messages as read in batch.
 *
 * All messages must belong to the same one-to-one or group conversation; the SDK sends server read receipts one by one.
 */
export interface MarkMessageReadParams {
  /** [zh-CN] 要标记已读的消息列表，必须非空且属于同一会话。 [en-US] Messages to mark as read. Must be non-empty and belong to the same conversation. */
  readonly messages: ReadonlyArray<MarkMessageReadItem>;
}

/**
 * [zh-CN] 撤回消息的参数。
 * [en-US] Parameters for recalling a message.
 */
export interface RecallMessageParams extends ConversationLocator {
  /** [zh-CN] 待撤回消息 ID。 [en-US] ID of the message to recall. */
  messageId: string;
  /** [zh-CN] 撤回操作扩展字段。 [en-US] Extension payload for the recall operation. */
  ext?: Record<string, unknown>;
}

/**
 * [zh-CN] 编辑消息的参数。
 * [en-US] Parameters for editing a message.
 */
export interface UpdateMessageParams extends ConversationLocator {
  /** [zh-CN] 待编辑消息 ID。 [en-US] ID of the message to edit. */
  messageId: string;
  /** [zh-CN] 新消息内容；当前仅支持文本和自定义消息。 [en-US] New message content; currently only text and custom messages are supported. */
  message: Pick<Message, 'type' | 'body' | 'ext'>;
}

/**
 * [zh-CN] 删除历史消息的参数。
 * [en-US] Parameters for removing history messages.
 */
export interface RemoveHistoryMessagesParams extends ConversationLocator {
  /** [zh-CN] 指定删除的消息 ID 列表。 [en-US] Message IDs to remove. */
  messageIds?: ReadonlyArray<string>;
  /** [zh-CN] 删除该时间戳之前的历史消息，单位毫秒。 [en-US] Removes history messages before this timestamp in milliseconds. */
  beforeTimestamp?: number;
}

/**
 * [zh-CN] 获取历史消息的参数。
 * [en-US] Parameters for fetching history messages.
 */
export interface GetHistoryMessagesParams extends ConversationLocator {
  /** [zh-CN] 分页游标；首次请求可不传。 [en-US] Pagination cursor; omit it for the first request. */
  cursor?: string;
  /** [zh-CN] 每页消息数量。 [en-US] Number of messages per page. */
  pageSize?: number;
  /** [zh-CN] 拉取方向，`up` 表示更早消息，`down` 表示更新消息。 [en-US] Search direction; `up` fetches older messages and `down` fetches newer messages. */
  searchDirection?: 'up' | 'down';
  /** [zh-CN] 群聊场景下按发送者过滤。 [en-US] Sender IDs used to filter group-chat history. */
  senderIds?: ReadonlyArray<string>;
  /** [zh-CN] 按消息类型过滤。 [en-US] Message types used for filtering. */
  messageTypes?: ReadonlyArray<Message['type']>;
  /** [zh-CN] 查询起始时间戳，单位毫秒。 [en-US] Query start timestamp in milliseconds. */
  startTime?: number;
  /** [zh-CN] 查询结束时间戳，单位毫秒。 [en-US] Query end timestamp in milliseconds. */
  endTime?: number;
}

/**
 * [zh-CN] 历史消息分页结果。
 * [en-US] Paginated history-message result.
 */
export interface MessageHistoryPage {
  /** [zh-CN] 当前页消息列表。 [en-US] Messages in the current page. */
  items: ReadonlyArray<Message>;
  /** [zh-CN] 下一页游标；为空表示没有后续游标。 [en-US] Cursor for the next page; an empty string means no next cursor is available. */
  cursor: string;
  /** [zh-CN] 是否还有更多历史消息。 [en-US] Whether more history messages are available. */
  hasMore: boolean;
}

/**
 * [zh-CN] 下载消息附件的参数。
 * [en-US] Parameters for downloading a message attachment.
 */
export interface DownloadAttachmentParams {
  /** [zh-CN] 需要下载附件的消息，通常为图片、语音、视频或文件消息。 [en-US] Message whose attachment should be downloaded, usually an image, voice, video, or file message. */
  message: Message;
}

/**
 * [zh-CN] 消息附件下载结果。
 * [en-US] Message attachment download result.
 */
export interface MessageAttachmentDownloadResult {
  /** [zh-CN] 附件文件名。 [en-US] Attachment filename. */
  filename: string;
  /** [zh-CN] 附件 MIME 类型。 [en-US] Attachment MIME type. */
  mimeType: string;
  /** [zh-CN] 附件大小，单位字节。 [en-US] Attachment size in bytes. */
  size?: number;
  /** [zh-CN] 附件二进制数据。 [en-US] Attachment binary data. */
  data: Uint8Array;
  /** [zh-CN] 实际下载地址。 [en-US] Actual download URL. */
  downloadUrl: string;
}

/**
 * [zh-CN] 使用完整合并消息对象下载并解析合并消息的参数。
 * [en-US] Parameters for downloading and parsing a combine message with the full combine message object.
 */
export interface DownloadCombineMessageByMessageInput {
  /** [zh-CN] 合并消息对象。SDK 会从 `message.body` 读取下载地址与密钥。 [en-US] Combine message object. The SDK reads the download URL and secret from `message.body`. */
  message: Message;
  /** [zh-CN] 下载超时，单位毫秒；不传时使用 SDK 默认值。 [en-US] Download timeout in milliseconds; omitted to use the SDK default. */
  timeoutMs?: number;
  /** [zh-CN] 单次允许解码的最大消息条数；不传时使用 SDK 默认值。 [en-US] Maximum number of messages to decode in one request; omitted to use the SDK default. */
  maxItems?: number;
}

/**
 * [zh-CN] 下载并解析合并消息的参数。可传完整 `Message`，也可直接传合并消息体中的最小下载参数 `{ url, secret }`。
 * [en-US] Parameters for downloading and parsing a combine message. You can pass the full `Message`, or pass the minimal download parameters `{ url, secret }` from the combine message body directly.
 */
export type DownloadCombineMessageInput =
  | DownloadCombineMessageByMessageInput
  | DownloadCombineMessageParams;

/**
 * [zh-CN] 查询群消息已读成员的参数。
 * [en-US] Parameters for querying users who have read a group message.
 */
export interface GroupMessageReadUsersParams {
  /** [zh-CN] 群组 ID。 [en-US] Group ID. */
  groupId: string;
  /** [zh-CN] 群消息 ID。 [en-US] Group message ID. */
  messageId: string;
  /** [zh-CN] 分页游标。 [en-US] Pagination cursor. */
  cursor?: string;
  /** [zh-CN] 每页成员数量。 [en-US] Number of users per page. */
  pageSize?: number;
}

/**
 * [zh-CN] 群消息已读成员条目。
 * [en-US] User entry for group-message read receipt.
 */
export interface GroupMessageReadUser {
  /** [zh-CN] 用户 ID。 [en-US] User ID. */
  userId: string;
  /** [zh-CN] 用户资料摘要。 [en-US] User profile summary. */
  user: UserInfo;
  /** [zh-CN] 服务端回执 ID。 [en-US] Server receipt ID. */
  ackId?: string;
  /** [zh-CN] 已读时间戳，单位毫秒。 [en-US] Read timestamp in milliseconds. */
  timestamp?: number;
  /** [zh-CN] 自定义回执内容。 [en-US] Custom read-receipt content. */
  ackContent?: string;
}

/**
 * [zh-CN] 群消息已读成员分页结果。
 * [en-US] Paginated result of users who have read a group message.
 */
export interface GroupMessageReadUsersResult {
  /** [zh-CN] 群组 ID。 [en-US] Group ID. */
  groupId: string;
  /** [zh-CN] 群消息 ID。 [en-US] Group message ID. */
  messageId: string;
  /** [zh-CN] 当前页已读成员列表。 [en-US] Users in the current page. */
  users: ReadonlyArray<GroupMessageReadUser>;
  /** [zh-CN] 已读成员总数。 [en-US] Total number of users who have read the message. */
  count: number;
  /** [zh-CN] 下一页游标。 [en-US] Cursor for the next page. */
  cursor: string;
  /** [zh-CN] 是否还有更多成员。 [en-US] Whether more users are available. */
  hasMore: boolean;
}

/**
 * [zh-CN] 添加或删除消息 Reaction 的参数。
 * [en-US] Parameters for adding or removing a message reaction.
 */
export interface ReactionOperationParams {
  /** [zh-CN] 消息 ID。 [en-US] Message ID. */
  messageId: string;
  /** [zh-CN] Reaction 内容，例如表情或业务标识。 [en-US] Reaction content, such as an emoji or business-defined identifier. */
  reaction: string;
}

/**
 * [zh-CN] 获取消息 Reaction 列表的参数。
 * [en-US] Parameters for fetching message reaction summaries.
 */
export interface GetReactionListParams {
  /** [zh-CN] 单个消息 ID 或消息 ID 列表。 [en-US] A message ID or a list of message IDs. */
  messageId: string | ReadonlyArray<string>;
  /** [zh-CN] 会话类型；当前支持单聊和群聊。 [en-US] Conversation type; currently supports one-to-one and group chat. */
  conversationType: Extract<ChatConversationType, 'singleChat' | 'groupChat'>;
  /** [zh-CN] 群聊时必填的群组 ID。 [en-US] Required group ID for group-chat reactions. */
  groupId?: string;
}

/**
 * [zh-CN] 单个 Reaction 汇总信息。
 * [en-US] Summary of a single reaction.
 */
export interface MessageReactionSummary {
  /** [zh-CN] Reaction 内容。 [en-US] Reaction content. */
  reaction: string;
  /** [zh-CN] 添加该 Reaction 的用户数量。 [en-US] Number of users who added this reaction. */
  count: number;
  /** [zh-CN] 当前用户是否已添加该 Reaction。 [en-US] Whether the current user has added this reaction. */
  isAddedBySelf: boolean;
  /** [zh-CN] 添加该 Reaction 的用户 ID 列表。 [en-US] User IDs that added this reaction. */
  userIds: ReadonlyArray<string>;
}

/**
 * [zh-CN] 单条消息的 Reaction 汇总。
 * [en-US] Reaction summary for one message.
 */
export interface MessageReactionListItem {
  /** [zh-CN] 消息 ID。 [en-US] Message ID. */
  messageId: string;
  /** [zh-CN] 该消息上的 Reaction 汇总列表。 [en-US] Reaction summaries on this message. */
  reactions: ReadonlyArray<MessageReactionSummary>;
}

/**
 * [zh-CN] 获取 Reaction 详情的参数。
 * [en-US] Parameters for fetching reaction details.
 */
export interface GetReactionDetailParams extends ReactionOperationParams {
  /** [zh-CN] 分页游标。 [en-US] Pagination cursor. */
  cursor?: string;
  /** [zh-CN] 每页用户数量。 [en-US] Number of users per page. */
  pageSize?: number;
}

/**
 * [zh-CN] Reaction 用户明细条目。
 * [en-US] User detail entry for a reaction.
 */
export interface ReactionUser {
  /** [zh-CN] 用户 ID。 [en-US] User ID. */
  userId: string;
  /** [zh-CN] 用户资料摘要。 [en-US] User profile summary. */
  user: UserInfo;
  /** [zh-CN] 添加 Reaction 的时间。 [en-US] Time when the reaction was added. */
  createdAt?: string;
}

/**
 * [zh-CN] Reaction 详情分页结果。
 * [en-US] Paginated reaction detail result.
 */
export interface MessageReactionDetailPage {
  /** [zh-CN] Reaction 内容。 [en-US] Reaction content. */
  reaction: string;
  /** [zh-CN] 添加该 Reaction 的用户数量。 [en-US] Number of users who added this reaction. */
  count: number;
  /** [zh-CN] 当前用户是否已添加该 Reaction。 [en-US] Whether the current user has added this reaction. */
  isAddedBySelf: boolean;
  /** [zh-CN] 添加该 Reaction 的用户明细列表。 [en-US] Detailed user entries for this reaction. */
  reactionUsers: ReadonlyArray<ReactionUser>;
  /** [zh-CN] 下一页游标。 [en-US] Cursor for the next page. */
  cursor: string;
  /** [zh-CN] 是否还有更多用户。 [en-US] Whether more users are available. */
  hasMore: boolean;
  /** [zh-CN] Reaction 创建时间。 [en-US] Reaction creation time. */
  createdAt?: string;
}

/**
 * [zh-CN] 翻译服务支持的语言。
 * [en-US] Language supported by the translation service.
 */
export interface TranslationLanguage {
  /** [zh-CN] 语言代码。 [en-US] Language code. */
  code: string;
  /** [zh-CN] 语言英文名或服务端返回名称。 [en-US] English name or server-returned language name. */
  name: string;
  /** [zh-CN] 语言本地名称。 [en-US] Native language name. */
  nativeName: string;
}

/**
 * [zh-CN] 翻译消息的参数。
 * [en-US] Parameters for translating a message.
 */
export interface TranslateMessageParams {
  /** [zh-CN] 待翻译文本消息。 [en-US] Text message to translate. */
  message: Message;
  /** [zh-CN] 目标语言代码列表。 [en-US] Target language codes. */
  targetLanguages: ReadonlyArray<string>;
}

/**
 * [zh-CN] 语音转文字可选参数。
 * [en-US] Optional parameters for voice-to-text recognition.
 */
export interface VoiceParams {
  /** [zh-CN] 语音格式，例如 `amr`、`mp3`、`pcm`。 [en-US] Voice format such as `amr`, `mp3`, or `pcm`. */
  readonly format?: string;
  /** [zh-CN] 采样率。 [en-US] Audio sample rate. */
  readonly sampleRate?: number;
  /** [zh-CN] 位深。 [en-US] Bits per sample. */
  readonly bitsPerSample?: number;
  /** [zh-CN] 声道数。 [en-US] Channel count. */
  readonly channels?: number;
}

/**
 * [zh-CN] 旧 SDK 兼容的语音消息体输入。
 * [en-US] Legacy-compatible voice message body input.
 */
export type VoiceMessageSource = VoiceMessageBody & { readonly type?: 'voice' };

/**
 * [zh-CN] 语音文件输入，当前明确支持浏览器 `File` 与小程序 `MiniAppFile`。
 * [en-US] Voice file input. The current feature explicitly supports browser `File` and miniapp `MiniAppFile`.
 */
export type VoiceSourceFile = File | MiniAppFile;

/**
 * [zh-CN] 语音转文字业务结果。
 * [en-US] Voice-to-text business result.
 */
export interface VoiceToTextResult {
  /** [zh-CN] 转写得到的文本。 [en-US] Transcribed text. */
  readonly text: string;
}

/**
 * [zh-CN] 单条翻译结果。
 * [en-US] Single translation result.
 */
export interface MessageTranslation {
  /** [zh-CN] 翻译后的文本。 [en-US] Translated text. */
  text: string;
  /** [zh-CN] 目标语言代码。 [en-US] Target language code. */
  to: string;
}

/**
 * [zh-CN] 消息翻译结果。
 * [en-US] Message translation result.
 */
export interface MessageTranslationResult {
  /** [zh-CN] 服务端识别出的源语言。 [en-US] Source language detected by the server. */
  detectedLanguage?: {
    /** [zh-CN] 源语言代码。 [en-US] Source language code. */
    language: string;
    /** [zh-CN] 识别置信度。 [en-US] Detection confidence score. */
    score: number;
  };
  /** [zh-CN] 翻译结果列表。 [en-US] Translation result list. */
  translations: ReadonlyArray<MessageTranslation>;
}

/**
 * [zh-CN] 消息送达回执事件载荷。
 *
 * 触发时机：接收方的 SDK 自动回送达回执后，发送方收到此事件。
 * 接收方：消息的原始发送方。
 * 前提：接收方初始化时设置了 `enableDeliveryReceipt: true`。
 *
 * [en-US] Message delivered event payload.
 *
 * Triggered when: the recipient's SDK auto-sends a delivery ack, and the sender receives it.
 * Received by: the original message sender.
 * Prerequisite: the recipient initialized with `enableDeliveryReceipt: true`.
 */
export interface MessageDeliveredEventPayload {
  /** [zh-CN] 已送达的原始消息 ID。 [en-US] ID of the original message that was delivered. */
  readonly messageId: string;
  /** [zh-CN] 会话 ID。 [en-US] Conversation ID. */
  readonly conversationId: string;
  /** [zh-CN] 会话类型（始终为 singleChat）。 [en-US] Conversation type (always singleChat). */
  readonly conversationType: 'singleChat';
}


/**
 * [zh-CN] 消息已读回执事件载荷。
 *
 * 触发时机：对方发送单聊消息已读回执，或群成员发送群消息已读回执。
 * 接收方：消息的原始发送方。
 *
 * [en-US] Message read receipt event payload.
 *
 * Triggered when: the recipient sends a read receipt for a single-chat message,
 * or a group member sends a group message read receipt.
 * Received by: the original message sender.
 */
export interface MessageReadEventPayload extends ConversationLocator {
  /** [zh-CN] 被标记已读的消息 ID。 [en-US] ID of the message marked as read. */
  readonly messageId: string;
  /** [zh-CN] 群已读回执附带的内容。 [en-US] Content attached to the group read receipt. */
  readonly ackContent?: string;
}

/**
 * [zh-CN] 会话已读回执事件载荷。
 *
 * 触发时机：对方调用 `markConversationRead` 标记整个会话为已读。
 * 接收方：单聊对方（仅单聊触发此事件；群聊标记已读仅清除服务端未读数，不触发此事件）。
 *
 * [en-US] Conversation read receipt event payload.
 *
 * Triggered when: the other party calls `markConversationRead` to mark the entire conversation as read.
 * Received by: the other party in a single chat (group chat read marking only clears server unread count without triggering this event).
 */
export interface ConversationReadEventPayload extends ConversationLocator {
  /** [zh-CN] 标记已读的时间戳。 [en-US] Timestamp when the conversation was marked as read. */
  timestamp: number;
}

/**
 * [zh-CN] 消息撤回事件载荷。
 *
 * 触发时机：发送方撤回消息，或群主/管理员撤回群内他人消息。
 * 接收方：会话中的所有成员（含撤回者的其他设备）。
 *
 * [en-US] Message recalled event payload.
 *
 * Triggered when: the sender recalls a message, or a group owner/admin recalls another member's message.
 * Received by: all members in the conversation (including the recaller's other devices).
 */
export interface MessageRecalledEventPayload extends ConversationLocator {
  /** [zh-CN] 被撤回的消息 ID。 [en-US] ID of the recalled message. */
  messageId: string;
  /** [zh-CN] 撤回时间戳。 [en-US] Recall timestamp. */
  timestamp: number;
}

/**
 * [zh-CN] 消息编辑事件载荷。
 *
 * 触发时机：发送方编辑已发送的消息。
 * 接收方：会话中的所有成员（含编辑者的其他设备）。
 *
 * [en-US] Message updated (edited) event payload.
 *
 * Triggered when: the sender edits a sent message.
 * Received by: all members in the conversation (including the editor's other devices).
 */
export interface MessageUpdatedEventPayload extends ConversationLocator {
  /** [zh-CN] 被编辑的消息 ID。 [en-US] ID of the edited message. */
  messageId: string;
  /** [zh-CN] 编辑后的消息内容。 [en-US] Updated message content. */
  message: Pick<Message, 'type' | 'body' | 'ext' | 'modifiedInfo'>;
  /** [zh-CN] 编辑时间戳。 [en-US] Edit timestamp. */
  timestamp: number;
}

/**
 * [zh-CN] Reaction 变更事件载荷。
 *
 * 触发时机：会话中有成员对消息添加或移除 Reaction。
 * 接收方：会话中的所有成员。
 * 注意：仅支持单聊和群聊，不支持聊天室。
 *
 * [en-US] Reaction changed event payload.
 *
 * Triggered when: a member adds or removes a reaction on a message.
 * Received by: all members in the conversation.
 * Note: only supported in single chat and group chat, NOT in chat rooms.
 */
export interface ReactionChangedEventPayload {
  /** [zh-CN] 消息 ID。 [en-US] Message ID. */
  messageId: string;
  /** [zh-CN] Reaction 表情。 [en-US] Reaction emoji. */
  reaction: string;
  /** [zh-CN] 操作类型。 [en-US] Operation type. */
  operation: 'add' | 'remove';
}

/**
 * [zh-CN] 消息置顶变更事件载荷。
 *
 * 触发时机：会话中有成员置顶或取消置顶消息。
 * 接收方：会话中的所有成员。
 *
 * [en-US] Pinned message changed event payload.
 *
 * Triggered when: a member pins or unpins a message in the conversation.
 * Received by: all members in the conversation.
 */
export interface PinnedMessageChangedEventPayload extends ConversationLocator {
  /** [zh-CN] 消息 ID。 [en-US] Message ID. */
  messageId: string;
  /** [zh-CN] 操作类型。 [en-US] Operation type. */
  operation: 'pin' | 'unpin';
  /** [zh-CN] 置顶时间戳。 [en-US] Pin timestamp. */
  pinTime?: number;
  /** [zh-CN] 操作者用户 ID。 [en-US] Operator user ID. */
  operatorId?: string;
}

/**
 * [zh-CN] 消息动作结果，适用于撤回等基于动作通道完成的操作。
 * [en-US] Message action result used by action-channel operations such as recall.
 */
export interface ChatActionResult {
  /** [zh-CN] 消息 ID。 [en-US] Message ID. */
  messageId: string;
  /** [zh-CN] 会话 ID。 [en-US] Conversation ID. */
  conversationId: string;
  /** [zh-CN] 会话类型。 [en-US] Conversation type. */
  conversationType: ChatConversationType;
  /** [zh-CN] 动作完成时间戳，单位毫秒。 [en-US] Timestamp when the action completed, in milliseconds. */
  timestamp: number;
}

export interface ChatMessageAction {
  readonly kind: 'conversationRead' | 'messageRead' | 'groupMessageRead' | 'recall' | 'update';
  readonly conversationId: string;
  readonly conversationType: ChatConversationType;
  readonly messageId?: string;
  readonly ackContent?: string;
  readonly body?: MessageBody;
  readonly type?: Message['type'];
  readonly ext?: Record<string, unknown>;
}


// ─── 服务端消息搜索 ───────────────────────────────────────────────

/**
 * [zh-CN] 消息搜索关键词匹配模式。
 * [en-US] Keyword match type for message search.
 */
export type MessageSearchKeywordMatchType = 'or' | 'and';

/**
 * [zh-CN] 消息搜索范围。
 * [en-US] Message search scope.
 */
export type MessageSearchScope = 'none' | 'with' | 'only';

/**
 * [zh-CN] 消息搜索排序方向。
 * [en-US] Message search sort direction.
 */
export type MessageSearchDirection = 'up' | 'down';

/**
 * [zh-CN] 消息搜索支持的消息类型。
 * [en-US] Message types supported by server search.
 */
export type SearchableMessageType = 'txt' | 'img' | 'video' | 'file' | 'loc' | 'custom';

/**
 * [zh-CN] 消息搜索的会话类型过滤。
 * [en-US] Conversation type for server message search filtering.
 */
export type MessageSearchConversationType = 'singleChat' | 'groupChat' | 'chatRoom';

/**
 * [zh-CN] 消息搜索选项。
 * [en-US] Message search option.
 */
export interface MessageSearchOption {
  /** [zh-CN] 搜索关键词列表（必填，最多5个，每个最长512字符）。 [en-US] Search keyword list (required, max 5, each max 512 chars). */
  keywordList: ReadonlyArray<string>;
  /** [zh-CN] 多关键词匹配关系，默认 'or'。 [en-US] Keyword match type, defaults to 'or'. */
  keywordListMatchType?: MessageSearchKeywordMatchType;
  /** [zh-CN] 会话内搜索时的会话 ID。 [en-US] Conversation ID for in-conversation search. */
  conversationId?: string;
  /** [zh-CN] 会话类型过滤，需与 conversationId 配合使用。 [en-US] Conversation type filter, must be used with conversationId. */
  conversationType?: MessageSearchConversationType;
  /** [zh-CN] 消息体类型过滤（不支持 audio 和 cmd）。 [en-US] Message type filter (audio and cmd not supported). */
  msgTypes?: ReadonlyArray<SearchableMessageType>;
  /** [zh-CN] 查询开始时间戳（毫秒），需与 endTime 同时提供。 [en-US] Query start timestamp in ms, must be provided with endTime. */
  startTime?: number;
  /** [zh-CN] 查询结束时间戳（毫秒），需与 startTime 同时提供。 [en-US] Query end timestamp in ms, must be provided with startTime. */
  endTime?: number;
  /** [zh-CN] 搜索范围：'none' 仅消息体 | 'with' 消息体+扩展 | 'only' 仅扩展字段。 [en-US] Search scope: 'none' body only | 'with' body+ext | 'only' ext only. */
  searchScope?: MessageSearchScope;
  /** [zh-CN] 搜索方向：'up' 旧→新 | 'down' 新→旧。 [en-US] Sort direction: 'up' oldest first | 'down' newest first. */
  direction?: MessageSearchDirection;
}

/**
 * [zh-CN] 服务端消息搜索参数。
 * [en-US] Server message search parameters.
 */
export interface SearchMessagesParams {
  /** [zh-CN] 搜索选项。 [en-US] Search options. */
  option: MessageSearchOption;
  /** [zh-CN] 页码，从1开始，默认1。 [en-US] Page number starting from 1, defaults to 1. */
  pageNum?: number;
  /** [zh-CN] 每页数量，范围1-100，默认20。 [en-US] Page size, range 1-100, defaults to 20. */
  pageSize?: number;
}

/**
 * [zh-CN] 搜索结果中的单条消息。
 * [en-US] Single message in search result.
 */
export interface SearchResultMessage extends Message {
  /** [zh-CN] 服务端返回的高亮片段。 [en-US] Highlight snippets from server. */
  highlight?: ReadonlyArray<string>;
  /** [zh-CN] 服务端返回的摘要文本。 [en-US] Summary text from server. */
  text?: string;
}

/**
 * [zh-CN] 服务端消息搜索结果。
 * [en-US] Server message search result.
 */
export interface SearchMessagesResult {
  /** [zh-CN] 搜索结果消息列表。 [en-US] Search result message list. */
  messages: ReadonlyArray<SearchResultMessage>;
  /** [zh-CN] 当前页码。 [en-US] Current page number. */
  pageNum: number;
  /** [zh-CN] 请求页大小。 [en-US] Requested page size. */
  pageSize: number;
  /** [zh-CN] 总页数。 [en-US] Total pages. */
  totalPages: number;
  /** [zh-CN] 是否为最后一页。 [en-US] Whether this is the last page. */
  isLast: boolean;
}
