import { isRecord } from '../../cache/cache-utils';
import type {
  ChatRoomAnnouncement,
  ChatRoomAttributeMutationResult,
  ChatRoomAttributesSnapshot,
  ChatRoomBlocklistEntry,
  ChatRoomDetail,
  ChatRoomListResult,
  ChatRoomMemberActionListResult,
  ChatRoomMemberActionResult,
  ChatRoomMemberEntry,
  ChatRoomMemberListResult,
  ChatRoomMuteEntry,
  ChatRoomMuteStatus,
  ChatRoomPermissionType,
  ChatRoomSharedFile,
  ChatRoomSharedFileListResult,
  ChatRoomSummary,
  ChatRoomAllowlistEntry,
  ChatRoomUpdateResult,
} from '../../types/chatroom';
import type { UserInfo } from '../../types/user-info';
import { ERROR_CODES } from '../../utils/error-codes';
import { buildMinimalChatRoomUserInfo } from './chatroom-event-user-info-resolver';

type UnknownRecord = Record<string, unknown>;

const toRecord = (value: unknown): UnknownRecord | null => {
  return isRecord(value) ? (value as UnknownRecord) : null;
};

const toStringValue = (value: unknown): string | undefined => {
  return typeof value === 'string' ? value : undefined;
};

const toNonEmptyString = (value: unknown): string | undefined => {
  const text = toStringValue(value)?.trim();
  return text ? text : undefined;
};

const toNumberValue = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const normalized = Number(value);
    return Number.isFinite(normalized) ? normalized : undefined;
  }
  return undefined;
};

const toBooleanValue = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    if (value === 'true') {
      return true;
    }
    if (value === 'false') {
      return false;
    }
  }
  return undefined;
};

const readEnvelopeArray = (payload: unknown): ReadonlyArray<unknown> => {
  const record = toRecord(payload);
  if (record && Array.isArray(record.data)) {
    return record.data;
  }
  if (record && Array.isArray(record.entities)) {
    return record.entities;
  }
  return Array.isArray(payload) ? payload : [];
};

const readEnvelopeObject = (payload: unknown): UnknownRecord | null => {
  const record = toRecord(payload);
  if (!record) {
    return null;
  }
  if (toRecord(record.data)) {
    return record.data as UnknownRecord;
  }
  return record;
};

const readPageNumber = (payload: unknown, key: 'pagenum' | 'pagesize'): number | undefined => {
  const record = toRecord(payload);
  const params = record && toRecord(record.params);
  const values = params?.[key];
  if (!Array.isArray(values) || values.length === 0) {
    return undefined;
  }
  return toNumberValue(values[0]);
};

const readCount = (payload: unknown): number | undefined => {
  const record = toRecord(payload);
  return record ? toNumberValue(record.count) : undefined;
};

const stripAppKeyPrefix = (value: string | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }
  const index = value.indexOf('_');
  if (index < 0) {
    return value;
  }
  return value.slice(index + 1);
};

const normalizeChatRoomId = (record: UnknownRecord): string => {
  return (
    toNonEmptyString(record.chatRoomId) ??
    toNonEmptyString(record.chatroomid) ??
    toNonEmptyString(record.id) ??
    ''
  );
};

const normalizeChatRoomName = (record: UnknownRecord): string => {
  return (
    toStringValue(record.name) ??
    toStringValue(record.title) ??
    toStringValue(record.groupname) ??
    ''
  );
};

const buildUser = (userId: string): UserInfo => buildMinimalChatRoomUserInfo(userId);

const resolvePermissionType = (
  record: UnknownRecord,
  currentUserId?: string
): ChatRoomPermissionType | undefined => {
  if (!currentUserId) {
    return undefined;
  }

  const ownerId = toNonEmptyString(record.owner);
  if (ownerId === currentUserId) {
    return 'owner';
  }

  const affiliations = Array.isArray(record.affiliations) ? record.affiliations : [];
  for (const item of affiliations) {
    const entry = toRecord(item);
    if (!entry) {
      continue;
    }
    if (toNonEmptyString(entry.owner) === currentUserId) {
      return 'owner';
    }
    if (toNonEmptyString(entry.admin) === currentUserId) {
      return 'admin';
    }
    if (toNonEmptyString(entry.member) === currentUserId) {
      return 'member';
    }
  }

  return undefined;
};

