import lz4 from './lz4.js'; // 引入 LZ4 模块
import { crc32, encodeLength, decodeLength } from './utils';
import type { DecodeState } from './utils';

/**
 * 压缩模式枚举
 */
export enum CompressionMode {
  /** 不压缩 */
  NONE = -1,
  /** 只上行压缩 */
  UPLINK_ONLY = 0,
  /** 只下行压缩 */
  DOWNLINK_ONLY = 1,
  /** 双向压缩 */
  BIDIRECTIONAL = 2,
}

/** CRC32 校验和占用的字节数（4字节） */
const CRC32_SIZE = 4;

/** 最大压缩大小（LEB128 4字节限制，约256MB） */
const MAX_COMPRESSED_SIZE = 0x0fffffff;

/**
 * LZ4 压缩器
 */
export class LZ4Compressor {
  private encoder: InstanceType<typeof lz4.RingBufferEncoder>;
  private decoder: InstanceType<typeof lz4.RingBufferDecoder>;

  /** 压缩模式 */
  public mode: CompressionMode = CompressionMode.NONE;
  /** 是否启用上行压缩 */
  public enableUplinkCompression = false;
  /** 是否启用下行压缩 */
  public enableDownlinkCompression = false;

  constructor() {
    const options = {
      minWorkArea: lz4.DEFAULT_WORK_AREA,
      maxWorkArea: lz4.DEFAULT_MAX_WORK,
      shrinkMode: lz4.SHRINK_MODE.MANUAL,
    };
    this.encoder = new lz4.RingBufferEncoder(options);
    this.decoder = new lz4.RingBufferDecoder(options);
  }

  /**
   * 压缩数据
   */
  compress(data: ArrayBuffer | Uint8Array): Uint8Array {
    const dataArray = data instanceof ArrayBuffer ? new Uint8Array(data) : data;

    if (!dataArray || dataArray.length === 0) {
      return new Uint8Array(0);
    }

    if (dataArray.length > MAX_COMPRESSED_SIZE) {
      throw new Error(
        `Data size exceeds maximum allowed: ${dataArray.length}`
      );
    }

    const maxCompressedSize = lz4.compressBound(dataArray.length);
    const compressedBuffer = new Uint8Array(maxCompressedSize);

    const compressedSize = this.encoder.compress(
      dataArray,
      compressedBuffer
    );

    if (compressedSize < 0) {
      throw new Error(
        `LZ4 compression failed with error code: ${compressedSize}`
      );
    }

    const compressedData = compressedBuffer.subarray(0, compressedSize);
    const encodedLength = encodeLength(dataArray.length);
    const checksum = crc32(dataArray);

    const result = new Uint8Array(
      encodedLength.length + CRC32_SIZE + compressedSize
    );

    let offset = 0;
    result.set(encodedLength, offset);
    offset += encodedLength.length;

    const view = new DataView(result.buffer);
    view.setUint32(offset, checksum, false);
    offset += CRC32_SIZE;

    result.set(compressedData, offset);
    return result;
  }

  /**
   * 解压缩数据
   */
  decompress(compressedData: ArrayBuffer | Uint8Array): Uint8Array {
    const data =
      compressedData instanceof ArrayBuffer
        ? new Uint8Array(compressedData)
        : compressedData;

    if (!data || data.length === 0) {
      return new Uint8Array(0);
    }

    if (data.length < 1 + CRC32_SIZE) {
      throw new Error(
        'Compressed data is too short: must contain at least length and CRC32'
      );
    }

    const state: DecodeState = { offset: 0 };
    const originalSize = decodeLength(data, state);

    if (originalSize > MAX_COMPRESSED_SIZE) {
      throw new Error(
        `Original size exceeds maximum allowed: ${originalSize}`
      );
    }

    if (data.length < state.offset + CRC32_SIZE) {
      throw new Error(
        'Compressed data is too short: missing CRC32 checksum'
      );
    }

    const view = new DataView(
      data.buffer,
      data.byteOffset + state.offset,
      CRC32_SIZE
    );
    const expectedChecksum = view.getUint32(0, false);
    state.offset += CRC32_SIZE;

    const actualCompressedData = data.subarray(state.offset);
    const decompressedBuffer = new Uint8Array(originalSize);

    const decompressedSize = this.decoder.decompress(
      actualCompressedData,
      decompressedBuffer,
      originalSize
    );

    if (decompressedSize < 0 || decompressedSize !== originalSize) {
      throw new Error(
        `LZ4 decompression failed: expected ${originalSize}, got ${decompressedSize}`
      );
    }

    const actualChecksum = crc32(decompressedBuffer);
    if (actualChecksum !== expectedChecksum) {
      throw new Error(
        `CRC32 checksum mismatch: expected ${expectedChecksum}, got ${actualChecksum}`
      );
    }

    return decompressedBuffer;
  }

  /**
   * 重置编码器和解码器状态
   */
  reset(): void {
    this.encoder.reset();
    this.decoder.reset();
  }
}

export function createLZ4Compressor(): LZ4Compressor {
  return new LZ4Compressor();
}
