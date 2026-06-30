---
id: generated/api-reference/src-managers-user-info-manager-ts
title: websdk2 API Reference - UserInfoManager API
description: 来自 docs/reference/api-reference.zh-CN.md 的 src/managers/user-info-manager.ts API Reference 分段。
---

## src/managers/user-info-manager.ts

### UserInfoManager

### addEventHandler(id: EventHandlerId, handlers: UserInfoEventHandlerMap) => void

#### 说明

注册用户资料事件处理器，用于接收当前用户资料更新和订阅用户资料变更通知。

#### 调用示例

调用示例（注册事件处理器）

```ts
client.userInfoManager.addEventHandler('profile-listener', {
  onOwnInfoUpdated: profile => {
    console.log(profile.nickname);
  },
  onUserInfoUpdated: users => {
    console.log(users.map(user => user.userId));
  },
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| id | `EventHandlerId` | 事件处理器 ID，同一个 ID 再次注册会覆盖旧处理器。 |
| handlers | `UserInfoEventHandlerMap` | 用户资料事件处理器集合。 |

#### 返回值

无返回值。

### removeEventHandler(id: EventHandlerId) => void

#### 说明

移除指定 ID 的用户资料事件处理器，停止接收对应事件回调。

#### 调用示例

调用示例（移除事件处理器）

```ts
client.userInfoManager.removeEventHandler('profile-listener');
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| id | `EventHandlerId` | 注册时传入的事件处理器 ID。 |

#### 返回值

无返回值。

### getUserInfoByUserId(params: FetchUserInfoByUserIdParams) => Promise<ReadonlyArray<UserInfo>>

#### 说明

按用户 ID 查询用户资料属性；未指定属性时查询 SDK 默认资料字段。

#### 调用示例

调用示例（按用户 ID 查询）

```ts
const users = await client.userInfoManager.getUserInfoByUserId({
  userIds: ['alice', 'bob'],
});
console.log(users[0]?.avatarUrl);
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `FetchUserInfoByUserIdParams` | 包含 `userIds` 与可选成功/失败回调的参数对象。 |

#### 返回值

返回标准化后的用户资料数组，仅包含服务端命中的用户。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | userIds 为空、不是数组，或包含非法用户 ID | 传入非空用户 ID 数组，并确保每个用户 ID 都是非空字符串 |
| 900 | usercount_exceed | 单次查询的用户数量超过服务端允许上限 | 减少单次查询的用户数量后重试 |
| 204 | resource_not_found | 查询的用户不存在 | 确认用户 ID 正确 |
| 4 | rate_limit | 请求过于频繁 | 降低请求频率后重试 |

### getUserInfoByAttribute(params: FetchUserInfoByAttributeParams) => Promise<ReadonlyArray<UserInfo>>

#### 说明

按用户 ID 和指定属性集查询用户资料，适合只读取昵称、头像等部分字段。

#### 调用示例

调用示例（按属性集查询）

```ts
const users = await client.userInfoManager.getUserInfoByAttribute({
  userIds: ['alice'],
  attributes: ['nickname', 'avatarUrl'],
});
console.log(users[0]?.nickname);
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `FetchUserInfoByAttributeParams` | 包含 `userIds`、`attributes` 与可选回调的参数对象。 |

#### 返回值

返回标准化后的用户资料数组。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | userIds 或 attributes 为空、不是数组，或包含非法值 | 传入非空用户 ID 数组和非空资料属性数组，并确保属性名属于支持范围 |
| 900 | usercount_exceed | 单次查询的用户数量超过服务端允许上限 | 减少单次查询的用户数量后重试 |
| 204 | resource_not_found | 查询的用户不存在 | 确认用户 ID 正确 |
| 4 | rate_limit | 请求过于频繁 | 降低请求频率后重试 |

### subscribeUsersInfo(params: SubscribeUsersInfoParams) => Promise<void>

#### 说明

订阅指定陌生人用户的资料变化；订阅成功后可通过用户资料事件处理器接收变更通知。

#### 调用示例

调用示例（订阅资料变化）

