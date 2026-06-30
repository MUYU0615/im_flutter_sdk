# Web 真实 E2E 无真实 API 审计

该文档用于审计“当前 Web 真实 E2E 覆盖中，没有真实 API 路径”的项。
它和 coverage matrix/report 的区别是：
- 这里只收录“没有真实 API / 没有真实回调路径 / 只是本地 stub”的项。
- 已经能真实调用、但因为契约不一致或读回面缺失而 blocked 的项，不放进主清单。

## 总览

- `no_real_api_total`: 40
- `blocked_total`: 38
- `not_applicable_total`: 46

## 分类定义

- `adapter_local_stub`：Flutter Web adapter 只改本地内存、返回常量或直接 `null`，没有真实 SDK / 服务路径。
- `local_bridge_synthesized_event`：事件是 bridge 在命令成功后本地合成出来的，不是来自真实 Web SDK callback。
- `vendor_no_real_api`：当前 bundled/vendor Web SDK 没有对应公开 API，或运行时找不到可调用方法。
- `callback_path_not_wired`：真实 SDK / 消息可能存在，但当前 Web real adapter 没把真实 callback 流接出来。

## Adapter 本地 Stub

- 数量：4

### `ChatManager.getMessageCount`
- 状态：`supported`
- 原因：该 API 已通过真实 Web SDK 与真实服务链路验证。
- 用例：
  - `tests/web_real/test_real_web_chat_server.py::test_real_web_chat_server_conversation_and_history`
- 验证方式：
  - `python3 -m src.tools.web_e2e_runner --run-id web-real-chat-load-ids-count1 --web-sdk-mode real_sdk --headless-startup-wait 150 --startup-timeout 240 --flutter-timeout 300 -- tests/web_real/test_real_web_chat_server.py::test_real_web_chat_server_conversation_and_history --target-platform web -q`

### `ChatManager.importMessages`
- 状态：`blocked`
- 原因：当前实现仅作用于本地内存或常量返回，未进入真实 Web SDK / 服务链路。
- 验证方式：
  - `rg -n "importMessages" im_flutter_sdk_web/lib/src/managers/chat_manager_web.dart`

### `ChatManager.resendMessage`
- 状态：`blocked`
- 原因：该 API 当前处于 blocked，表现为未对齐移动端能力或真实执行未通过。

### `GroupManager.clearAllGroupsFromDB`
- 状态：`blocked`
- 原因：当前实现仅作用于本地内存或常量返回，未进入真实 Web SDK / 服务链路。
- 验证方式：
  - `rg -n "clearAllGroupsFromDB|reset\\(" im_flutter_sdk_web/lib/src/managers/group_manager_web.dart`

## Bridge 本地合成事件

- 数量：7

### `ChatRoomManager.onChatRoomChanged`
- 状态：`blocked`
- 原因：真实回调链路未接通，当前无法按移动端同等方式验证。
- 用例：
  - `native-auto-test/tests/web/test_web_chat_room_events.py`
- 验证方式：
  - `rg -n "emitChatRoom|onRoom|chatRoomChange" im_flutter_test/lib/bridge`
  - `rg -n "onTextMessage|onReadMessage|onDeliveredMessage|onModifiedMessage|onRecallMessage|onMessagePinEvent" im_flutter_sdk_web/lib/src/real_web_sdk_interop.dart`

### `ChatThreadManager.onChatThreadCreate`
- 状态：`blocked`
- 原因：当前只有本地 bridge 合成事件，未接到真实 SDK 事件流。
- 验证方式：
  - `rg -n "onChatThreadCreate|onChatThreadUpdate|onChatThreadDestroy|onUserKickOutOfChatThread" im_flutter_test/lib/bridge/event_bridge_handler.dart`
  - `rg -n "emitChatThreadCreated|createChatThread|updateChatThreadSubject|destroyChatThread|removeMemberFromChatThread" im_flutter_test/lib/bridge/im_websocket_bridge.dart`

