/**
 * [zh-CN] GroupManager 公共类型定义。
 * [en-US] Public type definitions for GroupManager.
 */

import type { UserInfo } from './user-info';
import type { SessionListRemindType } from './conversation';

export type GroupRole = 'owner' | 'admin' | 'member';

export interface GroupSummary {
  /** [zh-CN] 群组 ID。 [en-US] Group id. */
  readonly groupId: string;
  /** [zh-CN] 群组名称。 [en-US] Group name. */
  readonly name: string;
  /** [zh-CN] 群组描述。 [en-US] Group description. */
  readonly description?: string;
  /** [zh-CN] 当前群成员数量。 [en-US] Current group member count. */
  readonly memberCount?: number;
  /** [zh-CN] 是否为公开群。 [en-US] Whether the group is public. */
  readonly public?: boolean;
  /** [zh-CN] 入群是否需要管理员审批。 [en-US] Whether joining the group requires admin joinApprovalRequired. */
  readonly joinApprovalRequired?: boolean;
  /** [zh-CN] 是否允许普通成员邀请其他用户入群。 [en-US] Whether regular members can invite users to the group. */
  readonly allowInvites?: boolean;
  /** [zh-CN] 群组最大成员数。 [en-US] Maximum group member count. */
  readonly maxMembers?: number;
  /** [zh-CN] 当前用户在群内的角色。 [en-US] Current user's role in the group. */
  readonly role?: GroupRole;
  /** [zh-CN] 群组是否被禁用。 [en-US] Whether the group is disabled. */
  readonly disabled?: boolean;
}

export interface GroupListResult {
  /** [zh-CN] 群组摘要列表。 [en-US] Group summary list. */
  readonly items: ReadonlyArray<GroupSummary>;
  /** [zh-CN] 当前页码。 [en-US] Current page number. */
  readonly pageNum?: number;
  /** [zh-CN] 每页条数。 [en-US] Page size. */
  readonly pageSize?: number;
  /** [zh-CN] 下一页游标。 [en-US] Cursor for the next page. */
  readonly cursor?: string;
  /** [zh-CN] 是否还有下一页。 [en-US] Whether another page is available. */
  readonly hasMore?: boolean;
}

export interface GroupDetail extends GroupSummary {
  /** [zh-CN] 群主资料。 [en-US] Group owner profile. */
  readonly owner?: UserInfo;
  /** [zh-CN] 受邀人入群前是否需要确认邀请。 [en-US] Whether invitees need to accept invitations before joining. */
  readonly inviteNeedConfirm?: boolean;
  /** [zh-CN] 是否开启全员禁言。 [en-US] Whether all-member mute is enabled. */
  readonly muteAllMembers?: boolean;
  /** [zh-CN] 群扩展字段。 [en-US] Group extension payload. */
  readonly ext?: string;
  /** [zh-CN] 群组创建时间戳。 [en-US] Group creation timestamp. */
  readonly createdAt?: number;
  /** [zh-CN] 当前用户入群时间戳。 [en-US] Timestamp when the current user joined the group. */
  readonly joinedAt?: number;
  /** [zh-CN] 群头像 URL。 [en-US] Group avatar URL. */
  readonly avatarUrl?: string;
  /** [zh-CN] 当前用户是否屏蔽该群消息。 [en-US] Whether the current user has blocked messages from this group. */
  readonly messageBlocked?: boolean;
}

/**
 * [zh-CN] 当前用户已加入群组的轻量同步摘要，不等同于完整群详情。
 * [en-US] Lightweight summary of a joined group for the current user; not a full group detail.
 */
