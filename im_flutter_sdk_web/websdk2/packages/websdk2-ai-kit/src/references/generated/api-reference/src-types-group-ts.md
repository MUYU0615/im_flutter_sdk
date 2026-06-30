---
id: generated/api-reference/src-types-group-ts
title: websdk2 API Reference - 群组类型
description: 来自 docs/reference/api-reference.zh-CN.md 的 src/types/group.ts API Reference 分段。
---

## src/types/group.ts

### GroupSummary

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | 群组 ID。 |
| name | `string` | 群组名称。 |
| description | `string` | 群组描述。 |
| memberCount | `number` | 当前群成员数量。 |
| public | `boolean` | 是否为公开群。 |
| joinApprovalRequired | `boolean` | 入群是否需要管理员审批。 |
| allowInvites | `boolean` | 是否允许普通成员邀请其他用户入群。 |
| maxMembers | `number` | 群组最大成员数。 |
| role | `GroupRole` | 当前用户在群内的角色。 |
| disabled | `boolean` | 群组是否被禁用。 |

### GroupListResult

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| items | `ReadonlyArray<GroupSummary>` | 群组摘要列表。 |
| pageNum | `number` | 当前页码。 |
| pageSize | `number` | 每页条数。 |
| cursor | `string` | 下一页游标。 |
| hasMore | `boolean` | 是否还有下一页。 |

### GroupDetail

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| owner | `UserInfo` | 群主资料。 |
| inviteNeedConfirm | `boolean` | 受邀人入群前是否需要确认邀请。 |
| muteAllMembers | `boolean` | 是否开启全员禁言。 |
| ext | `string` | 群扩展字段。 |
| createdAt | `number` | 群组创建时间戳。 |
| joinedAt | `number` | 当前用户入群时间戳。 |
| avatarUrl | `string` | 群头像 URL。 |
| messageBlocked | `boolean` | 当前用户是否屏蔽该群消息。 |

### GroupUpdateInfoInput

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| name | `string` | 新群组名称。 |
| description | `string` | 新群组描述。 |
| avatar | `string` | 新群头像地址或标识。 |
| ext | `string` | 新群扩展字段。 |

### GroupUpdateConfigsInput

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| public | `boolean` | 是否为公开群。 |
| joinApprovalRequired | `boolean` | 入群是否需要管理员审批。 |
| allowInvites | `boolean` | 是否允许普通成员邀请其他用户。 |
| inviteNeedConfirm | `boolean` | 受邀人入群前是否需要确认邀请。 |
| maxMembers | `number` | 群组最大成员数。 |

### GroupOwnerChangeInput

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| newOwner | `string` | 新群主用户 ID。 |

### GroupMemberEntry

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| user | `UserInfo` | 成员用户资料。 |
| role | `GroupRole` | 成员角色。 |
| joinedAt | `number` | 成员入群时间戳。 |

### GroupMemberListResult

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| items | `ReadonlyArray<GroupMemberEntry>` | 成员列表。 |
| pageNum | `number` | 当前页码。 |
| pageSize | `number` | 每页条数。 |
| cursor | `string` | 下一页游标。 |
| hasMore | `boolean` | 是否还有下一页。 |

### GroupMuteEntry

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| user | `UserInfo` | 被禁言成员资料。 |
| muteExpire | `number` | 禁言到期时间戳。 |
| muteDuration | `number` | 禁言时长，单位秒。 |

### GroupAllowlistEntry

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| user | `UserInfo` | 白名单成员资料。 |

### GroupBlocklistEntry

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| user | `UserInfo` | 黑名单成员资料。 |

### GroupAnnouncement

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| announcement | `string` | 群公告内容。 |

### GroupSharedFile

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| fileId | `string` | 共享文件 ID。 |
| fileName | `string` | 文件名。 |
| fileOwner | `UserInfo` | 文件上传者资料。 |
| fileSize | `number` | 文件大小，单位字节。 |
| createdAt | `number` | 文件创建时间戳。 |

### GroupSharedFileListResult

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| items | `ReadonlyArray<GroupSharedFile>` | 共享文件列表。 |
| pageNum | `number` | 当前页码。 |
| pageSize | `number` | 每页条数。 |
| cursor | `string` | 下一页游标。 |
| hasMore | `boolean` | 是否还有下一页。 |

### CursorPageParams

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| pageSize | `number` | 每页条数。 |
| cursor | `string` | 下一页游标。 |

### NumberPageParams

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| pageNum | `number` | 页码。 |
| pageSize | `number` | 每页条数。 |

### GroupUserBatchInput

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userIds | `ReadonlyArray<string>` | 用户 ID 列表。 |

### GroupMuteMembersInput

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userIds | `ReadonlyArray<string>` | 待禁言成员 ID 列表。 |
| muteDuration | `number` | 禁言时长，单位秒。 |

