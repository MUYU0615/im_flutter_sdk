# UserInfoManager 错误码对照文档

> 基于移动端 C++ SDK（emclient-linux）`emuserinfomanager.cpp` 源码分析，对比 Web SDK 026 实现。
>
> 生成时间：2026-04-29

---

## 一、用户资料域错误码总表

| 移动端错误码 | 数值 | 含义 | Web SDK 现状 |
|---|---|---|---|
| `USER_NOT_LOGIN` | 201 | 未登录 | ✅ `AUTH_NOT_LOGIN` |
| `USER_AUTHENTICATION_FAILED` | 202 | 鉴权失败 | ✅ `AUTH_UNAUTHORIZED` |
| `USER_NOT_FOUND` | 204 | 用户不存在 | ✅ 通用 |
| `USER_ILLEGAL_ARGUMENT` | 205 | 非法参数 | ✅ `VALIDATION_REQUIRED`(110) |
| `SERVER_NOT_REACHABLE` | 300 | 服务器不可达 | ✅ |
| `GENERAL_ERROR` | 1 | 通用错误（JSON 解析失败） | ✅ `UNKNOWN` |
| `EXCEED_SERVICE_LIMIT` | 4 | 超出服务限制（HTTP 429） | ✅ |
| `USERINFO_USERCOUNT_EXCEED` | 900 | 批量查询用户数超限 | ✅ `USERINFO_USERCOUNT_EXCEED` |
| `USERINFO_DATALENGTH_EXCEED` | 901 | 用户资料数据长度超限 | ✅ `USERINFO_DATALENGTH_EXCEED` |

---

## 二、各 API 错误码详情

### updateOwnUserInfo

REST: `PUT /metadata/user/{userId}`

| 错误码 | 数值 | 触发条件 | 判断规则 |
|---|---|---|---|
| `USER_ILLEGAL_ARGUMENT` | 205 | 属性 JSON 为空 | `strUsrProperty.empty()` |
| `USER_NOT_LOGIN` | 201 | 未登录 | `!isLoggedIn()` |
| `USER_NOT_FOUND` | 204 | HTTP 404 | |
| `USER_AUTHENTICATION_FAILED` | 202 | HTTP 401（刷新 token 后仍失败） | |
| `USERINFO_DATALENGTH_EXCEED` | 901 | HTTP 403 | 用户资料数据长度超限 |
| `EXCEED_SERVICE_LIMIT` | 4 | HTTP 429 | 限流 |
| `GENERAL_ERROR` | 1 | HTTP 2xx 但 JSON 解析失败 | |
| `SERVER_NOT_REACHABLE` | 300 | 其他 HTTP 错误（备用地址重试后仍失败） | 兜底 |

---

### fetchUserInfoByUserId（fetchUsersPropertyByType）

REST: `POST /metadata/user/get`

| 错误码 | 数值 | 触发条件 | 判断规则 |
|---|---|---|---|
| `USER_ILLEGAL_ARGUMENT` | 205 | users 列表为空 | `users.empty()` |
| `USER_NOT_LOGIN` | 201 | 未登录 | `!isLoggedIn()` |
| `USER_NOT_FOUND` | 204 | HTTP 404 | |
| `USER_AUTHENTICATION_FAILED` | 202 | HTTP 401（刷新 token 后仍失败） | |
| `USERINFO_USERCOUNT_EXCEED` | 900 | HTTP 400 | 批量查询用户数超限 |
| `EXCEED_SERVICE_LIMIT` | 4 | HTTP 429 | 限流 |
| `GENERAL_ERROR` | 1 | HTTP 2xx 但 JSON 解析失败 | |
| `SERVER_NOT_REACHABLE` | 300 | 其他 HTTP 错误（备用地址重试后仍失败） | 兜底 |

---

### getUserInfoFromLocal

| 错误码 | 数值 | 触发条件 |
|---|---|---|
| `USER_ILLEGAL_ARGUMENT` | 205 | userIds 为空 |
| `GENERAL_ERROR` | 1 | 数据库为 null |

纯本地操作，无网络请求。

---

### addListener / removeListener

无错误码。纯内存操作。

---

## 三、Web SDK 对比分析

### 3.1 已对齐的部分

- 参数校验（userId 为空等）→ `ValidationError` ✅
- `runOperation` + `normalizeSdkError` 统一错误包装 ✅
- 订阅相关 API（`subscribeUsersInfo` 等）有完整的 api-errors.json 定义 ✅
- `USER_INFO_SUBSCRIPTION_LIMIT_EXCEEDED` / `USER_INFO_SUBSCRIPTION_TARGET_LIMIT_EXCEEDED` 已定义 ✅

### 3.2 api-errors.json 对齐情况

| API | Web SDK 当前状态 |
|---|---|
| `updateOwnUserInfo` | ✅ 已覆盖 `901 / 204 / 4` |
| `fetchUserInfoByUserId` | ✅ 已覆盖 `900 / 204 / 4` |
| `subscribeUsersInfo` / `unsubscribeUsersInfo` / `getSubscribedUsers` | ✅ 已覆盖 `202 / 210 / 1600 / 1601`，并补充真实 `illegal_argument` / `operation forbidden` 匹配与 `429 / 500` 通用兜底 |

### 3.3 error-codes.ts 对齐情况

| 常量 | 数值 | 含义 | 来源 |
|---|---|---|---|
| `USERINFO_USERCOUNT_EXCEED` | 900 | 批量查询用户数超限 | fetchUserInfoByUserId（HTTP 400） |
| `USERINFO_DATALENGTH_EXCEED` | 901 | 用户资料数据长度超限 | updateOwnUserInfo（HTTP 403） |
| `USER_INFO_SUBSCRIPTION_LIMIT_EXCEEDED` | 1600 | 订阅人数超限 | subscribeUsersInfo（HTTP 400） |
| `USER_INFO_SUBSCRIPTION_TARGET_LIMIT_EXCEEDED` | 1601 | 目标用户被订阅人数超限 | subscribeUsersInfo（HTTP 400） |

### 3.4 不需要照搬的部分

- 移动端的 `getUserInfoFromLocal` 是本地 DB 读取，Web SDK 通过 `CacheManager` 实现，不需要单独的错误码
- 移动端的 token 刷新重试和 DNS fallback 由 Web SDK 的 RestClient 统一处理
- 移动端的 `onUserInfoUpdated` 事件处理在 Web SDK 中已有独立实现

### 3.5 当前通用兜底策略

- 未命中专属业务映射的 HTTP 400：统一收口为 `110` 参数错误
- 未命中专属业务映射的 HTTP 401：统一收口为 `108` token 失效
- 未命中专属业务映射的 HTTP 403：统一收口为 `210` 服务未开通或无权限
- 未命中专属业务映射的 HTTP 429：统一收口为 `4` 超过服务限制
- 未命中专属业务映射的 HTTP 5xx：统一收口为 `303` 服务端未知错误
