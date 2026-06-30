// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ChatClient } from '@/chat-client';
import { GroupManager } from '@/managers/group-manager';
import { ERROR_CODES } from '@/utils/error-codes';
import {
  startMockRestServer,
  type MockRestRequest,
  type MockRestServerController,
} from '../../test-utils/layered/mock-rest-server';

type ClientWithManagers = ChatClient & {
  readonly groupManager: GroupManager;
};

type ChatClientInternal = {
  restBaseUrl: string | null;
  authToken: string | null;
  currentUserId: string | null;
  clientResource: string | null;
  cacheManager?: {
    getUserInfoSummaries?: (
      userIds: ReadonlyArray<string>,
      updateAccess: boolean
    ) => ReadonlyArray<{
      userId: string;
      nickname?: string;
      avatarUrl?: string;
      sign?: string;
      ext?: string;
      lastAccess?: number;
      lastUpdate?: number;
    }>;
    setUserInfoSummaries?: (
      items: ReadonlyArray<{
        userId: string;
        nickname?: string;
        avatarUrl?: string;
        sign?: string;
        ext?: string;
        lastAccess?: number;
        lastUpdate?: number;
      }>
    ) => void;
  } | null;
};

const resetSingleton = (): void => {
  (ChatClient as unknown as { instance: ChatClient | null }).instance = null;
};

const primeRestContext = (client: ChatClient, baseUrl: string): void => {
  const internal = client as unknown as ChatClientInternal;
  internal.restBaseUrl = baseUrl;
  internal.authToken = 'mock-token';
  internal.currentUserId = 'alice';
  internal.clientResource = 'web';
};

const expectJsonBody = (request: MockRestRequest): Record<string, unknown> => {
  if (
    !request.jsonBody ||
    typeof request.jsonBody !== 'object' ||
    Array.isArray(request.jsonBody)
  ) {
    throw new Error('Expected JSON object body');
  }
  return request.jsonBody as Record<string, unknown>;
};

