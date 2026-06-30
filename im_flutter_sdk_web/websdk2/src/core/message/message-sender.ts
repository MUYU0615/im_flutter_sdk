/**
 * 消息发送器
 *
 * 接收 Message 对象，发送消息、等待 ACK、错误处理
 * 参考：engineCore/mSync.ts
 */

import { InternalEventName, isStreamMessage } from '../../types'; // 事件常量
import type { Message, SendMessageOptions } from '../../types'; // 消息类型
import { MessageSendError } from '../../utils/errors';
import { ERROR_CODES } from '../../utils/error-codes';
import { logger } from '../../utils/logger';
import { MESSAGE_TIMEOUT } from '../../config/timeouts';
import { MsyncCodec } from '../../protocol/msync/codec';
import { EventHub } from '../events/event-hub';
import { AttachmentUploader } from '../../upload/attachment-uploader';
import { attachmentFileStore } from '../../upload/attachment-file-store';
import { createLocalFileUrl } from '../../utils/message-id';
import { SOCKET_READY_STATE, type SocketLike } from '../../platform';
import type { CombineMessageBody } from '../../types';
import { encodeCombineMessageList } from '../../message/combine-payload-codec';
import {
  calculateCombineLevel,
  ensureCombineLevel,
  validateCombineMessageList,
} from '../../message/combine-message-constraints';
import { copyMessageProfileVersionSidecar } from './profile-sync/profile-version-sidecar';
import type { ActionAckResult, MessageActionRequest } from './message-action-types';
import type { ChatRoomOperationRequest } from './chatroom-operation-types';

interface PendingMessageEntry {
  kind: 'message';
  message: Message;
  protocolId: string;
  timeoutId: ReturnType<typeof setTimeout>;
  resolve: (message: Message) => void;
  reject: (error: Error) => void;
}

interface PendingActionEntry {
  kind: 'action';
  protocolId: string;
  timeoutId: ReturnType<typeof setTimeout>;
  createAckError?: (statusCode: number, reason?: string) => Error;
  resolve: (result: ActionAckResult) => void;
  reject: (error: Error) => void;
}

type PendingEntry = PendingMessageEntry | PendingActionEntry;

/**
 * 消息发送器
 */
export class MessageSender {
  private websocket: SocketLike | null = null;
  private pendingMessages: Map<string, PendingEntry> = new Map();
  private ackTimeout: number = MESSAGE_TIMEOUT; // ACK 超时时间
  private eventHub: EventHub;
  private msyncCodec: MsyncCodec;
  private attachmentUploader: AttachmentUploader | null = null;

  constructor(
    msyncCodec: MsyncCodec,
    websocket: SocketLike | null,
    eventHub: EventHub,
    attachmentUploader?: AttachmentUploader
  ) {
    this.websocket = websocket;
    this.eventHub = eventHub;
    this.msyncCodec = msyncCodec;
    this.attachmentUploader = attachmentUploader ?? null;
  }

  updateAuthToken(token: string): void {
    this.attachmentUploader?.updateAuthToken(token);
  }

