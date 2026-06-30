/**
 * 缓存管理器
 */

import {
  CACHE_EVICTION_CONVERSATION_RATIO,
  CACHE_EVICTION_GROUP_NAMECARD_RATIO,
  CACHE_EVICTION_MIN_BATCH,
  CACHE_EVICTION_USER_INFO_RATIO,
  CACHE_FLUSH_INTERVAL_MS,
  CACHE_MAX_GROUP_NAMECARD_COUNT,
  CACHE_MAX_USER_INFO_COUNT,
  CACHE_SCHEMA_VERSION,
  CACHE_TTL_SECONDS,
} from '../config/cache'; // 缓存配置
import { logger } from '../utils/logger'; // 日志工具
import type { ContactSnapshot } from '../types/contact';
import type { UserInfo, UserInfoNotifyPatch } from '../types/user-info';
import type { JoinedGroupSnapshot, JoinedGroupSummary } from '../types/group';
import { CacheCrypto } from './cache-crypto'; // 加密工具
import { CacheKeyName, buildCacheKey } from './cache-keys'; // key 工具
import type {
  CacheConfig,
  CacheDump,
  ContactCacheMeta,
  ContactRelationRecord,
  ContactVersionState,
  ConversationSummary,
  GroupNamecardCacheRecord,
  JoinedGroupPreviewStorageRecord,
  SessionListCacheRecord,
  SessionListCheckpoint,
  SessionListStorageRecord,
  UserInfoSummary,
} from './cache-types'; // 类型定义
import type {
  ConversationMark,
  ConversationType,
  ConversationItem,
  SessionListRemindType,
} from '../types/conversation';
import type { Message } from '../types';
import type { Sender } from '../types/sender';
import { CacheMetadataStore } from './cache-metadata'; // 元信息存储
import { CacheStore } from './cache-store'; // 本地存储封装
import { isQuotaExceededError, isRecord } from './cache-utils'; // 工具方法
import { ContactCache } from './contact-cache'; // 联系人缓存
import { ConversationCache } from './conversation-cache'; // 会话缓存
import { GroupNamecardCache } from './group-namecard-cache'; // 群名片缓存
import { JoinedGroupPreviewCache } from './joined-group-preview-cache';
import { SessionListCache } from './session-list-cache';
import { UserInfoCache } from './user-info-cache'; // 用户信息缓存
import {
  applySessionListMessagePatch,
  mergeSessionListIncrementalWithPinnedOverride,
  mergeSessionListSnapshot,
} from '../core/session-list-sync/session-list-sync-merge';
import {
  buildUserInfoFromSummary,
  projectUserInfoToSummary,
  UserInfoRuntimeStore,
  type UserInfoRuntimeMergeResult,
  type UserInfoRuntimeUpsertRecord,
} from '../managers/user-info/user-info-runtime-store';
import { projectLatestMessageVersions } from '../core/message/profile-sync/latest-message-version-projector';

export interface CacheManagerOptions {
  // 缓存管理器入参
  readonly appKey: string; // appKey
  readonly userId: string; // 用户 ID
  readonly cacheEncryptionMode?: 'auto' | 'off'; // 加密模式
  readonly config?: Partial<CacheConfig>; // 配置覆盖
} // 入参结束

export interface ConversationMergeResult {
  // 会话合并结果
  readonly items: ReadonlyArray<ConversationSummary>; // 合并后的会话
  readonly changed: boolean; // 是否有业务变更
} // 合并结果结束

export interface ConversationMessagePatchResult {
  readonly items: ReadonlyArray<ConversationSummary>;
  readonly changed: boolean;
}

export interface SessionListPatchResult {
  readonly items: ReadonlyArray<ConversationItem>;
  readonly changed: boolean;
}

export interface SessionListDisplayRefreshTarget {
  readonly userId: string;
  readonly lastModified?: number;
}

export interface SessionListGroupDisplayRefreshTarget {
  readonly groupId: string;
  readonly name?: string;
  readonly avatarUrl?: string;
  readonly remindType?: SessionListRemindType;
}

export interface SessionListBatchApplyResult {
  readonly items: ReadonlyArray<ConversationItem>;
  readonly checkpoint: SessionListCheckpoint;
}

export interface ContactSyncApplyResult {
  readonly snapshot: ContactSnapshot;
  readonly changed: boolean;
}

export interface ContactLocalPatchResult {
  readonly snapshot: ContactSnapshot;
  readonly changed: boolean;
}

export class CacheManager {
  // 缓存管理器
  private readonly config: CacheConfig; // 缓存配置
  private readonly userId: string; // 当前缓存归属用户 ID
  private readonly store: CacheStore; // 存储封装
  private readonly metadataStore: CacheMetadataStore; // 元信息存储
  private readonly conversationCache: ConversationCache; // 会话缓存
  private readonly userInfoCache: UserInfoCache; // 用户信息缓存
  private readonly groupNamecardCache: GroupNamecardCache; // 群名片缓存
  private readonly sessionListCache: SessionListCache; // 新会话列表缓存
  private readonly joinedGroupPreviewCache: JoinedGroupPreviewCache;
  private readonly contactCache: ContactCache; // 联系人缓存
  private readonly userInfoRuntimeStore: UserInfoRuntimeStore; // 用户资料运行时真相
  private currentConversation:
    | {
        readonly conversationId: string;
        readonly type: ConversationType;
      }
    | null = null;
  private readonly conversationKey: string; // 会话缓存 key
  private readonly userInfoKey: string; // 用户信息缓存 key
  private readonly groupNamecardKey: string; // 群名片缓存 key
  private readonly sessionListKey: string; // 新会话列表缓存 key
  private readonly sessionListCheckpointKey: string; // 旧 checkpoint 兼容 key
  private readonly joinedGroupPreviewKey: string;
  private readonly contactRelationKey: string; // 联系人关系缓存 key
  private readonly contactVersionKey: string; // 联系人版本缓存 key
  private readonly contactMetaKey: string; // 联系人元信息缓存 key
  private readonly metadataKey: string; // 元信息 key
  private sessionListCheckpoint: SessionListCheckpoint = {
    lastSyncTime: 0,
    lastSyncFinishedTs: 0,
    sessionsLastSyncTs: 0,
    lastSuccessfulAt: 0,
  };
  private flushTimer: ReturnType<typeof setTimeout> | null = null; // flush 定时器
  private flushIdleHandle: number | null = null; // idle handle
  private flushing: boolean = false; // flush 进行中标记
  private readonly loadPromise: Promise<void>; // 预加载任务

  public constructor(options: CacheManagerOptions) {
    // 构造函数
    this.userId = options.userId;
    this.config = {
      // 构建配置
      schemaVersion: CACHE_SCHEMA_VERSION, // 版本号
      ttlSeconds: CACHE_TTL_SECONDS, // TTL
      flushIntervalMs: CACHE_FLUSH_INTERVAL_MS, // flush 间隔
      maxUserInfoCount: CACHE_MAX_USER_INFO_COUNT, // 用户信息上限
      maxGroupNamecardCount: CACHE_MAX_GROUP_NAMECARD_COUNT, // 群名片上限
      maxConversations: options.config?.maxConversations, // 会话上限
      ...options.config, // 覆盖配置
    }; // 配置构建结束
    const cryptoAdapter =
      options.cacheEncryptionMode === 'off'
        ? null // 明文回退
        : new CacheCrypto(options.appKey, options.userId); // 创建加密器
    this.store = new CacheStore(cryptoAdapter ?? undefined); // 创建存储
    const context = {
      // key 上下文
      appKey: options.appKey, // appKey
      userId: options.userId, // 用户 ID
      schemaVersion: this.config.schemaVersion, // 结构版本
    }; // key 上下文结束
    this.conversationKey = buildCacheKey(context, CacheKeyName.CONVERSATIONS); // 会话 key
    this.userInfoKey = buildCacheKey(context, CacheKeyName.USER_INFO); // 用户信息 key
    this.groupNamecardKey = buildCacheKey(context, CacheKeyName.GROUP_NAMECARD); // 群名片 key
    this.sessionListKey = buildCacheKey(context, CacheKeyName.SESSION_LIST); // 新会话列表 key
    this.sessionListCheckpointKey = buildCacheKey(context, CacheKeyName.SESSION_LIST_CHECKPOINT);
    this.joinedGroupPreviewKey = buildCacheKey(context, CacheKeyName.JOINED_GROUP_PREVIEW);
    this.contactRelationKey = buildCacheKey(context, CacheKeyName.CONTACT_RELATIONS); // 联系人关系 key
    this.contactVersionKey = buildCacheKey(context, CacheKeyName.CONTACT_VERSION); // 联系人版本 key
    this.contactMetaKey = buildCacheKey(context, CacheKeyName.CONTACT_META); // 联系人元信息 key
    this.metadataKey = buildCacheKey(context, CacheKeyName.METADATA); // 元信息 key
    this.metadataStore = new CacheMetadataStore(
      this.store,
      this.metadataKey,
      this.config.schemaVersion
    ); // 元信息存储
    this.conversationCache = new ConversationCache(); // 创建会话缓存
    this.userInfoCache = new UserInfoCache(); // 创建用户缓存
    this.groupNamecardCache = new GroupNamecardCache(); // 创建群名片缓存
    this.sessionListCache = new SessionListCache(); // 创建新会话列表缓存
    this.joinedGroupPreviewCache = new JoinedGroupPreviewCache();
    this.contactCache = new ContactCache(); // 创建联系人缓存
    this.userInfoRuntimeStore = new UserInfoRuntimeStore(); // 创建运行时资料缓存
    this.loadPromise = this.loadFromStorage(); // 初始化加载
  } // 构造结束