export interface JoinedGroupSummary extends GroupSummary {
  /** [zh-CN] 群主用户 ID。 [en-US] Group owner user id. */
  readonly ownerId?: string;
  /** [zh-CN] 群头像 URL。 [en-US] Group avatar URL. */
  readonly avatarUrl?: string;
  /** [zh-CN] 是否开启全员禁言。 [en-US] Whether all-member mute is enabled. */
  readonly muteAllMembers?: boolean;
  /** [zh-CN] 当前用户禁言到期时间戳，0 表示未禁言。 [en-US] Current user's mute expiration timestamp; 0 means not muted. */
  readonly muteExpiration?: number;
  /** [zh-CN] 会话提醒类型。 [en-US] Conversation remind type. */
  readonly remindType?: SessionListRemindType;
  /** [zh-CN] 群创建时间戳。 [en-US] Group creation timestamp. */
  readonly createdAt?: number;
  /** [zh-CN] 群更新时间戳。 [en-US] Group update timestamp. */
  readonly updatedAt?: number;
  /** [zh-CN] 当前用户入群时间戳。 [en-US] Timestamp when the current user joined the group. */
  readonly joinedAt?: number;
}

/**
 * [zh-CN] 本地已加入群组快照完整性状态。
 * [en-US] Integrity state of a local joined-group snapshot.
 */
export type JoinedGroupSnapshotIntegrity =
  | 'preview'
  | 'synced'
  | 'limited'
  | 'incomplete'
  | 'unknown';

/**
 * [zh-CN] 本地已加入群组快照来源。
 * [en-US] Source of a local joined-group snapshot.
 */
export type JoinedGroupSnapshotSource = 'localPreview' | 'sync';

/**
 * [zh-CN] 本地已加入群组快照元信息。
 * [en-US] Metadata of a local joined-group snapshot.
 */
export interface JoinedGroupSnapshotMeta {
  /** [zh-CN] 当前快照完整性。 [en-US] Snapshot integrity. */
  readonly integrity: JoinedGroupSnapshotIntegrity;
  /** [zh-CN] 当前结果是否受服务端上限影响。 [en-US] Whether the result is limited by the server cap. */
  readonly limited: boolean;
  /** [zh-CN] 本地预览存储上限。 [en-US] Local preview storage limit. */
  readonly storageLimit: number;
  /** [zh-CN] 服务端单轮同步上限。 [en-US] Server limit for one sync round. */
  readonly serverLimit: number;
  /** [zh-CN] 快照来源。 [en-US] Snapshot source. */
  readonly source: JoinedGroupSnapshotSource;
  /** [zh-CN] 服务端最终批返回的完成时间。 [en-US] Completion timestamp from the final server batch. */
  readonly lastSyncFinishedTs?: number;
  /** [zh-CN] 最近一次成功同步完成的本地时间。 [en-US] Local timestamp of the last successful sync. */
  readonly lastSuccessfulAt?: number;
  /** [zh-CN] 状态原因。 [en-US] State reason. */
  readonly reason?: string;
}

/**
 * [zh-CN] 本地已加入群组快照。
 * [en-US] Local joined-group snapshot.
 */
export interface JoinedGroupSnapshot {
  /** [zh-CN] 群组轻量摘要列表。 [en-US] Lightweight joined-group summaries. */
  readonly items: ReadonlyArray<JoinedGroupSummary>;
  /** [zh-CN] 快照元信息。 [en-US] Snapshot metadata. */
  readonly meta: JoinedGroupSnapshotMeta;
}

export interface GroupUpdateInfoInput {
  /** [zh-CN] 新群组名称。 [en-US] New group name. */
  readonly name?: string;
  /** [zh-CN] 新群组描述。 [en-US] New group description. */
  readonly description?: string;
  /** [zh-CN] 新群头像地址或标识。 [en-US] New group avatar URL or identifier. */
  readonly avatar?: string;
  /** [zh-CN] 新群扩展字段。 [en-US] New group extension payload. */
  readonly ext?: string;
}

export interface GroupUpdateConfigsInput {
  /** [zh-CN] 是否为公开群。 [en-US] Whether the group is public. */
  readonly public?: boolean;
  /** [zh-CN] 入群是否需要管理员审批。 [en-US] Whether joining requires admin joinApprovalRequired. */
  readonly joinApprovalRequired?: boolean;
  /** [zh-CN] 是否允许普通成员邀请其他用户。 [en-US] Whether regular members can invite other users. */
  readonly allowInvites?: boolean;
  /** [zh-CN] 受邀人入群前是否需要确认邀请。 [en-US] Whether invitees need to accept invitations before joining. */
  readonly inviteNeedConfirm?: boolean;
  /** [zh-CN] 群组最大成员数。 [en-US] Maximum group member count. */
  readonly maxMembers?: number;
}