### `ChatThreadManager.onChatThreadDestroy`
- 状态：`blocked`
- 原因：当前只有本地 bridge 合成事件，未接到真实 SDK 事件流。
- 验证方式：
  - `rg -n "onChatThreadCreate|onChatThreadUpdate|onChatThreadDestroy|onUserKickOutOfChatThread" im_flutter_test/lib/bridge/event_bridge_handler.dart`
  - `rg -n "emitChatThreadCreated|createChatThread|updateChatThreadSubject|destroyChatThread|removeMemberFromChatThread" im_flutter_test/lib/bridge/im_websocket_bridge.dart`

### `ChatThreadManager.onChatThreadUpdate`
- 状态：`blocked`
- 原因：当前只有本地 bridge 合成事件，未接到真实 SDK 事件流。
- 验证方式：
  - `rg -n "onChatThreadCreate|onChatThreadUpdate|onChatThreadDestroy|onUserKickOutOfChatThread" im_flutter_test/lib/bridge/event_bridge_handler.dart`
  - `rg -n "emitChatThreadCreated|createChatThread|updateChatThreadSubject|destroyChatThread|removeMemberFromChatThread" im_flutter_test/lib/bridge/im_websocket_bridge.dart`

### `ChatThreadManager.onUserKickOutOfChatThread`
- 状态：`blocked`
- 原因：当前只有本地 bridge 合成事件，未接到真实 SDK 事件流。
- 验证方式：
  - `rg -n "onChatThreadCreate|onChatThreadUpdate|onChatThreadDestroy|onUserKickOutOfChatThread" im_flutter_test/lib/bridge/event_bridge_handler.dart`
  - `rg -n "emitChatThreadCreated|createChatThread|updateChatThreadSubject|destroyChatThread|removeMemberFromChatThread" im_flutter_test/lib/bridge/im_websocket_bridge.dart`

### `GroupManager.onGroupChanged`
- 状态：`blocked`
- 原因：当前只有本地 bridge 合成事件，未接到真实 SDK 事件流。
- 验证方式：
  - `rg -n "emitGroupSpecificationChanged|emitGroupAnnouncementChanged|emitGroupAdminChanged|emitGroupMuteChanged|emitGroupWhiteListChanged|emitGroupMemberChanged|emitGroupOwnerChanged|emitGroupStateChanged|emitGroupDestroyed" im_flutter_test/lib/bridge`

### `MessageManager.onStreamMessagesReceived`
- 状态：`blocked`
- 原因：该 API 当前处于 blocked，表现为未对齐移动端能力或真实执行未通过。
- 验证方式：
  - `rg -n "emitStreamMessagesReceived|stream_messages_received" im_flutter_test/lib/bridge`

## Vendor 无真实 API

- 数量：29

### `ChatRoomManager.changeChatRoomOwner`
- 状态：`blocked`
- 原因：当前 Web SDK 未暴露与移动端对齐的公开 API，属于 API 未对齐。
- 用例：
  - `tests/web_real/test_real_web_chat_room.py::test_real_web_chat_room_admin_server_state`
- 验证方式：
  - `make web-real-e2e ARGS="--run-id web-real-chatroom-admin-green1 --web-sdk-mode real_sdk --headless-startup-wait 90 --startup-timeout 150 --flutter-timeout 180 -- tests/web_real/test_real_web_chat_room.py::test_real_web_chat_room_admin_server_state --target-platform web -q"`

### `Client.compressLogs`
- 状态：`not_applicable`
- 原因：该 API 属于原生 SDK 配置或能力，当前浏览器 Web 场景不适用。
- 验证方式：
  - `rg -n "registerUser|renewToken|uploadLog|compressLogs|kickDevice|kickAllDevices|getLoggedInDevices" im_flutter_test/web/vendor/easemob/Easemob-chat.js`
  - `make web-real-e2e ARGS="--run-id web-real-client-create-account-green --web-sdk-mode real_sdk --headless-startup-wait 60 --startup-timeout 120 --flutter-timeout 180 -- tests/web_real/test_real_web_client_session.py::test_real_web_client_create_account --target-platform web -q" # observed 401 register user need token before removing non-stable case`

