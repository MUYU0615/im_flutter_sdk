# REST API HTTP Body Formats

> 本文档基于对 `src/` 目录下各 Manager `.cpp` 源码（emcontactmanager、emmucmanager、emchatmanager、emthreadmanager、empresencemanager、empushmanager、emuserinfomanager、emreactionmanager、emchatroommanager、emgroupmanager、emuploadinparts）的逐行分析推导，记录每个 REST 接口的**上行请求 Body** 和**下行响应 Body** JSON 格式。

---

## 通用约定

### 请求头
```
Authorization: <token>
Content-Type: application/json       ← 绝大多数接口
```

### 序列化机制
- `EMHttpParameters`（`map<string, EMAttributeValue>`）通过 RapidJSON `Writer` 序列化为顶层 JSON 对象，每个 `params.insert(make_pair("key", value))` 对应一个字段。
- `request.setBodyJsonStr(str)` 绕过上述机制，直接发送原始 JSON 字符串（用于手工构造复杂 body 的场景）。
- 特殊例外：`updateOwnInfo` / `updateOwnInfoByAttribute` 使用 `application/x-www-form-urlencoded`。

---

## 1. 联系人管理（emcontactmanager.cpp）

### 1.1 获取联系人列表（全量，带版本号）
```
GET /users/{username}/contacts/users?version={v}&needReturnRemark=true
```
**请求 Body：** 无

**响应 Body：**
```json
{
  "entities": [
    { "username": "user1", "remark": "备注昵称" }
  ],
  "data": { "version": "版本字符串" }
}
```

---

### 1.2 获取联系人列表（游标分页）
```
GET /users/{username}/contacts?limit={n}&cursor={c}&needReturnRemark=true
```
**请求 Body：** 无

**响应 Body：**
```json
{
  "data": {
    "cursor": "下一页游标",
    "contacts": [
      { "username": "user1", "remark": "备注昵称" }
    ]
  }
}
```

---

### 1.3 发送好友申请
```
POST /users/{username}/contacts/apply
```
**请求 Body：**
```json
{
  "usernames": ["targetUser"],
  "reason": "申请消息"
}
```

**响应 Body：**
```json
{
  "data": { "applyContacts": ["targetUser"] }
}
```

---

### 1.4 接受好友申请
```
POST /users/{username}/contacts/accept/users/{targetUser}
```
**请求 Body：** 无（空 params）

**响应 Body：**
```json
{ "data": { ... } }
```

---

### 1.5 拒绝好友申请
```
POST /users/{username}/contacts/decline/users/{targetUser}
```
**请求 Body：** 无

**响应 Body：**
```json
{ "data": { ... } }
```

---

### 1.6 删除联系人
```
DELETE /users/{username}/contacts/users/{targetUser}
```
**请求 Body：** 无

**响应 Body：**
```json
{ "entities": [ ... ] }
```

---

### 1.7 设置联系人备注
```
PUT /users/{username}/contacts/users/{targetUser}
```
**请求 Body：**
```json
{ "remark": "备注字符串" }
```

**响应 Body：**
```json
{ "status": { ... } }
```

---

### 1.8 获取黑名单
```
GET /users/{username}/blocks/users
```
**请求 Body：** 无

**响应 Body：**
```json
{ "data": ["user1", "user2"] }
```

---

### 1.9 加入黑名单
```
POST /sdk/user/{username}/blocks
```
**请求 Body：**
```json
{ "usernames": ["user1", "user2"] }
```

**响应 Body：**
```json
{ "data": { ... } }
```

---

### 1.10 从黑名单移除
```
DELETE /sdk/user/{username}/blocks/{targetUser}
```
**请求 Body：** 无

**响应 Body：**
```json
{ "entities": [ ... ] }
```

---

## 2. 用户资料（emuserinfomanager.cpp）

### 2.1 更新自己的用户资料
```
PUT /metadata/user/{username}
```
**⚠️ Content-Type: `application/x-www-form-urlencoded`（不是 JSON！）**

**请求 Body（表单编码）：**
```
nickname=HelloWorld&avatarurl=https%3A%2F%2F...&mail=user%40example.com&phone=13800000000&sign=签名&birth=1990-01-01&ext=扩展字段
```
（026 起字符串空值也会被编码，用于“清空字段”；`gender=false/0` 也会保留。字段名遵循服务端属性名，其中头像使用 `avatarurl`。）

**响应 Body：**
```json
{
  "timestamp": 1774496262484,
  "data": {
    "nickname": "HelloWorld",
    "avatarurl": "https://...",
    "mail": "user@example.com",
    "phone": "13800000000"
  },
  "lastModified": 1774496262500,
  "duration": 52
}
```

---

### 2.2 批量获取用户资料
```
POST /metadata/user/get
```
**请求 Body：**
```json
{
  "targets": ["user1", "user2"],
  "properties": ["nickname", "avatarUrl", "mail", "phone", "sign", "birth", "ext"]
}
```

