import { describe, expect, it } from 'vitest';
import { selectRecentVoiceMessages } from '../../../demo/src/components/voice-to-text-helpers';
import type { MessageRecord } from '../../../demo/src/types';

const buildMessage = (overrides: Partial<MessageRecord>): MessageRecord => {
  return {
    msgServerId: overrides.msgServerId ?? 'msg-1',
    msgLocalId: overrides.msgLocalId ?? '',
    from: '',
    to: '',
    sender: overrides.sender ?? { userId: 'alice' },
    conversationId: overrides.conversationId ?? 'bob',
    conversationType: overrides.conversationType ?? 'singleChat',
    type: overrides.type ?? 'text',
    status: overrides.status ?? 'sent',
    ext: overrides.ext ?? {},
    timestamp: overrides.timestamp ?? 1714291200000,
    body: overrides.body ?? { content: 'hello' },
    direct: overrides.direct ?? 'RECEIVE',
  };
};

describe('VoiceToTextPanel helpers', () => {
  it('selectRecentVoiceMessages 应仅返回带完整语音字段的最近消息', () => {
    const results = selectRecentVoiceMessages([
      buildMessage({
        msgServerId: 'voice-2',
        type: 'voice',
        timestamp: 1714291300000,
        body: {
          url: 'https://cdn.example.com/voice-2.amr',
          filename: 'voice-2.amr',
          filetype: 'audio/amr',
          duration: 5,
        },
      }),
      buildMessage({
        msgServerId: 'text-1',
        type: 'text',
      }),
      buildMessage({
        msgServerId: 'voice-invalid',
        type: 'voice',
        body: {
          filename: 'voice-invalid.amr',
          filetype: 'audio/amr',
          duration: 4,
        } as never,
      }),
      buildMessage({
        msgServerId: 'voice-1',
        type: 'voice',
        timestamp: 1714291200000,
        body: {
          url: 'https://cdn.example.com/voice-1.amr',
          filename: 'voice-1.amr',
          filetype: 'audio/amr',
          duration: 3,
        },
      }),
    ]);

    expect(results).toHaveLength(2);
    expect(results.map(item => item.id)).toEqual(['voice-2', 'voice-1']);
    expect(results[0]?.message).toEqual({
      type: 'voice',
      url: 'https://cdn.example.com/voice-2.amr',
      filename: 'voice-2.amr',
      filetype: 'audio/amr',
      duration: 5,
    });
  });
});
