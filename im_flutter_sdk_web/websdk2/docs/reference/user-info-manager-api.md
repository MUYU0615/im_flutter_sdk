# UserInfoManager REST 与 SDK 返回对照

> 参考：
>
> - [RESTful-API-Body-Formats](./RESTful-API-Body-Formats.md)
> - 当前实现：`src/managers/user-info-manager.ts`、`src/rest/user-info.ts`、`src/rest/user-info-subscription.ts`

本文档说明 `UserInfoManager` 当前在 `websdk2` 中的：

- 实际 REST 路径与请求参数
- 服务端原始返回结构
- SDK 对外 API 的入参与返回数据

---

## 1. 设计原则

- 查询侧对外拆为 `fetchUserInfoByUserId` 与 `fetchUserInfoByAttribute`。
- 更新侧对外拆为 `updateOwnInfo` 与 `updateOwnInfoByAttribute`。
- 陌生人资料订阅侧对外拆为 `subscribeUsersInfo`、`unsubscribeUsersInfo` 与 `getSubscribedUsers`。
- SDK 默认不向调用方透出服务端 envelope 的 `timestamp`、`duration`、`lastModified`。
- SDK 对外统一返回 `UserInfo` 或 `ReadonlyArray<UserInfo>`。
- 查询/更新成功后会把 `nickname/avatarUrl/sign/ext` 投影写回现有 `UserInfoSummary` 缓存。
- 当前用户资料更新成功和多端 `user_metadata_updated` 通知会通过 `onOwnInfoUpdated` 派发；陌生人订阅变更通知会并入 `onUserInfoUpdated`；好友资料变更通知不从 `UserInfoManager` 对外派发。

---

## 2. UserInfoManager 对外 API 一览

| Web SDK API                | REST API                           | SDK 对外返回                           |
| -------------------------- | ---------------------------------- | -------------------------------------- |
| `fetchUserInfoByUserId`    | `POST /metadata/user/get`          | `Promise<ReadonlyArray<UserInfo>>` |
| `fetchUserInfoByAttribute` | `POST /metadata/user/get`          | `Promise<ReadonlyArray<UserInfo>>` |
| `subscribeUsersInfo` | `POST /user/{userId}/metadata/subscription` | `Promise<void>` |
| `unsubscribeUsersInfo` | `DELETE /user/{userId}/metadata/subscription?usernames=...` | `Promise<void>` |
| `getSubscribedUsers` | `GET /user/{userId}/metadata/subscription` | `Promise<ReadonlyArray<UserInfo>>` |
| `updateOwnInfo`            | `PUT /metadata/user/{userId}`      | `Promise<UserInfo>`             |
| `updateOwnInfoByAttribute` | `PUT /metadata/user/{userId}`      | `Promise<UserInfo>`             |

---

## 3. 共享数据结构

### 3.1 `UserInfo`

```ts
{
  userId: string;
  nickname?: string;
  avatarUrl?: string;
  mail?: string;
  phone?: string;
  gender?: string | number | boolean;
  sign?: string;
  birth?: string;
  ext?: string;
}
```

说明：

- 对外字段统一使用驼峰命名
- 服务端 `avatarurl` 会映射为 `avatarUrl`
- 未命中的字段不会伪造默认值

---

## 4. API 请求参数与返回结构

## `fetchUserInfoByUserId`

**签名**

```ts
fetchUserInfoByUserId(params: { userIds: string[] }): Promise<ReadonlyArray<UserInfo>>
```

**REST**

```http
POST /{org}/{app}/metadata/user/get
Content-Type: application/json
```

**请求 Body**

```json
{
  "targets": ["zd1", "zd2"]
}
```

**服务端原始返回**

```json
{
  "timestamp": 1774495493846,
  "data": {
    "zd1": {
      "avatarurl": "http:/11.com/a/png"
    }
  },
  "lastModified": {
    "zd1": 1774495459340
  },
  "duration": 14
}
```

**SDK 对外返回**

