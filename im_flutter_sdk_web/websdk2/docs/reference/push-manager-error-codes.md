# PushManager 错误码对照文档

> 基于移动端 C++ SDK（emclient-linux）`empushmanager.cpp` 源码分析，对比 Web SDK 021 实现。
>
> 生成时间：2026-04-28

---

## 一、推送域错误码总表

| 移动端错误码 | 数值 | 含义 | Web SDK 现状 |
|---|---|---|---|
| `USER_NOT_LOGIN` | 201 | 未登录 | ✅ `AUTH_NOT_LOGIN` |
| `USER_AUTHENTICATION_FAILED` | 202 | 鉴权失败 | ✅ `AUTH_UNAUTHORIZED` |
| `USER_NOT_FOUND` | 204 | 用户不存在 | ✅ 通用 |
| `USER_ILLEGAL_ARGUMENT` | 205 | 非法参数 | ✅ `VALIDATION_REQUIRED`(110) |
| `PUSH_UPDATECONFIGS_FAILED` | 209 | 推送配置更新失败 | ❌ 缺失 |
| `SERVER_NOT_REACHABLE` | 300 | 服务器不可达 | ✅ |
| `SERVER_UNKNOWN_ERROR` | 303 | 服务器未知错误 | ✅ |
| `SERVER_NO_MATCHING_URL` | 308 | 无匹配 URL | ❌ 缺失（仅 getSilentModeForAllConversations 使用） |
| `SERVER_RESPONSE_ILLEGAL` | 309 | 响应数据非法 | ❌ 缺失（仅解析免打扰列表使用） |
| `EXCEED_SERVICE_LIMIT` | 4 | 超出服务限制（HTTP 429） | ✅ |
| `PUSH_NOT_SUPPORT` | 1500 | 设备不支持推送 | ✅ `PUSH_TOKEN_UPLOAD_FAILED`(1500) |
| `PUSH_BIND_FAILED` | 1501 | 推送绑定失败 | ✅ `PUSH_SILENT_MODE_OPERATION_FAILED`(1501) |
| `PUSH_UNBIND_FAILED` | 1502 | 推送解绑失败 | ✅ `PUSH_LANGUAGE_OPERATION_FAILED`(1502) |

---

## 二、通用 REST 处理 _pushConfigBaseRequest

大多数推送 API 共用此函数：

```
未登录 → USER_NOT_LOGIN (201)

HTTP 404 → USER_NOT_FOUND (204)
HTTP 429 → EXCEED_SERVICE_LIMIT (4)
HTTP 401:
  首次 → 刷新 token 重试
  重试后 → USER_AUTHENTICATION_FAILED (202)
其他 → PUSH_UPDATECONFIGS_FAILED (209)，切换备用地址重试
```

---

## 三、各 API 错误码详情

### getUserConfigsFromServer（getPushConfigs）

| 错误码 | 数值 | 触发条件 |
|---|---|---|
| `USER_NOT_LOGIN` | 201 | 未登录 |
| `USER_NOT_FOUND` | 204 | HTTP 404 |
| `USER_AUTHENTICATION_FAILED` | 202 | HTTP 401（刷新 token 后仍失败） |
| `SERVER_NOT_REACHABLE` | 300 | 连接失败 / HTTP 504 |
| `PUSH_UPDATECONFIGS_FAILED` | 209 | 其他 HTTP 错误 / 响应解析失败 |

---

### setSilentModeForAll / setSilentModeForConversation

| 错误码 | 数值 | 触发条件 |
|---|---|---|
| `USER_ILLEGAL_ARGUMENT` | 205 | 参数为空 |
| `USER_NOT_LOGIN` | 201 | 未登录 |
| + _pushConfigBaseRequest 通用错误 | — | 见第二节 |

---

### getSilentModeForAll / getSilentModeForConversation

| 错误码 | 数值 | 触发条件 |
|---|---|---|
| `USER_NOT_LOGIN` | 201 | 未登录 |
| + _pushConfigBaseRequest 通用错误 | — | 见第二节 |

---

### getSilentModeForAllConversations

| 错误码 | 数值 | 触发条件 |
|---|---|---|
| `USER_NOT_LOGIN` | 201 | 未登录 |
| `SERVER_NO_MATCHING_URL` | 308 | HTTP 404 |
| `USER_NOT_FOUND` | 204 | HTTP 400 |
| `EXCEED_SERVICE_LIMIT` | 4 | HTTP 429 |
| `USER_AUTHENTICATION_FAILED` | 202 | HTTP 401（刷新 token 后仍失败） |
| `SERVER_UNKNOWN_ERROR` | 303 | 其他 HTTP 错误 |
| `SERVER_RESPONSE_ILLEGAL` | 309 | 响应 JSON 解析失败 / 缺少 data 字段 |

---

### updatePushNickName / updatePushDisplayStyle / updatePushNoDisturbing

| 错误码 | 数值 | 触发条件 |
|---|---|---|
| + _updateUserConfigsWithParams → _pushConfigBaseRequest | — | 见第二节 |

---

### bindUserDeviceToken / unBindUserDeviceToken

| 错误码 | 数值 | 触发条件 |
|---|---|---|
| + _pushConfigBaseRequest 通用错误 | — | 见第二节 |

---

### setPreferredNotificationLanguage / getPreferredNotificationLanguage

| 错误码 | 数值 | 触发条件 |
|---|---|---|
| `USER_NOT_LOGIN` | 201 | 未登录 |
| + _pushConfigBaseRequest 通用错误 | — | 见第二节 |

---

## 四、Web SDK 对比分析

### 4.1 已对齐

- `PUSH_TOKEN_UPLOAD_FAILED`(1500)、`PUSH_SILENT_MODE_OPERATION_FAILED`(1501)、`PUSH_LANGUAGE_OPERATION_FAILED`(1502) ✅
- 通用 REST 错误（401/404/429）通过 RestClient 统一处理 ✅
- 参数校验通过 `runOperation` + `ValidationError` ✅

### 4.2 需要补充

| 缺失项 | 数值 | 说明 | 建议 |
|---|---|---|---|
| `PUSH_UPDATECONFIGS_FAILED` | 209 | 推送配置更新失败（兜底错误） | 可映射到现有 `REST_BUSINESS_UNKNOWN`(303)，不需要新增专属码 |

### 4.3 总结

PushManager 的错误处理非常简单，几乎全是通用 REST 错误。移动端的 `PUSH_UPDATECONFIGS_FAILED`(209) 是一个兜底错误码，Web SDK 用 `REST_BUSINESS_UNKNOWN`(303) 覆盖即可。`SERVER_NO_MATCHING_URL`(308) 和 `SERVER_RESPONSE_ILLEGAL`(309) 是移动端特有的，Web SDK 不需要照搬。

**Web SDK 的推送域错误码已基本完整，无需新增错误码。**
