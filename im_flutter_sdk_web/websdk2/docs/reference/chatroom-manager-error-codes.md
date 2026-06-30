# ChatRoomManager 错误码对照文档

> 基于移动端 C++ SDK（emclient-linux）`emchatroommanager.cpp` + `emmucmanager.cpp` 源码分析。
>
> 生成时间：2026-04-28

---

## 一、聊天室域错误码总表

| 移动端错误码 | 数值 | 含义 | Web SDK 映射建议 |
|---|---|---|---|
| `EM_NO_ERROR` | 0 | 无错误 | — |
| `GENERAL_ERROR` | 1 | 通用错误 | `UNKNOWN` |
| `NETWORK_ERROR` | 2 | 网络不可用 | `CONNECTION_WEBSOCKET_ERROR` |
| `EXCEED_SERVICE_LIMIT` | 4 | 超出服务限制 | `SERVICE_LIMIT_EXCEEDED` |
| `PARTIAL_SUCCESS` | 7 | 部分成功（属性批量操作） | 需新增 |
| `INVALID_PARAM` | 110 | 参数无效 | `VALIDATION_REQUIRED` |
| `QUERY_PARAM_REACHES_LIMIT` | 112 | 查询参数超限 | `SERVICE_LIMIT_EXCEEDED` |
| `USER_NOT_LOGIN` | 201 | 未登录 | `AUTH_NOT_LOGIN` |
| `USER_AUTHENTICATION_FAILED` | 202 | 鉴权失败 | `AUTH_UNAUTHORIZED` |
| `USER_ILLEGAL_ARGUMENT` | 205 | 非法参数 | `VALIDATION_INVALID_FORMAT` |
| `SERVER_NOT_REACHABLE` | 300 | 服务器不可达 | `CONNECTION_WEBSOCKET_ERROR` |
| `SERVER_BUSY` | 302 | 服务器繁忙 | 需新增 |
| `SERVER_UNKNOWN_ERROR` | 303 | 服务器未知错误 | `REST_BUSINESS_UNKNOWN` |
| `FILE_TOO_LARGE` | 405 | 文件过大 | 需新增 |
| `CHATROOM_INVALID_ID` | 700 | 聊天室 ID 无效 | 需新增 |
| `CHATROOM_ALREADY_JOINED` | 701 | 已加入聊天室 | 需新增 |
| `CHATROOM_NOT_JOINED` | 702 | 未加入聊天室 | 需新增 |
| `CHATROOM_PERMISSION_DENIED` | 703 | 聊天室无权限 | 需新增 |
| `CHATROOM_MEMBERS_FULL` | 704 | 聊天室成员已满 | 需新增 |
| `CHATROOM_NOT_EXIST` | 705 | 聊天室不存在 | 需新增 |
| `CHATROOM_OWNER_NOT_ALLOW_LEAVE` | 706 | 聊天室所有者不允许退出 | 需新增 |
| `CHATROOM_USER_IN_BLOCKLIST` | 707 | 用户在聊天室黑名单中 | 需新增 |

---

## 二、通用错误处理函数分析

聊天室域有两层错误处理：`EMChatroomManager::processGeneralRESTResponseError`（属性 API 专用）和 `EMMucManager::processGeneralRESTResponseError`（其余 REST API 共用）。

### 2.1 EMChatroomManager::processGeneralRESTResponseError（属性 API 专用）

此函数用于 `addChatRoomMetaData` / `fetchChatRoomMetaFromSever` / `removeChatRoomMetaFromSever`。

判断逻辑：先解析 JSON 中的 `error`（字符串）和 `error_code`（整数），再按 HTTP 状态码分支：

```
HTTP 400:
  error_code == 60010 → CHATROOM_PERMISSION_DENIED (703)
  error_code == 60011 → CHATROOM_NOT_JOINED (702)
  error_code == 60012 → QUERY_PARAM_REACHES_LIMIT (112)
  其他 → SERVER_UNKNOWN_ERROR (303)

HTTP 401:
  首次 → 刷新 token 重试
  重试后仍 401 → USER_AUTHENTICATION_FAILED (202)

HTTP 403 → SERVER_UNKNOWN_ERROR (303)
HTTP 404 → CHATROOM_NOT_EXIST (705)
HTTP 503 → SERVER_BUSY (302)

RETRY_HOST / NEXT_HOST:
  首次 → 切换备用地址重试
  重试后仍失败 → SERVER_NOT_REACHABLE (300)

其他 → SERVER_UNKNOWN_ERROR (303)
```

### 2.2 EMMucManager::processGeneralRESTResponseError（通用 REST）

此函数用于聊天室的创建、详情、成员管理、角色管理、禁言、黑名单、allowlist、公告等 REST API。

判断逻辑：先解析 `error_description` 做字符串匹配，再按 HTTP 状态码分支：

