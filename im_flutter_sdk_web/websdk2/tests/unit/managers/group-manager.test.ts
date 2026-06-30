import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChatClient } from '@/chat-client';
import { Group } from '@/managers/group';
import { GroupManager } from '@/managers/group-manager';
import { RestClient } from '@/rest/client';
import type { RestContext } from '@/types/chat-client';
import { ERROR_CODES } from '@/utils/error-codes';
import { SDKError } from '@/utils/errors';

const DEFAULT_REST_CONTEXT: RestContext = {
  restBaseUrl: 'https://api.example.com',
  appKey: 'org#app',
  userId: 'alice',
  token: 'token',
  clientResource: 'web',
};

const createMockClient = (options?: {
  readonly restContext?: RestContext;
  readonly cacheManager?: {
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
    setGroupNamecards?: (
      items: ReadonlyArray<{
        groupId: string;
        userId: string;
        namecard: string;
        namecardUpdateTime?: number;
        lastSyncAt?: number;
        lastAccess: number;
        lastUpdate: number;
      }>
    ) => void;
    loadJoinedGroupPreviewSnapshot?: () => import('@/types/group').JoinedGroupSnapshot;
  } | null;
}): ChatClient => {
  const restContext = options?.restContext ?? DEFAULT_REST_CONTEXT;
  const cacheManager = options?.cacheManager ?? null;

  return {
    getRestContext: (): RestContext => restContext,
    getCacheManager: (): typeof cacheManager => cacheManager,
    getCurrentUserId: (): string | null => restContext.userId,
  } as unknown as ChatClient;
};

