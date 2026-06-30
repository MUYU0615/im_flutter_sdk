import { GroupEventName } from '../../types/event-system';
import type {
  GroupDetail,
  GroupRawNotifyEvent,
  GroupRawNotifyPayload,
  GroupSharedFile,
} from '../../types/group';
import { normalizeGroupSharedFile } from './group-normalizers';

export interface GroupMucJid {
  readonly name?: string;
  readonly clientResource?: string;
}

export interface GroupMucEventInput {
  readonly operation: number;
  readonly groupId: string;
  readonly groupName?: string;
  readonly from?: GroupMucJid;
  readonly to?: ReadonlyArray<GroupMucJid>;
  readonly reason?: string;
  readonly eventExt?: string;
  readonly members?: ReadonlyArray<string>;
  readonly source?: 'direct' | 'multiDevice';
}

const UPDATE_BOOLEAN_KEYS = new Set([
  'public',
  'members_only',
  'allow_user_invites',
  'invite_need_confirm',
]);

const UPDATE_KEY_MAP: Record<string, keyof GroupDetail | 'lastModified'> = {
  name: 'name',
  title: 'name',
  description: 'description',
  public: 'public',
  members_only: 'joinApprovalRequired',
  allow_user_invites: 'allowInvites',
  max_users: 'maxMembers',
  invite_need_confirm: 'inviteNeedConfirm',
  custom: 'ext',
};

