/**
 * IM SDK Web - 类型定义
 *
 * 所有公共类型定义，不使用 namespace，支持自动生成类型声明文件
 */

import type { ConnectionStatus } from './connection'; // 连接状态类型
import type { ChatConversationType } from './message-conversation';
import type { Sender } from './sender';

export * from './chat-client'; // 导出 ChatClient 相关类型
export * from './sync-data';
export * from './connection'; // 导出连接相关类型
export {
  ChatEventName,
  ChatRoomDispatchEventName,
  ContactEventName,
  GroupEventName,
  PresenceEventName,
  UserInfoEventName,
} from './event-system'; // 导出事件名称常量
export type {
  // 导出事件系统类型
  ChatEventHandlerMap, // Chat 事件处理器映射
  ChatEventPayloadMap, // Chat 事件载荷映射
  ContactEventHandlerMap, // 联系人事件处理器映射
  ContactEventPayloadMap, // 联系人事件载荷映射
  ChatRoomDispatchEventName as ChatRoomDispatchEventNameType, // ChatRoom 内部事件名称
  ChatRoomInternalEventHandlerMap, // ChatRoom 内部事件处理器映射
  ChatRoomInternalEventPayloadMap, // ChatRoom 内部事件载荷映射
  ConnectionEventHandlerMap, // 连接事件处理器映射
  ConnectionEventPayloadMap, // 连接事件载荷映射
  EventHandlerId, // 事件处理器 ID
  EventHandlerMap, // 通用事件处理器映射
  EventName, // 统一事件名称
  EventPayloadMap, // 事件载荷映射
  GroupEventHandlerMap, // 群组事件处理器映射
  GroupEventPayloadMap, // 群组事件载荷映射
  UserInfoEventHandlerMap, // 用户资料事件处理器映射
  UserInfoEventPayloadMap, // 用户资料事件载荷映射
} from './event-system'; // 事件系统类型来源
export * from './manager';
export * from './message-create';
export * from './message-conversation';
export * from './chat-manager';
export * from './presence'; // 导出在线状态类型
export * from './push'; // 导出推送类型
export * from './contact'; // 导出联系人类型
export * from './chatroom'; // 导出聊天室类型
export * from './group'; // 导出群组类型
export * from './multi-device'; // 导出 MultiDevice 类型
export * from './user-info'; // 导出用户信息类型
export * from './chat-thread';
export type { Sender } from './sender';

// ============================================================================
// 基础类型
// ============================================================================

/**
 * 消息类型（联合类型，不使用 enum）
 */
export type MessageType =
  | 'text'
  | 'image'
  | 'file'
  | 'voice'
  | 'video'
  | 'location'
  | 'custom'
  | 'cmd'
  | 'combine'; // 消息类型联合定义

/**
 * 图片资源类型
 */
export const ImageType = {
  ORIGINAL: 'original',
  LARGE: 'large',
} as const; // 图片发送语义常量

/**
 * 图片资源类型
 */
export type ImageType = (typeof ImageType)[keyof typeof ImageType]; // original: 原图 large: 大图

/**
 * 流式消息状态常量
 */
export const StreamMessageStatus = {
  START: 'STREAM_START',
  IN_PROGRESS: 'STREAM_IN_PROGRESS',
  COMPLETED: 'STREAM_COMPLETED',
  FULL: 'STREAM_FULL',
  ERROR: 'STREAM_ERROR',
} as const; // 流式状态常量

/**
 * 流式消息状态
 */
export type StreamMessageStatus = (typeof StreamMessageStatus)[keyof typeof StreamMessageStatus]; // 流式消息状态联合类型

/**
 * 消息状态（联合类型，不使用 enum）
 */
export type MessageStatus = 'sending' | 'sent' | 'failed' | 'delivered' | 'read';

/**
 * 消息方向（联合类型，不使用 enum）
 */
export type MessageDirect = 'SEND' | 'RECEIVE';

/**
 * 消息优先级（联合类型，不使用 enum）
 */
export type MessagePriority = 'high' | 'normal' | 'low';

/**
 * [zh-CN] 消息修改信息。
 * [en-US] Message modification information.
 */
