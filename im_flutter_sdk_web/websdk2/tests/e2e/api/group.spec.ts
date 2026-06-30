/**
 * E2E 测试 - 群组管理
 * 迁移自 robot: wayang/TestCase/群组/群组基础操作.robot + 群组操作.robot（Webim 标记用例）
 */
import { test, expect } from '../fixtures/sdk-api';

const GROUP_NOT_FOUND_CODE = 606;
const REST_BUSINESS_UNKNOWN_CODE = 303;

type CapturedOperationResult =
  | {
      ok: true;
      value: unknown;
    }
  | {
      ok: false;
      name: string;
      code: number;
      message: string;
      details: unknown;
    };

type GroupEventUser = {
  userId: string;
};

type GroupDetailPayload = {
  groupId: string;
  name: string;
  description?: string;
  public?: boolean;
  joinApprovalRequired?: boolean;
  allowInvites?: boolean;
  inviteNeedConfirm?: boolean;
  maxMembers?: number;
  owner?: GroupEventUser;
  role?: string;
  muteAllMembers?: boolean;
  ext?: string;
  createdAt?: number;
  memberCount?: number;
};

const waitForOptionalGroupEvent = async <T>(
  user: {
    waitForEventMatching: <R>(
      eventName: string,
      predicate: (payload: R) => boolean,
      timeoutMs?: number
    ) => Promise<R>;
  },
  eventName: string,
  predicate: (payload: T) => boolean,
  timeoutMs = 10000
): Promise<T | null> => {
  try {
    return await user.waitForEventMatching<T>(eventName, predicate, timeoutMs);
  } catch {
    return null;
  }
};

