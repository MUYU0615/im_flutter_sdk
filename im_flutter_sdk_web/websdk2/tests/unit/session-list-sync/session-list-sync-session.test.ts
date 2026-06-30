import { describe, expect, it } from 'vitest';

import { SessionListSyncSession } from '@/core/session-list-sync/session-list-sync-session';
import { ERROR_CODES } from '@/utils/error-codes';
import { SDKError } from '@/utils/errors';

describe('SessionListSyncSession 补充测试', () => {
  describe('start()', () => {
    it('在非 idle 状态时不做任何事', () => {
      const session = new SessionListSyncSession('req-start');
      session.start();
      expect(session.getStatus()).toBe('connecting');
      session.start(); // 再次调用
      expect(session.getStatus()).toBe('connecting'); // 状态不变
    });
  });

  describe('markSyncing()', () => {
    it('在 terminal 状态时抛出 SDKError', () => {
      const session = new SessionListSyncSession('req-mark');
      session.start();
      session.fail();
      expect(() => session.markSyncing()).toThrow(SDKError);
    });

    it('在 cancelled 状态时抛出 SDKError', () => {
      const session = new SessionListSyncSession('req-mark2');
      session.start();
      session.cancel();
      expect(() => session.markSyncing()).toThrow(SDKError);
    });
  });

  describe('fail() 和 cancel()', () => {
    it('fail() 将状态设为 failed', () => {
      const session = new SessionListSyncSession('req-fail');
      session.start();
      session.fail();
      expect(session.getStatus()).toBe('failed');
    });

    it('cancel() 将状态设为 cancelled', () => {
      const session = new SessionListSyncSession('req-cancel');
      session.start();
      session.cancel();
      expect(session.getStatus()).toBe('cancelled');
    });
  });

  describe('getItems() 和 getBatchCount()', () => {
    it('返回所有批次的扁平化 items', () => {
      const session = new SessionListSyncSession('req-items');
      session.start();
      session.pushBatch({
        requestId: 'req-items',
        batchSequence: 1,
        sessions: [{ conversationId: 'c1' } as any, { conversationId: 'c2' } as any],
        isLastBatch: false,
      });
      session.pushBatch({
        requestId: 'req-items',
        batchSequence: 2,
        sessions: [{ conversationId: 'c3' } as any],
        isLastBatch: true,
      });
      expect(session.getItems()).toHaveLength(3);
      expect(session.getBatchCount()).toBe(2);
    });
  });

  describe('getStartedAt() 和 getRequestId()', () => {
    it('返回构造时的 requestId', () => {
      const session = new SessionListSyncSession('my-req-id');
      expect(session.getRequestId()).toBe('my-req-id');
    });

    it('返回构造时的时间戳', () => {
      const before = Date.now();
      const session = new SessionListSyncSession('req-time');
      const after = Date.now();
      expect(session.getStartedAt()).toBeGreaterThanOrEqual(before);
      expect(session.getStartedAt()).toBeLessThanOrEqual(after);
    });
  });
});

describe('SessionListSyncSession', () => {
  it('should ignore duplicated batch for same requestId and batchSequence', () => {
    const session = new SessionListSyncSession('req-1');
    session.start();

    expect(
      session.pushBatch({
        requestId: 'req-1',
        batchSequence: 1,
        sessions: [],
        isLastBatch: false,
      })
    ).toEqual({
      accepted: true,
      done: false,
    });

    expect(
      session.pushBatch({
        requestId: 'req-1',
        batchSequence: 1,
        sessions: [],
        isLastBatch: false,
      })
    ).toEqual({
      accepted: false,
      done: false,
    });
  });

  it('should complete on last batch and expose snapshot', () => {
    const session = new SessionListSyncSession('req-2');
    session.start();

    expect(
      session.pushBatch({
        requestId: 'req-2',
        batchSequence: 1,
        sessions: [],
        isLastBatch: true,
      })
    ).toEqual({
      accepted: true,
      done: true,
    });

    expect(session.getStatus()).toBe('completed');
    expect(session.buildSnapshot()).toEqual(
      expect.objectContaining({
        requestId: 'req-2',
        status: 'completed',
        pageCount: 1,
        seenBatchKeys: ['req-2:1'],
      })
    );
  });

  it('should throw on mismatched requestId', () => {
    const session = new SessionListSyncSession('req-3');
    session.start();

    expect(() => {
      session.pushBatch({
        requestId: 'req-other',
        batchSequence: 1,
        sessions: [],
        isLastBatch: false,
      });
    }).toThrowError(SDKError);

    try {
      session.pushBatch({
        requestId: 'req-other',
        batchSequence: 1,
        sessions: [],
        isLastBatch: false,
      });
    } catch (error) {
      expect((error as SDKError).code).toBe(ERROR_CODES.CONTACT_SYNC_CURSOR_INVALID);
    }
  });
});
