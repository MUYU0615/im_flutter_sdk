/**
 * MSync 编解码器
 *
 * 负责 provision、消息编码、消息解码的核心流程。
 */

import { getMsyncRoot } from './root';
import { createMsyncContext, type MsyncContextOptions, type MsyncContextState } from './context';
import {
  CompressType,
  ContentType,
  EncryptType,
  MsyncStreamStatus,
  MsyncCommand,
  MsyncMessageType,
  NameSpace,
  ProvisionErrorCode,
  RouteType,
} from './types';
import {
  buildJid,
  decodeKeyValueList,
  encodeKeyValueRecord,
  longToString,
  toNumericId,
} from './utils';
import { logger } from '../../utils/logger'; // 日志工具
import { mapMucOperationToChatRoomEvent } from '../../managers/chatroom/chatroom-event-mapper';
import { mapMucOperationToGroupEvent } from '../../managers/group/group-event-mapper';
import { StreamMessageStatus as StreamStatus } from '../../types'; // 流式状态常量
import type { ContactRosterEventPayload } from '../../types/contact';
import type {
  CmdMessageBody,
  CombineMessageBody,
  CustomMessageBody,
  FileMessageBody,
  ImageMessageBody,
  LocationMessageBody,
  Message,
  MessageBody,
  MessageModifiedInfo,
  MessagePriority,
  TextMessageBody,
  VideoMessageBody,
  VoiceMessageBody,
  StreamMessageMeta,
  StreamMessageStatus,
} from '../../types';
import type { ChatConversationType } from '../../types/chat-manager';
import {
  deriveImageUrls,
  fromProtocolImageType,
  IMAGE_TYPE_ORIGINAL,
  toProtocolImageType,
} from '../../upload/utils';
import {
  getMessageProfileVersionSidecar,
  setMessageProfileVersionSidecar,
} from '../../core/message/profile-sync/profile-version-sidecar';
import {
  getMultiDeviceEventName,
  normalizeMultiDeviceContactEvent,
  normalizeMultiDeviceConversationEvent,
  normalizeMultiDeviceConversationMuteEvents,
  normalizeMultiDeviceGroupEvent,
  normalizeMultiDeviceMessageRemovedEvent,
  normalizeMultiDeviceThreadEvent,
} from './multi-device-normalizer';
import { normalizeProfileVersionSeconds } from '../../core/message/profile-sync/profile-version';
import { CompressionMode, createLZ4Compressor, type LZ4Compressor } from './lz4-compressor';
import type { MessageActionRequest } from '../../core/message/message-action-types';
import type { ChatRoomOperationRequest } from '../../core/message/chatroom-operation-types';

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

export interface ProvisionResult {
  ok: boolean;
  statusCode: number;
  reason?: string;
  resource?: string;
  authToken?: string;
  protocolCompressType?: number[];
  protocolCompressDirection?: number;
}

export interface AckResult {
  protocolId: string;
  serverId: string;
  ok: boolean;
  statusCode: number;
  reason?: string;
}

export interface NotifyEvent {
  // 通知事件结构
  readonly type: string; // 通知类型
  readonly eventName?: string; // 事件名称
  readonly data: unknown; // 通知数据
} // 通知事件结构结束

export interface StatisticOperationResult {
  readonly operation: number;
  readonly reason?: string;
}

export interface LogoutResult {
  readonly sessionId?: string;
  readonly reason?: string;
  readonly statusCode?: number;
}

export interface SyncDecodeResult {
  ack?: AckResult;
  messages: Message[];
  notifies?: ReadonlyArray<NotifyEvent>; // 通知事件列表
  metaId?: string;
  queue?: Record<string, unknown>;
  nextKey?: string;
  isLast?: boolean;
  replacedMessage?: Message;
}

export class MsyncCodec {
  private context: MsyncContextState;
  private compressor: LZ4Compressor | null = null;
  private compressionFailureCount = 0;
  private readonly maxCompressionFailures = 1;
  private useReplacedMessageContents: boolean;
  private readonly useCustomAttachmentUpload: boolean;

  constructor(options: MsyncContextOptions) {
    this.context = createMsyncContext(options);
    this.useReplacedMessageContents = options.useReplacedMessageContents ?? false;
    this.useCustomAttachmentUpload = options.useCustomAttachmentUpload ?? false;
  }

  updateToken(token: string): void {
    this.context.token = token;
  }

  updateResource(resource: string | undefined): void {
    if (resource) {
      this.context.clientResource = resource;
    }
  }

  getContext(): MsyncContextState {
    return { ...this.context };
  }

  /**
   * 生成 provision 登录握手消息
   */
  encodeProvision(): Uint8Array {
    const root = getMsyncRoot();
    const provisionType = root.lookupType('easemob.pb.Provision');
    const msyncType = root.lookupType('easemob.pb.MSync');

    // Provision 的 payload
    const provisionPayload = provisionType.create({
      osType: this.context.osType,
      version: this.context.uiKitVersion ?? this.context.version,
      compressType: [CompressType.COMPRESS_NONE],
      encryptType: [EncryptType.ENCRYPT_NONE],
      protocolCompressType: this.getRequestedCompressTypes(),
      deviceUuid: this.context.deviceUuid,
      deviceName: this.context.deviceName,
      resource: this.context.deviceId,
      auth: `$t$${this.context.token}`,
      actionVersion: 'v5.2',
      authToken: `{"token":"$t$${this.context.token}"}`, // 生成认证 token JSON
      sessionId: this.context.sessionId,
      ...(this.context.customOsPlatform !== undefined
        ? { osCustomValue: this.context.customOsPlatform }
        : {}),
      ...(this.context.loginExtensionInfo ? { reason: this.context.loginExtensionInfo } : {}),
    });

    const provisionBytes = provisionType.encode(provisionPayload).finish();

    // MSync 包装层
    const msyncMessage = msyncType.create({
      version: 0,
      guid: buildJid({
        appKey: this.context.appKey,
        name: this.context.userId,
        domain: this.context.domain,
        clientResource: this.context.clientResource,
      }),
      auth: `$t$${this.context.token}`,
      command: MsyncCommand.PROVISION,
      deviceId: 0,
      encryptType: [EncryptType.ENCRYPT_NONE],
      payload: provisionBytes,
      traceId: this.createTraceId(),
    });

    return msyncType.encode(msyncMessage).finish();
  }

  /**
   * 编码心跳探测消息（UNREAD）
   */
  encodeHeartbeat(): Uint8Array {
    const root = getMsyncRoot(); // 获取协议根
    const commUnreadUlType = root.lookupType('easemob.pb.CommUnreadUL'); // UNREAD 上行类型
    const msyncType = root.lookupType('easemob.pb.MSync'); // MSync 外层类型

    const commUnreadUl = commUnreadUlType.create({}); // 构造空的 UNREAD 上行
    const commUnreadBytes = commUnreadUlType.encode(commUnreadUl).finish(); // 编码 UNREAD 上行

    const msyncMessage = msyncType.create({
      // 构造 MSync 包
      version: 0, // 协议版本
      encryptType: [EncryptType.ENCRYPT_NONE], // 加密方式
      command: MsyncCommand.UNREAD, // UNREAD 命令
      payload: commUnreadBytes, // 负载数据
      traceId: this.createTraceId(), // 生成 traceId
    }); // MSync 包构造结束

    return msyncType.encode(msyncMessage).finish(); // 返回编码结果
  }

  /**
   * 解析 provision 回包
   */
  decodeProvision(payload: Uint8Array): ProvisionResult {
    const root = getMsyncRoot();
    const provisionType = root.lookupType('easemob.pb.Provision');
    const result = provisionType.decode(payload) as unknown as Record<string, unknown>;
    const status = (result.status ?? {}) as Record<string, unknown>;
    const statusCode =
      typeof status.errorCode === 'number' ? status.errorCode : ProvisionErrorCode.FAIL;
    const reason = typeof status.reason === 'string' ? status.reason : undefined;
    const resource = typeof result.resource === 'string' ? result.resource : undefined;
    const authToken = typeof result.authToken === 'string' ? result.authToken : undefined;
    const protocolCompressType = Array.isArray(result.protocolCompressType)
      ? (result.protocolCompressType as number[])
      : undefined;
    const protocolCompressDirection =
      typeof result.protocolCompressDirection === 'number'
        ? result.protocolCompressDirection
        : undefined;

    this.configureCompression(protocolCompressType, protocolCompressDirection);
    return {
      ok: statusCode === ProvisionErrorCode.OK,
      statusCode,
      reason,
      resource,
      authToken,
      protocolCompressType,
      protocolCompressDirection,
    };
  }

  decodeLogout(payload: Uint8Array): LogoutResult {
    const root = getMsyncRoot();
    const logoutType = root.lookupType('easemob.pb.Logout');
    const result = logoutType.decode(payload) as unknown as Record<string, unknown>;
    const status =
      result.status && typeof result.status === 'object'
        ? (result.status as Record<string, unknown>)
        : undefined;
    return {
      sessionId: typeof result.sessionId === 'string' ? result.sessionId : undefined,
      reason: typeof result.reason === 'string' ? result.reason : undefined,
      statusCode: typeof status?.errorCode === 'number' ? status.errorCode : undefined,
    };
  }

