import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Message } from '@/types';
import { MULTIPART_THRESHOLD } from '@/upload/constants';
import { multipartAbort, multipartUpload } from '@/upload/multipart-upload';
import type { UploadRequest, UploadResponseEntity, UploadResponsePayload } from '@/upload/types';
import { ERROR_CODES } from '@/utils/error-codes';
import { UploadError } from '@/utils/errors';

type XhrBehavior = 'success' | 'httpError' | 'error' | 'timeout' | 'abort';
type XhrListener = (event?: { loaded?: number }) => void;

class MockXMLHttpRequest {
  public static behavior: XhrBehavior = 'success';

  public upload = {
    addEventListener: (type: string, listener: XhrListener): void => {
      if (type === 'progress') {
        this.uploadListener = listener;
      }
    },
  };

  public status = 200;
  public timeout = 0;

  private readonly listeners: Record<string, XhrListener[]> = {};
  private uploadListener: XhrListener | null = null;

  public addEventListener(type: string, listener: XhrListener): void {
    const group = this.listeners[type] ?? [];
    group.push(listener);
    this.listeners[type] = group;
  }

  public open(): void {}

  public setRequestHeader(): void {}

  public send(): void {
    this.uploadListener?.({ loaded: 8 });

    if (MockXMLHttpRequest.behavior === 'success') {
      this.status = 200;
      this.emit('load');
      return;
    }
    if (MockXMLHttpRequest.behavior === 'httpError') {
      this.status = 500;
      this.emit('load');
      return;
    }
    if (MockXMLHttpRequest.behavior === 'error') {
      this.emit('error');
      return;
    }
    if (MockXMLHttpRequest.behavior === 'timeout') {
      this.emit('timeout');
      return;
    }
    this.emit('abort');
  }

  private emit(type: string): void {
    const group = this.listeners[type] ?? [];
    for (const listener of group) {
      listener();
    }
  }
}

const createJsonResponse = (payload: UploadResponsePayload, status = 200): Response => {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status >= 200 && status < 300 ? 'OK' : 'Error',
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async (): Promise<UploadResponsePayload> => payload,
    text: async (): Promise<string> => JSON.stringify(payload),
  } as unknown as Response;
};

const createRequest = (options?: {
  readonly fileSize?: number;
  readonly messageType?: UploadRequest['messageType'];
  readonly imageType?: UploadRequest['imageType'];
  readonly md5?: string;
  readonly width?: number;
  readonly height?: number;
  readonly callbacks?: UploadRequest['callbacks'];
}): UploadRequest => {
  const message: Message = {
    msgServerId: '',
    msgLocalId: 'local-1',
    from: '',
    to: '',
    sender: { userId: 'alice' },
    conversationId: 'room-1',
    conversationType: 'singleChat',
    type: 'file',
    status: 'sending',
    ext: {},
    timestamp: Date.now(),
    body: {
      url: 'blob:local-file',
      filename: 'report.txt',
      filetype: 'text/plain',
      fileLength: 8,
    },
  };

  return {
    message,
    file: new File([new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])], 'report.txt', {
      type: 'text/plain',
    }),
    conversationId: 'room-1',
    conversationType: 'singleChat',
    messageType: options?.messageType ?? 'file',
    imageType: options?.imageType,
    md5: options?.md5 ?? 'md5-file',
    width: options?.width,
    height: options?.height,
    fileName: 'report.txt',
    fileType: 'text/plain',
    fileSize: options?.fileSize ?? MULTIPART_THRESHOLD + 1,
    callbacks: options?.callbacks,
    config: {
      restBaseUrl: 'https://api.example.com',
      token: 'token',
      appKey: 'org#app',
    },
  };
};

