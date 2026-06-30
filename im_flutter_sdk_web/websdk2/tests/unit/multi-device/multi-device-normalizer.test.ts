import { describe, expect, it, vi } from 'vitest';

import { buildGroupMucSyncPayload, buildThreadMucSyncPayload } from './multi-device-fixtures';
import {
  isSameDeviceEcho,
  normalizeMultiDeviceContactEvent,
  normalizeMultiDeviceConversationEvent,
  normalizeMultiDeviceGroupEvent,
  normalizeMultiDeviceMessageRemovedEvent,
  resolveDeviceId,
} from '@/protocol/msync/multi-device-normalizer';
import { MsyncCodec } from '@/protocol/msync/codec';
import { logger } from '@/utils/logger';

describe('multi-device normalizer helpers', () => {
  it('应按优先级解析 deviceId，并在缺失时返回 undefined', () => {
    expect(resolveDeviceId('', undefined, 'ios-1', 'android-1')).toBe('ios-1');
    expect(resolveDeviceId(undefined, 'web-1')).toBe('web-1');
    expect(resolveDeviceId(undefined, '', undefined)).toBeUndefined();
  });

  it('应过滤当前资源回声', () => {
    expect(isSameDeviceEcho('webim', 'webim')).toBe(true);
    expect(isSameDeviceEcho('webim', 'ios-1')).toBe(false);
    expect(isSameDeviceEcho(undefined, 'ios-1')).toBe(false);
  });

  it('缺失设备源时应保留 undefined deviceId', () => {
    const contact = normalizeMultiDeviceContactEvent(
      {
        operation: 4,
        from: { name: 'bob' },
        to: [{ name: 'alice' }],
      },
      {
        userId: 'alice',
      }
    );

    expect(contact?.deviceId).toBeUndefined();
  });

  it('同设备回声应被过滤', () => {
    expect(
      normalizeMultiDeviceConversationEvent(
        {
          operation: 'pin',
          id: 'c1',
          type: 'chat',
          res: 'webim',
        },
        {
          userId: 'alice',
          clientResource: 'webim',
        }
      )
    ).toBeNull();
    expect(
      normalizeMultiDeviceMessageRemovedEvent(
        {
          chatType: 'chat',
          to: 'alice',
          resource: 'webim',
          msgIdList: ['m1'],
        },
        {
          userId: 'alice',
          clientResource: 'webim',
        }
      )
    ).toBeNull();
  });

  it('未知操作应记录告警并安全丢弃', () => {
    const warnSpy = vi.spyOn(logger, 'warn');

    expect(
      normalizeMultiDeviceGroupEvent(
        {
          operation: 999,
          groupId: 'g1',
          from: { name: 'bob' },
        },
        {
          userId: 'alice',
        }
      )
    ).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('thread 归一应能直接通过 codec 的 MUC 线程消息路径生效', () => {
    const codec = new MsyncCodec({
      appKey: 'test-app',
      userId: 'alice',
      token: 'token',
    });

    const result = codec.decodeSync(
      buildThreadMucSyncPayload({
        operation: 33,
        from: 'bob',
        threadId: 't1',
        parentId: 'g1',
        fromClientResource: 'ios-1',
      })
    );

    expect(result.notifies).toHaveLength(1);
    expect(result.notifies?.[0]).toMatchObject({
      type: 'multiDevice',
      eventName: 'onMultiDeviceThread',
    });
  });

  it('group 归一应能直接通过 codec 的 MUC 消息路径生效', () => {
    const codec = new MsyncCodec({
      appKey: 'test-app',
      userId: 'alice',
      token: 'token',
    });

    const result = codec.decodeSync(
      buildGroupMucSyncPayload({
        operation: 21,
        from: 'bob',
        groupId: 'g1',
        fromClientResource: 'android-1',
      })
    );

    expect(result.notifies).toHaveLength(2);
    expect(result.notifies?.[1]).toMatchObject({
      type: 'multiDevice',
      eventName: 'onMultiDeviceGroup',
    });
  });
});
