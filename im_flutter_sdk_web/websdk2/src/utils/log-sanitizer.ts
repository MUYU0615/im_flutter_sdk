/**
 * 日志脱敏工具
 *
 * 对敏感字段进行掩码处理，遵循最小必要原则
 */

const MASKED_VALUE = '[MASKED]'; // 脱敏后的占位值

const SENSITIVE_KEYS = [ // 需要脱敏的敏感字段
  'token', // 访问令牌
  'password', // 密码字段
  'authorization', // 鉴权头
  'appkey', // appKey
  'userid', // 用户 ID
  'deviceid', // 设备 ID
  'accesstoken', // accessToken
  'refreshtoken', // refreshToken
  'secret', // secret 字段
  'authtoken', // authToken
  'sessionid', // sessionId
  'clientresource', // clientResource
]; // 敏感字段清单

const SENSITIVE_KEY_SET = new Set<string>(SENSITIVE_KEYS); // 敏感字段集合

const normalizeKey = (key: string): string => key.toLowerCase(); // 统一 key 格式

const isSensitiveKey = (key: string | undefined): boolean => { // 判断是否敏感 key
  if (!key) { // key 为空时
    return false; // 非敏感
  }
  return SENSITIVE_KEY_SET.has(normalizeKey(key)); // 判断集合包含
}; // 结束 isSensitiveKey

const isPlainObject = (value: unknown): value is Record<string, unknown> => { // 判断是否普通对象
  return typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date) && !(value instanceof Error); // 排除数组与特殊对象
}; // 结束 isPlainObject

const sanitizeString = (value: string, keyHint?: string): string => { // 脱敏字符串
  if (isSensitiveKey(keyHint)) { // 命中敏感 key
    return MASKED_VALUE; // 返回脱敏值
  }
  return value; // 返回原值
}; // 结束 sanitizeString

const sanitizeError = (error: Error): Record<string, string> => { // 脱敏错误对象
  return { // 返回安全错误信息
    name: error.name, // 错误名称
    message: error.message, // 错误信息
  };
}; // 结束 sanitizeError

const sanitizeValue = (value: unknown, keyHint?: string, seen?: WeakSet<object>): unknown => { // 脱敏任意值
  const tracker = seen ?? new WeakSet<object>(); // 使用共享的循环引用跟踪器
  if (typeof value === 'string') { // 字符串处理
    return sanitizeString(value, keyHint); // 脱敏字符串
  }
  if (typeof value === 'number' || typeof value === 'boolean' || value === null || value === undefined) { // 基础类型
    return value; // 直接返回
  }
  if (typeof value === 'bigint' || typeof value === 'symbol') { // 可安全字符串化的特殊原始值
    return value.toString(); // 返回稳定字符串
  }
  if (typeof value === 'function') { // 函数类型
    return `[Function ${value.name || 'anonymous'}]`; // 返回函数占位名
  }
  if (value instanceof Error) { // Error 类型
    return sanitizeError(value); // 脱敏错误信息
  }
  if (value instanceof Date) { // 日期类型
    return value.toISOString(); // 转为 ISO 字符串
  }
  if (Array.isArray(value)) { // 数组类型
    return value.map((item) => sanitizeValue(item, undefined, tracker)); // 递归脱敏数组元素
  }
  if (typeof value === 'object') { // 对象类型
    if (tracker.has(value)) { // 检测循环引用
      return '[Circular]'; // 返回循环引用占位
    }
    tracker.add(value); // 标记已访问对象
    if (isPlainObject(value)) { // 普通对象处理
      const result: Record<string, unknown> = {}; // 初始化结果对象
      for (const [key, entryValue] of Object.entries(value)) { // 遍历字段
        if (isSensitiveKey(key)) { // 命中敏感字段
          result[key] = MASKED_VALUE; // 直接脱敏
        } else { // 非敏感字段
          result[key] = sanitizeValue(entryValue, key, tracker); // 递归脱敏
        }
      }
      return result; // 返回脱敏对象
    }
    return Object.prototype.toString.call(value); // 兜底输出对象标签，避免默认对象字符串化
  }
  return '[Unsupported]'; // 兜底占位
}; // 结束 sanitizeValue

export const sanitizeLogArgs = (args: ReadonlyArray<unknown>): ReadonlyArray<unknown> => { // 脱敏日志参数
  const tracker = new WeakSet<object>(); // 创建循环引用跟踪器
  return args.map((arg) => sanitizeValue(arg, undefined, tracker)); // 返回脱敏后的参数
}; // 结束 sanitizeLogArgs
