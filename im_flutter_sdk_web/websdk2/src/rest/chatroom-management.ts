import { parseAppKey } from '../upload/utils';
import { ERROR_CODES } from '../utils/error-codes';
import { ValidationError } from '../utils/errors';
import type { RestContext } from '../types/chat-client';
import type { RestClient } from './client';
import type {
  ChatRoomAdminParams,
  ChatRoomAnnouncement,
  ChatRoomAnnouncementUpdateParams,
  ChatRoomAttributeMutationResult,
  ChatRoomAttributesSnapshot,
  ChatRoomBlocklistEntry,
  ChatRoomBlocklistParams,
  ChatRoomDetail,
  ChatRoomListResult,
  ChatRoomMemberActionListResult,
  ChatRoomMemberListParams,
  ChatRoomMemberListResult,
  ChatRoomMuteEntry,
  ChatRoomMuteListParams,
  ChatRoomMuteMembersParams,
  ChatRoomMuteStatus,
  ChatRoomMutationTarget,
  ChatRoomSharedFileListParams,
  ChatRoomSharedFileListResult,
  ChatRoomUpdateResult,
  ChatRoomUserBatchParams,
  DeleteChatRoomSharedFileParams,
  GetChatRoomAttributesParams,
  GetChatRoomInfoParams,
  GetChatRoomListParams,
  JoinChatRoomParams,
  RemoveChatRoomAttributesParams,
  SetChatRoomAttributesParams,
  UpdateChatRoomInfoParams,
} from '../types/chatroom';
import type { UserInfo } from '../types/user-info';
import {
  normalizeChatRoomAdminUsers,
  normalizeChatRoomAllowlistEntries,
  normalizeChatRoomAnnouncement,
  normalizeChatRoomAttributeMutationResult,
  normalizeChatRoomAttributesSnapshot,
  normalizeChatRoomBlocklistEntries,
  normalizeChatRoomBooleanStatus,
  normalizeChatRoomDetail,
  normalizeChatRoomListResult,
  normalizeChatRoomMemberActionListResult,
  normalizeChatRoomMemberListResult,
  normalizeChatRoomMuteEntries,
  normalizeChatRoomMuteStatus,
  normalizeChatRoomSharedFileListResult,
  normalizeChatRoomUpdateResult,
} from '../managers/chatroom/chatroom-normalizers';

interface EndpointContext {
  readonly orgName: string;
  readonly appName: string;
  readonly encodedUserId: string;
  readonly encodedResource: string;
}

const buildEndpointContext = (context: RestContext): EndpointContext => {
  const { orgName, appName } = parseAppKey(context.appKey);
  return {
    orgName,
    appName,
    encodedUserId: encodeURIComponent(context.userId),
    encodedResource: encodeURIComponent(context.clientResource),
  };
};

const buildRequiredStringError = (path: string): ValidationError => {
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

const buildInvalidFormatError = (path: string, message: string): ValidationError => {
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

const buildChatRoomPath = (context: EndpointContext, suffix: string): string => {
  return `/${context.orgName}/${context.appName}${suffix}`;
};

const normalizeOptionalString = (value: unknown, path: string): string | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw buildInvalidFormatError(path, `${path} must be a string`);
  }
  return value;
};

const normalizeNumber = (value: unknown, path: string): number | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw buildInvalidFormatError(path, `${path} must be a number`);
  }
  return value;
};

const normalizeBoolean = (value: unknown, path: string): boolean | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'boolean') {
    throw buildInvalidFormatError(path, `${path} must be a boolean`);
  }
  return value;
};

const buildPageQuery = (
  params?: {
    readonly pageNum?: number;
    readonly pageSize?: number;
  },
  extras?: Readonly<Record<string, string | undefined>>
): string => {
  const query = new URLSearchParams();
  if (typeof params?.pageNum === 'number') {
    query.set('pagenum', String(params.pageNum));
  }
  if (typeof params?.pageSize === 'number') {
    query.set('pagesize', String(params.pageSize));
  }
  if (extras) {
    Object.entries(extras).forEach(([key, value]) => {
      if (typeof value === 'string' && value.length > 0) {
        query.set(key, value);
      }
    });
  }
  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
};

