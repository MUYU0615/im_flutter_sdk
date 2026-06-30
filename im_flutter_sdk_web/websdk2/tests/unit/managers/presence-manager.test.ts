import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChatClient } from '@/chat-client';
import { PresenceManager } from '@/managers/presence-manager';
import { RestClient } from '@/rest/client';
import type { RestContext } from '@/types/chat-client';
import { ERROR_CODES } from '@/utils/error-codes';
import { SDKError, ValidationError } from '@/utils/errors';

const DEFAULT_REST_CONTEXT: RestContext = {
  restBaseUrl: 'https://api.example.com',
  appKey: 'org#app',
  userId: 'alice',
  token: 'token',
  clientResource: 'web',
};

const createMockClient = (context: RestContext = DEFAULT_REST_CONTEXT): ChatClient => {
  return {
    getRestContext: (): RestContext => context,
  } as unknown as ChatClient;
};

const hasOwnKey = (value: unknown, key: string): boolean => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  return Object.prototype.hasOwnProperty.call(value, key);
};

describe('PresenceManager response shape', () => {
  let manager: PresenceManager;

  beforeEach((): void => {
    manager = new PresenceManager();
    manager.bind(createMockClient());
  });

  afterEach((): void => {
    vi.restoreAllMocks();
  });

  it('subscribePresence 应返回 PresenceInfo 列表，不包含 result/data 包裹层', async () => {
    vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({
      result: [
        {
          uid: 'userA',
          status: { web: 1 },
          ext: 'online',
          last_time: 1772600000000,
          expiry: 3600,
        },
      ],
    });

    const response = await manager.subscribePresence({
      userIds: ['userA'],
      expiry: 3600,
    });

    expect(response).toHaveLength(1);
    expect(response[0]?.publisher).toBe('userA');
    expect(response[0]?.statusList.web).toBe(1);
    expect(response[0]?.latestTime).toBe(1772600000000);
    expect(response[0]?.expiryTime).toBe(3600);
    expect(hasOwnKey(response, 'result')).toBe(false);
    expect(hasOwnKey(response, 'data')).toBe(false);
  });

  it('getPresenceStatus 应返回 PresenceInfo 列表，不包含 result/data 包裹层', async () => {
    vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({
      result: [
        {
          uid: 'userB',
          status: { mobile: 2 },
          ext: 'busy',
          last_time: 1772600001000,
          expiry: 600,
        },
      ],
    });

    const response = await manager.getPresenceStatus({
      userIds: ['userB'],
    });

    expect(response[0]?.publisher).toBe('userB');
    expect(response[0]?.statusList.mobile).toBe(2);
    expect(response[0]?.ext).toBe('busy');
    expect(hasOwnKey(response, 'result')).toBe(false);
    expect(hasOwnKey(response, 'data')).toBe(false);
  });

  it('getSubscribedPresenceList 应返回 string[]，不包含 result/data 包裹层', async () => {
    vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({
      result: {
        sublist: [{ uid: 'userC', expiry: 1200 }],
        totalnum: 1,
      },
    });

    const response = await manager.getSubscribedPresenceList({
      pageNum: 1,
      pageSize: 20,
    });

    expect(response).toEqual(['userC']);
    expect(hasOwnKey(response, 'result')).toBe(false);
    expect(hasOwnKey(response, 'data')).toBe(false);
  });
});

