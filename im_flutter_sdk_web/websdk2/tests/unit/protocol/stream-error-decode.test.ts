import { describe, expect, it } from 'vitest';
import { MsyncCodec } from '@/protocol/msync/codec';
import { ContentType, MsyncMessageType, NameSpace } from '@/protocol/msync/types';
import { getMsyncRoot } from '@/protocol/msync/root';
import { StreamMessageStatus } from '@/types';

const buildPayload = (errorCode: number): Uint8Array => {
  const root = getMsyncRoot();
  const commSyncDlType = root.lookupType('easemob.pb.CommSyncDL');
  const messageBodyType = root.lookupType('easemob.pb.MessageBody');
  const contentType = root.lookupType('easemob.pb.MessageBody.Content');
  const metaType = root.lookupType('easemob.pb.Meta');

  const content = contentType.create({ type: ContentType.TEXT, text: '' });
  const body = messageBodyType.create({
    type: MsyncMessageType.SINGLECHAT,
    from: { name: 'alice' },
    to: { name: 'bob' },
    contents: [content],
    ext: [],
    stream: {
      streamType: 'llm',
      streamSeq: '2',
      streamStatus: 1,
      streamError: errorCode,
    },
  });
  const meta = metaType.create({
    id: '9001',
    from: { name: 'alice' },
    to: { name: 'bob' },
    ns: NameSpace.CHAT,
    payload: messageBodyType.encode(body).finish(),
  });

  return commSyncDlType.encode(
    commSyncDlType.create({
      metaId: '0',
      metas: [meta],
    })
  ).finish();
};

describe('stream error decode', () => {
  it('streamError 存在时应输出 STREAM_ERROR 与原始错误码', () => {
    const codec = new MsyncCodec({
      appKey: 'test-app',
      userId: 'test-user',
      token: 'test-token',
    });

    const result = codec.decodeSync(buildPayload(512));

    expect(result.messages).toHaveLength(1);
    const message = result.messages[0];
    expect(message).toBeDefined();
    if (!message) {
      throw new Error('Expected decoded message');
    }
    expect(message.stream?.status).toBe(StreamMessageStatus.ERROR);
    expect(message.stream?.errorType).toBe(512);
  });
});
