/**
 * ChatClient MVP 实现
 */

import { CoreSDK } from './core';
import { CacheManager } from './cache'; // 缓存管理器
import {
  GROUP_NAMECARD_HYDRATION_MAX_CONCURRENCY,
  GROUP_NAMECARD_HYDRATION_MIN_WINDOW_MS,
  GROUP_NAMECARD_HYDRATION_BATCH_SIZE,
  GROUP_NAMECARD_HYDRATION_WINDOW_MS,
  USER_INFO_HYDRATION_BATCH_SIZE,
  USER_INFO_HYDRATION_WINDOW_MS,
} from './config/timeouts';
import { EventHub } from './core/events/event-hub';
import { SessionListSyncController } from './core/session-list-sync/session-list-sync-controller';
import { SharedSyncWebSocketSession } from './core/sync/shared-sync-websocket-session';
import { toConversationItem } from './core/session-list-sync/session-list-query';
import { fetchContactMetadataVersion } from './rest/contact-metadata';
import { resolveDnsConfig, DEFAULT_DNS_CONFIG_URLS } from './rest/dns-config';
import {
  requestGetSelfIdsOnOtherPlatform,
  requestGetRTCTokenInfo,
  requestGetUserIdsWithRTCUids,
  requestTokenExpireAt,
} from './rest/rtc-token';
import { RestClient } from './rest/client';
import { mergeRuntimeErrorMaps } from './rest/error-map-types';
import { COMMON_ERROR_MAP } from './rest/error-maps/common';
import { CORE_ERROR_MAP } from './rest/error-maps/core';
import { createPlatformAdapter } from './platform'; // 平台适配层工厂
import type { UploadAdapter } from './platform';
import { resolveSingleContactUserInfo } from './managers/contact/contact-user-info-resolver';
import {
  GroupNamecardHydrationQueue,
  type GroupNamecardHydrationBatch,
} from './core/message/profile-sync/group-namecard-hydration-queue';
import {
  UserInfoHydrationQueue,
  type UserInfoHydrationTarget,
} from './core/message/profile-sync/user-info-hydration-queue';
import {
  clearMessageProfileVersionSidecar,
  getMessageProfileVersionSidecar,
  setMessageProfileVersionSidecar,
} from './core/message/profile-sync/profile-version-sidecar';
import { parseAppKey } from './upload/utils';
import { Validator } from './validators/validator';
import {
  authContextSchema,
  getRTCTokenInfoParamsSchema,
  initConfigSchema,
  renewTokenSchema,
  rtcUidListSchema,
} from './validators/chat-client';
import { ConnectionError, MessageSendError, SDKError, ValidationError } from './utils/errors';
import { ERROR_CODES } from './utils/error-codes';
import {
  logger,
  reportLogsNow,
  setLogReportEnabled,
  stopLogReporter,
  updateLogReportContext,
} from './utils/logger'; // 日志与上报控制
import {
  ChatEventName,
  ConnectionEventName,
  ConnectionStatus,
  ContactEventName,
  GroupEventName,
  InternalEventName,
  isStreamMessage,
} from './types'; // 事件常量
import type { ErrorCode } from './utils/error-codes';
import type { PlatformFactoryResult } from './platform';
import type {
  AuthContext,
  ConnectionState,
  GetRTCTokenInfoParams,
  InitConfig,
  ProfileSyncConfig,
  RestContext,
  SelfIdsOnOtherPlatform,
  RTCTokenInfo,
  RTCUidUserIdMap,
  ServerUrlsConfig,
  ServiceConfig,
  TokenRenewalResult,
} from './types/chat-client';
import type {
  EventHandlerMap,
  EventHandlerId,
} from './types/event-system';
import type {
  ConversationListUpdatePatch,
  ConversationListUpdateReason,
} from './cache/cache-types';
import type { ConversationItem, ConversationType } from './types/conversation';
import type { ChatThreadRawNotifyEvent } from './types/chat-thread';
import type {
  ContactRosterEventPayload,
  ContactSnapshot,
  ContactSyncDecision,
} from './types/contact';
import type { SyncDataErrorStage, SyncDataFinishedPayload, SyncDataType } from './types/sync-data';
import type { ChatRoomRawNotifyEvent } from './types/chatroom';
import type { GroupRawNotifyEvent } from './types/group';
import type {
  ManagerBase,
  ManagerCapability,
  ManagerConstructor,
  ManagerInstance,
  ManagerEventContext,
  ManagerRegistration,
  RawNotifyEvent,
  WithManager,
  WithManagers,
} from './types/manager';
import type {
  // 创建消息类型
  ConnectionEventPayload, // 连接事件载荷
  DownloadCombineMessageParams, // 下载并解析合并消息详情入参
  MessageAttachmentDownloadResult,
  Message, // 消息类型
  SendMessageOptions, // 发送消息选项
} from './types'; // 类型来源
import type { MessageActionRequest, ActionAckResult } from './core/message/message-action-types';
import type { ChatRoomOperationRequest } from './core/message/chatroom-operation-types';
import type { UserInfo } from './types/user-info';
import type { UserInfoRawNotifyEvent } from './types/user-info';
import type { RosterRequest } from './protocol/roster/types';
import { RosterMessageType } from './protocol/roster/types';
import type { RefreshSessionListParams } from './types/conversation';
import type { SyncConversationListConfig } from './types/chat-client';

const CORE_REST_ERROR_MAP = mergeRuntimeErrorMaps(COMMON_ERROR_MAP, CORE_ERROR_MAP);

type ServiceConnectionMode = 'dns' | 'fixed';

type NormalizedServiceConfig = {
  mode: ServiceConnectionMode;
  dnsConfigUrls: string[];
  hasCustomDnsConfigUrls: boolean;
  serverUrls?: ServerUrlsConfig;
};

type NormalizedInitConfig = {
  appKey: string;
  enableUserInfoSync: boolean;
  enableSyncData: ReadonlyArray<SyncDataType>;
  enableDeliveryReceipt: boolean;
  syncConversationListConfig: Required<SyncConversationListConfig> & { readonly includeMark: true };
  useCustomAttachmentUpload: boolean;
  serviceConfig: NormalizedServiceConfig;
  useFixedDeviceId: boolean;
  deviceId: string;
  useReplacedMessageContents: boolean;
  customDeviceName?: string;
  customOsPlatform?: number;
  uiKitVersion?: string;
  loginExtensionInfo?: string;
  cacheEncryptionMode: 'auto' | 'off';
  profileSync: Required<ProfileSyncConfig>;
};

interface UserInfoReadCapability extends ManagerBase<ChatClient> {
  getUserInfoByUserId(params: {
    readonly userIds: ReadonlyArray<string>;
  }): Promise<ReadonlyArray<UserInfo>>;
}

interface GroupNamecardHydrationCapability extends ManagerBase<ChatClient> {
  hydrateMessageProfileGroupNamecards(
    groupId: string,
    targets: ReadonlyArray<{ readonly userId: string; readonly namecardUpdateTime?: number }>
  ): Promise<void>;
}

/**
 * [zh-CN] ChatClient 是 SDK 的主入口，负责连接生命周期、消息发送、事件分发、缓存访问与管理器注册。
 * [en-US] ChatClient is the main SDK entry point responsible for connection lifecycle, message sending, event dispatch, cache access, and manager registration.
 */
export class ChatClient {
  private static instance: ChatClient | null = null;
  private config: NormalizedInitConfig;
  private core: CoreSDK | null = null;
  private cacheManager: CacheManager | null = null; // 缓存管理器
  private cacheUserId: string | null = null; // 缓存用户 ID
  private state: ConnectionState = ConnectionStatus.DISCONNECTED;
  private loginAttempt = 0;
  private eventHub: EventHub;
  private currentUserId: string | null = null; // 当前登录用户 ID
  private logReportEnabled = false; // 当前日志上报开关
  private readonly managerRegistry: Map<string, ManagerBase<ChatClient>>;
  private readonly managerCapabilities: Map<ManagerCapability, ManagerBase<ChatClient>>;
  private readonly managerEventContext: ManagerEventContext;
  private restBaseUrl: string | null = null; // REST 基础地址缓存
  private authToken: string | null = null; // 访问 token 缓存
  private clientResource: string | null = null; // 设备资源标识缓存
  private platformAdapter: PlatformFactoryResult | null = null; // 平台适配器缓存
  private contactSyncController: { sync(): Promise<void>; cancel(): void } | null = null;
  private groupSyncController: { sync(): Promise<void>; cancel(): void } | null = null;
  private syncConversationListConfigController: SessionListSyncController | null = null;
  private syncWebSocketSession: SharedSyncWebSocketSession | null = null;
  private contactSyncWsUrls: string[] = []; // 联系人同步地址缓存
  private syncConversationListConfigWsUrls: string[] = []; // 会话列表同步地址缓存
  private contactSyncDnsResolved = false; // 是否已拿到过联系人同步 DNS 结果
  private readonly userInfoHydrationQueue: UserInfoHydrationQueue;
  private readonly groupNamecardHydrationQueue: GroupNamecardHydrationQueue;
  private conversationListVersion = 0;
  private conversationListSnapshot: ReadonlyArray<ConversationItem> = [];

  private constructor(config: NormalizedInitConfig) {
    this.config = {
      appKey: config.appKey,
      enableUserInfoSync: config.enableUserInfoSync,
      enableSyncData: [...config.enableSyncData],
      enableDeliveryReceipt: config.enableDeliveryReceipt,
      syncConversationListConfig: { ...config.syncConversationListConfig },
      useCustomAttachmentUpload: config.useCustomAttachmentUpload,
      serviceConfig: {
        mode: config.serviceConfig.mode,
        dnsConfigUrls: [...config.serviceConfig.dnsConfigUrls],
        hasCustomDnsConfigUrls: config.serviceConfig.hasCustomDnsConfigUrls,
        serverUrls: config.serviceConfig.serverUrls,
      },
      useFixedDeviceId: config.useFixedDeviceId,
      deviceId: config.deviceId,
      useReplacedMessageContents: config.useReplacedMessageContents,
      customDeviceName: config.customDeviceName,
      customOsPlatform: config.customOsPlatform,
      uiKitVersion: config.uiKitVersion,
      loginExtensionInfo: config.loginExtensionInfo,
      cacheEncryptionMode: config.cacheEncryptionMode,
      profileSync: { ...config.profileSync },
    };
    this.managerRegistry = new Map();
    this.managerCapabilities = new Map();
    this.eventHub = new EventHub();
    this.managerEventContext = {
      addEventHandler: (id, handlers): void => {
        // 注册事件处理器
        this.eventHub.addEventHandler(id, handlers);
      },
      removeEventHandler: (id): void => {
        // 移除事件处理器
        this.eventHub.removeEventHandler(id);
      },
      dispatch: (eventName, payload): void => {
        this.eventHub.dispatch(eventName, payload);
      },
    };
    this.userInfoHydrationQueue = new UserInfoHydrationQueue({
      windowMs: this.config.profileSync.userInfoWindowMs,
      batchSize: this.config.profileSync.userInfoBatchSize,
      onFlush: async (targets): Promise<void> => {
        await this.flushUserInfoHydrationTargets(targets);
      },
    });
    this.groupNamecardHydrationQueue = new GroupNamecardHydrationQueue({
      windowMs: this.config.profileSync.groupNamecardWindowMs,
      minWindowMs: GROUP_NAMECARD_HYDRATION_MIN_WINDOW_MS,
      maxBatchSize: GROUP_NAMECARD_HYDRATION_BATCH_SIZE,
      maxConcurrency: this.config.profileSync.groupNamecardMaxConcurrency,
      onFlushGroup: async (batch): Promise<void> => {
        await this.flushGroupNamecardHydrationBatch(batch);
      },
    });
    this.eventHub.addEventHandler('__internal:chat-client', {
      [ConnectionEventName.CONNECTING]: (payload: ConnectionEventPayload): void => {
        this.updateState(payload.state);
      },
      [ConnectionEventName.CONNECTED]: (payload: ConnectionEventPayload): void => {
        this.updateState(payload.state);
        void payload;
      },
      [ConnectionEventName.DISCONNECTED]: (payload: ConnectionEventPayload): void => {
        this.updateState(payload.state);
      },
      [ConnectionEventName.RECONNECT_FAILED]: (payload: ConnectionEventPayload): void => {
        this.updateState(payload.state);
      },
      [ChatEventName.MESSAGE]: (message: Message): void => {
        this.handleIncomingConversationMessage(message);
        this.handleIncomingMessageProfileSync(message);
      },
      [InternalEventName.MESSAGE_SENT]: (message: Message): void => {
        this.handleOutgoingConversationMessage(message);
      },
      [ContactEventName.ADDED]: (payload: ContactRosterEventPayload): void | Promise<void> => {
        return this.handleIncomingContactRosterEvent('add', payload);
      },
      [ContactEventName.AGREED]: (payload: ContactRosterEventPayload): void | Promise<void> => {
        return this.handleIncomingContactRosterEvent('add', payload);
      },
      [ContactEventName.INVITED]: (payload: ContactRosterEventPayload): void | Promise<void> => {
        return this.handleIncomingContactRosterEvent('none', payload);
      },
      [ContactEventName.REFUSE]: (payload: ContactRosterEventPayload): void | Promise<void> => {
        return this.handleIncomingContactRosterEvent('none', payload);
      },
      [ContactEventName.DELETED]: (payload: ContactRosterEventPayload): void | Promise<void> => {
        return this.handleIncomingContactRosterEvent('remove', payload);
      },
      [InternalEventName.GROUP_NOTIFY]: (payload: GroupRawNotifyEvent): void | Promise<void> => {
        return this.dispatchRawNotifyToCapability('rawNotify:group', {
          type: 'group',
          payload,
        });
      },
      [InternalEventName.CHATROOM_NOTIFY]: (
        payload: ChatRoomRawNotifyEvent
      ): void | Promise<void> => {
        return this.dispatchRawNotifyToCapability('rawNotify:chatroom', {
          type: 'chatroom',
          payload,
        });
      },
      [InternalEventName.CHAT_THREAD_NOTIFY]: (
        payload: ChatThreadRawNotifyEvent
      ): void | Promise<void> => {
        return this.dispatchRawNotifyToCapability('rawNotify:chatThread', {
          type: 'chatThread',
          payload,
        });
      },
      [InternalEventName.USER_INFO_NOTIFY]: (
        payload: UserInfoRawNotifyEvent
      ): void | Promise<void> => {
        return this.dispatchRawNotifyToCapability('rawNotify:userInfo', {
          type: 'userInfo',
          payload,
        });
      },
    });
  }

