---
id: generated/api-reference/src-types-chatroom-ts
title: websdk2 API Reference - 聊天室类型
description: 来自 docs/reference/api-reference.zh-CN.md 的 src/types/chatroom.ts API Reference 分段。
---

## src/types/chatroom.ts

### ChatRoomSummary

#### 说明

聊天室列表中的摘要信息。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | 聊天室 ID。 |
| name | `string` | 聊天室名称。 |
| owner | `UserInfo` | 聊天室所有者资料；SDK 会尽量从缓存或用户资料接口补齐。 |
| memberCount | `number` | 当前成员数量。 |
| disabled | `boolean` | 聊天室是否已禁用。 |

### ChatRoomListResult

#### 说明

聊天室分页列表返回值。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| items | `ReadonlyArray<ChatRoomSummary>` | 当前页聊天室摘要列表。 |
| pageNum | `number` | 当前页码，从 1 开始；具体值取决于服务端返回。 |
| pageSize | `number` | 当前页大小。 |
| total | `number` | 服务端返回的总数。 |
| hasMore | `boolean` | 是否还有下一页。 |

### ChatRoomCurrentUserStatus

#### 说明

当前用户在聊天室内的状态。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| inAllowlist | `boolean` | 当前用户是否在 allowlist 中。 |
| muted | `boolean` | 当前用户是否被禁言。 |
| muteExpireAt | `number` | 当前用户禁言过期时间。 |
| permissionType | `ChatRoomPermissionType` | 当前用户权限类型。 |

### ChatRoomDetail

#### 说明

聊天室详情。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| description | `string` | 聊天室描述。 |
| maxMembers | `number` | 聊天室最大成员数。 |
| createdAt | `number` | 聊天室创建时间戳，单位由服务端返回决定。 |
| ext | `string` | 聊天室扩展信息。 |
| announcement | `string` | 聊天室公告。 |
| permissionType | `ChatRoomPermissionType` | 当前用户权限类型。 |
| currentUserStatus | `ChatRoomCurrentUserStatus` | 当前用户在聊天室内的状态快照。 |

### ChatRoomPageParams

#### 说明

页码分页参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| pageNum | `number` | 页码，从 1 开始；未传时使用服务端默认值。 |
| pageSize | `number` | 每页数量；未传时使用服务端默认值。 |

### GetChatRoomInfoParams

#### 说明

查询聊天室详情参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | 聊天室 ID，必填。 |

### ChatRoomUpdateInfoInput

#### 说明

更新聊天室信息的输入字段。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| name | `string` | 新聊天室名称；未传则不修改。 |
| description | `string` | 新聊天室描述；未传则不修改。 |
| maxMembers | `number` | 新最大成员数；未传则不修改。 |

### UpdateChatRoomInfoParams

#### 说明

更新聊天室信息参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | 聊天室 ID，必填。 |

### ChatRoomUpdateResult

#### 说明

聊天室信息更新结果。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| nameUpdated | `boolean` | 名称是否已更新。 |
| descriptionUpdated | `boolean` | 描述是否已更新。 |
| maxMembersUpdated | `boolean` | 最大成员数是否已更新。 |

### ChatRoomMutationTarget

#### 说明

仅包含聊天室 ID 的通用操作目标。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | 聊天室 ID，必填。 |

### JoinChatRoomParams

#### 说明

加入聊天室参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| ext | `string` | 加入聊天室时透传给服务端的扩展信息。 |
| leaveOtherRooms | `boolean` | 是否离开当前账号已加入的其他聊天室；未传时由服务端默认策略决定。 |

### ChatRoomUserBatchInput

#### 说明

批量用户操作输入。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userIds | `ReadonlyArray<string>` | 用户 ID 列表，必填且至少包含一个有效用户 ID。 |

### ChatRoomUserBatchParams

#### 说明

带聊天室 ID 的批量用户操作参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userIds | `ReadonlyArray<string>` | 用户 ID 列表，必填且至少包含一个有效用户 ID。 |

### ChatRoomAdminInput

#### 说明

单个管理员操作输入。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userId | `string` | 目标用户 ID，必填。 |

### ChatRoomAdminParams

#### 说明

带聊天室 ID 的管理员操作参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userId | `string` | 目标用户 ID，必填。 |

### ChatRoomMemberEntry

#### 说明

聊天室成员条目。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| user | `UserInfo` | 成员用户资料。 |
| role | `ChatRoomRole` | 成员角色。 |
| joinedAt | `number` | 成员加入时间戳。 |

### ChatRoomMemberListParams

#### 说明

聊天室成员列表查询参数。

### ChatRoomMemberListResult

#### 说明

