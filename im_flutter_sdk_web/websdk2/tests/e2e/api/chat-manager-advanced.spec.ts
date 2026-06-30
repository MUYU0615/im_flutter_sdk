/**
 * E2E 测试 - ChatManager 进阶公开 API
 */
import { test, expect } from '../fixtures/sdk-api';

type CapturedError = {
  readonly name: string;
  readonly code?: number;
  readonly message: string;
  readonly details?: unknown;
};

type MessagePayload<TBody extends Record<string, unknown>> = {
  readonly msgServerId: string;
  readonly msgLocalId: string;
  readonly from: string;
  readonly to: string;
  readonly conversationId: string;
  readonly conversationType: string;
  readonly type: string;
  readonly status: string;
  readonly body: TBody;
  readonly timestamp: number;
  readonly direct?: string;
  readonly combineLevel?: number;
};

const expectLocalMessageBase = (
  message: MessagePayload<Record<string, unknown>>,
  params: {
    readonly from: string;
    readonly to: string;
    readonly type: string;
  }
): void => {
  expect(message.msgServerId).toBe('');
  expect(message.msgLocalId.length).toBeGreaterThan(0);
  expect(message.timestamp).toBeGreaterThan(0);
  expect(message).toMatchObject({
    from: params.from,
    to: params.to,
    conversationId: params.to,
    conversationType: 'singleChat',
    type: params.type,
    status: 'sending',
    direct: 'SEND',
  });
};

