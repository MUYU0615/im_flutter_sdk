/**
 * 跨平台适配器工厂
 */

import {
  PLATFORM_ERROR_CODE,
  PLATFORM_ERROR_STAGE,
  RUNTIME_PLATFORMS,
  createPlatformError,
  type CreatePlatformAdapterOptions,
  type PlatformCapability,
  type PlatformFactoryResult,
  type PlatformAdapterOverrides,
  type PlatformAdapterOverridesResolver,
  type ProtoAdapter,
  type RequestAdapter,
  type RuntimeAdapter,
  type RuntimePlatform,
  type SocketAdapter,
  type StorageAdapter,
  type UploadAdapter,
  type ImageProcessor,
} from './types';
import {
  isMiniProgramPlatform,
  isMiniProgramRuntime,
  isWebRuntime,
  resolveRuntimeEnv,
  type MiniProgramRuntimeLike,
  type RuntimeDetectionInput,
} from './env';
import { validatePlatformCapabilities } from './capability-validator';
import { createStaticProtoAdapter } from './proto/static-proto-adapter';
import { createWebRequestAdapter } from './request/web-request-adapter';
import { createWebRuntimeAdapter } from './runtime/web-runtime-adapter';
import { createWebSocketAdapter } from './socket/web-socket-adapter';
import { createWebUploadAdapter } from './upload/web-upload-adapter';
import { createWebImageProcessor } from './image/web-image-processor';
import {
  createMiniAppImageProcessor,
  type MiniAppImageRuntimeLike,
} from './image/miniapp-image-processor';
import { createMiniProgramAdapterOverrides } from './miniapp/miniapp-adapter';

interface AdapterSet {
  readonly request?: RequestAdapter;
  readonly upload?: UploadAdapter;
  readonly socket?: SocketAdapter;
  readonly runtime?: RuntimeAdapter;
  readonly proto?: ProtoAdapter;
  readonly storage?: StorageAdapter;
  readonly imageProcessor?: ImageProcessor;
}

const WEB_COMPATIBLE_PLATFORMS: ReadonlyArray<RuntimePlatform> = [
  RUNTIME_PLATFORMS.WEB,
  RUNTIME_PLATFORMS.ELECTRON_RENDERER,
  RUNTIME_PLATFORMS.REACT_NATIVE,
];

const hasFunction = <TName extends string>(
  value: unknown,
  name: TName
): value is Record<TName, (...args: ReadonlyArray<unknown>) => unknown> => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record[name] === 'function';
};

const isWebCompatiblePlatform = (platform: RuntimePlatform): boolean => {
  return WEB_COMPATIBLE_PLATFORMS.includes(platform);
};

const isMiniAppImageRuntime = (value: unknown): value is MiniAppImageRuntimeLike => {
  return hasFunction(value, 'getImageInfo') && hasFunction(value, 'getFileSystemManager');
};

const resolveDefaultImageProcessor = (
  platform: RuntimePlatform,
  runtime: RuntimeDetectionInput | MiniProgramRuntimeLike
): ImageProcessor | undefined => {
  if (isWebCompatiblePlatform(platform)) {
    return createWebImageProcessor();
  }

  if (isMiniProgramPlatform(platform) && isMiniAppImageRuntime(runtime)) {
    return createMiniAppImageProcessor(runtime);
  }

  if (platform === RUNTIME_PLATFORMS.UNIAPP && typeof runtime === 'object' && runtime !== null) {
    const runtimeRecord = runtime as RuntimeDetectionInput;
    if (isWebRuntime(runtimeRecord)) {
      return createWebImageProcessor();
    }
    if (isMiniAppImageRuntime(runtimeRecord.uni)) {
      return createMiniAppImageProcessor(runtimeRecord.uni);
    }
    if (isMiniAppImageRuntime(runtimeRecord.wx)) {
      return createMiniAppImageProcessor(runtimeRecord.wx);
    }
  }

  return undefined;
};

const createFallbackRuntimeAdapter = (platform: RuntimePlatform): RuntimeAdapter => {
  return {
    getPlatform(): RuntimePlatform {
      return platform;
    },
    onNetworkChange(_listener: (online: boolean) => void): () => void {
      return (): void => undefined;
    },
    onAppVisibilityChange(_listener: (foreground: boolean) => void): () => void {
      return (): void => undefined;
    },
  };
};

const createDefaultStorageAdapter = (runtime: RuntimeDetectionInput): StorageAdapter => {
  const storageRef = runtime.localStorage;
  if (storageRef) {
    return {
      getItem(key: string): Promise<string | null> {
        return Promise.resolve(storageRef.getItem(key));
      },
      setItem(key: string, value: string): Promise<void> {
        storageRef.setItem(key, value);
        return Promise.resolve();
      },
      removeItem(key: string): Promise<void> {
        storageRef.removeItem(key);
        return Promise.resolve();
      },
    };
  }

  const memoryStore = new Map<string, string>();
  return {
    getItem(key: string): Promise<string | null> {
      const value = memoryStore.has(key) ? (memoryStore.get(key) ?? null) : null;
      return Promise.resolve(value);
    },
    setItem(key: string, value: string): Promise<void> {
      memoryStore.set(key, value);
      return Promise.resolve();
    },
    removeItem(key: string): Promise<void> {
      memoryStore.delete(key);
      return Promise.resolve();
    },
  };
};

