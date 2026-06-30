---
id: generated/api-reference/src-managers-group-group-ts
title: websdk2 API Reference - Group API
description: 来自 docs/reference/api-reference.zh-CN.md 的 src/managers/group/group.ts API Reference 分段。
---

## src/managers/group/group.ts

### Group

### getDetail() => Promise<GroupDetail>

#### 说明

获取当前群组详情；优先返回当前会话内可用快照，必要时从服务端刷新。

#### 调用示例

获取群详情

```ts
const group = client.groupManager.getGroup('group-1');
const detail = await group.getDetail();
```

#### 返回值

返回标准化群详情。

#### 可能错误

- 错误码 `110`：群 ID 非法或群组不存在。
- 错误码 `202`：鉴权失败。

### refresh() => Promise<GroupDetail>

#### 说明

强制从服务端刷新当前群组详情。

#### 调用示例

刷新群详情

```ts
const detail = await client.groupManager.getGroup('group-1').refresh();
```

#### 返回值

返回刷新后的标准化群详情。

#### 可能错误

- 错误码 `110`：群 ID 非法或群组不存在。
- 错误码 `202`：鉴权失败。

### updateInfo(input: GroupUpdateInfoInput) => Promise<void>

#### 说明

更新当前群组基础资料，例如名称、描述、头像或扩展字段。

#### 调用示例

更新群名称

```ts
await client.groupManager.getGroup('group-1').updateInfo({ name: 'New group name' });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `GroupUpdateInfoInput` | 群资料更新字段。 |

#### 返回值

成功时无返回值。

#### 可能错误

- 错误码 `110`：参数非法或群组不存在。
- 错误码 `202`：鉴权失败。

### updateConfigs(input: GroupUpdateConfigsInput) => Promise<void>

#### 说明

更新当前群组配置，例如公开属性、入群审批、成员邀请权限或人数上限。

#### 调用示例

关闭成员邀请

```ts
await client.groupManager.getGroup('group-1').updateConfigs({ allowInvites: false });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `GroupUpdateConfigsInput` | 群配置更新字段。 |

#### 返回值

成功时无返回值。

#### 可能错误

- 错误码 `110`：参数非法或群组不存在。
- 错误码 `202`：鉴权失败。

### changeOwner(input: GroupOwnerChangeInput) => Promise<void>

#### 说明

转让当前群组所有权。

#### 调用示例

转让群主

```ts
await client.groupManager.getGroup('group-1').changeOwner({ newOwner: 'user-2' });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `GroupOwnerChangeInput` | 新群主用户 ID。 |

#### 返回值

成功时无返回值。

#### 可能错误

- 错误码 `110`：新群主非法、不在群内或群组不存在。
- 错误码 `202`：鉴权失败。

### destroy() => Promise<void>

#### 说明

解散当前群组。

#### 调用示例

解散群组

```ts
await client.groupManager.getGroup('group-1').destroy();
```

#### 返回值

成功时无返回值。

#### 可能错误

- 错误码 `110`：群 ID 非法或群组不存在。
- 错误码 `202`：鉴权失败或无权限。

### leave() => Promise<void>

#### 说明

当前登录用户主动退出群组。

#### 调用示例

退出群组

```ts
await client.groupManager.getGroup('group-1').leave();
```

#### 返回值

成功时无返回值。

#### 可能错误

- 错误码 `110`：群 ID 非法、群组不存在或当前用户不在群内。
- 错误码 `202`：鉴权失败。

### getMembers(query: GroupMemberListQuery) => Promise<GroupMemberListResult>

#### 说明

分页获取当前群组成员列表。

#### 调用示例

获取群成员

```ts
const page = await client.groupManager.getGroup('group-1').getMembers({ pageSize: 20 });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| query | `GroupMemberListQuery` | 可选分页参数。 |

#### 返回值

返回成员分页结果。

#### 可能错误

- 错误码 `110`：群 ID 或分页参数非法。
- 错误码 `202`：鉴权失败。

### removeMembers(input: GroupUserBatchInput) => Promise<void>

#### 说明

从当前群组移除成员。

#### 调用示例

移除群成员

