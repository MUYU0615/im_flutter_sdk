import type { INamespace, Type } from 'protobufjs/light';
import { Root, configure, util } from 'protobufjs/light';
import Long from 'long';

import joinedGroupsProtoJson from './proto';
import { JoinedGroupsMessageType } from './types';
import type {
  JoinedGroupProtocolItem,
  JoinedGroupsDecodedMessage,
  JoinedGroupsErrorDetail,
  JoinedGroupsGatewayHeader,
  JoinedGroupsRequest,
  JoinedGroupsResponse,
} from './types';

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
  cachedRoot = Root.fromJSON(joinedGroupsProtoJson as INamespace);
  return cachedRoot;
};

const lookupType = (name: string): Type => getRoot().lookupType(name);

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  if (Long.isLong(value)) {
    return value.toNumber();
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

const normalizeHeader = (value: unknown): JoinedGroupsGatewayHeader | undefined => {
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

const normalizeGroupItem = (value: unknown): JoinedGroupProtocolItem => {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  return {
    group_id:
      typeof record.group_id === 'string'
        ? record.group_id
        : typeof record.groupId === 'string'
          ? record.groupId
          : undefined,
    group_name:
      typeof record.group_name === 'string'
        ? record.group_name
        : typeof record.groupName === 'string'
          ? record.groupName
          : undefined,
    group_owner:
      typeof record.group_owner === 'string'
        ? record.group_owner
        : typeof record.groupOwner === 'string'
          ? record.groupOwner
          : undefined,
    members_count: toNumber(record.members_count) ?? toNumber(record.membersCount),
    mute_all:
      typeof record.mute_all === 'boolean'
        ? record.mute_all
        : typeof record.muteAll === 'boolean'
          ? record.muteAll
          : undefined,
    disabled: typeof record.disabled === 'boolean' ? record.disabled : undefined,
    description: typeof record.description === 'string' ? record.description : undefined,
    group_avatar:
      typeof record.group_avatar === 'string'
        ? record.group_avatar
        : typeof record.groupAvatar === 'string'
          ? record.groupAvatar
          : undefined,
    role: toNumber(record.role),
    mute_expiration: toNumber(record.mute_expiration) ?? toNumber(record.muteExpiration),
    remind_type: toNumber(record.remind_type) ?? toNumber(record.remindType),
    create_at: toNumber(record.create_at) ?? toNumber(record.createAt),
    update_at: toNumber(record.update_at) ?? toNumber(record.updateAt),
    joined_timestamp: toNumber(record.joined_timestamp) ?? toNumber(record.joinedTimestamp),
  };
};

export class JoinedGroupsCodec {
  private readonly requestType = lookupType('easemob.joinedgroups.GetJoinedGroupsRequest');
  private readonly responseType = lookupType('easemob.joinedgroups.GetJoinedGroupsResponse');
  private readonly errorType = lookupType('easemob.joinedgroups.ErrorDetail');

  public encodeRequest(payload: JoinedGroupsRequest): Uint8Array {
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
      cursor: payload.cursor,
    });
    return this.requestType.encode(message).finish();
  }

  public decode(payload: Uint8Array): JoinedGroupsDecodedMessage {
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

    return { type: JoinedGroupsMessageType.UNSPECIFIED };
  }

  private tryDecodeRequest(payload: Uint8Array): JoinedGroupsRequest | null {
    try {
      const decoded = this.requestType.toObject(this.requestType.decode(payload), {
        longs: String,
        bytes: Uint8Array,
      }) as Record<string, unknown>;
      const type = toNumber(decoded.type);
      if (type !== JoinedGroupsMessageType.GET_JOINED_GROUPS_REQUEST) {
        return null;
      }
      return {
        type,
        header: normalizeHeader(decoded.header),
        org: typeof decoded.org === 'string' ? decoded.org : '',
        app: typeof decoded.app === 'string' ? decoded.app : '',
        username: typeof decoded.username === 'string' ? decoded.username : '',
        lastSyncTime: toNumber(decoded.last_sync_time) ?? toNumber(decoded.lastSyncTime) ?? 0,
        cursor: typeof decoded.cursor === 'string' ? decoded.cursor : undefined,
      };
    } catch {
      return null;
    }
  }

  private tryDecodeResponse(payload: Uint8Array): JoinedGroupsResponse | null {
    try {
      const decoded = this.responseType.toObject(this.responseType.decode(payload), {
        longs: String,
        bytes: Uint8Array,
      }) as Record<string, unknown>;
      const type = toNumber(decoded.type);
      if (type !== JoinedGroupsMessageType.GET_JOINED_GROUPS_RESPONSE) {
        return null;
      }
      return {
        type,
        header: normalizeHeader(decoded.header),
        groups: Array.isArray(decoded.groups)
          ? decoded.groups.map(item => normalizeGroupItem(item))
          : [],
        isLastBatch: decoded.is_last_batch === true || decoded.isLastBatch === true,
        lastSyncFinishedTs:
          toNumber(decoded.last_sync_finished_ts) ?? toNumber(decoded.lastSyncFinishedTs),
        cursor: typeof decoded.cursor === 'string' ? decoded.cursor : undefined,
      };
    } catch {
      return null;
    }
  }

  private tryDecodeError(payload: Uint8Array): JoinedGroupsErrorDetail | null {
    try {
      const decoded = this.errorType.toObject(this.errorType.decode(payload), {
        longs: String,
        bytes: Uint8Array,
      }) as Record<string, unknown>;
      const type = toNumber(decoded.type);
      if (type !== JoinedGroupsMessageType.ERROR) {
        return null;
      }
      return {
        type,
        header: normalizeHeader(decoded.header),
        code: toNumber(decoded.code) ?? 0,
        message:
          typeof decoded.message === 'string'
            ? decoded.message
            : 'Unknown joined groups sync error',
      };
    } catch {
      return null;
    }
  }
}
