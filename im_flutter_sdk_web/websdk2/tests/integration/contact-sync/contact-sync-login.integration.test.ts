import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CacheKeyName, buildCacheKey } from '@/cache/cache-keys';
import { ChatClient } from '@/chat-client';
import { CACHE_SCHEMA_VERSION } from '@/config/cache';
import { ContactManager } from '@/managers/contact';
import { UserInfoManager } from '@/managers/user-info';
import { ConnectionManager } from '@/core/connection/connection-manager';
import { getRosterRoot } from '@/protocol/roster/root';
import { SessionListCodec } from '@/protocol/session-list/codec';
import sessionListProtoJson from '@/protocol/session-list/proto';
import { SessionListMessageType } from '@/protocol/session-list/types';
import { logger } from '@/utils/logger';
import { ERROR_CODES } from '@/utils/error-codes';
import { buildProvisionResponse } from '../../test-utils/msync';
import {
  buildRosterResponseFrame,
  toArrayBuffer,
} from '../../test-utils/contact-sync/build-roster-frame';
import { Root, configure, util, type INamespace } from 'protobufjs/light';
import Long from 'long';

const APP_KEY = 'org#app';
const USER_ID = 'user-1';

util.Long = Long;
configure();
const sessionListRoot = Root.fromJSON(sessionListProtoJson as INamespace);
const sessionListResponseType = sessionListRoot.lookupType('easemob.sessionlist.GetSessionListResponse');

type ContactClient = ChatClient & {
  readonly contactManager: ContactManager;
};

type RosterSocketAction =
  | {
      readonly type: 'message';
      readonly data: ArrayBuffer | ((requestId: string) => ArrayBuffer);
    }
  | {
      readonly type: 'close';
      readonly code?: number;
      readonly reason?: string;
    };

type LongLike = {
  toNumber: () => number;
};

const isLongLike = (value: unknown): value is LongLike => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'toNumber' in value &&
    typeof (value as LongLike).toNumber === 'function'
  );
};

const resetSingleton = (): void => {
  (ChatClient as unknown as { instance: ChatClient | null }).instance = null;
};

const decodeRosterRequest = (payload: ArrayBuffer | ArrayBufferView): {
  readonly cursor: number;
  readonly requestId: string;
} => {
  const root = getRosterRoot();
  const type = root.lookupType('easemob.imfusion.gateway.v1.GetRosterRequest');
  const decoded = type.decode(
    payload instanceof ArrayBuffer
      ? new Uint8Array(payload)
      : new Uint8Array(payload.buffer, payload.byteOffset, payload.byteLength)
  ) as unknown as Record<string, unknown>;
  const header = (decoded.header ?? {}) as Record<string, unknown>;
  const cursorValue = decoded.cursor;
  return {
    cursor: typeof cursorValue === 'number' ? cursorValue : isLongLike(cursorValue) ? cursorValue.toNumber() : 0,
    requestId: typeof header.requestId === 'string' ? header.requestId : '',
  };
};

const decodeSessionListRequest = (payload: ArrayBuffer | ArrayBufferView): {
  readonly requestId: string;
} | null => {
  const bytes =
    payload instanceof ArrayBuffer
      ? new Uint8Array(payload)
      : new Uint8Array(payload.buffer, payload.byteOffset, payload.byteLength);
  const decoded = new SessionListCodec().decode(bytes);
  if (decoded.type !== SessionListMessageType.GET_SESSION_LIST_REQUEST) {
    return null;
  }
  const request = decoded as { readonly header?: { readonly requestId?: string } };
  return {
    requestId: request.header?.requestId ?? '',
  };
};

const buildSessionListResponseFrame = (requestId: string): ArrayBuffer => {
  return toArrayBuffer(
    sessionListResponseType
      .encode(
        sessionListResponseType.create({
          type: SessionListMessageType.GET_SESSION_LIST_RESPONSE,
          header: {
            resource: 'web',
            timestamp: Date.now(),
            request_id: requestId,
            protocol_version: 1,
          },
          sessions: [],
          is_last_batch: true,
          last_sync_finished_ts: 0,
        })
      )
      .finish()
  );
};

