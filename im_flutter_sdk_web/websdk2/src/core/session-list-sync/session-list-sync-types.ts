import type { SessionListCapabilityState } from '../../cache/cache-types';
import type { ConversationItem } from '../../types/conversation';

export type SessionListSyncStatus =
  | 'idle'
  | 'connecting'
  | 'syncing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface SessionListSyncBatchEnvelope {
  readonly requestId: string;
  readonly batchSequence: number;
  readonly sessions: ReadonlyArray<ConversationItem>;
  readonly isLastBatch: boolean;
  readonly lastSyncFinishedTs?: number;
}

export interface SessionListSyncSnapshot {
  readonly requestId: string;
  readonly status: SessionListSyncStatus;
  readonly pageCount: number;
  readonly startedAt: number;
  readonly finishedAt?: number;
  readonly seenBatchKeys: ReadonlyArray<string>;
}

export interface SessionListSyncFailureDecision {
  readonly capabilityState?: SessionListCapabilityState;
  readonly shouldUseFallback: boolean;
  readonly shouldRetry?: boolean;
  readonly shouldResetCheckpoint?: boolean;
}
