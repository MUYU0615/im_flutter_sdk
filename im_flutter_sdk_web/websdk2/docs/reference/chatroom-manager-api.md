# ChatRoomManager / ChatRoom REST 与 SDK 返回对照

> 参考：
>
> - [RESTful-API-Body-Formats](./RESTful-API-Body-Formats.md)
> - [SDK 对外 API 命名规范](./sdk-naming-conventions.md)
> - 当前实现：`src/managers/chatroom-manager.ts`、`src/rest/chatroom-management.ts`、`src/managers/chatroom/*`
> - 原始样例来源：`docs/reference/chatroom-api.md`

> 说明：本文档按 028 最新规格收敛为目标公开面，`ChatRoomManager + ChatRoom` 的最终落地以实现与合同测试为准。若某个聊天室接口与 027 群组域使用同类 REST API 且返回结构同构，本文档直接复用 027 已确认的数据结构口径；若上游写接口返回体不稳定，则明确写为“SDK 当前不依赖返回体”。

本文档说明 `ChatRoomManager` 与 `ChatRoom` 当前在 `websdk2` 中的：

- 实际 REST 路径与请求参数
- 服务端原始返回结构与 SDK 归一化规则
- 对象化用户结果、属性模型与事件注册入口

---

## 1. 设计原则

- 聊天室域唯一入口为 `client.chatRoomManager`。
- 单聊天室上下文能力通过 `client.chatRoomManager.getChatRoom(chatRoomId)` 返回的 `ChatRoom` 对象访问。
- `ChatRoom` 不暴露同步 getter、同步属性访问器或本地状态真相；详情统一通过 `getInfo()` / `refresh()` 获取。
- 公开读接口统一返回业务对象，不直接透出 REST envelope 的 `uri/timestamp/entities/duration`。
- 聊天室列表继续返回 plain object，不把列表项升级为 `ChatRoom` 实例。
- 原来只返回 `userId` 的成员、管理员、黑名单、allowlist、禁言、共享文件 owner 等结果，当前统一返回对象化 `UserInfo` 视图。
- 用户资料补齐采用 cache-first：
  - 先读 `CacheManager` / `UserInfoSummary`
  - 缺失时批量调用 `fetchUserInfoByUserId`
  - 若补拉失败，回退最小 `UserInfo { userId }`
- 聊天室事件名使用 Web SDK 统一命名，事件载荷按 Web SDK 对象模型返回。
- `onChatRoomInfoChanged` 对外返回完整 `ChatRoomDetail`；事件原始字段不足时允许先补拉聊天室详情。
- `uploadSharedFile` 不进入 028 公开范围；共享文件能力仅保留列表与删除。

---

## 2. 推荐公开面

### 2.1 ChatRoomManager 对外 API 一览

| Web SDK API               | REST API                                        | SDK 对外返回                      |
| ------------------------- | ----------------------------------------------- | --------------------------------- |
| `getChatRoomList()`       | `GET /chatrooms`                                | `Promise<ChatRoomListResult>`     |
| `getChatRoom(chatRoomId)` | N/A（本地创建 façade）                          | `ChatRoom`                        |
| `getChatRoomInfo()`       | `GET /chatrooms/{chatRoomId}`                   | `Promise<ChatRoomDetail>`         |
| `updateChatRoomInfo()`    | `PUT /chatrooms/{chatRoomId}`                   | `Promise<ChatRoomUpdateResult>`   |
| `joinChatRoom()`          | `POST /chatrooms/{chatRoomId}/users/{userId}`   | `Promise<void>`                   |
| `leaveChatRoom()`         | `DELETE /chatrooms/{chatRoomId}/users/{userId}` | `Promise<void>`                   |
| `addEventHandler()`       | N/A（事件系统本地注册）                         | `void`                            |
| `removeEventHandler()`    | N/A（事件系统本地注销）                         | `void`                            |

### 2.2 ChatRoom 对外 API 一览

