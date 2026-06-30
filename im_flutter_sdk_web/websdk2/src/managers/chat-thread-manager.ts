import type { ChatClient } from '../chat-client';
import { RestClient } from '../rest/client';
import { mergeRuntimeErrorMaps } from '../rest/error-map-types';
import { COMMON_ERROR_MAP } from '../rest/error-maps/common';
import { THREAD_ERROR_MAP } from '../rest/error-maps/thread';
import {
  requestCreateChatThread,
  requestDestroyChatThread,
  requestGetChatThreadInfo,
  requestGetChatThreadLastMessageList,
  requestGetChatThreadList,
  requestGetChatThreadMemberList,
  requestGetJoinedChatThreadList,
  requestJoinChatThread,
  requestLeaveChatThread,
  requestRemoveChatThreadMember,
  requestUpdateChatThreadName,
} from '../rest/chat-thread-management';
import type { RestContext } from '../types/chat-client';
import type {
  ChatThreadCreatedEventPayload,
  ChatThreadDestroyedEventPayload,
  ChatThreadDetail,
  ChatThreadEventHandlerMap,
  ChatThreadRawNotifyEvent,
  ChatThreadSummary,
  ChatThreadUpdatedEventPayload,
  ChatThreadUserRemovedEventPayload,
  ChatThreadMutationTarget,
  ChatThreadListResult,
  ChatThreadLastMessageListResult,
  ChatThreadMemberListResult,
  CreateChatThreadParams,
  CreateChatThreadResult,
  GetChatThreadInfoParams,
  GetChatThreadLastMessageListParams,
  GetChatThreadListParams,
  GetChatThreadMemberListParams,
  GetJoinedChatThreadListParams,
  RemoveChatThreadMemberParams,
  UpdateChatThreadNameParams,
} from '../types/chat-thread';
import type { EventHandlerId, EventPayloadMap } from '../types/event-system';
import type { ManagerBase, ManagerEventContext, RawNotifyEvent } from '../types/manager';
import { ValidationError, SDKError } from '../utils/errors';
import { ERROR_CODES } from '../utils/error-codes';
import { ChatThread } from './chat-thread/chat-thread';

type ThreadEventContext = ManagerEventContext<{
  readonly onChatThreadCreated?: (
    payload: EventPayloadMap['onChatThreadCreated']
  ) => void | Promise<void>;
  readonly onChatThreadDestroyed?: (
    payload: EventPayloadMap['onChatThreadDestroyed']
  ) => void | Promise<void>;
  readonly onChatThreadUpdated?: (
    payload: EventPayloadMap['onChatThreadUpdated']
  ) => void | Promise<void>;
  readonly onChatThreadUserRemoved?: (
    payload: EventPayloadMap['onChatThreadUserRemoved']
  ) => void | Promise<void>;
}>;

type ChatThreadPublicEvent =
  | {
      readonly eventName: 'onChatThreadCreated';
      readonly payload: ChatThreadCreatedEventPayload;
    }
  | {
      readonly eventName: 'onChatThreadDestroyed';
      readonly payload: ChatThreadDestroyedEventPayload;
    }
  | {
      readonly eventName: 'onChatThreadUpdated';
      readonly payload: ChatThreadUpdatedEventPayload;
    }
  | {
      readonly eventName: 'onChatThreadUserRemoved';
      readonly payload: ChatThreadUserRemovedEventPayload;
    };

const THREAD_REST_ERROR_MAP = mergeRuntimeErrorMaps(COMMON_ERROR_MAP, THREAD_ERROR_MAP);

/**
 * [zh-CN] ChatThread 公开管理器，负责子区创建、查询、成员管理、生命周期操作和事件监听。
 * [en-US] Public manager for chat thread creation, queries, member management, lifecycle operations, and event listening.
 */
export class ChatThreadManager implements ManagerBase<ChatClient> {
  public static readonly key = 'chatThreadManager' as const;
  public readonly capabilities = ['rawNotify:chatThread'] as const;

