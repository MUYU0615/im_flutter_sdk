/**
 * [zh-CN] 轻量 ChatRoom 单聊天室对象。
 * [en-US] Lightweight single-chatroom facade.
 */

import type { ChatRoomManager } from '../chatroom-manager';
import type {
  ChatRoomAdminInput,
  ChatRoomAnnouncement,
  ChatRoomAnnouncementUpdateInput,
  ChatRoomAttributeMutationResult,
  ChatRoomAttributesSnapshot,
  ChatRoomBlocklistEntry,
  ChatRoomDetail,
  ChatRoomMemberActionListResult,
  ChatRoomMemberListResult,
  ChatRoomMuteEntry,
  ChatRoomMuteMembersInput,
  ChatRoomMuteStatus,
  ChatRoomMutationTarget,
  ChatRoomPageParams,
  ChatRoomUpdateInfoInput,
  ChatRoomUpdateResult,
  ChatRoomUserBatchInput,
  GetChatRoomAttributesInput,
  RemoveChatRoomAttributesInput,
  SetChatRoomAttributesInput,
} from '../../types/chatroom';
import type { CursorPageParams } from '../../types/group';
import type { UserInfo } from '../../types/user-info';

/**
 * [zh-CN] 绑定固定 `chatRoomId` 的单聊天室上下文对象。
 * [en-US] Single-chatroom context object bound to a fixed `chatRoomId`.
 */
export class ChatRoom {
  public readonly chatRoomId: string;

  private readonly manager: ChatRoomManager;

  public constructor(chatRoomId: string, manager: ChatRoomManager) {
    this.chatRoomId = chatRoomId;
    this.manager = manager;
  }

  /**
   * [zh-CN] 获取当前聊天室详情。
   * [en-US] Gets details of the current chat room.
   *
   * @example [zh-CN] 调用示例（获取详情） [en-US] Usage example (get detail)
   * ```ts
   * const chatRoom = client.chatRoomManager.getChatRoom('chatroom-1');
   * const detail = await chatRoom.getInfo();
   * ```
   * @param this - [zh-CN] 当前 `ChatRoom` 对象已绑定固定 `chatRoomId`，无需额外参数。 [en-US] The current `ChatRoom` object is bound to a fixed `chatRoomId`; no extra parameter is required.
   * @operation getChatRoomInfo
   * @throws {SDKError} [zh-CN] 错误码见下方错误清单；常见原因是聊天室不存在或登录态不可用。 [en-US] See the error matrix below; common causes include a missing chat room or unavailable login state.
   * @returns {Promise<ChatRoomDetail>} [zh-CN] 返回聊天室详情、公告、权限与当前用户状态。 [en-US] Returns chat room details, announcement, permission, and current user status.
   */
  public getInfo(): Promise<ChatRoomDetail> {
    return this.manager.getChatRoomInfo({
      chatRoomId: this.chatRoomId,
    });
  }

  /**
   * [zh-CN] 刷新并返回当前聊天室详情，等价于 `getInfo()`。
   * [en-US] Refreshes and returns the current chat room detail; equivalent to `getInfo()`.
   *
   * @example [zh-CN] 调用示例（刷新详情） [en-US] Usage example (refresh detail)
   * ```ts
   * const detail = await chatRoom.refresh();
   * ```
   * @param this - [zh-CN] 当前 `ChatRoom` 对象已绑定固定 `chatRoomId`，无需额外参数。 [en-US] The current `ChatRoom` object is bound to a fixed `chatRoomId`; no extra parameter is required.
   * @operation getChatRoomInfo
   * @throws {SDKError} [zh-CN] 错误码见下方错误清单；常见原因是聊天室不存在或登录态不可用。 [en-US] See the error matrix below; common causes include a missing chat room or unavailable login state.
   * @returns {Promise<ChatRoomDetail>} [zh-CN] 返回最新聊天室详情。 [en-US] Returns the latest chat room detail.
   */
  public refresh(): Promise<ChatRoomDetail> {
    return this.getInfo();
  }

