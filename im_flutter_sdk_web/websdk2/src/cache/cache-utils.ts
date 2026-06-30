/**
 * 缓存工具方法
 */

export const isRecord = (value: unknown): value is Record<string, unknown> => { // 判断对象
  return typeof value === 'object' && value !== null && !Array.isArray(value); // 返回判断结果
}; // 判断对象结束

export const safeJsonParse = <T>(raw: string | null, fallback: T): T => { // 安全解析 JSON
  if (!raw) { // 空字符串处理
    return fallback; // 返回默认值
  } // 空字符串处理结束
  try { // 捕获解析错误
    return JSON.parse(raw) as T; // 返回解析结果
  } catch { // 解析失败
    return fallback; // 返回默认值
  } // 解析异常结束
}; // 安全解析 JSON 结束

export const safeJsonStringify = (value: unknown): string | null => { // 安全序列化 JSON
  try { // 捕获序列化错误
    return JSON.stringify(value); // 返回序列化结果
  } catch { // 序列化失败
    return null; // 返回空
  } // 异常处理结束
}; // 安全序列化结束

export const isQuotaExceededError = (error: unknown): boolean => { // 判断是否为配额超限
  if (!error) { // 空错误处理
    return false; // 返回否
  } // 空错误处理结束
  if (typeof DOMException !== 'undefined' && error instanceof DOMException) { // DOMException 判断
    return error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED'; // 返回判断结果
  } // DOMException 判断结束
  if (error instanceof Error) { // Error 判断
    return error.name === 'QuotaExceededError' || error.message.includes('quota'); // 返回判断结果
  } // Error 判断结束
  return false; // 默认返回否
}; // 判断配额超限结束
