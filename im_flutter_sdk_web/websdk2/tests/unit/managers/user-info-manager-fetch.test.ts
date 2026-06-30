import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChatClient } from '@/chat-client';
import { UserInfoManager } from '@/managers/user-info-manager';
import { RestClient } from '@/rest/client';
import type { RestContext } from '@/types/chat-client';
import { ERROR_CODES } from '@/utils/error-codes';
import { SDKError } from '@/utils/errors';

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

describe('UserInfoManager fetch APIs', () => {
  let manager: UserInfoManager;

  beforeEach((): void => {
    manager = new UserInfoManager();
    manager.bind(createMockClient());
  });

  afterEach((): void => {
    vi.restoreAllMocks();
  });

  it('getUserInfoByUserId 应校验 userIds、去重并保持顺序', async () => {
    const requestSpy = vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({
      timestamp: 1,
      data: {
        bob: { nickname: 'Bob' },
        carol: { nickname: 'Carol' },
      },
      lastModified: {
        bob: 11,
        carol: 12,
      },
      duration: 2,
    });

    const result = await manager.getUserInfoByUserId({
      userIds: [' bob ', 'carol', 'bob', '', 'carol'],
    });

    expect(result.map(item => item.userId)).toEqual(['bob', 'carol']);
    expect(requestSpy).toHaveBeenCalledWith(
      '/org/app/metadata/user/get',
      expect.objectContaining({
        method: 'POST',
        body: {
          targets: ['bob', 'carol'],
        },
        operation: 'getUserInfoByUserId',
      })
    );
  });

  it('getUserInfoByAttribute 应校验 attributes 并将 avatarUrl 映射为 avatarurl', async () => {
    const requestSpy = vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({
      timestamp: 1,
      data: {
        bob: {
          avatarurl: 'https://cdn.example.com/bob.png',
        },
      },
      lastModified: {
        bob: 11,
      },
      duration: 2,
    });

    const result = await manager.getUserInfoByAttribute({
      userIds: ['bob'],
      attributes: ['avatarUrl', 'nickname', 'avatarUrl'],
    });

    expect(result).toEqual([
      {
        userId: 'bob',
        avatarUrl: 'https://cdn.example.com/bob.png',
      },
    ]);
    expect(requestSpy).toHaveBeenCalledWith(
      '/org/app/metadata/user/get',
      expect.objectContaining({
        method: 'POST',
        body: {
          targets: ['bob'],
          properties: ['avatarurl', 'nickname'],
        },
        operation: 'getUserInfoByAttribute',
      })
    );

    await expect(
      manager.getUserInfoByAttribute({
        userIds: ['bob'],
        attributes: [],
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_REQUIRED,
    });

    await expect(
      manager.getUserInfoByAttribute({
        userIds: ['bob'],
        attributes: ['avatarurl' as never],
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_INVALID_FORMAT,
    });
  });

  it('应基于真实查询 envelope 归一化完整字段并写入缓存摘要', async () => {
    const cacheSpy = vi.fn();
    manager.bind(
      createMockClient({
        cacheManager: {
          setUserInfoSummaries: cacheSpy,
        },
      })
    );
    vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({
      timestamp: 1774495493846,
      data: {
        zd1: {
          avatarurl: 'http:/11.com/a/png',
          nickname: 'zd',
          mail: 'zd@example.com',
          phone: '13800000000',
          gender: false,
          sign: 'hello',
          birth: '1990-01-01',
          ext: '{"role":"admin"}',
        },
      },
      lastModified: {
        zd1: 1774495459340,
      },
      duration: 14,
    });

    const result = await manager.getUserInfoByAttribute({
      userIds: ['zd1', 'missing'],
      attributes: ['avatarUrl', 'nickname', 'mail', 'phone', 'gender', 'sign', 'birth', 'ext'],
    });

    expect(result).toEqual([
      {
        userId: 'zd1',
        avatarUrl: 'http:/11.com/a/png',
        nickname: 'zd',
        mail: 'zd@example.com',
        phone: '13800000000',
        gender: false,
        sign: 'hello',
        birth: '1990-01-01',
        ext: '{"role":"admin"}',
      },
    ]);
    expect(cacheSpy).toHaveBeenCalledWith([
      expect.objectContaining({
        userId: 'zd1',
        nickname: 'zd',
        avatarUrl: 'http:/11.com/a/png',
        sign: 'hello',
        ext: '{"role":"admin"}',
        userInfoUpdateTime: 1774495459,
        lastUpdate: 1774495459340,
      }),
    ]);
  });

  it('应兼容历史 response.entities/data.entities 变体', async () => {
    vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({
      entities: [{ username: 'root-bob', nickname: 'RootBob' }],
      data: {
        entities: [{ username: 'alice', avatarurl: 'https://cdn.example.com/alice.png' }],
        carol: {
          nickname: 'Carol',
          avatarUrl: 'https://cdn.example.com/carol.png',
        },
      },
    });

    const result = await manager.getUserInfoByUserId({
      userIds: ['root-bob', 'alice', 'carol'],
    });

    expect(result).toEqual([
      { userId: 'root-bob', nickname: 'RootBob' },
      { userId: 'alice', avatarUrl: 'https://cdn.example.com/alice.png' },
      { userId: 'carol', nickname: 'Carol', avatarUrl: 'https://cdn.example.com/carol.png' },
    ]);
  });

  it('fetch API 遇到普通 Error 时应包装为 SDKError，并在未 bind 时抛校验错误', async () => {
    vi.spyOn(RestClient.prototype, 'request').mockRejectedValue(new Error('boom'));

    await expect(
      manager.getUserInfoByUserId({
        userIds: ['bob'],
      })
    ).rejects.toBeInstanceOf(SDKError);

    const unboundManager = new UserInfoManager();
    await expect(
      unboundManager.getUserInfoByUserId({
        userIds: ['bob'],
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_REQUIRED,
    });
  });

  it('同 rest 地址/令牌应复用 RestClient，token 变化时应重建', async () => {
    const context: RestContext = {
      ...DEFAULT_REST_CONTEXT,
      token: 'token-1',
    };
    manager.bind(
      createMockClient({
        restContext: context,
      })
    );
    const setTokenSpy = vi.spyOn(RestClient.prototype, 'setAuthToken');
    vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({
      timestamp: 1,
      data: {},
      lastModified: {},
      duration: 1,
    });

    await manager.getUserInfoByUserId({ userIds: ['bob'] });
    await manager.getUserInfoByUserId({ userIds: ['alice'] });
    expect(setTokenSpy).toHaveBeenCalledTimes(1);

    (context as { token: string }).token = 'token-2';
    await manager.getUserInfoByUserId({ userIds: ['carol'] });
    expect(setTokenSpy).toHaveBeenCalledTimes(2);
  });
});
