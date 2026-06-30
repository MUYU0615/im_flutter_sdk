/**
 * [zh-CN] GroupManager 对外管理器实现。
 * [en-US] Public GroupManager implementation.
 */

import type { ChatClient } from '../chat-client';
import { isRecord } from '../cache/cache-utils';
import { normalizeProfileVersionFromTimestamp } from '../core/message/profile-sync/profile-version';
import { RestClient } from '../rest/client';
import { mergeRuntimeErrorMaps } from '../rest/error-map-types';
import { COMMON_ERROR_MAP } from '../rest/error-maps/common';
import { GROUP_ERROR_MAP } from '../rest/error-maps/group';
import type {
  AcceptGroupJoinRequestParams,
  CreateGroupParams,
  CreateGroupResult,
  DeleteGroupSharedFileParams,
  DownloadGroupSharedFileParams,
  GetGroupInfoListParams,
  GetGroupInfoParams,
  GetGroupMembersAttributesParams,
  GetPublicGroupListParams,
  GroupAdminMutationParams,
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
  GroupRawNotifyEvent,
  GroupRawNotifyPayload,
  GroupSharedFile,
  GroupSharedFileListParams,
  GroupSharedFileListResult,
  GroupUserBatchParams,
  GroupJoinParams,
  GroupMuteMembersParams,
  RejectGroupJoinRequestParams,
  SetGroupMemberAttributesParams,
  UpdateGroupInfoParams,
  UploadGroupSharedFileParams,
  GroupAllowlistEntry,
  JoinedGroupSnapshot,
  JoinedGroupSummary,
} from '../types/group';
import type { RestContext } from '../types/chat-client';
import { GroupEventName } from '../types/event-system';
import type {
  EventHandlerId,
  GroupEventHandlerMap,
  GroupEventName as GroupEventNameType,
  GroupEventPayloadMap,
} from '../types/event-system';
import type { ManagerBase, ManagerEventContext } from '../types/manager';
import type { RawNotifyEvent } from '../types/manager';
import type { UserInfo } from '../types/user-info';
import { SDKError } from '../utils/errors';
import { ERROR_CODES } from '../utils/error-codes';
import { logger } from '../utils/logger';
import {
  buildDownloadGroupSharedFileEndpoint,
  requestAcceptInvitation,
  requestAcceptGroupJoinRequest,
  requestAddUsersToGroupAllowlist,
  requestBlockGroupMembers,
  requestChangeGroupOwner,
  requestCreateGroup,
  requestDeleteGroupSharedFile,
  requestDestroyGroup,
  requestGetGroupAdminList,
  requestGetGroupAllowlist,
  requestGetGroupAnnouncement,
  requestGetGroupBlocklist,
  requestGetGroupInfo,
  requestGetGroupInfoList,
  requestGetGroupNamecards,
  requestGetGroupMemberList,
  requestGetGroupMembersAttributes,
  requestGetGroupMuteList,
  requestGetGroupSharedFileList,
  requestGetPublicGroupList,
  requestInviteUsersToGroup,
  requestCheckIfInGroupMuteList,
  requestCheckIfInGroupAllowList,
  requestJoinGroup,
  requestLeaveGroup,
  requestMuteAllGroupMembers,
  requestMuteGroupMembers,
  requestRejectInvitation,
  requestRejectGroupJoinRequest,
  requestRemoveGroupAdmin,
  requestRemoveGroupMembers,
  requestRemoveUsersFromGroupAllowlist,
  requestAddGroupAdmin,
  requestSetGroupMemberAttributes,
  requestUnblockGroupMembers,
  requestUnmuteAllGroupMembers,
  requestUnmuteGroupMembers,
  requestUpdateGroupAnnouncement,
  requestUpdateGroupInfo,
} from '../rest/group-management';
import {
  buildFetchUserInfoByUserIdRequest,
  buildUserInfoFetchEndpoint,
  normalizeFetchedUserInfos,
} from '../rest/user-info';
import {
  mergeGroupUserInfo,
  resolveGroupUserInfoMap,
  resolveGroupUserInfos,
} from './group/group-event-user-info-resolver';
import { Group } from './group/group';
import { GroupEventSync } from './group/internal/group-event-sync';
import { GroupRepository } from './group/internal/group-repository';
import type { CacheManager } from '../cache/cache-manager';
import { GroupSyncController } from '../core/group-sync/group-sync-controller';
import type { GroupSyncControllerDependencies } from '../core/group-sync/group-sync-types';
import { ValidationError } from '../utils/errors';
import type { GroupNamecardCacheRecord } from '../cache/cache-types';

type GroupItemWithUser = {
  readonly user: UserInfo;
};

type GroupItemArrayWithUser<T extends GroupItemWithUser> = ReadonlyArray<T>;

interface UserInfoReadCapability extends ManagerBase<ChatClient> {
  getUserInfoByUserId(params: {
    readonly userIds: ReadonlyArray<string>;
  }): Promise<ReadonlyArray<UserInfo>>;
}

interface UserInfoCapabilityProvider {
  getManagerByCapability(capability: 'userInfo:read'): ManagerBase<ChatClient> | null;
}

interface GroupNamecardHydrationTarget {
  readonly userId: string;
  readonly namecardUpdateTime?: number;
}

const GROUP_REST_ERROR_MAP = mergeRuntimeErrorMaps(COMMON_ERROR_MAP, GROUP_ERROR_MAP);

export class GroupManager implements ManagerBase<ChatClient> {
  /** @internal SDK 内部管理器注册键，不对外文档暴露。 */
  public static readonly key = 'groupManager' as const;
  /** @internal SDK 内部 raw notify 与群名片能力声明，不作为公开 API 使用。 */
  public readonly capabilities = ['rawNotify:group', 'group:namecard'] as const;

  private client: ChatClient | null = null;
  private eventContext: ManagerEventContext | null = null;
  private restClient: RestClient | null = null;
  private restBaseUrl: string | null = null;
  private restToken: string | null = null;
  private readonly groupRegistry = new Map<string, Group>();
  private groupRepository: GroupRepository | null = null;
  private groupEventSync: GroupEventSync | null = null;

  /**
   * @internal
   * [zh-CN] 绑定 GroupManager 到 ChatClient，通常由 SDK 内部在 `client.groupManager` 初始化阶段调用。 [en-US] Binds GroupManager to ChatClient and is usually called internally when `client.groupManager` is initialized.
   */
  public bind(client: ChatClient, context?: ManagerEventContext): void {
    this.client = client;
    this.eventContext = context ?? null;
    this.groupRegistry.clear();
    this.groupRepository = new GroupRepository();
    this.groupEventSync = new GroupEventSync(this.groupRepository);
    this.ensureRepositorySession();
  }

  /**
   * [zh-CN] 注册群组事件处理器。
   * [en-US] Registers group event handlers.
   *
   * @example [zh-CN] 监听群成员加入事件 [en-US] Listen for members joined events
   * ```ts
   * client.groupManager.addEventHandler('group-events', {
   *   onMembersJoined: event => console.log(event.groupId, event.members),
   * });
   * ```
   * @param id - [zh-CN] 事件处理器唯一 ID，用于后续移除。 [en-US] Unique handler id used for later removal.
   * @param handlers - [zh-CN] 群组事件处理器集合。 [en-US] Group event handler collection.
   * @returns {void} [zh-CN] 注册完成后无返回值。 [en-US] Returns nothing after registration.
   */
  public addEventHandler(id: EventHandlerId, handlers: GroupEventHandlerMap): void {
    this.eventContext?.addEventHandler(id, handlers);
  }

  /**
   * [zh-CN] 移除群组事件处理器。
   * [en-US] Removes group event handlers.
   *
   * @example [zh-CN] 移除监听 [en-US] Remove a handler
   * ```ts
   * client.groupManager.removeEventHandler('group-events');
   * ```
   * @param id - [zh-CN] 待移除的事件处理器 ID。 [en-US] Handler id to remove.
   * @returns {void} [zh-CN] 移除完成后无返回值。 [en-US] Returns nothing after removal.
   */
  public removeEventHandler(id: EventHandlerId): void {
    this.eventContext?.removeEventHandler(id);
  }