export interface GroupOwnerChangeInput {
  /** [zh-CN] 新群主用户 ID。 [en-US] New owner user id. */
  readonly newOwner: string;
}

export interface GroupMemberEntry {
  /** [zh-CN] 成员用户资料。 [en-US] Member user profile. */
  readonly user: UserInfo;
  /** [zh-CN] 成员角色。 [en-US] Member role. */
  readonly role?: GroupRole;
  /** [zh-CN] 成员入群时间戳。 [en-US] Timestamp when the member joined the group. */
  readonly joinedAt?: number;
}

export interface GroupMemberListResult {
  /** [zh-CN] 成员列表。 [en-US] Member list. */
  readonly items: ReadonlyArray<GroupMemberEntry>;
  /** [zh-CN] 当前页码。 [en-US] Current page number. */
  readonly pageNum?: number;
  /** [zh-CN] 每页条数。 [en-US] Page size. */
  readonly pageSize?: number;
  /** [zh-CN] 下一页游标。 [en-US] Cursor for the next page. */
  readonly cursor?: string;
  /** [zh-CN] 是否还有下一页。 [en-US] Whether another page is available. */
  readonly hasMore?: boolean;
}

export interface GroupMuteEntry {
  /** [zh-CN] 被禁言成员资料。 [en-US] Muted member profile. */
  readonly user: UserInfo;
  /** [zh-CN] 禁言到期时间戳。 [en-US] Mute expiration timestamp. */
  readonly muteExpire?: number;
  /** [zh-CN] 禁言时长，单位秒。 [en-US] Mute duration in seconds. */
  readonly muteDuration?: number;
}

export interface GroupAllowlistEntry {
  /** [zh-CN] 白名单成员资料。 [en-US] Allowlisted member profile. */
  readonly user: UserInfo;
}

export interface GroupBlocklistEntry {
  /** [zh-CN] 黑名单成员资料。 [en-US] Blocked member profile. */
  readonly user: UserInfo;
}

export interface GroupAnnouncement {
  /** [zh-CN] 群公告内容。 [en-US] Group announcement content. */
  readonly announcement: string;
}

export interface GroupSharedFile {
  /** [zh-CN] 共享文件 ID。 [en-US] Shared file id. */
  readonly fileId: string;
  /** [zh-CN] 文件名。 [en-US] File name. */
  readonly fileName: string;
  /** [zh-CN] 文件上传者资料。 [en-US] File owner profile. */
  readonly fileOwner?: UserInfo;
  /** [zh-CN] 文件大小，单位字节。 [en-US] File size in bytes. */
  readonly fileSize?: number;
  /** [zh-CN] 文件创建时间戳。 [en-US] File creation timestamp. */
  readonly createdAt?: number;
}

export interface GroupSharedFileListResult {
  /** [zh-CN] 共享文件列表。 [en-US] Shared file list. */
  readonly items: ReadonlyArray<GroupSharedFile>;
  /** [zh-CN] 当前页码。 [en-US] Current page number. */
  readonly pageNum?: number;
  /** [zh-CN] 每页条数。 [en-US] Page size. */
  readonly pageSize?: number;
  /** [zh-CN] 下一页游标。 [en-US] Cursor for the next page. */
  readonly cursor?: string;
  /** [zh-CN] 是否还有下一页。 [en-US] Whether another page is available. */
  readonly hasMore?: boolean;
}

export interface CursorPageParams {
  /** [zh-CN] 每页条数。 [en-US] Page size. */
  readonly pageSize?: number;
  /** [zh-CN] 下一页游标。 [en-US] Cursor for the next page. */
  readonly cursor?: string;
}

export interface NumberPageParams {
  /** [zh-CN] 页码。 [en-US] Page number. */
  readonly pageNum?: number;
  /** [zh-CN] 每页条数。 [en-US] Page size. */
  readonly pageSize?: number;
}

export interface GroupUserBatchInput {
  /** [zh-CN] 用户 ID 列表。 [en-US] User id list. */
  readonly userIds: ReadonlyArray<string>;
}

