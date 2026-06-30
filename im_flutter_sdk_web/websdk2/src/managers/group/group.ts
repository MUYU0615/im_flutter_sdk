/**
 * [zh-CN] 轻量 Group 单群对象。
 * [en-US] Lightweight single-group facade.
 */

import type { GroupManager } from '../group-manager';
import type {
  GroupAllowlistEntry,
  GroupAnnouncement,
  GroupAnnouncementUpdateInput,
  GroupBlocklistEntry,
  GroupDeleteSharedFileInput,
  GroupDetail,
  GroupDownloadSharedFileInput,
  GroupGetMembersAttributesInput,
  GroupMemberListQuery,
  GroupMemberListResult,
  GroupMembersAttributesResult,
  GroupMuteEntry,
  GroupMuteListQuery,
  GroupMuteMembersInput,
  GroupMutationTarget,
  JoinedGroupSummary,
  NumberPageParams,
  GroupOwnerChangeInput,
  GroupSetMemberAttributesInput,
  GroupSharedFileListQuery,
  GroupSharedFileListResult,
  GroupUpdateConfigsInput,
  GroupUpdateInfoInput,
  GroupUploadSharedFileInput,
  GroupUserBatchInput,
  GroupUserBatchParams,
} from '../../types/group';
import type { UserInfo } from '../../types/user-info';

/**
 * [zh-CN] 绑定固定 `groupId` 的单群上下文对象。
 * [en-US] Single-group context object bound to a fixed `groupId`.
 */
export class Group {
  public readonly groupId: string;

  private readonly manager: GroupManager;

  public constructor(groupId: string, manager: GroupManager) {
    this.groupId = groupId;
    this.manager = manager;
  }

  /**
   * [zh-CN] 读取当前会话或本地预览中已知的已加入群轻量摘要；该方法不发起网络请求，也不代表完整群详情。
   * [en-US] Reads the known lightweight joined-group summary from the current session or local preview. This method never sends a network request and does not represent full group detail.
   *
   * @example [zh-CN] 读取本地轻量摘要 [en-US] Read local lightweight summary
   * ```ts
   * const group = client.groupManager.getGroup('group-1');
   * const summary = group.getSummary();
   * ```
   * @returns {JoinedGroupSummary | null} [zh-CN] 返回本地已知轻量摘要；未知时返回 `null`。 [en-US] Returns the known local lightweight summary, or `null` when unknown.
   */
  public getSummary(): JoinedGroupSummary | null {
    return this.manager.getGroupSummaryForHandle(this.groupId);
  }

  /**
   * [zh-CN] 获取当前群组详情；优先返回当前会话内可用快照，必要时从服务端刷新。
   * [en-US] Gets the current group detail, reusing the in-session snapshot when available and refreshing from the server when needed.
   *
   * @example [zh-CN] 获取群详情 [en-US] Get group detail
   * ```ts
   * const group = client.groupManager.getGroup('group-1');
   * const detail = await group.getDetail();
   * ```
   * @throws {ValidationError} [zh-CN] 错误码 `110`：群 ID 非法或群组不存在。 [en-US] Error code `110`: invalid group id or group not found.
   * @throws {AuthenticationError} [zh-CN] 错误码 `202`：鉴权失败。 [en-US] Error code `202`: authentication failed.
   * @returns {Promise<GroupDetail>} [zh-CN] 返回标准化群详情。 [en-US] Returns the normalized group detail.
   */
  public getDetail(): Promise<GroupDetail> {
    return this.manager.getGroupDetailForHandle(this.groupId);
  }

  /**
   * [zh-CN] 强制从服务端刷新当前群组详情。
   * [en-US] Forces a server refresh for the current group detail.
   *
   * @example [zh-CN] 刷新群详情 [en-US] Refresh group detail
   * ```ts
   * const detail = await client.groupManager.getGroup('group-1').refresh();
   * ```
   * @throws {ValidationError} [zh-CN] 错误码 `110`：群 ID 非法或群组不存在。 [en-US] Error code `110`: invalid group id or group not found.
   * @throws {AuthenticationError} [zh-CN] 错误码 `202`：鉴权失败。 [en-US] Error code `202`: authentication failed.
   * @returns {Promise<GroupDetail>} [zh-CN] 返回刷新后的标准化群详情。 [en-US] Returns the refreshed normalized group detail.
   */
  public refresh(): Promise<GroupDetail> {
    return this.manager.refreshGroupDetailForHandle(this.groupId);
  }

