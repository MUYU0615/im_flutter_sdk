export { ChatClient } from './chat-client'; // 导出 ChatClient
export { setLogLevel } from './utils/logger'; // 导出日志级别控制
export { createPlatformAdapter, detectRuntimePlatform } from './platform'; // 导出平台适配层工厂
export { RUNTIME_PLATFORMS } from './platform'; // 导出运行平台常量
export { ChatManager } from './managers/chat/index'; // 导出 ChatManager
export { ChatThread } from './managers/chat-thread/index';
export { ChatThreadManager } from './managers/chat-thread/index';
export { ChatRoom } from './managers/chatroom/index'; // 导出 ChatRoom 实体
export { ChatRoomManager } from './managers/chatroom/index'; // 导出 ChatRoomManager
export { ContactManager } from './managers/contact/index'; // 导出 ContactManager
export { Group } from './managers/group/index'; // 导出 Group 实体
export { GroupManager } from './managers/group/index'; // 导出 GroupManager
export { PresenceManager } from './managers/presence/index'; // 导出 PresenceManager
export { PushManager } from './managers/push/index'; // 导出 PushManager
export { UserInfoManager } from './managers/user-info/index'; // 导出 UserInfoManager
export { CacheManager } from './cache/index'; // 导出缓存管理器
export type {
  // 导出 ChatClient 类型
  InitConfig, // 初始化配置类型
  AuthContext, // 认证上下文类型
  RestContext, // REST 上下文类型
  ConnectionState, // 连接状态类型
  TokenRenewalResult, // token 续期结果类型
  GetRTCTokenInfoParams, // RTC token 查询参数
  RTCTokenInfo, // RTC token 信息
  RTCUid, // RTC UID 类型
  RTCUidUserIdMap, // RTC UID 到 userId 映射
  DnsConfig, // DNS 配置类型
  DnsHost, // DNS Host 类型
  SelfIdsOnOtherPlatform, // 多端登录设备 ID 列表
  ServerUrlsConfig, // 服务地址配置
  ServiceConfig, // 服务配置
  SyncConversationListConfig, // 会话列表同步配置
} from './types/chat-client'; // 类型来源
export type {
  SyncDataError,
  SyncDataErrorStage,
  SyncDataFinishedPayload,
  SyncDataStartPayload,
  SyncDataStatus,
  SyncDataType,
} from './types/sync-data';
export type {
  AddContactParams,
  BlocklistAddResult,
  BlocklistMutationParams,
  BlocklistSnapshot,
  Contact,
  ContactInfoUpdatedEvent,
  ContactMutationTarget,
  ContactRosterEventPayload,
  ContactRosterEventType,
  ContactSnapshot,
  ContactSyncDecision,
  ContactSyncError,
  ContactSyncFinishPayload,
  ContactSyncSource,
  ContactSyncStage,
  SetContactRemarkParams,
} from './types/contact';
export type {
  // 导出管理器类型
  ManagerBase, // 管理器基础类型
  ManagerConstructor, // 管理器构造器类型
  ManagerInstance, // 管理器实例类型
  ManagerRegistration, // 管理器注册类型
  WithManager, // 单管理器扩展类型
  WithManagers, // 多管理器扩展类型
} from './types/manager'; // 类型来源
export type {
  ChatRoomAdminInput,
  ChatRoomAdminParams,
  ChatRoomAdminAddedEventPayload,
  ChatRoomAdminRemovedEventPayload,
  ChatRoomAllMemberMuteStateChangedEventPayload,
  ChatRoomAllowlistEntry,
  ChatRoomAnnouncement,
  ChatRoomAnnouncementChangedEventPayload,
  ChatRoomAnnouncementUpdateInput,
  ChatRoomAnnouncementUpdateParams,
  ChatRoomAttributeMutationResult,
  ChatRoomAttributesRemovedEventPayload,
  ChatRoomAttributesSnapshot,
  ChatRoomAllowListAddedEventPayload,
  ChatRoomAllowListRemovedEventPayload,
  ChatRoomBlocklistEntry,
  ChatRoomDestroyedEventPayload,
  ChatRoomDetail,
  ChatRoomCurrentUserStatus,
  ChatRoomEventHandlerMap,
  ChatRoomEventName,
  ChatRoomEventPayloadMap,
  ChatRoomListResult,
  ChatRoomAttributesUpdateEventPayload,
  ChatRoomMemberActionListResult,
  ChatRoomMemberActionResult,
  ChatRoomMemberEntry,
  ChatRoomMembersExitedEventPayload,
  ChatRoomMembersJoinedEventPayload,
  ChatRoomMemberListParams,
  ChatRoomMemberListResult,
  ChatRoomMuteEntry,
  ChatRoomMuteListAddedEventPayload,
  ChatRoomMuteListRemovedEventPayload,
  ChatRoomMuteMembersInput,
  ChatRoomMuteMembersParams,
  ChatRoomMuteStatus,
  ChatRoomMutationTarget,
  ChatRoomOwnerChangedEventPayload,
  ChatRoomPageParams,
  ChatRoomPermissionType,
  ChatRoomRole,
  ChatRoomInfoChangedEventPayload,
  ChatRoomSummary,
  ChatRoomUpdateInfoInput,
  ChatRoomUpdateResult,
  ChatRoomUserBatchInput,
  ChatRoomUserBatchParams,
  ChatRoomRemovedFromChatRoomEventPayload,
  DeleteChatRoomSharedFileParams,
  GetChatRoomAttributesInput,
  GetChatRoomAttributesParams,
  GetChatRoomInfoParams,
  GetChatRoomListParams,
  JoinChatRoomParams,
  RemoveChatRoomAttributesInput,
  RemoveChatRoomAttributesParams,
  SetChatRoomAttributesInput,
  SetChatRoomAttributesParams,
  UpdateChatRoomInfoParams,
} from './types/chatroom';
export type {
  AcceptGroupJoinRequestParams,
  CreateGroupParams,
  CreateGroupResult,
  CursorPageParams,
  DeleteGroupSharedFileParams,
  DownloadGroupSharedFileParams,
  GetGroupInfoListParams,
  GetGroupInfoParams,
  GetGroupMembersAttributesParams,
  GetPublicGroupListParams,
  GroupAdminMutationParams,
  GroupAllowlistEntry,
  GroupAdminAddedEventPayload,
  GroupAdminRemovedEventPayload,
  GroupAnnouncement,
  GroupAnnouncementChangedEventPayload,
  GroupAnnouncementUpdateInput,
  GroupAnnouncementUpdateParams,
  GroupAutoAcceptInvitationEventPayload,
  GroupBlocklistEntry,
  GroupDeleteSharedFileInput,
  GroupDetail,
  GroupDownloadSharedFileInput,
  GroupDestroyedEventPayload,
  GroupInvitationAcceptedEventPayload,
  GroupInvitationDeclinedEventPayload,
  GroupInvitationReceivedEventPayload,
  GroupGetMembersAttributesInput,
  GroupListResult,
  GroupMemberAttributeChangedEventPayload,
  GroupMemberEntry,
  GroupMemberListQuery,
  GroupMuteListQuery,
  GroupMemberListParams,
  GroupMemberListResult,
  GroupMembersAttributesResult,
  GroupMembersExitedEventPayload,
  GroupMembersJoinedEventPayload,
  GroupMuteEntry,
  GroupMuteListAddedEventPayload,
  GroupMuteListRemovedEventPayload,
  GroupMuteMembersInput,
  GroupMutationTarget,
  NumberPageParams,
  GroupOwnerChangedEventPayload,
  GroupOwnerChangeInput,
  GroupOwnerChangeParams,
  GroupRequestToJoinAcceptedEventPayload,
  GroupRequestToJoinDeclinedEventPayload,
  GroupRequestToJoinReceivedEventPayload,
  GroupRole,
  GroupSetMemberAttributesInput,
  GroupSharedFile,
  GroupSharedFileListQuery,
  GroupSharedFileAddedEventPayload,
  GroupSharedFileDeletedEventPayload,
  GroupSharedFileListParams,
  GroupSharedFileListResult,
  GroupInfoChangedEventPayload,
  GroupDisabledChangedEventPayload,
  JoinedGroupSnapshot,
  JoinedGroupSnapshotIntegrity,
  JoinedGroupSnapshotMeta,
  JoinedGroupSnapshotSource,
  JoinedGroupSummary,
  GroupSummary,
  GroupManagerListener,
  GroupUpdateConfigsInput,
  GroupUpdateInfoInput,
  GroupUploadSharedFileInput,
  GroupUserBatchInput,
  GroupUserBatchParams,
  GroupUserGroupNamecardUpdatedEventPayload,
  GroupUserRemovedEventPayload,
  GroupAllowListAddedEventPayload,
  GroupAllowListRemovedEventPayload,
  GroupAllMemberMuteStateChangedEventPayload,
  GroupJoinParams,
  GroupMuteMembersParams,
  RejectGroupJoinRequestParams,
  SetGroupMemberAttributesParams,
  UpdateGroupInfoParams,
  UploadGroupSharedFileParams,
} from './types/group';
export type {
  ChatActionResult,
  ChatConversationType,
  ConversationLocator,
  DownloadCombineMessageInput,
  DownloadAttachmentParams,
  GetHistoryMessagesParams,
  GetReactionDetailParams,
  GetReactionListParams,
  GroupMessageReadUser,
  GroupMessageReadUsersParams,
  GroupMessageReadUsersResult,
  MarkConversationReadParams,
  MarkMessageReadItem,
  MarkMessageReadParams,
  MessageAttachmentDownloadResult,
  MessageHistoryPage,
  MessageReactionDetailPage,
  MessageReactionListItem,
  MessageReactionSummary,
  MessageTranslation,
  MessageTranslationResult,
  ReactionOperationParams,
  RecallMessageParams,
  RemoveHistoryMessagesParams,
  TranslateMessageParams,
  TranslationLanguage,
  UpdateMessageParams,
  MessageSearchOption,
  SearchableMessageType,
  SearchMessagesParams,
  SearchMessagesResult,
  SearchResultMessage,
  VoiceParams,
  VoiceMessageSource,
  VoiceSourceFile,
  VoiceToTextResult,
} from './types/chat-manager';
export type {
  // 导出创建消息参数类型
  CreateCmdMessageParams, // 命令消息入参类型
  CreateCombineMessageParams, // 合并消息入参类型
  CreateCustomMessageParams, // 自定义消息入参类型
  CreateFileMessageParams, // 文件消息入参类型
  CreateImageMessageParams, // 图片消息入参类型
  CreateLocationMessageParams, // 位置消息入参类型
  CreateTextMessageParams, // 文本消息入参类型
  CreateVideoMessageParams, // 视频消息入参类型
  CreateVoiceMessageParams, // 语音消息入参类型
} from './types/message-create'; // 类型来源
export type { FileUploadProgress, FileUploadResult, Message, MessageBody, MessageReaction, SendMessageOptions, VoiceMessageBody } from './types/index'; // 消息相关类型
export type {
  ChatEventHandlerMap, // Chat 事件处理器类型
  ChatThreadEventName,
  ChatThreadEventHandlerMap,
  ChatThreadEventPayloadMap,
  ContactEventHandlerMap, // 联系人事件处理器类型
  ConnectionEventHandlerMap, // 连接事件处理器类型
  EventHandlerId, // 事件处理器标识
  EventHandlerMap, // 通用事件处理器映射
  EventName, // 事件名称
  EventPayloadMap, // 事件载荷映射
  MultiDeviceEventHandlerMap,
  GroupEventHandlerMap, // 群组事件处理器类型
  PresenceEventHandlerMap, // 在线状态事件处理器类型
  UserInfoEventHandlerMap, // 用户资料事件处理器类型
} from './types/event-system'; // 导出事件类型
export type {
  MultiDeviceContactOperation,
  MultiDeviceConversationOperation,
  MultiDeviceEvent,
  MultiDeviceEventCategory,
  MultiDeviceGroupOperation,
  MultiDeviceMessageRemovedOperation,
  MultiDeviceThreadOperation,
} from './types/multi-device';
export type {
  ChatThreadBaseEventPayload,
  ChatThreadCreatedEventPayload,
  ChatThreadDetail,
  ChatThreadDestroyedEventPayload,
  ChatThreadLastMessageEntry,
  ChatThreadLastMessageListResult,
  ChatThreadListResult,
  ChatThreadMemberEntry,
  ChatThreadMemberListResult,
  ChatThreadMutationTarget,
  ChatThreadSummary,
  ChatThreadUpdatedEventPayload,
  ChatThreadUserRemovedEventPayload,
  CreateChatThreadParams,
  CreateChatThreadResult,
  GetChatThreadInfoParams,
  GetChatThreadLastMessageListParams,
  GetChatThreadListParams,
  GetChatThreadMemberListParams,
  GetJoinedChatThreadListParams,
  RemoveChatThreadMemberParams,
  UpdateChatThreadNameParams,
} from './types/chat-thread';
export type {
  // 导出在线状态类型
  PresenceInfo, // 在线状态业务对象
  PresenceState, // 在线状态事件类型
  PresenceStatusDetails, // 在线状态详情类型
  SubscribePresenceResponse, // 订阅在线状态响应
  SubscribedPresenceListResponse, // 订阅列表响应
} from './types/presence'; // 类型来源
export type { PublishPresenceParams } from './managers/presence-manager'; // 在线状态发布参数
export type {
  // 导出推送管理类型
  BatchConversationSilentModeResponse, // 批量会话免打扰响应
  ClearConversationRemindTypeParams, // 清除会话提醒参数
  ConversationIdentifier, // 会话标识
  ConversationSilentModeResponse, // 会话免打扰响应
  GetConversationListByRemindTypeParams, // 分页查询参数
  GetConversationSilentModeParams, // 查询会话免打扰参数
  GetConversationSilentModesParams, // 批量查询会话免打扰参数
  GetGlobalSilentModeParams, // 查询全局免打扰参数
  GetPushLanguageParams, // 查询推送语言参数
  GlobalSilentModeResponse, // 全局免打扰响应
  MutedConversationItem, // 免打扰会话条目
  MutedConversationPageResponse, // 免打扰会话分页响应
  PushConversationType, // 会话类型
  PushLanguageResponse, // 推送语言响应
  PushRemindType, // 提醒类型
  PushRemindTypeWithoutDefault, // 提醒类型（不含默认）
  PushSilentModeDurationRuleInput, // 时长规则输入
  PushSilentModeDurationRuleView, // 时长规则输出
  PushSilentModeIntervalRuleInput, // 时间区间规则输入
  PushSilentModeIntervalRuleView, // 时间区间规则输出
  PushSilentModeRemindTypeRuleInput, // 提醒规则输入
  PushSilentModeRemindTypeRuleView, // 提醒规则输出
  PushSilentModeRuleInput, // 免打扰规则输入
  PushSilentModeRuleView, // 免打扰规则输出
  PushTimePoint, // 时间点
  SetConversationSilentModeParams, // 设置会话免打扰参数
  SetGlobalSilentModeParams, // 设置全局免打扰参数
  SetPushLanguageParams, // 设置推送语言参数
  UploadPushTokenParams, // 上传推送 token 参数
} from './types/push'; // 类型来源
export type {
  // 导出用户信息类型
  FetchUserInfoByAttributeParams, // 按属性查询参数
  FetchUserInfoByUserIdParams, // 按用户 ID 查询参数
  SubscribeUsersInfoParams, // 订阅资料变化参数
  UnsubscribeUsersInfoParams, // 取消订阅资料变化参数
  UpdateOwnInfoByAttributeParams, // 单属性更新参数模型
  UpdateOwnInfoParams, // 当前用户资料更新参数
  UserInfoAttribute, // 用户信息字段
  UserInfoAttributeValue, // 用户信息字段值
  UserInfoListener, // 用户资料监听器
  UserInfo, // 用户信息业务对象
} from './types/user-info'; // 类型来源
export type {
  // 导出缓存类型
  CacheConfig, // 缓存配置
  CacheDump, // 缓存落盘结构
  CacheMetadata, // 缓存元信息
  ConversationSummary, // 会话摘要
  ConversationListUpdatePayload, // 会话列表更新载荷
  ConversationListUpdatePatch, // 会话列表更新补丁
  ConversationListUpdateReason, // 会话列表更新原因
  GroupNamecardCacheRecord, // 群名片缓存
  MessageSnippet, // 消息摘要
  UserInfoSummary, // 用户信息摘要
} from './cache/index'; // 类型来源
export type {
  ConversationFilter,
  ConversationItem,
  ConversationMark,
  ConversationMarkMutationItem,
  ConversationMarkMutationResult,
  ConversationMarkParams,
  ConversationMutationResult,
  ConversationMarkTarget,
  ConversationType,
  DeleteConversationParams,
  GetPinnedMessageListParams,
  MessagePinMutationResult,
  PinMessageParams,
  PinnedMessageListResult,
  PinnedMessageSummary,
  RefreshSessionListParams,
  SessionListRemindType,
  SessionMessageSnippet,
  Sender,
  SetConversationPinnedParams,
} from './types/conversation';
export { CONVERSATION_MARK } from './types/conversation';
export type {
  // 导出平台适配层类型
  PlatformAdapter, // 平台适配器总接口
  PlatformAdapterError, // 平台错误
  PlatformCapability, // 平台能力画像
  PlatformFactoryResult, // 平台工厂结果
  RuntimePlatform, // 运行平台
} from './platform'; // 平台类型来源
