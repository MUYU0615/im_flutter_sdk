# PresenceManager API 命名对照

## 命名映射（Web SDK vs Android SDK）

| Web SDK                     | Android SDK | 说明                     |
| --------------------------- | ----------- | ------------------------ |
| `addEventHandler`           |             | 注册在线状态事件处理器   |
| `removeEventHandler`        |             | 移除在线状态事件处理器   |
| `publishPresence`           |             | 发布当前用户在线状态     |
| `subscribePresence`         |             | 订阅指定用户在线状态     |
| `unsubscribePresence`       |             | 取消订阅指定用户在线状态 |
| `getSubscribedPresenceList` |             | 分页查询已订阅用户列表   |
| `getPresenceStatus`         |             | 查询指定用户在线状态     |

## 结论（本项目约定）

- 对外 API 命名以 **Web SDK 自身命名规范** 为准。
- 本文档当前保留 Android SDK 对照列，但暂不维护映射。
- 对外返回结构以 **Web SDK 归一化后的业务对象** 为准，不暴露服务端原始 `result/data` 包裹层。

## 共享数据结构

> 说明：
>
> - 除 `addEventHandler` / `removeEventHandler` 外，其余 API 都支持可选 `success` / `error` 回调。
> - `publishPresence` / `unsubscribePresence` 的 `success` 无参数。
> - `subscribePresence` 与 `getPresenceStatus` 返回同一套 `PresenceInfo[]` 结构。

### `EventHandlerId`

```ts
type EventHandlerId = string;
```

### `PresenceStatusDetails`

| 字段     | 类型     | 必填 | 说明                 |
| -------- | -------- | ---- | -------------------- |
| `device` | `string` | 是   | 设备标识，如 `web`   |
| `status` | `number` | 是   | 该设备上的在线状态值 |

### `PresenceState`

这是在线状态事件 `onPresenceStatusChange` 的载荷项。

| 字段            | 类型                                   | 必填 | 说明               |
| --------------- | -------------------------------------- | ---- | ------------------ |
| `userId`        | `string`                               | 是   | 状态所属用户 ID    |
| `statusDetails` | `ReadonlyArray<PresenceStatusDetails>` | 是   | 多设备状态明细列表 |
| `ext`           | `string`                               | 是   | 扩展描述字段       |
| `lastTime`      | `number`                               | 是   | 状态更新时间，毫秒 |
| `expire`        | `number`                               | 是   | 订阅到期时间，毫秒 |

### `PresenceEventHandlerMap`

```ts
{
  onPresenceStatusChange?: (payload: ReadonlyArray<PresenceState>) => void;
}
```

### `PresenceInfo`

这是 `subscribePresence` / `getPresenceStatus` 返回的业务对象。

| 字段         | 类型                               | 必填 | 说明                                     |
| ------------ | ---------------------------------- | ---- | ---------------------------------------- |
| `publisher`  | `string`                           | 是   | 状态发布者（用户 ID）                    |
| `statusList` | `Readonly<Record<string, number>>` | 是   | 设备状态映射，key 为设备，value 为状态值 |
| `ext`        | `string`                           | 是   | 扩展描述字段                             |
| `latestTime` | `number`                           | 是   | 最新更新时间，毫秒                       |
| `expiryTime` | `number`                           | 是   | 状态到期时间，毫秒                       |

### `SubscribePresenceResponse`

```ts
type SubscribePresenceResponse = ReadonlyArray<PresenceInfo>;
```

### `SubscribedPresenceListResponse`

```ts
type SubscribedPresenceListResponse = ReadonlyArray<string>;
```

## API 请求参数与返回结构

### `addEventHandler`

**签名**

```ts
addEventHandler(id: EventHandlerId, handlers: PresenceEventHandlerMap): void
```

**请求参数**

| 字段       | 类型                      | 必填 | 说明                    |
| ---------- | ------------------------- | ---- | ----------------------- |
| `id`       | `EventHandlerId`          | 是   | 事件处理器唯一 ID       |
| `handlers` | `PresenceEventHandlerMap` | 是   | Presence 事件处理器集合 |

**返回结构**

```ts
void
```

### `removeEventHandler`

**签名**

```ts
removeEventHandler(id: EventHandlerId): void
```

**请求参数**

