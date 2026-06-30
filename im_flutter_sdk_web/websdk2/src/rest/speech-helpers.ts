import type { RestClient } from './client';
import type { RestContext } from '../types/chat-client';
import type {
  MiniAppFile,
  VoiceMessageBody,
  VoiceParams,
  VoiceSourceFile,
  VoiceToTextResult,
} from '../types';
import { normalizeUploadSource } from '../platform/upload/upload-source';
import { mapUploadAdapterError } from '../platform/upload/upload-error-mapper';
import { ERROR_CODES } from '../utils/error-codes';
import {
  AuthenticationError,
  SDKError,
  UploadError,
  ValidationError,
  type ErrorDetails,
} from '../utils/errors';
import { parseAppKey } from '../upload/utils';

interface SpeechErrorData {
  readonly error?: {
    readonly code?: string | number;
    readonly message?: string;
  };
}

interface SpeechTextResponseData {
  readonly text?: string;
}

interface SpeechResponseEnvelope {
  readonly data?: SpeechTextResponseData;
  readonly error?: SpeechErrorData['error'];
}

interface UploadLike {
  upload(config: {
    readonly url: string;
    readonly headers?: Record<string, string>;
    readonly source: ReturnType<typeof normalizeUploadSource>['source'];
    readonly fields?: Record<string, string>;
    readonly timeoutMs?: number;
  }): Promise<{
    readonly status: number;
    readonly body: string;
  }>;
}

const VOICE_TYPE = 'voice' as const;

const buildBaseUrl = (context: RestContext): string => {
  const { orgName, appName } = parseAppKey(context.appKey);
  return `/api/sdk/v1/${orgName}/${appName}`;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const isVoiceMessageBody = (value: unknown): value is VoiceMessageBody => {
  if (!isRecord(value)) {
    return false;
  }
  if (typeof value.filename !== 'string' || typeof value.filetype !== 'string') {
    return false;
  }
  if (typeof value.duration !== 'number') {
    return false;
  }
  if ('type' in value && value.type !== undefined && value.type !== VOICE_TYPE) {
    return false;
  }
  return true;
};

const isMiniAppVoiceFile = (value: unknown): value is MiniAppFile => {
  return isRecord(value) && typeof value.path === 'string' && value.path.trim().length > 0;
};

const isBrowserFile = (value: unknown): value is File => {
  return typeof File !== 'undefined' && value instanceof File;
};

const isVoiceSourceFile = (value: unknown): value is VoiceSourceFile => {
  return isBrowserFile(value) || isMiniAppVoiceFile(value);
};

const parseSpeechEnvelope = (value: unknown): SpeechResponseEnvelope | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  const data = isRecord(value.data) ? value.data : undefined;
  const error = isRecord(value.error) ? value.error : undefined;
  return {
    data: data as SpeechTextResponseData | undefined,
    error: error as SpeechErrorData['error'] | undefined,
  };
};

const extractText = (response: unknown, apiName: string): string => {
  const envelope = parseSpeechEnvelope(response);
  const text = envelope?.data?.text;
  if (typeof text !== 'string') {
    throw new SDKError(`${apiName} response data is invalid`, ERROR_CODES.REST_BUSINESS_UNKNOWN, {
      details: {
        api: apiName,
        response,
      },
    });
  }
  return text;
};

const createValidationError = (
  message: string,
  code: number,
  path: string,
  rule = 'invalid'
): ValidationError => {
  return new ValidationError(message, {
    code,
    details: {
      fields: [
        {
          path,
          message,
          rule,
        },
      ],
    },
  });
};

const createCompatError = (
  message: string,
  code: number,
  details?: ErrorDetails,
  kind: 'auth' | 'validation' | 'sdk' = 'sdk'
): SDKError => {
  if (kind === 'auth') {
    return new AuthenticationError(message, {
      code,
      details,
    });
  }
  if (kind === 'validation') {
    return new ValidationError(message, {
      code,
      details,
    });
  }
  return new SDKError(message, code, { details });
};

const isInvalidVoiceParams = (voiceParams?: VoiceParams): boolean => {
  if (voiceParams !== undefined && (!isRecord(voiceParams) || Array.isArray(voiceParams))) {
    return true;
  }
  if (voiceParams?.format !== undefined && typeof voiceParams.format !== 'string') {
    return true;
  }
  if (voiceParams?.sampleRate !== undefined && typeof voiceParams.sampleRate !== 'number') {
    return true;
  }
  if (voiceParams?.bitsPerSample !== undefined && typeof voiceParams.bitsPerSample !== 'number') {
    return true;
  }
  if (voiceParams?.channels !== undefined && typeof voiceParams.channels !== 'number') {
    return true;
  }
  return false;
};

