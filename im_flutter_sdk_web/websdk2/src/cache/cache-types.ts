/**
 * 缓存模块类型定义
 */

import type {
  ConversationIdentifier,
  ConversationItem,
  ConversationMark,
  ConversationType,
} from '../types/conversation';
import type { MessageModifiedInfo } from '../types';
import type { JoinedGroupSnapshotMeta, JoinedGroupSummary } from '../types/group';

export interface MessageSnippet {
  // 消息摘要结构
  readonly msgId: string; // 消息 ID
  readonly type: string; // 消息类型
  readonly body: Record<string, unknown>; // 消息体摘要
  readonly timestamp: number; // 消息时间戳
  readonly userInfoUpdateTime?: number; // 用户资料版本（秒）
  readonly namecardUpdateTime?: number; // 群名片版本（秒）
  readonly modifiedInfo?: MessageModifiedInfo; // 消息修改信息
} // 消息摘要结构结束

export interface ConversationSummary {
  // 会话摘要结构
  readonly conversationId: string; // 会话 ID
  readonly type: ConversationType; // 会话类型
  readonly lastMessage: MessageSnippet | null; // 最后一条消息摘要
  readonly unreadCount: number; // 未读数
  readonly isPinned?: boolean; // 是否置顶（可选）
  readonly pinnedTime?: number; // 置顶时间（可选）
  readonly marks: ReadonlyArray<ConversationMark>; // 会话标记
  readonly lastAccess: number; // 最近访问时间
  readonly lastUpdate: number; // 最近更新时间
} // 会话摘要结构结束

export interface UserInfoSummary {
  // 用户信息摘要
  readonly userId: string; // 用户 ID
  readonly nickname?: string; // 用户昵称
  readonly avatarUrl?: string; // 用户头像
  readonly sign?: string; // 用户签名
  readonly ext?: string; // 用户扩展
  readonly userInfoUpdateTime?: number; // 用户资料版本（秒）
  readonly lastSyncAt?: number; // 最近同步时间
  readonly lastAccess: number; // 最近访问时间
  readonly lastUpdate: number; // 最近更新时间
} // 用户信息摘要结束

export interface GroupNamecardCacheRecord {
  readonly groupId: string; // 群组 ID
  readonly userId: string; // 用户 ID
  readonly namecard: string; // 群名片
  readonly namecardUpdateTime?: number; // 群名片版本（秒）
  readonly lastSyncAt?: number; // 最近同步时间
  readonly lastAccess: number; // 最近访问时间
  readonly lastUpdate: number; // 最近更新时间
}

export type ContactCacheIntegrity = 'complete' | 'incomplete';

export type ContactCacheIncompleteReason =
  | 'quota_exceeded'
  | 'user_info_missing'
  | 'corrupted'
  | 'first_sync_pending'
  | 'manual_reset';

export type ContactVersionSource = 'metadata' | 'sync_page' | 'roster_notice';

export type ContactSyncMode = 'full' | 'incremental' | 'skipped';

export interface ContactRelationRecord {
  readonly userId: string;
  readonly remark: string;
  readonly sign: string;
  readonly addTs: number;
  readonly updatedAt: number;
  readonly metadataUpdatedAt: number;
}

export interface ContactVersionState {
  readonly version: string;
  readonly lastVersionCheckAt: number;
  readonly lastVersionSource: ContactVersionSource;
}

export interface ContactCacheMeta {
  readonly cacheIntegrity: ContactCacheIntegrity;
  readonly reason?: ContactCacheIncompleteReason;
  readonly lastSyncTs: number;
  readonly lastSuccessfulVersion: string;
  readonly lastSyncMode: ContactSyncMode;
}

export interface CacheMetadata {
  // 缓存元信息
  readonly schemaVersion: number; // 结构版本号
  readonly lastFlush: number; // 最近一次落盘时间
} // 缓存元信息结束

export interface CacheConfig {
  // 缓存配置
  readonly schemaVersion: number; // 结构版本号
  readonly ttlSeconds: number; // 过期时间（秒）
  readonly flushIntervalMs: number; // 批量 flush 间隔
  readonly maxUserInfoCount: number; // 用户信息最大条数
  readonly maxGroupNamecardCount?: number; // 群名片最大条数（可选）
  readonly maxConversations?: number; // 会话最大条数（可选）
} // 缓存配置结束

/**
 * [zh-CN] 会话列表更新原因。
 * `conversation` 表示会话列表同步或会话缓存基线变化；`profile` 表示联系人或用户资料补全导致展示信息变化；
 * `message` 表示收发消息导致最后一条消息、未读数或排序变化；`local` 表示本地置顶、标记、删除等会话操作。
 * [en-US] Reason for a conversation-list update.
 * `conversation` means conversation-list sync or baseline cache changes; `profile` means contact or user-profile hydration changed display fields;
 * `message` means sent/received messages changed last message, unread count, or order; `local` means local mutations such as pin, mark, or delete.
 */
