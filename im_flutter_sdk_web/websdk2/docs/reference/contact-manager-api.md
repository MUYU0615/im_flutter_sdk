# ContactManager REST 与 SDK 返回对照

> 参考：
>
> - [RESTful-API-Body-Formats](./RESTful-API-Body-Formats.md)
> - [PushManager API 命名对照](./push-manager-api-name.md)
> - 当前实现：`src/managers/contact-manager.ts`、`src/rest/contact-management.ts`

本文档说明 `ContactManager` 当前在 `websdk2` 中的：

- 实际 REST 路径与请求参数
- 服务端原始返回结构
- SDK 对外 API 的入参与返回数据

---

## 1. 设计原则

- 对外 API 命名以 `websdk2` 当前 TypeScript 风格为准。
- 服务端原始返回中的包装字段，如 `uri`、`timestamp`、`entities`、`duration`，默认不直接透出给 SDK 调用方。
- SDK 优先返回业务对象或 `void`：
  - 联系人写接口统一返回 `Promise<void>`
  - 黑名单查询返回 `Promise<ReadonlyArray<BlocklistEntry>>`
  - 黑名单添加返回 `Promise<BlocklistAddResult>`
- `getContacts()` 是 `ContactManager` 的本地同步读取入口，不发 REST 请求。
- 如需调试完整快照元数据，请通过 `ChatClient.getContactSnapshot()` 读取。

---

## 2. ContactManager 对外 API 一览

| Web SDK API                 | REST API                                                     | SDK 对外返回                             |
| --------------------------- | ------------------------------------------------------------ | ---------------------------------------- |
| `getContacts()`             | 无                                                           | `ReadonlyArray<Contact>`                 |
| `addContact()`              | `POST /users/{username}/contacts/apply`                      | `Promise<void>`                          |
| `deleteContact()`           | `DELETE /users/{username}/contacts/users/{targetUser}`       | `Promise<void>`                          |
| `acceptContactInvite()`     | `POST /users/{username}/contacts/accept/users/{targetUser}`  | `Promise<void>`                          |
| `declineContactInvite()`    | `POST /users/{username}/contacts/decline/users/{targetUser}` | `Promise<void>`                          |
| `setContactRemark()`        | `PUT /users/{username}/contacts/users/{targetUser}`          | `Promise<void>`                          |
| `getBlocklist()`            | `GET /users/{username}/blocks/users`                         | `Promise<ReadonlyArray<BlocklistEntry>>` |
| `addUsersToBlocklist()`     | `POST /sdk/user/{username}/blocks`                           | `Promise<BlocklistAddResult>`            |
| `removeUserFromBlocklist()` | `DELETE /sdk/user/{username}/blocks`                         | `Promise<void>`                          |

---

## 3. 共享数据结构

### 3.1 `Contact`

```ts
{
  userId: string;
  userInfo: {
    userId: string;
    nickname?: string;
    avatarUrl?: string;
    mail?: string;
    phone?: string;
    gender?: string | number | boolean;
    sign?: string;
    birth?: string;
    ext?: string;
  };
  remark: string;
  addTs: number;
}
```

说明：

- `userInfo` 优先来自当前会话联系人快照 / 用户资料缓存
- 若资料缺失，SDK 会按需批量调用 `fetchUserInfoByUserId` 补齐
- 联系人域 localStorage 仍只持久化关系字段和 `UserInfoSummary` 摘要；运行时再合并成完整 `UserInfo`
- `remark` / `addTs` 来自联系人关系缓存或同步结果归一化

### 3.2 `ContactSnapshot`

```ts
{
  items: ReadonlyArray<Contact>;
  source: 'cache' | 'sync';
  version: string;
  complete: boolean;
}
```

### 3.3 `BlocklistEntry`

```ts
{
  userId: string;
  userInfo: {
    userId: string;
    nickname?: string;
    avatarUrl?: string;
    sign?: string;
    ext?: string;
  };
}
```

### 3.4 `BlocklistAddResult`

```ts
{
  userIds: ReadonlyArray<string>;
}
```

---

## 4. API 请求参数与返回结构

## `getContacts`

**签名**

```ts
getContacts(): ReadonlyArray<Contact>
```

