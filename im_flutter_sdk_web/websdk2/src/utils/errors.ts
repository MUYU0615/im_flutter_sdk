/**
 * 错误处理类
 *
 * 统一的错误类型和错误码定义
 */

import { ERROR_CODES, type ErrorCode } from './error-codes';

export type ErrorDetails = Record<string, unknown>;

export interface ErrorContext {
  details?: ErrorDetails;
}

/**
 * SDK 错误类
 */
export class SDKError extends Error {
  public readonly code: ErrorCode;
  public readonly details?: ErrorDetails;

  constructor(message: string, code: ErrorCode = ERROR_CODES.UNKNOWN, context?: ErrorContext) {
    super(message);
    this.name = 'SDKError';
    this.code = code;
    this.details = context?.details;

    // 保持正确的堆栈跟踪
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SDKError);
    }
  }

  /**
   * 转换为 JSON
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      stack: this.stack,
    };
  }
}

/**
 * 网络错误
 */
export class NetworkError extends SDKError {
  constructor(message: string, context?: ErrorContext & { code?: ErrorCode }) {
    super(message, context?.code ?? ERROR_CODES.REST_NETWORK_ERROR, context);
    this.name = 'NetworkError';
  }
}

/**
 * 连接错误
 */
export class ConnectionError extends SDKError {
  constructor(message: string, context?: ErrorContext & { code?: ErrorCode }) {
    super(message, context?.code ?? ERROR_CODES.CONNECTION_WEBSOCKET_ERROR, context);
    this.name = 'ConnectionError';
  }
}

/**
 * 认证错误
 */
export class AuthenticationError extends SDKError {
  constructor(message: string, context?: ErrorContext & { code?: ErrorCode }) {
    super(message, context?.code ?? ERROR_CODES.AUTH_UNAUTHORIZED, context);
    this.name = 'AuthenticationError';
  }
}

/**
 * 验证错误
 */
export class ValidationError extends SDKError {
  constructor(message: string, context?: ErrorContext & { code?: ErrorCode }) {
    super(message, context?.code ?? ERROR_CODES.VALIDATION_UNKNOWN, context);
    this.name = 'ValidationError';
  }
}

/**
 * 消息发送错误
 */
export class MessageSendError extends SDKError {
  constructor(message: string, context?: ErrorContext & { code?: ErrorCode }) {
    super(message, context?.code ?? ERROR_CODES.MESSAGE_SEND_FAILED, context);
    this.name = 'MessageSendError';
  }
}

/**
 * 消息接收错误
 */
export class MessageReceiveError extends SDKError {
  constructor(message: string, context?: ErrorContext & { code?: ErrorCode }) {
    super(message, context?.code ?? ERROR_CODES.MESSAGE_DECODE_FAILED, context);
    this.name = 'MessageReceiveError';
  }
}

/**
 * 存储错误
 */
export class StorageError extends SDKError {
  constructor(message: string, context?: ErrorContext & { code?: ErrorCode }) {
    super(message, context?.code ?? ERROR_CODES.STORAGE_OPERATION_FAILED, context);
    this.name = 'StorageError';
  }
}

export class RestTransportError extends SDKError {
  constructor(message: string, context?: ErrorContext & { code?: ErrorCode }) {
    super(message, context?.code ?? ERROR_CODES.REST_NETWORK_ERROR, context);
    this.name = 'RestTransportError';
  }
}

export class RestBusinessError extends SDKError {
  constructor(message: string, context?: ErrorContext & { code?: ErrorCode }) {
    super(message, context?.code ?? ERROR_CODES.REST_BUSINESS_UNKNOWN, context);
    this.name = 'RestBusinessError';
  }
}

/**
 * 上传错误
 */
export class UploadError extends SDKError {
  constructor(message: string, context?: ErrorContext & { code?: ErrorCode }) {
    super(message, context?.code ?? ERROR_CODES.UPLOAD_REQUEST_FAILED, context);
    this.name = 'UploadError';
  }
}
