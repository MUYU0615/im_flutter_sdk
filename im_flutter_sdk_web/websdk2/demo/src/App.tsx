import { useState } from 'react';
import {
  ChatManager,
  ChatClient,
  ChatThreadManager,
  ChatRoomManager,
  ContactManager,
  GroupManager,
  PresenceManager,
  PushManager,
  UserInfoManager,
} from 'im-sdk-web';
import { CacheDebugPanel } from './components/CacheDebugPanel';
import { ChatRoomPanel } from './components/ChatRoomPanel';
import { ChatThreadPanel } from './components/ChatThreadPanel';
import { ChatManagerPanel } from './components/ChatManagerPanel';
import { CombineMessagePanel } from './components/CombineMessagePanel';
import { ContactPanel } from './components/ContactPanel';
import { ConversationPanel } from './components/ConversationPanel';
import { GroupPanel } from './components/GroupPanel';
import { InitPanel } from './components/InitPanel';
import { LogPanel } from './components/LogPanel';
import { LoginPanel } from './components/LoginPanel';
import { MessagePanel } from './components/MessagePanel';
import { PresencePanel } from './components/PresencePanel';
import { ProfileSyncPanel } from './components/ProfileSyncPanel';
import { PushPanel } from './components/PushPanel';
import { SessionListPanel } from './components/SessionListPanel';
import { SearchPanel } from './components/SearchPanel';
import { SendPanel } from './components/SendPanel';
import {
  exchangePasswordForToken,
  resolveDemoLoginMode,
  type DemoLoginMode,
} from './login-auth';
import {
  getMessageProfileVersionSidecar,
  setMessageProfileVersionSidecar,
} from '../../src/core/message/profile-sync/profile-version-sidecar';
import { UserInfoPanel } from './components/UserInfoPanel';
import { VoiceToTextPanel } from './components/VoiceToTextPanel';
import {
  DEFAULT_FIXED_SERVER_PRESET_ID,
  DEMO_FIXED_SERVER_PRESETS,
} from './fixed-server-presets';
import {
  formatError,
  parseDnsConfigUrls,
  proxyDnsConfigUrlsForDev,
  safeJsonStringify,
  withTimeout,
} from './utils';
import { resolveDnsConfig } from '../../src/rest/dns-config';
import type {
  ChatEventHandlerMap,
  ChatThreadEventHandlerMap,
  ContactEventHandlerMap,
  ConnectionEventHandlerMap,
  ConnectionState,
  EventPayloadMap,
  GroupEventHandlerMap,
  PresenceEventHandlerMap,
  UserInfoEventHandlerMap,
} from 'im-sdk-web';
import type {
  ChannelTypeOption,
  ConversationItemRecord,
  ConversationReadEventRecord,
  DemoInitConfigInput,
  ConversationListUpdatePayloadRecord,
  DemoClient,
  GroupNamecardEventRecord,
  LogItem,
  LogType,
  MessageRecord,
  MessageReadEventRecord,
  MessageRecalledEventRecord,
  MessageUpdatedEventRecord,
  PinnedMessageChangedEventRecord,
  PresenceStateRecord,
  ReactionChangedEventRecord,
  UserInfoEventRecord,
} from './types';

const CONNECTION_HANDLER_ID = 'demo-connection';
const CHAT_HANDLER_ID = 'demo-chat';
const CONTACT_HANDLER_ID = 'demo-contact';
const PRESENCE_HANDLER_ID = 'demo-presence';
const USER_INFO_MANAGER_HANDLER_ID = 'demo-user-info-manager';
const USER_INFO_SYNC_HANDLER_ID = 'demo-user-info-sync';
const GROUP_PROFILE_HANDLER_ID = 'demo-group-profile';
const CONTACT_INVITED_EVENT_NAME = 'onContactInvited';
const CONTACT_DELETED_EVENT_NAME = 'onContactDeleted';
const CONTACT_ADDED_EVENT_NAME = 'onContactAdded';
const CONTACT_REFUSE_EVENT_NAME = 'onContactRefuse';
const CONTACT_AGREED_EVENT_NAME = 'onContactAgreed';
const CONTACT_INFO_UPDATED_EVENT_NAME = 'onContactInfoUpdated';
const buildSyncDataStartEventName = (dataType: string): string => `onSyncDataStart(${dataType})`;
const buildSyncDataFinishEventName = (dataType: string): string =>
  `onSyncDataFinished(${dataType})`;
const DEFAULT_DEMO_APP_KEY = 'easemob-demo#chatdemoui';
const LOG_LIMIT = 200;
const MESSAGE_LIMIT = 50;
const PROFILE_SYNC_EVENT_LIMIT = 50;
const LOGIN_TIMEOUT = 15000;
const LOGOUT_TIMEOUT = 10000;
type ConnectionEventPayload = EventPayloadMap['onConnected'];
type DemoTabKey =
  | 'init'
  | 'send'
  | 'chat-manager'
  | 'combine'
  | 'contact'
  | 'user-info'
  | 'chatroom'
  | 'thread'
  | 'group'
  | 'presence'
  | 'push'
  | 'profileSync'
  | 'cache'
  | 'conversation'
  | 'message'
  | 'voice-to-text'
  | 'search'
  | 'log';

