---
id: generated/api-reference/src-managers-contact-manager-ts
title: websdk2 API Reference - ContactManager API
description: 来自 docs/reference/api-reference.zh-CN.md 的 src/managers/contact-manager.ts API Reference 分段。
---

## src/managers/contact-manager.ts

### ContactManager

### getContacts() => ReadonlyArray<Contact>

#### 说明

获取当前内存中的联系人列表视图。

#### 调用示例

调用示例（读取联系人列表）

```ts
const contacts = client.contactManager.getContacts();
console.log(contacts[0]?.userId);
```

#### 返回值

返回当前联系人列表；若暂无可用数据则返回空数组。

### addContact(params: AddContactParams) => Promise<void>

#### 说明

发送联系人申请。

#### 调用示例

调用示例（发送联系人申请）

```ts
await client.contactManager.addContact({
  userId: 'user-1',
  message: '我是 Alice',
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `AddContactParams` | 目标用户与可选验证消息。 |

#### 返回值

成功时仅表示请求完成。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | userId 为空、不是字符串，或 message 不是字符串 | 传入非空字符串 userId；message 如需传入也必须是字符串 |
| 204 | USER_NOT_FOUND | 目标用户不存在 | 确认用户 ID 正确 |
| 1000 | ALREADY_FRIEND | 添加联系人失败：已是好友 | - |
| 210 | BLOCKED_BY_USER | 用户无权限：被对方拉黑 | - |
| 1001 | CONTACT_REACH_LIMIT | 当前用户的联系人数量已达服务端上限 | 删除不再使用的联系人后重试，或联系服务端提升配额 |
| 1002 | CONTACT_REACH_LIMIT_PEER | 对方的联系人数量已达服务端上限 | 联系对方清理联系人列表 |

### deleteContact(params: ContactMutationTarget) => Promise<void>

#### 说明

删除联系人，并立即修补当前会话中的联系人快照。

#### 调用示例

调用示例（删除联系人）

```ts
await client.contactManager.deleteContact({
  userId: 'user-1',
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `ContactMutationTarget` | 目标用户。 |

#### 返回值

成功时仅表示请求完成。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | userId 为空或不是字符串 | 传入非空字符串 userId |
| 204 | USER_NOT_FOUND | 目标用户不存在 | 确认用户 ID 正确 |

### acceptContactInvite(params: ContactMutationTarget) => Promise<void>

#### 说明

接受联系人申请，并触发受控联系人刷新。

#### 调用示例

调用示例（接受联系人申请）

```ts
await client.contactManager.acceptContactInvite({
  userId: 'user-1',
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `ContactMutationTarget` | 目标用户。 |

#### 返回值

成功时仅表示请求完成。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | userId 为空或不是字符串 | 传入非空字符串 userId |
| 204 | USER_NOT_FOUND | 目标用户不存在 | 确认用户 ID 正确 |
| 1001 | CONTACT_REACH_LIMIT | 当前用户的联系人数量已达服务端上限 | 删除不再使用的联系人后重试 |
| 1002 | CONTACT_REACH_LIMIT_PEER | 对方的联系人数量已达服务端上限 | 联系对方清理联系人列表 |

### declineContactInvite(params: ContactMutationTarget) => Promise<void>

#### 说明

拒绝联系人申请。

#### 调用示例

调用示例（拒绝联系人申请）

```ts
await client.contactManager.declineContactInvite({
  userId: 'user-1',
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `ContactMutationTarget` | 目标用户。 |

#### 返回值

成功时仅表示请求完成。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | userId 为空或不是字符串 | 传入非空字符串 userId |
| 204 | USER_NOT_FOUND | 目标用户不存在 | 确认用户 ID 正确 |

### setContactRemark(params: SetContactRemarkParams) => Promise<void>

#### 说明

设置联系人备注，允许传入空字符串以清空备注。

#### 调用示例

调用示例（设置联系人备注）

```ts
await client.contactManager.setContactRemark({
  userId: 'user-1',
  remark: '产品同学',
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `SetContactRemarkParams` | 目标用户与备注内容。 |

#### 返回值

成功时仅表示请求完成。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | userId 为空、不是字符串，或 remark 不是字符串 | 传入非空字符串 userId，并确保 remark 为字符串；可传空字符串清空备注 |
| 223 | illegal_argument | 目标用户不是当前用户的好友 | 先添加好友再设置备注 |
| 4 | remark_length_exceeded | 备注内容超过服务端允许的最大长度 | 缩短备注内容后重试 |

### getBlocklist() => Promise<ReadonlyArray<UserInfo>>

#### 说明

获取当前用户的黑名单列表。

#### 调用示例

调用示例（获取黑名单）

```ts
const blocklist = await client.contactManager.getBlocklist();
console.log(blocklist.map(item => item.userId));
```

#### 返回值

返回黑名单用户资料列表。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 606 | resource_not_found | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |

### addUsersToBlocklist(params: BlocklistMutationParams) => Promise<BlocklistAddResult>

#### 说明

批量添加黑名单用户，重复值会在请求前去重并保持原始顺序。

#### 调用示例

调用示例（添加黑名单）

```ts
const result = await client.contactManager.addUsersToBlocklist({
  userIds: ['user-1', 'user-2'],
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `BlocklistMutationParams` | 待加入黑名单的用户 ID 列表。 |

#### 返回值

返回成功与失败两类用户资料列表。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | userIds 不是非空数组，或数组项不是字符串 | 传入至少一个非空字符串 userId；重复值会由 SDK 去重 |
| 204 | service_resource_not_found | 目标用户不存在 | 确认用户 ID 正确 |
| 4 | blocklist_limit_exceeded | 黑名单数量已达服务端上限 | 移除不再需要的黑名单用户后重试 |

### removeUserFromBlocklist(params: BlocklistMutationParams) => Promise<void>

#### 说明

批量移除黑名单用户，重复值会在请求前去重并保持原始顺序。

#### 调用示例

调用示例（移除黑名单）

```ts
await client.contactManager.removeUserFromBlocklist({
  userIds: ['user-1'],
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `BlocklistMutationParams` | 待移除的黑名单用户 ID 列表。 |

#### 返回值

成功时仅表示请求完成。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | userIds 不是非空数组，或数组项不是字符串 | 传入至少一个非空字符串 userId；重复值会由 SDK 去重 |

### addEventHandler(id: string, handlers: ContactEventHandlerMap) => void

#### 说明

注册联系人同步事件处理器，用于接收开始、成功和失败事件；`onContactSyncStart` 不携带 payload，`onContactSyncFinish` 仅在失败时携带 `error`。

#### 调用示例

调用示例（监听联系人同步结果）

```ts
client.contactManager.addEventHandler('contact-ui', {
  onContactSyncFinish: () => {
    console.log(client.contactManager.getContacts().length);
  },
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| id | `string` | 事件处理器唯一 ID，用于后续移除。 |
| handlers | `ContactEventHandlerMap` | 联系人同步事件处理器集合，按需实现对应回调。 |

#### 返回值

注册完成后无返回值。

### removeEventHandler(id: string) => void

#### 说明

移除已注册的联系人同步事件处理器。

#### 调用示例

调用示例（移除联系人事件处理器）

```ts
client.contactManager.removeEventHandler('contact-ui');
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| id | `string` | 待移除的事件处理器 ID。 |

#### 返回值

移除完成后无返回值。
