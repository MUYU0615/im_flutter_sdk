/**
 * 联系人同步内部类型
 */

import type {
  ContactCacheMeta,
  ContactRelationRecord,
  ContactVersionState,
} from '../../cache/cache-types';
import type { ContactSnapshot, ContactSyncDecision, ContactSyncStage } from '../../types/contact';
import type { ContactMetadataVersionResponse } from '../../rest/contact-metadata';
import type { RosterRequest, RosterResponse } from '../../protocol/roster/types';
import type { SharedSyncWebSocketSession } from '../sync/shared-sync-websocket-session';

export interface ContactSyncDecisionResult {
  readonly decision: ContactSyncDecision;
  readonly version: string;
}

export interface ParsedRosterMetadata {
  readonly nickname?: string;
  readonly avatarUrl?: string;
  readonly sign?: string;
  readonly ext?: string;
}

export interface ParsedRosterItem {
  readonly relation: ContactRelationRecord;
  readonly userInfo: {
    readonly userId: string;
    readonly nickname?: string;
    readonly avatarUrl?: string;
    readonly sign?: string;
    readonly ext?: string;
  };
}

export interface ContactSyncContextState {
  readonly cacheMeta: ContactCacheMeta;
  readonly versionState: ContactVersionState;
  readonly cachedSnapshot: ContactSnapshot;
}

export interface ContactSyncFailure {
  readonly code: number;
  readonly stage: ContactSyncStage;
  readonly message: string;
  readonly retryable: boolean;
}

export interface RosterSyncExecutionResult {
  readonly mode: 'full' | 'incremental';
  readonly version: string;
  readonly pages: ReadonlyArray<RosterResponse>;
}

export interface ContactSyncDependencies {
  readonly getContextState: () => ContactSyncContextState;
  readonly queryMetadata: (currentVersion: string) => Promise<ContactMetadataVersionResponse>;
  readonly getSyncUrls: () => Promise<ReadonlyArray<string>>;
  readonly getSharedSyncSession: () => SharedSyncWebSocketSession;
  readonly buildRosterRequest: (options: {
    decision: ContactSyncDecision;
    version: string;
  }) => RosterRequest;
  readonly applySyncResult: (options: {
    mode: 'full' | 'incremental';
    relations: ReadonlyArray<ContactRelationRecord>;
    userInfos: ReadonlyArray<{
      readonly userId: string;
      readonly nickname?: string;
      readonly avatarUrl?: string;
      readonly sign?: string;
      readonly ext?: string;
    }>;
    version: string;
    lastSyncTs: number;
  }) => {
    readonly snapshot: ContactSnapshot;
    readonly changed: boolean;
  };
  readonly onStart: () => void;
  readonly onFinish: (payload?: {
    readonly error: ContactSyncFailure;
  }) => void;
}
