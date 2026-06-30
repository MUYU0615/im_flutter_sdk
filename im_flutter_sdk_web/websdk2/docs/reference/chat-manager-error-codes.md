# ChatManager 错误码对照文档

> 基于移动端 C++ SDK（emclient-linux）`emchatmanager.cpp` + `emreactionmanager.cpp` 源码分析，对比当前 Web SDK 实现。
>
> 生成时间：2026-05-20

---

## 一、消息域错误码总表

| 移动端错误码                      | 数值 | 含义                | Web SDK 现状                        |
| --------------------------------- | ---- | ------------------- | ----------------------------------- |
| `USER_NOT_LOGIN`                  | 201  | 未登录              | ✅ `AUTH_NOT_LOGIN`                 |
| `USER_AUTHENTICATION_FAILED`      | 202  | 鉴权失败            | ✅ `AUTH_UNAUTHORIZED`              |
| `USER_ILLEGAL_ARGUMENT`           | 205  | 非法参数            | ✅ `VALIDATION_INVALID_FORMAT`(110) |
| `USER_PERMISSION_DENIED`          | 210  | 无权限              | ✅ `AUTH_FORBIDDEN`                 |
| `USER_MUTED`                      | 215  | 用户被禁言          | ✅ `AUTH_USER_MUTED`                |
| `USER_MUTED_BY_ADMIN`             | 219  | 被管理员禁言        | ✅ `USER_MUTED_BY_ADMIN`            |
| `USER_NOT_ON_ROSTER`              | 221  | 非好友不能发消息    | ✅ `USER_NOT_ON_ROSTER`             |
| `SERVER_NOT_REACHABLE`            | 300  | 服务器不可达        | ✅                                  |
| `SERVER_TIMEOUT`                  | 301  | 服务器超时          | ✅                                  |
| `SERVER_BUSY`                     | 302  | 服务器繁忙          | ✅ `SERVER_BUSY`                    |
| `SERVER_UNKNOWN_ERROR`            | 303  | 服务器未知错误      | ✅                                  |
| `SERVER_SERVING_DISABLED`         | 305  | 服务已禁用          | ❌ 缺失                             |
| `INVALID_PARAM`                   | 110  | 参数无效            | ✅                                  |
| `OPERATION_UNSUPPORTED`           | 111  | 不支持的操作        | ❌ 缺失                             |
| `QUERY_PARAM_REACHES_LIMIT`       | 112  | 查询参数超限        | ✅ 复用 `SERVICE_LIMIT_EXCEEDED`    |
| `INVALID_CONVERSATION`            | 107  | 会话无效            | ❌ 缺失                             |
| `FILE_NOT_FOUND`                  | 400  | 文件不存在          | ❌ 缺失                             |
| `FILE_INVALID`                    | 401  | 文件无效            | ❌ 缺失                             |
| `FILE_UPLOAD_FAILED`              | 402  | 上传失败            | ✅ `UPLOAD_REQUEST_FAILED`          |
| `FILE_DOWNLOAD_FAILED`            | 403  | 下载失败            | ❌ 缺失                             |
| `FILE_TOO_LARGE`                  | 405  | 文件过大            | ❌ 缺失                             |
| `FILE_CONTENT_IMPROPER`           | 406  | 文件内容不当        | ❌ 缺失                             |
| `FILE_IS_EXPIRED`                 | 407  | 文件已过期          | ❌ 缺失                             |
| `MESSAGE_INVALID`                 | 500  | 消息无效            | ✅ 部分覆盖                         |
| `MESSAGE_INCLUDE_ILLEGAL_CONTENT` | 501  | 消息含非法内容      | ❌ 缺失                             |
| `MESSAGE_SEND_TRAFFIC_LIMIT`      | 502  | 发送限流            | ❌ 缺失                             |
| `MESSAGE_RECALL_TIME_LIMIT`       | 504  | 撤回超时限          | ❌ 缺失                             |
| `SERVICE_NOT_ENABLED`             | 505  | 服务未开通          | ❌ 缺失                             |
| `MESSAGE_EXPIRED`                 | 506  | 消息已过期          | ❌ 缺失                             |
| `MESSAGE_ILLEGAL_WHITELIST`       | 507  | 不在白名单中        | ❌ 缺失                             |
| `MESSAGE_EXTERNAL_LOGIC_BLOCKED`  | 508  | 外部逻辑拦截        | ❌ 缺失                             |
| `MESSAGE_CURRENT_LIMITING`        | 509  | 消息限流            | ❌ 缺失                             |
| `MESSAGE_SIZE_LIMIT`              | 510  | 消息体过大          | ❌ 缺失                             |
| `MESSAGE_EDIT_FAILED`             | 511  | 消息编辑失败        | ❌ 缺失                             |
| `EXCEED_SERVICE_LIMIT`            | 4    | 超出服务限制        | ✅                                  |
| `TRANSLATE_PARAM_INVALID`         | 1110 | 翻译参数无效        | ✅                                  |
| `TRANSLATE_SERVICE_NOT_ENABLE`    | 1111 | 翻译服务未开通      | ✅                                  |
| `TRANSLATE_USAGE_LIMIT`           | 1112 | 翻译用量超限        | ✅                                  |
| `TRANSLATE_MESSAGE_FAIL`          | 1113 | 翻译失败            | ✅                                  |
| `THIRD_MODERATION_FAILED`         | 1200 | 第三方审核拦截      | ❌ 缺失                             |
| `REACTION_REACH_LIMIT`            | 1300 | Reaction 数量超限   | ✅                                  |
| `REACTION_HAS_BEEN_OPERATED`      | 1301 | 已操作过该 Reaction | ✅                                  |
| `REACTION_OPERATION_IS_ILLEGAL`   | 1302 | Reaction 操作非法   | ✅                                  |

