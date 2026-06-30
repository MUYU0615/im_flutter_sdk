import { describe, expect, it } from 'vitest';

import { evictByLru, removeExpired } from '@/cache/cache-eviction';

describe('cache-eviction', () => {
  it('removeExpired 在 ttl 无效时应保留原列表', () => {
    const items = [{ id: 'a', lastUpdate: 10 }];

    expect(removeExpired(items, 0, 100)).toEqual({
      kept: items,
      removed: [],
    });
  });

  it('removeExpired 应区分过期与未过期项', () => {
    const items = [
      { id: 'expired', lastUpdate: 10 },
      { id: 'fresh', lastUpdate: 95 },
    ];

    expect(removeExpired(items, 20, 100)).toEqual({
      kept: [{ id: 'fresh', lastUpdate: 95 }],
      removed: [{ id: 'expired', lastUpdate: 10 }],
    });
  });

  it('evictByLru 在 removeCount 无效或空列表时应直接返回原值', () => {
    const items = [{ id: 'a', lastAccess: 1 }];

    expect(evictByLru(items, 0)).toEqual({
      kept: items,
      removed: [],
    });
    expect(evictByLru([], 1)).toEqual({
      kept: [],
      removed: [],
    });
  });

  it('evictByLru 应按最旧访问时间淘汰', () => {
    const items = [
      { id: 'keep-new', lastAccess: 30 },
      { id: 'remove-old', lastAccess: 10 },
      { id: 'keep-mid', lastAccess: 20 },
    ];

    expect(evictByLru(items, 1)).toEqual({
      kept: [
        { id: 'keep-new', lastAccess: 30 },
        { id: 'keep-mid', lastAccess: 20 },
      ],
      removed: [{ id: 'remove-old', lastAccess: 10 }],
    });
  });
});
