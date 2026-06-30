import { isRecord, safeJsonParse } from '../cache/cache-utils';
import { parseAppKey } from '../upload/utils';
import type {
  Message,
  MessageBody,
  MessageModifiedInfo,
  MessageType,
  Sender,
} from '../types';
import type {
  ConversationMark,
  ConversationMarkMutationItem,
  ConversationMarkMutationResult,
  ConversationMarkParams,
  ConversationMutationResult,
  ConversationMarkTarget,
  PinnedMessageSummary,
  ConversationType,
  DeleteConversationParams,
  GetPinnedMessageListParams,
  MessagePinMutationResult,
  PinnedMessageListResult,
  PinMessageParams,
  SetConversationPinnedParams,
} from '../types/conversation';
import type { RestContext } from '../types/chat-client';
import { ERROR_CODES } from '../utils/error-codes';
import { ValidationError } from '../utils/errors';
import type { RestClient } from './client';

const PINNED_MESSAGE_LIST_LIMIT = 20;

const buildRequiredError = (path: string): ValidationError => {
  return new ValidationError(`${path} is required`, {
    code: ERROR_CODES.VALIDATION_REQUIRED,
    details: {
      fields: [
        {
          path,
          message: `${path} is required`,
          rule: 'required',
        },
      ],
    },
  });
};

const buildInvalidError = (path: string, message: string): ValidationError => {
  return new ValidationError(message, {
    code: ERROR_CODES.VALIDATION_INVALID_FORMAT,
    details: {
      fields: [
        {
          path,
          message,
          rule: 'invalid_format',
        },
      ],
    },
  });
};

const normalizeConversationId = (value: unknown, path: string): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw buildRequiredError(path);
  }
  return value.trim();
};

const normalizeMark = (value: unknown, path: string): ConversationMark => {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 19) {
    throw buildInvalidError(path, `${path} must be an integer between 0 and 19`);
  }
  return value as ConversationMark;
};

const toRestConversationMark = (mark: ConversationMark): string => {
  return `mark_${String(mark)}`;
};

const normalizeConversationType = (value: unknown, path: string): ConversationType => {
  if (value === 'singleChat' || value === 'groupChat' || value === 'chatRoom') {
    return value;
  }
  throw buildInvalidError(path, `${path} must be one of singleChat, groupChat, chatRoom`);
};

const normalizeConversationTargets = (
  params: ConversationMarkParams
): ReadonlyArray<ConversationMarkTarget> => {
  const record = params as Record<string, unknown>;
  const rawConversations = record['conversations'];
  if (rawConversations !== undefined) {
    if (!Array.isArray(rawConversations) || rawConversations.length === 0) {
      throw buildInvalidError(
        'params.conversations',
        'params.conversations must be a non-empty array'
      );
    }
    return rawConversations.map((item, index) => {
      if (!isRecord(item)) {
        throw buildInvalidError(
          `params.conversations.${String(index)}`,
          `params.conversations.${String(index)} must be an object`
        );
      }
      return {
        conversationId: normalizeConversationId(
          item.conversationId,
          `params.conversations.${String(index)}.conversationId`
        ),
        conversationType: normalizeConversationType(
          item.conversationType,
          `params.conversations.${String(index)}.conversationType`
        ),
      };
    });
  }
  return [
    {
      conversationId: normalizeConversationId(record['conversationId'], 'params.conversationId'),
      conversationType: normalizeConversationType(
        record['conversationType'],
        'params.conversationType'
      ),
    },
  ];
};

const toRestConversationType = (type: ConversationType): 'chat' | 'groupchat' | 'chatroom' => {
  if (type === 'singleChat') {
    return 'chat';
  }
  if (type === 'groupChat') {
    return 'groupchat';
  }
  return 'chatroom';
};

const fromRestConversationType = (value: unknown): ConversationType | null => {
  if (value === 'chat' || value === 'singleChat') {
    return 'singleChat';
  }
  if (value === 'groupchat' || value === 'groupChat') {
    return 'groupChat';
  }
  if (value === 'chatroom' || value === 'chatRoom') {
    return 'chatRoom';
  }
  return null;
};

const readString = (value: unknown): string | undefined => {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
};

const readNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const readRecord = (value: unknown): Record<string, unknown> | undefined => {
  return isRecord(value) ? value : undefined;
};

const readPayload = (value: unknown): Record<string, unknown> => {
  if (typeof value === 'string') {
    return safeJsonParse<Record<string, unknown>>(value, {});
  }
  return readRecord(value) ?? {};
};

const readModifiedInfo = (value: unknown): MessageModifiedInfo | undefined => {
  const record = readRecord(value);
  if (!record) {
    return undefined;
  }
  const operatorId = readString(record.operatorId) ?? readString(record.operator);
  const operationCount = readNumber(record.operationCount) ?? readNumber(record.count);
  const operationTime = readNumber(record.operationTime) ?? readNumber(record.edit_time);
  if (!operatorId || operationCount === undefined || operationTime === undefined) {
    return undefined;
  }
  return {
    operatorId,
    operationCount,
    operationTime,
  };
};

const normalizePinnedMessageType = (value: unknown): MessageType | null => {
  if (value === 'txt' || value === 'text') {
    return 'text';
  }
  if (value === 'custom') {
    return 'custom';
  }
  if (value === 'cmd') {
    return 'cmd';
  }
  if (
    value === 'image' ||
    value === 'file' ||
    value === 'voice' ||
    value === 'video' ||
    value === 'location' ||
    value === 'combine'
  ) {
    return value;
  }
  return null;
};

const normalizePinnedMessageBody = (
  type: MessageType,
  body: Record<string, unknown>
): MessageBody | null => {
  if (type === 'text') {
    return { content: readString(body.msg) ?? readString(body.content) ?? '' };
  }
  if (type === 'custom') {
    const params = readRecord(body.customExts) ?? readRecord(body.params) ?? {};
    const stringParams: Record<string, string> = {};
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string') {
        stringParams[key] = value;
      }
    }
    return {
      event: readString(body.customEvent) ?? readString(body.event) ?? '',
      params: stringParams,
    };
  }
  if (type === 'cmd') {
    const params = readRecord(body.params) ?? {};
    const stringParams: Record<string, string> = {};
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string') {
        stringParams[key] = value;
      }
    }
    return {
      action: readString(body.action) ?? '',
      params: stringParams,
    };
  }
  if (type === 'image') {
    const url = readString(body.url) ?? readString(body.remotePath) ?? '';
    return {
      localUrl: '',
      filename: readString(body.filename) ?? readString(body.displayName),
      filetype: readString(body.filetype) ?? 'application/octet-stream',
      width: readNumber(body.width),
      height: readNumber(body.height),
      isGif: body.isGif === true || body.subType === 1,
      isOriginalImage: body.isOriginalImage === true,
      originalImageUrl: url,
      bigImageUrl: readString(body.bigImageUrl),
      thumbnailUrl: readString(body.thumbnailUrl) ?? readString(body.thumbnailRemotePath),
      secret: readString(body.secret) ?? readString(body.secretKey),
      fileLength: readNumber(body.fileLength),
    };
  }
  if (type === 'file') {
    return {
      url: readString(body.url) ?? readString(body.remotePath),
      filename: readString(body.filename) ?? readString(body.displayName),
      filetype: readString(body.filetype) ?? 'application/octet-stream',
      fileSize: readNumber(body.fileSize),
      fileLength: readNumber(body.fileLength),
      secret: readString(body.secret) ?? readString(body.secretKey),
    };
  }
  if (type === 'voice') {
    return {
      url: readString(body.url) ?? readString(body.remotePath),
      filename: readString(body.filename) ?? readString(body.displayName),
      filetype: readString(body.filetype) ?? 'application/octet-stream',
      duration: readNumber(body.duration) ?? 0,
      fileLength: readNumber(body.fileLength),
      secret: readString(body.secret) ?? readString(body.secretKey),
    };
  }
  if (type === 'video') {
    return {
      url: readString(body.url) ?? readString(body.remotePath),
      filename: readString(body.filename) ?? readString(body.displayName),
      filetype: readString(body.filetype) ?? 'application/octet-stream',
      duration: readNumber(body.duration) ?? 0,
      width: readNumber(body.width),
      height: readNumber(body.height),
      fileLength: readNumber(body.fileLength),
      secret: readString(body.secret) ?? readString(body.secretKey),
      thumbnailUrl: readString(body.thumbnailUrl) ?? readString(body.thumbnailRemotePath),
    };
  }
  if (type === 'location') {
    return {
      latitude: readNumber(body.latitude) ?? 0,
      longitude: readNumber(body.longitude) ?? 0,
      address: readString(body.address),
      buildingName: readString(body.buildingName),
    };
  }
  return null;
};

