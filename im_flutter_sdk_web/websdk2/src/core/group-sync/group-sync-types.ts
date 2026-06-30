import type { CacheManager } from '../../cache/cache-manager';
import type { JoinedGroupSnapshot, JoinedGroupSummary } from '../../types/group';
import type { SyncDataError } from '../../types/sync-data';
import type { RestContext } from '../../types/chat-client';
import type { SharedSyncWebSocketSession } from '../sync/shared-sync-websocket-session';

export type GroupSyncStage =
  | 'config'
  | 'socket_connect'
  | 'request_send'
  | 'response_decode'
  | 'batch_merge'
  | 'preview_persist'
  | 'completion_meta'
  | 'auth'
  | 'server_limit'
  | 'cancelled';

export interface GroupSyncControllerDependencies {
  readonly getRestContext: () => RestContext;
  readonly getSyncUrls: () => Promise<ReadonlyArray<string>>;
  readonly getSharedSyncSession: () => SharedSyncWebSocketSession;
  readonly getCacheManager: () => CacheManager;
  readonly getRuntimeSnapshot: () => JoinedGroupSnapshot | null;
  readonly applyRuntimeSnapshot: (snapshot: JoinedGroupSnapshot) => void;
  readonly onStart: () => void;
  readonly onFinish: (payload: {
    readonly status: 'success' | 'failed';
    readonly error?: SyncDataError;
  }) => void;
}

export interface GroupSyncMergeInput {
  readonly existingItems: ReadonlyArray<JoinedGroupSummary>;
  readonly incomingItems: ReadonlyArray<JoinedGroupSummary>;
  readonly lastSyncFinishedTs?: number;
}
