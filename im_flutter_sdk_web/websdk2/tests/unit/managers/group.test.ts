import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChatClient } from '@/chat-client';
import { Group } from '@/managers/group';
import { GroupManager } from '@/managers/group-manager';
import { RestClient } from '@/rest/client';
import type { RestContext } from '@/types/chat-client';

const DEFAULT_REST_CONTEXT: RestContext = {
  restBaseUrl: 'https://api.example.com',
  appKey: 'org#app',
  userId: 'alice',
  token: 'token',
  clientResource: 'web',
};

const createMockClient = (): ChatClient =>
  ({
    getRestContext: (): RestContext => DEFAULT_REST_CONTEXT,
    getCacheManager: (): null => null,
    getCurrentUserId: (): string | null => DEFAULT_REST_CONTEXT.userId,
  }) as unknown as ChatClient;

describe('Group', () => {
  let manager: GroupManager;

  beforeEach((): void => {
    manager = new GroupManager();
    manager.bind(createMockClient());
  });

  afterEach((): void => {
    vi.restoreAllMocks();
  });

  it('getAdmins 应复用现有对象化补齐链路', async () => {
    vi.spyOn(RestClient.prototype, 'request').mockImplementation(
      async (_endpoint: string, config?: { operation?: string }): Promise<unknown> => {
        if (config?.operation === 'getGroupAdminList') {
          return {
            data: ['bob'],
          };
        }
        if (config?.operation === 'getUserInfoByUserId') {
          return {
            data: {
              bob: {
                nickname: 'Bob',
                avatarurl: 'https://cdn.example.com/bob.png',
              },
            },
            lastModified: {
              bob: 1,
            },
          };
        }
        return {};
      }
    );

    const group = manager.getGroup('g1');
    const admins = await group.getAdmins();

    expect(admins).toEqual([
      {
        userId: 'bob',
        nickname: 'Bob',
        avatarUrl: 'https://cdn.example.com/bob.png',
      },
    ]);
  });

  it('updateInfo 应把 groupId 绑定到单群上下文里', async () => {
    const requestSpy = vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({});
    const group = manager.getGroup('g1');

    await group.updateInfo({
      name: 'Group 1',
      description: 'desc',
    });

    expect(requestSpy).toHaveBeenCalledWith('/org/app/chatgroups/g1?resource=web&version=v3', {
      method: 'PUT',
      body: {
        groupname: 'Group 1',
        description: 'desc',
      },
      operation: 'updateGroupInfo',
    });
  });

  it('updateConfigs 应把 groupId 绑定到单群上下文里', async () => {
    const requestSpy = vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({});
    const group = manager.getGroup('g1');

    await group.updateConfigs({
      public: true,
      maxMembers: 200,
    });

    expect(requestSpy).toHaveBeenCalledWith('/org/app/chatgroups/g1?resource=web&version=v3', {
      method: 'PUT',
      body: {
        public: true,
        maxusers: 200,
      },
      operation: 'updateGroupInfo',
    });
  });

  it('getDetail 应优先复用 repository 已知 detail，refresh 强制补拉并保持快照隔离', async () => {
    const requestSpy = vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({
      data: [
        {
          id: 'g1',
          name: 'Group 1',
        },
      ],
    });

    const group = manager.getGroup('g1');
    const first = await group.getDetail();
    const second = await group.getDetail();
    const refreshed = await group.refresh();

    expect(first).not.toBe(second);
    expect(second).not.toBe(refreshed);
    const mutated = first as { name: string };
    mutated.name = 'Mutated';
    expect(second).toEqual({
      groupId: 'g1',
      name: 'Group 1',
    });
    expect(refreshed).toEqual({
      groupId: 'g1',
      name: 'Group 1',
    });
    expect(requestSpy).toHaveBeenCalledTimes(2);
  });

  it('getSummary 应暴露已知轻量摘要且不把 getDetail 隐式触发', async () => {
    const requestSpy = vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({
      data: [
        {
          id: 'g1',
          name: 'Group 1 Detail',
        },
      ],
    });
    manager.applyJoinedGroupSnapshot({
      items: [
        {
          groupId: 'g1',
          name: 'Group 1',
          avatarUrl: 'https://cdn.example.com/g1.png',
          remindType: 'NONE',
        },
      ],
      meta: {
        integrity: 'synced',
        limited: false,
        storageLimit: 100,
        serverLimit: 3000,
        source: 'sync',
      },
    });

    const group = manager.getGroup('g1');
    const summary = group.getSummary();

    expect(summary).toEqual({
      groupId: 'g1',
      name: 'Group 1',
      avatarUrl: 'https://cdn.example.com/g1.png',
      remindType: 'NONE',
    });
    expect(requestSpy).not.toHaveBeenCalled();

    await expect(group.getDetail()).resolves.toEqual({
      groupId: 'g1',
      name: 'Group 1 Detail',
    });
    expect(requestSpy).toHaveBeenCalledTimes(1);
  });

  it('高阶单群 API 应通过 manager 真实链路返回归一化结果', async () => {
    vi.spyOn(RestClient.prototype, 'request').mockImplementation(
      async (_endpoint: string, config?: { operation?: string }): Promise<unknown> => {
        switch (config?.operation) {
          case 'getGroupAnnouncement':
            return {
              announcement: 'notice',
            };
          case 'getGroupSharedFileList':
            return {
              data: [
                {
                  file_id: 'f1',
                  file_name: 'a.txt',
                  file_owner: 'bob',
                },
              ],
            };
          case 'getGroupMembersAttributes':
            return {
              data: {
                bob: {
                  role: 'admin',
                },
              },
            };
          case 'getUserInfoByUserId':
            return {
              data: {
                bob: {
                  nickname: 'Bob',
                },
              },
              lastModified: {
                bob: 1,
              },
            };
          default:
            return {};
        }
      }
    );

    const group = manager.getGroup('g1');

    await expect(group.getAnnouncement()).resolves.toEqual({
      announcement: 'notice',
    });
    await expect(group.getSharedFileList()).resolves.toEqual({
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
      pageNum: undefined,
      pageSize: undefined,
    });
    await expect(
      group.getMembersAttributes({
        userIds: ['bob'],
        keys: ['role'],
      })
    ).resolves.toEqual({
      items: {
        bob: {
          role: 'admin',
        },
      },
    });
  });

  it('应将大部分单群 API 委托到带 groupId 的 manager 方法', async () => {
    const managerStub = {
      getGroupDetailForHandle: vi.fn().mockResolvedValue({ groupId: 'g1' }),
      refreshGroupDetailForHandle: vi.fn().mockResolvedValue({ groupId: 'g1' }),
      updateGroupInfo: vi.fn().mockResolvedValue(undefined),
      changeGroupOwner: vi.fn().mockResolvedValue(undefined),
      destroyGroup: vi.fn().mockResolvedValue(undefined),
      leaveGroup: vi.fn().mockResolvedValue(undefined),
      getGroupMemberList: vi.fn().mockResolvedValue({ items: [] }),
      removeGroupMembers: vi.fn().mockResolvedValue(undefined),
      getGroupAdminList: vi.fn().mockResolvedValue([]),
      addGroupAdmin: vi.fn().mockResolvedValue(undefined),
      removeGroupAdmin: vi.fn().mockResolvedValue(undefined),
      getGroupMuteList: vi.fn().mockResolvedValue([]),
      muteGroupMembers: vi.fn().mockResolvedValue(undefined),
      unmuteGroupMembers: vi.fn().mockResolvedValue(undefined),
      muteAllGroupMembers: vi.fn().mockResolvedValue(undefined),
      unmuteAllGroupMembers: vi.fn().mockResolvedValue(undefined),
      getGroupBlocklist: vi.fn().mockResolvedValue([]),
      blockGroupMembers: vi.fn().mockResolvedValue(undefined),
      unblockGroupMembers: vi.fn().mockResolvedValue(undefined),
      getGroupAllowlist: vi.fn().mockResolvedValue([]),
      addUsersToGroupAllowlist: vi.fn().mockResolvedValue(undefined),
      removeUsersFromGroupAllowlist: vi.fn().mockResolvedValue(undefined),
      checkIfInGroupAllowList: vi.fn().mockResolvedValue(true),
      checkIfInGroupMuteList: vi.fn().mockResolvedValue(false),
      getGroupAnnouncement: vi.fn().mockResolvedValue({ announcement: 'notice' }),
      updateGroupAnnouncement: vi.fn().mockResolvedValue(undefined),
      getGroupSharedFileList: vi.fn().mockResolvedValue({ cursor: '', items: [] }),
      uploadGroupSharedFile: vi.fn().mockResolvedValue(undefined),
      deleteGroupSharedFile: vi.fn().mockResolvedValue(undefined),
      downloadGroupSharedFile: vi.fn().mockResolvedValue(undefined),
      setGroupMemberAttributes: vi.fn().mockResolvedValue(undefined),
      getGroupMembersAttributes: vi.fn().mockResolvedValue({ items: {} }),
    };

    const group = new Group('g1', managerStub as unknown as GroupManager);

    await group.getDetail();
    await group.refresh();
    await group.updateInfo({ name: 'Group 1' });
    await group.updateConfigs({ public: true });
    await group.changeOwner({ newOwner: 'bob' });
    await group.destroy();
    await group.leave();
    await group.getMembers({ pageSize: 20, cursor: 'abc' });
    await group.removeMembers({ userIds: ['bob', 'carol'] });
    await group.getAdmins();
    await group.addAdmin({ userId: 'bob' });
    await group.removeAdmin({ userId: 'bob' });
    await group.getMuteList();
    await group.getMuteList({ pageNum: 1, pageSize: 10 });
    await group.muteMembers({ userIds: ['bob'], muteDuration: 60 });
    await group.unmuteMembers({ userIds: ['bob'] });
    await group.muteAllMembers();
    await group.unmuteAllMembers();
    await group.getBlocklist();
    await group.blockMembers({ userIds: ['bob'] });
    await group.unblockMembers({ userIds: ['bob'] });
    await group.getAllowlist();
    await group.addUsersToAllowlist({ userIds: ['bob'] });
    await group.removeUsersFromAllowlist({ userIds: ['bob'] });
    await group.checkIfInAllowList();
    await group.checkIfInMuteList();
    await group.getAnnouncement();
    await group.updateAnnouncement({ announcement: 'updated' });
    await group.getSharedFileList({ pageNum: 1, pageSize: 10 });
    await group.uploadSharedFile({ file: new Blob(['hello']) });
    await group.deleteSharedFile({ fileId: 'f1' });
    await group.downloadSharedFile({ fileId: 'f1', secret: 'secret' });
    await group.setMemberAttributes({
      userId: 'bob',
      memberAttributes: { role: 'admin' },
    });
    await group.getMembersAttributes({ userIds: ['bob'], keys: ['role'] });

    expect(managerStub.getGroupDetailForHandle).toHaveBeenCalledWith('g1');
    expect(managerStub.refreshGroupDetailForHandle).toHaveBeenCalledWith('g1');
    expect(managerStub.updateGroupInfo).toHaveBeenCalledWith({ groupId: 'g1', name: 'Group 1' });
    expect(managerStub.changeGroupOwner).toHaveBeenCalledWith({ groupId: 'g1', newOwner: 'bob' });
    expect(managerStub.destroyGroup).toHaveBeenCalledWith({ groupId: 'g1' });
    expect(managerStub.leaveGroup).toHaveBeenCalledWith({ groupId: 'g1' });
    expect(managerStub.getGroupMemberList).toHaveBeenCalledWith({
      groupId: 'g1',
      pageSize: 20,
      cursor: 'abc',
    });
    expect(managerStub.removeGroupMembers).toHaveBeenCalledWith({
      groupId: 'g1',
      userIds: ['bob', 'carol'],
    });
    expect(managerStub.addGroupAdmin).toHaveBeenCalledWith({ groupId: 'g1', userId: 'bob' });
    expect(managerStub.removeGroupAdmin).toHaveBeenCalledWith({ groupId: 'g1', userId: 'bob' });
    expect(managerStub.muteGroupMembers).toHaveBeenCalledWith({
      groupId: 'g1',
      userIds: ['bob'],
      muteDuration: 60,
    });
    expect(managerStub.checkIfInGroupAllowList).toHaveBeenCalledWith({ groupId: 'g1' });
    expect(managerStub.uploadGroupSharedFile).toHaveBeenCalledWith({
      groupId: 'g1',
      file: expect.any(Blob),
    });
    expect(managerStub.downloadGroupSharedFile).toHaveBeenCalledWith({
      groupId: 'g1',
      fileId: 'f1',
      secret: 'secret',
    });
    expect(managerStub.getGroupMembersAttributes).toHaveBeenCalledWith({
      groupId: 'g1',
      userIds: ['bob'],
      keys: ['role'],
    });
  });
});