const buildCursorQuery = (
  params?: {
    readonly pageSize?: number;
    readonly cursor?: string;
  }
): string => {
  const query = new URLSearchParams();
  if (typeof params?.pageSize === 'number') {
    query.set('pagesize', String(params.pageSize));
  }
  if (typeof params?.cursor === 'string' && params.cursor.length > 0) {
    query.set('cursor', params.cursor);
  }
  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
};

export const normalizeChatRoomId = (chatRoomId: string, path: string): string => {
  if (typeof chatRoomId !== 'string' || chatRoomId.trim().length === 0) {
    throw buildRequiredStringError(path);
  }
  return chatRoomId.trim();
};

export const normalizeChatRoomUserIds = (
  userIds: ReadonlyArray<string>,
  path: string
): ReadonlyArray<string> => {
  if (!Array.isArray(userIds) || userIds.length === 0) {
    throw buildRequiredStringError(path);
  }

  const result: string[] = [];
  const seen = new Set<string>();
  userIds.forEach((item, index) => {
    if (typeof item !== 'string') {
      throw buildInvalidFormatError(`${path}[${index}]`, `${path}[${index}] must be a string`);
    }
    const normalized = item.trim();
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    result.push(normalized);
  });

  if (result.length === 0) {
    throw buildRequiredStringError(path);
  }

  return result;
};

const normalizeAttributeKeys = (
  keys: ReadonlyArray<string>,
  path: string
): ReadonlyArray<string> => {
  return normalizeChatRoomUserIds(keys, path);
};

const normalizeAttributesMap = (
  attributes: Readonly<Record<string, string>>,
  path: string
): Readonly<Record<string, string>> => {
  if (!attributes || typeof attributes !== 'object' || Array.isArray(attributes)) {
    throw buildInvalidFormatError(path, `${path} must be an object`);
  }

  const entries = Object.entries(attributes);
  if (entries.length === 0) {
    throw buildRequiredStringError(path);
  }

  return Object.fromEntries(
    entries.map(([key, value]) => {
      if (typeof key !== 'string' || key.trim().length === 0) {
        throw buildInvalidFormatError(path, `${path} contains invalid key`);
      }
      if (typeof value !== 'string') {
        throw buildInvalidFormatError(`${path}.${key}`, `${path}.${key} must be a string`);
      }
      return [key, value] as const;
    })
  );
};

export const requestGetChatRoomList = async (
  client: RestClient,
  context: RestContext,
  params: GetChatRoomListParams = {}
): Promise<ChatRoomListResult> => {
  const endpointContext = buildEndpointContext(context);
  const endpoint = buildChatRoomPath(endpointContext, `/chatrooms${buildPageQuery(params)}`);
  const response = await client.get<unknown>(endpoint, {
    operation: 'getChatRoomList',
  });
  return normalizeChatRoomListResult(response);
};

export const requestGetChatRoomInfo = async (
  client: RestClient,
  context: RestContext,
  params: GetChatRoomInfoParams
): Promise<ChatRoomDetail> => {
  const endpointContext = buildEndpointContext(context);
  const chatRoomId = normalizeChatRoomId(params.chatRoomId, 'params.chatRoomId');
  const endpoint = buildChatRoomPath(
    endpointContext,
    `/chatrooms/${encodeURIComponent(chatRoomId)}?joined_time=true`
  );
  const response = await client.get<unknown>(endpoint, {
    operation: 'getChatRoomInfo',
  });
  return normalizeChatRoomDetail(response, context.userId);
};