  /**
   * [zh-CN] 更新当前群组基础资料，例如名称、描述、头像或扩展字段。
   * [en-US] Updates basic profile fields of the current group, such as name, description, avatar, or extension.
   *
   * @example [zh-CN] 更新群名称 [en-US] Update group name
   * ```ts
   * await client.groupManager.getGroup('group-1').updateInfo({ name: 'New group name' });
   * ```
   * @param input - [zh-CN] 群资料更新字段。 [en-US] Group profile fields to update.
   * @throws {ValidationError} [zh-CN] 错误码 `110`：参数非法或群组不存在。 [en-US] Error code `110`: invalid parameters or group not found.
   * @throws {AuthenticationError} [zh-CN] 错误码 `202`：鉴权失败。 [en-US] Error code `202`: authentication failed.
   * @returns {Promise<void>} [zh-CN] 成功时无返回值。 [en-US] Resolves with no payload on success.
   */
  public updateInfo(input: GroupUpdateInfoInput): Promise<void> {
    return this.manager.updateGroupInfo({
      groupId: this.groupId,
      ...input,
    });
  }

  /**
   * [zh-CN] 更新当前群组配置，例如公开属性、入群审批、成员邀请权限或人数上限。
   * [en-US] Updates current group settings, such as visibility, join joinApprovalRequired, invite permission, or member limit.
   *
   * @example [zh-CN] 关闭成员邀请 [en-US] Disable member invitations
   * ```ts
   * await client.groupManager.getGroup('group-1').updateConfigs({ allowInvites: false });
   * ```
   * @param input - [zh-CN] 群配置更新字段。 [en-US] Group setting fields to update.
   * @throws {ValidationError} [zh-CN] 错误码 `110`：参数非法或群组不存在。 [en-US] Error code `110`: invalid parameters or group not found.
   * @throws {AuthenticationError} [zh-CN] 错误码 `202`：鉴权失败。 [en-US] Error code `202`: authentication failed.
   * @returns {Promise<void>} [zh-CN] 成功时无返回值。 [en-US] Resolves with no payload on success.
   */
  public updateConfigs(input: GroupUpdateConfigsInput): Promise<void> {
    return this.manager.updateGroupInfo({
      groupId: this.groupId,
      ...input,
    });
  }

  /**
   * [zh-CN] 转让当前群组所有权。
   * [en-US] Transfers ownership of the current group.
   *
   * @example [zh-CN] 转让群主 [en-US] Transfer group owner
   * ```ts
   * await client.groupManager.getGroup('group-1').changeOwner({ newOwner: 'user-2' });
   * ```
   * @param input - [zh-CN] 新群主用户 ID。 [en-US] New owner user id.
   * @throws {ValidationError} [zh-CN] 错误码 `110`：新群主非法、不在群内或群组不存在。 [en-US] Error code `110`: invalid new owner, user not in group, or group not found.
   * @throws {AuthenticationError} [zh-CN] 错误码 `202`：鉴权失败。 [en-US] Error code `202`: authentication failed.
   * @returns {Promise<void>} [zh-CN] 成功时无返回值。 [en-US] Resolves with no payload on success.
   */
  public changeOwner(input: GroupOwnerChangeInput): Promise<void> {
    return this.manager.changeGroupOwner({
      groupId: this.groupId,
      newOwner: input.newOwner,
    });
  }

  /**
   * [zh-CN] 解散当前群组。
   * [en-US] Destroys the current group.
   *
   * @example [zh-CN] 解散群组 [en-US] Destroy a group
   * ```ts
   * await client.groupManager.getGroup('group-1').destroy();
   * ```
   * @throws {ValidationError} [zh-CN] 错误码 `110`：群 ID 非法或群组不存在。 [en-US] Error code `110`: invalid group id or group not found.
   * @throws {AuthenticationError} [zh-CN] 错误码 `202`：鉴权失败或无权限。 [en-US] Error code `202`: authentication failed or permission denied.
   * @returns {Promise<void>} [zh-CN] 成功时无返回值。 [en-US] Resolves with no payload on success.
   */
  public destroy(): Promise<void> {
    return this.manager.destroyGroup(this.toTarget());
  }

  /**
   * [zh-CN] 当前登录用户主动退出群组。
   * [en-US] Leaves the current group as the current signed-in user.
   *
   * @example [zh-CN] 退出群组 [en-US] Leave a group
   * ```ts
   * await client.groupManager.getGroup('group-1').leave();
   * ```
   * @throws {ValidationError} [zh-CN] 错误码 `110`：群 ID 非法、群组不存在或当前用户不在群内。 [en-US] Error code `110`: invalid group id, group not found, or current user not in group.
   * @throws {AuthenticationError} [zh-CN] 错误码 `202`：鉴权失败。 [en-US] Error code `202`: authentication failed.
   * @returns {Promise<void>} [zh-CN] 成功时无返回值。 [en-US] Resolves with no payload on success.
   */
  public leave(): Promise<void> {
    return this.manager.leaveGroup(this.toTarget());
  }

