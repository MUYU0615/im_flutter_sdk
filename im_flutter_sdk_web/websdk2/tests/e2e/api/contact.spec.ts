/**
 * E2E 测试 - 好友管理
 * 迁移自 robot: wayang/TestCase/好友.robot（Webim 标记用例）
 */
import { test, expect } from '../fixtures/sdk-api';

const VALIDATION_ERROR_CODE = 110;
const USER_NOT_FOUND_CODE = 204;
const UNMAPPED_BUSINESS_ERROR_CODE = 303;
const CONTACT_SET_REMARK_NOT_FRIEND = 223;

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

async function cleanupContact(user: { page: { evaluate: Function } }, targetId: string): Promise<void> {
  await user.page.evaluate(async (userId: string) => {
    try {
      await (window.__CLIENT__ as any).contactManager.deleteContact({ userId });
    } catch {}
  }, targetId);
}

async function cleanupBlocklist(user: { page: { evaluate: Function } }, targetId: string): Promise<void> {
  await user.page.evaluate(async (userId: string) => {
    try {
      await (window.__CLIENT__ as any).contactManager.removeUserFromBlocklist({ userIds: [userId] });
    } catch {}
  }, targetId);
}

test.describe('contact - 好友管理', () => {
  test.beforeEach(async ({ userA, userB }) => {
    await cleanupContact(userA, userB.userId);
    await cleanupContact(userB, userA.userId);
    await cleanupBlocklist(userA, userB.userId);
    await cleanupBlocklist(userB, userA.userId);
    await userA.page.waitForTimeout(2000);
    await userA.clearEvents();
    await userB.clearEvents();
  });

  test('添加好友、接受邀请、备注变更、删除好友应返回完整 payload 与联系人快照', async ({
    userA,
    userB,
  }) => {
    const requestMessage = `contact-request-${Date.now()}`;
    const remark = `remark-${Date.now()}`;

    await userA.page.evaluate(async ({ userId, message }) => {
      await (window.__CLIENT__ as any).contactManager.addContact({ userId, message });
    }, { userId: userB.userId, message: requestMessage });

    const invited = await userB.waitForEvent('onContactInvited') as {
      type: string;
      from: string;
      to: string;
      status: string;
      userInfo: { userId: string };
    };
    expect(invited).toMatchObject({
      type: 'subscribe',
      from: userA.userId,
      to: userB.userId,
      status: requestMessage,
      userInfo: { userId: userA.userId },
    });

    await userB.page.evaluate(async (userId: string) => {
      await (window.__CLIENT__ as any).contactManager.acceptContactInvite({ userId });
    }, userA.userId);

    const agreed = await userA.waitForEvent('onContactAgreed') as {
      type: string;
      from: string;
      to: string;
      status: string;
      userInfo: { userId: string };
    };
    expect(agreed).toMatchObject({
      type: 'subscribed',
      from: userB.userId,
      to: userA.userId,
      status: '',
      userInfo: { userId: userB.userId },
    });

    const added = await userB.waitForEvent('onContactAdded') as {
      type: string;
      from: string;
      to: string;
      status: string;
      userInfo: { userId: string };
    };
    expect(added).toMatchObject({
      type: 'subscribed',
      from: userA.userId,
      to: userB.userId,
      status: '',
      userInfo: { userId: userA.userId },
    });

    const contactsAfterAccept = await userA.page.evaluate(async () => {
      return (window.__CLIENT__ as any).contactManager.getContacts();
    }) as Array<{
      userId: string;
      remark: string;
      addTs: number;
      userInfo: { userId: string };
    }>;
    const acceptedContact = contactsAfterAccept.find(item => item.userId === userB.userId);
    expect(acceptedContact).toBeDefined();
    expect(acceptedContact).toMatchObject({
      userId: userB.userId,
      remark: '',
      userInfo: { userId: userB.userId },
    });
    expect(acceptedContact!.addTs).toBeGreaterThan(0);

    await userA.page.evaluate(async ({ userId, remark }) => {
      await (window.__CLIENT__ as any).contactManager.setContactRemark({ userId, remark });
    }, { userId: userB.userId, remark });

    const contactsAfterRemark = await userA.page.evaluate(async () => {
      return (window.__CLIENT__ as any).contactManager.getContacts();
    }) as Array<{
      userId: string;
      remark: string;
      addTs: number;
      userInfo: { userId: string };
    }>;
    expect(contactsAfterRemark.find(item => item.userId === userB.userId)).toMatchObject({
      userId: userB.userId,
      remark,
      userInfo: { userId: userB.userId },
    });

    await userA.page.evaluate(async (userId: string) => {
      await (window.__CLIENT__ as any).contactManager.setContactRemark({ userId, remark: '' });
    }, userB.userId);

    const contactsAfterClearRemark = await userA.page.evaluate(async () => {
      return (window.__CLIENT__ as any).contactManager.getContacts();
    }) as Array<{
      userId: string;
      remark: string;
      addTs: number;
      userInfo: { userId: string };
    }>;
    expect(contactsAfterClearRemark.find(item => item.userId === userB.userId)).toMatchObject({
      userId: userB.userId,
      remark: '',
      userInfo: { userId: userB.userId },
    });

    await userA.clearEvents();
    await userB.clearEvents();

    await userA.page.evaluate(async (userId: string) => {
      await (window.__CLIENT__ as any).contactManager.deleteContact({ userId });
    }, userB.userId);

    const deleted = await userB.waitForEvent('onContactDeleted') as {
      type: string;
      from: string;
      to: string;
      status: string;
      userInfo: { userId: string };
    };
    expect(deleted).toMatchObject({
      type: 'unsubscribed',
      from: userA.userId,
      to: userB.userId,
      status: '',
      userInfo: { userId: userA.userId },
    });

    const contactsAfterDelete = await userA.page.evaluate(async () => {
      return (window.__CLIENT__ as any).contactManager.getContacts();
    }) as Array<{ userId: string }>;
    expect(contactsAfterDelete.some(item => item.userId === userB.userId)).toBe(false);
  });

  test('添加好友后拒绝邀请应返回明确拒绝事件', async ({ userA, userB }) => {
    await userA.page.evaluate(async (userId: string) => {
      await (window.__CLIENT__ as any).contactManager.addContact({ userId });
    }, userB.userId);

    const invited = await userB.waitForEvent('onContactInvited') as {
      type: string;
      from: string;
      to: string;
      status: string;
      userInfo: { userId: string };
    };
    expect(invited).toMatchObject({
      type: 'subscribe',
      from: userA.userId,
      to: userB.userId,
      status: '',
      userInfo: { userId: userA.userId },
    });

    await userB.page.evaluate(async (userId: string) => {
      await (window.__CLIENT__ as any).contactManager.declineContactInvite({ userId });
    }, userA.userId);

    const refused = await userA.waitForEvent('onContactRefuse') as {
      type: string;
      from: string;
      to: string;
      status: string;
      userInfo: { userId: string };
    };
    expect(refused).toMatchObject({
      type: 'unsubscribed',
      from: userB.userId,
      to: userA.userId,
      status: '',
      userInfo: { userId: userB.userId },
    });
  });

  test('ContactManager addEventHandler / removeEventHandler 应精确控制联系人事件回调', async ({
    userA,
    userB,
  }) => {
    const firstMessage = `direct-contact-first-${Date.now()}`;
    const secondMessage = `direct-contact-second-${Date.now()}`;

    await userB.page.evaluate(() => {
      window.__EVENTS__.directContactInvited = [];
      (window.__CLIENT__ as any).contactManager.addEventHandler('e2e-contact-direct-handler', {
        onContactInvited: (payload: unknown) => {
          (window.__EVENTS__.directContactInvited ??= []).push(payload);
        },
      });
    });

    await userA.page.evaluate(async ({ userId, message }) => {
      await (window.__CLIENT__ as any).contactManager.addContact({ userId, message });
    }, { userId: userB.userId, message: firstMessage });

    const directInvited = await userB.waitForEventMatching<{
      type: string;
      from: string;
      to: string;
      status: string;
      userInfo: { userId: string };
    }>('directContactInvited', payload => {
      return payload.from === userA.userId && payload.status === firstMessage;
    });
    expect(directInvited).toMatchObject({
      type: 'subscribe',
      from: userA.userId,
      to: userB.userId,
      status: firstMessage,
      userInfo: { userId: userA.userId },
    });

    await userB.page.evaluate(async (userId: string) => {
      await (window.__CLIENT__ as any).contactManager.declineContactInvite({ userId });
      window.__EVENTS__.directContactInvited = [];
      (window.__CLIENT__ as any).contactManager.removeEventHandler('e2e-contact-direct-handler');
    }, userA.userId);
    await userA.waitForEventMatching<{ from: string; to: string }>('onContactRefuse', payload => {
      return payload.from === userB.userId && payload.to === userA.userId;
    });

    await userA.page.evaluate(async ({ userId, message }) => {
      await (window.__CLIENT__ as any).contactManager.addContact({ userId, message });
    }, { userId: userB.userId, message: secondMessage });

    await userB.waitForEventMatching<{
      from: string;
      to: string;
      status: string;
    }>('onContactInvited', payload => {
      return payload.from === userA.userId && payload.to === userB.userId && payload.status === secondMessage;
    });
    await userB.waitForNoEvent('directContactInvited', 1000);

    await userB.page.evaluate(async (userId: string) => {
      await (window.__CLIENT__ as any).contactManager.declineContactInvite({ userId });
    }, userA.userId);
  });

  test('黑名单增删与列表查询应返回完整条目数据', async ({ userA, userB }) => {
    const addResult = await userA.page.evaluate(async (userId: string) => {
      return (window.__CLIENT__ as any).contactManager.addUsersToBlocklist({ userIds: [userId] });
    }, userB.userId) as {
      succeeded: Array<{ userId: string }>;
      failed: Array<{ userId: string }>;
    };
    expect(addResult).toEqual({
      succeeded: [expect.objectContaining({ userId: userB.userId })],
      failed: [],
    });

    const blocklist = await userA.page.evaluate(async () => {
      return (window.__CLIENT__ as any).contactManager.getBlocklist();
    }) as Array<{ userId: string }>;
    expect(blocklist).toContainEqual(expect.objectContaining({ userId: userB.userId }));

    await userA.page.evaluate(async (userId: string) => {
      await (window.__CLIENT__ as any).contactManager.removeUserFromBlocklist({ userIds: [userId] });
    }, userB.userId);

    const blocklistAfterRemove = await userA.page.evaluate(async () => {
      return (window.__CLIENT__ as any).contactManager.getBlocklist();
    }) as Array<{ userId: string }>;
    expect(blocklistAfterRemove.some(item => item.userId === userB.userId)).toBe(false);
  });

  test('非好友设置备注应返回明确错误码', async ({ userA, userB }) => {
    const error = await userA.page.evaluate(async (userId: string) => {
      try {
        await (window.__CLIENT__ as any).contactManager.setContactRemark({
          userId,
          remark: 'not-friend',
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
    }, userB.userId) as {
      name: string;
      code: number;
      message: string;
      details: Record<string, unknown> | null;
    } | null;

    expect(error).not.toBeNull();
    expect(error?.name).toBe('RestBusinessError');
    expect(error?.code).toBe(CONTACT_SET_REMARK_NOT_FRIEND);
    expect(error?.message).toBe('REST business error: setContactRemark failed');
    expect(error?.details).toEqual(
      expect.objectContaining({
        api: 'setContactRemark',
        canonicalCode: CONTACT_SET_REMARK_NOT_FRIEND,
        mapped: true,
        retryable: false,
      })
    );
  });

  test('黑名单接口的空 userIds 应返回字段级 validation details', async ({ userA }) => {
    const operations = await userA.page.evaluate(async () => {
      const manager = (window.__CLIENT__ as any).contactManager;
      const capture = async (operation: () => Promise<void>) => {
        try {
          await operation();
          return null;
        } catch (e: any) {
          return {
            name: e.name,
            code: e.code,
            message: e.message,
            details: e.details ?? null,
          };
        }
      };

      return {
        addUsersToBlocklist: await capture(() => manager.addUsersToBlocklist({ userIds: [] })),
        removeUserFromBlocklist: await capture(() => manager.removeUserFromBlocklist({ userIds: [] })),
      };
    }) as Record<string, CapturedError | null>;

    for (const [operation, error] of Object.entries(operations)) {
      expect(error, operation).not.toBeNull();
      expect(error, operation).toMatchObject({
        name: 'ValidationError',
        code: VALIDATION_ERROR_CODE,
      });
      expect(error?.details?.fields?.[0], operation).toMatchObject({
        path: 'params.userIds',
        rule: 'required',
      });
    }
  });

  test('联系人 API 的空 userId 应返回字段级 validation details', async ({ userA }) => {
    const operations = await userA.page.evaluate(async () => {
      const manager = (window.__CLIENT__ as any).contactManager;
      const capture = async (operation: () => Promise<void>) => {
        try {
          await operation();
          return null;
        } catch (e: any) {
          return {
            name: e.name,
            code: e.code,
            message: e.message,
            details: e.details ?? null,
          };
        }
      };

      return {
        addContact: await capture(() => manager.addContact({ userId: '' })),
        deleteContact: await capture(() => manager.deleteContact({ userId: '' })),
        acceptContactInvite: await capture(() => manager.acceptContactInvite({ userId: '' })),
        declineContactInvite: await capture(() => manager.declineContactInvite({ userId: '' })),
      };
    }) as Record<string, CapturedError | null>;

    for (const [operation, error] of Object.entries(operations)) {
      expect(error, operation).not.toBeNull();
      expect(error?.name, operation).toBe('ValidationError');
      expect(error?.code, operation).toBe(VALIDATION_ERROR_CODE);
      expect(error?.details?.fields?.[0], operation).toMatchObject({
        path: 'params.userId',
        rule: 'required',
      });
    }
  });

  test('联系人 API 的非法字段类型应返回 invalid_format details', async ({ userA }) => {
    const operations = await userA.page.evaluate(async () => {
      const manager = (window.__CLIENT__ as any).contactManager;
      const capture = async (operation: () => Promise<void>) => {
        try {
          await operation();
          return null;
        } catch (e: any) {
          return {
            name: e.name,
            code: e.code,
            message: e.message,
            details: e.details ?? null,
          };
        }
      };

      return {
        addContactMessage: await capture(() => manager.addContact({
          userId: 'valid-user-id',
          message: 1,
        })),
        setContactRemark: await capture(() => manager.setContactRemark({
          userId: 'valid-user-id',
          remark: 1,
        })),
        addBlocklistUserIds: await capture(() => manager.addUsersToBlocklist({
          userIds: [1],
        })),
        removeBlocklistUserIds: await capture(() => manager.removeUserFromBlocklist({
          userIds: [1],
        })),
      };
    }) as Record<string, CapturedError | null>;

    expect(operations.addContactMessage).toMatchObject({
      name: 'ValidationError',
      code: VALIDATION_ERROR_CODE,
    });
    expect(operations.addContactMessage?.details?.fields?.[0]).toMatchObject({
      path: 'params.message',
      rule: 'invalid_format',
    });

    expect(operations.setContactRemark).toMatchObject({
      name: 'ValidationError',
      code: VALIDATION_ERROR_CODE,
    });
    expect(operations.setContactRemark?.details?.fields?.[0]).toMatchObject({
      path: 'params.remark',
      rule: 'invalid_format',
    });

    expect(operations.addBlocklistUserIds).toMatchObject({
      name: 'ValidationError',
      code: VALIDATION_ERROR_CODE,
    });
    expect(operations.addBlocklistUserIds?.details?.fields?.[0]).toMatchObject({
      path: 'params.userIds[0]',
      rule: 'invalid_format',
    });

    expect(operations.removeBlocklistUserIds).toMatchObject({
      name: 'ValidationError',
      code: VALIDATION_ERROR_CODE,
    });
    expect(operations.removeBlocklistUserIds?.details?.fields?.[0]).toMatchObject({
      path: 'params.userIds[0]',
      rule: 'invalid_format',
    });
  });

  test('不存在用户的联系人与黑名单操作应返回明确业务行为', async ({ userA }) => {
    const missingUserId = `missingcontact${Date.now()}`;
    const results = await userA.page.evaluate(async (userId: string) => {
      const manager = (window.__CLIENT__ as any).contactManager;
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
        addContact: await capture(() => manager.addContact({ userId })),
        deleteContact: await capture(() => manager.deleteContact({ userId })),
        acceptContactInvite: await capture(() => manager.acceptContactInvite({ userId })),
        declineContactInvite: await capture(() => manager.declineContactInvite({ userId })),
        addUsersToBlocklist: await capture(() => manager.addUsersToBlocklist({ userIds: [userId] })),
      };
    }, missingUserId) as Record<string, CapturedOperationResult>;

    expect(results.addContact, 'addContact 当前真实环境对不存在用户返回成功，需要作为兼容行为记录').toEqual({
      ok: true,
      value: null,
    });
    expect(results.acceptContactInvite, 'acceptContactInvite 当前真实环境对不存在用户返回成功，需要作为兼容行为记录').toEqual({
      ok: true,
      value: null,
    });
    expect(results.declineContactInvite, 'declineContactInvite 当前真实环境对不存在用户返回成功，需要作为兼容行为记录').toEqual({
      ok: true,
      value: null,
    });

    const deleteResult = results.deleteContact;
    expect(deleteResult, 'deleteContact').toBeDefined();
    expect(deleteResult!.ok, 'deleteContact').toBe(false);
    if (deleteResult?.ok === false) {
      expect(deleteResult).toMatchObject({
        name: 'RestBusinessError',
        code: UNMAPPED_BUSINESS_ERROR_CODE,
        details: {
          api: 'deleteContact',
          serverCode: 'service_resource_not_found',
          httpStatus: 404,
          mapped: false,
          reasonKey: 'service_resource_not_found',
        },
      });
      expect(deleteResult.message).toBe(
        'REST business error: deleteContact failed (service_resource_not_found)'
      );
    }

    const addBlocklistResult = results.addUsersToBlocklist;
    expect(addBlocklistResult, 'addUsersToBlocklist').toBeDefined();
    expect(addBlocklistResult!.ok, 'addUsersToBlocklist').toBe(false);
    if (addBlocklistResult?.ok === false) {
      expect(addBlocklistResult).toMatchObject({
        name: 'RestBusinessError',
        code: USER_NOT_FOUND_CODE,
        details: {
          api: 'addUsersToBlocklist',
          serverCode: 'service_resource_not_found',
          httpStatus: 404,
          mapped: true,
          reasonKey: 'service_resource_not_found',
          canonicalCode: USER_NOT_FOUND_CODE,
        },
      });
      expect(addBlocklistResult.message).toBe(
        'REST business error: addUsersToBlocklist failed'
      );
    }
  });

  test('移除不存在的黑名单用户应保持列表不包含目标用户', async ({ userA, userB }) => {
    await userA.page.evaluate(async (userId: string) => {
      await (window.__CLIENT__ as any).contactManager.removeUserFromBlocklist({ userIds: [userId] });
    }, userB.userId);

    const blocklist = await userA.page.evaluate(async () => {
      return (window.__CLIENT__ as any).contactManager.getBlocklist();
    }) as Array<{ userId: string }>;

    expect(blocklist.some(item => item.userId === userB.userId)).toBe(false);
  });
});
