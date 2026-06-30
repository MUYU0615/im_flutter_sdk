/**
 * 日志上报器
 *
 * 支持缓存、分片与定时上报
 */

import { parseAppKey } from '../upload/utils'; // 解析 appKey 工具
import type { LogLevel } from '../types'; // 日志级别类型

const DEFAULT_REPORT_INTERVAL_MS = 1000 * 60 * 5; // 默认上报间隔（5 分钟）
const DEFAULT_REPORT_TIMEOUT_MS = 1000 * 15; // 默认上报超时（15 秒）
const DEFAULT_CHUNK_DELAY_MS = 3000; // 分片之间延迟（3 秒）
const DEFAULT_MAX_CHUNK_BYTES = 2 * 1024 * 1024; // 单次上报最大 2MB
const DEFAULT_MAX_BUFFER_BYTES = 3 * 1024 * 1024; // 缓存日志最大 3MB

export interface LogReporterContext { // 上报所需上下文
  restBaseUrl?: string; // REST 基础地址
  appKey?: string; // appKey
  userId?: string; // 用户 ID
  token?: string; // 鉴权 token
  resource?: string; // 设备资源标识
} // 结束 LogReporterContext

export interface LogEntry { // 日志条目结构
  timestamp: string; // 记录时间
  level: LogLevel; // 日志级别
  message: string; // 日志正文
  args: ReadonlyArray<unknown>; // 日志参数（已脱敏）
} // 结束 LogEntry

export interface LogReporterOptions { // 上报器配置
  reportIntervalMs?: number; // 上报间隔
  reportTimeoutMs?: number; // 上报超时
  chunkDelayMs?: number; // 分片延迟
  maxChunkBytes?: number; // 分片大小
  maxBufferBytes?: number; // 缓存大小
} // 结束 LogReporterOptions

const delay = (ms: number): Promise<void> => { // 延迟工具
  return new Promise((resolve) => { // 返回 Promise
    setTimeout(resolve, ms); // 设置定时器
  }); // 结束 Promise
}; // 结束 delay

const serializeArg = (arg: unknown): string => { // 序列化参数
  if (typeof arg === 'string') { // 字符串直接返回
    return arg; // 返回字符串
  }
  try { // 尝试 JSON 序列化
    return JSON.stringify(arg); // 返回 JSON
  } catch { // 序列化失败
    return String(arg); // 回退为字符串
  } // 结束 try/catch
}; // 结束 serializeArg

export class LogReporter { // 日志上报器实现
  private enabled = false; // 上报开关
  private readonly reportIntervalMs: number; // 上报间隔
  private readonly reportTimeoutMs: number; // 上报超时
  private readonly chunkDelayMs: number; // 分片间隔
  private readonly maxChunkBytes: number; // 分片大小
  private readonly maxBufferBytes: number; // 缓存大小
  private timerId: ReturnType<typeof setInterval> | null = null; // 定时器句柄
  private reporting = false; // 上报中状态
  private context: LogReporterContext = {}; // 上报上下文
  private buffer: string[] = []; // 日志缓存
  private bufferBytes = 0; // 缓存字节数

  constructor(options?: LogReporterOptions) { // 初始化上报器
    this.reportIntervalMs = options?.reportIntervalMs ?? DEFAULT_REPORT_INTERVAL_MS; // 初始化上报间隔
    this.reportTimeoutMs = options?.reportTimeoutMs ?? DEFAULT_REPORT_TIMEOUT_MS; // 初始化上报超时
    this.chunkDelayMs = options?.chunkDelayMs ?? DEFAULT_CHUNK_DELAY_MS; // 初始化分片间隔
    this.maxChunkBytes = options?.maxChunkBytes ?? DEFAULT_MAX_CHUNK_BYTES; // 初始化分片大小
    this.maxBufferBytes = options?.maxBufferBytes ?? DEFAULT_MAX_BUFFER_BYTES; // 初始化缓存大小
  }

  setEnabled(enabled: boolean): void { // 设置上报开关
    this.enabled = enabled; // 更新开关状态
    if (enabled) { // 开启上报
      this.start(); // 启动定时器
      return; // 结束设置
    }
    this.stop(); // 关闭定时器
  }

  updateContext(context: Partial<LogReporterContext>): void { // 更新上报上下文
    this.context = { ...this.context, ...context }; // 合并上下文
  }

  append(entry: LogEntry): void { // 写入日志条目
    const line = this.formatEntry(entry); // 格式化日志内容
    this.pushBuffer(line); // 写入缓存
  }

  async reportNow(): Promise<void> { // 立即上报
    await this.reportLogs(); // 触发上报
  }

  stop(): void { // 停止定时器
    if (this.timerId) { // 定时器存在
      clearInterval(this.timerId); // 清理定时器
      this.timerId = null; // 重置句柄
    }
  }

  private start(): void { // 启动定时器
    this.stop(); // 先清理旧定时器
    this.timerId = setInterval(() => { // 创建新定时器
      void this.reportLogs(); // 定时上报
    }, this.reportIntervalMs); // 使用固定间隔
  }

  private canReport(): boolean { // 判断是否具备上报条件
    return Boolean(this.context.restBaseUrl && this.context.appKey && this.context.userId && this.context.token); // 校验必要字段
  }