const normalizePinnedMessage = (
  value: unknown,
  fallback: {
    readonly messageId: string;
    readonly conversationId: string;
    readonly conversationType: ConversationType;
    readonly currentUserId: string;
    readonly timestamp: number;
  }
): Message | undefined => {
  const record = readRecord(value);
  if (!record) {
    return undefined;
  }
  const payload = readPayload(record.payload);
  const bodies = Array.isArray(payload.bodies) ? payload.bodies : [];
  const firstBody = readRecord(bodies[0]) ?? readRecord(payload.body);
  const type = normalizePinnedMessageType(firstBody?.type ?? payload.type);
  if (!firstBody || !type) {
    return undefined;
  }
  const body = normalizePinnedMessageBody(type, firstBody);
  if (!body) {
    return undefined;
  }
  const from = readString(payload.from) ?? readString(record.from) ?? '';
  const to = readString(payload.to) ?? fallback.conversationId;
  const senderRecord = readRecord(payload.sender);
  const sender: Sender = {
    userId: readString(senderRecord?.userId) ?? from,
    nickname: readString(senderRecord?.nickname),
    avatarUrl: readString(senderRecord?.avatarUrl),
  };
  const ext = readRecord(payload.ext) ?? {};
  const modifiedInfo = readModifiedInfo(payload.modifiedInfo ?? readRecord(payload.meta)?.edit_msg);
  return {
    msgServerId: readString(record.id) ?? fallback.messageId,
    msgLocalId: readString(record.msgLocalId) ?? '',
    from,
    to,
    sender,
    conversationId: fallback.conversationId,
    conversationType: fallback.conversationType,
    type,
    status: 'sent',
    ext,
    timestamp: readNumber(record.timestamp) ?? fallback.timestamp,
    body,
    direct: from === fallback.currentUserId ? 'SEND' : 'RECEIVE',
    ...(modifiedInfo ? { modifiedInfo } : {}),
  };
};

const buildConversationKey = (target: ConversationMarkTarget): string => {
  return `${target.conversationType}:${target.conversationId}`;
};

const normalizeIgnoredConversationTargets = (
  value: unknown
): ReadonlySet<string> => {
  if (!Array.isArray(value)) {
    return new Set<string>();
  }
  const ignored = new Set<string>();
  value.forEach(item => {
    if (!isRecord(item)) {
      return;
    }
    const conversationId = typeof item.to === 'string' ? item.to.trim() : '';
    const conversationType = fromRestConversationType(item.type);
    if (!conversationId || !conversationType) {
      return;
    }
    ignored.add(buildConversationKey({ conversationId, conversationType }));
  });
  return ignored;
};

const buildEndpointContext = (
  context: RestContext
): {
  readonly orgName: string;
  readonly appName: string;
  readonly encodedUserId: string;
  readonly encodedResource: string;
} => {
  const { orgName, appName } = parseAppKey(context.appKey);
  return {
    orgName,
    appName,
    encodedUserId: encodeURIComponent(context.userId),
    encodedResource: encodeURIComponent(context.clientResource),
  };
};

export const requestDeleteConversation = async (
  client: RestClient,
  context: RestContext,
  params: DeleteConversationParams
): Promise<ConversationMutationResult> => {
  const endpointContext = buildEndpointContext(context);
  const conversationId = normalizeConversationId(params.conversationId, 'params.conversationId');
  const type = normalizeConversationType(params.conversationType, 'params.conversationType');
  const deleteRoamingMessages = params.deleteRoamingMessages ?? false;
  if (typeof deleteRoamingMessages !== 'boolean') {
    throw buildInvalidError(
      'params.deleteRoamingMessages',
      'params.deleteRoamingMessages must be a boolean'
    );
  }
  await client.request<unknown>(
    `/${endpointContext.orgName}/${endpointContext.appName}/user/${endpointContext.encodedUserId}/user_channel?resource=${endpointContext.encodedResource}`,
    {
      method: 'DELETE',
      body: {
        channel: conversationId,
        type: type === 'groupChat' ? 'groupChat' : toRestConversationType(type),
        delete_roam: deleteRoamingMessages,
      },
      operation: 'deleteConversation',
    }
  );
  return {
    conversationId,
    conversationType: type,
    operation: 'delete',
  };
};

