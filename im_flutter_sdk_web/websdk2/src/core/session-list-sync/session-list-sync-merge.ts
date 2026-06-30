import type { SessionListCacheRecord } from '../../cache/cache-types';
import type { Message } from '../../types';

const getPinnedTime = (item: Pick<SessionListCacheRecord, 'pinnedTimestamp'>): number => {
  return typeof item.pinnedTimestamp === 'number' ? item.pinnedTimestamp : 0;
};

const getUpdatedAt = (
  item: Pick<SessionListCacheRecord, 'lastMessageAt' | 'updatedAt'>
): number => {
  return item.lastMessageAt ?? item.updatedAt;
};

export const sortSessionListRecords = (
  items: ReadonlyArray<SessionListCacheRecord>
): ReadonlyArray<SessionListCacheRecord> => {
  return [...items].sort((left, right) => {
    const pinnedDiff = getPinnedTime(right) - getPinnedTime(left);
    if (pinnedDiff !== 0) {
      return pinnedDiff;
    }
    const updatedDiff = getUpdatedAt(right) - getUpdatedAt(left);
    if (updatedDiff !== 0) {
      return updatedDiff;
    }
    return left.conversationId.localeCompare(right.conversationId);
  });
};

const buildSessionKey = (
  item: Pick<SessionListCacheRecord, 'conversationId' | 'conversationType'>
): string => {
  return `${item.conversationType}:${item.conversationId}`;
};

const isRealtimeOnlyRecord = (
  item: SessionListCacheRecord,
  syncStartedAt?: number
): boolean => {
  if (typeof syncStartedAt !== 'number') {
    return false;
  }
  return item.updatedAt >= syncStartedAt;
};

const isMessageNewerThanSnapshot = (
  snapshotItem: SessionListCacheRecord,
  realtimeItem: SessionListCacheRecord
): boolean => {
  return getUpdatedAt(realtimeItem) > getUpdatedAt(snapshotItem);
};

const mergeMessageSnippet = (
  snapshotItem: SessionListCacheRecord,
  realtimeItem: SessionListCacheRecord
): SessionListCacheRecord['lastMessage'] => {
  if (!realtimeItem.lastMessage) {
    return snapshotItem.lastMessage;
  }
  if (!snapshotItem.lastMessage) {
    return realtimeItem.lastMessage;
  }
  return realtimeItem.lastMessage.timestamp >= snapshotItem.lastMessage.timestamp
    ? realtimeItem.lastMessage
    : snapshotItem.lastMessage;
};

const mergeRealtimePatchIntoSnapshot = (
  snapshotItem: SessionListCacheRecord,
  realtimeItem: SessionListCacheRecord
): SessionListCacheRecord => {
  if (!isMessageNewerThanSnapshot(snapshotItem, realtimeItem)) {
    return snapshotItem;
  }
  return {
    ...snapshotItem,
    unreadCount: Math.max(snapshotItem.unreadCount, realtimeItem.unreadCount),
    lastMessage: mergeMessageSnippet(snapshotItem, realtimeItem),
    lastMessageAt: Math.max(
      snapshotItem.lastMessageAt ?? 0,
      realtimeItem.lastMessageAt ?? 0
    ),
    isPinned: realtimeItem.isPinned ?? snapshotItem.isPinned,
    pinnedTimestamp:
      typeof realtimeItem.pinnedTimestamp === 'number'
        ? realtimeItem.pinnedTimestamp
        : snapshotItem.pinnedTimestamp,
    marks: realtimeItem.marks.length > 0 ? realtimeItem.marks : snapshotItem.marks,
    readAt: realtimeItem.readAt ?? snapshotItem.readAt,
    remindType: realtimeItem.remindType ?? snapshotItem.remindType,
    conversationName:
      realtimeItem.conversationName === realtimeItem.conversationId
        ? snapshotItem.conversationName
        : realtimeItem.conversationName,
    conversationAvatar: realtimeItem.conversationAvatar ?? snapshotItem.conversationAvatar,
    updatedAt: Math.max(snapshotItem.updatedAt, realtimeItem.updatedAt),
  };
};

export const mergeSessionListSnapshot = (options: {
  readonly snapshot: ReadonlyArray<SessionListCacheRecord>;
  readonly existing: ReadonlyArray<SessionListCacheRecord>;
  readonly syncStartedAt?: number;
}): ReadonlyArray<SessionListCacheRecord> => {
  const existingMap = new Map<string, SessionListCacheRecord>();
  for (const item of options.existing) {
    existingMap.set(buildSessionKey(item), item);
  }

  const merged = options.snapshot.map(item => {
    const current = existingMap.get(buildSessionKey(item));
    if (!current) {
      return item;
    }
    return mergeRealtimePatchIntoSnapshot(item, current);
  });

  const preservedRealtimeOnly = options.existing.filter(item => {
    if (options.snapshot.some(snapshotItem => buildSessionKey(snapshotItem) === buildSessionKey(item))) {
      return false;
    }
    // 035：若同步开始后才由实时消息补进本地的新会话，本轮快照即便暂未返回，也不能把更晚的本地事实删掉。
    return isRealtimeOnlyRecord(item, options.syncStartedAt);
  });

  return sortSessionListRecords([...merged, ...preservedRealtimeOnly]);
};

export const applySessionListMessagePatch = (options: {
  readonly existing: ReadonlyArray<SessionListCacheRecord>;
  readonly nextRecord: SessionListCacheRecord;
  readonly message: Message;
}): ReadonlyArray<SessionListCacheRecord> => {
  const targetKey = buildSessionKey(options.nextRecord);
  const others = options.existing.filter(item => buildSessionKey(item) !== targetKey);
  void options.message;
  return sortSessionListRecords([options.nextRecord, ...others]);
};

export const mergeSessionListIncrementalWithPinnedOverride = (options: {
  readonly existing: ReadonlyArray<SessionListCacheRecord>;
  readonly incoming: ReadonlyArray<SessionListCacheRecord>;
}): ReadonlyArray<SessionListCacheRecord> => {
  const incomingPinned = options.incoming.filter(item => getPinnedTime(item) > 0);
  const incomingMap = new Map<string, SessionListCacheRecord>();
  for (const item of options.incoming) {
    incomingMap.set(buildSessionKey(item), item);
  }

  const nextBase =
    incomingPinned.length > 0
      ? options.existing.filter(item => {
          if (incomingMap.has(buildSessionKey(item))) {
            return false;
          }
          return getPinnedTime(item) === 0;
        })
      : options.existing.filter(item => !incomingMap.has(buildSessionKey(item)));

  return sortSessionListRecords([...nextBase, ...options.incoming]);
};
