/**
 * Web 平台上传适配器
 */

import {
  PLATFORM_ERROR_CODE,
  PLATFORM_ERROR_STAGE,
  createPlatformError,
  type UploadAdapter,
  type UploadConfig,
  type UploadResult,
} from '../types';

const DEFAULT_TIMEOUT_MS = 30_000;

export interface WebUploadAdapterOptions {
  readonly xhrFactory?: () => XMLHttpRequest;
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
}

const resolveXhrError = (reason: 'abort' | 'timeout' | 'network', config: UploadConfig): never => {
  throw createPlatformError('Upload adapter execution failed.', {
    code: PLATFORM_ERROR_CODE.UPLOAD_FAILED,
    stage: PLATFORM_ERROR_STAGE.UPLOAD,
    retryable: reason !== 'abort',
    details: {
      reason,
      url: config.url,
    },
  });
};

const appendUploadSource = (formData: FormData, config: UploadConfig): void => {
  if (config.source.sourceType !== 'web-file') {
    throw createPlatformError('Web upload adapter only supports web-file source.', {
      code: PLATFORM_ERROR_CODE.UPLOAD_FAILED,
      stage: PLATFORM_ERROR_STAGE.UPLOAD,
      retryable: false,
      details: {
        sourceType: config.source.sourceType,
      },
    });
  }

  const file = config.source.file;
  if (!file) {
    throw createPlatformError('Upload source file is required for web-file uploads.', {
      code: PLATFORM_ERROR_CODE.UPLOAD_FAILED,
      stage: PLATFORM_ERROR_STAGE.UPLOAD,
      retryable: false,
      details: {
        sourceType: config.source.sourceType,
      },
    });
  }

  const hasBlob = typeof Blob !== 'undefined' && file instanceof Blob;
  const fileName = config.source.name ?? 'upload.bin';

  if (hasBlob) {
    formData.append('file', file, fileName);
    return;
  }

  formData.append('file', file);
};

const createFormData = (config: UploadConfig): FormData => {
  const formData = new FormData();
  Object.entries(config.fields ?? {}).forEach(([key, value]) => {
    formData.append(key, value);
  });
  appendUploadSource(formData, config);
  return formData;
};

const setupProgressHandler = (xhr: XMLHttpRequest, config: UploadConfig): void => {
  if (!xhr.upload || !config.onProgress) {
    return;
  }

  xhr.upload.addEventListener('progress', event => {
    if (!event.lengthComputable) {
      config.onProgress?.({
        loaded: event.loaded,
      });
      return;
    }

    const percent = event.total > 0 ? (event.loaded / event.total) * 100 : undefined;
    config.onProgress?.({
      loaded: event.loaded,
      total: event.total,
      percent,
    });
  });
};

const setupHeaders = (xhr: XMLHttpRequest, headers: Record<string, string> | undefined): void => {
  Object.entries(headers ?? {}).forEach(([key, value]) => {
    xhr.setRequestHeader(key, value);
  });
};

const uploadByXhr = (
  xhrFactory: () => XMLHttpRequest,
  options: WebUploadAdapterOptions | undefined,
  config: UploadConfig
): Promise<UploadResult> => {
  return new Promise<UploadResult>((resolve, reject) => {
    const xhr = xhrFactory();
    const timeoutMs = config.timeoutMs ?? options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    setupProgressHandler(xhr, config);

    xhr.addEventListener('abort', () => {
      try {
        resolveXhrError('abort', config);
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });

    xhr.addEventListener('timeout', () => {
      try {
        resolveXhrError('timeout', config);
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });

    xhr.addEventListener('error', () => {
      try {
        resolveXhrError('network', config);
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });

    xhr.addEventListener('load', () => {
      resolve({
        status: xhr.status,
        body: xhr.responseText,
      });
    });

    try {
      const formData = createFormData(config);
      xhr.timeout = timeoutMs;
      xhr.open('POST', config.url);
      setupHeaders(xhr, config.headers);
      xhr.send(formData);
    } catch (error) {
      reject(
        createPlatformError('Upload adapter execution failed.', {
          code: PLATFORM_ERROR_CODE.UPLOAD_FAILED,
          stage: PLATFORM_ERROR_STAGE.UPLOAD,
          retryable: false,
          details: {
            url: config.url,
            reason: 'invalid-config',
            cause: error instanceof Error ? error.message : String(error),
          },
        })
      );
    }
  });
};

const resolveAbortReason = (
  timedOut: boolean,
  configSignal: AbortSignal | undefined
): 'timeout' | 'abort' => {
  if (timedOut) {
    return 'timeout';
  }
  if (configSignal?.aborted) {
    return 'abort';
  }
  return 'abort';
};

const resolveRequestSignal = (
  configSignal: AbortSignal | undefined,
  controller: AbortController | undefined
): AbortSignal | undefined => {
  return configSignal ?? controller?.signal;
};

const uploadByFetch = async (
  fetchImpl: typeof fetch,
  options: WebUploadAdapterOptions | undefined,
  config: UploadConfig
): Promise<UploadResult> => {
  const timeoutMs = config.timeoutMs ?? options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let timedOut = false;
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
  const timeoutId =
    controller && Number.isFinite(timeoutMs)
      ? setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, timeoutMs)
      : undefined;
  const requestSignal = resolveRequestSignal(config.signal, controller);

  try {
    const formData = createFormData(config);
    const response = await fetchImpl(config.url, {
      method: 'POST',
      headers: config.headers,
      body: formData,
      signal: requestSignal,
    });
    const body = await response.text();
    const totalSize = config.source.size;
    if (typeof totalSize === 'number') {
      config.onProgress?.({
        loaded: totalSize,
        total: totalSize,
        percent: totalSize > 0 ? 100 : undefined,
      });
    }
    return {
      status: response.status,
      body,
    };
  } catch (error) {
    const isAbortError = error instanceof Error && error.name === 'AbortError';
    throw createPlatformError('Upload adapter execution failed.', {
      code: PLATFORM_ERROR_CODE.UPLOAD_FAILED,
      stage: PLATFORM_ERROR_STAGE.UPLOAD,
      retryable: !isAbortError,
      details: {
        reason: isAbortError ? resolveAbortReason(timedOut, requestSignal) : 'network',
        url: config.url,
        cause: error instanceof Error ? error.message : String(error),
      },
    });
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

export const createWebUploadAdapter = (
  options?: WebUploadAdapterOptions
): UploadAdapter | undefined => {
  const hasExplicitXhrFactory = Boolean(options && 'xhrFactory' in options);
  const xhrFactory = hasExplicitXhrFactory
    ? options?.xhrFactory
    : typeof XMLHttpRequest !== 'undefined'
      ? (): XMLHttpRequest => new XMLHttpRequest()
      : undefined;
  const fetchImpl = options?.fetchImpl;

  if (typeof xhrFactory !== 'function' && typeof fetchImpl !== 'function') {
    return undefined;
  }

  return {
    upload(config: UploadConfig): Promise<UploadResult> {
      if (typeof xhrFactory === 'function') {
        return uploadByXhr(xhrFactory, options, config);
      }
      if (typeof fetchImpl === 'function') {
        return uploadByFetch(fetchImpl, options, config);
      }
      throw createPlatformError('Upload adapter execution failed.', {
        code: PLATFORM_ERROR_CODE.UPLOAD_FAILED,
        stage: PLATFORM_ERROR_STAGE.UPLOAD,
        retryable: false,
        details: {
          reason: 'missing-upload-runtime',
          url: config.url,
        },
      });
    },
  };
};
