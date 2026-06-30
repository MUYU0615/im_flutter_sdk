# WebSDK2 Web API 四向映射基线

## 目的

这份文档用于把四个来源放到同一张表里，作为后续全量重对齐的唯一基线：

1. `websdk2` 中文 API 文档
2. Flutter Web adapter
3. `web_real_e2e_coverage.yaml`
4. `native-auto-test/tests/web_real/*.py`

本轮先填 `GroupManager` 和 `ChatManager`，并优先标出最可能误判的项。

## 判定规则

### 差异桶

1. 文档已公开，adapter 未接
2. adapter 已接，但方法名、层级或参数语义不对
3. adapter 已接，但 coverage 状态不对
4. coverage 状态对，但 case 或断言不足

### blocked 结论口径

blocked 只允许归入两类测试结论：

- `API未对齐iOS/Android`
- `API执行未通过`

## 文档工程备注

- `websdk2/docs/reference/api-reference.zh-CN.md` 已可生成并作为当前公开 API 基线。
- Jira 中给出的 `docs/intergration` 路径在当前本地 `websdk2` 工程中未找到，需要单独记录为文档缺口。
- 当前审计基于本地 `websdk2` 源码工程文档，而不是只基于 tgz 包或 vendor bundle 文本搜索。

## GroupManager

| 文档 Manager | 文档 API | Flutter method key / manager | interop 方法 | coverage 状态 | case | 结论 |
|---|---|---|---|---|---|---|
| `Group` | `muteAllMembers()` | `GroupManager.muteAllMembers` | `realSdk.muteAllGroupMembers` | `blocked` | `test_real_web_group_mute_all_members_server_state` | 文档明确公开；IMSDK 高层 `ChatClient -> groupManager -> Group` 调用链现已接通，真实 E2E 中可以成功建群并调用 `muteAllMembers()`。但紧随其后的真实群详情读回里 `isAllMemberMuted` 仍然是 `False`，因此当前结论应更新为 `API执行未通过`，而不是“无公开 API”或“层级未对齐”。 |
| `Group` | `unmuteAllMembers()` | `GroupManager.unMuteAllMembers` | `realSdk.unmuteAllGroupMembers` | `blocked` | `test_real_web_group_mute_all_members_server_state` | 同上。文档明确公开，高层链路也已接通；但由于 `muteAllMembers()` 本身无法通过服务端详情读回证明状态生效，`unmuteAllMembers()` 也暂时不能独立回收，当前仍属于 `API执行未通过`。 |
| `Group` | `uploadSharedFile()` | `GroupManager.uploadGroupSharedFile` | `realSdk.uploadGroupSharedFile` | `blocked` | `test_real_web_group_shared_file_upload_and_remove_server_state` | 文档公开，adapter 已接真实路径。当前执行后服务端共享文件元数据异常，属于 `API执行未通过`。 |
| `Group` | `downloadSharedFile()` | `GroupManager.downloadGroupSharedFile` | `realSdk.downloadGroupSharedFile` | `supported` | `test_real_web_group_shared_file_upload_and_remove_server_state` | 文档公开，adapter 已按 callback 风格接入真实路径，现有结论一致。 |
| `Group` | `deleteSharedFile()` | `GroupManager.removeGroupSharedFile` | `realSdk.removeGroupSharedFile` | `supported` | `test_real_web_group_shared_file_upload_and_remove_server_state` | 文档公开名与 Flutter method key 不同，但语义已对齐。 |
| `Group` | `blockMembers()` | `GroupManager.blockMembers` | `realSdk.blockGroupMembers` | `supported` | `test_real_web_group_block_and_unblock_members_server_state` | 文档公开且真实 E2E 已证明，现有结论一致。 |
| `Group` | `unblockMembers()` | `GroupManager.unblockMembers` | `realSdk.unblockGroupMembers` | `supported` | `test_real_web_group_block_and_unblock_members_server_state` | 文档公开且真实 E2E 已证明，现有结论一致。 |
| `GroupManager` | `joinGroup()`（需审批公开群场景） | `GroupManager.requestToJoinPublicGroup` | `realSdk.requestToJoinPublicGroup` | `supported` | `test_real_web_group_request_join_accept_and_decline_server_state` | 文档公开入口位于 manager，不是 `Group` 实例方法。当前覆盖已支持，但映射层级需要说明。 |
| `GroupManager` | `acceptGroupJoinRequest()` | `GroupManager.acceptJoinApplication` | `realSdk.acceptJoinApplication` | `supported` | `test_real_web_group_request_join_accept_and_decline_server_state` | 文档公开，当前 supported 结论一致。 |
| `GroupManager` | `rejectGroupJoinRequest()` | `GroupManager.declineJoinApplication` | `realSdk.declineJoinApplication` | `supported` | `test_real_web_group_request_join_accept_and_decline_server_state` | 文档公开，当前 supported 结论一致。 |
| `Group` | `setMemberAttributes()` | `GroupManager.setMemberAttributesFromGroup` | `realSdk.setGroupMemberAttributes` | `supported` | `test_real_web_group_member_attributes_server_state` | 文档公开；Flutter method key 与文档层级不同，但真实 E2E 已对齐。 |
| `Group` | `getMembersAttributes()` | `GroupManager.fetchMemberAttributesFromGroup` / `fetchMembersAttributesFromGroup` | `realSdk.getGroupMemberAttributes` / `getGroupMembersAttributes` | `supported` | `test_real_web_group_member_attributes_server_state` | 文档公开；Flutter 将同一文档能力拆成单用户与多用户两条 method key。 |
| `Group` | `updateInfo()` / `updateInfo.custom` | `GroupManager.updateGroupExt` | `realSdk.updateGroupExtension` | `supported` | `test_real_web_group_update_ext_server_state` | 文档没有独立 `updateGroupExt` 名称，当前属于对 `custom/ext` 能力的语义折叠映射。 |
| 无明确对等文档能力 | 无 | `GroupManager.blockGroup` | `realSdk.disableSendGroupMsg` | `blocked` | `test_real_web_group_block_and_unblock_message_flow` | 当前 Web 行为不满足 Flutter `blockGroup` 的“屏蔽接收群消息”契约，blocked 结论合理，属 `API未对齐iOS/Android`。 |
| 无明确对等文档能力 | 无 | `GroupManager.unblockGroup` | `realSdk.enableSendGroupMsg` | `blocked` | `test_real_web_group_block_and_unblock_message_flow` | 同上，blocked 结论合理。 |