describe('group-manager integration', () => {
  let server: MockRestServerController;
  let client: ClientWithManagers;

  beforeEach(async () => {
    resetSingleton();
    server = await startMockRestServer();
    client = ChatClient.init({ appKey: 'org#app' }).use(GroupManager) as ClientWithManagers;
    primeRestContext(client, server.baseUrl);
  });

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
    resetSingleton();
  });

  it('getJoinedGroupList 应返回本地已加入群组列表', () => {
    client.groupManager.applyJoinedGroupSnapshot({
      items: [
        {
          groupId: 'g1',
          name: 'Group 1',
          description: 'desc',
          public: true,
          joinApprovalRequired: false,
          allowInvites: true,
          maxMembers: 200,
          role: 'owner',
        },
      ],
      meta: {
        integrity: 'synced',
        limited: false,
        storageLimit: 100,
        serverLimit: 3000,
        source: 'sync',
        lastSyncFinishedTs: 123,
      },
    });

    const result = client.groupManager.getJoinedGroupList();

    expect(result).toEqual([
      {
        groupId: 'g1',
        name: 'Group 1',
        description: 'desc',
        public: true,
        joinApprovalRequired: false,
        allowInvites: true,
        maxMembers: 200,
        role: 'owner',
      },
    ]);
    expect(client.groupManager.getJoinedGroupSnapshotForSync().meta).toMatchObject({
      integrity: 'synced',
      source: 'sync',
      lastSyncFinishedTs: 123,
    });
  });

  it('Group.getDetail 应优先复用 repository 快照，refresh 再触发强制补拉', async () => {
    let getGroupInfoRequestCount = 0;

    server.on('GET', '/org/app/chatgroups/g1', request => {
      expect(request.query.get('joined_time')).toBe('true');
      expect(request.query.get('version')).toBe('v3');
      getGroupInfoRequestCount += 1;
      return {
        status: 200,
        body: {
          data: [
            {
              id: 'g1',
              name: `Group 1 v${getGroupInfoRequestCount}`,
              permission: 'member',
            },
          ],
        },
      };
    });

    const group = client.groupManager.getGroup('g1');
    const first = await group.getDetail();
    const second = await group.getDetail();
    const refreshed = await group.refresh();

    expect(first).toEqual({
      groupId: 'g1',
      name: 'Group 1 v1',
      role: 'member',
    });
    expect(second).toEqual({
      groupId: 'g1',
      name: 'Group 1 v1',
      role: 'member',
    });
    expect(refreshed).toEqual({
      groupId: 'g1',
      name: 'Group 1 v2',
      role: 'member',
    });
    expect(getGroupInfoRequestCount).toBe(2);
  });

  it('Group.leave 成功后应清理对应 runtime，后续 getDetail 重新拉取', async () => {
    let getGroupInfoRequestCount = 0;

    server.on('GET', '/org/app/chatgroups/g1', request => {
      expect(request.query.get('joined_time')).toBe('true');
      expect(request.query.get('version')).toBe('v3');
      getGroupInfoRequestCount += 1;
      return {
        status: 200,
        body: {
          data: [
            {
              id: 'g1',
              name: `Group 1 v${getGroupInfoRequestCount}`,
            },
          ],
        },
      };
    });
    server.on('DELETE', '/org/app/chatgroups/g1/quit', request => {
      expect(request.query.get('resource')).toBe('web');
      return {
        status: 200,
        body: {},
      };
    });

    const group = client.groupManager.getGroup('g1');

    await expect(group.getDetail()).resolves.toEqual({
      groupId: 'g1',
      name: 'Group 1 v1',
    });
    await group.leave();
    await expect(group.getDetail()).resolves.toEqual({
      groupId: 'g1',
      name: 'Group 1 v2',
    });
    expect(getGroupInfoRequestCount).toBe(2);
  });

  it('Group.destroy 成功后应清理对应 runtime，后续 getDetail 重新拉取', async () => {
    let getGroupInfoRequestCount = 0;

    server.on('GET', '/org/app/chatgroups/g1', request => {
      expect(request.query.get('joined_time')).toBe('true');
      expect(request.query.get('version')).toBe('v3');
      getGroupInfoRequestCount += 1;
      return {
        status: 200,
        body: {
          data: [
            {
              id: 'g1',
              name: `Group 1 v${getGroupInfoRequestCount}`,
            },
          ],
        },
      };
    });
    server.on('DELETE', '/org/app/chatgroups/g1', request => {
      expect(request.query.get('version')).toBe('v3');
      expect(request.query.get('resource')).toBe('web');
      return {
        status: 200,
        body: {},
      };
    });

    const group = client.groupManager.getGroup('g1');

    await expect(group.getDetail()).resolves.toEqual({
      groupId: 'g1',
      name: 'Group 1 v1',
    });
    await group.destroy();
    await expect(group.getDetail()).resolves.toEqual({
      groupId: 'g1',
      name: 'Group 1 v2',
    });
    expect(getGroupInfoRequestCount).toBe(2);
  });

  it('会话切换后应清理旧会话的 group runtime 与 handle registry', async () => {
    let currentToken = 'mock-token';
    let currentUserId = 'alice';
    const internal = client as unknown as ChatClientInternal;
    internal.authToken = currentToken;
    internal.currentUserId = currentUserId;

    server.on('GET', '/org/app/chatgroups/g1', request => {
      expect(request.headers.authorization).toBe(`Bearer ${currentToken}`);
      return {
        status: 200,
        body: {
          data: [
            {
              id: 'g1',
              name: `${currentUserId}-group`,
            },
          ],
        },
      };
    });

    const firstHandle = client.groupManager.getGroup('g1');
    const firstDetail = await firstHandle.getDetail();

    currentToken = 'mock-token-bob';
    currentUserId = 'bob';
    internal.authToken = currentToken;
    internal.currentUserId = currentUserId;

    const secondHandle = client.groupManager.getGroup('g1');
    const secondDetail = await secondHandle.getDetail();

    expect(firstHandle).not.toBe(secondHandle);
    expect(firstDetail).toEqual({
      groupId: 'g1',
      name: 'alice-group',
    });
    expect(secondDetail).toEqual({
      groupId: 'g1',
      name: 'bob-group',
    });
  });

  it('Group.getMembers 应通过真实 RestClient 链路对象化成员并允许最小视图回退', async () => {
    server.on('GET', '/org/app/chatgroups/g1/users', request => {
      expect(request.headers.authorization).toBe('Bearer mock-token');
      expect(request.query.get('pagesize')).toBe('20');
      return {
        status: 200,
        body: {
          data: [
            {
              owner: 'owner1',
              joined_time: 1,
            },
            {
              member: 'member1',
              joined_time: 2,
            },
          ],
          params: {
            pagenum: ['2'],
            pagesize: ['20'],
          },
        },
      };
    });
    server.on('POST', '/org/app/metadata/user/get', request => {
      expect(expectJsonBody(request)).toEqual({
        targets: ['owner1', 'member1'],
      });
      return {
        status: 200,
        body: {
          data: {
            member1: {
              nickname: 'Member 1',
            },
          },
        },
      };
    });

    const result = await client.groupManager.getGroup('g1').getMembers({
      pageSize: 20,
    });

    expect(result).toEqual({
      items: [
        {
          user: {
            userId: 'owner1',
          },
          role: 'owner',
          joinedAt: 1,
        },
        {
          user: {
            userId: 'member1',
            nickname: 'Member 1',
          },
          role: 'member',
          joinedAt: 2,
        },
      ],
      pageNum: 2,
      pageSize: 20,
    });
  });

  it('inviteUsersToGroup 遇到业务错误时应保留统一错误模型信息', async () => {
    server.on('POST', '/org/app/chatgroups/g1/invite', request => {
      expect(request.query.get('resource')).toBe('web');
      expect(expectJsonBody(request)).toEqual({
        usernames: ['bob', 'carol'],
      });
      return {
        status: 400,
        body: {
          error: 'group_authorization',
          error_description: 'not allowed to invite users',
        },
      };
    });

    await expect(
      client.groupManager.inviteUsersToGroup({
        groupId: 'g1',
        userIds: ['bob', 'bob', 'carol'],
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.GROUP_PERMISSION_DENIED,
      details: {
        api: 'inviteUsersToGroup',
        mapped: true,
        reasonKey: 'group_authorization',
        serverCode: 'group_authorization',
        serverMessage: 'not allowed to invite users',
        httpStatus: 400,
        canonicalCode: ERROR_CODES.GROUP_PERMISSION_DENIED,
      },
    });
  });

  it('client.groupManager 主路径应完成基础 mutation，并允许通过 Group facade 继续更新/解散', async () => {
    server.on('POST', '/org/app/chatgroups', request => {
      expect(request.query.get('resource')).toBe('web');
      expect(expectJsonBody(request)).toEqual({
        owner: 'alice',
        groupname: 'Created Group',
        desc: 'desc',
        members: ['bob'],
        public: false,
        approval: true,
        allowinvites: true,
        invite_need_confirm: true,
        maxusers: undefined,
        custom: undefined,
        avatar: undefined,
      });
      return {
        status: 200,
        body: {
          data: {
            id: 'g-created',
          },
        },
      };
    });
    server.on('PUT', '/org/app/chatgroups/g-created', request => {
      expect(request.query.get('resource')).toBe('web');
      expect(expectJsonBody(request)).toEqual({
        groupname: 'Updated Group',
      });
      return {
        status: 200,
        body: {},
      };
    });
    server.on('DELETE', '/org/app/chatgroups/g-created', request => {
      expect(request.query.get('version')).toBe('v3');
      expect(request.query.get('resource')).toBe('web');
      return {
        status: 200,
        body: {},
      };
    });

    const created = await client.groupManager.createGroup({
      name: 'Created Group',
      description: 'desc',
      memberIds: ['bob'],
      public: false,
      joinApprovalRequired: true,
      allowInvites: true,
      inviteNeedConfirm: true,
    });
    const group = client.groupManager.getGroup(created.groupId);

    await group.updateInfo({
      name: 'Updated Group',
    });
    await group.destroy();

    expect(created).toEqual({
      groupId: 'g-created',
    });
  });

  it('Group.getAdmins 应优先命中缓存、缺口补拉，并对剩余缺失用户回退最小视图', async () => {
    const internal = client as unknown as ChatClientInternal;
    internal.cacheManager = {
      getUserInfoSummaries: (userIds): ReadonlyArray<{
        userId: string;
        nickname?: string;
        lastAccess?: number;
        lastUpdate?: number;
      }> =>
        userIds.includes('cached')
          ? [
              {
                userId: 'cached',
                nickname: 'Cached User',
                lastAccess: 1,
                lastUpdate: 1,
              },
            ]
          : [],
      setUserInfoSummaries: (): void => {},
    };

    server.on('GET', '/org/app/chatgroups/g1/admin', () => {
      return {
        status: 200,
        body: {
          data: ['cached', 'fetched', 'missing'],
        },
      };
    });
    server.on('POST', '/org/app/metadata/user/get', request => {
      expect(expectJsonBody(request)).toEqual({
        targets: ['fetched', 'missing'],
      });
      return {
        status: 200,
        body: {
          data: {
            fetched: {
              nickname: 'Fetched User',
            },
          },
        },
      };
    });

    const admins = await client.groupManager.getGroup('g1').getAdmins();

    expect(admins).toEqual([
      {
        userId: 'cached',
        nickname: 'Cached User',
      },
      {
        userId: 'fetched',
        nickname: 'Fetched User',
      },
      {
        userId: 'missing',
      },
    ]);
  });

  it('Group 高阶读取 API 应返回公告、共享文件与成员属性归一化结果', async () => {
    server.on('GET', '/org/app/chatgroups/g1/announcement', request => {
      expect(request.headers.authorization).toBe('Bearer mock-token');
      return {
        status: 200,
        body: {
          announcement: 'notice',
        },
      };
    });
    server.on('GET', '/org/app/chatgroups/g1/sharefiles', request => {
      expect(request.query.get('pagenum')).toBe('1');
      expect(request.query.get('pagesize')).toBe('10');
      return {
        status: 200,
        body: {
          data: [
            {
              file_id: 'f1',
              file_name: 'a.txt',
              file_owner: 'bob',
            },
          ],
          params: {
            pagenum: ['1'],
            pagesize: ['10'],
          },
        },
      };
    });
    server.on('POST', '/org/app/sdk/metadata/chatgroup/g1/get', request => {
      const body = expectJsonBody(request);
      if (JSON.stringify(body.targets) === JSON.stringify(['bob'])) {
        expect(body).toEqual({
          targets: ['bob'],
          properties: ['role'],
        });
        return {
          status: 200,
          body: {
            data: {
              bob: {
                role: 'admin',
              },
            },
          },
        };
      }
      throw new Error('Unexpected metadata request');
    });
    server.on('POST', '/org/app/metadata/user/get', request => {
      const body = expectJsonBody(request);
      if (JSON.stringify(body.targets) === JSON.stringify(['bob'])) {
        return {
          status: 200,
          body: {
            data: {
              bob: {
                nickname: 'Bob',
              },
            },
          },
        };
      }
      expect(body).toEqual({
        targets: ['bob', 'carol'],
      });
      return {
        status: 200,
        body: {
          data: {
            bob: {
              nickname: 'Bob',
            },
          },
        },
      };
    });

    const group = client.groupManager.getGroup('g1');
    const announcement = await group.getAnnouncement();
    const sharedFiles = await group.getSharedFileList({
      pageNum: 1,
      pageSize: 10,
    });
    const attributes = await group.getMembersAttributes({
      userIds: ['bob'],
      keys: ['role'],
    });

    expect(announcement).toEqual({
      announcement: 'notice',
    });
    expect(sharedFiles).toEqual({
      items: [
        {
          fileId: 'f1',
          fileName: 'a.txt',
          fileOwner: {
            userId: 'bob',
            nickname: 'Bob',
          },
          fileSize: undefined,
          createdAt: undefined,
        },
      ],
      pageNum: 1,
      pageSize: 10,
    });
    expect(attributes.items.bob).toEqual({
      role: 'admin',
    });
  });
});