export const requestUpdateChatRoomInfo = async (
  client: RestClient,
  context: RestContext,
  params: UpdateChatRoomInfoParams
): Promise<ChatRoomUpdateResult> => {
  const endpointContext = buildEndpointContext(context);
  const chatRoomId = normalizeChatRoomId(params.chatRoomId, 'params.chatRoomId');
  const requestBody: Record<string, unknown> = {};
  const name = normalizeOptionalString(params.name, 'params.name');
  const description = normalizeOptionalString(params.description, 'params.description');
  const maxMembers = normalizeNumber(params.maxMembers, 'params.maxMembers');

  if (name !== undefined) {
    requestBody.groupname = name;
  }
  if (description !== undefined) {
    requestBody.description = description;
  }
  if (maxMembers !== undefined) {
    requestBody.maxusers = maxMembers;
  }
  if (Object.keys(requestBody).length === 0) {
    throw buildRequiredStringError('params');
  }

  const endpoint = buildChatRoomPath(
    endpointContext,
    `/chatrooms/${encodeURIComponent(chatRoomId)}?resource=${endpointContext.encodedResource}`
  );
  const response = await client.put<unknown>(endpoint, requestBody, {
    operation: 'updateChatRoomInfo',
  });
  return normalizeChatRoomUpdateResult(response);
};

export const requestDestroyChatRoom = async (
  client: RestClient,
  context: RestContext,
  params: ChatRoomMutationTarget
): Promise<void> => {
  const endpointContext = buildEndpointContext(context);
  const chatRoomId = normalizeChatRoomId(params.chatRoomId, 'params.chatRoomId');
  const endpoint = buildChatRoomPath(
    endpointContext,
    `/chatrooms/${encodeURIComponent(chatRoomId)}?resource=${endpointContext.encodedResource}&version=v3`
  );
  await client.delete(endpoint, {
    operation: 'destroyChatRoom',
  });
};

export const requestJoinChatRoom = async (
  client: RestClient,
  context: RestContext,
  params: JoinChatRoomParams
): Promise<void> => {
  const endpointContext = buildEndpointContext(context);
  const chatRoomId = normalizeChatRoomId(params.chatRoomId, 'params.chatRoomId');
  const ext = normalizeOptionalString(params.ext, 'params.ext');
  const leaveOtherRooms = normalizeBoolean(params.leaveOtherRooms, 'params.leaveOtherRooms');
  const endpoint = buildChatRoomPath(
    endpointContext,
    `/chatrooms/${encodeURIComponent(chatRoomId)}/users/${endpointContext.encodedUserId}?resource=${endpointContext.encodedResource}`
  );
  await client.post(
    endpoint,
    {
      ext,
      leaveOtherRooms,
    },
    {
      operation: 'joinChatRoom',
    }
  );
};

export const requestLeaveChatRoom = async (
  client: RestClient,
  context: RestContext,
  params: ChatRoomMutationTarget
): Promise<void> => {
  const endpointContext = buildEndpointContext(context);
  const chatRoomId = normalizeChatRoomId(params.chatRoomId, 'params.chatRoomId');
  const endpoint = buildChatRoomPath(
    endpointContext,
    `/chatrooms/${encodeURIComponent(chatRoomId)}/users/${endpointContext.encodedUserId}?resource=${endpointContext.encodedResource}`
  );
  await client.delete(endpoint, {
    operation: 'leaveChatRoom',
  });
};

export const requestGetChatRoomMemberList = async (
  client: RestClient,
  context: RestContext,
  params: ChatRoomMemberListParams
): Promise<ChatRoomMemberListResult> => {
  const endpointContext = buildEndpointContext(context);
  const chatRoomId = normalizeChatRoomId(params.chatRoomId, 'params.chatRoomId');
  const endpoint = buildChatRoomPath(
    endpointContext,
    `/chatrooms/${encodeURIComponent(chatRoomId)}/users${buildCursorQuery(params)}`
  );
  const response = await client.get<unknown>(endpoint, {
    operation: 'getChatRoomMemberList',
  });
  return normalizeChatRoomMemberListResult(response);
};

