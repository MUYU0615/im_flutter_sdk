import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChatClient } from '@/chat-client';
import { ChatThread } from '@/managers/chat-thread';
import { ChatThreadManager } from '@/managers/chat-thread-manager';
import { RestClient } from '@/rest/client';
import type { RestContext } from '@/types/chat-client';
import { SDKError, ValidationError } from '@/utils/errors';

const DEFAULT_REST_CONTEXT: RestContext = {
  restBaseUrl: 'https://api.example.com',
  appKey: 'org#app',
  userId: 'alice',
  token: 'token',
  clientResource: 'web',
};

const createMockClient = (restContext: RestContext = DEFAULT_REST_CONTEXT): ChatClient => {
  return {
    getRestContext: (): RestContext => restContext,
  } as unknown as ChatClient;
};

describe('ChatThreadManager', () => {
  let manager: ChatThreadManager;

  beforeEach((): void => {
    manager = new ChatThreadManager();
    manager.bind(createMockClient());
  });

  afterEach((): void => {
    vi.restoreAllMocks();
  });

  it('addEventHandler/removeEventHandler 应委托给 eventContext', () => {
    const addEventHandler = vi.fn();
    const removeEventHandler = vi.fn();
    const handler = vi.fn();

    manager.bind(createMockClient(), {
      addEventHandler,
      removeEventHandler,
    });

    manager.addEventHandler('thread-ui', {
      onChatThreadCreated: handler,
    });
    manager.removeEventHandler('thread-ui');

    expect(addEventHandler).toHaveBeenCalledWith('thread-ui', {
      onChatThreadCreated: handler,
    });
    expect(removeEventHandler).toHaveBeenCalledWith('thread-ui');
  });

  it('getChatThread 应返回可复用的 ChatThread 实例', () => {
    const first = manager.getChatThread('t1');
    const second = manager.getChatThread('t1');

    expect(first).toBeInstanceOf(ChatThread);
    expect(first).toBe(second);
    expect(first.chatThreadId).toBe('t1');
  });

  it('getChatThreadInfo 应走统一 request/normalize 链路', async () => {
    vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({
      data: {
        id: 't1',
        groupId: 'g1',
        name: 'thread-1',
        owner: 'alice',
        affiliations_count: 2,
      },
    });

    await expect(manager.getChatThreadInfo({ chatThreadId: 't1' })).resolves.toMatchObject({
      chatThreadId: 't1',
      parentId: 'g1',
      name: 'thread-1',
      ownerId: 'alice',
      memberCount: 2,
    });
  });

  it('未 bind 时调用公开 API 应抛出 ValidationError', async () => {
    const unboundManager = new ChatThreadManager();

    await expect(
      unboundManager.getJoinedChatThreadList()
    ).rejects.toThrow(ValidationError);
  });

  it('空 chatThreadId 应抛出 ValidationError，重新 bind 后应清空旧 registry', () => {
    const first = manager.getChatThread('t1');

    expect(() => manager.getChatThread('   ')).toThrow(ValidationError);

    manager.bind(createMockClient());

    const second = manager.getChatThread('t1');
    expect(second).toBeInstanceOf(ChatThread);
    expect(second).not.toBe(first);
  });

  it('addEventHandler 在 event context 缺失时应抛出 ValidationError', () => {
    expect(() =>
      manager.addEventHandler('thread-ui', {
        onChatThreadCreated: vi.fn(),
      })
    ).toThrow(ValidationError);
  });

  it('create/join/leave/destroy/update/member/lastMessage 应复用 REST 请求链路', async () => {
    const postSpy = vi.spyOn(RestClient.prototype, 'post').mockImplementation(
      async (endpoint: string, body?: unknown): Promise<unknown> => {
        if (endpoint.endsWith('/thread?resource=web')) {
          expect(body).toEqual({
            name: 'thread-1',
            msg_id: 'm1',
            group_id: 'g1',
            owner: 'alice',
          });
          return {
            data: {
              thread_id: 't1',
            },
          };
        }
        if (endpoint.endsWith('/thread/message')) {
          return {
            entities: [
              {
                thread_id: 't1',
                last_message: {
                  id: 'm-last',
                  timestamp: 1,
                  payload: JSON.stringify({
                    type: 'text',
                    bodies: [{ type: 'txt', msg: 'hello' }],
                  }),
                },
              },
            ],
          };
        }
        return {};
      }
    );
    const deleteSpy = vi.spyOn(RestClient.prototype, 'delete').mockResolvedValue({});
    const putSpy = vi.spyOn(RestClient.prototype, 'put').mockResolvedValue({});
    const getSpy = vi.spyOn(RestClient.prototype, 'get').mockImplementation(
      async (endpoint: string): Promise<unknown> => {
        if (endpoint.includes('/users?')) {
          return {
            entities: ['bob', { user: 'carol', joinedAt: 2 }],
            cursor: 'next-cursor',
          };
        }
        return {};
      }
    );

    await expect(
      manager.createChatThread({
        parentId: 'g1',
        name: 'thread-1',
        messageId: 'm1',
      })
    ).resolves.toEqual({
      chatThreadId: 't1',
    });
    await expect(manager.joinChatThread({ chatThreadId: 't1' })).resolves.toBeUndefined();
    await expect(manager.leaveChatThread({ chatThreadId: 't1' })).resolves.toBeUndefined();
    await expect(manager.destroyChatThread({ chatThreadId: 't1' })).resolves.toBeUndefined();
    await expect(
      manager.updateChatThreadName({
        chatThreadId: 't1',
        name: 'new-name',
      })
    ).resolves.toBeUndefined();
    await expect(
      manager.getChatThreadMemberList({
        chatThreadId: 't1',
        pageSize: 20,
        cursor: 'c1',
      })
    ).resolves.toEqual({
      items: [
        { memberId: 'bob' },
        { memberId: 'carol', joinedAt: 2 },
      ],
      cursor: 'next-cursor',
    });
    await expect(
      manager.removeChatThreadMember({
        chatThreadId: 't1',
        memberId: 'bob',
      })
    ).resolves.toBeUndefined();
    await expect(
      manager.getChatThreadLastMessageList({
        chatThreadIds: ['t1'],
      })
    ).resolves.toEqual({
      items: [
        {
          chatThreadId: 't1',
          lastMessage: {
            msgId: 'm-last',
            type: 'txt',
            body: {
              type: 'txt',
              msg: 'hello',
            },
            timestamp: 1,
          },
        },
      ],
    });

    expect(postSpy).toHaveBeenCalled();
    expect(deleteSpy).toHaveBeenCalled();
    expect(putSpy).toHaveBeenCalled();
    expect(getSpy).toHaveBeenCalled();
  });

  it('普通错误应包装为 UNKNOWN SDKError', async () => {
    vi.spyOn(RestClient.prototype, 'get').mockRejectedValue(new Error('network'));

    await expect(
      manager.getJoinedChatThreadList({
        pageSize: 10,
      })
    ).rejects.toMatchObject({
      code: 1,
      message: 'ChatThreadManager getJoinedChatThreadList failed: network',
    } satisfies Partial<SDKError>);
  });
});