  /**
   * [zh-CN] 更新当前聊天室名称、描述或最大成员数。
   * [en-US] Updates the current chat room name, description, or maximum members.
   *
   * @example [zh-CN] 调用示例（更新聊天室信息） [en-US] Usage example (update chat room info)
   * ```ts
   * await chatRoom.updateInfo({ name: 'SDK room' });
   * ```
   * @param input - [zh-CN] 更新字段，`name/description/maxMembers` 至少传入一项。 [en-US] Update fields; at least one of `name/description/maxMembers` must be provided.
   * @operation updateChatRoomInfo
   * @throws {ValidationError} [zh-CN] 错误码 `110`：参数为空或格式非法。解决方式：检查更新字段。 [en-US] Error code `110`: parameters are empty or invalid. Check update fields.
   * @returns {Promise<ChatRoomUpdateResult>} [zh-CN] 返回各字段是否更新成功。 [en-US] Returns whether each field was updated.
   */
  public updateInfo(input: ChatRoomUpdateInfoInput): Promise<ChatRoomUpdateResult> {
    return this.manager.updateChatRoomInfo({
      chatRoomId: this.chatRoomId,
      ...input,
    });
  }

  /**
   * [zh-CN] 退出当前聊天室。
   * [en-US] Leaves the current chat room.
   *
   * @example [zh-CN] 调用示例（退出聊天室） [en-US] Usage example (leave chat room)
   * ```ts
   * await chatRoom.leaveChatRoom();
   * ```
   * @param this - [zh-CN] 当前 `ChatRoom` 对象已绑定固定 `chatRoomId`，无需额外参数。 [en-US] The current `ChatRoom` object is bound to a fixed `chatRoomId`; no extra parameter is required.
   * @operation leaveChatRoom
   * @throws {SDKError} [zh-CN] 错误码见下方错误清单；常见原因是聊天室不存在或连接状态异常。 [en-US] See the error matrix below; common causes include a missing chat room or abnormal connection state.
   * @returns {Promise<void>} [zh-CN] 成功时无返回业务数据。 [en-US] Resolves with no business payload on success.
   */
  public leaveChatRoom(): Promise<void> {
    return this.manager.leaveChatRoom(this.toTarget());
  }

  /**
   * [zh-CN] 获取当前聊天室成员列表。
   * [en-US] Gets members of the current chat room.
   *
   * @example [zh-CN] 调用示例（获取成员） [en-US] Usage example (get members)
   * ```ts
   * const members = await chatRoom.getMembers({ pageSize: 20 });
   * ```
   * @param query - [zh-CN] 游标分页参数；未传时使用服务端默认分页。 [en-US] Cursor pagination parameters; server defaults are used when omitted.
   * @operation getChatRoomMemberList
   * @throws {ValidationError} [zh-CN] 错误码 `110`：分页参数非法。解决方式：检查 `pageSize/cursor`。 [en-US] Error code `110`: pagination parameters are invalid. Check `pageSize/cursor`.
   * @returns {Promise<ChatRoomMemberListResult>} [zh-CN] 返回成员列表、游标与是否还有下一页。 [en-US] Returns members, cursor, and whether another page may be available.
   */
  public getMembers(query: CursorPageParams = {}): Promise<ChatRoomMemberListResult> {
    return this.manager.getMemberList({
      chatRoomId: this.chatRoomId,
      ...query,
    });
  }

  /**
   * [zh-CN] 从当前聊天室移除成员。
   * [en-US] Removes members from the current chat room.
   *
   * @example [zh-CN] 调用示例（移除成员） [en-US] Usage example (remove members)
   * ```ts
   * const result = await chatRoom.removeMembers({ userIds: ['user-1'] });
   * ```
   * @param input - [zh-CN] 移除输入，`userIds` 必填且至少包含一个用户 ID。 [en-US] Removal input; `userIds` is required and must contain at least one user ID.
   * @operation removeChatRoomMembers
   * @throws {ValidationError} [zh-CN] 错误码 `110`：`userIds` 为空或格式非法。解决方式：传入有效用户 ID 列表。 [en-US] Error code `110`: `userIds` is empty or invalid. Pass a valid user ID list.
   * @returns {Promise<ChatRoomMemberActionListResult>} [zh-CN] 返回每个目标用户的移除结果。 [en-US] Returns removal result for each target user.
   */
  public removeMembers(input: ChatRoomUserBatchInput): Promise<ChatRoomMemberActionListResult> {
    return this.manager.removeMembers(this.toUserBatchParams(input));
  }

