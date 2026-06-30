/**
 * [zh-CN] PresenceManager 对外管理器实现，负责在线状态发布、订阅、查询与事件分发。
 * [en-US] Public PresenceManager implementation for presence publish, subscribe, query, and event dispatch.
 */

import { RestClient } from '../rest/client'; // REST 客户端
import { mergeRuntimeErrorMaps } from '../rest/error-map-types';
import { COMMON_ERROR_MAP } from '../rest/error-maps/common';
import { PRESENCE_ERROR_MAP } from '../rest/error-maps/presence';
import { logger } from '../utils/logger'; // 日志工具
import { ERROR_CODES } from '../utils/error-codes'; // 错误码
import { SDKError, ValidationError } from '../utils/errors'; // 错误类型
import type { ChatClient } from '../chat-client'; // ChatClient 类型
import type { RestContext } from '../types/chat-client'; // REST 上下文类型
import type { EventHandlerId, PresenceEventHandlerMap } from '../types/event-system'; // 事件类型
import type { ManagerBase, ManagerEventContext } from '../types/manager'; // Manager 基础类型
import type {
  PresenceInfo, // 在线状态业务对象
  SubscribePresenceRawResponse, // 订阅在线状态原始响应
  SubscribePresenceResponse, // 订阅在线状态响应
  SubscribedPresenceListRawResponse, // 订阅列表原始响应
  SubscribedPresenceListResponse, // 订阅列表响应
} from '../types/presence'; // 在线状态类型

/**
 * 校验字段错误结构
 */
interface ValidationFieldError {
  // 参数校验错误结构
  readonly path: string; // 字段路径
  readonly message: string; // 错误提示
  readonly rule: 'required' | 'invalid_format' | 'range'; // 校验规则
} // 参数校验错误结构结束

const isRecord = (value: unknown): value is Record<string, unknown> => {
  // 判断是否为对象
  return typeof value === 'object' && value !== null && !Array.isArray(value); // 返回判断结果
}; // 函数结束

const PRESENCE_REST_ERROR_MAP = mergeRuntimeErrorMaps(COMMON_ERROR_MAP, PRESENCE_ERROR_MAP);

/**
 * [zh-CN] 发布当前用户在线状态的参数。
 * [en-US] Parameters for publishing the current user's presence.
 */
export interface PublishPresenceParams {
  /** [zh-CN] 在线状态自定义状态，服务端对应 `ext` 字段。 [en-US] Custom presence status mapped to server `ext` field. */
  readonly customStatus: string;
} // 发布参数定义结束

/**
 * [zh-CN] 订阅用户在线状态的参数。
 * [en-US] Parameters for subscribing to users' presence.
 */
export interface SubscribePresenceParams {
  /** [zh-CN] 待订阅的用户 ID 列表，至少包含 1 项。 [en-US] Target user id list to subscribe, must contain at least one entry. */
  readonly userIds: ReadonlyArray<string>;
  /** [zh-CN] 订阅时长（秒），取值需大于等于 0。 [en-US] Subscription duration in seconds, must be greater than or equal to 0. */
  readonly expiry: number;
} // 订阅参数定义结束

/**
 * [zh-CN] 取消订阅用户在线状态的参数。
 * [en-US] Parameters for unsubscribing from users' presence.
 */
export interface UnsubscribePresenceParams {
  /** [zh-CN] 待取消订阅的用户 ID 列表，至少包含 1 项。 [en-US] User id list to unsubscribe, must contain at least one entry. */
  readonly userIds: ReadonlyArray<string>;
} // 取消订阅参数定义结束

/**
 * [zh-CN] 查询当前用户在线状态订阅列表的参数。
 * [en-US] Parameters for querying the current user's presence subscription list.
 */
export interface GetSubscribedPresenceListParams {
  /** [zh-CN] 页码，从 0 开始。 [en-US] Page number starting from 0. */
  readonly pageNum: number;
  /** [zh-CN] 每页条数，取值需大于等于 0。 [en-US] Page size, must be greater than or equal to 0. */
  readonly pageSize: number;
} // 查询订阅列表参数定义结束

