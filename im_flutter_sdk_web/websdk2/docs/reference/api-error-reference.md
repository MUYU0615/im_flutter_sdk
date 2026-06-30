# API 错误码参考

> 自动生成自 `src/rest/api-errors.json`，请勿手动编辑。
> 生成时间：2026-06-22

## 通用错误码

以下错误码可能出现在任意 API 中（网络超时、鉴权失败等）。

| 分类 | 错误码 | 数值 | 说明 |
|---|---|---|---|
| validation | `MISSING_REQUIRED` | 110 | 参数无效：缺少必填参数 |
| validation | `INVALID_FORMAT` | 110 | 参数无效：格式不正确 |
| validation | `UNKNOWN` | 110 | 参数无效 |
| auth | `ALREADY_LOGIN` | 200 | 用户已登录 |
| auth | `NOT_LOGIN` | 201 | 用户未登录 |
| auth | `UNAUTHORIZED` | 202 | 用户鉴权失败 |
| auth | `FORBIDDEN` | 210 | 用户无权限 |
| auth | `TOKEN_EXPIRED` | 108 | 用户 token 已过期 |
| auth | `BIND_ANOTHER_DEVICE` | 213 | 用户已在其他设备登录 |
| auth | `LOGIN_TOO_MANY_DEVICES` | 214 | 用户登录设备数超过限制 |
| auth | `USER_MUTED` | 215 | 用户被禁言 |
| connection | `TIMEOUT` | 301 | 请求服务超时 |
| connection | `WEBSOCKET_ERROR` | 300 | 服务器不可达 |
| connection | `NOT_CREATED` | 1 | 通用错误 |
| connection | `CLOSED_BEFORE_READY` | 300 | 服务器不可达 |
| connection | `CANCELLED` | 1 | 通用错误：连接已取消 |
| connection | `PROVISION_TIMEOUT` | 301 | 请求服务超时 |
| connection | `PROVISION_REJECTED` | 202 | 用户鉴权失败 |
| connection | `PROVISION_CLOSED` | 300 | 服务器不可达 |
| connection | `DNSLIST_FAILED` | 304 | 获取服务器配置信息错误 |
| connection | `SERVER_BUSY` | 302 | 服务器繁忙 |
| storage | `OPERATION_FAILED` | 3 | 本地存储操作失败 |
| message | `NOT_CONNECTED` | 300 | 服务器不可达 |
| message | `ACK_TIMEOUT` | 301 | 请求服务超时 |
| message | `SEND_FAILED` | 303 | 服务请求通用错误 |
| message | `SENDER_DESTROYED` | 1 | 通用错误：发送器已销毁 |
| message | `ENCODE_FAILED` | 500 | 消息异常：编码失败 |
| message | `DECODE_FAILED` | 500 | 消息异常：解码失败 |
| message | `ACK_MISSING` | 301 | 请求服务超时：ACK 丢失 |
| transport | `NETWORK_ERROR` | 2 | 网络错误 |
| transport | `TIMEOUT` | 301 | 请求服务超时 |
| transport | `HTTP_ERROR` | 303 | 服务请求通用错误 |
| transport | `BUSINESS_UNKNOWN` | 303 | 服务请求通用错误：业务错误未映射 |
| upload | `REQUIRED_FIELD_MISSING` | 110 | 参数无效：缺少必需字段 |
| upload | `INVALID_APPKEY` | 100 | App Key 不合法 |
| upload | `SIZE_EXCEEDED` | 405 | 文件太大 |
| upload | `REQUEST_FAILED` | 402 | 上传文件错误 |
| upload | `TIMEOUT` | 301 | 请求服务超时 |
| upload | `ABORTED` | 1 | 通用错误：上传已取消 |
| unknown | `UNKNOWN` | 1 | 通用错误 |
| unknown | `SERVICE_LIMIT_EXCEEDED` | 4 | 超过服务限制 |
| push | `TOKEN_UPLOAD_FAILED` | 1500 | Push token 上传失败 |
| push | `SILENT_MODE_OPERATION_FAILED` | 1501 | 免打扰设置失败 |
| push | `PUSH_LANGUAGE_OPERATION_FAILED` | 1502 | 推送翻译语言设置失败 |
| chatroom | `CHATROOM_INVALID_ID` | 700 | 聊天室 ID 无效 |
| chatroom | `CHATROOM_NOT_JOINED` | 702 | 未加入聊天室 |
| chatroom | `CHATROOM_PERMISSION_DENIED` | 703 | 聊天室无权限 |
| chatroom | `CHATROOM_MEMBERS_FULL` | 704 | 聊天室成员已满 |
| chatroom | `CHATROOM_NOT_EXIST` | 705 | 聊天室不存在 |
| chatroom | `CHATROOM_OWNER_NOT_ALLOW_LEAVE` | 706 | 聊天室所有者不允许退出 |
| chatroom | `CHATROOM_USER_IN_BLOCKLIST` | 707 | 用户在聊天室黑名单中 |

---

## API 专属错误码

### updateOwnUserInfo

> 更新当前用户资料

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `updateOwnInfo.validation_invalid` | 110 | — | 参数无效 | 没有任何可更新字段，或字段类型非法 | 至少传入一个可更新字段，并确保字段值类型合法 | 否 |
| `updateOwnInfoByAttribute.validation_invalid` | 110 | — | 参数无效 | 属性名或属性值非法 | 仅使用支持的资料属性，并确保属性值类型合法 | 否 |
| `data_length_exceed` | 901 | 403 | 用户资料数据长度超限 | 用户资料字段总长度超过服务端允许上限 | 缩短资料字段内容后重试 | 否 |
| `resource_not_found` | 204 | 404 | 用户不存在 | 当前用户不存在 | 确认用户已注册 | 否 |
| `rate_limit` | 4 | 429 | 超过服务限制 | 请求过于频繁 | 降低请求频率后重试 | 是 |

### getUserInfoByUserId

> 批量获取用户资料

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `getUserInfoByUserId.validation_invalid` | 110 | — | 参数无效 | userIds 为空、不是数组，或包含非法用户 ID | 传入非空用户 ID 数组，并确保每个用户 ID 都是非空字符串 | 否 |
| `usercount_exceed` | 900 | 400 | 批量查询用户数超限 | 单次查询的用户数量超过服务端允许上限 | 减少单次查询的用户数量后重试 | 否 |
| `resource_not_found` | 204 | 404 | 用户不存在 | 查询的用户不存在 | 确认用户 ID 正确 | 否 |
| `rate_limit` | 4 | 429 | 超过服务限制 | 请求过于频繁 | 降低请求频率后重试 | 是 |

### getUserInfoByAttribute

> 按属性批量获取用户资料

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `getUserInfoByAttribute.validation_invalid` | 110 | — | 参数无效 | userIds 或 attributes 为空、不是数组，或包含非法值 | 传入非空用户 ID 数组和非空资料属性数组，并确保属性名属于支持范围 | 否 |
| `usercount_exceed` | 900 | 400 | 批量查询用户数超限 | 单次查询的用户数量超过服务端允许上限 | 减少单次查询的用户数量后重试 | 否 |
| `resource_not_found` | 204 | 404 | 用户不存在 | 查询的用户不存在 | 确认用户 ID 正确 | 否 |
| `rate_limit` | 4 | 429 | 超过服务限制 | 请求过于频繁 | 降低请求频率后重试 | 是 |

### subscribeUsersInfo

> 订阅陌生人资料变化

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `unauthorized` | 202 | 401 | 用户鉴权失败 | unauthorized | refresh_token | — |
| `forbidden` | 210 | 403 | 服务未开通或无权限 (error_description⊃"metadata subscription not allow") | service_forbidden | check_service_permission | — |
| `subscriber_limit_exceeded` | 1600 | 400 | 订阅人数超限 (error_description⊃"metadata subscription count exceeds limit") | subscriber_limit_exceeded | reduce_subscription_targets | — |
| `target_limit_exceeded` | 1601 | 400 | 目标用户被订阅人数超限 (error_description⊃"metadata subscribed count exceeds limit") | target_limit_exceeded | change_subscription_target | — |
| `rate_limit` | 4 | 429 | 超过服务限制 | 请求过于频繁 | 降低请求频率后重试 | 是 |
| `server_unknown_error` | 303 | 500 | 服务请求通用错误：服务端内部错误 | server_unknown_error | 稍后重试或联系服务端排查 | 是 |

### unsubscribeUsersInfo

> 取消订阅陌生人资料变化

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `unauthorized` | 202 | 401 | 用户鉴权失败 | unauthorized | refresh_token | — |
| `forbidden` | 210 | 403 | 服务未开通或无权限 (error_description⊃"metadata subscription not allow") | service_forbidden | check_service_permission | — |
| `subscriber_limit_exceeded` | 1600 | 400 | 订阅人数超限 (error_description⊃"metadata subscription count exceeds limit") | subscriber_limit_exceeded | reduce_subscription_targets | — |
| `target_limit_exceeded` | 1601 | 400 | 目标用户被订阅人数超限 (error_description⊃"metadata subscribed count exceeds limit") | target_limit_exceeded | change_subscription_target | — |
| `rate_limit` | 4 | 429 | 超过服务限制 | 请求过于频繁 | 降低请求频率后重试 | 是 |
| `server_unknown_error` | 303 | 500 | 服务请求通用错误：服务端内部错误 | server_unknown_error | 稍后重试或联系服务端排查 | 是 |

### getSubscribedUsers

> 查询已订阅陌生人资料变化列表

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `unauthorized` | 202 | 401 | 用户鉴权失败 | unauthorized | refresh_token | — |
| `forbidden` | 210 | 403 | 服务未开通或无权限 (error_description⊃"metadata subscription not allow") | service_forbidden | check_service_permission | — |
| `subscriber_limit_exceeded` | 1600 | 400 | 订阅人数超限 (error_description⊃"metadata subscription count exceeds limit") | subscriber_limit_exceeded | reduce_subscription_targets | — |
| `target_limit_exceeded` | 1601 | 400 | 目标用户被订阅人数超限 (error_description⊃"metadata subscribed count exceeds limit") | target_limit_exceeded | change_subscription_target | — |
| `rate_limit` | 4 | 429 | 超过服务限制 | 请求过于频繁 | 降低请求频率后重试 | 是 |
| `server_unknown_error` | 303 | 500 | 服务请求通用错误：服务端内部错误 | server_unknown_error | 稍后重试或联系服务端排查 | 是 |

