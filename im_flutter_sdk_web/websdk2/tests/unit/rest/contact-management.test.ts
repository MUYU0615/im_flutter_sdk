import { describe, expect, it, vi } from 'vitest';

import {
  assertNormalizedUserIds,
  dedupeUserIds,
  normalizeBlocklistAddResult,
  normalizeBlocklistEntries,
  normalizeContactListPage,
  requestAcceptContactInvite,
  requestAddContact,
  requestAddUsersToBlocklist,
  requestDeclineContactInvite,
  requestDeleteContact,
  requestGetBlocklist,
  requestGetContactList,
  requestRemoveUsersFromBlocklist,
  requestSetContactRemark,
} from '@/rest/contact-management';
import type { RestContext } from '@/types/chat-client';
import { ERROR_CODES } from '@/utils/error-codes';
import { ValidationError } from '@/utils/errors';

const DEFAULT_CONTEXT: RestContext = {
  restBaseUrl: 'https://api.example.com',
  appKey: 'org#app',
  userId: 'alice',
  token: 'token-1',
  clientResource: 'web',
};

const createRestClient = () => {
  return {
    post: vi.fn(
      (_endpoint: string, _body?: unknown, _config?: unknown): Promise<unknown> =>
        Promise.resolve(undefined)
    ),
    get: vi.fn(
      (_endpoint: string, _config?: unknown): Promise<unknown> => Promise.resolve(undefined)
    ),
    put: vi.fn(
      (_endpoint: string, _body?: unknown, _config?: unknown): Promise<unknown> =>
        Promise.resolve(undefined)
    ),
    delete: vi.fn(
      (_endpoint: string, _config?: unknown): Promise<unknown> => Promise.resolve(undefined)
    ),
    request: vi.fn(
      (_endpoint: string, _config?: unknown): Promise<unknown> => Promise.resolve(undefined)
    ),
  };
};

const expectValidationCode = (
  task: () => ReadonlyArray<string>,
  code: number
): void => {
  try {
    task();
    expect.unreachable('expected validation error');
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).code).toBe(code);
  }
};

describe('contact-management helpers', () => {
  it('dedupeUserIds 应保持顺序并跳过空值', () => {
    expect(dedupeUserIds(['u1', '', 'u2', 'u1', 'u3', 'u2'])).toEqual(['u1', 'u2', 'u3']);
  });

  it('assertNormalizedUserIds 应执行 trim + 去重', () => {
    expect(
      assertNormalizedUserIds(
        {
          userIds: ['  u1  ', 'u2', 'u1'],
        },
        'params.userIds'
      )
    ).toEqual(['u1', 'u2']);
  });

  it('assertNormalizedUserIds 非法时应抛统一校验错误', () => {
    expectValidationCode(
      () =>
      assertNormalizedUserIds(
        {
          userIds: ['   '],
        },
        'params.userIds'
      ),
      ERROR_CODES.VALIDATION_REQUIRED
    );

    expectValidationCode(
      () =>
      assertNormalizedUserIds(
        {
          userIds: [1 as unknown as string],
        },
        'params.userIds'
      ),
      ERROR_CODES.VALIDATION_INVALID_FORMAT
    );
  });

  it('normalizeBlocklistEntries 应支持 envelope.data 和原始数组', () => {
    expect(normalizeBlocklistEntries({ data: ['u1', 'u2'] })).toEqual([
      { userId: 'u1' },
      { userId: 'u2' },
    ]);
    expect(normalizeBlocklistEntries(['u3'])).toEqual([{ userId: 'u3' }]);
    expect(normalizeBlocklistEntries({ data: [1, 'u4', ''] })).toEqual([
      { userId: 'u4' },
    ]);
  });

  it('normalizeBlocklistAddResult 空结果时应返回空 succeeded/failed', () => {
    expect(normalizeBlocklistAddResult(null)).toEqual({
      succeeded: [],
      failed: [],
    });
  });

  it('normalizeContactListPage 应映射 cursor/remark 并复用已有 userInfo', () => {
    const existingContacts = new Map([
      [
        'u1',
        {
          userId: 'u1',
          userInfo: {
            userId: 'u1',
            nickname: 'Nick',
          },
          remark: 'old',
          addTs: 12,
        },
      ],
    ]);

    expect(
      normalizeContactListPage(
        {
          data: {
            cursor: 'next-1',
            contacts: [
              {
                username: 'u1',
                remark: 'new-remark',
              },
              {
                username: 'u2',
                remark: 'remark-2',
              },
            ],
          },
        },
        existingContacts
      )
    ).toEqual({
      cursor: 'next-1',
      contacts: [
        {
          userId: 'u1',
          userInfo: {
            userId: 'u1',
            nickname: 'Nick',
          },
          remark: 'new-remark',
          addTs: 12,
        },
        {
          userId: 'u2',
          userInfo: {
            userId: 'u2',
          },
          remark: 'remark-2',
          addTs: 0,
        },
      ],
    });
  });

  it('normalizeContactListPage 应兼容顶层 cursor 和 entities', () => {
    expect(
      normalizeContactListPage(
        {
          cursor: 'next-top',
          entities: [
            {
              username: 'u-top',
              remark: 'top-remark',
            },
          ],
        },
        new Map()
      )
    ).toEqual({
      cursor: 'next-top',
      contacts: [
        {
          userId: 'u-top',
          userInfo: {
            userId: 'u-top',
          },
          remark: 'top-remark',
          addTs: 0,
        },
      ],
    });
  });
});