export interface MessageModifiedInfo {
  /** [zh-CN] 最后一次修改消息的操作者用户 ID。 [en-US] User ID of the operator who modified the message last time. */
  operatorId: string;
  /** [zh-CN] 消息已被修改的次数。 [en-US] Number of times the message has been modified. */
  operationCount: number;
  /** [zh-CN] 最后一次修改消息的时间戳，单位毫秒。 [en-US] Timestamp of the last message modification in milliseconds. */
  operationTime: number;
}

/**
 * 连接状态（联合类型，不使用 enum）
 * 由 src/types/connection.ts 统一定义
 */

/**
 * 日志级别（联合类型，不使用 enum）
 */
export type LogLevel = 'DEBUG' | 'WARN' | 'ERROR'; // 日志级别收敛，移除 INFO

// ============================================================================
// MessageBody 类型系统
// ============================================================================

/**
 * 小程序/uniapp 本地文件对象
 */
export interface MiniAppFile {
  path: string; // 本地文件路径
  size?: number; // 文件大小（可选）
  name?: string; // 文件名称（可选）
  type?: string; // 文件类型（可选）
}

/**
 * React Native 本地文件对象
 */
export interface ReactNativeFile {
  uri: string; // RN 文件 URI
  size?: number; // 文件大小（可选）
  name?: string; // 文件名称（可选）
  type?: string; // 文件类型（可选）
}

/**
 * 跨端文件对象（H5 File 或小程序/uniapp 文件对象）
 */
export type CompatibleFile = File | MiniAppFile | ReactNativeFile; // 兼容多端文件对象

/**
 * 文本消息体
 */
export interface TextMessageBody {
  content: string; // 消息内容
  targetLanguages?: string[]; // 目标翻译语言列表
  translations?: Record<string, string>; // 翻译内容映射
}

/**
 * 图片消息体
 */
export interface ImageMessageBody {
  localUrl: string; // 本地可用地址；远端消息为空字符串
  filename?: string; // 文件名（发送前自动补全）
  filetype?: string; // 文件类型（发送前自动补全）
  width?: number; // 图片宽度（发送前自动补全）
  height?: number; // 图片高度（发送前自动补全）
  isGif: boolean; // 是否为 GIF
  isOriginalImage: boolean; // 是否按原图语义发送
  originalImageUrl?: string; // 原图地址
  bigImageUrl?: string; // 大图地址
  secret?: string; // 下载密钥（服务端返回）
  fileLength?: number; // 文件大小（字节，服务端返回）
  thumbnailUrl?: string; // 缩略图地址
}

/**
 * 文件消息体
 */
export interface FileMessageBody {
  url?: string; // 文件地址（服务端或本地可用地址）
  filename?: string; // 文件名（发送前自动补全）
  filetype?: string; // 文件类型（发送前自动补全）
  fileSize?: number; // 文件大小（可选）
  fileLength?: number; // 文件大小（字节，服务端返回）
  secret?: string; // 下载密钥（服务端返回）
}

/**
 * 语音消息体
 */
export interface VoiceMessageBody {
  url?: string; // 语音地址（服务端或本地可用地址）
  filename?: string; // 文件名（发送前自动补全）
  filetype?: string; // 文件类型（发送前自动补全）
  duration: number; // 语音时长（秒）
  fileLength?: number; // 文件大小（字节，服务端返回）
  secret?: string; // 下载密钥（服务端返回）
}

/**
 * 视频消息体
 */
export interface VideoMessageBody {
  url?: string; // 视频地址（服务端或本地可用地址）
  filename?: string; // 文件名（发送前自动补全）
  filetype?: string; // 文件类型（发送前自动补全）
  duration: number; // 视频时长（秒）
  width?: number; // 视频宽度（可选）
  height?: number; // 视频高度（可选）
  fileLength?: number; // 文件大小（字节，服务端返回）
  secret?: string; // 下载密钥（服务端返回）
  thumbnailUrl?: string; // 视频缩略图地址（可选）
}

/**
 * 位置消息体
 */
export interface LocationMessageBody {
  latitude: number; // 纬度
  longitude: number; // 经度
  address?: string; // 地址描述（可选）
  buildingName?: string; // 建筑名称（可选）
}

/**
 * 命令消息体
 */
export interface CmdMessageBody {
  action: string; // 命令动作
  params?: Record<string, string>; // 命令参数（仅接收/协议兼容，创建入口不写入）
  deliverOnlineOnly?: boolean; // 是否仅在线投递（可选）
}

/**
 * 自定义消息体
 */