| Web SDK API                           | REST API                                             | SDK 对外返回                                     |
| ------------------------------------- | ---------------------------------------------------- | ------------------------------------------------ |
| `chatRoom.getInfo()`                  | `GET /chatrooms/{chatRoomId}`                        | `Promise<ChatRoomDetail>`                        |
| `chatRoom.refresh()`                  | `GET /chatrooms/{chatRoomId}`                        | `Promise<ChatRoomDetail>`                        |
| `chatRoom.updateInfo()`               | `PUT /chatrooms/{chatRoomId}`                        | `Promise<ChatRoomUpdateResult>`                  |
| `chatRoom.destroy()`                  | `DELETE /chatrooms/{chatRoomId}`                     | `Promise<void>`                                  |
| `chatRoom.leaveChatRoom()`            | `DELETE /chatrooms/{chatRoomId}/users/{userId}`      | `Promise<void>`                                  |
| `chatRoom.getMemberList()`            | `GET /chatrooms/{chatRoomId}/users`                  | `Promise<ChatRoomMemberListResult>`              |
| `chatRoom.addMembers()`               | `POST /chatrooms/{chatRoomId}/users`                 | `Promise<ChatRoomMemberActionListResult>`        |
| `chatRoom.removeMembers()`            | `DELETE /chatrooms/{chatRoomId}/users/{csvUserIds}`  | `Promise<ChatRoomMemberActionListResult>`        |
| `chatRoom.getAdminList()`             | `GET /chatrooms/{chatRoomId}/admin`                  | `Promise<ReadonlyArray<UserInfo>>`               |
| `chatRoom.setAdmin()`                 | `POST /chatrooms/{chatRoomId}/admin`                 | `Promise<void>`                                  |
| `chatRoom.removeAdmin()`              | `DELETE /chatrooms/{chatRoomId}/admin/{userId}`      | `Promise<void>`                                  |
| `chatRoom.getMuteList()`              | `GET /chatrooms/{chatRoomId}/mute`                   | `Promise<ReadonlyArray<ChatRoomMuteEntry>>`      |
| `chatRoom.muteMembers()`              | `POST /chatrooms/{chatRoomId}/mute`                  | `Promise<void>`                                  |
| `chatRoom.unmuteMembers()`            | `DELETE /chatrooms/{chatRoomId}/mute/{csvUserIds}`   | `Promise<void>`                                  |
| `chatRoom.muteAllMembers()`           | `POST /chatrooms/{chatRoomId}/ban`                   | `Promise<void>`                                  |
| `chatRoom.unmuteAllMembers()`         | `DELETE /chatrooms/{chatRoomId}/ban`                 | `Promise<void>`                                  |
| `chatRoom.isCurrentUserMuted()`       | `GET /chatrooms/{chatRoomId}/mute/{userId}`          | `Promise<ChatRoomMuteStatus>`                    |
| `chatRoom.getBlocklist()`             | `GET /chatrooms/{chatRoomId}/blocks/users`           | `Promise<ReadonlyArray<ChatRoomBlocklistEntry>>` |
| `chatRoom.blockMembers()`             | `POST /chatrooms/{chatRoomId}/blocks/users`          | `Promise<ChatRoomMemberActionListResult>`        |
| `chatRoom.unblockMembers()`           | `DELETE /chatrooms/{chatRoomId}/blocks/users/{csv}`  | `Promise<ChatRoomMemberActionListResult>`        |
| `chatRoom.getAllowlist()`             | `GET /chatrooms/{chatRoomId}/white/users`            | `Promise<ReadonlyArray<ChatRoomAllowlistEntry>>` |
| `chatRoom.addUsersToAllowlist()`      | `POST /chatrooms/{chatRoomId}/white/users`           | `Promise<ChatRoomMemberActionListResult>`        |
| `chatRoom.removeUsersFromAllowlist()` | `DELETE /chatrooms/{chatRoomId}/white/users/{csv}`   | `Promise<ChatRoomMemberActionListResult>`        |
| `chatRoom.checkIfInAllowList()`       | `GET /chatrooms/{chatRoomId}/white/users/{currentUser}?version=v3` | `Promise<ChatRoomBooleanStatus>`                 |
| `chatRoom.getAnnouncement()`          | `GET /chatrooms/{chatRoomId}/announcement`           | `Promise<ChatRoomAnnouncement>`                  |
| `chatRoom.updateAnnouncement()`       | `POST /chatrooms/{chatRoomId}/announcement`          | `Promise<void>`                                  |
| `chatRoom.getSharedFileList()`        | `GET /chatrooms/{chatRoomId}/share_files`            | `Promise<ChatRoomSharedFileListResult>`          |
| `chatRoom.deleteSharedFile()`         | `DELETE /chatrooms/{chatRoomId}/share_files/{id}`    | `Promise<void>`                                  |
| `chatRoom.getAttributes({ keys })`    | `POST /metadata/chatroom/{chatRoomId}`               | `Promise<ChatRoomAttributesSnapshot>`            |
| `chatRoom.setAttributes()`            | `PUT /metadata/chatroom/{chatRoomId}/user/{user}`    | `Promise<ChatRoomAttributeMutationResult>`       |
| `chatRoom.setAttribute()`             | `PUT /metadata/chatroom/{chatRoomId}/user/{user}`    | `Promise<ChatRoomAttributeMutationResult>`       |
| `chatRoom.removeAttributes()`         | `DELETE /metadata/chatroom/{chatRoomId}/user/{user}` | `Promise<ChatRoomAttributeMutationResult>`       |
| `chatRoom.removeAttribute()`          | `DELETE /metadata/chatroom/{chatRoomId}/user/{user}` | `Promise<ChatRoomAttributeMutationResult>`       |

---

## 3. 共享数据结构

### 3.1 `ChatRoomSummary`

```ts
{
  chatRoomId: string;
  name: string;
  owner?: UserInfo;
  memberCount?: number;
  disabled?: boolean;
}
```

### 3.2 `ChatRoomDetail`

```ts
{
  chatRoomId: string;
  name: string;
  description?: string;
  owner?: UserInfo;
  memberCount?: number;
  maxMembers?: number;
  createdAt?: number;
  disabled?: boolean;
  ext?: string;
  announcement?: string;
  permissionType?: 'owner' | 'admin' | 'member' | 'none';
  currentUserStatus?: {
    inAllowlist?: boolean;
    muted?: boolean;
    muteExpireAt?: number;
    permissionType?: 'owner' | 'admin' | 'member' | 'none';
  };
}
```

### 3.3 `ChatRoomMemberEntry`

```ts
{
  user: UserInfo;
  role?: 'owner' | 'admin' | 'member';
  joinedAt?: number;
}
```

### 3.4 `ChatRoomMemberActionResult`

