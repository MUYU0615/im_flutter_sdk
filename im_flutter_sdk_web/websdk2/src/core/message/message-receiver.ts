/**
 * 消息接收器
 *
 * 负责处理下行 SYNC 消息：解析 ACK 与聊天消息，并派发事件。
 */

import { ChatEventName, ContactEventName, InternalEventName, PresenceEventName } from '../../types'; // 事件名称常量
import { logger } from '../../utils/logger'; // 日志工具
// MessageSendError 类型已由实现类覆盖，无需额外类型导入
import { MessageSendError as MessageSendErrorClass } from '../../utils/errors'; // 发送错误类型
import { ERROR_CODES } from '../../utils/error-codes'; // 错误码
import { resolveProvisionErrorCode } from '../../utils/provision-error-mapping'; // 错误码映射
import { EventHub } from '../events/event-hub'; // 事件中心
import { isStreamMessage } from '../../types'; // 流式消息守卫
import type { ConversationType } from '../../types/conversation';
import type {
  ChatThreadRawNotifyEvent,
  ChatRoomRawNotifyEvent,
  ContactRosterEventPayload,
  GroupRawNotifyEvent,
  Message,
  MessageReadEventPayload,
  MessageUpdatedEventPayload,
  PresenceState,
  PresenceStatusDetails,
  UserInfoRawNotifyEvent,
} from '../../types'; // 消息与在线状态类型
import type {
  MultiDeviceContactEvent,
  MultiDeviceConversationEvent,
  MultiDeviceGroupEvent,
  MultiDeviceMessageRemovedEvent,
  MultiDeviceThreadEvent,
} from '../../types/multi-device';
import type {
  MsyncCodec,
  AckResult,
  NotifyEvent,
  SyncDecodeResult,
} from '../../protocol/msync/codec'; // 协议类型
import type { MessageSender } from './message-sender'; // 发送器类型
import { StreamMessageHandler } from './stream-message-handler';

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

type MessageConversationContext = {
  readonly conversationId: string;
  readonly conversationType: ConversationType;
};

const MESSAGE_CONTEXT_CACHE_LIMIT = 500;

/**
 * 消息接收器
 */
export class MessageReceiver {
  private eventHub: EventHub;
  private messageSender: MessageSender;
  private msyncCodec: MsyncCodec;
  private streamMessageHandler: StreamMessageHandler;
  private readonly messageContexts: Map<string, MessageConversationContext>;
  private enableDeliveryReceipt: boolean;

  constructor(msyncCodec: MsyncCodec, messageSender: MessageSender, eventHub: EventHub) {
    this.eventHub = eventHub;
    this.messageSender = messageSender;
    this.msyncCodec = msyncCodec;
    this.streamMessageHandler = new StreamMessageHandler(eventHub);
    this.messageContexts = new Map();
    this.enableDeliveryReceipt = false;
  }

  setDeliveryAckEnabled(enabled: boolean): void {
    this.enableDeliveryReceipt = enabled;
  }

  rememberSentMessageContext(message: Message): void {
    if (message.status !== 'sent') {
      return;
    }
    this.rememberMessageContext(message);
  }

  /**
   * 处理 SYNC payload，分离 ACK 与聊天消息
   */
  handleSyncPayload(payload: Uint8Array): SyncDecodeResult | null {
    try {
      logger.debug('handleSyncPayload payload', { length: payload.length }); // 记录 payload 长度
      const result = this.msyncCodec.decodeSync(payload);
      logger.debug('handleSyncPayload result', {
        ack: Boolean(result.ack),
        messageCount: result.messages.length,
      }); // 记录解析结果
      const { ack, messages } = result;
      if (result.notifies && result.notifies.length > 0) {
        // 检查通知事件
        this.handleNotifies(result.notifies); // 处理通知事件
      } // 通知处理结束
      if (ack) {
        logger.warn('Decoded sync ACK', {
          ok: ack.ok,
          protocolId: ack.protocolId,
          serverId: ack.serverId ?? null,
          statusCode: ack.statusCode ?? null,
          reason: ack.reason ?? null,
          hasReplacedMessage: Boolean(result.replacedMessage),
        });
        this.handleAck(ack, result.replacedMessage);
      }

      for (const message of messages) {
        this.dispatchMessage(message);
      }
      return result;
    } catch (error) {
      logger.error('Failed to decode sync payload', error);
    }
    return null;
  }

