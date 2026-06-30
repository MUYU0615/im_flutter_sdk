import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const CONTRACT_PATH = resolve(
  process.cwd(),
  'specs/020-stream-message/contracts/stream-message.openapi.yaml'
);

describe('stream-message-event contract', () => {
  it('契约文件存在并包含 stream 回调入口', () => {
    const content = readFileSync(CONTRACT_PATH, 'utf8');
    expect(content).toContain('openapi: 3.0.3');
    expect(content).toContain('/sdk/events/stream-message:');
  });

  it('包含 fullText/deltaText 与状态枚举定义', () => {
    const content = readFileSync(CONTRACT_PATH, 'utf8');
    expect(content).toContain('deltaText');
    expect(content).toContain('fullText');
    expect(content).toContain('STREAM_FULL');
    expect(content).toContain('STREAM_ERROR');
  });
});