**响应 Body：**
```json
{
  "timestamp": 1774495493846,
  "data": {
    "user1": { "nickname": "Alice", "avatarurl": "https://..." },
    "user2": { "nickname": "Bob" }
  },
  "lastModified": {
    "user1": 1774495459340,
    "user2": 1774495459341
  },
  "duration": 14
}
```

---

## 3. 群组 / 聊天室管理（emmucmanager.cpp）

> 群组 URL 路径为 `/chatgroups/...`，聊天室为 `/chatrooms/...`，以下以群组为例，聊天室同理（请求/响应格式相同，URL 不同）。

### 3.1 创建群组
```
POST /chatgroups?version=v3
```
**请求 Body：**
```json
{
  "name": "群组名称",
  "description": "描述",
  "maxusers": 200,
  "welcome": "欢迎语",
  "avatar": "https://avatar.jpg",
  "public": false,
  "allowinvites": false,
  "membersonly": true,
  "invite_need_confirm": true,
  "custom": "扩展字段字符串",
  "owner": "ownerUsername",
  "members": ["user1", "user2"]
}
```
（`avatar` 字段仅群组支持，聊天室无此字段。各 boolean 字段按实际群组类型按需传入。）

**响应 Body：**
```json
{ "data": { "id": "新群组ID" } }
```

---

### 3.2 删除群组
```
DELETE /chatgroups/{groupId}?version=v3
```
**请求 Body：** 无

**响应 Body：**
```json
{ "data": { "id": "groupId" } }
```

---

### 3.3 修改群组属性
```
PUT /chatgroups/{groupId}?version=v3
```
每次调用只修改一个字段：

**请求 Body（修改群名）：**
```json
{ "name": "新群名" }
```
**请求 Body（修改描述）：**
```json
{ "description": "新描述" }
```
**请求 Body（修改扩展字段）：**
```json
{ "custom": "新扩展" }
```
**请求 Body（修改头像）：**
```json
{ "avatar": "https://new-avatar.jpg" }
```
**请求 Body（转让群主）：**
```json
{ "newowner": "newOwnerUsername" }
```

**响应 Body：**
```json
{ "data": { "name": true } }       // 字段名 → true 表示成功
```

---

### 3.4 获取群成员（游标分页）
```
GET /chatgroups/{groupId}/users?version=v3&limit={n}&cursor={c}
```
**请求 Body：** 无

**响应 Body：**
```json
{
  "data": ["user1", "user2"],
  "cursor": "下一页游标"
}
```

---

### 3.5 获取群成员含加入时间（游标分页）
```
GET /chatgroups/{groupId}/users?joined_time=true&limit={n}&cursor={c}
```
**请求 Body：** 无

**响应 Body：**
```json
{
  "data": [
    { "member_name": "user1", "joined_time": 1700000000000 }
  ],
  "cursor": "下一页游标"
}
```

---

### 3.6 获取群角色
```
GET /chatgroups/{groupId}/roles?version=v3
```
**请求 Body：** 无

**响应 Body：**
```json
{
  "data": [
    {
      "id": "groupId",
      "owner": "ownerUsername",
      "roles": [
        { "admin": "adminUser" }
      ]
    }
  ]
}
```

---

### 3.7 邀请成员加入
```
POST /chatgroups/{groupId}/invite?version=v3
```
**请求 Body：**
```json
{
  "usernames": ["user1", "user2"],
  "welcome": "欢迎消息"
}
```

**响应 Body：**
```json
{
  "data": [
    { "result": true, "user": "user1" },
    { "result": false, "user": "user2" }
  ]
}
```

---

### 3.8 踢出成员
```
DELETE /chatgroups/{groupId}/users/{u1,u2}?version=v3
```
**请求 Body：** 无

**响应 Body：**
```json
{
  "data": [
    { "result": true, "user": "user1" }
  ]
}
```

---

### 3.9 添加/移除管理员
```
POST /chatgroups/{groupId}/admin?version=v3        ← 添加
DELETE /chatgroups/{groupId}/admin/{username}?version=v3   ← 移除
```

**添加管理员请求 Body：**
```json
{ "newadmin": "username" }
```
**添加管理员响应 Body：**
```json
{ "data": { "newadmin": "username" } }
```

**移除管理员请求 Body：** 无

**移除管理员响应 Body：**
```json
{ "data": { "result": "success", "oldadmin": "username" } }
```

---

### 3.10 禁言指定成员
```
POST /chatgroups/{groupId}/mute?version=v3
```
**请求 Body：**
```json
{
  "usernames": ["user1", "user2"],
  "mute_duration": 86400000
}
```
（`mute_duration` 单位：毫秒。-1 表示永久禁言。）

**响应 Body：**
```json
{
  "data": [
    { "result": true, "user": "user1", "expire": 1700000000000 }
  ]
}
```

---

### 3.11 解除指定成员禁言
```
DELETE /chatgroups/{groupId}/mute/{u1,u2}?version=v3
```
**请求 Body：** 无

**响应 Body：**
```json
{ "data": [{ "result": true, "user": "user1" }] }
```

---

### 3.12 获取禁言列表
```
GET /chatgroups/{groupId}/mute?version=v3
```
**请求 Body：** 无

