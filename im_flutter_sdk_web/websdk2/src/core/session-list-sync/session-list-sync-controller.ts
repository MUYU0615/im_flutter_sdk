import type { ChatClient } from '../../chat-client';
import type { SessionListCapabilityState } from '../../cache/cache-types';
import type { ConversationItem } from '../../types/conversation';
import type { SyncDataError } from '../../types/sync-data';
import type { SessionListRequestParams } from '../../protocol/session-list/types';
import { ERROR_CODES } from '../../utils/error-codes';
import { SDKError } from '../../utils/errors';
import { retryWithCondition } from '../../utils/retry';
import { buildFallbackConversationItemsFromConversations } from './session-list-sync-normalizer';
import type { SessionListSyncFailureDecision } from './session-list-sync-types';
import { SessionListSyncSession } from './session-list-sync-session';
import { runSessionListSync } from './session-list-sync-runner';
import { toConversationSummary } from './session-list-query';

const now = (): number => Date.now();
const SESSION_LIST_SYNC_IN_PROGRESS = 1103;
const SESSION_LIST_RETRY_OPTIONS = {
  maxAttempts: 3,
  initialDelay: 3000,
  maxDelay: 5000,
  backoffMultiplier: 1,
  jitter: true,
} as const;

const buildUnavailableCapabilityState = (
  status: Extract<SessionListCapabilityState['status'], 'unsupported' | 'unconfigured'>,
  reason: string
): SessionListCapabilityState => {
  return {
    status,
    determinedAt: now(),
    reason,
  };
};

const shouldFallbackWithoutProbe = (capabilityState: SessionListCapabilityState): boolean => {
  return capabilityState.status === 'unsupported' || capabilityState.status === 'unconfigured';
};

const classifyFailure = (error: SDKError): SessionListSyncFailureDecision => {
  if (
    error.code === ERROR_CODES.OPERATION_UNSUPPORTED ||
    error.code === ERROR_CODES.AUTH_UNAUTHORIZED
  ) {
    return {
      capabilityState: buildUnavailableCapabilityState('unsupported', error.message),
      shouldUseFallback: true,
    };
  }
  if (
    error.code === ERROR_CODES.AUTH_TOKEN_EXPIRED ||
    error.code === ERROR_CODES.AUTH_BIND_ANOTHER_DEVICE
  ) {
    return {
      shouldUseFallback: true,
    };
  }
  if (error.code === ERROR_CODES.SERVER_BUSY) {
    return {
      shouldUseFallback: true,
      shouldRetry: true,
    };
  }
  if (error.code === SESSION_LIST_SYNC_IN_PROGRESS) {
    return {
      shouldUseFallback: true,
      shouldRetry: true,
    };
  }
  if (error.code === ERROR_CODES.CONTACT_SYNC_CURSOR_INVALID) {
    return {
      shouldUseFallback: true,
      shouldResetCheckpoint: true,
    };
  }
  return {
    shouldUseFallback: true,
  };
};

const shouldRetrySessionListSyncError = (error: unknown): boolean => {
  if (!(error instanceof SDKError)) {
    return false;
  }
  return error.code === ERROR_CODES.SERVER_BUSY || error.code === SESSION_LIST_SYNC_IN_PROGRESS;
};

const buildConversationSyncDataError = (error: SDKError): SyncDataError => {
  return {
    dataType: 'conversation',
    code: error.code,
    stage: 'fallback',
    message: error.message,
    retryable: shouldRetrySessionListSyncError(error),
  };
};

export class SessionListSyncController {
  private readonly client: ChatClient;
  private running: Promise<ReadonlyArray<ConversationItem>> | null = null;
  private currentSession: SessionListSyncSession | null = null;
  // 035：记录本登录周期内“新会话列表链路”是否可用，避免已判定不支持后仍反复探测。
  private capabilityState: SessionListCapabilityState = {
    status: 'unknown',
  };

  public constructor(client: ChatClient) {
    this.client = client;
  }

  public getCapabilityState(): SessionListCapabilityState {
    return this.capabilityState;
  }

  public refresh(params: SessionListRequestParams): Promise<ReadonlyArray<ConversationItem>> {
    if (this.running) {
      // 035：主动刷新命中同一轮在途任务时，直接复用 Promise，不重复发起同步开始事件。
      return this.running;
    }
    this.currentSession = new SessionListSyncSession();
    this.currentSession.start();
    this.running = this.runRefresh(this.currentSession, {
      includeEmpty: params.includeEmpty,
      includeMark: true,
    });
    void this.running.finally(() => {
      this.running = null;
      this.currentSession = null;
    });
    return this.running;
  }

