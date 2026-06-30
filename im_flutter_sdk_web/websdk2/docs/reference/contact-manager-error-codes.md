# ContactManager 错误码对照文档

> 基于移动端 C++ SDK（emclient-linux）`emcontactmanager.cpp` 源码分析，对比 Web SDK 025 实现。
>
> 生成时间：2026-05-20

---

## 一、联系人域错误码总表

| 移动端错误码                 | 数值 | 含义                   | Web SDK 现状                                                    |
| ---------------------------- | ---- | ---------------------- | --------------------------------------------------------------- |
| `USER_NOT_LOGIN`             | 201  | 未登录                 | ✅ `AUTH_NOT_LOGIN`                                             |
| `USER_AUTHENTICATION_FAILED` | 202  | 鉴权失败               | ✅ `AUTH_UNAUTHORIZED`                                          |
| `USER_NOT_FOUND`             | 204  | 用户不存在             | ✅ `CONTACT_ADD_USER_NOT_FOUND`(204)                            |
| `USER_ILLEGAL_ARGUMENT`      | 205  | 非法参数               | ✅ `VALIDATION_INVALID_FORMAT`(110)                             |
| `USER_NOT_ON_ROSTER`         | 221  | 非好友                 | ⚠️ Web 通过 `CONTACT_SET_REMARK_NOT_FRIEND`(223) 覆盖，语义更窄 |
| `INVALID_USER_NAME`          | 101  | 用户名非法/为空        | ✅ `VALIDATION_REQUIRED`(110)                                   |
| `SERVER_NOT_REACHABLE`       | 300  | 服务器不可达           | ✅                                                              |
| `SERVER_UNKNOWN_ERROR`       | 303  | 服务器未知错误         | ✅                                                              |
| `EXCEED_SERVICE_LIMIT`       | 4    | 超出服务限制           | ✅                                                              |
| `QUERY_PARAM_REACHES_LIMIT`  | 112  | 查询参数超限           | ✅ `SERVICE_LIMIT_EXCEEDED`(4)                                  |
| `CONTACT_ADD_FAILED`         | 1000 | 添加联系人失败         | ✅ `CONTACT_ADD_ALREADY_FRIEND`(1000)                           |
| `CONTACT_REACH_LIMIT`        | 1001 | 邀请方联系人数量超限   | ❌ 缺失                                                         |
| `CONTACT_REACH_LIMIT_PEER`   | 1002 | 被邀请方联系人数量超限 | ❌ 缺失                                                         |

---

## 二、通用前置校验 handleError

大多数写操作共用此校验：

```
未登录 → USER_NOT_LOGIN (201)
checkConnect → waitConnectToServer:
  LOGOUT → USER_NOT_LOGIN (201)
  TIMEOUT / DISCONNECTED → SERVER_NOT_REACHABLE (300)
```

---

## 三、各 API 错误码详情

### addContact（inviteContact）

| 错误码                       | 数值 | 触发条件                                              | 判断规则                |
| ---------------------------- | ---- | ----------------------------------------------------- | ----------------------- |
| `INVALID_USER_NAME`          | 101  | username 为空                                         | `username.empty()`      |
| `INVALID_USER_NAME`          | 101  | 自己加自己                                            | `username == loginUser` |
| `USER_NOT_LOGIN`             | 201  | 未登录                                                | handleError             |
| `SERVER_NOT_REACHABLE`       | 300  | 未连接                                                | handleError             |
| `USER_NOT_FOUND`             | 204  | HTTP 404 + exception ⊃ "UserNotFoundException"        | 字符串匹配              |
| `CONTACT_REACH_LIMIT`        | 1001 | HTTP 403 + error_desc ⊃ "Inviter's contact max count" | 字符串匹配              |
| `CONTACT_REACH_LIMIT_PEER`   | 1002 | HTTP 403 + error_desc ⊃ "Invitee's contact max count" | 字符串匹配              |
| `CONTACT_ADD_FAILED`         | 1000 | HTTP 403 其他 / 其他 HTTP 错误                        | 兜底                    |
| `USER_AUTHENTICATION_FAILED` | 202  | HTTP 401（刷新 token 后仍失败）                       |                         |