  /** @internal */
  public async handleRawNotify(event: RawNotifyEvent): Promise<void> {
    if (event.type !== 'group') {
      return;
    }
    const payload = event.payload as GroupRawNotifyEvent;
    const eventName = payload.eventName as GroupEventNameType;
    const normalized = await this.buildIncomingEventPayload(eventName, payload);
    if (!normalized) {
      return;
    }
    this.eventContext?.dispatch?.(eventName, normalized);

    if (eventName !== GroupEventName.GROUP_MEMBER_ATTRIBUTE_CHANGED) {
      return;
    }
    if (!('attribute' in normalized) || !('user' in normalized)) {
      return;
    }
    const groupNamecard = this.extractGroupNamecard(normalized.attribute);
    if (groupNamecard === undefined || !normalized.user?.userId) {
      return;
    }
    const currentUserId = this.client?.getCurrentUserId();
    if (normalized.user.userId === currentUserId) {
      return;
    }
    this.getCacheManager()?.setGroupNamecards([
      {
        groupId: normalized.groupId,
        userId: normalized.user.userId,
        namecard: groupNamecard,
        lastAccess: Date.now(),
        lastUpdate: Date.now(),
      },
    ]);
    this.eventContext?.dispatch?.(GroupEventName.USER_GROUP_NAMECARD_UPDATED, {
      groupId: normalized.groupId,
      userId: normalized.user.userId,
      namecard: groupNamecard,
    });
  }

  /**
   * [zh-CN] 创建群组，可指定初始成员、公开属性、入群审批、邀请策略与最大人数。
   * [en-US] Creates a group with initial members, visibility, join joinApprovalRequired, invitation policy, and member limit.
   *
   * @example [zh-CN] 创建公开群 [en-US] Create a public group
   * ```ts
   * const result = await client.groupManager.createGroup({
   *   name: 'Developers',
   *   description: 'SDK discussion',
   *   memberIds: ['user-1', 'user-2'],
   *   public: true,
   *   joinApprovalRequired: false,
   *   allowInvites: true,
   *   inviteNeedConfirm: true,
   *   maxMembers: 200,
   * });
   * ```
   * @param params - [zh-CN] 创建群组参数。 [en-US] Group creation parameters.
   * @throws {ValidationError} [zh-CN] 错误码 `110`：必填字段缺失、字段格式非法或成员不存在。 [en-US] Error code `110`: missing required fields, invalid field format, or member not found.
   * @throws {SDKError} [zh-CN] 错误码 `4`：群组数量、用户加入群数量或初始成员数量达到服务限制。 [en-US] Error code `4`: group count, joined group count, or initial member count exceeds service limits.
   * @throws {AuthenticationError} [zh-CN] 错误码 `202`：鉴权失败。 [en-US] Error code `202`: authentication failed.
   * @returns {Promise<CreateGroupResult>} [zh-CN] 返回创建成功后的群 ID。 [en-US] Returns the created group id.
   */
  public async createGroup(params: CreateGroupParams): Promise<CreateGroupResult> {
    return this.runOperation('createGroup', async () => {
      const context = this.getRestContextOrThrow();
      return await requestCreateGroup(this.getRestClient(context), context, params);
    });
  }

  /**
   * @internal
   * [zh-CN] 内部保留的公开群列表 REST 兼容入口，不出现在公开 API Reference。
   * [en-US] Internal REST compatibility entry for public group lists; excluded from public API reference.
   */
  public async getPublicGroupList(params: GetPublicGroupListParams = {}): Promise<GroupListResult> {
    return this.runOperation('getPublicGroupList', async () => {
      this.ensureRepositorySession();
      const context = this.getRestContextOrThrow();
      const result = await requestGetPublicGroupList(this.getRestClient(context), context, params);
      return {
        ...result,
        items: this.getGroupRepository().mergeSummaries(result.items),
      };
    });
  }

  /**
   * [zh-CN] 读取当前用户已加入群组的本地同步列表；该方法只读本地缓存和当前会话运行时数据，不发起网络请求。
   * [en-US] Reads the local synced list of groups joined by the current user. This method only reads local cache and current-session runtime data, and never sends network requests.
   *
   * @example [zh-CN] 读取已加入群本地列表 [en-US] Read local joined groups
   * ```ts
   * const groups = client.groupManager.getJoinedGroupList();
   * ```
   * @returns {ReadonlyArray<JoinedGroupSummary>} [zh-CN] 返回本地已加入群组轻量数组。 [en-US] Returns lightweight local joined groups.
   */
  public getJoinedGroupList(): ReadonlyArray<JoinedGroupSummary> {
    return this.getJoinedGroupSnapshotForSync().items;
  }

  /** @internal */
  public getJoinedGroupSnapshotForSync(): JoinedGroupSnapshot {
    this.requireClient();
    this.ensureRepositorySession();
    return this.getGroupRepository().getJoinedGroupSnapshot(this.loadJoinedGroupPreviewSnapshot());
  }

  /** @internal */
  public applyJoinedGroupSnapshot(snapshot: JoinedGroupSnapshot): void {
    this.ensureRepositorySession();
    this.getGroupRepository().applyJoinedGroupSnapshot(snapshot);
  }

  /** @internal 推荐使用 groupManager.getGroup(groupId).getSummary()。 */
  public getGroupSummaryForHandle(groupId: string): JoinedGroupSummary | null {
    this.requireClient();
    this.ensureRepositorySession();
    return this.getGroupRepository().getJoinedGroupSummarySnapshot(
      groupId,
      this.loadJoinedGroupPreviewSnapshot()
    );
  }

  /**
   * [zh-CN] 获取绑定指定群 ID 的单群操作对象；该方法不发起网络请求。
   * [en-US] Gets a single-group operation facade bound to the specified group id; this method does not send a network request.
   *
   * @example [zh-CN] 获取单群对象 [en-US] Get a group facade
   * ```ts
   * const group = client.groupManager.getGroup('group-1');
   * await group.getDetail();
   * ```
   * @param groupId - [zh-CN] 群组 ID。 [en-US] Group id.
   * @throws {ValidationError} [zh-CN] 错误码 `100`：`groupId` 为空。 [en-US] Error code `100`: `groupId` is empty.
   * @returns {Group} [zh-CN] 返回绑定该群 ID 的 `Group` 对象。 [en-US] Returns a `Group` facade bound to the group id.
   */
  public getGroup(groupId: string): Group {
    this.requireClient();
    this.ensureRepositorySession();
    const normalizedGroupId = groupId.trim();
    if (normalizedGroupId.length === 0) {
      throw new ValidationError('groupId is required', {
        code: ERROR_CODES.VALIDATION_REQUIRED,
        details: {
          fields: [
            {
              path: 'groupId',
              message: 'groupId is required',
              rule: 'required',
            },
          ],
        },
      });
    }
    const existing = this.groupRegistry.get(normalizedGroupId);
    if (existing) {
      return existing;
    }
    this.getGroupSummaryForHandle(normalizedGroupId);
    this.getGroupRepository().getOrCreate(normalizedGroupId);
    const group = new Group(normalizedGroupId, this);
    this.groupRegistry.set(normalizedGroupId, group);
    return group;
  }

  /**
   * [zh-CN] 从服务端获取单个群组详情。
   * [en-US] Gets one group detail from the server.
   *
   * @example [zh-CN] 获取群详情 [en-US] Get group detail
   * ```ts
   * const detail = await client.groupManager.getGroupInfo({ groupId: 'group-1' });
   * ```
   * @param params - [zh-CN] 群组详情查询参数。 [en-US] Group detail query parameters.
   * @throws {ValidationError} [zh-CN] 错误码 `110`：群 ID 非法或群组不存在。 [en-US] Error code `110`: invalid group id or group not found.
   * @throws {AuthenticationError} [zh-CN] 错误码 `202`：鉴权失败。 [en-US] Error code `202`: authentication failed.
   * @returns {Promise<GroupDetail>} [zh-CN] 返回标准化群详情。 [en-US] Returns the normalized group detail.
   */
  public async getGroupInfo(params: GetGroupInfoParams): Promise<GroupDetail> {
    return this.runOperation('getGroupInfo', async () => {
      this.ensureRepositorySession();
      const context = this.getRestContextOrThrow();
      const group = await requestGetGroupInfo(this.getRestClient(context), context, params);
      const hydrated = await this.hydrateGroupDetailUsers(group);
      return this.getGroupRepository().mergeDetail(hydrated);
    });
  }

