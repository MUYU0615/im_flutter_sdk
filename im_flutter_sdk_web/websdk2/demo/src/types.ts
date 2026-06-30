import type {
  ChatManager,
  ChatClient,
  ChatThreadManager,
  ChatRoomManager,
  ContactManager,
  ConversationItem,
  ConversationSummary,
  EventPayloadMap,
  GroupNamecardCacheRecord,
  GroupManager,
  PresenceManager,
  PresenceState,
  PushManager,
  SyncDataType,
  UserInfo,
  UserInfoManager,
  UserInfoSummary,
  WithManager,
} from 'im-sdk-web'; // 引入 SDK 事件类型

export type LogType = 'info' | 'success' | 'warn' | 'error'; // 日志类型

export type LogItem = Readonly<{
  // 日志项类型
  id: string; // 日志 ID
  type: LogType; // 日志类型
  message: string; // 日志内容
  time: string; // 日志时间
}>; // 日志项类型结束

export type ChannelTypeOption = 'single' | 'group' | 'room'; // 会话类型

export type MessageTypeOption = // 消息类型
  | 'text' // 文本
  | 'image' // 图片
  | 'voice' // 语音
  | 'video' // 视频
  | 'file' // 文件
  | 'custom' // 自定义
  | 'cmd' // 命令
  | 'location'; // 位置

export type MessageRecord = EventPayloadMap['onMessage']; // SDK 消息类型

export type ParamsRecord = Record<string, string>; // 参数映射类型

export type PresenceStateRecord = PresenceState; // 在线状态展示类型

export type ConversationItemRecord = ConversationItem;

export type ConversationListUpdatePayloadRecord = EventPayloadMap['onConversationListUpdate']; // 会话列表更新事件类型
export type MessageReadEventRecord = EventPayloadMap['onMessageRead'];
export type ConversationReadEventRecord = EventPayloadMap['onConversationRead'];
export type MessageRecalledEventRecord = EventPayloadMap['onMessageRecalled'];
export type MessageUpdatedEventRecord = EventPayloadMap['onMessageUpdated'];
export type ReactionChangedEventRecord = EventPayloadMap['onReactionChanged'];
export type PinnedMessageChangedEventRecord = EventPayloadMap['onPinnedMessageChanged'];

export type CacheEncryptionModeOption = 'auto' | 'off'; // demo 调试时允许切到明文缓存

export type UserInfoSummaryRecord = UserInfoSummary; // 用户资料缓存记录

export type GroupNamecardRecord = GroupNamecardCacheRecord; // 群名片缓存记录

export interface UserInfoEventRecord {
  readonly id: string;
  readonly kind: 'self' | 'others';
  readonly time: string;
  readonly payload: ReadonlyArray<UserInfo>;
}

export interface GroupNamecardEventRecord {
  readonly id: string;
  readonly time: string;
  readonly payload: EventPayloadMap['onUserGroupNamecardUpdated'];
}

export interface DemoInitConfigInput {
  readonly appKey: string;
  readonly useDnsConfig: boolean;
  readonly dnsUrls: string;
  readonly restApiUrl: string;
  readonly wsUrl: string;
  readonly syncWsUrl: string;
  readonly enableUserInfoSync: boolean;
  readonly enableSyncData: ReadonlyArray<SyncDataType>;
  readonly cacheEncryptionMode: CacheEncryptionModeOption;
}

export interface DemoFixedServerPreset {
  readonly id: string;
  readonly label: string;
  readonly appKey: string;
  readonly restApiUrl: string;
  readonly wsUrl: string;
  readonly syncWsUrl: string;
}

export type DemoClient = WithManager<
  WithManager<
    WithManager<
      WithManager<
        WithManager<
          WithManager<
            WithManager<
              WithManager<ChatClient, 'chatManager', ChatManager>,
              'chatThreadManager',
              ChatThreadManager
            >,
            'contactManager',
            ContactManager
          >,
          'chatRoomManager',
          ChatRoomManager
        >,
        'groupManager',
        GroupManager
      >,
      'userInfoManager',
      UserInfoManager
    >,
    'presenceManager',
    PresenceManager
  >,
  'pushManager',
  PushManager
>; // Demo 客户端类型

export interface CacheDebugInspectResult {
  readonly appKey: string;
  readonly userId: string;
  readonly conversationKey: string;
  readonly userInfoKey: string;
  readonly groupNamecardKey: string;
  readonly contactRelationKey: string;
  readonly contactVersionKey: string;
  readonly contactMetaKey: string;
  readonly metadataKey: string;
  readonly conversationCount: number;
  readonly userInfoCount: number;
  readonly groupNamecardCount: number;
  readonly contactRelationCount: number;
  readonly conversationKB: number;
  readonly userInfoKB: number;
  readonly groupNamecardKB: number;
  readonly contactRelationKB: number;
  readonly contactVersionKB: number;
  readonly contactMetaKB: number;
  readonly metadataKB: number;
  readonly totalKB: number;
  readonly approxRemainingKB: number;
  readonly inMemoryConversationCount: number | null;
  readonly inMemoryUserInfoCount: number | null;
  readonly inMemoryGroupNamecardCount: number | null;
  readonly inMemoryContactRelationCount: number | null;
}

export interface CacheDebugMutationResult extends CacheDebugInspectResult {
  readonly ok: boolean;
  readonly action:
    | 'seedNearQuota'
    | 'appendUsers'
    | 'appendUsersViaSdk'
    | 'clearCurrentKeys'
    | 'measureNormalUserInfoCapacity'
    | 'measureNormalConversationCapacity'
    | 'measureNormalGroupNamecardCapacity'
    | 'measureNormalContactCapacity';
  readonly seededUsers?: number;
  readonly seededConversations?: number;
  readonly appended?: number;
  readonly totalUsers?: number;
  readonly quotaLikelyTriggered?: boolean;
  readonly reserveKB?: number;
  readonly measuredKind?: 'userInfo' | 'conversation' | 'groupNamecard' | 'contact';
  readonly measuredCount?: number;
  readonly payloadKB?: number;
  readonly errorName?: string;
  readonly errorMessage?: string;
}

export interface CacheSeedOptions {
  readonly reserveKB?: number;
  readonly expiredCount?: number;
  readonly maxUsers?: number;
  readonly blobSize?: number;
  readonly conversationCount?: number;
}

export interface CacheDebugTools {
  inspect: () => CacheDebugInspectResult;
  seedNearQuota: (options?: CacheSeedOptions) => CacheDebugMutationResult;
  appendUsers: (count?: number, blobSize?: number) => CacheDebugMutationResult;
  appendUsersViaSdk: (count?: number, blobSize?: number) => Promise<CacheDebugMutationResult>;
  measureNormalCapacity: (
    kind: 'userInfo' | 'conversation' | 'groupNamecard' | 'contact',
    reserveKB?: number
  ) => CacheDebugMutationResult;
  clearCurrentKeys: () => CacheDebugMutationResult;
  reload: () => void;
  readCurrentUserDump: () => ReadonlyArray<UserInfoSummary>;
  readCurrentConversationDump: () => ReadonlyArray<ConversationSummary>;
}
