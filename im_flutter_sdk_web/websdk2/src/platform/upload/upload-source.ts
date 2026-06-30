/**
 * 上传源规范化
 */

import type { CompatibleFile, MiniAppFile, ReactNativeFile } from '../../types';
import type { UploadSource } from '../types';

interface NormalizeUploadSourceOptions {
  readonly file: CompatibleFile;
  readonly fallbackName?: string;
  readonly fallbackMimeType?: string;
  readonly fallbackSize?: number;
}

export interface NormalizedUploadSource {
  readonly source: UploadSource;
  readonly fileName: string;
  readonly fileType: string;
  readonly fileSize: number;
  readonly webFile?: File;
}

const DEFAULT_FILE_NAME = 'file';
const DEFAULT_FILE_TYPE = 'application/octet-stream';

const MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
  heic: 'image/heic',
  heif: 'image/heif',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
  aac: 'audio/aac',
  amr: 'audio/amr',
  pdf: 'application/pdf',
  txt: 'text/plain',
  json: 'application/json',
};

const isBrowserFile = (file: CompatibleFile): file is File => {
  return typeof File !== 'undefined' && file instanceof File;
};

const isMiniAppFile = (file: CompatibleFile): file is MiniAppFile => {
  return typeof file === 'object' && file !== null && 'path' in file;
};

const isReactNativeFile = (file: CompatibleFile): file is ReactNativeFile => {
  return typeof file === 'object' && file !== null && 'uri' in file;
};

const normalizePathSegment = (value: string): string => {
  return value.replace(/[?#].*$/, '');
};

const inferFileNameFromPath = (path: string): string | undefined => {
  const normalizedPath = normalizePathSegment(path);
  const parts = normalizedPath.split(/[\\/]/).filter(Boolean);
  const lastPart = parts.at(-1);
  if (!lastPart) {
    return undefined;
  }

  return lastPart;
};

const inferMimeTypeFromName = (fileName: string | undefined): string | undefined => {
  if (!fileName) {
    return undefined;
  }

  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex < 0 || dotIndex === fileName.length - 1) {
    return undefined;
  }

  const extension = fileName.slice(dotIndex + 1).toLowerCase();
  return MIME_TYPE_BY_EXTENSION[extension];
};

const resolveMeta = (options: {
  readonly fileName?: string;
  readonly fileType?: string;
  readonly fileSize?: number;
  readonly fallbackName?: string;
  readonly fallbackMimeType?: string;
  readonly fallbackSize?: number;
}): { fileName: string; fileType: string; fileSize: number } => {
  return {
    fileName: options.fileName ?? options.fallbackName ?? DEFAULT_FILE_NAME,
    fileType: options.fileType ?? options.fallbackMimeType ?? DEFAULT_FILE_TYPE,
    fileSize: options.fileSize ?? options.fallbackSize ?? 0,
  };
};

export const normalizeUploadSource = (
  options: NormalizeUploadSourceOptions
): NormalizedUploadSource => {
  const { file, fallbackName, fallbackMimeType, fallbackSize } = options;

  if (isBrowserFile(file)) {
    const metadata = resolveMeta({
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      fallbackName,
      fallbackMimeType,
      fallbackSize,
    });
    return {
      source: {
        sourceType: 'web-file',
        file,
        name: metadata.fileName,
        mimeType: metadata.fileType,
        size: metadata.fileSize,
      },
      fileName: metadata.fileName,
      fileType: metadata.fileType,
      fileSize: metadata.fileSize,
      webFile: file,
    };
  }

  if (isMiniAppFile(file)) {
    const inferredName = inferFileNameFromPath(file.path);
    const metadata = resolveMeta({
      fileName: file.name ?? inferredName,
      fileType: file.type ?? inferMimeTypeFromName(file.name ?? inferredName),
      fileSize: file.size,
      fallbackName,
      fallbackMimeType,
      fallbackSize,
    });
    return {
      source: {
        sourceType: 'miniapp-path',
        path: file.path,
        name: metadata.fileName,
        mimeType: metadata.fileType,
        size: metadata.fileSize,
      },
      fileName: metadata.fileName,
      fileType: metadata.fileType,
      fileSize: metadata.fileSize,
    };
  }

  if (isReactNativeFile(file)) {
    const inferredName = inferFileNameFromPath(file.uri);
    const metadata = resolveMeta({
      fileName: file.name ?? inferredName,
      fileType: file.type ?? inferMimeTypeFromName(file.name ?? inferredName),
      fileSize: file.size,
      fallbackName,
      fallbackMimeType,
      fallbackSize,
    });
    return {
      source: {
        sourceType: 'rn-uri',
        uri: file.uri,
        name: metadata.fileName,
        mimeType: metadata.fileType,
        size: metadata.fileSize,
      },
      fileName: metadata.fileName,
      fileType: metadata.fileType,
      fileSize: metadata.fileSize,
    };
  }

  const metadata = resolveMeta({
    fallbackName,
    fallbackMimeType,
    fallbackSize,
  });
  return {
    source: {
      sourceType: 'web-file',
      name: metadata.fileName,
      mimeType: metadata.fileType,
      size: metadata.fileSize,
    },
    fileName: metadata.fileName,
    fileType: metadata.fileType,
    fileSize: metadata.fileSize,
  };
};
