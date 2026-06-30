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

describe('MessageReceiver contact events', () => {
  it('应分发 roster 联系人事件', () => {
    const codec = new MsyncCodec({
      appKey: 'test-app',
      userId: 'alice',
      token: 'test-token',
    });
    const eventHub = new EventHub();
    const receiver = new MessageReceiver(codec, createMessageSenderStub() as MessageSender, eventHub);

    const onContactInvited = vi.fn();
    eventHub.addEventHandler('test', {
      onContactInvited,
    });

    vi.spyOn(codec, 'decodeSync').mockReturnValue({
      ack: undefined,
      messages: [],
      notifies: [
        {
          type: 'contact',
          eventName: 'onContactInvited',
          data: {
            type: 'subscribe',
            from: 'bob',
            to: 'alice',
            status: 'hello',
            rosterVersion: 'rv-1',
            userInfo: {
              userId: 'bob',
            },
          },
        },
      ],
    });

    receiver.handleSyncPayload(new Uint8Array([1, 2, 3]));

    expect(onContactInvited).toHaveBeenCalledWith({
      type: 'subscribe',
      from: 'bob',
      to: 'alice',
      status: 'hello',
      rosterVersion: 'rv-1',
      userInfo: {
        userId: 'bob',
      },
    });
  });
});
