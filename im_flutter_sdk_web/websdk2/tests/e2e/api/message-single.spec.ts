/**
 * E2E 测试 - 单聊消息
 * 迁移自 robot: wayang/TestCase/消息/单聊.robot（Webim 标记用例）
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
  readonly ext?: Record<string, unknown>;
  readonly timestamp?: number;
  readonly localTime?: number;
};

type MessageHistoryPage<TBody extends Record<string, unknown>> = {
  readonly items: ReadonlyArray<MessageEventPayload<TBody>>;
  readonly cursor: string;
  readonly hasMore: boolean;
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

const waitForSingleHistoryMessages = async <TBody extends Record<string, unknown>>(
  page: Page,
  conversationId: string,
  messageIds: ReadonlyArray<string>
): Promise<MessageHistoryPage<TBody>> => {
  let history: MessageHistoryPage<TBody> = { items: [], cursor: '', hasMore: false };
  for (let attempt = 0; attempt < 15; attempt += 1) {
    history = (await page.evaluate(async ({ conversationId }) => {
      return (window.__CLIENT__ as any).chatManager.getHistoryMessages({
        conversationId,
        conversationType: 'singleChat',
        pageSize: 50,
      });
    }, { conversationId })) as MessageHistoryPage<TBody>;
    const historyIds = new Set(history.items.map(item => item.msgServerId));
    if (messageIds.every(messageId => historyIds.has(messageId))) {
      return history;
    }
    await page.waitForTimeout(1000);
  }
  throw new Error(
    `single history messages not found: expected=${messageIds.join(',')}; actual=${history.items
      .map(item => item.msgServerId)
      .join(',')}`
  );
};

test.describe('message/single-chat - 单聊消息', () => {
  test.beforeEach(async ({ userA, userB }) => {
    await userA.clearEvents();
    await userB.clearEvents();
  });

  test('发送文本消息应返回完整发送结果，接收端 onMessage 应包含文本消息体字段', async ({
    userA,
    userB,
  }) => {
    const content = `e2e-text-${Date.now()}`;

    const sent = (await userA.page.evaluate(
      async ({ targetId, content: messageContent }) => {
        const client = window.__CLIENT__ as any;
        const msg = client.chatManager.createTextMessage({
          conversationId: targetId,
          conversationType: 'singleChat',
          content: messageContent,
        });
        return client.chatManager.sendMessage(msg);
      },
      { targetId: userB.userId, content }
    )) as MessageEventPayload<{ content: string }>;
    expectMessageDynamicFields(sent);
    expect(sent).toMatchObject({
      from: userA.userId,
      to: userB.userId,
      conversationId: userB.userId,
      conversationType: 'singleChat',
      type: 'text',
      status: 'sent',
      body: { content },
    });

    const received = await userB.waitForEventMatching<MessageEventPayload<{ content: string }>>(
      'onMessage',
      payload => payload.msgServerId === sent.msgServerId
    );
    expect(received.msgServerId).toBe(sent.msgServerId);
    expectMessageDynamicFields(received);
    expect(received).toMatchObject({
      from: userA.userId,
      to: userB.userId,
      conversationId: userA.userId,
      conversationType: 'singleChat',
      type: 'text',
      body: { content },
    });
  });

  test('发送 cmd 消息时，接收端 onMessage 应带 action 字段', async ({ userA, userB }) => {
    const action = `e2e-cmd-${Date.now()}`;

    const sent = (await userA.page.evaluate(
      async ({ targetId, action: messageAction }) => {
        const client = window.__CLIENT__ as any;
        const msg = client.chatManager.createCmdMessage({
          conversationId: targetId,
          conversationType: 'singleChat',
          action: messageAction,
        });
        return client.chatManager.sendMessage(msg);
      },
      { targetId: userB.userId, action }
    )) as MessageEventPayload<{ action: string }>;
    expectMessageDynamicFields(sent);
    expect(sent).toMatchObject({
      from: userA.userId,
      to: userB.userId,
      conversationId: userB.userId,
      conversationType: 'singleChat',
      type: 'cmd',
      status: 'sent',
      body: { action },
    });

    const received = await userB.waitForEventMatching<MessageEventPayload<{ action: string }>>(
      'onMessage',
      payload => payload.msgServerId === sent.msgServerId
    );
    expect(received.msgServerId).toBe(sent.msgServerId);
    expectMessageDynamicFields(received);
    expect(received).toMatchObject({
      from: userA.userId,
      to: userB.userId,
      conversationId: userA.userId,
      conversationType: 'singleChat',
      type: 'cmd',
      body: { action },
    });
  });

  test('发送 location 消息时，收发两端都应带经纬度和地址字段', async ({ userA, userB }) => {
    const latitude = 39.9042;
    const longitude = 116.4074;
    const address = `location-${Date.now()}`;

    const sent = (await userA.page.evaluate(
      async ({ targetId, latitude: lat, longitude: lng, address: messageAddress }) => {
        const client = window.__CLIENT__ as any;
        const msg = client.chatManager.createLocationMessage({
          conversationId: targetId,
          conversationType: 'singleChat',
          latitude: lat,
          longitude: lng,
          address: messageAddress,
        });
        return client.chatManager.sendMessage(msg);
      },
      { targetId: userB.userId, latitude, longitude, address }
    )) as MessageEventPayload<{ latitude: number; longitude: number; address?: string }>;

    expectMessageDynamicFields(sent);
    expect(sent).toMatchObject({
      from: userA.userId,
      to: userB.userId,
      conversationId: userB.userId,
      conversationType: 'singleChat',
      type: 'location',
      status: 'sent',
      body: { latitude, longitude, address },
    });

    const received = await userB.waitForEventMatching<
      MessageEventPayload<{ latitude: number; longitude: number; address?: string }>
    >('onMessage', payload => {
      return payload.msgServerId === sent.msgServerId;
    });
    expectMessageDynamicFields(received);
    expect(received.msgServerId).toBe(sent.msgServerId);
    expect(received).toMatchObject({
      from: userA.userId,
      to: userB.userId,
      conversationId: userA.userId,
      conversationType: 'singleChat',
      type: 'location',
      body: { latitude, longitude, address },
    });
  });

  test('发送 custom 消息时，收发两端都应带 event/params', async ({ userA, userB }) => {
    const event = `e2e-custom-${Date.now()}`;
    const params = { key1: 'value1', key2: 'value2' };

    const sent = (await userA.page.evaluate(
      async ({ targetId, event: customEvent, params: customParams }) => {
        const client = window.__CLIENT__ as any;
        const msg = client.chatManager.createCustomMessage({
          conversationId: targetId,
          conversationType: 'singleChat',
          event: customEvent,
          params: customParams,
        });
        return client.chatManager.sendMessage(msg);
      },
      { targetId: userB.userId, event, params }
    )) as MessageEventPayload<{ event: string; params?: Record<string, string> }>;
    expectMessageDynamicFields(sent);
    expect(sent).toMatchObject({
      from: userA.userId,
      to: userB.userId,
      conversationId: userB.userId,
      conversationType: 'singleChat',
      type: 'custom',
      status: 'sent',
      body: { event, params },
    });

    const received = await userB.waitForEventMatching<
      MessageEventPayload<{ event: string; params?: Record<string, string> }>
    >('onMessage', payload => payload.msgServerId === sent.msgServerId);
    expectMessageDynamicFields(received);
    expect(received.msgServerId).toBe(sent.msgServerId);
    expect(received).toMatchObject({
      from: userA.userId,
      to: userB.userId,
      conversationId: userA.userId,
      conversationType: 'singleChat',
      type: 'custom',
      body: { event, params },
    });
  });

  test('modifyMessage 修改文本消息后，应返回更新后的消息并触发 onMessageUpdated', async ({
    userA,
    userB,
  }) => {
    const content = `editable-${Date.now()}`;
    const changedContent = `edited-${Date.now()}`;

    const sent = (await userA.page.evaluate(
      async ({ targetId, content: messageContent }) => {
        const client = window.__CLIENT__ as any;
        const msg = client.chatManager.createTextMessage({
          conversationId: targetId,
          conversationType: 'singleChat',
          content: messageContent,
        });
        return client.chatManager.sendMessage(msg);
      },
      { targetId: userB.userId, content }
    )) as MessageEventPayload<{ content: string }>;
    await userA.page.waitForTimeout(1000);
    await userA.clearEvents();

    const updated = (await userA.page.evaluate(
      async ({ messageId, conversationId, content: messageContent }) => {
        return (window.__CLIENT__ as any).chatManager.modifyMessage({
          messageId,
          conversationId,
          conversationType: 'singleChat',
          message: {
            type: 'text',
            body: { content: messageContent },
          },
        });
      },
      {
        messageId: sent.msgServerId,
        conversationId: userB.userId,
        content: changedContent,
      }
    )) as MessageEventPayload<{ content: string }>;

    expect(updated).toMatchObject({
      msgServerId: sent.msgServerId,
      from: userA.userId,
      to: userB.userId,
      conversationId: userB.userId,
      conversationType: 'singleChat',
      type: 'text',
      status: 'sent',
      body: { content: changedContent },
    });
    expectMessageDynamicFields(updated);

    const event = (await userA.waitForEvent('onMessageUpdated')) as {
      messageId: string;
      conversationId: string;
      conversationType: string;
      message: {
        type: string;
        body: { content: string };
      };
      timestamp: number;
    };
    expect(event).toMatchObject({
      messageId: sent.msgServerId,
      conversationId: userB.userId,
      conversationType: 'singleChat',
      message: {
        type: 'text',
        body: { content: changedContent },
      },
    });
    expect(event.timestamp).toBeGreaterThan(0);
  });

  test('modifyMessage 修改 custom 消息后，应保留 event/params/ext', async ({ userA, userB }) => {
    const originalEvent = `custom-edit-before-${Date.now()}`;
    const changedEvent = `custom-edit-after-${Date.now()}`;
    const changedParams = { version: '2', scene: 'e2e' };
    const changedExt = { editedBy: 'e2e' };

    const sent = (await userA.page.evaluate(
      async ({ targetId, event }) => {
        const client = window.__CLIENT__ as any;
        const msg = client.chatManager.createCustomMessage({
          conversationId: targetId,
          conversationType: 'singleChat',
          event,
          params: { version: '1' },
        });
        return client.chatManager.sendMessage(msg);
      },
      { targetId: userB.userId, event: originalEvent }
    )) as MessageEventPayload<{ event: string; params?: Record<string, string> }>;
    await userA.page.waitForTimeout(1000);
    await userA.clearEvents();

    const updated = (await userA.page.evaluate(
      async ({ messageId, conversationId, event, params, ext }) => {
        return (window.__CLIENT__ as any).chatManager.modifyMessage({
          messageId,
          conversationId,
          conversationType: 'singleChat',
          message: {
            type: 'custom',
            body: { event, params },
            ext,
          },
        });
      },
      {
        messageId: sent.msgServerId,
        conversationId: userB.userId,
        event: changedEvent,
        params: changedParams,
        ext: changedExt,
      }
    )) as MessageEventPayload<{ event: string; params?: Record<string, string> }>;

    expect(updated).toMatchObject({
      msgServerId: sent.msgServerId,
      from: userA.userId,
      to: userB.userId,
      conversationId: userB.userId,
      conversationType: 'singleChat',
      type: 'custom',
      status: 'sent',
      body: { event: changedEvent, params: changedParams },
      ext: changedExt,
    });
    expectMessageDynamicFields(updated);

    const eventPayload = (await userA.waitForEvent('onMessageUpdated')) as {
      messageId: string;
      conversationId: string;
      conversationType: string;
      message: {
        type: string;
        body: { event: string; params?: Record<string, string> };
        ext?: Record<string, string>;
      };
      timestamp: number;
    };
    expect(eventPayload).toMatchObject({
      messageId: sent.msgServerId,
      conversationId: userB.userId,
      conversationType: 'singleChat',
      message: {
        type: 'custom',
        body: { event: changedEvent, params: changedParams },
        ext: changedExt,
      },
    });
    expect(eventPayload.timestamp).toBeGreaterThan(0);
  });

  test('getHistoryMessages 应按类型过滤并保留消息顺序与动态字段', async ({ userA, userB }) => {
    const marker = `history-${Date.now()}`;
    const textContent = `${marker}-text`;
    const locationAddress = `${marker}-location`;
    const customEvent = `${marker}-custom`;

    const sent = (await userA.page.evaluate(
      async ({ targetId, textContent, locationAddress, customEvent }) => {
        const client = window.__CLIENT__ as any;
        const text = client.chatManager.createTextMessage({
          conversationId: targetId,
          conversationType: 'singleChat',
          content: textContent,
        });
        const location = client.chatManager.createLocationMessage({
          conversationId: targetId,
          conversationType: 'singleChat',
          latitude: 22.5431,
          longitude: 114.0579,
          address: locationAddress,
        });
        const custom = client.chatManager.createCustomMessage({
          conversationId: targetId,
          conversationType: 'singleChat',
          event: customEvent,
          params: { marker: customEvent },
        });
        return {
          text: await client.chatManager.sendMessage(text),
          location: await client.chatManager.sendMessage(location),
          custom: await client.chatManager.sendMessage(custom),
        };
      },
      {
        targetId: userB.userId,
        textContent,
        locationAddress,
        customEvent,
      }
    )) as {
      text: MessageEventPayload<{ content: string }>;
      location: MessageEventPayload<{ latitude: number; longitude: number; address?: string }>;
      custom: MessageEventPayload<{ event: string; params?: Record<string, string> }>;
    };

    await userB.waitForEventMatching<MessageEventPayload<Record<string, unknown>>>(
      'onMessage',
      payload => payload.msgServerId === sent.text.msgServerId
    );
    await userB.waitForEventMatching<MessageEventPayload<Record<string, unknown>>>(
      'onMessage',
      payload => payload.msgServerId === sent.location.msgServerId
    );
    await userB.waitForEventMatching<MessageEventPayload<Record<string, unknown>>>(
      'onMessage',
      payload => payload.msgServerId === sent.custom.msgServerId
    );

    const sentIds = [sent.text.msgServerId, sent.location.msgServerId, sent.custom.msgServerId];
    const history = await waitForSingleHistoryMessages<Record<string, unknown>>(
      userB.page,
      userA.userId,
      sentIds
    );

    expect(Array.isArray(history.items)).toBe(true);
    expect(typeof history.cursor).toBe('string');
    expect(typeof history.hasMore).toBe('boolean');
    const newestFirstIds = [sent.custom.msgServerId, sent.location.msgServerId, sent.text.msgServerId];
    const matched = history.items.filter(item => sentIds.includes(item.msgServerId));
    expect(matched.map(item => item.msgServerId)).toEqual(newestFirstIds);
    expect(matched[0]).toMatchObject({
      from: userA.userId,
      to: userB.userId,
      conversationId: userA.userId,
      conversationType: 'singleChat',
      type: 'custom',
      body: {
        event: customEvent,
        params: { marker: customEvent },
      },
    });
    expect(matched[1]).toMatchObject({
      from: userA.userId,
      to: userB.userId,
      conversationId: userA.userId,
      conversationType: 'singleChat',
      type: 'location',
      body: {
        latitude: 22.5431,
        longitude: 114.0579,
        address: locationAddress,
      },
    });
    expect(matched[2]).toMatchObject({
      from: userA.userId,
      to: userB.userId,
      conversationId: userA.userId,
      conversationType: 'singleChat',
      type: 'text',
      body: { content: textContent },
    });
    for (const item of matched) {
      expectMessageDynamicFields(item);
    }
  });

  test('markMessageRead 应发送单聊已读 action 并让发送方收到精确 ack payload', async ({ userA, userB }) => {
    const content = `read-ack-${Date.now()}`;

    const sent = (await userA.page.evaluate(
      async ({ targetId, content: messageContent }) => {
        const client = window.__CLIENT__ as any;
        const msg = client.chatManager.createTextMessage({
          conversationId: targetId,
          conversationType: 'singleChat',
          content: messageContent,
        });
        return client.chatManager.sendMessage(msg);
      },
      { targetId: userB.userId, content }
    )) as MessageEventPayload<{ content: string }>;

    const received = await userB.waitForEventMatching<MessageEventPayload<{ content: string }>>(
      'onMessage',
      payload => payload.msgServerId === sent.msgServerId
    );
    await userB.clearEvents();
    await userA.clearEvents();

    await userB.page.evaluate(async (message) => {
      await (window.__CLIENT__ as any).chatManager.markMessageRead({
        messages: [{ message }],
      });
    }, received);

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
        conversationId: userB.userId,
        conversationType: 'singleChat',
      },
    ]);
  });

  test('撤回单聊消息后，接收端应收到带会话字段的撤回事件', async ({ userA, userB }) => {
    const content = `to-be-recalled-${Date.now()}`;

    const sent = (await userA.page.evaluate(
      async ({ targetId, content: messageContent }) => {
        const client = window.__CLIENT__ as any;
        const msg = client.chatManager.createTextMessage({
          conversationId: targetId,
          conversationType: 'singleChat',
          content: messageContent,
        });
        return client.chatManager.sendMessage(msg);
      },
      { targetId: userB.userId, content }
    )) as MessageEventPayload<{ content: string }>;

    await userB.waitForEventMatching<MessageEventPayload<{ content: string }>>(
      'onMessage',
      payload => payload.msgServerId === sent.msgServerId
    );
    await userB.clearEvents();

    const recalledResult = (await userA.page.evaluate(
      async ({ messageId, conversationId }) => {
        return (window.__CLIENT__ as any).chatManager.recallMessage({
          messageId,
          conversationId,
          conversationType: 'singleChat',
        });
      },
      { messageId: sent.msgServerId, conversationId: userB.userId }
    )) as {
      messageId: string;
      conversationId: string;
      conversationType: string;
      timestamp: number;
    };
    expect(recalledResult).toMatchObject({
      messageId: sent.msgServerId,
      conversationId: userB.userId,
      conversationType: 'singleChat',
    });
    expect(recalledResult.timestamp).toBeGreaterThan(0);

    const recalled = (await userB.waitForEvent('onRecallMessage')) as {
      messageId: string;
      conversationId: string;
      conversationType: string;
      timestamp: number;
    };
    expect(recalled.messageId).toBe(sent.msgServerId);
    expect(recalled.conversationId).toBe(userA.userId);
    expect(recalled.conversationType).toBe('singleChat');
    expect(recalled.timestamp).toBeGreaterThan(0);
  });

  test('撤回不存在的单聊消息应返回当前真实环境错误结构', async ({ userA, userB }) => {
    const sent = (await userA.page.evaluate(
      async ({ targetId, content }) => {
        const client = window.__CLIENT__ as any;
        const msg = client.chatManager.createTextMessage({
          conversationId: targetId,
          conversationType: 'singleChat',
          content,
        });
        return client.chatManager.sendMessage(msg);
      },
      {
        targetId: userB.userId,
        content: `recall-missing-base-${Date.now()}`,
      }
    )) as MessageEventPayload<{ content: string }>;

    const error = (await userA.page.evaluate(
      async ({ conversationId, messageId }) => {
        try {
          await (window.__CLIENT__ as any).chatManager.recallMessage({
            messageId,
            conversationId,
            conversationType: 'singleChat',
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
      {
        conversationId: userB.userId,
        messageId: `${sent.msgServerId}999`,
      }
    )) as CapturedError | null;

    expect(error).not.toBeNull();
    expect(error?.name).toBe('SDKError');
    expect(error?.code).toBe(1);
    expect(error?.message).toBe('message not exist');
  });

  test('recallMessage 空 messageId 应在参数层返回 validation details', async ({ userA, userB }) => {
    const error = (await userA.page.evaluate(async ({ conversationId }) => {
      try {
        await (window.__CLIENT__ as any).chatManager.recallMessage({
          messageId: '',
          conversationId,
          conversationType: 'singleChat',
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
    }, { conversationId: userB.userId })) as CapturedError | null;

    expect(error).not.toBeNull();
    expect(error?.name).toBe('ValidationError');
    expect(error?.code).toBe(110);
    expect(error?.message).toBe('messageId is required');
    expect(error?.details).toMatchObject({
      fields: [
        {
          path: 'messageId',
          message: 'messageId is required',
          rule: 'required',
        },
      ],
    });
  });
});