```ts
await client.groupManager.getGroup('group-1').removeMembers({ userIds: ['user-2'] });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `GroupUserBatchInput` | 待移除成员 ID 列表。 |

#### 返回值

成功时无返回值。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | 当前用户不是聊天室 owner/admin，无法移除成员 | 使用聊天室 owner/admin 账号重试 |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### getAdmins() => Promise<ReadonlyArray<UserInfo>>

#### 说明

获取当前群组管理员列表。

#### 调用示例

获取管理员

```ts
const admins = await client.groupManager.getGroup('group-1').getAdmins();
```

#### 返回值

返回管理员用户资料列表。

#### 可能错误

- 错误码 `110`：群 ID 非法或群组不存在。
- 错误码 `202`：鉴权失败。

### addAdmin(input: { userId: string }) => Promise<void>

#### 说明

添加群管理员。

#### 调用示例

添加管理员

```ts
await client.groupManager.getGroup('group-1').addAdmin({ userId: 'user-2' });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `{ userId: string }` | 管理员用户 ID。 |

#### 返回值

成功时无返回值。

#### 可能错误

- 错误码 `110`：用户 ID 非法、用户不在群内或群组不存在。
- 错误码 `202`：鉴权失败或无权限。

### removeAdmin(input: { userId: string }) => Promise<void>

#### 说明

移除群管理员。

#### 调用示例

移除管理员

```ts
await client.groupManager.getGroup('group-1').removeAdmin({ userId: 'user-2' });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `{ userId: string }` | 管理员用户 ID。 |

#### 返回值

成功时无返回值。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | 当前用户不是聊天室所有者，无法移除管理员 | 使用聊天室 owner 账号重试 |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### getMuteList(page: GroupMuteListQuery) => Promise<ReadonlyArray<GroupMuteEntry>>

#### 说明

获取当前群组禁言列表。

#### 调用示例

获取禁言列表

```ts
const mutes = await client.groupManager.getGroup('group-1').getMuteList({ pageSize: 20 });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| page | `GroupMuteListQuery` | 可选分页参数。 |

#### 返回值

返回禁言成员列表。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### muteMembers(input: GroupMuteMembersInput) => Promise<void>

#### 说明

禁言当前群组中的指定成员。

#### 调用示例

禁言成员

```ts
await client.groupManager.getGroup('group-1').muteMembers({
  userIds: ['user-2'],
  muteDuration: 3600,
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `GroupMuteMembersInput` | 成员 ID 列表与禁言时长，单位秒。 |

#### 返回值

成功时无返回值。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | illegal_argument | muteDuration、userIds 或请求体字段不符合服务端约束 | 检查 userIds 与 muteDuration，确保传入有效值 |
| 210 | group_authorization | 当前用户不是聊天室 owner/admin，无法禁言成员 | 使用聊天室 owner/admin 账号重试 |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### unmuteMembers(input: GroupUserBatchInput) => Promise<void>

#### 说明

解除当前群组中指定成员的禁言。

#### 调用示例

解除禁言

```ts
await client.groupManager.getGroup('group-1').unmuteMembers({ userIds: ['user-2'] });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `GroupUserBatchInput` | 待解除禁言的成员 ID 列表。 |

#### 返回值

成功时无返回值。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | 当前用户不是聊天室 owner/admin，无法解除禁言 | 使用聊天室 owner/admin 账号重试 |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### muteAllMembers() => Promise<void>

#### 说明

开启当前群组全员禁言。

#### 调用示例

开启全员禁言

```ts
await client.groupManager.getGroup('group-1').muteAllMembers();
```

#### 返回值

成功时无返回值。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | 当前用户不是聊天室 owner/admin，无法开启全员禁言 | 使用聊天室 owner/admin 账号重试 |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### unmuteAllMembers() => Promise<void>

#### 说明

关闭当前群组全员禁言。

#### 调用示例

关闭全员禁言

```ts
await client.groupManager.getGroup('group-1').unmuteAllMembers();
```

#### 返回值

成功时无返回值。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | 当前用户不是聊天室 owner/admin，无法关闭全员禁言 | 使用聊天室 owner/admin 账号重试 |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### getBlocklist(page: NumberPageParams) => Promise<ReadonlyArray<GroupBlocklistEntry>>

#### 说明

获取当前群组黑名单列表。

#### 调用示例

获取群黑名单