**REST**

无。该接口直接读取当前内存中的联系人快照。

**SDK 返回**

```ts
[
  {
    userId: 'bob',
    userInfo: {
      userId: 'bob',
      nickname: 'Bob',
      avatarUrl: 'https://cdn.example.com/bob.png',
      sign: 'hello',
    },
    remark: '备注',
    addTs: 1710000000000,
  },
];
```

无数据时返回：

```ts
[];
```

---

## `addContact`

**签名**

```ts
addContact(params: AddContactParams): Promise<void>
```

**请求参数：`AddContactParams`**

```ts
{
  userId: string;
  message?: string;
}
```

**REST**

```http
POST /{org}/{app}/users/{username}/contacts/apply?resource={resource}
Content-Type: application/json
```

**请求 Body**

```json
{
  "usernames": ["targetUser"],
  "reason": "申请消息"
}
```

**服务端原始返回**

历史结构参考：

```json
{
  "data": {
    "applyContacts": ["targetUser"]
  }
}
```

当前 SDK 不依赖该返回体字段。

**SDK 对外返回**

```ts
Promise<void>;
```

成功只表示请求完成，不返回业务对象。

---

## `deleteContact`

**签名**

```ts
deleteContact(params: ContactMutationTarget): Promise<void>
```

**请求参数**

```ts
{
  userId: string;
}
```

**REST**

```http
DELETE /{org}/{app}/users/{username}/contacts/users/{targetUser}?resource={resource}
```

**请求 Body**

无

**服务端原始返回**

历史结构参考：

```json
{
  "entities": []
}
```

**SDK 对外返回**

```ts
Promise<void>;
```

附加行为：

- 成功后 SDK 会立即修补当前会话联系人缓存
- 后续 `getContacts()` 不再返回该联系人

---

## `acceptContactInvite`

**签名**

```ts
acceptContactInvite(params: ContactMutationTarget): Promise<void>
```

**REST**

```http
POST /{org}/{app}/users/{username}/contacts/accept/users/{targetUser}?resource={resource}
```

**请求 Body**

无

**服务端原始返回**

历史结构参考：

```json
{
  "data": {}
}
```

**SDK 对外返回**

```ts
Promise<void>;
```

附加行为：

- 成功后 SDK 会触发受控联系人刷新
- 刷新后 `getContacts()` 会反映最新联系人状态；如需查看完整快照元数据，可读取 `client.getContactSnapshot()`

---

## `declineContactInvite`

**签名**

```ts
declineContactInvite(params: ContactMutationTarget): Promise<void>
```

**REST**

```http
POST /{org}/{app}/users/{username}/contacts/decline/users/{targetUser}?resource={resource}
```

**请求 Body**

无

**服务端原始返回**

历史结构参考：

```json
{
  "data": {}
}
```

**SDK 对外返回**

```ts
Promise<void>;
```

成功后不主动伪造联系人关系。

---

## `setContactRemark`

**签名**

```ts
setContactRemark(params: SetContactRemarkParams): Promise<void>
```

**请求参数**

```ts
{
  userId: string;
  remark: string;
}
```

**REST**

```http
PUT /{org}/{app}/users/{username}/contacts/users/{targetUser}?resource={resource}
Content-Type: application/json
```

**请求 Body**

```json
{
  "remark": "备注字符串"
}
```

说明：

- 允许传空字符串 `""`，表示清空备注

**服务端原始返回**

历史结构参考：

```json
{
  "status": {}
}
```

**SDK 对外返回**

```ts
Promise<void>;
```

附加行为：

- 成功后 SDK 会立即回写当前会话联系人缓存中的 `remark`

**失败场景（已确认真实样例）**

当目标用户与当前用户不是好友时，服务端会返回 400：

```json
{
  "duration": 0,
  "error": "illegal_argument",
  "error_description": "updateRemark | they are not friends, please add as a friend first.",
  "exception": "InvalidParameterException",
  "timestamp": 1774350803336
}
```

SDK 行为：

- 抛出统一 `SDKError`
- 当前已知会映射为 `ERROR_CODES.CONTACT_SET_REMARK_NOT_FRIEND`
- 服务端 `error_description` 不会直接原样透出字段名，但错误对象 `details` 中会保留：

