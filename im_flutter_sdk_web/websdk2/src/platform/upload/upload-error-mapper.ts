/**
 * 上传错误映射
 */

import { UploadError } from '../../utils/errors';
import { ERROR_CODES } from '../../utils/error-codes';
import {
  PLATFORM_ERROR_CODE,
  PLATFORM_ERROR_STAGE,
  type PlatformAdapterError,
  type PlatformErrorCode,
  type PlatformErrorStage,
} from '../types';

interface PlatformErrorLike {
  readonly code?: PlatformErrorCode;
  readonly stage?: PlatformErrorStage;
  readonly details?: Record<string, unknown>;
}

const isPlatformErrorLike = (error: unknown): error is PlatformErrorLike => {
  return typeof error === 'object' && error !== null;
};

const isAbortReason = (details?: Record<string, unknown>): boolean => {
  const reason = details?.reason;
  if (typeof reason === 'string' && reason.toLowerCase().includes('abort')) {
    return true;
  }
  return false;
};

const isTimeoutReason = (details?: Record<string, unknown>): boolean => {
  const reason = details?.reason;
  if (typeof reason === 'string' && reason.toLowerCase().includes('timeout')) {
    return true;
  }
  return false;
};

export const mapUploadAdapterError = (error: unknown): UploadError => {
  if (error instanceof UploadError) {
    return error;
  }

  if (isPlatformErrorLike(error)) {
    const details = error.details;
    if (error.code === PLATFORM_ERROR_CODE.MISSING_CAPABILITY) {
      return new UploadError('Upload capability is missing for current platform', {
        code: ERROR_CODES.UPLOAD_REQUIRED_FIELD_MISSING,
        details,
      });
    }
    if (error.stage === PLATFORM_ERROR_STAGE.UPLOAD) {
      if (isAbortReason(details)) {
        return new UploadError('Upload canceled', {
          code: ERROR_CODES.UPLOAD_ABORTED,
          details,
        });
      }
      if (isTimeoutReason(details)) {
        return new UploadError('Upload timeout', {
          code: ERROR_CODES.UPLOAD_TIMEOUT,
          details,
        });
      }
      return new UploadError('Upload failed', {
        code: ERROR_CODES.UPLOAD_REQUEST_FAILED,
        details,
      });
    }
  }

  const message = error instanceof Error ? error.message : 'Upload failed';
  return new UploadError(message, {
    code: ERROR_CODES.UPLOAD_REQUEST_FAILED,
    details: {
      cause: error,
    },
  });
};

export const isPlatformUploadError = (error: unknown): error is PlatformAdapterError => {
  return isPlatformErrorLike(error) && error.stage === PLATFORM_ERROR_STAGE.UPLOAD;
};