```ts
{
  chatRoomId: string;
  user: UserInfo;
  action: string;
  reason?: string;
}
```

### 3.5 `ChatRoomMemberActionListResult`

```ts
{
  succeeded: ChatRoomMemberActionResult[];
  failed: ChatRoomMemberActionResult[];
}
```

### 3.6 `ChatRoomMuteEntry` / `ChatRoomAllowlistEntry` / `ChatRoomBlocklistEntry`

```ts
{
  user: UserInfo;
  muteExpire?: number;
  muteDuration?: number;
}
```

```ts
{
  user: UserInfo;
}
```

说明：

- allowlist / blocklist 服务端原始返回通常是 `string[]`
- mute list 原始返回可能是 `string[]`，也可能带禁言到期时间
- SDK 对外统一转换为对象数组

### 3.7 `ChatRoomAnnouncement`

```ts
{
  chatRoomId: string;
  announcement: string;
}
```

### 3.7 `ChatRoomSharedFile`

```ts
{
  fileId: string;
  fileName: string;
  fileOwner?: UserInfo;
  fileSize?: number;
  createdAt?: number;
}
```

### 3.8 `ChatRoomAttributesSnapshot`

```ts
{
  chatRoomId: string;
  attributes: Record<string, string>;
}
```

### 3.9 `ChatRoomAttributeMutationResult`

```ts
{
  chatRoomId: string;
  appliedKeys: string[];
  failedKeys: Record<string, { code: number; message: string }>;
}
```

说明：

- `failedKeys` 中每个 key 的 `code` 由服务端错误描述自动映射（FR-052）：
  - 包含 `"is exceeding maximum limit"` → `SERVICE_LIMIT_EXCEEDED`(4)
  - 包含 `"size of metadata"` + `"exceeds"` → `SERVICE_LIMIT_EXCEEDED`(4)
  - 包含 `"is not part of you"` → `CHATROOM_PERMISSION_DENIED`(703)
  - 包含 `"is not Legal"` 或 `"is not exist"` → `VALIDATION_REQUIRED`(110)
  - 其他 → `REST_BUSINESS_UNKNOWN`(303)
- 批量操作判定（FR-051）：
  - 所有 key 都成功 → 正常返回
  - 部分成功、部分失败 → 返回结果，`appliedKeys` 和 `failedKeys` 均可访问
  - 所有 key 都失败 → 抛出 `SDKError`，错误码取第一个 failedKey 的映射码

### 3.10 `ChatRoomBooleanStatus` / `ChatRoomMuteStatus`

```ts
{
  value: boolean;
}
```

```ts
{
  muted: boolean;
  muteExpireAt?: number;
}
```

---

## 4. 事件模型

聊天室事件名与移动端保持一致，当前公开事件包括：

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

说明：

- 事件注册通过 `chatRoomManager.addEventHandler(id, handlers)` / `removeEventHandler(id)` 完成，不发 REST 请求。
- `onChatRoomInfoChanged` 在事件原始字段不足时会受控补拉完整 `ChatRoomDetail`。
- 事件中的用户字段统一对象化；补拉失败时回退最小 `UserInfo { userId }`。
- 共享文件事件不进入 028 公开聊天室事件集合。

---

## 5. API 请求参数与返回结构

> 说明：
>
> - 本节按推荐公开面整理，分为 `ChatRoomManager` 入口 API 与 `ChatRoom` 单聊天室 API。
> - `chatRoomManager.getChatRoom(chatRoomId)` 本身不发 REST 请求，只创建绑定 `chatRoomId` 的轻量 `ChatRoom` 对象。
> - 对于写接口，如当前没有稳定服务端返回样例，文档会明确写“SDK 当前不依赖返回体”。

## 5.1 ChatRoomManager API

## `getChatRoomList`

**签名**

```ts
getChatRoomList(params?: GetChatRoomListParams): Promise<ChatRoomListResult>
```

**REST**

```http
GET /{org}/{app}/chatrooms?pagesize={pageSize}&pagenum={pageNum}
```

**服务端原始返回**

```json
{
  "count": 20,
  "data": [
    {
      "affiliations_count": 1,
      "disabled": false,
      "id": "308726760275970",
      "name": "欢迎来到我的频道!",
      "owner": "46d2d9d2d1"
    }
  ],
  "params": {
    "pagesize": ["20"],
    "pagenum": ["1"]
  }
}
```

**SDK 返回**

```ts
{
  items: [
    {
      chatRoomId: '308726760275970',
      name: '欢迎来到我的频道!',
      owner: {
        userId: '46d2d9d2d1',
      },
      memberCount: 1,
      disabled: false,
    },
  ],
  pageNum: 1,
  pageSize: 20,
  total: 20,
  hasMore: false,
}
```

---

## `getChatRoom`

**签名**

```ts
getChatRoom(chatRoomId: string): ChatRoom
```

**REST**

无。该接口只返回绑定 `chatRoomId` 的单聊天室对象。

**SDK 返回**

```ts
const chatRoom = client.chatRoomManager.getChatRoom('301206510567427');
// chatRoom.chatRoomId === '301206510567427'
```

---

## `getChatRoomInfo`

**签名**

```ts
getChatRoomInfo(params: GetChatRoomInfoParams): Promise<ChatRoomDetail>
```

**REST**

```http
GET /{org}/{app}/chatrooms/{chatRoomId}?joined_time=true
```

