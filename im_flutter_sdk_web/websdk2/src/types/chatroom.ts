/**
 * [zh-CN] ChatRoomManager 公共类型定义。
 * [en-US] Public type definitions for ChatRoomManager.
 */

import type { CursorPageParams } from './group';
import type { UserInfo } from './user-info';

export const ChatRoomEventName = {
  CHAT_ROOM_DESTROYED: 'onChatRoomDestroyed',
  MEMBERS_JOINED: 'onMembersJoined',
  MEMBERS_EXITED: 'onMembersExited',
  REMOVED_FROM_CHAT_ROOM: 'onRemovedFromChatRoom',
  MUTE_LIST_ADDED: 'onMuteListAdded',
  MUTE_LIST_REMOVED: 'onMuteListRemoved',
  ALLOW_LIST_ADDED: 'onAllowListAdded',
  ALLOW_LIST_REMOVED: 'onAllowListRemoved',
  ALL_MEMBER_MUTE_STATE_CHANGED: 'onAllMemberMuteStateChanged',
  ADMIN_ADDED: 'onAdminAdded',
  ADMIN_REMOVED: 'onAdminRemoved',
  OWNER_CHANGED: 'onOwnerChanged',
  ANNOUNCEMENT_CHANGED: 'onAnnouncementChanged',
  CHAT_ROOM_INFO_CHANGED: 'onChatRoomInfoChanged',
  ATTRIBUTES_UPDATE: 'onAttributesUpdate',
  ATTRIBUTES_REMOVED: 'onAttributesRemoved',
} as const;

/**
 * [zh-CN] 聊天室事件名称。
 * [en-US] Chat room event name.
 */
export type ChatRoomEventName = (typeof ChatRoomEventName)[keyof typeof ChatRoomEventName];

/**
 * [zh-CN] 当前用户在聊天室内的权限类型。
 * [en-US] Permission type of the current user in a chat room.
 */
export type ChatRoomPermissionType = 'owner' | 'admin' | 'member' | 'none';

/**
 * [zh-CN] 聊天室成员角色。
 * [en-US] Chat room member role.
 */
export type ChatRoomRole = 'owner' | 'admin' | 'member';

/**
 * [zh-CN] 聊天室列表中的摘要信息。
 * [en-US] Summary information returned in chat room lists.
 */
export interface ChatRoomSummary {
  /**
   * [zh-CN] 聊天室 ID。
   * [en-US] Chat room ID.
   */
  readonly chatRoomId: string;
  /**
   * [zh-CN] 聊天室名称。
   * [en-US] Chat room name.
   */
  readonly name: string;
  /**
   * [zh-CN] 聊天室所有者资料；SDK 会尽量从缓存或用户资料接口补齐。
   * [en-US] Owner profile; the SDK hydrates it from cache or the user profile API when possible.
   */
  readonly owner?: UserInfo;
  /**
   * [zh-CN] 当前成员数量。
   * [en-US] Current member count.
   */
  readonly memberCount?: number;
  /**
   * [zh-CN] 聊天室是否已禁用。
   * [en-US] Whether the chat room is disabled.
   */
  readonly disabled?: boolean;
}

/**
 * [zh-CN] 聊天室分页列表返回值。
 * [en-US] Paginated chat room list result.
 */
export interface ChatRoomListResult {
  /**
   * [zh-CN] 当前页聊天室摘要列表。
   * [en-US] Chat room summaries in the current page.
   */
  readonly items: ReadonlyArray<ChatRoomSummary>;
  /**
   * [zh-CN] 当前页码，从 1 开始；具体值取决于服务端返回。
   * [en-US] Current page number starting from 1 when returned by the server.
   */
  readonly pageNum?: number;
  /**
   * [zh-CN] 当前页大小。
   * [en-US] Page size of the current result.
   */
  readonly pageSize?: number;
  /**
   * [zh-CN] 服务端返回的总数。
   * [en-US] Total count returned by the server.
   */
  readonly total?: number;
  /**
   * [zh-CN] 是否还有下一页。
   * [en-US] Whether another page may be available.
   */
  readonly hasMore?: boolean;
}

/**
 * [zh-CN] 当前用户在聊天室内的状态。
 * [en-US] Current user's status in a chat room.
 */
export interface ChatRoomCurrentUserStatus {
  /**
   * [zh-CN] 当前用户是否在 allowlist 中。
   * [en-US] Whether the current user is in the allowlist.
   */
  readonly inAllowlist?: boolean;
  /**
   * [zh-CN] 当前用户是否被禁言。
   * [en-US] Whether the current user is muted.
   */
  readonly muted?: boolean;
  /**
   * [zh-CN] 当前用户禁言过期时间。
   * [en-US] Mute expiration timestamp for the current user.
   */
  readonly muteExpireAt?: number;
  /**
   * [zh-CN] 当前用户权限类型。
   * [en-US] Permission type of the current user.
   */
  readonly permissionType?: ChatRoomPermissionType;
}

/**
 * [zh-CN] 聊天室详情。
 * [en-US] Chat room detail.
 */