### addContact

> 添加联系人

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `addContact.validation_invalid` | 110 | — | 参数无效 | userId 为空、不是字符串，或 message 不是字符串 | 传入非空字符串 userId；message 如需传入也必须是字符串 | 否 |
| `USER_NOT_FOUND` | 204 | 404 | 用户不存在 | 目标用户不存在 | 确认用户 ID 正确 | 否 |
| `ALREADY_FRIEND` | 1000 | — | 添加联系人失败：已是好友 | — | — | 否 |
| `BLOCKED_BY_USER` | 210 | — | 用户无权限：被对方拉黑 | — | — | 否 |
| `CONTACT_REACH_LIMIT` | 1001 | 403 | 邀请方联系人数量已达上限 (error_description⊃"Inviter's contact max count") | 当前用户的联系人数量已达服务端上限 | 删除不再使用的联系人后重试，或联系服务端提升配额 | 否 |
| `CONTACT_REACH_LIMIT_PEER` | 1002 | 403 | 被邀请方联系人数量已达上限 (error_description⊃"Invitee's contact max count") | 对方的联系人数量已达服务端上限 | 联系对方清理联系人列表 | 否 |

### deleteContact

> 删除联系人

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `deleteContact.validation_invalid` | 110 | — | 参数无效 | userId 为空或不是字符串 | 传入非空字符串 userId | 否 |
| `USER_NOT_FOUND` | 204 | 404 | 用户不存在 | 目标用户不存在 | 确认用户 ID 正确 | 否 |

### acceptContactInvite

> 接受联系人申请

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `acceptContactInvite.validation_invalid` | 110 | — | 参数无效 | userId 为空或不是字符串 | 传入非空字符串 userId | 否 |
| `USER_NOT_FOUND` | 204 | 404 | 用户不存在 | 目标用户不存在 | 确认用户 ID 正确 | 否 |
| `CONTACT_REACH_LIMIT` | 1001 | 403 | 邀请方联系人数量已达上限 (error_description⊃"Inviter's contact max count") | 当前用户的联系人数量已达服务端上限 | 删除不再使用的联系人后重试 | 否 |
| `CONTACT_REACH_LIMIT_PEER` | 1002 | 403 | 被邀请方联系人数量已达上限 (error_description⊃"Invitee's contact max count") | 对方的联系人数量已达服务端上限 | 联系对方清理联系人列表 | 否 |

### declineContactInvite

> 拒绝联系人申请

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `declineContactInvite.validation_invalid` | 110 | — | 参数无效 | userId 为空或不是字符串 | 传入非空字符串 userId | 否 |
| `USER_NOT_FOUND` | 204 | 404 | 用户不存在 | 目标用户不存在 | 确认用户 ID 正确 | 否 |

### setContactRemark

> 设置联系人备注

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `setContactRemark.validation_invalid` | 110 | — | 参数无效 | userId 为空、不是字符串，或 remark 不是字符串 | 传入非空字符串 userId，并确保 remark 为字符串；可传空字符串清空备注 | 否 |
| `illegal_argument` | 223 | 400 | 非好友不能设置备注 (error_description⊃"please add as a friend first") | 目标用户不是当前用户的好友 | 先添加好友再设置备注 | 否 |
| `remark_length_exceeded` | 4 | 400 | 备注长度超限 (error_description⊃"remark length must less than") | 备注内容超过服务端允许的最大长度 | 缩短备注内容后重试 | 否 |

### addUsersToBlocklist

> 添加黑名单

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `addUsersToBlocklist.validation_invalid` | 110 | — | 参数无效 | userIds 不是非空数组，或数组项不是字符串 | 传入至少一个非空字符串 userId；重复值会由 SDK 去重 | 否 |
| `service_resource_not_found` | 204 | 404 | 黑名单添加失败：目标用户不存在 | 目标用户不存在 | 确认用户 ID 正确 | 否 |
| `blocklist_limit_exceeded` | 4 | 400 | 黑名单数量已达上限 (error_description⊃"almost reached or been greater than the upper range") | 黑名单数量已达服务端上限 | 移除不再需要的黑名单用户后重试 | 否 |

### removeUserFromBlocklist

> 移除黑名单

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `removeUserFromBlocklist.validation_invalid` | 110 | — | 参数无效 | userIds 不是非空数组，或数组项不是字符串 | 传入至少一个非空字符串 userId；重复值会由 SDK 去重 | 否 |

### createGroup

> 创建群组

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `invalid_parameter` | 110 | 400 | 参数无效：缺少创建群组必填参数 | 创建群组时缺少 public、name 等必填字段，或字段格式不符合服务端约束 | 检查创建群组请求体，补齐必填字段并修正字段格式 | 否 |
| `illegal_argument` | 110 | 400 | 参数无效：群组参数不合法 | 群组 ID 冲突、头像字段过长，或请求字段组合不符合服务端要求 | 更换冲突参数，并确保请求字段长度与取值范围合法 | 否 |
| `exceed_limit` | 4 | 403 | 超过服务限制：群组数量或成员数量超限 | 应用可创建群数量、用户可加入群数量或创建群初始成员数量触达服务限制 | 减少创建或加入数量，或联系服务端提升限制 | 否 |
| `group_name_violation` | 608 | 403 | 群组名称无效 | 群组名称触发服务端敏感词或命名规范校验 | 更换为合法群组名称后重试 | 否 |
| `resource_not_found` | 204 | 404 | 用户不存在 | 创建群组时附带的成员列表中包含不存在的用户 | 确认 memberIds 中的用户都已存在 | 否 |

### getGroupInfo

> 获取群组详情

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `resource_not_found` | 606 | 404 | 群组不存在 | groupId 不存在或群组已被销毁 | 确认 groupId 正确且群组仍存在 | 否 |

### getGroupInfoList

> 批量获取群组详情

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `resource_not_found` | 606 | 404 | 群组不存在 | groupIds 中存在无效群组 ID | 确认 groupIds 中的群组都存在 | 否 |

### updateGroupInfo

> 更新群组信息

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `group_authorization` | 603 | 403 | 无权限的群组操作 | 当前用户不是群主或管理员，无法修改群组信息 | 使用群主或管理员账号重试 | 否 |
| `forbidden_op` | 603 | 403 | 无权限的群组操作 | 群组状态或当前用户权限不允许执行该更新操作 | 确认当前用户权限与群组状态满足更新要求 | 否 |
| `illegal_argument` | 110 | 400 | 参数无效：群组字段不支持修改 | 请求中包含不允许修改的群组字段，或字段长度超出限制 | 仅提交允许修改的字段，并确保字段长度合法 | 否 |
| `exceed_limit` | 110 | 403 | 参数无效：群组字段长度超限 | 群组名称、描述或扩展信息等字段长度超出服务端限制 | 缩短本次提交的群组字段内容后重试 | 否 |
| `group_name_violation` | 608 | 403 | 群组名称无效 | 群组名称触发服务端敏感词或命名规范校验 | 更换为合法群组名称后重试 | 否 |
| `resource_not_found` | 606 | 404 | 群组不存在 | groupId 不存在或群组已被销毁 | 确认 groupId 正确且群组仍存在 | 否 |
| `group_disabled` | 607 | 403 | 群组已禁用 | 群组处于禁用状态，服务端拒绝相关操作 | 先恢复群组可用状态，再重试该操作 | 否 |

### changeGroupOwner

> 转让群主

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `forbidden_op` | 603 | 403 | 无权限的群组操作 | 新群主不在群组中、与旧群主相同，或当前用户没有转让群主权限 | 传入有效的新群主成员 ID，并使用当前群主账号重试 | 否 |
| `resource_not_found` | 606 | 404 | 群组不存在 | groupId 不存在或群组已被销毁 | 确认 groupId 正确且群组仍存在 | 否 |

### destroyGroup

> 解散群组

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `group_authorization` | 603 | 403 | 无权限的群组操作 | 当前用户不是群主，无法解散群组 | 使用群主账号重试 | 否 |
| `resource_not_found` | 606 | 404 | 群组不存在 | groupId 不存在或群组已被销毁 | 确认 groupId 正确且群组仍存在 | 否 |
| `group_disabled` | 607 | 403 | 群组已禁用 | 群组状态异常，服务端拒绝继续处理该群组写操作 | 确认群组状态后再重试 | 否 |

### leaveGroup

> 退出群组

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `not_joined` | 602 | — | 用户未加入该群组 | 当前用户不在该群组中，无法执行退出操作 | 确认当前用户已加入目标群组 | 否 |
| `owner_cannot_leave` | 603 | 403 | 群主不能退出群组 (error_description⊃"owner can not quit group") | 群主不允许直接退出群组，需先转让群主或解散群组 | 先调用 changeGroupOwner 转让群主，再退出群组 | 否 |
| `resource_not_found` | 606 | 404 | 群组不存在 | groupId 不存在或群组已被销毁 | 确认 groupId 正确且群组仍存在 | 否 |

### getChatRoomInfo

> 获取聊天室详情

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `resource_not_found` | 606 | 404 | 聊天室不存在 | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 | 否 |

### updateChatRoomInfo

> 更新聊天室信息

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `group_authorization` | 210 | 401 | 用户无权限：需要聊天室管理员权限 | 当前用户不是聊天室 owner/admin，无法修改聊天室信息 | 使用聊天室 owner/admin 账号重试 | 否 |
| `forbidden_op` | 110 | 403 | 参数无效：聊天室信息长度或范围超限 | 聊天室名称、描述或最大人数超过服务端限制 | 缩短名称/描述，或传入允许范围内的 maxMembers | 否 |
| `illegal_argument` | 110 | 400 | 参数无效：聊天室字段不支持修改 | 请求中包含 chatroom_id 等不允许修改的字段 | 仅提交 name、description、maxMembers 等允许修改的字段 | 否 |
| `resource_not_found` | 606 | 404 | 聊天室不存在 | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 | 否 |

