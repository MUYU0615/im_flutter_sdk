import { parseAppKey } from '../upload/utils';
import { ERROR_CODES } from '../utils/error-codes';
import { ValidationError } from '../utils/errors';
import type { RestContext } from '../types/chat-client';
import type { UserInfoSubscriptionResponseEnvelope } from '../types/user-info';
import { normalizeUserInfoTargetIds } from './user-info';

export const MAX_USER_INFO_SUBSCRIPTION_COUNT = 100;

const buildValidationError = (
  message: string,
  path: string,
  rule: 'required' | 'invalid_format' | 'range',
  code = ERROR_CODES.VALIDATION_INVALID_FORMAT
): ValidationError => {
  return new ValidationError(message, {
    code,
    details: {
      fields: [
        {
          path,
          message,
          rule,
        },
      ],
    },
  });
};

const buildSubscriptionBaseEndpoint = (context: RestContext): string => {
  const { orgName, appName } = parseAppKey(context.appKey);
  return `/${orgName}/${appName}/user/${encodeURIComponent(context.userId)}/metadata/subscription`;
};

const normalizeSubscriptionUserIds = (
  userIds: ReadonlyArray<string>,
  path = 'params.userIds'
): ReadonlyArray<string> => {
  return normalizeUserInfoTargetIds(userIds, path);
};

export const buildSubscribeUserInfoChangesRequest = (
  userIds: ReadonlyArray<string>
): { readonly usernames: ReadonlyArray<string> } => {
  const usernames = normalizeSubscriptionUserIds(userIds);
  if (usernames.length > MAX_USER_INFO_SUBSCRIPTION_COUNT) {
    throw buildValidationError(
      `params.userIds must contain at most ${MAX_USER_INFO_SUBSCRIPTION_COUNT} unique users`,
      'params.userIds',
      'range',
      ERROR_CODES.SERVICE_LIMIT_EXCEEDED
    );
  }

  return { usernames };
};

export const buildUnsubscribeUserInfoChangesUserIds = (
  userIds: ReadonlyArray<string>
): ReadonlyArray<string> => {
  return normalizeSubscriptionUserIds(userIds);
};

export const buildSubscribeUserInfoChangesEndpoint = (context: RestContext): string => {
  return buildSubscriptionBaseEndpoint(context);
};

export const buildUnsubscribeUserInfoChangesEndpoint = (
  context: RestContext,
  userIds: ReadonlyArray<string>
): string => {
  const usernames = buildUnsubscribeUserInfoChangesUserIds(userIds);
  return `${buildSubscriptionBaseEndpoint(context)}?usernames=${usernames
    .map(userId => encodeURIComponent(userId))
    .join(',')}`;
};

export const buildGetSubscribedUserInfoListEndpoint = (context: RestContext): string => {
  return buildSubscriptionBaseEndpoint(context);
};

export const readSubscribedUserIdsFromEnvelope = (
  response: unknown
): ReadonlyArray<string> => {
  const payload =
    response && typeof response === 'object'
      ? (response as UserInfoSubscriptionResponseEnvelope)
      : null;
  if (!payload || !Array.isArray(payload.data)) {
    return [];
  }

  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of payload.data) {
    if (typeof item !== 'string') {
      continue;
    }
    const normalized = item.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
};