const createDefaultAdapterSet = (
  platform: RuntimePlatform,
  runtime: RuntimeDetectionInput,
  platformGlobal: RuntimeDetectionInput | MiniProgramRuntimeLike
): AdapterSet => {
  if (isMiniProgramPlatform(platform) && isMiniProgramRuntime(platformGlobal)) {
    return {
      ...createMiniProgramAdapterOverrides(platformGlobal, platform),
      proto: createStaticProtoAdapter(),
    };
  }

  const runtimeXhrCtor = runtime.XMLHttpRequest;
  const request = isWebCompatiblePlatform(platform)
    ? createWebRequestAdapter({
        fetchImpl: runtime.fetch,
      })
    : undefined;
  const socket = isWebCompatiblePlatform(platform)
    ? createWebSocketAdapter({
        webSocketCtor: runtime.WebSocket,
      })
    : undefined;
  const upload = isWebCompatiblePlatform(platform)
    ? createWebUploadAdapter({
        xhrFactory:
          typeof runtimeXhrCtor === 'function'
            ? (): XMLHttpRequest => new runtimeXhrCtor()
            : undefined,
        fetchImpl: runtime.fetch,
      })
    : undefined;
  const runtimeAdapter = isWebCompatiblePlatform(platform)
    ? createWebRuntimeAdapter({
        platform,
        windowRef: runtime.window,
        documentRef: runtime.document,
        navigatorRef: runtime.navigator,
      })
    : createFallbackRuntimeAdapter(platform);

  return {
    request,
    upload,
    socket,
    runtime: runtimeAdapter,
    proto: createStaticProtoAdapter(),
    storage: createDefaultStorageAdapter(runtime),
    imageProcessor: resolveDefaultImageProcessor(platform, platformGlobal),
  };
};

const toCapability = (adapterSet: AdapterSet): PlatformCapability => {
  return {
    request: typeof adapterSet.request !== 'undefined',
    upload: typeof adapterSet.upload !== 'undefined',
    socket: typeof adapterSet.socket !== 'undefined',
    runtime: typeof adapterSet.runtime !== 'undefined',
    proto: typeof adapterSet.proto !== 'undefined',
    storage: typeof adapterSet.storage !== 'undefined',
    imageProcessor: typeof adapterSet.imageProcessor !== 'undefined',
  };
};

const resolveOverrides = (
  overrides: PlatformAdapterOverrides | PlatformAdapterOverridesResolver | undefined,
  defaults: AdapterSet
): PlatformAdapterOverrides => {
  if (!overrides) {
    return {};
  }
  if (typeof overrides === 'function') {
    return overrides(defaults as Readonly<PlatformAdapterOverrides>);
  }
  return overrides;
};

const resolveRequiredAdapter = <TAdapter>(
  adapter: TAdapter | undefined,
  capability: keyof PlatformCapability
): TAdapter => {
  if (typeof adapter !== 'undefined') {
    return adapter;
  }
  throw createPlatformError('Platform adapter initialization failed.', {
    code: PLATFORM_ERROR_CODE.INIT_FAILED,
    stage: PLATFORM_ERROR_STAGE.INIT,
    retryable: false,
    details: {
      capability,
    },
  });
};

export const detectRuntimePlatform = (
  prefer?: RuntimePlatform,
  runtimeInput?: RuntimeDetectionInput
): RuntimePlatform => {
  return resolveRuntimeEnv(runtimeInput, prefer).platform;
};

export const createPlatformAdapter = (
  options?: CreatePlatformAdapterOptions
): PlatformFactoryResult => {
  const runtime = globalThis as unknown as RuntimeDetectionInput;
  const env = resolveRuntimeEnv(runtime, options?.prefer);
  const platform = env.platform;
  const defaults = createDefaultAdapterSet(platform, runtime, env.global);
  const resolvedOverrides = resolveOverrides(options?.overrides, defaults);
  const adapterSet: AdapterSet = {
    ...defaults,
    ...resolvedOverrides,
  };

  const capability = toCapability(adapterSet);
  validatePlatformCapabilities(capability);

  const request = resolveRequiredAdapter(adapterSet.request, 'request');
  const upload = resolveRequiredAdapter(adapterSet.upload, 'upload');
  const socket = resolveRequiredAdapter(adapterSet.socket, 'socket');
  const runtimeAdapter = resolveRequiredAdapter(adapterSet.runtime, 'runtime');
  const proto = resolveRequiredAdapter(adapterSet.proto, 'proto');
  const storage = resolveRequiredAdapter(adapterSet.storage, 'storage');

  return {
    platform,
    platformId: platform,
    capability,
    request,
    upload,
    socket,
    runtime: runtimeAdapter,
    proto,
    storage,
    imageProcessor: adapterSet.imageProcessor,
  };
};
