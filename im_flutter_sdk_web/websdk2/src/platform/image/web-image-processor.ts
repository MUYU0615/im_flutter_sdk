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

const isBrowserImageSource = (source: UploadSource): source is UploadSource & {
  sourceType: 'web-file';
  file: File | Blob;
} => {
  return source.sourceType === 'web-file' && source.file instanceof Blob;
};

const getImageBitmap = async (
  blob: Blob
): Promise<{ image: CanvasImageSource; width: number; height: number; cleanup: () => void }> => {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(blob);
    return {
      image: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      cleanup: (): void => {
        bitmap.close();
      },
    };
  }

  if (typeof Image === 'undefined' || typeof URL === 'undefined') {
    throw createPlatformError('Image decode capability is missing for current platform', {
      code: PLATFORM_ERROR_CODE.MISSING_CAPABILITY,
      stage: PLATFORM_ERROR_STAGE.RUNTIME,
      retryable: false,
      details: {
        reason: 'image decode unavailable',
      },
    });
  }

  const objectUrl = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = (): void => {
      resolve({
        image,
        width: image.naturalWidth || image.width,
        height: image.naturalHeight || image.height,
        cleanup: (): void => {
          URL.revokeObjectURL(objectUrl);
        },
      });
    };
    image.onerror = (): void => {
      URL.revokeObjectURL(objectUrl);
      reject(
        createPlatformError('Image decode failed', {
          code: PLATFORM_ERROR_CODE.UPLOAD_FAILED,
          stage: PLATFORM_ERROR_STAGE.RUNTIME,
          retryable: false,
          details: {
            reason: 'image load error',
          },
        })
      );
    };
    image.src = objectUrl;
  });
};

const createCanvas = (width: number, height: number): HTMLCanvasElement | OffscreenCanvas => {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height);
  }
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  throw createPlatformError('Canvas capability is missing for current platform', {
    code: PLATFORM_ERROR_CODE.MISSING_CAPABILITY,
    stage: PLATFORM_ERROR_STAGE.RUNTIME,
    retryable: false,
    details: {
      reason: 'canvas unavailable',
    },
  });
};

const canvasToBlob = async (
  canvas: HTMLCanvasElement | OffscreenCanvas,
  type: string,
  quality: number
): Promise<Blob> => {
  if ('convertToBlob' in canvas && typeof canvas.convertToBlob === 'function') {
    return canvas.convertToBlob({ type, quality });
  }

  if ('toBlob' in canvas && typeof canvas.toBlob === 'function') {
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (blob) {
          resolve(blob);
          return;
        }
        reject(
          createPlatformError('Image encode failed', {
            code: PLATFORM_ERROR_CODE.UPLOAD_FAILED,
            stage: PLATFORM_ERROR_STAGE.RUNTIME,
            retryable: false,
            details: {
              reason: 'canvas toBlob returned null',
            },
          })
        );
      }, type, quality);
    });
  }

  throw createPlatformError('Canvas encode capability is missing for current platform', {
    code: PLATFORM_ERROR_CODE.MISSING_CAPABILITY,
    stage: PLATFORM_ERROR_STAGE.RUNTIME,
    retryable: false,
    details: {
      reason: 'canvas encode unavailable',
    },
  });
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

const resolveOutputMimeType = (mimeType: string | undefined): string => {
  if (mimeType === 'image/png' || mimeType === 'image/webp') {
    return mimeType;
  }
  return 'image/jpeg';
};

const getFileName = (source: UploadSource): string => {
  return source.name ?? 'image';
};

const getBlob = (source: UploadSource): Blob => {
  if (!isBrowserImageSource(source)) {
    throw createPlatformError('Web image processor only supports web file source', {
      code: PLATFORM_ERROR_CODE.MISSING_CAPABILITY,
      stage: PLATFORM_ERROR_STAGE.RUNTIME,
      retryable: false,
      details: {
        sourceType: source.sourceType,
      },
    });
  }
  return source.file;
};

const readBlobAsArrayBuffer = async (blob: Blob): Promise<ArrayBuffer> => {
  if (typeof blob.arrayBuffer === 'function') {
    return blob.arrayBuffer();
  }
  if (typeof FileReader === 'undefined') {
    throw createPlatformError('Binary read capability is missing for current platform', {
      code: PLATFORM_ERROR_CODE.MISSING_CAPABILITY,
      stage: PLATFORM_ERROR_STAGE.RUNTIME,
      retryable: false,
      details: {
        reason: 'blob.arrayBuffer unavailable',
      },
    });
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = (): void => {
      reject(
        createPlatformError('Binary read failed', {
          code: PLATFORM_ERROR_CODE.UPLOAD_FAILED,
          stage: PLATFORM_ERROR_STAGE.RUNTIME,
          retryable: false,
        })
      );
    };
    reader.onload = (): void => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
        return;
      }
      reject(
        createPlatformError('Binary read returned invalid result', {
          code: PLATFORM_ERROR_CODE.UPLOAD_FAILED,
          stage: PLATFORM_ERROR_STAGE.RUNTIME,
          retryable: false,
        })
      );
    };
    reader.readAsArrayBuffer(blob);
  });
};

export const createWebImageProcessor = (): ImageProcessor => {
  return {
    async getImageInfo(source: UploadSource): Promise<ImageInfoResult> {
      const blob = getBlob(source);
      const decoded = await getImageBitmap(blob);
      try {
        return {
          width: decoded.width,
          height: decoded.height,
          mimeType: source.mimeType,
          fileSize: source.size,
          isGif: source.mimeType === 'image/gif',
        };
      } finally {
        decoded.cleanup();
      }
    },

    async generateBigImage(
      source: UploadSource,
      options: ImageGenerateOptions
    ): Promise<GeneratedImageResult> {
      const blob = getBlob(source);
      const decoded = await getImageBitmap(blob);
      try {
        const scaledSize = resolveScaledSize(decoded.width, decoded.height, options.maxShortEdge);
        const canvas = createCanvas(scaledSize.width, scaledSize.height);
        const context = canvas.getContext('2d');
        if (!context) {
          throw createPlatformError('Canvas 2d context is missing', {
            code: PLATFORM_ERROR_CODE.MISSING_CAPABILITY,
            stage: PLATFORM_ERROR_STAGE.RUNTIME,
            retryable: false,
          });
        }

        context.drawImage(decoded.image, 0, 0, scaledSize.width, scaledSize.height);
        const fileType = resolveOutputMimeType(source.mimeType);
        const encoded = await canvasToBlob(canvas, fileType, options.quality);
        const fileName = getFileName(source);
        const webFile =
          typeof File !== 'undefined'
            ? new File([encoded], fileName, { type: fileType, lastModified: Date.now() })
            : undefined;

        return {
          source: {
            sourceType: 'web-file',
            file: webFile ?? encoded,
            name: fileName,
            mimeType: fileType,
            size: webFile?.size ?? encoded.size,
          },
          width: scaledSize.width,
          height: scaledSize.height,
          fileName,
          fileType,
          fileSize: webFile?.size ?? encoded.size,
          webFile,
        };
      } finally {
        decoded.cleanup();
      }
    },

    async computeMd5(source: UploadSource): Promise<string> {
      const blob = getBlob(source);
      const buffer = await readBlobAsArrayBuffer(blob);
      return computeMd5Hex(new Uint8Array(buffer));
    },
  };
};
