# 027 数据模型（Phase 1）

## 1) GroupRole

- **描述**: 当前用户或群成员在群内的角色枚举。
- **允许值**:
  - `owner`
  - `admin`
  - `member`

## 2) GroupSummary

- **描述**: 公开群列表或已加入群列表中的单个群组条目。
- **关键字段**:
  - `groupId: string`
  - `name: string`
  - `description?: string`
  - `memberCount?: number`
  - `public?: boolean`
  - `joinApprovalRequired?: boolean`
  - `allowInvites?: boolean`
  - `maxMembers?: number`
  - `role?: GroupRole`
  - `disabled?: boolean`
- **已确认来源**:
  - `docs/reference/group-api.md` 中“获取加入的群组”样例确认原始字段为 `groupid`、`groupname`、`disabled`
- **约束**:
  - 对外字段统一驼峰化
  - 不暴露 `groupid/groupname/maxusers/membersonly/allowinvites`
  - `disabled` 在已加入群列表响应中可能是字符串布尔值，归一化时需转为 `boolean`

## 3) GroupListResult

- **描述**: `()` 与 `getJoinedGroupList()` 的统一分页结果对象。
- **关键字段**:
  - `items: GroupSummary[]`
  - `pageNum?: number`
  - `pageSize?: number`
  - `cursor?: string`
  - `hasMore?: boolean`
- **约束**:
  - 当前已确认公开返回必须是分页结果对象
  - `items` 保持 `GroupSummary[]`，不升级为 `Group[]`
  - 已加入群列表响应已确认可从 envelope `params.pagenum[]`、`params.pagesize[]` 解析 `pageNum`、`pageSize`
  - `cursor` / `hasMore` 仍待公开群列表真实样例确认后定稿

## 3A) Group

- **描述**: `groupManager.getGroup(groupId)` 返回的轻量单群对象，用于承载单群上下文的方法。
- **关键字段**:
  - `groupId: string`
- **关键方法**:
  - `getDetail(): Promise<GroupDetail>` 或 `refresh(): Promise<GroupDetail>`
  - `updateInfo(input: Omit<UpdateGroupInfoInput, 'groupId'>): Promise<void>`
  - `getMembers(): Promise<GroupMemberListResult>`
  - `getAdmins(): Promise<ReadonlyArray<UserInfo>>`
  - `getMuteList(): Promise<ReadonlyArray<GroupMuteEntry>>`
  - `getBlocklist(): Promise<ReadonlyArray<GroupBlocklistEntry>>`
  - `getAllowlist(): Promise<ReadonlyArray<GroupAllowlistEntry>>`
  - `getAnnouncement(): Promise<GroupAnnouncement>`
  - `getSharedFileList(): Promise<GroupSharedFileListResult>`
  - `getMembersAttributes()`
- **约束**:
  - `Group` 只是绑定 `groupId` 的 façade，不作为列表项返回
  - `Group` 不承担本地状态自动同步与前端 state 主数据职责
  - 所有需要网络访问的方法必须显式为异步方法，避免伪装成本地同步 getter

## 4) GroupDetail

- **描述**: 单个群组的完整标准化视图。
- **关键字段**:
  - `groupId: string`
  - `name: string`
  - `description?: string`
  - `owner?: UserInfo`
  - `memberCount?: number`
  - `public?: boolean`
  - `joinApprovalRequired?: boolean`
  - `allowInvites?: boolean`
  - `inviteNeedConfirm?: boolean`
  - `maxMembers?: number`
  - `role?: GroupRole`
  - `disabled?: boolean`
  - `muteAllMembers?: boolean`
  - `ext?: string`
  - `createdAt?: number`
  - `joinedAt?: number`
- **已确认来源**:
  - `docs/reference/group-api.md` 中“获取群详情”样例确认原始字段含 `id`、`name`、`description`、`membersonly`、`allowinvites`、`maxusers`、`owner`、`created`、`custom`、`mute`、`affiliations_count`、`disabled`、`affiliations[]`、`public`
- **约束**:
  - `onGroupInfoChanged` / `onGroupDisabledChanged` 的 `groupInfo` 字段必须满足该模型的“完整对象”语义
  - `joinApprovalRequired` 由原始 `membersonly` 归一化
  - `memberCount` 可由原始 `affiliations_count` 归一化
  - `ext` 由原始 `custom` 归一化
  - `muteAllMembers` 由原始 `mute` 归一化
  - `role` 由 v3 群详情响应中的 `permission` 归一化，取值与 `GroupSummary.role` 保持一致
  - `joinedAt` 可优先从 `affiliations[].joined_time` 中当前用户记录推导

