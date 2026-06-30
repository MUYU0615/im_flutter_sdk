import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const CONTRACT_PATH = resolve(
  process.cwd(),
  'specs/021-push-manager/contracts/push-manager.openapi.yaml'
);

describe('push-manager contract', () => {
  it('应包含核心 push manager 路径', () => {
    const content = readFileSync(CONTRACT_PATH, 'utf8');
    expect(content).toContain('openapi: 3.0.3');
    expect(content).toContain('/sdk/push/token:');
    expect(content).toContain('/sdk/push/silent-mode/global:');
    expect(content).toContain('/sdk/push/silent-mode/conversations:batch-query:');
    expect(content).toContain('/sdk/push/language:');
    expect(content).toContain('/sdk/push/silent-mode/muted-conversations:');
  });

  it('应约束会话类型和批量上限', () => {
    const content = readFileSync(CONTRACT_PATH, 'utf8');
    expect(content).toContain('enum: [singleChat, groupChat]');
    expect(content).toContain('maxItems: 20');
    expect(content).toContain('expireTimestamp');
  });
});
