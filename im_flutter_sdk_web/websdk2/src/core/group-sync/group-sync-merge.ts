import {
  JOINED_GROUP_PREVIEW_STORAGE_LIMIT,
  JOINED_GROUP_SERVER_LIMIT,
} from '../../cache/joined-group-preview-cache';
import type { JoinedGroupSnapshot, JoinedGroupSummary } from '../../types/group';
import type { GroupSyncMergeInput } from './group-sync-types';

const getUpdateClock = (item: JoinedGroupSummary): number => item.updatedAt ?? 0;

const shouldReplace = (
  current: JoinedGroupSummary | undefined,
  incoming: JoinedGroupSummary
): boolean => {
  if (!current) {
    return true;
  }
  const incomingClock = getUpdateClock(incoming);
  const currentClock = getUpdateClock(current);
  return incomingClock >= currentClock;
};

export const mergeJoinedGroupSnapshot = (input: GroupSyncMergeInput): JoinedGroupSnapshot => {
  const byId = new Map<string, JoinedGroupSummary>();
  for (const item of input.existingItems) {
    byId.set(item.groupId, { ...item });
  }
  for (const item of input.incomingItems) {
    const current = byId.get(item.groupId);
    if (shouldReplace(current, item)) {
      byId.set(item.groupId, {
        ...(current ?? {}),
        ...item,
        groupId: item.groupId,
      });
    }
  }
  const items = Array.from(byId.values()).sort((left, right) => {
    const joinedDelta = (right.joinedAt ?? 0) - (left.joinedAt ?? 0);
    if (joinedDelta !== 0) {
      return joinedDelta;
    }
    return left.groupId.localeCompare(right.groupId);
  });
  const limited = items.length >= JOINED_GROUP_SERVER_LIMIT;
  return {
    items,
    meta: {
      integrity: limited ? 'limited' : 'synced',
      limited,
      storageLimit: JOINED_GROUP_PREVIEW_STORAGE_LIMIT,
      serverLimit: JOINED_GROUP_SERVER_LIMIT,
      source: 'sync',
      lastSyncFinishedTs: input.lastSyncFinishedTs,
      lastSuccessfulAt: Date.now(),
    },
  };
};