describe('PresenceManager behaviors', () => {
  let manager: PresenceManager;

  beforeEach((): void => {
    manager = new PresenceManager();
    manager.bind(createMockClient());
  });

  afterEach((): void => {
    vi.restoreAllMocks();
  });

  it('addEventHandler 与 removeEventHandler 应委托到 eventContext', () => {
    const addEventHandler = vi.fn();
    const removeEventHandler = vi.fn();
    manager.bind(createMockClient(), {
      addEventHandler,
      removeEventHandler,
    });

    manager.addEventHandler('presence-ui', {
      onPresenceStatusChange: vi.fn(),
    });
    manager.removeEventHandler('presence-ui');

    expect(addEventHandler).toHaveBeenCalledOnce();
    expect(removeEventHandler).toHaveBeenCalledWith('presence-ui');
  });

  it('未绑定 eventContext 时 addEventHandler 应抛出 ValidationError', () => {
    expect(() => {
      manager.addEventHandler('presence-ui', {
        onPresenceStatusChange: vi.fn(),
      });
    }).toThrowError(ValidationError);
  });

  it('publishPresence 成功时应 resolve 且不返回数据', async () => {
    vi.spyOn(RestClient.prototype, 'request').mockResolvedValue(undefined);

    const result = await manager.publishPresence({
      customStatus: 'online',
    });

    expect(result).toBeUndefined();
  });

  it('publishPresence 参数非法时应抛出 ValidationError', async () => {
    await expect(
      manager.publishPresence({
        customStatus: 1 as unknown as string,
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_INVALID_FORMAT,
    });
  });

  it('publishPresence 请求失败时应抛出 SDKError', async () => {
    vi.spyOn(RestClient.prototype, 'request').mockRejectedValue(new Error('network'));

    await expect(
      manager.publishPresence({
        customStatus: 'busy',
      })
    ).rejects.toBeInstanceOf(SDKError);
  });

  it('unsubscribePresence 成功时应调用 DELETE', async () => {
    const requestSpy = vi.spyOn(RestClient.prototype, 'request').mockResolvedValue(undefined);

    await manager.unsubscribePresence({
      userIds: ['userA'],
    });

    expect(requestSpy).toHaveBeenCalledWith(
      expect.stringContaining('/presence'),
      expect.objectContaining({
        method: 'DELETE',
      })
    );
  });

  it('subscribePresence/getPresenceStatus 应归一化 status 并过滤非法项', async () => {
    vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({
      result: [
        {
          uid: 'userA',
          status: {
            web: 1.8,
            mobile: '2',
            invalid: 'not-number',
          },
          ext: 1,
          last_time: '100',
          expiry: '200',
        },
        {
          uid: '',
          status: { web: 1 },
        },
      ],
    });

    const subscribe = await manager.subscribePresence({
      userIds: ['userA'],
      expiry: 10,
    });
    expect(subscribe).toHaveLength(1);
    expect(subscribe[0]).toMatchObject({
      publisher: 'userA',
      statusList: { web: 1, mobile: 2 },
      ext: '',
      latestTime: 0,
      expiryTime: 0,
    });

    const status = await manager.getPresenceStatus({
      userIds: ['userA'],
    });
    expect(status).toHaveLength(1);
    expect(status[0]?.statusList).toMatchObject({ web: 1, mobile: 2 });
  });

  it('getSubscribedPresenceList 应过滤非法 uid', async () => {
    vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({
      result: {
        sublist: [{ uid: 'userA' }, { uid: ' ' }, { uid: 1 }],
      },
    });

    const list = await manager.getSubscribedPresenceList({
      pageNum: 0,
      pageSize: 20,
    });
    expect(list).toEqual(['userA']);
  });

  it('参数非法时应抛 ValidationError（userIds/expiry/page）', async () => {
    await expect(
      manager.subscribePresence({
        userIds: [] as string[],
        expiry: 1,
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_INVALID_FORMAT,
    });
    await expect(
      manager.subscribePresence({
        userIds: ['userA'],
        expiry: Number.NaN,
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_INVALID_FORMAT,
    });
    await expect(
      manager.subscribePresence({
        userIds: ['userA'],
        expiry: -1,
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_INVALID_FORMAT,
    });
    await expect(
      manager.getPresenceStatus({
        userIds: ['  '] as unknown as string[],
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_INVALID_FORMAT,
    });
    await expect(
      manager.getSubscribedPresenceList({
        pageNum: Number.NaN,
        pageSize: 20,
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_INVALID_FORMAT,
    });
    await expect(
      manager.getSubscribedPresenceList({
        pageNum: 0,
        pageSize: -1,
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_INVALID_FORMAT,
    });
  });

  it('不同接口失败分支应抛出 SDKError', async () => {
    vi.spyOn(RestClient.prototype, 'request').mockRejectedValue(new Error('network'));

    await expect(
      manager.subscribePresence({
        userIds: ['userA'],
        expiry: 10,
      })
    ).rejects.toBeInstanceOf(SDKError);
    await expect(
      manager.unsubscribePresence({
        userIds: ['userA'],
      })
    ).rejects.toBeInstanceOf(SDKError);
    await expect(
      manager.getSubscribedPresenceList({
        pageNum: 0,
        pageSize: 20,
      })
    ).rejects.toBeInstanceOf(SDKError);
    await expect(
      manager.getPresenceStatus({
        userIds: ['userA'],
      })
    ).rejects.toBeInstanceOf(SDKError);
  });

  it('当 request 抛出 SDKError 时应原样透传', async () => {
    const sdkError = new SDKError('sdk failed', ERROR_CODES.UNKNOWN);
    vi.spyOn(RestClient.prototype, 'request').mockRejectedValue(sdkError);

    await expect(
      manager.getPresenceStatus({
        userIds: ['userA'],
      })
    ).rejects.toBe(sdkError);
  });

  it('appKey 非法或未绑定 client 时应抛 ValidationError', async () => {
    const invalidAppKeyContext: RestContext = {
      ...DEFAULT_REST_CONTEXT,
      appKey: 'invalid-app-key',
    };
    manager.bind(createMockClient(invalidAppKeyContext));

    await expect(
      manager.publishPresence({
        customStatus: 'online',
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_INVALID_FORMAT,
    });

    const unbound = new PresenceManager();
    await expect(
      unbound.publishPresence({
        customStatus: 'online',
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_REQUIRED,
    });
  });

  it('rest token 变化后应重建 RestClient', async () => {
    const context: RestContext = {
      ...DEFAULT_REST_CONTEXT,
      token: 'token-1',
    };
    manager.bind(createMockClient(context));
    const setTokenSpy = vi.spyOn(RestClient.prototype, 'setAuthToken');
    vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({
      result: [],
    });

    await manager.getPresenceStatus({ userIds: ['userA'] });
    await manager.getPresenceStatus({ userIds: ['userB'] });
    expect(setTokenSpy).toHaveBeenCalledTimes(1);

    (context as { token: string }).token = 'token-2';
    await manager.getPresenceStatus({ userIds: ['userC'] });
    expect(setTokenSpy).toHaveBeenCalledTimes(2);
  });
});
