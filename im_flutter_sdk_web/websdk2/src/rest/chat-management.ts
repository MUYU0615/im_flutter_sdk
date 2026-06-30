import { parseAppKey, appendAttachUrlParams } from '../upload/utils';
import type { RestClient } from './client';
import { createRestBusinessError } from './errors';
import type { RestContext } from '../types/chat-client';
import type {
  GetHistoryMessagesParams,
  GetReactionDetailParams,
  GetReactionListParams,
  GroupMessageReadUsersResult,
  GroupMessageReadUsersParams,
  MessageHistoryPage,
  MessageReactionDetailPage,
  MessageReactionListItem,
  RemoveHistoryMessagesParams,
  TranslationLanguage,
  MessageTranslationResult,
  SearchMessagesParams,
  SearchMessagesResult,
  SearchResultMessage,
} from '../types/chat-manager';
import type { Message, MessageBody, UserInfo } from '../types';

type DecodeMetaMessage = (metaPayload: Uint8Array) => Message | null;

const buildBaseUrl = (context: RestContext): string => {
  const { orgName, appName } = parseAppKey(context.appKey);
  return `/${orgName}/${appName}`;
};

const toUint8Array = (base64Value: string): Uint8Array => {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64Value, 'base64'));
  }
  const binary = atob(base64Value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const normalizeCursor = (value: unknown): string => {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null') {
    return '';
  }
  return trimmed;
};

const toUserInfo = (userId: string): UserInfo => ({ userId });

const requireResponseDataRecord = (response: unknown, apiName: string): Record<string, unknown> => {
  if (!isRecord(response) || !isRecord(response.data)) {
    throw createRestBusinessError({
      apiName,
      message: `${apiName} response data is invalid`,
      mapped: false,
    });
  }
  return response.data;
};

const requireResponseDataArray = (response: unknown, apiName: string): ReadonlyArray<unknown> => {
  if (!isRecord(response) || !Array.isArray(response.data)) {
    throw createRestBusinessError({
      apiName,
      message: `${apiName} response data is invalid`,
      mapped: false,
    });
  }
  return response.data;
};

const requireResponseArrayOrDataArray = (
  response: unknown,
  apiName: string
): ReadonlyArray<unknown> => {
  if (Array.isArray(response)) {
    return response;
  }
  return requireResponseDataArray(response, apiName);
};

export const requestGetHistoryMessages = async (
  client: RestClient,
  context: RestContext,
  params: GetHistoryMessagesParams,
  decodeMetaMessage: DecodeMetaMessage
): Promise<MessageHistoryPage> => {
  const endpoint = `${buildBaseUrl(context)}/users/${context.userId}/messageroaming`;
  const response = await client.post<unknown>(
    endpoint,
    {
      queue:
        params.conversationType === 'singleChat'
          ? `${params.conversationId}@easemob.com`
          : `${params.conversationId}@conference.easemob.com`,
      start: params.cursor && params.cursor.length > 0 ? params.cursor : -1,
      pull_number: params.pageSize ?? 20,
      is_positive: params.searchDirection === 'down',
      msgType: (params.messageTypes ?? []).join(','),
      end: -1,
      startTime: params.startTime ?? null,
      endTime: params.endTime ?? null,
      userIds:
        params.conversationType === 'singleChat'
          ? null
          : params.senderIds && params.senderIds.length > 0
            ? params.senderIds
            : null,
    },
    { operation: 'getHistoryMessages' }
  );

  const data = requireResponseDataRecord(response, 'getHistoryMessages');
  const msgs = Array.isArray(data.msgs) ? data.msgs : [];
  const items: Message[] = [];
  for (const entry of msgs) {
    if (!isRecord(entry) || typeof entry.msg !== 'string' || entry.msg.length === 0) {
      continue;
    }
    const decoded = decodeMetaMessage(toUint8Array(entry.msg));
    if (decoded) {
      items.push(decoded);
    }
  }

  return {
    items,
    cursor: normalizeCursor(data.next_key),
    hasMore: data.is_last === true ? false : items.length > 0,
  };
};

