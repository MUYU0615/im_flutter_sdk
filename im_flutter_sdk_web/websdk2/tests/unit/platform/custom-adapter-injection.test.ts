import { describe, expect, it, vi } from 'vitest';

import {
  RUNTIME_PLATFORMS,
  createPlatformAdapter,
  type PlatformAdapterOverrides,
  type RequestConfig,
  type RequestResponse,
  type RuntimeAdapter,
} from '../../../src/platform';

const createCustomRuntimeAdapter = (): RuntimeAdapter => {
  return {
    getPlatform(): 'unknown' {
      return RUNTIME_PLATFORMS.UNKNOWN;
    },
    onNetworkChange(_listener: (online: boolean) => void): () => void {
      return (): void => undefined;
    },
    onAppVisibilityChange(_listener: (foreground: boolean) => void): () => void {
      return (): void => undefined;
    },
  };
};

describe('platform/custom-adapter-injection', () => {
  it('支持函数式 overrides 注入并保留默认能力', () => {
    const resolverSpy = vi.fn((defaults: Readonly<PlatformAdapterOverrides>) => {
      expect(defaults.request).toBeDefined();
      expect(defaults.upload).toBeDefined();
      expect(defaults.socket).toBeDefined();
      expect(defaults.proto).toBeDefined();
      expect(defaults.runtime).toBeDefined();
      expect(defaults.storage).toBeDefined();
      return {
        runtime: createCustomRuntimeAdapter(),
      };
    });

    const profile = createPlatformAdapter({
      prefer: RUNTIME_PLATFORMS.WEB,
      overrides: resolverSpy,
    });

    expect(resolverSpy).toHaveBeenCalledTimes(1);
    expect(profile.runtime.getPlatform()).toBe(RUNTIME_PLATFORMS.UNKNOWN);
    expect(profile.capability.request).toBe(true);
    expect(profile.capability.upload).toBe(true);
    expect(profile.capability.socket).toBe(true);
    expect(profile.capability.proto).toBe(true);

    expect(profile.request).toBeDefined();
  });

  it('支持对象式 overrides 注入自定义 request 适配器', async () => {
    const customRequest = {
      request<TData>(_config: RequestConfig): Promise<RequestResponse<TData>> {
        return Promise.resolve({
          status: 201,
          headers: {
            'x-sdk': 'custom',
          },
          data: {
            ok: true,
          } as TData,
        });
      },
    };

    const profile = createPlatformAdapter({
      prefer: RUNTIME_PLATFORMS.WEB,
      overrides: {
        request: customRequest,
      },
    });

    const result = await profile.request.request<{ ok: boolean }>({
      url: 'https://sdk.local/custom',
      method: 'POST',
    });

    expect(profile.request).toBe(customRequest);
    expect(result.status).toBe(201);
    expect(result.data.ok).toBe(true);
  });
});