interface DemoTabItem {
  readonly key: DemoTabKey;
  readonly label: string;
}

const DEMO_TAB_ITEMS: ReadonlyArray<DemoTabItem> = [
  { key: 'init', label: '初始化/登录' },
  { key: 'send', label: '发送消息' },
  { key: 'chat-manager', label: 'ChatManager' },
  { key: 'combine', label: '合并消息' },
  { key: 'contact', label: '联系人' },
  { key: 'user-info', label: '用户资料' },
  { key: 'chatroom', label: '聊天室' },
  { key: 'thread', label: 'Thread' },
  { key: 'group', label: '群组' },
  { key: 'presence', label: '在线状态' },
  { key: 'push', label: 'PushManager' },
  { key: 'profileSync', label: '资料补位' },
  { key: 'cache', label: '缓存调试' },
  { key: 'conversation', label: '会话列表' },
  { key: 'message', label: '消息列表' },
  { key: 'voice-to-text', label: '语音转文字' },
  { key: 'search', label: '消息搜索' },
  { key: 'log', label: '日志' },
];

const readEnvValue = (primary?: string, fallback?: string): string => {
  return (primary ?? fallback ?? '').trim();
};

const readBooleanEnvValue = (primary?: string, fallback?: string): boolean | undefined => {
  const resolved = readEnvValue(primary, fallback).toLowerCase();
  if (resolved === 'true') {
    return true;
  }
  if (resolved === 'false') {
    return false;
  }
  return undefined;
};

const resolveChannelType = (value?: string): ChannelTypeOption | undefined => {
  if (value === 'single' || value === 'group' || value === 'room') {
    return value;
  }
  return undefined;
};

