import {
  PLATFORM_ERROR_CODE,
  PLATFORM_ERROR_STAGE,
  createPlatformError,
  type GeneratedImageResult,
  type ImageGenerateOptions,
  type ImageInfoResult,
  type ImageProcessor,
  type UploadSource,
} from '../types';
import { computeMd5Hex } from '../../utils/md5';

interface MiniAppReadFileSuccessResult {
  readonly data: string | ArrayBuffer;
}

interface MiniAppGetFileInfoSuccessResult {
  readonly size: number;
}

interface MiniAppFileSystemManagerLike {
  readFile(options: {
    readonly filePath: string;
    readonly success: (result: MiniAppReadFileSuccessResult) => void;
    readonly fail?: (error: unknown) => void;
  }): void;
  getFileInfo?(options: {
    readonly filePath: string;
    readonly success: (result: MiniAppGetFileInfoSuccessResult) => void;
    readonly fail?: (error: unknown) => void;
  }): void;
}

interface MiniAppImageInfoResponse {
  readonly width: number;
  readonly height: number;
  readonly type?: string;
  readonly path?: string;
}

export interface MiniAppImageRuntimeLike {
  getImageInfo(options: {
    readonly src: string;
    readonly success: (result: MiniAppImageInfoResponse) => void;
    readonly fail?: (error: unknown) => void;
  }): void;
  compressImage?(options: {
    readonly src: string;
    readonly quality?: number;
    readonly compressedWidth?: number;
    readonly compressedHeight?: number;
    readonly success?: (result: { readonly tempFilePath: string }) => void;
    readonly fail?: (error: unknown) => void;
  }): void;
  getFileSystemManager?(): MiniAppFileSystemManagerLike;
}

const isMiniAppPathSource = (source: UploadSource): source is UploadSource & {
  sourceType: 'miniapp-path';
  path: string;
} => {
  return source.sourceType === 'miniapp-path' && typeof source.path === 'string' && source.path.length > 0;
};

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'object' && error !== null && 'errMsg' in error) {
    const errMsg = (error as { errMsg?: unknown }).errMsg;
    if (typeof errMsg === 'string') {
      return errMsg;
    }
  }
  return String(error);
};

const isHttpTempPath = (path: string): boolean => /^https?:\/\/tmp\//i.test(path);

const getMiniAppPath = (source: UploadSource): string => {
  if (!isMiniAppPathSource(source)) {
    throw createPlatformError('Miniapp image processor only supports miniapp path source', {
      code: PLATFORM_ERROR_CODE.MISSING_CAPABILITY,
      stage: PLATFORM_ERROR_STAGE.RUNTIME,
      retryable: false,
      details: {
        sourceType: source.sourceType,
      },
    });
  }
  return source.path;
};

const getFileSystemManager = (runtime: MiniAppImageRuntimeLike): MiniAppFileSystemManagerLike => {
  const manager = runtime.getFileSystemManager?.();
  if (manager) {
    return manager;
  }
  throw createPlatformError('Miniapp file system capability is missing', {
    code: PLATFORM_ERROR_CODE.MISSING_CAPABILITY,
    stage: PLATFORM_ERROR_STAGE.RUNTIME,
    retryable: false,
    details: {
      capability: 'getFileSystemManager',
    },
  });
};

const readFileAsBytes = async (
  runtime: MiniAppImageRuntimeLike,
  filePath: string
): Promise<Uint8Array> => {
  const fileSystemManager = getFileSystemManager(runtime);
  const data = await new Promise<string | ArrayBuffer>((resolve, reject) => {
    fileSystemManager.readFile({
      filePath,
      success: result => {
        resolve(result.data);
      },
      fail: error => {
        reject(error instanceof Error ? error : new Error(toErrorMessage(error)));
      },
    });
  }).catch(error => {
    throw createPlatformError('Miniapp file read failed', {
      code: PLATFORM_ERROR_CODE.UPLOAD_FAILED,
      stage: PLATFORM_ERROR_STAGE.RUNTIME,
      retryable: false,
      details: {
        filePath,
        cause: toErrorMessage(error),
      },
    });
  });

  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }

  if (typeof TextEncoder === 'function') {
    return new TextEncoder().encode(data);
  }

  return Uint8Array.from(Array.from(data).map(char => char.charCodeAt(0) & 0xff));
};

const readFileSize = async (
  runtime: MiniAppImageRuntimeLike,
  filePath: string,
  fallbackSize: number | undefined
): Promise<number | undefined> => {
  const fileSystemManager = getFileSystemManager(runtime);
  if (!fileSystemManager.getFileInfo) {
    return fallbackSize;
  }

  return new Promise<number | undefined>((resolve, reject) => {
    fileSystemManager.getFileInfo?.({
      filePath,
      success: result => {
        resolve(result.size);
      },
      fail: error => {
        reject(error instanceof Error ? error : new Error(toErrorMessage(error)));
      },
    });
  }).catch(error => {
    throw createPlatformError('Miniapp file info read failed', {
      code: PLATFORM_ERROR_CODE.UPLOAD_FAILED,
      stage: PLATFORM_ERROR_STAGE.RUNTIME,
      retryable: false,
      details: {
        filePath,
        cause: toErrorMessage(error),
      },
    });
  });
};