聊天室成员列表返回值。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| items | `ReadonlyArray<ChatRoomMemberEntry>` | 成员条目列表。 |
| cursor | `string` | 下一页游标；为空表示服务端未返回游标。 |
| hasMore | `boolean` | 是否还有下一页。 |

### ChatRoomMemberActionResult

#### 说明

单个成员操作结果。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | 聊天室 ID。 |
| user | `UserInfo` | 目标用户资料。 |
| action | `string` | 操作名称。 |
| reason | `string` | 失败原因；仅失败时可能返回。 |

### ChatRoomMemberActionListResult

#### 说明

批量成员操作结果。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| succeeded | `ReadonlyArray<ChatRoomMemberActionResult>` | 操作成功的目标用户结果。 |
| failed | `ReadonlyArray<ChatRoomMemberActionResult>` | 操作失败的目标用户结果。 |

### ChatRoomMuteEntry

#### 说明

禁言列表条目。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| user | `UserInfo` | 被禁言用户资料。 |
| muteExpire | `number` | 禁言过期时间。 |
| duration | `number` | 禁言时长，单位通常为秒，具体以服务端返回为准。 |

### ChatRoomMuteMembersInput

#### 说明

禁言成员输入。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userIds | `ReadonlyArray<string>` | 待禁言用户 ID 列表，必填。 |
| duration | `number` | 禁言时长，单位为秒。 |

### ChatRoomMuteMembersParams

#### 说明

带聊天室 ID 的禁言成员参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userIds | `ReadonlyArray<string>` | 待禁言用户 ID 列表，必填。 |
| duration | `number` | 禁言时长，单位为秒。 |

### ChatRoomMuteStatus

#### 说明

当前用户禁言状态。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| muted | `boolean` | 当前用户是否被禁言。 |
| muteExpireAt | `number` | 禁言过期时间。 |

### ChatRoomMuteListParams

#### 说明

禁言列表查询参数。

### ChatRoomAllowlistEntry

#### 说明

allowlist 条目。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| user | `UserInfo` | allowlist 用户资料。 |

### ChatRoomBlocklistEntry

#### 说明

黑名单条目。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| user | `UserInfo` | 黑名单用户资料。 |

### ChatRoomBlocklistParams

#### 说明

黑名单分页查询参数。

### ChatRoomAnnouncement

#### 说明

聊天室公告。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| announcement | `string` | 公告内容。 |

### ChatRoomAnnouncementUpdateInput

#### 说明

更新公告输入。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| announcement | `string` | 新公告内容，必填。 |

### ChatRoomAnnouncementUpdateParams

#### 说明

带聊天室 ID 的更新公告参数。

### ChatRoomSharedFile

#### 说明

聊天室共享文件条目。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| fileId | `string` | 文件 ID。 |
| fileName | `string` | 文件名。 |
| fileOwner | `UserInfo` | 文件上传者资料。 |
| fileSize | `number` | 文件大小，单位为字节。 |
| createdAt | `number` | 文件创建时间戳。 |

### ChatRoomSharedFileListParams

#### 说明

聊天室共享文件列表查询参数。

### ChatRoomSharedFileListResult

#### 说明

聊天室共享文件列表返回值。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| items | `ReadonlyArray<ChatRoomSharedFile>` | 共享文件列表。 |
| pageNum | `number` | 当前页码。 |
| pageSize | `number` | 当前页大小。 |
| cursor | `string` | 下一页游标。 |
| hasMore | `boolean` | 是否还有下一页。 |

### ChatRoomDeleteSharedFileInput

#### 说明

删除共享文件输入。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| fileId | `string` | 文件 ID，必填。 |

### DeleteChatRoomSharedFileParams

#### 说明

带聊天室 ID 的删除共享文件参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| fileId | `string` | 文件 ID，必填。 |

### GetChatRoomAttributesInput

#### 说明

查询聊天室属性输入。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| keys | `ReadonlyArray<string>` | 指定要查询的属性 key；未传时查询全部属性。 |

### GetChatRoomAttributesParams

#### 说明

带聊天室 ID 的查询属性参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| keys | `ReadonlyArray<string>` | 指定要查询的属性 key；未传时查询全部属性。 |

### SetChatRoomAttributesInput

#### 说明

设置聊天室属性输入。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| attributes | `Readonly<Record<string, string>>` | 要设置的属性键值对，key/value 均必须为字符串。 |
| autoDelete | `boolean` | 成员退出聊天室时是否自动删除其设置的属性。默认 `true`。 |
| isForced | `boolean` | 是否允许覆盖其他成员设置的属性。默认 `false`。 |

### SetChatRoomAttributesParams

#### 说明