  /**
   * [zh-CN] 获取当前聊天室管理员列表。
   * [en-US] Gets administrators of the current chat room.
   *
   * @example [zh-CN] 调用示例（获取管理员） [en-US] Usage example (get administrators)
   * ```ts
   * const admins = await chatRoom.getAdminList();
   * ```
   * @param this - [zh-CN] 当前 `ChatRoom` 对象已绑定固定 `chatRoomId`，无需额外参数。 [en-US] The current `ChatRoom` object is bound to a fixed `chatRoomId`; no extra parameter is required.
   * @operation getChatRoomAdminList
   * @throws {SDKError} [zh-CN] 错误码见下方错误清单；常见原因是聊天室不存在。 [en-US] See the error matrix below; a common cause is that the chat room does not exist.
   * @returns {Promise<ReadonlyArray<UserInfo>>} [zh-CN] 返回管理员用户资料列表。 [en-US] Returns administrator user profiles.
   */
  public getAdminList(): Promise<ReadonlyArray<UserInfo>> {
    return this.manager.getAdminList(this.toTarget());
  }

  /**
   * [zh-CN] 将用户设置为当前聊天室管理员。
   * [en-US] Sets a user as an administrator of the current chat room.
   *
   * @example [zh-CN] 调用示例（添加管理员） [en-US] Usage example (add administrator)
   * ```ts
   * await chatRoom.addAdmin({ userId: 'user-1' });
   * ```
   * @param input - [zh-CN] 管理员输入，`userId` 必填。 [en-US] Administrator input; `userId` is required.
   * @operation setChatRoomAdmin
   * @throws {ValidationError} [zh-CN] 错误码 `110`：`userId` 为空。解决方式：传入有效用户 ID。 [en-US] Error code `110`: `userId` is empty. Pass a valid user ID.
   * @returns {Promise<void>} [zh-CN] 成功时无返回业务数据。 [en-US] Resolves with no business payload on success.
   */
  public addAdmin(input: ChatRoomAdminInput): Promise<void> {
    return this.manager.addAdmin({
      chatRoomId: this.chatRoomId,
      userId: input.userId,
    });
  }

  /**
   * [zh-CN] 移除当前聊天室管理员。
   * [en-US] Removes an administrator from the current chat room.
   *
   * @example [zh-CN] 调用示例（移除管理员） [en-US] Usage example (remove administrator)
   * ```ts
   * await chatRoom.removeAdmin({ userId: 'user-1' });
   * ```
   * @param input - [zh-CN] 管理员输入，`userId` 必填。 [en-US] Administrator input; `userId` is required.
   * @operation removeChatRoomAdmin
   * @throws {ValidationError} [zh-CN] 错误码 `110`：`userId` 为空。解决方式：传入有效用户 ID。 [en-US] Error code `110`: `userId` is empty. Pass a valid user ID.
   * @returns {Promise<void>} [zh-CN] 成功时无返回业务数据。 [en-US] Resolves with no business payload on success.
   */
  public removeAdmin(input: ChatRoomAdminInput): Promise<void> {
    return this.manager.removeAdmin({
      chatRoomId: this.chatRoomId,
      userId: input.userId,
    });
  }

  /**
   * [zh-CN] 获取当前聊天室禁言列表。
   * [en-US] Gets the mute list of the current chat room.
   *
   * @example [zh-CN] 调用示例（获取禁言列表） [en-US] Usage example (get mute list)
   * ```ts
   * const mutes = await chatRoom.getMuteList({ pageNum: 1, pageSize: 20 });
   * ```
   * @param page - [zh-CN] 页码分页参数；未传时使用服务端默认分页。 [en-US] Page pagination parameters; server defaults are used when omitted.
   * @operation getChatRoomMuteList
   * @throws {ValidationError} [zh-CN] 错误码 `110`：分页参数非法。解决方式：检查 `pageNum/pageSize`。 [en-US] Error code `110`: pagination parameters are invalid. Check `pageNum/pageSize`.
   * @returns {Promise<ReadonlyArray<ChatRoomMuteEntry>>} [zh-CN] 返回禁言用户与过期时间列表。 [en-US] Returns muted users and expiration information.
   */
  public getMuteList(page?: ChatRoomPageParams): Promise<ReadonlyArray<ChatRoomMuteEntry>> {
    return this.manager.getMuteList({ ...this.toTarget(), ...page });
  }

