import type { INamespace, Type } from 'protobufjs/light';
import { Root, configure, util } from 'protobufjs/light';
import Long from 'long';

import sessionListProtoJson from './proto';
import type {
  SessionListDecodedMessage,
  SessionListErrorDetail,
  SessionListGatewayHeader,
  SessionListJid,
  SessionListMeta,
  SessionListProtocolItem,
  SessionListRequest,
  SessionListResponse,
} from './types';
import { SessionListMessageType } from './types';

let cachedRoot: Root | null = null;
let longConfigured = false;

const ensureLongConfigured = (): void => {
  if (longConfigured) {
    return;
  }
  util.Long = Long;
  configure();
  longConfigured = true;
};

const getRoot = (): Root => {
  if (cachedRoot) {
    return cachedRoot;
  }
  ensureLongConfigured();
  cachedRoot = Root.fromJSON(sessionListProtoJson as INamespace);
  return cachedRoot;
};

const lookupType = (name: string): Type => {
  return getRoot().lookupType(name);
};

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  if (typeof value === 'bigint') {
    return Number(value);
  }
  if (
    value &&
    typeof value === 'object' &&
    'toString' in value &&
    typeof (value as { toString: () => string }).toString === 'function'
  ) {
    const parsed = Number((value as { toString: () => string }).toString());
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const normalizeHeader = (value: unknown): SessionListGatewayHeader | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  return {
    resource: typeof record.resource === 'string' ? record.resource : '',
    timestamp: toNumber(record.timestamp) ?? 0,
    requestId:
      typeof record.request_id === 'string'
        ? record.request_id
        : typeof record.requestId === 'string'
          ? record.requestId
          : '',
    protocolVersion:
      toNumber(record.protocol_version) ?? toNumber(record.protocolVersion) ?? 0,
  };
};

const normalizeJid = (value: unknown): SessionListJid | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  return {
    appKey:
      typeof record.app_key === 'string'
        ? record.app_key
        : typeof record.appKey === 'string'
          ? record.appKey
          : undefined,
    name: typeof record.name === 'string' ? record.name : undefined,
    domain: typeof record.domain === 'string' ? record.domain : undefined,
    clientResource:
      typeof record.client_resource === 'string'
        ? record.client_resource
        : typeof record.clientResource === 'string'
          ? record.clientResource
          : undefined,
  };
};

const normalizeMeta = (value: unknown): SessionListMeta | undefined => {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  return {
    id:
      typeof record.id === 'string'
        ? record.id
        : toNumber(record.id) !== undefined
          ? String(toNumber(record.id))
          : undefined,
    from: normalizeJid(record.from),
    timestamp: toNumber(record.timestamp),
    payload:
      record.payload instanceof Uint8Array
        ? record.payload
        : Array.isArray(record.payload)
          ? Uint8Array.from(record.payload.filter(item => typeof item === 'number'))
          : undefined,
  };
};

const normalizeProtocolItem = (value: unknown): SessionListProtocolItem => {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    session_id: typeof record.session_id === 'string' ? record.session_id : undefined,
    session_type: toNumber(record.session_type),
    last_message: normalizeMeta(record.last_message),
    updated_at: toNumber(record.updated_at),
    pinned_time: toNumber(record.pinned_time),
    unread_count: toNumber(record.unread_count),
    marks: Array.isArray(record.marks)
      ? record.marks.filter(item => typeof item === 'string')
      : undefined,
    read_receipt: toNumber(record.read_receipt),
    remind_type: toNumber(record.remind_type),
    group_name: typeof record.group_name === 'string' ? record.group_name : undefined,
    group_avatar: typeof record.group_avatar === 'string' ? record.group_avatar : undefined,
    metadata: typeof record.metadata === 'string' ? record.metadata : undefined,
  };
};

export class SessionListCodec {
  private readonly requestType = lookupType('easemob.sessionlist.GetSessionListRequest');
  private readonly responseType = lookupType('easemob.sessionlist.GetSessionListResponse');
  private readonly errorType = lookupType('easemob.sessionlist.ErrorDetail');

  public encodeRequest(payload: SessionListRequest): Uint8Array {
    const message = this.requestType.create({
      type: payload.type,
      header: payload.header
        ? {
            resource: payload.header.resource,
            timestamp: payload.header.timestamp,
            request_id: payload.header.requestId,
            protocol_version: payload.header.protocolVersion,
          }
        : undefined,
      org: payload.org,
      app: payload.app,
      username: payload.username,
      last_sync_time: payload.lastSyncTime ?? 0,
      need_empty_session: payload.includeEmpty ?? false,
      need_session_mark: payload.includeMark ?? true,
    });
    return this.requestType.encode(message).finish();
  }

  public decode(payload: Uint8Array): SessionListDecodedMessage {
    const decodedError = this.tryDecodeError(payload);
    if (decodedError) {
      return decodedError;
    }

    const decodedResponse = this.tryDecodeResponse(payload);
    if (decodedResponse) {
      return decodedResponse;
    }

    const decodedRequest = this.tryDecodeRequest(payload);
    if (decodedRequest) {
      return decodedRequest;
    }

    return { type: SessionListMessageType.UNSPECIFIED };
  }

  private tryDecodeRequest(payload: Uint8Array): SessionListRequest | null {
    try {
      const decoded = this.requestType.toObject(this.requestType.decode(payload), {
        longs: String,
        bytes: Uint8Array,
      }) as Record<string, unknown>;
      const type = toNumber(decoded.type);
      if (type !== SessionListMessageType.GET_SESSION_LIST_REQUEST) {
        return null;
      }
      return {
        type,
        header: normalizeHeader(decoded.header),
        org: typeof decoded.org === 'string' ? decoded.org : '',
        app: typeof decoded.app === 'string' ? decoded.app : '',
        username: typeof decoded.username === 'string' ? decoded.username : '',
        lastSyncTime: toNumber(decoded.last_sync_time) ?? 0,
        includeEmpty: decoded.need_empty_session === true,
        includeMark: decoded.need_session_mark === true,
      };
    } catch {
      return null;
    }
  }

  private tryDecodeResponse(payload: Uint8Array): SessionListResponse | null {
    try {
      const decoded = this.responseType.toObject(this.responseType.decode(payload), {
        longs: String,
        bytes: Uint8Array,
      }) as Record<string, unknown>;
      const type = toNumber(decoded.type);
      if (type !== SessionListMessageType.GET_SESSION_LIST_RESPONSE) {
        return null;
      }
      return {
        type,
        header: normalizeHeader(decoded.header),
        sessions: Array.isArray(decoded.sessions)
          ? decoded.sessions.map(item => normalizeProtocolItem(item))
          : [],
        isLastBatch: decoded.is_last_batch === true,
        lastSyncFinishedTs: toNumber(decoded.last_sync_finished_ts),
      };
    } catch {
      return null;
    }
  }

  private tryDecodeError(payload: Uint8Array): SessionListErrorDetail | null {
    try {
      const decoded = this.errorType.toObject(this.errorType.decode(payload), {
        longs: String,
        bytes: Uint8Array,
      }) as Record<string, unknown>;
      const type = toNumber(decoded.type);
      if (type !== SessionListMessageType.ERROR) {
        return null;
      }
      return {
        type,
        header: normalizeHeader(decoded.header),
        code: toNumber(decoded.code) ?? 0,
        message: typeof decoded.message === 'string' ? decoded.message : 'Unknown session-list error',
      };
    } catch {
      return null;
    }
  }
}
