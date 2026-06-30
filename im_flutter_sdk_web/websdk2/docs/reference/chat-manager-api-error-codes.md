# ChatManager API 错误码对照文档

> 基于移动端 C++ SDK（emclient-linux）源码分析，整理 21 个 ChatManager API 的错误码、触发条件与 Web SDK 处理建议。
>
> 生成时间：2026-04-28

---

## 一、错误码总表

下表列出移动端 `EMError::EMErrorCode` 中本文档涉及的所有错误码，以及 Web SDK 中的对应映射。

| 移动端错误码                      | 数值 | 含义                | Web SDK 映射（ERROR_CODES）       |
| --------------------------------- | ---- | ------------------- | --------------------------------- |
| `EM_NO_ERROR`                     | 0    | 无错误              | —                                 |
| `GENERAL_ERROR`                   | 1    | 通用错误            | `UNKNOWN`                         |
| `EXCEED_SERVICE_LIMIT`            | 4    | 超出服务限制        | `SERVICE_LIMIT_EXCEEDED`          |
| `INVALID_URL`                     | 103  | URL 无效            | `REST_HTTP_ERROR`                 |
| `INVALID_CONVERSATION`            | 107  | 会话无效            | `VALIDATION_INVALID_FORMAT`       |
| `INVALID_PARAM`                   | 110  | 参数无效            | `VALIDATION_REQUIRED`             |
| `OPERATION_UNSUPPORTED`           | 111  | 不支持的操作        | `OPERATION_UNSUPPORTED`           |
| `QUERY_PARAM_REACHES_LIMIT`       | 112  | 查询参数超限        | `SERVICE_LIMIT_EXCEEDED`          |
| `USER_NOT_LOGIN`                  | 201  | 未登录              | `AUTH_NOT_LOGIN`                  |
| `USER_AUTHENTICATION_FAILED`      | 202  | 鉴权失败            | `AUTH_UNAUTHORIZED`               |
| `USER_NOT_FOUND`                  | 204  | 用户不存在          | `REST_HTTP_ERROR`                 |
| `USER_ILLEGAL_ARGUMENT`           | 205  | 非法参数            | `VALIDATION_INVALID_FORMAT`       |
| `USER_PERMISSION_DENIED`          | 210  | 无权限              | `AUTH_FORBIDDEN`                  |
| `SERVER_NOT_REACHABLE`            | 300  | 服务器不可达        | `CONNECTION_WEBSOCKET_ERROR`      |
| `SERVER_TIMEOUT`                  | 301  | 服务器超时          | `CONNECTION_TIMEOUT`              |
| `SERVER_BUSY`                     | 302  | 服务器繁忙          | `SERVER_BUSY`                     |
| `SERVER_UNKNOWN_ERROR`            | 303  | 服务器未知错误      | `REST_BUSINESS_UNKNOWN`           |
| `FILE_NOT_FOUND`                  | 400  | 文件不存在          | `ATTACHMENT_NOT_FOUND`            |
| `FILE_INVALID`                    | 401  | 文件无效            | `ATTACHMENT_INVALID`              |
| `FILE_DOWNLOAD_FAILED`            | 403  | 下载失败            | `COMBINE_DOWNLOAD_FAILED`         |
| `FILE_IS_EXPIRED`                 | 407  | 文件已过期          | `ATTACHMENT_EXPIRED`              |
| `MESSAGE_INVALID`                 | 500  | 消息无效            | `VALIDATION_INVALID_FORMAT`       |
| `MESSAGE_INCLUDE_ILLEGAL_CONTENT` | 501  | 消息含非法内容      | `MESSAGE_INCLUDE_ILLEGAL_CONTENT` |
| `MESSAGE_RECALL_TIME_LIMIT`       | 504  | 撤回超时限          | `MESSAGE_RECALL_TIME_LIMIT`       |
| `SERVICE_NOT_ENABLED`             | 505  | 服务未开通          | `SERVICE_NOT_ENABLED`             |
| `MESSAGE_EDIT_FAILED`             | 511  | 消息编辑失败        | `MESSAGE_EDIT_FAILED`             |
| `GROUP_INVALID_ID`                | 600  | 群组 ID 无效        | `GROUP_INVALID_ID`                |
| `GROUP_NOT_JOINED`                | 602  | 未加入群组          | `GROUP_NOT_JOINED`                |
| `TRANSLATE_PARAM_INVALID`         | 1110 | 翻译参数无效        | `TRANSLATE_PARAM_INVALID`         |
| `TRANSLATE_SERVICE_NOT_ENABLE`    | 1111 | 翻译服务未开通      | `TRANSLATE_SERVICE_NOT_ENABLED`   |
| `TRANSLATE_USAGE_LIMIT`           | 1112 | 翻译用量超限        | `TRANSLATE_USAGE_LIMIT`           |
| `TRANSLATE_MESSAGE_FAIL`          | 1113 | 翻译失败            | `TRANSLATE_FAILED`                |
| `REACTION_REACH_LIMIT`            | 1300 | Reaction 数量超限   | `REACTION_REACH_LIMIT`            |
| `REACTION_HAS_BEEN_OPERATED`      | 1301 | 已操作过该 Reaction | `REACTION_ALREADY_OPERATED`       |
| `REACTION_OPERATION_IS_ILLEGAL`   | 1302 | Reaction 操作非法   | `REACTION_OPERATION_ILLEGAL`      |

