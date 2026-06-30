/**
 * E2E 测试 - PushManager 公开 API
 */
import { test, expect } from '../fixtures/sdk-api';

const VALIDATION_ERROR_CODE = 110;

type CapturedErrorDetails = {
  readonly fields?: ReadonlyArray<{
    readonly path: string;
    readonly message: string;
    readonly rule: string;
  }>;
  readonly [key: string]: unknown;
};

type CapturedError = {
  readonly name: string;
  readonly code?: number;
  readonly message: string;
  readonly details?: CapturedErrorDetails | null;
};

type CapturedOperationResult<T> =
  | { readonly ok: true; readonly value: T }
  | ({ readonly ok: false } & CapturedError);

type PushTimePoint = {
  readonly hours: number;
  readonly minutes: number;
};

type SilentModeRuleView = {
  readonly remindType?: 'ALL' | 'AT' | 'NONE' | 'DEFAULT';
  readonly expireTimestamp?: number;
  readonly silentModeStartTime?: PushTimePoint;
  readonly silentModeEndTime?: PushTimePoint;
};

type GlobalSilentModeResponse = {
  readonly scope: 'global';
  readonly rule: SilentModeRuleView;
};

type ConversationSilentModeResponse = {
  readonly conversationId: string;
  readonly conversationType: 'singleChat' | 'groupChat';
  readonly rule: SilentModeRuleView;
};

type BatchConversationSilentModeResponse = {
  readonly conversations: ReadonlyArray<ConversationSilentModeResponse>;
};

type PushLanguageResponse = {
  readonly language: string;
};

type MutedConversationPageResponse = {
  readonly conversations: ReadonlyArray<{
    readonly conversationId: string;
    readonly conversationType: 'singleChat' | 'groupChat';
    readonly remindType: 'ALL' | 'AT' | 'NONE';
  }>;
  readonly cursor: string;
};

const expectValidationField = (
  error: CapturedError | null,
  expected: {
    readonly message: string;
    readonly path: string;
    readonly fieldMessage: string;
    readonly rule: string;
  }
): void => {
  expect(error).not.toBeNull();
  expect(error).toMatchObject({
    name: 'ValidationError',
    code: VALIDATION_ERROR_CODE,
    message: expected.message,
  });
  expect(error?.details).toEqual({
    fields: [
      {
        path: expected.path,
        message: expected.fieldMessage,
        rule: expected.rule,
      },
    ],
  });
};

