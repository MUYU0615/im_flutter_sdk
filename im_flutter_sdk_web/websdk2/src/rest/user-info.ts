import { isRecord } from '../cache/cache-utils';
import { parseAppKey } from '../upload/utils';
import { ERROR_CODES } from '../utils/error-codes';
import { ValidationError } from '../utils/errors';
import type { RestContext } from '../types/chat-client';
import type {
  ServerUserInfoAttributes,
  UpdateOwnInfoParams,
  UpdateOwnInfoByAttributeParams,
  UserInfo,
  UserInfoAttribute,
  UserInfoAttributeValue,
} from '../types/user-info';

export const USER_INFO_ATTRIBUTE_TO_REST_FIELD = {
  nickname: 'nickname',
  avatarUrl: 'avatarurl',
  mail: 'mail',
  phone: 'phone',
  gender: 'gender',
  sign: 'sign',
  birth: 'birth',
  ext: 'ext',
} as const;

export type RestUserInfoAttribute =
  (typeof USER_INFO_ATTRIBUTE_TO_REST_FIELD)[keyof typeof USER_INFO_ATTRIBUTE_TO_REST_FIELD];

export interface NormalizedUserInfoFetchRecord {
  readonly profile: UserInfo;
  readonly lastModified?: number;
}

export const DEFAULT_USER_INFO_ATTRIBUTES: ReadonlyArray<UserInfoAttribute> = [
  'nickname',
  'avatarUrl',
  'mail',
  'phone',
  'gender',
  'sign',
  'birth',
  'ext',
];

