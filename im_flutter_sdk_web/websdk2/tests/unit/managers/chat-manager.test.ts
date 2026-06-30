import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatClient } from '@/chat-client';
import { ChatManager } from '@/managers/chat-manager';
import { ConnectionStatus } from '@/types';
import type { ChatEventHandlerMap, Message, RestContext } from '@/types';
import { RestClient } from '@/rest/client';
import { ERROR_CODES } from '@/utils/error-codes';
import {
  ConnectionError,
  NetworkError,
  RestBusinessError,
  RestTransportError,
  SDKError,
  ValidationError,
} from '@/utils/errors';

const resetSingleton = (): void => {
  (ChatClient as unknown as { instance: ChatClient | null }).instance = null;
};

const buildMessage = (overrides: Partial<Message> = {}): Message => {
  return {
    msgServerId: overrides.msgServerId ?? '',
    msgLocalId: overrides.msgLocalId ?? 'local-1',
    from: overrides.from ?? '',
    to: overrides.to ?? '',
    sender: overrides.sender ?? { userId: 'user-1' },
    conversationId: overrides.conversationId ?? 'user-2',
    conversationType: overrides.conversationType ?? 'singleChat',
    type: overrides.type ?? 'text',
    status: overrides.status ?? 'sending',
    ext: overrides.ext ?? {},
    timestamp: overrides.timestamp ?? 1,
    body: overrides.body ?? { content: 'hello' },
    direct: overrides.direct,
  };
};

