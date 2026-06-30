---
id: generated/api-reference/src-managers-presence-manager-ts
title: websdk2 API Reference - PresenceManager API
description: 来自 docs/reference/api-reference.zh-CN.md 的 src/managers/presence-manager.ts API Reference 分段。
---

## src/managers/presence-manager.ts

### PublishPresenceParams

#### 说明

发布当前用户在线状态的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| customStatus | `string` | 在线状态自定义状态，服务端对应 `ext` 字段。 |

### SubscribePresenceParams

#### 说明

订阅用户在线状态的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userIds | `ReadonlyArray<string>` | 待订阅的用户 ID 列表，至少包含 1 项。 |
| expiry | `number` | 订阅时长（秒），取值需大于等于 0。 |

### UnsubscribePresenceParams

#### 说明

取消订阅用户在线状态的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userIds | `ReadonlyArray<string>` | 待取消订阅的用户 ID 列表，至少包含 1 项。 |

### GetSubscribedPresenceListParams

#### 说明

查询当前用户在线状态订阅列表的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| pageNum | `number` | 页码，从 0 开始。 |
| pageSize | `number` | 每页条数，取值需大于等于 0。 |

### GetPresenceStatusParams

#### 说明

查询用户在线状态的参数。

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| userIds | `ReadonlyArray<string>` | 待查询的用户 ID 列表，至少包含 1 项。 |

### PresenceManager

### addEventHandler(id: EventHandlerId, handlers: PresenceEventHandlerMap) => void

#### 说明

注册 Presence 事件处理器，用于接收在线状态变更推送。

#### 调用示例

调用示例（注册在线状态事件）

```ts
client.presenceManager.addEventHandler('presence-ui', {
  onPresenceStatusChange: (states) => {
    console.log(states);
  },
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| id | `EventHandlerId` | 事件处理器唯一 ID，用于后续移除。 |
| handlers | `PresenceEventHandlerMap` | 事件处理器集合，按需实现对应回调。 |

#### 返回值

注册完成后无返回值。

### removeEventHandler(id: EventHandlerId) => void

#### 说明

移除 Presence 事件处理器。

#### 调用示例

调用示例（移除在线状态事件）

```ts
client.presenceManager.removeEventHandler('presence-ui');
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| id | `EventHandlerId` | 待移除的事件处理器 ID。 |

#### 返回值

移除完成后无返回值。

### publishPresence(params: PublishPresenceParams) => Promise<void>

#### 说明

发布当前用户的自定义在线状态，该状态会作为在线状态扩展描述信息保存并下发给订阅者。

#### 调用示例

调用示例（发布在线状态）

```ts
await client.presenceManager.publishPresence({
  customStatus: 'busy',
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `PublishPresenceParams` | 发布参数，包含在线状态扩展描述信息与可选回调。 |

#### 返回值

成功时 resolve，无返回业务数据。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 1100 | PRESENCE_PARAM_EXCEED | 在线状态扩展描述信息长度超过服务端允许上限 | 缩短 customStatus 后重试 |

### subscribePresence(params: SubscribePresenceParams) => Promise<SubscribePresenceResponse>

#### 说明

订阅指定用户的在线状态。订阅成功后，这些用户在线状态变更时会触发 Presence 事件回调。

#### 调用示例

调用示例（订阅用户在线状态）

```ts
const result = await client.presenceManager.subscribePresence({
  userIds: ['userA'],
  expiry: 3600,
});
console.log(result[0]?.publisher);
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `SubscribePresenceParams` | 订阅参数，包含用户列表、订阅时长与可选回调。 |

#### 返回值

返回归一化后的在线状态列表。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 1101 | cannot_subscribe_yourself | 订阅列表中包含当前用户自己 | 从订阅列表中移除当前用户 |
| 1100 | param_length_exceed | 订阅参数长度超过服务端允许上限 | 减少单次订阅的用户数量 |

### unsubscribePresence(params: UnsubscribePresenceParams) => Promise<void>

#### 说明

取消订阅指定用户的在线状态，成功后不再接收这些用户的在线状态变更事件。

#### 调用示例

调用示例（取消订阅）

```ts
await client.presenceManager.unsubscribePresence({
  userIds: ['userA'],
});
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `UnsubscribePresenceParams` | 取消订阅参数，包含用户列表与可选回调。 |

#### 返回值

成功时 resolve，无返回业务数据。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 1100 | param_length_exceed | 取消订阅参数长度超过服务端允许上限 | 减少单次取消订阅的用户数量 |

### getSubscribedPresenceList(params: GetSubscribedPresenceListParams) => Promise<SubscribedPresenceListResponse>

#### 说明

分页查询当前用户订阅了哪些用户的在线状态。

#### 调用示例

调用示例（分页查询订阅列表）

```ts
const list = await client.presenceManager.getSubscribedPresenceList({
  pageNum: 1,
  pageSize: 20,
});
console.log(list);
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `GetSubscribedPresenceListParams` | 分页参数，包含页码、每页数量与可选回调。 |

#### 返回值

返回订阅用户 ID 列表。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 1100 | param_length_exceed | 分页参数超过服务端允许上限 | 调整 pageNum 或 pageSize 后重试 |

### getPresenceStatus(params: GetPresenceStatusParams) => Promise<SubscribePresenceResponse>

#### 说明

查询指定用户的当前在线状态，不会建立订阅关系。

#### 调用示例

调用示例（查询在线状态）

```ts
const status = await client.presenceManager.getPresenceStatus({
  userIds: ['userA'],
});
console.log(status[0]?.statusList);
```

#### 参数

| Name | Type | Description |
| --- | --- | --- |
| params | `GetPresenceStatusParams` | 查询参数，包含用户列表与可选回调。 |

#### 返回值

返回归一化后的在线状态列表。

#### 错误清单

| Code | Key | Reason | Action |
| --- | --- | --- | --- |
| 1100 | param_length_exceed | 查询参数长度超过服务端允许上限 | 减少单次查询的用户数量 |
