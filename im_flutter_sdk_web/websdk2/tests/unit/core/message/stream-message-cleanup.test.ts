import { describe, expect, it } from 'vitest';
import { StreamMessageStatus, type StreamMessage } from '@/types';
import { EventHub } from '@/core/events/event-hub';
import { StreamMessageHandler } from '@/core/message/stream-message-handler';
import { buildStreamChunk } from '../../../test-utils/stream/build-stream-chunk';

describe('StreamMessageHandler cleanup', () => {
  it('流完成后应忽略后续历史分片', () => {
    const eventHub = new EventHub();
    const handler = new StreamMessageHandler(eventHub);
    const received: StreamMessage[] = [];

    eventHub.addEventHandler('stream-cleanup', {
      onStreamMessage: message => {
        received.push(message);
      },
    });

    handler.handle(
      buildStreamChunk({
        msgId: 'stream-cleanup-1',
        seq: 0,
        status: StreamMessageStatus.START,
        deltaText: 'A',
        fullText: 'A',
      })
    );
    handler.handle(
      buildStreamChunk({
        msgId: 'stream-cleanup-1',
        seq: 3,
        status: StreamMessageStatus.FULL,
        deltaText: 'ABC',
        fullText: 'ABC',
      })
    );
    handler.handle(
      buildStreamChunk({
        msgId: 'stream-cleanup-1',
        seq: 1,
        status: StreamMessageStatus.IN_PROGRESS,
        deltaText: 'B',
        fullText: 'AB',
      })
    );

    expect(received).toHaveLength(2);
    const completedMessage = received[1];
    expect(completedMessage).toBeDefined();
    if (!completedMessage) {
      throw new Error('未收到完成态流消息');
    }
    expect(completedMessage.stream.status).toBe(StreamMessageStatus.COMPLETED);
    expect(completedMessage.body.content).toBe('ABC');
  });
});
