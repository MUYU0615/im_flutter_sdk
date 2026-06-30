import { computeMd5Hex } from '../../src/utils/md5';
import {
  PLATFORM_ERROR_CODE,
  PLATFORM_ERROR_STAGE,
  RUNTIME_PLATFORMS,
  SOCKET_READY_STATE,
  createPlatformError,
  type GeneratedImageResult,
  type ImageGenerateOptions,
  type ImageInfoResult,
  type ImageProcessor,
  type PlatformAdapterOverrides,
  type RequestAdapter,
  type RequestConfig,
  type RequestResponse,
  type RuntimeAdapter,
  type SocketAdapter,
  type SocketConnectConfig,
  type SocketLike,
  type SocketMessageData,
  type SocketSendData,
  type StorageAdapter,
  type UploadAdapter,
  type UploadConfig,
  type UploadResult,
  type UploadSource,
} from '../../src/platform';

type MiniAppResponseData = string | Record<string, unknown> | ArrayBuffer;

interface MiniAppRequestSuccessResult {
  readonly statusCode: number;
  readonly header?: Record<string, string>;
  readonly data: MiniAppResponseData;
}

interface MiniAppUploadSuccessResult {
  readonly statusCode: number;
  readonly data: string;
}

interface MiniAppSocketOpenEvent {
  readonly header?: Record<string, string>;
}

interface MiniAppSocketMessageEvent {
  readonly data: string | ArrayBuffer;
}

interface MiniAppSocketErrorEvent {
  readonly errMsg?: string;
}

interface MiniAppSocketCloseEvent {
  readonly code?: number;
  readonly reason?: string;
}

interface MiniAppRequestTaskLike {
  abort(): void;
}

interface MiniAppUploadTaskLike {
  abort(): void;
  onProgressUpdate?(listener: (event: { progress: number; totalBytesSent: number; totalBytesExpectedToSend: number }) => void): void;
  offProgressUpdate?(
    listener: (event: { progress: number; totalBytesSent: number; totalBytesExpectedToSend: number }) => void
  ): void;
}

interface MiniAppSocketTaskLike {
  send(options: {
    readonly data: string | ArrayBuffer;
    readonly success?: () => void;
    readonly fail?: (error: unknown) => void;
  }): void;
  close(options?: {
    readonly code?: number;
    readonly reason?: string;
    readonly success?: () => void;
    readonly fail?: (error: unknown) => void;
  }): void;
  onOpen(listener: (event: MiniAppSocketOpenEvent) => void): void;
  onMessage(listener: (event: MiniAppSocketMessageEvent) => void): void;
  onError(listener: (event: MiniAppSocketErrorEvent) => void): void;
  onClose(listener: (event: MiniAppSocketCloseEvent) => void): void;
  offOpen?(listener: (event: MiniAppSocketOpenEvent) => void): void;
  offMessage?(listener: (event: MiniAppSocketMessageEvent) => void): void;
  offError?(listener: (event: MiniAppSocketErrorEvent) => void): void;
  offClose?(listener: (event: MiniAppSocketCloseEvent) => void): void;
}

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

interface MiniAppNetworkStatusChangeEvent {
  readonly isConnected: boolean;
}

interface MiniAppAppShowEvent {
  readonly scene?: number;
}

interface MiniAppImageInfoResponse {
  readonly width: number;
  readonly height: number;
  readonly type?: string;
  readonly path?: string;
  readonly orientation?: string;
}