export type GroupMemberListQuery = CursorPageParams;

export type GroupMuteListQuery = NumberPageParams;

export type GroupMuteListParams = GroupMutationTarget & NumberPageParams;

export type GroupBlocklistParams = GroupMutationTarget & NumberPageParams;

export interface GroupMuteMembersInput {
  /** [zh-CN] 待禁言成员 ID 列表。 [en-US] User ids to mute. */
  readonly userIds: ReadonlyArray<string>;
  /** [zh-CN] 禁言时长，单位秒。 [en-US] Mute duration in seconds. */
  readonly muteDuration: number;
}

export interface GroupAnnouncementUpdateInput {
  /** [zh-CN] 新群公告内容。 [en-US] New group announcement content. */
  readonly announcement: string;
}

export type GroupSharedFileListQuery = NumberPageParams;

export interface GetJoinedGroupListParams extends NumberPageParams {
  /** [zh-CN] 是否返回成员数量。 [en-US] Whether to include member counts. */
  readonly needMemberCount?: boolean;
  /** [zh-CN] 是否返回当前用户角色。 [en-US] Whether to include the current user's role. */
  readonly needRole?: boolean;
}

/** @internal */
export interface GetPublicGroupListParams extends CursorPageParams {
  /** [zh-CN] 每页条数别名，兼容旧分页参数。 [en-US] Page-size alias kept for legacy pagination compatibility. */
  readonly limit?: number;
}

export interface GetGroupInfoParams {
  /** [zh-CN] 群组 ID。 [en-US] Group id. */
  readonly groupId: string;
}

export interface GetGroupInfoListParams {
  /** [zh-CN] 群组 ID 列表。 [en-US] Group id list. */
  readonly groupIds: ReadonlyArray<string>;
}

export interface CreateGroupParams {
  /** [zh-CN] 群组名称。 [en-US] Group name. */
  readonly name: string;
  /** [zh-CN] 群组描述。 [en-US] Group description. */
  readonly description: string;
  /** [zh-CN] 初始成员 ID 列表。 [en-US] Initial member id list. */
  readonly memberIds?: ReadonlyArray<string>;
  /** [zh-CN] 是否为公开群。 [en-US] Whether the group is public. */
  readonly public: boolean;
  /** [zh-CN] 入群是否需要管理员审批。 [en-US] Whether joining requires admin joinApprovalRequired. */
  readonly joinApprovalRequired: boolean;
  /** [zh-CN] 是否允许普通成员邀请其他用户入群。 [en-US] Whether regular members can invite other users. */
  readonly allowInvites: boolean;
  /** [zh-CN] 受邀人入群前是否需要确认邀请。 [en-US] Whether invitees need to accept invitations before joining. */
  readonly inviteNeedConfirm: boolean;
  /** [zh-CN] 群组最大成员数。 [en-US] Maximum group member count. */
  readonly maxMembers?: number;
  /** [zh-CN] 群扩展字段。 [en-US] Group extension payload. */
  readonly ext?: string;
  /** [zh-CN] 群头像地址或标识。 [en-US] Group avatar URL or identifier. */
  readonly avatar?: string;
}

export interface CreateGroupResult {
  /** [zh-CN] 创建成功后的群组 ID。 [en-US] Created group id. */
  readonly groupId: string;
}

export interface UpdateGroupInfoParams {
  /** [zh-CN] 群组 ID。 [en-US] Group id. */
  readonly groupId: string;
  /** [zh-CN] 新群组名称。 [en-US] New group name. */
  readonly name?: string;
  /** [zh-CN] 新群组描述。 [en-US] New group description. */
  readonly description?: string;
  /** [zh-CN] 新群头像地址或标识。 [en-US] New group avatar URL or identifier. */
  readonly avatar?: string;
  /** [zh-CN] 是否为公开群。 [en-US] Whether the group is public. */
  readonly public?: boolean;
  /** [zh-CN] 入群是否需要管理员审批。 [en-US] Whether joining requires admin joinApprovalRequired. */
  readonly joinApprovalRequired?: boolean;
  /** [zh-CN] 是否允许普通成员邀请其他用户入群。 [en-US] Whether regular members can invite other users. */
  readonly allowInvites?: boolean;
  /** [zh-CN] 受邀人入群前是否需要确认邀请。 [en-US] Whether invitees need to accept invitations before joining. */
  readonly inviteNeedConfirm?: boolean;
  /** [zh-CN] 群组最大成员数。 [en-US] Maximum group member count. */
  readonly maxMembers?: number;
  /** [zh-CN] 群扩展字段。 [en-US] Group extension payload. */
  readonly ext?: string;
}

