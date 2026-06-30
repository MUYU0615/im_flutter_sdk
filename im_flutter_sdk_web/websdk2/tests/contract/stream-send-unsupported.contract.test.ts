import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const CONTRACT_PATH = resolve(
  process.cwd(),
  'specs/020-stream-message/contracts/stream-message.openapi.yaml'
);

describe('stream-send-unsupported contract', () => {
  it('应声明流式发送不支持接口与错误码', () => {
    const content = readFileSync(CONTRACT_PATH, 'utf8');
    expect(content).toContain('/sdk/messages/stream/send:');
    expect(content).toContain('501:');
    expect(content).toContain('STREAM_SEND_NOT_SUPPORTED');
  });
});