  decodeSyncStatisticOperations(payload: Uint8Array): ReadonlyArray<StatisticOperationResult> {
    const root = getMsyncRoot();
    const commSyncDlType = root.lookupType('easemob.pb.CommSyncDL');
    const commSyncDl = commSyncDlType.decode(payload) as unknown as Record<string, unknown>;
    const metas = Array.isArray(commSyncDl.metas) ? commSyncDl.metas : [];
    const results: StatisticOperationResult[] = [];

    for (const meta of metas) {
      const decoded = this.decodeStatisticMeta(meta);
      if (decoded) {
        results.push(decoded);
      }
    }

    return results;
  }

  /**
   * 解析 MSync 外层包
   */
  decodeMsync(data: Uint8Array): { command: number; payload: Uint8Array } {
    const root = getMsyncRoot();
    const msyncType = root.lookupType('easemob.pb.MSync');
    const decoded = msyncType.decode(data) as unknown as Record<string, unknown>;
    const command = typeof decoded.command === 'number' ? decoded.command : -1;
    const payload = decoded.payload instanceof Uint8Array ? decoded.payload : new Uint8Array();
    return { command, payload };
  }

  /**
   * 解码下行 SYNC（CommSyncDL），拆分 ACK 与消息
   */
  decodeSync(payload: Uint8Array): SyncDecodeResult {
    const root = getMsyncRoot();
    const commSyncDlType = root.lookupType('easemob.pb.CommSyncDL');
    const messageBodyType = root.lookupType('easemob.pb.MessageBody');
    const commSyncDl = commSyncDlType.decode(payload) as unknown as Record<string, unknown>;
    logger.debug('decodeSync commSyncDl', { hasMetas: Array.isArray(commSyncDl.metas) }); // 记录解析元信息
    const ack = this.decodeAck(commSyncDl);
    const metaId = longToString(commSyncDl.metaId);
    const nextKey = longToString(commSyncDl.nextKey);
    const queue = (commSyncDl.queue ?? undefined) as Record<string, unknown> | undefined;
    const isLast = typeof commSyncDl.isLast === 'boolean' ? commSyncDl.isLast : undefined;
    const metas = Array.isArray(commSyncDl.metas) ? commSyncDl.metas : [];
    const messages: Message[] = [];
    const notifies: NotifyEvent[] = []; // 通知事件列表

    if (metaId && metaId !== '0') {
      const replacedMessage = this.useReplacedMessageContents
        ? this.decodeReplacedMessage(metas, messageBodyType)
        : undefined;
      for (const meta of metas) {
        // 处理通知事件
        const metaNotifies = this.decodeNotifyMeta(meta); // 解码通知事件
        if (metaNotifies.length > 0) {
          // 判断通知结果
          notifies.push(...metaNotifies); // 追加通知事件
        } // 通知追加结束
      } // 通知遍历结束
      return {
        ack,
        messages,
        notifies: notifies.length > 0 ? notifies : undefined,
        metaId,
        queue,
        nextKey,
        isLast,
        replacedMessage,
      }; // 返回解码结果
    }

    for (const meta of metas) {
      const decoded = this.decodeChatMeta(meta, messageBodyType);
      if (decoded) {
        messages.push(decoded);
      }
      const actionNotify = this.decodeChatActionMeta(meta, messageBodyType);
      if (actionNotify) {
        notifies.push(actionNotify);
      }
      const metaNotifies = this.decodeNotifyMeta(meta); // 解码通知事件
      if (metaNotifies.length > 0) {
        // 判断通知结果
        notifies.push(...metaNotifies); // 追加通知事件
      } // 通知追加结束
    }

    return {
      ack,
      messages,
      notifies: notifies.length > 0 ? notifies : undefined, // 通知事件列表
      metaId,
      queue,
      nextKey,
      isLast,
    };
  }

  private decodeReplacedMessage(
    // 解码替换消息
    metas: ReadonlyArray<unknown>, // 元数据列表
    messageBodyType: { decode: (input: Uint8Array) => unknown } // 解码器定义
  ): Message | undefined {
    // 返回替换消息
    for (const meta of metas) {
      const decoded = this.decodeChatMeta(meta, messageBodyType);
      if (decoded) {
        return decoded;
      }
    }
    return undefined;
  }

  private decodeChatMeta(
    // 解码单条元数据
    meta: unknown, // 元数据对象
    messageBodyType: { decode: (input: Uint8Array) => unknown } // 解码器定义
  ): Message | null {
    // 返回消息或空
    if (!meta || typeof meta !== 'object') {
      return null;
    }
    const metaRecord = meta as Record<string, unknown>;
    const payloadBytes = metaRecord.payload;
    let payload: Uint8Array | null = null;
    if (payloadBytes instanceof Uint8Array) {
      payload = payloadBytes;
    } else if (payloadBytes instanceof ArrayBuffer) {
      payload = new Uint8Array(payloadBytes);
    } else if (ArrayBuffer.isView(payloadBytes)) {
      payload = new Uint8Array(
        payloadBytes.buffer,
        payloadBytes.byteOffset,
        payloadBytes.byteLength
      );
    }

    if (!payload) {
      return null;
    }

    const ns = typeof metaRecord.ns === 'number' ? metaRecord.ns : undefined;
    if (ns !== NameSpace.CHAT) {
      return null;
    }

    try {
      // 捕获解码异常
      const decodedBody = messageBodyType.decode(payload); // 解码消息体
      if (!decodedBody || typeof decodedBody !== 'object') {
        // 校验解码结果
        return null; // 非法结果直接返回
      }
      const messageBody = decodedBody as Record<string, unknown>; // 收敛为对象
      return this.decodeMessage(metaRecord, messageBody); // 解码消息内容
    } catch {
      // 解码失败
      return null; // 返回空
    }
  }

  private decodeChatActionMeta(
    meta: unknown,
    messageBodyType: { decode: (input: Uint8Array) => unknown }
  ): NotifyEvent | null {
    if (!meta || typeof meta !== 'object') {
      return null;
    }
    const metaRecord = meta as Record<string, unknown>;
    const payloadBytes = metaRecord.payload;
    let payload: Uint8Array | null = null;
    if (payloadBytes instanceof Uint8Array) {
      payload = payloadBytes;
    } else if (payloadBytes instanceof ArrayBuffer) {
      payload = new Uint8Array(payloadBytes);
    } else if (ArrayBuffer.isView(payloadBytes)) {
      payload = new Uint8Array(
        payloadBytes.buffer,
        payloadBytes.byteOffset,
        payloadBytes.byteLength
      );
    }

    if (!payload) {
      return null;
    }

    const ns = typeof metaRecord.ns === 'number' ? metaRecord.ns : undefined;
    if (ns !== NameSpace.CHAT) {
      return null;
    }

    try {
      const decodedBody = messageBodyType.decode(payload);
      if (!decodedBody || typeof decodedBody !== 'object') {
        return null;
      }
      const messageBody = decodedBody as Record<string, unknown>;
      const messageType =
        typeof messageBody.type === 'number' ? messageBody.type : MsyncMessageType.NORMAL;
      if (
        messageType !== MsyncMessageType.READ_ACK &&
        messageType !== MsyncMessageType.RECALL &&
        messageType !== MsyncMessageType.CHANNEL_ACK &&
        messageType !== MsyncMessageType.EDIT &&
        messageType !== MsyncMessageType.DELIVER_ACK
      ) {
        return null;
      }

      const sender = this.readJid(metaRecord.from);
      const receiver = this.readJid(metaRecord.to);
      const timestamp = Number(longToString(metaRecord.timestamp)) || Date.now();
      const conversationType = this.resolveActionConversationType(
        messageType,
        receiver.domain,
        messageBody.meta,
        messageBody
      );
      const conversationId = this.resolveActionConversationId(
        sender.name ?? '',
        receiver.name ?? '',
        conversationType
      );

      if (messageType === MsyncMessageType.CHANNEL_ACK) {
        if (!conversationId) {
          return null;
        }
        return {
          type: 'conversation_read',
          data: {
            conversationId,
            conversationType: 'singleChat',
            timestamp,
          },
        };
      }

      if (messageType === MsyncMessageType.READ_ACK) {
        const messageId = longToString(messageBody.ackMessageId);
        if (!messageId || !conversationId) {
          return null;
        }
        const isGroupAck = conversationType === 'groupChat' || conversationType === 'chatRoom';
        return {
          type: 'message_read',
          data: {
            messageId,
            conversationId,
            conversationType: isGroupAck ? 'groupChat' : 'singleChat',
            isGroupAck,
            ackContent:
              typeof messageBody.ackContent === 'string' && messageBody.ackContent.length > 0
                ? messageBody.ackContent
                : undefined,
            timestamp,
          },
        };
      }

      if (messageType === MsyncMessageType.DELIVER_ACK) {
        const messageId = longToString(messageBody.ackMessageId);
        if (!messageId || !conversationId) {
          return null;
        }
        return {
          type: 'message_delivered' as const,
          data: {
            messageId,
            from: sender.name ?? '',
            to: receiver.name ?? '',
            conversationId,
            conversationType: 'singleChat' as const,
          },
        };
      }

      if (messageType === MsyncMessageType.RECALL) {
        const messageId = longToString(messageBody.ackMessageId);
        if (!messageId || !conversationId) {
          return null;
        }
        return {
          type: 'message_recalled',
          data: {
            messageId,
            conversationId,
            conversationType,
            timestamp,
          },
        };
      }

      const messageId = longToString(messageBody.editMessageId);
      const contentList = Array.isArray(messageBody.contents) ? messageBody.contents : [];
      const firstContent = contentList[0] as Record<string, unknown> | undefined;
      const decodedContent = firstContent ? this.decodeContent(firstContent) : null;
      if (!messageId || !conversationId || !decodedContent) {
        return null;
      }
      const modifiedInfo = this.resolveModifiedInfo(messageBody.meta);
      return {
        type: 'message_updated',
        data: {
          messageId,
          conversationId,
          conversationType,
          timestamp,
          message: {
            type: decodedContent.type,
            body: decodedContent.body,
            ext: decodeKeyValueList(messageBody.ext as Array<Record<string, unknown>> | undefined),
            ...(modifiedInfo ? { modifiedInfo } : {}),
          },
        },
      };
    } catch {
      return null;
    }
  }