  public getConfig(): CacheConfig {
    // 获取配置
    return this.config; // 返回配置
  } // 获取配置结束

  public async prepare(): Promise<void> {
    // 等待缓存加载
    await this.loadPromise; // 等待加载完成
  } // 等待结束

  public loadConversationSummaries(): ReadonlyArray<ConversationSummary> {
    // 读取会话缓存
    return this.conversationCache.getAll(); // 返回会话列表
  } // 读取会话结束

  public loadSessionList(): ReadonlyArray<ConversationItem> {
    return this.sessionListCache.exportItems();
  }

  public loadJoinedGroupPreviewSnapshot(): JoinedGroupSnapshot {
    return this.joinedGroupPreviewCache.getSnapshot();
  }

  public applyJoinedGroupPreviewSnapshot(snapshot: JoinedGroupSnapshot): void {
    this.joinedGroupPreviewCache.setSnapshot(snapshot);
    this.scheduleFlush();
  }

  public loadSessionListCheckpoint(): SessionListCheckpoint {
    return this.sessionListCheckpoint;
  }

  public resetSessionListCheckpoint(): void {
    this.sessionListCheckpoint = {
      lastSyncTime: 0,
      lastSyncFinishedTs: 0,
      sessionsLastSyncTs: 0,
      lastSuccessfulAt: 0,
    };
    this.scheduleFlush();
  }

  public loadUserInfoSummaries(): ReadonlyArray<UserInfoSummary> {
    // 读取用户缓存
    return this.userInfoCache.getAll(); // 返回用户列表
  } // 读取用户结束

  public loadGroupNamecards(groupId?: string): ReadonlyArray<GroupNamecardCacheRecord> {
    if (!groupId) {
      return this.groupNamecardCache.getAll();
    }
    return this.groupNamecardCache.getByGroupId(groupId, Date.now(), false);
  }

  public loadContactSnapshot(source: 'cache' | 'sync' = 'cache'): ContactSnapshot {
    const snapshot = this.contactCache.buildSnapshot(this.userInfoCache.getAll(), source);
    return {
      ...snapshot,
      items: snapshot.items.map(item => ({
        ...item,
        userInfo: this.userInfoRuntimeStore.get(item.userId, false)?.profile ?? item.userInfo,
      })),
    };
  }

  public loadContactRelationRecords(): ReadonlyArray<ContactRelationRecord> {
    return this.contactCache.getAll();
  }

  public loadContactVersionState(): ContactVersionState {
    return this.contactCache.getVersionState();
  }

  public loadContactCacheMeta(): ContactCacheMeta {
    return this.contactCache.getMeta();
  }

  public markConversationAccess(
    targets: ReadonlyArray<{ conversationId: string; type: ConversationType }>
  ): void {
    // 标记会话访问
    const now = Date.now(); // 当前时间
    const changed = this.conversationCache.updateLastAccess(targets, now); // 更新访问时间
    if (changed) {
      // 有变更
      this.scheduleFlush(); // 调度落盘
    } // 变更判断结束
  } // 标记访问结束

  public setCurrentConversation(params: {
    readonly conversationId: string;
    readonly type: ConversationType;
  }): void {
    this.currentConversation = {
      conversationId: params.conversationId,
      type: params.type,
    };
  }

  public resetCurrentConversation(): void {
    this.currentConversation = null;
  }

  public getCurrentConversation():
    | {
        readonly conversationId: string;
        readonly type: ConversationType;
      }
    | null {
    return this.currentConversation;
  }

  public markConversationRead(params: {
    readonly conversationId: string;
    readonly type: ConversationType;
    readonly readAt?: number;
  }): SessionListPatchResult {
    const now = params.readAt ?? Date.now();
    let conversationChanged = false;
    const nextConversations = this.conversationCache.getAll().map(item => {
      if (item.conversationId !== params.conversationId || item.type !== params.type) {
        return item;
      }
      if (item.unreadCount === 0) {
        return item;
      }
      conversationChanged = true;
      return {
        ...item,
        unreadCount: 0,
        lastUpdate: now,
      };
    });

    let sessionListChanged = false;
    const nextSessionList = this.sessionListCache.getAll().map(item => {
      if (item.conversationId !== params.conversationId || item.conversationType !== params.type) {
        return item;
      }
      if (item.unreadCount === 0 && item.readAt === now) {
        return item;
      }
      sessionListChanged = true;
      return {
        ...item,
        unreadCount: 0,
        readAt: now,
        updatedAt: now,
      };
    });

    if (!conversationChanged && !sessionListChanged) {
      return {
        items: this.sessionListCache.exportItems(),
        changed: false,
      };
    }

    if (conversationChanged) {
      this.conversationCache.setAll(nextConversations);
    }
    if (sessionListChanged) {
      this.sessionListCache.setAll(nextSessionList);
    }
    this.scheduleFlush();
    return {
      items: this.sessionListCache.exportItems(),
      changed: true,
    };
  }

  public applyConversationPinnedMutation(params: {
    readonly conversationId: string;
    readonly type: ConversationType;
    readonly isPinned: boolean;
    readonly pinnedTime?: number;
  }): SessionListPatchResult {
    const now = Date.now();
    const existingConversations = this.conversationCache.getAll();
    const nextConversations = this.conversationCache.getAll().map(item => {
      if (item.conversationId !== params.conversationId || item.type !== params.type) {
        return item;
      }
      return {
        ...item,
        isPinned: params.isPinned,
        pinnedTime: params.isPinned ? (params.pinnedTime ?? now) : 0,
        lastUpdate: now,
      };
    });

    const existingSessionList = this.sessionListCache.getAll();
    const nextSessionList = existingSessionList.map(item => {
      if (item.conversationId !== params.conversationId || item.conversationType !== params.type) {
        return item;
      }
      return {
        ...item,
        isPinned: params.isPinned,
        pinnedTimestamp: params.isPinned ? (params.pinnedTime ?? now) : 0,
        updatedAt: now,
      };
    });
    const conversationChanged = !this.isConversationListEqual(
      existingConversations,
      nextConversations
    );
    const sessionListChanged = !this.isSessionListEqual(existingSessionList, nextSessionList);
    if (!conversationChanged && !sessionListChanged) {
      return {
        items: this.sessionListCache.exportItems(),
        changed: false,
      };
    }
    if (conversationChanged) {
      this.conversationCache.setAll(nextConversations);
    }
    if (sessionListChanged) {
      this.sessionListCache.setAll(nextSessionList);
    }
    this.scheduleFlush();
    return {
      items: this.sessionListCache.exportItems(),
      changed: true,
    };
  }

  public deleteConversation(params: {
    readonly conversationId: string;
    readonly type: ConversationType;
  }): SessionListPatchResult {
    const existingConversations = this.conversationCache.getAll();
    const nextConversations = existingConversations.filter(item => {
      return item.conversationId !== params.conversationId || item.type !== params.type;
    });
    const existingSessionList = this.sessionListCache.getAll();
    const nextSessionList = existingSessionList.filter(item => {
      return item.conversationId !== params.conversationId || item.conversationType !== params.type;
    });
    const conversationChanged = nextConversations.length !== existingConversations.length;
    const sessionListChanged = nextSessionList.length !== existingSessionList.length;
    if (!conversationChanged && !sessionListChanged) {
      return {
        items: this.sessionListCache.exportItems(),
        changed: false,
      };
    }
    if (conversationChanged) {
      this.conversationCache.setAll(nextConversations);
    }
    if (sessionListChanged) {
      this.sessionListCache.setAll(nextSessionList);
    }
    this.scheduleFlush();
    return {
      items: this.sessionListCache.exportItems(),
      changed: true,
    };
  }

  public clearConversations(): SessionListPatchResult {
    const conversationChanged = this.conversationCache.getAll().length > 0;
    const sessionListChanged = this.sessionListCache.getAll().length > 0;
    if (!conversationChanged && !sessionListChanged) {
      return {
        items: this.sessionListCache.exportItems(),
        changed: false,
      };
    }
    if (conversationChanged) {
      this.conversationCache.setAll([]);
    }
    if (sessionListChanged) {
      this.sessionListCache.setAll([]);
    }
    this.scheduleFlush();
    return {
      items: this.sessionListCache.exportItems(),
      changed: true,
    };
  }

