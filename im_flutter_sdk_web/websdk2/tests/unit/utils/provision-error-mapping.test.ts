import { describe, expect, it } from 'vitest';

import { ProvisionErrorCode } from '@/protocol/msync/types';
import { ERROR_CODES } from '@/utils/error-codes';
import { resolveProvisionError, resolveProvisionErrorCode } from '@/utils/provision-error-mapping';

describe('provision-error-mapping', () => {
  it('FAIL + reason 应优先走 reason 映射', () => {
    const result = resolveProvisionError(
      ProvisionErrorCode.FAIL,
      'Sorry, user register rate limit'
    );

    expect(result.code).toBe(ERROR_CODES.SERVICE_LIMIT_EXCEEDED);
    expect(result.retryable).toBe(false);
  });

  it('缺少 statusCode 时应返回 UNKNOWN 且可重试', () => {
    const result = resolveProvisionError(undefined);

    expect(result.code).toBe(ERROR_CODES.UNKNOWN);
    expect(result.retryable).toBe(true);
  });

  it('resolveProvisionErrorCode 兼容接口应仅返回 code', () => {
    const code = resolveProvisionErrorCode(
      ProvisionErrorCode.PERMISSION_DENIED,
      'Sorry, the app month live count limit'
    );

    expect(code).toBe(ERROR_CODES.SERVICE_LIMIT_EXCEEDED);
  });

  it('RESOURCE_CHANGED 应映射为 USER_DEVICE_CHANGED', () => {
    const result = resolveProvisionError(ProvisionErrorCode.RESOURCE_CHANGED);

    expect(result.code).toBe(ERROR_CODES.USER_DEVICE_CHANGED);
    expect(result.retryable).toBe(false);
  });
});