  /**
   * [zh-CN] 批量获取多个群组详情。
   * [en-US] Gets details for multiple groups.
   *
   * @example [zh-CN] 批量获取群详情 [en-US] Get multiple group details
   * ```ts
   * const groups = await client.groupManager.getGroupInfoList({
   *   groupIds: ['group-1', 'group-2'],
   * });
   * ```
   * @param params - [zh-CN] 群组 ID 列表。 [en-US] Group id list.
   * @throws {ValidationError} [zh-CN] 错误码 `110`：群组 ID 列表为空或包含非法 ID。 [en-US] Error code `110`: empty group id list or invalid group id.
   * @throws {AuthenticationError} [zh-CN] 错误码 `202`：鉴权失败。 [en-US] Error code `202`: authentication failed.
   * @returns {Promise<ReadonlyArray<GroupDetail>>} [zh-CN] 返回标准化群详情数组。 [en-US] Returns normalized group details.
   */
  public async getGroupInfoList(
    params: GetGroupInfoListParams
  ): Promise<ReadonlyArray<GroupDetail>> {
    return this.runOperation('getGroupInfoList', async () => {
      this.ensureRepositorySession();
      const context = this.getRestContextOrThrow();
      const groups = await requestGetGroupInfoList(this.getRestClient(context), context, params);
      const hydrated = await Promise.all(groups.map(group => this.hydrateGroupDetailUsers(group)));
      return this.getGroupRepository().mergeDetails(hydrated);
    });
  }

  /** @internal 推荐使用 groupManager.getGroup(groupId).getDetail()。 */
  public async getGroupDetailForHandle(groupId: string): Promise<GroupDetail> {
    this.ensureRepositorySession();
    const repository = this.getGroupRepository();
    repository.getOrCreate(groupId);
    if (repository.hasFreshDetail(groupId)) {
      const snapshot = repository.getDetailSnapshot(groupId);
      if (snapshot) {
        return snapshot;
      }
    }
    return this.getGroupInfo({ groupId });
  }

  /** @internal 推荐使用 groupManager.getGroup(groupId).refresh()。 */
  public async refreshGroupDetailForHandle(groupId: string): Promise<GroupDetail> {
    this.ensureRepositorySession();
    this.getGroupRepository().getOrCreate(groupId);
    return this.getGroupInfo({ groupId });
  }

  /** @internal 推荐由 ChatClient logout / 会话切换清理调用。 */
  public resetSessionRuntime(): void {
    this.groupRegistry.clear();
    this.getGroupRepository().ensureSession(null);
  }

  /** @internal 推荐由 ChatClient 的群事件分发链路调用。 */
  public async buildIncomingEventPayload(
    eventName: GroupEventNameType,
    rawEvent: GroupRawNotifyEvent
  ): Promise<GroupEventPayloadMap[GroupEventNameType] | null> {
    this.ensureRepositorySession();
    const raw = rawEvent.payload;
    const userInfoMap = await this.resolveUserInfoMap(this.collectEventUserIds(rawEvent));
    this.syncRuntimeForEvent(eventName, raw, userInfoMap);

    switch (eventName) {
      case GroupEventName.INVITATION_RECEIVED:
        return {
          groupId: raw.groupId,
          groupName: raw.groupName,
          inviter: this.pickEventUser(raw.inviterId, userInfoMap),
          reason: raw.reason,
        } as GroupEventPayloadMap[GroupEventNameType];
      case GroupEventName.REQUEST_TO_JOIN_RECEIVED:
        return {
          groupId: raw.groupId,
          groupName: raw.groupName,
          applicant: this.pickEventUser(raw.applicantId, userInfoMap),
          reason: raw.reason,
        } as GroupEventPayloadMap[GroupEventNameType];
      case GroupEventName.REQUEST_TO_JOIN_ACCEPTED:
        return {
          groupId: raw.groupId,
          groupName: raw.groupName,
          accepter: this.pickEventUser(raw.accepterId, userInfoMap),
        } as GroupEventPayloadMap[GroupEventNameType];
      case GroupEventName.REQUEST_TO_JOIN_DECLINED:
        return {
          groupId: raw.groupId,
          groupName: raw.groupName,
          decliner: this.pickEventUser(raw.declinerId, userInfoMap),
          applicant: this.pickEventUser(raw.applicantId, userInfoMap),
          reason: raw.reason,
        } as GroupEventPayloadMap[GroupEventNameType];
      case GroupEventName.INVITATION_ACCEPTED:
        return {
          groupId: raw.groupId,
          invitee: this.pickEventUser(raw.inviteeId, userInfoMap),
          reason: raw.reason,
        } as GroupEventPayloadMap[GroupEventNameType];
      case GroupEventName.INVITATION_DECLINED:
        return {
          groupId: raw.groupId,
          invitee: this.pickEventUser(raw.inviteeId, userInfoMap),
          reason: raw.reason,
        } as GroupEventPayloadMap[GroupEventNameType];
      case GroupEventName.USER_REMOVED:
        return {
          groupId: raw.groupId,
          groupName: raw.groupName,
        } as GroupEventPayloadMap[GroupEventNameType];
      case GroupEventName.GROUP_DESTROYED:
        return {
          groupId: raw.groupId,
          groupName: raw.groupName,
        } as GroupEventPayloadMap[GroupEventNameType];
      case GroupEventName.AUTO_ACCEPT_INVITATION:
        return {
          groupId: raw.groupId,
          inviter: this.pickEventUser(raw.inviterId, userInfoMap),
          inviteMessage: raw.reason,
        } as GroupEventPayloadMap[GroupEventNameType];
      case GroupEventName.MUTE_LIST_ADDED:
        return {
          groupId: raw.groupId,
          mutes: this.pickEventUsers(raw.userIds, userInfoMap),
          muteExpire: raw.muteExpire,
        } as GroupEventPayloadMap[GroupEventNameType];
      case GroupEventName.MUTE_LIST_REMOVED:
        return {
          groupId: raw.groupId,
          mutes: this.pickEventUsers(raw.userIds, userInfoMap),
        } as GroupEventPayloadMap[GroupEventNameType];
      case GroupEventName.ALLOW_LIST_ADDED:
        return {
          groupId: raw.groupId,
          allowlist: this.pickEventUsers(raw.userIds, userInfoMap),
        } as GroupEventPayloadMap[GroupEventNameType];
      case GroupEventName.ALLOW_LIST_REMOVED:
        return {
          groupId: raw.groupId,
          allowlist: this.pickEventUsers(raw.userIds, userInfoMap),
        } as GroupEventPayloadMap[GroupEventNameType];
      case GroupEventName.ALL_MEMBER_MUTE_STATE_CHANGED:
        return {
          groupId: raw.groupId,
          isMuted: Boolean(raw.isMuted),
        } as GroupEventPayloadMap[GroupEventNameType];
      case GroupEventName.ADMIN_ADDED:
      case GroupEventName.ADMIN_REMOVED:
        return {
          groupId: raw.groupId,
          administrator: this.pickEventUser(raw.administratorId, userInfoMap),
        } as GroupEventPayloadMap[GroupEventNameType];
      case GroupEventName.OWNER_CHANGED:
        return {
          groupId: raw.groupId,
          newOwner: this.pickEventUser(raw.newOwnerId, userInfoMap),
          oldOwner: this.pickEventUser(raw.oldOwnerId, userInfoMap),
        } as GroupEventPayloadMap[GroupEventNameType];
      case GroupEventName.MEMBERS_JOINED:
        return {
          groupId: raw.groupId,
          members: this.pickEventUsers(raw.memberIds, userInfoMap),
        } as GroupEventPayloadMap[GroupEventNameType];
      case GroupEventName.MEMBERS_EXITED:
        return {
          groupId: raw.groupId,
          members: this.pickEventUsers(raw.memberIds, userInfoMap),
        } as GroupEventPayloadMap[GroupEventNameType];
      case GroupEventName.ANNOUNCEMENT_CHANGED:
        return {
          groupId: raw.groupId,
          announcement: raw.announcement ?? '',
        } as GroupEventPayloadMap[GroupEventNameType];
      case GroupEventName.SHARED_FILE_ADDED:
        return {
          groupId: raw.groupId,
          sharedFile: this.hydrateEventSharedFile(raw.sharedFile, userInfoMap),
        } as GroupEventPayloadMap[GroupEventNameType];
      case GroupEventName.SHARED_FILE_DELETED:
        return {
          groupId: raw.groupId,
          fileId: raw.fileId ?? '',
        } as GroupEventPayloadMap[GroupEventNameType];
      case GroupEventName.GROUP_INFO_CHANGED:
        return {
          groupId: raw.groupId,
          groupInfo: await this.resolveGroupDetailForEvent(raw),
        } as GroupEventPayloadMap[GroupEventNameType];
      case GroupEventName.GROUP_DISABLED_CHANGED: {
        const groupInfo = await this.resolveGroupDetailForEvent(raw);
        const disabled =
          raw.isDisabled === undefined ? Boolean(groupInfo.disabled) : Boolean(raw.isDisabled);
        return {
          groupId: raw.groupId,
          groupInfo,
          disabled,
        } as GroupEventPayloadMap[GroupEventNameType];
      }
      case GroupEventName.GROUP_MEMBER_ATTRIBUTE_CHANGED:
        return {
          groupId: raw.groupId,
          user: this.pickEventUser(raw.userId, userInfoMap),
          attribute: raw.attribute ?? {},
          from: raw.from,
          source: raw.source,
        } as GroupEventPayloadMap[GroupEventNameType];
      default:
        return null;
    }
  }

