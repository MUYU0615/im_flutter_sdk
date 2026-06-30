import { describe, expect, it, vi } from 'vitest';
import { EventHub } from '@/core/events/event-hub';
import { MessageReceiver } from '@/core/message/message-receiver';
import { StreamMessageStatus, type StreamMessage } from '@/types';
import { buildStreamChunk } from '../../../test-utils/stream/build-stream-chunk';

describe('MessageReceiver stream regression', () => {
  it('流式消息应走 onStreamMessage，且不触发 onMessage', () => {
    const eventHub = new EventHub();
    const onStreamMessage = vi.fn();
    const onMessage = vi.fn();

    eventHub.addEventHandler('receiver-stream', {
      onStreamMessage,
      onMessage,
    });

    const receiver = new MessageReceiver({} as never, {} as never, eventHub);
    const dispatchMessage = receiver as unknown as { dispatchMessage: (message: StreamMessage) => void };

    dispatchMessage.dispatchMessage(
      buildStreamChunk({
        msgId: 'receiver-stream-1',
        seq: 0,
        status: StreamMessageStatus.FULL,
        deltaText: 'HELLO',
        fullText: 'HELLO',
      })
    );

    expect(onStreamMessage).toHaveBeenCalledTimes(1);
    expect(onMessage).not.toHaveBeenCalled();
  });
});
