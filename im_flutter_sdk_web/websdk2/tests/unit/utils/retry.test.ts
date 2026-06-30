import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { retry, retryWithCondition } from '@/utils/retry';

describe('retry utils', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('retry 应在重试后成功', async () => {
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('first'))
      .mockRejectedValueOnce(new Error('second'))
      .mockResolvedValueOnce('ok');

    const promise = retry(fn, {
      initialDelay: 10,
      maxDelay: 20,
      backoffMultiplier: 2,
      jitter: false,
      maxAttempts: 3,
    });

    await vi.runAllTimersAsync();

    await expect(promise).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('retry 达到最大次数后应抛出最后一个错误', async () => {
    const fn = vi.fn<() => Promise<void>>().mockRejectedValue(new Error('boom'));

    const promise = retry(fn, {
      initialDelay: 5,
      jitter: false,
      maxAttempts: 2,
    });
    const assertion = expect(promise).rejects.toThrow('boom');

    await vi.runAllTimersAsync();
    await assertion;
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retryWithCondition 遇到不可重试错误应立即中断', async () => {
    const fn = vi.fn<() => Promise<void>>().mockRejectedValue(new Error('fatal'));
    const shouldRetry = vi.fn(() => false);

    const promise = retryWithCondition(fn, shouldRetry, {
      initialDelay: 5,
      maxAttempts: 3,
      jitter: false,
    });
    const assertion = expect(promise).rejects.toThrow('fatal');

    await vi.runAllTimersAsync();
    await assertion;
    expect(fn).toHaveBeenCalledTimes(1);
    expect(shouldRetry).toHaveBeenCalledTimes(1);
  });

  it('retryWithCondition 应在条件允许时重试并成功', async () => {
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('retryable'))
      .mockResolvedValueOnce('done');
    const shouldRetry = vi.fn(() => true);

    const promise = retryWithCondition(fn, shouldRetry, {
      initialDelay: 5,
      maxAttempts: 2,
      jitter: false,
    });

    await vi.runAllTimersAsync();

    await expect(promise).resolves.toBe('done');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(shouldRetry).toHaveBeenCalledTimes(1);
  });
});