---

### deleteContact

| 错误码                       | 数值 | 触发条件                                       | 判断规则           |
| ---------------------------- | ---- | ---------------------------------------------- | ------------------ |
| `INVALID_USER_NAME`          | 101  | username 为空                                  | `username.empty()` |
| `USER_NOT_LOGIN`             | 201  | 未登录                                         | handleError        |
| `SERVER_NOT_REACHABLE`       | 300  | 未连接                                         | handleError        |
| `USER_NOT_FOUND`             | 204  | HTTP 404 + exception ⊃ "UserNotFoundException" | 字符串匹配         |
| `USER_AUTHENTICATION_FAILED` | 202  | HTTP 401（刷新 token 后仍失败）                |                    |
| `SERVER_NOT_REACHABLE`       | 300  | 其他 HTTP 错误                                 | 兜底               |

---

### acceptInvitation（acceptContactInvite）

| 错误码                       | 数值 | 触发条件                                              | 判断规则           |
| ---------------------------- | ---- | ----------------------------------------------------- | ------------------ |
| `INVALID_USER_NAME`          | 101  | username 为空                                         | `username.empty()` |
| `USER_NOT_LOGIN`             | 201  | 未登录                                                | handleError        |
| `SERVER_NOT_REACHABLE`       | 300  | 未连接                                                | handleError        |
| `USER_NOT_FOUND`             | 204  | HTTP 404 + exception ⊃ "UserNotFoundException"        | 字符串匹配         |
| `CONTACT_REACH_LIMIT`        | 1001 | HTTP 403 + error_desc ⊃ "Inviter's contact max count" | 字符串匹配         |
| `CONTACT_REACH_LIMIT_PEER`   | 1002 | HTTP 403 + error_desc ⊃ "Invitee's contact max count" | 字符串匹配         |
| `USER_AUTHENTICATION_FAILED` | 202  | HTTP 401（刷新 token 后仍失败）                       |                    |
| `CONTACT_ADD_FAILED`         | 1000 | 其他 HTTP 错误                                        | 兜底               |

---

### declineInvitation（declineContactInvite）

| 错误码                       | 数值 | 触发条件                                       | 判断规则           |
| ---------------------------- | ---- | ---------------------------------------------- | ------------------ |
| `INVALID_USER_NAME`          | 101  | username 为空                                  | `username.empty()` |
| `USER_NOT_LOGIN`             | 201  | 未登录                                         | handleError        |
| `SERVER_NOT_REACHABLE`       | 300  | 未连接                                         | handleError        |
| `USER_NOT_FOUND`             | 204  | HTTP 404 + exception ⊃ "UserNotFoundException" | 字符串匹配         |
| `USER_AUTHENTICATION_FAILED` | 202  | HTTP 401（刷新 token 后仍失败）                |                    |
| `SERVER_NOT_REACHABLE`       | 300  | 其他 HTTP 错误                                 | 兜底               |

---

### addToBlackList / saveBlackList（addUsersToBlocklist）

| 错误码                       | 数值 | 触发条件                                                                      | 判断规则            |
| ---------------------------- | ---- | ----------------------------------------------------------------------------- | ------------------- |
| `INVALID_USER_NAME`          | 101  | blacklist 为空                                                                | `blacklist.empty()` |
| `USER_NOT_LOGIN`             | 201  | 未登录                                                                        | handleError         |
| `SERVER_NOT_REACHABLE`       | 300  | 未连接                                                                        | handleError         |
| `USER_NOT_FOUND`             | 204  | HTTP 404 + exception ⊃ "UserNotFoundException"                                | 字符串匹配          |
| `EXCEED_SERVICE_LIMIT`       | 4    | HTTP 400 + error_desc ⊃ "almost reached or been greater than the upper range" | 字符串匹配          |
| `USER_AUTHENTICATION_FAILED` | 202  | HTTP 401（刷新 token 后仍失败）                                               |                     |
| `SERVER_NOT_REACHABLE`       | 300  | 其他 HTTP 错误                                                                | 兜底                |

---

