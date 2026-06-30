import { describe, expect, it } from 'vitest';
import type { Message } from '@/types';
import {
  decodeCombineMessageList,
  encodeCombineMessageList,
} from '@/message/combine-payload-codec';
import { MessageReceiveError } from '@/utils/errors';

const createItem = (partial: Partial<Message> = {}): Message => {
  return {
    type: 'text',
    sender: {
      userId: 'user-1',
    },
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

describe('combine-payload-codec', () => {
  it('应保持 messageList 顺序并可逆编解码', () => {
    const input = [
      createItem({ msgLocalId: 'a', body: { content: '1' } }),
      createItem({ msgLocalId: 'b', body: { content: '2' } }),
      createItem({ msgLocalId: 'c', type: 'custom', body: { event: 'x' } }),
    ];

    const encoded = encodeCombineMessageList(input);
    const decoded = decodeCombineMessageList(encoded);

    expect(decoded.map(item => item.msgLocalId)).toEqual(['a', 'b', 'c']);
    expect(decoded).toEqual(input);
  });

  it('应在校验和错误时抛出异常', () => {
    const encoded = encodeCombineMessageList([createItem()]);
    encoded[encoded.length - 1] = (encoded[encoded.length - 1] ?? 0) ^ 0x01;

    expect(() => decodeCombineMessageList(encoded)).toThrow(MessageReceiveError);
  });

  it('应在文件头错误时抛出异常', () => {
    const encoded = encodeCombineMessageList([createItem()]);
    encoded[0] = 0x00;

    expect(() => decodeCombineMessageList(encoded)).toThrow(MessageReceiveError);
  });
});
