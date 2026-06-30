/**
 * 消息重试逻辑
 * 
 * 存储失败消息、重连后重试、最多 3 次尝试
 */

import { Message } from '../../types';
import { logger } from '../../utils/logger';
import { retry } from '../../utils/retry';

/**
 * 失败消息存储
 */
export class MessageRetryManager {
  private failedMessages: Map<string, Message> = new Map();
  private maxRetries: number = 3;

  /**
   * 记录失败消息
   */
  recordFailedMessage(message: Message): void {
    const retryCount = (message.ext?.retryCount as number) || 0;
    if (retryCount < this.maxRetries) {
      this.failedMessages.set(message.msgLocalId, {
        ...message,
        ext: {
          ...message.ext,
          retryCount: retryCount + 1,
        },
      });
      logger.debug('Failed message recorded for retry', {
        msgLocalId: message.msgLocalId,
        retryCount: retryCount + 1,
      });
    } else {
      logger.warn('Message exceeded max retries', { msgLocalId: message.msgLocalId });
    }
  }

  /**
   * 获取所有失败消息
   */
  getFailedMessages(): Message[] {
    return Array.from(this.failedMessages.values());
  }

  /**
   * 重试失败消息
   */
  async retryFailedMessages(sendMessageFn: (message: Message) => Promise<Message>): Promise<void> {
    const messages = this.getFailedMessages();
    if (messages.length === 0) {
      return;
    }

    logger.debug(`Retrying ${messages.length} failed messages`); // 记录重试批次数量

    for (const message of messages) {
      try {
        await retry(
          async () => {
            return await sendMessageFn(message);
          },
          {
            maxAttempts: 1, // 只尝试一次，因为已经在外部重试过
            initialDelay: 1000,
          }
        );

        // 重试成功，移除失败消息
        this.failedMessages.delete(message.msgLocalId);
        logger.debug('Failed message retried successfully', { msgLocalId: message.msgLocalId });
      } catch (error) {
        logger.error('Failed to retry message:', error);
        // 重试失败，保留在失败列表中
      }
    }
  }

  /**
   * 清除失败消息
   */
  clearFailedMessages(): void {
    this.failedMessages.clear();
  }

  /**
   * 移除特定消息
   */
  removeFailedMessage(msgLocalId: string): void {
    this.failedMessages.delete(msgLocalId);
  }
}
