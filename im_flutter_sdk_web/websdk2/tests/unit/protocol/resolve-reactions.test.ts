import { describe, it, expect } from 'vitest';
import { MsyncCodec } from '@/protocol/msync/codec';

/**
 * 测试 resolveReactions 的解码逻辑（通过 codec 实例的私有方法间接测试）
 */
describe('resolveReactions decode', () => {
  const codec = new MsyncCodec({
    appKey: 'test#app',
    userId: 'user-1',
    token: 'token',
  });

  // 访问私有方法用于单元测试
  const resolveReactions = (codec as unknown as { resolveReactions: (payload: unknown) => unknown }).resolveReactions.bind(codec);

  const encodeMetaPayload = (obj: unknown): Uint8Array => {
    const json = JSON.stringify(obj);
    const encoded = encodeURIComponent(json);
    const bytes: number[] = [];
    for (let i = 0; i < encoded.length; i++) {
      if (encoded[i] === '%') {
        bytes.push(parseInt(encoded.slice(i + 1, i + 3), 16));
        i += 2;
      } else {
        bytes.push(encoded.charCodeAt(i));
      }
    }
    return new Uint8Array(bytes);
  };

  it('should parse valid reactions from meta payload', () => {
    const payload = encodeMetaPayload({
      reaction: [
        { reaction: '👍', count: 3, userList: ['u1', 'u2', 'u3'], state: true },
        { reaction: '❤️', count: 1, userList: ['u4'], state: false },
      ],
    });

    const result = resolveReactions(payload);
    expect(result).toEqual([
      { reaction: '👍', count: 3, userList: ['u1', 'u2', 'u3'], isAddedBySelf: true },
      { reaction: '❤️', count: 1, userList: ['u4'], isAddedBySelf: false },
    ]);
  });

  it('should return undefined when meta payload is null', () => {
    expect(resolveReactions(null)).toBeUndefined();
    expect(resolveReactions(undefined)).toBeUndefined();
  });

  it('should return undefined when reaction field is missing', () => {
    const payload = encodeMetaPayload({ callback_replace: true });
    expect(resolveReactions(payload)).toBeUndefined();
  });

  it('should return undefined when reaction is empty array', () => {
    const payload = encodeMetaPayload({ reaction: [] });
    expect(resolveReactions(payload)).toBeUndefined();
  });

  it('should handle missing fields gracefully', () => {
    const payload = encodeMetaPayload({
      reaction: [
        { reaction: '🎉' },
      ],
    });

    const result = resolveReactions(payload);
    expect(result).toEqual([
      { reaction: '🎉', count: 0, userList: [], isAddedBySelf: undefined },
    ]);
  });

  it('should filter non-string items in userList', () => {
    const payload = encodeMetaPayload({
      reaction: [
        { reaction: '👍', count: 2, userList: ['u1', 123, null, 'u2'], state: true },
      ],
    });

    const result = resolveReactions(payload);
    expect(result).toEqual([
      { reaction: '👍', count: 2, userList: ['u1', 'u2'], isAddedBySelf: true },
    ]);
  });

  it('should return undefined for invalid binary payload', () => {
    const invalidPayload = new Uint8Array([0xff, 0xfe, 0xfd]);
    expect(resolveReactions(invalidPayload)).toBeUndefined();
  });
});
