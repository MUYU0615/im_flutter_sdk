import { describe, expect, it } from 'vitest';

import {
  PLATFORM_ERROR_CODE,
  RUNTIME_PLATFORMS,
  createPlatformAdapter,
  detectRuntimePlatform,
  type PlatformAdapterOverrides,
  type PlatformAdapterProfile,
  type RequestConfig,
  type RequestResponse,
  type SocketConnectConfig,
  type SocketLike,
  type SocketSendData,
  type UploadConfig,
  type UploadResult,
} from '../../../src/platform';

const withGlobalOverrides = async <T>(
  overrides: Partial<
    Record<'wx' | 'qq' | 'tt' | 'swan' | 'my' | 'dd' | 'uni' | 'window' | 'document', unknown>
  >,
  runner: () => Promise<T> | T
): Promise<T> => {
  const entries = Object.entries(overrides) as Array<
    [keyof typeof overrides, (typeof overrides)[keyof typeof overrides]]
  >;
  const snapshots = entries.map(([key]) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);

  for (const [key, value] of entries) {
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value,
    });
  }

  try {
    return await runner();
  } finally {
    for (const [key, descriptor] of snapshots) {
      if (descriptor) {
        Object.defineProperty(globalThis, key, descriptor);
      } else {
        delete (globalThis as Record<string, unknown>)[key];
      }
    }
  }
};

