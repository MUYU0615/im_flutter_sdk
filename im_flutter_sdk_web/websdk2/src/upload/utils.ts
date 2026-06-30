import {
  normalizeUploadSource,
  type NormalizedUploadSource,
} from '../platform/upload/upload-source';
import type { CompatibleFile, ImageMessageBody, ImageType } from '../types';
import { ERROR_CODES } from '../utils/error-codes';
import { UploadError } from '../utils/errors';
import { FILE_CONVERSATION_TYPES } from './constants';
import type {
  AttachmentMessageBody,
  AttachmentMessageType,
  AttachmentPrecheckDecision,
  AttachmentPrecheckResult,
  AttachmentPrecheckThresholdType,
  ImageSendPolicy,
  UploadResponsePayload,
} from './types';

const LOCAL_URL_PREFIXES = ['blob:', 'data:', 'file:', 'wxfile:', 'appfile:'];
export type ProtocolImageType = 1 | 2;

export const IMAGE_TYPE_ORIGINAL: ImageType = 'original';
export const IMAGE_TYPE_LARGE: ImageType = 'large';
export const PROTOCOL_IMAGE_TYPE_ORIGINAL: ProtocolImageType = 1;
export const PROTOCOL_IMAGE_TYPE_LARGE: ProtocolImageType = 2;
export const IMAGE_PRECHECK_ORIGINAL_THRESHOLD = 200 * 1024;
export const ATTACHMENT_PRECHECK_THRESHOLD = 1024 * 1024;

export const isRemoteUrl = (url: string): boolean => /^https?:\/\//i.test(url);

export const isLocalUrl = (url: string): boolean =>
  LOCAL_URL_PREFIXES.some(prefix => url.startsWith(prefix));

export const shouldUploadByUrl = (url: string | undefined, hasData: boolean): boolean => {
  if (hasData) {
    return true;
  }
  if (!url) {
    return true;
  }
  return !isRemoteUrl(url);
};

export const parseAppKey = (appKey: string): { orgName: string; appName: string } => {
  const parts = appKey.split('#');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new UploadError('Invalid appKey for upload', {
      code: ERROR_CODES.UPLOAD_INVALID_APPKEY,
      details: {
        appKey,
      },
    });
  }
  return { orgName: parts[0], appName: parts[1] };
};

export const toUploadChatType = (conversationType: string): string => {
  if (conversationType === 'singleChat') {
    return FILE_CONVERSATION_TYPES.single;
  }
  if (conversationType === 'groupChat') {
    return FILE_CONVERSATION_TYPES.group;
  }
  return FILE_CONVERSATION_TYPES.room;
};

const setUrlSizeQuery = (url: string, size: 'large' | 'small'): string => {
  return appendUrlQueryParams(url, {
    size,
  });
};

const stripImageVariant = (url: string): string => {
  const [mainPart = '', hashPart] = url.split('#', 2);
  const [basePath, queryString = ''] = mainPart.split('?', 2);
  const filteredQuery = queryString
    .split('&')
    .filter(Boolean)
    .filter(entry => {
      const [rawKey = '', rawValue = ''] = entry.split('=', 2);
      const key = safeDecodeQueryComponent(rawKey);
      const value = safeDecodeQueryComponent(rawValue);
      if (key !== 'size') {
        return true;
      }
      return !['big', 'large', 'thumbnail', 'small'].includes(value);
    })
    .join('&');

  return `${basePath}${filteredQuery ? `?${filteredQuery}` : ''}${hashPart ? `#${hashPart}` : ''}`;
};

const safeDecodeQueryComponent = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export const appendUrlQueryParams = (
  url: string,
  params: Record<string, string | number | undefined>
): string => {
  const [mainPart = '', hashPart] = url.split('#', 2);
  const [basePath, queryString = ''] = mainPart.split('?', 2);
  const entries = queryString.split('&').filter(Boolean);

  Object.entries(params).forEach(([key, value]) => {
    const encodedKey = encodeURIComponent(key);
    const nextEntries = entries.filter(entry => {
      const [rawKey = ''] = entry.split('=', 2);
      return rawKey !== encodedKey && safeDecodeQueryComponent(rawKey) !== key;
    });
    entries.length = 0;
    entries.push(...nextEntries);
    if (value !== undefined) {
      entries.push(`${encodedKey}=${encodeURIComponent(String(value))}`);
    }
  });

  return `${basePath}${entries.length > 0 ? `?${entries.join('&')}` : ''}${hashPart ? `#${hashPart}` : ''}`;
};

