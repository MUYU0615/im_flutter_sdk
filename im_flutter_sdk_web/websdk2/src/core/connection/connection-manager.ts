/**
 * 连接管理器
 * 
 * 负责 WebSocket 连接管理、状态管理、事件处理
 * 参考：engineCore/connection.ts
 */

import { EventHub } from '../events/event-hub'; // 事件中心
import { ConnectionEventName, ConnectionEventReason, ConnectionStatus, InternalEventName } from '../../types'; // 连接事件常量
import type {
  Connection,
  ConnectionEventPayload,
  SendTimeoutEventPayload,
  TokenRenewalResult,
} from '../../types'; // 连接类型
import { ConnectionError } from '../../utils/errors';
import { ERROR_CODES } from '../../utils/error-codes';
import { resolveProvisionError } from '../../utils/provision-error-mapping';
import { logger } from '../../utils/logger';
import { CONNECT_TIMEOUT, HEARTBEAT_INTERVAL, HEARTBEAT_TIMEOUT, PROVISION_TIMEOUT, RECONNECT_BACKOFF_MULTIPLIER, RECONNECT_INITIAL_DELAY, RECONNECT_MAX_DELAY } from '../../config/timeouts'; // 超时配置
import { ConnectionEventNormalizer } from '../../platform/runtime/connection-event-normalizer';
import {
  SOCKET_READY_STATE,
  createPlatformError,
  type SocketAdapter,
  type SocketLike,
  type SocketMessageData,
} from '../../platform';
import { createWebSocketAdapter } from '../../platform/socket/web-socket-adapter';
import { ConnectionRetry } from './connection-retry'; // 重连退避管理器
import { HeartbeatManager } from './heartbeat'; // 心跳管理器
import {
  MsyncCodec,
  type StatisticOperationResult,
  type SyncDecodeResult,
} from '../../protocol/msync/codec';
import { MsyncCommand } from '../../protocol/msync/types';
import type { MessageReceiver } from '../message/message-receiver';

const SERVER_NORMAL_CLOSE_CODE = 3000; // 服务端普通关闭文本帧 code
const SERVER_NORMAL_CLOSE_REASON = 'normal closed'; // 服务端普通关闭文本帧 reason

/**
 * 连接配置
 */
export interface ConnectionConfig {
  serverUrl: string;
  serverUrls?: ReadonlyArray<string>; // WebSocket 地址列表
  userId: string;
  token: string;
  appKey: string;
  useCustomAttachmentUpload?: boolean;
  heartBeatWait?: number; // 心跳间隔，默认 30000ms
  autoReconnectNumMax?: number; // 最大重连次数
  connectTimeout?: number; // 连接超时，默认 2000ms
  useReplacedMessageContents?: boolean; // 是否使用替换后的消息内容
  useFixedDeviceId?: boolean; // 是否固定设备标识
  deviceId?: string; // 设备标识基础值
  customDeviceName?: string; // 自定义设备名称
  customOsPlatform?: number; // 自定义平台值
  uiKitVersion?: string; // UIKit 版本上报
  loginExtensionInfo?: string; // 登录自定义扩展信息
  socketAdapter?: SocketAdapter; // 平台 socket 适配器
}

interface TokenLifecycleState {
  readonly token: string;
  readonly issuedAt: number;
  readonly expireAt: number;
  readonly willExpireAt: number;
  willExpireEmitted: boolean;
  expiredEmitted: boolean;
}

/**
 * 连接管理器
 */
export class ConnectionManager {
  private config: ConnectionConfig & Required<Pick<ConnectionConfig, 'heartBeatWait' | 'autoReconnectNumMax' | 'connectTimeout'>>;
  private serverUrls: ReadonlyArray<string>; // WebSocket 地址候选列表
  private serverUrlIndex: number = 0; // WebSocket 轮询索引
  private websocket: SocketLike | null = null;
  private connection: Connection;
  private provisionTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts: number = 0;
  private eventHub: EventHub;
  private messageReceiver: MessageReceiver | null = null;
  private msyncCodec: MsyncCodec;
  private provisionPromise: Promise<void> | null = null;
  private provisionResolve: (() => void) | null = null;
  private provisionReject: ((error: Error) => void) | null = null;
  private queues: Array<Record<string, unknown>> = [];
  private currentQueueName: string | null = null;
  private nextKey: string | null = null;
  private offlineMessageSyncing = false;
  private offlineMessageQueueNames: Set<string> = new Set();
  private readonly connectionRetry: ConnectionRetry; // 重连退避控制器
  private reconnectTimerId: ReturnType<typeof setTimeout> | null = null; // 重连定时器
  private reconnectInProgress = false; // 是否正在重连
  private reconnectPaused = false; // 是否暂停重连
  private offlineRecoverPending = false; // 是否等待离线恢复重连
  private isLoginPhase = false; // 是否登录阶段
  private isLoggedIn = false; // 是否已登录
  private hasEverConnected = false; // 是否曾经连接成功
  private isOnline = true; // 当前网络状态
  private readonly heartbeatManager: HeartbeatManager; // 心跳管理器
  private readonly internalHandlerId = '__internal:connection-manager'; // 内部事件处理器 ID
  private suppressNextCloseEvent = false; // 是否忽略下一次 close 事件
  private readonly connectionEventNormalizer: ConnectionEventNormalizer; // 连接事件归一化器
  private readonly socketAdapter: SocketAdapter;
  private socketDisposers: Array<() => void> = [];
  private inboundMessageQueue: Promise<void> = Promise.resolve();
  private socketGeneration = 0;
  private tokenLifecycle: TokenLifecycleState | null = null;
  private tokenWillExpireTimerId: ReturnType<typeof setTimeout> | null = null;
  private tokenExpiredTimerId: ReturnType<typeof setTimeout> | null = null;

