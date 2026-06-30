import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CacheManager } from '@/cache/cache-manager';
import { ChatClient } from '@/chat-client';
import { ChatManager } from '@/managers/chat-manager';
import type { ConversationListUpdatePayload } from '@/cache/cache-types';
import type { Message } from '@/types';

const resetSingleton = (): void => {
  (ChatClient as unknown as { instance: ChatClient | null }).instance = null;
};

const buildIncomingGroupMessage = (): Message => {
  return {
    msgServerId: 'msg-server-1',
    msgLocalId: 'msg-local-1',
    from: '',
    to: '',
    sender: { userId: 'tst01' },
    conversationId: 'group-1',
    conversationType: 'groupChat',
    type: 'text',
    status: 'sent',
    ext: {},
    timestamp: 1000,
    body: { content: 'hello group' },
    direct: 'RECEIVE',
  };
};

describe('ChatClient conversation message events', () => {
  beforeEach((): void => {
    resetSingleton();
    localStorage.clear();
    vi.restoreAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(2000);
  });

  afterEach((): void => {
    vi.useRealTimers();
  });

  it('收到消息导致会话摘要变化时应派发 source=message', async () => {
    const client = ChatClient.init({
      appKey: 'org#app',
    }).use(ChatManager);
    const cacheManager = new CacheManager({
      appKey: 'org#app',
      userId: 'alice',
      cacheEncryptionMode: 'off',
    });
    await cacheManager.prepare();

    (
      client as unknown as {
        cacheManager: CacheManager | null;
      }
    ).cacheManager = cacheManager;
    const onConversationListUpdate = vi.fn();
    client.chatManager.addEventHandler('conversation-ui', {
      onConversationListUpdate,
    });
    onConversationListUpdate.mockClear();

    (
      client as unknown as {
        eventHub: { dispatch: (event: string, payload: unknown) => void };
      }
    ).eventHub.dispatch('onMessage', buildIncomingGroupMessage());

    // 035：实时消息到达时，旧 conversation 列表和新 ConversationItem 列表都要同步收敛，
    // 不能只更新其中一边。
    expect(onConversationListUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        version: 1,
        reason: 'message',
        items: [
          {
            conversationId: 'group-1',
            conversationType: 'groupChat',
            unreadCount: 1,
            lastMessage: {
              msgServerId: 'msg-server-1',
              from: 'tst01',
              to: 'group-1',
              sender: { userId: 'tst01' },
              conversationId: 'group-1',
              conversationType: 'groupChat',
              type: 'text',
              status: 'sent',
              direct: 'RECEIVE',
              body: { content: 'hello group' },
              timestamp: 1000,
            },
            lastMessageAt: 1000,
            isPinned: undefined,
            pinnedTimestamp: undefined,
            marks: [],
            readAt: undefined,
            remindType: 'DEFAULT',
            conversationName: 'group-1',
            conversationAvatar: undefined,
          },
        ],
        patch: expect.objectContaining({
          reset: false,
          upserted: [
            expect.objectContaining({
              conversationId: 'group-1',
              conversationType: 'groupChat',
            }),
          ],
          removed: [],
          affectedKeys: ['groupChat:group-1'],
          orderChanged: true,
        }),
      } satisfies Partial<ConversationListUpdatePayload>)
    );

    expect(cacheManager.loadSessionList()).toEqual([
      {
        conversationId: 'group-1',
        conversationType: 'groupChat',
        unreadCount: 1,
        lastMessage: {
          msgServerId: 'msg-server-1',
          from: 'tst01',
          to: 'group-1',
          sender: { userId: 'tst01' },
          conversationId: 'group-1',
          conversationType: 'groupChat',
          type: 'text',
          status: 'sent',
          timestamp: 1000,
          direct: 'RECEIVE',
          body: { content: 'hello group' },
        },
        lastMessageAt: 1000,
        isPinned: undefined,
        pinnedTimestamp: undefined,
        marks: [],
        readAt: undefined,
        remindType: 'DEFAULT',
        conversationName: 'group-1',
        conversationAvatar: undefined,
      },
    ]);
  });
});