**服务端原始返回**

聊天室详情接口与 027 群详情接口同构，代表性原始结构如下：

```json
{
  "count": 1,
  "data": [
    {
      "id": "301206510567427",
      "name": "room1",
      "description": "聊天室描述",
      "membersonly": false,
      "allowinvites": true,
      "maxusers": 200,
      "owner": "zd1",
      "created": 1775645157182,
      "custom": "ext-json",
      "mute": false,
      "affiliations_count": 3,
      "affiliations": [
        {
          "owner": "zd1",
          "joined_time": 1775645157212
        }
      ],
      "public": true,
      "disabled": false
    }
  ]
}
```

**SDK 返回**

```ts
{
  chatRoomId: '301206510567427',
  name: 'room1',
  description: '聊天室描述',
  owner: {
    userId: 'zd1',
  },
  memberCount: 3,
  maxMembers: 200,
  createdAt: 1775645157182,
  disabled: false,
  ext: 'ext-json',
  permissionType: 'owner',
  currentUserStatus: {
    permissionType: 'owner',
  },
}
```

说明：

- `owner` 会补齐为对象化 `UserInfo`。
- `permissionType` 由当前用户与 `owner/affiliations` 关系推导。
- 若原始载荷同时给出 `white` / `in_whitelist` / `muted` / `expire` 等字段，SDK 会进一步写入 `currentUserStatus`。

---

## `updateChatRoomInfo`

**签名**

```ts
updateChatRoomInfo(params: UpdateChatRoomInfoParams): Promise<ChatRoomUpdateResult>
```

**REST**

```http
PUT /{org}/{app}/chatrooms/{chatRoomId}?resource={resource}
Content-Type: application/json
```

**请求参数：`UpdateChatRoomInfoParams`**

```ts
{
  chatRoomId: string;
  name?: string;
  description?: string;
  maxMembers?: number;
}
```

**服务端原始返回**

```json
{
  "data": {
    "description": true,
    "maxusers": true,
    "groupname": true
  }
}
```

**SDK 返回**

```ts
{
  nameUpdated: true,
  descriptionUpdated: true,
  maxMembersUpdated: true,
}
```

---

## `joinChatRoom` / `leaveChatRoom`

**签名**

```ts
joinChatRoom(params: JoinChatRoomParams): Promise<void>
leaveChatRoom(params: ChatRoomMutationTarget): Promise<void>
```

**REST**

```http
POST /{org}/{app}/chatrooms/{chatRoomId}/users/{userId}?resource={resource}
DELETE /{org}/{app}/chatrooms/{chatRoomId}/users/{userId}?resource={resource}
```

**服务端原始返回**

- `joinChatRoom` / `leaveChatRoom`：当前 SDK 不依赖返回体；成功只表示操作完成。

**SDK 返回**

```ts
Promise<void>;
```

---

## `addEventHandler` / `removeEventHandler`

**签名**

```ts
addEventHandler(id: EventHandlerId, handlers: ChatRoomEventHandlerMap): void
removeEventHandler(id: EventHandlerId): void
```

**REST**

无。事件通过 SDK 内部 `eventContext` 注册与派发。

**SDK 返回**

```ts
void
```

---

## 5.2 ChatRoom API

## `chatRoom.getInfo` / `chatRoom.refresh`

**签名**

```ts
chatRoom.getInfo(): Promise<ChatRoomDetail>
chatRoom.refresh(): Promise<ChatRoomDetail>
```

**REST**

复用 `getChatRoomInfo`：

```http
GET /{org}/{app}/chatrooms/{chatRoomId}?joined_time=true
```

**服务端原始返回**

同 `getChatRoomInfo`。

**SDK 返回**

同 `getChatRoomInfo`。

---

## `chatRoom.updateInfo` / `chatRoom.destroy` / `chatRoom.leaveChatRoom`

**签名**

```ts
chatRoom.updateInfo(input: ChatRoomUpdateInfoInput): Promise<ChatRoomUpdateResult>
chatRoom.destroy(): Promise<void>
chatRoom.leaveChatRoom(): Promise<void>
```

**REST**

```http
PUT /{org}/{app}/chatrooms/{chatRoomId}?resource={resource}
DELETE /{org}/{app}/chatrooms/{chatRoomId}?resource={resource}&version=v3
DELETE /{org}/{app}/chatrooms/{chatRoomId}/users/{userId}?resource={resource}
```

**服务端原始返回**

- `chatRoom.updateInfo()`：同 `updateChatRoomInfo`
- `chatRoom.destroy()` / `chatRoom.leaveChatRoom()`：SDK 当前不依赖返回体

**SDK 返回**

```ts
Promise<ChatRoomUpdateResult>;
Promise<void>;
Promise<void>;
```

---

## `chatRoom.getMemberList`

**签名**

```ts
chatRoom.getMemberList(query?: ChatRoomMemberListQuery): Promise<ChatRoomMemberListResult>
```

**REST**

```http
GET /{org}/{app}/chatrooms/{chatRoomId}/users?pagesize={pageSize}&pagenum={pageNum}
```

**服务端原始返回**

聊天室成员接口与群成员接口同构，代表性结构如下：

```json
{
  "count": 3,
  "data": [{ "member": "zd3" }, { "admin": "zd2" }, { "owner": "zd1" }],
  "params": {
    "pagesize": ["20"],
    "pagenum": ["1"]
  }
}
```

