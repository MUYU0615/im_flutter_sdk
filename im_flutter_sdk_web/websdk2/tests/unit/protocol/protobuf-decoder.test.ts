import { describe, expect, it, vi } from 'vitest';

import { ProtobufDecoder } from '@/protocol/protobuf/decoder';

const encodePayload = (payload: unknown): Uint8Array => {
  return new TextEncoder().encode(JSON.stringify(payload));
};

describe('ProtobufDecoder', () => {
  it('decode 应解析文本消息与基础字段', () => {
    const decoder = new ProtobufDecoder();
    const payload = {
      id: 'server-1',
      msgLocalId: 'local-1',
      from: 'alice',
      to: 'bob',
      conversationId: 'c1',
      conversationType: 'singleChat',
      sender: {
        userId: 'alice',
        nickname: 'Alice',
      },
      type: 'text',
      status: 'delivered',
      ext: { lang: 'zh-CN' },
      timestamp: 1700000000000,
      body: {
        content: 'hello',
      },
    };

    const message = decoder.decode(encodePayload(payload).buffer);

    expect(message.msgServerId).toBe('server-1');
    expect(message.msgLocalId).toBe('local-1');
    expect(message.sender.userId).toBe('alice');
    expect(message.conversationId).toBe('c1');
    expect(message.conversationType).toBe('singleChat');
    expect(message.type).toBe('text');
    expect(message.status).toBe('delivered');
    expect(message.body).toEqual({ content: 'hello' });
  });

  it('decode 应推断 group/room 会话类型', () => {
    const decoder = new ProtobufDecoder();

    const groupMessage = decoder.decode(
      encodePayload({
        from: 'alice',
        groupId: 'g1',
        content: 'group-message',
      })
    );
    expect(groupMessage.conversationType).toBe('groupChat');
    expect(groupMessage.conversationId).toBe('g1');

    const roomMessage = decoder.decode(
      encodePayload({
        from: 'alice',
        roomId: 'r1',
        to: 'r1',
        content: 'room-message',
      })
    );
    expect(roomMessage.conversationType).toBe('chatRoom');
    expect(roomMessage.conversationId).toBe('r1');
  });

  it('decode 应识别 image body 并保留 thumbnailUrl', () => {
    const decoder = new ProtobufDecoder();

    const message = decoder.decode(
      encodePayload({
        from: 'alice',
        to: 'bob',
        type: 'image',
        status: 'read',
        body: {
          url: 'https://cdn.example.com/image.jpg',
          filename: 'image.jpg',
          filetype: 'image/jpeg',
          width: 100,
          height: 200,
          isGif: false,
          imageType: 2,
          thumbnailUrl: 'https://cdn.example.com/image-thumb.jpg',
        },
      })
    );

    expect(message.type).toBe('image');
    expect(message.status).toBe('read');
    expect(message.body).toEqual(
      expect.objectContaining({
        localUrl: '',
        filename: 'image.jpg',
        filetype: 'image/jpeg',
        width: 100,
        height: 200,
        isGif: false,
        isOriginalImage: false,
        originalImageUrl: 'https://cdn.example.com/image.jpg',
        bigImageUrl: 'https://cdn.example.com/image.jpg?size=large',
        thumbnailUrl: 'https://cdn.example.com/image-thumb.jpg',
      })
    );
  });

  it('自有上传模式下 decode 图片消息不应自动派生 bigImageUrl', () => {
    const decoder = new ProtobufDecoder({
      useCustomAttachmentUpload: true,
    });

    const message = decoder.decode(
      encodePayload({
        from: 'alice',
        to: 'bob',
        type: 'image',
        status: 'read',
        body: {
          url: 'https://cdn.example.com/custom/image.jpg?token=1',
          filename: 'image.jpg',
          filetype: 'image/jpeg',
          width: 100,
          height: 200,
          isGif: false,
          imageType: 'large',
          thumbnailUrl: 'https://cdn.example.com/custom/image-thumb.jpg',
        },
      })
    );

    expect(message.body).toEqual(
      expect.objectContaining({
        localUrl: '',
        isOriginalImage: false,
        originalImageUrl: 'https://cdn.example.com/custom/image.jpg?token=1',
        thumbnailUrl: 'https://cdn.example.com/custom/image-thumb.jpg',
      })
    );
    expect('bigImageUrl' in message.body ? message.body.bigImageUrl : undefined).toBeUndefined();
  });

  it('decode 图片消息在缺省 imageType 且 GIF 场景下应回退为原图语义', () => {
    const decoder = new ProtobufDecoder();

    const message = decoder.decode(
      encodePayload({
        from: 'alice',
        to: 'bob',
        type: 'image',
        body: {
          url: 'https://cdn.example.com/animated.gif',
          filename: 'animated.gif',
          filetype: 'image/gif',
          width: 80,
          height: 60,
          isGif: true,
        },
      })
    );

    expect(message.body).toEqual(
      expect.objectContaining({
        isOriginalImage: true,
        originalImageUrl: 'https://cdn.example.com/animated.gif',
        bigImageUrl: 'https://cdn.example.com/animated.gif?size=large',
        thumbnailUrl: 'https://cdn.example.com/animated.gif?size=small',
      })
    );
  });

  it('decode 在未知 type/status 或非对象 ext 时应回退默认值', () => {
    const decoder = new ProtobufDecoder();
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(9999);

    const message = decoder.decode(
      encodePayload({
        from: 'alice',
        to: 'bob',
        type: 'unsupported',
        status: 'unknown-status',
        ext: 'invalid-ext',
        content: 'fallback-text',
      })
    );

    expect(message.type).toBe('text');
    expect(message.status).toBe('sent');
    expect(message.ext).toEqual({});
    expect(message.timestamp).toBe(9999);
    expect(message.body).toEqual({ content: 'fallback-text' });

    nowSpy.mockRestore();
  });

  it('decode 在 JSON 非法时应抛出异常', () => {
    const decoder = new ProtobufDecoder();
    const invalidPayload = new TextEncoder().encode('{"broken":');

    expect(() => decoder.decode(invalidPayload)).toThrowError(SyntaxError);
  });
});