export interface CustomMessageBody {
  event: string; // 自定义事件名称
  params?: Record<string, string>; // 自定义参数（可选）
}

/**
 * 合并消息中的子消息结构
 */
/**
 * 合并消息体
 */
export interface CombineMessageBody {
  title: string; // 合并消息标题
  summary: string; // 合并消息摘要
  compatibleText: string; // 兼容展示文本
  messageList?: ReadonlyArray<Message>; // 详情子消息列表（仅发送或详情解码场景提供）
  url?: string; // 合并载荷下载地址
  filename: string; // 合并载荷文件名
  filetype: string; // 合并载荷文件类型
  fileLength?: number; // 合并载荷文件大小
  secret?: string; // 合并载荷下载密钥
  combineLevel: number; // 当前合并消息层级
}

/**
 * MessageBody 联合类型
 */
export type MessageBody =
  | TextMessageBody // 文本消息体
  | ImageMessageBody // 图片消息体
  | FileMessageBody // 文件消息体
  | VoiceMessageBody // 语音消息体
  | VideoMessageBody // 视频消息体
  | LocationMessageBody // 位置消息体
  | CmdMessageBody // 命令消息体
  | CustomMessageBody // 自定义消息体
  | CombineMessageBody; // 合并消息体

// ============================================================================
// Message 类型
// ============================================================================

/**
 * [zh-CN] 消息对象。
 * [en-US] Message object.
 */
export interface Message {
  /** [zh-CN] 服务端消息 ID。 [en-US] Server message ID. */
  msgServerId: string;
  /** [zh-CN] 本地消息 ID。 [en-US] Local message ID. */
  msgLocalId: string;
  /** [zh-CN] 发送方 userId。 [en-US] Sender user ID. */
  from: string;
  /** [zh-CN] 接收方标识：单聊为对方 userId，群聊为 groupId，聊天室为 chatroomId。 [en-US] Receiver identifier: userId for one-to-one chat, groupId for group chat, and chatroomId for chat room. */
  to: string;
  /** [zh-CN] 发送者资料摘要。 [en-US] Sender profile summary. */
  sender: Sender;
  /** [zh-CN] 会话 ID。 [en-US] Conversation ID. */
  conversationId: string;
  /** [zh-CN] 会话类型。 [en-US] Conversation type. */
  conversationType: ChatConversationType;
  /** [zh-CN] 消息类型。 [en-US] Message type. */
  type: MessageType;
  /** [zh-CN] 消息状态。 [en-US] Message status. */
  status: MessageStatus;
  /** [zh-CN] 消息扩展字段。 [en-US] Message extension payload. */
  ext: Record<string, unknown>;
  /** [zh-CN] 消息时间戳，单位毫秒。 [en-US] Message timestamp in milliseconds. */
  timestamp: number;
  /** [zh-CN] 消息体。 [en-US] Message body. */
  body: MessageBody;
  /** [zh-CN] 消息方向。 [en-US] Message direction. */
  direct?: MessageDirect;
  /** [zh-CN] 是否为在线消息；`false` 表示离线消息。 [en-US] Whether this is an online message; `false` means an offline message. */
  isOnline?: boolean;
  /** [zh-CN] 定向消息接收者列表。 [en-US] Target receiver list for directed messages. */
  receiverList?: string[];
  /** [zh-CN] 是否仅投递给在线用户。 [en-US] Whether to deliver only to online users. */
  deliverOnlineOnly?: boolean;
  /** [zh-CN] 发送消息协议中的 webhookEnv 字段。 [en-US] The webhookEnv field in the sending message protocol. */
  webhookEnv?: string;
  /** [zh-CN] 消息优先级。 [en-US] Message priority. */
  priority?: MessagePriority;
  /** [zh-CN] 是否为广播消息，主要用于聊天室下行语义。 [en-US] Whether this is a broadcast message, mainly for chat-room inbound semantics. */
  isBroadcast?: boolean;
  /** [zh-CN] 内容是否被审核替换。 [en-US] Whether the content was replaced by moderation. */
  isContentReplaced?: boolean;
  /** [zh-CN] 合并消息层级，仅 `type=combine` 时有意义。 [en-US] Combine message level, meaningful only when `type=combine`. */
  combineLevel?: number;
  /** [zh-CN] 流式消息元信息，仅流式消息回调场景提供。 [en-US] Stream message metadata, provided only in stream-message callbacks. */
  stream?: StreamMessageMeta;
  /** [zh-CN] 消息的表情回应列表。 [en-US] Message reaction list. */
  reactions?: MessageReaction[];
  /** [zh-CN] 群消息已读人数。 [en-US] Group message read count. */
  groupReadCount?: number;
  /** [zh-CN] 是否需要群已读回执。 [en-US] Whether group read receipt is requested. */
  needGroupReadReceipt?: boolean;
  /** [zh-CN] 消息修改信息；消息被编辑后返回或下发。 [en-US] Message modification information returned or delivered after the message is edited. */
  modifiedInfo?: MessageModifiedInfo;
}

