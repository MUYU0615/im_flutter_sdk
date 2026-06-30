import { describe, expect, it } from 'vitest';

import { buildGroupMucSyncPayload } from './multi-device-fixtures';
import { MsyncCodec } from '@/protocol/msync/codec';
import {
  normalizeMultiDeviceGroupEvent,
} from '@/protocol/msync/multi-device-normalizer';

describe('multi-device group normalizer', () => {
  it('应映射群组多设备操作并归一化成员与设备信息', () => {
    const event = normalizeMultiDeviceGroupEvent(
      {
        operation: 7,
        groupId: 'g1',
        groupName: 'Group 1',
        from: {
          name: 'bob',
          clientResource: 'android-1',
        },
        to: [{ name: 'alice' }],
        members: ['carol', 'dave'],
        timestamp: 456,
      },
      {
        userId: 'alice',
        clientResource: 'webim',
      }
    );

    expect(event).toEqual({
      category: 'group',
      operation: 'GROUP_INVITE',
      groupId: 'g1',
      userIds: ['carol', 'dave'],
      operatorId: 'bob',
      groupName: 'Group 1',
      deviceId: 'android-1',
      timestamp: 456,
      raw: undefined,
    });
  });

  it('应保留从 raw/resource 归一后的 deviceId', () => {
    const event = normalizeMultiDeviceGroupEvent(
      {
        operation: 21,
        groupId: 'g2',
        from: {
          name: 'owner',
        },
        raw: {
          resource: 'ipad-1',
        },
      },
      {
        userId: 'alice',
      }
    );

    expect(event?.deviceId).toBe('ipad-1');
    expect(event?.operation).toBe('GROUP_ADD_ADMIN');
  });

  it('chatroom MUC payload 不应产出 MultiDevice 事件', () => {
    const codec = new MsyncCodec({
      appKey: 'test-app',
      userId: 'alice',
      token: 'token',
    });

    const result = codec.decodeSync(
      buildGroupMucSyncPayload({
        operation: 14,
        from: 'bob',
        groupId: 'room-1',
        groupName: 'Room 1',
        eventExt: JSON.stringify({
          name: 'Room 2',
          members_only: true,
        }),
        isChatroom: true,
      })
    );

    expect(result.notifies).toHaveLength(1);
    expect(result.notifies?.[0]).toMatchObject({
      type: 'chatroom',
      eventName: 'onChatRoomNotify',
    });
    expect(result.notifies?.some(item => item.type === 'multiDevice')).toBe(false);
  });
});
