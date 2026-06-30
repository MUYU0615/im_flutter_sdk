# API 错误码说明

## 公共错误

### Auth (108,200-215)

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 108 | TOKEN_EXPIRED | 用户 token 已过期 |  |  |  |  |  |
| 200 | ALREADY_LOGIN | 用户已登录 |  |  |  |  |  |
| 201 | NOT_LOGIN | 用户未登录 |  |  |  |  |  |
| 202 | UNAUTHORIZED | 用户鉴权失败 |  |  |  |  |  |
| 210 | FORBIDDEN | 用户无权限 |  |  |  |  |  |
| 213 | BIND_ANOTHER_DEVICE | 用户已在其他设备登录 |  |  |  |  |  |
| 214 | LOGIN_TOO_MANY_DEVICES | 用户登录设备数超过限制 |  |  |  |  |  |
| 215 | USER_MUTED | 用户被禁言 |  |  |  |  |  |

### Chatroom (700-707)

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 700 | CHATROOM_INVALID_ID | 聊天室 ID 无效 |  |  |  |  |  |
| 702 | CHATROOM_NOT_JOINED | 未加入聊天室 |  |  |  |  |  |
| 703 | CHATROOM_PERMISSION_DENIED | 聊天室无权限 |  |  |  |  |  |
| 704 | CHATROOM_MEMBERS_FULL | 聊天室成员已满 |  |  |  |  |  |
| 705 | CHATROOM_NOT_EXIST | 聊天室不存在 |  |  |  |  |  |
| 706 | CHATROOM_OWNER_NOT_ALLOW_LEAVE | 聊天室所有者不允许退出 |  |  |  |  |  |
| 707 | CHATROOM_USER_IN_BLOCKLIST | 用户在聊天室黑名单中 |  |  |  |  |  |

### Connection (1,100,202,300-304)

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | NOT_CREATED | 通用错误 |  |  |  |  |  |
| 1 | CANCELLED | 通用错误：连接已取消 |  |  |  |  |  |
| 202 | PROVISION_REJECTED | 用户鉴权失败 |  |  |  |  |  |
| 300 | WEBSOCKET_ERROR | 服务器不可达 |  |  |  |  |  |
| 300 | CLOSED_BEFORE_READY | 服务器不可达 |  |  |  |  |  |
| 300 | PROVISION_CLOSED | 服务器不可达 |  |  |  |  |  |
| 301 | TIMEOUT | 请求服务超时 |  |  |  |  |  |
| 301 | PROVISION_TIMEOUT | 请求服务超时 |  |  |  |  |  |
| 302 | SERVER_BUSY | 服务器繁忙 |  |  |  |  |  |
| 304 | DNSLIST_FAILED | 获取服务器配置信息错误 |  |  |  |  |  |

### Message (1,300-511)

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | SENDER_DESTROYED | 通用错误：发送器已销毁 |  |  |  |  |  |
| 300 | NOT_CONNECTED | 服务器不可达 |  |  |  |  |  |
| 301 | ACK_TIMEOUT | 请求服务超时 |  |  |  |  |  |
| 301 | ACK_MISSING | 请求服务超时：ACK 丢失 |  |  |  |  |  |
| 303 | SEND_FAILED | 服务请求通用错误 |  |  |  |  |  |
| 500 | ENCODE_FAILED | 消息异常：编码失败 |  |  |  |  |  |
| 500 | DECODE_FAILED | 消息异常：解码失败 |  |  |  |  |  |

### Push (1500,1501,1502)

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1500 | TOKEN_UPLOAD_FAILED | Push token 上传失败 |  |  |  |  |  |
| 1501 | SILENT_MODE_OPERATION_FAILED | 免打扰设置失败 |  |  |  |  |  |
| 1502 | PUSH_LANGUAGE_OPERATION_FAILED | 推送翻译语言设置失败 |  |  |  |  |  |

### Storage (3)

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 3 | OPERATION_FAILED | 本地存储操作失败 |  |  |  |  |  |

### Transport (2,301,303)

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2 | NETWORK_ERROR | 网络错误 |  |  |  |  |  |
| 301 | TIMEOUT | 请求服务超时 |  |  |  |  |  |
| 303 | HTTP_ERROR | 服务请求通用错误 |  |  |  |  |  |
| 303 | BUSINESS_UNKNOWN | 服务请求通用错误：业务错误未映射 |  |  |  |  |  |

### Unknown (1,4)

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | UNKNOWN | 通用错误 |  |  |  |  |  |
| 4 | SERVICE_LIMIT_EXCEEDED | 超过服务限制 |  |  |  |  |  |

### Upload (1,100,110,301,402,405)

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ABORTED | 通用错误：上传已取消 |  |  |  |  |  |
| 100 | INVALID_APPKEY | App Key 不合法 |  |  |  |  |  |
| 110 | REQUIRED_FIELD_MISSING | 参数无效：缺少必需字段 |  |  |  |  |  |
| 301 | TIMEOUT | 请求服务超时 |  |  |  |  |  |
| 402 | REQUEST_FAILED | 上传文件错误 |  |  |  |  |  |
| 405 | SIZE_EXCEEDED | 文件太大 |  |  |  |  |  |

### Validation (100-110)

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 110 | MISSING_REQUIRED | 参数无效：缺少必填参数 |  |  |  |  |  |
| 110 | INVALID_FORMAT | 参数无效：格式不正确 |  |  |  |  |  |
| 110 | UNKNOWN | 参数无效 |  |  |  |  |  |

## API 业务错误

### acceptContactInvite (110,204,1001,1002)

- 接受联系人申请

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 204 | USER_NOT_FOUND | 用户不存在 | 404 | No | 目标用户不存在 | 确认用户 ID 正确 |  |
| 1001 | CONTACT_REACH_LIMIT | 邀请方联系人数量已达上限 | 403 | No | 当前用户的联系人数量已达服务端上限 | 删除不再使用的联系人后重试 |  |
| 1002 | CONTACT_REACH_LIMIT_PEER | 被邀请方联系人数量已达上限 | 403 | No | 对方的联系人数量已达服务端上限 | 联系对方清理联系人列表 |  |

### addChatRoomMembers (110,204,210,606)

- 添加聊天室成员

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 110 | illegal_argument | 参数无效：聊天室成员参数不合法 | 400 | No | userIds 为空、重复或包含非法用户标识 | 检查 userIds 列表，确保为非空合法用户 ID |  |
| 204 | service_resource_not_found | 用户不存在 | 404 | No | 待加入聊天室的用户不存在 | 确认 userIds 中的用户都已存在 |  |
| 210 | group_authorization | 用户无权限：没有添加聊天室成员的权限 | 401 | No | 当前用户不是聊天室 owner/admin，无法添加成员 | 使用聊天室 owner/admin 账号重试 |  |
| 606 | resource_not_found | 聊天室不存在 | 404 | No | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |  |

### addContact (110,204,210,1000,1001,1002)

- 添加联系人

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 204 | USER_NOT_FOUND | 用户不存在 | 404 | No | 目标用户不存在 | 确认用户 ID 正确 |  |
| 210 | BLOCKED_BY_USER | 用户无权限：被对方拉黑 |  | No |  |  |  |
| 1000 | ALREADY_FRIEND | 添加联系人失败：已是好友 |  | No |  |  |  |
| 1001 | CONTACT_REACH_LIMIT | 邀请方联系人数量已达上限 | 403 | No | 当前用户的联系人数量已达服务端上限 | 删除不再使用的联系人后重试，或联系服务端提升配额 |  |
| 1002 | CONTACT_REACH_LIMIT_PEER | 被邀请方联系人数量已达上限 | 403 | No | 对方的联系人数量已达服务端上限 | 联系对方清理联系人列表 |  |

### addConversationMark (110)

- 添加会话标记

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |

### addReaction (110,302,505,600,602,1300-1302)

