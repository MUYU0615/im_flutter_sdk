/**
 * 消息队列
 *
 * 用于排序（按时间戳排序、处理重复）
 */

import { Message } from '../../types';
import { logger } from '../../utils/logger';

/**
 * 消息队列
 */
export class MessageQueue {
  private messages: Message[] = [];
  private seenIds: Set<string> = new Set();

  /**
   * 添加消息
   */
  add(message: Message): void {
    // 检查重复
    const id = message.msgServerId || message.msgLocalId;
    if (this.seenIds.has(id)) {
      logger.debug('Duplicate message ignored', { id });
      return;
    }

    this.seenIds.add(id);
    this.messages.push(message);
    this.sort();
  }

  /**
   * 按时间戳排序
   */
  private sort(): void {
    this.messages.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * 获取所有消息
   */
  getAll(): Message[] {
    return [...this.messages];
  }

  /**
   * 获取指定时间范围的消息
   */
  getByTimeRange(startTime: number, endTime: number): Message[] {
    return this.messages.filter(msg => msg.timestamp >= startTime && msg.timestamp <= endTime);
  }

  /**
   * 获取指定会话的消息
   */
  getByConversation(conversationId: string): Message[] {
    return this.messages.filter(msg => msg.conversationId === conversationId);
  }

  /**
   * 清除队列
   */
  clear(): void {
    this.messages = [];
    this.seenIds.clear();
  }

  /**
   * 获取队列大小
   */
  size(): number {
    return this.messages.length;
  }
}
