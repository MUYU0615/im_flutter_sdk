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

describe('MessageReceiver chatroom events', () => {
  it('应分发内部聊天室通知事件', () => {
    const codec = new MsyncCodec({
      appKey: 'test-app',
      userId: 'alice',
      token: 'test-token',
    });
    const eventHub = new EventHub();
    const receiver = new MessageReceiver(codec, createMessageSenderStub() as MessageSender, eventHub);

    const onChatRoomNotify = vi.fn();
    eventHub.addEventHandler('test', {
      onChatRoomNotify,
    });

    vi.spyOn(codec, 'decodeSync').mockReturnValue({
      ack: undefined,
      messages: [],
      notifies: [
        {
          type: 'chatroom',
          eventName: 'onChatRoomNotify',
          data: {
            eventName: 'onAnnouncementChanged',
            payload: {
              chatRoomId: 'r1',
              announcement: 'welcome',
            },
          },
        },
      ],
    });

    receiver.handleSyncPayload(new Uint8Array([1, 2, 3]));

    expect(onChatRoomNotify).toHaveBeenCalledWith({
      eventName: 'onAnnouncementChanged',
      payload: {
        chatRoomId: 'r1',
        announcement: 'welcome',
      },
    });
  });
});