```ts
const blocklist = await client.groupManager.getGroup('group-1').getBlocklist({ pageSize: 20 });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| page | `NumberPageParams` | 可选分页参数。 |

#### 返回值

返回黑名单成员列表。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### blockMembers(input: GroupUserBatchInput) => Promise<void>

#### 说明

将指定成员加入当前群组黑名单。

#### 调用示例

加入黑名单

```ts
await client.groupManager.getGroup('group-1').blockMembers({ userIds: ['user-2'] });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `GroupUserBatchInput` | 待加入黑名单的成员 ID 列表。 |

#### 返回值

成功时无返回值。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | 当前用户不是聊天室 owner/admin，无法拉黑成员 | 使用聊天室 owner/admin 账号重试 |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |
| 204 | service_resource_not_found | 待加入黑名单的用户不存在 | 确认 userIds 中的用户都已存在 |

### unblockMembers(input: GroupUserBatchInput) => Promise<void>

#### 说明

将指定成员移出当前群组黑名单。

#### 调用示例

移出黑名单

```ts
await client.groupManager.getGroup('group-1').unblockMembers({ userIds: ['user-2'] });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `GroupUserBatchInput` | 待移出黑名单的成员 ID 列表。 |

#### 返回值

成功时无返回值。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | 当前用户不是聊天室 owner/admin，无法移除黑名单成员 | 使用聊天室 owner/admin 账号重试 |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### getAllowlist() => Promise<ReadonlyArray<GroupAllowlistEntry>>

#### 说明

获取当前群组白名单列表。

#### 调用示例

获取白名单

```ts
const allowlist = await client.groupManager.getGroup('group-1').getAllowlist();
```

#### 返回值

返回白名单成员列表。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### addUsersToAllowlist(input: GroupUserBatchInput) => Promise<void>

#### 说明

将指定成员加入当前群组白名单。

#### 调用示例

加入白名单

```ts
await client.groupManager.getGroup('group-1').addUsersToAllowlist({ userIds: ['user-2'] });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `GroupUserBatchInput` | 待加入白名单的成员 ID 列表。 |

#### 返回值

成功时无返回值。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | 当前用户不是聊天室 owner/admin，无法修改 allowlist | 使用聊天室 owner/admin 账号重试 |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |
| 204 | service_resource_not_found | 待加入 allowlist 的用户不存在 | 确认 userIds 中的用户都已存在 |

### removeUsersFromAllowlist(input: GroupUserBatchInput) => Promise<void>

#### 说明

将指定成员移出当前群组白名单。

#### 调用示例

移出白名单

```ts
await client.groupManager.getGroup('group-1').removeUsersFromAllowlist({ userIds: ['user-2'] });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `GroupUserBatchInput` | 待移出白名单的成员 ID 列表。 |

#### 返回值

成功时无返回值。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | 当前用户不是聊天室 owner/admin，无法修改 allowlist | 使用聊天室 owner/admin 账号重试 |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### checkIfInAllowList() => Promise<boolean>

#### 说明

查询当前用户是否在当前群组白名单中。

#### 调用示例

查询是否在白名单

```ts
const inAllowlist = await client.groupManager.getGroup('group-1').checkIfInAllowList();
```

#### 返回值

当前用户在白名单中返回 `true`。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### checkIfInMuteList() => Promise<boolean>

#### 说明

查询当前用户是否在当前群组禁言列表中。

#### 调用示例

查询是否被禁言

```ts
const muted = await client.groupManager.getGroup('group-1').checkIfInMuteList();
```

#### 返回值

当前用户在禁言列表中返回 `true`。

#### 可能错误

- 错误码 `110`：群 ID 非法或群组不存在。
- 错误码 `202`：鉴权失败。

### getAnnouncement() => Promise<GroupAnnouncement>

#### 说明

获取当前群组公告。

#### 调用示例

获取群公告

```ts
const announcement = await client.groupManager.getGroup('group-1').getAnnouncement();
```

#### 返回值

返回群公告对象。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### updateAnnouncement(input: GroupAnnouncementUpdateInput) => Promise<void>

#### 说明

更新当前群组公告。

#### 调用示例

更新群公告

```ts
await client.groupManager.getGroup('group-1').updateAnnouncement({ announcement: 'Welcome' });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `GroupAnnouncementUpdateInput` | 新公告内容。 |

