/**
 * Web 平台请求适配器
 */

import {
  PLATFORM_ERROR_CODE,
  PLATFORM_ERROR_STAGE,
  createPlatformError,
  type RequestAdapter,
  type RequestConfig,
  type RequestResponse,
} from '../types';

const DEFAULT_TIMEOUT_MS = 15_000;

export interface WebRequestAdapterOptions {
  readonly fetchImpl?: typeof fetch;
  readonly timeoutMs?: number;
}

const toHeaderRecord = (headers: Headers): Record<string, string> => {
  const output: Record<string, string> = {};
  headers.forEach((value, key) => {
    output[key] = value;
  });
  return output;
};

const resolveRequestBody = (
  config: RequestConfig,
  headers: Record<string, string>,
  method: string
): BodyInit | undefined => {
  if (config.body instanceof Uint8Array) {
    return new Uint8Array(config.body).buffer;
  }
  if (typeof config.body === 'string') {
    return config.body;
  }
  if (config.body && method !== 'GET') {
    const hasContentType = Object.keys(headers).some(key => key.toLowerCase() === 'content-type');
    if (!hasContentType) {
      headers['Content-Type'] = 'application/json';
    }
    return JSON.stringify(config.body);
  }
  return undefined;
};

export const createWebRequestAdapter = (
  options?: WebRequestAdapterOptions
): RequestAdapter | undefined => {
  const fetchImpl = options?.fetchImpl;
  if (typeof fetchImpl !== 'function') {
    return undefined;
  }

  return {
    async request<TData>(config: RequestConfig): Promise<RequestResponse<TData>> {
      const method = config.method ?? 'GET';
      const headers = { ...(config.headers ?? {}) };
      const controller = new AbortController();
      const timeoutMs = config.timeoutMs ?? options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, timeoutMs);

      const body = resolveRequestBody(config, headers, method);

      try {
        const response = await fetchImpl(config.url, {
          method,
          headers,
          body,
          signal: config.signal ?? controller.signal,
        });
        let parsed: unknown;
        if (config.responseType === 'arraybuffer') {
          parsed = await response.arrayBuffer();
        } else if (config.responseType === 'text') {
          parsed = await response.text();
        } else {
          const contentType = response.headers.get('content-type') ?? '';
          const text = await response.text();
          parsed =
            contentType.includes('application/json') && text ? (JSON.parse(text) as unknown) : text;
        }

        return {
          status: response.status,
          headers: toHeaderRecord(response.headers),
          data: parsed as TData,
        };
      } catch (error) {
        throw createPlatformError('Request adapter execution failed.', {
          code: PLATFORM_ERROR_CODE.REQUEST_FAILED,
          stage: PLATFORM_ERROR_STAGE.REQUEST,
          retryable: true,
          details: {
            url: config.url,
            method,
            cause: error instanceof Error ? error.message : String(error),
          },
        });
      } finally {
        clearTimeout(timeoutId);
      }
    },
  };
};
