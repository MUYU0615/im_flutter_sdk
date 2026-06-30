import { beforeEach, describe, expect, it } from 'vitest';
import { ChatClient } from '@/chat-client';
import { StreamMessageStatus, type Message } from '@/types';
import { ERROR_CODES } from '@/utils/error-codes';

const resetSingleton = (): void => {
  (ChatClient as unknown as { instance: ChatClient | null }).instance = null;
};

const createStreamMessage = (): Message => ({
  msgServerId: '',
  msgLocalId: 'stream-local-1',
    from: '',
    to: '',
  sender: { userId: 'user-1' },
  conversationId: 'user-2',
  conversationType: 'singleChat',
  type: 'text',
  status: 'sending',
  ext: {},
  timestamp: Date.now(),
  body: { content: 'hello' },
  direct: 'SEND',
  stream: {
    seq: 0,
    status: StreamMessageStatus.FULL,
    errorType: 0,
    deltaText: 'hello',
    fullText: 'hello',
  },
});

describe('ChatClient send stream unsupported', () => {
  beforeEach(() => {
    resetSingleton();
  });

  it('发送流式消息应返回不支持错误', async () => {
    const client = ChatClient.init({ appKey: 'app-key' });

    await expect(client.sendMessage(createStreamMessage())).rejects.toMatchObject({
      code: ERROR_CODES.STREAM_SEND_NOT_SUPPORTED,
    });
  });
});
