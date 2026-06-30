import { describe, expect, it } from 'vitest';

import { ProtobufEncoder } from '@/protocol/protobuf/encoder';
import type { Message } from '@/types';

const createMessage = (): Message => {
  return {
    msgServerId: 'server-1',
    msgLocalId: 'local-1',
    from: '',
    to: '',
    sender: {
      userId: 'alice',
      nickname: 'Alice',
      avatarUrl: 'https://cdn.example.com/alice.png',
    },
    conversationId: 'room-1',
    conversationType: 'singleChat',
    type: 'text',
    status: 'sent',
    ext: {
      lang: 'zh-CN',
    },
    timestamp: 1700000000000,
    body: {
      content: 'hello',
    },
  };
};

describe('ProtobufEncoder', () => {
  it('encode 应返回可反序列化的 ArrayBuffer', () => {
    const encoder = new ProtobufEncoder();
    const buffer = encoder.encode(createMessage());
    const decoded = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer))) as {
      readonly msgServerId: string;
      readonly msgLocalId: string;
      readonly conversationId: string;
      readonly conversationType: string;
      readonly sender: { readonly userId: string };
      readonly body: { readonly content: string };
    };

    expect(decoded.msgServerId).toBe('server-1');
    expect(decoded.msgLocalId).toBe('local-1');
    expect(decoded.conversationId).toBe('room-1');
    expect(decoded.conversationType).toBe('singleChat');
    expect(decoded.sender.userId).toBe('alice');
    expect(decoded.body.content).toBe('hello');
  });

  it('encodeToUint8Array 应返回 Uint8Array', () => {
    const encoder = new ProtobufEncoder();
    const bytes = encoder.encodeToUint8Array(createMessage());
    const decoded = JSON.parse(new TextDecoder().decode(bytes)) as {
      readonly type: string;
      readonly status: string;
    };

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(decoded.type).toBe('text');
    expect(decoded.status).toBe('sent');
  });

  it('encode 在不可序列化输入时应抛错', () => {
    const encoder = new ProtobufEncoder();
    const message = createMessage();
    message.ext = {
      unsupported: BigInt(1),
    };

    expect(() => encoder.encode(message)).toThrowError();
  });
});
