import { describe, expect, it } from 'vitest';

import { CacheKeyName, buildCacheKey } from '@/cache/cache-keys';
import { CacheManager } from '@/cache/cache-manager';
import { CACHE_SCHEMA_VERSION } from '@/config/cache';
import type { ConversationItem } from '@/types/conversation';

const buildConversationItem = (overrides: Partial<ConversationItem> = {}): ConversationItem => ({
  conversationId: 'peer-1',
  conversationType: 'singleChat',
  unreadCount: 1,
  lastMessage: {
    msgServerId: 'm1',
    from: 'peer-1',
    to: 'user-1',
    sender: { userId: 'peer-1' },
    conversationId: 'peer-1',
    conversationType: 'singleChat',
    type: 'text',
    timestamp: 100,
    body: { content: 'hello' },
  },
  lastMessageAt: 100,
  marks: [],
  remindType: 'DEFAULT',
  conversationName: 'peer-1',
  ...overrides,
});

describe('SessionList cache', () => {
  it('should persist and load session list items', async (): Promise<void> => {
    const cacheManager = new CacheManager({
      appKey: 'org#app',
      userId: 'user-1',
      cacheEncryptionMode: 'off',
    });
    await cacheManager.prepare();

    cacheManager.replaceSessionList([
      buildConversationItem({
        conversationId: 'u2',
        unreadCount: 2,
        lastMessage: {
          msgServerId: 'm1',
          from: 'u2',
          to: 'user-1',
          sender: { userId: 'u2' },
          timestamp: 2,
          body: { content: 'hello' },
        },
        lastMessageAt: 2,
        conversationName: 'u2',
      }),
    ]);

    const privateManager = cacheManager as unknown as { flushNow: () => Promise<void> };
    await privateManager.flushNow();

    const reloaded = new CacheManager({
      appKey: 'org#app',
      userId: 'user-1',
      cacheEncryptionMode: 'off',
    });
    await reloaded.prepare();

    expect(reloaded.loadSessionList()).toEqual([
      expect.objectContaining({
        conversationId: 'u2',
        conversationType: 'singleChat',
        unreadCount: 2,
      }),
    ]);
  });

  it('should persist modifiedInfo in lastMessage', async (): Promise<void> => {
    const cacheManager = new CacheManager({
      appKey: 'org#app',
      userId: 'user-1',
      cacheEncryptionMode: 'off',
    });
    await cacheManager.prepare();

    cacheManager.replaceSessionList([
      buildConversationItem({
        lastMessage: {
          msgServerId: 'm1',
          from: 'peer-1',
          to: 'user-1',
          sender: { userId: 'peer-1' },
          timestamp: 100,
          body: { content: 'edited' },
          modifiedInfo: {
            operatorId: 'peer-1',
            operationCount: 2,
            operationTime: 1714291200000,
          },
        },
      }),
    ]);

    const privateManager = cacheManager as unknown as { flushNow: () => Promise<void> };
    await privateManager.flushNow();

    const reloaded = new CacheManager({
      appKey: 'org#app',
      userId: 'user-1',
      cacheEncryptionMode: 'off',
    });
    await reloaded.prepare();

    expect(reloaded.loadSessionList()[0]?.lastMessage?.modifiedInfo).toEqual({
      operatorId: 'peer-1',
      operationCount: 2,
      operationTime: 1714291200000,
    });
  });

  it('should persist profile version fields in lastMessage', async (): Promise<void> => {
    const cacheManager = new CacheManager({
      appKey: 'org#app',
      userId: 'user-1',
      cacheEncryptionMode: 'off',
    });
    await cacheManager.prepare();

    cacheManager.replaceSessionList([
      buildConversationItem({
        lastMessage: {
          msgServerId: 'm1',
          from: 'peer-1',
          to: 'user-1',
          sender: { userId: 'peer-1' },
          timestamp: 100,
          body: { content: 'profile' },
          userInfoUpdateTime: 1776825600,
          namecardUpdateTime: 1776825601,
        },
      }),
    ]);

    const privateManager = cacheManager as unknown as { flushNow: () => Promise<void> };
    await privateManager.flushNow();

    const reloaded = new CacheManager({
      appKey: 'org#app',
      userId: 'user-1',
      cacheEncryptionMode: 'off',
    });
    await reloaded.prepare();

    expect(reloaded.loadSessionList()[0]?.lastMessage).toMatchObject({
      userInfoUpdateTime: 1776825600,
      namecardUpdateTime: 1776825601,
    });
  });

  it('should normalize sender object when writing session list into memory', async (): Promise<void> => {
    const cacheManager = new CacheManager({
      appKey: 'org#app',
      userId: 'user-1',
      cacheEncryptionMode: 'off',
    });
    await cacheManager.prepare();

    cacheManager.replaceSessionList([
      {
        ...buildConversationItem(),
        lastMessage: {
          msgServerId: 'm-string-sender',
          from: 'peer-1',
          to: 'user-1',
          sender: 'peer-1',
          timestamp: 123,
          body: { content: 'legacy sender shape' },
        },
      } as unknown as ConversationItem,
    ]);

    expect(cacheManager.loadSessionList()[0]?.lastMessage?.sender).toEqual({
      userId: 'peer-1',
    });
  });

  it('should persist ordered items and checkpoint in a single key', async (): Promise<void> => {
    const cacheManager = new CacheManager({
      appKey: 'org#app',
      userId: 'user-1',
      cacheEncryptionMode: 'off',
    });
    await cacheManager.prepare();

    cacheManager.replaceSessionList(
      [
        {
          conversationId: 'older',
          conversationType: 'singleChat',
          unreadCount: 1,
          lastMessage: {
            msgServerId: 'm1',
            from: 'older',
            to: 'user-1',
            sender: { userId: 'older' },
            timestamp: 1,
            body: { content: 'older' },
          },
          lastMessageAt: 1,
          marks: [],
          remindType: 'DEFAULT',
          conversationName: 'older',
        },
        {
          conversationId: 'newer',
          conversationType: 'singleChat',
          unreadCount: 2,
          lastMessage: {
            msgServerId: 'm2',
            from: 'newer',
            to: 'user-1',
            sender: { userId: 'newer' },
            timestamp: 2,
            body: { content: 'newer' },
          },
          lastMessageAt: 2,
          marks: [],
          remindType: 'DEFAULT',
          conversationName: 'newer',
        },
      ],
      {
        lastSyncTime: 11,
        lastSyncFinishedTs: 12,
        sessionsLastSyncTs: 13,
        lastSuccessfulAt: 14,
      }
    );

    const privateManager = cacheManager as unknown as { flushNow: () => Promise<void> };
    await privateManager.flushNow();

    const context = {
      appKey: 'org#app',
      userId: 'user-1',
      schemaVersion: CACHE_SCHEMA_VERSION,
    };
    const sessionListKey = buildCacheKey(context, CacheKeyName.SESSION_LIST);
    const legacyCheckpointKey = buildCacheKey(context, CacheKeyName.SESSION_LIST_CHECKPOINT);
    const raw = localStorage.getItem(sessionListKey);

    expect(raw).not.toBeNull();
    expect(JSON.parse(raw ?? 'null')).toEqual({
      items: [
        expect.objectContaining({ conversationId: 'newer' }),
        expect.objectContaining({ conversationId: 'older' }),
      ],
      checkpoint: {
        lastSyncTime: 11,
        lastSyncFinishedTs: 12,
        sessionsLastSyncTs: 13,
        lastSuccessfulAt: 14,
      },
    });
    expect(localStorage.getItem(legacyCheckpointKey)).toBeNull();
  });

  it('should ignore legacy session-list cache fields', async (): Promise<void> => {
    const context = {
      appKey: 'org#app',
      userId: 'user-legacy-fields',
      schemaVersion: CACHE_SCHEMA_VERSION,
    };
    const sessionListKey = buildCacheKey(context, CacheKeyName.SESSION_LIST);
    localStorage.setItem(
      sessionListKey,
      JSON.stringify({
        items: [
          {
            sessionId: 'legacy-session-id',
            type: 'singleChat',
            unreadCount: 1,
            lastMessage: {
              msgServerId: 'legacy-message',
              from: 'legacy-user',
              timestamp: 1,
              body: { content: 'legacy' },
            },
            display: {
              displayName: 'Legacy User',
              avatarUrl: 'https://example.com/avatar.png',
            },
            pinnedTime: 123,
            readReceipt: 456,
            remindType: 'at',
            marks: ['mark_1'],
          },
          {
            conversationId: 'strict-session-id',
            conversationType: 'singleChat',
            unreadCount: 1,
            lastMessage: {
              msgServerId: 'strict-message',
              from: 'strict-user',
              timestamp: 2,
              body: { content: 'strict' },
            },
            conversationName: '',
            remindType: 'all',
            pinnedTime: 789,
            readReceipt: 987,
          },
        ],
        checkpoint: {
          lastSyncTime: 1,
          lastSyncFinishedTs: 1,
          sessionsLastSyncTs: 1,
          lastSuccessfulAt: 1,
        },
      })
    );

    const cacheManager = new CacheManager({
      appKey: 'org#app',
      userId: 'user-legacy-fields',
      cacheEncryptionMode: 'off',
    });
    await cacheManager.prepare();

    expect(cacheManager.loadSessionList()).toEqual([
      expect.objectContaining({
        conversationId: 'strict-session-id',
        conversationType: 'singleChat',
        conversationName: 'strict-session-id',
        conversationAvatar: undefined,
        pinnedTimestamp: undefined,
        readAt: undefined,
        remindType: 'DEFAULT',
      }),
    ]);
  });

  it('should persist items immediately for non-last full batch without advancing checkpoint', async (): Promise<void> => {
    const cacheManager = new CacheManager({
      appKey: 'org#app',
      userId: 'user-batch-full',
      cacheEncryptionMode: 'off',
    });
    await cacheManager.prepare();

    await cacheManager.applySessionListBatch({
      items: [
        buildConversationItem({
          lastMessage: {
            msgServerId: 'm1',
            from: 'peer-1',
            to: 'user-batch-full',
            sender: { userId: 'peer-1' },
            timestamp: 100,
            body: { content: 'first batch' },
          },
        }),
      ],
      mode: 'full',
      isLastBatch: false,
      checkpoint: {
        lastSyncTime: 1000,
        lastSyncFinishedTs: 1000,
        sessionsLastSyncTs: 1000,
        lastSuccessfulAt: 1000,
      },
    });

    const context = {
      appKey: 'org#app',
      userId: 'user-batch-full',
      schemaVersion: CACHE_SCHEMA_VERSION,
    };
    const sessionListKey = buildCacheKey(context, CacheKeyName.SESSION_LIST);
    const raw = JSON.parse(localStorage.getItem(sessionListKey) ?? 'null') as {
      readonly items: ReadonlyArray<{ readonly conversationId: string }>;
      readonly checkpoint: {
        readonly lastSyncTime: number;
        readonly lastSyncFinishedTs: number;
        readonly sessionsLastSyncTs: number;
        readonly lastSuccessfulAt: number;
      };
    };

    expect(raw.items).toEqual([expect.objectContaining({ conversationId: 'peer-1' })]);
    expect(raw.checkpoint).toEqual({
      lastSyncTime: 0,
      lastSyncFinishedTs: 0,
      sessionsLastSyncTs: 0,
      lastSuccessfulAt: 0,
    });
  });

  it('should advance checkpoint only after last incremental batch', async (): Promise<void> => {
    const cacheManager = new CacheManager({
      appKey: 'org#app',
      userId: 'user-batch-incremental',
      cacheEncryptionMode: 'off',
    });
    await cacheManager.prepare();

    cacheManager.replaceSessionList([], {
      lastSyncTime: 10,
      lastSyncFinishedTs: 10,
      sessionsLastSyncTs: 10,
      lastSuccessfulAt: 10,
    });

    await cacheManager.applySessionListBatch({
      items: [
        buildConversationItem({
          lastMessage: {
            msgServerId: 'm1',
            from: 'peer-1',
            to: 'user-batch-incremental',
            sender: { userId: 'peer-1' },
            timestamp: 100,
            body: { content: 'incremental batch' },
          },
        }),
      ],
      mode: 'incremental',
      isLastBatch: false,
      checkpoint: {
        lastSyncTime: 20,
        lastSyncFinishedTs: 20,
        sessionsLastSyncTs: 20,
        lastSuccessfulAt: 20,
      },
    });

    expect(cacheManager.loadSessionListCheckpoint()).toEqual({
      lastSyncTime: 10,
      lastSyncFinishedTs: 10,
      sessionsLastSyncTs: 10,
      lastSuccessfulAt: 10,
    });

    await cacheManager.applySessionListBatch({
      items: [
        {
          conversationId: 'peer-1',
          conversationType: 'singleChat',
          unreadCount: 2,
          lastMessage: {
            msgServerId: 'm2',
            from: 'peer-1',
            to: 'user-batch-incremental',
            sender: { userId: 'peer-1' },
            timestamp: 200,
            body: { content: 'incremental last batch' },
          },
          lastMessageAt: 200,
          marks: [],
          remindType: 'DEFAULT',
          conversationName: 'peer-1',
        },
      ],
      mode: 'incremental',
      isLastBatch: true,
      checkpoint: {
        lastSyncTime: 20,
        lastSyncFinishedTs: 20,
        sessionsLastSyncTs: 20,
        lastSuccessfulAt: 20,
      },
    });

    expect(cacheManager.loadSessionListCheckpoint()).toEqual({
      lastSyncTime: 20,
      lastSyncFinishedTs: 20,
      sessionsLastSyncTs: 20,
      lastSuccessfulAt: 20,
    });
  });
});