export interface MiniAppWxLike {
  request(options: {
    readonly url: string;
    readonly method?: string;
    readonly header?: Record<string, string>;
    readonly data?: unknown;
    readonly timeout?: number;
    readonly responseType?: 'text' | 'arraybuffer';
    readonly success?: (result: MiniAppRequestSuccessResult) => void;
    readonly fail?: (error: unknown) => void;
  }): MiniAppRequestTaskLike;
  connectSocket(options: {
    readonly url: string;
    readonly protocols?: string[];
    readonly success?: () => void;
    readonly fail?: (error: unknown) => void;
  }): MiniAppSocketTaskLike;
  uploadFile(options: {
    readonly url: string;
    readonly filePath: string;
    readonly name: string;
    readonly header?: Record<string, string>;
    readonly formData?: Record<string, string>;
    readonly timeout?: number;
    readonly success?: (result: MiniAppUploadSuccessResult) => void;
    readonly fail?: (error: unknown) => void;
  }): MiniAppUploadTaskLike;
  getImageInfo(options: {
    readonly src: string;
    readonly success: (result: MiniAppImageInfoResponse) => void;
    readonly fail?: (error: unknown) => void;
  }): void;
  compressImage?(options: {
    readonly src: string;
    readonly quality: number;
    readonly compressedWidth?: number;
    readonly compressedHeight?: number;
    readonly success?: (result: { readonly tempFilePath: string }) => void;
    readonly fail?: (error: unknown) => void;
  }): void;
  getFileSystemManager?(): MiniAppFileSystemManagerLike;
  onNetworkStatusChange?(listener: (event: MiniAppNetworkStatusChangeEvent) => void): void;
  offNetworkStatusChange?(listener: (event: MiniAppNetworkStatusChangeEvent) => void): void;
  onAppShow?(listener: (event: MiniAppAppShowEvent) => void): void;
  offAppShow?(listener: (event: MiniAppAppShowEvent) => void): void;
  onAppHide?(listener: () => void): void;
  offAppHide?(listener: () => void): void;
  getNetworkType?(options: {
    readonly success?: (result: { readonly networkType: string }) => void;
    readonly fail?: (error: unknown) => void;
  }): void;
  getStorageSync?(key: string): string;
  setStorageSync?(key: string, value: string): void;
  removeStorageSync?(key: string): void;
  getStorage?(options: {
    readonly key: string;
    readonly success?: (result: { readonly data: string }) => void;
    readonly fail?: (error: unknown) => void;
  }): void;
  setStorage?(options: {
    readonly key: string;
    readonly data: string;
    readonly success?: () => void;
    readonly fail?: (error: unknown) => void;
  }): void;
  removeStorage?(options: {
    readonly key: string;
    readonly success?: () => void;
    readonly fail?: (error: unknown) => void;
  }): void;
}

const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
const DEFAULT_UPLOAD_TIMEOUT_MS = 30_000;
const DEFAULT_UPLOAD_FIELD_NAME = 'file';

const MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  heic: 'image/heic',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
  aac: 'audio/aac',
  amr: 'audio/amr',
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (isRecord(error) && typeof error.errMsg === 'string') {
    return error.errMsg;
  }
  return String(error);
};

const toHeaders = (headers: Record<string, string> | undefined): Record<string, string> => {
  return headers ? { ...headers } : {};
};

