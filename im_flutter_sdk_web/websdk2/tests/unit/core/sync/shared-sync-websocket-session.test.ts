import { afterEach, describe, expect, it, vi } from 'vitest';
import { Script, createContext } from 'node:vm';

import { SharedSyncWebSocketSession } from '@/core/sync/shared-sync-websocket-session';
import { ERROR_CODES } from '@/utils/error-codes';
import { SDKError } from '@/utils/errors';
import { logger } from '@/utils/logger';

interface TestFrame {
  readonly type: number;
  readonly requestId: string;
  readonly body?: string;
}

class MockSharedSyncWebSocket {
  public static readonly CONNECTING = 0;
  public static readonly OPEN = 1;
  public static readonly CLOSING = 2;
  public static readonly CLOSED = 3;
  public static readonly instances: MockSharedSyncWebSocket[] = [];
  public static failOpenCount = 0;

  public readyState = MockSharedSyncWebSocket.CONNECTING;
  public binaryType = 'arraybuffer';
  public readonly sent: string[] = [];
  public readonly closes: Array<{ readonly code?: number; readonly reason?: string }> = [];
  private readonly listeners = new Map<string, Set<(event: Event) => void>>();

  public constructor(public readonly url: string) {
    MockSharedSyncWebSocket.instances.push(this);
    queueMicrotask(() => {
      if (MockSharedSyncWebSocket.failOpenCount > 0) {
        MockSharedSyncWebSocket.failOpenCount -= 1;
        this.emit('error', new Event('error'));
        this.close(1006, 'connect-failed');
        return;
      }
      this.readyState = MockSharedSyncWebSocket.OPEN;
      this.emit('open', new Event('open'));
    });
  }

  public send(data: unknown): void {
    if (typeof data === 'string') {
      this.sent.push(data);
      return;
    }
    if (ArrayBuffer.isView(data)) {
      this.sent.push(new TextDecoder().decode(new Uint8Array(data.buffer, data.byteOffset, data.byteLength)));
    }
  }

  public close(code?: number, reason?: string): void {
    this.readyState = MockSharedSyncWebSocket.CLOSED;
    this.closes.push({ code, reason });
    this.emit('close', new CloseEvent('close', { code: code ?? 1000, reason: reason ?? '' }));
  }

