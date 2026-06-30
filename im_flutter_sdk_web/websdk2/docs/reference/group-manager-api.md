# GroupManager / Group REST 与 SDK 返回对照

> 参考：
>
> - [RESTful-API-Body-Formats](./RESTful-API-Body-Formats.md)
> - [SDK 对外 API 命名规范](./sdk-naming-conventions.md)
> - 当前实现：`src/managers/group-manager.ts`、`src/rest/group-management.ts`、`src/managers/group/*`

> 说明：本文档已按 027 最新规格收敛为目标公开面，`GroupManager + Group` 的最终落地以对应实现任务完成结果为准。

本文档说明 `GroupManager` 与 `Group` 当前在 `websdk2` 中的：

- 实际 REST 路径与请求参数
- 服务端原始返回结构与 SDK 归一化规则
- 对象化用户结果与群事件模型

---

## 1. 设计原则

- 群组域唯一入口为 `client.groupManager`。
- 单群上下文能力通过 `client.groupManager.getGroup(groupId)` 返回的 `Group` 对象访问。
- 公开读接口统一返回业务对象，不直接透出 REST envelope 的 `uri/timestamp/entities/duration`。
- 群列表继续返回 plain object，不把列表项升级为 `Group` 实例。
- 原来只返回 `userId` 的成员、管理员、黑名单、allowlist、禁言结果，当前统一返回 `UserInfo` 对象视图。
- 用户资料补齐采用 cache-first：
  - 先读 `CacheManager` / `UserInfoSummary`
  - 缺失时批量调用 `fetchUserInfoByUserId`
  - 若补拉失败，回退最小 `UserInfo { userId }`
- 群事件名与移动端保持一致，但事件载荷按 Web SDK 对象模型返回。
- `onGroupInfoChanged` / `onGroupDisabledChanged` 对外返回完整 `GroupDetail`；事件原始字段不足时允许先补拉群详情。
- `Group` 只是绑定 `groupId` 的轻量 façade，不承担本地状态真相或自动同步职责。

### 1.1 迁移要点

- 旧 connection/group 风格的群组主路径不再作为推荐公开面保留，统一迁移到 `client.groupManager`。
- 单群上下文方法不再鼓励继续堆在 `GroupManager` 上，推荐通过 `groupManager.getGroup(groupId)` 返回的 `Group` 对象调用。
- 原来只返回 `userId` 的读取结果当前统一迁移为对象化 `UserInfo` 视图；资料不足时至少保证 `{ userId }` 最小可用视图。
- 白名单读取能力对外统一使用 allowlist 术语，但群事件仍保持移动端同名 `onAllowListAdded` / `onAllowListRemoved`，避免事件集合再次分叉。

---

## 2. 推荐公开面

> 本节只列推荐对外 API。属于 `Group` 的单群方法不再作为 GroupManager 对外 API 文档的一部分展示。

### 2.1 GroupManager 对外 API 一览

| Web SDK API                | REST API                                   | SDK 对外返回                          |
| -------------------------- | ------------------------------------------ | ------------------------------------- |
| `createGroup()`            | `POST /chatgroups`                         | `Promise<{ groupId: string }>`        |
| `getJoinedGroupList()`     | 本地 group-sync 列表                       | `ReadonlyArray<JoinedGroupSummary>`   |
| `getGroup(groupId)`        | N/A（本地创建 façade）                     | `Group`                               |
| `getGroupInfo()`           | `GET /chatgroups/{groupId}`                | `Promise<GroupDetail>`                |
| `getGroupInfoList()`       | `GET /chatgroups/{groupIds}`               | `Promise<ReadonlyArray<GroupDetail>>` |
| `joinGroup()`              | `POST /chatgroups/{groupId}/apply`         | `Promise<void>`                       |
| `inviteUsersToGroup()`     | `POST /chatgroups/{groupId}/invite`        | `Promise<void>`                       |
| `acceptGroupJoinRequest()` | `POST /chatgroups/{groupId}/apply_verify`  | `Promise<void>`                       |
| `rejectGroupJoinRequest()` | `POST /chatgroups/{groupId}/apply_verify`  | `Promise<void>`                       |
| `acceptGroupInvite()`      | `POST /chatgroups/{groupId}/invite_verify` | `Promise<void>`                       |
| `rejectGroupInvite()`      | `POST /chatgroups/{groupId}/invite_verify` | `Promise<void>`                       |

### 2.2 Group 对外 API 一览