```
优先匹配 error_description（任何 HTTP 状态码）:
  包含 "forbidden_op" 或 "group_authorization" 或 "owner can not leave" → CHATROOM_PERMISSION_DENIED (703)

HTTP 404 → CHATROOM_INVALID_ID (700)

HTTP 401:
  首次 → 刷新 token 重试
  重试后仍 401 → USER_AUTHENTICATION_FAILED (202)

HTTP 403:
  error == "announce info length exceeds limit!" → USER_ILLEGAL_ARGUMENT (205)
  error_description 包含 "member list is full" → CHATROOM_MEMBERS_FULL (704)
  error_description 包含 "is in the blacklist" → CHATROOM_USER_IN_BLOCKLIST (707)
  其他 → CHATROOM_PERMISSION_DENIED (703)

HTTP 413 → FILE_TOO_LARGE (405)
HTTP 429 → EXCEED_SERVICE_LIMIT (4)
HTTP 503 → SERVER_BUSY (302)

HTTP 400:
  error == "illegal_argument" → CHATROOM_INVALID_ID (700)
  error == "invalid_parameter" → INVALID_PARAM (110)

其他 → SERVER_NOT_REACHABLE (300)，切换备用地址重试
```

### 2.3 getValidJoinedChatroomById（前置校验）

大多数聊天室操作 API 在发起 REST 请求前，先调用此方法做前置校验：

```
1. chatroomId 为空 → CHATROOM_INVALID_ID (700)
2. 本地未找到已加入的聊天室 → 远程拉取详情
   2a. 拉取成功但当前用户不是成员 → CHATROOM_NOT_JOINED (702)
   2b. 拉取失败 → 透传 fetchChatroomSpecification 的错误
3. 本地已找到 → checkSessionStatusValid:
   3a. 未登录 → USER_NOT_LOGIN (201)
   3b. 无网络 → NETWORK_ERROR (2)
```

### 2.4 checkSessionStatusValid（会话状态校验）

```
未登录 → USER_NOT_LOGIN (201)
网络类型为 NONE → NETWORK_ERROR (2)
```

### 2.5 属性批量操作 parserKeyValues（部分成功/失败判定）

属性写入/删除的响应中包含 `successKeys` 和 `errorKeys`，判定逻辑：

```
successKeys + errorKeys 总数 > 1（批量操作）:
  successKeys == 0 → INVALID_PARAM (110)，failureKeys 携带每个 key 的具体错误码
  successKeys > 0 且 errorKeys 非空 → PARTIAL_SUCCESS (7)
  errorKeys 为空 → EM_NO_ERROR

successKeys + errorKeys 总数 <= 1（单个操作）:
  errorKeys 非空 → 按 mapRoomAttributesFailureErrorDescToCode 映射具体错误码
  errorKeys 为空 → EM_NO_ERROR
```

### 2.6 mapRoomAttributesFailureErrorDescToCode（属性错误描述映射）

对 `errorKeys` 中每个 key 的 value（错误描述字符串）做匹配：

```
包含 "is exceeding maximum limit" → QUERY_PARAM_REACHES_LIMIT (112)
包含 "size of metadata for this single chatroom exceeds" 或
     "total size of chatroom metadata for this app exceeds" → EXCEED_SERVICE_LIMIT (4)
包含 "is not part of you" → CHATROOM_PERMISSION_DENIED (703)
包含 "is not Legal" 或 "is not exist" → INVALID_PARAM (110)
其他 → SERVER_UNKNOWN_ERROR (303)
```

---

## 三、各 API 错误码详情


### 3.1 fetchAllChatrooms / fetchChatroomsWithCursor / fetchChatroomsWithPage（getChatRoomList）

> 三个重载共用 `EMMucManager::fetchMucsByPage` / `fetchMucsByCursor`。

| 错误码 | 数值 | 触发条件 |
|---|---|---|
| `USER_NOT_LOGIN` | 201 | 未登录（入口直接检查） |
| `SERVER_UNKNOWN_ERROR` | 303 | 响应 JSON 解析失败 / 缺少 `data` 或 `entities` 字段 |
| + EMMucManager 通用 REST 错误 | — | 见 2.2 节 |

**Web SDK 处理建议**：入口校验 `AUTH_NOT_LOGIN`；REST 错误走通用映射。

---

### 3.2 fetchChatroomSpecification（getChatRoomInfo / getInfo / refresh）

| 错误码 | 数值 | 触发条件 |
|---|---|---|
| `CHATROOM_INVALID_ID` | 700 | chatroomId 为空 |
| `USER_NOT_LOGIN` | 201 | 未登录（checkSessionStatusValid） |
| `NETWORK_ERROR` | 2 | 无网络（checkSessionStatusValid） |
| + EMMucManager 通用 REST 错误 | — | fetchMucSpecification / mucFetchRoleStatus 的 REST 调用 |

**移动端行为**：拉取详情成功后，如果当前用户是成员，自动插入本地已加入列表。

---

### 3.4 joinChatroom（joinChatRoom）

| 错误码 | 数值 | 触发条件 |
|---|---|---|
| `USER_NOT_LOGIN` | 201 | 未登录 |
| `CHATROOM_INVALID_ID` | 700 | chatroomId 为空 |
| `NETWORK_ERROR` | 2 | 网络不可用（checkConnect） |
| 服务端动态错误码 | — | `joinGroup` 返回的 MSync 协议错误码 |