### destroyChatRoom

> 销毁聊天室

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `group_authorization` | 210 | 401 | 用户无权限：需要聊天室所有者权限 | 当前用户没有销毁聊天室的权限 | 使用聊天室 owner 账号重试 | 否 |
| `resource_not_found` | 606 | 404 | 聊天室不存在 | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 | 否 |

### joinChatRoom

> 加入聊天室

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `exceed_limit` | 4 | 403 | 超过服务限制：加入聊天室数量超限 | 当前用户已加入过多聊天室，服务端拒绝继续加入 | 退出不再使用的聊天室后重试，或联系服务端提升限制 | 否 |
| `members_full` | 704 | 403 | 聊天室成员已满 (error_description⊃"member list is full") | 聊天室人数已达上限，无法继续加入 | 等待其他成员退出后重试，或联系聊天室管理员提升上限 | 否 |
| `user_in_blocklist` | 707 | 403 | 用户在聊天室黑名单中 (error_description⊃"is in the blacklist") | 当前用户已被加入聊天室黑名单，无法加入 | 联系聊天室管理员将用户从黑名单移除 | 否 |
| `resource_not_found` | 606 | 404 | 聊天室不存在 | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 | 否 |

### leaveChatRoom

> 退出聊天室

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `resource_not_found` | 606 | 404 | 聊天室不存在 | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 | 否 |

### getChatRoomMemberList

> 获取聊天室成员列表

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `resource_not_found` | 606 | 404 | 聊天室不存在 | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 | 否 |

### addChatRoomMembers

> 添加聊天室成员

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `illegal_argument` | 110 | 400 | 参数无效：聊天室成员参数不合法 | userIds 为空、重复或包含非法用户标识 | 检查 userIds 列表，确保为非空合法用户 ID | 否 |
| `group_authorization` | 210 | 401 | 用户无权限：没有添加聊天室成员的权限 | 当前用户不是聊天室 owner/admin，无法添加成员 | 使用聊天室 owner/admin 账号重试 | 否 |
| `resource_not_found` | 606 | 404 | 聊天室不存在 | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 | 否 |
| `service_resource_not_found` | 204 | 404 | 用户不存在 | 待加入聊天室的用户不存在 | 确认 userIds 中的用户都已存在 | 否 |

### removeChatRoomMembers

> 移除聊天室成员

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `group_authorization` | 210 | 401 | 用户无权限：没有移除聊天室成员的权限 | 当前用户不是聊天室 owner/admin，无法移除成员 | 使用聊天室 owner/admin 账号重试 | 否 |
| `resource_not_found` | 606 | 404 | 聊天室不存在 | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 | 否 |

### getChatRoomAdminList

> 获取聊天室管理员列表

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `resource_not_found` | 606 | 404 | 聊天室不存在 | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 | 否 |

### setChatRoomAdmin

> 设置聊天室管理员

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `group_authorization` | 210 | 401 | 用户无权限：只有聊天室所有者可设置管理员 | 当前用户不是聊天室所有者，无法设置管理员 | 使用聊天室 owner 账号重试 | 否 |
| `resource_not_found` | 606 | 404 | 聊天室不存在 | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 | 否 |
| `service_resource_not_found` | 204 | 404 | 用户不存在 | 待设置为管理员的用户不存在 | 确认 userId 对应用户存在 | 否 |

### removeChatRoomAdmin

> 移除聊天室管理员

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `group_authorization` | 210 | 401 | 用户无权限：只有聊天室所有者可移除管理员 | 当前用户不是聊天室所有者，无法移除管理员 | 使用聊天室 owner 账号重试 | 否 |
| `resource_not_found` | 606 | 404 | 聊天室不存在 | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 | 否 |

### getChatRoomMuteList

> 获取聊天室禁言列表

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `resource_not_found` | 606 | 404 | 聊天室不存在 | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 | 否 |

### muteChatRoomMembers

> 禁言聊天室成员

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `illegal_argument` | 110 | 400 | 参数无效：聊天室禁言参数不合法 | muteDuration、userIds 或请求体字段不符合服务端约束 | 检查 userIds 与 muteDuration，确保传入有效值 | 否 |
| `group_authorization` | 210 | 401 | 用户无权限：没有禁言聊天室成员的权限 | 当前用户不是聊天室 owner/admin，无法禁言成员 | 使用聊天室 owner/admin 账号重试 | 否 |
| `resource_not_found` | 606 | 404 | 聊天室不存在 | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 | 否 |

### unmuteChatRoomMembers

> 解除聊天室成员禁言

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `group_authorization` | 210 | 401 | 用户无权限：没有解除聊天室成员禁言的权限 | 当前用户不是聊天室 owner/admin，无法解除禁言 | 使用聊天室 owner/admin 账号重试 | 否 |
| `resource_not_found` | 606 | 404 | 聊天室不存在 | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 | 否 |

### muteAllChatRoomMembers

> 开启聊天室全员禁言

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `group_authorization` | 210 | 401 | 用户无权限：没有开启全员禁言的权限 | 当前用户不是聊天室 owner/admin，无法开启全员禁言 | 使用聊天室 owner/admin 账号重试 | 否 |
| `resource_not_found` | 606 | 404 | 聊天室不存在 | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 | 否 |

### unmuteAllChatRoomMembers

> 关闭聊天室全员禁言

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `group_authorization` | 210 | 401 | 用户无权限：没有关闭全员禁言的权限 | 当前用户不是聊天室 owner/admin，无法关闭全员禁言 | 使用聊天室 owner/admin 账号重试 | 否 |
| `resource_not_found` | 606 | 404 | 聊天室不存在 | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 | 否 |

### isCurrentUserMutedInChatRoom

> 查询当前用户聊天室禁言状态

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `resource_not_found` | 606 | 404 | 聊天室不存在 | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 | 否 |

### getChatRoomBlocklist

> 获取聊天室黑名单

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `resource_not_found` | 606 | 404 | 聊天室不存在 | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 | 否 |

### blockChatRoomMembers

> 添加聊天室黑名单

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `group_authorization` | 210 | 401 | 用户无权限：没有添加聊天室黑名单的权限 | 当前用户不是聊天室 owner/admin，无法拉黑成员 | 使用聊天室 owner/admin 账号重试 | 否 |
| `resource_not_found` | 606 | 404 | 聊天室不存在 | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 | 否 |
| `service_resource_not_found` | 204 | 404 | 用户不存在 | 待加入黑名单的用户不存在 | 确认 userIds 中的用户都已存在 | 否 |

### unblockChatRoomMembers

> 移除聊天室黑名单

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `group_authorization` | 210 | 401 | 用户无权限：没有移除聊天室黑名单的权限 | 当前用户不是聊天室 owner/admin，无法移除黑名单成员 | 使用聊天室 owner/admin 账号重试 | 否 |
| `resource_not_found` | 606 | 404 | 聊天室不存在 | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 | 否 |

### getChatRoomAllowlist

> 获取聊天室 allowlist

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `resource_not_found` | 606 | 404 | 聊天室不存在 | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 | 否 |

### addUsersToChatRoomAllowlist

> 添加聊天室 allowlist

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `group_authorization` | 210 | 401 | 用户无权限：没有添加聊天室 allowlist 的权限 | 当前用户不是聊天室 owner/admin，无法修改 allowlist | 使用聊天室 owner/admin 账号重试 | 否 |
| `resource_not_found` | 606 | 404 | 聊天室不存在 | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 | 否 |
| `service_resource_not_found` | 204 | 404 | 用户不存在 | 待加入 allowlist 的用户不存在 | 确认 userIds 中的用户都已存在 | 否 |

### removeUsersFromChatRoomAllowlist

> 移除聊天室 allowlist

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `group_authorization` | 210 | 401 | 用户无权限：没有移除聊天室 allowlist 的权限 | 当前用户不是聊天室 owner/admin，无法修改 allowlist | 使用聊天室 owner/admin 账号重试 | 否 |
| `resource_not_found` | 606 | 404 | 聊天室不存在 | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 | 否 |

### checkIfInChatRoomAllowList

> 查询当前用户是否在聊天室 allowlist 中

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `resource_not_found` | 606 | 404 | 聊天室不存在 | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 | 否 |

### getChatRoomAnnouncement

> 获取聊天室公告

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `resource_not_found` | 606 | 404 | 聊天室不存在 | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 | 否 |

### updateChatRoomAnnouncement

> 更新聊天室公告

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `group_authorization` | 210 | 401 | 用户无权限：需要聊天室管理员权限 | 当前用户不是聊天室 owner/admin，无法修改公告 | 使用聊天室 owner/admin 账号重试 | 否 |
| `forbidden_op` | 110 | 403 | 参数无效：聊天室公告长度超限 | 公告长度超过服务端允许上限 | 缩短公告内容后重试 | 否 |
| `resource_not_found` | 606 | 404 | 聊天室不存在 | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 | 否 |

### getChatRoomSharedFileList

> 获取聊天室共享文件列表

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `resource_not_found` | 606 | 404 | 聊天室不存在 | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 | 否 |

### deleteChatRoomSharedFile

> 删除聊天室共享文件

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `group_authorization` | 210 | 401 | 用户无权限：没有删除聊天室共享文件的权限 | 当前用户不是聊天室 owner/admin，无法删除共享文件 | 使用聊天室 owner/admin 账号重试 | 否 |
| `resource_not_found` | 606 | 404 | 聊天室不存在 | chatRoomId 不存在、聊天室已被销毁，或共享文件不存在 | 确认 chatRoomId 与 fileId 正确且资源仍存在 | 否 |

### getChatRoomAttributes

