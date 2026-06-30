/**
 * 连接相关类型定义
 */

export const ConnectionStatus = { // 连接状态常量
  DISCONNECTED: 'disconnected', // 已断开
  CONNECTING: 'connecting', // 连接中
  CONNECTED: 'connected', // 已连接
  RECONNECTING: 'reconnecting', // 重连中
  RECONNECT_FAILED: 'reconnectFailed', // 重连失败
} as const; // 常量断言

export type ConnectionStatus = typeof ConnectionStatus[keyof typeof ConnectionStatus]; // 连接状态类型

export const ConnectionEventName = { // 连接事件名称常量
  CONNECTING: 'onConnecting', // 连接中事件
  CONNECTED: 'onConnected', // 连接成功事件
  DISCONNECTED: 'onDisconnected', // 断开事件
  RECONNECT_FAILED: 'onReconnectFailed', // 重连失败事件
  TOKEN_WILL_EXPIRE: 'onTokenWillExpire', // token 即将过期事件
  TOKEN_EXPIRED: 'onTokenExpired', // token 已过期事件
  OFFLINE_MESSAGE_SYNC_START: 'onOfflineMessageSyncStart', // 离线消息同步开始事件
  OFFLINE_MESSAGE_SYNC_FINISH: 'onOfflineMessageSyncFinish', // 离线消息同步完成事件
} as const; // 常量断言

export type ConnectionEventName = typeof ConnectionEventName[keyof typeof ConnectionEventName]; // 连接事件名称类型

/** @internal 内部事件名称常量。 */
export const InternalEventName = { // 内部事件名称常量
  SEND_TIMEOUT: 'onSendTimeout', // 发送超时事件
  GROUP_NOTIFY: 'onGroupNotify', // 群组通知内部事件
  CHATROOM_NOTIFY: 'onChatRoomNotify', // 聊天室通知内部事件
  CHAT_THREAD_NOTIFY: 'onChatThreadNotify',
  USER_INFO_NOTIFY: 'onUserInfoNotify', // 用户资料通知内部事件
  MESSAGE_SENT: '__internal:onMessageSent',
} as const; // 常量断言

export type InternalEventName = typeof InternalEventName[keyof typeof InternalEventName]; // 内部事件名称类型

export const ConnectionEventReason = { // 连接事件原因常量
  LOGIN: 'login', // 登录连接
  RECONNECT: 'reconnect', // 重连触发
  ONLINE: 'online', // 在线恢复
  OFFLINE_RECOVER: 'offline-recover', // 离线恢复
  HEARTBEAT_FAILED: 'heartbeat-failed', // 心跳失败
  SEND_TIMEOUT: 'send-timeout', // 发送超时
  CLOSE: 'close', // 关闭事件
  ERROR: 'error', // 错误事件
  TIMEOUT: 'timeout', // 超时事件
  LIMIT: 'limit', // 达到上限
  OFFLINE: 'offline', // 离线事件
  TOKEN_EXPIRED: 'token-expired', // token 过期断开
} as const; // 常量断言

export type ConnectionEventReason = typeof ConnectionEventReason[keyof typeof ConnectionEventReason]; // 连接事件原因类型

export interface ConnectionEventPayload { // 连接事件载荷
  readonly state: ConnectionStatus; // 连接状态
  readonly reason: ConnectionEventReason; // 触发原因
  readonly attempt: number; // 当前重连次数
  readonly maxAttempts: number; // 最大重连次数
  readonly isLoginPhase: boolean; // 是否登录阶段
  readonly isOnline: boolean; // 是否在线
  readonly errorCode?: number; // 错误码（存在时表示由具体错误触发）
  readonly errorMessage?: string; // 错误消息（存在时表示由具体错误触发）
  readonly timestamp: number; // 事件时间戳
}

export interface SendTimeoutEventPayload { // 发送超时事件载荷
  readonly reason: typeof ConnectionEventReason.SEND_TIMEOUT; // 超时原因
  readonly timestamp: number; // 事件时间戳
}

/**
 * token 生命周期事件不携带 token 或鉴权信息。
 * Token lifecycle events do not include token or authentication data.
 */
export type TokenLifecycleEventPayload = undefined;
