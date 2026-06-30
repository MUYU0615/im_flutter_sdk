export interface RingBufferOptions { // 环形缓冲区配置
  minWorkArea?: number; // 最小工作区大小
  maxWorkArea?: number; // 最大工作区大小
  shrinkMode?: number; // 缩容模式
} // 配置结束

export interface RingBufferEncoder { // 编码器接口
  compress(source: Uint8Array, dest: Uint8Array): number; // 压缩数据
  reset(): void; // 重置状态
} // 编码器接口结束

export interface RingBufferDecoder { // 解码器接口
  decompress(source: Uint8Array, dest: Uint8Array, originalSize: number): number; // 解压数据
  reset(): void; // 重置状态
} // 解码器接口结束

export interface ShrinkMode { // 缩容模式枚举
  readonly MANUAL: number; // 手动缩容
  readonly AUTO_IMMEDIATE: number; // 自动立即缩容
  readonly AUTO_THRESHOLD: number; // 自动阈值缩容
} // 枚举结束

export interface LZ4Module { // LZ4 模块接口
  readonly DEFAULT_WORK_AREA: number; // 默认工作区大小
  readonly DEFAULT_MAX_WORK: number; // 默认最大工作区大小
  readonly SHRINK_MODE: ShrinkMode; // 缩容模式
  readonly RingBufferEncoder: new (options?: RingBufferOptions) => RingBufferEncoder; // 编码器构造器
  readonly RingBufferDecoder: new (options?: RingBufferOptions) => RingBufferDecoder; // 解码器构造器
  compressBound(inputSize: number): number; // 计算最大压缩长度
} // 模块接口结束

declare const lz4: LZ4Module; // LZ4 默认导出
export default lz4; // 默认导出
