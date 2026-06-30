import { describe, expect, it } from 'vitest';
import { runWithRetry } from '../../test-utils/layered/real-env-retry';

describe('真实环境不可达门禁重试', () => {
  it('任务最终成功时应返回重试次数', async () => {
    let callCount = 0;
    const response = await runWithRetry(
      () => {
        callCount += 1;
        if (callCount < 3) {
          return Promise.reject(new Error('temporary unreachable'));
        }
        return Promise.resolve('ok');
      },
      { maxRetries: 3, delayMs: 1 }
    );
    expect(response.result).toBe('ok');
    expect(response.retryCount).toBe(2);
  });

  it('重试耗尽后应抛出最后错误', async () => {
    await expect(
      runWithRetry(() => Promise.reject(new Error('still unreachable')), {
        maxRetries: 1,
        delayMs: 1,
      })
    ).rejects.toThrow('still unreachable');
  });
});