  private client: ChatClient | null = null;
  private eventContext: ThreadEventContext | null = null;
  private restClient: RestClient | null = null;
  private restBaseUrl: string | null = null;
  private restToken: string | null = null;
  private readonly registry = new Map<string, ChatThread>();

  public bind(client: ChatClient, context?: ManagerEventContext): void {
    this.client = client;
    this.eventContext = (context as ThreadEventContext | undefined) ?? null;
    this.registry.clear();
  }

  /**
   * [zh-CN] 注册 ChatThread 事件处理器。只包含移动端对齐的 4 个公开事件，不包含 `onChatThreadChange`。
   * [en-US] Registers chat thread event handlers. Only the four mobile-aligned public events are supported; `onChatThreadChange` is not exposed.
   *
   * @example [zh-CN] 调用示例（监听 Thread 创建） [en-US] Usage example (listen for thread creation)
   * ```ts
   * client.chatThreadManager.addEventHandler('thread-ui', {
   *   onChatThreadCreated: event => {
   *     console.log(event.chatThreadId);
   *   },
   * });
   * ```
   *
   * @param id - [zh-CN] 事件处理器 ID；相同 ID 会覆盖旧处理器。 [en-US] Event handler ID; using the same ID replaces the previous handler.
   * @param handlers - [zh-CN] ChatThread 事件处理器映射。 [en-US] Chat thread event handler map.
   * @returns {void} [zh-CN] 无返回值。 [en-US] Returns nothing.
   */
  public addEventHandler(id: EventHandlerId, handlers: ChatThreadEventHandlerMap): void {
    this.getEventContextOrThrow().addEventHandler(id, handlers);
  }

  /**
   * [zh-CN] 移除指定 ChatThread 事件处理器。
   * [en-US] Removes a chat thread event handler by ID.
   *
   * @example [zh-CN] 调用示例（取消监听） [en-US] Usage example (remove listener)
   * ```ts
   * client.chatThreadManager.removeEventHandler('thread-ui');
   * ```
   *
   * @param id - [zh-CN] 要移除的事件处理器 ID。 [en-US] Event handler ID to remove.
   * @returns {void} [zh-CN] 无返回值。 [en-US] Returns nothing.
   */
  public removeEventHandler(id: EventHandlerId): void {
    this.getEventContextOrThrow().removeEventHandler(id);
  }

  /**
   * @internal
   * [zh-CN] 处理 MSync Thread 原始通知并归一为公开 Thread 事件。
   * [en-US] Handles raw MSync thread notifications and normalizes them into public thread events.
   *
   * @param event - [zh-CN] 内部原始通知事件。 [en-US] Internal raw notify event.
   * @returns {void} [zh-CN] 无返回值。 [en-US] Returns nothing.
   */
  public handleRawNotify(event: RawNotifyEvent): void {
    if (event.type !== 'chatThread') {
      return;
    }
    const normalized = this.buildChatThreadPublicEvent(event.payload as ChatThreadRawNotifyEvent);
    if (!normalized) {
      return;
    }
    this.eventContext?.dispatch?.(normalized.eventName, normalized.payload);
  }

  /**
   * [zh-CN] 获取绑定指定 `chatThreadId` 的 ChatThread 实体对象。
   * [en-US] Gets a ChatThread facade bound to the specified `chatThreadId`.
   *
   * @example [zh-CN] 调用示例（获取实体对象） [en-US] Usage example (get facade)
   * ```ts
   * const thread = client.chatThreadManager.getChatThread('thread-1');
   * const detail = await thread.getInfo();
   * ```
   *
   * @param chatThreadId - [zh-CN] 子区 ID。 [en-US] Chat thread ID.
   * @returns {ChatThread} [zh-CN] 返回可复用的 ChatThread 实体对象。 [en-US] Returns a reusable ChatThread facade.
   */
  public getChatThread(chatThreadId: string): ChatThread {
    const normalizedId = chatThreadId.trim();
    if (normalizedId.length === 0) {
      throw new ValidationError('chatThreadId is required', {
        code: ERROR_CODES.VALIDATION_REQUIRED,
        details: {
          fields: [
            {
              path: 'chatThreadId',
              message: 'chatThreadId is required',
              rule: 'required',
            },
          ],
        },
      });
    }
    const existing = this.registry.get(normalizedId);
    if (existing) {
      return existing;
    }
    const chatThread = new ChatThread(normalizedId, this);
    this.registry.set(normalizedId, chatThread);
    return chatThread;
  }

