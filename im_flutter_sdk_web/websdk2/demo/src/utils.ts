export const withTimeout = async <T>( // 超时包装
  promise: Promise<T>, // 原始 Promise
  timeoutMs: number, // 超时时间
  label: string // 超时标签
): Promise<T> => { // 返回 Promise
  let timeoutId: ReturnType<typeof setTimeout> | null = null; // 定义超时句柄
  try { // 尝试执行
    const timeoutPromise = new Promise<never>((_, reject): void => { // 构造超时 Promise
      timeoutId = setTimeout((): void => { // 设置超时
        reject(new Error(`${label} 超时`)); // 抛出超时错误
      }, timeoutMs); // 设置完成
    }); // 超时 Promise 结束
    return await Promise.race([promise, timeoutPromise]); // 等待竞速结果
  } finally { // 最终处理
    if (timeoutId !== null) { // 判断是否存在定时器
      clearTimeout(timeoutId); // 清理定时器
    } // 判断结束
  } // 最终处理结束
}; // 函数结束

export const formatError = (error: unknown): string => { // 格式化错误
  if (error instanceof Error) { // Error 类型
    const sdkError = error as Error & {
      code?: unknown;
      details?: unknown;
    };
    const segments = [error.message];
    if (typeof sdkError.code === 'number') {
      segments.push(`code=${sdkError.code}`);
    }
    if (sdkError.details !== undefined) {
      segments.push(`details=${safeJsonStringify(sdkError.details)}`);
    }
    return segments.join(' | '); // 返回错误消息
  } // 判断结束
  return String(error); // 兜底转换
}; // 函数结束

export const safeJsonStringify = (value: unknown): string => { // 安全序列化
  try { // 尝试序列化
    return JSON.stringify(value); // 返回序列化结果
  } catch { // 捕获异常
    return '[无法序列化]'; // 返回占位
  } // 结束
}; // 函数结束

export const parseDnsConfigUrls = (input: string): string[] => { // 解析 DNS 地址
  const trimmed = input.trim(); // 去除首尾空格
  if (!trimmed) { // 输入为空
    return []; // 返回空数组
  } // 判断结束
  return trimmed // 返回解析结果
    .split(',') // 按逗号分割
    .map((item): string => item.trim()) // 去除空格
    .filter((item): boolean => item.length > 0); // 过滤空值
}; // 函数结束

export const proxyDnsConfigUrlsForDev = (urls: ReadonlyArray<string>): ReadonlyArray<string> => {
  // 开发环境下把跨域 DNS URL 代理到本地 Vite 服务
  if (!import.meta.env.DEV || typeof window === 'undefined') {
    return urls;
  }

  return urls.map((item): string => {
    try {
      const parsed = new URL(item);
      if (parsed.origin === window.location.origin) {
        return item;
      }
      return `${window.location.origin}/dns-proxy?url=${encodeURIComponent(parsed.toString())}`;
    } catch {
      return item;
    }
  });
}; // 函数结束

export const getTextFromBody = (body: unknown): string | null => { // 读取文本消息内容
  if (typeof body !== 'object' || body === null) { // 非对象
    return null; // 返回空
  } // 判断结束
  if (!('message' in body)) { // 不包含 message 字段
    return null; // 返回空
  } // 判断结束
  const candidate = body as { message?: unknown }; // 转换为候选对象
  if (typeof candidate.message !== 'string') { // 判断是否为字符串
    return null; // 返回空
  } // 判断结束
  return candidate.message; // 返回文本
}; // 函数结束

export const parseUsernamesInput = (input: string): ReadonlyArray<string> => { // 解析订阅用户输入
  const trimmed = input.trim(); // 去除首尾空格
  if (!trimmed) { // 空输入
    return []; // 返回空数组
  } // 判断结束
  const parts = trimmed.split(/[,，\n]/); // 按逗号或换行分割
  const unique = new Set<string>(); // 去重集合
  for (const part of parts) { // 遍历分段
    const value = part.trim(); // 去除空格
    if (value) { // 校验内容
      unique.add(value); // 追加用户 ID
    } // 判断结束
  } // 遍历结束
  return Array.from(unique); // 返回结果
}; // 函数结束

export const formatTimestamp = (value: number): string => { // 格式化时间戳
  if (!Number.isFinite(value) || value <= 0) { // 判断非法时间
    return '-'; // 返回占位
  } // 判断结束
  const normalized = value < 1_000_000_000_000 ? value * 1000 : value; // 兼容秒级时间戳
  const date = new Date(normalized); // 构造时间对象
  return date.toLocaleString(); // 返回本地时间
}; // 函数结束
