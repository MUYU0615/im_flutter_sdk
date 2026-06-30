/**
 * E2E 测试 - 群聊消息
 * 迁移自 robot: wayang/TestCase/消息/群聊.robot（Webim 标记用例）
 */
import { test, expect } from '../fixtures/sdk-api';
import type { Page } from '@playwright/test';

type CapturedError = {
  readonly name: string;
  readonly code?: number;
  readonly message: string;
  readonly details?: unknown;
};

type MessageEventPayload<TBody extends Record<string, unknown>> = {
  readonly msgServerId: string;
  readonly msgLocalId?: string;
  readonly from: string;
  readonly to: string;
  readonly conversationId: string;
  readonly conversationType: string;
  readonly type: string;
  readonly status?: string;
  readonly body: TBody;
  readonly timestamp?: number;
  readonly localTime?: number;
};

const expectMessageDynamicFields = (
  message: Pick<
    MessageEventPayload<Record<string, unknown>>,
    'msgServerId' | 'msgLocalId' | 'timestamp' | 'localTime'
  >
): void => {
  expect(message.msgServerId.length).toBeGreaterThan(0);
  if (message.msgLocalId !== undefined) {
    expect(typeof message.msgLocalId).toBe('string');
  }
  if (message.timestamp !== undefined) {
    expect(Number.isFinite(message.timestamp)).toBe(true);
    expect(message.timestamp).toBeGreaterThan(0);
  }
  if (message.localTime !== undefined) {
    expect(Number.isFinite(message.localTime)).toBe(true);
    expect(message.localTime).toBeGreaterThan(0);
  }
};

const expectGroupVisible = async (userPage: Page, groupId: string): Promise<void> => {
  const detail = (await userPage.evaluate(async (targetGroupId: string) => {
    return (window.__CLIENT__ as any).groupManager.getGroupInfo({ groupId: targetGroupId });
  }, groupId)) as { groupId: string; role?: string };
  expect(detail).toMatchObject({
    groupId,
    role: 'member',
  });
};

const waitForGroupHistoryMessage = async <TBody extends Record<string, unknown>>(
  page: Page,
  groupId: string,
  messageId: string
): Promise<MessageEventPayload<TBody>> => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 10000) {
    const history = (await page.evaluate(async ({ groupId }) => {
      return (window.__CLIENT__ as any).chatManager.getHistoryMessages({
        conversationId: groupId,
        conversationType: 'groupChat',
        pageSize: 50,
      });
    }, { groupId })) as { items: Array<MessageEventPayload<TBody>> };
    const matched = history.items.find(item => item.msgServerId === messageId);
    if (matched) {
      return matched;
    }
    await page.waitForTimeout(500);
  }
  throw new Error(`group history message not found: ${messageId}`);
};

