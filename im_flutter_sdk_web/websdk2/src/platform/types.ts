/**
 * 跨平台适配层类型定义
 */

export const RUNTIME_PLATFORMS = {
  WEB: 'web',
  WECHAT_MINIAPP: 'wechat-miniapp',
  QQ_MINIAPP: 'qq-miniapp',
  TOUTIAO_MINIAPP: 'toutiao-miniapp',
  BAIDU_MINIAPP: 'baidu-miniapp',
  ALIPAY_MINIAPP: 'alipay-miniapp',
  DINGTALK_MINIAPP: 'dingtalk-miniapp',
  UNIAPP: 'uniapp',
  REACT_NATIVE: 'react-native',
  ELECTRON_RENDERER: 'electron-renderer',
  ELECTRON_MAIN: 'electron-main',
  UNKNOWN: 'unknown',
} as const;

export type RuntimePlatform = (typeof RUNTIME_PLATFORMS)[keyof typeof RUNTIME_PLATFORMS];

export const PLATFORM_ERROR_STAGE = {
  INIT: 'init',
  REQUEST: 'request',
  UPLOAD: 'upload',
  SOCKET: 'socket',
  PROTO: 'proto',
  RUNTIME: 'runtime',
  STORAGE: 'storage',
} as const;

export type PlatformErrorStage = (typeof PLATFORM_ERROR_STAGE)[keyof typeof PLATFORM_ERROR_STAGE];

export const PLATFORM_ERROR_CODE = {
  INIT_FAILED: 'PLATFORM_INIT_FAILED',
  MISSING_CAPABILITY: 'PLATFORM_MISSING_CAPABILITY',
  REQUEST_FAILED: 'PLATFORM_REQUEST_FAILED',
  UPLOAD_FAILED: 'PLATFORM_UPLOAD_FAILED',
  SOCKET_FAILED: 'PLATFORM_SOCKET_FAILED',
  PROTO_FAILED: 'PLATFORM_PROTO_FAILED',
} as const;

export type PlatformErrorCode = (typeof PLATFORM_ERROR_CODE)[keyof typeof PLATFORM_ERROR_CODE];

export interface PlatformAdapterError extends Error {
  readonly code: PlatformErrorCode;
  readonly stage: PlatformErrorStage;
  readonly retryable: boolean;
  readonly details?: Record<string, unknown>;
}

export interface PlatformErrorOptions {
  readonly code: PlatformErrorCode;
  readonly stage: PlatformErrorStage;
  readonly retryable: boolean;
  readonly details?: Record<string, unknown>;
}

export const createPlatformError = (
  message: string,
  options: PlatformErrorOptions
): PlatformAdapterError => {
  const error = new Error(message) as PlatformAdapterError;
  (error as { name: string }).name = 'PlatformAdapterError';
  (error as { code: PlatformErrorCode }).code = options.code;
  (error as { stage: PlatformErrorStage }).stage = options.stage;
  (error as { retryable: boolean }).retryable = options.retryable;
  if (options.details) {
    (error as { details?: Record<string, unknown> }).details = options.details;
  }
  return error;
};

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface RequestConfig {
  readonly url: string;
  readonly method?: HttpMethod;
  readonly headers?: Record<string, string>;
  readonly body?: string | Record<string, unknown> | Uint8Array;
  readonly responseType?: 'json' | 'text' | 'arraybuffer';
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
}

export interface RequestResponse<TData> {
  readonly status: number;
  readonly headers: Record<string, string>;
  readonly data: TData;
}

export interface RequestAdapter {
  request<TData>(config: RequestConfig): Promise<RequestResponse<TData>>;
}

export type UploadSourceType = 'web-file' | 'miniapp-path' | 'rn-uri';

export interface UploadSource {
  readonly sourceType: UploadSourceType;
  readonly file?: File | Blob;
  readonly path?: string;
  readonly uri?: string;
  readonly name?: string;
  readonly mimeType?: string;
  readonly size?: number;
}

export interface ImageInfoResult {
  readonly width: number;
  readonly height: number;
  readonly mimeType?: string;
  readonly fileSize?: number;
  readonly isGif?: boolean;
}

