// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ChatClient } from '@/chat-client';
import { ChatThreadManager } from '@/managers/chat-thread-manager';
import {
  startMockRestServer,
  type MockRestRequest,
  type MockRestServerController,
} from '../../test-utils/layered/mock-rest-server';

type ClientWithChatThreadManager = ChatClient & {
  readonly chatThreadManager: ChatThreadManager;
};

type ChatClientInternal = {
  restBaseUrl: string | null;
  authToken: string | null;
  currentUserId: string | null;
  clientResource: string | null;
};

const resetSingleton = (): void => {
  (ChatClient as unknown as { instance: ChatClient | null }).instance = null;
};

const primeRestContext = (client: ChatClient, baseUrl: string): void => {
  const internal = client as unknown as ChatClientInternal;
  internal.restBaseUrl = baseUrl;
  internal.authToken = 'mock-token';
  internal.currentUserId = 'alice';
  internal.clientResource = 'web';
};

const expectJsonObjectBody = (request: MockRestRequest): Record<string, unknown> => {
  if (
    !request.jsonBody ||
    typeof request.jsonBody !== 'object' ||
    Array.isArray(request.jsonBody)
  ) {
    throw new Error('Expected JSON object body');
  }
  return request.jsonBody as Record<string, unknown>;
};

describe('chat-thread REST integration', () => {
  let server: MockRestServerController;
  let client: ClientWithChatThreadManager;

  beforeEach(async () => {
    resetSingleton();
    server = await startMockRestServer();
    client = ChatClient.init({ appKey: 'org#app' }).use(
      ChatThreadManager
    ) as ClientWithChatThreadManager;
    primeRestContext(client, server.baseUrl);
  });

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
    resetSingleton();
  });

  it('manager REST 主路径应携带登录上下文并归一化结果', async () => {
    server.on('POST', '/org/app/thread', request => {
      expect(request.headers.authorization).toBe('Bearer mock-token');
      expect(request.query.get('resource')).toBe('web');
      expectJsonObjectBody(request);
      expect(request.jsonBody).toEqual({
        name: 'topic-1',
        msg_id: 'msg-parent-1',
        group_id: 'group-1',
        owner: 'alice',
      });
      return {
        status: 200,
        body: {
          data: {
            thread_id: 'thread-1',
          },
        },
      };
    });
    server.on('GET', '/org/app/threads/chatgroups/group-1', request => {
      expect(request.query.get('limit')).toBe('10');
      expect(request.query.get('cursor')).toBe('cursor-0');
      return {
        status: 200,
        body: {
          data: {
            entities: [
              {
                id: 'thread-1',
                group_id: 'group-1',
                name: 'topic-1',
                owner: 'alice',
                affiliations_count: 2,
              },
            ],
            cursor: 'cursor-1',
          },
        },
      };
    });
    server.on('GET', '/org/app/thread/thread-1', () => ({
      status: 200,
      body: {
        data: {
          thread_id: 'thread-1',
          group_id: 'group-1',
          name: 'topic-1',
          owner: 'alice',
          message_count: 3,
        },
      },
    }));
    server.on('POST', '/org/app/thread/thread-1/user/alice/join', request => {
      expect(request.query.get('resource')).toBe('web');
      return { status: 200, body: {} };
    });
    server.on('GET', '/org/app/threads/chatgroups/group-1/user/alice', request => {
      expect(request.query.get('limit')).toBe('20');
      expect(request.query.get('cursor')).toBe('');
      return {
        status: 200,
        body: {
          entities: [
            {
              id: 'thread-1',
              groupId: 'group-1',
              name: 'topic-1',
            },
          ],
        },
      };
    });
    server.on('PUT', '/org/app/thread/thread-1', request => {
      expect(request.query.get('resource')).toBe('web');
      expectJsonObjectBody(request);
      expect(request.jsonBody).toEqual({ name: 'topic-2' });
      return { status: 200, body: {} };
    });
    server.on('GET', '/org/app/thread/thread-1/users', request => {
      expect(request.query.get('limit')).toBe('20');
      return {
        status: 200,
        body: {
          entities: ['alice', { user: 'bob', joinedAt: 1 }],
          cursor: '',
        },
      };
    });
    server.on('DELETE', '/org/app/thread/thread-1/users/bob', request => {
      expect(request.query.get('resource')).toBe('web');
      return { status: 200, body: {} };
    });
    server.on('POST', '/org/app/thread/message', request => {
      expectJsonObjectBody(request);
      expect(request.jsonBody).toEqual({
        threadIds: ['thread-1'],
      });
      return {
        status: 200,
        body: {
          entities: [
            {
              thread_id: 'thread-1',
              last_message: {
                id: 'msg-last',
                timestamp: 100,
                payload: {
                  bodies: [{ type: 'txt', msg: 'hello' }],
                },
              },
            },
          ],
        },
      };
    });
    server.on('DELETE', '/org/app/thread/thread-1/user/alice/quit', request => {
      expect(request.query.get('resource')).toBe('web');
      return { status: 200, body: {} };
    });
    server.on('DELETE', '/org/app/thread/thread-1', request => {
      expect(request.query.get('resource')).toBe('web');
      return { status: 200, body: {} };
    });

    await expect(
      client.chatThreadManager.createChatThread({
        parentId: 'group-1',
        name: 'topic-1',
        messageId: 'msg-parent-1',
      })
    ).resolves.toEqual({ chatThreadId: 'thread-1' });
    await expect(
      client.chatThreadManager.getChatThreadList({
        parentId: 'group-1',
        pageSize: 10,
        cursor: 'cursor-0',
      })
    ).resolves.toEqual({
      items: [
        {
          chatThreadId: 'thread-1',
          parentId: 'group-1',
          name: 'topic-1',
          ownerId: 'alice',
          memberCount: 2,
          lastMessage: null,
        },
      ],
      cursor: 'cursor-1',
    });
    await expect(
      client.chatThreadManager.getChatThreadInfo({ chatThreadId: 'thread-1' })
    ).resolves.toEqual({
      chatThreadId: 'thread-1',
      parentId: 'group-1',
      name: 'topic-1',
      ownerId: 'alice',
      messageCount: 3,
      lastMessage: null,
    });
    await expect(
      client.chatThreadManager.joinChatThread({ chatThreadId: 'thread-1' })
    ).resolves.toBeUndefined();
    await expect(
      client.chatThreadManager.getJoinedChatThreadList({ parentId: 'group-1' })
    ).resolves.toEqual({
      items: [
        {
          chatThreadId: 'thread-1',
          parentId: 'group-1',
          name: 'topic-1',
          lastMessage: null,
        },
      ],
      cursor: '',
    });
    await expect(
      client.chatThreadManager.updateChatThreadName({
        chatThreadId: 'thread-1',
        name: 'topic-2',
      })
    ).resolves.toBeUndefined();
    await expect(
      client.chatThreadManager.getChatThreadMemberList({ chatThreadId: 'thread-1' })
    ).resolves.toEqual({
      items: [{ memberId: 'alice' }, { memberId: 'bob', joinedAt: 1 }],
      cursor: '',
    });
    await expect(
      client.chatThreadManager.removeChatThreadMember({
        chatThreadId: 'thread-1',
        memberId: 'bob',
      })
    ).resolves.toBeUndefined();
    await expect(
      client.chatThreadManager.getChatThreadLastMessageList({ chatThreadIds: ['thread-1'] })
    ).resolves.toEqual({
      items: [
        {
          chatThreadId: 'thread-1',
          lastMessage: {
            msgId: 'msg-last',
            type: 'txt',
            body: { type: 'txt', msg: 'hello' },
            timestamp: 100,
          },
        },
      ],
    });
    await expect(
      client.chatThreadManager.leaveChatThread({ chatThreadId: 'thread-1' })
    ).resolves.toBeUndefined();
    await expect(
      client.chatThreadManager.destroyChatThread({ chatThreadId: 'thread-1' })
    ).resolves.toBeUndefined();
  });

  it('operation metadata 应驱动 REST 业务错误映射', async () => {
    server.on('GET', '/org/app/thread/missing-thread', () => ({
      status: 404,
      body: {
        error: 'service_resource_not_found',
        message: 'thread does not exist',
      },
    }));

    await expect(
      client.chatThreadManager.getChatThreadInfo({ chatThreadId: 'missing-thread' })
    ).rejects.toMatchObject({
      code: 606,
      details: expect.objectContaining({
        api: 'getChatThreadInfo',
        mapped: true,
        reasonKey: 'service_resource_not_found',
      }),
    });
  });
});
