import { ERROR_CODES } from '../utils/error-codes';
import { RestBusinessError } from '../utils/errors';
import type { RuntimeApiErrorEntry, RuntimeErrorMap } from './error-map-types';

const normalizeServerCode = (payload: Record<string, unknown>): number | string | undefined => {
  if (typeof payload.error_code === 'string' || typeof payload.error_code === 'number') {
    return payload.error_code;
  }
  if (typeof payload.errorCode === 'string' || typeof payload.errorCode === 'number') {
    return payload.errorCode;
  }
  if (typeof payload.error === 'string' || typeof payload.error === 'number') {
    return payload.error;
  }
  if (typeof payload.code === 'string' || typeof payload.code === 'number') {
    return payload.code;
  }
  return undefined;
};

const matchesFieldConstraint = (
  entry: RuntimeApiErrorEntry,
  payload: Record<string, unknown>
): boolean => {
  if (!entry.matchField) {
    return false;
  }

  const actualValue = payload[entry.matchField];

  // 子串匹配：matchPattern
  if (entry.matchPattern !== undefined) {
    return typeof actualValue === 'string' && actualValue.includes(entry.matchPattern);
  }

  if (entry.matchValue === undefined) {
    return actualValue !== undefined;
  }

  if (actualValue === entry.matchValue) {
    return true;
  }

  if (
    (typeof actualValue === 'string' || typeof actualValue === 'number') &&
    (typeof entry.matchValue === 'string' || typeof entry.matchValue === 'number')
  ) {
    return String(actualValue) === String(entry.matchValue);
  }

  return false;
};

/**
 * 创建 API 错误
 */
export function resolveApiBusinessError(
  errorMap: RuntimeErrorMap | undefined,
  apiName: string | undefined,
  payload: unknown
): RuntimeApiErrorEntry | undefined {
  if (!errorMap || !apiName) {
    return undefined;
  }
  const definition = errorMap.apis[apiName];
  if (!definition) {
    return undefined;
  }

  const candidate =
    payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  const errorKey = typeof candidate.error === 'string' ? candidate.error : undefined;
  const serverCode = normalizeServerCode(candidate);
  const serverMessage =
    typeof candidate.error_description === 'string'
      ? candidate.error_description
      : typeof candidate.message === 'string'
        ? candidate.message
        : undefined;

  if (errorKey && definition.errors[errorKey]) {
    return definition.errors[errorKey];
  }

  const fieldMatchedEntry = Object.values(definition.errors).find(entry =>
    matchesFieldConstraint(entry, candidate)
  );
  if (fieldMatchedEntry) {
    return fieldMatchedEntry;
  }

  if (serverCode !== undefined) {
    return Object.values(definition.errors).find(entry => {
      if (entry.code === serverCode || entry.canonicalCode === serverCode) {
        return true;
      }
      return Array.isArray(entry.aliases) && entry.aliases.includes(String(serverCode));
    });
  }

  if (serverMessage) {
    return Object.values(definition.errors).find(entry => {
      return Array.isArray(entry.aliases) && entry.aliases.includes(serverMessage);
    });
  }

  return undefined;
}

export function resolveRestBusinessErrorMessage(options: {
  apiName?: string;
  entry?: RuntimeApiErrorEntry;
  mapped?: boolean;
  reasonKey?: string;
}): string {
  const operation = options.apiName ? `${options.apiName} failed` : 'request failed';
  if (options.mapped ?? Boolean(options.entry)) {
    return `REST business error: ${operation}`;
  }

  return options.reasonKey
    ? `REST business error: ${operation} (${options.reasonKey})`
    : `REST business error: ${operation}`;
}

export function createRestBusinessError(options: {
  apiName: string;
  message?: string;
  entry?: RuntimeApiErrorEntry;
  serverCode?: number | string;
  serverMessage?: string;
  httpStatus?: number;
  mapped?: boolean;
  reasonKey?: string;
}): RestBusinessError {
  const code = options.entry?.code ?? ERROR_CODES.REST_BUSINESS_UNKNOWN;
  const message =
    options.message ??
    resolveRestBusinessErrorMessage({
      apiName: options.apiName,
      entry: options.entry,
      mapped: options.mapped,
      reasonKey: options.reasonKey,
    });
  return new RestBusinessError(message, {
    code,
    details: {
      api: options.apiName,
      serverCode: options.serverCode ?? options.entry?.code ?? code,
      serverMessage: options.serverMessage,
      httpStatus: options.httpStatus,
      mapped: options.mapped ?? Boolean(options.entry),
      reasonKey: options.reasonKey,
      retryable: options.entry?.retryable,
      canonicalCode: options.entry?.canonicalCode ?? options.entry?.code,
    },
  });
}
