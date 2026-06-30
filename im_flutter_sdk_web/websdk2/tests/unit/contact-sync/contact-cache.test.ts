import { describe, expect, it } from 'vitest';

import { ContactCache } from '@/cache/contact-cache';
import type { ContactRelationRecord, UserInfoSummary } from '@/cache/cache-types';

const createRelation = (userId: string): ContactRelationRecord => {
  return {
    userId,
    remark: `${userId}-remark`,
    sign: `${userId}-sign`,
    addTs: 10,
    updatedAt: 20,
    metadataUpdatedAt: 30,
  };
};

const createUserInfo = (userId: string): UserInfoSummary => {
  return {
    userId,
    nickname: `${userId}-nick`,
    avatarUrl: `https://cdn.example.com/${userId}.png`,
    lastAccess: 1,
    lastUpdate: 1,
  };
};

describe('ContactCache', () => {
  it('应把关系缓存和 userInfo 合并成完整快照', () => {
    const cache = new ContactCache();
    cache.load(
      [createRelation('u1')],
      {
        version: 'v1',
        lastVersionCheckAt: 1,
        lastVersionSource: 'metadata',
      },
      {
        cacheIntegrity: 'complete',
        lastSyncTs: 10,
        lastSuccessfulVersion: 'v1',
        lastSyncMode: 'full',
      }
    );

    const snapshot = cache.buildSnapshot([createUserInfo('u1')], 'cache');

    expect(snapshot.complete).toBe(true);
    expect(snapshot.version).toBe('v1');
    expect(snapshot.items).toEqual([
      {
        userId: 'u1',
        remark: 'u1-remark',
        addTs: 10,
        userInfo: {
          userId: 'u1',
          nickname: 'u1-nick',
          avatarUrl: 'https://cdn.example.com/u1.png',
          sign: 'u1-sign',
          ext: undefined,
        },
      },
    ]);
  });

  it('缺少 userInfo 时应标记为 incomplete', () => {
    const cache = new ContactCache();
    cache.load(
      [createRelation('u1')],
      {
        version: 'v1',
        lastVersionCheckAt: 1,
        lastVersionSource: 'metadata',
      },
      {
        cacheIntegrity: 'complete',
        lastSyncTs: 10,
        lastSuccessfulVersion: 'v1',
        lastSyncMode: 'full',
      }
    );

    const meta = cache.computeIntegrity([]);
    const snapshot = cache.buildSnapshot([], 'cache');

    expect(meta.cacheIntegrity).toBe('incomplete');
    expect(meta.reason).toBe('user_info_missing');
    expect(snapshot.complete).toBe(false);
    expect(snapshot.items[0]).toMatchObject({
      userId: 'u1',
      userInfo: {
        userId: 'u1',
      },
    });
  });

  it('空缓存且没有成功版本时应标记 first_sync_pending', () => {
    const cache = new ContactCache();
    cache.load([], null, null);

    const meta = cache.computeIntegrity([]);
    const snapshot = cache.buildSnapshot([], 'cache');

    expect(meta.cacheIntegrity).toBe('incomplete');
    expect(meta.reason).toBe('first_sync_pending');
    expect(snapshot.version).toBe('');
    expect(snapshot.complete).toBe(false);
  });

  it('应支持移除联系人和更新备注', () => {
    const cache = new ContactCache();
    cache.load(
      [createRelation('u1')],
      {
        version: '',
        lastVersionCheckAt: 1,
        lastVersionSource: 'metadata',
      },
      {
        cacheIntegrity: 'complete',
        lastSyncTs: 10,
        lastSuccessfulVersion: 'v-fallback',
        lastSyncMode: 'full',
      }
    );

    expect(cache.updateRemark('u1', 'next-remark', 99)).toBe(true);
    expect(cache.updateRemark('u1', 'next-remark', 100)).toBe(false);
    expect(cache.remove('u1')).toBe(true);
    expect(cache.remove('u1')).toBe(false);

    const snapshot = cache.buildSnapshot([], 'sync');
    expect(snapshot.version).toBe('v-fallback');
    expect(snapshot.items).toEqual([]);
  });
});