export interface ChatRoomDetail extends ChatRoomSummary {
  /**
   * [zh-CN] 聊天室描述。
   * [en-US] Chat room description.
   */
  readonly description?: string;
  /**
   * [zh-CN] 聊天室最大成员数。
   * [en-US] Maximum number of members allowed in the chat room.
   */
  readonly maxMembers?: number;
  /**
   * [zh-CN] 聊天室创建时间戳，单位由服务端返回决定。
   * [en-US] Creation timestamp, using the unit returned by the server.
   */
  readonly createdAt?: number;
  /**
   * [zh-CN] 聊天室扩展信息。
   * [en-US] Chat room extension data.
   */
  readonly ext?: string;
  /**
   * [zh-CN] 聊天室公告。
   * [en-US] Chat room announcement.
   */
  readonly announcement?: string;
  /**
   * [zh-CN] 当前用户权限类型。
   * [en-US] Permission type of the current user.
   */
  readonly permissionType?: ChatRoomPermissionType;
  /**
   * [zh-CN] 当前用户在聊天室内的状态快照。
   * [en-US] Current user's status snapshot in the chat room.
   */
  readonly currentUserStatus?: ChatRoomCurrentUserStatus;
}

/**
 * [zh-CN] 页码分页参数。
 * [en-US] Page-number pagination parameters.
 */
export interface ChatRoomPageParams {
  /**
   * [zh-CN] 页码，从 1 开始；未传时使用服务端默认值。
   * [en-US] Page number starting from 1; server default is used when omitted.
   */
  readonly pageNum?: number;
  /**
   * [zh-CN] 每页数量；未传时使用服务端默认值。
   * [en-US] Page size; server default is used when omitted.
   */
  readonly pageSize?: number;
}

export type GetChatRoomListParams = ChatRoomPageParams;

/**
 * [zh-CN] 查询聊天室详情参数。
 * [en-US] Parameters for querying chat room detail.
 */
export interface GetChatRoomInfoParams {
  /**
   * [zh-CN] 聊天室 ID，必填。
   * [en-US] Required chat room ID.
   */
  readonly chatRoomId: string;
}

/**
 * [zh-CN] 更新聊天室信息的输入字段。
 * [en-US] Input fields for updating chat room information.
 */
export interface ChatRoomUpdateInfoInput {
  /**
   * [zh-CN] 新聊天室名称；未传则不修改。
   * [en-US] New chat room name; omitted fields are not changed.
   */
  readonly name?: string;
  /**
   * [zh-CN] 新聊天室描述；未传则不修改。
   * [en-US] New chat room description; omitted fields are not changed.
   */
  readonly description?: string;
  /**
   * [zh-CN] 新最大成员数；未传则不修改。
   * [en-US] New maximum member count; omitted fields are not changed.
   */
  readonly maxMembers?: number;
}

/**
 * [zh-CN] 更新聊天室信息参数。
 * [en-US] Parameters for updating chat room information.
 */
export interface UpdateChatRoomInfoParams extends ChatRoomUpdateInfoInput {
  /**
   * [zh-CN] 聊天室 ID，必填。
   * [en-US] Required chat room ID.
   */
  readonly chatRoomId: string;
}

/**
 * [zh-CN] 聊天室信息更新结果。
 * [en-US] Result of updating chat room information.
 */
export interface ChatRoomUpdateResult {
  /**
   * [zh-CN] 名称是否已更新。
   * [en-US] Whether the name was updated.
   */
  readonly nameUpdated?: boolean;
  /**
   * [zh-CN] 描述是否已更新。
   * [en-US] Whether the description was updated.
   */
  readonly descriptionUpdated?: boolean;
  /**
   * [zh-CN] 最大成员数是否已更新。
   * [en-US] Whether the maximum member count was updated.
   */
  readonly maxMembersUpdated?: boolean;
}

/**
 * [zh-CN] 仅包含聊天室 ID 的通用操作目标。
 * [en-US] Common operation target containing only a chat room ID.
 */
export interface ChatRoomMutationTarget {
  /**
   * [zh-CN] 聊天室 ID，必填。
   * [en-US] Required chat room ID.
   */
  readonly chatRoomId: string;
}

/**
 * [zh-CN] 加入聊天室参数。
 * [en-US] Parameters for joining a chat room.
 */
export interface JoinChatRoomParams extends ChatRoomMutationTarget {
  /**
   * [zh-CN] 加入聊天室时透传给服务端的扩展信息。
   * [en-US] Extension data sent to the server when joining the chat room.
   */
  readonly ext?: string;
  /**
   * [zh-CN] 是否离开当前账号已加入的其他聊天室；未传时由服务端默认策略决定。
   * [en-US] Whether to leave other joined chat rooms; server default applies when omitted.
   */
  readonly leaveOtherRooms?: boolean;
}

/**
 * [zh-CN] 批量用户操作输入。
 * [en-US] Input for batch user operations.
 */
export interface ChatRoomUserBatchInput {
  /**
   * [zh-CN] 用户 ID 列表，必填且至少包含一个有效用户 ID。
   * [en-US] Required user ID list with at least one valid user ID.
   */
  readonly userIds: ReadonlyArray<string>;
}

/**
 * [zh-CN] 带聊天室 ID 的批量用户操作参数。
 * [en-US] Batch user operation parameters with a chat room ID.
 */
export interface ChatRoomUserBatchParams extends ChatRoomMutationTarget {
  /**
   * [zh-CN] 用户 ID 列表，必填且至少包含一个有效用户 ID。
   * [en-US] Required user ID list with at least one valid user ID.
   */
  readonly userIds: ReadonlyArray<string>;
}