export const requestAddChatRoomMembers = async (
  client: RestClient,
  context: RestContext,
  params: ChatRoomUserBatchParams
): Promise<ChatRoomMemberActionListResult> => {
  const endpointContext = buildEndpointContext(context);
  const chatRoomId = normalizeChatRoomId(params.chatRoomId, 'params.chatRoomId');
  const userIds = normalizeChatRoomUserIds(params.userIds, 'params.userIds');
  const endpoint = buildChatRoomPath(
    endpointContext,
    `/chatrooms/${encodeURIComponent(chatRoomId)}/users?resource=${endpointContext.encodedResource}`
  );
  const response = await client.post<unknown>(
    endpoint,
    {
      usernames: userIds,
    },
    {
      operation: 'addChatRoomMembers',
    }
  );
  return normalizeChatRoomMemberActionListResult(response);
};

export const requestRemoveChatRoomMembers = async (
  client: RestClient,
  context: RestContext,
  params: ChatRoomUserBatchParams
): Promise<ChatRoomMemberActionListResult> => {
  const endpointContext = buildEndpointContext(context);
  const chatRoomId = normalizeChatRoomId(params.chatRoomId, 'params.chatRoomId');
  const userIds = normalizeChatRoomUserIds(params.userIds, 'params.userIds');
  const endpoint = buildChatRoomPath(
    endpointContext,
    `/chatrooms/${encodeURIComponent(chatRoomId)}/users/${userIds
      .map(item => encodeURIComponent(item))
      .join(',')}?resource=${endpointContext.encodedResource}`
  );
  const response = await client.delete<unknown>(endpoint, {
    operation: 'removeChatRoomMembers',
  });
  return normalizeChatRoomMemberActionListResult(response);
};

export const requestGetChatRoomAdminList = async (
  client: RestClient,
  context: RestContext,
  params: ChatRoomMutationTarget
): Promise<ReadonlyArray<UserInfo>> => {
  const endpointContext = buildEndpointContext(context);
  const chatRoomId = normalizeChatRoomId(params.chatRoomId, 'params.chatRoomId');
  const endpoint = buildChatRoomPath(
    endpointContext,
    `/chatrooms/${encodeURIComponent(chatRoomId)}/admin`
  );
  const response = await client.get<unknown>(endpoint, {
    operation: 'getChatRoomAdminList',
  });
  return normalizeChatRoomAdminUsers(response);
};

export const requestSetChatRoomAdmin = async (
  client: RestClient,
  context: RestContext,
  params: ChatRoomAdminParams
): Promise<void> => {
  const endpointContext = buildEndpointContext(context);
  const chatRoomId = normalizeChatRoomId(params.chatRoomId, 'params.chatRoomId');
  const userId = normalizeChatRoomId(params.userId, 'params.userId');
  const endpoint = buildChatRoomPath(
    endpointContext,
    `/chatrooms/${encodeURIComponent(chatRoomId)}/admin?resource=${endpointContext.encodedResource}`
  );
  await client.post(
    endpoint,
    {
      newadmin: userId,
    },
    {
      operation: 'setChatRoomAdmin',
    }
  );
};

export const requestRemoveChatRoomAdmin = async (
  client: RestClient,
  context: RestContext,
  params: ChatRoomAdminParams
): Promise<void> => {
  const endpointContext = buildEndpointContext(context);
  const chatRoomId = normalizeChatRoomId(params.chatRoomId, 'params.chatRoomId');
  const userId = normalizeChatRoomId(params.userId, 'params.userId');
  const endpoint = buildChatRoomPath(
    endpointContext,
    `/chatrooms/${encodeURIComponent(chatRoomId)}/admin/${encodeURIComponent(
      userId
    )}?resource=${endpointContext.encodedResource}`
  );
  await client.delete(endpoint, {
    operation: 'removeChatRoomAdmin',
  });
};

