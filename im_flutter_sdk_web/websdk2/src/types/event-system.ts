/**
 * 统一事件系统类型定义
 */

import type {
  ConnectionEventName as ConnectionEventNameType,
  ConnectionEventPayload,
  InternalEventName as InternalEventNameType,
  SendTimeoutEventPayload,
  TokenLifecycleEventPayload,
} from './connection'; // 连接事件类型
import type { Message, StreamMessage } from './index'; // 消息类型
import type { ConversationListUpdatePayload } from '../cache/cache-types'; // 会话列表更新载荷类型
import type {
  ChatThreadCreatedEventPayload,
  ChatThreadDestroyedEventPayload,
  ChatThreadRawNotifyEvent,
  ChatThreadUpdatedEventPayload,
  ChatThreadUserRemovedEventPayload,
} from './chat-thread';
import type {
  ContactRosterEventPayload,
  ContactInfoUpdatedEvent,
} from './contact';
import type { SyncDataFinishedPayload, SyncDataStartPayload } from './sync-data';
import type {
  ChatRoomAdminAddedEventPayload,
  ChatRoomAdminRemovedEventPayload,
  ChatRoomAllMemberMuteStateChangedEventPayload,
  ChatRoomAnnouncementChangedEventPayload,
  ChatRoomAttributesRemovedEventPayload,
  ChatRoomAttributesUpdateEventPayload,
  ChatRoomAllowListAddedEventPayload,
  ChatRoomAllowListRemovedEventPayload,
  ChatRoomDestroyedEventPayload,
  ChatRoomInfoChangedEventPayload,
  ChatRoomMembersExitedEventPayload,
  ChatRoomMembersJoinedEventPayload,
  ChatRoomMuteListAddedEventPayload,
  ChatRoomMuteListRemovedEventPayload,
  ChatRoomOwnerChangedEventPayload,
  ChatRoomRawNotifyEvent,
  ChatRoomRemovedFromChatRoomEventPayload,
} from './chatroom';
import type {
  GroupAdminAddedEventPayload,
  GroupAdminRemovedEventPayload,
  GroupAllMemberMuteStateChangedEventPayload,
  GroupAnnouncementChangedEventPayload,
  GroupAutoAcceptInvitationEventPayload,
  GroupDestroyedEventPayload,
  GroupInvitationAcceptedEventPayload,
  GroupInvitationDeclinedEventPayload,
  GroupInvitationReceivedEventPayload,
  GroupMemberAttributeChangedEventPayload,
  GroupDisabledChangedEventPayload,
  GroupInfoChangedEventPayload,
  GroupMembersExitedEventPayload,
  GroupMembersJoinedEventPayload,
  GroupMuteListAddedEventPayload,
  GroupMuteListRemovedEventPayload,
  GroupOwnerChangedEventPayload,
  GroupRawNotifyEvent,
  GroupRequestToJoinAcceptedEventPayload,
  GroupRequestToJoinDeclinedEventPayload,
  GroupRequestToJoinReceivedEventPayload,
  GroupSharedFileAddedEventPayload,
  GroupSharedFileDeletedEventPayload,
  GroupUserGroupNamecardUpdatedEventPayload,
  GroupUserRemovedEventPayload,
  GroupAllowListAddedEventPayload,
  GroupAllowListRemovedEventPayload,
} from './group';
import type { PresenceState } from './presence'; // 在线状态类型
import type { UserInfo, UserInfoRawNotifyEvent } from './user-info';
import type {
  ConversationReadEventPayload,
  MessageDeliveredEventPayload,
  MessageReadEventPayload,
  MessageRecalledEventPayload,
  MessageUpdatedEventPayload,
  PinnedMessageChangedEventPayload,
  ReactionChangedEventPayload,
} from './chat-manager';
import type {
  MultiDeviceContactEvent,
  MultiDeviceConversationEvent,
  MultiDeviceGroupEvent,
  MultiDeviceMessageRemovedEvent,
  MultiDeviceThreadEvent,
} from './multi-device';

export type ConnectionEventName = ConnectionEventNameType; // 连接事件名称类型别名

export type InternalEventName = InternalEventNameType; // 内部事件名称类型别名