  private async runRefresh(
    session: SessionListSyncSession,
    params: SessionListRequestParams
  ): Promise<ReadonlyArray<ConversationItem>> {
    const cacheManager = this.client.getCacheManager();
    if (!cacheManager) {
      return [];
    }

    this.client.emitSyncDataStart('conversation');
    const directFallback = await this.tryDirectFallback(cacheManager);
    if (directFallback) {
      // 035：即便直接命中 fallback，也要形成 start -> finish 事件闭环，便于 demo/UI 感知能力状态。
      this.client.emitConversationListUpdate('conversation', true);
      this.client.emitSyncDataFinished({
        dataType: 'conversation',
        status: 'success',
      });
      return directFallback;
    }

    try {
      const previousCheckpoint = cacheManager.loadSessionListCheckpoint();
      const syncMode = previousCheckpoint.sessionsLastSyncTs > 0 ? 'incremental' : 'full';
      let attempt = 0;
      const result = await retryWithCondition(async () => {
        attempt += 1;
        const attemptSession = attempt === 1 ? session : this.createRetrySession();
        attemptSession.start();
        try {
          return await runSessionListSync({
            client: this.client,
            session: attemptSession,
            params,
          });
        } catch (error) {
          attemptSession.fail();
          throw error;
        }
      }, shouldRetrySessionListSyncError, SESSION_LIST_RETRY_OPTIONS);
      const syncStartedAt = session.getStartedAt();
      const resultWithSession = {
        result,
        syncStartedAt,
      };
      const cachedSessionList = cacheManager.loadSessionList();
      const normalized =
        syncMode === 'full' && resultWithSession.result.items.length === 0 && cachedSessionList.length > 0
          ? cachedSessionList
          : resultWithSession.result.items;
      cacheManager.updateConversationsFromServer(
        normalized.map(toConversationSummary),
        {
          syncStartedAt: resultWithSession.syncStartedAt,
        }
      );
      this.capabilityState = {
        status: 'available',
        determinedAt: now(),
      };
      const nextCheckpoint = {
        lastSyncTime: resultWithSession.result.lastSyncFinishedTs,
        lastSyncFinishedTs: resultWithSession.result.lastSyncFinishedTs,
        sessionsLastSyncTs: resultWithSession.result.lastSyncFinishedTs,
        lastSuccessfulAt: now(),
      };
      if (syncMode === 'incremental') {
        cacheManager.mergeSessionListIncremental(normalized, nextCheckpoint);
      } else {
        cacheManager.replaceSessionList(
          normalized,
          nextCheckpoint,
          {
            syncStartedAt: resultWithSession.syncStartedAt,
          }
        );
      }
      const finalSessionList = cacheManager.loadSessionList();
      this.client.emitConversationListUpdate('conversation', syncMode === 'full');
      this.client.emitSyncDataFinished({
        dataType: 'conversation',
        status: 'success',
      });
      return finalSessionList;
    } catch (error) {
      const sdkError =
        error instanceof SDKError
          ? error
          : new SDKError(error instanceof Error ? error.message : String(error));
      session.fail();
      const failure = classifyFailure(sdkError);
      if (failure.capabilityState) {
        this.capabilityState = failure.capabilityState;
      }
      if (failure.shouldResetCheckpoint) {
        cacheManager.resetSessionListCheckpoint();
      }
      const fallback = await this.buildFallbackSessionList(cacheManager);
      if (failure.shouldUseFallback) {
        cacheManager.replaceSessionList(fallback);
      }
      this.client.emitConversationListUpdate('conversation', true);
      this.client.emitSyncDataFinished({
        dataType: 'conversation',
        status: 'failed',
        error: buildConversationSyncDataError(sdkError),
      });
      return fallback;
    }
  }

  private async tryDirectFallback(
    cacheManager: NonNullable<ReturnType<ChatClient['getCacheManager']>>
  ): Promise<ReadonlyArray<ConversationItem> | null> {
    if (shouldFallbackWithoutProbe(this.capabilityState)) {
      // 035：同一登录周期内，一旦确定该能力不可用，后续 refreshSessionList 不再重复探测。
      const fallback = await this.buildFallbackSessionList(cacheManager);
      cacheManager.replaceSessionList(fallback);
      return fallback;
    }

    const hasConfiguredSyncWs = Boolean(this.client.getServerUrlsConfig()?.syncWsUrl);
    const hasDnsProbe = this.client.isSessionListDnsProbeAvailable();
    if (!hasConfiguredSyncWs && !hasDnsProbe) {
      this.capabilityState = buildUnavailableCapabilityState(
        'unconfigured',
        'session-list sync websocket is unavailable'
      );
      const fallback = await this.buildFallbackSessionList(cacheManager);
      cacheManager.replaceSessionList(fallback);
      return fallback;
    }

    return null;
  }

  private createRetrySession(): SessionListSyncSession {
    const session = new SessionListSyncSession();
    return session;
  }

  private async buildFallbackSessionList(
    cacheManager: NonNullable<ReturnType<ChatClient['getCacheManager']>>
  ): Promise<ReadonlyArray<ConversationItem>> {
    // 035：回退时只替换“会话列表”的数据来源，仍统一返回 ConversationItem 公开结构。
    return await buildFallbackConversationItemsFromConversations(
      cacheManager.loadConversationSummaries(),
      this.client
    );
  }
}
