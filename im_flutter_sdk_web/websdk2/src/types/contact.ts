/**
 * [zh-CN] 联系人自动同步相关公共类型定义，供 ContactManager、事件系统与文档生成复用。
 * [en-US] Public contact sync type definitions reused by ContactManager, the event system, and doc generation.
 */

import type { ErrorCode } from '../utils/error-codes';
import type { UserInfo } from './user-info';

/**
 * [zh-CN] 联系人展示对象。
 * [en-US] Contact view object.
 */
export interface Contact {
  /** [zh-CN] 联系人用户 ID。 [en-US] Contact user id. */
  readonly userId: string;
  /** [zh-CN] 联系人资料视图，直接复用统一 `UserInfo`。 [en-US] Contact user info view backed by the shared `UserInfo` model. */
  readonly userInfo: UserInfo;
  /** [zh-CN] 当前用户给该联系人的备注。 [en-US] Remark set by current user for this contact. */
  readonly remark: string;
  /** [zh-CN] 联系人关系建立时间。 [en-US] Timestamp when the contact relation was created. */
  readonly addTs: number;
}

/**
 * [zh-CN] 好友资料变化事件载荷。
 * [en-US] Event payload of friend profile changes.
 */
export interface ContactInfoUpdatedEvent {
  /** [zh-CN] 最新好友资料。 [en-US] Latest friend profile. */
  readonly userInfo: UserInfo;
  /** [zh-CN] 当前会话中可用的联系人快照。 [en-US] Contact snapshot when available in the current session. */
  readonly contact?: Contact;
}

/**
 * [zh-CN] 联系人写操作的统一目标。
 * [en-US] Shared target object for contact mutation APIs.
 */
export interface ContactMutationTarget {
  /** [zh-CN] 目标用户 ID。 [en-US] Target user id. */
  readonly userId: string;
}

/**
 * [zh-CN] 添加联系人的输入参数。
 * [en-US] Input parameters for adding a contact.
 */
export interface AddContactParams extends ContactMutationTarget {
  /** [zh-CN] 可选的验证消息。 [en-US] Optional invitation message. */
  readonly message?: string;
}

/**
 * [zh-CN] 更新联系人备注的输入参数。
 * [en-US] Input parameters for updating a contact remark.
 */
export interface SetContactRemarkParams extends ContactMutationTarget {
  /** [zh-CN] 联系人备注，允许空字符串以清空备注。 [en-US] Contact remark. Empty string is allowed to clear the remark. */
  readonly remark: string;
}

/**
 * [zh-CN] 黑名单增删接口的输入参数。
 * [en-US] Input parameters for blocklist mutation APIs.
 */
export interface BlocklistMutationParams {
  /** [zh-CN] 待处理的用户 ID 列表。 [en-US] User ids to mutate. */
  readonly userIds: ReadonlyArray<string>;
}

/**
 * [zh-CN] 黑名单添加成功结果。
 * [en-US] Successful result of adding users to the blocklist.
 */
export interface BlocklistAddResult {
  /** [zh-CN] 成功加入黑名单的用户资料列表。 [en-US] User profiles successfully added to the blocklist. */
  readonly succeeded: ReadonlyArray<UserInfo>;
  /** [zh-CN] 加入失败的用户资料列表。 [en-US] User profiles that failed to be added. */
  readonly failed: ReadonlyArray<UserInfo>;
}

/**
 * [zh-CN] 会话级黑名单快照。
 * [en-US] Session-scoped blocklist snapshot.
 */
export interface BlocklistSnapshot {
  /** [zh-CN] 当前黑名单条目列表。 [en-US] Current blocklist entries. */
  readonly items: ReadonlyArray<UserInfo>;
  /** [zh-CN] 当前会话是否已完成过服务端加载。 [en-US] Whether the current session has loaded blocklist data from server. */
  readonly loaded: boolean;
  /** [zh-CN] 快照来源。 [en-US] Snapshot source. */
  readonly source: 'server' | 'mutation_patch';
}

