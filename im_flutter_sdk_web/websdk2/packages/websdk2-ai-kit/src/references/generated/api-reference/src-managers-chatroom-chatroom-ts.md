---
id: generated/api-reference/src-managers-chatroom-chatroom-ts
title: websdk2 API Reference - ChatRoom API
description: 来自 docs/reference/api-reference.zh-CN.md 的 src/managers/chatroom/chatroom.ts API Reference 分段。
---

## src/managers/chatroom/chatroom.ts

### ChatRoom

### getInfo() => Promise<ChatRoomDetail>

#### 说明

获取当前聊天室详情。

#### 调用示例

调用示例（获取详情）

```ts
const chatRoom = client.chatRoomManager.getChatRoom('chatroom-1');
const detail = await chatRoom.getInfo();
```

#### 返回值

返回聊天室详情、公告、权限与当前用户状态。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### refresh() => Promise<ChatRoomDetail>

#### 说明

刷新并返回当前聊天室详情，等价于 `getInfo()`。

#### 调用示例

调用示例（刷新详情）

```ts
const detail = await chatRoom.refresh();
```

#### 返回值

返回最新聊天室详情。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### updateInfo(input: ChatRoomUpdateInfoInput) => Promise<ChatRoomUpdateResult>

#### 说明

更新当前聊天室名称、描述或最大成员数。

#### 调用示例

调用示例（更新聊天室信息）

```ts
await chatRoom.updateInfo({ name: 'SDK room' });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `ChatRoomUpdateInfoInput` | 更新字段，`name/description/maxMembers` 至少传入一项。 |

#### 返回值

返回各字段是否更新成功。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | 当前用户不是聊天室 owner/admin，无法修改聊天室信息 | 使用聊天室 owner/admin 账号重试 |
| 110 | forbidden_op | 聊天室名称、描述或最大人数超过服务端限制 | 缩短名称/描述，或传入允许范围内的 maxMembers |
| 110 | illegal_argument | 请求中包含 chatroom_id 等不允许修改的字段 | 仅提交 name、description、maxMembers 等允许修改的字段 |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### leaveChatRoom() => Promise<void>

#### 说明

退出当前聊天室。

#### 调用示例

调用示例（退出聊天室）

```ts
await chatRoom.leaveChatRoom();
```

#### 返回值

成功时无返回业务数据。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### getMembers(query: CursorPageParams) => Promise<ChatRoomMemberListResult>

#### 说明

获取当前聊天室成员列表。

#### 调用示例

调用示例（获取成员）

```ts
const members = await chatRoom.getMembers({ pageSize: 20 });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| query | `CursorPageParams` | 游标分页参数；未传时使用服务端默认分页。 |

#### 返回值

返回成员列表、游标与是否还有下一页。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### removeMembers(input: ChatRoomUserBatchInput) => Promise<ChatRoomMemberActionListResult>

#### 说明

从当前聊天室移除成员。

#### 调用示例

调用示例（移除成员）

```ts
const result = await chatRoom.removeMembers({ userIds: ['user-1'] });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `ChatRoomUserBatchInput` | 移除输入，`userIds` 必填且至少包含一个用户 ID。 |

#### 返回值

返回每个目标用户的移除结果。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | 当前用户不是聊天室 owner/admin，无法移除成员 | 使用聊天室 owner/admin 账号重试 |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### getAdminList() => Promise<ReadonlyArray<UserInfo>>

#### 说明

获取当前聊天室管理员列表。

#### 调用示例

调用示例（获取管理员）

```ts
const admins = await chatRoom.getAdminList();
```

#### 返回值

返回管理员用户资料列表。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### addAdmin(input: ChatRoomAdminInput) => Promise<void>

#### 说明

将用户设置为当前聊天室管理员。

#### 调用示例

调用示例（添加管理员）

```ts
await chatRoom.addAdmin({ userId: 'user-1' });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `ChatRoomAdminInput` | 管理员输入，`userId` 必填。 |