**移动端行为**：
- 内置 2 次重试（`retryTimes < 2`）
- 加入成功后解析 `infoWhenJoin` JSON，更新聊天室的 `create_timestamp`、`is_all_mute`、`is_in_white_list`、`member_count`、`mute_duration`
- 加入失败后自动从本地已加入列表移除

**常见服务端错误**（通过 MSync 协议返回）：
- HTTP 403 + "member list is full" → `CHATROOM_MEMBERS_FULL` (704)
- HTTP 403 + "is in the blacklist" → `CHATROOM_USER_IN_BLOCKLIST` (707)

---

### 3.5 leaveChatroom（leaveChatRoom）

| 错误码 | 数值 | 触发条件 |
|---|---|---|
| `USER_NOT_LOGIN` | 201 | 未登录 |
| `CHATROOM_INVALID_ID` | 700 | chatroomId 为空 |
| `CHATROOM_NOT_JOINED` | 702 | 本地未找到已加入的聊天室 |
| `CHATROOM_OWNER_NOT_ALLOW_LEAVE` | 706 | 配置不允许聊天室所有者退出，且当前用户是 owner |
| `NETWORK_ERROR` | 2 | 网络不可用（checkConnect） |
| 服务端动态错误码 | — | `leaveGroup` 返回的 MSync 协议错误码 |

**移动端行为**：
- 内置 2 次重试
- 退出成功或聊天室不存在（`CHATROOM_NOT_EXIST`）都视为成功，清理本地数据
- owner 退出检查：`config.getIsChatroomOwnerLeaveAllowed()` 为 false 且当前用户是 owner 时返回 `CHATROOM_OWNER_NOT_ALLOW_LEAVE`

---

### 3.6 destroyChatroom（destroy）

| 错误码 | 数值 | 触发条件 |
|---|---|---|
| `CHATROOM_INVALID_ID` | 700 | chatroomId 为空（getValidJoinedChatroomById） |
| `CHATROOM_NOT_JOINED` | 702 | 未加入聊天室（getValidJoinedChatroomById） |
| `USER_NOT_LOGIN` | 201 | 未登录（getValidJoinedChatroomById → checkSessionStatusValid） |
| `NETWORK_ERROR` | 2 | 无网络 |
| + EMMucManager 通用 REST 错误 | — | mucDestroy 的 REST 调用 |

**移动端行为**：销毁成功后自动从本地已加入列表移除。

---

### 3.7 fetchChatroomMembers（getMemberList）

| 错误码 | 数值 | 触发条件 |
|---|---|---|
| `CHATROOM_INVALID_ID` | 700 | chatroomId 为空（getValidJoinedChatroomById） |
| `CHATROOM_NOT_JOINED` | 702 | 未加入聊天室 |
| `USER_NOT_LOGIN` | 201 | 未登录 |
| `NETWORK_ERROR` | 2 | 无网络 |
| + EMMucManager 通用 REST 错误 | — | fetchMucMembersWithCursor 的 REST 调用 |

**移动端行为**：如果 getValidJoinedChatroomById 失败但本地有聊天室对象，仍返回本地缓存的成员列表。

---

### 3.8 removeChatroomMembers（removeMembers）

> 通过 `chatroomListOperation` → `EMMucManager::mucProcessOccupants(REMOVE_MEMBERS)` 实现。

| 错误码 | 数值 | 触发条件 |
|---|---|---|
| `CHATROOM_INVALID_ID` | 700 | chatroomId 为空 |
| `CHATROOM_NOT_JOINED` | 702 | 未加入聊天室 |
| `USER_NOT_LOGIN` | 201 | 未登录 |
| `NETWORK_ERROR` | 2 | 无网络 |
| + EMMucManager 通用 REST 错误 | — | 见 2.2 节 |

**常见服务端错误**：
- HTTP 403 + error_description 包含 "forbidden_op" → `CHATROOM_PERMISSION_DENIED` (703)

---

### 3.9 transferChatroomOwner / addChatroomAdmin / removeChatroomAdmin（setAdmin / removeAdmin）

> 三者共用 `chatroomRoleOperation` → `EMMucManager::mucRoleOperation`。

| 错误码 | 数值 | 触发条件 |
|---|---|---|
| `CHATROOM_INVALID_ID` | 700 | chatroomId 为空 |
| `CHATROOM_NOT_JOINED` | 702 | 未加入聊天室 |
| `USER_NOT_LOGIN` | 201 | 未登录 |
| `NETWORK_ERROR` | 2 | 无网络 |
| + EMMucManager 通用 REST 错误 | — | mucRoleOperation 的 REST 调用 |

**移动端行为**：如果目标用户与当前登录用户相同，静默跳过不发请求（不报错）。

---

### 3.10 muteChatroomMembers（muteMembers）

