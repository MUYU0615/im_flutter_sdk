# Web 真实 E2E 覆盖报告

该报告用于跟踪必须通过真实 Web SDK 和真实 IM 服务验证的 API 覆盖情况。

## 总览

| 状态 | 数量 |
|---|---:|
| blocked | 38 |
| not_applicable | 46 |
| pending | 0 |
| supported | 228 |

## 按 Manager 统计

| Manager | supported | not_applicable | blocked | pending |
|---|---:|---:|---:|---:|
| ChatManager | 60 | 0 | 3 | 0 |
| ChatRoomManager | 31 | 0 | 3 | 0 |
| ChatThreadManager | 11 | 0 | 5 | 0 |
| Client | 11 | 21 | 0 | 0 |
| ContactManager | 15 | 4 | 0 | 0 |
| ConversationManager | 14 | 9 | 0 | 0 |
| GroupManager | 47 | 0 | 7 | 0 |
| MessageManager | 18 | 2 | 4 | 0 |
| PresenceManager | 5 | 0 | 0 | 0 |
| PushManager | 9 | 10 | 0 | 0 |
| Unclassified | 2 | 0 | 16 | 0 |
| UserInfoManager | 5 | 0 | 0 | 0 |

## Blocked 测试视角分类

这里按测试口径拆分 `blocked`：
- `API未对齐iOS/Android`：Web API 能力、行为、契约或回调路径与 iOS/Android 不一致。
- `API执行未通过`：真实 E2E 已发起调用，但执行失败、超时、返回异常，或无法完成稳定闭环。

### API未对齐iOS/Android
- `Unclassified.onMultiDeviceGroupEvent`
- `Unclassified.onMultiDeviceContactEvent`
- `Unclassified.onMultiDeviceThreadEvent`
- `Unclassified.onMultiDeviceRemoveMessagesEvent`
- `Unclassified.onMultiDevicesConversationEvent`
- `Unclassified.onUserDidLoginFromOtherDevice`
- `Unclassified.onUserDidRemoveFromServer`
- `Unclassified.onUserDidForbidByServer`
- `Unclassified.onUserDidChangePassword`
- `Unclassified.onUserDidLoginTooManyDevice`
- `Unclassified.onUserKickedByOtherDevice`
- `Unclassified.onUserAuthenticationFailed`
- `Unclassified.onAppActiveNumberReachLimit`
- `ChatRoomManager.changeChatRoomOwner`
- `ChatRoomManager.onChatRoomChanged`
- `GroupManager.blockGroup`
- `GroupManager.onGroupChanged`
- `ChatThreadManager.onChatThreadCreate`
- `ChatThreadManager.onChatThreadUpdate`
- `ChatThreadManager.onChatThreadDestroy`
- `ChatThreadManager.onUserKickOutOfChatThread`

### API执行未通过
- `Unclassified.onSendDataToFlutter`
- `Unclassified.onTokenWillExpire`
- `Unclassified.onTokenDidExpire`
- `ChatManager.resendMessage`
- `ChatManager.importMessages`
- `ChatManager.syncSilentModels`
- `MessageManager.onStreamMessagesReceived`
- `MessageManager.onMessageProgress`
- `MessageManager.onMessageProgressUpdate`
- `MessageManager.onMessageError`
- `ChatRoomManager.createChatRoom`
- `GroupManager.unblockGroup`
- `GroupManager.muteAllMembers`
- `GroupManager.unMuteAllMembers`
- `GroupManager.uploadGroupSharedFile`
- `GroupManager.clearAllGroupsFromDB`
- `ChatThreadManager.fetchLastMessageWithChatThreads`


## Blocked 原因分组

### Flutter 的 `blockGroup` 语义是屏蔽当前用户接收群消息，但 Web 映射后的真实调用并没有阻止被屏蔽用户继续收到群消息，因此 Web 行为不满足 Flutter / iOS / Android 同名 API 契约。
- `GroupManager.blockGroup`

