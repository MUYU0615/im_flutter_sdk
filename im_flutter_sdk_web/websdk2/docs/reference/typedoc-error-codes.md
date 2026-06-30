# 错误码参考

> 自动生成自 `src/rest/api-errors.json`，供 TypeDoc HTML API Reference 使用。
> 本页面只展示对外处理错误所需字段，内部匹配 key 与来源细节请查看 Markdown reference。

## 公开错误码

用户侧优先按 `SDKError.code` 判断错误；`details.serverCode` 和 `details.canonicalCode` 仅用于排障。

| Code | 含义 | 常见场景 | 处理建议 |
| ---: | --- | --- | --- |
| 1 | 通用错误：连接已取消 | connection 通用错误；message 通用错误；unknown 通用错误；另 1 个场景 | - |
| 2 | 网络错误 | transport 通用错误 | - |
| 3 | 本地存储操作失败 | storage 通用错误 | - |
| 4 | 黑名单数量已达上限 | addUsersToBlocklist；createChatThread；createCombineMessage；createGroup；getSubscribedUsers；getUserInfoByAttribute；unknown 通用错误；另 15 个场景 | 移除不再需要的黑名单用户后重试；减少创建频率，清理不需要的子区，或联系服务端提升配额；减少合并消息嵌套层级后重试；减少创建或加入数量，或联系服务端提升限制；降低请求频率后重试；退出不再使用的聊天室后重试，或联系服务端提升限制；减少操作频率或联系服务端提升配额；减少操作频率；减少单次操作的属性数量；删除不再使用的属性后重试；删除不再使用的属性后重试，或联系服务端提升配额；缩短备注内容后重试；稍后重试或提升服务配额 |
| 100 | App Key 不合法 | upload 通用错误 | - |
| 108 | 用户 token 已过期 | auth 通用错误 | - |
| 110 | 参数无效 | acceptContactInvite；addChatRoomMembers；addContact；addConversationMark；addReaction；addUsersToBlocklist；upload 通用错误；validation 通用错误；另 67 个场景 | 传入非空字符串 userId；检查 userIds 列表，确保为非空合法用户 ID；传入非空字符串 userId；message 如需传入也必须是字符串；传入合法 mark，并确保 conversations 为非空数组或传入单个合法会话；传入合法 messageId 和非空 reaction；传入至少一个非空字符串 userId；重复值会由 SDK 去重；传入合法会话 ID，并使用 singleChat 或 groupChat；传入有效的父群组 ID、子区名称和父消息 ID；传入合法的 conversationId、conversationType 和非空 action；传入合法的标题、摘要和 1 到 300 条可合并消息；传入合法的 conversationId、conversationType 和非空 event；params 使用字符串键值；至少传入 data 或 originalUrl，并确保文件元数据合法；更换冲突参数，并确保请求字段长度与取值范围合法；检查创建群组请求体，补齐必填字段并修正字段格式；至少传入 data 或 originalUrl，并确保图片元数据为合法类型和值；传入合法的 conversationId、conversationType、latitude 和 longitude；传入合法的 conversationId、conversationType 和非空 content；receiverList 与 needGroupReadReceipt 仅用于群聊；至少传入 data 或 originalUrl，并传入大于 0 的 duration；传入合法会话 ID、会话类型，并确保 deleteRoamingMessages 为布尔值；通过有效的 chatThreadId 创建 ChatThread 实体；传入有效的子区 ID；传入 type 为 combine 且包含有效 url 的消息，或直接传入合并消息体中的有效 url/secret；确保 keys 为合法非空字符串数组，或省略 keys 获取全部属性；传入 1 到 20 个有效的子区 ID；传入有效的父群组 ID、分页大小和游标；传入有效的子区 ID、分页大小和游标；通过有效的 chatThreadId 创建实体，并传入有效分页参数；使用 SDK 上一次返回的 cursor，并确保 pageSize 为正整数、includeEmptyConversations 为布尔值；传入 0 到 19 之间的整数 mark，并使用合法分页参数；传入正整数 pageSize，并使用上一次返回的 cursor；传入 1 到 20 个会话，并确保每项包含非空 id 与 singleChat/groupChat 类型；传入合法 groupId、messageId，并确保 pageSize 为正整数；传入合法会话定位参数，并确保 pageSize 为正整数；传入有效的分页参数；如指定 parentId，应传入非空字符串；传入合法 messageId、非空 reaction，并确保 pageSize 为正整数；传入合法 messageId；conversationType 为 groupChat 时同时传入 groupId；传入非空用户 ID 数组和非空资料属性数组，并确保属性名属于支持范围；传入非空用户 ID 数组，并确保每个用户 ID 都是非空字符串；传入合法会话 ID，并使用 singleChat、groupChat 或 chatRoom；传入非空 messages，确保每条都是收到的 singleChat 或 groupChat 消息，包含 msgServerId 与 conversationId，且全部属于同一会话；ackContent 仅用于 groupChat；检查 userIds 与 muteDuration，确保传入有效值；传入合法会话定位参数和待撤回消息 ID；确保 key 为合法非空字符串；确保每次删除的属性数量不超过限制，且 keys 为合法非空字符串数组；传入有效的子区 ID 和成员 ID；通过有效的 chatThreadId 创建实体，并传入有效成员 ID；传入非空 messageIds，或传入大于 0 的 beforeTimestamp；先通过 ChatManager 的 create*Message 方法创建消息，并确保当前用户与消息 sender.userId 一致；确保 key/value 为合法非空字符串；确保每次设置的属性数量不超过限制，且 key/value 均为合法字符串；传入非空字符串 userId，并确保 remark 为字符串；可传空字符串清空备注；传入合法会话 ID、会话类型，并确保 pinned 为布尔值；传入合法会话 ID、会话类型，并按 REMIND_TYPE、DURATION 或 INTERVAL 选择一种规则模式；按 REMIND_TYPE、DURATION 或 INTERVAL 选择一种规则模式，并传入对应必填字段；传入非空语言标识，例如 zh-Hans 或 en；缩短公告内容后重试；缩短名称/描述，或传入允许范围内的 maxMembers；仅提交 name、description、maxMembers 等允许修改的字段；传入有效的子区 ID 和新名称；通过有效的 chatThreadId 创建实体，并传入有效的新名称；缩短本次提交的群组字段内容后重试；仅提交允许修改的字段，并确保字段长度合法；传入合法会话定位参数和待编辑消息 ID；至少传入一个可更新字段，并确保字段值类型合法；仅使用支持的资料属性，并确保属性值类型合法；传入非空 deviceId、deviceToken 和 notifierName；在支持上传的环境中调用，或为当前平台配置上传适配器 |
| 111 | 当前服务端不支持获取置顶消息列表 | getPinnedMessageList；updateMessage | 仅传入 type 为 text 或 custom 的消息内容 |
| 112 | 删除消息数量超限 | removeHistoryMessages | - |
| 200 | 用户已登录 | auth 通用错误 | - |
| 201 | 用户未登录 | createChatThread；destroyChatThread；getChatThreadInfo；getChatThreadLastMessageList；getChatThreadList；getChatThreadMemberList；auth 通用错误；另 8 个场景 | 重新登录后再创建子区；重新登录后再解散子区；重新登录后再查询子区详情；重新登录后再查询子区最后消息；重新登录后再查询子区列表；重新登录后再查询子区成员；重新登录后再查询已加入子区；重新登录后再加入子区；重新登录后再退出子区；重新登录后再移除子区成员；重新登录后再更新子区名称 |
| 202 | 用户鉴权失败 | getSubscribedUsers；subscribeUsersInfo；unsubscribeUsersInfo；voiceFileToText；voiceMessageToText；auth 通用错误；connection 通用错误 | refresh_token；刷新 token 后重试 |
| 204 | 用户不存在 | acceptContactInvite；addChatRoomMembers；addContact；addUsersToBlocklist；addUsersToChatRoomAllowlist；blockChatRoomMembers；另 8 个场景 | 确认用户 ID 正确；确认 userIds 中的用户都已存在；确认 memberIds 中的用户都已存在；确认 userId 对应用户存在；确认用户已注册 |
| 210 | 用户无权限：没有添加聊天室成员的权限 | addChatRoomMembers；addContact；addUsersToChatRoomAllowlist；blockChatRoomMembers；createChatThread；deleteChatRoomSharedFile；auth 通用错误；另 31 个场景 | 使用聊天室 owner/admin 账号重试；确认当前用户已加入父群组，并检查控制台 Thread 能力开通状态；使用聊天室 owner 账号重试；使用有管理权限的账号重试；确认当前用户已加入父群组或目标子区；确认当前用户有权限访问传入的所有子区；确认当前用户已加入父群组；确认当前用户已加入目标群组；check_service_permission；确认当前用户已加入父群组且目标子区可加入；确认当前用户已加入目标子区且允许退出；确认当前用户已加入聊天室，并仅删除自己有权限操作的属性；使用群主、管理员或有权限的账号重试；确认当前用户已加入聊天室，并仅修改自己有权限操作的属性；确认当前用户有权限操作目标成员属性 |
| 213 | 用户已在其他设备登录 | auth 通用错误 | - |
| 214 | 用户登录设备数超过限制 | auth 通用错误 | - |
| 215 | 用户被禁言 | sendMessage；auth 通用错误 | - |
| 223 | 非好友不能设置备注 | setContactRemark | 先添加好友再设置备注 |
| 300 | 未连接服务器 | markConversationRead；markMessageRead；recallMessage；sendMessage；updateMessage；connection 通用错误；message 通用错误 | 等待连接成功后重试 |
| 301 | 请求服务超时 | createChatThread；destroyChatThread；getChatThreadInfo；getChatThreadLastMessageList；getChatThreadList；getChatThreadMemberList；connection 通用错误；message 通用错误；transport 通用错误；另 6 个场景 | 稍后重试 |
| 302 | Reaction 服务繁忙 | addReaction；connection 通用错误 | - |
| 303 | 服务请求通用错误 | createChatThread；destroyChatThread；getChatThreadInfo；getChatThreadLastMessageList；getChatThreadList；getChatThreadMemberList；message 通用错误；transport 通用错误；另 8 个场景 | 稍后重试或联系服务端排查 |
| 304 | 获取服务器配置信息错误 | connection 通用错误 | - |
| 305 | 服务已禁用 | setGroupMemberAttributes | 联系服务端开通群成员属性服务 |
| 400 | 附件不存在 | downloadMessageAttachment | - |
| 401 | 合并消息解析失败 | downloadAndParseCombineMessage；downloadMessageAttachment | 仅对包含远程附件地址的图片、语音、视频或文件消息调用 |
| 402 | 上传文件错误 | voiceFileToText；upload 通用错误 | 检查网络和文件后重试 |
| 403 | 合并消息下载失败 | downloadAndParseCombineMessage；downloadMessageAttachment | - |
| 405 | 文件太大 | upload 通用错误 | - |
| 407 | 附件已过期 | downloadMessageAttachment；voiceFileToText；voiceMessageToText | 更换合法语音文件后重试；传入浏览器 File 或小程序 MiniAppFile，并确保语音识别参数类型合法；传入带有效 url 的语音消息体，并确保 format、sampleRate、bitsPerSample、channels 类型合法 |
| 408 | 语音时长超过限制 | voiceFileToText；voiceMessageToText | 缩短语音时长后重试 |
| 409 | 语音转文字失败 | voiceFileToText；voiceMessageToText | 稍后重试；如果持续失败，联系服务端排查 |
| 410 | 语音文件不存在 | voiceMessageToText | 确认语音文件已上传且未过期；确认语音消息已成功上传且 url 有效 |
| 411 | 语音文件过大 | voiceFileToText；voiceMessageToText | 压缩或缩短语音文件后重试 |
| 500 | 消息异常：编码失败 | createCombineMessage；downloadAndParseCombineMessage；getGroupMessageReadUsers；markConversationRead；sendMessage；message 通用错误 | 检查被合并消息的消息体和扩展字段是否合法；检查消息体、扩展字段和附件信息是否合法 |
| 504 | 超过撤回时间限制 | recallMessage | - |
| 505 | Reaction 服务未开通 | addReaction；getHistoryMessages；getReactionDetail；getReactionList；getSupportedTranslationLanguages；recallMessage；另 4 个场景 | 开通服务后重试 |
| 511 | 消息编辑失败 | updateMessage | - |
| 600 | groupId 无效 | getReactionList；joinGroup | 检查并传入合法的 groupId |
| 601 | 已在该群组中 | joinGroup | 无需重复加入，直接使用现有群组上下文 |
| 602 | 当前用户不在该群组中 | addReaction；joinGroup；leaveGroup；setGroupMemberAttributes | 确认当前用户已加入目标群组；确认目标用户已加入群组 |
| 603 | 无权限的群组操作 | changeGroupOwner；deleteGroupSharedFile；destroyGroup；inviteUsersToGroup；joinGroup；leaveGroup；另 1 个场景 | 传入有效的新群主成员 ID，并使用当前群主账号重试；使用群主、管理员或文件所有者账号重试；使用群主账号重试；使用有邀请权限的账号重试；等待管理员审批，或改用有权限的账号重试；先调用 changeGroupOwner 转让群主，再退出群组；确认当前用户权限与群组状态满足更新要求；使用群主或管理员账号重试 |
| 604 | 群组成员超上限 | joinGroup | 清理群成员或提升群人数上限后重试 |
| 605 | 群共享文件 ID 无效 | deleteGroupSharedFile | 确认 fileId 正确且共享文件仍存在 |
| 606 | 聊天室不存在 | addChatRoomMembers；addUsersToChatRoomAllowlist；blockChatRoomMembers；changeGroupOwner；checkIfInChatRoomAllowList；createChatThread；另 51 个场景 | 确认 chatRoomId 正确且聊天室仍存在；确认 groupId 正确且群组仍存在；确认父群组和父消息仍存在后重试；确认 chatRoomId 与 fileId 正确且资源仍存在；确认子区 ID 正确且子区仍存在；确认父群组 ID 正确且群组仍存在；确认 groupIds 中的群组都存在；确认子区和目标成员关系仍存在 |
| 607 | 群组已禁用 | destroyGroup；inviteUsersToGroup；joinGroup；updateGroupInfo | 确认群组状态后再重试；确认群组状态恢复正常后再重试；确认群组状态恢复正常后再尝试加入；先恢复群组可用状态，再重试该操作 |
| 608 | 群组名称无效 | createGroup；updateGroupInfo | 更换为合法群组名称后重试 |
| 609 | 群组成员属性个数超上限 | setGroupMemberAttributes | 减少成员属性条目数量后重试 |
| 610 | 群组成员属性更新失败 | setGroupMemberAttributes | 检查属性内容与当前群成员状态后重试 |
| 611 | 群组成员属性 key 长度超上限 | setGroupMemberAttributes | 缩短属性 key 后重试 |
| 612 | 群组成员属性 value 长度超上限 | setGroupMemberAttributes | 缩短属性 value 后重试 |
| 613 | 用户已被群禁言列表拦截 | joinGroup | 联系群主或管理员移出对应名单后重试 |
| 700 | 聊天室 ID 无效 | chatroom 通用错误 | - |
| 702 | 未加入聊天室 | removeChatRoomAttribute；removeChatRoomAttributes；setChatRoomAttribute；setChatRoomAttributes；chatroom 通用错误 | 先加入聊天室后重试 |
| 703 | 聊天室属性权限拒绝 | removeChatRoomAttribute；removeChatRoomAttributes；setChatRoomAttribute；setChatRoomAttributes；chatroom 通用错误 | 仅删除自己创建的属性，或使用 forced 模式；仅修改自己创建的属性，或使用 forced 模式覆盖 |
| 704 | 聊天室成员已满 | joinChatRoom；chatroom 通用错误 | 等待其他成员退出后重试，或联系聊天室管理员提升上限 |
| 705 | 聊天室不存在 | chatroom 通用错误 | - |
| 706 | 聊天室所有者不允许退出 | chatroom 通用错误 | - |
| 707 | 用户在聊天室黑名单中 | joinChatRoom；chatroom 通用错误 | 联系聊天室管理员将用户从黑名单移除 |
| 900 | 批量查询用户数超限 | getUserInfoByAttribute；getUserInfoByUserId | 减少单次查询的用户数量后重试 |
| 901 | 用户资料数据长度超限 | updateOwnUserInfo | 缩短资料字段内容后重试 |
| 1000 | 添加联系人失败：已是好友 | addContact | - |
| 1001 | 邀请方联系人数量已达上限 | acceptContactInvite；addContact | 删除不再使用的联系人后重试；删除不再使用的联系人后重试，或联系服务端提升配额 |
| 1002 | 被邀请方联系人数量已达上限 | acceptContactInvite；addContact | 联系对方清理联系人列表 |
| 1100 | 参数长度超限 | getPresenceStatus；getSubscribedPresenceList；publishPresence；subscribePresences；unsubscribePresence | 减少单次查询的用户数量；调整 pageNum 或 pageSize 后重试；缩短 customStatus 后重试；减少单次订阅的用户数量；减少单次取消订阅的用户数量 |
| 1101 | 不能订阅自己的在线状态 | subscribePresences | 从订阅列表中移除当前用户 |
| 1110 | 目标语言不合法 | translateMessage | 仅传入包含非空文本内容的文本消息，并指定至少一个合法目标语言代码 |
| 1111 | 翻译服务未开通 | translateMessage | - |
| 1112 | 翻译服务配额已达上限 | translateMessage | - |
| 1113 | 翻译服务异常 | translateMessage | - |
| 1200 | 第三方内容审核拒绝 | sendMessage | - |
| 1300 | Reaction 数量达到上限 | addReaction | - |
| 1301 | 当前用户已经操作过该 Reaction | addReaction | - |
| 1302 | Reaction 操作非法 | addReaction；getReactionDetail；removeReaction | - |
| 1500 | Push token 上传失败 | uploadPushToken；push 通用错误 | 检查登录态、deviceToken 与 notifierName 后重试 |
| 1501 | 免打扰设置失败 | clearConversationRemindType；getConversationSilentMode；getConversationSilentModes；getGlobalSilentMode；setConversationSilentMode；setGlobalSilentMode；push 通用错误 | 检查免打扰参数后重试 |
| 1502 | 推送翻译语言设置失败 | getPushLanguage；setPushLanguage；push 通用错误 | 检查语言参数后重试 |
| 1600 | 订阅人数超限 | getSubscribedUsers；subscribeUsersInfo；unsubscribeUsersInfo | reduce_subscription_targets |
| 1601 | 目标用户被订阅人数超限 | getSubscribedUsers；subscribeUsersInfo；unsubscribeUsersInfo | change_subscription_target |

