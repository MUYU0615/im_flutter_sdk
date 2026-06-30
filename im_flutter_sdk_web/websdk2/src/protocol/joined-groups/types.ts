export const JoinedGroupsMessageType = {
  UNSPECIFIED: 0,
  ERROR: 5,
  GET_JOINED_GROUPS_REQUEST: 12,
  GET_JOINED_GROUPS_RESPONSE: 13,
} as const;

export const JoinedGroupProtocolRole = {
  OWNER: 0,
  ADMIN: 1,
  MEMBER: 2,
} as const;

export const JoinedGroupProtocolRemindType = {
  DEFAULT: 0,
  ALL: 1,
  AT: 2,
  NONE: 3,
} as const;

export interface JoinedGroupsGatewayHeader {
  readonly resource: string;
  readonly timestamp: number;
  readonly requestId: string;
  readonly protocolVersion: number;
}

export interface JoinedGroupsRequest {
  readonly type: typeof JoinedGroupsMessageType.GET_JOINED_GROUPS_REQUEST;
  readonly header?: JoinedGroupsGatewayHeader;
  readonly org: string;
  readonly app: string;
  readonly username: string;
  readonly lastSyncTime?: number;
  readonly cursor?: string;
}

export interface JoinedGroupProtocolItem {
  readonly group_id?: string;
  readonly group_name?: string;
  readonly group_owner?: string;
  readonly members_count?: number;
  readonly mute_all?: boolean;
  readonly disabled?: boolean;
  readonly description?: string;
  readonly group_avatar?: string;
  readonly role?: number;
  readonly mute_expiration?: number;
  readonly remind_type?: number;
  readonly create_at?: number;
  readonly update_at?: number;
  readonly joined_timestamp?: number;
}

export interface JoinedGroupsResponse {
  readonly type: typeof JoinedGroupsMessageType.GET_JOINED_GROUPS_RESPONSE;
  readonly header?: JoinedGroupsGatewayHeader;
  readonly groups: ReadonlyArray<JoinedGroupProtocolItem>;
  readonly isLastBatch?: boolean;
  readonly lastSyncFinishedTs?: number;
  readonly cursor?: string;
}

export interface JoinedGroupsErrorDetail {
  readonly type: typeof JoinedGroupsMessageType.ERROR;
  readonly header?: JoinedGroupsGatewayHeader;
  readonly code: number;
  readonly message: string;
}

export type JoinedGroupsDecodedMessage =
  | JoinedGroupsRequest
  | JoinedGroupsResponse
  | JoinedGroupsErrorDetail
  | { readonly type: number };
