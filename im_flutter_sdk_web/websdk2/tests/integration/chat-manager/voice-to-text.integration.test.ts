import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatClient } from '@/chat-client';
import { ChatManager } from '@/managers/chat-manager';
import type { ClientWithChatManager } from './helpers';
import { buildFetchMock, createJsonResponse, primeRestContext, resetSingleton } from './helpers';

describe('ChatManager voice-to-text integration', () => {
  let client: ClientWithChatManager;
  const originalFetch = globalThis.fetch;

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

  it('voiceMessageToText 应走真实 REST 链路并返回 { text }', async () => {
    globalThis.fetch = buildFetchMock(call => {
      expect(call.url.pathname).toBe('/api/sdk/v1/org/app/speech/transcriptions');
      expect(call.method).toBe('POST');
      expect(call.body).toEqual({
        data: {
          fileId: 'voice.amr',
          username: 'alice',
          audio: {
            format: 'amr',
          },
        },
      });
      return createJsonResponse(200, {
        data: {
          text: '毛泽东。',
        },
      });
    });

    const result = await client.chatManager.voiceMessageToText(
      {
        filename: 'voice.amr',
        filetype: 'audio/amr',
        duration: 1,
        url: 'https://cdn.example.com/path/voice.amr',
      },
      {
        format: 'amr',
      }
    );

    expect(result).toEqual({
      text: '毛泽东。',
    });
  });
});
