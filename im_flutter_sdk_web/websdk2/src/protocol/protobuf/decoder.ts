/**
 * Protobuf 消息解码器
 *
 * 将二进制解码为 Message 对象，包含会话定位字段
 * 参考：engineCore/mSync.ts, handleMessages/handleChatMsg.ts
 */

import type {
  ChatConversationType,
  ImageMessageBody,
  ImageType,
  Message,
  MessageBody,
  MessageStatus,
  MessageType,
  TextMessageBody,
} from '../../types';
import {
  deriveImageUrls,
  fromProtocolImageType,
  IMAGE_TYPE_LARGE,
  IMAGE_TYPE_ORIGINAL,
} from '../../upload/utils';
import { logger } from '../../utils/logger';

/**
 * Protobuf 消息解码器
 */
export class ProtobufDecoder {
  private readonly useCustomAttachmentUpload: boolean;

  constructor(options?: { useCustomAttachmentUpload?: boolean }) {
    this.useCustomAttachmentUpload = options?.useCustomAttachmentUpload ?? false;
  }

  /**
   * 解码消息
   *
   * TODO: 实际实现中需要使用 protobufjs-lite 从 messages.proto 生成解码器
   * 这里先提供接口和简化实现
   */
  decode(data: ArrayBuffer | Uint8Array): Message {
    try {
      // TODO: 实际实现中需要：
      // 1. 使用 protobufjs-lite 加载 messages.proto
      // 2. 反序列化二进制数据
      // 3. 构造 Message 对象

      // 简化实现：先使用 JSON 反序列化（实际应该使用 protobuf）
      const uint8Array = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
      const decoder = new TextDecoder();
      const jsonString = decoder.decode(uint8Array);
      const messageData = JSON.parse(jsonString) as unknown;

      const record = ProtobufDecoder.toRecord(messageData);
      const senderRecord = ProtobufDecoder.toRecord(record.sender);

      const conversationType =
        ProtobufDecoder.readConversationType(record.conversationType) ??
        this.inferConversationType(record);
      const conversationId =
        ProtobufDecoder.readString(record.conversationId) ??
        ProtobufDecoder.readString(record.to) ??
        ProtobufDecoder.readString(record.groupId) ??
        ProtobufDecoder.readString(record.roomId) ??
        '';

      const sender: Message['sender'] = {
        userId:
          ProtobufDecoder.readString(senderRecord.userId) ??
          ProtobufDecoder.readString(record.from) ??
          '',
        nickname: ProtobufDecoder.readString(senderRecord.nickname),
        avatarUrl: ProtobufDecoder.readString(senderRecord.avatarUrl),
      };

      return {
        msgServerId:
          ProtobufDecoder.readString(record.msgServerId) ??
          ProtobufDecoder.readString(record.id) ??
          '',
        msgLocalId: ProtobufDecoder.readString(record.msgLocalId) ?? '',
        from: sender.userId,
        to: conversationId,
        sender,
        conversationId,
        conversationType,
        type: ProtobufDecoder.readMessageType(record.type) ?? 'text',
        status: ProtobufDecoder.readMessageStatus(record.status) ?? 'sent',
        ext: ProtobufDecoder.readRecord(record.ext) ?? {},
        timestamp: ProtobufDecoder.readNumber(record.timestamp) ?? Date.now(),
        body: this.parseBody(record),
      };
    } catch (error) {
      logger.error('Failed to decode message:', error);
      throw error;
    }
  }

  /**
   * 推断会话类型
   */
  private inferConversationType(data: Record<string, unknown>): ChatConversationType {
    const chatType = ProtobufDecoder.readString(data.chatType);
    if (chatType === 'groupChat' || ProtobufDecoder.hasValue(data.groupId)) {
      return 'groupChat';
    }
    if (chatType === 'chatRoom' || ProtobufDecoder.hasValue(data.roomId)) {
      return 'chatRoom';
    }
    return 'singleChat';
  }

