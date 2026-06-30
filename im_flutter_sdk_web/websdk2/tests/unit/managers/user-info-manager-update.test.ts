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
  readonly onOwnInfoUpdated?: (userInfo: unknown) => void;
}): ChatClient => {
  const context = options?.restContext ?? DEFAULT_REST_CONTEXT;
  const cacheManager = options?.cacheManager ?? null;
  return {
    getRestContext: (): RestContext => context,
    getCacheManager: (): { setUserInfoSummaries: (items: unknown) => void } | null => cacheManager,
    dispatchOwnInfoUpdated: options?.onOwnInfoUpdated,
  } as unknown as ChatClient;
};

describe('UserInfoManager update APIs', () => {
  let manager: UserInfoManager;

  beforeEach((): void => {
    manager = new UserInfoManager();
    manager.bind(createMockClient());
  });

  afterEach((): void => {
    vi.restoreAllMocks();
  });

  it('updateOwnInfo 应要求至少一个字段，且保留空字符串、false、0', async () => {
    const requestSpy = vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({
      timestamp: 1774496262484,
      data: {
        nickname: '',
        avatarurl: '',
        gender: false,
        ext: '0',
      },
      lastModified: 1774496262500,
      duration: 52,
    });

    const result = await manager.updateOwnInfo({
      nickname: '',
      avatarUrl: '',
      gender: false,
      ext: '0',
    });

    const requestConfig = requestSpy.mock.calls[0]?.[1];
    expect(requestConfig).toMatchObject({
      method: 'PUT',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      operation: 'updateOwnInfo',
    });
    const body = String(requestConfig?.body ?? '');
    expect(body).toContain('nickname=');
    expect(body).toContain('avatarurl=');
    expect(body).toContain('gender=false');
    expect(body).toContain('ext=0');
    expect(result).toEqual({
      userId: 'alice',
      nickname: '',
      avatarUrl: '',
      gender: false,
      ext: '0',
    });

    await expect(manager.updateOwnInfo({})).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_REQUIRED,
    });
  });

  it('updateOwnInfoByAttribute 应校验属性和值，并与 updateOwnInfo 返回一致', async () => {
    const requestSpy = vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({
      timestamp: 1774496262484,
      data: {
        avatarurl: 'http:/11.com/a/png',
        nickname: '1111',
      },
      lastModified: 1774496262500,
      duration: 52,
    });

    const result = await manager.updateOwnInfoByAttribute('avatarUrl', 'http:/11.com/a/png');

    expect(result).toEqual({
      userId: 'alice',
      avatarUrl: 'http:/11.com/a/png',
      nickname: '1111',
    });
    expect(requestSpy).toHaveBeenCalledWith(
      '/org/app/metadata/user/alice',
      expect.objectContaining({
        method: 'PUT',
        body: 'avatarurl=http%3A%2F11.com%2Fa%2Fpng',
        operation: 'updateOwnInfoByAttribute',
      })
    );

    await expect(
      manager.updateOwnInfoByAttribute('avatarurl' as never, 'x')
    ).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_INVALID_FORMAT,
    });
    await expect(
      manager.updateOwnInfoByAttribute('nickname', undefined as never)
    ).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_INVALID_FORMAT,
    });
  });

  it('应基于真实更新 envelope 归一化并写入缓存摘要', async () => {
    const cacheSpy = vi.fn();
    const selfUpdateSpy = vi.fn();
    manager.bind(
      createMockClient({
        cacheManager: {
          setUserInfoSummaries: cacheSpy,
        },
        onOwnInfoUpdated: selfUpdateSpy,
      })
    );
    vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({
      timestamp: 1774496262484,
      data: {
        avatarurl: 'http:/11.com/a/png',
        nickname: '1111',
        mail: 'zd@example.com',
        gender: 0,
        sign: 'hello',
      },
      lastModified: 1774496262500,
      duration: 52,
    });

    const result = await manager.updateOwnInfo({
      nickname: '1111',
      avatarUrl: 'http:/11.com/a/png',
      mail: 'zd@example.com',
      gender: 0,
      sign: 'hello',
    });

    expect(result).toEqual({
      userId: 'alice',
      avatarUrl: 'http:/11.com/a/png',
      nickname: '1111',
      mail: 'zd@example.com',
      gender: 0,
      sign: 'hello',
    });
    expect(cacheSpy).toHaveBeenCalledWith([
      expect.objectContaining({
        userId: 'alice',
        nickname: '1111',
        avatarUrl: 'http:/11.com/a/png',
        sign: 'hello',
        userInfoUpdateTime: 1774496262,
        lastUpdate: 1774496262500,
      }),
    ]);
    expect(selfUpdateSpy).toHaveBeenCalledWith({
      userId: 'alice',
      avatarUrl: 'http:/11.com/a/png',
      nickname: '1111',
      mail: 'zd@example.com',
      gender: 0,
      sign: 'hello',
    });
  });

  it('更新接口在服务端未返回 data 时应回退到本次 patch', async () => {
    vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({});

    const result = await manager.updateOwnInfo({
      nickname: 'Alice A',
      avatarUrl: 'https://cdn.example.com/a.png',
    });

    expect(result).toEqual({
      userId: 'alice',
      nickname: 'Alice A',
      avatarUrl: 'https://cdn.example.com/a.png',
    });
  });
});