export const requestGetChatRoomMuteList = async (
  client: RestClient,
  context: RestContext,
  params: ChatRoomMuteListParams
): Promise<ReadonlyArray<ChatRoomMuteEntry>> => {
  const endpointContext = buildEndpointContext(context);
  const chatRoomId = normalizeChatRoomId(params.chatRoomId, 'params.chatRoomId');
  const query = new URLSearchParams();
  query.set('version', 'v3');
  if (typeof params.pageNum === 'number') {
    query.set('pagenum', String(params.pageNum));
  }
  if (typeof params.pageSize === 'number') {
    query.set('pagesize', String(params.pageSize));
  }
  const endpoint = buildChatRoomPath(
    endpointContext,
    `/chatrooms/${encodeURIComponent(chatRoomId)}/mute?${query.toString()}`
  );
  const response = await client.get<unknown>(endpoint, {
    operation: 'getChatRoomMuteList',
  });
  return normalizeChatRoomMuteEntries(response);
};

export const requestMuteChatRoomMembers = async (
  client: RestClient,
  context: RestContext,
  params: ChatRoomMuteMembersParams
): Promise<void> => {
  const endpointContext = buildEndpointContext(context);
  const chatRoomId = normalizeChatRoomId(params.chatRoomId, 'params.chatRoomId');
  const userIds = normalizeChatRoomUserIds(params.userIds, 'params.userIds');
  const duration = normalizeNumber(params.duration, 'params.duration');
  const endpoint = buildChatRoomPath(
    endpointContext,
    `/chatrooms/${encodeURIComponent(chatRoomId)}/mute?resource=${endpointContext.encodedResource}`
  );
  await client.post(
    endpoint,
    {
      usernames: userIds,
      mute_duration: duration,
    },
    {
      operation: 'muteChatRoomMembers',
    }
  );
};

export const requestUnmuteChatRoomMembers = async (
  client: RestClient,
  context: RestContext,
  params: ChatRoomUserBatchParams
): Promise<void> => {
  const endpointContext = buildEndpointContext(context);
  const chatRoomId = normalizeChatRoomId(params.chatRoomId, 'params.chatRoomId');
  const userIds = normalizeChatRoomUserIds(params.userIds, 'params.userIds');
  const endpoint = buildChatRoomPath(
    endpointContext,
    `/chatrooms/${encodeURIComponent(chatRoomId)}/mute/${userIds
      .map(item => encodeURIComponent(item))
      .join(',')}?resource=${endpointContext.encodedResource}`
  );
  await client.delete(endpoint, {
    operation: 'unmuteChatRoomMembers',
  });
};

export const requestMuteAllChatRoomMembers = async (
  client: RestClient,
  context: RestContext,
  params: ChatRoomMutationTarget
): Promise<void> => {
  const endpointContext = buildEndpointContext(context);
  const chatRoomId = normalizeChatRoomId(params.chatRoomId, 'params.chatRoomId');
  const endpoint = buildChatRoomPath(
    endpointContext,
    `/chatrooms/${encodeURIComponent(chatRoomId)}/ban?resource=${endpointContext.encodedResource}`
  );
  await client.post(endpoint, undefined, {
    operation: 'muteAllChatRoomMembers',
  });
};

export const requestUnmuteAllChatRoomMembers = async (
  client: RestClient,
  context: RestContext,
  params: ChatRoomMutationTarget
): Promise<void> => {
  const endpointContext = buildEndpointContext(context);
  const chatRoomId = normalizeChatRoomId(params.chatRoomId, 'params.chatRoomId');
  const endpoint = buildChatRoomPath(
    endpointContext,
    `/chatrooms/${encodeURIComponent(chatRoomId)}/ban?resource=${endpointContext.encodedResource}`
  );
  await client.delete(endpoint, {
    operation: 'unmuteAllChatRoomMembers',
  });
};

export const requestCheckIfInChatRoomMuteList = async (
  client: RestClient,
  context: RestContext,
  params: ChatRoomMutationTarget
): Promise<ChatRoomMuteStatus> => {
  const endpointContext = buildEndpointContext(context);
  const chatRoomId = normalizeChatRoomId(params.chatRoomId, 'params.chatRoomId');
  const endpoint = buildChatRoomPath(
    endpointContext,
    `/chatrooms/${encodeURIComponent(chatRoomId)}/mute/${endpointContext.encodedUserId}`
  );
  const response = await client.get<unknown>(endpoint, {
    operation: 'checkIfInChatRoomMuteList',
  });
  return normalizeChatRoomMuteStatus(response);
};

