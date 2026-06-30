import { useEffect, useState } from 'react';
import type { ConversationSummary, GroupNamecardCacheRecord, UserInfoSummary } from 'im-sdk-web';
import type {
  CacheDebugInspectResult,
  CacheDebugMutationResult,
  CacheDebugTools,
  CacheEncryptionModeOption,
  CacheSeedOptions,
  DemoClient,
  LogType,
} from '../types';

const CACHE_KEY_PREFIX = 'IMSDK';
const CACHE_SCHEMA_VERSION = 1;
const DAY_MS = 24 * 60 * 60 * 1000;
const SDK_FLUSH_WAIT_MS = 1200;
const DEFAULT_RESERVE_KB = 24;
const DEFAULT_APPEND_COUNT = 3;
const DEFAULT_BLOB_SIZE = 4200;
const DEFAULT_CONVERSATION_COUNT = 8;
const DEFAULT_EXPIRED_COUNT = 40;
const DEFAULT_MAX_USERS = 1000;
const EMPTY_DUMP_PAYLOAD = '{"items":[]}';
const MAX_CAPACITY_ENTRIES = 131072;

type NormalCapacityKind = 'userInfo' | 'conversation' | 'groupNamecard' | 'contact';

interface BuildUserOptions {
  readonly expired: boolean;
  readonly lastAccess?: number;
  readonly lastUpdate?: number;
}

interface CacheStorageKeys {
  readonly conversationKey: string;
  readonly userInfoKey: string;
  readonly groupNamecardKey: string;
  readonly contactRelationKey: string;
  readonly contactVersionKey: string;
  readonly contactMetaKey: string;
  readonly metadataKey: string;
}

interface SerializedStorageEntry {
  readonly key: string;
  readonly value: string;
}

interface ContactRelationDebugRecord {
  readonly userId: string;
  readonly remark: string;
  readonly sign: string;
  readonly addTs: number;
  readonly updatedAt: number;
  readonly metadataUpdatedAt: number;
}

