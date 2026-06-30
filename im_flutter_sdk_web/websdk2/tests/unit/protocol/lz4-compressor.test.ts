import { describe, expect, it } from 'vitest';

import { LZ4Compressor, createLZ4Compressor } from '@/protocol/msync/lz4-compressor';
import { crc32, decodeLength, encodeLength } from '@/protocol/msync/lz4-compressor/utils';

const toArray = (input: Uint8Array): number[] => Array.from(input);

describe('lz4 compressor', (): void => {
  it('compress/decompress 应支持基础回环并可 reset', (): void => {
    const compressor = createLZ4Compressor();
    const source = new TextEncoder().encode('hello-lz4-world');

    const compressed = compressor.compress(source);
    const restored = compressor.decompress(compressed);

    expect(toArray(restored)).toEqual(toArray(source));
    expect((): void => compressor.reset()).not.toThrow();
  });

  it('空输入应返回空数组', (): void => {
    const compressor = new LZ4Compressor();
    expect(compressor.compress(new Uint8Array(0))).toHaveLength(0);
    expect(compressor.decompress(new Uint8Array(0))).toHaveLength(0);
  });

  it('解压缩非法报文应抛错', (): void => {
    const compressor = new LZ4Compressor();
    expect((): Uint8Array => compressor.decompress(new Uint8Array([1, 2, 3, 4]))).toThrow(
      /too short/
    );
  });

  it('篡改压缩数据应抛解压或校验异常', (): void => {
    const compressor = new LZ4Compressor();
    const source = new TextEncoder().encode('tamper-check');
    const compressed = compressor.compress(source);
    const tampered = Uint8Array.from(compressed);
    const lastIndex = tampered.length - 1;
    tampered[lastIndex] = (tampered[lastIndex] ?? 0) ^ 0x01;

    expect((): Uint8Array => compressor.decompress(tampered)).toThrow(
      /(decompression failed|checksum mismatch)/
    );
  });
});

describe('lz4 utils', (): void => {
  it('crc32 结果应与标准向量一致', (): void => {
    const input = new TextEncoder().encode('123456789');
    expect(crc32(input)).toBe(0xcbf43926);
  });

  it('encodeLength/decodeLength 应正确处理普通长度', (): void => {
    const encoded = encodeLength(300);
    const state = { offset: 0 };
    const decoded = decodeLength(encoded, state);

    expect(decoded).toBe(300);
    expect(state.offset).toBe(encoded.length);
  });

  it('encodeLength/decodeLength 应在非法输入时抛错', (): void => {
    expect((): Uint8Array => encodeLength(-1)).toThrow(/non-negative/);
    expect((): number => decodeLength(new Uint8Array([]), { offset: 0 })).toThrow(/No data/);
    expect((): number => decodeLength(new Uint8Array([0x81]), { offset: 0 })).toThrow(
      /Incomplete/
    );
    expect(
      (): number =>
        decodeLength(new Uint8Array([0xff, 0xff, 0xff, 0xff, 0x01]), { offset: 0 })
    ).toThrow(/exceeds 4 bytes/);
  });
});
