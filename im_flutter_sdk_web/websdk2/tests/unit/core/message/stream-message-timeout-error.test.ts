import { describe, expect, it } from 'vitest';
import { StreamMessageStatus, type StreamMessage } from '@/types';
import { EventHub } from '@/core/events/event-hub';
import { StreamMessageHandler } from '@/core/message/stream-message-handler';
import { buildStreamChunk } from '../../../test-utils/stream/build-stream-chunk';

describe('StreamMessageHandler timeout error', () => {
  it('服务端超时错误分片应只回调一次错误态并结束流', () => {
    const eventHub = new EventHub();
    const handler = new StreamMessageHandler(eventHub);
    const received: StreamMessage[] = [];

    eventHub.addEventHandler('stream-timeout-error', {
      onStreamMessage: message => {
        received.push(message);
      },
    });

    handler.handle(
      buildStreamChunk({
        msgId: 'stream-timeout-1',
        seq: 0,
        status: StreamMessageStatus.START,
        deltaText: 'A',
        fullText: 'A',
      })
    );
    handler.handle(
      buildStreamChunk({
        msgId: 'stream-timeout-1',
        seq: 1,
        status: StreamMessageStatus.IN_PROGRESS,
        deltaText: '',
        fullText: 'A',
        errorType: 512,
      })
    );
    handler.handle(
      buildStreamChunk({
        msgId: 'stream-timeout-1',
        seq: 2,
        status: StreamMessageStatus.IN_PROGRESS,
        deltaText: 'B',
        fullText: 'AB',
      })
    );

    expect(received).toHaveLength(2);
    const timeoutMessage = received[1];
    expect(timeoutMessage).toBeDefined();
    if (!timeoutMessage) {
      throw new Error('Expected timeout message to be emitted');
    }
    expect(timeoutMessage.stream.status).toBe(StreamMessageStatus.ERROR);
    expect(timeoutMessage.stream.errorType).toBe(512);
    expect(timeoutMessage.body.content).toBe('A');
  });
});