export interface ImageGenerateOptions {
  readonly maxShortEdge: number;
  readonly quality: number;
}

export interface GeneratedImageResult {
  readonly source: UploadSource;
  readonly width: number;
  readonly height: number;
  readonly fileName?: string;
  readonly fileType?: string;
  readonly fileSize?: number;
  readonly webFile?: File;
}

export interface ImageProcessor {
  getImageInfo(source: UploadSource): Promise<ImageInfoResult>;
  generateBigImage(source: UploadSource, options: ImageGenerateOptions): Promise<GeneratedImageResult>;
  computeMd5(source: UploadSource): Promise<string>;
}

export interface UploadProgress {
  readonly loaded: number;
  readonly total?: number;
  readonly percent?: number;
}

export interface UploadConfig {
  readonly url: string;
  readonly headers?: Record<string, string>;
  readonly source: UploadSource;
  readonly fields?: Record<string, string>;
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
  readonly onProgress?: (progress: UploadProgress) => void;
}

export interface UploadResult {
  readonly status: number;
  readonly body: string;
}

export interface UploadAdapter {
  upload(config: UploadConfig): Promise<UploadResult>;
}

export type SocketSendData = string | ArrayBuffer | Uint8Array;
export type SocketMessageData = string | ArrayBuffer | Blob;

export const SOCKET_READY_STATE = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
} as const;

export type SocketReadyState = (typeof SOCKET_READY_STATE)[keyof typeof SOCKET_READY_STATE];

export interface SocketConnectConfig {
  readonly url: string;
  readonly protocols?: string | string[];
}

export interface SocketLike {
  readonly readyState: number;
  send(data: SocketSendData): Promise<void>;
  close(code?: number, reason?: string): void;
  onOpen(handler: () => void): () => void;
  onMessage(handler: (data: SocketMessageData) => void): () => void;
  onError(handler: (error: unknown) => void): () => void;
  onClose(handler: (event: { code?: number; reason?: string }) => void): () => void;
}

export interface SocketAdapter {
  connect(config: SocketConnectConfig): Promise<SocketLike>;
}

export interface RuntimeAdapter {
  getPlatform(): RuntimePlatform;
  onNetworkChange(listener: (online: boolean) => void): () => void;
  onAppVisibilityChange(listener: (foreground: boolean) => void): () => void;
}

export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface ProtoAdapter {
  encode<TInput>(type: string, payload: TInput): Uint8Array;
  decode<TOutput>(type: string, payload: Uint8Array): TOutput;
}

export interface PlatformAdapter {
  readonly platform: RuntimePlatform;
  readonly request: RequestAdapter;
  readonly upload: UploadAdapter;
  readonly socket: SocketAdapter;
  readonly runtime: RuntimeAdapter;
  readonly proto: ProtoAdapter;
  readonly storage: StorageAdapter;
  readonly imageProcessor?: ImageProcessor;
}

export interface PlatformCapability {
  readonly request: boolean;
  readonly upload: boolean;
  readonly socket: boolean;
  readonly runtime: boolean;
  readonly proto: boolean;
  readonly storage: boolean;
  readonly imageProcessor: boolean;
}

export interface PlatformAdapterProfile extends PlatformAdapter {
  readonly platformId: RuntimePlatform;
  readonly capability: PlatformCapability;
}

export interface PlatformAdapterOverrides {
  readonly request?: RequestAdapter;
  readonly upload?: UploadAdapter;
  readonly socket?: SocketAdapter;
  readonly runtime?: RuntimeAdapter;
  readonly proto?: ProtoAdapter;
  readonly storage?: StorageAdapter;
  readonly imageProcessor?: ImageProcessor;
}

export type PlatformAdapterOverridesResolver = (
  defaults: Readonly<PlatformAdapterOverrides>
) => PlatformAdapterOverrides;

export interface CreatePlatformAdapterOptions {
  readonly prefer?: RuntimePlatform;
  readonly overrides?: PlatformAdapterOverrides | PlatformAdapterOverridesResolver;
}

export type PlatformFactoryResult = PlatformAdapterProfile;