  /**
   * [zh-CN] 创建子区。
   * [en-US] Creates a chat thread.
   *
   * @example [zh-CN] 调用示例（创建子区） [en-US] Usage example (create thread)
   * ```ts
   * const result = await client.chatThreadManager.createChatThread({
   *   parentId: 'group-1',
   *   name: 'Topic',
   *   messageId: 'msg-1',
   * });
   * ```
   *
   * @param params - [zh-CN] 创建参数，包含父群组 ID、子区名称和父消息 ID。 [en-US] Creation parameters including parent group ID, thread name, and parent message ID.
   * @operation createChatThread
   * @returns {Promise<CreateChatThreadResult>} [zh-CN] 返回新建子区 ID。 [en-US] Returns the created chat thread ID.
   */
  public async createChatThread(params: CreateChatThreadParams): Promise<CreateChatThreadResult> {
    return this.runOperation('createChatThread', async () => {
      const context = this.getRestContextOrThrow();
      return requestCreateChatThread(this.getRestClient(context), context, params);
    });
  }

  /**
   * [zh-CN] 查询指定群组下的子区列表。
   * [en-US] Lists chat threads under a parent group.
   *
   * @example [zh-CN] 调用示例（查询群内子区） [en-US] Usage example (list group threads)
   * ```ts
   * const page = await client.chatThreadManager.getChatThreadList({
   *   parentId: 'group-1',
   *   pageSize: 20,
   * });
   * ```
   *
   * @param params - [zh-CN] 查询参数，包含父群组 ID、分页大小和游标。 [en-US] Query parameters including parent group ID, page size, and cursor.
   * @operation getChatThreadList
   * @returns {Promise<ChatThreadListResult>} [zh-CN] 返回子区列表和下一页游标。 [en-US] Returns chat threads and the next cursor.
   */
  public async getChatThreadList(
    params: GetChatThreadListParams
  ): Promise<ChatThreadListResult> {
    return this.runOperation('getChatThreadList', async () => {
      const context = this.getRestContextOrThrow();
      return requestGetChatThreadList(this.getRestClient(context), context, params);
    });
  }

  /**
   * [zh-CN] 查询当前用户已加入的子区列表。
   * [en-US] Lists chat threads joined by the current user.
   *
   * @example [zh-CN] 调用示例（查询已加入子区） [en-US] Usage example (list joined threads)
   * ```ts
   * const page = await client.chatThreadManager.getJoinedChatThreadList({
   *   parentId: 'group-1',
   * });
   * ```
   *
   * @param params - [zh-CN] 查询参数；`parentId` 可选。 [en-US] Query parameters; `parentId` is optional.
   * @operation getJoinedChatThreadList
   * @returns {Promise<ChatThreadListResult>} [zh-CN] 返回已加入子区列表和下一页游标。 [en-US] Returns joined chat threads and the next cursor.
   */
  public async getJoinedChatThreadList(
    params: GetJoinedChatThreadListParams = {}
  ): Promise<ChatThreadListResult> {
    return this.runOperation('getJoinedChatThreadList', async () => {
      const context = this.getRestContextOrThrow();
      return requestGetJoinedChatThreadList(this.getRestClient(context), context, params);
    });
  }

  /**
   * [zh-CN] 查询子区详情。
   * [en-US] Gets chat thread details.
   *
   * @example [zh-CN] 调用示例（查询详情） [en-US] Usage example (get detail)
   * ```ts
   * const detail = await client.chatThreadManager.getChatThreadInfo({
   *   chatThreadId: 'thread-1',
   * });
   * ```
   *
   * @param params - [zh-CN] 查询参数，包含子区 ID。 [en-US] Query parameters including the chat thread ID.
   * @operation getChatThreadInfo
   * @returns {Promise<ChatThreadDetail>} [zh-CN] 返回子区详情。 [en-US] Returns chat thread details.
   */
  public async getChatThreadInfo(
    params: GetChatThreadInfoParams
  ): Promise<ChatThreadDetail> {
    return this.runOperation('getChatThreadInfo', async () => {
      const context = this.getRestContextOrThrow();
      return requestGetChatThreadInfo(this.getRestClient(context), context, params.chatThreadId);
    });
  }

