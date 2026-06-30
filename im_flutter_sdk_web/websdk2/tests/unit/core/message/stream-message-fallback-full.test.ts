import { describe, expect, it } from 'vitest';
import { StreamMessageStatus, type StreamMessage } from '@/types';
import { EventHub } from '@/core/events/event-hub';
import { StreamMessageHandler } from '@/core/message/stream-message-handler';
import { buildStreamChunk } from '../../../test-utils/stream/build-stream-chunk';

describe('StreamMessageHandler fallback full', () => {
  it('缺片未补齐时收到 FULL 应兜底完成', () => {
    const eventHub = new EventHub();
    const handler = new StreamMessageHandler(eventHub);
    const received: StreamMessage[] = [];

    eventHub.addEventHandler('stream-fallback-full', {
      onStreamMessage: message => {
        received.push(message);
      },
    });

    handler.handle(
      buildStreamChunk({
        msgId: 'stream-fallback-1',
        seq: 0,
        status: StreamMessageStatus.START,
        deltaText: 'A',
        fullText: 'A',
      })
    );
    handler.handle(
      buildStreamChunk({
        msgId: 'stream-fallback-1',
        seq: 2,
        status: StreamMessageStatus.IN_PROGRESS,
        deltaText: 'C',
        fullText: 'ABC',
      })
    );
    handler.handle(
      buildStreamChunk({
        msgId: 'stream-fallback-1',
        seq: 3,
        status: StreamMessageStatus.FULL,
        deltaText: 'ABC',
        fullText: 'ABC',
      })
    );

    expect(received).toHaveLength(2);
    const firstMessage = received[0];
    const completedMessage = received[1];
    expect(firstMessage).toBeDefined();
    expect(completedMessage).toBeDefined();
    if (!firstMessage || !completedMessage) {
      throw new Error('Expected stream messages to be emitted');
    }
    expect(firstMessage.stream.status).toBe(StreamMessageStatus.START);
    expect(completedMessage.stream.status).toBe(StreamMessageStatus.COMPLETED);
    expect(completedMessage.stream.deltaText).toBe('BC');
    expect(completedMessage.stream.fullText).toBe('ABC');
    expect(completedMessage.body.content).toBe('ABC');
  });
});