  /** @internal 推荐由 ChatClient 的群事件分发链路调用。 */
  public async resolveGroupDetailForEvent(raw: GroupRawNotifyPayload): Promise<GroupDetail> {
    this.ensureRepositorySession();
    const eventPatch: Partial<GroupDetail> | undefined =
      raw.isDisabled === undefined
        ? raw.groupPatch
        : {
            ...(raw.groupPatch ?? {}),
            disabled: raw.isDisabled,
          };

    const patched = this.getGroupEventSync().applyPatch({
      groupId: raw.groupId,
      groupName: raw.groupName,
      groupPatch: eventPatch,
      shouldMarkStale: raw.shouldFetchGroupDetail,
    });

    if (raw.shouldFetchGroupDetail) {
      try {
        return await this.getGroupInfo({ groupId: raw.groupId });
      } catch (error) {
        logger.warn('GroupManager resolveGroupDetailForEvent fallback to snapshot', {
          groupId: raw.groupId,
          error,
        });
      }
    }

    if (patched) {
      return patched;
    }

    const snapshot = this.getGroupRepository().getDetailSnapshot(raw.groupId);
    if (snapshot) {
      return snapshot;
    }

    return {
      groupId: raw.groupId,
      name: eventPatch?.name ?? raw.groupName ?? '',
      ...(eventPatch ?? {}),
    };
  }

  /** @internal 推荐使用 groupManager.getGroup(groupId).updateInfo()。 */
  public async updateGroupInfo(params: UpdateGroupInfoParams): Promise<void> {
    return this.runOperation('updateGroupInfo', async () => {
      const context = this.getRestContextOrThrow();
      await requestUpdateGroupInfo(this.getRestClient(context), context, params);
    });
  }

  /** @internal 推荐使用 groupManager.getGroup(groupId).changeOwner()。 */
  public async changeGroupOwner(params: GroupOwnerChangeParams): Promise<void> {
    return this.runOperation('changeGroupOwner', async () => {
      const context = this.getRestContextOrThrow();
      await requestChangeGroupOwner(this.getRestClient(context), context, params);
    });
  }

  /** @internal 推荐使用 groupManager.getGroup(groupId).destroy()。 */
  public async destroyGroup(params: GroupMutationTarget): Promise<void> {
    return this.runOperation('destroyGroup', async () => {
      this.ensureRepositorySession();
      const context = this.getRestContextOrThrow();
      await requestDestroyGroup(this.getRestClient(context), context, params);
      this.clearGroupRuntime(params.groupId);
    });
  }

  /** @internal 推荐使用 groupManager.getGroup(groupId).leave()。 */
  public async leaveGroup(params: GroupMutationTarget): Promise<void> {
    return this.runOperation('leaveGroup', async () => {
      this.ensureRepositorySession();
      const context = this.getRestContextOrThrow();
      await requestLeaveGroup(this.getRestClient(context), context, params);
      this.clearGroupRuntime(params.groupId);
    });
  }

  /**
   * [zh-CN] 申请加入或直接加入指定群组，取决于群组入群审批配置。
   * [en-US] Applies to join or directly joins a group depending on the group's join joinApprovalRequired setting.
   *
   * @example [zh-CN] 加入群组 [en-US] Join a group
   * ```ts
   * await client.groupManager.joinGroup({
   *   groupId: 'group-1',
   *   message: 'Please approve my request',
   * });
   * ```
   * @param params - [zh-CN] 群组 ID 与可选申请原因。 [en-US] Group id and optional join request message.
   * @throws {ValidationError} [zh-CN] 错误码 `110`：群 ID 非法、群组不存在或已在群内。 [en-US] Error code `110`: invalid group id, group not found, or already joined.
   * @throws {SDKError} [zh-CN] 错误码 `4`：群成员数或用户加入群数量达到服务限制。 [en-US] Error code `4`: group member count or joined group count exceeds service limits.
   * @throws {AuthenticationError} [zh-CN] 错误码 `202`：鉴权失败。 [en-US] Error code `202`: authentication failed.
   * @returns {Promise<void>} [zh-CN] 成功时无返回值。 [en-US] Resolves with no payload on success.
   */
  public async joinGroup(params: GroupJoinParams): Promise<void> {
    return this.runOperation('joinGroup', async () => {
      const context = this.getRestContextOrThrow();
      await requestJoinGroup(this.getRestClient(context), context, params);
    });
  }

  /**
   * [zh-CN] 邀请用户加入指定群组。
   * [en-US] Invites users to a group.
   *
   * @example [zh-CN] 邀请成员 [en-US] Invite members
   * ```ts
   * await client.groupManager.inviteUsersToGroup({
   *   groupId: 'group-1',
   *   userIds: ['user-2', 'user-3'],
   * });
   * ```
   * @param params - [zh-CN] 群组 ID 与被邀请用户 ID 列表。 [en-US] Group id and invited user ids.
   * @throws {ValidationError} [zh-CN] 错误码 `110`：用户列表为空、用户 ID 非法或群组不存在。 [en-US] Error code `110`: empty user list, invalid user id, or group not found.
   * @throws {SDKError} [zh-CN] 错误码 `4`：群成员数量达到服务限制。 [en-US] Error code `4`: group member count exceeds service limits.
   * @throws {AuthenticationError} [zh-CN] 错误码 `202`：鉴权失败或无权限。 [en-US] Error code `202`: authentication failed or permission denied.
   * @returns {Promise<void>} [zh-CN] 成功时无返回值。 [en-US] Resolves with no payload on success.
   */
  public async inviteUsersToGroup(params: GroupUserBatchParams): Promise<void> {
    return this.runOperation('inviteUsersToGroup', async () => {
      const context = this.getRestContextOrThrow();
      await requestInviteUsersToGroup(this.getRestClient(context), context, params);
    });
  }

  /**
   * [zh-CN] 同意用户的入群申请。
   * [en-US] Accepts a user's group join request.
   *
   * @example [zh-CN] 同意入群申请 [en-US] Accept a join request
   * ```ts
   * await client.groupManager.acceptGroupJoinRequest({
   *   groupId: 'group-1',
   *   userId: 'user-2',
   * });
   * ```
   * @param params - [zh-CN] 群组 ID 与申请人用户 ID。 [en-US] Group id and applicant user id.
   * @throws {ValidationError} [zh-CN] 错误码 `110`：申请人 ID 非法、申请不存在或群组不存在。 [en-US] Error code `110`: invalid applicant id, request not found, or group not found.
   * @throws {AuthenticationError} [zh-CN] 错误码 `202`：鉴权失败或无权限。 [en-US] Error code `202`: authentication failed or permission denied.
   * @returns {Promise<void>} [zh-CN] 成功时无返回值。 [en-US] Resolves with no payload on success.
   */
  public async acceptGroupJoinRequest(params: AcceptGroupJoinRequestParams): Promise<void> {
    return this.runOperation('acceptGroupJoinRequest', async () => {
      const context = this.getRestContextOrThrow();
      await requestAcceptGroupJoinRequest(this.getRestClient(context), context, params);
    });
  }

