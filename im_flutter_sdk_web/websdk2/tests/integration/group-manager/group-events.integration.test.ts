import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CacheManager } from '@/cache/cache-manager';
import { ChatClient } from '@/chat-client';
import { GroupManager } from '@/managers/group-manager';
import { RestClient } from '@/rest/client';

const resetSingleton = (): void => {
  (ChatClient as unknown as { instance: ChatClient | null }).instance = null;
};

describe('group-manager events integration', () => {
  beforeEach((): void => {
    resetSingleton();
    localStorage.clear();
    vi.restoreAllMocks();
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
    client.groupManager.addEventHandler('group-integration', {
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

    const getSpy = vi.spyOn(RestClient.prototype, 'get').mockResolvedValue({
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
    client.groupManager.addEventHandler('group-integration', {
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

    await expect(client.groupManager.getGroup('g1').getDetail()).resolves.toEqual(
      expect.objectContaining({
        groupId: 'g1',
        name: 'Fetched Group',
        owner: expect.objectContaining({
          userId: 'owner',
          nickname: 'Owner',
        }),
      })
    );
    expect(getSpy).toHaveBeenCalledTimes(1);
  });

  it('onGroupDisabledChanged 应在必要时补拉完整群详情后再派发', async () => {
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

    const getSpy = vi.spyOn(RestClient.prototype, 'get').mockResolvedValue({
      data: [
        {
          id: 'g1',
          name: 'Disabled Group',
          description: 'desc',
          owner: 'owner',
          public: false,
          allowinvites: false,
          membersonly: true,
          disabled: true,
        },
      ],
    });

    const onGroupDisabledChanged = vi.fn();
    client.groupManager.addEventHandler('group-state-changed', {
      onGroupDisabledChanged,
    });

    (
      client as unknown as {
        eventHub: { dispatch: (event: string, payload: unknown) => void };
      }
    ).eventHub.dispatch('onGroupNotify', {
      eventName: 'onGroupDisabledChanged',
      payload: {
        groupId: 'g1',
        shouldFetchGroupDetail: true,
      },
    });

    await new Promise(resolve => {
      setTimeout(resolve, 0);
    });

    expect(onGroupDisabledChanged).toHaveBeenCalledWith(
      expect.objectContaining({
        groupId: 'g1',
        groupInfo: expect.objectContaining({
          groupId: 'g1',
          name: 'Disabled Group',
          disabled: true,
          owner: expect.objectContaining({
            userId: 'owner',
            nickname: 'Owner',
          }),
        }),
      })
    );

    await expect(client.groupManager.getGroup('g1').getDetail()).resolves.toEqual(
      expect.objectContaining({
        groupId: 'g1',
        name: 'Disabled Group',
        disabled: true,
        owner: expect.objectContaining({
          userId: 'owner',
          nickname: 'Owner',
        }),
      })
    );
    expect(getSpy).toHaveBeenCalledTimes(1);
  });

  it('onMembersJoined 应在资料缺失时补拉 member 后再对外派发', async () => {
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
        currentUserId: string | null;
        restBaseUrl: string | null;
        authToken: string | null;
        clientResource: string | null;
      }
    ).currentUserId = 'alice';
    (
      client as unknown as {
        restBaseUrl: string | null;
        authToken: string | null;
        clientResource: string | null;
      }
    ).restBaseUrl = 'https://api.example.com';
    (
      client as unknown as {
        authToken: string | null;
        clientResource: string | null;
      }
    ).authToken = 'token';
    ((client as unknown as { clientResource: string | null }).clientResource = 'web');

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

    const onMembersJoined = vi.fn();
    client.groupManager.addEventHandler('group-member-joined', {
      onMembersJoined,
    });

    (
      client as unknown as {
        eventHub: { dispatch: (event: string, payload: unknown) => void };
      }
    ).eventHub.dispatch('onGroupNotify', {
      eventName: 'onMembersJoined',
      payload: {
        groupId: 'g1',
        memberIds: ['bob'],
      },
    });

    await new Promise(resolve => {
      setTimeout(resolve, 0);
    });

    expect(onMembersJoined).toHaveBeenCalledWith({
      groupId: 'g1',
      members: [
        {
          userId: 'bob',
          nickname: 'Bob',
        },
      ],
    });
  });

  it('onOwnerChanged 应先 patch 内部 detail，再让后续 getDetail 命中同一内部真相', async () => {
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
        currentUserId: string | null;
        restBaseUrl: string | null;
        authToken: string | null;
        clientResource: string | null;
      }
    ).currentUserId = 'alice';
    (
      client as unknown as {
        restBaseUrl: string | null;
        authToken: string | null;
        clientResource: string | null;
      }
    ).restBaseUrl = 'https://api.example.com';
    (
      client as unknown as {
        authToken: string | null;
        clientResource: string | null;
      }
    ).authToken = 'token';
    ((client as unknown as { clientResource: string | null }).clientResource = 'web');

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

    const onOwnerChanged = vi.fn();
    client.groupManager.addEventHandler('group-owner-changed', {
      onOwnerChanged,
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

    expect(onOwnerChanged).toHaveBeenCalledWith({
      groupId: 'g1',
      oldOwner: {
        userId: 'owner1',
        nickname: 'Owner 1',
      },
      newOwner: {
        userId: 'owner2',
        nickname: 'Owner 2',
      },
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

  it('onMembersJoined 在 memberCount 已知时应直接 patch 内部 detail', async () => {
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
        currentUserId: string | null;
        restBaseUrl: string | null;
        authToken: string | null;
        clientResource: string | null;
      }
    ).currentUserId = 'alice';
    (
      client as unknown as {
        restBaseUrl: string | null;
        authToken: string | null;
        clientResource: string | null;
      }
    ).restBaseUrl = 'https://api.example.com';
    (
      client as unknown as {
        authToken: string | null;
        clientResource: string | null;
      }
    ).authToken = 'token';
    ((client as unknown as { clientResource: string | null }).clientResource = 'web');

    let groupDetailVersion = 0;
    const getSpy = vi.spyOn(RestClient.prototype, 'get').mockImplementation(async () => {
      groupDetailVersion += 1;
      return {
        data: [
          {
            id: 'g1',
            name: 'Group 1',
            affiliations_count: `${groupDetailVersion}`,
          },
        ],
      };
    });
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

    await expect(client.groupManager.getGroup('g1').getDetail()).resolves.toEqual(
      expect.objectContaining({
        groupId: 'g1',
        name: 'Group 1',
        memberCount: 1,
      })
    );

    (
      client as unknown as {
        eventHub: { dispatch: (event: string, payload: unknown) => void };
      }
    ).eventHub.dispatch('onGroupNotify', {
      eventName: 'onMembersJoined',
      payload: {
        groupId: 'g1',
        memberIds: ['bob'],
      },
    });

    await new Promise(resolve => {
      setTimeout(resolve, 0);
    });

    await expect(client.groupManager.getGroup('g1').getDetail()).resolves.toEqual(
      expect.objectContaining({
        groupId: 'g1',
        name: 'Group 1',
        memberCount: 2,
      })
    );
    expect(getSpy).toHaveBeenCalledTimes(1);
  });

  it('onMembersJoined 在 memberCount 未知时应先标记内部 detail stale，后续 getDetail 触发受控补拉', async () => {
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
        currentUserId: string | null;
        restBaseUrl: string | null;
        authToken: string | null;
        clientResource: string | null;
      }
    ).currentUserId = 'alice';
    (
      client as unknown as {
        restBaseUrl: string | null;
        authToken: string | null;
        clientResource: string | null;
      }
    ).restBaseUrl = 'https://api.example.com';
    (
      client as unknown as {
        authToken: string | null;
        clientResource: string | null;
      }
    ).authToken = 'token';
    ((client as unknown as { clientResource: string | null }).clientResource = 'web');

    let groupDetailVersion = 0;
    const getSpy = vi.spyOn(RestClient.prototype, 'get').mockImplementation(async () => {
      groupDetailVersion += 1;
      return {
        data: [
          {
            id: 'g1',
            name: 'Group 1',
            ...(groupDetailVersion === 1 ? {} : { affiliations_count: '2' }),
          },
        ],
      };
    });
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

    await expect(client.groupManager.getGroup('g1').getDetail()).resolves.toEqual(
      expect.objectContaining({
        groupId: 'g1',
        name: 'Group 1',
      })
    );

    (
      client as unknown as {
        eventHub: { dispatch: (event: string, payload: unknown) => void };
      }
    ).eventHub.dispatch('onGroupNotify', {
      eventName: 'onMembersJoined',
      payload: {
        groupId: 'g1',
        memberIds: ['bob'],
      },
    });

    await new Promise(resolve => {
      setTimeout(resolve, 0);
    });

    await expect(client.groupManager.getGroup('g1').getDetail()).resolves.toEqual(
      expect.objectContaining({
        groupId: 'g1',
        name: 'Group 1',
        memberCount: 2,
      })
    );
    expect(getSpy).toHaveBeenCalledTimes(2);
  });

  it('onMembersExited 在 memberCount 已知时应按批量人数 patch 内部 detail', async () => {
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
        currentUserId: string | null;
        restBaseUrl: string | null;
        authToken: string | null;
        clientResource: string | null;
      }
    ).currentUserId = 'alice';
    (
      client as unknown as {
        restBaseUrl: string | null;
        authToken: string | null;
        clientResource: string | null;
      }
    ).restBaseUrl = 'https://api.example.com';
    (
      client as unknown as {
        authToken: string | null;
        clientResource: string | null;
      }
    ).authToken = 'token';
    ((client as unknown as { clientResource: string | null }).clientResource = 'web');

    const getSpy = vi.spyOn(RestClient.prototype, 'get').mockResolvedValue({
      data: [
        {
          id: 'g1',
          name: 'Group 1',
          affiliations_count: '3',
        },
      ],
    });
    vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({
      timestamp: 1,
      data: {
        bob: {
          nickname: 'Bob',
        },
        carol: {
          nickname: 'Carol',
        },
      },
      lastModified: {
        bob: 1,
        carol: 1,
      },
      duration: 1,
    });

    const onMembersExited = vi.fn();
    client.groupManager.addEventHandler('group-members-exited', {
      onMembersExited,
    });

    await expect(client.groupManager.getGroup('g1').getDetail()).resolves.toEqual(
      expect.objectContaining({
        groupId: 'g1',
        name: 'Group 1',
        memberCount: 3,
      })
    );

    (
      client as unknown as {
        eventHub: { dispatch: (event: string, payload: unknown) => void };
      }
    ).eventHub.dispatch('onGroupNotify', {
      eventName: 'onMembersExited',
      payload: {
        groupId: 'g1',
        memberIds: ['bob', 'carol'],
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
        {
          userId: 'carol',
          nickname: 'Carol',
        },
      ],
    });
    await expect(client.groupManager.getGroup('g1').getDetail()).resolves.toEqual(
      expect.objectContaining({
        groupId: 'g1',
        name: 'Group 1',
        memberCount: 1,
      })
    );
    expect(getSpy).toHaveBeenCalledTimes(1);
  });

  it('onMembersExited 在 memberCount 未知时应先标记内部 detail stale，后续 getDetail 触发受控补拉', async () => {
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
        currentUserId: string | null;
        restBaseUrl: string | null;
        authToken: string | null;
        clientResource: string | null;
      }
    ).currentUserId = 'alice';
    (
      client as unknown as {
        restBaseUrl: string | null;
        authToken: string | null;
        clientResource: string | null;
      }
    ).restBaseUrl = 'https://api.example.com';
    (
      client as unknown as {
        authToken: string | null;
        clientResource: string | null;
      }
    ).authToken = 'token';
    ((client as unknown as { clientResource: string | null }).clientResource = 'web');

    let groupDetailVersion = 0;
    const getSpy = vi.spyOn(RestClient.prototype, 'get').mockImplementation(async () => {
      groupDetailVersion += 1;
      return {
        data: [
          {
            id: 'g1',
            name: 'Group 1',
            ...(groupDetailVersion === 1 ? {} : { affiliations_count: '1' }),
          },
        ],
      };
    });
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
    client.groupManager.addEventHandler('group-member-exited', {
      onMembersExited,
    });

    await expect(client.groupManager.getGroup('g1').getDetail()).resolves.toEqual(
      expect.objectContaining({
        groupId: 'g1',
        name: 'Group 1',
      })
    );

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
    await expect(client.groupManager.getGroup('g1').getDetail()).resolves.toEqual(
      expect.objectContaining({
        groupId: 'g1',
        name: 'Group 1',
        memberCount: 1,
      })
    );
    expect(getSpy).toHaveBeenCalledTimes(2);
  });

  it('onGroupDestroyed 应清理内部 detail，后续 getDetail 必须重新拉取', async () => {
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
        currentUserId: string | null;
        restBaseUrl: string | null;
        authToken: string | null;
        clientResource: string | null;
      }
    ).currentUserId = 'alice';
    (
      client as unknown as {
        restBaseUrl: string | null;
        authToken: string | null;
        clientResource: string | null;
      }
    ).restBaseUrl = 'https://api.example.com';
    (
      client as unknown as {
        authToken: string | null;
        clientResource: string | null;
      }
    ).authToken = 'token';
    ((client as unknown as { clientResource: string | null }).clientResource = 'web');

    let groupDetailVersion = 0;
    const getSpy = vi.spyOn(RestClient.prototype, 'get').mockImplementation(async () => {
      groupDetailVersion += 1;
      return {
        data: [
          {
            id: 'g1',
            name: groupDetailVersion === 1 ? 'Group 1' : 'Group 1 Reloaded',
          },
        ],
      };
    });

    const onGroupDestroyed = vi.fn();
    client.groupManager.addEventHandler('group-destroyed', {
      onGroupDestroyed,
    });

    await expect(client.groupManager.getGroup('g1').getDetail()).resolves.toEqual({
      groupId: 'g1',
      name: 'Group 1',
    });

    (
      client as unknown as {
        eventHub: { dispatch: (event: string, payload: unknown) => void };
      }
    ).eventHub.dispatch('onGroupNotify', {
      eventName: 'onGroupDestroyed',
      payload: {
        groupId: 'g1',
        groupName: 'Group 1',
      },
    });

    await new Promise(resolve => {
      setTimeout(resolve, 0);
    });

    expect(onGroupDestroyed).toHaveBeenCalledWith({
      groupId: 'g1',
      groupName: 'Group 1',
    });
    await expect(client.groupManager.getGroup('g1').getDetail()).resolves.toEqual({
      groupId: 'g1',
      name: 'Group 1 Reloaded',
    });
    expect(getSpy).toHaveBeenCalledTimes(2);
  });

  it('onAnnouncementChanged / onSharedFileAdded / onGroupMemberAttributeChanged 应保持对象化载荷语义', async () => {
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
        currentUserId: string | null;
        restBaseUrl: string | null;
        authToken: string | null;
        clientResource: string | null;
      }
    ).currentUserId = 'alice';
    (
      client as unknown as {
        restBaseUrl: string | null;
        authToken: string | null;
        clientResource: string | null;
      }
    ).restBaseUrl = 'https://api.example.com';
    (
      client as unknown as {
        authToken: string | null;
        clientResource: string | null;
      }
    ).authToken = 'token';
    ((client as unknown as { clientResource: string | null }).clientResource = 'web');

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

    const onAnnouncementChanged = vi.fn();
    const onSharedFileAdded = vi.fn();
    const onGroupMemberAttributeChanged = vi.fn();

    client.groupManager.addEventHandler('group-high-level-events', {
      onAnnouncementChanged,
      onSharedFileAdded,
      onGroupMemberAttributeChanged,
    });

    (
      client as unknown as {
        eventHub: { dispatch: (event: string, payload: unknown) => void };
      }
    ).eventHub.dispatch('onGroupNotify', {
      eventName: 'onAnnouncementChanged',
      payload: {
        groupId: 'g1',
        announcement: 'notice',
      },
    });
    (
      client as unknown as {
        eventHub: { dispatch: (event: string, payload: unknown) => void };
      }
    ).eventHub.dispatch('onGroupNotify', {
      eventName: 'onSharedFileAdded',
      payload: {
        groupId: 'g1',
        sharedFile: {
          fileId: 'f1',
          fileName: 'a.txt',
          fileOwner: {
            userId: 'bob',
          },
        },
      },
    });
    (
      client as unknown as {
        eventHub: { dispatch: (event: string, payload: unknown) => void };
      }
    ).eventHub.dispatch('onGroupNotify', {
      eventName: 'onGroupMemberAttributeChanged',
      payload: {
        groupId: 'g1',
        userId: 'bob',
        attribute: {
          group_name_card: 'Team Bob',
        },
        from: 'alice',
        source: 'multiDevice',
      },
    });

    await new Promise(resolve => {
      setTimeout(resolve, 0);
    });

    expect(onAnnouncementChanged).toHaveBeenCalledWith({
      groupId: 'g1',
      announcement: 'notice',
    });
    expect(onSharedFileAdded).toHaveBeenCalledWith({
      groupId: 'g1',
      sharedFile: expect.objectContaining({
        fileId: 'f1',
        fileName: 'a.txt',
        fileOwner: {
          userId: 'bob',
          nickname: 'Bob',
        },
      }),
    });
    expect(onGroupMemberAttributeChanged).toHaveBeenCalledWith({
      groupId: 'g1',
      user: {
        userId: 'bob',
        nickname: 'Bob',
      },
      attribute: {
        group_name_card: 'Team Bob',
      },
      from: 'alice',
      source: 'multiDevice',
    });
  });
});
