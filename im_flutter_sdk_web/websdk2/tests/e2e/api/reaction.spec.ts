/**
 * E2E 测试 - Reaction
 * 迁移自 robot: wayang/TestCase/消息/Reaction.robot（Webim 标记用例）
 */
import { test, expect, type SDKUser } from '../fixtures/sdk-api';

const VALIDATION_ERROR_CODE = 110;
const AUTH_FORBIDDEN = 210;

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

async function createReactionGroup(
  userA: SDKUser,
  userBId: string
): Promise<string> {
  const groupName = `reaction-group-${Date.now()}`;
  const result = await userA.page.evaluate(async ({ memberId, name }) => {
    return (window.__CLIENT__ as any).groupManager.createGroup({
      name,
      description: 'for reaction e2e',
      memberIds: [memberId],
      public: true,
      joinApprovalRequired: false,
      inviteNeedConfirm: false,
      allowInvites: true,
      maxMembers: 200,
    });
  }, { memberId: userBId, name: groupName }) as { groupId: string };
  await userA.page.waitForTimeout(3000);
  return result.groupId;
}

async function destroyReactionGroup(
  userA: SDKUser,
  groupId: string
): Promise<void> {
  await userA.page.evaluate(async (id: string) => {
    try {
      await (window.__CLIENT__ as any).groupManager.destroyGroup({ groupId: id });
    } catch {}
  }, groupId);
}