**响应 Body：**
```json
{
  "data": [
    { "user": "user1", "expire": 1700000000000 }
  ]
}
```

---

### 3.13 查询成员是否在禁言列表
```
GET /sdk/chatgroups/{groupId}/mute/{username}?version=v3
```
**请求 Body：** 无

**响应 Body：**
```json
{ "data": true }
```
或 `{ "data": false }`

---

### 3.14 全员禁言 / 解禁
```
POST   /chatgroups/{groupId}/ban?version=v3    ← 全员禁言
DELETE /chatgroups/{groupId}/ban?version=v3    ← 解除全员禁言
```
**请求 Body：** 无（空 params）

**全员禁言响应 Body：**
```json
{ "data": { "mute": true } }
```

**解除全员禁言响应 Body：**
```json
{ "data": { "mute": false } }
```

---

### 3.15 加入/移除黑名单（踢出并禁止重新加入）
```
POST   /chatgroups/{groupId}/blocks/users?version=v3          ← 添加黑名单
DELETE /chatgroups/{groupId}/blocks/users/{u1,u2}?version=v3  ← 移除黑名单
GET    /chatgroups/{groupId}/blocks/users?version=v3          ← 获取黑名单
```

**添加黑名单请求 Body：**
```json
{ "usernames": ["user1", "user2"] }
```

**添加/移除黑名单响应 Body：**
```json
{ "data": [{ "result": true, "user": "user1" }] }
```

**获取黑名单请求 Body：** 无

**获取黑名单响应 Body：**
```json
{ "data": ["user1", "user2"] }
```

---

### 3.16 白名单操作
```
POST   /chatgroups/{groupId}/white/users?version=v3           ← 添加白名单
DELETE /chatgroups/{groupId}/white/users/{members}?version=v3 ← 移除白名单
GET    /chatgroups/{groupId}/white/users?version=v3           ← 获取白名单
GET    /chatgroups/{groupId}/white/users/{username}?version=v3 ← 查询成员是否在白名单
```

**添加白名单请求 Body：**
```json
{ "usernames": ["user1", "user2"] }
```

**添加/移除白名单响应 Body：**
```json
{ "data": [{ "result": true, "user": "user1" }] }
```

**获取白名单请求 Body：** 无

**获取白名单响应 Body：**
```json
{ "data": ["user1", "user2"] }
```

**查询白名单响应 Body：**
```json
{ "data": { "white": true } }
```

---

### 3.17 群公告
```
POST /chatgroups/{groupId}/announcement?version=v3   ← 设置公告
GET  /chatgroups/{groupId}/announcement?version=v3   ← 获取公告
```

**设置公告请求 Body：**
```json
{ "announcement": "公告内容" }
```

**获取公告请求 Body：** 无

**获取公告响应 Body：**
```json
{ "data": { "announcement": "公告内容" } }
```

---

### 3.18 消息屏蔽
```
POST   /chatgroups/{groupId}/shield?version=v3   ← 开启屏蔽
DELETE /chatgroups/{groupId}/shield?version=v3   ← 关闭屏蔽
```
**请求 Body：** 无

**响应 Body：** 通用 `{ "data": { ... } }`

---

### 3.19 处理入群邀请
```
POST /chatgroups/{groupId}/invite_verify?version=v3
```
**请求 Body：**
```json
{
  "invitee": "currentUsername",
  "verifyResult": true,
  "reason": "可选原因"
}
```

**响应 Body：** 通用

---

### 3.20 处理入群申请
```
POST /chatgroups/{groupId}/apply_verify?version=v3
```
**请求 Body：**
```json
{
  "applicant": "申请人Username",
  "verifyResult": true,
  "reason": "可选原因"
}
```

**响应 Body：** 通用

---

### 3.21 申请加入群组
```
POST /chatgroups/{groupId}/apply?version=v3
```
**请求 Body：**
```json
{
  "nickname": "显示昵称",
  "message": "申请消息"
}
```

**响应 Body：** 通用

---

### 3.22 主动退出群组
```
DELETE /chatgroups/{groupId}/quit?version=v3
```
**请求 Body：** 无

**响应 Body：** 通用

---

## 4. 群成员自定义属性（emgroupmanager.cpp）

### 4.1 设置群成员自定义属性
```
PUT /sdk/metadata/chatgroup/{groupId}/user/{username}
```
**请求 Body（使用 `setBodyJsonStr()` 手工构造）：**
```json
{
  "metaData": {
    "key1": "value1",
    "key2": "value2"
  }
}
```

**响应 Body：** 通用 `{ "data": { ... } }`

---

### 4.2 获取群成员自定义属性
```
POST /sdk/metadata/chatgroup/{groupId}/get
```
**请求 Body：**
```json
{
  "targets": ["user1", "user2"],
  "properties": ["key1", "key2"]
}
```

**响应 Body：**
```json
{
  "data": {
    "user1": { "key1": "val1", "key2": "val2" },
    "user2": { "key1": "val3" }
  }
}
```

---

## 5. 聊天室元数据（emchatroommanager.cpp）