## API 专属错误

本节按 API 分组列出服务端业务错误到公开 `SDKError.code` 的映射。

**updateOwnUserInfo**

更新当前用户资料

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效 | - | 至少传入一个可更新字段，并确保字段值类型合法 | 否 |
| 110 | 参数无效 | - | 仅使用支持的资料属性，并确保属性值类型合法 | 否 |
| 901 | 用户资料数据长度超限 | 403 | 缩短资料字段内容后重试 | 否 |
| 204 | 用户不存在 | 404 | 确认用户已注册 | 否 |
| 4 | 超过服务限制 | 429 | 降低请求频率后重试 | 是 |

**getUserInfoByUserId**

批量获取用户资料

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效 | - | 传入非空用户 ID 数组，并确保每个用户 ID 都是非空字符串 | 否 |
| 900 | 批量查询用户数超限 | 400 | 减少单次查询的用户数量后重试 | 否 |
| 204 | 用户不存在 | 404 | 确认用户 ID 正确 | 否 |
| 4 | 超过服务限制 | 429 | 降低请求频率后重试 | 是 |

**getUserInfoByAttribute**

按属性批量获取用户资料

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效 | - | 传入非空用户 ID 数组和非空资料属性数组，并确保属性名属于支持范围 | 否 |
| 900 | 批量查询用户数超限 | 400 | 减少单次查询的用户数量后重试 | 否 |
| 204 | 用户不存在 | 404 | 确认用户 ID 正确 | 否 |
| 4 | 超过服务限制 | 429 | 降低请求频率后重试 | 是 |