| Web SDK API                      | REST API                                     | SDK 对外返回                                  |
| -------------------------------- | -------------------------------------------- | --------------------------------------------- |
| `group.getSummary()`             | N/A（本地 group-sync 快照）                  | `JoinedGroupSummary \| null`                  |
| `group.getDetail()`              | `GET /chatgroups/{groupId}`                  | `Promise<GroupDetail>`                        |
| `group.refresh()`                | `GET /chatgroups/{groupId}`                  | `Promise<GroupDetail>`                        |
| `group.updateInfo()`             | `PUT /chatgroups/{groupId}`                  | `Promise<void>`                               |
| `group.changeOwner()`            | `PUT /chatgroups/{groupId}`                  | `Promise<void>`                               |
| `group.destroy()`                | `DELETE /chatgroups/{groupId}`               | `Promise<void>`                               |
| `group.leave()`                  | `DELETE /chatgroups/{groupId}/quit`          | `Promise<void>`                               |
| `group.getMembers()`             | `GET /chatgroups/{groupId}/users`            | `Promise<GroupMemberListResult>`              |
| `group.getAdmins()`              | `GET /chatgroups/{groupId}/admin`            | `Promise<ReadonlyArray<UserInfo>>`            |
| `group.getMuteList()`            | `GET /chatgroups/{groupId}/mute`             | `Promise<ReadonlyArray<GroupMuteEntry>>`      |
| `group.getBlocklist()`           | `GET /chatgroups/{groupId}/blocks/users`     | `Promise<ReadonlyArray<GroupBlocklistEntry>>` |
| `group.getAllowlist()`           | `GET /chatgroups/{groupId}/white/users`      | `Promise<ReadonlyArray<GroupAllowlistEntry>>` |
| `group.getAnnouncement()`        | `GET /chatgroups/{groupId}/announcement`     | `Promise<GroupAnnouncement>`                  |
| `group.getSharedFileList()`      | `GET /chatgroups/{groupId}/sharefiles`       | `Promise<GroupSharedFileListResult>`          |
| `group.getMembersAttributes()`   | `POST /sdk/metadata/chatgroup/{groupId}/get` | `Promise<GroupMembersAttributesResult>`       |

---

## 3. 共享数据结构

### 3.1 `GroupDetail`

```ts
{
  groupId: string;
  name: string;
  description?: string;
  public?: boolean;
  joinApprovalRequired?: boolean;
  allowInvites?: boolean;
  maxMembers?: number;
  owner?: UserInfo;
  inviteNeedConfirm?: boolean;
  muteAllMembers?: boolean;
  ext?: string;
  createdAt?: number;
  joinedAt?: number;
  memberCount?: number;
  avatarUrl?: string;
  messageBlocked?: boolean;
  disabled?: boolean;
}
```

### 3.2 `GroupMemberEntry`

```ts
{
  user: UserInfo;
  role?: 'owner' | 'admin' | 'member';
  joinedAt?: number;
}
```

### 3.3 `GroupMuteEntry` / `GroupAllowlistEntry` / `GroupBlocklistEntry`

```ts
{
  user: UserInfo;
}
```

说明：

- 服务端原始返回通常是 `["user1", "user2"]`
- SDK 对外统一转换为对象数组

### 3.4 `GroupMembersAttributesResult`

```ts
{
  items: {
    [userId: string]: {
      [key: string]: string;
    };
  };
}
```

说明：

- 成员属性统一通过 `group.getMembersAttributes({ userIds })` 读取
- 单成员属性读取使用 `userIds: [userId]`，返回结构仍保持 `items[userId] -> attribute map`

---

## 4. 对象化用户结果示例

### 4.1 群管理员

服务端原始返回：

```json
{
  "data": ["zd2"]
}
```

SDK 对外返回：

```ts
[
  {
    userId: 'zd2',
    nickname: 'Tom',
    avatarUrl: 'https://cdn.example.com/tom.png',
  },
];
```

### 4.2 群成员

服务端原始返回：

```json
{
  "data": [{ "member": "zd3" }, { "owner": "zd1" }]
}
```

SDK 对外返回：

```ts
{
  items: [
    {
      user: { userId: 'zd3' },
      role: 'member',
    },
    {
      user: { userId: 'zd1', nickname: 'Owner' },
      role: 'owner',
    },
  ],
}
```

---

## 5. API 请求参数与返回结构

> 说明：
>
> - 本节按推荐公开面整理，分为 `GroupManager` 入口 API 和 `Group` 单群 API。
> - `groupManager.getGroup(groupId)` 本身不发 REST 请求，只创建绑定 `groupId` 的轻量 `Group` 对象。
> - 对于写接口，如当前没有稳定服务端返回样例，文档会明确写“SDK 当前不依赖返回体”。

## 5.1 GroupManager API

## `createGroup`

**签名**

```ts
createGroup(params: CreateGroupParams): Promise<{ groupId: string }>
```

**REST**

```http
POST /{org}/{app}/chatgroups?resource={resource}
Content-Type: application/json
```

**请求参数：`CreateGroupParams`**