```ts
{
  api: 'setContactRemark',
  serverCode: 'illegal_argument',
  serverMessage: 'updateRemark | they are not friends, please add as a friend first.'
}
```

---

## `getBlocklist`

**签名**

```ts
getBlocklist(): Promise<ReadonlyArray<BlocklistEntry>>
```

**REST**

```http
GET /{org}/{app}/users/{username}/blocks/users
```

**请求 Body**

无

**服务端原始返回（已确认真实样例）**

```json
{
  "uri": "https://a1.easemob.com/easemob-demo/chatdemoui/users/zd1/blocks/users",
  "timestamp": 1774256318068,
  "entities": [],
  "count": 1,
  "action": "get",
  "data": ["zd2"],
  "duration": 5
}
```

**SDK 对外返回**

```ts
[
  {
    userId: 'zd2',
    userInfo: {
      userId: 'zd2',
      nickname: 'ZD2',
      avatarUrl: 'https://cdn.example.com/zd2.png',
      sign: 'hello',
      ext: undefined,
    },
  },
];
```

说明：

- SDK 只取 `data: string[]` 归一化为 `BlocklistEntry[]`
- SDK 会为每个黑名单用户补齐 `userInfo`
- 优先复用当前会话缓存；缺失时按批量调用 `fetchUserInfoByUserId`
- 若资料补拉失败，`userInfo` 至少包含 `userId`
- 同一会话内首次成功请求后会复用内存快照

---

## `addUsersToBlocklist`

**签名**

```ts
addUsersToBlocklist(
  params: BlocklistMutationParams
): Promise<BlocklistAddResult>
```

**请求参数**

```ts
{
  userIds: string[];
}
```

**REST**

```http
POST /{org}/{app}/sdk/user/{username}/blocks?resource={resource}
Content-Type: application/json
```

**请求 Body**

```json
{
  "usernames": ["user1", "user2"]
}
```

说明：

- SDK 会先对 `userIds` 去重，再发请求

**服务端原始返回（已确认真实样例）**

```json
{
  "uri": "https://a1.easemob.com/easemob-demo/chatdemoui/users/zd1/blocks/users",
  "timestamp": 1774256316252,
  "organization": "easemob-demo",
  "application": "e0a3d0f7-b6d9-4b6a-af22-e8b9aaee776f",
  "entities": [],
  "action": "post",
  "data": ["zd2"],
  "duration": 75,
  "applicationName": "chatdemoui"
}
```

**SDK 对外返回**

```ts
{
  userIds: ['zd2'];
}
```

**失败场景（已确认真实样例）**

当请求里包含不存在的用户时，服务端整体失败，不存在部分成功部分失败：

```json
{
  "error": "service_resource_not_found",
  "exception": "UserNotFoundException",
  "timestamp": 1774256447712,
  "duration": 0,
  "error_description": "Service resource not found"
}
```

SDK 行为：

- 抛出统一 `SDKError`
- 当前已知会映射为 `ERROR_CODES.CONTACT_BLOCKLIST_USER_NOT_FOUND`

---

## `removeUserFromBlocklist`

**签名**

```ts
removeUserFromBlocklist(params: BlocklistMutationParams): Promise<void>
```

**请求参数**

```ts
{
  userIds: string[];
}
```

**REST**

当前 `websdk2` 实现为：

```http
DELETE /{org}/{app}/sdk/user/{username}/blocks?resource={resource}
Content-Type: application/json
```

**请求 Body**

```json
{
  "usernames": ["user1", "user2"]
}
```

说明：

- 这里与部分旧文档中的 `DELETE /sdk/user/{username}/blocks/{targetUser}` 不同
- 当前 SDK 已统一按批量 `userIds` 语义实现

**服务端原始返回（已确认真实样例）**

```json
{
  "path": "/users/zd1/blocks/users",
  "uri": "https://a1.easemob.com/easemob-demo/chatdemoui/users/zd1/blocks/users",
  "timestamp": 1774256414907,
  "organization": "easemob-demo",
  "application": "e0a3d0f7-b6d9-4b6a-af22-e8b9aaee776f",
  "entities": [],
  "action": "delete",
  "duration": 0,
  "applicationName": "chatdemoui"
}
```

