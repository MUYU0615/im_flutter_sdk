import type {
  JoinedGroupSnapshot,
  JoinedGroupSnapshotMeta,
  JoinedGroupSummary,
} from '../types/group';
import type { SessionListRemindType } from '../types/conversation';
import type { JoinedGroupPreviewStorageRecord } from './cache-types';

export const JOINED_GROUP_PREVIEW_STORAGE_LIMIT = 100;
export const JOINED_GROUP_SERVER_LIMIT = 3000;

const cloneSummary = (summary: JoinedGroupSummary): JoinedGroupSummary => ({ ...summary });

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const normalizeRemindType = (value: unknown): SessionListRemindType | undefined => {
  if (value === 'DEFAULT' || value === 'ALL' || value === 'AT' || value === 'NONE') {
    return value;
  }
  if (value === 'mentionOnly') {
    return 'AT';
  }
  if (value === 'mute') {
    return 'NONE';
  }
  if (value === 'default') {
    return 'DEFAULT';
  }
  if (value === 2) {
    return 'AT';
  }
  if (value === 3) {
    return 'NONE';
  }
  if (value === 0) {
    return 'DEFAULT';
  }
  if (value === 1) {
    return 'ALL';
  }
  return undefined;
};

const normalizeSummary = (value: unknown): JoinedGroupSummary | null => {
  if (!isRecord(value) || typeof value.groupId !== 'string' || value.groupId.length === 0) {
    return null;
  }
  return {
    groupId: value.groupId,
    name: typeof value.name === 'string' ? value.name : '',
    description: typeof value.description === 'string' ? value.description : undefined,
    memberCount: typeof value.memberCount === 'number' ? value.memberCount : undefined,
    role:
      value.role === 'owner' || value.role === 'admin' || value.role === 'member'
        ? value.role
        : undefined,
    disabled: typeof value.disabled === 'boolean' ? value.disabled : undefined,
    ownerId: typeof value.ownerId === 'string' ? value.ownerId : undefined,
    avatarUrl: typeof value.avatarUrl === 'string' ? value.avatarUrl : undefined,
    muteAllMembers:
      typeof value.muteAllMembers === 'boolean' ? value.muteAllMembers : undefined,
    muteExpiration:
      typeof value.muteExpiration === 'number' ? value.muteExpiration : undefined,
    remindType: normalizeRemindType(value.remindType),
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : undefined,
    updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : undefined,
    joinedAt: typeof value.joinedAt === 'number' ? value.joinedAt : undefined,
  };
};

const normalizeMeta = (value: unknown): JoinedGroupSnapshotMeta => {
  const record = isRecord(value) ? value : {};
  const integrity =
    record.integrity === 'synced' ||
    record.integrity === 'limited' ||
    record.integrity === 'incomplete' ||
    record.integrity === 'unknown'
      ? record.integrity
      : 'preview';
  return {
    integrity,
    limited: record.limited === true,
    storageLimit:
      typeof record.storageLimit === 'number'
        ? record.storageLimit
        : JOINED_GROUP_PREVIEW_STORAGE_LIMIT,
    serverLimit:
      typeof record.serverLimit === 'number' ? record.serverLimit : JOINED_GROUP_SERVER_LIMIT,
    source: 'localPreview',
    lastSyncFinishedTs:
      typeof record.lastSyncFinishedTs === 'number' ? record.lastSyncFinishedTs : undefined,
    lastSuccessfulAt:
      typeof record.lastSuccessfulAt === 'number' ? record.lastSuccessfulAt : undefined,
    reason: typeof record.reason === 'string' ? record.reason : undefined,
  };
};

export class JoinedGroupPreviewCache {
  private items: JoinedGroupSummary[] = [];
  private meta: JoinedGroupSnapshotMeta = {
    integrity: 'unknown',
    limited: false,
    storageLimit: JOINED_GROUP_PREVIEW_STORAGE_LIMIT,
    serverLimit: JOINED_GROUP_SERVER_LIMIT,
    source: 'localPreview',
  };

  public load(record: JoinedGroupPreviewStorageRecord | null | undefined): void {
    if (!record) {
      this.items = [];
      this.meta = {
        integrity: 'unknown',
        limited: false,
        storageLimit: JOINED_GROUP_PREVIEW_STORAGE_LIMIT,
        serverLimit: JOINED_GROUP_SERVER_LIMIT,
        source: 'localPreview',
      };
      return;
    }
    const normalized = Array.isArray(record.items)
      ? record.items.map(item => normalizeSummary(item)).filter(item => item !== null)
      : [];
    this.items = normalized.slice(0, JOINED_GROUP_PREVIEW_STORAGE_LIMIT);
    this.meta = normalizeMeta(record.meta);
  }

  public setSnapshot(snapshot: JoinedGroupSnapshot): void {
    this.items = snapshot.items
      .map(item => cloneSummary(item))
      .slice(0, JOINED_GROUP_PREVIEW_STORAGE_LIMIT);
    this.meta = {
      ...snapshot.meta,
      source: 'localPreview',
      storageLimit: JOINED_GROUP_PREVIEW_STORAGE_LIMIT,
      serverLimit: JOINED_GROUP_SERVER_LIMIT,
      integrity: snapshot.meta.limited ? 'limited' : snapshot.meta.integrity,
    };
  }

  public getSnapshot(): JoinedGroupSnapshot {
    return {
      items: this.items.map(item => cloneSummary(item)),
      meta: { ...this.meta, source: 'localPreview' },
    };
  }

  public exportRecord(): JoinedGroupPreviewStorageRecord {
    return {
      items: this.items.map(item => cloneSummary(item)),
      meta: { ...this.meta, source: 'localPreview' },
    };
  }
}
