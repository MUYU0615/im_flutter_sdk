import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatClient } from '@/chat-client';
import { ChatEventName } from '@/types';
import { ChatManager } from '@/managers/chat-manager';

import {
  type ClientWithChatManager,
  buildFetchMock,
  buildTextMessage,
  createJsonResponse,
  primeConnectedCore,
  primeRestContext,
  resetSingleton,
} from './helpers';

describe('ChatManager message auxiliary integration', () => {
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

  it('translate 应走真实 REST 链路，addEventHandler 应收到消息事件', async () => {
    const internal = primeConnectedCore(client);
    const onMessage = vi.fn();

    client.chatManager.addEventHandler('message-auxiliary', {
      onMessage,
    });

    globalThis.fetch = buildFetchMock(call => {
      if (call.url.pathname === '/org/app/users/alice/translate/support/language') {
        expect(call.method).toBe('GET');
        return createJsonResponse(200, [
          {
            code: 'en',
            name: 'English',
            nativeName: 'English',
          },
          {
            code: 'ja',
            name: 'Japanese',
            nativeName: 'Japanese',
          },
        ]);
      }

      expect(call.method).toBe('POST');
      expect(call.url.pathname).toBe('/org/app/users/alice/translate');
      expect(call.body).toEqual({
        text: '你好',
        to: ['en', 'ja'],
      });
      return createJsonResponse(200, {
        data: [
          {
            detectedLanguage: {
              language: 'zh-Hans',
              score: 0.99,
            },
            translations: [
              {
                text: 'hello',
                to: 'en',
              },
              {
                text: 'こんにちは',
                to: 'ja',
              },
            ],
          },
        ],
      });
    });

    const languages = await client.chatManager.getSupportedTranslationLanguages();
    const translated = await client.chatManager.translateMessage({
      message: buildTextMessage({
        body: { content: '你好' },
      }),
      targetLanguages: ['en', 'ja'],
    });

    const inbound = buildTextMessage({
      msgServerId: 'inbound-1',
      sender: { userId: 'peer-1' },
    });
    internal.eventHub.dispatch(ChatEventName.MESSAGE, inbound);

    expect(languages).toEqual([
      {
        code: 'en',
        name: 'English',
        nativeName: 'English',
      },
      {
        code: 'ja',
        name: 'Japanese',
        nativeName: 'Japanese',
      },
    ]);
    expect(translated).toEqual({
      detectedLanguage: {
        language: 'zh-Hans',
        score: 0.99,
      },
      translations: [
        {
          text: 'hello',
          to: 'en',
        },
        {
          text: 'こんにちは',
          to: 'ja',
        },
      ],
    });
    expect(onMessage).toHaveBeenCalledWith(inbound);
  });
});
