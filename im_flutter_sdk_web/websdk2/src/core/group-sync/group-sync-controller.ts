import { ERROR_CODES } from '../../utils/error-codes';
import { SDKError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { parseAppKey } from '../../upload/utils';
import { JoinedGroupsMessageType } from '../../protocol/joined-groups/types';
import { normalizeJoinedGroupItems } from './group-sync-normalizer';
import { mergeJoinedGroupSnapshot } from './group-sync-merge';
import { GroupSyncClient } from './group-sync-client';
import type { JoinedGroupsRequest } from '../../protocol/joined-groups/types';
import type { SyncDataError } from '../../types/sync-data';
import type { GroupSyncControllerDependencies, GroupSyncStage } from './group-sync-types';

const toStage = (value: unknown): GroupSyncStage => {
  if (
    value === 'config' ||
    value === 'socket_connect' ||
    value === 'request_send' ||
    value === 'response_decode' ||
    value === 'batch_merge' ||
    value === 'preview_persist' ||
    value === 'completion_meta' ||
    value === 'auth' ||
    value === 'server_limit' ||
    value === 'cancelled'
  ) {
    return value;
  }
  return 'socket_connect';
};

const buildSyncDataError = (error: unknown): SyncDataError => {
  const sdkError =
    error instanceof SDKError
      ? error
      : new SDKError('Group sync failed', ERROR_CODES.REST_BUSINESS_UNKNOWN, {
          details: {
            stage: 'socket_connect',
            cause: error instanceof Error ? error.message : String(error),
          },
        });
  const details = sdkError.details ?? {};
  const serverCode = details.serverCode;
  return {
    dataType: 'group',
    code: sdkError.code,
    stage: toStage(details.stage),
    message: sdkError.message,
    retryable: details.retryable === true,
    serverCode:
      typeof serverCode === 'number' || typeof serverCode === 'string' ? serverCode : undefined,
  };
};

export class GroupSyncController {
  private readonly dependencies: GroupSyncControllerDependencies;
  private running: Promise<void> | null = null;

  public constructor(dependencies: GroupSyncControllerDependencies) {
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
    this.dependencies.getSharedSyncSession().cancel('group-sync-cancelled');
  }

  private async runSync(): Promise<void> {
    this.dependencies.onStart();
    const startedAt = Date.now();
    try {
      const urls = await this.dependencies.getSyncUrls();
      if (urls.length === 0) {
        throw new SDKError('Group sync websocket urls are unavailable', ERROR_CODES.CONTACT_SYNC_SOCKET_FAILED, {
          details: {
            stage: 'socket_connect',
            retryable: true,
          },
        });
      }
      const request = this.buildRequest();
      const response = await new GroupSyncClient(
        this.dependencies.getSharedSyncSession()
      ).sync({ urls, request });
      const incoming = response.batches.flatMap(batch => normalizeJoinedGroupItems(batch.groups));
      const existingSnapshot = this.dependencies.getRuntimeSnapshot();
      const runtimeSnapshot = mergeJoinedGroupSnapshot({
        existingItems: existingSnapshot?.items ?? [],
        incomingItems: incoming,
        lastSyncFinishedTs: response.lastSyncFinishedTs,
      });
      const cacheManager = this.dependencies.getCacheManager();
      cacheManager.applyJoinedGroupPreviewSnapshot(runtimeSnapshot);
      this.dependencies.applyRuntimeSnapshot(runtimeSnapshot);
      logger.warn('Group sync finished', {
        durationMs: Date.now() - startedAt,
        itemCount: runtimeSnapshot.items.length,
        limited: runtimeSnapshot.meta.limited,
      });
      this.dependencies.onFinish({
        status: 'success',
      });
    } catch (error) {
      const syncError = buildSyncDataError(error);
      logger.warn('Group sync failed', {
        durationMs: Date.now() - startedAt,
        stage: syncError.stage,
        code: syncError.code,
        serverCode: syncError.serverCode,
      });
      this.dependencies.onFinish({
        status: 'failed',
        error: syncError,
      });
    }
  }

  private buildRequest(): JoinedGroupsRequest {
    const context = this.dependencies.getRestContext();
    const { orgName, appName } = parseAppKey(context.appKey);
    return {
      type: JoinedGroupsMessageType.GET_JOINED_GROUPS_REQUEST,
      header: {
        resource: context.clientResource,
        timestamp: Date.now(),
        requestId: `group-sync-${Date.now()}`,
        protocolVersion: 1,
      },
      org: orgName,
      app: appName,
      username: context.userId,
      lastSyncTime: 0,
    };
  }
}