  /**
   * [zh-CN] 分页获取当前群组成员列表。
   * [en-US] Gets members of the current group by page.
   *
   * @example [zh-CN] 获取群成员 [en-US] Get group members
   * ```ts
   * const page = await client.groupManager.getGroup('group-1').getMembers({ pageSize: 20 });
   * ```
   * @param query - [zh-CN] 可选分页参数。 [en-US] Optional paging parameters.
   * @throws {ValidationError} [zh-CN] 错误码 `110`：群 ID 或分页参数非法。 [en-US] Error code `110`: invalid group id or paging parameters.
   * @throws {AuthenticationError} [zh-CN] 错误码 `202`：鉴权失败。 [en-US] Error code `202`: authentication failed.
   * @returns {Promise<GroupMemberListResult>} [zh-CN] 返回成员分页结果。 [en-US] Returns the member page result.
   */
  public getMembers(query: GroupMemberListQuery = {}): Promise<GroupMemberListResult> {
    return this.manager.getGroupMemberList({
      groupId: this.groupId,
      ...query,
    });
  }

  /**
   * [zh-CN] 从当前群组移除成员。
   * [en-US] Removes members from the current group.
   *
   * @example [zh-CN] 移除群成员 [en-US] Remove group members
   * ```ts
   * await client.groupManager.getGroup('group-1').removeMembers({ userIds: ['user-2'] });
   * ```
   * @param input - [zh-CN] 待移除成员 ID 列表。 [en-US] User ids to remove.
   * @throws {ValidationError} [zh-CN] 错误码 `110`：成员列表为空、成员 ID 非法或群组不存在。 [en-US] Error code `110`: empty member list, invalid user id, or group not found.
   * @throws {AuthenticationError} [zh-CN] 错误码 `202`：鉴权失败或无权限。 [en-US] Error code `202`: authentication failed or permission denied.
   * @returns {Promise<void>} [zh-CN] 成功时无返回值。 [en-US] Resolves with no payload on success.
   */
  public removeMembers(input: GroupUserBatchInput): Promise<void> {
    return this.manager.removeGroupMembers(this.toUserBatchParams(input));
  }

  /**
   * [zh-CN] 获取当前群组管理员列表。
   * [en-US] Gets the admin list of the current group.
   *
   * @example [zh-CN] 获取管理员 [en-US] Get admins
   * ```ts
   * const admins = await client.groupManager.getGroup('group-1').getAdmins();
   * ```
   * @throws {ValidationError} [zh-CN] 错误码 `110`：群 ID 非法或群组不存在。 [en-US] Error code `110`: invalid group id or group not found.
   * @throws {AuthenticationError} [zh-CN] 错误码 `202`：鉴权失败。 [en-US] Error code `202`: authentication failed.
   * @returns {Promise<ReadonlyArray<UserInfo>>} [zh-CN] 返回管理员用户资料列表。 [en-US] Returns admin user profiles.
   */
  public getAdmins(): Promise<ReadonlyArray<UserInfo>> {
    return this.manager.getGroupAdminList(this.toTarget());
  }

  /**
   * [zh-CN] 添加群管理员。
   * [en-US] Adds a group admin.
   *
   * @example [zh-CN] 添加管理员 [en-US] Add an admin
   * ```ts
   * await client.groupManager.getGroup('group-1').addAdmin({ userId: 'user-2' });
   * ```
   * @param input - [zh-CN] 管理员用户 ID。 [en-US] Admin user id.
   * @throws {ValidationError} [zh-CN] 错误码 `110`：用户 ID 非法、用户不在群内或群组不存在。 [en-US] Error code `110`: invalid user id, user not in group, or group not found.
   * @throws {AuthenticationError} [zh-CN] 错误码 `202`：鉴权失败或无权限。 [en-US] Error code `202`: authentication failed or permission denied.
   * @returns {Promise<void>} [zh-CN] 成功时无返回值。 [en-US] Resolves with no payload on success.
   */
  public addAdmin(input: { userId: string }): Promise<void> {
    return this.manager.addGroupAdmin({
      groupId: this.groupId,
      userId: input.userId,
    });
  }

  /**
   * [zh-CN] 移除群管理员。
   * [en-US] Removes a group admin.
   *
   * @example [zh-CN] 移除管理员 [en-US] Remove an admin
   * ```ts
   * await client.groupManager.getGroup('group-1').removeAdmin({ userId: 'user-2' });
   * ```
   * @param input - [zh-CN] 管理员用户 ID。 [en-US] Admin user id.
   * @throws {ValidationError} [zh-CN] 错误码 `110`：用户 ID 非法、用户不是管理员或群组不存在。 [en-US] Error code `110`: invalid user id, user is not an admin, or group not found.
   * @throws {AuthenticationError} [zh-CN] 错误码 `202`：鉴权失败或无权限。 [en-US] Error code `202`: authentication failed or permission denied.
   * @returns {Promise<void>} [zh-CN] 成功时无返回值。 [en-US] Resolves with no payload on success.
   */
  public removeAdmin(input: { userId: string }): Promise<void> {
    return this.manager.removeGroupAdmin({
      groupId: this.groupId,
      userId: input.userId,
    });
  }

