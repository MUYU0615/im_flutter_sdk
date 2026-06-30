# 移动端 vs Web SDK 错误码对照总表

> 生成时间：2026-05-20

> 当前状态更新：2026-05-26。本文保留移动端/Web 对齐审计视角；用户侧公开错误码入口以 `docs/reference/error-codes.md` 为准，治理约束由 `npm run errors:check` 校验。

---

## 一、完全对齐（数值一致、含义一致）

| 数值 | 移动端                                      | Web SDK                                     | 域       |
| ---- | ------------------------------------------- | ------------------------------------------- | -------- |
| 0    | `EM_NO_ERROR`                               | —                                           | 通用     |
| 1    | `GENERAL_ERROR`                             | `UNKNOWN`                                   | 通用     |
| 4    | `EXCEED_SERVICE_LIMIT`                      | `SERVICE_LIMIT_EXCEEDED`                    | 通用     |
| 108  | `TOKEN_EXPIRED`                             | `AUTH_TOKEN_EXPIRED`                        | 认证     |
| 110  | `INVALID_PARAM`                             | `VALIDATION_REQUIRED`                       | 校验     |
| 111  | `OPERATION_UNSUPPORTED`                     | `OPERATION_UNSUPPORTED`                     | 校验     |
| 200  | `USER_ALREADY_LOGIN_SAME`                   | `AUTH_ALREADY_LOGIN`                        | 认证     |
| 201  | `USER_NOT_LOGIN`                            | `AUTH_NOT_LOGIN`                            | 认证     |
| 202  | `USER_AUTHENTICATION_FAILED`                | `AUTH_UNAUTHORIZED`                         | 认证     |
| 210  | `USER_PERMISSION_DENIED`                    | `AUTH_FORBIDDEN`                            | 认证     |
| 213  | `USER_BIND_ANOTHER_DEVICE`                  | `AUTH_BIND_ANOTHER_DEVICE`                  | 认证     |
| 214  | `USER_LOGIN_TOO_MANY_DEVICES`               | `AUTH_LOGIN_TOO_MANY_DEVICES`               | 认证     |
| 215  | `USER_MUTED`                                | `AUTH_USER_MUTED`                           | 认证     |
| 206  | `USER_LOGIN_ANOTHER_DEVICE`                 | `USER_LOGIN_ANOTHER_DEVICE`                 | 认证     |
| 207  | `USER_REMOVED`                              | `USER_REMOVED`                              | 认证     |
| 216  | `USER_KICKED_BY_CHANGE_PASSWORD`            | `USER_KICKED_BY_CHANGE_PASSWORD`            | 认证     |
| 217  | `USER_KICKED_BY_OTHER_DEVICE`               | `USER_KICKED_BY_OTHER_DEVICE`               | 认证     |
| 218  | `USER_ALREADY_LOGIN_ANOTHER`                | `USER_ALREADY_LOGIN_ANOTHER`                | 认证     |
| 219  | `USER_MUTED_BY_ADMIN`                       | `USER_MUTED_BY_ADMIN`                       | 认证     |
| 220  | `USER_DEVICE_CHANGED`                       | `USER_DEVICE_CHANGED`                       | 认证     |
| 221  | `USER_NOT_ON_ROSTER`                        | `USER_NOT_ON_ROSTER`                        | 认证     |
| 300  | `SERVER_NOT_REACHABLE`                      | `CONNECTION_WEBSOCKET_ERROR`                | 连接     |
| 301  | `SERVER_TIMEOUT`                            | `CONNECTION_TIMEOUT`                        | 连接     |
| 302  | `SERVER_BUSY`                               | `SERVER_BUSY`                               | 连接     |
| 303  | `SERVER_UNKNOWN_ERROR`                      | `REST_BUSINESS_UNKNOWN`                     | 传输     |
| 400  | `FILE_NOT_FOUND`                            | `ATTACHMENT_NOT_FOUND`                      | 文件     |
| 401  | `FILE_INVALID`                              | `ATTACHMENT_INVALID`                        | 文件     |
| 407  | `FILE_IS_EXPIRED`                           | `ATTACHMENT_EXPIRED`                        | 文件     |
| 500  | `MESSAGE_INVALID`                           | （通过 api-errors.json 映射）               | 消息     |
| 501  | `MESSAGE_INCLUDE_ILLEGAL_CONTENT`           | `MESSAGE_INCLUDE_ILLEGAL_CONTENT`           | 消息     |
| 504  | `MESSAGE_RECALL_TIME_LIMIT`                 | `MESSAGE_RECALL_TIME_LIMIT`                 | 消息     |
| 505  | `SERVICE_NOT_ENABLED`                       | `SERVICE_NOT_ENABLED`                       | 消息     |
| 511  | `MESSAGE_EDIT_FAILED`                       | `MESSAGE_EDIT_FAILED`                       | 消息     |
| 600  | `GROUP_INVALID_ID`                          | `GROUP_INVALID_ID`                          | 群组     |
| 601  | `GROUP_ALREADY_JOINED`                      | `GROUP_ALREADY_JOINED`                      | 群组     |
| 602  | `GROUP_NOT_JOINED`                          | `GROUP_NOT_JOINED`                          | 群组     |
| 603  | `GROUP_PERMISSION_DENIED`                   | `GROUP_PERMISSION_DENIED`                   | 群组     |
| 604  | `GROUP_MEMBERS_FULL`                        | `GROUP_MEMBERS_FULL`                        | 群组     |
| 605  | `GROUP_SHARED_FILE_INVALIDID`               | `GROUP_SHARED_FILE_INVALID_ID`              | 群组     |
| 606  | `GROUP_NOT_EXIST`                           | `GROUP_NOT_EXIST`                           | 群组     |
| 607  | `GROUP_DISABLED`                            | `GROUP_DISABLED`                            | 群组     |
| 608  | `GROUP_NAME_VIOLATION`                      | `GROUP_NAME_VIOLATION`                      | 群组     |
| 609  | `GROUP_MEMBER_ATTRIBUTES_REACH_LIMIT`       | `GROUP_MEMBER_ATTRIBUTES_REACH_LIMIT`       | 群组     |
| 610  | `GROUP_MEMBER_ATTRIBUTES_UPDATE_FAILED`     | `GROUP_MEMBER_ATTRIBUTES_UPDATE_FAILED`     | 群组     |
| 611  | `GROUP_MEMBER_ATTRIBUTES_KEY_REACH_LIMIT`   | `GROUP_MEMBER_ATTRIBUTES_KEY_REACH_LIMIT`   | 群组     |
| 612  | `GROUP_MEMBER_ATTRIBUTES_VALUE_REACH_LIMIT` | `GROUP_MEMBER_ATTRIBUTES_VALUE_REACH_LIMIT` | 群组     |
| 613  | `GROUP_USER_IN_BLOCKLIST`                   | `GROUP_USER_IN_BLOCKLIST`                   | 群组     |
| 700  | `CHATROOM_INVALID_ID`                       | `CHATROOM_INVALID_ID`                       | 聊天室   |
| 702  | `CHATROOM_NOT_JOINED`                       | `CHATROOM_NOT_JOINED`                       | 聊天室   |
| 703  | `CHATROOM_PERMISSION_DENIED`                | `CHATROOM_PERMISSION_DENIED`                | 聊天室   |
| 704  | `CHATROOM_MEMBERS_FULL`                     | `CHATROOM_MEMBERS_FULL`                     | 聊天室   |
| 705  | `CHATROOM_NOT_EXIST`                        | `CHATROOM_NOT_EXIST`                        | 聊天室   |
| 706  | `CHATROOM_OWNER_NOT_ALLOW_LEAVE`            | `CHATROOM_OWNER_NOT_ALLOW_LEAVE`            | 聊天室   |
| 707  | `CHATROOM_USER_IN_BLOCKLIST`                | `CHATROOM_USER_IN_BLOCKLIST`                | 聊天室   |
| 900  | `USERINFO_USERCOUNT_EXCEED`                 | `USERINFO_USERCOUNT_EXCEED`                 | 用户资料 |
| 901  | `USERINFO_DATALENGTH_EXCEED`                | `USERINFO_DATALENGTH_EXCEED`                | 用户资料 |
| 1000 | `CONTACT_ADD_FAILED`                        | `CONTACT_ADD_ALREADY_FRIEND`                | 联系人   |
| 1001 | `CONTACT_REACH_LIMIT`                       | `CONTACT_REACH_LIMIT`                       | 联系人   |
| 1002 | `CONTACT_REACH_LIMIT_PEER`                  | `CONTACT_REACH_LIMIT_PEER`                  | 联系人   |
| 1100 | `PRESENCE_PARAM_LENGTH_EXCEED`              | `PRESENCE_PARAM_LENGTH_EXCEED`              | 在线状态 |
| 1101 | `PRESENCE_CANNOT_SUBSCRIBE_YOURSELF`        | `PRESENCE_CANNOT_SUBSCRIBE_YOURSELF`        | 在线状态 |
| 1110 | `TRANSLATE_PARAM_INVALID`                   | `TRANSLATE_PARAM_INVALID`                   | 翻译     |
| 1111 | `TRANSLATE_SERVICE_NOT_ENABLE`              | `TRANSLATE_SERVICE_NOT_ENABLED`             | 翻译     |
| 1112 | `TRANSLATE_USAGE_LIMIT`                     | `TRANSLATE_USAGE_LIMIT`                     | 翻译     |
| 1113 | `TRANSLATE_MESSAGE_FAIL`                    | `TRANSLATE_FAILED`                          | 翻译     |
| 1300 | `REACTION_REACH_LIMIT`                      | `REACTION_REACH_LIMIT`                      | Reaction |
| 1301 | `REACTION_HAS_BEEN_OPERATED`                | `REACTION_ALREADY_OPERATED`                 | Reaction |
| 1302 | `REACTION_OPERATION_IS_ILLEGAL`             | `REACTION_OPERATION_ILLEGAL`                | Reaction |
| 1500 | `PUSH_NOT_SUPPORT`                          | `PUSH_TOKEN_UPLOAD_FAILED`                  | 推送     |