/**
 * [zh-CN] 查询用户在线状态的参数。
 * [en-US] Parameters for querying users' presence status.
 */
export interface GetPresenceStatusParams {
  /** [zh-CN] 待查询的用户 ID 列表，至少包含 1 项。 [en-US] Target user id list to query, must contain at least one entry. */
  readonly userIds: ReadonlyArray<string>;
} // 查询在线状态参数定义结束

/**
 * [zh-CN] PresenceManager 负责在线状态发布、订阅、查询与事件处理器管理。
 * [en-US] PresenceManager handles presence publish, subscribe, query, and event-handler management.
 *
 */
export class PresenceManager implements ManagerBase<ChatClient> {
  // PresenceManager 实现
  /** @internal SDK 内部管理器注册键，不对外文档暴露。 */
  public static readonly key = 'presenceManager' as const; // Manager key
  private client: ChatClient | null = null; // ChatClient 引用
  private eventContext: ManagerEventContext<PresenceEventHandlerMap> | null = null; // 事件上下文
  private restClient: RestClient | null = null; // REST 客户端缓存
  private restBaseUrl: string | null = null; // REST 基础地址缓存
  private restToken: string | null = null; // REST token 缓存

  /**
   * @internal
   * [zh-CN] 绑定 PresenceManager 到 ChatClient，通常由 SDK 在 `client.presenceManager` 初始化阶段调用。 [en-US] Binds PresenceManager to ChatClient and is usually called internally during `client.presenceManager` initialization.
   *
   * @param client - [zh-CN] 已初始化的 ChatClient 实例。 [en-US] Initialized ChatClient instance.
   * @param context - [zh-CN] Presence 事件上下文，用于分发在线状态事件。 [en-US] Presence event context used to dispatch presence events.
   * @returns {void} [zh-CN] 无返回值。 [en-US] Returns nothing.
   */
  public bind(client: ChatClient, context?: ManagerEventContext<PresenceEventHandlerMap>): void {
    // 绑定实现
    this.client = client; // 保存 client
    this.eventContext = context ?? null; // 保存事件上下文
  }

  /**
   * [zh-CN] 注册 Presence 事件处理器，用于接收在线状态变更推送。 [en-US] Registers a Presence event handler to receive presence state updates.
   *
   * @param id - [zh-CN] 事件处理器唯一 ID，用于后续移除。 [en-US] Unique handler id used for later removal.
   * @param handlers - [zh-CN] 事件处理器集合，按需实现对应回调。 [en-US] Handler collection with callbacks implemented as needed.
   * @returns {void} [zh-CN] 注册完成后无返回值。 [en-US] Returns nothing when registration succeeds.
   *
   * @example [zh-CN] 调用示例（注册在线状态事件） [en-US] Usage example (register presence handler)
   * ```ts
   * client.presenceManager.addEventHandler('presence-ui', {
   *   onPresenceStatusChange: (states) => {
   *     console.log(states);
   *   },
   * });
   * ```
   */
  public addEventHandler(id: EventHandlerId, handlers: PresenceEventHandlerMap): void {
    // 注册事件处理器
    const context = this.getEventContextOrThrow(); // 读取事件上下文
    context.addEventHandler(id, handlers); // 注册事件处理器
  }

  /**
   * [zh-CN] 移除 Presence 事件处理器。 [en-US] Removes a Presence event handler.
   *
   * @param id - [zh-CN] 待移除的事件处理器 ID。 [en-US] Handler id to remove.
   * @returns {void} [zh-CN] 移除完成后无返回值。 [en-US] Returns nothing when removal succeeds.
   *
   * @example [zh-CN] 调用示例（移除在线状态事件） [en-US] Usage example (remove presence handler)
   * ```ts
   * client.presenceManager.removeEventHandler('presence-ui');
   * ```
   */
  public removeEventHandler(id: EventHandlerId): void {
    // 移除事件处理器
    const context = this.getEventContextOrThrow(); // 读取事件上下文
    context.removeEventHandler(id); // 移除事件处理器
  }