  public applyConversationMarkMutation(params: {
    readonly conversations: ReadonlyArray<{
      readonly conversationId: string;
      readonly conversationType: ConversationType;
      readonly applied: boolean;
    }>;
    readonly mark: ConversationMark;
    readonly operation: 'addMark' | 'removeMark';
  }): SessionListPatchResult {
    const targetKeys = new Set(
      params.conversations
        .filter(item => item.applied)
        .map(item => `${item.conversationType}:${item.conversationId}`)
    );
    if (targetKeys.size === 0) {
      return {
        items: this.sessionListCache.exportItems(),
        changed: false,
      };
    }

    const now = Date.now();
    const mutateMarks = (
      marks: ReadonlyArray<ConversationMark>
    ): ReadonlyArray<ConversationMark> => {
      if (params.operation === 'addMark') {
        return marks.includes(params.mark) ? marks : [...marks, params.mark];
      }
      return marks.filter(mark => mark !== params.mark);
    };

    const existingConversations = this.conversationCache.getAll();
    const nextConversations = existingConversations.map(item => {
      const key = `${item.type}:${item.conversationId}`;
      if (!targetKeys.has(key)) {
        return item;
      }
      const marks = mutateMarks(item.marks);
      if (this.areConversationMarksEqual(marks, item.marks)) {
        return item;
      }
      return {
        ...item,
        marks,
        lastUpdate: now,
      };
    });

    const existingSessionList = this.sessionListCache.getAll();
    const nextSessionList = existingSessionList.map(item => {
      const key = `${item.conversationType}:${item.conversationId}`;
      if (!targetKeys.has(key)) {
        return item;
      }
      const marks = mutateMarks(item.marks);
      if (this.areConversationMarksEqual(marks, item.marks)) {
        return item;
      }
      return {
        ...item,
        marks,
        updatedAt: now,
      };
    });
    const conversationChanged = !this.isConversationListEqual(
      existingConversations,
      nextConversations
    );
    const sessionListChanged = !this.isSessionListEqual(existingSessionList, nextSessionList);
    if (!conversationChanged && !sessionListChanged) {
      return {
        items: this.sessionListCache.exportItems(),
        changed: false,
      };
    }
    if (conversationChanged) {
      this.conversationCache.setAll(nextConversations);
    }
    if (sessionListChanged) {
      this.sessionListCache.setAll(nextSessionList);
    }
    this.scheduleFlush();
    return {
      items: this.sessionListCache.exportItems(),
      changed: true,
    };
  }

  public replaceSessionList(
    items: ReadonlyArray<ConversationItem>,
    checkpoint?: Partial<SessionListCheckpoint>,
    options?: {
      readonly syncStartedAt?: number;
    }
  ): void {
    // 035：新会话列表以完整快照为真相源；成功同步或回退映射后，都通过这里一次性覆盖本地 ConversationItem 缓存。
    const now = Date.now();
    const records: SessionListCacheRecord[] = items.map(item => ({
      ...item,
      updatedAt: item.lastMessageAt ?? now,
    }));
    const merged = mergeSessionListSnapshot({
      snapshot: records,
      existing: this.sessionListCache.getAll(),
      syncStartedAt: options?.syncStartedAt,
    });
    this.sessionListCache.setAll(this.hydrateSessionListRecordsFromLocalProfiles(merged, now));
    if (checkpoint) {
      this.sessionListCheckpoint = {
        ...this.sessionListCheckpoint,
        ...checkpoint,
      };
    }
    this.scheduleFlush();
  }

  public mergeSessionListIncremental(
    items: ReadonlyArray<ConversationItem>,
    checkpoint?: Partial<SessionListCheckpoint>
  ): void {
    this.sessionListCache.setAll(
      this.hydrateSessionListRecordsFromLocalProfiles(
        this.buildIncrementalSessionListRecords(items)
      )
    );
    if (checkpoint) {
      this.sessionListCheckpoint = {
        ...this.sessionListCheckpoint,
        ...checkpoint,
      };
    }
    this.scheduleFlush();
  }

  public async applySessionListBatch(options: {
    readonly items: ReadonlyArray<ConversationItem>;
    readonly mode: 'full' | 'incremental';
    readonly isLastBatch: boolean;
    readonly syncStartedAt?: number;
    readonly checkpoint?: Partial<SessionListCheckpoint>;
  }): Promise<SessionListBatchApplyResult> {
    if (options.mode === 'incremental') {
      this.applySessionListIncrementalBatch(
        options.items,
        options.isLastBatch ? options.checkpoint : undefined
      );
    } else {
      this.applySessionListFullBatch(
        options.items,
        options.isLastBatch ? options.checkpoint : undefined,
        options.syncStartedAt
      );
    }

    await this.writeSessionListStorageNow();
    return {
      items: this.sessionListCache.exportItems(),
      checkpoint: this.sessionListCheckpoint,
    };
  }

  public setUserInfoSummaries(items: ReadonlyArray<UserInfoSummary>): void {
    // 写入用户信息
    const now = Date.now(); // 当前时间
    this.userInfoCache.setAll(items, now); // 写入缓存
    this.userInfoCache.trimMax(this.config.maxUserInfoCount); // 控制最大条数
    this.refreshContactCacheIntegrity(); // 重算联系人完整性
    this.scheduleFlush(); // 调度落盘
  } // 写入用户信息结束

  public upsertRuntimeUserInfos(items: ReadonlyArray<UserInfoRuntimeUpsertRecord>): void {
    if (items.length === 0) {
      return;
    }
    this.userInfoRuntimeStore.setAll(items);
  }

  public getRuntimeUserInfo(userId: string, updateAccess = false): UserInfo | null {
    return this.userInfoRuntimeStore.get(userId, updateAccess)?.profile ?? null;
  }

  public applyUserInfoNotifyPatch(patch: UserInfoNotifyPatch): UserInfoRuntimeMergeResult {
    const summary = this.userInfoCache.getByIds([patch.userId], Date.now(), false)[0];
    const fallbackProfile = summary ? buildUserInfoFromSummary(summary) : undefined;
    return this.userInfoRuntimeStore.applyPatch(patch, fallbackProfile);
  }

  public updateUserInfoSummaryFromRuntime(userId: string): void {
    const record = this.userInfoRuntimeStore.get(userId, false);
    if (!record) {
      return;
    }

    this.setUserInfoSummaries([projectUserInfoToSummary(record)]);
  }

  public getUserInfoSummaries(
    userIds: ReadonlyArray<string>,
    updateAccess: boolean
  ): ReadonlyArray<UserInfoSummary> {
    // 获取用户信息
    const now = Date.now(); // 当前时间
    const result = this.userInfoCache.getByIds(userIds, now, updateAccess); // 读取缓存
    if (updateAccess) {
      // 需要更新
      this.scheduleFlush(); // 调度落盘
    } // 更新判断结束
    return result; // 返回结果
  } // 获取用户信息结束

  public removeUserInfo(userIds: ReadonlyArray<string>): void {
    // 删除用户信息
    this.userInfoCache.remove(userIds); // 删除缓存
    this.refreshContactCacheIntegrity(); // 重算联系人完整性
    this.scheduleFlush(); // 调度落盘
  } // 删除用户信息结束

  public getGroupNamecard(
    groupId: string,
    userId: string,
    updateAccess: boolean
  ): GroupNamecardCacheRecord | null {
    const result = this.groupNamecardCache.get(groupId, userId, Date.now(), updateAccess);
    if (updateAccess && result) {
      this.scheduleFlush();
    }
    return result;
  }

  public setGroupNamecards(items: ReadonlyArray<GroupNamecardCacheRecord>): void {
    const now = Date.now();
    this.groupNamecardCache.setAll(items, now);
    if (typeof this.config.maxGroupNamecardCount === 'number') {
      this.groupNamecardCache.trimMax(this.config.maxGroupNamecardCount);
    }
    this.scheduleFlush();
  }

  public removeGroupNamecards(targets: ReadonlyArray<{ groupId: string; userId: string }>): void {
    this.groupNamecardCache.remove(targets);
    this.scheduleFlush();
  }

  public setContactVersionState(state: ContactVersionState): void {
    this.contactCache.setVersionState(state);
    this.scheduleFlush();
  }

  public markContactCacheIncomplete(reason: ContactCacheMeta['reason']): void {
    this.contactCache.updateMeta({
      cacheIntegrity: 'incomplete',
      reason,
    });
    this.scheduleFlush();
  }

