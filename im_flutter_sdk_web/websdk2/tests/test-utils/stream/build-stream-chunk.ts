import { StreamMessageStatus, type StreamMessage } from '@/types';

export interface BuildStreamChunkOptions {
  msgId?: string;
  seq?: number;
  status?: StreamMessage['stream']['status'];
  deltaText?: string;
  fullText?: string;
  errorType?: number;
  finishReason?: number;
}

export const buildStreamChunk = (options: BuildStreamChunkOptions = {}): StreamMessage => {
  const msgId = options.msgId ?? 'stream-msg-1';
  const seq = options.seq ?? 0;
  const deltaText = options.deltaText ?? '';
  const fullText = options.fullText ?? deltaText;
  const status = options.status ?? StreamMessageStatus.IN_PROGRESS;
  const errorType = options.errorType ?? 0;

  return {
    msgServerId: msgId,
    msgLocalId: '',
    from: '',
    to: '',
    sender: { userId: 'alice' },
    conversationId: 'alice',
    conversationType: 'singleChat',
    type: 'text',
    status: 'sent',
    ext: {},
    timestamp: Date.now(),
    body: {
      content: fullText,
    },
    direct: 'RECEIVE',
    stream: {
      customType: 'default',
      seq,
      status,
      errorType,
      finishReason: options.finishReason,
      deltaText,
      fullText,
    },
  };
};
