import { describe, expect, it } from 'vitest';

import type { ConversationSummary } from '@/cache/cache-types';
import { ConversationCache } from '@/cache/conversation-cache';

const createConversation = (options: {
  readonly id: string;
  readonly lastAccess: number;
  readonly lastUpdate: number;
  readonly type?: 'singleChat' | 'groupChat' | 'chatRoom';
}): ConversationSummary => {
  return {
    conversationId: options.id,
    type: options.type ?? 'singleChat',
    lastMessage: {
      msgId: `${options.id}-msg`,
      type: 'text',
      body: { text: 'hello' },
      timestamp: options.lastUpdate,
    },
    unreadCount: 0,
    marks: [],
    lastAccess: options.lastAccess,
    lastUpdate: options.lastUpdate,
  };
};

describe('ConversationCache', () => {
  it('load 应过滤非法数据并规范化默认字段', () => {
    const cache = new ConversationCache();
    const now = 200;

    cache.load(
      [
        createConversation({ id: 'c1', lastAccess: 10, lastUpdate: 100 }),
        {
          conversationId: '',
          type: 'singleChat',
          lastMessage: null,
          unreadCount: 0,
          marks: [],
          lastAccess: 0,
          lastUpdate: 0,
        } as ConversationSummary,
      ],
      now
    );

    const all = cache.getAll();
    expect(all).toHaveLength(1);
    expect(all[0]?.conversationId).toBe('c1');
  });

  it('setAll 与 updateLastAccess 应正确更新访问时间', () => {
    const cache = new ConversationCache();
    cache.setAll([
      createConversation({ id: 'c1', lastAccess: 10, lastUpdate: 100 }),
      createConversation({ id: 'c2', lastAccess: 20, lastUpdate: 110 }),
    ]);

    const changed = cache.updateLastAccess(
      [
        { conversationId: 'c1', type: 'singleChat' },
        { conversationId: 'not-found', type: 'singleChat' },
      ],
      999
    );

    expect(changed).toBe(true);
    expect(cache.getAll()[0]?.lastAccess).toBe(999);
  });

  it('removeExpired/evictByLru/trimMax 应按规则裁剪', () => {
    const cache = new ConversationCache();
    cache.setAll([
      createConversation({ id: 'c1', lastAccess: 10, lastUpdate: 10 }),
      createConversation({ id: 'c2', lastAccess: 20, lastUpdate: 20 }),
      createConversation({ id: 'c3', lastAccess: 30, lastUpdate: 30 }),
    ]);

    const removedExpired = cache.removeExpired(15, 40);
    expect(removedExpired).toBe(true);
    expect(cache.getAll().map(item => item.conversationId)).toEqual(['c3']);

    const removedLru = cache.evictByLru(1);
    expect(removedLru).toBe(true);
    expect(cache.getAll().map(item => item.conversationId)).toEqual([]);

    cache.setAll([
      createConversation({ id: 'c1', lastAccess: 10, lastUpdate: 10 }),
      createConversation({ id: 'c2', lastAccess: 20, lastUpdate: 20 }),
      createConversation({ id: 'c3', lastAccess: 30, lastUpdate: 30 }),
    ]);
    const trimmed = cache.trimMax(2);
    expect(trimmed).toBe(true);
    expect(cache.getAll()).toHaveLength(2);
  });

  it('空操作与非法消息摘要应返回默认结果', () => {
    const cache = new ConversationCache();
    const now = 500;

    cache.load(
      [
        createConversation({ id: 'valid', lastAccess: 10, lastUpdate: 100 }),
        {
          conversationId: 'bad-type',
          type: 'broadcast',
          lastMessage: null,
          unreadCount: 0,
          marks: [],
          lastAccess: 0,
          lastUpdate: 0,
        } as unknown as ConversationSummary,
        {
          conversationId: 'bad-message-shape',
          type: 'singleChat',
          lastMessage: [] as unknown as ConversationSummary['lastMessage'],
          unreadCount: 1,
          marks: [],
          lastAccess: 1,
          lastUpdate: 1,
        },
        {
          conversationId: 'missing-msgid',
          type: 'groupChat',
          lastMessage: {
            msgId: '',
            type: 'text',
            body: { text: 'x' },
            timestamp: 1,
          },
          unreadCount: 2,
          marks: [],
          lastAccess: 2,
          lastUpdate: 2,
        },
      ],
      now
    );

    expect(cache.getAll()).toHaveLength(3);
    expect(
      cache.getAll().find(item => item.conversationId === 'bad-message-shape')?.lastMessage
    ).toBeNull();
    expect(
      cache.getAll().find(item => item.conversationId === 'missing-msgid')?.lastMessage
    ).toBeNull();
    expect(cache.updateLastAccess([], now)).toBe(false);
    expect(cache.removeExpired(0, now)).toBe(false);
    expect(cache.evictByLru(0)).toBe(false);
    expect(cache.trimMax()).toBe(false);
  });

  it('应兼容旧会话类型并回填 marks', () => {
    const cache = new ConversationCache();
    cache.load(
      [
        {
          conversationId: 'legacy-1',
          type: 'single',
          lastMessage: null,
          unreadCount: 0,
          lastAccess: 1,
          lastUpdate: 1,
        } as unknown as ConversationSummary,
      ],
      10
    );

    expect(cache.getAll()[0]).toMatchObject({
      conversationId: 'legacy-1',
      type: 'singleChat',
      marks: [],
    });
  });
});