### WebSDK2 文档已经明确公开了 `group.getGroup(...).muteAllMembers()` 能力，因此旧结论“Web 没有公开 API”已经不成立。当前 IMSDK 高层运行时已经接通， 真实 E2E 中可以成功建群并调用 `muteAllMembers`，但紧随其后的真实群详情读回里 `isAllMemberMuted` 仍然是 `False`。也就是说，高层 API 可以调起，但实际全员禁言状态 没有通过服务端读回得到验证，当前应归类为 `API执行未通过`。
- `GroupManager.muteAllMembers`

### WebSDK2 文档已经明确公开了 `group.getGroup(...).unmuteAllMembers()` 能力，因此旧结论“Web 没有公开 API”已经不成立。当前 IMSDK 高层运行时已经接通， 但整条真实全员禁言链路在 `muteAllMembers` 这一步就无法通过服务端详情读回证明状态生效， 所以 `unMuteAllMembers` 也暂时不能独立回收，当前同样应归类为 `API执行未通过`。
- `GroupManager.unMuteAllMembers`

### createChatRoom 的真实 Web SDK 调用已经发出，但当前测试应用或账号 被服务端拒绝，返回 group_authorization 权限错误，因此当前真实执行未通过。
- `ChatRoomManager.createChatRoom`

### fetchLastMessageWithChatThreads 的真实 Web SDK 调用已经成功发起， 但对刚创建的线程读回时，返回的 lastMessage 仍然是空对象 {}，无法形成 可验证的真实服务端最后一条消息闭环，因此当前执行未通过。
- `ChatThreadManager.fetchLastMessageWithChatThreads`

### uploadGroupSharedFile 已经能通过真实 Web SDK 在服务端创建共享文件 条目，但回读出来的文件元数据仍然异常，例如 file_name 仍是 {b62:}、 `file_size` 也不正确，因此当前真实执行未通过。
- `GroupManager.uploadGroupSharedFile`

### 当前 Web SDK 没有暴露可调用的聊天室 owner 转移 API。真实调用 `changeChatRoomOwner` 时直接运行失败，因此这项与 iOS/Android 能力未对齐。
- `ChatRoomManager.changeChatRoomOwner`

### 当前 Web 侧虽然支持 `renewToken` 调用，但没有把真实 Web SDK 的 token 即将过期回调透传到测试 bridge，浏览器测试应用也没有稳定可控的过期触发方式。
- `Unclassified.onTokenWillExpire`

### 当前 Web 真实适配层没有与 `onSendDataToFlutter` 对应的真实 SDK 或 服务端回调概念，测试 bridge 也没有把它接成真实浏览器 E2E 事件。
- `Unclassified.onSendDataToFlutter`

### 当前 Web 真实适配层没有把真实 Web SDK 的 token 已过期回调透传到 测试 bridge，浏览器测试应用也没有稳定可控的过期触发方式，因此与 iOS/Android 未对齐。
- `Unclassified.onTokenDidExpire`

### 当前 Web 真实适配层没有暴露或转发可验证的多端会话事件回调，测试 bridge 也没有服务端驱动的真实 E2E 触发路径，因此与 iOS/Android 未对齐。
- `Unclassified.onMultiDevicesConversationEvent`

### 当前 Web 真实适配层没有暴露或转发可验证的多端删消息事件回调，测试 bridge 也没有服务端驱动的真实 E2E 触发路径，因此与 iOS/Android 未对齐。
- `Unclassified.onMultiDeviceRemoveMessagesEvent`

### 当前 Web 真实适配层没有暴露或转发可验证的多端线程事件回调，测试 bridge 也没有服务端驱动的真实 E2E 触发路径，因此与 iOS/Android 未对齐。
- `Unclassified.onMultiDeviceThreadEvent`

### 当前 Web 真实适配层没有暴露或转发可验证的多端群组事件回调，测试 bridge 也没有服务端驱动的真实 E2E 触发路径，因此与 iOS/Android 未对齐。
- `Unclassified.onMultiDeviceGroupEvent`

### 当前 Web 真实适配层没有暴露或转发可验证的多端联系人事件回调，测试 bridge 也没有服务端驱动的真实 E2E 触发路径，因此与 iOS/Android 未对齐。
- `Unclassified.onMultiDeviceContactEvent`