export const requestGetChatRoomBlocklist = async (
  client: RestClient,
  context: RestContext,
  params: ChatRoomBlocklistParams
): Promise<ReadonlyArray<ChatRoomBlocklistEntry>> => {
  const endpointContext = buildEndpointContext(context);
  const chatRoomId = normalizeChatRoomId(params.chatRoomId, 'params.chatRoomId');
  const pageQuery = buildPageQuery(params);
  const separator = pageQuery ? '&' : '';
  const endpoint = buildChatRoomPath(
    endpointContext,
    `/chatrooms/${encodeURIComponent(chatRoomId)}/blocks/users?version=v3${separator}${pageQuery.replace('?', '')}`
  );
  const response = await client.get<unknown>(endpoint, {
    operation: 'getChatRoomBlocklist',
  });
  return normalizeChatRoomBlocklistEntries(response);
};

export const requestBlockChatRoomMembers = async (
  client: RestClient,
  context: RestContext,
  params: ChatRoomUserBatchParams
): Promise<ChatRoomMemberActionListResult> => {
  const endpointContext = buildEndpointContext(context);
  const chatRoomId = normalizeChatRoomId(params.chatRoomId, 'params.chatRoomId');
  const userIds = normalizeChatRoomUserIds(params.userIds, 'params.userIds');
  const isSingle = userIds.length === 1;
  const endpoint = buildChatRoomPath(
    endpointContext,
    isSingle
      ? `/chatrooms/${encodeURIComponent(chatRoomId)}/blocks/users/${encodeURIComponent(
          userIds[0] ?? ''
        )}?resource=${endpointContext.encodedResource}`
      : `/chatrooms/${encodeURIComponent(chatRoomId)}/blocks/users?resource=${endpointContext.encodedResource}`
  );
  const response = await client.post<unknown>(
    endpoint,
    isSingle
      ? undefined
      : {
          usernames: userIds,
        },
    {
      operation: 'blockChatRoomMembers',
    }
  );
  return normalizeChatRoomMemberActionListResult(response);
};

export const requestUnblockChatRoomMembers = async (
  client: RestClient,
  context: RestContext,
  params: ChatRoomUserBatchParams
): Promise<ChatRoomMemberActionListResult> => {
  const endpointContext = buildEndpointContext(context);
  const chatRoomId = normalizeChatRoomId(params.chatRoomId, 'params.chatRoomId');
  const userIds = normalizeChatRoomUserIds(params.userIds, 'params.userIds');
  const endpoint = buildChatRoomPath(
    endpointContext,
    `/chatrooms/${encodeURIComponent(chatRoomId)}/blocks/users/${userIds
      .map(item => encodeURIComponent(item))
      .join(',')}?resource=${endpointContext.encodedResource}`
  );
  const response = await client.delete<unknown>(endpoint, {
    operation: 'unblockChatRoomMembers',
  });
  return normalizeChatRoomMemberActionListResult(response);
};

export const requestGetChatRoomAllowlist = async (
  client: RestClient,
  context: RestContext,
  params: ChatRoomMutationTarget
): Promise<ReadonlyArray<{ readonly user: UserInfo }>> => {
  const endpointContext = buildEndpointContext(context);
  const chatRoomId = normalizeChatRoomId(params.chatRoomId, 'params.chatRoomId');
  const endpoint = buildChatRoomPath(
    endpointContext,
    `/chatrooms/${encodeURIComponent(chatRoomId)}/white/users`
  );
  const response = await client.get<unknown>(endpoint, {
    operation: 'getChatRoomAllowlist',
  });
  return normalizeChatRoomAllowlistEntries(response);
};

