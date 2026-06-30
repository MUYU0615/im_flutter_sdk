import { isRecord, safeJsonParse } from '../cache/cache-utils';
import type { MessageSnippet } from '../cache/cache-types';
import type { RestContext } from '../types/chat-client';
import type {
  ChatThreadDetail,
  ChatThreadLastMessageListResult,
  ChatThreadListResult,
  ChatThreadMemberEntry,
  ChatThreadMemberListResult,
  ChatThreadSummary,
  CreateChatThreadParams,
  CreateChatThreadResult,
  GetChatThreadLastMessageListParams,
  GetChatThreadListParams,
  GetChatThreadMemberListParams,
  GetJoinedChatThreadListParams,
  RemoveChatThreadMemberParams,
  UpdateChatThreadNameParams,
} from '../types/chat-thread';
import { ERROR_CODES } from '../utils/error-codes';
import { ValidationError } from '../utils/errors';
import type { RestClient } from './client';
import { parseAppKey } from '../upload/utils';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const MAX_LAST_MESSAGE_BATCH = 20;

interface EndpointContext {
  readonly orgName: string;
  readonly appName: string;
  readonly encodedUserId: string;
  readonly encodedResource: string;
}

const buildRequiredError = (path: string): ValidationError => {
  return new ValidationError(`${path} is required`, {
    code: ERROR_CODES.VALIDATION_REQUIRED,
    details: {
      fields: [{ path, message: `${path} is required`, rule: 'required' }],
    },
  });
};

const buildInvalidError = (path: string, message: string): ValidationError => {
  return new ValidationError(message, {
    code: ERROR_CODES.VALIDATION_INVALID_FORMAT,
    details: {
      fields: [{ path, message, rule: 'invalid_format' }],
    },
  });
};

const normalizeRequiredString = (value: unknown, path: string): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw buildRequiredError(path);
  }
  return value.trim();
};

const normalizeOptionalCursor = (value: unknown, path: string): string => {
  if (value === undefined) {
    return '';
  }
  if (typeof value !== 'string') {
    throw buildInvalidError(path, `${path} must be a string`);
  }
  return value;
};

const normalizePageSize = (value: unknown, path: string): number => {
  if (value === undefined) {
    return DEFAULT_PAGE_SIZE;
  }
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0 || value > MAX_PAGE_SIZE) {
    throw buildInvalidError(path, `${path} must be an integer between 1 and ${MAX_PAGE_SIZE}`);
  }
  return value;
};

const buildEndpointContext = (context: RestContext): EndpointContext => {
  const { orgName, appName } = parseAppKey(context.appKey);
  return {
    orgName,
    appName,
    encodedUserId: encodeURIComponent(context.userId),
    encodedResource: encodeURIComponent(context.clientResource),
  };
};

const toRecord = (value: unknown): Record<string, unknown> | null => {
  return isRecord(value) ? value : null;
};

const readData = (payload: unknown): unknown => {
  const record = toRecord(payload);
  return record?.data ?? payload;
};

const readEntities = (payload: unknown): ReadonlyArray<unknown> => {
  const record = toRecord(payload);
  if (Array.isArray(record?.entities)) {
    return record.entities;
  }
  const data = readData(payload);
  if (Array.isArray(data)) {
    return data;
  }
  const dataRecord = toRecord(data);
  if (Array.isArray(dataRecord?.entities)) {
    return dataRecord.entities;
  }
  return [];
};

const readCursor = (payload: unknown): string => {
  const record = toRecord(payload);
  const data = toRecord(record?.data);
  const cursor =
    (typeof data?.cursor === 'string' ? data.cursor : undefined) ??
    (typeof record?.cursor === 'string' ? record.cursor : undefined);
  return cursor ?? '';
};

const readFirstArrayItem = (items: ReadonlyArray<unknown>): unknown => {
  return items[0];
};

