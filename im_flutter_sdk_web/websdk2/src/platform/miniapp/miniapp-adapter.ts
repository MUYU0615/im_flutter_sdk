import {
  PLATFORM_ERROR_CODE,
  PLATFORM_ERROR_STAGE,
  RUNTIME_PLATFORMS,
  SOCKET_READY_STATE,
  createPlatformError,
  type PlatformAdapterOverrides,
  type RequestAdapter,
  type RequestConfig,
  type RequestResponse,
  type RuntimeAdapter,
  type RuntimePlatform,
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
} from '../types';
import type { MiniProgramRuntimeLike } from '../env';
import {
  createMiniAppImageProcessor,
  type MiniAppImageRuntimeLike,
} from '../image/miniapp-image-processor';

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
  onProgressUpdate?(
    listener: (event: {
      readonly progress: number;
      readonly totalBytesSent: number;
      readonly totalBytesExpectedToSend: number;
    }) => void
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
  onOpen(listener: () => void): void;
  onMessage(listener: (event: MiniAppSocketMessageEvent) => void): void;
  onError(listener: (event: MiniAppSocketErrorEvent) => void): void;
  onClose(listener: (event: MiniAppSocketCloseEvent) => void): void;
  offOpen?(listener: () => void): void;
  offError?(listener: (event: MiniAppSocketErrorEvent) => void): void;
}

interface MiniAppNetworkStatusChangeEvent {
  readonly isConnected: boolean;
}