---

## 二、各 API 错误码详情

### 1. ackConversationRead()

> 移动端对应：`sendReadAckForConversation`，发送 CHANNEL_ACK 协议消息。

| 错误码                 | 数值 | 触发条件                       | Web SDK 处理建议                       |
| ---------------------- | ---- | ------------------------------ | -------------------------------------- |
| `USER_NOT_LOGIN`       | 201  | 用户未登录                     | 抛出 `AuthenticationError`，提示先登录 |
| `SERVER_NOT_REACHABLE` | 300  | 未连接服务器                   | 抛出 `ConnectionError`，等待重连后重试 |
| `MESSAGE_INVALID`      | 500  | 会话中无消息（找不到最新消息） | 抛出 `ValidationError`，提示会话为空   |

**移动端行为**：同步校验后异步发送，发送本身无回调（fire-and-forget）。

---

### 2. ackMessageRead()

> 移动端对应：`sendReadAckForMessage`，发送 READ_ACK 协议消息。

| 条件                          | 移动端行为     | Web SDK 处理建议                                         |
| ----------------------------- | -------------- | -------------------------------------------------------- |
| 消息方向为 SEND（非接收消息） | 静默返回 false | 抛出 `ValidationError`，提示只能对接收消息发送已读回执   |
| 消息已发送过已读回执          | 静默返回 false | 静默忽略或返回成功（幂等）                               |
| msgId 为空                    | 静默返回 false | 抛出 `ValidationError`，提示 msgId 不能为空              |
| 非单聊且未开启 groupAck       | 静默返回 false | 抛出 `ValidationError`，提示需使用 `ackGroupMessageRead` |
| 未登录或未连接                | 静默返回 false | 抛出 `ConnectionError`                                   |

**移动端行为**：无 `EMError` 输出参数，所有失败均静默返回 `false`。Web SDK 建议改为显式抛错。

---

### 3. ackGroupMessageRead()

> 移动端对应：`sendReadAckForGroupMessage`，发送带 `isNeedGroupAck=true` 的 READ_ACK。

| 条件                        | 移动端行为     | Web SDK 处理建议                             |
| --------------------------- | -------------- | -------------------------------------------- |
| 消息方向为 SEND             | 静默返回 false | 抛出 `ValidationError`                       |
| 消息已发送过已读回执        | 静默返回 false | 静默忽略（幂等）                             |
| msgId 为空                  | 静默返回 false | 抛出 `ValidationError`                       |
| 消息未开启 `isNeedGroupAck` | 静默返回 false | 抛出 `ValidationError`，提示消息未开启群已读 |
| 未登录或未连接              | 静默返回 false | 抛出 `ConnectionError`                       |

**移动端行为**：与 `ackMessageRead` 共用 `sendMessageAck` 内部方法，同样无 EMError 输出。

---

### 4. recallMessage()

> 移动端对应：`recallMessage`，通过 MSync 协议发送 RECALL 消息。

