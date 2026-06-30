import { afterEach, describe, expect, it, vi } from 'vitest';

import { RosterSyncController } from '@/core/contact-sync/roster-sync-controller';
import { RosterSyncClient } from '@/core/contact-sync/roster-sync-client';
import { SharedSyncWebSocketSession } from '@/core/sync/shared-sync-websocket-session';
import type {
  ContactSyncContextState,
  ContactSyncDependencies,
} from '@/core/contact-sync/roster-sync-types';
import { RosterMessageType, RosterResponseType } from '@/protocol/roster/types';
import type { RosterRequest, RosterResponse } from '@/protocol/roster/types';
import type { ContactSnapshot } from '@/types/contact';
import { ERROR_CODES } from '@/utils/error-codes';
import { SDKError } from '@/utils/errors';
import { logger } from '@/utils/logger';

const createSnapshot = (complete: boolean, version: string = 'v1'): ContactSnapshot => {
  return {
    items: complete
      ? [
          {
            userId: 'cached-user',
            userInfo: {
              userId: 'cached-user',
              nickname: 'cached-nick',
              avatarUrl: 'https://cdn.example.com/cached.png',
              sign: 'cached-sign',
            },
            remark: 'cached-remark',
            addTs: 1,
          },
        ]
      : [],
    source: 'cache',
    version,
    complete,
  };
};

const createState = (overrides?: Partial<ContactSyncContextState>): ContactSyncContextState => {
  return {
    cacheMeta: {
      cacheIntegrity: 'complete',
      lastSyncTs: 100,
      lastSuccessfulVersion: 'v1',
      lastSyncMode: 'incremental',
    },
    versionState: {
      version: 'v1',
      lastVersionCheckAt: 0,
      lastVersionSource: 'metadata',
    },
    cachedSnapshot: createSnapshot(true),
    ...overrides,
  };
};

const createRequest = (): RosterRequest => {
  return {
    type: RosterMessageType.REQUEST,
    header: {
      resource: 'web',
      timestamp: 1,
      requestId: 'r1',
      protocolVersion: 1,
    },
    org: 'org',
    app: 'app',
    username: 'user-1',
    version: 'v1',
    cursor: 0,
  };
};

const createSharedSyncSession = (): SharedSyncWebSocketSession => {
  return new SharedSyncWebSocketSession({
    getUrls: () => Promise.resolve(['wss://sync.example.com/ws']),
  });
};

const createRosterResponse = (data: RosterResponse['data']): RosterResponse => {
  return {
    type: RosterMessageType.RESPONSE,
    data,
    cursor: 0,
    version: 'v2',
    responseType: RosterResponseType.FULL,
  };
};

const createDeferred = <T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
} => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

interface DependencyHarness {
  readonly deps: ContactSyncDependencies;
  readonly starts: ReadonlyArray<undefined>;
  readonly finishes: Array<
    | undefined
    | {
      error?: {
        code: number;
        stage: 'metadata' | 'socket_connect' | 'sync_page' | 'decode' | 'cancelled';
        message: string;
        retryable: boolean;
      };
    }
  >;
  readonly queryCalls: string[];
  readonly buildRequestCalls: Array<{
    decision: 'skip' | 'incremental' | 'full';
    version: string;
  }>;
  readonly applyCalls: Array<{
    mode: 'full' | 'incremental';
    relations: ReadonlyArray<{
      userId: string;
      remark: string;
      sign: string;
      addTs: number;
      updatedAt: number;
      metadataUpdatedAt: number;
    }>;
    userInfos: ReadonlyArray<{
      userId: string;
      nickname?: string;
      avatarUrl?: string;
      sign?: string;
      ext?: string;
    }>;
    version: string;
    lastSyncTs: number;
  }>;
}

