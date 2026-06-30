/**
 * [zh-CN] ChatRoomManager 对外管理器实现。
 * [en-US] Public ChatRoomManager implementation.
 */

import type { ChatClient } from '../chat-client';
import { RestClient } from '../rest/client';
import { mergeRuntimeErrorMaps } from '../rest/error-map-types';
import { CHATROOM_ERROR_MAP } from '../rest/error-maps/chatroom';
import { COMMON_ERROR_MAP } from '../rest/error-maps/common';
import type { RestContext } from '../types/chat-client';
import { ChatRoomDispatchEventName, type EventHandlerId } from '../types/event-system';
import type { ManagerBase, ManagerEventContext, RawNotifyEvent } from '../types/manager';
import type {
  ChatRoomAdminParams,
  ChatRoomAnnouncement,
  ChatRoomAnnouncementUpdateParams,
  ChatRoomAttributeMutationResult,
  ChatRoomAttributesSnapshot,
  ChatRoomBlocklistEntry,
  ChatRoomBlocklistParams,
  ChatRoomDetail,
  ChatRoomEventName as ChatRoomEventNameType,
  ChatRoomEventHandlerMap,
  ChatRoomEventPayloadMap,
  ChatRoomMemberActionListResult,
  ChatRoomMemberListParams,
  ChatRoomMemberListResult,
  ChatRoomMuteEntry,
  ChatRoomMuteListParams,
  ChatRoomMuteMembersParams,
  ChatRoomMuteStatus,
  ChatRoomMutationTarget,
  ChatRoomRawNotifyEvent,
  ChatRoomRawNotifyPayload,
  ChatRoomSummary,
  ChatRoomUpdateResult,
  ChatRoomUserBatchParams,
  GetChatRoomAttributesParams,
  GetChatRoomInfoParams,
  GetChatRoomListParams,
  JoinChatRoomParams,
  RemoveChatRoomAttributesParams,
  SetChatRoomAttributesParams,
  UpdateChatRoomInfoParams,
} from '../types/chatroom';
import type { UserInfo } from '../types/user-info';
import { ERROR_CODES } from '../utils/error-codes';
import { SDKError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';
import {
  requestAddUsersToChatRoomAllowlist,
  requestBlockChatRoomMembers,
  requestGetChatRoomAdminList,
  requestGetChatRoomAllowlist,
  requestGetChatRoomAnnouncement,
  requestGetChatRoomAttributes,
  requestGetChatRoomBlocklist,
  requestGetChatRoomInfo,
  requestGetChatRoomList,
  requestGetChatRoomMemberList,
  requestGetChatRoomMuteList,
  requestCheckIfInChatRoomMuteList,
  requestCheckIfInChatRoomAllowList,
  normalizeChatRoomId,
  requestMuteAllChatRoomMembers,
  requestMuteChatRoomMembers,
  requestRemoveChatRoomAdmin,
  requestRemoveChatRoomAttributes,
  requestRemoveChatRoomMembers,
  requestRemoveUsersFromChatRoomAllowlist,
  requestSetChatRoomAdmin,
  requestSetChatRoomAttributes,
  requestUnblockChatRoomMembers,
  requestUnmuteAllChatRoomMembers,
  requestUnmuteChatRoomMembers,
  requestUpdateChatRoomAnnouncement,
  requestUpdateChatRoomInfo,
} from '../rest/chatroom-management';
import {
  buildFetchUserInfoByUserIdRequest,
  buildUserInfoFetchEndpoint,
  normalizeFetchedUserInfos,
} from '../rest/user-info';
import {
  mergeChatRoomUserInfo,
  resolveChatRoomUserInfoMap,
  resolveChatRoomUserInfos,
} from './chatroom/chatroom-event-user-info-resolver';
import { ChatRoom } from './chatroom/chatroom';
import type { CacheManager } from '../cache/cache-manager';

type ItemWithUser = {
  readonly user: UserInfo;
};

interface UserInfoReadCapability extends ManagerBase<ChatClient> {
  getUserInfoByUserId(params: {
    readonly userIds: ReadonlyArray<string>;
  }): Promise<ReadonlyArray<UserInfo>>;
}

interface UserInfoCapabilityProvider {
  getManagerByCapability(capability: 'userInfo:read'): ManagerBase<ChatClient> | null;
}

const CHATROOM_HANDLER_EVENT_MAP = {
  onChatRoomDestroyed: ChatRoomDispatchEventName.CHAT_ROOM_DESTROYED,
  onMembersJoined: ChatRoomDispatchEventName.MEMBERS_JOINED,
  onMembersExited: ChatRoomDispatchEventName.MEMBERS_EXITED,
  onRemovedFromChatRoom: ChatRoomDispatchEventName.REMOVED_FROM_CHAT_ROOM,
  onMuteListAdded: ChatRoomDispatchEventName.MUTE_LIST_ADDED,
  onMuteListRemoved: ChatRoomDispatchEventName.MUTE_LIST_REMOVED,
  onAllowListAdded: ChatRoomDispatchEventName.ALLOW_LIST_ADDED,
  onAllowListRemoved: ChatRoomDispatchEventName.ALLOW_LIST_REMOVED,
  onAllMemberMuteStateChanged: ChatRoomDispatchEventName.ALL_MEMBER_MUTE_STATE_CHANGED,
  onAdminAdded: ChatRoomDispatchEventName.ADMIN_ADDED,
  onAdminRemoved: ChatRoomDispatchEventName.ADMIN_REMOVED,
  onOwnerChanged: ChatRoomDispatchEventName.OWNER_CHANGED,
  onAnnouncementChanged: ChatRoomDispatchEventName.ANNOUNCEMENT_CHANGED,
  onChatRoomInfoChanged: ChatRoomDispatchEventName.CHAT_ROOM_INFO_CHANGED,
  onAttributesUpdate: ChatRoomDispatchEventName.ATTRIBUTES_UPDATE,
  onAttributesRemoved: ChatRoomDispatchEventName.ATTRIBUTES_REMOVED,
} as const;

const CHATROOM_REST_ERROR_MAP = mergeRuntimeErrorMaps(COMMON_ERROR_MAP, CHATROOM_ERROR_MAP);

export class ChatRoomManager implements ManagerBase<ChatClient> {
  /** @internal SDK 内部管理器注册键，不对外文档暴露。 */
  public static readonly key = 'chatRoomManager' as const;
  /** @internal SDK 内部 raw notify 能力声明，不作为公开 API 使用。 */
  public readonly capabilities = ['rawNotify:chatroom'] as const;

  private client: ChatClient | null = null;
  private eventContext: ManagerEventContext | null = null;
  private restClient: RestClient | null = null;
  private restBaseUrl: string | null = null;
  private restToken: string | null = null;
  private readonly chatRoomRegistry = new Map<string, ChatRoom>();

  /**
   * @internal
   * [zh-CN] 绑定 ChatRoomManager 到 ChatClient，通常由 SDK 内部在 `client.chatRoomManager` 初始化阶段调用。
   * [en-US] Binds ChatRoomManager to ChatClient and is usually called internally during `client.chatRoomManager` initialization.
   */
  public bind(client: ChatClient, context?: ManagerEventContext): void {
    this.client = client;
    this.eventContext = context ?? null;
  }

  /**
   * [zh-CN] 注册聊天室事件处理器，事件包括成员进出、禁言、allowlist、公告和属性变更等。
   * [en-US] Registers chat room event handlers, including member, mute, allowlist, announcement, and attribute changes.
   *
   * @example [zh-CN] 调用示例（监听聊天室成员加入） [en-US] Usage example (listen for members joined)
   * ```ts
   * client.chatRoomManager.addEventHandler('chatroom-ui', {
   *   onMembersJoined: event => {
   *     console.log(event.chatRoomId, event.members);
   *   },
   * });
   * ```
   * @param id - [zh-CN] 事件处理器唯一 ID，用于后续移除。 [en-US] Unique handler ID used for later removal.
   * @param handlers - [zh-CN] 聊天室事件处理器集合，可只实现需要监听的回调。 [en-US] Chat room event handler map; implement only callbacks you need.
   * @throws {ValidationError} [zh-CN] 错误码 `110`：事件上下文未绑定。解决方式：先完成 SDK 初始化并注册 ChatRoomManager。 [en-US] Error code `110`: event context is not bound. Initialize the SDK and register ChatRoomManager first.
   * @returns {void} [zh-CN] 注册完成后无返回值。 [en-US] Returns nothing after registration.
   */
  public addEventHandler(id: EventHandlerId, handlers: ChatRoomEventHandlerMap): void {
    const mappedHandlers = Object.fromEntries(
      Object.entries(handlers).flatMap(([eventName, handler]) => {
        const targetEventName =
          CHATROOM_HANDLER_EVENT_MAP[eventName as keyof typeof CHATROOM_HANDLER_EVENT_MAP];
        if (!targetEventName || !handler) {
          return [];
        }
        return [[targetEventName, handler]];
      })
    );

    this.eventContext?.addEventHandler(id, mappedHandlers as never);
  }

  /**
   * [zh-CN] 移除指定 ID 的聊天室事件处理器。
   * [en-US] Removes the chat room event handler registered with the given ID.
   *
   * @example [zh-CN] 调用示例（移除监听） [en-US] Usage example (remove a listener)
   * ```ts
   * client.chatRoomManager.removeEventHandler('chatroom-ui');
   * ```
   * @param id - [zh-CN] 待移除的事件处理器 ID。 [en-US] Handler ID to remove.
   * @throws {ValidationError} [zh-CN] 错误码 `110`：事件上下文未绑定。解决方式：先完成 SDK 初始化并注册 ChatRoomManager。 [en-US] Error code `110`: event context is not bound. Initialize the SDK and register ChatRoomManager first.
   * @returns {void} [zh-CN] 移除完成后无返回值。 [en-US] Returns nothing after removal.
   */
  public removeEventHandler(id: EventHandlerId): void {
    this.eventContext?.removeEventHandler(id);
  }

  /** @internal */
  public async handleRawNotify(event: RawNotifyEvent): Promise<void> {
    if (event.type !== 'chatroom') {
      return;
    }
    const payload = event.payload as ChatRoomRawNotifyEvent;
    const normalized = await this.buildIncomingEventPayload(payload.eventName, payload);
    if (!normalized) {
      return;
    }
    const dispatchName = CHATROOM_HANDLER_EVENT_MAP[payload.eventName];
    if (dispatchName) {
      this.eventContext?.dispatch?.(dispatchName, normalized as never);
    }
  }

  /** @internal 推荐由 ChatClient 的聊天室事件分发链路调用。 */
  public async buildIncomingEventPayload(
    eventName: ChatRoomEventNameType,
    rawEvent: ChatRoomRawNotifyEvent
  ): Promise<ChatRoomEventPayloadMap[ChatRoomEventNameType] | null> {
    const raw = rawEvent.payload;
    const userInfoMap = await this.resolveUserInfoMap(this.collectEventUserIds(rawEvent));

    switch (eventName) {
      case 'onChatRoomDestroyed':
        return {
          chatRoomId: raw.chatRoomId,
          chatRoomName: raw.chatRoomName,
        } as ChatRoomEventPayloadMap[ChatRoomEventNameType];
      case 'onMembersJoined':
        return {
          chatRoomId: raw.chatRoomId,
          chatRoomName: raw.chatRoomName,
          members: this.pickEventUsers(
            raw.memberIds ?? (raw.memberId ? [raw.memberId] : []),
            userInfoMap
          ),
          ext: raw.ext,
        } as ChatRoomEventPayloadMap[ChatRoomEventNameType];
      case 'onMembersExited':
        return {
          chatRoomId: raw.chatRoomId,
          chatRoomName: raw.chatRoomName,
          members: this.pickEventUsers(
            raw.memberIds ?? (raw.memberId ? [raw.memberId] : []),
            userInfoMap
          ),
        } as ChatRoomEventPayloadMap[ChatRoomEventNameType];
      case 'onRemovedFromChatRoom':
        return {
          reason: raw.reasonCode ?? 0,
          chatRoomId: raw.chatRoomId,
          chatRoomName: raw.chatRoomName,
          participant: this.pickEventUser(raw.participantId, userInfoMap),
        } as ChatRoomEventPayloadMap[ChatRoomEventNameType];
      case 'onMuteListAdded':
        return {
          chatRoomId: raw.chatRoomId,
          mutes: this.pickEventMuteEntries(raw.userIds, raw.muteExpire, userInfoMap),
          muteExpire: raw.muteExpire,
        } as ChatRoomEventPayloadMap[ChatRoomEventNameType];
      case 'onMuteListRemoved':
        return {
          chatRoomId: raw.chatRoomId,
          mutes: this.pickEventUsers(raw.userIds, userInfoMap),
        } as ChatRoomEventPayloadMap[ChatRoomEventNameType];
      case 'onAllowListAdded':
        return {
          chatRoomId: raw.chatRoomId,
          allowlist: this.pickEventUsers(raw.userIds, userInfoMap),
        } as ChatRoomEventPayloadMap[ChatRoomEventNameType];
      case 'onAllowListRemoved':
        return {
          chatRoomId: raw.chatRoomId,
          allowlist: this.pickEventUsers(raw.userIds, userInfoMap),
        } as ChatRoomEventPayloadMap[ChatRoomEventNameType];
      case 'onAllMemberMuteStateChanged':
        return {
          chatRoomId: raw.chatRoomId,
          isMuted: Boolean(raw.isMuted),
        } as ChatRoomEventPayloadMap[ChatRoomEventNameType];
      case 'onAdminAdded':
        return {
          chatRoomId: raw.chatRoomId,
          admin: this.pickEventUser(raw.adminId, userInfoMap),
        } as ChatRoomEventPayloadMap[ChatRoomEventNameType];
      case 'onAdminRemoved':
        return {
          chatRoomId: raw.chatRoomId,
          admin: this.pickEventUser(raw.adminId, userInfoMap),
        } as ChatRoomEventPayloadMap[ChatRoomEventNameType];
      case 'onOwnerChanged':
        return {
          chatRoomId: raw.chatRoomId,
          newOwner: this.pickEventUser(raw.newOwnerId, userInfoMap),
          oldOwner: this.pickEventUser(raw.oldOwnerId, userInfoMap),
        } as ChatRoomEventPayloadMap[ChatRoomEventNameType];
      case 'onAnnouncementChanged':
        return {
          chatRoomId: raw.chatRoomId,
          announcement: raw.announcement ?? '',
        } as ChatRoomEventPayloadMap[ChatRoomEventNameType];
      case 'onChatRoomInfoChanged':
        return {
          chatRoomId: raw.chatRoomId,
          chatRoomInfo: await this.resolveChatRoomDetailForEvent(raw),
        } as ChatRoomEventPayloadMap[ChatRoomEventNameType];
      case 'onAttributesUpdate':
        return {
          chatRoomId: raw.chatRoomId,
          attributes: raw.attributes ?? {},
          from: this.pickEventUser(raw.from, userInfoMap),
        } as ChatRoomEventPayloadMap[ChatRoomEventNameType];
      case 'onAttributesRemoved':
        return {
          chatRoomId: raw.chatRoomId,
          keyList: raw.keyList ?? [],
          from: this.pickEventUser(raw.from, userInfoMap),
        } as ChatRoomEventPayloadMap[ChatRoomEventNameType];
      default:
        return null;
    }
  }

  /**
   * [zh-CN] 分页获取公开聊天室列表，并尽量补齐聊天室所有者资料。
   * [en-US] Gets the public chat room list by page and hydrates owner profiles when possible.
   *
   * @example [zh-CN] 调用示例（获取第一页聊天室） [en-US] Usage example (get first page)
   * ```ts
   * const result = await client.chatRoomManager.getChatRoomList({
   *   pageNum: 1,
   *   pageSize: 20,
   * });
   * ```
   * @param params - [zh-CN] 分页参数；`pageNum` 从 1 开始，`pageSize` 未传时使用服务端默认值。 [en-US] Pagination parameters; `pageNum` starts from 1 and `pageSize` uses the server default when omitted.
   * @operation getChatRoomList
   * @throws {SDKError} [zh-CN] REST 请求失败或登录态不可用时抛出统一 SDK 错误。 [en-US] Throws a normalized SDK error when the REST request fails or login state is unavailable.
   * @returns {Promise<ChatRoomListResult>} [zh-CN] 返回聊天室摘要列表与分页信息。 [en-US] Returns chat room summaries and pagination information.
   */
  public async getChatRoomList(params: GetChatRoomListParams = {}): Promise<{
    readonly items: ReadonlyArray<ChatRoomSummary>;
    readonly pageNum?: number;
    readonly pageSize?: number;
    readonly total?: number;
    readonly hasMore?: boolean;
  }> {
    return this.runOperation('getChatRoomList', async () => {
      const context = this.getRestContextOrThrow();
      const result = await requestGetChatRoomList(this.getRestClient(context), context, params);
      return {
        ...result,
        items: await this.hydrateSummaryOwners(result.items),
      };
    });
  }

  /**
   * [zh-CN] 获取绑定指定 `chatRoomId` 的单聊天室对象，便于后续在对象上调用成员、公告、属性等方法。
   * [en-US] Gets a single-chatroom object bound to the given `chatRoomId` for member, announcement, attribute, and other operations.
   *
   * @example [zh-CN] 调用示例（获取聊天室对象） [en-US] Usage example (get a chat room object)
   * ```ts
   * const chatRoom = client.chatRoomManager.getChatRoom('chatroom-1');
   * const detail = await chatRoom.getInfo();
   * ```
   * @param chatRoomId - [zh-CN] 聊天室 ID，必填且不能为空字符串。 [en-US] Required chat room ID; must not be an empty string.
   * @throws {ValidationError} [zh-CN] 错误码 `110`：`chatRoomId` 为空。解决方式：传入有效聊天室 ID。 [en-US] Error code `110`: `chatRoomId` is empty. Pass a valid chat room ID.
   * @returns {ChatRoom} [zh-CN] 返回复用的单聊天室对象。 [en-US] Returns a reusable single-chatroom object.
   */
  public getChatRoom(chatRoomId: string): ChatRoom {
    this.requireClient();
    const normalizedChatRoomId = chatRoomId.trim();
    if (normalizedChatRoomId.length === 0) {
      throw new ValidationError('chatRoomId is required', {
        code: ERROR_CODES.VALIDATION_REQUIRED,
        details: {
          fields: [
            {
              path: 'chatRoomId',
              message: 'chatRoomId is required',
              rule: 'required',
            },
          ],
        },
      });
    }

    const existing = this.chatRoomRegistry.get(normalizedChatRoomId);
    if (existing) {
      return existing;
    }

    const chatRoom = new ChatRoom(normalizedChatRoomId, this);
    this.chatRoomRegistry.set(normalizedChatRoomId, chatRoom);
    return chatRoom;
  }

  /**
   * @internal 推荐使用 chatRoomManager.getChatRoom(chatRoomId).getInfo()。
   * [zh-CN] 获取指定聊天室详情。
   * [en-US] Gets details of the specified chat room.
   *
   * @example [zh-CN] 调用示例（获取聊天室详情） [en-US] Usage example (get chat room detail)
   * ```ts
   * const detail = await client.chatRoomManager.getChatRoomInfo({
   *   chatRoomId: 'chatroom-1',
   * });
   * ```
   * @param params - [zh-CN] 查询参数，包含必填 `chatRoomId`。 [en-US] Query parameters containing the required `chatRoomId`.
   * @operation getChatRoomInfo
   * @throws {ValidationError} [zh-CN] 错误码 `110`：`chatRoomId` 为空或格式非法。解决方式：传入有效聊天室 ID。 [en-US] Error code `110`: `chatRoomId` is empty or invalid. Pass a valid chat room ID.
   * @returns {Promise<ChatRoomDetail>} [zh-CN] 返回聊天室详情、公告、权限与当前用户状态。 [en-US] Returns chat room details, announcement, permission, and current user status.
   */
  public async getChatRoomInfo(params: GetChatRoomInfoParams): Promise<ChatRoomDetail> {
    return this.runOperation('getChatRoomInfo', async () => {
      const context = this.getRestContextOrThrow();
      const chatRoom = await requestGetChatRoomInfo(this.getRestClient(context), context, params);
      return this.hydrateChatRoomDetailUsers(chatRoom);
    });
  }

  /**
   * @internal 推荐使用 chatRoomManager.getChatRoom(chatRoomId).updateInfo()。
   * [zh-CN] 更新聊天室名称、描述或最大成员数；推荐优先使用 `chatRoomManager.getChatRoom(chatRoomId).updateInfo()`。
   * [en-US] Updates chat room name, description, or maximum members; prefer `chatRoomManager.getChatRoom(chatRoomId).updateInfo()`.
   *
   * @example [zh-CN] 调用示例（更新聊天室信息） [en-US] Usage example (update chat room info)
   * ```ts
   * await client.chatRoomManager.updateChatRoomInfo({
   *   chatRoomId: 'chatroom-1',
   *   name: 'SDK room',
   * });
   * ```
   * @param params - [zh-CN] 更新参数，`chatRoomId` 必填，`name/description/maxMembers` 至少传入一项。 [en-US] Update parameters; `chatRoomId` is required and at least one of `name/description/maxMembers` must be provided.
   * @operation updateChatRoomInfo
   * @throws {ValidationError} [zh-CN] 错误码 `110`：参数为空或格式非法。解决方式：检查 `chatRoomId` 与更新字段。 [en-US] Error code `110`: parameters are empty or invalid. Check `chatRoomId` and update fields.
   * @returns {Promise<ChatRoomUpdateResult>} [zh-CN] 返回各字段是否更新成功。 [en-US] Returns whether each field was updated.
   */
  public async updateChatRoomInfo(params: UpdateChatRoomInfoParams): Promise<ChatRoomUpdateResult> {
    return this.runOperation('updateChatRoomInfo', async () => {
      const context = this.getRestContextOrThrow();
      return requestUpdateChatRoomInfo(this.getRestClient(context), context, params);
    });
  }

  /**
   * [zh-CN] 加入指定聊天室。该方法通过长连接聊天室操作发送加入请求。
   * [en-US] Joins the specified chat room. This method sends the join request through the realtime connection.
   *
   * @example [zh-CN] 调用示例（加入聊天室） [en-US] Usage example (join a chat room)
   * ```ts
   * await client.chatRoomManager.joinChatRoom({
   *   chatRoomId: 'chatroom-1',
   *   ext: 'from-web',
   * });
   * ```
   * @param params - [zh-CN] 加入参数，包含必填 `chatRoomId`，以及可选 `ext`、`leaveOtherRooms`。 [en-US] Join parameters containing required `chatRoomId` and optional `ext` and `leaveOtherRooms`.
   * @operation joinChatRoom
   * @throws {ValidationError} [zh-CN] 错误码 `110`：参数为空或格式非法。解决方式：检查 `chatRoomId/ext/leaveOtherRooms`。 [en-US] Error code `110`: parameters are empty or invalid. Check `chatRoomId/ext/leaveOtherRooms`.
   * @returns {Promise<void>} [zh-CN] 成功时无返回业务数据。 [en-US] Resolves with no business payload on success.
   */
  public async joinChatRoom(params: JoinChatRoomParams): Promise<void> {
    return this.runOperation('joinChatRoom', async () => {
      const client = this.requireClient();
      const chatRoomId = normalizeChatRoomId(params.chatRoomId, 'params.chatRoomId');
      const ext = this.normalizeOptionalString(params.ext, 'params.ext');
      const leaveOtherRooms = this.normalizeOptionalBoolean(
        params.leaveOtherRooms,
        'params.leaveOtherRooms'
      );
      await client.sendChatRoomOperation({
        operation: 'join',
        chatRoomId,
        ext,
        leaveOtherRooms,
      });
    });
  }

  /**
   * @internal 推荐使用 chatRoomManager.getChatRoom(chatRoomId).leaveChatRoom()。
   * [zh-CN] 退出指定聊天室；推荐优先使用 `chatRoomManager.getChatRoom(chatRoomId).leaveChatRoom()`。
   * [en-US] Leaves the specified chat room; prefer `chatRoomManager.getChatRoom(chatRoomId).leaveChatRoom()`.
   *
   * @example [zh-CN] 调用示例（退出聊天室） [en-US] Usage example (leave a chat room)
   * ```ts
   * await client.chatRoomManager.leaveChatRoom({ chatRoomId: 'chatroom-1' });
   * ```
   * @param params - [zh-CN] 退出参数，包含必填 `chatRoomId`。 [en-US] Leave parameters containing the required `chatRoomId`.
   * @operation leaveChatRoom
   * @throws {ValidationError} [zh-CN] 错误码 `110`：`chatRoomId` 为空。解决方式：传入有效聊天室 ID。 [en-US] Error code `110`: `chatRoomId` is empty. Pass a valid chat room ID.
   * @returns {Promise<void>} [zh-CN] 成功时无返回业务数据。 [en-US] Resolves with no business payload on success.
   */
  public async leaveChatRoom(params: ChatRoomMutationTarget): Promise<void> {
    return this.runOperation('leaveChatRoom', async () => {
      const client = this.requireClient();
      const chatRoomId = normalizeChatRoomId(params.chatRoomId, 'params.chatRoomId');
      await client.sendChatRoomOperation({
        operation: 'leave',
        chatRoomId,
      });
    });
  }

  /**
   * @internal 推荐使用 chatRoomManager.getChatRoom(chatRoomId).getMembers()。
   * [zh-CN] 获取指定聊天室成员列表；推荐优先使用 `chatRoom.getMembers()`。
   * [en-US] Gets members of the specified chat room; prefer `chatRoom.getMembers()`.
   *
   * @example [zh-CN] 调用示例（获取成员列表） [en-US] Usage example (get members)
   * ```ts
   * const members = await client.chatRoomManager.getMemberList({
   *   chatRoomId: 'chatroom-1',
   *   pageSize: 20,
   * });
   * ```
   * @param params - [zh-CN] 查询参数，包含必填 `chatRoomId` 与可选游标分页字段。 [en-US] Query parameters containing required `chatRoomId` and optional cursor pagination fields.
   * @operation getChatRoomMemberList
   * @throws {ValidationError} [zh-CN] 错误码 `110`：`chatRoomId` 或分页参数非法。解决方式：检查查询参数。 [en-US] Error code `110`: `chatRoomId` or pagination parameters are invalid. Check query parameters.
   * @returns {Promise<ChatRoomMemberListResult>} [zh-CN] 返回成员列表、游标与是否还有下一页。 [en-US] Returns members, cursor, and whether another page may be available.
   */
  public async getMemberList(params: ChatRoomMemberListParams): Promise<ChatRoomMemberListResult> {
    return this.runOperation('getMemberList', async () => {
      const context = this.getRestContextOrThrow();
      const result = await requestGetChatRoomMemberList(
        this.getRestClient(context),
        context,
        params
      );
      return {
        ...result,
        items: await this.hydrateEntriesWithUsers(result.items),
      };
    });
  }

  /**
   * @internal 推荐使用 chatRoomManager.getChatRoom(chatRoomId).removeMembers()。
   * [zh-CN] 从指定聊天室移除成员；推荐优先使用 `chatRoom.removeMembers()`。
   * [en-US] Removes members from the specified chat room; prefer `chatRoom.removeMembers()`.
   *
   * @example [zh-CN] 调用示例（移除成员） [en-US] Usage example (remove members)
   * ```ts
   * const result = await client.chatRoomManager.removeMembers({
   *   chatRoomId: 'chatroom-1',
   *   userIds: ['user-1'],
   * });
   * ```
   * @param params - [zh-CN] 移除参数，包含必填 `chatRoomId` 与非空 `userIds`。 [en-US] Removal parameters containing required `chatRoomId` and non-empty `userIds`.
   * @operation removeChatRoomMembers
   * @throws {ValidationError} [zh-CN] 错误码 `110`：`chatRoomId` 或 `userIds` 非法。解决方式：传入有效聊天室 ID 与用户 ID 列表。 [en-US] Error code `110`: `chatRoomId` or `userIds` is invalid. Pass a valid chat room ID and user ID list.
   * @returns {Promise<ChatRoomMemberActionListResult>} [zh-CN] 返回每个目标用户的移除结果。 [en-US] Returns removal result for each target user.
   */
  public async removeMembers(
    params: ChatRoomUserBatchParams
  ): Promise<ChatRoomMemberActionListResult> {
    return this.runOperation('removeMembers', async () => {
      const context = this.getRestContextOrThrow();
      const result = await requestRemoveChatRoomMembers(
        this.getRestClient(context),
        context,
        params
      );
      return this.hydrateActionListResult(result);
    });
  }

  /**
   * @internal 推荐使用 chatRoomManager.getChatRoom(chatRoomId).getAdminList()。
   * [zh-CN] 获取指定聊天室管理员列表；推荐优先使用 `chatRoom.getAdminList()`。
   * [en-US] Gets administrators of the specified chat room; prefer `chatRoom.getAdminList()`.
   *
   * @example [zh-CN] 调用示例（获取管理员） [en-US] Usage example (get administrators)
   * ```ts
   * const admins = await client.chatRoomManager.getAdminList({
   *   chatRoomId: 'chatroom-1',
   * });
   * ```
   * @param params - [zh-CN] 查询参数，包含必填 `chatRoomId`。 [en-US] Query parameters containing the required `chatRoomId`.
   * @operation getChatRoomAdminList
   * @throws {ValidationError} [zh-CN] 错误码 `110`：`chatRoomId` 为空。解决方式：传入有效聊天室 ID。 [en-US] Error code `110`: `chatRoomId` is empty. Pass a valid chat room ID.
   * @returns {Promise<ReadonlyArray<UserInfo>>} [zh-CN] 返回管理员用户资料列表。 [en-US] Returns administrator user profiles.
   */
  public async getAdminList(params: ChatRoomMutationTarget): Promise<ReadonlyArray<UserInfo>> {
    return this.runOperation('getAdminList', async () => {
      const context = this.getRestContextOrThrow();
      const users = await requestGetChatRoomAdminList(this.getRestClient(context), context, params);
      return this.hydrateUserInfos(users);
    });
  }

  /**
   * @internal 推荐使用 chatRoomManager.getChatRoom(chatRoomId).addAdmin()。
   * [zh-CN] 将用户设置为指定聊天室管理员；推荐优先使用 `chatRoom.addAdmin()`。
   * [en-US] Sets a user as an administrator of the specified chat room; prefer `chatRoom.addAdmin()`.
   *
   * @example [zh-CN] 调用示例（添加管理员） [en-US] Usage example (add administrator)
   * ```ts
   * await client.chatRoomManager.addAdmin({
   *   chatRoomId: 'chatroom-1',
   *   userId: 'user-1',
   * });
   * ```
   * @param params - [zh-CN] 管理员参数，包含必填 `chatRoomId` 与 `userId`。 [en-US] Administrator parameters containing required `chatRoomId` and `userId`.
   * @operation setChatRoomAdmin
   * @throws {ValidationError} [zh-CN] 错误码 `110`：`chatRoomId` 或 `userId` 为空。解决方式：传入有效 ID。 [en-US] Error code `110`: `chatRoomId` or `userId` is empty. Pass valid IDs.
   * @returns {Promise<void>} [zh-CN] 成功时无返回业务数据。 [en-US] Resolves with no business payload on success.
   */
  public async addAdmin(params: ChatRoomAdminParams): Promise<void> {
    return this.runOperation('addAdmin', async () => {
      const context = this.getRestContextOrThrow();
      await requestSetChatRoomAdmin(this.getRestClient(context), context, params);
    });
  }

  /**
   * @internal 推荐使用 chatRoomManager.getChatRoom(chatRoomId).removeAdmin()。
   * [zh-CN] 移除指定聊天室管理员；推荐优先使用 `chatRoom.removeAdmin()`。
   * [en-US] Removes an administrator from the specified chat room; prefer `chatRoom.removeAdmin()`.
   *
   * @example [zh-CN] 调用示例（移除管理员） [en-US] Usage example (remove administrator)
   * ```ts
   * await client.chatRoomManager.removeAdmin({
   *   chatRoomId: 'chatroom-1',
   *   userId: 'user-1',
   * });
   * ```
   * @param params - [zh-CN] 管理员参数，包含必填 `chatRoomId` 与 `userId`。 [en-US] Administrator parameters containing required `chatRoomId` and `userId`.
   * @operation removeChatRoomAdmin
   * @throws {ValidationError} [zh-CN] 错误码 `110`：`chatRoomId` 或 `userId` 为空。解决方式：传入有效 ID。 [en-US] Error code `110`: `chatRoomId` or `userId` is empty. Pass valid IDs.
   * @returns {Promise<void>} [zh-CN] 成功时无返回业务数据。 [en-US] Resolves with no business payload on success.
   */
  public async removeAdmin(params: ChatRoomAdminParams): Promise<void> {
    return this.runOperation('removeAdmin', async () => {
      const context = this.getRestContextOrThrow();
      await requestRemoveChatRoomAdmin(this.getRestClient(context), context, params);
    });
  }

  /**
   * @internal 推荐使用 chatRoomManager.getChatRoom(chatRoomId).getMuteList()。
   * [zh-CN] 获取指定聊天室禁言列表；推荐优先使用 `chatRoom.getMuteList()`。
   * [en-US] Gets the mute list of the specified chat room; prefer `chatRoom.getMuteList()`.
   *
   * @example [zh-CN] 调用示例（获取禁言列表） [en-US] Usage example (get mute list)
   * ```ts
   * const mutes = await client.chatRoomManager.getMuteList({
   *   chatRoomId: 'chatroom-1',
   *   pageNum: 1,
   *   pageSize: 20,
   * });
   * ```
   * @param params - [zh-CN] 查询参数，包含必填 `chatRoomId` 与可选页码分页字段。 [en-US] Query parameters containing required `chatRoomId` and optional page pagination fields.
   * @operation getChatRoomMuteList
   * @throws {ValidationError} [zh-CN] 错误码 `110`：`chatRoomId` 或分页参数非法。解决方式：检查查询参数。 [en-US] Error code `110`: `chatRoomId` or pagination parameters are invalid. Check query parameters.
   * @returns {Promise<ReadonlyArray<ChatRoomMuteEntry>>} [zh-CN] 返回禁言用户与过期时间列表。 [en-US] Returns muted users and expiration information.
   */
  public async getMuteList(
    params: ChatRoomMuteListParams
  ): Promise<ReadonlyArray<ChatRoomMuteEntry>> {
    return this.runOperation('getMuteList', async () => {
      const context = this.getRestContextOrThrow();
      const items = await requestGetChatRoomMuteList(this.getRestClient(context), context, params);
      return this.hydrateEntriesWithUsers(items);
    });
  }

  /**
   * @internal 推荐使用 chatRoomManager.getChatRoom(chatRoomId).muteMembers()。
   * [zh-CN] 禁言指定聊天室成员；推荐优先使用 `chatRoom.muteMembers()`。
   * [en-US] Mutes members in the specified chat room; prefer `chatRoom.muteMembers()`.
   *
   * @example [zh-CN] 调用示例（禁言成员） [en-US] Usage example (mute members)
   * ```ts
   * await client.chatRoomManager.muteMembers({
   *   chatRoomId: 'chatroom-1',
   *   userIds: ['user-1'],
   *   duration: 3600,
   * });
   * ```
   * @param params - [zh-CN] 禁言参数，包含必填 `chatRoomId`、非空 `userIds` 与禁言时长 `duration`（秒）。 [en-US] Mute parameters containing required `chatRoomId`, non-empty `userIds`, and `duration` in seconds.
   * @operation muteChatRoomMembers
   * @throws {ValidationError} [zh-CN] 错误码 `110`：参数非法。解决方式：检查 `chatRoomId/userIds/duration`。 [en-US] Error code `110`: invalid parameters. Check `chatRoomId/userIds/duration`.
   * @returns {Promise<void>} [zh-CN] 成功时无返回业务数据。 [en-US] Resolves with no business payload on success.
   */
  public async muteMembers(params: ChatRoomMuteMembersParams): Promise<void> {
    return this.runOperation('muteMembers', async () => {
      const context = this.getRestContextOrThrow();
      await requestMuteChatRoomMembers(this.getRestClient(context), context, params);
    });
  }

  /**
   * @internal 推荐使用 chatRoomManager.getChatRoom(chatRoomId).unmuteMembers()。
   * [zh-CN] 解除指定聊天室成员禁言；推荐优先使用 `chatRoom.unmuteMembers()`。
   * [en-US] Unmutes members in the specified chat room; prefer `chatRoom.unmuteMembers()`.
   *
   * @example [zh-CN] 调用示例（解除禁言） [en-US] Usage example (unmute members)
   * ```ts
   * await client.chatRoomManager.unmuteMembers({
   *   chatRoomId: 'chatroom-1',
   *   userIds: ['user-1'],
   * });
   * ```
   * @param params - [zh-CN] 解除禁言参数，包含必填 `chatRoomId` 与非空 `userIds`。 [en-US] Unmute parameters containing required `chatRoomId` and non-empty `userIds`.
   * @operation unmuteChatRoomMembers
   * @throws {ValidationError} [zh-CN] 错误码 `110`：参数非法。解决方式：检查 `chatRoomId/userIds`。 [en-US] Error code `110`: invalid parameters. Check `chatRoomId/userIds`.
   * @returns {Promise<void>} [zh-CN] 成功时无返回业务数据。 [en-US] Resolves with no business payload on success.
   */
  public async unmuteMembers(params: ChatRoomUserBatchParams): Promise<void> {
    return this.runOperation('unmuteMembers', async () => {
      const context = this.getRestContextOrThrow();
      await requestUnmuteChatRoomMembers(this.getRestClient(context), context, params);
    });
  }

  /**
   * @internal 推荐使用 chatRoomManager.getChatRoom(chatRoomId).muteAllMembers()。
   * [zh-CN] 开启指定聊天室全员禁言；推荐优先使用 `chatRoom.muteAllMembers()`。
   * [en-US] Enables all-member mute in the specified chat room; prefer `chatRoom.muteAllMembers()`.
   *
   * @example [zh-CN] 调用示例（开启全员禁言） [en-US] Usage example (mute all members)
   * ```ts
   * await client.chatRoomManager.muteAllMembers({ chatRoomId: 'chatroom-1' });
   * ```
   * @param params - [zh-CN] 操作参数，包含必填 `chatRoomId`。 [en-US] Operation parameters containing the required `chatRoomId`.
   * @operation muteAllChatRoomMembers
   * @throws {ValidationError} [zh-CN] 错误码 `110`：`chatRoomId` 为空。解决方式：传入有效聊天室 ID。 [en-US] Error code `110`: `chatRoomId` is empty. Pass a valid chat room ID.
   * @returns {Promise<void>} [zh-CN] 成功时无返回业务数据。 [en-US] Resolves with no business payload on success.
   */
  public async muteAllMembers(params: ChatRoomMutationTarget): Promise<void> {
    return this.runOperation('muteAllMembers', async () => {
      const context = this.getRestContextOrThrow();
      await requestMuteAllChatRoomMembers(this.getRestClient(context), context, params);
    });
  }

  /**
   * @internal 推荐使用 chatRoomManager.getChatRoom(chatRoomId).unmuteAllMembers()。
   * [zh-CN] 关闭指定聊天室全员禁言；推荐优先使用 `chatRoom.unmuteAllMembers()`。
   * [en-US] Disables all-member mute in the specified chat room; prefer `chatRoom.unmuteAllMembers()`.
   *
   * @example [zh-CN] 调用示例（关闭全员禁言） [en-US] Usage example (unmute all members)
   * ```ts
   * await client.chatRoomManager.unmuteAllMembers({ chatRoomId: 'chatroom-1' });
   * ```
   * @param params - [zh-CN] 操作参数，包含必填 `chatRoomId`。 [en-US] Operation parameters containing the required `chatRoomId`.
   * @operation unmuteAllChatRoomMembers
   * @throws {ValidationError} [zh-CN] 错误码 `110`：`chatRoomId` 为空。解决方式：传入有效聊天室 ID。 [en-US] Error code `110`: `chatRoomId` is empty. Pass a valid chat room ID.
   * @returns {Promise<void>} [zh-CN] 成功时无返回业务数据。 [en-US] Resolves with no business payload on success.
   */
  public async unmuteAllMembers(params: ChatRoomMutationTarget): Promise<void> {
    return this.runOperation('unmuteAllMembers', async () => {
      const context = this.getRestContextOrThrow();
      await requestUnmuteAllChatRoomMembers(this.getRestClient(context), context, params);
    });
  }

  /**
   * @internal 推荐使用 chatRoomManager.getChatRoom(chatRoomId).checkIfInMuteList()。
   * [zh-CN] 查询当前用户是否在指定聊天室禁言列表中；推荐优先使用 `chatRoom.checkIfInMuteList()`。
   * [en-US] Checks whether the current user is muted in the specified chat room; prefer `chatRoom.checkIfInMuteList()`.
   *
   * @example [zh-CN] 调用示例（查询当前用户禁言状态） [en-US] Usage example (check current user mute status)
   * ```ts
   * const status = await client.chatRoomManager.checkIfInMuteList({
   *   chatRoomId: 'chatroom-1',
   * });
   * ```
   * @param params - [zh-CN] 查询参数，包含必填 `chatRoomId`。 [en-US] Query parameters containing the required `chatRoomId`.
   * @operation isCurrentUserMutedInChatRoom
   * @throws {ValidationError} [zh-CN] 错误码 `110`：`chatRoomId` 为空。解决方式：传入有效聊天室 ID。 [en-US] Error code `110`: `chatRoomId` is empty. Pass a valid chat room ID.
   * @returns {Promise<ChatRoomMuteStatus>} [zh-CN] 返回当前用户是否被禁言及过期时间。 [en-US] Returns whether the current user is muted and the expiration timestamp.
   */
  public async checkIfInMuteList(params: ChatRoomMutationTarget): Promise<ChatRoomMuteStatus> {
    return this.runOperation('checkIfInMuteList', async () => {
      const context = this.getRestContextOrThrow();
      return requestCheckIfInChatRoomMuteList(this.getRestClient(context), context, params);
    });
  }

  /**
   * @internal 推荐使用 chatRoomManager.getChatRoom(chatRoomId).getBlocklist()。
   * [zh-CN] 获取指定聊天室黑名单；推荐优先使用 `chatRoom.getBlocklist()`。
   * [en-US] Gets the blocklist of the specified chat room; prefer `chatRoom.getBlocklist()`.
   *
   * @example [zh-CN] 调用示例（获取黑名单） [en-US] Usage example (get blocklist)
   * ```ts
   * const blocklist = await client.chatRoomManager.getBlocklist({
   *   chatRoomId: 'chatroom-1',
   *   pageNum: 1,
   *   pageSize: 20,
   * });
   * ```
   * @param params - [zh-CN] 查询参数，包含必填 `chatRoomId` 与可选页码分页字段。 [en-US] Query parameters containing required `chatRoomId` and optional page pagination fields.
   * @operation getChatRoomBlocklist
   * @throws {ValidationError} [zh-CN] 错误码 `110`：`chatRoomId` 或分页参数非法。解决方式：检查查询参数。 [en-US] Error code `110`: `chatRoomId` or pagination parameters are invalid. Check query parameters.
   * @returns {Promise<ReadonlyArray<ChatRoomBlocklistEntry>>} [zh-CN] 返回黑名单用户列表。 [en-US] Returns blocked users.
   */
  public async getBlocklist(
    params: ChatRoomBlocklistParams
  ): Promise<ReadonlyArray<ChatRoomBlocklistEntry>> {
    return this.runOperation('getBlocklist', async () => {
      const context = this.getRestContextOrThrow();
      const items = await requestGetChatRoomBlocklist(this.getRestClient(context), context, params);
      return this.hydrateEntriesWithUsers(items);
    });
  }

  /**
   * @internal 推荐使用 chatRoomManager.getChatRoom(chatRoomId).blockMembers()。
   * [zh-CN] 将成员加入指定聊天室黑名单；推荐优先使用 `chatRoom.blockMembers()`。
   * [en-US] Adds members to the blocklist of the specified chat room; prefer `chatRoom.blockMembers()`.
   *
   * @example [zh-CN] 调用示例（拉黑成员） [en-US] Usage example (block members)
   * ```ts
   * const result = await client.chatRoomManager.blockMembers({
   *   chatRoomId: 'chatroom-1',
   *   userIds: ['user-1'],
   * });
   * ```
   * @param params - [zh-CN] 拉黑参数，包含必填 `chatRoomId` 与非空 `userIds`。 [en-US] Block parameters containing required `chatRoomId` and non-empty `userIds`.
   * @operation blockChatRoomMembers
   * @throws {ValidationError} [zh-CN] 错误码 `110`：参数非法。解决方式：检查 `chatRoomId/userIds`。 [en-US] Error code `110`: invalid parameters. Check `chatRoomId/userIds`.
   * @returns {Promise<ChatRoomMemberActionListResult>} [zh-CN] 返回每个目标用户的拉黑结果。 [en-US] Returns block result for each target user.
   */
  public async blockMembers(
    params: ChatRoomUserBatchParams
  ): Promise<ChatRoomMemberActionListResult> {
    return this.runOperation('blockMembers', async () => {
      const context = this.getRestContextOrThrow();
      const result = await requestBlockChatRoomMembers(
        this.getRestClient(context),
        context,
        params
      );
      return this.hydrateActionListResult(result);
    });
  }

  /**
   * @internal 推荐使用 chatRoomManager.getChatRoom(chatRoomId).unblockMembers()。
   * [zh-CN] 从指定聊天室黑名单移除成员；推荐优先使用 `chatRoom.unblockMembers()`。
   * [en-US] Removes members from the blocklist of the specified chat room; prefer `chatRoom.unblockMembers()`.
   *
   * @example [zh-CN] 调用示例（移除黑名单） [en-US] Usage example (unblock members)
   * ```ts
   * const result = await client.chatRoomManager.unblockMembers({
   *   chatRoomId: 'chatroom-1',
   *   userIds: ['user-1'],
   * });
   * ```
   * @param params - [zh-CN] 移除参数，包含必填 `chatRoomId` 与非空 `userIds`。 [en-US] Removal parameters containing required `chatRoomId` and non-empty `userIds`.
   * @operation unblockChatRoomMembers
   * @throws {ValidationError} [zh-CN] 错误码 `110`：参数非法。解决方式：检查 `chatRoomId/userIds`。 [en-US] Error code `110`: invalid parameters. Check `chatRoomId/userIds`.
   * @returns {Promise<ChatRoomMemberActionListResult>} [zh-CN] 返回每个目标用户的移除结果。 [en-US] Returns unblock result for each target user.
   */
  public async unblockMembers(
    params: ChatRoomUserBatchParams
  ): Promise<ChatRoomMemberActionListResult> {
    return this.runOperation('unblockMembers', async () => {
      const context = this.getRestContextOrThrow();
      const result = await requestUnblockChatRoomMembers(
        this.getRestClient(context),
        context,
        params
      );
      return this.hydrateActionListResult(result);
    });
  }

  /**
   * @internal 推荐使用 chatRoomManager.getChatRoom(chatRoomId).getAllowlist()。
   * [zh-CN] 获取指定聊天室 allowlist；推荐优先使用 `chatRoom.getAllowlist()`。
   * [en-US] Gets the allowlist of the specified chat room; prefer `chatRoom.getAllowlist()`.
   *
   * @example [zh-CN] 调用示例（获取 allowlist） [en-US] Usage example (get allowlist)
   * ```ts
   * const allowlist = await client.chatRoomManager.getAllowlist({
   *   chatRoomId: 'chatroom-1',
   * });
   * ```
   * @param params - [zh-CN] 查询参数，包含必填 `chatRoomId`。 [en-US] Query parameters containing the required `chatRoomId`.
   * @operation getChatRoomAllowlist
   * @throws {ValidationError} [zh-CN] 错误码 `110`：`chatRoomId` 为空。解决方式：传入有效聊天室 ID。 [en-US] Error code `110`: `chatRoomId` is empty. Pass a valid chat room ID.
   * @returns {Promise<ReadonlyArray<ChatRoomAllowlistEntry>>} [zh-CN] 返回 allowlist 用户列表。 [en-US] Returns allowlisted users.
   */
  public async getAllowlist(
    params: ChatRoomMutationTarget
  ): Promise<ReadonlyArray<{ readonly user: UserInfo }>> {
    return this.runOperation('getAllowlist', async () => {
      const context = this.getRestContextOrThrow();
      const items = await requestGetChatRoomAllowlist(this.getRestClient(context), context, params);
      return this.hydrateEntriesWithUsers(items);
    });
  }

  /**
   * @internal 推荐使用 chatRoomManager.getChatRoom(chatRoomId).addUsersToAllowlist()。
   * [zh-CN] 将用户加入指定聊天室 allowlist；推荐优先使用 `chatRoom.addUsersToAllowlist()`。
   * [en-US] Adds users to the allowlist of the specified chat room; prefer `chatRoom.addUsersToAllowlist()`.
   *
   * @example [zh-CN] 调用示例（添加 allowlist） [en-US] Usage example (add users to allowlist)
   * ```ts
   * const result = await client.chatRoomManager.addUsersToAllowlist({
   *   chatRoomId: 'chatroom-1',
   *   userIds: ['user-1'],
   * });
   * ```
   * @param params - [zh-CN] 添加参数，包含必填 `chatRoomId` 与非空 `userIds`。 [en-US] Add parameters containing required `chatRoomId` and non-empty `userIds`.
   * @operation addUsersToChatRoomAllowlist
   * @throws {ValidationError} [zh-CN] 错误码 `110`：参数非法。解决方式：检查 `chatRoomId/userIds`。 [en-US] Error code `110`: invalid parameters. Check `chatRoomId/userIds`.
   * @returns {Promise<ChatRoomMemberActionListResult>} [zh-CN] 返回每个目标用户的添加结果。 [en-US] Returns add result for each target user.
   */
  public async addUsersToAllowlist(
    params: ChatRoomUserBatchParams
  ): Promise<ChatRoomMemberActionListResult> {
    return this.runOperation('addUsersToAllowlist', async () => {
      const context = this.getRestContextOrThrow();
      const result = await requestAddUsersToChatRoomAllowlist(
        this.getRestClient(context),
        context,
        params
      );
      return this.hydrateActionListResult(result);
    });
  }

  /**
   * @internal 推荐使用 chatRoomManager.getChatRoom(chatRoomId).removeUsersFromAllowlist()。
   * [zh-CN] 从指定聊天室 allowlist 移除用户；推荐优先使用 `chatRoom.removeUsersFromAllowlist()`。
   * [en-US] Removes users from the allowlist of the specified chat room; prefer `chatRoom.removeUsersFromAllowlist()`.
   *
   * @example [zh-CN] 调用示例（移除 allowlist） [en-US] Usage example (remove users from allowlist)
   * ```ts
   * const result = await client.chatRoomManager.removeUsersFromAllowlist({
   *   chatRoomId: 'chatroom-1',
   *   userIds: ['user-1'],
   * });
   * ```
   * @param params - [zh-CN] 移除参数，包含必填 `chatRoomId` 与非空 `userIds`。 [en-US] Removal parameters containing required `chatRoomId` and non-empty `userIds`.
   * @operation removeUsersFromChatRoomAllowlist
   * @throws {ValidationError} [zh-CN] 错误码 `110`：参数非法。解决方式：检查 `chatRoomId/userIds`。 [en-US] Error code `110`: invalid parameters. Check `chatRoomId/userIds`.
   * @returns {Promise<ChatRoomMemberActionListResult>} [zh-CN] 返回每个目标用户的移除结果。 [en-US] Returns removal result for each target user.
   */
  public async removeUsersFromAllowlist(
    params: ChatRoomUserBatchParams
  ): Promise<ChatRoomMemberActionListResult> {
    return this.runOperation('removeUsersFromAllowlist', async () => {
      const context = this.getRestContextOrThrow();
      const result = await requestRemoveUsersFromChatRoomAllowlist(
        this.getRestClient(context),
        context,
        params
      );
      return this.hydrateActionListResult(result);
    });
  }

  /**
   * @internal 推荐使用 chatRoomManager.getChatRoom(chatRoomId).checkIfInAllowList()。
   * [zh-CN] 查询当前用户是否在指定聊天室 allowlist 中；推荐优先使用 `chatRoom.checkIfInAllowList()`。
   * [en-US] Checks whether the current user is in the allowlist of the specified chat room; prefer `chatRoom.checkIfInAllowList()`.
   *
   * @example [zh-CN] 调用示例（查询当前用户 allowlist 状态） [en-US] Usage example (check current user allowlist status)
   * ```ts
   * const status = await client.chatRoomManager.checkIfInAllowList({
   *   chatRoomId: 'chatroom-1',
   * });
   * ```
   * @param params - [zh-CN] 查询参数，包含必填 `chatRoomId`。 [en-US] Query parameters containing the required `chatRoomId`.
   * @operation checkIfInChatRoomAllowList
   * @throws {ValidationError} [zh-CN] 错误码 `110`：`chatRoomId` 为空。解决方式：传入有效聊天室 ID。 [en-US] Error code `110`: `chatRoomId` is empty. Pass a valid chat room ID.
   * @returns {Promise<boolean>} [zh-CN] 返回当前用户是否在 allowlist 中。 [en-US] Returns whether the current user is in the allowlist.
   */
  public async checkIfInAllowList(params: ChatRoomMutationTarget): Promise<boolean> {
    return this.runOperation('checkIfInAllowList', async () => {
      const context = this.getRestContextOrThrow();
      return requestCheckIfInChatRoomAllowList(this.getRestClient(context), context, params);
    });
  }

  /**
   * @internal 推荐使用 chatRoomManager.getChatRoom(chatRoomId).getAnnouncement()。
   * [zh-CN] 获取指定聊天室公告；推荐优先使用 `chatRoom.getAnnouncement()`。
   * [en-US] Gets the announcement of the specified chat room; prefer `chatRoom.getAnnouncement()`.
   *
   * @example [zh-CN] 调用示例（获取公告） [en-US] Usage example (get announcement)
   * ```ts
   * const announcement = await client.chatRoomManager.getAnnouncement({
   *   chatRoomId: 'chatroom-1',
   * });
   * ```
   * @param params - [zh-CN] 查询参数，包含必填 `chatRoomId`。 [en-US] Query parameters containing the required `chatRoomId`.
   * @operation getChatRoomAnnouncement
   * @throws {ValidationError} [zh-CN] 错误码 `110`：`chatRoomId` 为空。解决方式：传入有效聊天室 ID。 [en-US] Error code `110`: `chatRoomId` is empty. Pass a valid chat room ID.
   * @returns {Promise<ChatRoomAnnouncement>} [zh-CN] 返回公告内容。 [en-US] Returns the announcement content.
   */
  public async getAnnouncement(params: ChatRoomMutationTarget): Promise<ChatRoomAnnouncement> {
    return this.runOperation('getAnnouncement', async () => {
      const context = this.getRestContextOrThrow();
      return requestGetChatRoomAnnouncement(this.getRestClient(context), context, params);
    });
  }

  /**
   * @internal 推荐使用 chatRoomManager.getChatRoom(chatRoomId).updateAnnouncement()。
   * [zh-CN] 更新指定聊天室公告；推荐优先使用 `chatRoom.updateAnnouncement()`。
   * [en-US] Updates the announcement of the specified chat room; prefer `chatRoom.updateAnnouncement()`.
   *
   * @example [zh-CN] 调用示例（更新公告） [en-US] Usage example (update announcement)
   * ```ts
   * await client.chatRoomManager.updateAnnouncement({
   *   chatRoomId: 'chatroom-1',
   *   announcement: 'Welcome',
   * });
   * ```
   * @param params - [zh-CN] 更新参数，包含必填 `chatRoomId` 与公告内容。 [en-US] Update parameters containing required `chatRoomId` and announcement content.
   * @operation updateChatRoomAnnouncement
   * @throws {ValidationError} [zh-CN] 错误码 `110`：参数为空或公告超限。解决方式：检查 `chatRoomId/announcement`。 [en-US] Error code `110`: parameters are empty or announcement is too long. Check `chatRoomId/announcement`.
   * @returns {Promise<void>} [zh-CN] 成功时无返回业务数据。 [en-US] Resolves with no business payload on success.
   */
  public async updateAnnouncement(params: ChatRoomAnnouncementUpdateParams): Promise<void> {
    return this.runOperation('updateAnnouncement', async () => {
      const context = this.getRestContextOrThrow();
      await requestUpdateChatRoomAnnouncement(this.getRestClient(context), context, params);
    });
  }

  /**
   * @internal 推荐使用 chatRoomManager.getChatRoom(chatRoomId).getAttributes()。
   * [zh-CN] 获取指定聊天室属性；推荐优先使用 `chatRoom.getAttributes()`。
   * [en-US] Gets attributes of the specified chat room; prefer `chatRoom.getAttributes()`.
   *
   * @example [zh-CN] 调用示例（获取指定属性） [en-US] Usage example (get selected attributes)
   * ```ts
   * const snapshot = await client.chatRoomManager.getAttributes({
   *   chatRoomId: 'chatroom-1',
   *   keys: ['topic'],
   * });
   * ```
   * @param params - [zh-CN] 查询参数，包含必填 `chatRoomId` 与可选 `keys`；不传 `keys` 表示获取全部属性。 [en-US] Query parameters containing required `chatRoomId` and optional `keys`; omit `keys` to get all attributes.
   * @operation getChatRoomAttributes
   * @throws {ValidationError} [zh-CN] 错误码 `110`：`chatRoomId` 或 `keys` 非法。解决方式：检查属性 key 列表。 [en-US] Error code `110`: `chatRoomId` or `keys` is invalid. Check attribute keys.
   * @returns {Promise<ChatRoomAttributesSnapshot>} [zh-CN] 返回聊天室属性快照。 [en-US] Returns a chat room attributes snapshot.
   */
  public async getAttributes(
    params: GetChatRoomAttributesParams
  ): Promise<ChatRoomAttributesSnapshot> {
    return this.runOperation('getAttributes', async () => {
      const context = this.getRestContextOrThrow();
      return requestGetChatRoomAttributes(this.getRestClient(context), context, params);
    });
  }

  /**
   * @internal 推荐使用 chatRoomManager.getChatRoom(chatRoomId).setAttributes()。
   * [zh-CN] 设置指定聊天室属性；推荐优先使用 `chatRoom.setAttributes()`。
   * [en-US] Sets attributes of the specified chat room; prefer `chatRoom.setAttributes()`.
   *
   * @example [zh-CN] 调用示例（设置属性） [en-US] Usage example (set attributes)
   * ```ts
   * const result = await client.chatRoomManager.setAttributes({
   *   chatRoomId: 'chatroom-1',
   *   attributes: { topic: 'sdk' },
   *   autoDelete: true,
   * });
   * ```
   * @param params - [zh-CN] 设置参数，包含必填 `chatRoomId` 与非空 `attributes`，可选 `autoDelete/isForced`。 [en-US] Set parameters containing required `chatRoomId`, non-empty `attributes`, and optional `autoDelete/isForced`.
   * @operation setChatRoomAttributes
   * @throws {ValidationError} [zh-CN] 错误码 `110`：属性 key/value 或参数格式非法。解决方式：传入合法字符串键值对。 [en-US] Error code `110`: attribute key/value or parameter format is invalid. Pass valid string key-value pairs.
   * @returns {Promise<ChatRoomAttributeMutationResult>} [zh-CN] 返回成功应用和失败的属性 key。 [en-US] Returns applied and failed attribute keys.
   */
  public async setAttributes(
    params: SetChatRoomAttributesParams
  ): Promise<ChatRoomAttributeMutationResult> {
    return this.runOperation('setAttributes', async () => {
      const context = this.getRestContextOrThrow();
      const result = await requestSetChatRoomAttributes(
        this.getRestClient(context),
        context,
        params
      );
      return this.checkAttributeMutationResult(result);
    });
  }

  /**
   * @internal 推荐使用 chatRoomManager.getChatRoom(chatRoomId).removeAttributes()。
   * [zh-CN] 删除指定聊天室属性；推荐优先使用 `chatRoom.removeAttributes()`。
   * [en-US] Removes attributes of the specified chat room; prefer `chatRoom.removeAttributes()`.
   *
   * @example [zh-CN] 调用示例（删除属性） [en-US] Usage example (remove attributes)
   * ```ts
   * const result = await client.chatRoomManager.removeAttributes({
   *   chatRoomId: 'chatroom-1',
   *   keys: ['topic'],
   * });
   * ```
   * @param params - [zh-CN] 删除参数，包含必填 `chatRoomId` 与非空 `keys`，可选 `isForced`。 [en-US] Removal parameters containing required `chatRoomId`, non-empty `keys`, and optional `isForced`.
   * @operation removeChatRoomAttributes
   * @throws {ValidationError} [zh-CN] 错误码 `110`：`keys` 为空或格式非法。解决方式：传入合法属性 key 列表。 [en-US] Error code `110`: `keys` is empty or invalid. Pass valid attribute keys.
   * @returns {Promise<ChatRoomAttributeMutationResult>} [zh-CN] 返回成功删除和失败的属性 key。 [en-US] Returns removed and failed attribute keys.
   */
  public async removeAttributes(
    params: RemoveChatRoomAttributesParams
  ): Promise<ChatRoomAttributeMutationResult> {
    return this.runOperation('removeAttributes', async () => {
      const context = this.getRestContextOrThrow();
      const result = await requestRemoveChatRoomAttributes(
        this.getRestClient(context),
        context,
        params
      );
      return this.checkAttributeMutationResult(result);
    });
  }

  private async runOperation<T>(name: string, operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const sdkError = this.normalizeSdkError(name, error);
      logger.warn(`ChatRoomManager ${name} failed`, {
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
      return new SDKError(`ChatRoomManager ${name} failed: ${error.message}`, ERROR_CODES.UNKNOWN);
    }
    return new SDKError(`ChatRoomManager ${name} failed`, ERROR_CODES.UNKNOWN);
  }

  /**
   * FR-051: 属性批量操作结果检查。
   * 所有 key 都失败 → 抛出 SDKError（取第一个 errorKey 的映射码）。
   */
  private checkAttributeMutationResult(
    result: ChatRoomAttributeMutationResult
  ): ChatRoomAttributeMutationResult {
    const failedEntries = Object.values(result.failedKeys);
    if (failedEntries.length > 0 && result.appliedKeys.length === 0) {
      const [first] = failedEntries;
      if (first) {
        throw new SDKError(first.message, first.code);
      }
    }
    return result;
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

    this.restClient = new RestClient(context.restBaseUrl, { errorMap: CHATROOM_REST_ERROR_MAP });
    this.restClient.setAuthToken(context.token);
    this.restBaseUrl = context.restBaseUrl;
    this.restToken = context.token;
    return this.restClient;
  }

  private requireClient(): ChatClient {
    if (!this.client) {
      throw new SDKError('ChatRoomManager is not bound to client', ERROR_CODES.VALIDATION_REQUIRED);
    }
    return this.client;
  }

  private normalizeOptionalString(value: unknown, path: string): string | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (typeof value !== 'string') {
      throw new ValidationError(`${path} must be a string`, {
        code: ERROR_CODES.VALIDATION_INVALID_FORMAT,
        details: {
          fields: [
            {
              path,
              message: `${path} must be a string`,
              rule: 'invalid_format',
            },
          ],
        },
      });
    }
    return value;
  }

  private normalizeOptionalBoolean(value: unknown, path: string): boolean | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (typeof value !== 'boolean') {
      throw new ValidationError(`${path} must be a boolean`, {
        code: ERROR_CODES.VALIDATION_INVALID_FORMAT,
        details: {
          fields: [
            {
              path,
              message: `${path} must be a boolean`,
              rule: 'invalid_format',
            },
          ],
        },
      });
    }
    return value;
  }

  private getCacheManager(): CacheManager | null {
    return this.client?.getCacheManager() ?? null;
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
    return resolveChatRoomUserInfoMap(userIds, {
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
          logger.warn('ChatRoomManager user info fetch failed', {
            userIds: targets,
            error,
          });
          return [];
        }
      },
    });
  }

  private async hydrateUserInfos(users: ReadonlyArray<UserInfo>): Promise<ReadonlyArray<UserInfo>> {
    return resolveChatRoomUserInfos(
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
            logger.warn('ChatRoomManager hydrate users failed', { userIds, error });
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

  private collectEventUserIds(rawEvent: ChatRoomRawNotifyEvent): ReadonlyArray<string> {
    const raw = rawEvent.payload;
    const candidates = [
      raw.participantId,
      raw.memberId,
      ...(raw.memberIds ?? []),
      raw.adminId,
      raw.oldOwnerId,
      raw.newOwnerId,
      raw.from,
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
    return mergeChatRoomUserInfo(undefined, userInfoMap.get(userId), userId);
  }

  private pickEventUsers(
    userIds: ReadonlyArray<string> | undefined,
    userInfoMap: ReadonlyMap<string, UserInfo>
  ): ReadonlyArray<UserInfo> {
    return (userIds ?? []).map(userId =>
      mergeChatRoomUserInfo(undefined, userInfoMap.get(userId), userId)
    );
  }

  private pickEventMuteEntries(
    userIds: ReadonlyArray<string> | undefined,
    muteExpire: number | undefined,
    userInfoMap: ReadonlyMap<string, UserInfo>
  ): ReadonlyArray<ChatRoomMuteEntry> {
    return this.pickEventUsers(userIds, userInfoMap).map(user => ({
      user,
      muteExpire,
    }));
  }

  private async resolveChatRoomDetailForEvent(
    raw: ChatRoomRawNotifyPayload
  ): Promise<ChatRoomDetail> {
    if (raw.shouldFetchChatRoomDetail) {
      try {
        return await this.getChatRoomInfo({ chatRoomId: raw.chatRoomId });
      } catch (error) {
        logger.warn('ChatRoomManager event detail fetch failed', {
          chatRoomId: raw.chatRoomId,
          error,
        });
      }
    }

    return {
      chatRoomId: raw.chatRoomId,
      name: raw.chatRoomPatch?.name ?? raw.chatRoomName ?? '',
      ...(raw.chatRoomPatch ?? {}),
    };
  }

  private async hydrateEntriesWithUsers<T extends ItemWithUser>(
    items: ReadonlyArray<T>
  ): Promise<ReadonlyArray<T>> {
    const userIds = items.map(item => item.user.userId);
    const userInfoMap = await this.resolveUserInfoMap(userIds);

    return items.map(item => ({
      ...item,
      user: mergeChatRoomUserInfo(item.user, userInfoMap.get(item.user.userId), item.user.userId),
    }));
  }

  private async hydrateActionListResult(
    result: ChatRoomMemberActionListResult
  ): Promise<ChatRoomMemberActionListResult> {
    return {
      succeeded: await this.hydrateEntriesWithUsers(result.succeeded),
      failed: await this.hydrateEntriesWithUsers(result.failed),
    };
  }

  private async hydrateSummaryOwners(
    items: ReadonlyArray<ChatRoomSummary>
  ): Promise<ReadonlyArray<ChatRoomSummary>> {
    const ownerIds = items
      .map(item => item.owner?.userId)
      .filter((item): item is string => typeof item === 'string');
    const userInfoMap = await this.resolveUserInfoMap(ownerIds);

    return items.map(item => {
      if (!item.owner?.userId) {
        return item;
      }
      return {
        ...item,
        owner: mergeChatRoomUserInfo(
          item.owner,
          userInfoMap.get(item.owner.userId),
          item.owner.userId
        ),
      };
    });
  }

  private async hydrateChatRoomDetailUsers(chatRoom: ChatRoomDetail): Promise<ChatRoomDetail> {
    if (!chatRoom.owner?.userId) {
      return chatRoom;
    }
    const userInfoMap = await this.resolveUserInfoMap([chatRoom.owner.userId]);
    return {
      ...chatRoom,
      owner: mergeChatRoomUserInfo(
        chatRoom.owner,
        userInfoMap.get(chatRoom.owner.userId),
        chatRoom.owner.userId
      ),
    };
  }
}
