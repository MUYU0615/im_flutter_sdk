import { describe, expect, it } from 'vitest';

import { ERROR_CODES } from '@/utils/error-codes';
import { SDKError, ValidationError } from '@/utils/errors';
import {
  extractFileIdFromUrl,
  mapVoiceToTextError,
  validateVoiceMessageSource,
  validateVoiceSourceFile,
} from '@/rest/speech-helpers';

describe('speech helpers', () => {
  it('extractFileIdFromUrl 应忽略 query 和 hash', () => {
    expect(extractFileIdFromUrl('https://a.com/path/to/file-id.amr?foo=1#bar')).toBe('file-id.amr');
  });

  it('validateVoiceMessageSource 对非法消息体应抛 ValidationError(407)', () => {
    expect(() =>
      validateVoiceMessageSource({
        type: 'text',
      })
    ).toThrowError(ValidationError);

    try {
      validateVoiceMessageSource({
        type: 'text',
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).code).toBe(ERROR_CODES.VOICE_TO_TEXT_FILE_INVALID);
    }
  });

  it('validateVoiceMessageSource 对缺失 url 应抛 SDKError(410)', () => {
    expect(() =>
      validateVoiceMessageSource({
        type: 'voice',
        filename: 'voice.amr',
        filetype: 'audio/amr',
        duration: 1,
      })
    ).toThrowError(SDKError);

    try {
      validateVoiceMessageSource({
        type: 'voice',
        filename: 'voice.amr',
        filetype: 'audio/amr',
        duration: 1,
      });
    } catch (error) {
      expect(error).toBeInstanceOf(SDKError);
      expect((error as SDKError).code).toBe(ERROR_CODES.VOICE_TO_TEXT_FILE_NOT_FOUND);
    }
  });

  it('validateVoiceSourceFile 对 MiniAppFile 应通过', () => {
    const result = validateVoiceSourceFile({
      path: '/tmp/voice.amr',
      name: 'voice.amr',
      type: 'audio/amr',
      size: 12,
    });

    expect(result).toEqual({
      path: '/tmp/voice.amr',
      name: 'voice.amr',
      type: 'audio/amr',
      size: 12,
    });
  });

  it('validateVoiceSourceFile 对 PCM 缺少 voiceParams 不应本地拦截', () => {
    const result = validateVoiceSourceFile(
      {
        path: '/tmp/voice.pcm',
        name: 'voice.pcm',
        type: 'audio/pcm',
      },
      undefined
    );

    expect(result).toEqual({
      path: '/tmp/voice.pcm',
      name: 'voice.pcm',
      type: 'audio/pcm',
    });
  });

  it('mapVoiceToTextError 应将 4001002 映射为 FILE_INVALID(407)', () => {
    const error = mapVoiceToTextError(
      new SDKError('Voice-to-text failed', ERROR_CODES.VOICE_TO_TEXT_FAILED, {
        details: {
          rawResponse: {
            error: {
              code: 4001002,
              message: 'unsupported speech file format',
            },
          },
        },
      })
    );

    expect(error.code).toBe(ERROR_CODES.VOICE_TO_TEXT_FILE_INVALID);
    expect(error.message).toBe('Invalid file');
  });

  it('mapVoiceToTextError 应将 4001001 uploaded file exceeds 映射为 FILE_TOO_LARGE(411)', () => {
    const error = mapVoiceToTextError(
      new SDKError('Voice-to-text failed', ERROR_CODES.VOICE_TO_TEXT_FAILED, {
        details: {
          rawResponse: {
            error: {
              code: 4001001,
              message: 'uploaded file exceeds 10MB limit',
            },
          },
        },
      })
    );

    expect(error.code).toBe(ERROR_CODES.VOICE_TO_TEXT_FILE_TOO_LARGE);
    expect(error.message).toBe('File too large');
  });

  it('mapVoiceToTextError 应将 UploadError 映射为 UPLOAD_REQUEST_FAILED(402)', () => {
    const error = mapVoiceToTextError(
      new SDKError('upload failed', ERROR_CODES.UPLOAD_REQUEST_FAILED, {
        details: {
          rawResponse: {
            error: {
              code: 5021001,
              message: 'upload failed',
            },
          },
        },
      })
    );

    expect(error.code).toBe(ERROR_CODES.UPLOAD_REQUEST_FAILED);
    expect(error.message).toBe('File upload failed');
  });

  it('mapVoiceToTextError 应将 4001001 非超大文件场景映射为 VALIDATION_REQUIRED(110)', () => {
    const error = mapVoiceToTextError(
      new SDKError('Voice-to-text failed', ERROR_CODES.VOICE_TO_TEXT_FAILED, {
        details: {
          rawResponse: {
            error: {
              code: 4001001,
              message: 'missing format parameter',
            },
          },
        },
      })
    );

    expect(error.code).toBe(ERROR_CODES.VALIDATION_REQUIRED);
    expect(error.message).toBe('missing format parameter');
  });

  it('mapVoiceToTextError 应将 4031002 映射为 SERVICE_LIMIT_EXCEEDED(4)', () => {
    const error = mapVoiceToTextError(
      new SDKError('Voice-to-text failed', ERROR_CODES.VOICE_TO_TEXT_FAILED, {
        details: {
          rawResponse: {
            error: {
              code: 4031002,
              message: 'beta service usage limit exceeded',
            },
          },
        },
      })
    );

    expect(error.code).toBe(ERROR_CODES.SERVICE_LIMIT_EXCEEDED);
    expect(error.message).toBe('Beta service usage limit exceeded');
  });

  it('mapVoiceToTextError 应将 4011001 映射为 AUTH_UNAUTHORIZED(202)', () => {
    const error = mapVoiceToTextError(
      new SDKError('Voice-to-text failed', ERROR_CODES.VOICE_TO_TEXT_FAILED, {
        details: {
          rawResponse: {
            error: {
              code: 4011001,
              message: 'unauthorized',
            },
          },
        },
      })
    );

    expect(error.code).toBe(ERROR_CODES.AUTH_UNAUTHORIZED);
    expect(error.message).toBe('unauthorized');
  });
});