### 5.1 获取聊天室元数据
```
POST /metadata/chatroom/{chatroomId}
```
**请求 Body（获取指定 key）：**
```json
{ "keys": ["key1", "key2"] }
```
**请求 Body（获取全部 key）：** 空 body 或不包含 `keys` 字段

**响应 Body：**
```json
{
  "data": {
    "key1": "value1",
    "key2": "value2"
  }
}
```

---

### 5.2 删除聊天室元数据
```
DELETE /metadata/chatroom/{chatroomId}/user/{username}
DELETE /metadata/chatroom/{chatroomId}/user/{username}/forced   ← 强制删除
```
**请求 Body（DELETE 方法携带 body）：**
```json
{ "keys": ["key1", "key2"] }
```

**响应 Body（失败 key 的映射）：**
```json
{
  "data": {
    "failedKeys": {
      "key1": "原因描述"
    }
  }
}
```

---

## 6. 漫游消息（emchatmanager.cpp）

### 6.1 拉取历史消息
```
POST /users/{username}/messageroaming
```
**请求 Body：**
```json
{
  "queue": "targetUser@easemob.com",
  "start": "游标字符串，首次传空字符串",
  "pull_number": 20,
  "is_positive": true,
  "startTime": 0,
  "endTime": 9999999999999,
  "userId": "按发送方过滤（单个）",
  "userIds": ["user1", "user2"],
  "msgType": "txt,img,file,voice,video,custom,cmd,loc"
}
```

字段说明：
- `queue`：单聊时格式 `{conversationId}@{domain}`，群组时格式 `{groupId}@conference.{domain}`
- `is_positive`：`true` = 向新消息方向拉取（DOWN），`false` = 向旧消息方向拉取（UP）
- `startTime`、`endTime`、`userId`、`userIds`、`msgType` 均为可选字段

**响应 Body：**
```json
{
  "data": {
    "msgs": [
      { "msg": "base64编码的protobuf字节" }
    ],
    "is_last": false,
    "next_key": "下一页游标"
  }
}
```

---

### 6.2 按消息 ID 删除漫游消息
```
DELETE /sdk/message/roaming/{type}/user/{username}?{param}&msgIdList={id1,id2,...}
```
URL 参数说明：
- `{type}`：`chat`（单聊）或 `group`（群聊）
- 单聊时：`&userId={conversationId}`
- 群聊时：`&groupId={conversationId}`
- `&msgIdList=`：逗号分隔的消息 ID 列表

**请求 Body：** 无（所有参数均在 URL query string 中）

**响应 Body：**
```json
{ "requestStatusCode": "ok" }
```

---

### 6.3 按时间戳删除漫游消息
```
DELETE /sdk/message/roaming/{type}/user/{username}/time?{param}&delTime={timestamp}
```
URL 参数说明：
- `{type}`：`chat` 或 `group`
- 单聊时：`&userId={conversationId}`
- 群聊时：`&groupId={conversationId}`
- `&delTime=`：毫秒时间戳，删除此时间戳之前的所有消息

**请求 Body：** 无

**响应 Body：**
```json
{ "requestStatusCode": "ok" }
```

---

### 6.4 一键删除所有漫游消息及会话
```
POST /sdk/message/roaming/user/{username}/delete/all
```
**请求 Body：** 无（空 params）

**响应 Body：**
```json
{
  "requestStatusCode": "ok",
  "timestamp": 1705041791814
}
```

---

## 7. 消息翻译（emchatmanager.cpp）

### 7.1 翻译文本
```
POST /users/{username}/translate
```
**请求 Body：**
```json
{
  "to": ["en", "zh"],
  "text": "要翻译的文本内容"
}
```

**响应 Body（顶层为数组）：**
```json
[
  {
    "translations": [
      { "text": "Hello world", "to": "en" },
      { "text": "你好世界", "to": "zh" }
    ]
  }
]
```

---

## 8. 消息举报（emchatmanager.cpp）

### 8.1 举报消息
```
POST /user/{username}/moderation/report/message
```
**请求 Body（手工 RapidJSON 构造，根据消息类型不同字段有差异）：**

所有消息类型通用字段：
```json
{
  "msgId": "消息ID",
  "type": "txt"
}
```

文本消息（`type: "txt"`）：
```json
{
  "msgId": "消息ID",
  "type": "txt",
  "msg": "消息文本内容"
}
```

图片消息（`type: "img"`）：
```json
{
  "msgId": "消息ID",
  "type": "img",
  "filename": "image.jpg",
  "secret": "shareSecret",
  "url": "https://download-url",
  "fileLength": 1024
}
```

视频消息（`type: "video"`）：
```json
{
  "msgId": "消息ID",
  "type": "video",
  "filename": "video.mp4",
  "secret": "shareSecret",
  "url": "https://download-url",
  "fileLength": 204800,
  "thumbnailUrl": "https://thumb-url",
  "length": 30
}
```

语音消息（`type: "audio"`）：
```json
{
  "msgId": "消息ID",
  "type": "audio",
  "filename": "audio.amr",
  "secret": "shareSecret",
  "url": "https://download-url",
  "fileLength": 5120,
  "length": 5
}
```

