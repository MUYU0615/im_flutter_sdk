import { describe, it, expect } from 'vitest';
import { searchMessagesSchema } from '@/validators/search-messages';

const validOption = { keywordList: ['hello'] };

describe('searchMessagesSchema - conversationType validation', () => {
  it('conversationType 有效值通过校验', () => {
    for (const type of ['singleChat', 'groupChat', 'chatRoom'] as const) {
      const result = searchMessagesSchema.safeParse({
        option: { ...validOption, conversationId: 'conv1', conversationType: type },
      });
      expect(result.success).toBe(true);
    }
  });

  it('conversationType 无效值校验失败', () => {
    const result = searchMessagesSchema.safeParse({
      option: { ...validOption, conversationId: 'conv1', conversationType: 'invalid' },
    });
    expect(result.success).toBe(false);
  });

  it('只传 conversationId 不传 conversationType 校验失败', () => {
    const result = searchMessagesSchema.safeParse({
      option: { ...validOption, conversationId: 'conv1' },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('conversationId and conversationType must be provided together');
    }
  });

  it('只传 conversationType 不传 conversationId 校验失败', () => {
    const result = searchMessagesSchema.safeParse({
      option: { ...validOption, conversationType: 'singleChat' },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('conversationId and conversationType must be provided together');
    }
  });

  it('两者都不传时校验通过', () => {
    const result = searchMessagesSchema.safeParse({
      option: validOption,
    });
    expect(result.success).toBe(true);
  });

  it('两者同时提供时校验通过', () => {
    const result = searchMessagesSchema.safeParse({
      option: { ...validOption, conversationId: 'user1', conversationType: 'singleChat' },
    });
    expect(result.success).toBe(true);
  });
});