### `Client.getLoggedInDevicesFromServer`
- 状态：`not_applicable`
- 原因：当前 Web SDK 未暴露对应能力，浏览器侧不适用。
- 验证方式：
  - `rg -n "registerUser|renewToken|uploadLog|compressLogs|kickDevice|kickAllDevices|getLoggedInDevices" im_flutter_test/web/vendor/easemob/Easemob-chat.js`
  - `make web-real-e2e ARGS="--run-id web-real-client-create-account-green --web-sdk-mode real_sdk --headless-startup-wait 60 --startup-timeout 120 --flutter-timeout 180 -- tests/web_real/test_real_web_client_session.py::test_real_web_client_create_account --target-platform web -q" # observed 401 register user need token before removing non-stable case`

### `Client.kickAllDevices`
- 状态：`not_applicable`
- 原因：当前 Web SDK 未暴露对应能力，浏览器侧不适用。
- 验证方式：
  - `rg -n "registerUser|renewToken|uploadLog|compressLogs|kickDevice|kickAllDevices|getLoggedInDevices" im_flutter_test/web/vendor/easemob/Easemob-chat.js`
  - `make web-real-e2e ARGS="--run-id web-real-client-create-account-green --web-sdk-mode real_sdk --headless-startup-wait 60 --startup-timeout 120 --flutter-timeout 180 -- tests/web_real/test_real_web_client_session.py::test_real_web_client_create_account --target-platform web -q" # observed 401 register user need token before removing non-stable case`

### `Client.kickDevice`
- 状态：`not_applicable`
- 原因：当前 Web SDK 未暴露对应能力，浏览器侧不适用。
- 验证方式：
  - `rg -n "registerUser|renewToken|uploadLog|compressLogs|kickDevice|kickAllDevices|getLoggedInDevices" im_flutter_test/web/vendor/easemob/Easemob-chat.js`
  - `make web-real-e2e ARGS="--run-id web-real-client-create-account-green --web-sdk-mode real_sdk --headless-startup-wait 60 --startup-timeout 120 --flutter-timeout 180 -- tests/web_real/test_real_web_client_session.py::test_real_web_client_create_account --target-platform web -q" # observed 401 register user need token before removing non-stable case`

### `Client.updateDeliveryAckSetting`
- 状态：`not_applicable`
- 原因：该 API 属于原生 SDK 配置或能力，当前浏览器 Web 场景不适用。

### `Client.updateRequireAckSetting`
- 状态：`not_applicable`
- 原因：该 API 属于原生 SDK 配置或能力，当前浏览器 Web 场景不适用。

### `Client.uploadLog`
- 状态：`not_applicable`
- 原因：当前 Web SDK 未暴露对应能力，浏览器侧不适用。
- 验证方式：
  - `rg -n "registerUser|renewToken|uploadLog|compressLogs|kickDevice|kickAllDevices|getLoggedInDevices" im_flutter_test/web/vendor/easemob/Easemob-chat.js`
  - `make web-real-e2e ARGS="--run-id web-real-client-create-account-green --web-sdk-mode real_sdk --headless-startup-wait 60 --startup-timeout 120 --flutter-timeout 180 -- tests/web_real/test_real_web_client_session.py::test_real_web_client_create_account --target-platform web -q" # observed 401 register user need token before removing non-stable case`

### `ContactManager.getSelfIdsOnOtherPlatform`
- 状态：`not_applicable`
- 原因：当前 Web SDK 未暴露对应能力，浏览器侧不适用。
- 验证方式：
  - `real Web SDK contact APIs expose server list/blocklist operations, while this Flutter API is local DB/event/multi-device adapter behavior in the current browser test app.`

### `PushManager.getImPushConfig`
- 状态：`not_applicable`
- 原因：该 API 属于原生 SDK 配置或能力，当前浏览器 Web 场景不适用。
- 验证方式：
  - `rg -n "pushTemplate|PushTemplate|notification/template|notification/display|getImPushConfig|reportPushAction|pushStyle|updatePushNickname" im_flutter_test/web/vendor/easemob/Easemob-chat.js`
  - `rg -n "updateHMSPushToken|updateFCMPushToken|updateAPNsPushToken|bindDeviceToken" im_flutter_sdk/lib/src/managers/push_manager.dart im_flutter_sdk/CHANGELOG.md`