### GroupAnnouncementUpdateInput

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| announcement | `string` | 新群公告内容。 |

### GetJoinedGroupListParams

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| needMemberCount | `boolean` | 是否返回成员数量。 |
| needRole | `boolean` | 是否返回当前用户角色。 |

### GetPublicGroupListParams

#### 说明

@internal

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| limit | `number` | 每页条数别名，兼容旧分页参数。 |

### GetGroupInfoParams

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | 群组 ID。 |

### GetGroupInfoListParams

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupIds | `ReadonlyArray<string>` | 群组 ID 列表。 |

### CreateGroupParams

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| name | `string` | 群组名称。 |
| description | `string` | 群组描述。 |
| memberIds | `ReadonlyArray<string>` | 初始成员 ID 列表。 |
| public | `boolean` | 是否为公开群。 |
| joinApprovalRequired | `boolean` | 入群是否需要管理员审批。 |
| allowInvites | `boolean` | 是否允许普通成员邀请其他用户入群。 |
| inviteNeedConfirm | `boolean` | 受邀人入群前是否需要确认邀请。 |
| maxMembers | `number` | 群组最大成员数。 |
| ext | `string` | 群扩展字段。 |
| avatar | `string` | 群头像地址或标识。 |

### CreateGroupResult

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | 创建成功后的群组 ID。 |

### UpdateGroupInfoParams

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | 群组 ID。 |
| name | `string` | 新群组名称。 |
| description | `string` | 新群组描述。 |
| avatar | `string` | 新群头像地址或标识。 |
| public | `boolean` | 是否为公开群。 |
| joinApprovalRequired | `boolean` | 入群是否需要管理员审批。 |
| allowInvites | `boolean` | 是否允许普通成员邀请其他用户入群。 |
| inviteNeedConfirm | `boolean` | 受邀人入群前是否需要确认邀请。 |
| maxMembers | `number` | 群组最大成员数。 |
| ext | `string` | 群扩展字段。 |

### GroupMutationTarget

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | 群组 ID。 |

### GroupUserBatchParams

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userIds | `ReadonlyArray<string>` | 用户 ID 列表。 |

### GroupAdminMutationParams

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userId | `string` | 管理员用户 ID。 |

### GroupOwnerChangeParams

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| newOwner | `string` | 新群主用户 ID。 |

### GroupJoinParams

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| message | `string` | 入群申请原因或附言。 |

### AcceptGroupJoinRequestParams

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userId | `string` | 申请人用户 ID。 |

### RejectGroupJoinRequestParams

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userId | `string` | 申请人用户 ID。 |
| reason | `string` | 拒绝原因。 |

### GroupMuteMembersParams

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userIds | `ReadonlyArray<string>` | 待禁言成员 ID 列表。 |
| muteDuration | `number` | 禁言时长，单位秒。 |

### GroupAnnouncementUpdateParams

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| announcement | `string` | 新群公告内容。 |

### UploadGroupSharedFileCallbacks

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| onFileUploadProgress | `(event: ProgressEvent) => void` | 文件上传进度回调。 |
| onFileUploadComplete | `(payload: unknown) => void` | 文件上传完成回调。 |
| onFileUploadError | `(payload: unknown) => void` | 文件上传失败回调。 |
| onFileUploadCanceled | `() => void` | 文件上传取消回调。 |

### UploadGroupSharedFileParams

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| file | `File | Blob | Record<string, unknown>` | 待上传文件。 |

### GroupUploadSharedFileInput

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| file | `File | Blob | Record<string, unknown>` | 待上传文件。 |

### DeleteGroupSharedFileParams

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| fileId | `string` | 共享文件 ID。 |

### GroupDeleteSharedFileInput

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| fileId | `string` | 共享文件 ID。 |

### DownloadGroupSharedFileCallbacks

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| onFileDownloadComplete | `(data: Blob) => void` | 文件下载完成回调，参数为 Blob 数据。 |
| onFileDownloadError | `(error: unknown) => void` | 文件下载失败回调。 |

### DownloadGroupSharedFileParams

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| fileId | `string` | 共享文件 ID。 |
| secret | `string` | 文件下载密钥。 |

### GroupDownloadSharedFileInput

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| fileId | `string` | 共享文件 ID。 |
| secret | `string` | 文件下载密钥。 |

### SetGroupMemberAttributesParams

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userId | `string` | 成员用户 ID。 |
| memberAttributes | `Readonly<Record<string, string>>` | 成员属性键值对象。 |

### GroupSetMemberAttributesInput

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userId | `string` | 成员用户 ID。 |
| memberAttributes | `Readonly<Record<string, string>>` | 成员属性键值对象。 |

### GetGroupMembersAttributesParams

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userIds | `ReadonlyArray<string>` | 成员用户 ID 列表。 |
| keys | `ReadonlyArray<string>` | 可选属性 key 列表；不传时返回全部属性。 |