const createStubSocket = (): SocketLike => {
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

const createStubOverrides = (): PlatformAdapterOverrides => {
  return {
    request: {
      request<TData>(_config: RequestConfig): Promise<RequestResponse<TData>> {
        return Promise.resolve({
          status: 200,
          headers: {},
          data: {} as TData,
        });
      },
    },
    upload: {
      upload(_config: UploadConfig): Promise<UploadResult> {
        return Promise.resolve({
          status: 200,
          body: '{"ok":true}',
        });
      },
    },
    socket: {
      connect(_config: SocketConnectConfig): Promise<SocketLike> {
        return Promise.resolve(createStubSocket());
      },
    },
    runtime: {
      getPlatform(): 'unknown' {
        return RUNTIME_PLATFORMS.UNKNOWN;
      },
      onNetworkChange(_listener: (online: boolean) => void): () => void {
        return (): void => undefined;
      },
      onAppVisibilityChange(_listener: (foreground: boolean) => void): () => void {
        return (): void => undefined;
      },
    },
    proto: {
      encode<TInput>(_type: string, _payload: TInput): Uint8Array {
        return new Uint8Array();
      },
      decode<TOutput>(_type: string, _payload: Uint8Array): TOutput {
        return {} as TOutput;
      },
    },
    storage: {
      getItem(_key: string): Promise<string | null> {
        return Promise.resolve(null);
      },
      setItem(_key: string, _value: string): Promise<void> {
        return Promise.resolve();
      },
      removeItem(_key: string): Promise<void> {
        return Promise.resolve();
      },
    },
  };
};

describe('platform/factory', () => {
  it('优先使用显式指定的平台', () => {
    const detected = detectRuntimePlatform(RUNTIME_PLATFORMS.REACT_NATIVE);
    expect(detected).toBe(RUNTIME_PLATFORMS.REACT_NATIVE);
  });

  it('可识别微信小程序运行时', () => {
    const detected = detectRuntimePlatform(undefined, {
      wx: {
        request: (): void => undefined,
        connectSocket: (): void => undefined,
      },
    });
    expect(detected).toBe(RUNTIME_PLATFORMS.WECHAT_MINIAPP);
  });

  it('可识别其他小程序运行时并复用小程序适配路径', () => {
    const miniRuntime = {
      request: (): void => undefined,
      connectSocket: (): void => undefined,
    };

    expect(detectRuntimePlatform(undefined, { qq: miniRuntime })).toBe(
      RUNTIME_PLATFORMS.QQ_MINIAPP
    );
    expect(detectRuntimePlatform(undefined, { tt: miniRuntime })).toBe(
      RUNTIME_PLATFORMS.TOUTIAO_MINIAPP
    );
    expect(detectRuntimePlatform(undefined, { swan: miniRuntime })).toBe(
      RUNTIME_PLATFORMS.BAIDU_MINIAPP
    );
    expect(detectRuntimePlatform(undefined, { my: miniRuntime })).toBe(
      RUNTIME_PLATFORMS.ALIPAY_MINIAPP
    );
    expect(detectRuntimePlatform(undefined, { dd: miniRuntime })).toBe(
      RUNTIME_PLATFORMS.DINGTALK_MINIAPP
    );
  });

  it('可识别 uniapp/react-native/electron/web/unknown 运行时', () => {
    expect(
      detectRuntimePlatform(undefined, {
        __uniConfig: {},
      })
    ).toBe(RUNTIME_PLATFORMS.UNIAPP);

    expect(
      detectRuntimePlatform(undefined, {
        navigator: {
          product: 'ReactNative',
        },
      })
    ).toBe(RUNTIME_PLATFORMS.REACT_NATIVE);

    expect(
      detectRuntimePlatform(undefined, {
        process: {
          versions: {
            electron: '30.0.0',
          },
        },
        window: {} as Window,
        document: {} as Document,
      })
    ).toBe(RUNTIME_PLATFORMS.ELECTRON_RENDERER);

    expect(
      detectRuntimePlatform(undefined, {
        process: {
          versions: {
            electron: '30.0.0',
          },
        },
      })
    ).toBe(RUNTIME_PLATFORMS.ELECTRON_MAIN);

    expect(
      detectRuntimePlatform(undefined, {
        skipWaiting: async (): Promise<void> => undefined,
        fetch: globalThis.fetch,
      })
    ).toBe(RUNTIME_PLATFORMS.WEB);

    expect(
      detectRuntimePlatform(undefined, {
        window: {} as Window,
        document: {} as Document,
      })
    ).toBe(RUNTIME_PLATFORMS.WEB);

    expect(
      detectRuntimePlatform(undefined, {
        navigator: {},
      })
    ).toBe(RUNTIME_PLATFORMS.UNKNOWN);
  });

  it('支持注入自定义适配器', () => {
    const overrides = createStubOverrides();
    const profile: PlatformAdapterProfile = createPlatformAdapter({
      prefer: RUNTIME_PLATFORMS.UNKNOWN,
      overrides,
    });

    expect(profile.platform).toBe(RUNTIME_PLATFORMS.UNKNOWN);
    expect(profile.platformId).toBe(RUNTIME_PLATFORMS.UNKNOWN);
    expect(profile.request).toBe(overrides.request);
    expect(profile.upload).toBe(overrides.upload);
    expect(profile.socket).toBe(overrides.socket);
    expect(profile.proto).toBe(overrides.proto);
    expect(profile.capability.request).toBe(true);
    expect(profile.capability.upload).toBe(true);
    expect(profile.capability.socket).toBe(true);
    expect(profile.capability.proto).toBe(true);
  });

  it('overrides 支持函数形式并可使用默认 runtime/storage', async () => {
    const overrides = createStubOverrides();
    const profile = createPlatformAdapter({
      prefer: RUNTIME_PLATFORMS.UNKNOWN,
      overrides: (defaults): PlatformAdapterOverrides => {
        return {
          request: overrides.request,
          upload: overrides.upload,
          socket: overrides.socket,
          proto: overrides.proto,
          runtime: defaults.runtime,
          storage: defaults.storage,
        };
      },
    });

    expect(profile.platform).toBe(RUNTIME_PLATFORMS.UNKNOWN);
    expect(profile.runtime.getPlatform()).toBe(RUNTIME_PLATFORMS.UNKNOWN);

    await profile.storage.setItem('k1', 'v1');
    await expect(profile.storage.getItem('k1')).resolves.toBe('v1');
    await profile.storage.removeItem('k1');
    await expect(profile.storage.getItem('k1')).resolves.toBeNull();
  });

  it('web 默认适配器应可初始化且包含 capability', () => {
    const profile = createPlatformAdapter({
      prefer: RUNTIME_PLATFORMS.WEB,
    });

    expect(profile.platform).toBe(RUNTIME_PLATFORMS.WEB);
    expect(profile.capability.request).toBe(true);
    expect(profile.capability.upload).toBe(true);
    expect(profile.capability.socket).toBe(true);
    expect(profile.capability.runtime).toBe(true);
    expect(profile.capability.proto).toBe(true);
    expect(profile.capability.storage).toBe(true);
  });

  it('wechat-miniapp 默认应注入可计算 md5 的 imageProcessor', async () => {
    await withGlobalOverrides(
      {
        wx: {
          getImageInfo(options: {
            readonly src: string;
            readonly success: (result: { width: number; height: number; type: string }) => void;
          }) {
            options.success({
              width: 320,
              height: 240,
              type: 'png',
            });
          },
          getFileSystemManager() {
            return {
              readFile(options: {
                readonly filePath: string;
                readonly success: (result: { data: ArrayBuffer }) => void;
              }) {
                options.success({
                  data: new Uint8Array([1, 2, 3, 4]).buffer,
                });
              },
            };
          },
        },
      },
      async () => {
        const overrides = createStubOverrides();
        const profile = createPlatformAdapter({
          prefer: RUNTIME_PLATFORMS.WECHAT_MINIAPP,
          overrides: {
            request: overrides.request,
            upload: overrides.upload,
            socket: overrides.socket,
            proto: overrides.proto,
          },
        });

        expect(profile.capability.imageProcessor).toBe(true);
        await expect(
          profile.imageProcessor?.computeMd5({
            sourceType: 'miniapp-path',
            path: '/tmp/demo.png',
            name: 'demo.png',
            mimeType: 'image/png',
            size: 4,
          })
        ).resolves.toBe('08d6c05a21512a79a1dfeb9d2a8f262f');
      }
    );
  });

  it('miniapp 运行时默认内置 request/socket/upload/storage/runtime 适配器', async () => {
    const miniRuntime = {
      request(options: {
        readonly success?: (result: { statusCode: number; data: string }) => void;
      }) {
        options.success?.({ statusCode: 200, data: 'ok' });
        return {
          abort(): void {
            return;
          },
        };
      },
      connectSocket() {
        return {
          send(): void {
            return;
          },
          close(): void {
            return;
          },
          onOpen(): void {
            return;
          },
          onMessage(): void {
            return;
          },
          onError(): void {
            return;
          },
          onClose(): void {
            return;
          },
        };
      },
      uploadFile(options: {
        readonly success?: (result: { statusCode: number; data: string }) => void;
      }) {
        options.success?.({ statusCode: 200, data: '{"ok":true}' });
        return {
          abort(): void {
            return;
          },
        };
      },
      getImageInfo(options: {
        readonly success: (result: { width: number; height: number; type: string }) => void;
      }) {
        options.success({ width: 1, height: 1, type: 'png' });
      },
      getFileSystemManager() {
        return {
          readFile(options: {
            readonly success: (result: { data: ArrayBuffer }) => void;
          }) {
            options.success({ data: new Uint8Array([1]).buffer });
          },
        };
      },
      getStorageSync(key: string): string {
        return key === 'mini-k' ? 'mini-v' : '';
      },
      setStorageSync(): void {
        return;
      },
      removeStorageSync(): void {
        return;
      },
    };

    await withGlobalOverrides({ qq: miniRuntime }, async () => {
      const profile = createPlatformAdapter();

      expect(profile.platform).toBe(RUNTIME_PLATFORMS.QQ_MINIAPP);
      expect(profile.capability.request).toBe(true);
      expect(profile.capability.upload).toBe(true);
      expect(profile.capability.socket).toBe(true);
      expect(profile.capability.storage).toBe(true);
      expect(profile.capability.runtime).toBe(true);
      expect(profile.capability.imageProcessor).toBe(true);
      await expect(profile.storage.getItem('mini-k')).resolves.toBe('mini-v');
    });
  });

  it('uniapp 在 h5 运行时默认应复用 web imageProcessor', async () => {
    await withGlobalOverrides(
      {
        window: {} as Window,
        document: {} as Document,
      },
      async () => {
        const overrides = createStubOverrides();
        const profile = createPlatformAdapter({
          prefer: RUNTIME_PLATFORMS.UNIAPP,
          overrides: {
            request: overrides.request,
            upload: overrides.upload,
            socket: overrides.socket,
            proto: overrides.proto,
          },
        });

        expect(profile.capability.imageProcessor).toBe(true);
        const file = new File(['abc'], 'abc.txt', { type: 'text/plain' });
        await expect(
          profile.imageProcessor?.computeMd5({
            sourceType: 'web-file',
            file,
            name: 'abc.txt',
            mimeType: 'text/plain',
            size: file.size,
          })
        ).resolves.toBe('900150983cd24fb0d6963f7d28e17f72');
      }
    );
  });

  it('uniapp 在小程序运行时默认应注入 miniapp imageProcessor', async () => {
    await withGlobalOverrides(
      {
        window: undefined,
        document: undefined,
        uni: {
          getImageInfo(options: {
            readonly src: string;
            readonly success: (result: { width: number; height: number; type: string }) => void;
          }) {
            options.success({
              width: 320,
              height: 240,
              type: 'png',
            });
          },
          getFileSystemManager() {
            return {
              readFile(options: {
                readonly filePath: string;
                readonly success: (result: { data: ArrayBuffer }) => void;
              }) {
                options.success({
                  data: new Uint8Array([1, 2, 3, 4]).buffer,
                });
              },
            };
          },
        },
      },
      async () => {
        const overrides = createStubOverrides();
        const profile = createPlatformAdapter({
          prefer: RUNTIME_PLATFORMS.UNIAPP,
          overrides: {
            request: overrides.request,
            upload: overrides.upload,
            socket: overrides.socket,
            proto: overrides.proto,
          },
        });

        expect(profile.capability.imageProcessor).toBe(true);
        await expect(
          profile.imageProcessor?.computeMd5({
            sourceType: 'miniapp-path',
            path: '/tmp/demo.png',
            name: 'demo.png',
            mimeType: 'image/png',
            size: 4,
          })
        ).resolves.toBe('08d6c05a21512a79a1dfeb9d2a8f262f');
      }
    );
  });

  it('unknown 平台默认使用 fallback runtime，并支持本地存储分支', async () => {
    const overrides = createStubOverrides();
    const profile = createPlatformAdapter({
      prefer: RUNTIME_PLATFORMS.UNKNOWN,
      overrides: {
        request: overrides.request,
        upload: overrides.upload,
        socket: overrides.socket,
      },
    });

    expect(profile.runtime.getPlatform()).toBe(RUNTIME_PLATFORMS.UNKNOWN);
    const offNetwork = profile.runtime.onNetworkChange((): void => undefined);
    const offVisibility = profile.runtime.onAppVisibilityChange((): void => undefined);
    offNetwork();
    offVisibility();

    await profile.storage.setItem('factory-k1', 'v1');
    await expect(profile.storage.getItem('factory-k1')).resolves.toBe('v1');
    await profile.storage.removeItem('factory-k1');
    await expect(profile.storage.getItem('factory-k1')).resolves.toBeNull();
  });

  it('localStorage 缺失时应回退内存存储', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      writable: true,
      value: undefined,
    });

    try {
      const overrides = createStubOverrides();
      const profile = createPlatformAdapter({
        prefer: RUNTIME_PLATFORMS.UNKNOWN,
        overrides: {
          request: overrides.request,
          upload: overrides.upload,
          socket: overrides.socket,
        },
      });

      await profile.storage.setItem('factory-mem', 'm1');
      await expect(profile.storage.getItem('factory-mem')).resolves.toBe('m1');
      await profile.storage.removeItem('factory-mem');
      await expect(profile.storage.getItem('factory-mem')).resolves.toBeNull();
    } finally {
      if (descriptor) {
        Object.defineProperty(globalThis, 'localStorage', descriptor);
      } else {
        delete (globalThis as { localStorage?: Storage }).localStorage;
      }
    }
  });

  it('关键能力缺失时 fail-fast', () => {
    const runtime = createStubOverrides().runtime;
    const storage = createStubOverrides().storage;

    expect(() => {
      createPlatformAdapter({
        prefer: RUNTIME_PLATFORMS.UNKNOWN,
        overrides: {
          request: undefined,
          upload: undefined,
          socket: undefined,
          proto: undefined,
          runtime,
          storage,
        },
      });
    }).toThrowError(/required capabilities/i);

    try {
      createPlatformAdapter({
        prefer: RUNTIME_PLATFORMS.UNKNOWN,
        overrides: {
          request: undefined,
          upload: undefined,
          socket: undefined,
          proto: undefined,
          runtime,
          storage,
        },
      });
    } catch (error) {
      if (error instanceof Error && 'code' in error) {
        expect((error as { code?: string }).code).toBe(PLATFORM_ERROR_CODE.MISSING_CAPABILITY);
      }
    }
  });
});
