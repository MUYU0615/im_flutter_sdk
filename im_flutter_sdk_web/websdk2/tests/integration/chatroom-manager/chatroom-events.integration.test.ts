import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CacheManager } from '@/cache/cache-manager';
import { ChatClient } from '@/chat-client';
import { ChatRoomManager } from '@/managers/chatroom-manager';
import { RestClient } from '@/rest/client';

const resetSingleton = (): void => {
  (ChatClient as unknown as { instance: ChatClient | null }).instance = null;
};

describe('chatroom-manager events integration', () => {
  beforeEach((): void => {
    resetSingleton();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('onAdminAdded 在资料缺失时应补拉 admin 后再对外派发', async () => {
    const client = ChatClient.init({ appKey: 'org#app' }).use(ChatRoomManager);
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
        },
      },
      lastModified: {
        bob: 1,
      },
      duration: 1,
    });

    const onAdminAdded = vi.fn();
    client.chatRoomManager.addEventHandler('chatroom-ui', {
      onAdminAdded,
    });

    (
      client as unknown as {
        eventHub: { dispatch: (event: string, payload: unknown) => void };
      }
    ).eventHub.dispatch('onChatRoomNotify', {
      eventName: 'onAdminAdded',
      payload: {
        chatRoomId: 'r1',
        adminId: 'bob',
      },
    });

    await new Promise(resolve => {
      setTimeout(resolve, 0);
    });

    expect(onAdminAdded).toHaveBeenCalledWith({
      chatRoomId: 'r1',
      admin: {
        userId: 'bob',
        nickname: 'Bob',
        avatarUrl: 'https://cdn.example.com/bob.png',
      },
    });
  });

  it('onChatRoomInfoChanged 应在必要时补拉完整聊天室详情后再派发', async () => {
    const client = ChatClient.init({ appKey: 'org#app' }).use(ChatRoomManager);
    const cacheManager = new CacheManager({
      appKey: 'org#app',
      userId: 'alice',
      cacheEncryptionMode: 'off',
    });
    await cacheManager.prepare();
    cacheManager.setUserInfoSummaries([
      {
        userId: 'owner',
        nickname: 'Owner',
        lastAccess: 1,
        lastUpdate: 1,
      },
    ]);

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

    vi.spyOn(RestClient.prototype, 'get').mockResolvedValue({
      data: [
        {
          id: 'r1',
          name: 'Fetched ChatRoom',
          description: 'desc',
          owner: 'owner',
          public: true,
          allowinvites: true,
          membersonly: false,
        },
      ],
    });

    const onChatRoomInfoChanged = vi.fn();
    client.chatRoomManager.addEventHandler('chatroom-ui', {
      onChatRoomInfoChanged,
    });

    (
      client as unknown as {
        eventHub: { dispatch: (event: string, payload: unknown) => void };
      }
    ).eventHub.dispatch('onChatRoomNotify', {
      eventName: 'onChatRoomInfoChanged',
      payload: {
        chatRoomId: 'r1',
        chatRoomName: 'Partial ChatRoom',
        shouldFetchChatRoomDetail: true,
      },
    });

    await new Promise(resolve => {
      setTimeout(resolve, 0);
    });

    expect(onChatRoomInfoChanged).toHaveBeenCalledWith({
      chatRoomId: 'r1',
      chatRoomInfo: expect.objectContaining({
        chatRoomId: 'r1',
        name: 'Fetched ChatRoom',
        owner: expect.objectContaining({
          userId: 'owner',
          nickname: 'Owner',
        }),
      }),
    });
  });
});
