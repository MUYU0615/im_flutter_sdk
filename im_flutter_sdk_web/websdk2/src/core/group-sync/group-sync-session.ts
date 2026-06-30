import { ERROR_CODES } from '../../utils/error-codes';
import { SDKError } from '../../utils/errors';
import { JoinedGroupsMessageType } from '../../protocol/joined-groups/types';
import type { JoinedGroupsResponse } from '../../protocol/joined-groups/types';

export class GroupSyncSession {
  private readonly requestId: string;
  private readonly batches: JoinedGroupsResponse[] = [];
  private latestCursor: string | undefined;
  private done = false;
  private lastSyncFinishedTs: number | undefined;

  public constructor(requestId: string) {
    this.requestId = requestId;
  }

  public getResumeCursor(): string | undefined {
    return this.latestCursor;
  }

  public push(response: JoinedGroupsResponse): { readonly done: boolean } {
    if (response.type !== JoinedGroupsMessageType.GET_JOINED_GROUPS_RESPONSE) {
      return { done: false };
    }
    const responseRequestId = response.header?.requestId;
    if (responseRequestId !== this.requestId) {
      return { done: false };
    }
    if (this.done) {
      throw new SDKError('Joined groups response received after completion', ERROR_CODES.REST_BUSINESS_UNKNOWN, {
        details: {
          stage: 'response_decode',
          requestId: this.requestId,
        },
      });
    }
    this.batches.push(response);
    if (response.cursor) {
      this.latestCursor = response.cursor;
    }
    if (response.isLastBatch) {
      if (typeof response.lastSyncFinishedTs !== 'number') {
        throw new SDKError(
          'Joined groups final batch missing lastSyncFinishedTs',
          ERROR_CODES.REST_BUSINESS_UNKNOWN,
          {
            details: {
              stage: 'completion_meta',
              requestId: this.requestId,
            },
          }
        );
      }
      this.done = true;
      this.lastSyncFinishedTs = response.lastSyncFinishedTs;
    }
    return { done: this.done };
  }

  public buildResult(): {
    readonly batches: ReadonlyArray<JoinedGroupsResponse>;
    readonly lastSyncFinishedTs?: number;
  } {
    return {
      batches: this.batches.map(batch => ({
        ...batch,
        groups: batch.groups.map(item => ({ ...item })),
      })),
      lastSyncFinishedTs: this.lastSyncFinishedTs,
    };
  }
}
