import { describe, expect, it } from 'vitest';

import { RosterSyncSession } from '@/core/contact-sync/roster-sync-session';
import { RosterMessageType, RosterResponseType } from '@/protocol/roster/types';
import { ERROR_CODES } from '@/utils/error-codes';
import { SDKError } from '@/utils/errors';

describe('RosterSyncSession', () => {
  it('responseType 变化时应抛出 cursor invalid 错误', () => {
    const session = new RosterSyncSession('r1');

    session.push({
      type: RosterMessageType.RESPONSE,
      data: [],
      cursor: 1,
      version: 'v1',
      responseType: RosterResponseType.FULL,
    });

    try {
      session.push({
        type: RosterMessageType.RESPONSE,
        data: [],
        cursor: 0,
        version: 'v1',
        responseType: RosterResponseType.INCREMENTAL,
      });
      expect.unreachable('expected session.push to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(SDKError);
      expect((error as SDKError).code).toBe(ERROR_CODES.CONTACT_SYNC_CURSOR_INVALID);
    }
  });

  it('全量分页 cursor 重复时应抛出 cursor invalid 错误', () => {
    const session = new RosterSyncSession('r1');

    session.push({
      type: RosterMessageType.RESPONSE,
      data: [],
      cursor: 9,
      version: 'v1',
      responseType: RosterResponseType.FULL,
    });

    try {
      session.push({
        type: RosterMessageType.RESPONSE,
        data: [],
        cursor: 9,
        version: 'v1',
        responseType: RosterResponseType.FULL,
      });
      expect.unreachable('expected session.push to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(SDKError);
      expect((error as SDKError).code).toBe(ERROR_CODES.CONTACT_SYNC_CURSOR_INVALID);
    }
  });

  it('应推进 nextCursor 和 pageCount，并在 cursor 为 0 时标记完成', () => {
    const session = new RosterSyncSession('r1');

    expect(
      session.push({
        type: RosterMessageType.RESPONSE,
        data: [],
        cursor: 9,
        version: 'v1',
        responseType: RosterResponseType.FULL,
      })
    ).toEqual({
      done: false,
      nextCursor: 9,
      pageCount: 1,
    });
    expect(session.getNextCursor()).toBe(9);
    expect(session.getPageCount()).toBe(1);
    expect(session.hasPages()).toBe(true);
    expect(session.isCompleted()).toBe(false);

    expect(
      session.push({
        type: RosterMessageType.RESPONSE,
        data: [],
        cursor: 0,
        version: '',
        responseType: RosterResponseType.FULL,
      })
    ).toEqual({
      done: true,
      nextCursor: 0,
      pageCount: 2,
    });
    expect(session.getNextCursor()).toBe(0);
    expect(session.getPageCount()).toBe(2);
    expect(session.isCompleted()).toBe(true);
  });

  it('应构建 incremental 结果并在 version 为空时沿用旧值', () => {
    const session = new RosterSyncSession('r1');

    expect(
      session.push({
        type: RosterMessageType.RESPONSE,
        data: [],
        cursor: 1,
        version: 'v-initial',
        responseType: RosterResponseType.INCREMENTAL,
      })
    ).toEqual({
      done: false,
      nextCursor: 1,
      pageCount: 1,
    });

    expect(
      session.push({
        type: RosterMessageType.RESPONSE,
        data: [],
        cursor: 0,
        version: '',
        responseType: RosterResponseType.INCREMENTAL,
      })
    ).toEqual({
      done: true,
      nextCursor: 0,
      pageCount: 2,
    });

    expect(session.buildResult()).toEqual({
      mode: 'incremental',
      version: 'v-initial',
      pages: [
        {
          type: RosterMessageType.RESPONSE,
          data: [],
          cursor: 1,
          version: 'v-initial',
          responseType: RosterResponseType.INCREMENTAL,
        },
        {
          type: RosterMessageType.RESPONSE,
          data: [],
          cursor: 0,
          version: '',
          responseType: RosterResponseType.INCREMENTAL,
        },
      ],
    });
  });

  it('response requestId 不匹配时应抛出 proto decode failed 错误', () => {
    const session = new RosterSyncSession('r1');

    try {
      session.push({
        type: RosterMessageType.RESPONSE,
        header: {
          resource: 'resource',
          timestamp: 1,
          requestId: 'r2',
          protocolVersion: 1,
        },
        data: [],
        cursor: 0,
        version: 'v1',
        responseType: RosterResponseType.FULL,
      });
      expect.unreachable('expected session.push to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(SDKError);
      expect((error as SDKError).code).toBe(ERROR_CODES.CONTACT_SYNC_PROTO_DECODE_FAILED);
    }
  });
});
