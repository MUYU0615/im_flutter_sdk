import { describe, expect, it } from 'vitest';

import { normalizeUploadSource } from '@/platform/upload/upload-source';

describe('miniapp voice-to-text integration helpers', () => {
  it('MiniAppFile 应规范化为 miniapp-path 上传源', () => {
    const normalized = normalizeUploadSource({
      file: {
        path: '/tmp/voice.amr',
        name: 'voice.amr',
        type: 'audio/amr',
        size: 16,
      },
    });

    expect(normalized.source).toEqual({
      sourceType: 'miniapp-path',
      path: '/tmp/voice.amr',
      name: 'voice.amr',
      mimeType: 'audio/amr',
      size: 16,
    });
  });
});
