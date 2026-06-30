import { describe, expect, it, vi } from 'vitest';

import { EventHub } from '@/core/events/event-hub';
import { MessageReceiver } from '@/core/message/message-receiver';
import type { MessageSender } from '@/core/message/message-sender';
import { MsyncCodec } from '@/protocol/msync/codec';
import type { Message } from '@/types';

const createMessageSenderStub = (): Pick<
  MessageSender,
  'handleAck' | 'handleSendError' | 'sendAction'
> => ({
  handleAck: vi.fn(),
  handleSendError: vi.fn(),
  sendAction: vi.fn().mockResolvedValue({ protocolId: 'p1', serverId: 's1', statusCode: 200 }),
});

function createReceiver(opts?: { enableDeliveryReceipt?: boolean }): {
  receiver: MessageReceiver;
  eventHub: EventHub;
  senderStub: ReturnType<typeof createMessageSenderStub>;
  codec: MsyncCodec;
} {
  const codec = new MsyncCodec({ appKey: 'test-app', userId: 'alice', token: 'token' });
  const eventHub = new EventHub();
  const senderStub = createMessageSenderStub();
  const receiver = new MessageReceiver(codec, senderStub as MessageSender, eventHub);
  if (opts?.enableDeliveryReceipt) {
    receiver.setDeliveryAckEnabled(true);
  }
  return { receiver, eventHub, senderStub, codec };
}

describe('MessageReceiver delivery ack', () => {
  describe('自动发送送达回执', () => {
    it('enableDeliveryReceipt=true 且收到单聊消息时自动发送 deliveryAck', () => {
      const { receiver, senderStub, codec } = createReceiver({ enableDeliveryReceipt: true });

      const message: Message = {
        msgServerId: 'server-msg-1',
        msgLocalId: 'local-1',
        from: 'bob',
        conversationId: 'bob',
        conversationType: 'singleChat',
        type: 'text',
        body: { content: 'hi' },
        status: 'received',
        timestamp: Date.now(),
        sender: { userId: 'bob' },
        ext: {},
      } as unknown as Message;

      vi.spyOn(codec, 'decodeSync').mockReturnValue({
        ack: undefined,
        messages: [message],
        notifies: [],
      });

      receiver.handleSyncPayload(new Uint8Array());

      expect(senderStub.sendAction).toHaveBeenCalledWith({
        kind: 'deliveryAck',
        conversationId: 'bob',
        conversationType: 'singleChat',
        messageId: 'server-msg-1',
      });
    });

    it('enableDeliveryReceipt=false 时不发送送达回执', () => {
      const { receiver, senderStub, codec } = createReceiver({ enableDeliveryReceipt: false });

      const message: Message = {
        msgServerId: 'server-msg-1',
        msgLocalId: 'local-1',
        from: 'bob',
        conversationId: 'bob',
        conversationType: 'singleChat',
        type: 'text',
        body: { content: 'hi' },
        status: 'received',
        timestamp: Date.now(),
        sender: { userId: 'bob' },
        ext: {},
      } as unknown as Message;

      vi.spyOn(codec, 'decodeSync').mockReturnValue({
        ack: undefined,
        messages: [message],
        notifies: [],
      });

      receiver.handleSyncPayload(new Uint8Array());

      expect(senderStub.sendAction).not.toHaveBeenCalled();
    });

    it('群聊消息不发送送达回执', () => {
      const { receiver, senderStub, codec } = createReceiver({ enableDeliveryReceipt: true });

      const message: Message = {
        msgServerId: 'server-msg-2',
        msgLocalId: 'local-2',
        from: 'bob',
        conversationId: 'group1',
        conversationType: 'groupChat',
        type: 'text',
        body: { content: 'hi' },
        status: 'received',
        timestamp: Date.now(),
        sender: { userId: 'bob' },
        ext: {},
      } as unknown as Message;

      vi.spyOn(codec, 'decodeSync').mockReturnValue({
        ack: undefined,
        messages: [message],
        notifies: [],
      });

      receiver.handleSyncPayload(new Uint8Array());

      expect(senderStub.sendAction).not.toHaveBeenCalled();
    });

    it('自己发的消息不发送送达回执', () => {
      const { receiver, senderStub, codec } = createReceiver({ enableDeliveryReceipt: true });

      const message: Message = {
        msgServerId: 'server-msg-3',
        msgLocalId: 'local-3',
        from: 'alice', // 与当前用户相同
        conversationId: 'alice',
        conversationType: 'singleChat',
        type: 'text',
        body: { content: 'hi' },
        status: 'received',
        timestamp: Date.now(),
        sender: { userId: 'alice' },
        ext: {},
      } as unknown as Message;

      vi.spyOn(codec, 'decodeSync').mockReturnValue({
        ack: undefined,
        messages: [message],
        notifies: [],
      });

      receiver.handleSyncPayload(new Uint8Array());

      expect(senderStub.sendAction).not.toHaveBeenCalled();
    });
  });

  describe('接收送达回执事件', () => {
    it('收到 message_delivered notify 时派发 onMessageDelivered 事件', () => {
      const { receiver, eventHub, codec } = createReceiver();

      const onMessageDelivered = vi.fn();
      eventHub.addEventHandler('test', { onMessageDelivered });

      vi.spyOn(codec, 'decodeSync').mockReturnValue({
        ack: undefined,
        messages: [],
        notifies: [
          {
            type: 'message_delivered',
            data: {
              messageId: 'msg-1',
              from: 'bob',
              to: 'alice',
              conversationId: 'bob',
              conversationType: 'singleChat',
            },
          },
        ],
      });

      receiver.handleSyncPayload(new Uint8Array());

      expect(onMessageDelivered).toHaveBeenCalledWith({
        messageId: 'msg-1',
        conversationId: 'bob',
        conversationType: 'singleChat',
      });
    });

    it('message_delivered notify 缺少必要字段时不派发事件', () => {
      const { receiver, eventHub, codec } = createReceiver();

      const onMessageDelivered = vi.fn();
      eventHub.addEventHandler('test', { onMessageDelivered });

      vi.spyOn(codec, 'decodeSync').mockReturnValue({
        ack: undefined,
        messages: [],
        notifies: [
          {
            type: 'message_delivered',
            data: { messageId: 'msg-1' }, // 缺少 from/to/conversationId
          },
        ],
      });

      receiver.handleSyncPayload(new Uint8Array());

      expect(onMessageDelivered).not.toHaveBeenCalled();
    });
  });
});
