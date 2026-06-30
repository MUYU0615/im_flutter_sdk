import { describe, expect, it, vi } from 'vitest';

import { computeMd5Hex } from '../../../src/utils/md5';
import { createMiniAppPlatformAdapterOverrides, type MiniAppWxLike } from '../../../miniprogram-demo/utils/platform-adapters';

class MockSocketTask {
  private readonly openListeners = new Set<(event: { header?: Record<string, string> }) => void>();
  private readonly messageListeners = new Set<(event: { data: string | ArrayBuffer }) => void>();
  private readonly errorListeners = new Set<(event: { errMsg?: string }) => void>();
  private readonly closeListeners = new Set<(event: { code?: number; reason?: string }) => void>();
  public readonly sentPayloads: Array<string | ArrayBuffer> = [];
  public readonly closeCalls: Array<{ code?: number; reason?: string }> = [];

  public send(options: {
    readonly data: string | ArrayBuffer;
    readonly success?: () => void;
    readonly fail?: (error: unknown) => void;
  }): void {
    this.sentPayloads.push(options.data);
    options.success?.();
  }

  public close(options?: {
    readonly code?: number;
    readonly reason?: string;
    readonly success?: () => void;
  }): void {
    this.closeCalls.push({
      code: options?.code,
      reason: options?.reason,
    });
    options?.success?.();
    this.emitClose({
      code: options?.code,
      reason: options?.reason,
    });
  }

  public onOpen(listener: (event: { header?: Record<string, string> }) => void): void {
    this.openListeners.add(listener);
  }

  public onMessage(listener: (event: { data: string | ArrayBuffer }) => void): void {
    this.messageListeners.add(listener);
  }

  public onError(listener: (event: { errMsg?: string }) => void): void {
    this.errorListeners.add(listener);
  }

  public onClose(listener: (event: { code?: number; reason?: string }) => void): void {
    this.closeListeners.add(listener);
  }

  public offOpen(listener: (event: { header?: Record<string, string> }) => void): void {
    this.openListeners.delete(listener);
  }

  public offError(listener: (event: { errMsg?: string }) => void): void {
    this.errorListeners.delete(listener);
  }

  public emitOpen(): void {
    this.openListeners.forEach(listener => {
      listener({});
    });
  }

  public emitMessage(data: string | ArrayBuffer): void {
    this.messageListeners.forEach(listener => {
      listener({ data });
    });
  }

  public emitError(errMsg: string): void {
    this.errorListeners.forEach(listener => {
      listener({ errMsg });
    });
  }

  public emitClose(event: { code?: number; reason?: string }): void {
    this.closeListeners.forEach(listener => {
      listener(event);
    });
  }
}

const createWxLike = (): { readonly wxLike: MiniAppWxLike; readonly socketTask: MockSocketTask } => {
  const socketTask = new MockSocketTask();
  const bytes = new Uint8Array([1, 2, 3, 4]);

  const wxLike: MiniAppWxLike = {
    request(options) {
      options.success?.({
        statusCode: 200,
        header: {
          'x-demo': '1',
        },
        data: {
          ok: true,
        },
      });
      return {
        abort: vi.fn(),
      };
    },
    connectSocket() {
      return socketTask;
    },
    uploadFile(options) {
      const progressListeners = new Set<
        (event: { progress: number; totalBytesSent: number; totalBytesExpectedToSend: number }) => void
      >();
      queueMicrotask(() => {
        progressListeners.forEach(listener => {
          listener({
            progress: 100,
            totalBytesSent: 4,
            totalBytesExpectedToSend: 4,
          });
        });
        options.success?.({
          statusCode: 201,
          data: '{"ok":true}',
        });
      });
      return {
        abort: vi.fn(),
        onProgressUpdate(listener) {
          progressListeners.add(listener);
        },
      };
    },
    getImageInfo(options) {
      options.success({
        width: 320,
        height: 240,
        type: 'png',
        path: options.src,
      });
    },
    compressImage(options) {
      options.success?.({
        tempFilePath: `${options.src}.compressed`,
      });
    },
    getFileSystemManager() {
      return {
        readFile(options) {
          options.success({
            data: bytes.buffer,
          });
        },
        getFileInfo(options) {
          options.success({
            size: bytes.byteLength,
          });
        },
      };
    },
    onNetworkStatusChange: vi.fn(),
    offNetworkStatusChange: vi.fn(),
    onAppShow: vi.fn(),
    offAppShow: vi.fn(),
    onAppHide: vi.fn(),
    offAppHide: vi.fn(),
    getNetworkType(options) {
      options.success?.({
        networkType: 'wifi',
      });
    },
    getStorageSync(key) {
      return key === 'demo' ? 'value' : '';
    },
    setStorageSync: vi.fn(),
    removeStorageSync: vi.fn(),
  };

  return {
    wxLike,
    socketTask,
  };
};