export interface GroupMutationTarget {
  /** [zh-CN] 群组 ID。 [en-US] Group id. */
  readonly groupId: string;
}

export interface GroupUserBatchParams extends GroupMutationTarget {
  /** [zh-CN] 用户 ID 列表。 [en-US] User id list. */
  readonly userIds: ReadonlyArray<string>;
}

export interface GroupAdminMutationParams extends GroupMutationTarget {
  /** [zh-CN] 管理员用户 ID。 [en-US] Admin user id. */
  readonly userId: string;
}

export interface GroupOwnerChangeParams extends GroupMutationTarget {
  /** [zh-CN] 新群主用户 ID。 [en-US] New owner user id. */
  readonly newOwner: string;
}

export interface GroupJoinParams extends GroupMutationTarget {
  /** [zh-CN] 入群申请原因或附言。 [en-US] Join request reason or message. */
  readonly message?: string;
}

export interface AcceptGroupJoinRequestParams extends GroupMutationTarget {
  /** [zh-CN] 申请人用户 ID。 [en-US] Applicant user id. */
  readonly userId: string;
}

export interface RejectGroupJoinRequestParams extends GroupMutationTarget {
  /** [zh-CN] 申请人用户 ID。 [en-US] Applicant user id. */
  readonly userId: string;
  /** [zh-CN] 拒绝原因。 [en-US] Rejection reason. */
  readonly reason: string;
}

export interface GroupMuteMembersParams extends GroupMutationTarget {
  /** [zh-CN] 待禁言成员 ID 列表。 [en-US] User ids to mute. */
  readonly userIds: ReadonlyArray<string>;
  /** [zh-CN] 禁言时长，单位秒。 [en-US] Mute duration in seconds. */
  readonly muteDuration: number;
}

export type GroupMemberListParams = GroupMutationTarget & CursorPageParams;

export interface GroupAnnouncementUpdateParams extends GroupMutationTarget {
  /** [zh-CN] 新群公告内容。 [en-US] New group announcement content. */
  readonly announcement: string;
}

export type GroupSharedFileListParams = GroupMutationTarget & NumberPageParams;

export interface UploadGroupSharedFileCallbacks {
  /** [zh-CN] 文件上传进度回调。 [en-US] File upload progress callback. */
  readonly onFileUploadProgress?: (event: ProgressEvent) => void;
  /** [zh-CN] 文件上传完成回调。 [en-US] File upload completion callback. */
  readonly onFileUploadComplete?: (payload: unknown) => void;
  /** [zh-CN] 文件上传失败回调。 [en-US] File upload error callback. */
  readonly onFileUploadError?: (payload: unknown) => void;
  /** [zh-CN] 文件上传取消回调。 [en-US] File upload cancellation callback. */
  readonly onFileUploadCanceled?: () => void;
}

export interface UploadGroupSharedFileParams
  extends GroupMutationTarget, UploadGroupSharedFileCallbacks {
  /** [zh-CN] 待上传文件。 [en-US] File to upload. */
  readonly file: File | Blob | Record<string, unknown>;
}

export interface GroupUploadSharedFileInput extends UploadGroupSharedFileCallbacks {
  /** [zh-CN] 待上传文件。 [en-US] File to upload. */
  readonly file: File | Blob | Record<string, unknown>;
}

export interface DeleteGroupSharedFileParams extends GroupMutationTarget {
  /** [zh-CN] 共享文件 ID。 [en-US] Shared file id. */
  readonly fileId: string;
}

export interface GroupDeleteSharedFileInput {
  /** [zh-CN] 共享文件 ID。 [en-US] Shared file id. */
  readonly fileId: string;
}