const createDependencies = (options?: {
  readonly state?: ContactSyncContextState;
  readonly metadata?: { version: string; requiresSync: boolean; checkedAt: number };
  readonly metadataError?: Error;
  readonly urls?: ReadonlyArray<string>;
  readonly sharedSyncSession?: SharedSyncWebSocketSession;
  readonly applyResult?: {
    snapshot: ContactSnapshot;
    changed: boolean;
  };
}): DependencyHarness => {
  const state = options?.state ?? createState();
  const starts: Array<undefined> = [];
  const finishes: DependencyHarness['finishes'] = [];
  const queryCalls: string[] = [];
  const buildRequestCalls: DependencyHarness['buildRequestCalls'] = [];
  const applyCalls: DependencyHarness['applyCalls'] = [];

  const deps: ContactSyncDependencies = {
    getContextState: (): ContactSyncContextState => state,
    queryMetadata: (currentVersion: string) => {
      queryCalls.push(currentVersion);
      if (options?.metadataError) {
        return Promise.reject(options.metadataError);
      }
      return Promise.resolve(
        options?.metadata ?? {
          version: 'v2',
          requiresSync: true,
          checkedAt: 1,
        }
      );
    },
    getSyncUrls: (): Promise<ReadonlyArray<string>> =>
      Promise.resolve(options?.urls ?? ['wss://sync.example.com/ws']),
    getSharedSyncSession: (): SharedSyncWebSocketSession =>
      options?.sharedSyncSession ?? createSharedSyncSession(),
    buildRosterRequest: (payload): RosterRequest => {
      buildRequestCalls.push(payload);
      return createRequest();
    },
    applySyncResult: payload => {
      applyCalls.push(payload);
      return (
        options?.applyResult ?? {
          snapshot: {
            items: [],
            source: 'sync',
            version: payload.version,
            complete: true,
          },
          changed: true,
        }
      );
    },
    onStart: () => {
      starts.push(undefined);
    },
    onFinish: payload => {
      finishes.push(payload);
    },
  };

  return {
    deps,
    starts,
    finishes,
    queryCalls,
    buildRequestCalls,
    applyCalls,
  };
};

