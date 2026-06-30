/**
 * Protobuf 类型定义
 *
 * 从 protobuf 生成的 TypeScript 类型
 * 注意：实际使用时需要通过 protobufjs-lite 从 .proto 文件生成
 */

// 这里暂时定义基础类型，实际应该从 protobuf 生成
// 使用 protobufjs-lite 的 TypeScript 类型定义

export interface ProtobufMessage {
  msgServerId: string;
  msgLocalId: string;
  sender: ProtobufSender;
  conversationId: string;
  conversationType: string;
  type: number;
  status: number;
  ext: Record<string, string>;
  timestamp: number;
  body: ProtobufMessageBody;
}

export interface ProtobufSender {
  userId: string;
  nickname?: string;
  avatarUrl?: string;
}

export interface ProtobufMessageBody {
  text?: ProtobufTextMessageBody;
  image?: ProtobufImageMessageBody;
}

export interface ProtobufTextMessageBody {
  content: string;
}

export interface ProtobufImageMessageBody {
  url: string;
  filename: string;
  filetype: string;
  width: number;
  height: number;
  isGif: boolean;
  thumbnailUrl?: string;
}

/**
 * TODO: 使用 protobufjs-lite 从 messages.proto 生成实际的类型定义
 *
 * 示例代码：
 * ```typescript
 * import protobuf from 'protobufjs-lite';
 * import protoDefinition from './messages.proto';
 *
 * const root = protobuf.parse(protoDefinition).root;
 * export const Message = root.lookupType('imsdk.Message');
 * export const Sender = root.lookupType('imsdk.Sender');
 * export const Message = root.lookupType('imsdk.Message');
 * ```
 */
