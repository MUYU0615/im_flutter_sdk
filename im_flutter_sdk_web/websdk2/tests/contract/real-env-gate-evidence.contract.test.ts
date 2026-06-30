import { describe, expect, it } from 'vitest';
import { createFailureEvidence } from '../test-utils/layered/failure-evidence';

describe('真实环境门禁失败证据契约', () => {
  it('env_unreachable 证据必须包含关键字段', () => {
    const evidence = createFailureEvidence({
      runId: 'run-001',
      layerId: 'smoke_real_env',
      scenarioId: 'REAL_ENV_UNREACHABLE_RETRY_BLOCK',
      failureType: 'env_unreachable',
      message: '真实环境不可达，重试后仍失败',
      retryCount: 2,
    });
    expect(evidence.runId).toBe('run-001');
    expect(evidence.layerId).toBe('smoke_real_env');
    expect(evidence.scenarioId).toBe('REAL_ENV_UNREACHABLE_RETRY_BLOCK');
    expect(evidence.failureType).toBe('env_unreachable');
    expect(typeof evidence.occurredAt).toBe('string');
    expect(evidence.retryCount).toBeGreaterThanOrEqual(0);
  });
});