export const requestSetConversationPinned = async (
  client: RestClient,
  context: RestContext,
  params: SetConversationPinnedParams
): Promise<ConversationMutationResult> => {
  const endpointContext = buildEndpointContext(context);
  const conversationId = normalizeConversationId(params.conversationId, 'params.conversationId');
  const type = normalizeConversationType(params.conversationType, 'params.conversationType');
  if (typeof params.pinned !== 'boolean') {
    throw buildInvalidError('params.pinned', 'params.pinned must be a boolean');
  }
  const restType = type === 'groupChat' ? 'groupChat' : toRestConversationType(type);
  const response = params.pinned
    ? await client.post<unknown>(
        `/${endpointContext.orgName}/${endpointContext.appName}/sdk/user/${endpointContext.encodedUserId}/user_channel/top?resource=${endpointContext.encodedResource}`,
        {
          type: restType,
          to: conversationId,
        },
        {
          operation: 'setConversationPinned',
        }
      )
    : await client.delete<unknown>(
        `/${endpointContext.orgName}/${endpointContext.appName}/sdk/user/${endpointContext.encodedUserId}/user_channel/top?type=${encodeURIComponent(restType)}&to=${encodeURIComponent(conversationId)}&resource=${endpointContext.encodedResource}`,
        {
          operation: 'setConversationPinned',
        }
      );
  const data = isRecord(response) && isRecord(response.data) ? response.data : {};
  return {
    conversationId,
    conversationType: type,
    operation: 'setPinned',
    isPinned: typeof data.is_top === 'boolean' ? data.is_top : params.pinned,
    pinnedTime:
      typeof data.update_top_status_time === 'number'
        ? data.update_top_status_time
        : params.pinned
          ? Date.now()
          : 0,
  };
};

const requestMarkConversation = async (
  client: RestClient,
  context: RestContext,
  params: ConversationMarkParams,
  isMarked: boolean
): Promise<ConversationMarkMutationResult> => {
  const endpointContext = buildEndpointContext(context);
  const conversations = normalizeConversationTargets(params);
  const mark = normalizeMark(params.mark, 'params.mark');
  const response = await client.request<unknown>(
    `/${endpointContext.orgName}/${endpointContext.appName}/sdk/user/${endpointContext.encodedUserId}/user_channels/mark?resource=${endpointContext.encodedResource}`,
    {
      method: isMarked ? 'POST' : 'DELETE',
      body: {
        mark: toRestConversationMark(mark),
        targets: conversations.map(target => ({
          to: target.conversationId,
          type: toRestConversationType(target.conversationType),
        })),
      },
      operation: isMarked ? 'addConversationMark' : 'removeConversationMark',
    }
  );
  const data = isRecord(response) && isRecord(response.data) ? response.data : {};
  const ignored = normalizeIgnoredConversationTargets(data.ignore);
  const succeeded: ConversationMarkMutationItem[] = [];
  const failed: ConversationMarkMutationItem[] = [];
  for (const target of conversations) {
    const item = {
      conversationId: target.conversationId,
      conversationType: target.conversationType,
    };
    if (ignored.has(buildConversationKey(target))) {
      failed.push({
        ...item,
        reason: 'ignored_by_server',
      });
    } else {
      succeeded.push(item);
    }
  }
  return {
    succeeded,
    failed,
    mark,
    operation: isMarked ? 'addMark' : 'removeMark',
  };
};

export const requestAddConversationMark = async (
  client: RestClient,
  context: RestContext,
  params: ConversationMarkParams
): Promise<ConversationMarkMutationResult> => {
  return requestMarkConversation(client, context, params, true);
};