| 错误码                      | 数值 | 触发条件                          | Web SDK 处理建议                                     |
| --------------------------- | ---- | --------------------------------- | ---------------------------------------------------- |
| `MESSAGE_INVALID`           | 500  | msg 为空、msgId 为空、bodies 为空 | 抛出 `ValidationError`                               |
| `MESSAGE_INVALID`           | 500  | 消息状态非 SUCCESS（未发送成功）  | 抛出 `ValidationError`，提示只能撤回已发送成功的消息 |
| `MESSAGE_INVALID`           | 500  | 单聊中尝试撤回接收的消息          | 抛出 `ValidationError`，提示只能撤回自己发送的消息   |
| `USER_NOT_LOGIN`            | 201  | 未登录                            | 抛出 `AuthenticationError`                           |
| `SERVER_NOT_REACHABLE`      | 300  | 未连接 / 发送超时                 | 抛出 `ConnectionError`                               |
| `MESSAGE_RECALL_TIME_LIMIT` | 504  | 服务端返回：超过撤回时间限制      | 抛出 `SDKError`，提示撤回超时                        |
| 服务端动态错误码            | —    | 服务端返回的其他 flag             | 透传服务端错误码                                     |

**移动端行为**：撤回成功后自动从会话中移除消息并取消置顶。

---

### 5. modifyMessage()

> 移动端对应：`modifyMessage`，通过 MSync 协议发送编辑消息请求。

| 错误码                   | 数值 | 触发条件                             | Web SDK 处理建议                                       |
| ------------------------ | ---- | ------------------------------------ | ------------------------------------------------------ |
| `MESSAGE_INVALID`        | 500  | 消息未找到、msgId 为空、bodies 为空  | 抛出 `ValidationError`                                 |
| `INVALID_PARAM`          | 110  | body 和 extJson 均为空（无修改内容） | 抛出 `ValidationError`，提示至少提供 body 或 ext       |
| `OPERATION_UNSUPPORTED`  | 111  | 尝试修改消息类型（body type 不匹配） | 抛出 `ValidationError`，提示不能更改消息类型           |
| `OPERATION_UNSUPPORTED`  | 111  | body 类型非 TEXT / CUSTOM            | 抛出 `ValidationError`，提示仅支持编辑文本和自定义消息 |
| `USER_NOT_LOGIN`         | 201  | 未登录或未连接                       | 抛出 `AuthenticationError`                             |
| `USER_PERMISSION_DENIED` | 210  | 单聊中尝试编辑非自己发送的消息       | 抛出 `SDKError`，提示无权编辑他人消息                  |
| `SERVER_TIMEOUT`         | 301  | 发送过程中用户登出                   | 抛出 `ConnectionError`                                 |
| `SERVER_NOT_REACHABLE`   | 300  | 发送超时 / 连接断开                  | 抛出 `ConnectionError`                                 |
| `MESSAGE_EDIT_FAILED`    | 511  | 服务端返回编辑失败                   | 抛出 `SDKError`，透传服务端错误描述                    |

**移动端行为**：内置 2 次重试，401 时自动刷新 token。编辑成功后更新本地 DB。仅 TEXT 和 CUSTOM 类型可编辑 body。

---

### 6. downloadAttachment()

> 移动端对应：`downloadAttachments`（私有方法），HTTP 下载附件文件。

| 错误码                   | 数值 | 触发条件                                 | Web SDK 处理建议                          |
| ------------------------ | ---- | ---------------------------------------- | ----------------------------------------- |
| `FILE_DOWNLOAD_FAILED`   | 403  | 下载 URL 或本地路径为空                  | 抛出 `ValidationError`，提示附件 URL 缺失 |
| `FILE_DOWNLOAD_FAILED`   | 403  | HTTP 401 鉴权失败（刷新 token 后仍失败） | 抛出 `AuthenticationError`                |
| `FILE_DOWNLOAD_FAILED`   | 403  | 其他 HTTP 错误（重试后仍失败）           | 抛出 `NetworkError`                       |
| `USER_PERMISSION_DENIED` | 210  | HTTP 403 权限拒绝                        | 抛出 `SDKError`，提示无下载权限           |
| `EXCEED_SERVICE_LIMIT`   | 4    | HTTP 429 限流                            | 抛出 `SDKError`，提示请求过于频繁         |
| `FILE_IS_EXPIRED`        | 407  | HTTP 404 + "file is expired"             | 抛出 `SDKError`，提示文件已过期           |
| `FILE_NOT_FOUND`         | 400  | HTTP 404 + "file may not exists"         | 抛出 `SDKError`，提示文件不存在           |

**移动端行为**：401 自动刷新 token 重试一次；其他错误用备用 URL 重试一次；404 不重试。下载状态通过 `onMessageAttachmentsStatusChanged` 回调通知。

---

### 7. downloadAndParseCombineMessage()