**SDK 返回**

```ts
{
  items: [
    {
      user: { userId: 'zd3' },
      role: 'member',
    },
    {
      user: { userId: 'zd2' },
      role: 'admin',
    },
    {
      user: { userId: 'zd1' },
      role: 'owner',
    },
  ],
  pageNum: 1,
  pageSize: 20,
}
```

说明：

- `member` / `admin` / `owner` 字段会统一归一化为 `user + role`
- 用户资料会按 cache-first 补齐为 `UserInfo`

---

## `chatRoom.addMembers` / `chatRoom.removeMembers`

**签名**

```ts
chatRoom.addMembers(input: ChatRoomUserBatchInput): Promise<ChatRoomMemberActionListResult>
chatRoom.removeMembers(input: ChatRoomUserBatchInput): Promise<ChatRoomMemberActionListResult>
```

**REST**

```http
POST /{org}/{app}/chatrooms/{chatRoomId}/users?resource={resource}
DELETE /{org}/{app}/chatrooms/{chatRoomId}/users/{csvUserIds}?resource={resource}
```

**服务端原始返回**

```json
{
  "data": {
    "result": true,
    "action": "add_member",
    "id": "66XXXX33",
    "user": "user1"
  }
}
```

或批量删除：

```json
{
  "data": [
    {
      "result": false,
      "action": "remove_member",
      "reason": "user: user1 doesn't exist in group: 66XXXX33",
      "user": "user1",
      "id": "66XXXX33"
    },
    {
      "result": true,
      "action": "remove_member",
      "user": "user2",
      "id": "66XXXX33"
    }
  ]
}
```

**SDK 返回**

```ts
{
  items: [
    {
      chatRoomId: '66XXXX33',
      user: { userId: 'user1' },
      action: 'add_member',
      success: true,
    },
  ],
}
```

或：

```ts
{
  items: [
    {
      chatRoomId: '66XXXX33',
      user: { userId: 'user1' },
      action: 'remove_member',
      success: false,
      reason: "user: user1 doesn't exist in group: 66XXXX33",
    },
    {
      chatRoomId: '66XXXX33',
      user: { userId: 'user2' },
      action: 'remove_member',
      success: true,
    },
  ],
}
```

---

## `chatRoom.getAdminList`

**签名**

```ts
chatRoom.getAdminList(): Promise<ReadonlyArray<UserInfo>>
```

**REST**

```http
GET /{org}/{app}/chatrooms/{chatRoomId}/admin
```

**服务端原始返回**

与群管理员接口同构：

```json
{
  "data": ["zd2"]
}
```

**SDK 返回**

```ts
[
  {
    userId: 'zd2',
    nickname: 'Tom',
    avatarUrl: 'https://cdn.example.com/tom.png',
  },
];
```

---

## `chatRoom.setAdmin` / `chatRoom.removeAdmin`

**签名**

```ts
chatRoom.setAdmin(input: ChatRoomAdminInput): Promise<void>
chatRoom.removeAdmin(input: ChatRoomAdminInput): Promise<void>
```

**REST**

```http
POST /{org}/{app}/chatrooms/{chatRoomId}/admin?resource={resource}
DELETE /{org}/{app}/chatrooms/{chatRoomId}/admin/{userId}?resource={resource}
```

**请求参数**

```ts
{
  userId: string;
}
```

`setAdmin()` 的请求体会被转换为：

```json
{
  "newadmin": "zd2"
}
```

**服务端原始返回**

当前 SDK 不依赖返回体；成功只表示操作完成。

**SDK 返回**

```ts
Promise<void>;
```

---

## `chatRoom.getMuteList`

**签名**

```ts
chatRoom.getMuteList(): Promise<ReadonlyArray<ChatRoomMuteEntry>>
```

**REST**

```http
GET /{org}/{app}/chatrooms/{chatRoomId}/mute
```

**服务端原始返回**

当前已知聊天室禁言列表与群禁言列表同构，常见原始结构有两类：

```json
{
  "data": ["user1", "user2"]
}
```

或带过期时间：

```json
{
  "data": [
    {
      "user": "user1",
      "expire": 1775788483641
    }
  ]
}
```

**SDK 返回**

```ts
[
  {
    user: {
      userId: 'user1',
    },
    muteExpire: 1775788483641,
  },
];
```

---

## `chatRoom.muteMembers` / `chatRoom.unmuteMembers` / `chatRoom.muteAllMembers` / `chatRoom.unmuteAllMembers`

**签名**

```ts
chatRoom.muteMembers(input: ChatRoomMuteMembersInput): Promise<void>
chatRoom.unmuteMembers(input: ChatRoomUserBatchInput): Promise<void>
chatRoom.muteAllMembers(): Promise<void>
chatRoom.unmuteAllMembers(): Promise<void>
```

**REST**

```http
POST /{org}/{app}/chatrooms/{chatRoomId}/mute?resource={resource}
DELETE /{org}/{app}/chatrooms/{chatRoomId}/mute/{csvUserIds}?resource={resource}
POST /{org}/{app}/chatrooms/{chatRoomId}/ban?resource={resource}
DELETE /{org}/{app}/chatrooms/{chatRoomId}/ban?resource={resource}
```

**服务端原始返回**

当前 SDK 不依赖返回体；成功只表示操作完成。

`muteMembers()` 请求体：