/**
 * 消息表情回应
 * Message reaction
 */
export interface MessageReaction {
  /** 表情标识。Reaction emoji identifier. */
  reaction: string;
  /** 该表情的回应人数。Count of users who reacted with this emoji. */
  count: number;
  /** 回应的用户 ID 列表。List of user IDs who reacted. */
  userList: string[];
  /** 当前用户是否已添加该表情。Whether the current user has added this reaction. */
  isAddedBySelf?: boolean;
}

/**
 * 合并消息对象
 */
export interface CombineMessage extends Message {
  type: 'combine'; // 合并消息类型
  body: CombineMessageBody; // 合并消息体
  combineLevel: number; // 合并层级
}

/**
 * 流式消息元信息
 */
export interface StreamMessageMeta {
  customType?: string; // 业务自定义流类型
  seq: number; // 分片序号
  status: StreamMessageStatus; // 流式状态
  errorType: number; // 错误码（0 表示无错误）
  finishReason?: number; // 结束原因（可选）
  deltaText: string; // 本片增量文本
  fullText: string; // 当前累计全文
}

/**
 * 流式消息事件
 */
export interface StreamMessage extends Message {
  type: 'text'; // 流式消息按文本语义透出
  body: TextMessageBody; // 文本消息体
  stream: StreamMessageMeta; // 流式元信息（必填）
}

// ============================================================================
// 附件上传与发送选项
// ============================================================================

export interface FileUploadProgress {
  /** [zh-CN] 已上传字节数。 [en-US] Uploaded bytes. */
  loaded: number;
  /** [zh-CN] 总字节数。 [en-US] Total bytes. */
  total?: number;
  /** [zh-CN] 上传进度百分比。 [en-US] Upload progress percentage. */
  percent?: number;
}

/**
 * [zh-CN] 文件上传完成结果。
 * [en-US] File upload completion result.
 */
export interface FileUploadResult {
  /** [zh-CN] 文件远程地址。 [en-US] Remote file URL. */
  url?: string;
  /** [zh-CN] 是否按原图语义上传。 [en-US] Whether the upload uses original-image semantics. */
  isOriginalImage?: boolean;
  /** [zh-CN] 原图地址。 [en-US] Original image URL. */
  originalImageUrl?: string;
  /** [zh-CN] 大图地址。 [en-US] Large image URL. */
  bigImageUrl?: string;
  /** [zh-CN] 下载密钥。 [en-US] Download secret. */
  secret?: string;
  /** [zh-CN] 文件大小，单位字节。 [en-US] File size in bytes. */
  fileLength?: number;
  /** [zh-CN] 文件 MIME 类型。 [en-US] File MIME type. */
  filetype?: string;
  /** [zh-CN] 文件名。 [en-US] Filename. */
  filename?: string;
  /** [zh-CN] 缩略图地址。 [en-US] Thumbnail URL. */
  thumbnailUrl?: string;
  /** [zh-CN] 图片或视频宽度，单位像素。 [en-US] Image or video width in pixels. */
  width?: number;
  /** [zh-CN] 图片或视频高度，单位像素。 [en-US] Image or video height in pixels. */
  height?: number;
}

/**
 * [zh-CN] 发送消息的可选回调。
 * [en-US] Optional callbacks for sending a message.
 */
