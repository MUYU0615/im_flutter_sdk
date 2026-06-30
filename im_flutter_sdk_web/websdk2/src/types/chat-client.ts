/**
 * [zh-CN] ChatClient 对外类型定义。
 * [en-US] Public ChatClient type definitions.
 */

import type { ConnectionStatus } from './connection'; // 连接状态类型
import type { ManagerRegistration } from './manager'; // 管理器注册类型
import type { SyncDataType } from './sync-data';

/**
 * [zh-CN] 对外暴露的连接状态枚举别名。
 * [en-US] Public connection-state alias.
 */
export type ConnectionState = ConnectionStatus; // 对外连接状态类型

/**
 * [zh-CN] 固定服务地址配置。
 * [en-US] Fixed service endpoint configuration.
 */
export interface ServerUrlsConfig {
  /** [zh-CN] REST API 基础地址。 [en-US] REST API base URL. */
  readonly restApiUrl?: string;
  /** [zh-CN] 消息 WebSocket 地址。 [en-US] Message WebSocket URL. */
  readonly wsUrl?: string;
  /** [zh-CN] 会话/联系人同步 REST API 基础地址。 [en-US] Session/contact sync REST API base URL. */
  readonly syncRestApiUrl?: string;
  /** [zh-CN] 会话/联系人同步 WebSocket 地址。 [en-US] Session/contact sync WebSocket URL. */
  readonly syncWsUrl?: string;
}

/**
 * [zh-CN] 服务接入配置。
 * [en-US] Service access configuration.
 */
export interface ServiceConfig {
  /** [zh-CN] DNS_CONFIG 地址列表；配置后仍走 DNS_CONFIG 发现流程。 [en-US] DNS_CONFIG URL list; SDK still resolves service endpoints through DNS_CONFIG. */
  readonly dnsConfigUrls?: string[];
  /** [zh-CN] 固定服务地址；配置后直连这些地址，不请求 DNS_CONFIG。 [en-US] Fixed service URLs; SDK connects directly and skips DNS_CONFIG. */
  readonly serverUrls?: ServerUrlsConfig;
}

/**
 * [zh-CN] 消息资料回填节流配置。
 * [en-US] Message profile-hydration throttling configuration.
 */
export interface ProfileSyncConfig {
  /** [zh-CN] 用户资料回填聚合窗口，单位毫秒。 [en-US] Aggregation window for user-info hydration in milliseconds. */
  readonly userInfoWindowMs?: number;
  /** [zh-CN] 单次用户资料回填批大小。 [en-US] Batch size for one user-info hydration request. */
  readonly userInfoBatchSize?: number;
  /** [zh-CN] 群名片回填聚合窗口，单位毫秒。 [en-US] Aggregation window for group-namecard hydration in milliseconds. */
  readonly groupNamecardWindowMs?: number;
  /** [zh-CN] 群名片回填最大并发数。 [en-US] Maximum concurrency for group-namecard hydration. */
  readonly groupNamecardMaxConcurrency?: number;
}

/**
 * [zh-CN] 会话列表同步配置。
 * [en-US] Session-list sync configuration.
 */
export interface SyncConversationListConfig {
  /** [zh-CN] 是否同步空会话；会话标记固定同步。 [en-US] Whether empty sessions should be synced; session marks are always synced. */
  readonly includeEmpty?: boolean;
}

/**
 * [zh-CN] ChatClient 初始化配置。
 * [en-US] ChatClient initialization options.
 */
export interface InitConfig {
  /** [zh-CN] 应用唯一标识，格式为 `org#app`。 [en-US] Unique application key in `org#app` format. */
  appKey: string;
  /** [zh-CN] 是否启用用户资料同步增强能力。 [en-US] Whether to enable enhanced user-profile sync. */
  enableUserInfoSync?: boolean;
  /** [zh-CN] 登录后自动同步的数据类型。 [en-US] Data types to synchronize automatically after login. */
  enableSyncData?: ReadonlyArray<SyncDataType>;
  /**
   * [zh-CN] 是否开启送达回执。开启后，收到单聊消息时 SDK 自动向发送方回送达回执；发送方通过 `onMessageDelivered` 事件得知消息已送达。
   * [en-US] Whether to enable delivery receipts. When enabled, the SDK automatically sends a delivery ack to the sender upon receiving a single-chat message; the sender receives `onMessageDelivered` event.
   */
  enableDeliveryReceipt?: boolean;
  /** [zh-CN] 会话列表同步配置。 [en-US] Session-list synchronization options. */
  syncConversationListConfig?: SyncConversationListConfig;
  /** [zh-CN] 是否使用自定义附件上传能力。 [en-US] Whether to use custom attachment upload. */
  useCustomAttachmentUpload?: boolean;
  /** [zh-CN] 是否在同一浏览器内复用固定设备标识。 [en-US] Whether to reuse a fixed device identifier in the same browser. */
  useFixedDeviceId?: boolean;
  /** [zh-CN] 自定义设备标识；未传时使用 SDK 默认值。 [en-US] Custom device identifier; SDK default is used when omitted. */
  deviceId?: string;
  /** [zh-CN] 服务接入配置；缺省时使用 SDK 内置 DNS_CONFIG。 [en-US] Service endpoint configuration; omitted means SDK default DNS_CONFIG. */
  serviceConfig?: ServiceConfig;
  /** [zh-CN] 内容审核替换后，是否将替换后的消息回给发送方。 [en-US] Whether to return moderation-replaced message content to the sender. */
  useReplacedMessageContents?: boolean;
  /** [zh-CN] 自定义设备名称；通常与 `customOsPlatform` 搭配使用。 [en-US] Custom device name, usually used with `customOsPlatform`. */
  customDeviceName?: string;
  /** [zh-CN] 自定义平台编号。 [en-US] Custom platform code. */
  customOsPlatform?: number;
  /** [zh-CN] 是否启用自动登录续连行为。 [en-US] Whether to enable auto-login reconnect behavior. */
  /** [zh-CN] UI Kit 版本号，用于上报。 [en-US] UI Kit version used for reporting. */
  uiKitVersion?: string;
  /**
   * [zh-CN] 登录自定义扩展信息。当多设备登录策略导致当前设备被踢时，该扩展字符串会传递给被踢设备，最大长度 1024 字符。
   * [en-US] Custom login extension string. When this device is kicked out by multi-device login policy, the string is delivered to the kicked device. Maximum length is 1024 characters.
   */
  loginExtensionInfo?: string;
  /** [zh-CN] 初始化时需要自动注册的管理器列表。 [en-US] Managers to auto-register during initialization. */
  managers?: ReadonlyArray<ManagerRegistration<unknown>>;
}