文件消息（`type: "file"`）：
```json
{
  "msgId": "消息ID",
  "type": "file",
  "filename": "file.pdf",
  "secret": "shareSecret",
  "url": "https://download-url",
  "fileLength": 102400
}
```

位置消息（`type: "loc"`）：
```json
{
  "msgId": "消息ID",
  "type": "loc",
  "addr": "地址字符串",
  "lat": 39.90,
  "lng": 116.40
}
```

自定义消息（`type: "custom"`）：
```json
{
  "msgId": "消息ID",
  "type": "custom",
  "customEvent": "自定义事件名",
  "customExts": { "key1": "value1" }
}
```

**响应 Body：** 通用 `{ "data": { ... } }`

---

## 9. 会话管理（emchatmanager.cpp）

### 9.1 获取所有会话（无分页，旧接口）
```
GET /users/{username}/user_channels
```
**请求 Body：** 无

**响应 Body：**
```json
{
  "data": {
    "channel_infos": [
      {
        "channel_id": "user1@easemob.com",
        "is_top": false,
        "update_top_status_time": 0,
        "marks": ["mark_0"],
        "unread_num": 0,
        "meta": {
          "id": "msgId",
          "payload": "base64编码的最新消息",
          "timestamp": 1700000000000
        }
      }
    ]
  }
}
```

---

### 9.2 获取会话列表（页码分页）
```
GET /users/{username}/user_channels/page?pageNum={n}&pageSize={n}
```
**请求 Body：** 无

**响应 Body：**
```json
{
  "data": {
    "channel_infos": [ /* 同上，channel_info 数组 */ ]
  }
}
```

---

### 9.3 获取会话列表（游标分页）
```
GET /sdk/user/{username}/user_channels/list?cursor={c}&sort=desc&limit={n}&need_mark=true[&is_top=true][&needEmptySession=true]
```
**请求 Body：** 无

**响应 Body：**
```json
{
  "data": {
    "channel_infos": [ /* channel_info 数组 */ ],
    "cursor": "下一页游标"
  }
}
```

---

### 9.4 按标记筛选会话
```
GET /sdk/user/{username}/user_channels/mark/search?mark=mark_{n}&cursor={c}&limit={n}[&need_mark=true][&needEmptySession=true]
```
**请求 Body：** 无

**响应 Body：**
```json
{
  "data": {
    "channel_infos": [ /* channel_info 数组 */ ],
    "cursor": "下一页游标"
  }
}
```

---

### 9.5 删除服务端会话
```
DELETE /user/{username}/user_channel?resource={res}
```
**请求 Body（DELETE 方法携带 JSON body）：**
```json
{
  "channel": "conversationId",
  "type": "chat",
  "delete_roam": true
}
```
（`type` 可取 `"chat"`、`"groupchat"`、`"chatroom"`）

**响应 Body：** 通用

---

### 9.6 置顶/取消置顶会话
```
POST   /sdk/user/{username}/user_channel/top?resource={res}    ← 置顶
DELETE /sdk/user/{username}/user_channel/top?resource={res}&type={t}&to={id}  ← 取消置顶
```

**置顶请求 Body：**
```json
{
  "type": "chat",
  "to": "conversationId"
}
```

**置顶响应 Body：**
```json
{
  "data": { "update_top_status_time": 1700000000000 }
}
```

**取消置顶请求 Body：** 无（参数在 URL 中）

---

### 9.7 标记/取消标记会话
```
POST   /sdk/user/{username}/user_channels/mark?resource={res}   ← 添加标记
DELETE /sdk/user/{username}/user_channels/mark?resource={res}   ← 移除标记
```
**请求 Body（使用 `setBodyJsonStr()` 手工构造）：**
```json
{
  "mark": "mark_0",
  "targets": [
    { "type": "chat", "to": "conversationId1" },
    { "type": "groupchat", "to": "groupId1" }
  ]
}
```
（`mark` 格式：`mark_0` 至 `mark_19`；`type` 可取 `"chat"` 或 `"groupchat"`）

**响应 Body：** 通用

---

### 9.8 置顶/取消置顶消息
```
POST   /sdk/user/{username}/user_channel/pin?resource={res}    ← 置顶
DELETE /sdk/user/{username}/user_channel/pin?resource={res}    ← 取消置顶
```
**请求 Body：**
```json
{
  "pin_msg_id": ["messageId"],
  "to": "conversationId",
  "type": "chat"
}
```
（`type` 可取 `"chat"`、`"groupchat"`、`"chatroom"`）

**响应 Body：** 通用

---

## 10. 群已读回执（emchatmanager.cpp）

### 10.1 获取群消息已读详情
```
GET /chatgroups/{groupId}/acks/{msgId}?limit={n}&key={startAckId}
```
**请求 Body：** 无

**响应 Body：**
```json
{
  "data": {
    "group_ack": {
      "userlist": [
        {
          "username": "user1",
          "meta_id": "ackId",
          "timestamp": 1700000000000,
          "ack_content": "自定义已读内容"
        }
      ],
      "next_key": "下一页游标",
      "is_last": true,
      "total": 100,
      "ack_id_count": 5
    }
  }
}
```

