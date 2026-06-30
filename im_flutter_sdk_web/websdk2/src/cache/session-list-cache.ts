import type {
  ConversationMark,
  ConversationType,
  ConversationItem,
  SessionListRemindType,
  SessionMessageSnippet,
} from '../types/conversation';
import type { Sender } from '../types/sender';
import type { SessionListCacheRecord } from './cache-types';
import { isRecord } from './cache-utils';

const normalizeRemindType = (value: unknown): SessionListRemindType => {
  if (value === 'DEFAULT' || value === 'ALL' || value === 'AT' || value === 'NONE') {
    return value;
  }
  if (value === 'mentionOnly') {
    return 'AT';
  }
  if (value === 'mute') {
    return 'NONE';
  }
  return 'DEFAULT';
};

const normalizeConversationType = (value: unknown): ConversationType | null => {
  if (value === 'singleChat' || value === 'groupChat' || value === 'chatRoom') {
    return value;
  }
  return null;
};

const normalizeMessageDirect = (value: unknown): SessionMessageSnippet['direct'] => {
  if (value === 'SEND' || value === 'RECEIVE') {
    return value;
  }
  return undefined;
};

const normalizeMessageStatus = (value: unknown): SessionMessageSnippet['status'] => {
  if (
    value === 'sending' ||
    value === 'sent' ||
    value === 'failed' ||
    value === 'delivered' ||
    value === 'read'
  ) {
    return value;
  }
  return undefined;
};

const normalizeModifiedInfo = (value: unknown): SessionMessageSnippet['modifiedInfo'] => {
  if (!isRecord(value)) {
    return undefined;
  }
  if (
    typeof value.operatorId !== 'string' ||
    typeof value.operationCount !== 'number' ||
    typeof value.operationTime !== 'number'
  ) {
    return undefined;
  }
  return {
    operatorId: value.operatorId,
    operationCount: value.operationCount,
    operationTime: value.operationTime,
  };
};

const stripBodyType = (body: Record<string, unknown>): Record<string, unknown> => {
  const next = { ...body };
  delete next.type;
  return next;
};

const normalizeSender = (value: unknown, fallbackUserId: string): Sender | null => {
  if (isRecord(value) && typeof value.userId === 'string') {
    const sender: Sender = {
      userId: value.userId,
    };
    if (typeof value.nickname === 'string') {
      sender.nickname = value.nickname;
    }
    if (typeof value.avatarUrl === 'string') {
      sender.avatarUrl = value.avatarUrl;
    }
    return sender;
  }
  if (fallbackUserId) {
    return {
      userId: fallbackUserId,
    };
  }
  return null;
};

const normalizeLastMessage = (value: unknown): SessionMessageSnippet | null => {
  if (!isRecord(value)) {
    return null;
  }
  const msgServerId = typeof value.msgServerId === 'string' ? value.msgServerId : null;
  if (
    msgServerId === null ||
    typeof value.from !== 'string' ||
    typeof value.timestamp !== 'number' ||
    !isRecord(value.body)
  ) {
    return null;
  }
  const sender = normalizeSender(value.sender, value.from);
  if (!sender) {
    return null;
  }
  const conversationType = normalizeConversationType(value.conversationType);
  const status = normalizeMessageStatus(value.status);
  const direct = normalizeMessageDirect(value.direct);
  const modifiedInfo = normalizeModifiedInfo(value.modifiedInfo);
  const userInfoUpdateTime =
    typeof value.userInfoUpdateTime === 'number' ? value.userInfoUpdateTime : undefined;
  const namecardUpdateTime =
    typeof value.namecardUpdateTime === 'number' ? value.namecardUpdateTime : undefined;
  return {
    msgServerId,
    from: value.from,
    to: typeof value.to === 'string' ? value.to : '',
    sender,
    body: stripBodyType(value.body),
    timestamp: value.timestamp,
    ...(typeof value.conversationId === 'string' ? { conversationId: value.conversationId } : {}),
    ...(conversationType ? { conversationType } : {}),
    ...(typeof value.type === 'string' && value.type.length > 0
      ? { type: value.type as SessionMessageSnippet['type'] }
      : {}),
    ...(status ? { status } : {}),
    ...(direct ? { direct } : {}),
    ...(modifiedInfo ? { modifiedInfo } : {}),
    ...(userInfoUpdateTime !== undefined ? { userInfoUpdateTime } : {}),
    ...(namecardUpdateTime !== undefined ? { namecardUpdateTime } : {}),
  };
};

