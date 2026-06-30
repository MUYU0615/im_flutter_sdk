import { describe, expect, it } from 'vitest';
import { StreamMessageStatus, type StreamMessage } from '@/types';
import { EventHub } from '@/core/events/event-hub';
import { StreamMessageHandler } from '@/core/message/stream-message-handler';
import { buildStreamChunk } from '../../../test-utils/stream/build-stream-chunk';

describe('StreamMessageHandler ordering', () => {
  it('应在乱序场景按 seq 顺序回调并维护 full/delta 语义', () => {
    const eventHub = new EventHub();
    const handler = new StreamMessageHandler(eventHub);
    const received: StreamMessage[] = [];

    eventHub.addEventHandler('stream-ordering', {
      onStreamMessage: message => {
        received.push(message);
      },
    });

    handler.handle(
      buildStreamChunk({
        msgId: 'stream-ordering-1',
        seq: 0,
        status: StreamMessageStatus.START,
        deltaText: 'A',
        fullText: 'A',
      })
    );
    handler.handle(
      buildStreamChunk({
        msgId: 'stream-ordering-1',
        seq: 2,
        status: StreamMessageStatus.IN_PROGRESS,
        deltaText: 'C',
        fullText: 'ABC',
      })
    );
    handler.handle(
      buildStreamChunk({
        msgId: 'stream-ordering-1',
        seq: 1,
        status: StreamMessageStatus.IN_PROGRESS,
        deltaText: 'B',
        fullText: 'AB',
      })
    );
    handler.handle(
      buildStreamChunk({
        msgId: 'stream-ordering-1',
        seq: 3,
        status: StreamMessageStatus.COMPLETED,
        deltaText: 'D',
        fullText: 'ABCD',
      })
    );

    expect(received.map(message => message.stream.seq)).toEqual([0, 1, 2, 3]);
    expect(received.map(message => message.stream.deltaText)).toEqual(['A', 'B', 'C', 'D']);
    expect(received.map(message => message.stream.fullText)).toEqual(['A', 'AB', 'ABC', 'ABCD']);
    expect(received.map(message => message.body.content)).toEqual(['A', 'AB', 'ABC', 'ABCD']);
    expect(received.at(-1)?.stream.status).toBe(StreamMessageStatus.COMPLETED);
  });
});