export const requestAddUsersToChatRoomAllowlist = async (
  client: RestClient,
  context: RestContext,
  params: ChatRoomUserBatchParams
): Promise<ChatRoomMemberActionListResult> => {
  const endpointContext = buildEndpointContext(context);
  const chatRoomId = normalizeChatRoomId(params.chatRoomId, 'params.chatRoomId');
  const userIds = normalizeChatRoomUserIds(params.userIds, 'params.userIds');
  const endpoint = buildChatRoomPath(
    endpointContext,
    `/chatrooms/${encodeURIComponent(chatRoomId)}/white/users?resource=${endpointContext.encodedResource}`
  );
  const response = await client.post<unknown>(
    endpoint,
    {
      usernames: userIds,
    },
    {
      operation: 'addUsersToChatRoomAllowlist',
    }
  );
  return normalizeChatRoomMemberActionListResult(response);
};

export const requestRemoveUsersFromChatRoomAllowlist = async (
  client: RestClient,
  context: RestContext,
  params: ChatRoomUserBatchParams
): Promise<ChatRoomMemberActionListResult> => {
  const endpointContext = buildEndpointContext(context);
  const chatRoomId = normalizeChatRoomId(params.chatRoomId, 'params.chatRoomId');
  const userIds = normalizeChatRoomUserIds(params.userIds, 'params.userIds');
  const endpoint = buildChatRoomPath(
    endpointContext,
    `/chatrooms/${encodeURIComponent(chatRoomId)}/white/users/${userIds
      .map(item => encodeURIComponent(item))
      .join(',')}?resource=${endpointContext.encodedResource}`
  );
  const response = await client.delete<unknown>(endpoint, {
    operation: 'removeUsersFromChatRoomAllowlist',
  });
  return normalizeChatRoomMemberActionListResult(response);
};

export const requestCheckIfInChatRoomAllowList = async (
  client: RestClient,
  context: RestContext,
  params: ChatRoomMutationTarget
): Promise<boolean> => {
  const endpointContext = buildEndpointContext(context);
  const chatRoomId = normalizeChatRoomId(params.chatRoomId, 'params.chatRoomId');
  const endpoint = buildChatRoomPath(
    endpointContext,
    `/chatrooms/${encodeURIComponent(chatRoomId)}/white/users/${endpointContext.encodedUserId}?version=v3`
  );
  const response = await client.get<unknown>(endpoint, {
    operation: 'checkIfInChatRoomAllowList',
  });
  return normalizeChatRoomBooleanStatus(response);
};

export const requestGetChatRoomAnnouncement = async (
  client: RestClient,
  context: RestContext,
  params: ChatRoomMutationTarget
): Promise<ChatRoomAnnouncement> => {
  const endpointContext = buildEndpointContext(context);
  const chatRoomId = normalizeChatRoomId(params.chatRoomId, 'params.chatRoomId');
  const endpoint = buildChatRoomPath(
    endpointContext,
    `/chatrooms/${encodeURIComponent(chatRoomId)}/announcement`
  );
  const response = await client.get<unknown>(endpoint, {
    operation: 'getChatRoomAnnouncement',
  });
  return normalizeChatRoomAnnouncement(response);
};

export const requestUpdateChatRoomAnnouncement = async (
  client: RestClient,
  context: RestContext,
  params: ChatRoomAnnouncementUpdateParams
): Promise<void> => {
  const endpointContext = buildEndpointContext(context);
  const chatRoomId = normalizeChatRoomId(params.chatRoomId, 'params.chatRoomId');
  const announcement = normalizeOptionalString(params.announcement, 'params.announcement');
  if (announcement === undefined) {
    throw buildRequiredStringError('params.announcement');
  }
  const endpoint = buildChatRoomPath(
    endpointContext,
    `/chatrooms/${encodeURIComponent(chatRoomId)}/announcement?resource=${endpointContext.encodedResource}`
  );
  await client.post(
    endpoint,
    {
      announcement,
    },
    {
      operation: 'updateChatRoomAnnouncement',
    }
  );
};