```ts
{
  name: string;
  description: string;
  memberIds?: ReadonlyArray<string>;
  public: boolean;
  joinApprovalRequired: boolean;
  allowInvites: boolean;
  inviteNeedConfirm: boolean;
  maxMembers?: number;
  ext?: string;
}
```

**服务端原始返回**

```ts
{
    "action": "post",
    "application": "e0a3d0f7-b6d9-4b6a-af22-e8b9aaee776f",
    "applicationName": "chatdemoui",
    "data": {
        "groupid": "311362611904516"
    },
    "duration": 0,
    "entities": [],
    "organization": "easemob-demo",
    "params": {
        "resource": [
            "webim_web_1775788172639"
        ]
    },
    "properties": {},
    "timestamp": 1776336926387,
    "uri": "https://a1.easemob.com/easemob-demo/chatdemoui/chatgroups"
}
```

可能的错误
如果返回的 HTTP 状态码非 200，表示请求失败，可能提示以下错误码：

HTTP 状态码 错误类型 错误提示 可能原因 处理建议
400 invalid_parameter XX must be provided XX 字段没有设置。 请传入必传字段。
400 invalid_parameter avatar length is too big 头像字段长度达到上限 修改头像字段在长度限制下。
400 invalid_parameter group must contain public field! 创建群组必须设置 public 字段 设置 public 字段。
400 illegal_argument group ID XX already exists! groupId 重复。 使用新的群组 ID。
401 unauthorized Unable to authenticate (OAuth) token 不合法，可能过期或 token 错误。 使用新的 token 访问。
403 exceed_limit appKey:XX#XX has create too many groups! appKey 的群组数量达到上限。 删除不用的群组或联系商务调整上限。关于该上限，详见 详见 IM 套餐包功能详情。
403 exceed_limit user XX has joined too many groups! 用户加入的群组数量达到上限。 退出不用的群组或在 环信控制台上调用户可加入群组数上限。
403 exceed_limit members size is greater than max user size ! 创建群时加入的人数超过最大限制。 调整创建群的加群人数。关于该上限，详见 详见 IM 套餐包功能详情。
403 group_name_violation XX is violation, please change it. 群组名称不合法。 使用合法的群组名称。
404 resource_not_found username XXXX doesn't exist! 创建群组时添加的用户不存在。

**SDK 返回**

```ts
{
  groupId: '310637239533569';
}
```

---

## `getJoinedGroupList`

**签名**

```ts
getJoinedGroupList(): ReadonlyArray<JoinedGroupSummary>
```

**行为**

纯读取登录同步后的本地已加入群组列表，不发起 REST 请求。同步完成前可返回 localStorage 中最多 100 个预览；同步完成后返回当前会话运行时列表。同步完整性、preview 来源和服务端单轮上限等诊断信息不随数组返回，也不通过 `onSyncDataFinished` payload 暴露，仅保留在 SDK 内部快照与结构化日志中。

**服务端原始返回**

无。该接口只读取本地 group-sync 结果，不调用 REST 分页接口。

**SDK 返回**

```ts
[
  {
    groupId: '310637239533569',
    name: '',
    disabled: false,
  },
]
```

---

## `getGroup`

**签名**

```ts
getGroup(groupId: string): Group
```

**REST**

无。该接口只返回绑定 `groupId` 的单群对象。

**SDK 返回**

```ts
const group = client.groupManager.getGroup('310637239533569');
// group.groupId === '310637239533569'
```

---

## `getGroupInfo`

**签名**

```ts
getGroupInfo(params: GetGroupInfoParams): Promise<GroupDetail>
```

**REST**

```http
GET /{org}/{app}/chatgroups/{groupId}?joined_time=true&version=v3&resource={resource}
```

**服务端原始返回**

```json
{
  "count": 1,
  "data": [
    {
      "id": "310637239533569",
      "name": "",
      "description": "测试群组描述呀",
      "membersonly": false,
      "allowinvites": true,
      "maxusers": 199,
      "owner": "zd1",
      "created": 1775645157182,
      "custom": "",
      "mute": false,
      "affiliations_count": 1,
      "avatar": "",
      "disabled": false,
      "affiliations": [
        {
          "owner": "zd1",
          "joined_time": 1775645157212
        }
      ],
      "public": false,
      "shieldgroup": false
    }
  ]
}
```

可能的错误

HTTP 状态码 错误类型 错误提示 可能原因 处理建议
401 unauthorized Unable to authenticate (OAuth) token 不合法，可能过期或 token 错误。 使用新的 token 访问。
404 resource_not_found grpID XX does not exist! 群组不存在。 使用合法的群 ID。

**SDK 返回**