#### 返回值

成功时无返回值。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | 当前用户不是聊天室 owner/admin，无法修改公告 | 使用聊天室 owner/admin 账号重试 |
| 110 | forbidden_op | 公告长度超过服务端允许上限 | 缩短公告内容后重试 |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### getSharedFileList(query: GroupSharedFileListQuery) => Promise<GroupSharedFileListResult>

#### 说明

分页获取当前群组共享文件列表。

#### 调用示例

获取共享文件

```ts
const files = await client.groupManager.getGroup('group-1').getSharedFileList({ pageSize: 20 });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| query | `GroupSharedFileListQuery` | 可选分页参数。 |

#### 返回值

返回共享文件分页结果。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### uploadSharedFile(input: GroupUploadSharedFileInput) => Promise<void>

#### 说明

上传文件到当前群组共享文件列表。

#### 调用示例

上传共享文件

```ts
await client.groupManager.getGroup('group-1').uploadSharedFile({
  file,
  onFileUploadProgress: event => console.log(event.loaded),
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `GroupUploadSharedFileInput` | 文件对象与上传回调。 |

#### 返回值

成功时无返回值。

#### 可能错误

- 错误码 `110`：群 ID 或文件参数非法。
- 错误码 `202`：鉴权失败或无权限。
- 错误码 `1`：上传被取消或平台上传失败。

### deleteSharedFile(input: GroupDeleteSharedFileInput) => Promise<void>

#### 说明

删除当前群组共享文件。

#### 调用示例

删除共享文件

```ts
await client.groupManager.getGroup('group-1').deleteSharedFile({ fileId: 'file-1' });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `GroupDeleteSharedFileInput` | 共享文件 ID。 |

#### 返回值

成功时无返回值。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 210 | group_authorization | 当前用户不是聊天室 owner/admin，无法删除共享文件 | 使用聊天室 owner/admin 账号重试 |
| 606 | resource_not_found | chatRoomId 不存在、聊天室已被销毁，或共享文件不存在 | 确认 chatRoomId 与 fileId 正确且资源仍存在 |

### downloadSharedFile(input: GroupDownloadSharedFileInput) => Promise<void>

#### 说明

下载当前群组共享文件，下载完成后通过回调返回 Blob 数据。

#### 调用示例

下载共享文件

```ts
await client.groupManager.getGroup('group-1').downloadSharedFile({
  fileId: 'file-1',
  onFileDownloadComplete: blob => console.log(blob.size),
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `GroupDownloadSharedFileInput` | 文件 ID、可选 secret 与下载回调。 |

#### 返回值

下载流程完成时 resolve。

#### 可能错误

- 错误码 `110`：群 ID 或文件 ID 非法。
- 错误码 `202`：鉴权失败。
- 错误码 `303`：HTTP 下载失败。

### setMemberAttributes(input: GroupSetMemberAttributesInput) => Promise<void>

#### 说明

设置当前群组中指定成员的自定义属性；常用于群名片。

#### 调用示例

设置群名片

```ts
await client.groupManager.getGroup('group-1').setMemberAttributes({
  userId: 'user-1',
  memberAttributes: { groupNamecard: 'Alice' },
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `GroupSetMemberAttributesInput` | 成员 ID 与属性键值。 |

#### 返回值

成功时无返回值。

#### 可能错误

- 错误码 `110`：成员 ID、属性 key 或 value 非法。
- 错误码 `4`：属性数量或长度达到服务限制。
- 错误码 `202`：鉴权失败或无权限。

### getMembersAttributes(input: GroupGetMembersAttributesInput) => Promise<GroupMembersAttributesResult>

#### 说明

批量获取当前群组中多个成员的自定义属性。

#### 调用示例

批量获取成员属性

```ts
const result = await client.groupManager.getGroup('group-1').getMembersAttributes({
  userIds: ['user-1', 'user-2'],
  keys: ['groupNamecard'],
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| input | `GroupGetMembersAttributesInput` | 成员 ID 列表与可选属性 key 列表。 |

#### 返回值

返回按成员 ID 索引的属性集合。

#### 可能错误

- 错误码 `110`：成员列表为空、成员 ID 或属性 key 非法。
- 错误码 `202`：鉴权失败。
