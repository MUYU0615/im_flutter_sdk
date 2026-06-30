import { describe, expect, it } from 'vitest';
import type { Message, Sender } from '@/types';
import { createCombineMessage } from '@/message/create-message';
import { ValidationError } from '@/utils/errors';

const sender: Sender = {
  userId: 'sender-1',
};

const createItem = (partial: Partial<Message> = {}): Message => {
  return {
    type: 'text',
    sender,
    conversationId: 'target-1',
    conversationType: 'singleChat',
    timestamp: 1735689600000,
    body: {
      content: 'hello',
    },
    msgServerId: '',
    msgLocalId: '',
    from: '',
    to: '',
    status: 'sent',
    ext: {},
    ...partial,
  } as Message;
};

describe('createCombineMessage', () => {
  it('应创建 combine 消息并填充默认字段', () => {
    const message = createCombineMessage(
      {
        conversationId: 'target-1',
        conversationType: 'singleChat',
        title: '聊天记录',
        summary: '共 1 条消息',
        messageList: [createItem()],
      },
      sender
    );

    expect(message.type).toBe('combine');
    expect(message.combineLevel).toBe(1);
    expect(message.body).toMatchObject({
      title: '聊天记录',
      summary: '共 1 条消息',
      compatibleText: '[聊天记录]',
      filename: 'combine',
      filetype: 'application/octet-stream',
      combineLevel: 1,
    });
  });

  it('应根据子消息层级计算 combineLevel', () => {
    const message = createCombineMessage(
      {
        conversationId: 'target-1',
        conversationType: 'singleChat',
        title: '聊天记录',
        summary: '含转发',
        messageList: [
          createItem({
            type: 'combine',
            combineLevel: 4,
            body: {
              combineLevel: 4,
            } as unknown as Message['body'],
          }),
        ],
      },
      sender
    );

    expect(message.combineLevel).toBe(5);
  });

  it('应在层级超过 10 时拒绝创建', () => {
    expect(() =>
      createCombineMessage(
        {
          conversationId: 'target-1',
          conversationType: 'singleChat',
          title: '聊天记录',
          summary: '超限',
          messageList: [
            createItem({
              type: 'combine',
              combineLevel: 10,
              body: {
                combineLevel: 10,
              } as unknown as Message['body'],
            }),
          ],
        },
        sender
      )
    ).toThrow(ValidationError);
  });

  it('应接受 Message 对象作为 messageList 子项（含 cmd 类型）', () => {
    const message = createCombineMessage(
      {
        conversationId: 'target-1',
        conversationType: 'singleChat',
        title: '聊天记录',
        summary: '含 cmd',
        messageList: [
          createItem(),
          createItem({ type: 'cmd', body: { action: 'typing' } as unknown as Message['body'] }),
        ],
      },
      sender
    );

    expect(message.type).toBe('combine');
    expect(message.combineLevel).toBe(1);
  });

  it('应接受带 status/direct 等完整 Message 字段的子项', () => {
    const message = createCombineMessage(
      {
        conversationId: 'target-1',
        conversationType: 'singleChat',
        title: '聊天记录',
        summary: '完整消息',
        messageList: [
          createItem({ status: 'sent', direct: 'RECEIVE', msgServerId: 'srv-1' }),
        ],
      },
      sender
    );

    expect(message.type).toBe('combine');
  });
});