  private decodeNotifyMeta(meta: unknown): NotifyEvent[] {
    // 解码通知元数据
    if (!meta || typeof meta !== 'object') {
      // 校验元数据
      return []; // 直接返回
    } // 校验结束
    const metaRecord = meta as Record<string, unknown>; // 规整为对象
    const ns = typeof metaRecord.ns === 'number' ? metaRecord.ns : undefined; // 读取命名空间
    if (
      ns !== NameSpace.NOTIFY &&
      ns !== NameSpace.ROSTER &&
      ns !== NameSpace.MUC &&
      ns !== NameSpace.STATISTIC
    ) {
      // 过滤非通知命名空间
      return []; // 直接返回
    } // 过滤结束
    const payloadBytes = metaRecord.payload; // 读取 payload
    let payload: Uint8Array | null = null; // 初始化 payload
    if (payloadBytes instanceof Uint8Array) {
      // 判断 Uint8Array
      payload = payloadBytes; // 赋值 payload
    } else if (payloadBytes instanceof ArrayBuffer) {
      // 判断 ArrayBuffer
      payload = new Uint8Array(payloadBytes); // 转换 payload
    } else if (ArrayBuffer.isView(payloadBytes)) {
      // 判断视图
      payload = new Uint8Array(
        payloadBytes.buffer,
        payloadBytes.byteOffset,
        payloadBytes.byteLength
      ); // 转换 payload
    } // 解析结束
    if (!payload) {
      // 校验 payload
      return []; // 直接返回
    } // 校验结束
    if (ns === NameSpace.ROSTER) {
      return this.decodeRosterMeta(metaRecord, payload);
    }
    if (ns === NameSpace.MUC) {
      return this.decodeMucMeta(metaRecord, payload);
    }
    if (ns === NameSpace.STATISTIC) {
      return [];
    }
    return this.decodeNotifyPayload(payload); // 解码通知 payload
  }

  private decodeStatisticMeta(meta: unknown): StatisticOperationResult | null {
    if (!meta || typeof meta !== 'object') {
      return null;
    }
    const metaRecord = meta as Record<string, unknown>;
    if (metaRecord.ns !== NameSpace.STATISTIC) {
      return null;
    }
    const payloadBytes = metaRecord.payload;
    let payload: Uint8Array | null = null;
    if (payloadBytes instanceof Uint8Array) {
      payload = payloadBytes;
    } else if (payloadBytes instanceof ArrayBuffer) {
      payload = new Uint8Array(payloadBytes);
    } else if (ArrayBuffer.isView(payloadBytes)) {
      payload = new Uint8Array(
        payloadBytes.buffer,
        payloadBytes.byteOffset,
        payloadBytes.byteLength
      );
    }
    if (!payload) {
      return null;
    }

    try {
      const root = getMsyncRoot();
      const statisticsType = root.lookupType('easemob.pb.StatisticsBody');
      const decoded = statisticsType.decode(payload) as unknown as Record<string, unknown>;
      return {
        operation: typeof decoded.operation === 'number' ? decoded.operation : -1,
        reason: typeof decoded.reason === 'string' ? decoded.reason : undefined,
      };
    } catch {
      return null;
    }
  }

  private decodeRosterMeta(meta: Record<string, unknown>, payload: Uint8Array): NotifyEvent[] {
    try {
      const root = getMsyncRoot();
      const rosterType = root.lookupType('easemob.pb.RosterBody');
      const decoded = rosterType.decode(payload) as unknown as Record<string, unknown>;
      const operation = typeof decoded.operation === 'number' ? decoded.operation : -1;
      const from = this.readRosterJid(decoded.from);
      const to = this.readRosterJidList(decoded.to);
      const status = typeof decoded.reason === 'string' ? decoded.reason : '';
      const rosterVersion =
        typeof decoded.rosterVer === 'string' && decoded.rosterVer.trim().length > 0
          ? decoded.rosterVer
          : undefined;
      const fromUserId = from.name ?? '';
      const toUserId = to[0]?.name ?? '';
      if (!fromUserId && !toUserId) {
        return [];
      }
      const events: NotifyEvent[] = [];
      const event = this.mapRosterOperationToEvent(operation, {
        from: fromUserId,
        to: toUserId,
        status,
        rosterVersion,
      });
      if (event) {
        events.push({
          type: 'contact',
          eventName: event.eventName,
          data: event.payload,
        });
      }
      const multiDeviceEvent = normalizeMultiDeviceContactEvent(
        {
          operation,
          from,
          to,
          rosterVersion,
          ext: status,
          timestamp: this.readMetaTimestamp(meta),
          raw: decoded,
        },
        this.msyncCodecContext()
      );
      if (multiDeviceEvent) {
        events.push(this.createMultiDeviceNotify(multiDeviceEvent));
      }
      return events;
    } catch {
      return [];
    }
  }

  private readRosterJid(value: unknown): { readonly name?: string; readonly clientResource?: string } {
    if (!value || typeof value !== 'object') {
      return {};
    }
    const record = value as Record<string, unknown>;
    return {
      name: typeof record.name === 'string' ? record.name : undefined,
      clientResource: typeof record.clientResource === 'string' ? record.clientResource : undefined,
    };
  }

  private readRosterJidList(
    value: unknown
  ): ReadonlyArray<{ readonly name?: string; readonly clientResource?: string }> {
    if (!Array.isArray(value) || value.length === 0) {
      return [];
    }
    return value.map(item => this.readRosterJid(item));
  }

  private readJid(value: unknown): {
    readonly name?: string;
    readonly clientResource?: string;
    readonly domain?: string;
  } {
    if (!value || typeof value !== 'object') {
      return {};
    }
    const record = value as Record<string, unknown>;
    return {
      name: typeof record.name === 'string' ? record.name : undefined,
      clientResource: typeof record.clientResource === 'string' ? record.clientResource : undefined,
      domain: typeof record.domain === 'string' ? record.domain : undefined,
    };
  }

  private decodeMucMeta(meta: Record<string, unknown>, payload: Uint8Array): NotifyEvent[] {
    try {
      const root = getMsyncRoot();
      const mucType = root.lookupType('easemob.pb.MUCBody');
      const decoded = mucType.decode(payload) as unknown as Record<string, unknown>;
      const operation = typeof decoded.operation === 'number' ? decoded.operation : -1;
      const isChatRoom = decoded.isChatroom === true;
      const isThread = decoded.isThread === true;
      const from = this.readJid(decoded.from);
      const to = Array.isArray(decoded.to) ? decoded.to.map(item => this.readJid(item)) : [];
      const eventInfo =
        decoded.eventInfo && typeof decoded.eventInfo === 'object'
          ? (decoded.eventInfo as Record<string, unknown>)
          : undefined;
      const members = Array.isArray(decoded.members)
        ? decoded.members.filter((item): item is string => typeof item === 'string')
        : [];
      const source =
        from.name === this.context.userId &&
        from.clientResource &&
        from.clientResource !== this.context.clientResource
          ? 'multiDevice'
          : 'direct';
      if (isThread) {
        const multiDeviceThread = normalizeMultiDeviceThreadEvent(
          {
            operation,
            threadId: this.readJid(decoded.mucId).name ?? '',
            threadName: typeof decoded.mucName === 'string' ? decoded.mucName : undefined,
            parentId: this.readJid(decoded.mucParentId).name ?? undefined,
            from,
            to,
            members,
            timestamp: this.readMetaTimestamp(meta),
            raw: decoded,
          },
          this.msyncCodecContext()
        );
        return multiDeviceThread ? [this.createMultiDeviceNotify(multiDeviceThread)] : [];
      }

      const mapped = isChatRoom
        ? mapMucOperationToChatRoomEvent({
            operation,
            chatRoomId: this.readJid(decoded.mucId).name ?? '',
            chatRoomName: typeof decoded.mucName === 'string' ? decoded.mucName : undefined,
            from,
            to,
            reason: typeof decoded.reason === 'string' ? decoded.reason : undefined,
            eventExt: typeof eventInfo?.ext === 'string' ? eventInfo.ext : undefined,
            ext: typeof decoded.ext === 'string' ? decoded.ext : undefined,
            members,
          })
        : mapMucOperationToGroupEvent({
            operation,
            groupId: this.readJid(decoded.mucId).name ?? '',
            groupName: typeof decoded.mucName === 'string' ? decoded.mucName : undefined,
            from,
            to,
            reason: typeof decoded.reason === 'string' ? decoded.reason : undefined,
            eventExt: typeof eventInfo?.ext === 'string' ? eventInfo.ext : undefined,
            members,
            source,
          });

      if (!mapped) {
        return [];
      }
      const events: NotifyEvent[] = [
        {
          type: isChatRoom ? 'chatroom' : 'group',
          eventName: isChatRoom ? 'onChatRoomNotify' : 'onGroupNotify',
          data: mapped,
        },
      ];
      if (!isChatRoom) {
        const multiDeviceGroup = normalizeMultiDeviceGroupEvent(
          {
            operation,
            groupId: this.readJid(decoded.mucId).name ?? '',
            groupName: typeof decoded.mucName === 'string' ? decoded.mucName : undefined,
            from,
            to,
            reason: typeof decoded.reason === 'string' ? decoded.reason : undefined,
            eventExt: typeof eventInfo?.ext === 'string' ? eventInfo.ext : undefined,
            members,
            timestamp: this.readMetaTimestamp(meta),
            raw: decoded,
          },
          this.msyncCodecContext()
        );
        if (multiDeviceGroup) {
          events.push(this.createMultiDeviceNotify(multiDeviceGroup));
        }
      }
      return events;
    } catch {
      return [];
    }
  }

