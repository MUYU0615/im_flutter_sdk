import { describe, expect, it } from 'vitest';

import { decideContactSync } from '@/core/contact-sync/roster-sync-controller';
import type { ContactSyncContextState } from '@/core/contact-sync/roster-sync-types';

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
    cachedSnapshot: {
      items: [],
      source: 'cache',
      version: 'v1',
      complete: true,
    },
    ...overrides,
  };
};

describe('decideContactSync', () => {
  it('metadata 判定无需同步且缓存完整时应 skip', () => {
    const result = decideContactSync({
      metadata: {
        version: 'v1',
        requiresSync: false,
      },
      state: createState(),
    });

    expect(result).toEqual({
      decision: 'skip',
      version: 'v1',
    });
  });

  it('metadata 判定需要同步且存在完整基线时应 incremental', () => {
    const result = decideContactSync({
      metadata: {
        version: 'v2',
        requiresSync: true,
      },
      state: createState(),
    });

    expect(result).toEqual({
      decision: 'incremental',
      version: 'v2',
    });
  });

  it('metadata 判定需要同步且 lastSyncTs 缺失时仍应按 version 基线走 incremental', () => {
    const result = decideContactSync({
      metadata: {
        version: 'v2',
        requiresSync: true,
      },
      state: createState({
        cacheMeta: {
          cacheIntegrity: 'complete',
          lastSyncTs: 0,
          lastSuccessfulVersion: 'v1',
          lastSyncMode: 'incremental',
        },
      }),
    });

    expect(result).toEqual({
      decision: 'incremental',
      version: 'v2',
    });
  });

  it('缓存不完整时即使 metadata 判定无需同步也应 full', () => {
    const result = decideContactSync({
      metadata: {
        version: 'v1',
        requiresSync: false,
      },
      state: createState({
        cacheMeta: {
          cacheIntegrity: 'incomplete',
          reason: 'user_info_missing',
          lastSyncTs: 100,
          lastSuccessfulVersion: 'v1',
          lastSyncMode: 'incremental',
        },
      }),
    });

    expect(result.decision).toBe('full');
  });

  it('metadata 失败且存在完整缓存时应按已有基线回退到 incremental', () => {
    const result = decideContactSync({
      metadataFailed: true,
      state: createState(),
    });

    expect(result).toEqual({
      decision: 'incremental',
      version: 'v1',
    });
  });

  it('metadata 失败且没有可用基线时应 full', () => {
    const result = decideContactSync({
      metadataFailed: true,
      state: createState({
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
      }),
    });

    expect(result).toEqual({
      decision: 'full',
      version: '',
    });
  });
});
