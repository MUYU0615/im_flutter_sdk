/**
 * 联系人关系缓存
 */

import type {
  ContactCacheIncompleteReason,
  ContactCacheMeta,
  ContactRelationRecord,
  ContactSyncMode,
  ContactVersionState,
  UserInfoSummary,
} from './cache-types';
import type { Contact, ContactSnapshot, ContactSyncSource } from '../types/contact';
import { isRecord } from './cache-utils';

const DEFAULT_VERSION_STATE: ContactVersionState = {
  version: '',
  lastVersionCheckAt: 0,
  lastVersionSource: 'metadata',
};

const DEFAULT_META: ContactCacheMeta = {
  cacheIntegrity: 'incomplete',
  reason: 'first_sync_pending',
  lastSyncTs: 0,
  lastSuccessfulVersion: '',
  lastSyncMode: 'skipped',
};

export class ContactCache {
  private readonly items: Map<string, ContactRelationRecord> = new Map();
  private versionState: ContactVersionState = DEFAULT_VERSION_STATE;
  private meta: ContactCacheMeta = DEFAULT_META;

  public load(
    rawItems: ReadonlyArray<ContactRelationRecord>,
    versionState?: ContactVersionState | null,
    meta?: ContactCacheMeta | null
  ): void {
    this.items.clear();
    for (const item of rawItems) {
      const normalized = this.normalizeRecord(item);
      if (!normalized) {
        continue;
      }
      this.items.set(normalized.userId, normalized);
    }
    this.versionState = this.normalizeVersionState(versionState);
    this.meta = this.normalizeMeta(meta);
  }

  public getAll(): ReadonlyArray<ContactRelationRecord> {
    return Array.from(this.items.values()).sort((left, right) => {
      if (left.addTs !== right.addTs) {
        return left.addTs - right.addTs;
      }
      return left.userId.localeCompare(right.userId);
    });
  }

  public getVersionState(): ContactVersionState {
    return this.versionState;
  }

  public getMeta(): ContactCacheMeta {
    return this.meta;
  }

  public getUserIds(): ReadonlyArray<string> {
    return Array.from(this.items.keys());
  }

  public replaceAll(items: ReadonlyArray<ContactRelationRecord>): void {
    this.items.clear();
    this.upsert(items);
  }

  public upsert(items: ReadonlyArray<ContactRelationRecord>): void {
    for (const item of items) {
      const normalized = this.normalizeRecord(item);
      if (!normalized) {
        continue;
      }
      this.items.set(normalized.userId, normalized);
    }
  }

  public addByNotice(userId: string, updatedAt: number): boolean {
    const trimmedUserId = userId.trim();
    if (!trimmedUserId) {
      return false;
    }
    if (this.items.has(trimmedUserId)) {
      return false;
    }

    this.items.set(trimmedUserId, {
      userId: trimmedUserId,
      remark: '',
      sign: '',
      addTs: updatedAt,
      updatedAt,
      metadataUpdatedAt: updatedAt,
    });
    return true;
  }

  public remove(userId: string): boolean {
    return this.items.delete(userId);
  }

  public updateRemark(userId: string, remark: string, updatedAt: number): boolean {
    const existing = this.items.get(userId);
    if (!existing || existing.remark === remark) {
      return false;
    }

    this.items.set(userId, {
      ...existing,
      remark,
      updatedAt,
    });
    return true;
  }

  public setVersionState(state: ContactVersionState): void {
    this.versionState = this.normalizeVersionState(state);
  }

  public updateVersionFromNotice(version: string, updatedAt: number): boolean {
    const trimmedVersion = version.trim();
    if (!trimmedVersion) {
      return false;
    }
    if (
      this.versionState.version === trimmedVersion &&
      this.versionState.lastVersionSource === 'roster_notice'
    ) {
      return false;
    }

    this.versionState = {
      version: trimmedVersion,
      lastVersionCheckAt: updatedAt,
      lastVersionSource: 'roster_notice',
    };
    return true;
  }

  public setMeta(meta: ContactCacheMeta): void {
    this.meta = this.normalizeMeta(meta);
  }