  /**
   * [zh-CN] 初始化 ChatClient 单例。首次调用会创建实例，后续以相同配置调用时复用同一个实例，并可追加注册管理器。
   * [en-US] Initializes the ChatClient singleton. The first call creates the instance; later calls with the same config reuse it and can register additional managers.
   *
   * @example [zh-CN] 初始化并注册管理器 [en-US] Initialize with managers
   * ```ts
   * const client = ChatClient.init({
   *   appKey: 'org#app',
   *   managers: [ChatManager, GroupManager],
   * });
   * ```
   * @param config - [zh-CN] 初始化配置，包含 appKey、服务接入参数与可选管理器列表。 [en-US] Initialization options including appKey, service access options, and optional managers.
   * @returns {WithManagers<ChatClient, Managers>} [zh-CN] 返回带已注册管理器类型增强的 ChatClient 实例。 [en-US] Returns the ChatClient instance enhanced with registered manager typings.
   */
  static init<Managers extends ReadonlyArray<ManagerRegistration<ChatClient>> = []>(
    config: Omit<InitConfig, 'managers'> & { managers?: Managers }
  ): WithManagers<ChatClient, Managers> {
    const validated = Validator.validateOrThrow(initConfigSchema, config);
    const customOsPlatform = validated.customOsPlatform;
    const normalizedServiceConfig = ChatClient.normalizeServiceConfig(validated.serviceConfig);
    const normalized: NormalizedInitConfig = {
      appKey: validated.appKey,
      enableUserInfoSync: validated.enableUserInfoSync ?? false,
      enableSyncData: ChatClient.normalizeSyncDataTypes(
        validated.enableSyncData ?? ['conversation']
      ),
      enableDeliveryReceipt: validated.enableDeliveryReceipt ?? false,
      syncConversationListConfig: {
        includeEmpty: validated.syncConversationListConfig?.includeEmpty ?? false,
        includeMark: true,
      },
      useCustomAttachmentUpload: validated.useCustomAttachmentUpload ?? false,
      serviceConfig: normalizedServiceConfig,
      useFixedDeviceId: validated.useFixedDeviceId ?? true,
      deviceId: validated.deviceId ?? 'webim',
      useReplacedMessageContents: validated.useReplacedMessageContents ?? false,
      customDeviceName: customOsPlatform !== undefined ? validated.customDeviceName : undefined,
      customOsPlatform,
      uiKitVersion: validated.uiKitVersion,
      loginExtensionInfo: validated.loginExtensionInfo,
      cacheEncryptionMode: 'auto',
      profileSync: {
        userInfoWindowMs: USER_INFO_HYDRATION_WINDOW_MS,
        userInfoBatchSize: USER_INFO_HYDRATION_BATCH_SIZE,
        groupNamecardWindowMs: GROUP_NAMECARD_HYDRATION_WINDOW_MS,
        groupNamecardMaxConcurrency: GROUP_NAMECARD_HYDRATION_MAX_CONCURRENCY,
      },
    };
    const managers = (config.managers ?? []) as Managers;

    if (ChatClient.instance) {
      if (!ChatClient.isSameConfig(ChatClient.instance.config, normalized)) {
        throw new ValidationError('ChatClient already initialized with different config', {
          code: ERROR_CODES.VALIDATION_INVALID_FORMAT,
          details: {
            fields: [
              {
                path: 'config',
                message: 'ChatClient already initialized with different config',
                rule: 'conflict',
              },
            ],
            current: ChatClient.instance.config,
            next: normalized,
          },
        });
      }
      if (managers.length > 0) {
        ChatClient.instance.registerManagers(managers);
      }
      ChatClient.instance.validateOptionalCapabilityDependencies();
      return ChatClient.instance as WithManagers<ChatClient, Managers>;
    }

    ChatClient.instance = new ChatClient(normalized);
    if (managers.length > 0) {
      ChatClient.instance.registerManagers(managers);
    }
    ChatClient.instance.validateOptionalCapabilityDependencies();
    return ChatClient.instance as WithManagers<ChatClient, Managers>;
  }

  /**
   * [zh-CN] 登录并建立到消息服务的长连接。登录成功后会恢复本地缓存、同步会话列表，并按配置触发联系人与资料同步。
   * [en-US] Logs in and establishes the long-lived connection to the messaging service. After success, local cache is restored, session list is synced, and configured contact/profile sync flows are triggered.
   *
   * @example [zh-CN] 登录 SDK [en-US] Log in to the SDK
   * ```ts
   * await client.login({
   *   userId: 'alice',
   *   token: 'your-im-token',
   * });
   * ```
   * @param params - [zh-CN] 登录参数，包含用户 ID 与 IM token。 [en-US] Login parameters including user ID and IM token.
   * @returns {Promise<void>} [zh-CN] 登录成功时 resolve，无返回业务数据。 [en-US] Resolves on successful login with no business payload.
   */
  async login(params: AuthContext): Promise<void> {
    if (ChatClient.instance !== this) {
      throw new ValidationError('ChatClient is not initialized', {
        code: ERROR_CODES.VALIDATION_REQUIRED,
        details: {
          fields: [
            {
              path: 'client',
              message: 'ChatClient is not initialized',
              rule: 'state',
            },
          ],
        },
      });
    }

    const auth = Validator.validateOrThrow(authContextSchema, params);
    if (this.state === ConnectionStatus.CONNECTING || this.state === ConnectionStatus.CONNECTED) {
      const isAnotherUserLoggedIn = this.currentUserId && this.currentUserId !== auth.userId;
      throw new ConnectionError(
        isAnotherUserLoggedIn
          ? 'Another user is already logged in'
          : 'ChatClient is already connecting or connected',
        {
          code: isAnotherUserLoggedIn
            ? ERROR_CODES.USER_ALREADY_LOGIN_ANOTHER
            : ERROR_CODES.AUTH_ALREADY_LOGIN,
          details: {
            stage: 'auth',
            ...(isAnotherUserLoggedIn
              ? {
                  currentUserId: this.currentUserId,
                  nextUserId: auth.userId,
                }
              : {}),
          },
        }
      );
    }
    const attemptId = ++this.loginAttempt;
    logger.warn('Login started', {
      userId: auth.userId,
      serviceConnectionMode: this.config.serviceConfig.mode,
      hasCustomDnsConfigUrls: this.config.serviceConfig.hasCustomDnsConfigUrls,
    });

    this.updateState(ConnectionStatus.CONNECTING);
    this.logReportEnabled = false; // 重置日志上报状态
    setLogReportEnabled(false); // 关闭上报定时器

    let websocketUrl: string; // WebSocket 地址
    let websocketUrls: string[] | undefined; // WebSocket 地址列表
    let restBaseUrl: string | undefined; // REST 基础地址
    let enableReportLogs = false; // DNS 日志上报开关
    if (this.config.serviceConfig.mode === 'dns') {
      try {
        const dnsResult = await resolveDnsConfig({
          appKey: this.config.appKey,
          baseUrls: this.config.serviceConfig.dnsConfigUrls,
        });
        logger.warn('DNS resolved for login', {
          baseUrl: dnsResult.baseUrl,
          websocketUrl: dnsResult.websocketUrl,
          syncWsCount: dnsResult.syncWebsocketUrls.length,
          restBaseUrl: dnsResult.restBaseUrl,
        });
        websocketUrl = dnsResult.websocketUrl;
        websocketUrls = dnsResult.websocketUrls; // 记录 DNS 解析的 ws 列表
        this.contactSyncWsUrls = dnsResult.syncWebsocketUrls; // 记录联系人同步地址列表
        this.syncConversationListConfigWsUrls = dnsResult.syncWebsocketUrls; // 记录会话列表同步地址列表
        this.contactSyncDnsResolved = true;
        restBaseUrl = dnsResult.restBaseUrl;
        enableReportLogs = dnsResult.dnsConfig.enableReportLogs === 'true'; // 解析日志开关
        logger.debug('DNS report switch resolved', { enabled: enableReportLogs }); // 记录 DNS 开关结果
      } catch (error) {
        this.updateState(ConnectionStatus.DISCONNECTED);
        throw error;
      }
    } else {
      const serverUrls = this.config.serviceConfig.serverUrls;
      if (!serverUrls?.wsUrl || !serverUrls.restApiUrl) {
        this.updateState(ConnectionStatus.DISCONNECTED);
        throw new ValidationError(
          'serviceConfig.serverUrls.restApiUrl and serviceConfig.serverUrls.wsUrl are required when serverUrls is configured',
          {
            code: ERROR_CODES.VALIDATION_REQUIRED,
            details: {
              fields: [
                {
                  path: 'serviceConfig.serverUrls.restApiUrl',
                  message:
                    'serviceConfig.serverUrls.restApiUrl is required when serverUrls is configured',
                  rule: 'required',
                },
                {
                  path: 'serviceConfig.serverUrls.wsUrl',
                  message:
                    'serviceConfig.serverUrls.wsUrl is required when serverUrls is configured',
                  rule: 'required',
                },
              ],
            },
          }
        );
      }
      websocketUrl = serverUrls.wsUrl;
      restBaseUrl = serverUrls.restApiUrl;
      this.contactSyncWsUrls = [];
      this.syncConversationListConfigWsUrls = serverUrls.syncWsUrl ? [serverUrls.syncWsUrl] : [];
      this.contactSyncDnsResolved = false;
    }

    updateLogReportContext({
      // 更新日志上报上下文
      restBaseUrl, // REST 基础地址
      appKey: this.config.appKey, // appKey
      userId: auth.userId, // 当前用户
      token: auth.token, // 访问 token
    });
    this.logReportEnabled = enableReportLogs; // 保存上报开关
    setLogReportEnabled(enableReportLogs); // 根据开关启动上报

    this.resetCore();
    this.platformAdapter = createPlatformAdapter(); // 初始化平台适配器

    if (attemptId !== this.loginAttempt) {
      const cancelError = new ConnectionError('Login cancelled', {
        code: ERROR_CODES.CONNECTION_CANCELLED,
        details: {
          stage: 'auth',
        },
      });
      this.updateState(ConnectionStatus.DISCONNECTED);
      throw cancelError;
    }

    this.core = new CoreSDK(
      {
        serverUrl: websocketUrl,
        serverUrls: websocketUrls,
        userId: auth.userId,
        token: auth.token,
        appKey: this.config.appKey,
        restBaseUrl,
        useReplacedMessageContents: this.config.useReplacedMessageContents,
        useCustomAttachmentUpload: this.config.useCustomAttachmentUpload,
        useFixedDeviceId: this.config.useFixedDeviceId,
        deviceId: this.config.deviceId,
        customDeviceName: this.config.customDeviceName,
        customOsPlatform: this.config.customOsPlatform,
        uiKitVersion: this.config.uiKitVersion,
        loginExtensionInfo: this.config.loginExtensionInfo,
        platformAdapter: this.platformAdapter,
        enableDeliveryReceipt: this.config.enableDeliveryReceipt,
      },
      this.eventHub
    );
    updateLogReportContext({ resource: this.core.getClientResource() }); // 更新设备资源标识

    try {
      logger.warn('Connecting core websocket', {
        serverUrl: websocketUrl,
        restBaseUrl,
        userId: auth.userId,
      });
      await this.core.connect(); // 建立连接
      logger.warn('Core websocket connected', {
        userId: auth.userId,
        resource: this.core.getClientResource(),
      });
      this.currentUserId = auth.userId; // 保存当前用户 ID
      this.restBaseUrl = restBaseUrl ?? null; // 保存 REST 基础地址
      this.authToken = auth.token; // 保存访问 token
      this.clientResource = this.core.getClientResource(); // 保存设备资源标识
      await this.initCacheManager(auth.userId); // 初始化缓存管理器
      logger.warn('Cache initialized after login', { userId: auth.userId });
      this.loadCachedConversations(); // 读取缓存会话并派发事件
      this.loadCachedUserInfo(); // 加载用户信息缓存到内存
      await this.syncSelfUserInfoAfterLogin();
      if (this.config.enableSyncData.includes('conversation')) {
        await this.refreshSessionList(this.config.syncConversationListConfig); // 035: 登录后优先同步新会话列表，并等待其结束后再继续后续同步
      }
      this.triggerConfiguredSyncDataAfterLogin(auth.userId);
      if (this.logReportEnabled) {
        // 检查是否开启上报
        try {
          // 捕获上报异常
          await reportLogsNow(); // 登录成功立即上报
        } catch (error) {
          // 上报失败处理
          logger.warn('Report logs on login failed', error); // 记录上报失败
        }
      }
    } catch (error) {
      this.resetCore();
      this.updateState(ConnectionStatus.DISCONNECTED);
      throw error;
    }
  }

