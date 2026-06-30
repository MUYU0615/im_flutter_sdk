import { describe, expect, it } from 'vitest';
import { MsyncCodec } from '@/protocol/msync/codec';
import { ContentType } from '@/protocol/msync/types';

interface CodecInternals {
  decodeContent: (content: Record<string, unknown>) => {
    type: string;
    body: Record<string, unknown>;
  } | null;
}

const createCodec = (): MsyncCodec => {
  return new MsyncCodec({
    appKey: 'test#app',
    userId: 'user-1',
    token: 'token',
  });
};

describe('combine content decode', () => {
  it('应解码 COMBINE 内容', () => {
    const codec = createCodec() as unknown as CodecInternals;

    const decoded = codec.decodeContent({
      type: ContentType.COMBINE,
      title: '聊天记录',
      summary: '共 2 条',
      text: '[聊天记录]',
      displayName: 'combine',
      remotePath: 'https://example.com/combine',
      secretKey: 'secret',
      fileLength: 1024,
      combineLevel: 3,
    });

    expect(decoded?.type).toBe('combine');
    expect(decoded?.body).toMatchObject({
      title: '聊天记录',
      summary: '共 2 条',
      compatibleText: '[聊天记录]',
      filename: 'combine',
      url: 'https://example.com/combine',
      secret: 'secret',
      fileLength: 1024,
      combineLevel: 3,
    });
  });

  it('应兼容 TEXT + subType=0 的 combine 下行', () => {
    const codec = createCodec() as unknown as CodecInternals;

    const decoded = codec.decodeContent({
      type: ContentType.TEXT,
      subType: 0,
      text: '[聊天记录]',
      displayName: 'combine',
      combineLevel: 1,
    });

    expect(decoded?.type).toBe('combine');
    expect(decoded?.body.compatibleText).toBe('[聊天记录]');
  });
});
