import { describe, expect, it } from 'vitest';

import {
  normalizeMultiDeviceConversationEvent,
  normalizeMultiDeviceConversationMuteEvents,
} from '@/protocol/msync/multi-device-normalizer';

describe('multi-device conversation normalizer', () => {
  it('应映射会话置顶、标记、删除操作', () => {
    const pinned = normalizeMultiDeviceConversationEvent(
      {
        operation: 'pin',
        id: 'c1',
        type: 'chat',
        from: 'bob',
        res: 'ios-1',
        ts: 1000,
      },
      {
        userId: 'alice',
        clientResource: 'webim',
      }
    );
    const marked = normalizeMultiDeviceConversationEvent(
      {
        operation: 'mark',
        id: 'g1',
        type: 'group',
        from: 'bob',
        res: 'android-1',
        ts: '1001',
        ext: '3',
      },
      {
        userId: 'alice',
      }
    );
    const deleted = normalizeMultiDeviceConversationEvent(
      {
        operation: 'del',
        id: 'g2',
        type: 'group',
        from: 'bob',
        res: 'android-1',
        ts: 1002,
      },
      {
        userId: 'alice',
      }
    );

    expect(pinned).toMatchObject({
      category: 'conversation',
      operation: 'CONVERSATION_PINNED',
      conversationId: 'c1',
      conversationType: 'singleChat',
      operatorId: 'bob',
      deviceId: 'ios-1',
      timestamp: 1000,
    });
    expect(marked).toMatchObject({
      operation: 'CONVERSATION_MARK',
      conversationId: 'g1',
      conversationType: 'groupChat',
      mark: 3,
    });
    expect(deleted).toMatchObject({
      operation: 'CONVERSATION_DELETED',
      conversationId: 'g2',
      conversationType: 'groupChat',
    });
  });

  it('应映射会话免打扰变更为 conversation 事件', () => {
    const events = normalizeMultiDeviceConversationMuteEvents(
      [
        {
          group: 'g1',
          operator_resource: 'ios-1',
          data: {
            type: 'NONE',
            enabled: true,
          },
        },
      ],
      {
        userId: 'alice',
        clientResource: 'webim',
      }
    );

    expect(events).toEqual([
      {
        category: 'conversation',
        operation: 'CONVERSATION_MUTE_INFO_CHANGED',
        conversationId: 'g1',
        conversationType: 'groupChat',
        remindType: 'NONE',
        silentMode: {
          type: 'NONE',
          enabled: true,
        },
        deviceId: 'ios-1',
        raw: {
          group: 'g1',
          operator_resource: 'ios-1',
          data: {
            type: 'NONE',
            enabled: true,
          },
        },
      },
    ]);
  });
});
