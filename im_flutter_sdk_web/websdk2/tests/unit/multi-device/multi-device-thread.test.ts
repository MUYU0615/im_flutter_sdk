import { describe, expect, it } from 'vitest';

import {
  normalizeMultiDeviceThreadEvent,
} from '@/protocol/msync/multi-device-normalizer';

describe('multi-device thread normalizer', () => {
  it('应映射子区多设备操作并保留 parent/thread 信息', () => {
    const event = normalizeMultiDeviceThreadEvent(
      {
        operation: 33,
        threadId: 't1',
        parentId: 'g1',
        threadName: 'thread topic',
        from: {
          name: 'bob',
          clientResource: 'ios-1',
        },
        members: ['alice'],
        timestamp: 789,
      },
      {
        userId: 'alice',
        clientResource: 'webim',
      }
    );

    expect(event).toEqual({
      category: 'thread',
      operation: 'THREAD_CREATE',
      threadId: 't1',
      parentId: 'g1',
      userIds: ['alice'],
      operatorId: 'bob',
      threadName: 'thread topic',
      deviceId: 'ios-1',
      timestamp: 789,
      raw: undefined,
    });
  });
});
