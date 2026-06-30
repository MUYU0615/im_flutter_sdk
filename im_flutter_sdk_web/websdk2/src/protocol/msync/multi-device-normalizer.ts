/**
 * MultiDevice 事件归一化器。
 *
 * 负责把原始协议载荷收敛为公开 MultiDevice payload，并处理设备来源归一、同设备过滤与 unknown operation。
 */

import { logger } from '../../utils/logger';
import { CONVERSATION_TYPE, type ConversationType } from '../../types/conversation';
import type {
  MultiDeviceContactEvent,
  MultiDeviceConversationEvent,
  MultiDeviceConversationOperation,
  MultiDeviceEventCategory,
  MultiDeviceGroupEvent,
  MultiDeviceGroupOperation,
  MultiDeviceMessageRemovedEvent,
  MultiDeviceMessageRemovedOperation,
  MultiDeviceThreadEvent,
  MultiDeviceThreadOperation,
  MultiDeviceContactOperation,
} from '../../types/multi-device';

export interface MultiDeviceNormalizeContext {
  readonly userId: string;
  readonly clientResource?: string;
}

interface JidLike {
  readonly name?: string;
  readonly clientResource?: string;
  readonly domain?: string;
}

interface MultiDeviceRawRecord {
  readonly [key: string]: unknown;
}

const toNonEmptyString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const toStringArray = (value: unknown): ReadonlyArray<string> | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const items = value
    .map(item => toNonEmptyString(item))
    .filter((item): item is string => typeof item === 'string');
  return items.length > 0 ? items : undefined;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const resolveDeviceId = (...candidates: ReadonlyArray<unknown>): string | undefined => {
  for (const candidate of candidates) {
    const deviceId = toNonEmptyString(candidate);
    if (deviceId) {
      return deviceId;
    }
  }
  return undefined;
};

const isSameDeviceEcho = (
  deviceId: string | undefined,
  clientResource: string | undefined
): boolean => {
  return Boolean(deviceId && clientResource && deviceId === clientResource);
};

const resolveRosterTarget = (to: ReadonlyArray<JidLike> | undefined, from?: JidLike): string => {
  return toNonEmptyString(to?.[0]?.name) ?? toNonEmptyString(from?.name) ?? '';
};

const resolveGroupUserIds = (
  members: ReadonlyArray<string> | undefined,
  to: ReadonlyArray<JidLike> | undefined,
  from?: JidLike
): ReadonlyArray<string> => {
  const explicitMembers = toStringArray(members);
  if (explicitMembers && explicitMembers.length > 0) {
    return explicitMembers;
  }
  const toUserIds = (to ?? [])
    .map(item => toNonEmptyString(item.name))
    .filter((item): item is string => typeof item === 'string');
  if (toUserIds.length > 0) {
    return toUserIds;
  }
  const fallback = toNonEmptyString(from?.name);
  return fallback ? [fallback] : [];
};

const resolveConversationType = (type: unknown): ConversationType => {
  return type === 'chat' || type === 'singleChat'
    ? CONVERSATION_TYPE.SINGLE_CHAT
    : CONVERSATION_TYPE.GROUP_CHAT;
};

const parseMarkValue = (value: unknown): number | undefined => {
  const fromNumber = toNumber(value);
  if (fromNumber !== undefined) {
    return fromNumber;
  }
  if (typeof value === 'string') {
    const match = value.match(/(\d+)/);
    if (match) {
      const parsed = Number(match[1]);
      return Number.isFinite(parsed) ? parsed : undefined;
    }
  }
  return undefined;
};

const mapContactOperation = (operation: number): MultiDeviceContactOperation => {
  switch (operation) {
    case 3:
      return 'CONTACT_REMOVE';
    case 4:
    case 8:
      return 'CONTACT_ACCEPT';
    case 5:
    case 9:
      return 'CONTACT_DECLINE';
    case 6:
      return 'CONTACT_BAN';
    case 7:
      return 'CONTACT_ALLOW';
    default:
      logger.warn('Discarded unknown MultiDevice contact operation', { operation });
      return 'UNKNOWN';
  }
};