**subscribeUsersInfo**

订阅陌生人资料变化

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 202 | 用户鉴权失败 | 401 | refresh_token | - |
| 210 | 服务未开通或无权限 | 403 | check_service_permission | - |
| 1600 | 订阅人数超限 | 400 | reduce_subscription_targets | - |
| 1601 | 目标用户被订阅人数超限 | 400 | change_subscription_target | - |
| 4 | 超过服务限制 | 429 | 降低请求频率后重试 | 是 |
| 303 | 服务请求通用错误：服务端内部错误 | 500 | 稍后重试或联系服务端排查 | 是 |

**unsubscribeUsersInfo**

取消订阅陌生人资料变化

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 202 | 用户鉴权失败 | 401 | refresh_token | - |
| 210 | 服务未开通或无权限 | 403 | check_service_permission | - |
| 1600 | 订阅人数超限 | 400 | reduce_subscription_targets | - |
| 1601 | 目标用户被订阅人数超限 | 400 | change_subscription_target | - |
| 4 | 超过服务限制 | 429 | 降低请求频率后重试 | 是 |
| 303 | 服务请求通用错误：服务端内部错误 | 500 | 稍后重试或联系服务端排查 | 是 |

**getSubscribedUsers**

查询已订阅陌生人资料变化列表

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 202 | 用户鉴权失败 | 401 | refresh_token | - |
| 210 | 服务未开通或无权限 | 403 | check_service_permission | - |
| 1600 | 订阅人数超限 | 400 | reduce_subscription_targets | - |
| 1601 | 目标用户被订阅人数超限 | 400 | change_subscription_target | - |
| 4 | 超过服务限制 | 429 | 降低请求频率后重试 | 是 |
| 303 | 服务请求通用错误：服务端内部错误 | 500 | 稍后重试或联系服务端排查 | 是 |

**addContact**

添加联系人

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效 | - | 传入非空字符串 userId；message 如需传入也必须是字符串 | 否 |
| 204 | 用户不存在 | 404 | 确认用户 ID 正确 | 否 |
| 1000 | 添加联系人失败：已是好友 | - | - | 否 |
| 210 | 用户无权限：被对方拉黑 | - | - | 否 |
| 1001 | 邀请方联系人数量已达上限 | 403 | 删除不再使用的联系人后重试，或联系服务端提升配额 | 否 |
| 1002 | 被邀请方联系人数量已达上限 | 403 | 联系对方清理联系人列表 | 否 |

**deleteContact**

删除联系人

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效 | - | 传入非空字符串 userId | 否 |
| 204 | 用户不存在 | 404 | 确认用户 ID 正确 | 否 |

**acceptContactInvite**

接受联系人申请

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效 | - | 传入非空字符串 userId | 否 |
| 204 | 用户不存在 | 404 | 确认用户 ID 正确 | 否 |
| 1001 | 邀请方联系人数量已达上限 | 403 | 删除不再使用的联系人后重试 | 否 |
| 1002 | 被邀请方联系人数量已达上限 | 403 | 联系对方清理联系人列表 | 否 |

**declineContactInvite**

拒绝联系人申请

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效 | - | 传入非空字符串 userId | 否 |
| 204 | 用户不存在 | 404 | 确认用户 ID 正确 | 否 |

**setContactRemark**

设置联系人备注

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效 | - | 传入非空字符串 userId，并确保 remark 为字符串；可传空字符串清空备注 | 否 |
| 223 | 非好友不能设置备注 | 400 | 先添加好友再设置备注 | 否 |
| 4 | 备注长度超限 | 400 | 缩短备注内容后重试 | 否 |

**addUsersToBlocklist**

添加黑名单

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效 | - | 传入至少一个非空字符串 userId；重复值会由 SDK 去重 | 否 |
| 204 | 黑名单添加失败：目标用户不存在 | 404 | 确认用户 ID 正确 | 否 |
| 4 | 黑名单数量已达上限 | 400 | 移除不再需要的黑名单用户后重试 | 否 |

