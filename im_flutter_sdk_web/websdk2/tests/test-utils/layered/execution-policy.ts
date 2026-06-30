export const EXECUTION_POLICY = {
  PR_GATE: 'pr_gate',
  NIGHTLY_FULL: 'nightly_full',
  RELEASE_GATE: 'release_gate',
} as const;

export type ExecutionPolicyId = (typeof EXECUTION_POLICY)[keyof typeof EXECUTION_POLICY];

export interface ExecutionPolicyDefinition {
  readonly policyId: ExecutionPolicyId;
  readonly includedLayers: ReadonlyArray<'unit' | 'protocol_integration' | 'e2e_browser'>;
  readonly timeoutBudgetMinutes: number;
}

export const EXECUTION_POLICY_DEFINITIONS: ReadonlyArray<ExecutionPolicyDefinition> = [
  {
    policyId: EXECUTION_POLICY.PR_GATE,
    includedLayers: ['unit', 'protocol_integration'],
    timeoutBudgetMinutes: 10,
  },
  {
    policyId: EXECUTION_POLICY.NIGHTLY_FULL,
    includedLayers: ['unit', 'protocol_integration', 'e2e_browser'],
    timeoutBudgetMinutes: 30,
  },
  {
    policyId: EXECUTION_POLICY.RELEASE_GATE,
    includedLayers: ['unit', 'protocol_integration', 'e2e_browser'],
    timeoutBudgetMinutes: 30,
  },
];

export const isExecutionPolicyId = (value: string): value is ExecutionPolicyId => {
  return (
    value === EXECUTION_POLICY.PR_GATE ||
    value === EXECUTION_POLICY.NIGHTLY_FULL ||
    value === EXECUTION_POLICY.RELEASE_GATE
  );
};