const mapGroupOperation = (operation: number): MultiDeviceGroupOperation => {
  switch (operation) {
    case 0:
      return 'GROUP_CREATE';
    case 1:
      return 'GROUP_DESTROY';
    case 2:
      return 'GROUP_JOIN';
    case 3:
      return 'GROUP_LEAVE';
    case 4:
      return 'GROUP_APPLY';
    case 5:
      return 'GROUP_APPLY_ACCEPT';
    case 6:
      return 'GROUP_APPLY_DECLINE';
    case 7:
      return 'GROUP_INVITE';
    case 8:
      return 'GROUP_INVITE_ACCEPT';
    case 9:
      return 'GROUP_INVITE_DECLINE';
    case 10:
      return 'GROUP_KICK';
    case 12:
      return 'GROUP_BAN';
    case 13:
      return 'GROUP_ALLOW';
    case 15:
      return 'GROUP_BLOCK';
    case 16:
      return 'GROUP_UNBLOCK';
    case 20:
      return 'GROUP_ASSIGN_OWNER';
    case 21:
      return 'GROUP_ADD_ADMIN';
    case 22:
      return 'GROUP_REMOVE_ADMIN';
    case 23:
      return 'GROUP_ADD_MUTE';
    case 24:
      return 'GROUP_REMOVE_MUTE';
    case 29:
      return 'GROUP_ADD_USER_WHITE_LIST';
    case 30:
      return 'GROUP_REMOVE_USER_WHITE_LIST';
    case 31:
      return 'GROUP_ALL_BAN';
    case 32:
      return 'GROUP_REMOVE_ALL_BAN';
    case 45:
      return 'GROUP_MEMBER_METADATA_CHANGED';
    case 14:
      return 'GROUP_UPDATED';
    default:
      logger.warn('Discarded unknown MultiDevice group operation', { operation });
      return 'UNKNOWN';
  }
};

const mapThreadOperation = (operation: number): MultiDeviceThreadOperation => {
  switch (operation) {
    case 33:
      return 'THREAD_CREATE';
    case 35:
      return 'THREAD_JOIN';
    case 38:
      return 'THREAD_UPDATE';
    case 36:
      return 'THREAD_LEAVE';
    case 34:
      return 'THREAD_DESTROY';
    case 37:
      return 'THREAD_KICK';
    default:
      logger.warn('Discarded unknown MultiDevice thread operation', { operation });
      return 'UNKNOWN';
  }
};

const mapConversationOperation = (operation: string): MultiDeviceConversationOperation => {
  switch (operation) {
    case 'del':
      return 'CONVERSATION_DELETED';
    case 'top':
      return 'CONVERSATION_PINNED';
    case 'not_top':
      return 'CONVERSATION_UNPINNED';
    case 'mark':
    case 'mark_delete':
      return 'CONVERSATION_MARK';
    case 'pin':
      return 'CONVERSATION_PINNED';
    case 'pin_delete':
      return 'CONVERSATION_UNPINNED';
    case 'setSilentModeForConversation':
    case 'removeSilentModeForConversation':
      return 'CONVERSATION_MUTE_INFO_CHANGED';
    default:
      logger.warn('Discarded unknown MultiDevice conversation operation', { operation });
      return 'UNKNOWN';
  }
};

const mapMessageRemovedOperation = (operation: string | undefined): MultiDeviceMessageRemovedOperation => {
  if (!operation || operation === 'deleteRoaming' || operation === 'MESSAGE_REMOVED') {
    return 'MESSAGE_REMOVED';
  }
  logger.warn('Discarded unknown MultiDevice message-removed operation', { operation });
  return 'UNKNOWN';
};

export const normalizeMultiDeviceContactEvent = (
  input: {
    readonly operation: number;
    readonly from?: JidLike;
    readonly to?: ReadonlyArray<JidLike>;
    readonly rosterVersion?: string;
    readonly ext?: string;
    readonly timestamp?: number;
    readonly raw?: MultiDeviceRawRecord;
  },
  context: MultiDeviceNormalizeContext
): MultiDeviceContactEvent | null => {
  const targetUserId = resolveRosterTarget(input.to, input.from);
  if (!targetUserId) {
    logger.warn('Discarded MultiDevice contact event without target user', {
      operation: input.operation,
    });
    return null;
  }
  const deviceId = resolveDeviceId(
    input.from?.clientResource,
    input.to?.[0]?.clientResource,
    input.raw?.deviceId,
    input.raw?.resource,
    input.raw?.clientResource
  );
  if (isSameDeviceEcho(deviceId, context.clientResource)) {
    logger.debug('Discarded same-device MultiDevice contact echo', {
      operation: input.operation,
    });
    return null;
  }
  const operation = mapContactOperation(input.operation);
  if (operation === 'UNKNOWN') {
    return null;
  }
  return {
    category: 'contact',
    operation,
    targetUserId,
    rosterVersion: input.rosterVersion,
    ext: input.ext,
    deviceId,
    timestamp: input.timestamp,
    raw: input.raw,
  };
};

