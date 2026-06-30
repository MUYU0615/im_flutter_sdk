export interface RealEnvRetryConfig {
  readonly maxRetries: number;
  readonly delayMs: number;
}

export const DEFAULT_REAL_ENV_RETRY_CONFIG: RealEnvRetryConfig = {
  maxRetries: Number(process.env.REAL_ENV_RETRY_MAX ?? 2),
  delayMs: Number(process.env.REAL_ENV_RETRY_DELAY_MS ?? 3000),
};

const sleep = async (delayMs: number): Promise<void> => {
  await new Promise<void>(resolve => {
    setTimeout(resolve, delayMs);
  });
};

export const runWithRetry = async <T>(
  task: () => Promise<T>,
  config: RealEnvRetryConfig = DEFAULT_REAL_ENV_RETRY_CONFIG
): Promise<{ readonly result: T; readonly retryCount: number }> => {
  let attempt = 0;
  let lastError: unknown;
  while (attempt <= config.maxRetries) {
    try {
      const result = await task();
      return {
        result,
        retryCount: attempt,
      };
    } catch (error) {
      lastError = error;
      if (attempt === config.maxRetries) {
        break;
      }
      await sleep(config.delayMs);
      attempt += 1;
    }
  }
  throw lastError;
};
