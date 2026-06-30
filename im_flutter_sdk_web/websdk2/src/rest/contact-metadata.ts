/**
 * 联系人版本元数据查询
 */

import { RestClient } from './client';
import { parseAppKey } from '../upload/utils';
import { ERROR_CODES } from '../utils/error-codes';
import { SDKError, RestTransportError, ValidationError } from '../utils/errors';
import { isRecord } from '../cache/cache-utils';
import type { RestContext } from '../types/chat-client';

export interface ContactMetadataVersionResponse {
  readonly version: string;
  readonly requiresSync: boolean;
  readonly checkedAt: number;
}

const normalizeMetadataResponse = (
  payload: unknown,
  currentVersion: string
): ContactMetadataVersionResponse => {
  const checkedAt = Date.now();
  const pick = (record: Record<string, unknown>): ContactMetadataVersionResponse => {
    const version =
      typeof record.version === 'string'
        ? record.version
        : typeof record.rosterVersion === 'string'
          ? record.rosterVersion
          : '';
    const requiresSyncValue =
      typeof record.requiresSync === 'boolean'
        ? record.requiresSync
        : typeof record.needSync === 'boolean'
          ? record.needSync
          : typeof record.need_sync === 'boolean'
            ? record.need_sync
            : undefined;

    return {
      version,
      requiresSync: requiresSyncValue ?? version !== currentVersion,
      checkedAt:
        typeof record.checkedAt === 'number'
          ? record.checkedAt
          : typeof record.timestamp === 'number'
            ? record.timestamp
            : checkedAt,
    };
  };

  if (isRecord(payload)) {
    if (isRecord(payload.data)) {
      return pick(payload.data);
    }
    return pick(payload);
  }

  throw new ValidationError('Invalid contact metadata response', {
    code: ERROR_CODES.VALIDATION_INVALID_FORMAT,
    details: {
      payload,
    },
  });
};

export const fetchContactMetadataVersion = async (
  context: RestContext,
  currentVersion: string
): Promise<ContactMetadataVersionResponse> => {
  const { orgName, appName } = parseAppKey(context.appKey);
  const endpoint = `/${orgName}/${appName}/user/${encodeURIComponent(context.userId)}/roster/metadata/version`;
  const client = new RestClient(context.restBaseUrl);
  client.setAuthToken(context.token);

  try {
    const response = await client.get<unknown>(endpoint);
    return normalizeMetadataResponse(response, currentVersion);
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    const errorDetails =
      error instanceof SDKError && error.details ? (error.details as Record<string, unknown>) : {};
    throw new RestTransportError('Contact metadata request failed', {
      code: ERROR_CODES.CONTACT_SYNC_METADATA_FAILED,
      details: {
        stage: 'metadata',
        cause: error instanceof Error ? error.message : String(error),
        httpStatus:
          typeof errorDetails['httpStatus'] === 'number' ? errorDetails['httpStatus'] : undefined,
        sourceCode: error instanceof SDKError ? error.code : undefined,
      },
    });
  }
};