### 当前 Web 真实适配层没有暴露或转发可验证的密码变更回调，浏览器测试 应用也没有稳定可控的真实 E2E 触发方式，因此与 iOS/Android 未对齐。
- `Unclassified.onUserDidChangePassword`

### 当前 Web 真实适配层没有暴露或转发可验证的异地登录会话回调，浏览器 测试应用也没有稳定可控的真实 E2E 触发方式，因此与 iOS/Android 未对齐。
- `Unclassified.onUserDidLoginFromOtherDevice`

### 当前 Web 真实适配层没有暴露或转发可验证的服务端封禁回调，浏览器 测试应用也没有稳定可控的真实 E2E 触发方式，因此与 iOS/Android 未对齐。
- `Unclassified.onUserDidForbidByServer`

### 当前 Web 真实适配层没有暴露或转发可验证的活跃数上限回调，浏览器 测试应用也没有稳定可控的真实 E2E 触发方式，因此与 iOS/Android 未对齐。
- `Unclassified.onAppActiveNumberReachLimit`

### 当前 Web 真实适配层没有暴露或转发可验证的被其他设备踢下线回调，浏览器 测试应用也没有稳定可控的真实 E2E 触发方式，因此与 iOS/Android 未对齐。
- `Unclassified.onUserKickedByOtherDevice`

### 当前 Web 真实适配层没有暴露或转发可验证的设备数超限回调，浏览器测试 应用也没有稳定可控的真实 E2E 触发方式，因此与 iOS/Android 未对齐。
- `Unclassified.onUserDidLoginTooManyDevice`

### 当前 Web 真实适配层没有暴露或转发可验证的账号被服务端移除回调，浏览器 测试应用也没有稳定可控的真实 E2E 触发方式，因此与 iOS/Android 未对齐。
- `Unclassified.onUserDidRemoveFromServer`

### 当前 Web 真实适配层没有暴露或转发可验证的鉴权失败回调，浏览器测试 应用也没有稳定可控的真实 E2E 触发方式，因此与 iOS/Android 未对齐。
- `Unclassified.onUserAuthenticationFailed`

### 当前 Web 线程事件是在命令成功后由本地 bridge 合成发出的，并不是 来自真实 Web SDK 的 thread 回调流，因此不能算真实服务 E2E，也与移动端回调 路径未对齐。
- `ChatThreadManager.onChatThreadCreate`

### 当前 Web 线程更新事件是在命令成功后由本地 bridge 合成发出的，并不是 来自真实 Web SDK 的 thread 回调流，因此不能算真实服务 E2E，也与移动端回调 路径未对齐。
- `ChatThreadManager.onChatThreadUpdate`

### 当前 Web 线程销毁事件是在命令成功后由本地 bridge 合成发出的，并不是 来自真实 Web SDK 的 thread 回调流，因此不能算真实服务 E2E，也与移动端回调 路径未对齐。
- `ChatThreadManager.onChatThreadDestroy`

### 当前 `clearAllGroupsFromDB` 只会重置本地内存里的群组状态，没有调用 真实 Web SDK 或本地数据库清理能力，因此与移动端能力未对齐。
- `GroupManager.clearAllGroupsFromDB`

### 当前 `importMessages` 只会把消息写入本地内存缓存，没有调用真实 Web SDK 或服务端导入链路，因此与移动端能力未对齐。
- `ChatManager.importMessages`

### 当前 `onGroupChanged` 是在相关命令执行完成并读取状态后由本地 bridge 合成发出的，不是来自真实 Web SDK 的群组变更回调流。
- `GroupManager.onGroupChanged`

### 当前 `onMessageError` 是浏览器下载辅助逻辑失败后由本地 bridge 发出的，不是来自真实 Web SDK 的消息传输错误回调。
- `MessageManager.onMessageError`

### 当前 `onMessageProgressUpdate` 来源于 bridge 自己的浏览器下载辅助 逻辑，不是来自真实 Web SDK 的媒体传输进度回调。
- `MessageManager.onMessageProgressUpdate`

