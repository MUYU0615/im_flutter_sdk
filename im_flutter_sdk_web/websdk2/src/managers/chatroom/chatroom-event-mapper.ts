import { ChatRoomEventName } from '../../types/chatroom';
import type {
  ChatRoomDetail,
  ChatRoomRawNotifyEvent,
  ChatRoomRawNotifyPayload,
} from '../../types/chatroom';

export interface ChatRoomMucJid {
  readonly name?: string;
  readonly clientResource?: string;
}

export interface ChatRoomMucEventInput {
  readonly operation: number;
  readonly chatRoomId: string;
  readonly chatRoomName?: string;
  readonly from?: ChatRoomMucJid;
  readonly to?: ReadonlyArray<ChatRoomMucJid>;
  readonly reason?: string;
  readonly eventExt?: string;
  readonly ext?: string;
  readonly members?: ReadonlyArray<string>;
}

const UPDATE_BOOLEAN_KEYS = new Set([
  'mute',
]);

const UPDATE_KEY_MAP: Record<string, keyof ChatRoomDetail> = {
  name: 'name',
  title: 'name',
  description: 'description',
  max_users: 'maxMembers',
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

const resolvePrimaryTarget = (
  to: ReadonlyArray<ChatRoomMucJid> | undefined
): string | undefined => {
  return toNonEmptyString(to?.[0]?.name);
};

const resolveMembers = (
  members: ReadonlyArray<string> | undefined,
  fallback?: string
): ReadonlyArray<string> => {
  const items =
    members
      ?.map(item => toNonEmptyString(item))
      .filter((item): item is string => typeof item === 'string') ?? [];
  if (items.length > 0) {
    return items;
  }
  return fallback ? [fallback] : [];
};

const resolveMuteExpire = (
  reason: string | undefined,
  eventExt: string | undefined
): number | undefined => {
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

/** FR-055: 从 ext JSON 的 user_mute_time 提取按用户区分的禁言到期时间戳 */
const resolveUserMuteTimeMap = (
  ext: string | undefined
): Record<string, number> | null => {
  const record = parseJsonRecord(ext);
  const userMuteTime = record?.user_mute_time;
  if (!userMuteTime || typeof userMuteTime !== 'object' || Array.isArray(userMuteTime)) {
    return null;
  }
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(userMuteTime as Record<string, unknown>)) {
    const ts = Number(value);
    if (key && Number.isFinite(ts)) {
      result[key] = ts;
    }
  }
  return Object.keys(result).length > 0 ? result : null;
};

const resolveChatRoomPatch = (
  eventExt: string | undefined
): Partial<ChatRoomDetail> | undefined => {
  const record = parseJsonRecord(eventExt);
  if (!record) {
    return undefined;
  }

  const patch: Partial<ChatRoomDetail> = {};
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

const resolveAttributesPayload = (
  eventExt: string | undefined
): {
  readonly attributes: Readonly<Record<string, string>>;
  readonly keyList: ReadonlyArray<string>;
  readonly from?: string;
} => {
  const record = parseJsonRecord(eventExt);
  if (!record) {
    return {
      attributes: {},
      keyList: [],
    };
  }

  const result = record.result && typeof record.result === 'object' && !Array.isArray(record.result)
    ? (record.result as Record<string, unknown>)
    : {};
  const properties =
    record.properties && typeof record.properties === 'object' && !Array.isArray(record.properties)
      ? (record.properties as Record<string, unknown>)
      : {};
  const successKeys = Array.isArray(result.successKeys)
    ? result.successKeys.filter((item): item is string => typeof item === 'string')
    : [];

  return {
    attributes: Object.fromEntries(
      successKeys
        .map(key => [key, properties[key]])
        .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    ),
    keyList: successKeys,
    from: toNonEmptyString(record.operator) ?? toNonEmptyString(record.username),
  };
};

const buildEvent = (
  eventName: ChatRoomRawNotifyEvent['eventName'],
  payload: ChatRoomRawNotifyPayload
): ChatRoomRawNotifyEvent => ({
  eventName,
  payload,
});

export const mapMucOperationToChatRoomEvent = (
  input: ChatRoomMucEventInput
): ChatRoomRawNotifyEvent | null => {
  const basePayload = {
    chatRoomId: input.chatRoomId,
    chatRoomName: input.chatRoomName,
  } satisfies Pick<ChatRoomRawNotifyPayload, 'chatRoomId' | 'chatRoomName'>;
  const fromUserId = toNonEmptyString(input.from?.name);
  const targetUserId = resolvePrimaryTarget(input.to);

  switch (input.operation) {
    case 1:
      return buildEvent(ChatRoomEventName.CHAT_ROOM_DESTROYED, basePayload);
    case 10:
      return buildEvent(ChatRoomEventName.REMOVED_FROM_CHAT_ROOM, {
        ...basePayload,
        reason: input.reason,
        reasonCode: Number.isFinite(Number(input.reason)) ? Number(input.reason) : 0,
        participantId: targetUserId ?? fromUserId,
      });
    case 17:
      return buildEvent(ChatRoomEventName.MEMBERS_JOINED, {
        ...basePayload,
        memberIds: resolveMembers(input.members, fromUserId),
        ext: input.ext ?? input.eventExt,
      });
    case 18:
      return buildEvent(ChatRoomEventName.MEMBERS_EXITED, {
        ...basePayload,
        memberIds: resolveMembers(input.members, fromUserId),
      });
    case 20:
      return buildEvent(ChatRoomEventName.OWNER_CHANGED, {
        ...basePayload,
        oldOwnerId: fromUserId,
        newOwnerId: targetUserId,
      });
    case 21:
      return buildEvent(ChatRoomEventName.ADMIN_ADDED, {
        ...basePayload,
        adminId: targetUserId ?? fromUserId,
      });
    case 22:
      return buildEvent(ChatRoomEventName.ADMIN_REMOVED, {
        ...basePayload,
        adminId: targetUserId ?? fromUserId,
      });
    case 23: {
      const muteMap = resolveUserMuteTimeMap(input.ext ?? input.eventExt);
      const userIds = muteMap
        ? Object.keys(muteMap)
        : resolveMembers(input.members, targetUserId);
      const defaultExpire = 4638873600000;
      return buildEvent(ChatRoomEventName.MUTE_LIST_ADDED, {
        ...basePayload,
        userIds,
        muteMembers: muteMap ?? Object.fromEntries(userIds.map(id => [id, defaultExpire])),
        muteExpire: resolveMuteExpire(input.reason, input.eventExt) ?? defaultExpire,
      });
    }
    case 24:
      return buildEvent(ChatRoomEventName.MUTE_LIST_REMOVED, {
        ...basePayload,
        userIds: resolveMembers(input.members, targetUserId),
      });
    case 25:
      return buildEvent(ChatRoomEventName.ANNOUNCEMENT_CHANGED, {
        ...basePayload,
        announcement: input.reason ?? '',
      });
    case 29:
      return buildEvent(ChatRoomEventName.ALLOW_LIST_ADDED, {
        ...basePayload,
        userIds: resolveMembers(input.members, targetUserId),
      });
    case 30:
      return buildEvent(ChatRoomEventName.ALLOW_LIST_REMOVED, {
        ...basePayload,
        userIds: resolveMembers(input.members, targetUserId),
      });
    case 31:
      return buildEvent(ChatRoomEventName.ALL_MEMBER_MUTE_STATE_CHANGED, {
        ...basePayload,
        isMuted: true,
      });
    case 32:
      return buildEvent(ChatRoomEventName.ALL_MEMBER_MUTE_STATE_CHANGED, {
        ...basePayload,
        isMuted: false,
      });
    case 14:
      return buildEvent(ChatRoomEventName.CHAT_ROOM_INFO_CHANGED, {
        ...basePayload,
        shouldFetchChatRoomDetail: true,
        chatRoomPatch: resolveChatRoomPatch(input.eventExt),
      });
    case 43: {
      const attributePayload = resolveAttributesPayload(input.eventExt);
      return buildEvent(ChatRoomEventName.ATTRIBUTES_UPDATE, {
        ...basePayload,
        attributes: attributePayload.attributes,
        from: attributePayload.from ?? fromUserId,
      });
    }
    case 44: {
      const attributePayload = resolveAttributesPayload(input.eventExt);
      return buildEvent(ChatRoomEventName.ATTRIBUTES_REMOVED, {
        ...basePayload,
        keyList: attributePayload.keyList,
        from: attributePayload.from ?? fromUserId,
      });
    }
    default:
      return null;
  }
};