export const normalizeMultiDeviceGroupEvent = (
  input: {
    readonly operation: number;
    readonly groupId: string;
    readonly groupName?: string;
    readonly from?: JidLike;
    readonly to?: ReadonlyArray<JidLike>;
    readonly reason?: string;
    readonly eventExt?: string;
    readonly members?: ReadonlyArray<string>;
    readonly timestamp?: number;
    readonly raw?: MultiDeviceRawRecord;
  },
  context: MultiDeviceNormalizeContext
): MultiDeviceGroupEvent | null => {
  if (!input.groupId) {
    logger.warn('Discarded MultiDevice group event without groupId', {
      operation: input.operation,
    });
    return null;
  }
  const deviceId = resolveDeviceId(
    input.from?.clientResource,
    input.raw?.resource,
    input.raw?.clientResource
  );
  if (isSameDeviceEcho(deviceId, context.clientResource)) {
    logger.debug('Discarded same-device MultiDevice group echo', {
      operation: input.operation,
      groupId: input.groupId,
    });
    return null;
  }
  const operation = mapGroupOperation(input.operation);
  if (operation === 'UNKNOWN') {
    return null;
  }
  const userIds = resolveGroupUserIds(input.members, input.to, input.from);
  return {
    category: 'group',
    operation,
    groupId: input.groupId,
    userIds: userIds.length > 0 ? userIds : undefined,
    operatorId: toNonEmptyString(input.from?.name),
    groupName: input.groupName,
    deviceId,
    timestamp: input.timestamp,
    raw: input.raw,
  };
};

export const normalizeMultiDeviceThreadEvent = (
  input: {
    readonly operation: number;
    readonly threadId: string;
    readonly threadName?: string;
    readonly parentId?: string;
    readonly from?: JidLike;
    readonly to?: ReadonlyArray<JidLike>;
    readonly members?: ReadonlyArray<string>;
    readonly timestamp?: number;
    readonly raw?: MultiDeviceRawRecord;
  },
  context: MultiDeviceNormalizeContext
): MultiDeviceThreadEvent | null => {
  if (!input.threadId) {
    logger.warn('Discarded MultiDevice thread event without threadId', {
      operation: input.operation,
    });
    return null;
  }
  const deviceId = resolveDeviceId(
    input.from?.clientResource,
    input.raw?.resource,
    input.raw?.clientResource
  );
  if (isSameDeviceEcho(deviceId, context.clientResource)) {
    logger.debug('Discarded same-device MultiDevice thread echo', {
      operation: input.operation,
      threadId: input.threadId,
    });
    return null;
  }
  const operation = mapThreadOperation(input.operation);
  if (operation === 'UNKNOWN') {
    return null;
  }
  const userIds = resolveGroupUserIds(input.members, input.to, input.from);
  return {
    category: 'thread',
    operation,
    threadId: input.threadId,
    parentId: input.parentId,
    userIds: userIds.length > 0 ? userIds : undefined,
    operatorId: toNonEmptyString(input.from?.name),
    threadName: input.threadName,
    deviceId,
    timestamp: input.timestamp,
    raw: input.raw,
  };
};

export const normalizeMultiDeviceConversationEvent = (
  input: {
    readonly operation: string;
    readonly id: string;
    readonly type?: string;
    readonly from?: string;
    readonly res?: string;
    readonly ts?: unknown;
    readonly ext?: string;
    readonly raw?: MultiDeviceRawRecord;
  },
  context: MultiDeviceNormalizeContext
): MultiDeviceConversationEvent | null => {
  const deviceId = resolveDeviceId(input.res, input.raw?.resource, input.raw?.clientResource);
  if (isSameDeviceEcho(deviceId, context.clientResource)) {
    logger.debug('Discarded same-device MultiDevice conversation echo', {
      operation: input.operation,
      conversationId: input.id,
    });
    return null;
  }
  const conversationType = resolveConversationType(input.type);
  const conversationId =
    toNonEmptyString(input.id) ??
    (conversationType === CONVERSATION_TYPE.SINGLE_CHAT ? toNonEmptyString(input.from) : undefined);
  if (!conversationId) {
    logger.warn('Discarded MultiDevice conversation event without conversationId', {
      operation: input.operation,
    });
    return null;
  }
  const operation = mapConversationOperation(input.operation);
  if (operation === 'UNKNOWN') {
    return null;
  }
  return {
    category: 'conversation',
    operation,
    conversationId,
    conversationType,
    mark: input.operation === 'mark' || input.operation === 'mark_delete' ? parseMarkValue(input.ext) : undefined,
    operatorId: toNonEmptyString(input.from),
    deviceId,
    timestamp: toNumber(input.ts),
    raw: input.raw,
  };
};

