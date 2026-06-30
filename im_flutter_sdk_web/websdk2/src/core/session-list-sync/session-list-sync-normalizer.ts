import type { ConversationSummary } from '../../cache/cache-types';
import type { ChatClient } from '../../chat-client';
import type { Contact } from '../../types/contact';
import type {
  ConversationItem,
  SessionMessageSnippet,
} from '../../types/conversation';
import type { UserInfo } from '../../types/user-info';

const stripBodyType = (body: Record<string, unknown>): Record<string, unknown> => {
  const next = { ...body };
  delete next.type;
  return next;
};

const inferFallbackMessageParticipants = (
  conversation: ConversationSummary,
  client: ChatClient
): Pick<SessionMessageSnippet, 'from' | 'to' | 'sender'> => {
  const currentUserId =
    (client as unknown as { getCurrentUserId?: () => string | null }).getCurrentUserId?.() ?? '';
  const fallbackSender = conversation.type === 'singleChat' ? conversation.conversationId : '';
  return {
    from: fallbackSender,
    to: conversation.type === 'singleChat' ? currentUserId : conversation.conversationId,
    sender: { userId: fallbackSender },
  };
};

const toSessionMessageSnippet = (
  conversation: ConversationSummary,
  client: ChatClient
): SessionMessageSnippet | null => {
  const lastMessage = conversation.lastMessage;
  if (!lastMessage) {
    return null;
  }
  const participants = inferFallbackMessageParticipants(conversation, client);
  return {
    msgServerId: lastMessage.msgId,
    from: participants.from,
    to: participants.to,
    sender: participants.sender,
    conversationId: conversation.conversationId,
    conversationType: conversation.type,
    type:
      typeof lastMessage.type === 'string' && lastMessage.type.length > 0
        ? (lastMessage.type as SessionMessageSnippet['type'])
        : 'text',
    timestamp: lastMessage.timestamp,
    body: stripBodyType(lastMessage.body),
    modifiedInfo: lastMessage.modifiedInfo,
    userInfoUpdateTime: lastMessage.userInfoUpdateTime,
    namecardUpdateTime: lastMessage.namecardUpdateTime,
  };
};

const buildSingleChatDisplayFields = (
  conversationId: string,
  contact: Contact | undefined,
  userInfo: UserInfo | null
): Pick<ConversationItem, 'conversationName' | 'conversationAvatar'> => {
  const remark = contact?.remark?.trim();
  if (remark) {
    return {
      conversationName: remark,
      conversationAvatar: contact?.userInfo.avatarUrl ?? userInfo?.avatarUrl,
    };
  }
  const nickname = contact?.userInfo.nickname?.trim() || userInfo?.nickname?.trim();
  if (nickname) {
    return {
      conversationName: nickname,
      conversationAvatar: contact?.userInfo.avatarUrl ?? userInfo?.avatarUrl,
    };
  }
  return {
    conversationName: conversationId,
    conversationAvatar: contact?.userInfo.avatarUrl ?? userInfo?.avatarUrl,
  };
};

const buildGroupDisplayFields = async (
  client: ChatClient,
  conversationId: string
): Promise<Pick<ConversationItem, 'conversationName' | 'conversationAvatar'>> => {
  const groupManager = (client as unknown as { groupManager?: { getGroupInfo: (params: { groupId: string }) => Promise<{ name?: string; avatarUrl?: string }> } }).groupManager;
  if (!groupManager) {
    return {
      conversationName: conversationId,
    };
  }
  try {
    const detail = await groupManager.getGroupInfo({ groupId: conversationId });
    if (detail.name) {
      return {
        conversationName: detail.name,
        conversationAvatar: detail.avatarUrl,
      };
    }
  } catch {
    // noop
  }
  return {
    conversationName: conversationId,
  };
};

const buildChatRoomDisplayFields = (
  conversationId: string
): Pick<ConversationItem, 'conversationName' | 'conversationAvatar'> => {
  return {
    conversationName: conversationId,
  };
};

const resolveCachedUserInfo = (client: ChatClient, sessionId: string): UserInfo | null => {
  const cacheManager = client.getCacheManager();
  if (!cacheManager) {
    return null;
  }

  const runtimeUserInfo = cacheManager.getRuntimeUserInfo(sessionId, false);
  if (runtimeUserInfo) {
    return runtimeUserInfo;
  }

  const summary = cacheManager.getUserInfoSummaries([sessionId], false)[0];
  if (!summary) {
    return null;
  }

  return {
    userId: summary.userId,
    nickname: summary.nickname,
    avatarUrl: summary.avatarUrl,
    sign: summary.sign,
    ext: summary.ext,
  };
};

export const buildFallbackConversationItemsFromConversations = async (
  conversations: ReadonlyArray<ConversationSummary>,
  client: ChatClient
): Promise<ReadonlyArray<ConversationItem>> => {
  return await normalizeConversationSummariesToConversationItems(conversations, client);
};

export const normalizeConversationSummaryToConversationItem = async (
  conversation: ConversationSummary,
  client: ChatClient
): Promise<ConversationItem> => {
  const contact = client
    .getContactSnapshot()
    ?.items.find(item => item.userId === conversation.conversationId);
  const userInfo = resolveCachedUserInfo(client, conversation.conversationId);
  const displayFields =
    conversation.type === 'singleChat'
      ? buildSingleChatDisplayFields(
          conversation.conversationId,
          contact,
          userInfo
        )
      : conversation.type === 'groupChat'
        ? await buildGroupDisplayFields(client, conversation.conversationId)
        : buildChatRoomDisplayFields(conversation.conversationId);

  return {
    conversationId: conversation.conversationId,
    conversationType: conversation.type,
    unreadCount: conversation.unreadCount,
    lastMessage: toSessionMessageSnippet(conversation, client),
    lastMessageAt: conversation.lastMessage?.timestamp ?? conversation.lastUpdate,
    isPinned: conversation.isPinned,
    pinnedTimestamp: conversation.pinnedTime,
    marks: [],
    readAt: undefined,
    remindType: 'DEFAULT',
    conversationName: displayFields.conversationName,
    conversationAvatar: displayFields.conversationAvatar,
  };
};

export const normalizeConversationSummariesToConversationItems = async (
  conversations: ReadonlyArray<ConversationSummary>,
  client: ChatClient
): Promise<ReadonlyArray<ConversationItem>> => {
  const items: ConversationItem[] = [];
  for (const conversation of conversations) {
    items.push(await normalizeConversationSummaryToConversationItem(conversation, client));
  }
  return items;
};
