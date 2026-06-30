import { describe, expect, it } from 'vitest';

import {
  isQuotaExceededError,
  isRecord,
  safeJsonParse,
  safeJsonStringify,
} from '@/cache/cache-utils';

describe('cache-utils', () => {
  it('isRecord 应仅对普通对象返回 true', () => {
    expect(isRecord({ ok: true })).toBe(true);
    expect(isRecord(null)).toBe(false);
    expect(isRecord(['a'])).toBe(false);
  });

  it('safeJsonParse 应在空值或非法 JSON 时返回 fallback', () => {
    expect(safeJsonParse<{ ok: boolean }>(null, { ok: false })).toEqual({ ok: false });
    expect(safeJsonParse<{ ok: boolean }>('{', { ok: false })).toEqual({ ok: false });
  });

  it('safeJsonParse 应在合法 JSON 时返回解析结果', () => {
    expect(safeJsonParse<{ ok: boolean }>('{"ok":true}', { ok: false })).toEqual({ ok: true });
  });

  it('safeJsonStringify 应在序列化失败时返回 null', () => {
    const circular: { self?: unknown } = {};
    circular.self = circular;

    expect(safeJsonStringify({ ok: true })).toBe('{"ok":true}');
    expect(safeJsonStringify(circular)).toBeNull();
  });

  it('isQuotaExceededError 应覆盖 DOMException、Error 与空值分支', () => {
    expect(isQuotaExceededError(undefined)).toBe(false);
    expect(isQuotaExceededError(new DOMException('quota exceeded', 'QuotaExceededError'))).toBe(
      true
    );
    expect(
      isQuotaExceededError(new DOMException('quota exceeded', 'NS_ERROR_DOM_QUOTA_REACHED'))
    ).toBe(true);
    expect(
      isQuotaExceededError(Object.assign(new Error('failed'), { name: 'QuotaExceededError' }))
    ).toBe(true);
    expect(isQuotaExceededError(new Error('storage quota reached'))).toBe(true);
    expect(isQuotaExceededError(new Error('network failed'))).toBe(false);
    expect(isQuotaExceededError({})).toBe(false);
  });
});
