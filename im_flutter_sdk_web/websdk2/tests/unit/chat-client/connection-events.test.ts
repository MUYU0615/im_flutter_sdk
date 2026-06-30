import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'; // 测试框架
import { ChatClient } from '@/chat-client'; // 客户端
import { ConnectionManager } from '@/core/connection/connection-manager'; // 连接管理器
import { ConnectionEventName, ConnectionStatus, type ConnectionEventPayload } from '@/types'; // 连接事件类型
import { buildProvisionResponse } from '../../test-utils/msync';

const resetSingleton = (): void => {
  (ChatClient as unknown as { instance: ChatClient | null }).instance = null;
};

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  binaryType = 'arraybuffer';
  private listeners = new Map<string, Set<(event: Event) => void>>();
  private provisionHandled = false;

  private emit(type: string, event: Event): void {
    if (type === 'open') {
      this.onopen?.(event);
    } else if (type === 'close') {
      this.onclose?.(event as CloseEvent);
    } else if (type === 'error') {
      this.onerror?.(event);
    } else if (type === 'message') {
      this.onmessage?.(event as MessageEvent);
    }
    this.listeners.get(type)?.forEach(listener => listener(event));
  }

  constructor() {
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.emit('open', new Event('open'));
      this.emit('message', { data: buildProvisionResponse() } as MessageEvent);
    }, 0);
  }

  send(): void {
    if (this.provisionHandled) {
      return;
    }
    this.provisionHandled = true;
    this.emit('message', { data: buildProvisionResponse() } as MessageEvent);
  }

  addEventListener(type: string, handler: (event: Event) => void): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(handler);
  }

  removeEventListener(type: string, handler: (event: Event) => void): void {
    this.listeners.get(type)?.delete(handler);
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED;
    this.emit('close', new Event('close') as CloseEvent);
  }
}

const createJsonResponse = (data: unknown): Response => {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: {
      get: () => 'application/json',
    },
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as unknown as Response;
};

describe('ChatClient connection events', (): void => {
  beforeEach((): void => {
    resetSingleton();
    globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
    const prototype = ConnectionManager.prototype as unknown as {
      startProvision: () => Promise<void>;
    };
    vi.spyOn(prototype, 'startProvision').mockResolvedValue(undefined);
  });

  afterEach((): void => {
    vi.restoreAllMocks();
  });

  it('should emit connection state changes and support unsubscribe', async (): Promise<void> => {
    const dnsConfig = {
      rest: { hosts: [{ protocol: 'http', domain: 'rest.example.com', port: '80' }] },
      'msync-wx': { hosts: [{ protocol: 'http', domain: 'msync.example.com', port: '80' }] },
    };

    globalThis.fetch = vi.fn(async () => createJsonResponse(dnsConfig)) as unknown as typeof fetch;

    const client = ChatClient.init({ appKey: 'app-key' });
    const events: ConnectionEventPayload[] = [];
    client.addEventHandler('test', {
      [ConnectionEventName.CONNECTING]: (payload: ConnectionEventPayload): void => {
        events.push(payload);
      },
      [ConnectionEventName.CONNECTED]: (payload: ConnectionEventPayload): void => {
        events.push(payload);
      },
      [ConnectionEventName.DISCONNECTED]: (payload: ConnectionEventPayload): void => {
        events.push(payload);
      },
    });

    await client.login({ userId: 'user-1', token: 'token-1' });
    await client.logout();

    expect(events.map(payload => payload.state)).toEqual([
      ConnectionStatus.CONNECTING,
      ConnectionStatus.CONNECTED,
      ConnectionStatus.DISCONNECTED,
    ]);

    client.removeEventHandler('test');
    events.length = 0;

    await client.login({ userId: 'user-1', token: 'token-1' });
    await client.logout();

    expect(events).toEqual([]);
  });
});
