import { describe, expect, it, vi } from 'vitest';
import { EventHub } from '@/core/events/event-hub';
import { MessageReceiver } from '@/core/message/message-receiver';
import type { Message } from '@/types';

const createMessage = (partial: Partial<Message>): Message => {
  return {
    msgServerId: 'server-1',
    msgLocalId: 'local-1',
    from: '',
    to: '',
    sender: { userId: 'user-1' },
    conversationId: 'target-1',
    conversationType: 'singleChat',
    type: 'text',
    status: 'sent',
    ext: {},
    timestamp: 1735689600000,
    body: { content: 'hello' },
    direct: 'RECEIVE',
    ...partial,
  };
};

const createReceiver = (eventHub: EventHub): MessageReceiver => {
  return new MessageReceiver(
    {
      getContext: () => ({
        userId: 'current-user',
      }),
    } as never,
    {} as never,
    eventHub
  );
};

describe('MessageReceiver combine dispatch', () => {
  it('combine 消息应触发 onMessage', () => {
    const eventHub = new EventHub();
    const onMessage = vi.fn();

    eventHub.addEventHandler('test-combine', {
      onMessage,
    });

    const receiver = createReceiver(eventHub);
    (receiver as unknown as { dispatchMessage: (message: Message) => void }).dispatchMessage(
      createMessage({
        type: 'combine',
        combineLevel: 1,
        body: {
          title: '聊天记录',
          summary: '1 条',
          compatibleText: '[聊天记录]',
          filename: 'combine',
          filetype: 'application/octet-stream',
          combineLevel: 1,
        },
      })
    );

    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'combine',
      })
    );
  });

  it('普通消息应继续触发 onMessage', () => {
    const eventHub = new EventHub();
    const onMessage = vi.fn();

    eventHub.addEventHandler('test-normal', {
      onMessage,
    });

    const receiver = createReceiver(eventHub);
    (receiver as unknown as { dispatchMessage: (message: Message) => void }).dispatchMessage(
      createMessage({
        type: 'text',
      })
    );

    expect(onMessage).toHaveBeenCalledTimes(1);
  });
});
