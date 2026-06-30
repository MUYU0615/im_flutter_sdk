import { afterEach, describe, expect, it, vi } from 'vitest';

import { resolveDnsConfig } from '@/rest/dns-config';
import { ERROR_CODES } from '@/utils/error-codes';

const createJsonResponse = (data: unknown): Response => {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: {
      get: (): string => 'application/json',
    },
    json: (): Promise<unknown> => Promise.resolve(data),
    text: (): Promise<string> => Promise.resolve(JSON.stringify(data)),
  } as unknown as Response;
};

describe('dns-config', () => {
  afterEach((): void => {
    vi.restoreAllMocks();
  });

  it('应解析 enableReportLogs 并构建 websocketUrls/restBaseUrl', async (): Promise<void> => {
    const dnsConfig = {
      rest: { hosts: [{ protocol: 'https', domain: 'rest.example.com', port: 8080 }] },
      'msync-wx': {
        hosts: [
          { protocol: 'https', domain: 'msync-a.example.com', port: 443 },
          { protocol: 'https', domain: 'msync-b.example.com', port: 8443 },
          { protocol: 'https', ip: '10.0.0.1' },
        ],
      },
      'sync-ws': {
        hosts: [
          { protocol: 'https', domain: 'sync-a.example.com', port: 443 },
          { protocol: 'https', domain: 'sync-b.example.com', port: 8443 },
        ],
      },
      enableReportLogs: 'true',
    };
    globalThis.fetch = vi.fn(
      (): Promise<Response> => Promise.resolve(createJsonResponse(dnsConfig))
    ) as unknown as typeof fetch;

    const result = await resolveDnsConfig({
      appKey: 'org#app',
      baseUrls: ['https://rs.example.com'],
      pageProtocol: 'https',
    });

    expect(result.baseUrl).toBe('https://rs.example.com');
    expect(result.websocketUrl).toBe('wss://msync-a.example.com/websocket');
    expect(result.websocketUrls).toEqual([
      'wss://msync-a.example.com/websocket',
      'wss://msync-b.example.com:8443/websocket',
    ]);
    expect(result.syncWebsocketUrls).toEqual([
      'wss://sync-a.example.com',
      'wss://sync-b.example.com:8443',
    ]);
    expect(result.restBaseUrl).toBe('https://rest.example.com:8080');
    expect(result.dnsConfig.enableReportLogs).toBe('true');
  });

  it('pageProtocol=http 时应生成 ws/http 地址', async (): Promise<void> => {
    const dnsConfig = {
      rest: { hosts: [{ protocol: 'http', domain: 'rest.example.com' }] },
      'msync-wx': { hosts: [{ protocol: 'http', domain: 'msync.example.com', port: 80 }] },
    };
    globalThis.fetch = vi.fn(
      (): Promise<Response> => Promise.resolve(createJsonResponse(dnsConfig))
    ) as unknown as typeof fetch;

    const result = await resolveDnsConfig({
      appKey: 'org#app',
      baseUrls: ['https://rs.example.com'],
      pageProtocol: 'http',
    });

    expect(result.websocketUrl).toBe('ws://msync.example.com/websocket');
    expect(result.restBaseUrl).toBe('http://rest.example.com');
  });

  it('新版 DNS 使用 msync 字段时也应兼容解析登录 websocket 地址', async (): Promise<void> => {
    const dnsConfig = {
      rest: { hosts: [{ protocol: 'http', domain: 'rest.example.com' }] },
      msync: { hosts: [{ protocol: 'http', domain: 'msync.example.com', port: 80 }] },
    };
    globalThis.fetch = vi.fn(
      (): Promise<Response> => Promise.resolve(createJsonResponse(dnsConfig))
    ) as unknown as typeof fetch;

    const result = await resolveDnsConfig({
      appKey: 'org#app',
      baseUrls: ['https://rs.example.com'],
      pageProtocol: 'http',
    });

    expect(result.websocketUrl).toBe('ws://msync.example.com/websocket');
    expect(result.websocketUrls).toEqual(['ws://msync.example.com/websocket']);
    expect(result.syncWebsocketUrls).toEqual([]);
    expect(result.restBaseUrl).toBe('http://rest.example.com');
  });

  it('新版 DNS 使用 msync-ws 字段时不应误判为 sync-ws', async (): Promise<void> => {
    const dnsConfig = {
      rest: { hosts: [{ protocol: 'http', domain: 'rest.example.com' }] },
      'msync-ws': { hosts: [{ protocol: 'http', domain: 'msync.example.com', port: 80 }] },
      'sync-ws': { hosts: [{ protocol: 'https', domain: 'sync.example.com', port: 443 }] },
    };
    globalThis.fetch = vi.fn(
      (): Promise<Response> => Promise.resolve(createJsonResponse(dnsConfig))
    ) as unknown as typeof fetch;

    const result = await resolveDnsConfig({
      appKey: 'org#app',
      baseUrls: ['https://rs.example.com'],
      pageProtocol: 'http',
    });

    expect(result.websocketUrl).toBe('ws://msync.example.com/websocket');
    expect(result.websocketUrls).toEqual(['ws://msync.example.com/websocket']);
    expect(result.syncWebsocketUrls).toEqual(['wss://sync.example.com']);
    expect(result.restBaseUrl).toBe('http://rest.example.com');
  });

  it('pageProtocol=http 且仅返回 https host 时应回退使用 https/wss 地址', async (): Promise<void> => {
    const dnsConfig = {
      rest: { hosts: [{ protocol: 'https', domain: 'rest.example.com' }] },
      'msync-wx': { hosts: [{ protocol: 'https', domain: 'msync.example.com', port: 443 }] },
    };
    globalThis.fetch = vi.fn(
      (): Promise<Response> => Promise.resolve(createJsonResponse(dnsConfig))
    ) as unknown as typeof fetch;

    const result = await resolveDnsConfig({
      appKey: 'org#app',
      baseUrls: ['https://rs.example.com'],
      pageProtocol: 'http',
    });

    expect(result.websocketUrl).toBe('wss://msync.example.com/websocket');
    expect(result.restBaseUrl).toBe('https://rest.example.com');
  });

  it('首个 DNS 地址失败时应重试下一个地址', async (): Promise<void> => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error('network failed'))
      .mockResolvedValueOnce(
        createJsonResponse({
          rest: { hosts: [{ protocol: 'https', domain: 'rest.example.com' }] },
          'msync-wx': { hosts: [{ protocol: 'https', domain: 'msync.example.com' }] },
        })
      );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await resolveDnsConfig({
      appKey: 'org#app',
      baseUrls: ['https://rs-a.example.com', 'https://rs-b.example.com'],
      pageProtocol: 'https',
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.baseUrl).toBe('https://rs-b.example.com');
  });

  it('传入完整 DNS URL 时应按原样请求，不追加默认路径和参数', async (): Promise<void> => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      createJsonResponse({
        rest: { hosts: [{ protocol: 'https', domain: 'rest.example.com' }] },
        'msync-wx': { hosts: [{ protocol: 'https', domain: 'msync.example.com' }] },
        'sync-ws': {
          hosts: [{ protocol: 'http', domain: '140.143.132.6', port: '8086' }],
        },
      })
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await resolveDnsConfig({
      appKey: 'org#app',
      baseUrls: ['https://download-sdk.example.com/downloads/lxm/dns.json'],
      pageProtocol: 'http',
    });

    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall?.[0]).toBe('https://download-sdk.example.com/downloads/lxm/dns.json');
    expect(firstCall?.[1]).toBeDefined();
    expect(result.syncWebsocketUrls).toEqual(['ws://140.143.132.6:8086']);
  });

  it('默认 DNS 请求应追加 app_key 与 _v 查询参数', async (): Promise<void> => {
    vi.spyOn(Date, 'now').mockReturnValue(1774331721723);
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      createJsonResponse({
        rest: { hosts: [{ protocol: 'https', domain: 'rest.example.com' }] },
        'msync-wx': { hosts: [{ protocol: 'https', domain: 'msync.example.com' }] },
      })
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await resolveDnsConfig({
      appKey: 'easemob-demo#chatdemoui',
      baseUrls: ['https://rs.example.com'],
      pageProtocol: 'https',
    });

    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall?.[0]).toBe(
      'https://rs.example.com/easemob/server.json?app_key=easemob-demo%23chatdemoui&_v=1774331721723'
    );
  });

  it('msync hosts 仅返回 ip 时应回退使用 ip 地址', async (): Promise<void> => {
    globalThis.fetch = vi.fn(
      (): Promise<Response> =>
        Promise.resolve(
          createJsonResponse({
            rest: { hosts: [{ protocol: 'https', domain: 'rest.example.com' }] },
            'msync-wx': { hosts: [{ protocol: 'http', ip: '127.0.0.1', port: 80 }] },
          })
        )
    ) as unknown as typeof fetch;

    const result = await resolveDnsConfig({
      appKey: 'org#app',
      baseUrls: ['https://rs.example.com'],
      pageProtocol: 'http',
    });

    expect(result.websocketUrl).toBe('ws://127.0.0.1/websocket');
    expect(result.websocketUrls).toEqual(['ws://127.0.0.1/websocket']);
  });

  it('msync hosts 缺失 domain/ip 时应抛出 DNS exhausted', async (): Promise<void> => {
    globalThis.fetch = vi.fn(
      (): Promise<Response> =>
        Promise.resolve(
          createJsonResponse({
            rest: { hosts: [{ protocol: 'https', domain: 'rest.example.com' }] },
            'msync-wx': { hosts: [{ protocol: 'https' }] },
          })
        )
    ) as unknown as typeof fetch;

    try {
      await resolveDnsConfig({
        appKey: 'org#app',
        baseUrls: ['https://rs.example.com'],
        pageProtocol: 'https',
      });
      expect.unreachable('expected resolveDnsConfig to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      const dnsError = error as Error & { code?: number; details?: Record<string, unknown> };
      expect(dnsError.code).toBe(ERROR_CODES.CONNECTION_DNSLIST_FAILED);
      expect(dnsError.details?.['stage']).toBe('dns');
      expect(dnsError.details?.['causeCode']).toBe(ERROR_CODES.VALIDATION_INVALID_FORMAT);
    }
  });

  it('rest host 缺失 domain/ip 时应抛出 DNS exhausted', async (): Promise<void> => {
    globalThis.fetch = vi.fn(
      (): Promise<Response> =>
        Promise.resolve(
          createJsonResponse({
            rest: { hosts: [{ protocol: 'https' }] },
            'msync-wx': { hosts: [{ protocol: 'https', domain: 'msync.example.com' }] },
          })
        )
    ) as unknown as typeof fetch;

    try {
      await resolveDnsConfig({
        appKey: 'org#app',
        baseUrls: ['https://rs.example.com'],
        pageProtocol: 'https',
      });
      expect.unreachable('expected resolveDnsConfig to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      const dnsError = error as Error & { code?: number; details?: Record<string, unknown> };
      expect(dnsError.code).toBe(ERROR_CODES.CONNECTION_DNSLIST_FAILED);
      expect(dnsError.details?.['stage']).toBe('dns');
      expect(dnsError.details?.['causeCode']).toBe(ERROR_CODES.VALIDATION_REQUIRED);
    }
  });
});