**SDK 对外返回**

```ts
Promise<void>;
```

附加语义：

- 成功后 SDK 会同步修补当前会话内存中的黑名单快照
- 已确认“移除不存在的用户”在服务端仍返回成功，SDK 也按成功处理

---

## 5. 联系人事件返回数据

除了 REST 管理接口，`ContactManager` 当前还支持联系人事件监听：

```ts
client.contactManager.addEventHandler('contact-ui', {
  onContactInvited: payload => {},
  onContactDeleted: payload => {},
  onContactAdded: payload => {},
  onContactRefuse: payload => {},
  onContactAgreed: payload => {},
  onContactInfoUpdated: payload => {},
});
```

### 5.1 roster 联系人事件 payload

```ts
{
  type: 'subscribe' | 'unsubscribed' | 'subscribed';
  from: string;
  to: string;
  status: string;
  rosterVersion?: string;
  userInfo: {
    userId: string;
    nickname?: string;
    avatarUrl?: string;
    sign?: string;
    ext?: string;
  };
}
```

典型示例：

```ts
{
  type: 'unsubscribed',
  from: 'bob',
  to: 'alice',
  status: 'deleted-by-peer',
  rosterVersion: 'rv-2',
  userInfo: {
    userId: 'bob',
    nickname: 'Bob',
    avatarUrl: 'https://cdn.example.com/bob.png'
  }
}
```

说明：

- `onContactInvited`、`onContactAdded`、`onContactRefuse`、`onContactAgreed` 对外必带 `userInfo`
- `onContactDeleted` 当前也会统一携带最小或缓存命中的 `userInfo`
- 若资料补拉失败，`userInfo` 至少包含 `userId`

### 5.2 好友资料变更事件 payload

`onContactInfoUpdated`

```ts
{
  userInfo: {
    userId: string;
    nickname?: string;
    avatarUrl?: string;
    mail?: string;
    phone?: string;
    gender?: string | number | boolean;
    sign?: string;
    birth?: string;
    ext?: string;
  };
  contact?: {
    userId: string;
    userInfo: UserInfo;
    remark: string;
    addTs: number;
  };
}
```

典型示例：

```ts
{
  userInfo: {
    userId: 'bob',
    nickname: 'Bob New',
    avatarUrl: 'https://cdn.example.com/bob-new.png',
    sign: 'new-sign',
  },
  contact: {
    userId: 'bob',
    userInfo: {
      userId: 'bob',
      nickname: 'Bob New',
      avatarUrl: 'https://cdn.example.com/bob-new.png',
      sign: 'new-sign',
    },
    remark: 'old-remark',
    addTs: 100,
  },
}
```

说明：

- 只响应服务端 `contact_metadata_updated` 类型通知
- 派发前 SDK 会先更新当前会话联系人视图，再触发回调
- `contact` 仅在当前会话已有该好友联系人关系时返回
- 若收到旧版本 patch，SDK 会基于 `lastModified` 忽略该事件

### 5.3 自动同步事件

联系人自动同步进度不再挂在 `ContactManager` 事件面。请在 `ChatClient` 级监听统一同步事件：

```ts
client.addEventHandler('sync-ui', {
  onSyncDataStart: payload => {
    if (payload.dataType === 'contact') {
      console.log('contact sync started');
    }
  },
  onSyncDataFinished: payload => {
    if (payload.dataType === 'contact' && payload.error) {
      console.log(payload.error.stage, payload.error.code);
    }
  },
});
```

失败时 `payload.error.stage` 会保留联系人同步原有阶段信息：`metadata`、`socket_connect`、`sync_page`、`decode` 或 `cancelled`。

---

## 6. 文档结论

- 如果你关心的是服务端 HTTP 包装结构，重点看各接口的“服务端原始返回”
- 如果你关心的是 SDK 调用方真正能拿到什么，重点看“SDK 对外返回”
- 对 `ContactManager` 而言，推荐调用方直接依赖 SDK 返回类型，不要依赖服务端 envelope 字段
- `getContacts()` 与联系人事件，是当前 SDK 联系人域最稳定的公开读取入口