export const ChatEventName = {
  // Chat 事件名称常量
  MESSAGE: 'onMessage', // 消息事件
  STREAM_MESSAGE: 'onStreamMessage', // 流式消息事件
  CONVERSATION_LIST_UPDATE: 'onConversationListUpdate', // 会话列表更新事件
  MESSAGE_READ: 'onMessageRead', // 消息已读事件
  MESSAGE_DELIVERED: 'onMessageDelivered', // 消息送达事件
  CONVERSATION_READ: 'onConversationRead', // 会话已读事件
  MESSAGE_RECALLED: 'onMessageRecalled', // 消息撤回事件
  MESSAGE_UPDATED: 'onMessageUpdated', // 消息编辑事件
  REACTION_CHANGED: 'onReactionChanged', // Reaction 变化事件
  PINNED_MESSAGE_CHANGED: 'onPinnedMessageChanged', // 置顶消息变化事件
  MULTI_DEVICE_CONTACT: 'onMultiDeviceContact',
  MULTI_DEVICE_GROUP: 'onMultiDeviceGroup',
  MULTI_DEVICE_THREAD: 'onMultiDeviceThread',
  MULTI_DEVICE_CONVERSATION: 'onMultiDeviceConversation',
  MULTI_DEVICE_MESSAGE_REMOVED: 'onMultiDeviceMessageRemoved',
  SYNC_DATA_START: 'onSyncDataStart',
  SYNC_DATA_FINISHED: 'onSyncDataFinished',
} as const; // 常量断言

export type ChatEventName = (typeof ChatEventName)[keyof typeof ChatEventName]; // Chat 事件名称类型

export const ChatThreadEventName = {
  CREATED: 'onChatThreadCreated',
  DESTROYED: 'onChatThreadDestroyed',
  UPDATED: 'onChatThreadUpdated',
  USER_REMOVED: 'onChatThreadUserRemoved',
} as const;

export type ChatThreadEventName =
  (typeof ChatThreadEventName)[keyof typeof ChatThreadEventName];

export const PresenceEventName = {
  // Presence 事件名称常量
  STATUS_CHANGE: 'onPresenceStatusChange', // 在线状态变更事件
} as const; // 常量断言

export type PresenceEventName = (typeof PresenceEventName)[keyof typeof PresenceEventName]; // Presence 事件名称类型

export const ContactEventName = {
  INVITED: 'onContactInvited',
  DELETED: 'onContactDeleted',
  ADDED: 'onContactAdded',
  REFUSE: 'onContactRefuse',
  AGREED: 'onContactAgreed',
  CONTACT_INFO_UPDATED: 'onContactInfoUpdated',
} as const;

export type ContactEventName = (typeof ContactEventName)[keyof typeof ContactEventName];

export const UserInfoEventName = {
  OWN_UPDATED: 'onOwnInfoUpdated',
  USER_UPDATED: 'onUserInfoUpdated',
} as const;

export type UserInfoEventName = (typeof UserInfoEventName)[keyof typeof UserInfoEventName];

export const GroupEventName = {
  INVITATION_RECEIVED: 'onInvitationReceived',
  REQUEST_TO_JOIN_RECEIVED: 'onRequestToJoinReceived',
  REQUEST_TO_JOIN_ACCEPTED: 'onRequestToJoinAccepted',
  REQUEST_TO_JOIN_DECLINED: 'onRequestToJoinDeclined',
  INVITATION_ACCEPTED: 'onInvitationAccepted',
  INVITATION_DECLINED: 'onInvitationDeclined',
  USER_REMOVED: 'onUserRemoved',
  GROUP_DESTROYED: 'onGroupDestroyed',
  AUTO_ACCEPT_INVITATION: 'onAutoAcceptInvitationFromGroup',
  MUTE_LIST_ADDED: 'onMuteListAdded',
  MUTE_LIST_REMOVED: 'onMuteListRemoved',
  ALLOW_LIST_ADDED: 'onAllowListAdded',
  ALLOW_LIST_REMOVED: 'onAllowListRemoved',
  ALL_MEMBER_MUTE_STATE_CHANGED: 'onAllMemberMuteStateChanged',
  ADMIN_ADDED: 'onAdminAdded',
  ADMIN_REMOVED: 'onAdminRemoved',
  OWNER_CHANGED: 'onOwnerChanged',
  MEMBERS_JOINED: 'onMembersJoined',
  MEMBERS_EXITED: 'onMembersExited',
  ANNOUNCEMENT_CHANGED: 'onAnnouncementChanged',
  SHARED_FILE_ADDED: 'onSharedFileAdded',
  SHARED_FILE_DELETED: 'onSharedFileDeleted',
  GROUP_INFO_CHANGED: 'onGroupInfoChanged',
  GROUP_DISABLED_CHANGED: 'onGroupDisabledChanged',
  GROUP_MEMBER_ATTRIBUTE_CHANGED: 'onGroupMemberAttributeChanged',
  USER_GROUP_NAMECARD_UPDATED: 'onUserGroupNamecardUpdated',
} as const;

export type GroupEventName = (typeof GroupEventName)[keyof typeof GroupEventName];