export type ConversationListUpdateReason = 'conversation' | 'profile' | 'message' | 'local';

/**
 * [zh-CN] 会话列表更新补丁。简单 UI 可以直接使用 `ConversationListUpdatePayload.items`，只有需要保留业务本地字段或做精细合并时才需要读取该补丁。
 * [en-US] Patch for a conversation-list update. Simple UIs can use `ConversationListUpdatePayload.items` directly; read this patch only when preserving app-local fields or doing fine-grained merges.
 */
export interface ConversationListUpdatePatch {
  /**
   * [zh-CN] 是否为一次整体基线重置。为 `true` 时，表示 SDK 重新建立或替换了会话列表基线，例如登录后加载缓存、服务端全量同步、fallback 到全量刷新等。业务如果自己维护带本地字段的列表，应以 `items` 作为当前权威快照，按会话 key 重新挂回本地字段；简单 UI 直接使用 `items` 即可。
   * [en-US] Whether this update rebuilds or replaces the whole conversation-list baseline. When `true`, the SDK established a new authoritative list, for example after cache load on login, full server sync, or fallback full refresh. Apps that keep app-local fields should reconcile against `items` by conversation key; simple UIs can use `items` directly.
   */
  readonly reset: boolean;
  /** [zh-CN] 本次新增或 SDK 字段发生变化的会话。 [en-US] Conversations inserted or changed in SDK-owned fields during this update. */
  readonly upserted: ReadonlyArray<ConversationItem>;
  /** [zh-CN] 本次移除的会话标识。 [en-US] Conversation identifiers removed in this update. */
  readonly removed: ReadonlyArray<ConversationIdentifier>;
  /** [zh-CN] 本次受影响的会话 key，格式为 `${conversationType}:${conversationId}`。 [en-US] Affected conversation keys in `${conversationType}:${conversationId}` format. */
  readonly affectedKeys: ReadonlyArray<string>;
  /**
   * [zh-CN] 本次是否改变了会话列表顺序。可能只有排序变化而没有 `upserted` 内容变化，例如置顶、最后消息时间或服务端排序基线变化。按补丁合并的业务在该值为 `true` 时，应按 `items` 中的顺序重排本地列表；直接使用 `items` 的业务无需额外处理。
   * [en-US] Whether the conversation-list order changed. The order may change even when `upserted` is empty, for example due to pinning, last-message time, or server ordering baseline changes. Patch-merging consumers should reorder their local list according to `items` when this is `true`; consumers using `items` directly need no extra handling.
   */
  readonly orderChanged: boolean;
}

/**
 * [zh-CN] `onConversationListUpdate` 事件载荷。`items` 始终是 SDK 当前完整且已排序的 `ConversationItem` 快照；`patch` 用于业务按增量合并并保留自定义本地字段。
 * [en-US] Payload of `onConversationListUpdate`. `items` is always the SDK's current full, ordered `ConversationItem` snapshot; `patch` helps apps merge incrementally while preserving custom local fields.
 */
export interface ConversationListUpdatePayload {
  /** [zh-CN] 会话列表快照版本号，每次有效派发递增，可用于忽略旧事件。 [en-US] Conversation-list snapshot version, incremented for each effective dispatch and useful for ignoring stale events. */
  readonly version: number;
  /** [zh-CN] 当前完整且已排序的会话列表快照。简单 UI 推荐直接用该字段刷新列表。 [en-US] Current full and ordered conversation-list snapshot. Simple UIs are recommended to render this field directly. */
  readonly items: ReadonlyArray<ConversationItem>;
  /** [zh-CN] 本次列表更新原因。 [en-US] Reason for this list update. */
  readonly reason: ConversationListUpdateReason;
  /** [zh-CN] 本次变化补丁，便于业务保留本地字段。 [en-US] Patch for this update, useful for preserving app-local fields. */
  readonly patch: ConversationListUpdatePatch;
}

export interface CacheDump<T> {
  // 缓存落盘结构
  readonly items: ReadonlyArray<T>; // 缓存项列表
} // 缓存落盘结构结束

export interface SessionListCacheRecord extends ConversationItem {
  readonly updatedAt: number;
}

export interface SessionListCheckpoint {
  readonly lastSyncTime: number;
  readonly lastSyncFinishedTs: number;
  readonly sessionsLastSyncTs: number;
  readonly lastSuccessfulAt: number;
}

export interface SessionListStorageRecord {
  readonly items: ReadonlyArray<SessionListCacheRecord>;
  readonly checkpoint?: SessionListCheckpoint;
}

export interface JoinedGroupPreviewStorageRecord {
  readonly items: ReadonlyArray<JoinedGroupSummary>;
  readonly meta: JoinedGroupSnapshotMeta;
}

export interface SessionListCapabilityState {
  readonly status: 'unknown' | 'available' | 'unsupported' | 'unconfigured';
  readonly determinedAt?: number;
  readonly reason?: string;
}
