import type { ChatClient } from '../../chat-client';
import type { ConversationItem } from '../../types/conversation';
import { ERROR_CODES } from '../../utils/error-codes';
import {
  AuthenticationError,
  ConnectionError,
  SDKError,
  ValidationError,
} from '../../utils/errors';
import { buildSessionListRequest, toSessionListItems } from '../../protocol/session-list/gateway';
import { SessionListCodec } from '../../protocol/session-list/codec';
import { decodeSessionListPayloadBody } from '../../protocol/session-list/payload-decoder';
import type { SharedSyncMessageResult } from '../sync/shared-sync-websocket-session';
import type {
  SessionListErrorDetail,
  SessionListRequestParams,
  SessionListResponse,
} from '../../protocol/session-list/types';
import type { SessionListSyncSession } from './session-list-sync-session';

const mapSessionListError = (detail: SessionListErrorDetail): SDKError => {
  if (detail.code === 1002) {
    return new AuthenticationError(detail.message, {
      code: ERROR_CODES.AUTH_TOKEN_EXPIRED,
      details: {
        protocol: 'session-list',
        responseCode: detail.code,
      },
    });
  }
  if (detail.code === 1003) {
    return new SDKError(detail.message, ERROR_CODES.SERVER_BUSY, {
      details: {
        protocol: 'session-list',
        responseCode: detail.code,
      },
    });
  }
  if (detail.code === 1501 || detail.code === 1001) {
    return new ValidationError(detail.message, {
      code: ERROR_CODES.SESSION_LIST_REQUEST_INVALID,
      details: {
        protocol: 'session-list',
        responseCode: detail.code,
      },
    });
  }
  if (detail.code === 1503) {
    return new SDKError(detail.message, ERROR_CODES.OPERATION_UNSUPPORTED, {
      details: {
        protocol: 'session-list',
        responseCode: detail.code,
      },
    });
  }
  if (detail.code === 1502) {
    return new SDKError(detail.message, ERROR_CODES.SESSION_LIST_FETCH_FAILED, {
      details: {
        protocol: 'session-list',
        responseCode: detail.code,
      },
    });
  }
  return new SDKError(detail.message, ERROR_CODES.SESSION_LIST_FETCH_FAILED, {
    details: {
      protocol: 'session-list',
      responseCode: detail.code,
    },
  });
};

export const runSessionListSync = async (options: {
  readonly client: ChatClient;
  readonly session: SessionListSyncSession;
  readonly params: SessionListRequestParams;
}): Promise<{
  readonly items: ReadonlyArray<ConversationItem>;
  readonly lastSyncFinishedTs: number;
}> => {
  const cacheManager = options.client.getCacheManager();
  const context = options.client.getRestContext();
  const syncWsUrls = options.client.getSessionListSyncWsUrls();
  if (!cacheManager || syncWsUrls.length === 0) {
    throw new ConnectionError('session-list sync websocket is unavailable', {
      code: ERROR_CODES.SESSION_LIST_SOCKET_FAILED,
      details: {
        protocol: 'session-list',
        stage: 'socket_connect',
      },
    });
  }

  const [org, app] = context.appKey.split('#');
  if (!org || !app) {
    throw new ValidationError('session-list appKey is invalid', {
      code: ERROR_CODES.SESSION_LIST_REQUEST_INVALID,
      details: {
        appKey: context.appKey,
      },
    });
  }

  const checkpoint = cacheManager.loadSessionListCheckpoint();
  const syncMode = checkpoint.sessionsLastSyncTs > 0 ? 'incremental' : 'full';
  const request = buildSessionListRequest({
    requestId: options.session.getRequestId(),
    resource: context.clientResource,
    org,
    app,
    username: context.userId,
    lastSyncTime: checkpoint.sessionsLastSyncTs,
    params: options.params,
  });
  const codec = new SessionListCodec();
  const aggregate: ConversationItem[] = [];
  let batchSequence = 0;
  let lastSyncFinishedTs = checkpoint.sessionsLastSyncTs;

  return await options.client.getSharedSyncWebSocketSession().request<SessionListResponse | SessionListErrorDetail | { readonly type: number }, {
    readonly items: ReadonlyArray<ConversationItem>;
    readonly lastSyncFinishedTs: number;
  }>({
    dataType: 'conversation',
    label: 'session-list-sync',
    requestId: options.session.getRequestId(),
    encode: () => {
      return codec.encodeRequest(request);
    },
    decode: payload => {
      const decoded = codec.decode(payload);
      return {
        type: decoded.type,
        requestId:
          'header' in decoded
            ? decoded.header?.requestId
            : undefined,
        frame: decoded,
      };
    },
    onFrame: async decoded => {
      if (decoded.type === 5 && 'code' in decoded && 'message' in decoded) {
        throw mapSessionListError(decoded);
      }
      if (decoded.type !== 11) {
        throw new SDKError('session-list response type is invalid', ERROR_CODES.SESSION_LIST_PROTO_DECODE_FAILED, {
          details: {
            responseType: decoded.type,
          },
        });
      }

      const response = decoded as SessionListResponse;
      // eslint-disable-next-line no-console -- 临时调试：打印服务端会话列表同步原始数据
      console.log('[SessionListSync] raw server response', JSON.parse(JSON.stringify({
        ...response,
        sessions: response.sessions.map(s => ({
          ...s,
          last_message: s.last_message ? {
            ...s.last_message,
            payload: decodeSessionListPayloadBody(s.last_message.payload),
          } : undefined,
        })),
      })));
      const responseRequestId = response.header?.requestId;
      if (responseRequestId && responseRequestId !== options.session.getRequestId()) {
        return;
      }

      batchSequence += 1;
      const batchItems = toSessionListItems(response, context.userId);
      const pushResult = options.session.pushBatch({
        requestId: options.session.getRequestId(),
        batchSequence,
        sessions: batchItems,
        isLastBatch: response.isLastBatch === true,
        lastSyncFinishedTs: response.lastSyncFinishedTs,
      });
      if (pushResult.accepted) {
        aggregate.push(...batchItems);
        await cacheManager.applySessionListBatch({
          items: syncMode === 'full' ? aggregate : batchItems,
          mode: syncMode,
          isLastBatch: response.isLastBatch === true,
          syncStartedAt: options.session.getStartedAt(),
          checkpoint:
            typeof response.lastSyncFinishedTs === 'number'
              ? {
                  lastSyncTime: response.lastSyncFinishedTs,
                  lastSyncFinishedTs: response.lastSyncFinishedTs,
                  sessionsLastSyncTs: response.lastSyncFinishedTs,
                  lastSuccessfulAt: Date.now(),
                }
              : undefined,
        });
      }
      if (typeof response.lastSyncFinishedTs === 'number') {
        lastSyncFinishedTs = response.lastSyncFinishedTs;
      }
      if (!pushResult.done) {
        return;
      }

      const result: SharedSyncMessageResult<{
        readonly items: ReadonlyArray<ConversationItem>;
        readonly lastSyncFinishedTs: number;
      }> = {
        done: true,
        result: {
          items: aggregate,
          lastSyncFinishedTs,
        },
      };
      return result;
    },
  });
};