### GroupManager 当前优先回收项

1. `muteAllMembers`
2. `unMuteAllMembers`

这两条已经不应继续保留“Web 无公开 API”的 blocked 原因。当前更准确的结论是：

1. 文档公开能力存在；
2. 当前 Flutter Web real adapter 绑定对象层级不对；
3. 现阶段仍 blocked，但应归因于 adapter 未对齐文档公开调用链，而不是 Web SDK 缺能力。

## ChatManager

| 文档 Manager | 文档 API | Flutter method key / manager | interop 方法 | coverage 状态 | case | 结论 |
|---|---|---|---|---|---|---|
| `ChatManager` | `createCombineMessage()` | `ChatManager.sendMessageWithType` 的 combine 分支 / `downloadAndParseCombineMessage` | `realSdk.sendCombineMessage` / `downloadAndParseCombineMessage` | `blocked` | `test_real_web_send_message_with_type_combine_a_to_b`（`xfail`） | 文档公开 create 与 parse，但真实 combine 发送未完成，当前 blocked 合理，属 `API执行未通过`。 |
| `ChatManager` | `sendMessage()` + `createTextMessage()` | `ChatManager.sendMessageWithType` | 真实文本发送路径 | `supported` | `test_real_web_send_message_with_type_text_a_to_b` | 当前 supported 仅覆盖 `txt`，不能外推到 `combine`。报告需继续保留“需额外说明”。 |
| `ChatManager` | `downloadAndParseCombineMessage()` | `ChatManager.downloadAndParseCombineMessage` | `realSdk.downloadAndParseCombineMessage` | `blocked` | `test_real_web_send_message_with_type_combine_a_to_b`（`xfail`） | 文档公开 parse API，但前置真实 combine 消息未形成，blocked 合理，属 `API执行未通过`。 |
| `ChatManager` | `markConversationRead()` | `ChatManager.ackConversationRead` / `markAllChatMsgAsRead` | `realSdk.markConversationRead` | `ackConversationRead: supported` / `markAllChatMsgAsRead: blocked` | `test_real_web_chat_server_conversation_and_history` | `ackConversationRead` 已在 IMSDK runtime 下对齐到文档公开的高层 `chatManager.markConversationRead()`，并通过真实 E2E 证明未读数从 1 变为 0。`markAllChatMsgAsRead` 仍没有真实服务端全局已读清零能力，继续 blocked。 |
| `ChatManager` | `getSupportedTranslationLanguages()` | `ChatManager.fetchSupportLanguages` | `realSdk.getSupportedTranslationLanguages` | `supported` | `test_real_web_chat_fetch_support_languages` | 文档公开，当前 supported 一致。 |
| `ChatManager` | `translateMessage()` | `ChatManager.translateMessage` | `realSdk.translateMessage` | `supported` | `test_real_web_chat_translate_message` | 文档公开，当前 supported 一致；但断言目前只证明目标语言 entry 存在。 |
| `ChatManager` | `modifyMessage()` | `ChatManager.updateChatMessage` | `realSdk.modifyMessage` | `supported` | `test_real_web_chat_modify_then_recall_message` | 文档公开 modifyMessage；Flutter 通过 `updateChatMessage` 别名映射，需要在审计中明确。 |
| `ChatManager` | `getHistoryMessages()` / `searchMessages()` | `getMessage` / `loadMessagesWithIds` / `loadAllConversations` / `getMessageCount` / `conversationGetLocalMessageCount` / `loadConversationMessagesWithKeyword` / `searchMsgsByOptions` / `conversationSearchMsgsByOptions` / `searchChatMsgFromDB` | 基于真实 server conversations + history 聚合 | `supported` | `test_real_web_chat_server_conversation_and_history` | 文档没有逐一公开这些 Flutter method key；当前 supported 建立在真实 server history 组合能力上，需要在 release 结论里注明。 |
| `ChatManager` | `downloadAttachment()` | `ChatManager.downloadAttachment` / `downloadBigImage` / `downloadThumbnail` | `realSdk.downloadAttachment`（`downloadThumbnail` 通过 thumbnail-only image mapping 复用，`downloadBigImage` 通过保留 `originalImageUrl` 的大图语义映射复用） | `downloadAttachment: supported` / `downloadThumbnail: supported` / `downloadBigImage: supported` | `test_real_web_chat_download_attachment_imsdk_runtime` / `test_real_web_chat_download_thumbnail_imsdk_runtime` / `test_real_web_chat_download_big_image_imsdk_runtime` | `downloadAttachment` 已在 IMSDK runtime 下对齐到文档公开的高层 `chatManager.downloadAttachment()`，并通过真实 E2E 证明返回文件名、MIME 类型、下载地址和二进制长度。`downloadThumbnail` 通过“仅保留缩略图 URL”的图片消息映射复用同一高层 API，`downloadBigImage` 则通过保留 `originalImageUrl` 的图片消息映射复用同一高层 API，二者都已形成真实闭环。 |

### ChatManager 当前高风险说明

1. `sendMessageWithType` 不能作为整体 supported 对外表达，当前仅能表述为 `txt` 支持。
2. `getMessage`、`loadMessagesWithIds`、`searchMsgsByOptions` 等当前 supported 结论成立，但实现语义来自真实 `history` 组合，而不是一一对应的文档公开 API。最终 release 结论必须保留这一层说明。

## 下一步

1. 先修 `GroupManager.muteAllMembers / unMuteAllMembers` 的真实分支。
2. 补对应真实 E2E，再更新 coverage 和中文报告。
3. 然后继续按同样方式扩展到 `ChatRoomManager`、`ChatThreadManager` 和事件类能力。
