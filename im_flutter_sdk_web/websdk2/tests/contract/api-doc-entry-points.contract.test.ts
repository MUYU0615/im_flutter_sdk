// @vitest-environment node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const API_DOC_ENTRY_POINTS_PATH = resolve(process.cwd(), 'scripts/api-doc-entry-points.js');

describe('API doc entry points contract', () => {
  it('ChatThread 公开 manager、entity 和类型必须进入 API Reference', () => {
    const entryPointSource = readFileSync(API_DOC_ENTRY_POINTS_PATH, 'utf8');

    expect(entryPointSource).toContain("'src/managers/chat-thread-manager.ts'");
    expect(entryPointSource).toContain("'src/managers/chat-thread/chat-thread.ts'");
    expect(entryPointSource).toContain("'src/types/chat-thread.ts'");
  });

  it('ChatThread Markdown API Reference 不应公开 raw notify 和旧聚合事件类型', () => {
    const zhReference = readFileSync(
      resolve(process.cwd(), 'docs/reference/api-reference.zh-CN.md'),
      'utf8'
    );
    const enReference = readFileSync(
      resolve(process.cwd(), 'docs/reference/api-reference.en-US.md'),
      'utf8'
    );

    for (const reference of [zhReference, enReference]) {
      expect(reference).not.toContain('ChatThreadRawNotify');
      expect(reference).not.toContain('ChatThreadChangeEvent');
      expect(reference).toContain('ChatThreadCreatedEventPayload');
      expect(reference).toContain('ChatThreadDestroyedEventPayload');
      expect(reference).toContain('ChatThreadUpdatedEventPayload');
      expect(reference).toContain('ChatThreadUserRemovedEventPayload');
    }
  });
});
