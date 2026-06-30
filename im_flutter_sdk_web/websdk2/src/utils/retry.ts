/**
 * 重试工具
 * 
 * 支持指数退避策略
 */

export interface RetryOptions {
  maxAttempts?: number;           // 最大尝试次数，默认 3
  initialDelay?: number;          // 初始延迟（毫秒），默认 1000
  maxDelay?: number;              // 最大延迟（毫秒），默认 60000
  backoffMultiplier?: number;     // 退避乘数，默认 2
  jitter?: boolean;                // 是否添加随机抖动，默认 true
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 60000,
  backoffMultiplier: 2,
  jitter: true,
};

/**
 * 计算延迟时间（指数退避）
 */
function calculateDelay(attempt: number, options: Required<RetryOptions>): number {
  const exponentialDelay = options.initialDelay * Math.pow(options.backoffMultiplier, attempt - 1);
  const delay = Math.min(exponentialDelay, options.maxDelay);

  if (options.jitter) {
    // 添加 ±20% 的随机抖动，避免雷群效应
    const jitterAmount = delay * 0.2;
    const jitter = (Math.random() * 2 - 1) * jitterAmount;
    return Math.max(0, delay + jitter);
  }

  return delay;
}

/**
 * 延迟指定时间
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 重试函数
 * 
 * @param fn 要重试的函数
 * @param options 重试选项
 * @returns Promise，成功时返回函数结果，失败时抛出最后一个错误
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // 最后一次尝试失败，直接抛出错误
      if (attempt >= opts.maxAttempts) {
        throw error;
      }

      // 计算延迟时间并等待
      const delay = calculateDelay(attempt, opts);
      await sleep(delay);
    }
  }

  // 理论上不会到达这里，但 TypeScript 需要
  throw lastError;
}

/**
 * 重试函数（带条件判断）
 * 
 * 只有满足条件的错误才会重试
 */
export async function retryWithCondition<T>(
  fn: () => Promise<T>,
  shouldRetry: (error: unknown) => boolean,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // 如果错误不应该重试，直接抛出
      if (!shouldRetry(error)) {
        throw error;
      }

      // 最后一次尝试失败，直接抛出错误
      if (attempt >= opts.maxAttempts) {
        throw error;
      }

      // 计算延迟时间并等待
      const delay = calculateDelay(attempt, opts);
      await sleep(delay);
    }
  }

  // 理论上不会到达这里，但 TypeScript 需要
  throw lastError;
}
