import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ChatClient } from '@/chat-client';
import { CoreSDK } from '@/core';
import { ConnectionManager } from '@/core/connection/connection-manager';
import { ERROR_CODES } from '@/utils/error-codes';
import * as loggerModule from '@/utils/logger'; // 日志模块
import { ConnectionError } from '@/utils/errors';
import { buildProvisionResponse } from '../../test-utils/msync';

const resetSingleton = (): void => {
  (ChatClient as unknown as { instance: ChatClient | null }).instance = null;
};

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances: MockWebSocket[] = [];

  url: string;
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

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);

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
    let listeners = this.listeners.get(type);
    if (!listeners) {
      listeners = new Set();
      this.listeners.set(type, listeners);
    }
    listeners.add(handler);
  }

  removeEventListener(type: string, handler: (event: Event) => void): void {
    this.listeners.get(type)?.delete(handler);
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED;
    this.emit('close', new Event('close') as CloseEvent);
  }
}

const createJsonResponse = (data: unknown, ok = true): Response => {
  return {
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? 'OK' : 'Error',
    headers: {
      get: (): string => 'application/json',
    },
    json: (): Promise<unknown> => Promise.resolve(data),
    text: (): Promise<string> => Promise.resolve(JSON.stringify(data)),
  } as unknown as Response;
};

describe('ChatClient login/logout', () => {
  beforeEach((): void => {
    resetSingleton();
    MockWebSocket.instances = [];
    globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
    const provisionTarget = ConnectionManager.prototype as unknown as {
      startProvision: () => Promise<void>;
    };
    vi.spyOn(provisionTarget, 'startProvision').mockResolvedValue(undefined);
  });

  afterEach((): void => {
    vi.restoreAllMocks();
  });

  it('should retry dnsconfig and connect', async (): Promise<void> => {
    const dnsConfigUrls = ['https://rs.easemob.com', 'https://rs.chat.agora.io'];
    const dnsConfig = {
      rest: { hosts: [{ protocol: 'http', domain: 'rest.example.com', port: '80' }] },
      'msync-wx': {
        hosts: [
          { protocol: 'http', domain: 'msync.example.com', port: '80' },
          { protocol: 'https', domain: 'msync-https.example.com', port: '443' },
        ],
      },
    };

    const fetchMock = vi.fn((input: RequestInfo): Promise<Response> => {
      const url = typeof input === 'string' ? input : input.url;
      const primaryUrl = dnsConfigUrls[0];
      if (!primaryUrl) {
        throw new Error('dnsConfigUrls is empty');
      }
      if (url.startsWith(primaryUrl)) {
        throw new Error('network error');
      }
      return Promise.resolve(createJsonResponse(dnsConfig));
    });

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = ChatClient.init({ appKey: 'app-key', serviceConfig: { dnsConfigUrls } });
    await client.login({ userId: 'user-1', token: 'token-1' });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(MockWebSocket.instances[0]?.url).toBe('ws://msync.example.com/websocket');

    await client.logout();
    expect(client.getConnectionState()).toBe('disconnected');
  });

  it('should report logs on login and logout when enabled', async (): Promise<void> => { // 登录退出上报测试
    const dnsConfig = { // 构造 DNS 配置
      rest: { hosts: [{ protocol: 'http', domain: 'rest.example.com', port: '80' }] }, // REST hosts
      'msync-wx': { hosts: [{ protocol: 'http', domain: 'msync.example.com', port: '80' }] }, // WS hosts
      enableReportLogs: 'true', // 开启日志上报
    };

    globalThis.fetch = vi.fn(
      (): Promise<Response> => Promise.resolve(createJsonResponse(dnsConfig))
    ) as unknown as typeof fetch; // Mock fetch
    const reportSpy = vi.spyOn(loggerModule, 'reportLogsNow').mockResolvedValue(undefined); // Mock 上报

    const client = ChatClient.init({ appKey: 'app-key' }); // 初始化客户端
    await client.login({ userId: 'user-1', token: 'token-1' }); // 登录
    await client.logout(); // 登出

    expect(reportSpy).toHaveBeenCalledTimes(2); // 验证登录与登出上报
  });

  it('should reject login when already connected', async (): Promise<void> => {
    const dnsConfig = {
      rest: { hosts: [{ protocol: 'http', domain: 'rest.example.com', port: '80' }] },
      'msync-wx': { hosts: [{ protocol: 'http', domain: 'msync.example.com', port: '80' }] },
    };

    globalThis.fetch = vi.fn(
      (): Promise<Response> => Promise.resolve(createJsonResponse(dnsConfig))
    ) as unknown as typeof fetch;

    const client = ChatClient.init({ appKey: 'app-key' });
    await client.login({ userId: 'user-1', token: 'token-1' });

    await expect(client.login({ userId: 'user-1', token: 'token-1' })).rejects.toThrow();
  });

  it('should reject login with 218 when another user is already connected', async (): Promise<void> => {
    const dnsConfig = {
      rest: { hosts: [{ protocol: 'http', domain: 'rest.example.com', port: '80' }] },
      'msync-wx': { hosts: [{ protocol: 'http', domain: 'msync.example.com', port: '80' }] },
    };

    globalThis.fetch = vi.fn(
      (): Promise<Response> => Promise.resolve(createJsonResponse(dnsConfig))
    ) as unknown as typeof fetch;

    const client = ChatClient.init({ appKey: 'app-key' });
    await client.login({ userId: 'user-1', token: 'token-1' });

    await expect(client.login({ userId: 'user-2', token: 'token-2' })).rejects.toMatchObject({
      code: ERROR_CODES.USER_ALREADY_LOGIN_ANOTHER,
      details: {
        currentUserId: 'user-1',
        nextUserId: 'user-2',
      },
    });
  });

  it('should use fixed service urls when serverUrls is configured', async (): Promise<void> => {
    globalThis.fetch = vi.fn(
      (): Promise<Response> => Promise.resolve(createJsonResponse({}))
    ) as unknown as typeof fetch;

    const client = ChatClient.init({
      appKey: 'app-key',
      serviceConfig: {
        serverUrls: {
          restApiUrl: 'https://rest.example.com',
          wsUrl: 'ws://msync.example.com/websocket',
        },
      },
    });
    await client.login({ userId: 'user-1', token: 'token-1' });

    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(MockWebSocket.instances[0]?.url).toBe('ws://msync.example.com/websocket');

    await client.logout();
  });

  it('should reset to disconnected and allow retry when login connect fails', async (): Promise<void> => {
    const dnsConfig = {
      rest: { hosts: [{ protocol: 'http', domain: 'rest.example.com', port: '80' }] },
      'msync-wx': { hosts: [{ protocol: 'http', domain: 'msync.example.com', port: '80' }] },
    };

    globalThis.fetch = vi.fn(
      (): Promise<Response> => Promise.resolve(createJsonResponse(dnsConfig))
    ) as unknown as typeof fetch;
    const connectSpy = vi
      .spyOn(CoreSDK.prototype, 'connect')
      .mockRejectedValueOnce(
        new ConnectionError('Provision rejected', {
          details: {
            stage: 'provision',
          },
        })
      )
      .mockResolvedValueOnce(undefined);

    const client = ChatClient.init({ appKey: 'app-key' });

    await expect(client.login({ userId: 'user-1', token: 'token-1' })).rejects.toThrow(
      'Provision rejected'
    );
    expect(client.getConnectionState()).toBe('disconnected');

    await expect(client.login({ userId: 'user-1', token: 'token-1' })).resolves.toBeUndefined();
    expect(connectSpy).toHaveBeenCalledTimes(2);
  });
});