export const App = (): JSX.Element => {
  const env = import.meta.env;
  const defaultAppKey =
    readEnvValue(env.VITE_EASEMOB_APPKEY, env.EASEMOB_APPKEY) || DEFAULT_DEMO_APP_KEY;
  const defaultDnsUrls = readEnvValue(env.VITE_EASEMOB_DNS_URLS, env.EASEMOB_DNS_URLS);
  const defaultUseFixedServerUrls =
    readBooleanEnvValue(env.VITE_EASEMOB_USE_FIXED_URLS, env.EASEMOB_USE_FIXED_URLS) ?? true;
  const defaultUseDnsConfig = !defaultUseFixedServerUrls;
  const defaultFixedServerPreset = DEMO_FIXED_SERVER_PRESETS.find(
    item => item.id === DEFAULT_FIXED_SERVER_PRESET_ID
  ) ?? DEMO_FIXED_SERVER_PRESETS[0];
  const defaultRestApiUrl = defaultFixedServerPreset?.restApiUrl ?? '';
  const defaultWsUrl = defaultFixedServerPreset?.wsUrl ?? '';
  const defaultSyncWsUrl = defaultFixedServerPreset?.syncWsUrl ?? '';
  const defaultUserId = readEnvValue(env.VITE_EASEMOB_USERID, env.EASEMOB_USERID);
  const defaultToken = readEnvValue(env.VITE_EASEMOB_TOKEN, env.EASEMOB_TOKEN);
  const defaultPassword = readEnvValue(env.VITE_EASEMOB_PASSWORD, env.EASEMOB_PASSWORD);
  const defaultTargetId = readEnvValue(env.VITE_EASEMOB_TARGET_ID, env.EASEMOB_TARGET_ID);
  const defaultMessage = readEnvValue(env.VITE_EASEMOB_MESSAGE, env.EASEMOB_MESSAGE);
  const defaultChannelType = resolveChannelType(
    env.VITE_EASEMOB_CHANNEL_TYPE ?? env.EASEMOB_CHANNEL_TYPE
  );
  const defaultEnableUserInfoSync =
    readBooleanEnvValue(
      env.VITE_EASEMOB_ENABLE_USER_INFO_SYNC,
      env.EASEMOB_ENABLE_USER_INFO_SYNC
    ) ?? false;
  const defaultEnableSyncData: ReadonlyArray<'conversation' | 'contact' | 'group'> = [
    'conversation',
  ];

  const [client, setClient] = useState<DemoClient | null>(null);
  const [status, setStatus] = useState<ConnectionState>('disconnected');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentAppKey, setCurrentAppKey] = useState<string>(defaultAppKey);
  const [currentRestApiUrl, setCurrentRestApiUrl] = useState<string>(defaultRestApiUrl);
  const [currentUseDnsConfig, setCurrentUseDnsConfig] = useState<boolean>(defaultUseDnsConfig);
  const [currentDnsConfigUrls, setCurrentDnsConfigUrls] = useState<ReadonlyArray<string>>([]);
  const [currentEnableUserInfoSync, setCurrentEnableUserInfoSync] =
    useState<boolean>(defaultEnableUserInfoSync);
  const [currentCacheEncryptionMode, setCurrentCacheEncryptionMode] =
    useState<'auto' | 'off'>('auto');
  const [activeTab, setActiveTab] = useState<DemoTabKey>('init');
  const [logs, setLogs] = useState<ReadonlyArray<LogItem>>([]);
  const [messages, setMessages] = useState<ReadonlyArray<MessageRecord>>([]);
  const [presenceStates, setPresenceStates] = useState<ReadonlyArray<PresenceStateRecord>>([]);
  const [conversations, setConversations] = useState<ReadonlyArray<ConversationItemRecord>>([]);
  const [conversationSource, setConversationSource] = useState<string | null>(null);
  const [conversationItems, setConversationItems] =
    useState<ReadonlyArray<ConversationItemRecord>>([]);
  const [sessionListCapability, setSessionListCapability] = useState<string>('unknown');
  const [userInfoEvents, setUserInfoEvents] = useState<ReadonlyArray<UserInfoEventRecord>>([]);
  const [groupNamecardEvents, setGroupNamecardEvents] = useState<
    ReadonlyArray<GroupNamecardEventRecord>
  >([]);

  const addLog = (type: LogType, message: string): void => {
    const now = new Date();
    const nextLog: LogItem = {
      id: `${now.getTime()}-${Math.random()}`,
      type,
      message,
      time: now.toLocaleTimeString(),
    };

    setLogs((prevLogs): ReadonlyArray<LogItem> => {
      const updated = [nextLog, ...prevLogs];
      return updated.slice(0, LOG_LIMIT);
    });
  };

  const logDemoEvent = (eventName: string, payload: unknown, type: LogType): void => {
    if (payload === undefined) {
      // eslint-disable-next-line no-console -- demo 需要直接在浏览器控制台打印事件名
      console.log(`[demo:event] ${eventName}`);
      addLog(type, eventName);
      return;
    }

    // eslint-disable-next-line no-console -- demo 需要直接在浏览器控制台打印事件名和原始载荷
    console.log(`[demo:event] ${eventName}`, payload);
    addLog(type, `${eventName}: ${safeJsonStringify(payload)}`);
  };

  const logReceivedMessageToConsole = (eventName: string, message: MessageRecord): void => {
    // eslint-disable-next-line no-console -- demo 需要在控制台输出收到的消息原始载荷，便于联调所有消息类型
    console.log(`[demo:message] ${eventName}`, {
      type: message.type,
      msgServerId: message.msgServerId,
      msgLocalId: message.msgLocalId,
      status: message.status,
      body: message.body,
      message,
    });
  };

  const buildMessageLogSummary = (message: MessageRecord): string => {
    const body = message.body as unknown as Record<string, unknown> | undefined;
    const text =
      typeof body?.content === 'string' && body.content.trim().length > 0
        ? body.content
        : undefined;
    const messageId = message.msgServerId || message.msgLocalId;
    const from = message.sender?.userId || 'unknown';
    const conversationId = message.conversationId || 'unknown';
    return `messageId=${messageId} from=${from} conversation=${conversationId} type=${message.type}${text ? ` text=${text}` : ''}`;
  };

  const getMessageKey = (message: MessageRecord): string => {
    return message.msgServerId || message.msgLocalId;
  };

  const mergeMessageRecord = (
    previousMessage: MessageRecord,
    nextMessage: MessageRecord
  ): MessageRecord => {
    const mergedMessage: MessageRecord = {
      ...previousMessage,
      ...nextMessage,
    };
    const sidecar =
      getMessageProfileVersionSidecar(nextMessage) ??
      getMessageProfileVersionSidecar(previousMessage);
    if (sidecar) {
      setMessageProfileVersionSidecar(mergedMessage, sidecar);
    }
    return mergedMessage;
  };

  const upsertMessage = (message: MessageRecord): void => {
    setMessages((prevMessages): ReadonlyArray<MessageRecord> => {
      const messageKey = getMessageKey(message);
      const index = prevMessages.findIndex((item): boolean => getMessageKey(item) === messageKey);
      if (index >= 0) {
        const updated = [...prevMessages];
        const previousMessage = prevMessages[index];
        if (!previousMessage) {
          return prevMessages;
        }
        updated[index] = mergeMessageRecord(previousMessage, message);
        return updated;
      }

      const merged = [message, ...prevMessages];
      return merged.slice(0, MESSAGE_LIMIT);
    });
  };

  const pushUserInfoEvent = (
    kind: UserInfoEventRecord['kind'],
    payload: UserInfoEventRecord['payload']
  ): void => {
    const now = new Date();
    const nextEvent: UserInfoEventRecord = {
      id: `${now.getTime()}-${Math.random()}`,
      kind,
      time: now.toLocaleTimeString(),
      payload,
    };
    setUserInfoEvents((prevEvents): ReadonlyArray<UserInfoEventRecord> => {
      const updated = [nextEvent, ...prevEvents];
      return updated.slice(0, PROFILE_SYNC_EVENT_LIMIT);
    });
  };

  const pushGroupNamecardEvent = (payload: GroupNamecardEventRecord['payload']): void => {
    const now = new Date();
    const nextEvent: GroupNamecardEventRecord = {
      id: `${now.getTime()}-${Math.random()}`,
      time: now.toLocaleTimeString(),
      payload,
    };
    setGroupNamecardEvents((prevEvents): ReadonlyArray<GroupNamecardEventRecord> => {
      const updated = [nextEvent, ...prevEvents];
      return updated.slice(0, PROFILE_SYNC_EVENT_LIMIT);
    });
  };

  const upsertPresenceStates = (updates: ReadonlyArray<PresenceStateRecord>): void => {
    setPresenceStates((prevStates): ReadonlyArray<PresenceStateRecord> => {
      const map = new Map<string, PresenceStateRecord>();
      for (const item of prevStates) {
        map.set(item.userId, item);
      }
      for (const item of updates) {
        map.set(item.userId, item);
      }
      return Array.from(map.values()).sort((a, b): number => a.userId.localeCompare(b.userId));
    });
  };

  const clearPresenceStates = (): void => {
    setPresenceStates([]);
  };

  const formatConnectionPayload = (payload: ConnectionEventPayload): string => {
    const attemptLabel = `${payload.attempt}/${payload.maxAttempts}`;
    const onlineLabel = payload.isOnline ? '在线' : '离线';
    const loginPhaseLabel = payload.isLoginPhase ? '登录阶段' : '非登录阶段';
    return `状态:${payload.state} 原因:${payload.reason} 次数:${attemptLabel} ${onlineLabel} ${loginPhaseLabel}`;
  };

  const syncConnectionState = (instance: ChatClient, payload: ConnectionEventPayload): void => {
    setStatus(payload.state);
    setCurrentUserId(instance.getCurrentUserId());
  };

  const registerConnectionHandlers = (instance: ChatClient): void => {
    const handlers: ConnectionEventHandlerMap = {
      onConnecting: (payload: ConnectionEventPayload): void => {
        syncConnectionState(instance, payload);
        addLog('info', `连接中 ${formatConnectionPayload(payload)}`);
      },
      onConnected: (payload: ConnectionEventPayload): void => {
        syncConnectionState(instance, payload);
        addLog('success', `连接成功 ${formatConnectionPayload(payload)}`);
      },
      onDisconnected: (payload: ConnectionEventPayload): void => {
        syncConnectionState(instance, payload);
        addLog('warn', `连接断开 ${formatConnectionPayload(payload)}`);
      },
      onReconnectFailed: (payload: ConnectionEventPayload): void => {
        syncConnectionState(instance, payload);
        addLog('error', `重连失败 ${formatConnectionPayload(payload)}`);
      },
    };

    instance.removeEventHandler(CONNECTION_HANDLER_ID);
    instance.addEventHandler(CONNECTION_HANDLER_ID, handlers);
  };

  const registerChatHandlers = (instance: DemoClient): void => {
    const handlers: ChatEventHandlerMap = {
      onMessage: (message: MessageRecord): void => {
        logReceivedMessageToConsole('onMessage', message);
        upsertMessage(message);
        const label = message.type === 'combine' ? '收到合并消息' : '收到消息';
        addLog('info', `${label}: ${buildMessageLogSummary(message)}`);
      },
      onConversationListUpdate: (payload: ConversationListUpdatePayloadRecord): void => {
        setConversations(payload.items);
        setConversationSource(payload.reason);
        setConversationItems(payload.items);
        addLog('info', `会话列表更新: ${payload.reason} (${payload.items.length} 条)`);
      },
      onConversationRead: (payload: ConversationReadEventRecord): void => {
        logDemoEvent('onConversationRead', payload, 'info');
      },
      onMessageRead: (payload: MessageReadEventRecord): void => {
        logDemoEvent('onMessageRead', payload, 'info');
      },
      onMessageRecalled: (payload: MessageRecalledEventRecord): void => {
        logDemoEvent('onMessageRecalled', payload, 'warn');
      },
      onMessageUpdated: (payload: MessageUpdatedEventRecord): void => {
        logDemoEvent('onMessageUpdated', payload, 'info');
      },
      onReactionChanged: (payload: ReactionChangedEventRecord): void => {
        logDemoEvent('onReactionChanged', payload, 'info');
      },
      onPinnedMessageChanged: (payload: PinnedMessageChangedEventRecord): void => {
        logDemoEvent('onPinnedMessageChanged', payload, 'info');
      },
    };

    instance.chatManager.removeEventHandler(CHAT_HANDLER_ID);
    instance.chatManager.addEventHandler(CHAT_HANDLER_ID, handlers);
  };

  const registerChatThreadHandlers = (instance: DemoClient): void => {
    const handlers: ChatThreadEventHandlerMap = {
      onChatThreadCreated: payload => {
        logDemoEvent('onChatThreadCreated', payload, 'success');
      },
      onChatThreadDestroyed: payload => {
        logDemoEvent('onChatThreadDestroyed', payload, 'warn');
      },
      onChatThreadUpdated: payload => {
        logDemoEvent('onChatThreadUpdated', payload, 'info');
      },
      onChatThreadUserRemoved: payload => {
        logDemoEvent('onChatThreadUserRemoved', payload, 'warn');
      },
    };

    instance.chatThreadManager.removeEventHandler('demo-chat-thread');
    instance.chatThreadManager.addEventHandler('demo-chat-thread', handlers);
  };

  const registerPresenceHandlers = (instance: DemoClient): void => {
    const handlers: PresenceEventHandlerMap = {
      onPresenceStatusChange: (states: ReadonlyArray<PresenceStateRecord>): void => {
        upsertPresenceStates(states);
        addLog('info', `收到在线状态变更: ${states.length} 条`);
      },
    };

    instance.presenceManager.removeEventHandler(PRESENCE_HANDLER_ID);
    instance.presenceManager.addEventHandler(PRESENCE_HANDLER_ID, handlers);
  };

  const registerUserInfoHandlers = (instance: DemoClient): void => {
    const syncHandlers: UserInfoEventHandlerMap = {
      onOwnInfoUpdated: payload => {
        pushUserInfoEvent('self', [payload]);
        logDemoEvent('onOwnInfoUpdated', payload, 'success');
      },
      onUserInfoUpdated: payload => {
        pushUserInfoEvent('others', payload);
        logDemoEvent('onUserInfoUpdated', payload, 'info');
      },
    };

    instance.userInfoManager.removeEventHandler(USER_INFO_MANAGER_HANDLER_ID);
    instance.removeEventHandler(USER_INFO_SYNC_HANDLER_ID);
    instance.addEventHandler(USER_INFO_SYNC_HANDLER_ID, syncHandlers);
  };

  const registerContactHandlers = (instance: DemoClient): void => {
    const handlers = {
      onContactInvited: payload => {
        logDemoEvent(CONTACT_INVITED_EVENT_NAME, payload, 'info');
      },
      onContactDeleted: payload => {
        logDemoEvent(CONTACT_DELETED_EVENT_NAME, payload, 'warn');
      },
      onContactAdded: payload => {
        logDemoEvent(CONTACT_ADDED_EVENT_NAME, payload, 'success');
      },
      onContactRefuse: payload => {
        logDemoEvent(CONTACT_REFUSE_EVENT_NAME, payload, 'warn');
      },
      onContactAgreed: payload => {
        logDemoEvent(CONTACT_AGREED_EVENT_NAME, payload, 'success');
      },
      onContactInfoUpdated: payload => {
        logDemoEvent(CONTACT_INFO_UPDATED_EVENT_NAME, payload, 'info');
      },
    } satisfies ContactEventHandlerMap;

    instance.contactManager.removeEventHandler(CONTACT_HANDLER_ID);
    instance.contactManager.addEventHandler(CONTACT_HANDLER_ID, handlers);
    instance.removeEventHandler(`${CONTACT_HANDLER_ID}-sync`);
    instance.addEventHandler(`${CONTACT_HANDLER_ID}-sync`, {
      onSyncDataStart: payload => {
        if (payload.dataType === 'conversation') {
          const capability =
            instance.chatManager.getConversationList().length > 0
              ? sessionListCapability
              : 'syncing';
          setSessionListCapability(capability);
        }
        logDemoEvent(buildSyncDataStartEventName(payload.dataType), payload, 'info');
      },
      onSyncDataFinished: payload => {
        if (payload.dataType === 'conversation') {
          setConversationItems(instance.chatManager.getConversationList());
          const controllerCapability =
            (
              instance as unknown as {
                getSessionListSyncCapabilityState?: () => { status: string };
              }
            ).getSessionListSyncCapabilityState?.()?.status ?? sessionListCapability;
          setSessionListCapability(controllerCapability);
        }
        logDemoEvent(
          buildSyncDataFinishEventName(payload.dataType),
          payload,
          payload.error ? 'warn' : 'success'
        );
      },
    });
  };

  const registerGroupProfileHandlers = (instance: DemoClient): void => {
    const handlers: GroupEventHandlerMap = {
      onUserGroupNamecardUpdated: payload => {
        pushGroupNamecardEvent(payload);
        console.log('[demo:event] onUserGroupNamecardUpdated payload', payload);
        console.dir(payload);
        logDemoEvent('onUserGroupNamecardUpdated', payload, 'info');
      },
    };

    instance.groupManager.removeEventHandler(GROUP_PROFILE_HANDLER_ID);
    instance.groupManager.addEventHandler(GROUP_PROFILE_HANDLER_ID, handlers);
  };

  const handleClearConversations = (): void => {
    setConversations([]);
    setConversationSource(null);
  };

  const handleClearConversationItems = (): void => {
    setConversationItems([]);
    setSessionListCapability('unknown');
  };

  const handleClearProfileSyncEvents = (): void => {
    setUserInfoEvents([]);
    setGroupNamecardEvents([]);
  };

  const handleInit = (config: DemoInitConfigInput): void => {
    const trimmedAppKey = config.appKey.trim();
    if (!trimmedAppKey) {
      addLog('warn', '请输入 AppKey');
      return;
    }

    try {
      const dnsConfigUrls = proxyDnsConfigUrlsForDev(parseDnsConfigUrls(config.dnsUrls));
      const trimmedRestApiUrl = config.restApiUrl.trim();
      const trimmedWsUrl = config.wsUrl.trim();
      const trimmedSyncWsUrl = config.syncWsUrl.trim();
      const managers = [
        ChatManager,
        ChatThreadManager,
        ContactManager,
        ChatRoomManager,
        GroupManager,
        UserInfoManager,
        PresenceManager,
        PushManager,
      ] as const;

      if (!config.useDnsConfig) {
        if (!trimmedRestApiUrl) {
          addLog('warn', '固定服务地址模式请输入 REST 地址');
          return;
        }
        if (!trimmedWsUrl) {
          addLog('warn', '固定服务地址模式请输入 WebSocket 地址');
          return;
        }
      }

      const instance = ChatClient.init(
        config.useDnsConfig
          ? {
              appKey: trimmedAppKey,
              serviceConfig:
                dnsConfigUrls.length > 0 ? { dnsConfigUrls: [...dnsConfigUrls] } : undefined,
              enableUserInfoSync: config.enableUserInfoSync,
              enableSyncData: config.enableSyncData,
              managers,
            }
          : {
              appKey: trimmedAppKey,
              serviceConfig: {
                serverUrls: {
                  restApiUrl: trimmedRestApiUrl,
                  wsUrl: trimmedWsUrl,
                  syncWsUrl: trimmedSyncWsUrl || undefined,
                },
              },
              enableUserInfoSync: config.enableUserInfoSync,
              enableSyncData: config.enableSyncData,
              managers,
            }
      );

      (
        instance as unknown as {
          config: {
            cacheEncryptionMode: 'auto' | 'off';
          };
        }
      ).config.cacheEncryptionMode = config.cacheEncryptionMode;

      registerConnectionHandlers(instance);
      registerChatHandlers(instance);
      registerChatThreadHandlers(instance);
      registerContactHandlers(instance);
      registerPresenceHandlers(instance);
      registerUserInfoHandlers(instance);
      registerGroupProfileHandlers(instance);
      setClient(instance);
      setStatus(instance.getConnectionState());
      setCurrentUserId(instance.getCurrentUserId());
      setCurrentAppKey(trimmedAppKey);
      setCurrentRestApiUrl(trimmedRestApiUrl);
      setCurrentUseDnsConfig(config.useDnsConfig);
      setCurrentDnsConfigUrls(dnsConfigUrls);
      setCurrentEnableUserInfoSync(config.enableUserInfoSync);
      setCurrentCacheEncryptionMode(config.cacheEncryptionMode);
      clearPresenceStates();
      handleClearConversations();
      handleClearProfileSyncEvents();
      addLog('info', `资料版本同步开关: ${config.enableUserInfoSync ? '开启' : '关闭'}`);
      addLog(
        'info',
        `缓存落盘模式: ${config.cacheEncryptionMode === 'off' ? '明文调试' : '自动加密'}`
      );
      addLog(
        'info',
        config.useDnsConfig
          ? dnsConfigUrls.length > 0
            ? `DNS_CONFIG 地址: ${dnsConfigUrls.join(', ')}`
            : 'DNS_CONFIG 地址: 使用 SDK 内置默认地址'
          : `自定义服务地址: REST=${trimmedRestApiUrl} WS=${trimmedWsUrl} SessionListWS=${trimmedSyncWsUrl || '[empty]'}`
      );
      addLog('success', 'SDK 初始化完成');
    } catch (error) {
      addLog('error', `初始化失败: ${formatError(error)}`);
    }
  };

  const handleLogin = async (userId: string, token: string, password: string): Promise<void> => {
    if (!client) {
      addLog('warn', '请先初始化 SDK');
      return;
    }

    const runtimeClient =
      'userInfoManager' in client && client.userInfoManager
        ? client
        : (client.use(UserInfoManager) as DemoClient);
    const loginModeResult = resolveDemoLoginMode({ token, password });
    if (!loginModeResult) {
      addLog('warn', '请输入 Token 或 Password');
      return;
    }

    try {
      registerContactHandlers(runtimeClient);
      registerPresenceHandlers(runtimeClient);
      registerUserInfoHandlers(runtimeClient);
      registerGroupProfileHandlers(runtimeClient);
      registerChatThreadHandlers(runtimeClient);
      addLog('info', `开始调用 login: userId=${userId}`);
      let authToken = loginModeResult.credential;
      const loginMode: DemoLoginMode = loginModeResult.mode;
      if (loginMode === 'password') {
        const resolvedRestApiUrl =
          currentRestApiUrl.trim().length > 0
            ? currentRestApiUrl.trim()
            : currentUseDnsConfig
              ? (
                  await resolveDnsConfig({
                    appKey: currentAppKey,
                    baseUrls:
                      currentDnsConfigUrls.length > 0 ? [...currentDnsConfigUrls] : undefined,
                  })
                ).restBaseUrl
              : '';
        if (!resolvedRestApiUrl) {
          throw new Error('未解析到 REST 地址，无法使用密码换取 token');
        }
        addLog('info', '检测到密码登录，先换取 token');
        authToken = await exchangePasswordForToken({
          restBaseUrl: resolvedRestApiUrl,
          appKey: currentAppKey,
          userId,
          password: loginModeResult.credential,
        });
        addLog('success', '密码换取 token 成功');
      }
      addLog(
        'info',
        `登录参数摘要: loginMode=${loginMode} appKeyLength=${currentAppKey.trim().length} userIdLength=${userId.trim().length} tokenLength=${authToken.trim().length} defaultPasswordLength=${defaultPassword.trim().length}`
      );
      // eslint-disable-next-line no-console
      console.log('[demo] login start', {
        userId,
        currentStatus: runtimeClient.getConnectionState(),
        hasClient: Boolean(runtimeClient),
        hasUserInfoManager: Boolean(
          'userInfoManager' in runtimeClient && runtimeClient.userInfoManager
        ),
        loginMode,
        appKeyLength: currentAppKey.trim().length,
        userIdLength: userId.trim().length,
        tokenLength: authToken.trim().length,
        defaultPasswordLength: defaultPassword.trim().length,
      });
      await withTimeout(runtimeClient.login({ userId, token: authToken }), LOGIN_TIMEOUT, '登录');
      setClient(runtimeClient);
      setCurrentUserId(runtimeClient.getCurrentUserId());
      setStatus(runtimeClient.getConnectionState());
      addLog('success', '登录成功');
      // eslint-disable-next-line no-console
      console.log('[demo] login success', {
        userId: runtimeClient.getCurrentUserId(),
        currentStatus: runtimeClient.getConnectionState(),
        hasUserInfoManager: Boolean(runtimeClient.userInfoManager),
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log('[demo] login failed', error);
      if (runtimeClient.getConnectionState() !== 'disconnected') {
        try {
          await withTimeout(runtimeClient.logout(), LOGOUT_TIMEOUT, '登录失败后取消连接');
        } catch (logoutError) {
          addLog('warn', `登录失败后取消连接失败: ${formatError(logoutError)}`);
        }
      }
      setStatus(runtimeClient.getConnectionState());
      setCurrentUserId(runtimeClient.getCurrentUserId());
      addLog('error', `登录失败: ${formatError(error)}`);
    }
  };

  const handleLogout = async (): Promise<void> => {
    if (!client) {
      addLog('warn', '请先初始化 SDK');
      return;
    }

    try {
      client.contactManager.removeEventHandler(CONTACT_HANDLER_ID);
      client.presenceManager.removeEventHandler(PRESENCE_HANDLER_ID);
      client.userInfoManager.removeEventHandler(USER_INFO_MANAGER_HANDLER_ID);
      client.groupManager.removeEventHandler(GROUP_PROFILE_HANDLER_ID);
      client.removeEventHandler(USER_INFO_SYNC_HANDLER_ID);
      await withTimeout(client.logout(), LOGOUT_TIMEOUT, '登出');
      setCurrentUserId(null);
      setStatus(client.getConnectionState());
      clearPresenceStates();
      handleClearConversations();
      handleClearProfileSyncEvents();
      addLog('success', '登出成功');
    } catch (error) {
      addLog('error', `登出失败: ${formatError(error)}`);
    }
  };

  const handleClearLogs = (): void => {
    setLogs([]);
  };

  const handleClearMessages = (): void => {
    setMessages([]);
  };

  const isInitialized = client !== null;

  const renderTabPanel = (tabKey: DemoTabKey): JSX.Element => {
    switch (tabKey) {
      case 'init':
        return (
          <>
            <InitPanel
              status={status}
              isInitialized={isInitialized}
              onInit={handleInit}
              defaultAppKey={defaultAppKey}
              defaultDnsUrls={defaultDnsUrls}
              defaultUseDnsConfig={defaultUseDnsConfig}
              defaultRestApiUrl={defaultRestApiUrl}
              defaultWsUrl={defaultWsUrl}
              defaultSyncWsUrl={defaultSyncWsUrl}
              fixedServerPresets={DEMO_FIXED_SERVER_PRESETS}
              defaultFixedServerPresetId={defaultFixedServerPreset?.id}
              defaultEnableUserInfoSync={currentEnableUserInfoSync}
              defaultEnableSyncData={defaultEnableSyncData}
              defaultCacheEncryptionMode={currentCacheEncryptionMode}
            />
            <LoginPanel
              status={status}
              isInitialized={isInitialized}
              currentUserId={currentUserId}
              onLogin={handleLogin}
              onLogout={handleLogout}
              onAddLog={addLog}
              defaultUserId={defaultUserId}
              defaultToken={defaultToken}
              defaultPassword={defaultPassword}
            />
          </>
        );
      case 'send':
        return (
          <SendPanel
            client={client}
            onAddLog={addLog}
            onAddMessage={upsertMessage}
            defaultTargetId={defaultTargetId}
            defaultChannelType={defaultChannelType}
            defaultMessage={defaultMessage}
          />
        );
      case 'chat-manager':
        return (
          <ChatManagerPanel client={client} onAddLog={addLog} defaultTargetId={defaultTargetId} />
        );
      case 'combine':
        return (
          <CombineMessagePanel
            client={client}
            messages={messages}
            onAddLog={addLog}
            onAddMessage={upsertMessage}
            defaultTargetId={defaultTargetId}
            defaultChannelType={defaultChannelType}
          />
        );
      case 'presence':
        return (
          <PresencePanel
            client={client}
            onAddLog={addLog}
            onUpdatePresence={upsertPresenceStates}
            onClearPresence={clearPresenceStates}
            presenceStates={presenceStates}
          />
        );
      case 'contact':
        return <ContactPanel client={client} onAddLog={addLog} defaultTargetId={defaultTargetId} />;
      case 'user-info':
        return (
          <UserInfoPanel client={client} onAddLog={addLog} defaultTargetId={defaultTargetId} />
        );
      case 'chatroom':
        return (
          <ChatRoomPanel client={client} onAddLog={addLog} defaultChatRoomId={defaultTargetId} />
        );
      case 'thread':
        return (
          <ChatThreadPanel client={client} onAddLog={addLog} defaultParentId={defaultTargetId} />
        );
      case 'group':
        return <GroupPanel client={client} onAddLog={addLog} defaultGroupId={defaultTargetId} />;
      case 'push':
        return (
          <PushPanel client={client} onAddLog={addLog} defaultConversationId={defaultTargetId} />
        );
      case 'profileSync':
        return (
          <ProfileSyncPanel
            client={client}
            enableUserInfoSync={currentEnableUserInfoSync}
            currentUserId={currentUserId}
            messages={messages}
            conversations={conversations}
            userInfoEvents={userInfoEvents}
            groupNamecardEvents={groupNamecardEvents}
            onAddLog={addLog}
            onClearEvents={handleClearProfileSyncEvents}
          />
        );
      case 'cache':
        return (
          <CacheDebugPanel
            client={client}
            appKey={currentAppKey}
            currentUserId={currentUserId}
            cacheEncryptionMode={currentCacheEncryptionMode}
            onAddLog={addLog}
          />
        );
      case 'conversation':
        return (
          <>
            <SessionListPanel
              client={client}
              sessions={conversationItems}
              capabilityLabel={sessionListCapability}
              onAddLog={addLog}
              onClear={handleClearConversationItems}
            />
            <ConversationPanel
              client={client}
              conversations={conversations}
              sourceLabel={conversationSource ?? undefined}
              onClear={handleClearConversations}
              onAddLog={addLog}
            />
          </>
        );
      case 'message':
        return (
          <MessagePanel
            client={client}
            messages={messages}
            onAddLog={addLog}
            onClear={handleClearMessages}
          />
        );
      case 'voice-to-text':
        return <VoiceToTextPanel client={client} messages={messages} onAddLog={addLog} />;
      case 'search':
        return <SearchPanel client={client} onAddLog={addLog} />;
      case 'log':
        return <LogPanel logs={logs} onClear={handleClearLogs} />;
      default:
        return <div className="card">未知模块</div>;
    }
  };

  return (
    <div className="container">
      <h1>IM SDK Demo</h1>
      <div className="card" data-testid="demo-summary">
        <div className="card-title">运行摘要</div>
        <p data-testid="demo-initialized">initialized: {String(isInitialized)}</p>
        <p data-testid="demo-connection-state">connectionState: {status}</p>
        <p data-testid="demo-current-user">currentUserId: {currentUserId ?? ''}</p>
      </div>
      <div className="tab-nav">
        {DEMO_TAB_ITEMS.map((tab: DemoTabItem) => (
          <button
            key={tab.key}
            className={`tab-button${tab.key === activeTab ? ' tab-button-active' : ''}`}
            data-testid={`tab-${tab.key}`}
            onClick={(): void => {
              setActiveTab(tab.key);
            }}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="tab-content">
        {DEMO_TAB_ITEMS.map((tab: DemoTabItem) => (
          <section
            key={tab.key}
            className={`tab-panel${tab.key === activeTab ? ' tab-panel-active' : ''}`}
            hidden={tab.key !== activeTab}
          >
            {renderTabPanel(tab.key)}
          </section>
        ))}
      </div>
    </div>
  );
};