### 当前 `onMessageProgress` 来源于 bridge 自己的浏览器下载辅助逻辑， 不是来自真实 Web SDK 的媒体传输进度回调。
- `MessageManager.onMessageProgress`

### 当前 `onStreamMessagesReceived` 是 bridge 看到返回消息里包含 `streamChunk` 后本地合成发出的，并不是来自真实 Web SDK 的流式消息回调。
- `MessageManager.onStreamMessagesReceived`

### 当前 `resendMessage` 只会复用本地缓存消息并修改本地发送状态，没有进入 真实 Web SDK 或服务端重发链路，因此与移动端能力未对齐。
- `ChatManager.resendMessage`

### 当前 `syncSilentModels` 只是返回本地成功结果，没有调用真实 Web SDK 或服务端的免打扰同步 API，因此与移动端能力未对齐。
- `ChatManager.syncSilentModels`

### 当前聊天室变更事件是在命令成功后由本地 bridge 合成转发的，并没有 接到真实 Web SDK 的 chat room 回调流。因此 `onChatRoomChanged` 目前不能按 真实 SDK 驱动的 E2E 回调来验证。
- `ChatRoomManager.onChatRoomChanged`

### 当前被踢出线程事件是在命令成功后由本地 bridge 合成发出的，并不是来自 真实 Web SDK 的 thread 回调流，因此不能算真实服务 E2E，也与移动端回调路径 未对齐。
- `ChatThreadManager.onUserKickOutOfChatThread`

### 由于 `blockGroup` 对应的 Web 行为本身就没有建立 Flutter 所要求的 “屏蔽接收群消息”契约，因此 `unblockGroup` 也不能算支持项。
- `GroupManager.unblockGroup`


## Pending 原因分组


## Not Applicable 原因分组

### 该 API 属于原生 SDK 配置或能力，当前浏览器 Web 场景不适用。
- `Client.changeAppKey`
- `Client.compressLogs`
- `Client.updateUsingHttpsOnlySetting`
- `Client.updateLoginExtensionInfo`
- `Client.updateDeleteMessagesWhenLeaveGroupSetting`
- `Client.updateDeleteMessageWhenLeaveRoomSetting`
- `Client.updateRoomOwnerCanLeaveSetting`
- `Client.updateAutoAcceptGroupInvitationSetting`
- `Client.acceptInvitationAlways`
- `Client.updateAutoDownloadAttachmentThumbnailSetting`
- `Client.updateRequireAckSetting`
- `Client.updateDeliveryAckSetting`
- `Client.updateSortMessageByServerTimeSetting`
- `Client.updateMessagesReceiveCallbackIncludeSendSetting`
- `Client.updateRegradeMessagesSetting`
- `Client.changeAppId`
- `ContactManager.getAllContactsFromDB`
- `ContactManager.getBlockListFromDB`
- `MessageManager.onOfflineMessageSyncStart`
- `MessageManager.onOfflineMessageSyncFinish`
- `ConversationManager.markAllMessagesAsRead`
- `ConversationManager.markMessageAsRead`
- `ConversationManager.clearAllMessages`
- `ConversationManager.insertMessage`
- `ConversationManager.appendMessage`
- `PushManager.getImPushConfig`

### 当前 Web SDK 未暴露对应能力，浏览器侧不适用。
- `Client.uploadLog`
- `Client.kickDevice`
- `Client.kickAllDevices`
- `Client.getLoggedInDevicesFromServer`
- `ContactManager.getSelfIdsOnOtherPlatform`
- `PushManager.getImPushConfigFromServer`
- `PushManager.updateImPushStyle`
- `PushManager.updatePushNickname`
- `PushManager.reportPushAction`
- `PushManager.setPushTemplate`
- `PushManager.getPushTemplate`

### 该 API 当前不适用于 Web 真实 E2E 范围。
- `Client.createAccount`
- `ContactManager.onContactChanged`
- `ConversationManager.syncConversationExt`
- `ConversationManager.removeMessage`
- `ConversationManager.deleteMessagesWithTs`
- `ConversationManager.updateConversationMessage`
- `PushManager.updateHMSPushToken`
- `PushManager.updateFCMPushToken`
- `PushManager.updateAPNsPushToken`