---

## 二、数值一致但含义/命名不同

| 数值 | 移动端                               | Web SDK                                             | 差异说明                                 |
| ---- | ------------------------------------ | --------------------------------------------------- | ---------------------------------------- |
| 1    | `GENERAL_ERROR`                      | `UNKNOWN`                                           | 命名不同，语义相同                       |
| 4    | `EXCEED_SERVICE_LIMIT`               | `SERVICE_LIMIT_EXCEEDED`                            | 命名顺序不同                             |
| 110  | `INVALID_PARAM`                      | `VALIDATION_REQUIRED` / `VALIDATION_INVALID_FORMAT` | Web 拆分为两个常量，但数值都是 110       |
| 1000 | `CONTACT_ADD_FAILED`（添加失败通用） | `CONTACT_ADD_ALREADY_FRIEND`（已是好友）            | Web 含义更窄，只表示"已是好友"           |
| 1500 | `PUSH_NOT_SUPPORT`（设备不支持推送） | `PUSH_TOKEN_UPLOAD_FAILED`（token 上传失败）        | 含义完全不同，Web 不需要设备推送支持检查 |
| 223  | `USER_NOT_ON_ROSTER`（非好友）       | `CONTACT_SET_REMARK_NOT_FRIEND`（非好友不能设备注） | Web 含义更窄，仅用于设置备注场景         |