  /**
   * [zh-CN] 拒绝用户的入群申请。
   * [en-US] Rejects a user's group join request.
   *
   * @example [zh-CN] 拒绝入群申请 [en-US] Reject a join request
   * ```ts
   * await client.groupManager.rejectGroupJoinRequest({
   *   groupId: 'group-1',
   *   userId: 'user-2',
   *   reason: 'Group is full',
   * });
   * ```
   * @param params - [zh-CN] 群组 ID、申请人用户 ID 与拒绝原因。 [en-US] Group id, applicant user id, and rejection reason.
   * @throws {ValidationError} [zh-CN] 错误码 `110`：申请人 ID、拒绝原因非法，申请不存在或群组不存在。 [en-US] Error code `110`: invalid applicant id or reason, request not found, or group not found.
   * @throws {AuthenticationError} [zh-CN] 错误码 `202`：鉴权失败或无权限。 [en-US] Error code `202`: authentication failed or permission denied.
   * @returns {Promise<void>} [zh-CN] 成功时无返回值。 [en-US] Resolves with no payload on success.
   */
  public async rejectGroupJoinRequest(params: RejectGroupJoinRequestParams): Promise<void> {
    return this.runOperation('rejectGroupJoinRequest', async () => {
      const context = this.getRestContextOrThrow();
      await requestRejectGroupJoinRequest(this.getRestClient(context), context, params);
    });
  }

  /**
   * [zh-CN] 接受当前用户收到的群组邀请。
   * [en-US] Accepts a group invitation received by the current user.
   *
   * @example [zh-CN] 接受群邀请 [en-US] Accept a group invitation
   * ```ts
   * await client.groupManager.acceptInvitation({ groupId: 'group-1' });
   * ```
   * @param params - [zh-CN] 群组 ID。 [en-US] Group id.
   * @throws {ValidationError} [zh-CN] 错误码 `110`：群 ID 非法、邀请不存在或群组不存在。 [en-US] Error code `110`: invalid group id, invitation not found, or group not found.
   * @throws {AuthenticationError} [zh-CN] 错误码 `202`：鉴权失败。 [en-US] Error code `202`: authentication failed.
   * @returns {Promise<void>} [zh-CN] 成功时无返回值。 [en-US] Resolves with no payload on success.
   */
  public async acceptInvitation(params: GroupMutationTarget): Promise<void> {
    return this.runOperation('acceptInvitation', async () => {
      const context = this.getRestContextOrThrow();
      await requestAcceptInvitation(this.getRestClient(context), context, params);
    });
  }

  /**
   * [zh-CN] 拒绝当前用户收到的群组邀请。
   * [en-US] Rejects a group invitation received by the current user.
   *
   * @example [zh-CN] 拒绝群邀请 [en-US] Reject a group invitation
   * ```ts
   * await client.groupManager.rejectInvitation({ groupId: 'group-1' });
   * ```
   * @param params - [zh-CN] 群组 ID。 [en-US] Group id.
   * @throws {ValidationError} [zh-CN] 错误码 `110`：群 ID 非法、邀请不存在或群组不存在。 [en-US] Error code `110`: invalid group id, invitation not found, or group not found.
   * @throws {AuthenticationError} [zh-CN] 错误码 `202`：鉴权失败。 [en-US] Error code `202`: authentication failed.
   * @returns {Promise<void>} [zh-CN] 成功时无返回值。 [en-US] Resolves with no payload on success.
   */
  public async rejectInvitation(params: GroupMutationTarget): Promise<void> {
    return this.runOperation('rejectInvitation', async () => {
      const context = this.getRestContextOrThrow();
      await requestRejectInvitation(this.getRestClient(context), context, params);
    });
  }

  /** @internal 推荐使用 groupManager.getGroup(groupId).getMembers()。 */
  public async getGroupMemberList(params: GroupMemberListParams): Promise<GroupMemberListResult> {
    return this.runOperation('getGroupMemberList', async () => {
      const context = this.getRestContextOrThrow();
      const result = await requestGetGroupMemberList(this.getRestClient(context), context, params);
      return {
        ...result,
        items: await this.hydrateEntriesWithUsers(result.items),
      };
    });
  }

  /** @internal 推荐使用 groupManager.getGroup(groupId).removeMembers()。 */
  public async removeGroupMembers(params: GroupUserBatchParams): Promise<void> {
    return this.runOperation('removeGroupMembers', async () => {
      const context = this.getRestContextOrThrow();
      await requestRemoveGroupMembers(this.getRestClient(context), context, params);
    });
  }

  /** @internal 推荐使用 groupManager.getGroup(groupId).getAdmins()。 */
  public async getGroupAdminList(params: GroupMutationTarget): Promise<ReadonlyArray<UserInfo>> {
    return this.runOperation('getGroupAdminList', async () => {
      const context = this.getRestContextOrThrow();
      const users = await requestGetGroupAdminList(this.getRestClient(context), context, params);
      return this.hydrateUserInfos(users);
    });
  }

  /** @internal 推荐使用 groupManager.getGroup(groupId).addAdmin()。 */
  public async addGroupAdmin(params: GroupAdminMutationParams): Promise<void> {
    return this.runOperation('addGroupAdmin', async () => {
      const context = this.getRestContextOrThrow();
      await requestAddGroupAdmin(this.getRestClient(context), context, params);
    });
  }

  /** @internal 推荐使用 groupManager.getGroup(groupId).removeAdmin()。 */
  public async removeGroupAdmin(params: GroupAdminMutationParams): Promise<void> {
    return this.runOperation('removeGroupAdmin', async () => {
      const context = this.getRestContextOrThrow();
      await requestRemoveGroupAdmin(this.getRestClient(context), context, params);
    });
  }

  /** @internal 推荐使用 groupManager.getGroup(groupId).getMuteList()。 */
  public async getGroupMuteList(
    params: GroupMuteListParams
  ): Promise<ReadonlyArray<GroupMuteEntry>> {
    return this.runOperation('getGroupMuteList', async () => {
      const context = this.getRestContextOrThrow();
      const items = await requestGetGroupMuteList(this.getRestClient(context), context, params);
      return this.hydrateEntriesWithUsers(items);
    });
  }

  /** @internal 推荐使用 groupManager.getGroup(groupId).muteMembers()。 */
  public async muteGroupMembers(params: GroupMuteMembersParams): Promise<void> {
    return this.runOperation('muteGroupMembers', async () => {
      const context = this.getRestContextOrThrow();
      await requestMuteGroupMembers(this.getRestClient(context), context, params);
    });
  }

  /** @internal 推荐使用 groupManager.getGroup(groupId).unmuteMembers()。 */
  public async unmuteGroupMembers(params: GroupUserBatchParams): Promise<void> {
    return this.runOperation('unmuteGroupMembers', async () => {
      const context = this.getRestContextOrThrow();
      await requestUnmuteGroupMembers(this.getRestClient(context), context, params);
    });
  }

  /** @internal 推荐使用 groupManager.getGroup(groupId).muteAllMembers()。 */
  public async muteAllGroupMembers(params: GroupMutationTarget): Promise<void> {
    return this.runOperation('muteAllGroupMembers', async () => {
      const context = this.getRestContextOrThrow();
      await requestMuteAllGroupMembers(this.getRestClient(context), context, params);
    });
  }

  /** @internal 推荐使用 groupManager.getGroup(groupId).unmuteAllMembers()。 */
  public async unmuteAllGroupMembers(params: GroupMutationTarget): Promise<void> {
    return this.runOperation('unmuteAllGroupMembers', async () => {
      const context = this.getRestContextOrThrow();
      await requestUnmuteAllGroupMembers(this.getRestClient(context), context, params);
    });
  }

  /** @internal 推荐使用 groupManager.getGroup(groupId).getBlocklist()。 */
  public async getGroupBlocklist(
    params: GroupBlocklistParams
  ): Promise<ReadonlyArray<GroupBlocklistEntry>> {
    return this.runOperation('getGroupBlocklist', async () => {
      const context = this.getRestContextOrThrow();
      const items = await requestGetGroupBlocklist(this.getRestClient(context), context, params);
      return this.hydrateEntriesWithUsers(items);
    });
  }

  /** @internal 推荐使用 groupManager.getGroup(groupId).blockMembers()。 */
  public async blockGroupMembers(params: GroupUserBatchParams): Promise<void> {
    return this.runOperation('blockGroupMembers', async () => {
      const context = this.getRestContextOrThrow();
      await requestBlockGroupMembers(this.getRestClient(context), context, params);
    });
  }