class DualChannelWebSocket {
  public static readonly CONNECTING = 0;
  public static readonly OPEN = 1;
  public static readonly CLOSING = 2;
  public static readonly CLOSED = 3;
  public static instances: DualChannelWebSocket[] = [];
  public static rosterRequestRecords: Array<{
    readonly url: string;
    readonly cursor: number;
    readonly requestId: string;
  }> = [];
  public static sessionListRequestRecords: Array<{
    readonly url: string;
    readonly requestId: string;
  }> = [];
  public static rosterScripts: RosterSocketAction[][] = [];

  public readyState = DualChannelWebSocket.CONNECTING;
  public binaryType = 'arraybuffer';
  public onopen: ((event: Event) => void) | null = null;
  public onclose: ((event: CloseEvent) => void) | null = null;
  public onerror: ((event: Event) => void) | null = null;
  public onmessage: ((event: MessageEvent) => void) | null = null;
  private readonly listeners = new Map<string, Set<(event: Event) => void>>();
  private provisionHandled = false;

  public constructor(public readonly url: string) {
    DualChannelWebSocket.instances.push(this);
    queueMicrotask(() => {
      this.readyState = DualChannelWebSocket.OPEN;
      this.emit('open', new Event('open'));
      if (!this.isRosterSocket()) {
        this.emit('message', {
          data: buildProvisionResponse(),
        } as MessageEvent as unknown as Event);
      }
    });
  }

  public send(data: unknown): void {
    const sessionListRequest =
      (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) ? decodeSessionListRequest(data) : null;
    if (sessionListRequest) {
      DualChannelWebSocket.sessionListRequestRecords.push({
        url: this.url,
        requestId: sessionListRequest.requestId,
      });
      queueMicrotask(() => {
        this.emit('message', {
          data: buildSessionListResponseFrame(sessionListRequest.requestId),
        } as MessageEvent as unknown as Event);
      });
      return;
    }

    if (this.isRosterSocket()) {
      if (!(data instanceof ArrayBuffer) && !ArrayBuffer.isView(data)) {
        return;
      }
      const decoded = decodeRosterRequest(data);
      const attemptIndex = DualChannelWebSocket.rosterRequestRecords.push({
        url: this.url,
        cursor: decoded.cursor,
        requestId: decoded.requestId,
      }) - 1;
      const scriptedActions = DualChannelWebSocket.rosterScripts[attemptIndex];
      if (scriptedActions) {
        queueMicrotask(() => {
          scriptedActions.forEach(action => {
            if (action.type === 'message') {
              this.emit('message', {
                data: typeof action.data === 'function' ? action.data(decoded.requestId) : action.data,
              } as MessageEvent as unknown as Event);
              return;
            }
            this.close(action.code, action.reason);
          });
        });
        return;
      }
      queueMicrotask(() => {
        this.emit('message', {
          data: toArrayBuffer(
            buildRosterResponseFrame({
              requestId: decoded.requestId,
              items: [
                {
                  contact: 'friend-1',
                  remark: 'remark-1',
                  metadata: JSON.stringify({
                    nickname: 'friend-nick',
                    avatarUrl: 'https://cdn.example.com/friend-1.png',
                    sign: 'hello',
                  }),
                  createdAt: 100,
                  updatedAt: 110,
                  metadataUpdatedAt: 120,
                },
              ],
              version: 'v-sync-1',
            })
          ),
        } as MessageEvent as unknown as Event);
      });
      return;
    }

    if (this.provisionHandled) {
      return;
    }
    this.provisionHandled = true;
    this.emit('message', { data: buildProvisionResponse() } as MessageEvent as unknown as Event);
    void data;
  }

  public close(code?: number, reason?: string): void {
    this.readyState = DualChannelWebSocket.CLOSED;
    this.emit('close', new CloseEvent('close', { code: code ?? 1000, reason: reason ?? '' }));
  }

  public addEventListener(type: string, listener: (event: Event) => void): void {
    const set = this.listeners.get(type) ?? new Set();
    set.add(listener);
    this.listeners.set(type, set);
  }