带聊天室 ID 的设置属性参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| attributes | `Readonly<Record<string, string>>` | 要设置的属性键值对，key/value 均必须为字符串。 |
| autoDelete | `boolean` | 成员退出聊天室时是否自动删除其设置的属性。默认 `true`。 |
| isForced | `boolean` | 是否允许覆盖其他成员设置的属性。默认 `false`。 |

### RemoveChatRoomAttributesInput

#### 说明

删除聊天室属性输入。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| keys | `ReadonlyArray<string>` | 要删除的属性 key 列表，必填。 |
| isForced | `boolean` | 是否允许删除其他成员设置的属性。默认 `false`。 |

### RemoveChatRoomAttributesParams

#### 说明

带聊天室 ID 的删除属性参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| keys | `ReadonlyArray<string>` | 要删除的属性 key 列表，必填。 |
| isForced | `boolean` | 是否允许删除其他成员设置的属性。默认 `false`。 |

### ChatRoomAttributesSnapshot

#### 说明

聊天室属性快照。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | 聊天室 ID。 |
| attributes | `Readonly<Record<string, string>>` | 属性键值对。 |

### ChatRoomAttributeMutationResult

#### 说明

聊天室属性批量变更结果。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | 聊天室 ID。 |
| appliedKeys | `ReadonlyArray<string>` | 已成功应用的属性 key。 |
| failedKeys | `Readonly<
    Record<string, { readonly code: number; readonly message: string }>
  >` | 设置或删除失败的属性 key 到错误信息的映射。 |

### ChatRoomDestroyedEventPayload

#### 说明

聊天室被销毁事件载荷。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | 聊天室 ID。 |
| chatRoomName | `string` | 聊天室名称。 |

### ChatRoomMembersJoinedEventPayload

#### 说明

成员加入聊天室事件载荷。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | 聊天室 ID。 |
| chatRoomName | `string` | 聊天室名称。 |
| members | `ReadonlyArray<UserInfo>` | 加入聊天室的成员列表。 |
| ext | `string` | 加入时透传的扩展信息。 |

### ChatRoomMembersExitedEventPayload

#### 说明

成员退出聊天室事件载荷。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | 聊天室 ID。 |
| chatRoomName | `string` | 聊天室名称。 |
| members | `ReadonlyArray<UserInfo>` | 退出聊天室的成员列表。 |

### ChatRoomRemovedFromChatRoomEventPayload

#### 说明

当前用户被移出聊天室事件载荷。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| reason | `number` | 被移出的原因码。 |
| chatRoomId | `string` | 聊天室 ID。 |
| chatRoomName | `string` | 聊天室名称。 |
| participant | `UserInfo` | 触发移除的参与者资料。 |

### ChatRoomMuteListAddedEventPayload

#### 说明

聊天室禁言列表新增事件载荷。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | 聊天室 ID。 |
| mutes | `ReadonlyArray<ChatRoomMuteEntry>` | 新增的禁言条目。 |
| muteExpire | `number` | 禁言过期时间。 |

### ChatRoomMuteListRemovedEventPayload

#### 说明

聊天室禁言列表移除事件载荷。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | 聊天室 ID。 |
| mutes | `ReadonlyArray<UserInfo>` | 解除禁言的用户资料列表。 |

### ChatRoomAllowListAddedEventPayload

#### 说明

聊天室 allowlist 新增事件载荷。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | 聊天室 ID。 |
| allowlist | `ReadonlyArray<UserInfo>` | 新增到 allowlist 的用户资料。 |

### ChatRoomAllowListRemovedEventPayload

#### 说明

聊天室 allowlist 移除事件载荷。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | 聊天室 ID。 |
| allowlist | `ReadonlyArray<UserInfo>` | 从 allowlist 移除的用户资料。 |

### ChatRoomAllMemberMuteStateChangedEventPayload

#### 说明

聊天室全员禁言状态变更事件载荷。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | 聊天室 ID。 |
| isMuted | `boolean` | 当前是否已开启全员禁言。 |

### ChatRoomAdminAddedEventPayload

#### 说明

聊天室管理员新增事件载荷。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | 聊天室 ID。 |
| admin | `UserInfo` | 新增管理员资料。 |

### ChatRoomAdminRemovedEventPayload

#### 说明

聊天室管理员移除事件载荷。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | 聊天室 ID。 |
| admin | `UserInfo` | 被移除管理员资料。 |

### ChatRoomOwnerChangedEventPayload

#### 说明

聊天室所有者变更事件载荷。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | 聊天室 ID。 |
| newOwner | `UserInfo` | 新所有者资料。 |
| oldOwner | `UserInfo` | 原所有者资料。 |

### ChatRoomAnnouncementChangedEventPayload

#### 说明