  /**
   * [zh-CN] 禁言当前聊天室成员。
   * [en-US] Mutes members in the current chat room.
   *
   * @example [zh-CN] 调用示例（禁言成员） [en-US] Usage example (mute members)
   * ```ts
   * await chatRoom.muteMembers({ userIds: ['user-1'], duration: 3600 });
   * ```
   * @param input - [zh-CN] 禁言输入，包含非空 `userIds` 与禁言时长 `duration`（秒）。 [en-US] Mute input containing non-empty `userIds` and `duration` in seconds.
   * @operation muteChatRoomMembers
   * @throws {ValidationError} [zh-CN] 错误码 `110`：参数非法。解决方式：检查 `userIds/duration`。 [en-US] Error code `110`: invalid parameters. Check `userIds/duration`.
   * @returns {Promise<void>} [zh-CN] 成功时无返回业务数据。 [en-US] Resolves with no business payload on success.
   */
  public muteMembers(input: ChatRoomMuteMembersInput): Promise<void> {
    return this.manager.muteMembers({
      chatRoomId: this.chatRoomId,
      userIds: input.userIds,
      duration: input.duration,
    });
  }

  /**
   * [zh-CN] 解除当前聊天室成员禁言。
   * [en-US] Unmutes members in the current chat room.
   *
   * @example [zh-CN] 调用示例（解除禁言） [en-US] Usage example (unmute members)
   * ```ts
   * await chatRoom.unmuteMembers({ userIds: ['user-1'] });
   * ```
   * @param input - [zh-CN] 解除禁言输入，`userIds` 必填且至少包含一个用户 ID。 [en-US] Unmute input; `userIds` is required and must contain at least one user ID.
   * @operation unmuteChatRoomMembers
   * @throws {ValidationError} [zh-CN] 错误码 `110`：`userIds` 为空或格式非法。解决方式：传入有效用户 ID 列表。 [en-US] Error code `110`: `userIds` is empty or invalid. Pass a valid user ID list.
   * @returns {Promise<void>} [zh-CN] 成功时无返回业务数据。 [en-US] Resolves with no business payload on success.
   */
  public unmuteMembers(input: ChatRoomUserBatchInput): Promise<void> {
    return this.manager.unmuteMembers(this.toUserBatchParams(input));
  }

  /**
   * [zh-CN] 开启当前聊天室全员禁言。
   * [en-US] Enables all-member mute in the current chat room.
   *
   * @example [zh-CN] 调用示例（开启全员禁言） [en-US] Usage example (mute all members)
   * ```ts
   * await chatRoom.muteAllMembers();
   * ```
   * @param this - [zh-CN] 当前 `ChatRoom` 对象已绑定固定 `chatRoomId`，无需额外参数。 [en-US] The current `ChatRoom` object is bound to a fixed `chatRoomId`; no extra parameter is required.
   * @operation muteAllChatRoomMembers
   * @throws {SDKError} [zh-CN] 错误码见下方错误清单；常见原因是权限不足或聊天室不存在。 [en-US] See the error matrix below; common causes include insufficient permission or missing chat room.
   * @returns {Promise<void>} [zh-CN] 成功时无返回业务数据。 [en-US] Resolves with no business payload on success.
   */
  public muteAllMembers(): Promise<void> {
    return this.manager.muteAllMembers(this.toTarget());
  }