### `PushManager.getImPushConfigFromServer`
- 状态：`not_applicable`
- 原因：当前 Web SDK 未暴露对应能力，浏览器侧不适用。
- 验证方式：
  - `rg -n "pushTemplate|PushTemplate|notification/template|notification/display|getImPushConfig|reportPushAction|pushStyle|updatePushNickname" im_flutter_test/web/vendor/easemob/Easemob-chat.js`
  - `rg -n "updateHMSPushToken|updateFCMPushToken|updateAPNsPushToken|bindDeviceToken" im_flutter_sdk/lib/src/managers/push_manager.dart im_flutter_sdk/CHANGELOG.md`

### `PushManager.getPushTemplate`
- 状态：`not_applicable`
- 原因：当前 Web SDK 未暴露对应能力，浏览器侧不适用。
- 验证方式：
  - `rg -n "pushTemplate|PushTemplate|notification/template|notification/display|getImPushConfig|reportPushAction|pushStyle|updatePushNickname" im_flutter_test/web/vendor/easemob/Easemob-chat.js`
  - `rg -n "updateHMSPushToken|updateFCMPushToken|updateAPNsPushToken|bindDeviceToken" im_flutter_sdk/lib/src/managers/push_manager.dart im_flutter_sdk/CHANGELOG.md`

### `PushManager.reportPushAction`
- 状态：`not_applicable`
- 原因：当前 Web SDK 未暴露对应能力，浏览器侧不适用。
- 验证方式：
  - `rg -n "pushTemplate|PushTemplate|notification/template|notification/display|getImPushConfig|reportPushAction|pushStyle|updatePushNickname" im_flutter_test/web/vendor/easemob/Easemob-chat.js`
  - `rg -n "updateHMSPushToken|updateFCMPushToken|updateAPNsPushToken|bindDeviceToken" im_flutter_sdk/lib/src/managers/push_manager.dart im_flutter_sdk/CHANGELOG.md`

### `PushManager.setPushTemplate`
- 状态：`not_applicable`
- 原因：当前 Web SDK 未暴露对应能力，浏览器侧不适用。
- 验证方式：
  - `rg -n "pushTemplate|PushTemplate|notification/template|notification/display|getImPushConfig|reportPushAction|pushStyle|updatePushNickname" im_flutter_test/web/vendor/easemob/Easemob-chat.js`
  - `rg -n "updateHMSPushToken|updateFCMPushToken|updateAPNsPushToken|bindDeviceToken" im_flutter_sdk/lib/src/managers/push_manager.dart im_flutter_sdk/CHANGELOG.md`

### `PushManager.updateImPushStyle`
- 状态：`not_applicable`
- 原因：当前 Web SDK 未暴露对应能力，浏览器侧不适用。
- 验证方式：
  - `rg -n "pushTemplate|PushTemplate|notification/template|notification/display|getImPushConfig|reportPushAction|pushStyle|updatePushNickname" im_flutter_test/web/vendor/easemob/Easemob-chat.js`
  - `rg -n "updateHMSPushToken|updateFCMPushToken|updateAPNsPushToken|bindDeviceToken" im_flutter_sdk/lib/src/managers/push_manager.dart im_flutter_sdk/CHANGELOG.md`

### `PushManager.updatePushNickname`
- 状态：`not_applicable`
- 原因：当前 Web SDK 未暴露对应能力，浏览器侧不适用。
- 验证方式：
  - `rg -n "pushTemplate|PushTemplate|notification/template|notification/display|getImPushConfig|reportPushAction|pushStyle|updatePushNickname" im_flutter_test/web/vendor/easemob/Easemob-chat.js`
  - `rg -n "updateHMSPushToken|updateFCMPushToken|updateAPNsPushToken|bindDeviceToken" im_flutter_sdk/lib/src/managers/push_manager.dart im_flutter_sdk/CHANGELOG.md`