**群消息已读成员归属补充：**

- 群消息已读成员查询不属于 GroupManager / Group 公开面。
- SDK 侧应通过 ChatManager 的 `getGroupMessageReadUsers` 查询群消息已读成员。

---

## 11. Presence 在线状态（empresencemanager.cpp）

### 11.1 发布在线状态
```
POST /users/{username}/presence/{resource}/{status}
```
（`resource` 为设备资源标识，`status` 为数字字符串如 `"0"`、`"1"`）

**请求 Body：**
```json
{ "ext": "自定义扩展字符串" }
```

**响应 Body：**
```json
{ "result": "ok" }
```

---

### 11.2 订阅用户在线状态
```
POST /users/{username}/presence/{expiry}
```
（`expiry` 为订阅有效期秒数）

**请求 Body：**
```json
{ "usernames": ["user1", "user2"] }
```

**响应 Body：**
```json
{
  "result": [
    {
      "uid": "user1",
      "last_time": 1700000000000,
      "status": {
        "设备resource1": "0",
        "ios设备": "1"
      },
      "expiry": 1700086400000,
      "ext": "扩展字符串"
    }
  ]
}
```

---

### 11.3 取消订阅在线状态
```
DELETE /users/{username}/presence
```
**⚠️ 请求 Body 为原始 JSON 数组（不是对象），通过 `setBodyJsonStr()` 发送：**
```json
["user1", "user2"]
```

**响应 Body：**
```json
{ "result": "ok" }
```

---

### 11.4 查询订阅列表
```
GET /users/{username}/presence/sublist?pageNum={n}&pageSize={n}
```
**请求 Body：** 无

**响应 Body：**
```json
{
  "result": {
    "sublist": [
      { "uid": "user1" },
      { "uid": "user2" }
    ]
  }
}
```

---

### 11.5 获取用户在线状态
```
POST /users/{username}/presence
```
**请求 Body：**
```json
{ "usernames": ["user1", "user2"] }
```

**响应 Body：** 同订阅响应格式

---

## 12. 推送通知设置（empushmanager.cpp）

### 12.1 设置会话免打扰
```
PUT /users/{username}/notification/user/{target}        ← 单聊会话
PUT /users/{username}/notification/chatgroup/{groupId}  ← 群组会话
```
三种互斥的请求 Body 形式之一：

**按提醒类型设置：**
```json
{ "type": "ALL" }
```
（`type` 可取 `"ALL"`、`"AT"`、`"NONE"`、`"DEFAULT"`）

**按时长设置（毫秒）：**
```json
{ "ignoreDuration": 604800000 }
```
（最大值 `7 * 24 * 60 * 60 * 1000` 毫秒，即 7 天）

**按时间段设置：**
```json
{ "ignoreInterval": "09:00-21:00" }
```
（格式 `HH:MM-HH:MM`；传空字符串 `""` 表示清除）

**响应 Body：** 通用

---

### 12.2 获取会话免打扰设置
```
GET /users/{username}/notification/user/{target}
GET /users/{username}/notification/chatgroup/{groupId}
```
**请求 Body：** 无

**响应 Body：**
```json
{
  "data": {
    "type": "NONE",
    "ignoreDuration": 0,
    "ignoreInterval": "09:00-21:00"
  }
}
```

---

### 12.3 批量获取会话免打扰设置
```
POST /users/{username}/notification/conversations/paginated
```
**请求 Body：** 包含会话 ID 列表（具体字段参见 empushmanager.cpp 实现）

**响应 Body：**
```json
{
  "data": {
    "user": {
      "conversationId1": { "type": "NONE", ... }
    },
    "chatgroup": {
      "groupId1": { "type": "ALL", ... }
    }
  }
}
```

---

### 12.4 设置推送通知语言
```
PUT /users/{username}/notification/language
```
**请求 Body：**
```json
{ "translationLanguage": "en" }
```

**响应 Body：**
```json
{
  "data": { "translationLanguage": "en" }
}
```

---

### 12.5 设置推送模板
```
PUT /users/{username}/notification/template
```
**请求 Body：**
```json
{ "templateName": "模板名称" }
```

**响应 Body：**
```json
{
  "data": { "templateName": "模板名称" }
}
```

---

## 13. 消息 Reaction（emreactionmanager.cpp）

### 13.1 添加 Reaction
```
POST /reaction/user/{username}
```
**请求 Body：**
```json
{
  "msgId": "消息ID",
  "message": "😀"
}
```

**响应 Body：**
```json
{ "requestStatusCode": "ok" }
```

---

### 13.2 删除 Reaction
```
DELETE /reaction/user/{username}?msgId={id}&message={emoji}
```
**请求 Body：** 无（参数在 URL 中）

**响应 Body：**
```json
{ "requestStatusCode": "ok" }
```

---

### 13.3 获取消息的 Reaction 列表
```
GET /reaction/user/{username}?msgIdList={id1,id2}&msgType={chat|group}&groupId={id}
```
**请求 Body：** 无

