import { afterEach, describe, expect, it, vi } from 'vitest';

import { ConnectionRetry } from '@/core/connection/connection-retry';

describe('ConnectionRetry', () => {
  afterEach((): void => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('shouldRetry/recordAttempt/reset 应按配置工作', () => {
    const retry = new ConnectionRetry({ maxAttempts: 2 });

    expect(retry.getAttemptCount()).toBe(0);
    expect(retry.shouldRetry()).toBe(true);

    retry.recordAttempt();
    expect(retry.getAttemptCount()).toBe(1);
    expect(retry.shouldRetry()).toBe(true);

    retry.recordAttempt();
    expect(retry.getAttemptCount()).toBe(2);
    expect(retry.shouldRetry()).toBe(false);

    retry.reset();
    expect(retry.getAttemptCount()).toBe(0);
    expect(retry.shouldRetry()).toBe(true);
  });

  it('getRetryDelay 应按指数退避并受 maxDelay 限制', () => {
    const retry = new ConnectionRetry({
      initialDelay: 100,
      backoffMultiplier: 2,
      maxDelay: 250,
    });

    expect(retry.getRetryDelay()).toBe(100);
    retry.recordAttempt();
    expect(retry.getRetryDelay()).toBe(100);
    retry.recordAttempt();
    expect(retry.getRetryDelay()).toBe(200);
    retry.recordAttempt();
    expect(retry.getRetryDelay()).toBe(250);
  });

  it('waitForRetry 应在计算出的延迟后完成', async () => {
    vi.useFakeTimers();
    const retry = new ConnectionRetry({
      initialDelay: 120,
      maxDelay: 120,
      backoffMultiplier: 2,
    });
    retry.recordAttempt();

    const waitPromise = retry.waitForRetry();
    await vi.advanceTimersByTimeAsync(119);
    let settled = false;
    void waitPromise.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    await waitPromise;
    expect(settled).toBe(true);
  });
});