  /**
   * [zh-CN] 关闭当前聊天室全员禁言。
   * [en-US] Disables all-member mute in the current chat room.
   *
   * @example [zh-CN] 调用示例（关闭全员禁言） [en-US] Usage example (unmute all members)
   * ```ts
   * await chatRoom.unmuteAllMembers();
   * ```
   * @param this - [zh-CN] 当前 `ChatRoom` 对象已绑定固定 `chatRoomId`，无需额外参数。 [en-US] The current `ChatRoom` object is bound to a fixed `chatRoomId`; no extra parameter is required.
   * @operation unmuteAllChatRoomMembers
   * @throws {SDKError} [zh-CN] 错误码见下方错误清单；常见原因是权限不足或聊天室不存在。 [en-US] See the error matrix below; common causes include insufficient permission or missing chat room.
   * @returns {Promise<void>} [zh-CN] 成功时无返回业务数据。 [en-US] Resolves with no business payload on success.
   */
  public unmuteAllMembers(): Promise<void> {
    return this.manager.unmuteAllMembers(this.toTarget());
  }

  /**
   * [zh-CN] 查询当前用户是否在当前聊天室禁言列表中。
   * [en-US] Checks whether the current user is muted in the current chat room.
   *
   * @example [zh-CN] 调用示例（查询禁言状态） [en-US] Usage example (check mute status)
   * ```ts
   * const status = await chatRoom.checkIfInMuteList();
   * ```
   * @param this - [zh-CN] 当前 `ChatRoom` 对象已绑定固定 `chatRoomId`，无需额外参数。 [en-US] The current `ChatRoom` object is bound to a fixed `chatRoomId`; no extra parameter is required.
   * @operation isCurrentUserMutedInChatRoom
   * @throws {SDKError} [zh-CN] 错误码见下方错误清单；常见原因是聊天室不存在。 [en-US] See the error matrix below; a common cause is that the chat room does not exist.
   * @returns {Promise<ChatRoomMuteStatus>} [zh-CN] 返回当前用户是否被禁言及过期时间。 [en-US] Returns whether the current user is muted and the expiration timestamp.
   */
  public checkIfInMuteList(): Promise<ChatRoomMuteStatus> {
    return this.manager.checkIfInMuteList(this.toTarget());
  }

  /**
   * [zh-CN] 获取当前聊天室黑名单。
   * [en-US] Gets the blocklist of the current chat room.
   *
   * @example [zh-CN] 调用示例（获取黑名单） [en-US] Usage example (get blocklist)
   * ```ts
   * const blocklist = await chatRoom.getBlocklist({ pageNum: 1, pageSize: 20 });
   * ```
   * @param page - [zh-CN] 页码分页参数；未传时使用服务端默认分页。 [en-US] Page pagination parameters; server defaults are used when omitted.
   * @operation getChatRoomBlocklist
   * @throws {ValidationError} [zh-CN] 错误码 `110`：分页参数非法。解决方式：检查 `pageNum/pageSize`。 [en-US] Error code `110`: pagination parameters are invalid. Check `pageNum/pageSize`.
   * @returns {Promise<ReadonlyArray<ChatRoomBlocklistEntry>>} [zh-CN] 返回黑名单用户列表。 [en-US] Returns blocked users.
   */
  public getBlocklist(page?: ChatRoomPageParams): Promise<ReadonlyArray<ChatRoomBlocklistEntry>> {
    return this.manager.getBlocklist({ ...this.toTarget(), ...page });
  }

  /**
   * [zh-CN] 将成员加入当前聊天室黑名单。
   * [en-US] Adds members to the blocklist of the current chat room.
   *
   * @example [zh-CN] 调用示例（拉黑成员） [en-US] Usage example (block members)
   * ```ts
   * const result = await chatRoom.blockMembers({ userIds: ['user-1'] });
   * ```
   * @param input - [zh-CN] 拉黑输入，`userIds` 必填且至少包含一个用户 ID。 [en-US] Block input; `userIds` is required and must contain at least one user ID.
   * @operation blockChatRoomMembers
   * @throws {ValidationError} [zh-CN] 错误码 `110`：`userIds` 为空或格式非法。解决方式：传入有效用户 ID 列表。 [en-US] Error code `110`: `userIds` is empty or invalid. Pass a valid user ID list.
   * @returns {Promise<ChatRoomMemberActionListResult>} [zh-CN] 返回每个目标用户的拉黑结果。 [en-US] Returns block result for each target user.
   */
  public blockMembers(input: ChatRoomUserBatchInput): Promise<ChatRoomMemberActionListResult> {
    return this.manager.blockMembers(this.toUserBatchParams(input));
  }