export const ChatRoomDispatchEventName = {
  CHAT_ROOM_DESTROYED: '__chatroom:onChatRoomDestroyed',
  MEMBERS_JOINED: '__chatroom:onMembersJoined',
  MEMBERS_EXITED: '__chatroom:onMembersExited',
  REMOVED_FROM_CHAT_ROOM: '__chatroom:onRemovedFromChatRoom',
  MUTE_LIST_ADDED: '__chatroom:onMuteListAdded',
  MUTE_LIST_REMOVED: '__chatroom:onMuteListRemoved',
  ALLOW_LIST_ADDED: '__chatroom:onAllowListAdded',
  ALLOW_LIST_REMOVED: '__chatroom:onAllowListRemoved',
  ALL_MEMBER_MUTE_STATE_CHANGED: '__chatroom:onAllMemberMuteStateChanged',
  ADMIN_ADDED: '__chatroom:onAdminAdded',
  ADMIN_REMOVED: '__chatroom:onAdminRemoved',
  OWNER_CHANGED: '__chatroom:onOwnerChanged',
  ANNOUNCEMENT_CHANGED: '__chatroom:onAnnouncementChanged',
  CHAT_ROOM_INFO_CHANGED: '__chatroom:onChatRoomInfoChanged',
  ATTRIBUTES_UPDATE: '__chatroom:onAttributesUpdate',
  ATTRIBUTES_REMOVED: '__chatroom:onAttributesRemoved',
} as const;

export type ChatRoomDispatchEventName =
  (typeof ChatRoomDispatchEventName)[keyof typeof ChatRoomDispatchEventName];

export type EventName =
  | ConnectionEventName
  | ChatEventName
  | ChatThreadEventName
  | InternalEventName
  | PresenceEventName
  | ContactEventName
  | UserInfoEventName
  | GroupEventName
  | ChatRoomDispatchEventName; // 统一事件名称

export interface EventPayloadMap {
  // ─── 连接事件 ───
  /** [zh-CN] 正在连接到服务器（含自动重连）。 [en-US] Connecting to server (including auto-reconnect). */
  onConnecting: ConnectionEventPayload;
  /** [zh-CN] 成功连接到服务器。 [en-US] Successfully connected to server. */
  onConnected: ConnectionEventPayload;
  /**
   * [zh-CN] 与服务器断开连接。断开原因包括：主动登出、Token 过期、被踢下线、设备超限等。
   * [en-US] Disconnected from server. Reasons include: logout, token expired, kicked, device limit exceeded, etc.
   */
  onDisconnected: ConnectionEventPayload;
  /** [zh-CN] 自动重连失败（达到最大重试次数）。 [en-US] Auto-reconnect failed (max retries reached). */
  onReconnectFailed: ConnectionEventPayload;
  /**
   * [zh-CN] Token 即将过期（约 80% 生命周期时触发）。应在此时获取新 Token 并调用 renewToken。
   * [en-US] Token will expire soon (triggered at ~80% lifetime). Fetch a new token and call renewToken.
   */
  onTokenWillExpire: TokenLifecycleEventPayload;
  /** [zh-CN] Token 已过期，需要重新登录。 [en-US] Token has expired, re-login required. */
  onTokenExpired: TokenLifecycleEventPayload;
  /** [zh-CN] 开始拉取离线消息。 [en-US] Offline message sync started. */
  onOfflineMessageSyncStart: undefined;
  /** [zh-CN] 离线消息拉取完成。 [en-US] Offline message sync finished. */
  onOfflineMessageSyncFinish: undefined;

