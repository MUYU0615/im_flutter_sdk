/**
 * Protobuf 消息编码器
 *
 * 将 Message 对象编码为二进制，包含会话定位字段
 * 参考：engineCore/mSync.ts
 */

import { Message } from '../../types';
import { logger } from '../../utils/logger';

/**
 * Protobuf 消息编码器
 */
export class ProtobufEncoder {
  /**
   * 编码消息
   *
   * TODO: 实际实现中需要使用 protobufjs-lite 从 messages.proto 生成编码器
   * 这里先提供接口和简化实现
   */
  encode(message: Message): ArrayBuffer {
    try {
      // TODO: 实际实现中需要：
      // 1. 使用 protobufjs-lite 加载 messages.proto
      // 2. 构造 protobuf Message 对象
      // 3. 序列化为二进制

      // 简化实现：先使用 JSON 序列化（实际应该使用 protobuf）
      const messageData = {
        msgServerId: message.msgServerId,
        msgLocalId: message.msgLocalId,
        sender: {
          userId: message.sender.userId,
          nickname: message.sender.nickname,
          avatarUrl: message.sender.avatarUrl,
        },
        conversationId: message.conversationId,
        conversationType: message.conversationType,
        type: message.type,
        status: message.status,
        ext: message.ext,
        timestamp: message.timestamp,
        body: message.body,
      };

      const jsonString = JSON.stringify(messageData);
      const encoder = new TextEncoder();
      return encoder.encode(jsonString).buffer;
    } catch (error) {
      logger.error('Failed to encode message:', error);
      throw error;
    }
  }

  /**
   * 编码消息（返回 Uint8Array）
   */
  encodeToUint8Array(message: Message): Uint8Array {
    const buffer = this.encode(message);
    return new Uint8Array(buffer);
  }
}
