/** 解码状态，用于追踪偏移量 */
export interface DecodeState {
  offset: number;
}

/** CRC32 支持的输入类型 */
export type CRC32Input = Uint8Array | Int8Array | number[];

/** LEB128 编码支持的最大值（4字节限制，2^28 - 1，约 256MB）*/
const MAX_LEB128_VALUE = 0x0fffffff;

const CRC_TABLE = new Uint32Array(256);
let CRC_TABLE_READY = false;

function initCrcTable(): void {
  if (CRC_TABLE_READY) {
    return;
  }
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let j = 0; j < 8; j += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    CRC_TABLE[i] = c >>> 0;
  }
  CRC_TABLE_READY = true;
}

/**
 * 计算 CRC32 校验值
 * @param data - 输入数据（二进制数组）
 * @returns 无符号 32 位 CRC32 值
 */
export function crc32(data: CRC32Input): number {
  initCrcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    const value = data[i] ?? 0;
    const byte = value & 0xff;
    const tableValue = CRC_TABLE[(crc ^ byte) & 0xff] ?? 0;
    crc = (crc >>> 8) ^ tableValue;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * LEB128 变长编码（Little Endian Base 128）
 * @param length - 要编码的长度值 (0 ~ 2^28-1，约 256MB)
 * @returns 编码后的字节数组（最多 4 字节）
 * @throws 当输入为负数或超出范围时抛出异常
 */
export function encodeLength(length: number): Uint8Array {
  if (length < 0) {
    throw new Error('encodeLength: Length must be non-negative');
  }
  if (length > MAX_LEB128_VALUE) {
    throw new Error(
      `encodeLength: Length exceeds maximum: ${MAX_LEB128_VALUE}`
    );
  }

  if (length === 0) {
    return new Uint8Array([0]);
  }

  const res: number[] = [];
  let len = length;
  while (len > 0) {
    let byte = len & 0x7f;
    len >>>= 7;
    if (len > 0) {
      byte |= 0x80;
    }
    res.push(byte);
  }

  return new Uint8Array(res);
}

/**
 * LEB128 变长解码
 * @param data - 二进制数据
 * @param state - 包含 offset 的状态对象，用于追踪读取位置
 * @returns 解码后的长度值
 * @throws 当编码超过 4 字节或数据不完整时抛出异常
 */
export function decodeLength(data: Uint8Array, state: DecodeState): number {
  if (state.offset >= data.length) {
    throw new Error(
      'decodeLength: No data to decode: offset beyond data length'
    );
  }

  let result = 0;
  let shift = 0;

  while (state.offset < data.length) {
    const byte = data[state.offset] ?? 0;
    state.offset += 1;

    result |= (byte & 0x7f) << shift;

    if ((byte & 0x80) === 0) {
      return result >>> 0;
    }

    shift += 7;
    if (shift >= 28) {
      throw new Error(
        'decodeLength: Invalid length encoding: exceeds 4 bytes'
      );
    }
  }

  throw new Error(
    'decodeLength: Incomplete length encoding: missing terminator byte'
  );
}