  /**
   * [zh-CN] 获取当前群组禁言列表。
   * [en-US] Gets the mute list of the current group.
   *
   * @example [zh-CN] 获取禁言列表 [en-US] Get mute list
   * ```ts
   * const mutes = await client.groupManager.getGroup('group-1').getMuteList({ pageSize: 20 });
   * ```
   * @param page - [zh-CN] 可选分页参数。 [en-US] Optional paging parameters.
   * @throws {ValidationError} [zh-CN] 错误码 `110`：群 ID 或分页参数非法。 [en-US] Error code `110`: invalid group id or paging parameters.
   * @throws {AuthenticationError} [zh-CN] 错误码 `202`：鉴权失败。 [en-US] Error code `202`: authentication failed.
   * @returns {Promise<ReadonlyArray<GroupMuteEntry>>} [zh-CN] 返回禁言成员列表。 [en-US] Returns muted member entries.
   */
  public getMuteList(page?: GroupMuteListQuery): Promise<ReadonlyArray<GroupMuteEntry>> {
    return this.manager.getGroupMuteList({ ...this.toTarget(), ...page });
  }

  /**
   * [zh-CN] 禁言当前群组中的指定成员。
   * [en-US] Mutes specified members in the current group.
   *
   * @example [zh-CN] 禁言成员 [en-US] Mute members
   * ```ts
   * await client.groupManager.getGroup('group-1').muteMembers({
   *   userIds: ['user-2'],
   *   muteDuration: 3600,
   * });
   * ```
   * @param input - [zh-CN] 成员 ID 列表与禁言时长，单位秒。 [en-US] User ids and mute duration in seconds.
   * @throws {ValidationError} [zh-CN] 错误码 `110`：成员列表为空、成员 ID 非法或禁言时长非法。 [en-US] Error code `110`: empty member list, invalid user id, or invalid mute duration.
   * @throws {AuthenticationError} [zh-CN] 错误码 `202`：鉴权失败或无权限。 [en-US] Error code `202`: authentication failed or permission denied.
   * @returns {Promise<void>} [zh-CN] 成功时无返回值。 [en-US] Resolves with no payload on success.
   */
  public muteMembers(input: GroupMuteMembersInput): Promise<void> {
    return this.manager.muteGroupMembers({
      groupId: this.groupId,
      userIds: input.userIds,
      muteDuration: input.muteDuration,
    });
  }

  /**
   * [zh-CN] 解除当前群组中指定成员的禁言。
   * [en-US] Unmutes specified members in the current group.
   *
   * @example [zh-CN] 解除禁言 [en-US] Unmute members
   * ```ts
   * await client.groupManager.getGroup('group-1').unmuteMembers({ userIds: ['user-2'] });
   * ```
   * @param input - [zh-CN] 待解除禁言的成员 ID 列表。 [en-US] User ids to unmute.
   * @throws {ValidationError} [zh-CN] 错误码 `110`：成员列表为空或成员 ID 非法。 [en-US] Error code `110`: empty member list or invalid user id.
   * @throws {AuthenticationError} [zh-CN] 错误码 `202`：鉴权失败或无权限。 [en-US] Error code `202`: authentication failed or permission denied.
   * @returns {Promise<void>} [zh-CN] 成功时无返回值。 [en-US] Resolves with no payload on success.
   */
  public unmuteMembers(input: GroupUserBatchInput): Promise<void> {
    return this.manager.unmuteGroupMembers(this.toUserBatchParams(input));
  }

  /**
   * [zh-CN] 开启当前群组全员禁言。
   * [en-US] Enables all-member mute for the current group.
   *
   * @example [zh-CN] 开启全员禁言 [en-US] Enable all-member mute
   * ```ts
   * await client.groupManager.getGroup('group-1').muteAllMembers();
   * ```
   * @throws {ValidationError} [zh-CN] 错误码 `110`：群 ID 非法或群组不存在。 [en-US] Error code `110`: invalid group id or group not found.
   * @throws {AuthenticationError} [zh-CN] 错误码 `202`：鉴权失败或无权限。 [en-US] Error code `202`: authentication failed or permission denied.
   * @returns {Promise<void>} [zh-CN] 成功时无返回值。 [en-US] Resolves with no payload on success.
   */
  public muteAllMembers(): Promise<void> {
    return this.manager.muteAllGroupMembers(this.toTarget());
  }

