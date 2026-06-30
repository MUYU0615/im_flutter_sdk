import { afterEach, describe, expect, it, vi } from 'vitest';

import { createWebUploadAdapter } from '@/platform/upload/web-upload-adapter';
import { PLATFORM_ERROR_CODE } from '@/platform/types';

type XhrBehavior = 'success' | 'abort' | 'timeout' | 'error';
type ProgressMode = 'computable' | 'non-computable';
type XhrListener = (event?: ProgressEvent<EventTarget>) => void;

class MockXMLHttpRequest {
  public static behavior: XhrBehavior = 'success';
  public static progressMode: ProgressMode = 'computable';
  public static lastInstance: MockXMLHttpRequest | null = null;

  public status = 200;
  public timeout = 0;
  public responseText = '{"ok":true}';
  public readonly headers: Record<string, string> = {};
  public method = '';
  public url = '';

  public readonly upload = {
    addEventListener: (type: string, listener: XhrListener): void => {
      if (type === 'progress') {
        this.progressListeners.push(listener);
      }
    },
  };

  private readonly listeners: Record<string, XhrListener[]> = {};
  private readonly progressListeners: XhrListener[] = [];

  public constructor() {
    MockXMLHttpRequest.lastInstance = this;
  }

  public addEventListener(type: string, listener: XhrListener): void {
    const group = this.listeners[type] ?? [];
    group.push(listener);
    this.listeners[type] = group;
  }

  public open(method: string, url: string): void {
    this.method = method;
    this.url = url;
  }

  public setRequestHeader(key: string, value: string): void {
    this.headers[key] = value;
  }

  public send(): void {
    this.emitProgress();
    if (MockXMLHttpRequest.behavior === 'success') {
      this.emit('load');
      return;
    }
    this.emit(MockXMLHttpRequest.behavior);
  }

  private emitProgress(): void {
    const event =
      MockXMLHttpRequest.progressMode === 'computable'
        ? ({
            loaded: 2,
            total: 4,
            lengthComputable: true,
          } as ProgressEvent<EventTarget>)
        : ({
            loaded: 3,
            total: 0,
            lengthComputable: false,
          } as ProgressEvent<EventTarget>);
    this.progressListeners.forEach(listener => listener(event));
  }

  private emit(type: string): void {
    const group = this.listeners[type] ?? [];
    group.forEach(listener => listener());
  }
}