/**
 * [zh-CN] 单个管理员操作输入。
 * [en-US] Input for a single administrator operation.
 */
export interface ChatRoomAdminInput {
  /**
   * [zh-CN] 目标用户 ID，必填。
   * [en-US] Required target user ID.
   */
  readonly userId: string;
}

/**
 * [zh-CN] 带聊天室 ID 的管理员操作参数。
 * [en-US] Administrator operation parameters with a chat room ID.
 */
export interface ChatRoomAdminParams extends ChatRoomMutationTarget {
  /**
   * [zh-CN] 目标用户 ID，必填。
   * [en-US] Required target user ID.
   */
  readonly userId: string;
}

/**
 * [zh-CN] 聊天室成员条目。
 * [en-US] Chat room member entry.
 */
export interface ChatRoomMemberEntry {
  /**
   * [zh-CN] 成员用户资料。
   * [en-US] Member user profile.
   */
  readonly user: UserInfo;
  /**
   * [zh-CN] 成员角色。
   * [en-US] Member role.
   */
  readonly role?: ChatRoomRole;
  /**
   * [zh-CN] 成员加入时间戳。
   * [en-US] Timestamp when the member joined.
   */
  readonly joinedAt?: number;
}

export type ChatRoomMemberListQuery = CursorPageParams;

/**
 * [zh-CN] 聊天室成员列表查询参数。
 * [en-US] Parameters for querying chat room members.
 */
export interface ChatRoomMemberListParams extends ChatRoomMutationTarget, CursorPageParams {}

/**
 * [zh-CN] 聊天室成员列表返回值。
 * [en-US] Chat room member list result.
 */
export interface ChatRoomMemberListResult {
  /**
   * [zh-CN] 成员条目列表。
   * [en-US] Member entries.
   */
  readonly items: ReadonlyArray<ChatRoomMemberEntry>;
  /**
   * [zh-CN] 下一页游标；为空表示服务端未返回游标。
   * [en-US] Cursor for the next page; empty when the server does not return one.
   */
  readonly cursor?: string;
  /**
   * [zh-CN] 是否还有下一页。
   * [en-US] Whether another page may be available.
   */
  readonly hasMore?: boolean;
}

/**
 * [zh-CN] 单个成员操作结果。
 * [en-US] Result of a single member operation.
 */
export interface ChatRoomMemberActionResult {
  /**
   * [zh-CN] 聊天室 ID。
   * [en-US] Chat room ID.
   */
  readonly chatRoomId: string;
  /**
   * [zh-CN] 目标用户资料。
   * [en-US] Target user profile.
   */
  readonly user: UserInfo;
  /**
   * [zh-CN] 操作名称。
   * [en-US] Operation name.
   */
  readonly action: string;
  /**
   * [zh-CN] 失败原因；仅失败时可能返回。
   * [en-US] Failure reason, returned only when the operation fails.
   */
  readonly reason?: string;
}

/**
 * [zh-CN] 批量成员操作结果。
 * [en-US] Result of a batch member operation.
 */
export interface ChatRoomMemberActionListResult {
  /**
   * [zh-CN] 操作成功的目标用户结果。
   * [en-US] Target user results that succeeded.
   */
  readonly succeeded: ReadonlyArray<ChatRoomMemberActionResult>;
  /**
   * [zh-CN] 操作失败的目标用户结果。
   * [en-US] Target user results that failed.
   */
  readonly failed: ReadonlyArray<ChatRoomMemberActionResult>;
}

/**
 * [zh-CN] 禁言列表条目。
 * [en-US] Mute list entry.
 */
export interface ChatRoomMuteEntry {
  /**
   * [zh-CN] 被禁言用户资料。
   * [en-US] Muted user profile.
   */
  readonly user: UserInfo;
  /**
   * [zh-CN] 禁言过期时间。
   * [en-US] Mute expiration timestamp.
   */
  readonly muteExpire?: number;
  /**
   * [zh-CN] 禁言时长，单位通常为秒，具体以服务端返回为准。
   * [en-US] Mute duration, usually in seconds, depending on server response.
   */
  readonly duration?: number;
}

/**
 * [zh-CN] 禁言成员输入。
 * [en-US] Input for muting members.
 */
export interface ChatRoomMuteMembersInput {
  /**
   * [zh-CN] 待禁言用户 ID 列表，必填。
   * [en-US] Required user IDs to mute.
   */
  readonly userIds: ReadonlyArray<string>;
  /**
   * [zh-CN] 禁言时长，单位为秒。
   * [en-US] Mute duration in seconds.
   */
  readonly duration: number;
}

/**
 * [zh-CN] 带聊天室 ID 的禁言成员参数。
 * [en-US] Parameters for muting members with a chat room ID.
 */
export interface ChatRoomMuteMembersParams extends ChatRoomMutationTarget {
  /**
   * [zh-CN] 待禁言用户 ID 列表，必填。
   * [en-US] Required user IDs to mute.
   */
  readonly userIds: ReadonlyArray<string>;
  /**
   * [zh-CN] 禁言时长，单位为秒。
   * [en-US] Mute duration in seconds.
   */
  readonly duration: number;
}

/**
 * [zh-CN] 当前用户禁言状态。
 * [en-US] Mute status of the current user.
 */