  public addEventListener(type: string, listener: (event: Event) => void): void {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  public removeEventListener(type: string, listener: (event: Event) => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  public receive(frame: TestFrame): void {
    this.emit('message', {
      data: new TextEncoder().encode(JSON.stringify(frame)),
    } as MessageEvent as unknown as Event);
  }

  public receivePayload(data: unknown): void {
    this.emit('message', {
      data,
    } as MessageEvent as unknown as Event);
  }

  private emit(type: string, event: Event): void {
    this.listeners.get(type)?.forEach(listener => listener(event));
  }
}

const decodeFrame = (payload: Uint8Array): {
  readonly type: number;
  readonly requestId?: string;
  readonly frame: TestFrame;
} => {
  const frame = JSON.parse(new TextDecoder().decode(payload)) as TestFrame;
  return {
    type: frame.type,
    requestId: frame.requestId,
    frame,
  };
};

const createRequest = (
  requestId: string,
  dataType: 'conversation' | 'contact' | 'group'
) => ({
  dataType,
  label: `${dataType}-sync`,
  requestId,
  encode: (): Uint8Array => new TextEncoder().encode(JSON.stringify({ requestId, dataType })),
  decode: decodeFrame,
  onFrame: (frame: TestFrame) => {
    if (frame.type === 5) {
      throw new SDKError(frame.body ?? 'server error', ERROR_CODES.CONTACT_SYNC_SOCKET_FAILED, {
        details: {
          stage: 'sync_page',
          requestId,
        },
      });
    }
    return {
      done: true,
      result: frame.body ?? '',
    };
  },
});

const flushMicrotasks = async (count: number = 4): Promise<void> => {
  for (let index = 0; index < count; index += 1) {
    await Promise.resolve();
  }
};

const waitForMacrotask = async (): Promise<void> => {
  await new Promise(resolve => {
    setTimeout(resolve, 0);
  });
};

describe('SharedSyncWebSocketSession', () => {
  const originalWebSocket = globalThis.WebSocket;

  afterEach((): void => {
    globalThis.WebSocket = originalWebSocket;
    MockSharedSyncWebSocket.instances.length = 0;
    MockSharedSyncWebSocket.failOpenCount = 0;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('应在同一条 WebSocket 上并发发送三类同步请求并按 requestId 路由', async () => {
    globalThis.WebSocket = MockSharedSyncWebSocket as unknown as typeof WebSocket;
    const session = new SharedSyncWebSocketSession({
      getUrls: () => Promise.resolve(['wss://sync.example.com/ws?token=secret']),
    });

    const conversation = session.request(createRequest('conversation-1', 'conversation'));
    const contact = session.request(createRequest('contact-1', 'contact'));
    const group = session.request(createRequest('group-1', 'group'));

    await flushMicrotasks();
    expect(MockSharedSyncWebSocket.instances).toHaveLength(1);
    const socket = MockSharedSyncWebSocket.instances[0];
    await flushMicrotasks();
    expect(socket?.sent).toHaveLength(3);

    socket?.receive({ type: 4, requestId: 'contact-1', body: 'contact-ok' });
    socket?.receive({ type: 13, requestId: 'group-1', body: 'group-ok' });
    socket?.receive({ type: 11, requestId: 'conversation-1', body: 'conversation-ok' });

    await expect(conversation).resolves.toBe('conversation-ok');
    await expect(contact).resolves.toBe('contact-ok');
    await expect(group).resolves.toBe('group-ok');
    await waitForMacrotask();
    expect(socket?.closes.at(-1)).toMatchObject({ code: 1000, reason: 'sync-websocket-complete' });
  });

  it('应按 requestId 将 type=5 错误只派发给对应请求', async () => {
    globalThis.WebSocket = MockSharedSyncWebSocket as unknown as typeof WebSocket;
    const session = new SharedSyncWebSocketSession({
      getUrls: () => Promise.resolve(['wss://sync.example.com/ws']),
    });

    const contact = session.request(createRequest('contact-1', 'contact'));
    const group = session.request(createRequest('group-1', 'group'));

    await flushMicrotasks();
    const socket = MockSharedSyncWebSocket.instances[0];
    socket?.receive({ type: 5, requestId: 'contact-1', body: 'contact failed' });
    socket?.receive({ type: 13, requestId: 'group-1', body: 'group-ok' });

    await expect(contact).rejects.toMatchObject({ message: 'contact failed' });
    await expect(group).resolves.toBe('group-ok');
  });

  it('应接受跨 realm ArrayBuffer 响应帧', async () => {
    globalThis.WebSocket = MockSharedSyncWebSocket as unknown as typeof WebSocket;
    const session = new SharedSyncWebSocketSession({
      getUrls: () => Promise.resolve(['wss://sync.example.com/ws']),
    });

    const pending = session.request(createRequest('group-1', 'group'));
    await flushMicrotasks();
    const socket = MockSharedSyncWebSocket.instances[0];
    const bytes = new TextEncoder().encode(
      JSON.stringify({ type: 13, requestId: 'group-1', body: 'group-ok' })
    );
    const foreignArrayBuffer = new Script('bytes.buffer.slice(0)').runInContext(
      createContext({ bytes })
    ) as ArrayBuffer;
    expect(foreignArrayBuffer).not.toBeInstanceOf(ArrayBuffer);

    socket?.receivePayload(foreignArrayBuffer);

    await expect(pending).resolves.toBe('group-ok');
  });

  it('连接失败时应按 maxAttempts=3 重试并记录日志', async () => {
    vi.useFakeTimers();
    globalThis.WebSocket = MockSharedSyncWebSocket as unknown as typeof WebSocket;
    MockSharedSyncWebSocket.failOpenCount = 2;
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation((): void => {});
    const session = new SharedSyncWebSocketSession({
      getUrls: () => Promise.resolve(['wss://sync-a.example.com/ws', 'wss://sync-b.example.com/ws']),
    });

    const pending = session.request(createRequest('contact-1', 'contact'));
    await flushMicrotasks();
    await vi.advanceTimersByTimeAsync(1000);
    await flushMicrotasks();
    await vi.advanceTimersByTimeAsync(2000);
    await flushMicrotasks();

    const socket = MockSharedSyncWebSocket.instances[2];
    expect(socket).toBeDefined();
    socket?.receive({ type: 4, requestId: 'contact-1', body: 'contact-ok' });

    await expect(pending).resolves.toBe('contact-ok');
    expect(MockSharedSyncWebSocket.instances).toHaveLength(3);
    expect(warnSpy).toHaveBeenCalledWith(
      'sync websocket retry scheduled',
      expect.objectContaining({
        maxAttempts: 3,
      })
    );
  });
});