  /**
   * [zh-CN] 从当前聊天室黑名单移除成员。
   * [en-US] Removes members from the blocklist of the current chat room.
   *
   * @example [zh-CN] 调用示例（移除黑名单） [en-US] Usage example (unblock members)
   * ```ts
   * const result = await chatRoom.unblockMembers({ userIds: ['user-1'] });
   * ```
   * @param input - [zh-CN] 移除输入，`userIds` 必填且至少包含一个用户 ID。 [en-US] Removal input; `userIds` is required and must contain at least one user ID.
   * @operation unblockChatRoomMembers
   * @throws {ValidationError} [zh-CN] 错误码 `110`：`userIds` 为空或格式非法。解决方式：传入有效用户 ID 列表。 [en-US] Error code `110`: `userIds` is empty or invalid. Pass a valid user ID list.
   * @returns {Promise<ChatRoomMemberActionListResult>} [zh-CN] 返回每个目标用户的移除结果。 [en-US] Returns unblock result for each target user.
   */
  public unblockMembers(input: ChatRoomUserBatchInput): Promise<ChatRoomMemberActionListResult> {
    return this.manager.unblockMembers(this.toUserBatchParams(input));
  }

  /**
   * [zh-CN] 获取当前聊天室 allowlist。
   * [en-US] Gets the allowlist of the current chat room.
   *
   * @example [zh-CN] 调用示例（获取 allowlist） [en-US] Usage example (get allowlist)
   * ```ts
   * const allowlist = await chatRoom.getAllowlist();
   * ```
   * @param this - [zh-CN] 当前 `ChatRoom` 对象已绑定固定 `chatRoomId`，无需额外参数。 [en-US] The current `ChatRoom` object is bound to a fixed `chatRoomId`; no extra parameter is required.
   * @operation getChatRoomAllowlist
   * @throws {SDKError} [zh-CN] 错误码见下方错误清单；常见原因是聊天室不存在。 [en-US] See the error matrix below; a common cause is that the chat room does not exist.
   * @returns {Promise<ReadonlyArray<ChatRoomAllowlistEntry>>} [zh-CN] 返回 allowlist 用户列表。 [en-US] Returns allowlisted users.
   */
  public getAllowlist(): Promise<ReadonlyArray<{ readonly user: UserInfo }>> {
    return this.manager.getAllowlist(this.toTarget());
  }

  /**
   * [zh-CN] 将用户加入当前聊天室 allowlist。
   * [en-US] Adds users to the allowlist of the current chat room.
   *
   * @example [zh-CN] 调用示例（添加 allowlist） [en-US] Usage example (add users to allowlist)
   * ```ts
   * const result = await chatRoom.addUsersToAllowlist({ userIds: ['user-1'] });
   * ```
   * @param input - [zh-CN] 添加输入，`userIds` 必填且至少包含一个用户 ID。 [en-US] Add input; `userIds` is required and must contain at least one user ID.
   * @operation addUsersToChatRoomAllowlist
   * @throws {ValidationError} [zh-CN] 错误码 `110`：`userIds` 为空或格式非法。解决方式：传入有效用户 ID 列表。 [en-US] Error code `110`: `userIds` is empty or invalid. Pass a valid user ID list.
   * @returns {Promise<ChatRoomMemberActionListResult>} [zh-CN] 返回每个目标用户的添加结果。 [en-US] Returns add result for each target user.
   */
  public addUsersToAllowlist(
    input: ChatRoomUserBatchInput
  ): Promise<ChatRoomMemberActionListResult> {
    return this.manager.addUsersToAllowlist(this.toUserBatchParams(input));
  }