  private formatEntry(entry: LogEntry): string { // 格式化日志条目
    const argsText = entry.args.length > 0 // 判断是否有参数
      ? entry.args.map((arg) => serializeArg(arg)).join(' ') // 拼接参数
      : ''; // 无参数时空字符串
    const message = argsText ? `${entry.message} ${argsText}` : entry.message; // 拼接消息
    return `${entry.timestamp} [${entry.level}] ${message}`; // 返回最终格式
  }

  private pushBuffer(line: string): void { // 写入缓存
    const bytes = line.length; // 估算字节数
    if (bytes >= this.maxBufferBytes) { // 单条日志超限
      return; // 丢弃超大日志
    }
    while (this.bufferBytes + bytes > this.maxBufferBytes && this.buffer.length > 0) { // 超出缓存限制
      const removed = this.buffer.shift(); // 移除最旧日志
      if (removed) { // 保障存在
        this.bufferBytes -= removed.length; // 更新缓存大小
      }
    }
    this.buffer.push(line); // 推入缓存
    this.bufferBytes += bytes; // 更新缓存大小
  }

  private consumeBuffer(): string[] { // 消费缓存并分片
    if (this.buffer.length === 0) { // 无缓存时
      return []; // 返回空数组
    }
    const raw = `${this.buffer.join('\\n')}\\n`; // 拼接完整日志
    this.buffer = []; // 清空缓存
    this.bufferBytes = 0; // 重置字节数
    const chunks: string[] = []; // 初始化分片数组
    let remaining = raw; // 剩余日志内容
    while (remaining.length > this.maxChunkBytes) { // 按大小分片
      chunks.push(remaining.slice(0, this.maxChunkBytes)); // 推入分片
      remaining = remaining.slice(this.maxChunkBytes); // 更新剩余内容
    }
    if (remaining.length > 0) { // 处理剩余内容
      chunks.push(remaining); // 推入最后分片
    }
    return chunks; // 返回分片结果
  }

  private requeueChunk(chunk: string): void { // 回退分片
    this.pushBuffer(chunk); // 重新写回缓存
  }

  private async reportLogs(): Promise<void> { // 执行日志上报
    if (!this.enabled) { // 未开启上报
      return; // 直接返回
    }
    if (this.reporting) { // 避免并发上报
      return; // 直接返回
    }
    if (this.buffer.length === 0) { // 缓存为空
      return; // 直接返回
    }
    this.reporting = true; // 标记上报中
    try { // 上报流程
      const chunks = this.consumeBuffer(); // 获取分片
      if (chunks.length === 0) { // 无分片
        return; // 结束上报
      }
      if (!this.canReport()) { // 缺少上报条件
        chunks.forEach((chunk) => this.requeueChunk(chunk)); // 回退所有分片
        return; // 结束上报
      }
      for (const chunk of chunks) { // 遍历分片
        const success = await this.reportChunk(chunk); // 上报分片
        if (!success) { // 上报失败
          this.requeueChunk(chunk); // 回退失败分片
        }
        await delay(this.chunkDelayMs); // 分片间延迟
      }
    } finally { // 结束上报
      this.reporting = false; // 重置状态
    }
  }

  private async reportChunk(chunk: string): Promise<boolean> { // 上报单个分片
    if (!this.canReport()) { // 再次校验条件
      return false; // 无法上报
    }
    const { restBaseUrl, appKey, userId, token, resource } = this.context; // 读取上下文
    if (!restBaseUrl || !appKey || !userId || !token) { // 必要字段缺失
      return false; // 无法上报
    }
    let orgName = ''; // 初始化 orgName
    let appName = ''; // 初始化 appName
    try { // 解析 appKey
      const parsed = parseAppKey(appKey); // 解析 appKey
      orgName = parsed.orgName; // 设置 orgName
      appName = parsed.appName; // 设置 appName
    } catch { // 解析失败
      return false; // 放弃上报
    }
    const url = `${restBaseUrl}/${orgName}/${appName}/sdk/users/${userId}/client/logs`; // 构建上报地址
    const payload = { // 构建上报体
      resource: resource ?? 'webim', // 资源标识
      logContent: chunk, // 日志内容
    };
    const controller = new AbortController(); // 创建中止控制器
    const timeoutId = setTimeout(() => controller.abort(), this.reportTimeoutMs); // 设置请求超时
    try { // 发起请求
      const response = await fetch(url, { // 使用 fetch 请求
        method: 'POST', // POST 请求
        headers: { // 请求头
          Authorization: `Bearer ${token}`, // 鉴权头
          'Content-Type': 'application/json', // JSON 类型
          Accept: 'application/json', // 接受 JSON
        }, // 结束请求头
        body: JSON.stringify(payload), // 请求体
        signal: controller.signal, // 绑定中止信号
      });
      if (!response.ok) { // HTTP 异常
        return false; // 上报失败
      }
      try { // 尝试解析响应
        const data = await response.json() as { status?: string }; // 读取响应
        if (data && data.status && data.status !== 'ok') { // 业务状态非 ok
          return false; // 上报失败
        }
      } catch { // 解析失败
        return true; // 视为成功
      }
      return true; // 上报成功
    } catch { // 请求异常
      return false; // 上报失败
    } finally { // 清理计时器
      clearTimeout(timeoutId); // 清理超时
    }
  }
} // 结束 LogReporter

export const logReporter = new LogReporter(); // 全局日志上报器
