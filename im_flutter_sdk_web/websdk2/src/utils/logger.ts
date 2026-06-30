/**
 * 日志工具
 * 
 * 支持结构化日志，多级别日志控制
 */

import { logReporter, type LogEntry, type LogReporterContext } from './log-reporter'; // 日志上报器与类型
import { sanitizeLogArgs } from './log-sanitizer'; // 日志脱敏工具
import type { LogLevel } from '../types'; // 日志级别类型

/* eslint-disable no-console */ // 允许控制台输出

export interface Logger { // 日志接口
  debug(message: string, ...args: unknown[]): void; // 调试级别日志
  warn(message: string, ...args: unknown[]): void; // 警告级别日志
  error(message: string, ...args: unknown[]): void; // 错误级别日志
} // 日志接口结束

/** 浏览器环境支持 %c 样式（小程序无 document） */
const supportsConsoleStyle = typeof document !== 'undefined';
/** 统一日志颜色 */
const LOG_STYLE = 'color: rgb(0, 157, 255); font-weight: bold';

/**
 * 日志级别优先级
 */
const LOG_LEVELS: Record<LogLevel, number> = {
  DEBUG: 0, // DEBUG 最低优先级
  WARN: 1, // WARN 中等优先级
  ERROR: 2, // ERROR 最高优先级
}; // 日志优先级映射

/**
 * 生成日志条目
 */
const createLogEntry = (level: LogLevel, message: string, args: ReadonlyArray<unknown>): LogEntry => {
  return {
    timestamp: new Date().toISOString(), // 记录日志时间
    level, // 记录日志级别
    message, // 记录日志正文
    args, // 记录日志参数（已脱敏）
  };
};

/**
 * 默认日志实现
 */
class DefaultLogger implements Logger { // 默认日志器实现
  private level: LogLevel; // 当前日志级别

  constructor(level: LogLevel = 'WARN') {
    this.level = level; // 初始化日志级别
  }

  setLevel(level: LogLevel): void {
    this.level = level; // 更新日志级别
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level]; // 判断是否应输出
  }

  private emit(level: LogLevel, message: string, args: ReadonlyArray<unknown>): void {
    const sanitizedArgs = sanitizeLogArgs(args); // 脱敏日志参数
    const entry = createLogEntry(level, message, sanitizedArgs); // 构建日志条目
    logReporter.append(entry); // 写入上报缓存
    const now = new Date();
    const ts = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${String(now.getMilliseconds()).padStart(3, '0')}`;
    const tag = `[Chat][${level}][${ts}]`;
    if (supportsConsoleStyle) {
      console.log(`%c${tag}`, LOG_STYLE, message, ...sanitizedArgs);
    } else {
      console.log(tag, message, ...sanitizedArgs);
    }
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog('DEBUG')) {
      this.emit('DEBUG', message, args); // 输出 DEBUG 日志
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog('WARN')) {
      this.emit('WARN', message, args); // 输出 WARN 日志
    }
  }

  error(message: string, ...args: unknown[]): void {
    if (this.shouldLog('ERROR')) {
      this.emit('ERROR', message, args); // 输出 ERROR 日志
    }
  }
} // 默认日志器结束

/**
 * 全局日志实例
 */
let globalLogger: Logger = new DefaultLogger(); // 初始化默认日志器

/**
 * 设置全局日志级别
 */
export function setLogLevel(level: LogLevel): void {
  if (globalLogger instanceof DefaultLogger) {
    globalLogger.setLevel(level); // 更新默认日志器级别
  }
}

/**
 * 设置自定义日志器
 */
export function setLogger(logger: Logger): void {
  globalLogger = logger; // 覆盖全局日志器
}

/**
 * 获取当前日志器
 */
export function getLogger(): Logger {
  return globalLogger; // 返回全局日志器
}

/**
 * 设置日志上报开关
 */
export function setLogReportEnabled(enabled: boolean): void {
  logReporter.setEnabled(enabled); // 设置上报开关
}

/**
 * 更新日志上报上下文
 */
export function updateLogReportContext(context: Partial<LogReporterContext>): void {
  logReporter.updateContext(context); // 更新上报上下文
}

/**
 * 立即触发日志上报
 */
export async function reportLogsNow(): Promise<void> {
  await logReporter.reportNow(); // 触发立即上报
}

/**
 * 停止日志上报定时器
 */
export function stopLogReporter(): void {
  logReporter.stop(); // 关闭上报定时器
}

/**
 * 导出日志方法
 */
export const logger: Logger = { // 导出日志对象
  debug: (message: string, ...args: unknown[]) => globalLogger.debug(message, ...args), // 输出 DEBUG 日志
  warn: (message: string, ...args: unknown[]) => globalLogger.warn(message, ...args), // 输出 WARN 日志
  error: (message: string, ...args: unknown[]) => globalLogger.error(message, ...args), // 输出 ERROR 日志
}; // 结束导出日志对象