---

## 二、MSync 协议错误映射（handleSync）

`sendMessage`、`recallMessage`、`modifyMessage` 共用此映射。服务端通过 MSync 协议返回 status + reason 字符串。

### Status = FAIL + reason 字符串匹配

| reason 匹配规则                            | 错误码                                                                                        | 数值        |
| ------------------------------------------ | --------------------------------------------------------------------------------------------- | ----------- |
| `== "blocked"`                             | 按 chatType 分：GROUP_PERMISSION_DENIED / CHATROOM_PERMISSION_DENIED / USER_PERMISSION_DENIED | 603/703/210 |
| `== "group not found"`                     | `GROUP_NOT_EXIST`                                                                             | 606         |
| `== "illegal chatroom tag"`                | `MESSAGE_INVALID`                                                                             | 500         |
| `== "not in group or chatroom"`            | 按 chatType 分：GROUP_NOT_JOINED / CHATROOM_NOT_JOINED                                        | 602/702     |
| `== "exceed recall time limit"`            | `MESSAGE_RECALL_TIME_LIMIT`                                                                   | 504         |
| `== "message recall disabled"`             | `SERVICE_NOT_ENABLED`                                                                         | 505         |
| `== "group ack not open"`                  | `SERVICE_NOT_ENABLED`                                                                         | 505         |
| `== "group ack msg permission denied"`     | `GROUP_PERMISSION_DENIED`                                                                     | 603         |
| `== "the message has expired"`             | `MESSAGE_EXPIRED`                                                                             | 506         |
| `== "limit send group ack msg"`            | `EXCEED_SERVICE_LIMIT`                                                                        | 4           |
| `== "not in group or chatroom white list"` | `MESSAGE_ILLEGAL_WHITELIST`                                                                   | 507         |
| `== "nonroster"`                           | `USER_NOT_ON_ROSTER`                                                                          | 221         |
| `== "group is disabled"`                   | `GROUP_DISABLED`                                                                              | 607         |
| `== "roaming is not open"`                 | `SERVICE_NOT_ENABLED`                                                                         | 505         |
| `== "Sorry, message does not exist"`       | `MESSAGE_INVALID`                                                                             | 500         |
| `== "Sorry, edit limit reached"`           | `EXCEED_SERVICE_LIMIT`                                                                        | 4           |
| `== "Sorry, You do not have permission"`   | `USER_PERMISSION_DENIED`                                                                      | 210         |
| `== "Sorry, format is incorrect"`          | `INVALID_PARAM`                                                                               | 110         |
| `== "Sorry, edit is not available"`        | `SERVER_SERVING_DISABLED`                                                                     | 305         |
| `== "Sorry, edit fail"`                    | `MESSAGE_EDIT_FAILED`                                                                         | 511         |
| `.find("limit directed users")`            | `EXCEED_SERVICE_LIMIT`                                                                        | 4           |
| `.find("no permission to recall message")` | `USER_PERMISSION_DENIED`                                                                      | 210         |
| JSON 解析 `error_type == "moderation"`     | `THIRD_MODERATION_FAILED`                                                                     | 1200        |
| JSON 解析 `error_type` 其他                | `THIRD_DEFAULT_FAILED`                                                                        | 1299        |
| 其他                                       | `SERVER_UNKNOWN_ERROR`                                                                        | 303         |