### `Unclassified.onAppActiveNumberReachLimit`
- 状态：`blocked`
- 原因：当前 Web SDK 未暴露与移动端对齐的公开 API，属于 API 未对齐。
- 验证方式：
  - `rg -n "onAppActiveNumberReachLimit" im_flutter_test/lib/bridge im_flutter_sdk_web/lib/src/real_web_sdk_interop.dart`

### `Unclassified.onMultiDeviceContactEvent`
- 状态：`blocked`
- 原因：当前 Web SDK 未暴露与移动端对齐的公开 API，属于 API 未对齐。
- 验证方式：
  - `rg -n "onMultiDeviceContactEvent|multiDevice" im_flutter_test/lib/bridge im_flutter_sdk_web/lib/src/real_web_sdk_interop.dart`

### `Unclassified.onMultiDeviceGroupEvent`
- 状态：`blocked`
- 原因：当前 Web SDK 未暴露与移动端对齐的公开 API，属于 API 未对齐。
- 验证方式：
  - `rg -n "onMultiDeviceGroupEvent|multiDevice" im_flutter_test/lib/bridge im_flutter_sdk_web/lib/src/real_web_sdk_interop.dart`

### `Unclassified.onMultiDeviceRemoveMessagesEvent`
- 状态：`blocked`
- 原因：当前 Web SDK 未暴露与移动端对齐的公开 API，属于 API 未对齐。
- 验证方式：
  - `rg -n "onMultiDeviceRemoveMessagesEvent|multiDevice" im_flutter_test/lib/bridge im_flutter_sdk_web/lib/src/real_web_sdk_interop.dart`

### `Unclassified.onMultiDeviceThreadEvent`
- 状态：`blocked`
- 原因：当前 Web SDK 未暴露与移动端对齐的公开 API，属于 API 未对齐。
- 验证方式：
  - `rg -n "onMultiDeviceThreadEvent|multiDevice" im_flutter_test/lib/bridge im_flutter_sdk_web/lib/src/real_web_sdk_interop.dart`

### `Unclassified.onMultiDevicesConversationEvent`
- 状态：`blocked`
- 原因：当前 Web SDK 未暴露与移动端对齐的公开 API，属于 API 未对齐。
- 验证方式：
  - `rg -n "onMultiDevicesConversationEvent|multiDevice" im_flutter_test/lib/bridge im_flutter_sdk_web/lib/src/real_web_sdk_interop.dart`

### `Unclassified.onUserAuthenticationFailed`
- 状态：`blocked`
- 原因：当前 Web SDK 未暴露与移动端对齐的公开 API，属于 API 未对齐。
- 验证方式：
  - `rg -n "onUserDidRemoveFromServer|onUserDidForbidByServer|onUserAuthenticationFailed" im_flutter_test/lib/bridge im_flutter_sdk_web/lib/src/real_web_sdk_interop.dart`

### `Unclassified.onUserDidChangePassword`
- 状态：`blocked`
- 原因：当前 Web SDK 未暴露与移动端对齐的公开 API，属于 API 未对齐。
- 验证方式：
  - `rg -n "onUserDidChangePassword" im_flutter_test/lib/bridge im_flutter_sdk_web/lib/src/real_web_sdk_interop.dart`

### `Unclassified.onUserDidForbidByServer`
- 状态：`blocked`
- 原因：当前 Web SDK 未暴露与移动端对齐的公开 API，属于 API 未对齐。
- 验证方式：
  - `rg -n "onUserDidRemoveFromServer|onUserDidForbidByServer|onUserAuthenticationFailed" im_flutter_test/lib/bridge im_flutter_sdk_web/lib/src/real_web_sdk_interop.dart`