---

## 三、移动端有、Web SDK 没有

| 数值    | 移动端                               | 域     | 是否需要补充                                             |
| ------- | ------------------------------------ | ------ | -------------------------------------------------------- |
| 2       | `NETWORK_ERROR`                      | 通用   | ✅ Web 用 `REST_NETWORK_ERROR`(2) 覆盖                   |
| 3       | `DATABASE_ERROR`                     | 通用   | ✅ Web 用 `STORAGE_OPERATION_FAILED`(3) 表达本地存储失败 |
| 5       | `SERVICE_ARREARAGES`                 | 通用   | ❌ 欠费，Web 不需要                                      |
| 6       | `PUSH_REPROT_ACTION_FAILED`          | 推送   | ❌ 移动端特有                                            |
| 7       | `PARTIAL_SUCCESS`                    | 通用   | ⚠️ 聊天室属性批量操作需要，当前通过返回结构表达          |
| 8       | `APP_ACTIVE_NUMBER_REACH_LIMITATION` | 通用   | ❌ 移动端特有                                            |
| 100     | `INVALID_APP_KEY`                    | 校验   | ✅ Web 用 `UPLOAD_INVALID_APPKEY`(100)                   |
| 101     | `INVALID_USER_NAME`                  | 校验   | ✅ Web 统一用 `VALIDATION_REQUIRED`(110)                 |
| 102     | `INVALID_PASSWORD`                   | 校验   | ❌ Web 不做密码校验                                      |
| 103     | `INVALID_URL`                        | 校验   | ❌ Web 不需要                                            |
| 104     | `INVALID_TOKEN`                      | 校验   | ✅ Web 用 `AUTH_TOKEN_EXPIRED`(108)                      |
| 105     | `USER_NAME_TOO_LONG`                 | 校验   | ❌ Web 统一用 110                                        |
| 106     | `CHANNEL_SYNC_NOT_OPEN`              | 校验   | ❌ Web 不需要                                            |
| 107     | `INVALID_CONVERSATION`               | 校验   | ⚠️ 031 ChatManager 需要                                  |
| 112     | `QUERY_PARAM_REACHES_LIMIT`          | 校验   | ✅ Web 用 `SERVICE_LIMIT_EXCEEDED`(4) 覆盖               |
| 203     | `USER_ALREADY_EXIST`                 | 认证   | ❌ Web 不做注册                                          |
| 204     | `USER_NOT_FOUND`                     | 认证   | ✅ 通过 api-errors.json 各 API 单独映射                  |
| 205     | `USER_ILLEGAL_ARGUMENT`              | 认证   | ✅ Web 统一用 `VALIDATION_REQUIRED`(110)                 |
| 206     | `USER_LOGIN_ANOTHER_DEVICE`          | 认证   | ✅ 已补齐，Statistics 断开事件                           |
| 207     | `USER_REMOVED`                       | 认证   | ✅ 已补齐，Statistics 断开事件                           |
| 208     | `USER_REG_FAILED`                    | 认证   | ❌ Web 不做注册                                          |
| 209     | `PUSH_UPDATECONFIGS_FAILED`          | 推送   | ❌ Web 用 303 覆盖                                       |
| 211     | `USER_BINDDEVICETOKEN_FAILED`        | 认证   | ❌ Web 不需要                                            |
| 212     | `USER_UNBIND_DEVICETOKEN_FAILED`     | 认证   | ❌ Web 不需要                                            |
| 216     | `USER_KICKED_BY_CHANGE_PASSWORD`     | 认证   | ✅ 已补齐，Statistics 断开事件                           |
| 217     | `USER_KICKED_BY_OTHER_DEVICE`        | 认证   | ✅ 已补齐，Statistics 断开事件                           |
| 218     | `USER_ALREADY_LOGIN_ANOTHER`         | 认证   | ✅ 已补齐，登录前置校验                                  |
| 219     | `USER_MUTED_BY_ADMIN`                | 认证   | ✅ 已补齐并与移动端对齐                                  |
| 220     | `USER_DEVICE_CHANGED`                | 认证   | ✅ 已补齐，Provision `RESOURCE_CHANGED`                  |
| 221     | `USER_NOT_ON_ROSTER`                 | 认证   | ✅ 已补齐并与移动端对齐                                  |
| 304     | `SERVER_GET_DNSLIST_FAILED`          | 连接   | ✅ Web 用 `CONNECTION_DNSLIST_FAILED`(304)               |
| 305     | `SERVER_SERVING_DISABLED`            | 连接   | ⚠️ 031 ChatManager / 群成员属性需要                      |
| 306     | `SERVER_DECRYPTION_FAILED`           | 连接   | ❌ Web 不需要                                            |
| 307     | `SERVER_GET_RTCCONFIG_FAILED`        | 连接   | ❌ Web 不需要                                            |
| 308     | `SERVER_NO_MATCHING_URL`             | 连接   | ❌ 移动端特有                                            |
| 309     | `SERVER_RESPONSE_ILLEGAL`            | 连接   | ❌ Web 用 303 覆盖                                       |
| 402     | `FILE_UPLOAD_FAILED`                 | 文件   | ✅ Web 用 `UPLOAD_REQUEST_FAILED`(402)                   |
| 403     | `FILE_DOWNLOAD_FAILED`               | 文件   | ⚠️ 031 ChatManager 需要                                  |
| 404     | `FILE_DELETE_FAILED`                 | 文件   | ❌ Web 不需要                                            |
| 405     | `FILE_TOO_LARGE`                     | 文件   | ⚠️ 031 ChatManager 需要                                  |
| 406     | `FILE_CONTENT_IMPROPER`              | 文件   | ⚠️ 031 ChatManager 需要                                  |
| 502     | `MESSAGE_SEND_TRAFFIC_LIMIT`         | 消息   | ⚠️ 031 需要                                              |
| 503     | `MESSAGE_ENCRYPTION_ERROR`           | 消息   | ❌ Web 不需要                                            |
| 506     | `MESSAGE_EXPIRED`                    | 消息   | ⚠️ 031 handleSync 需要                                   |
| 507     | `MESSAGE_ILLEGAL_WHITELIST`          | 消息   | ⚠️ 031 handleSync 需要                                   |
| 508     | `MESSAGE_EXTERNAL_LOGIC_BLOCKED`     | 消息   | ⚠️ 031 handleSync 需要                                   |
| 509     | `MESSAGE_CURRENT_LIMITING`           | 消息   | ⚠️ 031 handleSync 需要                                   |
| 510     | `MESSAGE_SIZE_LIMIT`                 | 消息   | ⚠️ 031 handleSync 需要                                   |
| 512     | `MESSAGE_STREAM_INTERVAL_TIMEOUT`    | 消息   | ❌ Web 有独立流消息错误码                                |
| 513     | `MESSAGE_STREAM_TIMEOUT`             | 消息   | ❌ Web 有独立流消息错误码                                |
| 701     | `CHATROOM_ALREADY_JOINED`            | 聊天室 | ❌ Web 不需要（加入聊天室是幂等的）                      |
| 800-825 | `CALL_*` 系列                        | 音视频 | ❌ Web SDK 不包含音视频                                  |
| 1200    | `THIRD_MODERATION_FAILED`            | 第三方 | ⚠️ 031 handleSync 需要                                   |
| 1299    | `THIRD_DEFAULT_FAILED`               | 第三方 | ⚠️ 031 handleSync 需要                                   |
| 1400    | `THREAD_NOT_EXIST`                   | Thread | ❌ Web 暂未实现 Thread                                   |
| 1401    | `THREAD_ALREADY_EXIST`               | Thread | ❌ Web 暂未实现 Thread                                   |
| 1402    | `THREAD_CREATE_MESSAGE_ILLEGAL`      | Thread | ❌ Web 暂未实现 Thread                                   |
| 1501    | `PUSH_BIND_FAILED`                   | 推送   | ✅ Web 用 `PUSH_SILENT_MODE_OPERATION_FAILED`(1501)      |
| 1502    | `PUSH_UNBIND_FAILED`                 | 推送   | ✅ Web 用 `PUSH_LANGUAGE_OPERATION_FAILED`(1502)         |

