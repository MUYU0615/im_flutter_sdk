import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatClient } from '@/chat-client';
import { ChatManager } from '@/managers/chat-manager';

import {
  type ClientWithChatManager,
  buildFetchMock,
  createJsonResponse,
  primeRestContext,
  resetSingleton,
} from './helpers';

describe('ChatManager message interactions integration', () => {
  const originalFetch = globalThis.fetch;
  let client: ClientWithChatManager;

  beforeEach(() => {
    resetSingleton();
    client = ChatClient.init({ appKey: 'org#app' }).use(ChatManager) as ClientWithChatManager;
    primeRestContext(client);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
    resetSingleton();
  });

  it('group read/reaction/pin 应返回标准化对象并派发事件', async () => {
    const onReactionChanged = vi.fn();
    const onPinnedMessageChanged = vi.fn();
    client.chatManager.addEventHandler('message-interactions', {
      onReactionChanged,
      onPinnedMessageChanged,
    });

    globalThis.fetch = buildFetchMock(call => {
      if (call.url.pathname === '/org/app/chatgroups/group-1/acks/msg-1') {
        expect(call.method).toBe('GET');
        expect(call.url.searchParams.get('limit')).toBe('20');
        expect(call.url.searchParams.get('key')).toBe('cursor-1');
        return createJsonResponse(200, {
          data: {
            ackmid: 'msg-1',
            userlist: [
              {
                username: 'bob',
                meta_id: 'ack-1',
                timestamp: 1714291200000,
                ack_content: '{"test":1}',
              },
            ],
            total: 1,
            next_key: '',
            is_last: true,
          },
        });
      }

      if (call.url.pathname === '/org/app/reaction/user/alice' && call.method === 'POST') {
        expect(call.body).toEqual({
          msgId: 'msg-1',
          message: '👍',
        });
        return createJsonResponse(200, {});
      }

      if (call.url.pathname === '/org/app/reaction/user/alice' && call.method === 'DELETE') {
        expect(call.url.searchParams.get('msgId')).toBe('msg-1');
        expect(call.url.searchParams.get('message')).toBe('👍');
        return createJsonResponse(200, {});
      }

      if (call.url.pathname === '/org/app/reaction/user/alice/detail') {
        expect(call.method).toBe('GET');
        expect(call.url.searchParams.get('msgId')).toBe('msg-1');
        expect(call.url.searchParams.get('message')).toBe('👍');
        expect(call.url.searchParams.get('cursor')).toBe('cursor-1');
        expect(call.url.searchParams.get('limit')).toBe('20');
        return createJsonResponse(200, {
          requestStatusCode: 'ok',
          data: {
            reactionId: 'reaction-1',
            reaction: '👍',
            count: 2,
            state: true,
            userList: ['alice', 'bob'],
            cursor: null,
            reactionUserList: [
              {
                userId: 'alice',
                createdAt: '2026-04-28T08:28:15.854366Z',
              },
            ],
            createdAt: '2026-04-28T08:28:15.845395Z',
          },
        });
      }

      if (call.url.pathname === '/org/app/reaction/user/alice') {
        expect(call.method).toBe('GET');
        expect(call.url.searchParams.get('msgIdList')).toBe('msg-1');
        expect(call.url.searchParams.get('msgType')).toBe('group');
        expect(call.url.searchParams.get('groupId')).toBe('group-1');
        return createJsonResponse(200, {
          requestStatusCode: 'ok',
          data: [
            {
              msgId: 'msg-1',
              reactionList: [],
            },
          ],
        });
      }

      if (
        call.url.pathname === '/org/app/sdk/user/alice/user_channel/pin' &&
        call.method === 'POST'
      ) {
        expect(call.body).toEqual({
          pin_msg_id: 'msg-1',
          to: 'group-1',
          type: 'groupchat',
        });
        return createJsonResponse(200, {});
      }

      if (
        call.url.pathname === '/org/app/sdk/user/alice/user_channel/pin' &&
        call.method === 'DELETE'
      ) {
        expect(call.body).toEqual({
          pin_msg_id: 'msg-1',
          to: 'group-1',
          type: 'groupchat',
        });
        return createJsonResponse(200, {});
      }

      expect(call.method).toBe('GET');
      expect(call.url.pathname).toBe('/org/app/sdk/user/alice/user_channel/pin');
      expect(call.url.searchParams.get('to')).toBe('group-1');
      expect(call.url.searchParams.get('type')).toBe('groupchat');
      expect(call.url.searchParams.get('limit')).toBe('20');
      expect(call.url.searchParams.has('cursor')).toBe(false);
      return createJsonResponse(200, {
        data: {
          msg_infos: [
            {
              pin_opt_at: 1714291200000,
              pin_operator: 'alice',
              message: {
                id: 'pin-msg-1',
                timestamp: 1714291200000,
                payload: JSON.stringify({
                  from: 'bob',
                  to: 'group-1',
                  ext: {},
                  bodies: [
                    {
                      type: 'txt',
                      msg: 'pinned-message',
                    },
                  ],
                }),
              },
            },
          ],
          cursor: 'cursor-2',
        },
      });
    });

    const groupReads = await client.chatManager.getGroupMessageReadUsers({
      groupId: 'group-1',
      messageId: 'msg-1',
      cursor: 'cursor-1',
      pageSize: 20,
    });
    await client.chatManager.addReaction({
      messageId: 'msg-1',
      reaction: '👍',
    });
    await client.chatManager.removeReaction({
      messageId: 'msg-1',
      reaction: '👍',
    });
    const reactionList = await client.chatManager.getReactionList({
      messageId: 'msg-1',
      conversationType: 'groupChat',
      groupId: 'group-1',
    });
    const reactionDetail = await client.chatManager.getReactionDetail({
      messageId: 'msg-1',
      reaction: '👍',
      cursor: 'cursor-1',
      pageSize: 20,
    });
    await client.chatManager.pinMessage({
      messageId: 'msg-1',
      conversationId: 'group-1',
      conversationType: 'groupChat',
    });
    await client.chatManager.unpinMessage({
      messageId: 'msg-1',
      conversationId: 'group-1',
      conversationType: 'groupChat',
    });
    const pinnedMessages = await client.chatManager.getPinnedMessageList({
      conversationId: 'group-1',
      conversationType: 'groupChat',
    });

    expect(groupReads).toEqual({
      groupId: 'group-1',
      messageId: 'msg-1',
      users: [
        {
          userId: 'bob',
          user: {
            userId: 'bob',
          },
          ackId: 'ack-1',
          timestamp: 1714291200000,
          ackContent: '{"test":1}',
        },
      ],
      count: 1,
      cursor: '',
      hasMore: false,
    });
    expect(reactionList).toEqual([
      {
        messageId: 'msg-1',
        reactions: [],
      },
    ]);
    expect(reactionDetail).toEqual({
      reaction: '👍',
      count: 2,
      isAddedBySelf: true,
      reactionUsers: [
        {
          userId: 'alice',
          user: { userId: 'alice' },
          createdAt: '2026-04-28T08:28:15.854366Z',
        },
      ],
      cursor: '',
      hasMore: false,
      createdAt: '2026-04-28T08:28:15.845395Z',
    });
    expect(onReactionChanged).toHaveBeenNthCalledWith(1, {
      messageId: 'msg-1',
      reaction: '👍',
      operation: 'add',
    });
    expect(onReactionChanged).toHaveBeenNthCalledWith(2, {
      messageId: 'msg-1',
      reaction: '👍',
      operation: 'remove',
    });
    expect(onPinnedMessageChanged).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        messageId: 'msg-1',
        conversationId: 'group-1',
        conversationType: 'groupChat',
        operation: 'pin',
        operatorId: 'alice',
      })
    );
    expect(onPinnedMessageChanged).toHaveBeenNthCalledWith(2, {
      messageId: 'msg-1',
      conversationId: 'group-1',
      conversationType: 'groupChat',
      operation: 'unpin',
      operatorId: 'alice',
    });
    expect(pinnedMessages).toEqual({
      items: [
        {
          messageId: 'pin-msg-1',
          conversationId: 'group-1',
          conversationType: 'groupChat',
          operatorId: 'alice',
          pinnedAt: 1714291200000,
          message: {
            msgServerId: 'pin-msg-1',
            msgLocalId: '',
            from: 'bob',
            to: 'group-1',
            sender: {
              userId: 'bob',
              nickname: undefined,
              avatarUrl: undefined,
            },
            conversationId: 'group-1',
            conversationType: 'groupChat',
            type: 'text',
            status: 'sent',
            ext: {},
            timestamp: 1714291200000,
            body: {
              content: 'pinned-message',
            },
            direct: 'RECEIVE',
          },
        },
      ],
    });
  });
});