### `Unclassified.onUserDidLoginFromOtherDevice`
- 状态：`blocked`
- 原因：当前 Web SDK 未暴露与移动端对齐的公开 API，属于 API 未对齐。
- 验证方式：
  - `rg -n "onUserDidLoginFromOtherDevice|onUserKickedByOtherDevice|onUserDidLoginTooManyDevice" im_flutter_test/lib/bridge im_flutter_sdk_web/lib/src/real_web_sdk_interop.dart`

### `Unclassified.onUserDidLoginTooManyDevice`
- 状态：`blocked`
- 原因：当前 Web SDK 未暴露与移动端对齐的公开 API，属于 API 未对齐。
- 验证方式：
  - `rg -n "onUserDidLoginFromOtherDevice|onUserKickedByOtherDevice|onUserDidLoginTooManyDevice" im_flutter_test/lib/bridge im_flutter_sdk_web/lib/src/real_web_sdk_interop.dart`

### `Unclassified.onUserDidRemoveFromServer`
- 状态：`blocked`
- 原因：当前 Web SDK 未暴露与移动端对齐的公开 API，属于 API 未对齐。
- 验证方式：
  - `rg -n "onUserDidRemoveFromServer|onUserDidForbidByServer|onUserAuthenticationFailed" im_flutter_test/lib/bridge im_flutter_sdk_web/lib/src/real_web_sdk_interop.dart`

### `Unclassified.onUserKickedByOtherDevice`
- 状态：`blocked`
- 原因：当前 Web SDK 未暴露与移动端对齐的公开 API，属于 API 未对齐。
- 验证方式：
  - `rg -n "onUserDidLoginFromOtherDevice|onUserKickedByOtherDevice|onUserDidLoginTooManyDevice" im_flutter_test/lib/bridge im_flutter_sdk_web/lib/src/real_web_sdk_interop.dart`

## 真实回调路径未接通

- 数量：0

## 已 Blocked 但不在主审计清单中

下面这些项当前也是 `blocked`，但它们不属于“没有真实 API”这一类，通常是：
- 已经存在真实调用，但行为不满足 Flutter 契约；
- 已经存在真实调用，但读回面/返回载荷不足以形成稳定闭环；
- 环境权限问题，而不是 API 本身不存在。

- 数量：14

- `ChatManager.syncSilentModels`: 当前实现仅作用于本地内存或常量返回，未进入真实 Web SDK / 服务链路。
- `ChatRoomManager.createChatRoom`: 真实 E2E 已发起调用，但执行失败、超时或返回异常，当前未通过。
- `ChatThreadManager.fetchLastMessageWithChatThreads`: 该 API 当前处于 blocked，表现为未对齐移动端能力或真实执行未通过。
- `GroupManager.blockGroup`: 真实调用已发生，但 Web 行为不满足 Flutter / iOS / Android 同名 API 契约。
- `GroupManager.muteAllMembers`: 该 API 当前处于 blocked，表现为未对齐移动端能力或真实执行未通过。
- `GroupManager.unMuteAllMembers`: 该 API 当前处于 blocked，表现为未对齐移动端能力或真实执行未通过。
- `GroupManager.unblockGroup`: 该 API 当前处于 blocked，表现为未对齐移动端能力或真实执行未通过。
- `GroupManager.uploadGroupSharedFile`: 该 API 当前处于 blocked，表现为未对齐移动端能力或真实执行未通过。
- `MessageManager.onMessageError`: 真实 E2E 已发起调用，但执行失败、超时或返回异常，当前未通过。
- `MessageManager.onMessageProgress`: 该 API 当前处于 blocked，表现为未对齐移动端能力或真实执行未通过。
- `MessageManager.onMessageProgressUpdate`: 该 API 当前处于 blocked，表现为未对齐移动端能力或真实执行未通过。
- `Unclassified.onSendDataToFlutter`: 该 API 当前处于 blocked，表现为未对齐移动端能力或真实执行未通过。
- `Unclassified.onTokenDidExpire`: 该 API 当前处于 blocked，表现为未对齐移动端能力或真实执行未通过。
- `Unclassified.onTokenWillExpire`: 该 API 当前处于 blocked，表现为未对齐移动端能力或真实执行未通过。
