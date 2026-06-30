import { describe, expect, it } from 'vitest';

import { normalizeUploadSource } from '../../../src/platform';
import type { CompatibleFile } from '../../../src/types';

describe('platform/upload-source-normalize', () => {
  it('可将 Web File 规范化为 web-file 源', () => {
    const file = new File(['hello'], 'hello.txt', { type: 'text/plain' });

    const normalized = normalizeUploadSource({
      file,
      fallbackName: 'fallback.txt',
      fallbackMimeType: 'application/octet-stream',
      fallbackSize: 10,
    });

    expect(normalized.source.sourceType).toBe('web-file');
    expect(normalized.fileName).toBe('hello.txt');
    expect(normalized.fileType).toBe('text/plain');
    expect(normalized.fileSize).toBe(file.size);
    expect(normalized.webFile).toBe(file);
  });

  it('可将小程序 path 规范化为 miniapp-path 源', () => {
    const miniAppFile: CompatibleFile = {
      path: '/tmp/a.png',
      name: 'a.png',
      type: 'image/png',
      size: 123,
    };

    const normalized = normalizeUploadSource({
      file: miniAppFile,
      fallbackName: 'fallback.png',
      fallbackMimeType: 'image/*',
      fallbackSize: 0,
    });

    expect(normalized.source.sourceType).toBe('miniapp-path');
    expect(normalized.source.path).toBe('/tmp/a.png');
    expect(normalized.fileName).toBe('a.png');
    expect(normalized.fileType).toBe('image/png');
    expect(normalized.fileSize).toBe(123);
    expect(normalized.webFile).toBeUndefined();
  });

  it('小程序文件缺少 name/type 时应按 path 推导元信息', () => {
    const miniAppFile: CompatibleFile = {
      path: 'wxfile://tmp/camera/IMG_20260415.JPG?foo=1',
      size: 456,
    };

    const normalized = normalizeUploadSource({
      file: miniAppFile,
    });

    expect(normalized.source.sourceType).toBe('miniapp-path');
    expect(normalized.source.path).toBe('wxfile://tmp/camera/IMG_20260415.JPG?foo=1');
    expect(normalized.fileName).toBe('IMG_20260415.JPG');
    expect(normalized.fileType).toBe('image/jpeg');
    expect(normalized.fileSize).toBe(456);
  });

  it('可将 RN uri 规范化为 rn-uri 源', () => {
    const rnFile: CompatibleFile = {
      uri: 'file:///tmp/audio.m4a',
      name: 'audio.m4a',
      type: 'audio/mp4',
      size: 4096,
    };

    const normalized = normalizeUploadSource({
      file: rnFile,
      fallbackName: 'fallback.m4a',
      fallbackMimeType: 'audio/*',
      fallbackSize: 0,
    });

    expect(normalized.source.sourceType).toBe('rn-uri');
    expect(normalized.source.uri).toBe('file:///tmp/audio.m4a');
    expect(normalized.fileName).toBe('audio.m4a');
    expect(normalized.fileType).toBe('audio/mp4');
    expect(normalized.fileSize).toBe(4096);
    expect(normalized.webFile).toBeUndefined();
  });
});
