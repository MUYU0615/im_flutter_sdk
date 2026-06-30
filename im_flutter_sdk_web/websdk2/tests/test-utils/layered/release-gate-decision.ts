export interface ReleaseGateDecisionInput {
  readonly hasRecentE2ePass: boolean;
  readonly strictMode: boolean;
}

export interface ReleaseGateDecision {
  readonly allowed: boolean;
  readonly reason: string;
}

export const decideReleaseGate = (input: ReleaseGateDecisionInput): ReleaseGateDecision => {
  if (!input.strictMode) {
    return {
      allowed: true,
      reason: '非严格模式放行',
    };
  }
  if (!input.hasRecentE2ePass) {
    return {
      allowed: false,
      reason: '缺少最近一次 E2E 通过记录',
    };
  }
  return {
    allowed: true,
    reason: '满足发布前 E2E 门禁',
  };
};
