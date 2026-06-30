import type { ErrorCode } from '../utils/error-codes';

/**
 * [zh-CN] 登录后自动同步的数据类型。
 * [en-US] Data type synchronized automatically after login.
 */
export type SyncDataType = 'conversation' | 'contact' | 'group';

/**
 * [zh-CN] 同步完成状态。
 * [en-US] Terminal status of a sync round.
 */
export type SyncDataStatus = 'success' | 'failed';

/**
 * [zh-CN] 同步失败阶段。
 * [en-US] Stage where a sync round failed.
 */
export type SyncDataErrorStage =
  | 'config'
  | 'socket_connect'
  | 'metadata'
  | 'request_send'
  | 'sync_page'
  | 'decode'
  | 'response_decode'
  | 'batch_merge'
  | 'preview_persist'
  | 'completion_meta'
  | 'auth'
  | 'server_limit'
  | 'cancelled'
  | 'fallback';

/**
 * [zh-CN] 同步失败详情。
 * [en-US] Diagnostic error details for a sync round.
 */
export interface SyncDataError {
  /** [zh-CN] 同步数据类型。 [en-US] Synchronized data type. */
  readonly dataType: SyncDataType;
  /** [zh-CN] SDK 对外错误码。 [en-US] Public SDK error code. */
  readonly code: ErrorCode;
  /** [zh-CN] 失败阶段。 [en-US] Failure stage. */
  readonly stage: SyncDataErrorStage;
  /** [zh-CN] 错误消息。 [en-US] Error message. */
  readonly message: string;
  /** [zh-CN] 是否建议重试。 [en-US] Whether retrying is recommended. */
  readonly retryable: boolean;
  /** [zh-CN] 服务端原始错误码，仅用于排障。 [en-US] Original service error code for troubleshooting only. */
  readonly serverCode?: number | string;
}

/**
 * [zh-CN] 同步开始事件载荷。
 * [en-US] Payload emitted when a sync round starts.
 */
export interface SyncDataStartPayload {
  /** [zh-CN] 同步数据类型。 [en-US] Synchronized data type. */
  readonly dataType: SyncDataType;
}

/**
 * [zh-CN] 同步完成事件载荷。
 * [en-US] Payload emitted when a sync round finishes.
 */
export interface SyncDataFinishedPayload {
  /** [zh-CN] 同步数据类型。 [en-US] Synchronized data type. */
  readonly dataType: SyncDataType;
  /** [zh-CN] 完成状态。 [en-US] Terminal status. */
  readonly status: SyncDataStatus;
  /** [zh-CN] 失败时的错误详情。 [en-US] Error details when the round failed. */
  readonly error?: SyncDataError;
}