- 添加消息 Reaction

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 302 | server_busy | Reaction 服务繁忙 |  |  | this message is creating reaction, please try again. |  |  |
| 505 | service_not_enabled | Reaction 服务未开通 |  |  | this appKey is not open reaction service! |  |  |
| 602 | group_not_joined | 当前用户不在该群组中 |  |  | The user not in this group! |  |  |
| 1300 | reaction_reach_limit | Reaction 数量达到上限 |  |  | The quantity has exceeded the limit! |  |  |
| 1301 | reaction_already_operated | 当前用户已经操作过该 Reaction |  |  | the user is already operation this message |  |  |
| 1302 | reaction_operation_illegal | Reaction 操作非法 |  |  | the user operation is illegal! |  |  |

### addUsersToBlocklist (4,110,204)

- 添加黑名单

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 4 | blocklist_limit_exceeded | 黑名单数量已达上限 | 400 | No | 黑名单数量已达服务端上限 | 移除不再需要的黑名单用户后重试 |  |
| 204 | service_resource_not_found | 黑名单添加失败：目标用户不存在 | 404 | No | 目标用户不存在 | 确认用户 ID 正确 |  |

### addUsersToChatRoomAllowlist (204,210,606)

- 添加聊天室 allowlist

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 204 | service_resource_not_found | 用户不存在 | 404 | No | 待加入 allowlist 的用户不存在 | 确认 userIds 中的用户都已存在 |  |
| 210 | group_authorization | 用户无权限：没有添加聊天室 allowlist 的权限 | 401 | No | 当前用户不是聊天室 owner/admin，无法修改 allowlist | 使用聊天室 owner/admin 账号重试 |  |
| 606 | resource_not_found | 聊天室不存在 | 404 | No | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |  |

### blockChatRoomMembers (204,210,606)

- 添加聊天室黑名单

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 204 | service_resource_not_found | 用户不存在 | 404 | No | 待加入黑名单的用户不存在 | 确认 userIds 中的用户都已存在 |  |
| 210 | group_authorization | 用户无权限：没有添加聊天室黑名单的权限 | 401 | No | 当前用户不是聊天室 owner/admin，无法拉黑成员 | 使用聊天室 owner/admin 账号重试 |  |
| 606 | resource_not_found | 聊天室不存在 | 404 | No | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |  |

### changeGroupOwner (603,606)

- 转让群主

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 603 | forbidden_op | 无权限的群组操作 | 403 | No | 新群主不在群组中、与旧群主相同，或当前用户没有转让群主权限 | 传入有效的新群主成员 ID，并使用当前群主账号重试 |  |
| 606 | resource_not_found | 群组不存在 | 404 | No | groupId 不存在或群组已被销毁 | 确认 groupId 正确且群组仍存在 |  |

### checkIfInChatRoomAllowList (606)

- 查询当前用户是否在聊天室 allowlist 中

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 606 | resource_not_found | 聊天室不存在 | 404 | No | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |  |

### clearAllMessagesAndConversations ()

- 清空消息与会话

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |

### clearConversationRemindType (110,1501)

- 清除会话提醒类型

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1501 | SILENT_MODE_OPERATION_FAILED | 免打扰设置失败 |  |  |  |  |  |

### createChatThread (4,110,201,210,301,303,606)

- 创建子区

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 4 | service_limit_exceeded | 超过服务限制 | 400 | No | 子区数量或创建频率超过服务端限制 | 减少创建频率，清理不需要的子区，或联系服务端提升配额 |  |
| 201 | not_login | 用户未登录 | 401 | No | 当前用户登录态不可用或 token 无效 | 重新登录后再创建子区 |  |
| 210 | permission_denied | 无权限创建子区 | 403 | No | 当前用户不在父群组中，或服务端未开通 Thread 能力 | 确认当前用户已加入父群组，并检查控制台 Thread 能力开通状态 |  |
| 301 | request_timeout | 请求服务超时 | 504 | Yes | 服务端处理超时或网络链路超时 | 稍后重试 |  |
| 303 | service_error | 服务请求通用错误 | 500 | Yes | 服务端返回未细分的 Thread 创建错误 | 稍后重试或联系服务端排查 |  |
| 606 | resource_not_found | 群组或父消息不存在 | 404 | No | parentId 对应群组不存在，或 messageId 对应父消息不存在 | 确认父群组和父消息仍存在后重试 |  |

### createCmdMessage (110)

- 创建命令消息

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |

### createCombineMessage (4,110,500)

- 创建合并消息

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |

### createCustomMessage (110)

- 创建自定义消息

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |

### createFileMessage (110)

- 创建文件消息

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |

### createGroup (4,110,204,608)

- 创建群组

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 4 | exceed_limit | 超过服务限制：群组数量或成员数量超限 | 403 | No | 应用可创建群数量、用户可加入群数量或创建群初始成员数量触达服务限制 | 减少创建或加入数量，或联系服务端提升限制 |  |
| 110 | invalid_parameter | 参数无效：缺少创建群组必填参数 | 400 | No | 创建群组时缺少 public、name 等必填字段，或字段格式不符合服务端约束 | 检查创建群组请求体，补齐必填字段并修正字段格式 |  |
| 110 | illegal_argument | 参数无效：群组参数不合法 | 400 | No | 群组 ID 冲突、头像字段过长，或请求字段组合不符合服务端要求 | 更换冲突参数，并确保请求字段长度与取值范围合法 |  |
| 204 | resource_not_found | 用户不存在 | 404 | No | 创建群组时附带的成员列表中包含不存在的用户 | 确认 memberIds 中的用户都已存在 |  |
| 608 | group_name_violation | 群组名称无效 | 403 | No | 群组名称触发服务端敏感词或命名规范校验 | 更换为合法群组名称后重试 |  |

### createImageMessage (110)

- 创建图片消息

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |

### createLocationMessage (110)

- 创建位置消息

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |

### createTextMessage (110)

- 创建文本消息

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |

### createVideoMessage (110)

- 创建视频消息

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |

### createVoiceMessage (110)

- 创建语音消息

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |

### declineContactInvite (110,204)

- 拒绝联系人申请

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 204 | USER_NOT_FOUND | 用户不存在 | 404 | No | 目标用户不存在 | 确认用户 ID 正确 |  |

### deleteChatRoomSharedFile (210,606)

- 删除聊天室共享文件

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 210 | group_authorization | 用户无权限：没有删除聊天室共享文件的权限 | 401 | No | 当前用户不是聊天室 owner/admin，无法删除共享文件 | 使用聊天室 owner/admin 账号重试 |  |
| 606 | resource_not_found | 聊天室不存在 | 404 | No | chatRoomId 不存在、聊天室已被销毁，或共享文件不存在 | 确认 chatRoomId 与 fileId 正确且资源仍存在 |  |

### deleteContact (110,204)

- 删除联系人

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 204 | USER_NOT_FOUND | 用户不存在 | 404 | No | 目标用户不存在 | 确认用户 ID 正确 |  |

### deleteConversation (110)

- 删除会话

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |

### deleteGroupSharedFile (603,605,606)

- 删除群共享文件

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 603 | group_authorization | 无权限的群组操作 |  | No | 当前用户没有删除群共享文件的权限 | 使用群主、管理员或文件所有者账号重试 |  |
| 605 | file_not_found | 群共享文件 ID 无效 |  | No | fileId 不存在或对应的群共享文件已被删除 | 确认 fileId 正确且共享文件仍存在 |  |
| 606 | resource_not_found | 群组不存在 |  | No | groupId 不存在或群组已被销毁 | 确认 groupId 正确且群组仍存在 |  |

### destroyChatRoom (210,606)

- 销毁聊天室

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 210 | group_authorization | 用户无权限：需要聊天室所有者权限 | 401 | No | 当前用户没有销毁聊天室的权限 | 使用聊天室 owner 账号重试 |  |
| 606 | resource_not_found | 聊天室不存在 | 404 | No | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |  |

### destroyChatThread (110,201,210,301,303,606)