export const normalizeChatRoomSummary = (
  value: unknown,
  options?: {
    readonly stripOwnerAppKeyPrefix?: boolean;
  }
): ChatRoomSummary | null => {
  const record = toRecord(value);
  if (!record) {
    return null;
  }

  const chatRoomId = normalizeChatRoomId(record);
  if (!chatRoomId) {
    return null;
  }

  const ownerId = options?.stripOwnerAppKeyPrefix
    ? stripAppKeyPrefix(toNonEmptyString(record.owner))
    : toNonEmptyString(record.owner);

  return {
    chatRoomId,
    name: normalizeChatRoomName(record),
    owner: ownerId ? buildUser(ownerId) : undefined,
    memberCount: toNumberValue(record.memberCount) ?? toNumberValue(record.affiliations_count),
    disabled: toBooleanValue(record.disabled),
  };
};

export const normalizeChatRoomListResult = (
  payload: unknown,
  options?: {
    readonly stripOwnerAppKeyPrefix?: boolean;
  }
): ChatRoomListResult => {
  const total = readCount(payload);
  const items = readEnvelopeArray(payload)
    .map(item => normalizeChatRoomSummary(item, options))
    .filter((item): item is ChatRoomSummary => item !== null);
  const pageNum = readPageNumber(payload, 'pagenum');
  const pageSize = readPageNumber(payload, 'pagesize');

  return {
    items,
    pageNum,
    pageSize,
    total,
    hasMore:
      total !== undefined && pageNum !== undefined && pageSize !== undefined
        ? pageNum * pageSize < total
        : undefined,
  };
};

export const normalizeChatRoomUpdateResult = (payload: unknown): ChatRoomUpdateResult => {
  const record = readEnvelopeObject(payload) ?? {};
  return {
    nameUpdated: toBooleanValue(record.groupname),
    descriptionUpdated: toBooleanValue(record.description),
    maxMembersUpdated: toBooleanValue(record.maxusers),
  };
};

export const normalizeChatRoomDetail = (
  payload: unknown,
  currentUserId?: string
): ChatRoomDetail => {
  const array = readEnvelopeArray(payload);
  const record = toRecord(array[0]) ?? readEnvelopeObject(payload) ?? {};
  const summary = normalizeChatRoomSummary(record) ?? {
    chatRoomId: normalizeChatRoomId(record),
    name: normalizeChatRoomName(record),
  };
  const permissionType = resolvePermissionType(record, currentUserId);
  const muteExpireAt =
    toNumberValue(record.muteExpireAt) ??
    toNumberValue(record.mute_expire) ??
    toNumberValue(record.expire);
  const inAllowlist =
    toBooleanValue(record.inAllowlist) ??
    toBooleanValue(record.white) ??
    toBooleanValue(record.in_whitelist);
  const muted = toBooleanValue(record.muted);

  return {
    ...summary,
    description: toStringValue(record.description),
    maxMembers:
      toNumberValue(record.maxMembers) ??
      toNumberValue(record.maxusers) ??
      toNumberValue(record.max_users),
    createdAt: toNumberValue(record.createdAt) ?? toNumberValue(record.created),
    ext: toStringValue(record.ext) ?? toStringValue(record.custom),
    announcement: toStringValue(record.announcement),
    permissionType,
    currentUserStatus:
      inAllowlist !== undefined ||
      muted !== undefined ||
      muteExpireAt !== undefined ||
      permissionType !== undefined
        ? {
            inAllowlist,
            muted,
            muteExpireAt,
            permissionType,
          }
        : undefined,
  };
};