  /**
   * [zh-CN] 从当前聊天室 allowlist 移除用户。
   * [en-US] Removes users from the allowlist of the current chat room.
   *
   * @example [zh-CN] 调用示例（移除 allowlist） [en-US] Usage example (remove users from allowlist)
   * ```ts
   * const result = await chatRoom.removeUsersFromAllowlist({ userIds: ['user-1'] });
   * ```
   * @param input - [zh-CN] 移除输入，`userIds` 必填且至少包含一个用户 ID。 [en-US] Removal input; `userIds` is required and must contain at least one user ID.
   * @operation removeUsersFromChatRoomAllowlist
   * @throws {ValidationError} [zh-CN] 错误码 `110`：`userIds` 为空或格式非法。解决方式：传入有效用户 ID 列表。 [en-US] Error code `110`: `userIds` is empty or invalid. Pass a valid user ID list.
   * @returns {Promise<ChatRoomMemberActionListResult>} [zh-CN] 返回每个目标用户的移除结果。 [en-US] Returns removal result for each target user.
   */
  public removeUsersFromAllowlist(
    input: ChatRoomUserBatchInput
  ): Promise<ChatRoomMemberActionListResult> {
    return this.manager.removeUsersFromAllowlist(this.toUserBatchParams(input));
  }

  /**
   * [zh-CN] 查询当前用户是否在当前聊天室 allowlist 中。
   * [en-US] Checks whether the current user is in the allowlist of the current chat room.
   *
   * @example [zh-CN] 调用示例（查询 allowlist 状态） [en-US] Usage example (check allowlist status)
   * ```ts
   * const status = await chatRoom.checkIfInAllowList();
   * ```
   * @param this - [zh-CN] 当前 `ChatRoom` 对象已绑定固定 `chatRoomId`，无需额外参数。 [en-US] The current `ChatRoom` object is bound to a fixed `chatRoomId`; no extra parameter is required.
   * @operation checkIfInChatRoomAllowList
   * @throws {SDKError} [zh-CN] 错误码见下方错误清单；常见原因是聊天室不存在。 [en-US] See the error matrix below; a common cause is that the chat room does not exist.
   * @returns {Promise<boolean>} [zh-CN] 返回当前用户是否在 allowlist 中。 [en-US] Returns whether the current user is in the allowlist.
   */
  public checkIfInAllowList(): Promise<boolean> {
    return this.manager.checkIfInAllowList(this.toTarget());
  }

  /**
   * [zh-CN] 获取当前聊天室公告。
   * [en-US] Gets the announcement of the current chat room.
   *
   * @example [zh-CN] 调用示例（获取公告） [en-US] Usage example (get announcement)
   * ```ts
   * const announcement = await chatRoom.getAnnouncement();
   * ```
   * @param this - [zh-CN] 当前 `ChatRoom` 对象已绑定固定 `chatRoomId`，无需额外参数。 [en-US] The current `ChatRoom` object is bound to a fixed `chatRoomId`; no extra parameter is required.
   * @operation getChatRoomAnnouncement
   * @throws {SDKError} [zh-CN] 错误码见下方错误清单；常见原因是聊天室不存在。 [en-US] See the error matrix below; a common cause is that the chat room does not exist.
   * @returns {Promise<ChatRoomAnnouncement>} [zh-CN] 返回聊天室 ID 与公告内容。 [en-US] Returns the chat room ID and announcement content.
   */
  public getAnnouncement(): Promise<ChatRoomAnnouncement> {
    return this.manager.getAnnouncement(this.toTarget());
  }

  /**
   * [zh-CN] 更新当前聊天室公告。
   * [en-US] Updates the announcement of the current chat room.
   *
   * @example [zh-CN] 调用示例（更新公告） [en-US] Usage example (update announcement)
   * ```ts
   * await chatRoom.updateAnnouncement({ announcement: 'Welcome' });
   * ```
   * @param input - [zh-CN] 公告更新输入，`announcement` 必填。 [en-US] Announcement update input; `announcement` is required.
   * @operation updateChatRoomAnnouncement
   * @throws {ValidationError} [zh-CN] 错误码 `110`：公告为空或长度超限。解决方式：传入服务端允许范围内的公告内容。 [en-US] Error code `110`: announcement is empty or too long. Pass announcement content accepted by the server.
   * @returns {Promise<void>} [zh-CN] 成功时无返回业务数据。 [en-US] Resolves with no business payload on success.
   */
  public updateAnnouncement(input: ChatRoomAnnouncementUpdateInput): Promise<void> {
    return this.manager.updateAnnouncement({
      chatRoomId: this.chatRoomId,
      announcement: input.announcement,
    });
  }

