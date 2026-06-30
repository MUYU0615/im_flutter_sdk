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

describe('MessageReceiver group events', () => {
  it('应分发内部群组通知事件', () => {
    const codec = new MsyncCodec({
      appKey: 'test-app',
      userId: 'alice',
      token: 'test-token',
    });
    const eventHub = new EventHub();
    const receiver = new MessageReceiver(codec, createMessageSenderStub() as MessageSender, eventHub);

    const onGroupNotify = vi.fn();
    eventHub.addEventHandler('test', {
      onGroupNotify,
    });

    vi.spyOn(codec, 'decodeSync').mockReturnValue({
      ack: undefined,
      messages: [],
      notifies: [
        {
          type: 'group',
          eventName: 'onGroupNotify',
          data: {
            eventName: 'onInvitationReceived',
            payload: {
              groupId: 'g1',
              groupName: 'Group 1',
              inviterId: 'bob',
              reason: 'join us',
            },
          },
        },
      ],
    });

    receiver.handleSyncPayload(new Uint8Array([1, 2, 3]));

    expect(onGroupNotify).toHaveBeenCalledWith({
      eventName: 'onInvitationReceived',
      payload: {
        groupId: 'g1',
        groupName: 'Group 1',
        inviterId: 'bob',
        reason: 'join us',
      },
    });
  });
});
