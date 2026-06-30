import { describe, expect, it } from 'vitest';

import {
  PLATFORM_ERROR_CODE,
  PLATFORM_ERROR_STAGE,
  RUNTIME_PLATFORMS,
  createPlatformAdapter,
} from '../../../src/platform';

type PlatformInitError = Error & {
  readonly code?: string;
  readonly stage?: string;
  readonly retryable?: boolean;
  readonly details?: {
    readonly missing?: ReadonlyArray<string>;
    readonly required?: ReadonlyArray<string>;
  };
};

describe('platform/missing-capability-init', () => {
  it('关键能力缺失时返回统一错误契约', () => {
    let captured: PlatformInitError | null = null;

    try {
      createPlatformAdapter({
        prefer: RUNTIME_PLATFORMS.UNKNOWN,
        overrides: {
          request: undefined,
          upload: undefined,
          socket: undefined,
          proto: undefined,
        },
      });
    } catch (error) {
      captured = error as PlatformInitError;
    }

    expect(captured).toBeTruthy();
    expect(captured?.code).toBe(PLATFORM_ERROR_CODE.MISSING_CAPABILITY);
    expect(captured?.stage).toBe(PLATFORM_ERROR_STAGE.INIT);
    expect(captured?.retryable).toBe(false);
    expect(captured?.details?.missing).toEqual(['request', 'upload', 'socket', 'proto']);
    expect(captured?.details?.required).toEqual(['request', 'upload', 'socket', 'proto']);
  });

  it('可定位单项能力缺失字段', () => {
    let captured: PlatformInitError | null = null;

    try {
      createPlatformAdapter({
        prefer: RUNTIME_PLATFORMS.WEB,
        overrides: {
          socket: undefined,
        },
      });
    } catch (error) {
      captured = error as PlatformInitError;
    }

    expect(captured).toBeTruthy();
    expect(captured?.code).toBe(PLATFORM_ERROR_CODE.MISSING_CAPABILITY);
    expect(captured?.details?.missing).toEqual(['socket']);
  });
});
