import { describe, expect, it } from 'vitest';
import { StreamMessageStatus, type ChatEventHandlerMap, type StreamMessage } from '@/types';

const createHandlerMap = (): ChatEventHandlerMap => {
  return {
    onStreamMessage: (message: StreamMessage): void => {
      const status = message.stream.status;
      if (status === StreamMessageStatus.ERROR) {
        // no-op
      }
    },
  };
};

describe('stream event types', () => {
  it('ChatEventHandlerMap 应支持 onStreamMessage', () => {
    const handlers = createHandlerMap();
    expect(typeof handlers.onStreamMessage).toBe('function');
  });
});