export interface DownloadGroupSharedFileCallbacks {
  /** [zh-CN] 文件下载完成回调，参数为 Blob 数据。 [en-US] File download completion callback with Blob data. */
  readonly onFileDownloadComplete?: (data: Blob) => void;
  /** [zh-CN] 文件下载失败回调。 [en-US] File download error callback. */
  readonly onFileDownloadError?: (error: unknown) => void;
}

export interface DownloadGroupSharedFileParams
  extends GroupMutationTarget, DownloadGroupSharedFileCallbacks {
  /** [zh-CN] 共享文件 ID。 [en-US] Shared file id. */
  readonly fileId: string;
  /** [zh-CN] 文件下载密钥。 [en-US] File download secret. */
  readonly secret?: string;
}

export interface GroupDownloadSharedFileInput extends DownloadGroupSharedFileCallbacks {
  /** [zh-CN] 共享文件 ID。 [en-US] Shared file id. */
  readonly fileId: string;
  /** [zh-CN] 文件下载密钥。 [en-US] File download secret. */
  readonly secret?: string;
}

export interface SetGroupMemberAttributesParams extends GroupMutationTarget {
  /** [zh-CN] 成员用户 ID。 [en-US] Member user id. */
  readonly userId: string;
  /** [zh-CN] 成员属性键值对象。 [en-US] Member attribute key-value object. */
  readonly memberAttributes: Readonly<Record<string, string>>;
}

export interface GroupSetMemberAttributesInput {
  /** [zh-CN] 成员用户 ID。 [en-US] Member user id. */
  readonly userId: string;
  /** [zh-CN] 成员属性键值对象。 [en-US] Member attribute key-value object. */
  readonly memberAttributes: Readonly<Record<string, string>>;
}

export interface GetGroupMembersAttributesParams extends GroupMutationTarget {
  /** [zh-CN] 成员用户 ID 列表。 [en-US] Member user id list. */
  readonly userIds: ReadonlyArray<string>;
  /** [zh-CN] 可选属性 key 列表；不传时返回全部属性。 [en-US] Optional attribute keys; returns all attributes when omitted. */
  readonly keys?: ReadonlyArray<string>;
}

export interface GroupGetMembersAttributesInput {
  /** [zh-CN] 成员用户 ID 列表。 [en-US] Member user id list. */
  readonly userIds: ReadonlyArray<string>;
  /** [zh-CN] 可选属性 key 列表；不传时返回全部属性。 [en-US] Optional attribute keys; returns all attributes when omitted. */
  readonly keys?: ReadonlyArray<string>;
}

export interface GroupMembersAttributesResult {
  /** [zh-CN] 按成员用户 ID 索引的属性集合。 [en-US] Attributes indexed by member user id. */
  readonly items: Readonly<Record<string, Readonly<Record<string, string>>>>;
}

export interface GroupInvitationReceivedEventPayload {
  readonly groupId: string;
  readonly groupName?: string;
  readonly inviter?: UserInfo;
  readonly reason?: string;
}

export interface GroupRequestToJoinReceivedEventPayload {
  readonly groupId: string;
  readonly groupName?: string;
  readonly applicant?: UserInfo;
  readonly reason?: string;
}

export interface GroupRequestToJoinAcceptedEventPayload {
  readonly groupId: string;
  readonly groupName?: string;
  readonly accepter?: UserInfo;
}

export interface GroupRequestToJoinDeclinedEventPayload {
  readonly groupId: string;
  readonly groupName?: string;
  readonly decliner?: UserInfo;
  readonly reason?: string;
  readonly applicant?: UserInfo;
}

export interface GroupInvitationAcceptedEventPayload {
  readonly groupId: string;
  readonly invitee?: UserInfo;
  readonly reason?: string;
}

export interface GroupInvitationDeclinedEventPayload {
  readonly groupId: string;
  readonly invitee?: UserInfo;
  readonly reason?: string;
}

export interface GroupUserRemovedEventPayload {
  readonly groupId: string;
  readonly groupName?: string;
}

export interface GroupDestroyedEventPayload {
  readonly groupId: string;
  readonly groupName?: string;
}

