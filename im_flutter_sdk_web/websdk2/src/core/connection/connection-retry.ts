/**
 * 连接重试逻辑
 * 
 * 实现指数退避策略，最大 60 秒间隔
 */

import { logger } from '../../utils/logger';

/**
 * 重试配置
 */
export interface RetryConfig {
  maxAttempts?: number; // 最大重试次数，默认 10
  initialDelay?: number; // 初始延迟（毫秒），默认 1000
  maxDelay?: number; // 最大延迟（毫秒），默认 60000
  backoffMultiplier?: number; // 退避乘数，默认 2
}

const DEFAULT_CONFIG: Required<RetryConfig> = {
  maxAttempts: 10,
  initialDelay: 1000,
  maxDelay: 60000,
  backoffMultiplier: 2,
};

/**
 * 连接重试管理器
 */
export class ConnectionRetry {
  private config: Required<RetryConfig>;
  private attemptCount: number = 0;

  constructor(config: RetryConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 计算重试延迟（指数退避）
   */
  getRetryDelay(): number {
    const attemptIndex = Math.max(this.attemptCount - 1, 0); // 首次重试使用初始延迟
    const exponentialDelay =
      this.config.initialDelay * Math.pow(this.config.backoffMultiplier, attemptIndex);
    return Math.min(exponentialDelay, this.config.maxDelay);
  }

  /**
   * 记录重试尝试
   */
  recordAttempt(): void {
    this.attemptCount++;
  }

  /**
   * 重置重试计数
   */
  reset(): void {
    this.attemptCount = 0;
  }

  /**
   * 检查是否应该重试
   */
  shouldRetry(): boolean {
    return this.attemptCount < this.config.maxAttempts;
  }

  /**
   * 获取当前尝试次数
   */
  getAttemptCount(): number {
    return this.attemptCount;
  }

  /**
   * 等待重试延迟
   */
  async waitForRetry(): Promise<void> {
    const delay = this.getRetryDelay();
    logger.debug(`Waiting ${delay}ms before retry (attempt ${this.attemptCount})`);
    return new Promise((resolve) => setTimeout(resolve, delay));
  }
}
