import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatClient } from '@/chat-client';
import { ChatManager } from '@/managers/chat-manager';
import type { Message } from '@/types';

import {
  type ClientWithChatManager,
  buildCombineMessage,
  buildFetchMock,
  buildImageMessage,
  buildTextMessage,
  createJsonResponse,
  primeConnectedCore,
  primeRestContext,
  resetSingleton,
} from './helpers';

describe('ChatManager message history integration', () => {
  const originalFetch = globalThis.fetch;
  let client: ClientWithChatManager;

  beforeEach(() => {
    resetSingleton();
    client = ChatClient.init({ appKey: 'org#app' }).use(ChatManager) as ClientWithChatManager;
    primeRestContext(client);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
    resetSingleton();
  });

  it('history/download/remove 应走真实 manager + RestClient 编排并返回业务对象', async () => {
    const decodedHistoryMessage = buildTextMessage({
      msgServerId: 'history-1',
      body: { content: 'history-message' },
    });
    const attachmentResult = {
      filename: 'a.png',
      mimeType: 'image/png',
      size: 10,
      data: new Uint8Array([1, 2, 3]),
      downloadUrl: 'https://cdn.example.com/a.png',
    };
    const combineMessages: ReadonlyArray<Message> = [
      buildTextMessage({
        msgServerId: 'combine-item-1',
        body: { content: 'combine-item' },
      }),
    ];
    const decodeServerMessageMeta = vi.fn(() => decodedHistoryMessage);
    const downloadAttachment = vi.fn(async () => attachmentResult);
    const downloadAndParseCombineMessage = vi.fn(async () => combineMessages);

    primeConnectedCore(client, {
      decodeServerMessageMeta,
      downloadAttachment,
      downloadAndParseCombineMessage,
    });

    globalThis.fetch = buildFetchMock(call => {
      if (call.url.pathname === '/org/app/users/alice/messageroaming') {
        expect(call.method).toBe('POST');
        expect(call.body).toEqual({
          queue: 'peer-1@easemob.com',
          start: 'cursor-1',
          pull_number: 10,
          is_positive: false,
          msgType: '',
          end: -1,
          startTime: null,
          endTime: null,
          userIds: null,
        });
        return createJsonResponse(200, {
          action: 'get message roaming',
          data: {
            user: 'alice@easemob.com',
            msgs: [
              {
                msg: Buffer.from([1, 2, 3]).toString('base64'),
              },
            ],
            queue: 'peer-1@easemob.com',
            next_key: 'undefined',
            is_last: true,
            timestamp: 1777363359151,
          },
          timestamp: 1777363359151,
        });
      }

      expect(call.method).toBe('DELETE');
      expect(call.url.pathname).toBe('/org/app/sdk/message/roaming/chat/user/alice');
      expect(call.url.searchParams.get('userId')).toBe('peer-1');
      expect(call.url.searchParams.get('msgIdList')).toBe('msg-1,msg-2');
      expect(call.url.searchParams.get('resource')).toBe('web');
      return createJsonResponse(200, {});
    });

    const history = await client.chatManager.getHistoryMessages({
      conversationId: 'peer-1',
      conversationType: 'singleChat',
      cursor: 'cursor-1',
      pageSize: 10,
    });
    const attachment = await client.chatManager.downloadAttachment({
      message: buildImageMessage(),
    });
    const combined = await client.chatManager.downloadAndParseCombineMessage({
      message: buildCombineMessage(),
    });
    await client.chatManager.removeHistoryMessages({
      conversationId: 'peer-1',
      conversationType: 'singleChat',
      messageIds: ['msg-1', 'msg-2'],
    });

    expect(decodeServerMessageMeta).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]));
    expect(history).toEqual({
      items: [decodedHistoryMessage],
      cursor: '',
      hasMore: false,
    });
    expect(downloadAttachment).toHaveBeenCalledWith(
      expect.objectContaining({ msgServerId: 'img-1' })
    );
    expect(attachment).toEqual(attachmentResult);
    expect(downloadAndParseCombineMessage).toHaveBeenCalledWith({
      url: 'https://cdn.example.com/combine',
      secret: 'secret',
    });
    expect(combined).toEqual(combineMessages);
  });
});