const toNonEmptyString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const parseJsonRecord = (value: string | undefined): Record<string, unknown> | null => {
  if (!value) {
    return null;
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
};

const resolvePrimaryTarget = (to: ReadonlyArray<GroupMucJid> | undefined): string | undefined => {
  return toNonEmptyString(to?.[0]?.name);
};

const resolveMembers = (
  members: ReadonlyArray<string> | undefined,
  fallback?: string
): ReadonlyArray<string> => {
  const items = members
    ?.map(item => toNonEmptyString(item))
    .filter((item): item is string => typeof item === 'string') ?? [];
  if (items.length > 0) {
    return items;
  }
  return fallback ? [fallback] : [];
};

const resolveMuteExpire = (reason: string | undefined, eventExt: string | undefined): number | undefined => {
  const numericReason = Number(reason);
  if (!Number.isNaN(numericReason) && Number.isFinite(numericReason) && numericReason > 0) {
    return numericReason;
  }

  const record = parseJsonRecord(eventExt);
  if (!record) {
    return undefined;
  }
  const value =
    record.muteExpire ??
    record.mute_expire ??
    record.expire ??
    record.expired ??
    record.expireAt ??
    record.expiredAt;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined;
};

const resolveGroupPatch = (eventExt: string | undefined): Partial<GroupDetail> | undefined => {
  const record = parseJsonRecord(eventExt);
  if (!record) {
    return undefined;
  }

  const patch: Partial<GroupDetail> = {};
  for (const [key, value] of Object.entries(record)) {
    const mappedKey = UPDATE_KEY_MAP[key];
    if (!mappedKey) {
      continue;
    }

    let normalized: unknown = value;
    if (UPDATE_BOOLEAN_KEYS.has(key)) {
      normalized = value === true || value === 'true';
    } else if (key === 'max_users') {
      const numeric = Number(value);
      normalized = Number.isFinite(numeric) ? numeric : undefined;
    }

    if (normalized !== undefined) {
      (patch as Record<string, unknown>)[mappedKey] = normalized;
    }
  }

  return Object.keys(patch).length > 0 ? patch : undefined;
};

const resolveSharedFile = (
  reason: string | undefined,
  eventExt: string | undefined
): GroupSharedFile | undefined => {
  const parsed = parseJsonRecord(eventExt) ?? parseJsonRecord(reason);
  return normalizeGroupSharedFile(parsed ?? undefined) ?? undefined;
};

const resolveDeletedFileId = (reason: string | undefined, eventExt: string | undefined): string => {
  const parsed = parseJsonRecord(eventExt) ?? parseJsonRecord(reason);
  const fileId =
    toNonEmptyString(parsed?.fileId) ??
    toNonEmptyString(parsed?.file_id) ??
    toNonEmptyString(reason);
  return fileId ?? '';
};

const resolveAttributePayload = (eventExt: string | undefined): {
  readonly userId?: string;
  readonly attribute: Readonly<Record<string, string>>;
} => {
  const record = parseJsonRecord(eventExt);
  if (!record) {
    return {
      attribute: {},
    };
  }

  const rawProperties =
    record.properties && typeof record.properties === 'object' && !Array.isArray(record.properties)
      ? (record.properties as Record<string, unknown>)
      : {};

  const attribute = Object.fromEntries(
    Object.entries(rawProperties).filter((entry): entry is [string, string] => {
      return typeof entry[1] === 'string';
    })
  );

  return {
    userId: toNonEmptyString(record.username),
    attribute,
  };
};

const buildEvent = (
  eventName: string,
  payload: GroupRawNotifyPayload
): GroupRawNotifyEvent => ({
  eventName,
  payload,
});

export const mapMucOperationToGroupEvent = (
  input: GroupMucEventInput
): GroupRawNotifyEvent | null => {
  const basePayload = {
    groupId: input.groupId,
    groupName: input.groupName,
  } satisfies Pick<GroupRawNotifyPayload, 'groupId' | 'groupName'>;
  const fromUserId = toNonEmptyString(input.from?.name);
  const targetUserId = resolvePrimaryTarget(input.to);

  switch (input.operation) {
    case 4:
      return buildEvent(GroupEventName.REQUEST_TO_JOIN_RECEIVED, {
        ...basePayload,
        applicantId: fromUserId,
        reason: input.reason,
      });
    case 5:
      return buildEvent(GroupEventName.REQUEST_TO_JOIN_ACCEPTED, {
        ...basePayload,
        accepterId: fromUserId,
      });
    case 6:
      return buildEvent(GroupEventName.REQUEST_TO_JOIN_DECLINED, {
        ...basePayload,
        declinerId: fromUserId,
        applicantId: targetUserId,
        reason: input.reason,
      });
    case 7:
      return buildEvent(GroupEventName.INVITATION_RECEIVED, {
        ...basePayload,
        inviterId: fromUserId,
        reason: input.reason,
      });
    case 8:
      return buildEvent(GroupEventName.INVITATION_ACCEPTED, {
        ...basePayload,
        inviteeId: fromUserId,
        reason: input.reason,
      });
    case 9:
      return buildEvent(GroupEventName.INVITATION_DECLINED, {
        ...basePayload,
        inviteeId: fromUserId,
        reason: input.reason,
      });
    case 10:
      return buildEvent(GroupEventName.USER_REMOVED, basePayload);
    case 1:
      return buildEvent(GroupEventName.GROUP_DESTROYED, basePayload);
    case 19:
      return buildEvent(GroupEventName.AUTO_ACCEPT_INVITATION, {
        ...basePayload,
        inviterId: fromUserId,
        reason: input.reason,
      });
    case 23:
      return buildEvent(GroupEventName.MUTE_LIST_ADDED, {
        ...basePayload,
        userIds: resolveMembers(input.members, targetUserId),
        muteExpire: resolveMuteExpire(input.reason, input.eventExt),
      });
    case 24:
      return buildEvent(GroupEventName.MUTE_LIST_REMOVED, {
        ...basePayload,
        userIds: resolveMembers(input.members, targetUserId),
      });
    case 29:
      return buildEvent(GroupEventName.ALLOW_LIST_ADDED, {
        ...basePayload,
        userIds: resolveMembers(input.members, targetUserId),
      });
    case 30:
      return buildEvent(GroupEventName.ALLOW_LIST_REMOVED, {
        ...basePayload,
        userIds: resolveMembers(input.members, targetUserId),
      });
    case 31:
      return buildEvent(GroupEventName.ALL_MEMBER_MUTE_STATE_CHANGED, {
        ...basePayload,
        isMuted: true,
      });
    case 32:
      return buildEvent(GroupEventName.ALL_MEMBER_MUTE_STATE_CHANGED, {
        ...basePayload,
        isMuted: false,
      });
    case 21:
      return buildEvent(GroupEventName.ADMIN_ADDED, {
        ...basePayload,
        administratorId: targetUserId ?? fromUserId,
      });
    case 22:
      return buildEvent(GroupEventName.ADMIN_REMOVED, {
        ...basePayload,
        administratorId: targetUserId ?? fromUserId,
      });
    case 20:
      return buildEvent(GroupEventName.OWNER_CHANGED, {
        ...basePayload,
        oldOwnerId: fromUserId,
        newOwnerId: targetUserId,
      });
    case 17: {
      const memberIds = resolveMembers(input.members, fromUserId);
      return buildEvent(GroupEventName.MEMBERS_JOINED, {
        ...basePayload,
        memberIds,
      });
    }
    case 18: {
      const memberIds = resolveMembers(input.members, fromUserId);
      return buildEvent(GroupEventName.MEMBERS_EXITED, {
        ...basePayload,
        memberIds,
      });
    }
    case 25:
      return buildEvent(GroupEventName.ANNOUNCEMENT_CHANGED, {
        ...basePayload,
        announcement: input.reason ?? '',
      });
    case 27:
      return buildEvent(GroupEventName.SHARED_FILE_ADDED, {
        ...basePayload,
        sharedFile: resolveSharedFile(input.reason, input.eventExt),
      });
    case 28:
      return buildEvent(GroupEventName.SHARED_FILE_DELETED, {
        ...basePayload,
        fileId: resolveDeletedFileId(input.reason, input.eventExt),
      });
    case 14:
      return buildEvent(GroupEventName.GROUP_INFO_CHANGED, {
        ...basePayload,
        shouldFetchGroupDetail: true,
        groupPatch: resolveGroupPatch(input.eventExt),
      });
    case 41:
      return buildEvent(GroupEventName.GROUP_DISABLED_CHANGED, {
        ...basePayload,
        shouldFetchGroupDetail: true,
        isDisabled: true,
      });
    case 42:
      return buildEvent(GroupEventName.GROUP_DISABLED_CHANGED, {
        ...basePayload,
        shouldFetchGroupDetail: true,
        isDisabled: false,
      });
    case 45: {
      const attributePayload = resolveAttributePayload(input.eventExt);
      return buildEvent(GroupEventName.GROUP_MEMBER_ATTRIBUTE_CHANGED, {
        ...basePayload,
        userId: attributePayload.userId,
        attribute: attributePayload.attribute,
        from: fromUserId,
        source: input.source ?? 'direct',
      });
    }
    default:
      return null;
  }
};