  private mapRosterOperationToEvent(
    operation: number,
    payload: Omit<ContactRosterEventPayload, 'type' | 'userInfo'>
  ): { readonly eventName: string; readonly payload: ContactRosterEventPayload } | null {
    const minimalUserInfo = {
      userId: payload.from || payload.to,
    };

    switch (operation) {
      case 2:
        return {
          eventName: 'onContactInvited',
          payload: {
            ...payload,
            type: 'subscribe',
            userInfo: minimalUserInfo,
          },
        };
      case 3:
        return {
          eventName: 'onContactDeleted',
          payload: {
            ...payload,
            type: 'unsubscribed',
            userInfo: minimalUserInfo,
          },
        };
      case 4:
        return {
          eventName: 'onContactAdded',
          payload: {
            ...payload,
            type: 'subscribed',
            userInfo: minimalUserInfo,
          },
        };
      case 5:
      case 9:
        return {
          eventName: 'onContactRefuse',
          payload: {
            ...payload,
            type: 'unsubscribed',
            userInfo: minimalUserInfo,
          },
        };
      case 8:
        return {
          eventName: 'onContactAgreed',
          payload: {
            ...payload,
            type: 'subscribed',
            userInfo: minimalUserInfo,
          },
        };
      default:
        return null;
    }
  }

  private decodeNotifyPayload(payload: Uint8Array): NotifyEvent[] {
    // 解码通知 payload
    try {
      // 捕获解析异常
      let encoded = ''; // 初始化编码串
      for (let i = 0; i < payload.length; i += 1) {
        // 遍历 payload
        const byte = payload[i]; // 读取单字节
        if (byte === undefined) {
          // 防御性处理越界读取
          return []; // 读取异常直接返回
        } // 防御结束
        encoded += `%${byte.toString(16)}`; // 拼接编码串
      } // 遍历结束
      const decoded = decodeURIComponent(encoded); // 解码字符串
      const parsed = JSON.parse(decoded) as Record<string, unknown>; // 解析 JSON
      const type = typeof parsed.type === 'string' ? parsed.type : ''; // 读取类型
      if (!type) {
        // 校验类型
        return []; // 类型缺失直接返回
      } // 校验结束
      if (type === 'thread') {
        const threadPayload = isRecord(parsed.data) ? parsed.data : parsed;
        return [
          {
            type,
            eventName: 'onChatThreadChange',
            data: {
              eventName: 'onChatThreadChange',
              payload: threadPayload,
            },
          },
        ];
      }
      if (type === 'conv') {
        const data = isRecord(parsed.data) ? parsed.data : parsed;
        const events: NotifyEvent[] = [];
        const op = typeof data.op === 'string' ? data.op : '';
        if (op === 'pin' || op === 'pin_delete') {
          events.push({
            type,
            eventName: 'onPinnedMessageChanged',
            data,
          });
        }
        const multiDeviceConversation = normalizeMultiDeviceConversationEvent(
          {
            operation: op,
            id: typeof data.id === 'string' ? data.id : '',
            type: typeof data.type === 'string' ? data.type : undefined,
            from: typeof data.from === 'string' ? data.from : undefined,
            res: typeof data.res === 'string' ? data.res : undefined,
            ts: data.ts,
            ext: typeof data.ext === 'string' ? data.ext : undefined,
            raw: data,
          },
          this.msyncCodecContext()
        );
        if (multiDeviceConversation) {
          events.push(this.createMultiDeviceNotify(multiDeviceConversation));
        }
        return events;
      }
      if (type === 'roaming_delete') {
        const data = isRecord(parsed.data) ? parsed.data : parsed;
        const multiDeviceMessageRemoved = normalizeMultiDeviceMessageRemovedEvent(
          {
            chatType: typeof data.chatType === 'string' ? data.chatType : undefined,
            to: typeof data.to === 'string' ? data.to : undefined,
            resource: typeof data.resource === 'string' ? data.resource : undefined,
            msgIdList: Array.isArray(data.msgIdList)
              ? (data.msgIdList.filter((item): item is string => typeof item === 'string') as ReadonlyArray<string>)
              : undefined,
            deleteTime: data.deleteTime,
            lastMsgId: typeof data.lastMsgId === 'string' ? data.lastMsgId : undefined,
            messageRoamingType:
              typeof data.messageRoamingType === 'string' ? data.messageRoamingType : undefined,
            raw: data,
          },
          this.msyncCodecContext()
        );
        return multiDeviceMessageRemoved ? [this.createMultiDeviceNotify(multiDeviceMessageRemoved)] : [];
      }
      if (type === 'user_notification_mute') {
        const values = isRecord(parsed.data) && Array.isArray(parsed.data.values)
          ? parsed.data.values
          : Array.isArray(parsed.values)
            ? parsed.values
            : [];
        return normalizeMultiDeviceConversationMuteEvents(values, this.msyncCodecContext()).map(
          event => this.createMultiDeviceNotify(event)
        );
      }
      return [{ type, data: parsed.data ?? parsed }]; // 返回通知事件
    } catch {
      // 捕获异常
      return []; // 解析失败返回空
    } // 异常处理结束
  }

  private readMetaTimestamp(meta: Record<string, unknown>): number | undefined {
    const timestamp = meta.timestamp;
    const parsed = Number(longToString(timestamp));
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
    return undefined;
  }

  private msyncCodecContext(): {
    readonly userId: string;
    readonly clientResource?: string;
  } {
    return {
      userId: this.context.userId,
      clientResource: this.context.clientResource,
    };
  }

  private createMultiDeviceNotify(
    event:
      | NonNullable<ReturnType<typeof normalizeMultiDeviceContactEvent>>
      | NonNullable<ReturnType<typeof normalizeMultiDeviceGroupEvent>>
      | NonNullable<ReturnType<typeof normalizeMultiDeviceThreadEvent>>
      | NonNullable<ReturnType<typeof normalizeMultiDeviceConversationEvent>>
      | NonNullable<ReturnType<typeof normalizeMultiDeviceMessageRemovedEvent>>
  ): NotifyEvent {
    return {
      type: 'multiDevice',
      eventName: getMultiDeviceEventName(event.category),
      data: event,
    };
  }

  decodeNotice(payload: Uint8Array): { queue?: Record<string, unknown> } {
    const root = getMsyncRoot();
    const noticeType = root.lookupType('easemob.pb.CommNotice');
    const notice = noticeType.decode(payload) as unknown as Record<string, unknown>;
    const queue =
      notice.queue && typeof notice.queue === 'object'
        ? (notice.queue as Record<string, unknown>)
        : undefined;
    return { queue };
  }

  decodeUnread(payload: Uint8Array): { queues: Record<string, unknown>[] } {
    const root = getMsyncRoot();
    const unreadType = root.lookupType('easemob.pb.CommUnreadDL');
    const unread = unreadType.decode(payload) as unknown as Record<string, unknown>;
    const items = Array.isArray(unread.unread) ? unread.unread : [];
    const queues = items
      .map(item => (item && typeof item === 'object' ? (item as Record<string, unknown>) : null))
      .map(item =>
        item?.queue && typeof item.queue === 'object'
          ? (item.queue as Record<string, unknown>)
          : null
      )
      .filter((item): item is Record<string, unknown> => Boolean(item));
    return { queues };
  }

  encodeBackQueue(queue: Record<string, unknown>): Uint8Array {
    const root = getMsyncRoot();
    const commSyncUlType = root.lookupType('easemob.pb.CommSyncUL');
    const msyncType = root.lookupType('easemob.pb.MSync');

    const commSyncUl = commSyncUlType.create({ queue });
    const commSyncBytes = commSyncUlType.encode(commSyncUl).finish();

    const msync = msyncType.create({
      version: 0,
      encryptType: [EncryptType.ENCRYPT_NONE],
      command: MsyncCommand.SYNC,
      payload: commSyncBytes,
      traceId: this.createTraceId(),
    });

    return msyncType.encode(msync).finish();
  }

  encodeLastSession(queue: Record<string, unknown>, nextKey: string): Uint8Array {
    const root = getMsyncRoot();
    const commSyncUlType = root.lookupType('easemob.pb.CommSyncUL');
    const msyncType = root.lookupType('easemob.pb.MSync');

    const commSyncUl = commSyncUlType.create({
      queue,
      key: nextKey,
    });
    const commSyncBytes = commSyncUlType.encode(commSyncUl).finish();

    const msync = msyncType.create({
      version: 0,
      encryptType: [EncryptType.ENCRYPT_NONE],
      command: MsyncCommand.SYNC,
      payload: commSyncBytes,
      traceId: this.createTraceId(),
    });

    return msyncType.encode(msync).finish();
  }