```ts
{
  groupId: '310637239533569',
  name: '',
  description: '测试群组描述呀',
  joinApprovalRequired: false,
  allowInvites: true,
  maxMembers: 199,
  owner: {
    userId: 'zd1',
  },
  createdAt: 1775645157182,
  ext: '',
  muteAllMembers: false,
  memberCount: 1,
  avatarUrl: '',
  disabled: false,
  joinedAt: 1775645157212,
  public: false,
  messageBlocked: false,
}
```

---

## `getGroupInfoList`

**签名**

```ts
getGroupInfoList(params: GetGroupInfoListParams): Promise<ReadonlyArray<GroupDetail>>
```

**REST**

```http
GET /{org}/{app}/chatgroups/{groupIds}?resource={resource}
```

**服务端原始返回**

参考getGroupInfo。

**SDK 返回**

```ts
[
  {
    groupId: '310637239533569',
    name: 'Group 1',
  },
];
```

---

## `joinGroup`

**签名**

```ts
joinGroup(params: GroupJoinParams): Promise<void>
```

**REST**

```http
POST /{org}/{app}/chatgroups/{groupId}/apply?resource={resource}
Content-Type: application/json
```

**请求参数**

```ts
{
  groupId: string;
  message?: string;
}
```

**服务端原始返回**

当前 SDK 不依赖返回体；成功只表示请求完成。

**SDK 返回**

```ts
Promise<void>;
```

---

## `inviteUsersToGroup`

**签名**

```ts
inviteUsersToGroup(params: GroupUserBatchParams): Promise<void>
```

**REST**

```http
POST /{org}/{app}/chatgroups/{groupId}/invite?resource={resource}
Content-Type: application/json
```

**请求参数**

```ts
{
  groupId: string;
  userIds: ReadonlyArray<string>;
}
```

**服务端原始返回**

当前 SDK 不依赖返回体；成功只表示请求完成。

**SDK 返回**

```ts
Promise<void>;
```

---

## `acceptGroupJoinRequest` / `rejectGroupJoinRequest`

**签名**

```ts
acceptGroupJoinRequest(params: AcceptGroupJoinRequestParams): Promise<void>
rejectGroupJoinRequest(params: RejectGroupJoinRequestParams): Promise<void>
```

**REST**

```http
POST /{org}/{app}/chatgroups/{groupId}/apply_verify?resource={resource}
Content-Type: application/json
```

**请求 Body**

```json
{
  "applicant": "zd2",
  "verifyResult": true,
  "reason": "welcome"
}
```

或

```json
{
  "applicant": "zd2",
  "verifyResult": false,
  "reason": "reject"
}
```

**服务端原始返回**

当前 SDK 不依赖返回体；成功只表示请求完成。

**SDK 返回**

```ts
Promise<void>;
```

---

## `acceptGroupInvite` / `rejectGroupInvite`

**签名**

```ts
acceptGroupInvite(params: GroupMutationTarget): Promise<void>
rejectGroupInvite(params: GroupMutationTarget): Promise<void>
```

**REST**

```http
POST /{org}/{app}/chatgroups/{groupId}/invite_verify?resource={resource}
Content-Type: application/json
```

**请求 Body**

```json
{
  "invitee": "currentUserId",
  "verifyResult": true
}
```

或

```json
{
  "invitee": "currentUserId",
  "verifyResult": false
}
```

**服务端原始返回**

当前 SDK 不依赖返回体；成功只表示请求完成。

**SDK 返回**

```ts
Promise<void>;
```

---

## 5.2 Group API

## `group.getSummary`

**签名**

```ts
group.getSummary(): JoinedGroupSummary | null
```

**REST**

不发起网络请求，只读取当前登录会话同步结果或 localStorage 中最多 100 个群组预览。

**SDK 返回**

返回本地已知的已加入群轻量摘要，例如群名称、头像、描述、成员数、当前用户角色、免打扰类型等。该结果不等同于完整 `GroupDetail`；如需完整群配置、管理员、公告或共享文件信息，应显式调用 `group.getDetail()` 或对应单群 API。

---

## `group.getDetail` / `group.refresh`

**签名**

```ts
group.getDetail(): Promise<GroupDetail>
group.refresh(): Promise<GroupDetail>
```

**REST**

复用 `getGroupInfo`：

```http
GET /{org}/{app}/chatgroups/{groupId}?joined_time=true&version=v3&resource={resource}
```

**服务端原始返回**

同 `getGroupInfo`。

**SDK 返回**

同 `getGroupInfo`。

---

## `group.updateInfo`

**签名**

```ts
group.updateInfo(input: GroupUpdateInfoInput): Promise<void>
```

**REST**

```http
PUT /{org}/{app}/chatgroups/{groupId}?resource={resource}
Content-Type: application/json
```

**请求参数**