> 移动端对应：`downloadCombineMessages`，下载合并消息附件并解析为子消息列表。

| 错误码                 | 数值 | 触发条件                                      | Web SDK 处理建议                           |
| ---------------------- | ---- | --------------------------------------------- | ------------------------------------------ |
| `INVALID_PARAM`        | 110  | 消息为 null                                   | 抛出 `ValidationError`                     |
| `MESSAGE_INVALID`      | 500  | 消息不是合并消息类型                          | 抛出 `ValidationError`，提示消息类型不匹配 |
| `FILE_DOWNLOAD_FAILED` | 403  | 下载失败（含 downloadAttachments 的所有错误） | 抛出 `NetworkError`                        |
| `FILE_INVALID`         | 401  | 本地文件存在但解析失败                        | 抛出 `SDKError`，提示合并消息文件损坏      |

**移动端行为**：先尝试解析本地文件，失败后下载再解析，共 2 次机会。

---

### 8. addMessageListener()

> 移动端对应：`addListener(EMChatManagerListener*)`。

**无错误码**。纯内存操作，mutex 保护的 set 插入。

| 回调事件                            | 说明               |
| ----------------------------------- | ------------------ |
| `onReceiveMessages`                 | 收到消息           |
| `onReceiveCmdMessages`              | 收到 CMD 消息      |
| `onMessageAttachmentsStatusChanged` | 附件下载状态变更   |
| `onMessageContentChanged`           | 消息内容被编辑     |
| `onReceiveHasReadAcks`              | 收到单聊已读回执   |
| `onReceiveReadAcksForGroupMessage`  | 收到群已读回执     |
| `onReceiveHasDeliveredAcks`         | 收到送达回执       |
| `onReceiveRecallMessages`           | 收到撤回通知       |
| `onReceiveReadAckForConversation`   | 收到会话级已读回执 |

**Web SDK 处理建议**：参考现有 Manager 的 `addEventHandler` 模式实现，无需错误处理。

---

### 9. fetchGroupReadAcks()

> 移动端对应：`fetchGroupReadAcks`，REST API 分页查询群消息已读回执。

| 错误码                 | 数值 | 触发条件                              | Web SDK 处理建议                       |
| ---------------------- | ---- | ------------------------------------- | -------------------------------------- |
| `SERVER_UNKNOWN_ERROR` | 303  | 响应 JSON 解析失败 / 缺少 `data` 字段 | 抛出 `RestBusinessError`               |
| `MESSAGE_INVALID`      | 500  | HTTP 404（消息不存在）                | 抛出 `ValidationError`，提示消息不存在 |
| `EXCEED_SERVICE_LIMIT` | 4    | HTTP 429 限流                         | 抛出 `SDKError`，提示请求过于频繁      |

**移动端行为**：pageSize ≤ 0 时自动修正为 10；最多 2 次重试，失败时切换备用 REST 地址。

---

### 10. fetchHistoryMessages()

> 移动端有两个重载：MSync 协议版（按 startMsgId）和 REST API 版（按 cursor + option）。

**MSync 版错误码：**

| 错误码                  | 数值 | 触发条件                | Web SDK 处理建议           |
| ----------------------- | ---- | ----------------------- | -------------------------- |
| `USER_ILLEGAL_ARGUMENT` | 205  | conversationId 为空     | 抛出 `ValidationError`     |
| `USER_NOT_LOGIN`        | 201  | 未登录 / 发送过程中登出 | 抛出 `AuthenticationError` |
| `SERVER_TIMEOUT`        | 301  | 所有重试耗尽后超时      | 抛出 `ConnectionError`     |
| 服务端动态错误码        | —    | 服务端返回 flag > 0     | 透传服务端错误码           |

**REST 版错误码：**

| 错误码                       | 数值 | 触发条件                                                         | Web SDK 处理建议                         |
| ---------------------------- | ---- | ---------------------------------------------------------------- | ---------------------------------------- |
| `USER_NOT_LOGIN`             | 201  | 未登录                                                           | 抛出 `AuthenticationError`               |
| `USER_NOT_FOUND`             | 204  | HTTP 404                                                         | 抛出 `SDKError`                          |
| `EXCEED_SERVICE_LIMIT`       | 4    | HTTP 400 + "pull number cannot be greater" / "limit is to large" | 抛出 `ValidationError`，提示分页参数超限 |
| `USER_AUTHENTICATION_FAILED` | 202  | HTTP 401（刷新 token 后仍失败）                                  | 抛出 `AuthenticationError`               |
| `SERVICE_NOT_ENABLED`        | 505  | HTTP 403 + "not open"                                            | 抛出 `SDKError`，提示漫游服务未开通      |
| `SERVER_UNKNOWN_ERROR`       | 303  | HTTP 400（其他原因）/ JSON 解析失败                              | 抛出 `RestBusinessError`                 |
| `SERVER_NOT_REACHABLE`       | 300  | 其他 HTTP 错误 / 网络失败                                        | 抛出 `NetworkError`                      |