  /**
   * 编码聊天消息（文本/命令/自定义）
   */
  encodeChatMessage(message: Message, protocolId: string): Uint8Array {
    const root = getMsyncRoot();
    const contentType = root.lookupType('easemob.pb.MessageBody.Content');
    const messageBodyType = root.lookupType('easemob.pb.MessageBody');
    const metaType = root.lookupType('easemob.pb.Meta');
    const commSyncUlType = root.lookupType('easemob.pb.CommSyncUL');
    const msyncType = root.lookupType('easemob.pb.MSync');

    // 构建 content（消息体）
    const contentPayload = this.buildContent(message);
    const content = contentType.create(contentPayload);

    const profileVersionFields = this.resolveMessageProfileVersionFields(message);

    // 构建 MessageBody
    const messageBody = messageBodyType.create({
      type: this.resolveChatType(message),
      from: { name: this.context.userId },
      to: { name: message.conversationId },
      contents: [content],
      ext: encodeKeyValueRecord(message.ext ?? {}),
      ...profileVersionFields,
      ...(message.needGroupReadReceipt ? { msgConfig: { allowGroupAck: true } } : {}),
    });
    const messageBodyBytes = messageBodyType.encode(messageBody).finish();

    // 构建 Meta
    const toDomain =
      message.conversationType === 'singleChat' ? this.context.domain : 'conference.easemob.com';
    const directedUsers = this.resolveDirectedUsers(message);
    const metaExt = this.resolveMetaExt(message);
    const meta = metaType.create({
      id: protocolId,
      to: buildJid({
        appKey: this.context.appKey,
        name: message.conversationId,
        domain: toDomain,
      }),
      ns: NameSpace.CHAT,
      payload: messageBodyBytes,
      routetype: this.resolveRouteType(message),
      directedUsers,
      ext: metaExt,
      ...(message.webhookEnv !== undefined ? { env: message.webhookEnv } : {}),
    });

    // CommSyncUL
    const commSyncUl = commSyncUlType.create({ meta });
    const commSyncBytes = commSyncUlType.encode(commSyncUl).finish();

    // MSync 包装
    const msync = msyncType.create({
      version: 0,
      encryptType: [EncryptType.ENCRYPT_NONE],
      command: MsyncCommand.SYNC,
      payload: commSyncBytes,
      traceId: this.createTraceId(),
    });

    return msyncType.encode(msync).finish();
  }

  encodeActionMessage(action: MessageActionRequest, protocolId: string): Uint8Array {
    const root = getMsyncRoot();
    const contentType = root.lookupType('easemob.pb.MessageBody.Content');
    const messageBodyType = root.lookupType('easemob.pb.MessageBody');
    const metaType = root.lookupType('easemob.pb.Meta');
    const commSyncUlType = root.lookupType('easemob.pb.CommSyncUL');
    const msyncType = root.lookupType('easemob.pb.MSync');
    const editScopeEnum = root.lookupEnum('easemob.pb.MessageBody.EditScope');

    const contents =
      action.body && action.messageType
        ? [
            contentType.create(
              this.buildContent({
                msgServerId: action.messageId ?? '',
                msgLocalId: protocolId,
                from: this.context.userId,
                to: action.conversationId,
                sender: { userId: this.context.userId },
                conversationId: action.conversationId,
                conversationType: action.conversationType,
                type: action.messageType,
                status: 'sending',
                ext: action.ext ?? {},
                timestamp: Date.now(),
                body: action.body,
              })
            ),
          ]
        : [];

    const messageBodyPayload: Record<string, unknown> = {
      type: this.resolveActionMessageType(action),
      from: { name: this.context.userId },
      to: { name: action.conversationId },
      contents,
      ext: encodeKeyValueRecord(action.ext ?? {}),
    };

    if (
      action.kind === 'recall' ||
      action.kind === 'messageRead' ||
      action.kind === 'groupMessageRead' ||
      action.kind === 'deliveryAck'
    ) {
      messageBodyPayload.ackMessageId = action.messageId;
    }

    if (action.kind === 'groupMessageRead') {
      messageBodyPayload.msgConfig = { allowGroupAck: true };
      if (typeof action.ackContent === 'string' && action.ackContent.length > 0) {
        messageBodyPayload.ackContent = action.ackContent;
      }
    }

    if (action.kind === 'update') {
      messageBodyPayload.editMessageId = action.messageId;
      messageBodyPayload.editScope =
        action.ext && Object.keys(action.ext).length > 0
          ? editScopeEnum.values.BODY_AND_EXT
          : editScopeEnum.values.BODY;
    }

    const messageBody = messageBodyType.create(messageBodyPayload);
    const messageBodyBytes = messageBodyType.encode(messageBody).finish();
    const meta = metaType.create({
      id: protocolId,
      to: buildJid({
        appKey: this.context.appKey,
        name: action.conversationId,
        domain:
          action.conversationType === 'singleChat' ? this.context.domain : 'conference.easemob.com',
      }),
      ns: NameSpace.CHAT,
      payload: messageBodyBytes,
      routetype: RouteType.ROUTE_ALL,
      directedUsers: [],
      ext: [],
    });
    const commSyncUl = commSyncUlType.create({ meta });
    const commSyncBytes = commSyncUlType.encode(commSyncUl).finish();
    const msync = msyncType.create({
      version: 0,
      encryptType: [EncryptType.ENCRYPT_NONE],
      command: MsyncCommand.SYNC,
      payload: commSyncBytes,
      traceId: this.createTraceId(),
    });

    return msyncType.encode(msync).finish();
  }

  encodeChatRoomOperation(request: ChatRoomOperationRequest, protocolId: string): Uint8Array {
    const root = getMsyncRoot();
    const mucBodyType = root.lookupType('easemob.pb.MUCBody');
    const metaType = root.lookupType('easemob.pb.Meta');
    const commSyncUlType = root.lookupType('easemob.pb.CommSyncUL');
    const msyncType = root.lookupType('easemob.pb.MSync');

    const mucBodyPayload: Record<string, unknown> = {
      mucId: buildJid({
        appKey: this.context.appKey,
        name: request.chatRoomId,
        domain: 'conference.easemob.com',
      }),
      operation: request.operation === 'join' ? 2 : 3,
      from: { name: this.context.userId },
      isChatroom: true,
    };

    if (request.operation === 'join') {
      if (request.ext !== undefined) {
        mucBodyPayload.ext = request.ext;
      }
      if (request.leaveOtherRooms !== undefined) {
        mucBodyPayload.leaveOtherRooms = request.leaveOtherRooms;
      }
    }

    const mucBody = mucBodyType.create(mucBodyPayload);
    const mucBodyBytes = mucBodyType.encode(mucBody).finish();
    const meta = metaType.create({
      id: protocolId,
      from: buildJid({
        appKey: this.context.appKey,
        name: this.context.userId,
        domain: this.context.domain,
        clientResource: this.context.clientResource,
      }),
      to: { domain: this.context.domain },
      ns: NameSpace.MUC,
      payload: mucBodyBytes,
    });
    const commSyncUl = commSyncUlType.create({ meta });
    const commSyncBytes = commSyncUlType.encode(commSyncUl).finish();
    const msync = msyncType.create({
      version: 0,
      encryptType: [EncryptType.ENCRYPT_NONE],
      command: MsyncCommand.SYNC,
      payload: commSyncBytes,
      traceId: this.createTraceId(),
    });

    return msyncType.encode(msync).finish();
  }

  decodeServerMessageMeta(metaPayload: Uint8Array): Message | null {
    const root = getMsyncRoot();
    const metaType = root.lookupType('easemob.pb.Meta');
    const messageBodyType = root.lookupType('easemob.pb.MessageBody');

    try {
      const meta = metaType.decode(metaPayload) as unknown;
      return this.decodeChatMeta(meta, messageBodyType);
    } catch {
      return null;
    }
  }

  /**
   * 将 WebSocket 数据统一为 Uint8Array
   */
  async normalizeIncoming(data: unknown): Promise<Uint8Array> {
    if (data instanceof Uint8Array) {
      return data;
    }
    if (data instanceof ArrayBuffer) {
      return new Uint8Array(data);
    }
    if (data instanceof Blob) {
      const buffer = await data.arrayBuffer();
      return new Uint8Array(buffer);
    }
    if (typeof data === 'string') {
      return new TextEncoder().encode(data);
    }
    if (data && typeof data === 'object' && 'data' in (data as Record<string, unknown>)) {
      return this.normalizeIncoming((data as Record<string, unknown>).data);
    }
    return new Uint8Array();
  }

  /**
   * 解压下行消息（根据 provision 协商的压缩模式）
   */
  decompressIncoming(data: Uint8Array): Uint8Array | null {
    if (!this.compressor || !this.compressor.enableDownlinkCompression) {
      return data;
    }
    try {
      return this.compressor.decompress(data);
    } catch {
      this.compressionFailureCount += 1;
      return null;
    }
  }

  /**
   * 压缩上行消息（根据 provision 协商的压缩模式）
   */
  prepareOutgoing(data: Uint8Array): Uint8Array {
    if (!this.compressor || !this.compressor.enableUplinkCompression) {
      return data;
    }
    try {
      return this.compressor.compress(data);
    } catch {
      this.compressionFailureCount += 1;
      throw new Error('compress outgoing message failed');
    }
  }

  /**
   * 为 msgLocalId 生成可用的协议 ID（必须为纯数字）
   */
  toProtocolId(msgLocalId: string): string {
    return toNumericId(msgLocalId);
  }