```ts
{
  name?: string;
  description?: string;
  public?: boolean;
  joinApprovalRequired?: boolean;
  allowInvites?: boolean;
  inviteNeedConfirm?: boolean;
  maxMembers?: number;
  ext?: string;
}
```

**服务端原始返回**

当前 SDK 不依赖返回体；成功只表示请求完成。

**SDK 返回**

```ts
Promise<void>;
```

---

## `group.changeOwner` / `group.destroy` / `group.leave`

**签名**

```ts
group.changeOwner(input: GroupOwnerChangeInput): Promise<void>
group.destroy(): Promise<void>
group.leave(): Promise<void>
```

**REST**

```http
PUT /{org}/{app}/chatgroups/{groupId}?resource={resource}
DELETE /{org}/{app}/chatgroups/{groupId}?resource={resource}
DELETE /{org}/{app}/chatgroups/{groupId}/quit?resource={resource}
```

**服务端原始返回**

当前 SDK 不依赖返回体；成功只表示请求完成。

changeOwner可能的错误：

HTTP 状态码 错误类型 错误提示 可能原因 处理建议
401 unauthorized Unable to authenticate (OAuth) token 不合法，可能过期或 token 错误。 使用新的 token 访问。
403 forbidden_op user: XX doesn't exist in group: XXX 要转让的新群主不在群组中。 传入群组成员的用户 ID。
403 forbidden_op new owner and old owner are the same 新群主和旧群主不能是同一群成员。 传入的新群主的用户 ID 不能与旧群主的用户 ID 相同。
404 resource_not_found grpID XX does not exist! 群组不存在。 使用合法的群 ID。

**SDK 返回**

```ts
Promise<void>;
```

---

## `group.getMembers`

**签名**

```ts
group.getMembers(query?: GroupMemberListQuery): Promise<GroupMemberListResult>
```

**REST**

```http
GET /{org}/{app}/chatgroups/{groupId}/users?pagesize={pageSize}&pagenum={pageNum}&resource={resource}
```

**服务端原始返回**

```json
{
  "action": "get",
  "application": "cc7380d5-XXXX-XXXX-a93e-51d6d590b475",
  "params": {
    "joined_time": ["true"],
    "pagesize": ["2"],
    "pagenum": ["2"]
  },
  "uri": "https://XXXX/XXXX/XXXX/chatgroups/10XXXX85/users",
  "entities": [],
  "data": [
    {
      "owner": "user1",
      "joined_time": 1732524850107
    },
    {
      "member": "user2",
      "joined_time": 173252433456
    }
  ],
  "timestamp": 1489074511416,
  "duration": 0,
  "organization": "XXXX",
  "applicationName": "testapp",
  "count": 2
}
```

