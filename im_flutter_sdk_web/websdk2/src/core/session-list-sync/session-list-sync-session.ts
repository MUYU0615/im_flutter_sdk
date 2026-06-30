import { ERROR_CODES } from '../../utils/error-codes';
import { SDKError } from '../../utils/errors';
import { generateMsgLocalId } from '../../utils/message-id';
import type {
  SessionListSyncBatchEnvelope,
  SessionListSyncSnapshot,
  SessionListSyncStatus,
} from './session-list-sync-types';

const buildBatchKey = (requestId: string, batchSequence: number): string => {
  return `${requestId}:${batchSequence}`;
};

export class SessionListSyncSession {
  private readonly requestId: string;
  private readonly startedAt: number;
  private status: SessionListSyncStatus = 'idle';
  // 035：按 request_id + batch 去重，避免重复批次把快照重复写入本地。
  private readonly seenBatchKeys = new Set<string>();
  // 035：暂存本轮同步收到的所有批次，用于在成功闭环后构建完整快照视图。
  private readonly items: SessionListSyncBatchEnvelope['sessions'][] = [];
  private finishedAt?: number;

  public constructor(requestId = `session-list-${generateMsgLocalId()}`) {
    this.requestId = requestId;
    this.startedAt = Date.now();
  }

  public getRequestId(): string {
    return this.requestId;
  }

  public getStartedAt(): number {
    return this.startedAt;
  }

  public start(): void {
    if (this.status !== 'idle') {
      return;
    }
    this.status = 'connecting';
  }

  public markSyncing(): void {
    if (this.status === 'completed' || this.status === 'failed' || this.status === 'cancelled') {
      throw new SDKError(
        'Session-list sync session cannot re-enter syncing state after completion',
        ERROR_CODES.CONTACT_SYNC_CURSOR_INVALID
      );
    }
    this.status = 'syncing';
  }

  public pushBatch(batch: SessionListSyncBatchEnvelope): {
    readonly accepted: boolean;
    readonly done: boolean;
  } {
    if (batch.requestId !== this.requestId) {
      throw new SDKError('Session-list sync requestId mismatch', ERROR_CODES.CONTACT_SYNC_CURSOR_INVALID, {
        details: {
          expected: this.requestId,
          received: batch.requestId,
        },
      });
    }
    if (this.isTerminal()) {
      throw new SDKError('Session-list sync batch received after terminal state', ERROR_CODES.CONTACT_SYNC_CURSOR_INVALID, {
        details: {
          requestId: batch.requestId,
          status: this.status,
        },
      });
    }

    const batchKey = buildBatchKey(batch.requestId, batch.batchSequence);
    if (this.seenBatchKeys.has(batchKey)) {
      // 035：重复包直接丢弃，但若它本身标记为最后一批，调用方仍可据此判断本轮是否已到终态。
      return {
        accepted: false,
        done: batch.isLastBatch,
      };
    }

    this.markSyncing();
    this.seenBatchKeys.add(batchKey);
    this.items.push(batch.sessions);
    if (batch.isLastBatch) {
      this.status = 'completed';
      this.finishedAt = Date.now();
    }
    return {
      accepted: true,
      done: batch.isLastBatch,
    };
  }

  public fail(): void {
    this.status = 'failed';
    this.finishedAt = Date.now();
  }

  public cancel(): void {
    this.status = 'cancelled';
    this.finishedAt = Date.now();
  }

  public getItems(): ReadonlyArray<SessionListSyncBatchEnvelope['sessions'][number]> {
    return this.items.flat();
  }

  public getBatchCount(): number {
    return this.items.length;
  }

  public getStatus(): SessionListSyncStatus {
    return this.status;
  }

  public buildSnapshot(): SessionListSyncSnapshot {
    return {
      requestId: this.requestId,
      status: this.status,
      pageCount: this.items.length,
      startedAt: this.startedAt,
      finishedAt: this.finishedAt,
      seenBatchKeys: [...this.seenBatchKeys],
    };
  }

  private isTerminal(): boolean {
    return this.status === 'completed' || this.status === 'failed' || this.status === 'cancelled';
  }
}