  // ─── 消息事件 ───
  /**
   * [zh-CN] 收到新消息。
   * 触发时机：有新消息到达（含单聊、群聊、聊天室）。
   * 接收方：消息接收方（含发送方的其他设备）。
   * [en-US] New message received.
   * Triggered when: a new message arrives (single/group/chatroom).
   * Received by: message recipient (including sender's other devices).
   */
  onMessage: Message;
  /**
   * [zh-CN] 流式消息更新。
   * 触发时机：流式消息（如 AI 生成内容）有增量更新。
   * 接收方：消息接收方。
   * [en-US] Stream message update.
   * Triggered when: a stream message (e.g., AI-generated content) has incremental updates.
   * Received by: message recipient.
   */
  onStreamMessage: StreamMessage;
  /**
   * [zh-CN] 会话列表有更新。事件载荷始终包含当前完整且已排序的 ConversationItem 快照；需要保留业务本地字段时，可结合 patch.reset、patch.upserted、patch.removed 与 patch.orderChanged 做增量合并。
   * [en-US] Conversation list updated. The payload always contains the current full and ordered ConversationItem snapshot; apps that preserve app-local fields can merge incrementally with patch.reset, patch.upserted, patch.removed, and patch.orderChanged.
   */
  onConversationListUpdate: ConversationListUpdatePayload;
  /**
   * [zh-CN] 消息已读回执列表。
   * 触发时机：对方发送一条或多条消息已读回执。
   * 接收方：消息的原始发送方。
   * [en-US] Message read receipt list.
   * Triggered when: recipient sends one or more read receipts.
   * Received by: original message sender.
   */
  onMessageRead: ReadonlyArray<MessageReadEventPayload>;
  /**
   * [zh-CN] 消息送达回执。
   * 触发时机：接收方 SDK 自动回送达回执后，发送方收到此事件。
   * 接收方：消息的原始发送方。
   * [en-US] Message delivery receipt.
   * Triggered when: recipient's SDK auto-sends delivery ack.
   * Received by: original message sender.
   */
  onMessageDelivered: MessageDeliveredEventPayload;
  /**
   * [zh-CN] 会话已读回执。
   * 触发时机：对方标记整个会话为已读。
   * 接收方：单聊对方（群聊不触发此事件）。
   * [en-US] Conversation read receipt.
   * Triggered when: the other party marks the entire conversation as read.
   * Received by: the other party in single chat (not triggered in group chat).
   */
  onConversationRead: ConversationReadEventPayload;
  /**
   * [zh-CN] 消息被撤回。
   * 触发时机：发送方撤回消息，或群主/管理员撤回他人消息。
   * 接收方：会话中的所有成员（含撤回者的其他设备）。
   * [en-US] Message recalled.
   * Triggered when: sender recalls a message, or group owner/admin recalls another's message.
   * Received by: all members in the conversation (including recaller's other devices).
   */
  onMessageRecalled: MessageRecalledEventPayload;
  /**
   * [zh-CN] 消息被编辑。
   * 触发时机：发送方编辑已发送的消息。
   * 接收方：会话中的所有成员（含编辑者的其他设备）。
   * [en-US] Message updated (edited).
   * Triggered when: sender edits a sent message.
   * Received by: all members in the conversation (including editor's other devices).
   */
  onMessageUpdated: MessageUpdatedEventPayload;
  /**
   * [zh-CN] 消息 Reaction 变更。
   * 触发时机：有成员对消息添加或移除 Reaction。
   * 接收方：会话中的所有成员（仅单聊和群聊）。
   * [en-US] Message reaction changed.
   * Triggered when: a member adds or removes a reaction.
   * Received by: all members in the conversation (single/group chat only).
   */
  onReactionChanged: ReactionChangedEventPayload;
  /**
   * [zh-CN] 消息置顶状态变更。
   * 触发时机：有成员置顶或取消置顶消息。
   * 接收方：会话中的所有成员。
   * [en-US] Pinned message changed.
   * Triggered when: a member pins or unpins a message.
   * Received by: all members in the conversation.
   */
  onPinnedMessageChanged: PinnedMessageChangedEventPayload;
  /**
   * [zh-CN] ChatThread 创建事件。接收方：子区所属群组的所有成员。
   * [en-US] Chat thread created event. Received by all members of the parent group.
   */
  onChatThreadCreated: ChatThreadCreatedEventPayload;
  /**
   * [zh-CN] ChatThread 解散事件。接收方：子区所属群组的所有成员。
   * [en-US] Chat thread destroyed event. Received by all members of the parent group.
   */
  onChatThreadDestroyed: ChatThreadDestroyedEventPayload;
  /**
   * [zh-CN] ChatThread 更新事件。修改子区名称，或子区中添加、撤销回复消息时触发。接收方：子区所属群组的所有成员。
   * [en-US] Chat thread updated event. Triggered when the thread name changes, or a reply message is added or recalled. Received by all members of the parent group.
   */
  onChatThreadUpdated: ChatThreadUpdatedEventPayload;
  /**
   * [zh-CN] 当前登录用户被群主或群管理员移出 ChatThread。接收方：被移出的当前登录用户。
   * [en-US] Current user removed from a chat thread by the group owner or admin. Received by the removed current user.
   */
  onChatThreadUserRemoved: ChatThreadUserRemovedEventPayload;