  public applyContactSync(options: {
    mode: 'full' | 'incremental';
    relations: ReadonlyArray<ContactRelationRecord>;
    userInfos: ReadonlyArray<
      Pick<UserInfoSummary, 'userId' | 'nickname' | 'avatarUrl' | 'sign' | 'ext'>
    >;
    version: string;
    lastSyncTs: number;
  }): ContactSyncApplyResult {
    const previousSnapshot = this.loadContactSnapshot('cache');
    const now = Date.now();

    this.userInfoCache.setAll(
      options.userInfos.map(item => ({
        userId: item.userId,
        nickname: item.nickname,
        avatarUrl: item.avatarUrl,
        sign: item.sign,
        ext: item.ext,
        lastAccess: now,
        lastUpdate: now,
      })),
      now
    );

    if (options.mode === 'full') {
      this.contactCache.replaceAll(options.relations);
    } else {
      this.contactCache.upsert(options.relations);
    }
    this.userInfoCache.trimMax(this.config.maxUserInfoCount);

    this.contactCache.setVersionState({
      version: options.version,
      lastVersionCheckAt: now,
      lastVersionSource: 'sync_page',
    });
    this.contactCache.updateMeta({
      cacheIntegrity: 'complete',
      lastSyncTs: options.lastSyncTs,
      lastSuccessfulVersion: options.version,
      lastSyncMode: options.mode,
    });
    this.refreshContactCacheIntegrity();
    this.scheduleFlush();

    const nextSnapshot = this.loadContactSnapshot('sync');
    return {
      snapshot: nextSnapshot,
      changed:
        this.buildContactSnapshotSignature(previousSnapshot) !==
        this.buildContactSnapshotSignature(nextSnapshot),
    };
  }

  public refreshSessionListDisplayFromUserInfos(
    targets: ReadonlyArray<SessionListDisplayRefreshTarget>
  ): SessionListPatchResult {
    const targetMap = new Map<string, number | undefined>();
    for (const target of targets) {
      if (!target.userId) {
        continue;
      }
      const previous = targetMap.get(target.userId);
      if (
        typeof previous === 'number' &&
        typeof target.lastModified === 'number' &&
        previous >= target.lastModified
      ) {
        continue;
      }
      targetMap.set(target.userId, target.lastModified);
    }
    if (targetMap.size === 0) {
      return {
        items: this.sessionListCache.exportItems(),
        changed: false,
      };
    }

    const now = Date.now();
    const contacts = this.loadContactSnapshot('cache').items;
    const contactsByUserId = new Map(contacts.map(item => [item.userId, item]));
    const userInfoSummariesByUserId = new Map(
      this.userInfoCache.getAll().map(item => [item.userId, item])
    );
    const nextItems = this.sessionListCache.getAll().map(item => {
      let nextItem = item;
      if (
        item.conversationType === 'singleChat' &&
        !this.shouldSkipSessionUserDisplayRefresh(
          item.conversationId,
          targetMap,
          userInfoSummariesByUserId
        )
      ) {
        const contact = contactsByUserId.get(item.conversationId);
        const userInfo = this.resolveSessionDisplayUserInfo(
          item.conversationId,
          userInfoSummariesByUserId
        );
        const displayFields = this.buildSingleSessionDisplayFields(
          item.conversationId,
          contact,
          userInfo,
          item.conversationName,
          item.conversationAvatar
        );
        if (
          item.conversationName !== displayFields.conversationName ||
          item.conversationAvatar !== displayFields.conversationAvatar
        ) {
          nextItem = {
            ...nextItem,
            conversationName: displayFields.conversationName,
            conversationAvatar: displayFields.conversationAvatar,
            updatedAt: now,
          };
        }
      }

      const lastMessage = nextItem.lastMessage;
      if (
        lastMessage &&
        !this.shouldSkipSessionUserDisplayRefresh(
          lastMessage.sender.userId,
          targetMap,
          userInfoSummariesByUserId
        )
      ) {
        const contact = contactsByUserId.get(lastMessage.sender.userId);
        const userInfo = this.resolveSessionDisplayUserInfo(
          lastMessage.sender.userId,
          userInfoSummariesByUserId
        );
        const sender = this.buildSessionMessageSender(
          lastMessage.sender.userId,
          lastMessage.sender,
          contact,
          userInfo
        );
        if (!this.isSenderEqual(lastMessage.sender, sender)) {
          nextItem = {
            ...nextItem,
            lastMessage: {
              ...lastMessage,
              sender,
            },
            updatedAt: now,
          };
        }
      }

      return nextItem;
    });

    const previousItems = this.sessionListCache.getAll();
    const changed = !this.isSessionListEqual(previousItems, nextItems);
    if (changed) {
      this.sessionListCache.setAll(nextItems);
      this.scheduleFlush();
    }
    return {
      items: this.sessionListCache.exportItems(),
      changed,
    };
  }

  public refreshSessionListDisplayFromJoinedGroups(
    groups: ReadonlyArray<SessionListGroupDisplayRefreshTarget>
  ): SessionListPatchResult {
    const groupsById = new Map<string, SessionListGroupDisplayRefreshTarget>();
    for (const group of groups) {
      const groupId = group.groupId.trim();
      if (!groupId) {
        continue;
      }
      groupsById.set(groupId, group);
    }
    if (groupsById.size === 0) {
      return {
        items: this.sessionListCache.exportItems(),
        changed: false,
      };
    }

    const now = Date.now();
    const nextItems = this.sessionListCache.getAll().map(item => {
      if (item.conversationType !== 'groupChat') {
        return item;
      }
      const group = groupsById.get(item.conversationId);
      if (!group) {
        return item;
      }

      const name = group.name?.trim();
      const conversationName = name || item.conversationName;
      const conversationAvatar = group.avatarUrl ?? item.conversationAvatar;
      const remindType = this.mapJoinedGroupRemindTypeToSession(group.remindType);
      const shouldUpdateRemindType = remindType !== undefined && remindType !== item.remindType;
      if (
        conversationName === item.conversationName &&
        conversationAvatar === item.conversationAvatar &&
        !shouldUpdateRemindType
      ) {
        return item;
      }

      return {
        ...item,
        conversationName,
        conversationAvatar,
        remindType: shouldUpdateRemindType ? remindType : item.remindType,
        updatedAt: now,
      };
    });

    const previousItems = this.sessionListCache.getAll();
    const changed = !this.isSessionListEqual(previousItems, nextItems);
    if (changed) {
      this.sessionListCache.setAll(nextItems);
      this.scheduleFlush();
    }
    return {
      items: this.sessionListCache.exportItems(),
      changed,
    };
  }

  public removeContact(userId: string): ContactLocalPatchResult {
    return this.applyContactLocalPatch(() => {
      return this.contactCache.remove(userId);
    });
  }

  public updateContactRemark(userId: string, remark: string): ContactLocalPatchResult {
    return this.applyContactLocalPatch(() => {
      return this.contactCache.updateRemark(userId, remark, Date.now());
    });
  }

  public applyContactRosterNotice(options: {
    readonly action: 'add' | 'remove';
    readonly userId: string;
    readonly rosterVersion?: string;
  }): ContactLocalPatchResult {
    const previousSnapshot = this.loadContactSnapshot('cache');
    const now = Date.now();
    const relationChanged =
      options.action === 'add'
        ? this.contactCache.addByNotice(options.userId, now)
        : this.contactCache.remove(options.userId);
    const versionChanged =
      typeof options.rosterVersion === 'string' && options.rosterVersion.trim().length > 0
        ? this.contactCache.updateVersionFromNotice(options.rosterVersion, now)
        : false;

    if (relationChanged || versionChanged) {
      this.refreshContactCacheIntegrity(false);
      this.scheduleFlush();
    }

    const nextSnapshot = this.loadContactSnapshot('cache');
    return {
      snapshot: nextSnapshot,
      changed:
        this.buildContactSnapshotSignature(previousSnapshot) !==
        this.buildContactSnapshotSignature(nextSnapshot),
    };
  }

  public updateConversationsFromServer(
    items: ReadonlyArray<ConversationSummary>,
    options?: {
      readonly syncStartedAt?: number;
    }
  ): ConversationMergeResult {
    // 合并服务端会话
    const now = Date.now(); // 当前时间
    const existing = this.conversationCache.getAll(); // 读取现有缓存
    const merged = this.mergeConversationLists(existing, items, now, options?.syncStartedAt); // 合并列表
    const changed = !this.isConversationListEqual(existing, merged); // 判断是否变更
    this.conversationCache.setAll(merged); // 覆盖缓存
    if (this.config.maxConversations) {
      // 检查最大会话数
      this.conversationCache.trimMax(this.config.maxConversations); // 裁剪缓存
    } // 上限判断结束
    this.scheduleFlush(); // 调度落盘
    return { items: merged, changed }; // 返回结果
  } // 合并会话结束

