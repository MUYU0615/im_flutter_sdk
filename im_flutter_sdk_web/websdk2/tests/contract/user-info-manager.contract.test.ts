import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const CONTRACT_PATH = resolve(
  process.cwd(),
  'specs/026-user-info-manager-api/contracts/user-info-manager.openapi.yaml'
);

describe('user-info-manager contract', () => {
  it('应包含查询与更新的核心路径', () => {
    const content = readFileSync(CONTRACT_PATH, 'utf8');

    expect(content).toContain('openapi: 3.0.3');
    expect(content).toContain('/sdk/user-info/users:');
    expect(content).toContain('/sdk/user-info/users/attributes:');
    expect(content).toContain('/sdk/user-info/self:');
    expect(content).toContain('/sdk/user-info/self/attributes:');
    expect(content).toContain('operationId: fetchUserInfoByUserId');
    expect(content).toContain('operationId: fetchUserInfoByAttribute');
    expect(content).toContain('operationId: updateOwnInfo');
    expect(content).toContain('operationId: updateOwnInfoByAttribute');
  });

  it('应约束真实 envelope 结构与 SDK 返回模型', () => {
    const content = readFileSync(CONTRACT_PATH, 'utf8');

    expect(content).toContain('UserInfoFetchResponseEnvelope');
    expect(content).toContain('UserInfoUpdateResponseEnvelope');
    expect(content).toContain('avatarUrl');
    expect(content).toContain('lastModified:');
    expect(content).toContain('additionalProperties:');
    expect(content).toContain('ServerUserInfoAttributes');
  });
});