---

## 四、Web SDK 独有（移动端没有）

| 数值 | Web SDK 常量                                   | 域         | 说明                           |
| ---- | ---------------------------------------------- | ---------- | ------------------------------ |
| 1600 | `USER_INFO_SUBSCRIPTION_LIMIT_EXCEEDED`        | 用户资料   | 订阅数量超限（Web 独有功能）   |
| 1601 | `USER_INFO_SUBSCRIPTION_TARGET_LIMIT_EXCEEDED` | 用户资料   | 订阅目标数超限（Web 独有功能） |
| 1700 | `CONTACT_SYNC_METADATA_FAILED`                 | 联系人同步 | 024 联系人同步专属             |
| 1701 | `CONTACT_SYNC_SOCKET_FAILED`                   | 联系人同步 | 024 联系人同步专属             |
| 1702 | `CONTACT_SYNC_CURSOR_INVALID`                  | 联系人同步 | 024 联系人同步专属             |
| 1703 | `CONTACT_SYNC_PROTO_DECODE_FAILED`             | 联系人同步 | 024 联系人同步专属             |
| 1704 | `CONTACT_SYNC_CANCELLED`                       | 联系人同步 | 024 联系人同步专属             |
| —    | `STREAM_SEND_NOT_SUPPORTED`                    | 流消息     | Web 独有流消息错误             |
| —    | `STREAM_CHUNK_INVALID`                         | 流消息     | Web 独有流消息错误             |
| —    | `STREAM_TIMEOUT_BY_SERVER`                     | 流消息     | Web 独有流消息错误             |
| —    | `STREAM_STATE_CONFLICT`                        | 流消息     | Web 独有流消息错误             |
| —    | `COMBINE_*` 系列（6 个）                       | 合并消息   | Web 独有合并消息错误           |
| —    | `UPLOAD_*` 系列（6 个）                        | 上传       | Web 独有上传错误               |
| —    | `CONNECTION_*` 系列（9 个）                    | 连接       | Web 独有连接状态错误           |
| —    | `MESSAGE_*` 系列（7 个）                       | 消息       | Web 独有消息发送/编解码错误    |

