import { describe, expect, it } from 'vitest';
import { StreamMessageStatus, type StreamMessage } from '@/types';
import { EventHub } from '@/core/events/event-hub';
import { StreamMessageHandler } from '@/core/message/stream-message-handler';
import { buildStreamChunk } from '../../../test-utils/stream/build-stream-chunk';

describe('StreamMessageHandler gap recovery', () => {
  it('缺片补齐后应按顺序回放已缓存分片', () => {
    const eventHub = new EventHub();
    const handler = new StreamMessageHandler(eventHub);
    const received: StreamMessage[] = [];

    eventHub.addEventHandler('stream-gap', {
      onStreamMessage: message => {
        received.push(message);
      },
    });

    handler.handle(
      buildStreamChunk({
        msgId: 'stream-gap-1',
        seq: 0,
        status: StreamMessageStatus.START,
        deltaText: 'A',
        fullText: 'A',
      })
    );
    handler.handle(
      buildStreamChunk({
        msgId: 'stream-gap-1',
        seq: 2,
        status: StreamMessageStatus.IN_PROGRESS,
        deltaText: 'C',
        fullText: 'ABC',
      })
    );

    expect(received.map(message => message.stream.seq)).toEqual([0]);

    handler.handle(
      buildStreamChunk({
        msgId: 'stream-gap-1',
        seq: 1,
        status: StreamMessageStatus.IN_PROGRESS,
        deltaText: 'B',
        fullText: 'AB',
      })
    );

    expect(received.map(message => message.stream.seq)).toEqual([0, 1, 2]);
    expect(received.map(message => message.stream.fullText)).toEqual(['A', 'AB', 'ABC']);
  });
});