| 错误码 | 数值 | 触发条件 |
|---|---|---|
| `CHATROOM_INVALID_ID` | 700 | chatroomId 为空 |
| `CHATROOM_NOT_JOINED` | 702 | 未加入聊天室 |
| `USER_NOT_LOGIN` | 201 | 未登录 |
| `NETWORK_ERROR` | 2 | 无网络 |
| + EMMucManager 通用 REST 错误 | — | muteOccupants 的 REST 调用 |

---

### 3.11 unmuteChatroomMembers（unmuteMembers）

> 通过 `chatroomListOperation` → `EMMucManager::mucProcessOccupants(REMOVE_MUTES)` 实现。

错误码与 3.8 removeChatroomMembers 完全一致。

---

### 3.12 fetchChatroomMutes（getMuteList）

| 错误码 | 数值 | 触发条件 |
|---|---|---|
| `CHATROOM_INVALID_ID` | 700 | chatroomId 为空 |
| `CHATROOM_NOT_JOINED` | 702 | 未加入聊天室 |
| `USER_NOT_LOGIN` | 201 | 未登录 |
| `NETWORK_ERROR` | 2 | 无网络 |
| + EMMucManager 通用 REST 错误 | — | fetchMucMutes 的 REST 调用 |

**移动端行为**：如果 getValidJoinedChatroomById 失败但本地有聊天室对象，返回本地缓存的禁言列表。

---

### 3.13 muteAllChatroomMembers / unmuteAllChatroomMembers（muteAllMembers / unmuteAllMembers）

| 错误码 | 数值 | 触发条件 |
|---|---|---|
| `CHATROOM_INVALID_ID` | 700 | chatroomId 为空 |
| `CHATROOM_NOT_JOINED` | 702 | 未加入聊天室 |
| `USER_NOT_LOGIN` | 201 | 未登录 |
| `NETWORK_ERROR` | 2 | 无网络 |
| + EMMucManager 通用 REST 错误 | — | muteAllMembers / unmuteAllMembers 的 REST 调用 |

---

### 3.14 blockChatroomMembers（blockMembers）

> 通过 `chatroomListOperation` → `EMMucManager::mucProcessOccupants(ADD_BANS)` 实现。

错误码与 3.8 removeChatroomMembers 完全一致。

---

### 3.15 unblockChatroomMembers（unblockMembers）

> 通过 `chatroomListOperation` → `EMMucManager::mucProcessOccupants(REMOVE_BANS)` 实现。

错误码与 3.8 removeChatroomMembers 完全一致。

---

### 3.16 fetchChatroomBans（getBlocklist）

| 错误码 | 数值 | 触发条件 |
|---|---|---|
| `CHATROOM_INVALID_ID` | 700 | chatroomId 为空 |
| `CHATROOM_NOT_JOINED` | 702 | 未加入聊天室 |
| `USER_NOT_LOGIN` | 201 | 未登录 |
| `NETWORK_ERROR` | 2 | 无网络 |
| + EMMucManager 通用 REST 错误 | — | fetchMucBans 的 REST 调用 |

**移动端行为**：如果 getValidJoinedChatroomById 失败但本地有聊天室对象，返回本地缓存的黑名单。

---

### 3.17 addWhiteListMembers（addUsersToAllowlist）

| 错误码 | 数值 | 触发条件 |
|---|---|---|
| `CHATROOM_INVALID_ID` | 700 | chatroomId 为空 |
| `CHATROOM_NOT_JOINED` | 702 | 未加入聊天室 |
| `USER_NOT_LOGIN` | 201 | 未登录 |
| `NETWORK_ERROR` | 2 | 无网络 |
| + EMMucManager 通用 REST 错误 | — | addWhiteList 的 REST 调用 |

---

### 3.18 removeWhiteListMembers（removeUsersFromAllowlist）

> 通过 `chatroomListOperation` → `EMMucManager::mucProcessOccupants(REMOVE_WHITE_LIST)` 实现。

错误码与 3.8 removeChatroomMembers 完全一致。

---

### 3.19 fetchChatroomWhiteList（getAllowlist）

| 错误码 | 数值 | 触发条件 |
|---|---|---|
| `CHATROOM_INVALID_ID` | 700 | chatroomId 为空 |
| `CHATROOM_NOT_JOINED` | 702 | 未加入聊天室 |
| `USER_NOT_LOGIN` | 201 | 未登录 |
| `NETWORK_ERROR` | 2 | 无网络 |
| + EMMucManager 通用 REST 错误 | — | fetchMucWhiteList 的 REST 调用 |

**移动端行为**：如果 getValidJoinedChatroomById 失败但本地有聊天室对象，返回本地缓存的 allowlist。

---

### 3.20 fetchIsMemberInWhiteList（checkIfInAllowList）

| 错误码 | 数值 | 触发条件 |
|---|---|---|
| `CHATROOM_INVALID_ID` | 700 | chatroomId 为空 |
| `CHATROOM_NOT_JOINED` | 702 | 未加入聊天室 |
| `USER_NOT_LOGIN` | 201 | 未登录 |
| `NETWORK_ERROR` | 2 | 无网络 |
| + EMMucManager 通用 REST 错误 | — | fetchMucIsMemberInWhiteList 的 REST 调用 |

