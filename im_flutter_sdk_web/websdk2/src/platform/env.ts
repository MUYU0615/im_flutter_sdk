import { RUNTIME_PLATFORMS, type RuntimePlatform } from './types';

export interface MiniProgramRuntimeLike {
  readonly request?: (...args: ReadonlyArray<unknown>) => unknown;
  readonly connectSocket?: (...args: ReadonlyArray<unknown>) => unknown;
  readonly uploadFile?: (...args: ReadonlyArray<unknown>) => unknown;
  readonly getImageInfo?: (...args: ReadonlyArray<unknown>) => unknown;
  readonly compressImage?: (...args: ReadonlyArray<unknown>) => unknown;
  readonly getFileSystemManager?: (...args: ReadonlyArray<unknown>) => unknown;
  readonly canIUse?: (...args: ReadonlyArray<unknown>) => unknown;
  readonly getSystemInfo?: (...args: ReadonlyArray<unknown>) => unknown;
  readonly onNetworkStatusChange?: (...args: ReadonlyArray<unknown>) => unknown;
  readonly offNetworkStatusChange?: (...args: ReadonlyArray<unknown>) => unknown;
  readonly onAppShow?: (...args: ReadonlyArray<unknown>) => unknown;
  readonly offAppShow?: (...args: ReadonlyArray<unknown>) => unknown;
  readonly onAppHide?: (...args: ReadonlyArray<unknown>) => unknown;
  readonly offAppHide?: (...args: ReadonlyArray<unknown>) => unknown;
  readonly getNetworkType?: (...args: ReadonlyArray<unknown>) => unknown;
  readonly getStorageSync?: (...args: ReadonlyArray<unknown>) => unknown;
  readonly setStorageSync?: (...args: ReadonlyArray<unknown>) => unknown;
  readonly removeStorageSync?: (...args: ReadonlyArray<unknown>) => unknown;
  readonly getStorage?: (...args: ReadonlyArray<unknown>) => unknown;
  readonly setStorage?: (...args: ReadonlyArray<unknown>) => unknown;
  readonly removeStorage?: (...args: ReadonlyArray<unknown>) => unknown;
}

export interface RuntimeDetectionInput {
  readonly wx?: MiniProgramRuntimeLike;
  readonly qq?: MiniProgramRuntimeLike;
  readonly tt?: MiniProgramRuntimeLike;
  readonly swan?: MiniProgramRuntimeLike;
  readonly my?: MiniProgramRuntimeLike;
  readonly dd?: MiniProgramRuntimeLike;
  readonly uni?: MiniProgramRuntimeLike;
  readonly __uniConfig?: unknown;
  readonly skipWaiting?: () => Promise<void>;
  readonly registration?: unknown;
  readonly navigator?: {
    readonly product?: string;
    readonly onLine?: boolean;
  };
  readonly process?: {
    readonly versions?: {
      readonly electron?: string;
    };
  };
  readonly window?: Window;
  readonly document?: Document;
  readonly localStorage?: Storage;
  readonly fetch?: typeof fetch;
  readonly WebSocket?: typeof WebSocket;
  readonly XMLHttpRequest?: typeof XMLHttpRequest;
  readonly FormData?: typeof FormData;
  readonly TextEncoder?: typeof TextEncoder;
  readonly TextDecoder?: typeof TextDecoder;
}

export interface RuntimeEnvInfo {
  readonly platform: RuntimePlatform;
  readonly global: RuntimeDetectionInput | MiniProgramRuntimeLike;
}

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

const hasMiniBaseEvent = (value: unknown): value is MiniProgramRuntimeLike => {
  return hasFunction(value, 'canIUse') && hasFunction(value, 'getSystemInfo');
};

const hasMiniCoreApis = (value: unknown): value is MiniProgramRuntimeLike => {
  return hasFunction(value, 'request') && hasFunction(value, 'connectSocket');
};

export const isMiniProgramRuntime = (value: unknown): value is MiniProgramRuntimeLike => {
  return hasMiniBaseEvent(value) || hasMiniCoreApis(value);
};

const resolvePreferredMiniProgramGlobal = (
  runtime: RuntimeDetectionInput,
  platform: RuntimePlatform
): MiniProgramRuntimeLike | undefined => {
  if (platform === RUNTIME_PLATFORMS.WECHAT_MINIAPP) {
    return runtime.wx;
  }
  if (platform === RUNTIME_PLATFORMS.QQ_MINIAPP) {
    return runtime.qq;
  }
  if (platform === RUNTIME_PLATFORMS.TOUTIAO_MINIAPP) {
    return runtime.tt;
  }
  if (platform === RUNTIME_PLATFORMS.BAIDU_MINIAPP) {
    return runtime.swan;
  }
  if (platform === RUNTIME_PLATFORMS.ALIPAY_MINIAPP) {
    return runtime.my;
  }
  if (platform === RUNTIME_PLATFORMS.DINGTALK_MINIAPP) {
    return runtime.dd;
  }
  if (platform === RUNTIME_PLATFORMS.UNIAPP) {
    return runtime.uni;
  }
  return undefined;
};

