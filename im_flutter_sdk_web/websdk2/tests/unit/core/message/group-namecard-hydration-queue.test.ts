import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GroupNamecardHydrationQueue } from '@/core/message/profile-sync/group-namecard-hydration-queue';

describe('GroupNamecardHydrationQueue', () => {
  beforeEach((): void => {
    vi.useFakeTimers();
  });

  afterEach((): void => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('应按 groupId + userId 去重并保留最大 namecardUpdateTime', async () => {
    const onFlushGroup = vi.fn().mockResolvedValue(undefined);
    const queue = new GroupNamecardHydrationQueue({
      windowMs: 7000,
      minWindowMs: 1000,
      maxBatchSize: 50,
      maxConcurrency: 5,
      onFlushGroup,
    });

    queue.enqueue('g1', 'alice', 10);
    queue.enqueue('g1', 'alice', 12);
    queue.enqueue('g1', 'bob', 8);

    await vi.advanceTimersByTimeAsync(7000);
    await vi.runAllTicks();

    expect(onFlushGroup).toHaveBeenCalledWith({
      groupId: 'g1',
      targets: [
        { userId: 'alice', namecardUpdateTime: 12 },
        { userId: 'bob', namecardUpdateTime: 8 },
      ],
    });
  });

  it('应允许跨群并行并保持同群单批', async () => {
    const runningGroups: string[] = [];
    const onFlushGroup = vi.fn(async batch => {
      runningGroups.push(batch.groupId);
      await Promise.resolve();
    });
    const queue = new GroupNamecardHydrationQueue({
      windowMs: 7000,
      minWindowMs: 1000,
      maxBatchSize: 50,
      maxConcurrency: 2,
      onFlushGroup,
    });

    queue.enqueue('g1', 'alice', 10);
    queue.enqueue('g2', 'bob', 11);
    queue.enqueue('g3', 'carol', 12);

    await vi.advanceTimersByTimeAsync(7000);
    await vi.runAllTicks();

    expect(onFlushGroup).toHaveBeenCalledTimes(3);
    expect(runningGroups.slice(0, 2)).toEqual(['g1', 'g2']);
  });

  it('应在 1 到 7 秒随机窗口内触发 flush', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const onFlushGroup = vi.fn().mockResolvedValue(undefined);
    const queue = new GroupNamecardHydrationQueue({
      windowMs: 7000,
      minWindowMs: 1000,
      maxBatchSize: 50,
      maxConcurrency: 5,
      onFlushGroup,
    });

    queue.enqueue('g1', 'alice', 10);

    await vi.advanceTimersByTimeAsync(3999);
    expect(onFlushGroup).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(onFlushGroup).toHaveBeenCalledOnce();
  });

  it('同一群单批数量应受 maxBatchSize 限制', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const onFlushGroup = vi.fn().mockResolvedValue(undefined);
    const queue = new GroupNamecardHydrationQueue({
      windowMs: 7000,
      minWindowMs: 1000,
      maxBatchSize: 2,
      maxConcurrency: 5,
      onFlushGroup,
    });

    queue.enqueue('g1', 'u1', 1);
    queue.enqueue('g1', 'u2', 2);
    queue.enqueue('g1', 'u3', 3);
    queue.enqueue('g1', 'u4', 4);
    queue.enqueue('g1', 'u5', 5);

    await vi.advanceTimersByTimeAsync(1000);
    await vi.runAllTimersAsync();

    expect(onFlushGroup).toHaveBeenCalledTimes(3);
    expect(onFlushGroup.mock.calls.map(call => call[0].targets)).toEqual([
      [
        { userId: 'u1', namecardUpdateTime: 1 },
        { userId: 'u2', namecardUpdateTime: 2 },
      ],
      [
        { userId: 'u3', namecardUpdateTime: 3 },
        { userId: 'u4', namecardUpdateTime: 4 },
      ],
      [{ userId: 'u5', namecardUpdateTime: 5 }],
    ]);
  });
});
