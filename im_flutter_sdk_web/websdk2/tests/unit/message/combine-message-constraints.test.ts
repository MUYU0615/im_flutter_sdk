import { describe, expect, it } from 'vitest';
import type { Message } from '@/types';
import {
  calculateCombineLevel,
  ensureCombineItemLimit,
  ensureCombineLevel,
  MAX_COMBINE_LEVEL,
  MAX_COMBINE_MESSAGE_COUNT,
  validateCombineMessageList,
} from '@/message/combine-message-constraints';
import { ValidationError } from '@/utils/errors';

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

describe('combine-message-constraints', () => {
  it('应允许合法的 messageList', () => {
    expect(() => validateCombineMessageList([createItem()])).not.toThrow();
  });

  it('应计算嵌套层级并加一', () => {
    const list: Message[] = [
      createItem(),
      createItem({
        type: 'combine',
        combineLevel: 3,
        body: {
          combineLevel: 3,
        } as unknown as Message['body'],
      }),
      createItem({
        type: 'combine',
        combineLevel: 5,
        body: {
          combineLevel: 5,
        } as unknown as Message['body'],
      }),
    ];

    expect(calculateCombineLevel(list)).toBe(6);
  });

  it('应允许 cmd 类型消息', () => {
    const list = [
      createItem({ type: 'cmd' }),
    ];

    expect(() => validateCombineMessageList(list)).not.toThrow();
  });

  it('应拒绝超出层级限制', () => {
    expect(() => ensureCombineLevel(MAX_COMBINE_LEVEL + 1)).toThrow(ValidationError);
  });

  it('应拒绝超出条数限制', () => {
    expect(() => ensureCombineItemLimit(MAX_COMBINE_MESSAGE_COUNT + 1)).toThrow(ValidationError);
  });
});