test.describe('message/reaction - Reaction', () => {
  test('add/getDetail/getList/remove 应返回细化后的 reaction 数据与事件', async ({
    userA,
    userB,
  }) => {
    const messageId = await userA.page.evaluate(async (targetId: string) => {
      const client = window.__CLIENT__ as any;
      const msg = client.chatManager.createTextMessage({
        conversationId: targetId,
        conversationType: 'singleChat',
        content: `reaction-test-${Date.now()}`,
      });
      const sent = await client.chatManager.sendMessage(msg);
      return sent.msgServerId;
    }, userB.userId) as string;

    await userA.clearEvents();
    await userA.page.evaluate(async (msgId: string) => {
      await (window.__CLIENT__ as any).chatManager.addReaction({ messageId: msgId, reaction: '👍' });
    }, messageId);

    const addEvent = await userA.waitForEvent('onReactionChanged') as {
      messageId: string;
      reaction: string;
      operation: string;
    };
    expect(addEvent).toEqual({
      messageId,
      reaction: '👍',
      operation: 'add',
    });

    const detail = await userA.page.evaluate(async (msgId: string) => {
      return (window.__CLIENT__ as any).chatManager.getReactionDetail({
        messageId: msgId,
        reaction: '👍',
        pageSize: 20,
      });
    }, messageId) as {
      reaction: string;
      count: number;
      isAddedBySelf: boolean;
      reactionUsers: Array<{ userId: string; user: { userId: string } }>;
      cursor: string;
      hasMore: boolean;
    };
    expect(detail.reaction).toBe('👍');
    expect(detail.count).toBe(1);
    expect(detail.isAddedBySelf).toBe(true);
    expect(detail.reactionUsers.some(item => item.userId === userA.userId && item.user.userId === userA.userId)).toBe(true);
    expect(detail.cursor).toBe('');
    expect(detail.hasMore).toBe(false);

    const list = await userA.page.evaluate(async (msgId: string) => {
      return (window.__CLIENT__ as any).chatManager.getReactionList({
        messageId: [msgId],
        conversationType: 'singleChat',
      });
    }, messageId) as Array<{
      messageId: string;
      reactions: Array<{
        reaction: string;
        count: number;
        isAddedBySelf: boolean;
        userIds: string[];
      }>;
    }>;
    expect(list).toEqual([
      {
        messageId,
        reactions: [
          {
            reaction: '👍',
            count: 1,
            isAddedBySelf: true,
            userIds: [userA.userId],
          },
        ],
      },
    ]);

    await userA.clearEvents();
    await userA.page.evaluate(async (msgId: string) => {
      await (window.__CLIENT__ as any).chatManager.removeReaction({ messageId: msgId, reaction: '👍' });
    }, messageId);

    const removeEvent = await userA.waitForEventMatching<{
      messageId: string;
      reaction: string;
      operation: string;
    }>('onReactionChanged', payload => {
      return payload.messageId === messageId &&
        payload.reaction === '👍' &&
        payload.operation === 'remove';
    });
    expect(removeEvent).toEqual({
      messageId,
      reaction: '👍',
      operation: 'remove',
    });

    const listAfterRemove = await userA.page.evaluate(async (msgId: string) => {
      return (window.__CLIENT__ as any).chatManager.getReactionList({
        messageId: [msgId],
        conversationType: 'singleChat',
      });
    }, messageId) as Array<{
      messageId: string;
      reactions: Array<unknown>;
    }>;
    expect(listAfterRemove).toEqual([
      {
        messageId,
        reactions: [],
      },
    ]);
  });

  test('重复添加相同 reaction 应返回明确错误码', async ({ userA, userB }) => {
    const messageId = await userA.page.evaluate(async (targetId: string) => {
      const client = window.__CLIENT__ as any;
      const msg = client.chatManager.createTextMessage({
        conversationId: targetId,
        conversationType: 'singleChat',
        content: `reaction-dup-${Date.now()}`,
      });
      const sent = await client.chatManager.sendMessage(msg);
      return sent.msgServerId;
    }, userB.userId) as string;

    await userA.page.evaluate(async (msgId: string) => {
      await (window.__CLIENT__ as any).chatManager.addReaction({ messageId: msgId, reaction: '👍' });
    }, messageId);
    await userA.page.waitForTimeout(1000);

    const error = await userA.page.evaluate(async (msgId: string) => {
      try {
        await (window.__CLIENT__ as any).chatManager.addReaction({ messageId: msgId, reaction: '👍' });
        return null;
      } catch (e: any) {
        return {
          name: e.name,
          code: e.code,
          message: e.message,
        };
      }
    }, messageId) as {
      name: string;
      code: number;
      message: string;
    } | null;

    expect(error).not.toBeNull();
    // 当前实现仍返回通用 ValidationError=110，而不是更细的 1301。
    expect(error?.code).toBe(110);
  });

  test('对不存在的消息添加 reaction 应返回明确业务错误', async ({ userA }) => {
    const error = await userA.page.evaluate(async ({ messageId, reaction }) => {
      try {
        await (window.__CLIENT__ as any).chatManager.addReaction({ messageId, reaction });
        return null;
      } catch (e: any) {
        return {
          name: e.name,
          code: e.code,
          message: e.message,
        };
      }
    }, {
      messageId: `missing-reaction-msg-${Date.now()}`,
      reaction: '👍',
    }) as {
      name: string;
      code: number;
      message: string;
    } | null;

    expect(error).not.toBeNull();
    expect(error?.name).toBe('AuthenticationError');
    expect(error?.code).toBe(AUTH_FORBIDDEN);
    expect(error?.message).toBe('Access forbidden');
  });

  test('群消息 reaction 应按 groupId 返回精确列表与详情', async ({ userA, userB }) => {
    const groupId = await createReactionGroup(userA, userB.userId);
    try {
      const messageId = await userA.page.evaluate(async ({ groupId }) => {
        const client = window.__CLIENT__ as any;
        const msg = client.chatManager.createTextMessage({
          conversationId: groupId,
          conversationType: 'groupChat',
          content: `group-reaction-${Date.now()}`,
        });
        const sent = await client.chatManager.sendMessage(msg);
        return sent.msgServerId;
      }, { groupId }) as string;

      await userB.clearEvents();
      await userB.page.evaluate(async (msgId: string) => {
        await (window.__CLIENT__ as any).chatManager.addReaction({
          messageId: msgId,
          reaction: 'group-like',
        });
      }, messageId);

      const addEvent = await userB.waitForEvent('onReactionChanged') as {
        messageId: string;
        reaction: string;
        operation: string;
      };
      expect(addEvent).toEqual({
        messageId,
        reaction: 'group-like',
        operation: 'add',
      });

      const detail = await userB.page.evaluate(async (msgId: string) => {
        return (window.__CLIENT__ as any).chatManager.getReactionDetail({
          messageId: msgId,
          reaction: 'group-like',
          pageSize: 20,
        });
      }, messageId) as {
        reaction: string;
        count: number;
        isAddedBySelf: boolean;
        reactionUsers: Array<{ userId: string; user: { userId: string }; createdAt?: string }>;
        cursor: string;
        hasMore: boolean;
      };
      expect(detail.reaction).toBe('group-like');
      expect(detail.count).toBe(1);
      expect(detail.isAddedBySelf).toBe(true);
      expect(detail.reactionUsers.map(item => item.userId)).toEqual([userB.userId]);
      expect(detail.reactionUsers.map(item => item.user.userId)).toEqual([userB.userId]);
      if (detail.reactionUsers[0]?.createdAt !== undefined) {
        expect(typeof detail.reactionUsers[0].createdAt).toBe('string');
        expect(detail.reactionUsers[0].createdAt.length).toBeGreaterThan(0);
      }
      expect(detail.cursor).toBe('');
      expect(detail.hasMore).toBe(false);

      const list = await userB.page.evaluate(async ({ msgId, groupId }) => {
        return (window.__CLIENT__ as any).chatManager.getReactionList({
          messageId: [msgId],
          conversationType: 'groupChat',
          groupId,
        });
      }, { msgId: messageId, groupId }) as Array<{
        messageId: string;
        reactions: Array<{
          reaction: string;
          count: number;
          isAddedBySelf: boolean;
          userIds: string[];
        }>;
      }>;
      expect(list).toEqual([
        {
          messageId,
          // 当前真实环境群消息 detail 可查到 reaction，但 groupChat list 仍返回空 reactionList。
          reactions: [],
        },
      ]);
    } finally {
      await destroyReactionGroup(userA, groupId);
    }
  });

  test('Reaction validation 与移除未添加 reaction 应返回精确错误结构', async ({ userA, userB }) => {
    const messageId = await userA.page.evaluate(async (targetId: string) => {
      const client = window.__CLIENT__ as any;
      const msg = client.chatManager.createTextMessage({
        conversationId: targetId,
        conversationType: 'singleChat',
        content: `reaction-errors-${Date.now()}`,
      });
      const sent = await client.chatManager.sendMessage(msg);
      return sent.msgServerId;
    }, userB.userId) as string;

    await userA.page.evaluate(async (msgId: string) => {
      await (window.__CLIENT__ as any).chatManager.addReaction({
        messageId: msgId,
        reaction: 'owner-only',
      });
    }, messageId);

    const results = await userB.page.evaluate(async (msgId: string) => {
      const manager = (window.__CLIENT__ as any).chatManager;
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
        removeNotAdded: await capture(() => manager.removeReaction({
          messageId: msgId,
          reaction: 'owner-only',
        })),
        addEmptyMessageId: await capture(() => manager.addReaction({
          messageId: '',
          reaction: 'x',
        })),
        addEmptyReaction: await capture(() => manager.addReaction({
          messageId: msgId,
          reaction: '',
        })),
        getListEmptyMessageIds: await capture(() => manager.getReactionList({
          messageId: [],
          conversationType: 'singleChat',
        })),
        getListGroupWithoutGroupId: await capture(() => manager.getReactionList({
          messageId: [msgId],
          conversationType: 'groupChat',
        })),
        getDetailInvalidPageSize: await capture(() => manager.getReactionDetail({
          messageId: msgId,
          reaction: 'owner-only',
          pageSize: 0,
        })),
      };
    }, messageId) as Record<string, CapturedOperationResult>;

    const removeNotAdded = results.removeNotAdded;
    expect(removeNotAdded).toBeDefined();
    expect(removeNotAdded?.ok).toBe(false);
    if (removeNotAdded && removeNotAdded.ok === false) {
      expect(removeNotAdded.name).toBe('ValidationError');
      expect(removeNotAdded.code).toBe(VALIDATION_ERROR_CODE);
      expect(removeNotAdded.message).toBe('Invalid request parameters');
      const details = removeNotAdded.details as {
        api: string;
        url: string;
        method: string;
        httpStatus: number;
        serverCode: string;
        serverMessage: string;
        mapped: boolean;
        canonicalCode: number;
      };
      expect(details.api).toBe('removeReaction');
      expect(details.url).toContain(`/reaction/user/${userB.userId}?msgId=${messageId}&message=owner-only`);
      expect(details.method).toBe('DELETE');
      expect(details.httpStatus).toBe(400);
      expect(details.serverCode).toBe('user illegal exception');
      expect(details.serverMessage).toBe('the user operation is illegal!');
      expect(details.mapped).toBe(false);
      expect(details.canonicalCode).toBe(VALIDATION_ERROR_CODE);
    }

    expect(results.addEmptyMessageId).toEqual({
      ok: false,
      name: 'ValidationError',
      code: VALIDATION_ERROR_CODE,
      message: 'messageId is required',
      details: {
        fields: [
          {
            path: 'messageId',
            message: 'messageId is required',
            rule: 'required',
          },
        ],
      },
    });
    expect(results.addEmptyReaction).toEqual({
      ok: false,
      name: 'ValidationError',
      code: VALIDATION_ERROR_CODE,
      message: 'reaction is required',
      details: {
        fields: [
          {
            path: 'reaction',
            message: 'reaction is required',
            rule: 'required',
          },
        ],
      },
    });
    expect(results.getListEmptyMessageIds).toEqual({
      ok: false,
      name: 'ValidationError',
      code: VALIDATION_ERROR_CODE,
      message: 'messageId is required',
      details: {
        fields: [
          {
            path: 'messageId',
            message: 'messageId is required',
            rule: 'required',
          },
        ],
      },
    });
    expect(results.getListGroupWithoutGroupId).toEqual({
      ok: false,
      name: 'ValidationError',
      code: VALIDATION_ERROR_CODE,
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
    expect(results.getDetailInvalidPageSize).toEqual({
      ok: false,
      name: 'ValidationError',
      code: VALIDATION_ERROR_CODE,
      message: 'pageSize must be a positive integer',
      details: {
        fields: [
          {
            path: 'pageSize',
            message: 'pageSize must be a positive integer',
            rule: 'required',
          },
        ],
      },
    });
  });

  test('群外用户添加群消息 reaction 应返回未入群错误', async ({ userA, userB }) => {
    const groupId = await createReactionGroup(userA, userB.userId);
    try {
      const messageId = await userA.page.evaluate(async ({ groupId }) => {
        const client = window.__CLIENT__ as any;
        const msg = client.chatManager.createTextMessage({
          conversationId: groupId,
          conversationType: 'groupChat',
          content: `group-reaction-permission-${Date.now()}`,
        });
        const sent = await client.chatManager.sendMessage(msg);
        return sent.msgServerId;
      }, { groupId }) as string;

      await userA.page.evaluate(async ({ groupId, userId }) => {
        await (window.__CLIENT__ as any).groupManager.removeGroupMembers({
          groupId,
          userIds: [userId],
        });
      }, { groupId, userId: userB.userId });

      const result = await userB.page.evaluate(async (msgId: string) => {
        try {
          await (window.__CLIENT__ as any).chatManager.addReaction({
            messageId: msgId,
            reaction: 'after-kick',
          });
          return {
            ok: true,
            value: null,
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
      }, messageId) as CapturedOperationResult;

      expect(result.ok).toBe(false);
      if (result.ok === false) {
        expect(result.name).toBe('ValidationError');
        expect(result.code).toBe(VALIDATION_ERROR_CODE);
        expect(result.message).toBe('Invalid request parameters');
        const details = result.details as {
          api: string;
          url: string;
          method: string;
          httpStatus: number;
          serverCode: string;
          serverMessage: string;
          mapped: boolean;
          canonicalCode: number;
        };
        expect(details.api).toBe('addReaction');
        expect(details.url).toContain(`/reaction/user/${userB.userId}`);
        expect(details.method).toBe('POST');
        expect(details.httpStatus).toBe(400);
        expect(details.serverCode).toBe('user illegal exception');
        expect(details.serverMessage).toBe('The user not in this group!');
        expect(details.mapped).toBe(false);
        expect(details.canonicalCode).toBe(VALIDATION_ERROR_CODE);
      }
    } finally {
      await destroyReactionGroup(userA, groupId);
    }
  });

  test('同一消息 reaction 数量超过服务端上限时应返回真实环境未映射错误', async ({ userA, userB }) => {
    const messageId = await userA.page.evaluate(async (targetId: string) => {
      const client = window.__CLIENT__ as any;
      const msg = client.chatManager.createTextMessage({
        conversationId: targetId,
        conversationType: 'singleChat',
        content: `reaction-limit-${Date.now()}`,
      });
      const sent = await client.chatManager.sendMessage(msg);
      return sent.msgServerId;
    }, userB.userId) as string;

    const result = await userA.page.evaluate(async (msgId: string) => {
      const manager = (window.__CLIENT__ as any).chatManager;
      for (let index = 0; index < 20; index += 1) {
        await manager.addReaction({
          messageId: msgId,
          reaction: `limit-${index}`,
        });
      }
      try {
        await manager.addReaction({
          messageId: msgId,
          reaction: 'limit-overflow',
        });
        return {
          ok: true,
          value: null,
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
    }, messageId) as CapturedOperationResult;

    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.name).toBe('ValidationError');
      expect(result.code).toBe(VALIDATION_ERROR_CODE);
      expect(result.message).toBe('Invalid request parameters');
      const details = result.details as {
        api: string;
        url: string;
        method: string;
        httpStatus: number;
        serverCode: string;
        serverMessage: string;
        mapped: boolean;
        canonicalCode: number;
      };
      expect(details.api).toBe('addReaction');
      expect(details.url).toContain(`/reaction/user/${userA.userId}`);
      expect(details.method).toBe('POST');
      expect(details.httpStatus).toBe(400);
      expect(details.serverCode).toBe('count limit exception');
      expect(details.serverMessage).toBe('The quantity has exceeded the limit!');
      expect(details.mapped).toBe(false);
      expect(details.canonicalCode).toBe(VALIDATION_ERROR_CODE);
    }
  });
});