**移动端行为**：查询成功后自动更新本地聊天室对象的 `isInWhiteList` 属性。

---

### 3.21 fetchIsMemberInMuteList（isCurrentUserMuted）

| 错误码 | 数值 | 触发条件 |
|---|---|---|
| `CHATROOM_INVALID_ID` | 700 | chatroomId 为空 |
| `CHATROOM_NOT_JOINED` | 702 | 未加入聊天室 |
| `USER_NOT_LOGIN` | 201 | 未登录 |
| `NETWORK_ERROR` | 2 | 无网络 |
| + EMMucManager 通用 REST 错误 | — | fetchMucIsMemberInMuteList 的 REST 调用 |

---

### 3.22 changeChatroomSubject / changeChatroomDescription / changeChatroomExtension（updateChatRoomInfo）

> 三者共用 `changeChatroomAttribute` 内部方法。

| 错误码 | 数值 | 触发条件 |
|---|---|---|
| `CHATROOM_INVALID_ID` | 700 | chatroomId 为空 |
| `CHATROOM_NOT_JOINED` | 702 | 未加入聊天室 |
| `USER_NOT_LOGIN` | 201 | 未登录 |
| `NETWORK_ERROR` | 2 | 无网络 |
| `USER_ILLEGAL_ARGUMENT` | 205 | 传入了不支持的属性类型（非 SUBJECT/DESCRIPTION/EXTENSION） |
| + EMMucManager 通用 REST 错误 | — | changeMucAttribute 的 REST 调用 |

**移动端行为**：如果新值与旧值相同，跳过 REST 请求直接返回成功。

**常见服务端错误**：
- HTTP 403 + error == "announce info length exceeds limit!" → `USER_ILLEGAL_ARGUMENT` (205)

---

### 3.23 fetchChatroomAnnouncement（getAnnouncement）

| 错误码 | 数值 | 触发条件 |
|---|---|---|
| `CHATROOM_INVALID_ID` | 700 | chatroomId 为空 |
| `CHATROOM_NOT_JOINED` | 702 | 未加入聊天室 |
| `USER_NOT_LOGIN` | 201 | 未登录 |
| `NETWORK_ERROR` | 2 | 无网络 |
| + EMMucManager 通用 REST 错误 | — | fetchMucAnnouncement 的 REST 调用 |

---

### 3.24 updateChatroomAnnouncement（updateAnnouncement）

| 错误码 | 数值 | 触发条件 |
|---|---|---|
| `CHATROOM_INVALID_ID` | 700 | chatroomId 为空 |
| `CHATROOM_NOT_JOINED` | 702 | 未加入聊天室 |
| `USER_NOT_LOGIN` | 201 | 未登录 |
| `NETWORK_ERROR` | 2 | 无网络 |
| + EMMucManager 通用 REST 错误 | — | updateMucAnnouncement 的 REST 调用 |

**常见服务端错误**：
- HTTP 403 + error == "announce info length exceeds limit!" → `USER_ILLEGAL_ARGUMENT` (205)

---

### 3.25 addChatRoomMetaData（setAttributes / setAttribute）

> 使用 `EMChatroomManager::processGeneralRESTResponseError`（属性专用，见 2.1 节）。

| 错误码 | 数值 | 触发条件 |
|---|---|---|
| `USER_NOT_LOGIN` | 201 | 未登录（入口直接检查） |
| `INVALID_PARAM` | 110 | extJson 为空 |
| `SERVER_UNKNOWN_ERROR` | 303 | 响应 JSON 解析失败 / 缺少 `data` 字段 |
| `PARTIAL_SUCCESS` | 7 | 批量操作中部分 key 成功、部分失败 |
| `INVALID_PARAM` | 110 | 所有 key 都失败（successKeys == 0） |
| + 属性专用 REST 错误（见 2.1） | — | HTTP 400/401/403/404/503 |

**属性 errorKeys 中每个 key 的具体错误码**（通过 `mapRoomAttributesFailureErrorDescToCode` 判定）：

| 错误描述（字符串匹配） | 映射错误码 | 数值 |
|---|---|---|
| 包含 `"is exceeding maximum limit"` | `QUERY_PARAM_REACHES_LIMIT` | 112 |
| 包含 `"size of metadata for this single chatroom exceeds"` 或 `"total size of chatroom metadata for this app exceeds"` | `EXCEED_SERVICE_LIMIT` | 4 |
| 包含 `"is not part of you"` | `CHATROOM_PERMISSION_DENIED` | 703 |
| 包含 `"is not Legal"` 或 `"is not exist"` | `INVALID_PARAM` | 110 |
| 其他 | `SERVER_UNKNOWN_ERROR` | 303 |

**属性专用 REST 错误**（通过 `processGeneralRESTResponseError` 判定）：

