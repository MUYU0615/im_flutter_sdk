import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ConversationSummary, UserInfoSummary } from '@/cache/cache-types';
import { CacheKeyName, buildCacheKey } from '@/cache/cache-keys';
import { CacheManager } from '@/cache/cache-manager';
import { CACHE_SCHEMA_VERSION } from '@/config/cache';

const APP_KEY = 'org#app';
const USER_ID = 'quota-user';
const storage = window.localStorage;

const createConversation = (options: {
  readonly id: string;
  readonly lastAccess: number;
  readonly lastUpdate: number;
}): ConversationSummary => {
  return {
    conversationId: options.id,
    type: 'singleChat',
    lastMessage: {
      msgId: `msg-${options.id}`,
      type: 'text',
      body: { content: 'hello' },
      timestamp: options.lastUpdate,
    },
    unreadCount: 0,
    marks: [],
    lastAccess: options.lastAccess,
    lastUpdate: options.lastUpdate,
  };
};

const createUserInfo = (options: {
  readonly userId: string;
  readonly lastAccess: number;
  readonly lastUpdate: number;
}): UserInfoSummary => {
  return {
    userId: options.userId,
    nickname: `nick-${options.userId}`,
    avatarUrl: `https://cdn.example.com/${options.userId}.png`,
    lastAccess: options.lastAccess,
    lastUpdate: options.lastUpdate,
  };
};

const buildKeys = (): {
  readonly conversationKey: string;
  readonly userInfoKey: string;
} => {
  const context = {
    appKey: APP_KEY,
    userId: USER_ID,
    schemaVersion: CACHE_SCHEMA_VERSION,
  };
  return {
    conversationKey: buildCacheKey(context, CacheKeyName.CONVERSATIONS),
    userInfoKey: buildCacheKey(context, CacheKeyName.USER_INFO),
  };
};

const clearLocalStorage = (): void => {
  for (let index = storage.length - 1; index >= 0; index -= 1) {
    const key = storage.key(index);
    if (!key) {
      continue;
    }
    storage.removeItem(key);
  }
};

describe('缓存模块 localStorage 配额集成测试', () => {
  beforeEach((): void => {
    clearLocalStorage();
    vi.restoreAllMocks();
  });

  it('QuotaExceededError 时应优先淘汰用户信息并保留会话摘要', async () => {
    const { conversationKey, userInfoKey } = buildKeys();
    storage.setItem(
      userInfoKey,
      JSON.stringify({
        items: [createUserInfo({ userId: 'u-expired', lastAccess: 1, lastUpdate: 1_000 })],
      })
    );

    const cacheManager = new CacheManager({
      appKey: APP_KEY,
      userId: USER_ID,
      cacheEncryptionMode: 'off',
      config: { ttlSeconds: 1 },
    });
    await cacheManager.prepare();

    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(5_000);
    cacheManager.updateConversationsFromServer([
      createConversation({ id: 'c1', lastAccess: 10, lastUpdate: 10 }),
    ]);
    cacheManager.setUserInfoSummaries([
      createUserInfo({ userId: 'u-lru-old', lastAccess: 2, lastUpdate: 4_200 }),
      createUserInfo({ userId: 'u-keep', lastAccess: 3, lastUpdate: 4_600 }),
    ]);

    const rawSetItem = Storage.prototype.setItem;
    let userInfoWriteAttempts = 0;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key: string,
      value: string
    ): void {
      if (key === userInfoKey) {
        userInfoWriteAttempts += 1;
        if (value.includes('u-lru-old')) {
          throw new DOMException('quota exceeded', 'QuotaExceededError');
        }
      }
      rawSetItem.call(this, key, value);
    });

    const privateManager = cacheManager as unknown as { flushNow: () => Promise<void> };
    await privateManager.flushNow();

    const persistedConversation = JSON.parse(
      storage.getItem(conversationKey) ?? '{"items":[]}'
    ) as { readonly items: ConversationSummary[] };
    const persistedUsers = JSON.parse(storage.getItem(userInfoKey) ?? '{"items":[]}') as {
      readonly items: UserInfoSummary[];
    };

    expect(userInfoWriteAttempts).toBe(3);
    expect(persistedConversation.items.map((item): string => item.conversationId)).toEqual(['c1']);
    expect(persistedUsers.items.map((item): string => item.userId)).toEqual(['u-keep']);

    nowSpy.mockRestore();
  });
});