可能的错误：
HTTP 状态码 错误类型 错误提示 可能原因 处理建议
401 unauthorized Unable to authenticate (OAuth) token 不合法，可能过期或 token 错误。 使用新的 token 访问。
404 service_resource_not_found do not find this group:XX 群组不存在。 使用合法的群 ID。

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
      role: 'member',
    },
    {
      user: { userId: 'zd1' },
      role: 'owner',
    },
  ],
  pageNum: 1,
  pageSize: 5,
}
```

说明：

- `member` / `owner` 字段会统一归一化为 `user + role`
- 用户资料会按 cache-first 补齐为 `UserInfo`

---

## `group.getAdmins`

**签名**

```ts
group.getAdmins(): Promise<ReadonlyArray<UserInfo>>
```

**REST**

```http
GET /{org}/{app}/chatgroups/{groupId}/admin?resource={resource}
```

**服务端原始返回**

```json
{
  "action": "get",
  "application": "52XXXXf0",
  "uri": "https://XXXX/XXXX/XXXX/chatgroups/10XXXX85/admin",
  "entities": [],
  "data": ["user1"],
  "timestamp": 1489073361210,
  "duration": 0,
  "organization": "XXXX",
  "applicationName": "testapp",
  "count": 1
}
```

可能的错误：

HTTP 状态码 错误类型 错误提示 可能原因 处理建议
401 unauthorized Unable to authenticate (OAuth) token 不合法，可能过期或 token 错误。 使用新的 token 访问。
404 resource_not_found grpID XX does not exist! 群组不存在。 使用合法的群 ID。

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

## `group.getMuteList`

**签名**

```ts
group.getMuteList(): Promise<ReadonlyArray<GroupMuteEntry>>
```

**REST**

```http
GET /{org}/{app}/chatgroups/{groupId}/mute?resource={resource}
```

**服务端原始返回**

```json
{
  "action": "get",
  "application": "52XXXXf0",
  "uri": "https://XXXX/XXXX/XXXX/chatgroups/10XXXX85/mute",
  "entities": [],
  "data": [
    {
      "expire": 1489158589481,
      "user": "user1"
    }
  ],
  "timestamp": 1489072802179,
  "duration": 0,
  "organization": "XXXX",
  "applicationName": "testapp"
}
```

或需求方确认的常规结构：

```json
{
  "data": ["user1", "user2"]
}
```

可能的错误：
HTTP 状态码 错误类型 错误提示 可能原因 处理建议
401 unauthorized Unable to authenticate (OAuth) token 不合法，可能过期或 token 错误。 使用新的 token 访问。
404 resource_not_found grpID XX does not exist! 群组不存在。 使用合法的群组 ID。

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

说明：

- 当前真实样例里为空数组
- 需求已确认禁言列表语义为 `string[]`
- 如服务端未提供禁言截止时间，`muteExpire` / `muteDuration` 保持缺省

---

## `group.getBlocklist`

**签名**

```ts
group.getBlocklist(): Promise<ReadonlyArray<GroupBlocklistEntry>>
```

**REST**

```http
GET /{org}/{app}/chatgroups/{groupId}/blocks/users?resource={resource}
```

**服务端原始返回**

```json
{
  "action": "get",
  "application": "8bXXXX02",
  "uri": "https://XXXX/XXXX/XXXX/chatgroups/67178793598977/blocks/users",
  "entities": [],
  "data": ["user2", "user3"],
  "timestamp": 1543466293681,
  "duration": 0,
  "organization": "XXXX",
  "applicationName": "testapp",
  "count": 2
}
```

可能的错误：

HTTP 状态码 错误类型 错误提示 可能原因 处理建议
401 unauthorized Unable to authenticate (OAuth) token 不合法，可能过期或 token 错误。 使用新的 token 访问。
404 resource_not_found grpID XX does not exist! 群组不存在。 使用合法的群 ID。

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

## `group.getAllowlist`

**签名**

```ts
group.getAllowlist(): Promise<ReadonlyArray<GroupAllowlistEntry>>
```

**REST**

```http
GET /{org}/{app}/chatgroups/{groupId}/white/users?resource={resource}
```

**服务端原始返回**

```json
{
  "action": "get",
  "application": "XXXX",
  "uri": "https://XXXX/XXXX/XXXX/chatgroups/12XXXX53/white/users",
  "entities": [],
  "data": ["wzy_test", "wzy_vivo", "wzy_huawei", "wzy_xiaomi", "wzXXXXzu"],
  "timestamp": 1594724947117,
  "duration": 3,
  "organization": "XXXX",
  "applicationName": "XXXX",
  "count": 5
}
```

可能的错误：
HTTP 状态码 错误类型 错误提示 可能原因 处理建议
401 unauthorized Unable to authenticate (OAuth) token 不合法，可能过期或 token 错误。 使用新的 token 访问。
404 resource_not_found grpID XX does not exist! 群组不存在。 使用合法的群 ID。

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

## `group.getAnnouncement`

**签名**

```ts
group.getAnnouncement(): Promise<GroupAnnouncement>
```

**REST**

```http
GET /{org}/{app}/chatgroups/{groupId}/announcement?resource={resource}
```

**服务端原始返回**

```json
{
  "action": "get",
  "application": "8bXXXX02",
  "uri": "https://XXXX/XXXX/XXXX/chatgroups/6XXXX7/announcement",
  "entities": [],
  "data": {
    "announcement": "群组公告..."
  },
  "timestamp": 1542363546590,
  "duration": 0,
  "organization": "XXXX",
  "applicationName": "testapp"
}
```

可能的错误：
HTTP 状态码 错误类型 错误提示 可能原因 处理建议
401 unauthorized Unable to authenticate (OAuth) token 不合法，可能过期或 token 错误。 使用新的 token 访问。
404 resource_not_found grpID XX does not exist! 群组不存在。 使用合法的群 ID。
**SDK 返回**

```ts
{
  announcement: '',
}
```

---

## `group.getSharedFileList`

**签名**

```ts
group.getSharedFileList(query?: GroupSharedFileListQuery): Promise<GroupSharedFileListResult>
```

**REST**

```http
GET /{org}/{app}/chatgroups/{groupId}/sharefiles?pagesize={pageSize}&pagenum={pageNum}&resource={resource}
```

**服务端原始返回**

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

可能的错误：
HTTP 状态码 错误类型 错误提示 可能原因 处理建议
401 unauthorized Unable to authenticate (OAuth) token 不合法，可能过期或 token 错误。 使用新的 token 访问。
404 RestGroupFeignException grpID XX does not exist! 群组不存在。 使用合法的群 ID。
**SDK 返回**

```ts
{
  items: [
    {
      fileId: '62801670-3339-11f1-8f33-6fb173041e99',
      createdAt: 1775645698448,
      fileOwner: {
        userId: 'zd1',
      },
      fileName: 'index.html',
      fileSize: 959,
    },
  ],
  pageNum: 1,
  pageSize: 20,
}
```

---

## `group.getMembersAttributes`

**签名**

```ts
group.getMembersAttributes(
  input: GroupGetMembersAttributesInput
): Promise<GroupMembersAttributesResult>
```

**REST**

```http
POST /{org}/{app}/sdk/metadata/chatgroup/{groupId}/get?resource={resource}
Content-Type: application/json
```

**服务端原始返回**

```json
{
  "data": {
    "zd3": {
      "nickname": "nickName",
      "avatar": "avatar url"
    }
  }
}
```

**SDK 返回**

```ts
{
  items: {
    zd3: {
      nickname: 'nickName',
      avatar: 'avatar url',
    },
  },
}
```

---

## 6. 群事件模型

### 5.0 推荐使用方式

```ts
import { ChatClient, GroupManager } from 'im-sdk-web';