#### 返回值

成功时无返回业务数据。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | 当前用户不是聊天室所有者，无法设置管理员 | 使用聊天室 owner 账号重试 |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |
| 204 | service_resource_not_found | 待设置为管理员的用户不存在 | 确认 userId 对应用户存在 |

### removeAdmin(input: ChatRoomAdminInput) => Promise<void>

#### 说明

移除当前聊天室管理员。

#### 调用示例

调用示例（移除管理员）

```ts
await chatRoom.removeAdmin({ userId: 'user-1' });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `ChatRoomAdminInput` | 管理员输入，`userId` 必填。 |

#### 返回值

成功时无返回业务数据。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | 当前用户不是聊天室所有者，无法移除管理员 | 使用聊天室 owner 账号重试 |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### getMuteList(page: ChatRoomPageParams) => Promise<ReadonlyArray<ChatRoomMuteEntry>>

#### 说明

获取当前聊天室禁言列表。

#### 调用示例

调用示例（获取禁言列表）

```ts
const mutes = await chatRoom.getMuteList({ pageNum: 1, pageSize: 20 });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| page | `ChatRoomPageParams` | 页码分页参数；未传时使用服务端默认分页。 |

#### 返回值

返回禁言用户与过期时间列表。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### muteMembers(input: ChatRoomMuteMembersInput) => Promise<void>

#### 说明

禁言当前聊天室成员。

#### 调用示例

调用示例（禁言成员）

```ts
await chatRoom.muteMembers({ userIds: ['user-1'], duration: 3600 });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `ChatRoomMuteMembersInput` | 禁言输入，包含非空 `userIds` 与禁言时长 `duration`（秒）。 |

#### 返回值

成功时无返回业务数据。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | illegal_argument | muteDuration、userIds 或请求体字段不符合服务端约束 | 检查 userIds 与 muteDuration，确保传入有效值 |
| 210 | group_authorization | 当前用户不是聊天室 owner/admin，无法禁言成员 | 使用聊天室 owner/admin 账号重试 |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### unmuteMembers(input: ChatRoomUserBatchInput) => Promise<void>

#### 说明

解除当前聊天室成员禁言。

#### 调用示例

调用示例（解除禁言）

```ts
await chatRoom.unmuteMembers({ userIds: ['user-1'] });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `ChatRoomUserBatchInput` | 解除禁言输入，`userIds` 必填且至少包含一个用户 ID。 |

#### 返回值

成功时无返回业务数据。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | 当前用户不是聊天室 owner/admin，无法解除禁言 | 使用聊天室 owner/admin 账号重试 |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### muteAllMembers() => Promise<void>

#### 说明

开启当前聊天室全员禁言。

#### 调用示例

调用示例（开启全员禁言）

```ts
await chatRoom.muteAllMembers();
```

#### 返回值

成功时无返回业务数据。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | 当前用户不是聊天室 owner/admin，无法开启全员禁言 | 使用聊天室 owner/admin 账号重试 |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### unmuteAllMembers() => Promise<void>

#### 说明

关闭当前聊天室全员禁言。

#### 调用示例

调用示例（关闭全员禁言）

```ts
await chatRoom.unmuteAllMembers();
```

#### 返回值

成功时无返回业务数据。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | 当前用户不是聊天室 owner/admin，无法关闭全员禁言 | 使用聊天室 owner/admin 账号重试 |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### checkIfInMuteList() => Promise<ChatRoomMuteStatus>

#### 说明

查询当前用户是否在当前聊天室禁言列表中。

#### 调用示例

调用示例（查询禁言状态）

```ts
const status = await chatRoom.checkIfInMuteList();
```

#### 返回值

返回当前用户是否被禁言及过期时间。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### getBlocklist(page: ChatRoomPageParams) => Promise<ReadonlyArray<ChatRoomBlocklistEntry>>

#### 说明

获取当前聊天室黑名单。

#### 调用示例

调用示例（获取黑名单）

