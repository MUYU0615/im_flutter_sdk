import { describe, it, expect, vi, beforeEach } from 'vitest';

let mockDecodeResult: Record<string, unknown> = {};
let mockShouldThrow = false;

vi.mock('@/protocol/msync/root', () => ({
  getMsyncRoot: () => ({
    lookupType: () => ({
      decode: () => {
        if (mockShouldThrow) {
          throw new Error('decode error');
        }
        return {};
      },
      toObject: () => mockDecodeResult,
    }),
  }),
}));

import { decodeSessionListPayloadBody } from '@/protocol/session-list/payload-decoder';

describe('decodeSessionListPayloadBody', () => {
  beforeEach(() => {
    mockDecodeResult = {};
    mockShouldThrow = false;
  });

  it('payload 为 undefined 时返回 {}', () => {
    expect(decodeSessionListPayloadBody(undefined)).toEqual({});
  });

  it('payload 为空 Uint8Array 时返回 {}', () => {
    expect(decodeSessionListPayloadBody(new Uint8Array(0))).toEqual({});
  });

  it('decode 抛出异常时返回 {}', () => {
    mockShouldThrow = true;
    expect(decodeSessionListPayloadBody(new Uint8Array(1))).toEqual({});
  });

  it('contentType=0 解码为 text', () => {
    mockDecodeResult = { contents: [{ type: 0, text: 'hello' }] };
    expect(decodeSessionListPayloadBody(new Uint8Array(1))).toEqual({
      type: 'text',
      content: 'hello',
    });
  });

  it('contentType=1 解码为 image', () => {
    mockDecodeResult = { contents: [{ type: 1, displayName: 'photo.png', remotePath: 'https://x/photo.png' }] };
    expect(decodeSessionListPayloadBody(new Uint8Array(1))).toEqual({
      type: 'image',
      filename: 'photo.png',
      remotePath: 'https://x/photo.png',
    });
  });

  it('contentType=2 解码为 video', () => {
    mockDecodeResult = { contents: [{ type: 2, displayName: 'clip.mp4', remotePath: 'https://x/clip.mp4' }] };
    expect(decodeSessionListPayloadBody(new Uint8Array(1))).toEqual({
      type: 'video',
      filename: 'clip.mp4',
      remotePath: 'https://x/clip.mp4',
    });
  });

  it('contentType=3 解码为 location', () => {
    mockDecodeResult = { contents: [{ type: 3, latitude: 39.9, longitude: 116.4, address: 'Beijing' }] };
    expect(decodeSessionListPayloadBody(new Uint8Array(1))).toEqual({
      type: 'location',
      latitude: 39.9,
      longitude: 116.4,
      address: 'Beijing',
    });
  });

  it('contentType=4 解码为 voice', () => {
    mockDecodeResult = { contents: [{ type: 4, displayName: 'audio.amr', remotePath: 'https://x/a.amr', duration: 5 }] };
    expect(decodeSessionListPayloadBody(new Uint8Array(1))).toEqual({
      type: 'voice',
      filename: 'audio.amr',
      remotePath: 'https://x/a.amr',
      duration: 5,
    });
  });

  it('contentType=5 解码为 file', () => {
    mockDecodeResult = { contents: [{ type: 5, displayName: 'doc.pdf', remotePath: 'https://x/doc.pdf' }] };
    expect(decodeSessionListPayloadBody(new Uint8Array(1))).toEqual({
      type: 'file',
      filename: 'doc.pdf',
      remotePath: 'https://x/doc.pdf',
    });
  });

  it('contentType=6 解码为 cmd', () => {
    mockDecodeResult = { contents: [{ type: 6, action: 'typing' }] };
    expect(decodeSessionListPayloadBody(new Uint8Array(1))).toEqual({
      type: 'cmd',
      action: 'typing',
    });
  });

  it('contentType=7 解码为 custom', () => {
    mockDecodeResult = { contents: [{ type: 7, customEvent: 'gift' }] };
    expect(decodeSessionListPayloadBody(new Uint8Array(1))).toEqual({
      type: 'custom',
      event: 'gift',
    });
  });

  it('contentType=8 解码为 combine', () => {
    mockDecodeResult = { contents: [{ type: 8, title: 'Chat History', summary: '3 messages' }] };
    expect(decodeSessionListPayloadBody(new Uint8Array(1))).toEqual({
      type: 'combine',
      title: 'Chat History',
      summary: '3 messages',
    });
  });

  it('未知 contentType 返回 {}', () => {
    mockDecodeResult = { contents: [{ type: 99 }] };
    expect(decodeSessionListPayloadBody(new Uint8Array(1))).toEqual({});
  });
});