  /**
   * [zh-CN] 关闭当前群组全员禁言。
   * [en-US] Disables all-member mute for the current group.
   *
   * @example [zh-CN] 关闭全员禁言 [en-US] Disable all-member mute
   * ```ts
   * await client.groupManager.getGroup('group-1').unmuteAllMembers();
   * ```
   * @throws {ValidationError} [zh-CN] 错误码 `110`：群 ID 非法或群组不存在。 [en-US] Error code `110`: invalid group id or group not found.
   * @throws {AuthenticationError} [zh-CN] 错误码 `202`：鉴权失败或无权限。 [en-US] Error code `202`: authentication failed or permission denied.
   * @returns {Promise<void>} [zh-CN] 成功时无返回值。 [en-US] Resolves with no payload on success.
   */
  public unmuteAllMembers(): Promise<void> {
    return this.manager.unmuteAllGroupMembers(this.toTarget());
  }

  /**
   * [zh-CN] 获取当前群组黑名单列表。
   * [en-US] Gets the blocklist of the current group.
   *
   * @example [zh-CN] 获取群黑名单 [en-US] Get group blocklist
   * ```ts
   * const blocklist = await client.groupManager.getGroup('group-1').getBlocklist({ pageSize: 20 });
   * ```
   * @param page - [zh-CN] 可选分页参数。 [en-US] Optional paging parameters.
   * @throws {ValidationError} [zh-CN] 错误码 `110`：群 ID 或分页参数非法。 [en-US] Error code `110`: invalid group id or paging parameters.
   * @throws {AuthenticationError} [zh-CN] 错误码 `202`：鉴权失败。 [en-US] Error code `202`: authentication failed.
   * @returns {Promise<ReadonlyArray<GroupBlocklistEntry>>} [zh-CN] 返回黑名单成员列表。 [en-US] Returns blocked member entries.
   */
  public getBlocklist(page?: NumberPageParams): Promise<ReadonlyArray<GroupBlocklistEntry>> {
    return this.manager.getGroupBlocklist({ ...this.toTarget(), ...page });
  }

  /**
   * [zh-CN] 将指定成员加入当前群组黑名单。
   * [en-US] Adds specified members to the current group blocklist.
   *
   * @example [zh-CN] 加入黑名单 [en-US] Add members to blocklist
   * ```ts
   * await client.groupManager.getGroup('group-1').blockMembers({ userIds: ['user-2'] });
   * ```
   * @param input - [zh-CN] 待加入黑名单的成员 ID 列表。 [en-US] User ids to block.
   * @throws {ValidationError} [zh-CN] 错误码 `110`：成员列表为空、成员 ID 非法或群组不存在。 [en-US] Error code `110`: empty member list, invalid user id, or group not found.
   * @throws {AuthenticationError} [zh-CN] 错误码 `202`：鉴权失败或无权限。 [en-US] Error code `202`: authentication failed or permission denied.
   * @returns {Promise<void>} [zh-CN] 成功时无返回值。 [en-US] Resolves with no payload on success.
   */
  public blockMembers(input: GroupUserBatchInput): Promise<void> {
    return this.manager.blockGroupMembers(this.toUserBatchParams(input));
  }

  /**
   * [zh-CN] 将指定成员移出当前群组黑名单。
   * [en-US] Removes specified members from the current group blocklist.
   *
   * @example [zh-CN] 移出黑名单 [en-US] Remove members from blocklist
   * ```ts
   * await client.groupManager.getGroup('group-1').unblockMembers({ userIds: ['user-2'] });
   * ```
   * @param input - [zh-CN] 待移出黑名单的成员 ID 列表。 [en-US] User ids to unblock.
   * @throws {ValidationError} [zh-CN] 错误码 `110`：成员列表为空或成员 ID 非法。 [en-US] Error code `110`: empty member list or invalid user id.
   * @throws {AuthenticationError} [zh-CN] 错误码 `202`：鉴权失败或无权限。 [en-US] Error code `202`: authentication failed or permission denied.
   * @returns {Promise<void>} [zh-CN] 成功时无返回值。 [en-US] Resolves with no payload on success.
   */
  public unblockMembers(input: GroupUserBatchInput): Promise<void> {
    return this.manager.unblockGroupMembers(this.toUserBatchParams(input));
  }

  /**
   * [zh-CN] 获取当前群组白名单列表。
   * [en-US] Gets the allowlist of the current group.
   *
   * @example [zh-CN] 获取白名单 [en-US] Get allowlist
   * ```ts
   * const allowlist = await client.groupManager.getGroup('group-1').getAllowlist();
   * ```
   * @throws {ValidationError} [zh-CN] 错误码 `110`：群 ID 非法或群组不存在。 [en-US] Error code `110`: invalid group id or group not found.
   * @throws {AuthenticationError} [zh-CN] 错误码 `202`：鉴权失败。 [en-US] Error code `202`: authentication failed.
   * @returns {Promise<ReadonlyArray<GroupAllowlistEntry>>} [zh-CN] 返回白名单成员列表。 [en-US] Returns allowlisted member entries.
   */
  public getAllowlist(): Promise<ReadonlyArray<GroupAllowlistEntry>> {
    return this.manager.getGroupAllowlist(this.toTarget());
  }

