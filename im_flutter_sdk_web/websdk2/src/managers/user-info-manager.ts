/**
 * [zh-CN] UserInfoManager 对外管理器实现，负责用户资料查询、更新与缓存桥接。
 * [en-US] Public UserInfoManager implementation for profile fetch, update, and cache projection.
 */

import type { ChatClient } from '../chat-client';
import type { UserInfoSummary } from '../cache/cache-types';
import { isRecord } from '../cache/cache-utils';
import { normalizeProfileVersionFromTimestamp } from '../core/message/profile-sync/profile-version';
import { RestClient } from '../rest/client';
import { mergeRuntimeErrorMaps } from '../rest/error-map-types';
import { COMMON_ERROR_MAP } from '../rest/error-maps/common';
import { USER_INFO_ERROR_MAP } from '../rest/error-maps/user-info';
import {
  buildFetchUserInfoByAttributeRequest,
  buildFetchUserInfoByUserIdRequest,
  buildUpdateOwnInfoByAttributeFormBody,
  buildUpdateOwnInfoFormBody,
  buildUserInfoFetchEndpoint,
  buildUserInfoUpdateEndpoint,
  normalizeUserInfoFetchRecords,
  normalizeUserInfoAttributes,
  normalizeUserInfoTargetIds,
} from '../rest/user-info';
import {
  buildGetSubscribedUserInfoListEndpoint,
  buildSubscribeUserInfoChangesEndpoint,
  buildSubscribeUserInfoChangesRequest,
  buildUnsubscribeUserInfoChangesEndpoint,
  readSubscribedUserIdsFromEnvelope,
} from '../rest/user-info-subscription';
import type { RestContext } from '../types/chat-client';
import { ContactEventName } from '../types/event-system';
import type { EventHandlerId, UserInfoEventHandlerMap } from '../types/event-system';
import type { ManagerBase, ManagerEventContext, RawNotifyEvent } from '../types/manager';
import type {
  FetchUserInfoByAttributeParams,
  FetchUserInfoByUserIdParams,
  ServerUserInfoAttributes,
  SubscribeUsersInfoParams,
  UnsubscribeUsersInfoParams,
  UpdateOwnInfoParams,
  UserInfoAttribute,
  UserInfo,
  UserInfoRawNotifyEvent,
} from '../types/user-info';
import { ERROR_CODES } from '../utils/error-codes';
import { SDKError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';
import { normalizeUserInfoNotify } from './user-info/user-info-notify-normalizer';

interface NormalizedUserInfoRecord {
  readonly profile: UserInfo;
  readonly lastModified?: number;
}

const USER_INFO_KEYS = [
  'nickname',
  'avatarUrl',
  'mail',
  'phone',
  'gender',
  'sign',
  'birth',
  'ext',
] as const;

const USER_INFO_REST_ERROR_MAP = mergeRuntimeErrorMaps(COMMON_ERROR_MAP, USER_INFO_ERROR_MAP);

type UserInfoKey = (typeof USER_INFO_KEYS)[number];

export class UserInfoManager implements ManagerBase<ChatClient> {
  /** @internal SDK 内部管理器注册键，不对外文档暴露。 */
  public static readonly key = 'userInfoManager' as const;
  public readonly capabilities = ['userInfo:read', 'rawNotify:userInfo'] as const;

  private client: ChatClient | null = null;
  private eventContext: ManagerEventContext | null = null;
  private restClient: RestClient | null = null;
  private restBaseUrl: string | null = null;
  private restToken: string | null = null;

  /**
   * @internal
   * [zh-CN] 绑定 UserInfoManager 到 ChatClient，通常由 SDK 在 `client.userInfoManager` 初始化阶段调用。
   * [en-US] Binds UserInfoManager to ChatClient and is usually called internally during `client.userInfoManager` initialization.
   *
   * @param client - [zh-CN] 已初始化的 ChatClient 实例。 [en-US] Initialized ChatClient instance.
   * @param context - [zh-CN] Manager 事件上下文。 [en-US] Manager event context.
   * @returns {void} [zh-CN] 无返回值。 [en-US] Returns nothing.
   */
  public bind(client: ChatClient, context?: ManagerEventContext): void {
    this.client = client;
    this.eventContext = context ?? null;
  }

  /**
   * [zh-CN] 注册用户资料事件处理器，用于接收当前用户资料更新和订阅用户资料变更通知。
   * [en-US] Registers user profile event handlers for current-user updates and subscribed profile changes.
   *
   * @example [zh-CN] 调用示例（注册事件处理器） [en-US] Usage example (register event handlers)
   * ```ts
   * client.userInfoManager.addEventHandler('profile-listener', {
   *   onOwnInfoUpdated: profile => {
   *     console.log(profile.nickname);
   *   },
   *   onUserInfoUpdated: users => {
   *     console.log(users.map(user => user.userId));
   *   },
   * });
   * ```
   *
   * @param id - [zh-CN] 事件处理器 ID，同一个 ID 再次注册会覆盖旧处理器。 [en-US] Event handler ID; registering the same ID again replaces the previous handler.
   * @param handlers - [zh-CN] 用户资料事件处理器集合。 [en-US] User profile event handler map.
   * @returns {void} [zh-CN] 无返回值。 [en-US] Returns nothing.
   */
  public addEventHandler(id: EventHandlerId, handlers: UserInfoEventHandlerMap): void {
    this.eventContext?.addEventHandler(id, handlers);
  }

  /**
   * [zh-CN] 移除指定 ID 的用户资料事件处理器，停止接收对应事件回调。
   * [en-US] Removes the user profile event handler with the specified ID and stops its callbacks.
   *
   * @example [zh-CN] 调用示例（移除事件处理器） [en-US] Usage example (remove an event handler)
   * ```ts
   * client.userInfoManager.removeEventHandler('profile-listener');
   * ```
   *
   * @param id - [zh-CN] 注册时传入的事件处理器 ID。 [en-US] Event handler ID used during registration.
   * @returns {void} [zh-CN] 无返回值。 [en-US] Returns nothing.
   */
  public removeEventHandler(id: EventHandlerId): void {
    this.eventContext?.removeEventHandler(id);
  }

  /**
   * @internal
   * [zh-CN] 处理 SDK 内部转发的用户资料原始 notify。
   * [en-US] Handles raw user-info notifies forwarded internally by the SDK.
   *
   * @param event - [zh-CN] 用户资料原始通知事件。 [en-US] Raw user-info notify event.
   * @returns {void} [zh-CN] 无返回值。 [en-US] Returns nothing.
   */
  public handleRawNotify(event: RawNotifyEvent): void {
    if (event.type !== 'userInfo') {
      return;
    }
    const client = this.client;
    const cacheManager = client?.getCacheManager();
    if (!client || !cacheManager || !client.getCurrentUserId()) {
      return;
    }

    const payload = event.payload as UserInfoRawNotifyEvent;
    const patch = normalizeUserInfoNotify(payload);
    if (!patch) {
      return;
    }

    const mergeResult = cacheManager.applyUserInfoNotifyPatch(patch);
    if (!mergeResult.applied) {
      logger.debug('User-info notify ignored', {
        userId: patch.userId,
        notifyType: payload.notifyType,
        reason: mergeResult.reason,
        lastModified: patch.lastModified,
      });
      return;
    }

    cacheManager.updateUserInfoSummaryFromRuntime(patch.userId);
    client.refreshConversationDisplayFromUserInfos?.([
      {
        userId: patch.userId,
        lastModified: patch.lastModified,
      },
    ]);

    if (patch.source === 'subscription') {
      this.eventContext?.dispatch?.('onUserInfoUpdated', [mergeResult.record.profile]);
      return;
    }

    if (patch.source === 'own') {
      this.eventContext?.dispatch?.('onOwnInfoUpdated', mergeResult.record.profile);
      return;
    }

    const contact = client.getContactSnapshot()?.items.find(item => item.userId === patch.userId);
    this.eventContext?.dispatch?.(ContactEventName.CONTACT_INFO_UPDATED, {
      userInfo: mergeResult.record.profile,
      contact,
    });
  }

  /**
   * [zh-CN] 按用户 ID 查询用户资料属性；未指定属性时查询 SDK 默认资料字段。
   * [en-US] Fetches user profile attributes by user IDs; when no attribute projection is provided, SDK default profile fields are returned.
   *
   * @example [zh-CN] 调用示例（按用户 ID 查询） [en-US] Usage example (fetch by user IDs)
   * ```ts
   * const users = await client.userInfoManager.getUserInfoByUserId({
   *   userIds: ['alice', 'bob'],
   * });
   * console.log(users[0]?.avatarUrl);
   * ```
   *
   * @param params - [zh-CN] 包含 `userIds` 与可选成功/失败回调的参数对象。 [en-US] Parameter object containing `userIds` and optional success/error callbacks.
   * @returns {Promise<ReadonlyArray<UserInfo>>} [zh-CN] 返回标准化后的用户资料数组，仅包含服务端命中的用户。 [en-US] Returns normalized user profiles and only includes users returned by the server.
   */
  public async getUserInfoByUserId(
    params: FetchUserInfoByUserIdParams
  ): Promise<ReadonlyArray<UserInfo>> {
    return this.runOperation(
      'getUserInfoByUserId',
      async (): Promise<ReadonlyArray<UserInfo>> => {
        const context = this.getRestContextOrThrow();
        const client = this.getRestClient(context);
        const requestBody = buildFetchUserInfoByUserIdRequest(
          normalizeUserInfoTargetIds(params.userIds, 'params.userIds')
        );
        const endpoint = buildUserInfoFetchEndpoint(context);

        logger.debug('UserInfoManager getUserInfoByUserId', {
          userIds: requestBody.targets,
        });

        const response = await client.request<unknown>(endpoint, {
          method: 'POST',
          body: requestBody,
          operation: 'getUserInfoByUserId',
        });
        const records = this.normalizeFetchEnvelope(response, requestBody.targets);
        this.writeCache(records);
        return records.map(record => record.profile);
      }
    );
  }

  /**
   * [zh-CN] 按用户 ID 和指定属性集查询用户资料，适合只读取昵称、头像等部分字段。
   * [en-US] Fetches selected user profile attributes by user IDs, useful when only fields such as nickname or avatar are needed.
   *
   * @example [zh-CN] 调用示例（按属性集查询） [en-US] Usage example (fetch by attribute projection)
   * ```ts
   * const users = await client.userInfoManager.getUserInfoByAttribute({
   *   userIds: ['alice'],
   *   attributes: ['nickname', 'avatarUrl'],
   * });
   * console.log(users[0]?.nickname);
   * ```
   *
   * @param params - [zh-CN] 包含 `userIds`、`attributes` 与可选回调的参数对象。 [en-US] Parameter object containing `userIds`, `attributes`, and optional callbacks.
   * @returns {Promise<ReadonlyArray<UserInfo>>} [zh-CN] 返回标准化后的用户资料数组。 [en-US] Returns normalized user profiles.
   */
  public async getUserInfoByAttribute(
    params: FetchUserInfoByAttributeParams
  ): Promise<ReadonlyArray<UserInfo>> {
    return this.runOperation(
      'getUserInfoByAttribute',
      async (): Promise<ReadonlyArray<UserInfo>> => {
        const context = this.getRestContextOrThrow();
        const client = this.getRestClient(context);
        const requestBody = buildFetchUserInfoByAttributeRequest(
          normalizeUserInfoTargetIds(params.userIds, 'params.userIds'),
          normalizeUserInfoAttributes(params.attributes, 'params.attributes')
        );
        const endpoint = buildUserInfoFetchEndpoint(context);

        logger.debug('UserInfoManager getUserInfoByAttribute', {
          userIds: requestBody.targets,
          attributes: requestBody.properties,
        });

        const response = await client.request<unknown>(endpoint, {
          method: 'POST',
          body: requestBody,
          operation: 'getUserInfoByAttribute',
        });
        const records = this.normalizeFetchEnvelope(response, requestBody.targets);
        this.writeCache(records);
        return records.map(record => record.profile);
      }
    );
  }

  /**
   * [zh-CN] 订阅指定陌生人用户的资料变化；订阅成功后可通过用户资料事件处理器接收变更通知。
   * [en-US] Subscribes to profile change notifications of target strangers; after subscription, changes can be received through user profile event handlers.
   *
   * @example [zh-CN] 调用示例（订阅资料变化） [en-US] Usage example (subscribe to profile changes)
   * ```ts
   * await client.userInfoManager.subscribeUsersInfo({
   *   userIds: ['alice', 'bob'],
   * });
   * ```
   *
   * @param params - [zh-CN] 包含 `userIds` 与可选回调的参数对象。 [en-US] Parameter object containing `userIds` and optional callbacks.
   * @returns {Promise<void>} [zh-CN] 成功时无返回值。 [en-US] Resolves with no payload on success.
   */
  public async subscribeUsersInfo(params: SubscribeUsersInfoParams): Promise<void> {
    return this.runOperation('subscribeUsersInfo', async (): Promise<void> => {
      const context = this.getRestContextOrThrow();
      const client = this.getRestClient(context);
      const endpoint = buildSubscribeUserInfoChangesEndpoint(context);
      const requestBody = buildSubscribeUserInfoChangesRequest(params.userIds);

      logger.debug('UserInfoManager subscribeUsersInfo', {
        userIds: requestBody.usernames,
      });

      await client.request<unknown>(endpoint, {
        method: 'POST',
        body: requestBody,
        operation: 'subscribeUsersInfo',
      });
    });
  }

  /**
   * [zh-CN] 取消订阅指定陌生人用户的资料变化；取消后不再接收这些用户的资料变更通知。
   * [en-US] Unsubscribes from profile change notifications of target strangers; after removal, their profile changes are no longer delivered.
   *
   * @example [zh-CN] 调用示例（取消订阅资料变化） [en-US] Usage example (unsubscribe from profile changes)
   * ```ts
   * await client.userInfoManager.unsubscribeUsersInfo({
   *   userIds: ['alice'],
   * });
   * ```
   *
   * @param params - [zh-CN] 包含 `userIds` 与可选回调的参数对象。 [en-US] Parameter object containing `userIds` and optional callbacks.
   * @returns {Promise<void>} [zh-CN] 成功时无返回值。 [en-US] Resolves with no payload on success.
   */
  public async unsubscribeUsersInfo(params: UnsubscribeUsersInfoParams): Promise<void> {
    return this.runOperation('unsubscribeUsersInfo', async (): Promise<void> => {
      const context = this.getRestContextOrThrow();
      const client = this.getRestClient(context);
      const endpoint = buildUnsubscribeUserInfoChangesEndpoint(context, params.userIds);

      logger.debug('UserInfoManager unsubscribeUsersInfo', {
        userIds: normalizeUserInfoTargetIds(params.userIds, 'params.userIds'),
      });

      await client.request<unknown>(endpoint, {
        method: 'DELETE',
        operation: 'unsubscribeUsersInfo',
      });
    });
  }

  /**
   * [zh-CN] 查询当前用户已订阅资料变化的陌生人列表，并返回这些用户的标准化资料。
   * [en-US] Gets the strangers whose profile changes are subscribed by the current user and returns their normalized profiles.
   *
   * @example [zh-CN] 调用示例（查询已订阅用户） [en-US] Usage example (list subscribed users)
   * ```ts
   * const users = await client.userInfoManager.getSubscribedUsers();
   * console.log(users.map(user => user.userId));
   * ```
   *
   * @param this - [zh-CN] 无需传入参数。 [en-US] No parameter is required.
   * @returns {Promise<ReadonlyArray<UserInfo>>} [zh-CN] 返回标准化后的用户资料数组。 [en-US] Returns normalized subscribed user profiles.
   */
  public async getSubscribedUsers(): Promise<ReadonlyArray<UserInfo>> {
    return this.runOperation(
      'getSubscribedUsers',
      async (): Promise<ReadonlyArray<UserInfo>> => {
        const context = this.getRestContextOrThrow();
        const client = this.getRestClient(context);
        const endpoint = buildGetSubscribedUserInfoListEndpoint(context);

        logger.debug('UserInfoManager getSubscribedUsers', {
          userId: context.userId,
        });

        const response = await client.request<unknown>(endpoint, {
          method: 'GET',
          operation: 'getSubscribedUsers',
        });
        const userIds = readSubscribedUserIdsFromEnvelope(response);
        if (userIds.length === 0) {
          return [];
        }

        return await this.getUserInfoByUserId({ userIds });
      }
    );
  }

  /**
   * [zh-CN] 更新当前登录用户的一个或多个资料属性，例如昵称、头像、邮箱、手机号、签名或扩展字段。
   * [en-US] Updates one or more profile attributes of the currently logged-in user, such as nickname, avatar, email, phone, signature, or extension data.
   *
   * @example [zh-CN] 调用示例（整对象更新） [en-US] Usage example (patch current profile)
   * ```ts
   * const profile = await client.userInfoManager.updateOwnInfo({
   *   nickname: 'Alice',
   *   avatarUrl: 'https://example.com/avatar.png',
   * });
   * console.log(profile.userId, profile.nickname);
   * ```
   *
   * @param params - [zh-CN] 至少包含一个可更新字段的参数对象。 [en-US] Patch parameter object that must contain at least one updatable field.
   * @returns {Promise<UserInfo>} [zh-CN] 返回标准化后的当前用户资料。 [en-US] Returns the normalized current user profile.
   */
  public async updateOwnInfo(params: UpdateOwnInfoParams): Promise<UserInfo> {
    return this.runOperation('updateOwnInfo', async (): Promise<UserInfo> => {
      const context = this.getRestContextOrThrow();
      const client = this.getRestClient(context);
      const payload = buildUpdateOwnInfoFormBody(params);
      const endpoint = buildUserInfoUpdateEndpoint(context);

      logger.debug('UserInfoManager updateOwnInfo', {
        userId: context.userId,
        fields: this.getUpdatedFieldNames(params),
      });

      const response = await client.request<unknown>(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: payload,
        operation: 'updateOwnInfo',
      });
      const record = this.normalizeUpdateEnvelope(
        response,
        context.userId,
        this.buildFallbackProfile(context.userId, params)
      );
      this.writeCache([record]);
      this.dispatchSelfUpdate(record.profile);
      return record.profile;
    });
  }

  /**
   * [zh-CN] 更新当前登录用户的单个资料属性，适合只修改昵称、头像等一个字段的场景。
   * [en-US] Updates one profile attribute of the currently logged-in user, suitable when only one field such as nickname or avatar needs to change.
   *
   * @example [zh-CN] 调用示例（单属性更新） [en-US] Usage example (single-attribute update)
   * ```ts
   * const profile = await client.userInfoManager.updateOwnInfoByAttribute(
   *   'avatarUrl',
   *   'https://example.com/avatar.png'
   * );
   * console.log(profile.avatarUrl);
   * ```
   *
   * @param attribute - [zh-CN] 需要更新的资料属性。 [en-US] The profile attribute to update.
   * @param value - [zh-CN] 属性值；空字符串、`false`、`0` 都是合法值。 [en-US] Attribute value; empty string, `false`, and `0` are valid.
   * @returns {Promise<UserInfo>} [zh-CN] 返回标准化后的当前用户资料。 [en-US] Returns the normalized current user profile.
   */
  public async updateOwnInfoByAttribute(
    attribute: UserInfoAttribute,
    value: string | number | boolean
  ): Promise<UserInfo> {
    return this.runOperation('updateOwnInfoByAttribute', async (): Promise<UserInfo> => {
      const context = this.getRestContextOrThrow();
      const client = this.getRestClient(context);
      const payload = buildUpdateOwnInfoByAttributeFormBody(attribute, value);
      const endpoint = buildUserInfoUpdateEndpoint(context);

      logger.debug('UserInfoManager updateOwnInfoByAttribute', {
        userId: context.userId,
        attribute,
      });

      const response = await client.request<unknown>(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: payload,
        operation: 'updateOwnInfoByAttribute',
      });
      const record = this.normalizeUpdateEnvelope(response, context.userId, {
        userId: context.userId,
        [attribute]: value,
      });
      this.writeCache([record]);
      this.dispatchSelfUpdate(record.profile);
      return record.profile;
    });
  }

  private async runOperation<TResult>(
    operation: string,
    executor: () => Promise<TResult>
  ): Promise<TResult> {
    try {
      return await executor();
    } catch (error) {
      const sdkError = this.normalizeOperationError(operation, error);
      throw sdkError;
    }
  }

  private normalizeOperationError(operation: string, error: unknown): SDKError {
    if (error instanceof SDKError) {
      return error;
    }

    logger.warn('UserInfoManager operation failed', {
      operation,
      message: error instanceof Error ? error.message : String(error),
    });

    return new SDKError(`${operation} failed`);
  }

  private getRestContextOrThrow(): RestContext {
    if (this.client) {
      return this.client.getRestContext();
    }

    throw new ValidationError('UserInfoManager is not bound to client', {
      code: ERROR_CODES.VALIDATION_REQUIRED,
      details: {
        fields: [
          {
            path: 'userInfoManager.client',
            message: 'client is required',
            rule: 'required',
          },
        ],
      },
    });
  }

  private getRestClient(context: RestContext): RestClient {
    if (
      this.restClient &&
      this.restBaseUrl === context.restBaseUrl &&
      this.restToken === context.token
    ) {
      return this.restClient;
    }

    this.restClient = new RestClient(context.restBaseUrl, { errorMap: USER_INFO_REST_ERROR_MAP });
    this.restClient.setAuthToken(context.token);
    this.restBaseUrl = context.restBaseUrl;
    this.restToken = context.token;
    return this.restClient;
  }

  private normalizeFetchEnvelope(
    response: unknown,
    requestedUserIds: ReadonlyArray<string>
  ): ReadonlyArray<NormalizedUserInfoRecord> {
    return normalizeUserInfoFetchRecords(response, requestedUserIds);
  }

  private normalizeUpdateEnvelope(
    response: unknown,
    userId: string,
    fallbackProfile?: Partial<UserInfo>
  ): NormalizedUserInfoRecord {
    const responseRecord = isRecord(response) ? response : null;
    const responseData =
      responseRecord && isRecord(responseRecord.data) ? responseRecord.data : null;
    const attributes =
      responseData ??
      (responseRecord && this.looksLikeUserInfoAttributes(responseRecord) ? responseRecord : null);
    const lastModified =
      responseRecord && typeof responseRecord.lastModified === 'number'
        ? responseRecord.lastModified
        : undefined;
    const profile = attributes
      ? this.toUserInfo(userId, attributes)
      : {
          userId,
          ...(fallbackProfile ?? {}),
        };

    return {
      profile,
      lastModified,
    };
  }

  private toUserInfo(userId: string, attributes: ServerUserInfoAttributes): UserInfo {
    const profile: {
      userId: string;
      nickname?: string;
      avatarUrl?: string;
      mail?: string;
      phone?: string;
      gender?: string | number | boolean;
      sign?: string;
      birth?: string;
      ext?: string;
    } = { userId };

    if (typeof attributes.nickname === 'string') {
      profile.nickname = attributes.nickname;
    }
    if (typeof attributes.avatarurl === 'string') {
      profile.avatarUrl = attributes.avatarurl;
    } else if (typeof attributes.avatarUrl === 'string') {
      profile.avatarUrl = attributes.avatarUrl;
    }
    if (typeof attributes.mail === 'string') {
      profile.mail = attributes.mail;
    }
    if (typeof attributes.phone === 'string') {
      profile.phone = attributes.phone;
    }
    if (
      typeof attributes.gender === 'string' ||
      typeof attributes.gender === 'number' ||
      typeof attributes.gender === 'boolean'
    ) {
      profile.gender = attributes.gender;
    }
    if (typeof attributes.sign === 'string') {
      profile.sign = attributes.sign;
    }
    if (typeof attributes.birth === 'string') {
      profile.birth = attributes.birth;
    }
    if (typeof attributes.ext === 'string') {
      profile.ext = attributes.ext;
    }

    return profile;
  }

  private looksLikeUserInfoAttributes(value: unknown): value is ServerUserInfoAttributes {
    if (!isRecord(value)) {
      return false;
    }

    return (
      'nickname' in value ||
      'avatarurl' in value ||
      'avatarUrl' in value ||
      'mail' in value ||
      'phone' in value ||
      'gender' in value ||
      'sign' in value ||
      'birth' in value ||
      'ext' in value
    );
  }

  private buildFallbackProfile(userId: string, params: UpdateOwnInfoParams): Partial<UserInfo> {
    const profile: Partial<UserInfo> & Pick<UserInfo, 'userId'> = { userId };
    const assignableProfile = profile as Record<UserInfoKey, UserInfo[UserInfoKey] | undefined>;

    for (const key of USER_INFO_KEYS) {
      if (key in params) {
        assignableProfile[key] = params[key];
      }
    }

    return profile;
  }

  private getUpdatedFieldNames(params: UpdateOwnInfoParams): ReadonlyArray<UserInfoKey> {
    return USER_INFO_KEYS.filter(key => key in params);
  }

  private projectToSummary(record: NormalizedUserInfoRecord): UserInfoSummary {
    const now = Date.now();
    const userInfoUpdateTime = normalizeProfileVersionFromTimestamp(record.lastModified);
    return {
      userId: record.profile.userId,
      nickname: record.profile.nickname,
      avatarUrl: record.profile.avatarUrl,
      sign: record.profile.sign,
      ext: record.profile.ext,
      userInfoUpdateTime,
      lastSyncAt: now,
      lastAccess: now,
      lastUpdate: record.lastModified ?? now,
    };
  }

  private writeCache(records: ReadonlyArray<NormalizedUserInfoRecord>): void {
    if (!this.client || records.length === 0) {
      return;
    }

    const cacheManager = this.client.getCacheManager();
    if (!cacheManager) {
      return;
    }

    if (typeof cacheManager.upsertRuntimeUserInfos === 'function') {
      cacheManager.upsertRuntimeUserInfos(
        records.map(record => ({
          profile: record.profile,
          lastModified: record.lastModified,
          source:
            record.profile.userId === this.client?.getRestContext().userId ? 'update' : 'fetch',
        }))
      );
    }
    cacheManager.setUserInfoSummaries(records.map(record => this.projectToSummary(record)));
  }

  private dispatchSelfUpdate(profile: UserInfo): void {
    this.client?.dispatchOwnInfoUpdated?.(profile);
  }
}

//TODO：从缓存获取
