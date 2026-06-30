# Web Bridge / 本地 Adapter API 覆盖报告

该报告用于验证本地 Web 测试 bridge 和 Web adapter 的行为。
该报告不证明真实 IM 服务 E2E 收发结果。

## 总览

| 状态 | 数量 |
|---|---:|
| blocked | 0 |
| different | 0 |
| not_applicable | 17 |
| pending | 0 |
| supported | 295 |
| unsupported | 0 |

## 验证层级

| 层级 | 数量 |
|---|---:|
| json_bridge | 295 |
| client_instance_manager | 295 |
| public_dart_api | 0 |
| public_api_verified | 0 |
| public_api_unverified | 295 |

## 按 Manager 统计

| Manager | supported | unsupported | not_applicable | different | blocked | pending |
|---|---:|---:|---:|---:|---:|---:|
| ChatManager | 63 | 0 | 0 | 0 | 0 | 0 |
| ChatRoomManager | 34 | 0 | 0 | 0 | 0 | 0 |
| ChatThreadManager | 16 | 0 | 0 | 0 | 0 | 0 |
| Client | 17 | 0 | 15 | 0 | 0 | 0 |
| ContactManager | 19 | 0 | 0 | 0 | 0 | 0 |
| ConversationManager | 23 | 0 | 0 | 0 | 0 | 0 |
| GroupManager | 54 | 0 | 0 | 0 | 0 | 0 |
| MessageManager | 22 | 0 | 2 | 0 | 0 | 0 |
| PresenceManager | 5 | 0 | 0 | 0 | 0 | 0 |
| PushManager | 19 | 0 | 0 | 0 | 0 | 0 |
| Unclassified | 18 | 0 | 0 | 0 | 0 | 0 |
| UserInfoManager | 5 | 0 | 0 | 0 | 0 | 0 |

## E2E 证据

- `tests/web/test_web_chat_local_store.py` 通过 Web JSON bridge 验证受支持的 ChatManager 本地状态 API。
- `tests/web/test_web_contact.py` 通过 Web JSON bridge 验证受支持的 ContactManager API。
- `tests/web/test_web_unsupported_api.py` 验证 Web adapter API 的代表性 unsupported 行为。
- `tests/web/test_web_fixture.py` 验证持久化 headless Web client 的按 case `Client.webReset` 清理。

## Unsupported 原因分组

## Not Applicable 原因分组

### 该 API 属于原生 SDK 配置或能力，当前浏览器 Web 场景不适用。
- `Client.changeAppKey`
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
- `MessageManager.onOfflineMessageSyncStart`
- `MessageManager.onOfflineMessageSyncFinish`