> 获取聊天室属性

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `illegal_argument` | 110 | 400 | 参数无效：属性 key 列表不合法 | keys 为空字符串、包含非法值，或请求体格式不符合要求 | 确保 keys 为合法非空字符串数组，或省略 keys 获取全部属性 | 否 |
| `resource_not_found` | 606 | 404 | 聊天室不存在 | chatRoomId 不存在或聊天室已被销毁 | 确认 chatRoomId 正确且聊天室仍存在 | 否 |

### setChatRoomAttributes

> 设置聊天室属性

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `illegal_argument` | 110 | 400 | 参数无效：聊天室属性数量或字段不合法 | 属性 key 数量超过限制，或属性字段格式不符合要求 | 确保每次设置的属性数量不超过限制，且 key/value 均为合法字符串 | 否 |
| `chatroom_not_joined` | 702 | 400 | 未加入聊天室 (error_code=60011) | 当前用户未加入目标聊天室，无法设置属性 | 先加入聊天室后重试 | 否 |
| `chatroom_permission_denied` | 703 | 400 | 聊天室属性权限拒绝 (error_code=60010) | 当前用户无权设置目标属性（属性不属于当前用户且未使用 forced 模式） | 仅修改自己创建的属性，或使用 forced 模式覆盖 | 否 |
| `exceed_limit` | 4 | 400 | 聊天室属性数量或总量超限 (error_code=60012) | 单个聊天室属性数量或应用级属性总量超过服务端限制 | 删除不再使用的属性后重试，或联系服务端提升配额 | 否 |
| `MetadataException` | 210 | 401 | 用户无权限：聊天室属性写入被拒绝 | 当前用户不在聊天室内，或试图修改其他用户的聊天室属性 | 确认当前用户已加入聊天室，并仅修改自己有权限操作的属性 | 否 |

### setChatRoomAttribute

> 设置单个聊天室属性

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `illegal_argument` | 110 | 400 | 参数无效：聊天室属性字段不合法 | 属性 key/value 非法，或字段格式不符合要求 | 确保 key/value 为合法非空字符串 | 否 |
| `chatroom_not_joined` | 702 | 400 | 未加入聊天室 (error_code=60011) | 当前用户未加入目标聊天室，无法设置属性 | 先加入聊天室后重试 | 否 |
| `chatroom_permission_denied` | 703 | 400 | 聊天室属性权限拒绝 (error_code=60010) | 当前用户无权设置目标属性 | 仅修改自己创建的属性，或使用 forced 模式覆盖 | 否 |
| `exceed_limit` | 4 | 400 | 聊天室属性数量或总量超限 (error_code=60012) | 单个聊天室属性数量或应用级属性总量超过服务端限制 | 删除不再使用的属性后重试 | 否 |
| `MetadataException` | 210 | 401 | 用户无权限：聊天室属性写入被拒绝 | 当前用户不在聊天室内，或试图修改其他用户的聊天室属性 | 确认当前用户已加入聊天室，并仅修改自己有权限操作的属性 | 否 |

### removeChatRoomAttributes

> 删除聊天室属性

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `illegal_argument` | 110 | 400 | 参数无效：聊天室属性 key 列表不合法 | 属性 key 数量超过限制，或 keys 字段格式不符合要求 | 确保每次删除的属性数量不超过限制，且 keys 为合法非空字符串数组 | 否 |
| `chatroom_not_joined` | 702 | 400 | 未加入聊天室 (error_code=60011) | 当前用户未加入目标聊天室，无法删除属性 | 先加入聊天室后重试 | 否 |
| `chatroom_permission_denied` | 703 | 400 | 聊天室属性权限拒绝 (error_code=60010) | 当前用户无权删除目标属性 | 仅删除自己创建的属性，或使用 forced 模式 | 否 |
| `exceed_limit` | 4 | 400 | 聊天室属性操作超限 (error_code=60012) | 属性操作超过服务端限制 | 减少单次操作的属性数量 | 否 |
| `MetadataException` | 210 | 401 | 用户无权限：聊天室属性删除被拒绝 | 当前用户不在聊天室内，或无权删除目标属性 | 确认当前用户已加入聊天室，并仅删除自己有权限操作的属性 | 否 |

### removeChatRoomAttribute

> 删除单个聊天室属性

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `illegal_argument` | 110 | 400 | 参数无效：聊天室属性 key 不合法 | 属性 key 为空或格式不符合要求 | 确保 key 为合法非空字符串 | 否 |
| `chatroom_not_joined` | 702 | 400 | 未加入聊天室 (error_code=60011) | 当前用户未加入目标聊天室，无法删除属性 | 先加入聊天室后重试 | 否 |
| `chatroom_permission_denied` | 703 | 400 | 聊天室属性权限拒绝 (error_code=60010) | 当前用户无权删除目标属性 | 仅删除自己创建的属性，或使用 forced 模式 | 否 |
| `exceed_limit` | 4 | 400 | 聊天室属性操作超限 (error_code=60012) | 属性操作超过服务端限制 | 减少操作频率 | 否 |
| `MetadataException` | 210 | 401 | 用户无权限：聊天室属性删除被拒绝 | 当前用户不在聊天室内，或无权删除目标属性 | 确认当前用户已加入聊天室，并仅删除自己有权限操作的属性 | 否 |

### joinGroup

> 加入群组

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `group_invalid_id` | 600 | — | 群组 ID 无效 | 传入的 groupId 为空、格式不合法或不符合服务端约束 | 检查并传入合法的 groupId | 否 |
| `already_joined` | 601 | — | 已在该群组中 | 当前用户已经加入目标群组 | 无需重复加入，直接使用现有群组上下文 | 否 |
| `not_joined` | 602 | — | 用户未加入该群组 | 当前用户不在该群组中，或服务端要求当前用户先成为群成员 | 确认当前用户已加入目标群组 | 否 |
| `group_authorization` | 603 | 403 | 无权限的群组操作 | 加入群组需要管理员审批，或当前用户没有权限加入目标群组 | 等待管理员审批，或改用有权限的账号重试 | 否 |
| `group_full` | 604 | 403 | 群组成员超上限 (error_description⊃"member list is full") | 目标群组人数已达到上限，无法继续加入 | 清理群成员或提升群人数上限后重试 | 否 |
| `resource_not_found` | 606 | 404 | 群组不存在 | groupId 不存在或群组已被销毁 | 确认 groupId 正确且群组仍存在 | 否 |
| `group_disabled` | 607 | — | 群组已禁用 | 目标群组处于禁用状态，服务端拒绝加入 | 确认群组状态恢复正常后再尝试加入 | 否 |
| `group_user_in_blocklist` | 613 | 403 | 用户已被群禁言列表拦截 (error_description⊃"is in the blacklist") | 当前用户处于群组黑名单或禁入名单中，服务端拒绝加入 | 联系群主或管理员移出对应名单后重试 | 否 |

### inviteUsersToGroup

> 邀请用户入群

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `group_authorization` | 603 | 400 | 无权限的群组操作 | 当前用户没有邀请成员入群的权限 | 使用有邀请权限的账号重试 | 否 |
| `resource_not_found` | 204 | 404 | 用户不存在 | 被邀请用户不存在 | 确认 userIds 中的用户都已存在 | 否 |
| `group_not_found` | 606 | — | 群组不存在 | 目标群组不存在或已被销毁 | 确认 groupId 正确且群组仍存在 | 否 |
| `group_disabled` | 607 | — | 群组已禁用 | 目标群组处于禁用状态，服务端拒绝邀请入群 | 确认群组状态恢复正常后再重试 | 否 |

### getGroupMemberList

> 获取群成员列表

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `resource_not_found` | 606 | 404 | 群组不存在 | groupId 不存在或群组已被销毁 | 确认 groupId 正确且群组仍存在 | 否 |

### getGroupAdminList

> 获取群管理员列表

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `resource_not_found` | 606 | 404 | 群组不存在 | groupId 不存在或群组已被销毁 | 确认 groupId 正确且群组仍存在 | 否 |

### getGroupMuteList

> 获取群禁言列表

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `resource_not_found` | 606 | 404 | 群组不存在 | groupId 不存在或群组已被销毁 | 确认 groupId 正确且群组仍存在 | 否 |

### getGroupBlocklist

> 获取群黑名单

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `resource_not_found` | 606 | 404 | 群组不存在 | groupId 不存在或群组已被销毁 | 确认 groupId 正确且群组仍存在 | 否 |

### getGroupAllowlist

> 获取群 allowlist

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `resource_not_found` | 606 | 404 | 群组不存在 | groupId 不存在或群组已被销毁 | 确认 groupId 正确且群组仍存在 | 否 |

### getGroupAnnouncement

> 获取群公告

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `resource_not_found` | 606 | 404 | 群组不存在 | groupId 不存在或群组已被销毁 | 确认 groupId 正确且群组仍存在 | 否 |

### getGroupSharedFileList

> 获取群共享文件列表

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `resource_not_found` | 606 | 404 | 群组不存在 | groupId 不存在或群组已被销毁 | 确认 groupId 正确且群组仍存在 | 否 |

### deleteGroupSharedFile

> 删除群共享文件

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `group_authorization` | 603 | — | 无权限的群组操作 | 当前用户没有删除群共享文件的权限 | 使用群主、管理员或文件所有者账号重试 | 否 |
| `file_not_found` | 605 | — | 群共享文件 ID 无效 | fileId 不存在或对应的群共享文件已被删除 | 确认 fileId 正确且共享文件仍存在 | 否 |
| `resource_not_found` | 606 | — | 群组不存在 | groupId 不存在或群组已被销毁 | 确认 groupId 正确且群组仍存在 | 否 |

### setGroupMemberAttributes

