import { afterEach, describe, expect, it, vi } from 'vitest';

import { HeartbeatManager } from '@/core/connection/heartbeat';
import { SOCKET_READY_STATE, type SocketLike, type SocketMessageData } from '@/platform';

type MessageListener = (data: SocketMessageData) => void;

class EventSocket implements SocketLike {
  public readyState: number = SOCKET_READY_STATE.OPEN;
  public readonly sentPayloads: string[] = [];
  public throwOnSend = false;
  private readonly messageListeners = new Set<MessageListener>();
  private readonly openListeners = new Set<() => void>();
  private readonly errorListeners = new Set<(error: unknown) => void>();
  private readonly closeListeners = new Set<(event: { code?: number; reason?: string }) => void>();

  public send(payload: string): Promise<void> {
    if (this.throwOnSend) {
      throw new Error('send failed');
    }
    this.sentPayloads.push(payload);
    return Promise.resolve();
  }

  public close(): void {
    this.readyState = SOCKET_READY_STATE.CLOSED;
    this.closeListeners.forEach(listener => listener({ code: 1000, reason: 'closed' }));
  }

  public onOpen(handler: () => void): () => void {
    this.openListeners.add(handler);
    return (): void => {
      this.openListeners.delete(handler);
    };
  }

  public onMessage(handler: MessageListener): () => void {
    this.messageListeners.add(handler);
    return (): void => {
      this.messageListeners.delete(handler);
    };
  }

  public onError(handler: (error: unknown) => void): () => void {
    this.errorListeners.add(handler);
    return (): void => {
      this.errorListeners.delete(handler);
    };
  }

  public onClose(handler: (event: { code?: number; reason?: string }) => void): () => void {
    this.closeListeners.add(handler);
    return (): void => {
      this.closeListeners.delete(handler);
    };
  }

  public emitMessage(data: unknown): void {
    this.messageListeners.forEach(listener => listener(data as SocketMessageData));
  }
}

describe('HeartbeatManager', (): void => {
  afterEach((): void => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('start 应按间隔发送 ping，并在超时时触发回调', async (): Promise<void> => {
    vi.useFakeTimers();
    const socket = new EventSocket();
    const timeoutSpy = vi.fn();
    const manager = new HeartbeatManager({
      interval: 50,
      timeout: 20,
    });

    manager.start(socket, timeoutSpy);
    await vi.advanceTimersByTimeAsync(50);

    expect(socket.sentPayloads).toHaveLength(1);
    const firstPayload = JSON.parse(socket.sentPayloads[0] ?? '{}') as { type?: string };
    expect(firstPayload.type).toBe('ping');

    await vi.advanceTimersByTimeAsync(20);
    expect(timeoutSpy).toHaveBeenCalledTimes(1);

    manager.stop();
  });

  it('收到 pong（字符串/ArrayBuffer）后应更新存活时间', (): void => {
    const socket = new EventSocket();
    const manager = new HeartbeatManager({
      interval: 100,
      timeout: 200,
    });
    manager.start(socket);

    const before = manager.getLastPongTime();
    socket.emitMessage(JSON.stringify({ type: 'pong' }));
    expect(manager.getLastPongTime()).toBeGreaterThanOrEqual(before);

    const pongBuffer = new TextEncoder().encode(JSON.stringify({ type: 'pong' })).buffer;
    const secondBefore = manager.getLastPongTime();
    socket.emitMessage(pongBuffer);
    expect(manager.getLastPongTime()).toBeGreaterThanOrEqual(secondBefore);

    manager.stop();
  });

  it('probeOnce 在非 OPEN 状态应直接返回 false', async (): Promise<void> => {
    const socket = new EventSocket();
    socket.readyState = SOCKET_READY_STATE.CLOSED;
    const manager = new HeartbeatManager({
      interval: 10,
      timeout: 10,
    });

    await expect(manager.probeOnce(socket, 10)).resolves.toBe(false);
  });

  it('probeOnce 收到 pong 时应返回 true', async (): Promise<void> => {
    vi.useFakeTimers();
    const socket = new EventSocket();
    const manager = new HeartbeatManager({
      interval: 10,
      timeout: 100,
    });

    const probePromise = manager.probeOnce(socket, 50);
    socket.emitMessage(JSON.stringify({ type: 'pong' }));
    await expect(probePromise).resolves.toBe(true);

    manager.stop();
  });

  it('probeOnce 发送异常时应返回 false', async (): Promise<void> => {
    const socket = new EventSocket();
    socket.throwOnSend = true;
    const manager = new HeartbeatManager({
      interval: 10,
      timeout: 50,
    });

    await expect(manager.probeOnce(socket, 20)).resolves.toBe(false);
  });

  it('stop 后应移除 message 监听，不再响应后续 pong', (): void => {
    const socket = new EventSocket();
    const manager = new HeartbeatManager({
      interval: 10,
      timeout: 30,
    });

    manager.start(socket);
    manager.stop();
    const before = manager.getLastPongTime();
    socket.emitMessage(JSON.stringify({ type: 'pong' }));

    expect(manager.getLastPongTime()).toBe(before);
  });
});