  /**
   * 处理 ACK 回包
   */
  private handleAck(ack: AckResult, replacedMessage?: Message): void {
    if (ack.ok) {
      logger.warn('ACK accepted', {
        protocolId: ack.protocolId,
        serverId: ack.serverId ?? null,
        hasReplacedMessage: Boolean(replacedMessage),
      });
      this.messageSender.handleAck(ack.protocolId, ack.serverId, replacedMessage);
      return;
    }
    logger.warn('ACK rejected', {
      protocolId: ack.protocolId,
      statusCode: ack.statusCode,
      reason: ack.reason,
      hasReplacedMessage: Boolean(replacedMessage),
    });
    const mappedCode = resolveProvisionErrorCode(ack.statusCode, ack.reason); // 映射错误码
    const error = new MessageSendErrorClass('Message send failed', {
      code: mappedCode === ERROR_CODES.UNKNOWN ? ERROR_CODES.MESSAGE_SEND_FAILED : mappedCode,
      details: {
        protocolId: ack.protocolId,
        serverCode: ack.statusCode,
        reason: ack.reason,
        retryable: false,
      },
    });
    this.messageSender.handleAckFailure(ack.protocolId, ack.statusCode, ack.reason, error); // 传递发送错误
  }

  /**
   * 派发消息事件
   */
  private dispatchMessage(message: Message): void {
    if (isStreamMessage(message)) {
      this.streamMessageHandler.handle(message);
      return;
    }
    this.rememberMessageContext(message);
    this.sendDeliveryAckIfNeeded(message);
    this.eventHub.dispatch(ChatEventName.MESSAGE, message); // 派发消息事件
    logger.debug('Message received', { msgServerId: message.msgServerId });
  }

  private sendDeliveryAckIfNeeded(message: Message): void {
    if (!this.enableDeliveryReceipt) {
      return;
    }
    if (message.conversationType !== 'singleChat') {
      return;
    }
    const currentUserId = this.msyncCodec.getContext().userId;
    if (!currentUserId || message.from === currentUserId) {
      return;
    }
    this.messageSender
      .sendAction({
        kind: 'deliveryAck',
        conversationId: message.from,
        conversationType: 'singleChat',
        messageId: message.msgServerId ?? message.msgLocalId,
      })
      .catch((err) => {
        logger.warn('Failed to send delivery ack', err);
      });
  }

  private handleNotifies(notifies: ReadonlyArray<NotifyEvent>): void {
    // 处理通知事件
    const messageReadPayloads: MessageReadEventPayload[] = [];
    for (const notify of notifies) {
      // 遍历通知事件
      if (notify.type === 'presence') {
        // 过滤在线状态事件
        this.handlePresenceNotify(notify); // 处理在线状态事件
      } else if (notify.type === 'contact') {
        this.handleContactNotify(notify);
      } else if (notify.type === 'group') {
        this.handleGroupNotify(notify);
      } else if (notify.type === 'thread') {
        this.handleChatThreadNotify(notify);
      } else if (notify.type === 'chatroom') {
        this.handleChatRoomNotify(notify);
      } else if (notify.type === 'reaction') {
        this.handleReactionNotify(notify);
      } else if (notify.type === 'conv') {
        this.handleConversationNotify(notify);
      } else if (notify.type === 'multiDevice') {
        this.handleMultiDeviceNotify(notify);
      } else if (notify.type === 'message_read') {
        const payload = this.toMessageReadPayload(notify);
        if (payload) {
          messageReadPayloads.push(payload);
        }
      } else if (notify.type === 'conversation_read') {
        this.handleConversationReadNotify(notify);
      } else if (notify.type === 'message_recalled') {
        this.handleMessageRecalledNotify(notify);
      } else if (notify.type === 'message_updated') {
        this.handleMessageUpdatedNotify(notify);
      } else if (notify.type === 'message_delivered') {
        this.handleMessageDeliveredNotify(notify);
      } else {
        this.handleUserInfoNotify(notify);
      } // 在线状态判断结束
    } // 遍历结束
    if (messageReadPayloads.length > 0) {
      this.eventHub.dispatch(ChatEventName.MESSAGE_READ, messageReadPayloads);
    }
  }