**响应 Body：**
```json
{
  "requestStatusCode": "ok",
  "data": [
    {
      "msgId": "消息ID",
      "reactionList": [
        {
          "reaction": "😀",
          "count": 3,
          "userList": ["user1", "user2", "user3"],
          "state": true
        }
      ]
    }
  ]
}
```
（`state: true` 表示当前用户已添加该 Reaction）

---

### 13.4 获取 Reaction 详情（含用户列表，支持分页）
```
GET /reaction/user/{username}/detail?msgId={id}&message={emoji}&cursor={c}&limit={n}
```
**请求 Body：** 无

**响应 Body：**
```json
{
  "requestStatusCode": "ok",
  "data": {
    "reaction": "😀",
    "count": 5,
    "userList": ["user1", "user2", "user3"],
    "state": true,
    "cursor": "下一页游标"
  }
}
```

---

## 14. 消息 Thread（emthreadmanager.cpp）

### 14.1 创建 Thread
```
POST /thread
```
**请求 Body：**
```json
{
  "name": "Thread 标题",
  "group_id": "所属群组ID",
  "msgId": "父消息ID",
  "owner": "创建者Username"
}
```

**响应 Body：**
```json
{
  "data": { "threadId": "新ThreadID" }
}
```

---

### 14.2 加入 Thread
```
POST /thread/{threadId}/user/{username}/join
```
**请求 Body：** 无

**响应 Body：**
```json
{
  "data": {
    "status": "ok",
    "detail": {
      /* Thread 详情对象，字段见 threadFromJsonObject */
    }
  }
}
```

---

### 14.3 退出 Thread
```
DELETE /thread/{threadId}/user/{username}/quit
```
**请求 Body：** 无

**响应 Body：**
```json
{
  "data": { "status": "ok" }
}
```

---

### 14.4 销毁 Thread
```
DELETE /thread/{threadId}
```
**请求 Body：** 无

**响应 Body：**
```json
{
  "data": { "status": "ok" }
}
```

---

### 14.5 修改 Thread 名称
```
PUT /thread/{threadId}
```
**请求 Body：**
```json
{ "name": "新Thread名称" }
```

**响应 Body：**
```json
{
  "data": { "name": "新Thread名称" }
}
```

---

### 14.6 移除 Thread 成员
```
DELETE /thread/{threadId}/users/{username}
```
**请求 Body：** 无

**响应 Body：**
```json
{
  "data": { "result": true }
}
```

---

### 14.7 获取 Thread 成员列表
```
GET /thread/{threadId}/users?limit={n}&cursor={c}
```
**请求 Body：** 无

**响应 Body：**
```json
{
  "data": {
    "affiliations": ["user1", "user2"]
  },
  "properties": {
    "cursor": "下一页游标"
  }
}
```

---

### 14.8 批量获取 Thread 最新消息
```
POST /thread/message
```
**请求 Body：**
```json
{
  "threadIds": ["threadId1", "threadId2"]
}
```

**响应 Body：**
```json
{
  "entities": [
    {
      "threadId": "threadId1",
      "lastMessage": { /* 消息 JSON 对象 */ }
    }
  ]
}
```

---

### 14.9 获取群内所有 Thread 列表
```
GET /thread/chatgroups/{groupId}/user/{username}/joined?limit={n}&cursor={c}
GET /thread/chatgroups/{groupId}/threads?limit={n}&cursor={c}        ← 全量
```
**请求 Body：** 无

**响应 Body：**
```json
{
  "entities": [
    { /* Thread 对象 */ }
  ],
  "properties": {
    "cursor": "下一页游标"
  }
}
```

---

## 15. 附件分片上传（emuploadinparts.cpp）

> 所有上传接口的 Base URL：`{restBaseUrl}/sdk/chatfiles/part-upload`

### 15.1 初始化分片上传任务
```
POST /sdk/chatfiles/part-upload
```
**请求 Body：** 无（空 params）

**响应 Body：**
```json
{
  "entities": [
    {
      "uuid": "上传任务UUID",
      "part_lower_limit": 5242880,
      "file_upper_limit": 10737418240
    }
  ]
}
```
（`part_lower_limit`：每片最小字节数；`file_upper_limit`：文件最大字节数）

---

### 15.2 上传单个分片
```
PUT /sdk/chatfiles/part-upload/{uuid}
```
**请求 Body：** 二进制分片数据（`Content-Type: application/octet-stream`，非 JSON）

**自定义请求头：**
```
restrict-access: true
```

**响应 Body：**
```json
{
  "entities": [
    {
      "part_number": 1,
      "part_size": 5242880
    }
  ]
}
```

---

### 15.3 完成分片上传
```
POST /sdk/chatfiles/part-upload/{uuid}?chat-type={CHAT|GROUP|ROOM}&chat-target={conversationId}
```
**请求 Body：** 无（空 params）

**自定义请求头（图片时附加）：**
```
restrict-access: true
thumbnail-width: 120
thumbnail-height: 120
```

**响应 Body：**
```json
{
  "uri": "https://cdn-base-url/",
  "entities": [
    {
      "uuid": "文件UUID",
      "share-secret": "shareSecretKey"
    }
  ]
}
```

