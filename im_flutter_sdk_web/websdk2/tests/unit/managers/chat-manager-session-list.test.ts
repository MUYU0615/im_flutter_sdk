import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CacheManager } from '@/cache/cache-manager';
import { ChatClient } from '@/chat-client';
import { ChatManager } from '@/managers/chat-manager';
import { EventHub } from '@/core/events/event-hub';
import type { ConversationItem } from '@/types/conversation';
import type { Message } from '@/types';

const resetSingleton = (): void => {
  (ChatClient as unknown as { instance: ChatClient | null }).instance = null;
};

const buildConversationItem = (overrides: Partial<ConversationItem> = {}): ConversationItem => {
  return {
    conversationId: 'u1',
    conversationType: 'singleChat',
    unreadCount: 1,
    lastMessage: {
      msgServerId: 'm1',
      from: 'u1',
      to: 'u1',
      sender: { userId: 'u1' },
      conversationId: 'u1',
      conversationType: 'singleChat',
      type: 'text',
      timestamp: 1,
      body: { content: 'hi' },
    },
    lastMessageAt: 1,
    marks: [],
    remindType: 'DEFAULT',
    conversationName: 'u1',
    ...overrides,
  };
};

describe('ChatManager session list api', () => {
  beforeEach((): void => {
    resetSingleton();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('client.getSessionList should not be exposed publicly', (): void => {
    const client = ChatClient.init({ appKey: 'app-key' }).use(ChatManager);

    expect((client as unknown as { getSessionList?: unknown }).getSessionList).toBeUndefined();
  });

  it('getConversationList should read current cache snapshot without triggering refresh', async (): Promise<void> => {
    const client = ChatClient.init({ appKey: 'app-key' }).use(ChatManager);
    const cacheManager = new CacheManager({
      appKey: 'app-key',
      userId: 'u1',
      cacheEncryptionMode: 'off',
    });
    await cacheManager.prepare();
    cacheManager.replaceSessionList([buildConversationItem()]);

    (
      client as unknown as {
        cacheManager: CacheManager | null;
        currentUserId: string | null;
      }
    ).cacheManager = cacheManager;
    (
      client as unknown as {
        currentUserId: string | null;
      }
    ).currentUserId = 'u1';

    const refreshSpy = vi.fn().mockResolvedValue([]);
    (
      client as unknown as {
        refreshSessionList: () => Promise<ReadonlyArray<ConversationItem>>;
      }
    ).refreshSessionList = refreshSpy;

    // getConversationList 是纯读缓存接口，不能因为页面读取列表就偷偷触发一次网络刷新。
    const items = client.chatManager.getConversationList();
    expect(items).toHaveLength(1);
    expect(items[0]?.conversationId).toBe('u1');
    expect(refreshSpy).not.toHaveBeenCalled();
  });

  it('refreshSessionList should delegate to client', async (): Promise<void> => {
    const client = ChatClient.init({ appKey: 'app-key' });
    const manager = new ChatManager();
    const sessions = [buildConversationItem()];
    const refreshSessionList = vi.fn().mockResolvedValue(sessions);

    manager.bind({
      ...client,
      refreshSessionList,
    } as unknown as ChatClient);

    await expect(manager.refreshSessionList()).resolves.toEqual(sessions);
    expect(refreshSessionList).toHaveBeenCalledTimes(1);
  });

  it('refreshSessionList should reuse same in-flight promise from client', (): void => {
    const client = ChatClient.init({ appKey: 'app-key' });
    const manager = new ChatManager();
    const promise = Promise.resolve([buildConversationItem()] as ReadonlyArray<ConversationItem>);
    const refreshSessionList = vi.fn().mockReturnValue(promise);

    manager.bind({
      ...client,
      refreshSessionList,
    } as unknown as ChatClient);

    const first = manager.refreshSessionList();
    const second = manager.refreshSessionList();

    // 035：manager 层不额外包装 Promise，确保上层也能感知“同一轮刷新任务被复用”。
    expect(first).toBe(second);
    expect(refreshSessionList).toHaveBeenCalledTimes(2);
  });

  it('getConversationList should page from session-list cache', async (): Promise<void> => {
    const client = ChatClient.init({ appKey: 'app-key' }).use(ChatManager);
    const cacheManager = new CacheManager({
      appKey: 'app-key',
      userId: 'u1',
      cacheEncryptionMode: 'off',
    });
    await cacheManager.prepare();
    cacheManager.replaceSessionList([
      buildConversationItem(),
      {
        ...buildConversationItem(),
        conversationId: 'u2',
        conversationName: 'u2',
        lastMessage: null,
        lastMessageAt: undefined,
      },
    ]);

    (
      client as unknown as {
        cacheManager: CacheManager | null;
        currentUserId: string | null;
      }
    ).cacheManager = cacheManager;
    (
      client as unknown as {
        currentUserId: string | null;
      }
    ).currentUserId = 'u1';

    const result = client.chatManager.getConversationList();

    expect(result).toHaveLength(1);
    expect(result[0]?.conversationId).toBe('u1');
  });

  it('getConversationList with isPinned filter should return only pinned items', async (): Promise<void> => {
    const client = ChatClient.init({ appKey: 'app-key' }).use(ChatManager);
    const cacheManager = new CacheManager({
      appKey: 'app-key',
      userId: 'u1',
      cacheEncryptionMode: 'off',
    });
    await cacheManager.prepare();
    cacheManager.replaceSessionList([
      {
        ...buildConversationItem(),
        conversationId: 'pinned-1',
        isPinned: true,
        pinnedTimestamp: 10,
        conversationName: 'pinned-1',
      },
      {
        ...buildConversationItem(),
        conversationId: 'normal-1',
        isPinned: false,
        conversationName: 'normal-1',
      },
    ]);

    (
      client as unknown as {
        cacheManager: CacheManager | null;
        currentUserId: string | null;
      }
    ).cacheManager = cacheManager;
    (
      client as unknown as {
        currentUserId: string | null;
      }
    ).currentUserId = 'u1';

    const result = client.chatManager.getConversationList({ isPinned: true });

    expect(result).toHaveLength(1);
    expect(result[0]?.conversationId).toBe('pinned-1');
  });

  it('getConversationList with mark filter should return only matching items', async (): Promise<void> => {
    const client = ChatClient.init({ appKey: 'app-key' }).use(ChatManager);
    const cacheManager = new CacheManager({
      appKey: 'app-key',
      userId: 'u1',
      cacheEncryptionMode: 'off',
    });
    await cacheManager.prepare();
    cacheManager.replaceSessionList([
      {
        ...buildConversationItem(),
        conversationId: 'mark-1',
        marks: [3],
        conversationName: 'mark-1',
      },
      {
        ...buildConversationItem(),
        conversationId: 'mark-2',
        marks: [2],
        conversationName: 'mark-2',
      },
    ]);

    (
      client as unknown as {
        cacheManager: CacheManager | null;
        currentUserId: string | null;
      }
    ).cacheManager = cacheManager;
    (
      client as unknown as {
        currentUserId: string | null;
      }
    ).currentUserId = 'u1';

    const result = client.chatManager.getConversationList({ mark: 3 });

    expect(result).toHaveLength(1);
    expect(result[0]?.conversationId).toBe('mark-1');
  });

  it('发送成功后 session-list cache 应立即反映最新 lastMessage', async (): Promise<void> => {
    const client = ChatClient.init({ appKey: 'app-key' }).use(ChatManager);
    const cacheManager = new CacheManager({
      appKey: 'app-key',
      userId: 'u1',
      cacheEncryptionMode: 'off',
    });
    await cacheManager.prepare();
    cacheManager.replaceSessionList([buildConversationItem()]);

    (
      client as unknown as {
        cacheManager: CacheManager | null;
        currentUserId: string | null;
        eventHub: EventHub;
      }
    ).cacheManager = cacheManager;
    (
      client as unknown as {
        cacheManager: CacheManager | null;
        currentUserId: string | null;
        eventHub: EventHub;
      }
    ).currentUserId = 'u1';

    const message: Message = {
      msgLocalId: 'local-2',
      from: '',
      to: '',
      msgServerId: 'server-2',
      sender: { userId: 'u1' },
      conversationId: 'u1-peer',
      conversationType: 'singleChat',
      type: 'text',
      status: 'sent',
      ext: {},
      timestamp: 2,
      body: { content: 'latest text' },
      direct: 'SEND',
    };

    (
      client as unknown as {
        eventHub: EventHub;
      }
    ).eventHub.dispatch('__internal:onMessageSent', message);

    // 035：新会话列表不仅吃服务端快照，也要吃实时消息 patch；发送成功后 lastMessage 应立即可见。
    expect(cacheManager.loadSessionList()[0]).toMatchObject({
      conversationId: 'u1-peer',
      unreadCount: 0,
      lastMessage: {
        msgServerId: 'server-2',
        from: 'u1',
        to: 'u1-peer',
        sender: { userId: 'u1' },
        timestamp: 2,
        body: { content: 'latest text' },
      },
      lastMessageAt: 2,
    });
  });

  it('收到消息时应基于现有 ConversationItem 未读数递增', async (): Promise<void> => {
    const client = ChatClient.init({ appKey: 'app-key' }).use(ChatManager);
    const cacheManager = new CacheManager({
      appKey: 'app-key',
      userId: 'u1',
      cacheEncryptionMode: 'off',
    });
    await cacheManager.prepare();
    cacheManager.replaceSessionList([
      {
        conversationId: 'u1-peer',
        conversationType: 'singleChat',
        unreadCount: 44,
        lastMessage: {
          msgServerId: 'server-1',
          from: 'u1-peer',
          to: 'u1',
          sender: { userId: 'u1-peer' },
          timestamp: 1,
          body: { content: 'old text' },
        },
        lastMessageAt: 1,
        marks: [],
        remindType: 'DEFAULT',
        conversationName: 'u1-peer',
      },
    ]);

    (
      client as unknown as {
        cacheManager: CacheManager | null;
        currentUserId: string | null;
        eventHub: EventHub;
      }
    ).cacheManager = cacheManager;
    (
      client as unknown as {
        cacheManager: CacheManager | null;
        currentUserId: string | null;
        eventHub: EventHub;
      }
    ).currentUserId = 'u1';

    const message: Message = {
      msgLocalId: 'local-3',
      from: '',
      to: '',
      msgServerId: 'server-3',
      sender: { userId: 'u1-peer' },
      conversationId: 'u1',
      conversationType: 'singleChat',
      type: 'text',
      status: 'sent',
      ext: {},
      timestamp: 3,
      body: { content: 'latest inbound text' },
      direct: 'RECEIVE',
    };

    (
      client as unknown as {
        eventHub: EventHub;
      }
    ).eventHub.dispatch('onMessage', message);

    // 035：这里锁住“保留现有 unread 基线再递增”的回归点，避免实时 patch 把 44 打回 1。
    expect(cacheManager.loadSessionList()[0]).toMatchObject({
      conversationId: 'u1-peer',
      unreadCount: 45,
      lastMessage: {
        msgServerId: 'server-3',
        from: 'u1-peer',
        to: 'u1',
        sender: { userId: 'u1-peer' },
        timestamp: 3,
        body: { content: 'latest inbound text' },
      },
      lastMessageAt: 3,
    });
  });
});
