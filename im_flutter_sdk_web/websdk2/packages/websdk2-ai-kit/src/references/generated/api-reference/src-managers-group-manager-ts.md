---
id: generated/api-reference/src-managers-group-manager-ts
title: websdk2 API Reference - GroupManager API
description: 来自 docs/reference/api-reference.zh-CN.md 的 src/managers/group-manager.ts API Reference 分段。
---

## src/managers/group-manager.ts

### GroupManager

### addEventHandler(id: EventHandlerId, handlers: GroupEventHandlerMap) => void

#### 说明

注册群组事件处理器。

#### 调用示例

监听群成员加入事件

```ts
client.groupManager.addEventHandler('group-events', {
  onMembersJoined: event => console.log(event.groupId, event.members),
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| id | `EventHandlerId` | 事件处理器唯一 ID，用于后续移除。 |
| handlers | `GroupEventHandlerMap` | 群组事件处理器集合。 |

#### 返回值

注册完成后无返回值。

### removeEventHandler(id: EventHandlerId) => void

#### 说明

移除群组事件处理器。

#### 调用示例

移除监听

```ts
client.groupManager.removeEventHandler('group-events');
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| id | `EventHandlerId` | 待移除的事件处理器 ID。 |

#### 返回值

移除完成后无返回值。

### createGroup(params: CreateGroupParams) => Promise<CreateGroupResult>

#### 说明

创建群组，可指定初始成员、公开属性、入群审批、邀请策略与最大人数。

#### 调用示例

创建公开群