  /**
   * [zh-CN] 登出并关闭当前连接，同时清理登录态、运行时缓存引用与日志上报状态。
   * [en-US] Logs out and closes the current connection, clearing authentication state, runtime cache references, and log-report status.
   *
   * @example [zh-CN] 登出 SDK [en-US] Log out from the SDK
   * ```ts
   * await client.logout();
   * ```
   * @returns {Promise<void>} [zh-CN] 登出完成时 resolve，无返回业务数据。 [en-US] Resolves when logout is finished with no business payload.
   */
  async logout(): Promise<void> {
    if (ChatClient.instance !== this) {
      throw new ValidationError('ChatClient is not initialized', {
        code: ERROR_CODES.VALIDATION_REQUIRED,
        details: {
          fields: [
            {
              path: 'client',
              message: 'ChatClient is not initialized',
              rule: 'state',
            },
          ],
        },
      });
    }

    this.loginAttempt += 1;

    if (!this.core) {
      this.contactSyncController?.cancel();
      this.contactSyncController = null;
      this.groupSyncController?.cancel();
      this.groupSyncController = null;
      this.syncWebSocketSession?.cancel('logout');
      this.syncWebSocketSession = null;
      this.syncConversationListConfigController = null;
      this.userInfoHydrationQueue.destroy();
      this.groupNamecardHydrationQueue.destroy();
      this.currentUserId = null; // 清理当前用户 ID
      this.restBaseUrl = null; // 清理 REST 基础地址
      this.authToken = null; // 清理 token
      this.clientResource = null; // 清理资源标识
      this.platformAdapter = null; // 清理平台适配器
      this.cacheManager = null; // 清理缓存管理器
      this.cacheUserId = null; // 清理缓存用户
      this.contactSyncWsUrls = []; // 清理联系人同步地址缓存
      this.syncConversationListConfigWsUrls = [];
      this.contactSyncDnsResolved = false;
      this.resetManagerSessionRuntimes();
      this.updateState(ConnectionStatus.DISCONNECTED);
      this.logReportEnabled = false; // 重置上报状态
      setLogReportEnabled(false); // 关闭上报开关
      stopLogReporter(); // 停止上报定时器
      return;
    }

    try {
      if (this.logReportEnabled) {
        // 判断是否需要上报
        try {
          // 捕获上报异常
          await reportLogsNow(); // 退出前立即上报
        } catch (error) {
          // 上报失败处理
          logger.warn('Report logs on logout failed', error); // 记录上报失败
        }
      }
      await this.core.disconnect();
    } finally {
      this.resetCore();
      this.updateState(ConnectionStatus.DISCONNECTED);
      this.logReportEnabled = false; // 重置上报状态
      setLogReportEnabled(false); // 关闭上报开关
      stopLogReporter(); // 停止上报定时器
    }
  }

  /**
   * [zh-CN] 获取当前连接状态。
   * [en-US] Gets the current connection state.
   *
   * @example [zh-CN] 读取连接状态 [en-US] Read connection state
   * ```ts
   * const state = client.getConnectionState();
   * ```
   * @returns {ConnectionState} [zh-CN] 返回当前连接状态枚举值。 [en-US] Returns the current connection-state enum value.
   */
  getConnectionState(): ConnectionState {
    return this.state;
  }

  /**
   * [zh-CN] 获取当前登录用户 ID。
   * [en-US] Gets the current logged-in user ID.
   *
   * @example [zh-CN] 读取当前登录用户 [en-US] Read current logged-in user
   * ```ts
   * const userId = client.getCurrentUserId();
   * ```
   * @returns {string | null} [zh-CN] 返回当前登录用户 ID；未登录时返回 `null`。 [en-US] Returns the current user ID, or `null` when not logged in.
   */
  getCurrentUserId(): string | null {
    return this.currentUserId; // 返回当前用户 ID
  }

  /**
   * [zh-CN] 获取当前连接的设备资源标识。
   * [en-US] Gets the device resource identifier of the current connection.
   *
   * @example [zh-CN] 读取当前设备资源标识 [en-US] Read current device resource
   * ```ts
   * const clientResource = client.getClientResource();
   * ```
   * @returns {string | null} [zh-CN] 返回当前连接的设备资源标识；未连接或尚未完成登录握手时返回 `null`。 [en-US] Returns the current device resource identifier, or `null` before connection/login handshake completes.
   */
  getClientResource(): string | null {
    return this.clientResource ?? this.core?.getClientResource() ?? null;
  }

  /**
   * @internal
   * [zh-CN] 提供消息创建包装层需要的内部配置。
   * [en-US] Provides internal options required by the message creation wrapper.
   */
  public getMessageCreationOptions(): { readonly useCustomAttachmentUpload: boolean } {
    return {
      useCustomAttachmentUpload: this.config.useCustomAttachmentUpload,
    };
  }

  /**
   * [zh-CN] 获取当前登录会话的 REST 访问上下文，供 SDK 公开模块或扩展能力复用统一鉴权与地址信息。
   * [en-US] Gets the REST access context for the current authenticated session so public SDK modules or extensions can reuse consistent auth and endpoint information.
   *
   * @example [zh-CN] 读取 REST 上下文 [en-US] Read REST context
   * ```ts
   * const context = client.getRestContext();
   * ```
   * @returns {RestContext} [zh-CN] 返回当前登录会话对应的 REST 上下文。 [en-US] Returns the REST context for the current authenticated session.
   */
  public getRestContext(): RestContext {
    // 获取 REST 上下文
    if (!this.restBaseUrl) {
      // 校验 REST 基础地址
      throw new ValidationError('restBaseUrl is required', {
        // 抛出校验错误
        code: ERROR_CODES.VALIDATION_REQUIRED, // 缺少必填字段
        details: {
          // 错误详情
          fields: [
            // 字段列表
            {
              // 字段错误
              path: 'restBaseUrl', // 字段路径
              message: 'restBaseUrl is required', // 错误提示
              rule: 'required', // 校验规则
            }, // 字段错误结束
          ], // 字段列表结束
        }, // 错误详情结束
      }); // 抛出校验错误结束
    } // REST 地址校验结束
    if (!this.authToken) {
      // 校验 token
      throw new ValidationError('token is required', {
        // 抛出校验错误
        code: ERROR_CODES.VALIDATION_REQUIRED, // 缺少必填字段
        details: {
          // 错误详情
          fields: [
            // 字段列表
            {
              // 字段错误
              path: 'token', // 字段路径
              message: 'token is required', // 错误提示
              rule: 'required', // 校验规则
            }, // 字段错误结束
          ], // 字段列表结束
        }, // 错误详情结束
      }); // 抛出校验错误结束
    } // token 校验结束
    if (!this.currentUserId) {
      // 校验用户 ID
      throw new ValidationError('userId is required', {
        // 抛出校验错误
        code: ERROR_CODES.VALIDATION_REQUIRED, // 缺少必填字段
        details: {
          // 错误详情
          fields: [
            // 字段列表
            {
              // 字段错误
              path: 'userId', // 字段路径
              message: 'userId is required', // 错误提示
              rule: 'required', // 校验规则
            }, // 字段错误结束
          ], // 字段列表结束
        }, // 错误详情结束
      }); // 抛出校验错误结束
    } // 用户 ID 校验结束
    const resource = this.clientResource ?? this.core?.getClientResource(); // 获取资源标识
    if (!resource) {
      // 校验资源标识
      throw new ValidationError('clientResource is required', {
        // 抛出校验错误
        code: ERROR_CODES.VALIDATION_REQUIRED, // 缺少必填字段
        details: {
          // 错误详情
          fields: [
            // 字段列表
            {
              // 字段错误
              path: 'clientResource', // 字段路径
              message: 'clientResource is required', // 错误提示
              rule: 'required', // 校验规则
            }, // 字段错误结束
          ], // 字段列表结束
        }, // 错误详情结束
      }); // 抛出校验错误结束
    } // 资源标识校验结束
    return {
      // 返回 REST 上下文
      restBaseUrl: this.restBaseUrl, // REST 基础地址
      appKey: this.config.appKey, // appKey
      userId: this.currentUserId, // 用户 ID
      token: this.authToken, // 访问 token
      clientResource: resource, // 设备资源标识
    }; // 返回结束
  }

  /**
   * [zh-CN] 更新当前登录会话的 IM token，并重置 token 生命周期提醒。
   * [en-US] Renews the IM token for the current authenticated session and resets token lifecycle timers.
   *
   * @example [zh-CN] 续期 IM token [en-US] Renew IM token
   * ```ts
   * const result = await client.renewToken(newToken);
   * ```
   * @param token - [zh-CN] 新 IM token。 [en-US] New IM token.
   * @returns {Promise<TokenRenewalResult>} [zh-CN] 返回已应用的新 token 与过期时间。 [en-US] Returns the applied token and its expiration time.
   */
  public async renewToken(token: string): Promise<TokenRenewalResult> {
    const nextToken = Validator.validateOrThrow(renewTokenSchema, token);
    if (!this.core || !this.currentUserId || this.state !== ConnectionStatus.CONNECTED) {
      throw new ConnectionError('ChatClient is not connected', {
        code: ERROR_CODES.AUTH_NOT_LOGIN,
        details: {
          stage: 'token',
          state: this.state,
        },
      });
    }

    const context = this.getRestContext();
    const tokenContext: RestContext = {
      ...context,
      token: nextToken,
    };
    const client = new RestClient(tokenContext.restBaseUrl, { errorMap: CORE_REST_ERROR_MAP });
    client.setAuthToken(nextToken);
    logger.warn('Renew token started', { userId: context.userId });
    const expireAt = await requestTokenExpireAt(client, tokenContext);
    if (expireAt <= Date.now()) {
      throw new ConnectionError('Token is expired', {
        code: ERROR_CODES.AUTH_TOKEN_EXPIRED,
        details: {
          stage: 'token',
        },
      });
    }

    const result = this.core.renewToken(nextToken, expireAt);
    this.authToken = nextToken;
    updateLogReportContext({ token: nextToken });
    logger.warn('Renew token succeeded', { userId: context.userId, expireAt });
    return result;
  }

  /**
   * [zh-CN] 获取当前用户的 RTC token 信息。
   * [en-US] Gets RTC token information for the current user.
   *
   * @example [zh-CN] 查询 RTC token [en-US] Query RTC token
   * ```ts
   * const rtc = await client.getRTCTokenInfo({ channelName: 'demo' });
   * ```
   * @param params - [zh-CN] RTC token 查询参数。 [en-US] RTC token query parameters.
   * @returns {Promise<RTCTokenInfo>} [zh-CN] 返回 RTC App ID、token、频道名、UID 与过期时间。 [en-US] Returns RTC app ID, token, channel name, UID, and expiration time.
   */
  public async getRTCTokenInfo(params?: GetRTCTokenInfoParams): Promise<RTCTokenInfo> {
    const normalizedParams = Validator.validateOrThrow(getRTCTokenInfoParamsSchema, params);
    const context = this.getRestContext();
    const client = new RestClient(context.restBaseUrl, { errorMap: CORE_REST_ERROR_MAP });
    client.setAuthToken(context.token);
    logger.warn('Get RTC token info started', {
      userId: context.userId,
      hasChannelName: Boolean(normalizedParams?.channelName),
    });
    return requestGetRTCTokenInfo(client, context, normalizedParams);
  }

  /**
   * [zh-CN] 批量查询 RTC UID 对应的 IM userId。
   * [en-US] Batch maps RTC UIDs to IM user IDs.
   *
   * @example [zh-CN] 查询 RTC UID 映射 [en-US] Query RTC UID mapping
   * ```ts
   * const users = await client.getUserIdsWithRTCUids([123456]);
   * ```
   * @param rtcUids - [zh-CN] RTC UID 列表。 [en-US] RTC UID list.
   * @returns {Promise<RTCUidUserIdMap>} [zh-CN] 返回 RTC UID 到 IM userId 的映射；未命中的 UID 不出现在结果中。 [en-US] Returns the RTC-UID-to-IM-userId map; unmatched UIDs are omitted.
   */
  public async getUserIdsWithRTCUids(rtcUids: ReadonlyArray<number>): Promise<RTCUidUserIdMap> {
    const normalizedRtcUids = Validator.validateOrThrow(rtcUidListSchema, rtcUids);
    const context = this.getRestContext();
    const client = new RestClient(context.restBaseUrl, { errorMap: CORE_REST_ERROR_MAP });
    client.setAuthToken(context.token);
    logger.warn('Get userIds with RTC UIDs started', {
      userId: context.userId,
      count: normalizedRtcUids.length,
    });
    return requestGetUserIdsWithRTCUids(client, context, normalizedRtcUids);
  }

