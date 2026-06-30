/**
 * 缓存元信息管理
 */

import type { CacheMetadata } from './cache-types'; // 元信息类型
import { CacheStore } from './cache-store'; // 存储封装

export class CacheMetadataStore { // 元信息存储
  private readonly store: CacheStore; // 存储实例
  private readonly key: string; // 缓存 key
  private readonly schemaVersion: number; // 结构版本

  public constructor(store: CacheStore, key: string, schemaVersion: number) { // 构造函数
    this.store = store; // 保存存储实例
    this.key = key; // 保存 key
    this.schemaVersion = schemaVersion; // 保存版本
  } // 构造结束

  public async load(): Promise<CacheMetadata> { // 读取元信息
    const fallback: CacheMetadata = { // 默认元信息
      schemaVersion: this.schemaVersion, // 结构版本
      lastFlush: 0, // 默认落盘时间
    }; // 默认元信息结束
    const metadata = await this.store.readAsync<CacheMetadata>(this.key, fallback); // 读取缓存
    if (metadata.schemaVersion !== this.schemaVersion) { // 版本不一致
      return fallback; // 返回默认
    } // 版本判断结束
    return metadata; // 返回元信息
  } // 读取结束

  public async save(metadata: CacheMetadata): Promise<void> { // 保存元信息
    await this.store.writeAsync(this.key, metadata); // 写入存储
  } // 保存结束

  public async touchLastFlush(): Promise<CacheMetadata> { // 更新落盘时间
    const next: CacheMetadata = { // 构建新元信息
      schemaVersion: this.schemaVersion, // 结构版本
      lastFlush: Date.now(), // 当前时间
    }; // 新元信息结束
    await this.save(next); // 保存元信息
    return next; // 返回元信息
  } // 更新时间结束
} // CacheMetadataStore 结束
