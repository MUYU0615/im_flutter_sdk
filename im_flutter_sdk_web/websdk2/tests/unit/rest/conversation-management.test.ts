import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  requestClearAllMessagesAndConversations,
  requestDeleteConversation,
  requestAddConversationMark,
  requestGetPinnedMessageList,
  requestPinMessage,
  requestRemoveConversationMark,
  requestSetConversationPinned,
  requestUnpinMessage,
} from '@/rest/conversation-management';
import type { RestContext } from '@/types/chat-client';
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
    request: vi.fn(
      (_endpoint: string, _config?: unknown): Promise<unknown> => Promise.resolve(undefined)
    ),
    get: vi.fn(
      (_endpoint: string, _config?: unknown): Promise<unknown> =>
        Promise.resolve({
          data: {
            channel_infos: [],
            cursor: '',
          },
        })
    ),
    post: vi.fn(
      (_endpoint: string, _body?: unknown, _config?: unknown): Promise<unknown> =>
        Promise.resolve({ data: {} })
    ),
    delete: vi.fn(
      (_endpoint: string, _config?: unknown): Promise<unknown> =>
        Promise.resolve({ data: {} })
    ),
  };
};

describe('conversation-management', () => {
  afterEach((): void => {
    vi.restoreAllMocks();
  });

  it('add/removeConversationMark 应把多个会话映射为服务端 targets', async () => {
    const client = createRestClient();
    client.request.mockResolvedValueOnce({
      data: {
        ignore: [{ to: 'user-1', type: 'chat' }],
      },
    });

    await expect(
      requestAddConversationMark(client as never, DEFAULT_CONTEXT, {
        conversations: [
          { conversationId: 'group-1', conversationType: 'groupChat' },
          { conversationId: 'user-1', conversationType: 'singleChat' },
        ],
        mark: 3,
      })
    ).resolves.toEqual({
      succeeded: [
        { conversationId: 'group-1', conversationType: 'groupChat' },
      ],
      failed: [
        { conversationId: 'user-1', conversationType: 'singleChat', reason: 'ignored_by_server' },
      ],
      mark: 3,
      operation: 'addMark',
    });
    expect(client.request).toHaveBeenNthCalledWith(
      1,
      '/org/app/sdk/user/alice/user_channels/mark?resource=web',
      {
        method: 'POST',
        body: {
          mark: 'mark_3',
          targets: [
            {
              to: 'group-1',
              type: 'groupchat',
            },
            {
              to: 'user-1',
              type: 'chat',
            },
          ],
        },
        operation: 'addConversationMark',
      }
    );

    await expect(
      requestRemoveConversationMark(client as never, DEFAULT_CONTEXT, {
        conversations: [
          { conversationId: 'group-1', conversationType: 'groupChat' },
          { conversationId: 'user-1', conversationType: 'singleChat' },
        ],
        mark: 3,
      })
    ).resolves.toEqual({
      succeeded: [
        { conversationId: 'group-1', conversationType: 'groupChat' },
        { conversationId: 'user-1', conversationType: 'singleChat' },
      ],
      failed: [],
      mark: 3,
      operation: 'removeMark',
    });
    expect(client.request).toHaveBeenNthCalledWith(
      2,
      '/org/app/sdk/user/alice/user_channels/mark?resource=web',
      {
        method: 'DELETE',
        body: {
          mark: 'mark_3',
          targets: [
            {
              to: 'group-1',
              type: 'groupchat',
            },
            {
              to: 'user-1',
              type: 'chat',
            },
          ],
        },
        operation: 'removeConversationMark',
      }
    );
  });

  it('deleteConversation 与 setConversationPinned 应组装正确 REST 参数', async () => {
    const client = createRestClient();
    client.post.mockResolvedValueOnce({
      data: {
        is_top: true,
        update_top_status_time: 123,
      },
    });

    await expect(
      requestDeleteConversation(client as never, DEFAULT_CONTEXT, {
        conversationId: 'g1',
        conversationType: 'groupChat',
        deleteRoamingMessages: true,
      })
    ).resolves.toEqual({
      conversationId: 'g1',
      conversationType: 'groupChat',
      operation: 'delete',
    });
    expect(client.request).toHaveBeenCalledWith(
      '/org/app/user/alice/user_channel?resource=web',
      {
        method: 'DELETE',
        body: {
          channel: 'g1',
          type: 'groupChat',
          delete_roam: true,
        },
        operation: 'deleteConversation',
      }
    );

    await expect(
      requestSetConversationPinned(client as never, DEFAULT_CONTEXT, {
        conversationId: 'bob',
        conversationType: 'singleChat',
        pinned: true,
      })
    ).resolves.toEqual({
      conversationId: 'bob',
      conversationType: 'singleChat',
      operation: 'setPinned',
      isPinned: true,
      pinnedTime: 123,
    });

    await expect(
      requestSetConversationPinned(client as never, DEFAULT_CONTEXT, {
        conversationId: 'room-1',
        conversationType: 'chatRoom',
        pinned: false,
      })
    ).resolves.toEqual({
      conversationId: 'room-1',
      conversationType: 'chatRoom',
      operation: 'setPinned',
      isPinned: false,
      pinnedTime: 0,
    });
    expect(client.delete).toHaveBeenCalledWith(
      '/org/app/sdk/user/alice/user_channel/top?type=chatroom&to=room-1&resource=web',
      {
        operation: 'setConversationPinned',
      }
    );
  });

  it('pin/unpin/clearAll/getPinnedMessageList 应返回稳定结果', async () => {
    const client = createRestClient();
    client.get.mockResolvedValueOnce({
      data: {
        msg_infos: [
          {
            pin_msg_id: 'm1',
            pin_operator: 'alice',
            pin_opt_at: 10,
            message: {
              id: 'm1',
              timestamp: 10,
              payload: JSON.stringify({
                from: 'alice',
                to: 'g1',
                ext: {},
                bodies: [
                  {
                    type: 'txt',
                    msg: 'first pinned message',
                  },
                ],
              }),
            },
          },
          {
            message: {
              id: 'm2',
              timestamp: 11,
              payload: JSON.stringify({
                from: 'bob',
                to: 'g1',
                ext: { pinned: true },
                bodies: [
                  {
                    type: 'txt',
                    msg: 'pinned message',
                  },
                ],
              }),
            },
            pin_operator: 'bob',
            pin_opt_at: 11,
          },
          {},
        ],
        cursor: 'cursor-2',
      },
    });

    await expect(
      requestPinMessage(client as never, DEFAULT_CONTEXT, {
        conversationId: 'g1',
        conversationType: 'groupChat',
        messageId: 'm1',
      })
    ).resolves.toEqual({
      conversationId: 'g1',
      conversationType: 'groupChat',
      messageId: 'm1',
      operation: 'pin',
    });

    await expect(
      requestUnpinMessage(client as never, DEFAULT_CONTEXT, {
        conversationId: 'room-1',
        conversationType: 'chatRoom',
        messageId: 'm2',
      })
    ).resolves.toEqual({
      conversationId: 'room-1',
      conversationType: 'chatRoom',
      messageId: 'm2',
      operation: 'unpin',
    });

    await requestClearAllMessagesAndConversations(client as never, DEFAULT_CONTEXT);
    expect(client.post).toHaveBeenCalledWith(
      '/org/app/sdk/message/roaming/user/alice/delete/all?resource=web',
      undefined,
      {
        operation: 'clearAllMessagesAndConversations',
      }
    );

    await expect(
      requestGetPinnedMessageList(client as never, DEFAULT_CONTEXT, {
        conversationId: 'g1',
        conversationType: 'groupChat',
      })
    ).resolves.toEqual({
      items: [
        {
          messageId: 'm1',
          conversationId: 'g1',
          conversationType: 'groupChat',
          operatorId: 'alice',
          pinnedAt: 10,
          message: {
            msgServerId: 'm1',
            msgLocalId: '',
            from: 'alice',
            to: 'g1',
            sender: {
              userId: 'alice',
              nickname: undefined,
              avatarUrl: undefined,
            },
            conversationId: 'g1',
            conversationType: 'groupChat',
            type: 'text',
            status: 'sent',
            ext: {},
            timestamp: 10,
            body: {
              content: 'first pinned message',
            },
            direct: 'SEND',
          },
        },
        {
          messageId: 'm2',
          conversationId: 'g1',
          conversationType: 'groupChat',
          operatorId: 'bob',
          pinnedAt: 11,
          message: {
            msgServerId: 'm2',
            msgLocalId: '',
            from: 'bob',
            to: 'g1',
            sender: {
              userId: 'bob',
              nickname: undefined,
              avatarUrl: undefined,
            },
            conversationId: 'g1',
            conversationType: 'groupChat',
            type: 'text',
            status: 'sent',
            ext: { pinned: true },
            timestamp: 11,
            body: {
              content: 'pinned message',
            },
            direct: 'RECEIVE',
          },
        },
      ],
    });
    expect(client.get).toHaveBeenCalledWith(
      '/org/app/sdk/user/alice/user_channel/pin?to=g1&type=groupchat&limit=20',
      {
        operation: 'getPinnedMessageList',
      }
    );
  });

  it('非法参数应抛出 ValidationError', async () => {
    const client = createRestClient();

    await expect(
      requestDeleteConversation(client as never, DEFAULT_CONTEXT, {
        conversationId: 'g1',
        conversationType: 'groupChat',
        deleteRoamingMessages: 'yes' as never,
      })
    ).rejects.toThrow(ValidationError);

    await expect(
      requestSetConversationPinned(client as never, DEFAULT_CONTEXT, {
        conversationId: 'g1',
        conversationType: 'groupChat',
        pinned: 'yes' as never,
      })
    ).rejects.toThrow(ValidationError);

    await expect(
      requestAddConversationMark(client as never, DEFAULT_CONTEXT, {
        conversations: [{ conversationId: 'g1', conversationType: 'groupChat' }],
        mark: 20,
      } as never)
    ).rejects.toThrow(ValidationError);

    await expect(
      requestAddConversationMark(client as never, DEFAULT_CONTEXT, {
        conversations: [],
        mark: 3,
      })
    ).rejects.toThrow(ValidationError);

    await expect(
      requestSetConversationPinned(client as never, DEFAULT_CONTEXT, {
        conversationId: 'g1',
        type: 'groupChat',
        pinned: true,
      } as never)
    ).rejects.toThrow(ValidationError);
  });
});