  constructor(config: ConnectionConfig, eventHub: EventHub) {
    this.config = {
      heartBeatWait: HEARTBEAT_INTERVAL, // 心跳间隔默认值
      autoReconnectNumMax: 10,
      connectTimeout: CONNECT_TIMEOUT,
      ...config,
    };
    this.eventHub = eventHub;
    this.msyncCodec = new MsyncCodec({
      appKey: config.appKey,
      useCustomAttachmentUpload: config.useCustomAttachmentUpload,
      userId: config.userId,
      token: config.token,
      useReplacedMessageContents: config.useReplacedMessageContents,
      useFixedDeviceId: config.useFixedDeviceId,
      deviceId: config.deviceId,
      customDeviceName: config.customDeviceName,
      customOsPlatform: config.customOsPlatform,
      uiKitVersion: config.uiKitVersion,
      loginExtensionInfo: config.loginExtensionInfo,
    });

    this.serverUrls = this.normalizeServerUrls(config); // 初始化 ws 地址列表
    this.config.serverUrl = this.serverUrls[0] ?? this.config.serverUrl; // 写回默认 ws 地址

    this.connection = {
      status: ConnectionStatus.DISCONNECTED,
      serverUrl: this.config.serverUrl,
      userId: config.userId,
      token: config.token,
      reconnectAttempts: 0,
    };

    this.connectionRetry = new ConnectionRetry({ // 初始化重连退避策略
      maxAttempts: this.config.autoReconnectNumMax, // 最大重连次数
      initialDelay: RECONNECT_INITIAL_DELAY, // 初始延迟
      maxDelay: RECONNECT_MAX_DELAY, // 最大延迟
      backoffMultiplier: RECONNECT_BACKOFF_MULTIPLIER, // 退避倍数
    });
    this.heartbeatManager = new HeartbeatManager({ // 初始化心跳管理器
      interval: this.config.heartBeatWait, // 心跳间隔
      timeout: HEARTBEAT_TIMEOUT, // 心跳超时
    });
    this.connectionEventNormalizer = new ConnectionEventNormalizer(); // 初始化连接事件归一化器
    this.socketAdapter = this.resolveSocketAdapter(config);
    this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true; // 初始化网络状态
    this.eventHub.addEventHandler(this.internalHandlerId, { // 注册内部事件处理器
      [InternalEventName.SEND_TIMEOUT]: (payload): void => { // 监听发送超时
        this.handleSendTimeout(payload); // 处理发送超时重连
      },
    });
  }

  /**
   * 获取连接状态
   */
  getConnectionStatus(): ConnectionStatus {
    return this.connection.status;
  }

  /**
   * 获取 WebSocket 实例（用于消息发送）
   */
  getWebSocket(): SocketLike | null {
    return this.websocket;
  }

  /**
   * 获取 MSync 编解码器（供消息模块复用）
   */
  getMsyncCodec(): MsyncCodec {
    return this.msyncCodec;
  }

  /**
   * 获取客户端资源标识
   */
  getClientResource(): string { // 获取客户端资源标识
    return this.msyncCodec.getContext().clientResource; // 返回 clientResource
  }

  /**
   * 绑定消息接收器（用于处理下行消息）
   */
  setMessageReceiver(receiver: MessageReceiver): void {
    this.messageReceiver = receiver;
  }

  /**
   * 更新当前连接使用的 IM token。
   * Updates the IM token used by the current connection.
   */
  renewToken(token: string, expireAt: number): TokenRenewalResult {
    const now = Date.now();
    if (expireAt <= now) {
      throw new ConnectionError('Token is expired', {
        code: ERROR_CODES.AUTH_TOKEN_EXPIRED,
        details: {
          stage: 'token',
        },
      });
    }

    this.config.token = token;
    this.connection.token = token;
    this.msyncCodec.updateToken(token);
    this.setupTokenLifecycle(token, expireAt, now);
    logger.warn('Connection token renewed', {
      userId: this.config.userId,
      expireAt,
    });
    return {
      token,
      expireAt,
    };
  }

  /**
   * 处理在线事件
   */
  public handleOnline(): void {
    this.isOnline = true; // 更新在线状态
    const reconnectReason = this.offlineRecoverPending
      ? ConnectionEventReason.OFFLINE_RECOVER
      : ConnectionEventReason.ONLINE; // 统一在线恢复触发原因
    this.offlineRecoverPending = false; // 清理离线恢复标记
    if (!this.isLoggedIn) { // 未登录不处理
      return; // 直接返回
    }
    if (this.connection.status === ConnectionStatus.CONNECTED && this.websocket) { // 已连接无需重连
      return; // 直接返回
    }
    this.reconnectPaused = false; // 恢复重连
    this.resetReconnectState(); // 重置重连状态
    void this.triggerReconnect(reconnectReason); // 触发重连
  }

  /**
   * 处理离线事件
   */
  public handleOffline(): void {
    this.isOnline = false; // 更新在线状态
    this.offlineRecoverPending = true; // 标记后续在线事件为离线恢复
    this.reconnectPaused = true; // 暂停重连
    this.clearReconnectTimer(); // 清理重连定时器
    this.stopHeartbeat(); // 停止心跳
    this.closeWebSocket(ConnectionEventReason.OFFLINE, true); // 主动关闭连接
  }

  /**
   * 处理前台恢复事件
   */
  public async handleForeground(): Promise<void> {
    if (!this.isLoggedIn) { // 未登录不处理
      return; // 直接返回
    }
    if (!this.isOnline) { // 离线不处理
      return; // 直接返回
    }
    try { // 捕获心跳探测异常
      const heartbeatOk = await this.checkHeartbeatOnce(); // 执行心跳探测
      if (!heartbeatOk) { // 心跳失败则重连
        void this.triggerReconnect(ConnectionEventReason.HEARTBEAT_FAILED); // 触发重连
      }
    } catch (error) { // 心跳探测异常
      logger.warn('Foreground heartbeat check failed', error); // 记录心跳异常
      void this.triggerReconnect(ConnectionEventReason.HEARTBEAT_FAILED); // 触发重连
    }
  }

  private handleSendTimeout(payload: SendTimeoutEventPayload): void {
    if (!this.isLoggedIn) { // 未登录不触发重连
      return; // 直接返回
    }
    if (!this.isOnline) { // 离线不触发重连
      return; // 直接返回
    }
    if (this.reconnectPaused) { // 暂停重连时忽略
      return; // 直接返回
    }
    if (payload.reason !== ConnectionEventReason.SEND_TIMEOUT) { // 仅处理发送超时
      return; // 直接返回
    }
    logger.warn('Message send timeout received without reconnect', payload); // 仅记录超时，避免 ACK 异常导致错误重连
  }

  private resetReconnectState(): void {
    this.reconnectAttempts = 0; // 重置重连次数
    this.connection.reconnectAttempts = 0; // 同步连接状态
    this.connectionRetry.reset(); // 重置退避计数
  }

  private normalizeServerUrls(config: ConnectionConfig): string[] { // 规范化 ws 地址列表
    const urls = (config.serverUrls ?? []).filter((url): url is string => { // 过滤有效地址
      return typeof url === 'string' && url.length > 0; // 仅保留非空字符串
    }); // 过滤结束
    if (urls.length > 0) { // 存在有效列表
      return [...urls]; // 返回拷贝避免外部修改
    } // 列表分支结束
    return [config.serverUrl]; // 回退到单一地址
  }

  private pickNextServerUrl(): string { // 轮询选择下一个 ws 地址
    if (this.serverUrls.length === 0) { // 无可用地址时回退
      return this.config.serverUrl; // 返回默认地址
    } // 无地址分支结束
    const currentIndex = this.serverUrlIndex % this.serverUrls.length; // 计算当前索引
    const nextUrl = this.serverUrls[currentIndex] ?? this.config.serverUrl; // 获取下一个地址
    this.serverUrlIndex = (currentIndex + 1) % this.serverUrls.length; // 更新轮询索引
    this.config.serverUrl = nextUrl; // 写回当前地址
    this.connection.serverUrl = nextUrl; // 同步连接信息
    return nextUrl; // 返回地址
  }