| HTTP 状态码 | error_code 字段 | 映射错误码 | 数值 |
|---|---|---|---|
| 400 | 60010 | `CHATROOM_PERMISSION_DENIED` | 703 |
| 400 | 60011 | `CHATROOM_NOT_JOINED` | 702 |
| 400 | 60012 | `QUERY_PARAM_REACHES_LIMIT` | 112 |
| 400 | 其他 | `SERVER_UNKNOWN_ERROR` | 303 |
| 401 | — | 首次刷新 token 重试；重试后 `USER_AUTHENTICATION_FAILED` | 202 |
| 403 | — | `SERVER_UNKNOWN_ERROR` | 303 |
| 404 | — | `CHATROOM_NOT_EXIST` | 705 |
| 503 | — | `SERVER_BUSY` | 302 |

---

### 3.26 fetchChatRoomMetaFromSever（getAttributes）

| 错误码 | 数值 | 触发条件 |
|---|---|---|
| `USER_NOT_LOGIN` | 201 | 未登录（入口直接检查） |
| `SERVER_UNKNOWN_ERROR` | 303 | 响应 JSON 解析失败 / 缺少 `data` 字段 / `data` 非对象 |
| + 属性专用 REST 错误（见 2.1） | — | HTTP 400/401/403/404/503 |

**注意**：此 API 不校验 keys 是否为空（空 keys 表示获取全部属性）。

---

### 3.27 removeChatRoomMetaFromSever（removeAttributes / removeAttribute）

| 错误码 | 数值 | 触发条件 |
|---|---|---|
| `USER_NOT_LOGIN` | 201 | 未登录（入口直接检查） |
| `INVALID_PARAM` | 110 | keys 为空 |
| `SERVER_UNKNOWN_ERROR` | 303 | 响应 JSON 解析失败 |
| `PARTIAL_SUCCESS` | 7 | 批量删除中部分 key 成功、部分失败 |
| `INVALID_PARAM` | 110 | 所有 key 都失败 |
| + 属性专用 REST 错误（见 2.1） | — | HTTP 400/401/403/404/503 |

**属性 errorKeys 判定规则**：与 3.25 addChatRoomMetaData 完全一致。

---

### 3.28 handleMUCOperation（聊天室事件处理）

此方法处理 MSync 协议下发的聊天室 MUC 事件，不返回错误码，但其中部分事件的 payload 解析有特殊判断逻辑：

#### KICK 事件（onRemovedFromChatRoom）

```
reason == "chatroom kick offline user" → leaveReason = BE_KICKED_FOR_OFFLINE
其他 → leaveReason = BE_KICKED
```

Web SDK 需通过 `reason` 字段区分"被踢出"和"因离线被踢"。

#### PRESENCE 事件（onMembersJoined）

```
body.getMUCMembers(members)
如果 members 为空 → 使用 body.from().userName() 作为加入成员
否则 → 使用 members 列表
同时携带 memberCount 和 ext
```

#### ABSENCE 事件（onMembersExited）

```
body.getMUCMembers(members)
如果 members 为空 → 使用 body.from().userName() 作为退出成员
否则 → 使用 members 列表
同时携带 memberCount
```

#### ADD_MUTE 事件（onMuteListAdded）

解析 `ext` JSON 获取按用户区分的禁言到期时间：

```json
// ext 格式：
{"user_mute_time":{"userId1":1730894708086,"userId2":1730894708086}}
```

判断逻辑：
```
1. 解析 ext JSON 中的 user_mute_time 对象
2. 如果解析成功且非空 → callbackAddMutes(chatroomId, map<userId, muteExpireTimestamp>)
3. 如果解析失败或为空 → 从 body.tos() 获取用户列表，使用默认过期时间 4638873600000（约 2116 年）
   → callbackAddMutes(chatroomId, userList, defaultExpire)
```

Web SDK 需统一为 `MuteEntry[]` 结构，每个条目包含 `userId` 和 `muteExpireTimestamp`。

#### REMOVE_MUTE 事件（onMuteListRemoved）

```
从 body.tos() 获取被解除禁言的用户列表
```

#### ADD_USER_WHITE_LIST / REMOVE_USER_WHITE_LIST 事件（onAllowListAdded / onAllowListRemoved）

```
从 body.tos() 获取用户列表
```

#### SET_METADATA / DELETE_METADATA 事件（onAttributesUpdate / onAttributesRemoved）

```
ext = body.info()->ext()  // 属性键值 JSON
from = body.from().userName()  // 操作者
chatroomId = body.mucJid().userName()
```

#### UPDATE 事件（onChatRoomInfoChanged）

```
ext = body.info()->ext()  // 可能为空
chatroomId = body.mucJid().userName()
```

#### 其他事件