**removeUserFromBlocklist**

移除黑名单

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效 | - | 传入至少一个非空字符串 userId；重复值会由 SDK 去重 | 否 |

**createGroup**

创建群组

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效：缺少创建群组必填参数 | 400 | 检查创建群组请求体，补齐必填字段并修正字段格式 | 否 |
| 110 | 参数无效：群组参数不合法 | 400 | 更换冲突参数，并确保请求字段长度与取值范围合法 | 否 |
| 4 | 超过服务限制：群组数量或成员数量超限 | 403 | 减少创建或加入数量，或联系服务端提升限制 | 否 |
| 608 | 群组名称无效 | 403 | 更换为合法群组名称后重试 | 否 |
| 204 | 用户不存在 | 404 | 确认 memberIds 中的用户都已存在 | 否 |

**getGroupInfo**

获取群组详情

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 606 | 群组不存在 | 404 | 确认 groupId 正确且群组仍存在 | 否 |

**getGroupInfoList**

批量获取群组详情

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 606 | 群组不存在 | 404 | 确认 groupIds 中的群组都存在 | 否 |

**updateGroupInfo**

更新群组信息

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 603 | 无权限的群组操作 | 403 | 使用群主或管理员账号重试 | 否 |
| 603 | 无权限的群组操作 | 403 | 确认当前用户权限与群组状态满足更新要求 | 否 |
| 110 | 参数无效：群组字段不支持修改 | 400 | 仅提交允许修改的字段，并确保字段长度合法 | 否 |
| 110 | 参数无效：群组字段长度超限 | 403 | 缩短本次提交的群组字段内容后重试 | 否 |
| 608 | 群组名称无效 | 403 | 更换为合法群组名称后重试 | 否 |
| 606 | 群组不存在 | 404 | 确认 groupId 正确且群组仍存在 | 否 |
| 607 | 群组已禁用 | 403 | 先恢复群组可用状态，再重试该操作 | 否 |

**changeGroupOwner**

转让群主

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 603 | 无权限的群组操作 | 403 | 传入有效的新群主成员 ID，并使用当前群主账号重试 | 否 |
| 606 | 群组不存在 | 404 | 确认 groupId 正确且群组仍存在 | 否 |

**destroyGroup**

解散群组

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 603 | 无权限的群组操作 | 403 | 使用群主账号重试 | 否 |
| 606 | 群组不存在 | 404 | 确认 groupId 正确且群组仍存在 | 否 |
| 607 | 群组已禁用 | 403 | 确认群组状态后再重试 | 否 |

**leaveGroup**

退出群组

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 602 | 用户未加入该群组 | - | 确认当前用户已加入目标群组 | 否 |
| 603 | 群主不能退出群组 | 403 | 先调用 changeGroupOwner 转让群主，再退出群组 | 否 |
| 606 | 群组不存在 | 404 | 确认 groupId 正确且群组仍存在 | 否 |

**getChatRoomInfo**

获取聊天室详情

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 606 | 聊天室不存在 | 404 | 确认 chatRoomId 正确且聊天室仍存在 | 否 |

**updateChatRoomInfo**

更新聊天室信息

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 210 | 用户无权限：需要聊天室管理员权限 | 401 | 使用聊天室 owner/admin 账号重试 | 否 |
| 110 | 参数无效：聊天室信息长度或范围超限 | 403 | 缩短名称/描述，或传入允许范围内的 maxMembers | 否 |
| 110 | 参数无效：聊天室字段不支持修改 | 400 | 仅提交 name、description、maxMembers 等允许修改的字段 | 否 |
| 606 | 聊天室不存在 | 404 | 确认 chatRoomId 正确且聊天室仍存在 | 否 |

**destroyChatRoom**

销毁聊天室

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 210 | 用户无权限：需要聊天室所有者权限 | 401 | 使用聊天室 owner 账号重试 | 否 |
| 606 | 聊天室不存在 | 404 | 确认 chatRoomId 正确且聊天室仍存在 | 否 |

**joinChatRoom**

加入聊天室

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 4 | 超过服务限制：加入聊天室数量超限 | 403 | 退出不再使用的聊天室后重试，或联系服务端提升限制 | 否 |
| 704 | 聊天室成员已满 | 403 | 等待其他成员退出后重试，或联系聊天室管理员提升上限 | 否 |
| 707 | 用户在聊天室黑名单中 | 403 | 联系聊天室管理员将用户从黑名单移除 | 否 |
| 606 | 聊天室不存在 | 404 | 确认 chatRoomId 正确且聊天室仍存在 | 否 |

**leaveChatRoom**

退出聊天室

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 606 | 聊天室不存在 | 404 | 确认 chatRoomId 正确且聊天室仍存在 | 否 |

**getChatRoomMemberList**

获取聊天室成员列表

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 606 | 聊天室不存在 | 404 | 确认 chatRoomId 正确且聊天室仍存在 | 否 |

**addChatRoomMembers**

添加聊天室成员

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效：聊天室成员参数不合法 | 400 | 检查 userIds 列表，确保为非空合法用户 ID | 否 |
| 210 | 用户无权限：没有添加聊天室成员的权限 | 401 | 使用聊天室 owner/admin 账号重试 | 否 |
| 606 | 聊天室不存在 | 404 | 确认 chatRoomId 正确且聊天室仍存在 | 否 |
| 204 | 用户不存在 | 404 | 确认 userIds 中的用户都已存在 | 否 |

**removeChatRoomMembers**

移除聊天室成员

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 210 | 用户无权限：没有移除聊天室成员的权限 | 401 | 使用聊天室 owner/admin 账号重试 | 否 |
| 606 | 聊天室不存在 | 404 | 确认 chatRoomId 正确且聊天室仍存在 | 否 |

**getChatRoomAdminList**

获取聊天室管理员列表

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 606 | 聊天室不存在 | 404 | 确认 chatRoomId 正确且聊天室仍存在 | 否 |

**setChatRoomAdmin**

设置聊天室管理员

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 210 | 用户无权限：只有聊天室所有者可设置管理员 | 401 | 使用聊天室 owner 账号重试 | 否 |
| 606 | 聊天室不存在 | 404 | 确认 chatRoomId 正确且聊天室仍存在 | 否 |
| 204 | 用户不存在 | 404 | 确认 userId 对应用户存在 | 否 |

**removeChatRoomAdmin**

移除聊天室管理员

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 210 | 用户无权限：只有聊天室所有者可移除管理员 | 401 | 使用聊天室 owner 账号重试 | 否 |
| 606 | 聊天室不存在 | 404 | 确认 chatRoomId 正确且聊天室仍存在 | 否 |

**getChatRoomMuteList**

获取聊天室禁言列表

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 606 | 聊天室不存在 | 404 | 确认 chatRoomId 正确且聊天室仍存在 | 否 |

**muteChatRoomMembers**

禁言聊天室成员

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效：聊天室禁言参数不合法 | 400 | 检查 userIds 与 muteDuration，确保传入有效值 | 否 |
| 210 | 用户无权限：没有禁言聊天室成员的权限 | 401 | 使用聊天室 owner/admin 账号重试 | 否 |
| 606 | 聊天室不存在 | 404 | 确认 chatRoomId 正确且聊天室仍存在 | 否 |

**unmuteChatRoomMembers**

解除聊天室成员禁言

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 210 | 用户无权限：没有解除聊天室成员禁言的权限 | 401 | 使用聊天室 owner/admin 账号重试 | 否 |
| 606 | 聊天室不存在 | 404 | 确认 chatRoomId 正确且聊天室仍存在 | 否 |

**muteAllChatRoomMembers**

开启聊天室全员禁言

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 210 | 用户无权限：没有开启全员禁言的权限 | 401 | 使用聊天室 owner/admin 账号重试 | 否 |
| 606 | 聊天室不存在 | 404 | 确认 chatRoomId 正确且聊天室仍存在 | 否 |

**unmuteAllChatRoomMembers**

关闭聊天室全员禁言

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 210 | 用户无权限：没有关闭全员禁言的权限 | 401 | 使用聊天室 owner/admin 账号重试 | 否 |
| 606 | 聊天室不存在 | 404 | 确认 chatRoomId 正确且聊天室仍存在 | 否 |

