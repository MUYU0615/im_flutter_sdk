import { isRecord } from '../cache/cache-utils';
import { parseAppKey } from '../upload/utils';
import { ERROR_CODES } from '../utils/error-codes';
import { ValidationError } from '../utils/errors';
import type { RestClient } from './client';
import type {
  GetRTCTokenInfoParams,
  RestContext,
  SelfIdsOnOtherPlatform,
  RTCTokenInfo,
  RTCUidUserIdMap,
} from '../types/chat-client';

const buildInvalidResponseError = (message: string): ValidationError => {
  return new ValidationError(message, {
    code: ERROR_CODES.VALIDATION_INVALID_FORMAT,
    details: {
      reason: 'invalid_rest_response',
    },
  });
};

const unwrapDataRecord = (payload: unknown): Record<string, unknown> => {
  if (!isRecord(payload)) {
    throw buildInvalidResponseError('Invalid REST response');
  }
  if (isRecord(payload.data)) {
    return payload.data;
  }
  return payload;
};

const readNumberField = (
  record: Record<string, unknown>,
  keys: ReadonlyArray<string>
): number | undefined => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return undefined;
};

const readStringField = (
  record: Record<string, unknown>,
  keys: ReadonlyArray<string>
): string | undefined => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string') {
      return value;
    }
  }
  return undefined;
};

const buildEndpointBase = (context: RestContext): string => {
  const { orgName, appName } = parseAppKey(context.appKey);
  return `/${orgName}/${appName}`;
};

export const normalizeTokenExpireAt = (payload: unknown): number => {
  const record = unwrapDataRecord(payload);
  const expireAt = readNumberField(record, ['expire_timestamp', 'expireTimestamp', 'expireAt']);
  if (expireAt === undefined) {
    throw buildInvalidResponseError('Invalid token expires response');
  }
  return expireAt;
};

export const normalizeRTCTokenInfo = (payload: unknown): RTCTokenInfo => {
  const record = unwrapDataRecord(payload);
  const appId = readStringField(record, ['app_id', 'appId']) ?? '';
  const rtcToken = readStringField(record, ['rtc_token', 'rtcToken', 'RTCToken']) ?? '';
  const channelName = readStringField(record, ['channel_name', 'channelName']) ?? '';
  const rtcUid = readNumberField(record, ['rtcUid', 'RTCUId', 'rtc_uid']) ?? 0;
  const expireAt = readNumberField(record, ['expires_in', 'expire', 'expireAt']) ?? 0;

  return {
    appId,
    rtcToken,
    channelName,
    rtcUid,
    expireAt,
  };
};

export const normalizeRTCUidUserIdMap = (payload: unknown): RTCUidUserIdMap => {
  const record = unwrapDataRecord(payload);
  const result: Record<number, string> = {};

  for (const [key, value] of Object.entries(record)) {
    const rtcUid = Number(key);
    if (!Number.isSafeInteger(rtcUid) || rtcUid < 0 || typeof value !== 'string') {
      continue;
    }
    result[rtcUid] = value;
  }

  return result;
};

export const normalizeSelfIdsOnOtherPlatform = (
  payload: unknown,
  context: RestContext
): SelfIdsOnOtherPlatform => {
  const items = isRecord(payload) && Array.isArray(payload.data) ? payload.data : [];
  const result: string[] = [];

  for (const item of items) {
    if (!isRecord(item)) {
      continue;
    }
    const resource = readStringField(item, ['res', 'resource', 'clientResource']);
    if (!resource || resource === context.clientResource) {
      continue;
    }
    result.push(`${context.userId}/${resource}`);
  }

  return result;
};

export const buildTokenExpiresEndpoint = (context: RestContext): string => {
  return `${buildEndpointBase(context)}/sdk/users/${encodeURIComponent(context.userId)}/token/expires`;
};

export const buildRTCTokenInfoEndpoint = (
  context: RestContext,
  params?: GetRTCTokenInfoParams
): string => {
  const channelName = params?.channelName ?? '*';
  const query = new URLSearchParams({ channelName });
  return `${buildEndpointBase(context)}/users/${encodeURIComponent(context.userId)}/token/rtc?${query.toString()}`;
};

export const buildRTCUidMapperEndpoint = (context: RestContext): string => {
  return `${buildEndpointBase(context)}/rtc_mapper/batch/get`;
};

export const buildSelfIdsOnOtherPlatformEndpoint = (context: RestContext): string => {
  return `${buildEndpointBase(context)}/users/${encodeURIComponent(context.userId)}/resources`;
};

export const requestTokenExpireAt = async (
  client: RestClient,
  context: RestContext
): Promise<number> => {
  const response = await client.get<unknown>(buildTokenExpiresEndpoint(context), {
    operation: 'getTokenExpireTimestamp',
  });
  return normalizeTokenExpireAt(response);
};

export const requestGetRTCTokenInfo = async (
  client: RestClient,
  context: RestContext,
  params?: GetRTCTokenInfoParams
): Promise<RTCTokenInfo> => {
  const response = await client.get<unknown>(buildRTCTokenInfoEndpoint(context, params), {
    operation: 'getRtcTokenInfo',
  });
  return normalizeRTCTokenInfo(response);
};

export const requestGetUserIdsWithRTCUids = async (
  client: RestClient,
  context: RestContext,
  rtcUids: ReadonlyArray<number>
): Promise<RTCUidUserIdMap> => {
  const response = await client.post<unknown>(
    buildRTCUidMapperEndpoint(context),
    { data: rtcUids },
    {
      operation: 'getUserIdsWithRtcUids',
    }
  );
  return normalizeRTCUidUserIdMap(response);
};

export const requestGetSelfIdsOnOtherPlatform = async (
  client: RestClient,
  context: RestContext
): Promise<SelfIdsOnOtherPlatform> => {
  const response = await client.get<unknown>(buildSelfIdsOnOtherPlatformEndpoint(context), {
    operation: 'getSelfIdsOnOtherPlatform',
  });
  return normalizeSelfIdsOnOtherPlatform(response, context);
};
