import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CacheManager } from '@/cache/cache-manager';
import { ChatClient } from '@/chat-client';
import { ContactManager } from '@/managers/contact-manager';
import { UserInfoManager } from '@/managers/user-info-manager';

const resetSingleton = (): void => {
  (ChatClient as unknown as { instance: ChatClient | null }).instance = null;
};

describe('ChatClient user-info notify events', () => {
  beforeEach((): void => {
    resetSingleton();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('订阅资料 notify 应先更新缓存再通过 onUserInfoUpdated 派发，并忽略旧版本补丁', async () => {
    const client = ChatClient.init({ appKey: 'org#app' }).use(UserInfoManager);
    const cacheManager = new CacheManager({
      appKey: 'org#app',
      userId: 'alice',
      cacheEncryptionMode: 'off',
    });
    await cacheManager.prepare();
    cacheManager.upsertRuntimeUserInfos([
      {
        profile: {
          userId: 'bob',
          nickname: 'Bob Old',
          mail: 'bob@example.com',
        },
        lastModified: 20,
        source: 'fetch',
      },
    ]);
    cacheManager.setUserInfoSummaries([
      {
        userId: 'bob',
        nickname: 'Bob Old',
        avatarUrl: 'https://cdn.example.com/bob-old.png',
        lastAccess: 1,
        lastUpdate: 20,
      },
    ]);
    cacheManager.replaceSessionList([
      {
        conversationId: 'bob',
        conversationType: 'singleChat',
        unreadCount: 0,
        lastMessage: {
          msgServerId: 'm1',
          from: 'bob',
          to: 'alice',
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
        conversationName: 'Bob Old',
        conversationAvatar: 'https://cdn.example.com/bob-old.png',
      },
    ]);

    (
      client as unknown as {
        cacheManager: CacheManager | null;
        currentUserId: string | null;
        eventHub: { dispatch: (event: string, payload: unknown) => void };
      }
    ).cacheManager = cacheManager;
    (
      client as unknown as {
        cacheManager: CacheManager | null;
        currentUserId: string | null;
        eventHub: { dispatch: (event: string, payload: unknown) => void };
      }
    ).currentUserId = 'alice';

    const onUserInfoUpdated = vi.fn(
      (
        event: ReadonlyArray<{
          userId: string;
          nickname?: string;
          avatarUrl?: string;
          mail?: string;
        }>
      ) => {
        expect(cacheManager.getRuntimeUserInfo('bob')).toEqual(event[0]);
        expect(
          cacheManager.loadUserInfoSummaries().find(item => item.userId === 'bob')?.lastUpdate
        ).toBe(30);
        expect(event).toEqual([
          {
            userId: 'bob',
            nickname: 'Bob New',
            avatarUrl: 'https://cdn.example.com/bob-new.png',
            mail: 'bob@example.com',
          },
        ]);
      }
    );
    client.userInfoManager.addEventHandler('user-info-ui', {
      onUserInfoUpdated,
    });
    const onConversationListUpdate = vi.fn();
    client.addEventHandler('conversation-ui', {
      onConversationListUpdate,
    });

    (
      client as unknown as {
        eventHub: { dispatch: (event: string, payload: unknown) => void };
      }
    ).eventHub.dispatch('onUserInfoNotify', {
      notifyType: 'subscribe_metadata_updated',
      userId: 'bob',
      metadata: {
        nickname: 'Bob New',
        avatarurl: 'https://cdn.example.com/bob-new.png',
      },
      lastModified: 30,
    });

    await new Promise(resolve => {
      setTimeout(resolve, 0);
    });

    expect(onUserInfoUpdated).toHaveBeenCalledTimes(1);
    expect(cacheManager.loadSessionList()[0]).toMatchObject({
      conversationId: 'bob',
      conversationName: 'Bob New',
      conversationAvatar: 'https://cdn.example.com/bob-new.png',
      lastMessage: {
        sender: {
          userId: 'bob',
          nickname: 'Bob New',
          avatarUrl: 'https://cdn.example.com/bob-new.png',
        },
      },
    });
    expect(onConversationListUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'profile',
        items: [
          expect.objectContaining({
            conversationId: 'bob',
            conversationType: 'singleChat',
            conversationName: 'Bob New',
            conversationAvatar: 'https://cdn.example.com/bob-new.png',
            lastMessage: expect.objectContaining({
              sender: {
                userId: 'bob',
                nickname: 'Bob New',
                avatarUrl: 'https://cdn.example.com/bob-new.png',
              },
            }),
          }),
        ],
        patch: expect.objectContaining({
          upserted: [
            expect.objectContaining({
              conversationId: 'bob',
              conversationType: 'singleChat',
            }),
          ],
          removed: [],
          affectedKeys: ['singleChat:bob'],
        }),
      })
    );

    (
      client as unknown as {
        eventHub: { dispatch: (event: string, payload: unknown) => void };
      }
    ).eventHub.dispatch('onUserInfoNotify', {
      notifyType: 'subscribe_metadata_updated',
      userId: 'bob',
      metadata: {
        nickname: 'Bob Stale',
      },
      lastModified: 29,
    });

    await new Promise(resolve => {
      setTimeout(resolve, 0);
    });

    expect(onUserInfoUpdated).toHaveBeenCalledTimes(1);
    expect(cacheManager.getRuntimeUserInfo('bob')).toEqual({
      userId: 'bob',
      nickname: 'Bob New',
      avatarUrl: 'https://cdn.example.com/bob-new.png',
      mail: 'bob@example.com',
      sign: undefined,
      ext: undefined,
    });
  });

  it('好友资料 notify 应刷新联系人视图并派发 onContactInfoUpdated', async () => {
    const client = ChatClient.init({ appKey: 'org#app' }).use(UserInfoManager).use(ContactManager);
    const cacheManager = new CacheManager({
      appKey: 'org#app',
      userId: 'alice',
      cacheEncryptionMode: 'off',
    });
    await cacheManager.prepare();
    cacheManager.applyContactSync({
      mode: 'full',
      relations: [
        {
          userId: 'friend-1',
          remark: 'old-remark',
          sign: 'old-sign',
          addTs: 100,
          updatedAt: 100,
          metadataUpdatedAt: 100,
        },
      ],
      userInfos: [
        {
          userId: 'friend-1',
          nickname: 'Friend Old',
          avatarUrl: 'https://cdn.example.com/old.png',
        },
      ],
      version: 'v1',
      lastSyncTs: 1,
    });

    (
      client as unknown as {
        cacheManager: CacheManager | null;
        currentUserId: string | null;
        eventHub: { dispatch: (event: string, payload: unknown) => void };
      }
    ).cacheManager = cacheManager;
    (
      client as unknown as {
        cacheManager: CacheManager | null;
        currentUserId: string | null;
        eventHub: { dispatch: (event: string, payload: unknown) => void };
      }
    ).currentUserId = 'alice';

    const onContactInfoUpdated = vi.fn(event => {
      expect(client.contactManager.getContacts()[0]?.userInfo).toEqual(event.userInfo);
      expect(event.contact).toMatchObject({
        userId: 'friend-1',
        remark: 'old-remark',
      });
    });
    client.contactManager.addEventHandler('contact-ui', {
      onContactInfoUpdated,
    });

    (
      client as unknown as {
        eventHub: { dispatch: (event: string, payload: unknown) => void };
      }
    ).eventHub.dispatch('onUserInfoNotify', {
      notifyType: 'contact_metadata_updated',
      userId: 'friend-1',
      metadata: {
        nickname: 'Friend New',
        avatarurl: 'https://cdn.example.com/new.png',
        sign: 'new-sign',
      },
      lastModified: 50,
    });

    await new Promise(resolve => {
      setTimeout(resolve, 0);
    });

    expect(onContactInfoUpdated).toHaveBeenCalledWith({
      userInfo: {
        userId: 'friend-1',
        nickname: 'Friend New',
        avatarUrl: 'https://cdn.example.com/new.png',
        sign: 'new-sign',
      },
      contact: {
        userId: 'friend-1',
        userInfo: {
          userId: 'friend-1',
          nickname: 'Friend New',
          avatarUrl: 'https://cdn.example.com/new.png',
          sign: 'new-sign',
        },
        remark: 'old-remark',
        addTs: 100,
      },
    });
  });

  it('自己的资料 notify 应刷新缓存并通过 onOwnInfoUpdated 派发', async () => {
    const client = ChatClient.init({ appKey: 'org#app' }).use(UserInfoManager);
    const cacheManager = new CacheManager({
      appKey: 'org#app',
      userId: 'alice',
      cacheEncryptionMode: 'off',
    });
    await cacheManager.prepare();
    cacheManager.upsertRuntimeUserInfos([
      {
        profile: {
          userId: 'alice',
          nickname: 'Alice Old',
          mail: 'alice@example.com',
        },
        lastModified: 20,
        source: 'update',
      },
    ]);

    (
      client as unknown as {
        cacheManager: CacheManager | null;
        currentUserId: string | null;
        eventHub: { dispatch: (event: string, payload: unknown) => void };
      }
    ).cacheManager = cacheManager;
    (
      client as unknown as {
        cacheManager: CacheManager | null;
        currentUserId: string | null;
        eventHub: { dispatch: (event: string, payload: unknown) => void };
      }
    ).currentUserId = 'alice';

    const onOwnInfoUpdated = vi.fn(
      (event: Readonly<{ userId: string; nickname?: string; mail?: string; sign?: string }>) => {
        expect(cacheManager.getRuntimeUserInfo('alice')).toEqual(event);
      }
    );
    client.userInfoManager.addEventHandler('user-info-own-ui', {
      onOwnInfoUpdated,
    });

    (
      client as unknown as {
        eventHub: { dispatch: (event: string, payload: unknown) => void };
      }
    ).eventHub.dispatch('onUserInfoNotify', {
      notifyType: 'user_metadata_updated',
      userId: 'alice',
      metadata: {
        nickname: 'Alice New',
        sign: 'new-sign',
      },
      lastModified: 30,
    });

    await new Promise(resolve => {
      setTimeout(resolve, 0);
    });

    expect(onOwnInfoUpdated).toHaveBeenCalledTimes(1);
    expect(onOwnInfoUpdated).toHaveBeenCalledWith({
      userId: 'alice',
      nickname: 'Alice New',
      mail: 'alice@example.com',
      sign: 'new-sign',
    });
  });
});