  /** @internal 推荐使用 groupManager.getGroup(groupId).unblockMembers()。 */
  public async unblockGroupMembers(params: GroupUserBatchParams): Promise<void> {
    return this.runOperation('unblockGroupMembers', async () => {
      const context = this.getRestContextOrThrow();
      await requestUnblockGroupMembers(this.getRestClient(context), context, params);
    });
  }

  /** @internal 推荐使用 groupManager.getGroup(groupId).getAllowlist()。 */
  public async getGroupAllowlist(
    params: GroupMutationTarget
  ): Promise<ReadonlyArray<GroupAllowlistEntry>> {
    return this.runOperation('getGroupAllowlist', async () => {
      const context = this.getRestContextOrThrow();
      const items = await requestGetGroupAllowlist(this.getRestClient(context), context, params);
      return this.hydrateEntriesWithUsers(items);
    });
  }

  /** @internal 推荐使用 groupManager.getGroup(groupId).addUsersToAllowlist()。 */
  public async addUsersToGroupAllowlist(params: GroupUserBatchParams): Promise<void> {
    return this.runOperation('addUsersToGroupAllowlist', async () => {
      const context = this.getRestContextOrThrow();
      await requestAddUsersToGroupAllowlist(this.getRestClient(context), context, params);
    });
  }

  /** @internal 推荐使用 groupManager.getGroup(groupId).removeUsersFromAllowlist()。 */
  public async removeUsersFromGroupAllowlist(params: GroupUserBatchParams): Promise<void> {
    return this.runOperation('removeUsersFromGroupAllowlist', async () => {
      const context = this.getRestContextOrThrow();
      await requestRemoveUsersFromGroupAllowlist(this.getRestClient(context), context, params);
    });
  }

  /** @internal 推荐使用 groupManager.getGroup(groupId).checkIfInAllowList()。 */
  public async checkIfInGroupAllowList(params: GroupMutationTarget): Promise<boolean> {
    return this.runOperation('checkIfInGroupAllowList', async () => {
      const context = this.getRestContextOrThrow();
      return requestCheckIfInGroupAllowList(this.getRestClient(context), context, params);
    });
  }

  /** @internal 推荐使用 groupManager.getGroup(groupId).checkIfInMuteList()。 */
  public async checkIfInGroupMuteList(params: GroupMutationTarget): Promise<boolean> {
    return this.runOperation('checkIfInGroupMuteList', async () => {
      const context = this.getRestContextOrThrow();
      return requestCheckIfInGroupMuteList(this.getRestClient(context), context, params);
    });
  }

  /** @internal 推荐使用 groupManager.getGroup(groupId).getAnnouncement()。 */
  public async getGroupAnnouncement(params: GroupMutationTarget): Promise<GroupAnnouncement> {
    return this.runOperation('getGroupAnnouncement', async () => {
      const context = this.getRestContextOrThrow();
      return requestGetGroupAnnouncement(this.getRestClient(context), context, params);
    });
  }

  /** @internal 推荐使用 groupManager.getGroup(groupId).updateAnnouncement()。 */
  public async updateGroupAnnouncement(params: GroupAnnouncementUpdateParams): Promise<void> {
    return this.runOperation('updateGroupAnnouncement', async () => {
      const context = this.getRestContextOrThrow();
      await requestUpdateGroupAnnouncement(this.getRestClient(context), context, params);
    });
  }

  /** @internal 推荐使用 groupManager.getGroup(groupId).getSharedFileList()。 */
  public async getGroupSharedFileList(
    params: GroupSharedFileListParams
  ): Promise<GroupSharedFileListResult> {
    return this.runOperation('getGroupSharedFileList', async () => {
      const context = this.getRestContextOrThrow();
      const result = await requestGetGroupSharedFileList(
        this.getRestClient(context),
        context,
        params
      );
      const ownerIds = result.items
        .map(item => item.fileOwner?.userId)
        .filter((item): item is string => typeof item === 'string' && item.length > 0);
      const ownerMap = await this.resolveUserInfoMap(ownerIds);

      return {
        ...result,
        items: result.items.map(item => ({
          ...item,
          fileOwner: item.fileOwner?.userId
            ? mergeGroupUserInfo(
                item.fileOwner,
                ownerMap.get(item.fileOwner.userId),
                item.fileOwner.userId
              )
            : item.fileOwner,
        })),
      };
    });
  }

  /** @internal 推荐使用 groupManager.getGroup(groupId).uploadSharedFile()。 */
  public async uploadGroupSharedFile(params: UploadGroupSharedFileParams): Promise<void> {
    return this.runOperation('uploadGroupSharedFile', async () => {
      const context = this.getRestContextOrThrow();
      const endpoint = buildDownloadGroupSharedFileEndpoint(context, {
        groupId: params.groupId,
        fileId: '__upload__',
      } as DownloadGroupSharedFileParams).replace(/\/share_files\/__upload__$/, '/share_files');
      const request = new XMLHttpRequest();
      request.open(
        'POST',
        `${context.restBaseUrl}${endpoint}?resource=${encodeURIComponent(context.clientResource)}`
      );
      request.setRequestHeader('Authorization', `Bearer ${context.token}`);

      const body = new FormData();
      if (params.file instanceof Blob) {
        body.append('file', params.file);
      } else {
        body.append('file', params.file as unknown as Blob);
      }
      await new Promise<void>((resolve, reject) => {
        request.upload.onprogress = params.onFileUploadProgress ?? null;
        request.onload = (): void => {
          params.onFileUploadComplete?.(request.responseText);
          resolve();
        };
        request.onerror = (): void => {
          params.onFileUploadError?.(request.responseText);
          reject(new Error('group shared file upload failed'));
        };
        request.onabort = (): void => {
          params.onFileUploadCanceled?.();
          reject(new Error('group shared file upload aborted'));
        };
        request.send(body);
      });
    });
  }

  /** @internal 推荐使用 groupManager.getGroup(groupId).deleteSharedFile()。 */
  public async deleteGroupSharedFile(params: DeleteGroupSharedFileParams): Promise<void> {
    return this.runOperation('deleteGroupSharedFile', async () => {
      const context = this.getRestContextOrThrow();
      await requestDeleteGroupSharedFile(this.getRestClient(context), context, params);
    });
  }