聊天室公告变更事件载荷。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | 聊天室 ID。 |
| announcement | `string` | 最新公告内容。 |

### ChatRoomInfoChangedEventPayload

#### 说明

聊天室信息变更事件载荷。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | 聊天室 ID。 |
| chatRoomInfo | `ChatRoomDetail` | 最新聊天室详情。 |

### ChatRoomAttributesUpdateEventPayload

#### 说明

聊天室属性更新事件载荷。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | 聊天室 ID。 |
| attributes | `Readonly<Record<string, string>>` | 更新后的属性键值对。 |
| from | `UserInfo` | 触发更新的用户资料。 |

### ChatRoomAttributesRemovedEventPayload

#### 说明

聊天室属性删除事件载荷。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | 聊天室 ID。 |
| keyList | `ReadonlyArray<string>` | 被删除的属性 key 列表。 |
| from | `UserInfo` | 触发删除的用户资料。 |

### ChatRoomEventPayloadMap

#### 说明

聊天室事件名到载荷类型的映射。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| onChatRoomDestroyed | `ChatRoomDestroyedEventPayload` | 聊天室被销毁事件载荷。 |
| onMembersJoined | `ChatRoomMembersJoinedEventPayload` | 成员加入聊天室事件载荷。 |
| onMembersExited | `ChatRoomMembersExitedEventPayload` | 成员退出聊天室事件载荷。 |
| onRemovedFromChatRoom | `ChatRoomRemovedFromChatRoomEventPayload` | 当前用户被移出聊天室事件载荷。 |
| onMuteListAdded | `ChatRoomMuteListAddedEventPayload` | 禁言列表新增事件载荷。 |
| onMuteListRemoved | `ChatRoomMuteListRemovedEventPayload` | 禁言列表移除事件载荷。 |
| onAllowListAdded | `ChatRoomAllowListAddedEventPayload` | allowlist 新增事件载荷。 |
| onAllowListRemoved | `ChatRoomAllowListRemovedEventPayload` | allowlist 移除事件载荷。 |
| onAllMemberMuteStateChanged | `ChatRoomAllMemberMuteStateChangedEventPayload` | 全员禁言状态变更事件载荷。 |
| onAdminAdded | `ChatRoomAdminAddedEventPayload` | 管理员新增事件载荷。 |
| onAdminRemoved | `ChatRoomAdminRemovedEventPayload` | 管理员移除事件载荷。 |
| onOwnerChanged | `ChatRoomOwnerChangedEventPayload` | 所有者变更事件载荷。 |
| onAnnouncementChanged | `ChatRoomAnnouncementChangedEventPayload` | 公告变更事件载荷。 |
| onChatRoomInfoChanged | `ChatRoomInfoChangedEventPayload` | 聊天室信息变更事件载荷。 |
| onAttributesUpdate | `ChatRoomAttributesUpdateEventPayload` | 属性更新事件载荷。 |
| onAttributesRemoved | `ChatRoomAttributesRemovedEventPayload` | 属性删除事件载荷。 |

### ChatRoomRawNotifyPayload

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| chatRoomId | `string` | 聊天室 ID。 |
| chatRoomName | `string` | 聊天室名称。 |
| reason | `string` | 原始原因文本。 |
| reasonCode | `number` | 原始原因码。 |
| participantId | `string` | 参与者用户 ID。 |
| memberId | `string` | 成员用户 ID。 |
| memberIds | `ReadonlyArray<string>` | 成员用户 ID 列表。 |
| userIds | `ReadonlyArray<string>` | 用户 ID 列表。 |
| adminId | `string` | 管理员用户 ID。 |
| oldOwnerId | `string` | 原所有者用户 ID。 |
| newOwnerId | `string` | 新所有者用户 ID。 |
| announcement | `string` | 公告内容。 |
| muteExpire | `number` | 禁言过期时间。 |
| muteMembers | `Readonly<Record<string, number>>` | 用户 ID 到禁言过期时间的映射。 |
| isMuted | `boolean` | 是否已开启全员禁言。 |
| ext | `string` | 扩展信息。 |
| from | `string` | 事件来源用户 ID。 |
| attributes | `Readonly<Record<string, string>>` | 属性键值对。 |
| keyList | `ReadonlyArray<string>` | 属性 key 列表。 |
| shouldFetchChatRoomDetail | `boolean` | 是否需要补拉聊天室详情。 |
| chatRoomPatch | `Partial<ChatRoomDetail>` | 原始通知中携带的聊天室详情补丁。 |

### ChatRoomRawNotifyEvent

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| eventName | `ChatRoomEventName` | 聊天室事件名称。 |
| payload | `ChatRoomRawNotifyPayload` | 原始通知载荷。 |