// 为附件访问 URL 追加 em-redirect=true 和 share-secret
export const appendAttachUrlParams = (url: string, secret?: string): string => {
  if (!url) return '';
  const params: Record<string, string | number | undefined> = {};
  if (!url.includes('em-redirect')) {
    params['em-redirect'] = 'true';
  }
  if (secret && !url.includes('share-secret=')) {
    params['share-secret'] = secret;
  }
  if (Object.keys(params).length === 0) return url;
  return appendUrlQueryParams(url, params);
};

export const resolveImageSendPolicy = (body: ImageMessageBody): ImageSendPolicy => {
  // GIF 一律保持原图语义；普通图片未显式指定时默认按大图发送。
  if (body.isGif) {
    return {
      resolvedImageType: IMAGE_TYPE_ORIGINAL,
      reason: 'gif-force-origin',
    };
  }

  if (body.isOriginalImage) {
    return {
      resolvedImageType: IMAGE_TYPE_ORIGINAL,
      reason: 'explicit-original',
    };
  }

  return {
    resolvedImageType: IMAGE_TYPE_LARGE,
    reason: 'default-large',
  };
};

export const resolvePrecheckThresholdType = (
  messageType: AttachmentMessageType,
  imageType?: ImageType
): AttachmentPrecheckThresholdType => {
  if (messageType !== 'image') {
    return 'attachment';
  }

  return imageType === IMAGE_TYPE_ORIGINAL ? 'image-origin' : 'image-big';
};

export const resolvePrecheckThresholdBytes = (
  thresholdType: AttachmentPrecheckThresholdType
): number => {
  if (thresholdType === 'image-origin') {
    return IMAGE_PRECHECK_ORIGINAL_THRESHOLD;
  }
  return ATTACHMENT_PRECHECK_THRESHOLD;
};

export const buildAttachmentPrecheckDecision = (options: {
  messageType: AttachmentMessageType;
  fileSize: number;
  imageType?: ImageType;
}): AttachmentPrecheckDecision => {
  // 这里只负责判断“要不要打 exists 预检”，不参与 simple/multipart 的最终上传选择。
  const thresholdType = resolvePrecheckThresholdType(options.messageType, options.imageType);
  const thresholdBytes = resolvePrecheckThresholdBytes(thresholdType);
  const shouldPrecheck = options.fileSize > thresholdBytes;
  return {
    shouldPrecheck,
    thresholdType,
    thresholdBytes,
    actualBytes: options.fileSize,
    reason: shouldPrecheck ? 'threshold-exceeded' : 'below-threshold',
  };
};

export const isAttachmentPrecheckHit = (result: {
  exists: boolean;
  uuid?: string;
  shareSecret?: string;
}): boolean => {
  return result.exists && typeof result.uuid === 'string' && result.uuid.length > 0;
};

export const parseAttachmentPrecheckResult = (
  payload: UploadResponsePayload
): AttachmentPrecheckResult => {
  // 029 的命中规则是 exists=true 且带 uuid；share-secret 只是可选密钥，不再是命中前提。
  const entity = payload.entities?.[0];
  const exists = entity?.exists === true;
  const uuid = typeof entity?.uuid === 'string' && entity.uuid.length > 0 ? entity.uuid : undefined;
  const entityRecord = entity as Record<string, unknown> | undefined;
  const rawExistsType = entityRecord?.['exists-type'] ?? entityRecord?.existsType;
  const existsType =
    rawExistsType === 'origin'
      ? IMAGE_TYPE_ORIGINAL
      : rawExistsType === IMAGE_TYPE_LARGE || rawExistsType === IMAGE_TYPE_ORIGINAL
        ? rawExistsType
        : undefined;
  const shareSecret =
    typeof entity?.['share-secret'] === 'string' ? entity['share-secret'] : undefined;
  if (exists && !uuid) {
    throw new UploadError('Upload precheck response missing uuid', {
      code: ERROR_CODES.UPLOAD_REQUEST_FAILED,
      details: {
        response: payload,
      },
    });
  }

  return {
    uuid,
    exists,
    existsType,
    shareSecret,
    hit: isAttachmentPrecheckHit({ exists, uuid, shareSecret }),
  };
};

