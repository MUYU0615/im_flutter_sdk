/**
 * 跨平台适配层导出
 */

export { createPlatformAdapter, detectRuntimePlatform } from './factory';
export { createWebRequestAdapter } from './request/web-request-adapter';
export { createWebRuntimeAdapter } from './runtime/web-runtime-adapter';
export { createWebSocketAdapter } from './socket/web-socket-adapter';
export { createWebUploadAdapter } from './upload/web-upload-adapter';
export {
  DEFAULT_REQUIRED_CAPABILITIES,
  resolveMissingCapabilities,
  validatePlatformCapabilities,
} from './capability-validator';
export { createStaticProtoAdapter, getStaticProtoRoot } from './proto/static-proto-adapter';
export { ProtoCodecRegistry } from './proto/proto-adapter';
export { isPlatformUploadError, mapUploadAdapterError } from './upload/upload-error-mapper';
export { normalizeUploadSource } from './upload/upload-source';

export type {
  CreatePlatformAdapterOptions,
  HttpMethod,
  PlatformAdapter,
  PlatformAdapterError,
  PlatformAdapterOverrides,
  PlatformAdapterOverridesResolver,
  PlatformAdapterProfile,
  PlatformCapability,
  PlatformFactoryResult,
  GeneratedImageResult,
  PlatformErrorCode,
  PlatformErrorStage,
  ImageGenerateOptions,
  ImageInfoResult,
  ImageProcessor,
  ProtoAdapter,
  RequestAdapter,
  RequestConfig,
  RequestResponse,
  RuntimeAdapter,
  RuntimePlatform,
  SocketAdapter,
  SocketConnectConfig,
  SocketLike,
  SocketMessageData,
  SocketReadyState,
  SocketSendData,
  StorageAdapter,
  UploadAdapter,
  UploadConfig,
  UploadProgress,
  UploadResult,
  UploadSource,
  UploadSourceType,
} from './types';

export type { ProtoTypeCodec } from './proto/proto-adapter';
export type { NormalizedUploadSource } from './upload/upload-source';

export {
  PLATFORM_ERROR_CODE,
  PLATFORM_ERROR_STAGE,
  RUNTIME_PLATFORMS,
  SOCKET_READY_STATE,
  createPlatformError,
} from './types';
