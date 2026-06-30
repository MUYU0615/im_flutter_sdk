# 028 数据模型（Phase 1）

## 1) ChatRoomPermissionType

- **描述**: 当前登录用户在聊天室中的权限类型。
- **允许值**:
  - `owner`
  - `admin`
  - `member`
  - `none`

## 2) ChatRoomSummary

- **描述**: 公开聊天室列表中的单个聊天室条目。
- **关键字段**:
  - `chatRoomId: string`
  - `name: string`
  - `owner?: UserInfo`
  - `memberCount?: number`
  - `disabled?: boolean`
- **已确认来源**:
  - `docs/reference/chatroom-api.md` 中“getChatRoomList”样例确认原始字段包含 `id`、`name`、`owner`、`affiliations_count`、`disabled`
- **约束**:
  - 对外字段统一驼峰化
  - `owner` 统一对象化
  - 原始字符串布尔与数字字符串在归一化时必须转换为真实 `boolean` / `number`

## 3) ChatRoomListResult

- **描述**: `getChatRoomList()` 的分页结果对象。
- **关键字段**:
  - `items: ChatRoomSummary[]`
  - `pageNum?: number`
  - `pageSize?: number`
  - `total?: number`
  - `hasMore?: boolean`
- **约束**:
  - `items` 保持 `ChatRoomSummary[]`，不升级为 `ChatRoom[]`
  - 当前已确认可从 envelope `count` 与 `params.pagenum/pagesize` 归一化出部分分页信息
  - 若 upstream 未提供 cursor，不应臆造 cursor 字段

## 4) ChatRoomCurrentUserStatus

- **描述**: 当前登录用户在某个聊天室中的状态视图。
- **关键字段**:
  - `inAllowlist?: boolean`
  - `muted?: boolean`
  - `muteExpireAt?: number`
  - `permissionType?: ChatRoomPermissionType`
- **约束**:
  - 该状态通过 `getInfo()` / `refresh()` 的返回对象字段与显式方法语义对外提供
  - 不再新增 `getMuteExpireTimestamp()` 等字段级 getter

## 5) ChatRoom

- **描述**: `chatRoomManager.getChatRoom(chatRoomId)` 返回的轻量单聊天室对象，用于承载单聊天室上下文的方法。
- **关键字段**:
  - `chatRoomId: string`
- **关键方法**:
  - `getInfo(): Promise<ChatRoomDetail>` 或 `refresh(): Promise<ChatRoomDetail>`
  - `updateInfo(input: Omit<UpdateChatRoomInfoInput, 'chatRoomId'>): Promise<void>`
  - `destroy(): Promise<void>`
  - `leaveChatRoom(): Promise<void>`
  - `getMemberList(): Promise<ChatRoomMemberListResult>`
  - `addMembers()` / `removeMembers()`
  - `getAdminList(): Promise<ReadonlyArray<UserInfo>>`
  - `setAdmin(input: ChatRoomAdminInput): Promise<void>` / `removeAdmin(input: ChatRoomAdminInput): Promise<void>`
  - `getMuteList(): Promise<ReadonlyArray<ChatRoomMuteEntry>>`
  - `muteMembers()` / `unmuteMembers()` / `muteAllMembers()` / `unmuteAllMembers()`
  - `getBlocklist(): Promise<ReadonlyArray<ChatRoomBlocklistEntry>>`
  - `blockMembers()` / `unblockMembers()`
  - `getAllowlist(): Promise<ReadonlyArray<ChatRoomAllowlistEntry>>`
  - `addUsersToAllowlist()` / `removeUsersFromAllowlist()` / `checkIfInAllowList()`
  - `isCurrentUserMuted()`
  - `getAnnouncement()` / `updateAnnouncement()`
  - `getSharedFileList()` / `deleteSharedFile()`
  - `getAttributes(input?: GetChatRoomAttributesInput)` / `setAttributes()` / `setAttribute(input: SetChatRoomAttributeInput)` / `removeAttributes()` / `removeAttribute(input: RemoveChatRoomAttributeInput)`
- **约束**:
  - `ChatRoom` 只是绑定 `chatRoomId` 的 façade，不作为列表项返回
  - `ChatRoom` 不承担本地状态自动同步与前端 state 主数据职责
  - 所有需要网络访问的方法必须显式为异步方法，避免伪装成本地同步 getter

## 6) ChatRoomDetail

- **描述**: 单个聊天室的完整标准化视图。
- **关键字段**:
  - `chatRoomId: string`
  - `name: string`
  - `description?: string`
  - `owner?: UserInfo`
  - `memberCount?: number`
  - `maxMembers?: number`
  - `createdAt?: number`
  - `disabled?: boolean`
  - `ext?: string`
  - `announcement?: string`
  - `permissionType?: ChatRoomPermissionType`
  - `currentUserStatus?: ChatRoomCurrentUserStatus`
