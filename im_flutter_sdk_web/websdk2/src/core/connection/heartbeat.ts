/**
 * 心跳机制
 * 
 * 实现 ping/pong 机制，超时处理
 * 参考：HEARTBEAT_INTERVAL = 30000ms
 */

import { logger } from '../../utils/logger';
import {
  SOCKET_READY_STATE,
  type SocketLike,
  type SocketMessageData,
} from '../../platform';

/**
 * 心跳配置
 */
export interface HeartbeatConfig {
  interval?: number; // 心跳间隔（毫秒），默认 30000
  timeout?: number; // 心跳超时（毫秒），默认 60000
}

const DEFAULT_CONFIG: Required<HeartbeatConfig> = {
  interval: 30000, // 30 秒
  timeout: 60000, // 60 秒
};

/**
 * 心跳管理器
 */
export class HeartbeatManager {
  private config: Required<HeartbeatConfig>;
  private websocket: SocketLike | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private timeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private lastPongTime: number = 0;
  private onTimeoutCallback: (() => void) | null = null;
  private sendPing: (() => void) | null = null; // 自定义 ping 发送函数
  private probeResolvers: Array<(success: boolean) => void> = []; // 心跳探测回调队列
  private messageDisposer: (() => void) | null = null;
  private readonly handlePong = (data: SocketMessageData): void => {
    const messageText = this.extractMessageText(data);
    if (!messageText) {
      return;
    }

    const parsed = this.parseJson(messageText);
    if (!HeartbeatManager.isRecord(parsed)) {
      return;
    }

    const messageType = HeartbeatManager.readString(parsed.type);
    if (messageType === 'pong') {
      this.markAlive(); // 标记心跳成功
      logger.debug('Pong received');
    }
  };

  constructor(config: HeartbeatConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 启动心跳
   */
  start(websocket: SocketLike, onTimeout?: () => void, sendPing?: () => void): void {
    if (this.heartbeatTimer) {
      this.stop();
    }

    this.attachWebSocket(websocket); // 绑定 WebSocket
    this.onTimeoutCallback = onTimeout || null;
    this.sendPing = sendPing ?? null; // 保存自定义 ping 发送函数
    this.lastPongTime = Date.now();

    // 启动心跳定时器
    this.heartbeatTimer = setInterval(() => {
      this.sendPingInternal(); // 发送心跳
    }, this.config.interval);

    logger.debug('Heartbeat started', { interval: this.config.interval });
  }

  /**
   * 停止心跳
   */
  stop(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }

    this.messageDisposer?.();
    this.messageDisposer = null;
    this.websocket = null;

    this.sendPing = null; // 清理自定义 ping 发送函数
    this.resolveProbe(false); // 结束探测等待
    logger.debug('Heartbeat stopped');
  }

  /**
   * 发送 ping
   */
  private sendPingInternal(): void {
    if (!this.websocket || this.websocket.readyState !== SOCKET_READY_STATE.OPEN) {
      this.resolveProbe(false); // 无法发送视为失败
      return;
    }

    try {
      if (this.sendPing) { // 使用自定义 ping 发送逻辑
        this.sendPing(); // 发送心跳消息
      } else { // 回退到 JSON ping
        const pingMessage = JSON.stringify({ type: 'ping', timestamp: Date.now() }); // 构造 ping 消息
        void Promise.resolve(this.websocket.send(pingMessage)).catch(error => {
          logger.error('Failed to send ping:', error);
          this.resolveProbe(false);
        });
      }

      // 设置超时定时器
      this.resetTimeout();

      logger.debug('Ping sent');
    } catch (error) {
      logger.error('Failed to send ping:', error);
      this.resolveProbe(false); // 发送失败视为探测失败
    }
  }

  /**
   * 处理 pong 消息
   */
  private extractMessageText(data: unknown): string | null {
    if (typeof data === 'string') {
      return data;
    }

    if (data instanceof ArrayBuffer) {
      return new TextDecoder().decode(new Uint8Array(data));
    }

    return null;
  }

  private parseJson(text: string): unknown {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return null;
    }
  }

  private static isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private static readString(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined;
  }

  /**
   * 重置超时定时器
   */
  private resetTimeout(): void {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
    }

    this.timeoutTimer = setTimeout(() => {
      logger.warn('Heartbeat timeout');
      if (this.onTimeoutCallback) {
        this.onTimeoutCallback();
      }
    }, this.config.timeout);
  }

  /**
   * 标记心跳成功
   */
  markAlive(): void {
    this.lastPongTime = Date.now(); // 更新最后心跳时间
    this.resetTimeout(); // 重置超时计时
    this.resolveProbe(true); // 触发探测成功回调
  }

  /**
   * 获取最后 pong 时间
   */
  getLastPongTime(): number {
    return this.lastPongTime;
  }

  /**
   * 单次心跳探测
   */
  async probeOnce(websocket: SocketLike, timeoutMs?: number): Promise<boolean> {
    try { // 捕获探测异常
      if (websocket.readyState !== SOCKET_READY_STATE.OPEN) { // 非 OPEN 状态直接失败
        return false; // 返回失败
      }

      this.attachWebSocket(websocket); // 绑定 WebSocket

      const probeTimeout = timeoutMs ?? this.config.timeout; // 计算探测超时

      return await new Promise((resolve) => { // 返回探测结果
        const timerId = setTimeout(() => { // 设置探测超时定时器
          this.removeProbeResolver(resolve); // 移除回调
          resolve(false); // 超时失败
        }, probeTimeout);

        this.probeResolvers.push((success) => { // 记录探测回调
          clearTimeout(timerId); // 清理超时定时器
          resolve(success); // 返回探测结果
        });

        this.sendPingInternal(); // 发送心跳探测
      });
    } catch (error) { // 捕获探测错误
      logger.warn('Heartbeat probe failed', error); // 记录探测失败
      return false; // 返回失败
    }
  }

  private attachWebSocket(websocket: SocketLike): void {
    if (this.websocket === websocket) {
      return;
    }
    this.messageDisposer?.();
    this.websocket = websocket;
    this.messageDisposer = websocket.onMessage((data): void => {
      this.handlePong(data);
    });
  }

  private resolveProbe(success: boolean): void {
    if (this.probeResolvers.length === 0) {
      return;
    }

    const resolvers = [...this.probeResolvers];
    this.probeResolvers = [];
    for (const resolver of resolvers) {
      resolver(success);
    }
  }

  private removeProbeResolver(target: (success: boolean) => void): void {
    this.probeResolvers = this.probeResolvers.filter((resolver) => resolver !== target);
  }
}