> 设置群成员属性

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `attributes_reach_limit` | 609 | — | 群组成员属性个数超上限 (error_code=60006) | 单个成员属性数量超过服务端允许上限 | 减少成员属性条目数量后重试 | 否 |
| `attributes_update_failed` | 610 | — | 群组成员属性更新失败 (error_code=60005) | 服务端拒绝写入成员属性，或属性更新过程发生冲突 | 检查属性内容与当前群成员状态后重试 | 否 |
| `attributes_key_reach_limit` | 611 | — | 群组成员属性 key 长度超上限 (error_code=60009) | 属性 key 长度超过服务端限制 | 缩短属性 key 后重试 | 否 |
| `attributes_value_reach_limit` | 612 | — | 群组成员属性 value 长度超上限 (error_code=600010) | 属性 value 长度超过服务端限制 | 缩短属性 value 后重试 | 否 |
| `not_joined` | 602 | 404 | 用户未加入该群组 (error_code=60003) | 当前用户不在该群组中，无法设置成员属性 | 确认目标用户已加入群组 | 否 |
| `permission_denied` | 210 | 401 | 无权限设置群成员属性 (error_code=60001) | 当前用户无权修改目标成员的属性 | 确认当前用户有权限操作目标成员属性 | 否 |
| `permission_denied_403` | 210 | 403 | 无权限设置群成员属性 (error_code=60002) | 当前用户无权修改目标成员的属性 | 确认当前用户有权限操作目标成员属性 | 否 |
| `exceed_service_limit` | 4 | 400 | 超过服务限制 (error_code=60007) | 群成员属性操作超过服务端限制 | 减少操作频率或联系服务端提升配额 | 否 |
| `service_disabled` | 305 | 403 | 服务已禁用 (error_code=60004) | 群成员属性服务未开通或已禁用 | 联系服务端开通群成员属性服务 | 否 |

### getGroupMembersAttributes

> 批量获取群成员属性

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `resource_not_found` | 606 | — | 群组不存在 | groupId 不存在或群组已被销毁 | 确认 groupId 正确且群组仍存在 | 否 |

### sendMessage

> 发送消息

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `sendMessage.validation_invalid` | 110 | — | 参数无效 | 消息发送者缺失、发送者与当前用户不一致，或尝试发送当前不支持的流式消息 | 先通过 ChatManager 的 create*Message 方法创建消息，并确保当前用户与消息 sender.userId 一致 | 否 |
| `sendMessage.not_connected` | 300 | — | 服务器不可达 | 发送消息时 SDK 未连接到消息服务器 | 等待连接成功后重试 | 是 |
| `sendMessage.encode_failed` | 500 | — | 消息异常：编码失败 | 消息内容无法编码为协议数据 | 检查消息体、扩展字段和附件信息是否合法 | 否 |
| `MESSAGE_BLOCKED` | 1200 | — | 第三方内容审核拒绝 | — | — | — |
| `USER_MUTED` | 215 | — | 用户被禁言 | — | — | — |

### createTextMessage

> 创建文本消息

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `createTextMessage.validation_invalid` | 110 | — | 参数无效 | 会话 ID、会话类型、文本内容、扩展字段或定向接收配置非法 | 传入合法的 conversationId、conversationType 和非空 content；receiverList 与 needGroupReadReceipt 仅用于群聊 | 否 |

### createImageMessage

> 创建图片消息

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `createImageMessage.validation_invalid` | 110 | — | 参数无效 | 会话参数非法，或图片消息缺少 data/originalUrl，或文件、宽高、文件大小字段非法 | 至少传入 data 或 originalUrl，并确保图片元数据为合法类型和值 | 否 |

### createFileMessage

> 创建文件消息

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `createFileMessage.validation_invalid` | 110 | — | 参数无效 | 会话参数非法，或文件消息缺少 data/originalUrl，或文件名、文件类型、文件大小字段非法 | 至少传入 data 或 originalUrl，并确保文件元数据合法 | 否 |

### createVoiceMessage

> 创建语音消息

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `createVoiceMessage.validation_invalid` | 110 | — | 参数无效 | 会话参数非法，或语音消息缺少 data/originalUrl，或 duration、文件信息非法 | 至少传入 data 或 originalUrl，并传入大于 0 的 duration | 否 |

### createVideoMessage

> 创建视频消息

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `createVideoMessage.validation_invalid` | 110 | — | 参数无效 | 会话参数非法，或视频消息缺少 data/originalUrl，或 duration、宽高、文件信息非法 | 至少传入 data 或 originalUrl，并传入大于 0 的 duration | 否 |

### createLocationMessage

> 创建位置消息

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `createLocationMessage.validation_invalid` | 110 | — | 参数无效 | 会话参数非法，或经纬度、地址、建筑名称字段非法 | 传入合法的 conversationId、conversationType、latitude 和 longitude | 否 |

### createCmdMessage

> 创建命令消息

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `createCmdMessage.validation_invalid` | 110 | — | 参数无效 | 会话参数非法，或 action 为空 | 传入合法的 conversationId、conversationType 和非空 action | 否 |

### createCustomMessage

> 创建自定义消息

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `createCustomMessage.validation_invalid` | 110 | — | 参数无效 | 会话参数非法，或 event、params 字段非法 | 传入合法的 conversationId、conversationType 和非空 event；params 使用字符串键值 | 否 |

### createCombineMessage

> 创建合并消息

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `createCombineMessage.validation_invalid` | 110 | — | 参数无效 | 会话参数非法，或 title、summary、messageList 为空，或合并消息条目格式非法 | 传入合法的标题、摘要和 1 到 300 条可合并消息 | 否 |
| `createCombineMessage.combine_level_exceeded` | 4 | — | 超过服务限制 | 合并消息嵌套层级超过 SDK 限制 | 减少合并消息嵌套层级后重试 | 否 |
| `createCombineMessage.combine_encode_failed` | 500 | — | 消息异常：编码失败 | 合并消息内容无法编码 | 检查被合并消息的消息体和扩展字段是否合法 | 否 |

### publishPresence

> 发布在线状态

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `PRESENCE_PARAM_EXCEED` | 1100 | 400 | 发布自定义在线状态时，参数长度超出限制 | 在线状态扩展描述信息长度超过服务端允许上限 | 缩短 customStatus 后重试 | 否 |

### subscribePresences

> 订阅在线状态

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `cannot_subscribe_yourself` | 1101 | 400 | 不能订阅自己的在线状态 (result⊃"you can't sub yourself") | 订阅列表中包含当前用户自己 | 从订阅列表中移除当前用户 | 否 |
| `param_length_exceed` | 1100 | 400 | 参数长度超限 | 订阅参数长度超过服务端允许上限 | 减少单次订阅的用户数量 | 否 |

### unsubscribePresence

> 取消订阅在线状态

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `param_length_exceed` | 1100 | 400 | 参数长度超限 | 取消订阅参数长度超过服务端允许上限 | 减少单次取消订阅的用户数量 | 否 |

### getSubscribedPresenceList

> 查询在线状态订阅列表

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `param_length_exceed` | 1100 | 400 | 参数长度超限 | 分页参数超过服务端允许上限 | 调整 pageNum 或 pageSize 后重试 | 否 |

### getPresenceStatus

> 查询在线状态

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `param_length_exceed` | 1100 | 400 | 参数长度超限 | 查询参数长度超过服务端允许上限 | 减少单次查询的用户数量 | 否 |

### setGlobalSilentMode

> 设置全局免打扰

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `setGlobalSilentMode.validation_invalid` | 110 | — | 参数无效 | 免打扰规则参数非法，或同一个 mode 下传入了互斥字段 | 按 REMIND_TYPE、DURATION 或 INTERVAL 选择一种规则模式，并传入对应必填字段 | 否 |
| `SILENT_MODE_OPERATION_FAILED` | 1501 | 400 | 免打扰设置失败 | 免打扰参数无效或服务端拒绝 | 检查免打扰参数后重试 | 否 |

### setConversationSilentMode

> 设置会话免打扰

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `setConversationSilentMode.validation_invalid` | 110 | — | 参数无效 | conversationId 为空、type 不是 singleChat/groupChat，或免打扰规则参数非法 | 传入合法会话 ID、会话类型，并按 REMIND_TYPE、DURATION 或 INTERVAL 选择一种规则模式 | 否 |
| `SILENT_MODE_OPERATION_FAILED` | 1501 | 400 | 免打扰设置失败 | 免打扰参数无效或服务端拒绝 | 检查免打扰参数后重试 | 否 |

### setPushLanguage

> 设置推送语言

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `setPushLanguage.validation_invalid` | 110 | — | 参数无效 | language 为空或不是字符串 | 传入非空语言标识，例如 zh-Hans 或 en | 否 |
| `PUSH_LANGUAGE_OPERATION_FAILED` | 1502 | 400 | 推送翻译语言设置失败 | 语言参数无效或服务端拒绝 | 检查语言参数后重试 | 否 |

### uploadPushToken

> 上传推送 token

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `uploadPushToken.validation_invalid` | 110 | — | 参数无效 | deviceId、deviceToken 或 notifierName 为空或不是字符串 | 传入非空 deviceId、deviceToken 和 notifierName | 否 |
| `TOKEN_UPLOAD_FAILED` | 1500 | 400 | Push token 上传失败 | 服务端拒绝 push token 绑定请求，或推送通道信息不可用 | 检查登录态、deviceToken 与 notifierName 后重试 | 是 |

### getGlobalSilentMode

> 获取全局免打扰

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `SILENT_MODE_OPERATION_FAILED` | 1501 | — | 免打扰设置失败 | — | — | — |

### getConversationSilentMode

> 获取会话免打扰

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `getConversationSilentMode.validation_invalid` | 110 | — | 参数无效 | conversationId 为空，或 type 不是 singleChat/groupChat | 传入合法会话 ID，并使用 singleChat 或 groupChat | 否 |
| `SILENT_MODE_OPERATION_FAILED` | 1501 | — | 免打扰设置失败 | — | — | — |

### clearConversationRemindType

> 清除会话提醒类型

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `clearConversationRemindType.validation_invalid` | 110 | — | 参数无效 | conversationId 为空，或 type 不是 singleChat/groupChat | 传入合法会话 ID，并使用 singleChat 或 groupChat | 否 |
| `SILENT_MODE_OPERATION_FAILED` | 1501 | — | 免打扰设置失败 | — | — | — |

### getConversationSilentModes