  /**
   * [zh-CN] 获取当前聊天室属性。
   * [en-US] Gets attributes of the current chat room.
   *
   * @example [zh-CN] 调用示例（获取属性） [en-US] Usage example (get attributes)
   * ```ts
   * const snapshot = await chatRoom.getAttributes({ keys: ['topic'] });
   * ```
   * @param input - [zh-CN] 查询输入，可传 `keys` 获取指定属性；未传时获取全部属性。 [en-US] Query input; pass `keys` to get selected attributes or omit it to get all attributes.
   * @operation getChatRoomAttributes
   * @throws {ValidationError} [zh-CN] 错误码 `110`：`keys` 为空字符串或格式非法。解决方式：传入合法属性 key 列表。 [en-US] Error code `110`: `keys` contains empty or invalid values. Pass valid attribute keys.
   * @returns {Promise<ChatRoomAttributesSnapshot>} [zh-CN] 返回聊天室属性快照。 [en-US] Returns a chat room attributes snapshot.
   */
  public getAttributes(
    input: GetChatRoomAttributesInput = {}
  ): Promise<ChatRoomAttributesSnapshot> {
    return this.manager.getAttributes({
      chatRoomId: this.chatRoomId,
      keys: input.keys,
    });
  }

  /**
   * [zh-CN] 设置当前聊天室属性。
   * [en-US] Sets attributes of the current chat room.
   *
   * @example [zh-CN] 调用示例（设置属性） [en-US] Usage example (set attributes)
   * ```ts
   * const result = await chatRoom.setAttributes({
   *   attributes: { topic: 'sdk' },
   *   autoDelete: true,
   * });
   * ```
   * @param input - [zh-CN] 设置输入，包含非空 `attributes`，可选 `autoDelete/isForced`。 [en-US] Set input containing non-empty `attributes` and optional `autoDelete/isForced`.
   * @operation setChatRoomAttributes
   * @throws {ValidationError} [zh-CN] 错误码 `110`：属性 key/value 或参数格式非法。解决方式：传入合法字符串键值对。 [en-US] Error code `110`: attribute key/value or parameter format is invalid. Pass valid string key-value pairs.
   * @returns {Promise<ChatRoomAttributeMutationResult>} [zh-CN] 返回成功应用和失败的属性 key。 [en-US] Returns applied and failed attribute keys.
   */
  public setAttributes(
    input: SetChatRoomAttributesInput
  ): Promise<ChatRoomAttributeMutationResult> {
    return this.manager.setAttributes({
      chatRoomId: this.chatRoomId,
      attributes: input.attributes,
      autoDelete: input.autoDelete,
      isForced: input.isForced,
    });
  }

  /**
   * [zh-CN] 删除当前聊天室属性。
   * [en-US] Removes attributes of the current chat room.
   *
   * @example [zh-CN] 调用示例（删除属性） [en-US] Usage example (remove attributes)
   * ```ts
   * const result = await chatRoom.removeAttributes({ keys: ['topic'] });
   * ```
   * @param input - [zh-CN] 删除输入，`keys` 必填且至少包含一个属性 key，可选 `isForced`。 [en-US] Removal input; `keys` is required and must contain at least one attribute key, with optional `isForced`.
   * @operation removeChatRoomAttributes
   * @throws {ValidationError} [zh-CN] 错误码 `110`：`keys` 为空或格式非法。解决方式：传入合法属性 key 列表。 [en-US] Error code `110`: `keys` is empty or invalid. Pass valid attribute keys.
   * @returns {Promise<ChatRoomAttributeMutationResult>} [zh-CN] 返回成功删除和失败的属性 key。 [en-US] Returns removed and failed attribute keys.
   */
  public removeAttributes(
    input: RemoveChatRoomAttributesInput
  ): Promise<ChatRoomAttributeMutationResult> {
    return this.manager.removeAttributes({
      chatRoomId: this.chatRoomId,
      keys: input.keys,
      isForced: input.isForced,
    });
  }

  private toTarget(): ChatRoomMutationTarget {
    return {
      chatRoomId: this.chatRoomId,
    };
  }

  private toUserBatchParams(input: ChatRoomUserBatchInput): ChatRoomUserBatchInput & {
    readonly chatRoomId: string;
  } {
    return {
      chatRoomId: this.chatRoomId,
      userIds: input.userIds,
    };
  }
}