export const requestGetChatRoomSharedFileList = async (
  client: RestClient,
  context: RestContext,
  params: ChatRoomSharedFileListParams
): Promise<ChatRoomSharedFileListResult> => {
  const endpointContext = buildEndpointContext(context);
  const chatRoomId = normalizeChatRoomId(params.chatRoomId, 'params.chatRoomId');
  const endpoint = buildChatRoomPath(
    endpointContext,
    `/chatrooms/${encodeURIComponent(chatRoomId)}/share_files${buildPageQuery(params)}`
  );
  const response = await client.get<unknown>(endpoint, {
    operation: 'getChatRoomSharedFileList',
  });
  return normalizeChatRoomSharedFileListResult(response);
};

export const requestDeleteChatRoomSharedFile = async (
  client: RestClient,
  context: RestContext,
  params: DeleteChatRoomSharedFileParams
): Promise<void> => {
  const endpointContext = buildEndpointContext(context);
  const chatRoomId = normalizeChatRoomId(params.chatRoomId, 'params.chatRoomId');
  const fileId = normalizeChatRoomId(params.fileId, 'params.fileId');
  const endpoint = buildChatRoomPath(
    endpointContext,
    `/chatrooms/${encodeURIComponent(chatRoomId)}/share_files/${encodeURIComponent(
      fileId
    )}?resource=${endpointContext.encodedResource}`
  );
  await client.delete(endpoint, {
    operation: 'deleteChatRoomSharedFile',
  });
};

export const requestGetChatRoomAttributes = async (
  client: RestClient,
  context: RestContext,
  params: GetChatRoomAttributesParams
): Promise<ChatRoomAttributesSnapshot> => {
  const endpointContext = buildEndpointContext(context);
  const chatRoomId = normalizeChatRoomId(params.chatRoomId, 'params.chatRoomId');
  const endpoint = buildChatRoomPath(
    endpointContext,
    `/metadata/chatroom/${encodeURIComponent(chatRoomId)}`
  );
  const response = await client.post<unknown>(
    endpoint,
    {
      keys: params.keys ? normalizeAttributeKeys(params.keys, 'params.keys') : undefined,
    },
    {
      operation: 'getChatRoomAttributes',
    }
  );
  return normalizeChatRoomAttributesSnapshot(response, chatRoomId);
};

export const requestSetChatRoomAttributes = async (
  client: RestClient,
  context: RestContext,
  params: SetChatRoomAttributesParams
): Promise<ChatRoomAttributeMutationResult> => {
  const endpointContext = buildEndpointContext(context);
  const chatRoomId = normalizeChatRoomId(params.chatRoomId, 'params.chatRoomId');
  const attributes = normalizeAttributesMap(params.attributes, 'params.attributes');
  const { autoDelete = true, isForced = false } = params;
  const forcedSegment = isForced ? '/forced' : '';
  const endpoint = buildChatRoomPath(
    endpointContext,
    `/metadata/chatroom/${encodeURIComponent(chatRoomId)}/user/${endpointContext.encodedUserId}${forcedSegment}`
  );
  const response = await client.put<unknown>(
    endpoint,
    {
      metaData: attributes,
      autoDelete: autoDelete ? 'DELETE' : 'NO_DELETE',
    },
    {
      operation: 'setChatRoomAttributes',
    }
  );
  return normalizeChatRoomAttributeMutationResult(response, chatRoomId);
};

export const requestRemoveChatRoomAttributes = async (
  client: RestClient,
  context: RestContext,
  params: RemoveChatRoomAttributesParams
): Promise<ChatRoomAttributeMutationResult> => {
  const endpointContext = buildEndpointContext(context);
  const chatRoomId = normalizeChatRoomId(params.chatRoomId, 'params.chatRoomId');
  const keys = normalizeAttributeKeys(params.keys, 'params.keys');
  const { isForced = false } = params;
  const forcedSegment = isForced ? '/forced' : '';
  const endpoint = buildChatRoomPath(
    endpointContext,
    `/metadata/chatroom/${encodeURIComponent(chatRoomId)}/user/${endpointContext.encodedUserId}${forcedSegment}`
  );
  const response = await client.request<unknown>(endpoint, {
    method: 'DELETE',
    body: {
      keys,
    },
    operation: 'removeChatRoomAttributes',
  });
  return normalizeChatRoomAttributeMutationResult(response, chatRoomId);
};
