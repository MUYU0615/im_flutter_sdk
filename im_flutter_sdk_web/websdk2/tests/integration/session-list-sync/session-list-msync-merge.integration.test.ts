import { describe, expect, it } from 'vitest';

import { CacheManager } from '@/cache/cache-manager';

describe('session-list msync merge integration', () => {
  it('WSS 快照完成后应保留同步期间更晚的实时消息事实', async () => {
    const cacheManager = new CacheManager({
      appKey: 'org#app',
      userId: 'u1',
      cacheEncryptionMode: 'off',
    });
    await cacheManager.prepare();

    cacheManager.replaceSessionList([
      {
        conversationId: 'peer-1',
        conversationType: 'singleChat',
        unreadCount: 44,
        lastMessage: {
          msgServerId: 'msg-live',
          from: 'peer-1',
          to: 'u1',
          sender: { userId: 'peer-1' },
          timestamp: 200,
          body: { content: 'live newer' },
        },
        lastMessageAt: 200,
        marks: [],
        remindType: 'DEFAULT',
        conversationName: 'peer-1',
      },
    ]);

    cacheManager.replaceSessionList([
      {
        conversationId: 'peer-1',
        conversationType: 'singleChat',
        unreadCount: 1,
        lastMessage: {
          msgServerId: 'msg-snapshot',
          from: 'peer-1',
          to: 'u1',
          sender: { userId: 'peer-1' },
          timestamp: 100,
          body: { content: 'snapshot older' },
        },
        lastMessageAt: 100,
        marks: [],
        remindType: 'DEFAULT',
        conversationName: 'peer-1',
      },
    ]);

    expect(cacheManager.loadSessionList()).toEqual([
      expect.objectContaining({
        conversationId: 'peer-1',
        unreadCount: 44,
        lastMessage: expect.objectContaining({
          msgServerId: 'msg-live',
          timestamp: 200,
        }),
        lastMessageAt: 200,
      }),
    ]);
  });

  it('完整快照覆盖时应删除本地多余会话并保持排序', async () => {
    const cacheManager = new CacheManager({
      appKey: 'org#app',
      userId: 'u1',
      cacheEncryptionMode: 'off',
    });
    await cacheManager.prepare();

    cacheManager.replaceSessionList([
      {
        conversationId: 'peer-c',
        conversationType: 'singleChat',
        unreadCount: 1,
        lastMessage: null,
        lastMessageAt: 10,
        marks: [],
        remindType: 'DEFAULT',
        conversationName: 'peer-c',
      },
      {
        conversationId: 'peer-b',
        conversationType: 'singleChat',
        unreadCount: 1,
        lastMessage: null,
        lastMessageAt: 20,
        marks: [],
        remindType: 'DEFAULT',
        conversationName: 'peer-b',
      },
      {
        conversationId: 'peer-a',
        conversationType: 'singleChat',
        unreadCount: 1,
        lastMessage: null,
        lastMessageAt: 30,
        marks: [],
        remindType: 'DEFAULT',
        conversationName: 'peer-a',
      },
    ]);

    cacheManager.replaceSessionList([
      {
        conversationId: 'peer-b',
        conversationType: 'singleChat',
        unreadCount: 2,
        lastMessage: null,
        lastMessageAt: 40,
        marks: [],
        remindType: 'DEFAULT',
        conversationName: 'peer-b',
      },
      {
        conversationId: 'peer-a',
        conversationType: 'singleChat',
        unreadCount: 3,
        lastMessage: null,
        lastMessageAt: 50,
        marks: [],
        remindType: 'DEFAULT',
        conversationName: 'peer-a',
      },
    ]);

    expect(cacheManager.loadSessionList().map(item => item.conversationId)).toEqual([
      'peer-a',
      'peer-b',
    ]);
  });
});