  private resolveEffectiveMaxAttempts(): number { // 计算有效最大尝试次数
    if (this.isLoginPhase && this.config.autoReconnectNumMax === 0) { // 登录阶段且配置为 0
      return 1; // 至少尝试一次
    } // 登录分支结束
    return this.config.autoReconnectNumMax; // 使用配置值
  }

  private isNonRetryableError(error: Error): boolean { // 判断是否不可重试错误
    if (!(error instanceof ConnectionError)) { // 非连接错误直接可重试
      return false; // 返回可重试
    } // 类型判断结束
    const details = error.details; // 读取错误详情
    if (!details || typeof details !== 'object') { // 无详情或格式不匹配
      return false; // 视为可重试
    } // 详情判断结束
    const retryable = (details as { retryable?: unknown }).retryable; // 读取 retryable 标记
    return retryable === false; // retryable=false 表示不可重试
  }

  private isServerNormalClosePayload(payload: Uint8Array): boolean {
    if (payload.length > 64) { // 普通关闭帧很短，避免对业务 payload 做无意义文本解析
      return false;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(new TextDecoder().decode(payload));
    } catch {
      return false;
    }
    if (!Array.isArray(parsed) || parsed.length < 2) {
      return false;
    }
    return parsed[0] === SERVER_NORMAL_CLOSE_CODE && parsed[1] === SERVER_NORMAL_CLOSE_REASON;
  }

  private clearReconnectTimer(): void {
    if (!this.reconnectTimerId) { // 没有定时器
      return; // 直接返回
    }
    clearTimeout(this.reconnectTimerId); // 清理定时器
    this.reconnectTimerId = null; // 重置标记
  }

  private async waitForReconnectDelay(): Promise<void> {
    const delay = this.connectionRetry.getRetryDelay(); // 计算退避延迟
    this.clearReconnectTimer(); // 清理旧定时器
    await new Promise<void>((resolve) => { // 等待延迟结束
      this.reconnectTimerId = setTimeout(() => { // 设置重连定时器
        this.reconnectTimerId = null; // 清理定时器引用
        resolve(); // 结束等待
      }, delay);
    });
  }

  private buildConnectionEventPayload(state: ConnectionStatus, reason: ConnectionEventReason): ConnectionEventPayload {
    const connectionError =
      this.connection.error instanceof ConnectionError ? this.connection.error : undefined;
    return {
      state, // 连接状态
      reason, // 触发原因
      attempt: this.reconnectAttempts, // 当前尝试次数
      maxAttempts: this.resolveEffectiveMaxAttempts(), // 最大尝试次数
      isLoginPhase: this.isLoginPhase, // 是否登录阶段
      isOnline: this.isOnline, // 是否在线
      errorCode: connectionError?.code,
      errorMessage: connectionError?.message,
      timestamp: Date.now(), // 事件时间
    };
  }

  private dispatchConnectionEvent(status: ConnectionStatus, reason: ConnectionEventReason): void {
    if (status === ConnectionStatus.DISCONNECTED && !this.hasEverConnected) { // 未曾连接不触发断开事件
      return; // 直接返回
    }
    if (status === ConnectionStatus.RECONNECT_FAILED && !this.isLoggedIn) { // 未登录不触发失败事件
      return; // 直接返回
    }
    if (this.isLoginPhase && (status === ConnectionStatus.DISCONNECTED || status === ConnectionStatus.RECONNECT_FAILED)) { // 登录阶段禁止断开/失败事件
      return; // 直接返回
    }
    const payload = this.buildConnectionEventPayload(status, reason); // 构建事件载荷
    const normalizedEvent = this.connectionEventNormalizer.normalize(status, payload); // 归一化并去重事件
    if (!normalizedEvent) { // 重复事件不派发
      return; // 直接返回
    }
    this.eventHub.dispatch(normalizedEvent.eventName, normalizedEvent.payload); // 派发事件
  }

  private updateStatus(status: ConnectionStatus, reason: ConnectionEventReason, emitEvent: boolean, forceEmit: boolean = false): void {
    const statusChanged = this.connection.status !== status; // 判断状态是否变化
    if (!statusChanged && !forceEmit) { // 无变化且无需强制派发
      return; // 直接返回
    }
    if (statusChanged) { // 状态变化才更新状态
      this.connection.status = status; // 更新状态
      this.connection.lastConnectedAt = status === ConnectionStatus.CONNECTED ? Date.now() : undefined; // 更新连接时间
    }
    if (emitEvent) { // 需要派发事件
      this.dispatchConnectionEvent(status, reason); // 派发事件
    }
    logger.debug('Connection status updated', { status, reason, attempt: this.reconnectAttempts, forceEmit }); // 输出状态更新日志
  }

  private clampTimerDelay(delay: number): number {
    if (delay <= 0) {
      return 0;
    }
    return Math.min(delay, 2 ** 31 - 1);
  }

  private clearTokenTimers(): void {
    if (this.tokenWillExpireTimerId) {
      clearTimeout(this.tokenWillExpireTimerId);
      this.tokenWillExpireTimerId = null;
    }
    if (this.tokenExpiredTimerId) {
      clearTimeout(this.tokenExpiredTimerId);
      this.tokenExpiredTimerId = null;
    }
  }

  private setupTokenLifecycle(token: string, expireAt: number, issuedAt: number = Date.now()): void {
    this.clearTokenTimers();
    const duration = Math.max(expireAt - issuedAt, 0);
    const willExpireAt = issuedAt + Math.floor(duration * 0.8);
    this.tokenLifecycle = {
      token,
      issuedAt,
      expireAt,
      willExpireAt,
      willExpireEmitted: false,
      expiredEmitted: false,
    };

    this.tokenWillExpireTimerId = setTimeout(() => {
      this.emitTokenWillExpire();
    }, this.clampTimerDelay(willExpireAt - Date.now()));

    this.tokenExpiredTimerId = setTimeout(() => {
      this.handleTokenExpiredDisconnect('timer');
    }, this.clampTimerDelay(expireAt - Date.now()));
  }

  private emitTokenWillExpire(): void {
    if (!this.tokenLifecycle || this.tokenLifecycle.willExpireEmitted) {
      return;
    }
    this.tokenLifecycle.willExpireEmitted = true;
    logger.warn('Token will expire');
    this.eventHub.dispatch(ConnectionEventName.TOKEN_WILL_EXPIRE, undefined);
  }

  private emitTokenExpired(): void {
    if (!this.tokenLifecycle) {
      this.tokenLifecycle = {
        token: this.connection.token ?? '',
        issuedAt: Date.now(),
        expireAt: Date.now(),
        willExpireAt: Date.now(),
        willExpireEmitted: true,
        expiredEmitted: false,
      };
    }
    const lifecycle = this.tokenLifecycle;
    if (lifecycle.expiredEmitted) {
      return;
    }
    lifecycle.expiredEmitted = true;
    logger.warn('Token expired');
    this.eventHub.dispatch(ConnectionEventName.TOKEN_EXPIRED, undefined);
  }