test.describe('push - PushManager', () => {
  test.beforeEach(async ({ userA, userB }) => {
    await userA.page.evaluate(async (targetId: string) => {
      const client = window.__CLIENT__ as any;
      try {
        await client.pushManager.clearConversationRemindType({
          conversationId: targetId,
          conversationType: 'singleChat',
        });
      } catch {}
      try {
        await client.pushManager.setGlobalSilentMode({
          rule: {
            mode: 'REMIND_TYPE',
            remindType: 'ALL',
          },
        });
      } catch {}
      try {
        await client.pushManager.setGlobalSilentMode({
          rule: {
            mode: 'INTERVAL',
            startTime: { hours: 9, minutes: 5 },
            endTime: { hours: 18, minutes: 30 },
          },
        });
      } catch {}
    }, userB.userId);
    await userA.page.waitForTimeout(500);
    await userA.clearEvents();
    await userB.clearEvents();
  });

  test('uploadPushToken 应接受稳定设备 token，并对非法参数返回精确 validation details', async ({
    userA,
  }) => {
    const result = (await userA.page.evaluate(async () => {
      const client = window.__CLIENT__ as any;
      const capture = async <T>(operation: () => Promise<T>): Promise<CapturedOperationResult<T | null>> => {
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
        success: await capture(() =>
          client.pushManager.uploadPushToken({
            deviceId: `web-e2e-device-${Date.now()}`,
            deviceToken: `web-e2e-token-${Date.now()}`,
            notifierName: 'FCM',
          })
        ),
        invalid: await capture(() =>
          client.pushManager.uploadPushToken({
            deviceId: '',
            deviceToken: 'token',
            notifierName: 'FCM',
          })
        ),
      };
    })) as {
      success: CapturedOperationResult<null>;
      invalid: CapturedOperationResult<null>;
    };

    if (!result.success.ok) {
      // 当前真实服务可能未开通 Web Push notifier。失败时仍精确记录服务端错误形态。
      expect(result.success.name).toBe('RestBusinessError');
      expect(result.success.code).toBe(1500);
      expect(result.success.message.length).toBeGreaterThan(0);
      expect(result.success.details).toMatchObject({
        api: 'uploadPushToken',
      });
    } else {
      expect(result.success.value).toBeNull();
    }
    expectValidationField(result.invalid.ok ? null : result.invalid, {
      message: 'deviceId must be a non-empty string',
      path: 'deviceId',
      fieldMessage: 'deviceId must be a non-empty string',
      rule: 'invalid_format',
    });
  });

  test('setGlobalSilentMode / getGlobalSilentMode 应完成提醒类型回读', async ({ userA }) => {
    const result = (await userA.page.evaluate(async () => {
      const client = window.__CLIENT__ as any;
      const setResult = await client.pushManager.setGlobalSilentMode({
        rule: {
          mode: 'REMIND_TYPE',
          remindType: 'AT',
        },
      });
      const getResult = await client.pushManager.getGlobalSilentMode();
      return {
        setResult,
        getResult,
      };
    })) as {
      readonly setResult: GlobalSilentModeResponse;
      readonly getResult: GlobalSilentModeResponse;
    };

    expect(result.setResult).toEqual({
      scope: 'global',
      rule: {
        remindType: 'AT',
        silentModeStartTime: {
          hours: 9,
          minutes: 5,
        },
        silentModeEndTime: {
          hours: 18,
          minutes: 30,
        },
      },
    });
    expect(result.getResult).toEqual(result.setResult);
  });

  test('setGlobalSilentMode 应支持时间区间并精确回读时间点', async ({ userA }) => {
    const result = (await userA.page.evaluate(async () => {
      return (window.__CLIENT__ as any).pushManager.setGlobalSilentMode({
        rule: {
          mode: 'INTERVAL',
          startTime: { hours: 9, minutes: 5 },
          endTime: { hours: 18, minutes: 30 },
        },
      });
    })) as GlobalSilentModeResponse;

    expect(result.scope).toBe('global');
    expect(result.rule).toEqual({
      remindType: 'ALL',
      silentModeStartTime: {
        hours: 9,
        minutes: 5,
      },
      silentModeEndTime: {
        hours: 18,
        minutes: 30,
      },
    });
  });

  test('会话免打扰 set/get/batch/clear 应返回目标会话与规则快照', async ({
    userA,
    userB,
  }) => {
    const result = (await userA.page.evaluate(async (targetId: string) => {
      const client = window.__CLIENT__ as any;
      const setResult = await client.pushManager.setConversationSilentMode({
        conversationId: targetId,
        conversationType: 'singleChat',
        rule: {
          mode: 'REMIND_TYPE',
          remindType: 'NONE',
        },
      });
      const getResult = await client.pushManager.getConversationSilentMode({
        conversationId: targetId,
        conversationType: 'singleChat',
      });
      const batchResult = await client.pushManager.getConversationSilentModes({
        conversationList: [
          {
            conversationId: targetId,
            conversationType: 'singleChat',
          },
        ],
      });
      const cleared = await client.pushManager.clearConversationRemindType({
        conversationId: targetId,
        conversationType: 'singleChat',
      });
      const afterClear = await client.pushManager.getConversationSilentMode({
        conversationId: targetId,
        conversationType: 'singleChat',
      });
      return {
        setResult,
        getResult,
        batchResult,
        cleared,
        afterClear,
      };
    }, userB.userId)) as {
      readonly setResult: ConversationSilentModeResponse;
      readonly getResult: ConversationSilentModeResponse;
      readonly batchResult: BatchConversationSilentModeResponse;
      readonly cleared: ConversationSilentModeResponse;
      readonly afterClear: ConversationSilentModeResponse;
    };

    for (const snapshot of [result.setResult, result.getResult, result.batchResult.conversations[0]]) {
      expect(snapshot).toBeDefined();
      expect(snapshot?.conversationId).toBe(userB.userId);
      expect(snapshot?.conversationType).toBe('singleChat');
      expect(snapshot?.rule.remindType).toBe('NONE');
      const ruleKeys = Object.keys(snapshot?.rule ?? {}).sort();
      expect(ruleKeys).toEqual(
        snapshot?.rule.expireTimestamp === undefined
          ? ['remindType']
          : ['expireTimestamp', 'remindType']
      );
      if (snapshot?.rule.expireTimestamp !== undefined) {
        expect(typeof snapshot.rule.expireTimestamp).toBe('number');
        expect(snapshot.rule.expireTimestamp).toBeGreaterThan(0);
      }
    }
    expect(result.batchResult.conversations).toHaveLength(1);
    expect(result.cleared.conversationId).toBe(userB.userId);
    expect(result.cleared.conversationType).toBe('singleChat');
    expect(result.cleared.rule.remindType).toBe('DEFAULT');
    expect(Object.keys(result.cleared.rule).sort()).toEqual(
      result.cleared.rule.expireTimestamp === undefined
        ? ['remindType']
        : ['expireTimestamp', 'remindType']
    );
    if (result.cleared.rule.expireTimestamp !== undefined) {
      expect(typeof result.cleared.rule.expireTimestamp).toBe('number');
      expect(result.cleared.rule.expireTimestamp).toBeGreaterThan(0);
    }
    expect(result.afterClear.conversationId).toBe(userB.userId);
    expect(result.afterClear.conversationType).toBe('singleChat');
    expect(result.afterClear.rule.remindType).not.toBe('NONE');
    expect(result.afterClear.rule.remindType).not.toBe('AT');
    expect(Object.keys(result.afterClear.rule).sort()).toEqual(
      result.afterClear.rule.expireTimestamp === undefined ? [] : ['expireTimestamp']
    );
    if (result.afterClear.rule.expireTimestamp !== undefined) {
      expect(typeof result.afterClear.rule.expireTimestamp).toBe('number');
      expect(result.afterClear.rule.expireTimestamp).toBeGreaterThan(0);
    }
  });

  test('会话免打扰 duration 应返回毫秒级到期时间戳', async ({ userA, userB }) => {
    const startedAt = Date.now();
    const result = (await userA.page.evaluate(async (targetId: string) => {
      return (window.__CLIENT__ as any).pushManager.setConversationSilentMode({
        conversationId: targetId,
        conversationType: 'singleChat',
        rule: {
          mode: 'DURATION',
          duration: 120,
        },
      });
    }, userB.userId)) as ConversationSilentModeResponse;

    expect(result.conversationId).toBe(userB.userId);
    expect(result.conversationType).toBe('singleChat');
    expect(typeof result.rule.expireTimestamp).toBe('number');
    expect(result.rule.expireTimestamp ?? 0).toBeGreaterThan(startedAt);
    expect(result.rule.expireTimestamp ?? 0).toBeLessThan(Date.now() + 180_000);
  });

  test('setPushLanguage / getPushLanguage 应完成语言偏好回读', async ({ userA }) => {
    const result = (await userA.page.evaluate(async () => {
      const client = window.__CLIENT__ as any;
      const setResult = await client.pushManager.setPushLanguage({
        language: 'EN',
      });
      const getResult = await client.pushManager.getPushLanguage();
      return {
        setResult,
        getResult,
      };
    })) as {
      readonly setResult: undefined;
      readonly getResult: PushLanguageResponse;
    };

    expect(result.setResult).toBeUndefined();
    expect(result.getResult).toEqual({
      language: 'EN',
    });
  });

  test('getConversationListByRemindType 返回本地 session-list 投影；当前 SDK 未同步 silent mode mutation', async ({
    userA,
    userB,
  }) => {
    const result = (await userA.page.evaluate(async (targetId: string) => {
      const client = window.__CLIENT__ as any;
      await client.chatManager.refreshSessionList({
        includeEmpty: true,
      });
      await client.pushManager.setConversationSilentMode({
        conversationId: targetId,
        conversationType: 'singleChat',
        rule: {
          mode: 'REMIND_TYPE',
          remindType: 'AT',
        },
      });
      await client.chatManager.refreshSessionList({
        includeEmpty: true,
      });
      const firstPage = await client.pushManager.getConversationListByRemindType({
        pageSize: 1,
      });
      const secondPage = firstPage.cursor
        ? await client.pushManager.getConversationListByRemindType({
            pageSize: 1,
            cursor: firstPage.cursor,
          })
        : null;
      return {
        directRule: await client.pushManager.getConversationSilentMode({
          conversationId: targetId,
          conversationType: 'singleChat',
        }),
        firstPage,
        secondPage,
      };
    }, userB.userId)) as {
      readonly directRule: ConversationSilentModeResponse;
      readonly firstPage: MutedConversationPageResponse;
      readonly secondPage: MutedConversationPageResponse | null;
    };

    expect(result.directRule.conversationId).toBe(userB.userId);
    expect(result.directRule.conversationType).toBe('singleChat');
    expect(result.directRule.rule.remindType).toBe('AT');
    expect(Object.keys(result.directRule.rule).sort()).toEqual(
      result.directRule.rule.expireTimestamp === undefined
        ? ['remindType']
        : ['expireTimestamp', 'remindType']
    );
    if (result.directRule.rule.expireTimestamp !== undefined) {
      expect(typeof result.directRule.rule.expireTimestamp).toBe('number');
      expect(result.directRule.rule.expireTimestamp).toBeGreaterThan(0);
    }
    expect(result.firstPage).toEqual({
      conversations: [],
      cursor: '',
    });
    expect(result.secondPage).toBeNull();

    await userA.page.evaluate(async (targetId: string) => {
      await (window.__CLIENT__ as any).pushManager.clearConversationRemindType({
        conversationId: targetId,
        conversationType: 'singleChat',
      });
      await (window.__CLIENT__ as any).chatManager.refreshSessionList({
        includeEmpty: true,
      });
    }, userB.userId);
  });

  test('PushManager 参数校验应返回精确错误字段', async ({ userA }) => {
    const result = (await userA.page.evaluate(async () => {
      const client = window.__CLIENT__ as any;
      const capture = async (operation: () => Promise<unknown>): Promise<CapturedError | null> => {
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
        invalidConversationType: await capture(() =>
          client.pushManager.setConversationSilentMode({
            conversationId: 'target',
            conversationType: 'chatRoom',
            rule: {
              mode: 'REMIND_TYPE',
              remindType: 'ALL',
            },
          })
        ),
        emptyBatchList: await capture(() =>
          client.pushManager.getConversationSilentModes({
            conversationList: [],
          })
        ),
        invalidLanguage: await capture(() =>
          client.pushManager.setPushLanguage({
            language: '',
          })
        ),
        invalidPageSize: await capture(() =>
          client.pushManager.getConversationListByRemindType({
            pageSize: 0,
          })
        ),
        invalidDuration: await capture(() =>
          client.pushManager.setGlobalSilentMode({
            rule: {
              mode: 'DURATION',
              duration: 0,
            },
          })
        ),
      };
    })) as {
      readonly invalidConversationType: CapturedError | null;
      readonly emptyBatchList: CapturedError | null;
      readonly invalidLanguage: CapturedError | null;
      readonly invalidPageSize: CapturedError | null;
      readonly invalidDuration: CapturedError | null;
    };

    expectValidationField(result.invalidConversationType, {
      message: 'Conversation type is not supported',
      path: 'conversationType',
      fieldMessage: 'Only singleChat and groupChat are supported',
      rule: 'invalid_format',
    });
    expectValidationField(result.emptyBatchList, {
      message: 'conversationList must be a non-empty array',
      path: 'conversationList',
      fieldMessage: 'conversationList must be a non-empty array',
      rule: 'required',
    });
    expectValidationField(result.invalidLanguage, {
      message: 'language must be a non-empty string',
      path: 'language',
      fieldMessage: 'language must be a non-empty string',
      rule: 'invalid_format',
    });
    expectValidationField(result.invalidPageSize, {
      message: 'pageSize must be a positive integer',
      path: 'pageSize',
      fieldMessage: 'pageSize must be a positive integer',
      rule: 'range',
    });
    expectValidationField(result.invalidDuration, {
      message: 'rule.duration must be a positive integer',
      path: 'rule.duration',
      fieldMessage: 'duration must be a positive integer',
      rule: 'range',
    });
  });
});