/**
 * [zh-CN] 原工程联系人 roster 事件中的关系类型字段。
 * [en-US] Relation type field used by legacy contact roster events.
 */
export type ContactRosterEventType = 'subscribe' | 'unsubscribed' | 'subscribed';

/**
 * [zh-CN] 原工程联系人 roster 事件的标准化载荷。
 * [en-US] Normalized payload of legacy contact roster events.
 */
export interface ContactRosterEventPayload {
  /** [zh-CN] 原工程事件中的关系类型。 [en-US] Legacy relation type carried by the original event. */
  readonly type: ContactRosterEventType;
  /** [zh-CN] 事件发送方用户 ID。 [en-US] Sender user id of the roster event. */
  readonly from: string;
  /** [zh-CN] 事件接收方用户 ID。 [en-US] Receiver user id of the roster event. */
  readonly to: string;
  /** [zh-CN] 服务端附带的状态/原因字符串。 [en-US] Status or reason string returned by the server. */
  readonly status: string;
  /** [zh-CN] 当前 roster 版本号。 [en-US] Current roster version carried by the event. */
  readonly rosterVersion?: string;
  /** [zh-CN] 事件目标用户的资料视图；对外事件会在派发前补齐，至少包含 `userId`。 [en-US] User info view for the event target. It is enriched before public dispatch and always includes at least `userId`. */
  readonly userInfo: UserInfo;
}

/**
 * [zh-CN] 联系人快照来源。
 * [en-US] Source of a contact snapshot.
 */
export type ContactSyncSource = 'cache' | 'sync';

/**
 * [zh-CN] 联系人同步决策结果。
 * [en-US] Decision result of contact sync.
 */
export type ContactSyncDecision = 'skip' | 'incremental' | 'full';

/**
 * [zh-CN] 联系人同步失败阶段。
 * [en-US] Failure stage of contact sync.
 */
export type ContactSyncStage = 'metadata' | 'socket_connect' | 'sync_page' | 'decode' | 'cancelled';

/**
 * [zh-CN] 联系人快照，包含列表、来源、版本和完整性信息。
 * [en-US] Contact snapshot including list, source, version, and completeness metadata.
 */
export interface ContactSnapshot {
  /** [zh-CN] 当前快照中的联系人列表。 [en-US] Contact list contained in the current snapshot. */
  readonly items: ReadonlyArray<Contact>;
  /** [zh-CN] 当前快照来自缓存还是同步结果。 [en-US] Whether the snapshot comes from cache or sync result. */
  readonly source: ContactSyncSource;
  /** [zh-CN] 当前快照对应的联系人版本号。 [en-US] Contact version associated with the snapshot. */
  readonly version: string;
  /** [zh-CN] 当前快照是否可作为完整联系人结果使用。 [en-US] Whether the snapshot is complete enough to be used as the full contact result. */
  readonly complete: boolean;
}

/**
 * [zh-CN] 联系人同步错误对象。
 * [en-US] Contact sync error object.
 */
export interface ContactSyncError {
  /** [zh-CN] SDK 错误码。 [en-US] SDK error code. */
  readonly code: ErrorCode;
  /** [zh-CN] 错误发生阶段。 [en-US] Stage where the error occurred. */
  readonly stage: ContactSyncStage;
  /** [zh-CN] 面向调用方的错误消息。 [en-US] Caller-facing error message. */
  readonly message: string;
  /** [zh-CN] 当前错误是否建议重试。 [en-US] Whether retry is recommended for this error. */
  readonly retryable: boolean;
}

/**
 * [zh-CN] 联系人同步内部完成载荷；公开同步事件已统一到 ChatClient 级 `onSyncDataFinished`。
 * [en-US] Internal contact sync finish payload; public sync events are unified under ChatClient-level `onSyncDataFinished`.
 */
export interface ContactSyncFinishPayload {
  /** [zh-CN] 失败时返回错误详情。 [en-US] Error details when the sync finishes with an error. */
  readonly error: ContactSyncError;
}
