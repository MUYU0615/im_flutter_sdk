import { describe, expect, it } from 'vitest';

import { MsyncCodec } from '@/protocol/msync/codec';
import { ContentType } from '@/protocol/msync/types';
import type { ImageMessageBody, Message, VideoMessageBody } from '@/types';

interface CodecInternals {
  buildContent: (message: Message) => Record<string, unknown>;
  decodeContent: (content: Record<string, unknown>) => {
    type: string;
    body: ImageMessageBody | VideoMessageBody;
  } | null;
}

const createCodec = (options?: { useCustomAttachmentUpload?: boolean }): MsyncCodec => {
  return new MsyncCodec({
    appKey: 'test#app',
    userId: 'user-1',
    token: 'token',
    useCustomAttachmentUpload: options?.useCustomAttachmentUpload,
  });
};

describe('image content codec', () => {
  it('应编码图片原图/大图语义', () => {
    const codec = createCodec() as unknown as CodecInternals;
    const content = codec.buildContent({
      msgServerId: '',
      msgLocalId: 'local-1',
    from: '',
    to: '',
      sender: { userId: 'user-1' },
      conversationId: 'user-2',
      conversationType: 'singleChat',
      type: 'image',
      status: 'sending',
      ext: {},
      timestamp: 1735689600000,
      body: {
        localUrl: '',
        originalImageUrl: 'https://example.com/chatfiles/uuid-1',
        filename: 'image.jpg',
        filetype: 'image/jpeg',
        width: 720,
        height: 1280,
        isGif: false,
        isOriginalImage: false,
      },
    });

    expect(content).toMatchObject({
      type: ContentType.IMAGE,
      remotePath: 'https://example.com/chatfiles/uuid-1',
      imageType: 2,
    });
  });

  it('应解码原图语义图片地址视图', () => {
    const codec = createCodec() as unknown as CodecInternals;
    const decoded = codec.decodeContent({
      type: ContentType.IMAGE,
      imageType: 1,
      displayName: 'image.jpg',
      remotePath: 'https://example.com/chatfiles/uuid-1',
      fileLength: 1024,
      size: {
        width: 1080,
        height: 1920,
      },
    });

    expect(decoded?.type).toBe('image');
    expect(decoded?.body).toMatchObject({
      localUrl: '',
      isOriginalImage: true,
      originalImageUrl: 'https://example.com/chatfiles/uuid-1',
      bigImageUrl: 'https://example.com/chatfiles/uuid-1?size=large',
      thumbnailUrl: 'https://example.com/chatfiles/uuid-1?size=small',
    });
  });

  it('应解码大图语义图片地址视图', () => {
    const codec = createCodec() as unknown as CodecInternals;
    const decoded = codec.decodeContent({
      type: ContentType.IMAGE,
      imageType: 2,
      displayName: 'image.jpg',
      remotePath: 'https://example.com/chatfiles/uuid-2',
      fileLength: 1024,
      size: {
        width: 720,
        height: 1280,
      },
    });

    expect(decoded?.type).toBe('image');
    expect(decoded?.body).toMatchObject({
      localUrl: '',
      isOriginalImage: false,
      originalImageUrl: 'https://example.com/chatfiles/uuid-2',
      bigImageUrl: 'https://example.com/chatfiles/uuid-2?size=large',
      thumbnailUrl: 'https://example.com/chatfiles/uuid-2?size=small',
    });
  });

  it('自有上传模式下解码图片消息不应自动派生 big/thumbnail', () => {
    const codec = createCodec({
      useCustomAttachmentUpload: true,
    }) as unknown as CodecInternals;
    const decoded = codec.decodeContent({
      type: ContentType.IMAGE,
      imageType: 2,
      displayName: 'image.jpg',
      remotePath: 'https://cdn.example.com/custom/image.jpg?token=1',
      thumbnailRemotePath: 'https://cdn.example.com/custom/thumb.jpg',
      fileLength: 1024,
      size: {
        width: 720,
        height: 1280,
      },
    });

    expect(decoded?.type).toBe('image');
    expect(decoded?.body).toMatchObject({
      localUrl: '',
      isOriginalImage: false,
      originalImageUrl: 'https://cdn.example.com/custom/image.jpg?token=1',
      thumbnailUrl: 'https://cdn.example.com/custom/thumb.jpg',
    });
    expect(
      decoded?.body && 'bigImageUrl' in decoded.body ? decoded.body.bigImageUrl : undefined
    ).toBeUndefined();
  });

  it('视频缩略图应复用 secret，不再暴露 thumbnailSecret', () => {
    const codec = createCodec() as unknown as CodecInternals;
    const content = codec.buildContent({
      msgServerId: '',
      msgLocalId: 'local-video-1',
    from: '',
    to: '',
      sender: { userId: 'user-1' },
      conversationId: 'user-2',
      conversationType: 'singleChat',
      type: 'video',
      status: 'sending',
      ext: {},
      timestamp: 1735689600000,
      body: {
        url: 'https://example.com/chatfiles/video-1',
        filename: 'video.mp4',
        filetype: 'video/mp4',
        duration: 12,
        width: 720,
        height: 1280,
        secret: 'video-secret',
        thumbnailUrl: 'https://example.com/chatfiles/video-1?vframe=true',
      },
    });

    expect(content).toMatchObject({
      type: ContentType.VIDEO,
      secretKey: 'video-secret',
      thumbnailSecretKey: 'video-secret',
    });

    const decoded = codec.decodeContent({
      type: ContentType.VIDEO,
      displayName: 'video.mp4',
      remotePath: 'https://example.com/chatfiles/video-1',
      duration: 12,
      secretKey: 'video-secret',
      thumbnailSecretKey: 'video-secret',
      thumbnailRemotePath: 'https://example.com/chatfiles/video-1?vframe=true',
    });

    expect(decoded?.type).toBe('video');
    expect(decoded?.body).toMatchObject({
      url: 'https://example.com/chatfiles/video-1',
      secret: 'video-secret',
      thumbnailUrl: 'https://example.com/chatfiles/video-1?vframe=true',
    });
    expect(decoded?.body && 'thumbnailSecret' in decoded.body).toBe(false);
  });
});