---

## 五、已补充完成

以下错误码已在 `error-codes.ts` 中补充，与移动端数值对齐：

| 数值 | 移动端                           | Web SDK 常量                        | 域     |
| ---- | -------------------------------- | ----------------------------------- | ------ |
| 107  | `INVALID_CONVERSATION`           | `INVALID_CONVERSATION`              | 校验   |
| 206  | `USER_LOGIN_ANOTHER_DEVICE`      | `USER_LOGIN_ANOTHER_DEVICE`         | 认证   |
| 207  | `USER_REMOVED`                   | `USER_REMOVED`                      | 认证   |
| 216  | `USER_KICKED_BY_CHANGE_PASSWORD` | `USER_KICKED_BY_CHANGE_PASSWORD`    | 认证   |
| 217  | `USER_KICKED_BY_OTHER_DEVICE`    | `USER_KICKED_BY_OTHER_DEVICE`       | 认证   |
| 218  | `USER_ALREADY_LOGIN_ANOTHER`     | `USER_ALREADY_LOGIN_ANOTHER`        | 认证   |
| 219  | `USER_MUTED_BY_ADMIN`            | `USER_MUTED_BY_ADMIN`               | 认证   |
| 220  | `USER_DEVICE_CHANGED`            | `USER_DEVICE_CHANGED`               | 认证   |
| 221  | `USER_NOT_ON_ROSTER`             | `USER_NOT_ON_ROSTER`                | 认证   |
| 305  | `SERVER_SERVING_DISABLED`        | `SERVER_SERVING_DISABLED`           | 连接   |
| 403  | `FILE_DOWNLOAD_FAILED`           | `FILE_DOWNLOAD_FAILED`              | 文件   |
| 405  | `FILE_TOO_LARGE`                 | `FILE_TOO_LARGE`                    | 文件   |
| 406  | `FILE_CONTENT_IMPROPER`          | `FILE_CONTENT_IMPROPER`             | 文件   |
| 502  | `MESSAGE_SEND_TRAFFIC_LIMIT`     | `MESSAGE_SEND_TRAFFIC_LIMIT`        | 消息   |
| 506  | `MESSAGE_EXPIRED`                | `MESSAGE_EXPIRED`                   | 消息   |
| 507  | `MESSAGE_ILLEGAL_WHITELIST`      | `MESSAGE_ILLEGAL_WHITELIST`         | 消息   |
| 508  | `MESSAGE_EXTERNAL_LOGIC_BLOCKED` | `MESSAGE_EXTERNAL_LOGIC_BLOCKED`    | 消息   |
| 509  | `MESSAGE_CURRENT_LIMITING`       | `MESSAGE_CURRENT_LIMITING`          | 消息   |
| 510  | `MESSAGE_SIZE_LIMIT`             | `MESSAGE_SIZE_LIMIT`                | 消息   |
| 1200 | `THIRD_MODERATION_FAILED`        | `THIRD_MODERATION_FAILED`           | 第三方 |
| 1299 | `THIRD_DEFAULT_FAILED`           | `THIRD_DEFAULT_FAILED`              | 第三方 |
| 1501 | `PUSH_BIND_FAILED`               | `PUSH_SILENT_MODE_OPERATION_FAILED` | 推送   |
| 1502 | `PUSH_UNBIND_FAILED`             | `PUSH_LANGUAGE_OPERATION_FAILED`    | 推送   |

