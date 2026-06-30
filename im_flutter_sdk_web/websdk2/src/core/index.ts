/**
 * 核心模块集成
 *
 * 集成连接和消息组件
 */

import { ConnectionManager } from './connection/connection-manager'; // 连接管理器
import { MessageSender } from './message/message-sender'; // 消息发送器
import { MessageReceiver } from './message/message-receiver'; // 消息接收器
import { MessageQueue } from './message/message-queue'; // 消息队列
import { CombineMessageDownloader } from './message/combine-message-downloader'; // 合并消息下载解析器
import { AttachmentDownloader } from './message/attachment-downloader';
import { EventHub } from './events/event-hub'; // 事件中心
import { AttachmentUploader } from '../upload/attachment-uploader'; // 附件上传器
import { attachmentFileStore } from '../upload/attachment-file-store'; // 附件缓存
import { RuntimeEventBridge } from '../platform/runtime/runtime-event-bridge'; // 运行时事件桥接器
import { ChatEventName, ConnectionEventName, InternalEventName } from '../types'; // 事件名称常量
import type {
  ConnectionEventPayload,
  ConnectionStatus,
  Message,
  DownloadCombineMessageParams,
  MessageAttachmentDownloadResult,
  SendMessageOptions,
  TokenRenewalResult,
} from '../types'; // 类型定义
import type { PlatformFactoryResult, RuntimeAdapter, SocketAdapter } from '../platform'; // 平台适配器类型
import type { MessageActionRequest, ActionAckResult } from './message/message-action-types';
import type { ChatRoomOperationRequest } from './message/chatroom-operation-types';

const INTERNAL_HANDLER_ID = '__internal:core'; // 内部事件处理器 ID

/**
 * 核心 SDK 类
 */
export class CoreSDK {
  private eventHub: EventHub;
  private connectionManager: ConnectionManager;
  private messageSender: MessageSender;
  private messageReceiver: MessageReceiver;
  private messageQueue: MessageQueue;
  private combineMessageDownloader: CombineMessageDownloader;
  private attachmentDownloader: AttachmentDownloader;
  private readonly platformAdapter: PlatformFactoryResult | null; // 平台适配器
  private runtimeEventBridge: RuntimeEventBridge | null = null; // 运行时事件桥接器
  private readonly handleOnline = (): void => {
    // 在线事件处理
    this.connectionManager.handleOnline(); // 转发在线事件
  };
  private readonly handleOffline = (): void => {
    // 离线事件处理
    this.connectionManager.handleOffline(); // 转发离线事件
  };
  private readonly handleForegroundChange = (foreground: boolean): void => {
    // 前后台语义处理
    if (!foreground) {
      // 仅前台恢复触发
      return; // 直接返回
    } // 后台状态结束
    void this.connectionManager.handleForeground(); // 执行前台检查
  };