export const normalizeMultiDeviceMessageRemovedEvent = (
  input: {
    readonly chatType?: string;
    readonly to?: string;
    readonly resource?: string;
    readonly msgIdList?: ReadonlyArray<string>;
    readonly deleteTime?: unknown;
    readonly lastMsgId?: string;
    readonly messageRoamingType?: string;
    readonly raw?: MultiDeviceRawRecord;
  },
  context: MultiDeviceNormalizeContext
): MultiDeviceMessageRemovedEvent | null => {
  const deviceId = resolveDeviceId(input.resource, input.raw?.resource, input.raw?.clientResource);
  if (isSameDeviceEcho(deviceId, context.clientResource)) {
    logger.debug('Discarded same-device MultiDevice roaming delete echo', {
      conversationId: input.to,
    });
    return null;
  }
  const conversationId = toNonEmptyString(input.to);
  if (!conversationId) {
    logger.warn('Discarded MultiDevice roaming delete event without conversationId', {});
    return null;
  }
  const lastMsgId = toNonEmptyString(input.lastMsgId);
  const messageIds = toStringArray(input.msgIdList) ?? (lastMsgId ? [lastMsgId] : undefined);
  const beforeTimestamp = toNumber(input.deleteTime);
  if (!messageIds && beforeTimestamp === undefined) {
    logger.warn('Discarded MultiDevice roaming delete event without messageIds or beforeTimestamp', {
      conversationId,
    });
    return null;
  }
  const operation = mapMessageRemovedOperation(input.messageRoamingType);
  if (operation === 'UNKNOWN') {
    return null;
  }
  return {
    category: 'messageRemoved',
    operation,
    conversationId,
    conversationType:
      input.chatType === 'groupchat' || input.chatType === 'groupChat'
        ? CONVERSATION_TYPE.GROUP_CHAT
        : CONVERSATION_TYPE.SINGLE_CHAT,
    messageIds,
    beforeTimestamp,
    deviceId,
    raw: input.raw,
  };
};

export const normalizeMultiDeviceConversationMuteEvents = (
  values: unknown,
  context: MultiDeviceNormalizeContext
): ReadonlyArray<MultiDeviceConversationEvent> => {
  if (!Array.isArray(values) || values.length === 0) {
    return [];
  }
  const events: MultiDeviceConversationEvent[] = [];
  for (const item of values) {
    if (!isRecord(item)) {
      continue;
    }
    const deviceId = resolveDeviceId(item.operator_resource, item.resource, item.clientResource);
    if (isSameDeviceEcho(deviceId, context.clientResource)) {
      continue;
    }
    const rawConversationId = toNonEmptyString(item.group) ?? toNonEmptyString(item.user);
    if (!rawConversationId || !isRecord(item.data)) {
      continue;
    }
    const conversationType = toNonEmptyString(item.group)
      ? CONVERSATION_TYPE.GROUP_CHAT
      : CONVERSATION_TYPE.SINGLE_CHAT;
    const silentMode = item.data;
    events.push({
      category: 'conversation',
      operation: 'CONVERSATION_MUTE_INFO_CHANGED',
      conversationId: rawConversationId,
      conversationType,
      remindType: toNonEmptyString(silentMode.type),
      silentMode,
      deviceId,
      raw: item as MultiDeviceRawRecord,
    });
  }
  return events;
};

export const getMultiDeviceEventName = (
  category: MultiDeviceEventCategory
): 'onMultiDeviceContact' | 'onMultiDeviceGroup' | 'onMultiDeviceThread' | 'onMultiDeviceConversation' | 'onMultiDeviceMessageRemoved' => {
  switch (category) {
    case 'contact':
      return 'onMultiDeviceContact';
    case 'group':
      return 'onMultiDeviceGroup';
    case 'thread':
      return 'onMultiDeviceThread';
    case 'conversation':
      return 'onMultiDeviceConversation';
    case 'messageRemoved':
      return 'onMultiDeviceMessageRemoved';
  }
};

export { resolveDeviceId, isSameDeviceEcho };
