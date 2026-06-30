import { describe, expect, it } from 'vitest';
import { MsyncCodec } from '@/protocol/msync/codec';
import { ContentType, MsyncMessageType, NameSpace } from '@/protocol/msync/types';
import { getMsyncRoot } from '@/protocol/msync/root';
import { StreamMessageStatus } from '@/types';

const buildStreamSyncPayload = (options: {
  text: string;
  seq: string;
  status: number;
  error?: number;
}): Uint8Array => {
  const root = getMsyncRoot();
  const commSyncDlType = root.lookupType('easemob.pb.CommSyncDL');
  const messageBodyType = root.lookupType('easemob.pb.MessageBody');
  const contentType = root.lookupType('easemob.pb.MessageBody.Content');
  const metaType = root.lookupType('easemob.pb.Meta');

  const content = contentType.create({
    type: ContentType.TEXT,
    text: options.text,
  });
  const body = messageBodyType.create({
    type: MsyncMessageType.SINGLECHAT,
    from: { name: 'alice' },
    to: { name: 'bob' },
    contents: [content],
    ext: [],
    stream: {
      streamType: 'llm',
      streamSeq: options.seq,
      streamStatus: options.status,
      streamError: options.error ?? 0,
    },
  });
  const payload = messageBodyType.encode(body).finish();
  const meta = metaType.create({
    id: '8001',
    from: { name: 'alice' },
    to: { name: 'bob' },
    ns: NameSpace.CHAT,
    payload,
  });
  const sync = commSyncDlType.create({
    metaId: '0',
    metas: [meta],
  });

  return commSyncDlType.encode(sync).finish();
};

describe('stream chunk decode', () => {
  it('应解码 stream 基础字段', () => {
    const codec = new MsyncCodec({
      appKey: 'test-app',
      userId: 'test-user',
      token: 'test-token',
    });

    const result = codec.decodeSync(
      buildStreamSyncPayload({
        text: 'A',
        seq: '0',
        status: 0,
      })
    );

    expect(result.messages).toHaveLength(1);
    const message = result.messages[0];
    expect(message).toBeDefined();
    if (!message) {
      throw new Error('Expected decoded message');
    }
    expect(message.type).toBe('text');
    expect(message.stream?.seq).toBe(0);
    expect(message.stream?.status).toBe(StreamMessageStatus.START);
    expect(message.stream?.deltaText).toBe('A');
    expect(message.stream?.fullText).toBe('A');
  });

  it('应在 streamError>0 时映射为 STREAM_ERROR', () => {
    const codec = new MsyncCodec({
      appKey: 'test-app',
      userId: 'test-user',
      token: 'test-token',
    });

    const result = codec.decodeSync(
      buildStreamSyncPayload({
        text: '',
        seq: '1',
        status: 1,
        error: 512,
      })
    );

    expect(result.messages).toHaveLength(1);
    const message = result.messages[0];
    expect(message).toBeDefined();
    if (!message) {
      throw new Error('Expected decoded message');
    }
    expect(message.stream?.status).toBe(StreamMessageStatus.ERROR);
    expect(message.stream?.errorType).toBe(512);
  });

  it('应解码 STREAM_FULL 状态', () => {
    const codec = new MsyncCodec({
      appKey: 'test-app',
      userId: 'test-user',
      token: 'test-token',
    });

    const result = codec.decodeSync(
      buildStreamSyncPayload({
        text: 'HELLO',
        seq: '0',
        status: 3,
      })
    );

    expect(result.messages).toHaveLength(1);
    const message = result.messages[0];
    expect(message).toBeDefined();
    if (!message) {
      throw new Error('Expected decoded message');
    }
    expect(message.stream?.status).toBe(StreamMessageStatus.FULL);
  });
});
