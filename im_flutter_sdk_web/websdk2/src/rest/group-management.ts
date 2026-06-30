import { isRecord } from '../cache/cache-utils';
import { normalizeProfileVersionFromTimestamp } from '../core/message/profile-sync/profile-version';
import { parseAppKey } from '../upload/utils';
import { ERROR_CODES } from '../utils/error-codes';
import { ValidationError } from '../utils/errors';
import type { RestClient } from './client';
import type { RestContext } from '../types/chat-client';
import type {
  AcceptGroupJoinRequestParams,
  CreateGroupParams,
  CreateGroupResult,
  DeleteGroupSharedFileParams,
  DownloadGroupSharedFileParams,
  GetGroupInfoListParams,
  GetGroupInfoParams,
  GetGroupMembersAttributesParams,
  GetJoinedGroupListParams,
  GetPublicGroupListParams,
  GroupAdminMutationParams,
  GroupAllowlistEntry,
  GroupAnnouncement,
  GroupAnnouncementUpdateParams,
  GroupBlocklistEntry,
  GroupBlocklistParams,
  GroupDetail,
  GroupListResult,
  GroupMemberListParams,
  GroupMemberListResult,
  GroupMembersAttributesResult,
  GroupMuteEntry,
  GroupMuteListParams,
  GroupMutationTarget,
  GroupOwnerChangeParams,
  CursorPageParams,
  NumberPageParams,
  GroupSharedFileListParams,
  GroupSharedFileListResult,
  GroupUserBatchParams,
  GroupJoinParams,
  GroupMuteMembersParams,
  RejectGroupJoinRequestParams,
  SetGroupMemberAttributesParams,
  UpdateGroupInfoParams,
} from '../types/group';
import type { UserInfo } from '../types/user-info';
import {
  normalizeCreateGroupResult,
  normalizeGroupAdminUsers,
  normalizeGroupAllowlistEntries,
  normalizeGroupAnnouncement,
  normalizeGroupBlocklistEntries,
  normalizeGroupDetail,
  normalizeGroupListResult,
  normalizeGroupMemberListResult,
  normalizeGroupMembersAttributes,
  normalizeGroupMuteEntries,
  normalizeGroupSharedFileListResult,
} from '../managers/group/group-normalizers';

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