---

### 11. deleteMessage()

> 移动端有多个层级：本地删除（bool 返回）和服务端删除（REST API）。

**服务端按消息 ID 删除（`removeMessagesFromServer`）：**

| 错误码                       | 数值 | 触发条件                                  | Web SDK 处理建议                         |
| ---------------------------- | ---- | ----------------------------------------- | ---------------------------------------- |
| `USER_NOT_LOGIN`             | 201  | 未登录                                    | 抛出 `AuthenticationError`               |
| `INVALID_PARAM`              | 110  | msgIdList 为空 / conversationId 为空      | 抛出 `ValidationError`                   |
| `INVALID_CONVERSATION`       | 107  | 会话类型非 CHAT/GROUPCHAT/CHATROOM        | 抛出 `ValidationError`                   |
| `USER_NOT_FOUND`             | 204  | HTTP 404                                  | 抛出 `SDKError`                          |
| `SERVICE_NOT_ENABLED`        | 505  | HTTP 400 + "not open message roaming"     | 抛出 `SDKError`，提示漫游服务未开通      |
| `QUERY_PARAM_REACHES_LIMIT`  | 112  | HTTP 400 + "delete msg list limit"        | 抛出 `ValidationError`，提示删除数量超限 |
| `USER_AUTHENTICATION_FAILED` | 202  | HTTP 401（重试后仍失败）                  | 抛出 `AuthenticationError`               |
| `SERVER_UNKNOWN_ERROR`       | 303  | JSON 解析失败 / requestStatusCode != "ok" | 抛出 `RestBusinessError`                 |
| `SERVER_NOT_REACHABLE`       | 300  | 其他 HTTP 错误                            | 抛出 `NetworkError`                      |

**服务端按时间戳删除：** 错误码与上表基本一致，`INVALID_PARAM` 触发条件改为 `beforeTimeStamp <= 0`。

---

### 13. fetchSupportLanguages()

> 移动端对应：`fetchSupportLanguages`，REST API 获取翻译支持的语言列表。

| 错误码                       | 数值 | 触发条件                            | Web SDK 处理建议                  |
| ---------------------------- | ---- | ----------------------------------- | --------------------------------- |
| `SERVER_NOT_REACHABLE`       | 300  | 连接失败 / HTTP 504（重试后仍失败） | 抛出 `NetworkError`               |
| `USER_NOT_FOUND`             | 204  | HTTP 404                            | 抛出 `SDKError`                   |
| `USER_AUTHENTICATION_FAILED` | 202  | HTTP 401（刷新 token 后仍失败）     | 抛出 `AuthenticationError`        |
| `SERVER_UNKNOWN_ERROR`       | 303  | HTTP 403                            | 抛出 `SDKError`，提示服务禁止访问 |
| `GENERAL_ERROR`              | 1    | 其他 HTTP 错误 / JSON 解析失败      | 抛出 `SDKError`                   |

**注意**：此 API 未使用 `TRANSLATE_*` 系列错误码，HTTP 403 映射为通用 `SERVER_UNKNOWN_ERROR`。

---

### 14. translateMessage()

> 移动端对应：`translateMessage` → 内部调用 `translateText`，REST API 翻译消息。

