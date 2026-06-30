1. getChatRoomList

```json
{
  "action": "get",
  "application": "e0a3d0f7-b6d9-4b6a-af22-e8b9aaee776f",
  "applicationName": "chatdemoui",
  "count": 20,
  "data": [
    {
      "affiliations_count": 1,
      "disabled": false,
      "id": "308726760275970",
      "name": "欢迎来到我的频道!",
      "owner": "46d2d9d2d1"
    },
    {
      "affiliations_count": 5,
      "disabled": false,
      "id": "304746265116673",
      "name": "room2",
      "owner": "chat2"
    },
    {
      "affiliations_count": 3,
      "disabled": false,
      "id": "304730762969091",
      "name": "room1",
      "owner": "chat1"
    },
    {
      "affiliations_count": 3,
      "disabled": false,
      "id": "301206510567427",
      "name": "Bearer YWMth20UsuFrEfCFkYvU67KTG1AmqMQumDz9mDjGCPWHRDkDokY0sbVBnLBi8agYU_GSAgMAAAGbVJ6dljeeSADBKG2SmwYrQft9CZFUGrIOtstwRVIvk2bpsovG5kmi1A",
      "owner": "1wayang1"
    }
  ],
  "duration": 0,
  "entities": [],
  "organization": "easemob-demo",
  "params": {
    "_v": ["1775788184318"],
    "pagesize": ["20"],
    "pagenum": ["1"]
  },
  "properties": {},
  "timestamp": 1775788185528,
  "uri": "https://a1.easemob.com/easemob-demo/chatdemoui/chatrooms"
}
```

2.getJoinedChatRoomList

```json
{
  "action": "get",
  "application": "e0a3d0f7-b6d9-4b6a-af22-e8b9aaee776f",
  "applicationName": "chatdemoui",
  "count": 3,
  "data": [
    {
      "owner": "easemob-demo#chatdemoui_1wayang1",
      "curr_page": "1",
      "identify": "",
      "mute_duration": "-1",
      "pg_size": "3000",
      "created": "1766651313597",
      "custom": "",
      "description": "",
      "scale": "large",
      "mute": "false",
      "members_only": "false",
      "type": "chatroom",
      "title": "Bearer YWMth20UsuFrEfCFkYvU67KTG1AmqMQumDz9mDjGCPWHRDkDokY0sbVBnLBi8agYU_GSAgMAAAGbVJ6dljeeSADBKG2SmwYrQft9CZFUGrIOtstwRVIvk2bpsovG5kmi1A",
      "max_users": "100",
      "invite_need_confirm": "false",
      "slice_num": "1",
      "public": "true",
      "allow_user_invites": "false",
      "owner_can_leave": "true",
      "debut_msg_num": "10",
      "appkey": "easemob-demo#chatdemoui",
      "disabled": "false",
      "id": "301206510567427",
      "last_modified": "1766651313597"
    },
    {
      "owner": "easemob-demo#chatdemoui_initvaliduser-_1218489059",
      "curr_page": "1",
      "identify": "",
      "mute_duration": "-1",
      "pg_size": "3000",
      "created": "1744704978108",
      "custom": "",
      "description": "initvaliduser-_1218489059",
      "scale": "large",
      "mute": "false",
      "members_only": "false",
      "title": "initvaliduser-_1218489059",
      "type": "chatroom",
      "max_users": "200",
      "invite_need_confirm": "true",
      "slice_num": "1",
      "allow_user_invites": "false",
      "public": "true",
      "owner_can_leave": "true",
      "debut_msg_num": "10",
      "appkey": "easemob-demo#chatdemoui",
      "disabled": "false",
      "id": "278194110398465",
      "last_modified": "1744704978108"
    }
  ],
  "duration": 0,
  "entities": [],
  "organization": "easemob-demo",
  "params": {
    "_v": ["1775788481643"],
    "pagesize": ["20"],
    "detail": ["true"],
    "pagenum": ["1"]
  },
  "properties": {},
  "timestamp": 1775788483641,
  "uri": "https://a1.easemob.com/easemob-demo/chatdemoui/users/zd1/joined_chatrooms"
}
```

3.  createChatRoom

```json
{
  "data": {
    "id": "66XXXX33"
  }
}
```

可能的错误：
HTTP 状态码 错误类型 错误提示 可能原因 处理建议
400 invalid_parameter XX must be provided XX 字段没有设置。 请传入必传字段。
400 illegal_argument group ID XX already exists! groupId 重复。 使用新的聊天室 ID。
401 unauthorized Unable to authenticate (OAuth) token 不合法，可能过期或 token 错误。 使用新的 token 访问， 或者没有权限。
403 exceed_limit appKey:XX#XX has create too many chatrooms! appKey 创建聊天室达到上限。 删除不用的聊天室或联系商务调整上限。
403 exceed_limit user XX has joined too many chatrooms! 用户加入的聊天室达到上限。 退出不用的聊天室组或联系商务调整上限。
403 exceed_limit members size is greater than max user size ! 创建聊天室加入的人超过最大限制（取值范围为 [1,10,000]）。 可联系商务提升该限制。
404 resource_not_found username XXXX doesn't exist! 创建聊天室时添加的用户不存在。