  private handleUserInfoNotify(notify: NotifyEvent): void {
    const notifyType =
      notify.type === 'subscribe_metadata_updated' ||
      notify.type === 'contact_metadata_updated' ||
      notify.type === 'user_metadata_updated'
        ? notify.type
        : notify.eventName === 'subscribe_metadata_updated' ||
            notify.eventName === 'contact_metadata_updated' ||
            notify.eventName === 'user_metadata_updated'
          ? notify.eventName
          : null;
    if (!notifyType) {
      return;
    }

    const data = notify.data;
    if (!data || typeof data !== 'object') {
      return;
    }

    const payload = data as Record<string, unknown>;
    const userId =
      typeof payload.username === 'string'
        ? payload.username
        : typeof payload.userId === 'string'
          ? payload.userId
          : notifyType === 'user_metadata_updated'
            ? this.msyncCodec.getContext().userId
            : '';
    const metadata =
      payload.metadata && typeof payload.metadata === 'object' && !Array.isArray(payload.metadata)
        ? (payload.metadata as Record<string, unknown>)
        : null;
    const lastModified =
      typeof payload.lastModified === 'number'
        ? payload.lastModified
        : typeof payload.lastModified === 'string'
          ? Number(payload.lastModified)
          : Number.NaN;

    if (!userId || !metadata || !Number.isFinite(lastModified)) {
      return;
    }

    const normalized: UserInfoRawNotifyEvent = {
      notifyType,
      userId,
      metadata,
      lastModified,
    };
    this.eventHub.dispatch(InternalEventName.USER_INFO_NOTIFY, normalized);
  }

  private handleContactNotify(notify: NotifyEvent): void {
    if (typeof notify.eventName !== 'string') {
      return;
    }
    if (
      notify.eventName !== ContactEventName.INVITED &&
      notify.eventName !== ContactEventName.DELETED &&
      notify.eventName !== ContactEventName.ADDED &&
      notify.eventName !== ContactEventName.REFUSE &&
      notify.eventName !== ContactEventName.AGREED
    ) {
      return;
    }

    const data = notify.data;
    if (!data || typeof data !== 'object') {
      return;
    }

    const payload = data as ContactRosterEventPayload;
    if (
      typeof payload.from !== 'string' ||
      !payload.from ||
      typeof payload.to !== 'string' ||
      !payload.to ||
      typeof payload.status !== 'string' ||
      typeof payload.type !== 'string'
    ) {
      return;
    }

    this.eventHub.dispatch(notify.eventName, payload);
  }

  private handlePresenceNotify(notify: NotifyEvent): void {
    // 处理在线状态通知
    const data = notify.data; // 读取通知数据
    if (!data || typeof data !== 'object') {
      // 校验通知数据
      return; // 无效数据直接返回
    } // 校验结束
    const record = data as Record<string, unknown>; // 收敛为对象
    const values = Array.isArray(record.values) ? record.values : []; // 读取 values 列表
    if (values.length === 0) {
      // 校验列表
      return; // 无数据直接返回
    } // 校验结束
    const states: PresenceState[] = []; // 初始化状态列表
    for (const item of values) {
      // 遍历列表
      if (!item || typeof item !== 'object') {
        // 校验条目
        continue; // 跳过非法条目
      } // 校验结束
      const itemRecord = item as Record<string, unknown>; // 收敛条目
      const statusDetails = this.normalizePresenceStatus(itemRecord.status); // 解析状态详情
      const userId = typeof itemRecord.uid === 'string' ? itemRecord.uid : ''; // 读取用户 ID
      if (!userId) {
        // 校验用户 ID
        continue; // 跳过非法用户
      } // 校验结束
      states.push({
        // 追加状态
        userId, // 用户 ID
        statusDetails, // 状态详情
        ext: typeof itemRecord.ext === 'string' ? itemRecord.ext : '', // 扩展信息
        lastTime: Number(itemRecord.last_time) || 0, // 更新时间
        expire: Number(itemRecord.expiry) || 0, // 到期时间
      }); // 追加结束
    } // 遍历结束
    if (states.length === 0) {
      // 校验结果
      return; // 无有效状态直接返回
    } // 校验结束
    this.eventHub.dispatch(PresenceEventName.STATUS_CHANGE, states); // 派发在线状态事件
  }