  // ─── 多设备事件 ───
  /**
   * [zh-CN] 联系人相关多设备事件。
   * 触发时机：当前用户在其他设备上执行联系人操作（添加/删除/黑名单等）。
   * 接收方：当前用户的其他在线设备。
   * [en-US] Multi-device contact event.
   * Received by: current user's other online devices.
   */
  onMultiDeviceContact: MultiDeviceContactEvent;
  /**
   * [zh-CN] 群组相关多设备事件。
   * 触发时机：当前用户在其他设备上执行群组操作。
   * 接收方：当前用户的其他在线设备。
   * [en-US] Multi-device group event.
   * Received by: current user's other online devices.
   */
  onMultiDeviceGroup: MultiDeviceGroupEvent;
  /**
   * [zh-CN] Thread 相关多设备事件。
   * 触发时机：当前用户在其他设备上执行 Thread 操作。
   * 接收方：当前用户的其他在线设备。
   * [en-US] Multi-device thread event.
   * Received by: current user's other online devices.
   */
  onMultiDeviceThread: MultiDeviceThreadEvent;
  /**
   * [zh-CN] 会话相关多设备事件。
   * 触发时机：当前用户在其他设备上执行会话操作（删除/置顶/标记/免打扰等）。
   * 接收方：当前用户的其他在线设备。
   * [en-US] Multi-device conversation event.
   * Received by: current user's other online devices.
   */
  onMultiDeviceConversation: MultiDeviceConversationEvent;
  /**
   * [zh-CN] 消息删除多设备事件。
   * 触发时机：当前用户在其他设备上删除漫游消息。
   * 接收方：当前用户的其他在线设备。
   * [en-US] Multi-device message removed event.
   * Received by: current user's other online devices.
   */
  onMultiDeviceMessageRemoved: MultiDeviceMessageRemovedEvent;
  /** [zh-CN] 自动数据同步开始。 [en-US] Automatic data sync started. */
  onSyncDataStart: SyncDataStartPayload;
  /** [zh-CN] 自动数据同步完成。 [en-US] Automatic data sync finished. */
  onSyncDataFinished: SyncDataFinishedPayload;
  /** @internal 发送超时内部事件。 */
  onSendTimeout: SendTimeoutEventPayload;

  // ─── 在线状态事件 ───
  /**
   * [zh-CN] 订阅的用户在线状态变更。
   * 触发时机：已订阅的用户在线状态发生变化。
   * 接收方：订阅方。
   * [en-US] Subscribed user presence status changed.
   * Triggered when: a subscribed user's presence status changes.
   * Received by: the subscriber.
   */
  onPresenceStatusChange: ReadonlyArray<PresenceState>;

  // ─── 联系人事件 ───
  /**
   * [zh-CN] 收到好友请求。
   * 触发时机：其他用户向当前用户发送好友请求。
   * 接收方：被邀请方。
   * [en-US] Contact invitation received.
   * Received by: the invited user.
   */
  onContactInvited: ContactRosterEventPayload;
  /**
   * [zh-CN] 被对方删除联系人。
   * 触发时机：对方将当前用户从联系人列表中删除。
   * 接收方：被删除方。
   * [en-US] Removed from contact list by the other party.
   * Received by: the removed user.
   */
  onContactDeleted: ContactRosterEventPayload;
  /**
   * [zh-CN] 新增联系人。
   * 触发时机：好友关系建立成功。
   * 接收方：双方。
   * [en-US] New contact added.
   * Triggered when: friend relationship established.
   * Received by: both parties.
   */
  onContactAdded: ContactRosterEventPayload;
  /**
   * [zh-CN] 好友请求被拒绝。
   * 触发时机：对方拒绝了当前用户的好友请求。
   * 接收方：请求发起方。
   * [en-US] Contact invitation declined.
   * Received by: the invitation sender.
   */
  onContactRefuse: ContactRosterEventPayload;
  /**
   * [zh-CN] 好友请求被接受。
   * 触发时机：对方接受了当前用户的好友请求。
   * 接收方：请求发起方。
   * [en-US] Contact invitation accepted.
   * Received by: the invitation sender.
   */
  onContactAgreed: ContactRosterEventPayload;
  /**
   * [zh-CN] 联系人信息变更。
   * 触发时机：已订阅的联系人信息发生变化。
   * 接收方：订阅方。
   * [en-US] Contact info updated.
   * Received by: the subscriber.
   */
  onContactInfoUpdated: ContactInfoUpdatedEvent;
  // ─── 用户属性事件 ───
  /**
   * [zh-CN] 自己的用户属性被修改。
   * 触发时机：当前用户的属性被修改（含其他设备修改）。
   * 接收方：当前用户所有设备。
   * [en-US] Own user info updated.
   * Received by: all devices of the current user.
   */
  onOwnInfoUpdated: UserInfo;
  /**
   * [zh-CN] 订阅的用户属性变更。
   * 触发时机：已订阅的用户属性发生变化。
   * 接收方：订阅方。
   * [en-US] Subscribed user info updated.
   * Received by: the subscriber.
   */
  onUserInfoUpdated: ReadonlyArray<UserInfo>;