export interface GroupAutoAcceptInvitationEventPayload {
  readonly groupId: string;
  readonly inviter?: UserInfo;
  readonly inviteMessage?: string;
}

export interface GroupMuteListAddedEventPayload {
  readonly groupId: string;
  readonly mutes: ReadonlyArray<UserInfo>;
  readonly muteExpire?: number;
}

export interface GroupMuteListRemovedEventPayload {
  readonly groupId: string;
  readonly mutes: ReadonlyArray<UserInfo>;
}

export interface GroupAllowListAddedEventPayload {
  readonly groupId: string;
  readonly allowlist: ReadonlyArray<UserInfo>;
}

export interface GroupAllowListRemovedEventPayload {
  readonly groupId: string;
  readonly allowlist: ReadonlyArray<UserInfo>;
}

export interface GroupAllMemberMuteStateChangedEventPayload {
  readonly groupId: string;
  readonly isMuted: boolean;
}

export interface GroupAdminAddedEventPayload {
  readonly groupId: string;
  readonly administrator?: UserInfo;
}

export interface GroupAdminRemovedEventPayload {
  readonly groupId: string;
  readonly administrator?: UserInfo;
}

export interface GroupOwnerChangedEventPayload {
  readonly groupId: string;
  readonly newOwner?: UserInfo;
  readonly oldOwner?: UserInfo;
}

export interface GroupMembersJoinedEventPayload {
  readonly groupId: string;
  readonly members: ReadonlyArray<UserInfo>;
}

export interface GroupMembersExitedEventPayload {
  readonly groupId: string;
  readonly members: ReadonlyArray<UserInfo>;
}

export interface GroupAnnouncementChangedEventPayload {
  readonly groupId: string;
  readonly announcement: string;
}

export interface GroupSharedFileAddedEventPayload {
  readonly groupId: string;
  readonly sharedFile?: GroupSharedFile;
}

export interface GroupSharedFileDeletedEventPayload {
  readonly groupId: string;
  readonly fileId: string;
}

export interface GroupInfoChangedEventPayload {
  readonly groupId: string;
  readonly groupInfo: GroupDetail;
}

export interface GroupDisabledChangedEventPayload {
  readonly groupId: string;
  readonly groupInfo: GroupDetail;
  readonly disabled: boolean;
}

export interface GroupMemberAttributeChangedEventPayload {
  readonly groupId: string;
  readonly user?: UserInfo;
  readonly attribute: Readonly<Record<string, string>>;
  readonly from?: string;
  readonly source?: 'direct' | 'multiDevice';
}

export interface GroupUserGroupNamecardUpdatedEventPayload {
  readonly groupId: string;
  readonly userId: string;
  readonly namecard: string;
}

export interface GroupManagerListener {
  readonly onUserGroupNamecardUpdated?: (groupId: string, userId: string, namecard: string) => void;
}

/** @internal 群事件原始通知载荷。 */
export interface GroupRawNotifyPayload {
  readonly groupId: string;
  readonly groupName?: string;
  readonly reason?: string;
  readonly inviterId?: string;
  readonly applicantId?: string;
  readonly accepterId?: string;
  readonly declinerId?: string;
  readonly inviteeId?: string;
  readonly administratorId?: string;
  readonly oldOwnerId?: string;
  readonly newOwnerId?: string;
  readonly memberIds?: ReadonlyArray<string>;
  readonly userId?: string;
  readonly userIds?: ReadonlyArray<string>;
  readonly announcement?: string;
  readonly sharedFile?: GroupSharedFile;
  readonly fileId?: string;
  readonly muteExpire?: number;
  readonly isMuted?: boolean;
  readonly attribute?: Readonly<Record<string, string>>;
  readonly from?: string;
  readonly source?: 'direct' | 'multiDevice';
  readonly shouldFetchGroupDetail?: boolean;
  readonly groupPatch?: Partial<GroupDetail>;
  readonly isDisabled?: boolean;
}

/** @internal 群事件原始通知信封。 */
export interface GroupRawNotifyEvent {
  readonly eventName: string;
  readonly payload: GroupRawNotifyPayload;
}