describe('ChatManager', () => {
  beforeEach((): void => {
    resetSingleton();
  });

  afterEach((): void => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('should delegate sendMessage to client', async (): Promise<void> => {
    const client = ChatClient.init({ appKey: 'app-key' }).use(ChatManager);
    const message = buildMessage();
    const spy = vi.spyOn(client, 'sendMessage').mockResolvedValue(message);

    const result = await client.chatManager.sendMessage(message);

    expect(result).toBe(message);
    expect(spy).toHaveBeenCalledWith(message, undefined);
  });

  it('should register and remove event handlers via event context', (): void => {
    const client = ChatClient.init({ appKey: 'app-key' });
    const manager = new ChatManager();
    const addEventHandler = vi.fn();
    const removeEventHandler = vi.fn();
    const handlers: ChatEventHandlerMap = {
      onMessage: () => undefined,
      onConversationListUpdate: () => undefined,
    };

    manager.bind(client, {
      addEventHandler,
      removeEventHandler,
    });

    manager.addEventHandler('demo', handlers);
    manager.removeEventHandler('demo');

    expect(addEventHandler).toHaveBeenCalledWith('demo', handlers);
    expect(removeEventHandler).toHaveBeenCalledWith('demo');
  });

  it('should delegate current conversation state to cache manager', (): void => {
    const client = ChatClient.init({ appKey: 'app-key' });
    const manager = new ChatManager();
    const setCurrentConversation = vi.fn();
    const resetCurrentConversation = vi.fn();
    const getCurrentConversation = vi
      .fn()
      .mockReturnValue({ conversationId: 'user-2', type: 'singleChat' });

    manager.bind({
      ...client,
      getCacheManager: () => ({
        setCurrentConversation,
        resetCurrentConversation,
        getCurrentConversation,
      }),
    } as unknown as ChatClient);

    manager.setCurrentConversation({
      conversationId: 'user-2',
      conversationType: 'singleChat',
    });
    const current = manager.getCurrentConversation();
    manager.resetCurrentConversation();

    expect(setCurrentConversation).toHaveBeenCalledWith({
      conversationId: 'user-2',
      type: 'singleChat',
    });
    expect(current).toEqual({
      conversationId: 'user-2',
      conversationType: 'singleChat',
    });
    expect(resetCurrentConversation).toHaveBeenCalledTimes(1);
  });

  it('should throw when not bound to client', async (): Promise<void> => {
    const manager = new ChatManager();

    await expect(manager.sendMessage(buildMessage())).rejects.toThrow(ValidationError);
  });

  it('should throw when not bound to event context', (): void => {
    const client = ChatClient.init({ appKey: 'app-key' });
    const manager = new ChatManager();

    manager.bind(client);

    expect(() => manager.addEventHandler('demo', {})).toThrow(ValidationError);
  });

  it('should expose conversation api methods', (): void => {
    const manager = new ChatManager();

    expect(typeof manager.getConversationList).toBe('function');
    expect(typeof manager.deleteConversation).toBe('function');
    expect(typeof manager.setConversationPinned).toBe('function');
    expect(typeof manager.addConversationMark).toBe('function');
    expect(typeof manager.removeConversationMark).toBe('function');
    expect(typeof manager.setCurrentConversation).toBe('function');
    expect(typeof manager.resetCurrentConversation).toBe('function');
    expect(typeof manager.getCurrentConversation).toBe('function');
    expect(typeof manager.clearAllMessagesAndConversations).toBe('function');
    expect(typeof manager.pinMessage).toBe('function');
    expect(typeof manager.unpinMessage).toBe('function');
    expect(typeof manager.getPinnedMessageList).toBe('function');
    expect(typeof manager.voiceMessageToText).toBe('function');
    expect(typeof manager.voiceFileToText).toBe('function');
  });

  it('voiceMessageToText 对非法消息体应抛 ValidationError(407)', async (): Promise<void> => {
    const client = ChatClient.init({ appKey: 'app-key' });
    const manager = new ChatManager();

    manager.bind(client);

    await expect(
      manager.voiceMessageToText({
        type: 'text',
      } as never)
    ).rejects.toBeInstanceOf(ValidationError);

    await expect(
      manager.voiceMessageToText({
        type: 'text',
      } as never)
    ).rejects.toMatchObject({
      code: ERROR_CODES.VOICE_TO_TEXT_FILE_INVALID,
    });
  });

  it('voiceFileToText 在缺少 upload adapter 时应抛 SDKError', async (): Promise<void> => {
    const client = ChatClient.init({ appKey: 'app-key' }).use(ChatManager);

    await expect(
      client.chatManager.voiceFileToText({
        path: '/tmp/voice.amr',
        name: 'voice.amr',
        type: 'audio/amr',
      })
    ).rejects.toBeInstanceOf(SDKError);
  });

  it('deleteConversation 成功后应删除本地缓存并派发会话列表更新', async (): Promise<void> => {
    const context: RestContext = {
      restBaseUrl: 'https://api.example.com',
      appKey: 'org#app',
      userId: 'user-1',
      token: 'token',
      clientResource: 'web',
    };
    const client = ChatClient.init({ appKey: 'app-key' });
    const manager = new ChatManager();
    const deleteConversation = vi.fn().mockReturnValue({ items: [], changed: true });
    const emitConversationListUpdate = vi.fn();
    vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({});

    manager.bind({
      ...client,
      getRestContext: () => context,
      getCacheManager: () => ({ deleteConversation }),
      emitConversationListUpdate,
    } as unknown as ChatClient);

    const result = await manager.deleteConversation({
      conversationId: 'user-2',
      conversationType: 'singleChat',
      deleteRoamingMessages: true,
    });

    expect(result).toEqual({
      conversationId: 'user-2',
      conversationType: 'singleChat',
      operation: 'delete',
    });
    expect(deleteConversation).toHaveBeenCalledWith({
      conversationId: 'user-2',
      type: 'singleChat',
    });
    expect(emitConversationListUpdate).toHaveBeenCalledWith('local');
  });

  it('setConversationPinned 本地无变化时不应派发会话列表更新', async (): Promise<void> => {
    const context: RestContext = {
      restBaseUrl: 'https://api.example.com',
      appKey: 'org#app',
      userId: 'user-1',
      token: 'token',
      clientResource: 'web',
    };
    const client = ChatClient.init({ appKey: 'app-key' });
    const manager = new ChatManager();
    const applyConversationPinnedMutation = vi.fn().mockReturnValue({ items: [], changed: false });
    const emitConversationListUpdate = vi.fn();
    vi.spyOn(RestClient.prototype, 'post').mockResolvedValue({
      data: {
        is_top: true,
        update_top_status_time: 123,
      },
    });

    manager.bind({
      ...client,
      getRestContext: () => context,
      getCacheManager: () => ({ applyConversationPinnedMutation }),
      emitConversationListUpdate,
    } as unknown as ChatClient);

    await manager.setConversationPinned({
      conversationId: 'user-2',
      conversationType: 'singleChat',
      pinned: true,
    });

    expect(applyConversationPinnedMutation).toHaveBeenCalledWith({
      conversationId: 'user-2',
      type: 'singleChat',
      isPinned: true,
      pinnedTime: 123,
    });
    expect(emitConversationListUpdate).not.toHaveBeenCalled();
  });

  it('clearAllMessagesAndConversations 成功后应清空本地缓存并派发会话列表更新', async (): Promise<void> => {
    const context: RestContext = {
      restBaseUrl: 'https://api.example.com',
      appKey: 'org#app',
      userId: 'user-1',
      token: 'token',
      clientResource: 'web',
    };
    const client = ChatClient.init({ appKey: 'app-key' });
    const manager = new ChatManager();
    const clearConversations = vi.fn().mockReturnValue({ items: [], changed: true });
    const emitConversationListUpdate = vi.fn();
    vi.spyOn(RestClient.prototype, 'post').mockResolvedValue({ data: {} });

    manager.bind({
      ...client,
      getRestContext: () => context,
      getCacheManager: () => ({ clearConversations }),
      emitConversationListUpdate,
    } as unknown as ChatClient);

    await manager.clearAllMessagesAndConversations();

    expect(clearConversations).toHaveBeenCalledTimes(1);
    expect(emitConversationListUpdate).toHaveBeenCalledWith('local');
  });

  it('markConversationRead 应发送 action 并只派发本地会话列表更新', async (): Promise<void> => {
    const client = ChatClient.init({ appKey: 'app-key' });
    const manager = new ChatManager();
    const sendMessageAction = vi.fn().mockResolvedValue({
      protocolId: '1',
      serverId: '2',
      statusCode: 0,
    });
    const dispatch = vi.fn();
    const markConversationRead = vi.fn().mockReturnValue({ items: [], changed: true });
    const emitConversationListUpdate = vi.fn();

    manager.bind(
      {
        ...client,
        getConnectionState: () => ConnectionStatus.CONNECTED,
        sendMessageAction,
        getCacheManager: () => ({ markConversationRead }),
        emitConversationListUpdate,
      } as unknown as ChatClient,
      {
        addEventHandler: vi.fn(),
        removeEventHandler: vi.fn(),
        dispatch,
      }
    );

    await manager.markConversationRead({
      conversationId: 'user-2',
      conversationType: 'singleChat',
    });

    expect(sendMessageAction).toHaveBeenCalledTimes(1);
    expect(markConversationRead).toHaveBeenCalledWith({
      conversationId: 'user-2',
      type: 'singleChat',
    });
    expect(emitConversationListUpdate).toHaveBeenCalledWith('local');
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('markMessageRead 在未连接时应抛出 ConnectionError', async (): Promise<void> => {
    const client = ChatClient.init({ appKey: 'app-key' });
    const manager = new ChatManager();

    manager.bind(
      {
        ...client,
        getConnectionState: () => 'DISCONNECTED',
      } as unknown as ChatClient,
      {
        addEventHandler: vi.fn(),
        removeEventHandler: vi.fn(),
      }
    );

    await expect(
      manager.markMessageRead({
        messages: [
          {
            message: buildMessage({
              msgServerId: 'msg-1',
              conversationId: 'user-2',
              conversationType: 'singleChat',
              direct: 'RECEIVE',
            }),
          },
        ],
      })
    ).rejects.toBeInstanceOf(ConnectionError);
  });

  it('markMessageRead 应逐条发送同一会话内的消息已读回执', async (): Promise<void> => {
    const client = ChatClient.init({ appKey: 'app-key' });
    const manager = new ChatManager();
    const sendMessageAction = vi.fn().mockResolvedValue({ ok: true });

    manager.bind(
      {
        ...client,
        getConnectionState: () => ConnectionStatus.CONNECTED,
        sendMessageAction,
      } as unknown as ChatClient,
      {
        addEventHandler: vi.fn(),
        removeEventHandler: vi.fn(),
      }
    );

    await manager.markMessageRead({
      messages: [
        {
          message: buildMessage({
            msgServerId: 'msg-1',
            conversationId: 'group-1',
            conversationType: 'groupChat',
            direct: 'RECEIVE',
          }),
          ackContent: 'seen-1',
        },
        {
          message: buildMessage({
            msgServerId: 'msg-2',
            conversationId: 'group-1',
            conversationType: 'groupChat',
            direct: 'RECEIVE',
          }),
          ackContent: 'seen-2',
        },
      ],
    });

    expect(sendMessageAction).toHaveBeenNthCalledWith(
      1,
      {
        kind: 'groupMessageRead',
        conversationId: 'group-1',
        conversationType: 'groupChat',
        messageId: 'msg-1',
        ackContent: 'seen-1',
      },
      expect.any(Function)
    );
    expect(sendMessageAction).toHaveBeenNthCalledWith(
      2,
      {
        kind: 'groupMessageRead',
        conversationId: 'group-1',
        conversationType: 'groupChat',
        messageId: 'msg-2',
        ackContent: 'seen-2',
      },
      expect.any(Function)
    );
  });

  it('markMessageRead 应拒绝空消息列表且不发送 ack', async (): Promise<void> => {
    const client = ChatClient.init({ appKey: 'app-key' });
    const manager = new ChatManager();
    const sendMessageAction = vi.fn().mockResolvedValue({ ok: true });

    manager.bind(
      {
        ...client,
        getConnectionState: () => ConnectionStatus.CONNECTED,
        sendMessageAction,
      } as unknown as ChatClient,
      {
        addEventHandler: vi.fn(),
        removeEventHandler: vi.fn(),
      }
    );

    await expect(manager.markMessageRead({ messages: [] })).rejects.toBeInstanceOf(
      ValidationError
    );
    expect(sendMessageAction).not.toHaveBeenCalled();
  });

  it('markMessageRead 应拒绝跨会话消息且不发送 ack', async (): Promise<void> => {
    const client = ChatClient.init({ appKey: 'app-key' });
    const manager = new ChatManager();
    const sendMessageAction = vi.fn().mockResolvedValue({ ok: true });

    manager.bind(
      {
        ...client,
        getConnectionState: () => ConnectionStatus.CONNECTED,
        sendMessageAction,
      } as unknown as ChatClient,
      {
        addEventHandler: vi.fn(),
        removeEventHandler: vi.fn(),
      }
    );

    await expect(
      manager.markMessageRead({
        messages: [
          {
            message: buildMessage({
              msgServerId: 'msg-1',
              conversationId: 'user-2',
              conversationType: 'singleChat',
              direct: 'RECEIVE',
            }),
          },
          {
            message: buildMessage({
              msgServerId: 'msg-2',
              conversationId: 'user-3',
              conversationType: 'singleChat',
              direct: 'RECEIVE',
            }),
          },
        ],
      })
    ).rejects.toBeInstanceOf(ValidationError);
    expect(sendMessageAction).not.toHaveBeenCalled();
  });

  it('markMessageRead 应拒绝单聊 ackContent 且不发送 ack', async (): Promise<void> => {
    const client = ChatClient.init({ appKey: 'app-key' });
    const manager = new ChatManager();
    const sendMessageAction = vi.fn().mockResolvedValue({ ok: true });

    manager.bind(
      {
        ...client,
        getConnectionState: () => ConnectionStatus.CONNECTED,
        sendMessageAction,
      } as unknown as ChatClient,
      {
        addEventHandler: vi.fn(),
        removeEventHandler: vi.fn(),
      }
    );

    await expect(
      manager.markMessageRead({
        messages: [
          {
            message: buildMessage({
              msgServerId: 'msg-1',
              conversationId: 'user-2',
              conversationType: 'singleChat',
              direct: 'RECEIVE',
            }),
            ackContent: 'seen',
          },
        ],
      })
    ).rejects.toBeInstanceOf(ValidationError);
    expect(sendMessageAction).not.toHaveBeenCalled();
  });

  it('getHistoryMessages 应返回标准化历史消息分页对象', async (): Promise<void> => {
    const context: RestContext = {
      restBaseUrl: 'https://api.example.com',
      appKey: 'org#app',
      userId: 'user-1',
      token: 'token',
      clientResource: 'web',
    };
    const decodedMessage = {
      ...buildMessage(),
      msgServerId: 'history-1',
      status: 'sent',
    };
    const decodeServerMessageMeta = vi.fn(() => decodedMessage);
    const client = {
      getRestContext: () => context,
      decodeServerMessageMeta,
    } as unknown as ChatClient;
    const manager = new ChatManager();

    vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({
      data: {
        msgs: [
          {
            msg: Buffer.from([1, 2, 3]).toString('base64'),
          },
        ],
        next_key: 'cursor-2',
        is_last: false,
      },
    });

    manager.bind(client);

    const result = await manager.getHistoryMessages({
      conversationId: 'user-2',
      conversationType: 'singleChat',
      cursor: 'cursor-1',
      pageSize: 20,
    });

    expect(decodeServerMessageMeta).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]));
    expect(result).toEqual({
      items: [decodedMessage],
      cursor: 'cursor-2',
      hasMore: true,
    });
  });

  it('getHistoryMessages 应将 next_key 为字符串 undefined 归一化为空 cursor', async (): Promise<void> => {
    const context: RestContext = {
      restBaseUrl: 'https://api.example.com',
      appKey: 'org#app',
      userId: 'user-1',
      token: 'token',
      clientResource: 'web',
    };
    const decodedMessage = {
      ...buildMessage(),
      msgServerId: 'history-2',
      status: 'sent',
    };
    const decodeServerMessageMeta = vi.fn(() => decodedMessage);
    const client = {
      getRestContext: () => context,
      decodeServerMessageMeta,
    } as unknown as ChatClient;
    const manager = new ChatManager();

    vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({
      data: {
        msgs: [
          {
            msg: Buffer.from([4, 5, 6]).toString('base64'),
          },
        ],
        next_key: 'undefined',
        is_last: true,
      },
    });

    manager.bind(client);

    const result = await manager.getHistoryMessages({
      conversationId: 'user-2',
      conversationType: 'singleChat',
      pageSize: 20,
    });

    expect(decodeServerMessageMeta).toHaveBeenCalledWith(new Uint8Array([4, 5, 6]));
    expect(result).toEqual({
      items: [decodedMessage],
      cursor: '',
      hasMore: false,
    });
  });

  it('getHistoryMessages 响应缺少 data 时应抛出 RestBusinessError', async (): Promise<void> => {
    const context: RestContext = {
      restBaseUrl: 'https://api.example.com',
      appKey: 'org#app',
      userId: 'user-1',
      token: 'token',
      clientResource: 'web',
    };
    const client = {
      getRestContext: () => context,
      decodeServerMessageMeta: vi.fn(),
    } as unknown as ChatClient;
    const manager = new ChatManager();

    vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({
      action: 'get message roaming',
    });

    manager.bind(client);

    await expect(
      manager.getHistoryMessages({
        conversationId: 'user-2',
        conversationType: 'singleChat',
      })
    ).rejects.toMatchObject({
      name: 'RestBusinessError',
      code: ERROR_CODES.REST_BUSINESS_UNKNOWN,
    });
  });

  it('downloadAttachment 与 downloadAndParseCombineMessage 应委托客户端并返回结果', async (): Promise<void> => {
    const attachmentResult = {
      filename: 'a.png',
      mimeType: 'image/png',
      size: 10,
      data: new Uint8Array([1, 2, 3]),
      downloadUrl: 'https://cdn.example.com/a.png',
    };
    const combineResult = [
      {
        ...buildMessage(),
        msgServerId: 'combine-1',
        status: 'sent',
      },
    ];
    const downloadAttachment = vi.fn(async () => attachmentResult);
    const downloadAndParseCombinePayload = vi.fn(async () => combineResult);
    const client = {
      downloadAttachment,
      downloadAndParseCombinePayload,
    } as unknown as ChatClient;
    const manager = new ChatManager();

    manager.bind(client);

    const attachment = await manager.downloadAttachment({
      message: {
        ...buildMessage(),
        type: 'image',
        status: 'sent',
        body: {
          localUrl: '',
          filename: 'a.png',
          filetype: 'image/png',
          width: 1,
          height: 1,
          isGif: false,
          isOriginalImage: true,
          originalImageUrl: 'https://cdn.example.com/a.png',
          secret: 'secret',
        },
      },
    });
    const combined = await manager.downloadAndParseCombineMessage({
      message: {
        ...buildMessage(),
        type: 'combine',
        status: 'sent',
        body: {
          title: 'combine',
          summary: '1',
          compatibleText: '[聊天记录]',
          filename: 'combine',
          filetype: 'application/octet-stream',
          url: 'https://cdn.example.com/combine',
          secret: 'combine-secret',
        },
      },
      timeoutMs: 1000,
      maxItems: 20,
    });
    const combinedFromParams = await manager.downloadAndParseCombineMessage({
      url: 'https://cdn.example.com/combine-from-body',
      secret: 'body-secret',
      timeoutMs: 2000,
      maxItems: 30,
    });

    expect(downloadAttachment).toHaveBeenCalledWith(expect.objectContaining({ type: 'image' }));
    expect(attachment).toEqual(attachmentResult);
    expect(downloadAndParseCombinePayload).toHaveBeenCalledWith({
      url: 'https://cdn.example.com/combine',
      secret: 'combine-secret',
      timeoutMs: 1000,
      maxItems: 20,
    });
    expect(downloadAndParseCombinePayload).toHaveBeenCalledWith({
      url: 'https://cdn.example.com/combine-from-body',
      secret: 'body-secret',
      timeoutMs: 2000,
      maxItems: 30,
    });
    expect(combined).toEqual(combineResult);
    expect(combinedFromParams).toEqual(combineResult);
  });

  it('translateMessage 应委托 REST 翻译并返回标准化结果', async (): Promise<void> => {
    const context: RestContext = {
      restBaseUrl: 'https://api.example.com',
      appKey: 'org#app',
      userId: 'user-1',
      token: 'token',
      clientResource: 'web',
    };
    const client = {
      getRestContext: () => context,
    } as unknown as ChatClient;
    const manager = new ChatManager();

    vi.spyOn(RestClient.prototype, 'request').mockResolvedValue([
      {
        detectedLanguage: {
          language: 'zh-Hans',
          score: 0.9,
        },
        translations: [{ text: 'hello', to: 'en' }],
      },
    ]);

    manager.bind(client);

    const result = await manager.translateMessage({
      message: {
        ...buildMessage(),
        type: 'text',
        body: { content: '你好' },
      },
      targetLanguages: ['en'],
    });

    expect(result.translations).toEqual([{ text: 'hello', to: 'en' }]);
  });

  it('modifyMessage 返回和本地事件应携带 modifiedInfo', async (): Promise<void> => {
    vi.spyOn(Date, 'now').mockReturnValue(1714291200000);
    const sendMessageAction = vi.fn().mockResolvedValue({
      protocolId: 'action-1',
      serverId: 'msg-1',
      statusCode: 0,
    });
    const dispatch = vi.fn();
    const client = {
      getConnectionState: () => ConnectionStatus.CONNECTED,
      getCurrentUserId: () => 'user-1',
      sendMessageAction,
    } as unknown as ChatClient;
    const manager = new ChatManager();

    manager.bind(client, {
      addEventHandler: vi.fn(),
      removeEventHandler: vi.fn(),
      dispatch,
    });

    const result = await manager.modifyMessage({
      conversationId: 'user-2',
      conversationType: 'singleChat',
      messageId: 'msg-1',
      message: {
        type: 'text',
        body: { content: 'updated text' },
        ext: { edited: true },
      },
    });

    expect(result.modifiedInfo).toEqual({
      operatorId: 'user-1',
      operationCount: 1,
      operationTime: 1714291200000,
    });
    expect(dispatch).toHaveBeenCalledWith(
      'onMessageUpdated',
      expect.objectContaining({
        messageId: 'msg-1',
        message: expect.objectContaining({
          modifiedInfo: result.modifiedInfo,
        }),
      })
    );
  });

  it('modifyMessage 对不支持编辑的类型应返回 OPERATION_UNSUPPORTED', async (): Promise<void> => {
    const client = ChatClient.init({ appKey: 'app-key' });
    const manager = new ChatManager();

    manager.bind(client, {
      addEventHandler: vi.fn(),
      removeEventHandler: vi.fn(),
      dispatch: vi.fn(),
    });

    await expect(
      manager.modifyMessage({
        conversationId: 'user-2',
        conversationType: 'singleChat',
        messageId: 'msg-1',
        message: {
          type: 'image',
          body: {
            localUrl: '',
            filename: 'a.png',
            filetype: 'image/png',
            width: 1,
            height: 1,
            isGif: false,
            isOriginalImage: true,
          },
          ext: {},
        },
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.OPERATION_UNSUPPORTED,
    });
  });

  it('getReactionList 在群聊场景缺少 groupId 时应抛出 ValidationError', async (): Promise<void> => {
    const client = ChatClient.init({ appKey: 'app-key' });
    const manager = new ChatManager();

    manager.bind(client);

    await expect(
      manager.getReactionList({
        messageId: 'msg-1',
        conversationType: 'groupChat',
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('getReactionList 响应 data 非数组时应抛出 RestBusinessError', async (): Promise<void> => {
    const context: RestContext = {
      restBaseUrl: 'https://api.example.com',
      appKey: 'org#app',
      userId: 'user-1',
      token: 'token',
      clientResource: 'web',
    };
    const client = {
      getRestContext: () => context,
    } as unknown as ChatClient;
    const manager = new ChatManager();

    vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({
      requestStatusCode: 'ok',
      data: {},
    });

    manager.bind(client);

    await expect(
      manager.getReactionList({
        messageId: 'msg-1',
        conversationType: 'singleChat',
      })
    ).rejects.toMatchObject({
      name: 'RestBusinessError',
      code: ERROR_CODES.REST_BUSINESS_UNKNOWN,
    });
  });

  it('getGroupMessageReadUsers 应返回标准化群消息已读对象', async (): Promise<void> => {
    const context: RestContext = {
      restBaseUrl: 'https://api.example.com',
      appKey: 'org#app',
      userId: 'user-1',
      token: 'token',
      clientResource: 'web',
    };
    const client = {
      getRestContext: () => context,
    } as unknown as ChatClient;
    const manager = new ChatManager();

    vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({
      data: {
        ackmid: 'msg-1',
        userlist: [
          {
            username: 'bob',
            meta_id: 'ack-1',
            timestamp: 1714291200000,
            ack_content: '{"test":1}',
          },
        ],
        total: 1,
        next_key: '',
        is_last: true,
      },
    });

    manager.bind(client);

    const result = await manager.getGroupMessageReadUsers({
      groupId: 'group-1',
      messageId: 'msg-1',
      cursor: 'cursor-1',
      pageSize: 10,
    });

    expect(result).toEqual({
      groupId: 'group-1',
      messageId: 'msg-1',
      users: [
        {
          userId: 'bob',
          user: { userId: 'bob' },
          ackId: 'ack-1',
          timestamp: 1714291200000,
          ackContent: '{"test":1}',
        },
      ],
      count: 1,
      cursor: '',
      hasMore: false,
    });
  });

  it('getReactionDetail 应返回标准化 Reaction 详情对象', async (): Promise<void> => {
    const context: RestContext = {
      restBaseUrl: 'https://api.example.com',
      appKey: 'org#app',
      userId: 'user-1',
      token: 'token',
      clientResource: 'web',
    };
    const client = {
      getRestContext: () => context,
    } as unknown as ChatClient;
    const manager = new ChatManager();

    vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({
      data: {
        reactionId: 'reaction-1',
        reaction: '👍',
        count: 2,
        state: true,
        userList: ['alice', 'bob'],
        cursor: null,
        reactionUserList: [
          {
            userId: 'alice',
            createdAt: '2026-04-28T08:28:15.854366Z',
          },
        ],
        createdAt: '2026-04-28T08:28:15.845395Z',
      },
    });

    manager.bind(client);

    const result = await manager.getReactionDetail({
      messageId: 'msg-1',
      reaction: '👍',
      cursor: 'cursor-1',
      pageSize: 20,
    });

    expect(result).toEqual({
      reaction: '👍',
      count: 2,
      isAddedBySelf: true,
      reactionUsers: [
        {
          userId: 'alice',
          user: { userId: 'alice' },
          createdAt: '2026-04-28T08:28:15.854366Z',
        },
      ],
      cursor: '',
      hasMore: false,
      createdAt: '2026-04-28T08:28:15.845395Z',
    });
  });

  it('markConversationRead 服务端返回 500 时应归一化为 ValidationError', async (): Promise<void> => {
    const client = ChatClient.init({ appKey: 'app-key' });
    const manager = new ChatManager();
    const sendMessageAction = vi.fn(async (_action, createAckError) => {
      throw (createAckError as (statusCode: number, reason?: string) => Error)(
        500,
        'conversation is empty'
      );
    });

    manager.bind(
      {
        ...client,
        getConnectionState: () => ConnectionStatus.CONNECTED,
        sendMessageAction,
      } as unknown as ChatClient,
      {
        addEventHandler: vi.fn(),
        removeEventHandler: vi.fn(),
        dispatch: vi.fn(),
      }
    );

    await expect(
      manager.markConversationRead({
        conversationId: 'user-2',
        conversationType: 'singleChat',
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('removeHistoryMessages 应将数量限制错误映射为 ValidationError', async (): Promise<void> => {
    const context: RestContext = {
      restBaseUrl: 'https://api.example.com',
      appKey: 'org#app',
      userId: 'user-1',
      token: 'token',
      clientResource: 'web',
    };
    const client = {
      getRestContext: () => context,
    } as unknown as ChatClient;
    const manager = new ChatManager();

    vi.spyOn(RestClient.prototype, 'request').mockRejectedValue(
      new RestBusinessError('delete msg list limit', {
        code: 112,
        details: {
          api: 'removeHistoryMessages',
          canonicalCode: 112,
        },
      })
    );

    manager.bind(client);

    await expect(
      manager.removeHistoryMessages({
        conversationId: 'group-1',
        conversationType: 'groupChat',
        messageIds: ['msg-1'],
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('getHistoryMessages 应将服务端 110 业务错误映射为 ValidationError', async (): Promise<void> => {
    const context: RestContext = {
      restBaseUrl: 'https://api.example.com',
      appKey: 'org#app',
      userId: 'user-1',
      token: 'token',
      clientResource: 'web',
    };
    const client = {
      getRestContext: () => context,
      decodeServerMessageMeta: vi.fn(),
    } as unknown as ChatClient;
    const manager = new ChatManager();

    vi.spyOn(RestClient.prototype, 'request').mockRejectedValue(
      new RestBusinessError('pull number cannot be greater', {
        code: 110,
        details: {
          api: 'getHistoryMessages',
          canonicalCode: 110,
        },
      })
    );

    manager.bind(client);

    await expect(
      manager.getHistoryMessages({
        conversationId: 'user-2',
        conversationType: 'singleChat',
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('getPinnedMessageList 应将服务端不支持错误映射为公开操作不支持错误', async (): Promise<void> => {
    const context: RestContext = {
      restBaseUrl: 'https://api.example.com',
      appKey: 'org#app',
      userId: 'user-1',
      token: 'token',
      clientResource: 'web',
    };
    const client = {
      getRestContext: () => context,
    } as unknown as ChatClient;
    const manager = new ChatManager();

    vi.spyOn(RestClient.prototype, 'request').mockRejectedValue(
      new RestBusinessError('not support pinned messages', {
        code: ERROR_CODES.OPERATION_UNSUPPORTED,
        details: {
          api: 'getPinnedMessageList',
          canonicalCode: ERROR_CODES.OPERATION_UNSUPPORTED,
          serverCode: 15002,
        },
      })
    );

    manager.bind(client);

    await expect(
      manager.getPinnedMessageList({
        conversationId: 'user-2',
        conversationType: 'singleChat',
      })
    ).rejects.toMatchObject({
      name: 'ValidationError',
      code: ERROR_CODES.OPERATION_UNSUPPORTED,
    });
  });

  it('getPinnedMessageList 应返回标准化置顶消息摘要对象', async (): Promise<void> => {
    const context: RestContext = {
      restBaseUrl: 'https://api.example.com',
      appKey: 'org#app',
      userId: 'user-1',
      token: 'token',
      clientResource: 'web',
    };
    const client = {
      getRestContext: () => context,
    } as unknown as ChatClient;
    const manager = new ChatManager();

    vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({
      data: {
        msg_infos: [
          {
            pin_opt_at: 1714291200000,
            pin_operator: 'alice',
            message: {
              id: 'pin-msg-1',
              timestamp: 1714291200000,
              payload: JSON.stringify({
                from: 'bob',
                to: 'user-2',
                ext: {},
                bodies: [
                  {
                    type: 'txt',
                    msg: 'hello',
                  },
                ],
              }),
            },
          },
        ],
        cursor: 'cursor-2',
      },
    });

    manager.bind(client);

    const result = await manager.getPinnedMessageList({
      conversationId: 'user-2',
      conversationType: 'singleChat',
    });

    expect(result).toEqual({
      items: [
        {
          messageId: 'pin-msg-1',
          conversationId: 'user-2',
          conversationType: 'singleChat',
          operatorId: 'alice',
          pinnedAt: 1714291200000,
          message: {
            msgServerId: 'pin-msg-1',
            msgLocalId: '',
            from: 'bob',
            to: 'user-2',
            sender: {
              userId: 'bob',
              nickname: undefined,
              avatarUrl: undefined,
            },
            conversationId: 'user-2',
            conversationType: 'singleChat',
            type: 'text',
            status: 'sent',
            ext: {},
            timestamp: 1714291200000,
            body: {
              content: 'hello',
            },
            direct: 'RECEIVE',
          },
        },
      ],
    });
  });

  it('getSupportedTranslationLanguages 应将 REST 传输错误映射为 NetworkError', async (): Promise<void> => {
    const context: RestContext = {
      restBaseUrl: 'https://api.example.com',
      appKey: 'org#app',
      userId: 'user-1',
      token: 'token',
      clientResource: 'web',
    };
    const client = {
      getRestContext: () => context,
    } as unknown as ChatClient;
    const manager = new ChatManager();

    vi.spyOn(RestClient.prototype, 'request').mockRejectedValue(
      new RestTransportError('network error', {
        code: ERROR_CODES.REST_NETWORK_ERROR,
      })
    );

    manager.bind(client);

    await expect(manager.getSupportedTranslationLanguages()).rejects.toBeInstanceOf(NetworkError);
  });

  it('getSupportedTranslationLanguages 响应结构非法时应抛出 RestBusinessError', async (): Promise<void> => {
    const context: RestContext = {
      restBaseUrl: 'https://api.example.com',
      appKey: 'org#app',
      userId: 'user-1',
      token: 'token',
      clientResource: 'web',
    };
    const client = {
      getRestContext: () => context,
    } as unknown as ChatClient;
    const manager = new ChatManager();

    vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({
      status: 'OK',
    });

    manager.bind(client);

    await expect(manager.getSupportedTranslationLanguages()).rejects.toMatchObject({
      name: 'RestBusinessError',
      code: ERROR_CODES.REST_BUSINESS_UNKNOWN,
    });
  });

  it('translateMessage 响应数据为空数组时应抛出 RestBusinessError', async (): Promise<void> => {
    const context: RestContext = {
      restBaseUrl: 'https://api.example.com',
      appKey: 'org#app',
      userId: 'user-1',
      token: 'token',
      clientResource: 'web',
    };
    const client = {
      getRestContext: () => context,
    } as unknown as ChatClient;
    const manager = new ChatManager();

    vi.spyOn(RestClient.prototype, 'request').mockResolvedValue({
      data: [],
    });

    manager.bind(client);

    await expect(
      manager.translateMessage({
        message: {
          ...buildMessage(),
          type: 'text',
          body: { content: 'hello' },
        },
        targetLanguages: ['zh-Hant'],
      })
    ).rejects.toMatchObject({
      name: 'RestBusinessError',
      code: ERROR_CODES.REST_BUSINESS_UNKNOWN,
    });
  });
});