test.describe('chat-manager/advanced - ChatManager 进阶 API', () => {
  test.beforeEach(async ({ userA, userB }) => {
    await userA.clearEvents();
    await userB.clearEvents();
  });

  test('createImage/File/Voice/Video/Combine 应创建精确消息体，并暴露参数校验 details', async ({
    userA,
    userB,
  }) => {
    const result = (await userA.page.evaluate((targetId: string) => {
      const client = window.__CLIENT__ as any;
      const base = {
        conversationId: targetId,
        conversationType: 'singleChat',
      };
      const text = client.chatManager.createTextMessage({
        ...base,
        content: 'combine-child',
      });
      const image = client.chatManager.createImageMessage({
        ...base,
        originalUrl: 'https://example.com/e2e-image.png?size=thumbnail',
        filename: 'e2e-image.png',
        filetype: 'image/png',
        width: 320,
        height: 240,
        fileLength: 1234,
      });
      const file = client.chatManager.createFileMessage({
        ...base,
        originalUrl: 'https://example.com/e2e-file.txt',
        filename: 'e2e-file.txt',
        filetype: 'text/plain',
        fileSize: 456,
        fileLength: 456,
      });
      const voice = client.chatManager.createVoiceMessage({
        ...base,
        originalUrl: 'https://example.com/e2e-voice.amr',
        filename: 'e2e-voice.amr',
        filetype: 'audio/amr',
        duration: 3,
        fileLength: 789,
      });
      const video = client.chatManager.createVideoMessage({
        ...base,
        originalUrl: 'https://example.com/e2e-video.mp4',
        filename: 'e2e-video.mp4',
        filetype: 'video/mp4',
        duration: 4,
        width: 640,
        height: 360,
        thumbnailUrl: 'https://example.com/e2e-video-thumb.jpg',
        fileLength: 2048,
      });
      const combine = client.chatManager.createCombineMessage({
        ...base,
        title: 'E2E 合并消息',
        summary: '1 条聊天记录',
        compatibleText: '[E2E 合并消息]',
        messageList: [text],
      });

      const capture = (factory: () => unknown) => {
        try {
          factory();
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
        image,
        file,
        voice,
        video,
        combine,
        imageError: capture(() =>
          client.chatManager.createImageMessage({
            ...base,
          })
        ),
        combineError: capture(() =>
          client.chatManager.createCombineMessage({
            ...base,
            title: 'empty',
            summary: 'empty',
            messageList: [],
          })
        ),
      };
    }, userB.userId)) as {
      image: MessagePayload<{
        originalImageUrl: string;
        bigImageUrl: string;
        thumbnailUrl: string;
        filename: string;
        filetype: string;
        width: number;
        height: number;
        isGif: boolean;
        isOriginalImage: boolean;
        fileLength: number;
      }>;
      file: MessagePayload<{
        url: string;
        filename: string;
        filetype: string;
        fileSize: number;
        fileLength: number;
      }>;
      voice: MessagePayload<{
        url: string;
        filename: string;
        filetype: string;
        duration: number;
        fileLength: number;
      }>;
      video: MessagePayload<{
        url: string;
        filename: string;
        filetype: string;
        duration: number;
        width: number;
        height: number;
        thumbnailUrl: string;
        fileLength: number;
      }>;
      combine: MessagePayload<{
        title: string;
        summary: string;
        compatibleText: string;
        filename: string;
        filetype: string;
        combineLevel: number;
        messageList: ReadonlyArray<MessagePayload<Record<string, unknown>>>;
      }>;
      imageError: CapturedError | null;
      combineError: CapturedError | null;
    };

    expectLocalMessageBase(result.image, { from: userA.userId, to: userB.userId, type: 'image' });
    expect(result.image.body).toMatchObject({
      originalImageUrl: 'https://example.com/e2e-image.png',
      bigImageUrl: 'https://example.com/e2e-image.png?size=large',
      thumbnailUrl: 'https://example.com/e2e-image.png?size=small',
      filename: 'e2e-image.png',
      filetype: 'image/png',
      width: 320,
      height: 240,
      isGif: false,
      isOriginalImage: false,
      fileLength: 1234,
    });

    expectLocalMessageBase(result.file, { from: userA.userId, to: userB.userId, type: 'file' });
    expect(result.file.body).toEqual({
      url: 'https://example.com/e2e-file.txt',
      filename: 'e2e-file.txt',
      filetype: 'text/plain',
      fileSize: 456,
      fileLength: 456,
    });

    expectLocalMessageBase(result.voice, { from: userA.userId, to: userB.userId, type: 'voice' });
    expect(result.voice.body).toEqual({
      url: 'https://example.com/e2e-voice.amr',
      filename: 'e2e-voice.amr',
      filetype: 'audio/amr',
      duration: 3,
      fileLength: 789,
    });

    expectLocalMessageBase(result.video, { from: userA.userId, to: userB.userId, type: 'video' });
    expect(result.video.body).toEqual({
      url: 'https://example.com/e2e-video.mp4',
      filename: 'e2e-video.mp4',
      filetype: 'video/mp4',
      duration: 4,
      width: 640,
      height: 360,
      thumbnailUrl: 'https://example.com/e2e-video-thumb.jpg',
      fileLength: 2048,
    });

    expectLocalMessageBase(result.combine, {
      from: userA.userId,
      to: userB.userId,
      type: 'combine',
    });
    expect(result.combine.combineLevel).toBe(1);
    expect(result.combine.body).toMatchObject({
      title: 'E2E 合并消息',
      summary: '1 条聊天记录',
      compatibleText: '[E2E 合并消息]',
      filename: 'combine',
      filetype: 'application/octet-stream',
      combineLevel: 1,
    });
    expect(result.combine.body.messageList).toHaveLength(1);
    expect(result.combine.body.messageList[0]).toMatchObject({
      from: userA.userId,
      to: userB.userId,
      type: 'text',
      body: { content: 'combine-child' },
    });

    expect(result.imageError).toMatchObject({
      name: 'ValidationError',
      code: 110,
      message: 'Validation failed: originalUrl: originalUrl or data is required',
      details: {
        fields: [
          {
            path: 'originalUrl',
            message: 'originalUrl or data is required',
            rule: 'custom',
          },
        ],
      },
    });
    expect(result.combineError).toMatchObject({
      name: 'ValidationError',
      code: 110,
      message: 'Validation failed: messageList: messageList must not be empty',
      details: {
        fields: [
          {
            path: 'messageList',
            message: 'messageList must not be empty',
            rule: 'too_small',
          },
        ],
      },
    });
  });

  test('基础消息创建 API 应返回精确 validation details', async ({ userA, userB }) => {
    const errors = (await userA.page.evaluate((targetId: string) => {
      const client = window.__CLIENT__ as any;
      const base = {
        conversationId: targetId,
        conversationType: 'singleChat',
      };
      const capture = (factory: () => unknown) => {
        try {
          factory();
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
        text: capture(() => client.chatManager.createTextMessage({ ...base, content: '' })),
        location: capture(() =>
          client.chatManager.createLocationMessage({
            ...base,
            latitude: 'invalid',
            longitude: 116.4074,
          })
        ),
        cmd: capture(() => client.chatManager.createCmdMessage({ ...base, action: '' })),
        custom: capture(() => client.chatManager.createCustomMessage({ ...base, event: '' })),
        file: capture(() => client.chatManager.createFileMessage({ ...base })),
        voice: capture(() =>
          client.chatManager.createVoiceMessage({
            ...base,
            originalUrl: 'https://example.com/e2e-voice.amr',
            duration: 0,
          })
        ),
        video: capture(() =>
          client.chatManager.createVideoMessage({
            ...base,
            originalUrl: 'https://example.com/e2e-video.mp4',
            duration: 0,
          })
        ),
      };
    }, userB.userId)) as Record<string, CapturedError | null>;

    expect(errors.text).toMatchObject({
      name: 'ValidationError',
      code: 110,
      message: 'Validation failed: content: content is required',
      details: {
        fields: [{ path: 'content', message: 'content is required', rule: 'too_small' }],
      },
    });
    expect(errors.location).toMatchObject({
      name: 'ValidationError',
      code: 110,
      message: 'Validation failed: latitude: Expected number, received string',
      details: {
        fields: [
          {
            path: 'latitude',
            message: 'Expected number, received string',
            rule: 'invalid_type',
          },
        ],
      },
    });
    expect(errors.cmd).toMatchObject({
      name: 'ValidationError',
      code: 110,
      message: 'Validation failed: action: action is required',
      details: {
        fields: [{ path: 'action', message: 'action is required', rule: 'too_small' }],
      },
    });
    expect(errors.custom).toMatchObject({
      name: 'ValidationError',
      code: 110,
      message: 'Validation failed: event: event is required',
      details: {
        fields: [{ path: 'event', message: 'event is required', rule: 'too_small' }],
      },
    });
    expect(errors.file).toMatchObject({
      name: 'ValidationError',
      code: 110,
      message: 'Validation failed: originalUrl: originalUrl or data is required',
      details: {
        fields: [
          {
            path: 'originalUrl',
            message: 'originalUrl or data is required',
            rule: 'custom',
          },
        ],
      },
    });
    expect(errors.voice).toMatchObject({
      name: 'ValidationError',
      code: 110,
      message: 'Validation failed: duration: duration must be positive',
      details: {
        fields: [{ path: 'duration', message: 'duration must be positive', rule: 'too_small' }],
      },
    });
    expect(errors.video).toMatchObject({
      name: 'ValidationError',
      code: 110,
      message: 'Validation failed: duration: duration must be positive',
      details: {
        fields: [{ path: 'duration', message: 'duration must be positive', rule: 'too_small' }],
      },
    });
  });

  test('markConversationRead 应发送会话已读 action 并让单聊对方收到 onConversationRead', async ({
    userA,
    userB,
  }) => {
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
      { targetId: userB.userId, content: `conversation-read-${Date.now()}` }
    )) as MessagePayload<{ content: string }>;
    await userB.waitForEventMatching<MessagePayload<{ content: string }>>(
      'onMessage',
      payload => payload.msgServerId === sent.msgServerId
    );
    await userB.clearEvents();
    await userA.clearEvents();

    await userB.page.evaluate(async (conversationId: string) => {
      await (window.__CLIENT__ as any).chatManager.markConversationRead({
        conversationId,
        conversationType: 'singleChat',
      });
    }, userA.userId);

    await userB.waitForNoEvent('onConversationRead', 1000);
    const event = (await userA.waitForEvent('onConversationRead')) as {
      conversationId: string;
      conversationType: string;
      timestamp: number;
    };
    expect(event).toMatchObject({
      conversationId: userB.userId,
      conversationType: 'singleChat',
    });
    expect(event.timestamp).toBeGreaterThan(0);
  });

  test('会话、已读、编辑、历史与置顶 API 应返回精确 validation details', async ({
    userA,
    userB,
  }) => {
    const errors = (await userA.page.evaluate(async (targetId: string) => {
      const client = window.__CLIENT__ as any;
      const sent = client.chatManager.createTextMessage({
        conversationId: targetId,
        conversationType: 'singleChat',
        content: 'validation-base',
      });
      const file = client.chatManager.createFileMessage({
        conversationId: targetId,
        conversationType: 'singleChat',
        originalUrl: 'https://example.com/e2e-file.txt',
        filename: 'e2e-file.txt',
        filetype: 'text/plain',
      });
      const capture = async (factory: () => Promise<unknown> | unknown) => {
        try {
          await factory();
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
        conversationMark: await capture(() =>
          client.chatManager.getConversationList({ mark: 20 })
        ),
        markConversationRead: await capture(() =>
          client.chatManager.markConversationRead({
            conversationId: '',
            conversationType: 'singleChat',
          })
        ),
        markMessageRead: await capture(() =>
          client.chatManager.markMessageRead({
            messages: [{ message: sent }],
          })
        ),
        modifyMedia: await capture(() =>
          client.chatManager.modifyMessage({
            messageId: 'local-only',
            conversationId: targetId,
            conversationType: 'singleChat',
            message: {
              type: file.type,
              body: file.body,
            },
          })
        ),
        historyPageSize: await capture(() =>
          client.chatManager.getHistoryMessages({
            conversationId: targetId,
            conversationType: 'singleChat',
            pageSize: 0,
          })
        ),
        groupReadUsersPageSize: await capture(() =>
          client.chatManager.getGroupMessageReadUsers({
            groupId: 'group-id',
            messageId: 'message-id',
            pageSize: 0,
          })
        ),
        pinMessage: await capture(() =>
          client.chatManager.pinMessage({
            conversationId: targetId,
            conversationType: 'singleChat',
            messageId: '',
          })
        ),
        pinnedList: await capture(() =>
          client.chatManager.getPinnedMessageList({
            conversationId: '',
            conversationType: 'singleChat',
          })
        ),
      };
    }, userB.userId)) as Record<string, CapturedError | null>;

    expect(errors.conversationMark).toMatchObject({
      name: 'ValidationError',
      code: 110,
      message: 'filter.mark must be an integer between 0 and 19',
      details: {
        fields: [
          {
            path: 'filter.mark',
            message: 'filter.mark must be an integer between 0 and 19',
            rule: 'invalid_format',
          },
        ],
      },
    });
    expect(errors.markConversationRead).toMatchObject({
      name: 'ValidationError',
      code: 110,
      message: 'conversationId is required',
      details: {
        fields: [
          {
            path: 'conversationId',
            message: 'conversationId is required',
            rule: 'required',
          },
        ],
      },
    });
    expect(errors.markMessageRead).toMatchObject({
      name: 'ValidationError',
      code: 110,
      message: 'message.msgServerId is required',
      details: {
        fields: [
          {
            path: 'message.msgServerId',
            message: 'message.msgServerId is required',
            rule: 'required',
          },
        ],
      },
    });
    expect(errors.modifyMedia).toMatchObject({
      name: 'ValidationError',
      code: 111,
      message: 'only text and custom messages are editable',
    });
    expect(errors.historyPageSize).toMatchObject({
      name: 'ValidationError',
      code: 110,
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
    expect(errors.groupReadUsersPageSize).toMatchObject({
      name: 'ValidationError',
      code: 110,
      message: 'pageSize must be a positive integer',
    });
    expect(errors.pinMessage).toMatchObject({
      name: 'ValidationError',
      code: 110,
      message: 'params.messageId is required',
      details: {
        fields: [
          {
            path: 'params.messageId',
            message: 'params.messageId is required',
            rule: 'required',
          },
        ],
      },
    });
    expect(errors.pinnedList).toMatchObject({
      name: 'ValidationError',
      code: 110,
      message: 'params.conversationId is required',
    });
  });

  test('removeHistoryMessages 应支持按 messageIds 清理漫游消息，并校验空参数', async ({
    userA,
    userB,
  }) => {
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
      { targetId: userB.userId, content: `remove-history-${Date.now()}` }
    )) as MessagePayload<{ content: string }>;
    await userB.waitForEventMatching<MessagePayload<{ content: string }>>(
      'onMessage',
      payload => payload.msgServerId === sent.msgServerId
    );

    const validationError = (await userB.page.evaluate(async (conversationId: string) => {
      try {
        await (window.__CLIENT__ as any).chatManager.removeHistoryMessages({
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
    }, userA.userId)) as CapturedError | null;
    expect(validationError).toMatchObject({
      name: 'ValidationError',
      code: 110,
      message: 'messageIds or beforeTimestamp is required',
      details: {
        fields: [
          {
            path: 'removeHistoryMessages',
            message: 'messageIds or beforeTimestamp is required',
            rule: 'required',
          },
        ],
      },
    });

    let before = { items: [] as ReadonlyArray<MessagePayload<Record<string, unknown>>> };
    for (let attempt = 0; attempt < 10; attempt += 1) {
      before = (await userB.page.evaluate(async (conversationId: string) => {
        return (window.__CLIENT__ as any).chatManager.getHistoryMessages({
          conversationId,
          conversationType: 'singleChat',
          pageSize: 20,
        });
      }, userA.userId)) as { items: ReadonlyArray<MessagePayload<Record<string, unknown>>> };
      if (before.items.some(item => item.msgServerId === sent.msgServerId)) {
        break;
      }
      await userB.page.waitForTimeout(1000);
    }
    expect(before.items.some(item => item.msgServerId === sent.msgServerId)).toBe(true);

    await userB.page.evaluate(
      async ({ conversationId, messageId }) => {
        await (window.__CLIENT__ as any).chatManager.removeHistoryMessages({
          conversationId,
          conversationType: 'singleChat',
          messageIds: [messageId],
        });
      },
      { conversationId: userA.userId, messageId: sent.msgServerId }
    );
    let after = before;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      after = (await userB.page.evaluate(async (conversationId: string) => {
        return (window.__CLIENT__ as any).chatManager.getHistoryMessages({
          conversationId,
          conversationType: 'singleChat',
          pageSize: 20,
        });
      }, userA.userId)) as { items: ReadonlyArray<MessagePayload<Record<string, unknown>>> };
      if (!after.items.some(item => item.msgServerId === sent.msgServerId)) {
        break;
      }
      await userB.page.waitForTimeout(1000);
    }
    expect(after.items.some(item => item.msgServerId === sent.msgServerId)).toBe(false);
  });

  test('pinMessage / unpinMessage / getPinnedMessageList 应返回一致置顶状态和事件', async ({
    userA,
    userB,
  }) => {
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
      { targetId: userB.userId, content: `pin-message-${Date.now()}` }
    )) as MessagePayload<{ content: string }>;

    const pinned = (await userA.page.evaluate(
      async ({ conversationId, messageId }) => {
        return (window.__CLIENT__ as any).chatManager.pinMessage({
          conversationId,
          conversationType: 'singleChat',
          messageId,
        });
      },
      { conversationId: userB.userId, messageId: sent.msgServerId }
    )) as undefined;
    expect(pinned).toBeUndefined();

    const pinEvent = (await userA.waitForEvent('onPinnedMessageChanged')) as {
      messageId: string;
      conversationId: string;
      conversationType: string;
      operation: string;
      operatorId: string;
      pinTime?: number;
    };
    expect(pinEvent).toMatchObject({
      messageId: sent.msgServerId,
      conversationId: userB.userId,
      conversationType: 'singleChat',
      operation: 'pin',
      operatorId: userA.userId,
    });
    expect(pinEvent.pinTime ?? 0).toBeGreaterThan(0);

    const listAfterPin = (await userA.page.evaluate(async (conversationId: string) => {
      return (window.__CLIENT__ as any).chatManager.getPinnedMessageList({
        conversationId,
        conversationType: 'singleChat',
      });
    }, userB.userId)) as {
      items: ReadonlyArray<{
        messageId: string;
        conversationId: string;
        conversationType: string;
        operatorId?: string;
        pinnedAt: number;
      }>;
    };
    const pinnedItem = listAfterPin.items.find(item => item.messageId === sent.msgServerId);
    expect(pinnedItem).toMatchObject({
      messageId: sent.msgServerId,
      conversationId: userB.userId,
      conversationType: 'singleChat',
    });
    expect(pinnedItem?.pinnedAt ?? 0).toBeGreaterThan(0);

    await userA.clearEvents();
    const unpinned = (await userA.page.evaluate(
      async ({ conversationId, messageId }) => {
        return (window.__CLIENT__ as any).chatManager.unpinMessage({
          conversationId,
          conversationType: 'singleChat',
          messageId,
        });
      },
      { conversationId: userB.userId, messageId: sent.msgServerId }
    )) as undefined;
    expect(unpinned).toBeUndefined();

    const unpinEvent = (await userA.waitForEvent('onPinnedMessageChanged')) as {
      messageId: string;
      conversationId: string;
      conversationType: string;
      operation: string;
      operatorId: string;
    };
    expect(unpinEvent).toEqual({
      messageId: sent.msgServerId,
      conversationId: userB.userId,
      conversationType: 'singleChat',
      operation: 'unpin',
      operatorId: userA.userId,
    });

    const listAfterUnpin = (await userA.page.evaluate(async (conversationId: string) => {
      return (window.__CLIENT__ as any).chatManager.getPinnedMessageList({
        conversationId,
        conversationType: 'singleChat',
      });
    }, userB.userId)) as { items: ReadonlyArray<{ messageId: string }> };
    expect(listAfterUnpin.items.some(item => item.messageId === sent.msgServerId)).toBe(false);
  });

  test('downloadAttachment / downloadAndParseCombineMessage 应精确拦截不支持的消息输入', async ({
    userA,
    userB,
  }) => {
    const errors = (await userA.page.evaluate((targetId: string) => {
      const client = window.__CLIENT__ as any;
      const text = client.chatManager.createTextMessage({
        conversationId: targetId,
        conversationType: 'singleChat',
        content: 'not-downloadable',
      });
      const combine = client.chatManager.createCombineMessage({
        conversationId: targetId,
        conversationType: 'singleChat',
        title: 'no-url',
        summary: 'no-url',
        messageList: [text],
      });
      const capture = async (factory: () => Promise<unknown>) => {
        try {
          await factory();
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
      return Promise.all([
        capture(() => client.chatManager.downloadAttachment({ message: text })),
        capture(() => client.chatManager.downloadAndParseCombineMessage({ message: text })),
        capture(() => client.chatManager.downloadAndParseCombineMessage({ message: combine })),
      ]);
    }, userB.userId)) as [CapturedError | null, CapturedError | null, CapturedError | null];

    expect(errors[0]).toMatchObject({
      name: 'ValidationError',
      code: 401,
      message: 'message does not contain downloadable attachment',
    });
    expect(errors[1]).toMatchObject({
      name: 'ValidationError',
      code: 110,
      message: 'message must be a combine message',
    });
    expect(errors[2]).toMatchObject({
      name: 'ValidationError',
      code: 110,
      message: 'Combine message url is required',
      details: {
        fields: [
          {
            path: 'url',
            message: 'Combine message url is required',
            rule: 'required',
          },
        ],
      },
    });
  });

  test('翻译 API 应覆盖语言列表、文本翻译与非文本 validation；服务未开通时记录当前错误结构', async ({
    userA,
    userB,
  }) => {
    const result = (await userA.page.evaluate(async (targetId: string) => {
      const client = window.__CLIENT__ as any;
      const text = client.chatManager.createTextMessage({
        conversationId: targetId,
        conversationType: 'singleChat',
        content: 'hello',
      });
      const file = client.chatManager.createFileMessage({
        conversationId: targetId,
        conversationType: 'singleChat',
        originalUrl: 'https://example.com/e2e-file.txt',
        filename: 'e2e-file.txt',
        filetype: 'text/plain',
      });
      const capture = async (factory: () => Promise<unknown>) => {
        try {
          return { ok: true, value: await factory() };
        } catch (e: any) {
          return {
            ok: false,
            error: {
              name: e.name,
              code: e.code,
              message: e.message,
              details: e.details,
            },
          };
        }
      };
      return {
        languages: await capture(() => client.chatManager.getSupportedTranslationLanguages()),
        translated: await capture(() =>
          client.chatManager.translateMessage({
            message: text,
            targetLanguages: ['en'],
          })
        ),
        unsupported: await capture(() =>
          client.chatManager.translateMessage({
            message: file,
            targetLanguages: ['en'],
          })
        ),
      };
    }, userB.userId)) as {
      languages:
        | { ok: true; value: ReadonlyArray<{ code: string; name: string; nativeName: string }> }
        | { ok: false; error: CapturedError };
      translated:
        | {
            ok: true;
            value: {
              detectedLanguage?: { language: string; score: number };
              translations: ReadonlyArray<{ text: string; to: string }>;
            };
          }
        | { ok: false; error: CapturedError };
      unsupported: { ok: false; error: CapturedError } | { ok: true; value: unknown };
    };

    if (result.languages.ok) {
      expect(Array.isArray(result.languages.value)).toBe(true);
      for (const language of result.languages.value) {
        expect(language.code.length).toBeGreaterThan(0);
        expect(language.name.length).toBeGreaterThan(0);
        expect(language.nativeName.length).toBeGreaterThan(0);
      }
    } else {
      expect(result.languages.error.name).toMatch(/^(RestBusinessError|SDKError|NetworkError)$/);
      expect(typeof result.languages.error.code).toBe('number');
      expect(result.languages.error.message.length).toBeGreaterThan(0);
    }

    if (result.translated.ok) {
      expect(Array.isArray(result.translated.value.translations)).toBe(true);
      expect(result.translated.value.translations.length).toBeGreaterThan(0);
      const [translation] = result.translated.value.translations;
      expect(translation).toBeDefined();
      if (!translation) {
        throw new Error('translateMessage should return at least one translation');
      }
      expect(translation).toMatchObject({ to: 'en' });
      expect(translation.text.length).toBeGreaterThan(0);
      if (result.translated.value.detectedLanguage) {
        expect(result.translated.value.detectedLanguage.language.length).toBeGreaterThan(0);
        expect(Number.isFinite(result.translated.value.detectedLanguage.score)).toBe(true);
      }
    } else {
      expect(result.translated.error.name).toMatch(
        /^(RestBusinessError|SDKError|ValidationError|NetworkError)$/
      );
      expect(typeof result.translated.error.code).toBe('number');
      expect(result.translated.error.message.length).toBeGreaterThan(0);
    }

    expect(result.unsupported).toMatchObject({
      ok: false,
      error: {
        name: 'ValidationError',
        code: 1110,
        message: 'only text messages can be translated',
      },
    });
  });

  test('voiceMessageToText / voiceFileToText 应覆盖确定性 validation 错误', async ({ userA }) => {
    const errors = (await userA.page.evaluate(async () => {
      const client = window.__CLIENT__ as any;
      const capture = async (factory: () => Promise<unknown>) => {
        try {
          await factory();
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
        invalidVoiceBody: await capture(() =>
          client.chatManager.voiceMessageToText({
            filename: 'bad.amr',
            filetype: 'audio/amr',
            duration: 1,
          })
        ),
        invalidVoiceParams: await capture(() =>
          client.chatManager.voiceMessageToText(
            {
              url: 'https://example.com/e2e-voice.amr',
              filename: 'e2e-voice.amr',
              filetype: 'audio/amr',
              duration: 1,
            },
            { sampleRate: '8000' }
          )
        ),
        invalidFile: await capture(() => client.chatManager.voiceFileToText({ name: 'bad.amr' })),
      };
    })) as {
      invalidVoiceBody: CapturedError | null;
      invalidVoiceParams: CapturedError | null;
      invalidFile: CapturedError | null;
    };

    expect(errors.invalidVoiceBody).toMatchObject({
      name: 'SDKError',
      code: 410,
      message: 'File not found',
      details: { path: 'voiceMessageBody.url' },
    });
    expect(errors.invalidVoiceParams).toMatchObject({
      name: 'ValidationError',
      code: 407,
      message: 'Invalid file',
      details: { path: 'voiceParams' },
    });
    expect(errors.invalidFile).toMatchObject({
      name: 'ValidationError',
      code: 407,
      message: 'Invalid file',
      details: { path: 'file' },
    });
  });
});
