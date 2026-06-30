import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const CONTRACT_PATH = resolve(
  process.cwd(),
  'specs/025-contact-manager-api/contracts/contact-manager.openapi.yaml'
);

describe('contact-manager contract', () => {
  it('应包含联系人关系与黑名单核心路径', () => {
    const content = readFileSync(CONTRACT_PATH, 'utf8');

    expect(content).toContain('openapi: 3.0.3');
    expect(content).toContain('/sdk/contact-manager/contacts:');
    expect(content).toContain('/sdk/contact-manager/contacts/{userId}:');
    expect(content).toContain('/sdk/contact-manager/contact-invites/{userId}/accept:');
    expect(content).toContain('/sdk/contact-manager/contact-invites/{userId}/decline:');
    expect(content).toContain('/sdk/contact-manager/blocklist:');
  });

  it('应约束 blocklist 返回模型与已知 404 envelope', () => {
    const content = readFileSync(CONTRACT_PATH, 'utf8');

    expect(content).toContain('$ref: \'#/components/schemas/UserInfo\'');
    expect(content).toContain('BlocklistAddResult');
    expect(content).toContain('BlocklistAddNotFoundEnvelope');
    expect(content).toContain('enum: [service_resource_not_found]');
    expect(content).toContain('enum: [UserNotFoundException]');
  });
});