### Status = USER_MUTED → `USER_MUTED`(215)

### Status = PERMISSION_DENIED + reason 字符串匹配

| reason 匹配规则                 | 错误码                            | 数值 |
| ------------------------------- | --------------------------------- | ---- |
| `== "sensitive words"`          | `MESSAGE_INCLUDE_ILLEGAL_CONTENT` | 501  |
| `== "blocked by mod_antispam"`  | `MESSAGE_INCLUDE_ILLEGAL_CONTENT` | 501  |
| `== "user is mute"`             | `USER_MUTED_BY_ADMIN`             | 219  |
| `== "traffic limit"`            | `MESSAGE_CURRENT_LIMITING`        | 509  |
| `== "Sorry, data is too large"` | `MESSAGE_SIZE_LIMIT`              | 510  |

### Status = PERMISSION_DENIED_EXTERNAL → `MESSAGE_EXTERNAL_LOGIC_BLOCKED`(508)

---

## 三、各 API 错误码详情

### sendMessage

> 错误通过 callback 传递，非 EMError& 输出参数。

**入口校验：**

| 错误码               | 数值 | 触发条件                                                     |
| -------------------- | ---- | ------------------------------------------------------------ |
| `USER_NOT_LOGIN`     | 201  | 未登录                                                       |
| `MESSAGE_INVALID`    | 500  | msgId 为空 / bodies 为空 / from 不匹配当前用户 / to 为空     |
| `INVALID_PARAM`      | 110  | 合并消息列表为空或超过 300 条 / 子消息未找到或状态非 SUCCESS |
| `MESSAGE_INVALID`    | 500  | 合并消息嵌套层级 ≥ 10                                        |
| `FILE_UPLOAD_FAILED` | 402  | 合并消息附件文件生成失败                                     |

**发送阶段（asyncSendMessage）：**

| 错误码                  | 数值 | 触发条件                                             |
| ----------------------- | ---- | ---------------------------------------------------- |
| `FILE_INVALID`          | 401  | 附件文件不存在、为空或无法打开                       |
| `FILE_TOO_LARGE`        | 405  | 上传时 HTTP 413                                      |
| `FILE_CONTENT_IMPROPER` | 406  | 上传时 HTTP 400 + response 包含 `"content improper"` |
| `FILE_UPLOAD_FAILED`    | 402  | 上传重试后仍失败                                     |
| `SERVER_NOT_REACHABLE`  | 300  | 所有重试耗尽后消息仍在 DELIVERING 状态               |
| + handleSync 映射       | —    | 见第二节 MSync 协议错误映射                          |

---

### recallMessage

| 错误码                      | 数值 | 触发条件                                      |
| --------------------------- | ---- | --------------------------------------------- |
| `MESSAGE_INVALID`           | 500  | msg 为空 / msgId 为空 / bodies 为空           |
| `USER_NOT_LOGIN`            | 201  | 未登录                                        |
| `SERVER_NOT_REACHABLE`      | 300  | 未连接                                        |
| `MESSAGE_INVALID`           | 500  | 消息状态非 SUCCESS / 单聊中尝试撤回接收的消息 |
| `MESSAGE_RECALL_TIME_LIMIT` | 504  | 服务端返回 "exceed recall time limit"         |
| `USER_PERMISSION_DENIED`    | 210  | 服务端返回 "no permission to recall message"  |
| `SERVICE_NOT_ENABLED`       | 505  | 服务端返回 "message recall disabled"          |
| `SERVER_NOT_REACHABLE`      | 300  | 发送超时 / 连接断开                           |
| + handleSync 映射           | —    | 见第二节                                      |