export interface ChatRoomMuteStatus {
  /**
   * [zh-CN] 当前用户是否被禁言。
   * [en-US] Whether the current user is muted.
   */
  readonly muted: boolean;
  /**
   * [zh-CN] 禁言过期时间。
   * [en-US] Mute expiration timestamp.
   */
  readonly muteExpireAt?: number;
}

/**
 * [zh-CN] 禁言列表查询参数。
 * [en-US] Parameters for querying the mute list.
 */
export interface ChatRoomMuteListParams extends ChatRoomMutationTarget, ChatRoomPageParams {}

/**
 * [zh-CN] allowlist 条目。
 * [en-US] Allowlist entry.
 */
export interface ChatRoomAllowlistEntry {
  /**
   * [zh-CN] allowlist 用户资料。
   * [en-US] Allowlisted user profile.
   */
  readonly user: UserInfo;
}

/**
 * [zh-CN] 黑名单条目。
 * [en-US] Blocklist entry.
 */
export interface ChatRoomBlocklistEntry {
  /**
   * [zh-CN] 黑名单用户资料。
   * [en-US] Blocked user profile.
   */
  readonly user: UserInfo;
}

/**
 * [zh-CN] 黑名单分页查询参数。
 * [en-US] Parameters for querying the blocklist.
 */
export interface ChatRoomBlocklistParams extends ChatRoomMutationTarget, ChatRoomPageParams {}

/**
 * [zh-CN] 聊天室公告。
 * [en-US] Chat room announcement.
 */
export interface ChatRoomAnnouncement {
  /**
   * [zh-CN] 公告内容。
   * [en-US] Announcement content.
   */
  readonly announcement: string;
}

/**
 * [zh-CN] 更新公告输入。
 * [en-US] Input for updating the announcement.
 */
export interface ChatRoomAnnouncementUpdateInput {
  /**
   * [zh-CN] 新公告内容，必填。
   * [en-US] Required new announcement content.
   */
  readonly announcement: string;
}

/**
 * [zh-CN] 带聊天室 ID 的更新公告参数。
 * [en-US] Announcement update parameters with a chat room ID.
 */
export interface ChatRoomAnnouncementUpdateParams
  extends ChatRoomMutationTarget, ChatRoomAnnouncementUpdateInput {}

/**
 * [zh-CN] 聊天室共享文件条目。
 * [en-US] Chat room shared file entry.
 */
export interface ChatRoomSharedFile {
  /**
   * [zh-CN] 文件 ID。
   * [en-US] File ID.
   */
  readonly fileId: string;
  /**
   * [zh-CN] 文件名。
   * [en-US] File name.
   */
  readonly fileName: string;
  /**
   * [zh-CN] 文件上传者资料。
   * [en-US] File owner profile.
   */
  readonly fileOwner?: UserInfo;
  /**
   * [zh-CN] 文件大小，单位为字节。
   * [en-US] File size in bytes.
   */
  readonly fileSize?: number;
  /**
   * [zh-CN] 文件创建时间戳。
   * [en-US] File creation timestamp.
   */
  readonly createdAt?: number;
}

export type ChatRoomSharedFileListQuery = ChatRoomPageParams;

/**
 * [zh-CN] 聊天室共享文件列表查询参数。
 * [en-US] Parameters for querying chat room shared files.
 */
export interface ChatRoomSharedFileListParams extends ChatRoomMutationTarget, ChatRoomPageParams {}

/**
 * [zh-CN] 聊天室共享文件列表返回值。
 * [en-US] Chat room shared file list result.
 */
export interface ChatRoomSharedFileListResult {
  /**
   * [zh-CN] 共享文件列表。
   * [en-US] Shared file entries.
   */
  readonly items: ReadonlyArray<ChatRoomSharedFile>;
  /**
   * [zh-CN] 当前页码。
   * [en-US] Current page number.
   */
  readonly pageNum?: number;
  /**
   * [zh-CN] 当前页大小。
   * [en-US] Current page size.
   */
  readonly pageSize?: number;
  /**
   * [zh-CN] 下一页游标。
   * [en-US] Cursor for the next page.
   */
  readonly cursor?: string;
  /**
   * [zh-CN] 是否还有下一页。
   * [en-US] Whether another page may be available.
   */
  readonly hasMore?: boolean;
}

/**
 * [zh-CN] 删除共享文件输入。
 * [en-US] Input for deleting a shared file.
 */
export interface ChatRoomDeleteSharedFileInput {
  /**
   * [zh-CN] 文件 ID，必填。
   * [en-US] Required file ID.
   */
  readonly fileId: string;
}

/**
 * [zh-CN] 带聊天室 ID 的删除共享文件参数。
 * [en-US] Shared file deletion parameters with a chat room ID.
 */
export interface DeleteChatRoomSharedFileParams extends ChatRoomMutationTarget {
  /**
   * [zh-CN] 文件 ID，必填。
   * [en-US] Required file ID.
   */
  readonly fileId: string;
}

/**
 * [zh-CN] 查询聊天室属性输入。
 * [en-US] Input for querying chat room attributes.
 */
export interface GetChatRoomAttributesInput {
  /**
   * [zh-CN] 指定要查询的属性 key；未传时查询全部属性。
   * [en-US] Attribute keys to query; all attributes are returned when omitted.
   */
  readonly keys?: ReadonlyArray<string>;
}