  public applyIncomingMessageToConversations(message: Message): ConversationMessagePatchResult {
    const conversationRef = this.resolveConversationFromMessage(message);
    if (!conversationRef) {
      return {
        items: this.conversationCache.getAll(),
        changed: false,
      };
    }

    const now = Date.now();
    const existing = this.conversationCache.getAll();
    const targetIndex = existing.findIndex(item => {
      return (
        item.conversationId === conversationRef.conversationId && item.type === conversationRef.type
      );
    });
    const current = targetIndex >= 0 ? existing[targetIndex] : undefined;
    const conversation = this.buildConversationFromMessage(message, current, now);
    if (!conversation) {
      return {
        items: existing,
        changed: false,
      };
    }
    const merged = [conversation, ...existing.filter((_item, index) => index !== targetIndex)];
    const changed = !this.isConversationListEqual(existing, merged);
    if (!changed) {
      return {
        items: existing,
        changed: false,
      };
    }

    this.conversationCache.setAll(merged);
    if (this.config.maxConversations) {
      this.conversationCache.trimMax(this.config.maxConversations);
    }
    this.scheduleFlush();
    return {
      items: this.conversationCache.getAll(),
      changed: true,
    };
  }

  public applyIncomingMessageToSessionList(message: Message): SessionListPatchResult {
    const conversationRef = this.resolveConversationFromMessage(message);
    if (!conversationRef) {
      return {
        items: this.sessionListCache.exportItems(),
        changed: false,
      };
    }

    const existing = this.sessionListCache.getAll();
    const current = existing.find(item => {
      return (
        item.conversationId === conversationRef.conversationId &&
        item.conversationType === conversationRef.type
      );
    });
    // 035：实时消息 patch 优先复用当前 session-list 已有基线；
    // 若旧 conversation cache 还未来得及补齐，也不能把 ConversationItem 的 unread 基线打回 0/1。
    const conversation =
      this.conversationCache.getAll().find(item => {
        return (
          item.conversationId === conversationRef.conversationId &&
          item.type === conversationRef.type
        );
      }) ?? this.buildConversationFromMessage(message, undefined, Date.now());
    if (!conversation) {
      return {
        items: this.sessionListCache.exportItems(),
        changed: false,
      };
    }

    const nextRecord = this.buildSessionListRecordFromConversation(
      conversation,
      message,
      current,
      Date.now()
    );
    const merged = applySessionListMessagePatch({
      existing,
      nextRecord,
      message,
    });
    const changed = !this.isSessionListEqual(existing, merged);
    if (!changed) {
      return {
        items: this.sessionListCache.exportItems(),
        changed: false,
      };
    }

    this.sessionListCache.setAll(merged);
    this.scheduleFlush();
    return {
      items: this.sessionListCache.exportItems(),
      changed: true,
    };
  }

  private async loadFromStorage(): Promise<void> {
    // 读取本地存储
    const now = Date.now(); // 当前时间
    const conversationDump = await this.readDump<ConversationSummary>(this.conversationKey); // 读取会话缓存
    this.conversationCache.load(conversationDump, now); // 加载会话缓存
    const userDump = await this.readDump<UserInfoSummary>(this.userInfoKey); // 读取用户缓存
    this.userInfoCache.load(userDump, now); // 加载用户缓存
    const groupNamecardDump = await this.readDump<GroupNamecardCacheRecord>(this.groupNamecardKey);
    this.groupNamecardCache.load(groupNamecardDump, now);
    const sessionListStorage = await this.readValue<SessionListStorageRecord | null>(
      this.sessionListKey,
      null
    );
    const sessionListItems =
      sessionListStorage && isRecord(sessionListStorage) && Array.isArray(sessionListStorage.items)
        ? (sessionListStorage.items as ReadonlyArray<SessionListCacheRecord>)
        : [];
    this.sessionListCache.load(sessionListItems, now);
    const embeddedCheckpoint =
      sessionListStorage && isRecord(sessionListStorage) && isRecord(sessionListStorage.checkpoint)
        ? sessionListStorage.checkpoint
        : null;
    const legacyCheckpoint =
      embeddedCheckpoint ??
      (await this.readValue<SessionListCheckpoint | null>(this.sessionListCheckpointKey, null));
    this.sessionListCheckpoint = this.normalizeSessionListCheckpoint(legacyCheckpoint);
    const joinedGroupPreview = await this.readValue<JoinedGroupPreviewStorageRecord | null>(
      this.joinedGroupPreviewKey,
      null
    );
    this.joinedGroupPreviewCache.load(joinedGroupPreview);
    const contactDump = await this.readDump<ContactRelationRecord>(this.contactRelationKey); // 读取联系人缓存
    const contactVersion = await this.readValue<ContactVersionState | null>(
      this.contactVersionKey,
      null
    ); // 读取联系人版本
    const contactMeta = await this.readValue<ContactCacheMeta | null>(this.contactMetaKey, null); // 读取联系人元信息
    this.contactCache.load(contactDump, contactVersion, contactMeta); // 加载联系人缓存
    this.refreshContactCacheIntegrity(false); // 基于 userInfo 重算完整性
    await this.metadataStore.load(); // 读取元信息
  } // 读取结束

  private async readDump<T>(key: string): Promise<ReadonlyArray<T>> {
    // 读取缓存列表
    const fallback: CacheDump<T> = { items: [] }; // 默认值
    const raw = await this.store.readAsync<CacheDump<T>>(key, fallback); // 读取存储
    if (!raw || !isRecord(raw) || !Array.isArray(raw.items)) {
      // 校验结构
      return []; // 返回空
    } // 校验结束
    return raw.items as ReadonlyArray<T>; // 返回列表
  } // 读取列表结束

  private async readValue<T>(key: string, fallback: T): Promise<T> {
    return await this.store.readAsync<T>(key, fallback);
  }

  private applySessionListFullBatch(
    items: ReadonlyArray<ConversationItem>,
    checkpoint?: Partial<SessionListCheckpoint>,
    syncStartedAt?: number
  ): void {
    const now = Date.now();
    const records: SessionListCacheRecord[] = items.map(item => ({
      ...item,
      updatedAt: item.lastMessageAt ?? now,
    }));
    const merged = mergeSessionListSnapshot({
      snapshot: records,
      existing: this.sessionListCache.getAll(),
      syncStartedAt,
    });
    this.sessionListCache.setAll(this.hydrateSessionListRecordsFromLocalProfiles(merged, now));
    if (checkpoint) {
      this.sessionListCheckpoint = {
        ...this.sessionListCheckpoint,
        ...checkpoint,
      };
    }
  }

  private applySessionListIncrementalBatch(
    items: ReadonlyArray<ConversationItem>,
    checkpoint?: Partial<SessionListCheckpoint>
  ): void {
    this.sessionListCache.setAll(
      this.hydrateSessionListRecordsFromLocalProfiles(
        this.buildIncrementalSessionListRecords(items)
      )
    );
    if (checkpoint) {
      this.sessionListCheckpoint = {
        ...this.sessionListCheckpoint,
        ...checkpoint,
      };
    }
  }

  private normalizeSessionListCheckpoint(value: unknown): SessionListCheckpoint {
    if (!value || !isRecord(value)) {
      return {
        lastSyncTime: 0,
        lastSyncFinishedTs: 0,
        sessionsLastSyncTs: 0,
        lastSuccessfulAt: 0,
      };
    }
    return {
      lastSyncTime: typeof value.lastSyncTime === 'number' ? value.lastSyncTime : 0,
      lastSyncFinishedTs:
        typeof value.lastSyncFinishedTs === 'number' ? value.lastSyncFinishedTs : 0,
      sessionsLastSyncTs:
        typeof value.sessionsLastSyncTs === 'number' ? value.sessionsLastSyncTs : 0,
      lastSuccessfulAt: typeof value.lastSuccessfulAt === 'number' ? value.lastSuccessfulAt : 0,
    };
  }

  private scheduleFlush(): void {
    // 调度 flush
    if (this.flushTimer !== null || this.flushIdleHandle !== null) {
      // 已调度
      return; // 直接返回
    } // 调度判断结束
    if (typeof requestIdleCallback !== 'undefined') {
      // 空闲回调可用
      this.flushIdleHandle = requestIdleCallback(
        () => {
          // 注册空闲回调
          this.flushIdleHandle = null; // 清理 handle
          void this.flushNow(); // 执行 flush
        },
        { timeout: this.config.flushIntervalMs }
      ); // 设置超时
      return; // 结束调度
    } // 空闲回调判断结束
    this.flushTimer = setTimeout(() => {
      // 使用定时器
      this.flushTimer = null; // 清理定时器
      void this.flushNow(); // 执行 flush
    }, this.config.flushIntervalMs); // 设置延迟
  } // 调度结束