  public removeEventListener(type: string, listener: (event: Event) => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  private emit(type: string, event: Event): void {
    if (type === 'open') {
      this.onopen?.(event);
    }
    if (type === 'close') {
      this.onclose?.(event as CloseEvent);
    }
    if (type === 'error') {
      this.onerror?.(event);
    }
    if (type === 'message') {
      this.onmessage?.(event as MessageEvent);
    }
    this.listeners.get(type)?.forEach(listener => listener(event));
  }

  private isRosterSocket(): boolean {
    try {
      return new URL(this.url).host.startsWith('sync');
    } catch {
      return false;
    }
  }
}

const createJsonResponse = (data: unknown, status: number = 200): Response => {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status >= 200 && status < 300 ? 'OK' : 'Error',
    headers: {
      get: (): string => 'application/json',
    },
    json: (): Promise<unknown> => Promise.resolve(data),
    text: (): Promise<string> => Promise.resolve(JSON.stringify(data)),
  } as unknown as Response;
};

const getRequestUrl = (input: RequestInfo | URL): string => {
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  return input.url;
};

const buildCacheContext = (): {
  readonly appKey: string;
  readonly userId: string;
  readonly schemaVersion: number;
} => {
  return {
    appKey: APP_KEY,
    userId: USER_ID,
    schemaVersion: CACHE_SCHEMA_VERSION,
  };
};

const writeJsonCache = (key: string, value: unknown): void => {
  localStorage.setItem(key, JSON.stringify(value));
};

const primeCompleteContactCache = (): void => {
  const context = buildCacheContext();
  writeJsonCache(buildCacheKey(context, CacheKeyName.CONTACT_RELATIONS), {
    items: [
      {
        userId: 'friend-cache',
        remark: 'remark-cache',
        sign: 'sign-cache',
        addTs: 200,
        updatedAt: 210,
        metadataUpdatedAt: 220,
      },
    ],
  });
  writeJsonCache(buildCacheKey(context, CacheKeyName.USER_INFO), {
    items: [
      {
        userId: 'friend-cache',
        nickname: 'cached-nick',
        avatarUrl: 'https://cdn.example.com/friend-cache.png',
        lastAccess: 300,
        lastUpdate: 300,
      },
    ],
  });
  writeJsonCache(buildCacheKey(context, CacheKeyName.CONTACT_VERSION), {
    version: 'v-cache-1',
    lastVersionCheckAt: 400,
    lastVersionSource: 'metadata',
  });
  writeJsonCache(buildCacheKey(context, CacheKeyName.CONTACT_META), {
    cacheIntegrity: 'complete',
    lastSyncTs: 500,
    lastSuccessfulVersion: 'v-cache-1',
    lastSyncMode: 'full',
  });
};

const createFetchMock = (options?: {
  readonly metadataMode?: 'success' | 'error' | 'skip';
  readonly metadataStatus?: 200 | 401 | 403 | 404;
  readonly includeSyncWs?: boolean;
  readonly syncWsHosts?: ReadonlyArray<{
    readonly protocol: string;
    readonly domain: string;
    readonly port: number;
  }>;
}): typeof fetch => {
  const metadataMode = options?.metadataMode ?? 'success';
  const includeSyncWs = options?.includeSyncWs ?? true;
  const metadataStatus = options?.metadataStatus ?? 200;

  return vi.fn((input: RequestInfo | URL) => {
    const url = getRequestUrl(input);
    if (url.includes('/easemob/server.json')) {
      const dnsConfig: Record<string, unknown> = {
        rest: { hosts: [{ protocol: 'http', domain: 'rest.example.com', port: 80 }] },
        'msync-wx': { hosts: [{ protocol: 'http', domain: 'msync.example.com', port: 80 }] },
      };
      if (includeSyncWs) {
        dnsConfig['sync-ws'] = {
          hosts: options?.syncWsHosts ?? [{ protocol: 'https', domain: 'sync.example.com', port: 443 }],
        };
      }
      return Promise.resolve(
        createJsonResponse(dnsConfig)
      );
    }
    if (url.includes('/roster/metadata/version')) {
      if (metadataMode === 'error') {
        return Promise.reject(new Error('metadata unavailable'));
      }
      if (metadataStatus >= 400) {
        return Promise.resolve(
          createJsonResponse(
            {
              error: 'metadata unavailable',
            },
            metadataStatus
          )
        );
      }
      return Promise.resolve(
        createJsonResponse({
          version: metadataMode === 'skip' ? 'v-cache-1' : 'v-sync-1',
          requiresSync: metadataMode === 'skip' ? false : true,
        })
      );
    }
    if (url.includes('/conversations/users/')) {
      return Promise.resolve(
        createJsonResponse({
          cursor: '',
          count: 0,
          conversations: [],
        })
      );
    }
    return Promise.resolve(createJsonResponse({}));
  }) as unknown as typeof fetch;
};