```ts
await client.userInfoManager.subscribeUsersInfo({
  userIds: ['alice', 'bob'],
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `SubscribeUsersInfoParams` | 包含 `userIds` 与可选回调的参数对象。 |

#### 返回值

成功时无返回值。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 202 | unauthorized | unauthorized | refresh_token |
| 210 | forbidden | service_forbidden | check_service_permission |
| 1600 | subscriber_limit_exceeded | subscriber_limit_exceeded | reduce_subscription_targets |
| 1601 | target_limit_exceeded | target_limit_exceeded | change_subscription_target |
| 4 | rate_limit | 请求过于频繁 | 降低请求频率后重试 |
| 303 | server_unknown_error | server_unknown_error | 稍后重试或联系服务端排查 |

### unsubscribeUsersInfo(params: UnsubscribeUsersInfoParams) => Promise<void>

#### 说明

取消订阅指定陌生人用户的资料变化；取消后不再接收这些用户的资料变更通知。

#### 调用示例

调用示例（取消订阅资料变化）

```ts
await client.userInfoManager.unsubscribeUsersInfo({
  userIds: ['alice'],
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `UnsubscribeUsersInfoParams` | 包含 `userIds` 与可选回调的参数对象。 |

#### 返回值

成功时无返回值。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 202 | unauthorized | unauthorized | refresh_token |
| 210 | forbidden | service_forbidden | check_service_permission |
| 1600 | subscriber_limit_exceeded | subscriber_limit_exceeded | reduce_subscription_targets |
| 1601 | target_limit_exceeded | target_limit_exceeded | change_subscription_target |
| 4 | rate_limit | 请求过于频繁 | 降低请求频率后重试 |
| 303 | server_unknown_error | server_unknown_error | 稍后重试或联系服务端排查 |

### getSubscribedUsers() => Promise<ReadonlyArray<UserInfo>>

#### 说明

查询当前用户已订阅资料变化的陌生人列表，并返回这些用户的标准化资料。

#### 调用示例

调用示例（查询已订阅用户）

```ts
const users = await client.userInfoManager.getSubscribedUsers();
console.log(users.map(user => user.userId));
```

#### 返回值

返回标准化后的用户资料数组。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 202 | unauthorized | unauthorized | refresh_token |
| 210 | forbidden | service_forbidden | check_service_permission |
| 1600 | subscriber_limit_exceeded | subscriber_limit_exceeded | reduce_subscription_targets |
| 1601 | target_limit_exceeded | target_limit_exceeded | change_subscription_target |
| 4 | rate_limit | 请求过于频繁 | 降低请求频率后重试 |
| 303 | server_unknown_error | server_unknown_error | 稍后重试或联系服务端排查 |

### updateOwnInfo(params: UpdateOwnInfoParams) => Promise<UserInfo>

#### 说明

更新当前登录用户的一个或多个资料属性，例如昵称、头像、邮箱、手机号、签名或扩展字段。

#### 调用示例

调用示例（整对象更新）

```ts
const profile = await client.userInfoManager.updateOwnInfo({
  nickname: 'Alice',
  avatarUrl: 'https://example.com/avatar.png',
});
console.log(profile.userId, profile.nickname);
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `UpdateOwnInfoParams` | 至少包含一个可更新字段的参数对象。 |

#### 返回值

返回标准化后的当前用户资料。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | 没有任何可更新字段，或字段类型非法 | 至少传入一个可更新字段，并确保字段值类型合法 |
| 901 | data_length_exceed | 用户资料字段总长度超过服务端允许上限 | 缩短资料字段内容后重试 |
| 204 | resource_not_found | 当前用户不存在 | 确认用户已注册 |
| 4 | rate_limit | 请求过于频繁 | 降低请求频率后重试 |

### updateOwnInfoByAttribute(attribute: UserInfoAttribute, value: string | number | boolean) => Promise<UserInfo>

#### 说明

更新当前登录用户的单个资料属性，适合只修改昵称、头像等一个字段的场景。

#### 调用示例

调用示例（单属性更新）

```ts
const profile = await client.userInfoManager.updateOwnInfoByAttribute(
  'avatarUrl',
  'https://example.com/avatar.png'
);
console.log(profile.avatarUrl);
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| attribute | `UserInfoAttribute` | 需要更新的资料属性。 |
| value | `string | number | boolean` | 属性值；空字符串、`false`、`0` 都是合法值。 |

#### 返回值

返回标准化后的当前用户资料。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 110 | validation_invalid | 属性名或属性值非法 | 仅使用支持的资料属性，并确保属性值类型合法 |
| 901 | data_length_exceed | 用户资料字段总长度超过服务端允许上限 | 缩短资料字段内容后重试 |
| 204 | resource_not_found | 当前用户不存在 | 确认用户已注册 |
| 4 | rate_limit | 请求过于频繁 | 降低请求频率后重试 |
