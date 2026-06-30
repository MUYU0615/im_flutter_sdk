import type {
  ConversationMark,
  ConversationItem,
  SessionMessageSnippet,
} from '../../types/conversation';
import type { MessageType } from '../../types';
import type { Sender } from '../../types/sender';
import { mapProtocolRemindTypeToPublic, mapProtocolSessionTypeToPublic } from './types';
import type {
  SessionListMeta,
  SessionListProtocolItem,
  SessionListRequest,
  SessionListRequestParams,
  SessionListResponse,
} from './types';
import { decodeSessionListPayloadBody } from './payload-decoder';

const parseMetadata = (metadata: string | undefined): Record<string, unknown> | null => {
  if (!metadata) {
    return null;
  }
  try {
    const parsed = JSON.parse(metadata) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
};

const resolveSingleChatMetadata = (
  item: SessionListProtocolItem
): Pick<ConversationItem, 'conversationName' | 'conversationAvatar'> => {
  const conversationId = item.session_id ?? '';
  const metadata = parseMetadata(item.metadata);
  const nickname = typeof metadata?.nickname === 'string' ? metadata.nickname : undefined;
  const remark = typeof metadata?.remark === 'string' ? metadata.remark : undefined;
  const avatarUrl =
    typeof metadata?.avatarurl === 'string'
      ? metadata.avatarurl
      : typeof metadata?.avatarUrl === 'string'
        ? metadata.avatarUrl
        : undefined;

  if (remark) {
    return {
      conversationName: remark,
      conversationAvatar: avatarUrl,
    };
  }

  if (nickname) {
    return {
      conversationName: nickname,
      conversationAvatar: avatarUrl,
    };
  }

  return {
    conversationName: conversationId,
    conversationAvatar: avatarUrl,
  };
};

const resolveConversationDisplay = (
  item: SessionListProtocolItem
): Pick<ConversationItem, 'conversationName' | 'conversationAvatar'> => {
  const conversationId = item.session_id ?? '';
  const sessionType = mapProtocolSessionTypeToPublic(item.session_type);
  if (sessionType === 'groupChat' || sessionType === 'chatRoom') {
    return {
      conversationName: item.group_name ?? conversationId,
      conversationAvatar: item.group_avatar,
    };
  }

  return resolveSingleChatMetadata(item);
};

const stripBodyType = (body: Record<string, unknown>): Record<string, unknown> => {
  const next = { ...body };
  delete next.type;
  return next;
};

const normalizeUserIdFromJidName = (name: string | undefined): string => {
  if (!name) {
    return '';
  }
  const separatorIndex = name.lastIndexOf('_');
  return separatorIndex >= 0 ? name.slice(separatorIndex + 1) : name;
};

const inferMessageTo = (options: {
  readonly conversationId: string;
  readonly conversationType: ConversationItem['conversationType'];
  readonly from: string;
  readonly currentUserId: string;
}): string => {
  if (options.conversationType === 'singleChat') {
    return options.from === options.currentUserId ? options.conversationId : options.currentUserId;
  }
  return options.conversationId;
};

const normalizeSessionMessageType = (value: unknown): MessageType => {
  if (
    value === 'text' ||
    value === 'image' ||
    value === 'file' ||
    value === 'voice' ||
    value === 'video' ||
    value === 'location' ||
    value === 'custom' ||
    value === 'cmd' ||
    value === 'combine'
  ) {
    return value;
  }
  return 'text';
};

export const buildSessionListRequest = (options: {
  readonly requestId: string;
  readonly resource: string;
  readonly org: string;
  readonly app: string;
  readonly username: string;
  readonly lastSyncTime: number;
  readonly params?: SessionListRequestParams;
  readonly protocolVersion?: number;
}): SessionListRequest => {
  return {
    type: 10,
    header: {
      resource: options.resource,
      timestamp: Date.now(),
      requestId: options.requestId,
      protocolVersion: options.protocolVersion ?? 1,
    },
    org: options.org,
    app: options.app,
    username: options.username,
    lastSyncTime: options.lastSyncTime,
    includeEmpty: options.params?.includeEmpty ?? false,
    includeMark: true,
  };
};

export const toSessionMessageSnippet = (
  meta: SessionListMeta | undefined,
  payloadBody: Record<string, unknown>,
  options: {
    readonly conversationId: string;
    readonly conversationType: ConversationItem['conversationType'];
    readonly currentUserId: string;
    readonly singleChatPeerDisplay?: Pick<ConversationItem, 'conversationName' | 'conversationAvatar'>;
  }
): SessionMessageSnippet | null => {
  if (!meta) {
    return null;
  }
  const from = normalizeUserIdFromJidName(meta.from?.name);
  const sender: Sender = { userId: from };
  if (
    options.conversationType === 'singleChat' &&
    from === options.conversationId &&
    options.singleChatPeerDisplay
  ) {
    if (options.singleChatPeerDisplay.conversationName !== from) {
      sender.nickname = options.singleChatPeerDisplay.conversationName;
    }
    if (options.singleChatPeerDisplay.conversationAvatar) {
      sender.avatarUrl = options.singleChatPeerDisplay.conversationAvatar;
    }
  }
  return {
    msgServerId: meta.id ?? '',
    from,
    to: inferMessageTo({
      conversationId: options.conversationId,
      conversationType: options.conversationType,
      from,
      currentUserId: options.currentUserId,
    }),
    sender,
    conversationId: options.conversationId,
    conversationType: options.conversationType,
    type: normalizeSessionMessageType(payloadBody.type),
    timestamp: meta.timestamp ?? 0,
    body: stripBodyType(payloadBody),
  };
};

const normalizeMarks = (value: unknown): ReadonlyArray<ConversationMark> => {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<ConversationMark>();
  const marks: ConversationMark[] = [];
  const items = value as ReadonlyArray<unknown>;
  for (const item of items) {
    const raw = typeof item === 'string' && item.startsWith('mark_') ? item.slice(5) : item;
    const parsed =
      typeof raw === 'number'
        ? raw
        : typeof raw === 'string'
          ? Number.parseInt(raw, 10)
          : Number.NaN;
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 19) {
      continue;
    }
    const mark = parsed as ConversationMark;
    if (seen.has(mark)) {
      continue;
    }
    seen.add(mark);
    marks.push(mark);
  }
  return marks;
};

export const toSessionListItems = (
  response: SessionListResponse,
  currentUserId: string
): ReadonlyArray<ConversationItem> => {
  return response.sessions.map((item: SessionListProtocolItem) => {
    const payloadBody = decodeSessionListPayloadBody(item.last_message?.payload);
    const conversationId = item.session_id ?? '';
    const conversationType = mapProtocolSessionTypeToPublic(item.session_type);
    const display = resolveConversationDisplay(item);
    return {
      conversationId,
      conversationType,
      unreadCount: item.unread_count ?? 0,
      lastMessage: toSessionMessageSnippet(item.last_message, payloadBody, {
        conversationId,
        conversationType,
        currentUserId,
        singleChatPeerDisplay: conversationType === 'singleChat' ? display : undefined,
      }),
      lastMessageAt: item.updated_at,
      isPinned: typeof item.pinned_time === 'number' ? item.pinned_time > 0 : undefined,
      pinnedTimestamp: item.pinned_time,
      marks: normalizeMarks(item.marks),
      readAt: item.read_receipt,
      remindType: mapProtocolRemindTypeToPublic(item.remind_type),
      conversationName: display.conversationName,
      conversationAvatar: display.conversationAvatar,
    };
  });
};