export const normalizeGroupUserIds = (
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

export const normalizeGroupId = (groupId: string, path: string): string => {
  if (typeof groupId !== 'string' || groupId.trim().length === 0) {
    throw buildRequiredStringError(path);
  }
  return groupId.trim();
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

const normalizeBoolean = (value: unknown, path: string): boolean | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'boolean') {
    throw buildInvalidFormatError(path, `${path} must be a boolean`);
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

const buildGroupPath = (context: EndpointContext, suffix: string): string => {
  return `/${context.orgName}/${context.appName}${suffix}`;
};

const GROUP_NAMECARD_ATTRIBUTE_KEYS = new Set([
  'groupNamecard',
  'group_namecard',
  'group_name_card',
  'namecard',
  'nameCard',
]);

const resolveSelfGroupNamecardPayload = (
  context: RestContext,
  normalizedUserId: string,
  attributes: Readonly<Record<string, string>>
): { readonly nameCard: string } | null => {
  if (normalizedUserId !== context.userId) {
    return null;
  }

  const entries = Object.entries(attributes);
  if (entries.length === 0) {
    return null;
  }

  let nameCard: string | undefined;
  for (const [key, value] of entries) {
    if (!GROUP_NAMECARD_ATTRIBUTE_KEYS.has(key) || typeof value !== 'string') {
      return null;
    }
    if (nameCard === undefined) {
      nameCard = value;
      continue;
    }
    if (nameCard !== value) {
      return null;
    }
  }

  return nameCard === undefined ? null : { nameCard };
};

const buildCursorQuery = (params?: CursorPageParams): string => {
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

const buildNumberPageQuery = (params?: NumberPageParams): string => {
  const query = new URLSearchParams();
  if (typeof params?.pageNum === 'number') {
    query.set('pagenum', String(params.pageNum));
  }
  if (typeof params?.pageSize === 'number') {
    query.set('pagesize', String(params.pageSize));
  }
  const serialized = query.toString();
  return serialized ? `?${serialized}` : '';
};

export const requestCreateGroup = async (
  client: RestClient,
  context: RestContext,
  params: CreateGroupParams
): Promise<CreateGroupResult> => {
  const endpointContext = buildEndpointContext(context);
  const endpoint = buildGroupPath(
    endpointContext,
    `/chatgroups?resource=${endpointContext.encodedResource}`
  );
  const response = await client.post<unknown>(
    endpoint,
    {
      owner: context.userId,
      groupname: params.name,
      desc: params.description,
      members: params.memberIds ? normalizeGroupUserIds(params.memberIds, 'params.memberIds') : [],
      public: params.public,
      approval: params.joinApprovalRequired,
      allowinvites: params.allowInvites,
      invite_need_confirm: params.inviteNeedConfirm,
      maxusers: params.maxMembers,
      custom: params.ext,
      avatar: params.avatar,
    },
    {
      operation: 'createGroup',
    }
  );
  return normalizeCreateGroupResult(response);
};

export const requestGetPublicGroupList = async (
  client: RestClient,
  context: RestContext,
  params: GetPublicGroupListParams = {}
): Promise<GroupListResult> => {
  const endpointContext = buildEndpointContext(context);
  const query = new URLSearchParams();
  const limit = params.limit ?? params.pageSize;
  if (typeof limit === 'number') {
    query.set('limit', String(limit));
  }
  if (typeof params.cursor === 'string' && params.cursor.length > 0) {
    query.set('cursor', params.cursor);
  }
  const endpoint = buildGroupPath(
    endpointContext,
    `/publicchatgroups${query.toString() ? `?${query.toString()}` : ''}`
  );
  const response = await client.get<unknown>(endpoint, {
    operation: 'getPublicGroupList',
  });
  return normalizeGroupListResult(response);
};

export const requestGetJoinedGroupList = async (
  client: RestClient,
  context: RestContext,
  params: GetJoinedGroupListParams = {}
): Promise<GroupListResult> => {
  const endpointContext = buildEndpointContext(context);
  let endpoint = '';

  if (params.needMemberCount || params.needRole) {
    const query = new URLSearchParams();
    query.set('pagenum', String(params.pageNum ?? 0));
    query.set('pagesize', String(params.pageSize ?? 20));
    query.set('needAffiliations', String(Boolean(params.needMemberCount)));
    query.set('needRole', String(Boolean(params.needRole)));
    endpoint = buildGroupPath(
      endpointContext,
      `/chatgroups/user/${endpointContext.encodedUserId}?${query.toString()}`
    );
  } else {
    endpoint = buildGroupPath(
      endpointContext,
      `/users/${endpointContext.encodedUserId}/joined_chatgroups${buildNumberPageQuery(params)}`
    );
  }

  const response = await client.get<unknown>(endpoint, {
    operation: 'getJoinedGroupList',
  });
  return normalizeGroupListResult(response);
};

export const requestGetGroupInfo = async (
  client: RestClient,
  context: RestContext,
  params: GetGroupInfoParams
): Promise<GroupDetail> => {
  const endpointContext = buildEndpointContext(context);
  const groupId = normalizeGroupId(params.groupId, 'params.groupId');
  const endpoint = buildGroupPath(
    endpointContext,
    `/chatgroups/${encodeURIComponent(groupId)}?joined_time=true&version=v3`
  );
  const response = await client.get<unknown>(endpoint, {
    operation: 'getGroupInfo',
  });
  return normalizeGroupDetail(response);
};

export const requestGetGroupInfoList = async (
  client: RestClient,
  context: RestContext,
  params: GetGroupInfoListParams
): Promise<ReadonlyArray<GroupDetail>> => {
  const endpointContext = buildEndpointContext(context);
  const groupIds = normalizeGroupUserIds(params.groupIds, 'params.groupIds');
  const endpoint = buildGroupPath(
    endpointContext,
    `/chatgroups/${groupIds.map(item => encodeURIComponent(item)).join(',')}?joined_time=true&version=v3`
  );
  const response = await client.get<unknown>(endpoint, {
    operation: 'getGroupInfoList',
  });
  const data = isRecord(response) && Array.isArray(response.data) ? response.data : [];
  return data.map(item => normalizeGroupDetail({ data: [item] }));
};

export const requestUpdateGroupInfo = async (
  client: RestClient,
  context: RestContext,
  params: UpdateGroupInfoParams
): Promise<void> => {
  const endpointContext = buildEndpointContext(context);
  const groupId = normalizeGroupId(params.groupId, 'params.groupId');
  const requestBody: Record<string, unknown> = {};
  const name = normalizeOptionalString(params.name, 'params.name');
  const description = normalizeOptionalString(params.description, 'params.description');
  const ext = normalizeOptionalString(params.ext, 'params.ext');
  const publicValue = normalizeBoolean(params.public, 'params.public');
  const joinApprovalRequired = normalizeBoolean(params.joinApprovalRequired, 'params.joinApprovalRequired');
  const allowInvites = normalizeBoolean(params.allowInvites, 'params.allowInvites');
  const inviteNeedConfirm = normalizeBoolean(params.inviteNeedConfirm, 'params.inviteNeedConfirm');
  const maxMembers = normalizeNumber(params.maxMembers, 'params.maxMembers');

  if (name !== undefined) requestBody.groupname = name;
  if (description !== undefined) requestBody.description = description;
  if (ext !== undefined) requestBody.custom = ext;
  if (publicValue !== undefined) requestBody.public = publicValue;
  if (joinApprovalRequired !== undefined) requestBody.membersonly = joinApprovalRequired;
  if (allowInvites !== undefined) requestBody.allowinvites = allowInvites;
  if (inviteNeedConfirm !== undefined) requestBody.invite_need_confirm = inviteNeedConfirm;
  if (maxMembers !== undefined) requestBody.maxusers = maxMembers;

  if (Object.keys(requestBody).length === 0) {
    throw buildRequiredStringError('params');
  }

  const endpoint = buildGroupPath(
    endpointContext,
    `/chatgroups/${encodeURIComponent(groupId)}?resource=${endpointContext.encodedResource}&version=v3`
  );
  await client.put<unknown>(endpoint, requestBody, {
    operation: 'updateGroupInfo',
  });
};

export const requestChangeGroupOwner = async (
  client: RestClient,
  context: RestContext,
  params: GroupOwnerChangeParams
): Promise<void> => {
  const endpointContext = buildEndpointContext(context);
  const endpoint = buildGroupPath(
    endpointContext,
    `/chatgroups/${encodeURIComponent(normalizeGroupId(params.groupId, 'params.groupId'))}` +
      `?resource=${endpointContext.encodedResource}`
  );
  await client.put<unknown>(
    endpoint,
    {
      newowner: normalizeGroupId(params.newOwner, 'params.newOwner'),
    },
    {
      operation: 'changeGroupOwner',
    }
  );
};

export const requestDestroyGroup = async (
  client: RestClient,
  context: RestContext,
  params: GroupMutationTarget
): Promise<void> => {
  const endpointContext = buildEndpointContext(context);
  const endpoint = buildGroupPath(
    endpointContext,
    `/chatgroups/${encodeURIComponent(normalizeGroupId(params.groupId, 'params.groupId'))}` +
      `?version=v3&resource=${endpointContext.encodedResource}`
  );
  await client.delete<unknown>(endpoint, {
    operation: 'destroyGroup',
  });
};

export const requestLeaveGroup = async (
  client: RestClient,
  context: RestContext,
  params: GroupMutationTarget
): Promise<void> => {
  const endpointContext = buildEndpointContext(context);
  const endpoint = buildGroupPath(
    endpointContext,
    `/chatgroups/${encodeURIComponent(normalizeGroupId(params.groupId, 'params.groupId'))}` +
      `/quit?resource=${endpointContext.encodedResource}`
  );
  await client.delete<unknown>(endpoint, {
    operation: 'leaveGroup',
  });
};

export const requestJoinGroup = async (
  client: RestClient,
  context: RestContext,
  params: GroupJoinParams
): Promise<void> => {
  const endpointContext = buildEndpointContext(context);
  const endpoint = buildGroupPath(
    endpointContext,
    `/chatgroups/${encodeURIComponent(normalizeGroupId(params.groupId, 'params.groupId'))}` +
      `/apply?resource=${endpointContext.encodedResource}`
  );
  await client.post<unknown>(
    endpoint,
    {
      message: params.message ?? '',
    },
    {
      operation: 'joinGroup',
    }
  );
};

export const requestInviteUsersToGroup = async (
  client: RestClient,
  context: RestContext,
  params: GroupUserBatchParams
): Promise<void> => {
  const endpointContext = buildEndpointContext(context);
  const endpoint = buildGroupPath(
    endpointContext,
    `/chatgroups/${encodeURIComponent(normalizeGroupId(params.groupId, 'params.groupId'))}` +
      `/invite?resource=${endpointContext.encodedResource}`
  );
  await client.post<unknown>(
    endpoint,
    {
      usernames: normalizeGroupUserIds(params.userIds, 'params.userIds'),
    },
    {
      operation: 'inviteUsersToGroup',
    }
  );
};

export const requestAcceptGroupJoinRequest = async (
  client: RestClient,
  context: RestContext,
  params: AcceptGroupJoinRequestParams
): Promise<void> => {
  const endpointContext = buildEndpointContext(context);
  const endpoint = buildGroupPath(
    endpointContext,
    `/chatgroups/${encodeURIComponent(normalizeGroupId(params.groupId, 'params.groupId'))}` +
      `/apply_verify?resource=${endpointContext.encodedResource}`
  );
  await client.post<unknown>(
    endpoint,
    {
      applicant: normalizeGroupId(params.userId, 'params.userId'),
      verifyResult: true,
    },
    {
      operation: 'acceptGroupJoinRequest',
    }
  );
};

export const requestRejectGroupJoinRequest = async (
  client: RestClient,
  context: RestContext,
  params: RejectGroupJoinRequestParams
): Promise<void> => {
  const endpointContext = buildEndpointContext(context);
  const endpoint = buildGroupPath(
    endpointContext,
    `/chatgroups/${encodeURIComponent(normalizeGroupId(params.groupId, 'params.groupId'))}` +
      `/apply_verify?resource=${endpointContext.encodedResource}`
  );
  await client.post<unknown>(
    endpoint,
    {
      applicant: normalizeGroupId(params.userId, 'params.userId'),
      verifyResult: false,
      reason: params.reason,
    },
    {
      operation: 'rejectGroupJoinRequest',
    }
  );
};

export const requestAcceptInvitation = async (
  client: RestClient,
  context: RestContext,
  params: GroupMutationTarget
): Promise<void> => {
  const endpointContext = buildEndpointContext(context);
  const endpoint = buildGroupPath(
    endpointContext,
    `/chatgroups/${encodeURIComponent(normalizeGroupId(params.groupId, 'params.groupId'))}` +
      `/invite_verify?resource=${endpointContext.encodedResource}`
  );
  await client.post<unknown>(
    endpoint,
    {
      invitee: context.userId,
      verifyResult: true,
    },
    {
      operation: 'acceptInvitation',
    }
  );
};

export const requestRejectInvitation = async (
  client: RestClient,
  context: RestContext,
  params: GroupMutationTarget
): Promise<void> => {
  const endpointContext = buildEndpointContext(context);
  const endpoint = buildGroupPath(
    endpointContext,
    `/chatgroups/${encodeURIComponent(normalizeGroupId(params.groupId, 'params.groupId'))}` +
      `/invite_verify?resource=${endpointContext.encodedResource}`
  );
  await client.post<unknown>(
    endpoint,
    {
      invitee: context.userId,
      verifyResult: false,
    },
    {
      operation: 'rejectInvitation',
    }
  );
};

export const requestGetGroupMemberList = async (
  client: RestClient,
  context: RestContext,
  params: GroupMemberListParams
): Promise<GroupMemberListResult> => {
  const endpointContext = buildEndpointContext(context);
  const endpoint = buildGroupPath(
    endpointContext,
    `/chatgroups/${encodeURIComponent(normalizeGroupId(params.groupId, 'params.groupId'))}/users${buildCursorQuery(params)}`
  );
  const response = await client.get<unknown>(endpoint, {
    operation: 'getGroupMemberList',
  });
  return normalizeGroupMemberListResult(response);
};

export const requestRemoveGroupMembers = async (
  client: RestClient,
  context: RestContext,
  params: GroupUserBatchParams
): Promise<void> => {
  const endpointContext = buildEndpointContext(context);
  const userIds = normalizeGroupUserIds(params.userIds, 'params.userIds');
  const endpoint = buildGroupPath(
    endpointContext,
    `/chatgroups/${encodeURIComponent(normalizeGroupId(params.groupId, 'params.groupId'))}` +
      `/users/${userIds.map(item => encodeURIComponent(item)).join(',')}?resource=${endpointContext.encodedResource}`
  );
  await client.delete<unknown>(endpoint, {
    operation: 'removeGroupMembers',
  });
};

export const requestGetGroupAdminList = async (
  client: RestClient,
  context: RestContext,
  params: GroupMutationTarget
): Promise<ReadonlyArray<UserInfo>> => {
  const endpointContext = buildEndpointContext(context);
  const endpoint = buildGroupPath(
    endpointContext,
    `/chatgroups/${encodeURIComponent(normalizeGroupId(params.groupId, 'params.groupId'))}/admin`
  );
  const response = await client.get<unknown>(endpoint, {
    operation: 'getGroupAdminList',
  });
  return normalizeGroupAdminUsers(response);
};

export const requestAddGroupAdmin = async (
  client: RestClient,
  context: RestContext,
  params: GroupAdminMutationParams
): Promise<void> => {
  const endpointContext = buildEndpointContext(context);
  const endpoint = buildGroupPath(
    endpointContext,
    `/chatgroups/${encodeURIComponent(normalizeGroupId(params.groupId, 'params.groupId'))}` +
      `/admin?resource=${endpointContext.encodedResource}`
  );
  await client.post<unknown>(
    endpoint,
    {
      newadmin: params.userId,
    },
    {
      operation: 'addGroupAdmin',
    }
  );
};

export const requestRemoveGroupAdmin = async (
  client: RestClient,
  context: RestContext,
  params: GroupAdminMutationParams
): Promise<void> => {
  const endpointContext = buildEndpointContext(context);
  const endpoint = buildGroupPath(
    endpointContext,
    `/chatgroups/${encodeURIComponent(normalizeGroupId(params.groupId, 'params.groupId'))}` +
      `/admin/${encodeURIComponent(params.userId)}?resource=${endpointContext.encodedResource}`
  );
  await client.delete<unknown>(endpoint, {
    operation: 'removeGroupAdmin',
  });
};

export const requestGetGroupMuteList = async (
  client: RestClient,
  context: RestContext,
  params: GroupMuteListParams
): Promise<ReadonlyArray<GroupMuteEntry>> => {
  const endpointContext = buildEndpointContext(context);
  const groupId = normalizeGroupId(params.groupId, 'params.groupId');
  const pageQuery = buildNumberPageQuery(params);
  const separator = pageQuery ? '&' : '';
  const endpoint = buildGroupPath(
    endpointContext,
    `/chatgroups/${encodeURIComponent(groupId)}/mute?version=v3${separator}${pageQuery.replace('?', '')}`
  );
  const response = await client.get<unknown>(endpoint, {
    operation: 'getGroupMuteList',
  });
  return normalizeGroupMuteEntries(response);
};

export const requestMuteGroupMembers = async (
  client: RestClient,
  context: RestContext,
  params: GroupMuteMembersParams
): Promise<void> => {
  const endpointContext = buildEndpointContext(context);
  const endpoint = buildGroupPath(
    endpointContext,
    `/chatgroups/${encodeURIComponent(normalizeGroupId(params.groupId, 'params.groupId'))}` +
      `/mute?resource=${endpointContext.encodedResource}`
  );
  await client.post<unknown>(
    endpoint,
    {
      usernames: normalizeGroupUserIds(params.userIds, 'params.userIds'),
      mute_duration: params.muteDuration,
    },
    {
      operation: 'muteGroupMembers',
    }
  );
};

export const requestUnmuteGroupMembers = async (
  client: RestClient,
  context: RestContext,
  params: GroupUserBatchParams
): Promise<void> => {
  const endpointContext = buildEndpointContext(context);
  const userIds = normalizeGroupUserIds(params.userIds, 'params.userIds');
  const endpoint = buildGroupPath(
    endpointContext,
    `/chatgroups/${encodeURIComponent(normalizeGroupId(params.groupId, 'params.groupId'))}` +
      `/mute/${userIds.map(item => encodeURIComponent(item)).join(',')}?resource=${endpointContext.encodedResource}`
  );
  await client.delete<unknown>(endpoint, {
    operation: 'unmuteGroupMembers',
  });
};

export const requestMuteAllGroupMembers = async (
  client: RestClient,
  context: RestContext,
  params: GroupMutationTarget
): Promise<void> => {
  const endpointContext = buildEndpointContext(context);
  const endpoint = buildGroupPath(
    endpointContext,
    `/chatgroups/${encodeURIComponent(normalizeGroupId(params.groupId, 'params.groupId'))}` +
      `/ban?resource=${endpointContext.encodedResource}`
  );
  await client.post<unknown>(endpoint, undefined, {
    operation: 'muteAllGroupMembers',
  });
};

export const requestUnmuteAllGroupMembers = async (
  client: RestClient,
  context: RestContext,
  params: GroupMutationTarget
): Promise<void> => {
  const endpointContext = buildEndpointContext(context);
  const endpoint = buildGroupPath(
    endpointContext,
    `/chatgroups/${encodeURIComponent(normalizeGroupId(params.groupId, 'params.groupId'))}` +
      `/ban?resource=${endpointContext.encodedResource}`
  );
  await client.delete<unknown>(endpoint, {
    operation: 'unmuteAllGroupMembers',
  });
};

export const requestGetGroupBlocklist = async (
  client: RestClient,
  context: RestContext,
  params: GroupBlocklistParams
): Promise<ReadonlyArray<GroupBlocklistEntry>> => {
  const endpointContext = buildEndpointContext(context);
  const groupId = normalizeGroupId(params.groupId, 'params.groupId');
  const pageQuery = buildNumberPageQuery(params);
  const separator = pageQuery ? '&' : '';
  const endpoint = buildGroupPath(
    endpointContext,
    `/chatgroups/${encodeURIComponent(groupId)}/blocks/users?version=v3${separator}${pageQuery.replace('?', '')}`
  );
  const response = await client.get<unknown>(endpoint, {
    operation: 'getGroupBlocklist',
  });
  return normalizeGroupBlocklistEntries(response);
};

export const requestBlockGroupMembers = async (
  client: RestClient,
  context: RestContext,
  params: GroupUserBatchParams
): Promise<void> => {
  const endpointContext = buildEndpointContext(context);
  const endpoint = buildGroupPath(
    endpointContext,
    `/chatgroups/${encodeURIComponent(normalizeGroupId(params.groupId, 'params.groupId'))}` +
      `/blocks/users?resource=${endpointContext.encodedResource}`
  );
  await client.post<unknown>(
    endpoint,
    {
      usernames: normalizeGroupUserIds(params.userIds, 'params.userIds'),
    },
    {
      operation: 'blockGroupMembers',
    }
  );
};

export const requestUnblockGroupMembers = async (
  client: RestClient,
  context: RestContext,
  params: GroupUserBatchParams
): Promise<void> => {
  const endpointContext = buildEndpointContext(context);
  const userIds = normalizeGroupUserIds(params.userIds, 'params.userIds');
  const endpoint = buildGroupPath(
    endpointContext,
    `/chatgroups/${encodeURIComponent(normalizeGroupId(params.groupId, 'params.groupId'))}` +
      `/blocks/users/${userIds.map(item => encodeURIComponent(item)).join(',')}?resource=${endpointContext.encodedResource}`
  );
  await client.delete<unknown>(endpoint, {
    operation: 'unblockGroupMembers',
  });
};

export const requestGetGroupAllowlist = async (
  client: RestClient,
  context: RestContext,
  params: GroupMutationTarget
): Promise<ReadonlyArray<GroupAllowlistEntry>> => {
  const endpointContext = buildEndpointContext(context);
  const endpoint = buildGroupPath(
    endpointContext,
    `/chatgroups/${encodeURIComponent(normalizeGroupId(params.groupId, 'params.groupId'))}/white/users`
  );
  const response = await client.get<unknown>(endpoint, {
    operation: 'getGroupAllowlist',
  });
  return normalizeGroupAllowlistEntries(response);
};

export const requestAddUsersToGroupAllowlist = async (
  client: RestClient,
  context: RestContext,
  params: GroupUserBatchParams
): Promise<void> => {
  const endpointContext = buildEndpointContext(context);
  const endpoint = buildGroupPath(
    endpointContext,
    `/chatgroups/${encodeURIComponent(normalizeGroupId(params.groupId, 'params.groupId'))}` +
      `/white/users?resource=${endpointContext.encodedResource}`
  );
  await client.post<unknown>(
    endpoint,
    {
      usernames: normalizeGroupUserIds(params.userIds, 'params.userIds'),
    },
    {
      operation: 'addUsersToGroupAllowlist',
    }
  );
};

export const requestRemoveUsersFromGroupAllowlist = async (
  client: RestClient,
  context: RestContext,
  params: GroupUserBatchParams
): Promise<void> => {
  const endpointContext = buildEndpointContext(context);
  const userIds = normalizeGroupUserIds(params.userIds, 'params.userIds');
  const endpoint = buildGroupPath(
    endpointContext,
    `/chatgroups/${encodeURIComponent(normalizeGroupId(params.groupId, 'params.groupId'))}` +
      `/white/users/${userIds.map(item => encodeURIComponent(item)).join(',')}?resource=${endpointContext.encodedResource}`
  );
  await client.delete<unknown>(endpoint, {
    operation: 'removeUsersFromGroupAllowlist',
  });
};

export const requestCheckIfInGroupAllowList = async (
  client: RestClient,
  context: RestContext,
  params: GroupMutationTarget
): Promise<boolean> => {
  const endpointContext = buildEndpointContext(context);
  const endpoint = buildGroupPath(
    endpointContext,
    `/chatgroups/${encodeURIComponent(normalizeGroupId(params.groupId, 'params.groupId'))}` +
      `/white/users/${endpointContext.encodedUserId}?version=v3`
  );
  const response = await client.get<unknown>(endpoint, {
    operation: 'checkIfInGroupAllowList',
  });
  if (typeof response === 'boolean') {
    return response;
  }
  if (isRecord(response) && typeof response.data === 'boolean') {
    return response.data;
  }
  return Boolean(response);
};

export const requestCheckIfInGroupMuteList = async (
  client: RestClient,
  context: RestContext,
  params: GroupMutationTarget
): Promise<boolean> => {
  const endpointContext = buildEndpointContext(context);
  const endpoint = buildGroupPath(
    endpointContext,
    `/sdk/chatgroups/${encodeURIComponent(normalizeGroupId(params.groupId, 'params.groupId'))}` +
      `/mute/${endpointContext.encodedUserId}`
  );
  const response = await client.get<unknown>(endpoint, {
    operation: 'checkIfInGroupMuteList',
  });
  if (typeof response === 'boolean') {
    return response;
  }
  if (isRecord(response) && typeof response.data === 'boolean') {
    return response.data;
  }
  return Boolean(response);
};

export const requestGetGroupAnnouncement = async (
  client: RestClient,
  context: RestContext,
  params: GroupMutationTarget
): Promise<GroupAnnouncement> => {
  const endpointContext = buildEndpointContext(context);
  const endpoint = buildGroupPath(
    endpointContext,
    `/chatgroups/${encodeURIComponent(normalizeGroupId(params.groupId, 'params.groupId'))}/announcement`
  );
  const response = await client.get<unknown>(endpoint, {
    operation: 'getGroupAnnouncement',
  });
  return normalizeGroupAnnouncement(response);
};

export const requestUpdateGroupAnnouncement = async (
  client: RestClient,
  context: RestContext,
  params: GroupAnnouncementUpdateParams
): Promise<void> => {
  const endpointContext = buildEndpointContext(context);
  const endpoint = buildGroupPath(
    endpointContext,
    `/chatgroups/${encodeURIComponent(normalizeGroupId(params.groupId, 'params.groupId'))}` +
      `/announcement?resource=${endpointContext.encodedResource}`
  );
  await client.post<unknown>(
    endpoint,
    {
      announcement: params.announcement,
    },
    {
      operation: 'updateGroupAnnouncement',
    }
  );
};

export const requestGetGroupSharedFileList = async (
  client: RestClient,
  context: RestContext,
  params: GroupSharedFileListParams
): Promise<GroupSharedFileListResult> => {
  const endpointContext = buildEndpointContext(context);
  const query = new URLSearchParams();
  query.set('pagenum', String(params.pageNum ?? 1));
  query.set('pagesize', String(params.pageSize ?? 20));
  const endpoint = buildGroupPath(
    endpointContext,
    `/chatgroups/${encodeURIComponent(normalizeGroupId(params.groupId, 'params.groupId'))}` +
      `/sharefiles?${query.toString()}`
  );
  const response = await client.get<unknown>(endpoint, {
    operation: 'getGroupSharedFileList',
  });
  return normalizeGroupSharedFileListResult(response);
};

export const requestDeleteGroupSharedFile = async (
  client: RestClient,
  context: RestContext,
  params: DeleteGroupSharedFileParams
): Promise<void> => {
  const endpointContext = buildEndpointContext(context);
  const endpoint = buildGroupPath(
    endpointContext,
    `/chatgroups/${encodeURIComponent(normalizeGroupId(params.groupId, 'params.groupId'))}` +
      `/share_files/${encodeURIComponent(normalizeGroupId(params.fileId, 'params.fileId'))}` +
      `?resource=${endpointContext.encodedResource}`
  );
  await client.delete<unknown>(endpoint, {
    operation: 'deleteGroupSharedFile',
  });
};

export const buildDownloadGroupSharedFileEndpoint = (
  context: RestContext,
  params: DownloadGroupSharedFileParams
): string => {
  const endpointContext = buildEndpointContext(context);
  return buildGroupPath(
    endpointContext,
    `/chatgroups/${encodeURIComponent(normalizeGroupId(params.groupId, 'params.groupId'))}` +
      `/share_files/${encodeURIComponent(normalizeGroupId(params.fileId, 'params.fileId'))}`
  );
};

export const requestSetGroupMemberAttributes = async (
  client: RestClient,
  context: RestContext,
  params: SetGroupMemberAttributesParams
): Promise<unknown> => {
  const endpointContext = buildEndpointContext(context);
  const normalizedGroupId = normalizeGroupId(params.groupId, 'params.groupId');
  const normalizedUserId = normalizeGroupId(params.userId, 'params.userId');
  const selfGroupNamecardPayload = resolveSelfGroupNamecardPayload(
    context,
    normalizedUserId,
    params.memberAttributes
  );

  if (selfGroupNamecardPayload) {
    const endpoint = buildGroupPath(
      endpointContext,
      `/sdk/chatgroups/${encodeURIComponent(normalizedGroupId)}/nameCard`
    );
    return await client.put<unknown>(endpoint, selfGroupNamecardPayload, {
      operation: 'setGroupMemberAttributes',
    });
  }

  const endpoint = buildGroupPath(
    endpointContext,
    `/sdk/metadata/chatgroup/${encodeURIComponent(normalizedGroupId)}` +
      `/user/${encodeURIComponent(normalizedUserId)}` +
      `?resource=${endpointContext.encodedResource}`
  );
  return await client.put<unknown>(
    endpoint,
    {
      metaData: params.memberAttributes,
    },
    {
      operation: 'setGroupMemberAttributes',
    }
  );
};

export const requestGetGroupMembersAttributes = async (
  client: RestClient,
  context: RestContext,
  params: GetGroupMembersAttributesParams
): Promise<GroupMembersAttributesResult> => {
  const endpointContext = buildEndpointContext(context);
  const endpoint = buildGroupPath(
    endpointContext,
    `/sdk/metadata/chatgroup/${encodeURIComponent(normalizeGroupId(params.groupId, 'params.groupId'))}/get`
  );
  const response = await client.post<unknown>(
    endpoint,
    {
      targets: normalizeGroupUserIds(params.userIds, 'params.userIds'),
      properties: params.keys ?? [],
    },
    {
      operation: 'getGroupMembersAttributes',
    }
  );
  return normalizeGroupMembersAttributes(response);
};

export const requestGetGroupNamecards = async (
  client: RestClient,
  context: RestContext,
  params: {
    readonly groupId: string;
    readonly userIds: ReadonlyArray<string>;
  }
): Promise<{
  readonly items: Readonly<
    Record<string, { readonly namecard: string; readonly namecardUpdateTime?: number }>
  >;
  readonly responseTimestamp?: number;
}> => {
  const endpointContext = buildEndpointContext(context);
  const endpoint = buildGroupPath(
    endpointContext,
    `/sdk/chatgroups/${encodeURIComponent(normalizeGroupId(params.groupId, 'params.groupId'))}/nameCard/batch/get`
  );
  const response = await client.post<unknown>(
    endpoint,
    {
      members: normalizeGroupUserIds(params.userIds, 'params.userIds'),
    },
    {
      operation: 'getGroupNamecards',
    }
  );
  return {
    items: normalizeGroupNamecardBatch(response),
    responseTimestamp: resolveGroupNamecardBatchResponseTimestamp(response),
  };
};

const normalizeGroupNamecardBatch = (
  payload: unknown
): Readonly<
  Record<string, { readonly namecard: string; readonly namecardUpdateTime?: number }>
> => {
  const root = isRecord(payload) ? payload : {};
  const rootData = root['data'];
  const nestedData = isRecord(rootData) ? rootData['data'] : undefined;
  const arrayData = Array.isArray(rootData)
    ? rootData
    : Array.isArray(nestedData)
      ? nestedData
      : null;
  if (Array.isArray(arrayData)) {
    return normalizeGroupNamecardBatchArray(arrayData);
  }
  const data = isRecord(rootData) ? rootData : root;
  const source = isRecord(data.namecards) ? data.namecards : data;
  const result: Record<string, { namecard: string; namecardUpdateTime?: number }> = {};
  for (const [userId, value] of Object.entries(source)) {
    if (typeof value === 'string') {
      result[userId] = {
        namecard: value,
      };
      continue;
    }
    if (!isRecord(value)) {
      continue;
    }
    const namecard =
      value.namecard ??
      value.nameCard ??
      value.groupNamecard ??
      value.group_namecard ??
      value.group_name_card;
    if (typeof namecard === 'string') {
      result[userId] = {
        namecard,
        namecardUpdateTime: resolveGroupNamecardUpdateTime(value),
      };
    }
  }
  return result;
};

const normalizeGroupNamecardBatchArray = (
  payload: ReadonlyArray<unknown>
): Readonly<
  Record<string, { readonly namecard: string; readonly namecardUpdateTime?: number }>
> => {
  const result: Record<string, { namecard: string; namecardUpdateTime?: number }> = {};
  payload.forEach(item => {
    if (!isRecord(item)) {
      return;
    }
    const userId = item.username ?? item.userId ?? item.userid ?? item.user_id;
    const namecard =
      item.name_card ??
      item.namecard ??
      item.nameCard ??
      item.groupNamecard ??
      item.group_namecard ??
      item.group_name_card;
    if (typeof userId !== 'string' || !userId.trim() || typeof namecard !== 'string') {
      return;
    }
    result[userId.trim()] = {
      namecard,
      namecardUpdateTime: resolveGroupNamecardUpdateTime(item),
    };
  });
  return result;
};

const resolveGroupNamecardUpdateTime = (value: Record<string, unknown>): number | undefined => {
  return normalizeProfileVersionFromTimestamp(
    typeof value.update_timestamp === 'number'
      ? value.update_timestamp
      : typeof value.updateTimestamp === 'number'
        ? value.updateTimestamp
        : typeof value.timestamp === 'number'
          ? value.timestamp
          : typeof value.lastModified === 'number'
            ? value.lastModified
            : typeof value.last_modified === 'number'
              ? value.last_modified
              : undefined
  );
};

const resolveGroupNamecardBatchResponseTimestamp = (payload: unknown): number | undefined => {
  if (!isRecord(payload)) {
    return undefined;
  }
  return normalizeProfileVersionFromTimestamp(
    typeof payload.timestamp === 'number'
      ? payload.timestamp
      : typeof payload.update_timestamp === 'number'
        ? payload.update_timestamp
        : typeof payload.updateTimestamp === 'number'
          ? payload.updateTimestamp
          : typeof payload.lastModified === 'number'
            ? payload.lastModified
            : typeof payload.last_modified === 'number'
              ? payload.last_modified
              : undefined
  );
};
