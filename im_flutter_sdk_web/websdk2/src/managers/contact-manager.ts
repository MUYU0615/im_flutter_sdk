/**
 * [zh-CN] ContactManager 对外管理器实现，负责读取联系人快照、联系人关系写操作和黑名单管理。
 * [en-US] Public ContactManager implementation for reading contact snapshots, mutating contact relations, and managing blocklist APIs.
 */

import type { ChatClient } from '../chat-client';
import { RestClient } from '../rest/client';
import { mergeRuntimeErrorMaps } from '../rest/error-map-types';
import { COMMON_ERROR_MAP } from '../rest/error-maps/common';
import { CONTACT_ERROR_MAP } from '../rest/error-maps/contact';
import {
  assertNormalizedUserIds,
  requestAcceptContactInvite,
  requestAddContact,
  requestAddUsersToBlocklist,
  requestDeclineContactInvite,
  requestDeleteContact,
  requestGetBlocklist,
  requestRemoveUsersFromBlocklist,
  requestSetContactRemark,
} from '../rest/contact-management';
import {
  buildFetchUserInfoByUserIdRequest,
  buildUserInfoFetchEndpoint,
  normalizeFetchedUserInfos,
} from '../rest/user-info';
import { resolveContactUserInfoMap } from './contact/contact-user-info-resolver';
import type {
  AddContactParams,
  BlocklistAddResult,
  BlocklistMutationParams,
  BlocklistSnapshot,
  Contact,
  ContactEventHandlerMap,
  ContactMutationTarget,
  SetContactRemarkParams,
} from '../types';
import type { RestContext } from '../types/chat-client';
import type { ManagerBase, ManagerEventContext } from '../types/manager';
import type { UserInfo } from '../types/user-info';
import { ERROR_CODES } from '../utils/error-codes';
import { SDKError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';
import { RosterSyncController } from '../core/contact-sync/roster-sync-controller';
import type { ContactSyncDependencies } from '../core/contact-sync/roster-sync-types';

type ValidationRule = 'required' | 'invalid_format';

interface ValidationFieldError {
  readonly path: string;
  readonly message: string;
  readonly rule: ValidationRule;
}

interface UserInfoReadCapability extends ManagerBase<ChatClient> {
  getUserInfoByUserId(params: {
    readonly userIds: ReadonlyArray<string>;
  }): Promise<ReadonlyArray<UserInfo>>;
}

interface UserInfoCapabilityProvider {
  getManagerByCapability(capability: 'userInfo:read'): ManagerBase<ChatClient> | null;
}

const EMPTY_BLOCKLIST_SNAPSHOT: BlocklistSnapshot = {
  items: [],
  loaded: false,
  source: 'server',
};

const CONTACT_REST_ERROR_MAP = mergeRuntimeErrorMaps(COMMON_ERROR_MAP, CONTACT_ERROR_MAP);

export class ContactManager implements ManagerBase<ChatClient> {
  /** @internal SDK 内部管理器注册键，不对外文档暴露。 */
  public static readonly key = 'contactManager' as const;

  private client: ChatClient | null = null;
  private eventContext: ManagerEventContext | null = null;
  private restClient: RestClient | null = null;
  private restBaseUrl: string | null = null;
  private restToken: string | null = null;
  private blocklistSnapshot: BlocklistSnapshot = EMPTY_BLOCKLIST_SNAPSHOT;
  private blocklistSessionKey: string | null = null;

  /**
   * @internal
   * [zh-CN] 绑定 ContactManager 到 ChatClient，通常由 SDK 在 `client.contactManager` 初始化阶段调用。
   * [en-US] Binds ContactManager to ChatClient and is usually called internally during `client.contactManager` initialization.
   *
   * @param client - [zh-CN] 已初始化的 ChatClient 实例。 [en-US] Initialized ChatClient instance.
   * @param context - [zh-CN] 联系人事件上下文，用于注册与移除联系人同步事件处理器。 [en-US] Contact event context used to register and remove contact sync handlers.
   * @returns {void} [zh-CN] 无返回值。 [en-US] Returns nothing.
   */
  public bind(client: ChatClient, context?: ManagerEventContext): void {
    this.client = client;
    this.eventContext = context ?? null;
    this.blocklistSnapshot = EMPTY_BLOCKLIST_SNAPSHOT;
    this.blocklistSessionKey = null;
  }

  /**
   * [zh-CN] 获取当前内存中的联系人列表视图。
   * [en-US] Gets the current in-memory contact list view.
   *
   * @example [zh-CN] 调用示例（读取联系人列表） [en-US] Usage example (read contact list)
   * ```ts
   * const contacts = client.contactManager.getContacts();
   * console.log(contacts[0]?.userId);
   * ```
   *
   * @returns {ReadonlyArray<Contact>} [zh-CN] 返回当前联系人列表；若暂无可用数据则返回空数组。 [en-US] Returns the current contact list, or an empty array when no usable data is available.
   */
  public getContacts(): ReadonlyArray<Contact> {
    return this.client?.getContactSnapshot()?.items ?? [];
  }

  /**
   * [zh-CN] 发送联系人申请。
   * [en-US] Sends a contact invitation.
   *
   * @example [zh-CN] 调用示例（发送联系人申请） [en-US] Usage example (send a contact invitation)
   * ```ts
   * await client.contactManager.addContact({
   *   userId: 'user-1',
   *   message: '我是 Alice',
   * });
   * ```
   *
   * @param params - [zh-CN] 目标用户与可选验证消息。 [en-US] Target user and optional invitation message.
   * @returns {Promise<void>} [zh-CN] 成功时仅表示请求完成。 [en-US] Resolves on success with no business payload.
   */
  public async addContact(params: AddContactParams): Promise<void> {
    return this.runOperation('addContact', async (): Promise<void> => {
      const userId = this.validateUserId(params.userId, 'params.userId');
      const message = this.validateOptionalString(params.message, 'params.message');
      const context = this.getRestContextOrThrow();
      const client = this.getRestClient(context);

      logger.debug('ContactManager addContact', {
        userId,
        hasMessage: typeof message === 'string' && message.length > 0,
      });

      await requestAddContact(client, context, {
        userId,
        message,
      });
    });
  }

  /**
   * [zh-CN] 删除联系人，并立即修补当前会话中的联系人快照。
   * [en-US] Deletes a contact and immediately patches the in-session contact snapshot.
   *
   * @example [zh-CN] 调用示例（删除联系人） [en-US] Usage example (delete a contact)
   * ```ts
   * await client.contactManager.deleteContact({
   *   userId: 'user-1',
   * });
   * ```
   *
   * @param params - [zh-CN] 目标用户。 [en-US] Target user.
   * @returns {Promise<void>} [zh-CN] 成功时仅表示请求完成。 [en-US] Resolves on success with no business payload.
   */
  public async deleteContact(params: ContactMutationTarget): Promise<void> {
    return this.runOperation('deleteContact', async (): Promise<void> => {
      const userId = this.validateUserId(params.userId, 'params.userId');
      const context = this.getRestContextOrThrow();
      const client = this.getRestClient(context);

      logger.debug('ContactManager deleteContact', { userId });

      await requestDeleteContact(client, context, { userId });

      const patchResult = this.client?.getCacheManager()?.removeContact(userId);
      logger.debug('ContactManager deleteContact patched cache', {
        userId,
        changed: patchResult?.changed ?? false,
      });
    });
  }

  /**
   * [zh-CN] 接受联系人申请，并触发受控联系人刷新。
   * [en-US] Accepts a contact invitation and triggers a controlled contact refresh.
   *
   * @example [zh-CN] 调用示例（接受联系人申请） [en-US] Usage example (accept a contact invitation)
   * ```ts
   * await client.contactManager.acceptContactInvite({
   *   userId: 'user-1',
   * });
   * ```
   *
   * @param params - [zh-CN] 目标用户。 [en-US] Target user.
   * @returns {Promise<void>} [zh-CN] 成功时仅表示请求完成。 [en-US] Resolves on success with no business payload.
   */
  public async acceptContactInvite(params: ContactMutationTarget): Promise<void> {
    return this.runOperation('acceptContactInvite', async (): Promise<void> => {
      const userId = this.validateUserId(params.userId, 'params.userId');
      const context = this.getRestContextOrThrow();
      const client = this.getRestClient(context);

      logger.debug('ContactManager acceptContactInvite', { userId });

      await requestAcceptContactInvite(client, context, { userId });
      await this.requireClient().refreshContactSnapshot();
    });
  }

  /**
   * [zh-CN] 拒绝联系人申请。
   * [en-US] Declines a contact invitation.
   *
   * @example [zh-CN] 调用示例（拒绝联系人申请） [en-US] Usage example (decline a contact invitation)
   * ```ts
   * await client.contactManager.declineContactInvite({
   *   userId: 'user-1',
   * });
   * ```
   *
   * @param params - [zh-CN] 目标用户。 [en-US] Target user.
   * @returns {Promise<void>} [zh-CN] 成功时仅表示请求完成。 [en-US] Resolves on success with no business payload.
   */
  public async declineContactInvite(params: ContactMutationTarget): Promise<void> {
    return this.runOperation('declineContactInvite', async (): Promise<void> => {
      const userId = this.validateUserId(params.userId, 'params.userId');
      const context = this.getRestContextOrThrow();
      const client = this.getRestClient(context);

      logger.debug('ContactManager declineContactInvite', { userId });

      await requestDeclineContactInvite(client, context, { userId });
    });
  }

  /**
   * [zh-CN] 设置联系人备注，允许传入空字符串以清空备注。
   * [en-US] Sets a contact remark. Empty string is allowed to clear the remark.
   *
   * @example [zh-CN] 调用示例（设置联系人备注） [en-US] Usage example (set a contact remark)
   * ```ts
   * await client.contactManager.setContactRemark({
   *   userId: 'user-1',
   *   remark: '产品同学',
   * });
   * ```
   *
   * @param params - [zh-CN] 目标用户与备注内容。 [en-US] Target user and remark content.
   * @returns {Promise<void>} [zh-CN] 成功时仅表示请求完成。 [en-US] Resolves on success with no business payload.
   */
  public async setContactRemark(params: SetContactRemarkParams): Promise<void> {
    return this.runOperation('setContactRemark', async (): Promise<void> => {
      const userId = this.validateUserId(params.userId, 'params.userId');
      const remark = this.validateRemark(params.remark, 'params.remark');
      const context = this.getRestContextOrThrow();
      const client = this.getRestClient(context);

      logger.debug('ContactManager setContactRemark', {
        userId,
        remarkLength: remark.length,
      });

      await requestSetContactRemark(client, context, {
        userId,
        remark,
      });

      const patchResult = this.client?.getCacheManager()?.updateContactRemark(userId, remark);
      logger.debug('ContactManager setContactRemark patched cache', {
        userId,
        changed: patchResult?.changed ?? false,
      });
    });
  }

  /**
   * [zh-CN] 获取当前用户的黑名单列表。
   * [en-US] Gets the current user's blocklist.
   *
   * @example [zh-CN] 调用示例（获取黑名单） [en-US] Usage example (get blocklist)
   * ```ts
   * const blocklist = await client.contactManager.getBlocklist();
   * console.log(blocklist.map(item => item.userId));
   * ```
   *
   * @returns {Promise<ReadonlyArray<UserInfo>>} [zh-CN] 返回黑名单用户资料列表。 [en-US] Returns blocked user profiles.
   */
  public async getBlocklist(): Promise<ReadonlyArray<UserInfo>> {
    return this.runOperation('getBlocklist', async (): Promise<ReadonlyArray<UserInfo>> => {
      const context = this.getRestContextOrThrow();
      this.ensureBlocklistSession(context);
      const client = this.getRestClient(context);

      if (this.blocklistSnapshot.loaded) {
        return this.blocklistSnapshot.items;
      }

      const items = await this.enrichBlocklistUsers(
        await requestGetBlocklist(client, context)
      );
      this.blocklistSnapshot = {
        items,
        loaded: true,
        source: 'server',
      };

      logger.debug('ContactManager getBlocklist', {
        count: items.length,
      });

      return items;
    });
  }

  /**
   * [zh-CN] 批量添加黑名单用户，重复值会在请求前去重并保持原始顺序。
   * [en-US] Adds users to the blocklist. Duplicate values are deduplicated before request while preserving input order.
   *
   * @example [zh-CN] 调用示例（添加黑名单） [en-US] Usage example (add users to blocklist)
   * ```ts
   * const result = await client.contactManager.addUsersToBlocklist({
   *   userIds: ['user-1', 'user-2'],
   * });
   * ```
   *
   * @param params - [zh-CN] 待加入黑名单的用户 ID 列表。 [en-US] User ids to add to the blocklist.
   * @returns {Promise<BlocklistAddResult>} [zh-CN] 返回成功与失败两类用户资料列表。 [en-US] Returns succeeded and failed user profile lists.
   */
  public async addUsersToBlocklist(params: BlocklistMutationParams): Promise<BlocklistAddResult> {
    return this.runOperation('addUsersToBlocklist', async (): Promise<BlocklistAddResult> => {
      const context = this.getRestContextOrThrow();
      this.ensureBlocklistSession(context);
      const userIds = assertNormalizedUserIds(params, 'params.userIds');
      const client = this.getRestClient(context);

      logger.debug('ContactManager addUsersToBlocklist', {
        userIds,
        inputCount: params.userIds.length,
        normalizedCount: userIds.length,
      });

      const result = await requestAddUsersToBlocklist(client, context, userIds);
      const addedEntries = await this.enrichBlocklistUsers(result.succeeded);
      this.blocklistSnapshot = this.patchBlocklistSnapshotWithAdditions(addedEntries);

      return {
        succeeded: addedEntries,
        failed: await this.enrichBlocklistUsers(result.failed),
      };
    });
  }

  /**
   * [zh-CN] 批量移除黑名单用户，重复值会在请求前去重并保持原始顺序。
   * [en-US] Removes users from the blocklist. Duplicate values are deduplicated before request while preserving input order.
   *
   * @example [zh-CN] 调用示例（移除黑名单） [en-US] Usage example (remove users from blocklist)
   * ```ts
   * await client.contactManager.removeUserFromBlocklist({
   *   userIds: ['user-1'],
   * });
   * ```
   *
   * @param params - [zh-CN] 待移除的黑名单用户 ID 列表。 [en-US] User ids to remove from the blocklist.
   * @returns {Promise<void>} [zh-CN] 成功时仅表示请求完成。 [en-US] Resolves on success with no business payload.
   */
  public async removeUserFromBlocklist(params: BlocklistMutationParams): Promise<void> {
    return this.runOperation('removeUserFromBlocklist', async (): Promise<void> => {
      const context = this.getRestContextOrThrow();
      this.ensureBlocklistSession(context);
      const userIds = assertNormalizedUserIds(params, 'params.userIds');
      const client = this.getRestClient(context);

      logger.debug('ContactManager removeUserFromBlocklist', {
        userIds,
        inputCount: params.userIds.length,
        normalizedCount: userIds.length,
      });

      await requestRemoveUsersFromBlocklist(client, context, userIds);
      this.blocklistSnapshot = this.patchBlocklistSnapshotWithRemovals(userIds);
    });
  }

  /**
   * [zh-CN] 注册联系人事件处理器，用于接收联系人关系事件；自动同步进度请在 ChatClient 级监听统一同步事件。
   * [en-US] Registers contact event handlers for contact relation events. Observe automatic sync progress through ChatClient-level unified sync events.
   *
   * @example [zh-CN] 调用示例（监听联系人添加事件） [en-US] Usage example (listen for contact added events)
   * ```ts
   * client.contactManager.addEventHandler('contact-ui', {
   *   onContactAdded: event => {
   *     console.log(event.from);
   *   },
   * });
   * ```
   *
   * @param id - [zh-CN] 事件处理器唯一 ID，用于后续移除。 [en-US] Unique handler id used for later removal.
   * @param handlers - [zh-CN] 联系人事件处理器集合，按需实现对应回调。 [en-US] Contact handler collection with callbacks implemented as needed.
   * @returns {void} [zh-CN] 注册完成后无返回值。 [en-US] Returns nothing after registration.
   */
  public addEventHandler(id: string, handlers: ContactEventHandlerMap): void {
    this.eventContext?.addEventHandler(id, handlers);
  }

  /**
   * [zh-CN] 移除已注册的联系人同步事件处理器。
   * [en-US] Removes a previously registered contact sync event handler.
   *
   * @example [zh-CN] 调用示例（移除联系人事件处理器） [en-US] Usage example (remove a contact event handler)
   * ```ts
   * client.contactManager.removeEventHandler('contact-ui');
   * ```
   *
   * @param id - [zh-CN] 待移除的事件处理器 ID。 [en-US] Handler id to remove.
   * @returns {void} [zh-CN] 移除完成后无返回值。 [en-US] Returns nothing after removal.
   */
  public removeEventHandler(id: string): void {
    this.eventContext?.removeEventHandler(id);
  }

  private async runOperation<T>(name: string, operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const sdkError = this.normalizeSdkError(name, error);
      logger.warn(`ContactManager ${name} failed`, {
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
      return new SDKError(`ContactManager ${name} failed: ${error.message}`, ERROR_CODES.UNKNOWN);
    }
    return new SDKError(`ContactManager ${name} failed`, ERROR_CODES.UNKNOWN);
  }

  private requireClient(): ChatClient {
    if (!this.client) {
      throw this.buildValidationError('ContactManager is not bound to client', [
        {
          path: 'contactManager.client',
          message: 'ContactManager is not bound to client',
          rule: 'required',
        },
      ]);
    }
    return this.client;
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

    this.restClient = new RestClient(context.restBaseUrl, { errorMap: CONTACT_REST_ERROR_MAP });
    this.restClient.setAuthToken(context.token);
    this.restBaseUrl = context.restBaseUrl;
    this.restToken = context.token;
    return this.restClient;
  }

  private ensureBlocklistSession(context: RestContext): void {
    const sessionKey = `${context.restBaseUrl}:${context.userId}:${context.token}`;
    if (this.blocklistSessionKey === sessionKey) {
      return;
    }

    this.blocklistSessionKey = sessionKey;
    this.blocklistSnapshot = EMPTY_BLOCKLIST_SNAPSHOT;
  }

  private patchBlocklistSnapshotWithAdditions(
    entries: ReadonlyArray<UserInfo>
  ): BlocklistSnapshot {
    const itemMap = new Map(this.blocklistSnapshot.items.map(item => [item.userId, item]));

    for (const entry of entries) {
      itemMap.set(entry.userId, entry);
    }

    return {
      items: Array.from(itemMap.values()),
      loaded: this.blocklistSnapshot.loaded,
      source: 'mutation_patch',
    };
  }

  private patchBlocklistSnapshotWithRemovals(userIds: ReadonlyArray<string>): BlocklistSnapshot {
    const itemMap = new Map(this.blocklistSnapshot.items.map(item => [item.userId, item]));

    for (const userId of userIds) {
      itemMap.delete(userId);
    }

    return {
      items: Array.from(itemMap.values()),
      loaded: this.blocklistSnapshot.loaded,
      source: 'mutation_patch',
    };
  }

  private validateUserId(value: unknown, path: string): string {
    if (typeof value !== 'string') {
      throw this.buildValidationError('userId must be a string', [
        {
          path,
          message: 'userId must be a string',
          rule: 'invalid_format',
        },
      ]);
    }

    const trimmed = value.trim();
    if (!trimmed) {
      throw this.buildValidationError('userId is required', [
        {
          path,
          message: 'userId is required',
          rule: 'required',
        },
      ]);
    }

    return trimmed;
  }

  private validateOptionalString(value: unknown, path: string): string | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (typeof value !== 'string') {
      throw this.buildValidationError(`${path} must be a string`, [
        {
          path,
          message: `${path} must be a string`,
          rule: 'invalid_format',
        },
      ]);
    }
    return value;
  }

  private validateRemark(value: unknown, path: string): string {
    if (typeof value !== 'string') {
      throw this.buildValidationError('remark must be a string', [
        {
          path,
          message: 'remark must be a string',
          rule: 'invalid_format',
        },
      ]);
    }
    return value;
  }

  private buildValidationError(
    message: string,
    fields: ReadonlyArray<ValidationFieldError>
  ): ValidationError {
    const code = fields.some(field => field.rule === 'invalid_format')
      ? ERROR_CODES.VALIDATION_INVALID_FORMAT
      : ERROR_CODES.VALIDATION_REQUIRED;

    return new ValidationError(message, {
      code,
      details: {
        fields,
      },
    });
  }

  private async enrichBlocklistUsers(
    users: ReadonlyArray<UserInfo>
  ): Promise<ReadonlyArray<UserInfo>> {
    if (users.length === 0 || !this.requireClient().isUserInfoSyncEnabled()) {
      return users;
    }

    const userInfoMap = await resolveContactUserInfoMap(
      users.map(user => user.userId),
      {
        cacheManager: this.requireClient().getCacheManager(),
        fetchUserInfos: async ({ userIds }): Promise<ReadonlyArray<UserInfo>> => {
          return await this.fetchUserInfos(userIds);
        },
      }
    );

    return users.map(user => userInfoMap.get(user.userId) ?? user);
  }

  private async fetchUserInfos(
    userIds: ReadonlyArray<string>
  ): Promise<ReadonlyArray<UserInfo>> {
    if (userIds.length === 0) {
      return [];
    }

    try {
      const manager = this.getUserInfoManager();
      if (!manager) {
        return await this.fetchUserInfosFromRest(userIds);
      }
      return await manager.getUserInfoByUserId({
        userIds,
      });
    } catch (error) {
      logger.warn('ContactManager user info fetch failed', {
        userIds,
        error,
      });
      return [];
    }
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

  /** @internal */
  public createSyncController(deps: ContactSyncDependencies): RosterSyncController {
    return new RosterSyncController(deps);
  }
}