describe('miniapp-demo/platform-adapters', () => {
  it('桥接 request、socket、upload 与 storage 能力', async () => {
    const { wxLike, socketTask } = createWxLike();
    const overrides = createMiniAppPlatformAdapterOverrides(wxLike);

    const requestResult = await overrides.request?.request<{ ok: boolean }>({
      url: 'https://rest.example.com/demo',
      method: 'POST',
      body: {
        hello: 'world',
      },
    });
    expect(requestResult?.status).toBe(200);
    expect(requestResult?.data.ok).toBe(true);

    const connectPromise = overrides.socket?.connect({
      url: 'wss://ws.example.com/demo',
    });
    socketTask.emitOpen();
    const socket = await connectPromise;
    const receivedMessages: unknown[] = [];
    socket?.onMessage(data => {
      receivedMessages.push(data);
    });
    socketTask.emitMessage('hello');
    await socket?.send('world');
    socket?.close(1000, 'done');

    expect(receivedMessages).toEqual(['hello']);
    expect(socketTask.sentPayloads).toEqual(['world']);
    expect(socketTask.closeCalls).toEqual([{ code: 1000, reason: 'done' }]);

    const uploadProgress: number[] = [];
    const uploadResult = await overrides.upload?.upload({
      url: 'https://rest.example.com/upload',
      source: {
        sourceType: 'miniapp-path',
        path: '/tmp/demo/file.txt',
      },
      onProgress(progress) {
        uploadProgress.push(progress.loaded);
      },
    });
    expect(uploadResult?.status).toBe(201);
    expect(uploadProgress).toEqual([4]);

    expect(await overrides.storage?.getItem('demo')).toBe('value');
    await overrides.storage?.setItem('demo', 'next');
    await overrides.storage?.removeItem('demo');
  });

  it('桥接 runtime 与 image processor 能力', async () => {
    const { wxLike } = createWxLike();
    const overrides = createMiniAppPlatformAdapterOverrides(wxLike);
    const networkStates: boolean[] = [];
    const visibilityStates: boolean[] = [];

    const offNetwork = overrides.runtime?.onNetworkChange(online => {
      networkStates.push(online);
    });
    const offVisibility = overrides.runtime?.onAppVisibilityChange(foreground => {
      visibilityStates.push(foreground);
    });

    const imageInfo = await overrides.imageProcessor?.getImageInfo({
      sourceType: 'miniapp-path',
      path: '/tmp/demo/pic.png',
      size: 4,
    });
    const generated = await overrides.imageProcessor?.generateBigImage(
      {
        sourceType: 'miniapp-path',
        path: '/tmp/demo/pic.png',
        size: 4,
      },
      {
        maxShortEdge: 720,
        quality: 0.8,
      }
    );
    const md5 = await overrides.imageProcessor?.computeMd5({
      sourceType: 'miniapp-path',
      path: '/tmp/demo/pic.png',
      size: 4,
    });

    expect(networkStates).toEqual([true]);
    expect(visibilityStates).toEqual([true]);
    expect(imageInfo).toEqual({
      width: 320,
      height: 240,
      mimeType: 'image/png',
      fileSize: 4,
      isGif: false,
    });
    expect(generated?.source.path).toBe('/tmp/demo/pic.png.compressed');
    expect(md5).toBe(computeMd5Hex(new Uint8Array([1, 2, 3, 4])));

    offNetwork?.();
    offVisibility?.();
  });
});
