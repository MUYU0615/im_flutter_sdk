/**
 * 联系人同步分页会话
 */

import { ERROR_CODES } from '../../utils/error-codes';
import { SDKError } from '../../utils/errors';
import { RosterResponseType } from '../../protocol/roster/types';
import type { RosterResponse } from '../../protocol/roster/types';

export class RosterSyncSession {
  private readonly requestId: string;
  private readonly pages: RosterResponse[] = [];
  private responseType: number | null = null;
  private version = '';
  private nextCursor = 0;
  private pageCount = 0;
  private completed = false;

  public constructor(requestId: string) {
    this.requestId = requestId;
  }

  public push(page: RosterResponse): {
    readonly done: boolean;
    readonly nextCursor: number;
    readonly pageCount: number;
  } {
    const responseRequestId = page.header?.requestId;
    if (responseRequestId && responseRequestId !== this.requestId) {
      throw new SDKError('Roster response requestId mismatched', ERROR_CODES.CONTACT_SYNC_PROTO_DECODE_FAILED, {
        details: {
          stage: 'response_decode',
          expectedRequestId: this.requestId,
          receivedRequestId: responseRequestId,
        },
      });
    }

    if (this.completed) {
      throw new SDKError(
        'Roster response received after completion',
        ERROR_CODES.CONTACT_SYNC_CURSOR_INVALID,
        {
          details: {
            cursor: page.cursor,
          },
        }
      );
    }

    if (this.responseType !== null && this.responseType !== page.responseType) {
      throw new SDKError(
        'Roster response type changed in same session',
        ERROR_CODES.CONTACT_SYNC_CURSOR_INVALID,
        {
          details: {
            expected: this.responseType,
            received: page.responseType,
          },
        }
      );
    }

    if (
      this.pages.length > 0 &&
      page.cursor !== 0 &&
      page.cursor === this.pages[this.pages.length - 1]?.cursor
    ) {
      throw new SDKError('Roster cursor duplicated', ERROR_CODES.CONTACT_SYNC_CURSOR_INVALID, {
        details: {
          cursor: page.cursor,
        },
      });
    }

    this.responseType = page.responseType;
    this.version = page.version || this.version;
    this.pages.push(page);
    this.nextCursor = page.cursor;
    this.pageCount += 1;
    this.completed = page.cursor === 0;
    return {
      done: this.completed,
      nextCursor: this.nextCursor,
      pageCount: this.pageCount,
    };
  }

  public getNextCursor(): number {
    return this.nextCursor;
  }

  public getPageCount(): number {
    return this.pageCount;
  }

  public hasPages(): boolean {
    return this.pages.length > 0;
  }

  public isCompleted(): boolean {
    return this.completed;
  }

  public buildResult(): {
    readonly mode: 'full' | 'incremental';
    readonly version: string;
    readonly pages: ReadonlyArray<RosterResponse>;
  } {
    return {
      mode: this.responseType === RosterResponseType.FULL ? 'full' : 'incremental',
      version: this.version,
      pages: this.pages,
    };
  }
}