4. updateChatRoomInfo

```json
{
  "data": {
    "description": true,
    "maxusers": true,
    "groupname": true
  }
}
```

可能的错误
| - 错误码 - | - | - 原因 - |
| 401 | {
"error": "group_authorization",
"timestamp": 1775788832237,
"duration": 0,
"properties": {},
"exception": "com.easemob.group.exception.GroupAuthorizationException",
"error_description": "you have no permission to do this,group fields require group admin privileges to be modified"
} | 没有权限操作 |
| 404 | grpID XX does not exist! | 聊天室 ID 不存在 |
| 403| title cannot exceed to XXXX | 聊天室名称超限。 |
| 403 | desc cannot exceed to XXXX | 聊天室描述超限 |
| 403 | maxUsers cannot exceed XXXX | 聊天室最大成员数超限 |
| 400 | some of [chatroom_id] are not valid fields | 修改的群组信息时，传入的参数不支持，例如修改 chatroom_id。仅支持修改聊天室名称、聊天室描述和聊天室最大成员数。 |

5. addMembers/removeMembers

```json
//批量拉人
{
  "action": "delete",
  "application": "8beXXXX02",
  "uri": "https://XXXX/XXXX/XXXX/chatrooms/66XXXX33/users/user1",
  "entities": [],
  "data": {
    "result": true,
    "action": "remove_member",
    "user": "user1",
    "id": "66XXXX33"
  },
  "timestamp": 1542555744726,
  "duration": 1,
  "organization": "XXXX",
  "applicationName": "testapp"
}
//加单人
{
  "action": "post",
  "application": "8beXXXX02",
  "uri": "https://XXXX/XXXX/XXXX/chatrooms/66XXXX33/users/user1",
  "entities": [],
  "data": {
    "result": true,
    "action": "add_member",
    "id": "66XXXX33",
    "user": "user1"
  },
  "timestamp": 1542554038353,
  "duration": 0,
  "organization": "XXXX",
  "applicationName": "testapp"
}
//移除多人
{
  "action": "delete",
  "application": "8beXXXX02",
  "uri": "https://XXXX/XXXX/XXXX/chatrooms/66XXXX33/users/user1%2Cuser2",
  "entities": [],
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
  ],
  "timestamp": 1542556177147,
  "duration": 0,
  "organization": "XXXX",
  "applicationName": "testapp"
}
//移除单人
{
  "action": "delete",
  "application": "8beXXXX02",
  "uri": "https://XXXX/XXXX/XXXX/chatrooms/66XXXX33/users/user1",
  "entities": [],
  "data": {
    "result": true,
    "action": "remove_member",
    "user": "user1",
    "id": "66XXXX33"
  },
  "timestamp": 1542555744726,
  "duration": 1,
  "organization": "XXXX",
  "applicationName": "testapp"
}
```

6. blockMembers / unblockMembers

```json
// 多人
{
  "action": "post",
  "application": "8be024f0-XXXX-XXXX-b697-5d598d5f8402",
  "uri": "http://XXXX/XXXX/XXXX/chatrooms/XXXX/blocks/users",
  "entities": [],
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
  ],
  "timestamp": 1542540095540,
  "duration": 16,
  "organization": "XXXX",
  "applicationName": "XXXX"
}
//单人
{
  "action": "post",
  "application": "8be024f0-XXXX-XXXX-b697-5d598d5f8402",
  "uri": "http://XXXX/XXXX/XXXX/chatrooms/XXXX/blocks/users/user1",
  "entities": [],
  "data": {
    "result": true,
    "action": "add_blocks",
    "user": "user1",
    "chatroomid": "XXXX"
  },
  "timestamp": 1542539577124,
  "duration": 27,
  "organization": "XXXX",
  "applicationName": "XXXX"
}
//批量移除
{
  "action": "delete",
  "application": "8be024f0-XXXX-XXXX-b697-5d598d5f8402",
  "uri": "http://XXXX/XXXX/XXXX/chatrooms/XXXX/blocks/users/user1%2Cuser2",
  "entities": [],
  "data": [
    {
      "result": true,
      "action": "remove_blocks",
      "user": "user1",
      "chatroomid": "XXXX"
    },
    {
      "result": true,
      "action": "remove_blocks",
      "user": "user2",
      "chatroomid": "XXXX"
    }
  ],
  "timestamp": 1542541014655,
  "duration": 29,
  "organization": "XXXX",
  "applicationName": "XXXX"
}
```

7. addUsersToAllowlist / removeUsersFromAllowlist

```json
{
  "action": "post",
  "application": "5cXXXX75d",
  "uri": "https://XXXX/XXXX/XXXX/chatrooms/66XXXX33/white/users",
  "entities": [],
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
  ],
  "timestamp": 1594724634191,
  "duration": 2,
  "organization": "XXXX",
  "applicationName": "testapp"
}

{
  "action": "delete",
  "application": "5cXXXX75d",
  "uri": "https://XXXX/XXXX/XXXX/chatrooms/66XXXX33/white/users/wzy_huawei,wzy_meizu",
  "entities": [],
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
  ],
  "timestamp": 1594725137704,
  "duration": 1,
  "organization": "XXXX",
  "applicationName": "XXXX"
}
```

