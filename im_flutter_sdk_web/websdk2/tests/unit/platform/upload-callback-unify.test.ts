import { describe, expect, it, vi } from 'vitest';

import {
  PLATFORM_ERROR_CODE,
  PLATFORM_ERROR_STAGE,
  createPlatformError,
  type UploadAdapter,
} from '../../../src/platform';
import { attachmentFileStore } from '../../../src/upload/attachment-file-store';
import { AttachmentUploader } from '../../../src/upload/attachment-uploader';
import type { Message } from '../../../src/types';
import { ERROR_CODES } from '../../../src/utils/error-codes';
import { UploadError } from '../../../src/utils/errors';

const createImageMessage = (msgLocalId: string): Message => {
  return {
    msgServerId: '',
    msgLocalId,
    from: 'u1',
    to: 'u2',
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
};

describe('platform/upload-callback-unify', () => {
  it('上传成功时统一触发进度与完成回调', async () => {
    attachmentFileStore.clear();
    const file = new File([new Uint8Array(10)], 'image.png', { type: 'image/png' });
    const message = createImageMessage('upload-success-1');
    attachmentFileStore.set(message.msgLocalId, file);

    const uploadAdapter: UploadAdapter = {
      upload(config) {
        config.onProgress?.({ loaded: 5, total: 10, percent: 50 });
        config.onProgress?.({ loaded: 10, total: 10, percent: 100 });
        return Promise.resolve({
          status: 200,
          body: JSON.stringify({
            entities: [
              {
                uuid: 'uuid-1',
                'share-secret': 'secret-1',
                'file-metadata': {
                  'content-length': 10,
                  'content-type': 'image/png',
                },
              },
            ],
          }),
        });
      },
    };

    const onProgress = vi.fn();
    const onComplete = vi.fn();
    const uploader = new AttachmentUploader({
      restBaseUrl: 'https://rest.example.com',
      token: 'token',
      appKey: 'org#app',
      uploadAdapter,
    });

    const result = await uploader.prepareMessage(message, {
      onFileUploadProgress: onProgress,
      onFileUploadComplete: onComplete,
    });

    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenNthCalledWith(1, {
      loaded: 5,
      total: 10,
      percent: 50,
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect('localUrl' in result.body ? result.body.localUrl : undefined).toBe('blob:local-image');
    expect('originalImageUrl' in result.body ? result.body.originalImageUrl : undefined).toContain(
      '/chatfiles/uuid-1'
    );
    expect('secret' in result.body ? result.body.secret : undefined).toBe('secret-1');
    expect('fileLength' in result.body ? result.body.fileLength : undefined).toBe(10);
  });

  it('上传中断时统一触发取消与错误回调', async () => {
    attachmentFileStore.clear();
    const file = new File([new Uint8Array(10)], 'image.png', { type: 'image/png' });
    const message = createImageMessage('upload-abort-1');
    attachmentFileStore.set(message.msgLocalId, file);

    const uploadAdapter: UploadAdapter = {
      upload() {
        return Promise.reject(
          createPlatformError('upload abort', {
            code: PLATFORM_ERROR_CODE.UPLOAD_FAILED,
            stage: PLATFORM_ERROR_STAGE.UPLOAD,
            retryable: false,
            details: {
              reason: 'abort',
            },
          })
        );
      },
    };

    const onCanceled = vi.fn();
    const onError = vi.fn<(error: Error) => void>();
    const uploader = new AttachmentUploader({
      restBaseUrl: 'https://rest.example.com',
      token: 'token',
      appKey: 'org#app',
      uploadAdapter,
    });

    await expect(
      uploader.prepareMessage(message, {
        onFileUploadCanceled: onCanceled,
        onFileUploadError: onError,
      })
    ).rejects.toBeInstanceOf(UploadError);

    const firstErrorCall = onError.mock.calls[0];
    const uploadError = firstErrorCall?.[0] as UploadError | undefined;
    expect(uploadError?.code).toBe(ERROR_CODES.UPLOAD_ABORTED);
    expect(onCanceled).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