  /**
   * [zh-CN] 加入子区。
   * [en-US] Joins a chat thread.
   *
   * @example [zh-CN] 调用示例（加入子区） [en-US] Usage example (join thread)
   * ```ts
   * await client.chatThreadManager.joinChatThread({ chatThreadId: 'thread-1' });
   * ```
   *
   * @param params - [zh-CN] 操作目标，包含子区 ID。 [en-US] Operation target including the chat thread ID.
   * @operation joinChatThread
   * @returns {Promise<void>} [zh-CN] 成功时无返回业务数据。 [en-US] Resolves with no business payload on success.
   */
  public async joinChatThread(params: ChatThreadMutationTarget): Promise<void> {
    return this.runOperation('joinChatThread', async () => {
      const context = this.getRestContextOrThrow();
      await requestJoinChatThread(this.getRestClient(context), context, params.chatThreadId);
    });
  }

  /**
   * [zh-CN] 退出子区。
   * [en-US] Leaves a chat thread.
   *
   * @example [zh-CN] 调用示例（退出子区） [en-US] Usage example (leave thread)
   * ```ts
   * await client.chatThreadManager.leaveChatThread({ chatThreadId: 'thread-1' });
   * ```
   *
   * @param params - [zh-CN] 操作目标，包含子区 ID。 [en-US] Operation target including the chat thread ID.
   * @operation leaveChatThread
   * @returns {Promise<void>} [zh-CN] 成功时无返回业务数据。 [en-US] Resolves with no business payload on success.
   */
  public async leaveChatThread(params: ChatThreadMutationTarget): Promise<void> {
    return this.runOperation('leaveChatThread', async () => {
      const context = this.getRestContextOrThrow();
      await requestLeaveChatThread(this.getRestClient(context), context, params.chatThreadId);
    });
  }

  /**
   * [zh-CN] 解散子区。
   * [en-US] Destroys a chat thread.
   *
   * @example [zh-CN] 调用示例（解散子区） [en-US] Usage example (destroy thread)
   * ```ts
   * await client.chatThreadManager.destroyChatThread({ chatThreadId: 'thread-1' });
   * ```
   *
   * @param params - [zh-CN] 操作目标，包含子区 ID。 [en-US] Operation target including the chat thread ID.
   * @operation destroyChatThread
   * @returns {Promise<void>} [zh-CN] 成功时无返回业务数据。 [en-US] Resolves with no business payload on success.
   */
  public async destroyChatThread(params: ChatThreadMutationTarget): Promise<void> {
    return this.runOperation('destroyChatThread', async () => {
      const context = this.getRestContextOrThrow();
      await requestDestroyChatThread(this.getRestClient(context), context, params.chatThreadId);
    });
  }

  /**
   * [zh-CN] 更新子区名称。
   * [en-US] Updates a chat thread name.
   *
   * @example [zh-CN] 调用示例（更新名称） [en-US] Usage example (update name)
   * ```ts
   * await client.chatThreadManager.updateChatThreadName({
   *   chatThreadId: 'thread-1',
   *   name: 'New topic',
   * });
   * ```
   *
   * @param params - [zh-CN] 更新参数，包含子区 ID 和新名称。 [en-US] Update parameters including the chat thread ID and new name.
   * @operation updateChatThreadName
   * @returns {Promise<void>} [zh-CN] 成功时无返回业务数据。 [en-US] Resolves with no business payload on success.
   */
  public async updateChatThreadName(params: UpdateChatThreadNameParams): Promise<void> {
    return this.runOperation('updateChatThreadName', async () => {
      const context = this.getRestContextOrThrow();
      await requestUpdateChatThreadName(this.getRestClient(context), context, params);
    });
  }

