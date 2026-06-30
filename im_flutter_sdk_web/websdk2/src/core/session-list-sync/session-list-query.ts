import type { ConversationSummary, MessageSnippet } from '../../cache/cache-types';
import type {
  ConversationItem,
  ConversationMark,
  SessionListRemindType,
} from '../../types/conversation';
import type {
  MutedConversationItem,
  MutedConversationPageResponse,
  PushRemindTypeWithoutDefault,
} from '../../types/push';
import { ERROR_CODES } from '../../utils/error-codes';
import { ValidationError } from '../../utils/errors';

const buildInvalidCursorError = (path: string): ValidationError => {
  return new ValidationError(`${path} must be a local paging cursor returned by SDK`, {
    code: ERROR_CODES.VALIDATION_INVALID_FORMAT,
    details: {
      fields: [
        {
          path,
          message: `${path} must be a local paging cursor returned by SDK`,
          rule: 'invalid_format',
        },
      ],
    },
  });
};

const parseCursorOffset = (cursor: string | undefined, path: string): number => {
  if (cursor === undefined || cursor === '') {
    return 0;
  }
  if (!/^\d+$/.test(cursor)) {
    throw buildInvalidCursorError(path);
  }
  const offset = Number.parseInt(cursor, 10);
  if (!Number.isSafeInteger(offset) || offset < 0) {
    throw buildInvalidCursorError(path);
  }
  return offset;
};

const buildNextCursor = (
  offset: number,
  pageSize: number,
  total: number
): string => {
  const nextOffset = offset + pageSize;
  return nextOffset < total ? String(nextOffset) : '';
};

const toMessageSnippet = (
  lastMessage: ConversationItem['lastMessage']
): MessageSnippet | null => {
  if (!lastMessage) {
    return null;
  }
  return {
    msgId: lastMessage.msgServerId,
    type: typeof lastMessage.body.type === 'string' ? lastMessage.body.type : 'unknown',
    body: lastMessage.body,
    timestamp: lastMessage.timestamp,
    modifiedInfo: lastMessage.modifiedInfo,
    userInfoUpdateTime: lastMessage.userInfoUpdateTime,
    namecardUpdateTime: lastMessage.namecardUpdateTime,
  };
};

export const toConversationItem = (item: ConversationItem): ConversationItem => {
  return {
    ...item,
  };
};

export const toConversationSummary = (item: ConversationItem): ConversationSummary => {
  const lastMessage = toMessageSnippet(item.lastMessage);
  const timestamp = item.lastMessageAt ?? item.lastMessage?.timestamp ?? 0;
  return {
    conversationId: item.conversationId,
    type: item.conversationType,
    lastMessage,
    unreadCount: item.unreadCount,
    isPinned: item.isPinned,
    pinnedTime: item.pinnedTimestamp,
    marks: item.marks,
    lastAccess: timestamp,
    lastUpdate: timestamp,
  };
};

export const queryConversationSummariesFromSessionList = (options: {
  readonly items: ReadonlyArray<ConversationItem>;
  readonly params?: {
    readonly pageSize?: number;
    readonly cursor?: string;
    readonly includeEmptyConversations?: boolean;
  };
  readonly defaultPageSize: number;
  readonly maxPageSize: number;
  readonly filter?: (item: ConversationItem) => boolean;
}): {
  readonly items: ReadonlyArray<ConversationItem>;
  readonly cursor: string;
  readonly hasMore: boolean;
} => {
  const pageSize = options.params?.pageSize ?? options.defaultPageSize;
  if (!Number.isInteger(pageSize) || pageSize <= 0 || pageSize > options.maxPageSize) {
    throw new ValidationError(
      `params.pageSize must be an integer between 1 and ${options.maxPageSize}`,
      {
        code: ERROR_CODES.VALIDATION_INVALID_FORMAT,
        details: {
          fields: [
            {
              path: 'params.pageSize',
              message: `params.pageSize must be an integer between 1 and ${options.maxPageSize}`,
              rule: 'invalid_format',
            },
          ],
        },
      }
    );
  }

  const includeEmpty = options.params?.includeEmptyConversations ?? false;
  if (typeof includeEmpty !== 'boolean') {
    throw new ValidationError('params.includeEmptyConversations must be a boolean', {
      code: ERROR_CODES.VALIDATION_INVALID_FORMAT,
      details: {
        fields: [
          {
            path: 'params.includeEmptyConversations',
            message: 'params.includeEmptyConversations must be a boolean',
            rule: 'invalid_format',
          },
        ],
      },
    });
  }

  const offset = parseCursorOffset(options.params?.cursor, 'params.cursor');
  const filtered = options.items.filter(item => {
    if (!includeEmpty && item.lastMessage === null) {
      return false;
    }
    return options.filter ? options.filter(item) : true;
  });
  const page = filtered.slice(offset, offset + pageSize);
  return {
    items: page.map(toConversationItem),
    cursor: buildNextCursor(offset, pageSize, filtered.length),
    hasMore: offset + pageSize < filtered.length,
  };
};

const toPushRemindType = (
  remindType: SessionListRemindType
): PushRemindTypeWithoutDefault | null => {
  if (remindType === 'AT' || remindType === 'NONE' || remindType === 'ALL') {
    return remindType;
  }
  return null;
};

export const queryMutedConversationsFromSessionList = (options: {
  readonly items: ReadonlyArray<ConversationItem>;
  readonly pageSize: number;
  readonly cursor?: string;
}): MutedConversationPageResponse => {
  if (!Number.isInteger(options.pageSize) || options.pageSize <= 0) {
    throw new ValidationError('pageSize must be a positive integer', {
      code: ERROR_CODES.VALIDATION_INVALID_FORMAT,
      details: {
        fields: [
          {
            path: 'pageSize',
            message: 'pageSize must be a positive integer',
            rule: 'range',
          },
        ],
      },
    });
  }

  const offset = parseCursorOffset(options.cursor, 'cursor');
  const filtered: MutedConversationItem[] = [];
  for (const item of options.items) {
    if (item.conversationType === 'chatRoom') {
      continue;
    }
    const remindType = toPushRemindType(item.remindType);
    if (!remindType) {
      continue;
    }
    filtered.push({
      conversationId: item.conversationId,
      conversationType: item.conversationType,
      remindType,
    });
  }
  const page = filtered.slice(offset, offset + options.pageSize);
  return {
    conversations: page,
    cursor: buildNextCursor(offset, options.pageSize, filtered.length),
  };
};

export const hasSessionMark = (
  item: ConversationItem,
  mark: ConversationMark
): boolean => {
  return item.marks.includes(mark);
};