| 错误码                         | 数值 | 触发条件                        | Web SDK 处理建议                               |
| ------------------------------ | ---- | ------------------------------- | ---------------------------------------------- |
| `GENERAL_ERROR`                | 1    | 消息 body 类型非 TEXT           | 抛出 `ValidationError`，提示仅支持翻译文本消息 |
| `TRANSLATE_PARAM_INVALID`      | 1110 | HTTP 400（翻译参数错误）        | 抛出 `ValidationError`，提示翻译参数无效       |
| `TRANSLATE_SERVICE_NOT_ENABLE` | 1111 | HTTP 403（翻译服务未开通）      | 抛出 `SDKError`，提示需开通翻译服务            |
| `TRANSLATE_USAGE_LIMIT`        | 1112 | HTTP 429（翻译用量超限）        | 抛出 `SDKError`，提示翻译配额已用完            |
| `TRANSLATE_MESSAGE_FAIL`       | 1113 | HTTP 500（翻译失败）            | 抛出 `SDKError`，提示翻译服务异常              |
| `SERVER_NOT_REACHABLE`         | 300  | 连接失败（重试后仍失败）        | 抛出 `NetworkError`                            |
| `USER_AUTHENTICATION_FAILED`   | 202  | HTTP 401（刷新 token 后仍失败） | 抛出 `AuthenticationError`                     |

**移动端行为**：翻译成功后自动将结果写入 `TextMessageBody.translations` 并持久化到 DB。

---

### 15. addReaction()

> 移动端对应：`EMReactionManager::addReaction`，REST API。

| 错误码                          | 数值 | 触发条件                                         | Web SDK 处理建议                            |
| ------------------------------- | ---- | ------------------------------------------------ | ------------------------------------------- |
| `INVALID_PARAM`                 | 110  | messageId 为空                                   | 抛出 `ValidationError`                      |
| `INVALID_PARAM`                 | 110  | reaction 为空                                    | 抛出 `ValidationError`                      |
| `REACTION_REACH_LIMIT`          | 1300 | "The quantity has exceeded the limit!"           | 抛出 `SDKError`，提示 Reaction 数量已达上限 |
| `REACTION_HAS_BEEN_OPERATED`    | 1301 | "the user is already operation this message"     | 抛出 `SDKError`，提示已添加过该 Reaction    |
| `REACTION_OPERATION_IS_ILLEGAL` | 1302 | "the user operation is illegal!"                 | 抛出 `SDKError`，提示操作非法               |
| `SERVICE_NOT_ENABLED`           | 505  | "this appKey is not open reaction service!"      | 抛出 `SDKError`，提示需开通 Reaction 服务   |
| `GROUP_NOT_JOINED`              | 602  | "The user not in this group!"                    | 抛出 `SDKError`，提示未加入群组             |
| `GROUP_INVALID_ID`              | 600  | "groupId can not be null!"                       | 抛出 `ValidationError`                      |
| `SERVER_BUSY`                   | 302  | HTTP 503 / "creating reaction, please try again" | 抛出 `SDKError`，提示服务繁忙请重试         |
| `SERVER_TIMEOUT`                | 301  | HTTP 504                                         | 抛出 `ConnectionError`                      |
| `SERVER_NOT_REACHABLE`          | 300  | 连接失败 / 备用地址耗尽                          | 抛出 `NetworkError`                         |
| `GENERAL_ERROR`                 | 1    | HTTP 404 / 权限拒绝                              | 抛出 `SDKError`                             |

**移动端行为**：所有 Reaction API 共用 `processGeneralRESTResponseError` 做服务端错误映射（基于 `error_description` 字符串匹配）。

---

### 16. removeReaction()

> 移动端对应：`EMReactionManager::removeReaction`，REST API。

错误码与 `addReaction` 完全一致（共用同一错误处理逻辑），参见上表。

---

### 17. getReactionList()

> 移动端对应：`EMReactionManager::getReactionList`，REST API 批量查询消息的 Reaction 列表。

| 错误码                 | 数值 | 触发条件                                   | Web SDK 处理建议         |
| ---------------------- | ---- | ------------------------------------------ | ------------------------ |
| `INVALID_PARAM`        | 110  | messageType 为空                           | 抛出 `ValidationError`   |
| `INVALID_PARAM`        | 110  | messageType 为 "groupchat" 但 groupId 为空 | 抛出 `ValidationError`   |
| `INVALID_PARAM`        | 110  | messageIdList 为空                         | 抛出 `ValidationError`   |
| `SERVER_UNKNOWN_ERROR` | 303  | 响应解析失败 / `data` 非数组               | 抛出 `RestBusinessError` |
| 其他                   | —    | 同 addReaction 的服务端错误                | 同上                     |

---

### 18. getReactionDetail()

> 移动端对应：`EMReactionManager::getReactionDetail`，REST API 分页查询单个 Reaction 详情。

