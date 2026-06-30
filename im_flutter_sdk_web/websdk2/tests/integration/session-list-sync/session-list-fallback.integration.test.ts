import { describe, expect, it, vi } from 'vitest';

import { CacheManager } from '@/cache/cache-manager';
import { ChatClient } from '@/chat-client';
import { SessionListSyncController } from '@/core/session-list-sync/session-list-sync-controller';

describe('session-list fallback integration', () => {
  it('should fallback to cached conversation mapping when session-list sync is unconfigured', async () => {
    const cacheManager = new CacheManager({
      appKey: 'org#app',
      userId: 'u1',
      cacheEncryptionMode: 'off',
    });
    await cacheManager.prepare();
    const emitSyncDataStart = vi.fn();
    const emitSyncDataFinished = vi.fn();
    const emitConversationListUpdate = vi.fn();
    const controller = new SessionListSyncController({
      getCacheManager: () => cacheManager,
      emitSyncDataStart,
      emitSyncDataFinished,
      emitConversationListUpdate,
      getServerUrlsConfig: () => undefined,
      isSessionListDnsProbeAvailable: () => false,
      getContactSnapshot: () => null,
      getCurrentUserId: () => 'u1',
    } as unknown as ChatClient);

    expect(await controller.refresh({ includeEmpty: false })).toEqual([]);
    expect(controller.getCapabilityState()).toEqual(
      expect.objectContaining({
        status: 'unconfigured',
      })
    );
    expect(emitSyncDataStart).toHaveBeenCalledWith('conversation');
    expect(emitConversationListUpdate).toHaveBeenCalledWith('conversation', true);
    expect(emitSyncDataFinished).toHaveBeenCalledWith(
      expect.objectContaining({
        dataType: 'conversation',
        status: 'success',
      })
    );
  });

  it('should return unified ConversationItem projection when fallback uses cached conversations', async () => {
    const cacheManager = new CacheManager({
      appKey: 'org#app',
      userId: 'u1',
      cacheEncryptionMode: 'off',
    });
    await cacheManager.prepare();
    cacheManager.updateConversationsFromServer([
      {
        conversationId: 'u2',
        type: 'singleChat',
        lastMessage: {
          msgId: 'm1',
          type: 'text',
          body: { content: 'hello fallback' },
          timestamp: 100,
        },
        unreadCount: 2,
        marks: [1],
        lastAccess: 50,
        lastUpdate: 100,
      },
    ]);
    const controller = new SessionListSyncController({
      getCacheManager: () => cacheManager,
      emitSyncDataStart: vi.fn(),
      emitSyncDataFinished: vi.fn(),
      emitConversationListUpdate: vi.fn(),
      getServerUrlsConfig: () => undefined,
      isSessionListDnsProbeAvailable: () => false,
      getCurrentUserId: () => 'u1',
      getContactSnapshot: () => ({
        items: [],
        source: 'cache',
        version: 'v1',
        complete: true,
      }),
    } as unknown as ChatClient);

    // 035：即使新链路不可用，回退结果对外仍必须保持 ConversationItem 统一结构，
    // 调用方不需要因为底层来源切换而改 UI 代码。
    await expect(
      controller.refresh({ includeEmpty: false })
    ).resolves.toEqual([
      {
        conversationId: 'u2',
        conversationType: 'singleChat',
        unreadCount: 2,
        lastMessage: {
          msgServerId: 'm1',
          from: 'u2',
          to: 'u1',
          sender: { userId: 'u2' },
          conversationId: 'u2',
          conversationType: 'singleChat',
          type: 'text',
          timestamp: 100,
          body: { content: 'hello fallback' },
        },
        lastMessageAt: 100,
        isPinned: undefined,
        pinnedTimestamp: undefined,
        marks: [],
        readAt: undefined,
        remindType: 'DEFAULT',
        conversationName: 'u2',
        conversationAvatar: undefined,
      },
    ]);
  });
});