---

### modifyMessage（updateMessage）

| 错误码                    | 数值 | 触发条件                                  |
| ------------------------- | ---- | ----------------------------------------- |
| `MESSAGE_INVALID`         | 500  | 消息未找到 / msgId 为空 / bodies 为空     |
| `INVALID_PARAM`           | 110  | body 和 extJson 均为空                    |
| `OPERATION_UNSUPPORTED`   | 111  | 尝试修改消息类型（body type 不匹配）      |
| `OPERATION_UNSUPPORTED`   | 111  | body 类型非 TEXT / CUSTOM                 |
| `USER_NOT_LOGIN`          | 201  | 未登录或未连接                            |
| `USER_PERMISSION_DENIED`  | 210  | 单聊中尝试编辑非自己发送的消息            |
| `MESSAGE_EDIT_FAILED`     | 511  | 服务端返回 "Sorry, edit fail"             |
| `EXCEED_SERVICE_LIMIT`    | 4    | 服务端返回 "Sorry, edit limit reached"    |
| `SERVER_SERVING_DISABLED` | 305  | 服务端返回 "Sorry, edit is not available" |
| `SERVER_TIMEOUT`          | 301  | 发送过程中用户登出                        |
| `SERVER_NOT_REACHABLE`    | 300  | 发送超时                                  |
| + handleSync 映射         | —    | 见第二节                                  |

**移动端行为**：内置 2 次重试，401 自动刷新 token。仅 TEXT 和 CUSTOM 类型可编辑 body。

---

### sendReadAckForConversation（markConversationRead）

| 错误码                 | 数值 | 触发条件     |
| ---------------------- | ---- | ------------ |
| `USER_NOT_LOGIN`       | 201  | 未登录       |
| `SERVER_NOT_REACHABLE` | 300  | 未连接       |
| `MESSAGE_INVALID`      | 500  | 会话中无消息 |

**移动端行为**：同步校验后异步发送（fire-and-forget），发送本身无回调。

---

### markMessageRead

> 移动端无 EMError 输出，所有失败静默返回 false。

| 条件                    | 移动端行为 | Web SDK 建议           |
| ----------------------- | ---------- | ---------------------- |
| 消息方向为 SEND         | 静默 false | 抛出 `ValidationError` |
| 已发送过已读回执        | 静默 false | 静默忽略（幂等）       |
| msgId 为空              | 静默 false | 抛出 `ValidationError` |
| 非单聊/群聊消息         | 静默 false | 抛出 `ValidationError` |
| 未登录或未连接          | 静默 false | 抛出 `ConnectionError` |

---

---

### fetchHistoryMessages（getHistoryMessages）

**MSync 版：**

| 错误码                  | 数值 | 触发条件                |
| ----------------------- | ---- | ----------------------- |
| `USER_ILLEGAL_ARGUMENT` | 205  | conversationId 为空     |
| `USER_NOT_LOGIN`        | 201  | 未登录 / 发送过程中登出 |
| `SERVER_TIMEOUT`        | 301  | 所有重试耗尽后超时      |
| 服务端动态错误码        | —    | 服务端返回 flag > 0     |

**REST 版：**

| 错误码                       | 数值 | 触发条件                                                                      |
| ---------------------------- | ---- | ----------------------------------------------------------------------------- |
| `USER_NOT_LOGIN`             | 201  | 未登录                                                                        |
| `USER_NOT_FOUND`             | 204  | HTTP 404                                                                      |
| `EXCEED_SERVICE_LIMIT`       | 4    | HTTP 400 + error_desc ⊃ "pull number cannot be greater" / "limit is to large" |
| `USER_AUTHENTICATION_FAILED` | 202  | HTTP 401（刷新 token 后仍失败）                                               |
| `SERVICE_NOT_ENABLED`        | 505  | HTTP 403 + error_desc ⊃ "not open"                                            |
| `SERVER_UNKNOWN_ERROR`       | 303  | HTTP 400 其他 / JSON 解析失败                                                 |
| `SERVER_NOT_REACHABLE`       | 300  | 其他 HTTP 错误                                                                |