export const isWebRuntime = (runtime: RuntimeDetectionInput): boolean => {
  return typeof runtime.window !== 'undefined' && typeof runtime.document !== 'undefined';
};

const isReactNativeRuntime = (runtime: RuntimeDetectionInput): boolean => {
  return runtime.navigator?.product === 'ReactNative';
};

const isElectronRuntime = (runtime: RuntimeDetectionInput): boolean => {
  return typeof runtime.process?.versions?.electron === 'string';
};

const isServiceWorkerRuntime = (runtime: RuntimeDetectionInput): boolean => {
  const hasWindowOrDocument =
    typeof runtime.window !== 'undefined' || typeof runtime.document !== 'undefined';
  if (hasWindowOrDocument || typeof runtime.fetch !== 'function') {
    return false;
  }
  return typeof runtime.skipWaiting === 'function' || typeof runtime.registration !== 'undefined';
};

export const resolveRuntimeEnv = (
  runtimeInput?: RuntimeDetectionInput,
  prefer?: RuntimePlatform
): RuntimeEnvInfo => {
  const runtime = runtimeInput ?? (globalThis as unknown as RuntimeDetectionInput);

  if (prefer) {
    return {
      platform: prefer,
      global: resolvePreferredMiniProgramGlobal(runtime, prefer) ?? runtime,
    };
  }

  if (isMiniProgramRuntime(runtime.swan)) {
    return { platform: RUNTIME_PLATFORMS.BAIDU_MINIAPP, global: runtime.swan };
  }
  if (isMiniProgramRuntime(runtime.tt)) {
    return { platform: RUNTIME_PLATFORMS.TOUTIAO_MINIAPP, global: runtime.tt };
  }
  if (isMiniProgramRuntime(runtime.dd)) {
    return { platform: RUNTIME_PLATFORMS.DINGTALK_MINIAPP, global: runtime.dd };
  }
  if (isMiniProgramRuntime(runtime.my)) {
    return { platform: RUNTIME_PLATFORMS.ALIPAY_MINIAPP, global: runtime.my };
  }
  if (isMiniProgramRuntime(runtime.wx)) {
    return { platform: RUNTIME_PLATFORMS.WECHAT_MINIAPP, global: runtime.wx };
  }
  if (isMiniProgramRuntime(runtime.qq)) {
    return { platform: RUNTIME_PLATFORMS.QQ_MINIAPP, global: runtime.qq };
  }
  if (isMiniProgramRuntime(runtime.uni) || typeof runtime.__uniConfig !== 'undefined') {
    return { platform: RUNTIME_PLATFORMS.UNIAPP, global: runtime.uni ?? runtime };
  }
  if (isReactNativeRuntime(runtime)) {
    return { platform: RUNTIME_PLATFORMS.REACT_NATIVE, global: runtime };
  }
  if (isElectronRuntime(runtime)) {
    return {
      platform: isWebRuntime(runtime)
        ? RUNTIME_PLATFORMS.ELECTRON_RENDERER
        : RUNTIME_PLATFORMS.ELECTRON_MAIN,
      global: runtime,
    };
  }
  if (isServiceWorkerRuntime(runtime) || isWebRuntime(runtime)) {
    return { platform: RUNTIME_PLATFORMS.WEB, global: runtime };
  }
  return { platform: RUNTIME_PLATFORMS.UNKNOWN, global: runtime };
};

export const isMiniProgramPlatform = (platform: RuntimePlatform): boolean => {
  return (
    platform === RUNTIME_PLATFORMS.WECHAT_MINIAPP ||
    platform === RUNTIME_PLATFORMS.QQ_MINIAPP ||
    platform === RUNTIME_PLATFORMS.TOUTIAO_MINIAPP ||
    platform === RUNTIME_PLATFORMS.BAIDU_MINIAPP ||
    platform === RUNTIME_PLATFORMS.ALIPAY_MINIAPP ||
    platform === RUNTIME_PLATFORMS.DINGTALK_MINIAPP ||
    platform === RUNTIME_PLATFORMS.UNIAPP
  );
};