  /**
   * [zh-CN] 将指定成员加入当前群组白名单。
   * [en-US] Adds specified members to the current group allowlist.
   *
   * @example [zh-CN] 加入白名单 [en-US] Add members to allowlist
   * ```ts
   * await client.groupManager.getGroup('group-1').addUsersToAllowlist({ userIds: ['user-2'] });
   * ```
   * @param input - [zh-CN] 待加入白名单的成员 ID 列表。 [en-US] User ids to add to the allowlist.
   * @throws {ValidationError} [zh-CN] 错误码 `110`：成员列表为空、成员 ID 非法或群组不存在。 [en-US] Error code `110`: empty member list, invalid user id, or group not found.
   * @throws {AuthenticationError} [zh-CN] 错误码 `202`：鉴权失败或无权限。 [en-US] Error code `202`: authentication failed or permission denied.
   * @returns {Promise<void>} [zh-CN] 成功时无返回值。 [en-US] Resolves with no payload on success.
   */
  public addUsersToAllowlist(input: GroupUserBatchInput): Promise<void> {
    return this.manager.addUsersToGroupAllowlist(this.toUserBatchParams(input));
  }

  /**
   * [zh-CN] 将指定成员移出当前群组白名单。
   * [en-US] Removes specified members from the current group allowlist.
   *
   * @example [zh-CN] 移出白名单 [en-US] Remove members from allowlist
   * ```ts
   * await client.groupManager.getGroup('group-1').removeUsersFromAllowlist({ userIds: ['user-2'] });
   * ```
   * @param input - [zh-CN] 待移出白名单的成员 ID 列表。 [en-US] User ids to remove from the allowlist.
   * @throws {ValidationError} [zh-CN] 错误码 `110`：成员列表为空或成员 ID 非法。 [en-US] Error code `110`: empty member list or invalid user id.
   * @throws {AuthenticationError} [zh-CN] 错误码 `202`：鉴权失败或无权限。 [en-US] Error code `202`: authentication failed or permission denied.
   * @returns {Promise<void>} [zh-CN] 成功时无返回值。 [en-US] Resolves with no payload on success.
   */
  public removeUsersFromAllowlist(input: GroupUserBatchInput): Promise<void> {
    return this.manager.removeUsersFromGroupAllowlist(this.toUserBatchParams(input));
  }

  /**
   * [zh-CN] 查询当前用户是否在当前群组白名单中。
   * [en-US] Checks whether the current user is in the current group allowlist.
   *
   * @example [zh-CN] 查询是否在白名单 [en-US] Check allowlist membership
   * ```ts
   * const inAllowlist = await client.groupManager.getGroup('group-1').checkIfInAllowList();
   * ```
   * @throws {ValidationError} [zh-CN] 错误码 `110`：群 ID 非法或群组不存在。 [en-US] Error code `110`: invalid group id or group not found.
   * @throws {AuthenticationError} [zh-CN] 错误码 `202`：鉴权失败。 [en-US] Error code `202`: authentication failed.
   * @returns {Promise<boolean>} [zh-CN] 当前用户在白名单中返回 `true`。 [en-US] Returns `true` when the current user is in the allowlist.
   */
  public checkIfInAllowList(): Promise<boolean> {
    return this.manager.checkIfInGroupAllowList({
      groupId: this.groupId,
    });
  }

  /**
   * [zh-CN] 查询当前用户是否在当前群组禁言列表中。
   * [en-US] Checks whether the current user is in the current group mute list.
   *
   * @example [zh-CN] 查询是否被禁言 [en-US] Check mute-list membership
   * ```ts
   * const muted = await client.groupManager.getGroup('group-1').checkIfInMuteList();
   * ```
   * @throws {ValidationError} [zh-CN] 错误码 `110`：群 ID 非法或群组不存在。 [en-US] Error code `110`: invalid group id or group not found.
   * @throws {AuthenticationError} [zh-CN] 错误码 `202`：鉴权失败。 [en-US] Error code `202`: authentication failed.
   * @returns {Promise<boolean>} [zh-CN] 当前用户在禁言列表中返回 `true`。 [en-US] Returns `true` when the current user is muted.
   */
  public checkIfInMuteList(): Promise<boolean> {
    return this.manager.checkIfInGroupMuteList(this.toTarget());
  }

  /**
   * [zh-CN] 获取当前群组公告。
   * [en-US] Gets the current group announcement.
   *
   * @example [zh-CN] 获取群公告 [en-US] Get group announcement
   * ```ts
   * const announcement = await client.groupManager.getGroup('group-1').getAnnouncement();
   * ```
   * @throws {ValidationError} [zh-CN] 错误码 `110`：群 ID 非法或群组不存在。 [en-US] Error code `110`: invalid group id or group not found.
   * @throws {AuthenticationError} [zh-CN] 错误码 `202`：鉴权失败。 [en-US] Error code `202`: authentication failed.
   * @returns {Promise<GroupAnnouncement>} [zh-CN] 返回群公告对象。 [en-US] Returns the group announcement object.
   */
  public getAnnouncement(): Promise<GroupAnnouncement> {
    return this.manager.getGroupAnnouncement(this.toTarget());
  }

