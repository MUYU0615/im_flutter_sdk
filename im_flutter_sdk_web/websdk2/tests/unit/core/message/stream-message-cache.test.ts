import { describe, expect, it } from 'vitest';
import { StreamMessageStatus } from '@/types';
import { StreamMessageCache } from '@/core/message/stream-message-cache';
import { buildStreamChunk } from '../../../test-utils/stream/build-stream-chunk';

describe('StreamMessageCache', () => {
  it('应按 startSeq 和 lastDispatchedSeq 返回连续分片', () => {
    const cache = new StreamMessageCache();
    const msgId = 'stream-cache-1';

    cache.addChunk(
      msgId,
      buildStreamChunk({
        msgId,
        seq: 0,
        status: StreamMessageStatus.START,
        deltaText: 'A',
        fullText: 'A',
      })
    );
    cache.addChunk(
      msgId,
      buildStreamChunk({
        msgId,
        seq: 2,
        status: StreamMessageStatus.IN_PROGRESS,
        deltaText: 'C',
        fullText: 'ABC',
      })
    );

    const sequential1 = cache.getSequentialChunks(msgId);
    expect(sequential1.map(chunk => chunk.stream.seq)).toEqual([0]);

    const firstChunk = sequential1[0];
    expect(firstChunk).toBeDefined();
    if (!firstChunk) {
      throw new Error('首个连续分片不存在');
    }
    cache.markDispatched(msgId, firstChunk, 'A');
    expect(cache.getSequentialChunks(msgId)).toEqual([]);

    cache.addChunk(
      msgId,
      buildStreamChunk({
        msgId,
        seq: 1,
        status: StreamMessageStatus.IN_PROGRESS,
        deltaText: 'B',
        fullText: 'AB',
      })
    );

    const sequential2 = cache.getSequentialChunks(msgId);
    expect(sequential2.map(chunk => chunk.stream.seq)).toEqual([1, 2]);
  });

  it('重复 seq 分片应标记为 duplicate', () => {
    const cache = new StreamMessageCache();
    const msgId = 'stream-cache-2';
    const chunk = buildStreamChunk({
      msgId,
      seq: 1,
      status: StreamMessageStatus.START,
      deltaText: 'A',
      fullText: 'A',
    });

    expect(cache.addChunk(msgId, chunk).duplicate).toBe(false);
    expect(cache.addChunk(msgId, chunk).duplicate).toBe(true);
  });
});