**isCurrentUserMutedInChatRoom**

查询当前用户聊天室禁言状态

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 606 | 聊天室不存在 | 404 | 确认 chatRoomId 正确且聊天室仍存在 | 否 |

**getChatRoomBlocklist**

获取聊天室黑名单

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 606 | 聊天室不存在 | 404 | 确认 chatRoomId 正确且聊天室仍存在 | 否 |

**blockChatRoomMembers**

添加聊天室黑名单

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 210 | 用户无权限：没有添加聊天室黑名单的权限 | 401 | 使用聊天室 owner/admin 账号重试 | 否 |
| 606 | 聊天室不存在 | 404 | 确认 chatRoomId 正确且聊天室仍存在 | 否 |
| 204 | 用户不存在 | 404 | 确认 userIds 中的用户都已存在 | 否 |

**unblockChatRoomMembers**

移除聊天室黑名单

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 210 | 用户无权限：没有移除聊天室黑名单的权限 | 401 | 使用聊天室 owner/admin 账号重试 | 否 |
| 606 | 聊天室不存在 | 404 | 确认 chatRoomId 正确且聊天室仍存在 | 否 |

**getChatRoomAllowlist**

获取聊天室 allowlist

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 606 | 聊天室不存在 | 404 | 确认 chatRoomId 正确且聊天室仍存在 | 否 |

**addUsersToChatRoomAllowlist**

添加聊天室 allowlist

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 210 | 用户无权限：没有添加聊天室 allowlist 的权限 | 401 | 使用聊天室 owner/admin 账号重试 | 否 |
| 606 | 聊天室不存在 | 404 | 确认 chatRoomId 正确且聊天室仍存在 | 否 |
| 204 | 用户不存在 | 404 | 确认 userIds 中的用户都已存在 | 否 |

**removeUsersFromChatRoomAllowlist**

移除聊天室 allowlist

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 210 | 用户无权限：没有移除聊天室 allowlist 的权限 | 401 | 使用聊天室 owner/admin 账号重试 | 否 |
| 606 | 聊天室不存在 | 404 | 确认 chatRoomId 正确且聊天室仍存在 | 否 |

**checkIfInChatRoomAllowList**

查询当前用户是否在聊天室 allowlist 中

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 606 | 聊天室不存在 | 404 | 确认 chatRoomId 正确且聊天室仍存在 | 否 |

**getChatRoomAnnouncement**

获取聊天室公告

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 606 | 聊天室不存在 | 404 | 确认 chatRoomId 正确且聊天室仍存在 | 否 |

**updateChatRoomAnnouncement**

更新聊天室公告

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 210 | 用户无权限：需要聊天室管理员权限 | 401 | 使用聊天室 owner/admin 账号重试 | 否 |
| 110 | 参数无效：聊天室公告长度超限 | 403 | 缩短公告内容后重试 | 否 |
| 606 | 聊天室不存在 | 404 | 确认 chatRoomId 正确且聊天室仍存在 | 否 |

**getChatRoomSharedFileList**

获取聊天室共享文件列表

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 606 | 聊天室不存在 | 404 | 确认 chatRoomId 正确且聊天室仍存在 | 否 |

**deleteChatRoomSharedFile**

删除聊天室共享文件

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 210 | 用户无权限：没有删除聊天室共享文件的权限 | 401 | 使用聊天室 owner/admin 账号重试 | 否 |
| 606 | 聊天室不存在 | 404 | 确认 chatRoomId 与 fileId 正确且资源仍存在 | 否 |

**getChatRoomAttributes**

获取聊天室属性

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效：属性 key 列表不合法 | 400 | 确保 keys 为合法非空字符串数组，或省略 keys 获取全部属性 | 否 |
| 606 | 聊天室不存在 | 404 | 确认 chatRoomId 正确且聊天室仍存在 | 否 |

**setChatRoomAttributes**

设置聊天室属性

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效：聊天室属性数量或字段不合法 | 400 | 确保每次设置的属性数量不超过限制，且 key/value 均为合法字符串 | 否 |
| 702 | 未加入聊天室 | 400 | 先加入聊天室后重试 | 否 |
| 703 | 聊天室属性权限拒绝 | 400 | 仅修改自己创建的属性，或使用 forced 模式覆盖 | 否 |
| 4 | 聊天室属性数量或总量超限 | 400 | 删除不再使用的属性后重试，或联系服务端提升配额 | 否 |
| 210 | 用户无权限：聊天室属性写入被拒绝 | 401 | 确认当前用户已加入聊天室，并仅修改自己有权限操作的属性 | 否 |

**setChatRoomAttribute**

设置单个聊天室属性

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效：聊天室属性字段不合法 | 400 | 确保 key/value 为合法非空字符串 | 否 |
| 702 | 未加入聊天室 | 400 | 先加入聊天室后重试 | 否 |
| 703 | 聊天室属性权限拒绝 | 400 | 仅修改自己创建的属性，或使用 forced 模式覆盖 | 否 |
| 4 | 聊天室属性数量或总量超限 | 400 | 删除不再使用的属性后重试 | 否 |
| 210 | 用户无权限：聊天室属性写入被拒绝 | 401 | 确认当前用户已加入聊天室，并仅修改自己有权限操作的属性 | 否 |

**removeChatRoomAttributes**

删除聊天室属性

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效：聊天室属性 key 列表不合法 | 400 | 确保每次删除的属性数量不超过限制，且 keys 为合法非空字符串数组 | 否 |
| 702 | 未加入聊天室 | 400 | 先加入聊天室后重试 | 否 |
| 703 | 聊天室属性权限拒绝 | 400 | 仅删除自己创建的属性，或使用 forced 模式 | 否 |
| 4 | 聊天室属性操作超限 | 400 | 减少单次操作的属性数量 | 否 |
| 210 | 用户无权限：聊天室属性删除被拒绝 | 401 | 确认当前用户已加入聊天室，并仅删除自己有权限操作的属性 | 否 |

**removeChatRoomAttribute**

删除单个聊天室属性

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效：聊天室属性 key 不合法 | 400 | 确保 key 为合法非空字符串 | 否 |
| 702 | 未加入聊天室 | 400 | 先加入聊天室后重试 | 否 |
| 703 | 聊天室属性权限拒绝 | 400 | 仅删除自己创建的属性，或使用 forced 模式 | 否 |
| 4 | 聊天室属性操作超限 | 400 | 减少操作频率 | 否 |
| 210 | 用户无权限：聊天室属性删除被拒绝 | 401 | 确认当前用户已加入聊天室，并仅删除自己有权限操作的属性 | 否 |

**joinGroup**

加入群组

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 600 | 群组 ID 无效 | - | 检查并传入合法的 groupId | 否 |
| 601 | 已在该群组中 | - | 无需重复加入，直接使用现有群组上下文 | 否 |
| 602 | 用户未加入该群组 | - | 确认当前用户已加入目标群组 | 否 |
| 603 | 无权限的群组操作 | 403 | 等待管理员审批，或改用有权限的账号重试 | 否 |
| 604 | 群组成员超上限 | 403 | 清理群成员或提升群人数上限后重试 | 否 |
| 606 | 群组不存在 | 404 | 确认 groupId 正确且群组仍存在 | 否 |
| 607 | 群组已禁用 | - | 确认群组状态恢复正常后再尝试加入 | 否 |
| 613 | 用户已被群禁言列表拦截 | 403 | 联系群主或管理员移出对应名单后重试 | 否 |

**inviteUsersToGroup**

邀请用户入群

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 603 | 无权限的群组操作 | 400 | 使用有邀请权限的账号重试 | 否 |
| 204 | 用户不存在 | 404 | 确认 userIds 中的用户都已存在 | 否 |
| 606 | 群组不存在 | - | 确认 groupId 正确且群组仍存在 | 否 |
| 607 | 群组已禁用 | - | 确认群组状态恢复正常后再重试 | 否 |

**getGroupMemberList**

获取群成员列表

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 606 | 群组不存在 | 404 | 确认 groupId 正确且群组仍存在 | 否 |

**getGroupAdminList**