- 解散子区

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 201 | not_login | 用户未登录 | 401 | No | 当前用户登录态不可用或 token 无效 | 重新登录后再解散子区 |  |
| 210 | permission_denied | 无权限解散子区 | 403 | No | 当前用户不是群主、管理员或子区创建者，服务端拒绝解散 | 使用有管理权限的账号重试 |  |
| 301 | request_timeout | 请求服务超时 | 504 | Yes | 服务端处理超时或网络链路超时 | 稍后重试 |  |
| 303 | service_error | 服务请求通用错误 | 500 | Yes | 服务端返回未细分的 Thread 解散错误 | 稍后重试或联系服务端排查 |  |
| 606 | resource_not_found | 子区不存在 | 404 | No | chatThreadId 对应子区不存在或已被解散 | 确认子区 ID 正确且子区仍存在 |  |

### destroyGroup (603,606,607)

- 解散群组

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 603 | group_authorization | 无权限的群组操作 | 403 | No | 当前用户不是群主，无法解散群组 | 使用群主账号重试 |  |
| 606 | resource_not_found | 群组不存在 | 404 | No | groupId 不存在或群组已被销毁 | 确认 groupId 正确且群组仍存在 |  |
| 607 | group_disabled | 群组已禁用 | 403 | No | 群组状态异常，服务端拒绝继续处理该群组写操作 | 确认群组状态后再重试 |  |

### downloadAndParseCombineMessage (110,401,403,500)

- 下载合并消息

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 110 | invalid_param | 消息为空 |  |  |  |  |  |
| 401 | parse_failed | 合并消息解析失败 |  |  |  |  |  |
| 403 | download_failed | 合并消息下载失败 |  |  |  |  |  |
| 500 | invalid_type | 消息不是合并消息类型 |  |  |  |  |  |

### downloadMessageAttachment (400,401,403,407)

- 下载消息附件

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 400 | not_found | 附件不存在 | 404 |  |  |  |  |
| 401 | invalid | 附件无效或消息类型不支持下载 |  |  |  |  |  |
| 403 | download_failed | 附件下载失败 |  |  |  |  |  |
| 407 | expired | 附件已过期 | 404 |  |  |  |  |

### getBlocklist ()

- 获取黑名单

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |

### getChatRoomAdminList (606)

- 获取聊天室管理员列表

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 606 | resource_not_found | 聊天室不存在 | 404 | No | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |  |

### getChatRoomAllowlist (606)

- 获取聊天室 allowlist

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 606 | resource_not_found | 聊天室不存在 | 404 | No | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |  |

### getChatRoomAnnouncement (606)

- 获取聊天室公告

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 606 | resource_not_found | 聊天室不存在 | 404 | No | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |  |

### getChatRoomAttributes (110,606)

- 获取聊天室属性

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 110 | illegal_argument | 参数无效：属性 key 列表不合法 | 400 | No | keys 为空字符串、包含非法值，或请求体格式不符合要求 | 确保 keys 为合法非空字符串数组，或省略 keys 获取全部属性 |  |
| 606 | resource_not_found | 聊天室不存在 | 404 | No | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |  |

### getChatRoomBlocklist (606)

- 获取聊天室黑名单

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 606 | resource_not_found | 聊天室不存在 | 404 | No | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |  |

### getChatRoomInfo (606)

- 获取聊天室详情

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 606 | resource_not_found | 聊天室不存在 | 404 | No | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |  |

### getChatRoomList ()

- 获取公开聊天室列表

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |

### getChatRoomMemberList (606)

- 获取聊天室成员列表

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 606 | resource_not_found | 聊天室不存在 | 404 | No | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |  |

### getChatRoomMuteList (606)

- 获取聊天室禁言列表

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 606 | resource_not_found | 聊天室不存在 | 404 | No | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |  |

### getChatRoomSharedFileList (606)

- 获取聊天室共享文件列表

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 606 | resource_not_found | 聊天室不存在 | 404 | No | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |  |

### getChatThreadInfo (110,201,210,301,303,606)

- 获取子区详情

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 201 | not_login | 用户未登录 | 401 | No | 当前用户登录态不可用或 token 无效 | 重新登录后再查询子区详情 |  |
| 210 | permission_denied | 无权限查询子区详情 | 403 | No | 当前用户无权访问目标子区 | 确认当前用户已加入父群组或目标子区 |  |
| 301 | request_timeout | 请求服务超时 | 504 | Yes | 服务端处理超时或网络链路超时 | 稍后重试 |  |
| 303 | service_error | 服务请求通用错误 | 500 | Yes | 服务端返回未细分的 Thread 详情查询错误 | 稍后重试或联系服务端排查 |  |
| 606 | resource_not_found | 子区不存在 | 404 | No | chatThreadId 对应子区不存在或已被解散 | 确认子区 ID 正确且子区仍存在 |  |

### getChatThreadLastMessageList (110,201,210,301,303,606)

- 批量获取子区最后一条消息

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 201 | not_login | 用户未登录 | 401 | No | 当前用户登录态不可用或 token 无效 | 重新登录后再查询子区最后消息 |  |
| 210 | permission_denied | 无权限查询子区最后消息 | 403 | No | 当前用户无权访问一个或多个目标子区 | 确认当前用户有权限访问传入的所有子区 |  |
| 301 | request_timeout | 请求服务超时 | 504 | Yes | 服务端处理超时或网络链路超时 | 稍后重试 |  |
| 303 | service_error | 服务请求通用错误 | 500 | Yes | 服务端返回未细分的 Thread 最后消息查询错误 | 稍后重试或联系服务端排查 |  |
| 606 | resource_not_found | 子区不存在 | 404 | No | 一个或多个 chatThreadId 对应子区不存在或已被解散 | 确认子区 ID 正确且子区仍存在 |  |

### getChatThreadList (110,201,210,301,303,606)

- 获取子区列表

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 201 | not_login | 用户未登录 | 401 | No | 当前用户登录态不可用或 token 无效 | 重新登录后再查询子区列表 |  |
| 210 | permission_denied | 无权限查询子区列表 | 403 | No | 当前用户无权访问目标群组的子区列表 | 确认当前用户已加入父群组 |  |
| 301 | request_timeout | 请求服务超时 | 504 | Yes | 服务端处理超时或网络链路超时 | 稍后重试 |  |
| 303 | service_error | 服务请求通用错误 | 500 | Yes | 服务端返回未细分的 Thread 列表查询错误 | 稍后重试或联系服务端排查 |  |
| 606 | resource_not_found | 群组不存在 | 404 | No | parentId 对应群组不存在或已被解散 | 确认父群组 ID 正确且群组仍存在 |  |

### getChatThreadMemberList (110,201,210,301,303,606)

- 获取子区成员列表

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 201 | not_login | 用户未登录 | 401 | No | 当前用户登录态不可用或 token 无效 | 重新登录后再查询子区成员 |  |
| 210 | permission_denied | 无权限查询子区成员 | 403 | No | 当前用户无权访问目标子区成员列表 | 确认当前用户已加入父群组或目标子区 |  |
| 301 | request_timeout | 请求服务超时 | 504 | Yes | 服务端处理超时或网络链路超时 | 稍后重试 |  |
| 303 | service_error | 服务请求通用错误 | 500 | Yes | 服务端返回未细分的 Thread 成员列表查询错误 | 稍后重试或联系服务端排查 |  |
| 606 | resource_not_found | 子区不存在 | 404 | No | chatThreadId 对应子区不存在或已被解散 | 确认子区 ID 正确且子区仍存在 |  |

### getConversationList (110)

- 获取会话列表

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |

### getConversationListByMark (110)

- 按标记获取会话列表

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |

### getConversationListByRemindType (110)

- 分页获取免打扰会话

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |

### getConversationSilentMode (110,1501)

- 获取会话免打扰

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1501 | SILENT_MODE_OPERATION_FAILED | 免打扰设置失败 |  |  |  |  |  |