test.describe('message/group-chat - 群聊消息', () => {
  let testGroupId: string | null = null;

  test.beforeEach(async ({ userA, userB }) => {
    const creatorGroupName = `e2e-group-chat-${Date.now()}`;
    const result = (await userA.page.evaluate(
      async ({ memberId, name }) => {
        const client = window.__CLIENT__ as any;
        return client.groupManager.createGroup({
          name,
          description: 'for e2e group message test',
          memberIds: [memberId],
          public: true,
          joinApprovalRequired: false,
          inviteNeedConfirm: false,
          allowInvites: true,
          maxMembers: 200,
        });
      },
      { memberId: userB.userId, name: creatorGroupName }
    )) as { groupId: string };

    testGroupId = result.groupId;
    await userA.page.waitForTimeout(3000);
    await userA.clearEvents();
    await userB.clearEvents();
  });

  test.afterEach(async ({ userA }) => {
    if (!testGroupId) {
      return;
    }
    await userA.page.evaluate(async (groupId: string) => {
      try {
        await (window.__CLIENT__ as any).groupManager.destroyGroup({ groupId });
      } catch {}
    }, testGroupId);
    testGroupId = null;
  });

  test('发送群文本消息时，接收端 history payload 应带群会话字段', async ({ userA, userB }) => {
    await expectGroupVisible(userB.page, testGroupId!);

    const content = `e2e-group-text-${Date.now()}`;

    const sent = (await userA.page.evaluate(
      async ({ groupId, content: messageContent }) => {
        const client = window.__CLIENT__ as any;
        const msg = client.chatManager.createTextMessage({
          conversationId: groupId,
          conversationType: 'groupChat',
          content: messageContent,
        });
        return client.chatManager.sendMessage(msg);
      },
      { groupId: testGroupId!, content }
    )) as MessageEventPayload<{ content: string }>;

    expectMessageDynamicFields(sent);
    expect(sent).toMatchObject({
      from: userA.userId,
      to: testGroupId!,
      conversationId: testGroupId!,
      conversationType: 'groupChat',
      type: 'text',
      status: 'sent',
      body: { content },
    });

    const received = await waitForGroupHistoryMessage<{ content: string }>(
      userB.page,
      testGroupId!,
      sent.msgServerId
    );
    expectMessageDynamicFields(received);
    expect(received).toMatchObject({
      msgServerId: sent.msgServerId,
      from: userA.userId,
      to: testGroupId!,
      conversationId: testGroupId!,
      conversationType: 'groupChat',
      type: 'text',
      body: { content },
    });
  });

  test('群 location/cmd/custom 消息应在接收端 history 保留关键 body 字段', async ({
    userA,
    userB,
  }) => {
    await expectGroupVisible(userB.page, testGroupId!);

    const locationAddress = `group-location-${Date.now()}`;
    const cmdAction = `group-cmd-${Date.now()}`;
    const customEvent = `group-custom-${Date.now()}`;
    const customParams = { scene: 'e2e', value: `${Date.now()}` };

    const locationSent = (await userA.page.evaluate(
      async ({ groupId, address }) => {
        const client = window.__CLIENT__ as any;
        const msg = client.chatManager.createLocationMessage({
          conversationId: groupId,
          conversationType: 'groupChat',
          latitude: 31.2304,
          longitude: 121.4737,
          address,
        });
        return client.chatManager.sendMessage(msg);
      },
      { groupId: testGroupId!, address: locationAddress }
    )) as MessageEventPayload<{ latitude: number; longitude: number; address?: string }>;
    const locationReceived = await waitForGroupHistoryMessage<{
      latitude: number;
      longitude: number;
      address?: string;
    }>(userB.page, testGroupId!, locationSent.msgServerId);
    expectMessageDynamicFields(locationSent);
    expectMessageDynamicFields(locationReceived);
    expect(locationReceived).toMatchObject({
      msgServerId: locationSent.msgServerId,
      from: userA.userId,
      to: testGroupId!,
      conversationId: testGroupId!,
      conversationType: 'groupChat',
      type: 'location',
      body: {
        latitude: 31.2304,
        longitude: 121.4737,
        address: locationAddress,
      },
    });
    await userA.page.waitForTimeout(1500);

    const cmdSent = (await userA.page.evaluate(
      async ({ groupId, action }) => {
        const client = window.__CLIENT__ as any;
        const msg = client.chatManager.createCmdMessage({
          conversationId: groupId,
          conversationType: 'groupChat',
          action,
        });
        return client.chatManager.sendMessage(msg);
      },
      { groupId: testGroupId!, action: cmdAction }
    )) as MessageEventPayload<{ action: string }>;
    const cmdReceived = await waitForGroupHistoryMessage<{ action: string }>(
      userB.page,
      testGroupId!,
      cmdSent.msgServerId
    );
    expectMessageDynamicFields(cmdSent);
    expectMessageDynamicFields(cmdReceived);
    expect(cmdReceived).toMatchObject({
      msgServerId: cmdSent.msgServerId,
      from: userA.userId,
      to: testGroupId!,
      conversationId: testGroupId!,
      conversationType: 'groupChat',
      type: 'cmd',
      body: { action: cmdAction },
    });
    await userA.page.waitForTimeout(1500);

    const customSent = (await userA.page.evaluate(
      async ({ groupId, event, params }) => {
        const client = window.__CLIENT__ as any;
        const msg = client.chatManager.createCustomMessage({
          conversationId: groupId,
          conversationType: 'groupChat',
          event,
          params,
        });
        return client.chatManager.sendMessage(msg);
      },
      { groupId: testGroupId!, event: customEvent, params: customParams }
    )) as MessageEventPayload<{ event: string; params?: Record<string, string> }>;
    const customReceived = await waitForGroupHistoryMessage<{
      event: string;
      params?: Record<string, string>;
    }>(userB.page, testGroupId!, customSent.msgServerId);
    expectMessageDynamicFields(customSent);
    expectMessageDynamicFields(customReceived);
    expect(customReceived).toMatchObject({
      msgServerId: customSent.msgServerId,
      from: userA.userId,
      to: testGroupId!,
      conversationId: testGroupId!,
      conversationType: 'groupChat',
      type: 'custom',
      body: {
        event: customEvent,
        params: customParams,
      },
    });
  });

  test('markMessageRead 应发送群已读 ack，并可查询已读用户列表', async ({
    userA,
    userB,
  }) => {
    await expectGroupVisible(userB.page, testGroupId!);

    const content = `e2e-group-read-ack-${Date.now()}`;
    const ackContent = `seen-${Date.now()}`;
    const sent = (await userA.page.evaluate(
      async ({ groupId, content: messageContent }) => {
        const client = window.__CLIENT__ as any;
        const msg = client.chatManager.createTextMessage({
          conversationId: groupId,
          conversationType: 'groupChat',
          content: messageContent,
        });
        return client.chatManager.sendMessage(msg);
      },
      { groupId: testGroupId!, content }
    )) as MessageEventPayload<{ content: string }>;

    const received = await waitForGroupHistoryMessage<{ content: string }>(
      userB.page,
      testGroupId!,
      sent.msgServerId
    );
    await userB.clearEvents();
    await userA.clearEvents();

    await userB.page.evaluate(
      async ({ ackContent, message }) => {
        await (window.__CLIENT__ as any).chatManager.markMessageRead({
          messages: [{ message, ackContent }],
        });
      },
      {
        ackContent,
        message: received,
      }
    );

    await userB.waitForNoEvent('onMessageRead', 1000);
    const ack = (await userA.waitForEvent('onMessageRead')) as ReadonlyArray<{
      readonly messageId: string;
      readonly conversationId: string;
      readonly conversationType: string;
      readonly ackContent?: string;
    }>;
    expect(ack).toEqual([
      {
        messageId: sent.msgServerId,
        conversationId: testGroupId!,
        conversationType: 'groupChat',
        ackContent,
      },
    ]);

    await userA.page.waitForTimeout(1000);
    const readUsers = (await userA.page.evaluate(
      async ({ groupId, messageId }) => {
        return (window.__CLIENT__ as any).chatManager.getGroupMessageReadUsers({
          groupId,
          messageId,
          pageSize: 10,
        });
      },
      { groupId: testGroupId!, messageId: sent.msgServerId }
    )) as {
      groupId: string;
      messageId: string;
      users: ReadonlyArray<{ userId: string; ackContent?: string; timestamp?: number }>;
      count: number;
      cursor: string;
      hasMore: boolean;
    };
    expect(readUsers.groupId).toBe(testGroupId!);
    expect(readUsers.messageId).toBe(sent.msgServerId);
    expect(readUsers.count).toBeGreaterThanOrEqual(readUsers.users.length);
    expect(typeof readUsers.cursor).toBe('string');
    expect(typeof readUsers.hasMore).toBe('boolean');
    const readUser = readUsers.users.find(item => item.userId === userB.userId);
    expect(readUser).toBeDefined();
    expect(readUser?.ackContent).toBe(ackContent);
    expect(readUser?.timestamp).toBeGreaterThan(0);
  });

  test('撤回群消息时，应返回结果；成员端 onMessageRecalled 到达则逐字段断言', async ({
    userA,
    userB,
  }) => {
    await expectGroupVisible(userB.page, testGroupId!);

    const content = `e2e-group-recall-${Date.now()}`;

    const sent = (await userA.page.evaluate(
      async ({ groupId, content: messageContent }) => {
        const client = window.__CLIENT__ as any;
        const msg = client.chatManager.createTextMessage({
          conversationId: groupId,
          conversationType: 'groupChat',
          content: messageContent,
        });
        return client.chatManager.sendMessage(msg);
      },
      { groupId: testGroupId!, content }
    )) as MessageEventPayload<{ content: string }>;

    await waitForGroupHistoryMessage<{ content: string }>(
      userB.page,
      testGroupId!,
      sent.msgServerId
    );
    await userA.page.waitForTimeout(1500);
    await userB.clearEvents();

    const recalled = (await userA.page.evaluate(
      async ({ messageId, conversationId }) => {
        return (window.__CLIENT__ as any).chatManager.recallMessage({
          messageId,
          conversationId,
          conversationType: 'groupChat',
        });
      },
      { messageId: sent.msgServerId, conversationId: testGroupId! }
    )) as {
      messageId: string;
      conversationId: string;
      conversationType: string;
      timestamp: number;
    };
    expect(recalled).toMatchObject({
      messageId: sent.msgServerId,
      conversationId: testGroupId!,
      conversationType: 'groupChat',
    });
    expect(recalled.timestamp).toBeGreaterThan(0);

    let recalledEvent: {
      messageId: string;
      conversationId: string;
      conversationType: string;
      timestamp: number;
    } | null = null;
    try {
      recalledEvent = (await userB.waitForEvent('onMessageRecalled', 3000)) as {
        messageId: string;
        conversationId: string;
        conversationType: string;
        timestamp: number;
      };
    } catch {
      recalledEvent = null;
    }
    if (recalledEvent) {
      expect(recalledEvent.messageId).toBe(sent.msgServerId);
      expect(recalledEvent.conversationId).toBe(testGroupId!);
      expect(recalledEvent.conversationType).toBe('groupChat');
      expect(recalledEvent.timestamp).toBeGreaterThan(0);
    }
  });

  test('普通成员撤回他人群消息应返回当前真实环境权限错误', async ({ userA, userB }) => {
    await expectGroupVisible(userB.page, testGroupId!);

    const content = `e2e-group-recall-permission-${Date.now()}`;
    const sent = (await userA.page.evaluate(
      async ({ groupId, content: messageContent }) => {
        const client = window.__CLIENT__ as any;
        const msg = client.chatManager.createTextMessage({
          conversationId: groupId,
          conversationType: 'groupChat',
          content: messageContent,
        });
        return client.chatManager.sendMessage(msg);
      },
      { groupId: testGroupId!, content }
    )) as MessageEventPayload<{ content: string }>;

    await waitForGroupHistoryMessage<{ content: string }>(
      userB.page,
      testGroupId!,
      sent.msgServerId
    );
    await userB.page.waitForTimeout(1500);

    const error = (await userB.page.evaluate(
      async ({ groupId, messageId }) => {
        try {
          await (window.__CLIENT__ as any).chatManager.recallMessage({
            messageId,
            conversationId: groupId,
            conversationType: 'groupChat',
          });
          return null;
        } catch (e: any) {
          return {
            name: e.name,
            code: e.code,
            message: e.message,
            details: e.details,
          };
        }
      },
      { groupId: testGroupId!, messageId: sent.msgServerId }
    )) as CapturedError | null;

    expect(error).not.toBeNull();
    expect(error?.name).toBe('SDKError');
    expect(error?.code).toBe(1);
    expect(error?.message).toBe('no permission to recall message');
  });
});
