import { describe, expect, it } from 'vitest';
import { CONVERSATION_MARK } from '@/types/conversation';
import type {
  ConversationFilter,
  ConversationMark,
  ConversationMarkMutationResult,
  ConversationMarkParams,
} from '@/types/conversation';

describe('conversation types', () => {
  it('ConversationMark 仅允许 0-19 标记槽位', () => {
    const firstMark: ConversationMark = CONVERSATION_MARK.MARK_0;
    const lastMark: ConversationMark = CONVERSATION_MARK.MARK_19;

    // @ts-expect-error 20 不属于公开 ConversationMark 槽位
    const invalidMark: ConversationMark = 20;

    expect(firstMark).toBe(0);
    expect(lastMark).toBe(19);
    expect(invalidMark).toBe(20);
  });

  it('会话 mark API 参数使用 ConversationMark', () => {
    const mutationParams: ConversationMarkParams = {
      conversations: [
        { conversationId: 'group-1', conversationType: 'groupChat' },
        { conversationId: 'user-1', conversationType: 'singleChat' },
      ],
      mark: CONVERSATION_MARK.MARK_3,
    };
    const legacySingleParams: ConversationMarkParams = {
      conversationId: 'group-1',
      conversationType: 'groupChat',
      mark: CONVERSATION_MARK.MARK_4,
    };
    const queryParams: ConversationFilter = {
      mark: CONVERSATION_MARK.MARK_8,
    };
    const mutationResult: ConversationMarkMutationResult = {
      succeeded: [{ conversationId: 'group-1', conversationType: 'groupChat' }],
      failed: [],
      mark: CONVERSATION_MARK.MARK_3,
      operation: 'addMark',
    };

    expect(mutationParams.mark).toBe(3);
    expect('conversations' in mutationParams ? mutationParams.conversations : []).toHaveLength(2);
    expect(legacySingleParams.mark).toBe(4);
    expect(queryParams.mark).toBe(8);
    expect(mutationResult.succeeded[0]?.conversationId).toBe('group-1');
    expect(mutationResult.failed).toHaveLength(0);
  });
});
