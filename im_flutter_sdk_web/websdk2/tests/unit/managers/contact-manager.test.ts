import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChatClient } from '@/chat-client';
import { ContactManager } from '@/managers/contact-manager';
import { RestClient } from '@/rest/client';
import type { RestContext } from '@/types/chat-client';
import type { ContactSnapshot } from '@/types/contact';
import { ERROR_CODES } from '@/utils/error-codes';
import { RestBusinessError, ValidationError } from '@/utils/errors';

const DEFAULT_REST_CONTEXT: RestContext = {
  restBaseUrl: 'https://api.example.com',
  appKey: 'org#app',
  userId: 'alice',
  token: 'token',
  clientResource: 'web',
};

const createMockClient = (options?: {
  readonly restContext?: RestContext;
  readonly cacheManager?: {
    getUserInfoSummaries?: (
      userIds: ReadonlyArray<string>,
      updateAccess: boolean
    ) => ReadonlyArray<{
      userId: string;
      nickname?: string;
      avatarUrl?: string;
      sign?: string;
      ext?: string;
    }>;
    setUserInfoSummaries?: (
      items: ReadonlyArray<{
        userId: string;
        nickname?: string;
        avatarUrl?: string;
        sign?: string;
        ext?: string;
        lastUpdate?: number;
      }>
    ) => void;
    removeContact: (userId: string) => { changed: boolean };
    updateContactRemark: (userId: string, remark: string) => { changed: boolean };
  } | null;
  readonly snapshot?: ContactSnapshot | null;
  readonly refreshContactSnapshot?: () => Promise<void>;
}): ChatClient => {
  const restContext = options?.restContext ?? DEFAULT_REST_CONTEXT;
  const cacheManager = options?.cacheManager ?? null;
  const snapshot = options?.snapshot ?? null;
  const refreshContactSnapshot =
    options?.refreshContactSnapshot ?? (() : Promise<void> => Promise.resolve(undefined));

  return {
    getRestContext: (): RestContext => restContext,
    getCacheManager: (): typeof cacheManager => cacheManager,
    getContactSnapshot: (): typeof snapshot => snapshot,
    refreshContactSnapshot,
    isUserInfoSyncEnabled: (): boolean => true,
  } as unknown as ChatClient;
};