## 5) CreateGroupInput

- **描述**: `createGroup` 的输入模型。
- **关键字段**:
  - `name: string`
  - `description: string`
  - `memberIds: string[]`
  - `public: boolean`
  - `joinApprovalRequired: boolean`
  - `allowInvites: boolean`
  - `inviteNeedConfirm: boolean`
  - `maxMembers?: number`
  - `ext?: string`
- **校验规则**:
  - `name`、`description` 必填
  - `memberIds` 允许为空或缺省时按真实 API 语义处理
  - 对外使用 `memberIds` / `name`，不暴露 `groupname` / `members`

## 6) UpdateGroupInfoInput

- **描述**: `updateGroupInfo` 的输入模型。
- **关键字段**:
  - `groupId: string`
  - `name?: string`
  - `description?: string`
  - `public?: boolean`
  - `joinApprovalRequired?: boolean`
  - `allowInvites?: boolean`
  - `inviteNeedConfirm?: boolean`
  - `maxMembers?: number`
  - `ext?: string`
- **校验规则**:
  - `groupId` 必填
  - 至少一个可修改字段存在

## 7) GroupUserBatchInput

- **描述**: 适用于成员移除、黑名单、allowlist 等批量用户操作的统一输入模型。
- **关键字段**:
  - `groupId: string`
  - `userIds: string[]`
- **校验规则**:
  - `groupId` 必填
  - `userIds` 必须为非空数组
  - 元素必须为非空字符串
  - 去重后保持剩余用户 ID 顺序

## 8) MuteGroupMembersInput

- **描述**: `muteGroupMembers` 的输入模型。
- **关键字段**:
  - `groupId: string`
  - `userIds: string[]`
  - `muteDuration: number`
- **校验规则**:
  - `muteDuration` 必须为数字
  - `-1` 表示永久禁言

## 9) GroupMemberEntry

- **描述**: 群成员列表条目。
- **关键字段**:
  - `user: UserInfo`
  - `role?: GroupRole`
  - `joinedAt?: number`
- **映射规则**:
  - 若服务端只返回用户 ID，则先补齐 `user`
  - `docs/reference/group-api.md` 中“获取群组成员”样例确认原始条目可能为 `{ member: string }` 或 `{ owner: string }`
  - 原始条目含 `owner` 时归一化为 `role: owner`，含 `member` 时归一化为 `role: member`
  - 成员列表响应中尚未看到 `joinedAt` 字段，不应臆造

## 10) GroupMuteEntry

- **描述**: 群禁言列表条目。
- **关键字段**:
  - `user: UserInfo`
  - `muteExpire?: number`
  - `muteDuration?: number`
- **映射规则**:
  - 用户对象补齐策略与成员列表一致
  - 需求已确认禁言列表原始 `data` 为 `string[]`
  - 当前真实响应未携带禁言截止时间时，`muteExpire` / `muteDuration` 保持可选且不臆造

## 11) GroupAllowlistEntry

- **描述**: 群 allowlist 条目。
- **关键字段**:
  - `user: UserInfo`
- **映射规则**:
  - `docs/reference/group-api.md` 中“获取allowlist”样例确认原始 `data` 为 `string[]`

## 12) GroupBlocklistEntry

- **描述**: 群黑名单条目。
- **关键字段**:
  - `user: UserInfo`
- **映射规则**:
  - 需求已确认黑名单原始 `data` 为 `string[]`

## 13) GroupSharedFile

- **描述**: 群共享文件对象。
- **关键字段**:
  - `fileId: string`
  - `fileName: string`
  - `fileOwner?: UserInfo`
  - `fileSize?: number`
  - `createdAt?: number`
- **已确认来源**:
  - `docs/reference/group-api.md` 中“共享文件列表”样例确认原始字段为 `file_id`、`created`、`file_owner`、`file_name`、`file_size`
- **约束**:
  - 对外统一驼峰命名
  - `fileOwner` 优先对象化；若无资料仅保留最小 `userId`

## 15) GroupInvitationEventPayload

- **描述**: 邀请与申请类事件的统一对象化载荷族。
- **覆盖事件**:
  - `onInvitationReceived`
  - `onRequestToJoinReceived`
  - `onRequestToJoinAccepted`
  - `onRequestToJoinDeclined`
  - `onInvitationAccepted`
  - `onInvitationDeclined`
  - `onAutoAcceptInvitationFromGroup`