```json
{
  "usernames": ["user1", "user2"],
  "mute_duration": 3600
}
```

**SDK 返回**

```ts
Promise<void>;
```

---

## `chatRoom.isCurrentUserMuted`

**签名**

```ts
chatRoom.isCurrentUserMuted(): Promise<ChatRoomMuteStatus>
```

**REST**

```http
GET /{org}/{app}/chatrooms/{chatRoomId}/mute/{userId}
```

**服务端原始返回**

当前 SDK 兼容以下代表性原始结构：

```json
{
  "data": {
    "muted": true,
    "expire": 1775788483641
  }
}
```

或：

```json
{
  "data": {
    "value": false
  }
}
```

**SDK 返回**

```ts
{
  muted: true,
  muteExpireAt: 1775788483641,
}
```

---

## `chatRoom.getBlocklist`

**签名**

```ts
chatRoom.getBlocklist(): Promise<ReadonlyArray<ChatRoomBlocklistEntry>>
```

**REST**

```http
GET /{org}/{app}/chatrooms/{chatRoomId}/blocks/users
```

**服务端原始返回**

与群黑名单接口同构：

```json
{
  "data": ["user1", "user2"]
}
```

**SDK 返回**

```ts
[
  {
    user: {
      userId: 'user1',
    },
  },
];
```

---

## `chatRoom.blockMembers` / `chatRoom.unblockMembers`

**签名**

```ts
chatRoom.blockMembers(input: ChatRoomUserBatchInput): Promise<ChatRoomMemberActionListResult>
chatRoom.unblockMembers(input: ChatRoomUserBatchInput): Promise<ChatRoomMemberActionListResult>
```

**REST**

```http
POST /{org}/{app}/chatrooms/{chatRoomId}/blocks/users?resource={resource}
POST /{org}/{app}/chatrooms/{chatRoomId}/blocks/users/{userId}?resource={resource}
DELETE /{org}/{app}/chatrooms/{chatRoomId}/blocks/users/{csvUserIds}?resource={resource}
```

**服务端原始返回**

多人加入黑名单：

```json
{
  "data": [
    {
      "result": false,
      "action": "add_blocks",
      "reason": "user: user3 doesn't exist in chatroom: XXXX",
      "user": "user3",
      "chatroomid": "XXXX"
    },
    {
      "result": true,
      "action": "add_blocks",
      "user": "user4",
      "chatroomid": "XXXX"
    }
  ]
}
```

单人加入黑名单：

```json
{
  "data": {
    "result": true,
    "action": "add_blocks",
    "user": "user1",
    "chatroomid": "XXXX"
  }
}
```

移出黑名单：

```json
{
  "data": [
    {
      "result": true,
      "action": "remove_blocks",
      "user": "user1",
      "chatroomid": "XXXX"
    }
  ]
}
```

**SDK 返回**

```ts
{
  items: [
    {
      chatRoomId: 'XXXX',
      user: { userId: 'user4' },
      action: 'add_blocks',
      success: true,
    },
  ],
}
```

---

## `chatRoom.getAllowlist`

**签名**

```ts
chatRoom.getAllowlist(): Promise<ReadonlyArray<ChatRoomAllowlistEntry>>
```

**REST**

```http
GET /{org}/{app}/chatrooms/{chatRoomId}/white/users
```

**服务端原始返回**

与群 allowlist 接口同构：

```json
{
  "count": 2,
  "data": ["zd1", "zd2"]
}
```

**SDK 返回**

```ts
[
  {
    user: {
      userId: 'zd1',
    },
  },
  {
    user: {
      userId: 'zd2',
    },
  },
];
```

---

## `chatRoom.addUsersToAllowlist` / `chatRoom.removeUsersFromAllowlist`

**签名**

```ts
chatRoom.addUsersToAllowlist(input: ChatRoomUserBatchInput): Promise<ChatRoomMemberActionListResult>
chatRoom.removeUsersFromAllowlist(input: ChatRoomUserBatchInput): Promise<ChatRoomMemberActionListResult>
```

**REST**

```http
POST /{org}/{app}/chatrooms/{chatRoomId}/white/users?resource={resource}
DELETE /{org}/{app}/chatrooms/{chatRoomId}/white/users/{csvUserIds}?resource={resource}
```

**服务端原始返回**

添加：

```json
{
  "data": [
    {
      "result": true,
      "action": "add_user_whitelist",
      "user": "wzy_test",
      "chatroomid": "66XXXX33"
    },
    {
      "result": true,
      "action": "add_user_whitelist",
      "user": "wzy_meizu",
      "chatroomid": "66XXXX33"
    }
  ]
}
```

移除：

```json
{
  "data": [
    {
      "result": true,
      "action": "remove_user_whitelist",
      "user": "wzy_huawei",
      "chatroomid": "66XXXX33"
    },
    {
      "result": true,
      "action": "remove_user_whitelist",
      "user": "wzy_meizu",
      "chatroomid": "66XXXX33"
    }
  ]
}
```

**SDK 返回**

```ts
{
  items: [
    {
      chatRoomId: '66XXXX33',
      user: { userId: 'wzy_test' },
      action: 'add_user_whitelist',
      success: true,
    },
  ],
}
```

---

## `chatRoom.checkIfInAllowList`

**签名**

```ts
chatRoom.checkIfInAllowList(): Promise<ChatRoomBooleanStatus>
```

