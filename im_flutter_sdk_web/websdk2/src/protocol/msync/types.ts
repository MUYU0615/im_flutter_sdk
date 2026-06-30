/**
 * MSync 常量定义
 */

export const MsyncCommand = {
  SYNC: 0,
  UNREAD: 1,
  NOTICE: 2,
  PROVISION: 3,
  LOGOUT: 4,
} as const;

export const MsyncMessageType = {
  NORMAL: 0,
  SINGLECHAT: 1,
  GROUPCHAT: 2,
  CHATROOM: 3,
  READ_ACK: 4,
  DELIVER_ACK: 5,
  RECALL: 6,
  CHANNEL_ACK: 7,
  EDIT: 8,
} as const;

export const ContentType = {
  TEXT: 0,
  IMAGE: 1,
  VIDEO: 2,
  LOCATION: 3,
  VOICE: 4,
  FILE: 5,
  COMMAND: 6,
  CUSTOM: 7,
  COMBINE: 8,
} as const;

export const MsyncStreamStatus = {
  STREAM_START: 0,
  STREAM_IN_PROGRESS: 1,
  STREAM_COMPLETED: 2,
  STREAM_FULL: 3,
} as const;

export const NameSpace = {
  STATISTIC: 0,
  CHAT: 1,
  MUC: 2,
  ROSTER: 3,
  CONFERENCE: 4,
  NOTIFY: 5,
  QUERY: 6,
} as const;

export const RouteType = {
  ROUTE_ALL: 0,
  ROUTE_ONLINE: 1,
  ROUTE_DIRECT: 2,
} as const;

export const EncryptType = {
  ENCRYPT_NONE: 0,
  ENCRYPT_AES_128_CBC: 1,
  ENCRYPT_AES_256_CBC: 2,
} as const;

export const CompressType = {
  COMPRESS_NONE: 0,
  COMPRESS_ZLIB: 1,
  COMPRESS_LZ4: 2,
} as const;

export const ProvisionErrorCode = {
  OK: 0,
  FAIL: 1,
  UNAUTHORIZED: 2,
  MISSING_PARAMETER: 3,
  WRONG_PARAMETER: 4,
  REDIRECT: 5,
  TOKEN_EXPIRED: 6,
  PERMISSION_DENIED: 7,
  NO_ROUTE: 8,
  UNKNOWN_COMMAND: 9,
  PB_PARSER_ERROR: 10,
  BIND_ANOTHER_DEVICE: 11,
  IM_FORBIDDEN: 12,
  TOO_MANY_DEVICES: 13,
  PLATFORM_LIMIT: 14,
  USER_MUTED: 15,
  ENCRYPT_DISABLE: 16,
  ENCRYPT_ENABLE: 17,
  DECRYPT_FAILURE: 18,
  PERMISSION_DENIED_EXTERNAL: 19,
  RESOURCE_CHANGED: 20, // 资源变更
} as const;

export const KeyValueType = {
  BOOL: 1,
  INT: 2,
  UINT: 3,
  LLINT: 4,
  FLOAT: 5,
  DOUBLE: 6,
  STRING: 7,
  JSON_STRING: 8,
} as const;
