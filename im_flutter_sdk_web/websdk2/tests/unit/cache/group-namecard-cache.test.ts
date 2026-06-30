import { describe, expect, it } from 'vitest';

import type { GroupNamecardCacheRecord } from '@/cache/cache-types';
import { GroupNamecardCache } from '@/cache/group-namecard-cache';

const createRecord = (options: {
  readonly groupId: string;
  readonly userId: string;
  readonly lastAccess: number;
  readonly lastUpdate: number;
  readonly namecardUpdateTime?: number;
}): GroupNamecardCacheRecord => {
  return {
    groupId: options.groupId,
    userId: options.userId,
    namecard: `${options.groupId}-${options.userId}`,
    namecardUpdateTime: options.namecardUpdateTime,
    lastAccess: options.lastAccess,
    lastUpdate: options.lastUpdate,
  };
};

describe('GroupNamecardCache', () => {
  it('应支持按 groupId + userId 读写并保留版本字段', () => {
    const cache = new GroupNamecardCache();
    cache.load(
      [
        createRecord({
          groupId: 'g1',
          userId: 'alice',
          lastAccess: 1,
          lastUpdate: 1,
          namecardUpdateTime: 10,
        }),
      ],
      100
    );

    const matched = cache.get('g1', 'alice', 88, true);
    expect(matched).toMatchObject({
      groupId: 'g1',
      userId: 'alice',
      namecard: 'g1-alice',
      namecardUpdateTime: 10,
    });

    cache.setAll(
      [
        {
          groupId: 'g1',
          userId: 'alice',
          namecard: 'new-card',
          namecardUpdateTime: 12,
          lastAccess: 0,
          lastUpdate: 0,
        },
      ],
      200
    );

    expect(cache.get('g1', 'alice', 0, false)).toMatchObject({
      namecard: 'new-card',
      namecardUpdateTime: 12,
      lastUpdate: 200,
    });
  });

  it('应支持按 groupId 查询、过期清理和 LRU 淘汰', () => {
    const cache = new GroupNamecardCache();
    cache.load(
      [
        createRecord({ groupId: 'g1', userId: 'a', lastAccess: 1, lastUpdate: 1 }),
        createRecord({ groupId: 'g1', userId: 'b', lastAccess: 2, lastUpdate: 2 }),
        createRecord({ groupId: 'g2', userId: 'c', lastAccess: 3, lastUpdate: 3 }),
      ],
      100
    );

    expect(cache.getByGroupId('g1', 0, false)).toHaveLength(2);

    expect(cache.removeExpired(1, 10)).toBe(true);
    expect(cache.getAll()).toHaveLength(0);

    cache.load(
      [
        createRecord({ groupId: 'g1', userId: 'a', lastAccess: 1, lastUpdate: 1 }),
        createRecord({ groupId: 'g1', userId: 'b', lastAccess: 2, lastUpdate: 2 }),
        createRecord({ groupId: 'g2', userId: 'c', lastAccess: 3, lastUpdate: 3 }),
      ],
      100
    );

    expect(cache.evictByLru(1)).toBe(true);
    expect(cache.getAll()).toHaveLength(2);
    expect(cache.trimMax(1)).toBe(true);
    expect(cache.getAll()).toHaveLength(1);
  });
});