- **关键字段**:
  - `groupId: string`
  - `groupName?: string`
  - `inviter?: UserInfo`
  - `applicant?: UserInfo`
  - `accepter?: UserInfo`
  - `decliner?: UserInfo`
  - `invitee?: UserInfo`
  - `reason?: string`
  - `inviteMessage?: string`

## 16) GroupMembershipEventPayload

- **描述**: 成员变更类事件的对象化载荷族。
- **覆盖事件**:
  - `onUserRemoved`
  - `onMembersJoined`
  - `onMembersExited`
  - `onAdminAdded`
  - `onAdminRemoved`
  - `onOwnerChanged`
- **关键字段**:
  - `groupId: string`
  - `groupName?: string`
  - `members?: UserInfo[]`
  - `administrator?: UserInfo`
  - `oldOwner?: UserInfo`
  - `newOwner?: UserInfo`

## 17) GroupModerationEventPayload

- **描述**: 禁言、allowlist、群状态等治理类事件的对象化载荷族。
- **覆盖事件**:
  - `onMuteListAdded`
  - `onMuteListRemoved`
  - `onAllowListAdded`
  - `onAllowListRemoved`
  - `onAllMemberMuteStateChanged`
  - `onGroupDisabledChanged`
- **关键字段**:
  - `groupId: string`
  - `mutes?: UserInfo[]`
  - `muteExpire?: number`
  - `allowlist?: UserInfo[]`
  - `isMuted?: boolean`
  - `groupInfo?: GroupDetail`
  - `disabled?: boolean`

## 18) GroupContentEventPayload

- **描述**: 公告、共享文件、群规格、成员属性与群名片相关事件载荷。
- **覆盖事件**:
  - `onAnnouncementChanged`
  - `onSharedFileAdded`
  - `onSharedFileDeleted`
  - `onGroupInfoChanged`
  - `onGroupMemberAttributeChanged`
  - `onUserGroupNamecardUpdated`
- **关键字段**:
  - `groupId: string`
  - `announcement?: string`
  - `sharedFile?: GroupSharedFile`
  - `fileId?: string`
  - `groupInfo?: GroupDetail`
  - `user?: UserInfo`
  - `attribute?: Record<string, string>`
  - `from?: string`
  - `groupNamecard?: string`
  - `source?: direct | multiDevice`

## 19) PendingResponseEnvelope

- **描述**: 当前尚未完全拿到真实样例的群组域服务端响应包装占位模型。
- **适用接口**:
  - `getGroupInfoList`
  - `group.getMembersAttributes()`（已确认返回 `data[userId] -> attribute map`，单成员读取通过 `userIds: [userId]` 表达；具体 attribute key 集仍依赖业务样例补充）
- **约束**:
  - 这些 envelope 在拿到真实样例前只允许保留在内部适配层与 contract TODO 中
  - 不得把猜测字段承诺为公开模型

## 关系说明

- `GroupListResult.items[] -> GroupSummary`
- `GroupDetail.owner`、`GroupMemberEntry.user`、`GroupMuteEntry.user`、`GroupAllowlistEntry.user`、`GroupBlocklistEntry.user` 统一复用 `UserInfo`
- `GroupInvitationEventPayload`、`GroupMembershipEventPayload`、`GroupModerationEventPayload`、`GroupContentEventPayload` 共享同一套用户资料补齐策略
- `onGroupInfoChanged` / `onGroupDisabledChanged` 通过 `groupInfo: GroupDetail` 暴露完整群对象

## 状态语义

### 读取类 API

- `pending -> succeeded`: 返回业务对象、对象数组或分页结果对象
- `pending -> degraded_success`: 主业务成功但资料补齐部分失败，返回最小 `UserInfo`
- `pending -> failed`: 抛统一 SDK 错误

### 群对象类事件

- `received_patch -> normalized_group`: 原始事件字段足够时直接归一化为 `GroupDetail`
- `received_patch -> fetch_detail -> normalized_group`: 字段不足时受控补拉详情后再派发
- `received_patch -> degraded_drop`: 仅在原始事件不可识别且详情补拉也失败时记录日志并丢弃事件

### 用户资料补齐

- `cache_hit -> succeeded`: 直接使用缓存对象化用户
- `cache_miss -> batch_fetch -> succeeded`: 批量补拉并对象化
- `cache_miss -> batch_fetch_failed -> degraded_success`: 回退最小 `UserInfo`