### getConversationSilentModes (110,1501)

- 批量获取会话免打扰

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1501 | SILENT_MODE_OPERATION_FAILED | 免打扰设置失败 |  |  |  |  |  |

### getGlobalSilentMode (1501)

- 获取全局免打扰

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1501 | SILENT_MODE_OPERATION_FAILED | 免打扰设置失败 |  |  |  |  |  |

### getGroupAdminList (606)

- 获取群管理员列表

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 606 | resource_not_found | 群组不存在 | 404 | No | groupId 不存在或群组已被销毁 | 确认 groupId 正确且群组仍存在 |  |

### getGroupAllowlist (606)

- 获取群 allowlist

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 606 | resource_not_found | 群组不存在 | 404 | No | groupId 不存在或群组已被销毁 | 确认 groupId 正确且群组仍存在 |  |

### getGroupAnnouncement (606)

- 获取群公告

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 606 | resource_not_found | 群组不存在 | 404 | No | groupId 不存在或群组已被销毁 | 确认 groupId 正确且群组仍存在 |  |

### getGroupBlocklist (606)

- 获取群黑名单

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 606 | resource_not_found | 群组不存在 | 404 | No | groupId 不存在或群组已被销毁 | 确认 groupId 正确且群组仍存在 |  |

### getGroupInfo (606)

- 获取群组详情

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 606 | resource_not_found | 群组不存在 | 404 | No | groupId 不存在或群组已被销毁 | 确认 groupId 正确且群组仍存在 |  |

### getGroupInfoList (606)

- 批量获取群组详情

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 606 | resource_not_found | 群组不存在 | 404 | No | groupIds 中存在无效群组 ID | 确认 groupIds 中的群组都存在 |  |

### getGroupMemberList (606)

- 获取群成员列表

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 606 | resource_not_found | 群组不存在 | 404 | No | groupId 不存在或群组已被销毁 | 确认 groupId 正确且群组仍存在 |  |

### getGroupMembersAttributes (606)

- 批量获取群成员属性

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 606 | resource_not_found | 群组不存在 |  | No | groupId 不存在或群组已被销毁 | 确认 groupId 正确且群组仍存在 |  |

### getGroupMessageReadUsers (4,110,500)

- 获取群消息已读成员

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 500 | message_not_found | 消息不存在 |  |  |  |  |  |

### getGroupMuteList (606)

- 获取群禁言列表

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 606 | resource_not_found | 群组不存在 | 404 | No | groupId 不存在或群组已被销毁 | 确认 groupId 正确且群组仍存在 |  |

### getGroupSharedFileList (606)

- 获取群共享文件列表

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 606 | resource_not_found | 群组不存在 | 404 | No | groupId 不存在或群组已被销毁 | 确认 groupId 正确且群组仍存在 |  |

### getHistoryMessages (4,110,202,505)

- 获取历史消息

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 110 | page_size_exceeded | 分页参数超限 |  |  |  |  |  |
| 505 | service_not_enabled | 消息漫游服务未开通 |  |  | this appKey not open message roaming |  |  |

### getJoinedChatThreadList (110,201,210,301,303,606)

- 获取已加入子区列表

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 201 | not_login | 用户未登录 | 401 | No | 当前用户登录态不可用或 token 无效 | 重新登录后再查询已加入子区 |  |
| 210 | permission_denied | 无权限查询已加入子区 | 403 | No | 当前用户无权访问目标群组的已加入子区列表 | 确认当前用户已加入目标群组 |  |
| 301 | request_timeout | 请求服务超时 | 504 | Yes | 服务端处理超时或网络链路超时 | 稍后重试 |  |
| 303 | service_error | 服务请求通用错误 | 500 | Yes | 服务端返回未细分的已加入 Thread 查询错误 | 稍后重试或联系服务端排查 |  |
| 606 | resource_not_found | 群组不存在 | 404 | No | 指定 parentId 时，目标群组不存在或已被解散 | 确认父群组 ID 正确且群组仍存在 |  |

### getPinnedConversationList (110)

- 获取置顶会话列表

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |

### getPinnedMessageList (110,111)

- 获取置顶消息列表

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 110 | pin_message_not_found | 置顶消息不存在 |  |  |  |  |  |
| 111 | operation_unsupported | 当前服务端不支持获取置顶消息列表 |  |  |  |  |  |

### getPresenceStatus (1100)

- 查询在线状态

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1100 | param_length_exceed | 参数长度超限 | 400 | No | 查询参数长度超过服务端允许上限 | 减少单次查询的用户数量 |  |

### getPushLanguage (1502)

- 获取推送翻译语言

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1502 | PUSH_LANGUAGE_OPERATION_FAILED | 推送翻译语言设置失败 |  |  |  |  |  |

### getReactionDetail (110,505,1302)

- 获取消息 Reaction 详情

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 505 | service_not_enabled | Reaction 服务未开通 |  |  | this appKey is not open reaction service! |  |  |
| 1302 | reaction_operation_illegal | Reaction 操作非法 |  |  | the user operation is illegal! |  |  |

### getReactionList (110,505,600)

- 获取消息 Reaction 列表

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 505 | service_not_enabled | Reaction 服务未开通 |  |  | this appKey is not open reaction service! |  |  |
| 600 | group_invalid_id | groupId 无效 |  |  | groupId can not be null! |  |  |

### getSelfIdsOnOtherPlatform (202,300-303)

- 获取当前用户在其他平台的登录 ID 列表

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |

### getSubscribedPresenceList (1100)

- 查询在线状态订阅列表

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1100 | param_length_exceed | 参数长度超限 | 400 | No | 分页参数超过服务端允许上限 | 调整 pageNum 或 pageSize 后重试 |  |

### getSubscribedUsers (4,202,210,303,1600,1601)

- 查询已订阅陌生人资料变化列表

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 4 | rate_limit | 超过服务限制 | 429 | Yes | 请求过于频繁 | 降低请求频率后重试 |  |
| 202 | unauthorized | 用户鉴权失败 | 401 |  | unauthorized | refresh_token |  |
| 210 | forbidden | 服务未开通或无权限 | 403 |  | service_forbidden | check_service_permission |  |
| 303 | server_unknown_error | 服务请求通用错误：服务端内部错误 | 500 | Yes | server_unknown_error | 稍后重试或联系服务端排查 |  |
| 1600 | subscriber_limit_exceeded | 订阅人数超限 | 400 |  | subscriber_limit_exceeded | reduce_subscription_targets |  |
| 1601 | target_limit_exceeded | 目标用户被订阅人数超限 | 400 |  | target_limit_exceeded | change_subscription_target |  |

### getSupportedTranslationLanguages (505)

- 获取翻译支持语言

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 505 | service_not_enabled | 翻译服务未开通 |  |  |  |  |  |

### getUserInfoByAttribute (4,110,204,900)

- 按属性批量获取用户资料

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 4 | rate_limit | 超过服务限制 | 429 | Yes | 请求过于频繁 | 降低请求频率后重试 |  |
| 204 | resource_not_found | 用户不存在 | 404 | No | 查询的用户不存在 | 确认用户 ID 正确 |  |
| 900 | usercount_exceed | 批量查询用户数超限 | 400 | No | 单次查询的用户数量超过服务端允许上限 | 减少单次查询的用户数量后重试 |  |

### getUserInfoByUserId (4,110,204,900)

- 批量获取用户资料

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 4 | rate_limit | 超过服务限制 | 429 | Yes | 请求过于频繁 | 降低请求频率后重试 |  |
| 204 | resource_not_found | 用户不存在 | 404 | No | 查询的用户不存在 | 确认用户 ID 正确 |  |
| 900 | usercount_exceed | 批量查询用户数超限 | 400 | No | 单次查询的用户数量超过服务端允许上限 | 减少单次查询的用户数量后重试 |  |

### inviteUsersToGroup (204,603,606,607)