/**
 * [zh-CN] 带聊天室 ID 的查询属性参数。
 * [en-US] Attribute query parameters with a chat room ID.
 */
export interface GetChatRoomAttributesParams extends ChatRoomMutationTarget {
  /**
   * [zh-CN] 指定要查询的属性 key；未传时查询全部属性。
   * [en-US] Attribute keys to query; all attributes are returned when omitted.
   */
  readonly keys?: ReadonlyArray<string>;
}

/**
 * [zh-CN] 设置聊天室属性输入。
 * [en-US] Input for setting chat room attributes.
 */
export interface SetChatRoomAttributesInput {
  /**
   * [zh-CN] 要设置的属性键值对，key/value 均必须为字符串。
   * [en-US] Attribute key-value map to set; both keys and values must be strings.
   */
  readonly attributes: Readonly<Record<string, string>>;
  /**
   * [zh-CN] 成员退出聊天室时是否自动删除其设置的属性。默认 `true`。
   * [en-US] Whether to auto-delete attributes set by the member when they leave. Defaults to `true`.
   */
  readonly autoDelete?: boolean;
  /**
   * [zh-CN] 是否允许覆盖其他成员设置的属性。默认 `false`。
   * [en-US] Whether to allow overwriting attributes set by other members. Defaults to `false`.
   */
  readonly isForced?: boolean;
}

/**
 * [zh-CN] 带聊天室 ID 的设置属性参数。
 * [en-US] Attribute set parameters with a chat room ID.
 */
export interface SetChatRoomAttributesParams extends ChatRoomMutationTarget {
  /**
   * [zh-CN] 要设置的属性键值对，key/value 均必须为字符串。
   * [en-US] Attribute key-value map to set; both keys and values must be strings.
   */
  readonly attributes: Readonly<Record<string, string>>;
  /**
   * [zh-CN] 成员退出聊天室时是否自动删除其设置的属性。默认 `true`。
   * [en-US] Whether to auto-delete attributes set by the member when they leave. Defaults to `true`.
   */
  readonly autoDelete?: boolean;
  /**
   * [zh-CN] 是否允许覆盖其他成员设置的属性。默认 `false`。
   * [en-US] Whether to allow overwriting attributes set by other members. Defaults to `false`.
   */
  readonly isForced?: boolean;
}

/**
 * [zh-CN] 删除聊天室属性输入。
 * [en-US] Input for removing chat room attributes.
 */
export interface RemoveChatRoomAttributesInput {
  /**
   * [zh-CN] 要删除的属性 key 列表，必填。
   * [en-US] Required attribute keys to remove.
   */
  readonly keys: ReadonlyArray<string>;
  /**
   * [zh-CN] 是否允许删除其他成员设置的属性。默认 `false`。
   * [en-US] Whether to allow removing attributes set by other members. Defaults to `false`.
   */
  readonly isForced?: boolean;
}

/**
 * [zh-CN] 带聊天室 ID 的删除属性参数。
 * [en-US] Attribute removal parameters with a chat room ID.
 */
export interface RemoveChatRoomAttributesParams extends ChatRoomMutationTarget {
  /**
   * [zh-CN] 要删除的属性 key 列表，必填。
   * [en-US] Required attribute keys to remove.
   */
  readonly keys: ReadonlyArray<string>;
  /**
   * [zh-CN] 是否允许删除其他成员设置的属性。默认 `false`。
   * [en-US] Whether to allow removing attributes set by other members. Defaults to `false`.
   */
  readonly isForced?: boolean;
}

/**
 * [zh-CN] 聊天室属性快照。
 * [en-US] Chat room attributes snapshot.
 */
export interface ChatRoomAttributesSnapshot {
  /**
   * [zh-CN] 聊天室 ID。
   * [en-US] Chat room ID.
   */
  readonly chatRoomId: string;
  /**
   * [zh-CN] 属性键值对。
   * [en-US] Attribute key-value map.
   */
  readonly attributes: Readonly<Record<string, string>>;
}

/**
 * [zh-CN] 聊天室属性批量变更结果。
 * [en-US] Result of mutating chat room attributes.
 */
export interface ChatRoomAttributeMutationResult {
  /**
   * [zh-CN] 聊天室 ID。
   * [en-US] Chat room ID.
   */
  readonly chatRoomId: string;
  /**
   * [zh-CN] 已成功应用的属性 key。
   * [en-US] Attribute keys that were applied successfully.
   */
  readonly appliedKeys: ReadonlyArray<string>;
  /**
   * [zh-CN] 设置或删除失败的属性 key 到错误信息的映射。
   * [en-US] Map from failed attribute key to error details.
   */
  readonly failedKeys: Readonly<
    Record<string, { readonly code: number; readonly message: string }>
  >;
}

/**
 * [zh-CN] 聊天室被销毁事件载荷。
 * [en-US] Payload for the chat room destroyed event.
 */
export interface ChatRoomDestroyedEventPayload {
  /**
   * [zh-CN] 聊天室 ID。
   * [en-US] Chat room ID.
   */
  readonly chatRoomId: string;
  /**
   * [zh-CN] 聊天室名称。
   * [en-US] Chat room name.
   */
  readonly chatRoomName?: string;
}

/**
 * [zh-CN] 成员加入聊天室事件载荷。
 * [en-US] Payload for the members joined event.
 */