  private handleGroupNotify(notify: NotifyEvent): void {
    const data = notify.data;
    if (!data || typeof data !== 'object') {
      return;
    }

    const payload = data as GroupRawNotifyEvent;
    if (typeof payload.eventName !== 'string') {
      return;
    }
    if (!payload.payload || typeof payload.payload !== 'object') {
      return;
    }

    this.eventHub.dispatch(InternalEventName.GROUP_NOTIFY, payload);
  }

  private handleChatRoomNotify(notify: NotifyEvent): void {
    const data = notify.data;
    if (!data || typeof data !== 'object') {
      return;
    }

    const payload = data as ChatRoomRawNotifyEvent;
    if (typeof payload.eventName !== 'string') {
      return;
    }
    if (!payload.payload || typeof payload.payload !== 'object') {
      return;
    }

    this.eventHub.dispatch(InternalEventName.CHATROOM_NOTIFY, payload);
  }

  private handleReactionNotify(notify: NotifyEvent): void {
    const reactions = Array.isArray(notify.data) ? notify.data : [];
    for (const item of reactions) {
      if (!isRecord(item) || typeof item.messageId !== 'string') {
        continue;
      }
      const reactionList = Array.isArray(item.reactions) ? item.reactions : [];
      for (const reactionItem of reactionList) {
        if (!isRecord(reactionItem) || typeof reactionItem.reaction !== 'string') {
          continue;
        }
        const operations = Array.isArray(reactionItem.op) ? reactionItem.op : [];
        if (operations.length === 0) {
          this.eventHub.dispatch(ChatEventName.REACTION_CHANGED, {
            messageId: item.messageId,
            reaction: reactionItem.reaction,
            operation: 'add',
          });
          continue;
        }
        for (const operation of operations) {
          if (!isRecord(operation) || typeof operation.reactionType !== 'string') {
            continue;
          }
          this.eventHub.dispatch(ChatEventName.REACTION_CHANGED, {
            messageId: item.messageId,
            reaction: reactionItem.reaction,
            operation: operation.reactionType === 'delete' ? 'remove' : 'add',
          });
        }
      }
    }
  }

  private handleConversationNotify(notify: NotifyEvent): void {
    if (!isRecord(notify.data)) {
      return;
    }
    const data = notify.data;
    if (data.op !== 'pin' && data.op !== 'pin_delete') {
      return;
    }
    const context = this.msyncCodec.getContext();
    if (
      typeof data.res === 'string' &&
      data.res === context.clientResource &&
      typeof data.from === 'string' &&
      data.from === context.userId
    ) {
      return;
    }
    const messageId = typeof data.ext === 'string' ? data.ext : '';
    const type = typeof data.type === 'string' ? data.type : '';
    const operatorId = typeof data.from === 'string' ? data.from : '';
    const rawConversationId = typeof data.id === 'string' ? data.id : '';
    if (!messageId || !operatorId || !rawConversationId) {
      return;
    }
    this.eventHub.dispatch(ChatEventName.PINNED_MESSAGE_CHANGED, {
      messageId,
      conversationId: type === 'chat' ? operatorId : rawConversationId,
      conversationType: type === 'chat' ? 'singleChat' : 'groupChat',
      operation: data.op === 'pin' ? 'pin' : 'unpin',
      operatorId,
      pinTime: typeof data.ts === 'number' ? data.ts : Number(data.ts) || undefined,
    });
  }

  private handleMultiDeviceNotify(notify: NotifyEvent): void {
    if (!isRecord(notify.data) || typeof notify.eventName !== 'string') {
      return;
    }

    const payload: unknown = notify.data;
    switch (notify.eventName) {
      case 'onMultiDeviceContact':
        this.eventHub.dispatch(notify.eventName, payload as MultiDeviceContactEvent);
        return;
      case 'onMultiDeviceGroup':
        this.eventHub.dispatch(notify.eventName, payload as MultiDeviceGroupEvent);
        return;
      case 'onMultiDeviceThread':
        this.eventHub.dispatch(notify.eventName, payload as MultiDeviceThreadEvent);
        return;
      case 'onMultiDeviceConversation':
        this.eventHub.dispatch(notify.eventName, payload as MultiDeviceConversationEvent);
        return;
      case 'onMultiDeviceMessageRemoved':
        this.eventHub.dispatch(notify.eventName, payload as MultiDeviceMessageRemovedEvent);
        return;
      default:
        return;
    }
  }