---

### removeMessagesFromServer（removeHistoryMessages）

**按消息 ID 删除：**

| 错误码                       | 数值 | 触发条件                                                             |
| ---------------------------- | ---- | -------------------------------------------------------------------- |
| `USER_NOT_LOGIN`             | 201  | 未登录                                                               |
| `INVALID_PARAM`              | 110  | msgIdList 为空 / conversationId 为空                                 |
| `INVALID_CONVERSATION`       | 107  | 会话类型非 CHAT/GROUPCHAT/CHATROOM                                   |
| `USER_NOT_FOUND`             | 204  | HTTP 404                                                             |
| `SERVICE_NOT_ENABLED`        | 505  | HTTP 400 + error_desc == "this appKey not open message roaming"      |
| `QUERY_PARAM_REACHES_LIMIT`  | 112  | HTTP 400 + error_desc ⊃ "delete msg list limit can not greater than" |
| `USER_AUTHENTICATION_FAILED` | 202  | HTTP 401（重试后仍失败）                                             |
| `SERVER_UNKNOWN_ERROR`       | 303  | JSON 解析失败                                                        |
| `SERVER_NOT_REACHABLE`       | 300  | 其他 HTTP 错误                                                       |

**按时间戳删除：** 错误码基本一致，`INVALID_PARAM` 触发条件改为 `beforeTimeStamp <= 0`。

---

### downloadAttachments（downloadMessageAttachment）

| 错误码                   | 数值 | 触发条件                                       |
| ------------------------ | ---- | ---------------------------------------------- |
| `FILE_DOWNLOAD_FAILED`   | 403  | 下载 URL 或本地路径为空                        |
| `FILE_DOWNLOAD_FAILED`   | 403  | HTTP 401 鉴权失败（刷新 token 后仍失败）       |
| `USER_PERMISSION_DENIED` | 210  | HTTP 403                                       |
| `EXCEED_SERVICE_LIMIT`   | 4    | HTTP 429                                       |
| `FILE_IS_EXPIRED`        | 407  | HTTP 404 + error desc ⊃ "is expired"           |
| `FILE_NOT_FOUND`         | 400  | HTTP 404 + error desc ⊃ "file may not exists"  |
| `FILE_DOWNLOAD_FAILED`   | 403  | HTTP 404 其他 / 其他 HTTP 错误（重试后仍失败） |

**重试策略**：401 刷新 token 重试一次；其他错误用备用 URL 重试一次；404 不重试。

---

### downloadAndParseCombineMessage（移动端 downloadCombineMessages）

| 错误码                 | 数值 | 触发条件                                      |
| ---------------------- | ---- | --------------------------------------------- |
| `INVALID_PARAM`        | 110  | 消息为 null                                   |
| `MESSAGE_INVALID`      | 500  | 消息不是合并消息类型                          |
| `FILE_DOWNLOAD_FAILED` | 403  | 下载失败（含 downloadAttachments 的所有错误） |
| `FILE_INVALID`         | 401  | 本地文件存在但解析失败                        |

---

### fetchGroupReadAcks（getGroupMessageReadUsers）

| 错误码                 | 数值 | 触发条件                              |
| ---------------------- | ---- | ------------------------------------- |
| `SERVER_UNKNOWN_ERROR` | 303  | 响应 JSON 解析失败 / 缺少 `data` 字段 |
| `MESSAGE_INVALID`      | 500  | HTTP 404（消息不存在）                |
| `EXCEED_SERVICE_LIMIT` | 4    | HTTP 429                              |

---

### fetchSupportLanguages（getSupportedTranslationLanguages）

| 错误码                       | 数值 | 触发条件                            |
| ---------------------------- | ---- | ----------------------------------- |
| `SERVER_NOT_REACHABLE`       | 300  | 连接失败 / HTTP 504（重试后仍失败） |
| `USER_NOT_FOUND`             | 204  | HTTP 404                            |
| `USER_AUTHENTICATION_FAILED` | 202  | HTTP 401（刷新 token 后仍失败）     |
| `SERVER_UNKNOWN_ERROR`       | 303  | HTTP 403                            |
| `GENERAL_ERROR`              | 1    | 其他 HTTP 错误 / JSON 解析失败      |

