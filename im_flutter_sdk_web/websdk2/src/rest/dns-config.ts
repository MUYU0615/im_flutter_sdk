/**
 * dnsconfig 请求与解析
 */

import { RestClient } from './client';
import { Validator } from '../validators/validator';
import { dnsConfigResponseSchema } from '../validators/chat-client';
import { ConnectionError, ValidationError } from '../utils/errors';
import { ERROR_CODES } from '../utils/error-codes';
import { logger } from '../utils/logger';
import type { DnsConfig, DnsHost } from '../types/chat-client';

export const DEFAULT_DNS_CONFIG_URLS = [
  'https://rs.easemob.com',
  'https://rs.chat.agora.io',
  'http://59.110.89.59',
  'http://39.97.193.190',
  'http://39.97.193.187',
];

export interface DnsConfigResult {
  websocketUrl: string;
  websocketUrls: string[]; // WebSocket 地址列表
  syncWebsocketUrls: string[]; // 联系人同步 WebSocket 地址列表
  baseUrl: string;
  restBaseUrl: string;
  dnsConfig: DnsConfig;
}

const DNS_SOCKET_SECTION_ALIASES = [
  'msync-wx',
  'msync-ws',
  'msync',
  'msync-web',
  'websocket',
  'websocket-im',
  'im-websocket',
  'im-ws',
  'socket',
] as const;