const parseMessageSnippet = (input: unknown): MessageSnippet | null => {
  const record = toRecord(input);
  if (!record) {
    return null;
  }
  const msgId =
    (typeof record.id === 'string' ? record.id : undefined) ??
    (typeof record.msgId === 'string' ? record.msgId : undefined);
  if (!msgId) {
    return null;
  }
  const timestamp = typeof record.timestamp === 'number' ? record.timestamp : 0;
  const payloadRaw = record.payload;
  const payload =
    typeof payloadRaw === 'string'
      ? safeJsonParse<Record<string, unknown>>(payloadRaw, {})
      : toRecord(payloadRaw) ?? {};
  const bodies = Array.isArray(payload.bodies) ? payload.bodies : [];
  const firstBody = toRecord(bodies[0]) ?? {};
  const type =
    (typeof firstBody.type === 'string' ? firstBody.type : undefined) ??
    (typeof payload.type === 'string' ? payload.type : undefined) ??
    '';
  return {
    msgId,
    type,
    body: firstBody,
    timestamp,
  };
};

const normalizeThreadSummary = (input: unknown): ChatThreadSummary | null => {
  const record = toRecord(input);
  if (!record) {
    return null;
  }
  const chatThreadId =
    (typeof record.id === 'string' ? record.id : undefined) ??
    (typeof record.thread_id === 'string' ? record.thread_id : undefined) ??
    (typeof record.chatThreadId === 'string' ? record.chatThreadId : undefined);
  const parentId =
    (typeof record.parentId === 'string' ? record.parentId : undefined) ??
    (typeof record.groupId === 'string' ? record.groupId : undefined) ??
    (typeof record.group_id === 'string' ? record.group_id : undefined);
  const name = typeof record.name === 'string' ? record.name : '';
  if (!chatThreadId || !parentId || !name) {
    return null;
  }
  return {
    chatThreadId,
    parentId,
    name,
    ownerId: typeof record.owner === 'string' ? record.owner : undefined,
    memberCount:
      typeof record.affiliationsCount === 'number'
        ? record.affiliationsCount
        : typeof record.affiliations_count === 'number'
          ? record.affiliations_count
          : undefined,
    messageCount:
      typeof record.messageCount === 'number'
        ? record.messageCount
        : typeof record.message_count === 'number'
          ? record.message_count
          : undefined,
    createdAt:
      typeof record.created === 'number'
        ? record.created
        : typeof record.createTimestamp === 'number'
          ? record.createTimestamp
          : undefined,
    lastMessage: parseMessageSnippet(record.lastMessage ?? record.last_message),
  };
};

const normalizeThreadDetail = (payload: unknown): ChatThreadDetail => {
  const data = readData(payload);
  const record = Array.isArray(data) ? readFirstArrayItem(data) : data;
  const summary = normalizeThreadSummary(record);
  if (!summary) {
    throw buildInvalidError('response.data', 'response.data is invalid');
  }
  return summary;
};

const normalizeThreadListResult = (payload: unknown): ChatThreadListResult => {
  return {
    items: readEntities(payload)
      .map(item => normalizeThreadSummary(item))
      .filter((item): item is ChatThreadSummary => item !== null),
    cursor: readCursor(payload),
  };
};

const normalizeThreadMemberListResult = (payload: unknown): ChatThreadMemberListResult => {
  const items = readEntities(payload)
    .map(item => {
      if (typeof item === 'string') {
        return { memberId: item } satisfies ChatThreadMemberEntry;
      }
      const record = toRecord(item);
      if (!record) {
        return null;
      }
      const memberId =
        (typeof record.memberId === 'string' ? record.memberId : undefined) ??
        (typeof record.user === 'string' ? record.user : undefined) ??
        (typeof record.username === 'string' ? record.username : undefined);
      if (!memberId) {
        return null;
      }
      return {
        memberId,
        joinedAt: typeof record.joinedAt === 'number' ? record.joinedAt : undefined,
      } satisfies ChatThreadMemberEntry;
    })
    .filter((item): item is ChatThreadMemberEntry => item !== null);
  return {
    items,
    cursor: readCursor(payload),
  };
};

const normalizeLastMessageListResult = (payload: unknown): ChatThreadLastMessageListResult => {
  const items = readEntities(payload)
    .map(item => {
      const record = toRecord(item);
      if (!record) {
        return null;
      }
      const chatThreadId =
        (typeof record.chatThreadId === 'string' ? record.chatThreadId : undefined) ??
        (typeof record.thread_id === 'string' ? record.thread_id : undefined);
      if (!chatThreadId) {
        return null;
      }
      return {
        chatThreadId,
        lastMessage: parseMessageSnippet(record.lastMessage ?? record.last_message),
      };
    })
    .filter(
      (item): item is ChatThreadLastMessageListResult['items'][number] => item !== null
    );
  return { items };
};