### removeFromBlackList（removeUserFromBlocklist）

| 错误码                       | 数值 | 触发条件                                       | 判断规则           |
| ---------------------------- | ---- | ---------------------------------------------- | ------------------ |
| `INVALID_USER_NAME`          | 101  | username 为空                                  | `username.empty()` |
| `USER_NOT_LOGIN`             | 201  | 未登录                                         | handleError        |
| `SERVER_NOT_REACHABLE`       | 300  | 未连接                                         | handleError        |
| `USER_NOT_FOUND`             | 204  | HTTP 404 + exception ⊃ "UserNotFoundException" | 字符串匹配         |
| `USER_AUTHENTICATION_FAILED` | 202  | HTTP 401（刷新 token 后仍失败）                |                    |
| `SERVER_NOT_REACHABLE`       | 300  | 其他 HTTP 错误                                 | 兜底               |

---

### getBlackListFromServer（getBlocklist）

| 错误码                       | 数值 | 触发条件                        | 判断规则 |
| ---------------------------- | ---- | ------------------------------- | -------- |
| `USER_NOT_LOGIN`             | 201  | 未登录                          |          |
| `SERVER_UNKNOWN_ERROR`       | 303  | JSON 解析失败 / data 非数组     |          |
| `USER_NOT_FOUND`             | 204  | HTTP 404                        |          |
| `USER_AUTHENTICATION_FAILED` | 202  | HTTP 401（刷新 token 后仍失败） |          |
| `SERVER_NOT_REACHABLE`       | 300  | 其他 HTTP 错误                  |          |

---

### getContactsFromServer / fetchAllContactsFromServer

| 错误码                       | 数值 | 触发条件                                   | 判断规则 |
| ---------------------------- | ---- | ------------------------------------------ | -------- |
| `USER_NOT_LOGIN`             | 201  | 未登录                                     |          |
| `USER_ILLEGAL_ARGUMENT`      | 205  | 请求过程中登录用户变更                     |          |
| `SERVER_UNKNOWN_ERROR`       | 303  | JSON 解析失败 / 缺少 data/version/entities |          |
| `USER_NOT_FOUND`             | 204  | HTTP 404                                   |          |
| `USER_AUTHENTICATION_FAILED` | 202  | HTTP 401（刷新 token 后仍失败）            |          |
| `SERVER_NOT_REACHABLE`       | 300  | 其他 HTTP 错误                             |          |

---

### fetchAllContactsFromServerByPage

| 错误码                       | 数值 | 触发条件                                          | 判断规则   |
| ---------------------------- | ---- | ------------------------------------------------- | ---------- |
| `USER_NOT_LOGIN`             | 201  | 未登录                                            |            |
| `SERVER_UNKNOWN_ERROR`       | 303  | JSON 解析失败 / 缺少 data/contacts                |            |
| `USER_NOT_FOUND`             | 204  | HTTP 404                                          |            |
| `USER_AUTHENTICATION_FAILED` | 202  | HTTP 401（刷新 token 后仍失败）                   |            |
| `QUERY_PARAM_REACHES_LIMIT`  | 112  | HTTP 400 + error_desc ⊃ "page size more than max" | 字符串匹配 |
| `SERVER_NOT_REACHABLE`       | 300  | 其他 HTTP 错误                                    |            |

---

### setContactRemark

| 错误码                       | 数值 | 触发条件                                               | 判断规则           |
| ---------------------------- | ---- | ------------------------------------------------------ | ------------------ |
| `INVALID_USER_NAME`          | 101  | username 为空                                          | `username.empty()` |
| `USER_NOT_LOGIN`             | 201  | 未登录                                                 |                    |
| `SERVER_UNKNOWN_ERROR`       | 303  | JSON 解析失败 / status != "ok"                         |                    |
| `USER_NOT_FOUND`             | 204  | HTTP 404                                               |                    |
| `USER_AUTHENTICATION_FAILED` | 202  | HTTP 401（刷新 token 后仍失败）                        |                    |
| `EXCEED_SERVICE_LIMIT`       | 4    | HTTP 400 + error_desc ⊃ "remark length must less than" | 字符串匹配         |
| `USER_NOT_ON_ROSTER`         | 221  | HTTP 400 + error_desc ⊃ "please add as a friend first" | 字符串匹配         |
| `SERVER_NOT_REACHABLE`       | 300  | 其他 HTTP 错误                                         |                    |