  /**
   * [zh-CN] 获取当前用户在其他已登录设备上的登录 ID 列表。
   * [en-US] Gets login IDs of the current user on other signed-in devices.
   *
   * @example [zh-CN] 查询其他平台登录 ID [en-US] Query login IDs on other platforms
   * ```ts
   * const ids = await client.getSelfIdsOnOtherPlatform();
   * ```
   * @returns {Promise<SelfIdsOnOtherPlatform>} [zh-CN] 返回当前用户在其他设备上的 `userId/resource` 列表；当前设备会被自动过滤。 [en-US] Returns the `userId/resource` list of the current user on other devices; the current device is filtered out automatically.
   */
  public async getSelfIdsOnOtherPlatform(): Promise<SelfIdsOnOtherPlatform> {
    const context = this.getRestContext();
    const client = new RestClient(context.restBaseUrl, { errorMap: CORE_REST_ERROR_MAP });
    client.setAuthToken(context.token);
    logger.warn('Get self ids on other platform started', {
      userId: context.userId,
      clientResource: context.clientResource,
    });
    return requestGetSelfIdsOnOtherPlatform(client, context);
  }

  /**
   * [zh-CN] 获取当前会话绑定的缓存管理器实例。
   * [en-US] Gets the cache-manager instance bound to the current session.
   *
   * @example [zh-CN] 读取缓存管理器 [en-US] Read cache manager
   * ```ts
   * const cacheManager = client.getCacheManager();
   * ```
   * @returns {CacheManager | null} [zh-CN] 返回缓存管理器；未登录或缓存未初始化时返回 `null`。 [en-US] Returns the cache manager, or `null` when not logged in or cache is not initialized.
   */
  public getCacheManager(): CacheManager | null {
    // 获取缓存管理器
    return this.cacheManager; // 返回缓存管理器
  } // 获取缓存管理器结束

  /**
   * @internal
   * [zh-CN] 按能力查询已注册 Manager。核心只返回显式注册的能力，不会隐式创建 Manager。
   * [en-US] Gets a registered manager by capability. Core only returns explicit registrations and never creates optional managers implicitly.
   */
  public getManagerByCapability(
    capability: ManagerCapability
  ): ManagerBase<ChatClient> | undefined {
    return this.managerCapabilities.get(capability);
  }

  /**
   * [zh-CN] 获取当前平台适配层暴露的上传适配器。
   * [en-US] Gets the upload adapter exposed by the current platform adapter.
   *
   * @example [zh-CN] 读取上传适配器 [en-US] Read upload adapter
   * ```ts
   * const uploadAdapter = client.getUploadAdapter();
   * ```
   * @returns {UploadAdapter | null} [zh-CN] 返回上传适配器；当前平台未提供时返回 `null`。 [en-US] Returns the upload adapter, or `null` when the current platform does not provide one.
   */
  public getUploadAdapter(): UploadAdapter | null {
    return this.platformAdapter?.upload ?? null;
  }

  /**
   * @internal
   * [zh-CN] 向内部事件总线注入事件，仅供 SDK 内部桥接使用。
   * [en-US] Dispatches an event into the internal event bus and is intended for SDK-internal bridging only.
   */
  public addInternalEvent<K extends keyof import('./types/event-system').EventPayloadMap>(
    eventName: K,
    payload: import('./types/event-system').EventPayloadMap[K]
  ): void {
    this.eventHub.dispatch(eventName, payload);
  }

  /**
   * @internal
   * [zh-CN] 主动刷新会话列表。SDK 会根据当前能力状态决定走新同步链路还是兼容回退链路。
   * [en-US] Actively refreshes the session list. The SDK chooses the new sync path or the compatibility fallback path based on current capability state.
   *
   * @example [zh-CN] 刷新会话列表 [en-US] Refresh session list
   * ```ts
   * const sessions = await client.refreshSessionList({
   *   includeEmpty: false,
   * });
   * ```
   * @param params - [zh-CN] 刷新参数，控制是否拉取空会话；会话标记固定拉取。 [en-US] Refresh options controlling whether empty sessions are requested; session marks are always requested.
   * @returns {Promise<ReadonlyArray<ConversationItem>>} [zh-CN] 返回刷新后的会话列表。 [en-US] Returns the refreshed conversation list.
   */
  public refreshSessionList(
    params?: RefreshSessionListParams
  ): Promise<ReadonlyArray<ConversationItem>> {
    if (!this.cacheManager || !this.currentUserId) {
      return Promise.resolve([]);
    }
    // 035：refreshSessionList 是新会话列表的主动刷新入口；是否走新链路或旧链路回退，
    // 统一交给 SessionListSyncController 决策。
    return this.ensureSessionListSyncController()
      .refresh({
        includeEmpty: params?.includeEmpty ?? this.config.syncConversationListConfig.includeEmpty,
        includeMark: true,
      })
      .then(items => {
        this.enqueueMissingGroupSessionSenderUserInfos(items);
        return items.map(item => ({ ...item }));
      });
  }

  /**
   * [zh-CN] 获取当前固定服务地址配置；仅在使用 `serviceConfig.serverUrls` 初始化时有值。
   * [en-US] Gets the current fixed-service endpoint configuration. It is defined only when the client was initialized with `serviceConfig.serverUrls`.
   *
   * @example [zh-CN] 读取固定服务地址配置 [en-US] Read fixed service configuration
   * ```ts
   * const serverUrls = client.getServerUrlsConfig();
   * ```
   * @returns {ServerUrlsConfig | undefined} [zh-CN] 返回固定服务地址配置；未配置时返回 `undefined`。 [en-US] Returns the fixed service configuration, or `undefined` when not configured.
   */
  public getServerUrlsConfig(): ServerUrlsConfig | undefined {
    return this.config.serviceConfig.serverUrls;
  }

  /**
   * @internal
   * [zh-CN] 获取带鉴权参数的会话列表同步 WebSocket 地址列表。
   * [en-US] Gets session-list sync WebSocket URLs with authentication parameters attached.
   */
  public getSessionListSyncWsUrls(): ReadonlyArray<string> {
    const configuredSyncWsUrl = this.config.serviceConfig.serverUrls?.syncWsUrl;
    if (configuredSyncWsUrl) {
      return this.buildAuthenticatedSessionListSyncUrls([configuredSyncWsUrl]);
    }
    return this.buildAuthenticatedSessionListSyncUrls(this.syncConversationListConfigWsUrls);
  }

  /**
   * @internal
   * [zh-CN] 获取登录会话内共享的数据同步 WebSocket 会话。
   * [en-US] Gets the shared data-sync WebSocket session for the current login session.
   */
  public getSharedSyncWebSocketSession(): SharedSyncWebSocketSession {
    if (this.syncWebSocketSession) {
      return this.syncWebSocketSession;
    }
    this.syncWebSocketSession = new SharedSyncWebSocketSession({
      getUrls: async (): Promise<ReadonlyArray<string>> => {
        const sessionListUrls = this.getSessionListSyncWsUrls();
        if (sessionListUrls.length > 0) {
          return sessionListUrls;
        }
        return await this.resolveContactSyncUrls();
      },
    });
    return this.syncWebSocketSession;
  }

  /**
   * @internal
   * [zh-CN] 判断当前会话列表能力是否允许进行 DNS 探测。
   * [en-US] Indicates whether session-list capability probing through DNS is available.
   */
  public isSessionListDnsProbeAvailable(): boolean {
    return this.config.serviceConfig.mode === 'dns';
  }

  /**
   * @internal
   * [zh-CN] 获取会话列表同步能力状态。
   * [en-US] Gets the session-list sync capability state.
   */
  public getSessionListSyncCapabilityState():
    | import('./cache/cache-types').SessionListCapabilityState
    | null {
    return this.syncConversationListConfigController?.getCapabilityState() ?? null;
  }

  /**
   * @internal
   * [zh-CN] 标记指定会话被访问，用于缓存层更新访问时间。
   * [en-US] Marks specified conversations as accessed so the cache layer can update access timestamps.
   */
  public markConversationAccess(
    targets: ReadonlyArray<{ conversationId: string; type: ConversationType }>
  ): void {
    this.cacheManager?.markConversationAccess(targets);
  }

  private handleIncomingConversationMessage(message: Message): void {
    if (!this.cacheManager) {
      return;
    }
    this.cacheManager.applyIncomingMessageToConversations(message);
    const sessionListResult = this.cacheManager.applyIncomingMessageToSessionList(message);
    if (sessionListResult.changed) {
      this.emitConversationListUpdate('message');
    }
  }

  private handleOutgoingConversationMessage(message: Message): void {
    if (!this.cacheManager) {
      return;
    }
    this.cacheManager.applyIncomingMessageToConversations(message);
    const sessionListResult = this.cacheManager.applyIncomingMessageToSessionList(message);
    if (sessionListResult.changed) {
      this.emitConversationListUpdate('message');
    }
  }

  /**
   * [zh-CN] 获取当前联系人快照缓存。
   * [en-US] Gets the current cached contact snapshot.
   *
   * @example [zh-CN] 读取联系人快照 [en-US] Read contact snapshot
   * ```ts
   * const snapshot = client.getContactSnapshot();
   * ```
   * @returns {ContactSnapshot | null} [zh-CN] 返回联系人快照；缓存未初始化时返回 `null`。 [en-US] Returns the contact snapshot, or `null` when cache is not initialized.
   */
  public getContactSnapshot(): ContactSnapshot | null {
    if (!this.cacheManager) {
      return null;
    }
    return this.cacheManager.loadContactSnapshot('cache');
  }

  private handleIncomingContactRosterEvent(
    action: 'add' | 'remove' | 'none',
    payload: ContactRosterEventPayload
  ): Promise<void> | void {
    const targetUserId = this.resolveContactRosterTargetUserId(payload);
    if (!targetUserId) {
      return;
    }

    if (this.cacheManager && this.currentUserId && action !== 'none') {
      this.cacheManager.applyContactRosterNotice({
        action,
        userId: targetUserId,
        rosterVersion: payload.rosterVersion,
      });
    }

    return this.hydrateContactRosterPayload(payload, targetUserId, action !== 'remove');
  }

  private resolveContactRosterTargetUserId(payload: ContactRosterEventPayload): string | null {
    const currentUserId = this.currentUserId;
    if (!currentUserId) {
      return null;
    }

    if (payload.from === currentUserId && payload.to !== currentUserId) {
      return payload.to;
    }
    if (payload.to === currentUserId && payload.from !== currentUserId) {
      return payload.from;
    }
    if (payload.from && payload.from !== currentUserId) {
      return payload.from;
    }
    if (payload.to && payload.to !== currentUserId) {
      return payload.to;
    }
    return null;
  }

  private async hydrateContactRosterPayload(
    payload: ContactRosterEventPayload,
    targetUserId: string,
    allowFetch: boolean
  ): Promise<void> {
    const userInfo = await resolveSingleContactUserInfo(targetUserId, {
      cacheManager: this.cacheManager,
      fetchUserInfos: allowFetch
        ? async ({ userIds }): Promise<ReadonlyArray<UserInfo>> => {
            return await this.fetchContactEventUserInfos(userIds);
          }
        : undefined,
    });

    (payload as { userInfo: UserInfo }).userInfo = userInfo;
  }

  private async fetchContactEventUserInfos(
    userIds: ReadonlyArray<string>
  ): Promise<ReadonlyArray<UserInfo>> {
    if (userIds.length === 0) {
      return [];
    }

    const manager = this.getUserInfoReadCapability();
    if (!manager) {
      return [];
    }

    try {
      return await manager.getUserInfoByUserId({
        userIds,
      });
    } catch (error) {
      logger.warn('Contact roster event user info fetch failed', {
        userIds,
        error,
      });
      return [];
    }
  }

  private isMessageProfileSyncEnabled(): boolean {
    return this.config.enableUserInfoSync;
  }

  /**
   * @internal
   * [zh-CN] 判断是否启用了用户资料同步增强能力。
   * [en-US] Indicates whether enhanced user-profile sync is enabled.
   */
  public isUserInfoSyncEnabled(): boolean {
    return this.config.enableUserInfoSync;
  }

  private async syncSelfUserInfoAfterLogin(): Promise<void> {
    if (!this.isMessageProfileSyncEnabled() || !this.currentUserId) {
      return;
    }

    const manager = this.getUserInfoReadCapability();
    if (!manager) {
      return;
    }

    try {
      const userInfos = await manager.getUserInfoByUserId({
        userIds: [this.currentUserId],
      });
      if (userInfos.length === 0) {
        logger.warn('Self user info sync returned empty result after login', {
          userId: this.currentUserId,
        });
      }
    } catch (error) {
      logger.warn('Self user info sync failed after login', {
        userId: this.currentUserId,
        error,
      });
    }
  }