export const requestCreateChatThread = async (
  client: RestClient,
  context: RestContext,
  params: CreateChatThreadParams
): Promise<CreateChatThreadResult> => {
  const endpointContext = buildEndpointContext(context);
  const parentId = normalizeRequiredString(params.parentId, 'params.parentId');
  const name = normalizeRequiredString(params.name, 'params.name');
  const messageId = normalizeRequiredString(params.messageId, 'params.messageId');
  const response = await client.post<unknown>(
    `/${endpointContext.orgName}/${endpointContext.appName}/thread?resource=${endpointContext.encodedResource}`,
    {
      name,
      msg_id: messageId,
      group_id: parentId,
      owner: context.userId,
    },
    {
      operation: 'createChatThread',
    }
  );
  const data = toRecord(readData(response));
  const chatThreadId = typeof data?.thread_id === 'string' ? data.thread_id : undefined;
  if (!chatThreadId) {
    throw buildInvalidError('response.data.thread_id', 'response.data.thread_id is invalid');
  }
  return { chatThreadId };
};

export const requestGetChatThreadList = async (
  client: RestClient,
  context: RestContext,
  params: GetChatThreadListParams
): Promise<ChatThreadListResult> => {
  const endpointContext = buildEndpointContext(context);
  const parentId = normalizeRequiredString(params.parentId, 'params.parentId');
  const pageSize = normalizePageSize(params.pageSize, 'params.pageSize');
  const cursor = normalizeOptionalCursor(params.cursor, 'params.cursor');
  const query = new URLSearchParams({
    limit: String(pageSize),
    cursor,
  });
  const response = await client.get<unknown>(
    `/${endpointContext.orgName}/${endpointContext.appName}/threads/chatgroups/${encodeURIComponent(parentId)}?${query.toString()}`,
    {
      operation: 'getChatThreadList',
    }
  );
  return normalizeThreadListResult(response);
};

export const requestGetJoinedChatThreadList = async (
  client: RestClient,
  context: RestContext,
  params: GetJoinedChatThreadListParams = {}
): Promise<ChatThreadListResult> => {
  const endpointContext = buildEndpointContext(context);
  const pageSize = normalizePageSize(params.pageSize, 'params.pageSize');
  const cursor = normalizeOptionalCursor(params.cursor, 'params.cursor');
  const query = new URLSearchParams({
    limit: String(pageSize),
    cursor,
  });
  const endpoint =
    typeof params.parentId === 'string' && params.parentId.trim().length > 0
      ? `/${endpointContext.orgName}/${endpointContext.appName}/threads/chatgroups/${encodeURIComponent(params.parentId.trim())}/user/${endpointContext.encodedUserId}?${query.toString()}`
      : `/${endpointContext.orgName}/${endpointContext.appName}/threads/user/${endpointContext.encodedUserId}?${query.toString()}`;
  const response = await client.get<unknown>(endpoint, {
    operation: 'getJoinedChatThreadList',
  });
  return normalizeThreadListResult(response);
};

export const requestGetChatThreadInfo = async (
  client: RestClient,
  context: RestContext,
  chatThreadId: string
): Promise<ChatThreadDetail> => {
  const endpointContext = buildEndpointContext(context);
  const normalizedId = normalizeRequiredString(chatThreadId, 'chatThreadId');
  const response = await client.get<unknown>(
    `/${endpointContext.orgName}/${endpointContext.appName}/thread/${encodeURIComponent(normalizedId)}`,
    {
      operation: 'getChatThreadInfo',
    }
  );
  return normalizeThreadDetail(response);
};

export const requestJoinChatThread = async (
  client: RestClient,
  context: RestContext,
  chatThreadId: string
): Promise<void> => {
  const endpointContext = buildEndpointContext(context);
  const normalizedId = normalizeRequiredString(chatThreadId, 'chatThreadId');
  await client.post<unknown>(
    `/${endpointContext.orgName}/${endpointContext.appName}/thread/${encodeURIComponent(normalizedId)}/user/${endpointContext.encodedUserId}/join?resource=${endpointContext.encodedResource}`,
    undefined,
    {
      operation: 'joinChatThread',
    }
  );
};