  /**
   * [zh-CN] 发布当前用户的自定义在线状态，该状态会作为在线状态扩展描述信息保存并下发给订阅者。
   * [en-US] Publishes the current user's custom presence status, which is saved as the presence extension description and delivered to subscribers.
   *
   * @param params - [zh-CN] 发布参数，包含在线状态扩展描述信息与可选回调。 [en-US] Publish parameters with presence extension description and optional callbacks.
   * @returns {Promise<void>} [zh-CN] 成功时 resolve，无返回业务数据。 [en-US] Resolves on success with no business payload.
   *
   * @example [zh-CN] 调用示例（发布在线状态） [en-US] Usage example (publish presence)
   * ```ts
   * await client.presenceManager.publishPresence({
   *   customStatus: 'busy',
   * });
   * ```
   */
  public async publishPresence(params: PublishPresenceParams): Promise<void> {
    // 发布在线状态
    return this.runOperation('publishPresence', async (): Promise<void> => {
      this.validateDescription(params.customStatus); // 校验自定义状态
      const context = this.getRestContextOrThrow(); // 获取 REST 上下文
      const restClient = this.getRestClient(context); // 获取 REST 客户端
      const { orgName, appName } = this.parseAppKey(context.appKey); // 解析 appKey
      const endpoint = `/${orgName}/${appName}/users/${context.userId}/presence/${context.clientResource}/1`; // 构建接口地址
      const payload = { ext: params.customStatus }; // 构建请求体
      logger.debug('Call publishPresence', { customStatus: params.customStatus }); // 记录调用日志
      await restClient.request<void>(endpoint, {
        method: 'POST',
        body: payload,
        operation: 'publishPresence',
      });
    });
  }

  /**
   * [zh-CN] 订阅指定用户的在线状态。订阅成功后，这些用户在线状态变更时会触发 Presence 事件回调。
   * [en-US] Subscribes to target users' presence. After success, Presence event callbacks are triggered when these users' presence changes.
   *
   * @param params - [zh-CN] 订阅参数，包含用户列表、订阅时长与可选回调。 [en-US] Subscribe parameters including user list, expiry, and optional callbacks.
   * @returns {Promise<SubscribePresenceResponse>} [zh-CN] 返回归一化后的在线状态列表。 [en-US] Returns normalized presence list.
   *
   * @example [zh-CN] 调用示例（订阅用户在线状态） [en-US] Usage example (subscribe presence)
   * ```ts
   * const result = await client.presenceManager.subscribePresence({
   *   userIds: ['userA'],
   *   expiry: 3600,
   * });
   * console.log(result[0]?.publisher);
   * ```
   */
  public async subscribePresence(
    params: SubscribePresenceParams
  ): Promise<SubscribePresenceResponse> {
    // 订阅在线状态
    return this.runOperation('subscribePresence', async (): Promise<SubscribePresenceResponse> => {
      this.validateUserIds(params.userIds); // 校验用户列表
      this.validateExpiry(params.expiry); // 校验订阅时长
      const context = this.getRestContextOrThrow(); // 获取 REST 上下文
      const restClient = this.getRestClient(context); // 获取 REST 客户端
      const { orgName, appName } = this.parseAppKey(context.appKey); // 解析 appKey
      const endpoint = `/${orgName}/${appName}/users/${context.userId}/presence/${params.expiry}`; // 构建接口地址
      const payload = { usernames: params.userIds }; // 构建请求体
      logger.debug('Call subscribePresence', { userIds: params.userIds, expiry: params.expiry }); // 记录调用日志
      const response = await restClient.request<SubscribePresenceRawResponse>(endpoint, {
        method: 'POST',
        body: payload,
        operation: 'subscribePresences',
      });
      return this.normalizeSubscribeResponse(response);
    });
  }

