import { describe, expect, it } from 'vitest';

import { mapUploadAdapterError, isPlatformUploadError } from '@/platform/upload/upload-error-mapper';
import { createPlatformError, PLATFORM_ERROR_CODE, PLATFORM_ERROR_STAGE } from '@/platform/types';
import { ERROR_CODES } from '@/utils/error-codes';
import { UploadError } from '@/utils/errors';

describe('upload-error-mapper', (): void => {
  it('UploadError 应直接透传', (): void => {
    const original = new UploadError('already upload error', {
      code: ERROR_CODES.UPLOAD_TIMEOUT,
    });

    const mapped = mapUploadAdapterError(original);
    expect(mapped).toBe(original);
  });

  it('缺少能力错误应映射为 UPLOAD_REQUIRED_FIELD_MISSING', (): void => {
    const mapped = mapUploadAdapterError(
      createPlatformError('missing upload', {
        code: PLATFORM_ERROR_CODE.MISSING_CAPABILITY,
        stage: PLATFORM_ERROR_STAGE.INIT,
        retryable: false,
        details: { capability: 'upload' },
      })
    );

    expect(mapped).toBeInstanceOf(UploadError);
    expect(mapped.code).toBe(ERROR_CODES.UPLOAD_REQUIRED_FIELD_MISSING);
  });

  it('UPLOAD 阶段的 abort/timeout/other 应映射到对应错误码', (): void => {
    const abortError = mapUploadAdapterError(
      createPlatformError('aborted', {
        code: PLATFORM_ERROR_CODE.UPLOAD_FAILED,
        stage: PLATFORM_ERROR_STAGE.UPLOAD,
        retryable: false,
        details: { reason: 'Abort by user' },
      })
    );
    expect(abortError.code).toBe(ERROR_CODES.UPLOAD_ABORTED);

    const timeoutError = mapUploadAdapterError(
      createPlatformError('timeout', {
        code: PLATFORM_ERROR_CODE.UPLOAD_FAILED,
        stage: PLATFORM_ERROR_STAGE.UPLOAD,
        retryable: true,
        details: { reason: 'request timeout' },
      })
    );
    expect(timeoutError.code).toBe(ERROR_CODES.UPLOAD_TIMEOUT);

    const failedError = mapUploadAdapterError(
      createPlatformError('failed', {
        code: PLATFORM_ERROR_CODE.UPLOAD_FAILED,
        stage: PLATFORM_ERROR_STAGE.UPLOAD,
        retryable: true,
        details: { reason: 'network error' },
      })
    );
    expect(failedError.code).toBe(ERROR_CODES.UPLOAD_REQUEST_FAILED);
  });

  it('普通 Error/未知输入应映射为 UPLOAD_REQUEST_FAILED 并保留 cause', (): void => {
    const fromError = mapUploadAdapterError(new Error('boom'));
    expect(fromError.code).toBe(ERROR_CODES.UPLOAD_REQUEST_FAILED);
    expect(fromError.message).toBe('boom');
    expect(fromError.details?.cause).toBeInstanceOf(Error);

    const fromUnknown = mapUploadAdapterError('bad');
    expect(fromUnknown.code).toBe(ERROR_CODES.UPLOAD_REQUEST_FAILED);
    expect(fromUnknown.message).toBe('Upload failed');
  });

  it('isPlatformUploadError 应正确识别 stage=upload', (): void => {
    const uploadPlatformError = createPlatformError('upload failed', {
      code: PLATFORM_ERROR_CODE.UPLOAD_FAILED,
      stage: PLATFORM_ERROR_STAGE.UPLOAD,
      retryable: true,
    });
    const requestPlatformError = createPlatformError('request failed', {
      code: PLATFORM_ERROR_CODE.REQUEST_FAILED,
      stage: PLATFORM_ERROR_STAGE.REQUEST,
      retryable: true,
    });

    expect(isPlatformUploadError(uploadPlatformError)).toBe(true);
    expect(isPlatformUploadError(requestPlatformError)).toBe(false);
    expect(isPlatformUploadError(new Error('x'))).toBe(false);
  });
});