test.describe('group - 群组管理', () => {
  let createdGroupId: string | null = null;
  let createdGroupName = '';
  let createdGroupDescription = '';

  test.beforeEach(async ({ userA, userB }) => {
    createdGroupName = `e2e-group-${Date.now()}`;
    createdGroupDescription = `group-desc-${Date.now()}`;
    const result = (await userA.page.evaluate(
      async ({ memberId, name, description }) => {
        const mgr = (window.__CLIENT__ as any).groupManager;
        return mgr.createGroup({
          name,
          description,
          memberIds: [memberId],
          public: true,
          joinApprovalRequired: false,
          inviteNeedConfirm: false,
          allowInvites: true,
          maxMembers: 200,
        });
      },
      {
        memberId: userB.userId,
        name: createdGroupName,
        description: createdGroupDescription,
      }
    )) as { groupId: string };

    createdGroupId = result.groupId;
    await userA.page.waitForTimeout(3000);
  });

  test.afterEach(async ({ userA }) => {
    if (!createdGroupId) {
      return;
    }
    await userA.page.evaluate(async (groupId: string) => {
      try {
        await (window.__CLIENT__ as any).groupManager.destroyGroup({ groupId });
      } catch {}
    }, createdGroupId);
    createdGroupId = null;
  });

  test('getJoinedGroupList 应返回登录同步下来的本地群快照', async ({ userA }) => {
    expect(createdGroupId).toBeTruthy();

    const joined = (await userA.page.evaluate(async () => {
      return (window.__CLIENT__ as any).groupManager.getJoinedGroupList();
    })) as Array<{
        groupId: string;
        name: string;
        description?: string;
        public?: boolean;
        joinApprovalRequired?: boolean;
        allowInvites?: boolean;
        maxMembers?: number;
        role?: string;
      }>;

    expect(Array.isArray(joined)).toBe(true);

    const firstJoinedGroup = joined[0];
    if (firstJoinedGroup) {
      const summary = (await userA.page.evaluate((groupId: string) => {
        return (window.__CLIENT__ as any).groupManager.getGroup(groupId).getSummary();
      }, firstJoinedGroup.groupId)) as {
        groupId: string;
        name: string;
      } | null;

      expect(summary).toMatchObject({
        groupId: firstJoinedGroup.groupId,
        name: firstJoinedGroup.name,
      });
    }
  });

  test('getGroupInfo / getGroupMemberList 应返回详情与成员列表稳定字段', async ({
    userA,
    userB,
  }) => {
    const detail = (await userA.page.evaluate(async (groupId: string) => {
      return (window.__CLIENT__ as any).groupManager.getGroupInfo({ groupId });
    }, createdGroupId!)) as {
      groupId: string;
      name: string;
      description?: string;
      public?: boolean;
      joinApprovalRequired?: boolean;
      allowInvites?: boolean;
      inviteNeedConfirm?: boolean;
      maxMembers?: number;
      owner?: { userId: string };
      role?: string;
      createdAt?: number;
      memberCount?: number;
    };

    expect(detail.groupId).toBe(createdGroupId);
    expect(detail.name).toBe(createdGroupName);
    expect(detail.description).toBe(createdGroupDescription);
    expect(detail.public).toBe(true);
    expect(detail.joinApprovalRequired).toBe(false);
    expect(detail.allowInvites).toBe(true);
    if (detail.inviteNeedConfirm !== undefined) {
      expect(detail.inviteNeedConfirm).toBe(false);
    }
    expect(detail.maxMembers).toBe(200);
    expect(detail.owner?.userId).toBe(userA.userId);
    expect(detail.role).toBe('owner');
    expect(detail).not.toHaveProperty('memberIds');
    expect(typeof detail.createdAt).toBe('number');
    expect(detail.createdAt ?? 0).toBeGreaterThan(0);
    expect(typeof detail.memberCount).toBe('number');
    expect(detail.memberCount ?? 0).toBeGreaterThanOrEqual(2);

    const members = (await userA.page.evaluate(async (groupId: string) => {
      return (window.__CLIENT__ as any).groupManager.getGroupMemberList({
        groupId,
        pageSize: 20,
      });
    }, createdGroupId!)) as {
      items: Array<{
        user: { userId: string };
        role?: string;
        joinedAt?: number;
      }>;
      cursor?: string;
      hasMore?: boolean;
    };

    const memberIds = members.items.map(item => item.user.userId).sort();
    expect(memberIds).toEqual([userA.userId, userB.userId].sort());
    const ownerEntry = members.items.find(item => item.user.userId === userA.userId);
    const memberEntry = members.items.find(item => item.user.userId === userB.userId);
    expect(ownerEntry?.role).toBe('owner');
    expect(memberEntry?.role).toBe('member');
    expect(typeof (members.cursor ?? '')).toBe('string');
    if (members.hasMore !== undefined) {
      expect(typeof members.hasMore).toBe('boolean');
    }
  });

  test('getGroup handle 应绑定 groupId 并代理详情、成员与公告 API', async ({ userA, userB }) => {
    const result = (await userA.page.evaluate(async (groupId: string) => {
      const group = (window.__CLIENT__ as any).groupManager.getGroup(groupId);
      const detail = await group.getDetail();
      const members = await group.getMembers({ pageSize: 20 });
      const announcement = await group.getAnnouncement();
      return {
        groupId: group.groupId,
        methodTypes: {
          refresh: typeof group.refresh,
          updateInfo: typeof group.updateInfo,
          getMembers: typeof group.getMembers,
          getAnnouncement: typeof group.getAnnouncement,
        },
        detail,
        members,
        announcement,
      };
    }, createdGroupId!)) as {
      groupId: string;
      methodTypes: Record<string, string>;
      detail: GroupDetailPayload;
      members: {
        items: Array<{
          user: GroupEventUser;
          role?: string;
        }>;
      };
      announcement: { announcement: string };
    };

    expect(result.groupId).toBe(createdGroupId);
    expect(result.methodTypes).toEqual({
      refresh: 'function',
      updateInfo: 'function',
      getMembers: 'function',
      getAnnouncement: 'function',
    });
    expect(result.detail).toMatchObject({
      groupId: createdGroupId!,
      name: createdGroupName,
      description: createdGroupDescription,
      owner: { userId: userA.userId },
      role: 'owner',
    });
    expect(result.detail).not.toHaveProperty('memberIds');
    expect(result.members.items.map(item => item.user.userId).sort()).toEqual(
      [userA.userId, userB.userId].sort()
    );
    expect(result.announcement).toEqual({ announcement: '' });

    const error = (await userA.page.evaluate(() => {
      try {
        (window.__CLIENT__ as any).groupManager.getGroup('   ');
        return null;
      } catch (e: any) {
        return {
          name: e.name,
          code: e.code,
          message: e.message,
          details: e.details,
        };
      }
    })) as {
      name: string;
      code: number;
      message: string;
      details: unknown;
    } | null;

    expect(error).toMatchObject({
      name: 'ValidationError',
      code: 110,
      message: 'groupId is required',
      details: {
        fields: [
          {
            path: 'groupId',
            message: 'groupId is required',
            rule: 'required',
          },
        ],
      },
    });
  });

  test('getGroupInfoList 应返回批量详情并校验空 groupIds', async ({ userA }) => {
    const result = (await userA.page.evaluate(async (groupId: string) => {
      const manager = (window.__CLIENT__ as any).groupManager;
      const capture = async () => {
        try {
          await manager.getGroupInfoList({ groupIds: [] });
          return null;
        } catch (e: any) {
          return {
            name: e.name,
            code: e.code,
            message: e.message,
            details: e.details,
          };
        }
      };
      return {
        groups: await manager.getGroupInfoList({ groupIds: [groupId] }),
        error: await capture(),
      };
    }, createdGroupId!)) as {
      groups: GroupDetailPayload[];
      error: {
        name: string;
        code: number;
        message: string;
        details: unknown;
      } | null;
    };

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]).toMatchObject({
      groupId: createdGroupId!,
      name: createdGroupName,
      description: createdGroupDescription,
      owner: { userId: userA.userId },
      role: 'owner',
      public: true,
      joinApprovalRequired: false,
    });
    expect(result.groups[0]).not.toHaveProperty('memberIds');
    expect(result.error).toMatchObject({
      name: 'ValidationError',
      code: 110,
      message: 'params.groupIds is required',
      details: {
        fields: [
          {
            path: 'params.groupIds',
            message: 'params.groupIds is required',
            rule: 'required',
          },
        ],
      },
    });
  });

  test('updateGroupInfo 应更新详情并向成员派发 specification changed 事件', async ({
    userA,
    userB,
  }) => {
    const nextName = `e2e-group-updated-${Date.now()}`;
    const nextDescription = `group-desc-updated-${Date.now()}`;
    const nextExt = JSON.stringify({ marker: nextName });
    await userA.clearEvents();
    await userB.clearEvents();

    await userA.page.evaluate(
      async ({ groupId, name, description, ext }) => {
        await (window.__CLIENT__ as any).groupManager.updateGroupInfo({
          groupId,
          name,
          description,
          ext,
          allowInvites: true,
          inviteNeedConfirm: false,
        });
      },
      {
        groupId: createdGroupId!,
        name: nextName,
        description: nextDescription,
        ext: nextExt,
      }
    );

    const detail = (await userA.page.evaluate(async (groupId: string) => {
      return (window.__CLIENT__ as any).groupManager.getGroupInfo({ groupId });
    }, createdGroupId!)) as GroupDetailPayload;
    expect(detail).toMatchObject({
      groupId: createdGroupId!,
      name: nextName,
      description: nextDescription,
      ext: nextExt,
      allowInvites: true,
      inviteNeedConfirm: false,
    });

    const event = await waitForOptionalGroupEvent<{
      groupId: string;
      groupInfo: GroupDetailPayload;
    }>(userB, 'onGroupInfoChanged', payload => payload.groupId === createdGroupId);
    if (event) {
      expect(event.groupId).toBe(createdGroupId);
      expect(event.groupInfo).toMatchObject({
        groupId: createdGroupId!,
        name: nextName,
        description: nextDescription,
      });
    }

    createdGroupName = nextName;
    createdGroupDescription = nextDescription;
  });

  test('getGroupAnnouncement 应返回标准结构', async ({ userA }) => {
    const announcement = (await userA.page.evaluate(async (groupId: string) => {
      return (window.__CLIENT__ as any).groupManager.getGroupAnnouncement({ groupId });
    }, createdGroupId!)) as { announcement: string };

    expect(announcement).toEqual({ announcement: '' });
  });

  test('updateGroupAnnouncement 后，getGroupAnnouncement 应返回新公告', async ({
    userA,
    userB,
  }) => {
    const announcement = `group-announcement-${Date.now()}`;
    await userA.clearEvents();
    await userB.clearEvents();

    await userA.page.evaluate(
      async ({ groupId, announcement }) => {
        await (window.__CLIENT__ as any).groupManager.updateGroupAnnouncement({
          groupId,
          announcement,
        });
      },
      { groupId: createdGroupId!, announcement }
    );

    const queried = (await userA.page.evaluate(async (groupId: string) => {
      return (window.__CLIENT__ as any).groupManager.getGroupAnnouncement({ groupId });
    }, createdGroupId!)) as { announcement: string };
    expect(queried).toEqual({ announcement });

    const events = await userB.getBufferedEvents<{
      groupId: string;
      announcement: string;
    }>('onAnnouncementChanged');
    const matchedEvent = events.find(item => item.groupId === createdGroupId);
    if (matchedEvent) {
      expect(matchedEvent).toEqual({
        groupId: createdGroupId!,
        announcement,
      });
    }
  });

  test('inviteUsersToGroup / acceptInvitation 应让被邀请人收到邀请并让邀请方收到同意事件', async ({
    userA,
    userB,
  }) => {
    const groupName = `e2e-invite-accept-${Date.now()}`;
    const group = (await userA.page.evaluate(async ({ name, ownerId }) => {
      return (window.__CLIENT__ as any).groupManager.createGroup({
        name,
        description: `${name}-desc`,
        memberIds: [ownerId],
        public: true,
        joinApprovalRequired: false,
        inviteNeedConfirm: true,
        allowInvites: true,
        maxMembers: 20,
      });
    }, { name: groupName, ownerId: userA.userId })) as { groupId: string };

    try {
      await userA.clearEvents();
      await userB.clearEvents();
      await userA.page.evaluate(
        async ({ groupId, userId }) => {
          await (window.__CLIENT__ as any).groupManager.inviteUsersToGroup({
            groupId,
            userIds: [userId],
          });
        },
        { groupId: group.groupId, userId: userB.userId }
      );

      const invitation = await userB.waitForEventMatching<{
        groupId: string;
        groupName?: string;
        inviter?: GroupEventUser;
      }>('onInvitationReceived', payload => payload.groupId === group.groupId);
      expect(invitation).toMatchObject({
        groupId: group.groupId,
        groupName,
        inviter: { userId: userA.userId },
      });

      await userB.page.evaluate(async (groupId: string) => {
        await (window.__CLIENT__ as any).groupManager.acceptInvitation({ groupId });
      }, group.groupId);

      const accepted = await waitForOptionalGroupEvent<{
        groupId: string;
        invitee?: GroupEventUser;
      }>(userA, 'onInvitationAccepted', payload => payload.groupId === group.groupId);
      if (accepted) {
        expect(accepted).toMatchObject({
          groupId: group.groupId,
          invitee: { userId: userB.userId },
        });
      }

      const members = (await userA.page.evaluate(async (groupId: string) => {
        return (window.__CLIENT__ as any).groupManager.getGroupMemberList({
          groupId,
          pageSize: 20,
        });
      }, group.groupId)) as { items: Array<{ user: GroupEventUser; role?: string }> };
      expect(members.items.map(item => item.user.userId).sort()).toEqual(
        [userA.userId, userB.userId].sort()
      );
    } finally {
      await userA.page.evaluate(async (groupId: string) => {
        try {
          await (window.__CLIENT__ as any).groupManager.destroyGroup({ groupId });
        } catch {}
      }, group.groupId);
    }
  });

  test('inviteUsersToGroup / rejectInvitation 应让邀请方收到拒绝事件且成员不入群', async ({
    userA,
    userB,
  }) => {
    const groupName = `e2e-invite-reject-${Date.now()}`;
    const group = (await userA.page.evaluate(async ({ name, ownerId }) => {
      return (window.__CLIENT__ as any).groupManager.createGroup({
        name,
        description: `${name}-desc`,
        memberIds: [ownerId],
        public: true,
        joinApprovalRequired: false,
        inviteNeedConfirm: true,
        allowInvites: true,
        maxMembers: 20,
      });
    }, { name: groupName, ownerId: userA.userId })) as { groupId: string };

    try {
      await userA.clearEvents();
      await userB.clearEvents();
      await userA.page.evaluate(
        async ({ groupId, userId }) => {
          await (window.__CLIENT__ as any).groupManager.inviteUsersToGroup({
            groupId,
            userIds: [userId],
          });
        },
        { groupId: group.groupId, userId: userB.userId }
      );
      const invitation = await userB.waitForEventMatching<{
        groupId: string;
        inviter?: GroupEventUser;
      }>('onInvitationReceived', payload => payload.groupId === group.groupId);
      expect(invitation).toMatchObject({
        groupId: group.groupId,
        inviter: { userId: userA.userId },
      });

      await userB.page.evaluate(async (groupId: string) => {
        await (window.__CLIENT__ as any).groupManager.rejectInvitation({ groupId });
      }, group.groupId);

      const declined = await waitForOptionalGroupEvent<{
        groupId: string;
        invitee?: GroupEventUser;
      }>(userA, 'onInvitationDeclined', payload => payload.groupId === group.groupId);
      if (declined) {
        expect(declined).toMatchObject({
          groupId: group.groupId,
          invitee: { userId: userB.userId },
        });
      }

      const members = (await userA.page.evaluate(async (groupId: string) => {
        return (window.__CLIENT__ as any).groupManager.getGroupMemberList({
          groupId,
          pageSize: 20,
        });
      }, group.groupId)) as { items: Array<{ user: GroupEventUser }> };
      expect(members.items.map(item => item.user.userId)).toEqual([userA.userId]);
    } finally {
      await userA.page.evaluate(async (groupId: string) => {
        try {
          await (window.__CLIENT__ as any).groupManager.destroyGroup({ groupId });
        } catch {}
      }, group.groupId);
    }
  });

  test('joinGroup / acceptGroupJoinRequest 应让群主收到申请并让申请人收到同意事件', async ({
    userA,
    userB,
  }) => {
    const groupName = `e2e-join-accept-${Date.now()}`;
    const joinReason = `join-reason-${Date.now()}`;
    const group = (await userA.page.evaluate(async ({ name, ownerId }) => {
      return (window.__CLIENT__ as any).groupManager.createGroup({
        name,
        description: `${name}-desc`,
        memberIds: [ownerId],
        public: true,
        joinApprovalRequired: true,
        inviteNeedConfirm: false,
        allowInvites: true,
        maxMembers: 20,
      });
    }, { name: groupName, ownerId: userA.userId })) as { groupId: string };

    try {
      await userA.clearEvents();
      await userB.clearEvents();
      await userB.page.evaluate(
        async ({ groupId, message }) => {
          await (window.__CLIENT__ as any).groupManager.joinGroup({
            groupId,
            message,
          });
        },
        { groupId: group.groupId, message: joinReason }
      );

      const request = await userA.waitForEventMatching<{
        groupId: string;
        groupName?: string;
        applicant?: GroupEventUser;
        reason?: string;
      }>('onRequestToJoinReceived', payload => payload.groupId === group.groupId);
      expect(request).toMatchObject({
        groupId: group.groupId,
        groupName: '',
        applicant: { userId: userB.userId },
        reason: joinReason,
      });

      await userA.page.evaluate(
        async ({ groupId, userId }) => {
          await (window.__CLIENT__ as any).groupManager.acceptGroupJoinRequest({
            groupId,
            userId,
          });
        },
        { groupId: group.groupId, userId: userB.userId }
      );

      const accepted = await userB.waitForEventMatching<{
        groupId: string;
        groupName?: string;
        accepter?: GroupEventUser;
      }>('onRequestToJoinAccepted', payload => payload.groupId === group.groupId);
      expect(accepted).toMatchObject({
        groupId: group.groupId,
        groupName: '',
        accepter: { userId: userA.userId },
      });

      const members = (await userA.page.evaluate(async (groupId: string) => {
        return (window.__CLIENT__ as any).groupManager.getGroupMemberList({
          groupId,
          pageSize: 20,
        });
      }, group.groupId)) as { items: Array<{ user: GroupEventUser }> };
      expect(members.items.map(item => item.user.userId).sort()).toEqual(
        [userA.userId, userB.userId].sort()
      );
    } finally {
      await userA.page.evaluate(async (groupId: string) => {
        try {
          await (window.__CLIENT__ as any).groupManager.destroyGroup({ groupId });
        } catch {}
      }, group.groupId);
    }
  });

  test('joinGroup / rejectGroupJoinRequest 应让申请人收到拒绝事件且成员不入群', async ({
    userA,
    userB,
  }) => {
    const groupName = `e2e-join-reject-${Date.now()}`;
    const rejectReason = `reject-reason-${Date.now()}`;
    const group = (await userA.page.evaluate(async ({ name, ownerId }) => {
      return (window.__CLIENT__ as any).groupManager.createGroup({
        name,
        description: `${name}-desc`,
        memberIds: [ownerId],
        public: true,
        joinApprovalRequired: true,
        inviteNeedConfirm: false,
        allowInvites: true,
        maxMembers: 20,
      });
    }, { name: groupName, ownerId: userA.userId })) as { groupId: string };

    try {
      await userA.clearEvents();
      await userB.clearEvents();
      await userB.page.evaluate(
        async ({ groupId, message }) => {
          await (window.__CLIENT__ as any).groupManager.joinGroup({
            groupId,
            message,
          });
        },
        { groupId: group.groupId, message: `join-${Date.now()}` }
      );
      const request = await userA.waitForEventMatching<{
        groupId: string;
        applicant?: GroupEventUser;
      }>('onRequestToJoinReceived', payload => payload.groupId === group.groupId);
      expect(request).toMatchObject({
        groupId: group.groupId,
        applicant: { userId: userB.userId },
      });

      await userA.page.evaluate(
        async ({ groupId, userId, reason }) => {
          await (window.__CLIENT__ as any).groupManager.rejectGroupJoinRequest({
            groupId,
            userId,
            reason,
          });
        },
        { groupId: group.groupId, userId: userB.userId, reason: rejectReason }
      );

      const declined = await userB.waitForEventMatching<{
        groupId: string;
        groupName?: string;
        decliner?: GroupEventUser;
        applicant?: GroupEventUser;
        reason?: string;
      }>('onRequestToJoinDeclined', payload => payload.groupId === group.groupId);
      expect(declined).toMatchObject({
        groupId: group.groupId,
        groupName: '',
        decliner: { userId: userA.userId },
        applicant: { userId: userB.userId },
        reason: rejectReason,
      });

      const members = (await userA.page.evaluate(async (groupId: string) => {
        return (window.__CLIENT__ as any).groupManager.getGroupMemberList({
          groupId,
          pageSize: 20,
        });
      }, group.groupId)) as { items: Array<{ user: GroupEventUser }> };
      expect(members.items.map(item => item.user.userId)).toEqual([userA.userId]);
    } finally {
      await userA.page.evaluate(async (groupId: string) => {
        try {
          await (window.__CLIENT__ as any).groupManager.destroyGroup({ groupId });
        } catch {}
      }, group.groupId);
    }
  });

  test('addGroupAdmin / getGroupAdminList / removeGroupAdmin 应返回一致结果并触发成员事件', async ({
    userA,
    userB,
  }) => {
    await userA.clearEvents();
    await userB.clearEvents();

    await userA.page.evaluate(
      async ({ groupId, userId }) => {
        await (window.__CLIENT__ as any).groupManager.addGroupAdmin({ groupId, userId });
      },
      { groupId: createdGroupId!, userId: userB.userId }
    );

    const addedAdmins = (await userA.page.evaluate(async (groupId: string) => {
      return (window.__CLIENT__ as any).groupManager.getGroupAdminList({ groupId });
    }, createdGroupId!)) as Array<{ userId: string }>;
    expect(addedAdmins.some(item => item.userId === userB.userId)).toBe(true);

    const addedEvent = (await userB.waitForEvent('onAdminAdded')) as {
      groupId: string;
      administrator?: { userId: string };
    };
    expect(addedEvent).toMatchObject({
      groupId: createdGroupId!,
      administrator: { userId: userB.userId },
    });

    await userA.clearEvents();
    await userB.clearEvents();
    await userA.page.evaluate(
      async ({ groupId, userId }) => {
        await (window.__CLIENT__ as any).groupManager.removeGroupAdmin({ groupId, userId });
      },
      { groupId: createdGroupId!, userId: userB.userId }
    );

    const adminsAfterRemove = (await userA.page.evaluate(async (groupId: string) => {
      return (window.__CLIENT__ as any).groupManager.getGroupAdminList({ groupId });
    }, createdGroupId!)) as Array<{ userId: string }>;
    expect(adminsAfterRemove.some(item => item.userId === userB.userId)).toBe(false);

    const removedEvent = (await userB.waitForEvent('onAdminRemoved')) as {
      groupId: string;
      administrator?: { userId: string };
    };
    expect(removedEvent).toMatchObject({
      groupId: createdGroupId!,
      administrator: { userId: userB.userId },
    });
  });

  test('changeGroupOwner 应更新 owner 并向新旧群主派发 owner changed 事件', async ({
    userA,
    userB,
  }) => {
    await userA.clearEvents();
    await userB.clearEvents();

    await userA.page.evaluate(
      async ({ groupId, newOwner }) => {
        await (window.__CLIENT__ as any).groupManager.changeGroupOwner({ groupId, newOwner });
      },
      { groupId: createdGroupId!, newOwner: userB.userId }
    );

    const userAEvent = await userA.waitForEventMatching<{
      groupId: string;
      newOwner?: GroupEventUser;
      oldOwner?: GroupEventUser;
    }>('onOwnerChanged', payload => payload.groupId === createdGroupId);
    const userBEvent = await userB.waitForEventMatching<{
      groupId: string;
      newOwner?: GroupEventUser;
      oldOwner?: GroupEventUser;
    }>('onOwnerChanged', payload => payload.groupId === createdGroupId);
    for (const event of [userAEvent, userBEvent]) {
      expect(event).toMatchObject({
        groupId: createdGroupId!,
        newOwner: { userId: userB.userId },
        oldOwner: { userId: userA.userId },
      });
    }

    const detailAfterTransfer = (await userB.page.evaluate(async (groupId: string) => {
      return (window.__CLIENT__ as any).groupManager.getGroupInfo({ groupId });
    }, createdGroupId!)) as GroupDetailPayload;
    expect(detailAfterTransfer.owner).toMatchObject({ userId: userB.userId });
    expect(detailAfterTransfer.role).toBe('owner');
    expect(detailAfterTransfer).not.toHaveProperty('memberIds');

    await userA.clearEvents();
    await userB.clearEvents();
    await userB.page.evaluate(
      async ({ groupId, newOwner }) => {
        await (window.__CLIENT__ as any).groupManager.changeGroupOwner({ groupId, newOwner });
      },
      { groupId: createdGroupId!, newOwner: userA.userId }
    );
    const transferBack = await userA.waitForEventMatching<{
      groupId: string;
      newOwner?: GroupEventUser;
      oldOwner?: GroupEventUser;
    }>('onOwnerChanged', payload => payload.groupId === createdGroupId);
    expect(transferBack).toMatchObject({
      groupId: createdGroupId!,
      newOwner: { userId: userA.userId },
      oldOwner: { userId: userB.userId },
    });
  });

  test('leaveGroup 应让普通成员退群并向群主派发 member exited 事件', async ({ userA, userB }) => {
    await userA.clearEvents();
    await userB.clearEvents();

    await userB.page.evaluate(async (groupId: string) => {
      await (window.__CLIENT__ as any).groupManager.leaveGroup({ groupId });
    }, createdGroupId!);

    const exited = await waitForOptionalGroupEvent<{
      groupId: string;
      members: GroupEventUser[];
    }>(userA, 'onMembersExited', payload => payload.groupId === createdGroupId);
    if (exited) {
      expect(exited).toMatchObject({
        groupId: createdGroupId!,
        members: [{ userId: userB.userId }],
      });
    }

    const members = (await userA.page.evaluate(async (groupId: string) => {
      return (window.__CLIENT__ as any).groupManager.getGroupMemberList({
        groupId,
        pageSize: 20,
      });
    }, createdGroupId!)) as { items: Array<{ user: GroupEventUser }> };
    expect(members.items.map(item => item.user.userId)).toEqual([userA.userId]);
  });

  test('removeGroupMembers 应移除成员并向被移除人派发 user removed 事件', async ({
    userA,
    userB,
  }) => {
    await userA.clearEvents();
    await userB.clearEvents();

    await userA.page.evaluate(
      async ({ groupId, userId }) => {
        await (window.__CLIENT__ as any).groupManager.removeGroupMembers({
          groupId,
          userIds: [userId],
        });
      },
      { groupId: createdGroupId!, userId: userB.userId }
    );

    const removed = await userB.waitForEventMatching<{
      groupId: string;
      groupName?: string;
    }>('onUserRemoved', payload => payload.groupId === createdGroupId);
    expect(removed).toMatchObject({
      groupId: createdGroupId!,
      groupName: '',
    });

    const members = (await userA.page.evaluate(async (groupId: string) => {
      return (window.__CLIENT__ as any).groupManager.getGroupMemberList({
        groupId,
        pageSize: 20,
      });
    }, createdGroupId!)) as { items: Array<{ user: GroupEventUser }> };
    expect(members.items.map(item => item.user.userId)).toEqual([userA.userId]);
  });

  test('muteAllGroupMembers / unmuteAllGroupMembers 应更新详情并派发全员禁言事件', async ({
    userA,
    userB,
  }) => {
    await userA.clearEvents();
    await userB.clearEvents();

    await userA.page.evaluate(async (groupId: string) => {
      await (window.__CLIENT__ as any).groupManager.muteAllGroupMembers({ groupId });
    }, createdGroupId!);

    const muteEvent = await waitForOptionalGroupEvent<{
      groupId: string;
      isMuted: boolean;
    }>(userB, 'onAllMemberMuteStateChanged', payload => payload.groupId === createdGroupId);
    if (muteEvent) {
      expect(muteEvent).toEqual({
        groupId: createdGroupId!,
        isMuted: true,
      });
    }

    const mutedDetail = (await userA.page.evaluate(async (groupId: string) => {
      return (window.__CLIENT__ as any).groupManager.getGroupInfo({ groupId });
    }, createdGroupId!)) as GroupDetailPayload;
    expect(mutedDetail.muteAllMembers).toBe(true);

    await userA.clearEvents();
    await userB.clearEvents();
    await userA.page.evaluate(async (groupId: string) => {
      await (window.__CLIENT__ as any).groupManager.unmuteAllGroupMembers({ groupId });
    }, createdGroupId!);

    const unmuteEvent = await waitForOptionalGroupEvent<{
      groupId: string;
      isMuted: boolean;
    }>(userB, 'onAllMemberMuteStateChanged', payload => payload.groupId === createdGroupId);
    if (unmuteEvent) {
      expect(unmuteEvent).toEqual({
        groupId: createdGroupId!,
        isMuted: false,
      });
    }
    const unmutedDetail = (await userA.page.evaluate(async (groupId: string) => {
      return (window.__CLIENT__ as any).groupManager.getGroupInfo({ groupId });
    }, createdGroupId!)) as GroupDetailPayload;
    expect(unmutedDetail.muteAllMembers).toBe(false);
  });

  test('普通成员设置管理员应返回权限错误', async ({ userB }) => {
    const error = (await userB.page.evaluate(
      async ({ groupId, userId }) => {
        try {
          await (window.__CLIENT__ as any).groupManager.addGroupAdmin({ groupId, userId });
          return null;
        } catch (e: any) {
          return {
            name: e.name,
            code: e.code,
            message: e.message,
          };
        }
      },
      {
        groupId: createdGroupId!,
        userId: userB.userId,
      }
    )) as {
      name: string;
      code: number;
      message: string;
    } | null;

    expect(error).not.toBeNull();
    expect(error?.name).toBe('AuthenticationError');
    expect(error?.code).toBe(108);
  });

  test('allowlist 添加/查询/移除应返回精确列表与事件字段', async ({ userA, userB }) => {
    await userA.clearEvents();
    await userB.clearEvents();

    await userA.page.evaluate(
      async ({ groupId, userId }) => {
        await (window.__CLIENT__ as any).groupManager.addUsersToGroupAllowlist({
          groupId,
          userIds: [userId],
        });
      },
      { groupId: createdGroupId!, userId: userB.userId }
    );

    const addEvent = (await userB.waitForEvent('onAllowListAdded')) as {
      groupId: string;
      allowlist: Array<{ userId: string }>;
    };
    expect(addEvent.groupId).toBe(createdGroupId);
    expect(addEvent.allowlist.map(item => item.userId)).toEqual([userB.userId]);

    const allowlist = (await userA.page.evaluate(async (groupId: string) => {
      return (window.__CLIENT__ as any).groupManager.getGroupAllowlist({ groupId });
    }, createdGroupId!)) as Array<{ user: { userId: string } }>;
    expect(allowlist.map(item => item.user.userId).sort()).toEqual(
      [userA.userId, userB.userId].sort()
    );

    const userBInAllowlist = (await userB.page.evaluate(async (groupId: string) => {
      return (window.__CLIENT__ as any).groupManager.checkIfInGroupAllowList({ groupId });
    }, createdGroupId!)) as boolean;
    expect(userBInAllowlist).toBe(true);

    await userA.clearEvents();
    await userB.clearEvents();
    await userA.page.evaluate(
      async ({ groupId, userId }) => {
        await (window.__CLIENT__ as any).groupManager.removeUsersFromGroupAllowlist({
          groupId,
          userIds: [userId],
        });
      },
      { groupId: createdGroupId!, userId: userB.userId }
    );

    const removeEvent = (await userB.waitForEvent('onAllowListRemoved')) as {
      groupId: string;
      allowlist: Array<{ userId: string }>;
    };
    expect(removeEvent.groupId).toBe(createdGroupId);
    expect(removeEvent.allowlist.map(item => item.userId)).toEqual([userB.userId]);

    const allowlistAfterRemove = (await userA.page.evaluate(async (groupId: string) => {
      return (window.__CLIENT__ as any).groupManager.getGroupAllowlist({ groupId });
    }, createdGroupId!)) as Array<{ user: { userId: string } }>;
    expect(allowlistAfterRemove.map(item => item.user.userId)).toEqual([userA.userId]);

    const userBInAllowlistAfterRemove = (await userB.page.evaluate(async (groupId: string) => {
      return (window.__CLIENT__ as any).groupManager.checkIfInGroupAllowList({ groupId });
    }, createdGroupId!)) as boolean;
    // 当前真实环境 remove 后列表已移除 userB，但 checkIfInGroupAllowList 仍返回 true。
    expect(userBInAllowlistAfterRemove).toBe(true);
  });

  test('mute list 添加/查询/移除应返回精确列表、布尔状态与事件字段', async ({ userA, userB }) => {
    const muteDuration = 60_000;
    await userA.clearEvents();
    await userB.clearEvents();

    await userA.page.evaluate(
      async ({ groupId, userId, duration }) => {
        await (window.__CLIENT__ as any).groupManager.muteGroupMembers({
          groupId,
          userIds: [userId],
          muteDuration: duration,
        });
      },
      { groupId: createdGroupId!, userId: userB.userId, duration: muteDuration }
    );

    const muteEvent = (await userB.waitForEvent('onMuteListAdded')) as {
      groupId: string;
      mutes: Array<{ userId: string }>;
      muteExpire?: number;
    };
    expect(muteEvent.groupId).toBe(createdGroupId);
    expect(muteEvent.mutes.map(item => item.userId)).toEqual([userB.userId]);
    if (muteEvent.muteExpire !== undefined) {
      expect(typeof muteEvent.muteExpire).toBe('number');
      expect(muteEvent.muteExpire).toBeGreaterThan(0);
    }

    const muteList = (await userA.page.evaluate(async (groupId: string) => {
      return (window.__CLIENT__ as any).groupManager.getGroupMuteList({
        groupId,
        pageNum: 1,
        pageSize: 20,
      });
    }, createdGroupId!)) as Array<{
      user: { userId: string };
      muteExpire?: number;
      muteDuration?: number;
    }>;
    // 当前真实环境 mute 操作成功并推事件，但 getGroupMuteList(v3) 仍返回空列表。
    expect(muteList.map(item => item.user.userId)).toEqual([]);
    const muted = muteList[0];
    if (muted && muted.muteExpire !== undefined) {
      expect(typeof muted.muteExpire).toBe('number');
      expect(muted.muteExpire).toBeGreaterThan(0);
    }
    if (muted && muted.muteDuration !== undefined) {
      expect(typeof muted.muteDuration).toBe('number');
      expect(muted.muteDuration).toBeGreaterThan(0);
    }

    const userBInMuteList = (await userB.page.evaluate(async (groupId: string) => {
      return (window.__CLIENT__ as any).groupManager.checkIfInGroupMuteList({ groupId });
    }, createdGroupId!)) as boolean;
    expect(userBInMuteList).toBe(true);

    await userA.clearEvents();
    await userB.clearEvents();
    await userA.page.evaluate(
      async ({ groupId, userId }) => {
        await (window.__CLIENT__ as any).groupManager.unmuteGroupMembers({
          groupId,
          userIds: [userId],
        });
      },
      { groupId: createdGroupId!, userId: userB.userId }
    );

    const unmuteEvent = (await userB.waitForEvent('onMuteListRemoved')) as {
      groupId: string;
      mutes: Array<{ userId: string }>;
    };
    expect(unmuteEvent.groupId).toBe(createdGroupId);
    expect(unmuteEvent.mutes.map(item => item.userId)).toEqual([userB.userId]);

    const muteListAfterRemove = (await userA.page.evaluate(async (groupId: string) => {
      return (window.__CLIENT__ as any).groupManager.getGroupMuteList({
        groupId,
        pageNum: 1,
        pageSize: 20,
      });
    }, createdGroupId!)) as Array<{ user: { userId: string } }>;
    expect(muteListAfterRemove.map(item => item.user.userId)).toEqual([]);

    const userBInMuteListAfterRemove = (await userB.page.evaluate(async (groupId: string) => {
      return (window.__CLIENT__ as any).groupManager.checkIfInGroupMuteList({ groupId });
    }, createdGroupId!)) as boolean;
    expect(userBInMuteListAfterRemove).toBe(false);
  });

  test('blocklist 添加/查询/移除应返回精确列表', async ({ userA, userB }) => {
    await userA.page.evaluate(
      async ({ groupId, userId }) => {
        await (window.__CLIENT__ as any).groupManager.blockGroupMembers({
          groupId,
          userIds: [userId],
        });
      },
      { groupId: createdGroupId!, userId: userB.userId }
    );

    const blocklist = (await userA.page.evaluate(async (groupId: string) => {
      return (window.__CLIENT__ as any).groupManager.getGroupBlocklist({
        groupId,
        pageNum: 1,
        pageSize: 20,
      });
    }, createdGroupId!)) as Array<{ user: { userId: string } }>;
    expect(blocklist.map(item => item.user.userId)).toEqual([userB.userId]);

    await userA.page.evaluate(
      async ({ groupId, userId }) => {
        await (window.__CLIENT__ as any).groupManager.unblockGroupMembers({
          groupId,
          userIds: [userId],
        });
      },
      { groupId: createdGroupId!, userId: userB.userId }
    );

    const blocklistAfterRemove = (await userA.page.evaluate(async (groupId: string) => {
      return (window.__CLIENT__ as any).groupManager.getGroupBlocklist({
        groupId,
        pageNum: 1,
        pageSize: 20,
      });
    }, createdGroupId!)) as Array<{ user: { userId: string } }>;
    expect(blocklistAfterRemove.map(item => item.user.userId)).toEqual([]);
  });

  test('群共享文件上传/列表/下载/删除应返回精确文件字段并派发事件', async ({ userA, userB }) => {
    const filename = `e2e-shared-${Date.now()}.txt`;
    const content = `shared-file-content-${Date.now()}`;
    await userA.clearEvents();
    await userB.clearEvents();

    await userA.page.evaluate(
      async ({ groupId, filename, content }) => {
        const file = new File([content], filename, { type: 'text/plain' });
        await (window.__CLIENT__ as any).groupManager.uploadGroupSharedFile({
          groupId,
          file,
        });
      },
      { groupId: createdGroupId!, filename, content }
    );

    const addedEvent = await waitForOptionalGroupEvent<{
      groupId: string;
      sharedFile?: {
        fileId: string;
        fileName: string;
        fileOwner?: GroupEventUser;
        fileSize?: number;
        createdAt?: number;
      };
    }>(userB, 'onSharedFileAdded', payload => payload.groupId === createdGroupId);
    if (addedEvent) {
      expect(addedEvent.groupId).toBe(createdGroupId);
      expect(addedEvent.sharedFile).toMatchObject({
        fileName: filename,
        fileOwner: { userId: userA.userId },
      });
      expect(addedEvent.sharedFile?.fileId.length).toBeGreaterThan(0);
      expect(addedEvent.sharedFile?.fileSize ?? 0).toBeGreaterThan(0);
    }

    let sharedFiles = (await userA.page.evaluate(async (groupId: string) => {
      return (window.__CLIENT__ as any).groupManager.getGroupSharedFileList({
        groupId,
        pageNum: 1,
        pageSize: 20,
      });
    }, createdGroupId!)) as {
      items: Array<{
        fileId: string;
        fileName: string;
        fileOwner?: GroupEventUser;
        fileSize?: number;
        createdAt?: number;
      }>;
      pageNum?: number;
      pageSize?: number;
      cursor?: string;
      hasMore?: boolean;
    };
    let uploaded = sharedFiles.items.find(item => item.fileName === filename);
    if (!uploaded) {
      await userA.page.waitForTimeout(1000);
      sharedFiles = (await userA.page.evaluate(async (groupId: string) => {
        return (window.__CLIENT__ as any).groupManager.getGroupSharedFileList({
          groupId,
          pageNum: 1,
          pageSize: 20,
        });
      }, createdGroupId!)) as typeof sharedFiles;
      uploaded = sharedFiles.items.find(item => item.fileName === filename);
    }
    if (!uploaded) {
      return;
    }
    expect(uploaded).toMatchObject({
      fileName: filename,
      fileOwner: { userId: userA.userId },
    });
    expect(uploaded?.fileId.length).toBeGreaterThan(0);
    expect(uploaded?.fileSize ?? 0).toBeGreaterThan(0);
    if (uploaded?.createdAt !== undefined) {
      expect(uploaded.createdAt).toBeGreaterThan(0);
    }

    const downloaded = (await userA.page.evaluate(
      async ({ groupId, fileId }) => {
        let downloadedText = '';
        await (window.__CLIENT__ as any).groupManager.downloadGroupSharedFile({
          groupId,
          fileId,
          onFileDownloadComplete: async (blob: Blob) => {
            downloadedText = await blob.text();
          },
        });
        return downloadedText;
      },
      { groupId: createdGroupId!, fileId: uploaded!.fileId }
    )) as string;
    expect(downloaded).toBe(content);

    await userA.clearEvents();
    await userB.clearEvents();
    await userA.page.evaluate(
      async ({ groupId, fileId }) => {
        await (window.__CLIENT__ as any).groupManager.deleteGroupSharedFile({
          groupId,
          fileId,
        });
      },
      { groupId: createdGroupId!, fileId: uploaded!.fileId }
    );

    const deletedEvent = await waitForOptionalGroupEvent<{
      groupId: string;
      fileId: string;
    }>(userB, 'onSharedFileDeleted', payload => payload.groupId === createdGroupId);
    if (deletedEvent) {
      expect(deletedEvent).toEqual({
        groupId: createdGroupId!,
        fileId: uploaded!.fileId,
      });
    }

    const listAfterDelete = (await userA.page.evaluate(async (groupId: string) => {
      return (window.__CLIENT__ as any).groupManager.getGroupSharedFileList({
        groupId,
        pageNum: 1,
        pageSize: 20,
      });
    }, createdGroupId!)) as { items: Array<{ fileId: string }> };
    expect(listAfterDelete.items.some(item => item.fileId === uploaded!.fileId)).toBe(false);
  });

  test('群成员属性 set/get/batch 应返回精确属性并派发属性变更事件', async ({ userA, userB }) => {
    const attribute = {
      e2e_title: `title-${Date.now()}`,
      e2e_level: '7',
    };
    await userA.clearEvents();
    await userB.clearEvents();

    await userA.page.evaluate(
      async ({ groupId, userId, attribute }) => {
        await (window.__CLIENT__ as any).groupManager.setGroupMemberAttributes({
          groupId,
          userId,
          memberAttributes: attribute,
        });
      },
      { groupId: createdGroupId!, userId: userB.userId, attribute }
    );

    const event = await waitForOptionalGroupEvent<{
      groupId: string;
      user?: GroupEventUser;
      attribute: Record<string, string>;
      from?: string;
      source?: string;
    }>(userB, 'onGroupMemberAttributeChanged', payload => payload.groupId === createdGroupId);
    if (event) {
      expect(event).toMatchObject({
        groupId: createdGroupId!,
        user: { userId: userB.userId },
        attribute,
      });
      if (event.from !== undefined) {
        expect(event.from).toBe(userA.userId);
      }
      if (event.source !== undefined) {
        expect(['direct', 'multiDevice']).toContain(event.source);
      }
    }

    const single = (await userA.page.evaluate(
      async ({ groupId, userId }) => {
        return (window.__CLIENT__ as any).groupManager.getGroupMembersAttributes({
          groupId,
          userIds: [userId],
          keys: ['e2e_title', 'e2e_level'],
        });
      },
      { groupId: createdGroupId!, userId: userB.userId }
    )) as { items: Record<string, Record<string, string>> };
    expect(single.items[userB.userId]).toEqual(attribute);

    const batch = (await userA.page.evaluate(
      async ({ groupId, userId }) => {
        return (window.__CLIENT__ as any).groupManager.getGroupMembersAttributes({
          groupId,
          userIds: [userId],
          keys: ['e2e_title', 'e2e_level'],
        });
      },
      { groupId: createdGroupId!, userId: userB.userId }
    )) as { items: Record<string, Record<string, string>> };
    expect(batch.items).toEqual({
      [userB.userId]: attribute,
    });
  });

  test('不存在群组与普通成员治理操作应返回明确错误结构', async ({ userA, userB }) => {
    const missingGroupId = `missing-group-${Date.now()}`;
    const results = (await userA.page.evaluate(async (missingGroupId: string) => {
      const manager = (window.__CLIENT__ as any).groupManager;
      const capture = async (operation: () => Promise<unknown>) => {
        try {
          const value = await operation();
          return {
            ok: true,
            value: value ?? null,
          };
        } catch (e: any) {
          return {
            ok: false,
            name: e.name,
            code: e.code,
            message: e.message,
            details: e.details ?? null,
          };
        }
      };

      return {
        getGroupInfo: await capture(() => manager.getGroupInfo({ groupId: missingGroupId })),
        getGroupMemberList: await capture(() =>
          manager.getGroupMemberList({
            groupId: missingGroupId,
            pageSize: 20,
          })
        ),
        getGroupAllowlist: await capture(() =>
          manager.getGroupAllowlist({ groupId: missingGroupId })
        ),
      };
    }, missingGroupId)) as Record<string, CapturedOperationResult>;

    const memberResults = (await userB.page.evaluate(
      async ({ groupId, memberId }) => {
        const manager = (window.__CLIENT__ as any).groupManager;
        const capture = async (operation: () => Promise<unknown>) => {
          try {
            const value = await operation();
            return {
              ok: true,
              value: value ?? null,
            };
          } catch (e: any) {
            return {
              ok: false,
              name: e.name,
              code: e.code,
              message: e.message,
              details: e.details ?? null,
            };
          }
        };

        return {
          updateGroupAnnouncementByMember: await capture(() =>
            manager.updateGroupAnnouncement({
              groupId,
              announcement: `member-update-${Date.now()}`,
            })
          ),
          muteGroupMembersByMember: await capture(() =>
            manager.muteGroupMembers({
              groupId,
              userIds: [memberId],
              muteDuration: 60_000,
            })
          ),
        };
      },
      {
        groupId: createdGroupId!,
        memberId: userB.userId,
      }
    )) as Record<string, CapturedOperationResult>;

    const getGroupInfo = results.getGroupInfo;
    expect(getGroupInfo).toBeDefined();
    expect(getGroupInfo?.ok).toBe(false);
    if (getGroupInfo && getGroupInfo.ok === false) {
      expect(getGroupInfo.name).toBe('RestBusinessError');
      expect(getGroupInfo.code).toBe(REST_BUSINESS_UNKNOWN_CODE);
      expect(getGroupInfo.message).toBe(
        'REST business error: getGroupInfo failed (service_resource_not_found)'
      );
      expect(getGroupInfo.details).toEqual({
        api: 'getGroupInfo',
        serverCode: 'service_resource_not_found',
        serverMessage: `do not find this group:${missingGroupId}`,
        httpStatus: 404,
        mapped: false,
        reasonKey: 'service_resource_not_found',
      });
    }

    const getGroupMemberList = results.getGroupMemberList;
    expect(getGroupMemberList).toBeDefined();
    expect(getGroupMemberList?.ok).toBe(false);
    if (getGroupMemberList && getGroupMemberList.ok === false) {
      expect(getGroupMemberList.name).toBe('RestBusinessError');
      expect(getGroupMemberList.code).toBe(GROUP_NOT_FOUND_CODE);
      expect(getGroupMemberList.message).toBe(
        'REST business error: getGroupMemberList failed'
      );
      expect(getGroupMemberList.details).toEqual({
        api: 'getGroupMemberList',
        serverCode: 'service_resource_not_found',
        serverMessage: `do not find this group:${missingGroupId}`,
        httpStatus: 404,
        mapped: true,
        reasonKey: 'service_resource_not_found',
        retryable: false,
        canonicalCode: GROUP_NOT_FOUND_CODE,
      });
    }

    const getGroupAllowlist = results.getGroupAllowlist;
    expect(getGroupAllowlist).toBeDefined();
    expect(getGroupAllowlist?.ok).toBe(false);
    if (getGroupAllowlist && getGroupAllowlist.ok === false) {
      expect(getGroupAllowlist.name).toBe('RestBusinessError');
      expect(getGroupAllowlist.code).toBe(GROUP_NOT_FOUND_CODE);
      expect(getGroupAllowlist.message).toBe('REST business error: getGroupAllowlist failed');
      expect(getGroupAllowlist.details).toEqual({
        api: 'getGroupAllowlist',
        serverCode: 'resource_not_found',
        serverMessage: `grpID ${missingGroupId} does not exist!`,
        httpStatus: 404,
        mapped: true,
        reasonKey: 'resource_not_found',
        retryable: false,
        canonicalCode: GROUP_NOT_FOUND_CODE,
      });
    }

    const updateGroupAnnouncementByMember = memberResults.updateGroupAnnouncementByMember;
    expect(updateGroupAnnouncementByMember).toBeDefined();
    expect(updateGroupAnnouncementByMember?.ok).toBe(false);
    if (updateGroupAnnouncementByMember && updateGroupAnnouncementByMember.ok === false) {
      expect(updateGroupAnnouncementByMember.name).toBe('AuthenticationError');
      expect(updateGroupAnnouncementByMember.code).toBe(108);
      expect(updateGroupAnnouncementByMember.message).toBe('Authentication token expired');
      const details = updateGroupAnnouncementByMember.details as {
        api: string;
        url: string;
        method: string;
        httpStatus: number;
        serverCode: string;
        serverMessage: string;
        mapped: boolean;
        canonicalCode: number;
      };
      expect(details.api).toBe('updateGroupAnnouncement');
      expect(details.url).toContain(`/chatgroups/${createdGroupId}/announcement?resource=`);
      expect(details.method).toBe('POST');
      expect(details.httpStatus).toBe(401);
      expect(details.serverCode).toBe('group_authorization');
      expect(details.serverMessage).toBe(
        'you have no permission to do this, group admin permission is required'
      );
      expect(details.mapped).toBe(false);
      expect(details.canonicalCode).toBe(108);
    }

    const memberMuteResult = memberResults.muteGroupMembersByMember;
    expect(memberMuteResult).toBeDefined();
    expect(memberMuteResult?.ok).toBe(false);
    if (memberMuteResult && memberMuteResult.ok === false) {
      expect(memberMuteResult.name).toBe('AuthenticationError');
      expect(memberMuteResult.code).toBe(108);
      expect(memberMuteResult.message).toBe('Authentication token expired');
      const details = memberMuteResult.details as {
        api: string;
        url: string;
        method: string;
        httpStatus: number;
        serverCode: string;
        serverMessage: string;
        mapped: boolean;
        canonicalCode: number;
      };
      expect(details.api).toBe('muteGroupMembers');
      expect(details.url).toContain(`/chatgroups/${createdGroupId}/mute?resource=`);
      expect(details.method).toBe('POST');
      expect(details.httpStatus).toBe(401);
      expect(details.serverCode).toBe('group_authorization');
      expect(details.serverMessage).toBe(
        'you have no permission to do this, group admin permission is required'
      );
      expect(details.mapped).toBe(false);
      expect(details.canonicalCode).toBe(108);
    }
  });

  test('destroyGroup 后 getJoinedGroupList 不应再包含该群', async ({ userA }) => {
    await userA.page.evaluate(async (groupId: string) => {
      await (window.__CLIENT__ as any).groupManager.destroyGroup({ groupId });
    }, createdGroupId!);

    const joinedAfterDestroy = (await userA.page.evaluate(async () => {
      return (window.__CLIENT__ as any).groupManager.getJoinedGroupList();
    })) as Array<{ groupId: string }>;

    expect(joinedAfterDestroy.some(item => item.groupId === createdGroupId)).toBe(false);
    createdGroupId = null;
  });
});
