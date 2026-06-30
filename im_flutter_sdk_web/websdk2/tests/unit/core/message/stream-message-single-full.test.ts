import { describe, expect, it } from 'vitest';
import { StreamMessageStatus, type StreamMessage } from '@/types';
import { EventHub } from '@/core/events/event-hub';
import { StreamMessageHandler } from '@/core/message/stream-message-handler';
import { buildStreamChunk } from '../../../test-utils/stream/build-stream-chunk';

describe('StreamMessageHandler single full', () => {
  it('仅一片时应回调 STREAM_FULL 且仅一次', () => {
    const eventHub = new EventHub();
    const handler = new StreamMessageHandler(eventHub);
    const received: StreamMessage[] = [];

    eventHub.addEventHandler('stream-single-full', {
      onStreamMessage: message => {
        received.push(message);
      },
    });

    handler.handle(
      buildStreamChunk({
        msgId: 'stream-single-1',
        seq: 0,
        status: StreamMessageStatus.FULL,
        deltaText: 'HELLO',
        fullText: 'HELLO',
      })
    );

    expect(received).toHaveLength(1);
    const firstMessage = received[0];
    expect(firstMessage).toBeDefined();
    if (!firstMessage) {
      throw new Error('未收到单片流消息');
    }
    expect(firstMessage.stream.status).toBe(StreamMessageStatus.FULL);
    expect(firstMessage.stream.deltaText).toBe('HELLO');
    expect(firstMessage.stream.fullText).toBe('HELLO');
    expect(firstMessage.body.content).toBe('HELLO');
  });
});
