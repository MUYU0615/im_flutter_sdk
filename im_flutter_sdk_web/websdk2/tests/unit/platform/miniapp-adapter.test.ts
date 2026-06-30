import { describe, it, expect, vi } from 'vitest';
import { createMiniProgramAdapterOverrides } from '@/platform/miniapp/miniapp-adapter';
import { PLATFORM_ERROR_CODE, SOCKET_READY_STATE } from '@/platform/types';

vi.mock('@/platform/image/miniapp-image-processor', () => ({
  createMiniAppImageProcessor: () => ({}),
}));

const createMockRuntime = () => ({
  request: vi.fn(),
  connectSocket: vi.fn(),
  uploadFile: vi.fn(),
  getStorageSync: vi.fn(),
  setStorageSync: vi.fn(),
  removeStorageSync: vi.fn(),
  getStorage: vi.fn(),
  setStorage: vi.fn(),
  removeStorage: vi.fn(),
  onNetworkStatusChange: vi.fn(),
  offNetworkStatusChange: vi.fn(),
  getNetworkType: vi.fn(),
  onAppShow: vi.fn(),
  offAppShow: vi.fn(),
  onAppHide: vi.fn(),
  offAppHide: vi.fn(),
});

describe('createMiniProgramAdapterOverrides', () => {
  describe('assertMiniAppRuntime', () => {
    it('缺少必要能力时抛出 PlatformError', () => {
      expect(() => createMiniProgramAdapterOverrides({} as any)).toThrow();
      try {
        createMiniProgramAdapterOverrides({} as any);
      } catch (e: any) {
        expect(e.code).toBe(PLATFORM_ERROR_CODE.MISSING_CAPABILITY);
      }
    });
  });

  describe('request adapter', () => {
    it('请求成功时返回响应', async () => {
      const runtime = createMockRuntime();
      runtime.request.mockImplementation((opts: any) => {
        opts.success({ statusCode: 200, header: { 'x-h': '1' }, data: { ok: true } });
        return { abort: vi.fn() };
      });
      const { request } = createMiniProgramAdapterOverrides(runtime as any);
      const res = await request!.request({ url: 'https://api.test/path' });
      expect(res.status).toBe(200);
      expect(res.data).toEqual({ ok: true });
    });

    it('请求失败时 reject PlatformError', async () => {
      const runtime = createMockRuntime();
      runtime.request.mockImplementation((opts: any) => {
        opts.fail({ errMsg: 'network error' });
        return { abort: vi.fn() };
      });
      const { request } = createMiniProgramAdapterOverrides(runtime as any);
      await expect(request!.request({ url: 'https://api.test/path' })).rejects.toMatchObject({
        code: PLATFORM_ERROR_CODE.REQUEST_FAILED,
      });
    });

    it('abort 时 reject PlatformError', async () => {
      const runtime = createMockRuntime();
      const abortFn = vi.fn();
      runtime.request.mockImplementation(() => ({ abort: abortFn }));
      const { request } = createMiniProgramAdapterOverrides(runtime as any);
      const controller = new AbortController();
      const promise = request!.request({ url: 'https://api.test/path', signal: controller.signal });
      controller.abort();
      await expect(promise).rejects.toMatchObject({
        code: PLATFORM_ERROR_CODE.REQUEST_FAILED,
      });
      expect(abortFn).toHaveBeenCalled();
    });
  });

  describe('socket adapter', () => {
    const createMockSocketTask = () => {
      const openCbs: Array<() => void> = [];
      const msgCbs: Array<(e: any) => void> = [];
      const errCbs: Array<(e: any) => void> = [];
      const closeCbs: Array<(e: any) => void> = [];
      return {
        task: {
          onOpen: (cb: () => void) => { openCbs.push(cb); },
          onMessage: (cb: (e: any) => void) => { msgCbs.push(cb); },
          onError: (cb: (e: any) => void) => { errCbs.push(cb); },
          onClose: (cb: (e: any) => void) => { closeCbs.push(cb); },
          send: vi.fn((opts: any) => { opts.success?.(); }),
          close: vi.fn(),
          offOpen: vi.fn(),
          offError: vi.fn(),
        },
        fireOpen: () => openCbs.forEach(cb => cb()),
        fireMessage: (data: any) => msgCbs.forEach(cb => cb(data)),
        fireError: (e: any) => errCbs.forEach(cb => cb(e)),
        fireClose: (e: any) => closeCbs.forEach(cb => cb(e)),
      };
    };

    it('connect 成功时返回 SocketLike', async () => {
      const runtime = createMockRuntime();
      const mock = createMockSocketTask();
      runtime.connectSocket.mockImplementation(() => {
        // 延迟触发 open，让 createSocketLike 先注册 handler
        setTimeout(() => mock.fireOpen(), 0);
        return mock.task;
      });
      const { socket } = createMiniProgramAdapterOverrides(runtime as any);
      const sock = await socket!.connect({ url: 'wss://test' });
      // connect 解析后，再次触发 open 让内部 readyState 更新
      mock.fireOpen();
      expect(sock.readyState).toBe(SOCKET_READY_STATE.OPEN);
    });

    it('connect 失败时 reject PlatformError', async () => {
      const runtime = createMockRuntime();
      const mock = createMockSocketTask();
      runtime.connectSocket.mockImplementation((opts: any) => {
        setTimeout(() => opts.fail?.({ errMsg: 'connect failed' }), 0);
        return mock.task;
      });
      const { socket } = createMiniProgramAdapterOverrides(runtime as any);
      await expect(socket!.connect({ url: 'wss://test' })).rejects.toMatchObject({
        code: PLATFORM_ERROR_CODE.SOCKET_FAILED,
      });
    });

    it('send 和 close 正常工作', async () => {
      const runtime = createMockRuntime();
      const mock = createMockSocketTask();
      runtime.connectSocket.mockImplementation(() => {
        setTimeout(() => mock.fireOpen(), 0);
        return mock.task;
      });
      const { socket } = createMiniProgramAdapterOverrides(runtime as any);
      const sock = await socket!.connect({ url: 'wss://test' });
      // 触发内部 readyState 更新为 OPEN
      mock.fireOpen();
      await sock.send('hello');
      expect(mock.task.send).toHaveBeenCalled();
      sock.close(1000, 'bye');
      expect(mock.task.close).toHaveBeenCalled();
    });

    it('socket 事件回调正常触发', async () => {
      const runtime = createMockRuntime();
      const mock = createMockSocketTask();
      runtime.connectSocket.mockImplementation(() => {
        setTimeout(() => mock.fireOpen(), 0);
        return mock.task;
      });
      const { socket } = createMiniProgramAdapterOverrides(runtime as any);
      const sock = await socket!.connect({ url: 'wss://test' });

      const msgHandler = vi.fn();
      const errHandler = vi.fn();
      const closeHandler = vi.fn();
      sock.onMessage(msgHandler);
      sock.onError(errHandler);
      sock.onClose(closeHandler);

      mock.fireMessage({ data: 'msg-data' });
      expect(msgHandler).toHaveBeenCalledWith('msg-data');

      mock.fireError({ errMsg: 'err' });
      expect(errHandler).toHaveBeenCalled();

      mock.fireClose({ code: 1000, reason: 'normal' });
      expect(closeHandler).toHaveBeenCalledWith({ code: 1000, reason: 'normal' });
    });
  });

  describe('upload adapter', () => {
    it('上传成功时返回结果', async () => {
      const runtime = createMockRuntime();
      runtime.uploadFile.mockImplementation((opts: any) => {
        opts.success({ statusCode: 200, data: '{"url":"https://x/file"}' });
        return { abort: vi.fn(), onProgressUpdate: vi.fn() };
      });
      const { upload } = createMiniProgramAdapterOverrides(runtime as any);
      const res = await upload!.upload({
        url: 'https://upload.test',
        source: { sourceType: 'miniapp-path', path: '/tmp/file.png' },
      });
      expect(res.status).toBe(200);
    });

    it('上传失败时 reject PlatformError', async () => {
      const runtime = createMockRuntime();
      runtime.uploadFile.mockImplementation((opts: any) => {
        opts.fail({ errMsg: 'upload error' });
        return { abort: vi.fn(), onProgressUpdate: vi.fn() };
      });
      const { upload } = createMiniProgramAdapterOverrides(runtime as any);
      await expect(
        upload!.upload({
          url: 'https://upload.test',
          source: { sourceType: 'miniapp-path', path: '/tmp/file.png' },
        })
      ).rejects.toMatchObject({ code: PLATFORM_ERROR_CODE.UPLOAD_FAILED });
    });

    it('abort 时 reject PlatformError', async () => {
      const runtime = createMockRuntime();
      const abortFn = vi.fn();
      runtime.uploadFile.mockImplementation(() => ({ abort: abortFn, onProgressUpdate: vi.fn() }));
      const { upload } = createMiniProgramAdapterOverrides(runtime as any);
      const controller = new AbortController();
      const promise = upload!.upload({
        url: 'https://upload.test',
        source: { sourceType: 'miniapp-path', path: '/tmp/file.png' },
        signal: controller.signal,
      });
      controller.abort();
      await expect(promise).rejects.toMatchObject({ code: PLATFORM_ERROR_CODE.UPLOAD_FAILED });
      expect(abortFn).toHaveBeenCalled();
    });

    it('非 miniapp-path source 时抛出 PlatformError', async () => {
      const runtime = createMockRuntime();
      runtime.uploadFile.mockImplementation(() => ({ abort: vi.fn(), onProgressUpdate: vi.fn() }));
      const { upload } = createMiniProgramAdapterOverrides(runtime as any);
      await expect(
        upload!.upload({
          url: 'https://upload.test',
          source: { sourceType: 'web-file', file: new File([], 'f') },
        })
      ).rejects.toMatchObject({ code: PLATFORM_ERROR_CODE.UPLOAD_FAILED });
    });
  });

  describe('storage adapter', () => {
    it('getItem 使用 sync API 返回值', async () => {
      const runtime = createMockRuntime();
      runtime.getStorageSync.mockReturnValue('cached-value');
      const { storage } = createMiniProgramAdapterOverrides(runtime as any);
      expect(await storage!.getItem('key')).toBe('cached-value');
    });

    it('getItem sync 返回空字符串时返回 null', async () => {
      const runtime = createMockRuntime();
      runtime.getStorageSync.mockReturnValue('');
      const { storage } = createMiniProgramAdapterOverrides(runtime as any);
      expect(await storage!.getItem('key')).toBeNull();
    });

    it('setItem 使用 sync API', async () => {
      const runtime = createMockRuntime();
      const { storage } = createMiniProgramAdapterOverrides(runtime as any);
      await storage!.setItem('k', 'v');
      expect(runtime.setStorageSync).toHaveBeenCalledWith('k', 'v');
    });

    it('removeItem 使用 sync API', async () => {
      const runtime = createMockRuntime();
      const { storage } = createMiniProgramAdapterOverrides(runtime as any);
      await storage!.removeItem('k');
      expect(runtime.removeStorageSync).toHaveBeenCalledWith('k');
    });

    it('getItem 使用 async API 当 sync 不可用', async () => {
      const runtime = createMockRuntime();
      delete (runtime as any).getStorageSync;
      runtime.getStorage.mockImplementation((opts: any) => {
        opts.success({ data: 'async-value' });
      });
      const { storage } = createMiniProgramAdapterOverrides(runtime as any);
      expect(await storage!.getItem('key')).toBe('async-value');
    });

    it('setItem 使用 async API 当 sync 不可用', async () => {
      const runtime = createMockRuntime();
      delete (runtime as any).setStorageSync;
      runtime.setStorage.mockImplementation((opts: any) => { opts.success(); });
      const { storage } = createMiniProgramAdapterOverrides(runtime as any);
      await storage!.setItem('k', 'v');
      expect(runtime.setStorage).toHaveBeenCalled();
    });

    it('removeItem 使用 async API 当 sync 不可用', async () => {
      const runtime = createMockRuntime();
      delete (runtime as any).removeStorageSync;
      runtime.removeStorage.mockImplementation((opts: any) => { opts.success(); });
      const { storage } = createMiniProgramAdapterOverrides(runtime as any);
      await storage!.removeItem('k');
      expect(runtime.removeStorage).toHaveBeenCalled();
    });
  });

  describe('runtime adapter', () => {
    it('getPlatform 返回平台标识', () => {
      const runtime = createMockRuntime();
      const { runtime: runtimeAdapter } = createMiniProgramAdapterOverrides(runtime as any);
      expect(runtimeAdapter!.getPlatform()).toBe('wechat-miniapp');
    });

    it('onNetworkChange 注册并触发回调', () => {
      const runtime = createMockRuntime();
      let networkCb: ((e: any) => void) | undefined;
      runtime.onNetworkStatusChange.mockImplementation((cb: any) => { networkCb = cb; });
      runtime.getNetworkType.mockImplementation((opts: any) => {
        opts.success({ networkType: 'wifi' });
      });
      const { runtime: runtimeAdapter } = createMiniProgramAdapterOverrides(runtime as any);
      const listener = vi.fn();
      const unsub = runtimeAdapter!.onNetworkChange(listener);
      // getNetworkType 触发初始状态
      expect(listener).toHaveBeenCalledWith(true);
      // 网络变化
      networkCb?.({ isConnected: false });
      expect(listener).toHaveBeenCalledWith(false);
      // 取消订阅
      unsub();
      expect(runtime.offNetworkStatusChange).toHaveBeenCalled();
    });

    it('onAppVisibilityChange 注册并触发回调', () => {
      const runtime = createMockRuntime();
      let showCb: (() => void) | undefined;
      let hideCb: (() => void) | undefined;
      runtime.onAppShow.mockImplementation((cb: any) => { showCb = cb; });
      runtime.onAppHide.mockImplementation((cb: any) => { hideCb = cb; });
      const { runtime: runtimeAdapter } = createMiniProgramAdapterOverrides(runtime as any);
      const listener = vi.fn();
      const unsub = runtimeAdapter!.onAppVisibilityChange(listener);
      // 初始调用 listener(true)
      expect(listener).toHaveBeenCalledWith(true);
      hideCb?.();
      expect(listener).toHaveBeenCalledWith(false);
      showCb?.();
      expect(listener).toHaveBeenCalledWith(true);
      unsub();
      expect(runtime.offAppShow).toHaveBeenCalled();
      expect(runtime.offAppHide).toHaveBeenCalled();
    });
  });
});
