import { beforeEach, describe, expect, it } from 'vitest';

import {
  ChatClient,
  GroupManager,
  Group,
  type CreateGroupParams,
  type GroupAdminAddedEventPayload,
  type GroupAllowlistEntry,
  type GroupBlocklistEntry,
  type GroupDetail,
  type GroupEventHandlerMap,
  type GroupListResult,
  type GroupMemberEntry,
  type GroupMembersAttributesResult,
  type GroupMuteEntry,
  type GroupMutationTarget,
  type GroupSharedFileListResult,
  type GroupUpdateConfigsInput,
  type GroupUpdateInfoInput,
  type GroupUserBatchParams,
  type JoinedGroupSummary,
} from '@/index';
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

const resetSingleton = (): void => {
  (ChatClient as unknown as { instance: ChatClient | null }).instance = null;
};

describe('group manager types', () => {
  beforeEach((): void => {
    resetSingleton();
  });

  it('群组写接口应返回 Promise<void> 或明确业务对象', () => {
    type CreateGroupReturn = ReturnType<GroupManager['createGroup']>;
    type DestroyGroupReturn = ReturnType<GroupManager['destroyGroup']>;
    type InviteUsersToGroupReturn = ReturnType<GroupManager['inviteUsersToGroup']>;
    type AcceptInvitationReturn = ReturnType<GroupManager['acceptInvitation']>;

    const createGroupPromise: CreateGroupReturn = Promise.resolve({
      groupId: 'g1',
    });
    const destroyGroupPromise: DestroyGroupReturn = Promise.resolve();
    const inviteUsersPromise: InviteUsersToGroupReturn = Promise.resolve();
    const acceptInvitePromise: AcceptInvitationReturn = Promise.resolve();

    expect(createGroupPromise).toBeInstanceOf(Promise);
    expect(destroyGroupPromise).toBeInstanceOf(Promise);
    expect(inviteUsersPromise).toBeInstanceOf(Promise);
    expect(acceptInvitePromise).toBeInstanceOf(Promise);
  });

  it('群组列表和成员读取结果类型应通过根导出可用', () => {
    const list: GroupListResult = {
      items: [
        {
          groupId: 'g1',
          name: 'Group 1',
          joinApprovalRequired: false,
        },
      ],
      pageNum: 1,
      pageSize: 20,
    };
    const member: GroupMemberEntry = {
      user: {
        userId: 'bob',
        nickname: 'Bob',
      },
      role: 'member',
    };
    const detail: GroupDetail = {
      groupId: 'g1',
      name: 'Group 1',
      owner: {
        userId: 'owner',
      },
    };

    expect(list.items[0]?.groupId).toBe('g1');
    expect(member.user.nickname).toBe('Bob');
    expect(detail.owner?.userId).toBe('owner');
  });

  it('getGroup 应返回 Group 对象，列表项仍为 GroupSummary 纯数据', () => {
    const manager = new GroupManager();
    manager.bind(createMockClient());

    const group = manager.getGroup('g1');
    const summary: JoinedGroupSummary | null = group.getSummary();
    const updateInput: GroupUpdateInfoInput = {
      name: 'Group 1',
    };
    const configsInput: GroupUpdateConfigsInput = {
      public: true,
      maxMembers: 200,
    };
    type GetGroupReturn = ReturnType<GroupManager['getGroup']>;
    const sameTypeGroup: GetGroupReturn = group;

    expect(group).toBeInstanceOf(Group);
    expect(group.groupId).toBe('g1');
    expect(summary).toBeNull();
    expect(updateInput.name).toBe('Group 1');
    expect(configsInput.public).toBe(true);
    expect(sameTypeGroup.groupId).toBe('g1');
  });

  it('getJoinedGroupList 应返回本地同步群列表且不再接收分页参数', () => {
    const manager = new GroupManager();
    manager.bind(createMockClient());

    type GetJoinedGroupListReturn = ReturnType<GroupManager['getJoinedGroupList']>;
    const groups: ReadonlyArray<JoinedGroupSummary> = manager.getJoinedGroupList();
    const sameTypeGroups: GetJoinedGroupListReturn = groups;

    // @ts-expect-error 045 已将 getJoinedGroupList 收敛为无参本地快照读取
    void manager.getJoinedGroupList({ pageNum: 1, pageSize: 20 });

    expect(Array.isArray(groups)).toBe(true);
    expect(sameTypeGroups.length).toBe(0);
  });

  it('批量参数应固定使用 userIds: string[]', () => {
    const readonlyUserIds = ['bob', 'carol'] as const;
    const batchParams: GroupUserBatchParams = {
      groupId: 'g1',
      userIds: readonlyUserIds,
    };
    const target: GroupMutationTarget = {
      groupId: 'g1',
    };
    const createParams: CreateGroupParams = {
      name: 'Group 1',
      description: 'desc',
      memberIds: ['bob'],
      public: false,
      joinApprovalRequired: true,
      allowInvites: true,
      inviteNeedConfirm: true,
    };

    expect(batchParams.userIds).toEqual(['bob', 'carol']);
    expect(target.groupId).toBe('g1');
    expect(createParams.memberIds).toEqual(['bob']);
  });

  it('client.use(GroupManager) 与 init({ managers }) 应暴露 groupManager 公开入口', () => {
    const client = ChatClient.init({ appKey: 'org#app' }).use(GroupManager);
    const initClient = ChatClient.init({
      appKey: 'org#app',
      managers: [GroupManager],
    });

    const groupFromUse = client.groupManager.getGroup('g1');
    const groupFromInit = initClient.groupManager.getGroup('g2');

    expect(groupFromUse).toBeInstanceOf(Group);
    expect(groupFromInit).toBeInstanceOf(Group);
    expect(groupFromUse.groupId).toBe('g1');
    expect(groupFromInit.groupId).toBe('g2');
  });

  it('对象化返回类型应覆盖 allowlist、blocklist 与 mute list', () => {
    const allowlist: ReadonlyArray<GroupAllowlistEntry> = [
      {
        user: {
          userId: 'bob',
        },
      },
    ];
    const blocklist: ReadonlyArray<GroupBlocklistEntry> = [
      {
        user: {
          userId: 'carol',
        },
      },
    ];
    const muteList: ReadonlyArray<GroupMuteEntry> = [
      {
        user: {
          userId: 'dave',
        },
      },
    ];
    expect(allowlist[0]?.user.userId).toBe('bob');
    expect(blocklist[0]?.user.userId).toBe('carol');
    expect(muteList[0]?.user.userId).toBe('dave');
  });

  it('高阶群能力返回类型应覆盖共享文件与成员属性结果', () => {
    const sharedFiles: GroupSharedFileListResult = {
      items: [
        {
          fileId: 'f1',
          fileName: 'a.txt',
          fileOwner: {
            userId: 'bob',
          },
        },
      ],
      pageNum: 1,
      pageSize: 20,
    };
    const attributes: GroupMembersAttributesResult = {
      items: {
        bob: {
          role: 'admin',
        },
      },
    };

    expect(sharedFiles.items[0]?.fileOwner?.userId).toBe('bob');
    expect(attributes.items.bob?.role).toBe('admin');
  });

  it('Group facade 类型签名应独立于列表项 plain object', () => {
    const manager = new GroupManager();
    manager.bind(createMockClient());

    const list: GroupListResult = {
      items: [
        {
          groupId: 'g1',
          name: 'Group 1',
        },
      ],
    };
    const group = manager.getGroup(list.items[0]!.groupId);
    type GetMembersReturn = ReturnType<Group['getMembers']>;
    type GetAdminsReturn = ReturnType<Group['getAdmins']>;
    type GetAnnouncementReturn = ReturnType<Group['getAnnouncement']>;

    const membersPromise: GetMembersReturn = Promise.resolve({
      items: [],
    });
    const adminsPromise: GetAdminsReturn = Promise.resolve([]);
    const announcementPromise: GetAnnouncementReturn = Promise.resolve({
      announcement: 'notice',
    });

    expect(group).toBeInstanceOf(Group);
    expect(group.groupId).toBe('g1');
    expect(list.items[0]).not.toBeInstanceOf(Group);
    expect(membersPromise).toBeInstanceOf(Promise);
    expect(adminsPromise).toBeInstanceOf(Promise);
    expect(announcementPromise).toBeInstanceOf(Promise);
  });

  it('旧别名与过时入参不应出现在公开类型里', () => {
    const manager = new GroupManager();
    manager.bind(createMockClient());
    type AcceptInvitationParams = Parameters<GroupManager['acceptInvitation']>[0];

    // @ts-expect-error 027 已移除 whitelist 旧命名公开面
    void manager.getGroupWhitelist;
    // @ts-expect-error 群消息已读成员入口归属 ChatManager，不再由 GroupManager 暴露
    void manager.getGroupMessageReadUserList;
    // @ts-expect-error 群消息已读成员入口归属 ChatManager，不再由 Group 暴露
    void manager.getGroup('g1').getMessageReadUserList;
    // @ts-expect-error 027 已移除 invitee 外部入参
    const invalidAcceptInviteParams: AcceptInvitationParams = { groupId: 'g1', invitee: 'bob' };
    void invalidAcceptInviteParams;

    expect(manager).toBeInstanceOf(GroupManager);
  });

  it('群事件 handler map 与 payload 类型应通过根导出可用', () => {
    const adminPayload: GroupAdminAddedEventPayload = {
      groupId: 'g1',
      administrator: {
        userId: 'bob',
      },
    };
    const handlers: GroupEventHandlerMap = {
      onInvitationReceived: payload => {
        expect(payload.inviter?.userId).toBe('bob');
      },
      onGroupInfoChanged: payload => {
        expect(payload.groupInfo.groupId).toBe('g1');
      },
      onAdminAdded: payload => {
        expect(payload.administrator?.userId).toBe('bob');
      },
    };

    void handlers.onAdminAdded?.(adminPayload);
    void handlers.onInvitationReceived?.({
      groupId: 'g1',
      inviter: {
        userId: 'bob',
      },
      reason: 'join us',
    });
    void handlers.onGroupInfoChanged?.({
      groupId: 'g1',
      groupInfo: {
        groupId: 'g1',
        name: 'Group 1',
      },
    });
  });

  it('allowlist 自查接口类型应暴露无 userId 的当前用户语义', () => {
    type CheckIfInGroupAllowListReturn = ReturnType<GroupManager['checkIfInGroupAllowList']>;
    type CheckIfInAllowListReturn = ReturnType<Group['checkIfInAllowList']>;

    const managerReturn: CheckIfInGroupAllowListReturn = Promise.resolve(true);
    const groupReturn: CheckIfInAllowListReturn = Promise.resolve(true);

    expect(managerReturn).toBeInstanceOf(Promise);
    expect(groupReturn).toBeInstanceOf(Promise);
  });
});