  // ─── 内部原始通知（由各 Manager 消费后转为上层事件） ───
  /** @internal */
  onGroupNotify: GroupRawNotifyEvent;
  /** @internal */
  onChatRoomNotify: ChatRoomRawNotifyEvent;
  /** @internal */
  onChatThreadNotify: ChatThreadRawNotifyEvent;
  /** @internal */
  onUserInfoNotify: UserInfoRawNotifyEvent;
  /** @internal */
  '__internal:onMessageSent': Message;
  // ─── 群组事件（由 GroupManager 从 rawNotify 解析后派发） ───
  /**
   * [zh-CN] 收到入群邀请。接收方：被邀请者。
   * [en-US] Group invitation received. Received by: the invited user.
   */
  onInvitationReceived: GroupInvitationReceivedEventPayload;
  /**
   * [zh-CN] 收到入群申请。接收方：群主和管理员。
   * [en-US] Group join request received. Received by: group owner and admins.
   */
  onRequestToJoinReceived: GroupRequestToJoinReceivedEventPayload;
  /**
   * [zh-CN] 入群申请被同意。接收方：申请者。
   * [en-US] Group join request accepted. Received by: the applicant.
   */
  onRequestToJoinAccepted: GroupRequestToJoinAcceptedEventPayload;
  /**
   * [zh-CN] 入群申请被拒绝。接收方：申请者。
   * [en-US] Group join request declined. Received by: the applicant.
   */
  onRequestToJoinDeclined: GroupRequestToJoinDeclinedEventPayload;
  /**
   * [zh-CN] 入群邀请被接受。接收方：邀请发起者。
   * [en-US] Group invitation accepted. Received by: the invitation sender.
   */
  onInvitationAccepted: GroupInvitationAcceptedEventPayload;
  /**
   * [zh-CN] 入群邀请被拒绝。接收方：邀请发起者。
   * [en-US] Group invitation declined. Received by: the invitation sender.
   */
  onInvitationDeclined: GroupInvitationDeclinedEventPayload;
  /**
   * [zh-CN] 被移出群组。接收方：被移出者 + 群内所有成员。
   * [en-US] Removed from group. Received by: the removed user + all group members.
   */
  onUserRemoved: GroupUserRemovedEventPayload;
  /**
   * [zh-CN] 群组被解散。接收方：群内所有成员。
   * [en-US] Group destroyed. Received by: all group members.
   */
  onGroupDestroyed: GroupDestroyedEventPayload;
  /**
   * [zh-CN] 自动接受入群邀请（群设置为不需要确认时）。接收方：被邀请者。
   * [en-US] Auto-accepted group invitation. Received by: the invited user.
   */
  onAutoAcceptInvitationFromGroup: GroupAutoAcceptInvitationEventPayload;
  /**
   * [zh-CN] 成员被禁言。接收方：群内所有成员。
   * [en-US] Member muted. Received by: all group members.
   */
  onMuteListAdded: GroupMuteListAddedEventPayload;
  /**
   * [zh-CN] 成员被解除禁言。接收方：群内所有成员。
   * [en-US] Member unmuted. Received by: all group members.
   */
  onMuteListRemoved: GroupMuteListRemovedEventPayload;
  /**
   * [zh-CN] 成员加入白名单。接收方：群内所有成员。
   * [en-US] Member added to allowlist. Received by: all group members.
   */
  onAllowListAdded: GroupAllowListAddedEventPayload;
  /**
   * [zh-CN] 成员移出白名单。接收方：群内所有成员。
   * [en-US] Member removed from allowlist. Received by: all group members.
   */
  onAllowListRemoved: GroupAllowListRemovedEventPayload;
  /**
   * [zh-CN] 全员禁言状态变更。接收方：群内所有成员。
   * [en-US] All-member mute state changed. Received by: all group members.
   */
  onAllMemberMuteStateChanged: GroupAllMemberMuteStateChangedEventPayload;
  /**
   * [zh-CN] 新增管理员。接收方：群内所有成员。
   * [en-US] Admin added. Received by: all group members.
   */
  onAdminAdded: GroupAdminAddedEventPayload;
  /**
   * [zh-CN] 移除管理员。接收方：群内所有成员。
   * [en-US] Admin removed. Received by: all group members.
   */
  onAdminRemoved: GroupAdminRemovedEventPayload;
  /**
   * [zh-CN] 群主变更。接收方：群内所有成员。
   * [en-US] Group owner changed. Received by: all group members.
   */
  onOwnerChanged: GroupOwnerChangedEventPayload;
  /**
   * [zh-CN] 新成员加入群组。接收方：群内所有成员。
   * [en-US] New member joined group. Received by: all group members.
   */
  onMembersJoined: GroupMembersJoinedEventPayload;
  /**
   * [zh-CN] 成员退出群组。接收方：群内所有成员。
   * [en-US] Member left group. Received by: all group members.
   */
  onMembersExited: GroupMembersExitedEventPayload;
  /**
   * [zh-CN] 群公告变更。接收方：群内所有成员。
   * [en-US] Group announcement changed. Received by: all group members.
   */
  onAnnouncementChanged: GroupAnnouncementChangedEventPayload;
  /**
   * [zh-CN] 新增群共享文件。接收方：群内所有成员。
   * [en-US] Group shared file added. Received by: all group members.
   */
  onSharedFileAdded: GroupSharedFileAddedEventPayload;
  /**
   * [zh-CN] 删除群共享文件。接收方：群内所有成员。
   * [en-US] Group shared file deleted. Received by: all group members.
   */
  onSharedFileDeleted: GroupSharedFileDeletedEventPayload;
  /**
   * [zh-CN] 群信息变更。接收方：群内所有成员。
   * [en-US] Group info changed. Received by: all group members.
   */
  onGroupInfoChanged: GroupInfoChangedEventPayload;
  /**
   * [zh-CN] 群组禁用状态变更。接收方：群内所有成员。
   * [en-US] Group disabled state changed. Received by: all group members.
   */
  onGroupDisabledChanged: GroupDisabledChangedEventPayload;
  /**
   * [zh-CN] 群成员自定义属性变更。接收方：群内所有成员。
   * [en-US] Group member attribute changed. Received by: all group members.
   */
  onGroupMemberAttributeChanged: GroupMemberAttributeChangedEventPayload;
  /**
   * [zh-CN] 群名片变更。接收方：群内所有成员。
   * [en-US] Group namecard updated. Received by: all group members.
   */
  onUserGroupNamecardUpdated: GroupUserGroupNamecardUpdatedEventPayload;
  // ─── 聊天室事件（由 ChatRoomManager 从 rawNotify 解析后派发） ───
  /**
   * [zh-CN] 聊天室被销毁。接收方：聊天室内所有成员。
   * [en-US] Chat room destroyed. Received by: all chat room members.
   */
  '__chatroom:onChatRoomDestroyed': ChatRoomDestroyedEventPayload;
  /**
   * [zh-CN] 成员加入聊天室。接收方：聊天室内所有成员。
   * [en-US] Member joined chat room. Received by: all chat room members.
   */
  '__chatroom:onMembersJoined': ChatRoomMembersJoinedEventPayload;
  /**
   * [zh-CN] 成员离开聊天室。接收方：聊天室内所有成员。
   * [en-US] Member left chat room. Received by: all chat room members.
   */
  '__chatroom:onMembersExited': ChatRoomMembersExitedEventPayload;
  /**
   * [zh-CN] 被移出聊天室。接收方：被移出者 + 聊天室内所有成员。
   * [en-US] Removed from chat room. Received by: removed user + all chat room members.
   */
  '__chatroom:onRemovedFromChatRoom': ChatRoomRemovedFromChatRoomEventPayload;
  /**
   * [zh-CN] 成员被禁言。接收方：聊天室内所有成员。
   * [en-US] Member muted. Received by: all chat room members.
   */
  '__chatroom:onMuteListAdded': ChatRoomMuteListAddedEventPayload;
  /**
   * [zh-CN] 成员被解除禁言。接收方：聊天室内所有成员。
   * [en-US] Member unmuted. Received by: all chat room members.
   */
  '__chatroom:onMuteListRemoved': ChatRoomMuteListRemovedEventPayload;
  /**
   * [zh-CN] 成员加入白名单。接收方：聊天室内所有成员。
   * [en-US] Member added to allowlist. Received by: all chat room members.
   */
  '__chatroom:onAllowListAdded': ChatRoomAllowListAddedEventPayload;
  /**
   * [zh-CN] 成员移出白名单。接收方：聊天室内所有成员。
   * [en-US] Member removed from allowlist. Received by: all chat room members.
   */
  '__chatroom:onAllowListRemoved': ChatRoomAllowListRemovedEventPayload;
  /**
   * [zh-CN] 全员禁言状态变更。接收方：聊天室内所有成员。
   * [en-US] All-member mute state changed. Received by: all chat room members.
   */
  '__chatroom:onAllMemberMuteStateChanged': ChatRoomAllMemberMuteStateChangedEventPayload;
  /**
   * [zh-CN] 新增管理员。接收方：聊天室内所有成员。
   * [en-US] Admin added. Received by: all chat room members.
   */
  '__chatroom:onAdminAdded': ChatRoomAdminAddedEventPayload;
  /**
   * [zh-CN] 移除管理员。接收方：聊天室内所有成员。
   * [en-US] Admin removed. Received by: all chat room members.
   */
  '__chatroom:onAdminRemoved': ChatRoomAdminRemovedEventPayload;
  /**
   * [zh-CN] 聊天室主变更。接收方：聊天室内所有成员。
   * [en-US] Chat room owner changed. Received by: all chat room members.
   */
  '__chatroom:onOwnerChanged': ChatRoomOwnerChangedEventPayload;
  /**
   * [zh-CN] 聊天室公告变更。接收方：聊天室内所有成员。
   * [en-US] Chat room announcement changed. Received by: all chat room members.
   */
  '__chatroom:onAnnouncementChanged': ChatRoomAnnouncementChangedEventPayload;
  /**
   * [zh-CN] 聊天室信息变更。接收方：聊天室内所有成员。
   * [en-US] Chat room info changed. Received by: all chat room members.
   */
  '__chatroom:onChatRoomInfoChanged': ChatRoomInfoChangedEventPayload;
  /**
   * [zh-CN] 聊天室自定义属性更新。接收方：聊天室内所有成员。
   * [en-US] Chat room attributes updated. Received by: all chat room members.
   */
  '__chatroom:onAttributesUpdate': ChatRoomAttributesUpdateEventPayload;
  /**
   * [zh-CN] 聊天室自定义属性删除。接收方：聊天室内所有成员。
   * [en-US] Chat room attributes removed. Received by: all chat room members.
   */
  '__chatroom:onAttributesRemoved': ChatRoomAttributesRemovedEventPayload;
}

