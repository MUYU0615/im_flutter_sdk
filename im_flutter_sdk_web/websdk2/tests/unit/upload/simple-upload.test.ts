import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { UPLOAD_TIMEOUT } from '@/config/timeouts';
import type { Message } from '@/types';
import { simpleUpload } from '@/upload/simple-upload';
import type { UploadRequest, UploadResponsePayload } from '@/upload/types';
import { ERROR_CODES } from '@/utils/error-codes';
import { UploadError } from '@/utils/errors';

type XhrBehavior =
  | 'success'
  | 'httpError'
  | 'error'
  | 'timeout'
  | 'abort'
  | 'invalidJson'
  | 'missingUuid';

interface MockProgressEvent {
  readonly loaded: number;
  readonly total: number;
  readonly lengthComputable: boolean;
}

type XhrListener = (event?: MockProgressEvent) => void;

class MockXMLHttpRequest {
  public static behavior: XhrBehavior = 'success';
  public static lastInstance: MockXMLHttpRequest | null = null;

  public readonly headers: Record<string, string> = {};
  public method = '';
  public url = '';
  public status = 200;
  public timeout = 0;
  public responseText = '';
  public requestBody: FormData | null = null;

  public readonly upload = {
    addEventListener: (type: string, listener: XhrListener): void => {
      if (type === 'progress') {
        this.progressListener = listener;
      }
    },
  };

  private readonly listeners: Record<string, XhrListener[]> = {};
  private progressListener: XhrListener | null = null;

  public constructor() {
    MockXMLHttpRequest.lastInstance = this;
  }

  public addEventListener(type: string, listener: XhrListener): void {
    const group = this.listeners[type] ?? [];
    group.push(listener);
    this.listeners[type] = group;
  }

  public open(method: string, url: string): void {
    this.method = method;
    this.url = url;
  }

  public setRequestHeader(key: string, value: string): void {
    this.headers[key] = value;
  }

