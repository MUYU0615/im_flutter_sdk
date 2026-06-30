import { describe, expect, it } from 'vitest';

import type { UserInfoSummary } from '@/cache/cache-types';
import { UserInfoCache } from '@/cache/user-info-cache';

const createUser = (options: {
  readonly userId: string;
  readonly lastAccess: number;
  readonly lastUpdate: number;
}): UserInfoSummary => {
  return {
    userId: options.userId,
    nickname: `${options.userId}-nick`,
    avatarUrl: `https://cdn.example.com/${options.userId}.png`,
    lastAccess: options.lastAccess,
    lastUpdate: options.lastUpdate,
  };
};

describe('UserInfoCache', () => {
  it('load 应过滤非法条目并保留合法用户', () => {
    const cache = new UserInfoCache();

    cache.load(
      [
        createUser({ userId: 'u1', lastAccess: 1, lastUpdate: 1 }),
        {
          userId: '',
          nickname: 'invalid',
          avatarUrl: 'x',
          lastAccess: 0,
          lastUpdate: 0,
        } as UserInfoSummary,
      ],
      100
    );

    expect(cache.getAll()).toHaveLength(1);
    expect(cache.getAll()[0]?.userId).toBe('u1');
  });

  it('getByIds 支持 updateAccess，setAll 支持覆盖更新', () => {
    const cache = new UserInfoCache();
    cache.load(
      [
        createUser({ userId: 'u1', lastAccess: 1, lastUpdate: 1 }),
        createUser({ userId: 'u2', lastAccess: 2, lastUpdate: 2 }),
      ],
      100
    );

    const matched = cache.getByIds(['u1', 'missing'], 88, true);
    expect(matched).toHaveLength(1);
    expect(cache.getAll().find(item => item.userId === 'u1')?.lastAccess).toBe(88);

    cache.setAll(
      [
        {
          userId: 'u1',
          nickname: 'updated',
          avatarUrl: 'https://cdn.example.com/new.png',
          lastAccess: 0,
          lastUpdate: 200,
        },
      ],
      200
    );

    expect(cache.getAll().find(item => item.userId === 'u1')?.nickname).toBe('updated');
    expect(cache.getAll().find(item => item.userId === 'u1')?.lastUpdate).toBe(200);
  });

  it('remove/removeExpired/evictByLru/trimMax 应按规则生效', () => {
    const cache = new UserInfoCache();
    cache.load(
      [
        createUser({ userId: 'u1', lastAccess: 1, lastUpdate: 1 }),
        createUser({ userId: 'u2', lastAccess: 2, lastUpdate: 2 }),
        createUser({ userId: 'u3', lastAccess: 3, lastUpdate: 3 }),
      ],
      100
    );

    cache.remove(['u3']);
    expect(cache.getAll().map(item => item.userId)).toEqual(['u1', 'u2']);

    const removedExpired = cache.removeExpired(1, 10);
    expect(removedExpired).toBe(true);
    expect(cache.getAll()).toHaveLength(0);

    cache.load(
      [
        createUser({ userId: 'u1', lastAccess: 1, lastUpdate: 1 }),
        createUser({ userId: 'u2', lastAccess: 2, lastUpdate: 2 }),
        createUser({ userId: 'u3', lastAccess: 3, lastUpdate: 3 }),
      ],
      100
    );

    const removedLru = cache.evictByLru(1);
    expect(removedLru).toBe(true);
    expect(cache.getAll().map(item => item.userId)).toEqual(['u2', 'u3']);

    const trimmed = cache.trimMax(1);
    expect(trimmed).toBe(true);
    expect(cache.getAll()).toHaveLength(1);
  });

  it('非法输入与未触发裁剪时应保持稳定结果', () => {
    const cache = new UserInfoCache();

    cache.load(
      [
        createUser({ userId: 'u1', lastAccess: 1, lastUpdate: 1 }),
        null as unknown as UserInfoSummary,
        {
          userId: '',
          nickname: 'bad',
          avatarUrl: 'https://cdn.example.com/bad.png',
          lastAccess: 0,
          lastUpdate: 0,
        },
      ],
      100
    );

    expect(cache.getAll()).toHaveLength(1);
    expect(cache.getByIds(['u1'], 999, false)[0]?.lastAccess).toBe(1);

    cache.setAll(
      [
        {
          userId: 'u2',
          lastAccess: 0,
          lastUpdate: 0,
        },
      ],
      200
    );

    expect(cache.getAll().find(item => item.userId === 'u2')).toMatchObject({
      userId: 'u2',
      nickname: undefined,
      avatarUrl: undefined,
      lastAccess: 0,
      lastUpdate: 0,
    });
    expect(cache.removeExpired(0, 500)).toBe(false);
    expect(cache.evictByLru(0)).toBe(false);
    expect(cache.trimMax(10)).toBe(false);
    expect(cache.trimMax(0)).toBe(false);
  });
});
