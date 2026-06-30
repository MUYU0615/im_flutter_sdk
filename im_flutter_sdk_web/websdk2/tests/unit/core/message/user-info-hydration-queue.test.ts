import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { UserInfoHydrationQueue } from '@/core/message/profile-sync/user-info-hydration-queue';

describe('UserInfoHydrationQueue', () => {
  beforeEach((): void => {
    vi.useFakeTimers();
  });

  afterEach((): void => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('应按 userId 去重并保留最大 userInfoUpdateTime', async () => {
    const onFlush = vi.fn();
    const queue = new UserInfoHydrationQueue({
      windowMs: 7000,
      batchSize: 20,
      onFlush,
    });

    queue.enqueue('alice', 10);
    queue.enqueue('alice', 12);
    queue.enqueue('bob', 8);

    await vi.advanceTimersByTimeAsync(7000);

    expect(onFlush).toHaveBeenCalledWith([
      {
        userId: 'alice',
        userInfoUpdateTime: 12,
      },
      {
        userId: 'bob',
        userInfoUpdateTime: 8,
      },
    ]);
  });

  it('达到批量阈值后应立即触发 flush', () => {
    const onFlush = vi.fn();
    const queue = new UserInfoHydrationQueue({
      windowMs: 7000,
      batchSize: 2,
      onFlush,
    });

    queue.enqueue('alice', 10);
    expect(onFlush).not.toHaveBeenCalled();

    queue.enqueue('bob', 11);
    expect(onFlush).toHaveBeenCalledTimes(1);
    expect(onFlush).toHaveBeenCalledWith([
      { userId: 'alice', userInfoUpdateTime: 10 },
      { userId: 'bob', userInfoUpdateTime: 11 },
    ]);
  });
});
