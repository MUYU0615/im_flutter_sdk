/**
 * 平台能力校验器
 */

import {
  PLATFORM_ERROR_CODE,
  PLATFORM_ERROR_STAGE,
  createPlatformError,
  type PlatformCapability,
} from './types';

export const DEFAULT_REQUIRED_CAPABILITIES: ReadonlyArray<keyof PlatformCapability> = [
  'request',
  'upload',
  'socket',
  'proto',
];

export const resolveMissingCapabilities = (
  capability: PlatformCapability,
  requiredCapabilities: ReadonlyArray<keyof PlatformCapability> = DEFAULT_REQUIRED_CAPABILITIES
): string[] => {
  return requiredCapabilities.filter(item => !capability[item]);
};

export const validatePlatformCapabilities = (
  capability: PlatformCapability,
  requiredCapabilities: ReadonlyArray<keyof PlatformCapability> = DEFAULT_REQUIRED_CAPABILITIES
): void => {
  const missingCapabilities = resolveMissingCapabilities(capability, requiredCapabilities);
  if (missingCapabilities.length === 0) {
    return;
  }
  throw createPlatformError('Platform missing required capabilities.', {
    code: PLATFORM_ERROR_CODE.MISSING_CAPABILITY,
    stage: PLATFORM_ERROR_STAGE.INIT,
    retryable: false,
    details: {
      required: [...requiredCapabilities],
      missing: missingCapabilities,
    },
  });
};