---

## 六、REST 通用兜底对齐策略

为减少不同 REST API 在未命中专属 `api-errors.json` 映射时的漂移，Web SDK 当前统一按 HTTP 状态码做最后兜底，优先保证对外错误码稳定：

| HTTP | Web SDK 统一兜底错误码          | 对齐说明                                                  |
| ---- | ------------------------------- | --------------------------------------------------------- |
| 400  | `VALIDATION_UNKNOWN` / `110`    | 对齐移动端 `USER_ILLEGAL_ARGUMENT` 语义，统一视为参数错误 |
| 401  | `AUTH_TOKEN_EXPIRED` / `108`    | Web 侧统一收口为 token 失效，便于上层直接刷新登录态       |
| 403  | `AUTH_FORBIDDEN` / `210`        | 统一表示服务未开通或无权限                                |
| 429  | `SERVICE_LIMIT_EXCEEDED` / `4`  | 对齐移动端 `EXCEED_SERVICE_LIMIT`                         |
| 5xx  | `REST_BUSINESS_UNKNOWN` / `303` | 统一表示服务端未知错误，对齐移动端 `SERVER_UNKNOWN_ERROR` |

说明：

- 如果 API 有更精确的专属映射，优先返回 API 专属错误码。
- 以上兜底主要用于服务端新增错误、只返回通用 HTTP 状态码、或返回体未命中既有业务 key 的场景。