const client = ChatClient.init({ appKey: 'org#app' }).use(GroupManager);

const groups = client.groupManager.getJoinedGroupList();

const group = client.groupManager.getGroup(groups[0]?.groupId ?? '');
const summary = group.getSummary();
const detail = await group.getDetail();
const admins = await group.getAdmins();
```

### 5.1 注册方式

```ts
import { ChatClient, GroupManager } from 'im-sdk-web';

const client = ChatClient.init({ appKey: 'org#app' }).use(GroupManager);

client.groupManager.addEventHandler('group-ui', {
  onInvitationReceived: payload => {
    console.log(payload.groupId, payload.inviter?.userId, payload.reason);
  },
  onGroupInfoChanged: payload => {
    console.log(payload.group.groupId, payload.group.name);
  },
  onUserGroupNamecardUpdated: payload => {
    console.log(payload.user?.userId, payload.groupNamecard);
  },
});
```

### 5.2 旧 MUC operation 到新事件名

| 旧 operation                                     | 新事件名                                       |
| ------------------------------------------------ | ---------------------------------------------- |
| `APPLY`                                          | `onRequestToJoinReceived`                      |
| `APPLY_ACCEPT`                                   | `onRequestToJoinAccepted`                      |
| `APPLY_DECLINE`                                  | `onRequestToJoinDeclined`                      |
| `INVITE`                                         | `onInvitationReceived`                         |
| `INVITE_ACCEPT`                                  | `onInvitationAccepted`                         |
| `INVITE_DECLINE`                                 | `onInvitationDeclined`                         |
| `DESTROY`                                        | `onGroupDestroyed`                             |
| `DIRECT_JOINED`                                  | `onAutoAcceptInvitationFromGroup`              |
| `ADD_ADMIN`                                      | `onAdminAdded`                                 |
| `REMOVE_ADMIN`                                   | `onAdminRemoved`                               |
| `ASSIGN_OWNER`                                   | `onOwnerChanged`                               |
| `PRESENCE` / `ABSENCE`                           | `onMembersJoined` / `onMembersExited`            |
| `UPDATE_ANNOUNCEMENT`                            | `onAnnouncementChanged`                        |
| `UPLOAD_FILE` / `DELETE_FILE`                    | `onSharedFileAdded` / `onSharedFileDeleted`    |
| `ADD_USER_WHITE_LIST` / `REMOVE_USER_WHITE_LIST` | `onAllowListAdded` / `onAllowListRemoved`      |
| `BAN_GROUP` / `REMOVE_BAN_GROUP`                 | `onAllMemberMuteStateChanged`                  |
| `UPDATE`                                         | `onGroupInfoChanged`                             |
| `DISABLE_GROUP` / `ABLE_GROUP`                   | `onGroupDisabledChanged`                         |
| `GROUP_MEMBER_METADATA_UPDATE`                   | `onGroupMemberAttributeChanged`                |

补充：

- allowlist 事件统一使用 `onAllowListAdded` / `onAllowListRemoved`，不再对外暴露 WhiteList 风格事件名
- `onGroupMemberAttributeChanged` 中若 attribute 包含 `groupNamecard/group_namecard/group_name_card/namecard`，SDK 会额外派生一次 `onUserGroupNamecardUpdated`
- 邀请、成员、管理员、allowlist、禁言等事件中的用户字段当前统一对象化为 `UserInfo`；若资料补齐失败，事件仍会派发，且至少保留 `userId`

---

## 7. 错误处理

> 完整的移动端错误码对照与判断逻辑见 [`docs/reference/group-manager-error-codes.md`](./group-manager-error-codes.md)。
> 每个 API 的具体错误码表格见 [`docs/reference/api-error-reference.md`](./api-error-reference.md)（由 `npm run docs:api:errors` 从 `api-errors.json` 自动生成）。

### 7.1 群组专属错误码

| 常量 | 数值 | 含义 |
|---|---|---|
| `GROUP_INVALID_ID` | 600 | 群组 ID 无效 |
| `GROUP_ALREADY_JOINED` | 601 | 已加入群组 |
| `GROUP_NOT_JOINED` | 602 | 未加入群组 |
| `GROUP_PERMISSION_DENIED` | 603 | 群组无权限 |
| `GROUP_MEMBERS_FULL` | 604 | 群组成员已满 |
| `GROUP_SHARED_FILE_INVALID_ID` | 605 | 共享文件 ID 无效 |
| `GROUP_NOT_EXIST` | 606 | 群组不存在 |
| `GROUP_DISABLED` | 607 | 群组已禁用 |
| `GROUP_NAME_VIOLATION` | 608 | 群名违规 |
| `GROUP_MEMBER_ATTRIBUTES_REACH_LIMIT` | 609 | 成员属性数量超限 |
| `GROUP_MEMBER_ATTRIBUTES_UPDATE_FAILED` | 610 | 成员属性更新失败 |
| `GROUP_MEMBER_ATTRIBUTES_KEY_REACH_LIMIT` | 611 | 成员属性 key 超限 |
| `GROUP_MEMBER_ATTRIBUTES_VALUE_REACH_LIMIT` | 612 | 成员属性 value 超限 |
| `GROUP_USER_IN_BLOCKLIST` | 613 | 用户在群黑名单中 |

这些常量通过 `ERROR_CODES.GROUP_*` 访问，定义在 `src/utils/error-codes.ts`，数值与移动端完全对齐。

### 7.2 参数校验

所有客户端参数校验（groupId 为空等）统一抛出 `ValidationError` + `ERROR_CODES.VALIDATION_REQUIRED`(110)。

### 7.3 REST 错误映射

REST 层通过 `api-errors.json` 中的定义自动映射服务端错误，支持三种匹配方式：

- **精确匹配**：`error` 字段与定义的 key 完全一致
- **字段值匹配**（`matchField` + `matchValue`）：如成员属性 API 的 `error_code` 字段（60001-60009）
- **子串匹配**（`matchField` + `matchPattern`）：如 `leaveGroup` 的 `error_description` 包含 `"owner can not quit group"`

#### leaveGroup 特有错误

| 服务端响应 | SDK 错误码 | 说明 |
|---|---|---|
| HTTP 403 + `error_description` ⊃ `"owner can not quit group"` | `GROUP_PERMISSION_DENIED`(603) | 群主不能直接退出，需先转让 |

#### joinGroup 特有错误

| 服务端响应 | SDK 错误码 | 说明 |
|---|---|---|
| HTTP 403 + `error_description` ⊃ `"member list is full"` | `GROUP_MEMBERS_FULL`(604) | 群成员已满 |
| HTTP 403 + `error_description` ⊃ `"is in the blacklist"` | `GROUP_USER_IN_BLOCKLIST`(613) | 用户在群黑名单中 |

#### setGroupMemberAttributes 特有错误（按 `error_code` 字段映射）

| `error_code` | SDK 错误码 | 含义 |
|---|---|---|
| 60005 | `GROUP_MEMBER_ATTRIBUTES_UPDATE_FAILED`(610) | 属性更新失败 |
| 60006 | `GROUP_MEMBER_ATTRIBUTES_REACH_LIMIT`(609) | 属性数量超限 |
| 60007 | `SERVICE_LIMIT_EXCEEDED`(4) | 超过服务限制 |
| 60009 | `GROUP_MEMBER_ATTRIBUTES_KEY_REACH_LIMIT`(611) | key 长度超限 |
| 600010 | `GROUP_MEMBER_ATTRIBUTES_VALUE_REACH_LIMIT`(612) | value 长度超限 |
| 60003 | `GROUP_NOT_JOINED`(602) | 用户未加入群组 |
| 60001 / 60002 | `AUTH_FORBIDDEN`(210) | 无权限 |
| 60004 | 305 | 服务已禁用 |

---

## 8. 当前已确认与待补样例

已确认真实样例的接口包括：

- `getJoinedGroupList`
- `getGroupInfo`
- `group.getAdmins`
- `group.getMembers`
- `group.getMuteList`
- `group.getBlocklist`
- `group.getAllowlist`
- `group.getAnnouncement`
- `group.getSharedFileList`
- `group.getMembersAttributes`

当前仍建议继续补 fixture 的接口：

- `getGroupInfoList`
- `getGroupMembersAttributes`

这些接口当前已按旧工程与现有样例推断接入，但后续拿到真实线上返回后，仍建议再补一轮 contract fixture 固化。公开群列表与单成员群成员属性读取不再作为公开 API 维护。