export type ConnectionEventPayloadMap = Pick<EventPayloadMap, ConnectionEventName>; // 连接事件载荷映射

type EventHandlerResult = void | Promise<void>;

export type ConnectionEventHandlerMap = Partial<{
  [K in ConnectionEventName]: (payload: ConnectionEventPayloadMap[K]) => EventHandlerResult;
}>;

export type ChatEventPayloadMap = Pick<EventPayloadMap, ChatEventName>;

export type ChatEventHandlerMap = Partial<{
  [K in ChatEventName]: (payload: ChatEventPayloadMap[K]) => EventHandlerResult;
}>;

export type ChatThreadEventPayloadMap = Pick<EventPayloadMap, ChatThreadEventName>;

export type ChatThreadEventHandlerMap = Partial<{
  [K in ChatThreadEventName]: (
    payload: ChatThreadEventPayloadMap[K]
  ) => EventHandlerResult;
}>;

export type MultiDeviceEventPayloadMap = Pick<
  EventPayloadMap,
  | 'onMultiDeviceContact'
  | 'onMultiDeviceGroup'
  | 'onMultiDeviceThread'
  | 'onMultiDeviceConversation'
  | 'onMultiDeviceMessageRemoved'
>;

export type MultiDeviceEventHandlerMap = Partial<{
  [K in keyof MultiDeviceEventPayloadMap]: (
    payload: MultiDeviceEventPayloadMap[K]
  ) => EventHandlerResult;
}>;

