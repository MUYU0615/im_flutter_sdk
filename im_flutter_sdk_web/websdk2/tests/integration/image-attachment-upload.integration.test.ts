import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MsyncCodec } from '@/protocol/msync/codec';
import { getMsyncRoot } from '@/protocol/msync/root';
import { ContentType, MsyncMessageType, NameSpace } from '@/protocol/msync/types';
import { attachmentFileStore } from '@/upload/attachment-file-store';
import { AttachmentUploader } from '@/upload/attachment-uploader';
import type { Message } from '@/types';
import type { RequestAdapter, RequestResponse, UploadAdapter } from '@/platform';

const baseConfig = {
  restBaseUrl: 'https://rest.example.com',
  token: 'token',
  appKey: 'org#app',
};

const createImageMessage = (overrides?: Partial<Message>): Message => {
  return {
    msgServerId: '',
    msgLocalId: 'image-local-1',
    from: '',
    to: '',
    sender: { userId: 'alice' },
    conversationId: 'bob',
    conversationType: 'singleChat',
    type: 'image',
    status: 'sending',
    ext: {},
    timestamp: Date.now(),
    body: {
      localUrl: 'blob:image',
      filename: 'image.png',
      filetype: 'image/png',
      width: 1080,
      height: 1920,
      isGif: false,
      isOriginalImage: false,
    },
    ...overrides,
  } as Message;
};

const createFileMessage = (overrides?: Partial<Message>): Message => {
  return {
    msgServerId: '',
    msgLocalId: 'file-local-1',
    from: '',
    to: '',
    sender: { userId: 'alice' },
    conversationId: 'bob',
    conversationType: 'singleChat',
    type: 'file',
    status: 'sending',
    ext: {},
    timestamp: Date.now(),
    body: {
      url: 'blob:file',
      filename: 'report.txt',
      filetype: 'text/plain',
      fileLength: 1024 * 1024 + 16,
    },
    ...overrides,
  } as Message;
};

const buildImageSyncPayload = (options: {
  readonly imageType: 1 | 2;
  readonly remotePath: string;
}): Uint8Array => {
  const root = getMsyncRoot();
  const commSyncDlType = root.lookupType('easemob.pb.CommSyncDL');
  const messageBodyType = root.lookupType('easemob.pb.MessageBody');
  const contentType = root.lookupType('easemob.pb.MessageBody.Content');
  const metaType = root.lookupType('easemob.pb.Meta');

  const content = contentType.create({
    type: ContentType.IMAGE,
    imageType: options.imageType,
    displayName: 'remote-image.jpg',
    remotePath: options.remotePath,
    fileLength: 2048,
    size: {
      width: options.imageType === 1 ? 1080 : 720,
      height: options.imageType === 1 ? 1920 : 1280,
    },
  });
  const body = messageBodyType.create({
    type: MsyncMessageType.SINGLECHAT,
    from: { name: 'alice' },
    to: { name: 'bob' },
    contents: [content],
    ext: [],
  });
  const meta = metaType.create({
    id: '9001',
    from: { name: 'alice' },
    to: { name: 'bob' },
    ns: NameSpace.CHAT,
    payload: messageBodyType.encode(body).finish(),
  });

  return commSyncDlType
    .encode(
      commSyncDlType.create({
        metaId: '0',
        metas: [meta],
      })
    )
    .finish();
};