获取群管理员列表

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 606 | 群组不存在 | 404 | 确认 groupId 正确且群组仍存在 | 否 |

**getGroupMuteList**

获取群禁言列表

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 606 | 群组不存在 | 404 | 确认 groupId 正确且群组仍存在 | 否 |

**getGroupBlocklist**

获取群黑名单

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 606 | 群组不存在 | 404 | 确认 groupId 正确且群组仍存在 | 否 |

**getGroupAllowlist**

获取群 allowlist

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 606 | 群组不存在 | 404 | 确认 groupId 正确且群组仍存在 | 否 |

**getGroupAnnouncement**

获取群公告

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 606 | 群组不存在 | 404 | 确认 groupId 正确且群组仍存在 | 否 |

**getGroupSharedFileList**

获取群共享文件列表

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 606 | 群组不存在 | 404 | 确认 groupId 正确且群组仍存在 | 否 |

**deleteGroupSharedFile**

删除群共享文件

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 603 | 无权限的群组操作 | - | 使用群主、管理员或文件所有者账号重试 | 否 |
| 605 | 群共享文件 ID 无效 | - | 确认 fileId 正确且共享文件仍存在 | 否 |
| 606 | 群组不存在 | - | 确认 groupId 正确且群组仍存在 | 否 |

**setGroupMemberAttributes**

设置群成员属性

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 609 | 群组成员属性个数超上限 | - | 减少成员属性条目数量后重试 | 否 |
| 610 | 群组成员属性更新失败 | - | 检查属性内容与当前群成员状态后重试 | 否 |
| 611 | 群组成员属性 key 长度超上限 | - | 缩短属性 key 后重试 | 否 |
| 612 | 群组成员属性 value 长度超上限 | - | 缩短属性 value 后重试 | 否 |
| 602 | 用户未加入该群组 | 404 | 确认目标用户已加入群组 | 否 |
| 210 | 无权限设置群成员属性 | 401 | 确认当前用户有权限操作目标成员属性 | 否 |
| 210 | 无权限设置群成员属性 | 403 | 确认当前用户有权限操作目标成员属性 | 否 |
| 4 | 超过服务限制 | 400 | 减少操作频率或联系服务端提升配额 | 否 |
| 305 | 服务已禁用 | 403 | 联系服务端开通群成员属性服务 | 否 |

**getGroupMembersAttributes**

批量获取群成员属性

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 606 | 群组不存在 | - | 确认 groupId 正确且群组仍存在 | 否 |

**sendMessage**

发送消息

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效 | - | 先通过 ChatManager 的 create*Message 方法创建消息，并确保当前用户与消息 sender.userId 一致 | 否 |
| 300 | 服务器不可达 | - | 等待连接成功后重试 | 是 |
| 500 | 消息异常：编码失败 | - | 检查消息体、扩展字段和附件信息是否合法 | 否 |
| 1200 | 第三方内容审核拒绝 | - | - | - |
| 215 | 用户被禁言 | - | - | - |

**createTextMessage**

创建文本消息

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效 | - | 传入合法的 conversationId、conversationType 和非空 content；receiverList 与 needGroupReadReceipt 仅用于群聊 | 否 |

**createImageMessage**

创建图片消息

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效 | - | 至少传入 data 或 originalUrl，并确保图片元数据为合法类型和值 | 否 |

**createFileMessage**

创建文件消息

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效 | - | 至少传入 data 或 originalUrl，并确保文件元数据合法 | 否 |

**createVoiceMessage**

创建语音消息

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效 | - | 至少传入 data 或 originalUrl，并传入大于 0 的 duration | 否 |

**createVideoMessage**

创建视频消息

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效 | - | 至少传入 data 或 originalUrl，并传入大于 0 的 duration | 否 |

**createLocationMessage**

创建位置消息

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效 | - | 传入合法的 conversationId、conversationType、latitude 和 longitude | 否 |

**createCmdMessage**

创建命令消息

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效 | - | 传入合法的 conversationId、conversationType 和非空 action | 否 |

**createCustomMessage**

创建自定义消息

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效 | - | 传入合法的 conversationId、conversationType 和非空 event；params 使用字符串键值 | 否 |

**createCombineMessage**

创建合并消息

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效 | - | 传入合法的标题、摘要和 1 到 300 条可合并消息 | 否 |
| 4 | 超过服务限制 | - | 减少合并消息嵌套层级后重试 | 否 |
| 500 | 消息异常：编码失败 | - | 检查被合并消息的消息体和扩展字段是否合法 | 否 |

**publishPresence**

发布在线状态

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 1100 | 发布自定义在线状态时，参数长度超出限制 | 400 | 缩短 customStatus 后重试 | 否 |

**subscribePresences**

订阅在线状态

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 1101 | 不能订阅自己的在线状态 | 400 | 从订阅列表中移除当前用户 | 否 |
| 1100 | 参数长度超限 | 400 | 减少单次订阅的用户数量 | 否 |

**unsubscribePresence**

取消订阅在线状态

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 1100 | 参数长度超限 | 400 | 减少单次取消订阅的用户数量 | 否 |

**getSubscribedPresenceList**

查询在线状态订阅列表

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 1100 | 参数长度超限 | 400 | 调整 pageNum 或 pageSize 后重试 | 否 |

**getPresenceStatus**

查询在线状态

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 1100 | 参数长度超限 | 400 | 减少单次查询的用户数量 | 否 |

**setGlobalSilentMode**

设置全局免打扰

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效 | - | 按 REMIND_TYPE、DURATION 或 INTERVAL 选择一种规则模式，并传入对应必填字段 | 否 |
| 1501 | 免打扰设置失败 | 400 | 检查免打扰参数后重试 | 否 |

**setConversationSilentMode**

设置会话免打扰

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效 | - | 传入合法会话 ID、会话类型，并按 REMIND_TYPE、DURATION 或 INTERVAL 选择一种规则模式 | 否 |
| 1501 | 免打扰设置失败 | 400 | 检查免打扰参数后重试 | 否 |

**setPushLanguage**

设置推送语言

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效 | - | 传入非空语言标识，例如 zh-Hans 或 en | 否 |
| 1502 | 推送翻译语言设置失败 | 400 | 检查语言参数后重试 | 否 |

**uploadPushToken**

上传推送 token

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效 | - | 传入非空 deviceId、deviceToken 和 notifierName | 否 |
| 1500 | Push token 上传失败 | 400 | 检查登录态、deviceToken 与 notifierName 后重试 | 是 |

**getGlobalSilentMode**

获取全局免打扰

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 1501 | 免打扰设置失败 | - | - | - |

**getConversationSilentMode**

获取会话免打扰

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效 | - | 传入合法会话 ID，并使用 singleChat 或 groupChat | 否 |
| 1501 | 免打扰设置失败 | - | - | - |

**clearConversationRemindType**

清除会话提醒类型

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效 | - | 传入合法会话 ID，并使用 singleChat 或 groupChat | 否 |
| 1501 | 免打扰设置失败 | - | - | - |

**getConversationSilentModes**

批量获取会话免打扰

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效 | - | 传入 1 到 20 个会话，并确保每项包含非空 id 与 singleChat/groupChat 类型 | 否 |
| 1501 | 免打扰设置失败 | - | - | - |

**getConversationListByRemindType**

分页获取免打扰会话

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效 | - | 传入正整数 pageSize，并使用上一次返回的 cursor | 否 |

**getConversationList**

获取会话列表

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效 | - | 使用 SDK 上一次返回的 cursor，并确保 pageSize 为正整数、includeEmptyConversations 为布尔值 | 否 |

**getPinnedConversationList**

获取置顶会话列表

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效 | - | 使用 SDK 上一次返回的 cursor，并确保 pageSize 为正整数、includeEmptyConversations 为布尔值 | 否 |

**getConversationListByMark**

按标记获取会话列表

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效 | - | 传入 0 到 19 之间的整数 mark，并使用合法分页参数 | 否 |

**deleteConversation**

删除会话

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效 | - | 传入合法会话 ID、会话类型，并确保 deleteRoamingMessages 为布尔值 | 否 |

**setConversationPinned**