### GroupGetMembersAttributesInput

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userIds | `ReadonlyArray<string>` | 成员用户 ID 列表。 |
| keys | `ReadonlyArray<string>` | 可选属性 key 列表；不传时返回全部属性。 |

### GroupMembersAttributesResult

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| items | `Readonly<Record<string, Readonly<Record<string, string>>>>` | 按成员用户 ID 索引的属性集合。 |

### GroupInvitationReceivedEventPayload

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| groupName | `string` | - |
| inviter | `UserInfo` | - |
| reason | `string` | - |

### GroupRequestToJoinReceivedEventPayload

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| groupName | `string` | - |
| applicant | `UserInfo` | - |
| reason | `string` | - |

### GroupRequestToJoinAcceptedEventPayload

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| groupName | `string` | - |
| accepter | `UserInfo` | - |

### GroupRequestToJoinDeclinedEventPayload

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| groupName | `string` | - |
| decliner | `UserInfo` | - |
| reason | `string` | - |
| applicant | `UserInfo` | - |

### GroupInvitationAcceptedEventPayload

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| invitee | `UserInfo` | - |
| reason | `string` | - |

### GroupInvitationDeclinedEventPayload

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| invitee | `UserInfo` | - |
| reason | `string` | - |

### GroupUserRemovedEventPayload

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| groupName | `string` | - |

### GroupDestroyedEventPayload

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| groupName | `string` | - |

### GroupAutoAcceptInvitationEventPayload

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| inviter | `UserInfo` | - |
| inviteMessage | `string` | - |

### GroupMuteListAddedEventPayload

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| mutes | `ReadonlyArray<UserInfo>` | - |
| muteExpire | `number` | - |

### GroupMuteListRemovedEventPayload

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| mutes | `ReadonlyArray<UserInfo>` | - |

### GroupAllowListAddedEventPayload

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| allowlist | `ReadonlyArray<UserInfo>` | - |

### GroupAllowListRemovedEventPayload

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| allowlist | `ReadonlyArray<UserInfo>` | - |

### GroupAllMemberMuteStateChangedEventPayload

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| isMuted | `boolean` | - |

### GroupAdminAddedEventPayload

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| administrator | `UserInfo` | - |

### GroupAdminRemovedEventPayload

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| administrator | `UserInfo` | - |

### GroupOwnerChangedEventPayload

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| newOwner | `UserInfo` | - |
| oldOwner | `UserInfo` | - |

### GroupMembersJoinedEventPayload

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| members | `ReadonlyArray<UserInfo>` | - |

### GroupMembersExitedEventPayload

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| members | `ReadonlyArray<UserInfo>` | - |

### GroupAnnouncementChangedEventPayload

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| announcement | `string` | - |

### GroupSharedFileAddedEventPayload

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| sharedFile | `GroupSharedFile` | - |

### GroupSharedFileDeletedEventPayload

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| fileId | `string` | - |

### GroupInfoChangedEventPayload

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| groupInfo | `GroupDetail` | - |

### GroupDisabledChangedEventPayload

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| groupInfo | `GroupDetail` | - |
| disabled | `boolean` | - |

### GroupMemberAttributeChangedEventPayload

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| user | `UserInfo` | - |
| attribute | `Readonly<Record<string, string>>` | - |
| from | `string` | - |
| source | `'direct' | 'multiDevice'` | - |

### GroupUserGroupNamecardUpdatedEventPayload

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| userId | `string` | - |
| namecard | `string` | - |

### GroupManagerListener

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| onUserGroupNamecardUpdated | `(groupId: string, userId: string, namecard: string) => void` | - |

### GroupRawNotifyPayload

#### 说明

@internal 群事件原始通知载荷。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| groupName | `string` | - |
| reason | `string` | - |
| inviterId | `string` | - |
| applicantId | `string` | - |
| accepterId | `string` | - |
| declinerId | `string` | - |
| inviteeId | `string` | - |
| administratorId | `string` | - |
| oldOwnerId | `string` | - |
| newOwnerId | `string` | - |
| memberIds | `ReadonlyArray<string>` | - |
| userId | `string` | - |
| userIds | `ReadonlyArray<string>` | - |
| announcement | `string` | - |
| sharedFile | `GroupSharedFile` | - |
| fileId | `string` | - |
| muteExpire | `number` | - |
| isMuted | `boolean` | - |
| attribute | `Readonly<Record<string, string>>` | - |
| from | `string` | - |
| source | `'direct' | 'multiDevice'` | - |
| shouldFetchGroupDetail | `boolean` | - |
| groupPatch | `Partial<GroupDetail>` | - |
| isDisabled | `boolean` | - |

### GroupRawNotifyEvent

#### 说明

@internal 群事件原始通知信封。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| eventName | `string` | - |
| payload | `GroupRawNotifyPayload` | - |