  /**
   * [zh-CN] 取消订阅指定用户的在线状态，成功后不再接收这些用户的在线状态变更事件。
   * [en-US] Unsubscribes from target users' presence; after success, presence change events for these users are no longer received.
   *
   * @param params - [zh-CN] 取消订阅参数，包含用户列表与可选回调。 [en-US] Unsubscribe parameters including user list and optional callbacks.
   * @returns {Promise<void>} [zh-CN] 成功时 resolve，无返回业务数据。 [en-US] Resolves on success with no business payload.
   *
   * @example [zh-CN] 调用示例（取消订阅） [en-US] Usage example (unsubscribe presence)
   * ```ts
   * await client.presenceManager.unsubscribePresence({
   *   userIds: ['userA'],
   * });
   * ```
   */
  public async unsubscribePresence(params: UnsubscribePresenceParams): Promise<void> {
    // 取消订阅
    return this.runOperation('unsubscribePresence', async (): Promise<void> => {
      this.validateUserIds(params.userIds); // 校验用户列表
      const context = this.getRestContextOrThrow(); // 获取 REST 上下文
      const restClient = this.getRestClient(context); // 获取 REST 客户端
      const { orgName, appName } = this.parseAppKey(context.appKey); // 解析 appKey
      const endpoint = `/${orgName}/${appName}/users/${context.userId}/presence`; // 构建接口地址
      logger.debug('Call unsubscribePresence', { userIds: params.userIds }); // 记录调用日志
      await restClient.request<void>(endpoint, {
        method: 'DELETE',
        body: params.userIds,
        operation: 'unsubscribePresence',
      });
    });
  }

  /**
   * [zh-CN] 分页查询当前用户订阅了哪些用户的在线状态。
   * [en-US] Uses pagination to get the list of users whose presence states the current user has subscribed to.
   *
   * @param params - [zh-CN] 分页参数，包含页码、每页数量与可选回调。 [en-US] Paging parameters including page number, page size, and optional callbacks.
   * @returns {Promise<SubscribedPresenceListResponse>} [zh-CN] 返回订阅用户 ID 列表。 [en-US] Returns subscribed user id list.
   *
   * @example [zh-CN] 调用示例（分页查询订阅列表） [en-US] Usage example (query subscribed list by page)
   * ```ts
   * const list = await client.presenceManager.getSubscribedPresenceList({
   *   pageNum: 1,
   *   pageSize: 20,
   * });
   * console.log(list);
   * ```
   */
  public async getSubscribedPresenceList(
    params: GetSubscribedPresenceListParams
  ): Promise<SubscribedPresenceListResponse> {
    // 查询订阅列表
    return this.runOperation(
      'getSubscribedPresenceList',
      async (): Promise<SubscribedPresenceListResponse> => {
        this.validatePage(params.pageNum, params.pageSize); // 校验分页参数
        const context = this.getRestContextOrThrow(); // 获取 REST 上下文
        const restClient = this.getRestClient(context); // 获取 REST 客户端
        const { orgName, appName } = this.parseAppKey(context.appKey); // 解析 appKey
        const endpoint = `/${orgName}/${appName}/users/${context.userId}/presence/sublist?pageNum=${params.pageNum}&pageSize=${params.pageSize}`; // 构建接口地址
        logger.debug('Call getSubscribedPresenceList', {
          pageNum: params.pageNum,
          pageSize: params.pageSize,
        }); // 记录调用日志
        const response = await restClient.request<SubscribedPresenceListRawResponse>(endpoint, {
          method: 'GET',
          operation: 'getSubscribedPresenceList',
        });
        return this.normalizeSubscribedListResponse(response);
      }
    );
  }