export const deriveImageUrls = (
  remotePath: string,
  options?: {
    deriveVariants?: boolean;
  }
): {
  originalImageUrl?: string;
  bigImageUrl?: string;
  thumbnailUrl?: string;
} => {
  // 默认模式下统一从 canonical remotePath 派生三条图片 URL；自有上传模式只保留 original。
  if (!remotePath) {
    return {};
  }

  if (options?.deriveVariants === false) {
    return {
      originalImageUrl: remotePath,
    };
  }

  const baseUrl = stripImageVariant(remotePath);
  const bigImageUrl = setUrlSizeQuery(baseUrl, 'large');
  const thumbnailUrl = setUrlSizeQuery(baseUrl, 'small');
  return {
    originalImageUrl: baseUrl,
    bigImageUrl,
    thumbnailUrl,
  };
};

export const toUploadImageType = (imageType: ImageType | undefined): 'origin' | 'large' => {
  return imageType === IMAGE_TYPE_ORIGINAL ? 'origin' : 'large';
};

export const toProtocolImageType = (imageType: ImageType | undefined): ProtocolImageType => {
  return imageType === IMAGE_TYPE_ORIGINAL
    ? PROTOCOL_IMAGE_TYPE_ORIGINAL
    : PROTOCOL_IMAGE_TYPE_LARGE;
};

export const fromProtocolImageType = (imageType: unknown): ImageType => {
  return imageType === PROTOCOL_IMAGE_TYPE_LARGE ? IMAGE_TYPE_LARGE : IMAGE_TYPE_ORIGINAL;
};

export const buildUploadResult = (options: {
  response: UploadResponsePayload;
  restBaseUrl: string;
  orgName: string;
  appName: string;
  fileType: string;
  fileName: string;
  fallbackSize: number;
  messageType: AttachmentMessageType;
  imageType?: ImageType;
  width?: number;
  height?: number;
  useCustomAttachmentUpload?: boolean;
}): {
  url?: string;
  isOriginalImage?: boolean;
  originalImageUrl?: string;
  bigImageUrl?: string;
  secret?: string;
  fileLength?: number;
  filetype?: string;
  filename?: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
} => {
  // 上传返回统一收敛到 SDK 自己的图片/附件视图，避免把服务端响应结构直接暴露给业务侧。
  const entity = options.response.entities?.[0];
  if (!entity?.uuid) {
    throw new UploadError('Upload response missing uuid', {
      code: ERROR_CODES.UPLOAD_REQUEST_FAILED,
      details: {
        response: options.response,
      },
    });
  }

  const secret = entity['share-secret'];
  const metadata: Record<string, unknown> = entity['file-metadata'] ?? {}; // 读取文件元数据
  const fileLength =
    typeof metadata['content-length'] === 'number'
      ? metadata['content-length']
      : options.fallbackSize;
  const filetype =
    typeof metadata['content-type'] === 'string' ? metadata['content-type'] : options.fileType;
  const baseUrl = `${options.restBaseUrl}/${options.orgName}/${options.appName}/chatfiles/${entity.uuid}`;
  const isImage = options.messageType === 'image';
  if (isImage) {
    const imageType = options.imageType ?? IMAGE_TYPE_LARGE;
    const isOriginalImage = imageType === IMAGE_TYPE_ORIGINAL;
    const imageUrls = deriveImageUrls(baseUrl, {
      deriveVariants: !options.useCustomAttachmentUpload,
    });
    return {
      ...imageUrls,
      isOriginalImage,
      secret,
      fileLength,
      filetype,
      filename: options.fileName,
      width: options.width,
      height: options.height,
    };
  }

  const isVideo = options.messageType === 'video';
  const thumbnailUrl = isVideo ? `${baseUrl}?vframe=true` : undefined;

  return {
    url: baseUrl,
    secret,
    fileLength,
    filetype,
    filename: options.fileName,
    thumbnailUrl,
  };
};

export const normalizeAttachmentFile = (
  file: CompatibleFile | undefined,
  body: AttachmentMessageBody
): NormalizedUploadSource => {
  if (!file) {
    throw new UploadError('Attachment file is required', {
      code: ERROR_CODES.UPLOAD_REQUIRED_FIELD_MISSING,
      details: {
        reason: 'file missing',
      },
    });
  }

  const fallbackSize =
    (typeof body.fileLength === 'number' ? body.fileLength : undefined) ??
    ('fileSize' in body && typeof body.fileSize === 'number' ? body.fileSize : undefined);

  const normalized = normalizeUploadSource({
    file,
    fallbackName: body.filename,
    fallbackMimeType: body.filetype,
    fallbackSize,
  });

  if (normalized.source.sourceType === 'web-file' && !normalized.webFile) {
    throw new UploadError('Attachment file is required', {
      code: ERROR_CODES.UPLOAD_REQUIRED_FIELD_MISSING,
      details: {
        reason: 'web file missing',
      },
    });
  }

  return normalized;
};
