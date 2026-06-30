import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  requestCreateChatThread,
  requestGetChatThreadInfo,
  requestGetChatThreadLastMessageList,
  requestGetChatThreadList,
  requestGetChatThreadMemberList,
  requestGetJoinedChatThreadList,
  requestJoinChatThread,
  requestRemoveChatThreadMember,
  requestUpdateChatThreadName,
} from '@/rest/chat-thread-management';
import apiErrors from '@/rest/api-errors.json';
import type { RestContext } from '@/types/chat-client';
import { ERROR_CODES } from '@/utils/error-codes';
import { ValidationError } from '@/utils/errors';

interface ApiErrorEntry {
  readonly errors: Readonly<Record<string, unknown>>;
  readonly localErrors?: Readonly<Record<string, unknown>>;
}

interface ApiErrorsShape {
  readonly apis: Readonly<Record<string, ApiErrorEntry>>;
}

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
  };
};

const expectValidationCode = async (task: () => Promise<unknown>, code: number): Promise<void> => {
  try {
    await task();
    expect.unreachable('expected validation error');
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).code).toBe(code);
  }
};

describe('chat-thread-management', () => {
  afterEach((): void => {
    vi.restoreAllMocks();
  });

  it('requestCreateChatThread 应走 thread 创建 endpoint 并返回 thread_id', async () => {
    const client = createRestClient();
    client.post.mockResolvedValue({
      data: {
        thread_id: 'thread-1',
      },
    });

    const result = await requestCreateChatThread(client as never, DEFAULT_CONTEXT, {
      parentId: 'group-1',
      name: 'topic-1',
      messageId: 'msg-1',
    });

    expect(client.post).toHaveBeenCalledWith(
      '/org/app/thread?resource=web',
      {
        name: 'topic-1',
        msg_id: 'msg-1',
        group_id: 'group-1',
        owner: 'alice',
      },
      {
        operation: 'createChatThread',
      }
    );
    expect(result).toEqual({
      chatThreadId: 'thread-1',
    });
  });

  it('requestGetChatThreadList 应归一化列表与 cursor', async () => {
    const client = createRestClient();
    client.get.mockResolvedValue({
      data: {
        entities: [
          {
            id: 'thread-1',
            groupId: 'group-1',
            name: 'topic-1',
            owner: 'alice',
            affiliations_count: 2,
            message_count: 5,
            created: 120,
            last_message: {
              id: 'msg-1',
              timestamp: 119,
              payload: '{"bodies":[{"type":"txt","msg":"hello"}]}',
            },
          },
        ],
        cursor: 'cursor-1',
      },
    });

    const result = await requestGetChatThreadList(client as never, DEFAULT_CONTEXT, {
      parentId: 'group-1',
      pageSize: 10,
      cursor: 'cursor-0',
    });

    expect(client.get).toHaveBeenCalledWith(
      '/org/app/threads/chatgroups/group-1?limit=10&cursor=cursor-0',
      {
        operation: 'getChatThreadList',
      }
    );
    expect(result).toEqual({
      items: [
        {
          chatThreadId: 'thread-1',
          parentId: 'group-1',
          name: 'topic-1',
          ownerId: 'alice',
          memberCount: 2,
          messageCount: 5,
          createdAt: 120,
          lastMessage: {
            msgId: 'msg-1',
            type: 'txt',
            body: {
              type: 'txt',
              msg: 'hello',
            },
            timestamp: 119,
          },
        },
      ],
      cursor: 'cursor-1',
    });
  });

  it('requestGetJoinedChatThreadList 应兼容 parent 过滤与全量 joined 路径', async () => {
    const client = createRestClient();
    client.get.mockResolvedValue({
      data: {
        entities: [],
        cursor: '',
      },
    });

    await requestGetJoinedChatThreadList(client as never, DEFAULT_CONTEXT, {
      parentId: 'group-1',
      pageSize: 5,
      cursor: 'cursor-1',
    });
    expect(client.get).toHaveBeenLastCalledWith(
      '/org/app/threads/chatgroups/group-1/user/alice?limit=5&cursor=cursor-1',
      {
        operation: 'getJoinedChatThreadList',
      }
    );

    await requestGetJoinedChatThreadList(client as never, DEFAULT_CONTEXT, {});
    expect(client.get).toHaveBeenLastCalledWith('/org/app/threads/user/alice?limit=20&cursor=', {
      operation: 'getJoinedChatThreadList',
    });
  });

  it('requestGetChatThreadInfo 应归一化 detail 数据', async () => {
    const client = createRestClient();
    client.get.mockResolvedValue({
      data: {
        id: 'thread-2',
        group_id: 'group-2',
        name: 'topic-2',
        owner: 'bob',
        affiliationsCount: 4,
        messageCount: 7,
        createTimestamp: 130,
      },
    });

    await expect(
      requestGetChatThreadInfo(client as never, DEFAULT_CONTEXT, 'thread-2')
    ).resolves.toEqual({
      chatThreadId: 'thread-2',
      parentId: 'group-2',
      name: 'topic-2',
      ownerId: 'bob',
      memberCount: 4,
      messageCount: 7,
      createdAt: 130,
      lastMessage: null,
    });
  });

  it('requestGetChatThreadMemberList 应归一化 string/object 混合成员列表', async () => {
    const client = createRestClient();
    client.get.mockResolvedValue({
      data: {
        entities: ['alice', { user: 'bob', joinedAt: 200 }],
        cursor: 'cursor-2',
      },
    });

    const result = await requestGetChatThreadMemberList(client as never, DEFAULT_CONTEXT, {
      chatThreadId: 'thread-3',
      pageSize: 15,
    });

    expect(client.get).toHaveBeenCalledWith('/org/app/thread/thread-3/users?limit=15&cursor=', {
      operation: 'getChatThreadMemberList',
    });
    expect(result).toEqual({
      items: [
        {
          memberId: 'alice',
        },
        {
          memberId: 'bob',
          joinedAt: 200,
        },
      ],
      cursor: 'cursor-2',
    });
  });

  it('requestGetChatThreadLastMessageList 应归一化批量 last_message 结果', async () => {
    const client = createRestClient();
    client.post.mockResolvedValue({
      data: {
        entities: [
          {
            thread_id: 'thread-4',
            last_message: {
              id: 'msg-4',
              timestamp: 300,
              payload: {
                bodies: [
                  {
                    type: 'img',
                    url: 'https://cdn.example.com/1.png',
                  },
                ],
              },
            },
          },
        ],
      },
    });

    const result = await requestGetChatThreadLastMessageList(client as never, DEFAULT_CONTEXT, {
      chatThreadIds: ['thread-4'],
    });

    expect(client.post).toHaveBeenCalledWith(
      '/org/app/thread/message',
      {
        threadIds: ['thread-4'],
      },
      {
        operation: 'getChatThreadLastMessageList',
      }
    );
    expect(result).toEqual({
      items: [
        {
          chatThreadId: 'thread-4',
          lastMessage: {
            msgId: 'msg-4',
            type: 'img',
            body: {
              type: 'img',
              url: 'https://cdn.example.com/1.png',
            },
            timestamp: 300,
          },
        },
      ],
    });
  });

  it('requestJoinChatThread/requestUpdateChatThreadName/requestRemoveChatThreadMember 应命中对应路径', async () => {
    const client = createRestClient();

    await requestJoinChatThread(client as never, DEFAULT_CONTEXT, 'thread-5');
    expect(client.post).toHaveBeenCalledWith(
      '/org/app/thread/thread-5/user/alice/join?resource=web',
      undefined,
      {
        operation: 'joinChatThread',
      }
    );

    await requestUpdateChatThreadName(client as never, DEFAULT_CONTEXT, {
      chatThreadId: 'thread-5',
      name: 'topic-5',
    });
    expect(client.put).toHaveBeenCalledWith(
      '/org/app/thread/thread-5?resource=web',
      {
        name: 'topic-5',
      },
      {
        operation: 'updateChatThreadName',
      }
    );

    await requestRemoveChatThreadMember(client as never, DEFAULT_CONTEXT, {
      chatThreadId: 'thread-5',
      memberId: 'bob',
    });
    expect(client.delete).toHaveBeenCalledWith(
      '/org/app/thread/thread-5/users/bob?resource=web',
      {
        operation: 'removeChatThreadMember',
      }
    );
  });

  it('非法参数应抛统一 ValidationError', async () => {
    const client = createRestClient();

    await expectValidationCode(
      () =>
        requestGetChatThreadList(client as never, DEFAULT_CONTEXT, {
          parentId: '   ',
        }),
      ERROR_CODES.VALIDATION_REQUIRED
    );

    await expectValidationCode(
      () =>
        requestGetChatThreadList(client as never, DEFAULT_CONTEXT, {
          parentId: 'group-1',
          pageSize: 0,
        }),
      ERROR_CODES.VALIDATION_INVALID_FORMAT
    );

    await expectValidationCode(
      () =>
        requestGetChatThreadLastMessageList(client as never, DEFAULT_CONTEXT, {
          chatThreadIds: [],
        }),
      ERROR_CODES.VALIDATION_REQUIRED
    );

    await expectValidationCode(
      () =>
        requestGetChatThreadLastMessageList(client as never, DEFAULT_CONTEXT, {
          chatThreadIds: Array.from({ length: 21 }, (_, index) => `thread-${index}`),
        }),
      ERROR_CODES.VALIDATION_INVALID_FORMAT
    );
  });

  it('所有 ChatThread operation 必须维护 errors 和 localErrors', () => {
    const operations = [
      'createChatThread',
      'getChatThreadList',
      'getJoinedChatThreadList',
      'getChatThreadInfo',
      'joinChatThread',
      'leaveChatThread',
      'destroyChatThread',
      'updateChatThreadName',
      'getChatThreadMemberList',
      'removeChatThreadMember',
      'getChatThreadLastMessageList',
    ] as const;

    for (const operation of operations) {
      const entry = (apiErrors as ApiErrorsShape).apis[operation];

      expect(entry, operation).toBeDefined();
      if (!entry) {
        throw new Error(`${operation} is missing in api-errors.json`);
      }
      expect(Object.keys(entry.errors), operation).not.toHaveLength(0);
      expect(entry.localErrors?.[operation], operation).toBeDefined();
    }
  });
});