  private handleIncomingMessageProfileSync(message: Message): void {
    if (message.direct !== 'RECEIVE' || !this.isMessageProfileSyncEnabled()) {
      return;
    }
    const sidecar = getMessageProfileVersionSidecar(message);
    const senderId = message.sender.userId;
    if (!senderId || !this.cacheManager) {
      return;
    }

    const cachedUserInfo = this.cacheManager.getUserInfoSummaries([senderId], false)[0];
    if (cachedUserInfo) {
      message.sender = {
        userId: senderId,
        nickname: cachedUserInfo.nickname ?? message.sender.nickname,
        avatarUrl: cachedUserInfo.avatarUrl ?? message.sender.avatarUrl,
      };
    }

    if (typeof sidecar?.userInfoUpdateTime === 'number') {
      if (
        this.shouldHydrateUserInfo(cachedUserInfo?.userInfoUpdateTime, sidecar.userInfoUpdateTime)
      ) {
        this.userInfoHydrationQueue.enqueue(senderId, sidecar.userInfoUpdateTime);
      }
    } else if (!cachedUserInfo) {
      this.userInfoHydrationQueue.enqueue(senderId);
    }

    if (message.conversationType !== 'groupChat') {
      return;
    }

    const cachedGroupNamecard = this.cacheManager.getGroupNamecard(
      message.conversationId,
      senderId,
      false
    );
    if (typeof sidecar?.namecardUpdateTime === 'number') {
      if (
        this.shouldHydrateGroupNamecard(
          cachedGroupNamecard?.namecardUpdateTime,
          sidecar.namecardUpdateTime
        )
      ) {
        this.groupNamecardHydrationQueue.enqueue(
          message.conversationId,
          senderId,
          sidecar.namecardUpdateTime
        );
      }
    } else if (!cachedGroupNamecard) {
      this.groupNamecardHydrationQueue.enqueue(message.conversationId, senderId);
    }
  }

  private attachOutgoingMessageProfileVersions(message: Message): void {
    if (!this.isMessageProfileSyncEnabled()) {
      clearMessageProfileVersionSidecar(message);
      return;
    }

    const sidecar = {
      userInfoUpdateTime: this.resolveCurrentUserInfoUpdateTime(),
      namecardUpdateTime:
        message.conversationType === 'groupChat'
          ? this.resolveCurrentGroupNamecardUpdateTime(message.conversationId)
          : undefined,
    };
    setMessageProfileVersionSidecar(message, sidecar);
  }

  private resolveCurrentUserInfoUpdateTime(): number | undefined {
    if (!this.cacheManager || !this.currentUserId) {
      return undefined;
    }
    return this.cacheManager.getUserInfoSummaries([this.currentUserId], false)[0]
      ?.userInfoUpdateTime;
  }

  private resolveCurrentGroupNamecardUpdateTime(groupId: string): number | undefined {
    if (!this.cacheManager || !this.currentUserId) {
      return undefined;
    }
    return this.cacheManager.getGroupNamecard(groupId, this.currentUserId, false)
      ?.namecardUpdateTime;
  }

  private shouldHydrateUserInfo(
    cachedVersion: number | undefined,
    incomingVersion: number
  ): boolean {
    return typeof cachedVersion !== 'number' || cachedVersion < incomingVersion;
  }

  private shouldHydrateGroupNamecard(
    cachedVersion: number | undefined,
    incomingVersion: number
  ): boolean {
    return typeof cachedVersion !== 'number' || cachedVersion < incomingVersion;
  }

  private async flushUserInfoHydrationTargets(
    targets: ReadonlyArray<UserInfoHydrationTarget>
  ): Promise<void> {
    const manager = this.getUserInfoReadCapability();
    if (!manager || targets.length === 0) {
      return;
    }
    const userIds = targets.map(item => item.userId);
    let userInfos: ReadonlyArray<UserInfo>;
    try {
      userInfos = await manager.getUserInfoByUserId({ userIds });
    } catch (error) {
      logger.warn('User info hydration failed', {
        userIds,
        error,
      });
      return;
    }

    const selfUserId = this.currentUserId;
    const selfUserInfo = selfUserId
      ? userInfos.find(item => item.userId === selfUserId)
      : undefined;
    const otherUserInfos = userInfos.filter(item => item.userId !== selfUserId);
    if (selfUserInfo) {
      this.dispatchOwnInfoUpdated(selfUserInfo);
    }
    if (otherUserInfos.length > 0) {
      this.dispatchUserInfoUpdated(otherUserInfos);
    }
    if (userInfos.length > 0) {
      this.refreshConversationDisplayFromUserInfos(
        userInfos.map(item => ({ userId: item.userId })),
        'profile'
      );
    }

    const fetchedUserIds = new Set(userInfos.map(item => item.userId));
    const missingUserIds = userIds.filter(userId => !fetchedUserIds.has(userId));
    if (missingUserIds.length > 0) {
      logger.warn('User info hydration returned partial result', {
        requestedUserIds: userIds,
        missingUserIds,
      });
    }
  }

  private async flushGroupNamecardHydrationBatch(
    batch: GroupNamecardHydrationBatch
  ): Promise<void> {
    const manager = this.getGroupNamecardHydrationCapability();
    if (!manager || batch.targets.length === 0) {
      return;
    }
    try {
      await manager.hydrateMessageProfileGroupNamecards(batch.groupId, batch.targets);
    } catch (error) {
      logger.warn('Group namecard hydration returned partial result', {
        groupId: batch.groupId,
        requestedUserIds: batch.targets.map(item => item.userId),
        error,
      });
    }
  }

  /**
   * @internal
   * [zh-CN] 受控刷新联系人快照，复用 024 联系人同步控制器。
   * [en-US] Refreshes the contact snapshot in a controlled way by reusing the 024 contact sync controller.
   */
  public async refreshContactSnapshot(): Promise<void> {
    if (!this.cacheManager || !this.currentUserId) {
      return;
    }

    const controller = this.ensureContactSyncController();
    await controller.sync();
  }

  /**
   * [zh-CN] 注册 ChatClient 事件处理器，用于监听连接、消息、联系人、群组等 SDK 公开事件。
   * [en-US] Registers ChatClient event handlers for public SDK events such as connection, message, contact, and group events.
   *
   * @example [zh-CN] 监听连接状态变化 [en-US] Listen for connection-state changes
   * ```ts
   * client.addEventHandler('client-events', {
   *   onConnected: () => console.log('connected'),
   * });
   * ```
   * @param id - [zh-CN] 事件处理器唯一 ID，用于后续移除。 [en-US] Unique handler ID used for later removal.
   * @param handlers - [zh-CN] 事件处理器集合，按需实现对应回调。 [en-US] Handler collection with callbacks implemented as needed.
   * @returns {void} [zh-CN] 注册完成后无返回值。 [en-US] Returns nothing after registration.
   */
  addEventHandler(id: EventHandlerId, handlers: EventHandlerMap): void {
    this.eventHub.addEventHandler(id, handlers);
  }

  /**
   * [zh-CN] 移除指定的 ChatClient 事件处理器。
   * [en-US] Removes the specified ChatClient event handler set.
   *
   * @example [zh-CN] 移除事件处理器 [en-US] Remove event handlers
   * ```ts
   * client.removeEventHandler('client-events');
   * ```
   * @param id - [zh-CN] 待移除的事件处理器 ID。 [en-US] Handler ID to remove.
   * @returns {void} [zh-CN] 移除完成后无返回值。 [en-US] Returns nothing after removal.
   */
  removeEventHandler(id: EventHandlerId): void {
    this.eventHub.removeEventHandler(id);
  }

  /**
   * [zh-CN] 注册一个管理器构造器，并返回带该管理器类型增强的 ChatClient 实例。
   * [en-US] Registers a manager constructor and returns the ChatClient instance enhanced with that manager typing.
   *
   * @example [zh-CN] 手动注册管理器 [en-US] Register a manager manually
   * ```ts
   * const client = ChatClient.init({ appKey: 'org#app' }).use(ChatManager);
   * ```
   * @param ManagerCtor - [zh-CN] 管理器构造器。 [en-US] Manager constructor.
   * @returns {WithManager<this, Key, Manager>} [zh-CN] 返回带管理器类型增强的当前 ChatClient 实例。 [en-US] Returns the current ChatClient instance enhanced with the manager typing.
   */
  public use<Manager extends ManagerBase<ChatClient>, Key extends string>(
    ManagerCtor: ManagerConstructor<ChatClient, Manager, Key>
  ): WithManager<this, Key, Manager> {
    if (ChatClient.instance !== this) {
      throw new ValidationError('ChatClient is not initialized', {
        code: ERROR_CODES.VALIDATION_REQUIRED,
        details: {
          fields: [
            {
              path: 'client',
              message: 'ChatClient is not initialized',
              rule: 'state',
            },
          ],
        },
      });
    }

    this.registerManagerConstructor(ManagerCtor);
    return this as WithManager<this, Key, Manager>;
  }

  /**
   * [zh-CN] 发送消息。消息通常应通过 `ChatManager` 或 `create*Message` 系列方法先构造，再交给此方法发送。
   * [en-US] Sends a message. The message is typically created first through `ChatManager` or one of the `create*Message` helpers and then passed to this method.
   *
   * @example [zh-CN] 发送消息 [en-US] Send a message
   * ```ts
   * const sent = await client.sendMessage(message);
   * ```
   * @param message - [zh-CN] 待发送的消息对象。 [en-US] Message object to send.
   * @param options - [zh-CN] 可选发送参数，如进度回调等。 [en-US] Optional send options such as progress callbacks.
   * @returns {Promise<Message>} [zh-CN] 返回发送流程处理后的消息对象。 [en-US] Returns the message object after the send pipeline completes.
   */
  async sendMessage(message: Message, options?: SendMessageOptions): Promise<Message> {
    if (ChatClient.instance !== this) {
      throw new ValidationError('ChatClient is not initialized', {
        code: ERROR_CODES.VALIDATION_REQUIRED,
        details: {
          fields: [
            {
              path: 'client',
              message: 'ChatClient is not initialized',
              rule: 'state',
            },
          ],
        },
      });
    }

    if (!message?.sender?.userId) {
      throw new ValidationError('sender.userId is required', {
        code: ERROR_CODES.VALIDATION_REQUIRED,
        details: {
          fields: [
            {
              path: 'sender.userId',
              message: 'sender.userId is required',
              rule: 'required',
            },
          ],
        },
      });
    }

    if (this.currentUserId && message.sender.userId !== this.currentUserId) {
      throw new ValidationError('sender.userId does not match current user', {
        code: ERROR_CODES.VALIDATION_INVALID_FORMAT,
        details: {
          fields: [
            {
              path: 'sender.userId',
              message: 'sender.userId does not match current user',
              rule: 'conflict',
            },
          ],
        },
      });
    }

    if (isStreamMessage(message)) {
      throw new MessageSendError('Stream message send is not supported', {
        code: ERROR_CODES.STREAM_SEND_NOT_SUPPORTED,
        details: {
          msgLocalId: message.msgLocalId,
        },
      });
    }

    if (!this.core || this.state !== ConnectionStatus.CONNECTED) {
      throw new MessageSendError('ChatClient is not connected', {
        code: ERROR_CODES.MESSAGE_NOT_CONNECTED,
        details: {
          state: this.state,
        },
      });
    }

    this.attachOutgoingMessageProfileVersions(message);
    return this.core.sendMessage(message, options);
  }

  /**
   * @internal
   * [zh-CN] 派发当前用户资料更新事件。
   * [en-US] Dispatches the current-user profile updated event.
   */
  public dispatchOwnInfoUpdated(userInfo: UserInfo): void {
    this.eventHub.dispatch('onOwnInfoUpdated', userInfo);
  }

  /**
   * @internal
   * [zh-CN] 派发批量用户资料更新事件。
   * [en-US] Dispatches the batch user-profile updated event.
   */
  public dispatchUserInfoUpdated(userInfos: ReadonlyArray<UserInfo>): void {
    if (userInfos.length === 0) {
      return;
    }
    this.eventHub.dispatch('onUserInfoUpdated', [...userInfos]);
  }

  /**
   * @internal
   * [zh-CN] 根据用户资料变化刷新本地会话列表展示字段。
   * [en-US] Refreshes local conversation-list display fields from user-profile changes.
   */
  public refreshConversationDisplayFromUserInfos(
    targets: ReadonlyArray<{ readonly userId: string; readonly lastModified?: number }>,
    reason: ConversationListUpdateReason = 'profile'
  ): void {
    if (!this.cacheManager || targets.length === 0) {
      return;
    }
    const result = this.cacheManager.refreshSessionListDisplayFromUserInfos(targets);
    if (result.changed) {
      this.emitConversationListUpdate(reason);
    }
  }

  /**
   * @internal
   * [zh-CN] 根据已加入群组同步结果刷新本地群会话展示字段。
   * [en-US] Refreshes local group-conversation display fields from joined-group sync results.
   */
  public refreshConversationDisplayFromJoinedGroups(
    groups: ReadonlyArray<import('./types/group').JoinedGroupSummary>,
    reason: ConversationListUpdateReason = 'profile'
  ): void {
    if (!this.cacheManager || groups.length === 0) {
      return;
    }
    const result = this.cacheManager.refreshSessionListDisplayFromJoinedGroups(
      groups.map(group => ({
        groupId: group.groupId,
        name: group.name,
        avatarUrl: group.avatarUrl,
        remindType: group.remindType,
      }))
    );
    if (result.changed) {
      this.emitConversationListUpdate(reason);
    }
  }