export const requestRemoveHistoryMessages = async (
  client: RestClient,
  context: RestContext,
  params: RemoveHistoryMessagesParams
): Promise<void> => {
  const conversationKey = params.conversationType === 'singleChat' ? 'userId' : 'groupId';
  const conversationType = params.conversationType === 'singleChat' ? 'chat' : 'group';
  const resource = encodeURIComponent(context.clientResource);
  const endpoint = params.messageIds
    ? `${buildBaseUrl(context)}/sdk/message/roaming/${conversationType}/user/${context.userId}?${conversationKey}=${encodeURIComponent(params.conversationId)}&msgIdList=${encodeURIComponent(params.messageIds.join(','))}&resource=${resource}`
    : `${buildBaseUrl(context)}/sdk/message/roaming/${conversationType}/user/${context.userId}/time?${conversationKey}=${encodeURIComponent(params.conversationId)}&delTime=${params.beforeTimestamp}&resource=${resource}`;
  await client.delete(endpoint, { operation: 'removeHistoryMessages' });
};

export const requestGetGroupMessageReadUsers = async (
  client: RestClient,
  context: RestContext,
  params: GroupMessageReadUsersParams
): Promise<GroupMessageReadUsersResult> => {
  const query = new URLSearchParams();
  query.set('limit', String(params.pageSize ?? 10));
  if (params.cursor) {
    query.set('key', params.cursor);
  }
  const endpoint = `${buildBaseUrl(context)}/chatgroups/${encodeURIComponent(params.groupId)}/acks/${encodeURIComponent(params.messageId)}?${query.toString()}`;
  const response = await client.get<unknown>(endpoint, { operation: 'getGroupMessageReadUsers' });
  const data = requireResponseDataRecord(response, 'getGroupMessageReadUsers');
  const groupAck = isRecord(data.group_ack) ? data.group_ack : data;
  const userList = Array.isArray(groupAck.userlist) ? groupAck.userlist : [];
  const users = userList
    .map(item => {
      if (!isRecord(item) || typeof item.username !== 'string') {
        return null;
      }
      return {
        userId: item.username,
        user: toUserInfo(item.username),
        ackId: typeof item.meta_id === 'string' ? item.meta_id : undefined,
        timestamp: typeof item.timestamp === 'number' ? item.timestamp : undefined,
        ackContent: typeof item.ack_content === 'string' ? item.ack_content : undefined,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return {
    groupId: params.groupId,
    messageId: typeof data.ackmid === 'string' ? data.ackmid : params.messageId,
    users,
    count: typeof groupAck.total === 'number' ? groupAck.total : users.length,
    cursor: normalizeCursor(groupAck.next_key),
    hasMore: groupAck.is_last === true ? false : users.length > 0,
  };
};

export const requestAddReaction = async (
  client: RestClient,
  context: RestContext,
  params: { messageId: string; reaction: string }
): Promise<void> => {
  await client.post(
    `${buildBaseUrl(context)}/reaction/user/${context.userId}`,
    {
      msgId: params.messageId,
      message: params.reaction,
    },
    { operation: 'addReaction' }
  );
};

export const requestRemoveReaction = async (
  client: RestClient,
  context: RestContext,
  params: { messageId: string; reaction: string }
): Promise<void> => {
  const endpoint = `${buildBaseUrl(context)}/reaction/user/${context.userId}?msgId=${encodeURIComponent(params.messageId)}&message=${encodeURIComponent(params.reaction)}`;
  await client.delete(endpoint, { operation: 'removeReaction' });
};

export const requestGetReactionList = async (
  client: RestClient,
  context: RestContext,
  params: GetReactionListParams
): Promise<ReadonlyArray<MessageReactionListItem>> => {
  const query = new URLSearchParams();
  const messageIdList =
    typeof params.messageId === 'string' ? params.messageId : [...params.messageId].join(',');
  query.set('msgIdList', messageIdList);
  query.set('msgType', params.conversationType === 'groupChat' ? 'group' : 'chat');
  if (params.groupId) {
    query.set('groupId', params.groupId);
  }
  const response = await client.get<unknown>(
    `${buildBaseUrl(context)}/reaction/user/${context.userId}?${query.toString()}`,
    { operation: 'getReactionList' }
  );
  const data = requireResponseDataArray(response, 'getReactionList');
  return data
    .map(item => {
      if (!isRecord(item) || typeof item.msgId !== 'string') {
        return null;
      }
      const reactionList = Array.isArray(item.reactionList) ? item.reactionList : [];
      return {
        messageId: item.msgId,
        reactions: reactionList
          .map(reaction => {
            if (!isRecord(reaction) || typeof reaction.reaction !== 'string') {
              return null;
            }
            return {
              reaction: reaction.reaction,
              count: typeof reaction.count === 'number' ? reaction.count : 0,
              isAddedBySelf: reaction.state === true,
              userIds: Array.isArray(reaction.userList)
                ? reaction.userList.filter((userId): userId is string => typeof userId === 'string')
                : [],
            };
          })
          .filter((reaction): reaction is NonNullable<typeof reaction> => reaction !== null),
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
};

export const requestGetReactionDetail = async (
  client: RestClient,
  context: RestContext,
  params: GetReactionDetailParams
): Promise<MessageReactionDetailPage> => {
  const query = new URLSearchParams();
  query.set('msgId', params.messageId);
  query.set('message', params.reaction);
  query.set('cursor', params.cursor ?? '');
  query.set('limit', String(params.pageSize ?? 20));
  const response = await client.get<unknown>(
    `${buildBaseUrl(context)}/reaction/user/${context.userId}/detail?${query.toString()}`,
    { operation: 'getReactionDetail' }
  );
  const data = requireResponseDataRecord(response, 'getReactionDetail');
  const reactionUsers = Array.isArray(data.reactionUserList)
    ? data.reactionUserList
        .map(item => {
          if (!isRecord(item) || typeof item.userId !== 'string') {
            return null;
          }
          return {
            userId: item.userId,
            user: toUserInfo(item.userId),
            createdAt: typeof item.createdAt === 'string' ? item.createdAt : undefined,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)
    : [];
  const fallbackReactionUsers = Array.isArray(data.userList)
    ? data.userList
        .filter((userId): userId is string => typeof userId === 'string')
        .map(userId => ({
          userId,
          user: toUserInfo(userId),
        }))
    : [];
  const normalizedReactionUsers =
    reactionUsers.length > 0 ? reactionUsers : fallbackReactionUsers;
  return {
    reaction: typeof data.reaction === 'string' ? data.reaction : params.reaction,
    count: typeof data.count === 'number' ? data.count : normalizedReactionUsers.length,
    isAddedBySelf: data.state === true,
    reactionUsers: normalizedReactionUsers,
    cursor: normalizeCursor(data.cursor),
    hasMore: normalizeCursor(data.cursor).length > 0,
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : undefined,
  };
};

export const requestGetSupportedTranslationLanguages = async (
  client: RestClient,
  context: RestContext
): Promise<ReadonlyArray<TranslationLanguage>> => {
  const response = await client.get<unknown>(
    `${buildBaseUrl(context)}/users/${context.userId}/translate/support/language`,
    { operation: 'getSupportedTranslationLanguages' }
  );
  const list = requireResponseArrayOrDataArray(response, 'getSupportedTranslationLanguages');
  return list
    .map(item => {
      if (!isRecord(item) || typeof item.code !== 'string') {
        return null;
      }
      return {
        code: item.code,
        name: typeof item.name === 'string' ? item.name : item.code,
        nativeName: typeof item.nativeName === 'string' ? item.nativeName : item.code,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
};

export const requestTranslateMessage = async (
  client: RestClient,
  context: RestContext,
  params: { text: string; targetLanguages: ReadonlyArray<string> }
): Promise<MessageTranslationResult> => {
  const response = await client.post<unknown>(
    `${buildBaseUrl(context)}/users/${context.userId}/translate`,
    {
      text: params.text,
      to: [...params.targetLanguages],
    },
    { operation: 'translateMessage' }
  );
  const resultList = requireResponseArrayOrDataArray(response, 'translateMessage');
  const first = isRecord(resultList[0]) ? resultList[0] : null;
  if (!first) {
    throw createRestBusinessError({
      apiName: 'translateMessage',
      message: 'translateMessage response data is invalid',
      mapped: false,
    });
  }
  const translations = Array.isArray(first.translations) ? first.translations : [];
  const detectedLanguage = isRecord(first.detectedLanguage) ? first.detectedLanguage : undefined;
  return {
    detectedLanguage:
      detectedLanguage && typeof detectedLanguage.language === 'string'
        ? {
            language: detectedLanguage.language,
            score:
              typeof detectedLanguage.score === 'number'
                ? detectedLanguage.score
                : Number(detectedLanguage.score ?? 0),
          }
        : undefined,
    translations: translations
      .map(item => {
        if (!isRecord(item) || typeof item.text !== 'string' || typeof item.to !== 'string') {
          return null;
        }
        return {
          text: item.text,
          to: item.to,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null),
  };
};


// ─── 服务端消息搜索 ───────────────────────────────────────────────

// SDK → 服务端消息类型映射
const SEARCH_CONTENT_TYPE_MAP: Record<string, string> = {
  txt: 'text',
  img: 'image',
  video: 'video',
  file: 'file',
  loc: 'location',
  custom: 'custom',
};

// 服务端 → SDK 消息类型映射
const SEARCH_MESSAGE_TYPE_MAP: Record<string, string> = {
  text: 'txt',
  image: 'img',
  video: 'video',
  file: 'file',
  location: 'loc',
  custom: 'custom',
};

// 会话类型映射
const SEARCH_CHAT_TYPE_MAP: Record<string, string> = {
  chat: 'singleChat',
  chatroom: 'chatRoom',
  groupchat: 'groupChat',
  singleChat: 'singleChat',
  chatRoom: 'chatRoom',
  groupChat: 'groupChat',
};

// 构建附件访问 URL，复用公共 appendAttachUrlParams
const buildAttachUrl = (
  context: RestContext,
  remotePath: string | undefined,
  secretKey: string | undefined
): string => {
  if (!remotePath) return '';
  if (remotePath.includes('em-redirect')) return remotePath;
  const { orgName, appName } = parseAppKey(context.appKey);
  const chatfilesIdx = remotePath.indexOf('/chatfiles/');
  const path = chatfilesIdx >= 0 ? remotePath.slice(chatfilesIdx) : remotePath;
  const baseUrl = `${context.restBaseUrl}/${orgName}/${appName}${path}`;
  return appendAttachUrlParams(baseUrl, secretKey);
};

// 扁平化 highlight 字段
const flattenHighlight = (highlight: unknown): string[] | undefined => {
  if (!highlight || typeof highlight !== 'object') return undefined;
  if (Array.isArray(highlight)) return highlight as string[];
  const values = Object.values(highlight as Record<string, unknown>);
  const result: string[] = [];
  for (const v of values) {
    if (Array.isArray(v)) result.push(...(v as string[]));
  }
  return result.length > 0 ? result : undefined;
};

// 获取搜索结果的 conversationId
const getSearchConversationId = (
  userId: string,
  item: Record<string, unknown>
): string => {
  const chatType = String(item.conversationType ?? '');
  if (chatType === 'groupchat' || chatType === 'chatroom') {
    return String(item.receiverId ?? '');
  }
  // 单聊：如果自己是发送方，conversationId 是对方；否则是发送方
  return String(item.senderId ?? '') === userId
    ? String(item.receiverId ?? '')
    : String(item.senderId ?? '');
};

// 将服务端搜索结果单条消息映射为 SDK Message
const normalizeSearchMessage = (
  context: RestContext,
  userId: string,
  item: Record<string, unknown>
): SearchResultMessage | null => {
  const serverType = String(item.contentType ?? item.type ?? '');
  const sdkType = SEARCH_MESSAGE_TYPE_MAP[serverType];
  if (!sdkType) return null;

  const content = isRecord(item.content) ? item.content : {};
  const conversationId = getSearchConversationId(userId, item);
  const chatType = SEARCH_CHAT_TYPE_MAP[String(item.conversationType ?? '')] ?? 'singleChat';

  const base: Partial<SearchResultMessage> = {
    msgServerId: String(item.messageId ?? ''),
    msgLocalId: String(item.messageId ?? ''),
    from: String(item.senderId ?? ''),
    to: String(item.receiverId ?? ''),
    conversationId,
    conversationType: chatType as Message['conversationType'],
    type: sdkType as Message['type'],
    ext: isRecord(item.ext) ? (item.ext as Record<string, unknown>) : {},
    timestamp: typeof item.sentTime === 'number' ? item.sentTime : new Date(String(item.sentTime ?? '')).getTime(),
    sender: { userId: String(item.senderId ?? '') },
    highlight: flattenHighlight(item.highlight),
    text: typeof item.text === 'string' ? item.text : undefined,
  };

  let body: MessageBody;
  const remotePath = String(content.remotePath ?? content.url ?? '');
  const secretKey = String(content.secret ?? content.secretKey ?? '');

  switch (sdkType) {
    case 'txt':
      body = {
        type: 'txt',
        content: String(content.message ?? item.text ?? ''),
      } as MessageBody;
      break;
    case 'img': {
      const imgUrl = buildAttachUrl(context, remotePath, secretKey);
      const thumb = content.thumb
        ? buildAttachUrl(context, String(content.thumb), String(content.thumb_secret ?? content.thumbnailSecretKey ?? ''))
        : `${imgUrl}&thumbnail=true`;
      body = {
        type: 'img',
        url: imgUrl,
        thumb,
        secret: secretKey,
        width: Number(content.width ?? (isRecord(content.size) ? content.size.width : 0)) || 0,
        height: Number(content.height ?? (isRecord(content.size) ? content.size.height : 0)) || 0,
        fileLength: Number(content.file_length ?? content.fileLength ?? 0),
      } as MessageBody;
      break;
    }
    case 'video': {
      const videoUrl = buildAttachUrl(context, remotePath, secretKey);
      const videoThumb = content.thumb || content.thumbnailRemotePath
        ? buildAttachUrl(context, String(content.thumb ?? content.thumbnailRemotePath ?? ''), String(content.thumb_secret ?? content.thumbnailSecretKey ?? ''))
        : '';
      body = {
        type: 'video',
        url: videoUrl,
        thumb: videoThumb,
        secret: secretKey,
        filename: String(content.filename ?? content.displayName ?? ''),
        duration: Number(content.length ?? content.duration ?? 0),
        fileLength: Number(content.file_length ?? content.fileLength ?? 0),
      } as MessageBody;
      break;
    }
    case 'file': {
      const fileUrl = buildAttachUrl(context, remotePath, secretKey);
      body = {
        type: 'file',
        url: fileUrl,
        secret: secretKey,
        filename: String(content.filename ?? content.displayName ?? ''),
        fileLength: Number(content.file_length ?? content.fileLength ?? 0),
      } as MessageBody;
      break;
    }
    case 'loc':
      body = {
        type: 'loc',
        latitude: Number(content.lat ?? content.latitude ?? 0),
        longitude: Number(content.lng ?? content.longitude ?? 0),
        address: String(content.addr ?? content.address ?? ''),
        buildingName: String(content.buildingName ?? ''),
      } as MessageBody;
      break;
    case 'custom':
      body = {
        type: 'custom',
        customEvent: String(content.customEvent ?? ''),
        customExts: isRecord(content.customExts) ? (content.customExts as Record<string, string>) : {},
      } as MessageBody;
      break;
    default:
      return null;
  }

  return { ...base, body } as SearchResultMessage;
};

// 构建搜索请求体
const buildSearchRequestBody = (params: SearchMessagesParams, currentUserId: string): Record<string, unknown> => {
  const { option, pageNum = 1, pageSize = 20 } = params;
  // trim 并过滤空关键词
  const keywords = option.keywordList.map(k => k.trim()).filter(k => k.length > 0);

  const data: Record<string, unknown> = {
    searchMode: 'default',
    highlightEnable: true,
    page: pageNum,
    size: pageSize,
  };

  // 单关键词 vs 多关键词
  if (keywords.length === 1) {
    data.keyword = keywords[0];
  } else {
    data.keywords = keywords;
    data.keywordMatch = option.keywordListMatchType === 'and' ? 'all' : 'any';
  }

  if (option.conversationId) {
    if (option.conversationType === 'singleChat') {
      data.participantPairs = [{ userId1: currentUserId, userId2: option.conversationId }];
    } else if (option.conversationType === 'groupChat') {
      data.groupIds = [option.conversationId];
    } else if (option.conversationType === 'chatRoom') {
      data.chatroomIds = [option.conversationId];
    }
  }
  if (option.msgTypes && option.msgTypes.length > 0) {
    data.contentType = option.msgTypes.map(t => SEARCH_CONTENT_TYPE_MAP[t] ?? t).join(',');
  }
  if (option.startTime !== undefined) {
    data.startTime = option.startTime;
  }
  if (option.endTime !== undefined) {
    data.endTime = option.endTime;
  }
  if (option.searchScope) {
    data.searchExt = option.searchScope;
  }
  if (option.direction) {
    data.sort = option.direction === 'up' ? 'sentTime:asc' : 'sentTime:desc';
  }

  return { data };
};

export const requestSearchMessages = async (
  client: RestClient,
  context: RestContext,
  params: SearchMessagesParams
): Promise<SearchMessagesResult> => {
  const endpoint = `${buildBaseUrl(context)}/users/${context.userId}/messages/search/get`;
  const body = buildSearchRequestBody(params, context.userId);
  const response = await client.post<unknown>(endpoint, body, { operation: 'searchMessages' });

  // 解析响应
  const raw = isRecord(response) ? response : {};
  const responseData = isRecord(raw.data) ? raw.data : raw;
  const dataInner = isRecord(responseData.data) ? responseData.data : responseData;

  // 获取消息列表（支持 items 和 list 双字段）
  const items = Array.isArray(dataInner.items)
    ? dataInner.items
    : Array.isArray(dataInner.list)
      ? dataInner.list
      : [];

  // 获取分页信息（支持 pagination 子对象或顶层）
  const pagination = isRecord(dataInner.pagination) ? dataInner.pagination : dataInner;

  const pageNum = Number(pagination.pageNum ?? pagination.page ?? params.pageNum ?? 1);
  const pageSize = Number(pagination.pageSize ?? pagination.size ?? params.pageSize ?? 20);
  const totalPages = Number(pagination.totalPages ?? 0);
  const isLast = pagination.isFinished === 1 || pageNum >= totalPages;

  // 逐条转换消息
  const messages: SearchResultMessage[] = [];
  for (const entry of items) {
    if (!isRecord(entry)) continue;
    const msg = normalizeSearchMessage(context, context.userId, entry);
    if (msg) messages.push(msg);
  }

  return { messages, pageNum, pageSize, totalPages, isLast };
};
