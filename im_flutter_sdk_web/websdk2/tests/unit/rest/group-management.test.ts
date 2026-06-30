import { describe, expect, it, vi } from 'vitest';

import {
  buildDownloadGroupSharedFileEndpoint,
  normalizeGroupId,
  normalizeGroupUserIds,
  requestAcceptInvitation,
  requestAcceptGroupJoinRequest,
  requestAddUsersToGroupAllowlist,
  requestBlockGroupMembers,
  requestChangeGroupOwner,
  requestCreateGroup,
  requestDeleteGroupSharedFile,
  requestDestroyGroup,
  requestGetGroupInfoList,
  requestGetGroupAnnouncement,
  requestGetGroupMembersAttributes,
  requestGetGroupNamecards,
  requestGetGroupMuteList,
  requestGetJoinedGroupList,
  requestCheckIfInGroupMuteList,
  requestCheckIfInGroupAllowList,
  requestInviteUsersToGroup,
  requestJoinGroup,
  requestLeaveGroup,
  requestMuteAllGroupMembers,
  requestMuteGroupMembers,
  requestGetGroupInfo,
  requestGetGroupMemberList,
  requestGetPublicGroupList,
  requestRejectInvitation,
  requestRejectGroupJoinRequest,
  requestRemoveGroupAdmin,
  requestRemoveGroupMembers,
  requestRemoveUsersFromGroupAllowlist,
  requestAddGroupAdmin,
  requestSetGroupMemberAttributes,
  requestUnblockGroupMembers,
  requestUnmuteAllGroupMembers,
  requestUnmuteGroupMembers,
  requestUpdateGroupAnnouncement,
  requestUpdateGroupInfo,
} from '@/rest/group-management';
import type { RestContext } from '@/types/chat-client';
import { ERROR_CODES } from '@/utils/error-codes';
import { ValidationError } from '@/utils/errors';

const DEFAULT_CONTEXT: RestContext = {
  restBaseUrl: 'https://api.example.com',
  appKey: 'org#app',
  userId: 'alice',
  token: 'token-1',
  clientResource: 'web',
};

const createRestClient = () => {
  return {
    post: vi.fn(
      (_endpoint: string, _body?: unknown, _config?: unknown): Promise<unknown> =>
        Promise.resolve(undefined)
    ),
    get: vi.fn(
      (_endpoint: string, _config?: unknown): Promise<unknown> => Promise.resolve(undefined)
    ),
    put: vi.fn(
      (_endpoint: string, _body?: unknown, _config?: unknown): Promise<unknown> =>
        Promise.resolve(undefined)
    ),
    delete: vi.fn(
      (_endpoint: string, _config?: unknown): Promise<unknown> => Promise.resolve(undefined)
    ),
    request: vi.fn(
      (_endpoint: string, _config?: unknown): Promise<unknown> => Promise.resolve(undefined)
    ),
  };
};

const expectValidationCode = (task: () => unknown, code: number): void => {
  try {
    task();
    expect.unreachable('expected validation error');
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).code).toBe(code);
  }
};

describe('group-management helpers', () => {
  it('normalizeGroupUserIds 应 trim + 去重并保持顺序', () => {
    expect(normalizeGroupUserIds(['  u1  ', 'u2', 'u1', ''], 'params.userIds')).toEqual([
      'u1',
      'u2',
    ]);
  });

  it('normalizeGroupUserIds/normalizeGroupId 非法时应抛统一校验错误', () => {
    expectValidationCode(
      () => normalizeGroupUserIds(['   '], 'params.userIds'),
      ERROR_CODES.VALIDATION_REQUIRED
    );
    expectValidationCode(
      () => normalizeGroupUserIds([1 as unknown as string], 'params.userIds'),
      ERROR_CODES.VALIDATION_INVALID_FORMAT
    );
    expectValidationCode(
      () => normalizeGroupId('   ', 'params.groupId'),
      ERROR_CODES.VALIDATION_REQUIRED
    );
  });

  it('buildDownloadGroupSharedFileEndpoint 应拼接 share_files 下载路径', () => {
    expect(
      buildDownloadGroupSharedFileEndpoint(DEFAULT_CONTEXT, {
        groupId: 'g1',
        fileId: 'f1',
      })
    ).toBe('/org/app/chatgroups/g1/share_files/f1');
  });
});

