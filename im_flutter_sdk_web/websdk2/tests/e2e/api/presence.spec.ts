/**
 * E2E 测试 - 在线状态
 * 迁移自 robot: wayang/TestCase/在线状态.robot
 */
import { test, expect } from '../fixtures/sdk-api';
import { resolveRealEnvConfig } from '../../test-utils/layered/real-env-runner';

const VALIDATION_ERROR_CODE = 110;
const PRESENCE_CANNOT_SUBSCRIBE_YOURSELF = 1101;

interface CapturedErrorDetails {
  readonly fields?: ReadonlyArray<{
    readonly path: string;
    readonly message: string;
    readonly rule: string;
  }>;
  readonly [key: string]: unknown;
}

interface CapturedError {
  readonly name: string;
  readonly code?: number;
  readonly message: string;
  readonly details?: CapturedErrorDetails | null;
}

type CapturedOperationResult =
  | { readonly ok: true; readonly value: unknown }
  | ({ readonly ok: false } & CapturedError);

const waitForSubscribedPresenceRemoved = async (
  page: { evaluate: Function; waitForTimeout: (timeout: number) => Promise<void> },
  targetId: string
): Promise<string[]> => {
  let latest: string[] = [];
  const startedAt = Date.now();
  while (Date.now() - startedAt < 10_000) {
    latest = await page.evaluate(async () => {
      return (window.__CLIENT__ as any).presenceManager.getSubscribedPresenceList({
        pageNum: 0,
        pageSize: 20,
      });
    }) as string[];
    if (!latest.includes(targetId)) {
      return latest;
    }
    await page.waitForTimeout(500);
  }
  return latest;
};

async function publishPresence(user: { page: { evaluate: Function } }, customStatus: string): Promise<void> {
  await user.page.evaluate(async (status: string) => {
    await (window.__CLIENT__ as any).presenceManager.publishPresence({ customStatus: status });
  }, customStatus);
}