interface MiniAppRuntimeAdapterLike {
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
  getImageInfo?: MiniAppImageRuntimeLike['getImageInfo'];
  compressImage?: MiniAppImageRuntimeLike['compressImage'];
  getFileSystemManager?: MiniAppImageRuntimeLike['getFileSystemManager'];
  onNetworkStatusChange?(listener: (event: MiniAppNetworkStatusChangeEvent) => void): void;
  offNetworkStatusChange?(listener: (event: MiniAppNetworkStatusChangeEvent) => void): void;
  onAppShow?(listener: () => void): void;
  offAppShow?(listener: () => void): void;
  onAppHide?(listener: () => void): void;
  offAppHide?(listener: () => void): void;
  getNetworkType?(options: {
    readonly success?: (result: { readonly networkType?: string }) => void;
    readonly fail?: (error: unknown) => void;
  }): void;
  getStorageSync?(key: string): string;
  setStorageSync?(key: string, value: string): void;
  removeStorageSync?(key: string): void;
  getStorage?(options: {
    readonly key: string;
    readonly success?: (result: { readonly data?: unknown }) => void;
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

const toMiniAppSocketSendData = (data: SocketSendData): string | ArrayBuffer => {
  if (typeof data === 'string' || data instanceof ArrayBuffer) {
    return data;
  }
  const buffer = new ArrayBuffer(data.byteLength);
  new Uint8Array(buffer).set(data);
  return buffer;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const hasFunction = <TName extends string>(
  value: unknown,
  name: TName
): value is Record<TName, (...args: ReadonlyArray<unknown>) => unknown> => {
  return isRecord(value) && typeof value[name] === 'function';
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

const assertMiniAppRuntime = (
  runtime: MiniProgramRuntimeLike
): MiniAppRuntimeAdapterLike => {
  if (
    hasFunction(runtime, 'request') &&
    hasFunction(runtime, 'connectSocket') &&
    hasFunction(runtime, 'uploadFile')
  ) {
    return runtime as MiniAppRuntimeAdapterLike;
  }
  throw createPlatformError('Mini program platform capability is missing.', {
    code: PLATFORM_ERROR_CODE.MISSING_CAPABILITY,
    stage: PLATFORM_ERROR_STAGE.INIT,
    retryable: false,
    details: {
      capability: 'request/connectSocket/uploadFile',
    },
  });
};

const createRequestAdapter = (runtime: MiniAppRuntimeAdapterLike): RequestAdapter => {
  return {
    request<TData>(config: RequestConfig): Promise<RequestResponse<TData>> {
      return new Promise<RequestResponse<TData>>((resolve, reject) => {
        let detachAbort = (): void => undefined;
        const task = runtime.request({
          url: config.url,
          method: config.method ?? 'GET',
          header: toHeaders(config.headers),
          data: config.body,
          timeout: config.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS,
          responseType: config.responseType === 'arraybuffer' ? 'arraybuffer' : 'text',
          success: result => {
            detachAbort();
            resolve({
              status: result.statusCode,
              headers: result.header ?? {},
              data: result.data as TData,
            });
          },
          fail: error => {
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

  task.onOpen(() => {
    readyState = SOCKET_READY_STATE.OPEN;
    openListeners.forEach(listener => {
      listener();
    });
  });
  task.onMessage(event => {
    messageListeners.forEach(listener => {
      listener(event.data);
    });
  });
  task.onError(event => {
    errorListeners.forEach(listener => {
      listener(event);
    });
  });
  task.onClose(event => {
    readyState = SOCKET_READY_STATE.CLOSED;
    closeListeners.forEach(listener => {
      listener({
        code: event.code,
        reason: event.reason,
      });
    });
  });

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
        task.send({
          data: toMiniAppSocketSendData(data),
          success: resolve,
          fail: error => {
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

const createSocketAdapter = (runtime: MiniAppRuntimeAdapterLike): SocketAdapter => {
  return {
    connect(config: SocketConnectConfig): Promise<SocketLike> {
      return new Promise<SocketLike>((resolve, reject) => {
        let settled = false;
        const task = runtime.connectSocket({
          url: config.url,
          protocols: Array.isArray(config.protocols)
            ? [...config.protocols]
            : typeof config.protocols === 'string'
              ? [config.protocols]
              : undefined,
          fail: error => {
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

        const handleOpen = (): void => {
          if (settled) {
            return;
          }
          settled = true;
          task.offOpen?.(handleOpen);
          task.offError?.(handleErrorBeforeOpen);
          resolve(createSocketLike(task));
        };

        const handleErrorBeforeOpen = (event: MiniAppSocketErrorEvent): void => {
          if (settled) {
            return;
          }
          settled = true;
          task.offOpen?.(handleOpen);
          task.offError?.(handleErrorBeforeOpen);
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

const createUploadAdapter = (runtime: MiniAppRuntimeAdapterLike): UploadAdapter => {
  return {
    upload(config: UploadConfig): Promise<UploadResult> {
      return new Promise<UploadResult>((resolve, reject) => {
        const source = ensureMiniAppPathSource(config.source);
        let detachAbort = (): void => undefined;
        const uploadTask = runtime.uploadFile({
          url: config.url,
          filePath: source.path,
          name: DEFAULT_UPLOAD_FIELD_NAME,
          header: toHeaders(config.headers),
          formData: config.fields,
          timeout: config.timeoutMs ?? DEFAULT_UPLOAD_TIMEOUT_MS,
          success: result => {
            detachAbort();
            resolve({
              status: result.statusCode,
              body: result.data,
            });
          },
          fail: error => {
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

        uploadTask.onProgressUpdate?.(event => {
          config.onProgress?.({
            loaded: event.totalBytesSent,
            total: event.totalBytesExpectedToSend,
            percent: event.progress,
          });
        });

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

const createStorageAdapter = (runtime: MiniAppRuntimeAdapterLike): StorageAdapter => {
  return {
    async getItem(key: string): Promise<string | null> {
      if (hasFunction(runtime, 'getStorageSync')) {
        try {
          const value = runtime.getStorageSync(key);
          return typeof value === 'string' && value.length > 0 ? value : null;
        } catch {
          return null;
        }
      }
      if (!hasFunction(runtime, 'getStorage')) {
        return null;
      }
      return new Promise(resolve => {
        runtime.getStorage({
          key,
          success: (result: { readonly data?: unknown }): void => {
            resolve(typeof result.data === 'string' && result.data.length > 0 ? result.data : null);
          },
          fail: (): void => {
            resolve(null);
          },
        });
      });
    },
    async setItem(key: string, value: string): Promise<void> {
      if (hasFunction(runtime, 'setStorageSync')) {
        runtime.setStorageSync(key, value);
        return;
      }
      if (!hasFunction(runtime, 'setStorage')) {
        return;
      }
      return new Promise<void>((resolve, reject) => {
        runtime.setStorage({
          key,
          data: value,
          success: resolve,
          fail: (error: unknown): void => {
            reject(error instanceof Error ? error : new Error(toErrorMessage(error)));
          },
        });
      });
    },
    async removeItem(key: string): Promise<void> {
      if (hasFunction(runtime, 'removeStorageSync')) {
        runtime.removeStorageSync(key);
        return;
      }
      if (!hasFunction(runtime, 'removeStorage')) {
        return;
      }
      return new Promise<void>((resolve, reject) => {
        runtime.removeStorage({
          key,
          success: resolve,
          fail: (error: unknown): void => {
            reject(error instanceof Error ? error : new Error(toErrorMessage(error)));
          },
        });
      });
    },
  };
};

const createRuntimeAdapter = (
  runtime: MiniAppRuntimeAdapterLike,
  platform: RuntimePlatform
): RuntimeAdapter => {
  return {
    getPlatform(): RuntimePlatform {
      return platform;
    },
    onNetworkChange(listener: (online: boolean) => void): () => void {
      const networkListener = (event: MiniAppNetworkStatusChangeEvent): void => {
        listener(event.isConnected);
      };

      if (hasFunction(runtime, 'onNetworkStatusChange')) {
        runtime.onNetworkStatusChange(networkListener);
      }
      if (hasFunction(runtime, 'getNetworkType')) {
        runtime.getNetworkType({
          success: (result: { readonly networkType?: string }): void => {
            listener(result.networkType !== 'none');
          },
        });
      }

      return (): void => {
        if (hasFunction(runtime, 'offNetworkStatusChange')) {
          runtime.offNetworkStatusChange(networkListener);
        }
      };
    },
    onAppVisibilityChange(listener: (foreground: boolean) => void): () => void {
      const handleShow = (): void => {
        listener(true);
      };
      const handleHide = (): void => {
        listener(false);
      };

      if (hasFunction(runtime, 'onAppShow')) {
        runtime.onAppShow(handleShow);
      }
      if (hasFunction(runtime, 'onAppHide')) {
        runtime.onAppHide(handleHide);
      }
      listener(true);

      return (): void => {
        if (hasFunction(runtime, 'offAppShow')) {
          runtime.offAppShow(handleShow);
        }
        if (hasFunction(runtime, 'offAppHide')) {
          runtime.offAppHide(handleHide);
        }
      };
    },
  };
};

export const createMiniProgramAdapterOverrides = (
  runtimeInput: MiniProgramRuntimeLike,
  platform: RuntimePlatform = RUNTIME_PLATFORMS.WECHAT_MINIAPP
): PlatformAdapterOverrides => {
  const runtime = assertMiniAppRuntime(runtimeInput);
  const imageProcessor =
    typeof runtime.getImageInfo === 'function'
      ? createMiniAppImageProcessor(runtime as MiniAppImageRuntimeLike)
      : undefined;
  return {
    request: createRequestAdapter(runtime),
    socket: createSocketAdapter(runtime),
    upload: createUploadAdapter(runtime),
    runtime: createRuntimeAdapter(runtime, platform),
    storage: createStorageAdapter(runtime),
    imageProcessor,
  };
};