**REST**

```http
GET /{org}/{app}/chatrooms/{chatRoomId}/white/users/{currentUser}?version=v3
```

**服务端原始返回**

当前 SDK 兼容以下代表性原始结构：

```json
{
  "data": {
    "white": true
  }
}
```

或：

```json
{
  "data": {
    "value": false
  }
}
```

**SDK 返回**

```ts
{
  value: true,
}
```

---

## `chatRoom.getAnnouncement`

**签名**

```ts
chatRoom.getAnnouncement(): Promise<ChatRoomAnnouncement>
```

**REST**

```http
GET /{org}/{app}/chatrooms/{chatRoomId}/announcement
```

**服务端原始返回**

与群公告接口同构：

```json
{
  "data": {
    "announcement": "welcome"
  }
}
```

**SDK 返回**

```ts
{
  chatRoomId: '301206510567427',
  announcement: 'welcome',
}
```

---

## `chatRoom.updateAnnouncement`

**签名**

```ts
chatRoom.updateAnnouncement(input: ChatRoomAnnouncementUpdateInput): Promise<void>
```

**REST**

```http
POST /{org}/{app}/chatrooms/{chatRoomId}/announcement?resource={resource}
Content-Type: application/json
```

**请求参数**

```ts
{
  announcement: string;
}
```

**服务端原始返回**

```json
{
  "data": {
    "id": "12XXXX11",
    "result": true
  }
}
```

**SDK 返回**

```ts
Promise<void>;
```

---

## `chatRoom.getSharedFileList`

**签名**

```ts
chatRoom.getSharedFileList(query?: ChatRoomSharedFileListQuery): Promise<ChatRoomSharedFileListResult>
```

**REST**

```http
GET /{org}/{app}/chatrooms/{chatRoomId}/share_files?pagesize={pageSize}&pagenum={pageNum}
```

**服务端原始返回**

聊天室共享文件列表与群共享文件接口字段同构，仅 endpoint 不同，代表性结构如下：

```json
{
  "count": 2,
  "data": [
    {
      "file_id": "62801670-3339-11f1-8f33-6fb173041e99",
      "created": 1775645698448,
      "file_owner": "zd1",
      "file_name": "index.html",
      "file_size": 959
    }
  ],
  "params": {
    "pagesize": ["20"],
    "pagenum": ["1"]
  }
}
```

**SDK 返回**

```ts
{
  items: [
    {
      fileId: '62801670-3339-11f1-8f33-6fb173041e99',
      fileName: 'index.html',
      fileOwner: {
        userId: 'zd1',
      },
      fileSize: 959,
      createdAt: 1775645698448,
    },
  ],
  pageNum: 1,
  pageSize: 20,
}
```

---

## `chatRoom.deleteSharedFile`

**签名**

```ts
chatRoom.deleteSharedFile(input: ChatRoomDeleteSharedFileInput): Promise<void>
```

**REST**

```http
DELETE /{org}/{app}/chatrooms/{chatRoomId}/share_files/{fileId}?resource={resource}
```

**服务端原始返回**

当前 SDK 不依赖返回体；成功只表示删除完成。

**SDK 返回**

```ts
Promise<void>;
```

---

## `chatRoom.getAttributes`

**签名**

```ts
chatRoom.getAttributes(input?: GetChatRoomAttributesInput): Promise<ChatRoomAttributesSnapshot>
```

**REST**

```http
POST /{org}/{app}/metadata/chatroom/{chatRoomId}
Content-Type: application/json
```

**请求参数**

```ts
{
  keys?: ReadonlyArray<string>;
}
```

**服务端原始返回**

```json
{
  "data": {
    "key1": "value1",
    "key2": "value2"
  }
}
```

**SDK 返回**

```ts
{
  chatRoomId: '301206510567427',
  attributes: {
    key1: 'value1',
    key2: 'value2',
  },
}
```

---

## `chatRoom.setAttributes` / `chatRoom.setAttribute`

**签名**

```ts
chatRoom.setAttributes(input: SetChatRoomAttributesInput): Promise<ChatRoomAttributeMutationResult>
chatRoom.setAttribute(input: SetChatRoomAttributeInput): Promise<ChatRoomAttributeMutationResult>
```

**REST**

```http
PUT /{org}/{app}/metadata/chatroom/{chatRoomId}/user/{userId}
Content-Type: application/json
```

**请求参数**

`setAttributes()`：

```ts
{
  attributes: Readonly<Record<string, string>>;
}
```

`setAttribute()` 会被收敛成同一个多键接口：

```json
{
  "metaData": {
    "topic": "sdk"
  },
  "autoDelete": "DELETE"
}
```

**服务端原始返回**

```json
{
  "data": {
    "successKeys": ["key1"],
    "errorKeys": {
      "key2": "errorDesc"
    }
  }
}
```

**SDK 返回**

```ts
{
  chatRoomId: '301206510567427',
  appliedKeys: ['key1'],
  failedKeys: {
    key2: { code: 303, message: 'errorDesc' },
  },
}
```

---

## `chatRoom.removeAttributes` / `chatRoom.removeAttribute`

**签名**

```ts
chatRoom.removeAttributes(input: RemoveChatRoomAttributesInput): Promise<ChatRoomAttributeMutationResult>
chatRoom.removeAttribute(input: RemoveChatRoomAttributeInput): Promise<ChatRoomAttributeMutationResult>
```