- **已确认来源**:
  - 与群组详情同构的聊天室详情字段按聊天室公共面收敛为 `id/name/description/maxusers/owner/created/custom/affiliations_count/disabled`
- **约束**:
  - `memberCount` 由原始 `affiliations_count` 归一化
  - `ext` 由原始 `custom` 归一化
  - `maxMembers` 由原始 `maxusers` / `max_users` 归一化
  - `permissionType` 需要基于 owner/admin/member/current user 关系计算
  - `currentUserStatus.muteExpireAt` 仅在 upstream 可判断时提供，不臆造

## 8) UpdateChatRoomInfoInput

- **描述**: `updateChatRoomInfo` 的输入模型。
- **关键字段**:
  - `chatRoomId: string`
  - `name?: string`
  - `description?: string`
  - `maxMembers?: number`
- **已确认来源**:
  - `docs/reference/chatroom-api.md` 中“updateChatRoomInfo”样例确认原始成功结果字段为 `groupname/description/maxusers`
- **校验规则**:
  - `chatRoomId` 必填
  - 至少一个可修改字段存在

## 9) ChatRoomUserBatchInput

- **描述**: 适用于成员、黑名单、allowlist 等批量用户操作的统一输入模型。
- **关键字段**:
  - `chatRoomId: string`
  - `userIds: string[]`
- **校验规则**:
  - `chatRoomId` 必填
  - `userIds` 必须为非空数组
  - 元素必须为非空字符串
  - 去重后保持剩余用户 ID 顺序

## 10) ChatRoomAdminInput

- **描述**: `setAdmin` / `removeAdmin` 的单用户输入模型。
- **关键字段**:
  - `chatRoomId: string`
  - `userId: string`
- **校验规则**:
  - `chatRoomId` 必填
  - `userId` 必须为非空字符串

## 11) GetChatRoomAttributesInput

- **描述**: `getAttributes({ keys?: string[] })` 的输入模型。
- **关键字段**:
  - `chatRoomId: string`
  - `keys?: string[]`
- **校验规则**:
  - `chatRoomId` 必填
  - `keys` 若传入，必须为字符串数组
  - 不传 `keys` 时表示获取全部属性

## 12) SetChatRoomAttributeInput

- **描述**: `setAttribute` 的单键属性输入模型。
- **关键字段**:
  - `chatRoomId: string`
  - `key: string`
  - `value: string`
- **校验规则**:
  - `chatRoomId`、`key`、`value` 必填

## 13) RemoveChatRoomAttributeInput

- **描述**: `removeAttribute` 的单键属性删除输入模型。
- **关键字段**:
  - `chatRoomId: string`
  - `key: string`
- **校验规则**:
  - `chatRoomId`、`key` 必填

## 14) MuteChatRoomMembersInput

- **描述**: `muteMembers` 的输入模型。
- **关键字段**:
  - `chatRoomId: string`
  - `userIds: string[]`
  - `muteDuration: number`
- **校验规则**:
  - `muteDuration` 必须为数字
  - `-1` 表示永久禁言

## 15) ChatRoomMemberEntry

- **描述**: 聊天室成员列表条目。
- **关键字段**:
  - `user: UserInfo`
  - `role?: 'owner' | 'admin' | 'member'`
  - `joinedAt?: number`
- **映射规则**:
  - 若服务端只返回用户 ID，则先补齐 `user`
  - 与 027 群成员同构时，`owner/admin/member` 由原始 key 推导
  - 成员列表响应中若未提供加入时间，不应臆造 `joinedAt`

## 16) ChatRoomMemberListResult

- **描述**: 聊天室成员列表查询结果。
- **关键字段**:
  - `items: ChatRoomMemberEntry[]`
  - `cursor?: string`
  - `pageSize?: number`
- **约束**:
  - 与 027 群成员列表的分页语义保持一致
  - `items` 中的 `user` 统一对象化

## 17) ChatRoomMuteEntry

- **描述**: 聊天室禁言条目。
- **关键字段**:
  - `user: UserInfo`
  - `muteExpire?: number`
  - `muteDuration?: number`
- **映射规则**:
  - 用户对象补齐策略与成员列表一致
  - 若 upstream 未携带禁言截止时间，则 `muteExpire` / `muteDuration` 保持可选且不臆造

## 18) ChatRoomAllowlistEntry

- **描述**: 聊天室 allowlist 条目。
- **关键字段**:
  - `user: UserInfo`