---

### translateMessage

| 错误码                         | 数值 | 触发条件                        |
| ------------------------------ | ---- | ------------------------------- |
| `GENERAL_ERROR`                | 1    | 消息 body 类型非 TEXT           |
| `TRANSLATE_PARAM_INVALID`      | 1110 | HTTP 400                        |
| `TRANSLATE_SERVICE_NOT_ENABLE` | 1111 | HTTP 403                        |
| `TRANSLATE_USAGE_LIMIT`        | 1112 | HTTP 429                        |
| `TRANSLATE_MESSAGE_FAIL`       | 1113 | HTTP 500                        |
| `SERVER_NOT_REACHABLE`         | 300  | 连接失败（重试后仍失败）        |
| `USER_AUTHENTICATION_FAILED`   | 202  | HTTP 401（刷新 token 后仍失败） |

---

### addReaction / removeReaction

| 错误码                          | 数值 | 触发条件                                                                        |
| ------------------------------- | ---- | ------------------------------------------------------------------------------- |
| `INVALID_PARAM`                 | 110  | messageId 为空 / reaction 为空                                                  |
| `REACTION_REACH_LIMIT`          | 1300 | error_desc == "The quantity has exceeded the limit!"                            |
| `REACTION_HAS_BEEN_OPERATED`    | 1301 | error_desc == "the user is already operation this message"                      |
| `REACTION_OPERATION_IS_ILLEGAL` | 1302 | error_desc == "the user operation is illegal!"                                  |
| `SERVICE_NOT_ENABLED`           | 505  | error_desc == "this appKey is not open reaction service!"                       |
| `GROUP_NOT_JOINED`              | 602  | error_desc == "The user not in this group!"                                     |
| `GROUP_INVALID_ID`              | 600  | error_desc == "groupId can not be null!"                                        |
| `SERVER_BUSY`                   | 302  | HTTP 503 / error_desc == "this message is creating reaction, please try again." |
| `SERVER_TIMEOUT`                | 301  | HTTP 504                                                                        |
| `SERVER_NOT_REACHABLE`          | 300  | 连接失败 / 备用地址耗尽                                                         |

---

### getReactionList

| 错误码                    | 数值 | 触发条件                                                            |
| ------------------------- | ---- | ------------------------------------------------------------------- |
| `INVALID_PARAM`           | 110  | messageType 为空 / groupId 为空（groupchat 时）/ messageIdList 为空 |
| + Reaction 通用 REST 错误 | —    | 同 addReaction                                                      |

---

### getReactionDetail

| 错误码                    | 数值 | 触发条件                                      |
| ------------------------- | ---- | --------------------------------------------- |
| `INVALID_PARAM`           | 110  | messageId 为空 / reaction 为空 / pageSize ≤ 0 |
| + Reaction 通用 REST 错误 | —    | 同 addReaction                                |

---

### pinMessage / unpinMessage

| 错误码                       | 数值 | 触发条件                                    |
| ---------------------------- | ---- | ------------------------------------------- |
| `USER_NOT_LOGIN`             | 201  | 未登录                                      |
| `INVALID_PARAM`              | 110  | messageId 为空                              |
| `MESSAGE_INVALID`            | 500  | 消息未找到                                  |
| `INVALID_PARAM`              | 110  | HTTP 400                                    |
| `EXCEED_SERVICE_LIMIT`       | 4    | HTTP 403 + serverCode=91101（置顶数量超限） |
| `INVALID_PARAM`              | 110  | HTTP 403 + serverCode=91102 / HTTP 404      |
| `USER_AUTHENTICATION_FAILED` | 202  | HTTP 401（刷新 token 后仍失败）             |

---

### getPinnedMessageList

| 错误码                       | 数值 | 触发条件                    |
| ---------------------------- | ---- | --------------------------- |
| `USER_NOT_LOGIN`             | 201  | 未登录                      |
| `INVALID_PARAM`              | 110  | conversationId 为空         |
| `INVALID_CONVERSATION`       | 107  | 会话未找到                  |
| `INVALID_URL`                | 103  | HTTP 404                    |
| `USER_AUTHENTICATION_FAILED` | 202  | HTTP 401（重试后仍失败）    |
| `OPERATION_UNSUPPORTED`      | 111  | HTTP 403 + serverCode=15002 |
| `SERVER_UNKNOWN_ERROR`       | 303  | 响应解析失败                |

