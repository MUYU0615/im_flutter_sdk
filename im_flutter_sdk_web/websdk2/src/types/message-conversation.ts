/**
 * 消息会话定位类型与内部映射工具。
 */

export const CHAT_CONVERSATION_TYPES = ['singleChat', 'groupChat', 'chatRoom'] as const;

export type ChatConversationType = (typeof CHAT_CONVERSATION_TYPES)[number];

export interface MessageConversationLocator {
  conversationId: string;
  conversationType: ChatConversationType;
}

export const isChatConversationType = (value: string): value is ChatConversationType => {
  return CHAT_CONVERSATION_TYPES.includes(value as ChatConversationType);
};

export const toLegacyConversationType = (
  conversationType: ChatConversationType
): 'single' | 'group' | 'room' => {
  if (conversationType === 'groupChat') {
    return 'group';
  }
  if (conversationType === 'chatRoom') {
    return 'room';
  }
  return 'single';
};

export const fromLegacyConversationType = (
  conversationType: 'single' | 'group' | 'room'
): ChatConversationType => {
  if (conversationType === 'group') {
    return 'groupChat';
  }
  if (conversationType === 'room') {
    return 'chatRoom';
  }
  return 'singleChat';
};