- 邀请用户入群

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 204 | resource_not_found | 用户不存在 | 404 | No | 被邀请用户不存在 | 确认 userIds 中的用户都已存在 |  |
| 603 | group_authorization | 无权限的群组操作 | 400 | No | 当前用户没有邀请成员入群的权限 | 使用有邀请权限的账号重试 |  |
| 606 | group_not_found | 群组不存在 |  | No | 目标群组不存在或已被销毁 | 确认 groupId 正确且群组仍存在 |  |
| 607 | group_disabled | 群组已禁用 |  | No | 目标群组处于禁用状态，服务端拒绝邀请入群 | 确认群组状态恢复正常后再重试 |  |

### isCurrentUserMutedInChatRoom (606)

- 查询当前用户聊天室禁言状态

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 606 | resource_not_found | 聊天室不存在 | 404 | No | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |  |

### joinChatRoom (4,606,704,707)

- 加入聊天室

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 4 | exceed_limit | 超过服务限制：加入聊天室数量超限 | 403 | No | 当前用户已加入过多聊天室，服务端拒绝继续加入 | 退出不再使用的聊天室后重试，或联系服务端提升限制 |  |
| 606 | resource_not_found | 聊天室不存在 | 404 | No | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |  |
| 704 | members_full | 聊天室成员已满 | 403 | No | 聊天室人数已达上限，无法继续加入 | 等待其他成员退出后重试，或联系聊天室管理员提升上限 |  |
| 707 | user_in_blocklist | 用户在聊天室黑名单中 | 403 | No | 当前用户已被加入聊天室黑名单，无法加入 | 联系聊天室管理员将用户从黑名单移除 |  |

### joinChatThread (4,110,201,210,301,303,606)

- 加入子区

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 4 | service_limit_exceeded | 超过服务限制 | 400 | No | 加入子区频率或数量超过服务端限制 | 减少操作频率或联系服务端提升配额 |  |
| 201 | not_login | 用户未登录 | 401 | No | 当前用户登录态不可用或 token 无效 | 重新登录后再加入子区 |  |
| 210 | permission_denied | 无权限加入子区 | 403 | No | 当前用户不在父群组中，或服务端拒绝加入目标子区 | 确认当前用户已加入父群组且目标子区可加入 |  |
| 301 | request_timeout | 请求服务超时 | 504 | Yes | 服务端处理超时或网络链路超时 | 稍后重试 |  |
| 303 | service_error | 服务请求通用错误 | 500 | Yes | 服务端返回未细分的 Thread 加入错误 | 稍后重试或联系服务端排查 |  |
| 606 | resource_not_found | 子区不存在 | 404 | No | chatThreadId 对应子区不存在或已被解散 | 确认子区 ID 正确且子区仍存在 |  |

### joinGroup (600-607,613)

- 加入群组

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 600 | group_invalid_id | 群组 ID 无效 |  | No | 传入的 groupId 为空、格式不合法或不符合服务端约束 | 检查并传入合法的 groupId |  |
| 601 | already_joined | 已在该群组中 |  | No | 当前用户已经加入目标群组 | 无需重复加入，直接使用现有群组上下文 |  |
| 602 | not_joined | 用户未加入该群组 |  | No | 当前用户不在该群组中，或服务端要求当前用户先成为群成员 | 确认当前用户已加入目标群组 |  |
| 603 | group_authorization | 无权限的群组操作 | 403 | No | 加入群组需要管理员审批，或当前用户没有权限加入目标群组 | 等待管理员审批，或改用有权限的账号重试 |  |
| 604 | group_full | 群组成员超上限 | 403 | No | 目标群组人数已达到上限，无法继续加入 | 清理群成员或提升群人数上限后重试 |  |
| 606 | resource_not_found | 群组不存在 | 404 | No | groupId 不存在或群组已被销毁 | 确认 groupId 正确且群组仍存在 |  |
| 607 | group_disabled | 群组已禁用 |  | No | 目标群组处于禁用状态，服务端拒绝加入 | 确认群组状态恢复正常后再尝试加入 |  |
| 613 | group_user_in_blocklist | 用户已被群禁言列表拦截 | 403 | No | 当前用户处于群组黑名单或禁入名单中，服务端拒绝加入 | 联系群主或管理员移出对应名单后重试 |  |

### leaveChatRoom (606)

- 退出聊天室

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 606 | resource_not_found | 聊天室不存在 | 404 | No | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |  |

### leaveChatThread (110,201,210,301,303,606)

- 退出子区

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 201 | not_login | 用户未登录 | 401 | No | 当前用户登录态不可用或 token 无效 | 重新登录后再退出子区 |  |
| 210 | permission_denied | 无权限退出子区 | 403 | No | 服务端拒绝当前用户退出目标子区 | 确认当前用户已加入目标子区且允许退出 |  |
| 301 | request_timeout | 请求服务超时 | 504 | Yes | 服务端处理超时或网络链路超时 | 稍后重试 |  |
| 303 | service_error | 服务请求通用错误 | 500 | Yes | 服务端返回未细分的 Thread 退出错误 | 稍后重试或联系服务端排查 |  |
| 606 | resource_not_found | 子区不存在 | 404 | No | chatThreadId 对应子区不存在或已被解散 | 确认子区 ID 正确且子区仍存在 |  |

### leaveGroup (602,603,606)

- 退出群组

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 602 | not_joined | 用户未加入该群组 |  | No | 当前用户不在该群组中，无法执行退出操作 | 确认当前用户已加入目标群组 |  |
| 603 | owner_cannot_leave | 群主不能退出群组 | 403 | No | 群主不允许直接退出群组，需先转让群主或解散群组 | 先调用 changeGroupOwner 转让群主，再退出群组 |  |
| 606 | resource_not_found | 群组不存在 | 404 | No | groupId 不存在或群组已被销毁 | 确认 groupId 正确且群组仍存在 |  |

### markConversationRead (110,201,300,500)

- 标记会话已读

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 201 | not_login | 未登录 |  |  |  |  |  |
| 300 | not_connected | 未连接服务器 |  |  |  |  |  |
| 500 | message_invalid | 会话中无消息 |  |  |  |  |  |

### markMessageRead (110,300)

- 批量标记消息已读

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 110 | invalid_direction | 只能对接收的消息发送已读回执 |  |  |  |  |  |
| 300 | not_connected | 未连接服务器 |  |  |  |  |  |

### muteAllChatRoomMembers (210,606)

- 开启聊天室全员禁言

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 210 | group_authorization | 用户无权限：没有开启全员禁言的权限 | 401 | No | 当前用户不是聊天室 owner/admin，无法开启全员禁言 | 使用聊天室 owner/admin 账号重试 |  |
| 606 | resource_not_found | 聊天室不存在 | 404 | No | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |  |

### muteChatRoomMembers (110,210,606)

- 禁言聊天室成员

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 110 | illegal_argument | 参数无效：聊天室禁言参数不合法 | 400 | No | muteDuration、userIds 或请求体字段不符合服务端约束 | 检查 userIds 与 muteDuration，确保传入有效值 |  |
| 210 | group_authorization | 用户无权限：没有禁言聊天室成员的权限 | 401 | No | 当前用户不是聊天室 owner/admin，无法禁言成员 | 使用聊天室 owner/admin 账号重试 |  |
| 606 | resource_not_found | 聊天室不存在 | 404 | No | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |  |

### pinMessage (4,110)

- 置顶消息

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 4 | pin_message_limit | 置顶消息数量达到上限 |  |  |  |  |  |
| 110 | pin_msg_id_illegal | 消息 ID 非法 |  |  | param pin_msg_id illegal, please check it! |  |  |
| 110 | pin_message_not_found | 待置顶消息不存在 |  |  |  |  |  |

### publishPresence (1100)

- 发布在线状态

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1100 | PRESENCE_PARAM_EXCEED | 发布自定义在线状态时，参数长度超出限制 | 400 | No | 在线状态扩展描述信息长度超过服务端允许上限 | 缩短 customStatus 后重试 |  |