export interface ChatRoomMembersJoinedEventPayload {
  /**
   * [zh-CN] 聊天室 ID。
   * [en-US] Chat room ID.
   */
  readonly chatRoomId: string;
  /**
   * [zh-CN] 聊天室名称。
   * [en-US] Chat room name.
   */
  readonly chatRoomName?: string;
  /**
   * [zh-CN] 加入聊天室的成员列表。
   * [en-US] Members that joined the chat room.
   */
  readonly members: ReadonlyArray<UserInfo>;
  /**
   * [zh-CN] 加入时透传的扩展信息。
   * [en-US] Extension data sent with the join operation.
   */
  readonly ext?: string;
}

/**
 * [zh-CN] 成员退出聊天室事件载荷。
 * [en-US] Payload for the members exited event.
 */
export interface ChatRoomMembersExitedEventPayload {
  /**
   * [zh-CN] 聊天室 ID。
   * [en-US] Chat room ID.
   */
  readonly chatRoomId: string;
  /**
   * [zh-CN] 聊天室名称。
   * [en-US] Chat room name.
   */
  readonly chatRoomName?: string;
  /**
   * [zh-CN] 退出聊天室的成员列表。
   * [en-US] Members that exited the chat room.
   */
  readonly members: ReadonlyArray<UserInfo>;
}

/**
 * [zh-CN] 当前用户被移出聊天室事件载荷。
 * [en-US] Payload for the current user removed from chat room event.
 */
export interface ChatRoomRemovedFromChatRoomEventPayload {
  /**
   * [zh-CN] 被移出的原因码。
   * [en-US] Reason code for the removal.
   */
  readonly reason: number;
  /**
   * [zh-CN] 聊天室 ID。
   * [en-US] Chat room ID.
   */
  readonly chatRoomId: string;
  /**
   * [zh-CN] 聊天室名称。
   * [en-US] Chat room name.
   */
  readonly chatRoomName?: string;
  /**
   * [zh-CN] 触发移除的参与者资料。
   * [en-US] Participant profile related to the removal.
   */
  readonly participant?: UserInfo;
}

/**
 * [zh-CN] 聊天室禁言列表新增事件载荷。
 * [en-US] Payload for the mute list added event.
 */
export interface ChatRoomMuteListAddedEventPayload {
  /**
   * [zh-CN] 聊天室 ID。
   * [en-US] Chat room ID.
   */
  readonly chatRoomId: string;
  /**
   * [zh-CN] 新增的禁言条目。
   * [en-US] Newly muted entries.
   */
  readonly mutes: ReadonlyArray<ChatRoomMuteEntry>;
  /**
   * [zh-CN] 禁言过期时间。
   * [en-US] Mute expiration timestamp.
   */
  readonly muteExpire?: number;
}

/**
 * [zh-CN] 聊天室禁言列表移除事件载荷。
 * [en-US] Payload for the mute list removed event.
 */
export interface ChatRoomMuteListRemovedEventPayload {
  /**
   * [zh-CN] 聊天室 ID。
   * [en-US] Chat room ID.
   */
  readonly chatRoomId: string;
  /**
   * [zh-CN] 解除禁言的用户资料列表。
   * [en-US] User profiles removed from the mute list.
   */
  readonly mutes: ReadonlyArray<UserInfo>;
}

/**
 * [zh-CN] 聊天室 allowlist 新增事件载荷。
 * [en-US] Payload for the allowlist added event.
 */
export interface ChatRoomAllowListAddedEventPayload {
  /**
   * [zh-CN] 聊天室 ID。
   * [en-US] Chat room ID.
   */
  readonly chatRoomId: string;
  /**
   * [zh-CN] 新增到 allowlist 的用户资料。
   * [en-US] User profiles added to the allowlist.
   */
  readonly allowlist: ReadonlyArray<UserInfo>;
}

/**
 * [zh-CN] 聊天室 allowlist 移除事件载荷。
 * [en-US] Payload for the allowlist removed event.
 */
export interface ChatRoomAllowListRemovedEventPayload {
  /**
   * [zh-CN] 聊天室 ID。
   * [en-US] Chat room ID.
   */
  readonly chatRoomId: string;
  /**
   * [zh-CN] 从 allowlist 移除的用户资料。
   * [en-US] User profiles removed from the allowlist.
   */
  readonly allowlist: ReadonlyArray<UserInfo>;
}

/**
 * [zh-CN] 聊天室全员禁言状态变更事件载荷。
 * [en-US] Payload for the all-member mute state changed event.
 */
export interface ChatRoomAllMemberMuteStateChangedEventPayload {
  /**
   * [zh-CN] 聊天室 ID。
   * [en-US] Chat room ID.
   */
  readonly chatRoomId: string;
  /**
   * [zh-CN] 当前是否已开启全员禁言。
   * [en-US] Whether all-member mute is currently enabled.
   */
  readonly isMuted: boolean;
}

/**
 * [zh-CN] 聊天室管理员新增事件载荷。
 * [en-US] Payload for the administrator added event.
 */
export interface ChatRoomAdminAddedEventPayload {
  /**
   * [zh-CN] 聊天室 ID。
   * [en-US] Chat room ID.
   */
  readonly chatRoomId: string;
  /**
   * [zh-CN] 新增管理员资料。
   * [en-US] Newly added administrator profile.
   */
  readonly admin?: UserInfo;
}

