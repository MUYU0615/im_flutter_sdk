import { describe, expect, it, vi } from 'vitest';

import {
  buildRTCTokenInfoEndpoint,
  buildRTCUidMapperEndpoint,
  buildTokenExpiresEndpoint,
  normalizeRTCTokenInfo,
  normalizeRTCUidUserIdMap,
  normalizeTokenExpireAt,
  requestGetUserIdsWithRTCUids,
} from '@/rest/rtc-token';
import { RestClient } from '@/rest/client';
import type { RestContext } from '@/types';

const context: RestContext = {
  restBaseUrl: 'https://api.example.com',
  appKey: 'org#app',
  userId: 'user-1',
  token: 'token-1',
  clientResource: 'webim',
};

describe('rtc-token REST helpers', () => {
  it('normalizes token expiration timestamp', () => {
    expect(normalizeTokenExpireAt({ expire_timestamp: 1715600000000 })).toBe(1715600000000);
    expect(normalizeTokenExpireAt({ data: { expireAt: 1715600000001 } })).toBe(1715600000001);
  });

  it('normalizes RTC token response to lower camelCase', () => {
    expect(
      normalizeRTCTokenInfo({
        app_id: 'rtc-app-id',
        rtc_token: 'rtc-token',
        channel_name: 'demo',
        rtcUid: 123,
        expires_in: 1715600000000,
      })
    ).toEqual({
      appId: 'rtc-app-id',
      rtcToken: 'rtc-token',
      channelName: 'demo',
      rtcUid: 123,
      expireAt: 1715600000000,
    });
  });

  it('normalizes partial RTC UID mapping and omits invalid entries', () => {
    expect(
      normalizeRTCUidUserIdMap({
        data: {
          '123': 'user-a',
          '-1': 'invalid',
          abc: 'invalid',
          '456': 456,
        },
      })
    ).toEqual({ 123: 'user-a' });
  });

  it('builds endpoints using app key and default RTC channel', () => {
    expect(buildTokenExpiresEndpoint(context)).toBe('/org/app/sdk/users/user-1/token/expires');
    expect(buildRTCTokenInfoEndpoint(context)).toBe('/org/app/users/user-1/token/rtc?channelName=*');
    expect(buildRTCUidMapperEndpoint(context)).toBe('/org/app/rtc_mapper/batch/get');
  });

  it('posts RTC UID mapper body as { data: rtcUids }', async () => {
    const client = new RestClient(context.restBaseUrl);
    const postSpy = vi.spyOn(client, 'post').mockResolvedValue({ data: { 123: 'user-a' } });

    await expect(requestGetUserIdsWithRTCUids(client, context, [123])).resolves.toEqual({
      123: 'user-a',
    });
    expect(postSpy).toHaveBeenCalledWith(
      '/org/app/rtc_mapper/batch/get',
      { data: [123] },
      { operation: 'getUserIdsWithRtcUids' }
    );
  });
});