### recallMessage (110,201,300,504,505)

- 撤回消息

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 110 | message_invalid | 消息无效或未发送成功 |  |  |  |  |  |
| 201 | not_login | 未登录 |  |  |  |  |  |
| 300 | not_connected | 未连接服务器 |  |  |  |  |  |
| 504 | recall_time_limit | 超过撤回时间限制 |  |  |  |  |  |
| 505 | recall_disabled | 撤回功能未开通 |  |  |  |  |  |

### removeChatRoomAdmin (210,606)

- 移除聊天室管理员

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 210 | group_authorization | 用户无权限：只有聊天室所有者可移除管理员 | 401 | No | 当前用户不是聊天室所有者，无法移除管理员 | 使用聊天室 owner 账号重试 |  |
| 606 | resource_not_found | 聊天室不存在 | 404 | No | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |  |

### removeChatRoomAttribute (110,210,702,703,4)

- 删除单个聊天室属性

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 4 | exceed_limit | 聊天室属性操作超限 | 400 | No | 属性操作超过服务端限制 | 减少操作频率 |  |
| 110 | illegal_argument | 参数无效：聊天室属性 key 不合法 | 400 | No | 属性 key 为空或格式不符合要求 | 确保 key 为合法非空字符串 |  |
| 210 | MetadataException | 用户无权限：聊天室属性删除被拒绝 | 401 | No | 当前用户不在聊天室内，或无权删除目标属性 | 确认当前用户已加入聊天室，并仅删除自己有权限操作的属性 |  |
| 702 | chatroom_not_joined | 未加入聊天室 | 400 | No | 当前用户未加入目标聊天室，无法删除属性 | 先加入聊天室后重试 |  |
| 703 | chatroom_permission_denied | 聊天室属性权限拒绝 | 400 | No | 当前用户无权删除目标属性 | 仅删除自己创建的属性，或使用 forced 模式 |  |

### removeChatRoomAttributes (110,210,702,703,4)

- 删除聊天室属性

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 4 | exceed_limit | 聊天室属性操作超限 | 400 | No | 属性操作超过服务端限制 | 减少单次操作的属性数量 |  |
| 110 | illegal_argument | 参数无效：聊天室属性 key 列表不合法 | 400 | No | 属性 key 数量超过限制，或 keys 字段格式不符合要求 | 确保每次删除的属性数量不超过限制，且 keys 为合法非空字符串数组 |  |
| 210 | MetadataException | 用户无权限：聊天室属性删除被拒绝 | 401 | No | 当前用户不在聊天室内，或无权删除目标属性 | 确认当前用户已加入聊天室，并仅删除自己有权限操作的属性 |  |
| 702 | chatroom_not_joined | 未加入聊天室 | 400 | No | 当前用户未加入目标聊天室，无法删除属性 | 先加入聊天室后重试 |  |
| 703 | chatroom_permission_denied | 聊天室属性权限拒绝 | 400 | No | 当前用户无权删除目标属性 | 仅删除自己创建的属性，或使用 forced 模式 |  |

### removeChatRoomMembers (210,606)

- 移除聊天室成员

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 210 | group_authorization | 用户无权限：没有移除聊天室成员的权限 | 401 | No | 当前用户不是聊天室 owner/admin，无法移除成员 | 使用聊天室 owner/admin 账号重试 |  |
| 606 | resource_not_found | 聊天室不存在 | 404 | No | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |  |

### removeChatThreadMember (110,201,210,301,303,606)

- 移除子区成员

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 201 | not_login | 用户未登录 | 401 | No | 当前用户登录态不可用或 token 无效 | 重新登录后再移除子区成员 |  |
| 210 | permission_denied | 无权限移除子区成员 | 403 | No | 当前用户没有移除目标子区成员的权限 | 使用群主、管理员或有权限的账号重试 |  |
| 301 | request_timeout | 请求服务超时 | 504 | Yes | 服务端处理超时或网络链路超时 | 稍后重试 |  |
| 303 | service_error | 服务请求通用错误 | 500 | Yes | 服务端返回未细分的 Thread 成员移除错误 | 稍后重试或联系服务端排查 |  |
| 606 | resource_not_found | 子区或成员不存在 | 404 | No | chatThreadId 对应子区不存在，或 memberId 不是子区成员 | 确认子区和目标成员关系仍存在 |  |

### removeConversationMark (110)

- 移除会话标记

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |

### removeHistoryMessages (110,112,202,505)

- 删除历史消息

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 112 | query_param_reaches_limit | 删除消息数量超限 |  |  |  |  |  |
| 505 | service_not_enabled | 消息漫游服务未开通 |  |  | this appKey not open message roaming |  |  |

### removeReaction (110,505,1301,1302)

- 删除消息 Reaction

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 505 | service_not_enabled | Reaction 服务未开通 |  |  | this appKey is not open reaction service! |  |  |
| 1302 | reaction_operation_illegal | Reaction 操作非法 |  |  | the user operation is illegal! |  |  |

### removeUserFromBlocklist (110)

- 移除黑名单

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |

### removeUsersFromChatRoomAllowlist (210,606)

- 移除聊天室 allowlist

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 210 | group_authorization | 用户无权限：没有移除聊天室 allowlist 的权限 | 401 | No | 当前用户不是聊天室 owner/admin，无法修改 allowlist | 使用聊天室 owner/admin 账号重试 |  |
| 606 | resource_not_found | 聊天室不存在 | 404 | No | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |  |

### sendMessage (110,215,300,500,1200)

- 发送消息

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 215 | USER_MUTED | 用户被禁言 |  |  |  |  |  |
| 1200 | MESSAGE_BLOCKED | 第三方内容审核拒绝 |  |  |  |  |  |

### setChatRoomAdmin (204,210,606)

- 设置聊天室管理员

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 204 | service_resource_not_found | 用户不存在 | 404 | No | 待设置为管理员的用户不存在 | 确认 userId 对应用户存在 |  |
| 210 | group_authorization | 用户无权限：只有聊天室所有者可设置管理员 | 401 | No | 当前用户不是聊天室所有者，无法设置管理员 | 使用聊天室 owner 账号重试 |  |
| 606 | resource_not_found | 聊天室不存在 | 404 | No | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |  |

### setChatRoomAttribute (110,210,702,703,4)

- 设置单个聊天室属性

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 4 | exceed_limit | 聊天室属性数量或总量超限 | 400 | No | 单个聊天室属性数量或应用级属性总量超过服务端限制 | 删除不再使用的属性后重试 |  |
| 110 | illegal_argument | 参数无效：聊天室属性字段不合法 | 400 | No | 属性 key/value 非法，或字段格式不符合要求 | 确保 key/value 为合法非空字符串 |  |
| 210 | MetadataException | 用户无权限：聊天室属性写入被拒绝 | 401 | No | 当前用户不在聊天室内，或试图修改其他用户的聊天室属性 | 确认当前用户已加入聊天室，并仅修改自己有权限操作的属性 |  |
| 702 | chatroom_not_joined | 未加入聊天室 | 400 | No | 当前用户未加入目标聊天室，无法设置属性 | 先加入聊天室后重试 |  |
| 703 | chatroom_permission_denied | 聊天室属性权限拒绝 | 400 | No | 当前用户无权设置目标属性 | 仅修改自己创建的属性，或使用 forced 模式覆盖 |  |

### setChatRoomAttributes (110,210,702,703,4)

