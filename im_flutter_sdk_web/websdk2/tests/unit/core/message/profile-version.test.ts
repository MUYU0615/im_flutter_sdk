import { describe, expect, it } from 'vitest';

import {
  MAX_PROFILE_VERSION_SECONDS,
  normalizeProfileVersionFromTimestamp,
  normalizeProfileVersionSeconds,
} from '@/core/message/profile-sync/profile-version';

describe('profile version normalization', () => {
  it('应将毫秒时间戳归一化为秒级版本', () => {
    expect(normalizeProfileVersionFromTimestamp(1774495459340)).toBe(1774495459);
    expect(normalizeProfileVersionFromTimestamp(1774496262500)).toBe(1774496262);
  });

  it('应保留已是秒级的版本值', () => {
    expect(normalizeProfileVersionFromTimestamp(1774495459)).toBe(1774495459);
    expect(normalizeProfileVersionSeconds(1774495459)).toBe(1774495459);
  });

  it('应拒绝超出 int32 上限或非法的版本值', () => {
    expect(normalizeProfileVersionSeconds(MAX_PROFILE_VERSION_SECONDS + 1)).toBeUndefined();
    expect(normalizeProfileVersionFromTimestamp(undefined)).toBeUndefined();
    expect(normalizeProfileVersionSeconds(-1)).toBeUndefined();
  });
});