8. updateAnnouncement

```json
{
  "action": "post",
  "application": "52XXXXf0",
  "uri": "https://XXXX/XXXX/XXXX/chatrooms/12XXXX11/announcement",
  "entities": [],
  "data": {
    "id": "12XXXX11",
    "result": true
  },
  "timestamp": 1594808604236,
  "duration": 0,
  "organization": "XXXX",
  "applicationName": "testapp"
}
```

可能的错误
401 unauthorized Unable to authenticate (OAuth) token 不合法，可能过期或 token 错误。 使用新的 token 访问。或者没权限：{
"error": "group_authorization",
"timestamp": 1775789866432,
"duration": 0,
"properties": {},
"exception": "com.easemob.group.exception.GroupAuthorizationException",
"error_description": "you have no permission to do this, group admin permission is required"
}
403 forbidden_op announce info length exceeds limit! 聊天室公告长度超过上限（不能超过 512 字符）。 修改公告长度在限制（ 最大 512 字符）以下。
404 resource_not_found grpID XX does not exist! 聊天室 ID 不存在。 传入存在的合法的聊天室 ID。

9. uploadSharedFile
   移除这个 api

10. getAttributes / setAttributes / setAttribute / removeAttributes / removeAttribute
    //设置属性

```json
{
  "uri": "https://XXXX/XXXX/XXXX/metadata/chatroom",
  "timestamp": 1716887320215,
  "action": "put",
  "data": {
    "successKeys": ["key1"],
    "errorKeys": { "key2": "errorDesc" }
  }
}
```

可能的错误
HTTP 状态码 错误类型 错误提示 可能原因 处理建议
400 exceed allowed batch size 10 要设置的 key 属性数量超过了 10 个。 要设置的 key 的数量不要超过 10 个。
401 unauthorized Unable to authenticate (OAuth) token 不合法，可能过期或 token 错误。 使用新的 token 访问。
401 MetadataException user is not in chatroom 用户不在聊天室内。 使用正确的聊天室成员的用户 ID。
400 others are not allowed to be set 不允许更新他人的聊天室属性。 无权更新其他人的聊天室属性。

//获取属性

```json
{
  "uri": "https://XXXX/XXXX/XXXX/metadata/chatroom",
  "timestamp": 1716891388636,
  "action": "post",
  "data": {
    "key1": "value1",
    "key2": "value2"
  }
}
```

可能的错误
HTTP 状态码 错误类型 错误提示 可能原因 处理建议
401 unauthorized Unable to authenticate (OAuth) token 不合法，可能过期或 token 错误。 使用新的 token 访问。
404 resource_not_found grpID XX does not exist! 聊天室 ID 不存在。 传入存在的合法的聊天室 ID。HTTP 状态码 错误类型 错误提示 可能原因 处理建议
401 unauthorized Unable to authenticate (OAuth) token 不合法，可能过期或 token 错误。 使用新的 token 访问。
404 resource_not_found grpID XX does not exist! 聊天室 ID 不存在。 传入存在的合法的聊天室 ID。

//删除属性

```json
{
  "uri": "https://XXXX/XXXX/XXXX/metadata/chatroom",
  "status": "ok",
  "timestamp": 1716887320215,
  "action": "delete",
  "data": {
    "successKeys": ["key1"],
    "errorKeys": { "key2": "errorDesc" }
  }
}
```

用户强制删除聊天室的自定义属性信息，即该方法除了会删除当前用户设置的聊天室自定义属性，还可以删除其他用户设置的自定义属性。
每次最多可删除 10 个自定义属性。

HTTP 状态码 错误类型 错误提示 可能原因 处理建议
400 exceed allowed batch size 10 要删除的 key 属性数量超过 10 个。 要删除的 key 的数量不超过 10 个。
401 unauthorized Unable to authenticate (OAuth) token 不合法，可能过期或 token 错误。 使用新的 token 访问。
401 MetadataException user is not in chatroom 用户不在聊天室内。 使用正确的聊天室成员的用户 ID。

11. destroyChatRoom

```json
{
  "action": "delete",
  "application": "8beXXXX02",
  "uri": "https://XXXX/XXXX/XXXX/chatrooms/662XXXX13",
  "entities": [],
  "data": {
    "success": true,
    "id": "662XXXX13"
  },
  "timestamp": 1542545100474,
  "duration": 0,
  "organization": "XXXX",
  "applicationName": "testapp"
}
```

HTTP 状态码 错误类型 错误提示 可能原因 处理建议
401 unauthorized Unable to authenticate (OAuth) token 不合法，可能过期或 token 错误。 使用新的 token 访问 或者没有权限。
404 resource_not_found grpID XX does not exist! 聊天室 ID 不存在。 传入存在的合法的聊天室 ID。
