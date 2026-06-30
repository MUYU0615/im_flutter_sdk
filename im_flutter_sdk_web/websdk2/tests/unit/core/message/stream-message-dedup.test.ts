import { describe, expect, it } from 'vitest';
import { StreamMessageStatus, type StreamMessage } from '@/types';
import { EventHub } from '@/core/events/event-hub';
import { StreamMessageHandler } from '@/core/message/stream-message-handler';
import { buildStreamChunk } from '../../../test-utils/stream/build-stream-chunk';

describe('StreamMessageHandler dedup', () => {
  it('重复分片不应重复回调', () => {
    const eventHub = new EventHub();
    const handler = new StreamMessageHandler(eventHub);
    const received: StreamMessage[] = [];

    eventHub.addEventHandler('stream-dedup', {
      onStreamMessage: message => {
        received.push(message);
      },
    });

    const firstChunk = buildStreamChunk({
      msgId: 'stream-dedup-1',
      seq: 0,
      status: StreamMessageStatus.START,
      deltaText: 'A',
      fullText: 'A',
    });

    handler.handle(firstChunk);
    handler.handle(firstChunk);
    handler.handle(
      buildStreamChunk({
        msgId: 'stream-dedup-1',
        seq: 1,
        status: StreamMessageStatus.COMPLETED,
        deltaText: 'B',
        fullText: 'AB',
      })
    );

    expect(received.map(message => message.stream.seq)).toEqual([0, 1]);
  });
});