describe('image attachment upload integration', () => {
  beforeEach(() => {
    attachmentFileStore.clear();
    vi.restoreAllMocks();
  });

  it('默认图片发送应生成大图、执行预检并上传大图资源', async () => {
    const originFile = new File([new Uint8Array(1024 * 1024 + 32)], 'image.png', {
      type: 'image/png',
    });
    const bigFile = new File([new Uint8Array(1024 * 1024 + 32)], 'image-big.jpg', {
      type: 'image/jpeg',
    });
    const request = vi.fn(async () => ({
      status: 200,
      headers: {},
      data: {
        entities: [
          {
            exists: false,
            type: 'chatfile',
          },
        ],
      },
    }));
    const requestAdapter: RequestAdapter = {
      request: request as unknown as <TData>(
        config: Parameters<RequestAdapter['request']>[0]
      ) => Promise<RequestResponse<TData>>,
    };
    const uploadAdapter: UploadAdapter = {
      upload: vi.fn(async () => ({
        status: 200,
        body: JSON.stringify({
          entities: [
            {
              uuid: 'upload-1',
              'share-secret': 'secret-1',
              'file-metadata': {
                'content-length': bigFile.size,
                'content-type': 'image/jpeg',
              },
            },
          ],
        }),
      })),
    };
    const imageProcessor = {
      getImageInfo: vi.fn(),
      generateBigImage: vi.fn(async () => ({
        source: {
          sourceType: 'web-file' as const,
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
      })),
      computeMd5: vi.fn(async () => 'md5-origin-image'),
    };
    const uploader = new AttachmentUploader({
      ...baseConfig,
      requestAdapter,
      uploadAdapter,
      imageProcessor,
    });
    const message = createImageMessage();
    attachmentFileStore.set(message.msgLocalId, originFile);

    const result = await uploader.prepareMessage(message);

    expect(imageProcessor.generateBigImage).toHaveBeenCalledTimes(1);
    expect(imageProcessor.computeMd5).toHaveBeenCalledTimes(2);
    expect(imageProcessor.computeMd5).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        sourceType: 'web-file',
        file: originFile,
        size: originFile.size,
      })
    );
    expect(imageProcessor.computeMd5).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        sourceType: 'web-file',
        file: originFile,
        size: originFile.size,
      })
    );
    expect(requestAdapter.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        url: 'https://rest.example.com/org/app/chatfiles/exists?md5=md5-origin-image&imageType=large',
      })
    );
    expect(uploadAdapter.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        source: expect.objectContaining({
          sourceType: 'web-file',
          mimeType: 'image/jpeg',
          size: bigFile.size,
        }),
        url: expect.stringContaining('md5=md5-origin-image'),
      })
    );
    expect(uploadAdapter.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining('imageType=large'),
      })
    );
    expect(uploadAdapter.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining('width=720'),
      })
    );
    expect(uploadAdapter.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining('height=1280'),
      })
    );
    expect(result.body).toMatchObject({
      isOriginalImage: false,
      localUrl: 'blob:image',
      originalImageUrl: 'https://rest.example.com/org/app/chatfiles/upload-1',
      bigImageUrl: 'https://rest.example.com/org/app/chatfiles/upload-1?size=large',
      thumbnailUrl: 'https://rest.example.com/org/app/chatfiles/upload-1?size=small',
      width: 720,
      height: 1280,
      secret: 'secret-1',
    });
  });

  it('自有上传模式下 SDK 上传成功后不应自动派生 big/thumbnail', async () => {
    const originFile = new File([new Uint8Array(128)], 'origin.png', {
      type: 'image/png',
    });
    const uploadAdapter: UploadAdapter = {
      upload: vi.fn(async () => ({
        status: 200,
        body: JSON.stringify({
          entities: [
            {
              uuid: 'custom-upload-1',
              'share-secret': 'secret-custom',
              'file-metadata': {
                'content-length': originFile.size,
                'content-type': 'image/png',
              },
            },
          ],
        }),
      })),
    };
    const computeMd5 = vi.fn(async () => 'md5-origin-upload');
    const uploader = new AttachmentUploader({
      ...baseConfig,
      useCustomAttachmentUpload: true,
      uploadAdapter,
      imageProcessor: {
        getImageInfo: vi.fn(),
        generateBigImage: vi.fn(),
        computeMd5,
      },
    });
    const message = createImageMessage({
      msgLocalId: 'custom-upload-image-1',
    from: '',
    to: '',
      body: {
        localUrl: 'blob:image',
        filename: 'origin.png',
        filetype: 'image/png',
        width: 1080,
        height: 1920,
        isGif: false,
        isOriginalImage: true,
      },
    });
    attachmentFileStore.set(message.msgLocalId, originFile);

    const result = await uploader.prepareMessage(message);

    expect(uploadAdapter.upload).toHaveBeenCalledOnce();
    expect(computeMd5).toHaveBeenCalledTimes(1);
    expect(uploadAdapter.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining('md5=md5-origin-upload'),
      })
    );
    expect(uploadAdapter.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining('imageType=origin'),
      })
    );
    expect(uploadAdapter.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining('width=1080'),
      })
    );
    expect(uploadAdapter.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining('height=1920'),
      })
    );
    expect(result.body).toMatchObject({
      isOriginalImage: true,
      localUrl: 'blob:image',
      originalImageUrl: 'https://rest.example.com/org/app/chatfiles/custom-upload-1',
      secret: 'secret-custom',
    });
    expect('bigImageUrl' in result.body ? result.body.bigImageUrl : undefined).toBeUndefined();
    expect('thumbnailUrl' in result.body ? result.body.thumbnailUrl : undefined).toBeUndefined();
  });

  it('isOriginalImage=true 且预检命中时应跳过上传并复用原图资源', async () => {
    const originFile = new File([new Uint8Array(220 * 1024)], 'origin.png', {
      type: 'image/png',
    });
    const request = vi.fn(async () => ({
      status: 200,
      headers: {},
      data: {
        entities: [
          {
            exists: true,
            uuid: 'reuse-1',
            'share-secret': 'secret-reuse',
          },
        ],
      },
    }));
    const requestAdapter: RequestAdapter = {
      request: request as unknown as <TData>(
        config: Parameters<RequestAdapter['request']>[0]
      ) => Promise<RequestResponse<TData>>,
    };
    const uploadAdapter: UploadAdapter = {
      upload: vi.fn(),
    };
    const imageProcessor = {
      getImageInfo: vi.fn(),
      generateBigImage: vi.fn(),
      computeMd5: vi.fn(async () => 'md5-origin-image'),
    };
    const uploader = new AttachmentUploader({
      ...baseConfig,
      requestAdapter,
      uploadAdapter,
      imageProcessor,
    });
    const message = createImageMessage({
      msgLocalId: 'image-local-origin',
    from: '',
    to: '',
      body: {
        localUrl: 'blob:image',
        filename: 'origin.png',
        filetype: 'image/png',
        width: 1080,
        height: 1920,
        isGif: false,
        isOriginalImage: true,
      },
    });
    attachmentFileStore.set(message.msgLocalId, originFile);

    const result = await uploader.prepareMessage(message);

    expect(imageProcessor.generateBigImage).not.toHaveBeenCalled();
    expect(requestAdapter.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        url: 'https://rest.example.com/org/app/chatfiles/exists?md5=md5-origin-image&imageType=origin',
      })
    );
    expect(uploadAdapter.upload).not.toHaveBeenCalled();
    expect(result.body).toMatchObject({
      isOriginalImage: true,
      localUrl: 'blob:image',
      originalImageUrl: 'https://rest.example.com/org/app/chatfiles/reuse-1',
      bigImageUrl: 'https://rest.example.com/org/app/chatfiles/reuse-1?size=large',
      thumbnailUrl: 'https://rest.example.com/org/app/chatfiles/reuse-1?size=small',
      secret: 'secret-reuse',
    });
  });

  it('普通附件达到门槛且预检命中时应跳过上传', async () => {
    const file = new File([new Uint8Array(1024 * 1024 + 16)], 'report.txt', {
      type: 'text/plain',
    });
    const request = vi.fn(async () => ({
      status: 200,
      headers: {},
      data: {
        entities: [
          {
            exists: true,
            uuid: 'file-reuse-1',
            'share-secret': 'secret-file',
          },
        ],
      },
    }));
    const requestAdapter: RequestAdapter = {
      request: request as unknown as <TData>(
        config: Parameters<RequestAdapter['request']>[0]
      ) => Promise<RequestResponse<TData>>,
    };
    const uploadAdapter: UploadAdapter = {
      upload: vi.fn(),
    };
    const uploader = new AttachmentUploader({
      ...baseConfig,
      requestAdapter,
      uploadAdapter,
      imageProcessor: {
        getImageInfo: vi.fn(),
        generateBigImage: vi.fn(),
        computeMd5: vi.fn(async () => 'md5-file'),
      },
    });
    const message = createFileMessage();
    attachmentFileStore.set(message.msgLocalId, file);

    const result = await uploader.prepareMessage(message);

    expect(requestAdapter.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        url: 'https://rest.example.com/org/app/chatfiles/exists?md5=md5-file',
      })
    );
    expect(uploadAdapter.upload).not.toHaveBeenCalled();
    expect(result.body).toMatchObject({
      url: 'https://rest.example.com/org/app/chatfiles/file-reuse-1',
      secret: 'secret-file',
    });
  });

  it('小程序图片文件源应复用同一发送语义并透传 miniapp-path 上传源', async () => {
    const uploadAdapter: UploadAdapter = {
      upload: vi.fn(async () => ({
        status: 200,
        body: JSON.stringify({
          entities: [
            {
              uuid: 'miniapp-upload-1',
              'share-secret': 'miniapp-secret-1',
              'file-metadata': {
                'content-length': 320 * 1024,
                'content-type': 'image/jpeg',
              },
            },
          ],
        }),
      })),
    };
    const imageProcessor = {
      getImageInfo: vi.fn(),
      generateBigImage: vi.fn(async source => {
        expect(source).toMatchObject({
          sourceType: 'miniapp-path',
          path: 'wxfile://tmp/camera/IMG_20260415.JPG?foo=1',
          name: 'IMG_20260415.JPG',
          mimeType: 'image/jpeg',
          size: 640 * 1024,
        });

        return {
          source: {
            sourceType: 'miniapp-path' as const,
            path: 'wxfile://tmp/camera/IMG_20260415-big.jpg',
            name: 'IMG_20260415-big.jpg',
            mimeType: 'image/jpeg',
            size: 320 * 1024,
          },
          width: 720,
          height: 1280,
          fileName: 'IMG_20260415-big.jpg',
          fileType: 'image/jpeg',
          fileSize: 320 * 1024,
        };
      }),
      computeMd5: vi.fn(async () => 'md5-miniapp-origin-image'),
    };
    const uploader = new AttachmentUploader({
      ...baseConfig,
      uploadAdapter,
      imageProcessor,
    });
    const message = createImageMessage({
      msgLocalId: 'miniapp-image-1',
    from: '',
    to: '',
      body: {
        localUrl: 'wxfile://tmp/camera/IMG_20260415.JPG?foo=1',
        filename: 'fallback.bin',
        filetype: 'application/octet-stream',
        width: 1080,
        height: 1920,
        isGif: false,
      },
    });
    attachmentFileStore.set(message.msgLocalId, {
      path: 'wxfile://tmp/camera/IMG_20260415.JPG?foo=1',
      size: 640 * 1024,
    });

    const result = await uploader.prepareMessage(message);

    expect(imageProcessor.generateBigImage).toHaveBeenCalledTimes(1);
    expect(imageProcessor.computeMd5).toHaveBeenCalledTimes(1);
    expect(imageProcessor.computeMd5).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceType: 'miniapp-path',
        path: 'wxfile://tmp/camera/IMG_20260415.JPG?foo=1',
        size: 640 * 1024,
      })
    );
    expect(uploadAdapter.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        source: expect.objectContaining({
          sourceType: 'miniapp-path',
          path: 'wxfile://tmp/camera/IMG_20260415-big.jpg',
          name: 'IMG_20260415-big.jpg',
          mimeType: 'image/jpeg',
          size: 320 * 1024,
        }),
        url: expect.stringContaining('md5=md5-miniapp-origin-image'),
      })
    );
    expect(uploadAdapter.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining('imageType=large'),
      })
    );
    expect(uploadAdapter.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining('width=720'),
      })
    );
    expect(uploadAdapter.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining('height=1280'),
      })
    );
    expect(result.body).toMatchObject({
      isOriginalImage: false,
      localUrl: 'wxfile://tmp/camera/IMG_20260415.JPG?foo=1',
      originalImageUrl: 'https://rest.example.com/org/app/chatfiles/miniapp-upload-1',
      bigImageUrl: 'https://rest.example.com/org/app/chatfiles/miniapp-upload-1?size=large',
      thumbnailUrl: 'https://rest.example.com/org/app/chatfiles/miniapp-upload-1?size=small',
      width: 720,
      height: 1280,
      secret: 'miniapp-secret-1',
    });
  });

  it('下行 decodeSync 应按协议语义组装图片地址视图', () => {
    const codec = new MsyncCodec({
      appKey: 'org#app',
      userId: 'bob',
      token: 'token',
    });

    const originalResult = codec.decodeSync(
      buildImageSyncPayload({
        imageType: 1,
        remotePath: 'https://rest.example.com/org/app/chatfiles/down-origin-1',
      })
    );
    const bigResult = codec.decodeSync(
      buildImageSyncPayload({
        imageType: 2,
        remotePath: 'https://rest.example.com/org/app/chatfiles/down-big-1',
      })
    );

    expect(originalResult.messages[0]?.body).toMatchObject({
      localUrl: '',
      isOriginalImage: true,
      originalImageUrl: 'https://rest.example.com/org/app/chatfiles/down-origin-1',
      bigImageUrl: 'https://rest.example.com/org/app/chatfiles/down-origin-1?size=large',
      thumbnailUrl: 'https://rest.example.com/org/app/chatfiles/down-origin-1?size=small',
    });
    expect(bigResult.messages[0]?.body).toMatchObject({
      localUrl: '',
      isOriginalImage: false,
      originalImageUrl: 'https://rest.example.com/org/app/chatfiles/down-big-1',
      bigImageUrl: 'https://rest.example.com/org/app/chatfiles/down-big-1?size=large',
      thumbnailUrl: 'https://rest.example.com/org/app/chatfiles/down-big-1?size=small',
    });
  });
});