  public send(body: Document | XMLHttpRequestBodyInit | null): void {
    this.requestBody = body instanceof FormData ? body : null;
    this.progressListener?.({
      loaded: 4,
      total: 8,
      lengthComputable: true,
    });

    if (MockXMLHttpRequest.behavior === 'success') {
      this.status = 200;
      this.responseText = JSON.stringify({
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
      } as UploadResponsePayload);
      this.emit('load');
      return;
    }

    if (MockXMLHttpRequest.behavior === 'httpError') {
      this.status = 500;
      this.responseText = JSON.stringify({ entities: [{ uuid: 'file-uuid' }] });
      this.emit('load');
      return;
    }

    if (MockXMLHttpRequest.behavior === 'invalidJson') {
      this.status = 200;
      this.responseText = '{"entities":';
      this.emit('load');
      return;
    }

    if (MockXMLHttpRequest.behavior === 'missingUuid') {
      this.status = 200;
      this.responseText = JSON.stringify({ entities: [{}] });
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

const createRequest = (options?: {
  readonly appKey?: string;
  readonly messageType?: UploadRequest['messageType'];
  readonly imageType?: UploadRequest['imageType'];
  readonly md5?: string;
  readonly width?: number;
  readonly height?: number;
  readonly thumbnailWidth?: number;
  readonly thumbnailHeight?: number;
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
    fileSize: 8,
    thumbnailWidth: options?.thumbnailWidth,
    thumbnailHeight: options?.thumbnailHeight,
    callbacks: options?.callbacks,
    config: {
      restBaseUrl: 'https://api.example.com',
      token: 'token',
      appKey: options?.appKey ?? 'org#app',
    },
  };
};

describe('simple-upload', () => {
  beforeEach((): void => {
    vi.restoreAllMocks();
    MockXMLHttpRequest.behavior = 'success';
    MockXMLHttpRequest.lastInstance = null;
    Object.defineProperty(globalThis, 'XMLHttpRequest', {
      value: MockXMLHttpRequest,
      configurable: true,
      writable: true,
    });
  });

  afterEach((): void => {
    vi.restoreAllMocks();
  });

  it('上传成功时应返回上传结果并触发进度/完成回调', async () => {
    const onFileUploadProgress = vi.fn();
    const onFileUploadComplete = vi.fn();

    const result = await simpleUpload(
      createRequest({
        callbacks: {
          onFileUploadProgress,
          onFileUploadComplete,
        },
      })
    );

    expect(onFileUploadProgress).toHaveBeenCalledWith(
      expect.objectContaining({ loaded: 4, total: 8, percent: 50 })
    );
    expect(onFileUploadComplete).toHaveBeenCalledOnce();
    expect(result.secret).toBe('secret-1');
    expect(result.url).toContain('/chatfiles/file-uuid');

    const instance = MockXMLHttpRequest.lastInstance;
    expect(instance?.method).toBe('POST');
    expect(instance?.url).toContain('chat-type=CHAT');
    expect(instance?.url).toContain('chat-target=room-1');
    expect(instance?.headers['Authorization']).toBe('Bearer token');
    expect(instance?.url).toContain('md5=md5-file');
  });

  it('传入缩略图参数时应写入 FormData', async () => {
    await simpleUpload(
      createRequest({
        thumbnailWidth: 80,
        thumbnailHeight: 60,
      })
    );

    const formData = MockXMLHttpRequest.lastInstance?.requestBody;
    expect(formData).toBeInstanceOf(FormData);
    expect(formData?.get('thumbnail-width')).toBe('80');
    expect(formData?.get('thumbnail-height')).toBe('60');
  });

  it('图片简单上传时应通过 query 传递原图 md5、imageType 与宽高', async () => {
    await simpleUpload(
      createRequest({
        messageType: 'image',
        imageType: 'large',
        md5: 'md5-origin-image',
        width: 720,
        height: 1080,
      })
    );

    const instance = MockXMLHttpRequest.lastInstance;
    const formData = instance?.requestBody;
    expect(instance?.url).toContain('md5=md5-origin-image');
    expect(instance?.url).toContain('imageType=large');
    expect(instance?.url).toContain('width=720');
    expect(instance?.url).toContain('height=1080');
    expect(formData?.get('imagetype')).toBeNull();
    expect(formData?.get('thumbnail-width')).toBeNull();
    expect(formData?.get('thumbnail-height')).toBeNull();
  });

  it('中断上传时应抛出 UPLOAD_ABORTED 并触发取消回调', async () => {
    MockXMLHttpRequest.behavior = 'abort';
    const onFileUploadCanceled = vi.fn();

    await expect(
      simpleUpload(
        createRequest({
          callbacks: { onFileUploadCanceled },
        })
      )
    ).rejects.toMatchObject({
      code: ERROR_CODES.UPLOAD_ABORTED,
    });
    expect(onFileUploadCanceled).toHaveBeenCalledOnce();
  });

  it('网络错误时应抛出 UPLOAD_REQUEST_FAILED', async () => {
    MockXMLHttpRequest.behavior = 'error';

    await expect(simpleUpload(createRequest())).rejects.toMatchObject({
      code: ERROR_CODES.UPLOAD_REQUEST_FAILED,
    });
  });

  it('超时时应抛出 UPLOAD_TIMEOUT', async () => {
    MockXMLHttpRequest.behavior = 'timeout';

    await expect(simpleUpload(createRequest())).rejects.toMatchObject({
      code: ERROR_CODES.UPLOAD_TIMEOUT,
      details: expect.objectContaining({
        timeout: UPLOAD_TIMEOUT,
      }),
    });
  });

  it('HTTP 错误时应抛出 UploadError', async () => {
    MockXMLHttpRequest.behavior = 'httpError';

    await expect(simpleUpload(createRequest())).rejects.toMatchObject({
      code: ERROR_CODES.UPLOAD_REQUEST_FAILED,
      details: expect.objectContaining({
        status: 500,
      }),
    });
  });

  it('响应缺少 uuid 时应抛出 UploadError', async () => {
    MockXMLHttpRequest.behavior = 'missingUuid';

    await expect(simpleUpload(createRequest())).rejects.toBeInstanceOf(UploadError);
  });

  it('响应 JSON 非法时应透传解析异常', async () => {
    MockXMLHttpRequest.behavior = 'invalidJson';

    await expect(simpleUpload(createRequest())).rejects.toBeInstanceOf(SyntaxError);
  });

  it('appKey 非法时应抛出上传参数错误', async () => {
    await expect(simpleUpload(createRequest({ appKey: 'invalid' }))).rejects.toMatchObject({
      code: ERROR_CODES.UPLOAD_INVALID_APPKEY,
    });
  });
});