const createClient = (): ContactClient => {
  return ChatClient.init({
    appKey: APP_KEY,
    enableSyncData: ['contact'],
    managers: [ContactManager, UserInfoManager] as const,
  }) as ContactClient;
};

describe('contact sync login integration', () => {
  const originalWebSocket = globalThis.WebSocket;
  const originalFetch = globalThis.fetch;

  beforeEach((): void => {
    resetSingleton();
    localStorage.clear();
    DualChannelWebSocket.instances = [];
    DualChannelWebSocket.rosterRequestRecords = [];
    DualChannelWebSocket.sessionListRequestRecords = [];
    DualChannelWebSocket.rosterScripts = [];
    globalThis.WebSocket = DualChannelWebSocket as unknown as typeof WebSocket;
    vi.spyOn(
      ConnectionManager.prototype as unknown as { startProvision: () => Promise<void> },
      'startProvision'
    ).mockResolvedValue(undefined);
  });

  afterEach((): void => {
    globalThis.WebSocket = originalWebSocket;
    globalThis.fetch = originalFetch;
    DualChannelWebSocket.rosterRequestRecords = [];
    DualChannelWebSocket.sessionListRequestRecords = [];
    DualChannelWebSocket.rosterScripts = [];
    vi.restoreAllMocks();
  });

  it('登录后应自动完成联系人同步并回填快照', async () => {
    globalThis.fetch = createFetchMock();

    const client = createClient();
    let startPayload: unknown;
    let finishPayload: unknown;

    const syncFinish = new Promise<void>(resolve => {
      client.addEventHandler('contact-sync-test', {
        onSyncDataStart: payload => {
          if (payload.dataType === 'contact') {
            startPayload = payload;
          }
        },
        onSyncDataFinished: payload => {
          if (payload.dataType === 'contact') {
            finishPayload = payload;
          }
          resolve();
        },
      });
    });

    await client.login({
      userId: USER_ID,
      token: 'token-1',
    });

    await syncFinish;

    expect(startPayload).toEqual({ dataType: 'contact' });
    expect(startPayload).not.toHaveProperty('startedAt');
    expect(finishPayload).toEqual({ dataType: 'contact', status: 'success' });
    expect(finishPayload).not.toHaveProperty('finishedAt');
    expect(finishPayload).not.toHaveProperty('meta');

    const snapshot = client.getContactSnapshot();
    expect(snapshot).not.toBeNull();
    expect(snapshot?.items).toEqual([
      {
        userId: 'friend-1',
        userInfo: {
          userId: 'friend-1',
          nickname: 'friend-nick',
          avatarUrl: 'https://cdn.example.com/friend-1.png',
          sign: 'hello',
        },
        remark: 'remark-1',
        addTs: 100,
      },
    ]);
    expect(
      DualChannelWebSocket.instances.some(
        instance => {
          const parsed = new URL(instance.url);
          return (
            parsed.host === 'sync.example.com' &&
            parsed.pathname === '/ws' &&
            parsed.searchParams.get('token') === 'token-1'
          );
        }
      )
    ).toBe(true);
  });

  it('metadata 判定 skip 时也应派发 start 和 finish 事件', async () => {
    primeCompleteContactCache();
    globalThis.fetch = createFetchMock({ metadataMode: 'skip' });

    const client = createClient();
    const syncStart = vi.fn();
    const syncFinish = vi.fn();
    const waitForSyncFinish = new Promise<void>(resolve => {
      client.addEventHandler('contact-sync-skip', {
        onSyncDataStart: syncStart,
        onSyncDataFinished: (): void => {
          syncFinish();
          resolve();
        },
      });
    });

    await client.login({
      userId: USER_ID,
      token: 'token-1',
    });

    await waitForSyncFinish;

    expect(syncStart).toHaveBeenCalledOnce();
    expect(syncFinish).toHaveBeenCalledOnce();
    expect(client.getContactSnapshot()).toEqual({
      items: [
        {
          userId: 'friend-cache',
          userInfo: {
            userId: 'friend-cache',
            nickname: 'cached-nick',
            avatarUrl: 'https://cdn.example.com/friend-cache.png',
            sign: 'sign-cache',
          },
          remark: 'remark-cache',
          addTs: 200,
        },
      ],
      source: 'cache',
      version: 'v-cache-1',
      complete: true,
    });
    expect(DualChannelWebSocket.rosterRequestRecords).toEqual([]);
  });

  it('metadata 查询失败且本地缓存完整时应直接返回缓存并派发 finish(error)', async () => {
    primeCompleteContactCache();
    const fetchMock = createFetchMock({ metadataMode: 'error' });
    globalThis.fetch = fetchMock;

    const client = createClient();
    const syncStart = vi.fn();
    const syncFinish = new Promise<void>(resolve => {
      client.addEventHandler('contact-sync-cache-fail', {
        onSyncDataStart: (): void => {
          syncStart();
        },
        onSyncDataFinished: payload => {
          expect(payload?.error).toBeDefined();
          expect(payload?.error).toMatchObject({
            code: ERROR_CODES.CONTACT_SYNC_METADATA_FAILED,
            stage: 'metadata',
            retryable: true,
          });
          expect(payload?.error?.message.startsWith('metadata:')).toBe(true);
          resolve();
        },
      });
    });

    await client.login({
      userId: USER_ID,
      token: 'token-1',
    });

    await syncFinish;

    expect(syncStart).toHaveBeenCalledOnce();
    expect(client.getContactSnapshot()).toEqual({
      items: [
        {
          userId: 'friend-cache',
          userInfo: {
            userId: 'friend-cache',
            nickname: 'cached-nick',
            avatarUrl: 'https://cdn.example.com/friend-cache.png',
            sign: 'sign-cache',
          },
          remark: 'remark-cache',
          addTs: 200,
        },
      ],
      source: 'cache',
      version: 'v-cache-1',
      complete: true,
    });
    expect(
      DualChannelWebSocket.instances.some(
        instance => new URL(instance.url).host === 'sync.example.com'
      )
    ).toBe(false);
    expect(DualChannelWebSocket.rosterRequestRecords).toEqual([]);
    expect(fetchMock).toHaveBeenCalled();
  });

  it.each([401, 403, 404] as const)(
    'metadata 预检返回 %i 时应直接派发 finish(error)',
    async (metadataStatus) => {
      primeCompleteContactCache();
      globalThis.fetch = createFetchMock({ metadataStatus });

      const client = createClient();
      const syncStart = vi.fn();
      const syncFinish = new Promise<void>(resolve => {
        client.addEventHandler(`contact-sync-fail-fast-${metadataStatus}`, {
          onSyncDataStart: (): void => {
            syncStart();
          },
          onSyncDataFinished: payload => {
            expect(payload?.error).toMatchObject({
              code: ERROR_CODES.CONTACT_SYNC_METADATA_FAILED,
              stage: 'metadata',
              retryable: false,
            });
            resolve();
          },
        });
      });

      await client.login({
        userId: USER_ID,
        token: 'token-1',
      });

      await syncFinish;

      expect(syncStart).toHaveBeenCalledOnce();
      expect(DualChannelWebSocket.rosterRequestRecords).toEqual([]);
    }
  );

  it('DNS 缺少 sync-ws 时应派发 start 和 finish(error) 并记录 warn 日志', async () => {
    const fetchMock = createFetchMock({ includeSyncWs: false });
    globalThis.fetch = fetchMock;
    const warnSpy = vi.spyOn(logger, 'warn');

    const client = createClient();
    const syncStart = vi.fn();
    const syncFinish = new Promise<void>(resolve => {
      client.addEventHandler('contact-sync-missing-sync-ws', {
        onSyncDataStart: (): void => {
          syncStart();
        },
        onSyncDataFinished: payload => {
          expect(payload?.error).toMatchObject({
            code: ERROR_CODES.CONTACT_SYNC_SOCKET_FAILED,
            stage: 'socket_connect',
          });
          resolve();
        },
      });
    });

    await client.login({
      userId: USER_ID,
      token: 'token-1',
    });

    await syncFinish;

    expect(client.getConnectionState()).toBe('connected');
    expect(syncStart).toHaveBeenCalledOnce();
    expect(
      warnSpy.mock.calls.some(([message]) => {
        return message === 'Automatic contact sync sync-ws is unavailable after DNS precheck';
      })
    ).toBe(true);
    expect(
      DualChannelWebSocket.instances.some(
        instance => new URL(instance.url).host === 'sync.example.com'
      )
    ).toBe(false);
  });

  it('联系人同步中途断线后应基于 cursor 继续同步剩余分页', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999);
    globalThis.fetch = createFetchMock({
      syncWsHosts: [
        { protocol: 'https', domain: 'sync-a.example.com', port: 443 },
        { protocol: 'https', domain: 'sync-b.example.com', port: 443 },
      ],
    });
    DualChannelWebSocket.rosterScripts = [
      [
        {
          type: 'message',
          data: (requestId: string): ArrayBuffer => toArrayBuffer(
            buildRosterResponseFrame({
              requestId,
              items: [
                {
                  contact: 'friend-1',
                  remark: 'remark-1',
                  metadata: JSON.stringify({
                    nickname: 'friend-nick',
                    avatarUrl: 'https://cdn.example.com/friend-1.png',
                    sign: 'hello',
                  }),
                  createdAt: 100,
                  updatedAt: 110,
                  metadataUpdatedAt: 120,
                },
              ],
              version: 'v-sync-1',
              cursor: 9,
            })
          ),
        },
        {
          type: 'close',
          code: 1006,
          reason: 'network-lost',
        },
      ],
      [
        {
          type: 'message',
          data: (requestId: string): ArrayBuffer => toArrayBuffer(
            buildRosterResponseFrame({
              requestId,
              items: [
                {
                  contact: 'friend-2',
                  remark: 'remark-2',
                  metadata: JSON.stringify({
                    nickname: 'friend-nick-2',
                    avatarUrl: 'https://cdn.example.com/friend-2.png',
                    sign: 'world',
                  }),
                  createdAt: 130,
                  updatedAt: 140,
                  metadataUpdatedAt: 150,
                },
              ],
              version: '',
              cursor: 0,
            })
          ),
        },
      ],
    ];

    const client = createClient();
    const syncFinish = new Promise<void>(resolve => {
      client.addEventHandler('contact-sync-resume', {
        onSyncDataFinished: (): void => {
          resolve();
        },
      });
    });

    await client.login({
      userId: USER_ID,
      token: 'token-1',
    });

    await syncFinish;

    expect(DualChannelWebSocket.rosterRequestRecords).toHaveLength(2);
    expect(DualChannelWebSocket.rosterRequestRecords[0]).toMatchObject({
      cursor: 0,
      url: 'wss://sync-a.example.com/ws?token=token-1',
    });
    expect(DualChannelWebSocket.rosterRequestRecords[1]).toMatchObject({
      cursor: 9,
      url: 'wss://sync-b.example.com/ws?token=token-1',
    });
    expect(DualChannelWebSocket.rosterRequestRecords[0]?.requestId).toBe(
      DualChannelWebSocket.rosterRequestRecords[1]?.requestId
    );
    expect(client.getContactSnapshot()).toEqual({
      items: [
        {
          userId: 'friend-1',
          userInfo: {
            userId: 'friend-1',
            nickname: 'friend-nick',
            avatarUrl: 'https://cdn.example.com/friend-1.png',
            sign: 'hello',
          },
          remark: 'remark-1',
          addTs: 100,
        },
        {
          userId: 'friend-2',
          userInfo: {
            userId: 'friend-2',
            nickname: 'friend-nick-2',
            avatarUrl: 'https://cdn.example.com/friend-2.png',
            sign: 'world',
          },
          remark: 'remark-2',
          addTs: 130,
        },
      ],
      source: 'cache',
      version: 'v-sync-1',
      complete: true,
    });
  });
});