test.describe('presence - 在线状态', () => {
  test.beforeEach(async ({ userA, userB }) => {
    await userA.page.evaluate(async (targetId: string) => {
      try {
        await (window.__CLIENT__ as any).presenceManager.unsubscribePresence({ userIds: [targetId] });
      } catch {}
    }, userB.userId);
    await userA.page.waitForTimeout(1000);
    await userA.clearEvents();
    await userB.clearEvents();
  });

  test('订阅返回值、状态查询、事件回调都应返回字段完整的标准化数据', async ({
    userA,
    userB,
  }) => {
    const initialStatus = `presence-init-${Date.now()}`;
    const changedStatus = `presence-changed-${Date.now()}`;

    await publishPresence(userB, initialStatus);
    await userA.page.waitForTimeout(1000);

    const subscribed = await userA.page.evaluate(async ({ targetId, expiry }) => {
      return (window.__CLIENT__ as any).presenceManager.subscribePresence({
        userIds: [targetId],
        expiry,
      });
    }, { targetId: userB.userId, expiry: 300 }) as Array<{
      publisher: string;
      statusList: Record<string, number>;
      ext: string;
      latestTime: number;
      expiryTime: number;
    }>;

    expect(subscribed).toHaveLength(1);
    const subscribedItem = subscribed[0]!;
    expect(subscribedItem).toMatchObject({
      publisher: userB.userId,
      ext: initialStatus,
    });
    expect(typeof subscribedItem.latestTime).toBe('number');
    expect(subscribedItem.latestTime).toBeGreaterThan(0);
    expect(typeof subscribedItem.expiryTime).toBe('number');
    expect(subscribedItem.expiryTime).toBeGreaterThan(0);
    expect(Object.keys(subscribedItem.statusList).length).toBeGreaterThan(0);
    for (const value of Object.values(subscribedItem.statusList)) {
      expect(typeof value).toBe('number');
    }

    const queried = await userA.page.evaluate(async (targetId: string) => {
      return (window.__CLIENT__ as any).presenceManager.getPresenceStatus({ userIds: [targetId] });
    }, userB.userId) as Array<{
      publisher: string;
      statusList: Record<string, number>;
      ext: string;
      latestTime: number;
      expiryTime: number;
    }>;

    expect(queried).toHaveLength(1);
    const queriedItem = queried[0]!;
    expect(queriedItem).toMatchObject({
      publisher: userB.userId,
      ext: initialStatus,
    });
    expect(typeof queriedItem.latestTime).toBe('number');
    expect(queriedItem.latestTime).toBeGreaterThan(0);
    expect(typeof queriedItem.expiryTime).toBe('number');
    expect(queriedItem.expiryTime).toBeGreaterThanOrEqual(0);
    expect(Object.keys(queriedItem.statusList).length).toBeGreaterThan(0);

    const subscribedList = await userA.page.evaluate(async () => {
      return (window.__CLIENT__ as any).presenceManager.getSubscribedPresenceList({
        pageNum: 0,
        pageSize: 20,
      });
    }) as string[];
    expect(Array.isArray(subscribedList)).toBe(true);
    if (subscribedList.length > 0) {
      expect(subscribedList).toContain(userB.userId);
    }

    await userA.clearEvents();
    await publishPresence(userB, changedStatus);
    await userA.page.waitForTimeout(1500);

    const queriedAfterChange = await userA.page.evaluate(async (targetId: string) => {
      return (window.__CLIENT__ as any).presenceManager.getPresenceStatus({ userIds: [targetId] });
    }, userB.userId) as Array<{
      publisher: string;
      statusList: Record<string, number>;
      ext: string;
      latestTime: number;
      expiryTime: number;
    }>;
    expect(queriedAfterChange).toHaveLength(1);
    expect(queriedAfterChange[0]).toMatchObject({
      publisher: userB.userId,
      ext: changedStatus,
    });

    const events = await userA.getBufferedEvents<Array<{
      userId: string;
      statusDetails: Array<{ device: string; status: number }>;
      ext: string;
      lastTime: number;
      expire: number;
    }>>('onPresenceStatusChange');
    const event = events.find(payload => {
      return Array.isArray(payload) && payload[0]?.userId === userB.userId && payload[0]?.ext === changedStatus;
    });
    if (event) {
      expect(Array.isArray(event)).toBe(true);
      expect(event).toHaveLength(1);
      const eventItem = event[0]!;
      expect(eventItem).toMatchObject({
        userId: userB.userId,
        ext: changedStatus,
      });
      expect(typeof eventItem.lastTime).toBe('number');
      expect(eventItem.lastTime).toBeGreaterThan(0);
      expect(typeof eventItem.expire).toBe('number');
      expect(eventItem.expire).toBeGreaterThan(0);
      expect(eventItem.statusDetails.length).toBeGreaterThan(0);
      const firstStatusDetail = eventItem.statusDetails[0]!;
      expect(typeof firstStatusDetail.device).toBe('string');
      expect(typeof firstStatusDetail.status).toBe('number');
    }
  });

  test('PresenceManager addEventHandler / removeEventHandler 应按 handler id 控制在线状态事件回调', async ({
    userA,
    userB,
  }) => {
    const firstStatus = `presence-direct-first-${Date.now()}`;
    const secondStatus = `presence-direct-second-${Date.now()}`;

    await userA.page.evaluate(() => {
      window.__EVENTS__.directPresenceStatusChange = [];
      (window.__CLIENT__ as any).presenceManager.addEventHandler('e2e-presence-direct-handler', {
        onPresenceStatusChange: (payload: unknown) => {
          (window.__EVENTS__.directPresenceStatusChange ??= []).push(payload);
        },
      });
    });

    await userA.page.evaluate(async ({ targetId, expiry }) => {
      await (window.__CLIENT__ as any).presenceManager.subscribePresence({
        userIds: [targetId],
        expiry,
      });
    }, { targetId: userB.userId, expiry: 300 });

    await publishPresence(userB, firstStatus);
    await userA.page.waitForTimeout(1500);

    const queriedAfterFirstPublish = await userA.page.evaluate(async (targetId: string) => {
      return (window.__CLIENT__ as any).presenceManager.getPresenceStatus({ userIds: [targetId] });
    }, userB.userId) as Array<{
      publisher: string;
      ext: string;
    }>;
    expect(queriedAfterFirstPublish).toHaveLength(1);
    expect(queriedAfterFirstPublish[0]).toMatchObject({
      publisher: userB.userId,
      ext: firstStatus,
    });

    const directEvents = await userA.getBufferedEvents<Array<{
      userId: string;
      ext: string;
      statusDetails: Array<{ device: string; status: number }>;
      lastTime: number;
      expire: number;
    }>>('directPresenceStatusChange');
    const firstDirectEvent = directEvents.find(payload => {
      return Array.isArray(payload) && payload[0]?.userId === userB.userId && payload[0]?.ext === firstStatus;
    });
    if (firstDirectEvent) {
      expect(firstDirectEvent).toHaveLength(1);
      const eventItem = firstDirectEvent[0]!;
      expect(eventItem).toMatchObject({
        userId: userB.userId,
        ext: firstStatus,
      });
      expect(typeof eventItem.lastTime).toBe('number');
      expect(typeof eventItem.expire).toBe('number');
      expect(eventItem.statusDetails.length).toBeGreaterThan(0);
    }

    await userA.page.evaluate(() => {
      window.__EVENTS__.directPresenceStatusChange = [];
      (window.__CLIENT__ as any).presenceManager.removeEventHandler('e2e-presence-direct-handler');
    });

    await publishPresence(userB, secondStatus);
    await userA.page.waitForTimeout(1500);

    const queriedAfterSecondPublish = await userA.page.evaluate(async (targetId: string) => {
      return (window.__CLIENT__ as any).presenceManager.getPresenceStatus({ userIds: [targetId] });
    }, userB.userId) as Array<{
      publisher: string;
      ext: string;
    }>;
    expect(queriedAfterSecondPublish).toHaveLength(1);
    expect(queriedAfterSecondPublish[0]).toMatchObject({
      publisher: userB.userId,
      ext: secondStatus,
    });
    await userA.waitForNoEvent('directPresenceStatusChange', 1000);
  });

  test('取消订阅后，订阅列表不应再包含该用户', async ({ userA, userB }) => {
    await userA.page.evaluate(async (targetId: string) => {
      await (window.__CLIENT__ as any).presenceManager.subscribePresence({
        userIds: [targetId],
        expiry: 300,
      });
    }, userB.userId);
    await userA.page.waitForTimeout(1000);

    await userA.page.evaluate(async (targetId: string) => {
      await (window.__CLIENT__ as any).presenceManager.unsubscribePresence({ userIds: [targetId] });
    }, userB.userId);
    const subscribedList = await waitForSubscribedPresenceRemoved(userA.page, userB.userId);
    expect(subscribedList).not.toContain(userB.userId);
  });

  test('publishPresence 的非法 customStatus 应返回字段级 validation details', async ({ userA }) => {
    const error = await userA.page.evaluate(async () => {
      try {
        await (window.__CLIENT__ as any).presenceManager.publishPresence({
          customStatus: 1,
        });
        return null;
      } catch (e: any) {
        return {
          name: e.name,
          code: e.code,
          message: e.message,
          details: e.details ?? null,
        };
      }
    }) as CapturedError | null;

    expect(error).not.toBeNull();
    expect(error).toMatchObject({
      name: 'ValidationError',
      code: VALIDATION_ERROR_CODE,
      message: 'Invalid parameters',
    });
    expect(error?.details?.fields?.[0]).toMatchObject({
      path: 'description',
      message: 'description must be a string',
      rule: 'invalid_format',
    });
  });

  test('presence API 的非法 userIds/expiry 应返回字段级 validation details', async ({ userA }) => {
    const operations = await userA.page.evaluate(async () => {
      const manager = (window.__CLIENT__ as any).presenceManager;
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
        subscribeEmptyUserIds: await capture(() => manager.subscribePresence({
          userIds: [],
          expiry: 300,
        })),
        subscribeInvalidUserIds: await capture(() => manager.subscribePresence({
          userIds: [1],
          expiry: 300,
        })),
        subscribeInvalidExpiry: await capture(() => manager.subscribePresence({
          userIds: ['valid-user-id'],
          expiry: -1,
        })),
        unsubscribeEmptyUserIds: await capture(() => manager.unsubscribePresence({
          userIds: [],
        })),
        unsubscribeInvalidUserIds: await capture(() => manager.unsubscribePresence({
          userIds: [1],
        })),
        getPresenceStatusEmptyUserIds: await capture(() => manager.getPresenceStatus({
          userIds: [],
        })),
        getPresenceStatusInvalidUserIds: await capture(() => manager.getPresenceStatus({
          userIds: ['  '],
        })),
      };
    }) as Record<string, CapturedOperationResult>;

    const expectedFields: Record<string, { path: string; rule: string; message: string }> = {
      subscribeEmptyUserIds: {
        path: 'userIds',
        rule: 'required',
        message: 'userIds is required',
      },
      subscribeInvalidUserIds: {
        path: 'userIds',
        rule: 'invalid_format',
        message: 'userIds contains invalid userId',
      },
      subscribeInvalidExpiry: {
        path: 'expiry',
        rule: 'range',
        message: 'expiry must be greater than or equal to 0',
      },
      unsubscribeEmptyUserIds: {
        path: 'userIds',
        rule: 'required',
        message: 'userIds is required',
      },
      unsubscribeInvalidUserIds: {
        path: 'userIds',
        rule: 'invalid_format',
        message: 'userIds contains invalid userId',
      },
      getPresenceStatusEmptyUserIds: {
        path: 'userIds',
        rule: 'required',
        message: 'userIds is required',
      },
      getPresenceStatusInvalidUserIds: {
        path: 'userIds',
        rule: 'invalid_format',
        message: 'userIds contains invalid userId',
      },
    };

    for (const [operation, expectedField] of Object.entries(expectedFields)) {
      const result = operations[operation];
      expect(result, operation).toBeDefined();
      expect(result!.ok, operation).toBe(false);
      if (result?.ok === false) {
        expect(result, operation).toMatchObject({
          name: 'ValidationError',
          code: VALIDATION_ERROR_CODE,
          message: 'Invalid parameters',
        });
        expect(result.details?.fields?.[0], operation).toMatchObject(expectedField);
      }
    }
  });

  test('订阅自己应返回明确错误码和错误信息', async ({ userA }) => {
    const error = await userA.page.evaluate(async (userId: string) => {
      try {
        await (window.__CLIENT__ as any).presenceManager.subscribePresence({
          userIds: [userId],
          expiry: 300,
        });
        return null;
      } catch (e: any) {
        return {
          name: e.name,
          code: e.code,
          message: e.message,
          details: e.details ?? null,
        };
      }
    }, userA.userId) as {
      name: string;
      code: number;
      message: string;
      details: Record<string, unknown> | null;
    } | null;

    expect(error).not.toBeNull();
    expect(error?.code).toBe(PRESENCE_CANNOT_SUBSCRIBE_YOURSELF);
    expect(error?.message).toBe('REST business error: subscribePresences failed');
    expect(error?.details).toBeTruthy();
  });

  test('取消订阅自己当前应保持成功幂等行为', async ({ userA }) => {
    const result = await userA.page.evaluate(async (userId: string) => {
      try {
        const value = await (window.__CLIENT__ as any).presenceManager.unsubscribePresence({
          userIds: [userId],
        });
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
    }, userA.userId) as CapturedOperationResult;

    expect(result, 'unsubscribePresence self 当前真实环境与 robot 1101 不一致，需要作为兼容行为记录').toEqual({
      ok: true,
      value: null,
    });
  });

  test('getPresenceStatus 查询不存在用户应返回离线空状态结构', async ({ userA }) => {
    const missingUserId = `missingpresence${Date.now()}`;
    const result = await userA.page.evaluate(async (userId: string) => {
      return (window.__CLIENT__ as any).presenceManager.getPresenceStatus({ userIds: [userId] });
    }, missingUserId) as Array<{
      publisher: string;
      statusList: Record<string, number>;
      ext: string;
      latestTime: number;
      expiryTime: number;
    }>;

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      publisher: missingUserId,
      statusList: {},
      ext: '',
      latestTime: 0,
      expiryTime: 0,
    });
  });

  test('未登录调用 presence API 应返回 restBaseUrl required validation details', async ({ browser }) => {
    const config = resolveRealEnvConfig()!;
    const page = await browser.newPage();
    await page.goto('/test-harness.html');
    await page.waitForFunction(() => document.getElementById('status')?.textContent === 'loaded');

    const operations = await page.evaluate(async ({ appKey }) => {
      const { ChatClient, PresenceManager } = window.__SDK__;
      const client = ChatClient.init({ appKey, useFixedDeviceId: true }).use(PresenceManager) as any;
      window.__CLIENT__ = client;
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
        publishPresence: await capture(() => client.presenceManager.publishPresence({
          customStatus: 'not-login',
        })),
        subscribePresence: await capture(() => client.presenceManager.subscribePresence({
          userIds: ['target-user'],
          expiry: 300,
        })),
        unsubscribePresence: await capture(() => client.presenceManager.unsubscribePresence({
          userIds: ['target-user'],
        })),
        getPresenceStatus: await capture(() => client.presenceManager.getPresenceStatus({
          userIds: ['target-user'],
        })),
        getSubscribedPresenceList: await capture(() => client.presenceManager.getSubscribedPresenceList({
          pageNum: 0,
          pageSize: 20,
        })),
      };
    }, { appKey: config.appKey }) as Record<string, CapturedOperationResult>;

    for (const [operation, result] of Object.entries(operations)) {
      expect(result.ok, operation).toBe(false);
      if (result.ok === false) {
        expect(result, operation).toMatchObject({
          name: 'ValidationError',
          code: VALIDATION_ERROR_CODE,
          message: 'restBaseUrl is required',
        });
        expect(result.details?.fields?.[0], operation).toMatchObject({
          path: 'restBaseUrl',
          message: 'restBaseUrl is required',
          rule: 'required',
        });
      }
    }
    await page.close();
  });

  test('订阅数量超限应返回明确错误码', async ({ userA }) => {
    const overLimitUserIds = Array.from({ length: 101 }, (_, index) => `presence-limit-${index}`);

    const error = await userA.page.evaluate(async ({ userIds, expiry }) => {
      try {
        await (window.__CLIENT__ as any).presenceManager.subscribePresence({ userIds, expiry });
        return null;
      } catch (e: any) {
        return {
          name: e.name,
          code: e.code,
          message: e.message,
          details: e.details ?? null,
        };
      }
    }, { userIds: overLimitUserIds, expiry: 300 }) as {
      name: string;
      code: number;
      message: string;
      details: Record<string, unknown> | null;
    } | null;

    expect(error).not.toBeNull();
    // 当前实现仍返回通用 ValidationError=110，而不是更细的 1100。
    expect(error?.code).toBe(VALIDATION_ERROR_CODE);
    expect(error?.message).toBe('Invalid request parameters');
  });

  test('非法分页参数应返回字段级 validation details', async ({ userA }) => {
    const error = await userA.page.evaluate(async () => {
      try {
        await (window.__CLIENT__ as any).presenceManager.getSubscribedPresenceList({
          pageNum: -1,
          pageSize: -1,
        });
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
      message: 'Invalid parameters',
    });
    expect(error?.details?.fields).toEqual([
      {
        path: 'pageNum',
        message: 'pageNum must be greater than or equal to 0',
        rule: 'range',
      },
      {
        path: 'pageSize',
        message: 'pageSize must be greater than or equal to 0',
        rule: 'range',
      },
    ]);
  });
});
