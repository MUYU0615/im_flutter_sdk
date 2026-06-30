import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CacheManager } from '@/cache/cache-manager';
import { ChatClient } from '@/chat-client';
import { GroupManager } from '@/managers/group-manager';
import { RestClient } from '@/rest/client';

const resetSingleton = (): void => {
  (ChatClient as unknown as { instance: ChatClient | null }).instance = null;
};

describe('ChatClient group events', () => {
  beforeEach((): void => {
    resetSingleton();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('应通过公开入口暴露 groupManager', () => {
    const client = ChatClient.init({ appKey: 'org#app' }).use(GroupManager);

    expect(client.groupManager).toBeInstanceOf(GroupManager);
  });

  it('onInvitationReceived 在资料缺失时应补拉 inviter 后再对外派发', async () => {
    const client = ChatClient.init({ appKey: 'org#app' }).use(GroupManager);
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

    const onInvitationReceived = vi.fn();
    client.groupManager.addEventHandler('group-ui', {
      onInvitationReceived,
    });

    (
      client as unknown as {
        eventHub: { dispatch: (event: string, payload: unknown) => void };
      }
    ).eventHub.dispatch('onGroupNotify', {
      eventName: 'onInvitationReceived',
      payload: {
        groupId: 'g1',
        groupName: 'Group 1',
        inviterId: 'bob',
        reason: 'join us',
      },
    });

    await new Promise(resolve => {
      setTimeout(resolve, 0);
    });

    expect(onInvitationReceived).toHaveBeenCalledWith({
      groupId: 'g1',
      groupName: 'Group 1',
      inviter: {
        userId: 'bob',
        nickname: 'Bob',
        avatarUrl: 'https://cdn.example.com/bob.png',
      },
      reason: 'join us',
    });
  });

  it('onGroupInfoChanged 应在必要时补拉完整群详情后再派发', async () => {
    const client = ChatClient.init({ appKey: 'org#app' }).use(GroupManager);
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
          id: 'g1',
          name: 'Fetched Group',
          description: 'desc',
          owner: 'owner',
          public: true,
          allowinvites: true,
          membersonly: false,
        },
      ],
    });

    const onGroupInfoChanged = vi.fn();
    client.groupManager.addEventHandler('group-ui', {
      onGroupInfoChanged,
    });

    (
      client as unknown as {
        eventHub: { dispatch: (event: string, payload: unknown) => void };
      }
    ).eventHub.dispatch('onGroupNotify', {
      eventName: 'onGroupInfoChanged',
      payload: {
        groupId: 'g1',
        groupName: 'Partial Group',
        shouldFetchGroupDetail: true,
      },
    });

    await new Promise(resolve => {
      setTimeout(resolve, 0);
    });

    expect(onGroupInfoChanged).toHaveBeenCalledWith({
      groupId: 'g1',
      groupInfo: expect.objectContaining({
        groupId: 'g1',
        name: 'Fetched Group',
        owner: expect.objectContaining({
          userId: 'owner',
          nickname: 'Owner',
        }),
      }),
    });
  });

  it('onOwnerChanged 应通过 groupManager runtime sync 更新后续 detail 读取', async () => {
    const client = ChatClient.init({ appKey: 'org#app' }).use(GroupManager);
    const cacheManager = new CacheManager({
      appKey: 'org#app',
      userId: 'alice',
      cacheEncryptionMode: 'off',
    });
    await cacheManager.prepare();
    cacheManager.setUserInfoSummaries([
      {
        userId: 'owner1',
        nickname: 'Owner 1',
        lastAccess: 1,
        lastUpdate: 1,
      },
      {
        userId: 'owner2',
        nickname: 'Owner 2',
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

    const getSpy = vi.spyOn(RestClient.prototype, 'get').mockResolvedValue({
      data: [
        {
          id: 'g1',
          name: 'Group 1',
          owner: 'owner1',
        },
      ],
    });

    await expect(client.groupManager.getGroup('g1').getDetail()).resolves.toEqual({
      groupId: 'g1',
      name: 'Group 1',
      owner: {
        userId: 'owner1',
        nickname: 'Owner 1',
      },
    });

    (
      client as unknown as {
        eventHub: { dispatch: (event: string, payload: unknown) => void };
      }
    ).eventHub.dispatch('onGroupNotify', {
      eventName: 'onOwnerChanged',
      payload: {
        groupId: 'g1',
        oldOwnerId: 'owner1',
        newOwnerId: 'owner2',
      },
    });

    await new Promise(resolve => {
      setTimeout(resolve, 0);
    });

    await expect(client.groupManager.getGroup('g1').getDetail()).resolves.toEqual({
      groupId: 'g1',
      name: 'Group 1',
      owner: {
        userId: 'owner2',
        nickname: 'Owner 2',
      },
    });
    expect(getSpy).toHaveBeenCalledTimes(1);
  });

  it('onMembersExited 在资料缺失时应补拉 member 后再对外派发', async () => {
    const client = ChatClient.init({ appKey: 'org#app' }).use(GroupManager);
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
        },
      },
      lastModified: {
        bob: 1,
      },
      duration: 1,
    });

    const onMembersExited = vi.fn();
    client.groupManager.addEventHandler('group-ui', {
      onMembersExited,
    });

    (
      client as unknown as {
        eventHub: { dispatch: (event: string, payload: unknown) => void };
      }
    ).eventHub.dispatch('onGroupNotify', {
      eventName: 'onMembersExited',
      payload: {
        groupId: 'g1',
        memberIds: ['bob'],
      },
    });

    await new Promise(resolve => {
      setTimeout(resolve, 0);
    });

    expect(onMembersExited).toHaveBeenCalledWith({
      groupId: 'g1',
      members: [
        {
          userId: 'bob',
          nickname: 'Bob',
        },
      ],
    });
  });
});
