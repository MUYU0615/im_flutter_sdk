import { describe, expect, it, vi } from 'vitest';

import { createWebSocketAdapter } from '@/platform/socket/web-socket-adapter';
import { PLATFORM_ERROR_CODE } from '@/platform/types';

class MockWebSocket {
  public static readonly CONNECTING = 0;
  public static readonly OPEN = 1;
  public static readonly CLOSING = 2;
  public static readonly CLOSED = 3;
  public static shouldThrowOnConstruct = false;
  public static lastInstance: MockWebSocket | null = null;

  public readyState = MockWebSocket.CONNECTING;
  public readonly sentPayloads: Array<string | ArrayBuffer | Uint8Array> = [];
  public readonly closedArgs: Array<number | string | undefined> = [];
  private readonly listeners: Map<string, Set<(event: Event) => void>> = new Map();

  public constructor(_url: string, _protocols?: string | string[]) {
    if (MockWebSocket.shouldThrowOnConstruct) {
      throw new Error('ctor failed');
    }
    MockWebSocket.lastInstance = this;
  }

  public send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
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

  public close(code?: number, reason?: string): void {
    this.closedArgs.push(code, reason);
    this.readyState = MockWebSocket.CLOSED;
    this.emit('close', new CloseEvent('close', { code: code ?? 1000, reason: reason ?? '' }));
  }

  public addEventListener(type: string, listener: (event: Event) => void): void {
    const handlers = this.listeners.get(type) ?? new Set();
    handlers.add(listener);
    this.listeners.set(type, handlers);
  }

  public removeEventListener(type: string, listener: (event: Event) => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  public emit(type: string, event: Event): void {
    const handlers = this.listeners.get(type);
    if (!handlers) {
      return;
    }
    handlers.forEach(handler => handler(event));
  }
}

class MockNodeWebSocket {
  public static readonly CONNECTING = 0;
  public static readonly OPEN = 1;
  public static readonly CLOSING = 2;
  public static readonly CLOSED = 3;
  public static lastInstance: MockNodeWebSocket | null = null;

  public readyState = MockNodeWebSocket.CONNECTING;
  public readonly sentPayloads: Array<string | ArrayBuffer | Uint8Array> = [];
  private readonly listeners: Map<string, Set<(...args: unknown[]) => void>> = new Map();

  public constructor(_url: string, _protocols?: string | string[]) {
    MockNodeWebSocket.lastInstance = this;
  }

  public send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
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
    if (ArrayBuffer.isView(data)) {
      this.sentPayloads.push(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
      return;
    }
    this.sentPayloads.push(new Uint8Array());
  }

  public close(code?: number, reason?: string): void {
    this.readyState = MockNodeWebSocket.CLOSED;
    this.emit('close', code ?? 1000, reason ?? '');
  }

  public on(event: string, listener: (...args: unknown[]) => void): void {
    const handlers = this.listeners.get(event) ?? new Set();
    handlers.add(listener);
    this.listeners.set(event, handlers);
  }

  public once(event: string, listener: (...args: unknown[]) => void): void {
    const wrapped = (...args: unknown[]): void => {
      this.off(event, wrapped);
      listener(...args);
    };
    this.on(event, wrapped);
  }

  public off(event: string, listener: (...args: unknown[]) => void): void {
    this.listeners.get(event)?.delete(listener);
  }