  /** @internal 推荐使用 groupManager.getGroup(groupId).downloadSharedFile()。 */
  public async downloadGroupSharedFile(params: DownloadGroupSharedFileParams): Promise<void> {
    return this.runOperation('downloadGroupSharedFile', async () => {
      const context = this.getRestContextOrThrow();
      const endpoint = `${context.restBaseUrl}${buildDownloadGroupSharedFileEndpoint(context, params)}`;
      const response = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${context.token}`,
        },
      });
      if (!response.ok) {
        throw new SDKError('downloadGroupSharedFile failed', ERROR_CODES.REST_HTTP_ERROR);
      }
      const blob = await response.blob();
      params.onFileDownloadComplete?.(blob);
    });
  }

  /** @internal 推荐使用 groupManager.getGroup(groupId).setMemberAttributes()。 */
  public async setGroupMemberAttributes(params: SetGroupMemberAttributesParams): Promise<void> {
    return this.runOperation('setGroupMemberAttributes', async () => {
      const context = this.getRestContextOrThrow();
      const response = await requestSetGroupMemberAttributes(
        this.getRestClient(context),
        context,
        params
      );
      this.writeSelfGroupNamecardCache(context.userId, params, response);
    });
  }

  /** @internal 推荐使用 groupManager.getGroup(groupId).getMembersAttributes()。 */
  public async getGroupMembersAttributes(
    params: GetGroupMembersAttributesParams
  ): Promise<GroupMembersAttributesResult> {
    return this.runOperation('getGroupMembersAttributes', async () => {
      const context = this.getRestContextOrThrow();
      return requestGetGroupMembersAttributes(this.getRestClient(context), context, params);
    });
  }

  public async hydrateMessageProfileGroupNamecards(
    groupId: string,
    targets: ReadonlyArray<GroupNamecardHydrationTarget>
  ): Promise<void> {
    if (targets.length === 0) {
      return;
    }

    await this.runOperation('hydrateMessageProfileGroupNamecards', async () => {
      const context = this.getRestContextOrThrow();
      const userIds = targets.map(item => item.userId);
      const result = await requestGetGroupNamecards(this.getRestClient(context), context, {
        groupId,
        userIds,
      });

      const targetVersionMap = new Map(
        targets.map(item => [item.userId, item.namecardUpdateTime] as const)
      );
      const records: GroupNamecardCacheRecord[] = [];
      const fetchedUserIds = new Set<string>();
      for (const [userId, value] of Object.entries(result.items)) {
        fetchedUserIds.add(userId);
        records.push({
          groupId,
          userId,
          namecard: value.namecard,
          namecardUpdateTime: targetVersionMap.get(userId) ?? value.namecardUpdateTime,
          lastSyncAt: Date.now(),
          lastAccess: Date.now(),
          lastUpdate: Date.now(),
        });
      }

      const missingUserIds = userIds.filter(userId => !fetchedUserIds.has(userId));
      if (missingUserIds.length > 0 && typeof result.responseTimestamp === 'number') {
        records.push(
          ...missingUserIds.map(userId => ({
            groupId,
            userId,
            namecard: '',
            namecardUpdateTime: result.responseTimestamp,
            lastSyncAt: Date.now(),
            lastAccess: Date.now(),
            lastUpdate: Date.now(),
          }))
        );
      }

      this.getCacheManager()?.setGroupNamecards(records);

      for (const record of records) {
        if (record.userId === context.userId || record.namecard === '') {
          continue;
        }
        this.eventContext?.dispatch?.(GroupEventName.USER_GROUP_NAMECARD_UPDATED, {
          groupId: record.groupId,
          userId: record.userId,
          namecard: record.namecard,
        });
      }

      if (missingUserIds.length > 0 && typeof result.responseTimestamp !== 'number') {
        logger.warn('Group namecard hydration returned partial result', {
          groupId,
          requestedUserIds: userIds,
          missingUserIds,
        });
      }
    });
  }

  private async runOperation<T>(name: string, operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const sdkError = this.normalizeSdkError(name, error);
      logger.warn(`GroupManager ${name} failed`, {
        code: sdkError.code,
        message: sdkError.message,
        details: sdkError.details,
      });
      throw sdkError;
    }
  }

  private normalizeSdkError(name: string, error: unknown): SDKError {
    if (error instanceof SDKError) {
      return error;
    }
    if (error instanceof Error) {
      return new SDKError(`GroupManager ${name} failed: ${error.message}`, ERROR_CODES.UNKNOWN);
    }
    return new SDKError(`GroupManager ${name} failed`, ERROR_CODES.UNKNOWN);
  }

  private getRestContextOrThrow(): RestContext {
    return this.requireClient().getRestContext();
  }

  private getRestClient(context: RestContext): RestClient {
    if (
      this.restClient &&
      this.restBaseUrl === context.restBaseUrl &&
      this.restToken === context.token
    ) {
      return this.restClient;
    }

    this.restClient = new RestClient(context.restBaseUrl, { errorMap: GROUP_REST_ERROR_MAP });
    this.restClient.setAuthToken(context.token);
    this.restBaseUrl = context.restBaseUrl;
    this.restToken = context.token;
    return this.restClient;
  }

  private requireClient(): ChatClient {
    if (!this.client) {
      throw new SDKError('GroupManager is not bound to client', ERROR_CODES.VALIDATION_REQUIRED);
    }
    return this.client;
  }

  private getGroupRepository(): GroupRepository {
    if (!this.groupRepository) {
      this.groupRepository = new GroupRepository();
    }
    return this.groupRepository;
  }

  private getGroupEventSync(): GroupEventSync {
    if (!this.groupEventSync) {
      this.groupEventSync = new GroupEventSync(this.getGroupRepository());
    }
    return this.groupEventSync;
  }

  private ensureRepositorySession(): void {
    const sessionChanged = this.getGroupRepository().ensureSession(
      this.resolveRepositorySessionKey()
    );
    if (sessionChanged) {
      this.groupRegistry.clear();
    }
  }

  private resolveRepositorySessionKey(): string | null {
    if (!this.client) {
      return null;
    }

    const currentUserId = this.client.getCurrentUserId();
    if (!currentUserId) {
      return null;
    }

    try {
      const context = this.client.getRestContext();
      return `${context.restBaseUrl}:${context.userId}:${context.token}:${context.clientResource}`;
    } catch {
      return `pending:${currentUserId}`;
    }
  }

  private getCacheManager(): CacheManager | null {
    return this.client?.getCacheManager() ?? null;
  }

  private loadJoinedGroupPreviewSnapshot(): JoinedGroupSnapshot | undefined {
    const cacheManager = this.getCacheManager();
    if (
      !cacheManager ||
      typeof cacheManager.loadJoinedGroupPreviewSnapshot !== 'function'
    ) {
      return undefined;
    }
    return cacheManager.loadJoinedGroupPreviewSnapshot();
  }

  private writeSelfGroupNamecardCache(
    currentUserId: string,
    params: SetGroupMemberAttributesParams,
    response: unknown
  ): void {
    if (params.userId !== currentUserId) {
      return;
    }
    const namecard = this.extractGroupNamecard(params.memberAttributes);
    if (typeof namecard !== 'string') {
      return;
    }
    const namecardUpdateTime = this.resolveGroupMemberAttributesUpdateTime(response, params.userId);
    if (typeof namecardUpdateTime !== 'number') {
      logger.warn('Group member attributes update response missing server update time', {
        groupId: params.groupId,
        userId: params.userId,
      });
    }
    this.getCacheManager()?.setGroupNamecards([
      {
        groupId: params.groupId,
        userId: params.userId,
        namecard,
        namecardUpdateTime,
        lastSyncAt: Date.now(),
        lastAccess: Date.now(),
        lastUpdate: Date.now(),
      },
    ]);
  }

  private resolveGroupMemberAttributesUpdateTime(
    response: unknown,
    userId: string
  ): number | undefined {
    const candidates: unknown[] = [];
    this.collectUpdateTimeCandidates(response, userId, candidates);
    for (const candidate of candidates) {
      const normalized = normalizeProfileVersionFromTimestamp(
        typeof candidate === 'number' ? candidate : Number(candidate)
      );
      if (typeof normalized === 'number') {
        return normalized;
      }
    }
    return undefined;
  }

  private collectUpdateTimeCandidates(value: unknown, userId: string, candidates: unknown[]): void {
    if (!isRecord(value)) {
      return;
    }
    candidates.push(
      value.lastModified,
      value.last_modified,
      value.timestamp,
      value.updateTime,
      value.update_time,
      value.updatedAt,
      value.updated_at
    );
    const data = value.data;
    if (isRecord(data)) {
      this.collectUpdateTimeCandidates(data, userId, candidates);
      const userRecord = data[userId];
      if (isRecord(userRecord)) {
        this.collectUpdateTimeCandidates(userRecord, userId, candidates);
      }
    }
    const lastModified = value.lastModified ?? value.last_modified;
    if (isRecord(lastModified)) {
      candidates.push(lastModified[userId]);
    }
  }

  private getUserInfoManager(): UserInfoReadCapability | null {
    const client = this.requireClient();
    if (!this.hasUserInfoCapabilityProvider(client)) {
      return null;
    }
    const manager = client.getManagerByCapability('userInfo:read');
    if (!manager || !this.hasUserInfoReadCapability(manager)) {
      return null;
    }
    return manager;
  }

  private hasUserInfoCapabilityProvider(
    client: ChatClient
  ): client is ChatClient & UserInfoCapabilityProvider {
    return (
      typeof (client as { getManagerByCapability?: unknown }).getManagerByCapability === 'function'
    );
  }

  private hasUserInfoReadCapability(
    manager: ManagerBase<ChatClient>
  ): manager is UserInfoReadCapability {
    return (
      typeof (manager as { getUserInfoByUserId?: unknown }).getUserInfoByUserId === 'function'
    );
  }

  private async resolveUserInfoMap(
    userIds: ReadonlyArray<string>
  ): Promise<ReadonlyMap<string, UserInfo>> {
    return resolveGroupUserInfoMap(userIds, {
      cacheManager: this.getCacheManager(),
      fetchUserInfos: async ({ userIds: targets }): Promise<ReadonlyArray<UserInfo>> => {
        const manager = this.getUserInfoManager();
        if (targets.length === 0) {
          return [];
        }
        if (!manager) {
          return await this.fetchUserInfosFromRest(targets);
        }
        try {
          return await manager.getUserInfoByUserId({
            userIds: targets,
          });
        } catch (error) {
          logger.warn('GroupManager user info fetch failed', {
            userIds: targets,
            error,
          });
          return [];
        }
      },
    });
  }

  private collectEventUserIds(rawEvent: GroupRawNotifyEvent): ReadonlyArray<string> {
    const raw = rawEvent.payload;
    const candidates = [
      raw.inviterId,
      raw.applicantId,
      raw.accepterId,
      raw.declinerId,
      raw.inviteeId,
      raw.administratorId,
      raw.oldOwnerId,
      raw.newOwnerId,
      raw.userId,
      raw.sharedFile?.fileOwner?.userId,
      ...(raw.memberIds ?? []),
      ...(raw.userIds ?? []),
    ];

    const result: string[] = [];
    const seen = new Set<string>();
    for (const candidate of candidates) {
      if (typeof candidate !== 'string') {
        continue;
      }
      const normalized = candidate.trim();
      if (!normalized || seen.has(normalized)) {
        continue;
      }
      seen.add(normalized);
      result.push(normalized);
    }
    return result;
  }

  private pickEventUser(
    userId: string | undefined,
    userInfoMap: ReadonlyMap<string, UserInfo>
  ): UserInfo | undefined {
    if (!userId) {
      return undefined;
    }
    return mergeGroupUserInfo(undefined, userInfoMap.get(userId), userId);
  }

  private pickEventUsers(
    userIds: ReadonlyArray<string> | undefined,
    userInfoMap: ReadonlyMap<string, UserInfo>
  ): ReadonlyArray<UserInfo> {
    const normalizedUserIds = userIds ?? [];
    return normalizedUserIds.map(userId =>
      mergeGroupUserInfo(undefined, userInfoMap.get(userId), userId)
    );
  }

  private hydrateEventSharedFile(
    sharedFile: GroupSharedFile | undefined,
    userInfoMap: ReadonlyMap<string, UserInfo>
  ): GroupSharedFile | undefined {
    if (!sharedFile?.fileOwner?.userId) {
      return sharedFile;
    }

    return {
      ...sharedFile,
      fileOwner: mergeGroupUserInfo(
        sharedFile.fileOwner,
        userInfoMap.get(sharedFile.fileOwner.userId),
        sharedFile.fileOwner.userId
      ),
    };
  }

  private syncRuntimeForEvent(
    eventName: GroupEventNameType,
    raw: GroupRawNotifyPayload,
    userInfoMap: ReadonlyMap<string, UserInfo>
  ): void {
    switch (eventName) {
      case GroupEventName.ALL_MEMBER_MUTE_STATE_CHANGED:
        this.getGroupEventSync().applyPatch({
          groupId: raw.groupId,
          groupName: raw.groupName,
          groupPatch: {
            muteAllMembers: Boolean(raw.isMuted),
          },
        });
        return;
      case GroupEventName.OWNER_CHANGED:
        this.getGroupEventSync().applyPatch({
          groupId: raw.groupId,
          groupName: raw.groupName,
          groupPatch: {
            owner: this.pickEventUser(raw.newOwnerId, userInfoMap),
          },
        });
        return;
      case GroupEventName.MEMBERS_JOINED:
        if (
          this.applyMemberCountDeltaPatch(
            raw.groupId,
            raw.groupName,
            this.getMemberEventDeltaCount(eventName, raw)
          )
        ) {
          return;
        }
        this.getGroupEventSync().applyPatch({
          groupId: raw.groupId,
          groupName: raw.groupName,
          shouldMarkStale: true,
        });
        return;
      case GroupEventName.MEMBERS_EXITED:
        if (
          this.applyMemberCountDeltaPatch(
            raw.groupId,
            raw.groupName,
            -this.getMemberEventDeltaCount(eventName, raw)
          )
        ) {
          return;
        }
        this.getGroupEventSync().applyPatch({
          groupId: raw.groupId,
          groupName: raw.groupName,
          shouldMarkStale: true,
        });
        return;
      case GroupEventName.USER_REMOVED:
      case GroupEventName.GROUP_DESTROYED:
        this.clearGroupRuntime(raw.groupId);
        return;
      case GroupEventName.MUTE_LIST_ADDED:
      case GroupEventName.MUTE_LIST_REMOVED:
      case GroupEventName.ALLOW_LIST_ADDED:
      case GroupEventName.ALLOW_LIST_REMOVED:
      case GroupEventName.ADMIN_ADDED:
      case GroupEventName.ADMIN_REMOVED:
        this.getGroupEventSync().applyPatch({
          groupId: raw.groupId,
          groupName: raw.groupName,
          shouldMarkStale: true,
        });
        return;
      default:
        return;
    }
  }

  private getMemberEventDeltaCount(
    eventName: GroupEventNameType,
    raw: GroupRawNotifyPayload
  ): number {
    switch (eventName) {
      case GroupEventName.MEMBERS_JOINED:
      case GroupEventName.MEMBERS_EXITED:
        return raw.memberIds?.length ?? 0;
      default:
        return 0;
    }
  }

  private applyMemberCountDeltaPatch(
    groupId: string,
    groupName: string | undefined,
    delta: number
  ): boolean {
    if (delta === 0) {
      return false;
    }

    const current = this.getGroupRepository().getDetailSnapshot(groupId);
    if (!current || typeof current.memberCount !== 'number') {
      return false;
    }

    this.getGroupEventSync().applyPatch({
      groupId,
      groupName,
      groupPatch: {
        memberCount: Math.max(0, current.memberCount + delta),
      },
    });
    return true;
  }

  private clearGroupRuntime(groupId: string): void {
    this.getGroupRepository().delete(groupId);
  }

  private async hydrateUserInfos(users: ReadonlyArray<UserInfo>): Promise<ReadonlyArray<UserInfo>> {
    return resolveGroupUserInfos(
      users.map(item => item.userId),
      {
        cacheManager: this.getCacheManager(),
        fetchUserInfos: async ({ userIds }): Promise<ReadonlyArray<UserInfo>> => {
          const manager = this.getUserInfoManager();
          if (userIds.length === 0) {
            return [];
          }
          if (!manager) {
            return await this.fetchUserInfosFromRest(userIds);
          }
          try {
            return await manager.getUserInfoByUserId({ userIds });
          } catch (error) {
            logger.warn('GroupManager hydrate users failed', { userIds, error });
            return [];
          }
        },
      }
    );
  }

  private async fetchUserInfosFromRest(
    userIds: ReadonlyArray<string>
  ): Promise<ReadonlyArray<UserInfo>> {
    const context = this.getRestContextOrThrow();
    const requestBody = buildFetchUserInfoByUserIdRequest(userIds);
    const response = await this.getRestClient(context).request<unknown>(
      buildUserInfoFetchEndpoint(context),
      {
        method: 'POST',
        body: requestBody,
        operation: 'getUserInfoByUserId',
      }
    );
    return normalizeFetchedUserInfos(response, requestBody.targets);
  }

  private async hydrateEntriesWithUsers<T extends GroupItemWithUser>(
    items: GroupItemArrayWithUser<T>
  ): Promise<ReadonlyArray<T>> {
    const userIds = items.map(item => item.user.userId);
    const userInfoMap = await this.resolveUserInfoMap(userIds);

    return items.map(item => ({
      ...item,
      user: mergeGroupUserInfo(item.user, userInfoMap.get(item.user.userId), item.user.userId),
    }));
  }

  private extractGroupNamecard(attributes: Readonly<Record<string, string>>): string | undefined {
    return (
      attributes.groupNamecard ??
      attributes.group_namecard ??
      attributes.group_name_card ??
      attributes.namecard
    );
  }

  private async hydrateGroupDetailUsers(group: GroupDetail): Promise<GroupDetail> {
    if (!group.owner?.userId) {
      return group;
    }
    const userInfoMap = await this.resolveUserInfoMap([group.owner.userId]);
    return {
      ...group,
      owner: mergeGroupUserInfo(
        group.owner,
        userInfoMap.get(group.owner.userId),
        group.owner.userId
      ),
    };
  }

  /** @internal */
  public createSyncController(deps: GroupSyncControllerDependencies): GroupSyncController {
    return new GroupSyncController(deps);
  }
}
