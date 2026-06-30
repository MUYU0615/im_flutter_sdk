import type { RequestAdapter } from '../../platform';
import { createWebRequestAdapter } from '../../platform/request/web-request-adapter';
import type {
  FileMessageBody,
  ImageMessageBody,
  Message,
  MessageAttachmentDownloadResult,
  VideoMessageBody,
  VoiceMessageBody,
} from '../../types';
import { appendAttachUrlParams } from '../../upload/utils';
import { ERROR_CODES } from '../../utils/error-codes';
import { AuthenticationError, NetworkError, SDKError, ValidationError } from '../../utils/errors';

const DEFAULT_TIMEOUT_MS = 15_000;

const resolveRequestAdapter = (requestAdapter?: RequestAdapter): RequestAdapter | undefined => {
  if (requestAdapter) {
    return requestAdapter;
  }
  if (typeof fetch !== 'function') {
    return undefined;
  }
  return createWebRequestAdapter({
    fetchImpl: fetch,
  });
};

const normalizeUrl = (message: Message): { url: string; secret?: string } => {
  switch (message.type) {
    case 'image': {
      const body = message.body as ImageMessageBody;
      return {
        url: body.originalImageUrl ?? body.bigImageUrl ?? body.thumbnailUrl ?? '',
        secret: body.secret,
      };
    }
    case 'video':
    case 'voice':
    case 'file': {
      const body = message.body as VideoMessageBody | VoiceMessageBody | FileMessageBody;
      return {
        url: body.url ?? '',
        secret: body.secret,
      };
    }
    default:
      return { url: '' };
  }
};

const resolveFilename = (message: Message): string => {
  switch (message.type) {
    case 'image':
      return (message.body as ImageMessageBody).filename ?? 'image';
    case 'video':
      return (message.body as VideoMessageBody).filename ?? 'video';
    case 'voice':
      return (message.body as VoiceMessageBody).filename ?? 'voice';
    case 'file':
      return (message.body as FileMessageBody).filename ?? 'file';
    default:
      return 'attachment';
  }
};

const resolveMimeType = (message: Message): string => {
  switch (message.type) {
    case 'image':
      return (message.body as ImageMessageBody).filetype ?? 'application/octet-stream';
    case 'video':
      return (message.body as VideoMessageBody).filetype ?? 'application/octet-stream';
    case 'voice':
      return (message.body as VoiceMessageBody).filetype ?? 'application/octet-stream';
    case 'file':
      return (message.body as FileMessageBody).filetype ?? 'application/octet-stream';
    default:
      return 'application/octet-stream';
  }
};

export class AttachmentDownloader {
  private readonly requestAdapter: RequestAdapter | undefined;

  constructor(requestAdapter?: RequestAdapter) {
    this.requestAdapter = resolveRequestAdapter(requestAdapter);
  }

  async download(
    message: Message,
    timeoutMs = DEFAULT_TIMEOUT_MS
  ): Promise<MessageAttachmentDownloadResult> {
    if (
      message.type !== 'image' &&
      message.type !== 'video' &&
      message.type !== 'voice' &&
      message.type !== 'file'
    ) {
      throw new ValidationError('message does not contain downloadable attachment', {
        code: ERROR_CODES.ATTACHMENT_INVALID,
      });
    }

    const { url, secret } = normalizeUrl(message);
    if (!url) {
      throw new ValidationError('attachment url is required', {
        code: ERROR_CODES.ATTACHMENT_INVALID,
      });
    }

    if (!this.requestAdapter) {
      throw new NetworkError('request adapter is required for attachment download');
    }

    const response = await this.requestAdapter.request<ArrayBuffer>({
      url: appendAttachUrlParams(url, secret),
      method: 'GET',
      responseType: 'arraybuffer',
      timeoutMs,
    });

    if (response.status === 401) {
      throw new AuthenticationError('attachment download unauthorized', {
        code: ERROR_CODES.AUTH_UNAUTHORIZED,
      });
    }
    if (response.status === 403) {
      throw new SDKError('attachment download forbidden', ERROR_CODES.AUTH_FORBIDDEN);
    }
    if (response.status === 404) {
      const body = typeof response.data === 'string' ? response.data : '';
      const isExpired = body.includes('expired');
      throw new SDKError(
        isExpired ? 'attachment file is expired' : 'attachment not found',
        isExpired ? ERROR_CODES.ATTACHMENT_EXPIRED : ERROR_CODES.ATTACHMENT_NOT_FOUND
      );
    }
    if (response.status === 429) {
      throw new SDKError('attachment download rate limited', ERROR_CODES.SERVICE_LIMIT_EXCEEDED);
    }
    if (response.status >= 400) {
      throw new SDKError('attachment download failed', ERROR_CODES.FILE_DOWNLOAD_FAILED, {
        details: { status: response.status, url },
      });
    }

    return {
      filename: resolveFilename(message),
      mimeType: resolveMimeType(message),
      size: ((): number | undefined => {
        switch (message.type) {
          case 'image':
            return (message.body as ImageMessageBody).fileLength;
          case 'video':
            return (message.body as VideoMessageBody).fileLength;
          case 'voice':
            return (message.body as VoiceMessageBody).fileLength;
          case 'file':
            return (message.body as FileMessageBody).fileLength ?? (message.body as FileMessageBody).fileSize;
          default:
            return undefined;
        }
      })(),
      data: new Uint8Array(response.data),
      downloadUrl: url,
    };
  }
}