```ts
[
  {
    userId: 'zd1',
    avatarUrl: 'http:/11.com/a/png',
  },
];
```

---

## `fetchUserInfoByAttribute`

**签名**

```ts
fetchUserInfoByAttribute(params: {
  userIds: string[];
  attributes: Array<'nickname' | 'avatarUrl' | 'mail' | 'phone' | 'gender' | 'sign' | 'birth' | 'ext'>;
}): Promise<ReadonlyArray<UserInfo>>
```

**REST**

```http
POST /{org}/{app}/metadata/user/get
Content-Type: application/json
```

**请求 Body**

```json
{
  "targets": ["zd1"],
  "properties": ["avatarurl", "nickname"]
}
```

**SDK 对外返回**

```ts
[
  {
    userId: 'zd1',
    avatarUrl: 'http:/11.com/a/png',
    nickname: '1111',
  },
];
```

---

## `subscribeUsersInfo`

**签名**

```ts
subscribeUsersInfo(params: { userIds: string[] }): Promise<void>
```

**REST**

```http
POST /{org}/{app}/user/{userId}/metadata/subscription
Content-Type: application/json
```

**请求 Body**

```json
{
  "usernames": ["wzy1", "wzy2"]
}
```

说明：

- SDK 会先对 `userIds` 去重并保持原始顺序
- 单次最多支持 100 个唯一用户 ID；超限会本地 fail-fast

**服务端原始返回（已确认真实样例）**

```json
{
  "path": "/user/wzy/metadata/subscription",
  "uri": "https://a1-hsb.easemob.com/hx/hxdemo/user/wzy/metadata/subscription",
  "status": "ok",
  "timestamp": 1776318273575,
  "organization": "hx",
  "application": "545bc64e-1632-4779-9b17-c431b02c4596",
  "entities": [],
  "count": 1,
  "data": ["wzy1"],
  "duration": 8,
  "applicationName": "hxdemo"
}
```

**SDK 对外返回**

```ts
Promise<void>;
```

---

## `unsubscribeUsersInfo`

**签名**

```ts
unsubscribeUsersInfo(params: { userIds: string[] }): Promise<void>
```

**REST**

```http
DELETE /{org}/{app}/user/{userId}/metadata/subscription?usernames=wzy1,wzy2
```

**请求 Body**

无

说明：

- 真实接口通过 query string 传 `usernames`
- SDK 不会为该接口发送 JSON body

**服务端原始返回（已确认真实样例）**

```json
{
  "path": "/user/wzy/metadata/subscription",
  "uri": "https://a1-hsb.easemob.com/hx/hxdemo/user/wzy/metadata/subscription",
  "status": "ok",
  "timestamp": 1776318379967,
  "organization": "hx",
  "application": "545bc64e-1632-4779-9b17-c431b02c4596",
  "entities": [],
  "count": 1,
  "data": ["wzy1"],
  "duration": 8,
  "applicationName": "hxdemo"
}
```

**SDK 对外返回**

```ts
Promise<void>;
```

---

## `getSubscribedUsers`

**签名**

```ts
getSubscribedUsers(): Promise<ReadonlyArray<UserInfo>>
```

**REST**

```http
GET /{org}/{app}/user/{userId}/metadata/subscription
```

**请求 Body**

无

**服务端原始返回（已确认真实样例）**

```json
{
  "path": "/user/wzy/metadata/subscription",
  "uri": "https://a1-hsb.easemob.com/hx/hxdemo/user/wzy/metadata/subscription",
  "status": "ok",
  "timestamp": 1776318459372,
  "organization": "hx",
  "application": "545bc64e-1632-4779-9b17-c431b02c4596",
  "entities": [],
  "count": 2,
  "data": ["wzy2", "wzy1"],
  "duration": 2,
  "applicationName": "hxdemo"
}
```

**SDK 对外返回**

```ts
[
  {
    userId: 'wzy2',
    nickname: 'WZY2',
  },
  {
    userId: 'wzy1',
    avatarUrl: 'https://cdn.example.com/wzy1.png',
  },
];
```

