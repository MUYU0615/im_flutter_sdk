import { describe, expect, it } from 'vitest';

import {
  normalizeMultiDeviceContactEvent,
} from '@/protocol/msync/multi-device-normalizer';

describe('multi-device contact normalizer', () => {
  it('应映射联系人多设备操作并保留目标用户与设备信息', () => {
    const event = normalizeMultiDeviceContactEvent(
      {
        operation: 3,
        from: {
          name: 'bob',
          clientResource: 'ios-1',
        },
        to: [
          {
            name: 'alice',
          },
        ],
        rosterVersion: 'rv-1',
        ext: 'hello',
        timestamp: 123,
        raw: {
          deviceId: 'ios-1',
        },
      },
      {
        userId: 'alice',
        clientResource: 'webim',
      }
    );

    expect(event).toEqual({
      category: 'contact',
      operation: 'CONTACT_REMOVE',
      targetUserId: 'alice',
      rosterVersion: 'rv-1',
      ext: 'hello',
      deviceId: 'ios-1',
      timestamp: 123,
      raw: {
        deviceId: 'ios-1',
      },
    });
  });

  it.each([
    [4, 'CONTACT_ACCEPT'],
    [5, 'CONTACT_DECLINE'],
    [8, 'CONTACT_ACCEPT'],
    [9, 'CONTACT_DECLINE'],
  ])('应把联系人操作 %s 映射为 %s', (operation, expected) => {
    const event = normalizeMultiDeviceContactEvent(
      {
        operation,
        from: {
          name: 'bob',
        },
        to: [{ name: 'alice' }],
      },
      {
        userId: 'alice',
      }
    );

    expect(event?.operation).toBe(expected);
    expect(event?.targetUserId).toBe('alice');
  });
});
