import { isRecord } from '../../cache/cache-utils';
import type {
  CreateGroupResult,
  GroupAnnouncement,
  GroupBlocklistEntry,
  GroupDetail,
  GroupListResult,
  GroupMemberEntry,
  GroupMemberListResult,
  GroupMuteEntry,
  GroupSharedFile,
  GroupSharedFileListResult,
  GroupSummary,
  GroupAllowlistEntry,
  GroupMembersAttributesResult,
} from '../../types/group';
import type { UserInfo } from '../../types/user-info';
import { buildMinimalGroupUserInfo } from './group-event-user-info-resolver';

type UnknownRecord = Record<string, unknown>;

const toRecord = (value: unknown): UnknownRecord | null => {
  return isRecord(value) ? (value as UnknownRecord) : null;
};

const toStringValue = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    return value;
  }
  return undefined;
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

const normalizeGroupId = (record: UnknownRecord): string => {
  return (
    toNonEmptyString(record.groupId) ??
    toNonEmptyString(record.groupid) ??
    toNonEmptyString(record.id) ??
    ''
  );
};

const normalizeGroupName = (record: UnknownRecord): string => {
  return (
    toStringValue(record.name) ??
    toStringValue(record.groupname) ??
    toStringValue(record.groupName) ??
    ''
  );
};

export const normalizeGroupSummary = (value: unknown): GroupSummary | null => {
  const record = toRecord(value);
  if (!record) {
    return null;
  }

  const groupId = normalizeGroupId(record);
  if (!groupId) {
    return null;
  }

  return {
    groupId,
    name: normalizeGroupName(record),
    description: toStringValue(record.description),
    memberCount:
      toNumberValue(record.memberCount) ??
      toNumberValue(record.affiliations_count),
    public: toBooleanValue(record.public),
    joinApprovalRequired:
      toBooleanValue(record.joinApprovalRequired) ??
      toBooleanValue(record.approval) ??
      toBooleanValue(record.membersonly) ??
      toBooleanValue(record.members_only),
    allowInvites:
      toBooleanValue(record.allowInvites) ??
      toBooleanValue(record.allowinvites) ??
      toBooleanValue(record.allow_user_invites),
    maxMembers: toNumberValue(record.maxMembers) ?? toNumberValue(record.maxusers),
    role:
      (toNonEmptyString(record.role) ?? toNonEmptyString(record.permission)) as
        | GroupSummary['role']
        | undefined,
    disabled: toBooleanValue(record.disabled),
  };
};

export const normalizeGroupListResult = (payload: unknown): GroupListResult => {
  return {
    items: readEnvelopeArray(payload)
      .map(item => normalizeGroupSummary(item))
      .filter((item): item is GroupSummary => item !== null),
    pageNum: readPageNumber(payload, 'pagenum'),
    pageSize: readPageNumber(payload, 'pagesize'),
  };
};

export const normalizeCreateGroupResult = (payload: unknown): CreateGroupResult => {
  const data = readEnvelopeArray(payload);
  const first = toRecord(data[0]);
  const record = readEnvelopeObject(payload) ?? first;
  const groupId =
    (record && normalizeGroupId(record)) ||
    (first && normalizeGroupId(first)) ||
    '';

  return {
    groupId,
  };
};

export const normalizeGroupDetail = (payload: unknown): GroupDetail => {
  const array = readEnvelopeArray(payload);
  const record = toRecord(array[0]) ?? readEnvelopeObject(payload) ?? {};
  const summary = normalizeGroupSummary(record) ?? {
    groupId: normalizeGroupId(record),
    name: normalizeGroupName(record),
  };
  const ownerId =
    toNonEmptyString(record.owner) ??
    toNonEmptyString(record.admin) ??
    toNonEmptyString(record.member);
  const affiliations = Array.isArray(record.affiliations) ? record.affiliations : [];
  const joinedAt = affiliations
    .map(item => toRecord(item))
    .filter((item): item is UnknownRecord => item !== null)
    .map(item => toNumberValue(item.joined_time))
    .find((value): value is number => value !== undefined);

  return {
    ...summary,
    owner: ownerId ? buildMinimalGroupUserInfo(ownerId) : undefined,
    inviteNeedConfirm: toBooleanValue(record.inviteNeedConfirm) ?? toBooleanValue(record.invite_need_confirm),
    muteAllMembers: toBooleanValue(record.mute),
    ext: toStringValue(record.ext) ?? toStringValue(record.custom),
    createdAt: toNumberValue(record.createdAt) ?? toNumberValue(record.created),
    joinedAt,
    avatarUrl: toStringValue(record.avatar),
    messageBlocked:
      toBooleanValue(record.messageBlocked) ??
      toBooleanValue(record.isMessageBlocked) ??
      toBooleanValue(record.shieldgroup),
  };
};

const buildUser = (userId: string): UserInfo => buildMinimalGroupUserInfo(userId);

export const normalizeGroupMemberListResult = (payload: unknown): GroupMemberListResult => {
  const items: GroupMemberEntry[] = [];

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

  return {
    items,
    pageNum: readPageNumber(payload, 'pagenum'),
    pageSize: readPageNumber(payload, 'pagesize'),
  };
};

const normalizeStringUserEntries = (payload: unknown): ReadonlyArray<UserInfo> => {
  return readEnvelopeArray(payload)
    .map(item => toNonEmptyString(item))
    .filter((item): item is string => Boolean(item))
    .map(userId => buildUser(userId));
};

export const normalizeGroupAdminUsers = (payload: unknown): ReadonlyArray<UserInfo> => {
  return normalizeStringUserEntries(payload);
};

export const normalizeGroupMuteEntries = (payload: unknown): ReadonlyArray<GroupMuteEntry> => {
  return normalizeStringUserEntries(payload).map(user => ({
    user,
  }));
};

export const normalizeGroupAllowlistEntries = (
  payload: unknown
): ReadonlyArray<GroupAllowlistEntry> => {
  return normalizeStringUserEntries(payload).map(user => ({ user }));
};

export const normalizeGroupBlocklistEntries = (
  payload: unknown
): ReadonlyArray<GroupBlocklistEntry> => {
  return normalizeStringUserEntries(payload).map(user => ({ user }));
};

export const normalizeGroupAnnouncement = (payload: unknown): GroupAnnouncement => {
  const record = readEnvelopeObject(payload) ?? {};
  return {
    announcement: toStringValue(record.announcement) ?? '',
  };
};

export const normalizeGroupSharedFile = (value: unknown): GroupSharedFile | null => {
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

export const normalizeGroupSharedFileListResult = (payload: unknown): GroupSharedFileListResult => {
  return {
    items: readEnvelopeArray(payload)
      .map(item => normalizeGroupSharedFile(item))
      .filter((item): item is GroupSharedFile => item !== null),
    pageNum: readPageNumber(payload, 'pagenum'),
    pageSize: readPageNumber(payload, 'pagesize'),
  };
};

export const normalizeGroupMembersAttributes = (
  payload: unknown
): GroupMembersAttributesResult => {
  const record = readEnvelopeObject(payload) ?? {};
  const data = toRecord(record.data) ?? record;
  const items: Record<string, Record<string, string>> = {};

  for (const [userId, value] of Object.entries(data)) {
    const attributes = toRecord(value);
    if (!attributes) {
      continue;
    }
    items[userId] = Object.fromEntries(
      Object.entries(attributes).filter((entry): entry is [string, string] => {
        return typeof entry[1] === 'string';
      })
    );
  }

  return {
    items,
  };
};