```ts
const result = await client.groupManager.createGroup({
  name: 'Developers',
  description: 'SDK discussion',
  memberIds: ['user-1', 'user-2'],
  public: true,
  joinApprovalRequired: false,
  allowInvites: true,
  inviteNeedConfirm: true,
  maxMembers: 200,
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `CreateGroupParams` | 创建群组参数。 |

#### 返回值

返回创建成功后的群 ID。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | invalid_parameter | 创建群组时缺少 public、name 等必填字段，或字段格式不符合服务端约束 | 检查创建群组请求体，补齐必填字段并修正字段格式 |
| 110 | illegal_argument | 群组 ID 冲突、头像字段过长，或请求字段组合不符合服务端要求 | 更换冲突参数，并确保请求字段长度与取值范围合法 |
| 4 | exceed_limit | 应用可创建群数量、用户可加入群数量或创建群初始成员数量触达服务限制 | 减少创建或加入数量，或联系服务端提升限制 |
| 608 | group_name_violation | 群组名称触发服务端敏感词或命名规范校验 | 更换为合法群组名称后重试 |
| 204 | resource_not_found | 创建群组时附带的成员列表中包含不存在的用户 | 确认 memberIds 中的用户都已存在 |

### getJoinedGroupList(params: GetJoinedGroupListParams) => Promise<GroupListResult>

#### 说明

分页获取当前用户已加入的群组列表。

#### 调用示例

查询已加入群

```ts
const page = await client.groupManager.getJoinedGroupList({
  pageSize: 20,
  needMemberCount: true,
  needRole: true,
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `GetJoinedGroupListParams` | 可选分页与附加字段参数。 |

#### 返回值

返回已加入群分页列表。

#### 可能错误

- 错误码 `110`：分页参数非法。
- 错误码 `202`：鉴权失败。

### getGroup(groupId: string) => Group

#### 说明

获取绑定指定群 ID 的单群操作对象；该方法不发起网络请求。

#### 调用示例

获取单群对象

```ts
const group = client.groupManager.getGroup('group-1');
await group.getDetail();
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | 群组 ID。 |

#### 返回值

返回绑定该群 ID 的 `Group` 对象。

#### 可能错误

- 错误码 `100`：`groupId` 为空。

### getGroupInfo(params: GetGroupInfoParams) => Promise<GroupDetail>

#### 说明

从服务端获取单个群组详情。

#### 调用示例

获取群详情

```ts
const detail = await client.groupManager.getGroupInfo({ groupId: 'group-1' });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `GetGroupInfoParams` | 群组详情查询参数。 |

#### 返回值

返回标准化群详情。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 606 | resource_not_found | groupId 不存在或群组已被销毁 | 确认 groupId 正确且群组仍存在 |

### getGroupInfoList(params: GetGroupInfoListParams) => Promise<ReadonlyArray<GroupDetail>>

#### 说明

批量获取多个群组详情。

#### 调用示例

批量获取群详情

```ts
const groups = await client.groupManager.getGroupInfoList({
  groupIds: ['group-1', 'group-2'],
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `GetGroupInfoListParams` | 群组 ID 列表。 |

#### 返回值

返回标准化群详情数组。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 606 | resource_not_found | groupIds 中存在无效群组 ID | 确认 groupIds 中的群组都存在 |

### joinGroup(params: GroupJoinParams) => Promise<void>

#### 说明

申请加入或直接加入指定群组，取决于群组入群审批配置。

#### 调用示例

加入群组

```ts
await client.groupManager.joinGroup({
  groupId: 'group-1',
  message: 'Please approve my request',
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `GroupJoinParams` | 群组 ID 与可选申请原因。 |

#### 返回值

成功时无返回值。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 600 | group_invalid_id | 传入的 groupId 为空、格式不合法或不符合服务端约束 | 检查并传入合法的 groupId |
| 601 | already_joined | 当前用户已经加入目标群组 | 无需重复加入，直接使用现有群组上下文 |
| 602 | not_joined | 当前用户不在该群组中，或服务端要求当前用户先成为群成员 | 确认当前用户已加入目标群组 |
| 603 | group_authorization | 加入群组需要管理员审批，或当前用户没有权限加入目标群组 | 等待管理员审批，或改用有权限的账号重试 |
| 604 | group_full | 目标群组人数已达到上限，无法继续加入 | 清理群成员或提升群人数上限后重试 |
| 606 | resource_not_found | groupId 不存在或群组已被销毁 | 确认 groupId 正确且群组仍存在 |
| 607 | group_disabled | 目标群组处于禁用状态，服务端拒绝加入 | 确认群组状态恢复正常后再尝试加入 |
| 613 | group_user_in_blocklist | 当前用户处于群组黑名单或禁入名单中，服务端拒绝加入 | 联系群主或管理员移出对应名单后重试 |

### inviteUsersToGroup(params: GroupUserBatchParams) => Promise<void>

#### 说明

邀请用户加入指定群组。

#### 调用示例

邀请成员

```ts
await client.groupManager.inviteUsersToGroup({
  groupId: 'group-1',
  userIds: ['user-2', 'user-3'],
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `GroupUserBatchParams` | 群组 ID 与被邀请用户 ID 列表。 |

#### 返回值

成功时无返回值。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 603 | group_authorization | 当前用户没有邀请成员入群的权限 | 使用有邀请权限的账号重试 |
| 204 | resource_not_found | 被邀请用户不存在 | 确认 userIds 中的用户都已存在 |
| 606 | group_not_found | 目标群组不存在或已被销毁 | 确认 groupId 正确且群组仍存在 |
| 607 | group_disabled | 目标群组处于禁用状态，服务端拒绝邀请入群 | 确认群组状态恢复正常后再重试 |

### acceptGroupJoinRequest(params: AcceptGroupJoinRequestParams) => Promise<void>

#### 说明

同意用户的入群申请。

#### 调用示例

同意入群申请

```ts
await client.groupManager.acceptGroupJoinRequest({
  groupId: 'group-1',
  userId: 'user-2',
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `AcceptGroupJoinRequestParams` | 群组 ID 与申请人用户 ID。 |

#### 返回值

成功时无返回值。

#### 可能错误

- 错误码 `110`：申请人 ID 非法、申请不存在或群组不存在。
- 错误码 `202`：鉴权失败或无权限。

### rejectGroupJoinRequest(params: RejectGroupJoinRequestParams) => Promise<void>

#### 说明

拒绝用户的入群申请。

#### 调用示例

拒绝入群申请

```ts
await client.groupManager.rejectGroupJoinRequest({
  groupId: 'group-1',
  userId: 'user-2',
  reason: 'Group is full',
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `RejectGroupJoinRequestParams` | 群组 ID、申请人用户 ID 与拒绝原因。 |

#### 返回值

成功时无返回值。

#### 可能错误

- 错误码 `110`：申请人 ID、拒绝原因非法，申请不存在或群组不存在。
- 错误码 `202`：鉴权失败或无权限。

### acceptInvitation(params: GroupMutationTarget) => Promise<void>

#### 说明

接受当前用户收到的群组邀请。

#### 调用示例

接受群邀请

```ts
await client.groupManager.acceptInvitation({ groupId: 'group-1' });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `GroupMutationTarget` | 群组 ID。 |

#### 返回值

成功时无返回值。

#### 可能错误

- 错误码 `110`：群 ID 非法、邀请不存在或群组不存在。
- 错误码 `202`：鉴权失败。

### rejectInvitation(params: GroupMutationTarget) => Promise<void>

#### 说明

拒绝当前用户收到的群组邀请。

#### 调用示例

拒绝群邀请

```ts
await client.groupManager.rejectInvitation({ groupId: 'group-1' });
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `GroupMutationTarget` | 群组 ID。 |

#### 返回值

成功时无返回值。

#### 可能错误

- 错误码 `110`：群 ID 非法、邀请不存在或群组不存在。
- 错误码 `202`：鉴权失败。

### hydrateMessageProfileGroupNamecards(groupId: string, targets: ReadonlyArray<GroupNamecardHydrationTarget>) => Promise<void>

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| groupId | `string` | - |
| targets | `ReadonlyArray<GroupNamecardHydrationTarget>` | - |