---

## 四、Web SDK 对比分析

### 4.1 已对齐的部分

- `addContact` 的 3 个业务错误（USER_NOT_FOUND/ALREADY_FRIEND/BLOCKED_BY_USER）✅
- `setContactRemark` 的非好友错误（illegal_argument → 223）✅
- `addUsersToBlocklist` 的用户不存在（service_resource_not_found → 204）✅
- 参数校验（validateUserId / assertNormalizedUserIds）✅
- runOperation + normalizeSdkError 统一错误包装 ✅

### 4.2 已补齐的联系人上限错误码

| 错误码                     | 数值 | 涉及 API                         | 当前状态                         |
| -------------------------- | ---- | -------------------------------- | -------------------------------- |
| `CONTACT_REACH_LIMIT`      | 1001 | addContact / acceptContactInvite | ✅ 已在 `api-errors.json` 中补齐 |
| `CONTACT_REACH_LIMIT_PEER` | 1002 | addContact / acceptContactInvite | ✅ 已在 `api-errors.json` 中补齐 |

### 4.3 当前 `api-errors.json` 覆盖情况

| API                       | 当前状态                                                                                                                                    | 结论                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `deleteContact`           | 已定义 `USER_NOT_FOUND`(204)                                                                                                                | ✅ 已补齐                                 |
| `acceptContactInvite`     | 已定义 `USER_NOT_FOUND`(204)、`CONTACT_REACH_LIMIT`(1001)、`CONTACT_REACH_LIMIT_PEER`(1002)                                                 | ✅ 已补齐                                 |
| `declineContactInvite`    | 已定义 `USER_NOT_FOUND`(204)                                                                                                                | ✅ 已补齐                                 |
| `getBlocklist`            | 空 `errors: {}`                                                                                                                             | 可暂不补充（只有通用错误）                |
| `removeUserFromBlocklist` | 空 `errors: {}`                                                                                                                             | 可暂不补充（FR-022 要求服务端成功即完成） |
| `addContact`              | 已定义 `USER_NOT_FOUND`(204)、`ALREADY_FRIEND`(1000)、`BLOCKED_BY_USER`(210)、`CONTACT_REACH_LIMIT`(1001)、`CONTACT_REACH_LIMIT_PEER`(1002) | ✅ 已补齐                                 |

### 4.4 error-codes.ts 需新增的常量

| 常量                       | 数值 | 来源                                                       |
| -------------------------- | ---- | ---------------------------------------------------------- |
| `CONTACT_REACH_LIMIT`      | 1001 | addContact / acceptContactInvite（邀请方联系人数量超限）   |
| `CONTACT_REACH_LIMIT_PEER` | 1002 | addContact / acceptContactInvite（被邀请方联系人数量超限） |

说明：`CONTACT_SET_REMARK_NOT_FRIEND` 当前数值为 `223`，已与 `CONTACT_REACH_LIMIT=1001`、`CONTACT_REACH_LIMIT_PEER=1002` 解耦，不再存在历史冲突。

### 4.5 addUsersToBlocklist 缺失的错误场景

移动端 `saveBlackList` 在 HTTP 400 时检查 `"almost reached or been greater than the upper range"` → `EXCEED_SERVICE_LIMIT`(4)。Web SDK 已在 `addUsersToBlocklist` 中补齐 `blocklist_limit_exceeded` 映射。

### 4.6 不需要照搬的部分

- 移动端的 `handleError` 中 `checkConnect → waitConnectToServer` 是移动端特有的连接恢复策略，Web SDK 通过 `getRestContextOrThrow()` 隐式保证已登录
- 移动端的 `UserNotFoundException` 字符串匹配在 Web SDK 中已通过 `api-errors.json` 的 error key 匹配覆盖
- 移动端的 DNS fallback 重试在 Web SDK 中由 RestClient 传输层统一处理