describe('platform/upload/web-upload-adapter', () => {
  afterEach((): void => {
    vi.restoreAllMocks();
    MockXMLHttpRequest.behavior = 'success';
    MockXMLHttpRequest.progressMode = 'computable';
  });

  it('无 xhr/fetch 运行时时应返回 undefined', () => {
    const adapter = createWebUploadAdapter({
      xhrFactory: undefined,
      fetchImpl: undefined,
    });
    expect(adapter).toBeUndefined();
  });

  it('xhr 上传成功应返回 status/body 并触发进度', async () => {
    const adapter = createWebUploadAdapter({
      xhrFactory: (): XMLHttpRequest => new MockXMLHttpRequest() as unknown as XMLHttpRequest,
    });
    if (!adapter) {
      throw new Error('adapter should be created');
    }
    const onProgress = vi.fn();

    const result = await adapter.upload({
      url: 'https://upload.local/chatfiles',
      headers: {
        Authorization: 'Bearer token',
        Accept: '*/*',
      },
      source: {
        sourceType: 'web-file',
        file: new File(['abc'], 'a.txt', { type: 'text/plain' }),
        name: 'a.txt',
      },
      fields: {
        key: 'value',
      },
      onProgress,
    });

    expect(result).toEqual({
      status: 200,
      body: '{"ok":true}',
    });
    expect(onProgress).toHaveBeenCalledWith({
      loaded: 2,
      total: 4,
      percent: 50,
    });
    expect(MockXMLHttpRequest.lastInstance?.headers['Authorization']).toBe('Bearer token');
  });

  it('xhr progress 非可计算模式时应仅返回 loaded', async () => {
    MockXMLHttpRequest.progressMode = 'non-computable';
    const adapter = createWebUploadAdapter({
      xhrFactory: (): XMLHttpRequest => new MockXMLHttpRequest() as unknown as XMLHttpRequest,
    });
    if (!adapter) {
      throw new Error('adapter should be created');
    }
    const onProgress = vi.fn();

    await adapter.upload({
      url: 'https://upload.local/chatfiles',
      source: {
        sourceType: 'web-file',
        file: new File(['abc'], 'a.txt', { type: 'text/plain' }),
      },
      onProgress,
    });

    expect(onProgress).toHaveBeenCalledWith({
      loaded: 3,
    });
  });

  it('xhr abort/timeout/error 应映射为平台错误', async () => {
    const adapter = createWebUploadAdapter({
      xhrFactory: (): XMLHttpRequest => new MockXMLHttpRequest() as unknown as XMLHttpRequest,
    });
    if (!adapter) {
      throw new Error('adapter should be created');
    }
    const baseConfig = {
      url: 'https://upload.local/chatfiles',
      source: {
        sourceType: 'web-file' as const,
        file: new File(['abc'], 'a.txt', { type: 'text/plain' }),
      },
    };

    MockXMLHttpRequest.behavior = 'abort';
    await expect(adapter.upload(baseConfig)).rejects.toMatchObject({
      code: PLATFORM_ERROR_CODE.UPLOAD_FAILED,
      retryable: false,
      details: expect.objectContaining({ reason: 'abort' }),
    });

    MockXMLHttpRequest.behavior = 'timeout';
    await expect(adapter.upload(baseConfig)).rejects.toMatchObject({
      code: PLATFORM_ERROR_CODE.UPLOAD_FAILED,
      retryable: true,
      details: expect.objectContaining({ reason: 'timeout' }),
    });

    MockXMLHttpRequest.behavior = 'error';
    await expect(adapter.upload(baseConfig)).rejects.toMatchObject({
      code: PLATFORM_ERROR_CODE.UPLOAD_FAILED,
      retryable: true,
      details: expect.objectContaining({ reason: 'network' }),
    });
  });

  it('xhr 配置非法时应返回 invalid-config', async () => {
    const adapter = createWebUploadAdapter({
      xhrFactory: (): XMLHttpRequest => new MockXMLHttpRequest() as unknown as XMLHttpRequest,
    });
    if (!adapter) {
      throw new Error('adapter should be created');
    }

    await expect(
      adapter.upload({
        url: 'https://upload.local/chatfiles',
        source: {
          sourceType: 'rn-uri',
          uri: 'file://a.png',
        },
      })
    ).rejects.toMatchObject({
      code: PLATFORM_ERROR_CODE.UPLOAD_FAILED,
      details: expect.objectContaining({
        reason: 'invalid-config',
      }),
    });
  });

  it('fetch 上传成功应返回结果并补发 100% 进度', async () => {
    const fetchMock = vi.fn(async (): Promise<Response> => {
      return new Response('{"ok":true}', { status: 201 });
    });
    const adapter = createWebUploadAdapter({
      xhrFactory: undefined,
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    if (!adapter) {
      throw new Error('adapter should be created');
    }
    const onProgress = vi.fn();
    const file = new File(['abc'], 'a.txt', { type: 'text/plain' });

    const result = await adapter.upload({
      url: 'https://upload.local/chatfiles',
      source: {
        sourceType: 'web-file',
        file,
        size: file.size,
      },
      onProgress,
    });

    expect(result).toEqual({ status: 201, body: '{"ok":true}' });
    expect(onProgress).toHaveBeenCalledWith({
      loaded: file.size,
      total: file.size,
      percent: 100,
    });
  });

  it('fetch AbortError 应按 timeout/abort 区分', async () => {
    const timeoutFetch = vi.fn(
      (_url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        return new Promise((_resolve, reject) => {
          const signal = init?.signal;
          signal?.addEventListener('abort', () => {
            const error = new Error('aborted');
            (error as { name: string }).name = 'AbortError';
            reject(error);
          });
        });
      }
    );
    const timeoutAdapter = createWebUploadAdapter({
      xhrFactory: undefined,
      fetchImpl: timeoutFetch as unknown as typeof fetch,
      timeoutMs: 1,
    });
    if (!timeoutAdapter) {
      throw new Error('timeout adapter should be created');
    }
    await expect(
      timeoutAdapter.upload({
        url: 'https://upload.local/chatfiles',
        source: {
          sourceType: 'web-file',
          file: new File(['abc'], 'a.txt', { type: 'text/plain' }),
        },
      })
    ).rejects.toMatchObject({
      code: PLATFORM_ERROR_CODE.UPLOAD_FAILED,
      details: expect.objectContaining({ reason: 'timeout' }),
    });

    const abortFetch = vi.fn(async (): Promise<Response> => {
      const error = new Error('aborted');
      (error as { name: string }).name = 'AbortError';
      throw error;
    });
    const abortAdapter = createWebUploadAdapter({
      xhrFactory: undefined,
      fetchImpl: abortFetch as unknown as typeof fetch,
    });
    if (!abortAdapter) {
      throw new Error('abort adapter should be created');
    }
    const controller = new AbortController();
    controller.abort();

    await expect(
      abortAdapter.upload({
        url: 'https://upload.local/chatfiles',
        source: {
          sourceType: 'web-file',
          file: new File(['abc'], 'a.txt', { type: 'text/plain' }),
        },
        signal: controller.signal,
      })
    ).rejects.toMatchObject({
      code: PLATFORM_ERROR_CODE.UPLOAD_FAILED,
      details: expect.objectContaining({ reason: 'abort' }),
    });
  });
});