  public updateMeta(options: {
    cacheIntegrity: 'complete' | 'incomplete';
    reason?: ContactCacheIncompleteReason;
    lastSyncTs?: number;
    lastSuccessfulVersion?: string;
    lastSyncMode?: ContactSyncMode;
  }): void {
    this.meta = {
      cacheIntegrity: options.cacheIntegrity,
      reason: options.cacheIntegrity === 'complete' ? undefined : options.reason,
      lastSyncTs: options.lastSyncTs ?? this.meta.lastSyncTs,
      lastSuccessfulVersion: options.lastSuccessfulVersion ?? this.meta.lastSuccessfulVersion,
      lastSyncMode: options.lastSyncMode ?? this.meta.lastSyncMode,
    };
  }

  public computeIntegrity(userInfos: ReadonlyArray<UserInfoSummary>): ContactCacheMeta {
    if (this.items.size === 0 && !this.meta.lastSuccessfulVersion) {
      return {
        ...this.meta,
        cacheIntegrity: 'incomplete',
        reason: 'first_sync_pending',
      };
    }

    const userInfoIds = new Set(userInfos.map(item => item.userId));
    const missing = this.getUserIds().some(userId => !userInfoIds.has(userId));
    if (missing) {
      return {
        ...this.meta,
        cacheIntegrity: 'incomplete',
        reason: 'user_info_missing',
      };
    }

    return {
      ...this.meta,
      cacheIntegrity: 'complete',
      reason: undefined,
    };
  }

  public buildSnapshot(
    userInfos: ReadonlyArray<UserInfoSummary>,
    source: ContactSyncSource
  ): ContactSnapshot {
    const userInfoMap = new Map(userInfos.map(item => [item.userId, item]));
    const items: Contact[] = this.getAll().map(item => {
      const userInfo = userInfoMap.get(item.userId);
      return {
        userId: item.userId,
        userInfo: {
          userId: item.userId,
          nickname: userInfo?.nickname,
          avatarUrl: userInfo?.avatarUrl,
          sign: userInfo?.sign ?? item.sign,
          ext: userInfo?.ext,
        },
        remark: item.remark,
        addTs: item.addTs,
      };
    });

    const complete = this.computeIntegrity(userInfos).cacheIntegrity === 'complete';
    return {
      items,
      source,
      version: this.versionState.version || this.meta.lastSuccessfulVersion,
      complete,
    };
  }

  private normalizeRecord(item: ContactRelationRecord): ContactRelationRecord | null {
    if (!isRecord(item)) {
      return null;
    }
    const userId = typeof item.userId === 'string' ? item.userId : '';
    if (!userId) {
      return null;
    }
    return {
      userId,
      remark: typeof item.remark === 'string' ? item.remark : '',
      sign: typeof item.sign === 'string' ? item.sign : '',
      addTs: typeof item.addTs === 'number' ? item.addTs : 0,
      updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : 0,
      metadataUpdatedAt: typeof item.metadataUpdatedAt === 'number' ? item.metadataUpdatedAt : 0,
    };
  }

  private normalizeVersionState(state?: ContactVersionState | null): ContactVersionState {
    if (!isRecord(state)) {
      return DEFAULT_VERSION_STATE;
    }
    return {
      version: typeof state.version === 'string' ? state.version : '',
      lastVersionCheckAt:
        typeof state.lastVersionCheckAt === 'number' ? state.lastVersionCheckAt : 0,
      lastVersionSource:
        state.lastVersionSource === 'metadata' ||
        state.lastVersionSource === 'sync_page' ||
        state.lastVersionSource === 'roster_notice'
          ? state.lastVersionSource
          : 'metadata',
    };
  }

  private normalizeMeta(meta?: ContactCacheMeta | null): ContactCacheMeta {
    if (!isRecord(meta)) {
      return DEFAULT_META;
    }
    return {
      cacheIntegrity: meta.cacheIntegrity === 'complete' ? 'complete' : 'incomplete',
      reason:
        meta.reason === 'quota_exceeded' ||
        meta.reason === 'user_info_missing' ||
        meta.reason === 'corrupted' ||
        meta.reason === 'manual_reset' ||
        meta.reason === 'first_sync_pending'
          ? meta.reason
          : undefined,
      lastSyncTs: typeof meta.lastSyncTs === 'number' ? meta.lastSyncTs : 0,
      lastSuccessfulVersion:
        typeof meta.lastSuccessfulVersion === 'string' ? meta.lastSuccessfulVersion : '',
      lastSyncMode:
        meta.lastSyncMode === 'full' ||
        meta.lastSyncMode === 'incremental' ||
        meta.lastSyncMode === 'skipped'
          ? meta.lastSyncMode
          : 'skipped',
    };
  }
}
