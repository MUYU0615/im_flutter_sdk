---
id: generated/api-reference/src-types-event-system-ts
title: websdk2 API Reference - 事件系统类型
description: 来自 docs/reference/api-reference.zh-CN.md 的 src/types/event-system.ts API Reference 分段。
---

## src/types/event-system.ts

### EventPayloadMap

#### 字段

| Name | Type | Description |
| --- | --- | --- |
| onConnecting | `ConnectionEventPayload` | 正在连接到服务器（含自动重连）。 |
| onConnected | `ConnectionEventPayload` | 成功连接到服务器。 |
| onDisconnected | `ConnectionEventPayload` | 与服务器断开连接。断开原因包括：主动登出、Token 过期、被踢下线、设备超限等。 |
| onReconnectFailed | `ConnectionEventPayload` | 自动重连失败（达到最大重试次数）。 |
| onTokenWillExpire | `TokenLifecycleEventPayload` | Token 即将过期（约 80% 生命周期时触发）。应在此时获取新 Token 并调用 renewToken。 |
| onTokenExpired | `TokenLifecycleEventPayload` | Token 已过期，需要重新登录。 |
| onOfflineMessageSyncStart | `undefined` | 开始拉取离线消息。 |
| onOfflineMessageSyncFinish | `undefined` | 离线消息拉取完成。 |
| onMessage | `Message` | 收到新消息。
触发时机：有新消息到达（含单聊、群聊、聊天室）。
接收方：消息接收方（含发送方的其他设备）。 |
| onStreamMessage | `StreamMessage` | 流式消息更新。
触发时机：流式消息（如 AI 生成内容）有增量更新。
接收方：消息接收方。 |
| onConversationListUpdate | `ConversationListUpdatePayload` | 会话列表有更新。事件载荷始终包含当前完整且已排序的 ConversationItem 快照；需要保留业务本地字段时，可结合 patch.reset、patch.upserted、patch.removed 与 patch.orderChanged 做增量合并。 |
| onMessageRead | `MessageReadEventPayload` | 消息已读回执。
触发时机：对方发送消息已读回执。
接收方：消息的原始发送方。 |
| onMessageDelivered | `MessageDeliveredEventPayload` | 消息送达回执。
触发时机：接收方 SDK 自动回送达回执后，发送方收到此事件。
接收方：消息的原始发送方。 |
| onConversationRead | `ConversationReadEventPayload` | 会话已读回执。
触发时机：对方标记整个会话为已读。
接收方：单聊对方（群聊不触发此事件）。 |
| onMessageRecalled | `MessageRecalledEventPayload` | 消息被撤回。
触发时机：发送方撤回消息，或群主/管理员撤回他人消息。
接收方：会话中的所有成员（含撤回者的其他设备）。 |
| onMessageUpdated | `MessageUpdatedEventPayload` | 消息被编辑。
触发时机：发送方编辑已发送的消息。
接收方：会话中的所有成员（含编辑者的其他设备）。 |
| onReactionChanged | `ReactionChangedEventPayload` | 消息 Reaction 变更。
触发时机：有成员对消息添加或移除 Reaction。
接收方：会话中的所有成员（仅单聊和群聊）。 |
| onPinnedMessageChanged | `PinnedMessageChangedEventPayload` | 消息置顶状态变更。
触发时机：有成员置顶或取消置顶消息。
接收方：会话中的所有成员。 |
| onChatThreadCreated | `ChatThreadCreatedEventPayload` | ChatThread 创建事件。接收方：子区所属群组的所有成员。 |
| onChatThreadDestroyed | `ChatThreadDestroyedEventPayload` | ChatThread 解散事件。接收方：子区所属群组的所有成员。 |
| onChatThreadUpdated | `ChatThreadUpdatedEventPayload` | ChatThread 更新事件。修改子区名称，或子区中添加、撤销回复消息时触发。接收方：子区所属群组的所有成员。 |
| onChatThreadUserRemoved | `ChatThreadUserRemovedEventPayload` | 当前登录用户被群主或群管理员移出 ChatThread。接收方：被移出的当前登录用户。 |
| onMultiDeviceContact | `MultiDeviceContactEvent` | 联系人相关多设备事件。
触发时机：当前用户在其他设备上执行联系人操作（添加/删除/黑名单等）。
接收方：当前用户的其他在线设备。 |
| onMultiDeviceGroup | `MultiDeviceGroupEvent` | 群组相关多设备事件。
触发时机：当前用户在其他设备上执行群组操作。
接收方：当前用户的其他在线设备。 |
| onMultiDeviceThread | `MultiDeviceThreadEvent` | Thread 相关多设备事件。
触发时机：当前用户在其他设备上执行 Thread 操作。
接收方：当前用户的其他在线设备。 |
| onMultiDeviceConversation | `MultiDeviceConversationEvent` | 会话相关多设备事件。
触发时机：当前用户在其他设备上执行会话操作（删除/置顶/标记/免打扰等）。
接收方：当前用户的其他在线设备。 |
| onMultiDeviceMessageRemoved | `MultiDeviceMessageRemovedEvent` | 消息删除多设备事件。
触发时机：当前用户在其他设备上删除漫游消息。
接收方：当前用户的其他在线设备。 |
| onConversationListSyncStart | `undefined` | 会话列表同步开始。 |
| onConversationListSyncFinished | `SessionListSyncFinishedPayload | undefined` | 会话列表同步完成。 |
| onPresenceStatusChange | `ReadonlyArray<PresenceState>` | 订阅的用户在线状态变更。
触发时机：已订阅的用户在线状态发生变化。
接收方：订阅方。 |
| onContactInvited | `ContactRosterEventPayload` | 收到好友请求。
触发时机：其他用户向当前用户发送好友请求。
接收方：被邀请方。 |
| onContactDeleted | `ContactRosterEventPayload` | 被对方删除联系人。
触发时机：对方将当前用户从联系人列表中删除。
接收方：被删除方。 |
| onContactAdded | `ContactRosterEventPayload` | 新增联系人。
触发时机：好友关系建立成功。
接收方：双方。 |
| onContactRefuse | `ContactRosterEventPayload` | 好友请求被拒绝。
触发时机：对方拒绝了当前用户的好友请求。
接收方：请求发起方。 |
| onContactAgreed | `ContactRosterEventPayload` | 好友请求被接受。
触发时机：对方接受了当前用户的好友请求。
接收方：请求发起方。 |
| onContactInfoUpdated | `ContactInfoUpdatedEvent` | 联系人信息变更。
触发时机：已订阅的联系人信息发生变化。
接收方：订阅方。 |
| onContactSyncStart | `undefined` | 联系人同步开始。 |
| onContactSyncFinish | `ContactSyncFinishPayload | undefined` | 联系人同步完成。 |
| onOwnInfoUpdated | `UserInfo` | 自己的用户属性被修改。
触发时机：当前用户的属性被修改（含其他设备修改）。
接收方：当前用户所有设备。 |
| onUserInfoUpdated | `ReadonlyArray<UserInfo>` | 订阅的用户属性变更。
触发时机：已订阅的用户属性发生变化。
接收方：订阅方。 |
| onInvitationReceived | `GroupInvitationReceivedEventPayload` | 收到入群邀请。接收方：被邀请者。 |
| onRequestToJoinReceived | `GroupRequestToJoinReceivedEventPayload` | 收到入群申请。接收方：群主和管理员。 |
| onRequestToJoinAccepted | `GroupRequestToJoinAcceptedEventPayload` | 入群申请被同意。接收方：申请者。 |
| onRequestToJoinDeclined | `GroupRequestToJoinDeclinedEventPayload` | 入群申请被拒绝。接收方：申请者。 |
| onInvitationAccepted | `GroupInvitationAcceptedEventPayload` | 入群邀请被接受。接收方：邀请发起者。 |
| onInvitationDeclined | `GroupInvitationDeclinedEventPayload` | 入群邀请被拒绝。接收方：邀请发起者。 |
| onUserRemoved | `GroupUserRemovedEventPayload` | 被移出群组。接收方：被移出者 + 群内所有成员。 |
| onGroupDestroyed | `GroupDestroyedEventPayload` | 群组被解散。接收方：群内所有成员。 |
| onAutoAcceptInvitationFromGroup | `GroupAutoAcceptInvitationEventPayload` | 自动接受入群邀请（群设置为不需要确认时）。接收方：被邀请者。 |
| onMuteListAdded | `GroupMuteListAddedEventPayload` | 成员被禁言。接收方：群内所有成员。 |
| onMuteListRemoved | `GroupMuteListRemovedEventPayload` | 成员被解除禁言。接收方：群内所有成员。 |
| onAllowListAdded | `GroupAllowListAddedEventPayload` | 成员加入白名单。接收方：群内所有成员。 |
| onAllowListRemoved | `GroupAllowListRemovedEventPayload` | 成员移出白名单。接收方：群内所有成员。 |
| onAllMemberMuteStateChanged | `GroupAllMemberMuteStateChangedEventPayload` | 全员禁言状态变更。接收方：群内所有成员。 |
| onAdminAdded | `GroupAdminAddedEventPayload` | 新增管理员。接收方：群内所有成员。 |
| onAdminRemoved | `GroupAdminRemovedEventPayload` | 移除管理员。接收方：群内所有成员。 |
| onOwnerChanged | `GroupOwnerChangedEventPayload` | 群主变更。接收方：群内所有成员。 |
| onMembersJoined | `GroupMembersJoinedEventPayload` | 新成员加入群组。接收方：群内所有成员。 |
| onMembersExited | `GroupMembersExitedEventPayload` | 成员退出群组。接收方：群内所有成员。 |
| onAnnouncementChanged | `GroupAnnouncementChangedEventPayload` | 群公告变更。接收方：群内所有成员。 |
| onSharedFileAdded | `GroupSharedFileAddedEventPayload` | 新增群共享文件。接收方：群内所有成员。 |
| onSharedFileDeleted | `GroupSharedFileDeletedEventPayload` | 删除群共享文件。接收方：群内所有成员。 |
| onGroupInfoChanged | `GroupInfoChangedEventPayload` | 群信息变更。接收方：群内所有成员。 |
| onGroupDisabledChanged | `GroupDisabledChangedEventPayload` | 群组禁用状态变更。接收方：群内所有成员。 |
| onGroupMemberAttributeChanged | `GroupMemberAttributeChangedEventPayload` | 群成员自定义属性变更。接收方：群内所有成员。 |
| onUserGroupNamecardUpdated | `GroupUserGroupNamecardUpdatedEventPayload` | 群名片变更。接收方：群内所有成员。 |
| '__chatroom:onChatRoomDestroyed' | `ChatRoomDestroyedEventPayload` | 聊天室被销毁。接收方：聊天室内所有成员。 |
| '__chatroom:onMembersJoined' | `ChatRoomMembersJoinedEventPayload` | 成员加入聊天室。接收方：聊天室内所有成员。 |
| '__chatroom:onMembersExited' | `ChatRoomMembersExitedEventPayload` | 成员离开聊天室。接收方：聊天室内所有成员。 |
| '__chatroom:onRemovedFromChatRoom' | `ChatRoomRemovedFromChatRoomEventPayload` | 被移出聊天室。接收方：被移出者 + 聊天室内所有成员。 |
| '__chatroom:onMuteListAdded' | `ChatRoomMuteListAddedEventPayload` | 成员被禁言。接收方：聊天室内所有成员。 |
| '__chatroom:onMuteListRemoved' | `ChatRoomMuteListRemovedEventPayload` | 成员被解除禁言。接收方：聊天室内所有成员。 |
| '__chatroom:onAllowListAdded' | `ChatRoomAllowListAddedEventPayload` | 成员加入白名单。接收方：聊天室内所有成员。 |
| '__chatroom:onAllowListRemoved' | `ChatRoomAllowListRemovedEventPayload` | 成员移出白名单。接收方：聊天室内所有成员。 |
| '__chatroom:onAllMemberMuteStateChanged' | `ChatRoomAllMemberMuteStateChangedEventPayload` | 全员禁言状态变更。接收方：聊天室内所有成员。 |
| '__chatroom:onAdminAdded' | `ChatRoomAdminAddedEventPayload` | 新增管理员。接收方：聊天室内所有成员。 |
| '__chatroom:onAdminRemoved' | `ChatRoomAdminRemovedEventPayload` | 移除管理员。接收方：聊天室内所有成员。 |
| '__chatroom:onOwnerChanged' | `ChatRoomOwnerChangedEventPayload` | 聊天室主变更。接收方：聊天室内所有成员。 |
| '__chatroom:onAnnouncementChanged' | `ChatRoomAnnouncementChangedEventPayload` | 聊天室公告变更。接收方：聊天室内所有成员。 |
| '__chatroom:onChatRoomInfoChanged' | `ChatRoomInfoChangedEventPayload` | 聊天室信息变更。接收方：聊天室内所有成员。 |
| '__chatroom:onAttributesUpdate' | `ChatRoomAttributesUpdateEventPayload` | 聊天室自定义属性更新。接收方：聊天室内所有成员。 |
| '__chatroom:onAttributesRemoved' | `ChatRoomAttributesRemovedEventPayload` | 聊天室自定义属性删除。接收方：聊天室内所有成员。 |