describe('ContactManager', () => {
  let manager: ContactManager;

  beforeEach((): void => {
    manager = new ContactManager();
    manager.bind(createMockClient());
  });

  afterEach((): void => {
    vi.restoreAllMocks();
  });

  it('getContacts 应保持同步读取语义', () => {
    manager.bind(
      createMockClient({
        snapshot: {
          items: [
            {
              userId: 'bob',
              userInfo: {
                userId: 'bob',
                nickname: 'Bob',
                avatarUrl: 'https://cdn.example.com/bob.png',
                sign: 'hi',
              },
              remark: 'old',
              addTs: 100,
            },
          ],
          source: 'cache',
          version: 'v1',
          complete: true,
        },
      })
    );

    expect(manager.getContacts()).toEqual([
      {
        userId: 'bob',
        userInfo: {
          userId: 'bob',
          nickname: 'Bob',
          avatarUrl: 'https://cdn.example.com/bob.png',
          sign: 'hi',
        },
        remark: 'old',
        addTs: 100,
      },
    ]);
  });


  it('addEventHandler/removeEventHandler 应委托给 eventContext', () => {
    const addEventHandler = vi.fn();
    const removeEventHandler = vi.fn();

    manager.bind(createMockClient(), {
      addEventHandler,
      removeEventHandler,
    });

    manager.addEventHandler('contact-ui', {});
    manager.removeEventHandler('contact-ui');

    expect(addEventHandler).toHaveBeenCalledOnce();
    expect(removeEventHandler).toHaveBeenCalledWith('contact-ui');
  });

  it('addEventHandler 应支持原工程 roster 联系人事件', () => {
    const addEventHandler = vi.fn();
    const handlers = {
      onContactInvited: vi.fn(),
      onContactDeleted: vi.fn(),
      onContactAdded: vi.fn(),
      onContactRefuse: vi.fn(),
      onContactAgreed: vi.fn(),
    };

    manager.bind(createMockClient(), {
      addEventHandler,
      removeEventHandler: vi.fn(),
    });

    manager.addEventHandler('contact-roster', handlers);

    expect(addEventHandler).toHaveBeenCalledWith('contact-roster', handlers);
  });

  it('addContact 成功时应透传可选 message', async () => {
    const requestSpy = vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({});

    const result = await manager.addContact({
      userId: 'bob',
      message: 'hello',
    });

    expect(result).toBeUndefined();
    expect(requestSpy.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      body: {
        usernames: ['bob'],
        reason: 'hello',
      },
    });
  });

  it('addContact 参数非法时应 fail-fast', async () => {
    const requestSpy = vi.spyOn(RestClient.prototype, 'request');

    await expect(
      manager.addContact({
        userId: '   ',
      })
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      manager.addContact({
        userId: '   ',
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_REQUIRED,
    });

    expect(requestSpy).not.toHaveBeenCalled();
  });

  it('addContact 的 message 非字符串时应返回 INVALID_FORMAT', async () => {
    await expect(
      manager.addContact({
        userId: 'bob',
        message: 1 as unknown as string,
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_INVALID_FORMAT,
    });
  });

  it('deleteContact 成功后应立即修补缓存', async () => {
    const removeContact = vi.fn().mockReturnValue({ changed: true });
    manager.bind(
      createMockClient({
        cacheManager: {
          removeContact,
          updateContactRemark: vi.fn(),
        },
      })
    );
    vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({});

    const result = await manager.deleteContact({
      userId: 'bob',
    });

    expect(result).toBeUndefined();
    expect(removeContact).toHaveBeenCalledWith('bob');
  });

  it('acceptContactInvite 成功后应触发受控刷新', async () => {
    const refreshContactSnapshot = vi.fn().mockResolvedValue(undefined);
    manager.bind(
      createMockClient({
        refreshContactSnapshot,
        cacheManager: {
          removeContact: vi.fn(),
          updateContactRemark: vi.fn(),
        },
      })
    );
    vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({});

    await manager.acceptContactInvite({
      userId: 'bob',
    });

    expect(refreshContactSnapshot).toHaveBeenCalledTimes(1);
  });

  it('setContactRemark 应允许空字符串并回写缓存', async () => {
    const updateContactRemark = vi.fn().mockReturnValue({ changed: true });
    manager.bind(
      createMockClient({
        cacheManager: {
          removeContact: vi.fn(),
          updateContactRemark,
        },
      })
    );
    const requestSpy = vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({});

    await manager.setContactRemark({
      userId: 'bob',
      remark: '',
    });

    expect(updateContactRemark).toHaveBeenCalledWith('bob', '');
    expect(requestSpy.mock.calls[0]?.[1]).toMatchObject({
      method: 'PUT',
      body: {
        remark: '',
      },
    });
  });

  it('setContactRemark 的 remark 非字符串时应返回 INVALID_FORMAT', async () => {
    await expect(
      manager.setContactRemark({
        userId: 'bob',
        remark: 1 as unknown as string,
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_INVALID_FORMAT,
    });
  });

  it('setContactRemark 服务端业务错误时不应误写缓存', async () => {
    const updateContactRemark = vi.fn().mockReturnValue({ changed: true });
    manager.bind(
      createMockClient({
        cacheManager: {
          removeContact: vi.fn(),
          updateContactRemark,
        },
      })
    );
    vi.spyOn(RestClient.prototype, 'request').mockRejectedValue(
      new RestBusinessError('Failed to set contact remark: they are not your friend', {
        code: ERROR_CODES.CONTACT_SET_REMARK_NOT_FRIEND,
        details: {
          api: 'setContactRemark',
          serverCode: 'illegal_argument',
          serverMessage: 'updateRemark | they are not friends, please add as a friend first.',
        },
      })
    );

    await expect(
      manager.setContactRemark({
        userId: 'bob',
        remark: 'new-remark',
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.CONTACT_SET_REMARK_NOT_FRIEND,
    });
    expect(updateContactRemark).not.toHaveBeenCalled();
  });

  it('addUsersToBlocklist 应先去重并返回标准化结果', async () => {
    const requestSpy = vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({
      data: ['zd2'],
    });

    const result = await manager.addUsersToBlocklist({
      userIds: ['zd2', 'zd2'],
    });

    expect(result).toEqual({
      succeeded: [{ userId: 'zd2' }],
      failed: [],
    });
    expect(requestSpy.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      body: {
        usernames: ['zd2'],
      },
    });
  });

  it('getBlocklist 应归一化为对象数组并复用会话快照', async () => {
    manager.bind(
      createMockClient({
        cacheManager: {
          getUserInfoSummaries: () => [
            {
              userId: 'zd2',
              nickname: 'ZD2',
            },
          ],
          setUserInfoSummaries: vi.fn(),
          removeContact: vi.fn().mockReturnValue({ changed: false }),
          updateContactRemark: vi.fn().mockReturnValue({ changed: false }),
        },
      })
    );
    const requestSpy = vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({
      data: ['zd2'],
    });

    const first = await manager.getBlocklist();
    const second = await manager.getBlocklist();

    expect(first).toEqual([{ userId: 'zd2', nickname: 'ZD2' }]);
    expect(second).toEqual([{ userId: 'zd2', nickname: 'ZD2' }]);
    expect(requestSpy).toHaveBeenCalledTimes(1);
  });

  it('removeUserFromBlocklist 在已有快照时应本地修补，不再重复请求 getBlocklist', async () => {
    manager.bind(
      createMockClient({
        cacheManager: {
          getUserInfoSummaries: (userIds) =>
            userIds.map(userId => ({
              userId,
              nickname: `nick-${userId}`,
            })),
          setUserInfoSummaries: vi.fn(),
          removeContact: vi.fn().mockReturnValue({ changed: false }),
          updateContactRemark: vi.fn().mockReturnValue({ changed: false }),
        },
      })
    );
    const requestSpy = vi.spyOn(RestClient.prototype, 'request');
    requestSpy.mockResolvedValueOnce({
      data: ['zd2', 'zd3'],
    });
    requestSpy.mockResolvedValueOnce({});

    expect(await manager.getBlocklist()).toEqual([
      { userId: 'zd2', nickname: 'nick-zd2' },
      { userId: 'zd3', nickname: 'nick-zd3' },
    ]);

    await manager.removeUserFromBlocklist({
      userIds: ['zd2'],
    });

    expect(await manager.getBlocklist()).toEqual([
      { userId: 'zd3', nickname: 'nick-zd3' },
    ]);
    expect(requestSpy).toHaveBeenCalledTimes(2);
  });

  it('blocklist 会话变更后应重置本地快照', async () => {
    manager.bind(
      createMockClient({
        cacheManager: {
          getUserInfoSummaries: (userIds) =>
            userIds.map(userId => ({
              userId,
              nickname: `nick-${userId}`,
            })),
          setUserInfoSummaries: vi.fn(),
          removeContact: vi.fn().mockReturnValue({ changed: false }),
          updateContactRemark: vi.fn().mockReturnValue({ changed: false }),
        },
      })
    );
    const requestSpy = vi.spyOn(RestClient.prototype, 'request');
    requestSpy.mockResolvedValueOnce({
      data: ['zd2'],
    });
    requestSpy.mockResolvedValueOnce({
      data: ['zd9'],
    });

    expect(await manager.getBlocklist()).toEqual([
      { userId: 'zd2', nickname: 'nick-zd2' },
    ]);

    manager.bind(
      createMockClient({
        restContext: {
          ...DEFAULT_REST_CONTEXT,
          token: 'token-2',
        },
        cacheManager: {
          getUserInfoSummaries: (userIds) =>
            userIds.map(userId => ({
              userId,
              nickname: `nick-${userId}`,
            })),
          setUserInfoSummaries: vi.fn(),
          removeContact: vi.fn().mockReturnValue({ changed: false }),
          updateContactRemark: vi.fn().mockReturnValue({ changed: false }),
        },
      })
    );

    expect(await manager.getBlocklist()).toEqual([
      { userId: 'zd9', nickname: 'nick-zd9' },
    ]);
    expect(requestSpy).toHaveBeenCalledTimes(2);
  });

  it('getBlocklist 缺失资料时应批量调用 getUserInfoByUserId 补齐 userInfo', async () => {
    manager.bind(
      createMockClient({
        cacheManager: {
          getUserInfoSummaries: () => [],
          setUserInfoSummaries: vi.fn(),
          removeContact: vi.fn().mockReturnValue({ changed: false }),
          updateContactRemark: vi.fn().mockReturnValue({ changed: false }),
        },
      })
    );

    const requestSpy = vi.spyOn(RestClient.prototype, 'request');
    requestSpy
      .mockResolvedValueOnce({
        data: ['zd2'],
      })
      .mockResolvedValueOnce({
        timestamp: 1,
        data: {
          zd2: {
            nickname: 'ZD2',
            avatarurl: 'https://cdn.example.com/zd2.png',
          },
        },
        lastModified: {
          zd2: 11,
        },
        duration: 2,
      });

    await expect(manager.getBlocklist()).resolves.toEqual([
      {
        userId: 'zd2',
        nickname: 'ZD2',
        avatarUrl: 'https://cdn.example.com/zd2.png',
        sign: undefined,
        ext: undefined,
      },
    ]);

    expect(requestSpy.mock.calls[1]?.[0]).toBe('/org/app/metadata/user/get');
    expect(requestSpy.mock.calls[1]?.[1]).toMatchObject({
      method: 'POST',
      body: {
        targets: ['zd2'],
      },
      operation: 'getUserInfoByUserId',
    });
  });

  it('未绑定 client 时应抛 VALIDATION_REQUIRED', async () => {
    const unboundManager = new ContactManager();

    await expect(unboundManager.getBlocklist()).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_REQUIRED,
    });
  });

  it('普通 Error 应包装为 UNKNOWN SDKError', async () => {
    manager.bind({
      getRestContext: (): RestContext => {
        throw new Error('boom');
      },
    } as unknown as ChatClient);

    await expect(
      manager.addContact({
        userId: 'bob',
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.UNKNOWN,
      message: 'ContactManager addContact failed: boom',
    });
  });
});