const normalizeMarks = (value: unknown): ReadonlyArray<ConversationMark> => {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<ConversationMark>();
  const marks: ConversationMark[] = [];
  const items = value as ReadonlyArray<unknown>;
  for (const item of items) {
    const raw = typeof item === 'string' && item.startsWith('mark_') ? item.slice(5) : item;
    const parsed =
      typeof raw === 'number'
        ? raw
        : typeof raw === 'string'
          ? Number.parseInt(raw, 10)
          : Number.NaN;
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 19) {
      continue;
    }
    const mark = parsed as ConversationMark;
    if (seen.has(mark)) {
      continue;
    }
    seen.add(mark);
    marks.push(mark);
  }
  return marks;
};

const compareSessionListRecord = (
  left: SessionListCacheRecord,
  right: SessionListCacheRecord
): number => {
  const leftPinned = typeof left.pinnedTimestamp === 'number' ? left.pinnedTimestamp : 0;
  const rightPinned = typeof right.pinnedTimestamp === 'number' ? right.pinnedTimestamp : 0;
  if (leftPinned !== rightPinned) {
    return rightPinned - leftPinned;
  }
  const leftUpdated = left.lastMessageAt ?? left.updatedAt;
  const rightUpdated = right.lastMessageAt ?? right.updatedAt;
  if (leftUpdated !== rightUpdated) {
    return rightUpdated - leftUpdated;
  }
  return left.conversationId.localeCompare(right.conversationId);
};

export class SessionListCache {
  private items: SessionListCacheRecord[] = [];

  public load(rawItems: ReadonlyArray<SessionListCacheRecord>, now: number): void {
    const normalized: SessionListCacheRecord[] = [];
    for (const item of rawItems) {
      const normalizedItem = this.normalizeItem(item, now);
      if (normalizedItem) {
        normalized.push(normalizedItem);
      }
    }
    this.items = normalized.sort(compareSessionListRecord);
  }

  public getAll(): ReadonlyArray<SessionListCacheRecord> {
    return this.items;
  }

  public setAll(items: ReadonlyArray<SessionListCacheRecord>): void {
    const now = Date.now();
    const normalized: SessionListCacheRecord[] = [];
    for (const item of items) {
      const normalizedItem = this.normalizeItem(item, now);
      if (normalizedItem) {
        normalized.push(normalizedItem);
      }
    }
    this.items = normalized.sort(compareSessionListRecord);
  }

  public exportItems(): ReadonlyArray<ConversationItem> {
    return this.items.map(({ updatedAt: _updatedAt, ...item }) => item);
  }

  private normalizeItem(item: SessionListCacheRecord, now: number): SessionListCacheRecord | null {
    if (!isRecord(item)) {
      return null;
    }
    const raw = item as SessionListCacheRecord;
    const conversationId = typeof raw.conversationId === 'string' ? raw.conversationId : '';
    if (!conversationId) {
      return null;
    }
    const conversationType = normalizeConversationType(raw.conversationType);
    if (!conversationType) {
      return null;
    }
    const conversationName =
      typeof raw.conversationName === 'string' && raw.conversationName.length > 0
        ? raw.conversationName
        : conversationId;
    const conversationAvatar =
      typeof raw.conversationAvatar === 'string' ? raw.conversationAvatar : undefined;
    return {
      conversationId,
      conversationType,
      unreadCount:
        typeof item.unreadCount === 'number' && item.unreadCount >= 0
          ? Math.floor(item.unreadCount)
          : 0,
      lastMessage: normalizeLastMessage(item.lastMessage),
      lastMessageAt: typeof item.lastMessageAt === 'number' ? item.lastMessageAt : undefined,
      isPinned: typeof item.isPinned === 'boolean' ? item.isPinned : undefined,
      pinnedTimestamp: typeof raw.pinnedTimestamp === 'number' ? raw.pinnedTimestamp : undefined,
      marks: normalizeMarks(item.marks),
      readAt: typeof raw.readAt === 'number' ? raw.readAt : undefined,
      remindType: normalizeRemindType(item.remindType),
      conversationName,
      conversationAvatar,
      updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : now,
    };
  }
}