describe('RosterSyncController', () => {
  afterEach((): void => {
    vi.restoreAllMocks();
  });

  it('metadata 判定 skip 且缓存完整时应直接返回缓存快照', async () => {
    const loggerWarnSpy = vi.spyOn(logger, 'warn').mockImplementation((): void => {});
    vi.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(1123);
    const syncSpy = vi.spyOn(RosterSyncClient.prototype, 'sync').mockResolvedValue({
      mode: 'full',
      version: 'v2',
      pages: [],
    });
    const harness = createDependencies({
      metadata: {
        version: 'v1',
        requiresSync: false,
        checkedAt: 1,
      },
    });

    const controller = new RosterSyncController(harness.deps);
    await controller.sync();

    expect(harness.starts).toHaveLength(1);
    expect(harness.finishes).toEqual([undefined]);
    expect(syncSpy).not.toHaveBeenCalled();
    expect(loggerWarnSpy).toHaveBeenCalledWith('Contact sync duration', {
      outcome: 'skip',
      decision: 'skip',
      durationMs: 123,
      version: 'v1',
      hasUsableSnapshot: true,
    });
  });

  it('metadata 失败且已有完整缓存时应派发 metadata 失败并停止', async () => {
    const loggerWarnSpy = vi.spyOn(logger, 'warn').mockImplementation((): void => {});
    vi.spyOn(Date, 'now').mockReturnValueOnce(2000).mockReturnValueOnce(2099);
    const syncSpy = vi.spyOn(RosterSyncClient.prototype, 'sync').mockResolvedValue({
      mode: 'full',
      version: 'v2',
      pages: [],
    });
    const harness = createDependencies({
      metadataError: new Error('metadata down'),
    });

    const controller = new RosterSyncController(harness.deps);
    await controller.sync();

    expect(harness.starts).toHaveLength(1);
    expect(harness.finishes).toEqual([
      {
        error: {
          code: ERROR_CODES.CONTACT_SYNC_METADATA_FAILED,
          stage: 'metadata',
          message: 'metadata: metadata down',
          retryable: true,
        },
      },
    ]);
    expect(syncSpy).not.toHaveBeenCalled();
    expect(loggerWarnSpy).toHaveBeenCalledWith('Contact sync duration', {
      outcome: 'fail',
      decision: 'incremental',
      durationMs: 99,
      version: 'v1',
      stage: 'metadata',
      hasUsableSnapshot: true,
      source: 'cache',
    });
  });

  it('同步结果未变化且已有完整缓存时仍应派发一次 sync finish', async () => {
    const loggerWarnSpy = vi.spyOn(logger, 'warn').mockImplementation((): void => {});
    vi
      .spyOn(Date, 'now')
      .mockReturnValueOnce(3000)
      .mockReturnValueOnce(3100)
      .mockReturnValueOnce(3188);
    vi.spyOn(RosterSyncClient.prototype, 'sync').mockResolvedValue({
      mode: 'incremental',
      version: 'v2',
      pages: [createRosterResponse([])],
    });
    const harness = createDependencies({
      metadata: {
        version: 'v2',
        requiresSync: true,
        checkedAt: 1,
      },
      applyResult: {
        snapshot: {
          items: [],
          source: 'sync',
          version: 'v2',
          complete: true,
        },
        changed: false,
      },
    });

    const controller = new RosterSyncController(harness.deps);
    await controller.sync();

    expect(harness.starts).toHaveLength(1);
    expect(harness.finishes).toHaveLength(1);
    expect(harness.finishes[0]).toBeUndefined();
    expect(loggerWarnSpy).toHaveBeenCalledWith('Contact sync duration', {
      outcome: 'finish',
      decision: 'incremental',
      durationMs: 188,
      version: 'v2',
      source: 'sync',
      changed: false,
      hasUsableSnapshot: true,
    });
  });

  it('metadata 失败且缓存不可用时应走 full sync 并解析 roster 数据', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(999);
    vi.spyOn(RosterSyncClient.prototype, 'sync').mockResolvedValue({
      mode: 'full',
      version: 'v3',
      pages: [
        createRosterResponse([
          {
            contact: 'u1',
            remark: 'remark-1',
            metadata: '{"nickname":"nick-1","avatarurl":"https://cdn.example.com/u1.png","sign":"sign-1"}',
            createdAt: 0,
            updatedAt: 0,
            metadataUpdatedAt: 0,
          },
          {
            contact: 'u2',
            remark: 'remark-2',
            metadata: 'invalid-json',
            createdAt: 0,
            updatedAt: 0,
            metadataUpdatedAt: 0,
          },
        ]),
      ],
    });
    const state = createState({
      cacheMeta: {
        cacheIntegrity: 'incomplete',
        reason: 'first_sync_pending',
        lastSyncTs: 0,
        lastSuccessfulVersion: '',
        lastSyncMode: 'skipped',
      },
      versionState: {
        version: '',
        lastVersionCheckAt: 0,
        lastVersionSource: 'metadata',
      },
      cachedSnapshot: createSnapshot(false, ''),
    });
    const harness = createDependencies({
      state,
      metadataError: new Error('network error'),
      applyResult: {
        snapshot: {
          items: [
            {
              userId: 'u1',
              userInfo: {
                userId: 'u1',
                nickname: 'nick-1',
                avatarUrl: 'https://cdn.example.com/u1.png',
                sign: 'sign-1',
              },
              remark: 'remark-1',
              addTs: 0,
            },
          ],
          source: 'sync',
          version: 'v3',
          complete: true,
        },
        changed: true,
      },
    });

    const controller = new RosterSyncController(harness.deps);
    await controller.sync();

    expect(harness.starts).toHaveLength(1);
    expect(harness.buildRequestCalls).toEqual([
      {
        decision: 'full',
        version: '',
      },
    ]);
    expect(harness.applyCalls).toEqual([
      {
        mode: 'full',
        relations: [
          {
            userId: 'u1',
            remark: 'remark-1',
            sign: 'sign-1',
            addTs: 0,
            updatedAt: 0,
            metadataUpdatedAt: 0,
          },
          {
            userId: 'u2',
            remark: 'remark-2',
            sign: '',
            addTs: 0,
            updatedAt: 0,
            metadataUpdatedAt: 0,
          },
        ],
        userInfos: [
          {
            userId: 'u1',
            nickname: 'nick-1',
            avatarUrl: 'https://cdn.example.com/u1.png',
            sign: 'sign-1',
            ext: undefined,
          },
          {
            userId: 'u2',
            nickname: undefined,
            avatarUrl: undefined,
            sign: undefined,
            ext: undefined,
          },
        ],
        version: 'v3',
        lastSyncTs: 999,
      },
    ]);
    expect(harness.finishes).toEqual([
      undefined,
    ]);
  });

  it('sync 抛出普通错误时应包装为 sync_page 失败', async () => {
    vi.spyOn(RosterSyncClient.prototype, 'sync').mockRejectedValue(new Error('socket boom'));
    const state = createState({
      cacheMeta: {
        cacheIntegrity: 'incomplete',
        reason: 'manual_reset',
        lastSyncTs: 0,
        lastSuccessfulVersion: '',
        lastSyncMode: 'skipped',
      },
      cachedSnapshot: createSnapshot(false),
    });
    const harness = createDependencies({
      state,
      metadata: {
        version: 'v2',
        requiresSync: true,
        checkedAt: 1,
      },
    });

    const controller = new RosterSyncController(harness.deps);
    await controller.sync();

    expect(harness.finishes).toEqual([
      {
        error: {
          code: ERROR_CODES.CONTACT_SYNC_SOCKET_FAILED,
          stage: 'sync_page',
          message: 'sync_page: Contact sync failed',
          retryable: true,
        },
      },
    ]);
  });

  it('sync 抛出 SDKError 时应保留原始 stage 与错误码', async () => {
    vi.spyOn(RosterSyncClient.prototype, 'sync').mockRejectedValue(
      new SDKError('decode broken', ERROR_CODES.CONTACT_SYNC_PROTO_DECODE_FAILED, {
        details: {
          stage: 'decode',
        },
      })
    );
    const harness = createDependencies({
      metadata: {
        version: 'v2',
        requiresSync: true,
        checkedAt: 1,
      },
    });

    const controller = new RosterSyncController(harness.deps);
    await controller.sync();

    expect(harness.finishes).toEqual([
      {
        error: {
          code: ERROR_CODES.CONTACT_SYNC_PROTO_DECODE_FAILED,
          stage: 'decode',
          message: 'decode: decode broken',
          retryable: true,
        },
      },
    ]);
  });

  it('并发调用 sync 时应复用同一个运行中的 Promise', async () => {
    const deferred = createDeferred<{
      mode: 'full' | 'incremental';
      version: string;
      pages: ReadonlyArray<RosterResponse>;
    }>();
    const syncSpy = vi.spyOn(RosterSyncClient.prototype, 'sync').mockReturnValue(deferred.promise);
    const harness = createDependencies({
      state: createState({
        cachedSnapshot: createSnapshot(false),
        cacheMeta: {
          cacheIntegrity: 'incomplete',
          reason: 'first_sync_pending',
          lastSyncTs: 0,
          lastSuccessfulVersion: '',
          lastSyncMode: 'skipped',
        },
      }),
    });

    const controller = new RosterSyncController(harness.deps);
    const first = controller.sync();
    const second = controller.sync();

    await Promise.resolve();
    await Promise.resolve();
    expect(harness.queryCalls).toEqual(['v1']);
    expect(syncSpy).toHaveBeenCalledOnce();

    deferred.resolve({
      mode: 'full',
      version: 'v2',
      pages: [createRosterResponse([])],
    });

    await Promise.all([first, second]);
  });

  it('cancel 应转发到内部 client', () => {
    const sharedSyncSession = createSharedSyncSession();
    const cancelSpy = vi.spyOn(sharedSyncSession, 'cancel').mockImplementation((): void => {});
    const harness = createDependencies({ sharedSyncSession });

    const controller = new RosterSyncController(harness.deps);
    controller.cancel();

    expect(cancelSpy).toHaveBeenCalledOnce();
  });
});