  private decodeAck(commSyncDl: Record<string, unknown>): AckResult | undefined {
    // ack 仅在 metaId > 0 时存在
    const metaId = longToString(commSyncDl.metaId);
    if (!metaId || metaId === '0') {
      return undefined;
    }

    // status 携带服务端错误码与原因
    const status = (commSyncDl.status ?? {}) as Record<string, unknown>;
    const statusCode =
      typeof status.errorCode === 'number' ? status.errorCode : ProvisionErrorCode.FAIL;
    const reason = typeof status.reason === 'string' ? status.reason : undefined;
    const serverId = longToString(commSyncDl.serverId);

    return {
      protocolId: metaId,
      serverId,
      ok: statusCode === ProvisionErrorCode.OK,
      statusCode,
      reason,
    };
  }

  private decodeMessage(
    meta: Record<string, unknown>,
    messageBody: Record<string, unknown>
  ): Message | null {
    const chatType =
      typeof messageBody.type === 'number' ? messageBody.type : MsyncMessageType.SINGLECHAT;
    // 仅将真实聊天消息透传给 onMessage，ACK/回执等内部消息不应对外回调。
    if (!this.isPublicMessageType(chatType)) {
      return null;
    }

    // 仅解析第一个内容体（当前阶段只支持 text/cmd/custom）
    const contentList = Array.isArray(messageBody.contents) ? messageBody.contents : [];
    const firstContent = contentList[0] as Record<string, unknown> | undefined;
    if (!firstContent) {
      return null;
    }

    // 解析发送者/接收者 JID
    const senderJid = (meta.from ?? {}) as Record<string, unknown>;
    const receiverJid = (meta.to ?? {}) as Record<string, unknown>;
    const senderId = typeof senderJid.name === 'string' ? senderJid.name : '';
    const receiverId = typeof receiverJid.name === 'string' ? receiverJid.name : '';

    // 根据 MSync 的聊天类型确定会话信息
    const conversationType = this.resolveConversationType(chatType);
    const conversationId = conversationType === 'singleChat' ? senderId : receiverId;

    // 内容体到 MessageBody 的映射
    const decoded = this.decodeContent(firstContent);
    if (!decoded) {
      return null;
    }

    // 解析扩展字段与时间戳
    const ext = decodeKeyValueList(messageBody.ext as Array<Record<string, unknown>> | undefined);
    const metaExt = decodeKeyValueList(meta.ext as Array<Record<string, unknown>> | undefined);
    const timestamp = Number(longToString(meta.timestamp)) || Date.now();
    const msgServerId = longToString(meta.id);
    const isBroadcast = this.resolveBroadcast(metaExt);
    const priority = this.resolvePriority(metaExt);
    const messageMeta = this.resolveMessageMetaPayload(messageBody.meta, meta.meta);
    const isContentReplaced = this.resolveContentReplaced(messageMeta);
    const reactions = this.resolveReactions(messageMeta);
    const modifiedInfo = this.resolveModifiedInfo(messageMeta);

    const resolvedUserInfoUpdateTime = this.resolveProfileVersionTime(
      messageBody.userInfoUpdateTime
    );
    const resolvedNamecardUpdateTime = this.resolveProfileVersionTime(
      messageBody.namecardUpdateTime
    );

    const decodedMessage: Message = {
      msgServerId,
      msgLocalId: '',
      from: senderId,
      to: receiverId,
      sender: { userId: senderId },
      conversationId,
      conversationType,
      type: decoded.type,
      status: 'sent',
      ext,
      timestamp,
      body: decoded.body,
      direct: 'RECEIVE',
      isOnline: this.resolveMessageIsOnline(chatType, metaExt),
    };
    setMessageProfileVersionSidecar(decodedMessage, {
      userInfoUpdateTime: resolvedUserInfoUpdateTime,
      namecardUpdateTime: resolvedNamecardUpdateTime,
    });

    const streamMeta = this.decodeStreamMeta(messageBody.stream, firstContent);
    if (streamMeta) {
      decodedMessage.type = 'text';
      decodedMessage.body = {
        content: streamMeta.fullText,
      };
      decodedMessage.stream = streamMeta;
    }

    if (decoded.type === 'combine') {
      const combineBody = decoded.body as CombineMessageBody;
      decodedMessage.combineLevel = combineBody.combineLevel;
    }

    if (isBroadcast !== undefined) {
      decodedMessage.isBroadcast = isBroadcast;
    }
    if (priority !== undefined) {
      decodedMessage.priority = priority;
    }
    if (isContentReplaced !== undefined) {
      decodedMessage.isContentReplaced = isContentReplaced;
    }
    if (reactions) {
      decodedMessage.reactions = reactions;
    }
    if (modifiedInfo) {
      decodedMessage.modifiedInfo = modifiedInfo;
    }
    const msgConfig = messageBody.msgConfig as Record<string, unknown> | undefined;
    if (msgConfig?.allowGroupAck) {
      decodedMessage.needGroupReadReceipt = true;
    }

    return decodedMessage;
  }

  private resolveMessageProfileVersionFields(message: Message): Record<string, number> {
    const sidecar = getMessageProfileVersionSidecar(message);
    const fields: Record<string, number> = {};
    if (typeof sidecar?.userInfoUpdateTime === 'number') {
      fields.userInfoUpdateTime = sidecar.userInfoUpdateTime;
    }
    if (
      message.conversationType === 'groupChat' &&
      typeof sidecar?.namecardUpdateTime === 'number'
    ) {
      fields.namecardUpdateTime = sidecar.namecardUpdateTime;
    }
    return fields;
  }

  private resolveProfileVersionTime(value: unknown): number | undefined {
    return normalizeProfileVersionSeconds(longToString(value));
  }

  private isPublicMessageType(type: number): boolean {
    return (
      type === MsyncMessageType.SINGLECHAT ||
      type === MsyncMessageType.GROUPCHAT ||
      type === MsyncMessageType.CHATROOM
    );
  }

  private resolveMessageIsOnline(
    chatType: number,
    metaExt: Record<string, unknown>
  ): boolean {
    if (chatType === MsyncMessageType.CHATROOM) {
      return true;
    }
    const rawIsOnline = metaExt.is_online;
    if (typeof rawIsOnline === 'boolean') {
      return rawIsOnline;
    }
    if (typeof rawIsOnline === 'number') {
      return rawIsOnline !== 0;
    }
    if (typeof rawIsOnline === 'string') {
      return rawIsOnline !== '0';
    }
    return true;
  }

  private decodeStreamMeta(
    rawStream: unknown,
    content: Record<string, unknown> | undefined
  ): StreamMessageMeta | undefined {
    if (!rawStream || typeof rawStream !== 'object') {
      return undefined;
    }
    const stream = rawStream as Record<string, unknown>;
    const seqRaw = Number(longToString(stream.streamSeq));
    if (!Number.isFinite(seqRaw)) {
      return undefined;
    }
    const rawStatus =
      typeof stream.streamStatus === 'number'
        ? stream.streamStatus
        : MsyncStreamStatus.STREAM_IN_PROGRESS;
    const errorType = typeof stream.streamError === 'number' ? stream.streamError : 0;
    const finishReason =
      typeof stream.streamFinishReason === 'number' ? stream.streamFinishReason : undefined;
    const deltaText = this.resolveContentText(content);
    const fullText = deltaText;
    return {
      customType: typeof stream.streamType === 'string' ? stream.streamType : undefined,
      seq: seqRaw,
      status: this.mapStreamStatus(rawStatus, errorType),
      errorType,
      finishReason,
      deltaText,
      fullText,
    };
  }

  private mapStreamStatus(rawStatus: number, errorType: number): StreamMessageStatus {
    if (errorType > 0) {
      return StreamStatus.ERROR;
    }
    if (rawStatus === MsyncStreamStatus.STREAM_START) {
      return StreamStatus.START;
    }
    if (rawStatus === MsyncStreamStatus.STREAM_COMPLETED) {
      return StreamStatus.COMPLETED;
    }
    if (rawStatus === MsyncStreamStatus.STREAM_FULL) {
      return StreamStatus.FULL;
    }
    return StreamStatus.IN_PROGRESS;
  }

  private resolveContentText(content: Record<string, unknown> | undefined): string {
    if (content && typeof content.text === 'string') {
      return content.text;
    }
    if (content && typeof content.customEvent === 'string') {
      return content.customEvent;
    }
    return '';
  }