  /**
   * 发送消息
   */
  async sendMessage(message: Message, options?: SendMessageOptions): Promise<Message> {
    const protocolId = this.msyncCodec.toProtocolId(message.msgLocalId);
    if (isStreamMessage(message)) {
      throw new MessageSendError('Stream message send is not supported', {
        code: ERROR_CODES.STREAM_SEND_NOT_SUPPORTED,
        details: {
          msgLocalId: message.msgLocalId,
          retryable: false,
        },
      });
    }

    if (!this.websocket || this.websocket.readyState !== SOCKET_READY_STATE.OPEN) {
      const protocolId = this.msyncCodec.toProtocolId(message.msgLocalId);
      throw new MessageSendError('WebSocket is not connected', {
        code: ERROR_CODES.MESSAGE_NOT_CONNECTED,
        details: {
          msgLocalId: message.msgLocalId,
          protocolId,
          retryable: true,
        },
      });
    }

    let failureBaseMessage: Message = {
      ...message,
      status: 'sending',
    };
    copyMessageProfileVersionSidecar(message, failureBaseMessage);
    logger.warn('Message send queued', {
      msgLocalId: message.msgLocalId,
      protocolId,
      type: message.type,
      conversationType: message.conversationType,
      conversationId: message.conversationId,
    });

    try {
      const combinePreparedMessage =
        failureBaseMessage.type === 'combine'
          ? this.prepareCombineMessage(failureBaseMessage)
          : failureBaseMessage;

      const preparedMessage = this.attachmentUploader
        ? await this.attachmentUploader.prepareMessage(combinePreparedMessage, options)
        : combinePreparedMessage;
      const sendingMessage: Message = {
        ...preparedMessage,
        status: 'sending',
      };
      copyMessageProfileVersionSidecar(failureBaseMessage, sendingMessage);
      failureBaseMessage = sendingMessage;

      options?.onSending?.(sendingMessage);

      const sentMessage = await this.doSendMessage(sendingMessage);
      options?.onSuccess?.(sentMessage);

      return sentMessage;
    } catch (error) {
      // 发送失败
      const failedMessage: Message = {
        ...failureBaseMessage,
        status: 'failed',
      };
      copyMessageProfileVersionSidecar(failureBaseMessage, failedMessage);

      options?.onFailed?.(failedMessage, error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  async sendAction(
    action: MessageActionRequest,
    createAckError?: (statusCode: number, reason?: string) => Error
  ): Promise<ActionAckResult> {
    const protocolId = this.msyncCodec.toProtocolId(
      `${action.kind}:${action.messageId ?? action.conversationId}:${Date.now()}`
    );
    const payload = this.msyncCodec.encodeActionMessage(action, protocolId);
    return this.sendProtocolPayload(protocolId, payload, createAckError);
  }

  async sendChatRoomOperation(
    request: ChatRoomOperationRequest,
    createAckError?: (statusCode: number, reason?: string) => Error
  ): Promise<ActionAckResult> {
    const protocolId = this.msyncCodec.toProtocolId(
      `chatroom:${request.operation}:${request.chatRoomId}:${Date.now()}`
    );
    const payload = this.msyncCodec.encodeChatRoomOperation(request, protocolId);
    return this.sendProtocolPayload(protocolId, payload, createAckError);
  }

  /**
   * 实际发送消息
   */
  private async doSendMessage(message: Message): Promise<Message> {
    return new Promise((resolve, reject) => {
      const protocolId = this.msyncCodec.toProtocolId(message.msgLocalId);

      // 设置 ACK 超时
      const timeoutId = setTimeout(() => {
        this.pendingMessages.delete(protocolId);
        reject(
          new MessageSendError('Message ACK timeout', {
            code: ERROR_CODES.MESSAGE_ACK_TIMEOUT,
            details: {
              msgLocalId: message.msgLocalId,
              protocolId,
              retryable: true,
            },
          })
        );
      }, this.ackTimeout);

      // 保存待确认消息
      this.pendingMessages.set(protocolId, {
        kind: 'message',
        message,
        protocolId,
        timeoutId,
        resolve: (sentMessage: Message) => {
          clearTimeout(timeoutId);
          resolve(sentMessage);
        },
        reject: (error: Error) => {
          clearTimeout(timeoutId);
          reject(error);
        },
      });

      try {
        if (!this.websocket || this.websocket.readyState !== SOCKET_READY_STATE.OPEN) {
          throw new MessageSendError('WebSocket is not connected', {
            code: ERROR_CODES.MESSAGE_NOT_CONNECTED,
            details: {
              msgLocalId: message.msgLocalId,
              protocolId,
              retryable: true,
            },
          });
        }

        const encoded = this.msyncCodec.encodeChatMessage(message, protocolId);
        const outbound = this.msyncCodec.prepareOutgoing(encoded);
        void Promise.resolve(this.websocket.send(outbound)).catch(error => {
          this.pendingMessages.delete(protocolId);
          clearTimeout(timeoutId);
          logger.warn('Message send socket failure', {
            msgLocalId: message.msgLocalId,
            protocolId,
            websocketReadyState: this.websocket?.readyState ?? null,
            cause: error instanceof Error ? error.message : String(error),
          });
          reject(
            new MessageSendError('Message send failed', {
              code: ERROR_CODES.MESSAGE_NOT_CONNECTED,
              details: {
                msgLocalId: message.msgLocalId,
                protocolId,
                retryable: true,
                cause: error instanceof Error ? error.message : String(error),
              },
            })
          );
        });
        logger.debug('Message sent', { msgLocalId: message.msgLocalId, protocolId });
      } catch (error) {
        this.pendingMessages.delete(protocolId);
        clearTimeout(timeoutId);
        if (error instanceof MessageSendError) {
          throw error;
        }
        throw new MessageSendError('Message encode failed', {
          code: ERROR_CODES.MESSAGE_ENCODE_FAILED,
          details: {
            msgLocalId: message.msgLocalId,
            protocolId,
            retryable: true,
          },
        });
      }
    });
  }

  private async sendProtocolPayload(
    protocolId: string,
    payload: Uint8Array,
    createAckError?: (statusCode: number, reason?: string) => Error
  ): Promise<ActionAckResult> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingMessages.delete(protocolId);
        reject(
          new MessageSendError('Message ACK timeout', {
            code: ERROR_CODES.MESSAGE_ACK_TIMEOUT,
            details: {
              protocolId,
              retryable: true,
            },
          })
        );
      }, this.ackTimeout);

      this.pendingMessages.set(protocolId, {
        kind: 'action',
        protocolId,
        timeoutId,
        createAckError,
        resolve,
        reject,
      });

      try {
        if (!this.websocket || this.websocket.readyState !== SOCKET_READY_STATE.OPEN) {
          throw new MessageSendError('WebSocket is not connected', {
            code: ERROR_CODES.MESSAGE_NOT_CONNECTED,
            details: {
              protocolId,
              retryable: true,
            },
          });
        }

        const outbound = this.msyncCodec.prepareOutgoing(payload);
        void Promise.resolve(this.websocket.send(outbound)).catch(error => {
          this.pendingMessages.delete(protocolId);
          clearTimeout(timeoutId);
          reject(
            new MessageSendError('Message send failed', {
              code: ERROR_CODES.MESSAGE_NOT_CONNECTED,
              details: {
                protocolId,
                retryable: true,
                cause: error instanceof Error ? error.message : String(error),
              },
            })
          );
        });
      } catch (error) {
        this.pendingMessages.delete(protocolId);
        clearTimeout(timeoutId);
        if (error instanceof MessageSendError) {
          throw error;
        }
        reject(
          new MessageSendError('Message encode failed', {
            code: ERROR_CODES.MESSAGE_ENCODE_FAILED,
            details: {
              protocolId,
              retryable: false,
            },
          })
        );
      }
    });
  }

  private prepareCombineMessage(message: Message): Message {
    const combineBody = message.body as CombineMessageBody;
    const messageList = combineBody.messageList ?? [];
    validateCombineMessageList(messageList);

    const combineLevel = calculateCombineLevel(messageList);
    ensureCombineLevel(combineLevel);

    const payload = encodeCombineMessageList(messageList);
    const payloadBuffer = new ArrayBuffer(payload.byteLength);
    new Uint8Array(payloadBuffer).set(payload);
    const payloadFile = new File([payloadBuffer], combineBody.filename || 'combine', {
      type: combineBody.filetype || 'application/octet-stream',
    });
    const localUrl = createLocalFileUrl(payloadFile);
    if (!localUrl && !this.attachmentUploader) {
      throw new MessageSendError('Combine payload local url generation failed', {
        code: ERROR_CODES.COMBINE_ENCODE_FAILED,
      });
    }

    attachmentFileStore.set(message.msgLocalId, payloadFile);

    const preparedMessage: Message = {
      ...message,
      combineLevel,
      body: {
        ...combineBody,
        combineLevel,
        fileLength: payload.byteLength,
        filename: combineBody.filename || 'combine',
        filetype: combineBody.filetype || 'application/octet-stream',
        url: localUrl ?? combineBody.url,
      },
    };
    copyMessageProfileVersionSidecar(message, preparedMessage);
    return preparedMessage;
  }

  /**
   * 处理 ACK
   */
  handleAck(protocolId: string, msgServerId?: string, replacedMessage?: Message): void {
    const pending = this.pendingMessages.get(protocolId);
    if (!pending) {
      logger.warn('Received ACK for unknown message', { protocolId });
      return;
    }

    if (pending.kind === 'action') {
      this.pendingMessages.delete(protocolId);
      pending.resolve({
        protocolId,
        serverId: msgServerId ?? '',
        statusCode: 0,
      });
      return;
    }

    const sentMessage: Message = {
      ...pending.message,
      ...this.resolveReplacedMessage(pending.message, replacedMessage),
      status: 'sent',
      msgServerId: msgServerId || replacedMessage?.msgServerId || pending.message.msgServerId,
    };
    copyMessageProfileVersionSidecar(pending.message, sentMessage);

    this.pendingMessages.delete(protocolId);
    if (
      sentMessage.type === 'image' ||
      sentMessage.type === 'video' ||
      sentMessage.type === 'voice' ||
      sentMessage.type === 'file' ||
      sentMessage.type === 'combine'
    ) {
      attachmentFileStore.delete(sentMessage.msgLocalId);
    }
    logger.warn('Message ACK matched', {
      protocolId,
      msgLocalId: sentMessage.msgLocalId,
      msgServerId: sentMessage.msgServerId ?? null,
      type: sentMessage.type,
      conversationType: sentMessage.conversationType,
      conversationId: sentMessage.conversationId,
    });
    this.eventHub.dispatch(InternalEventName.MESSAGE_SENT, sentMessage);
    pending.resolve(sentMessage);
  }

  private resolveReplacedMessage(message: Message, replacedMessage?: Message): Partial<Message> {
    if (!replacedMessage) {
      return {};
    }
    return {
      type: replacedMessage.type,
      body: replacedMessage.body,
      ext: replacedMessage.ext,
      timestamp: replacedMessage.timestamp || message.timestamp,
    };
  }

  /**
   * 处理发送失败
   */
  handleSendError(protocolId: string, error: Error): void {
    const pending = this.pendingMessages.get(protocolId);
    if (!pending) {
      return;
    }

    if (pending.kind === 'action') {
      this.pendingMessages.delete(protocolId);
      pending.reject(error);
      return;
    }

    const failedMessage: Message = {
      ...pending.message,
      status: 'failed',
    };
    copyMessageProfileVersionSidecar(pending.message, failedMessage);

    this.pendingMessages.delete(protocolId);
    logger.warn('Message send failed after ACK/error', {
      protocolId,
      msgLocalId: failedMessage.msgLocalId,
      type: failedMessage.type,
      conversationType: failedMessage.conversationType,
      conversationId: failedMessage.conversationId,
      error: error.message,
    });
    pending.reject(error);
  }

  handleAckFailure(
    protocolId: string,
    statusCode: number,
    reason: string | undefined,
    error: Error
  ): void {
    const pending = this.pendingMessages.get(protocolId);
    if (!pending) {
      return;
    }

    if (pending.kind === 'action') {
      this.pendingMessages.delete(protocolId);
      pending.reject(pending.createAckError?.(statusCode, reason) ?? error);
      return;
    }

    this.handleSendError(protocolId, error);
  }

  /**
   * 更新 WebSocket 实例
   */
  setWebSocket(websocket: SocketLike | null): void {
    this.websocket = websocket;
  }

  /**
   * 销毁消息发送器
   */
  destroy(): void {
    // 清理所有待确认消息
    for (const [protocolId, pending] of this.pendingMessages) {
      clearTimeout(pending.timeoutId);
      pending.reject(
        new MessageSendError('Message sender destroyed', {
          code: ERROR_CODES.MESSAGE_SENDER_DESTROYED,
          details:
            pending.kind === 'message'
              ? {
                  msgLocalId: pending.message.msgLocalId,
                  protocolId,
                  retryable: false,
                }
              : {
                  protocolId,
                  retryable: false,
                },
        })
      );
    }
    this.pendingMessages.clear();
  }
}
