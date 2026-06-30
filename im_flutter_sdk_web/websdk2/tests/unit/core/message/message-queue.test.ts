import { describe, expect, it } from 'vitest';

import { MessageQueue } from '@/core/message/message-queue';
import type { Message } from '@/types';

const createMessage = (options: {
  readonly msgServerId?: string;
  readonly msgLocalId: string;
  readonly channelId?: string;
  readonly timestamp: number;
}): Message => {
  return {
    msgServerId: options.msgServerId ?? '',
    msgLocalId: options.msgLocalId,
    from: '',
    to: '',
    sender: { userId: 'alice' },
    conversationId: options.channelId ?? 'room-1',
    conversationType: 'singleChat',
    type: 'text',
    status: 'sent',
    ext: {},
    timestamp: options.timestamp,
    body: { content: `msg-${options.msgLocalId}` },
  };
};

describe('MessageQueue', () => {
  it('按时间排序并基于 msgServerId/msgLocalId 去重', () => {
    const queue = new MessageQueue();

    queue.add(createMessage({ msgServerId: 's2', msgLocalId: 'l2', timestamp: 200 }));
    queue.add(createMessage({ msgServerId: 's1', msgLocalId: 'l1', timestamp: 100 }));
    queue.add(createMessage({ msgServerId: 's1', msgLocalId: 'l3', timestamp: 150 }));
    queue.add(createMessage({ msgLocalId: 'l4', timestamp: 250 }));
    queue.add(createMessage({ msgLocalId: 'l4', timestamp: 260 }));

    const all = queue.getAll();

    expect(all.map(item => item.timestamp)).toEqual([100, 200, 250]);
    expect(queue.size()).toBe(3);
  });

  it('按时间范围查询包含边界值', () => {
    const queue = new MessageQueue();

    queue.add(createMessage({ msgLocalId: 'l1', timestamp: 100 }));
    queue.add(createMessage({ msgLocalId: 'l2', timestamp: 200 }));
    queue.add(createMessage({ msgLocalId: 'l3', timestamp: 300 }));

    const result = queue.getByTimeRange(100, 200);

    expect(result.map(item => item.msgLocalId)).toEqual(['l1', 'l2']);
  });

  it('按会话查询并支持 clear', () => {
    const queue = new MessageQueue();

    queue.add(createMessage({ msgLocalId: 'l1', channelId: 'c1', timestamp: 100 }));
    queue.add(createMessage({ msgLocalId: 'l2', channelId: 'c2', timestamp: 110 }));
    queue.add(createMessage({ msgLocalId: 'l3', channelId: 'c1', timestamp: 120 }));

    const conversationMessages = queue.getByConversation('c1');
    expect(conversationMessages.map((item: Message) => item.msgLocalId)).toEqual(['l1', 'l3']);

    queue.clear();
    expect(queue.size()).toBe(0);
    expect(queue.getAll()).toEqual([]);
  });
});