```ts
const blocklist = await chatRoom.getBlocklist({ pageNum: 1, pageSize: 20 });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| page | `ChatRoomPageParams` | 页码分页参数；未传时使用服务端默认分页。 |

#### 返回值

返回黑名单用户列表。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### blockMembers(input: ChatRoomUserBatchInput) => Promise<ChatRoomMemberActionListResult>

#### 说明

将成员加入当前聊天室黑名单。

#### 调用示例

调用示例（拉黑成员）

```ts
const result = await chatRoom.blockMembers({ userIds: ['user-1'] });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `ChatRoomUserBatchInput` | 拉黑输入，`userIds` 必填且至少包含一个用户 ID。 |

#### 返回值

返回每个目标用户的拉黑结果。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | 当前用户不是聊天室 owner/admin，无法拉黑成员 | 使用聊天室 owner/admin 账号重试 |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |
| 204 | service_resource_not_found | 待加入黑名单的用户不存在 | 确认 userIds 中的用户都已存在 |

### unblockMembers(input: ChatRoomUserBatchInput) => Promise<ChatRoomMemberActionListResult>

#### 说明

从当前聊天室黑名单移除成员。

#### 调用示例

调用示例（移除黑名单）

```ts
const result = await chatRoom.unblockMembers({ userIds: ['user-1'] });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `ChatRoomUserBatchInput` | 移除输入，`userIds` 必填且至少包含一个用户 ID。 |

#### 返回值

返回每个目标用户的移除结果。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | 当前用户不是聊天室 owner/admin，无法移除黑名单成员 | 使用聊天室 owner/admin 账号重试 |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### getAllowlist() => Promise<ReadonlyArray<{ readonly user: UserInfo }>>

#### 说明

获取当前聊天室 allowlist。

#### 调用示例

调用示例（获取 allowlist）

```ts
const allowlist = await chatRoom.getAllowlist();
```

#### 返回值

返回 allowlist 用户列表。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### addUsersToAllowlist(input: ChatRoomUserBatchInput) => Promise<ChatRoomMemberActionListResult>

#### 说明

将用户加入当前聊天室 allowlist。

#### 调用示例

调用示例（添加 allowlist）

```ts
const result = await chatRoom.addUsersToAllowlist({ userIds: ['user-1'] });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `ChatRoomUserBatchInput` | 添加输入，`userIds` 必填且至少包含一个用户 ID。 |

#### 返回值

返回每个目标用户的添加结果。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | 当前用户不是聊天室 owner/admin，无法修改 allowlist | 使用聊天室 owner/admin 账号重试 |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |
| 204 | service_resource_not_found | 待加入 allowlist 的用户不存在 | 确认 userIds 中的用户都已存在 |

### removeUsersFromAllowlist(input: ChatRoomUserBatchInput) => Promise<ChatRoomMemberActionListResult>

#### 说明

从当前聊天室 allowlist 移除用户。

#### 调用示例

调用示例（移除 allowlist）

```ts
const result = await chatRoom.removeUsersFromAllowlist({ userIds: ['user-1'] });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `ChatRoomUserBatchInput` | 移除输入，`userIds` 必填且至少包含一个用户 ID。 |

#### 返回值

返回每个目标用户的移除结果。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | 当前用户不是聊天室 owner/admin，无法修改 allowlist | 使用聊天室 owner/admin 账号重试 |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### checkIfInAllowList() => Promise<boolean>

#### 说明

查询当前用户是否在当前聊天室 allowlist 中。

#### 调用示例

调用示例（查询 allowlist 状态）

```ts
const status = await chatRoom.checkIfInAllowList();
```

#### 返回值

返回当前用户是否在 allowlist 中。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### getAnnouncement() => Promise<ChatRoomAnnouncement>

#### 说明

获取当前聊天室公告。

#### 调用示例

调用示例（获取公告）

```ts
const announcement = await chatRoom.getAnnouncement();
```

#### 返回值

返回聊天室 ID 与公告内容。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### updateAnnouncement(input: ChatRoomAnnouncementUpdateInput) => Promise<void>

#### 说明

更新当前聊天室公告。

#### 调用示例

调用示例（更新公告）

```ts
await chatRoom.updateAnnouncement({ announcement: 'Welcome' });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `ChatRoomAnnouncementUpdateInput` | 公告更新输入，`announcement` 必填。 |