---

### 15.4 查询已上传分片列表
```
GET /sdk/chatfiles/part-upload/{uuid}/parts
```
**请求 Body：** 无

**响应 Body：**
```json
{
  "entities": [
    [
      { "part_number": 1, "part_size": 5242880 },
      { "part_number": 2, "part_size": 5242880 }
    ]
  ]
}
```
（`entities` 是一个二维数组，外层数组包含一个数组元素，内层数组为各分片信息）

---

### 15.5 中止分片上传
```
DELETE /sdk/chatfiles/part-upload/{uuid}
```
**请求 Body：** 无

**响应 Body：**  
成功时返回 2xx；HTTP 400 表示服务端已主动清理（视为成功）。

---

## 16. SDK 日志上传（emchatmanager.cpp）

### 16.1 上传日志 UUID
```
POST /easemob/logger/devicelogs
```
**请求 Body：**
```json
{
  "model": 0,
  "logfile_uuid": "日志文件UUID",
  "sdk_version": "4.x.x",
  "os_version": "iOS 16.0",
  "login_username": "当前登录用户名",
  "appkey": "org#appname",
  "uploadDate": "2024-01-01 12:00:00"
}
```
（`model` 为操作系统类型的枚举整数值）

**响应 Body：** 通用 `{ "data": { ... } }`

---

## 附录：常用 JSON 字段名常量对照表

| 常量名（C++） | JSON 字段名 | 说明 |
|---|---|---|
| `ATTR_DATA` | `"data"` | 通用数据载体 |
| `ATTR_ENTITIES` | `"entities"` | 实体数组 |
| `ATTR_CURSOR` | `"cursor"` | 分页游标 |
| `ATTR_NAME` | `"name"` | 名称 |
| `ATTR_DESCRIPTION` | `"description"` | 描述 |
| `ATTR_CUSTOM` | `"custom"` | 扩展字段 |
| `ATTR_AVATAR` | `"avatar"` | 头像 URL |
| `ATTR_MAXUSERS` | `"maxusers"` | 最大成员数 |
| `ATTR_WELCOME` | `"welcome"` | 欢迎语 |
| `ATTR_PUBLIC` | `"public"` | 是否公开 |
| `ATTR_ALLOWINVITES` | `"allowinvites"` | 是否允许成员邀请 |
| `ATTR_MEMBERONLY` | `"membersonly"` | 是否需要审批 |
| `ATTR_INVITENEEDCONFIRM` | `"invite_need_confirm"` | 邀请是否需要确认 |
| `ATTR_OWNER` | `"owner"` | 群主 |
| `ATTR_MEMBERS` | `"members"` | 成员列表 |
| `ATTR_USERNAMES` | `"usernames"` | 用户名列表 |
| `ATTR_USERNAME` | `"username"` | 单个用户名 |
| `ATTR_REASON` | `"reason"` | 原因 |
| `ATTR_ANNOUNCEMENT` | `"announcement"` | 公告 |
| `ATTR_MUTE` | `"mute"` | 禁言状态 |
| `ATTR_WHITE` | `"white"` | 白名单状态 |
| `ATTR_NEWOWNER` | `"newowner"` | 新群主 |
| `ATTR_NEWADMIN` | `"newadmin"` | 新管理员 |
| `ATTR_OLDADMIN` | `"oldadmin"` | 被移除的管理员 |
| `ATTR_RESULT` | `"result"` | 操作结果 |
| `ATTR_EXPIRE` | `"expire"` | 过期时间戳（ms） |
| `ATTR_MSGID` | `"msg_id"` | 消息 ID（部分接口） |
| `ATTRMSGID` | `"msgId"` | 消息 ID（Reaction 等接口） |
| `ATTR_THREADIDS` | `"threadIds"` | Thread ID 列表 |
| `ATTR_REMARK` | `"remark"` | 联系人备注 |
| `ATTR_STATUS` | `"status"` | 状态 |
| `ATTR_CONTACTS` | `"contacts"` | 联系人列表 |
| `ATTR_GROUPID` | `"groupId"` | 群组 ID |
| `ATTR_PROPERTIES` | `"properties"` | 属性对象 |
| `ATTR_UUID` | `"uuid"` | 文件 UUID |
| `ATTR_SHARESECRET` | `"share-secret"` | 文件访问密钥 |
| `ATTR_URI` | `"uri"` | 文件基础 URL |
| `ATTR_UPLOADINPARTS_PARTLOWERLIMIT` | `"part_lower_limit"` | 分片最小字节数 |
| `ATTR_UPLOADINPARTS_FILEUPPERLIMIT` | `"file_upper_limit"` | 文件最大字节数 |
| `ATTR_UPLOADINPARTS_PARTNUM` | `"part_number"` | 分片编号 |
| `ATTR_UPLOADINPARTS_PARTSIZE` | `"part_size"` | 分片大小 |
| `ATTR_REQUEST_STATUS_CODE` | `"requestStatusCode"` | Reaction/删除操作状态码 |
| `ATTR_ERROR_DESC` | `"error_description"` | 错误描述 |
