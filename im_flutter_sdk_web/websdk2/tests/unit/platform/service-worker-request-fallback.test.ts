import { describe, expect, it, vi } from 'vitest';

import {
  RUNTIME_PLATFORMS,
  createPlatformAdapter,
  createWebUploadAdapter,
  detectRuntimePlatform,
  type SocketConnectConfig,
  type SocketLike,
  type SocketSendData,
} from '../../../src/platform';

const createSocketStub = (): SocketLike => {
  return {
    readyState: 1,
    send(_data: SocketSendData): Promise<void> {
      return Promise.resolve();
    },
    close(_code?: number, _reason?: string): void {
      return;
    },
    onOpen(_handler: () => void): () => void {
      return (): void => undefined;
    },
    onMessage(_handler: (data: string | ArrayBuffer | Blob) => void): () => void {
      return (): void => undefined;
    },
    onError(_handler: (error: unknown) => void): () => void {
      return (): void => undefined;
    },
    onClose(_handler: (event: { code?: number; reason?: string }) => void): () => void {
      return (): void => undefined;
    },
  };
};

describe('platform/service-worker-request-fallback', () => {
  it('可识别 Service Worker 运行时并映射为 web 平台', () => {
    const detected = detectRuntimePlatform(undefined, {
      fetch: (): Promise<Response> => Promise.resolve(new Response('{}', { status: 200 })),
      skipWaiting: (): Promise<void> => Promise.resolve(),
    });

    expect(detected).toBe(RUNTIME_PLATFORMS.WEB);
  });

  it('WebUploadAdapter 在无 XMLHttpRequest 时可回退到 fetch', async () => {
    const fetchMock = vi.fn((): Promise<Response> => {
      return Promise.resolve(new Response('{"ok":true}', { status: 201 }));
    });
    const adapter = createWebUploadAdapter({
      fetchImpl: fetchMock as unknown as typeof fetch,
      xhrFactory: undefined,
    });
    const onProgress = vi.fn();

    expect(adapter).toBeDefined();
    if (!adapter) {
      throw new Error('adapter should be available');
    }

    const file = new File([new Uint8Array([1, 2, 3, 4])], 'a.bin', {
      type: 'application/octet-stream',
    });
    const result = await adapter.upload({
      url: 'https://upload.local/chatfiles',
      headers: {
        Authorization: 'Bearer token',
      },
      source: {
        sourceType: 'web-file',
        file,
        name: 'a.bin',
        size: file.size,
      },
      fields: {
        test: '1',
      },
      onProgress,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onProgress).toHaveBeenCalledWith({
      loaded: file.size,
      total: file.size,
      percent: 100,
    });
    expect(result).toEqual({
      status: 201,
      body: '{"ok":true}',
    });
  });

  it('平台工厂在无 XMLHttpRequest 时仍可装配 upload 能力', () => {
    const originalXhr = globalThis.XMLHttpRequest;
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn((): Promise<Response> => {
      return Promise.resolve(new Response('{"ok":true}', { status: 200 }));
    });

    Object.defineProperty(globalThis, 'XMLHttpRequest', {
      configurable: true,
      writable: true,
      value: undefined,
    });
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      writable: true,
      value: fetchMock,
    });

    try {
      const profile = createPlatformAdapter({
        prefer: RUNTIME_PLATFORMS.WEB,
        overrides: {
          socket: {
            connect(_config: SocketConnectConfig): Promise<SocketLike> {
              return Promise.resolve(createSocketStub());
            },
          },
        },
      });

      expect(profile.capability.request).toBe(true);
      expect(profile.capability.upload).toBe(true);
    } finally {
      Object.defineProperty(globalThis, 'XMLHttpRequest', {
        configurable: true,
        writable: true,
        value: originalXhr,
      });
      Object.defineProperty(globalThis, 'fetch', {
        configurable: true,
        writable: true,
        value: originalFetch,
      });
    }
  });
});
