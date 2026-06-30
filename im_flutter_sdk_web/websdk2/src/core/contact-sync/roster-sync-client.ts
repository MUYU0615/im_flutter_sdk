/**
 * 联系人同步 websocket 客户端
 */

import { RosterCodec } from '../../protocol/roster/codec';
import { RosterApiCode, RosterMessageType } from '../../protocol/roster/types';
import { ERROR_CODES } from '../../utils/error-codes';
import { AuthenticationError, SDKError } from '../../utils/errors';
import type { SharedSyncWebSocketSession } from '../sync/shared-sync-websocket-session';
import { RosterSyncSession } from './roster-sync-session';
import type {
  RosterDecodedMessage,
  RosterErrorDetail,
  RosterRequest,
  RosterResponse,
} from '../../protocol/roster/types';

/** 将 4 位 API 错误码映射为 SDK 错误 */
const mapRosterApiError = (detail: RosterErrorDetail): SDKError => {
  const requestId = detail.header?.requestId;
  const numericCode = Number.parseInt(detail.code, 10);
  const base = (retryable: boolean): {
    readonly stage: 'sync_page';
    readonly serverCode: string;
    readonly requestId?: string;
    readonly retryable: boolean;
  } => ({
    stage: 'sync_page' as const,
    serverCode: detail.code,
    requestId,
    retryable,
  });

  switch (numericCode) {
    case RosterApiCode.UNAUTHORIZED:
      return new AuthenticationError(detail.message, {
        code: ERROR_CODES.AUTH_UNAUTHORIZED,
        details: base(false),
      });
    case RosterApiCode.RATE_LIMIT_EXCEEDED:
      return new SDKError(detail.message, ERROR_CODES.SERVICE_LIMIT_EXCEEDED, { details: base(true) });
    case RosterApiCode.INVALID_REQUEST:
      return new SDKError(detail.message, ERROR_CODES.VALIDATION_REQUIRED, { details: base(false) });
    case RosterApiCode.METHOD_NOT_ALLOWED:
      return new SDKError(detail.message, ERROR_CODES.VALIDATION_INVALID_FORMAT, { details: base(false) });
    case RosterApiCode.INTERNAL_ERROR:
      return new SDKError(detail.message, ERROR_CODES.REST_BUSINESS_UNKNOWN, { details: base(true) });
    case RosterApiCode.INVALID_ROSTER_REQUEST:
      return new SDKError(detail.message, ERROR_CODES.CONTACT_SYNC_SOCKET_FAILED, { details: base(false) });
    case RosterApiCode.GET_ROSTER_FAILED:
      return new SDKError(detail.message, ERROR_CODES.CONTACT_SYNC_SOCKET_FAILED, { details: base(true) });
    default:
      return new SDKError(detail.message, ERROR_CODES.CONTACT_SYNC_SOCKET_FAILED, { details: base(true) });
  }
};

const isRosterResponse = (payload: RosterDecodedMessage): payload is RosterResponse => {
  return payload.type === RosterMessageType.RESPONSE;
};

const isRosterErrorDetail = (payload: RosterDecodedMessage): payload is RosterErrorDetail => {
  return 'message' in payload && 'code' in payload;
};

export class RosterSyncClient {
  private readonly codec = new RosterCodec();
  private readonly sharedSession: SharedSyncWebSocketSession;

  public constructor(sharedSession: SharedSyncWebSocketSession) {
    this.sharedSession = sharedSession;
  }

  public async sync(options: { urls: ReadonlyArray<string>; request: RosterRequest }): Promise<{
    readonly mode: 'full' | 'incremental';
    readonly version: string;
    readonly pages: ReadonlyArray<import('../../protocol/roster/types').RosterResponse>;
  }> {
    const session = new RosterSyncSession(options.request.header.requestId);
    return await this.syncWithSharedSession(options.request, session);
  }

  public cancel(): void {
    this.sharedSession.cancel('contact-sync-cancelled');
  }

  private async syncWithSharedSession(
    request: RosterRequest,
    session: RosterSyncSession
  ): Promise<{
    readonly mode: 'full' | 'incremental';
    readonly version: string;
    readonly pages: ReadonlyArray<import('../../protocol/roster/types').RosterResponse>;
  }> {
    return await this.sharedSession.request<RosterDecodedMessage, {
      readonly mode: 'full' | 'incremental';
      readonly version: string;
      readonly pages: ReadonlyArray<import('../../protocol/roster/types').RosterResponse>;
    }>({
      dataType: 'contact',
      label: 'Roster sync',
      requestId: request.header.requestId,
      encode: () => {
        const nextRequest = this.buildAttemptRequest(request, session.getNextCursor());
        return this.codec.encodeRequest(nextRequest);
      },
      decode: payload => {
        const decoded = this.codec.decode(payload);
        return {
          type: decoded.type,
          requestId:
            isRosterResponse(decoded) || isRosterErrorDetail(decoded)
              ? decoded.header?.requestId
              : undefined,
          frame: decoded,
        };
      },
      onFrame: (decoded, socket) => {
        try {
          if (decoded.type === RosterMessageType.PING) {
            socket.send(this.codec.encodePong());
            return;
          }
          if (isRosterResponse(decoded)) {
            const progress = session.push(decoded);
            if (!progress.done) {
              return;
            }
            return {
              done: true,
              result: session.buildResult(),
            };
          }
          if (isRosterErrorDetail(decoded)) {
            throw mapRosterApiError(decoded);
          }
          return;
        } catch (error) {
          throw (
            error instanceof SDKError
              ? error
              : new SDKError(
                  'Roster frame decode failed',
                  ERROR_CODES.CONTACT_SYNC_PROTO_DECODE_FAILED,
                  {
                    details: {
                      stage: 'response_decode',
                      cause: error instanceof Error ? error.message : String(error),
                    },
                  }
                )
          );
        }
      },
    });
  }

  private buildAttemptRequest(
    baseRequest: RosterRequest,
    cursor: number
  ): RosterRequest {
    return {
      ...baseRequest,
      cursor,
      header: {
        ...baseRequest.header,
        timestamp: Date.now(),
        requestId: baseRequest.header.requestId,
      },
    };
  }
}
