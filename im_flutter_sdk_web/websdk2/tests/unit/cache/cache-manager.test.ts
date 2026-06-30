import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  ConversationSummary,
  GroupNamecardCacheRecord,
  SessionListStorageRecord,
  UserInfoSummary,
} from '@/cache/cache-types';
import { CacheKeyName, buildCacheKey } from '@/cache/cache-keys';
import { CacheManager } from '@/cache/cache-manager';
import { CACHE_SCHEMA_VERSION } from '@/config/cache';
import { setMessageProfileVersionSidecar } from '@/core/message/profile-sync/profile-version-sidecar';
import type { Message } from '@/types';
import type { ConversationMark } from '@/types/conversation';

const APP_KEY = 'org#app';
const USER_ID = 'user-1';
const storage = window.localStorage;

const createConversation = (options: {
  readonly id: string;
  readonly lastAccess: number;
  readonly lastUpdate: number;
  readonly unreadCount?: number;
  readonly marks?: ReadonlyArray<ConversationMark>;
}): ConversationSummary => {
  return {
    conversationId: options.id,
    type: 'singleChat',
    lastMessage: {
      msgId: `msg-${options.id}`,
      type: 'text',
      body: { content: 'hello' },
      timestamp: options.lastUpdate,
    },
    unreadCount: options.unreadCount ?? 0,
    marks: options.marks ?? [],
    lastAccess: options.lastAccess,
    lastUpdate: options.lastUpdate,
  };
};

const createUserInfo = (options: {
  readonly userId: string;
  readonly lastAccess: number;
  readonly lastUpdate: number;
}): UserInfoSummary => {
  return {
    userId: options.userId,
    nickname: `nick-${options.userId}`,
    avatarUrl: `https://cdn.example.com/${options.userId}.png`,
    lastAccess: options.lastAccess,
    lastUpdate: options.lastUpdate,
  };
};

const createGroupNamecard = (options: {
  readonly userId: string;
  readonly lastAccess: number;
  readonly lastUpdate: number;
}): GroupNamecardCacheRecord => {
  return {
    groupId: 'g1',
    userId: options.userId,
    namecard: `card-${options.userId}`,
    lastAccess: options.lastAccess,
    lastUpdate: options.lastUpdate,
  };
};

const buildKeys = (): {
  readonly conversationKey: string;
  readonly userInfoKey: string;
  readonly sessionListKey: string;
  readonly sessionListCheckpointKey: string;
  readonly contactRelationKey: string;
  readonly contactVersionKey: string;
  readonly contactMetaKey: string;
} => {
  const context = {
    appKey: APP_KEY,
    userId: USER_ID,
    schemaVersion: CACHE_SCHEMA_VERSION,
  };
  return {
    conversationKey: buildCacheKey(context, CacheKeyName.CONVERSATIONS),
    userInfoKey: buildCacheKey(context, CacheKeyName.USER_INFO),
    sessionListKey: buildCacheKey(context, CacheKeyName.SESSION_LIST),
    sessionListCheckpointKey: buildCacheKey(context, CacheKeyName.SESSION_LIST_CHECKPOINT),
    contactRelationKey: buildCacheKey(context, CacheKeyName.CONTACT_RELATIONS),
    contactVersionKey: buildCacheKey(context, CacheKeyName.CONTACT_VERSION),
    contactMetaKey: buildCacheKey(context, CacheKeyName.CONTACT_META),
  };
};

const seedContactCache = async (cacheManager: CacheManager): Promise<void> => {
  await cacheManager.prepare();
  cacheManager.applyContactSync({
    mode: 'full',
    relations: [
      {
        userId: 'u1',
        remark: 'old-remark',
        sign: 'hello',
        addTs: 10,
        updatedAt: 20,
        metadataUpdatedAt: 30,
      },
    ],
    userInfos: [
      {
        userId: 'u1',
        nickname: 'nick-u1',
        avatarUrl: 'https://cdn.example.com/u1.png',
      },
    ],
    version: 'v1',
    lastSyncTs: 123,
  });
};

const clearLocalStorage = (): void => {
  for (let index = storage.length - 1; index >= 0; index -= 1) {
    const key = storage.key(index);
    if (!key) {
      continue;
    }
    storage.removeItem(key);
  }
};

