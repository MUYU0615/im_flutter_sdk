import { describe, expect, it } from 'vitest';

import {
  normalizeMultiDeviceMessageRemovedEvent,
} from '@/protocol/msync/multi-device-normalizer';

describe('multi-device message-removed normalizer', () => {
  it('应要求 messageIds 或 beforeTimestamp 至少存在其一', () => {
    const event = normalizeMultiDeviceMessageRemovedEvent(
      {
        chatType: 'groupchat',
        to: 'group-1',
        resource: 'ios-1',
        messageRoamingType: 'deleteRoaming',
      },
      {
        userId: 'alice',
        clientResource: 'webim',
      }
    );

    expect(event).toBeNull();
  });

  it('应映射漫游删除消息列表与删除时间', () => {
    const event = normalizeMultiDeviceMessageRemovedEvent(
      {
        chatType: 'groupchat',
        to: 'group-1',
        resource: 'ios-1',
        msgIdList: ['m1', 'm2'],
        deleteTime: 1234,
        messageRoamingType: 'deleteRoaming',
      },
      {
        userId: 'alice',
      }
    );

    expect(event).toEqual({
      category: 'messageRemoved',
      operation: 'MESSAGE_REMOVED',
      conversationId: 'group-1',
      conversationType: 'groupChat',
      messageIds: ['m1', 'm2'],
      beforeTimestamp: 1234,
      deviceId: 'ios-1',
      raw: undefined,
    });
  });
});