  private toMessageReadPayload(notify: NotifyEvent): MessageReadEventPayload | null {
    if (!isRecord(notify.data)) {
      return null;
    }
    const data = notify.data;
    if (
      typeof data.messageId !== 'string' ||
      typeof data.conversationId !== 'string' ||
      typeof data.conversationType !== 'string' ||
      typeof data.isGroupAck !== 'boolean'
    ) {
      return null;
    }
    const resolvedContext = this.resolveMessageReadContext(
      data.messageId,
      data.conversationId,
      data.conversationType,
      data.isGroupAck
    );
    return {
      messageId: data.messageId,
      conversationId: resolvedContext.conversationId,
      conversationType: resolvedContext.conversationType,
      ackContent: typeof data.ackContent === 'string' ? data.ackContent : undefined,
    };
  }

  private handleConversationReadNotify(notify: NotifyEvent): void {
    if (!isRecord(notify.data)) {
      return;
    }
    const data = notify.data;
    if (typeof data.conversationId !== 'string') {
      return;
    }
    this.eventHub.dispatch(ChatEventName.CONVERSATION_READ, {
      conversationId: data.conversationId,
      conversationType: 'singleChat',
      timestamp: typeof data.timestamp === 'number' ? data.timestamp : Date.now(),
    });
  }

  private handleMessageDeliveredNotify(notify: NotifyEvent): void {
    if (!isRecord(notify.data)) {
      return;
    }
    const data = notify.data;
    if (
      typeof data.messageId !== 'string' ||
      typeof data.conversationId !== 'string'
    ) {
      return;
    }
    this.eventHub.dispatch(ChatEventName.MESSAGE_DELIVERED, {
      messageId: data.messageId,
      conversationId: data.conversationId,
      conversationType: 'singleChat',
    });
  }

  private handleMessageRecalledNotify(notify: NotifyEvent): void {
    if (!isRecord(notify.data)) {
      return;
    }
    const data = notify.data;
    if (
      typeof data.messageId !== 'string' ||
      typeof data.conversationId !== 'string' ||
      typeof data.conversationType !== 'string'
    ) {
      return;
    }
    this.eventHub.dispatch(ChatEventName.MESSAGE_RECALLED, {
      messageId: data.messageId,
      conversationId: data.conversationId,
      conversationType:
        data.conversationType === 'chatRoom'
          ? 'chatRoom'
          : data.conversationType === 'groupChat'
            ? 'groupChat'
            : 'singleChat',
      timestamp: typeof data.timestamp === 'number' ? data.timestamp : Date.now(),
    });
  }

  private handleMessageUpdatedNotify(notify: NotifyEvent): void {
    if (!isRecord(notify.data)) {
      return;
    }
    const data = notify.data;
    if (
      typeof data.messageId !== 'string' ||
      typeof data.conversationId !== 'string' ||
      typeof data.conversationType !== 'string' ||
      !isRecord(data.message) ||
      typeof data.message.type !== 'string' ||
      !isRecord(data.message.body) ||
      !isRecord(data.message.ext)
    ) {
      return;
    }
    const normalizedMessage: MessageUpdatedEventPayload['message'] = {
      type: data.message.type as Message['type'],
      body: this.normalizeUpdatedMessageBody(
        data.message.type,
        data.message.body
      ) as unknown as MessageUpdatedEventPayload['message']['body'],
      ext: data.message.ext,
      ...(isRecord(data.message.modifiedInfo)
        ? {
            modifiedInfo: {
              operatorId:
                typeof data.message.modifiedInfo.operatorId === 'string'
                  ? data.message.modifiedInfo.operatorId
                  : '',
              operationCount:
                typeof data.message.modifiedInfo.operationCount === 'number'
                  ? data.message.modifiedInfo.operationCount
                  : 0,
              operationTime:
                typeof data.message.modifiedInfo.operationTime === 'number'
                  ? data.message.modifiedInfo.operationTime
                  : 0,
            },
          }
        : {}),
    };
    this.eventHub.dispatch(ChatEventName.MESSAGE_UPDATED, {
      messageId: data.messageId,
      conversationId: data.conversationId,
      conversationType:
        data.conversationType === 'chatRoom'
          ? 'chatRoom'
          : data.conversationType === 'groupChat'
            ? 'groupChat'
            : 'singleChat',
      message: normalizedMessage,
      timestamp: typeof data.timestamp === 'number' ? data.timestamp : Date.now(),
    });
  }