  /**
   * [zh-CN] 更新当前群组公告。
   * [en-US] Updates the current group announcement.
   *
   * @example [zh-CN] 更新群公告 [en-US] Update group announcement
   * ```ts
   * await client.groupManager.getGroup('group-1').updateAnnouncement({ announcement: 'Welcome' });
   * ```
   * @param input - [zh-CN] 新公告内容。 [en-US] New announcement content.
   * @throws {ValidationError} [zh-CN] 错误码 `110`：公告内容非法或群组不存在。 [en-US] Error code `110`: invalid announcement or group not found.
   * @throws {AuthenticationError} [zh-CN] 错误码 `202`：鉴权失败或无权限。 [en-US] Error code `202`: authentication failed or permission denied.
   * @returns {Promise<void>} [zh-CN] 成功时无返回值。 [en-US] Resolves with no payload on success.
   */
  public updateAnnouncement(input: GroupAnnouncementUpdateInput): Promise<void> {
    return this.manager.updateGroupAnnouncement({
      groupId: this.groupId,
      announcement: input.announcement,
    });
  }

  /**
   * [zh-CN] 分页获取当前群组共享文件列表。
   * [en-US] Gets shared files of the current group by page.
   *
   * @example [zh-CN] 获取共享文件 [en-US] Get shared files
   * ```ts
   * const files = await client.groupManager.getGroup('group-1').getSharedFileList({ pageSize: 20 });
   * ```
   * @param query - [zh-CN] 可选分页参数。 [en-US] Optional paging parameters.
   * @throws {ValidationError} [zh-CN] 错误码 `110`：群 ID 或分页参数非法。 [en-US] Error code `110`: invalid group id or paging parameters.
   * @throws {AuthenticationError} [zh-CN] 错误码 `202`：鉴权失败。 [en-US] Error code `202`: authentication failed.
   * @returns {Promise<GroupSharedFileListResult>} [zh-CN] 返回共享文件分页结果。 [en-US] Returns the shared-file page result.
   */
  public getSharedFileList(
    query: GroupSharedFileListQuery = {}
  ): Promise<GroupSharedFileListResult> {
    return this.manager.getGroupSharedFileList({
      groupId: this.groupId,
      ...query,
    });
  }

  /**
   * [zh-CN] 上传文件到当前群组共享文件列表。
   * [en-US] Uploads a file to the current group shared-file list.
   *
   * @example [zh-CN] 上传共享文件 [en-US] Upload a shared file
   * ```ts
   * await client.groupManager.getGroup('group-1').uploadSharedFile({
   *   file,
   *   onFileUploadProgress: event => console.log(event.loaded),
   * });
   * ```
   * @param input - [zh-CN] 文件对象与上传回调。 [en-US] File object and upload callbacks.
   * @throws {ValidationError} [zh-CN] 错误码 `110`：群 ID 或文件参数非法。 [en-US] Error code `110`: invalid group id or file parameter.
   * @throws {AuthenticationError} [zh-CN] 错误码 `202`：鉴权失败或无权限。 [en-US] Error code `202`: authentication failed or permission denied.
   * @throws {SDKError} [zh-CN] 错误码 `1`：上传被取消或平台上传失败。 [en-US] Error code `1`: upload cancelled or platform upload failed.
   * @returns {Promise<void>} [zh-CN] 成功时无返回值。 [en-US] Resolves with no payload on success.
   */
  public uploadSharedFile(input: GroupUploadSharedFileInput): Promise<void> {
    return this.manager.uploadGroupSharedFile({
      groupId: this.groupId,
      ...input,
    });
  }

  /**
   * [zh-CN] 删除当前群组共享文件。
   * [en-US] Deletes a shared file from the current group.
   *
   * @example [zh-CN] 删除共享文件 [en-US] Delete a shared file
   * ```ts
   * await client.groupManager.getGroup('group-1').deleteSharedFile({ fileId: 'file-1' });
   * ```
   * @param input - [zh-CN] 共享文件 ID。 [en-US] Shared file id.
   * @throws {ValidationError} [zh-CN] 错误码 `110`：群 ID 或文件 ID 非法。 [en-US] Error code `110`: invalid group id or file id.
   * @throws {AuthenticationError} [zh-CN] 错误码 `202`：鉴权失败或无权限。 [en-US] Error code `202`: authentication failed or permission denied.
   * @returns {Promise<void>} [zh-CN] 成功时无返回值。 [en-US] Resolves with no payload on success.
   */
  public deleteSharedFile(input: GroupDeleteSharedFileInput): Promise<void> {
    return this.manager.deleteGroupSharedFile({
      groupId: this.groupId,
      fileId: input.fileId,
    });
  }

