import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AttachmentUploader } from '@/upload/attachment-uploader';
import { MULTIPART_THRESHOLD } from '@/upload/constants';
import { UploadError } from '@/utils/errors';
import type { Message } from '@/types';
import { isImageMessageBody, isVideoMessageBody } from '@/types';
import { simpleUpload } from '@/upload/simple-upload';
import { multipartUpload } from '@/upload/multipart-upload';
import { attachmentFileStore } from '@/upload/attachment-file-store';
import { createPlatformError, PLATFORM_ERROR_CODE, PLATFORM_ERROR_STAGE } from '@/platform/types';
import { ERROR_CODES } from '@/utils/error-codes';
import { logger } from '@/utils/logger';

vi.mock('@/upload/simple-upload', () => ({
  simpleUpload: vi.fn(),
}));

vi.mock('@/upload/multipart-upload', () => ({
  multipartUpload: vi.fn(),
}));

type PrivateUploadFileInfo = {
  source: {
    sourceType: 'web-file';
    file: File;
  };
  fileName: string;
  fileType: string;
  fileSize: number;
  webFile: File;
};

const baseConfig = {
  restBaseUrl: 'https://rest.example.com',
  token: 'token',
  appKey: 'org#app',
};

const createMessage = (overrides: Partial<Message>): Message => {
  return {
    msgServerId: '',
    msgLocalId: 'local-default',
    from: '',
    to: '',
    sender: { userId: 'u1' },
    conversationId: 'u2',
    conversationType: 'singleChat',
    type: 'file',
    status: 'sending',
    ext: {},
    timestamp: Date.now(),
    body: {
      filename: 'file.txt',
      filetype: 'text/plain',
      url: 'blob:file',
    },
    ...overrides,
  } as Message;
};