describe('group-management requests', () => {
  it('requestGetJoinedGroupList 应兼容 joined_chatgroups 与 chatgroups/user 两种分页路径', async () => {
    const client = createRestClient();
    client.get.mockResolvedValueOnce({
      data: [
        {
          groupid: 'g1',
          groupname: 'Group 1',
        },
      ],
      params: {
        pagenum: ['1'],
        pagesize: ['50'],
      },
    });
    client.get.mockResolvedValueOnce({
      data: [
        {
          id: 'g2',
          name: 'Group 2',
          membersonly: true,
          role: 'owner',
        },
      ],
      params: {
        pagenum: ['0'],
        pagesize: ['20'],
      },
    });

    const basic = await requestGetJoinedGroupList(client as never, DEFAULT_CONTEXT, {
      pageNum: 1,
      pageSize: 50,
    });
    const withMemberCount = await requestGetJoinedGroupList(client as never, DEFAULT_CONTEXT, {
      pageNum: 0,
      pageSize: 20,
      needMemberCount: true,
    });

    expect(client.get).toHaveBeenNthCalledWith(
      1,
      '/org/app/users/alice/joined_chatgroups?pagenum=1&pagesize=50',
      {
        operation: 'getJoinedGroupList',
      }
    );
    expect(client.get).toHaveBeenNthCalledWith(
      2,
      '/org/app/chatgroups/user/alice?pagenum=0&pagesize=20&needAffiliations=true&needRole=false',
      {
        operation: 'getJoinedGroupList',
      }
    );
    expect(basic.items[0]).toMatchObject({
      groupId: 'g1',
      name: 'Group 1',
    });
    expect(withMemberCount.items[0]).toMatchObject({
      groupId: 'g2',
      name: 'Group 2',
      joinApprovalRequired: true,
      role: 'owner',
    });
  });

  it('requestGetPublicGroupList 与 requestGetGroupInfo 应组装正确读取路径', async () => {
    const client = createRestClient();
    client.get
      .mockResolvedValueOnce({
        data: [
          {
            id: 'g1',
            name: 'Group 1',
          },
        ],
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: 'g1',
            name: 'Group 1',
            owner: 'owner1',
            permission: 'member',
          },
        ],
      });

    const list = await requestGetPublicGroupList(client as never, DEFAULT_CONTEXT, {
      limit: 20,
      cursor: 'next',
    });
    const detail = await requestGetGroupInfo(client as never, DEFAULT_CONTEXT, {
      groupId: 'g1',
    });

    expect(client.get).toHaveBeenNthCalledWith(
      1,
      '/org/app/publicchatgroups?limit=20&cursor=next',
      {
        operation: 'getPublicGroupList',
      }
    );
    expect(client.get).toHaveBeenNthCalledWith(
      2,
      '/org/app/chatgroups/g1?joined_time=true&version=v3',
      {
        operation: 'getGroupInfo',
      }
    );
    expect(list.items[0]).toMatchObject({
      groupId: 'g1',
      name: 'Group 1',
    });
    expect(detail).toMatchObject({
      groupId: 'g1',
      role: 'member',
      owner: {
        userId: 'owner1',
      },
    });
  });

  it('requestInviteUsersToGroup 应去重 userIds 并构造 invite endpoint', async () => {
    const client = createRestClient();

    await requestInviteUsersToGroup(client as never, DEFAULT_CONTEXT, {
      groupId: 'g1',
      userIds: ['bob', 'bob', 'carol'],
    });

    expect(client.post).toHaveBeenCalledWith(
      '/org/app/chatgroups/g1/invite?resource=web',
      {
        usernames: ['bob', 'carol'],
      },
      {
        operation: 'inviteUsersToGroup',
      }
    );
  });

  it('requestAcceptInvitation 应使用当前登录用户作为 invitee', async () => {
    const client = createRestClient();

    await requestAcceptInvitation(client as never, DEFAULT_CONTEXT, {
      groupId: 'g1',
    });

    expect(client.post).toHaveBeenCalledWith(
      '/org/app/chatgroups/g1/invite_verify?resource=web',
      {
        invitee: 'alice',
        verifyResult: true,
      },
      {
        operation: 'acceptInvitation',
      }
    );
  });

  it('requestAccept/RejectGroupJoinRequest 应组装 applicant 与 verifyResult', async () => {
    const client = createRestClient();

    await requestAcceptGroupJoinRequest(client as never, DEFAULT_CONTEXT, {
      groupId: 'g1',
      userId: 'bob',
    });
    await requestRejectGroupJoinRequest(client as never, DEFAULT_CONTEXT, {
      groupId: 'g1',
      userId: 'carol',
      reason: 'no',
    });

    expect(client.post).toHaveBeenNthCalledWith(
      1,
      '/org/app/chatgroups/g1/apply_verify?resource=web',
      {
        applicant: 'bob',
        verifyResult: true,
      },
      {
        operation: 'acceptGroupJoinRequest',
      }
    );
    expect(client.post).toHaveBeenNthCalledWith(
      2,
      '/org/app/chatgroups/g1/apply_verify?resource=web',
      {
        applicant: 'carol',
        verifyResult: false,
        reason: 'no',
      },
      {
        operation: 'rejectGroupJoinRequest',
      }
    );
  });

  it('requestGetGroupInfoList 应归一化批量群详情结果', async () => {
    const client = createRestClient();
    client.get.mockResolvedValue({
      data: [
        {
          id: 'g1',
          name: 'Group 1',
          owner: 'owner1',
          permission: 'member',
          public: false,
        },
        {
          id: 'g2',
          name: 'Group 2',
          owner: 'owner2',
          permission: 'owner',
          membersonly: true,
        },
      ],
    });

    const result = await requestGetGroupInfoList(client as never, DEFAULT_CONTEXT, {
      groupIds: ['g1', 'g2'],
    });

    expect(client.get).toHaveBeenCalledWith(
      '/org/app/chatgroups/g1,g2?joined_time=true&version=v3',
      {
        operation: 'getGroupInfoList',
      }
    );
    expect(result).toEqual([
      expect.objectContaining({
        groupId: 'g1',
        name: 'Group 1',
        role: 'member',
        owner: { userId: 'owner1' },
      }),
      expect.objectContaining({
        groupId: 'g2',
        name: 'Group 2',
        role: 'owner',
        owner: { userId: 'owner2' },
        joinApprovalRequired: true,
      }),
    ]);
  });

  it('requestGetGroupMemberList 应归一化 owner/admin/member 与分页字段', async () => {
    const client = createRestClient();
    client.get.mockResolvedValue({
      data: [
        {
          owner: 'owner1',
          joined_time: 1,
        },
        {
          admin: 'admin1',
          joined_time: 2,
        },
        {
          member: 'member1',
          joined_time: 3,
        },
      ],
      params: {
        pagenum: ['1'],
        pagesize: ['20'],
      },
    });

    const result = await requestGetGroupMemberList(client as never, DEFAULT_CONTEXT, {
      groupId: 'g1',
      pageSize: 20,
    });

    expect(client.get).toHaveBeenCalledWith('/org/app/chatgroups/g1/users?pagesize=20', {
      operation: 'getGroupMemberList',
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
            userId: 'admin1',
          },
          role: 'admin',
          joinedAt: 2,
        },
        {
          user: {
            userId: 'member1',
          },
          role: 'member',
          joinedAt: 3,
        },
      ],
      pageNum: 1,
      pageSize: 20,
    });
  });

  it('requestGetGroupMembersAttributes 应把 data[userId] 归一化为 items', async () => {
    const client = createRestClient();
    client.post.mockResolvedValue({
      data: {
        bob: {
          nickname: 'Bob',
          avatar: 'avatar-bob',
        },
        carol: {
          nickname: 'Carol',
        },
      },
    });

    const result = await requestGetGroupMembersAttributes(client as never, DEFAULT_CONTEXT, {
      groupId: 'g1',
      userIds: ['bob', 'carol'],
      keys: ['nickname'],
    });

    expect(client.post).toHaveBeenCalledWith(
      '/org/app/sdk/metadata/chatgroup/g1/get',
      {
        targets: ['bob', 'carol'],
        properties: ['nickname'],
      },
      {
        operation: 'getGroupMembersAttributes',
      }
    );
    expect(result).toEqual({
      items: {
        bob: {
          nickname: 'Bob',
          avatar: 'avatar-bob',
        },
        carol: {
          nickname: 'Carol',
        },
      },
    });
  });

  it('requestGetGroupNamecards 应调用 nameCard 批量接口并归一化结果', async () => {
    const client = createRestClient();
    client.post.mockResolvedValue({
      data: {
        bob: 'Bob Card',
        carol: {
          namecard: 'Carol Card',
        },
      },
    });

    const result = await requestGetGroupNamecards(client as never, DEFAULT_CONTEXT, {
      groupId: 'g1',
      userIds: ['bob', 'carol'],
    });

    expect(client.post).toHaveBeenCalledWith(
      '/org/app/sdk/chatgroups/g1/nameCard/batch/get',
      {
        members: ['bob', 'carol'],
      },
      {
        operation: 'getGroupNamecards',
      }
    );
    expect(result).toEqual({
      items: {
        bob: {
          namecard: 'Bob Card',
        },
        carol: {
          namecard: 'Carol Card',
        },
      },
      responseTimestamp: undefined,
    });
  });

  it('requestGetGroupNamecards 应兼容 data 数组并提取 update_timestamp', async () => {
    const client = createRestClient();
    client.post.mockResolvedValue({
      action: 'post',
      data: [
        {
          username: 'tst',
          group_id: '307266346614785',
          name_card: '2131',
          update_timestamp: 1777016976718,
        },
      ],
    });

    const result = await requestGetGroupNamecards(client as never, DEFAULT_CONTEXT, {
      groupId: '307266346614785',
      userIds: ['tst'],
    });

    expect(result).toEqual({
      items: {
        tst: {
          namecard: '2131',
          namecardUpdateTime: 1777016976,
        },
      },
      responseTimestamp: undefined,
    });
  });

  it('requestGetGroupNamecards 应提取根响应 timestamp 作为批量请求时间', async () => {
    const client = createRestClient();
    client.post.mockResolvedValue({
      action: 'post',
      data: [],
      timestamp: 1777018409174,
    });

    const result = await requestGetGroupNamecards(client as never, DEFAULT_CONTEXT, {
      groupId: '307266346614785',
      userIds: ['tst'],
    });

    expect(result).toEqual({
      items: {},
      responseTimestamp: 1777018409,
    });
  });

  it('requestSetGroupMemberAttributes 在当前用户仅更新群名片时应走 nameCard 接口', async () => {
    const client = createRestClient();
    client.put.mockResolvedValue({});

    await requestSetGroupMemberAttributes(client as never, DEFAULT_CONTEXT, {
      groupId: 'g1',
      userId: 'alice',
      memberAttributes: {
        groupNamecard: 'Alice Card',
      },
    });

    expect(client.put).toHaveBeenCalledWith(
      '/org/app/sdk/chatgroups/g1/nameCard',
      { nameCard: 'Alice Card' },
      { operation: 'setGroupMemberAttributes' }
    );
  });

  it('常见写接口应组装正确的 endpoint/body', async () => {
    const client = createRestClient();
    client.post.mockResolvedValue({ data: { id: 'g1' } });
    client.put.mockResolvedValue({});
    client.delete.mockResolvedValue({});

    await expect(
      requestCreateGroup(client as never, DEFAULT_CONTEXT, {
        name: 'Group 1',
        description: 'desc',
        memberIds: ['bob', 'bob'],
        public: true,
        joinApprovalRequired: false,
        allowInvites: true,
        inviteNeedConfirm: false,
        maxMembers: 200,
      })
    ).resolves.toEqual({ groupId: 'g1' });
    await requestUpdateGroupInfo(client as never, DEFAULT_CONTEXT, {
      groupId: 'g1',
      name: 'Updated',
      joinApprovalRequired: true,
      maxMembers: 300,
    });
    await requestChangeGroupOwner(client as never, DEFAULT_CONTEXT, {
      groupId: 'g1',
      newOwner: 'carol',
    });
    await requestDestroyGroup(client as never, DEFAULT_CONTEXT, { groupId: 'g1' });
    await requestLeaveGroup(client as never, DEFAULT_CONTEXT, { groupId: 'g1' });
    await requestJoinGroup(client as never, DEFAULT_CONTEXT, { groupId: 'g1', message: 'join' });
    await requestAcceptInvitation(client as never, DEFAULT_CONTEXT, { groupId: 'g1' });
    await requestRejectInvitation(client as never, DEFAULT_CONTEXT, { groupId: 'g1' });
    await requestMuteGroupMembers(client as never, DEFAULT_CONTEXT, {
      groupId: 'g1',
      userIds: ['bob', 'bob'],
      muteDuration: 60,
    });
    await requestMuteAllGroupMembers(client as never, DEFAULT_CONTEXT, { groupId: 'g1' });
    await requestUnmuteAllGroupMembers(client as never, DEFAULT_CONTEXT, { groupId: 'g1' });
    await requestBlockGroupMembers(client as never, DEFAULT_CONTEXT, {
      groupId: 'g1',
      userIds: ['bob'],
    });
    await requestAddUsersToGroupAllowlist(client as never, DEFAULT_CONTEXT, {
      groupId: 'g1',
      userIds: ['bob'],
    });
    await requestUpdateGroupAnnouncement(client as never, DEFAULT_CONTEXT, {
      groupId: 'g1',
      announcement: 'notice',
    });
    await requestSetGroupMemberAttributes(client as never, DEFAULT_CONTEXT, {
      groupId: 'g1',
      userId: 'bob',
      memberAttributes: { role: 'admin' },
    });

    expect(client.post).toHaveBeenNthCalledWith(
      1,
      '/org/app/chatgroups?resource=web',
      {
        owner: 'alice',
        groupname: 'Group 1',
        desc: 'desc',
        members: ['bob'],
        public: true,
        approval: false,
        allowinvites: true,
        invite_need_confirm: false,
        maxusers: 200,
        custom: undefined,
        avatar: undefined,
      },
      { operation: 'createGroup' }
    );
    expect(client.put).toHaveBeenNthCalledWith(
      1,
      '/org/app/chatgroups/g1?resource=web&version=v3',
      {
        groupname: 'Updated',
        membersonly: true,
        maxusers: 300,
      },
      { operation: 'updateGroupInfo' }
    );
    expect(client.put).toHaveBeenNthCalledWith(
      2,
      '/org/app/chatgroups/g1?resource=web',
      { newowner: 'carol' },
      { operation: 'changeGroupOwner' }
    );
    expect(client.delete).toHaveBeenNthCalledWith(
      1,
      '/org/app/chatgroups/g1?version=v3&resource=web',
      { operation: 'destroyGroup' }
    );
    expect(client.delete).toHaveBeenNthCalledWith(2, '/org/app/chatgroups/g1/quit?resource=web', {
      operation: 'leaveGroup',
    });
    expect(client.post).toHaveBeenNthCalledWith(
      2,
      '/org/app/chatgroups/g1/apply?resource=web',
      { message: 'join' },
      { operation: 'joinGroup' }
    );
    expect(client.post).toHaveBeenNthCalledWith(
      3,
      '/org/app/chatgroups/g1/invite_verify?resource=web',
      { invitee: 'alice', verifyResult: true },
      { operation: 'acceptInvitation' }
    );
    expect(client.post).toHaveBeenNthCalledWith(
      4,
      '/org/app/chatgroups/g1/invite_verify?resource=web',
      { invitee: 'alice', verifyResult: false },
      { operation: 'rejectInvitation' }
    );
    expect(client.post).toHaveBeenNthCalledWith(
      5,
      '/org/app/chatgroups/g1/mute?resource=web',
      { usernames: ['bob'], mute_duration: 60 },
      { operation: 'muteGroupMembers' }
    );
    expect(client.post).toHaveBeenNthCalledWith(
      6,
      '/org/app/chatgroups/g1/ban?resource=web',
      undefined,
      { operation: 'muteAllGroupMembers' }
    );
    expect(client.post).toHaveBeenNthCalledWith(
      7,
      '/org/app/chatgroups/g1/blocks/users?resource=web',
      { usernames: ['bob'] },
      { operation: 'blockGroupMembers' }
    );
    expect(client.post).toHaveBeenNthCalledWith(
      8,
      '/org/app/chatgroups/g1/white/users?resource=web',
      { usernames: ['bob'] },
      { operation: 'addUsersToGroupAllowlist' }
    );
    expect(client.post).toHaveBeenNthCalledWith(
      9,
      '/org/app/chatgroups/g1/announcement?resource=web',
      { announcement: 'notice' },
      { operation: 'updateGroupAnnouncement' }
    );
    expect(client.put).toHaveBeenNthCalledWith(
      3,
      '/org/app/sdk/metadata/chatgroup/g1/user/bob?resource=web',
      { metaData: { role: 'admin' } },
      { operation: 'setGroupMemberAttributes' }
    );
    expect(client.delete).toHaveBeenNthCalledWith(3, '/org/app/chatgroups/g1/ban?resource=web', {
      operation: 'unmuteAllGroupMembers',
    });
  });

  it('成员/管理员/禁言/allowlist 相关接口应拼接正确路径', async () => {
    const client = createRestClient();
    client.post.mockResolvedValue({});
    client.delete.mockResolvedValue({});
    client.get.mockResolvedValue({ data: ['bob'] });

    await requestAddGroupAdmin(client as never, DEFAULT_CONTEXT, {
      groupId: 'g1',
      userId: 'bob',
    });
    await requestRemoveGroupAdmin(client as never, DEFAULT_CONTEXT, {
      groupId: 'g1',
      userId: 'bob',
    });
    await requestUnmuteGroupMembers(client as never, DEFAULT_CONTEXT, {
      groupId: 'g1',
      userIds: ['bob', 'carol'],
    });
    await requestUnblockGroupMembers(client as never, DEFAULT_CONTEXT, {
      groupId: 'g1',
      userIds: ['bob', 'carol'],
    });
    await requestRemoveUsersFromGroupAllowlist(client as never, DEFAULT_CONTEXT, {
      groupId: 'g1',
      userIds: ['bob', 'carol'],
    });
    await requestRemoveGroupMembers(client as never, DEFAULT_CONTEXT, {
      groupId: 'g1',
      userIds: ['bob', 'bob', 'carol'],
    });
    await expect(
      requestGetGroupMuteList(client as never, DEFAULT_CONTEXT, { groupId: 'g1' })
    ).resolves.toEqual([{ user: { userId: 'bob' } }]);

    expect(client.post).toHaveBeenNthCalledWith(
      1,
      '/org/app/chatgroups/g1/admin?resource=web',
      { newadmin: 'bob' },
      { operation: 'addGroupAdmin' }
    );
    expect(client.delete).toHaveBeenNthCalledWith(
      1,
      '/org/app/chatgroups/g1/admin/bob?resource=web',
      { operation: 'removeGroupAdmin' }
    );
    expect(client.delete).toHaveBeenNthCalledWith(
      2,
      '/org/app/chatgroups/g1/mute/bob,carol?resource=web',
      { operation: 'unmuteGroupMembers' }
    );
    expect(client.delete).toHaveBeenNthCalledWith(
      3,
      '/org/app/chatgroups/g1/blocks/users/bob,carol?resource=web',
      { operation: 'unblockGroupMembers' }
    );
    expect(client.delete).toHaveBeenNthCalledWith(
      4,
      '/org/app/chatgroups/g1/white/users/bob,carol?resource=web',
      { operation: 'removeUsersFromGroupAllowlist' }
    );
    expect(client.delete).toHaveBeenNthCalledWith(
      5,
      '/org/app/chatgroups/g1/users/bob,carol?resource=web',
      { operation: 'removeGroupMembers' }
    );
    expect(client.get).toHaveBeenLastCalledWith('/org/app/chatgroups/g1/mute?version=v3', {
      operation: 'getGroupMuteList',
    });
  });

  it('requestGetGroupMuteList 应正确拼接分页参数', async () => {
    const client = createRestClient();
    client.get.mockResolvedValueOnce({ data: [] });

    await requestGetGroupMuteList(
      client as never,
      DEFAULT_CONTEXT,
      { groupId: 'g1', pageNum: 2, pageSize: 10 }
    );

    expect(client.get).toHaveBeenCalledWith(
      '/org/app/chatgroups/g1/mute?version=v3&pagenum=2&pagesize=10',
      { operation: 'getGroupMuteList' }
    );
  });

  it('requestUpdateGroupInfo 在缺少可更新字段时应抛出统一校验错误', async () => {
    const client = createRestClient();

    await expect(
      requestUpdateGroupInfo(client as never, DEFAULT_CONTEXT, {
        groupId: 'g1',
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_REQUIRED,
    });
  });

  it('布尔/公告/成员属性/共享文件接口应返回归一化结果', async () => {
    const client = createRestClient();
    client.get
      .mockResolvedValueOnce({ data: true })
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce({ announcement: 'notice' });
    client.post.mockResolvedValueOnce({
      data: {
        bob: {
          role: 'admin',
        },
      },
    });
    client.delete.mockResolvedValueOnce({});

    await expect(
      requestCheckIfInGroupAllowList(client as never, DEFAULT_CONTEXT, {
        groupId: 'g1',
      })
    ).resolves.toBe(true);
    await expect(
      requestCheckIfInGroupMuteList(client as never, DEFAULT_CONTEXT, {
        groupId: 'g1',
      })
    ).resolves.toBe(false);
    await expect(
      requestGetGroupAnnouncement(client as never, DEFAULT_CONTEXT, {
        groupId: 'g1',
      })
    ).resolves.toEqual({
      announcement: 'notice',
    });
    await expect(
      requestGetGroupMembersAttributes(client as never, DEFAULT_CONTEXT, {
        groupId: 'g1',
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
    await requestDeleteGroupSharedFile(client as never, DEFAULT_CONTEXT, {
      groupId: 'g1',
      fileId: 'f1',
    });

    expect(client.get).toHaveBeenNthCalledWith(
      1,
      '/org/app/chatgroups/g1/white/users/alice?version=v3',
      {
        operation: 'checkIfInGroupAllowList',
      }
    );
    expect(client.get).toHaveBeenNthCalledWith(2, '/org/app/sdk/chatgroups/g1/mute/alice', {
      operation: 'checkIfInGroupMuteList',
    });
    expect(client.get).toHaveBeenNthCalledWith(3, '/org/app/chatgroups/g1/announcement', {
      operation: 'getGroupAnnouncement',
    });
    expect(client.post).toHaveBeenCalledWith(
      '/org/app/sdk/metadata/chatgroup/g1/get',
      {
        targets: ['bob'],
        properties: ['role'],
      },
      {
        operation: 'getGroupMembersAttributes',
      }
    );
    expect(client.delete).toHaveBeenCalledWith(
      '/org/app/chatgroups/g1/share_files/f1?resource=web',
      { operation: 'deleteGroupSharedFile' }
    );
  });
});
