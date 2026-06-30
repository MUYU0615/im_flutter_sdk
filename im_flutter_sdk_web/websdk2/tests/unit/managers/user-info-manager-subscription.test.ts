import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChatClient } from '@/chat-client';
import { UserInfoManager } from '@/managers/user-info-manager';
import { RestClient } from '@/rest/client';
import type { RestContext } from '@/types/chat-client';
import { ERROR_CODES } from '@/utils/error-codes';

const DEFAULT_REST_CONTEXT: RestContext = {
  restBaseUrl: 'https://api.example.com',
  appKey: 'org#app',
  userId: 'alice',
  token: 'token',
  clientResource: 'web',
};

const createMockClient = (options?: {
  readonly restContext?: RestContext;
  readonly cacheManager?: { setUserInfoSummaries: (items: unknown) => void } | null;
}): ChatClient => {
  const context = options?.restContext ?? DEFAULT_REST_CONTEXT;
  const cacheManager = options?.cacheManager ?? null;
  return {
    getRestContext: (): RestContext => context,
    getCacheManager: (): { setUserInfoSummaries: (items: unknown) => void } | null => cacheManager,
  } as unknown as ChatClient;
};

describe('UserInfoManager subscription APIs', () => {
  let manager: UserInfoManager;

  beforeEach((): void => {
    manager = new UserInfoManager();
    manager.bind(createMockClient());
  });

  afterEach((): void => {
    vi.restoreAllMocks();
  });

  it('subscribeUsersInfo 应校验 userIds、去重并发送 usernames body', async () => {
    const requestSpy = vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({
      status: 'ok',
      data: ['bob', 'carol'],
    });

    await manager.subscribeUsersInfo({
      userIds: [' bob ', 'carol', '', 'bob'],
    });

    expect(requestSpy).toHaveBeenCalledWith(
      '/org/app/user/alice/metadata/subscription',
      expect.objectContaining({
        method: 'POST',
        body: {
          usernames: ['bob', 'carol'],
        },
        operation: 'subscribeUsersInfo',
      })
    );
  });

  it('subscribeUsersInfo 超过 100 个唯一用户时应本地 fail-fast', async () => {
    const requestSpy = vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({});

    await expect(
      manager.subscribeUsersInfo({
        userIds: Array.from({ length: 101 }, (_, index) => `u-${index}`),
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.SERVICE_LIMIT_EXCEEDED,
    });

    expect(requestSpy).not.toHaveBeenCalled();
  });

  it('unsubscribeUsersInfo 应使用 usernames query，不发送 body', async () => {
    const requestSpy = vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({
      status: 'ok',
      data: ['bob'],
    });

    await manager.unsubscribeUsersInfo({
      userIds: [' bob ', 'bob'],
    });

    expect(requestSpy).toHaveBeenCalledWith(
      '/org/app/user/alice/metadata/subscription?usernames=bob',
      expect.objectContaining({
        method: 'DELETE',
        operation: 'unsubscribeUsersInfo',
      })
    );
    expect(requestSpy.mock.calls[0]?.[1]).not.toHaveProperty('body');
  });

  it('getSubscribedUsers 应先读取用户名数组，再 hydrate 为 UserInfo 列表', async () => {
    const cacheSpy = vi.fn();
    manager.bind(
      createMockClient({
        cacheManager: {
          setUserInfoSummaries: cacheSpy,
        },
      })
    );
    const requestSpy = vi.spyOn(RestClient.prototype, 'request').mockImplementation(
      async (endpoint, config) => {
        if (config?.operation === 'getSubscribedUsers') {
          expect(endpoint).toBe('/org/app/user/alice/metadata/subscription');
          return {
            status: 'ok',
            data: ['carol', 'bob', 'carol', ''],
          };
        }

        if (config?.operation === 'getUserInfoByUserId') {
          expect(endpoint).toBe('/org/app/metadata/user/get');
          expect(config.body).toEqual({
            targets: ['carol', 'bob'],
          });
          return {
            data: {
              carol: {
                nickname: 'Carol',
              },
              bob: {
                avatarurl: 'https://cdn.example.com/bob.png',
              },
            },
            lastModified: {
              carol: 1,
              bob: 2,
            },
          };
        }

        throw new Error(`unexpected operation: ${String(config?.operation)}`);
      }
    );

    const result = await manager.getSubscribedUsers();

    expect(result).toEqual([
      {
        userId: 'carol',
        nickname: 'Carol',
      },
      {
        userId: 'bob',
        avatarUrl: 'https://cdn.example.com/bob.png',
      },
    ]);
    expect(requestSpy).toHaveBeenCalledTimes(2);
    expect(cacheSpy).toHaveBeenCalledTimes(1);
  });
});