  private async flushNow(): Promise<void> {
    // 执行 flush
    if (this.flushing) {
      // 防止并发
      return; // 直接返回
    } // 判断结束
    this.flushing = true; // 标记进行中
    try {
      const maxQuotaCleanupAttempts = 6;
      for (let attempt = 0; attempt <= maxQuotaCleanupAttempts; attempt += 1) {
        try {
          await this.writeAll(); // 写入缓存
          await this.metadataStore.touchLastFlush(); // 更新元信息
          return;
        } catch (error) {
          if (!isQuotaExceededError(error)) {
            logger.warn('Cache flush failed', error); // 记录异常
            return;
          }
          const cleanupStage = this.handleQuotaExceeded(); // 执行清理
          if (cleanupStage === 'none') {
            logger.warn('Cache flush failed: no cache entry can be evicted', error);
            return;
          }
        }
      }
      logger.warn('Cache flush failed after quota cleanup attempts');
    } finally {
      // 收尾
      this.flushing = false; // 清理标记
    } // 异常处理结束
  } // flush 结束

  private async writeAll(): Promise<void> {
    // 写入全部缓存
    await this.store.writeAsync(this.conversationKey, { items: this.conversationCache.getAll() }); // 写入会话
    await this.store.writeAsync(this.userInfoKey, { items: this.userInfoCache.getAll() }); // 写入用户
    await this.store.writeAsync(this.groupNamecardKey, { items: this.groupNamecardCache.getAll() }); // 写入群名片
    await this.store.writeAsync(this.sessionListKey, {
      items: this.sessionListCache.getAll(),
      checkpoint: this.sessionListCheckpoint,
    } satisfies SessionListStorageRecord);
    await this.store.writeAsync(
      this.joinedGroupPreviewKey,
      this.joinedGroupPreviewCache.exportRecord()
    );
    this.store.remove(this.sessionListCheckpointKey);
    await this.store.writeAsync(this.contactRelationKey, { items: this.contactCache.getAll() }); // 写入联系人关系
    await this.store.writeAsync(this.contactVersionKey, this.contactCache.getVersionState()); // 写入联系人版本
    await this.store.writeAsync(this.contactMetaKey, this.contactCache.getMeta()); // 写入联系人元信息
  } // 写入结束

  private async writeSessionListStorageNow(): Promise<void> {
    await this.store.writeAsync(this.sessionListKey, {
      items: this.sessionListCache.getAll(),
      checkpoint: this.sessionListCheckpoint,
    } satisfies SessionListStorageRecord);
    this.store.remove(this.sessionListCheckpointKey);
    await this.metadataStore.touchLastFlush();
  }

  private buildIncrementalSessionListRecords(
    items: ReadonlyArray<ConversationItem>
  ): ReadonlyArray<SessionListCacheRecord> {
    const existing = this.sessionListCache.getAll();
    const existingMap = new Map<string, SessionListCacheRecord>();
    for (const item of existing) {
      existingMap.set(`${item.conversationType}:${item.conversationId}`, item);
    }

    const now = Date.now();
    const incoming = items.map<SessionListCacheRecord>(item => {
      const key = `${item.conversationType}:${item.conversationId}`;
      return {
        ...item,
        updatedAt: item.lastMessageAt ?? existingMap.get(key)?.updatedAt ?? now,
      };
    });

    return mergeSessionListIncrementalWithPinnedOverride({
      existing,
      incoming,
    });
  }

  private handleQuotaExceeded(): 'groupNamecard' | 'userInfo' | 'conversation' | 'none' {
    // 处理配额超限
    const now = Date.now(); // 当前时间
    const ttlMs = this.config.ttlSeconds * 1000; // TTL 毫秒
    if (this.groupNamecardCache.removeExpired(ttlMs, now)) {
      this.contactCache.updateMeta({
        cacheIntegrity: 'incomplete',
        reason: 'quota_exceeded',
      });
      this.refreshContactCacheIntegrity(false); // 重算联系人完整性
      return 'groupNamecard';
    }
    const groupNamecardCount = this.groupNamecardCache.getAll().length; // 群名片数量
    if (groupNamecardCount > 0) {
      const removeGroupNamecards = this.calculateEvictCount(
        groupNamecardCount,
        CACHE_EVICTION_GROUP_NAMECARD_RATIO
      );
      if (this.groupNamecardCache.evictByLru(removeGroupNamecards)) {
        this.contactCache.updateMeta({
          cacheIntegrity: 'incomplete',
          reason: 'quota_exceeded',
        });
        this.refreshContactCacheIntegrity(false); // 重算联系人完整性
        return 'groupNamecard';
      }
    }
    const userInfoRemoved = this.userInfoCache.removeExpired(ttlMs, now); // 清理用户过期
    if (userInfoRemoved) {
      this.contactCache.updateMeta({
        cacheIntegrity: 'incomplete',
        reason: 'quota_exceeded',
      });
      this.refreshContactCacheIntegrity(false); // 重算联系人完整性
      return 'userInfo';
    }
    const stage = this.evictByPolicy(); // 执行 LRU 淘汰
    this.contactCache.updateMeta({
      cacheIntegrity: 'incomplete',
      reason: 'quota_exceeded',
    });
    this.refreshContactCacheIntegrity(false); // 重算联系人完整性
    return stage;
  } // 处理超限结束

  private evictByPolicy(): 'userInfo' | 'conversation' | 'none' {
    // 按策略淘汰
    const userInfoCount = this.userInfoCache.getAll().length; // 用户数量
    if (userInfoCount > 0) {
      // 优先淘汰用户信息
      const removeUserInfo = this.calculateEvictCount(
        userInfoCount,
        CACHE_EVICTION_USER_INFO_RATIO
      ); // 计算淘汰数量
      if (removeUserInfo > 0) {
        // 判断数量
        this.userInfoCache.evictByLru(removeUserInfo); // 淘汰用户
        return 'userInfo';
      } // 判断结束
      return 'none'; // 用户信息仍存在时优先保留会话缓存
    } // 用户信息判断结束
    const conversationCount = this.conversationCache.getAll().length; // 会话数量
    const removeConversations = this.calculateEvictCount(
      conversationCount,
      CACHE_EVICTION_CONVERSATION_RATIO
    ); // 计算淘汰数量
    if (removeConversations > 0) {
      // 判断数量
      this.conversationCache.evictByLru(removeConversations); // 淘汰会话
      return 'conversation';
    } // 判断结束
    return 'none';
  } // 淘汰结束

  private calculateEvictCount(total: number, ratio: number): number {
    // 计算淘汰数量
    if (total <= 0) {
      // 无数据
      return 0; // 返回 0
    } // 无数据判断结束
    const raw = Math.floor(total * ratio); // 计算比例
    return Math.max(raw, CACHE_EVICTION_MIN_BATCH); // 返回最小值
  } // 计算结束

  private mergeConversationLists(
    existing: ReadonlyArray<ConversationSummary>, // 旧数据
    incoming: ReadonlyArray<ConversationSummary>, // 新数据
    now: number, // 当前时间
    syncStartedAt?: number
  ): ReadonlyArray<ConversationSummary> {
    // 合并列表
    const accessMap = new Map<string, number>(); // 访问时间映射
    const existingMap = new Map<string, ConversationSummary>();
    for (const item of existing) {
      // 遍历旧数据
      const key = this.buildConversationKey(item.conversationId, item.type); // 构建 key
      accessMap.set(key, item.lastAccess); // 记录访问时间
      existingMap.set(key, item);
    } // 遍历结束
    const merged: ConversationSummary[] = []; // 合并结果
    const incomingKeys = new Set<string>();
    for (const item of incoming) {
      // 遍历新数据
      const key = this.buildConversationKey(item.conversationId, item.type); // 构建 key
      incomingKeys.add(key);
      const lastAccess = accessMap.get(key) ?? now; // 读取访问时间
      merged.push({
        // 追加合并项
        ...item, // 新数据字段
        marks: Array.isArray(item.marks) ? item.marks : [],
        lastAccess, // 访问时间
        lastUpdate: now, // 更新时间
      }); // 追加结束
    } // 遍历结束
    const preservedRealtimeOnly = existing.filter(item => {
      const key = this.buildConversationKey(item.conversationId, item.type);
      if (incomingKeys.has(key)) {
        return false;
      }
      if (typeof syncStartedAt !== 'number') {
        return false;
      }
      // 035：同步窗口中由实时消息新增/更新但快照暂未返回的会话，不能被完整覆盖误删。
      return item.lastUpdate >= syncStartedAt;
    });
    void existingMap;
    return [...merged, ...preservedRealtimeOnly]; // 返回结果
  } // 合并结束

  private isConversationListEqual(
    left: ReadonlyArray<ConversationSummary>, // 左侧列表
    right: ReadonlyArray<ConversationSummary> // 右侧列表
  ): boolean {
    // 比较列表
    if (left.length !== right.length) {
      // 长度不同
      return false; // 返回否
    } // 长度判断结束
    for (let i = 0; i < left.length; i += 1) {
      // 遍历列表
      const leftItem = left[i];
      const rightItem = right[i];
      if (!leftItem || !rightItem) {
        return false;
      }
      const leftKey = this.buildConversationSignature(leftItem); // 构建签名
      const rightKey = this.buildConversationSignature(rightItem); // 构建签名
      if (leftKey !== rightKey) {
        // 签名不一致
        return false; // 返回否
      } // 判断结束
    } // 遍历结束
    return true; // 返回一致
  } // 比较结束