export type PresenceEventPayloadMap = Pick<EventPayloadMap, PresenceEventName>; // 在线状态事件载荷映射

export type PresenceEventHandlerMap = Partial<{
  // 在线状态事件处理器映射
  [K in PresenceEventName]: (payload: PresenceEventPayloadMap[K]) => EventHandlerResult; // 在线状态事件回调
}>;

export type ContactEventPayloadMap = Pick<EventPayloadMap, ContactEventName>;

export type ContactEventHandlerMap = Partial<{
  [K in ContactEventName]: (payload: ContactEventPayloadMap[K]) => EventHandlerResult;
}>;

export type UserInfoEventPayloadMap = Pick<EventPayloadMap, UserInfoEventName>;

export type UserInfoEventHandlerMap = Partial<{
  [K in UserInfoEventName]: (payload: UserInfoEventPayloadMap[K]) => EventHandlerResult;
}>;

export type GroupEventPayloadMap = Pick<EventPayloadMap, GroupEventName>;

export type GroupEventHandlerMap = Partial<{
  [K in GroupEventName]: (payload: GroupEventPayloadMap[K]) => EventHandlerResult;
}>;

export type ChatRoomInternalEventPayloadMap = Pick<EventPayloadMap, ChatRoomDispatchEventName>;

export type ChatRoomInternalEventHandlerMap = Partial<{
  [K in ChatRoomDispatchEventName]: (
    payload: ChatRoomInternalEventPayloadMap[K]
  ) => EventHandlerResult;
}>;

export type EventHandlerMap = Partial<{
  [K in EventName]: (payload: EventPayloadMap[K]) => EventHandlerResult;
}>;

export type EventHandlerId = string;
