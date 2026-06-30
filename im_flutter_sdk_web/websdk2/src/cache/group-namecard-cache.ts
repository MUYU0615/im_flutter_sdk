/**
 * 群名片缓存
 */

import { evictByLru, removeExpired } from './cache-eviction';
import { isRecord } from './cache-utils';
import type { GroupNamecardCacheRecord } from './cache-types';

const buildCacheId = (groupId: string, userId: string): string => `${groupId}:${userId}`;

export class GroupNamecardCache {
  private readonly items: Map<string, GroupNamecardCacheRecord> = new Map();

  public load(rawItems: ReadonlyArray<GroupNamecardCacheRecord>, now: number): void {
    this.items.clear();
    for (const item of rawItems) {
      const normalized = this.normalizeItem(item, now);
      if (!normalized) {
        continue;
      }
      this.items.set(buildCacheId(normalized.groupId, normalized.userId), normalized);
    }
  }

  public getAll(): ReadonlyArray<GroupNamecardCacheRecord> {
    return Array.from(this.items.values());
  }

  public get(
    groupId: string,
    userId: string,
    now: number,
    updateAccess: boolean
  ): GroupNamecardCacheRecord | null {
    const cacheId = buildCacheId(groupId, userId);
    const item = this.items.get(cacheId);
    if (!item) {
      return null;
    }
    if (updateAccess) {
      this.items.set(cacheId, {
        ...item,
        lastAccess: now,
      });
    }
    return item;
  }

  public getByGroupId(
    groupId: string,
    now: number,
    updateAccess: boolean
  ): ReadonlyArray<GroupNamecardCacheRecord> {
    const result: GroupNamecardCacheRecord[] = [];
    for (const item of this.items.values()) {
      if (item.groupId !== groupId) {
        continue;
      }
      result.push(item);
      if (updateAccess) {
        this.items.set(buildCacheId(item.groupId, item.userId), {
          ...item,
          lastAccess: now,
        });
      }
    }
    return result;
  }

  public setAll(items: ReadonlyArray<GroupNamecardCacheRecord>, now: number): void {
    for (const item of items) {
      const normalized = this.normalizeItem(item, now);
      if (!normalized) {
        continue;
      }
      const cacheId = buildCacheId(normalized.groupId, normalized.userId);
      const existing = this.items.get(cacheId);
      this.items.set(cacheId, {
        ...normalized,
        lastAccess: existing?.lastAccess ?? normalized.lastAccess,
        lastUpdate: now,
      });
    }
  }

  public remove(targets: ReadonlyArray<{ groupId: string; userId: string }>): void {
    for (const target of targets) {
      this.items.delete(buildCacheId(target.groupId, target.userId));
    }
  }

  public removeExpired(
    ttlMs: number,
    now: number,
    protectedUserIds: ReadonlySet<string> = new Set()
  ): boolean {
    const allItems = Array.from(this.items.values());
    const candidates = allItems.filter(item => !protectedUserIds.has(item.userId));
    const result = removeExpired(candidates, ttlMs, now);
    const removedIds = new Set(result.removed.map(item => buildCacheId(item.groupId, item.userId)));
    this.items.clear();
    for (const item of allItems) {
      if (removedIds.has(buildCacheId(item.groupId, item.userId))) {
        continue;
      }
      this.items.set(buildCacheId(item.groupId, item.userId), item);
    }
    return result.removed.length > 0;
  }

  public evictByLru(
    removeCount: number,
    protectedUserIds: ReadonlySet<string> = new Set()
  ): boolean {
    const allItems = Array.from(this.items.values());
    const candidates = allItems.filter(item => !protectedUserIds.has(item.userId));
    const result = evictByLru(candidates, Math.min(removeCount, candidates.length));
    const removedIds = new Set(result.removed.map(item => buildCacheId(item.groupId, item.userId)));
    this.items.clear();
    for (const item of allItems) {
      if (removedIds.has(buildCacheId(item.groupId, item.userId))) {
        continue;
      }
      this.items.set(buildCacheId(item.groupId, item.userId), item);
    }
    return result.removed.length > 0;
  }

  public trimMax(maxCount: number, protectedUserIds: ReadonlySet<string> = new Set()): boolean {
    if (maxCount <= 0 || this.items.size <= maxCount) {
      return false;
    }
    return this.evictByLru(Math.max(this.items.size - maxCount, 0), protectedUserIds);
  }

  private normalizeItem(
    item: GroupNamecardCacheRecord,
    now: number
  ): GroupNamecardCacheRecord | null {
    if (!item || !isRecord(item)) {
      return null;
    }
    const groupId = typeof item.groupId === 'string' ? item.groupId : '';
    const userId = typeof item.userId === 'string' ? item.userId : '';
    if (!groupId || !userId) {
      return null;
    }
    const namecard = typeof item.namecard === 'string' ? item.namecard : '';
    return {
      groupId,
      userId,
      namecard,
      namecardUpdateTime:
        typeof item.namecardUpdateTime === 'number' ? item.namecardUpdateTime : undefined,
      lastSyncAt: typeof item.lastSyncAt === 'number' ? item.lastSyncAt : undefined,
      lastAccess: typeof item.lastAccess === 'number' ? item.lastAccess : 0,
      lastUpdate: typeof item.lastUpdate === 'number' ? item.lastUpdate : now,
    };
  }
}