export const requestRemoveConversationMark = async (
  client: RestClient,
  context: RestContext,
  params: ConversationMarkParams
): Promise<ConversationMarkMutationResult> => {
  return requestMarkConversation(client, context, params, false);
};

export const requestClearAllMessagesAndConversations = async (
  client: RestClient,
  context: RestContext
): Promise<void> => {
  const endpointContext = buildEndpointContext(context);
  await client.post<unknown>(
    `/${endpointContext.orgName}/${endpointContext.appName}/sdk/message/roaming/user/${endpointContext.encodedUserId}/delete/all?resource=${endpointContext.encodedResource}`,
    undefined,
    {
      operation: 'clearAllMessagesAndConversations',
    }
  );
};

const requestSetPinnedMessageStatus = async (
  client: RestClient,
  context: RestContext,
  params: PinMessageParams,
  isPinned: boolean
): Promise<MessagePinMutationResult> => {
  const endpointContext = buildEndpointContext(context);
  const conversationId = normalizeConversationId(params.conversationId, 'params.conversationId');
  const type = normalizeConversationType(params.conversationType, 'params.conversationType');
  const messageId = normalizeConversationId(params.messageId, 'params.messageId');
  await client.request<unknown>(
    `/${endpointContext.orgName}/${endpointContext.appName}/sdk/user/${endpointContext.encodedUserId}/user_channel/pin?resource=${endpointContext.encodedResource}`,
    {
      method: isPinned ? 'POST' : 'DELETE',
      body: {
        to: conversationId,
        type: toRestConversationType(type),
        pin_msg_id: messageId,
      },
      operation: isPinned ? 'pinMessage' : 'unpinMessage',
    }
  );
  return {
    conversationId,
    conversationType: type,
    messageId,
    operation: isPinned ? 'pin' : 'unpin',
  };
};

export const requestPinMessage = async (
  client: RestClient,
  context: RestContext,
  params: PinMessageParams
): Promise<MessagePinMutationResult> => {
  return requestSetPinnedMessageStatus(client, context, params, true);
};

export const requestUnpinMessage = async (
  client: RestClient,
  context: RestContext,
  params: PinMessageParams
): Promise<MessagePinMutationResult> => {
  return requestSetPinnedMessageStatus(client, context, params, false);
};

export const requestGetPinnedMessageList = async (
  client: RestClient,
  context: RestContext,
  params: GetPinnedMessageListParams
): Promise<PinnedMessageListResult> => {
  const endpointContext = buildEndpointContext(context);
  const conversationId = normalizeConversationId(params.conversationId, 'params.conversationId');
  const type = normalizeConversationType(params.conversationType, 'params.conversationType');
  const response = await client.get<unknown>(
    `/${endpointContext.orgName}/${endpointContext.appName}/sdk/user/${endpointContext.encodedUserId}/user_channel/pin?to=${encodeURIComponent(conversationId)}&type=${encodeURIComponent(toRestConversationType(type))}&limit=${String(PINNED_MESSAGE_LIST_LIMIT)}`,
    {
      operation: 'getPinnedMessageList',
    }
  );
  const data = isRecord(response) && isRecord(response.data) ? response.data : {};
  const infos = Array.isArray(data.msg_infos) ? data.msg_infos : [];
  const items = infos.reduce<PinnedMessageSummary[]>((result, item) => {
    if (!isRecord(item)) {
      return result;
    }
    const messageId =
      typeof item.pin_msg_id === 'string'
        ? item.pin_msg_id
        : isRecord(item.message) && typeof item.message.id === 'string'
          ? item.message.id
          : '';
    if (!messageId) {
      return result;
    }
    const pinnedAt = typeof item.pin_opt_at === 'number' ? item.pin_opt_at : 0;
    const message = normalizePinnedMessage(item.message, {
      messageId,
      conversationId,
      conversationType: type,
      currentUserId: context.userId,
      timestamp: pinnedAt,
    });
    if (!message) {
      return result;
    }
    result.push({
      messageId,
      conversationId,
      conversationType: type,
      operatorId: typeof item.pin_operator === 'string' ? item.pin_operator : undefined,
      pinnedAt,
      message,
    });
    return result;
  }, []);
  return {
    items,
  };
};
