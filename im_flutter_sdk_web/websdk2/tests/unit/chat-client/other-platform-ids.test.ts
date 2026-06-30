import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatClient } from '@/chat-client';

const resetSingleton = (): void => {
  (ChatClient as unknown as { instance: ChatClient | null }).instance = null;
};

const createJsonResponse = (data: unknown): Response => {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: {
      get: (): string => 'application/json',
    },
    json: async (): Promise<unknown> => data,
    text: async (): Promise<string> => JSON.stringify(data),
  } as unknown as Response;
};

describe('ChatClient.getSelfIdsOnOtherPlatform', (): void => {
  beforeEach((): void => {
    resetSingleton();
  });

  afterEach((): void => {
    vi.restoreAllMocks();
  });

  it('应返回其他设备的 userId/resource 列表，并过滤当前设备', async (): Promise<void> => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url !== 'https://rest.example.com/org/app/users/user-1/resources') {
        throw new Error(`Unexpected fetch url: ${url}`);
      }
      return createJsonResponse({
        data: [{ res: 'web-1' }, { res: 'mobile-1' }, { res: 'desktop-2' }],
      });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = ChatClient.init({ appKey: 'org#app' });
    Object.assign(client as object, {
      restBaseUrl: 'https://rest.example.com',
      authToken: 'token-1',
      currentUserId: 'user-1',
      clientResource: 'web-1',
    });

    await expect(client.getSelfIdsOnOtherPlatform()).resolves.toEqual([
      'user-1/mobile-1',
      'user-1/desktop-2',
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('无其他设备时应返回空数组', async (): Promise<void> => {
    globalThis.fetch = vi.fn(
      async (): Promise<Response> =>
        createJsonResponse({
          data: [{ res: 'web-1' }],
        })
    ) as unknown as typeof fetch;

    const client = ChatClient.init({ appKey: 'org#app' });
    Object.assign(client as object, {
      restBaseUrl: 'https://rest.example.com',
      authToken: 'token-1',
      currentUserId: 'user-1',
      clientResource: 'web-1',
    });

    await expect(client.getSelfIdsOnOtherPlatform()).resolves.toEqual([]);
  });
});