- 设置聊天室属性

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 4 | exceed_limit | 聊天室属性数量或总量超限 | 400 | No | 单个聊天室属性数量或应用级属性总量超过服务端限制 | 删除不再使用的属性后重试，或联系服务端提升配额 |  |
| 110 | illegal_argument | 参数无效：聊天室属性数量或字段不合法 | 400 | No | 属性 key 数量超过限制，或属性字段格式不符合要求 | 确保每次设置的属性数量不超过限制，且 key/value 均为合法字符串 |  |
| 210 | MetadataException | 用户无权限：聊天室属性写入被拒绝 | 401 | No | 当前用户不在聊天室内，或试图修改其他用户的聊天室属性 | 确认当前用户已加入聊天室，并仅修改自己有权限操作的属性 |  |
| 702 | chatroom_not_joined | 未加入聊天室 | 400 | No | 当前用户未加入目标聊天室，无法设置属性 | 先加入聊天室后重试 |  |
| 703 | chatroom_permission_denied | 聊天室属性权限拒绝 | 400 | No | 当前用户无权设置目标属性（属性不属于当前用户且未使用 forced 模式） | 仅修改自己创建的属性，或使用 forced 模式覆盖 |  |

### setContactRemark (4,110,223)

- 设置联系人备注

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 4 | remark_length_exceeded | 备注长度超限 | 400 | No | 备注内容超过服务端允许的最大长度 | 缩短备注内容后重试 |  |
| 223 | illegal_argument | 非好友不能设置备注 | 400 | No | 目标用户不是当前用户的好友 | 先添加好友再设置备注 |  |

### setConversationPinned (110)

- 设置会话置顶

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |

### setConversationSilentMode (110,1501)

- 设置会话免打扰

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1501 | SILENT_MODE_OPERATION_FAILED | 免打扰设置失败 | 400 | No | 免打扰参数无效或服务端拒绝 | 检查免打扰参数后重试 |  |

### setGlobalSilentMode (110,1501)

- 设置全局免打扰

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1501 | SILENT_MODE_OPERATION_FAILED | 免打扰设置失败 | 400 | No | 免打扰参数无效或服务端拒绝 | 检查免打扰参数后重试 |  |

### setGroupMemberAttributes (4,210,302,305,602,609-612)

- 设置群成员属性

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 4 | exceed_service_limit | 超过服务限制 | 400 | No | 群成员属性操作超过服务端限制 | 减少操作频率或联系服务端提升配额 |  |
| 210 | permission_denied | 无权限设置群成员属性 | 401 | No | 当前用户无权修改目标成员的属性 | 确认当前用户有权限操作目标成员属性 |  |
| 210 | permission_denied_403 | 无权限设置群成员属性 | 403 | No | 当前用户无权修改目标成员的属性 | 确认当前用户有权限操作目标成员属性 |  |
| 305 | service_disabled | 服务已禁用 | 403 | No | 群成员属性服务未开通或已禁用 | 联系服务端开通群成员属性服务 |  |
| 602 | not_joined | 用户未加入该群组 | 404 | No | 当前用户不在该群组中，无法设置成员属性 | 确认目标用户已加入群组 |  |
| 609 | attributes_reach_limit | 群组成员属性个数超上限 |  | No | 单个成员属性数量超过服务端允许上限 | 减少成员属性条目数量后重试 |  |
| 610 | attributes_update_failed | 群组成员属性更新失败 |  | No | 服务端拒绝写入成员属性，或属性更新过程发生冲突 | 检查属性内容与当前群成员状态后重试 |  |
| 611 | attributes_key_reach_limit | 群组成员属性 key 长度超上限 |  | No | 属性 key 长度超过服务端限制 | 缩短属性 key 后重试 |  |
| 612 | attributes_value_reach_limit | 群组成员属性 value 长度超上限 |  | No | 属性 value 长度超过服务端限制 | 缩短属性 value 后重试 |  |

### setPushLanguage (110,1502)

- 设置推送语言

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1502 | PUSH_LANGUAGE_OPERATION_FAILED | 推送翻译语言设置失败 | 400 | No | 语言参数无效或服务端拒绝 | 检查语言参数后重试 |  |

### subscribePresences (1100,1101)

- 订阅在线状态

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1100 | param_length_exceed | 参数长度超限 | 400 | No | 订阅参数长度超过服务端允许上限 | 减少单次订阅的用户数量 |  |
| 1101 | cannot_subscribe_yourself | 不能订阅自己的在线状态 | 400 | No | 订阅列表中包含当前用户自己 | 从订阅列表中移除当前用户 |  |

### subscribeUsersInfo (4,202,210,303,1600,1601)

- 订阅陌生人资料变化

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 4 | rate_limit | 超过服务限制 | 429 | Yes | 请求过于频繁 | 降低请求频率后重试 |  |
| 202 | unauthorized | 用户鉴权失败 | 401 |  | unauthorized | refresh_token |  |
| 210 | forbidden | 服务未开通或无权限 | 403 |  | service_forbidden | check_service_permission |  |
| 303 | server_unknown_error | 服务请求通用错误：服务端内部错误 | 500 | Yes | server_unknown_error | 稍后重试或联系服务端排查 |  |
| 1600 | subscriber_limit_exceeded | 订阅人数超限 | 400 |  | subscriber_limit_exceeded | reduce_subscription_targets |  |
| 1601 | target_limit_exceeded | 目标用户被订阅人数超限 | 400 |  | target_limit_exceeded | change_subscription_target |  |

### translateMessage (505,1110-1113)

- 翻译消息内容

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1110 | translate_text_too_long | 翻译文本过长 |  |  | The input text is too long. |  |  |
| 1110 | translate_param_invalid | 目标语言不合法 |  |  | The target language is not valid. |  |  |
| 1111 | service_not_enabled | 翻译服务未开通 |  |  |  |  |  |
| 1112 | translate_usage_limit | 翻译服务配额已达上限 |  |  |  |  |  |
| 1113 | translate_failed | 翻译服务异常 |  |  |  |  |  |

### unblockChatRoomMembers (210,606)

- 移除聊天室黑名单

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 210 | group_authorization | 用户无权限：没有移除聊天室黑名单的权限 | 401 | No | 当前用户不是聊天室 owner/admin，无法移除黑名单成员 | 使用聊天室 owner/admin 账号重试 |  |
| 606 | resource_not_found | 聊天室不存在 | 404 | No | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |  |

### unmuteAllChatRoomMembers (210,606)

- 关闭聊天室全员禁言

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 210 | group_authorization | 用户无权限：没有关闭全员禁言的权限 | 401 | No | 当前用户不是聊天室 owner/admin，无法关闭全员禁言 | 使用聊天室 owner/admin 账号重试 |  |
| 606 | resource_not_found | 聊天室不存在 | 404 | No | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |  |

### unmuteChatRoomMembers (210,606)

- 解除聊天室成员禁言

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 210 | group_authorization | 用户无权限：没有解除聊天室成员禁言的权限 | 401 | No | 当前用户不是聊天室 owner/admin，无法解除禁言 | 使用聊天室 owner/admin 账号重试 |  |
| 606 | resource_not_found | 聊天室不存在 | 404 | No | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |  |

### unpinMessage (110)

- 取消置顶消息

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 110 | pin_msg_id_illegal | 消息 ID 非法 |  |  | param pin_msg_id illegal, please check it! |  |  |
| 110 | pin_message_not_found | 待取消置顶消息不存在 |  |  |  |  |  |

### unsubscribePresence (1100)

- 取消订阅在线状态

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1100 | param_length_exceed | 参数长度超限 | 400 | No | 取消订阅参数长度超过服务端允许上限 | 减少单次取消订阅的用户数量 |  |

### unsubscribeUsersInfo (4,202,210,303,1600,1601)

- 取消订阅陌生人资料变化

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 4 | rate_limit | 超过服务限制 | 429 | Yes | 请求过于频繁 | 降低请求频率后重试 |  |
| 202 | unauthorized | 用户鉴权失败 | 401 |  | unauthorized | refresh_token |  |
| 210 | forbidden | 服务未开通或无权限 | 403 |  | service_forbidden | check_service_permission |  |
| 303 | server_unknown_error | 服务请求通用错误：服务端内部错误 | 500 | Yes | server_unknown_error | 稍后重试或联系服务端排查 |  |
| 1600 | subscriber_limit_exceeded | 订阅人数超限 | 400 |  | subscriber_limit_exceeded | reduce_subscription_targets |  |
| 1601 | target_limit_exceeded | 目标用户被订阅人数超限 | 400 |  | target_limit_exceeded | change_subscription_target |  |