  /**
   * [zh-CN] 查询指定用户的当前在线状态，不会建立订阅关系。
   * [en-US] Gets the current presence states of target users without creating subscriptions.
   *
   * @param params - [zh-CN] 查询参数，包含用户列表与可选回调。 [en-US] Query parameters including user list and optional callbacks.
   * @returns {Promise<SubscribePresenceResponse>} [zh-CN] 返回归一化后的在线状态列表。 [en-US] Returns normalized presence list.
   *
   * @example [zh-CN] 调用示例（查询在线状态） [en-US] Usage example (query presence status)
   * ```ts
   * const status = await client.presenceManager.getPresenceStatus({
   *   userIds: ['userA'],
   * });
   * console.log(status[0]?.statusList);
   * ```
   */
  public async getPresenceStatus(
    params: GetPresenceStatusParams
  ): Promise<SubscribePresenceResponse> {
    // 查询在线状态
    return this.runOperation('getPresenceStatus', async (): Promise<SubscribePresenceResponse> => {
      this.validateUserIds(params.userIds); // 校验用户列表
      const context = this.getRestContextOrThrow(); // 获取 REST 上下文
      const restClient = this.getRestClient(context); // 获取 REST 客户端
      const { orgName, appName } = this.parseAppKey(context.appKey); // 解析 appKey
      const endpoint = `/${orgName}/${appName}/users/${context.userId}/presence`; // 构建接口地址
      const payload = { usernames: params.userIds }; // 构建请求体
      logger.debug('Call getPresenceStatus', { userIds: params.userIds }); // 记录调用日志
      const response = await restClient.request<SubscribePresenceRawResponse>(endpoint, {
        method: 'POST',
        body: payload,
        operation: 'getPresenceStatus',
      });
      return this.normalizeSubscribeResponse(response);
    });
  }

  private async runOperation<T>(name: string, operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const sdkError = this.normalizeSdkError(name, error);
      logger.warn(`PresenceManager ${name} failed`, {
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
      return new SDKError(`PresenceManager ${name} failed: ${error.message}`, ERROR_CODES.UNKNOWN);
    }
    return new SDKError(`PresenceManager ${name} failed`, ERROR_CODES.UNKNOWN);
  }

  private getEventContextOrThrow(): ManagerEventContext<PresenceEventHandlerMap> {
    // 获取事件上下文
    if (!this.eventContext) {
      // 校验事件上下文
      throw new ValidationError('PresenceManager is not bound to event context', {
        // 抛出校验错误
        code: ERROR_CODES.VALIDATION_REQUIRED, // 缺少必填字段
        details: {
          // 错误详情
          fields: [
            // 字段列表
            {
              // 字段错误
              path: 'presenceManager.eventContext', // 字段路径
              message: 'PresenceManager is not bound to event context', // 错误提示
              rule: 'required', // 校验规则
            }, // 字段错误结束
          ], // 字段列表结束
        }, // 错误详情结束
      }); // 抛出校验错误结束
    } // 事件上下文校验结束
    return this.eventContext; // 返回上下文
  }

  private getClientOrThrow(): ChatClient {
    // 获取 client
    if (!this.client) {
      // 校验 client
      throw new ValidationError('PresenceManager is not bound to client', {
        // 抛出校验错误
        code: ERROR_CODES.VALIDATION_REQUIRED, // 缺少必填字段
        details: {
          // 错误详情
          fields: [
            // 字段列表
            {
              // 字段错误
              path: 'presenceManager.client', // 字段路径
              message: 'PresenceManager is not bound to client', // 错误提示
              rule: 'required', // 校验规则
            }, // 字段错误结束
          ], // 字段列表结束
        }, // 错误详情结束
      }); // 抛出校验错误结束
    } // client 校验结束
    return this.client; // 返回 client
  }

  private getRestContextOrThrow(): RestContext {
    // 获取 REST 上下文
    const client = this.getClientOrThrow(); // 获取 client
    return client.getRestContext(); // 返回 REST 上下文
  }

  private getRestClient(context: RestContext): RestClient {
    // 获取 REST 客户端
    if (
      !this.restClient ||
      this.restBaseUrl !== context.restBaseUrl ||
      this.restToken !== context.token
    ) {
      // 检查缓存
      this.restClient = new RestClient(context.restBaseUrl, { errorMap: PRESENCE_REST_ERROR_MAP }); // 创建新客户端
      this.restClient.setAuthToken(context.token); // 设置 token
      this.restBaseUrl = context.restBaseUrl; // 缓存 baseUrl
      this.restToken = context.token; // 缓存 token
    } // 缓存更新结束
    return this.restClient; // 返回客户端
  }

  private parseAppKey(appKey: string): { orgName: string; appName: string } {
    // 解析 appKey
    const parts = appKey.split('#'); // 拆分 appKey
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      // 校验格式
      throw this.buildValidationError([
        // 抛出校验错误
        {
          // 错误字段
          path: 'appKey', // 字段路径
          message: 'appKey is invalid', // 错误提示
          rule: 'invalid_format', // 校验规则
        }, // 错误字段结束
      ]); // 抛出错误结束
    } // 校验结束
    return { orgName: parts[0], appName: parts[1] }; // 返回结果
  }

