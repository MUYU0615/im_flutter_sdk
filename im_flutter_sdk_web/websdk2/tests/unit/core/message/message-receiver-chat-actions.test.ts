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

describe('MessageReceiver chat action events', () => {
  it('应把 read/recall/update 内部通知分发为 Chat 事件', () => {
    const codec = new MsyncCodec({
      appKey: 'test-app',
      userId: 'alice',
      token: 'token',
    });
    const eventHub = new EventHub();
    const receiver = new MessageReceiver(
      codec,
      createMessageSenderStub() as MessageSender,
      eventHub
    );

    const onMessageRead = vi.fn();
    const onConversationRead = vi.fn();
    const onMessageRecalled = vi.fn();
    const onMessageUpdated = vi.fn();
    eventHub.addEventHandler('test', {
      onMessageRead,
      onConversationRead,
      onMessageRecalled,
      onMessageUpdated,
    });

    vi.spyOn(codec, 'decodeSync').mockReturnValue({
      ack: undefined,
      messages: [],
      notifies: [
        {
          type: 'message_read',
          data: {
            messageId: 'm1',
            conversationId: 'u1',
            conversationType: 'singleChat',
            isGroupAck: false,
            timestamp: 1,
          },
        },
        {
          type: 'conversation_read',
          data: {
            conversationId: 'u1',
            conversationType: 'singleChat',
            timestamp: 2,
          },
        },
        {
          type: 'message_recalled',
          data: {
            messageId: 'm2',
            conversationId: 'g1',
            conversationType: 'groupChat',
            timestamp: 3,
          },
        },
        {
          type: 'message_updated',
          data: {
            messageId: 'm3',
            conversationId: 'u2',
            conversationType: 'singleChat',
            timestamp: 4,
            message: {
              type: 'text',
              body: {
                content: 'edited',
              },
              ext: {
                edited: 'true',
              },
            },
          },
        },
      ],
    });

    receiver.handleSyncPayload(new Uint8Array([1, 2, 3]));

    expect(onMessageRead).toHaveBeenCalledWith([
      {
        messageId: 'm1',
        conversationId: 'u1',
        conversationType: 'singleChat',
        ackContent: undefined,
      },
    ]);
    expect(onConversationRead).toHaveBeenCalledWith({
      conversationId: 'u1',
      conversationType: 'singleChat',
      timestamp: 2,
    });
    expect(onMessageRecalled).toHaveBeenCalledWith({
      messageId: 'm2',
      conversationId: 'g1',
      conversationType: 'groupChat',
      timestamp: 3,
    });
    expect(onMessageUpdated).toHaveBeenCalledWith({
      messageId: 'm3',
      conversationId: 'u2',
      conversationType: 'singleChat',
      timestamp: 4,
      message: {
        type: 'text',
        body: {
          content: 'edited',
        },
        ext: {
          edited: 'true',
        },
      },
    });
  });

  it('应保留群消息 read notify 的 groupChat 类型', () => {
    const codec = new MsyncCodec({
      appKey: 'test-app',
      userId: 'alice',
      token: 'token',
    });
    const eventHub = new EventHub();
    const receiver = new MessageReceiver(
      codec,
      createMessageSenderStub() as MessageSender,
      eventHub
    );

    const onMessageRead = vi.fn();
    eventHub.addEventHandler('test', {
      onMessageRead,
    });

    vi.spyOn(codec, 'decodeSync').mockReturnValue({
      ack: undefined,
      messages: [],
      notifies: [
        {
          type: 'message_read',
          data: {
            messageId: 'group-read-1',
            conversationId: 'group-1',
            conversationType: 'chatRoom',
            isGroupAck: true,
            ackContent: 'seen',
          },
        },
      ],
    });

    receiver.handleSyncPayload(new Uint8Array([1, 2, 3]));

    expect(onMessageRead).toHaveBeenCalledWith([
      {
        messageId: 'group-read-1',
        conversationId: 'group-1',
        conversationType: 'chatRoom',
        ackContent: 'seen',
      },
    ]);
  });

  it('应把同一轮 sync 中的多条 read notify 聚合为数组事件', () => {
    const codec = new MsyncCodec({
      appKey: 'test-app',
      userId: 'alice',
      token: 'token',
    });
    const eventHub = new EventHub();
    const receiver = new MessageReceiver(
      codec,
      createMessageSenderStub() as MessageSender,
      eventHub
    );

    const onMessageRead = vi.fn();
    eventHub.addEventHandler('test', {
      onMessageRead,
    });

    vi.spyOn(codec, 'decodeSync').mockReturnValue({
      ack: undefined,
      messages: [],
      notifies: [
        {
          type: 'message_read',
          data: {
            messageId: 'group-read-1',
            conversationId: 'group-1',
            conversationType: 'groupChat',
            isGroupAck: true,
            ackContent: 'seen-1',
          },
        },
        {
          type: 'message_read',
          data: {
            messageId: 'group-read-2',
            conversationId: 'group-1',
            conversationType: 'groupChat',
            isGroupAck: true,
            ackContent: 'seen-2',
          },
        },
      ],
    });

    receiver.handleSyncPayload(new Uint8Array([1, 2, 3]));

    expect(onMessageRead).toHaveBeenCalledTimes(1);
    expect(onMessageRead).toHaveBeenCalledWith([
      {
        messageId: 'group-read-1',
        conversationId: 'group-1',
        conversationType: 'groupChat',
        ackContent: 'seen-1',
      },
      {
        messageId: 'group-read-2',
        conversationId: 'group-1',
        conversationType: 'groupChat',
        ackContent: 'seen-2',
      },
    ]);
  });

  it('应把 reaction notify 分发为 Reaction 事件', () => {
    const codec = new MsyncCodec({
      appKey: 'test-app',
      userId: 'alice',
      token: 'token',
    });
    const eventHub = new EventHub();
    const receiver = new MessageReceiver(
      codec,
      createMessageSenderStub() as MessageSender,
      eventHub
    );

    const onReactionChanged = vi.fn();
    eventHub.addEventHandler('test', {
      onReactionChanged,
    });

    vi.spyOn(codec, 'decodeSync').mockReturnValue({
      ack: undefined,
      messages: [],
      notifies: [
        {
          type: 'reaction',
          data: [
            {
              messageId: 'm1',
              reactions: [
                {
                  reaction: '👍',
                  op: [
                    {
                      operator: 'bob',
                      reactionType: 'create',
                    },
                    {
                      operator: 'carol',
                      reactionType: 'delete',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    receiver.handleSyncPayload(new Uint8Array([1, 2, 3]));

    expect(onReactionChanged).toHaveBeenNthCalledWith(1, {
      messageId: 'm1',
      reaction: '👍',
      operation: 'add',
    });
    expect(onReactionChanged).toHaveBeenNthCalledWith(2, {
      messageId: 'm1',
      reaction: '👍',
      operation: 'remove',
    });
  });

  it('应基于已知消息上下文把群 read notify 回填为 groupChat', () => {
    const codec = new MsyncCodec({
      appKey: 'test-app',
      userId: 'alice',
      token: 'token',
    });
    const eventHub = new EventHub();
    const receiver = new MessageReceiver(
      codec,
      createMessageSenderStub() as MessageSender,
      eventHub
    );

    const onMessageRead = vi.fn();
    eventHub.addEventHandler('test', {
      onMessageRead,
    });

    receiver.rememberSentMessageContext({
      msgLocalId: 'local-group-1',
      from: '',
      to: '',
      msgServerId: 'group-msg-1',
      sender: { userId: 'alice' },
      conversationId: 'group-42',
      conversationType: 'groupChat',
      type: 'text',
      status: 'sent',
      ext: {},
      timestamp: 10,
      body: { content: 'hello group' },
      direct: 'SEND',
    });

    vi.spyOn(codec, 'decodeSync').mockReturnValue({
      ack: undefined,
      messages: [],
      notifies: [
        {
          type: 'message_read',
          data: {
            messageId: 'group-msg-1',
            conversationId: 'reader-user-1',
            conversationType: 'singleChat',
            isGroupAck: false,
            ackContent: 'seen',
          },
        },
      ],
    });

    receiver.handleSyncPayload(new Uint8Array([1, 2, 3]));

    expect(onMessageRead).toHaveBeenCalledWith([
      {
        messageId: 'group-msg-1',
        conversationId: 'group-42',
        conversationType: 'groupChat',
        ackContent: 'seen',
      },
    ]);
  });

  it('应把 pin notify 分发为置顶事件，并忽略当前设备自发通知', () => {
    const codec = new MsyncCodec({
      appKey: 'test-app',
      userId: 'alice',
      token: 'token',
    });
    const eventHub = new EventHub();
    const receiver = new MessageReceiver(
      codec,
      createMessageSenderStub() as MessageSender,
      eventHub
    );

    const onPinnedMessageChanged = vi.fn();
    eventHub.addEventHandler('test', {
      onPinnedMessageChanged,
    });

    vi.spyOn(codec, 'getContext').mockReturnValue({
      userId: 'alice',
      clientResource: 'web',
    } as ReturnType<MsyncCodec['getContext']>);
    vi.spyOn(codec, 'decodeSync').mockReturnValue({
      ack: undefined,
      messages: [],
      notifies: [
        {
          type: 'conv',
          data: {
            op: 'pin',
            id: 'group-1',
            type: 'groupChat',
            from: 'bob',
            res: 'ios',
            ts: 10,
            ext: 'm1',
          },
        },
        {
          type: 'conv',
          data: {
            op: 'pin_delete',
            id: 'u1',
            type: 'chat',
            from: 'alice',
            res: 'web',
            ts: 11,
            ext: 'm2',
          },
        },
      ],
    });

    receiver.handleSyncPayload(new Uint8Array([1, 2, 3]));

    expect(onPinnedMessageChanged).toHaveBeenCalledTimes(1);
    expect(onPinnedMessageChanged).toHaveBeenCalledWith({
      messageId: 'm1',
      conversationId: 'group-1',
      conversationType: 'groupChat',
      operation: 'pin',
      operatorId: 'bob',
      pinTime: 10,
    });
  });
});