describe('AttachmentUploader', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    attachmentFileStore.clear();
  });

  it('skips upload when url is remote and data is missing', async () => {
    const uploader = new AttachmentUploader(baseConfig);
    const message: Message = {
      msgServerId: '',
      msgLocalId: 'local-1',
    from: '',
    to: '',
      sender: { userId: 'u1' },
      conversationId: 'u2',
      conversationType: 'singleChat',
      type: 'file',
      status: 'sending',
      ext: {},
      timestamp: Date.now(),
      body: {
        url: 'https://example.com/file.txt',
        filename: 'file.txt',
        filetype: 'text/plain',
      },
    };

    const result = await uploader.prepareMessage(message);

    expect(result).toBe(message);
    expect(simpleUpload).not.toHaveBeenCalled();
    expect(multipartUpload).not.toHaveBeenCalled();
  });

  it('自有上传模式下图片远端 originalImageUrl 不应触发上传或预检', async () => {
    const uploader = new AttachmentUploader({
      ...baseConfig,
      useCustomAttachmentUpload: true,
    });
    const message: Message = {
      msgServerId: '',
      msgLocalId: 'custom-image-remote-1',
    from: '',
    to: '',
      sender: { userId: 'u1' },
      conversationId: 'u2',
      conversationType: 'singleChat',
      type: 'image',
      status: 'sending',
      ext: {},
      timestamp: Date.now(),
      body: {
        localUrl: '',
        originalImageUrl: 'https://cdn.example.com/custom/image.jpg?token=1',
        thumbnailUrl: 'https://cdn.example.com/custom/thumb.jpg',
        filename: 'image.png',
        filetype: 'image/png',
        width: 120,
        height: 80,
        isGif: false,
      },
    };

    const result = await uploader.prepareMessage(message);

    expect(result).toBe(message);
    expect(simpleUpload).not.toHaveBeenCalled();
    expect(multipartUpload).not.toHaveBeenCalled();
  });

  it('图片已带远端 originalImageUrl 时即使仍保留本地文件也不应重复上传', async () => {
    const uploader = new AttachmentUploader(baseConfig);
    const file = new File([new Uint8Array(10)], 'image.png', { type: 'image/png' });
    const message: Message = {
      msgServerId: '',
      msgLocalId: 'image-remote-with-cache-1',
    from: '',
    to: '',
      sender: { userId: 'u1' },
      conversationId: 'u2',
      conversationType: 'singleChat',
      type: 'image',
      status: 'sending',
      ext: {},
      timestamp: Date.now(),
      body: {
        localUrl: 'blob:local-image',
        originalImageUrl: 'https://example.com/chatfiles/uuid-image-1',
        bigImageUrl: 'https://example.com/chatfiles/uuid-image-1?size=large',
        thumbnailUrl: 'https://example.com/chatfiles/uuid-image-1?size=small',
        filename: 'image.png',
        filetype: 'image/png',
        width: 120,
        height: 80,
        isGif: false,
        isOriginalImage: false,
      },
    };

    attachmentFileStore.set(message.msgLocalId, file);

    const result = await uploader.prepareMessage(message);

    expect(result).toBe(message);
    expect(simpleUpload).not.toHaveBeenCalled();
    expect(multipartUpload).not.toHaveBeenCalled();
  });

  it('uses simple upload for small files', async () => {
    const uploader = new AttachmentUploader(baseConfig);
    const file = new File([new Uint8Array(10)], 'image.png', { type: 'image/png' });
    const message: Message = {
      msgServerId: '',
      msgLocalId: 'local-2',
    from: '',
    to: '',
      sender: { userId: 'u1' },
      conversationId: 'u2',
      conversationType: 'singleChat',
      type: 'image',
      status: 'sending',
      ext: {},
      timestamp: Date.now(),
      body: {
        localUrl: 'blob:local-image',
        filename: 'image.png',
        filetype: 'image/png',
        width: 120,
        height: 80,
        isGif: false,
      },
    };

    attachmentFileStore.set(message.msgLocalId, file);

    vi.mocked(simpleUpload).mockResolvedValue({
      url: 'https://example.com/image.png',
      secret: 'secret',
      fileLength: file.size,
      filetype: 'image/png',
      filename: 'image.png',
      thumbnailUrl: 'https://example.com/thumb.png',
    });

    const result = await uploader.prepareMessage(message);

    expect(simpleUpload).toHaveBeenCalledOnce();
    expect(multipartUpload).not.toHaveBeenCalled();
    if (!isImageMessageBody(result.body)) {
      throw new Error('Expected image message body');
    }
    expect(result.body.localUrl).toBe('blob:local-image');
    expect(result.body.originalImageUrl).toBeUndefined();
    expect((result.body as { secret?: string }).secret).toBe('secret');
  });

  it('默认图片发送应生成大图并回写 isOriginalImage=false', async () => {
    const file = new File([new Uint8Array(10)], 'image.png', { type: 'image/png' });
    const bigFile = new File([new Uint8Array(6)], 'image-big.jpg', { type: 'image/jpeg' });
    const generateBigImage = vi.fn().mockResolvedValue({
      source: {
        sourceType: 'web-file',
        file: bigFile,
        name: 'image-big.jpg',
        mimeType: 'image/jpeg',
        size: bigFile.size,
      },
      width: 720,
      height: 1280,
      fileName: 'image-big.jpg',
      fileType: 'image/jpeg',
      fileSize: bigFile.size,
      webFile: bigFile,
    });
    const uploader = new AttachmentUploader({
      ...baseConfig,
      imageProcessor: {
        getImageInfo: vi.fn(),
        generateBigImage,
        computeMd5: vi.fn(),
      },
    });
    const message: Message = {
      msgServerId: '',
      msgLocalId: 'local-big-1',
    from: '',
    to: '',
      sender: { userId: 'u1' },
      conversationId: 'u2',
      conversationType: 'singleChat',
      type: 'image',
      status: 'sending',
      ext: {},
      timestamp: Date.now(),
      body: {
        localUrl: 'blob:local-image',
        filename: 'image.png',
        filetype: 'image/png',
        width: 1200,
        height: 2000,
        isGif: false,
      },
    };

    attachmentFileStore.set(message.msgLocalId, file);
    vi.mocked(simpleUpload).mockResolvedValue({
      isOriginalImage: false,
      originalImageUrl: 'https://example.com/chatfiles/uuid-big',
      bigImageUrl: 'https://example.com/chatfiles/uuid-big?size=large',
      thumbnailUrl: 'https://example.com/chatfiles/uuid-big?size=small',
      secret: 'secret-big',
      fileLength: bigFile.size,
      filetype: 'image/jpeg',
      filename: 'image-big.jpg',
    });

    const result = await uploader.prepareMessage(message);

    expect(generateBigImage).toHaveBeenCalledTimes(1);
    expect(simpleUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        imageType: 'large',
        fileName: 'image-big.jpg',
        fileType: 'image/jpeg',
        fileSize: bigFile.size,
      })
    );
    if (!isImageMessageBody(result.body)) {
      throw new Error('Expected image message body');
    }
    expect(result.body.isOriginalImage).toBe(false);
    expect(result.body.localUrl).toBe('blob:local-image');
    expect(result.body.originalImageUrl).toBe('https://example.com/chatfiles/uuid-big');
    expect(result.body.bigImageUrl).toBe('https://example.com/chatfiles/uuid-big?size=large');
    expect(result.body.width).toBe(720);
    expect(result.body.height).toBe(1280);
  });

  it('isOriginalImage=true 时不应生成大图', async () => {
    const file = new File([new Uint8Array(10)], 'image.png', { type: 'image/png' });
    const generateBigImage = vi.fn();
    const uploader = new AttachmentUploader({
      ...baseConfig,
      imageProcessor: {
        getImageInfo: vi.fn(),
        generateBigImage,
        computeMd5: vi.fn(),
      },
    });
    const message: Message = {
      msgServerId: '',
      msgLocalId: 'local-origin-1',
    from: '',
    to: '',
      sender: { userId: 'u1' },
      conversationId: 'u2',
      conversationType: 'singleChat',
      type: 'image',
      status: 'sending',
      ext: {},
      timestamp: Date.now(),
      body: {
        localUrl: 'blob:local-image',
        filename: 'image.png',
        filetype: 'image/png',
        width: 1200,
        height: 2000,
        isGif: false,
        isOriginalImage: true,
      },
    };

    attachmentFileStore.set(message.msgLocalId, file);
    vi.mocked(simpleUpload).mockResolvedValue({
      isOriginalImage: true,
      originalImageUrl: 'https://example.com/chatfiles/uuid-origin',
      bigImageUrl: 'https://example.com/chatfiles/uuid-origin?size=large',
      thumbnailUrl: 'https://example.com/chatfiles/uuid-origin?size=small',
      secret: 'secret-origin',
      fileLength: file.size,
      filetype: 'image/png',
      filename: 'image.png',
    });

    const result = await uploader.prepareMessage(message);

    expect(generateBigImage).not.toHaveBeenCalled();
    expect(simpleUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        imageType: 'original',
      })
    );
    if (!isImageMessageBody(result.body)) {
      throw new Error('Expected image message body');
    }
    expect(result.body.isOriginalImage).toBe(true);
    expect(result.body.localUrl).toBe('blob:local-image');
    expect(result.body.originalImageUrl).toBe('https://example.com/chatfiles/uuid-origin');
    expect(result.body.bigImageUrl).toBe('https://example.com/chatfiles/uuid-origin?size=large');
  });

  it('大图生成失败时应回退发送原图并记录日志', async () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
    const file = new File([new Uint8Array(10)], 'image.png', { type: 'image/png' });
    const uploader = new AttachmentUploader({
      ...baseConfig,
      imageProcessor: {
        getImageInfo: vi.fn(),
        generateBigImage: vi.fn().mockRejectedValue(new Error('compress failed')),
        computeMd5: vi.fn(),
      },
    });
    const message: Message = {
      msgServerId: '',
      msgLocalId: 'local-fallback-1',
    from: '',
    to: '',
      sender: { userId: 'u1' },
      conversationId: 'u2',
      conversationType: 'singleChat',
      type: 'image',
      status: 'sending',
      ext: {},
      timestamp: Date.now(),
      body: {
        localUrl: 'blob:local-image',
        filename: 'image.png',
        filetype: 'image/png',
        width: 1200,
        height: 2000,
        isGif: false,
      },
    };

    attachmentFileStore.set(message.msgLocalId, file);
    vi.mocked(simpleUpload).mockResolvedValue({
      isOriginalImage: true,
      originalImageUrl: 'https://example.com/chatfiles/uuid-fallback',
      bigImageUrl: 'https://example.com/chatfiles/uuid-fallback?size=large',
      thumbnailUrl: 'https://example.com/chatfiles/uuid-fallback?size=small',
      secret: 'secret-fallback',
      fileLength: file.size,
      filetype: 'image/png',
      filename: 'image.png',
    });

    const result = await uploader.prepareMessage(message);

    expect(simpleUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        imageType: 'original',
        fileName: 'image.png',
      })
    );
    expect(warnSpy).toHaveBeenCalledWith(
      'Image big generation failed, fallback to original',
      expect.objectContaining({
        operation: 'upload.image.big-fallback',
      })
    );
    if (!isImageMessageBody(result.body)) {
      throw new Error('Expected image message body');
    }
    expect(result.body.isOriginalImage).toBe(true);
    expect(result.body.localUrl).toBe('blob:local-image');
    warnSpy.mockRestore();
  });

  it('预检命中时应跳过实际上传并直接复用远端资源', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        entities: [
          {
            exists: true,
            uuid: 'uuid-precheck',
            'share-secret': 'secret-precheck',
          },
        ],
      }),
    } as Response);
    const uploader = new AttachmentUploader(baseConfig);
    const file = new File([new Uint8Array(1024 * 1024 + 16)], 'report.txt', { type: 'text/plain' });
    const message = createMessage({
      msgLocalId: 'precheck-hit-1',
    from: '',
    to: '',
      body: {
        url: 'blob:report',
        filename: 'report.txt',
        filetype: 'text/plain',
        fileLength: file.size,
      },
    });

    attachmentFileStore.set(message.msgLocalId, file);

    const result = await uploader.prepareMessage(message);

    expect(simpleUpload).not.toHaveBeenCalled();
    expect(multipartUpload).not.toHaveBeenCalled();
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('https://rest.example.com/org/app/chatfiles/exists?md5='),
      expect.objectContaining({
        method: 'GET',
      })
    );
    expect((result.body as { url?: string }).url).toBe(
      'https://rest.example.com/org/app/chatfiles/uuid-precheck'
    );
    expect('secret' in result.body ? result.body.secret : undefined).toBe('secret-precheck');
    fetchSpy.mockRestore();
  });

  it('发送大图时预检应使用原图 MD5，但实际仍上传大图', async () => {
    const originFile = new File([new Uint8Array(1024 * 1024 + 64)], 'image.png', {
      type: 'image/png',
    });
    const bigFile = new File([new Uint8Array(1024 * 1024 + 32)], 'image-big.jpg', {
      type: 'image/jpeg',
    });
    const generateBigImage = vi.fn().mockResolvedValue({
      source: {
        sourceType: 'web-file',
        file: bigFile,
        name: 'image-big.jpg',
        mimeType: 'image/jpeg',
        size: bigFile.size,
      },
      width: 720,
      height: 1280,
      fileName: 'image-big.jpg',
      fileType: 'image/jpeg',
      fileSize: bigFile.size,
      webFile: bigFile,
    });
    const computeMd5 = vi.fn().mockResolvedValue('md5-origin-image');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        entities: [
          {
            exists: false,
            type: 'chatfile',
          },
        ],
      }),
    } as Response);
    const uploader = new AttachmentUploader({
      ...baseConfig,
      imageProcessor: {
        getImageInfo: vi.fn(),
        generateBigImage,
        computeMd5,
      },
    });
    const message: Message = {
      msgServerId: '',
      msgLocalId: 'local-big-precheck-1',
    from: '',
    to: '',
      sender: { userId: 'u1' },
      conversationId: 'u2',
      conversationType: 'singleChat',
      type: 'image',
      status: 'sending',
      ext: {},
      timestamp: Date.now(),
      body: {
        localUrl: 'blob:local-image',
        filename: 'image.png',
        filetype: 'image/png',
        width: 1200,
        height: 2000,
        isGif: false,
      },
    };

    attachmentFileStore.set(message.msgLocalId, originFile);
    vi.mocked(simpleUpload).mockResolvedValue({
      isOriginalImage: false,
      originalImageUrl: 'https://example.com/chatfiles/uuid-big',
      bigImageUrl: 'https://example.com/chatfiles/uuid-big?size=large',
      thumbnailUrl: 'https://example.com/chatfiles/uuid-big?size=small',
      secret: 'secret-big',
      fileLength: bigFile.size,
      filetype: 'image/jpeg',
      filename: 'image-big.jpg',
    });

    await uploader.prepareMessage(message);

    expect(generateBigImage).toHaveBeenCalledTimes(1);
    expect(computeMd5).toHaveBeenCalledTimes(2);
    expect(computeMd5).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        sourceType: 'web-file',
        file: originFile,
        size: originFile.size,
      })
    );
    expect(computeMd5).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        sourceType: 'web-file',
        file: originFile,
        size: originFile.size,
      })
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'https://rest.example.com/org/app/chatfiles/exists?md5=md5-origin-image'
      ),
      expect.objectContaining({
        method: 'GET',
      })
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('imageType=large'),
      expect.objectContaining({
        method: 'GET',
      })
    );
    expect(simpleUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        md5: 'md5-origin-image',
        imageType: 'large',
        width: 720,
        height: 1280,
        fileName: 'image-big.jpg',
        fileType: 'image/jpeg',
        fileSize: bigFile.size,
      })
    );
    fetchSpy.mockRestore();
  });

  it('发送大图命中原图资源时应按原图语义回写图片元数据', async () => {
    const originFile = new File([new Uint8Array(1024 * 1024 + 64)], 'image.png', {
      type: 'image/png',
    });
    const bigFile = new File([new Uint8Array(1024 * 1024 + 32)], 'image-big.jpg', {
      type: 'image/jpeg',
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        entities: [
          {
            exists: true,
            uuid: 'uuid-origin-hit',
            'share-secret': 'secret-origin-hit',
            'exists-type': 'origin',
          },
        ],
      }),
    } as Response);
    const uploader = new AttachmentUploader({
      ...baseConfig,
      imageProcessor: {
        getImageInfo: vi.fn(),
        generateBigImage: vi.fn().mockResolvedValue({
          source: {
            sourceType: 'web-file',
            file: bigFile,
            name: 'image-big.jpg',
            mimeType: 'image/jpeg',
            size: bigFile.size,
          },
          width: 720,
          height: 1280,
          fileName: 'image-big.jpg',
          fileType: 'image/jpeg',
          fileSize: bigFile.size,
          webFile: bigFile,
        }),
        computeMd5: vi.fn().mockResolvedValue('md5-origin-image'),
      },
    });
    const message: Message = {
      msgServerId: '',
      msgLocalId: 'local-big-hit-origin-1',
    from: '',
    to: '',
      sender: { userId: 'u1' },
      conversationId: 'u2',
      conversationType: 'singleChat',
      type: 'image',
      status: 'sending',
      ext: {},
      timestamp: Date.now(),
      body: {
        localUrl: 'blob:local-image',
        filename: 'image.png',
        filetype: 'image/png',
        width: 1200,
        height: 2000,
        isGif: false,
      },
    };

    attachmentFileStore.set(message.msgLocalId, originFile);

    const result = await uploader.prepareMessage(message);

    if (!isImageMessageBody(result.body)) {
      throw new Error('Expected image message body');
    }
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('imageType=large'),
      expect.objectContaining({
        method: 'GET',
      })
    );
    expect(simpleUpload).not.toHaveBeenCalled();
    expect(multipartUpload).not.toHaveBeenCalled();
    expect(result.body.isOriginalImage).toBe(true);
    expect(result.body.width).toBe(1200);
    expect(result.body.height).toBe(2000);
    expect(result.body.fileLength).toBe(originFile.size);
    expect(result.body.filetype).toBe('image/png');
    expect(result.body.filename).toBe('image.png');
    expect(result.body.originalImageUrl).toBe(
      'https://rest.example.com/org/app/chatfiles/uuid-origin-hit'
    );
    fetchSpy.mockRestore();
  });

  it('falls back to simple upload when multipart init fails', async () => {
    const uploader = new AttachmentUploader(baseConfig);
    const largeBuffer = new Uint8Array(MULTIPART_THRESHOLD + 1);
    const file = new File([largeBuffer], 'video.mp4', { type: 'video/mp4' });
    const message: Message = {
      msgServerId: '',
      msgLocalId: 'local-3',
    from: '',
    to: '',
      sender: { userId: 'u1' },
      conversationId: 'room-1',
      conversationType: 'chatRoom',
      type: 'video',
      status: 'sending',
      ext: {},
      timestamp: Date.now(),
      body: {
        url: 'blob:local-video',
        filename: 'video.mp4',
        filetype: 'video/mp4',
        duration: 12,
      },
    };

    attachmentFileStore.set(message.msgLocalId, file);

    vi.mocked(multipartUpload).mockRejectedValue(
      new UploadError('Multipart init failed', {
        details: { stage: 'init' },
      })
    );
    vi.mocked(simpleUpload).mockResolvedValue({
      url: 'https://example.com/video.mp4',
      secret: 'secret',
      fileLength: file.size,
      filetype: 'video/mp4',
      filename: 'video.mp4',
    });

    const result = await uploader.prepareMessage(message);

    expect(multipartUpload).toHaveBeenCalledOnce();
    expect(simpleUpload).toHaveBeenCalledOnce();
    if (!isVideoMessageBody(result.body)) {
      throw new Error('Expected video message body');
    }
    expect(result.body.url).toBe('https://example.com/video.mp4');
  });

  it('非附件消息应直接透传', async () => {
    const uploader = new AttachmentUploader(baseConfig);
    const message = createMessage({
      type: 'text',
      body: {
        content: 'hello',
      },
    });

    const result = await uploader.prepareMessage(message);
    expect(result).toBe(message);
  });

  it('缺少附件文件时应抛出 UPLOAD_REQUIRED_FIELD_MISSING', async () => {
    const uploader = new AttachmentUploader(baseConfig);
    const message = createMessage({
      msgLocalId: 'no-file',
    from: '',
    to: '',
      body: {
        url: 'blob:no-file',
        filename: 'a.txt',
        filetype: 'text/plain',
      },
    });

    await expect(uploader.prepareMessage(message)).rejects.toMatchObject({
      code: ERROR_CODES.UPLOAD_REQUIRED_FIELD_MISSING,
    });
  });

  it('缺少 restBaseUrl 时应抛错', async () => {
    const uploader = new AttachmentUploader({
      ...baseConfig,
      restBaseUrl: '',
    });
    const message = createMessage({
      msgLocalId: 'missing-rest',
    from: '',
    to: '',
      body: {
        url: 'blob:missing-rest',
        filename: 'a.txt',
        filetype: 'text/plain',
      },
    });
    attachmentFileStore.set(message.msgLocalId, new File(['abc'], 'a.txt', { type: 'text/plain' }));

    await expect(uploader.prepareMessage(message)).rejects.toMatchObject({
      code: ERROR_CODES.UPLOAD_REQUIRED_FIELD_MISSING,
    });
  });

  it('updateConfig 后应使用 uploadAdapter 上传并触发进度/完成回调', async () => {
    const uploader = new AttachmentUploader();
    const upload = vi.fn(
      async (config: { onProgress?: (progress: { loaded: number }) => void }) => {
        config.onProgress?.({ loaded: 10 });
        return {
          status: 200,
          body: JSON.stringify({
            entities: [
              {
                uuid: 'uuid-1',
                'share-secret': 'sec-1',
                'file-metadata': {
                  'content-type': 'video/mp4',
                  'content-length': 10,
                },
              },
            ],
          }),
        };
      }
    );
    uploader.updateConfig({
      ...baseConfig,
      uploadAdapter: {
        upload: upload as unknown as (config: unknown) => Promise<{ status: number; body: string }>,
      } as unknown as typeof baseConfig & { upload: typeof upload },
    } as unknown as typeof baseConfig);
    const onProgress = vi.fn();
    const onComplete = vi.fn();
    const message = createMessage({
      msgLocalId: 'video-adapter',
    from: '',
    to: '',
      type: 'video',
      body: {
        url: 'blob:video',
        filename: 'v.mp4',
        filetype: 'video/mp4',
        duration: 3,
        width: 80,
        height: 60,
      },
    });
    attachmentFileStore.set(message.msgLocalId, new File(['abc'], 'v.mp4', { type: 'video/mp4' }));

    const result = await uploader.prepareMessage(message, {
      onFileUploadProgress: onProgress,
      onFileUploadComplete: onComplete,
    });

    expect(upload).toHaveBeenCalledTimes(1);
    expect(onProgress).toHaveBeenCalledWith({ loaded: 10 });
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect((result.body as { url?: string }).url).toContain('/chatfiles/uuid-1');
  });

  it('voice/combine/file 分支应返回对应字段', async () => {
    const upload = vi.fn(async (): Promise<{ status: number; body: string }> => {
      return {
        status: 200,
        body: JSON.stringify({
          entities: [
            {
              uuid: 'uuid-2',
              'share-secret': 'sec-2',
              'file-metadata': {
                'content-type': 'application/octet-stream',
                'content-length': 9,
              },
            },
          ],
        }),
      };
    });
    const uploader = new AttachmentUploader({
      ...baseConfig,
      uploadAdapter: {
        upload: upload as unknown as (config: unknown) => Promise<{ status: number; body: string }>,
      } as never,
    });

    const voice = createMessage({
      msgLocalId: 'voice-adapter',
    from: '',
    to: '',
      type: 'voice',
      body: {
        url: 'blob:voice',
        filename: 'v.amr',
        filetype: 'audio/amr',
        duration: 2,
      },
    });
    attachmentFileStore.set(voice.msgLocalId, new File(['123'], 'v.amr', { type: 'audio/amr' }));
    const voiceResult = await uploader.prepareMessage(voice);
    expect((voiceResult.body as { url?: string }).url).toContain('/chatfiles/uuid-2');

    const combine = createMessage({
      msgLocalId: 'combine-adapter',
    from: '',
    to: '',
      type: 'combine',
      combineLevel: 2,
      body: {
        url: 'blob:combine',
        filename: 'c.bin',
        filetype: 'application/octet-stream',
        combineLevel: 2,
      },
    });
    attachmentFileStore.set(
      combine.msgLocalId,
      new File(['123'], 'c.bin', { type: 'application/octet-stream' })
    );
    const combineResult = await uploader.prepareMessage(combine);
    expect((combineResult.body as { url?: string }).url).toContain('/chatfiles/uuid-2');
    expect((combineResult as { combineLevel?: number }).combineLevel).toBe(2);

    const fileMsg = createMessage({
      msgLocalId: 'file-adapter',
    from: '',
    to: '',
      type: 'file',
      body: {
        url: 'blob:file',
        filename: 'f.bin',
        filetype: 'application/octet-stream',
      },
    });
    attachmentFileStore.set(
      fileMsg.msgLocalId,
      new File(['123'], 'f.bin', { type: 'application/octet-stream' })
    );
    const fileResult = await uploader.prepareMessage(fileMsg);
    expect((fileResult.body as { url?: string }).url).toContain('/chatfiles/uuid-2');
  });

  it('uploadAdapter 返回 HTTP 错误或非法 JSON 时应抛 UploadError', async () => {
    const onError = vi.fn();
    const uploaderStatus = new AttachmentUploader({
      ...baseConfig,
      uploadAdapter: {
        upload: vi.fn(async (): Promise<{ status: number; body: string }> => {
          return {
            status: 500,
            body: 'failed',
          };
        }),
      } as never,
    });
    const messageStatus = createMessage({
      msgLocalId: 'status-fail',
    from: '',
    to: '',
    });
    attachmentFileStore.set(
      messageStatus.msgLocalId,
      new File(['a'], 'a.txt', { type: 'text/plain' })
    );

    await expect(
      uploaderStatus.prepareMessage(messageStatus, {
        onFileUploadError: onError,
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.UPLOAD_REQUEST_FAILED,
    });
    expect(onError).toHaveBeenCalledTimes(1);

    const uploaderJson = new AttachmentUploader({
      ...baseConfig,
      uploadAdapter: {
        upload: vi.fn(async (): Promise<{ status: number; body: string }> => {
          return {
            status: 200,
            body: '{invalid-json',
          };
        }),
      } as never,
    });
    const messageJson = createMessage({
      msgLocalId: 'json-fail',
    from: '',
    to: '',
    });
    attachmentFileStore.set(
      messageJson.msgLocalId,
      new File(['a'], 'a.txt', { type: 'text/plain' })
    );

    await expect(uploaderJson.prepareMessage(messageJson)).rejects.toMatchObject({
      code: ERROR_CODES.UPLOAD_REQUEST_FAILED,
    });
  });

  it('adapter 抛 abort 平台错误时应触发 canceled 与 error 回调', async () => {
    const onCanceled = vi.fn();
    const onError = vi.fn();
    const uploader = new AttachmentUploader({
      ...baseConfig,
      uploadAdapter: {
        upload: vi.fn(async (): Promise<{ status: number; body: string }> => {
          throw createPlatformError('aborted', {
            code: PLATFORM_ERROR_CODE.UPLOAD_FAILED,
            stage: PLATFORM_ERROR_STAGE.UPLOAD,
            retryable: false,
            details: { reason: 'abort by user' },
          });
        }),
      } as never,
    });
    const message = createMessage({
      msgLocalId: 'abort-fail',
    from: '',
    to: '',
    });
    attachmentFileStore.set(message.msgLocalId, new File(['a'], 'a.txt', { type: 'text/plain' }));

    await expect(
      uploader.prepareMessage(message, {
        onFileUploadCanceled: onCanceled,
        onFileUploadError: onError,
      })
    ).rejects.toMatchObject({
      code: ERROR_CODES.UPLOAD_ABORTED,
    });
    expect(onCanceled).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('无 adapter 且非 web file 时应抛出上传能力缺失错误', async () => {
    const uploader = new AttachmentUploader(baseConfig);
    const message = createMessage({
      msgLocalId: 'miniapp-source',
    from: '',
    to: '',
      body: {
        url: 'wxfile://tmp/a.png',
        filename: 'a.png',
        filetype: 'image/png',
      },
    });
    attachmentFileStore.set(message.msgLocalId, {
      path: 'wxfile://tmp/a.png',
      name: 'a.png',
      type: 'image/png',
      size: 1,
    });

    await expect(uploader.prepareMessage(message)).rejects.toMatchObject({
      code: ERROR_CODES.UPLOAD_REQUIRED_FIELD_MISSING,
    });
  });

  it('multipart 非 init 错误不应降级为 simpleUpload', async () => {
    const uploader = new AttachmentUploader(baseConfig);
    const largeBuffer = new Uint8Array(MULTIPART_THRESHOLD + 1);
    const file = new File([largeBuffer], 'video.mp4', { type: 'video/mp4' });
    const message: Message = {
      msgServerId: '',
      msgLocalId: 'local-multipart-fail',
    from: '',
    to: '',
      sender: { userId: 'u1' },
      conversationId: 'room-1',
      conversationType: 'chatRoom',
      type: 'video',
      status: 'sending',
      ext: {},
      timestamp: Date.now(),
      body: {
        url: 'blob:local-video',
        filename: 'video.mp4',
        filetype: 'video/mp4',
        duration: 12,
      },
    };

    attachmentFileStore.set(message.msgLocalId, file);

    vi.mocked(multipartUpload).mockRejectedValue(
      new UploadError('Multipart part failed', {
        details: { stage: 'part' },
      })
    );
    vi.mocked(simpleUpload).mockResolvedValue({
      url: 'https://example.com/video.mp4',
      secret: 'secret',
      fileLength: file.size,
      filetype: 'video/mp4',
      filename: 'video.mp4',
    });

    await expect(uploader.prepareMessage(message)).rejects.toBeInstanceOf(UploadError);
    expect(simpleUpload).not.toHaveBeenCalled();
  });

  it('uploadAttachment/uploadByAdapter 私有防御分支应返回参数错误', async () => {
    const webFile = new File(['a'], 'a.txt', { type: 'text/plain' });
    const fileInfo: PrivateUploadFileInfo = {
      source: {
        sourceType: 'web-file' as const,
        file: webFile,
      },
      fileName: 'a.txt',
      fileType: 'text/plain',
      fileSize: 1,
      webFile,
    };
    const preparedUpload = {
      body: {
        url: 'blob:file',
        filename: 'a.txt',
        filetype: 'text/plain',
      },
      fileInfo,
    };
    const message = createMessage({
      msgLocalId: 'private-check',
    from: '',
    to: '',
      type: 'file',
      body: {
        url: 'blob:file',
        filename: 'a.txt',
        filetype: 'text/plain',
      },
    });
    const privateNoConfig = new AttachmentUploader() as unknown as {
      uploadAttachment: (message: Message, prepared: typeof preparedUpload) => Promise<unknown>;
      uploadByAdapter: (
        adapter: { upload: (config: unknown) => Promise<{ status: number; body: string }> },
        message: Message,
        prepared: typeof preparedUpload
      ) => Promise<unknown>;
    };

    await expect(privateNoConfig.uploadAttachment(message, preparedUpload)).rejects.toMatchObject({
      code: ERROR_CODES.UPLOAD_REQUIRED_FIELD_MISSING,
    });
    await expect(
      privateNoConfig.uploadByAdapter(
        {
          upload: async (): Promise<{ status: number; body: string }> => ({
            status: 200,
            body: '{}',
          }),
        },
        message,
        preparedUpload
      )
    ).rejects.toMatchObject({
      code: ERROR_CODES.UPLOAD_REQUIRED_FIELD_MISSING,
    });

    const privateWithConfig = new AttachmentUploader(baseConfig) as unknown as {
      uploadAttachment: (message: Message, prepared: typeof preparedUpload) => Promise<unknown>;
      uploadByAdapter: (
        adapter: { upload: (config: unknown) => Promise<{ status: number; body: string }> },
        message: Message,
        prepared: typeof preparedUpload
      ) => Promise<unknown>;
    };
    const invalidMessage = createMessage({
      type: 'text',
      body: {
        content: 'hello',
      },
    });

    await expect(
      privateWithConfig.uploadAttachment(invalidMessage, preparedUpload)
    ).rejects.toMatchObject({
      code: ERROR_CODES.UPLOAD_REQUIRED_FIELD_MISSING,
    });
    await expect(
      privateWithConfig.uploadByAdapter(
        {
          upload: async (): Promise<{ status: number; body: string }> => ({
            status: 200,
            body: '{}',
          }),
        },
        invalidMessage,
        preparedUpload
      )
    ).rejects.toMatchObject({
      code: ERROR_CODES.UPLOAD_REQUIRED_FIELD_MISSING,
    });
  });
});