  private enqueueMissingGroupSessionSenderUserInfos(
    items: ReadonlyArray<ConversationItem>
  ): void {
    if (!this.isMessageProfileSyncEnabled() || !this.cacheManager || items.length === 0) {
      return;
    }
    const senderIds = new Set<string>();
    for (const item of items) {
      const sender = item.conversationType === 'groupChat' ? item.lastMessage?.sender : null;
      if (!sender?.userId || (sender.nickname && sender.avatarUrl)) {
        continue;
      }
      senderIds.add(sender.userId);
    }
    if (senderIds.size === 0) {
      return;
    }

    const cachedUserInfos = this.cacheManager.getUserInfoSummaries([...senderIds], false);
    const hydratedUserIds = new Set(cachedUserInfos.map(item => item.userId));
    for (const userId of senderIds) {
      if (!hydratedUserIds.has(userId)) {
        this.userInfoHydrationQueue.enqueue(userId);
      }
    }
  }

  /**
   * @internal
   * [zh-CN] 派发用户群名片更新事件。
   * [en-US] Dispatches the user group-namecard updated event.
   */
  public dispatchUserGroupNamecardUpdated(groupId: string, userId: string, namecard: string): void {
    if (!groupId || !userId) {
      return;
    }
    this.eventHub.dispatch(GroupEventName.USER_GROUP_NAMECARD_UPDATED, {
      groupId,
      userId,
      namecard,
    });
  }

  protected async downloadAndParseCombinePayload(
    params: DownloadCombineMessageParams
  ): Promise<ReadonlyArray<Message>> {
    if (ChatClient.instance !== this) {
      throw new ValidationError('ChatClient is not initialized', {
        code: ERROR_CODES.VALIDATION_REQUIRED,
        details: {
          fields: [
            {
              path: 'client',
              message: 'ChatClient is not initialized',
              rule: 'state',
            },
          ],
        },
      });
    }

    if (!this.core) {
      throw new ValidationError('ChatClient is not connected', {
        code: ERROR_CODES.AUTH_NOT_LOGIN,
        details: {
          fields: [
            {
              path: 'core',
              message: 'ChatClient is not connected',
              rule: 'state',
            },
          ],
        },
      });
    }

    return this.core.downloadAndParseCombineMessage(params);
  }

  /**
   * @internal
   * [zh-CN] 发送消息 action 请求，例如已读、Reaction、Thread 相关的 ACK 驱动操作。
   * [en-US] Sends a message-action request such as ACK-driven operations for read state, reactions, or threads.
   *
   * @example [zh-CN] 发送消息 action [en-US] Send a message action
   * ```ts
   * const result = await client.sendMessageAction(actionRequest);
   * ```
   * @param action - [zh-CN] 消息 action 请求体。 [en-US] Message-action request payload.
   * @param createAckError - [zh-CN] 可选 ACK 错误构造器，用于自定义 ACK 失败错误。 [en-US] Optional ACK-error factory for customizing ACK failure errors.
   * @returns {Promise<ActionAckResult>} [zh-CN] 返回消息 action 的 ACK 结果。 [en-US] Returns the ACK result of the message action.
   */
  public async sendMessageAction(
    action: MessageActionRequest,
    createAckError?: (statusCode: number, reason?: string) => Error
  ): Promise<ActionAckResult> {
    if (ChatClient.instance !== this) {
      throw new ValidationError('ChatClient is not initialized', {
        code: ERROR_CODES.VALIDATION_REQUIRED,
      });
    }
    if (!this.core) {
      throw new ValidationError('ChatClient is not connected', {
        code: ERROR_CODES.AUTH_NOT_LOGIN,
      });
    }

    return this.core.sendMessageAction(action, createAckError);
  }

  /**
   * @internal
   * [zh-CN] 发送聊天室 action 请求，用于聊天室内的 ACK 驱动操作。
   * [en-US] Sends a chatroom-action request for ACK-driven operations within a chat room.
   *
   * @example [zh-CN] 发送聊天室 action [en-US] Send a chatroom action
   * ```ts
   * const result = await client.sendChatRoomOperation(request);
   * ```
   * @param request - [zh-CN] 聊天室 action 请求体。 [en-US] Chatroom-action request payload.
   * @param createAckError - [zh-CN] 可选 ACK 错误构造器，用于自定义 ACK 失败错误。 [en-US] Optional ACK-error factory for customizing ACK failure errors.
   * @returns {Promise<ActionAckResult>} [zh-CN] 返回聊天室 action 的 ACK 结果。 [en-US] Returns the ACK result of the chatroom action.
   */
  public async sendChatRoomOperation(
    request: ChatRoomOperationRequest,
    createAckError?: (statusCode: number, reason?: string) => Error
  ): Promise<ActionAckResult> {
    if (ChatClient.instance !== this) {
      throw new ValidationError('ChatClient is not initialized', {
        code: ERROR_CODES.VALIDATION_REQUIRED,
      });
    }
    if (!this.core) {
      throw new ValidationError('ChatClient is not connected', {
        code: ERROR_CODES.AUTH_NOT_LOGIN,
      });
    }

    return this.core.sendChatRoomOperation(request, createAckError);
  }

  /**
   * @internal
   * [zh-CN] 下载消息附件。
   * [en-US] Downloads the attachment of a message.
   *
   * @example [zh-CN] 下载消息附件 [en-US] Download a message attachment
   * ```ts
   * const file = await client.downloadAttachment(message);
   * ```
   * @param message - [zh-CN] 包含附件信息的消息对象。 [en-US] Message object containing attachment metadata.
   * @returns {Promise<MessageAttachmentDownloadResult>} [zh-CN] 返回附件下载结果。 [en-US] Returns the attachment download result.
   */
  public async downloadAttachment(message: Message): Promise<MessageAttachmentDownloadResult> {
    if (ChatClient.instance !== this) {
      throw new ValidationError('ChatClient is not initialized', {
        code: ERROR_CODES.VALIDATION_REQUIRED,
      });
    }
    if (!this.core) {
      throw new ValidationError('ChatClient is not connected', {
        code: ERROR_CODES.AUTH_NOT_LOGIN,
      });
    }
    return this.core.downloadAttachment(message);
  }

  /**
   * @internal
   * [zh-CN] 解析服务端消息元数据载荷为标准消息对象。
   * [en-US] Decodes server message metadata payload into a normalized message object.
   *
   * @example [zh-CN] 解析服务端消息元数据 [en-US] Decode server message metadata
   * ```ts
   * const message = client.decodeServerMessageMeta(metaPayload);
   * ```
   * @param metaPayload - [zh-CN] 服务端下发的消息元数据二进制载荷。 [en-US] Binary payload of server-delivered message metadata.
   * @returns {Message | null} [zh-CN] 返回解析后的消息对象；无法解析时返回 `null`。 [en-US] Returns the decoded message object, or `null` when decoding fails.
   */
  public decodeServerMessageMeta(metaPayload: Uint8Array): Message | null {
    if (!this.core) {
      throw new ValidationError('ChatClient is not connected', {
        code: ERROR_CODES.AUTH_NOT_LOGIN,
      });
    }
    return this.core.decodeServerMessageMeta(metaPayload);
  }

  private registerManagers<Managers extends ReadonlyArray<ManagerRegistration<ChatClient>>>(
    managers: Managers
  ): void {
    if (managers.length === 0) {
      return;
    }

    const managerKeys = new Set<string>();
    for (const manager of managers) {
      const managerKey = this.resolveManagerKey(manager);
      if (managerKeys.has(managerKey)) {
        throw this.buildManagerValidationError(
          `Manager key duplicated: ${managerKey}`,
          ERROR_CODES.VALIDATION_INVALID_FORMAT,
          'managers.key',
          'conflict',
          {
            managerKey,
          }
        );
      }
      managerKeys.add(managerKey);
    }

    for (const manager of managers) {
      this.registerManagerInput(manager);
    }
  }

  private registerManagerInput(manager: ManagerRegistration<ChatClient>): ManagerBase<ChatClient> {
    if (ChatClient.isManagerConstructor(manager)) {
      return this.registerManagerConstructor(manager);
    }
    return this.registerManagerInstance(manager);
  }

  private registerManagerConstructor<Manager extends ManagerBase<ChatClient>, Key extends string>(
    ManagerCtor: ManagerConstructor<ChatClient, Manager, Key>
  ): Manager {
    const managerKey = this.getManagerKeyFromConstructor(ManagerCtor);
    const existing = this.managerRegistry.get(managerKey);

    if (existing) {
      if (existing.constructor === ManagerCtor) {
        return existing as Manager;
      }
      throw this.buildManagerConflictError(
        managerKey,
        this.getManagerNameFromInstance(existing),
        this.getManagerNameFromConstructor(ManagerCtor),
        'constructor-mismatch'
      );
    }

    const manager = new ManagerCtor();
    manager.bind(this, this.managerEventContext);
    this.managerRegistry.set(managerKey, manager);
    this.registerManagerCapabilities(manager);
    this.attachManager(managerKey, manager);
    return manager;
  }

  private registerManagerInstance<Manager extends ManagerInstance<ChatClient>>(
    manager: Manager
  ): Manager {
    const managerKey = this.getManagerKeyFromInstance(manager);
    const existing = this.managerRegistry.get(managerKey);

    if (existing) {
      if (existing === manager) {
        return manager;
      }
      if (existing.constructor === manager.constructor) {
        throw this.buildManagerConflictError(
          managerKey,
          this.getManagerNameFromInstance(existing),
          this.getManagerNameFromInstance(manager),
          'instance-conflict'
        );
      }
      throw this.buildManagerConflictError(
        managerKey,
        this.getManagerNameFromInstance(existing),
        this.getManagerNameFromInstance(manager),
        'constructor-mismatch'
      );
    }

    manager.bind(this, this.managerEventContext);
    this.managerRegistry.set(managerKey, manager);
    this.registerManagerCapabilities(manager);
    this.attachManager(managerKey, manager);
    return manager;
  }

  private registerManagerCapabilities(manager: ManagerBase<ChatClient>): void {
    for (const capability of manager.capabilities ?? []) {
      this.managerCapabilities.set(capability, manager);
    }
  }

  private dispatchRawNotifyToCapability(
    capability: ManagerCapability,
    event: RawNotifyEvent
  ): void | Promise<void> {
    const manager = this.getManagerByCapability(capability);
    return manager?.handleRawNotify?.(event);
  }

  private getUserInfoReadCapability(): UserInfoReadCapability | null {
    const manager = this.getManagerByCapability('userInfo:read');
    if (!manager || !this.hasUserInfoReadCapability(manager)) {
      return null;
    }
    return manager;
  }

  private getGroupNamecardHydrationCapability(): GroupNamecardHydrationCapability | null {
    const manager = this.getManagerByCapability('group:namecard');
    if (!manager || !this.hasGroupNamecardHydrationCapability(manager)) {
      return null;
    }
    return manager;
  }

  private validateOptionalCapabilityDependencies(): void {
    if (this.config.enableUserInfoSync && !this.getUserInfoReadCapability()) {
      throw this.buildMissingCapabilityError('enableUserInfoSync', 'userInfo:read', [
        'UserInfoManager',
      ]);
    }
    if (this.config.enableUserInfoSync && !this.getGroupNamecardHydrationCapability()) {
      throw this.buildMissingCapabilityError('enableUserInfoSync', 'group:namecard', [
        'GroupManager',
      ]);
    }
    if (this.config.enableSyncData.includes('contact') && !this.getUserInfoReadCapability()) {
      throw this.buildMissingCapabilityError("enableSyncData: ['contact']", 'userInfo:read', [
        'UserInfoManager',
      ]);
    }
    if (this.config.enableSyncData.includes('group') && !this.managerRegistry.has('groupManager')) {
      throw this.buildMissingCapabilityError("enableSyncData: ['group']", 'rawNotify:group', [
        'GroupManager',
      ]);
    }
  }

  private hasUserInfoReadCapability(
    manager: ManagerBase<ChatClient>
  ): manager is UserInfoReadCapability {
    return (
      typeof (manager as { getUserInfoByUserId?: unknown }).getUserInfoByUserId === 'function'
    );
  }

  private hasGroupNamecardHydrationCapability(
    manager: ManagerBase<ChatClient>
  ): manager is GroupNamecardHydrationCapability {
    return (
      typeof (manager as { hydrateMessageProfileGroupNamecards?: unknown })
        .hydrateMessageProfileGroupNamecards === 'function'
    );
  }

  private buildMissingCapabilityError(
    optionName: string,
    capability: ManagerCapability,
    requiredManagers: ReadonlyArray<string>
  ): ValidationError {
    return new ValidationError(
      `${optionName} requires explicit manager capability: ${capability}`,
      {
        code: ERROR_CODES.VALIDATION_REQUIRED,
        details: {
          fields: [
            {
              path: optionName,
              message: `${optionName} requires explicit manager capability: ${capability}`,
              rule: 'dependency',
            },
          ],
          capability,
          requiredManagers,
        },
      }
    );
  }