  /**
   * [zh-CN] 下载当前群组共享文件，下载完成后通过回调返回 Blob 数据。
   * [en-US] Downloads a shared file of the current group and returns Blob data through callbacks.
   *
   * @example [zh-CN] 下载共享文件 [en-US] Download a shared file
   * ```ts
   * await client.groupManager.getGroup('group-1').downloadSharedFile({
   *   fileId: 'file-1',
   *   onFileDownloadComplete: blob => console.log(blob.size),
   * });
   * ```
   * @param input - [zh-CN] 文件 ID、可选 secret 与下载回调。 [en-US] File id, optional secret, and download callbacks.
   * @throws {ValidationError} [zh-CN] 错误码 `110`：群 ID 或文件 ID 非法。 [en-US] Error code `110`: invalid group id or file id.
   * @throws {AuthenticationError} [zh-CN] 错误码 `202`：鉴权失败。 [en-US] Error code `202`: authentication failed.
   * @throws {SDKError} [zh-CN] 错误码 `303`：HTTP 下载失败。 [en-US] Error code `303`: HTTP download failed.
   * @returns {Promise<void>} [zh-CN] 下载流程完成时 resolve。 [en-US] Resolves when the download flow finishes.
   */
  public downloadSharedFile(input: GroupDownloadSharedFileInput): Promise<void> {
    return this.manager.downloadGroupSharedFile({
      groupId: this.groupId,
      ...input,
    });
  }

  /**
   * [zh-CN] 设置当前群组中指定成员的自定义属性；常用于群名片。
   * [en-US] Sets custom member attributes in the current group, commonly used for group name cards.
   *
   * @example [zh-CN] 设置群名片 [en-US] Set a group name card
   * ```ts
   * await client.groupManager.getGroup('group-1').setMemberAttributes({
   *   userId: 'user-1',
   *   memberAttributes: { groupNamecard: 'Alice' },
   * });
   * ```
   * @param input - [zh-CN] 成员 ID 与属性键值。 [en-US] Member user id and attribute key-value pairs.
   * @throws {ValidationError} [zh-CN] 错误码 `110`：成员 ID、属性 key 或 value 非法。 [en-US] Error code `110`: invalid user id, attribute key, or attribute value.
   * @throws {SDKError} [zh-CN] 错误码 `4`：属性数量或长度达到服务限制。 [en-US] Error code `4`: attribute count or length exceeds service limits.
   * @throws {AuthenticationError} [zh-CN] 错误码 `202`：鉴权失败或无权限。 [en-US] Error code `202`: authentication failed or permission denied.
   * @returns {Promise<void>} [zh-CN] 成功时无返回值。 [en-US] Resolves with no payload on success.
   */
  public setMemberAttributes(input: GroupSetMemberAttributesInput): Promise<void> {
    return this.manager.setGroupMemberAttributes({
      groupId: this.groupId,
      userId: input.userId,
      memberAttributes: input.memberAttributes,
    });
  }

  /**
   * [zh-CN] 批量获取当前群组中多个成员的自定义属性。
   * [en-US] Gets custom member attributes for multiple members in the current group.
   *
   * @example [zh-CN] 批量获取成员属性 [en-US] Get multiple members' attributes
   * ```ts
   * const result = await client.groupManager.getGroup('group-1').getMembersAttributes({
   *   userIds: ['user-1', 'user-2'],
   *   keys: ['groupNamecard'],
   * });
   * ```
   * @param input - [zh-CN] 成员 ID 列表与可选属性 key 列表。 [en-US] Member user ids and optional attribute keys.
   * @throws {ValidationError} [zh-CN] 错误码 `110`：成员列表为空、成员 ID 或属性 key 非法。 [en-US] Error code `110`: empty member list, invalid user id, or invalid attribute key.
   * @throws {AuthenticationError} [zh-CN] 错误码 `202`：鉴权失败。 [en-US] Error code `202`: authentication failed.
   * @returns {Promise<GroupMembersAttributesResult>} [zh-CN] 返回按成员 ID 索引的属性集合。 [en-US] Returns attributes indexed by member user id.
   */
  public getMembersAttributes(
    input: GroupGetMembersAttributesInput
  ): Promise<GroupMembersAttributesResult> {
    return this.manager.getGroupMembersAttributes({
      groupId: this.groupId,
      userIds: input.userIds,
      keys: input.keys,
    });
  }

  private toTarget(): GroupMutationTarget {
    return {
      groupId: this.groupId,
    };
  }

  private toUserBatchParams(input: GroupUserBatchInput): GroupUserBatchParams {
    return {
      groupId: this.groupId,
      userIds: input.userIds,
    };
  }
}