设置会话置顶

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效 | - | 传入合法会话 ID、会话类型，并确保 pinned 为布尔值 | 否 |

**addConversationMark**

添加会话标记

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效 | - | 传入合法 mark，并确保 conversations 为非空数组或传入单个合法会话 | 否 |

**removeConversationMark**

移除会话标记

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效 | - | 传入合法 mark，并确保 conversations 为非空数组或传入单个合法会话 | 否 |

**createChatThread**

创建子区

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效 | - | 传入有效的父群组 ID、子区名称和父消息 ID | 否 |
| 201 | 用户未登录 | 401 | 重新登录后再创建子区 | 否 |
| 210 | 无权限创建子区 | 403 | 确认当前用户已加入父群组，并检查控制台 Thread 能力开通状态 | 否 |
| 606 | 群组或父消息不存在 | 404 | 确认父群组和父消息仍存在后重试 | 否 |
| 4 | 超过服务限制 | 400 | 减少创建频率，清理不需要的子区，或联系服务端提升配额 | 否 |
| 301 | 请求服务超时 | 504 | 稍后重试 | 是 |
| 303 | 服务请求通用错误 | 500 | 稍后重试或联系服务端排查 | 是 |

**getChatThreadList**

获取子区列表

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效 | - | 传入有效的父群组 ID、分页大小和游标 | 否 |
| 201 | 用户未登录 | 401 | 重新登录后再查询子区列表 | 否 |
| 210 | 无权限查询子区列表 | 403 | 确认当前用户已加入父群组 | 否 |
| 606 | 群组不存在 | 404 | 确认父群组 ID 正确且群组仍存在 | 否 |
| 301 | 请求服务超时 | 504 | 稍后重试 | 是 |
| 303 | 服务请求通用错误 | 500 | 稍后重试或联系服务端排查 | 是 |

**getJoinedChatThreadList**

获取已加入子区列表

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效 | - | 传入有效的分页参数；如指定 parentId，应传入非空字符串 | 否 |
| 201 | 用户未登录 | 401 | 重新登录后再查询已加入子区 | 否 |
| 210 | 无权限查询已加入子区 | 403 | 确认当前用户已加入目标群组 | 否 |
| 606 | 群组不存在 | 404 | 确认父群组 ID 正确且群组仍存在 | 否 |
| 301 | 请求服务超时 | 504 | 稍后重试 | 是 |
| 303 | 服务请求通用错误 | 500 | 稍后重试或联系服务端排查 | 是 |

**getChatThreadInfo**

获取子区详情

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效 | - | 传入有效的子区 ID | 否 |
| 110 | 参数无效 | - | 通过有效的 chatThreadId 创建 ChatThread 实体 | 否 |
| 110 | 参数无效 | - | 通过有效的 chatThreadId 创建 ChatThread 实体 | 否 |
| 201 | 用户未登录 | 401 | 重新登录后再查询子区详情 | 否 |
| 210 | 无权限查询子区详情 | 403 | 确认当前用户已加入父群组或目标子区 | 否 |
| 606 | 子区不存在 | 404 | 确认子区 ID 正确且子区仍存在 | 否 |
| 301 | 请求服务超时 | 504 | 稍后重试 | 是 |
| 303 | 服务请求通用错误 | 500 | 稍后重试或联系服务端排查 | 是 |

**joinChatThread**

加入子区

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效 | - | 传入有效的子区 ID | 否 |
| 110 | 参数无效 | - | 通过有效的 chatThreadId 创建 ChatThread 实体 | 否 |
| 201 | 用户未登录 | 401 | 重新登录后再加入子区 | 否 |
| 210 | 无权限加入子区 | 403 | 确认当前用户已加入父群组且目标子区可加入 | 否 |
| 606 | 子区不存在 | 404 | 确认子区 ID 正确且子区仍存在 | 否 |
| 4 | 超过服务限制 | 400 | 减少操作频率或联系服务端提升配额 | 否 |
| 301 | 请求服务超时 | 504 | 稍后重试 | 是 |
| 303 | 服务请求通用错误 | 500 | 稍后重试或联系服务端排查 | 是 |

**leaveChatThread**

退出子区

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效 | - | 传入有效的子区 ID | 否 |
| 110 | 参数无效 | - | 通过有效的 chatThreadId 创建 ChatThread 实体 | 否 |
| 201 | 用户未登录 | 401 | 重新登录后再退出子区 | 否 |
| 210 | 无权限退出子区 | 403 | 确认当前用户已加入目标子区且允许退出 | 否 |
| 606 | 子区不存在 | 404 | 确认子区 ID 正确且子区仍存在 | 否 |
| 301 | 请求服务超时 | 504 | 稍后重试 | 是 |
| 303 | 服务请求通用错误 | 500 | 稍后重试或联系服务端排查 | 是 |

**destroyChatThread**

解散子区

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效 | - | 传入有效的子区 ID | 否 |
| 110 | 参数无效 | - | 通过有效的 chatThreadId 创建 ChatThread 实体 | 否 |
| 201 | 用户未登录 | 401 | 重新登录后再解散子区 | 否 |
| 210 | 无权限解散子区 | 403 | 使用有管理权限的账号重试 | 否 |
| 606 | 子区不存在 | 404 | 确认子区 ID 正确且子区仍存在 | 否 |
| 301 | 请求服务超时 | 504 | 稍后重试 | 是 |
| 303 | 服务请求通用错误 | 500 | 稍后重试或联系服务端排查 | 是 |

**updateChatThreadName**

更新子区名称

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效 | - | 传入有效的子区 ID 和新名称 | 否 |
| 110 | 参数无效 | - | 通过有效的 chatThreadId 创建实体，并传入有效的新名称 | 否 |
| 201 | 用户未登录 | 401 | 重新登录后再更新子区名称 | 否 |
| 210 | 无权限更新子区名称 | 403 | 使用群主、管理员或有权限的账号重试 | 否 |
| 606 | 子区不存在 | 404 | 确认子区 ID 正确且子区仍存在 | 否 |
| 301 | 请求服务超时 | 504 | 稍后重试 | 是 |
| 303 | 服务请求通用错误 | 500 | 稍后重试或联系服务端排查 | 是 |

**getChatThreadMemberList**

获取子区成员列表

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效 | - | 传入有效的子区 ID、分页大小和游标 | 否 |
| 110 | 参数无效 | - | 通过有效的 chatThreadId 创建实体，并传入有效分页参数 | 否 |
| 201 | 用户未登录 | 401 | 重新登录后再查询子区成员 | 否 |
| 210 | 无权限查询子区成员 | 403 | 确认当前用户已加入父群组或目标子区 | 否 |
| 606 | 子区不存在 | 404 | 确认子区 ID 正确且子区仍存在 | 否 |
| 301 | 请求服务超时 | 504 | 稍后重试 | 是 |
| 303 | 服务请求通用错误 | 500 | 稍后重试或联系服务端排查 | 是 |

**removeChatThreadMember**

移除子区成员

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效 | - | 传入有效的子区 ID 和成员 ID | 否 |
| 110 | 参数无效 | - | 通过有效的 chatThreadId 创建实体，并传入有效成员 ID | 否 |
| 201 | 用户未登录 | 401 | 重新登录后再移除子区成员 | 否 |
| 210 | 无权限移除子区成员 | 403 | 使用群主、管理员或有权限的账号重试 | 否 |
| 606 | 子区或成员不存在 | 404 | 确认子区和目标成员关系仍存在 | 否 |
| 301 | 请求服务超时 | 504 | 稍后重试 | 是 |
| 303 | 服务请求通用错误 | 500 | 稍后重试或联系服务端排查 | 是 |

**getChatThreadLastMessageList**

批量获取子区最后一条消息

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效 | - | 传入 1 到 20 个有效的子区 ID | 否 |
| 201 | 用户未登录 | 401 | 重新登录后再查询子区最后消息 | 否 |
| 210 | 无权限查询子区最后消息 | 403 | 确认当前用户有权限访问传入的所有子区 | 否 |
| 606 | 子区不存在 | 404 | 确认子区 ID 正确且子区仍存在 | 否 |
| 301 | 请求服务超时 | 504 | 稍后重试 | 是 |
| 303 | 服务请求通用错误 | 500 | 稍后重试或联系服务端排查 | 是 |

