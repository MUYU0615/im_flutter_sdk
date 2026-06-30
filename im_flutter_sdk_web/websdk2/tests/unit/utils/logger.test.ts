import { afterEach, describe, expect, it, vi } from 'vitest'; // 测试工具
import { logger, setLogLevel } from '@/utils/logger'; // 日志工具

describe('logger', () => { // 日志模块测试
  afterEach((): void => { // 每次用例后清理
    vi.restoreAllMocks(); // 恢复 mock
    setLogLevel('WARN'); // 还原默认级别
  }); // 结束 afterEach

  it('should filter debug when level is WARN', (): void => { // 测试 DEBUG 过滤
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined); // 监听 log
    setLogLevel('WARN'); // 设置 WARN 级别
    logger.debug('debug-test'); // 输出 DEBUG 日志
    expect(logSpy).not.toHaveBeenCalled(); // 断言未输出
  }); // 结束 DEBUG 过滤测试

  it('should emit warn when level is WARN', (): void => { // 测试 WARN 输出
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined); // 监听 log
    setLogLevel('WARN'); // 设置 WARN 级别
    logger.warn('warn-test'); // 输出 WARN 日志
    expect(logSpy).toHaveBeenCalled(); // 断言已输出
  }); // 结束 WARN 输出测试
}); // 结束 logger 测试集