  private resolveManagerKey(manager: ManagerRegistration<ChatClient>): string {
    if (ChatClient.isManagerConstructor(manager)) {
      return this.getManagerKeyFromConstructor(manager);
    }
    if (typeof manager !== 'object' || manager === null) {
      throw this.buildManagerValidationError(
        'Manager must be constructor or instance',
        ERROR_CODES.VALIDATION_INVALID_FORMAT,
        'managers',
        'type',
        {
          receivedType: typeof manager,
        }
      );
    }
    return this.getManagerKeyFromInstance(manager);
  }

  private getManagerKeyFromConstructor<Manager extends ManagerBase<ChatClient>, Key extends string>(
    ManagerCtor: ManagerConstructor<ChatClient, Manager, Key>
  ): Key {
    const managerKey = ManagerCtor.key;
    if (!this.isValidManagerKey(managerKey)) {
      throw this.buildManagerValidationError(
        'Manager key is required',
        ERROR_CODES.VALIDATION_REQUIRED,
        'managers.key',
        'required',
        {
          managerType: 'constructor',
          managerName: this.getManagerNameFromConstructor(ManagerCtor),
        }
      );
    }
    return managerKey;
  }

  private getManagerKeyFromInstance(manager: ManagerInstance<ChatClient>): string {
    const managerConstructor = manager.constructor as {
      readonly key?: unknown;
      readonly name?: string;
    };
    const managerKey = managerConstructor.key;
    if (!this.isValidManagerKey(managerKey)) {
      throw this.buildManagerValidationError(
        'Manager key is required',
        ERROR_CODES.VALIDATION_REQUIRED,
        'managers.key',
        'required',
        {
          managerType: 'instance',
          managerName: this.getManagerNameFromInstance(manager),
        }
      );
    }
    return managerKey;
  }

  private attachManager(managerKey: string, manager: ManagerBase<ChatClient>): void {
    const target = this as unknown as Record<string, ManagerBase<ChatClient>>;
    if (Object.prototype.hasOwnProperty.call(target, managerKey)) {
      return;
    }
    Object.defineProperty(this, managerKey, {
      value: manager,
      writable: false,
      enumerable: true,
    });
  }

  private isValidManagerKey(candidate: unknown): candidate is string {
    return typeof candidate === 'string' && candidate.trim().length > 0;
  }

  private getManagerNameFromConstructor(
    ManagerCtor: ManagerConstructor<ChatClient, ManagerBase<ChatClient>, string>
  ): string {
    return typeof ManagerCtor.name === 'string' && ManagerCtor.name.length > 0
      ? ManagerCtor.name
      : 'AnonymousManager';
  }

  private getManagerNameFromInstance(manager: ManagerBase<ChatClient>): string {
    const managerConstructor = manager.constructor as { readonly name?: string };
    return typeof managerConstructor.name === 'string' && managerConstructor.name.length > 0
      ? managerConstructor.name
      : 'AnonymousManager';
  }

  private buildManagerValidationError(
    message: string,
    code: ErrorCode,
    path: string,
    rule: string,
    extraDetails: Record<string, unknown>
  ): ValidationError {
    return new ValidationError(message, {
      code,
      details: {
        fields: [
          {
            path,
            message,
            rule,
          },
        ],
        ...extraDetails,
      },
    });
  }

  private buildManagerConflictError(
    managerKey: string,
    existingName: string,
    incomingName: string,
    reason: 'constructor-mismatch' | 'instance-conflict'
  ): ValidationError {
    return this.buildManagerValidationError(
      'Manager key conflict',
      ERROR_CODES.VALIDATION_INVALID_FORMAT,
      'managers.key',
      'conflict',
      {
        managerKey,
        existingName,
        incomingName,
        reason,
      }
    );
  }

  private static isManagerConstructor(
    manager: ManagerRegistration<ChatClient>
  ): manager is ManagerConstructor<ChatClient, ManagerBase<ChatClient>, string> {
    return typeof manager === 'function';
  }

  private updateState(next: ConnectionState): void {
    if (this.state !== next) {
      this.state = next;
    }
  }

  private async initCacheManager(userId: string): Promise<void> {
    // 初始化缓存管理器
    if (this.cacheManager && this.cacheUserId === userId) {
      // 同一用户复用
      await this.cacheManager.prepare(); // 等待加载完成
      return; // 直接返回
    } // 复用判断结束
    this.cacheManager = new CacheManager({
      // 创建缓存管理器
      appKey: this.config.appKey, // appKey
      userId, // 用户 ID
      cacheEncryptionMode: this.config.cacheEncryptionMode, // 加密模式
    }); // 创建结束
    this.cacheUserId = userId; // 记录用户 ID
    await this.cacheManager.prepare(); // 等待加载完成
  } // 初始化缓存结束

  private loadCachedConversations(): void {
    // 读取缓存会话
    if (!this.cacheManager) {
      // 未启用缓存
      return; // 直接返回
    } // 判断结束
    this.emitConversationListUpdate('conversation', true); // 派发缓存事件
  } // 读取缓存会话结束

  private loadCachedUserInfo(): void {
    // 读取用户信息缓存
    if (!this.cacheManager) {
      // 未启用缓存
      return; // 直接返回
    } // 判断结束
    this.cacheManager.loadUserInfoSummaries(); // 加载用户信息到内存
  } // 读取用户信息缓存结束

  public emitConversationListUpdate(
    reason: ConversationListUpdateReason,
    reset = false
  ): void {
    if (!this.cacheManager) {
      return;
    }
    const items = this.cacheManager.loadSessionList().map(toConversationItem);
    const patch = this.buildConversationListPatch(this.conversationListSnapshot, items, reset);
    if (
      !patch.reset &&
      patch.upserted.length === 0 &&
      patch.removed.length === 0 &&
      !patch.orderChanged
    ) {
      return;
    }
    this.conversationListVersion += 1;
    this.conversationListSnapshot = items;
    // 派发会话列表更新
    this.eventHub.dispatch(ChatEventName.CONVERSATION_LIST_UPDATE, {
      // 派发事件
      version: this.conversationListVersion,
      items, // 会话列表
      reason, // 更新原因
      patch,
    }); // 派发结束
  } // 派发会话列表更新结束

  private buildConversationListPatch(
    previousItems: ReadonlyArray<ConversationItem>,
    nextItems: ReadonlyArray<ConversationItem>,
    reset: boolean
  ): ConversationListUpdatePatch {
    const previousMap = new Map(previousItems.map(item => [this.buildConversationListKey(item), item]));
    const nextMap = new Map(nextItems.map(item => [this.buildConversationListKey(item), item]));
    const affectedKeys = new Set<string>();
    const upserted: ConversationItem[] = [];
    const removed: Array<ConversationListUpdatePatch['removed'][number]> = [];

    for (const item of nextItems) {
      const key = this.buildConversationListKey(item);
      const previous = previousMap.get(key);
      if (!previous || !this.isConversationListItemEqual(previous, item)) {
        upserted.push(item);
        affectedKeys.add(key);
      }
    }

    for (const item of previousItems) {
      const key = this.buildConversationListKey(item);
      if (!nextMap.has(key)) {
        removed.push({
          conversationId: item.conversationId,
          conversationType: item.conversationType,
        });
        affectedKeys.add(key);
      }
    }

    const previousOrder = previousItems.map(item => this.buildConversationListKey(item)).join('\n');
    const nextOrder = nextItems.map(item => this.buildConversationListKey(item)).join('\n');
    const orderChanged = previousOrder !== nextOrder;
    if (orderChanged) {
      for (const item of nextItems) {
        affectedKeys.add(this.buildConversationListKey(item));
      }
    }

    return {
      reset,
      upserted,
      removed,
      affectedKeys: [...affectedKeys],
      orderChanged,
    };
  }

  private buildConversationListKey(item: {
    readonly conversationId: string;
    readonly conversationType: ConversationType;
  }): string {
    return `${item.conversationType}:${item.conversationId}`;
  }

  private isConversationListItemEqual(left: ConversationItem, right: ConversationItem): boolean {
    return (
      left.conversationId === right.conversationId &&
      left.conversationType === right.conversationType &&
      left.unreadCount === right.unreadCount &&
      left.lastMessageAt === right.lastMessageAt &&
      left.isPinned === right.isPinned &&
      left.pinnedTimestamp === right.pinnedTimestamp &&
      left.readAt === right.readAt &&
      left.remindType === right.remindType &&
      left.conversationName === right.conversationName &&
      left.conversationAvatar === right.conversationAvatar &&
      left.marks.length === right.marks.length &&
      left.marks.every((m, i) => m === right.marks[i]) &&
      (left.lastMessage?.msgServerId ?? null) === (right.lastMessage?.msgServerId ?? null)
    );
  }

  private async triggerContactSync(): Promise<void> {
    if (!this.config.enableSyncData.includes('contact')) {
      return;
    }
    await this.refreshContactSnapshot();
  }

  private triggerConfiguredSyncDataAfterLogin(userId: string): void {
    if (this.config.enableSyncData.includes('contact')) {
      logger.warn('Triggering automatic contact sync after login', { userId });
      void this.triggerContactSync();
    }
    if (this.config.enableSyncData.includes('group')) {
      logger.warn('Triggering automatic group sync after login', { userId });
      void this.triggerGroupSync();
    }
  }

  private async triggerGroupSync(): Promise<void> {
    if (!this.config.enableSyncData.includes('group')) {
      return;
    }
    const controller = this.ensureGroupSyncController();
    await controller.sync();
  }

  private ensureSessionListSyncController(): SessionListSyncController {
    if (this.syncConversationListConfigController) {
      return this.syncConversationListConfigController;
    }
    this.syncConversationListConfigController = new SessionListSyncController(this);
    return this.syncConversationListConfigController;
  }

  private ensureContactSyncController(): { sync(): Promise<void>; cancel(): void } {
    if (this.contactSyncController) {
      return this.contactSyncController;
    }

    const manager = this.managerRegistry.get('contactManager') as
      | { createSyncController?: (deps: unknown) => { sync(): Promise<void>; cancel(): void } }
      | undefined;
    if (!manager?.createSyncController) {
      throw new ValidationError('ContactManager is required for contact sync', {
        code: ERROR_CODES.VALIDATION_REQUIRED,
        details: {
          fields: [{ path: 'contactManager', message: 'ContactManager must be registered for enableSyncData: [\'contact\']', rule: 'required' }],
        },
      });
    }

    this.contactSyncController = manager.createSyncController({
      getContextState: (): {
        cacheMeta: ReturnType<CacheManager['loadContactCacheMeta']>;
        versionState: ReturnType<CacheManager['loadContactVersionState']>;
        cachedSnapshot: ContactSnapshot;
      } => {
        const cacheManager = this.requireCacheManager();
        return {
          cacheMeta: cacheManager.loadContactCacheMeta(),
          versionState: cacheManager.loadContactVersionState(),
          cachedSnapshot: cacheManager.loadContactSnapshot('cache'),
        };
      },
      queryMetadata: async (
        currentVersion: string
      ): ReturnType<typeof fetchContactMetadataVersion> => {
        return await fetchContactMetadataVersion(this.getContactSyncRestContext(), currentVersion);
      },
      getSyncUrls: async (): Promise<ReadonlyArray<string>> => {
        return await this.resolveContactSyncUrls();
      },
      getSharedSyncSession: (): SharedSyncWebSocketSession => {
        return this.getSharedSyncWebSocketSession();
      },
      buildRosterRequest: ({
        version,
      }: {
        decision: ContactSyncDecision;
        version: string;
      }): RosterRequest => {
        return this.buildContactRosterRequest(version);
      },
      applySyncResult: (options: Parameters<CacheManager['applyContactSync']>[0]): ReturnType<CacheManager['applyContactSync']> => {
        const result = this.requireCacheManager().applyContactSync(options);
        this.refreshConversationDisplayFromUserInfos(
          result.snapshot.items.map(item => ({ userId: item.userId })),
          'profile'
        );
        return result;
      },
      onStart: (): void => {
        this.emitSyncDataStart('contact');
      },
      onFinish: (payload?: { readonly error: { code: number; stage: SyncDataErrorStage; message: string; retryable: boolean } }): void => {
        this.emitSyncDataFinished({
          dataType: 'contact',
          status: payload?.error ? 'failed' : 'success',
          error: payload?.error
            ? {
                dataType: 'contact',
                code: payload.error.code,
                stage: payload.error.stage,
                message: payload.error.message,
                retryable: payload.error.retryable,
              }
            : undefined,
        });
      },
    });
    return this.contactSyncController;
  }