| MUC Operation | 对应事件 | payload 来源 |
|---|---|---|
| `DESTROY` | `onChatRoomDestroyed` | chatroomId |
| `ADD_ADMIN` | `onAdminAdded` | `body.tos()[0].userName()` |
| `REMOVE_ADMIN` | `onAdminRemoved` | `body.tos()[0].userName()` |
| `ASSIGN_OWNER` | `onOwnerChanged` | newOwner=`body.tos()[0]`, oldOwner=`body.from()` |
| `UPDATE_ANNOUNCEMENT` | `onAnnouncementChanged` | announcement=`body.reason()` |
| `DELETE_ANNOUNCEMENT` | `onAnnouncementChanged` | announcement="" |
| `BAN_GROUP` | `onAllMemberMuteStateChanged` | isMuted=true |
| `REMOVE_BAN_GROUP` | `onAllMemberMuteStateChanged` | isMuted=false |

---

## 四、Web SDK 现有覆盖情况与补充建议

### 4.1 api-errors.json 已覆盖的错误码

Web SDK 的 `api-errors.json` 已为聊天室域定义了以下错误场景：

| API | 已覆盖的错误 |
|---|---|
| getChatRoomInfo | `resource_not_found`(606) |
| updateChatRoomInfo | `group_authorization`(210), `forbidden_op`(110), `illegal_argument`(110), `resource_not_found`(606) |
| destroyChatRoom | `group_authorization`(210), `resource_not_found`(606) |
| joinChatRoom | `exceed_limit`(4), `resource_not_found`(606) |
| leaveChatRoom | `resource_not_found`(606) |
| addChatRoomMembers | `illegal_argument`(110), `group_authorization`(210), `resource_not_found`(606), `service_resource_not_found`(204) |
| removeChatRoomMembers | `group_authorization`(210), `resource_not_found`(606) |
| setChatRoomAdmin / removeChatRoomAdmin | `group_authorization`(210), `resource_not_found`(606), `service_resource_not_found`(204) |
| muteChatRoomMembers | `illegal_argument`(110), `group_authorization`(210), `resource_not_found`(606) |
| unmuteChatRoomMembers / muteAllMembers / unmuteAllMembers | `group_authorization`(210), `resource_not_found`(606) |
| blockChatRoomMembers | `group_authorization`(210), `resource_not_found`(606), `service_resource_not_found`(204) |
| unblockChatRoomMembers | `group_authorization`(210), `resource_not_found`(606) |
| addUsersToChatRoomAllowlist | `group_authorization`(210), `resource_not_found`(606), `service_resource_not_found`(204) |
| removeUsersFromChatRoomAllowlist | `group_authorization`(210), `resource_not_found`(606) |
| updateChatRoomAnnouncement | `group_authorization`(210), `forbidden_op`(110), `resource_not_found`(606) |
| deleteChatRoomSharedFile | `group_authorization`(210), `resource_not_found`(606) |
| setChatRoomAttributes / setAttribute | `illegal_argument`(110), `MetadataException`(210) |
| removeChatRoomAttributes / removeAttribute | `illegal_argument`(110), `MetadataException`(210) |
| getChatRoomAttributes | `illegal_argument`(110), `resource_not_found`(606) |

### 4.2 移动端有但 Web SDK 缺失的错误码

以下是移动端源码中存在、但 Web SDK `api-errors.json` 和 `error-codes.ts` 中尚未定义的错误码：

| 错误码 | 数值 | 涉及 API | 补充建议 |
|---|---|---|---|
| `CHATROOM_INVALID_ID` | 700 | 所有需要 chatroomId 的 API | Web SDK 当前用 606 统一表示"聊天室不存在"，但移动端区分了"ID 无效"(700) 和"不存在"(705)。建议在 `error-codes.ts` 新增 `CHATROOM_INVALID_ID = 700`，用于客户端参数校验阶段（chatroomId 为空） |
| `CHATROOM_NOT_JOINED` | 702 | destroy / members / mute / block / allowlist / announcement / attributes | Web SDK 当前未区分"未加入聊天室"。建议新增 `CHATROOM_NOT_JOINED = 702`，用于需要先加入才能操作的 API |
| `CHATROOM_PERMISSION_DENIED` | 703 | 属性 API (error_code=60010)、通用 REST (forbidden_op) | Web SDK 当前用 210 表示权限拒绝。移动端对聊天室有独立的 703。建议属性 API 的 error_code=60010 映射为 703 而非 210 |
| `CHATROOM_MEMBERS_FULL` | 704 | joinChatRoom / addMembers | Web SDK 当前 joinChatRoom 只有 `exceed_limit`(4)。建议新增 `CHATROOM_MEMBERS_FULL = 704`，对应 HTTP 403 + "member list is full" |
| `CHATROOM_NOT_EXIST` | 705 | 属性 API (HTTP 404) | Web SDK 当前用 606 统一表示。建议属性 API 的 HTTP 404 映射为 705 |
| `CHATROOM_OWNER_NOT_ALLOW_LEAVE` | 706 | leaveChatRoom | Web SDK 当前 leaveChatRoom 只有 `resource_not_found`(606)。建议新增客户端校验：配置不允许 owner 退出时返回 706 |
| `CHATROOM_USER_IN_BLOCKLIST` | 707 | joinChatRoom | Web SDK 当前 joinChatRoom 未覆盖此场景。建议新增，对应 HTTP 403 + "is in the blacklist" |
| `PARTIAL_SUCCESS` | 7 | setAttributes / removeAttributes | Web SDK spec FR-031 要求"收敛为稳定业务对象或统一错误"。建议新增 `PARTIAL_SUCCESS = 7`，属性批量操作部分失败时使用 |
| `SERVER_BUSY` | 302 | 属性 API (HTTP 503) | Web SDK 当前无此错误码。建议新增 |
| `QUERY_PARAM_REACHES_LIMIT` | 112 | 属性 API (error_code=60012, "exceeding maximum limit") | Web SDK 当前无此错误码。建议新增或复用 `SERVICE_LIMIT_EXCEEDED` |