**getPushLanguage**

获取推送翻译语言

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 1502 | 推送翻译语言设置失败 | - | - | - |

**markConversationRead**

标记会话已读

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效 | - | 传入合法会话 ID，并使用 singleChat、groupChat 或 chatRoom | 否 |
| 201 | 未登录 | - | - | - |
| 300 | 未连接服务器 | - | - | - |
| 500 | 会话中无消息 | - | - | - |

**markMessageRead**

批量标记消息已读

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效 | - | 传入非空 messages，确保每条都是收到的 singleChat 或 groupChat 消息，包含 msgServerId 与 conversationId，且全部属于同一会话；ackContent 仅用于 groupChat | 否 |
| 110 | 只能对接收的消息发送已读回执 | - | - | - |
| 300 | 未连接服务器 | - | - | - |

**recallMessage**

撤回消息

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效 | - | 传入合法会话定位参数和待撤回消息 ID | 否 |
| 110 | 消息无效或未发送成功 | - | - | - |
| 201 | 未登录 | - | - | - |
| 300 | 未连接服务器 | - | - | - |
| 504 | 超过撤回时间限制 | - | - | - |
| 505 | 撤回功能未开通 | - | - | - |

**updateMessage**

编辑消息

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效 | - | 传入合法会话定位参数和待编辑消息 ID | 否 |
| 111 | 操作不支持 | - | 仅传入 type 为 text 或 custom 的消息内容 | 否 |
| 110 | 消息无效 | - | - | - |
| 111 | 仅支持编辑文本和自定义消息 | - | - | - |
| 201 | 未登录 | - | - | - |
| 210 | 无权编辑该消息 | - | - | - |
| 300 | 未连接服务器 | - | - | - |
| 511 | 消息编辑失败 | - | - | - |

**downloadMessageAttachment**

下载消息附件

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 401 | 附件无效或消息类型不支持下载 | - | 仅对包含远程附件地址的图片、语音、视频或文件消息调用 | 否 |
| 400 | 附件不存在 | 404 | - | - |
| 401 | 附件无效或消息类型不支持下载 | - | - | - |
| 403 | 附件下载失败 | - | - | - |
| 407 | 附件已过期 | 404 | - | - |

**downloadAndParseCombineMessage**

下载合并消息

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效 | - | 传入 type 为 combine 且包含有效 url 的消息，或直接传入合并消息体中的有效 url/secret | 否 |
| 110 | 消息为空 | - | - | - |
| 500 | 消息不是合并消息类型 | - | - | - |
| 401 | 合并消息解析失败 | - | - | - |
| 403 | 合并消息下载失败 | - | - | - |

**getHistoryMessages**

获取历史消息

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效 | - | 传入合法会话定位参数，并确保 pageSize 为正整数 | 否 |
| 505 | 消息漫游服务未开通 | - | - | - |
| 110 | 分页参数超限 | - | - | - |

**removeHistoryMessages**

删除历史消息

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效 | - | 传入非空 messageIds，或传入大于 0 的 beforeTimestamp | 否 |
| 505 | 消息漫游服务未开通 | - | - | - |
| 112 | 删除消息数量超限 | - | - | - |

**getGroupMessageReadUsers**

获取群消息已读成员

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效 | - | 传入合法 groupId、messageId，并确保 pageSize 为正整数 | 否 |
| 500 | 消息不存在 | - | - | - |

**addReaction**

添加消息 Reaction

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效 | - | 传入合法 messageId 和非空 reaction | 否 |
| 1301 | 当前用户已经操作过该 Reaction | - | - | - |
| 1300 | Reaction 数量达到上限 | - | - | - |
| 602 | 当前用户不在该群组中 | - | - | - |
| 1302 | Reaction 操作非法 | - | - | - |
| 505 | Reaction 服务未开通 | - | - | - |
| 302 | Reaction 服务繁忙 | - | - | - |

**removeReaction**

删除消息 Reaction

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效 | - | 传入合法 messageId 和非空 reaction | 否 |
| 505 | Reaction 服务未开通 | - | - | - |
| 1302 | Reaction 操作非法 | - | - | - |

**getReactionList**

获取消息 Reaction 列表

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效 | - | 传入合法 messageId；conversationType 为 groupChat 时同时传入 groupId | 否 |
| 505 | Reaction 服务未开通 | - | - | - |
| 600 | groupId 无效 | - | - | - |

**getReactionDetail**

获取消息 Reaction 详情

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 参数无效 | - | 传入合法 messageId、非空 reaction，并确保 pageSize 为正整数 | 否 |
| 505 | Reaction 服务未开通 | - | - | - |
| 1302 | Reaction 操作非法 | - | - | - |

**pinMessage**

置顶消息

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 消息 ID 非法 | - | - | - |
| 4 | 置顶消息数量达到上限 | - | - | - |
| 110 | 待置顶消息不存在 | - | - | - |

**unpinMessage**

取消置顶消息

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 110 | 消息 ID 非法 | - | - | - |
| 110 | 待取消置顶消息不存在 | - | - | - |

**getPinnedMessageList**

获取置顶消息列表

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 111 | 当前服务端不支持获取置顶消息列表 | - | - | - |
| 110 | 置顶消息不存在 | - | - | - |

**getSupportedTranslationLanguages**

获取翻译支持语言

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 505 | 翻译服务未开通 | - | - | - |

**translateMessage**

翻译消息内容

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 1110 | 目标语言不合法 | - | 仅传入包含非空文本内容的文本消息，并指定至少一个合法目标语言代码 | 否 |
| 1110 | 翻译文本过长 | - | - | - |
| 1110 | 目标语言不合法 | - | - | - |
| 1111 | 翻译服务未开通 | - | - | - |
| 1112 | 翻译服务配额已达上限 | - | - | - |
| 1113 | 翻译服务异常 | - | - | - |

**voiceMessageToText**

语音消息转文字

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 407 | 语音文件无效 | - | 传入带有效 url 的语音消息体，并确保 format、sampleRate、bitsPerSample、channels 类型合法 | 否 |
| 410 | 语音文件不存在 | - | 确认语音消息已成功上传且 url 有效 | 否 |
| 202 | 用户鉴权失败 | - | 刷新 token 后重试 | 是 |
| 410 | 语音文件不存在 | - | 确认语音文件已上传且未过期 | 否 |
| 407 | 语音文件无效 | - | 更换合法语音文件后重试 | 否 |
| 408 | 语音时长超过限制 | - | 缩短语音时长后重试 | 否 |
| 411 | 语音文件过大 | - | 压缩或缩短语音文件后重试 | 否 |
| 505 | 语音转文字服务未开通 | - | 开通服务后重试 | 否 |
| 4 | 超过服务限制 | - | 稍后重试或提升服务配额 | 是 |
| 409 | 语音转文字失败 | - | 稍后重试；如果持续失败，联系服务端排查 | 是 |

**voiceFileToText**

本地语音文件转文字

| Code | 含义 | HTTP | 处理建议 | 可重试 |
| ---: | --- | --- | --- | --- |
| 407 | 语音文件无效 | - | 传入浏览器 File 或小程序 MiniAppFile，并确保语音识别参数类型合法 | 否 |
| 110 | 参数无效：缺少必需字段 | - | 在支持上传的环境中调用，或为当前平台配置上传适配器 | 否 |
| 202 | 用户鉴权失败 | - | 刷新 token 后重试 | 是 |
| 402 | 上传文件错误 | - | 检查网络和文件后重试 | 是 |
| 407 | 语音文件无效 | - | 更换合法语音文件后重试 | 否 |
| 408 | 语音时长超过限制 | - | 缩短语音时长后重试 | 否 |
| 411 | 语音文件过大 | - | 压缩或缩短语音文件后重试 | 否 |
| 505 | 语音转文字服务未开通 | - | 开通服务后重试 | 否 |
| 4 | 超过服务限制 | - | 稍后重试或提升服务配额 | 是 |
| 409 | 语音转文字失败 | - | 稍后重试；如果持续失败，联系服务端排查 | 是 |
