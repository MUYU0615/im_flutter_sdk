import { mkdirSync, appendFileSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';

export type FailureType = 'assertion' | 'env_unreachable' | 'timeout' | 'protocol_mismatch';

export interface FailureEvidence {
  readonly runId: string;
  readonly layerId: 'unit' | 'protocol_integration' | 'e2e_browser' | 'smoke_real_env';
  readonly scenarioId: string;
  readonly failureType: FailureType;
  readonly message: string;
  readonly occurredAt: string;
  readonly retryCount: number;
}

export const createFailureEvidence = (
  input: Omit<FailureEvidence, 'occurredAt'>
): FailureEvidence => {
  return {
    ...input,
    occurredAt: new Date().toISOString(),
  };
};

export const writeFailureEvidence = (
  evidence: FailureEvidence,
  filePath: string = 'coverage/layered-evidence/failures.ndjson'
): void => {
  const absolutePath = resolvePath(process.cwd(), filePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  appendFileSync(absolutePath, `${JSON.stringify(evidence)}\n`, 'utf8');
};