/**
 * [zh-CN] 聊天室管理员移除事件载荷。
 * [en-US] Payload for the administrator removed event.
 */
export interface ChatRoomAdminRemovedEventPayload {
  /**
   * [zh-CN] 聊天室 ID。
   * [en-US] Chat room ID.
   */
  readonly chatRoomId: string;
  /**
   * [zh-CN] 被移除管理员资料。
   * [en-US] Removed administrator profile.
   */
  readonly admin?: UserInfo;
}

/**
 * [zh-CN] 聊天室所有者变更事件载荷。
 * [en-US] Payload for the owner changed event.
 */
export interface ChatRoomOwnerChangedEventPayload {
  /**
   * [zh-CN] 聊天室 ID。
   * [en-US] Chat room ID.
   */
  readonly chatRoomId: string;
  /**
   * [zh-CN] 新所有者资料。
   * [en-US] New owner profile.
   */
  readonly newOwner?: UserInfo;
  /**
   * [zh-CN] 原所有者资料。
   * [en-US] Previous owner profile.
   */
  readonly oldOwner?: UserInfo;
}

/**
 * [zh-CN] 聊天室公告变更事件载荷。
 * [en-US] Payload for the announcement changed event.
 */
export interface ChatRoomAnnouncementChangedEventPayload {
  /**
   * [zh-CN] 聊天室 ID。
   * [en-US] Chat room ID.
   */
  readonly chatRoomId: string;
  /**
   * [zh-CN] 最新公告内容。
   * [en-US] Latest announcement content.
   */
  readonly announcement: string;
}

/**
 * [zh-CN] 聊天室信息变更事件载荷。
 * [en-US] Payload for the chat room information changed event.
 */
export interface ChatRoomInfoChangedEventPayload {
  /**
   * [zh-CN] 聊天室 ID。
   * [en-US] Chat room ID.
   */
  readonly chatRoomId: string;
  /**
   * [zh-CN] 最新聊天室详情。
   * [en-US] Latest chat room detail.
   */
  readonly chatRoomInfo: ChatRoomDetail;
}

/**
 * [zh-CN] 聊天室属性更新事件载荷。
 * [en-US] Payload for the attributes update event.
 */
export interface ChatRoomAttributesUpdateEventPayload {
  /**
   * [zh-CN] 聊天室 ID。
   * [en-US] Chat room ID.
   */
  readonly chatRoomId: string;
  /**
   * [zh-CN] 更新后的属性键值对。
   * [en-US] Updated attribute key-value map.
   */
  readonly attributes: Readonly<Record<string, string>>;
  /**
   * [zh-CN] 触发更新的用户资料。
   * [en-US] User profile that triggered the update.
   */
  readonly from?: UserInfo;
}

/**
 * [zh-CN] 聊天室属性删除事件载荷。
 * [en-US] Payload for the attributes removed event.
 */
export interface ChatRoomAttributesRemovedEventPayload {
  /**
   * [zh-CN] 聊天室 ID。
   * [en-US] Chat room ID.
   */
  readonly chatRoomId: string;
  /**
   * [zh-CN] 被删除的属性 key 列表。
   * [en-US] Removed attribute keys.
   */
  readonly keyList: ReadonlyArray<string>;
  /**
   * [zh-CN] 触发删除的用户资料。
   * [en-US] User profile that triggered the removal.
   */
  readonly from?: UserInfo;
}

/**
 * [zh-CN] 聊天室事件名到载荷类型的映射。
 * [en-US] Mapping from chat room event names to payload types.
 */
export interface ChatRoomEventPayloadMap {
  /**
   * [zh-CN] 聊天室被销毁事件载荷。
   * [en-US] Payload for the chat room destroyed event.
   */
  readonly onChatRoomDestroyed: ChatRoomDestroyedEventPayload;
  /**
   * [zh-CN] 成员加入聊天室事件载荷。
   * [en-US] Payload for the members joined event.
   */
  readonly onMembersJoined: ChatRoomMembersJoinedEventPayload;
  /**
   * [zh-CN] 成员退出聊天室事件载荷。
   * [en-US] Payload for the members exited event.
   */
  readonly onMembersExited: ChatRoomMembersExitedEventPayload;
  /**
   * [zh-CN] 当前用户被移出聊天室事件载荷。
   * [en-US] Payload for the removed from chat room event.
   */
  readonly onRemovedFromChatRoom: ChatRoomRemovedFromChatRoomEventPayload;
  /**
   * [zh-CN] 禁言列表新增事件载荷。
   * [en-US] Payload for the mute list added event.
   */
  readonly onMuteListAdded: ChatRoomMuteListAddedEventPayload;
  /**
   * [zh-CN] 禁言列表移除事件载荷。
   * [en-US] Payload for the mute list removed event.
   */
  readonly onMuteListRemoved: ChatRoomMuteListRemovedEventPayload;
  /**
   * [zh-CN] allowlist 新增事件载荷。
   * [en-US] Payload for the allowlist added event.
   */
  readonly onAllowListAdded: ChatRoomAllowListAddedEventPayload;
  /**
   * [zh-CN] allowlist 移除事件载荷。
   * [en-US] Payload for the allowlist removed event.
   */
  readonly onAllowListRemoved: ChatRoomAllowListRemovedEventPayload;
  /**
   * [zh-CN] 全员禁言状态变更事件载荷。
   * [en-US] Payload for the all-member mute state changed event.
   */
  readonly onAllMemberMuteStateChanged: ChatRoomAllMemberMuteStateChangedEventPayload;
  /**
   * [zh-CN] 管理员新增事件载荷。
   * [en-US] Payload for the administrator added event.
   */
  readonly onAdminAdded: ChatRoomAdminAddedEventPayload;
  /**
   * [zh-CN] 管理员移除事件载荷。
   * [en-US] Payload for the administrator removed event.
   */
  readonly onAdminRemoved: ChatRoomAdminRemovedEventPayload;
  /**
   * [zh-CN] 所有者变更事件载荷。
   * [en-US] Payload for the owner changed event.
   */
  readonly onOwnerChanged: ChatRoomOwnerChangedEventPayload;
  /**
   * [zh-CN] 公告变更事件载荷。
   * [en-US] Payload for the announcement changed event.
   */
  readonly onAnnouncementChanged: ChatRoomAnnouncementChangedEventPayload;
  /**
   * [zh-CN] 聊天室信息变更事件载荷。
   * [en-US] Payload for the chat room information changed event.
   */
  readonly onChatRoomInfoChanged: ChatRoomInfoChangedEventPayload;
  /**
   * [zh-CN] 属性更新事件载荷。
   * [en-US] Payload for the attributes update event.
   */
  readonly onAttributesUpdate: ChatRoomAttributesUpdateEventPayload;
  /**
   * [zh-CN] 属性删除事件载荷。
   * [en-US] Payload for the attributes removed event.
   */
  readonly onAttributesRemoved: ChatRoomAttributesRemovedEventPayload;
}

