# PresenceManager 错误码对照文档

> 基于移动端 C++ SDK（emclient-linux）`empresencemanager.cpp` 源码分析，对比 Web SDK 016 实现。
>
> 生成时间：2026-04-28

---

## 一、在线状态域错误码总表

| 移动端错误码 | 数值 | 含义 | Web SDK 现状 |
|---|---|---|---|
| `USER_NOT_LOGIN` | 201 | 未登录 | ✅ `AUTH_NOT_LOGIN` |
| `USER_AUTHENTICATION_FAILED` | 202 | 鉴权失败 | ✅ `AUTH_UNAUTHORIZED` |
| `USER_NOT_FOUND` | 204 | 用户不存在 | ✅ 通用 |
| `GENERAL_ERROR` | 1 | 通用错误（参数为空/JSON 解析失败） | ✅ `UNKNOWN` |
| `SERVER_NOT_REACHABLE` | 300 | 服务器不可达 | ✅ |
| `SERVER_UNKNOWN_ERROR` | 303 | 服务器未知错误（HTTP 403） | ✅ |
| `PRESENCE_PARAM_LENGTH_EXCEED` | 1100 | 参数长度超限 | ✅ `common.presence`(1100) |
| `PRESENCE_CANNOT_SUBSCRIBE_YOURSELF` | 1101 | 不能订阅自己 | ❌ 缺失 |

---

## 二、通用 REST 处理 performRequest

所有 API 共用此函数，判断逻辑：

```
连接失败 / HTTP 504:
  首次 → 重试
  重试后 → SERVER_NOT_REACHABLE (300)

HTTP 404 → USER_NOT_FOUND (204)

HTTP 401:
  首次 → 刷新 token 重试
  重试后 → USER_AUTHENTICATION_FAILED (202)

HTTP 403 → SERVER_UNKNOWN_ERROR (303)

HTTP 400:
  解析 response JSON 的 result 字段：
    result 包含 "you can't sub yourself" → PRESENCE_CANNOT_SUBSCRIBE_YOURSELF (1101)
    其他 → PRESENCE_PARAM_LENGTH_EXCEED (1100)

RETRY_HOST / NEXT_HOST:
  首次 → 切换备用地址重试
  重试后 → SERVER_NOT_REACHABLE (300)

其他 → GENERAL_ERROR (1)
```

---

## 三、各 API 错误码详情

### publishPresence

| 错误码 | 数值 | 触发条件 |
|---|---|---|
| `USER_NOT_LOGIN` | 201 | 未登录 |
| `SERVER_UNKNOWN_ERROR` | 303 | HTTP 2xx 但 result != "ok" |
| + performRequest 通用错误 | — | 见第二节 |

---

### subscribePresences

| 错误码 | 数值 | 触发条件 |
|---|---|---|
| `GENERAL_ERROR` | 1 | members 为空 |
| `USER_NOT_LOGIN` | 201 | 未登录 |
| `PRESENCE_CANNOT_SUBSCRIBE_YOURSELF` | 1101 | HTTP 400 + result ⊃ "you can't sub yourself" |
| `PRESENCE_PARAM_LENGTH_EXCEED` | 1100 | HTTP 400 其他 |
| + performRequest 通用错误 | — | 见第二节 |

---

### unsubscribePresences

| 错误码 | 数值 | 触发条件 |
|---|---|---|
| `GENERAL_ERROR` | 1 | members 为空 |
| `USER_NOT_LOGIN` | 201 | 未登录 |
| `SERVER_UNKNOWN_ERROR` | 303 | HTTP 2xx 但 result != "ok" |
| + performRequest 通用错误 | — | 见第二节 |

---

### fetchSubscribedMembers

| 错误码 | 数值 | 触发条件 |
|---|---|---|
| `USER_NOT_LOGIN` | 201 | 未登录 |
| `GENERAL_ERROR` | 1 | HTTP 2xx 但 JSON 解析失败 |
| + performRequest 通用错误 | — | 见第二节 |

---

### fetchPresenceStatus

| 错误码 | 数值 | 触发条件 |
|---|---|---|
| `GENERAL_ERROR` | 1 | members 为空 |
| `USER_NOT_LOGIN` | 201 | 未登录 |
| `GENERAL_ERROR` | 1 | HTTP 2xx 但 JSON 解析失败 |
| + performRequest 通用错误 | — | 见第二节 |

---

## 四、Web SDK 对比分析

### 4.1 已对齐

- `PRESENCE_PARAM_LENGTH_EXCEED`(1100) 在 `common.presence` 中已定义 ✅
- 参数校验和 `runOperation` 统一错误包装 ✅

### 4.2 需要补充

| 缺失项 | 数值 | 涉及 API | 建议 |
|---|---|---|---|
| `PRESENCE_CANNOT_SUBSCRIBE_YOURSELF` | 1101 | subscribePresences | 新增到 `common.presence` 和 `error-codes.ts`，matchPattern: "you can't sub yourself" |

### 4.3 api-errors.json 缺失的 per-API 定义

当前 `presence` 只在 `common` 段有一个 1100 错误，没有 per-API 定义。建议新增：

| API | 建议补充的错误 |
|---|---|
| `publishPresence` | 无特殊错误（通用即可） |
| `subscribePresences` | `PRESENCE_CANNOT_SUBSCRIBE_YOURSELF`(1101) |
| `unsubscribePresences` | 无特殊错误 |
| `fetchSubscribedMembers` | 无特殊错误 |
| `fetchPresenceStatus` | 无特殊错误 |

### 4.4 总结

PresenceManager 的错误处理非常简单，只有 2 个专属错误码（1100/1101），其余全是通用错误。Web SDK 只缺 `PRESENCE_CANNOT_SUBSCRIBE_YOURSELF`(1101) 一个。
