import type { ChatConversationType } from '../../types/chat-manager';
import type { Message, MessageBody } from '../../types';

export interface MessageActionRequest {
  readonly kind:
    | 'conversationRead'
    | 'messageRead'
    | 'groupMessageRead'
    | 'recall'
    | 'update'
    | 'deliveryAck';
  readonly conversationId: string;
  readonly conversationType: ChatConversationType;
  readonly messageId?: string;
  readonly ackContent?: string;
  readonly body?: MessageBody;
  readonly messageType?: Message['type'];
  readonly ext?: Record<string, unknown>;
}

export interface ActionAckResult {
  readonly protocolId: string;
  readonly serverId: string;
  readonly statusCode: number;
  readonly reason?: string;
}
