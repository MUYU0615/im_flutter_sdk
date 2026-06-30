import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const CONTRACT_PATH = resolve(
  process.cwd(),
  'specs/018-cross-platform-adapter/contracts/sdk-platform-compat.openapi.yaml'
);

describe('platform/compat-contract', () => {
  it('契约文件存在并包含 OpenAPI 声明', () => {
    const content = readFileSync(CONTRACT_PATH, 'utf8');
    expect(content).toContain('openapi: 3.0.3');
    expect(content).toContain('title: IM SDK Platform Compatibility Contract');
  });

  it('包含核心接口定义', () => {
    const content = readFileSync(CONTRACT_PATH, 'utf8');
    expect(content).toContain('/sdk/init:');
    expect(content).toContain('/sdk/messages/text:');
    expect(content).toContain('/sdk/messages/attachment:');
    expect(content).toContain('/sdk/connection/status:');
  });

  it('包含跨平台关键能力与错误阶段', () => {
    const content = readFileSync(CONTRACT_PATH, 'utf8');
    expect(content).toContain('required: [request, upload, socket, proto]');
    expect(content).toContain('enum: [init, request, upload, socket, proto, runtime]');
  });
});