const resolveMimeType = (imageType: string | undefined): string | undefined => {
  if (!imageType) {
    return undefined;
  }
  const normalized = imageType.toLowerCase();
  return normalized.startsWith('image/') ? normalized : `image/${normalized}`;
};

const resolveScaledSize = (
  width: number,
  height: number,
  maxShortEdge: number
): { width: number; height: number } => {
  const shortEdge = Math.min(width, height);
  if (shortEdge <= maxShortEdge) {
    return { width, height };
  }

  const scale = maxShortEdge / shortEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
};

const getImageInfo = async (
  runtime: MiniAppImageRuntimeLike,
  src: string
): Promise<MiniAppImageInfoResponse> => {
  return new Promise<MiniAppImageInfoResponse>((resolve, reject) => {
    runtime.getImageInfo({
      src,
      success: result => {
        resolve(result);
      },
      fail: error => {
        reject(error instanceof Error ? error : new Error(toErrorMessage(error)));
      },
    });
  }).catch(error => {
    throw createPlatformError('Miniapp image info read failed', {
      code: PLATFORM_ERROR_CODE.UPLOAD_FAILED,
      stage: PLATFORM_ERROR_STAGE.RUNTIME,
      retryable: false,
      details: {
        src,
        cause: toErrorMessage(error),
      },
    });
  });
};

const resolveImageInfoPath = (src: string, imageInfo: MiniAppImageInfoResponse): string => {
  if (typeof imageInfo.path === 'string' && imageInfo.path.length > 0) {
    return imageInfo.path;
  }
  return src;
};

const normalizeMiniAppLocalPath = async (
  runtime: MiniAppImageRuntimeLike,
  path: string
): Promise<string> => {
  if (!isHttpTempPath(path)) {
    return path;
  }

  const imageInfo = await getImageInfo(runtime, path);
  return resolveImageInfoPath(path, imageInfo);
};

export const createMiniAppImageProcessor = (
  runtime: MiniAppImageRuntimeLike
): ImageProcessor => {
  return {
    async getImageInfo(source: UploadSource): Promise<ImageInfoResult> {
      const path = getMiniAppPath(source);
      const imageInfo = await getImageInfo(runtime, path);
      const mimeType = resolveMimeType(imageInfo.type) ?? source.mimeType;

      return {
        width: imageInfo.width,
        height: imageInfo.height,
        mimeType,
        fileSize: source.size,
        isGif: mimeType === 'image/gif',
      };
    },

    async generateBigImage(
      source: UploadSource,
      options: ImageGenerateOptions
    ): Promise<GeneratedImageResult> {
      const path = getMiniAppPath(source);
      if (typeof runtime.compressImage !== 'function') {
        throw createPlatformError('Miniapp image compress capability is missing', {
          code: PLATFORM_ERROR_CODE.MISSING_CAPABILITY,
          stage: PLATFORM_ERROR_STAGE.RUNTIME,
          retryable: false,
          details: {
            capability: 'compressImage',
          },
        });
      }

      const originalInfo = await getImageInfo(runtime, path);
      const normalizedPath = resolveImageInfoPath(path, originalInfo);
      const scaledSize = resolveScaledSize(
        originalInfo.width,
        originalInfo.height,
        options.maxShortEdge
      );

      const compressedPath = await new Promise<string>((resolve, reject) => {
        runtime.compressImage?.({
          src: normalizedPath,
          quality: Math.max(0, Math.min(100, Math.round(options.quality * 100))),
          compressedWidth: scaledSize.width,
          compressedHeight: scaledSize.height,
          success: result => {
            if (result.tempFilePath) {
              resolve(result.tempFilePath);
              return;
            }
            reject(new Error('compressImage missing tempFilePath'));
          },
          fail: error => {
            reject(error instanceof Error ? error : new Error(toErrorMessage(error)));
          },
        });
      }).catch(error => {
        throw createPlatformError('Miniapp image compress failed', {
          code: PLATFORM_ERROR_CODE.UPLOAD_FAILED,
          stage: PLATFORM_ERROR_STAGE.RUNTIME,
          retryable: false,
          details: {
            src: normalizedPath,
            cause: toErrorMessage(error),
          },
        });
      });

      const normalizedCompressedPath = await normalizeMiniAppLocalPath(runtime, compressedPath);
      const compressedInfo = await getImageInfo(runtime, normalizedCompressedPath);
      const fileType = resolveMimeType(compressedInfo.type) ?? source.mimeType;
      const fileSize = await readFileSize(runtime, normalizedCompressedPath, source.size);

      return {
        source: {
          sourceType: 'miniapp-path',
          path: normalizedCompressedPath,
          name: source.name,
          mimeType: fileType,
          size: fileSize,
        },
        width: compressedInfo.width,
        height: compressedInfo.height,
        fileName: source.name,
        fileType,
        fileSize,
      };
    },

    async computeMd5(source: UploadSource): Promise<string> {
      const path = getMiniAppPath(source);
      const normalizedPath = await normalizeMiniAppLocalPath(runtime, path);
      const bytes = await readFileAsBytes(runtime, normalizedPath);
      return computeMd5Hex(bytes);
    },
  };
};
