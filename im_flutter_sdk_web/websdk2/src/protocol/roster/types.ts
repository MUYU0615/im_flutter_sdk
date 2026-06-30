/**
 * Roster 协议类型
 */

export const RosterMessageType = {
  UNSPECIFIED: 0,
  PING: 1,
  PONG: 2,
  REQUEST: 3,
  RESPONSE: 4,
  ERROR: 5,
} as const;

export const RosterServerStatus = {
  OK: 0,
  BUSY: 1,
} as const;

export const RosterResponseType = {
  UNSPECIFIED: 0,
  INCREMENTAL: 1,
  FULL: 2,
} as const;

export interface RosterGatewayHeader {
  readonly resource: string;
  readonly timestamp: number;
  readonly requestId: string;
  readonly protocolVersion: number;
}

export interface RosterBaseMessage {
  readonly type: number;
}

export interface RosterPingRequest extends RosterBaseMessage {
  readonly type: typeof RosterMessageType.PING;
}

export interface RosterPongResponse extends RosterBaseMessage {
  readonly type: typeof RosterMessageType.PONG;
  readonly status: number;
}

export interface RosterErrorDetail extends RosterBaseMessage {
  readonly type: typeof RosterMessageType.ERROR;
  readonly header?: RosterGatewayHeader;
  readonly code: string;
  readonly message: string;
}

export type RosterUnknownMessage = RosterBaseMessage;

export interface RosterRequest extends RosterBaseMessage {
  readonly type: typeof RosterMessageType.REQUEST;
  readonly header: RosterGatewayHeader;
  readonly org: string;
  readonly app: string;
  readonly username: string;
  readonly version: string;
  readonly cursor: number;
}

export interface RosterItem {
  readonly contact: string;
  readonly remark: string;
  readonly metadata: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly metadataUpdatedAt: number;
}

export interface RosterResponse extends RosterBaseMessage {
  readonly type: typeof RosterMessageType.RESPONSE;
  readonly header?: RosterGatewayHeader;
  readonly data: ReadonlyArray<RosterItem>;
  readonly cursor: number;
  readonly version: string;
  readonly responseType: number;
}

export type RosterDecodedMessage =
  | RosterPingRequest
  | RosterPongResponse
  | RosterResponse
  | RosterErrorDetail
  | RosterUnknownMessage;

/**
 * Gateway API 错误码常量（4 位 uint32）。
 * 前 2 位为领域（10=common, 11=roster），后 2 位为领域内序号。
 */
export const RosterApiCode = {
  INVALID_REQUEST: 1001,
  UNAUTHORIZED: 1002,
  RATE_LIMIT_EXCEEDED: 1003,
  METHOD_NOT_ALLOWED: 1004,
  INTERNAL_ERROR: 1005,
  INVALID_ROSTER_REQUEST: 1101,
  GET_ROSTER_FAILED: 1102,
} as const;

export type RosterApiCode = (typeof RosterApiCode)[keyof typeof RosterApiCode];
