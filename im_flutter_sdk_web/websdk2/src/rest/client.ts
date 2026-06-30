/**
 * REST 客户端基础类
 *
 * 统一 Promise 返回，不使用回调
 */

import {
  AuthenticationError,
  RestBusinessError,
  RestTransportError,
  SDKError,
  ValidationError,
} from '../utils/errors';
import { ERROR_CODES } from '../utils/error-codes';
import { createRestBusinessError, resolveApiBusinessError } from './errors';
import type { RuntimeErrorMap } from './error-map-types';
import { REQUEST_TIMEOUT } from '../config/timeouts';
import { logger } from '../utils/logger'; // 日志工具

/**
 * HTTP 方法
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/**
 * 请求配置
 */
export interface RequestConfig {
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
  operation?: string;
}

export interface RestClientOptions {
  timeout?: number;
  headers?: Record<string, string>;
  errorMap?: RuntimeErrorMap;
}

/**
 * REST 客户端
 */
export class RestClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;
  private timeout: number;
  private errorMap: RuntimeErrorMap | undefined;

  constructor(baseUrl: string, options?: RestClientOptions) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // 移除尾部斜杠
    this.timeout = options?.timeout ?? REQUEST_TIMEOUT; // 默认 15 秒
    this.errorMap = options?.errorMap;
    this.defaultHeaders = {
      Accept: 'application/json',
      ...options?.headers,
    };
  }

  /**
   * 脱敏 URL（屏蔽 query 参数值）
   */
  private sanitizeUrl(url: string): string {
    // 脱敏 URL
    try {
      // 捕获解析异常
      const parsed = new URL(url); // 解析 URL
      const params = parsed.searchParams; // 读取 query 参数
      for (const key of params.keys()) {
        // 遍历参数键
        params.set(key, '***'); // 屏蔽参数值
      }
      const query = params.toString(); // 生成脱敏 query
      const search = query ? `?${query}` : ''; // 拼接 search
      return `${parsed.origin}${parsed.pathname}${search}`; // 返回脱敏 URL
    } catch {
      // 解析失败兜底
      return url.split('?')[0] ?? url; // 回退到无 query 的地址
    }
  }

  /**
   * 设置认证 token
   */
  setAuthToken(token: string): void {
    this.defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  /**
   * 移除认证 token
   */
  removeAuthToken(): void {
    delete this.defaultHeaders['Authorization'];
  }

  /**
   * 基于 HTTP 状态码的通用错误兜底
   */
  private buildHttpStatusFallbackError(
    status: number,
    context: { operation?: string; url: string; method: HttpMethod },
    serverCode?: number | string,
    serverMessage?: string
  ): SDKError | undefined {
    const validationUnknownMessage = 'Invalid request parameters';
    const tokenExpiredMessage = 'Authentication token expired';
    const forbiddenMessage = 'Access forbidden';
    const rateLimitMessage = 'REST rate limit exceeded';
    const businessUnknownMessage = 'REST business error: request failed';
    const details = {
      ...(context.operation ? { api: context.operation } : {}),
      url: context.url,
      method: context.method,
      httpStatus: status,
      serverCode,
      serverMessage,
      mapped: false,
    };

    if (status === 400) {
      return new ValidationError(validationUnknownMessage, {
        code: ERROR_CODES.VALIDATION_UNKNOWN,
        details: {
          ...details,
          canonicalCode: ERROR_CODES.VALIDATION_UNKNOWN,
        },
      });
    }

    if (status === 401) {
      return new AuthenticationError(tokenExpiredMessage, {
        code: ERROR_CODES.AUTH_TOKEN_EXPIRED,
        details: {
          ...details,
          canonicalCode: ERROR_CODES.AUTH_TOKEN_EXPIRED,
        },
      });
    }

    if (status === 403) {
      return new AuthenticationError(forbiddenMessage, {
        code: ERROR_CODES.AUTH_FORBIDDEN,
        details: {
          ...details,
          canonicalCode: ERROR_CODES.AUTH_FORBIDDEN,
        },
      });
    }

    if (status === 429) {
      return new RestBusinessError(rateLimitMessage, {
        code: ERROR_CODES.SERVICE_LIMIT_EXCEEDED,
        details: {
          ...details,
          retryable: true,
          reason: 'request_rate_limited',
          action: '降低请求频率后重试',
          canonicalCode: ERROR_CODES.SERVICE_LIMIT_EXCEEDED,
        },
      });
    }

    if (status >= 500) {
      return new RestBusinessError(businessUnknownMessage, {
        code: ERROR_CODES.REST_BUSINESS_UNKNOWN,
        details: {
          ...details,
          retryable: true,
          reason: 'server_unknown_error',
          action: '稍后重试或联系服务端排查',
          canonicalCode: ERROR_CODES.REST_BUSINESS_UNKNOWN,
        },
      });
    }

    return undefined;
  }

  /**
   * 发送请求
   */
  async request<T>(endpoint: string, config: RequestConfig = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const method = config.method ?? 'GET';
    const requestStart = Date.now(); // 记录请求开始时间
    const safeUrl = this.sanitizeUrl(url); // 脱敏 URL
    logger.debug('REST request', { method, url: safeUrl, operation: config.operation }); // 记录请求信息

    const headers: Record<string, string> = {
      ...this.defaultHeaders,
      ...config.headers,
    };

    const requestOptions: RequestInit = {
      method,
      headers,
    };

    if (config.body && method !== 'GET') {
      // 非 GET 请求处理 body
      const hasContentType = Object.keys(headers).some(key => key.toLowerCase() === 'content-type'); // 检查 content-type
      if (typeof config.body === 'string') {
        // 字符串 body
        if (!hasContentType) {
          // 未设置 content-type
          headers['Content-Type'] = 'application/x-www-form-urlencoded'; // 使用表单类型
        } // content-type 判断结束
        requestOptions.body = config.body; // 直接写入 body
      } else {
        // 非字符串 body
        if (!hasContentType) {
          // 未设置 content-type
          headers['Content-Type'] = 'application/json'; // 使用 JSON 类型
        } // content-type 判断结束
        requestOptions.body = JSON.stringify(config.body); // 序列化 body
      } // body 类型判断结束
    } else if (method === 'GET') {
      // GET 请求清理 content-type
      for (const key of Object.keys(headers)) {
        if (key.toLowerCase() === 'content-type') {
          delete headers[key];
        }
      }
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeout ?? this.timeout);

      const response = await fetch(url, {
        ...requestOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const duration = Date.now() - requestStart; // 计算请求耗时

      // 检查 HTTP 状态码
      if (!response.ok) {
        logger.warn('REST response error', {
          method,
          url: safeUrl,
          status: response.status,
          duration,
        }); // 记录响应错误
        await this.handleErrorResponse(response, {
          operation: config.operation,
          url,
          method,
        });
      }
      logger.debug('REST response', { method, url: safeUrl, status: response.status, duration }); // 记录响应成功

      // 解析响应
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return (await response.json()) as T;
      }

      return (await response.text()) as unknown as T;
    } catch (error) {
      if (error instanceof SDKError) {
        throw error; // SDKError 直接抛出
      }

      if (error instanceof Error && error.name === 'AbortError') {
        logger.warn('REST request timeout', {
          method,
          url: safeUrl,
          timeout: config.timeout ?? this.timeout,
        }); // 记录超时
        throw new RestTransportError(`Request timeout: ${url}`, {
          code: ERROR_CODES.REST_TIMEOUT,
          details: {
            url,
            method,
            timeout: config.timeout ?? this.timeout,
          },
        });
      }

      logger.warn('REST request failed', { method, url: safeUrl }); // 记录网络失败
      throw new RestTransportError(`Request failed: ${url}`, {
        code: ERROR_CODES.REST_NETWORK_ERROR,
        details: {
          url,
          method,
        },
      });
    }
  }

  /**
   * 处理错误响应
   */
  private async handleErrorResponse(
    response: Response,
    context: { operation?: string; url: string; method: HttpMethod }
  ): Promise<never> {
    let errorData: unknown;
    try {
      errorData = await response.json();
    } catch {
      errorData = await response.text();
    }

    const payload =
      errorData && typeof errorData === 'object' ? (errorData as Record<string, unknown>) : {};
    const businessEntry = resolveApiBusinessError(this.errorMap, context.operation, errorData);
    const reasonKey = typeof payload.error === 'string' ? payload.error : undefined;
    const serverCode =
      typeof payload.error_code === 'number' || typeof payload.error_code === 'string'
        ? payload.error_code
        : typeof payload.errorCode === 'number' || typeof payload.errorCode === 'string'
          ? payload.errorCode
          : typeof payload.code === 'number' || typeof payload.code === 'string'
        ? payload.code
        : typeof payload.error === 'string'
          ? payload.error
          : undefined;
    const serverMessage =
      typeof payload.message === 'string'
        ? payload.message
        : typeof payload.error_description === 'string'
          ? payload.error_description
          : undefined;
    const isGenericAuthFailure =
      (response.status === 401 || response.status === 403) &&
      (reasonKey === undefined ||
        reasonKey === 'unauthorized' ||
        reasonKey === 'auth_failed' ||
        reasonKey === 'forbidden');
    const hasBusinessPayloadHints =
      !isGenericAuthFailure &&
      (reasonKey !== undefined ||
        typeof payload.error_description === 'string' ||
        typeof payload.message === 'string');
    if (context.operation && businessEntry) {
      throw createRestBusinessError({
        apiName: context.operation,
        entry: businessEntry,
        serverCode,
        serverMessage,
        httpStatus: response.status,
        mapped: Boolean(businessEntry),
        reasonKey,
      });
    }

    const httpStatusFallbackError = this.buildHttpStatusFallbackError(
      response.status,
      context,
      serverCode,
      serverMessage
    );
    if (httpStatusFallbackError) {
      throw httpStatusFallbackError;
    }

    if (context.operation && hasBusinessPayloadHints) {
      throw createRestBusinessError({
        apiName: context.operation,
        serverCode,
        serverMessage,
        httpStatus: response.status,
        mapped: false,
        reasonKey,
      });
    }

    // 根据 HTTP 状态码创建相应的错误
    throw new RestTransportError(`HTTP ${response.status}: ${response.statusText}`, {
      code: ERROR_CODES.REST_HTTP_ERROR,
      details: {
        url: context.url,
        method: context.method,
        httpStatus: response.status,
      },
    });
  }

  /**
   * GET 请求
   */
  get<T>(endpoint: string, config?: Omit<RequestConfig, 'method' | 'body'>): Promise<T> {
    return this.request<T>(endpoint, { ...config, method: 'GET' });
  }

  /**
   * POST 请求
   */
  post<T>(endpoint: string, body?: unknown, config?: Omit<RequestConfig, 'method'>): Promise<T> {
    return this.request<T>(endpoint, { ...config, method: 'POST', body });
  }

  /**
   * PUT 请求
   */
  put<T>(endpoint: string, body?: unknown, config?: Omit<RequestConfig, 'method'>): Promise<T> {
    return this.request<T>(endpoint, { ...config, method: 'PUT', body });
  }

  /**
   * DELETE 请求
   */
  delete<T>(endpoint: string, config?: Omit<RequestConfig, 'method' | 'body'>): Promise<T> {
    return this.request<T>(endpoint, { ...config, method: 'DELETE' });
  }

  /**
   * PATCH 请求
   */
  patch<T>(endpoint: string, body?: unknown, config?: Omit<RequestConfig, 'method'>): Promise<T> {
    return this.request<T>(endpoint, { ...config, method: 'PATCH', body });
  }
}
