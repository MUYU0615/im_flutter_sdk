import { afterEach, describe, expect, it, vi } from 'vitest';

import { CacheCrypto } from '@/cache/cache-crypto';

interface CryptoMockOptions {
  readonly decryptThrows?: boolean;
}

const setCryptoMock = (options?: CryptoMockOptions): void => {
  const subtle = {
    digest: vi.fn(async (): Promise<ArrayBuffer> => {
      return new Uint8Array([1, 2, 3, 4]).buffer;
    }),
    importKey: vi.fn(async (): Promise<CryptoKey> => {
      return {} as CryptoKey;
    }),
    encrypt: vi.fn(async (_algo: unknown, _key: unknown, data: ArrayBuffer | ArrayBufferView) => {
      if (data instanceof ArrayBuffer) {
        return data;
      }
      return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    }),
    decrypt: vi.fn(async (_algo: unknown, _key: unknown, data: ArrayBuffer | ArrayBufferView) => {
      if (options?.decryptThrows) {
        throw new Error('decrypt failed');
      }
      if (data instanceof ArrayBuffer) {
        return data;
      }
      return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    }),
  };
  const cryptoMock = {
    subtle,
    getRandomValues: (array: Uint8Array): Uint8Array => {
      for (let i = 0; i < array.length; i += 1) {
        array[i] = i + 1;
      }
      return array;
    },
  } as unknown as Crypto;

  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    writable: true,
    value: cryptoMock,
  });
};

describe('CacheCrypto', () => {
  const originalCrypto = globalThis.crypto;
  const originalWx = (globalThis as { wx?: unknown }).wx;

  afterEach((): void => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      writable: true,
      value: originalCrypto,
    });
    Object.defineProperty(globalThis as { wx?: unknown }, 'wx', {
      configurable: true,
      writable: true,
      value: originalWx,
    });
    vi.restoreAllMocks();
  });

  it('小程序环境下应禁用加密并透传明文', async () => {
    setCryptoMock();
    Object.defineProperty(globalThis as { wx?: unknown }, 'wx', {
      configurable: true,
      writable: true,
      value: {},
    });

    const crypto = new CacheCrypto('org#app', 'alice');
    expect(crypto.isEnabled()).toBe(false);
    await expect(crypto.encrypt('hello')).resolves.toBe('hello');
    await expect(crypto.decrypt('hello')).resolves.toBe('hello');
  });

  it('缺少 WebCrypto 时应禁用加密', async () => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      writable: true,
      value: undefined,
    });
    Object.defineProperty(globalThis as { wx?: unknown }, 'wx', {
      configurable: true,
      writable: true,
      value: undefined,
    });

    const crypto = new CacheCrypto('org#app', 'alice');
    expect(crypto.isEnabled()).toBe(false);
    await expect(crypto.encrypt('hello')).resolves.toBe('hello');
  });

  it('启用加密时应支持 encrypt/decrypt', async () => {
    setCryptoMock();
    Object.defineProperty(globalThis as { wx?: unknown }, 'wx', {
      configurable: true,
      writable: true,
      value: undefined,
    });
    const crypto = new CacheCrypto('org#app', 'alice');

    expect(crypto.isEnabled()).toBe(true);
    const encrypted = await crypto.encrypt('hello');
    expect(encrypted).not.toBe('hello');
    await expect(crypto.decrypt(encrypted)).resolves.toBe('hello');
  });

  it('decrypt 解析失败或非加密载荷时应返回原值', async () => {
    setCryptoMock();
    const crypto = new CacheCrypto('org#app', 'alice');

    await expect(crypto.decrypt('not-json')).resolves.toBe('not-json');
    await expect(crypto.decrypt(JSON.stringify({ foo: 'bar' }))).resolves.toBe(
      JSON.stringify({ foo: 'bar' })
    );
  });

  it('decrypt 解密失败时应返回 null', async () => {
    setCryptoMock({ decryptThrows: true });
    const crypto = new CacheCrypto('org#app', 'alice');
    const encrypted = await crypto.encrypt('hello');

    await expect(crypto.decrypt(encrypted)).resolves.toBeNull();
  });
});
