import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatClient } from '@/chat-client';
import { ConnectionStatus } from '@/types';

const resetSingleton = (): void => {
  (ChatClient as unknown as { instance: ChatClient | null }).instance = null;
};

const createJsonResponse = (data: unknown): Response => {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async (): Promise<unknown> => data,
    text: async (): Promise<string> => JSON.stringify(data),
  } as unknown as Response;
};

const prepareLoggedInClient = (): { client: ChatClient; renewSpy: ReturnType<typeof vi.fn> } => {
  const client = ChatClient.init({
    appKey: 'org#app',
    serviceConfig: {
      serverUrls: {
        restApiUrl: 'https://api.example.com',
        wsUrl: 'wss://msync.example.com/websocket',
      },
    },
  });
  const renewSpy = vi.fn((token: string, expireAt: number) => ({ token, expireAt }));
  const internal = client as unknown as {
    core: { renewToken: (token: string, expireAt: number) => { token: string; expireAt: number } };
    currentUserId: string;
    restBaseUrl: string;
    authToken: string;
    clientResource: string;
    state: string;
  };
  internal.core = { renewToken: renewSpy };
  internal.currentUserId = 'user-1';
  internal.restBaseUrl = 'https://api.example.com';
  internal.authToken = 'token-1';
  internal.clientResource = 'webim';
  internal.state = ConnectionStatus.CONNECTED;
  return { client, renewSpy };
};

describe('ChatClient token and RTC APIs', () => {
  beforeEach(() => {
    resetSingleton();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renewToken resolves expiration, updates auth context, and delegates to CoreSDK', async () => {
    const { client, renewSpy } = prepareLoggedInClient();
    const expireAt = Date.now() + 60_000;
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(createJsonResponse({ expire_timestamp: expireAt }));

    await expect(client.renewToken('token-2')).resolves.toEqual({
      token: 'token-2',
      expireAt,
    });

    expect(renewSpy).toHaveBeenCalledWith('token-2', expireAt);
    expect(client.getRestContext().token).toBe('token-2');
    const options = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    expect((options.headers as Record<string, string>).Authorization).toBe('Bearer token-2');
  });

  it('renewToken rejects disconnected clients before REST request', async () => {
    const client = ChatClient.init({ appKey: 'org#app' });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await expect(client.renewToken('token-2')).rejects.toThrow('ChatClient is not connected');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('getRTCTokenInfo requests current auth context and returns normalized result', async () => {
    const { client } = prepareLoggedInClient();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      createJsonResponse({
        app_id: 'rtc-app-id',
        rtc_token: 'rtc-token',
        channel_name: 'demo',
        rtcUid: 321,
        expires_in: 1778716800000,
      })
    );

    await expect(client.getRTCTokenInfo({ channelName: 'demo' })).resolves.toEqual({
      appId: 'rtc-app-id',
      rtcToken: 'rtc-token',
      channelName: 'demo',
      rtcUid: 321,
      expireAt: 1778716800000,
    });
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe(
      'https://api.example.com/org/app/users/user-1/token/rtc?channelName=demo'
    );
  });

  it('getUserIdsWithRTCUids validates, dedupes, and posts current auth context', async () => {
    const { client } = prepareLoggedInClient();
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(createJsonResponse({ data: { 123: 'user-a' } }));

    await expect(client.getUserIdsWithRTCUids([123, 123])).resolves.toEqual({ 123: 'user-a' });
    const options = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(options.body))).toEqual({ data: [123] });
    await expect(client.getUserIdsWithRTCUids([])).rejects.toThrow();
  });
});
