import { describe, expect, it } from 'vitest';

import { mapMucOperationToGroupEvent } from '@/managers/group/group-event-mapper';

describe('group event mapper', () => {
  it('应把 INVITE 映射为 onInvitationReceived', () => {
    expect(
      mapMucOperationToGroupEvent({
        operation: 7,
        groupId: 'g1',
        groupName: 'Group 1',
        from: {
          name: 'bob',
        },
        to: [{ name: 'alice' }],
        reason: 'join us',
        source: 'direct',
      })
    ).toEqual({
      eventName: 'onInvitationReceived',
      payload: {
        groupId: 'g1',
        groupName: 'Group 1',
        inviterId: 'bob',
        reason: 'join us',
      },
    });
  });

  it('应把 UPDATE 映射为 onGroupInfoChanged 并归一化 patch 字段', () => {
    expect(
      mapMucOperationToGroupEvent({
        operation: 14,
        groupId: 'g1',
        groupName: 'Group 1',
        eventExt: JSON.stringify({
          name: 'New Group',
          members_only: true,
          allow_user_invites: false,
          max_users: 300,
          custom: '{"a":1}',
        }),
        source: 'direct',
      })
    ).toEqual({
      eventName: 'onGroupInfoChanged',
      payload: {
        groupId: 'g1',
        groupName: 'Group 1',
        shouldFetchGroupDetail: true,
        groupPatch: {
          name: 'New Group',
          joinApprovalRequired: true,
          allowInvites: false,
          maxMembers: 300,
          ext: '{"a":1}',
        },
      },
    });
  });

  it('应把 GROUP_MEMBER_METADATA_UPDATE 映射为 onGroupMemberAttributeChanged', () => {
    expect(
      mapMucOperationToGroupEvent({
        operation: 45,
        groupId: 'g1',
        from: {
          name: 'bob',
          clientResource: 'ios',
        },
        eventExt: JSON.stringify({
          username: 'carol',
          properties: {
            nickname: 'Carol',
            group_name_card: 'Team Carol',
          },
        }),
        source: 'multiDevice',
      })
    ).toEqual({
      eventName: 'onGroupMemberAttributeChanged',
      payload: {
        groupId: 'g1',
        groupName: undefined,
        userId: 'carol',
        attribute: {
          nickname: 'Carol',
          group_name_card: 'Team Carol',
        },
        from: 'bob',
        source: 'multiDevice',
      },
    });
  });

  it('应映射 mute/allowlist/admin/owner 相关操作', () => {
    expect(
      mapMucOperationToGroupEvent({
        operation: 23,
        groupId: 'g1',
        to: [{ name: 'bob' }],
        reason: '3600',
      })
    ).toEqual({
      eventName: 'onMuteListAdded',
      payload: {
        groupId: 'g1',
        groupName: undefined,
        userIds: ['bob'],
        muteExpire: 3600,
      },
    });

    expect(
      mapMucOperationToGroupEvent({
        operation: 30,
        groupId: 'g1',
        members: [' alice ', 'alice', ''],
      })
    ).toEqual({
      eventName: 'onAllowListRemoved',
      payload: {
        groupId: 'g1',
        groupName: undefined,
        userIds: ['alice', 'alice'],
      },
    });

    expect(
      mapMucOperationToGroupEvent({
        operation: 21,
        groupId: 'g1',
        from: { name: 'owner' },
      })
    ).toEqual({
      eventName: 'onAdminAdded',
      payload: {
        groupId: 'g1',
        groupName: undefined,
        administratorId: 'owner',
      },
    });

    expect(
      mapMucOperationToGroupEvent({
        operation: 20,
        groupId: 'g1',
        from: { name: 'old-owner' },
        to: [{ name: 'new-owner' }],
      })
    ).toEqual({
      eventName: 'onOwnerChanged',
      payload: {
        groupId: 'g1',
        groupName: undefined,
        oldOwnerId: 'old-owner',
        newOwnerId: 'new-owner',
      },
    });
  });

  it('应映射成员进出群、公告、共享文件和群状态变化', () => {
    expect(
      mapMucOperationToGroupEvent({
        operation: 17,
        groupId: 'g1',
        members: ['bob', 'carol'],
      })
    ).toEqual({
      eventName: 'onMembersJoined',
      payload: {
        groupId: 'g1',
        groupName: undefined,
        memberIds: ['bob', 'carol'],
      },
    });

    expect(
      mapMucOperationToGroupEvent({
        operation: 18,
        groupId: 'g1',
        from: { name: 'bob' },
      })
    ).toEqual({
      eventName: 'onMembersExited',
      payload: {
        groupId: 'g1',
        groupName: undefined,
        memberIds: ['bob'],
      },
    });

    expect(
      mapMucOperationToGroupEvent({
        operation: 25,
        groupId: 'g1',
        reason: 'new notice',
      })
    ).toEqual({
      eventName: 'onAnnouncementChanged',
      payload: {
        groupId: 'g1',
        groupName: undefined,
        announcement: 'new notice',
      },
    });

    expect(
      mapMucOperationToGroupEvent({
        operation: 27,
        groupId: 'g1',
        eventExt: JSON.stringify({
          fileId: 'f1',
          fileName: 'a.txt',
          fileSize: 1,
          fileOwner: {
            userId: 'bob',
          },
        }),
      })
    ).toEqual({
      eventName: 'onSharedFileAdded',
      payload: {
        groupId: 'g1',
        groupName: undefined,
        sharedFile: {
          createdAt: undefined,
          fileId: 'f1',
          fileName: 'a.txt',
          fileSize: 1,
          fileOwner: undefined,
        },
      },
    });

    expect(
      mapMucOperationToGroupEvent({
        operation: 28,
        groupId: 'g1',
        reason: '{"file_id":"f2"}',
      })
    ).toEqual({
      eventName: 'onSharedFileDeleted',
      payload: {
        groupId: 'g1',
        groupName: undefined,
        fileId: 'f2',
      },
    });

    expect(
      mapMucOperationToGroupEvent({
        operation: 41,
        groupId: 'g1',
      })
    ).toEqual({
      eventName: 'onGroupDisabledChanged',
      payload: {
        groupId: 'g1',
        groupName: undefined,
        shouldFetchGroupDetail: true,
        isDisabled: true,
      },
    });
  });

  it('无法识别的 operation 应返回 null', () => {
    expect(
      mapMucOperationToGroupEvent({
        operation: 999,
        groupId: 'g1',
      })
    ).toBeNull();
  });
});
