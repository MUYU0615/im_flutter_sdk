/**
 * E2E 测试 - 用户信息
 * 迁移自 robot: wayang/TestCase/用户.robot（Webim 标记用例）
 */
import { test, expect } from '../fixtures/sdk-api';

const VALIDATION_ERROR_CODE = 110;
const SERVICE_LIMIT_EXCEEDED = 4;

test.describe('user-info - 用户信息', () => {
  test.beforeEach(async ({ userA, userB, thirdUser }) => {
    await userA.clearEvents();
    await userB.clearEvents();
    await thirdUser?.clearEvents();

    const targetIds = [userB.userId];
    if (thirdUser) {
      targetIds.push(thirdUser.userId);
    }

    await userA.page.evaluate(async (userIds: string[]) => {
      try {
        await (window.__CLIENT__ as any).userInfoManager.unsubscribeUsersInfo({ userIds });
      } catch {}
    }, targetIds);
  });

  test('updateOwnInfo、getUserInfoByUserId、getUserInfoByAttribute 应返回完整标准化数据', async ({
    userA,
    userB,
  }) => {
    const suffix = Date.now();
    const payload = {
      nickname: `nickname-${suffix}`,
      avatarUrl: `https://example.com/avatar-${suffix}.png`,
      mail: `robot-${suffix}@example.com`,
      phone: `1380013${String(suffix).slice(-4)}`,
      gender: 2,
      sign: `sign-${suffix}`,
      birth: '2024-05-21',
      ext: `ext-${suffix}`,
    };

    await userB.clearEvents();

    const updated = await userB.page.evaluate(async (params) => {
      return (window.__CLIENT__ as any).userInfoManager.updateOwnInfo(params);
    }, payload) as {
      userId: string;
      nickname?: string;
      avatarUrl?: string;
      mail?: string;
      phone?: string;
      gender?: number;
      sign?: string;
      birth?: string;
      ext?: string;
    };
    expect(updated).toEqual({
      userId: userB.userId,
      ...payload,
      gender: String(payload.gender),
    });

    await userB.page.waitForTimeout(1000);
    const ownUpdatedEvents = await userB.getBufferedEvents<{
      userId: string;
      nickname?: string;
      avatarUrl?: string;
      mail?: string;
      phone?: string;
      gender?: string | number;
      sign?: string;
      birth?: string;
      ext?: string;
    }>('onOwnInfoUpdated');
    expect(
      ownUpdatedEvents.some(event =>
        event.userId === userB.userId &&
        event.nickname === payload.nickname &&
        event.avatarUrl === payload.avatarUrl &&
        event.mail === payload.mail &&
        event.phone === payload.phone &&
        String(event.gender) === String(payload.gender) &&
        event.sign === payload.sign &&
        event.birth === payload.birth &&
        event.ext === payload.ext
      )
    ).toBe(true);

    const fetchedByUserId = await userA.page.evaluate(async (userId: string) => {
      return (window.__CLIENT__ as any).userInfoManager.getUserInfoByUserId({ userIds: [userId] });
    }, userB.userId) as Array<{
      userId: string;
      nickname?: string;
      avatarUrl?: string;
      mail?: string;
      phone?: string;
      gender?: number;
      sign?: string;
      birth?: string;
      ext?: string;
    }>;
    expect(fetchedByUserId).toEqual([
      {
        userId: userB.userId,
        ...payload,
        gender: String(payload.gender),
      },
    ]);

    const fetchedByAttribute = await userA.page.evaluate(async (userId: string) => {
      return (window.__CLIENT__ as any).userInfoManager.getUserInfoByAttribute({
        userIds: [userId],
        attributes: ['nickname', 'ext', 'mail'],
      });
    }, userB.userId) as Array<{
      userId: string;
      nickname?: string;
      avatarUrl?: string;
      mail?: string;
      phone?: string;
      gender?: number;
      sign?: string;
      birth?: string;
      ext?: string;
    }>;
    expect(fetchedByAttribute).toEqual([
      {
        userId: userB.userId,
        nickname: payload.nickname,
        mail: payload.mail,
        ext: payload.ext,
      },
    ]);
  });

  test('updateOwnInfoByAttribute、subscribeUsersInfo、getSubscribedUsers、unsubscribeUsersInfo 应协同工作', async ({
    userA,
    userB,
    thirdUser,
  }) => {
    const targetUser = thirdUser ?? userB;
    const initialNickname = `sub-initial-${Date.now()}`;
    const changedNickname = `sub-changed-${Date.now()}`;
    const afterUnsubscribeNickname = `sub-after-unsub-${Date.now()}`;

    await targetUser.page.evaluate(async (nickname: string) => {
      await (window.__CLIENT__ as any).userInfoManager.updateOwnInfoByAttribute('nickname', nickname);
    }, initialNickname);
    await targetUser.waitForEvent('onOwnInfoUpdated');

    const subscribeResult = await userA.page.evaluate(async (userIds: string[]) => {
      try {
        await (window.__CLIENT__ as any).userInfoManager.subscribeUsersInfo({ userIds });
        return { ok: true as const };
      } catch (e: any) {
        return {
          ok: false as const,
          error: {
            name: e.name,
            code: e.code,
            message: e.message,
            details: e.details ?? null,
          },
        };
      }
    }, [targetUser.userId]);

    if (!subscribeResult.ok) {
      expect(subscribeResult.error.name).toBe('RestBusinessError');
      expect(subscribeResult.error.code).toBe(210);
      return;
    }

    const subscribedUsers = await userA.page.evaluate(async () => {
      return (window.__CLIENT__ as any).userInfoManager.getSubscribedUsers();
    }) as Array<{
      userId: string;
      nickname?: string;
    }>;
    expect(subscribedUsers).toContainEqual({
      userId: targetUser.userId,
      nickname: initialNickname,
    });

    await userA.clearEvents();
    await targetUser.page.evaluate(async (nickname: string) => {
      await (window.__CLIENT__ as any).userInfoManager.updateOwnInfoByAttribute('nickname', nickname);
    }, changedNickname);

    const updatedUsers = await userA.waitForEvent('onUserInfoUpdated') as Array<{
      userId: string;
      nickname?: string;
    }>;
    expect(updatedUsers).toContainEqual({
      userId: targetUser.userId,
      nickname: changedNickname,
    });

    await userA.page.evaluate(async (userIds: string[]) => {
      await (window.__CLIENT__ as any).userInfoManager.unsubscribeUsersInfo({ userIds });
    }, [targetUser.userId]);
    await userA.clearEvents();

    await targetUser.page.evaluate(async (nickname: string) => {
      await (window.__CLIENT__ as any).userInfoManager.updateOwnInfoByAttribute('nickname', nickname);
    }, afterUnsubscribeNickname);
    await userA.waitForNoEvent('onUserInfoUpdated', 5000);
  });

  test('getUserInfoByUserId 的空 userIds 应返回字段级 validation details', async ({ userA }) => {
    const error = await userA.page.evaluate(async () => {
      try {
        await (window.__CLIENT__ as any).userInfoManager.getUserInfoByUserId({ userIds: [] });
        return null;
      } catch (e: any) {
        return {
          name: e.name,
          code: e.code,
          message: e.message,
          details: e.details ?? null,
        };
      }
    }) as {
      name: string;
      code: number;
      message: string;
      details: { fields?: Array<{ path: string; message: string; rule: string }> } | null;
    } | null;

    expect(error).not.toBeNull();
    expect(error).toMatchObject({
      name: 'ValidationError',
      code: VALIDATION_ERROR_CODE,
      message: 'params.userIds is required',
    });
    expect(error?.details?.fields).toEqual([
      {
        path: 'params.userIds',
        message: 'params.userIds is required',
        rule: 'required',
      },
    ]);
  });

  test('subscribeUsersInfo 超过 100 个目标时应返回明确错误码', async ({ userA }) => {
    const overLimitUserIds = Array.from({ length: 101 }, (_, index) => `user-info-sub-${index}`);

    const error = await userA.page.evaluate(async (userIds: string[]) => {
      try {
        await (window.__CLIENT__ as any).userInfoManager.subscribeUsersInfo({ userIds });
        return null;
      } catch (e: any) {
        return {
          name: e.name,
          code: e.code,
          message: e.message,
          details: e.details ?? null,
        };
      }
    }, overLimitUserIds) as {
      name: string;
      code: number;
      message: string;
      details: { fields?: Array<{ path: string; message: string; rule: string }> } | null;
    } | null;

    expect(error).not.toBeNull();
    expect(error).toMatchObject({
      name: 'ValidationError',
      code: SERVICE_LIMIT_EXCEEDED,
      message: 'params.userIds must contain at most 100 unique users',
    });
    expect(error?.details?.fields).toEqual([
      {
        path: 'params.userIds',
        message: 'params.userIds must contain at most 100 unique users',
        rule: 'range',
      },
    ]);
  });
});