  private buildContent(message: Message): Record<string, unknown> {
    // 文本消息
    if (message.type === 'text') {
      const body = message.body as TextMessageBody;
      return { type: ContentType.TEXT, text: body.content };
    }
    // 命令消息
    if (message.type === 'cmd') {
      const body = message.body as CmdMessageBody;
      return {
        type: ContentType.COMMAND,
        action: body.action,
        params: encodeKeyValueRecord(body.params ?? {}),
      };
    }
    // 自定义消息
    if (message.type === 'custom') {
      const body = message.body as CustomMessageBody;
      return {
        type: ContentType.CUSTOM,
        customEvent: body.event,
        customExts: encodeKeyValueRecord(body.params ?? {}),
      };
    }
    if (message.type === 'location') {
      const body = message.body as LocationMessageBody;
      return {
        type: ContentType.LOCATION,
        latitude: body.latitude,
        longitude: body.longitude,
        address: body.address,
        buildingName: body.buildingName,
      };
    }
    if (message.type === 'image') {
      const body = message.body as ImageMessageBody;
      // 协议层固定以上传后的 originalImageUrl 作为 remotePath，并用 1/2 表达原图/大图发送语义。
      const normalizedImageType = body.isGif || body.isOriginalImage ? 'original' : 'large';
      return {
        type: ContentType.IMAGE,
        displayName: body.filename,
        remotePath: body.originalImageUrl ?? '',
        imageType: toProtocolImageType(normalizedImageType),
        secretKey: body.secret,
        fileLength: body.fileLength,
        size: {
          width: body.width,
          height: body.height,
        },
        subType: body.isGif ? 1 : undefined,
        thumbnailRemotePath: body.thumbnailUrl,
        thumbnailDisplayName: body.filename,
      };
    }
    if (message.type === 'video') {
      const body = message.body as VideoMessageBody;
      return {
        type: ContentType.VIDEO,
        displayName: body.filename,
        remotePath: body.url,
        secretKey: body.secret,
        fileLength: body.fileLength,
        duration: body.duration,
        size:
          body.width && body.height
            ? {
                width: body.width,
                height: body.height,
              }
            : undefined,
        thumbnailRemotePath: body.thumbnailUrl,
        thumbnailSecretKey: body.secret,
        thumbnailDisplayName: body.filename,
      };
    }
    if (message.type === 'voice') {
      const body = message.body as VoiceMessageBody;
      return {
        type: ContentType.VOICE,
        displayName: body.filename,
        remotePath: body.url,
        secretKey: body.secret,
        fileLength: body.fileLength,
        duration: body.duration,
        thumbnailDisplayName: body.filename,
      };
    }
    if (message.type === 'combine') {
      const body = message.body as CombineMessageBody;
      return {
        type: ContentType.COMBINE,
        subType: 0,
        text: body.compatibleText,
        displayName: body.filename,
        remotePath: body.url,
        secretKey: body.secret,
        fileLength: body.fileLength,
        title: body.title,
        summary: body.summary,
        combineLevel: message.combineLevel ?? body.combineLevel,
      };
    }
    const body = message.body as FileMessageBody;
    return {
      type: ContentType.FILE,
      displayName: body.filename,
      remotePath: body.url,
      secretKey: body.secret,
      fileLength: body.fileLength,
      thumbnailDisplayName: body.filename,
    };
  }

  private decodeContent(
    content: Record<string, unknown>
  ): { type: Message['type']; body: MessageBody } | null {
    // 根据 Content.Type 解析不同消息体
    const type = typeof content.type === 'number' ? content.type : ContentType.TEXT;
    const hasCombineHints =
      (typeof content.remotePath === 'string' && content.remotePath.length > 0) ||
      (typeof content.title === 'string' && content.title.length > 0) ||
      (typeof content.summary === 'string' && content.summary.length > 0) ||
      (typeof content.combineLevel === 'number' && content.combineLevel > 0);
    const isCombineBySubtype =
      type === ContentType.TEXT && content.subType === 0 && hasCombineHints;
    if (type === ContentType.COMBINE || isCombineBySubtype) {
      const body: CombineMessageBody = {
        title: typeof content.title === 'string' ? content.title : '',
        summary: typeof content.summary === 'string' ? content.summary : '',
        compatibleText: typeof content.text === 'string' ? content.text : '[聊天记录]',
        filename: typeof content.displayName === 'string' ? content.displayName : 'combine',
        filetype: 'application/octet-stream',
        url: typeof content.remotePath === 'string' ? content.remotePath : undefined,
        secret: typeof content.secretKey === 'string' ? content.secretKey : undefined,
        fileLength: typeof content.fileLength === 'number' ? content.fileLength : undefined,
        combineLevel: typeof content.combineLevel === 'number' ? content.combineLevel : 0,
      };
      return { type: 'combine', body };
    }
    if (type === ContentType.TEXT) {
      return {
        type: 'text',
        body: { content: typeof content.text === 'string' ? content.text : '' },
      };
    }
    if (type === ContentType.COMMAND) {
      const params = decodeKeyValueList(
        content.params as Array<Record<string, unknown>> | undefined
      );
      return {
        type: 'cmd',
        body: {
          action: typeof content.action === 'string' ? content.action : '',
          params: params as Record<string, string>,
        },
      };
    }
    if (type === ContentType.CUSTOM) {
      const params = decodeKeyValueList(
        content.customExts as Array<Record<string, unknown>> | undefined
      );
      return {
        type: 'custom',
        body: {
          event: typeof content.customEvent === 'string' ? content.customEvent : '',
          params: params as Record<string, string>,
        },
      };
    }
    if (type === ContentType.LOCATION) {
      return {
        type: 'location',
        body: {
          latitude: typeof content.latitude === 'number' ? content.latitude : 0,
          longitude: typeof content.longitude === 'number' ? content.longitude : 0,
          address: typeof content.address === 'string' ? content.address : undefined,
          buildingName: typeof content.buildingName === 'string' ? content.buildingName : undefined,
        },
      };
    }
    if (type === ContentType.IMAGE) {
      const size = (content.size ?? {}) as Record<string, unknown>;
      const width = typeof size.width === 'number' ? size.width : 0;
      const height = typeof size.height === 'number' ? size.height : 0;
      // 下行统一还原成 SDK 的图片视图：localUrl 置空，imageType 用 original|large，三条远端 URL 按规则派生。
      const isOriginalImage = fromProtocolImageType(content.imageType) === IMAGE_TYPE_ORIGINAL;
      const remotePath = typeof content.remotePath === 'string' ? content.remotePath : '';
      const imageUrls = deriveImageUrls(remotePath, {
        deriveVariants: !this.useCustomAttachmentUpload,
      });
      const thumbnailRemotePath =
        typeof content.thumbnailRemotePath === 'string' && content.thumbnailRemotePath.length > 0
          ? content.thumbnailRemotePath
          : undefined;
      const body: ImageMessageBody = {
        localUrl: '',
        filename: typeof content.displayName === 'string' ? content.displayName : 'image',
        filetype: 'application/octet-stream',
        width,
        height,
        isGif: content.subType === 1,
        isOriginalImage,
        originalImageUrl: imageUrls.originalImageUrl,
        bigImageUrl: imageUrls.bigImageUrl,
        secret: typeof content.secretKey === 'string' ? content.secretKey : undefined,
        fileLength: typeof content.fileLength === 'number' ? content.fileLength : undefined,
        thumbnailUrl: thumbnailRemotePath ?? imageUrls.thumbnailUrl,
      };
      return { type: 'image', body };
    }
    if (type === ContentType.VIDEO) {
      const size = (content.size ?? {}) as Record<string, unknown>;
      const width = typeof size.width === 'number' ? size.width : undefined;
      const height = typeof size.height === 'number' ? size.height : undefined;
      const thumbnailRemotePath =
        typeof content.thumbnailRemotePath === 'string' ? content.thumbnailRemotePath : undefined;
      const body: VideoMessageBody = {
        url: typeof content.remotePath === 'string' ? content.remotePath : '',
        filename: typeof content.displayName === 'string' ? content.displayName : 'video',
        filetype: 'application/octet-stream',
        duration: typeof content.duration === 'number' ? content.duration : 0,
        width,
        height,
        secret: typeof content.secretKey === 'string' ? content.secretKey : undefined,
        fileLength: typeof content.fileLength === 'number' ? content.fileLength : undefined,
        thumbnailUrl: thumbnailRemotePath,
      };
      return { type: 'video', body };
    }
    if (type === ContentType.VOICE) {
      const body: VoiceMessageBody = {
        url: typeof content.remotePath === 'string' ? content.remotePath : '',
        filename: typeof content.displayName === 'string' ? content.displayName : 'voice',
        filetype: 'application/octet-stream',
        duration: typeof content.duration === 'number' ? content.duration : 0,
        secret: typeof content.secretKey === 'string' ? content.secretKey : undefined,
        fileLength: typeof content.fileLength === 'number' ? content.fileLength : undefined,
      };
      return { type: 'voice', body };
    }
    if (type === ContentType.FILE) {
      const body: FileMessageBody = {
        url: typeof content.remotePath === 'string' ? content.remotePath : '',
        filename: typeof content.displayName === 'string' ? content.displayName : 'file',
        filetype: 'application/octet-stream',
        secret: typeof content.secretKey === 'string' ? content.secretKey : undefined,
        fileLength: typeof content.fileLength === 'number' ? content.fileLength : undefined,
      };
      return { type: 'file', body };
    }
    return null;
  }

  private resolveChatType(message: Message): number {
    // 根据会话类型选择 MSync 的聊天类型
    switch (message.conversationType) {
      case 'groupChat':
        return MsyncMessageType.GROUPCHAT;
      case 'chatRoom':
        return MsyncMessageType.CHATROOM;
      case 'singleChat':
      default:
        return MsyncMessageType.SINGLECHAT;
    }
  }

  private resolveActionConversationType(
    messageType: number,
    receiverDomain: string | undefined,
    rawMeta: unknown,
    rawMessageBody?: Record<string, unknown>
  ): ChatConversationType {
    if (messageType === MsyncMessageType.CHANNEL_ACK) {
      return 'singleChat';
    }

    const metadataConversationType = this.resolveConversationTypeFromMeta(rawMeta);
    if (metadataConversationType) {
      return metadataConversationType;
    }

    const msgConfig =
      rawMessageBody?.msgConfig && typeof rawMessageBody.msgConfig === 'object'
        ? (rawMessageBody.msgConfig as Record<string, unknown>)
        : null;
    if (msgConfig?.allowGroupAck === true) {
      return 'groupChat';
    }

    if (receiverDomain === 'conference.easemob.com') {
      return 'groupChat';
    }
    return 'singleChat';
  }

