import { afterEach, describe, expect, it, vi } from 'vitest';

import { AttachmentDownloader } from '@/core/message/attachment-downloader';
import type { RequestAdapter, RequestConfig, RequestResponse } from '@/platform';
import type { Message } from '@/types';
import { ERROR_CODES } from '@/utils/error-codes';

const createAdapter = (
  implementation: <TData>(config: RequestConfig) => Promise<RequestResponse<TData>>
): RequestAdapter => ({
  request: implementation,
});

const createAttachmentMessage = (
  type: 'image' | 'file' | 'video' | 'voice',
  body: Record<string, unknown>
): Message =>
  ({
    msgLocalId: 'local-1',
    from: '',
    to: '',
    msgServerId: 'server-1',
    type,
    status: 'sent',
    direct: 'SEND',
    timestamp: 1,
    sender: {
      userId: 'alice',
    },
    conversationId: 'bob',
    conversationType: 'singleChat',
    body,
  }) as unknown as Message;

describe('AttachmentDownloader', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createRequestAdapter = (
    implementation: <TData>(config: RequestConfig) => Promise<RequestResponse<TData>>
  ): RequestAdapter => ({
    request: implementation,
  });

  it('应下载图片附件并追加 share-secret', async () => {
    const requestImpl = async <TData>(config: RequestConfig): Promise<RequestResponse<TData>> => {
      expect(config).toMatchObject({
        url: 'https://cdn.example.com/image.png?em-redirect=true&share-secret=token%20x',
        method: 'GET',
        responseType: 'arraybuffer',
        timeoutMs: 2000,
      });
      return {
        status: 200,
        headers: {},
        data: new Uint8Array([1, 2, 3]).buffer as TData,
      };
    };
    const request = vi.fn(requestImpl) as unknown as <TData>(
      config: RequestConfig
    ) => Promise<RequestResponse<TData>>;
    const downloader = new AttachmentDownloader(createRequestAdapter(request));

    const result = await downloader.download(
      createAttachmentMessage('image', {
        filename: 'image.png',
        filetype: 'image/png',
        fileLength: 3,
        originalImageUrl: 'https://cdn.example.com/image.png',
        secret: 'token x',
      }),
      2000
    );

    expect(request).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      filename: 'image.png',
      mimeType: 'image/png',
      size: 3,
      data: new Uint8Array([1, 2, 3]),
      downloadUrl: 'https://cdn.example.com/image.png',
    });
  });

  it('文件附件应回退到 fileSize 字段，并避免重复追加 share-secret', async () => {
    const requestImpl = async <TData>(config: RequestConfig): Promise<RequestResponse<TData>> => {
      expect(config.url).toBe('https://cdn.example.com/file.zip?share-secret=exists&em-redirect=true');
      return {
        status: 200,
        headers: {},
        data: new Uint8Array([9, 8]).buffer as TData,
      };
    };
    const downloader = new AttachmentDownloader(createRequestAdapter(requestImpl));

    const result = await downloader.download(
      createAttachmentMessage('file', {
        filename: 'file.zip',
        filetype: 'application/zip',
        fileSize: 2,
        url: 'https://cdn.example.com/file.zip?share-secret=exists',
        secret: 'ignored',
      })
    );

    expect(result.size).toBe(2);
    expect(result.data).toEqual(new Uint8Array([9, 8]));
  });

  it('非附件消息应抛出 ATTACHMENT_INVALID', async () => {
    const downloader = new AttachmentDownloader(
      createAdapter(async <TData>() => ({
        status: 200,
        headers: {},
        data: new Uint8Array().buffer as TData,
      }))
    );

    await expect(
      downloader.download({
        msgLocalId: '1',
    from: '',
    to: '',
        msgServerId: '2',
        type: 'text',
        status: 'sent',
        direct: 'SEND',
        timestamp: 1,
        sender: { userId: 'alice' },
        conversationId: 'bob',
        conversationType: 'singleChat',
        body: { content: 'hello' },
      } as unknown as Message)
    ).rejects.toMatchObject({
      code: ERROR_CODES.ATTACHMENT_INVALID,
    });
  });

  it('缺少附件 url 时应抛出 ATTACHMENT_INVALID', async () => {
    const downloader = new AttachmentDownloader(
      createAdapter(async <TData>() => ({
        status: 200,
        headers: {},
        data: new Uint8Array().buffer as TData,
      }))
    );

    await expect(
      downloader.download(
        createAttachmentMessage('image', {
          filename: 'image.png',
          filetype: 'image/png',
        })
      )
    ).rejects.toMatchObject({
      code: ERROR_CODES.ATTACHMENT_INVALID,
    });
  });

  it('当前平台没有 request adapter 时应抛出网络错误', async () => {
    vi.stubGlobal('fetch', undefined);

    const downloader = new AttachmentDownloader();

    await expect(
      downloader.download(
        createAttachmentMessage('voice', {
          filename: 'voice.aac',
          filetype: 'audio/aac',
          url: 'https://cdn.example.com/voice.aac',
        })
      )
    ).rejects.toMatchObject({
      code: 2,
    });
  });

  it('401/403/404/429/5xx 状态应映射为稳定错误', async () => {
    const cases = [
      {
        status: 401,
        data: new Uint8Array().buffer,
        expectedCode: ERROR_CODES.AUTH_UNAUTHORIZED,
      },
      {
        status: 403,
        data: new Uint8Array().buffer,
        expectedCode: ERROR_CODES.AUTH_FORBIDDEN,
      },
      {
        status: 404,
        data: 'expired by server',
        expectedCode: ERROR_CODES.ATTACHMENT_EXPIRED,
      },
      {
        status: 404,
        data: 'missing',
        expectedCode: ERROR_CODES.ATTACHMENT_NOT_FOUND,
      },
      {
        status: 429,
        data: new Uint8Array().buffer,
        expectedCode: ERROR_CODES.SERVICE_LIMIT_EXCEEDED,
      },
      {
        status: 500,
        data: new Uint8Array().buffer,
        expectedCode: ERROR_CODES.FILE_DOWNLOAD_FAILED,
      },
    ] as const;

    for (const item of cases) {
      const downloader = new AttachmentDownloader(
        createAdapter(
          async <TData>(): Promise<RequestResponse<TData>> => ({
            status: item.status,
            headers: {},
            data: item.data as TData,
          })
        )
      );

      await expect(
        downloader.download(
          createAttachmentMessage('video', {
            filename: 'video.mp4',
            filetype: 'video/mp4',
            url: 'https://cdn.example.com/video.mp4',
          })
        )
      ).rejects.toMatchObject({
        code: item.expectedCode,
      });
    }
  });
});
