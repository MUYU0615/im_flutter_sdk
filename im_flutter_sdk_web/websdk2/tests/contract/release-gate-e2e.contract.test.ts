import { describe, expect, it } from 'vitest';
import { decideReleaseGate } from '../test-utils/layered/release-gate-decision';

describe('发布前 E2E 门禁契约', () => {
  it('严格模式下，缺少最近 E2E 通过记录应拒绝放行', () => {
    const decision = decideReleaseGate({
      hasRecentE2ePass: false,
      strictMode: true,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('缺少最近一次 E2E 通过记录');
  });

  it('严格模式下，存在最近 E2E 通过记录应允许放行', () => {
    const decision = decideReleaseGate({
      hasRecentE2ePass: true,
      strictMode: true,
    });
    expect(decision.allowed).toBe(true);
  });
});