describe('contact-management requests', () => {
  it('requestAddContact 应构造正确 endpoint 和 body', async () => {
    const client = createRestClient();

    await requestAddContact(client as never, DEFAULT_CONTEXT, {
      userId: 'bob',
      message: 'hello',
    });

    expect(client.post).toHaveBeenCalledWith(
      '/org/app/users/alice/contacts/apply?resource=web',
      {
        usernames: ['bob'],
        reason: 'hello',
      },
      {
        operation: 'addContact',
      }
    );
  });

  it('delete/accept/decline/remark 应构造正确联系人 endpoint', async () => {
    const client = createRestClient();

    await requestDeleteContact(client as never, DEFAULT_CONTEXT, {
      userId: 'bob',
    });
    await requestAcceptContactInvite(client as never, DEFAULT_CONTEXT, {
      userId: 'bob',
    });
    await requestDeclineContactInvite(client as never, DEFAULT_CONTEXT, {
      userId: 'bob',
    });
    await requestSetContactRemark(client as never, DEFAULT_CONTEXT, {
      userId: 'bob',
      remark: '',
    });

    expect(client.delete).toHaveBeenCalledWith(
      '/org/app/users/alice/contacts/users/bob?resource=web',
      {
        operation: 'deleteContact',
      }
    );
    expect(client.post).toHaveBeenNthCalledWith(
      1,
      '/org/app/users/alice/contacts/accept/users/bob?resource=web',
      undefined,
      {
        operation: 'acceptContactInvite',
      }
    );
    expect(client.post).toHaveBeenNthCalledWith(
      2,
      '/org/app/users/alice/contacts/decline/users/bob?resource=web',
      undefined,
      {
        operation: 'declineContactInvite',
      }
    );
    expect(client.put).toHaveBeenCalledWith(
      '/org/app/users/alice/contacts/users/bob?resource=web',
      {
        remark: '',
      },
      {
        operation: 'setContactRemark',
      }
    );
  });

  it('黑名单接口应完成 endpoint 构造和结果归一化', async () => {
    const client = createRestClient();
    client.get.mockResolvedValue({
      data: ['u1'],
    });
    client.post.mockResolvedValue({
      data: ['u2'],
    });

    const blocklist = await requestGetBlocklist(client as never, DEFAULT_CONTEXT);
    const addResult = await requestAddUsersToBlocklist(client as never, DEFAULT_CONTEXT, ['u2']);
    await requestRemoveUsersFromBlocklist(client as never, DEFAULT_CONTEXT, ['u2']);

    expect(blocklist).toEqual([{ userId: 'u1' }]);
    expect(addResult).toEqual({
      succeeded: [{ userId: 'u2' }],
      failed: [],
    });
    expect(client.get).toHaveBeenCalledWith('/org/app/users/alice/blocks/users', {
      operation: 'getBlocklist',
    });
    expect(client.post).toHaveBeenCalledWith(
      '/org/app/sdk/user/alice/blocks?resource=web',
      {
        usernames: ['u2'],
      },
      {
        operation: 'addUsersToBlocklist',
      }
    );
    expect(client.request).toHaveBeenCalledWith(
      '/org/app/sdk/user/alice/blocks?resource=web',
      {
        method: 'DELETE',
        body: {
          usernames: ['u2'],
        },
        operation: 'removeUserFromBlocklist',
      }
    );
  });

  it('requestGetContactList 应构造分页 endpoint 并归一化响应', async () => {
    const client = createRestClient();
    client.get.mockResolvedValue({
      data: {
        cursor: 'next-cursor',
        contacts: [
          {
            username: 'u1',
            remark: 'hello',
          },
        ],
      },
    });

    const result = await requestGetContactList(
      client as never,
      DEFAULT_CONTEXT,
      {
        pageSize: 50,
        cursor: '',
      },
      new Map()
    );

    expect(result).toEqual({
      cursor: 'next-cursor',
      contacts: [
        {
          userId: 'u1',
          userInfo: {
            userId: 'u1',
          },
          remark: 'hello',
          addTs: 0,
        },
      ],
    });
    expect(client.get).toHaveBeenCalledWith(
      '/org/app/users/alice/contacts?needReturnRemark=true&limit=50&cursor=',
      {
        operation: 'getContactList',
      }
    );
  });
});
