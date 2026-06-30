import { describe, expect, it } from 'vitest';
import {
  EXECUTION_POLICY,
  EXECUTION_POLICY_DEFINITIONS,
  isExecutionPolicyId,
} from '../test-utils/layered/execution-policy';
import { SCENARIO_CATALOG } from '../test-utils/layered/scenario-catalog';

describe('test-layer orchestrator contract', () => {
  it('执行策略必须包含 PR/NIGHTLY/RELEASE 三类', () => {
    const ids = EXECUTION_POLICY_DEFINITIONS.map(item => item.policyId);
    expect(ids).toContain(EXECUTION_POLICY.PR_GATE);
    expect(ids).toContain(EXECUTION_POLICY.NIGHTLY_FULL);
    expect(ids).toContain(EXECUTION_POLICY.RELEASE_GATE);
  });

  it('策略 ID 判定函数应正确识别合法输入', () => {
    expect(isExecutionPolicyId('pr_gate')).toBe(true);
    expect(isExecutionPolicyId('nightly_full')).toBe(true);
    expect(isExecutionPolicyId('release_gate')).toBe(true);
    expect(isExecutionPolicyId('unknown_policy')).toBe(false);
  });

  it('场景目录必须保持唯一 ID', () => {
    const ids = SCENARIO_CATALOG.map(item => item.scenarioId);
    const set = new Set(ids);
    expect(set.size).toBe(ids.length);
  });
});