| 错误码                 | 数值 | 触发条件                    | Web SDK 处理建议         |
| ---------------------- | ---- | --------------------------- | ------------------------ |
| `INVALID_PARAM`        | 110  | messageId 为空              | 抛出 `ValidationError`   |
| `INVALID_PARAM`        | 110  | reaction 为空               | 抛出 `ValidationError`   |
| `INVALID_PARAM`        | 110  | pageSize ≤ 0                | 抛出 `ValidationError`   |
| `SERVER_UNKNOWN_ERROR` | 303  | 响应解析失败                | 抛出 `RestBusinessError` |
| 其他                   | —    | 同 addReaction 的服务端错误 | 同上                     |

---

### 19. pinMessage()

> 移动端对应：`EMChatManager::pinMessage(messageId, true, error)`，REST API（POST）。

| 错误码                       | 数值 | 触发条件                                    | Web SDK 处理建议                                          |
| ---------------------------- | ---- | ------------------------------------------- | --------------------------------------------------------- |
| `USER_NOT_LOGIN`             | 201  | 未登录                                      | 抛出 `AuthenticationError`                                |
| `INVALID_PARAM`              | 110  | messageId 为空                              | 抛出 `ValidationError`                                    |
| `MESSAGE_INVALID`            | 500  | 消息未找到                                  | 抛出 `ValidationError`，提示消息不存在                    |
| `INVALID_PARAM`              | 110  | HTTP 400                                    | 抛出 `ValidationError`，透传 error_description            |
| `EXCEED_SERVICE_LIMIT`       | 4    | HTTP 403 + serverCode=91101（置顶数量超限） | 抛出 `RestBusinessError`，`details.serverCode` 保留 91101 |
| `INVALID_PARAM`              | 110  | HTTP 403 + serverCode=91102（消息不可置顶） | 抛出 `ValidationError`，`details.serverCode` 保留 91102   |
| `USER_AUTHENTICATION_FAILED` | 202  | HTTP 401（刷新 token 后仍失败）             | 抛出 `AuthenticationError`                                |

**移动端行为**：pin/unpin 共用同一方法，通过 `isPinned` 参数区分 POST/DELETE。内置 2 次重试，401 自动刷新 token。

---

### 20. unPinMessage()

> 移动端对应：`EMChatManager::pinMessage(messageId, false, error)`，REST API（DELETE）。

错误码与 `pinMessage` 完全一致，额外增加：

| 错误码          | 数值 | 触发条件                                           | Web SDK 处理建议                       |
| --------------- | ---- | -------------------------------------------------- | -------------------------------------- |
| `INVALID_PARAM` | 110  | HTTP 404 或 serverCode=91102（消息未置顶或不存在） | 抛出 `ValidationError`，提示消息未置顶 |

---

### 21. getPinnedMessageList()

> 移动端对应：`getPinnedMessagesFromServer`，Web SDK 不分页查询会话置顶消息，最多返回 20 条。

| 错误码                       | 数值 | 触发条件                        | Web SDK 处理建议                                        |
| ---------------------------- | ---- | ------------------------------- | ------------------------------------------------------- |
| `USER_NOT_LOGIN`             | 201  | 未登录                          | 抛出 `AuthenticationError`                              |
| `INVALID_PARAM`              | 110  | conversationId 为空             | 抛出 `ValidationError`                                  |
| `INVALID_CONVERSATION`       | 107  | 会话未找到                      | 抛出 `ValidationError`，提示会话不存在                  |
| `INVALID_URL`                | 103  | HTTP 404                        | 抛出 `SDKError`                                         |
| `USER_AUTHENTICATION_FAILED` | 202  | HTTP 401（重试后仍失败）        | 抛出 `AuthenticationError`                              |
| `OPERATION_UNSUPPORTED`      | 111  | HTTP 403 + serverCode=15002     | 抛出 `ValidationError`，`details.serverCode` 保留 15002 |
| `SERVER_UNKNOWN_ERROR`       | 303  | 响应解析失败 / 缺少 `data` 字段 | 抛出 `RestBusinessError`                                |

**Web SDK 行为**：不接收 `messageId`、`cursor`、`pageSize`，固定最多返回 20 条。

---

## 三、Web SDK 建议新增的错误码

基于以上分析，Web SDK 的 `src/utils/error-codes.ts` 应补齐以下常量；其中数值优先与移动端对齐，便于跨端排障：