  private isTokenExpiredConnectionError(error: Error): boolean {
    return error instanceof ConnectionError && error.code === ERROR_CODES.AUTH_TOKEN_EXPIRED;
  }

  private handleTokenExpiredDisconnect(source: 'timer' | 'server'): void {
    logger.warn('Connection closing because token expired', { source });
    this.connection.error = new ConnectionError('Token expired', {
      code: ERROR_CODES.AUTH_TOKEN_EXPIRED,
      details: {
        stage: 'token',
        source,
        retryable: false,
      },
    });
    this.emitTokenExpired();
    this.clearTokenTimers();
    this.clearReconnectTimer();
    this.resetProvisionHandlers();
    this.stopHeartbeat();
    this.reconnectPaused = true;
    this.reconnectInProgress = false;
    this.offlineRecoverPending = false;
    this.isLoginPhase = false;
    this.isLoggedIn = false;
    this.closeWebSocket(ConnectionEventReason.TOKEN_EXPIRED, true, true);
    this.updateStatus(ConnectionStatus.DISCONNECTED, ConnectionEventReason.TOKEN_EXPIRED, true);
  }

  private startHeartbeat(websocket: SocketLike): void {
    this.heartbeatManager.start(websocket, () => { // 启动心跳并绑定超时处理
      void this.triggerReconnect(ConnectionEventReason.HEARTBEAT_FAILED); // 心跳超时触发重连
    }, () => { // 绑定心跳发送逻辑
      this.sendHeartbeatPing(); // 发送心跳探测
    });
  }

  private stopHeartbeat(): void {
    this.heartbeatManager.stop(); // 停止心跳
  }

  private async checkHeartbeatOnce(): Promise<boolean> {
    if (!this.websocket) { // 无可用连接
      return false; // 直接失败
    }
    return this.heartbeatManager.probeOnce(this.websocket, HEARTBEAT_TIMEOUT); // 执行单次探测
  }

  private sendHeartbeatPing(): void { // 发送心跳探测消息
    const payload = this.msyncCodec.encodeHeartbeat(); // 构造心跳消息
    this.sendMsyncPayload(payload); // 发送心跳消息
  }

  /**
   * 建立连接
   */
  async connect(): Promise<void> {
    if (this.reconnectInProgress) { // 防止并发重连
      return; // 直接返回
    }
    if (this.connection.status === ConnectionStatus.CONNECTED || this.connection.status === ConnectionStatus.CONNECTING) { // 已连接或连接中
      logger.warn('Connection already established or connecting'); // 记录重复连接
      return; // 直接返回
    }

    this.isLoginPhase = true; // 标记登录阶段
    this.reconnectPaused = false; // 清理暂停标记
    this.resetReconnectState(); // 重置重连状态
    this.connectionEventNormalizer.reset(); // 新连接周期重置事件去重状态

    try { // 捕获登录失败
      await this.connectWithRetry(ConnectionEventReason.LOGIN, true); // 登录阶段连接重试
      this.isLoggedIn = true; // 登录成功标记
    } catch (error) { // 登录失败
      this.isLoggedIn = false; // 登录失败重置标记
      throw error; // 抛出失败
    } finally { // 始终结束登录阶段
      this.isLoginPhase = false; // 退出登录阶段
    }
  }

  private async connectWithRetry(reason: ConnectionEventReason, throwOnFailure: boolean): Promise<void> {
    if (this.reconnectInProgress) { // 防止并发重连
      return; // 直接返回
    }
    if (this.connection.status === ConnectionStatus.CONNECTED && this.websocket) { // 已连接且 WS 可用不需要重连
      return; // 直接返回
    }
    if (this.reconnectPaused) { // 已暂停重连
      return; // 直接返回
    }
    if (!this.isLoginPhase && this.config.autoReconnectNumMax === 0) { // 非登录且不允许自动重连
      return; // 直接返回
    }
    if (!this.isOnline && !this.isLoginPhase) { // 离线且非登录阶段不重连
      return; // 直接返回
    }

    this.reconnectInProgress = true; // 标记重连中
    let lastError: Error | null = null; // 记录最后一次错误
    let nonRetryableError: Error | null = null; // 记录不可重试错误
    const maxAttempts = this.resolveEffectiveMaxAttempts(); // 计算有效重试次数
    this.connectionRetry.reset(); // 重置退避计数
    try {
      while (this.connectionRetry.getAttemptCount() < maxAttempts) { // 循环重试
        this.connectionRetry.recordAttempt(); // 记录尝试
        this.reconnectAttempts = this.connectionRetry.getAttemptCount(); // 更新重连次数
        this.connection.reconnectAttempts = this.reconnectAttempts; // 同步连接状态

        const nextStatus = this.isLoginPhase ? ConnectionStatus.CONNECTING : ConnectionStatus.RECONNECTING; // 设置下一个状态
        this.updateStatus(nextStatus, reason, true, true); // 派发 connecting 事件（强制）
        this.prepareForConnectAttempt(); // 准备连接环境

        try {
          await this.connectOnce(); // 单次连接
          this.handleConnectSuccess(reason); // 处理连接成功
          return; // 成功退出
        } catch (error) {
          lastError = error as Error; // 记录错误
          logger.warn('Connection attempt failed', { attempt: this.reconnectAttempts, reason, error: lastError }); // 输出失败日志
          if (!this.isLoginPhase && this.isTokenExpiredConnectionError(lastError)) {
            this.handleTokenExpiredDisconnect('server');
            return;
          }
          if (this.isNonRetryableError(lastError)) { // 业务错误不重试
            nonRetryableError = lastError; // 记录不可重试错误
            break; // 终止重试循环
          }
        }

        if (this.connectionRetry.getAttemptCount() >= maxAttempts) { // 达到最大次数
          break; // 结束重试
        }
        if (this.reconnectPaused || (!this.isOnline && !this.isLoginPhase)) { // 进入暂停或离线
          break; // 结束重试
        }
        await this.waitForReconnectDelay(); // 等待退避时间
      }

      if (nonRetryableError) { // 业务错误终止
        this.connection.error = nonRetryableError; // 记录错误
        if (throwOnFailure) { // 登录阶段失败
          this.updateStatus(ConnectionStatus.DISCONNECTED, ConnectionEventReason.ERROR, false); // 更新状态但不派发事件
          throw nonRetryableError; // 抛出业务错误
        }
        this.reconnectPaused = true; // 暂停后续重连
        this.updateStatus(ConnectionStatus.DISCONNECTED, ConnectionEventReason.ERROR, true); // 更新断开状态
        return; // 终止重连
      }

      if (throwOnFailure) { // 登录阶段失败
        this.updateStatus(ConnectionStatus.DISCONNECTED, ConnectionEventReason.ERROR, false); // 更新状态但不派发事件
        throw lastError ?? new ConnectionError('Connection failed', { // 抛出最后错误
          code: ERROR_CODES.CONNECTION_WEBSOCKET_ERROR, // 错误码
          details: {
            stage: 'ws', // 错误阶段
          },
        });
      }

      this.reconnectPaused = true; // 达到上限后暂停重连
      this.updateStatus(ConnectionStatus.RECONNECT_FAILED, ConnectionEventReason.LIMIT, true); // 派发重连失败事件
    } finally {
      this.reconnectInProgress = false; // 重置重连状态
    }
  }