export type ChatRoomEventHandlerMap = Partial<{
  [K in keyof ChatRoomEventPayloadMap]: (
    payload: ChatRoomEventPayloadMap[K]
  ) => void | Promise<void>;
}>;

/**
 * @internal
 * [zh-CN] 聊天室原始通知载荷。
 * [en-US] Raw chat room notification payload.
 */
export interface ChatRoomRawNotifyPayload {
  /** [zh-CN] 聊天室 ID。 [en-US] Chat room ID. */
  readonly chatRoomId: string;
  /** [zh-CN] 聊天室名称。 [en-US] Chat room name. */
  readonly chatRoomName?: string;
  /** [zh-CN] 原始原因文本。 [en-US] Raw reason text. */
  readonly reason?: string;
  /** [zh-CN] 原始原因码。 [en-US] Raw reason code. */
  readonly reasonCode?: number;
  /** [zh-CN] 参与者用户 ID。 [en-US] Participant user ID. */
  readonly participantId?: string;
  /** [zh-CN] 成员用户 ID。 [en-US] Member user ID. */
  readonly memberId?: string;
  /** [zh-CN] 成员用户 ID 列表。 [en-US] Member user ID list. */
  readonly memberIds?: ReadonlyArray<string>;
  /** [zh-CN] 用户 ID 列表。 [en-US] User ID list. */
  readonly userIds?: ReadonlyArray<string>;
  /** [zh-CN] 管理员用户 ID。 [en-US] Administrator user ID. */
  readonly adminId?: string;
  /** [zh-CN] 原所有者用户 ID。 [en-US] Previous owner user ID. */
  readonly oldOwnerId?: string;
  /** [zh-CN] 新所有者用户 ID。 [en-US] New owner user ID. */
  readonly newOwnerId?: string;
  /** [zh-CN] 公告内容。 [en-US] Announcement content. */
  readonly announcement?: string;
  /** [zh-CN] 禁言过期时间。 [en-US] Mute expiration timestamp. */
  readonly muteExpire?: number;
  /** [zh-CN] 用户 ID 到禁言过期时间的映射。 [en-US] Map from user ID to mute expiration timestamp. */
  readonly muteMembers?: Readonly<Record<string, number>>;
  /** [zh-CN] 是否已开启全员禁言。 [en-US] Whether all-member mute is enabled. */
  readonly isMuted?: boolean;
  /** [zh-CN] 扩展信息。 [en-US] Extension data. */
  readonly ext?: string;
  /** [zh-CN] 事件来源用户 ID。 [en-US] Source user ID of the event. */
  readonly from?: string;
  /** [zh-CN] 属性键值对。 [en-US] Attribute key-value map. */
  readonly attributes?: Readonly<Record<string, string>>;
  /** [zh-CN] 属性 key 列表。 [en-US] Attribute key list. */
  readonly keyList?: ReadonlyArray<string>;
  /** [zh-CN] 是否需要补拉聊天室详情。 [en-US] Whether chat room detail should be fetched. */
  readonly shouldFetchChatRoomDetail?: boolean;
  /** [zh-CN] 原始通知中携带的聊天室详情补丁。 [en-US] Chat room detail patch carried by the raw notification. */
  readonly chatRoomPatch?: Partial<ChatRoomDetail>;
}

/**
 * @internal
 * [zh-CN] 聊天室原始通知信封。
 * [en-US] Raw chat room notification envelope.
 */
export interface ChatRoomRawNotifyEvent {
  /** [zh-CN] 聊天室事件名称。 [en-US] Chat room event name. */
  readonly eventName: ChatRoomEventName;
  /** [zh-CN] 原始通知载荷。 [en-US] Raw notification payload. */
  readonly payload: ChatRoomRawNotifyPayload;
}
