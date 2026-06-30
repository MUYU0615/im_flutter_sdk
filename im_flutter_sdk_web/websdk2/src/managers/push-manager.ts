/**
 * PushManager 管理器
 */

import { RestClient } from '../rest/client';
import { mergeRuntimeErrorMaps } from '../rest/error-map-types';
import { COMMON_ERROR_MAP } from '../rest/error-maps/common';
import { PUSH_ERROR_MAP } from '../rest/error-maps/push';
import { ERROR_CODES } from '../utils/error-codes';
import { SDKError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';
import type { ChatClient } from '../chat-client';
import { queryMutedConversationsFromSessionList } from '../core/session-list-sync/session-list-query';
import type { RestContext } from '../types/chat-client';
import type { ManagerBase, ManagerEventContext } from '../types/manager';
import type {
  BatchConversationSilentModeResponse,
  ClearConversationRemindTypeParams,
  ConversationIdentifier,
  ConversationSilentModeResponse,
  GetConversationListByRemindTypeParams,
  GetConversationSilentModeParams,
  GetConversationSilentModesParams,
  GetGlobalSilentModeParams,
  GetPushLanguageParams,
  GlobalSilentModeResponse,
  MutedConversationPageResponse,
  PushConversationType,
  PushLanguageResponse,
  PushRemindType,
  PushRemindTypeWithoutDefault,
  PushSilentModeRuleInput,
  PushSilentModeRuleView,
  PushTimePoint,
  SetConversationSilentModeParams,
  SetGlobalSilentModeParams,
  SetPushLanguageParams,
  UploadPushTokenParams,
} from '../types/push';

const MAX_BATCH_QUERY_SIZE = 20;
const PUSH_REST_ERROR_MAP = mergeRuntimeErrorMaps(COMMON_ERROR_MAP, PUSH_ERROR_MAP);

const PUSH_CONVERSATION_TYPES: ReadonlyArray<PushConversationType> = ['singleChat', 'groupChat'];
const PUSH_REMIND_TYPES: ReadonlyArray<PushRemindType> = ['ALL', 'AT', 'NONE', 'DEFAULT'];
const PUSH_REMIND_TYPES_FOR_INPUT: ReadonlyArray<PushRemindTypeWithoutDefault> = [
  'ALL',
  'AT',
  'NONE',
];
type ValidationRule = 'required' | 'invalid_format' | 'range' | 'unsupported' | 'conflict';

interface ValidationFieldError {
  readonly path: string;
  readonly message: string;
  readonly rule: ValidationRule;
}

interface SilentModeRulePayload {
  readonly type?: PushRemindType;
  readonly ignoreDuration?: number;
  readonly ignoreInterval?: string;
}

interface PushLanguageRestResponse {
  readonly translationLanguage?: string;
  readonly language?: string;
  readonly data?: {
    readonly translationLanguage?: string;
    readonly language?: string;
  };
}

interface BatchConversationRawResponse {
  readonly user?: Readonly<Record<string, unknown>>;
  readonly group?: Readonly<Record<string, unknown>>;
  readonly data?: {
    readonly user?: Readonly<Record<string, unknown>>;
    readonly group?: Readonly<Record<string, unknown>>;
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

/**
 * PushManager 负责 push token、免打扰与语言偏好管理
 */
export class PushManager implements ManagerBase<ChatClient> {
  /** @internal SDK 内部管理器注册键，不对外文档暴露。 */
  public static readonly key = 'pushManager' as const;

  private client: ChatClient | null = null;
  private restClient: RestClient | null = null;
  private restBaseUrl: string | null = null;
  private restToken: string | null = null;

  /**
   * @internal
   * [zh-CN] 绑定 PushManager 到 ChatClient，通常由 SDK 内部在 `client.pushManager` 初始化阶段调用。 [en-US] Binds PushManager to ChatClient and is usually called internally when `client.pushManager` is initialized.
   *
   * @param client - [zh-CN] 已初始化的 ChatClient 实例。 [en-US] Initialized ChatClient instance.
   * @param _context - [zh-CN] 预留的管理器上下文（当前未使用）。 [en-US] Reserved manager context (unused for now).
   * @returns {void} [zh-CN] 无返回值。 [en-US] Returns nothing.
   */
  public bind(client: ChatClient, _context?: ManagerEventContext): void {
    this.client = client;
  }

  /**
   * [zh-CN] 上传或覆盖设备 Push Token。成功时仅表示请求完成，不返回业务数据。 [en-US] Uploads or replaces the device push token. On success it only resolves and returns no business payload.
   *
   * @example [zh-CN] 调用示例（上传设备 token） [en-US] Usage example (upload device token)
   * ```ts
   * await client.pushManager.uploadPushToken({
   *   deviceId: 'web-device-001',
   *   deviceToken: 'token-from-push-provider',
   *   notifierName: 'FCM',
   * });
   * ```
   *
   * @param params - [zh-CN] 上传参数，包含设备标识、设备 token 与推送通道标识。 [en-US] Upload parameters including device id, device token, and notifier name.
   * @returns {Promise<void>} [zh-CN] 成功时 resolve，无返回值。 [en-US] Resolves on success with no return value.
   */
  public async uploadPushToken(params: UploadPushTokenParams): Promise<void> {
    return this.runOperation(async (): Promise<void> => {
      this.validateUploadPushTokenParams(params);

      const context = this.getRestContextOrThrow();
      const restClient = this.getRestClient(context);
      const { orgName, appName } = this.parseAppKey(context.appKey);
      const endpoint = `/${orgName}/${appName}/users/${context.userId}`;

      logger.debug('Call uploadPushToken', {
        deviceId: params.deviceId,
        notifierName: params.notifierName,
      });

      await restClient.request<unknown>(endpoint, {
        method: 'PUT',
        body: {
          device_id: params.deviceId,
          device_token: params.deviceToken,
          notifier_name: params.notifierName,
        },
        operation: 'uploadPushToken',
      });
    });
  }

  /**
   * [zh-CN] 设置 App 级（全局）免打扰规则，支持提醒类型、持续时长、时间区间三种模式。 [en-US] Sets app-level (global) silent mode rule, supporting remind type, duration, and interval modes.
   *
   * @example [zh-CN] 调用示例（设置全局提醒类型） [en-US] Usage example (set global remind type)
   * ```ts
   * const result = await client.pushManager.setGlobalSilentMode({
   *   rule: { mode: 'REMIND_TYPE', remindType: 'AT' },
   * });
   * console.log(result.rule.remindType);
   * ```
   *
   * @param params - [zh-CN] 全局免打扰设置参数。 [en-US] Parameters for setting global silent mode.
   * @returns {Promise<GlobalSilentModeResponse>} [zh-CN] 返回全局规则快照。 [en-US] Returns the global silent mode snapshot.
   */
  public async setGlobalSilentMode(
    params: SetGlobalSilentModeParams
  ): Promise<GlobalSilentModeResponse> {
    return this.runOperation(async (): Promise<GlobalSilentModeResponse> => {
      this.validateRuleInput(params.rule, 'rule');

      const context = this.getRestContextOrThrow();
      const restClient = this.getRestClient(context);
      const { orgName, appName } = this.parseAppKey(context.appKey);
      const endpoint = `/${orgName}/${appName}/users/${context.userId}/notification/user/${context.userId}?resource=${encodeURIComponent(context.clientResource)}`;
      const payload = this.buildSilentModePayload(params.rule);

      logger.debug('Call setGlobalSilentMode', {
        mode: params.rule.mode,
      });

      const response = await restClient.request<unknown>(endpoint, {
        method: 'PUT',
        body: payload,
        operation: 'setGlobalSilentMode',
      });

      return {
        scope: 'global',
        rule: this.normalizeRuleView(this.resolveSilentModeRuleSource(response), params.rule),
      };
    });
  }

  /**
   * [zh-CN] 查询 App 级（全局）免打扰规则。 [en-US] Gets the app-level (global) silent mode rule.
   *
   * @example [zh-CN] 调用示例（查询全局规则） [en-US] Usage example (get global rule)
   * ```ts
   * const result = await client.pushManager.getGlobalSilentMode();
   * console.log(result.rule);
   * ```
   *
   * @param params - [zh-CN] 查询参数（当前无字段）。 [en-US] Query parameters (currently empty).
   * @returns {Promise<GlobalSilentModeResponse>} [zh-CN] 返回全局规则快照。 [en-US] Returns the global silent mode snapshot.
   */
  public async getGlobalSilentMode(
    params: GetGlobalSilentModeParams = {}
  ): Promise<GlobalSilentModeResponse> {
    void params;
    return this.runOperation(async (): Promise<GlobalSilentModeResponse> => {
      const context = this.getRestContextOrThrow();
      const restClient = this.getRestClient(context);
      const { orgName, appName } = this.parseAppKey(context.appKey);
      const endpoint = `/${orgName}/${appName}/users/${context.userId}/notification/user/${context.userId}`;

      logger.debug('Call getGlobalSilentMode');

      const response = await restClient.request<unknown>(endpoint, {
        method: 'GET',
        operation: 'getGlobalSilentMode',
      });

      return {
        scope: 'global',
        rule: this.normalizeRuleView(this.resolveSilentModeRuleSource(response)),
      };
    });
  }

  /**
   * [zh-CN] 设置单会话免打扰规则，仅支持单聊与群聊。 [en-US] Sets silent mode rule for a specific conversation, supporting only single chat and group chat.
   *
   * @example [zh-CN] 调用示例（设置会话时长免打扰） [en-US] Usage example (set conversation duration mode)
   * ```ts
   * const result = await client.pushManager.setConversationSilentMode({
   *   conversationId: 'group_123',
   *   conversationType: 'groupChat',
   *   rule: { mode: 'DURATION', duration: 3600 },
   * });
   * console.log(result.rule.expireTimestamp);
   * ```
   *
   * @param params - [zh-CN] 会话维度的免打扰设置参数。 [en-US] Conversation-level silent mode parameters.
   * @returns {Promise<ConversationSilentModeResponse>} [zh-CN] 返回目标会话与规则快照。 [en-US] Returns target conversation with its rule snapshot.
   */
  public async setConversationSilentMode(
    params: SetConversationSilentModeParams
  ): Promise<ConversationSilentModeResponse> {
    return this.runOperation(async (): Promise<ConversationSilentModeResponse> => {
      this.validateConversationId(params.conversationId, 'conversationId');
      this.validateConversationType(params.conversationType, 'conversationType');
      this.validateRuleInput(params.rule, 'rule');

      const context = this.getRestContextOrThrow();
      const restClient = this.getRestClient(context);
      const { orgName, appName } = this.parseAppKey(context.appKey);
      const typePath = this.mapConversationTypeToPath(params.conversationType);
      const endpoint = `/${orgName}/${appName}/users/${context.userId}/notification/${typePath}/${encodeURIComponent(params.conversationId)}?resource=${encodeURIComponent(context.clientResource)}`;
      const payload = this.buildSilentModePayload(params.rule);

      logger.debug('Call setConversationSilentMode', {
        conversationId: params.conversationId,
        conversationType: params.conversationType,
        mode: params.rule.mode,
      });

      const response = await restClient.request<unknown>(endpoint, {
        method: 'PUT',
        body: payload,
        operation: 'setConversationSilentMode',
      });

      return {
        conversationId: params.conversationId,
        conversationType: params.conversationType,
        rule: this.normalizeRuleView(this.resolveSilentModeRuleSource(response), params.rule),
      };
    });
  }

  /**
   * [zh-CN] 查询单会话免打扰规则。 [en-US] Gets silent mode rule for a specific conversation.
   *
   * @example [zh-CN] 调用示例（查询会话规则） [en-US] Usage example (get conversation rule)
   * ```ts
   * const result = await client.pushManager.getConversationSilentMode({
   *   conversationId: 'user_001',
   *   conversationType: 'singleChat',
   * });
   * console.log(result.rule.remindType);
   * ```
   *
   * @param params - [zh-CN] 会话查询参数。 [en-US] Conversation query parameters.
   * @returns {Promise<ConversationSilentModeResponse>} [zh-CN] 返回目标会话的规则快照。 [en-US] Returns rule snapshot of the target conversation.
   */
  public async getConversationSilentMode(
    params: GetConversationSilentModeParams
  ): Promise<ConversationSilentModeResponse> {
    return this.runOperation(async (): Promise<ConversationSilentModeResponse> => {
      this.validateConversationId(params.conversationId, 'conversationId');
      this.validateConversationType(params.conversationType, 'conversationType');

      const context = this.getRestContextOrThrow();
      const restClient = this.getRestClient(context);
      const { orgName, appName } = this.parseAppKey(context.appKey);
      const typePath = this.mapConversationTypeToPath(params.conversationType);
      const endpoint = `/${orgName}/${appName}/users/${context.userId}/notification/${typePath}/${encodeURIComponent(params.conversationId)}`;

      logger.debug('Call getConversationSilentMode', {
        conversationId: params.conversationId,
        conversationType: params.conversationType,
      });

      const response = await restClient.request<unknown>(endpoint, {
        method: 'GET',
        operation: 'getConversationSilentMode',
      });

      return {
        conversationId: params.conversationId,
        conversationType: params.conversationType,
        rule: this.normalizeRuleView(this.resolveSilentModeRuleSource(response)),
      };
    });
  }

  /**
   * [zh-CN] 清除会话提醒类型配置，恢复服务端默认提醒策略。 [en-US] Clears conversation remind type and restores server-side default remind policy.
   *
   * @example [zh-CN] 调用示例（清除会话提醒类型） [en-US] Usage example (clear conversation remind type)
   * ```ts
   * const result = await client.pushManager.clearConversationRemindType({
   *   conversationId: 'group_123',
   *   conversationType: 'groupChat',
   * });
   * console.log(result.rule.remindType);
   * ```
   *
   * @param params - [zh-CN] 清除会话提醒类型所需参数。 [en-US] Parameters required to clear conversation remind type.
   * @returns {Promise<ConversationSilentModeResponse>} [zh-CN] 返回清除后的会话规则快照。 [en-US] Returns conversation rule snapshot after clearing.
   */
  public async clearConversationRemindType(
    params: ClearConversationRemindTypeParams
  ): Promise<ConversationSilentModeResponse> {
    return this.runOperation(async (): Promise<ConversationSilentModeResponse> => {
      this.validateConversationId(params.conversationId, 'conversationId');
      this.validateConversationType(params.conversationType, 'conversationType');

      const context = this.getRestContextOrThrow();
      const restClient = this.getRestClient(context);
      const { orgName, appName } = this.parseAppKey(context.appKey);
      const typePath = this.mapConversationTypeToPath(params.conversationType);
      const endpoint = `/${orgName}/${appName}/users/${context.userId}/notification/${typePath}/${encodeURIComponent(params.conversationId)}?resource=${encodeURIComponent(context.clientResource)}`;

      logger.debug('Call clearConversationRemindType', {
        conversationId: params.conversationId,
        conversationType: params.conversationType,
      });

      const response = await restClient.request<unknown>(endpoint, {
        method: 'PUT',
        body: {
          type: 'DEFAULT',
        },
        operation: 'clearConversationRemindType',
      });

      return {
        conversationId: params.conversationId,
        conversationType: params.conversationType,
        rule: this.normalizeRuleView(this.resolveSilentModeRuleSource(response), {
          remindType: 'DEFAULT',
        }),
      };
    });
  }

  /**
   * [zh-CN] 批量查询多个会话的免打扰规则，单次最多 20 条。 [en-US] Batch queries silent mode rules for multiple conversations, up to 20 items per request.
   *
   * @example [zh-CN] 调用示例（批量查询） [en-US] Usage example (batch query)
   * ```ts
   * const result = await client.pushManager.getConversationSilentModes({
   *   conversationList: [
   *     { conversationId: 'user_001', conversationType: 'singleChat' },
   *     { conversationId: 'group_123', conversationType: 'groupChat' },
   *   ],
   * });
   * console.log(result.conversations);
   * ```
   *
   * @param params - [zh-CN] 批量查询参数。 [en-US] Batch query parameters.
   * @returns {Promise<BatchConversationSilentModeResponse>} [zh-CN] 返回与输入顺序对齐的会话规则列表。 [en-US] Returns conversation rules aligned with the input order.
   */
  public async getConversationSilentModes(
    params: GetConversationSilentModesParams
  ): Promise<BatchConversationSilentModeResponse> {
    return this.runOperation(async (): Promise<BatchConversationSilentModeResponse> => {
      this.validateConversationList(params.conversationList, 'conversationList');

      const context = this.getRestContextOrThrow();
      const restClient = this.getRestClient(context);
      const { orgName, appName } = this.parseAppKey(context.appKey);

      const singleChatIds = params.conversationList
        .filter((item: ConversationIdentifier) => item.conversationType === 'singleChat')
        .map((item: ConversationIdentifier) => encodeURIComponent(item.conversationId))
        .join(',');
      const groupChatIds = params.conversationList
        .filter((item: ConversationIdentifier) => item.conversationType === 'groupChat')
        .map((item: ConversationIdentifier) => encodeURIComponent(item.conversationId))
        .join(',');

      const endpoint = `/${orgName}/${appName}/users/${context.userId}/notification?user=${singleChatIds}&group=${groupChatIds}`;

      logger.debug('Call getConversationSilentModes', {
        count: params.conversationList.length,
      });

      const response = await restClient.request<BatchConversationRawResponse>(endpoint, {
        method: 'GET',
        operation: 'getConversationSilentModes',
      });

      const userRules = this.resolveConversationRuleMap(response, 'user');
      const groupRules = this.resolveConversationRuleMap(response, 'group');

      const conversations = params.conversationList.map((item: ConversationIdentifier) => {
        const source =
          item.conversationType === 'singleChat'
            ? userRules[item.conversationId]
            : groupRules[item.conversationId];
        return {
          conversationId: item.conversationId,
          conversationType: item.conversationType,
          rule: this.normalizeRuleView(source),
        };
      });

      return {
        conversations,
      };
    });
  }

  /**
   * [zh-CN] 设置推送翻译语言。 [en-US] Sets push notification translation language.
   *
   * @example [zh-CN] 调用示例（设置推送语言） [en-US] Usage example (set push language)
   * ```ts
   * await client.pushManager.setPushLanguage({ language: 'zh-Hans' });
   * ```
   *
   * @param params - [zh-CN] 语言设置参数。 [en-US] Language setting parameters.
   * @returns {Promise<void>} [zh-CN] 成功时 resolve，无返回值。 [en-US] Resolves on success with no return value.
   */
  public async setPushLanguage(params: SetPushLanguageParams): Promise<void> {
    await this.runOperation(async (): Promise<void> => {
      this.validateLanguage(params.language, 'language');

      const context = this.getRestContextOrThrow();
      const restClient = this.getRestClient(context);
      const { orgName, appName } = this.parseAppKey(context.appKey);
      const endpoint = `/${orgName}/${appName}/users/${context.userId}/notification/language`;

      logger.debug('Call setPushLanguage', {
        language: params.language,
      });

      await restClient.request<PushLanguageRestResponse>(endpoint, {
        method: 'PUT',
        body: {
          translationLanguage: params.language,
        },
        operation: 'setPushLanguage',
      });
    });
  }

  /**
   * [zh-CN] 查询当前推送翻译语言。 [en-US] Gets current push notification translation language.
   *
   * @example [zh-CN] 调用示例（查询推送语言） [en-US] Usage example (get push language)
   * ```ts
   * const result = await client.pushManager.getPushLanguage();
   * console.log(result.language);
   * ```
   *
   * @param params - [zh-CN] 查询参数（当前无字段）。 [en-US] Query parameters (currently empty).
   * @returns {Promise<PushLanguageResponse>} [zh-CN] 返回当前语言值。 [en-US] Returns the current language value.
   */
  public async getPushLanguage(params: GetPushLanguageParams = {}): Promise<PushLanguageResponse> {
    void params;
    return this.runOperation(async (): Promise<PushLanguageResponse> => {
      const context = this.getRestContextOrThrow();
      const restClient = this.getRestClient(context);
      const { orgName, appName } = this.parseAppKey(context.appKey);
      const endpoint = `/${orgName}/${appName}/users/${context.userId}/notification/language`;

      logger.debug('Call getPushLanguage');

      const response = await restClient.request<PushLanguageRestResponse>(endpoint, {
        method: 'GET',
        operation: 'getPushLanguage',
      });

      return {
        language: this.resolvePushLanguage(response, ''),
      };
    });
  }

  /**
   * [zh-CN] 分页查询已设置提醒类型的会话列表。 [en-US] Paginates conversations that have explicit remind type settings.
   *
   * @example [zh-CN] 调用示例（分页查询） [en-US] Usage example (pagination query)
   * ```ts
   * const result = await client.pushManager.getConversationListByRemindType({
   *   pageSize: 20,
   *   cursor: '',
   * });
   * console.log(result.conversations, result.cursor);
   * ```
   *
   * @param params - [zh-CN] 分页参数，包含页大小与可选游标。 [en-US] Paging parameters including page size and optional cursor.
   * @returns {Promise<MutedConversationPageResponse>} [zh-CN] 返回会话列表与下一页游标。 [en-US] Returns conversation list and next cursor.
   */
  public getConversationListByRemindType(
    params: GetConversationListByRemindTypeParams
  ): Promise<MutedConversationPageResponse> {
    return this.runOperation((): Promise<MutedConversationPageResponse> => {
      logger.debug('Call getConversationListByRemindType', {
        pageSize: params.pageSize,
        hasCursor: Boolean(params.cursor),
      });
      const client = this.getClientOrThrow();
      const page = queryMutedConversationsFromSessionList({
        items: client.getCacheManager()?.loadSessionList() ?? [],
        pageSize: params.pageSize,
        cursor: params.cursor,
      });
      return Promise.resolve(page);
    });
  }

  private async runOperation<T>(operation: () => Promise<T>): Promise<T> {
    try {
      const result = await operation();
      return result;
    } catch (error) {
      const sdkError = this.normalizeSdkError(error);
      throw sdkError;
    }
  }

  private normalizeSdkError(error: unknown): SDKError {
    if (error instanceof SDKError) {
      return error;
    }
    if (error instanceof Error) {
      return new SDKError(`PushManager operation failed: ${error.message}`, ERROR_CODES.UNKNOWN);
    }
    return new SDKError('PushManager operation failed', ERROR_CODES.UNKNOWN);
  }

  private getRestContextOrThrow(): RestContext {
    if (!this.client) {
      throw this.buildValidationError('PushManager is not bound to client', [
        {
          path: 'pushManager.client',
          message: 'PushManager is not bound to client',
          rule: 'required',
        },
      ]);
    }
    return this.client.getRestContext();
  }

  private getRestClient(context: RestContext): RestClient {
    if (
      this.restClient &&
      this.restBaseUrl === context.restBaseUrl &&
      this.restToken === context.token
    ) {
      return this.restClient;
    }

    this.restClient = new RestClient(context.restBaseUrl, { errorMap: PUSH_REST_ERROR_MAP });
    this.restClient.setAuthToken(context.token);
    this.restBaseUrl = context.restBaseUrl;
    this.restToken = context.token;

    return this.restClient;
  }

  private getClientOrThrow(): ChatClient {
    if (!this.client) {
      throw new SDKError('PushManager is not bound to client', ERROR_CODES.VALIDATION_REQUIRED);
    }
    return this.client;
  }

  private parseAppKey(appKey: string): { orgName: string; appName: string } {
    const parts = appKey.split('#');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw this.buildValidationError('Invalid appKey format', [
        {
          path: 'appKey',
          message: 'appKey must be in format "org#app"',
          rule: 'invalid_format',
        },
      ]);
    }

    return {
      orgName: parts[0],
      appName: parts[1],
    };
  }

  private validateUploadPushTokenParams(params: UploadPushTokenParams): void {
    this.validateNonEmptyString(params.deviceId, 'deviceId');
    this.validateNonEmptyString(params.deviceToken, 'deviceToken');
    this.validateNonEmptyString(params.notifierName, 'notifierName');
  }

  private validateConversationId(value: string, path: string): void {
    this.validateNonEmptyString(value, path);
  }

  private validateConversationType(
    value: unknown,
    path: string
  ): asserts value is PushConversationType {
    if (
      typeof value !== 'string' ||
      !PUSH_CONVERSATION_TYPES.includes(value as PushConversationType)
    ) {
      throw this.buildValidationError('Conversation type is not supported', [
        {
          path,
          message: 'Only singleChat and groupChat are supported',
          rule: 'invalid_format',
        },
      ]);
    }
  }

  private validateConversationList(
    conversationList: ReadonlyArray<ConversationIdentifier>,
    path: string
  ): void {
    if (!Array.isArray(conversationList) || conversationList.length === 0) {
      throw this.buildValidationError('conversationList must be a non-empty array', [
        {
          path,
          message: 'conversationList must be a non-empty array',
          rule: 'required',
        },
      ]);
    }

    if (conversationList.length > MAX_BATCH_QUERY_SIZE) {
      throw this.buildValidationError('conversationList length must be <= 20', [
        {
          path,
          message: `conversationList length exceeds ${MAX_BATCH_QUERY_SIZE}`,
          rule: 'range',
        },
      ]);
    }

    conversationList.forEach((item: ConversationIdentifier, index: number) => {
      this.validateConversationId(item.conversationId, `${path}[${index}].conversationId`);
      this.validateConversationType(
        item.conversationType,
        `${path}[${index}].conversationType`
      );
    });
  }

  private validateLanguage(value: string, path: string): void {
    this.validateNonEmptyString(value, path);
  }

  private validateNonEmptyString(value: unknown, path: string): asserts value is string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw this.buildValidationError(`${path} must be a non-empty string`, [
        {
          path,
          message: `${path} must be a non-empty string`,
          rule: 'invalid_format',
        },
      ]);
    }
  }

  private validateRuleInput(rule: PushSilentModeRuleInput, path: string): void {
    if (!isRecord(rule)) {
      throw this.buildValidationError(`${path} must be an object`, [
        {
          path,
          message: `${path} must be an object`,
          rule: 'invalid_format',
        },
      ]);
    }

    switch (rule.mode) {
      case 'REMIND_TYPE': {
        if (!PUSH_REMIND_TYPES_FOR_INPUT.includes(rule.remindType)) {
          throw this.buildValidationError('rule.remindType is invalid', [
            {
              path: `${path}.remindType`,
              message: 'remindType must be one of ALL/AT/NONE',
              rule: 'invalid_format',
            },
          ]);
        }
        this.ensureNoConflictFields(rule, path, ['mode', 'remindType']);
        break;
      }
      case 'DURATION': {
        if (!Number.isInteger(rule.duration) || rule.duration <= 0) {
          throw this.buildValidationError('rule.duration must be a positive integer', [
            {
              path: `${path}.duration`,
              message: 'duration must be a positive integer',
              rule: 'range',
            },
          ]);
        }
        this.ensureNoConflictFields(rule, path, ['mode', 'duration']);
        break;
      }
      case 'INTERVAL': {
        this.validateTimePoint(rule.startTime, `${path}.startTime`);
        this.validateTimePoint(rule.endTime, `${path}.endTime`);
        this.ensureNoConflictFields(rule, path, ['mode', 'startTime', 'endTime']);
        break;
      }
      default: {
        throw this.buildValidationError('rule.mode is invalid', [
          {
            path: `${path}.mode`,
            message: 'mode must be one of REMIND_TYPE/DURATION/INTERVAL',
            rule: 'invalid_format',
          },
        ]);
      }
    }
  }

  private ensureNoConflictFields(
    rule: PushSilentModeRuleInput,
    path: string,
    allowedKeys: ReadonlyArray<string>
  ): void {
    const keys = Object.keys(rule);
    const conflict = keys.find((key: string) => !allowedKeys.includes(key));
    if (conflict) {
      throw this.buildValidationError('Silent mode rule contains conflicting fields', [
        {
          path: `${path}.${conflict}`,
          message: `${conflict} is not allowed when mode is ${rule.mode}`,
          rule: 'conflict',
        },
      ]);
    }
  }

  private validateTimePoint(point: PushTimePoint, path: string): void {
    if (!isRecord(point)) {
      throw this.buildValidationError(`${path} must be an object`, [
        {
          path,
          message: `${path} must be an object`,
          rule: 'invalid_format',
        },
      ]);
    }

    if (!Number.isInteger(point.hours) || point.hours < 0 || point.hours > 23) {
      throw this.buildValidationError('hours must be between 0 and 23', [
        {
          path: `${path}.hours`,
          message: 'hours must be between 0 and 23',
          rule: 'range',
        },
      ]);
    }

    if (!Number.isInteger(point.minutes) || point.minutes < 0 || point.minutes > 59) {
      throw this.buildValidationError('minutes must be between 0 and 59', [
        {
          path: `${path}.minutes`,
          message: 'minutes must be between 0 and 59',
          rule: 'range',
        },
      ]);
    }
  }

  private buildSilentModePayload(rule: PushSilentModeRuleInput): SilentModeRulePayload {
    switch (rule.mode) {
      case 'REMIND_TYPE':
        return {
          type: rule.remindType,
        };
      case 'DURATION':
        return {
          ignoreDuration: rule.duration,
        };
      case 'INTERVAL':
        return {
          ignoreInterval: `${this.formatIntervalSegment(rule.startTime)}-${this.formatIntervalSegment(rule.endTime)}`,
        };
    }
  }

  private normalizeRuleView(
    source: unknown,
    fallback?: PushSilentModeRuleInput | PushSilentModeRuleView
  ): PushSilentModeRuleView {
    const parsed = this.parseRuleView(source);
    if (parsed) {
      if (fallback) {
        return {
          ...this.toRuleViewFromFallback(fallback),
          ...parsed,
        };
      }
      return parsed;
    }

    if (fallback) {
      return this.toRuleViewFromFallback(fallback);
    }

    return {};
  }

  private parseRuleView(source: unknown): PushSilentModeRuleView | null {
    if (!isRecord(source)) {
      return null;
    }

    const rule: {
      remindType?: PushRemindType;
      expireTimestamp?: number;
      silentModeStartTime?: PushTimePoint;
      silentModeEndTime?: PushTimePoint;
    } = {};

    const remindType = this.normalizeRemindType(source.type);
    if (remindType !== null) {
      rule.remindType = remindType;
    }

    const expireTimestamp = source.ignoreDuration;
    if (
      typeof expireTimestamp === 'number' &&
      Number.isInteger(expireTimestamp) &&
      expireTimestamp > 0
    ) {
      rule.expireTimestamp = expireTimestamp;
    }

    const interval = source.ignoreInterval;
    if (typeof interval === 'string') {
      const parsedInterval = this.parseInterval(interval);
      if (parsedInterval) {
        rule.silentModeStartTime = parsedInterval.startTime;
        rule.silentModeEndTime = parsedInterval.endTime;
      }
    }

    if (
      rule.remindType !== undefined ||
      rule.expireTimestamp !== undefined ||
      (rule.silentModeStartTime !== undefined && rule.silentModeEndTime !== undefined)
    ) {
      return rule;
    }

    return null;
  }

  private parseInterval(
    interval: string
  ): { startTime: PushTimePoint; endTime: PushTimePoint } | null {
    const matched = interval.match(/^(\d{1,2}):(\d{1,2})-(\d{1,2}):(\d{1,2})$/);
    if (!matched) {
      return null;
    }

    const startHours = Number(matched[1]);
    const startMinutes = Number(matched[2]);
    const endHours = Number(matched[3]);
    const endMinutes = Number(matched[4]);

    if (
      !Number.isInteger(startHours) ||
      !Number.isInteger(startMinutes) ||
      !Number.isInteger(endHours) ||
      !Number.isInteger(endMinutes)
    ) {
      return null;
    }

    if (
      startHours < 0 ||
      startHours > 23 ||
      endHours < 0 ||
      endHours > 23 ||
      startMinutes < 0 ||
      startMinutes > 59 ||
      endMinutes < 0 ||
      endMinutes > 59
    ) {
      return null;
    }

    return {
      startTime: {
        hours: startHours,
        minutes: startMinutes,
      },
      endTime: {
        hours: endHours,
        minutes: endMinutes,
      },
    };
  }

  private toRuleViewFromFallback(
    fallback: PushSilentModeRuleInput | PushSilentModeRuleView
  ): PushSilentModeRuleView {
    if ('mode' in fallback) {
      switch (fallback.mode) {
        case 'REMIND_TYPE':
          return {
            remindType: fallback.remindType,
          };
        case 'DURATION':
          // DURATION 入参语义是秒，回读视图语义是到期时间戳。
          return {
            expireTimestamp: Date.now() + fallback.duration * 1000,
          };
        case 'INTERVAL':
          return {
            silentModeStartTime: fallback.startTime,
            silentModeEndTime: fallback.endTime,
          };
      }
    }

    return fallback;
  }

  private formatIntervalSegment(point: PushTimePoint): string {
    const hours = String(point.hours).padStart(2, '0');
    const minutes = String(point.minutes).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  private resolveConversationRuleMap(
    response: BatchConversationRawResponse,
    key: 'user' | 'group'
  ): Readonly<Record<string, unknown>> {
    if (isRecord(response.data)) {
      const nested = response.data[key];
      if (isRecord(nested)) {
        return nested;
      }
    }

    const flat = response[key];
    if (isRecord(flat)) {
      return flat;
    }

    return {};
  }

  private resolveSilentModeRuleSource(response: unknown): unknown {
    if (!isRecord(response)) {
      return response;
    }

    if (this.parseRuleView(response) !== null) {
      return response;
    }

    const nested = response.data;
    if (isRecord(nested) && this.parseRuleView(nested) !== null) {
      return nested;
    }

    return response;
  }

  private normalizeRemindType(value: unknown): PushRemindType | null {
    if (typeof value !== 'string') {
      return null;
    }

    if (value === 'MENTION_ONLY') {
      return 'AT';
    }

    if (PUSH_REMIND_TYPES.includes(value as PushRemindType)) {
      return value as PushRemindType;
    }

    return null;
  }

  private resolvePushLanguage(response: PushLanguageRestResponse, fallback: string): string {
    if (
      typeof response.translationLanguage === 'string' &&
      response.translationLanguage.length > 0
    ) {
      return response.translationLanguage;
    }

    if (typeof response.language === 'string' && response.language.length > 0) {
      return response.language;
    }

    if (isRecord(response.data)) {
      const translationLanguage = response.data.translationLanguage;
      if (typeof translationLanguage === 'string' && translationLanguage.length > 0) {
        return translationLanguage;
      }

      const language = response.data.language;
      if (typeof language === 'string' && language.length > 0) {
        return language;
      }
    }

    return fallback;
  }

  private mapConversationTypeToPath(type: PushConversationType): 'user' | 'chatgroup' {
    return type === 'singleChat' ? 'user' : 'chatgroup';
  }

  private buildValidationError(
    message: string,
    fields: ReadonlyArray<ValidationFieldError>
  ): ValidationError {
    return new ValidationError(message, {
      code: ERROR_CODES.VALIDATION_INVALID_FORMAT,
      details: {
        fields,
      },
    });
  }
}
