import { describe, expect, it, vi } from 'vitest';

import { EventHub } from '@/core/events/event-hub';
import { MessageReceiver } from '@/core/message/message-receiver';
import type { MessageSender } from '@/core/message/message-sender';
import { MsyncCodec } from '@/protocol/msync/codec';

const createMessageSenderStub = (): Pick<MessageSender, 'handleAck' | 'handleSendError'> => {
  return {
    handleAck: vi.fn(),
    handleSendError: vi.fn(),
  };
};

describe('MessageReceiver thread events', () => {
  it('应分发内部 thread 通知事件', () => {
    const codec = new MsyncCodec({
      appKey: 'test-app',
      userId: 'alice',
      token: 'test-token',
    });
    const eventHub = new EventHub();
    const receiver = new MessageReceiver(codec, createMessageSenderStub() as MessageSender, eventHub);

    const onChatThreadNotify = vi.fn();
    eventHub.addEventHandler('test', {
      onChatThreadNotify,
    });

    vi.spyOn(codec, 'decodeSync').mockReturnValue({
      ack: undefined,
      messages: [],
      notifies: [
        {
          type: 'thread',
          eventName: 'onChatThreadChange',
          data: {
            eventName: 'onChatThreadChange',
            payload: {
              id: 'thread-1',
              name: 'topic-1',
              muc_parent_id: 'group-1',
              from: 'bob',
              operation: 'create',
              timestamp: 123,
            },
          },
        },
      ],
    });

    receiver.handleSyncPayload(new Uint8Array([1, 2, 3]));

    expect(onChatThreadNotify).toHaveBeenCalledWith({
      eventName: 'onChatThreadChange',
      payload: {
        id: 'thread-1',
        name: 'topic-1',
        muc_parent_id: 'group-1',
        from: 'bob',
        operation: 'create',
        timestamp: 123,
      },
    });
  });
});