  private buildConversationSignature(item: ConversationSummary): string {
    // 构建会话签名
    const lastMessage = item.lastMessage; // 读取最后消息
    const lastMessageSignature = lastMessage
      ? `${lastMessage.msgId}:${lastMessage.type}:${lastMessage.timestamp}`
      : 'none'; // 构建消息签名
    const pinnedFlag = item.isPinned ? '1' : '0'; // 置顶标识
    const pinnedTime = typeof item.pinnedTime === 'number' ? item.pinnedTime : 0; // 置顶时间
    const markSignature = item.marks.join(',');
    return `${item.type}:${item.conversationId}:${item.unreadCount}:${pinnedFlag}:${pinnedTime}:${markSignature}:${lastMessageSignature}`; // 返回签名
  } // 构建签名结束

  private buildConversationKey(conversationId: string, type: ConversationType): string {
    // 构建 key
    return `${type}:${conversationId}`; // 返回 key
  } // 构建 key 结束

  private areConversationMarksEqual(
    left: ReadonlyArray<ConversationMark>,
    right: ReadonlyArray<ConversationMark>
  ): boolean {
    return left.length === right.length && left.every((mark, index) => mark === right[index]);
  }

  private buildConversationFromMessage(
    message: Message,
    existing?: ConversationSummary,
    now: number = Date.now()
  ): ConversationSummary | null {
    const conversation = this.resolveConversationFromMessage(message);
    if (!conversation) {
      return null;
    }
    const unreadCount =
      this.shouldIncreaseUnreadForMessage(message)
        ? (existing?.unreadCount ?? 0) + 1
        : (existing?.unreadCount ?? 0);
    const lastAccess = message.direct === 'SEND' ? now : (existing?.lastAccess ?? now);
    return {
      conversationId: conversation.conversationId,
      type: conversation.type,
      lastMessage: this.buildMessageSnippet(message),
      unreadCount,
      isPinned: existing?.isPinned,
      pinnedTime: existing?.pinnedTime,
      marks: existing?.marks ?? [],
      lastAccess,
      lastUpdate: now,
    };
  }

  private resolveConversationFromMessage(
    message: Message
  ): { conversationId: string; type: ConversationType } | null {
    if (typeof message.conversationId !== 'string' || !message.conversationId) {
      return null;
    }

    if (message.conversationType === 'singleChat') {
      const conversationId =
        message.direct === 'SEND'
          ? message.conversationId
          : typeof message.sender.userId === 'string'
            ? message.sender.userId
            : '';
      if (!conversationId) {
        return null;
      }
      return {
        conversationId,
        type: 'singleChat',
      };
    }

    if (message.conversationType === 'groupChat') {
      return {
        conversationId: message.conversationId,
        type: 'groupChat',
      };
    }

    if (message.conversationType === 'chatRoom') {
      return {
        conversationId: message.conversationId,
        type: 'chatRoom',
      };
    }

    return null;
  }

  private buildMessageSnippet(message: Message): ConversationSummary['lastMessage'] {
    const versions = projectLatestMessageVersions(message);
    return {
      msgId: message.msgServerId || message.msgLocalId,
      type: message.type,
      body: this.normalizeMessageBody(message.body),
      timestamp: message.timestamp,
      userInfoUpdateTime: versions.userInfoUpdateTime,
      namecardUpdateTime: versions.namecardUpdateTime,
      modifiedInfo: message.modifiedInfo,
    };
  }

