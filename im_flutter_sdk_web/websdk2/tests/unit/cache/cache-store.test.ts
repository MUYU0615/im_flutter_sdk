import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CacheCryptoAdapter } from '@/cache/cache-crypto';
import { CacheStore } from '@/cache/cache-store';
import { logger } from '@/utils/logger';

const storage = window.localStorage;

const createCryptoAdapter = (): CacheCryptoAdapter => {
  return {
    isEnabled: (): boolean => true,
    encrypt: vi.fn(async (plaintext: string): Promise<string> => `enc:${plaintext}`),
    decrypt: vi.fn(async (payload: string): Promise<string | null> => {
      if (!payload.startsWith('enc:')) {
        return null;
      }
      return payload.slice(4);
    }),
  };
};

describe('CacheStore', () => {
  afterEach((): void => {
    storage.clear();
    vi.restoreAllMocks();
  });

  it('writeAsync/readAsync/remove 应完成缓存读写删除', async () => {
    const store = new CacheStore();

    await store.writeAsync('cache:key', { value: 1 });
    const loaded = await store.readAsync('cache:key', { value: 0 });
    expect(loaded).toEqual({ value: 1 });

    store.remove('cache:key');
    const fallback = await store.readAsync('cache:key', { value: 9 });
    expect(fallback).toEqual({ value: 9 });
  });

  it('启用加密适配器时应走 encrypt/decrypt', async () => {
    const cryptoAdapter = createCryptoAdapter();
    const store = new CacheStore(cryptoAdapter);

    await store.writeAsync('cache:secure', { text: 'hello' });
    const loaded = await store.readAsync('cache:secure', { text: 'fallback' });

    expect(cryptoAdapter.encrypt).toHaveBeenCalledOnce();
    expect(cryptoAdapter.decrypt).toHaveBeenCalledOnce();
    expect(loaded).toEqual({ text: 'hello' });
  });

  it('decrypt 返回 null 时 readAsync 应返回 fallback', async () => {
    const cryptoAdapter: CacheCryptoAdapter = {
      isEnabled: (): boolean => true,
      encrypt: vi.fn(async (plaintext: string): Promise<string> => plaintext),
      decrypt: vi.fn(async (): Promise<string | null> => null),
    };
    const store = new CacheStore(cryptoAdapter);
    storage.setItem('cache:secure', 'ciphertext');

    const loaded = await store.readAsync('cache:secure', { ok: false });

    expect(loaded).toEqual({ ok: false });
  });

  it('localStorage 配额超限时 writeAsync 应抛错', async () => {
    const store = new CacheStore();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((): never => {
      throw new DOMException('quota exceeded', 'QuotaExceededError');
    });

    await expect(store.writeAsync('cache:quota', { value: 1 })).rejects.toBeInstanceOf(
      DOMException
    );
  });

  it('checkAvailable 在探测写入失败时应返回 false', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((): never => {
      throw new Error('blocked');
    });

    expect(CacheStore.checkAvailable()).toBe(false);
  });

  it('checkAvailable 在 localStorage 不存在时应返回 false', () => {
    const original = globalThis.localStorage;

    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: undefined,
    });

    expect(CacheStore.checkAvailable()).toBe(false);

    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: original,
    });
  });

  it('不可用时 readAsync/writeAsync/remove 应直接降级', async () => {
    vi.spyOn(CacheStore, 'checkAvailable').mockReturnValue(false);
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const removeSpy = vi.spyOn(Storage.prototype, 'removeItem');
    const store = new CacheStore();

    await expect(store.readAsync('cache:disabled', { ok: true })).resolves.toEqual({ ok: true });
    await expect(store.writeAsync('cache:disabled', { ok: false })).resolves.toBeUndefined();
    store.remove('cache:disabled');

    expect(setItemSpy).not.toHaveBeenCalled();
    expect(removeSpy).not.toHaveBeenCalled();
  });

  it('readAsync 在 getItem 抛错时应记录日志并返回 fallback', async () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation((): void => {});
    const store = new CacheStore();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((): never => {
      throw new Error('read failed');
    });

    await expect(store.readAsync('cache:error', { ok: false })).resolves.toEqual({ ok: false });
    expect(warnSpy).toHaveBeenCalledWith('CacheStore read failed', expect.any(Error));
  });

  it('writeAsync 在序列化失败时应静默跳过', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    const store = new CacheStore();
    setItemSpy.mockClear();
    const circular: { self?: unknown } = {};
    circular.self = circular;

    await expect(store.writeAsync('cache:circular', circular)).resolves.toBeUndefined();
    expect(setItemSpy).not.toHaveBeenCalled();
  });

  it('writeAsync 在非 quota 异常时应记录日志但不抛错', async () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation((): void => {});
    const store = new CacheStore();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((): never => {
      throw new Error('disk unavailable');
    });

    await expect(store.writeAsync('cache:warn', { value: 1 })).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith('CacheStore write failed', expect.any(Error));
  });

  it('remove 在删除失败时应记录日志', () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation((): void => {});
    const store = new CacheStore();
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((): never => {
      throw new Error('remove failed');
    });

    store.remove('cache:remove-error');

    expect(warnSpy).toHaveBeenCalledWith('CacheStore remove failed', expect.any(Error));
  });
});