**REST**

```http
DELETE /{org}/{app}/metadata/chatroom/{chatRoomId}/user/{userId}
Content-Type: application/json
```

**请求参数**

```ts
{
  keys: ReadonlyArray<string>;
}
```

`removeAttribute()` 会被收敛成同一个多键接口，只传单个 key。

**服务端原始返回**

```json
{
  "status": "ok",
  "data": {
    "successKeys": ["key1"],
    "errorKeys": {
      "key2": "errorDesc"
    }
  }
}
```

**SDK 返回**

```ts
{
  chatRoomId: '301206510567427',
  appliedKeys: ['key1'],
  failedKeys: {
    key2: { code: 303, message: 'errorDesc' },
  },
}
```

---

## 6. 错误处理

> 完整的移动端错误码对照与判断逻辑见 [`docs/reference/chatroom-manager-error-codes.md`](./chatroom-manager-error-codes.md)。

### 6.1 聊天室专属错误码

| 常量 | 数值 | 含义 |
|---|---|---|
| `CHATROOM_INVALID_ID` | 700 | 聊天室 ID 无效 |
| `CHATROOM_NOT_JOINED` | 702 | 未加入聊天室 |
| `CHATROOM_PERMISSION_DENIED` | 703 | 聊天室无权限 |
| `CHATROOM_MEMBERS_FULL` | 704 | 聊天室成员已满 |
| `CHATROOM_NOT_EXIST` | 705 | 聊天室不存在 |
| `CHATROOM_OWNER_NOT_ALLOW_LEAVE` | 706 | 聊天室所有者不允许退出 |
| `CHATROOM_USER_IN_BLOCKLIST` | 707 | 用户在聊天室黑名单中 |

这些常量通过 `ERROR_CODES.CHATROOM_*` 访问，定义在 `src/utils/error-codes.ts`。

### 6.2 参数校验

所有客户端参数校验（chatRoomId 为空、userIds 为空等）统一抛出 `ValidationError` + `ERROR_CODES.VALIDATION_REQUIRED`(110)，与 REST 层 `normalizeChatRoomId` / `normalizeChatRoomUserIds` 保持一致。

### 6.3 REST 错误映射

REST 层通过 `api-errors.json` 中的定义自动映射服务端错误。支持三种匹配方式：

- **精确匹配**：`error` 字段与定义的 key 完全一致
- **字段值匹配**（`matchField` + `matchValue`）：如属性 API 的 `error_code` 字段（60010/60011/60012）
- **子串匹配**（`matchField` + `matchPattern`）：如 `joinChatRoom` 的 `error_description` 包含 `"member list is full"`

#### joinChatRoom 特有错误

| 服务端响应 | SDK 错误码 |
|---|---|
| HTTP 403 + `error_description` 包含 `"member list is full"` | `CHATROOM_MEMBERS_FULL`(704) |
| HTTP 403 + `error_description` 包含 `"is in the blacklist"` | `CHATROOM_USER_IN_BLOCKLIST`(707) |

#### 属性 API 特有错误（HTTP 400 + `error_code` 字段）

| `error_code` | SDK 错误码 | 含义 |
|---|---|---|
| 60010 | `CHATROOM_PERMISSION_DENIED`(703) | 无权修改该属性 |
| 60011 | `CHATROOM_NOT_JOINED`(702) | 未加入聊天室 |
| 60012 | `SERVICE_LIMIT_EXCEEDED`(4) | 属性数量/总量超限 |

### 6.4 属性批量操作部分成功

属性写入/删除的响应包含 `successKeys` 和 `errorKeys`：

- **全部成功**：正常返回 `ChatRoomAttributeMutationResult`
- **部分成功**：返回 `ChatRoomAttributeMutationResult`，`appliedKeys` 和 `failedKeys` 均可访问
- **全部失败**：抛出 `SDKError`，错误码取第一个 `failedKey` 的映射码

### 6.5 事件 payload 解析规则

#### `onMuteListAdded`（ADD_MUTE）

优先从 `ext` JSON 的 `user_mute_time` 对象提取按用户区分的禁言到期时间戳：

```json
{"user_mute_time": {"userId1": 1730894708086, "userId2": 1730894708086}}
```

解析失败时回退到成员列表 + 默认过期时间 `4638873600000`（约 2116 年）。

事件 payload 中 `muteMembers: Record<string, number>` 始终可用。

#### `onRemovedFromChatRoom`（KICK）

通过 `reason` 字段区分：
- `reason === "chatroom kick offline user"` → 因离线被踢（`BE_KICKED_FOR_OFFLINE`）
- 其他 → 被管理员踢出（`BE_KICKED`）

#### `onMembersJoined` / `onMembersExited`（PRESENCE / ABSENCE）

优先从 `members` 列表获取成员，为空时回退到 `from` 用户；单成员场景也通过单元素 `members` 数组表达。

---

## 7. 028 范围边界

- `getAttributes({ keys?: string[] })` 是唯一公开属性读取入口。
- allowlist 是公开 API 与事件命名；事件名使用 `onAllowListAdded` / `onAllowListRemoved`。
- `ChatRoom` 不提供 `getName`、`getOwner`、`getCreateTimestamp` 这类字段级 getter。
- `uploadSharedFile` 已从 028 公开面移除，不在类型、合同、文档和测试范围内。