/**
 * [zh-CN] 登录参数。
 * [en-US] Login parameters.
 */
export interface AuthContext {
  /** [zh-CN] 登录用户 ID。 [en-US] User ID to log in with. */
  userId: string;
  /** [zh-CN] IM 登录 token。 [en-US] IM login token. */
  token: string;
}

/**
 * [zh-CN] IM token 续期结果。
 * [en-US] IM token renewal result.
 */
export interface TokenRenewalResult {
  /** [zh-CN] 已成功应用的新 IM token。 [en-US] The renewed IM token that has been applied. */
  readonly token: string;
  /** [zh-CN] token 过期时间戳，单位毫秒。 [en-US] Token expiration timestamp in milliseconds. */
  readonly expireAt: number;
}

/**
 * [zh-CN] RTC token 查询参数。
 * [en-US] Parameters for requesting RTC token information.
 */
export interface GetRTCTokenInfoParams {
  /** [zh-CN] RTC 频道名；不传时使用服务端默认频道语义。 [en-US] RTC channel name; omitted means service default. */
  readonly channelName?: string;
}

/**
 * [zh-CN] RTC token 信息。
 * [en-US] RTC token information.
 */
export interface RTCTokenInfo {
  /** [zh-CN] RTC App ID。 [en-US] RTC App ID. */
  readonly appId: string;
  /** [zh-CN] RTC 入会 token。 [en-US] RTC token used for joining the channel. */
  readonly rtcToken: string;
  /** [zh-CN] RTC 频道名。 [en-US] RTC channel name. */
  readonly channelName: string;
  /** [zh-CN] 当前用户的 RTC UID。 [en-US] RTC UID for the current user. */
  readonly rtcUid: number;
  /** [zh-CN] RTC token 过期时间戳，单位毫秒。 [en-US] RTC token expiration timestamp in milliseconds. */
  readonly expireAt: number;
}

/**
 * [zh-CN] RTC UID 类型别名。
 * [en-US] RTC UID type alias.
 */
export type RTCUid = number;

/**
 * [zh-CN] RTC UID 到 IM userId 的映射。
 * [en-US] Mapping from RTC UID to IM userId.
 */
export type RTCUidUserIdMap = Record<RTCUid, string>;

/**
 * [zh-CN] 当前用户在其他平台上的登录 ID 列表。
 * [en-US] Login IDs of the current user on other platforms.
 */
export type SelfIdsOnOtherPlatform = ReadonlyArray<string>;

/**
 * [zh-CN] REST 访问上下文。
 * [en-US] REST access context.
 */
export interface RestContext {
  /** [zh-CN] REST 基础地址。 [en-US] REST base URL. */
  readonly restBaseUrl: string;
  /** [zh-CN] 当前应用的 appKey。 [en-US] appKey of the current application. */
  readonly appKey: string;
  /** [zh-CN] 当前登录用户 ID。 [en-US] Current logged-in user ID. */
  readonly userId: string;
  /** [zh-CN] 当前登录 token。 [en-US] Current access token. */
  readonly token: string;
  /** [zh-CN] 当前连接的设备资源标识。 [en-US] Device resource identifier of the current connection. */
  readonly clientResource: string;
}

/**
 * [zh-CN] DNS Host 信息。
 * [en-US] DNS host information.
 */
export interface DnsHost {
  /** [zh-CN] 地址协议。 [en-US] Endpoint protocol. */
  protocol: string;
  /** [zh-CN] 域名。 [en-US] Domain name. */
  domain?: string;
  /** [zh-CN] IP 地址。 [en-US] IP address. */
  ip?: string;
  /** [zh-CN] 端口号。 [en-US] Port number. */
  port?: string | number;
}

/**
 * [zh-CN] DNSConfig 响应结构。
 * [en-US] DNSConfig response structure.
 */
export interface DnsConfig {
  /** [zh-CN] REST 服务地址集合。 [en-US] REST service host set. */
  rest: { hosts: DnsHost[] };
  /** [zh-CN] 消息 WebSocket 地址集合。 [en-US] Message WebSocket host set. */
  'msync-wx': { hosts: DnsHost[] };
  /** [zh-CN] 会话/联系人同步 WebSocket 地址集合。 [en-US] Session/contact sync WebSocket host set. */
  'sync-ws'?: { hosts: DnsHost[] };
  /** [zh-CN] 日志上报开关（DNS 下发）。 [en-US] Log-report switch delivered by DNS. */
  enableReportLogs?: 'true' | 'false';
}