const resolveMimeTypeFromPath = (path: string, fallback?: string): string => {
  const cleanPath = path.replace(/[?#].*$/, '');
  const lastSegment = cleanPath.split(/[\\/]/).filter(Boolean).at(-1);
  if (!lastSegment) {
    return fallback ?? 'application/octet-stream';
  }
  const dotIndex = lastSegment.lastIndexOf('.');
  if (dotIndex < 0) {
    return fallback ?? 'application/octet-stream';
  }
  const extension = lastSegment.slice(dotIndex + 1).toLowerCase();
  return MIME_TYPE_BY_EXTENSION[extension] ?? fallback ?? 'application/octet-stream';
};

const toArrayBuffer = (data: string | ArrayBuffer): ArrayBuffer => {
  if (data instanceof ArrayBuffer) {
    return data;
  }
  const encoder = new TextEncoder();
  return encoder.encode(data).buffer;
};

const createAbortListener = (
  signal: AbortSignal | undefined,
  onAbort: () => void
): (() => void) => {
  if (!signal) {
    return (): void => undefined;
  }
  if (signal.aborted) {
    onAbort();
    return (): void => undefined;
  }
  const listener = (): void => {
    onAbort();
  };
  signal.addEventListener('abort', listener, { once: true });
  return (): void => {
    signal.removeEventListener('abort', listener);
  };
};

const createRequestAdapter = (wxLike: MiniAppWxLike): RequestAdapter => {
  return {
    request<TData>(config: RequestConfig): Promise<RequestResponse<TData>> {
      return new Promise<RequestResponse<TData>>((resolve, reject) => {
        let detachAbort = (): void => undefined;
        const task = wxLike.request({
          url: config.url,
          method: config.method ?? 'GET',
          header: toHeaders(config.headers),
          data: config.body,
          timeout: config.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS,
          responseType: config.responseType === 'arraybuffer' ? 'arraybuffer' : 'text',
          success: (result): void => {
            detachAbort();
            resolve({
              status: result.statusCode,
              headers: result.header ?? {},
              data: result.data as TData,
            });
          },
          fail: (error): void => {
            detachAbort();
            reject(
              createPlatformError('Mini program request failed.', {
                code: PLATFORM_ERROR_CODE.REQUEST_FAILED,
                stage: PLATFORM_ERROR_STAGE.REQUEST,
                retryable: true,
                details: {
                  url: config.url,
                  method: config.method ?? 'GET',
                  cause: toErrorMessage(error),
                },
              })
            );
          },
        });

        detachAbort = createAbortListener(config.signal, () => {
          task.abort();
          reject(
            createPlatformError('Mini program request aborted.', {
              code: PLATFORM_ERROR_CODE.REQUEST_FAILED,
              stage: PLATFORM_ERROR_STAGE.REQUEST,
              retryable: false,
              details: {
                url: config.url,
                method: config.method ?? 'GET',
                reason: 'abort',
              },
            })
          );
        });
      });
    },
  };
};

const createSocketLike = (task: MiniAppSocketTaskLike): SocketLike => {
  const openListeners = new Set<() => void>();
  const messageListeners = new Set<(data: SocketMessageData) => void>();
  const errorListeners = new Set<(error: unknown) => void>();
  const closeListeners = new Set<(event: { code?: number; reason?: string }) => void>();
  let readyState: number = SOCKET_READY_STATE.CONNECTING;

  const handleOpen = (): void => {
    readyState = SOCKET_READY_STATE.OPEN;
    openListeners.forEach(listener => {
      listener();
    });
  };

  const handleMessage = (event: MiniAppSocketMessageEvent): void => {
    messageListeners.forEach(listener => {
      listener(event.data);
    });
  };

  const handleError = (event: MiniAppSocketErrorEvent): void => {
    errorListeners.forEach(listener => {
      listener(event);
    });
  };

  const handleClose = (event: MiniAppSocketCloseEvent): void => {
    readyState = SOCKET_READY_STATE.CLOSED;
    closeListeners.forEach(listener => {
      listener({
        code: event.code,
        reason: event.reason,
      });
    });
  };

  task.onOpen(handleOpen);
  task.onMessage(handleMessage);
  task.onError(handleError);
  task.onClose(handleClose);

  return {
    get readyState(): number {
      return readyState;
    },
    send(data: SocketSendData): Promise<void> {
      if (readyState !== SOCKET_READY_STATE.OPEN) {
        throw createPlatformError('Mini program socket is not open.', {
          code: PLATFORM_ERROR_CODE.SOCKET_FAILED,
          stage: PLATFORM_ERROR_STAGE.SOCKET,
          retryable: true,
          details: {
            readyState,
          },
        });
      }

      return new Promise<void>((resolve, reject) => {
        const payload = data instanceof Uint8Array ? data.buffer : data;
        task.send({
          data: payload as string | ArrayBuffer,
          success: (): void => {
            resolve();
          },
          fail: (error): void => {
            reject(
              createPlatformError('Mini program socket send failed.', {
                code: PLATFORM_ERROR_CODE.SOCKET_FAILED,
                stage: PLATFORM_ERROR_STAGE.SOCKET,
                retryable: true,
                details: {
                  cause: toErrorMessage(error),
                },
              })
            );
          },
        });
      });
    },
    close(code?: number, reason?: string): void {
      readyState = SOCKET_READY_STATE.CLOSING;
      task.close({
        code,
        reason,
      });
    },
    onOpen(handler: () => void): () => void {
      openListeners.add(handler);
      return (): void => {
        openListeners.delete(handler);
      };
    },
    onMessage(handler: (data: SocketMessageData) => void): () => void {
      messageListeners.add(handler);
      return (): void => {
        messageListeners.delete(handler);
      };
    },
    onError(handler: (error: unknown) => void): () => void {
      errorListeners.add(handler);
      return (): void => {
        errorListeners.delete(handler);
      };
    },
    onClose(handler: (event: { code?: number; reason?: string }) => void): () => void {
      closeListeners.add(handler);
      return (): void => {
        closeListeners.delete(handler);
      };
    },
  };
};

const createSocketAdapter = (wxLike: MiniAppWxLike): SocketAdapter => {
  return {
    connect(config: SocketConnectConfig): Promise<SocketLike> {
      return new Promise<SocketLike>((resolve, reject) => {
        let settled = false;
        const task = wxLike.connectSocket({
          url: config.url,
          protocols: Array.isArray(config.protocols)
            ? [...config.protocols]
            : typeof config.protocols === 'string'
              ? [config.protocols]
              : undefined,
          fail: (error): void => {
            if (settled) {
              return;
            }
            settled = true;
            reject(
              createPlatformError('Mini program socket connect failed.', {
                code: PLATFORM_ERROR_CODE.SOCKET_FAILED,
                stage: PLATFORM_ERROR_STAGE.SOCKET,
                retryable: true,
                details: {
                  url: config.url,
                  cause: toErrorMessage(error),
                },
              })
            );
          },
        });

        const cleanupBeforeResolve = (): void => {
          if (task.offOpen) {
            task.offOpen(handleOpen);
          }
          if (task.offError) {
            task.offError(handleErrorBeforeOpen);
          }
        };

        const handleOpen = (): void => {
          if (settled) {
            return;
          }
          settled = true;
          cleanupBeforeResolve();
          resolve(createSocketLike(task));
        };

        const handleErrorBeforeOpen = (event: MiniAppSocketErrorEvent): void => {
          if (settled) {
            return;
          }
          settled = true;
          cleanupBeforeResolve();
          reject(
            createPlatformError('Mini program socket connection failed before open.', {
              code: PLATFORM_ERROR_CODE.SOCKET_FAILED,
              stage: PLATFORM_ERROR_STAGE.SOCKET,
              retryable: true,
              details: {
                url: config.url,
                cause: event.errMsg ?? 'socket error',
              },
            })
          );
        };

        task.onOpen(handleOpen);
        task.onError(handleErrorBeforeOpen);
      });
    },
  };
};

const ensureMiniAppPathSource = (source: UploadSource): UploadSource & {
  readonly sourceType: 'miniapp-path';
  readonly path: string;
} => {
  if (source.sourceType !== 'miniapp-path' || !source.path) {
    throw createPlatformError('Mini program upload only supports miniapp-path source.', {
      code: PLATFORM_ERROR_CODE.UPLOAD_FAILED,
      stage: PLATFORM_ERROR_STAGE.UPLOAD,
      retryable: false,
      details: {
        sourceType: source.sourceType,
      },
    });
  }
  return source as UploadSource & {
    readonly sourceType: 'miniapp-path';
    readonly path: string;
  };
};

const createUploadAdapter = (wxLike: MiniAppWxLike): UploadAdapter => {
  return {
    upload(config: UploadConfig): Promise<UploadResult> {
      return new Promise<UploadResult>((resolve, reject) => {
        const source = ensureMiniAppPathSource(config.source);
        let detachAbort = (): void => undefined;
        const uploadTask = wxLike.uploadFile({
          url: config.url,
          filePath: source.path,
          name: DEFAULT_UPLOAD_FIELD_NAME,
          header: toHeaders(config.headers),
          formData: config.fields,
          timeout: config.timeoutMs ?? DEFAULT_UPLOAD_TIMEOUT_MS,
          success: (result): void => {
            detachAbort();
            resolve({
              status: result.statusCode,
              body: result.data,
            });
          },
          fail: (error): void => {
            detachAbort();
            reject(
              createPlatformError('Mini program upload failed.', {
                code: PLATFORM_ERROR_CODE.UPLOAD_FAILED,
                stage: PLATFORM_ERROR_STAGE.UPLOAD,
                retryable: true,
                details: {
                  url: config.url,
                  path: source.path,
                  cause: toErrorMessage(error),
                },
              })
            );
          },
        });

        const progressListener = (event: {
          readonly progress: number;
          readonly totalBytesSent: number;
          readonly totalBytesExpectedToSend: number;
        }): void => {
          config.onProgress?.({
            loaded: event.totalBytesSent,
            total: event.totalBytesExpectedToSend,
            percent: event.progress,
          });
        };

        uploadTask.onProgressUpdate?.(progressListener);

        detachAbort = createAbortListener(config.signal, () => {
          uploadTask.abort();
          reject(
            createPlatformError('Mini program upload aborted.', {
              code: PLATFORM_ERROR_CODE.UPLOAD_FAILED,
              stage: PLATFORM_ERROR_STAGE.UPLOAD,
              retryable: false,
              details: {
                url: config.url,
                path: source.path,
                reason: 'abort',
              },
            })
          );
        });
      });
    },
  };
};

const createStorageAdapter = (wxLike: MiniAppWxLike): StorageAdapter => {
  return {
    async getItem(key: string): Promise<string | null> {
      if (wxLike.getStorageSync) {
        try {
          const value = wxLike.getStorageSync(key);
          return value || null;
        } catch {
          return null;
        }
      }
      if (!wxLike.getStorage) {
        return null;
      }
      return new Promise<string | null>(resolve => {
        wxLike.getStorage?.({
          key,
          success: (result): void => {
            resolve(result.data || null);
          },
          fail: (): void => {
            resolve(null);
          },
        });
      });
    },
    async setItem(key: string, value: string): Promise<void> {
      if (wxLike.setStorageSync) {
        wxLike.setStorageSync(key, value);
        return;
      }
      if (!wxLike.setStorage) {
        return;
      }
      return new Promise<void>((resolve, reject) => {
        wxLike.setStorage?.({
          key,
          data: value,
          success: (): void => {
            resolve();
          },
          fail: (error): void => {
            reject(error instanceof Error ? error : new Error(toErrorMessage(error)));
          },
        });
      });
    },
    async removeItem(key: string): Promise<void> {
      if (wxLike.removeStorageSync) {
        wxLike.removeStorageSync(key);
        return;
      }
      if (!wxLike.removeStorage) {
        return;
      }
      return new Promise<void>((resolve, reject) => {
        wxLike.removeStorage?.({
          key,
          success: (): void => {
            resolve();
          },
          fail: (error): void => {
            reject(error instanceof Error ? error : new Error(toErrorMessage(error)));
          },
        });
      });
    },
  };
};

const createRuntimeAdapter = (wxLike: MiniAppWxLike): RuntimeAdapter => {
  return {
    getPlatform(): 'wechat-miniapp' {
      return RUNTIME_PLATFORMS.WECHAT_MINIAPP;
    },
    onNetworkChange(listener: (online: boolean) => void): () => void {
      const networkListener = (event: MiniAppNetworkStatusChangeEvent): void => {
        listener(event.isConnected);
      };

      wxLike.onNetworkStatusChange?.(networkListener);
      wxLike.getNetworkType?.({
        success: (result): void => {
          listener(result.networkType !== 'none');
        },
      });

      return (): void => {
        wxLike.offNetworkStatusChange?.(networkListener);
      };
    },
    onAppVisibilityChange(listener: (foreground: boolean) => void): () => void {
      const handleShow = (): void => {
        listener(true);
      };
      const handleHide = (): void => {
        listener(false);
      };

      wxLike.onAppShow?.(handleShow);
      wxLike.onAppHide?.(handleHide);
      listener(true);

      return (): void => {
        wxLike.offAppShow?.(handleShow);
        wxLike.offAppHide?.(handleHide);
      };
    },
  };
};

const getFileSystemManager = (wxLike: MiniAppWxLike): MiniAppFileSystemManagerLike => {
  const manager = wxLike.getFileSystemManager?.();
  if (!manager) {
    throw createPlatformError('Mini program file system capability is missing.', {
      code: PLATFORM_ERROR_CODE.MISSING_CAPABILITY,
      stage: PLATFORM_ERROR_STAGE.RUNTIME,
      retryable: false,
      details: {
        capability: 'getFileSystemManager',
      },
    });
  }
  return manager;
};

const readFileAsArrayBuffer = (
  wxLike: MiniAppWxLike,
  filePath: string
): Promise<ArrayBuffer> => {
  const manager = getFileSystemManager(wxLike);
  return new Promise<ArrayBuffer>((resolve, reject) => {
    manager.readFile({
      filePath,
      success: (result): void => {
        resolve(toArrayBuffer(result.data));
      },
      fail: (error): void => {
        reject(
          createPlatformError('Mini program file read failed.', {
            code: PLATFORM_ERROR_CODE.UPLOAD_FAILED,
            stage: PLATFORM_ERROR_STAGE.RUNTIME,
            retryable: false,
            details: {
              filePath,
              cause: toErrorMessage(error),
            },
          })
        );
      },
    });
  });
};

const getFileSize = async (
  wxLike: MiniAppWxLike,
  filePath: string,
  fallback?: number
): Promise<number | undefined> => {
  const manager = getFileSystemManager(wxLike);
  if (!manager.getFileInfo) {
    return fallback;
  }
  return new Promise<number | undefined>(resolve => {
    manager.getFileInfo?.({
      filePath,
      success: (result): void => {
        resolve(result.size);
      },
      fail: (): void => {
        resolve(fallback);
      },
    });
  });
};

const getImageInfo = (
  wxLike: MiniAppWxLike,
  sourcePath: string
): Promise<MiniAppImageInfoResponse> => {
  return new Promise<MiniAppImageInfoResponse>((resolve, reject) => {
    wxLike.getImageInfo({
      src: sourcePath,
      success: (result): void => {
        resolve(result);
      },
      fail: (error): void => {
        reject(
          createPlatformError('Mini program getImageInfo failed.', {
            code: PLATFORM_ERROR_CODE.UPLOAD_FAILED,
            stage: PLATFORM_ERROR_STAGE.RUNTIME,
            retryable: false,
            details: {
              src: sourcePath,
              cause: toErrorMessage(error),
            },
          })
        );
      },
    });
  });
};

const compressImage = async (
  wxLike: MiniAppWxLike,
  sourcePath: string,
  options: ImageGenerateOptions
): Promise<string> => {
  if (!wxLike.compressImage) {
    return sourcePath;
  }
  return new Promise<string>((resolve, reject) => {
    wxLike.compressImage?.({
      src: sourcePath,
      quality: Math.max(1, Math.min(100, Math.round(options.quality * 100))),
      success: (result): void => {
        resolve(result.tempFilePath || sourcePath);
      },
      fail: (error): void => {
        reject(
          createPlatformError('Mini program compressImage failed.', {
            code: PLATFORM_ERROR_CODE.UPLOAD_FAILED,
            stage: PLATFORM_ERROR_STAGE.RUNTIME,
            retryable: false,
            details: {
              src: sourcePath,
              cause: toErrorMessage(error),
            },
          })
        );
      },
    });
  });
};

const createImageProcessor = (wxLike: MiniAppWxLike): ImageProcessor => {
  return {
    async getImageInfo(source: UploadSource): Promise<ImageInfoResult> {
      const resolved = ensureMiniAppPathSource(source);
      const info = await getImageInfo(wxLike, resolved.path);
      return {
        width: info.width,
        height: info.height,
        mimeType: resolveMimeTypeFromPath(resolved.path, source.mimeType),
        fileSize: await getFileSize(wxLike, resolved.path, source.size),
        isGif: resolveMimeTypeFromPath(resolved.path, source.mimeType) === 'image/gif',
      };
    },
    async generateBigImage(
      source: UploadSource,
      options: ImageGenerateOptions
    ): Promise<GeneratedImageResult> {
      const resolved = ensureMiniAppPathSource(source);
      const nextPath = await compressImage(wxLike, resolved.path, options);
      const info = await getImageInfo(wxLike, nextPath);
      const fileType = resolveMimeTypeFromPath(nextPath, source.mimeType);
      const fileSize = await getFileSize(wxLike, nextPath, source.size);
      return {
        source: {
          sourceType: 'miniapp-path',
          path: nextPath,
          name: source.name,
          mimeType: fileType,
          size: fileSize,
        },
        width: info.width,
        height: info.height,
        fileName: source.name,
        fileType,
        fileSize,
      };
    },
    async computeMd5(source: UploadSource): Promise<string> {
      const resolved = ensureMiniAppPathSource(source);
      const bytes = new Uint8Array(await readFileAsArrayBuffer(wxLike, resolved.path));
      return computeMd5Hex(bytes);
    },
  };
};

export const createMiniAppPlatformAdapterOverrides = (
  wxLike: MiniAppWxLike
): PlatformAdapterOverrides => {
  return {
    request: createRequestAdapter(wxLike),
    socket: createSocketAdapter(wxLike),
    upload: createUploadAdapter(wxLike),
    runtime: createRuntimeAdapter(wxLike),
    storage: createStorageAdapter(wxLike),
    imageProcessor: createImageProcessor(wxLike),
  };
};
