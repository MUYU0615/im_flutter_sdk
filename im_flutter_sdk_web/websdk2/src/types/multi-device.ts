/**
 * [zh-CN] MultiDevice 公开类型定义。
 * [en-US] Public type definitions for ChatClient multi-device events.
 */

import type { ConversationType } from './conversation';

/**
 * [zh-CN] MultiDevice 事件分类。
 * [en-US] MultiDevice event categories.
 */
export const MultiDeviceEventCategory = {
  CONTACT: 'contact',
  GROUP: 'group',
  THREAD: 'thread',
  CONVERSATION: 'conversation',
  MESSAGE_REMOVED: 'messageRemoved',
} as const;

export type MultiDeviceEventCategory =
  (typeof MultiDeviceEventCategory)[keyof typeof MultiDeviceEventCategory];

/**
 * [zh-CN] 联系人类多设备操作。
 * [en-US] Contact multi-device operations.
 */
export const MultiDeviceContactOperation = {
  CONTACT_REMOVE: 'CONTACT_REMOVE',
  CONTACT_ACCEPT: 'CONTACT_ACCEPT',
  CONTACT_DECLINE: 'CONTACT_DECLINE',
  CONTACT_BAN: 'CONTACT_BAN',
  CONTACT_ALLOW: 'CONTACT_ALLOW',
  UNKNOWN: 'UNKNOWN',
} as const;

export type MultiDeviceContactOperation =
  (typeof MultiDeviceContactOperation)[keyof typeof MultiDeviceContactOperation];

/**
 * [zh-CN] 群组类多设备操作。
 * [en-US] Group multi-device operations.
 */
export const MultiDeviceGroupOperation = {
  GROUP_CREATE: 'GROUP_CREATE',
  GROUP_DESTROY: 'GROUP_DESTROY',
  GROUP_JOIN: 'GROUP_JOIN',
  GROUP_LEAVE: 'GROUP_LEAVE',
  GROUP_APPLY: 'GROUP_APPLY',
  GROUP_APPLY_ACCEPT: 'GROUP_APPLY_ACCEPT',
  GROUP_APPLY_DECLINE: 'GROUP_APPLY_DECLINE',
  GROUP_INVITE: 'GROUP_INVITE',
  GROUP_INVITE_ACCEPT: 'GROUP_INVITE_ACCEPT',
  GROUP_INVITE_DECLINE: 'GROUP_INVITE_DECLINE',
  GROUP_KICK: 'GROUP_KICK',
  GROUP_BAN: 'GROUP_BAN',
  GROUP_ALLOW: 'GROUP_ALLOW',
  GROUP_BLOCK: 'GROUP_BLOCK',
  GROUP_UNBLOCK: 'GROUP_UNBLOCK',
  GROUP_ASSIGN_OWNER: 'GROUP_ASSIGN_OWNER',
  GROUP_ADD_ADMIN: 'GROUP_ADD_ADMIN',
  GROUP_REMOVE_ADMIN: 'GROUP_REMOVE_ADMIN',
  GROUP_ADD_MUTE: 'GROUP_ADD_MUTE',
  GROUP_REMOVE_MUTE: 'GROUP_REMOVE_MUTE',
  GROUP_ADD_USER_WHITE_LIST: 'GROUP_ADD_USER_WHITE_LIST',
  GROUP_REMOVE_USER_WHITE_LIST: 'GROUP_REMOVE_USER_WHITE_LIST',
  GROUP_ALL_BAN: 'GROUP_ALL_BAN',
  GROUP_REMOVE_ALL_BAN: 'GROUP_REMOVE_ALL_BAN',
  GROUP_MEMBER_METADATA_CHANGED: 'GROUP_MEMBER_METADATA_CHANGED',
  GROUP_UPDATED: 'GROUP_UPDATED',
  UNKNOWN: 'UNKNOWN',
} as const;

export type MultiDeviceGroupOperation =
  (typeof MultiDeviceGroupOperation)[keyof typeof MultiDeviceGroupOperation];

/**
 * [zh-CN] 子区类多设备操作。
 * [en-US] Chat-thread multi-device operations.
 */
export const MultiDeviceThreadOperation = {
  THREAD_CREATE: 'THREAD_CREATE',
  THREAD_JOIN: 'THREAD_JOIN',
  THREAD_UPDATE: 'THREAD_UPDATE',
  THREAD_LEAVE: 'THREAD_LEAVE',
  THREAD_DESTROY: 'THREAD_DESTROY',
  THREAD_KICK: 'THREAD_KICK',
  UNKNOWN: 'UNKNOWN',
} as const;

export type MultiDeviceThreadOperation =
  (typeof MultiDeviceThreadOperation)[keyof typeof MultiDeviceThreadOperation];

/**
 * [zh-CN] 会话类多设备操作。
 * [en-US] Conversation multi-device operations.
 */
export const MultiDeviceConversationOperation = {
  CONVERSATION_DELETED: 'CONVERSATION_DELETED',
  CONVERSATION_PINNED: 'CONVERSATION_PINNED',
  CONVERSATION_UNPINNED: 'CONVERSATION_UNPINNED',
  CONVERSATION_MARK: 'CONVERSATION_MARK',
  CONVERSATION_MUTE_INFO_CHANGED: 'CONVERSATION_MUTE_INFO_CHANGED',
  UNKNOWN: 'UNKNOWN',
} as const;