  private async connectOnce(): Promise<void> {
    await this.createWebSocketConnection(); // 建立 WebSocket 连接
  }

  private prepareForConnectAttempt(): void {
    this.clearReconnectTimer(); // 清理重连定时器
    this.stopHeartbeat(); // 停止心跳
    this.resetProvisionHandlers(); // 重置 provision 回调
    this.resetSyncState(); // 重置同步状态
    if (this.websocket) { // 关闭旧连接
      this.closeWebSocket(ConnectionEventReason.RECONNECT, false, false); // 静默关闭连接
    }
  }

  private handleConnectSuccess(reason: ConnectionEventReason): void {
    this.updateStatus(ConnectionStatus.CONNECTED, reason, true); // 派发连接成功
    this.hasEverConnected = true; // 标记曾经连接成功
    this.connection.error = undefined; // 清理错误
    this.resetReconnectState(); // 重置重连状态
    this.offlineRecoverPending = false; // 连接恢复后清理离线恢复标记
    this.reconnectPaused = false; // 清除暂停标记
    if (this.websocket) { // 启动心跳
      this.startHeartbeat(this.websocket); // 启动心跳
    }
    logger.warn('Connection established successfully'); // 连接成功关键事件
  }

  private async triggerReconnect(reason: ConnectionEventReason): Promise<void> {
    if (!this.isLoggedIn) { // 未登录不重连
      return; // 直接返回
    }
    if (this.reconnectInProgress) { // 已在重连中
      return; // 直接返回
    }
    if (this.reconnectPaused) { // 已暂停重连
      return; // 直接返回
    }
    if (this.connection.status === ConnectionStatus.CONNECTED && this.websocket) { // 已连接但需要强制重连
      this.closeWebSocket(reason, true, true); // 关闭连接并派发断开
    }
    await this.connectWithRetry(reason, false); // 执行重连流程
  }

  private handleDisconnection(reason: ConnectionEventReason): void {
    this.stopHeartbeat(); // 停止心跳
    this.updateStatus(ConnectionStatus.DISCONNECTED, reason, true); // 更新断开状态
    if (reason === ConnectionEventReason.TOKEN_EXPIRED) { // token 过期不使用旧 token 重连
      return; // 直接返回
    }
    if (!this.isLoggedIn) { // 未登录不触发重连
      return; // 直接返回
    }
    if (!this.isOnline) { // 离线不触发重连
      return; // 直接返回
    }
    if (this.reconnectPaused) { // 已暂停重连
      return; // 直接返回
    }
    void this.triggerReconnect(reason); // 触发重连
  }

  private closeWebSocket(reason: ConnectionEventReason, emitEvent: boolean, updateStatus: boolean = true): void {
    if (!this.websocket) { // 无可关闭连接
      if (updateStatus) { // 需要更新状态
        this.updateStatus(ConnectionStatus.DISCONNECTED, reason, emitEvent); // 更新状态
      }
      return; // 直接返回
    }
    this.suppressNextCloseEvent = true; // 忽略下一次 close 事件
    this.websocket.close(); // 主动关闭连接
    this.websocket = null; // 清理连接引用
    this.stopHeartbeat(); // 停止心跳
    if (updateStatus) { // 需要更新状态
      this.updateStatus(ConnectionStatus.DISCONNECTED, reason, emitEvent); // 更新状态
    }
  }

