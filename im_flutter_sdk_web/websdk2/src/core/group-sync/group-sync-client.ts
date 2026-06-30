import { AuthenticationError, SDKError } from '../../utils/errors';
import { ERROR_CODES } from '../../utils/error-codes';
import { JoinedGroupsCodec } from '../../protocol/joined-groups/codec';
import { JoinedGroupsMessageType } from '../../protocol/joined-groups/types';
import type { SharedSyncWebSocketSession } from '../sync/shared-sync-websocket-session';
import { GroupSyncSession } from './group-sync-session';
import type {
  JoinedGroupsDecodedMessage,
  JoinedGroupsErrorDetail,
  JoinedGroupsRequest,
  JoinedGroupsResponse,
} from '../../protocol/joined-groups/types';

const isJoinedGroupsResponse = (
  payload: JoinedGroupsDecodedMessage
): payload is JoinedGroupsResponse => {
  return payload.type === JoinedGroupsMessageType.GET_JOINED_GROUPS_RESPONSE;
};

const isJoinedGroupsError = (
  payload: JoinedGroupsDecodedMessage
): payload is JoinedGroupsErrorDetail => {
  return payload.type === JoinedGroupsMessageType.ERROR;
};

export const mapJoinedGroupsApiError = (detail: JoinedGroupsErrorDetail): SDKError => {
  const base = (stage: string, retryable: boolean): {
    readonly stage: string;
    readonly serverCode: number;
    readonly requestId?: string;
    readonly retryable: boolean;
  } => ({
    stage,
    serverCode: detail.code,
    requestId: detail.header?.requestId,
    retryable,
  });
  switch (detail.code) {
    case 1601:
      return new SDKError(detail.message, ERROR_CODES.VALIDATION_REQUIRED, {
        details: base('request_send', false),
      });
    case 1602:
      return new SDKError(detail.message, ERROR_CODES.REST_BUSINESS_UNKNOWN, {
        details: base('batch_merge', true),
      });
    case 1002:
      return new AuthenticationError(detail.message, {
        code: ERROR_CODES.AUTH_UNAUTHORIZED,
        details: base('auth', false),
      });
    case 1003:
      return new SDKError(detail.message, ERROR_CODES.SERVICE_LIMIT_EXCEEDED, {
        details: base('server_limit', true),
      });
    default:
      return new SDKError(detail.message, ERROR_CODES.REST_BUSINESS_UNKNOWN, {
        details: base('response_decode', true),
      });
  }
};

export class GroupSyncClient {
  private readonly codec = new JoinedGroupsCodec();
  private readonly sharedSession: SharedSyncWebSocketSession;

  public constructor(sharedSession: SharedSyncWebSocketSession) {
    this.sharedSession = sharedSession;
  }

  public async sync(options: {
    readonly urls: ReadonlyArray<string>;
    readonly request: JoinedGroupsRequest;
  }): Promise<{
    readonly batches: ReadonlyArray<JoinedGroupsResponse>;
    readonly lastSyncFinishedTs?: number;
  }> {
    const requestId = options.request.header?.requestId ?? `group-sync-${Date.now()}`;
    const session = new GroupSyncSession(requestId);
    return await this.syncWithSharedSession(options.request, requestId, session);
  }

  public cancel(): void {
    this.sharedSession.cancel('group-sync-cancelled');
  }

  private async syncWithSharedSession(
    request: JoinedGroupsRequest,
    requestId: string,
    session: GroupSyncSession
  ): Promise<{
    readonly batches: ReadonlyArray<JoinedGroupsResponse>;
    readonly lastSyncFinishedTs?: number;
  }> {
    return await this.sharedSession.request<JoinedGroupsDecodedMessage, {
      readonly batches: ReadonlyArray<JoinedGroupsResponse>;
      readonly lastSyncFinishedTs?: number;
    }>({
      dataType: 'group',
      label: 'Group sync',
      requestId,
      encode: () => {
        return this.codec.encodeRequest(
          this.buildAttemptRequest(request, requestId, session.getResumeCursor())
        );
      },
      decode: payload => {
        const decoded = this.codec.decode(payload);
        return {
          type: decoded.type,
          requestId:
            isJoinedGroupsResponse(decoded) || isJoinedGroupsError(decoded)
              ? decoded.header?.requestId
              : undefined,
          frame: decoded,
        };
      },
      onFrame: decoded => {
        try {
          if (isJoinedGroupsResponse(decoded)) {
            const progress = session.push(decoded);
            if (!progress.done) {
              return;
            }
            return {
              done: true,
              result: session.buildResult(),
            };
          }
          if (isJoinedGroupsError(decoded)) {
            throw mapJoinedGroupsApiError(decoded);
          }
          return;
        } catch (error) {
          throw (
            error instanceof SDKError
              ? error
              : new SDKError(
                  'Joined groups frame decode failed',
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
    baseRequest: JoinedGroupsRequest,
    requestId: string,
    cursor: string | undefined
  ): JoinedGroupsRequest {
    return {
      ...baseRequest,
      cursor,
      lastSyncTime: 0,
      header: {
        resource: baseRequest.header?.resource ?? '',
        timestamp: Date.now(),
        requestId,
        protocolVersion: baseRequest.header?.protocolVersion ?? 1,
      },
    };
  }
}