describe('GroupManager', () => {
  let manager: GroupManager;

  beforeEach((): void => {
    manager = new GroupManager();
    manager.bind(createMockClient());
  });

  afterEach((): void => {
    vi.restoreAllMocks();
  });

  it('addEventHandler/removeEventHandler 应委托给 eventContext', () => {
    const addEventHandler = vi.fn();
    const removeEventHandler = vi.fn();

    manager.bind(createMockClient(), {
      addEventHandler,
      removeEventHandler,
    });

    manager.addEventHandler('group-ui', {
      onInvitationReceived: vi.fn(),
    });
    manager.removeEventHandler('group-ui');

    expect(addEventHandler).toHaveBeenCalledOnce();
    expect(removeEventHandler).toHaveBeenCalledWith('group-ui');
  });

  it('getGroup 应返回可复用的 Group 实例', () => {
    const first = manager.getGroup('g1');
    const second = manager.getGroup('g1');

    expect(first).toBeInstanceOf(Group);
    expect(first).toBe(second);
    expect(first.groupId).toBe('g1');
  });

  it('重新 bind 后应清理旧的 Group handle registry', () => {
    const first = manager.getGroup('g1');

    manager.bind(createMockClient());

    const second = manager.getGroup('g1');

    expect(second).toBeInstanceOf(Group);
    expect(second).not.toBe(first);
  });

  it('会话切换后不应复用旧 handle 与旧 detail 快照', async () => {
    const restContext: RestContext = {
      ...DEFAULT_REST_CONTEXT,
    };
    manager.bind({
      getRestContext: (): RestContext => restContext,
      getCacheManager: (): null => null,
      getCurrentUserId: (): string | null => restContext.userId,
    } as unknown as ChatClient);

    const requestSpy = vi
      .spyOn(RestClient.prototype, 'request')
      .mockImplementation(
        async (_endpoint: string, config?: { operation?: string }): Promise<unknown> => {
          if (config?.operation === 'getGroupInfo') {
            return {
              data: [
                {
                  id: 'g1',
                  name: `${restContext.userId}-group`,
                },
              ],
            };
          }
          return {};
        }
      );

    const firstHandle = manager.getGroup('g1');
    const firstDetail = await firstHandle.getDetail();

    (restContext as { userId: string }).userId = 'bob';
    (restContext as { token: string }).token = 'token-bob';

    const secondHandle = manager.getGroup('g1');
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
    expect(requestSpy).toHaveBeenCalledTimes(2);
  });

  it('getGroup groupId 为空时应抛出 ValidationError', () => {
    try {
      manager.getGroup('   ');
      throw new Error('expected getGroup to throw');
    } catch (error) {
      expect(error).toMatchObject({
        code: ERROR_CODES.VALIDATION_REQUIRED,
      });
    }
  });

  it('未 bind 时调用公开 API 应抛出未绑定错误', async () => {
    const unboundManager = new GroupManager();

    await expect(
      unboundManager.getPublicGroupList({
        limit: 20,
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_REQUIRED,
      message: 'GroupManager is not bound to client',
    });
  });

  it('getGroupInfo 应使用缓存补齐 owner 对象', async () => {
    manager.bind(
      createMockClient({
        cacheManager: {
          getUserInfoSummaries: (
            userIds
          ): ReadonlyArray<{
            userId: string;
            nickname?: string;
            avatarUrl?: string;
            sign?: string;
            ext?: string;
          }> =>
            userIds.includes('owner')
              ? [
                  {
                    userId: 'owner',
                    nickname: 'Owner',
                    avatarUrl: 'https://cdn.example.com/owner.png',
                  },
                ]
              : [],
          setUserInfoSummaries: (): void => {},
        },
      })
    );

    const requestSpy = vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({
      data: [
        {
          id: 'g1',
          name: 'Group 1',
          owner: 'owner',
        },
      ],
    });

    const result = await manager.getGroupInfo({
      groupId: 'g1',
    });

    expect(result).toMatchObject({
      groupId: 'g1',
      name: 'Group 1',
      owner: {
        userId: 'owner',
        nickname: 'Owner',
        avatarUrl: 'https://cdn.example.com/owner.png',
      },
    });
    expect(requestSpy).toHaveBeenCalledTimes(1);
  });

  it('getGroupInfo 应从本地已加入群快照补齐 joinedAt', async () => {
    manager.applyJoinedGroupSnapshot({
      items: [
        {
          groupId: 'g1',
          name: 'Joined Group',
          joinedAt: 300,
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

    vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({
      data: [
        {
          id: 'g1',
          name: 'Group 1 Detail',
        },
      ],
    });

    const result = await manager.getGroupInfo({
      groupId: 'g1',
    });

    expect(result).toMatchObject({
      groupId: 'g1',
      name: 'Group 1 Detail',
      joinedAt: 300,
    });
  });

  it('getJoinedGroupList 应返回登录同步后的本地已加入群组列表', () => {
    const requestSpy = vi.spyOn(RestClient.prototype, 'request');

    manager.applyJoinedGroupSnapshot({
      items: [
        {
          groupId: 'g1',
          name: 'Group 1',
          role: 'member',
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

    const first = manager.getJoinedGroupList();
    const second = manager.getJoinedGroupList();

    expect(first[0]).not.toBe(second[0]);

    const mutated = first[0] as { name: string };
    mutated.name = 'Mutated Group';

    expect(second[0]).toEqual({
      groupId: 'g1',
      name: 'Group 1',
      role: 'member',
    });
    expect(manager.getJoinedGroupSnapshotForSync().meta).toMatchObject({
      integrity: 'synced',
      source: 'sync',
      lastSyncFinishedTs: 123,
    });
    expect(requestSpy).not.toHaveBeenCalled();
  });

  it('getGroup 应能读取运行时同步下来的轻量摘要且不触发详情请求', () => {
    const requestSpy = vi.spyOn(RestClient.prototype, 'request');

    manager.applyJoinedGroupSnapshot({
      items: [
        {
          groupId: 'g1',
          name: 'Group 1',
          description: 'desc',
          memberCount: 12,
          role: 'admin',
          ownerId: 'owner',
          avatarUrl: 'https://cdn.example.com/g1.png',
          muteAllMembers: true,
          muteExpiration: 456,
          remindType: 'AT',
          createdAt: 100,
          updatedAt: 200,
          joinedAt: 300,
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
    const first = group.getSummary();
    const second = group.getSummary();

    expect(first).not.toBe(second);
    expect(first).toEqual({
      groupId: 'g1',
      name: 'Group 1',
      description: 'desc',
      memberCount: 12,
      role: 'admin',
      ownerId: 'owner',
      avatarUrl: 'https://cdn.example.com/g1.png',
      muteAllMembers: true,
      muteExpiration: 456,
      remindType: 'AT',
      createdAt: 100,
      updatedAt: 200,
      joinedAt: 300,
    });
    expect(requestSpy).not.toHaveBeenCalled();
  });

  it('getGroup 应能从本地预览读取轻量摘要，未知群返回 null', () => {
    const requestSpy = vi.spyOn(RestClient.prototype, 'request');
    manager.bind(
      createMockClient({
        cacheManager: {
          loadJoinedGroupPreviewSnapshot: () => ({
            items: [
              {
                groupId: 'g-preview',
                name: 'Preview Group',
                avatarUrl: 'https://cdn.example.com/preview.png',
                role: 'member',
              },
            ],
            meta: {
              integrity: 'preview',
              limited: false,
              storageLimit: 100,
              serverLimit: 3000,
              source: 'localPreview',
            },
          }),
        },
      })
    );

    const previewGroup = manager.getGroup('g-preview');
    const unknownGroup = manager.getGroup('g-unknown');

    expect(previewGroup.getSummary()).toEqual({
      groupId: 'g-preview',
      name: 'Preview Group',
      avatarUrl: 'https://cdn.example.com/preview.png',
      role: 'member',
    });
    expect(unknownGroup.getSummary()).toBeNull();
    expect(requestSpy).not.toHaveBeenCalled();
  });

  it('getGroupInfoList 应保持顺序并补齐 owner 对象', async () => {
    manager.bind(
      createMockClient({
        cacheManager: {
          getUserInfoSummaries: (
            userIds
          ): ReadonlyArray<{
            userId: string;
            nickname?: string;
            avatarUrl?: string;
          }> =>
            userIds.includes('owner1')
              ? [
                  {
                    userId: 'owner1',
                    nickname: 'Owner 1',
                  },
                ]
              : [],
          setUserInfoSummaries: (): void => {},
        },
      })
    );

    vi.spyOn(RestClient.prototype, 'request').mockImplementation(
      async (_endpoint: string, config?: { operation?: string }): Promise<unknown> => {
        if (config?.operation === 'getGroupInfoList') {
          return {
            data: [
              {
                id: 'g1',
                name: 'Group 1',
                owner: 'owner1',
              },
              {
                id: 'g2',
                name: 'Group 2',
                owner: 'owner2',
              },
            ],
          };
        }
        if (config?.operation === 'getUserInfoByUserId') {
          return {
            data: {
              owner2: {
                nickname: 'Owner 2',
              },
            },
            lastModified: {
              owner2: 1,
            },
          };
        }
        return {};
      }
    );

    const result = await manager.getGroupInfoList({
      groupIds: ['g1', 'g2'],
    });

    expect(result).toEqual([
      expect.objectContaining({
        groupId: 'g1',
        owner: {
          userId: 'owner1',
          nickname: 'Owner 1',
        },
      }),
      expect.objectContaining({
        groupId: 'g2',
        owner: {
          userId: 'owner2',
          nickname: 'Owner 2',
        },
      }),
    ]);
  });

  it('getGroupAdminList 应对仅返回 userId 的结果执行对象化补齐', async () => {
    const requestSpy = vi
      .spyOn(RestClient.prototype, 'request')
      .mockImplementation(
        async (
          _endpoint: string,
          config?: { operation?: string; body?: unknown }
        ): Promise<unknown> => {
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

    const result = await manager.getGroupAdminList({
      groupId: 'g1',
    });

    expect(result).toEqual([
      {
        userId: 'bob',
        nickname: 'Bob',
        avatarUrl: 'https://cdn.example.com/bob.png',
      },
    ]);
    expect(requestSpy).toHaveBeenCalledTimes(2);
  });

  it('getGroupMemberList 应对象化用户并在补拉缺失时回退最小视图', async () => {
    vi.spyOn(RestClient.prototype, 'request').mockImplementation(
      async (_endpoint: string, config?: { operation?: string }): Promise<unknown> => {
        if (config?.operation === 'getGroupMemberList') {
          return {
            data: [
              {
                owner: 'owner1',
              },
              {
                admin: 'admin1',
              },
              {
                member: 'member1',
              },
            ],
            params: {
              pagenum: ['2'],
              pagesize: ['50'],
            },
          };
        }
        if (config?.operation === 'getUserInfoByUserId') {
          return {
            data: {
              admin1: {
                nickname: 'Admin 1',
              },
            },
            lastModified: {
              admin1: 1,
            },
          };
        }
        return {};
      }
    );

    const result = await manager.getGroupMemberList({
      groupId: 'g1',
      pageSize: 50,
    });

    expect(result).toEqual({
      items: [
        {
          user: {
            userId: 'owner1',
          },
          role: 'owner',
          joinedAt: undefined,
        },
        {
          user: {
            userId: 'admin1',
            nickname: 'Admin 1',
          },
          role: 'admin',
          joinedAt: undefined,
        },
        {
          user: {
            userId: 'member1',
          },
          role: 'member',
          joinedAt: undefined,
        },
      ],
      pageNum: 2,
      pageSize: 50,
    });
  });

  it('黑名单/allowlist/禁言读取应保持首见顺序并对缺失资料回退最小视图', async () => {
    manager.bind(
      createMockClient({
        cacheManager: {
          getUserInfoSummaries: (
            userIds
          ): ReadonlyArray<{
            userId: string;
            nickname?: string;
            avatarUrl?: string;
          }> =>
            userIds.includes('cached')
              ? [
                  {
                    userId: 'cached',
                    nickname: 'Cached User',
                    avatarUrl: 'https://cdn.example.com/cached.png',
                  },
                ]
              : [],
          setUserInfoSummaries: (): void => {},
        },
      })
    );

    vi.spyOn(RestClient.prototype, 'request').mockImplementation(
      async (_endpoint: string, config?: { operation?: string }): Promise<unknown> => {
        switch (config?.operation) {
          case 'getGroupBlocklist':
            return {
              data: ['fetched', 'missing'],
            };
          case 'getGroupAllowlist':
            return {
              data: ['cached', 'missing'],
            };
          case 'getGroupMuteList':
            return {
              data: ['missing', 'cached'],
            };
          case 'getUserInfoByUserId':
            return {
              data: {
                fetched: {
                  nickname: 'Fetched User',
                },
              },
              lastModified: {
                fetched: 1,
              },
            };
          default:
            return {};
        }
      }
    );

    await expect(manager.getGroupBlocklist({ groupId: 'g1' })).resolves.toEqual([
      {
        user: {
          userId: 'fetched',
          nickname: 'Fetched User',
        },
      },
      {
        user: {
          userId: 'missing',
        },
      },
    ]);
    await expect(manager.getGroupAllowlist({ groupId: 'g1' })).resolves.toEqual([
      {
        user: {
          userId: 'cached',
          nickname: 'Cached User',
          avatarUrl: 'https://cdn.example.com/cached.png',
        },
      },
      {
        user: {
          userId: 'missing',
        },
      },
    ]);
    await expect(manager.getGroupMuteList({ groupId: 'g1' })).resolves.toEqual([
      {
        user: {
          userId: 'missing',
        },
      },
      {
        user: {
          userId: 'cached',
          nickname: 'Cached User',
          avatarUrl: 'https://cdn.example.com/cached.png',
        },
      },
    ]);
  });

  it('acceptInvitation 应只使用当前登录用户作为 invitee', async () => {
    const requestSpy = vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({});

    await manager.acceptInvitation({
      groupId: 'g1',
    });

    expect(requestSpy).toHaveBeenCalledWith('/org/app/chatgroups/g1/invite_verify?resource=web', {
      method: 'POST',
      body: {
        invitee: 'alice',
        verifyResult: true,
      },
      operation: 'acceptInvitation',
    });
  });

  it('rejectInvitation 应忽略外部传入 invitee 并使用当前登录用户', async () => {
    const requestSpy = vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({});

    await manager.rejectInvitation({
      groupId: 'g1',
      invitee: 'mallory',
    } as { groupId: string; invitee: string });

    expect(requestSpy).toHaveBeenCalledWith('/org/app/chatgroups/g1/invite_verify?resource=web', {
      method: 'POST',
      body: {
        invitee: 'alice',
        verifyResult: false,
      },
      operation: 'rejectInvitation',
    });
  });

  it('getGroupMembersAttributes 应支持单用户 attribute 查询', async () => {
    vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({
      data: {
        bob: {
          nickname: 'Bob',
          title: 'admin',
        },
      },
    });

    const result = await manager.getGroupMembersAttributes({
      groupId: 'g1',
      userIds: ['bob'],
      keys: ['nickname'],
    });

    expect(result).toEqual({
      items: {
        bob: {
          nickname: 'Bob',
          title: 'admin',
        },
      },
    });
  });

  it('底层抛普通 Error 时应归一化为 SDKError', async () => {
    vi.spyOn(RestClient.prototype, 'request').mockRejectedValue(new Error('network'));

    await expect(
      manager.getPublicGroupList({
        limit: 20,
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.UNKNOWN,
      message: 'GroupManager getPublicGroupList failed: network',
    });
  });

  it('底层已是 SDKError 时应原样抛出', async () => {
    const sdkError = new SDKError('boom', ERROR_CODES.REST_HTTP_ERROR);
    vi.spyOn(RestClient.prototype, 'request').mockRejectedValue(sdkError);

    await expect(
      manager.destroyGroup({
        groupId: 'g1',
      })
    ).rejects.toBe(sdkError);
  });

  it('底层业务错误应保留群组 API 的映射 details', async () => {
    const sdkError = new SDKError('无权限的群组操作', ERROR_CODES.GROUP_PERMISSION_DENIED, {
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
    vi.spyOn(RestClient.prototype, 'request').mockRejectedValue(sdkError);

    await expect(
      manager.inviteUsersToGroup({
        groupId: 'g1',
        userIds: ['bob'],
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.GROUP_PERMISSION_DENIED,
      details: expect.objectContaining({
        api: 'inviteUsersToGroup',
        mapped: true,
        reasonKey: 'group_authorization',
        serverCode: 'group_authorization',
        canonicalCode: ERROR_CODES.GROUP_PERMISSION_DENIED,
      }),
    });
  });

  it('常见公开包装方法应走统一 request 链路', async () => {
    const requestSpy = vi
      .spyOn(RestClient.prototype, 'request')
      .mockImplementation(
        async (_endpoint: string, config?: { operation?: string }): Promise<unknown> => {
          switch (config?.operation) {
            case 'getPublicGroupList':
              return { data: [] };
            case 'checkIfInGroupAllowList':
              return { data: true };
            case 'checkIfInGroupMuteList':
              return { data: false };
            case 'getGroupAnnouncement':
              return { announcement: 'notice' };
            case 'getGroupMembersAttributes':
              return {
                data: {
                  bob: {
                    role: 'admin',
                  },
                },
              };
            default:
              return {};
          }
        }
      );

    await manager.getPublicGroupList({ limit: 20, cursor: 'next' });
    await manager.updateGroupInfo({ groupId: 'g1', name: 'Group 1' });
    await manager.changeGroupOwner({ groupId: 'g1', newOwner: 'bob' });
    await manager.destroyGroup({ groupId: 'g1' });
    await manager.leaveGroup({ groupId: 'g1' });
    await manager.joinGroup({ groupId: 'g1', message: 'join us' });
    await manager.inviteUsersToGroup({ groupId: 'g1', userIds: ['bob', 'carol'] });
    await manager.acceptGroupJoinRequest({ groupId: 'g1', userId: 'bob' });
    await manager.rejectGroupJoinRequest({ groupId: 'g1', userId: 'bob', reason: 'no' });
    await manager.acceptInvitation({ groupId: 'g1' });
    await manager.rejectInvitation({ groupId: 'g1' });
    await manager.removeGroupMembers({ groupId: 'g1', userIds: ['bob'] });
    await manager.addGroupAdmin({ groupId: 'g1', userId: 'bob' });
    await manager.removeGroupAdmin({ groupId: 'g1', userId: 'bob' });
    await manager.muteGroupMembers({ groupId: 'g1', userIds: ['bob'], muteDuration: 60 });
    await manager.unmuteGroupMembers({ groupId: 'g1', userIds: ['bob'] });
    await manager.muteAllGroupMembers({ groupId: 'g1' });
    await manager.unmuteAllGroupMembers({ groupId: 'g1' });
    await manager.blockGroupMembers({ groupId: 'g1', userIds: ['bob'] });
    await manager.unblockGroupMembers({ groupId: 'g1', userIds: ['bob'] });
    await manager.addUsersToGroupAllowlist({ groupId: 'g1', userIds: ['bob'] });
    await manager.removeUsersFromGroupAllowlist({ groupId: 'g1', userIds: ['bob'] });

    await expect(manager.checkIfInGroupAllowList({ groupId: 'g1' })).resolves.toBe(true);
    await expect(manager.checkIfInGroupMuteList({ groupId: 'g1' })).resolves.toBe(false);
    await expect(manager.getGroupAnnouncement({ groupId: 'g1' })).resolves.toEqual({
      announcement: 'notice',
    });
    await expect(
      manager.getGroupMembersAttributes({ groupId: 'g1', userIds: ['bob'], keys: ['role'] })
    ).resolves.toEqual({
      items: {
        bob: {
          role: 'admin',
        },
      },
    });
    await expect(
      manager.getGroupMembersAttributes({ groupId: 'g1', userIds: ['bob'], keys: ['role'] })
    ).resolves.toEqual({
      items: {
        bob: {
          role: 'admin',
        },
      },
    });
    await manager.updateGroupAnnouncement({ groupId: 'g1', announcement: 'updated' });
    await manager.deleteGroupSharedFile({ groupId: 'g1', fileId: 'f1' });
    await manager.setGroupMemberAttributes({
      groupId: 'g1',
      userId: 'bob',
      memberAttributes: { role: 'admin' },
    });

    const calledOperations = requestSpy.mock.calls.map(([, config]) => config?.operation);
    expect(calledOperations).toEqual(
      expect.arrayContaining([
        'getPublicGroupList',
        'updateGroupInfo',
        'changeGroupOwner',
        'destroyGroup',
        'leaveGroup',
        'joinGroup',
        'inviteUsersToGroup',
        'acceptGroupJoinRequest',
        'rejectGroupJoinRequest',
        'acceptInvitation',
        'rejectInvitation',
        'removeGroupMembers',
        'addGroupAdmin',
        'removeGroupAdmin',
        'muteGroupMembers',
        'unmuteGroupMembers',
        'muteAllGroupMembers',
        'unmuteAllGroupMembers',
        'blockGroupMembers',
        'unblockGroupMembers',
        'addUsersToGroupAllowlist',
        'removeUsersFromGroupAllowlist',
        'checkIfInGroupAllowList',
        'checkIfInGroupMuteList',
        'getGroupAnnouncement',
        'getGroupMembersAttributes',
        'updateGroupAnnouncement',
        'deleteGroupSharedFile',
        'setGroupMemberAttributes',
      ])
    );
  });

  it('当前用户更新群名片后应使用服务端 lastModified 写入 namecardUpdateTime', async () => {
    const setGroupNamecards = vi.fn();
    manager.bind(
      createMockClient({
        cacheManager: {
          setGroupNamecards,
        },
      })
    );
    vi.spyOn(RestClient.prototype, 'request').mockImplementation(
      async (_endpoint: string, config?: { operation?: string }): Promise<unknown> => {
        if (config?.operation === 'setGroupMemberAttributes') {
          return {
            lastModified: {
              alice: 1774496262500,
            },
          };
        }
        return {};
      }
    );

    await manager.setGroupMemberAttributes({
      groupId: 'g1',
      userId: 'alice',
      memberAttributes: {
        groupNamecard: 'Alice Card',
      },
    });

    expect(setGroupNamecards).toHaveBeenCalledWith([
      expect.objectContaining({
        groupId: 'g1',
        userId: 'alice',
        namecard: 'Alice Card',
        namecardUpdateTime: 1774496262,
      }),
    ]);
  });

  it('当前用户仅更新群名片时应调用 /chatgroups/{groupId}/nameCard', async () => {
    manager.bind(createMockClient());
    const requestSpy = vi
      .spyOn(RestClient.prototype, 'request')
      .mockResolvedValue({ lastModified: { alice: 1774496262500 } });

    await manager.setGroupMemberAttributes({
      groupId: 'g1',
      userId: 'alice',
      memberAttributes: {
        groupNamecard: 'Alice Card',
      },
    });

    expect(requestSpy).toHaveBeenCalledWith(
      '/org/app/sdk/chatgroups/g1/nameCard',
      expect.objectContaining({
        method: 'PUT',
        body: {
          nameCard: 'Alice Card',
        },
        operation: 'setGroupMemberAttributes',
      })
    );
  });

  it('当前用户更新群名片后应兼容服务端 timestamp 写入 namecardUpdateTime', async () => {
    const setGroupNamecards = vi.fn();
    manager.bind(
      createMockClient({
        cacheManager: {
          setGroupNamecards,
        },
      })
    );
    vi.spyOn(RestClient.prototype, 'request').mockImplementation(
      async (_endpoint: string, config?: { operation?: string }): Promise<unknown> => {
        if (config?.operation === 'setGroupMemberAttributes') {
          return {
            timestamp: 1777003240640,
            data: {
              groupNamecard: 'Alice Card',
            },
            duration: 476,
          };
        }
        return {};
      }
    );

    await manager.setGroupMemberAttributes({
      groupId: 'g1',
      userId: 'alice',
      memberAttributes: {
        groupNamecard: 'Alice Card',
      },
    });

    expect(setGroupNamecards).toHaveBeenCalledWith([
      expect.objectContaining({
        groupId: 'g1',
        userId: 'alice',
        namecard: 'Alice Card',
        namecardUpdateTime: 1777003240,
      }),
    ]);
  });

  it('列表/下载/上传类方法应按当前上下文工作', async () => {
    manager.bind(
      createMockClient({
        cacheManager: {
          getUserInfoSummaries: userIds =>
            userIds.map(userId => ({
              userId,
              nickname: userId.toUpperCase(),
              lastAccess: 1,
              lastUpdate: 1,
            })),
        },
      })
    );

    const requestSpy = vi
      .spyOn(RestClient.prototype, 'request')
      .mockImplementation(
        async (_endpoint: string, config?: { operation?: string }): Promise<unknown> => {
          switch (config?.operation) {
            case 'getGroupMuteList':
            case 'getGroupBlocklist':
            case 'getGroupAllowlist':
              return { data: ['bob'] };
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
            default:
              return {};
          }
        }
      );

    const originalFetch = globalThis.fetch;
    const originalXhr = globalThis.XMLHttpRequest;
    const onFileUploadComplete = vi.fn();
    const onFileDownloadComplete = vi.fn();

    class MockXMLHttpRequest {
      public upload: { onprogress: ((event: ProgressEvent) => void) | null } = {
        onprogress: null,
      };

      public onload: (() => void) | null = null;
      public onerror: (() => void) | null = null;
      public onabort: (() => void) | null = null;
      public responseText = 'uploaded';

      public open(): void {}
      public setRequestHeader(): void {}
      public send(): void {
        this.onload?.();
      }
    }

    globalThis.XMLHttpRequest = MockXMLHttpRequest as unknown as typeof XMLHttpRequest;
    globalThis.fetch = vi.fn(async (): Promise<Response> => {
      return {
        ok: true,
        blob: async (): Promise<Blob> => new Blob(['content']),
      } as Response;
    });

    try {
      await expect(manager.getGroupMuteList({ groupId: 'g1' })).resolves.toEqual([
        { user: { userId: 'bob', nickname: 'BOB' } },
      ]);
      await expect(manager.getGroupBlocklist({ groupId: 'g1' })).resolves.toEqual([
        { user: { userId: 'bob', nickname: 'BOB' } },
      ]);
      await expect(manager.getGroupAllowlist({ groupId: 'g1' })).resolves.toEqual([
        { user: { userId: 'bob', nickname: 'BOB' } },
      ]);
      await expect(
        manager.getGroupSharedFileList({ groupId: 'g1', pageNum: 1, pageSize: 20 })
      ).resolves.toEqual({
        items: [
          {
            fileId: 'f1',
            fileName: 'a.txt',
            fileOwner: {
              userId: 'bob',
              nickname: 'BOB',
            },
            fileSize: undefined,
            createdAt: undefined,
          },
        ],
        pageNum: undefined,
        pageSize: undefined,
      });

      await manager.uploadGroupSharedFile({
        groupId: 'g1',
        file: new Blob(['payload']),
        onFileUploadComplete,
      });
      await manager.downloadGroupSharedFile({
        groupId: 'g1',
        fileId: 'f1',
        onFileDownloadComplete,
      });
    } finally {
      globalThis.fetch = originalFetch;
      globalThis.XMLHttpRequest = originalXhr;
    }

    expect(requestSpy.mock.calls.map(([, config]) => config?.operation)).toEqual(
      expect.arrayContaining([
        'getGroupMuteList',
        'getGroupBlocklist',
        'getGroupAllowlist',
        'getGroupSharedFileList',
      ])
    );
    expect(onFileUploadComplete).toHaveBeenCalledWith('uploaded');
    expect(onFileDownloadComplete).toHaveBeenCalledTimes(1);
  });

  it('downloadGroupSharedFile 在响应非 2xx 时应抛出 SDKError', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async (): Promise<Response> => {
      return {
        ok: false,
      } as Response;
    });

    try {
      await expect(
        manager.downloadGroupSharedFile({
          groupId: 'g1',
          fileId: 'f1',
        })
      ).rejects.toMatchObject({
        code: ERROR_CODES.REST_HTTP_ERROR,
        message: 'downloadGroupSharedFile failed',
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