export const normalizeChatRoomMemberListResult = (
  payload: unknown
): ChatRoomMemberListResult => {
  const items: ChatRoomMemberEntry[] = [];

  for (const item of readEnvelopeArray(payload)) {
    const record = toRecord(item);
    if (!record) {
      continue;
    }

    const owner = toNonEmptyString(record.owner);
    const admin = toNonEmptyString(record.admin);
    const member = toNonEmptyString(record.member);
    const userId = owner ?? admin ?? member;
    if (!userId) {
      continue;
    }

    items.push({
      user: buildUser(userId),
      role: owner ? 'owner' : admin ? 'admin' : 'member',
      joinedAt: toNumberValue(record.joinedAt) ?? toNumberValue(record.joined_time),
    });
  }

  const root = toRecord(payload);
  const cursor = root ? toNonEmptyString(root.cursor) : undefined;

  return {
    items,
    cursor,
    hasMore: typeof cursor === 'string' && cursor.length > 0,
  };
};

const normalizeStringUserEntries = (payload: unknown): ReadonlyArray<UserInfo> => {
  return readEnvelopeArray(payload)
    .map(item => toNonEmptyString(item))
    .filter((item): item is string => Boolean(item))
    .map(userId => buildUser(userId));
};

export const normalizeChatRoomAdminUsers = (payload: unknown): ReadonlyArray<UserInfo> => {
  return normalizeStringUserEntries(payload);
};

export const normalizeChatRoomMuteEntries = (payload: unknown): ReadonlyArray<ChatRoomMuteEntry> => {
  const items = readEnvelopeArray(payload);
  if (items.every(item => typeof item === 'string')) {
    return normalizeStringUserEntries(payload).map(user => ({ user }));
  }

  const result: Array<{ user: UserInfo; muteExpire: number | undefined }> = [];
  for (const item of items) {
    const record = toRecord(item);
    if (!record) {
      continue;
    }
    const userId =
      toNonEmptyString(record.user) ??
      toNonEmptyString(record.member) ??
      toNonEmptyString(record.owner) ??
      toNonEmptyString(record.admin);
    if (!userId) {
      continue;
    }
    result.push({
      user: buildUser(userId),
      muteExpire:
        toNumberValue(record.muteExpire) ??
        toNumberValue(record.expire) ??
        toNumberValue(record.expired),
    });
  }

  return result.map(item => ({ user: item.user, muteExpire: item.muteExpire }));
};

export const normalizeChatRoomAllowlistEntries = (
  payload: unknown
): ReadonlyArray<ChatRoomAllowlistEntry> => {
  return normalizeStringUserEntries(payload).map(user => ({ user }));
};

export const normalizeChatRoomBlocklistEntries = (
  payload: unknown
): ReadonlyArray<ChatRoomBlocklistEntry> => {
  return normalizeStringUserEntries(payload).map(user => ({ user }));
};

export const normalizeChatRoomAnnouncement = (payload: unknown): ChatRoomAnnouncement => {
  const record = readEnvelopeObject(payload) ?? {};
  return {
    announcement: toStringValue(record.announcement) ?? '',
  };
};

export const normalizeChatRoomSharedFile = (value: unknown): ChatRoomSharedFile | null => {
  const record = toRecord(value);
  if (!record) {
    return null;
  }

  const fileId = toNonEmptyString(record.fileId) ?? toNonEmptyString(record.file_id);
  const fileName = toStringValue(record.fileName) ?? toStringValue(record.file_name);
  if (!fileId || fileName === undefined) {
    return null;
  }

  const ownerId = toNonEmptyString(record.fileOwner) ?? toNonEmptyString(record.file_owner);
  return {
    fileId,
    fileName,
    fileOwner: ownerId ? buildUser(ownerId) : undefined,
    fileSize: toNumberValue(record.fileSize) ?? toNumberValue(record.file_size),
    createdAt: toNumberValue(record.createdAt) ?? toNumberValue(record.created),
  };
};

export const normalizeChatRoomSharedFileListResult = (
  payload: unknown
): ChatRoomSharedFileListResult => {
  return {
    items: readEnvelopeArray(payload)
      .map(item => normalizeChatRoomSharedFile(item))
      .filter((item): item is ChatRoomSharedFile => item !== null),
    pageNum: readPageNumber(payload, 'pagenum'),
    pageSize: readPageNumber(payload, 'pagesize'),
  };
};

