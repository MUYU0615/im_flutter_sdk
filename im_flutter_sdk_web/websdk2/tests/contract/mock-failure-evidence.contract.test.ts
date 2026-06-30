import { describe, expect, it } from 'vitest';
import { createFailureEvidence } from '../test-utils/layered/failure-evidence';

describe('mock 异常失败证据契约', () => {
  it('mock 异常证据应包含场景与层级字段', () => {
    const evidence = createFailureEvidence({
      runId: 'mock-run-001',
      layerId: 'protocol_integration',
      scenarioId: 'MOCK_INVALID_PAYLOAD',
      failureType: 'protocol_mismatch',
      message: 'mock payload 解析失败',
      retryCount: 0,
    });
    expect(evidence.layerId).toBe('protocol_integration');
    expect(evidence.scenarioId).toBe('MOCK_INVALID_PAYLOAD');
    expect(evidence.failureType).toBe('protocol_mismatch');
    expect(evidence.occurredAt.length).toBeGreaterThan(0);
  });
});