  /**
   * [zh-CN] 查询子区成员列表。
   * [en-US] Lists chat thread members.
   *
   * @example [zh-CN] 调用示例（查询成员） [en-US] Usage example (list members)
   * ```ts
   * const page = await client.chatThreadManager.getChatThreadMemberList({
   *   chatThreadId: 'thread-1',
   *   pageSize: 20,
   * });
   * ```
   *
   * @param params - [zh-CN] 查询参数，包含子区 ID、分页大小和游标。 [en-US] Query parameters including chat thread ID, page size, and cursor.
   * @operation getChatThreadMemberList
   * @returns {Promise<ChatThreadMemberListResult>} [zh-CN] 返回成员列表和下一页游标。 [en-US] Returns members and the next cursor.
   */
  public async getChatThreadMemberList(
    params: GetChatThreadMemberListParams
  ): Promise<ChatThreadMemberListResult> {
    return this.runOperation('getChatThreadMemberList', async () => {
      const context = this.getRestContextOrThrow();
      return requestGetChatThreadMemberList(this.getRestClient(context), context, params);
    });
  }

  /**
   * [zh-CN] 从子区移除成员。
   * [en-US] Removes a member from a chat thread.
   *
   * @example [zh-CN] 调用示例（移除成员） [en-US] Usage example (remove member)
   * ```ts
   * await client.chatThreadManager.removeChatThreadMember({
   *   chatThreadId: 'thread-1',
   *   memberId: 'user-1',
   * });
   * ```
   *
   * @param params - [zh-CN] 移除参数，包含子区 ID 和成员 ID。 [en-US] Removal parameters including chat thread ID and member ID.
   * @operation removeChatThreadMember
   * @returns {Promise<void>} [zh-CN] 成功时无返回业务数据。 [en-US] Resolves with no business payload on success.
   */
  public async removeChatThreadMember(params: RemoveChatThreadMemberParams): Promise<void> {
    return this.runOperation('removeChatThreadMember', async () => {
      const context = this.getRestContextOrThrow();
      await requestRemoveChatThreadMember(this.getRestClient(context), context, params);
    });
  }

  /**
   * [zh-CN] 批量查询子区最后一条消息。
   * [en-US] Gets the last messages of chat threads in batch.
   *
   * @example [zh-CN] 调用示例（查询最后消息） [en-US] Usage example (get last messages)
   * ```ts
   * const result = await client.chatThreadManager.getChatThreadLastMessageList({
   *   chatThreadIds: ['thread-1', 'thread-2'],
   * });
   * ```
   *
   * @param params - [zh-CN] 查询参数，包含最多 20 个子区 ID。 [en-US] Query parameters including up to 20 chat thread IDs.
   * @operation getChatThreadLastMessageList
   * @returns {Promise<ChatThreadLastMessageListResult>} [zh-CN] 返回每个子区的最后消息摘要。 [en-US] Returns the last message snippet for each chat thread.
   */
  public async getChatThreadLastMessageList(
    params: GetChatThreadLastMessageListParams
  ): Promise<ChatThreadLastMessageListResult> {
    return this.runOperation('getChatThreadLastMessageList', async () => {
      const context = this.getRestContextOrThrow();
      return requestGetChatThreadLastMessageList(this.getRestClient(context), context, params);
    });
  }

  private getClientOrThrow(): ChatClient {
    if (!this.client) {
      throw new ValidationError('ChatThreadManager is not bound to client', {
        code: ERROR_CODES.VALIDATION_REQUIRED,
        details: {
          fields: [
            {
              path: 'chatThreadManager.client',
              message: 'ChatThreadManager is not bound to client',
              rule: 'required',
            },
          ],
        },
      });
    }
    return this.client;
  }

  private getRestContextOrThrow(): RestContext {
    return this.getClientOrThrow().getRestContext();
  }