describe('CacheManager', () => {
  beforeEach((): void => {
    clearLocalStorage();
    vi.restoreAllMocks();
  });

  it('prepare 应加载缓存并返回配置', async () => {
    const { conversationKey, userInfoKey } = buildKeys();

    storage.setItem(
      conversationKey,
      JSON.stringify({
        items: [
          createConversation({ id: 'c1', lastAccess: 1, lastUpdate: 10 }),
          {
            conversationId: '',
            conversationType: 'singleChat',
            lastMessage: null,
            unreadCount: 0,
            marks: [],
            lastAccess: 0,
            lastUpdate: 0,
          },
        ],
      })
    );
    storage.setItem(
      userInfoKey,
      JSON.stringify({
        items: [createUserInfo({ userId: 'u1', lastAccess: 2, lastUpdate: 20 })],
      })
    );

    const cacheManager = new CacheManager({
      appKey: APP_KEY,
      userId: USER_ID,
      cacheEncryptionMode: 'off',
      config: { maxConversations: 2, ttlSeconds: 60 },
    });
    await cacheManager.prepare();

    expect(cacheManager.getConfig().maxConversations).toBe(2);
    expect(cacheManager.loadConversationSummaries()).toHaveLength(1);
    expect(cacheManager.loadUserInfoSummaries()).toHaveLength(1);
  });

  it('prepare 应兼容旧双 key session-list 缓存并加载 checkpoint', async () => {
    const { sessionListKey, sessionListCheckpointKey } = buildKeys();
    storage.setItem(
      sessionListKey,
      JSON.stringify({
        items: [
          {
            conversationId: 's1',
            conversationType: 'singleChat',
            unreadCount: 3,
            lastMessage: {
              msgServerId: 'm1',
              from: 's1',
              to: USER_ID,
              sender: { userId: 's1' },
              timestamp: 100,
              body: { content: 'hello' },
            },
            lastMessageAt: 100,
            marks: [],
            remindType: 'DEFAULT',
            conversationName: 's1',
            updatedAt: 100,
          },
        ],
      } satisfies SessionListStorageRecord)
    );
    storage.setItem(
      sessionListCheckpointKey,
      JSON.stringify({
        lastSyncTime: 1,
        lastSyncFinishedTs: 2,
        sessionsLastSyncTs: 3,
        lastSuccessfulAt: 4,
      })
    );

    const cacheManager = new CacheManager({
      appKey: APP_KEY,
      userId: USER_ID,
      cacheEncryptionMode: 'off',
    });
    await cacheManager.prepare();

    expect(cacheManager.loadSessionList()).toEqual([
      expect.objectContaining({
        conversationId: 's1',
        unreadCount: 3,
      }),
    ]);
    expect(cacheManager.loadSessionListCheckpoint()).toEqual({
      lastSyncTime: 1,
      lastSyncFinishedTs: 2,
      sessionsLastSyncTs: 3,
      lastSuccessfulAt: 4,
    });
  });

  it('updateConversationsFromServer 应保留 lastAccess 并返回 changed', async () => {
    const { conversationKey } = buildKeys();
    storage.setItem(
      conversationKey,
      JSON.stringify({
        items: [createConversation({ id: 'c1', lastAccess: 7, lastUpdate: 100, unreadCount: 0 })],
      })
    );

    const cacheManager = new CacheManager({
      appKey: APP_KEY,
      userId: USER_ID,
      cacheEncryptionMode: 'off',
    });
    await cacheManager.prepare();

    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(999);
    const unchanged = cacheManager.updateConversationsFromServer([
      createConversation({ id: 'c1', lastAccess: 0, lastUpdate: 100, unreadCount: 0 }),
    ]);
    expect(unchanged.changed).toBe(false);
    expect(unchanged.items[0]?.lastAccess).toBe(7);

    const changed = cacheManager.updateConversationsFromServer([
      createConversation({ id: 'c1', lastAccess: 0, lastUpdate: 100, unreadCount: 2, marks: [1] }),
    ]);
    expect(changed.changed).toBe(true);
    nowSpy.mockRestore();
  });

  it('refreshSessionListDisplayFromUserInfos 应按联系人资料刷新单聊展示字段', async () => {
    const cacheManager = new CacheManager({
      appKey: APP_KEY,
      userId: USER_ID,
      cacheEncryptionMode: 'off',
    });
    await cacheManager.prepare();

    cacheManager.replaceSessionList([
      {
        conversationId: 'u1',
        conversationType: 'singleChat',
        unreadCount: 0,
        lastMessage: {
          msgServerId: 'm1',
          from: 'u1',
          to: USER_ID,
          sender: {
            userId: 'u1',
            nickname: 'old-nick',
            avatarUrl: 'https://cdn.example.com/old.png',
          },
          timestamp: 100,
          body: { content: 'hello' },
        },
        marks: [],
        remindType: 'DEFAULT',
        conversationName: 'old-name',
        conversationAvatar: 'https://cdn.example.com/old.png',
      },
      {
        conversationId: 'g1',
        conversationType: 'groupChat',
        unreadCount: 0,
        lastMessage: {
          msgServerId: 'm2',
          from: 'u1',
          to: 'g1',
          sender: {
            userId: 'u1',
            nickname: 'old-nick',
            avatarUrl: 'https://cdn.example.com/old.png',
          },
          timestamp: 101,
          body: { content: 'group hello' },
        },
        marks: [],
        remindType: 'DEFAULT',
        conversationName: 'old-group',
        conversationAvatar: 'https://cdn.example.com/old-group.png',
      },
    ]);

    cacheManager.applyContactSync({
      mode: 'full',
      relations: [
        {
          userId: 'u1',
          remark: 'new-remark',
          sign: 'hello',
          addTs: 10,
          updatedAt: 20,
          metadataUpdatedAt: 30,
        },
      ],
      userInfos: [
        {
          userId: 'u1',
          nickname: 'new-nick',
          avatarUrl: 'https://cdn.example.com/new.png',
        },
      ],
      version: 'v2',
      lastSyncTs: 456,
    });

    const result = cacheManager.refreshSessionListDisplayFromUserInfos([{ userId: 'u1' }]);

    expect(result.changed).toBe(true);
    const refreshedItems = cacheManager.loadSessionList();
    expect(refreshedItems.find(item => item.conversationId === 'u1')).toMatchObject({
      conversationId: 'u1',
      conversationName: 'new-remark',
      conversationAvatar: 'https://cdn.example.com/new.png',
      lastMessage: {
        sender: {
          userId: 'u1',
          nickname: 'new-remark',
          avatarUrl: 'https://cdn.example.com/new.png',
        },
      },
    });
    expect(refreshedItems.find(item => item.conversationId === 'g1')).toMatchObject({
      conversationId: 'g1',
      conversationName: 'old-group',
      conversationAvatar: 'https://cdn.example.com/old-group.png',
      lastMessage: {
        sender: {
          userId: 'u1',
          nickname: 'new-remark',
          avatarUrl: 'https://cdn.example.com/new.png',
        },
      },
    });
  });

  it('refreshSessionListDisplayFromJoinedGroups 应刷新群会话名称头像和免打扰', async () => {
    const cacheManager = new CacheManager({
      appKey: APP_KEY,
      userId: USER_ID,
      cacheEncryptionMode: 'off',
    });
    await cacheManager.prepare();

    cacheManager.replaceSessionList([
      {
        conversationId: 'g1',
        conversationType: 'groupChat',
        unreadCount: 0,
        lastMessage: null,
        lastMessageAt: 100,
        marks: [],
        remindType: 'DEFAULT',
        conversationName: 'Old Group',
        conversationAvatar: 'https://cdn.example.com/old.png',
      },
      {
        conversationId: 'u1',
        conversationType: 'singleChat',
        unreadCount: 0,
        lastMessage: null,
        lastMessageAt: 99,
        marks: [],
        remindType: 'DEFAULT',
        conversationName: 'User 1',
      },
    ]);

    const result = cacheManager.refreshSessionListDisplayFromJoinedGroups([
      {
        groupId: 'g1',
        name: 'New Group',
        avatarUrl: 'https://cdn.example.com/new.png',
        remindType: 'AT',
      },
      {
        groupId: 'missing',
        name: 'Missing Group',
        remindType: 'NONE',
      },
    ]);

    expect(result.changed).toBe(true);
    expect(cacheManager.loadSessionList()).toEqual([
      expect.objectContaining({
        conversationId: 'g1',
        conversationType: 'groupChat',
        conversationName: 'New Group',
        conversationAvatar: 'https://cdn.example.com/new.png',
        remindType: 'AT',
      }),
      expect.objectContaining({
        conversationId: 'u1',
        conversationType: 'singleChat',
        conversationName: 'User 1',
        remindType: 'DEFAULT',
      }),
    ]);

    const unchanged = cacheManager.refreshSessionListDisplayFromJoinedGroups([
      {
        groupId: 'g1',
        name: 'New Group',
        avatarUrl: 'https://cdn.example.com/new.png',
        remindType: 'AT',
      },
    ]);
    expect(unchanged.changed).toBe(false);
  });

  it('refreshSessionListDisplayFromUserInfos 应按订阅用户资料刷新最后消息发送者', async () => {
    const cacheManager = new CacheManager({
      appKey: APP_KEY,
      userId: USER_ID,
      cacheEncryptionMode: 'off',
    });
    await cacheManager.prepare();

    cacheManager.replaceSessionList([
      {
        conversationId: 'group-1',
        conversationType: 'groupChat',
        unreadCount: 0,
        lastMessage: {
          msgServerId: 'm1',
          from: 'bob',
          to: 'group-1',
          sender: {
            userId: 'bob',
            nickname: 'Bob Old',
            avatarUrl: 'https://cdn.example.com/bob-old.png',
          },
          timestamp: 100,
          body: { content: 'hello' },
        },
        marks: [],
        remindType: 'DEFAULT',
        conversationName: 'Group Old',
        conversationAvatar: 'https://cdn.example.com/group-old.png',
      },
    ]);
    cacheManager.upsertRuntimeUserInfos([
      {
        profile: {
          userId: 'bob',
          nickname: 'Bob New',
          avatarUrl: 'https://cdn.example.com/bob-new.png',
        },
        lastModified: 30,
        source: 'subscription_notify',
      },
    ]);
    cacheManager.setUserInfoSummaries([
      {
        userId: 'bob',
        nickname: 'Bob New',
        avatarUrl: 'https://cdn.example.com/bob-new.png',
        lastAccess: 1,
        lastUpdate: 30,
      },
    ]);

    const result = cacheManager.refreshSessionListDisplayFromUserInfos([
      { userId: 'bob', lastModified: 30 },
    ]);

    expect(result.changed).toBe(true);
    expect(cacheManager.loadSessionList()[0]).toMatchObject({
      conversationId: 'group-1',
      conversationName: 'Group Old',
      conversationAvatar: 'https://cdn.example.com/group-old.png',
      lastMessage: {
        sender: {
          userId: 'bob',
          nickname: 'Bob New',
          avatarUrl: 'https://cdn.example.com/bob-new.png',
        },
      },
    });
  });

  it('replaceSessionList 应立即用本地资料补全最后消息发送者', async () => {
    const cacheManager = new CacheManager({
      appKey: APP_KEY,
      userId: USER_ID,
      cacheEncryptionMode: 'off',
    });
    await cacheManager.prepare();

    cacheManager.applyContactSync({
      mode: 'full',
      relations: [
        {
          userId: 'u1',
          remark: 'contact-remark',
          sign: 'hello',
          addTs: 10,
          updatedAt: 20,
          metadataUpdatedAt: 30,
        },
      ],
      userInfos: [
        {
          userId: 'u1',
          nickname: 'contact-nick',
          avatarUrl: 'https://cdn.example.com/contact.png',
        },
      ],
      version: 'v2',
      lastSyncTs: 456,
    });
    cacheManager.setUserInfoSummaries([
      {
        userId: USER_ID,
        nickname: 'self-nick',
        avatarUrl: 'https://cdn.example.com/self.png',
        lastAccess: 1,
        lastUpdate: 30,
      },
    ]);

    cacheManager.replaceSessionList([
      {
        conversationId: 'u1',
        conversationType: 'singleChat',
        unreadCount: 0,
        lastMessage: {
          msgServerId: 'single-msg',
          from: 'u1',
          to: USER_ID,
          sender: { userId: 'u1' },
          timestamp: 100,
          body: { content: 'single hello' },
        },
        lastMessageAt: 100,
        marks: [],
        remindType: 'DEFAULT',
        conversationName: 'contact-remark',
        conversationAvatar: 'https://cdn.example.com/contact.png',
      },
      {
        conversationId: 'group-1',
        conversationType: 'groupChat',
        unreadCount: 0,
        lastMessage: {
          msgServerId: 'group-msg',
          from: USER_ID,
          to: 'group-1',
          sender: { userId: USER_ID },
          timestamp: 101,
          body: { content: 'group hello' },
        },
        lastMessageAt: 101,
        marks: [],
        remindType: 'DEFAULT',
        conversationName: 'group-1',
      },
    ]);

    const items = cacheManager.loadSessionList();
    expect(items.find(item => item.conversationId === 'u1')?.lastMessage?.sender).toEqual({
      userId: 'u1',
      nickname: 'contact-remark',
      avatarUrl: 'https://cdn.example.com/contact.png',
    });
    expect(items.find(item => item.conversationId === 'group-1')?.lastMessage?.sender).toEqual({
      userId: USER_ID,
      nickname: 'self-nick',
      avatarUrl: 'https://cdn.example.com/self.png',
    });
  });

  it('applyIncomingMessageToConversations 应把消息资料版本投影到会话摘要最后一条消息', async () => {
    const cacheManager = new CacheManager({
      appKey: APP_KEY,
      userId: USER_ID,
      cacheEncryptionMode: 'off',
    });
    await cacheManager.prepare();

    const message: Message = {
      msgServerId: 'server-1',
      msgLocalId: 'local-1',
      from: '',
      to: '',
      sender: { userId: 'tst01' },
      conversationId: 'group-1',
      conversationType: 'groupChat',
      type: 'text',
      status: 'sent',
      ext: {},
      timestamp: 1778063975,
      body: { content: 'hello group' },
      direct: 'RECEIVE',
    };
    setMessageProfileVersionSidecar(message, {
      userInfoUpdateTime: 1778063975,
      namecardUpdateTime: 1778063976,
    });

    const result = cacheManager.applyIncomingMessageToConversations(message);

    expect(result.changed).toBe(true);
    expect(result.items[0]).toMatchObject({
      conversationId: 'group-1',
      type: 'groupChat',
      lastMessage: {
        msgId: 'server-1',
        userInfoUpdateTime: 1778063975,
        namecardUpdateTime: 1778063976,
      },
    });
  });

  it('离线收到的消息不应累加本地会话未读数', async () => {
    const cacheManager = new CacheManager({
      appKey: APP_KEY,
      userId: USER_ID,
      cacheEncryptionMode: 'off',
    });
    await cacheManager.prepare();

    const message: Message = {
      msgServerId: 'server-offline-1',
      msgLocalId: 'local-offline-1',
      from: 'peer-1',
      to: USER_ID,
      sender: { userId: 'peer-1' },
      conversationId: 'peer-1',
      conversationType: 'singleChat',
      type: 'text',
      status: 'sent',
      ext: {},
      timestamp: 1778063999,
      body: { content: 'offline hello' },
      direct: 'RECEIVE',
      isOnline: false,
    };

    const conversationResult = cacheManager.applyIncomingMessageToConversations(message);
    const sessionListResult = cacheManager.applyIncomingMessageToSessionList(message);

    expect(conversationResult.changed).toBe(true);
    expect(sessionListResult.changed).toBe(true);
    expect(cacheManager.loadConversationSummaries()[0]).toMatchObject({
      conversationId: 'peer-1',
      unreadCount: 0,
      lastMessage: expect.objectContaining({
        msgId: 'server-offline-1',
      }),
    });
    expect(cacheManager.loadSessionList()[0]).toMatchObject({
      conversationId: 'peer-1',
      unreadCount: 0,
      lastMessage: expect.objectContaining({
        msgServerId: 'server-offline-1',
      }),
    });
  });

  it('当前会话收到在线消息不应累加本地未读数', async () => {
    const cacheManager = new CacheManager({
      appKey: APP_KEY,
      userId: USER_ID,
      cacheEncryptionMode: 'off',
    });
    await cacheManager.prepare();
    cacheManager.setCurrentConversation({
      conversationId: 'peer-1',
      type: 'singleChat',
    });

    const message: Message = {
      msgServerId: 'server-online-1',
      msgLocalId: 'local-online-1',
      from: 'peer-1',
      to: USER_ID,
      sender: { userId: 'peer-1' },
      conversationId: 'peer-1',
      conversationType: 'singleChat',
      type: 'text',
      status: 'sent',
      ext: {},
      timestamp: 1778064000,
      body: { content: 'online hello' },
      direct: 'RECEIVE',
      isOnline: true,
    };

    cacheManager.applyIncomingMessageToConversations(message);
    cacheManager.applyIncomingMessageToSessionList(message);

    expect(cacheManager.loadConversationSummaries()[0]).toMatchObject({
      conversationId: 'peer-1',
      unreadCount: 0,
    });
    expect(cacheManager.loadSessionList()[0]).toMatchObject({
      conversationId: 'peer-1',
      unreadCount: 0,
      lastMessage: expect.objectContaining({
        msgServerId: 'server-online-1',
      }),
    });

    cacheManager.resetCurrentConversation();
    cacheManager.applyIncomingMessageToConversations({
      ...message,
      msgServerId: 'server-online-2',
      msgLocalId: 'local-online-2',
      timestamp: 1778064001,
    });
    cacheManager.applyIncomingMessageToSessionList({
      ...message,
      msgServerId: 'server-online-2',
      msgLocalId: 'local-online-2',
      timestamp: 1778064001,
    });

    expect(cacheManager.loadSessionList()[0]).toMatchObject({
      conversationId: 'peer-1',
      unreadCount: 1,
    });
  });

  it('markConversationRead 应清空本地 conversation 与 session-list 未读数', async () => {
    const { conversationKey } = buildKeys();
    storage.setItem(
      conversationKey,
      JSON.stringify({
        items: [
          createConversation({
            id: 'peer-1',
            lastAccess: 1,
            lastUpdate: 10,
            unreadCount: 3,
          }),
        ],
      })
    );
    const cacheManager = new CacheManager({
      appKey: APP_KEY,
      userId: USER_ID,
      cacheEncryptionMode: 'off',
    });
    await cacheManager.prepare();
    cacheManager.replaceSessionList([
      {
        conversationId: 'peer-1',
        conversationType: 'singleChat',
        unreadCount: 3,
        lastMessage: {
          msgServerId: 'm1',
          from: 'peer-1',
          to: USER_ID,
          sender: { userId: 'peer-1' },
          timestamp: 100,
          body: { content: 'hello' },
        },
        lastMessageAt: 100,
        marks: [],
        remindType: 'DEFAULT',
        conversationName: 'peer-1',
      },
    ]);

    const result = cacheManager.markConversationRead({
      conversationId: 'peer-1',
      type: 'singleChat',
      readAt: 200,
    });

    expect(result.changed).toBe(true);
    expect(cacheManager.loadConversationSummaries()[0]).toMatchObject({
      conversationId: 'peer-1',
      unreadCount: 0,
    });
    expect(cacheManager.loadSessionList()[0]).toMatchObject({
      conversationId: 'peer-1',
      unreadCount: 0,
      readAt: 200,
    });
  });

  it('deleteConversation 应删除本地 conversation 与 session-list 会话', async () => {
    const { conversationKey } = buildKeys();
    storage.setItem(
      conversationKey,
      JSON.stringify({
        items: [
          createConversation({
            id: 'peer-1',
            lastAccess: 1,
            lastUpdate: 10,
            unreadCount: 3,
          }),
          createConversation({
            id: 'peer-2',
            lastAccess: 2,
            lastUpdate: 20,
            unreadCount: 1,
          }),
        ],
      })
    );
    const cacheManager = new CacheManager({
      appKey: APP_KEY,
      userId: USER_ID,
      cacheEncryptionMode: 'off',
    });
    await cacheManager.prepare();
    cacheManager.replaceSessionList([
      {
        conversationId: 'peer-1',
        conversationType: 'singleChat',
        unreadCount: 3,
        lastMessage: {
          msgServerId: 'm1',
          from: 'peer-1',
          to: USER_ID,
          sender: { userId: 'peer-1' },
          timestamp: 100,
          body: { content: 'hello' },
        },
        lastMessageAt: 100,
        marks: [],
        remindType: 'DEFAULT',
        conversationName: 'peer-1',
      },
      {
        conversationId: 'peer-2',
        conversationType: 'singleChat',
        unreadCount: 1,
        lastMessage: {
          msgServerId: 'm2',
          from: 'peer-2',
          to: USER_ID,
          sender: { userId: 'peer-2' },
          timestamp: 200,
          body: { content: 'hello 2' },
        },
        lastMessageAt: 200,
        marks: [],
        remindType: 'DEFAULT',
        conversationName: 'peer-2',
      },
    ]);

    const result = cacheManager.deleteConversation({
      conversationId: 'peer-1',
      type: 'singleChat',
    });

    expect(result.changed).toBe(true);
    expect(cacheManager.loadConversationSummaries()).toEqual([
      expect.objectContaining({ conversationId: 'peer-2' }),
    ]);
    expect(cacheManager.loadSessionList()).toEqual([
      expect.objectContaining({ conversationId: 'peer-2' }),
    ]);
  });

  it('clearConversations 应清空本地 conversation 与 session-list 会话', async () => {
    const { conversationKey } = buildKeys();
    storage.setItem(
      conversationKey,
      JSON.stringify({
        items: [
          createConversation({
            id: 'peer-1',
            lastAccess: 1,
            lastUpdate: 10,
            unreadCount: 3,
          }),
        ],
      })
    );
    const cacheManager = new CacheManager({
      appKey: APP_KEY,
      userId: USER_ID,
      cacheEncryptionMode: 'off',
    });
    await cacheManager.prepare();
    cacheManager.replaceSessionList([
      {
        conversationId: 'peer-1',
        conversationType: 'singleChat',
        unreadCount: 3,
        lastMessage: {
          msgServerId: 'm1',
          from: 'peer-1',
          to: USER_ID,
          sender: { userId: 'peer-1' },
          timestamp: 100,
          body: { content: 'hello' },
        },
        lastMessageAt: 100,
        marks: [],
        remindType: 'DEFAULT',
        conversationName: 'peer-1',
      },
    ]);

    const result = cacheManager.clearConversations();

    expect(result.changed).toBe(true);
    expect(cacheManager.loadConversationSummaries()).toEqual([]);
    expect(cacheManager.loadSessionList()).toEqual([]);
  });

  it('markConversationAccess/getUserInfoSummaries/removeUserInfo 后应可 flush 落盘', async () => {
    const { conversationKey, userInfoKey } = buildKeys();
    storage.setItem(
      conversationKey,
      JSON.stringify({
        items: [createConversation({ id: 'c1', lastAccess: 1, lastUpdate: 10 })],
      })
    );
    storage.setItem(
      userInfoKey,
      JSON.stringify({
        items: [
          createUserInfo({ userId: 'u1', lastAccess: 1, lastUpdate: 10 }),
          createUserInfo({ userId: 'u2', lastAccess: 2, lastUpdate: 10 }),
        ],
      })
    );

    const cacheManager = new CacheManager({
      appKey: APP_KEY,
      userId: USER_ID,
      cacheEncryptionMode: 'off',
    });
    await cacheManager.prepare();

    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(123456);
    cacheManager.markConversationAccess([{ conversationId: 'c1', type: 'singleChat' }]);
    const matched = cacheManager.getUserInfoSummaries(['u1'], true);
    cacheManager.removeUserInfo(['u2']);

    expect(matched[0]?.lastAccess).toBe(1);
    expect(cacheManager.loadUserInfoSummaries()[0]?.lastAccess).toBe(123456);
    expect(cacheManager.loadUserInfoSummaries()).toHaveLength(1);
    expect(cacheManager.loadConversationSummaries()[0]?.lastAccess).toBe(123456);

    const privateManager = cacheManager as unknown as { flushNow: () => Promise<void> };
    await privateManager.flushNow();

    const persistedConversation = JSON.parse(
      storage.getItem(conversationKey) ?? '{"items":[]}'
    ) as { readonly items: ConversationSummary[] };
    const persistedUsers = JSON.parse(storage.getItem(userInfoKey) ?? '{"items":[]}') as {
      readonly items: UserInfoSummary[];
    };
    expect(persistedConversation.items[0]?.lastAccess).toBe(123456);
    expect(persistedUsers.items).toHaveLength(1);

    nowSpy.mockRestore();
  });

  it('flushNow 遇到 QuotaExceededError 时应清理并重试', async () => {
    const { conversationKey, userInfoKey } = buildKeys();
    const cacheManager = new CacheManager({
      appKey: APP_KEY,
      userId: USER_ID,
      cacheEncryptionMode: 'off',
    });
    await cacheManager.prepare();

    cacheManager.updateConversationsFromServer([
      createConversation({ id: 'c1', lastAccess: 1, lastUpdate: 10 }),
      createConversation({ id: 'c2', lastAccess: 2, lastUpdate: 20 }),
    ]);
    cacheManager.setUserInfoSummaries([
      createUserInfo({ userId: 'u1', lastAccess: 1, lastUpdate: 10 }),
      createUserInfo({ userId: 'u2', lastAccess: 2, lastUpdate: 20 }),
    ]);

    const rawSetItem = storage.setItem.bind(storage);
    let failOnce = true;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key: string,
      value: string
    ): void {
      if (failOnce) {
        failOnce = false;
        throw new DOMException('quota exceeded', 'QuotaExceededError');
      }
      void this;
      rawSetItem(key, value);
    });

    const privateManager = cacheManager as unknown as { flushNow: () => Promise<void> };
    await privateManager.flushNow();

    expect(failOnce).toBe(false);
    expect(storage.getItem(conversationKey)).not.toBeNull();
    expect(storage.getItem(userInfoKey)).not.toBeNull();
  });

  it('旧 schema 会话类型应在 prepare 阶段迁移为 canonical naming', async () => {
    const { conversationKey } = buildKeys();
    storage.setItem(
      conversationKey,
      JSON.stringify({
        items: [
          {
            conversationId: 'legacy',
            type: 'single',
            lastMessage: null,
            unreadCount: 0,
            lastAccess: 1,
            lastUpdate: 1,
          },
        ],
      })
    );

    const cacheManager = new CacheManager({
      appKey: APP_KEY,
      userId: USER_ID,
      cacheEncryptionMode: 'off',
    });
    await cacheManager.prepare();

    expect(cacheManager.loadConversationSummaries()[0]).toMatchObject({
      conversationId: 'legacy',
      type: 'singleChat',
      marks: [],
    });
  });

  it('配额清理应先按 LRU 淘汰群名片，不立即清理用户资料', async () => {
    const cacheManager = new CacheManager({
      appKey: APP_KEY,
      userId: USER_ID,
      cacheEncryptionMode: 'off',
      config: { ttlSeconds: 60 },
    });
    await cacheManager.prepare();
    vi.spyOn(Date, 'now').mockReturnValue(1000);

    cacheManager.setUserInfoSummaries([
      createUserInfo({ userId: 'stale-user', lastAccess: 1, lastUpdate: 1000 }),
      createUserInfo({ userId: 'recent-user', lastAccess: 100, lastUpdate: 1000 }),
    ]);
    cacheManager.setGroupNamecards([
      createGroupNamecard({ userId: 'stale-card', lastAccess: 1, lastUpdate: 1000 }),
      createGroupNamecard({ userId: 'recent-card', lastAccess: 100, lastUpdate: 1000 }),
    ]);

    const privateManager = cacheManager as unknown as {
      handleQuotaExceeded: () => 'groupNamecard' | 'userInfo' | 'conversation' | 'none';
    };
    expect(privateManager.handleQuotaExceeded()).toBe('groupNamecard');

    expect(cacheManager.loadUserInfoSummaries()).toHaveLength(2);
    const groupNamecardUserIds = cacheManager.loadGroupNamecards('g1').map(item => item.userId);
    expect(groupNamecardUserIds).toEqual(['recent-card']);
  });

  it('群名片已无可淘汰项时才清理用户资料', async () => {
    const cacheManager = new CacheManager({
      appKey: APP_KEY,
      userId: USER_ID,
      cacheEncryptionMode: 'off',
      config: { ttlSeconds: 60 },
    });
    await cacheManager.prepare();
    vi.spyOn(Date, 'now').mockReturnValue(1000);

    cacheManager.setUserInfoSummaries([
      createUserInfo({ userId: 'stale-user', lastAccess: 1, lastUpdate: 1000 }),
      createUserInfo({ userId: 'recent-user', lastAccess: 100, lastUpdate: 1000 }),
    ]);

    const privateManager = cacheManager as unknown as {
      handleQuotaExceeded: () => 'groupNamecard' | 'userInfo' | 'conversation' | 'none';
    };
    expect(privateManager.handleQuotaExceeded()).toBe('userInfo');

    const userIds = cacheManager.loadUserInfoSummaries().map(item => item.userId);
    expect(userIds).toEqual(['recent-user']);
  });

  it('removeContact/updateContactRemark 应返回本地 patch 后的联系人快照', async () => {
    const cacheManager = new CacheManager({
      appKey: APP_KEY,
      userId: USER_ID,
      cacheEncryptionMode: 'off',
    });
    await seedContactCache(cacheManager);

    const remarkResult = cacheManager.updateContactRemark('u1', 'new-remark');
    expect(remarkResult.changed).toBe(true);
    expect(remarkResult.snapshot.items[0]?.remark).toBe('new-remark');

    const unchangedRemarkResult = cacheManager.updateContactRemark('u1', 'new-remark');
    expect(unchangedRemarkResult.changed).toBe(false);

    const removeResult = cacheManager.removeContact('u1');
    expect(removeResult.changed).toBe(true);
    expect(removeResult.snapshot.items).toEqual([]);

    const missingRemoveResult = cacheManager.removeContact('missing-user');
    expect(missingRemoveResult.changed).toBe(false);
  });

  it('联系人 patch 后 flush 应持久化 relation/version/meta', async () => {
    const { contactRelationKey, contactVersionKey, contactMetaKey } = buildKeys();
    const cacheManager = new CacheManager({
      appKey: APP_KEY,
      userId: USER_ID,
      cacheEncryptionMode: 'off',
    });
    await seedContactCache(cacheManager);

    cacheManager.updateContactRemark('u1', 'persisted-remark');

    const privateManager = cacheManager as unknown as { flushNow: () => Promise<void> };
    await privateManager.flushNow();

    expect(storage.getItem(contactRelationKey)).toContain('persisted-remark');
    expect(storage.getItem(contactVersionKey)).toContain('"version":"v1"');
    expect(storage.getItem(contactMetaKey)).toContain('"lastSuccessfulVersion":"v1"');
  });

  it('applyContactRosterNotice 应支持联系人新增、删除与 roster version 更新', async () => {
    const cacheManager = new CacheManager({
      appKey: APP_KEY,
      userId: USER_ID,
      cacheEncryptionMode: 'off',
    });
    await seedContactCache(cacheManager);

    const addResult = cacheManager.applyContactRosterNotice({
      action: 'add',
      userId: 'u2',
      rosterVersion: 'rv-2',
    });
    expect(addResult.changed).toBe(true);
    expect(addResult.snapshot.version).toBe('rv-2');
    expect(addResult.snapshot.items.map(item => item.userId)).toEqual(['u1', 'u2']);

    const duplicateAdd = cacheManager.applyContactRosterNotice({
      action: 'add',
      userId: 'u2',
      rosterVersion: 'rv-2',
    });
    expect(duplicateAdd.changed).toBe(false);

    const removeResult = cacheManager.applyContactRosterNotice({
      action: 'remove',
      userId: 'u1',
      rosterVersion: 'rv-3',
    });
    expect(removeResult.changed).toBe(true);
    expect(removeResult.snapshot.version).toBe('rv-3');
    expect(removeResult.snapshot.items.map(item => item.userId)).toEqual(['u2']);
  });
});