  private resolveConversationTypeFromMeta(rawMeta: unknown): ChatConversationType | null {
    if (typeof rawMeta !== 'string' || rawMeta.length === 0) {
      return null;
    }

    try {
      const parsed = JSON.parse(rawMeta) as Record<string, unknown>;
      const editMessage =
        parsed.edit_msg && typeof parsed.edit_msg === 'object'
          ? (parsed.edit_msg as Record<string, unknown>)
          : undefined;
      const chatType =
        (typeof parsed.chat_type === 'string' ? parsed.chat_type : undefined) ??
        (typeof parsed.chatType === 'string' ? parsed.chatType : undefined) ??
        (typeof parsed.type === 'string' ? parsed.type : undefined) ??
        (typeof editMessage?.chat_type === 'string' ? editMessage.chat_type : undefined);
      if (chatType === 'chat:user' || chatType === 'singleChat') {
        return 'singleChat';
      }
      if (chatType === 'chat:group' || chatType === 'groupChat') {
        return 'groupChat';
      }
      if (chatType === 'chat:room' || chatType === 'chatRoom') {
        return 'chatRoom';
      }
    } catch {
      // ignore malformed metadata
    }

    return null;
  }

  private resolveActionConversationId(
    senderId: string,
    receiverId: string,
    conversationType: ChatConversationType
  ): string {
    if (conversationType === 'singleChat') {
      return receiverId === this.context.userId ? senderId : receiverId;
    }
    return receiverId;
  }

  private resolveActionMessageType(action: MessageActionRequest): number {
    switch (action.kind) {
      case 'conversationRead':
        return MsyncMessageType.CHANNEL_ACK;
      case 'messageRead':
      case 'groupMessageRead':
        return MsyncMessageType.READ_ACK;
      case 'deliveryAck':
        return MsyncMessageType.DELIVER_ACK;
      case 'recall':
        return MsyncMessageType.RECALL;
      case 'update':
        return MsyncMessageType.EDIT;
      default:
        return MsyncMessageType.SINGLECHAT;
    }
  }

  private resolveConversationType(type: number): ChatConversationType {
    // MSync 的聊天类型映射为 SDK 的会话类型
    if (type === MsyncMessageType.GROUPCHAT) {
      return 'groupChat';
    }
    if (type === MsyncMessageType.CHATROOM) {
      return 'chatRoom';
    }
    return 'singleChat';
  }

  private resolveDirectedUsers(message: Message): string[] {
    if (message.conversationType === 'singleChat') {
      return [];
    }
    return Array.isArray(message.receiverList) ? message.receiverList : [];
  }

  private resolveDeliverOnlineOnly(message: Message): boolean {
    if (typeof message.deliverOnlineOnly === 'boolean') {
      return message.deliverOnlineOnly;
    }
    if (message.type === 'cmd') {
      const body = message.body as CmdMessageBody;
      return Boolean(body.deliverOnlineOnly);
    }
    return false;
  }

  private resolveMetaExt(message: Message): Array<Record<string, unknown>> {
    if (message.conversationType !== 'chatRoom') {
      return [];
    }
    if (!message.priority) {
      return [];
    }
    return encodeKeyValueRecord({
      chatroom_msg_tag: this.mapPriorityToTag(message.priority),
    });
  }

  private resolveRouteType(message: Message): number {
    const directedUsers = this.resolveDirectedUsers(message);
    if (directedUsers.length > 0) {
      return RouteType.ROUTE_DIRECT;
    }
    if (this.resolveDeliverOnlineOnly(message)) {
      return RouteType.ROUTE_ONLINE;
    }
    return RouteType.ROUTE_ALL;
  }

  private resolveBroadcast(metaExt: Record<string, unknown>): boolean | undefined {
    if (!Object.prototype.hasOwnProperty.call(metaExt, 'is_broadcast')) {
      return undefined;
    }
    const raw = metaExt.is_broadcast;
    if (typeof raw === 'boolean') {
      return raw;
    }
    if (typeof raw === 'number') {
      return raw !== 0;
    }
    if (typeof raw === 'string') {
      return raw === '1' || raw.toLowerCase() === 'true';
    }
    return Boolean(raw);
  }

  private resolvePriority(metaExt: Record<string, unknown>): MessagePriority | undefined {
    if (!Object.prototype.hasOwnProperty.call(metaExt, 'chatroom_msg_tag')) {
      return undefined;
    }
    const raw = Number(metaExt.chatroom_msg_tag);
    if (raw === 0) {
      return 'high';
    }
    if (raw === 2) {
      return 'low';
    }
    return 'normal';
  }

  private resolveContentReplaced(metaPayload: unknown): boolean | undefined {
    const parsed = this.parseMetaPayload(metaPayload);
    if (!parsed || !Object.prototype.hasOwnProperty.call(parsed, 'callback_replace')) {
      return undefined;
    }
    return Boolean(parsed.callback_replace);
  }

  private resolveMessageMetaPayload(primaryPayload: unknown, fallbackPayload: unknown): unknown {
    const primary = this.parseMetaPayload(primaryPayload);
    const fallback = this.parseMetaPayload(fallbackPayload);
    if (primary && fallback) {
      return { ...fallback, ...primary };
    }
    return primary ?? fallback ?? primaryPayload ?? fallbackPayload;
  }

  private resolveModifiedInfo(metaPayload: unknown): MessageModifiedInfo | undefined {
    const parsed = this.parseMetaPayload(metaPayload);
    const editMessage = parsed?.edit_msg;
    if (!isRecord(editMessage)) {
      return undefined;
    }
    const operatorId = typeof editMessage.operator === 'string' ? editMessage.operator : '';
    const operationCount = this.toFiniteNumber(editMessage.count);
    const operationTime = this.toFiniteNumber(editMessage.edit_time);
    if (!operatorId || operationCount === undefined || operationTime === undefined) {
      return undefined;
    }
    return {
      operatorId,
      operationCount,
      operationTime,
    };
  }

  private parseMetaPayload(metaPayload: unknown): Record<string, unknown> | null {
    const payload = this.normalizeMetaPayload(metaPayload);
    if (payload) {
      if (payload.length === 0) {
        return null;
      }
      try {
        const parsed = JSON.parse(new TextDecoder().decode(payload)) as unknown;
        return isRecord(parsed) ? parsed : null;
      } catch {
        return null;
      }
    }
    if (isRecord(metaPayload)) {
      return metaPayload;
    }
    if (typeof metaPayload === 'string') {
      try {
        const parsed = JSON.parse(metaPayload) as unknown;
        return isRecord(parsed) ? parsed : null;
      } catch {
        return null;
      }
    }
    return null;
  }

  private toFiniteNumber(value: unknown): number | undefined {
    const parsed =
      typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private resolveReactions(metaPayload: unknown): Message['reactions'] {
    const parsed = this.parseMetaPayload(metaPayload);
    const reactionList = parsed?.reaction;
    if (!Array.isArray(reactionList) || reactionList.length === 0) {
      return undefined;
    }
    return reactionList
      .filter(isRecord)
      .map(item => ({
        reaction: typeof item.reaction === 'string' ? item.reaction : '',
        count: typeof item.count === 'number' ? item.count : 0,
        userList: Array.isArray(item.userList)
          ? item.userList.filter((u): u is string => typeof u === 'string')
          : [],
        isAddedBySelf: typeof item.state === 'boolean' ? item.state : undefined,
      }));
  }

  private normalizeMetaPayload(payload: unknown): Uint8Array | null {
    if (payload instanceof Uint8Array) {
      return payload;
    }
    if (payload instanceof ArrayBuffer) {
      return new Uint8Array(payload);
    }
    if (ArrayBuffer.isView(payload)) {
      return new Uint8Array(payload.buffer, payload.byteOffset, payload.byteLength);
    }
    return null;
  }

  private mapPriorityToTag(priority: MessagePriority): number {
    if (priority === 'high') {
      return 0;
    }
    if (priority === 'low') {
      return 2;
    }
    return 1;
  }

  private createTraceId(): string {
    // traceId 使用时间戳 + 随机数拼接，保持可读且唯一
    return `${Date.now()}${Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, '0')}`;
  }

  private getRequestedCompressTypes(): number[] {
    if (this.compressionFailureCount >= this.maxCompressionFailures) {
      return [];
    }
    return [CompressType.COMPRESS_LZ4];
  }

  private configureCompression(
    protocolCompressType?: number[],
    protocolCompressDirection?: number
  ): void {
    if (!protocolCompressType || !protocolCompressType.includes(CompressType.COMPRESS_LZ4)) {
      this.disableCompression();
      return;
    }

    if (!this.compressor) {
      this.compressor = createLZ4Compressor();
    }

    const mode = this.resolveCompressionMode(protocolCompressDirection);
    this.compressor.mode = mode;
    this.compressor.enableUplinkCompression =
      mode === CompressionMode.UPLINK_ONLY || mode === CompressionMode.BIDIRECTIONAL;
    this.compressor.enableDownlinkCompression =
      mode === CompressionMode.DOWNLINK_ONLY || mode === CompressionMode.BIDIRECTIONAL;
  }

  private resolveCompressionMode(direction?: number): CompressionMode {
    if (direction === 0) {
      return CompressionMode.UPLINK_ONLY;
    }
    if (direction === 1) {
      return CompressionMode.DOWNLINK_ONLY;
    }
    if (direction === 2) {
      return CompressionMode.BIDIRECTIONAL;
    }
    return CompressionMode.NONE;
  }

  private disableCompression(): void {
    if (this.compressor) {
      this.compressor.mode = CompressionMode.NONE;
      this.compressor.enableUplinkCompression = false;
      this.compressor.enableDownlinkCompression = false;
    }
  }
}