### 4.3 spec 中已覆盖但可补充错误处理细节的 FR

| spec FR | 当前描述 | 建议补充 |
|---|---|---|
| FR-011 | "参数非法时 MUST 抛出 ValidationError；网络或业务失败 MUST 抛出统一 SDK 错误对象" | 补充：属性 API 的 HTTP 400 需按 `error_code` 字段（60010/60011/60012）做细分映射，不能统一归为 `INVALID_PARAM` |
| FR-031 | "部分成功/部分失败结果收敛为稳定业务对象或统一错误" | 补充：移动端的判定逻辑为 `successKeys==0` 时整体失败，`successKeys>0 && errorKeys非空` 时 `PARTIAL_SUCCESS`。建议 Web SDK 返回 `{ successKeys: string[], errorKeys: Record<string, ErrorCode> }` 结构 |
| FR-009 | "joinChatRoom MUST 保留 ext 与 leaveOtherRooms 语义" | 补充：移动端 joinChatRoom 内置 2 次重试，且加入成功后自动解析 `infoWhenJoin` 更新聊天室状态。Web SDK 需考虑是否在 join 成功后自动更新本地聊天室信息 |
| FR-038 | "onRemovedFromChatRoom MUST 提供 reason 区分被踢出/被加入黑名单" | 补充：移动端还区分了 `BE_KICKED_FOR_OFFLINE`（reason=="chatroom kick offline user"），Web SDK 需决定是否暴露此 reason |
| FR-037 | "onMuteListAdded MUST 统一表达完整禁言条目集合" | 补充：移动端解析 ext JSON `{"user_mute_time":{"userId":timestamp}}`，解析失败时回退到 `body.tos()` + 默认过期时间 `4638873600000`。Web SDK 需实现相同的回退逻辑 |

### 4.4 joinChatRoom 缺失的错误场景

Web SDK 的 `joinChatRoom` 在 `api-errors.json` 中只定义了 `exceed_limit`(4) 和 `resource_not_found`(606)。移动端还有以下场景需要补充：

| 场景 | 移动端错误码 | 建议 Web SDK 处理 |
|---|---|---|
| chatroomId 为空 | `CHATROOM_INVALID_ID` (700) | 客户端 `ValidationError` |
| 未登录 | `USER_NOT_LOGIN` (201) | `AuthenticationError` |
| 网络不可用 | `NETWORK_ERROR` (2) | `ConnectionError` |
| 聊天室成员已满 | `CHATROOM_MEMBERS_FULL` (704) | 新增错误码 |
| 用户在黑名单中 | `CHATROOM_USER_IN_BLOCKLIST` (707) | 新增错误码 |

### 4.5 属性 API 缺失的错误场景

Web SDK 的属性 API 在 `api-errors.json` 中只定义了 `illegal_argument`(110) 和 `MetadataException`(210)。移动端还有以下场景需要补充：

| 场景 | 移动端错误码 | HTTP 状态码 / error_code | 建议 |
|---|---|---|---|
| 未加入聊天室 | `CHATROOM_NOT_JOINED` (702) | 400 / 60011 | 新增 |
| 聊天室权限拒绝 | `CHATROOM_PERMISSION_DENIED` (703) | 400 / 60010 | 新增或映射到 210 |
| 属性数量超限 | `QUERY_PARAM_REACHES_LIMIT` (112) | 400 / 60012 | 新增 |
| 聊天室不存在 | `CHATROOM_NOT_EXIST` (705) | 404 | 新增或映射到 606 |
| 服务器繁忙 | `SERVER_BUSY` (302) | 503 | 新增 |
| 单个属性值超限 | `QUERY_PARAM_REACHES_LIMIT` (112) | errorKeys 中 "exceeding maximum limit" | 新增 |
| 聊天室属性总量超限 | `EXCEED_SERVICE_LIMIT` (4) | errorKeys 中 "size of metadata...exceeds" | 已有 |
| 属性不属于当前用户 | `CHATROOM_PERMISSION_DENIED` (703) | errorKeys 中 "is not part of you" | 新增 |
| 属性 key 不合法/不存在 | `INVALID_PARAM` (110) | errorKeys 中 "is not Legal" / "is not exist" | 已有 |
| 批量操作部分失败 | `PARTIAL_SUCCESS` (7) | successKeys > 0 且 errorKeys 非空 | 新增 |