---

## 四、Web SDK 对比分析

### 4.1 api-errors.json 已覆盖的 API（14 个）

sendMessage、getHistoryMessages、removeHistoryMessages、getGroupMessageReadUsers、addReaction、removeReaction、getReactionList、getReactionDetail、pinMessage、unpinMessage、getPinnedMessageList、getSupportedTranslationLanguages、translateMessage

### 4.2 api-errors.json 完全缺失的 API（7 个）

| API                              | 需要的错误码                                                     |
| -------------------------------- | ---------------------------------------------------------------- |
| `markConversationRead`           | 201, 300, 500                                                    |
| `markMessageRead`                | 客户端校验错误（方向、类型、连接状态）                           |
| `recallMessage`                  | 500, 201, 300, 504, 210, 505 + handleSync 映射                   |
| `updateMessage`                  | 500, 110, 111, 201, 210, 511, 4, 305, 300, 301 + handleSync 映射 |
| `downloadMessageAttachment`      | 403, 210, 4, 407, 400                                            |
| `downloadAndParseCombineMessage` | 110, 500, 403, 401                                               |

### 4.3 error-codes.ts 需新增的错误码（FR-034）

| 常量                              | 数值 | 来源                                         |
| --------------------------------- | ---- | -------------------------------------------- |
| `MESSAGE_RECALL_TIME_LIMIT`       | 504  | recallMessage                                |
| `MESSAGE_EDIT_FAILED`             | 511  | updateMessage                                |
| `MESSAGE_INCLUDE_ILLEGAL_CONTENT` | 501  | sendMessage                                  |
| `SERVICE_NOT_ENABLED`             | 505  | report / history / reaction                  |
| `OPERATION_UNSUPPORTED`           | 111  | updateMessage / getPinnedMessageList         |
| `FILE_NOT_FOUND`                  | 400  | downloadMessageAttachment                    |
| `FILE_INVALID`                    | 401  | downloadAndParseCombineMessage               |
| `FILE_DOWNLOAD_FAILED`            | 403  | downloadMessageAttachment                    |
| `FILE_IS_EXPIRED`                 | 407  | downloadMessageAttachment                    |
| `FILE_TOO_LARGE`                  | 405  | sendMessage（上传）                          |
| `FILE_CONTENT_IMPROPER`           | 406  | sendMessage（上传）                          |
| `MESSAGE_EXPIRED`                 | 506  | sendMessage（handleSync）                    |
| `MESSAGE_ILLEGAL_WHITELIST`       | 507  | sendMessage（handleSync）                    |
| `MESSAGE_EXTERNAL_LOGIC_BLOCKED`  | 508  | sendMessage（handleSync）                    |
| `MESSAGE_CURRENT_LIMITING`        | 509  | sendMessage（handleSync）                    |
| `MESSAGE_SIZE_LIMIT`              | 510  | sendMessage（handleSync）                    |
| `USER_MUTED_BY_ADMIN`             | 219  | sendMessage（handleSync）                    |
| `USER_NOT_ON_ROSTER`              | 221  | sendMessage（handleSync）                    |
| `INVALID_CONVERSATION`            | 107  | removeHistoryMessages / getPinnedMessageList |
| `SERVER_SERVING_DISABLED`         | 305  | updateMessage（handleSync）                  |
| `THIRD_MODERATION_FAILED`         | 1200 | sendMessage（handleSync）                    |

### 4.4 handleSync 映射的 Web SDK 实现建议

移动端的 handleSync 是 MSync 协议层的错误映射，Web SDK 的消息发送/撤回/编辑也走 MSync 协议。建议：

1. 在 `src/protocol/msync/` 或 `src/core/message/` 中实现等价的 reason → ErrorCode 映射函数
2. 映射函数接收 `{ status, reason }` 返回 `ErrorCode`
3. 字符串匹配规则与移动端保持一致（见第二节）
4. 对于 `sendMessage` 的 callback 模式，Web SDK 已有 `onMessage` / `onError` 事件，可复用