export interface SendMessageOptions {
  /** [zh-CN] 消息开始发送时触发。 [en-US] Called when the message starts sending. */
  onSending?: (message: Message) => void;
  /** [zh-CN] 消息发送成功时触发。 [en-US] Called when the message is sent successfully. */
  onSuccess?: (message: Message) => void;
  /** [zh-CN] 消息发送失败时触发。 [en-US] Called when sending fails. */
  onFailed?: (message: Message, error: Error) => void;
  /** [zh-CN] 附件上传进度回调。 [en-US] Attachment upload progress callback. */
  onFileUploadProgress?: (progress: FileUploadProgress) => void;
  /** [zh-CN] 附件上传完成回调。 [en-US] Attachment upload completion callback. */
  onFileUploadComplete?: (result: FileUploadResult) => void;
  /** [zh-CN] 附件上传失败回调。 [en-US] Attachment upload failure callback. */
  onFileUploadError?: (error: Error) => void;
  /** [zh-CN] 附件上传取消回调。 [en-US] Attachment upload cancellation callback. */
  onFileUploadCanceled?: () => void;
}

/**
 * [zh-CN] 下载并解析合并消息的最小参数，通常来自合并消息体中的 `url` 与 `secret`。
 * [en-US] Minimal parameters for downloading and parsing a combine message, usually taken from `url` and `secret` in the combine message body.
 */
export interface DownloadCombineMessageParams {
  /** [zh-CN] 合并消息详情下载地址。 [en-US] Download URL for the combine message detail payload. */
  url: string;
  /** [zh-CN] 下载密钥；服务端未下发时可不传。 [en-US] Download secret; omit it when the server does not provide one. */
  secret?: string;
  /** [zh-CN] 下载超时，单位毫秒；不传时使用 SDK 默认值。 [en-US] Download timeout in milliseconds; omitted to use the SDK default. */
  timeoutMs?: number;
  /** [zh-CN] 单次允许解码的最大消息条数；不传时默认最多 300 条。 [en-US] Maximum number of messages to decode in one request; omitted to use the default limit of 300. */
  maxItems?: number;
}

// ============================================================================
// Connection 类型
// ============================================================================

/**
 * 连接对象（内存对象，不持久化）
 */
export interface Connection {
  status: ConnectionStatus; // 连接状态
  serverUrl: string; // 服务器地址
  userId?: string; // 当前用户ID
  token?: string; // 认证令牌
  lastConnectedAt?: number; // 最后连接成功时间
  reconnectAttempts: number; // 重连尝试次数
  error?: Error; // 连接错误信息
}

// ============================================================================
// 类型守卫函数
// ============================================================================

/**
 * 类型守卫：判断是否为文本消息体
 */
export function isTextMessageBody(body: MessageBody): body is TextMessageBody {
  return 'content' in body;
}

/**
 * 类型守卫：判断是否为图片消息体
 */
export function isImageMessageBody(body: MessageBody): body is ImageMessageBody {
  return 'width' in body && 'height' in body && 'isGif' in body;
}

/**
 * 类型守卫：判断是否为文件消息体
 */
export function isFileMessageBody(body: MessageBody): body is FileMessageBody {
  return 'filename' in body && 'filetype' in body && !('duration' in body) && !('width' in body);
}

/**
 * 类型守卫：判断是否为语音消息体
 */
export function isVoiceMessageBody(body: MessageBody): body is VoiceMessageBody {
  return 'duration' in body && !('width' in body) && !('height' in body);
}

/**
 * 类型守卫：判断是否为视频消息体
 */
export function isVideoMessageBody(body: MessageBody): body is VideoMessageBody {
  return 'duration' in body && ('thumbnailUrl' in body || 'width' in body || 'height' in body);
}

/**
 * 类型守卫：判断是否为位置消息体
 */
export function isLocationMessageBody(body: MessageBody): body is LocationMessageBody {
  return 'latitude' in body && 'longitude' in body;
}

/**
 * 类型守卫：判断是否为命令消息体
 */
export function isCmdMessageBody(body: MessageBody): body is CmdMessageBody {
  return 'action' in body;
}

/**
 * 类型守卫：判断是否为自定义消息体
 */
export function isCustomMessageBody(body: MessageBody): body is CustomMessageBody {
  return 'event' in body;
}

/**
 * 类型守卫：判断是否为合并消息体
 */
export function isCombineMessageBody(body: MessageBody): body is CombineMessageBody {
  return 'combineLevel' in body && 'compatibleText' in body;
}

/**
 * 类型守卫：判断是否为流式消息
 */
export function isStreamMessage(message: Message): message is StreamMessage {
  return typeof message.stream === 'object' && message.stream !== null;
}