  /**
   * 创建 WebSocket 连接
   */
  private createWebSocketConnection(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const wsUrl = this.pickNextServerUrl(); // 轮询 WebSocket 地址
      logger.debug('WebSocket connecting', { url: wsUrl }); // 记录 WS 连接请求
      this.clearSocketListeners();
      let cancelled = false;
      const connectTimeout = setTimeout(() => {
        cancelled = true;
        reject(new ConnectionError('Connection timeout', {
          code: ERROR_CODES.CONNECTION_TIMEOUT,
          details: {
            stage: 'ws',
          },
        }));
      }, this.config.connectTimeout);

      this.socketAdapter.connect({ url: wsUrl })
        .then((websocket) => {
          clearTimeout(connectTimeout);
          if (cancelled || this.reconnectPaused) {
            websocket.close();
            return;
          }
          this.websocket = websocket; // 保存当前连接引用
          this.socketGeneration += 1;
          this.inboundMessageQueue = Promise.resolve();
          this.attachSocketListeners(websocket, this.socketGeneration);
          this.startProvision()
            .then((): void => {
              this.resetProvisionHandlers();
              if (cancelled || this.reconnectPaused) {
                this.closeWebSocket(ConnectionEventReason.ERROR, false, false);
                return;
              }
              resolve();
            })
            .catch((error: unknown): void => {
              this.resetProvisionHandlers();
              this.closeWebSocket(ConnectionEventReason.ERROR, false, false);
              reject(error instanceof Error ? error : new Error(String(error)));
            });
        })
        .catch((error) => {
          clearTimeout(connectTimeout);
          if (cancelled) {
            return;
          }
          const connectionError = error instanceof ConnectionError
            ? error
            : new ConnectionError('Failed to create WebSocket', {
                code: ERROR_CODES.CONNECTION_WEBSOCKET_ERROR,
                details: {
                  stage: 'ws',
                  cause: error instanceof Error ? error.message : String(error),
                },
              });
          this.handleConnectionError(connectionError, ConnectionEventReason.ERROR);
          reject(connectionError);
        });
    }).catch((error) => {
      if (error instanceof ConnectionError) {
        throw error;
      }
      const connectionError = new ConnectionError('Failed to create WebSocket', { // 构建创建错误
        code: ERROR_CODES.CONNECTION_WEBSOCKET_ERROR, // 错误码
        details: {
          stage: 'ws', // 错误阶段
          cause: error instanceof Error ? error.message : String(error),
        },
      });
      this.handleConnectionError(connectionError, ConnectionEventReason.ERROR); // 处理连接错误
      throw connectionError;
    });
  }

  /**
   * 处理 WebSocket 关闭
   */
  private handleWebSocketClose(event: { code?: number; reason?: string }): void {
    if (this.suppressNextCloseEvent) { // 忽略主动关闭回调
      this.suppressNextCloseEvent = false; // 重置忽略标记
      return; // 直接返回
    }
    logger.warn('WebSocket closed', { code: event.code, reason: event.reason }); // 记录 WS 关闭

    if (this.provisionReject) {
      void this.rejectProvisionAfterQueuedMessages();
    }
    this.websocket = null; // 清理连接引用
    this.clearSocketListeners();
    this.stopHeartbeat(); // 停止心跳
    this.handleDisconnection(ConnectionEventReason.CLOSE); // 处理断开
  }

  private async rejectProvisionAfterQueuedMessages(): Promise<void> {
    try {
      await this.inboundMessageQueue;
    } catch {
      // 队列中的消息处理错误会独立走连接错误处理，这里只负责 close 兜底。
    }
    if (!this.provisionReject) {
      return;
    }
    this.provisionReject(new ConnectionError('Provision interrupted', {
      code: ERROR_CODES.CONNECTION_PROVISION_CLOSED,
      details: {
        stage: 'provision',
      },
    }));
    this.resetProvisionHandlers();
  }

  /**
   * 处理连接错误
   */
  private handleConnectionError(error: Error, reason: ConnectionEventReason): void {
    logger.error('Connection error:', error); // 输出连接错误
    this.connection.error = error; // 记录错误信息
    if (this.provisionTimeoutId) { // 存在 provision 超时定时器
      clearTimeout(this.provisionTimeoutId); // 清理 provision 超时
      this.provisionTimeoutId = null; // 重置标记
    }
    this.resetProvisionHandlers(); // 重置 provision 回调
    if (this.websocket) { // 存在连接则主动关闭
      this.suppressNextCloseEvent = true; // 忽略关闭回调
      const currentSocket = this.websocket;
      this.clearSocketListeners();
      currentSocket.close(); // 主动关闭连接
      this.websocket = null; // 清理连接引用
    }
    this.stopHeartbeat(); // 停止心跳
    this.handleDisconnection(reason); // 处理断开流程
  }

  private handleTerminalConnectionError(error: ConnectionError, reason: ConnectionEventReason): void {
    logger.warn('Terminal connection error received', {
      code: error.code,
      message: error.message,
      details: error.details,
    });
    this.connection.error = error;
    this.reconnectPaused = true;
    this.reconnectInProgress = false;
    this.offlineRecoverPending = false;
    this.resetProvisionHandlers();
    this.clearReconnectTimer();
    if (this.websocket) {
      this.suppressNextCloseEvent = true;
      const currentSocket = this.websocket;
      this.clearSocketListeners();
      currentSocket.close();
      this.websocket = null;
    }
    this.stopHeartbeat();
    this.updateStatus(ConnectionStatus.DISCONNECTED, reason, true, true);
  }

  /**
   * 处理 WebSocket 下行消息
   */
  private async handleWebSocketMessage(data: SocketMessageData, generation: number): Promise<void> {
    try {
      if (generation !== this.socketGeneration) {
        return;
      }
      logger.debug('WebSocket message received', { dataType: typeof data }); // 记录 WS 消息类型
      const normalized = await this.msyncCodec.normalizeIncoming(data);
      if (generation !== this.socketGeneration) {
        return;
      }
      logger.debug('handleWebSocketMessage data', { length: normalized.length }); // 输出数据长度
      if (!normalized.length) {
        return;
      }
      const decompressed = this.msyncCodec.decompressIncoming(normalized);
      if (!decompressed) {
        logger.error('Failed to decompress mSync payload, closing connection');
        this.websocket?.close();
        return;
      }
      if (this.isServerNormalClosePayload(decompressed)) {
        logger.debug('Ignore server normal close payload', { length: decompressed.length });
        return;
      }
      let decoded: { command: number; payload: Uint8Array } | null = null; // 解码结果
      try {
        decoded = this.msyncCodec.decodeMsync(decompressed); // 解码 MSync 外层包
      } catch (error) {
        const decodeError = error instanceof Error ? error : new Error('Failed to decode mSync payload');
        if (decodeError instanceof RangeError) { // 处理协议长度不足导致的 RangeError
          logger.warn('Discard invalid mSync payload', { // 记录无效 payload
            length: decompressed.length, // payload 长度
            message: decodeError.message, // 错误信息
          }); // 结束日志输出
          return; // 忽略无效 payload
        }
        throw decodeError;
      }
      this.heartbeatManager.markAlive(); // 收到有效 MSync 消息视为心跳成功
      logger.debug('handleWebSocketMessage decoded', { command: decoded.command }); // 输出命令类型
      switch (decoded.command) {
        case MsyncCommand.PROVISION:
          this.handleProvisionMessage(decoded.payload);
          break;
        case MsyncCommand.LOGOUT:
          this.handleLogoutMessage(decoded.payload);
          break;
        case MsyncCommand.NOTICE:
          this.handleNoticeMessage(decoded.payload);
          break;
        case MsyncCommand.UNREAD:
          this.handleUnreadMessage(decoded.payload);
          break;
        case MsyncCommand.SYNC:
          this.handleSyncMessage(decoded.payload);
          break;
        default:
          break;
      }
    } catch (error) {
      const connectionError = error instanceof Error ? error : new Error('Failed to handle mSync payload');
      logger.error('Failed to handle mSync payload', connectionError);
      this.handleConnectionError(connectionError, ConnectionEventReason.ERROR); // 处理连接错误
    }
  }

  /**
   * 发送 provision 并等待回包
   */
  private startProvision(): Promise<void> {
    this.provisionPromise = new Promise((resolve, reject) => {
      this.provisionResolve = resolve;
      this.provisionReject = reject;
    });

    if (this.provisionTimeoutId) {
      clearTimeout(this.provisionTimeoutId);
    }
    this.provisionTimeoutId = setTimeout(() => {
      if (this.provisionReject) {
        this.provisionReject(new ConnectionError('Provision timeout', {
          code: ERROR_CODES.CONNECTION_PROVISION_TIMEOUT,
          details: {
            stage: 'provision',
            retryable: false,
          },
        }));
        this.resetProvisionHandlers();
      }
    }, PROVISION_TIMEOUT);

    try {
      const provision = this.msyncCodec.encodeProvision();
      logger.debug('startProvision provision', { length: provision.length }); // 输出 provision 长度
      this.sendMsyncPayload(provision);
    } catch {
      this.provisionReject?.(new ConnectionError('Provision send failed', {
        code: ERROR_CODES.CONNECTION_WEBSOCKET_ERROR,
        details: {
          stage: 'provision',
        },
      }));
      this.resetProvisionHandlers();
    }

    return this.provisionPromise;
  }

  /**
   * 处理 provision 回包
   */
  private handleProvisionMessage(payload: Uint8Array): void {
    const result = this.msyncCodec.decodeProvision(payload);
    if (this.provisionTimeoutId) {
      clearTimeout(this.provisionTimeoutId);
      this.provisionTimeoutId = null;
    }

    if (result.ok) {
      this.msyncCodec.updateResource(result.resource);
      this.provisionResolve?.();
    } else {
      logger.warn('Provision rejected', { // 输出 provision 拒绝日志
        statusCode: result.statusCode, // 记录状态码
        reason: result.reason, // 记录失败原因
      }); // 结束日志输出
      const resolution = resolveProvisionError(result.statusCode, result.reason); // 解析 provision 错误
      const mappedCode = resolution.code === ERROR_CODES.UNKNOWN
        ? ERROR_CODES.CONNECTION_PROVISION_REJECTED
        : resolution.code; // 兜底到 provision 拒绝
      this.provisionReject?.(new ConnectionError('Provision rejected', {
        code: mappedCode, // 使用映射后的错误码
        details: {
          stage: 'provision',
          reason: result.reason,
          statusCode: result.statusCode,
          retryable: resolution.retryable,
        },
      }));
    }
  }

  private handleNoticeMessage(payload: Uint8Array): void {
    const { queue } = this.msyncCodec.decodeNotice(payload);
    if (!queue) {
      return;
    }
    if (this.isSelfQueue(queue) || this.isQueueInList(queue)) {
      return;
    }
    this.queues.push(queue);
    if (this.queues.length === 1) {
      this.sendBackqueue(queue);
    }
  }

  /**
   * 处理 UNREAD：对每个队列发起拉取
   */
  private handleUnreadMessage(payload: Uint8Array): void {
    const { queues } = this.msyncCodec.decodeUnread(payload);
    if (!queues.length) {
      return;
    }
    this.startOfflineMessageSync(queues);
    for (const queue of queues) {
      this.sendBackqueue(queue);
    }
  }

  private handleSyncMessage(payload: Uint8Array): void {
    const statisticError = this.resolveStatisticDisconnectError(
      this.msyncCodec.decodeSyncStatisticOperations(payload)
    );
    if (statisticError) {
      this.handleTerminalConnectionError(statisticError, ConnectionEventReason.ERROR);
      return;
    }
    if (!this.messageReceiver) {
      return;
    }
    const result = this.messageReceiver.handleSyncPayload(payload);
    logger.debug('handleSyncMessage result', { result }); // 输出同步结果
    if (!result) {
      return;
    }

    this.handleSyncQueueState(result);
  }

  /**
   * 根据 nextKey/isLast 续拉队列消息
   */
  private handleSyncQueueState(result: SyncDecodeResult): void {
    const queueState = this.resolveSyncQueueState(result);
    if (!queueState) {
      return;
    }
    const { queue, queueName } = queueState;
    const nextKey = result.nextKey;

    if (result.isLast) {
      this.finishOfflineMessageQueue(queueName);
      this.removeQueue(queueName);
      this.nextKey = null;
      this.currentQueueName = null;
      this.sendNextQueue();
      return;
    }

    if (nextKey) {
      if (nextKey !== this.nextKey || queueName !== this.currentQueueName) {
        this.nextKey = nextKey;
        this.currentQueueName = queueName;
        this.sendLastSession(queue, nextKey);
        return;
      }

      this.removeQueue(queueName);
      this.sendNextQueue();
    }
  }

  private resolveSyncQueueState(result: SyncDecodeResult): {
    readonly queue: Record<string, unknown>;
    readonly queueName: string;
  } | null {
    const responseQueue =
      result.queue && typeof result.queue === 'object' ? result.queue : undefined;
    const responseQueueName = responseQueue ? this.getQueueName(responseQueue) : null;
    const responseQueueMatched =
      responseQueueName !== null &&
      (this.queues.length === 0 ||
        this.queues.some((item) => this.getQueueName(item) === responseQueueName));
    if (responseQueue && responseQueueName && responseQueueMatched) {
      return {
        queue: responseQueue,
        queueName: responseQueueName,
      };
    }

    const currentQueue = this.currentQueueName
      ? this.queues.find((item) => this.getQueueName(item) === this.currentQueueName)
      : undefined;
    const fallbackQueue = currentQueue ?? this.queues[0];
    const fallbackQueueName = fallbackQueue ? this.getQueueName(fallbackQueue) : null;
    if (!fallbackQueue || !fallbackQueueName) {
      return null;
    }

    logger.warn('Sync queue response missing queue name, fallback to local queue', {
      responseQueueName,
      fallbackQueueName,
      currentQueueName: this.currentQueueName,
      firstQueueName: this.getQueueName(this.queues[0] ?? {}),
      isLast: result.isLast,
      hasNextKey: Boolean(result.nextKey),
    });
    return {
      queue: fallbackQueue,
      queueName: fallbackQueueName,
    };
  }

  private handleLogoutMessage(payload: Uint8Array): void {
    const decoded = this.msyncCodec.decodeLogout(payload);
    logger.warn('Logout message received', decoded);
  }

  private resolveStatisticDisconnectError(
    operations: ReadonlyArray<StatisticOperationResult>
  ): ConnectionError | null {
    for (const operation of operations) {
      switch (operation.operation) {
        case 1:
          return new ConnectionError('User has been removed', {
            code: ERROR_CODES.USER_REMOVED,
            details: {
              stage: 'statistics',
              operation: operation.operation,
              retryable: false,
            },
          });
        case 2:
          return new ConnectionError('The user is already logged on another device', {
            code: ERROR_CODES.USER_LOGIN_ANOTHER_DEVICE,
            details: {
              stage: 'statistics',
              operation: operation.operation,
              retryable: false,
              ...(operation.reason
                ? {
                    loginInfoCustomExt: operation.reason,
                  }
                : {}),
            },
          });
        case 3:
          return new ConnectionError('The user was kicked by changing password', {
            code: ERROR_CODES.USER_KICKED_BY_CHANGE_PASSWORD,
            details: {
              stage: 'statistics',
              operation: operation.operation,
              retryable: false,
            },
          });
        case 4:
          return new ConnectionError('The user was kicked by other device', {
            code: ERROR_CODES.USER_KICKED_BY_OTHER_DEVICE,
            details: {
              stage: 'statistics',
              operation: operation.operation,
              retryable: false,
            },
          });
        default:
          break;
      }
    }
    return null;
  }

  private resetProvisionHandlers(): void {
    this.provisionResolve = null;
    this.provisionReject = null;
    this.provisionPromise = null;
  }

  /**
   * 断开连接
   */
  disconnect(): Promise<void> {
    if (this.provisionTimeoutId) { // 存在 provision 超时定时器
      clearTimeout(this.provisionTimeoutId); // 清理 provision 超时
      this.provisionTimeoutId = null; // 重置标记
    }
    this.clearReconnectTimer(); // 清理重连定时器
    this.clearTokenTimers(); // 清理 token 生命周期定时器
    this.tokenLifecycle = null; // 清理 token 生命周期状态
    this.resetProvisionHandlers(); // 重置 provision 回调
    this.stopHeartbeat(); // 停止心跳
    this.reconnectPaused = true; // 暂停重连
    this.reconnectInProgress = false; // 重置重连标记
    this.isLoginPhase = false; // 重置登录阶段
    this.isLoggedIn = false; // 清理登录标记
    this.offlineRecoverPending = false; // 清理离线恢复标记
    this.closeWebSocket(ConnectionEventReason.CLOSE, true, true); // 关闭连接并派发断开
    this.updateStatus(ConnectionStatus.DISCONNECTED, ConnectionEventReason.CLOSE, true); // 确保状态更新
    this.resetSyncState(); // 重置同步状态
    this.reconnectAttempts = 0; // 重置重连次数
    this.connection.reconnectAttempts = 0; // 同步连接状态
    this.connection.error = undefined; // 清理错误信息
    this.hasEverConnected = false; // 重置历史连接标记
    this.connectionEventNormalizer.reset(); // 断开后重置事件去重状态
    logger.warn('Connection disconnected'); // 连接断开关键事件
    return Promise.resolve(); // 返回完成
  }

  /**
   * 销毁连接管理器
   */
  destroy(): void {
    void this.disconnect(); // 断开连接
    this.eventHub.removeEventHandler(this.internalHandlerId); // 移除内部事件处理器
  }

  private resolveSocketAdapter(config: ConnectionConfig): SocketAdapter {
    if (config.socketAdapter) {
      return config.socketAdapter;
    }
    const fallback = createWebSocketAdapter({
      webSocketCtor: typeof WebSocket === 'function' ? WebSocket : undefined,
    });
    if (fallback) {
      return fallback;
    }
    throw createPlatformError('Socket capability is missing for current platform', {
      code: 'PLATFORM_MISSING_CAPABILITY',
      stage: 'socket',
      retryable: false,
      details: {
        capability: 'socket',
      },
    });
  }

  private attachSocketListeners(socket: SocketLike, generation: number): void {
    this.clearSocketListeners();
    this.socketDisposers = [
      socket.onMessage((data): void => {
        if (this.websocket !== socket) {
          return;
        }
        this.inboundMessageQueue = this.inboundMessageQueue
          .catch((): void => undefined)
          .then(() => this.handleWebSocketMessage(data, generation));
      }),
      socket.onError((): void => {
        if (this.websocket !== socket) {
          return;
        }
        logger.warn('WebSocket error', { stage: 'ws' });
        const error = new ConnectionError('WebSocket connection error', {
          code: ERROR_CODES.CONNECTION_WEBSOCKET_ERROR,
          details: {
            stage: 'ws',
          },
        });
        this.handleConnectionError(error, ConnectionEventReason.ERROR);
      }),
      socket.onClose((event): void => {
        if (this.websocket !== socket) {
          return;
        }
        this.handleWebSocketClose(event);
      }),
    ];
  }

  private clearSocketListeners(): void {
    for (const dispose of this.socketDisposers) {
      dispose();
    }
    this.socketDisposers = [];
  }

  private sendMsyncPayload(payload: Uint8Array): void {
    if (!this.websocket || this.websocket.readyState !== SOCKET_READY_STATE.OPEN) {
      return;
    }
    try {
      const encoded = this.msyncCodec.prepareOutgoing(payload);
      logger.debug('WebSocket send payload', { length: encoded.length }); // 记录 WS 发送
      void Promise.resolve(this.websocket.send(encoded)).catch((error) => {
        logger.error('Failed to send mSync payload', error);
        this.websocket?.close();
      });
    } catch (error) {
      logger.error('Failed to send mSync payload', error);
      this.websocket?.close();
    }
  }

  private sendBackqueue(queue: Record<string, unknown>): void {
    const payload = this.msyncCodec.encodeBackQueue(queue);
    logger.debug('sendBackqueue payload', { length: payload.length }); // 输出 payload 长度
    this.sendMsyncPayload(payload);
  }

  private sendLastSession(queue: Record<string, unknown>, nextKey: string): void {
    logger.debug('sendLastSession queue', { queueName: this.getQueueName(queue), nextKey }); // 输出队列信息
    const payload = this.msyncCodec.encodeLastSession(queue, nextKey);
    this.sendMsyncPayload(payload);
  }

  private sendNextQueue(): void {
    logger.debug('sendNextQueue queues', { size: this.queues.length }); // 输出队列数量
    const firstQueue = this.queues[0]; // 读取首个队列
    if (!firstQueue) { // 队列为空
      return;
    }
    this.sendBackqueue(firstQueue); // 发送首个队列
  }

  private removeQueue(queueName: string | null): void {
    if (!queueName) {
      return;
    }
    const index = this.queues.findIndex((item) => this.getQueueName(item) === queueName);
    if (index >= 0) {
      this.queues.splice(index, 1);
    }
  }

  private startOfflineMessageSync(queues: ReadonlyArray<Record<string, unknown>>): void {
    const queueNames = new Set<string>();
    for (const queue of queues) {
      const queueName = this.getQueueName(queue);
      if (queueName) {
        queueNames.add(queueName);
      }
    }
    if (queueNames.size === 0) {
      return;
    }
    for (const queueName of queueNames) {
      this.offlineMessageQueueNames.add(queueName);
    }
    if (this.offlineMessageSyncing) {
      return;
    }
    this.offlineMessageSyncing = true;
    this.eventHub.dispatch(ConnectionEventName.OFFLINE_MESSAGE_SYNC_START, undefined);
  }

  private finishOfflineMessageQueue(queueName: string | null): void {
    if (!this.offlineMessageSyncing || !queueName) {
      return;
    }
    this.offlineMessageQueueNames.delete(queueName);
    if (this.offlineMessageQueueNames.size > 0) {
      return;
    }
    this.offlineMessageSyncing = false;
    this.eventHub.dispatch(ConnectionEventName.OFFLINE_MESSAGE_SYNC_FINISH, undefined);
  }

  private isQueueInList(queue: Record<string, unknown>): boolean {
    const name = this.getQueueName(queue);
    if (!name) {
      return false;
    }
    return this.queues.some((item) => this.getQueueName(item) === name);
  }

  private isSelfQueue(queue: Record<string, unknown>): boolean {
    const queueName = this.getQueueName(queue);
    const queueResource = this.getQueueResource(queue);
    const context = this.msyncCodec.getContext();
    return queueName === context.userId && queueResource === context.clientResource;
  }

  private getQueueName(queue: Record<string, unknown>): string | null {
    return typeof queue.name === 'string' ? queue.name : null;
  }

  private getQueueResource(queue: Record<string, unknown>): string | null {
    return typeof queue.clientResource === 'string' ? queue.clientResource : null;
  }

  private resetSyncState(): void {
    this.queues = [];
    this.currentQueueName = null;
    this.nextKey = null;
    this.offlineMessageSyncing = false;
    this.offlineMessageQueueNames.clear();
  }
}