  private parseBody(record: Record<string, unknown>): MessageBody {
    const bodyRecord = ProtobufDecoder.readRecord(record.body);
    if (bodyRecord) {
      const textBody = this.parseTextBody(bodyRecord);
      if (textBody) {
        return textBody;
      }

      const imageBody = this.parseImageBody(bodyRecord);
      if (imageBody) {
        return imageBody;
      }
    }

    const content = ProtobufDecoder.readString(record.content) ?? '';
    return { content };
  }

  private parseTextBody(body: Record<string, unknown>): TextMessageBody | null {
    const content = ProtobufDecoder.readString(body.content);
    if (content === undefined) {
      return null;
    }
    return { content };
  }

  private parseImageBody(body: Record<string, unknown>): ImageMessageBody | null {
    const url = ProtobufDecoder.readString(body.url);
    const filename = ProtobufDecoder.readString(body.filename);
    const filetype = ProtobufDecoder.readString(body.filetype);
    const width = ProtobufDecoder.readNumber(body.width);
    const height = ProtobufDecoder.readNumber(body.height);
    const isGif = ProtobufDecoder.readBoolean(body.isGif);

    if (
      !url ||
      !filename ||
      !filetype ||
      width === undefined ||
      height === undefined ||
      isGif === undefined
    ) {
      return null;
    }

    const imageType = this.resolveImageType(body.imageType, isGif);
    const imageUrls = deriveImageUrls(url, {
      deriveVariants: !this.useCustomAttachmentUpload,
    });
    const imageBody: ImageMessageBody = {
      localUrl: '',
      filename,
      filetype,
      width,
      height,
      isGif,
      isOriginalImage: imageType === IMAGE_TYPE_ORIGINAL,
      originalImageUrl: imageUrls.originalImageUrl,
      bigImageUrl: imageUrls.bigImageUrl,
      thumbnailUrl: imageUrls.thumbnailUrl,
    };

    const thumbnailUrl = ProtobufDecoder.readString(body.thumbnailUrl);
    if (thumbnailUrl) {
      imageBody.thumbnailUrl = thumbnailUrl;
    }

    return imageBody;
  }

  private resolveImageType(value: unknown, isGif: boolean): ImageType {
    if (
      typeof value === 'string' &&
      (value === IMAGE_TYPE_ORIGINAL || value === IMAGE_TYPE_LARGE)
    ) {
      return value;
    }
    if (typeof value === 'number') {
      return fromProtocolImageType(value);
    }
    return isGif ? IMAGE_TYPE_ORIGINAL : IMAGE_TYPE_LARGE;
  }

  private static toRecord(value: unknown): Record<string, unknown> {
    return ProtobufDecoder.isRecord(value) ? value : {};
  }

  private static readRecord(value: unknown): Record<string, unknown> | undefined {
    return ProtobufDecoder.isRecord(value) ? value : undefined;
  }

  private static isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private static readString(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined;
  }

  private static readNumber(value: unknown): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  }

  private static readBoolean(value: unknown): boolean | undefined {
    return typeof value === 'boolean' ? value : undefined;
  }

  private static hasValue(value: unknown): boolean {
    return value !== undefined && value !== null;
  }

  private static readMessageType(value: unknown): MessageType | undefined {
    if (ProtobufDecoder.isMessageType(value)) {
      return value;
    }
    return undefined;
  }

  private static readMessageStatus(value: unknown): MessageStatus | undefined {
    if (ProtobufDecoder.isMessageStatus(value)) {
      return value;
    }
    return undefined;
  }

  private static readConversationType(value: unknown): ChatConversationType | undefined {
    if (ProtobufDecoder.isConversationType(value)) {
      return value;
    }
    return undefined;
  }

  private static isMessageType(value: unknown): value is MessageType {
    return (
      typeof value === 'string' &&
      ['text', 'image', 'file', 'voice', 'video', 'location', 'custom', 'cmd'].includes(value) // 支持的消息类型
    );
  }

  private static isMessageStatus(value: unknown): value is MessageStatus {
    return (
      typeof value === 'string' &&
      ['sending', 'sent', 'failed', 'delivered', 'read'].includes(value)
    );
  }

  private static isConversationType(value: unknown): value is ChatConversationType {
    return typeof value === 'string' && ['singleChat', 'groupChat', 'chatRoom'].includes(value);
  }
}