> 批量获取会话免打扰

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `getConversationSilentModes.validation_invalid` | 110 | — | 参数无效 | conversationList 为空、超过 20 条，或包含非法会话 ID/类型 | 传入 1 到 20 个会话，并确保每项包含非空 id 与 singleChat/groupChat 类型 | 否 |
| `SILENT_MODE_OPERATION_FAILED` | 1501 | — | 免打扰设置失败 | — | — | — |

### getConversationListByRemindType

> 分页获取免打扰会话

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `getConversationListByRemindType.validation_invalid` | 110 | — | 参数无效 | pageSize 不是正整数，或 cursor 不是 SDK 返回的本地分页游标 | 传入正整数 pageSize，并使用上一次返回的 cursor | 否 |

### getConversationList

> 获取会话列表

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `getConversationList.validation_invalid` | 110 | — | 参数无效 | 分页游标、pageSize 或 includeEmptyConversations 类型非法 | 使用 SDK 上一次返回的 cursor，并确保 pageSize 为正整数、includeEmptyConversations 为布尔值 | 否 |

### getPinnedConversationList

> 获取置顶会话列表

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `getPinnedConversationList.validation_invalid` | 110 | — | 参数无效 | 分页游标、pageSize 或 includeEmptyConversations 类型非法 | 使用 SDK 上一次返回的 cursor，并确保 pageSize 为正整数、includeEmptyConversations 为布尔值 | 否 |

### getConversationListByMark

> 按标记获取会话列表

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `getConversationListByMark.validation_invalid` | 110 | — | 参数无效 | mark 不是 0 到 19 之间的整数，或分页参数非法 | 传入 0 到 19 之间的整数 mark，并使用合法分页参数 | 否 |

### deleteConversation

> 删除会话

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `deleteConversation.validation_invalid` | 110 | — | 参数无效 | conversationId、conversationType 或 deleteRoamingMessages 参数非法 | 传入合法会话 ID、会话类型，并确保 deleteRoamingMessages 为布尔值 | 否 |

### setConversationPinned

> 设置会话置顶

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `setConversationPinned.validation_invalid` | 110 | — | 参数无效 | conversationId、conversationType 或 pinned 参数非法 | 传入合法会话 ID、会话类型，并确保 pinned 为布尔值 | 否 |

### addConversationMark

> 添加会话标记

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `addConversationMark.validation_invalid` | 110 | — | 参数无效 | mark 不是 0 到 19 之间的整数，或会话目标列表非法 | 传入合法 mark，并确保 conversations 为非空数组或传入单个合法会话 | 否 |

### removeConversationMark

> 移除会话标记

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `removeConversationMark.validation_invalid` | 110 | — | 参数无效 | mark 不是 0 到 19 之间的整数，或会话目标列表非法 | 传入合法 mark，并确保 conversations 为非空数组或传入单个合法会话 | 否 |

### createChatThread

> 创建子区

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `createChatThread.validation_invalid` | 110 | — | 参数无效 | parentId、name 或 messageId 为空或格式非法 | 传入有效的父群组 ID、子区名称和父消息 ID | 否 |
| `not_login` | 201 | 401 | 用户未登录 | 当前用户登录态不可用或 token 无效 | 重新登录后再创建子区 | 否 |
| `permission_denied` | 210 | 403 | 无权限创建子区 | 当前用户不在父群组中，或服务端未开通 Thread 能力 | 确认当前用户已加入父群组，并检查控制台 Thread 能力开通状态 | 否 |
| `resource_not_found` | 606 | 404 | 群组或父消息不存在 | parentId 对应群组不存在，或 messageId 对应父消息不存在 | 确认父群组和父消息仍存在后重试 | 否 |
| `service_limit_exceeded` | 4 | 400 | 超过服务限制 | 子区数量或创建频率超过服务端限制 | 减少创建频率，清理不需要的子区，或联系服务端提升配额 | 否 |
| `request_timeout` | 301 | 504 | 请求服务超时 | 服务端处理超时或网络链路超时 | 稍后重试 | 是 |
| `service_error` | 303 | 500 | 服务请求通用错误 | 服务端返回未细分的 Thread 创建错误 | 稍后重试或联系服务端排查 | 是 |

### getChatThreadList

> 获取子区列表

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `getChatThreadList.validation_invalid` | 110 | — | 参数无效 | parentId 为空，pageSize 不是 1 到 50 之间的整数，或 cursor 类型非法 | 传入有效的父群组 ID、分页大小和游标 | 否 |
| `not_login` | 201 | 401 | 用户未登录 | 当前用户登录态不可用或 token 无效 | 重新登录后再查询子区列表 | 否 |
| `permission_denied` | 210 | 403 | 无权限查询子区列表 | 当前用户无权访问目标群组的子区列表 | 确认当前用户已加入父群组 | 否 |
| `resource_not_found` | 606 | 404 | 群组不存在 | parentId 对应群组不存在或已被解散 | 确认父群组 ID 正确且群组仍存在 | 否 |
| `request_timeout` | 301 | 504 | 请求服务超时 | 服务端处理超时或网络链路超时 | 稍后重试 | 是 |
| `service_error` | 303 | 500 | 服务请求通用错误 | 服务端返回未细分的 Thread 列表查询错误 | 稍后重试或联系服务端排查 | 是 |

### getJoinedChatThreadList

> 获取已加入子区列表

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `getJoinedChatThreadList.validation_invalid` | 110 | — | 参数无效 | pageSize 不是 1 到 50 之间的整数，cursor 类型非法，或 parentId 类型非法 | 传入有效的分页参数；如指定 parentId，应传入非空字符串 | 否 |
| `not_login` | 201 | 401 | 用户未登录 | 当前用户登录态不可用或 token 无效 | 重新登录后再查询已加入子区 | 否 |
| `permission_denied` | 210 | 403 | 无权限查询已加入子区 | 当前用户无权访问目标群组的已加入子区列表 | 确认当前用户已加入目标群组 | 否 |
| `resource_not_found` | 606 | 404 | 群组不存在 | 指定 parentId 时，目标群组不存在或已被解散 | 确认父群组 ID 正确且群组仍存在 | 否 |
| `request_timeout` | 301 | 504 | 请求服务超时 | 服务端处理超时或网络链路超时 | 稍后重试 | 是 |
| `service_error` | 303 | 500 | 服务请求通用错误 | 服务端返回未细分的已加入 Thread 查询错误 | 稍后重试或联系服务端排查 | 是 |

### getChatThreadInfo

> 获取子区详情

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `getChatThreadInfo.validation_invalid` | 110 | — | 参数无效 | chatThreadId 为空或格式非法 | 传入有效的子区 ID | 否 |
| `getInfo.validation_invalid` | 110 | — | 参数无效 | ChatThread 实体绑定的 chatThreadId 为空或格式非法 | 通过有效的 chatThreadId 创建 ChatThread 实体 | 否 |
| `refresh.validation_invalid` | 110 | — | 参数无效 | ChatThread 实体绑定的 chatThreadId 为空或格式非法 | 通过有效的 chatThreadId 创建 ChatThread 实体 | 否 |
| `not_login` | 201 | 401 | 用户未登录 | 当前用户登录态不可用或 token 无效 | 重新登录后再查询子区详情 | 否 |
| `permission_denied` | 210 | 403 | 无权限查询子区详情 | 当前用户无权访问目标子区 | 确认当前用户已加入父群组或目标子区 | 否 |
| `resource_not_found` | 606 | 404 | 子区不存在 | chatThreadId 对应子区不存在或已被解散 | 确认子区 ID 正确且子区仍存在 | 否 |
| `request_timeout` | 301 | 504 | 请求服务超时 | 服务端处理超时或网络链路超时 | 稍后重试 | 是 |
| `service_error` | 303 | 500 | 服务请求通用错误 | 服务端返回未细分的 Thread 详情查询错误 | 稍后重试或联系服务端排查 | 是 |

### joinChatThread

> 加入子区

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `joinChatThread.validation_invalid` | 110 | — | 参数无效 | chatThreadId 为空或格式非法 | 传入有效的子区 ID | 否 |
| `join.validation_invalid` | 110 | — | 参数无效 | ChatThread 实体绑定的 chatThreadId 为空或格式非法 | 通过有效的 chatThreadId 创建 ChatThread 实体 | 否 |
| `not_login` | 201 | 401 | 用户未登录 | 当前用户登录态不可用或 token 无效 | 重新登录后再加入子区 | 否 |
| `permission_denied` | 210 | 403 | 无权限加入子区 | 当前用户不在父群组中，或服务端拒绝加入目标子区 | 确认当前用户已加入父群组且目标子区可加入 | 否 |
| `resource_not_found` | 606 | 404 | 子区不存在 | chatThreadId 对应子区不存在或已被解散 | 确认子区 ID 正确且子区仍存在 | 否 |
| `service_limit_exceeded` | 4 | 400 | 超过服务限制 | 加入子区频率或数量超过服务端限制 | 减少操作频率或联系服务端提升配额 | 否 |
| `request_timeout` | 301 | 504 | 请求服务超时 | 服务端处理超时或网络链路超时 | 稍后重试 | 是 |
| `service_error` | 303 | 500 | 服务请求通用错误 | 服务端返回未细分的 Thread 加入错误 | 稍后重试或联系服务端排查 | 是 |

### leaveChatThread

> 退出子区

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `leaveChatThread.validation_invalid` | 110 | — | 参数无效 | chatThreadId 为空或格式非法 | 传入有效的子区 ID | 否 |
| `leave.validation_invalid` | 110 | — | 参数无效 | ChatThread 实体绑定的 chatThreadId 为空或格式非法 | 通过有效的 chatThreadId 创建 ChatThread 实体 | 否 |
| `not_login` | 201 | 401 | 用户未登录 | 当前用户登录态不可用或 token 无效 | 重新登录后再退出子区 | 否 |
| `permission_denied` | 210 | 403 | 无权限退出子区 | 服务端拒绝当前用户退出目标子区 | 确认当前用户已加入目标子区且允许退出 | 否 |
| `resource_not_found` | 606 | 404 | 子区不存在 | chatThreadId 对应子区不存在或已被解散 | 确认子区 ID 正确且子区仍存在 | 否 |
| `request_timeout` | 301 | 504 | 请求服务超时 | 服务端处理超时或网络链路超时 | 稍后重试 | 是 |
| `service_error` | 303 | 500 | 服务请求通用错误 | 服务端返回未细分的 Thread 退出错误 | 稍后重试或联系服务端排查 | 是 |