  private ensureGroupSyncController(): { sync(): Promise<void>; cancel(): void } {
    if (this.groupSyncController) {
      return this.groupSyncController;
    }

    const manager = this.managerRegistry.get('groupManager') as
      | { createSyncController?: (deps: unknown) => { sync(): Promise<void>; cancel(): void } }
      | undefined;
    if (!manager?.createSyncController) {
      throw new ValidationError('GroupManager is required for group sync', {
        code: ERROR_CODES.VALIDATION_REQUIRED,
        details: {
          fields: [{ path: 'groupManager', message: 'GroupManager must be registered for enableSyncData: [\'group\']', rule: 'required' }],
        },
      });
    }

    this.groupSyncController = manager.createSyncController({
      getRestContext: (): RestContext => this.getRestContext(),
      getSyncUrls: async (): Promise<ReadonlyArray<string>> => {
        return await this.resolveContactSyncUrls();
      },
      getSharedSyncSession: (): SharedSyncWebSocketSession => {
        return this.getSharedSyncWebSocketSession();
      },
      getCacheManager: (): CacheManager => this.requireCacheManager(),
      applyRuntimeSnapshot: (snapshot: import('./types/group').JoinedGroupSnapshot): void => {
        const manager = this.managerRegistry.get('groupManager') as
          | { applyJoinedGroupSnapshot?: (snapshot: import('./types/group').JoinedGroupSnapshot) => void }
          | undefined;
        manager?.applyJoinedGroupSnapshot?.(snapshot);
        this.refreshConversationDisplayFromJoinedGroups(snapshot.items, 'profile');
      },
      getRuntimeSnapshot: (): import('./types/group').JoinedGroupSnapshot | null => {
        const manager = this.managerRegistry.get('groupManager') as
          | { getJoinedGroupSnapshotForSync?: () => import('./types/group').JoinedGroupSnapshot }
          | undefined;
        return manager?.getJoinedGroupSnapshotForSync?.() ?? null;
      },
      onStart: (): void => {
        this.emitSyncDataStart('group');
      },
      onFinish: (payload: {
        readonly status: 'success' | 'failed';
        readonly error?: import('./types/sync-data').SyncDataError;
      }): void => {
        this.emitSyncDataFinished({
          dataType: 'group',
          status: payload.status,
          error: payload.error,
        });
      },
    });
    return this.groupSyncController;
  }

  /**
   * @internal
   * [zh-CN] 派发统一数据同步开始事件。 [en-US] Emits unified data-sync start event.
   */
  public emitSyncDataStart(dataType: SyncDataType): void {
    this.eventHub.dispatch(ChatEventName.SYNC_DATA_START, {
      dataType,
    });
  }

  /**
   * @internal
   * [zh-CN] 派发统一数据同步完成事件。 [en-US] Emits unified data-sync finished event.
   */
  public emitSyncDataFinished(payload: SyncDataFinishedPayload): void {
    this.eventHub.dispatch(ChatEventName.SYNC_DATA_FINISHED, payload);
  }

  private requireCacheManager(): CacheManager {
    if (!this.cacheManager) {
      throw new ValidationError('cacheManager is required', {
        code: ERROR_CODES.VALIDATION_REQUIRED,
        details: {
          fields: [
            {
              path: 'cacheManager',
              message: 'cacheManager is required',
              rule: 'required',
            },
          ],
        },
      });
    }
    return this.cacheManager;
  }

  private async resolveContactSyncUrls(): Promise<ReadonlyArray<string>> {
    const configuredSyncWsUrl = this.config.serviceConfig.serverUrls?.syncWsUrl;
    if (configuredSyncWsUrl) {
      return this.buildAuthenticatedContactSyncUrls([configuredSyncWsUrl]);
    }

    if (this.contactSyncWsUrls.length > 0) {
      return this.buildAuthenticatedContactSyncUrls(this.contactSyncWsUrls);
    }

    if (this.contactSyncDnsResolved) {
      logger.warn('Automatic contact sync sync-ws is unavailable after DNS precheck', {
        userId: this.currentUserId,
        serviceConnectionMode: this.config.serviceConfig.mode,
      });
      throw new SDKError(
        'Contact sync websocket urls are unavailable',
        ERROR_CODES.CONTACT_SYNC_SOCKET_FAILED,
        {
          details: {
            stage: 'socket_connect',
          },
        }
      );
    }

    if (this.config.serviceConfig.mode !== 'dns') {
      logger.warn('Automatic contact sync sync-ws is unavailable without dns service config', {
        userId: this.currentUserId,
        serviceConnectionMode: this.config.serviceConfig.mode,
      });
      throw new SDKError(
        'Contact sync websocket urls are unavailable',
        ERROR_CODES.CONTACT_SYNC_SOCKET_FAILED,
        {
          details: {
            stage: 'socket_connect',
          },
        }
      );
    }
    try {
      const dnsResult = await resolveDnsConfig({
        appKey: this.config.appKey,
        baseUrls: this.config.serviceConfig.dnsConfigUrls,
      });
      this.contactSyncWsUrls = dnsResult.syncWebsocketUrls;
      this.contactSyncDnsResolved = true;
    } catch (error) {
      logger.warn('Automatic contact sync sync-ws DNS resolve failed', {
        userId: this.currentUserId,
        reason: error instanceof Error ? error.message : String(error),
      });
      throw new SDKError(
        'Contact sync websocket dns resolve failed',
        ERROR_CODES.CONTACT_SYNC_SOCKET_FAILED,
        {
          details: {
            stage: 'socket_connect',
            cause: error instanceof Error ? error.message : String(error),
          },
        }
      );
    }
    if (this.contactSyncWsUrls.length === 0) {
      logger.warn('Automatic contact sync sync-ws is unavailable after DNS resolve', {
        userId: this.currentUserId,
        serviceConnectionMode: 'dns',
      });
      throw new SDKError(
        'Contact sync websocket urls are unavailable',
        ERROR_CODES.CONTACT_SYNC_SOCKET_FAILED,
        {
          details: {
            stage: 'socket_connect',
          },
        }
      );
    }
    return this.buildAuthenticatedContactSyncUrls(this.contactSyncWsUrls);
  }

  private buildAuthenticatedContactSyncUrls(urls: ReadonlyArray<string>): ReadonlyArray<string> {
    const token = this.requireContactSyncToken();
    return this.shuffleContactSyncUrls(
      urls.map(url => {
        return this.buildContactSyncSocketUrl(url, token);
      })
    );
  }

  private buildAuthenticatedSessionListSyncUrls(
    urls: ReadonlyArray<string>
  ): ReadonlyArray<string> {
    if (urls.length === 0) {
      return [];
    }
    const token = this.requireContactSyncToken();
    return urls.map(url => {
      return this.buildContactSyncSocketUrl(url, token);
    });
  }

  private requireContactSyncToken(): string {
    if (this.authToken) {
      return this.authToken;
    }

    throw new ValidationError('token is required', {
      code: ERROR_CODES.VALIDATION_REQUIRED,
      details: {
        fields: [
          {
            path: 'token',
            message: 'token is required',
            rule: 'required',
          },
        ],
      },
    });
  }

  private buildContactSyncSocketUrl(baseUrl: string, token: string): string {
    const parsed = new URL(baseUrl);
    if (parsed.pathname === '' || parsed.pathname === '/') {
      parsed.pathname = '/ws';
    }
    parsed.searchParams.set('token', token);
    return parsed.toString();
  }

  private shuffleContactSyncUrls(urls: ReadonlyArray<string>): ReadonlyArray<string> {
    const copied = [...urls];
    for (let i = copied.length - 1; i > 0; i -= 1) {
      const randomIndex = Math.floor(Math.random() * (i + 1));
      const current = copied[i];
      const randomValue = copied[randomIndex];
      if (!current || !randomValue) {
        continue;
      }
      copied[i] = randomValue;
      copied[randomIndex] = current;
    }
    return copied;
  }

  private buildContactRosterRequest(version: string): RosterRequest {
    const context = this.getContactSyncRestContext();
    const { orgName, appName } = parseAppKey(context.appKey);
    return {
      type: RosterMessageType.REQUEST,
      header: {
        resource: context.clientResource,
        timestamp: Date.now(),
        requestId: `contact-sync-${Date.now()}`,
        protocolVersion: 1,
      },
      org: orgName,
      app: appName,
      username: context.userId,
      version,
      cursor: 0,
    };
  }

  private resetCore(): void {
    this.contactSyncController?.cancel();
    this.contactSyncController = null;
    this.groupSyncController?.cancel();
    this.groupSyncController = null;
    this.syncWebSocketSession?.cancel('reset-core');
    this.syncWebSocketSession = null;
    this.syncConversationListConfigController = null;
    this.userInfoHydrationQueue.destroy();
    this.groupNamecardHydrationQueue.destroy();
    if (!this.core) {
      return;
    }

    this.core.destroy();
    this.core = null;
    this.currentUserId = null; // 清理当前用户 ID
    this.restBaseUrl = null; // 清理 REST 基础地址
    this.authToken = null; // 清理 token
    this.clientResource = null; // 清理资源标识
    this.platformAdapter = null; // 清理平台适配器
    this.cacheManager = null; // 清理缓存管理器
    this.cacheUserId = null; // 清理缓存用户
    this.contactSyncWsUrls = []; // 清理联系人同步地址缓存
    this.syncConversationListConfigWsUrls = [];
    this.contactSyncDnsResolved = false;
    this.resetManagerSessionRuntimes();
  }

  private resetManagerSessionRuntimes(): void {
    const groupManager = this.managerRegistry.get('groupManager') as
      | { resetSessionRuntime?: () => void }
      | undefined;
    groupManager?.resetSessionRuntime?.();
  }

  private getContactSyncRestContext(): RestContext {
    const context = this.getRestContext();
    const syncRestApiUrl = this.config.serviceConfig.serverUrls?.syncRestApiUrl;
    if (!syncRestApiUrl) {
      return context;
    }
    return {
      ...context,
      restBaseUrl: syncRestApiUrl,
    };
  }

  private static isSameConfig(current: NormalizedInitConfig, next: NormalizedInitConfig): boolean {
    if (current.appKey !== next.appKey) {
      return false;
    }

    if (!ChatClient.isSameStringArray(current.enableSyncData, next.enableSyncData)) {
      return false;
    }

    if (current.useCustomAttachmentUpload !== next.useCustomAttachmentUpload) {
      return false;
    }

    if (!ChatClient.isSameServiceConfig(current.serviceConfig, next.serviceConfig)) {
      return false;
    }

    if (current.useFixedDeviceId !== next.useFixedDeviceId) {
      return false;
    }

    if (current.deviceId !== next.deviceId) {
      return false;
    }

    if (current.useReplacedMessageContents !== next.useReplacedMessageContents) {
      return false;
    }

    if (current.customDeviceName !== next.customDeviceName) {
      return false;
    }

    if (current.customOsPlatform !== next.customOsPlatform) {
      return false;
    }


    if (current.uiKitVersion !== next.uiKitVersion) {
      return false;
    }

    if (current.cacheEncryptionMode !== next.cacheEncryptionMode) {
      return false;
    }

    if (current.enableUserInfoSync !== next.enableUserInfoSync) {
      return false;
    }

    if (current.syncConversationListConfig.includeEmpty !== next.syncConversationListConfig.includeEmpty) {
      return false;
    }

    return (
      current.profileSync.userInfoWindowMs === next.profileSync.userInfoWindowMs &&
      current.profileSync.userInfoBatchSize === next.profileSync.userInfoBatchSize &&
      current.profileSync.groupNamecardWindowMs === next.profileSync.groupNamecardWindowMs &&
      current.profileSync.groupNamecardMaxConcurrency ===
        next.profileSync.groupNamecardMaxConcurrency
    );
  }

  private static normalizeServiceConfig(serviceConfig?: ServiceConfig): NormalizedServiceConfig {
    return {
      mode: serviceConfig?.serverUrls ? 'fixed' : 'dns',
      dnsConfigUrls: serviceConfig?.dnsConfigUrls ?? DEFAULT_DNS_CONFIG_URLS,
      hasCustomDnsConfigUrls: Boolean(serviceConfig?.dnsConfigUrls?.length),
      serverUrls: serviceConfig?.serverUrls,
    };
  }

  private static normalizeSyncDataTypes(
    items: ReadonlyArray<SyncDataType>
  ): ReadonlyArray<SyncDataType> {
    const normalized: SyncDataType[] = [];
    for (const item of items) {
      if (!normalized.includes(item)) {
        normalized.push(item);
      }
    }
    return normalized;
  }

  private static isSameStringArray(
    current: ReadonlyArray<string>,
    next: ReadonlyArray<string>
  ): boolean {
    if (current.length !== next.length) {
      return false;
    }
    for (let index = 0; index < current.length; index += 1) {
      if (current[index] !== next[index]) {
        return false;
      }
    }
    return true;
  }

  private static isSameServiceConfig(
    current: NormalizedServiceConfig,
    next: NormalizedServiceConfig
  ): boolean {
    if (current.mode !== next.mode) {
      return false;
    }

    if (current.dnsConfigUrls.length !== next.dnsConfigUrls.length) {
      return false;
    }

    for (let i = 0; i < current.dnsConfigUrls.length; i += 1) {
      if (current.dnsConfigUrls[i] !== next.dnsConfigUrls[i]) {
        return false;
      }
    }

    return ChatClient.isSameServerUrls(current.serverUrls, next.serverUrls);
  }

  private static isSameServerUrls(current?: ServerUrlsConfig, next?: ServerUrlsConfig): boolean {
    if (!current && !next) {
      return true;
    }
    if (!current || !next) {
      return false;
    }
    return (
      current.restApiUrl === next.restApiUrl &&
      current.wsUrl === next.wsUrl &&
      current.syncRestApiUrl === next.syncRestApiUrl &&
      current.syncWsUrl === next.syncWsUrl
    );
  }
}
