import { afterEach, describe, expect, it, vi } from 'vitest';

import { CacheManager } from '@/cache/cache-manager';
import { ChatClient } from '@/chat-client';
import { SessionListSyncController } from '@/core/session-list-sync/session-list-sync-controller';
import * as sessionListRunner from '@/core/session-list-sync/session-list-sync-runner';
import { ChatManager } from '@/managers/chat-manager';
import type { Message } from '@/types';
import type { ConversationSummary } from '@/cache/cache-types';
import type { ConversationItem } from '@/types/conversation';
import { ERROR_CODES } from '@/utils/error-codes';
import { SDKError } from '@/utils/errors';

const SESSION_LIST_SYNC_IN_PROGRESS = 1103;

const buildIncomingGroupMessage = (): Message => {
  return {
    msgServerId: 'msg-server-group-1',
    msgLocalId: 'msg-local-group-1',
    from: '',
    to: '',
    sender: { userId: 'tst01' },
    conversationId: 'group-1',
    conversationType: 'groupChat',
    type: 'text',
    status: 'sent',
    ext: {},
    timestamp: 3000,
    body: { content: 'hello group' },
    direct: 'RECEIVE',
  };
};

const createClientStub = (options?: {
  readonly syncWsUrl?: string;
  readonly dnsProbeAvailable?: boolean;
  readonly requestError?: SDKError;
}): {
  readonly client: ChatClient;
  readonly cacheManager: CacheManager;
  readonly emitSyncDataStart: ReturnType<typeof vi.fn>;
  readonly emitSyncDataFinished: ReturnType<typeof vi.fn>;
  readonly emitConversationListUpdate: ReturnType<typeof vi.fn>;
} => {
  // 035：这里把 ChatClient 依赖裁成“只保留 session-list sync controller 真正会用到的能力”，
  // 便于聚焦验证新链路刷新、回退和事件派发语义。
  const cacheManager = new CacheManager({
    appKey: 'org#app',
    userId: 'u1',
    cacheEncryptionMode: 'off',
  });
  const emitSyncDataStart = vi.fn();
  const emitSyncDataFinished = vi.fn();
  const emitConversationListUpdate = vi.fn();
  const client = {
    getCacheManager: () => cacheManager,
    emitSyncDataStart,
    emitSyncDataFinished,
    emitConversationListUpdate,
    getRestContext: () => {
      if (options?.requestError) {
        throw options.requestError;
      }
      return {
        restBaseUrl: 'https://api.example.com',
        appKey: 'org#app',
        userId: 'u1',
        token: 'token',
        clientResource: 'web',
      };
    },
    getServerUrlsConfig: () => ({
      syncWsUrl: options?.syncWsUrl,
    }),
    isSessionListDnsProbeAvailable: () => options?.dnsProbeAvailable ?? false,
    getContactSnapshot: () => null,
  } as unknown as ChatClient;
  return { client, cacheManager, emitSyncDataStart, emitSyncDataFinished, emitConversationListUpdate };
};

const buildConversationSummary = (
  overrides: Partial<ConversationSummary> & Pick<ConversationSummary, 'conversationId'>
): ConversationSummary => {
  return {
    conversationId: overrides.conversationId,
    type: overrides.type ?? 'singleChat',
    unreadCount: overrides.unreadCount ?? 0,
    lastMessage: overrides.lastMessage ?? null,
    isPinned: overrides.isPinned,
    pinnedTime: overrides.pinnedTime,
    marks: overrides.marks ?? [],
    lastAccess: overrides.lastAccess ?? 1,
    lastUpdate: overrides.lastUpdate ?? 1,
  };
};

