import { describe, expect, it } from 'vitest';
import { MsyncCodec } from '@/protocol/msync/codec';
import { ContentType } from '@/protocol/msync/types';
import type { Message } from '@/types';

interface CodecInternals {
  buildContent: (message: Message) => Record<string, unknown>;
}

const createCodec = (): MsyncCodec => {
  return new MsyncCodec({
    appKey: 'test#app',
    userId: 'user-1',
    token: 'token',
  });
};

describe('combine content encode', () => {
  it('应映射 combine 内容字段', () => {
    const codec = createCodec() as unknown as CodecInternals;
    const content = codec.buildContent({
      msgServerId: '',
      msgLocalId: 'local-1',
    from: '',
    to: '',
      sender: { userId: 'user-1' },
      conversationId: 'group-1',
      conversationType: 'groupChat',
      type: 'combine',
      status: 'sending',
      ext: {},
      timestamp: 1735689600000,
      combineLevel: 2,
      body: {
        title: '聊天记录',
        summary: '共 2 条',
        compatibleText: '[聊天记录]',
        filename: 'combine',
        filetype: 'application/octet-stream',
        url: 'https://example.com/combine',
        secret: 'secret',
        fileLength: 1024,
        combineLevel: 2,
      },
    });

    expect(content).toMatchObject({
      type: ContentType.COMBINE,
      title: '聊天记录',
      summary: '共 2 条',
      text: '[聊天记录]',
      remotePath: 'https://example.com/combine',
      secretKey: 'secret',
      fileLength: 1024,
      combineLevel: 2,
    });
  });
});