#### 返回值

成功时无返回业务数据。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | 当前用户不是聊天室 owner/admin，无法修改公告 | 使用聊天室 owner/admin 账号重试 |
| 110 | forbidden_op | 公告长度超过服务端允许上限 | 缩短公告内容后重试 |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### getAttributes(input: GetChatRoomAttributesInput) => Promise<ChatRoomAttributesSnapshot>

#### 说明

获取当前聊天室属性。

#### 调用示例

调用示例（获取属性）

```ts
const snapshot = await chatRoom.getAttributes({ keys: ['topic'] });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `GetChatRoomAttributesInput` | 查询输入，可传 `keys` 获取指定属性；未传时获取全部属性。 |

#### 返回值

返回聊天室属性快照。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | illegal_argument | keys 为空字符串、包含非法值，或请求体格式不符合要求 | 确保 keys 为合法非空字符串数组，或省略 keys 获取全部属性 |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### setAttributes(input: SetChatRoomAttributesInput) => Promise<ChatRoomAttributeMutationResult>

#### 说明

设置当前聊天室属性。

#### 调用示例

调用示例（设置属性）

```ts
const result = await chatRoom.setAttributes({
  attributes: { topic: 'sdk' },
  autoDelete: true,
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `SetChatRoomAttributesInput` | 设置输入，包含非空 `attributes`，可选 `autoDelete/isForced`。 |

#### 返回值

返回成功应用和失败的属性 key。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | illegal_argument | 属性 key 数量超过限制，或属性字段格式不符合要求 | 确保每次设置的属性数量不超过限制，且 key/value 均为合法字符串 |
| 702 | chatroom_not_joined | 当前用户未加入目标聊天室，无法设置属性 | 先加入聊天室后重试 |
| 703 | chatroom_permission_denied | 当前用户无权设置目标属性（属性不属于当前用户且未使用 forced 模式） | 仅修改自己创建的属性，或使用 forced 模式覆盖 |
| 4 | exceed_limit | 单个聊天室属性数量或应用级属性总量超过服务端限制 | 删除不再使用的属性后重试，或联系服务端提升配额 |
| 210 | MetadataException | 当前用户不在聊天室内，或试图修改其他用户的聊天室属性 | 确认当前用户已加入聊天室，并仅修改自己有权限操作的属性 |

### removeAttributes(input: RemoveChatRoomAttributesInput) => Promise<ChatRoomAttributeMutationResult>

#### 说明

删除当前聊天室属性。

#### 调用示例

调用示例（删除属性）

```ts
const result = await chatRoom.removeAttributes({ keys: ['topic'] });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `RemoveChatRoomAttributesInput` | 删除输入，`keys` 必填且至少包含一个属性 key，可选 `isForced`。 |

#### 返回值

返回成功删除和失败的属性 key。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | illegal_argument | 属性 key 数量超过限制，或 keys 字段格式不符合要求 | 确保每次删除的属性数量不超过限制，且 keys 为合法非空字符串数组 |
| 702 | chatroom_not_joined | 当前用户未加入目标聊天室，无法删除属性 | 先加入聊天室后重试 |
| 703 | chatroom_permission_denied | 当前用户无权删除目标属性 | 仅删除自己创建的属性，或使用 forced 模式 |
| 4 | exceed_limit | 属性操作超过服务端限制 | 减少单次操作的属性数量 |
| 210 | MetadataException | 当前用户不在聊天室内，或无权删除目标属性 | 确认当前用户已加入聊天室，并仅删除自己有权限操作的属性 |