const buildConversationItem = (
  overrides: Partial<ConversationItem> & Pick<ConversationItem, 'conversationId'>
): ConversationItem => {
  const conversationType = overrides.conversationType ?? 'singleChat';
  const lastMessageAt = overrides.lastMessageAt ?? 100;
  const fallbackPeerId = overrides.conversationId;
  return {
    conversationId: overrides.conversationId,
    conversationType,
    unreadCount: overrides.unreadCount ?? 0,
    lastMessage:
      overrides.lastMessage === undefined
        ? {
            msgServerId: `msg-${fallbackPeerId}`,
            from: fallbackPeerId,
            to: conversationType === 'singleChat' ? 'u1' : fallbackPeerId,
            sender: { userId: fallbackPeerId },
            conversationId: overrides.conversationId,
            conversationType,
            type: 'text',
            timestamp: lastMessageAt,
            body: { content: 'hello' },
          }
        : overrides.lastMessage,
    lastMessageAt: overrides.lastMessageAt,
    isPinned: overrides.isPinned,
    pinnedTimestamp: overrides.pinnedTimestamp,
    marks: overrides.marks ?? [],
    readAt: overrides.readAt,
    remindType: overrides.remindType ?? 'DEFAULT',
    conversationName: overrides.conversationName ?? '',
    conversationAvatar: overrides.conversationAvatar,
  };
};