  private normalizeUpdatedMessageBody(
    type: string,
    body: Record<string, unknown>
  ): Record<string, unknown> {
    if (type !== 'text') {
      return body;
    }
    const content =
      typeof body.content === 'string'
        ? body.content
        : typeof body.message === 'string'
          ? body.message
          : undefined;
    if (content === undefined) {
      return body;
    }
    const { message: legacyMessage, ...rest } = body;
    void legacyMessage;
    return {
      ...rest,
      content,
    };
  }

  private handleChatThreadNotify(notify: NotifyEvent): void {
    const data = notify.data;
    if (!data || typeof data !== 'object') {
      return;
    }

    const payload = data as ChatThreadRawNotifyEvent;
    if (payload.eventName !== 'onChatThreadChange') {
      return;
    }
    if (!payload.payload || typeof payload.payload !== 'object') {
      return;
    }

    this.eventHub.dispatch(InternalEventName.CHAT_THREAD_NOTIFY, payload);
  }

  private normalizePresenceStatus(status: unknown): ReadonlyArray<PresenceStatusDetails> {
    // 解析状态详情
    if (!status || typeof status !== 'object') {
      // 校验状态对象
      return []; // 返回空数组
    } // 校验结束
    const entries = Object.entries(status as Record<string, unknown>); // 读取状态条目
    return entries.map(([device, value]) => ({
      // 转换条目
      device, // 设备标识
      status: Number(value) || 0, // 状态值
    })); // 返回结果
  }

  /**
   * 销毁接收器
   */
  destroy(): void {
    this.streamMessageHandler.destroy();
  }

  private rememberMessageContext(message: Message): void {
    const messageId = this.resolveMessageContextId(message);
    const conversationContext = this.resolveMessageConversationContext(message);
    if (!messageId || !conversationContext) {
      return;
    }
    this.messageContexts.delete(messageId);
    this.messageContexts.set(messageId, conversationContext);
    while (this.messageContexts.size > MESSAGE_CONTEXT_CACHE_LIMIT) {
      const oldestKey = this.messageContexts.keys().next().value;
      if (!oldestKey) {
        break;
      }
      this.messageContexts.delete(oldestKey);
    }
  }

  private resolveMessageReadContext(
    messageId: string,
    conversationId: string,
    conversationType: string,
    isGroupAck: boolean
  ): MessageConversationContext {
    const remembered = this.messageContexts.get(messageId);
    if (remembered) {
      return remembered;
    }
    if (conversationType === 'chatRoom') {
      return {
        conversationId,
        conversationType: 'chatRoom',
      };
    }
    if (conversationType === 'groupChat' || isGroupAck) {
      return {
        conversationId,
        conversationType: 'groupChat',
      };
    }
    return {
      conversationId,
      conversationType: 'singleChat',
    };
  }

  private resolveMessageContextId(message: Message): string {
    if (typeof message.msgServerId === 'string' && message.msgServerId.length > 0) {
      return message.msgServerId;
    }
    if (typeof message.msgLocalId === 'string' && message.msgLocalId.length > 0) {
      return message.msgLocalId;
    }
    return '';
  }

  private resolveMessageConversationContext(message: Message): MessageConversationContext | null {
    if (typeof message.conversationId !== 'string' || !message.conversationId) {
      return null;
    }
    if (message.conversationType === 'groupChat') {
      return {
        conversationId: message.conversationId,
        conversationType: 'groupChat',
      };
    }
    if (message.conversationType === 'chatRoom') {
      return {
        conversationId: message.conversationId,
        conversationType: 'chatRoom',
      };
    }
    if (message.conversationType !== 'singleChat') {
      return null;
    }
    const currentUserId = this.msyncCodec.getContext().userId;
    const conversationId =
      message.direct === 'SEND'
        ? message.conversationId
        : message.sender.userId === currentUserId
          ? message.conversationId
          : message.sender.userId;
    if (!conversationId) {
      return null;
    }
    return {
      conversationId,
      conversationType: 'singleChat',
    };
  }
}
