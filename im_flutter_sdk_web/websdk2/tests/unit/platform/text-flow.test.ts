import { describe, expect, it } from 'vitest';

import { createWebRequestAdapter, createWebSocketAdapter } from '../../../src/platform';

class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static lastInstance: MockWebSocket | null = null;

  readyState = MockWebSocket.CONNECTING;
  readonly sentPayloads: Array<string | ArrayBuffer | Uint8Array> = [];
  private listeners: Map<string, Set<(event: Event) => void>> = new Map();

  constructor(_url: string, _protocols?: string | string[]) {
    MockWebSocket.lastInstance = this;
    queueMicrotask(() => {
      this.readyState = MockWebSocket.OPEN;
      this.emit('open', new Event('open'));
    });
  }

  send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
    if (typeof data === 'string') {
      this.sentPayloads.push(data);
      return;
    }
    if (data instanceof ArrayBuffer) {
      this.sentPayloads.push(data);
      return;
    }
    if (data instanceof Uint8Array) {
      this.sentPayloads.push(data);
      return;
    }
    if (data instanceof Blob) {
      this.sentPayloads.push(new Uint8Array());
      return;
    }
    if (ArrayBuffer.isView(data)) {
      this.sentPayloads.push(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
      return;
    }
    this.sentPayloads.push(new Uint8Array(data));
  }

  close(_code?: number, _reason?: string): void {
    this.readyState = MockWebSocket.CLOSED;
    this.emit('close', new CloseEvent('close', { code: 1000, reason: 'closed' }));
  }

  addEventListener(type: string, listener: (event: Event) => void): void {
    const handlers = this.listeners.get(type) ?? new Set();
    handlers.add(listener);
    this.listeners.set(type, handlers);
  }

  removeEventListener(type: string, listener: (event: Event) => void): void {
    const handlers = this.listeners.get(type);
    handlers?.delete(listener);
  }

  emitMessage(data: string): void {
    this.emit('message', new MessageEvent('message', { data }));
  }

  private emit(type: string, event: Event): void {
    const handlers = this.listeners.get(type);
    if (!handlers) {
      return;
    }
    handlers.forEach(handler => {
      handler(event);
    });
  }
}

describe('platform/text-flow', () => {
  it('请求与连接适配器可驱动文本发送闭环', async () => {
    const requestAdapter = createWebRequestAdapter({
      fetchImpl: (): Promise<Response> => {
        return Promise.resolve(
          new Response(JSON.stringify({ token: 'token-1' }), {
            status: 200,
            headers: {
              'content-type': 'application/json',
            },
          })
        );
      },
    });
    const socketAdapter = createWebSocketAdapter({
      webSocketCtor: MockWebSocket as unknown as typeof WebSocket,
    });

    expect(requestAdapter).toBeDefined();
    expect(socketAdapter).toBeDefined();

    if (!requestAdapter || !socketAdapter) {
      throw new Error('request/socket adapter should be created in this test');
    }

    const response = await requestAdapter.request<{ token: string }>({
      url: 'https://sdk.local/login',
      method: 'POST',
      body: {
        userId: 'u-1',
      },
    });
    expect(response.data.token).toBe('token-1');

    const socket = await socketAdapter.connect({
      url: 'wss://sdk.local/ws',
    });
    const received: string[] = [];
    socket.onMessage(data => {
      if (typeof data === 'string') {
        received.push(data);
      }
    });

    await socket.send('hello-text');
    MockWebSocket.lastInstance?.emitMessage('ack-text');

    expect(MockWebSocket.lastInstance?.sentPayloads).toContain('hello-text');
    expect(received).toEqual(['ack-text']);
  });
});