describe('SessionListSyncController', () => {
  afterEach((): void => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should fallback directly and mark unconfigured when sync ws is unavailable', async (): Promise<void> => {
    const { client, cacheManager, emitSyncDataStart, emitSyncDataFinished, emitConversationListUpdate } =
      createClientStub();
    await cacheManager.prepare();
    const controller = new SessionListSyncController(client);

    const sessions = await controller.refresh({ includeEmpty: false });

    expect(sessions).toEqual([]);
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

  it('should reuse same fallback decision in same login cycle after unsupported', async (): Promise<void> => {
    const { client, cacheManager } = createClientStub({
      syncWsUrl: 'wss://sync.example.com',
    });
    await cacheManager.prepare();
    const controller = new SessionListSyncController(client);
    vi.spyOn(sessionListRunner, 'runSessionListSync').mockRejectedValue(
      new SDKError('unsupported', ERROR_CODES.OPERATION_UNSUPPORTED)
    );

    await controller.refresh({ includeEmpty: false });
    const getRestContext = vi.spyOn(client, 'getRestContext');
    await controller.refresh({ includeEmpty: false });

    // 035：一旦本登录周期内已经确定服务端不支持新链路，后续 refresh 不应继续探测。
    expect(controller.getCapabilityState()).toEqual(
      expect.objectContaining({
        status: 'unsupported',
      })
    );
    expect(getRestContext).not.toHaveBeenCalled();
  });

  it('should reuse in-flight refresh promise', async (): Promise<void> => {
    const { client, cacheManager } = createClientStub({
      syncWsUrl: 'wss://sync.example.com',
    });
    await cacheManager.prepare();
    vi.spyOn(sessionListRunner, 'runSessionListSync').mockImplementation(
      async (): Promise<{
        readonly items: ReadonlyArray<never>;
        readonly lastSyncFinishedTs: number;
      }> => {
        return await new Promise(resolve => {
          setTimeout(() => resolve({ items: [], lastSyncFinishedTs: 0 }), 10);
        });
      }
    );
    const controller = new SessionListSyncController(client);
    const promiseA = controller.refresh({ includeEmpty: false });
    const promiseB = controller.refresh({ includeEmpty: false });

    // 035：重复调用主动刷新时要复用同一个在途任务，避免重复建链和重复 start 事件。
    expect(promiseA).toBe(promiseB);
    await Promise.all([promiseA, promiseB]);
  });

  it('should retry rate limit error and keep capability unknown when retries exhaust', async (): Promise<void> => {
    const { client, cacheManager } = createClientStub({
      syncWsUrl: 'wss://sync.example.com',
    });
    await cacheManager.prepare();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    vi.useFakeTimers();
    const controller = new SessionListSyncController(client);
    const runnerSpy = vi
      .spyOn(sessionListRunner, 'runSessionListSync')
      .mockRejectedValue(new SDKError('rate limit', ERROR_CODES.SERVER_BUSY));

    const promise = controller.refresh({ includeEmpty: false });
    await vi.runAllTimersAsync();
    await promise;

    expect(controller.getCapabilityState()).toEqual({
      status: 'unknown',
    });
    expect(runnerSpy).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it('should retry sync in progress error and keep capability unknown when retries exhaust', async (): Promise<void> => {
    const { client, cacheManager } = createClientStub({
      syncWsUrl: 'wss://sync.example.com',
    });
    await cacheManager.prepare();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    vi.useFakeTimers();
    const controller = new SessionListSyncController(client);
    const runnerSpy = vi
      .spyOn(sessionListRunner, 'runSessionListSync')
      .mockRejectedValue(new SDKError('sync in progress', SESSION_LIST_SYNC_IN_PROGRESS));

    const promise = controller.refresh({ includeEmpty: false });
    await vi.runAllTimersAsync();
    await promise;

    expect(controller.getCapabilityState()).toEqual({
      status: 'unknown',
    });
    expect(runnerSpy).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it('should retry rate limit once and finish successfully without duplicate start or finish', async (): Promise<void> => {
    const { client, cacheManager, emitSyncDataStart, emitSyncDataFinished } = createClientStub({
      syncWsUrl: 'wss://sync.example.com',
    });
    await cacheManager.prepare();
    vi.spyOn(Math, 'random').mockReturnValue(0);
    vi.useFakeTimers();
    const controller = new SessionListSyncController(client);
    const runnerSpy = vi
      .spyOn(sessionListRunner, 'runSessionListSync')
      .mockRejectedValueOnce(new SDKError('rate limit', ERROR_CODES.SERVER_BUSY))
      .mockResolvedValueOnce({
        items: [
          buildConversationItem({
            conversationId: 'peer-retry',
            unreadCount: 1,
            lastMessage: null,
          }),
        ],
        lastSyncFinishedTs: 100,
      });

    const promise = controller.refresh({ includeEmpty: false });
    await vi.runAllTimersAsync();
    const sessions = await promise;

    expect(runnerSpy).toHaveBeenCalledTimes(2);
    expect(sessions).toEqual([
      expect.objectContaining({
        conversationId: 'peer-retry',
      }),
    ]);
    expect(
      emitSyncDataStart.mock.calls.filter(call => call[0] === 'conversation')
    ).toHaveLength(1);
    expect(
      emitSyncDataFinished.mock.calls.filter(call => call[0]?.dataType === 'conversation')
    ).toHaveLength(1);
    vi.useRealTimers();
  });

  it('should fallback on invalid token without marking capability unsupported', async (): Promise<void> => {
    const { client, cacheManager } = createClientStub({
      syncWsUrl: 'wss://sync.example.com',
    });
    await cacheManager.prepare();
    cacheManager.updateConversationsFromServer([
      buildConversationSummary({
        conversationId: 'peer-token',
        type: 'singleChat',
        unreadCount: 1,
        lastMessage: null,
      }),
    ]);
    const controller = new SessionListSyncController(client);
    vi.spyOn(sessionListRunner, 'runSessionListSync').mockRejectedValue(
      new SDKError('token expired', ERROR_CODES.AUTH_TOKEN_EXPIRED)
    );

    const sessions = await controller.refresh({ includeEmpty: false });

    expect(controller.getCapabilityState()).toEqual({
      status: 'unknown',
    });
    expect(sessions).toEqual([
      expect.objectContaining({
        conversationId: 'peer-token',
        conversationType: 'singleChat',
      }),
    ]);
  });

  it('should fallback on kicked without marking capability unsupported', async (): Promise<void> => {
    const { client, cacheManager } = createClientStub({
      syncWsUrl: 'wss://sync.example.com',
    });
    await cacheManager.prepare();
    cacheManager.updateConversationsFromServer([
      buildConversationSummary({
        conversationId: 'peer-kicked',
        type: 'singleChat',
        unreadCount: 1,
        lastMessage: null,
      }),
    ]);
    const controller = new SessionListSyncController(client);
    vi.spyOn(sessionListRunner, 'runSessionListSync').mockRejectedValue(
      new SDKError('kicked', ERROR_CODES.AUTH_BIND_ANOTHER_DEVICE)
    );

    const sessions = await controller.refresh({ includeEmpty: false });

    expect(controller.getCapabilityState()).toEqual({
      status: 'unknown',
    });
    expect(sessions).toEqual([
      expect.objectContaining({
        conversationId: 'peer-kicked',
        conversationType: 'singleChat',
      }),
    ]);
  });

  it('should reset checkpoint on data version mismatch style error', async (): Promise<void> => {
    const { client, cacheManager } = createClientStub({
      syncWsUrl: 'wss://sync.example.com',
    });
    await cacheManager.prepare();
    cacheManager.replaceSessionList([], {
      lastSyncTime: 1,
      lastSyncFinishedTs: 2,
      sessionsLastSyncTs: 3,
      lastSuccessfulAt: 4,
    });
    const controller = new SessionListSyncController(client);
    vi.spyOn(sessionListRunner, 'runSessionListSync').mockRejectedValue(
      new SDKError('data version mismatch', ERROR_CODES.CONTACT_SYNC_CURSOR_INVALID)
    );

    await controller.refresh({ includeEmpty: false });

    expect(cacheManager.loadSessionListCheckpoint()).toEqual({
      lastSyncTime: 0,
      lastSyncFinishedTs: 0,
      sessionsLastSyncTs: 0,
      lastSuccessfulAt: 0,
    });
  });

  it('successful refresh should sync conversation cache and emit serverSync update', async (): Promise<void> => {
    const { client, cacheManager, emitSyncDataFinished } = createClientStub({
      syncWsUrl: 'wss://sync.example.com',
    });
    await cacheManager.prepare();
    cacheManager.replaceSessionList([]);
    cacheManager.updateConversationsFromServer([
      buildConversationSummary({
        conversationId: 'peer-1',
        type: 'singleChat',
        unreadCount: 1,
        lastMessage: {
          msgId: 'old-msg',
          type: 'text',
          body: { content: 'old' },
          timestamp: 1,
        },
      }),
    ]);
    const serverItems: ReadonlyArray<ConversationItem> = [
      buildConversationItem({
        conversationId: 'peer-1',
        conversationType: 'singleChat',
        unreadCount: 45,
        lastMessage: {
          msgServerId: 'server-msg',
          from: 'peer-1',
          to: 'u1',
          sender: { userId: 'peer-1' },
          timestamp: 100,
          body: { content: 'latest' },
        },
        lastMessageAt: 100,
      }),
    ];
    const runnerSpy = vi.spyOn(sessionListRunner, 'runSessionListSync').mockResolvedValue({
      items: serverItems,
      lastSyncFinishedTs: 101,
    });
    const controller = new SessionListSyncController(client);

    const sessions = await controller.refresh({ includeEmpty: false });
    expect(runnerSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        params: {
          includeEmpty: false,
          includeMark: true,
        },
      })
    );

    // 035：成功快照不仅要刷新新的 ConversationItem，还要把旧 conversation 真相一并推进，
    // 这样旧 UI 与新 UI 才会使用同一份服务端基线。
    expect(sessions).toEqual([
      expect.objectContaining({
        conversationId: 'peer-1',
        conversationType: 'singleChat',
        unreadCount: 45,
      }),
    ]);
    expect(cacheManager.loadConversationSummaries()).toEqual([
      expect.objectContaining({
        conversationId: 'peer-1',
        type: 'singleChat',
        unreadCount: 45,
        lastMessage: expect.objectContaining({
          msgId: 'server-msg',
          timestamp: 100,
        }),
      }),
    ]);
    expect(emitSyncDataFinished).toHaveBeenCalledWith(
      expect.objectContaining({
        dataType: 'conversation',
        status: 'success',
      })
    );
  });

  it('successful refresh should preserve realtime-only group session patched during sync window', async (): Promise<void> => {
    const { client, cacheManager } = createClientStub({
      syncWsUrl: 'wss://sync.example.com',
    });
    await cacheManager.prepare();
    let resolveServerItems:
      | ((value: {
          readonly items: ReadonlyArray<ConversationItem>;
          readonly lastSyncFinishedTs: number;
        }) => void)
      | undefined;
    vi.spyOn(sessionListRunner, 'runSessionListSync').mockImplementation(
      async (): Promise<{
        readonly items: ReadonlyArray<ConversationItem>;
        readonly lastSyncFinishedTs: number;
      }> =>
        await new Promise(resolve => {
          resolveServerItems = resolve;
        })
    );
    const controller = new SessionListSyncController(client);

    const refreshPromise = controller.refresh({ includeEmpty: false });
    await Promise.resolve();

    const incomingGroupMessage = buildIncomingGroupMessage();
    cacheManager.applyIncomingMessageToConversations(incomingGroupMessage);
    cacheManager.applyIncomingMessageToSessionList(incomingGroupMessage);

    expect(resolveServerItems).toBeTypeOf('function');
    resolveServerItems?.({
      items: [
        buildConversationItem({
          conversationId: 'peer-1',
          conversationType: 'singleChat',
          unreadCount: 1,
          lastMessage: {
            msgServerId: 'server-snapshot-msg',
            from: 'peer-1',
            to: 'u1',
            sender: { userId: 'peer-1' },
            timestamp: 100,
            body: { content: 'snapshot' },
          },
          lastMessageAt: 100,
        }),
      ],
      lastSyncFinishedTs: 101,
    });

    const sessions = await refreshPromise;

    expect(sessions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          conversationId: 'group-1',
          conversationType: 'groupChat',
          unreadCount: 1,
          lastMessage: expect.objectContaining({
            msgServerId: 'msg-server-group-1',
            timestamp: 3000,
          }),
        }),
        expect.objectContaining({
          conversationId: 'peer-1',
          conversationType: 'singleChat',
        }),
      ])
    );
    expect(cacheManager.loadConversationSummaries()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          conversationId: 'group-1',
          type: 'groupChat',
          unreadCount: 1,
          lastMessage: expect.objectContaining({
            msgId: 'msg-server-group-1',
            timestamp: 3000,
          }),
        }),
      ])
    );
  });

  it('incremental refresh should merge returned sessions instead of replacing cached session list', async (): Promise<void> => {
    const { client, cacheManager } = createClientStub({
      syncWsUrl: 'wss://sync.example.com',
    });
    await cacheManager.prepare();
    cacheManager.replaceSessionList(
      [
        buildConversationItem({
          conversationId: 'peer-1',
          conversationType: 'singleChat',
          unreadCount: 1,
          lastMessage: {
            msgServerId: 'msg-1',
            from: 'peer-1',
            to: 'u1',
            sender: { userId: 'peer-1' },
            timestamp: 100,
            body: { content: 'one' },
          },
          lastMessageAt: 100,
        }),
        buildConversationItem({
          conversationId: 'peer-2',
          conversationType: 'singleChat',
          unreadCount: 2,
          lastMessage: {
            msgServerId: 'msg-2',
            from: 'peer-2',
            to: 'u1',
            sender: { userId: 'peer-2' },
            timestamp: 200,
            body: { content: 'two' },
          },
          lastMessageAt: 200,
        }),
      ],
      {
        lastSyncTime: 10,
        lastSyncFinishedTs: 10,
        sessionsLastSyncTs: 10,
        lastSuccessfulAt: 10,
      }
    );
    const controller = new SessionListSyncController(client);
    vi.spyOn(sessionListRunner, 'runSessionListSync').mockResolvedValue({
      items: [
        buildConversationItem({
          conversationId: 'peer-1',
          conversationType: 'singleChat',
          unreadCount: 9,
          lastMessage: {
            msgServerId: 'msg-1-new',
            from: 'peer-1',
            to: 'u1',
            sender: { userId: 'peer-1' },
            timestamp: 300,
            body: { content: 'one newer' },
          },
          lastMessageAt: 300,
        }),
      ],
      lastSyncFinishedTs: 20,
    });

    const sessions = await controller.refresh({ includeEmpty: false });

    expect(sessions).toEqual([
      expect.objectContaining({
        conversationId: 'peer-1',
        unreadCount: 9,
        lastMessage: expect.objectContaining({
          msgServerId: 'msg-1-new',
          timestamp: 300,
        }),
      }),
      expect.objectContaining({
        conversationId: 'peer-2',
        unreadCount: 2,
      }),
    ]);
    expect(cacheManager.loadSessionListCheckpoint()).toEqual({
      lastSyncTime: 20,
      lastSyncFinishedTs: 20,
      sessionsLastSyncTs: 20,
      lastSuccessfulAt: expect.any(Number),
    });
  });

  it('incremental refresh should replace local pinned set with pinned sessions returned by server', async (): Promise<void> => {
    const { client, cacheManager } = createClientStub({
      syncWsUrl: 'wss://sync.example.com',
    });
    await cacheManager.prepare();
    cacheManager.replaceSessionList(
      [
        buildConversationItem({
          conversationId: 'pinned-local-old',
          conversationType: 'singleChat',
          unreadCount: 1,
          lastMessage: null,
          lastMessageAt: 500,
          isPinned: true,
          pinnedTimestamp: 500,
        }),
        buildConversationItem({
          conversationId: 'normal-local',
          conversationType: 'singleChat',
          unreadCount: 2,
          lastMessage: null,
          lastMessageAt: 200,
        }),
      ],
      {
        lastSyncTime: 10,
        lastSyncFinishedTs: 10,
        sessionsLastSyncTs: 10,
        lastSuccessfulAt: 10,
      }
    );
    const controller = new SessionListSyncController(client);
    vi.spyOn(sessionListRunner, 'runSessionListSync').mockResolvedValue({
      items: [
        buildConversationItem({
          conversationId: 'pinned-server-new',
          conversationType: 'singleChat',
          unreadCount: 8,
          lastMessage: null,
          lastMessageAt: 800,
          isPinned: true,
          pinnedTimestamp: 800,
        }),
      ],
      lastSyncFinishedTs: 20,
    });

    const sessions = await controller.refresh({ includeEmpty: false });

    expect(sessions.map(item => item.conversationId)).toEqual([
      'pinned-server-new',
      'normal-local',
    ]);
    expect(sessions.find(item => item.conversationId === 'pinned-local-old')).toBeUndefined();
  });

  it('refresh should return normalized sender object even when sync runner yields legacy sender string', async (): Promise<void> => {
    const { client, cacheManager } = createClientStub({
      syncWsUrl: 'wss://sync.example.com',
      dnsProbeAvailable: true,
    });
    await cacheManager.prepare();
    const controller = new SessionListSyncController(client);
    vi.spyOn(sessionListRunner, 'runSessionListSync').mockResolvedValue({
      items: [
        {
          ...buildConversationItem({
            conversationId: 'peer-legacy',
            conversationType: 'singleChat',
            unreadCount: 1,
            lastMessage: {
              msgServerId: 'msg-legacy',
              from: 'peer-legacy',
              to: 'u1',
              sender: 'peer-legacy',
              timestamp: 100,
              body: { content: 'legacy sender shape' },
            } as unknown as ConversationItem['lastMessage'],
          }),
        } as unknown as ConversationItem,
      ],
      lastSyncFinishedTs: 20,
    });

    const sessions = await controller.refresh({ includeEmpty: false });
    const legacySession = sessions.find(item => item.conversationId === 'peer-legacy');

    expect(legacySession?.lastMessage?.sender).toEqual({
      userId: 'peer-legacy',
    });
  });

  it('refreshSessionList should be delegated by ChatManager', async (): Promise<void> => {
    const client = ChatClient.init({ appKey: 'app-key' });
    const manager = new ChatManager();
    const sessions = [
      buildConversationItem({
        conversationId: 'u1',
        unreadCount: 0,
        lastMessage: null,
      }),
    ];
    const refreshSessionList = vi.fn().mockResolvedValue(sessions);

    manager.bind({
      ...client,
      refreshSessionList,
    } as unknown as ChatClient);

    await expect(manager.refreshSessionList()).resolves.toEqual(sessions);
    expect(refreshSessionList).toHaveBeenCalledTimes(1);
  });

  it('ChatManager refreshSessionList should preserve same promise identity from client', (): void => {
    const client = ChatClient.init({ appKey: 'app-key' });
    const manager = new ChatManager();
    const sessions = [
      buildConversationItem({
        conversationId: 'u1',
        unreadCount: 0,
        lastMessage: null,
      }),
    ];
    const promise = Promise.resolve(sessions);
    const refreshSessionList = vi.fn().mockReturnValue(promise);

    manager.bind({
      ...client,
      refreshSessionList,
    } as unknown as ChatClient);

    const first = manager.refreshSessionList();
    const second = manager.refreshSessionList();

    expect(first).toBe(second);
  });
});