export const extractFileIdFromUrl = (url?: string): string | undefined => {
  if (!url) {
    return undefined;
  }
  const pathname = url.split('#')[0]?.split('?')[0] ?? '';
  const parts = pathname.split('/').filter(Boolean);
  return parts.at(-1);
};

const parseSpeechServiceError = (
  error: unknown
): { readonly serviceCode?: string; readonly serviceMessage?: string } => {
  const details =
    error instanceof SDKError && isRecord(error.details)
      ? (error.details as Record<string, unknown>)
      : undefined;
  const payload = details?.rawResponse ?? details?.response ?? error;
  const envelope = parseSpeechEnvelope(payload);
  const rawServiceCode = envelope?.error?.code;
  return {
    serviceCode:
      typeof rawServiceCode === 'string' || typeof rawServiceCode === 'number'
        ? String(rawServiceCode)
        : undefined,
    serviceMessage:
      typeof envelope?.error?.message === 'string' ? envelope.error.message : undefined,
  };
};

const isSpeechFileTooLargeMessage = (message?: string): boolean => {
  return typeof message === 'string' && message.toLowerCase().includes('uploaded file exceeds');
};

export const mapVoiceToTextError = (error: unknown): SDKError => {
  const { serviceCode, serviceMessage } = parseSpeechServiceError(error);

  if (error instanceof UploadError) {
    return createCompatError('File upload failed', ERROR_CODES.UPLOAD_REQUEST_FAILED, {
      cause: error.details,
    });
  }

  if (error instanceof SDKError && !serviceCode) {
    return error;
  }
  if (serviceCode) {
    switch (serviceCode) {
      case '4041001':
        return createCompatError('File not found', ERROR_CODES.VOICE_TO_TEXT_FILE_NOT_FOUND, {
          serviceCode,
          serviceMessage,
        });
      case '4001002':
        return createCompatError(
          'Invalid file',
          ERROR_CODES.VOICE_TO_TEXT_FILE_INVALID,
          {
            serviceCode,
            serviceMessage,
          },
          'validation'
        );
      case '5021001':
        return createCompatError('File upload failed', ERROR_CODES.UPLOAD_REQUEST_FAILED, {
          serviceCode,
          serviceMessage,
        });
      case '4001003':
        return createCompatError(
          'Voice duration exceeds 60 seconds',
          ERROR_CODES.VOICE_TO_TEXT_FILE_DURATION_TOO_LONG,
          {
            serviceCode,
            serviceMessage,
          },
          'validation'
        );
      case '4031001':
        return createCompatError('Service not enabled', ERROR_CODES.SERVICE_NOT_ENABLED, {
          serviceCode,
          serviceMessage,
        });
      case '4031002':
        return createCompatError(
          'Beta service usage limit exceeded',
          ERROR_CODES.SERVICE_LIMIT_EXCEEDED,
          {
            serviceCode,
            serviceMessage,
          }
        );
      case '4001001':
        if (isSpeechFileTooLargeMessage(serviceMessage)) {
          return createCompatError('File too large', ERROR_CODES.VOICE_TO_TEXT_FILE_TOO_LARGE, {
            serviceCode,
            serviceMessage,
          });
        }
        return createCompatError(
          serviceMessage || 'Missing or invalid request parameter',
          ERROR_CODES.VALIDATION_REQUIRED,
          {
            serviceCode,
            serviceMessage,
          },
          'validation'
        );
      case '5021003':
      case '5001003':
        return createCompatError('Voice-to-text failed', ERROR_CODES.VOICE_TO_TEXT_FAILED, {
          serviceCode,
          serviceMessage,
        });
      case '4011001':
        return createCompatError(
          serviceMessage || 'Unauthorized or invalid token',
          ERROR_CODES.AUTH_UNAUTHORIZED,
          {
            serviceCode,
            serviceMessage,
          },
          'auth'
        );
      default:
        return createCompatError(
          serviceMessage || (error instanceof Error ? error.message : 'Voice-to-text failed'),
          ERROR_CODES.VOICE_TO_TEXT_FAILED,
          {
            serviceCode,
            serviceMessage,
          }
        );
    }
  }

  if (error instanceof SDKError) {
    return createCompatError(error.message, error.code, error.details);
  }

  return createCompatError(
    error instanceof Error ? error.message : 'Voice-to-text failed',
    ERROR_CODES.VOICE_TO_TEXT_FAILED
  );
};