  private getEventContextOrThrow(): ThreadEventContext {
    if (!this.eventContext) {
      throw new ValidationError('ChatThreadManager is not bound to event context', {
        code: ERROR_CODES.VALIDATION_REQUIRED,
        details: {
          fields: [
            {
              path: 'chatThreadManager.eventContext',
              message: 'ChatThreadManager is not bound to event context',
              rule: 'required',
            },
          ],
        },
      });
    }
    return this.eventContext;
  }

  private getRestClient(context: RestContext): RestClient {
    if (this.restClient && this.restBaseUrl === context.restBaseUrl && this.restToken === context.token) {
      return this.restClient;
    }
    this.restClient = new RestClient(context.restBaseUrl, { errorMap: THREAD_REST_ERROR_MAP });
    this.restClient.setAuthToken(context.token);
    this.restBaseUrl = context.restBaseUrl;
    this.restToken = context.token;
    return this.restClient;
  }

  private async runOperation<T>(name: string, task: () => Promise<T>): Promise<T> {
    try {
      return await task();
    } catch (error) {
      if (error instanceof SDKError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new SDKError(`ChatThreadManager ${name} failed: ${message}`, ERROR_CODES.UNKNOWN);
    }
  }

  private buildChatThreadPublicEvent(
    rawEvent: ChatThreadRawNotifyEvent
  ): ChatThreadPublicEvent | null {
    const raw = rawEvent.payload;
    const chatThreadId = typeof raw.id === 'string' ? raw.id : '';
    const parentId = typeof raw.muc_parent_id === 'string' ? raw.muc_parent_id : '';
    if (!chatThreadId || !parentId) {
      return null;
    }

    const messageId = typeof raw.msg_parent_id === 'string' ? raw.msg_parent_id : undefined;
    const chatThreadName = typeof raw.name === 'string' ? raw.name : undefined;
    const messageCount = typeof raw.message_count === 'number' ? raw.message_count : undefined;
    const lastMessage =
      raw.last_message && typeof raw.last_message === 'object'
        ? this.tryBuildThreadMessageSnippet(raw.last_message)
        : undefined;
    const timestamp = typeof raw.timestamp === 'number' ? raw.timestamp : 0;
    const operatorId = typeof raw.from === 'string' ? raw.from : undefined;
    const thread: ChatThreadSummary = {
      chatThreadId,
      parentId,
      name: chatThreadName ?? '',
      messageId,
      messageCount,
      lastMessage,
    };

    switch (raw.operation) {
      case 'create':
        return {
          eventName: 'onChatThreadCreated',
          payload: {
            chatThreadId,
            parentId,
            operatorId,
            chatThreadName,
            messageId,
            thread,
            timestamp,
          },
        };
      case 'update':
      case 'update_msg':
        return {
          eventName: 'onChatThreadUpdated',
          payload: {
            chatThreadId,
            parentId,
            operatorId,
            chatThreadName,
            messageId,
            messageCount,
            lastMessage,
            thread,
            timestamp,
          },
        };
      case 'delete':
        return {
          eventName: 'onChatThreadDestroyed',
          payload: {
            chatThreadId,
            parentId,
            operatorId,
            timestamp,
          },
        };
      case 'kick':
        return {
          eventName: 'onChatThreadUserRemoved',
          payload: {
            chatThreadId,
            parentId,
            operatorId,
            memberId: raw.userIds?.[0],
            timestamp,
          },
        };
      default:
        return null;
    }
  }

  private tryBuildThreadMessageSnippet(
    raw: Record<string, unknown>
  ): import('../cache/cache-types').MessageSnippet | null {
    const msgId =
      (typeof raw.id === 'string' ? raw.id : undefined) ??
      (typeof raw.msgId === 'string' ? raw.msgId : undefined);
    if (!msgId) {
      return null;
    }
    const payload =
      raw.payload && typeof raw.payload === 'object'
        ? (raw.payload as Record<string, unknown>)
        : {};
    return {
      msgId,
      type: typeof payload.type === 'string' ? payload.type : '',
      body: payload,
      timestamp: typeof raw.timestamp === 'number' ? raw.timestamp : 0,
    };
  }
}