export type MultiDeviceConversationOperation =
  (typeof MultiDeviceConversationOperation)[keyof typeof MultiDeviceConversationOperation];

/**
 * [zh-CN] 漫游消息删除类多设备操作。
 * [en-US] Roaming-message-removal multi-device operations.
 */
export const MultiDeviceMessageRemovedOperation = {
  MESSAGE_REMOVED: 'MESSAGE_REMOVED',
  UNKNOWN: 'UNKNOWN',
} as const;

export type MultiDeviceMessageRemovedOperation =
  (typeof MultiDeviceMessageRemovedOperation)[keyof typeof MultiDeviceMessageRemovedOperation];

/**
 * [zh-CN] MultiDevice 公共载荷基类。
 * [en-US] Shared base payload for MultiDevice events.
 */
export interface MultiDeviceEventBase {
  /** [zh-CN] 事件分类。 [en-US] Event category. */
  readonly category: MultiDeviceEventCategory;
  /** [zh-CN] 标准化操作名。 [en-US] Normalized operation name. */
  readonly operation:
    | MultiDeviceContactOperation
    | MultiDeviceGroupOperation
    | MultiDeviceThreadOperation
    | MultiDeviceConversationOperation
    | MultiDeviceMessageRemovedOperation;
  /** [zh-CN] 来源设备 ID。 [en-US] Source device id. */
  readonly deviceId?: string;
  /** [zh-CN] 事件时间戳。 [en-US] Event timestamp. */
  readonly timestamp?: number;
  /** [zh-CN] 原始调试数据。 [en-US] Raw diagnostic data. */
  readonly raw?: Readonly<Record<string, unknown>>;
}

export interface MultiDeviceContactEvent extends MultiDeviceEventBase {
  readonly category: 'contact';
  readonly operation: MultiDeviceContactOperation;
  readonly targetUserId: string;
  readonly rosterVersion?: string;
  readonly ext?: string;
}

export interface MultiDeviceGroupEvent extends MultiDeviceEventBase {
  readonly category: 'group';
  readonly operation: MultiDeviceGroupOperation;
  readonly groupId: string;
  readonly userIds?: ReadonlyArray<string>;
  readonly operatorId?: string;
  readonly groupName?: string;
}

export interface MultiDeviceThreadEvent extends MultiDeviceEventBase {
  readonly category: 'thread';
  readonly operation: MultiDeviceThreadOperation;
  readonly threadId: string;
  readonly parentId?: string;
  readonly userIds?: ReadonlyArray<string>;
  readonly operatorId?: string;
  readonly threadName?: string;
}

export interface MultiDeviceConversationEvent extends MultiDeviceEventBase {
  readonly category: 'conversation';
  readonly operation: MultiDeviceConversationOperation;
  readonly conversationId: string;
  readonly conversationType?: ConversationType;
  readonly mark?: number;
  readonly remindType?: string;
  readonly silentMode?: Readonly<Record<string, unknown>>;
  readonly operatorId?: string;
}

export interface MultiDeviceMessageRemovedEvent extends MultiDeviceEventBase {
  readonly category: 'messageRemoved';
  readonly operation: MultiDeviceMessageRemovedOperation;
  readonly conversationId: string;
  readonly conversationType?: ConversationType;
  readonly messageIds?: ReadonlyArray<string>;
  readonly beforeTimestamp?: number;
}

export type MultiDeviceEvent =
  | MultiDeviceContactEvent
  | MultiDeviceGroupEvent
  | MultiDeviceThreadEvent
  | MultiDeviceConversationEvent
  | MultiDeviceMessageRemovedEvent;

/**
 * [zh-CN] ChatClient 多设备监听器映射。
 * [en-US] ChatClient multi-device handler map.
 */
export interface MultiDeviceEventHandlerMap {
  /** [zh-CN] 联系人多设备事件。 [en-US] Contact multi-device event. */
  readonly onMultiDeviceContact?: (
    event: MultiDeviceContactEvent
  ) => void | Promise<void>;
  /** [zh-CN] 群组多设备事件。 [en-US] Group multi-device event. */
  readonly onMultiDeviceGroup?: (
    event: MultiDeviceGroupEvent
  ) => void | Promise<void>;
  /** [zh-CN] 子区多设备事件。 [en-US] Chat-thread multi-device event. */
  readonly onMultiDeviceThread?: (
    event: MultiDeviceThreadEvent
  ) => void | Promise<void>;
  /** [zh-CN] 会话多设备事件。 [en-US] Conversation multi-device event. */
  readonly onMultiDeviceConversation?: (
    event: MultiDeviceConversationEvent
  ) => void | Promise<void>;
  /** [zh-CN] 漫游消息删除多设备事件。 [en-US] Roaming-message-removal multi-device event. */
  readonly onMultiDeviceMessageRemoved?: (
    event: MultiDeviceMessageRemovedEvent
  ) => void | Promise<void>;
}