export const validateVoiceMessageSource = (
  voiceMessageBody: unknown,
  voiceParams?: VoiceParams
): VoiceMessageBody => {
  if (!isVoiceMessageBody(voiceMessageBody)) {
    throw createCompatError(
      'Invalid file',
      ERROR_CODES.VOICE_TO_TEXT_FILE_INVALID,
      {
        path: 'voiceMessageBody',
      },
      'validation'
    );
  }
  if (isInvalidVoiceParams(voiceParams)) {
    throw createCompatError(
      'Invalid file',
      ERROR_CODES.VOICE_TO_TEXT_FILE_INVALID,
      {
        path: 'voiceParams',
      },
      'validation'
    );
  }
  if (!voiceMessageBody.url) {
    throw createCompatError('File not found', ERROR_CODES.VOICE_TO_TEXT_FILE_NOT_FOUND, {
      path: 'voiceMessageBody.url',
    });
  }
  const fileId = extractFileIdFromUrl(voiceMessageBody.url);
  if (!fileId) {
    throw createCompatError(
      'Invalid file',
      ERROR_CODES.VOICE_TO_TEXT_FILE_INVALID,
      {
        path: 'voiceMessageBody.url',
      },
      'validation'
    );
  }
  return voiceMessageBody;
};

export const validateVoiceSourceFile = (
  file: unknown,
  voiceParams?: VoiceParams
): VoiceSourceFile => {
  if (isInvalidVoiceParams(voiceParams)) {
    throw createCompatError(
      'Invalid file',
      ERROR_CODES.VOICE_TO_TEXT_FILE_INVALID,
      {
        path: 'voiceParams',
      },
      'validation'
    );
  }
  if (!isVoiceSourceFile(file)) {
    throw createCompatError(
      'Invalid file',
      ERROR_CODES.VOICE_TO_TEXT_FILE_INVALID,
      {
        path: 'file',
      },
      'validation'
    );
  }
  return file;
};

export const requestVoiceMessageToText = async (
  client: RestClient,
  context: RestContext,
  voiceMessageBody: VoiceMessageBody,
  voiceParams?: VoiceParams
): Promise<VoiceToTextResult> => {
  const validated = validateVoiceMessageSource(voiceMessageBody, voiceParams);
  const fileId = extractFileIdFromUrl(validated.url);
  if (!fileId) {
    throw createValidationError(
      'File not found',
      ERROR_CODES.VOICE_TO_TEXT_FILE_NOT_FOUND,
      'voiceMessageBody.url'
    );
  }
  try {
    const response = await client.post<unknown>(
      `${buildBaseUrl(context)}/speech/transcriptions`,
      {
        data: {
          fileId,
          username: context.userId,
          ...(voiceParams ? { audio: voiceParams } : {}),
        },
      },
      { operation: 'voiceMessageToText' }
    );
    return {
      text: extractText(response, 'voiceMessageToText'),
    };
  } catch (error) {
    throw mapVoiceToTextError(error);
  }
};

export const requestVoiceFileToText = async (
  uploadAdapter: UploadLike,
  context: RestContext,
  file: VoiceSourceFile,
  voiceParams?: VoiceParams
): Promise<VoiceToTextResult> => {
  const validated = validateVoiceSourceFile(file, voiceParams);
  const normalized = normalizeUploadSource({
    file: validated,
    fallbackName: isMiniAppVoiceFile(validated) ? 'voice.amr' : undefined,
    fallbackMimeType: 'audio/amr',
  });
  try {
    const response = await uploadAdapter.upload({
      url: `${context.restBaseUrl}${buildBaseUrl(context)}/speech/recognitions`,
      headers: {
        Authorization: `Bearer ${context.token}`,
        Accept: 'application/json',
      },
      source: normalized.source,
      fields: {
        username: context.userId,
        ...(voiceParams?.format ? { format: voiceParams.format } : {}),
        ...(voiceParams?.sampleRate !== undefined
          ? { sampleRate: String(voiceParams.sampleRate) }
          : {}),
        ...(voiceParams?.bitsPerSample !== undefined
          ? { bitsPerSample: String(voiceParams.bitsPerSample) }
          : {}),
        ...(voiceParams?.channels !== undefined ? { channels: String(voiceParams.channels) } : {}),
      },
    });
    let parsedBody: unknown = response.body;
    try {
      parsedBody = JSON.parse(response.body);
    } catch {
      parsedBody = response.body;
    }
    if (response.status < 200 || response.status >= 300) {
      throw new SDKError('Voice-to-text failed', ERROR_CODES.VOICE_TO_TEXT_FAILED, {
        details: {
          httpStatus: response.status,
          rawResponse: parsedBody,
        },
      });
    }
    return {
      text: extractText(parsedBody, 'voiceFileToText'),
    };
  } catch (error) {
    if (error instanceof SDKError) {
      throw mapVoiceToTextError(error);
    }
    throw mapVoiceToTextError(mapUploadAdapterError(error));
  }
};
