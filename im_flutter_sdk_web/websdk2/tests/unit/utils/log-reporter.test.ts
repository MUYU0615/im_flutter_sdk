import { afterEach, describe, expect, it, vi } from 'vitest'; // 测试工具
import { LogReporter } from '@/utils/log-reporter'; // 日志上报器

const createJsonResponse = (data: unknown): Response => { // 构造 JSON 响应
  return { // 返回 Response 结构
    ok: true, // 响应成功
    status: 200, // 状态码
    statusText: 'OK', // 状态描述
    headers: { // 响应头
      get: () => 'application/json', // 内容类型
    }, // 结束响应头
    json: async () => data, // JSON 响应体
    text: async () => JSON.stringify(data), // 文本响应体
  } as unknown as Response; // 断言为 Response
};

describe('log-reporter', () => { // 日志上报器测试
  afterEach((): void => { // 清理环境
    vi.restoreAllMocks(); // 恢复 mock
  });

  it('should chunk and send logs when enabled', async (): Promise<void> => { // 分片上报测试
    const reporter = new LogReporter({ // 创建上报器
      reportIntervalMs: 1000, // 设置上报间隔
      chunkDelayMs: 0, // 取消分片延迟
      maxChunkBytes: 50, // 限制分片大小
      maxBufferBytes: 1000, // 限制缓存大小
    });
    reporter.updateContext({ // 配置上报上下文
      restBaseUrl: 'https://rest.example.com', // REST 地址
      appKey: 'org#app', // appKey
      userId: 'user-1', // 用户 ID
      token: 'token-1', // token
      resource: 'device-1', // 资源标识
    });
    reporter.setEnabled(true); // 开启上报

    const fetchMock = vi.fn(async () => createJsonResponse({ status: 'ok' })); // Mock fetch
    globalThis.fetch = fetchMock as unknown as typeof fetch; // 注入 fetch

    reporter.append({ // 写入日志
      timestamp: '2026-02-04T00:00:00.000Z', // 固定时间
      level: 'DEBUG', // 日志级别
      message: 'log-message', // 日志内容
      args: ['x'.repeat(200)], // 构造大参数
    });

    await reporter.reportNow(); // 触发上报

    expect(fetchMock.mock.calls.length).toBeGreaterThan(0); // 断言有上报请求
  });
});
