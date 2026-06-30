/**
 * 缓存加密工具
 */

export interface CacheCryptoPayload { // 加密载荷结构
  readonly __enc: true; // 加密标记
  readonly v: 1; // 版本号
  readonly alg: 'AES-GCM'; // 加密算法
  readonly kdf: 'SHA-256'; // 派生算法
  readonly iv: string; // 随机向量（base64）
  readonly ct: string; // 密文（base64）
} // 加密载荷结构结束

export interface CacheCryptoAdapter { // 加密适配器
  readonly isEnabled: () => boolean; // 是否启用加密
  readonly encrypt: (plaintext: string) => Promise<string>; // 加密方法
  readonly decrypt: (payload: string) => Promise<string | null>; // 解密方法
} // 适配器结束

const hasWebCrypto = (): boolean => { // 判断 Web Crypto 支持
  if (typeof (globalThis as { wx?: unknown }).wx !== 'undefined') { // 小程序环境禁用
    return false; // 返回不支持
  } // 小程序判断结束
  return typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined' && typeof crypto.getRandomValues === 'function' && typeof TextEncoder !== 'undefined' && typeof TextDecoder !== 'undefined'; // 返回判断结果
}; // 判断函数结束

const encodeBase64 = (bytes: Uint8Array): string => { // base64 编码
  let binary = ''; // 二进制字符串
  for (let i = 0; i < bytes.length; i += 1) { // 遍历字节
    const byte = bytes[i];
    if (byte === undefined) {
      continue;
    }
    binary += String.fromCharCode(byte); // 追加字符
  } // 遍历结束
  return btoa(binary); // 返回 base64
}; // 编码结束

const decodeBase64 = (value: string): Uint8Array<ArrayBuffer> => { // base64 解码
  const binary = atob(value); // 解码 base64
  const bytes = new Uint8Array(new ArrayBuffer(binary.length)); // 创建字节数组
  for (let i = 0; i < binary.length; i += 1) { // 遍历字符
    bytes[i] = binary.charCodeAt(i); // 写入字节
  } // 遍历结束
  return bytes; // 返回字节数组
}; // 解码结束

const isEncryptedPayload = (value: unknown): value is CacheCryptoPayload => { // 判断是否为加密载荷
  if (!value || typeof value !== 'object') { // 非对象
    return false; // 返回否
  } // 判断结束
  const record = value as Record<string, unknown>; // 转换为记录
  return record.__enc === true && record.v === 1 && record.alg === 'AES-GCM' && record.kdf === 'SHA-256' && typeof record.iv === 'string' && typeof record.ct === 'string'; // 返回判断结果
}; // 判断结束

export class CacheCrypto implements CacheCryptoAdapter { // 缓存加密实现
  private readonly enabled: boolean; // 是否启用
  private readonly keyPromise: Promise<CryptoKey> | null; // 密钥 Promise

  public constructor(appKey: string, userId: string) { // 构造函数
    this.enabled = hasWebCrypto(); // 判断是否启用
    if (this.enabled) { // 支持加密
      const seed = `${appKey}:${userId}`; // 构造种子
      this.keyPromise = this.deriveKey(seed); // 派生密钥
    } else { // 不支持加密
      this.keyPromise = null; // 清空密钥
    } // 判断结束
  } // 构造结束

  public isEnabled(): boolean { // 是否启用
    return this.enabled; // 返回状态
  } // 方法结束

  public async encrypt(plaintext: string): Promise<string> { // 加密文本
    if (!this.enabled || !this.keyPromise) { // 未启用
      return plaintext; // 直接返回明文
    } // 判断结束
    const key = await this.keyPromise; // 获取密钥
    const encoder = new TextEncoder(); // 文本编码器
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 生成随机向量
    const data = encoder.encode(plaintext); // 编码数据
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data); // 执行加密
    const payload: CacheCryptoPayload = { // 构建载荷
      __enc: true, // 加密标记
      v: 1, // 版本号
      alg: 'AES-GCM', // 算法
      kdf: 'SHA-256', // 派生算法
      iv: encodeBase64(iv), // iv 编码
      ct: encodeBase64(new Uint8Array(encrypted)), // 密文编码
    }; // 构建结束
    return JSON.stringify(payload); // 返回载荷字符串
  } // 加密结束

  public async decrypt(payload: string): Promise<string | null> { // 解密文本
    if (!this.enabled || !this.keyPromise) { // 未启用
      return payload; // 直接返回原值
    } // 判断结束
    let parsed: unknown; // 解析结果
    try { // 捕获解析异常
      parsed = JSON.parse(payload); // 解析 JSON
    } catch { // 解析失败
      return payload; // 返回原值
    } // 解析结束
    if (!isEncryptedPayload(parsed)) { // 非加密载荷
      return payload; // 返回原值
    } // 判断结束
    try { // 捕获解密异常
      const key = await this.keyPromise; // 获取密钥
      const iv = decodeBase64(parsed.iv); // 解码 iv
      const ct = decodeBase64(parsed.ct); // 解码密文
      const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct); // 解密密文
      const decoder = new TextDecoder(); // 文本解码器
      return decoder.decode(decrypted); // 返回明文
    } catch { // 解密失败
      return null; // 返回空
    } // 解密结束
  } // 解密结束

  private async deriveKey(seed: string): Promise<CryptoKey> { // 派生密钥
    const encoder = new TextEncoder(); // 文本编码器
    const data = encoder.encode(seed); // 编码种子
    const digest = await crypto.subtle.digest('SHA-256', data); // 计算哈希
    return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']); // 导入密钥
  } // 派生结束
} // CacheCrypto 结束