  private validateDescription(description: string): void {
    // 校验描述
    if (typeof description !== 'string') {
      // 校验类型
      throw this.buildValidationError([
        // 抛出校验错误
        {
          // 错误字段
          path: 'description', // 字段路径
          message: 'description must be a string', // 错误提示
          rule: 'invalid_format', // 校验规则
        }, // 错误字段结束
      ]); // 抛出错误结束
    } // 校验结束
  }

  private validateUserIds(userIds: ReadonlyArray<string>): void {
    // 校验用户列表
    if (!Array.isArray(userIds)) {
      // 校验数组
      throw this.buildValidationError([
        // 抛出校验错误
        {
          // 错误字段
          path: 'userIds', // 字段路径
          message: 'userIds must be an array', // 错误提示
          rule: 'invalid_format', // 校验规则
        }, // 错误字段结束
      ]); // 抛出错误结束
    } // 校验结束
    if (userIds.length === 0) {
      // 校验空数组
      throw this.buildValidationError([
        // 抛出校验错误
        {
          // 错误字段
          path: 'userIds', // 字段路径
          message: 'userIds is required', // 错误提示
          rule: 'required', // 校验规则
        }, // 错误字段结束
      ]); // 抛出错误结束
    } // 校验结束
    for (const item of userIds) {
      // 遍历用户列表
      if (typeof item !== 'string' || item.trim().length === 0) {
        // 校验用户 ID
        throw this.buildValidationError([
          // 抛出校验错误
          {
            // 错误字段
            path: 'userIds', // 字段路径
            message: 'userIds contains invalid userId', // 错误提示
            rule: 'invalid_format', // 校验规则
          }, // 错误字段结束
        ]); // 抛出错误结束
      } // 校验结束
    } // 遍历结束
  }

  private validateExpiry(expiry: number): void {
    // 校验订阅时长
    if (typeof expiry !== 'number' || Number.isNaN(expiry)) {
      // 校验类型
      throw this.buildValidationError([
        // 抛出校验错误
        {
          // 错误字段
          path: 'expiry', // 字段路径
          message: 'expiry must be a number', // 错误提示
          rule: 'invalid_format', // 校验规则
        }, // 错误字段结束
      ]); // 抛出错误结束
    } // 校验结束
    if (expiry < 0) {
      // 校验范围
      throw this.buildValidationError([
        // 抛出校验错误
        {
          // 错误字段
          path: 'expiry', // 字段路径
          message: 'expiry must be greater than or equal to 0', // 错误提示
          rule: 'range', // 校验规则
        }, // 错误字段结束
      ]); // 抛出错误结束
    } // 校验结束
  }