### updateChatRoomAnnouncement (110,210,606)

- 更新聊天室公告

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 110 | forbidden_op | 参数无效：聊天室公告长度超限 | 403 | No | 公告长度超过服务端允许上限 | 缩短公告内容后重试 |  |
| 210 | group_authorization | 用户无权限：需要聊天室管理员权限 | 401 | No | 当前用户不是聊天室 owner/admin，无法修改公告 | 使用聊天室 owner/admin 账号重试 |  |
| 606 | resource_not_found | 聊天室不存在 | 404 | No | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |  |

### updateChatRoomInfo (110,210,606)

- 更新聊天室信息

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 110 | forbidden_op | 参数无效：聊天室信息长度或范围超限 | 403 | No | 聊天室名称、描述或最大人数超过服务端限制 | 缩短名称/描述，或传入允许范围内的 maxMembers |  |
| 110 | illegal_argument | 参数无效：聊天室字段不支持修改 | 400 | No | 请求中包含 chatroom_id 等不允许修改的字段 | 仅提交 name、description、maxMembers 等允许修改的字段 |  |
| 210 | group_authorization | 用户无权限：需要聊天室管理员权限 | 401 | No | 当前用户不是聊天室 owner/admin，无法修改聊天室信息 | 使用聊天室 owner/admin 账号重试 |  |
| 606 | resource_not_found | 聊天室不存在 | 404 | No | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 |  |

### updateChatThreadName (110,201,210,301,303,606)

- 更新子区名称

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 201 | not_login | 用户未登录 | 401 | No | 当前用户登录态不可用或 token 无效 | 重新登录后再更新子区名称 |  |
| 210 | permission_denied | 无权限更新子区名称 | 403 | No | 当前用户没有修改目标子区名称的权限 | 使用群主、管理员或有权限的账号重试 |  |
| 301 | request_timeout | 请求服务超时 | 504 | Yes | 服务端处理超时或网络链路超时 | 稍后重试 |  |
| 303 | service_error | 服务请求通用错误 | 500 | Yes | 服务端返回未细分的 Thread 名称更新错误 | 稍后重试或联系服务端排查 |  |
| 606 | resource_not_found | 子区不存在 | 404 | No | chatThreadId 对应子区不存在或已被解散 | 确认子区 ID 正确且子区仍存在 |  |

### updateGroupInfo (110,603,606,607,608)

- 更新群组信息

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 110 | illegal_argument | 参数无效：群组字段不支持修改 | 400 | No | 请求中包含不允许修改的群组字段，或字段长度超出限制 | 仅提交允许修改的字段，并确保字段长度合法 |  |
| 110 | exceed_limit | 参数无效：群组字段长度超限 | 403 | No | 群组名称、描述或扩展信息等字段长度超出服务端限制 | 缩短本次提交的群组字段内容后重试 |  |
| 603 | group_authorization | 无权限的群组操作 | 403 | No | 当前用户不是群主或管理员，无法修改群组信息 | 使用群主或管理员账号重试 |  |
| 603 | forbidden_op | 无权限的群组操作 | 403 | No | 群组状态或当前用户权限不允许执行该更新操作 | 确认当前用户权限与群组状态满足更新要求 |  |
| 606 | resource_not_found | 群组不存在 | 404 | No | groupId 不存在或群组已被销毁 | 确认 groupId 正确且群组仍存在 |  |
| 607 | group_disabled | 群组已禁用 | 403 | No | 群组处于禁用状态，服务端拒绝相关操作 | 先恢复群组可用状态，再重试该操作 |  |
| 608 | group_name_violation | 群组名称无效 | 403 | No | 群组名称触发服务端敏感词或命名规范校验 | 更换为合法群组名称后重试 |  |

### updateMessage (110,111,201,210,300,511)

- 编辑消息

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 110 | message_invalid | 消息无效 |  |  |  |  |  |
| 111 | unsupported_type | 仅支持编辑文本和自定义消息 |  |  |  |  |  |
| 201 | not_login | 未登录 |  |  |  |  |  |
| 210 | permission_denied | 无权编辑该消息 |  |  |  |  |  |
| 300 | not_connected | 未连接服务器 |  |  |  |  |  |
| 511 | edit_failed | 消息编辑失败 |  |  |  |  |  |

### updateOwnUserInfo (4,110,204,901)

- 更新当前用户资料

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 4 | rate_limit | 超过服务限制 | 429 | Yes | 请求过于频繁 | 降低请求频率后重试 |  |
| 204 | resource_not_found | 用户不存在 | 404 | No | 当前用户不存在 | 确认用户已注册 |  |
| 901 | data_length_exceed | 用户资料数据长度超限 | 403 | No | 用户资料字段总长度超过服务端允许上限 | 缩短资料字段内容后重试 |  |

### uploadPushToken (110,1500)

- 上传推送 token

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1500 | TOKEN_UPLOAD_FAILED | Push token 上传失败 | 400 | Yes | 服务端拒绝 push token 绑定请求，或推送通道信息不可用 | 检查登录态、deviceToken 与 notifierName 后重试 |  |

### voiceFileToText (4,110,202,402,407-411,505)

- 本地语音文件转文字

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 4 | service_limit_exceeded | 超过服务限制 |  | Yes | 语音转文字服务用量达到限制 | 稍后重试或提升服务配额 |  |
| 202 | unauthorized | 用户鉴权失败 |  | Yes | 语音转文字服务鉴权失败 | 刷新 token 后重试 |  |
| 402 | upload_failed | 上传文件错误 |  | Yes | 语音文件上传失败 | 检查网络和文件后重试 |  |
| 407 | file_invalid | 语音文件无效 |  | No | 语音文件格式或内容非法 | 更换合法语音文件后重试 |  |
| 408 | duration_too_long | 语音时长超过限制 |  | No | 语音时长超过 60 秒 | 缩短语音时长后重试 |  |
| 409 | voice_to_text_failed | 语音转文字失败 |  | Yes | 语音转文字服务处理失败 | 稍后重试；如果持续失败，联系服务端排查 |  |
| 411 | file_too_large | 语音文件过大 |  | No | 上传语音文件超过服务端大小限制 | 压缩或缩短语音文件后重试 |  |
| 505 | service_not_enabled | 语音转文字服务未开通 |  | No | 当前应用未开通语音转文字服务 | 开通服务后重试 |  |

### voiceMessageToText (4,110,202,407-411,505)

- 语音消息转文字

| Code | Key | Message | HTTP | Retryable | Reason | Action | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 4 | service_limit_exceeded | 超过服务限制 |  | Yes | 语音转文字服务用量达到限制 | 稍后重试或提升服务配额 |  |
| 202 | unauthorized | 用户鉴权失败 |  | Yes | 语音转文字服务鉴权失败 | 刷新 token 后重试 |  |
| 407 | file_invalid | 语音文件无效 |  | No | 语音文件格式或内容非法 | 更换合法语音文件后重试 |  |
| 408 | duration_too_long | 语音时长超过限制 |  | No | 语音时长超过 60 秒 | 缩短语音时长后重试 |  |
| 409 | voice_to_text_failed | 语音转文字失败 |  | Yes | 语音转文字服务处理失败 | 稍后重试；如果持续失败，联系服务端排查 |  |
| 410 | file_not_found | 语音文件不存在 |  | No | 服务端找不到语音文件 | 确认语音文件已上传且未过期 |  |
| 411 | file_too_large | 语音文件过大 |  | No | 上传语音文件超过服务端大小限制 | 压缩或缩短语音文件后重试 |  |
| 505 | service_not_enabled | 语音转文字服务未开通 |  | No | 当前应用未开通语音转文字服务 | 开通服务后重试 |  |