| 建议常量名                      | 数值 | 来源                                                       |
| ------------------------------- | ---- | ---------------------------------------------------------- |
| `MESSAGE_RECALL_TIME_LIMIT`     | 504  | recallMessage                                              |
| `MESSAGE_EDIT_FAILED`           | 511  | updateMessage                                              |
| `SERVICE_NOT_ENABLED`           | 505  | removeHistoryMessages / getHistoryMessages / Reaction      |
| `ATTACHMENT_NOT_FOUND`          | 400  | downloadMessageAttachment                                  |
| `ATTACHMENT_INVALID`            | 401  | downloadMessageAttachment / downloadAndParseCombineMessage |
| `ATTACHMENT_EXPIRED`            | 407  | downloadMessageAttachment                                  |
| `SERVER_BUSY`                   | 302  | Reaction APIs                                              |
| `OPERATION_UNSUPPORTED`         | 111  | modifyMessage / getPinnedMessageList                       |
| `TRANSLATE_PARAM_INVALID`       | 1110 | translateMessage                                           |
| `TRANSLATE_SERVICE_NOT_ENABLED` | 1111 | translateMessage                                           |
| `TRANSLATE_USAGE_LIMIT`         | 1112 | translateMessage                                           |
| `TRANSLATE_FAILED`              | 1113 | translateMessage                                           |
| `REACTION_REACH_LIMIT`          | 1300 | addReaction                                                |
| `REACTION_ALREADY_OPERATED`     | 1301 | addReaction / removeReaction                               |
| `REACTION_OPERATION_ILLEGAL`    | 1302 | addReaction / removeReaction                               |

---

## 四、通用错误处理模式

移动端 SDK 的错误处理有以下共性模式，Web SDK 实现时可参考：

1. **登录检查**：几乎所有 API 首先检查 `isLoggedIn()`，未登录返回 `USER_NOT_LOGIN(201)`
2. **连接检查**：MSync 协议类 API 额外检查 `isConnected()`，未连接返回 `SERVER_NOT_REACHABLE(300)`
3. **参数校验**：在发起网络请求前完成所有参数校验，避免无效请求
4. **Token 刷新重试**：REST API 遇到 HTTP 401 时自动刷新 token 重试一次
5. **备用地址重试**：网络错误时切换备用 REST 地址重试
6. **用户变更检查**：异步操作完成后检查当前用户是否变更（多设备场景）
7. **服务端动态错误码**：MSync 协议返回的 flag 直接作为错误码透传

补充约束：

- `FILE_INVALID(401)` 在合并消息下载解析场景下，公开层可以统一转译为 `ATTACHMENT_INVALID`；若内部需要更细粒度区分，也可以进一步映射到现有 `COMBINE_PARSE_FAILED`。
- `MESSAGE_INVALID(500)`、`INVALID_PARAM(110)`、`USER_ILLEGAL_ARGUMENT(205)` 等通用输入问题，Web SDK 继续优先落到现有 `VALIDATION_*` 体系，不强制为每个 message-domain 场景新增同名常量。
- 移动端里返回 `false` 的 silent-fail 场景，在 Web SDK 中不应保留 silent-fail，而应统一改成显式异常或幂等成功。

## 五、Web SDK 统一落地规则

为避免 21 个 API 各自实现一套错误语义，Web SDK 建议统一遵循以下落地规则：

1. **参数前置校验**：在 manager 层完成必填项、会话类型、消息方向、消息状态、分页范围、语言码和 reaction 文本的校验；失败统一抛 `ValidationError`
2. **silent false 转显式异常**：移动端对 `ackMessageRead`、`ackGroupMessageRead` 等返回 `false` 的场景，Web SDK 统一改为：
   - 可幂等场景：静默成功
   - 非幂等非法场景：抛 `ValidationError` 或 `ConnectionError`
3. **连接类错误**：MSync / WebSocket 发送失败统一优先落到 `ConnectionError`
4. **鉴权类错误**：未登录、401、token 失效统一落到 `AuthenticationError`
5. **HTTP 传输类错误**：网络失败、超时、备用地址耗尽统一落到 `NetworkError` 或 `RestTransportError`
6. **服务端业务错误**：JSON 可解析且有明确业务错误码时，统一抛 `SDKError` 或 `RestBusinessError`，并挂载具体 `ERROR_CODES`
7. **文档真源**：031 实现阶段，`docs/reference/chat-manager-api-error-codes.md` 应作为 ChatManager 错误码矩阵的设计真源之一；若实现与本文档偏离，需要同步修订本文档