export interface CacheDebugPanelProps {
  readonly client: DemoClient | null;
  readonly appKey: string;
  readonly currentUserId: string | null;
  readonly cacheEncryptionMode: CacheEncryptionModeOption;
  readonly onAddLog: (type: LogType, message: string) => void;
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const safeJsonParse = <T,>(raw: string | null, fallback: T): T => {
  if (!raw) {
    return fallback;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const buildStorageKey = (appKey: string, userId: string, name: string): string => {
  return `${CACHE_KEY_PREFIX}_${appKey}_${userId}_${name}_v${CACHE_SCHEMA_VERSION}`;
};

const buildStorageKeys = (appKey: string, userId: string): CacheStorageKeys => {
  return {
    conversationKey: buildStorageKey(appKey, userId, 'conversationMap'),
    userInfoKey: buildStorageKey(appKey, userId, 'userInfoMap'),
    groupNamecardKey: buildStorageKey(appKey, userId, 'groupNamecardMap'),
    contactRelationKey: buildStorageKey(appKey, userId, 'contactRelationMap'),
    contactVersionKey: buildStorageKey(appKey, userId, 'contactVersion'),
    contactMetaKey: buildStorageKey(appKey, userId, 'contactMeta'),
    metadataKey: buildStorageKey(appKey, userId, 'metadata'),
  };
};

const readDump = <T,>(key: string): ReadonlyArray<T> => {
  const parsed = safeJsonParse<unknown>(localStorage.getItem(key), { items: [] });
  if (!isRecord(parsed) || !Array.isArray(parsed.items)) {
    return [];
  }
  return parsed.items as ReadonlyArray<T>;
};

const getRemainingChars = (): number => {
  const probeKey = `${CACHE_KEY_PREFIX}__quota_probe__`;
  let low = 0;
  let high = 256 * 1024;

  const canWrite = (size: number): boolean => {
    try {
      localStorage.setItem(probeKey, 'x'.repeat(size));
      return true;
    } catch {
      return false;
    }
  };

  while (canWrite(high) && high < 16 * 1024 * 1024) {
    low = high;
    high *= 2;
  }

  while (high - low > 1024) {
    const mid = Math.floor((low + high) / 2);
    if (canWrite(mid)) {
      low = mid;
    } else {
      high = mid;
    }
  }

  localStorage.removeItem(probeKey);
  return low;
};

const toKB = (value: string | null): number => {
  return Math.round(((value ?? '').length / 1024) * 10) / 10;
};

const buildConversation = (index: number, now: number): ConversationSummary => {
  return {
    conversationId: `quota-conv-${String(index).padStart(3, '0')}`,
    type: 'singleChat',
    unreadCount: 0,
    marks: [],
    lastAccess: now - index * 1000,
    lastUpdate: now - index * 1000,
    lastMessage: {
      msgId: `quota-msg-${index}`,
      type: 'text',
      body: {
        text: `seed-${index}`,
      },
      timestamp: now - index * 1000,
    },
  };
};

const buildUser = (
  index: number,
  now: number,
  blobSize: number,
  options: BuildUserOptions
): UserInfoSummary => {
  const filler = `${String(index).padStart(4, '0')}-${'x'.repeat(blobSize)}`;
  const fallbackTimestamp = options.expired ? now - DAY_MS * 3 - index : now - index * 1000;
  const lastAccess = options.lastAccess ?? fallbackTimestamp;
  const lastUpdate = options.lastUpdate ?? fallbackTimestamp;
  return {
    userId: `quota-user-${String(index).padStart(4, '0')}`,
    nickname: `nick-${filler}`,
    avatarUrl: `https://cdn.local/avatar/${index}?v=${filler}`,
    lastAccess,
    lastUpdate,
  };
};

const buildNormalUser = (index: number, now: number): UserInfoSummary => {
  return {
    userId: `normal-user-${String(index).padStart(6, '0')}`,
    nickname: `用户${index}`,
    avatarUrl: `https://static.example.com/avatar/${index}.png`,
    sign: `普通签名-${index % 30}`,
    ext: `{"region":"cn","tier":"normal","slot":${index % 10}}`,
    userInfoUpdateTime: 1_710_000_000 + index,
    lastSyncAt: now - (index % 60) * 1000,
    lastAccess: now - (index % 120) * 1000,
    lastUpdate: now - (index % 300) * 1000,
  };
};

const buildNormalConversation = (index: number, now: number): ConversationSummary => {
  const types: ReadonlyArray<ConversationSummary['type']> = ['singleChat', 'groupChat', 'chatRoom'];
  return {
    conversationId: `normal-conv-${String(index).padStart(6, '0')}`,
    type: types[index % types.length] ?? 'singleChat',
    unreadCount: index % 12,
    marks: [],
    lastAccess: now - (index % 90) * 1000,
    lastUpdate: now - (index % 180) * 1000,
    lastMessage: {
      msgId: `normal-msg-${index}`,
      type: 'text',
      body: {
        text: `这是一条普通长度的缓存消息 ${index}`,
      },
      timestamp: now - (index % 180) * 1000,
      userInfoUpdateTime: 1_710_000_000 + index,
      namecardUpdateTime: 1_710_100_000 + index,
    },
  };
};

const buildNormalGroupNamecard = (index: number, now: number): GroupNamecardCacheRecord => {
  return {
    groupId: `normal-group-${String(Math.floor(index / 50)).padStart(4, '0')}`,
    userId: `normal-member-${String(index).padStart(6, '0')}`,
    namecard: `群名片${index}`,
    namecardUpdateTime: 1_710_200_000 + index,
    lastSyncAt: now - (index % 60) * 1000,
    lastAccess: now - (index % 180) * 1000,
    lastUpdate: now - (index % 240) * 1000,
  };
};

const buildNormalContactRelation = (index: number, now: number): ContactRelationDebugRecord => {
  return {
    userId: `normal-contact-${String(index).padStart(6, '0')}`,
    remark: `联系人备注${index}`,
    sign: `联系人签名-${index % 20}`,
    addTs: now - index * 1000,
    updatedAt: now - (index % 120) * 1000,
    metadataUpdatedAt: now - (index % 240) * 1000,
  };
};

const buildNormalContactUser = (index: number, now: number): UserInfoSummary => {
  return {
    userId: `normal-contact-${String(index).padStart(6, '0')}`,
    nickname: `联系人${index}`,
    avatarUrl: `https://static.example.com/contact/${index}.png`,
    sign: `联系人签名-${index % 20}`,
    ext: `{"source":"contact","bucket":${index % 16}}`,
    userInfoUpdateTime: 1_710_300_000 + index,
    lastSyncAt: now - (index % 60) * 1000,
    lastAccess: now - (index % 120) * 1000,
    lastUpdate: now - (index % 300) * 1000,
  };
};

const waitForFlush = async (): Promise<void> => {
  await new Promise<void>(resolve => {
    window.setTimeout(() => {
      resolve();
    }, SDK_FLUSH_WAIT_MS);
  });
};

const resolvePositiveInt = (value: string, fallback: number, min: number): number => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < min) {
    return fallback;
  }
  return parsed;
};

const resolveNextUserIndex = (items: ReadonlyArray<UserInfoSummary>): number => {
  let maxIndex = -1;
  for (const item of items) {
    const match = /^quota-user-(\d+)$/.exec(item.userId);
    if (!match) {
      continue;
    }
    const suffix = match[1];
    if (!suffix) {
      continue;
    }
    const parsed = Number.parseInt(suffix, 10);
    if (Number.isFinite(parsed) && parsed > maxIndex) {
      maxIndex = parsed;
    }
  }
  return maxIndex + 1;
};

const serializeDump = <T,>(items: ReadonlyArray<T>): string => {
  return JSON.stringify({ items });
};

const buildMetadataPayload = (now: number): string => {
  return JSON.stringify({
    schemaVersion: CACHE_SCHEMA_VERSION,
    lastFlush: now,
  });
};

const buildContactVersionPayload = (now: number): string => {
  return JSON.stringify({
    version: `debug-version-${now}`,
    lastVersionCheckAt: now,
    lastVersionSource: 'sync_page',
  });
};

const buildContactMetaPayload = (now: number): string => {
  return JSON.stringify({
    cacheIntegrity: 'complete',
    lastSyncTs: now,
    lastSuccessfulVersion: `debug-version-${now}`,
    lastSyncMode: 'full',
  });
};

const clearCurrentSdkKeys = (keys: CacheStorageKeys): void => {
  localStorage.removeItem(keys.conversationKey);
  localStorage.removeItem(keys.userInfoKey);
  localStorage.removeItem(keys.groupNamecardKey);
  localStorage.removeItem(keys.contactRelationKey);
  localStorage.removeItem(keys.contactVersionKey);
  localStorage.removeItem(keys.contactMetaKey);
  localStorage.removeItem(keys.metadataKey);
};

const writeEntries = (entries: ReadonlyArray<SerializedStorageEntry>): void => {
  for (const entry of entries) {
    localStorage.setItem(entry.key, entry.value);
  }
};

const getCapacityAction = (kind: NormalCapacityKind): CacheDebugMutationResult['action'] => {
  switch (kind) {
    case 'userInfo':
      return 'measureNormalUserInfoCapacity';
    case 'conversation':
      return 'measureNormalConversationCapacity';
    case 'groupNamecard':
      return 'measureNormalGroupNamecardCapacity';
    case 'contact':
      return 'measureNormalContactCapacity';
  }
};

const getCapacityTitle = (kind: NormalCapacityKind, count: number): string => {
  if (count <= 0) {
    switch (kind) {
      case 'userInfo':
        return '普通用户资料容量测量完成，当前剩余空间不足以写入 1 条';
      case 'conversation':
        return '普通会话容量测量完成，当前剩余空间不足以写入 1 条';
      case 'groupNamecard':
        return '普通群名片容量测量完成，当前剩余空间不足以写入 1 条';
      case 'contact':
        return '普通联系人容量测量完成，当前剩余空间不足以写入 1 条';
    }
  }
  switch (kind) {
    case 'userInfo':
      return '普通用户资料容量测量完成';
    case 'conversation':
      return '普通会话容量测量完成';
    case 'groupNamecard':
      return '普通群名片容量测量完成';
    case 'contact':
      return '普通联系人容量测量完成';
  }
};

export const CacheDebugPanel = (props: CacheDebugPanelProps): JSX.Element => {
  const { client, appKey, currentUserId, cacheEncryptionMode, onAddLog } = props;
  const [reserveKBInput, setReserveKBInput] = useState<string>(String(DEFAULT_RESERVE_KB));
  const [appendCountInput, setAppendCountInput] = useState<string>(String(DEFAULT_APPEND_COUNT));
  const [blobSizeInput, setBlobSizeInput] = useState<string>(String(DEFAULT_BLOB_SIZE));
  const [lastResult, setLastResult] = useState<string>('');

  const buildContext = (): { appKey: string; userId: string; keys: CacheStorageKeys } => {
    const trimmedAppKey = appKey.trim();
    const trimmedUserId = currentUserId?.trim() ?? '';
    if (!trimmedAppKey) {
      throw new Error('请先完成 SDK 初始化，确保 AppKey 已就绪');
    }
    if (!trimmedUserId) {
      throw new Error('请先登录目标用户，再执行缓存超限调试');
    }
    return {
      appKey: trimmedAppKey,
      userId: trimmedUserId,
      keys: buildStorageKeys(trimmedAppKey, trimmedUserId),
    };
  };

  const getInspectResult = (): CacheDebugInspectResult => {
    const context = buildContext();
    const conversationRaw = localStorage.getItem(context.keys.conversationKey);
    const userInfoRaw = localStorage.getItem(context.keys.userInfoKey);
    const groupNamecardRaw = localStorage.getItem(context.keys.groupNamecardKey);
    const contactRelationRaw = localStorage.getItem(context.keys.contactRelationKey);
    const contactVersionRaw = localStorage.getItem(context.keys.contactVersionKey);
    const contactMetaRaw = localStorage.getItem(context.keys.contactMetaKey);
    const metadataRaw = localStorage.getItem(context.keys.metadataKey);
    const cacheManager = client?.getCacheManager() ?? null;
    const conversationKB = toKB(conversationRaw);
    const userInfoKB = toKB(userInfoRaw);
    const groupNamecardKB = toKB(groupNamecardRaw);
    const contactRelationKB = toKB(contactRelationRaw);
    const contactVersionKB = toKB(contactVersionRaw);
    const contactMetaKB = toKB(contactMetaRaw);
    const metadataKB = toKB(metadataRaw);

    return {
      appKey: context.appKey,
      userId: context.userId,
      conversationKey: context.keys.conversationKey,
      userInfoKey: context.keys.userInfoKey,
      groupNamecardKey: context.keys.groupNamecardKey,
      contactRelationKey: context.keys.contactRelationKey,
      contactVersionKey: context.keys.contactVersionKey,
      contactMetaKey: context.keys.contactMetaKey,
      metadataKey: context.keys.metadataKey,
      conversationCount: readDump<ConversationSummary>(context.keys.conversationKey).length,
      userInfoCount: readDump<UserInfoSummary>(context.keys.userInfoKey).length,
      groupNamecardCount: readDump<GroupNamecardCacheRecord>(context.keys.groupNamecardKey).length,
      contactRelationCount: readDump<ContactRelationDebugRecord>(context.keys.contactRelationKey)
        .length,
      conversationKB,
      userInfoKB,
      groupNamecardKB,
      contactRelationKB,
      contactVersionKB,
      contactMetaKB,
      metadataKB,
      totalKB:
        Math.round(
          (conversationKB +
            userInfoKB +
            groupNamecardKB +
            contactRelationKB +
            contactVersionKB +
            contactMetaKB +
            metadataKB) *
            10
        ) / 10,
      approxRemainingKB: Math.round((getRemainingChars() / 1024) * 10) / 10,
      inMemoryConversationCount: cacheManager
        ? cacheManager.loadConversationSummaries().length
        : null,
      inMemoryUserInfoCount: cacheManager ? cacheManager.loadUserInfoSummaries().length : null,
      inMemoryGroupNamecardCount: cacheManager ? cacheManager.loadGroupNamecards().length : null,
      inMemoryContactRelationCount: cacheManager
        ? cacheManager.loadContactRelationRecords().length
        : null,
    };
  };

  const formatResult = (
    title: string,
    result: CacheDebugInspectResult | CacheDebugMutationResult
  ): string => {
    return JSON.stringify(
      {
        title,
        time: new Date().toLocaleTimeString(),
        result,
      },
      null,
      2
    );
  };

  const logResult = (
    title: string,
    result: CacheDebugInspectResult | CacheDebugMutationResult,
    type: LogType
  ): void => {
    setLastResult(formatResult(title, result));
    onAddLog(
      type,
      `${title}，会话=${result.conversationCount}，用户=${result.userInfoCount}，群名片=${result.groupNamecardCount}，联系人=${result.contactRelationCount}，总占用约 ${result.totalKB} KB，剩余约 ${result.approxRemainingKB} KB`
    );
  };

  const readCurrentUserDump = (): ReadonlyArray<UserInfoSummary> => {
    const context = buildContext();
    return readDump<UserInfoSummary>(context.keys.userInfoKey);
  };

  const readCurrentConversationDump = (): ReadonlyArray<ConversationSummary> => {
    const context = buildContext();
    return readDump<ConversationSummary>(context.keys.conversationKey);
  };

  const buildNormalCapacityEntries = (
    kind: NormalCapacityKind,
    count: number,
    keys: CacheStorageKeys,
    now: number
  ): ReadonlyArray<SerializedStorageEntry> => {
    const metadataEntry: SerializedStorageEntry = {
      key: keys.metadataKey,
      value: buildMetadataPayload(now),
    };
    switch (kind) {
      case 'userInfo':
        return [
          {
            key: keys.userInfoKey,
            value: serializeDump(
              Array.from(
                { length: count },
                (_, index): UserInfoSummary => buildNormalUser(index, now)
              )
            ),
          },
          metadataEntry,
        ];
      case 'conversation':
        return [
          {
            key: keys.conversationKey,
            value: serializeDump(
              Array.from(
                { length: count },
                (_, index): ConversationSummary => buildNormalConversation(index, now)
              )
            ),
          },
          metadataEntry,
        ];
      case 'groupNamecard':
        return [
          {
            key: keys.groupNamecardKey,
            value: serializeDump(
              Array.from(
                { length: count },
                (_, index): GroupNamecardCacheRecord => buildNormalGroupNamecard(index, now)
              )
            ),
          },
          metadataEntry,
        ];
      case 'contact':
        return [
          {
            key: keys.contactRelationKey,
            value: serializeDump(
              Array.from(
                { length: count },
                (_, index): ContactRelationDebugRecord => buildNormalContactRelation(index, now)
              )
            ),
          },
          {
            key: keys.userInfoKey,
            value: serializeDump(
              Array.from(
                { length: count },
                (_, index): UserInfoSummary => buildNormalContactUser(index, now)
              )
            ),
          },
          {
            key: keys.contactVersionKey,
            value: buildContactVersionPayload(now),
          },
          {
            key: keys.contactMetaKey,
            value: buildContactMetaPayload(now),
          },
          metadataEntry,
        ];
    }
  };

  const tryWriteCapacityScenario = (
    kind: NormalCapacityKind,
    count: number,
    keys: CacheStorageKeys,
    reserveKB: number
  ): boolean => {
    clearCurrentSdkKeys(keys);
    try {
      const now = Date.now();
      writeEntries(buildNormalCapacityEntries(kind, count, keys, now));
      return getRemainingChars() >= reserveKB * 1024;
    } catch {
      clearCurrentSdkKeys(keys);
      return false;
    }
  };

  const measureNormalCapacity = (
    kind: NormalCapacityKind,
    reserveKB = DEFAULT_RESERVE_KB
  ): CacheDebugMutationResult => {
    const context = buildContext();
    const normalizedReserveKB = Math.max(reserveKB, 0);
    const action = getCapacityAction(kind);

    try {
      let low = 0;
      let high = 1;

      while (
        high < MAX_CAPACITY_ENTRIES &&
        tryWriteCapacityScenario(kind, high, context.keys, normalizedReserveKB)
      ) {
        low = high;
        high *= 2;
      }

      if (high > MAX_CAPACITY_ENTRIES) {
        high = MAX_CAPACITY_ENTRIES;
      }

      while (low < high) {
        const mid = Math.ceil((low + high) / 2);
        if (tryWriteCapacityScenario(kind, mid, context.keys, normalizedReserveKB)) {
          low = mid;
        } else {
          high = mid - 1;
        }
      }

      clearCurrentSdkKeys(context.keys);
      const measuredCount = low;
      if (measuredCount > 0) {
        writeEntries(buildNormalCapacityEntries(kind, measuredCount, context.keys, Date.now()));
      }

      const inspect = getInspectResult();
      const result: CacheDebugMutationResult = {
        ...inspect,
        ok: true,
        action,
        reserveKB: normalizedReserveKB,
        measuredKind: kind,
        measuredCount,
        payloadKB: inspect.totalKB,
      };
      logResult(
        getCapacityTitle(kind, measuredCount),
        result,
        measuredCount > 0 ? 'success' : 'warn'
      );
      return result;
    } catch (error) {
      clearCurrentSdkKeys(context.keys);
      const inspect = getInspectResult();
      const result: CacheDebugMutationResult = {
        ...inspect,
        ok: false,
        action,
        reserveKB: normalizedReserveKB,
        measuredKind: kind,
        errorName: error instanceof Error ? error.name : 'UnknownError',
        errorMessage: error instanceof Error ? error.message : 'unknown error',
      };
      logResult('普通容量测量失败', result, 'error');
      return result;
    }
  };

  const seedNearQuota = (options?: CacheSeedOptions): CacheDebugMutationResult => {
    const context = buildContext();
    const reserveKB = options?.reserveKB ?? DEFAULT_RESERVE_KB;
    const expiredCount = options?.expiredCount ?? DEFAULT_EXPIRED_COUNT;
    const maxUsers = options?.maxUsers ?? DEFAULT_MAX_USERS;
    const blobSize = options?.blobSize ?? DEFAULT_BLOB_SIZE;
    const conversationCount = options?.conversationCount ?? DEFAULT_CONVERSATION_COUNT;

    try {
      const reserveChars = reserveKB * 1024;
      const remainingChars = getRemainingChars();
      const now = Date.now();
      const currentRaw = localStorage.getItem(context.keys.userInfoKey) ?? EMPTY_DUMP_PAYLOAD;
      const targetLength = currentRaw.length + Math.max(remainingChars - reserveChars, 0);
      const items: UserInfoSummary[] = [];
      let payload = EMPTY_DUMP_PAYLOAD;

      for (let index = 0; index < maxUsers; index += 1) {
        items.push(buildUser(index, now, blobSize, { expired: index < expiredCount }));
        const nextPayload = JSON.stringify({ items });
        if (nextPayload.length >= targetLength) {
          break;
        }
        payload = nextPayload;
      }

      const conversations = Array.from(
        { length: conversationCount },
        (_, index): ConversationSummary => buildConversation(index, now)
      );

      localStorage.setItem(context.keys.userInfoKey, payload);
      localStorage.setItem(context.keys.conversationKey, JSON.stringify({ items: conversations }));
      localStorage.setItem(context.keys.metadataKey, buildMetadataPayload(now));

      const result: CacheDebugMutationResult = {
        ...getInspectResult(),
        ok: true,
        action: 'seedNearQuota',
        seededUsers: readDump<UserInfoSummary>(context.keys.userInfoKey).length,
        seededConversations: conversations.length,
        reserveKB,
      };

      logResult('已预填到 localStorage 临界值附近，建议刷新页面后再登录验证', result, 'success');
      return result;
    } catch (error) {
      const inspect = getInspectResult();
      const result: CacheDebugMutationResult = {
        ...inspect,
        ok: false,
        action: 'seedNearQuota',
        reserveKB,
        errorName: error instanceof Error ? error.name : 'UnknownError',
        errorMessage: error instanceof Error ? error.message : 'unknown error',
      };
      logResult('预填缓存失败', result, 'error');
      return result;
    }
  };

  const appendUsers = (
    count = DEFAULT_APPEND_COUNT,
    blobSize = DEFAULT_BLOB_SIZE
  ): CacheDebugMutationResult => {
    const context = buildContext();
    const now = Date.now();
    const currentItems = readDump<UserInfoSummary>(context.keys.userInfoKey);
    const nextItems = [...currentItems];
    const startIndex = resolveNextUserIndex(currentItems);

    try {
      for (let index = 0; index < count; index += 1) {
        const latestTimestamp = now + index;
        nextItems.push(
          buildUser(startIndex + index, now, blobSize, {
            expired: false,
            lastAccess: latestTimestamp,
            lastUpdate: latestTimestamp,
          })
        );
      }
      localStorage.setItem(context.keys.userInfoKey, JSON.stringify({ items: nextItems }));
      const result: CacheDebugMutationResult = {
        ...getInspectResult(),
        ok: true,
        action: 'appendUsers',
        appended: count,
        totalUsers: nextItems.length,
      };
      logResult('已直接向 localStorage 追加用户缓存', result, 'success');
      return result;
    } catch (error) {
      const result: CacheDebugMutationResult = {
        ...getInspectResult(),
        ok: false,
        action: 'appendUsers',
        appended: count,
        totalUsers: nextItems.length,
        errorName: error instanceof Error ? error.name : 'UnknownError',
        errorMessage: error instanceof Error ? error.message : 'unknown error',
      };
      logResult('直接写入 localStorage 时触发超限', result, 'warn');
      return result;
    }
  };

  const appendUsersViaSdk = async (
    count = DEFAULT_APPEND_COUNT,
    blobSize = DEFAULT_BLOB_SIZE
  ): Promise<CacheDebugMutationResult> => {
    buildContext();
    const cacheManager = client?.getCacheManager();
    if (!cacheManager) {
      throw new Error('当前用户还没有可用的 CacheManager，请先登录成功');
    }

    const before = getInspectResult();
    const items = readCurrentUserDump();
    const startIndex = resolveNextUserIndex(items);
    const now = Date.now();
    const nextUsers: UserInfoSummary[] = [];

    for (let index = 0; index < count; index += 1) {
      const latestTimestamp = now + index;
      nextUsers.push(
        buildUser(startIndex + index, now, blobSize, {
          expired: false,
          lastAccess: latestTimestamp,
          lastUpdate: latestTimestamp,
        })
      );
    }

    cacheManager.setUserInfoSummaries(nextUsers);
    await waitForFlush();

    const after = getInspectResult();
    const expectedTotal = before.userInfoCount + count;
    const quotaLikelyTriggered = after.userInfoCount < expectedTotal;
    const result: CacheDebugMutationResult = {
      ...after,
      ok: true,
      action: 'appendUsersViaSdk',
      appended: count,
      totalUsers: after.userInfoCount,
      quotaLikelyTriggered,
    };
    const title = quotaLikelyTriggered
      ? 'SDK 追加用户缓存后疑似触发 QuotaExceededError 并完成清理重试'
      : 'SDK 追加用户缓存完成，暂未观察到清理迹象';
    logResult(title, result, quotaLikelyTriggered ? 'warn' : 'success');
    return result;
  };

  const clearCurrentKeys = (): CacheDebugMutationResult => {
    const context = buildContext();
    clearCurrentSdkKeys(context.keys);
    const result: CacheDebugMutationResult = {
      ...getInspectResult(),
      ok: true,
      action: 'clearCurrentKeys',
    };
    logResult('已清理当前用户缓存 key，建议刷新页面避免内存态重新落盘', result, 'warn');
    return result;
  };

  const buildTools = (): CacheDebugTools => {
    return {
      inspect: getInspectResult,
      seedNearQuota,
      appendUsers,
      appendUsersViaSdk,
      measureNormalCapacity,
      clearCurrentKeys,
      reload: (): void => {
        window.location.reload();
      },
      readCurrentUserDump,
      readCurrentConversationDump,
    };
  };

  useEffect((): (() => void) => {
    window.__demoClient = client;
    window.__cacheQuota = buildTools();
    return (): void => {
      window.__demoClient = null;
      window.__cacheQuota = null;
    };
  }, [appKey, cacheEncryptionMode, client, currentUserId, onAddLog]);

  const handleInspectClick = (): void => {
    try {
      const result = getInspectResult();
      logResult('当前缓存概览', result, 'info');
    } catch (error) {
      onAddLog('warn', error instanceof Error ? error.message : '缓存概览读取失败');
    }
  };

  const handleSeedClick = (): void => {
    try {
      seedNearQuota({
        reserveKB: resolvePositiveInt(reserveKBInput, DEFAULT_RESERVE_KB, 1),
        blobSize: resolvePositiveInt(blobSizeInput, DEFAULT_BLOB_SIZE, 128),
      });
    } catch (error) {
      onAddLog('error', error instanceof Error ? error.message : '预填缓存失败');
    }
  };

  const handleMeasureClick = (kind: NormalCapacityKind): void => {
    try {
      measureNormalCapacity(kind, resolvePositiveInt(reserveKBInput, DEFAULT_RESERVE_KB, 0));
    } catch (error) {
      onAddLog('error', error instanceof Error ? error.message : '普通容量测量失败');
    }
  };

  const handleAppendLocalClick = (): void => {
    try {
      appendUsers(
        resolvePositiveInt(appendCountInput, DEFAULT_APPEND_COUNT, 1),
        resolvePositiveInt(blobSizeInput, DEFAULT_BLOB_SIZE, 128)
      );
    } catch (error) {
      onAddLog('error', error instanceof Error ? error.message : '直接追加缓存失败');
    }
  };

  const handleAppendSdkClick = async (): Promise<void> => {
    try {
      await appendUsersViaSdk(
        resolvePositiveInt(appendCountInput, DEFAULT_APPEND_COUNT, 1),
        resolvePositiveInt(blobSizeInput, DEFAULT_BLOB_SIZE, 128)
      );
    } catch (error) {
      onAddLog('error', error instanceof Error ? error.message : 'SDK 追加缓存失败');
    }
  };

  const handleClearClick = (): void => {
    try {
      clearCurrentKeys();
    } catch (error) {
      onAddLog('error', error instanceof Error ? error.message : '清理缓存失败');
    }
  };

  const isReady = appKey.trim().length > 0 && (currentUserId?.trim().length ?? 0) > 0;

  return (
    <div className="card">
      <div className="card-title">缓存调试</div>
      <div className="cache-debug-summary">
        <p>AppKey: {appKey || '-'}</p>
        <p>当前用户: {currentUserId ?? '-'}</p>
        <p>缓存模式: {cacheEncryptionMode}</p>
        <p>window 钩子: `window.__demoClient` / `window.__cacheQuota`</p>
      </div>
      <p className="cache-debug-warning">
        SDK 初始化固定使用自动缓存加密。支持 Web Crypto 时本地缓存会加密写入。
      </p>
      {!isReady ? (
        <p className="cache-debug-warning">请先初始化并登录目标用户，再执行缓存超限调试。</p>
      ) : null}
      <div className="form-group">
        <label>预留剩余空间 KB</label>
        <input
          data-testid="cache-debug-reserve-input"
          type="number"
          min="0"
          value={reserveKBInput}
          onChange={(event): void => {
            setReserveKBInput(event.target.value);
          }}
        />
      </div>
      <div className="form-group">
        <label>每批追加条数</label>
        <input
          data-testid="cache-debug-append-count-input"
          type="number"
          min="1"
          value={appendCountInput}
          onChange={(event): void => {
            setAppendCountInput(event.target.value);
          }}
        />
      </div>
      <div className="form-group">
        <label>单条填充字符数</label>
        <input
          data-testid="cache-debug-blob-size-input"
          type="number"
          min="128"
          value={blobSizeInput}
          onChange={(event): void => {
            setBlobSizeInput(event.target.value);
          }}
        />
      </div>
      <div>
        <button className="btn btn-primary" onClick={handleInspectClick} type="button">
          打印缓存概览
        </button>
        <button
          className="btn btn-primary"
          onClick={(): void => {
            handleMeasureClick('userInfo');
          }}
          type="button"
          disabled={!isReady}
        >
          测普通用户容量
        </button>
        <button
          className="btn btn-primary"
          onClick={(): void => {
            handleMeasureClick('conversation');
          }}
          type="button"
          disabled={!isReady}
        >
          测普通会话容量
        </button>
        <button
          className="btn btn-primary"
          onClick={(): void => {
            handleMeasureClick('groupNamecard');
          }}
          type="button"
          disabled={!isReady}
        >
          测普通群名片容量
        </button>
        <button
          className="btn btn-primary"
          onClick={(): void => {
            handleMeasureClick('contact');
          }}
          type="button"
          disabled={!isReady}
        >
          测普通联系人容量
        </button>
      </div>
      <p className="cache-debug-warning">
        上面 4 个“测普通*容量”按钮会覆盖当前用户的 SDK 缓存 key，只保留该类型的测试数据。
      </p>
      <div>
        <button
          className="btn btn-warning"
          onClick={handleSeedClick}
          type="button"
          disabled={!isReady}
        >
          预填到临界值
        </button>
        <button
          className="btn btn-primary"
          onClick={(): void => {
            void handleAppendSdkClick();
          }}
          type="button"
          disabled={!isReady}
        >
          用 SDK 追加几条
        </button>
        <button
          className="btn btn-success"
          onClick={handleAppendLocalClick}
          type="button"
          disabled={!isReady}
        >
          直接写 localStorage
        </button>
        <button
          className="btn btn-danger"
          onClick={handleClearClick}
          type="button"
          disabled={!isReady}
        >
          清理当前缓存 key
        </button>
        <button
          className="btn"
          onClick={(): void => {
            window.location.reload();
          }}
          type="button"
        >
          刷新页面
        </button>
      </div>
      <p className="cache-debug-tip">
        现在这块分两类场景：如果你想看正常数据大概能存多少条，直接用“测普通*容量”按钮；如果你想复现
        QuotaExceeded 清理流程，再用“预填到临界值 + 用 SDK 追加几条”。
      </p>
      <pre className="cache-debug-result" data-testid="cache-debug-result">
        {lastResult || '尚未执行调试动作'}
      </pre>
    </div>
  );
};