### destroyChatThread

> 解散子区

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `destroyChatThread.validation_invalid` | 110 | — | 参数无效 | chatThreadId 为空或格式非法 | 传入有效的子区 ID | 否 |
| `destroy.validation_invalid` | 110 | — | 参数无效 | ChatThread 实体绑定的 chatThreadId 为空或格式非法 | 通过有效的 chatThreadId 创建 ChatThread 实体 | 否 |
| `not_login` | 201 | 401 | 用户未登录 | 当前用户登录态不可用或 token 无效 | 重新登录后再解散子区 | 否 |
| `permission_denied` | 210 | 403 | 无权限解散子区 | 当前用户不是群主、管理员或子区创建者，服务端拒绝解散 | 使用有管理权限的账号重试 | 否 |
| `resource_not_found` | 606 | 404 | 子区不存在 | chatThreadId 对应子区不存在或已被解散 | 确认子区 ID 正确且子区仍存在 | 否 |
| `request_timeout` | 301 | 504 | 请求服务超时 | 服务端处理超时或网络链路超时 | 稍后重试 | 是 |
| `service_error` | 303 | 500 | 服务请求通用错误 | 服务端返回未细分的 Thread 解散错误 | 稍后重试或联系服务端排查 | 是 |

### updateChatThreadName

> 更新子区名称

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `updateChatThreadName.validation_invalid` | 110 | — | 参数无效 | chatThreadId 或 name 为空或格式非法 | 传入有效的子区 ID 和新名称 | 否 |
| `updateName.validation_invalid` | 110 | — | 参数无效 | ChatThread 实体绑定的 chatThreadId 为空，或 name 为空/格式非法 | 通过有效的 chatThreadId 创建实体，并传入有效的新名称 | 否 |
| `not_login` | 201 | 401 | 用户未登录 | 当前用户登录态不可用或 token 无效 | 重新登录后再更新子区名称 | 否 |
| `permission_denied` | 210 | 403 | 无权限更新子区名称 | 当前用户没有修改目标子区名称的权限 | 使用群主、管理员或有权限的账号重试 | 否 |
| `resource_not_found` | 606 | 404 | 子区不存在 | chatThreadId 对应子区不存在或已被解散 | 确认子区 ID 正确且子区仍存在 | 否 |
| `request_timeout` | 301 | 504 | 请求服务超时 | 服务端处理超时或网络链路超时 | 稍后重试 | 是 |
| `service_error` | 303 | 500 | 服务请求通用错误 | 服务端返回未细分的 Thread 名称更新错误 | 稍后重试或联系服务端排查 | 是 |

### getChatThreadMemberList

> 获取子区成员列表

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `getChatThreadMemberList.validation_invalid` | 110 | — | 参数无效 | chatThreadId 为空，pageSize 不是 1 到 50 之间的整数，或 cursor 类型非法 | 传入有效的子区 ID、分页大小和游标 | 否 |
| `getMemberList.validation_invalid` | 110 | — | 参数无效 | ChatThread 实体绑定的 chatThreadId 为空，或分页参数非法 | 通过有效的 chatThreadId 创建实体，并传入有效分页参数 | 否 |
| `not_login` | 201 | 401 | 用户未登录 | 当前用户登录态不可用或 token 无效 | 重新登录后再查询子区成员 | 否 |
| `permission_denied` | 210 | 403 | 无权限查询子区成员 | 当前用户无权访问目标子区成员列表 | 确认当前用户已加入父群组或目标子区 | 否 |
| `resource_not_found` | 606 | 404 | 子区不存在 | chatThreadId 对应子区不存在或已被解散 | 确认子区 ID 正确且子区仍存在 | 否 |
| `request_timeout` | 301 | 504 | 请求服务超时 | 服务端处理超时或网络链路超时 | 稍后重试 | 是 |
| `service_error` | 303 | 500 | 服务请求通用错误 | 服务端返回未细分的 Thread 成员列表查询错误 | 稍后重试或联系服务端排查 | 是 |

### removeChatThreadMember

> 移除子区成员

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `removeChatThreadMember.validation_invalid` | 110 | — | 参数无效 | chatThreadId 或 memberId 为空或格式非法 | 传入有效的子区 ID 和成员 ID | 否 |
| `removeMember.validation_invalid` | 110 | — | 参数无效 | ChatThread 实体绑定的 chatThreadId 为空，或 memberId 为空/格式非法 | 通过有效的 chatThreadId 创建实体，并传入有效成员 ID | 否 |
| `not_login` | 201 | 401 | 用户未登录 | 当前用户登录态不可用或 token 无效 | 重新登录后再移除子区成员 | 否 |
| `permission_denied` | 210 | 403 | 无权限移除子区成员 | 当前用户没有移除目标子区成员的权限 | 使用群主、管理员或有权限的账号重试 | 否 |
| `resource_not_found` | 606 | 404 | 子区或成员不存在 | chatThreadId 对应子区不存在，或 memberId 不是子区成员 | 确认子区和目标成员关系仍存在 | 否 |
| `request_timeout` | 301 | 504 | 请求服务超时 | 服务端处理超时或网络链路超时 | 稍后重试 | 是 |
| `service_error` | 303 | 500 | 服务请求通用错误 | 服务端返回未细分的 Thread 成员移除错误 | 稍后重试或联系服务端排查 | 是 |

### getChatThreadLastMessageList

> 批量获取子区最后一条消息

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `getChatThreadLastMessageList.validation_invalid` | 110 | — | 参数无效 | chatThreadIds 为空、不是数组、超过 20 个，或包含非法子区 ID | 传入 1 到 20 个有效的子区 ID | 否 |
| `not_login` | 201 | 401 | 用户未登录 | 当前用户登录态不可用或 token 无效 | 重新登录后再查询子区最后消息 | 否 |
| `permission_denied` | 210 | 403 | 无权限查询子区最后消息 | 当前用户无权访问一个或多个目标子区 | 确认当前用户有权限访问传入的所有子区 | 否 |
| `resource_not_found` | 606 | 404 | 子区不存在 | 一个或多个 chatThreadId 对应子区不存在或已被解散 | 确认子区 ID 正确且子区仍存在 | 否 |
| `request_timeout` | 301 | 504 | 请求服务超时 | 服务端处理超时或网络链路超时 | 稍后重试 | 是 |
| `service_error` | 303 | 500 | 服务请求通用错误 | 服务端返回未细分的 Thread 最后消息查询错误 | 稍后重试或联系服务端排查 | 是 |

### getPushLanguage

> 获取推送翻译语言

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `PUSH_LANGUAGE_OPERATION_FAILED` | 1502 | — | 推送翻译语言设置失败 | — | — | — |

### markConversationRead

> 标记会话已读

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `markConversationRead.validation_invalid` | 110 | — | 参数无效 | conversationId 为空或 conversationType 非法 | 传入合法会话 ID，并使用 singleChat、groupChat 或 chatRoom | 否 |
| `not_login` | 201 | — | 未登录 | — | — | — |
| `not_connected` | 300 | — | 未连接服务器 | — | — | — |
| `message_invalid` | 500 | — | 会话中无消息 | — | — | — |

### markMessageRead

> 批量标记消息已读

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `markMessageRead.validation_invalid` | 110 | — | 参数无效 | messages 为空、消息缺少服务端 ID 或会话 ID、消息不是收到的单聊/群聊消息、消息不属于同一会话，或单聊消息传入 ackContent | 传入非空 messages，确保每条都是收到的 singleChat 或 groupChat 消息，包含 msgServerId 与 conversationId，且全部属于同一会话；ackContent 仅用于 groupChat | 否 |
| `invalid_direction` | 110 | — | 只能对接收的消息发送已读回执 | — | — | — |
| `not_connected` | 300 | — | 未连接服务器 | — | — | — |

### recallMessage

> 撤回消息

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `recallMessage.validation_invalid` | 110 | — | 参数无效 | conversationId、conversationType 或 messageId 参数非法 | 传入合法会话定位参数和待撤回消息 ID | 否 |
| `message_invalid` | 110 | — | 消息无效或未发送成功 | — | — | — |
| `not_login` | 201 | — | 未登录 | — | — | — |
| `not_connected` | 300 | — | 未连接服务器 | — | — | — |
| `recall_time_limit` | 504 | — | 超过撤回时间限制 | — | — | — |
| `recall_disabled` | 505 | — | 撤回功能未开通 | — | — | — |

### updateMessage

> 编辑消息

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `modifyMessage.validation_invalid` | 110 | — | 参数无效 | conversationId、conversationType 或 messageId 参数非法 | 传入合法会话定位参数和待编辑消息 ID | 否 |
| `modifyMessage.unsupported_type` | 111 | — | 操作不支持 | 当前仅支持编辑文本消息和自定义消息 | 仅传入 type 为 text 或 custom 的消息内容 | 否 |
| `message_invalid` | 110 | — | 消息无效 | — | — | — |
| `unsupported_type` | 111 | — | 仅支持编辑文本和自定义消息 | — | — | — |
| `not_login` | 201 | — | 未登录 | — | — | — |
| `permission_denied` | 210 | — | 无权编辑该消息 | — | — | — |
| `not_connected` | 300 | — | 未连接服务器 | — | — | — |
| `edit_failed` | 511 | — | 消息编辑失败 | — | — | — |

### downloadMessageAttachment

> 下载消息附件

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `downloadAttachment.validation_invalid` | 401 | — | 附件无效或消息类型不支持下载 | 消息不包含可下载附件，或附件 URL 缺失 | 仅对包含远程附件地址的图片、语音、视频或文件消息调用 | 否 |
| `not_found` | 400 | 404 | 附件不存在 | — | — | — |
| `invalid` | 401 | — | 附件无效或消息类型不支持下载 | — | — | — |
| `download_failed` | 403 | — | 附件下载失败 | — | — | — |
| `expired` | 407 | 404 | 附件已过期 | — | — | — |