const DNS_SYNC_SOCKET_SECTION_ALIASES = [
  'sync-ws',
  'sync_ws',
  'syncws',
  'roster-ws',
  'contact-sync-ws',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasHostsArray(value: unknown): value is { hosts: unknown[] } {
  return isRecord(value) && 'hosts' in value && Array.isArray(value.hosts);
}

function normalizeDnsSection(value: unknown): { hosts: unknown[] } | undefined {
  if (Array.isArray(value)) {
    return { hosts: value };
  }
  if (hasHostsArray(value)) {
    return { hosts: value.hosts };
  }
  return undefined;
}

function pickDnsSection(
  rawConfig: Record<string, unknown>,
  aliases: ReadonlyArray<string>,
  matcher: (key: string) => boolean
): { key: string; section: { hosts: unknown[] } } | undefined {
  for (const alias of aliases) {
    const normalized = normalizeDnsSection(rawConfig[alias]);
    if (normalized) {
      return { key: alias, section: normalized };
    }
  }

  for (const [key, value] of Object.entries(rawConfig)) {
    if (!matcher(key)) {
      continue;
    }
    const normalized = normalizeDnsSection(value);
    if (normalized) {
      return { key, section: normalized };
    }
  }

  return undefined;
}

function normalizeEnableReportLogs(value: unknown): 'true' | 'false' | undefined {
  if (value === 'true' || value === true) {
    return 'true';
  }
  if (value === 'false' || value === false) {
    return 'false';
  }
  return undefined;
}

function normalizeDnsConfigResponse(rawResponse: unknown): DnsConfig {
  if (!isRecord(rawResponse)) {
    return Validator.validateOrThrow(dnsConfigResponseSchema, rawResponse);
  }

  const restSection = normalizeDnsSection(rawResponse.rest);
  const socketSection = pickDnsSection(rawResponse, DNS_SOCKET_SECTION_ALIASES, key => {
    const normalizedKey = key.toLowerCase();
    return (
      normalizedKey.includes('msync') ||
      normalizedKey.includes('websocket') ||
      normalizedKey === 'socket' ||
      normalizedKey === 'im-ws'
    );
  });
  const syncSocketSection = pickDnsSection(rawResponse, DNS_SYNC_SOCKET_SECTION_ALIASES, key => {
    const normalizedKey = key.toLowerCase();
    return (
      !normalizedKey.includes('msync') &&
      normalizedKey.includes('sync') &&
      (normalizedKey.includes('ws') || normalizedKey.includes('socket'))
    );
  });

  const normalized: Record<string, unknown> = {
    ...rawResponse,
    rest: restSection ?? rawResponse.rest,
    'msync-wx': socketSection?.section,
  };

  if (syncSocketSection?.section) {
    normalized['sync-ws'] = syncSocketSection.section;
  } else if ('sync-ws' in normalized && !normalizeDnsSection(normalized['sync-ws'])) {
    delete normalized['sync-ws'];
  }

  const enableReportLogs = normalizeEnableReportLogs(rawResponse.enableReportLogs);
  if (enableReportLogs) {
    normalized.enableReportLogs = enableReportLogs;
  }

  if (socketSection && socketSection.key !== 'msync-wx') {
    logger.warn('DNS config websocket section normalized', {
      sourceKey: socketSection.key,
    });
  }

  if (syncSocketSection && syncSocketSection.key !== 'sync-ws') {
    logger.warn('DNS config sync websocket section normalized', {
      sourceKey: syncSocketSection.key,
    });
  }

  return Validator.validateOrThrow(dnsConfigResponseSchema, normalized) as DnsConfig;
}

function getPageProtocol(): 'http' | 'https' {
  if (typeof window === 'undefined') {
    return 'https';
  }
  return window.location?.protocol === 'https:' ? 'https' : 'http';
}

function buildWebSocketUrl(host: DnsHost, pageProtocol: 'http' | 'https'): string {
  const hostValue = host.domain || host.ip;
  if (!hostValue) {
    throw new ValidationError('DNS host missing domain/ip', {
      code: ERROR_CODES.VALIDATION_REQUIRED,
      details: {
        fields: [
          {
            path: 'dns.host',
            message: 'DNS host missing domain/ip',
            rule: 'required',
          },
        ],
      },
    });
  }

  const port = host.port !== undefined ? String(host.port) : '';
  const needsPort = port && port !== '80' && port !== '443';
  const address = needsPort ? `${hostValue}:${port}` : hostValue;
  const wsProtocol = pageProtocol === 'https' ? 'wss' : 'ws';

  return `${wsProtocol}://${address}/websocket`;
}

function buildSocketOriginUrl(host: DnsHost, pageProtocol: 'http' | 'https'): string {
  const hostValue = host.domain || host.ip;
  if (!hostValue) {
    throw new ValidationError('DNS host missing domain/ip', {
      code: ERROR_CODES.VALIDATION_REQUIRED,
      details: {
        fields: [
          {
            path: 'dns.host',
            message: 'DNS host missing domain/ip',
            rule: 'required',
          },
        ],
      },
    });
  }

  const port = host.port !== undefined ? String(host.port) : '';
  const needsPort = port && port !== '80' && port !== '443';
  const address = needsPort ? `${hostValue}:${port}` : hostValue;
  const wsProtocol = pageProtocol === 'https' ? 'wss' : 'ws';

  return `${wsProtocol}://${address}`;
}

function resolveSocketProtocol(
  hostProtocol: string | undefined,
  fallbackProtocol: 'http' | 'https'
): 'http' | 'https' {
  if (hostProtocol === 'https') {
    return 'https';
  }
  if (hostProtocol === 'http') {
    return 'http';
  }
  return fallbackProtocol;
}

function buildRestBaseUrl(host: DnsHost, protocol: 'http' | 'https'): string {
  const hostValue = host.domain || host.ip;
  if (!hostValue) {
    throw new ValidationError('DNS rest host missing domain/ip', {
      code: ERROR_CODES.VALIDATION_REQUIRED,
      details: {
        fields: [
          {
            path: 'dns.rest.host',
            message: 'DNS rest host missing domain/ip',
            rule: 'required',
          },
        ],
      },
    });
  }

  const port = host.port !== undefined ? String(host.port) : '';
  const needsPort = port && port !== '80' && port !== '443';
  const address = needsPort ? `${hostValue}:${port}` : hostValue;
  return `${protocol}://${address}`;
}

function filterHostsByProtocol(hosts: DnsHost[], protocol: 'http' | 'https'): DnsHost[] {
  const exactMatches = hosts.filter(host => host.protocol === protocol);
  if (exactMatches.length > 0) {
    return exactMatches;
  }
  if (protocol === 'http') {
    return hosts.filter(host => host.protocol === 'https');
  }
  return [];
}

function filterDomainHosts(hosts: DnsHost[]): DnsHost[] {
  // 过滤出域名主机
  return hosts.filter(host => Boolean(host.domain)); // 仅保留域名
}

function pickPreferredSocketHosts(hosts: DnsHost[]): DnsHost[] {
  const domainHosts = filterDomainHosts(hosts);
  if (domainHosts.length > 0) {
    return domainHosts;
  }
  return hosts.filter(host => Boolean(host.domain || host.ip));
}

async function requestDnsConfig(baseUrl: string, appKey: string): Promise<DnsConfig> {
  const client = new RestClient(baseUrl);
  let endpoint = '/easemob/server.json';
  let shouldAppendDefaultQuery = true;
  try {
    const parsed = new URL(baseUrl);
    const hasCustomPath = parsed.pathname !== '' && parsed.pathname !== '/';
    const hasCustomQuery = parsed.search !== '';
    if (hasCustomPath || hasCustomQuery) {
      endpoint = '';
      shouldAppendDefaultQuery = false;
    }
  } catch {
    endpoint = '/easemob/server.json';
    shouldAppendDefaultQuery = true;
  }

  if (shouldAppendDefaultQuery) {
    const query = new URLSearchParams({
      app_key: appKey,
      _v: String(Date.now()),
    });
    endpoint = `${endpoint}?${query.toString()}`;
  }

  const response = await client.get<unknown>(endpoint);
  return normalizeDnsConfigResponse(response);
}

function extractSyncWebSocketUrls(
  dnsConfig: DnsConfig,
  pageProtocol: 'http' | 'https'
): string[] {
  const rawSyncWs = dnsConfig['sync-ws'];
  if (rawSyncWs && Array.isArray(rawSyncWs.hosts)) {
    return rawSyncWs.hosts
      .map(host => {
        return buildSocketOriginUrl(
          host,
          resolveSocketProtocol(host.protocol, pageProtocol)
        );
      })
      .filter((url): url is string => {
        return typeof url === 'string' && url.length > 0;
      });
  }
  return [];
}

export async function resolveDnsConfig(options: {
  appKey: string;
  baseUrls?: string[];
  pageProtocol?: 'http' | 'https';
}): Promise<DnsConfigResult> {
  const baseUrls =
    options.baseUrls && options.baseUrls.length > 0 ? options.baseUrls : DEFAULT_DNS_CONFIG_URLS;

  if (baseUrls.length === 0) {
    throw new ValidationError('DNS_CONFIG list is empty', {
      code: ERROR_CODES.VALIDATION_REQUIRED,
      details: {
        fields: [
          {
            path: 'serviceConfig.dnsConfigUrls',
            message: 'DNS_CONFIG list is empty',
            rule: 'required',
          },
        ],
      },
    });
  }

  const protocol = options.pageProtocol ?? getPageProtocol();
  let lastError: Error | undefined;

  for (const baseUrl of baseUrls) {
    try {
      const dnsConfig = await requestDnsConfig(baseUrl, options.appKey);
      const socketHosts = filterHostsByProtocol(dnsConfig['msync-wx'].hosts, protocol); // 按协议过滤 ws host
      const preferredSocketHosts = pickPreferredSocketHosts(socketHosts); // 优先域名，缺失时回退到 ip host

      if (preferredSocketHosts.length === 0) {
        throw new ValidationError('DNS msync-wx hosts resolution failed', {
          code: ERROR_CODES.VALIDATION_INVALID_FORMAT,
          details: {
            fields: [
              {
                path: 'dns.msync-wx.hosts',
                message: 'DNS msync-wx hosts resolution failed',
                rule: 'invalid_format',
              },
            ],
          },
        });
      }

      const socketHost = preferredSocketHosts[0];
      if (!socketHost) {
        throw new ValidationError('DNS msync-wx hosts resolution failed', {
          code: ERROR_CODES.VALIDATION_INVALID_FORMAT,
          details: {
            fields: [
              {
                path: 'dns.msync-wx.hosts',
                message: 'DNS msync-wx hosts resolution failed',
                rule: 'invalid_format',
              },
            ],
          },
        });
      }

      const restHosts = filterHostsByProtocol(dnsConfig.rest.hosts, protocol);
      if (restHosts.length === 0) {
        throw new ValidationError('DNS rest hosts resolution failed', {
          code: ERROR_CODES.VALIDATION_INVALID_FORMAT,
          details: {
            fields: [
              {
                path: 'dns.rest.hosts',
                message: 'DNS rest hosts resolution failed',
                rule: 'invalid_format',
              },
            ],
          },
        });
      }

      const restHost = restHosts[0];
      if (!restHost) {
        throw new ValidationError('DNS rest hosts resolution failed', {
          code: ERROR_CODES.VALIDATION_INVALID_FORMAT,
          details: {
            fields: [
              {
                path: 'dns.rest.hosts',
                message: 'DNS rest hosts resolution failed',
                rule: 'invalid_format',
              },
            ],
          },
        });
      }

      const websocketUrls = preferredSocketHosts.map(host =>
        buildWebSocketUrl(host, resolveSocketProtocol(host.protocol, protocol))
      ); // 构建 ws 地址列表
      const websocketUrl = buildWebSocketUrl(
        socketHost,
        resolveSocketProtocol(socketHost.protocol, protocol)
      ); // 使用已校验的首个 ws host 生成默认地址
      const syncWebsocketUrls = extractSyncWebSocketUrls(dnsConfig, protocol);
      const restBaseUrl = buildRestBaseUrl(
        restHost,
        resolveSocketProtocol(restHost.protocol, protocol)
      );
      return { websocketUrl, websocketUrls, syncWebsocketUrls, baseUrl, restBaseUrl, dnsConfig };
    } catch (error) {
      logger.warn('DNS config candidate failed', {
        baseUrl,
        reason: error instanceof Error ? error.message : String(error),
        error:
          error instanceof Error &&
          typeof (error as unknown as { toJSON?: unknown }).toJSON === 'function'
            ? (error as unknown as { toJSON: () => unknown }).toJSON()
            : error,
      });
      lastError = error as Error;
    }
  }

  const errorDetails: Record<string, unknown> = { stage: 'dns' };
  if (lastError) {
    errorDetails.reason = lastError.message;
    if ('code' in lastError && typeof (lastError as { code?: unknown }).code === 'number') {
      errorDetails.causeCode = (lastError as { code?: number }).code;
    }
  }
  throw new ConnectionError('DNS_CONFIG exhausted', {
    code: ERROR_CODES.CONNECTION_DNSLIST_FAILED,
    details: errorDetails,
  });
}