describe('multipart-upload', () => {
  beforeEach((): void => {
    vi.restoreAllMocks();
    MockXMLHttpRequest.behavior = 'success';
    Object.defineProperty(globalThis, 'XMLHttpRequest', {
      value: MockXMLHttpRequest,
      configurable: true,
      writable: true,
    });
  });

  afterEach((): void => {
    vi.restoreAllMocks();
  });

  it('文件大小未超过阈值时应直接报错', async () => {
    await expect(
      multipartUpload(createRequest({ fileSize: MULTIPART_THRESHOLD }))
    ).rejects.toMatchObject({
      code: ERROR_CODES.UPLOAD_REQUEST_FAILED,
    });
  });

  it('分片初始化失败时应包装 stage=init 错误', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network'));

    await expect(multipartUpload(createRequest())).rejects.toMatchObject({
      code: ERROR_CODES.UPLOAD_REQUEST_FAILED,
      details: expect.objectContaining({ stage: 'init' }),
    });
  });

  it('初始化响应缺少 uuid 时应报错', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      createJsonResponse({
        entities: [
          { file_upper_limit: 9999999, part_lower_limit: MULTIPART_THRESHOLD },
        ] as unknown as UploadResponseEntity[],
      })
    );

    await expect(multipartUpload(createRequest())).rejects.toBeInstanceOf(UploadError);
  });

  it('超过服务端 file_upper_limit 时应报 UPLOAD_SIZE_EXCEEDED', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      createJsonResponse({
        entities: [
          {
            uuid: 'upload-uuid',
            file_upper_limit: 1,
            part_lower_limit: MULTIPART_THRESHOLD,
          },
        ],
      } as unknown as UploadResponsePayload)
    );

    await expect(multipartUpload(createRequest())).rejects.toMatchObject({
      code: ERROR_CODES.UPLOAD_SIZE_EXCEEDED,
    });
  });

  it('分片上传失败时应返回上传错误', async () => {
    MockXMLHttpRequest.behavior = 'httpError';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      createJsonResponse({
        entities: [
          {
            uuid: 'upload-uuid',
            file_upper_limit: MULTIPART_THRESHOLD + 10,
            part_lower_limit: MULTIPART_THRESHOLD,
          },
        ],
      } as unknown as UploadResponsePayload)
    );

    await expect(multipartUpload(createRequest())).rejects.toMatchObject({
      code: ERROR_CODES.UPLOAD_REQUEST_FAILED,
    });
  });

  it('分片上传成功时应返回结果并触发进度/完成回调', async () => {
    const onFileUploadProgress = vi.fn();
    const onFileUploadComplete = vi.fn();

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
      const url = String(input);
      if (url.endsWith('/part-upload')) {
        return createJsonResponse({
          entities: [
            {
              uuid: 'upload-uuid',
              file_upper_limit: MULTIPART_THRESHOLD + 10,
              part_lower_limit: MULTIPART_THRESHOLD,
            },
          ],
        } as unknown as UploadResponsePayload);
      }
      return createJsonResponse({
        entities: [
          {
            uuid: 'file-uuid',
            'share-secret': 'secret-1',
            'file-metadata': {
              'content-length': 8,
              'content-type': 'text/plain',
            },
          },
        ],
      } as unknown as UploadResponsePayload);
    });

    const result = await multipartUpload(
      createRequest({
        callbacks: {
          onFileUploadProgress,
          onFileUploadComplete,
        },
      })
    );

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(onFileUploadProgress).toHaveBeenCalled();
    expect(onFileUploadComplete).toHaveBeenCalledOnce();
    expect(result.url).toContain('/chatfiles/file-uuid');
    expect(result.secret).toBe('secret-1');
    const completeCall = fetchSpy.mock.calls[1];
    expect(String(completeCall?.[0] ?? '')).toContain('md5=md5-file');
  });

  it('图片分片完成时应通过 query 传递原图 md5、imageType 与宽高', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
      const url = String(input);
      if (url.endsWith('/part-upload')) {
        return createJsonResponse({
          entities: [
            {
              uuid: 'upload-uuid',
              file_upper_limit: MULTIPART_THRESHOLD + 10,
              part_lower_limit: MULTIPART_THRESHOLD,
            },
          ],
        } as unknown as UploadResponsePayload);
      }
      return createJsonResponse({
        entities: [
          {
            uuid: 'file-uuid',
            'share-secret': 'secret-1',
            'file-metadata': {
              'content-length': 8,
              'content-type': 'image/jpeg',
            },
          },
        ],
      } as unknown as UploadResponsePayload);
    });

    await multipartUpload(
      createRequest({
        messageType: 'image',
        imageType: 'large',
        md5: 'md5-origin-image',
        width: 720,
        height: 1080,
      })
    );

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const completeCall = fetchSpy.mock.calls[1];
    const completeUrl = String(completeCall?.[0] ?? '');
    expect(completeUrl).toContain('md5=md5-origin-image');
    expect(completeUrl).toContain('imageType=large');
    expect(completeUrl).toContain('width=720');
    expect(completeUrl).toContain('height=1080');
    expect(completeUrl).not.toContain('thumbnail-width=');
    expect(completeUrl).not.toContain('thumbnail-height=');
  });

  it('multipartAbort 应发送 DELETE 请求', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(createJsonResponse({}));

    await multipartAbort({
      restBaseUrl: 'https://api.example.com',
      orgName: 'org',
      appName: 'app',
      token: 'token',
      uuid: 'upload-uuid',
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.example.com/org/app/sdk/chatfiles/part-upload/upload-uuid',
      expect.objectContaining({ method: 'DELETE' })
    );
  });
});