  constructor(
    config: {
      serverUrl: string;
      serverUrls?: ReadonlyArray<string>; // WebSocket 地址列表
      userId: string;
      token: string;
      appKey: string;
      restBaseUrl?: string;
      useCustomAttachmentUpload?: boolean;
      heartBeatWait?: number;
      autoReconnectNumMax?: number;
      useReplacedMessageContents?: boolean;
      useFixedDeviceId?: boolean;
      deviceId?: string;
      customDeviceName?: string;
      customOsPlatform?: number;
      uiKitVersion?: string;
      loginExtensionInfo?: string;
      platformAdapter?: PlatformFactoryResult;
      socketAdapter?: SocketAdapter;
      enableDeliveryReceipt?: boolean;
    },
    eventHub: EventHub
  ) {
    this.eventHub = eventHub;
    // 初始化连接管理器
    this.connectionManager = new ConnectionManager(
      {
        ...config,
        socketAdapter: config.socketAdapter ?? config.platformAdapter?.socket,
      },
      this.eventHub
    );

    // 初始化消息组件
    const msyncCodec = this.connectionManager.getMsyncCodec();
    const attachmentUploader = config.restBaseUrl
      ? new AttachmentUploader({
          restBaseUrl: config.restBaseUrl,
          token: config.token,
          appKey: config.appKey,
          useCustomAttachmentUpload: config.useCustomAttachmentUpload,
          requestAdapter: config.platformAdapter?.request,
          uploadAdapter: config.platformAdapter?.upload,
          imageProcessor: config.platformAdapter?.imageProcessor,
        })
      : undefined;
    this.messageSender = new MessageSender(msyncCodec, null, this.eventHub, attachmentUploader);
    this.messageReceiver = new MessageReceiver(msyncCodec, this.messageSender, this.eventHub);
    if (config.enableDeliveryReceipt) {
      this.messageReceiver.setDeliveryAckEnabled(true);
    }
    this.combineMessageDownloader = new CombineMessageDownloader(config.platformAdapter?.request);
    this.attachmentDownloader = new AttachmentDownloader(config.platformAdapter?.request);
    this.connectionManager.setMessageReceiver(this.messageReceiver);
    this.messageQueue = new MessageQueue();
    this.platformAdapter = config.platformAdapter ?? null; // 记录平台适配器

    // 设置事件监听
    this.setupEventHandlers();
    this.registerNetworkListeners(); // 注册网络/前台监听
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers(): void {
    this.eventHub.addEventHandler(INTERNAL_HANDLER_ID, {
      [ConnectionEventName.CONNECTED]: (_payload: ConnectionEventPayload): void => {
        const websocket = this.connectionManager.getWebSocket();
        if (!websocket) {
          return;
        }

        this.messageSender.setWebSocket(websocket);
      },
      [ConnectionEventName.DISCONNECTED]: (_payload: ConnectionEventPayload): void => {
        this.messageSender.setWebSocket(null);
      },
      [ConnectionEventName.RECONNECT_FAILED]: (_payload: ConnectionEventPayload): void => {
        this.messageSender.setWebSocket(null);
      },
      [ChatEventName.MESSAGE]: (message: Message): void => {
        this.messageQueue.add(message);
      },
      [InternalEventName.MESSAGE_SENT]: (message: Message): void => {
        this.messageReceiver.rememberSentMessageContext(message);
      },
    });
  }

  private registerNetworkListeners(): void {
    const runtimeAdapter = this.resolveRuntimeAdapter(); // 解析运行时适配器
    this.runtimeEventBridge = new RuntimeEventBridge(runtimeAdapter, {
      onOnline: this.handleOnline,
      onOffline: this.handleOffline,
      onForeground: (): void => {
        this.handleForegroundChange(true);
      },
      onBackground: (): void => {
        this.handleForegroundChange(false);
      },
    }); // 创建事件桥接器
    this.runtimeEventBridge.start(); // 启动运行时事件桥接
  }

  private unregisterNetworkListeners(): void {
    this.runtimeEventBridge?.stop(); // 停止运行时事件桥接
    this.runtimeEventBridge = null; // 清理桥接器引用
  }

  private resolveRuntimeAdapter(): RuntimeAdapter {
    if (this.platformAdapter) {
      return this.platformAdapter.runtime; // 使用平台注入的运行时适配器
    }
    return this.createBrowserRuntimeAdapter(); // 回退浏览器运行时适配器
  }

  private createBrowserRuntimeAdapter(): RuntimeAdapter {
    return {
      getPlatform(): 'web' {
        return 'web';
      },
      onNetworkChange(listener: (online: boolean) => void): () => void {
        if (typeof window === 'undefined') {
          return (): void => undefined;
        }
        const onOnline = (): void => {
          listener(true);
        };
        const onOffline = (): void => {
          listener(false);
        };
        window.addEventListener('online', onOnline);
        window.addEventListener('offline', onOffline);
        if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
          listener(navigator.onLine);
        }
        return (): void => {
          window.removeEventListener('online', onOnline);
          window.removeEventListener('offline', onOffline);
        };
      },
      onAppVisibilityChange(listener: (foreground: boolean) => void): () => void {
        if (typeof document === 'undefined') {
          return (): void => undefined;
        }
        const onVisibilityChange = (): void => {
          listener(document.visibilityState === 'visible');
        };
        document.addEventListener('visibilitychange', onVisibilityChange);
        onVisibilityChange();
        return (): void => {
          document.removeEventListener('visibilitychange', onVisibilityChange);
        };
      },
    };
  }

  /**
   * 连接
   */
  async connect(): Promise<void> {
    return this.connectionManager.connect();
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    return this.connectionManager.disconnect();
  }

  /**
   * 获取连接状态
   */
  getConnectionStatus(): ConnectionStatus {
    return this.connectionManager.getConnectionStatus();
  }

  /**
   * 获取客户端资源标识
   */
  getClientResource(): string {
    // 获取 clientResource
    return this.connectionManager.getClientResource(); // 返回资源标识
  }

  /**
   * 更新当前连接与发送链路使用的 IM token。
   * Updates the IM token used by connection and send pipeline.
   */
  renewToken(token: string, expireAt: number): TokenRenewalResult {
    const result = this.connectionManager.renewToken(token, expireAt);
    this.messageSender.updateAuthToken(token);
    return result;
  }

  /**
   * 发送消息
   */
  async sendMessage(message: Message, options?: SendMessageOptions): Promise<Message> {
    return this.messageSender.sendMessage(message, options);
  }

  async sendMessageAction(
    action: MessageActionRequest,
    createAckError?: (statusCode: number, reason?: string) => Error
  ): Promise<ActionAckResult> {
    return this.messageSender.sendAction(action, createAckError);
  }

  async sendChatRoomOperation(
    request: ChatRoomOperationRequest,
    createAckError?: (statusCode: number, reason?: string) => Error
  ): Promise<ActionAckResult> {
    return this.messageSender.sendChatRoomOperation(request, createAckError);
  }

  /**
   * 下载并解析合并消息详情
   */
  async downloadAndParseCombineMessage(
    options: DownloadCombineMessageParams
  ): Promise<ReadonlyArray<Message>> {
    return this.combineMessageDownloader.downloadAndParse(options);
  }

  async downloadAttachment(
    message: Message,
    timeoutMs?: number
  ): Promise<MessageAttachmentDownloadResult> {
    return this.attachmentDownloader.download(message, timeoutMs);
  }

  decodeServerMessageMeta(metaPayload: Uint8Array): Message | null {
    return this.connectionManager.getMsyncCodec().decodeServerMessageMeta(metaPayload);
  }

  /**
   * 销毁
   */
  destroy(): void {
    this.unregisterNetworkListeners(); // 移除网络/前台监听
    this.connectionManager.destroy();
    this.messageSender.destroy();
    this.messageReceiver.destroy();
    this.messageQueue.clear();
    this.eventHub.removeEventHandler(INTERNAL_HANDLER_ID);
    attachmentFileStore.clear();
  }
}