- **映射规则**:
  - 与 027 群 allowlist 同构时，原始 `string[]` 或用户名数组都归一化为对象化用户条目

## 19) ChatRoomBlocklistEntry

- **描述**: 聊天室黑名单条目。
- **关键字段**:
  - `user: UserInfo`
- **映射规则**:
  - 与 027 群黑名单同构时，原始 `string[]` 或用户名数组都归一化为对象化用户条目

## 20) ChatRoomAnnouncement

- **描述**: 聊天室公告结果对象。
- **关键字段**:
  - `announcement: string`
- **映射规则**:
  - 与 027 群公告同构时，原始 `data.announcement` 归一化为 `announcement`

## 21) ChatRoomSharedFile

- **描述**: 聊天室共享文件对象。
- **关键字段**:
  - `fileId: string`
  - `fileName: string`
  - `fileOwner?: UserInfo`
  - `fileSize?: number`
  - `createdAt?: number`
- **映射规则**:
  - 沿用 027 群共享文件的同构归一化规则：`file_id/file_owner/file_name/file_size/created`
  - `fileOwner` 优先对象化；若无资料仅保留最小 `userId`
- **约束**:
  - 本期只覆盖读取与删除，不定义上传结果模型

## 22) ChatRoomAttributesSnapshot

- **描述**: 聊天室属性读取结果对象，表示当前可见属性键值集合。
- **关键字段**:
  - `chatRoomId: string`
  - `attributes: Record<string, string>`
- **已确认来源**:
  - `docs/reference/chatroom-api.md` 中“getAttributes”样例确认原始 `data` 即 key-value map

## 23) ChatRoomAttributeMutationResult

- **描述**: 聊天室属性写入/删除的标准化结果对象。
- **关键字段**:
  - `chatRoomId: string`
  - `appliedKeys: string[]`
  - `failedKeys: Record<string, string>`
- **已确认来源**:
  - `docs/reference/chatroom-api.md` 中“setAttributes/removeAttributes”样例确认原始 `data.successKeys` 与 `data.errorKeys`
- **约束**:
  - 对外默认暴露稳定业务命名 `appliedKeys/failedKeys`
  - 不继续把原始 metadata envelope 当作主返回结构

## 24) ChatRoomMemberActionResult

- **描述**: 添加/移除成员、黑名单、allowlist 等批量操作的标准化结果。
- **关键字段**:
  - `chatRoomId: string`
  - `user: UserInfo`
  - `action: string`
  - `success: boolean`
  - `reason?: string`
- **已确认来源**:
  - `docs/reference/chatroom-api.md` 中“addMembers/removeMembers”、“blockMembers/unblockMembers”、“addUsersToAllowlist/removeUsersFromAllowlist”样例确认原始结果可能为单对象或数组，且都包含 `result/action/user/id|chatroomid/reason`
- **约束**:
  - 单对象与数组结果统一收敛为稳定业务模型
  - `user` 统一对象化

## 25) ChatRoomEventPayloads

- **描述**: ChatRoomManager 的一组公开事件载荷，按 Web SDK 命名规范拆分并覆盖移动端聊天室事件业务语义。
- **覆盖事件**:
  - `onChatRoomDestroyed`
  - `onMembersJoined`
  - `onMembersExited`
  - `onRemovedFromChatRoom`
  - `onMuteListAdded`
  - `onMuteListRemoved`
  - `onAllowListAdded`
  - `onAllowListRemoved`
  - `onAllMemberMuteStateChanged`
  - `onAdminAdded`
  - `onAdminRemoved`
  - `onOwnerChanged`
  - `onAnnouncementChanged`
  - `onChatRoomInfoChanged`
  - `onAttributesUpdate`
  - `onAttributesRemoved`
- **关键字段**:
  - `chatRoomId: string`
  - `chatRoomName?: string`
  - `members?: UserInfo[]`
  - `admin?: UserInfo`
  - `owner?: UserInfo`
  - `allowlist?: UserInfo[]`
  - `muteList?: ChatRoomMuteEntry[]`
  - `announcement?: string`
  - `chatRoomInfo?: ChatRoomDetail`
  - `attributes?: Record<string, string>`
  - `keyList?: string[]`
  - `from?: UserInfo | { userId: string }`
  - `reason?: number`
  - `ext?: string`
- **约束**:
  - 事件名按 Web SDK 命名规范收敛，用户相关字段保持 Web 对象化语义
  - `onChatRoomInfoChanged.chatRoomInfo` 必须满足完整 `ChatRoomDetail` 语义
  - 不包含共享文件上传/删除事件