export const normalizeChatRoomAttributesSnapshot = (
  payload: unknown,
  chatRoomId: string
): ChatRoomAttributesSnapshot => {
  const record = readEnvelopeObject(payload) ?? {};
  return {
    chatRoomId,
    attributes: Object.fromEntries(
      Object.entries(record).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    ),
  };
};

export const normalizeChatRoomAttributeMutationResult = (
  payload: unknown,
  chatRoomId: string
): ChatRoomAttributeMutationResult => {
  const record = readEnvelopeObject(payload) ?? {};
  const appliedKeys = Array.isArray(record.successKeys)
    ? record.successKeys.filter((item): item is string => typeof item === 'string')
    : [];
  const failedKeysRecord = toRecord(record.errorKeys) ?? {};

  const failedKeys: Record<string, { code: number; message: string }> = {};
  for (const [key, value] of Object.entries(failedKeysRecord)) {
    if (typeof value === 'string') {
      failedKeys[key] = { code: mapAttributeErrorDescription(value), message: value };
    }
  }

  return { chatRoomId, appliedKeys, failedKeys };
};

const normalizeChatRoomMemberAction = (value: unknown): ChatRoomMemberActionResult | null => {
  const record = toRecord(value);
  if (!record) {
    return null;
  }

  const userId = toNonEmptyString(record.user);
  const chatRoomId =
    toNonEmptyString(record.chatRoomId) ??
    toNonEmptyString(record.chatroomid) ??
    toNonEmptyString(record.id);
  const action = toStringValue(record.action);
  const success = toBooleanValue(record.result);

  if (!userId || !chatRoomId || action === undefined || success === undefined) {
    return null;
  }

  return {
    chatRoomId,
    user: buildUser(userId),
    action,
    reason: toStringValue(record.reason),
    ...(success ? {} : { reason: toStringValue(record.reason) ?? 'failed' }),
  };
};

export const normalizeChatRoomMemberActionListResult = (
  payload: unknown
): ChatRoomMemberActionListResult => {
  const record = toRecord(payload);
  const data = record?.data;
  const values = Array.isArray(data) ? data : data !== undefined ? [data] : [];

  const succeeded: ChatRoomMemberActionResult[] = [];
  const failed: ChatRoomMemberActionResult[] = [];

  values.forEach(item => {
    const record = toRecord(item);
    const normalized = normalizeChatRoomMemberAction(item);
    if (!normalized || !record) {
      return;
    }
    const success = toBooleanValue(record.result);
    if (success) {
      succeeded.push(normalized);
    } else {
      failed.push(normalized);
    }
  });

  return { succeeded, failed };
};

export const normalizeChatRoomBooleanStatus = (payload: unknown): boolean => {
  const record = readEnvelopeObject(payload) ?? {};
  return toBooleanValue(record.value) ?? toBooleanValue(record.white) ?? false;
};

export const normalizeChatRoomMuteStatus = (payload: unknown): ChatRoomMuteStatus => {
  const record = readEnvelopeObject(payload) ?? {};
  return {
    muted: toBooleanValue(record.muted) ?? toBooleanValue(record.value) ?? Boolean(record.data),
    muteExpireAt:
      toNumberValue(record.muteExpireAt) ??
      toNumberValue(record.expire) ??
      toNumberValue(record.mute_expire),
  };
};

/** FR-052: 属性 errorKeys 错误描述 → 错误码映射 */
const mapAttributeErrorDescription = (desc: string): number => {
  if (desc.includes('is exceeding maximum limit')) return ERROR_CODES.SERVICE_LIMIT_EXCEEDED;
  if (desc.includes('size of metadata') && desc.includes('exceeds'))
    return ERROR_CODES.SERVICE_LIMIT_EXCEEDED;
  if (desc.includes('is not part of you')) return ERROR_CODES.CHATROOM_PERMISSION_DENIED;
  if (desc.includes('is not Legal') || desc.includes('is not exist'))
    return ERROR_CODES.VALIDATION_REQUIRED;
  return ERROR_CODES.REST_BUSINESS_UNKNOWN;
};
