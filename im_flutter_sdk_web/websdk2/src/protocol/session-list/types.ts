import type { SessionListRemindType } from '../../types/conversation';

export const SessionListMessageType = {
  UNSPECIFIED: 0,
  ERROR: 5,
  GET_SESSION_LIST_REQUEST: 10,
  GET_SESSION_LIST_RESPONSE: 11,
} as const;

export const SessionListProtocolSessionType = {
  SINGLE_CHAT: 0,
  GROUP_CHAT: 1,
  CHAT_ROOM: 2,
} as const;

export const SessionListProtocolRemindType = {
  DEFAULT: 0,
  ALL: 1,
  AT: 2,
  NONE: 3,
} as const;

export interface SessionListGatewayHeader {
  readonly resource: string;
  readonly timestamp: number;
  readonly requestId: string;
  readonly protocolVersion: number;
}

export interface SessionListJid {
  readonly appKey?: string;
  readonly name?: string;
  readonly domain?: string;
  readonly clientResource?: string;
}

export interface SessionListMeta {
  readonly id?: string;
  readonly from?: SessionListJid;
  readonly timestamp?: number;
  readonly payload?: Uint8Array;
}

export interface SessionListRequest {
  readonly type: typeof SessionListMessageType.GET_SESSION_LIST_REQUEST;
  readonly header?: SessionListGatewayHeader;
  readonly org: string;
  readonly app: string;
  readonly username: string;
  readonly lastSyncTime?: number;
  readonly includeEmpty?: boolean;
  readonly includeMark?: boolean;
}

export interface SessionListRequestParams {
  readonly includeEmpty?: boolean;
  readonly includeMark?: boolean;
}

export interface SessionListProtocolItem {
  readonly session_id?: string;
  readonly session_type?: number;
  readonly last_message?: SessionListMeta;
  readonly updated_at?: number;
  readonly pinned_time?: number;
  readonly unread_count?: number;
  readonly marks?: ReadonlyArray<string>;
  readonly read_receipt?: number;
  readonly remind_type?: number;
  readonly group_name?: string;
  readonly group_avatar?: string;
  readonly metadata?: string;
  readonly display_source?: string;
}

export interface SessionListResponse {
  readonly type: typeof SessionListMessageType.GET_SESSION_LIST_RESPONSE;
  readonly header?: SessionListGatewayHeader;
  readonly sessions: ReadonlyArray<SessionListProtocolItem>;
  readonly isLastBatch?: boolean;
  readonly lastSyncFinishedTs?: number;
}

export interface SessionListErrorDetail {
  readonly type: typeof SessionListMessageType.ERROR;
  readonly header?: SessionListGatewayHeader;
  readonly code: number;
  readonly message: string;
}

export type SessionListDecodedMessage =
  | SessionListRequest
  | SessionListResponse
  | SessionListErrorDetail
  | { readonly type: number };

export const mapProtocolSessionTypeToPublic = (
  value: number | undefined
): 'singleChat' | 'groupChat' | 'chatRoom' => {
  if (value === SessionListProtocolSessionType.GROUP_CHAT) {
    return 'groupChat';
  }
  if (value === SessionListProtocolSessionType.CHAT_ROOM) {
    return 'chatRoom';
  }
  return 'singleChat';
};

export const mapProtocolRemindTypeToPublic = (
  value: number | undefined
): SessionListRemindType => {
  if (value === SessionListProtocolRemindType.ALL) {
    return 'ALL';
  }
  if (value === SessionListProtocolRemindType.AT) {
    return 'AT';
  }
  if (value === SessionListProtocolRemindType.NONE) {
    return 'NONE';
  }
  return 'DEFAULT';
};
