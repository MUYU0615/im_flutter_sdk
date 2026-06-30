/**
 * localStorage 访问封装
 */

import { logger } from '../utils/logger'; // 日志工具
import type { CacheCryptoAdapter } from './cache-crypto'; // 加密适配器类型
import { isQuotaExceededError, safeJsonParse, safeJsonStringify } from './cache-utils'; // 缓存工具

const resolveLocalStorage = (): Storage | null => {
  const browserStorage =
    typeof window !== 'undefined' ? window.localStorage : undefined;
  if (browserStorage && typeof browserStorage.getItem === 'function') {
    return browserStorage;
  }

  const globalStorage = globalThis.localStorage;
  if (globalStorage && typeof globalStorage.getItem === 'function') {
    return globalStorage;
  }

  return null;
};

export class CacheStore { // 缓存存储封装
  private readonly available: boolean; // 可用性标识
  private readonly cryptoAdapter: CacheCryptoAdapter | null; // 加密适配器

  public constructor(cryptoAdapter?: CacheCryptoAdapter) { // 初始化构造
    this.available = CacheStore.checkAvailable(); // 检查 localStorage 可用性
    this.cryptoAdapter = cryptoAdapter ?? null; // 保存加密适配器
  } // 构造结束

  public static checkAvailable(): boolean { // 检查 localStorage 可用性
    const storage = resolveLocalStorage();
    if (!storage) { // 环境不支持
      return false; // 返回不可用
    } // 环境判断结束
    try { // 捕获写入异常
      const testKey = '__im_sdk_cache_test__'; // 测试 key
      storage.setItem(testKey, '1'); // 写入测试值
      storage.removeItem(testKey); // 清理测试值
      return true; // 返回可用
    } catch { // 捕获异常
      return false; // 返回不可用
    } // 异常处理结束
  } // 检查结束

  public async readAsync<T>(key: string, fallback: T): Promise<T> { // 读取缓存
    if (!this.available) { // 不可用直接返回
      return fallback; // 返回默认值
    } // 可用性判断结束
    const storage = resolveLocalStorage();
    if (!storage) {
      return fallback;
    }
    try { // 捕获读取异常
      const raw = storage.getItem(key); // 读取原始值
      if (!raw) { // 空值处理
        return fallback; // 返回默认值
      } // 空值判断结束
      let content = raw; // 读取内容
      if (this.cryptoAdapter && this.cryptoAdapter.isEnabled()) { // 需要解密
        const decrypted = await this.cryptoAdapter.decrypt(raw); // 解密内容
        if (decrypted === null) { // 解密失败
          return fallback; // 返回默认值
        } // 失败判断结束
        content = decrypted; // 使用解密内容
      } // 解密判断结束
      return safeJsonParse<T>(content, fallback); // 解析并返回
    } catch (error) { // 捕获异常
      logger.warn('CacheStore read failed', error); // 记录读取失败
      return fallback; // 返回默认值
    } // 异常处理结束
  } // 读取结束

  public async writeAsync(key: string, value: unknown): Promise<void> { // 写入缓存
    if (!this.available) { // 不可用直接返回
      return; // 结束写入
    } // 可用性判断结束
    const payload = safeJsonStringify(value); // 序列化数据
    if (payload === null) { // 序列化失败
      return; // 结束写入
    } // 序列化判断结束
    const storage = resolveLocalStorage();
    if (!storage) {
      return;
    }
    try { // 捕获写入异常
      const content = this.cryptoAdapter && this.cryptoAdapter.isEnabled()
        ? await this.cryptoAdapter.encrypt(payload) // 加密内容
        : payload; // 使用明文
      storage.setItem(key, content); // 写入缓存
    } catch (error) { // 捕获异常
      if (isQuotaExceededError(error)) { // 配额超限
        throw error; // 向上抛出
      } // 配额判断结束
      logger.warn('CacheStore write failed', error); // 记录写入失败
    } // 异常处理结束
  } // 写入结束

  public remove(key: string): void { // 删除缓存
    if (!this.available) { // 不可用直接返回
      return; // 结束删除
    } // 可用性判断结束
    const storage = resolveLocalStorage();
    if (!storage) {
      return;
    }
    try { // 捕获删除异常
      storage.removeItem(key); // 删除缓存
    } catch (error) { // 捕获异常
      logger.warn('CacheStore remove failed', error); // 记录删除失败
    } // 异常处理结束
  } // 删除结束
} // CacheStore 结束
