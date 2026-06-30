import { afterEach, describe, expect, it, vi } from 'vitest';

import { MessageRetryManager } from '@/core/message/message-retry';
import type { Message } from '@/types';

const createMessage = (options: {
  readonly msgLocalId: string;
  readonly retryCount?: number;
}): Message => {
  return {
    msgServerId: '',
    msgLocalId: options.msgLocalId,
    from: '',
    to: '',
    sender: { userId: 'alice' },
    conversationId: 'room-1',
    conversationType: 'singleChat',
    type: 'text',
    status: 'failed',
    ext: options.retryCount === undefined ? {} : { retryCount: options.retryCount },
    timestamp: 1700000000000,
    body: { content: 'hello' },
  };
};

describe('MessageRetryManager', () => {
  afterEach((): void => {
    vi.restoreAllMocks();
  });

  it('recordFailedMessage 应累计重试次数并受上限保护', () => {
    const manager = new MessageRetryManager();

    manager.recordFailedMessage(createMessage({ msgLocalId: 'm1' }));
    manager.recordFailedMessage(createMessage({ msgLocalId: 'm2', retryCount: 2 }));
    manager.recordFailedMessage(createMessage({ msgLocalId: 'm3', retryCount: 3 }));

    const failed = manager.getFailedMessages();
    expect(failed).toHaveLength(2);
    expect(failed.find(item => item.msgLocalId === 'm1')?.ext?.retryCount).toBe(1);
    expect(failed.find(item => item.msgLocalId === 'm2')?.ext?.retryCount).toBe(3);
    expect(failed.find(item => item.msgLocalId === 'm3')).toBeUndefined();
  });

  it('retryFailedMessages 成功后应移除失败消息', async () => {
    const manager = new MessageRetryManager();
    manager.recordFailedMessage(createMessage({ msgLocalId: 'm1' }));
    const sendMessageFn = vi.fn(async (message: Message): Promise<Message> => {
      return {
        ...message,
        status: 'sent',
      };
    });

    await manager.retryFailedMessages(sendMessageFn);

    expect(sendMessageFn).toHaveBeenCalledTimes(1);
    expect(manager.getFailedMessages()).toHaveLength(0);
  });

  it('retryFailedMessages 失败时应保留失败消息', async () => {
    const manager = new MessageRetryManager();
    manager.recordFailedMessage(createMessage({ msgLocalId: 'm1' }));
    const sendMessageFn = vi.fn(async (): Promise<Message> => {
      throw new Error('network');
    });

    await manager.retryFailedMessages(sendMessageFn);

    expect(sendMessageFn).toHaveBeenCalledTimes(1);
    expect(manager.getFailedMessages()).toHaveLength(1);
  });

  it('无失败消息时 retryFailedMessages 应直接返回', async () => {
    const manager = new MessageRetryManager();
    const sendMessageFn = vi.fn(async (message: Message): Promise<Message> => message);

    await manager.retryFailedMessages(sendMessageFn);

    expect(sendMessageFn).not.toHaveBeenCalled();
  });

  it('removeFailedMessage 与 clearFailedMessages 应生效', () => {
    const manager = new MessageRetryManager();
    manager.recordFailedMessage(createMessage({ msgLocalId: 'm1' }));
    manager.recordFailedMessage(createMessage({ msgLocalId: 'm2' }));

    manager.removeFailedMessage('m1');
    expect(manager.getFailedMessages().map(item => item.msgLocalId)).toEqual(['m2']);

    manager.clearFailedMessages();
    expect(manager.getFailedMessages()).toHaveLength(0);
  });
});
