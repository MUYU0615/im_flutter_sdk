/**
 * 联系人同步控制器
 */

import { ERROR_CODES } from '../../utils/error-codes';
import { SDKError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { RosterSyncClient } from './roster-sync-client';
import type {
  ContactSyncContextState,
  ContactSyncDependencies,
  ContactSyncDecisionResult,
  ParsedRosterItem,
  ParsedRosterMetadata,
} from './roster-sync-types';
import type { ContactSyncDecision, ContactSyncStage } from '../../types/contact';

const inferDecisionOnMetadataFailure = (state: ContactSyncContextState): ContactSyncDecision => {
  return state.versionState.version ? 'incremental' : 'full';
};

export const decideContactSync = (options: {
  metadata?: {
    readonly version: string;
    readonly requiresSync: boolean;
  };
  metadataFailed?: boolean;
  state: ContactSyncContextState;
}): ContactSyncDecisionResult => {
  const { metadata, metadataFailed, state } = options;
  const currentVersion = state.versionState.version;

  if (metadataFailed || !metadata) {
    return {
      decision:
        state.cacheMeta.cacheIntegrity === 'complete'
          ? inferDecisionOnMetadataFailure(state)
          : 'full',
      version: currentVersion,
    };
  }

  if (!metadata.requiresSync && state.cacheMeta.cacheIntegrity === 'complete') {
    return {
      decision: 'skip',
      version: metadata.version || currentVersion,
    };
  }

  if (
    metadata.requiresSync &&
    state.cacheMeta.cacheIntegrity === 'complete' &&
    currentVersion
  ) {
    return {
      decision: 'incremental',
      version: metadata.version || currentVersion,
    };
  }

  return {
    decision: 'full',
    version: metadata.version || currentVersion,
  };
};

const parseRosterMetadata = (metadata: string): ParsedRosterMetadata => {
  if (!metadata) {
    return {};
  }
  try {
    const parsed = JSON.parse(metadata) as Record<string, unknown>;
    return {
      nickname: typeof parsed.nickname === 'string' ? parsed.nickname : undefined,
      avatarUrl:
        typeof parsed.avatarUrl === 'string'
          ? parsed.avatarUrl
          : typeof parsed.avatarurl === 'string'
            ? parsed.avatarurl
            : undefined,
      sign: typeof parsed.sign === 'string' ? parsed.sign : undefined,
      ext: typeof parsed.ext === 'string' ? parsed.ext : undefined,
    };
  } catch {
    return {};
  }
};

const getHttpStatus = (error: unknown): number | null => {
  if (!(error instanceof SDKError) || !error.details) {
    return null;
  }
  const value = error.details['httpStatus'];
  return typeof value === 'number' ? value : null;
};

const shouldFailFastOnMetadataError = (error: unknown): boolean => {
  const httpStatus = getHttpStatus(error);
  return httpStatus === 401 || httpStatus === 403 || httpStatus === 404;
};

const parseRosterItems = (
  pages: ReadonlyArray<import('../../protocol/roster/types').RosterResponse>
): ReadonlyArray<ParsedRosterItem> => {
  const parsed: ParsedRosterItem[] = [];
  for (const page of pages) {
    for (const item of page.data) {
      const metadata = parseRosterMetadata(item.metadata);
      parsed.push({
        relation: {
          userId: item.contact,
          remark: item.remark,
          sign: metadata.sign ?? '',
          addTs: item.createdAt,
          updatedAt: item.updatedAt,
          metadataUpdatedAt: item.metadataUpdatedAt,
        },
        userInfo: {
          userId: item.contact,
          nickname: metadata.nickname,
          avatarUrl: metadata.avatarUrl,
          sign: metadata.sign,
          ext: metadata.ext,
        },
      });
    }
  }

  return parsed;
};

const buildFailure = (
  stage: ContactSyncStage,
  code: number,
  message: string,
  retryable: boolean
): {
  code: number;
  stage: ContactSyncStage;
  message: string;
  retryable: boolean;
} => {
  return {
    code,
    stage,
    message: `${stage}: ${message}`,
    retryable,
  };
};

const logContactSyncDuration = (payload: {
  readonly outcome: 'skip' | 'finish' | 'fail';
  readonly decision: ContactSyncDecision;
  readonly durationMs: number;
  readonly version?: string;
  readonly source?: 'cache' | 'sync';
  readonly changed?: boolean;
  readonly stage?: ContactSyncStage;
  readonly hasUsableSnapshot: boolean;
}): void => {
  logger.warn('Contact sync duration', payload);
};

export class RosterSyncController {
  private readonly dependencies: ContactSyncDependencies;
  private running: Promise<void> | null = null;

  public constructor(dependencies: ContactSyncDependencies) {
    this.dependencies = dependencies;
  }

  public async sync(): Promise<void> {
    if (this.running) {
      return await this.running;
    }
    this.running = this.runSync();
    try {
      await this.running;
    } finally {
      this.running = null;
    }
  }

  public cancel(): void {
    this.dependencies.getSharedSyncSession().cancel('contact-sync-cancelled');
  }
  //TODO: log
  private async runSync(): Promise<void> {
    const state = this.dependencies.getContextState();
    const metadataStartedAt = Date.now();
    let metadataDecision: ContactSyncDecisionResult;
    this.dependencies.onStart();

    try {
      const metadata = await this.dependencies.queryMetadata(state.versionState.version);
      metadataDecision = decideContactSync({
        metadata,
        state,
      });

      if (metadataDecision.decision === 'skip') {
        this.dependencies.onFinish();
        logContactSyncDuration({
          outcome: 'skip',
          decision: metadataDecision.decision,
          durationMs: Date.now() - metadataStartedAt,
          version: metadataDecision.version,
          hasUsableSnapshot: state.cachedSnapshot.complete,
        });
        return;
      }
    } catch (error) {
      if (shouldFailFastOnMetadataError(error)) {
        const fallbackDecision = decideContactSync({
          metadataFailed: true,
          state,
        });
        const sdkError =
          error instanceof SDKError
            ? error
            : new SDKError(
                'Contact metadata request failed',
                ERROR_CODES.CONTACT_SYNC_METADATA_FAILED,
                {
                  details: {
                    stage: 'metadata',
                  },
                }
              );
        this.dependencies.onFinish({
          error: buildFailure('metadata', sdkError.code, sdkError.message, false),
        });
        logContactSyncDuration({
          outcome: 'fail',
          decision: fallbackDecision.decision,
          durationMs: Date.now() - metadataStartedAt,
          version: state.versionState.version,
          stage: 'metadata',
          hasUsableSnapshot: state.cachedSnapshot.complete,
          source: state.cachedSnapshot.complete ? state.cachedSnapshot.source : undefined,
        });
        return;
      }

      metadataDecision = decideContactSync({
        metadataFailed: true,
        state,
      });

      if (state.cachedSnapshot.complete) {
        this.dependencies.onFinish({
          error: buildFailure(
            'metadata',
            ERROR_CODES.CONTACT_SYNC_METADATA_FAILED,
            error instanceof Error ? error.message : String(error),
            true
          ),
        });
        logContactSyncDuration({
          outcome: 'fail',
          decision: metadataDecision.decision,
          durationMs: Date.now() - metadataStartedAt,
          version: metadataDecision.version,
          stage: 'metadata',
          hasUsableSnapshot: true,
          source: state.cachedSnapshot.source,
        });
        return;
      }
    }
    try {
      const urls = await this.dependencies.getSyncUrls();
      const request = this.dependencies.buildRosterRequest({
        decision: metadataDecision.decision,
        version: state.versionState.version,
      });

      //TODO: onStart 放在这
      const rosterResult = await new RosterSyncClient(
        this.dependencies.getSharedSyncSession()
      ).sync({
        urls,
        request,
      });
      const parsed = parseRosterItems(rosterResult.pages);
      const applyResult = this.dependencies.applySyncResult({
        mode: rosterResult.mode,
        relations: parsed.map(item => item.relation),
        userInfos: parsed.map(item => item.userInfo),
        version: rosterResult.version,
        lastSyncTs: Date.now(),
      });

      this.dependencies.onFinish();
      logContactSyncDuration({
        outcome: 'finish',
        decision: metadataDecision.decision,
        durationMs: Date.now() - metadataStartedAt,
        version: rosterResult.version,
        source: 'sync',
        changed: applyResult.changed,
        hasUsableSnapshot: applyResult.snapshot.complete,
      });
    } catch (error) {
      const sdkError =
        error instanceof SDKError
          ? error
          : new SDKError('Contact sync failed', ERROR_CODES.CONTACT_SYNC_SOCKET_FAILED, {
              details: {
                stage: 'sync_page',
                cause: error instanceof Error ? error.message : String(error),
              },
            });
      const details = sdkError.details ?? {};
      const stage = (
        typeof details.stage === 'string' ? details.stage : 'sync_page'
      ) as ContactSyncStage;
      this.dependencies.onFinish({
        error: buildFailure(stage, sdkError.code, sdkError.message, true),
      });
      logContactSyncDuration({
        outcome: 'fail',
        decision: metadataDecision.decision,
        durationMs: Date.now() - metadataStartedAt,
        version: metadataDecision.version,
        stage,
        hasUsableSnapshot: state.cachedSnapshot.complete,
        source: state.cachedSnapshot.complete ? state.cachedSnapshot.source : undefined,
      });
    }
  }
}