export const requestLeaveChatThread = async (
  client: RestClient,
  context: RestContext,
  chatThreadId: string
): Promise<void> => {
  const endpointContext = buildEndpointContext(context);
  const normalizedId = normalizeRequiredString(chatThreadId, 'chatThreadId');
  await client.delete<unknown>(
    `/${endpointContext.orgName}/${endpointContext.appName}/thread/${encodeURIComponent(normalizedId)}/user/${endpointContext.encodedUserId}/quit?resource=${endpointContext.encodedResource}`,
    {
      operation: 'leaveChatThread',
    }
  );
};

export const requestDestroyChatThread = async (
  client: RestClient,
  context: RestContext,
  chatThreadId: string
): Promise<void> => {
  const endpointContext = buildEndpointContext(context);
  const normalizedId = normalizeRequiredString(chatThreadId, 'chatThreadId');
  await client.delete<unknown>(
    `/${endpointContext.orgName}/${endpointContext.appName}/thread/${encodeURIComponent(normalizedId)}?resource=${endpointContext.encodedResource}`,
    {
      operation: 'destroyChatThread',
    }
  );
};

export const requestUpdateChatThreadName = async (
  client: RestClient,
  context: RestContext,
  params: UpdateChatThreadNameParams
): Promise<void> => {
  const endpointContext = buildEndpointContext(context);
  const chatThreadId = normalizeRequiredString(params.chatThreadId, 'params.chatThreadId');
  const name = normalizeRequiredString(params.name, 'params.name');
  await client.put<unknown>(
    `/${endpointContext.orgName}/${endpointContext.appName}/thread/${encodeURIComponent(chatThreadId)}?resource=${endpointContext.encodedResource}`,
    {
      name,
    },
    {
      operation: 'updateChatThreadName',
    }
  );
};

export const requestGetChatThreadMemberList = async (
  client: RestClient,
  context: RestContext,
  params: GetChatThreadMemberListParams
): Promise<ChatThreadMemberListResult> => {
  const endpointContext = buildEndpointContext(context);
  const chatThreadId = normalizeRequiredString(params.chatThreadId, 'params.chatThreadId');
  const pageSize = normalizePageSize(params.pageSize, 'params.pageSize');
  const cursor = normalizeOptionalCursor(params.cursor, 'params.cursor');
  const query = new URLSearchParams({
    limit: String(pageSize),
    cursor,
  });
  const response = await client.get<unknown>(
    `/${endpointContext.orgName}/${endpointContext.appName}/thread/${encodeURIComponent(chatThreadId)}/users?${query.toString()}`,
    {
      operation: 'getChatThreadMemberList',
    }
  );
  return normalizeThreadMemberListResult(response);
};

export const requestRemoveChatThreadMember = async (
  client: RestClient,
  context: RestContext,
  params: RemoveChatThreadMemberParams
): Promise<void> => {
  const endpointContext = buildEndpointContext(context);
  const chatThreadId = normalizeRequiredString(params.chatThreadId, 'params.chatThreadId');
  const memberId = normalizeRequiredString(params.memberId, 'params.memberId');
  await client.delete<unknown>(
    `/${endpointContext.orgName}/${endpointContext.appName}/thread/${encodeURIComponent(chatThreadId)}/users/${encodeURIComponent(memberId)}?resource=${endpointContext.encodedResource}`,
    {
      operation: 'removeChatThreadMember',
    }
  );
};

export const requestGetChatThreadLastMessageList = async (
  client: RestClient,
  context: RestContext,
  params: GetChatThreadLastMessageListParams
): Promise<ChatThreadLastMessageListResult> => {
  const endpointContext = buildEndpointContext(context);
  if (!Array.isArray(params.chatThreadIds) || params.chatThreadIds.length === 0) {
    throw buildRequiredError('params.chatThreadIds');
  }
  if (params.chatThreadIds.length > MAX_LAST_MESSAGE_BATCH) {
    throw buildInvalidError(
      'params.chatThreadIds',
      `params.chatThreadIds must contain at most ${MAX_LAST_MESSAGE_BATCH} items`
    );
  }
  const chatThreadIds = params.chatThreadIds.map((item, index) =>
    normalizeRequiredString(item, `params.chatThreadIds[${index}]`)
  );
  const response = await client.post<unknown>(
    `/${endpointContext.orgName}/${endpointContext.appName}/thread/message`,
    {
      threadIds: chatThreadIds,
    },
    {
      operation: 'getChatThreadLastMessageList',
    }
  );
  return normalizeLastMessageListResult(response);
};
