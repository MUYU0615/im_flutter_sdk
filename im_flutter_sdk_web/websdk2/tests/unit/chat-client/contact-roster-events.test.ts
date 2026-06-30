import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CacheManager } from '@/cache/cache-manager';
import { ChatClient } from '@/chat-client';
import { ContactManager } from '@/managers/contact-manager';
import { UserInfoManager } from '@/managers/user-info-manager';
import { RestClient } from '@/rest/client';

const resetSingleton = (): void => {
  (ChatClient as unknown as { instance: ChatClient | null }).instance = null;
};

describe('ChatClient contact roster events', () => {
  beforeEach((): void => {
    resetSingleton();
    localStorage.clear();
  });

  it('onContactAdded 应立即修补当前会话联系人缓存', async () => {
    const client = ChatClient.init({ appKey: 'org#app' }).use(ContactManager).use(UserInfoManager);
    const cacheManager = new CacheManager({
      appKey: 'org#app',
      userId: 'alice',
      cacheEncryptionMode: 'off',
    });
    await cacheManager.prepare();

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

    (
      client as unknown as {
        eventHub: { dispatch: (event: string, payload: unknown) => void };
      }
    ).eventHub.dispatch('onContactAdded', {
      type: 'subscribed',
      from: 'bob',
      to: 'alice',
      status: '',
      rosterVersion: 'rv-1',
    });

    const contacts = client.contactManager.getContacts();
    expect(contacts).toHaveLength(1);
    expect(contacts[0]).toMatchObject({
      userId: 'bob',
      userInfo: {
        userId: 'bob',
      },
      remark: '',
    });
    expect(typeof contacts[0]?.addTs).toBe('number');
    expect(client.getContactSnapshot()?.version).toBe('rv-1');
  });

  it('onContactDeleted 应立即移除当前会话联系人缓存', async () => {
    const client = ChatClient.init({ appKey: 'org#app' }).use(ContactManager).use(UserInfoManager);
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
          userId: 'bob',
          remark: '',
          sign: '',
          addTs: 10,
          updatedAt: 10,
          metadataUpdatedAt: 10,
        },
      ],
      userInfos: [],
      version: 'rv-1',
      lastSyncTs: 10,
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

    (
      client as unknown as {
        eventHub: { dispatch: (event: string, payload: unknown) => void };
      }
    ).eventHub.dispatch('onContactDeleted', {
      type: 'unsubscribed',
      from: 'bob',
      to: 'alice',
      status: '',
      rosterVersion: 'rv-2',
    });

    expect(client.contactManager.getContacts()).toEqual([]);
    expect(client.getContactSnapshot()?.version).toBe('rv-2');
  });

  it('onContactAdded 在资料缺失时应补拉 userInfo 后再对外派发', async () => {
    const client = ChatClient.init({ appKey: 'org#app' }).use(ContactManager).use(UserInfoManager);
    const cacheManager = new CacheManager({
      appKey: 'org#app',
      userId: 'alice',
      cacheEncryptionMode: 'off',
    });
    await cacheManager.prepare();

    (
      client as unknown as {
        cacheManager: CacheManager | null;
        currentUserId: string | null;
        restBaseUrl: string | null;
        authToken: string | null;
        clientResource: string | null;
        eventHub: { dispatch: (event: string, payload: unknown) => void };
      }
    ).cacheManager = cacheManager;
    (
      client as unknown as {
        cacheManager: CacheManager | null;
        currentUserId: string | null;
        restBaseUrl: string | null;
        authToken: string | null;
        clientResource: string | null;
        eventHub: { dispatch: (event: string, payload: unknown) => void };
      }
    ).currentUserId = 'alice';
    (
      client as unknown as {
        cacheManager: CacheManager | null;
        currentUserId: string | null;
        restBaseUrl: string | null;
        authToken: string | null;
        clientResource: string | null;
        eventHub: { dispatch: (event: string, payload: unknown) => void };
      }
    ).restBaseUrl = 'https://api.example.com';
    (
      client as unknown as {
        cacheManager: CacheManager | null;
        currentUserId: string | null;
        restBaseUrl: string | null;
        authToken: string | null;
        clientResource: string | null;
        eventHub: { dispatch: (event: string, payload: unknown) => void };
      }
    ).authToken = 'token';
    (
      client as unknown as {
        cacheManager: CacheManager | null;
        currentUserId: string | null;
        restBaseUrl: string | null;
        authToken: string | null;
        clientResource: string | null;
        eventHub: { dispatch: (event: string, payload: unknown) => void };
      }
    ).clientResource = 'web';

    vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({
      timestamp: 1,
      data: {
        bob: {
          nickname: 'Bob',
          avatarurl: 'https://cdn.example.com/bob.png',
          sign: 'hello',
        },
      },
      lastModified: {
        bob: 11,
      },
      duration: 2,
    });

    const onContactAdded = vi.fn();
    client.contactManager.addEventHandler('contact-ui', {
      onContactAdded,
    });

    (
      client as unknown as {
        eventHub: { dispatch: (event: string, payload: unknown) => void };
      }
    ).eventHub.dispatch('onContactAdded', {
      type: 'subscribed',
      from: 'bob',
      to: 'alice',
      status: '',
      rosterVersion: 'rv-1',
    });

    await new Promise(resolve => {
      setTimeout(resolve, 0);
    });

    expect(onContactAdded).toHaveBeenCalledWith({
      type: 'subscribed',
      from: 'bob',
      to: 'alice',
      status: '',
      rosterVersion: 'rv-1',
      userInfo: {
        userId: 'bob',
        nickname: 'Bob',
        avatarUrl: 'https://cdn.example.com/bob.png',
        sign: 'hello',
        ext: undefined,
      },
    });
  });
});