### downloadAndParseCombineMessage

> 下载合并消息

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `downloadAndParseCombineMessage.validation_invalid` | 110 | — | 参数无效 | 传入消息不是合并消息，或合并消息/最小下载参数缺少下载地址 | 传入 type 为 combine 且包含有效 url 的消息，或直接传入合并消息体中的有效 url/secret | 否 |
| `invalid_param` | 110 | — | 消息为空 | — | — | — |
| `invalid_type` | 500 | — | 消息不是合并消息类型 | — | — | — |
| `parse_failed` | 401 | — | 合并消息解析失败 | — | — | — |
| `download_failed` | 403 | — | 合并消息下载失败 | — | — | — |

### getHistoryMessages

> 获取历史消息

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `getHistoryMessages.validation_invalid` | 110 | — | 参数无效 | conversationId、conversationType 或 pageSize 参数非法 | 传入合法会话定位参数，并确保 pageSize 为正整数 | 否 |
| `service_not_enabled` | 505 | — | 消息漫游服务未开通 | this appKey not open message roaming | — | — |
| `page_size_exceeded` | 110 | — | 分页参数超限 | — | — | — |

### removeHistoryMessages

> 删除历史消息

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `removeHistoryMessages.validation_invalid` | 110 | — | 参数无效 | 缺少 messageIds/beforeTimestamp，或 messageIds 为空，或 beforeTimestamp 不是正整数 | 传入非空 messageIds，或传入大于 0 的 beforeTimestamp | 否 |
| `service_not_enabled` | 505 | — | 消息漫游服务未开通 | this appKey not open message roaming | — | — |
| `query_param_reaches_limit` | 112 | — | 删除消息数量超限 | — | — | — |

### getGroupMessageReadUsers

> 获取群消息已读成员

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `getGroupMessageReadUsers.validation_invalid` | 110 | — | 参数无效 | groupId、messageId 为空，或 pageSize 不是正整数 | 传入合法 groupId、messageId，并确保 pageSize 为正整数 | 否 |
| `message_not_found` | 500 | — | 消息不存在 | — | — | — |

### addReaction

> 添加消息 Reaction

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `addReaction.validation_invalid` | 110 | — | 参数无效 | messageId 或 reaction 为空 | 传入合法 messageId 和非空 reaction | 否 |
| `reaction_already_operated` | 1301 | — | 当前用户已经操作过该 Reaction | the user is already operation this message | — | — |
| `reaction_reach_limit` | 1300 | — | Reaction 数量达到上限 | The quantity has exceeded the limit! | — | — |
| `group_not_joined` | 602 | — | 当前用户不在该群组中 | The user not in this group! | — | — |
| `reaction_operation_illegal` | 1302 | — | Reaction 操作非法 | the user operation is illegal! | — | — |
| `service_not_enabled` | 505 | — | Reaction 服务未开通 | this appKey is not open reaction service! | — | — |
| `server_busy` | 302 | — | Reaction 服务繁忙 | this message is creating reaction, please try again. | — | — |

### removeReaction

> 删除消息 Reaction

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `removeReaction.validation_invalid` | 110 | — | 参数无效 | messageId 或 reaction 为空 | 传入合法 messageId 和非空 reaction | 否 |
| `service_not_enabled` | 505 | — | Reaction 服务未开通 | this appKey is not open reaction service! | — | — |
| `reaction_operation_illegal` | 1302 | — | Reaction 操作非法 | the user operation is illegal! | — | — |

### getReactionList

> 获取消息 Reaction 列表

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `getReactionList.validation_invalid` | 110 | — | 参数无效 | messageId 为空，或群聊查询缺少 groupId | 传入合法 messageId；conversationType 为 groupChat 时同时传入 groupId | 否 |
| `service_not_enabled` | 505 | — | Reaction 服务未开通 | this appKey is not open reaction service! | — | — |
| `group_invalid_id` | 600 | — | groupId 无效 | groupId can not be null! | — | — |

### getReactionDetail

> 获取消息 Reaction 详情

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `getReactionDetail.validation_invalid` | 110 | — | 参数无效 | messageId、reaction 为空，或 pageSize 不是正整数 | 传入合法 messageId、非空 reaction，并确保 pageSize 为正整数 | 否 |
| `service_not_enabled` | 505 | — | Reaction 服务未开通 | this appKey is not open reaction service! | — | — |
| `reaction_operation_illegal` | 1302 | — | Reaction 操作非法 | the user operation is illegal! | — | — |

### pinMessage

> 置顶消息

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `pin_msg_id_illegal` | 110 | — | 消息 ID 非法 | param pin_msg_id illegal, please check it! | — | — |
| `pin_message_limit` | 4 | — | 置顶消息数量达到上限 | — | — | — |
| `pin_message_not_found` | 110 | — | 待置顶消息不存在 | — | — | — |

### unpinMessage

> 取消置顶消息

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `pin_msg_id_illegal` | 110 | — | 消息 ID 非法 | param pin_msg_id illegal, please check it! | — | — |
| `pin_message_not_found` | 110 | — | 待取消置顶消息不存在 | — | — | — |

### getPinnedMessageList

> 获取置顶消息列表

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `operation_unsupported` | 111 | — | 当前服务端不支持获取置顶消息列表 | — | — | — |
| `pin_message_not_found` | 110 | — | 置顶消息不存在 | — | — | — |

### getSupportedTranslationLanguages

> 获取翻译支持语言

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `service_not_enabled` | 505 | — | 翻译服务未开通 | — | — | — |

### translateMessage

> 翻译消息内容

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `translateMessage.validation_invalid` | 1110 | — | 目标语言不合法 | 消息不是文本消息、文本内容为空，或 targetLanguages 为空/包含非法语言代码 | 仅传入包含非空文本内容的文本消息，并指定至少一个合法目标语言代码 | 否 |
| `translate_text_too_long` | 1110 | — | 翻译文本过长 | The input text is too long. | — | — |
| `translate_param_invalid` | 1110 | — | 目标语言不合法 | The target language is not valid. | — | — |
| `service_not_enabled` | 1111 | — | 翻译服务未开通 | — | — | — |
| `translate_usage_limit` | 1112 | — | 翻译服务配额已达上限 | — | — | — |
| `translate_failed` | 1113 | — | 翻译服务异常 | — | — | — |

### voiceMessageToText

> 语音消息转文字

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `voiceMessageToText.validation_invalid` | 407 | — | 语音文件无效 | 语音消息体格式非法、语音 URL 缺失，或语音识别参数类型非法 | 传入带有效 url 的语音消息体，并确保 format、sampleRate、bitsPerSample、channels 类型合法 | 否 |
| `voiceMessageToText.file_not_found` | 410 | — | 语音文件不存在 | 语音消息体中没有可识别的文件 ID | 确认语音消息已成功上传且 url 有效 | 否 |
| `unauthorized` | 202 | — | 用户鉴权失败 | 语音转文字服务鉴权失败 | 刷新 token 后重试 | 是 |
| `file_not_found` | 410 | — | 语音文件不存在 | 服务端找不到语音文件 | 确认语音文件已上传且未过期 | 否 |
| `file_invalid` | 407 | — | 语音文件无效 | 语音文件格式或内容非法 | 更换合法语音文件后重试 | 否 |
| `duration_too_long` | 408 | — | 语音时长超过限制 | 语音时长超过 60 秒 | 缩短语音时长后重试 | 否 |
| `file_too_large` | 411 | — | 语音文件过大 | 上传语音文件超过服务端大小限制 | 压缩或缩短语音文件后重试 | 否 |
| `service_not_enabled` | 505 | — | 语音转文字服务未开通 | 当前应用未开通语音转文字服务 | 开通服务后重试 | 否 |
| `service_limit_exceeded` | 4 | — | 超过服务限制 | 语音转文字服务用量达到限制 | 稍后重试或提升服务配额 | 是 |
| `voice_to_text_failed` | 409 | — | 语音转文字失败 | 语音转文字服务处理失败 | 稍后重试；如果持续失败，联系服务端排查 | 是 |

### voiceFileToText

> 本地语音文件转文字

| 错误键 | 错误码 | HTTP | 说明 | 原因 | 处理建议 | 可重试 |
|---|---|---|---|---|---|---|
| `voiceFileToText.validation_invalid` | 407 | — | 语音文件无效 | 本地文件对象非法，或语音识别参数类型非法 | 传入浏览器 File 或小程序 MiniAppFile，并确保语音识别参数类型合法 | 否 |
| `voiceFileToText.upload_required` | 110 | — | 参数无效：缺少必需字段 | 当前平台缺少上传能力 | 在支持上传的环境中调用，或为当前平台配置上传适配器 | 否 |
| `unauthorized` | 202 | — | 用户鉴权失败 | 语音转文字服务鉴权失败 | 刷新 token 后重试 | 是 |
| `upload_failed` | 402 | — | 上传文件错误 | 语音文件上传失败 | 检查网络和文件后重试 | 是 |
| `file_invalid` | 407 | — | 语音文件无效 | 语音文件格式或内容非法 | 更换合法语音文件后重试 | 否 |
| `duration_too_long` | 408 | — | 语音时长超过限制 | 语音时长超过 60 秒 | 缩短语音时长后重试 | 否 |
| `file_too_large` | 411 | — | 语音文件过大 | 上传语音文件超过服务端大小限制 | 压缩或缩短语音文件后重试 | 否 |
| `service_not_enabled` | 505 | — | 语音转文字服务未开通 | 当前应用未开通语音转文字服务 | 开通服务后重试 | 否 |
| `service_limit_exceeded` | 4 | — | 超过服务限制 | 语音转文字服务用量达到限制 | 稍后重试或提升服务配额 | 是 |
| `voice_to_text_failed` | 409 | — | 语音转文字失败 | 语音转文字服务处理失败 | 稍后重试；如果持续失败，联系服务端排查 | 是 |