  public emit(event: string, ...args: unknown[]): void {
    const handlers = this.listeners.get(event);
    if (!handlers) {
      return;
    }
    handlers.forEach(handler => handler(...args));
  }
}

describe('platform/socket/web-socket-adapter', () => {
  it('未提供 ctor 时 createWebSocketAdapter 应返回 undefined', () => {
    const adapter = createWebSocketAdapter();
    expect(adapter).toBeUndefined();
  });

  it('constructor 抛错时 connect 应返回平台错误', async () => {
    MockWebSocket.shouldThrowOnConstruct = true;
    const adapter = createWebSocketAdapter({
      webSocketCtor: MockWebSocket as unknown as typeof WebSocket,
    });
    if (!adapter) {
      throw new Error('adapter should be created');
    }

    await expect(
      adapter.connect({
        url: 'wss://example.com/ws',
      })
    ).rejects.toMatchObject({
      code: PLATFORM_ERROR_CODE.SOCKET_FAILED,
    });
    MockWebSocket.shouldThrowOnConstruct = false;
  });

  it('open 前 error 时 connect 应失败', async () => {
    const adapter = createWebSocketAdapter({
      webSocketCtor: MockWebSocket as unknown as typeof WebSocket,
    });
    if (!adapter) {
      throw new Error('adapter should be created');
    }

    const pending = adapter.connect({ url: 'wss://example.com/ws' });
    MockWebSocket.lastInstance?.emit('error', new Event('error'));

    await expect(pending).rejects.toMatchObject({
      code: PLATFORM_ERROR_CODE.SOCKET_FAILED,
    });
  });

  it('连接后应支持发送/监听/卸载监听', async () => {
    const adapter = createWebSocketAdapter({
      webSocketCtor: MockWebSocket as unknown as typeof WebSocket,
    });
    if (!adapter) {
      throw new Error('adapter should be created');
    }

    const pending = adapter.connect({ url: 'wss://example.com/ws' });
    const instance = MockWebSocket.lastInstance;
    if (!instance) {
      throw new Error('mock websocket should be created');
    }
    instance.readyState = MockWebSocket.OPEN;
    instance.emit('open', new Event('open'));
    const socket = await pending;

    const onOpen = vi.fn();
    const onMessage = vi.fn();
    const onError = vi.fn();
    const onClose = vi.fn();

    const offOpen = socket.onOpen(onOpen);
    const offMessage = socket.onMessage(onMessage);
    const offError = socket.onError(onError);
    const offClose = socket.onClose(onClose);

    instance.emit('open', new Event('open'));
    instance.emit('message', new MessageEvent('message', { data: 'hello' }));
    instance.emit('message', new MessageEvent('message', { data: { invalid: true } }));
    instance.emit('error', new Event('error'));
    instance.emit('close', new CloseEvent('close', { code: 3001, reason: 'bye' }));

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onMessage).toHaveBeenCalledWith('hello');
    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledWith({ code: 3001, reason: 'bye' });

    await socket.send('payload');
    expect(instance.sentPayloads).toContain('payload');

    offOpen();
    offMessage();
    offError();
    offClose();
    instance.emit('open', new Event('open'));
    instance.emit('message', new MessageEvent('message', { data: 'again' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onMessage).toHaveBeenCalledTimes(1);

    socket.close(1000, 'normal');
    expect(instance.closedArgs).toEqual([1000, 'normal']);
  });

  it('非 OPEN 状态发送应抛出平台错误', async () => {
    const adapter = createWebSocketAdapter({
      webSocketCtor: MockWebSocket as unknown as typeof WebSocket,
    });
    if (!adapter) {
      throw new Error('adapter should be created');
    }

    const pending = adapter.connect({ url: 'wss://example.com/ws' });
    const instance = MockWebSocket.lastInstance;
    if (!instance) {
      throw new Error('mock websocket should be created');
    }
    instance.readyState = MockWebSocket.OPEN;
    instance.emit('open', new Event('open'));
    const socket = await pending;

    instance.readyState = MockWebSocket.CLOSED;
    expect(() => socket.send('payload')).toThrowError();
  });

  it('应兼容 node ws 风格事件接口', async () => {
    const adapter = createWebSocketAdapter({
      webSocketCtor: MockNodeWebSocket as unknown as typeof WebSocket,
    });
    if (!adapter) {
      throw new Error('adapter should be created');
    }

    const pending = adapter.connect({ url: 'ws://127.0.0.1:19365/websocket' });
    const instance = MockNodeWebSocket.lastInstance;
    if (!instance) {
      throw new Error('mock node websocket should be created');
    }
    instance.readyState = MockNodeWebSocket.OPEN;
    instance.emit('open');
    const socket = await pending;

    const onMessage = vi.fn();
    const onError = vi.fn();
    const onClose = vi.fn();

    const offMessage = socket.onMessage(onMessage);
    const offError = socket.onError(onError);
    const offClose = socket.onClose(onClose);

    instance.emit('message', new Uint8Array([1, 2, 3]));
    instance.emit('error', new Error('boom'));
    instance.emit('close', 3002, Buffer.from('bye'));

    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessage.mock.calls[0]?.[0]).toBeInstanceOf(ArrayBuffer);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledWith({ code: 3002, reason: 'bye' });

    await socket.send(new Uint8Array([9, 8, 7]));
    expect(instance.sentPayloads).toHaveLength(1);

    offMessage();
    offError();
    offClose();
    instance.emit('message', new Uint8Array([4, 5, 6]));
    expect(onMessage).toHaveBeenCalledTimes(1);
  });
});