  private normalizeMessageBody(body: Message['body']): Record<string, unknown> {
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      return body as unknown as Record<string, unknown>;
    }
    return {};
  }

  private buildSessionListRecordFromConversation(
    conversation: ConversationSummary,
    message: Message,
    existing?: SessionListCacheRecord,
    now: number = Date.now()
  ): SessionListCacheRecord {
    const contactsByUserId = new Map(
      this.loadContactSnapshot('cache').items.map(item => [item.userId, item])
    );
    const contact = contactsByUserId.get(conversation.conversationId);
    const runtimeUserInfo = this.userInfoRuntimeStore.get(
      conversation.conversationId,
      false
    )?.profile;
    const summaryUserInfo = this.userInfoCache.getByIds(
      [conversation.conversationId],
      now,
      false
    )[0];
    const userInfo =
      runtimeUserInfo ??
      (summaryUserInfo
        ? {
            userId: summaryUserInfo.userId,
            nickname: summaryUserInfo.nickname,
            avatarUrl: summaryUserInfo.avatarUrl,
            sign: summaryUserInfo.sign,
            ext: summaryUserInfo.ext,
          }
        : null);
    const messageSnippet = conversation.lastMessage;
    const existingConversationName = existing?.conversationName;
    const existingConversationAvatar = existing?.conversationAvatar;
    const from = typeof message.sender.userId === 'string' ? message.sender.userId : '';
    const senderUserInfo = this.resolveSessionDisplayUserInfo(from);
    const sender = this.buildSessionMessageSender(
      from,
      message.sender,
      contactsByUserId.get(from),
      senderUserInfo
    );
    const to =
      conversation.type === 'singleChat'
        ? message.direct === 'SEND'
          ? conversation.conversationId
          : this.userId
        : conversation.conversationId;
    const displayFields =
      conversation.type === 'singleChat'
        ? this.buildSingleSessionDisplayFields(
            conversation.conversationId,
            contact,
            userInfo,
            existingConversationName,
            existingConversationAvatar
          )
        : conversation.type === 'chatRoom'
          ? this.buildChatRoomSessionDisplayFields(
              conversation.conversationId,
              existingConversationName,
              existingConversationAvatar
            )
          : this.buildGroupSessionDisplayFields(
              conversation.conversationId,
              existingConversationName,
              existingConversationAvatar
            );

    return {
      conversationId: conversation.conversationId,
      conversationType: conversation.type,
      unreadCount: this.resolveSessionListUnreadCount(conversation, message, existing),
      lastMessage: messageSnippet
        ? {
            msgServerId: messageSnippet.msgId,
            from,
            to,
            sender,
            conversationId: conversation.conversationId,
            conversationType: conversation.type,
            type: message.type,
            status: message.status,
            timestamp: messageSnippet.timestamp,
            direct: message.direct,
            body: messageSnippet.body,
          }
        : null,
      lastMessageAt: messageSnippet?.timestamp ?? conversation.lastUpdate,
      isPinned: conversation.isPinned,
      pinnedTimestamp: conversation.pinnedTime,
      marks: [],
      readAt: existing?.readAt,
      remindType: existing?.remindType ?? 'DEFAULT',
      conversationName: displayFields.conversationName,
      conversationAvatar: displayFields.conversationAvatar,
      updatedAt: now,
    };
  }

  private resolveSessionListUnreadCount(
    conversation: ConversationSummary,
    message: Message,
    existing?: SessionListCacheRecord
  ): number {
    const existingUnread = existing?.unreadCount;
    if (this.shouldIncreaseUnreadForMessage(message)) {
      if (typeof existingUnread === 'number') {
        return Math.max(conversation.unreadCount, existingUnread + 1);
      }
      return conversation.unreadCount;
    }

    if (typeof existingUnread === 'number') {
      return Math.max(conversation.unreadCount, existingUnread);
    }
    return conversation.unreadCount;
  }

  private shouldIncreaseUnreadForMessage(message: Message): boolean {
    if (message.direct !== 'RECEIVE' || message.isOnline === false) {
      return false;
    }
    const conversation = this.resolveConversationFromMessage(message);
    if (!conversation || !this.currentConversation) {
      return true;
    }
    return (
      this.currentConversation.conversationId !== conversation.conversationId ||
      this.currentConversation.type !== conversation.type
    );
  }

  private buildSingleSessionDisplayFields(
    conversationId: string,
    contact: ContactSnapshot['items'][number] | undefined,
    userInfo: {
      readonly userId: string;
      readonly nickname?: string;
      readonly avatarUrl?: string;
      readonly sign?: string;
      readonly ext?: string;
    } | null,
    existingConversationName?: string,
    existingConversationAvatar?: string
  ): Pick<SessionListCacheRecord, 'conversationName' | 'conversationAvatar'> {
    const remark = contact?.remark?.trim();
    const avatarUrl =
      contact?.userInfo.avatarUrl ?? userInfo?.avatarUrl ?? existingConversationAvatar;
    if (remark) {
      return {
        conversationName: remark,
        conversationAvatar: avatarUrl,
      };
    }

    const nickname = contact?.userInfo.nickname?.trim() || userInfo?.nickname?.trim();
    if (nickname) {
      return {
        conversationName: nickname,
        conversationAvatar: avatarUrl,
      };
    }

    if (existingConversationName) {
      return {
        conversationName: existingConversationName,
        conversationAvatar: avatarUrl,
      };
    }

    return {
      conversationName: conversationId,
      conversationAvatar: avatarUrl,
    };
  }

  private shouldSkipSessionUserDisplayRefresh(
    userId: string,
    targetMap: ReadonlyMap<string, number | undefined>,
    userInfoSummariesByUserId: ReadonlyMap<string, UserInfoSummary>
  ): boolean {
    if (!targetMap.has(userId)) {
      return true;
    }
    const targetLastModified = targetMap.get(userId);
    const userInfoSummary = userInfoSummariesByUserId.get(userId);
    return (
      typeof targetLastModified === 'number' &&
      typeof userInfoSummary?.lastUpdate === 'number' &&
      userInfoSummary.lastUpdate > targetLastModified
    );
  }

  private hydrateSessionListRecordsFromLocalProfiles(
    items: ReadonlyArray<SessionListCacheRecord>,
    now: number = Date.now()
  ): ReadonlyArray<SessionListCacheRecord> {
    const contacts = this.loadContactSnapshot('cache').items;
    const contactsByUserId = new Map(contacts.map(item => [item.userId, item]));
    const userInfoSummariesByUserId = new Map(
      this.userInfoCache.getAll().map(item => [item.userId, item])
    );

    return items.map(item => {
      const lastMessage = item.lastMessage;
      if (!lastMessage) {
        return item;
      }
      const senderUserId = lastMessage.sender.userId;
      const contact = contactsByUserId.get(senderUserId);
      const userInfo = this.resolveSessionDisplayUserInfo(senderUserId, userInfoSummariesByUserId);
      const sender =
        item.conversationType === 'singleChat' && senderUserId === item.conversationId
          ? this.buildSingleChatPeerMessageSender(
              senderUserId,
              lastMessage.sender,
              contact,
              userInfo
            )
          : this.buildSessionMessageSender(senderUserId, lastMessage.sender, contact, userInfo);
      if (this.isSenderEqual(lastMessage.sender, sender)) {
        return item;
      }
      return {
        ...item,
        lastMessage: {
          ...lastMessage,
          sender,
        },
        updatedAt: now,
      };
    });
  }

  private resolveSessionDisplayUserInfo(
    userId: string,
    userInfoSummariesByUserId?: ReadonlyMap<string, UserInfoSummary>
  ): {
    readonly userId: string;
    readonly nickname?: string;
    readonly avatarUrl?: string;
    readonly sign?: string;
    readonly ext?: string;
  } | null {
    const runtimeUserInfo = this.userInfoRuntimeStore.get(userId, false)?.profile;
    if (runtimeUserInfo) {
      return runtimeUserInfo;
    }
    const summaryUserInfo =
      userInfoSummariesByUserId?.get(userId) ??
      this.userInfoCache.getByIds([userId], Date.now(), false)[0];
    return summaryUserInfo ? buildUserInfoFromSummary(summaryUserInfo) : null;
  }

  private buildSessionMessageSender(
    userId: string,
    existingSender: Sender | undefined,
    contact: ContactSnapshot['items'][number] | undefined,
    userInfo: {
      readonly userId: string;
      readonly nickname?: string;
      readonly avatarUrl?: string;
    } | null
  ): Sender {
    const remark = contact?.remark?.trim();
    const nickname =
      remark ||
      contact?.userInfo.nickname?.trim() ||
      userInfo?.nickname?.trim() ||
      existingSender?.nickname?.trim();
    const avatarUrl =
      contact?.userInfo.avatarUrl ?? userInfo?.avatarUrl ?? existingSender?.avatarUrl;
    return {
      userId,
      nickname: nickname || undefined,
      avatarUrl,
    };
  }

  private buildSingleChatPeerMessageSender(
    userId: string,
    existingSender: Sender | undefined,
    contact: ContactSnapshot['items'][number] | undefined,
    userInfo: {
      readonly userId: string;
      readonly nickname?: string;
      readonly avatarUrl?: string;
    } | null
  ): Sender {
    const cacheSender = this.buildSessionMessageSender(userId, undefined, contact, userInfo);
    return {
      userId,
      nickname: existingSender?.nickname?.trim() || cacheSender.nickname,
      avatarUrl: existingSender?.avatarUrl || cacheSender.avatarUrl,
    };
  }

  private isSenderEqual(left: Sender, right: Sender): boolean {
    return (
      left.userId === right.userId &&
      left.nickname === right.nickname &&
      left.avatarUrl === right.avatarUrl
    );
  }

  private buildGroupSessionDisplayFields(
    conversationId: string,
    existingConversationName?: string,
    existingConversationAvatar?: string
  ): Pick<SessionListCacheRecord, 'conversationName' | 'conversationAvatar'> {
    if (existingConversationName) {
      return {
        conversationName: existingConversationName,
        conversationAvatar: existingConversationAvatar,
      };
    }
    return {
      conversationName: conversationId,
    };
  }

  private mapJoinedGroupRemindTypeToSession(
    remindType: JoinedGroupSummary['remindType']
  ): SessionListRemindType | undefined {
    if (
      remindType === 'DEFAULT' ||
      remindType === 'ALL' ||
      remindType === 'AT' ||
      remindType === 'NONE'
    ) {
      return remindType;
    }
    return undefined;
  }

  private buildChatRoomSessionDisplayFields(
    conversationId: string,
    existingConversationName?: string,
    existingConversationAvatar?: string
  ): Pick<SessionListCacheRecord, 'conversationName' | 'conversationAvatar'> {
    if (existingConversationName) {
      return {
        conversationName: existingConversationName,
        conversationAvatar: existingConversationAvatar,
      };
    }
    return {
      conversationName: conversationId,
    };
  }

  private isSessionListEqual(
    left: ReadonlyArray<SessionListCacheRecord>,
    right: ReadonlyArray<SessionListCacheRecord>
  ): boolean {
    if (left.length !== right.length) {
      return false;
    }
    for (let i = 0; i < left.length; i += 1) {
      const leftItem = left[i];
      const rightItem = right[i];
      if (!leftItem || !rightItem) {
        return false;
      }
      if (this.buildSessionListSignature(leftItem) !== this.buildSessionListSignature(rightItem)) {
        return false;
      }
    }
    return true;
  }

  private buildSessionListSignature(item: SessionListCacheRecord): string {
    const lastMessage = item.lastMessage;
    const lastMessageSignature = lastMessage
      ? `${lastMessage.msgServerId}:${lastMessage.from}:${lastMessage.to}:${lastMessage.conversationId}:${lastMessage.conversationType}:${lastMessage.type}:${lastMessage.status ?? ''}:${lastMessage.direct ?? ''}:${lastMessage.sender.userId}:${lastMessage.sender.nickname ?? ''}:${lastMessage.sender.avatarUrl ?? ''}:${lastMessage.timestamp}:${JSON.stringify(lastMessage.body)}`
      : 'none';
    const displaySignature = `${item.conversationName}:${item.conversationAvatar ?? ''}`;
    return [
      item.conversationType,
      item.conversationId,
      item.unreadCount,
      item.isPinned ? '1' : '0',
      item.pinnedTimestamp ?? 0,
      item.marks.join(','),
      item.readAt ?? 0,
      item.remindType,
      item.lastMessageAt ?? 0,
      displaySignature,
      lastMessageSignature,
    ].join(':');
  }

  private refreshContactCacheIntegrity(scheduleFlush: boolean = true): void {
    const nextMeta = this.contactCache.computeIntegrity(this.userInfoCache.getAll());
    this.contactCache.setMeta(nextMeta);
    if (scheduleFlush) {
      this.scheduleFlush();
    }
  }

  private buildContactSnapshotSignature(snapshot: ContactSnapshot): string {
    const itemSignature = snapshot.items
      .map(item => {
        return `${item.userId}:${item.userInfo.nickname ?? ''}:${item.userInfo.avatarUrl ?? ''}:${item.userInfo.sign ?? ''}:${item.userInfo.ext ?? ''}:${item.remark}:${item.addTs}`;
      })
      .join('|');
    return `${snapshot.version}:${snapshot.complete ? '1' : '0'}:${itemSignature}`;
  }

  private applyContactLocalPatch(mutator: () => boolean): ContactLocalPatchResult {
    const previousSnapshot = this.loadContactSnapshot('cache');
    const changed = mutator();
    if (changed) {
      this.refreshContactCacheIntegrity(false);
      this.scheduleFlush();
    }

    return {
      snapshot: this.loadContactSnapshot('cache'),
      changed:
        changed &&
        this.buildContactSnapshotSignature(previousSnapshot) !==
          this.buildContactSnapshotSignature(this.loadContactSnapshot('cache')),
    };
  }
} // CacheManager 结束