| 字段 | 类型             | 必填 | 说明              |
| ---- | ---------------- | ---- | ----------------- |
| `id` | `EventHandlerId` | 是   | 待移除的处理器 ID |

**返回结构**

```ts
void
```

### `publishPresence`

**签名**

```ts
publishPresence(params: PublishPresenceParams): Promise<void>
```

**请求参数：`PublishPresenceParams`**

| 字段          | 类型                        | 必填 | 说明                         |
| ------------- | --------------------------- | ---- | ---------------------------- |
| `description` | `string`                    | 是   | 在线状态扩展描述，对应 `ext` |
| `success`     | `() => void`                | 否   | 成功回调                     |
| `error`       | `(error: SDKError) => void` | 否   | 失败回调                     |

**返回结构**

```ts
Promise<void>;
```

成功仅表示发布完成，不返回业务数据。

### `subscribePresence`

**签名**

```ts
subscribePresence(
  params: SubscribePresenceParams
): Promise<SubscribePresenceResponse>
```

**请求参数：`SubscribePresenceParams`**

| 字段        | 类型                                            | 必填 | 说明                            |
| ----------- | ----------------------------------------------- | ---- | ------------------------------- |
| `usernames` | `ReadonlyArray<string>`                         | 是   | 待订阅的用户 ID 列表，至少 1 项 |
| `expiry`    | `number`                                        | 是   | 订阅时长，秒，要求 `>= 0`       |
| `success`   | `(response: SubscribePresenceResponse) => void` | 否   | 成功回调                        |
| `error`     | `(error: SDKError) => void`                     | 否   | 失败回调                        |

**返回结构：`SubscribePresenceResponse`**

```ts
Array<{
  publisher: string;
  statusList: Readonly<Record<string, number>>;
  ext: string;
  latestTime: number;
  expiryTime: number;
}>;
```

### `unsubscribePresence`

**签名**

```ts
unsubscribePresence(params: UnsubscribePresenceParams): Promise<void>
```

**请求参数：`UnsubscribePresenceParams`**

| 字段        | 类型                        | 必填 | 说明                     |
| ----------- | --------------------------- | ---- | ------------------------ |
| `usernames` | `ReadonlyArray<string>`     | 是   | 待取消订阅的用户 ID 列表 |
| `success`   | `() => void`                | 否   | 成功回调                 |
| `error`     | `(error: SDKError) => void` | 否   | 失败回调                 |

**返回结构**

```ts
Promise<void>;
```

成功仅表示取消订阅完成，不返回业务数据。

### `getSubscribedPresenceList`

**签名**

```ts
getSubscribedPresenceList(
  params: GetSubscribedPresenceListParams
): Promise<SubscribedPresenceListResponse>
```

**请求参数：`GetSubscribedPresenceListParams`**

| 字段       | 类型                                                 | 必填 | 说明                  |
| ---------- | ---------------------------------------------------- | ---- | --------------------- |
| `pageNum`  | `number`                                             | 是   | 页码，从 `0` 开始     |
| `pageSize` | `number`                                             | 是   | 每页条数，要求 `>= 0` |
| `success`  | `(response: SubscribedPresenceListResponse) => void` | 否   | 成功回调              |
| `error`    | `(error: SDKError) => void`                          | 否   | 失败回调              |

**返回结构：`SubscribedPresenceListResponse`**

```ts
Array<string>;
```

注意：当前 SDK 对外只返回用户 ID 数组，不返回服务端的 `totalnum` 等原始字段。

### `getPresenceStatus`

**签名**

```ts
getPresenceStatus(
  params: GetPresenceStatusParams
): Promise<SubscribePresenceResponse>
```

**请求参数：`GetPresenceStatusParams`**

| 字段        | 类型                                            | 必填 | 说明                            |
| ----------- | ----------------------------------------------- | ---- | ------------------------------- |
| `usernames` | `ReadonlyArray<string>`                         | 是   | 待查询的用户 ID 列表，至少 1 项 |
| `success`   | `(response: SubscribePresenceResponse) => void` | 否   | 成功回调                        |
| `error`     | `(error: SDKError) => void`                     | 否   | 失败回调                        |

**返回结构：`SubscribePresenceResponse`**

```ts
Array<{
  publisher: string;
  statusList: Readonly<Record<string, number>>;
  ext: string;
  latestTime: number;
  expiryTime: number;
}>;
```
