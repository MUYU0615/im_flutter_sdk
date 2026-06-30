/**
 * E2E 测试 - 会话管理
 * 迁移自 robot: wayang/TestCase/会话/会话.robot（Webim 标记用例）
 */
import { test, expect } from '../fixtures/sdk-api';

type ConversationItemPayload = {
  readonly conversationId: string;
  readonly conversationType: string;
  readonly unreadCount: number;
  readonly lastMessage: {
    readonly msgServerId: string;
    readonly from: string;
    readonly to: string;
    readonly sender: {
      readonly userId: string;
      readonly nickname?: string;
      readonly avatarUrl?: string;
    };
    readonly conversationId: string;
    readonly conversationType: string;
    readonly type: string;
    readonly status?: string;
    readonly timestamp: number;
    readonly direct?: string;
    readonly body: Record<string, unknown>;
  } | null;
  readonly lastMessageAt?: number;
  readonly isPinned?: boolean;
  readonly pinnedTimestamp?: number;
  readonly marks: number[];
  readonly readAt?: number;
  readonly remindType: string;
  readonly conversationName?: string;
  readonly conversationAvatar?: string;
};

test.describe('conversation - 会话管理', () => {
  test.beforeEach(async ({ userA, userB }) => {
    await userA.page.evaluate(async (targetId: string) => {
      const client = window.__CLIENT__ as any;
      const msg = client.chatManager.createTextMessage({
        conversationId: targetId,
        conversationType: 'singleChat',
        content: `ensure-conversation-${Date.now()}`,
      });
      await client.chatManager.sendMessage(msg);
    }, userB.userId);
    await userA.page.waitForTimeout(1000);
    await userA.clearEvents();
  });

  test('refreshSessionList / getConversationList 应返回同一会话的精确投影', async ({
    userA,
    userB,
  }) => {
    const refreshed = (await userA.page.evaluate(async () => {
      return (window.__CLIENT__ as any).chatManager.refreshSessionList({
        includeEmpty: true,
      });
    })) as ReadonlyArray<ConversationItemPayload>;
    expect(Array.isArray(refreshed)).toBe(true);

    const syncStart = (await userA.waitForEvent('onSyncDataStart')) as { dataType?: string };
    expect(syncStart).toMatchObject({ dataType: 'conversation' });
    const syncFinish = (await userA.waitForEvent('onSyncDataFinished')) as {
      dataType?: string;
      error?: unknown;
    };
    expect(syncFinish).toMatchObject({ dataType: 'conversation' });

    const session = refreshed.find(
      item => item.conversationId === userB.userId && item.conversationType === 'singleChat'
    );
    expect(session).toBeDefined();
    expect(session).toMatchObject({
      conversationId: userB.userId,
      conversationType: 'singleChat',
      remindType: 'DEFAULT',
    });
    expect(session?.conversationName ?? '').toEqual(expect.any(String));
    expect(typeof session?.unreadCount).toBe('number');
    expect(Array.isArray(session?.marks)).toBe(true);
    if (session?.lastMessage) {
      expect(session.lastMessage.msgServerId.length).toBeGreaterThan(0);
      expect(session.lastMessage.from.length).toBeGreaterThan(0);
      expect(session.lastMessage.to.length).toBeGreaterThan(0);
      expect(session.lastMessage.sender.userId).toBe(session.lastMessage.from);
      expect(session.lastMessage.conversationId).toBe(session.conversationId);
      expect(session.lastMessage.conversationType).toBe(session.conversationType);
      expect(session.lastMessage.type.length).toBeGreaterThan(0);
      expect(session.lastMessage.timestamp).toBeGreaterThan(0);
      expect(session.lastMessage.body).toEqual(expect.any(Object));
      expect(session.lastMessage.body).not.toHaveProperty('type');
    }

    const conversations = (await userA.page.evaluate(() => {
      return (window.__CLIENT__ as any).chatManager.getConversationList();
    })) as ReadonlyArray<ConversationItemPayload>;
    expect(conversations.length).toBeGreaterThan(0);
    const conversation = conversations[0];
    expect(conversation).toBeDefined();
    if (!conversation) {
      throw new Error('conversation list first page should contain one item');
    }
    expect(conversation.conversationId.length).toBeGreaterThan(0);
    expect(['singleChat', 'groupChat', 'chatRoom']).toContain(conversation.conversationType);
    expect(typeof conversation.unreadCount).toBe('number');
    expect(Array.isArray(conversation.marks)).toBe(true);
    expect(conversation.remindType).toEqual(expect.any(String));
    expect(conversation.conversationName ?? '').toEqual(expect.any(String));
    if (conversation.lastMessage) {
      expect(conversation.lastMessage.msgServerId.length).toBeGreaterThan(0);
      expect(conversation.lastMessage.timestamp).toBeGreaterThan(0);
      expect(conversation.lastMessage.body).toEqual(expect.any(Object));
    }
  });

  test('setConversationPinned 应返回 mutation 结果，并触发会话更新', async ({ userA, userB }) => {
    const pinned = (await userA.page.evaluate(async (targetId: string) => {
      const client = window.__CLIENT__ as any;
      return client.chatManager.setConversationPinned({
        conversationId: targetId,
        conversationType: 'singleChat',
        pinned: true,
      });
    }, userB.userId)) as {
      conversationId: string;
      conversationType: string;
      operation: string;
      isPinned?: boolean;
      pinnedTime?: number;
    };
    expect(pinned).toMatchObject({
      conversationId: userB.userId,
      conversationType: 'singleChat',
      operation: 'setPinned',
      isPinned: true,
    });
    expect(pinned.pinnedTime ?? 0).toBeGreaterThan(0);

    const update = (await userA.waitForEvent('onConversationListUpdate')) as {
      items: Array<{
        conversationId: string;
        conversationType: string;
        isPinned?: boolean;
      }>;
      reason: string;
    };
    expect(update.reason).toBe('local');
    expect(
      update.items.some(
        item => item.conversationId === userB.userId && item.conversationType === 'singleChat'
      )
    ).toBe(true);

    const unpinned = (await userA.page.evaluate(async (targetId: string) => {
      const client = window.__CLIENT__ as any;
      return client.chatManager.setConversationPinned({
        conversationId: targetId,
        conversationType: 'singleChat',
        pinned: false,
      });
    }, userB.userId)) as {
      conversationId: string;
      conversationType: string;
      operation: string;
      isPinned?: boolean;
    };
    expect(unpinned).toMatchObject({
      conversationId: userB.userId,
      conversationType: 'singleChat',
      operation: 'setPinned',
      isPinned: false,
    });
  });

  test('getPinnedConversationList 应只返回本地缓存中的置顶会话', async ({ userA, userB }) => {
    await userA.page.evaluate(async (targetId: string) => {
      const client = window.__CLIENT__ as any;
      await client.chatManager.setConversationPinned({
        conversationId: targetId,
        conversationType: 'singleChat',
        pinned: true,
      });
    }, userB.userId);
    await userA.waitForEvent('onConversationListUpdate');

    const pinnedList = (await userA.page.evaluate(() => {
      return (window.__CLIENT__ as any).chatManager.getConversationList({ isPinned: true });
    })) as ReadonlyArray<ConversationItemPayload>;
    const pinned = pinnedList.find(
      item => item.conversationId === userB.userId && item.conversationType === 'singleChat'
    );
    expect(pinned).toMatchObject({
      conversationId: userB.userId,
      conversationType: 'singleChat',
      isPinned: true,
    });
    expect(pinned?.pinnedTimestamp ?? 0).toBeGreaterThan(0);
    expect(pinned?.lastMessage).not.toBeNull();

    await userA.page.evaluate(async (targetId: string) => {
      const client = window.__CLIENT__ as any;
      await client.chatManager.setConversationPinned({
        conversationId: targetId,
        conversationType: 'singleChat',
        pinned: false,
      });
    }, userB.userId);
  });

  test('addConversationMark / removeConversationMark / getConversationListByMark 应返回一致结果', async ({
    userA,
    userB,
  }) => {
    const added = (await userA.page.evaluate(async (targetId: string) => {
      const client = window.__CLIENT__ as any;
      return client.chatManager.addConversationMark({
        conversations: [{ conversationId: targetId, conversationType: 'singleChat' }],
        mark: 0,
      });
    }, userB.userId)) as {
      succeeded: Array<{
        conversationId: string;
        conversationType: string;
      }>;
      failed: Array<{
        conversationId: string;
        conversationType: string;
        reason?: string;
      }>;
      mark: number;
      operation: string;
    };
    expect(added).toMatchObject({
      mark: 0,
      operation: 'addMark',
    });
    expect(added.succeeded).toEqual([
      {
        conversationId: userB.userId,
        conversationType: 'singleChat',
      },
    ]);
    expect(added.failed).toEqual([]);

    const markedList = (await userA.page.evaluate(async () => {
      return (window.__CLIENT__ as any).chatManager.getConversationList({
        mark: 0,
      });
    })) as Array<{
      conversationId: string;
      conversationType: string;
      marks: number[];
    }>;
    expect(
      markedList.some(
        item =>
          item.conversationId === userB.userId &&
          item.conversationType === 'singleChat' &&
          item.marks.includes(0)
      )
    ).toBe(true);

    const removed = (await userA.page.evaluate(async (targetId: string) => {
      const client = window.__CLIENT__ as any;
      return client.chatManager.removeConversationMark({
        conversations: [{ conversationId: targetId, conversationType: 'singleChat' }],
        mark: 0,
      });
    }, userB.userId)) as {
      succeeded: Array<{
        conversationId: string;
        conversationType: string;
      }>;
      failed: Array<{
        conversationId: string;
        conversationType: string;
        reason?: string;
      }>;
      mark: number;
      operation: string;
    };
    expect(removed).toMatchObject({
      mark: 0,
      operation: 'removeMark',
    });
    expect(removed.succeeded).toEqual([
      {
        conversationId: userB.userId,
        conversationType: 'singleChat',
      },
    ]);
    expect(removed.failed).toEqual([]);
  });

  test('deleteConversation 应返回删除 mutation', async ({
    userA,
    userB,
  }) => {
    const deleted = (await userA.page.evaluate(async (targetId: string) => {
      return (window.__CLIENT__ as any).chatManager.deleteConversation({
        conversationId: targetId,
        conversationType: 'singleChat',
        deleteRoamingMessages: false,
      });
    }, userB.userId)) as {
      conversationId: string;
      conversationType: string;
      operation: string;
    };
    expect(deleted).toEqual({
      conversationId: userB.userId,
      conversationType: 'singleChat',
      operation: 'delete',
    });
  });

  test('clearAllMessagesAndConversations 应成功调用', async ({
    userA,
  }) => {
    const result = (await userA.page.evaluate(async () => {
      await (window.__CLIENT__ as any).chatManager.clearAllMessagesAndConversations();
      return 'resolved';
    })) as string;
    expect(result).toBe('resolved');
  });
});