const createValidationError = (
  message: string,
  path: string,
  rule: 'required' | 'invalid_format'
): ValidationError => {
  return new ValidationError(message, {
    code: rule === 'required' ? ERROR_CODES.VALIDATION_REQUIRED : ERROR_CODES.VALIDATION_INVALID_FORMAT,
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

const assertStringField = (value: unknown, path: string): string => {
  if (typeof value !== 'string') {
    throw createValidationError(`${path} must be a string`, path, 'invalid_format');
  }
  return value;
};

const assertAttributeValue = (value: unknown, path: string): UserInfoAttributeValue => {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  throw createValidationError(`${path} must be a string, number, or boolean`, path, 'invalid_format');
};

export const mapUserInfoAttributeToRestField = (
  attribute: UserInfoAttribute,
  path = 'attribute'
): RestUserInfoAttribute => {
  const restField = USER_INFO_ATTRIBUTE_TO_REST_FIELD[attribute];
  if (!restField) {
    throw createValidationError(`${path} is invalid`, path, 'invalid_format');
  }
  return restField;
};

export const normalizeUserInfoTargetIds = (
  userIds: ReadonlyArray<string>,
  path = 'params.userIds'
): ReadonlyArray<string> => {
  if (!Array.isArray(userIds) || userIds.length === 0) {
    throw createValidationError(`${path} is required`, path, 'required');
  }

  const result: string[] = [];
  const seen = new Set<string>();

  for (const [index, userId] of userIds.entries()) {
    const normalized = assertStringField(userId, `${path}[${index}]`).trim();
    if (!normalized) {
      continue;
    }
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }

  if (result.length === 0) {
    throw createValidationError(`${path} is required`, path, 'required');
  }

  return result;
};

export const normalizeUserInfoAttributes = (
  attributes: ReadonlyArray<UserInfoAttribute>,
  path = 'params.attributes'
): ReadonlyArray<UserInfoAttribute> => {
  if (!Array.isArray(attributes) || attributes.length === 0) {
    throw createValidationError(`${path} is required`, path, 'required');
  }

  const result: UserInfoAttribute[] = [];
  const seen = new Set<UserInfoAttribute>();

  for (const [index, attribute] of attributes.entries()) {
    const normalized = assertStringField(attribute, `${path}[${index}]`) as UserInfoAttribute;
    if (!(normalized in USER_INFO_ATTRIBUTE_TO_REST_FIELD)) {
      throw createValidationError(`${path}[${index}] is invalid`, `${path}[${index}]`, 'invalid_format');
    }
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }

  if (result.length === 0) {
    throw createValidationError(`${path} is required`, path, 'required');
  }

  return result;
};

export const buildUserInfoFetchEndpoint = (context: RestContext): string => {
  const { orgName, appName } = parseAppKey(context.appKey);
  return `/${orgName}/${appName}/metadata/user/get`;
};

export const buildUserInfoUpdateEndpoint = (context: RestContext): string => {
  const { orgName, appName } = parseAppKey(context.appKey);
  return `/${orgName}/${appName}/metadata/user/${encodeURIComponent(context.userId)}`;
};

export const buildFetchUserInfoByUserIdRequest = (
  userIds: ReadonlyArray<string>
): { readonly targets: ReadonlyArray<string> } => {
  return {
    targets: normalizeUserInfoTargetIds(userIds),
  };
};

export const buildFetchUserInfoByAttributeRequest = (
  userIds: ReadonlyArray<string>,
  attributes: ReadonlyArray<UserInfoAttribute>
): { readonly targets: ReadonlyArray<string>; readonly properties: ReadonlyArray<RestUserInfoAttribute> } => {
  return {
    targets: normalizeUserInfoTargetIds(userIds),
    properties: normalizeUserInfoAttributes(attributes).map(attribute =>
      mapUserInfoAttributeToRestField(attribute, 'params.attributes')
    ),
  };
};

const looksLikeUserInfoAttributes = (value: unknown): value is ServerUserInfoAttributes => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    'nickname' in value ||
    'avatarurl' in value ||
    'avatarUrl' in value ||
    'mail' in value ||
    'phone' in value ||
    'gender' in value ||
    'sign' in value ||
    'birth' in value ||
    'ext' in value
  );
};

const readLegacyEntityList = (
  payload: unknown,
  result: Map<string, ServerUserInfoAttributes>
): void => {
  if (!Array.isArray(payload)) {
    return;
  }

  for (const item of payload) {
    if (!isRecord(item)) {
      continue;
    }
    const userId = typeof item.username === 'string' ? item.username : '';
    if (!userId) {
      continue;
    }
    result.set(userId, item);
  }
};

const readFetchDataMap = (response: unknown): ReadonlyMap<string, ServerUserInfoAttributes> => {
  const result = new Map<string, ServerUserInfoAttributes>();
  const root = isRecord(response) ? response : null;

  if (root?.data && isRecord(root.data)) {
    for (const [userId, value] of Object.entries(root.data)) {
      if (looksLikeUserInfoAttributes(value)) {
        result.set(userId, value);
      }
    }
  }

  readLegacyEntityList(root?.entities, result);
  readLegacyEntityList(root?.data && isRecord(root.data) ? root.data.entities : undefined, result);

  return result;
};

const readFetchLastModifiedMap = (response: unknown): ReadonlyMap<string, number> => {
  const result = new Map<string, number>();
  const root = isRecord(response) ? response : null;
  if (!root?.lastModified || !isRecord(root.lastModified)) {
    return result;
  }

  for (const [userId, value] of Object.entries(root.lastModified)) {
    if (typeof value === 'number') {
      result.set(userId, value);
    }
  }

  return result;
};

const toUserInfo = (userId: string, attributes: ServerUserInfoAttributes): UserInfo => {
  const profile: {
    userId: string;
    nickname?: string;
    avatarUrl?: string;
    mail?: string;
    phone?: string;
    gender?: string | number | boolean;
    sign?: string;
    birth?: string;
    ext?: string;
  } = { userId };

  if (typeof attributes.nickname === 'string') {
    profile.nickname = attributes.nickname;
  }
  if (typeof attributes.avatarurl === 'string') {
    profile.avatarUrl = attributes.avatarurl;
  } else if (typeof attributes.avatarUrl === 'string') {
    profile.avatarUrl = attributes.avatarUrl;
  }
  if (typeof attributes.mail === 'string') {
    profile.mail = attributes.mail;
  }
  if (typeof attributes.phone === 'string') {
    profile.phone = attributes.phone;
  }
  if (
    typeof attributes.gender === 'string' ||
    typeof attributes.gender === 'number' ||
    typeof attributes.gender === 'boolean'
  ) {
    profile.gender = attributes.gender;
  }
  if (typeof attributes.sign === 'string') {
    profile.sign = attributes.sign;
  }
  if (typeof attributes.birth === 'string') {
    profile.birth = attributes.birth;
  }
  if (typeof attributes.ext === 'string') {
    profile.ext = attributes.ext;
  }

  return profile;
};

export const normalizeUserInfoFetchRecords = (
  response: unknown,
  requestedUserIds: ReadonlyArray<string>
): ReadonlyArray<NormalizedUserInfoFetchRecord> => {
  const userInfoMap = readFetchDataMap(response);
  const lastModifiedMap = readFetchLastModifiedMap(response);
  const result: NormalizedUserInfoFetchRecord[] = [];

  for (const userId of requestedUserIds) {
    const attributes = userInfoMap.get(userId);
    if (!attributes) {
      continue;
    }
    result.push({
      profile: toUserInfo(userId, attributes),
      lastModified: lastModifiedMap.get(userId),
    });
  }

  return result;
};

export const normalizeFetchedUserInfos = (
  response: unknown,
  requestedUserIds: ReadonlyArray<string>
): ReadonlyArray<UserInfo> => {
  return normalizeUserInfoFetchRecords(response, requestedUserIds).map(record => record.profile);
};

const addFormField = (
  entries: Array<[RestUserInfoAttribute, string]>,
  key: RestUserInfoAttribute,
  value: unknown,
  path: string
): void => {
  if (value === undefined) {
    return;
  }

  if (key === 'gender') {
    entries.push([key, String(assertAttributeValue(value, path))]);
    return;
  }

  entries.push([key, assertStringField(value, path)]);
};

const encodeFormEntries = (entries: ReadonlyArray<readonly [RestUserInfoAttribute, string]>): string => {
  return entries
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
};

export const buildUpdateOwnInfoFormBody = (params: UpdateOwnInfoParams): string => {
  const entries: Array<[RestUserInfoAttribute, string]> = [];

  addFormField(entries, 'nickname', params.nickname, 'params.nickname');
  addFormField(entries, 'avatarurl', params.avatarUrl, 'params.avatarUrl');
  addFormField(entries, 'mail', params.mail, 'params.mail');
  addFormField(entries, 'phone', params.phone, 'params.phone');
  addFormField(entries, 'gender', params.gender, 'params.gender');
  addFormField(entries, 'sign', params.sign, 'params.sign');
  addFormField(entries, 'birth', params.birth, 'params.birth');
  addFormField(entries, 'ext', params.ext, 'params.ext');

  if (entries.length === 0) {
    throw createValidationError('params must include at least one updatable field', 'params', 'required');
  }

  return encodeFormEntries(entries);
};

export const buildUpdateOwnInfoByAttributeFormBody = (
  attribute: UpdateOwnInfoByAttributeParams['attribute'],
  value: UpdateOwnInfoByAttributeParams['value']
): string => {
  const restField = mapUserInfoAttributeToRestField(attribute, 'attribute');
  const normalizedValue = assertAttributeValue(value, 'value');
  if (restField !== 'gender' && typeof normalizedValue !== 'string') {
    throw createValidationError('value must be a string', 'value', 'invalid_format');
  }
  return encodeFormEntries([[restField, String(normalizedValue)]]);
};