说明：

- 当前服务端 `GET` 只返回用户名数组，不直接返回完整资料
- SDK 会先读取订阅列表，再复用 `fetchUserInfoByUserId` 补齐为 `UserInfo[]`

---

## `updateOwnInfo`

**签名**

```ts
updateOwnInfo(params: {
  nickname?: string;
  avatarUrl?: string;
  mail?: string;
  phone?: string;
  gender?: string | number | boolean;
  sign?: string;
  birth?: string;
  ext?: string;
}): Promise<UserInfo>
```

**REST**

```http
PUT /{org}/{app}/metadata/user/{userId}
Content-Type: application/x-www-form-urlencoded
```

**请求 Body**

```text
nickname=1111&avatarurl=http%3A%2F11.com%2Fa%2Fpng
```

**服务端原始返回**

```json
{
  "timestamp": 1774496262484,
  "data": {
    "avatarurl": "http:/11.com/a/png",
    "nickname": "1111"
  },
  "lastModified": 1774496262500,
  "duration": 52
}
```

**SDK 对外返回**

```ts
{
  userId: 'currentUser',
  avatarUrl: 'http:/11.com/a/png',
  nickname: '1111',
}
```

---

## `updateOwnInfoByAttribute`

**签名**

```ts
updateOwnInfoByAttribute(
  attribute: 'nickname' | 'avatarUrl' | 'mail' | 'phone' | 'gender' | 'sign' | 'birth' | 'ext',
  value: string | number | boolean
): Promise<UserInfo>
```

**REST**

```http
PUT /{org}/{app}/metadata/user/{userId}
Content-Type: application/x-www-form-urlencoded
```

**请求 Body**

```text
avatarurl=http%3A%2F11.com%2Fa%2Fpng
```

**SDK 对外返回**

与 `updateOwnInfo` 完全一致，都是标准化后的 `UserInfo`：

```ts
{
  userId: 'currentUser',
  avatarUrl: 'http:/11.com/a/png',
  nickname: '1111',
}
```

---

## 5. 订阅资料变更事件

`UserInfoManager` 当前对外提供如下事件：

```ts
client.userInfoManager.addEventHandler('user-info-ui', {
  onOwnInfoUpdated: payload => {},
  onUserInfoUpdated: payload => {},
});
```

`onOwnInfoUpdated`

```ts
{
  userId: string;
  nickname?: string;
  avatarUrl?: string;
  mail?: string;
  phone?: string;
  gender?: string | number | boolean;
  sign?: string;
  birth?: string;
  ext?: string;
}
```

说明：

- 当前用户调用 `updateOwnInfo` / `updateOwnInfoByAttribute` 成功后会触发
- 服务端下发 `user_metadata_updated` 多端通知时也会触发
- 如果通知 data 中未带 `userId`，SDK 会自动回填当前登录用户 ID

---

`onUserInfoUpdated`

```ts
[
  {
    userId: string;
    nickname?: string;
    avatarUrl?: string;
    mail?: string;
    phone?: string;
    gender?: string | number | boolean;
    sign?: string;
    birth?: string;
    ext?: string;
  }
]
```

说明：

- 只响应服务端 `subscribe_metadata_updated` 类型通知
- 派发前会先做 `lastModified` 比较，旧版本补丁会被忽略
- 事件中的 `UserInfo` 是当前会话运行时真相；如果本地已有旧字段，会与最新 patch 合并后再对外派发

---

## 6. 迁移说明

| 旧名称 | 新名称 |
| ------ | ------ |
| `fetchUserInfoById` | `fetchUserInfoByUserId` / `fetchUserInfoByAttribute` |
| `updateUserInfo` | `updateOwnInfo` / `updateOwnInfoByAttribute` |
| `updateOwnUserInfo` | `updateOwnInfo` |

说明：

- 026 起不再保留旧名称兼容别名
- 通过 `client.use(UserInfoManager)` 注册后，应使用 `client.userInfoManager.xxx()`