  private validatePage(pageNum: number, pageSize: number): void {
    // 校验分页参数
    if (typeof pageNum !== 'number' || Number.isNaN(pageNum)) {
      // 校验 pageNum
      throw this.buildValidationError([
        // 抛出校验错误
        {
          // 错误字段
          path: 'pageNum', // 字段路径
          message: 'pageNum must be a number', // 错误提示
          rule: 'invalid_format', // 校验规则
        }, // 错误字段结束
      ]); // 抛出错误结束
    } // 校验结束
    if (typeof pageSize !== 'number' || Number.isNaN(pageSize)) {
      // 校验 pageSize
      throw this.buildValidationError([
        // 抛出校验错误
        {
          // 错误字段
          path: 'pageSize', // 字段路径
          message: 'pageSize must be a number', // 错误提示
          rule: 'invalid_format', // 校验规则
        }, // 错误字段结束
      ]); // 抛出错误结束
    } // 校验结束
    if (pageNum < 0 || pageSize < 0) {
      // 校验范围
      throw this.buildValidationError([
        // 抛出校验错误
        {
          // 错误字段
          path: 'pageNum', // 字段路径
          message: 'pageNum must be greater than or equal to 0', // 错误提示
          rule: 'range', // 校验规则
        }, // 错误字段结束
        {
          // 错误字段
          path: 'pageSize', // 字段路径
          message: 'pageSize must be greater than or equal to 0', // 错误提示
          rule: 'range', // 校验规则
        }, // 错误字段结束
      ]); // 抛出错误结束
    } // 校验结束
  }

  private normalizeSubscribeResponse(
    response: SubscribePresenceRawResponse
  ): SubscribePresenceResponse {
    // 归一化订阅响应
    const list = response.result ?? []; // 读取结果列表
    return list
      .map((item): PresenceInfo | null => {
        // 转换业务对象
        if (!item || typeof item.uid !== 'string' || item.uid.length === 0) {
          // 校验发布者字段
          return null; // 跳过非法项
        } // 判断结束
        return {
          publisher: item.uid, // 发布者
          statusList: this.normalizeStatusList(item.status), // 状态映射
          ext: typeof item.ext === 'string' ? item.ext : '', // 扩展信息
          latestTime: typeof item.last_time === 'number' ? item.last_time : 0, // 最新时间
          expiryTime: typeof item.expiry === 'number' ? item.expiry : 0, // 到期时间
        }; // 返回转换结果
      }) // 转换结束
      .filter((item): item is PresenceInfo => item !== null); // 过滤非法项
  }

  private normalizeSubscribedListResponse(
    response: SubscribedPresenceListRawResponse
  ): SubscribedPresenceListResponse {
    // 归一化订阅列表响应
    const result = response.result; // 读取结果数据
    const sublist = result?.sublist ?? []; // 读取订阅列表
    return sublist
      .map((item): string | null => {
        // 提取用户 ID
        if (!item || typeof item.uid !== 'string' || item.uid.trim().length === 0) {
          // 校验用户 ID
          return null; // 跳过非法项
        } // 校验结束
        return item.uid; // 返回用户 ID
      }) // 提取结束
      .filter((item): item is string => item !== null); // 过滤非法项
  }

  private normalizeStatusList(status: unknown): Readonly<Record<string, number>> {
    // 归一化设备状态映射
    if (!isRecord(status)) {
      // 校验状态对象
      return {}; // 返回空映射
    } // 判断结束
    const normalized: Record<string, number> = {}; // 创建映射
    for (const [key, value] of Object.entries(status)) {
      // 遍历状态项
      if (typeof value === 'number' && Number.isFinite(value)) {
        // 处理数字状态
        normalized[key] = Math.trunc(value); // 写入整数状态值
        continue; // 处理下一项
      } // 数字状态处理结束
      if (typeof value === 'string' && value.trim().length > 0) {
        // 处理字符串状态
        const parsed = Number(value); // 转换数字
        if (Number.isFinite(parsed)) {
          // 校验数字
          normalized[key] = Math.trunc(parsed); // 写入整数状态值
        } // 校验结束
      } // 字符串状态处理结束
    } // 遍历结束
    return normalized; // 返回映射
  }

  private buildValidationError(fields: ReadonlyArray<ValidationFieldError>): ValidationError {
    // 构建校验错误
    return new ValidationError('Invalid parameters', {
      // 创建校验错误
      code: ERROR_CODES.VALIDATION_INVALID_FORMAT, // 统一参数错误码
      details: { fields }, // 错误详情
    }); // 返回错误
  }

} // PresenceManager 结束
