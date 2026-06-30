/**
 * 事件缓冲池
 *
 * 对标 robot 的 WebSocket Cache Mode：事件到达时按类型缓存，
 * waitForEvent 先查缓存再等新事件，容忍乱序到达。
 */
import type { ChatClient } from '@/chat-client';

interface Waiter {
  eventName: string;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  predicate?: (payload: unknown) => boolean;
  timer: ReturnType<typeof setTimeout>;
}

const DEFAULT_TIMEOUT_MS = 10_000;

export class EventCollector {
  private buffer: Map<string, unknown[]> = new Map();
  private waiters: Waiter[] = [];

  /**
   * 绑定到 client 的 eventHandler，所有事件自动缓存
   */
  bind(client: ChatClient, handlerId: string): void {
    const handler: Record<string, (...args: unknown[]) => void> = {};
    const eventNames = [
      'onMessage',
      'onPresenceStatusChange',
      'onContactInvited',
      'onContactAgreed',
      'onContactRefuse',
      'onContactDeleted',
      'onContactAdded',
      'onRecallMessage',
      'onModifiedMessage',
      'onConnected',
      'onDisconnected',
      'onGroupEvent',
      'onChatRoomEvent',
      'onReadMessage',
      'onDeliveredMessage',
      'onReactionChange',
      'onConversationListUpdate',
    ];

    for (const name of eventNames) {
      handler[name] = (...args: unknown[]) => {
        const payload = args.length === 1 ? args[0] : args;
        this.onEvent(name, payload);
      };
    }

    client.addEventHandler(handlerId, handler);
  }

  /**
   * 解绑事件处理器
   */
  unbind(client: ChatClient, handlerId: string): void {
    client.removeEventHandler(handlerId);
  }

  /**
   * 等待指定事件到达
   */
  async waitForEvent<T = unknown>(eventName: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
    // 先查缓存
    const cached = this.buffer.get(eventName);
    if (cached && cached.length > 0) {
      return cached.shift() as T;
    }

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.removeWaiter(waiter);
        const bufferedKeys = [...this.buffer.entries()]
          .filter(([, v]) => v.length > 0)
          .map(([k, v]) => `${k}(${v.length})`);
        reject(
          new Error(
            `EventCollector timeout: waited ${timeoutMs}ms for "${eventName}". ` +
            `Buffered events: [${bufferedKeys.join(', ') || 'none'}]`
          )
        );
      }, timeoutMs);

      const waiter: Waiter = { eventName, resolve: resolve as (v: unknown) => void, reject, timer };
      this.waiters.push(waiter);
    });
  }

  /**
   * 等待满足条件的事件
   */
  async waitForEventMatching<T = unknown>(
    eventName: string,
    predicate: (payload: unknown) => boolean,
    timeoutMs = DEFAULT_TIMEOUT_MS
  ): Promise<T> {
    // 先查缓存中是否有匹配的
    const cached = this.buffer.get(eventName);
    if (cached) {
      const idx = cached.findIndex(predicate);
      if (idx !== -1) {
        return cached.splice(idx, 1)[0] as T;
      }
    }

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.removeWaiter(waiter);
        const bufferedKeys = [...this.buffer.entries()]
          .filter(([, v]) => v.length > 0)
          .map(([k, v]) => `${k}(${v.length})`);
        reject(
          new Error(
            `EventCollector timeout: waited ${timeoutMs}ms for "${eventName}" matching predicate. ` +
            `Buffered events: [${bufferedKeys.join(', ') || 'none'}]`
          )
        );
      }, timeoutMs);

      const waiter: Waiter = {
        eventName,
        resolve: resolve as (v: unknown) => void,
        reject,
        predicate,
        timer,
      };
      this.waiters.push(waiter);
    });
  }

  /**
   * 断言在指定时间内未收到事件
   */
  async assertNoEvent(eventName: string, waitMs = 2000): Promise<void> {
    const cached = this.buffer.get(eventName);
    if (cached && cached.length > 0) {
      throw new Error(
        `EventCollector assertNoEvent failed: "${eventName}" already in buffer (${cached.length} items)`
      );
    }

    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.removeWaiter(waiter);
        resolve();
      }, waitMs);

      const waiter: Waiter = {
        eventName,
        resolve: () => {
          clearTimeout(timer);
          reject(new Error(`EventCollector assertNoEvent failed: received "${eventName}" within ${waitMs}ms`));
        },
        reject,
        timer,
      };
      this.waiters.push(waiter);
    });
  }

  /**
   * 清空所有缓存和等待者
   */
  clear(): void {
    this.buffer.clear();
    for (const waiter of this.waiters) {
      clearTimeout(waiter.timer);
    }
    this.waiters = [];
  }

  private onEvent(eventName: string, payload: unknown): void {
    // 检查是否有 waiter 在等待此事件
    const waiterIdx = this.waiters.findIndex(
      (w) => w.eventName === eventName && (!w.predicate || w.predicate(payload))
    );

    if (waiterIdx !== -1) {
      const waiter = this.waiters[waiterIdx]!;
      this.waiters.splice(waiterIdx, 1);
      clearTimeout(waiter.timer);
      waiter.resolve(payload);
      return;
    }

    // 无匹配 waiter，存入缓存
    const list = this.buffer.get(eventName) ?? [];
    list.push(payload);
    this.buffer.set(eventName, list);
  }

  private removeWaiter(waiter: Waiter): void {
    const idx = this.waiters.indexOf(waiter);
    if (idx !== -1) {
      this.waiters.splice(idx, 1);
    }
  }
}
