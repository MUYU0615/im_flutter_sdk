/**
 * ChatManager 管理器
 */

import type { ChatClient } from '../chat-client';
import { RestClient } from '../rest/client';
import { mergeRuntimeErrorMaps } from '../rest/error-map-types';
import { CHAT_ERROR_MAP } from '../rest/error-maps/chat';
import { COMMON_ERROR_MAP } from '../rest/error-maps/common';
import {
  requestAddConversationMark,
  requestClearAllMessagesAndConversations,
  requestDeleteConversation,
  requestGetPinnedMessageList,
  requestPinMessage,
  requestRemoveConversationMark,
  requestSetConversationPinned,
  requestUnpinMessage,
} from '../rest/conversation-management';
import {
  hasSessionMark,
  toConversationItem,
} from '../core/session-list-sync/session-list-query';
import type {
  ConversationFilter,
  ConversationItem,
  ConversationMarkParams,
  ConversationMarkMutationResult,
  ConversationMutationResult,
  DeleteConversationParams,
  GetPinnedMessageListParams,
  PinnedMessageListResult,
  PinMessageParams,
  RefreshSessionListParams,
  SetConversationPinnedParams,
} from '../types/conversation';
import type { RestContext } from '../types/chat-client';
import type { ChatEventHandlerMap, EventHandlerId } from '../types/event-system';
import { ConnectionStatus } from '../types';
import {
  createCmdMessage as buildCmdMessage,
  createCombineMessage as buildCombineMessage,
  createCustomMessage as buildCustomMessage,
  createFileMessage as buildFileMessage,
  createImageMessage as buildImageMessage,
  createLocationMessage as buildLocationMessage,
  createTextMessage as buildTextMessage,
  createVideoMessage as buildVideoMessage,
  createVoiceMessage as buildVoiceMessage,
} from '../message/create-message';
import type {
  ChatActionResult,
  CreateCmdMessageParams,
  CreateCombineMessageParams,
  CreateCustomMessageParams,
  CreateFileMessageParams,
  CreateImageMessageParams,
  CreateLocationMessageParams,
  ConversationLocator,
  CreateTextMessageParams,
  CreateVideoMessageParams,
  CreateVoiceMessageParams,
  DownloadCombineMessageParams,
  DownloadCombineMessageInput,
  DownloadAttachmentParams,
  GetHistoryMessagesParams,
  GetReactionDetailParams,
  GetReactionListParams,
  GroupMessageReadUsersParams,
  GroupMessageReadUsersResult,
  MarkConversationReadParams,
  MarkMessageReadItem,
  MarkMessageReadParams,
  Message,
  MessageAttachmentDownloadResult,
  MessageHistoryPage,
  MessageReactionDetailPage,
  MessageReactionListItem,
  MessageTranslationResult,
  RecallMessageParams,
  ReactionOperationParams,
  RemoveHistoryMessagesParams,
  SearchMessagesParams,
  SearchMessagesResult,
  SendMessageOptions,
  Sender,
  TranslationLanguage,
  TranslateMessageParams,
  UpdateMessageParams,
  VoiceMessageBody,
  VoiceParams,
  VoiceSourceFile,
  VoiceToTextResult,
} from '../types';
import { ChatEventName } from '../types/event-system';
import type { ManagerBase, ManagerEventContext } from '../types/manager';
import {
  requestAddReaction,
  requestGetGroupMessageReadUsers,
  requestGetHistoryMessages,
  requestGetReactionDetail,
  requestGetReactionList,
  requestGetSupportedTranslationLanguages,
  requestRemoveHistoryMessages,
  requestRemoveReaction,
  requestSearchMessages,
  requestTranslateMessage,
} from '../rest/chat-management';
import {
  requestVoiceFileToText,
  requestVoiceMessageToText,
  validateVoiceMessageSource,
  validateVoiceSourceFile,
} from '../rest/speech-helpers';
import { Validator } from '../validators/validator';
import { searchMessagesSchema } from '../validators/search-messages';
import { ERROR_CODES } from '../utils/error-codes';
import {
  AuthenticationError,
  ConnectionError,
  NetworkError,
  RestBusinessError,
  RestTransportError,
  SDKError,
  ValidationError,
} from '../utils/errors';

interface ChatClientCombineMessageInternal {
  downloadAndParseCombinePayload(
    params: DownloadCombineMessageParams
  ): Promise<ReadonlyArray<Message>>;
}

const CHAT_REST_ERROR_MAP = mergeRuntimeErrorMaps(COMMON_ERROR_MAP, CHAT_ERROR_MAP);

/**
 * ChatManager 负责消息域动作、查询与事件订阅
 */
export class ChatManager implements ManagerBase<ChatClient> {
  public static readonly key = 'chatManager' as const;

  private client: ChatClient | null = null;
  private eventContext: ManagerEventContext | null = null;
  private restClient: RestClient | null = null;
  private restBaseUrl: string | null = null;
  private restToken: string | null = null;

  /**
   * @internal
   * [zh-CN] 绑定 ChatClient 实例与管理器事件上下文。该方法由 SDK 管理器注册流程调用。
   * [en-US] Binds a ChatClient instance and manager event context. This method is called by the SDK manager registration flow.
   *
   * @example
   * ```ts
   * const chatManager = new ChatManager();
   * chatManager.bind(client, context);
   * ```
   *
   * @param client - [zh-CN] ChatClient 实例。 [en-US] ChatClient instance.
   * @param context - [zh-CN] 管理器事件上下文。 [en-US] Manager event context.
   * @returns [zh-CN] 无返回值。 [en-US] No return value.
   */
  public bind(client: ChatClient, context?: ManagerEventContext): void {
    this.client = client;
    this.eventContext = context ?? null;
    this.restClient = null;
    this.restBaseUrl = null;
    this.restToken = null;
  }

  /**
   * [zh-CN] 发送一条已创建的消息。文本、图片、文件、语音、视频、位置、命令、自定义和合并消息均通过该入口发送。
   *
   * 事件触发：接收方（含发送方的其他设备）会收到 `onMessage` 事件。
   * 附件类消息（图片/文件/语音/视频）会先自动上传到服务器，上传成功后再发送。
   *
   * [en-US] Sends a created message. Text, image, file, voice, video, location, command, custom, and combine messages are all sent through this API.
   *
   * Event triggered: recipients (including sender's other devices) receive `onMessage`.
   * Attachment messages (image/file/voice/video) are auto-uploaded before sending.
   *
   * @example
   * ```ts
   * const message = chatManager.createTextMessage({
   *   conversationId: 'user_2',
   *   conversationType: 'singleChat',
   *   content: 'hello',
   * });
   * const sent = await chatManager.sendMessage(message);
   * ```
   *
   * @param message - [zh-CN] 待发送消息对象。 [en-US] Message object to send.
   * @param options - [zh-CN] 发送过程回调。 [en-US] Callbacks for the send lifecycle.
   * @returns [zh-CN] 发送成功后的消息对象。 [en-US] Message object after it is sent successfully.
   */
  public async sendMessage(message: Message, options?: SendMessageOptions): Promise<Message> {
    return this.getClientOrThrow().sendMessage(message, options);
  }

  /**
   * [zh-CN] 创建文本消息对象。创建后需调用 {@link ChatManager.sendMessage} 发送。
   * [en-US] Creates a text message object. Call {@link ChatManager.sendMessage} to send it.
   *
   * @example
   * ```ts
   * const message = chatManager.createTextMessage({
   *   conversationId: 'user_2',
   *   conversationType: 'singleChat',
   *   content: 'hello',
   * });
   * ```
   *
   * @param params - [zh-CN] 文本消息创建参数。 [en-US] Parameters for creating a text message.
   * @returns [zh-CN] 文本消息对象。 [en-US] Text message object.
   */
  public createTextMessage(params: CreateTextMessageParams): Message {
    return buildTextMessage(params, this.buildMessageSenderOrThrow());
  }

  /**
   * [zh-CN] 创建图片消息对象。支持传入本地文件或远程图片地址。
   * [en-US] Creates an image message object. Supports a local file or a remote image URL.
   *
   * @example
   * ```ts
   * const message = chatManager.createImageMessage({
   *   conversationId: 'group_1',
   *   conversationType: 'groupChat',
   *   data: imageFile,
   * });
   * ```
   *
   * @param params - [zh-CN] 图片消息创建参数。 [en-US] Parameters for creating an image message.
   * @returns [zh-CN] 图片消息对象。 [en-US] Image message object.
   */
  public createImageMessage(params: CreateImageMessageParams): Message {
    return buildImageMessage(
      params,
      this.buildMessageSenderOrThrow(),
      this.getClientOrThrow().getMessageCreationOptions()
    );
  }

  /**
   * [zh-CN] 创建文件消息对象。支持传入本地文件或远程文件地址。
   * [en-US] Creates a file message object. Supports a local file or a remote file URL.
   *
   * @example
   * ```ts
   * const message = chatManager.createFileMessage({
   *   conversationId: 'user_2',
   *   conversationType: 'singleChat',
   *   data: file,
   * });
   * ```
   *
   * @param params - [zh-CN] 文件消息创建参数。 [en-US] Parameters for creating a file message.
   * @returns [zh-CN] 文件消息对象。 [en-US] File message object.
   */
  public createFileMessage(params: CreateFileMessageParams): Message {
    return buildFileMessage(params, this.buildMessageSenderOrThrow());
  }

  /**
   * [zh-CN] 创建语音消息对象。支持传入本地语音文件或远程语音地址。
   * [en-US] Creates a voice message object. Supports a local voice file or a remote voice URL.
   *
   * @example
   * ```ts
   * const message = chatManager.createVoiceMessage({
   *   conversationId: 'user_2',
   *   conversationType: 'singleChat',
   *   data: voiceFile,
   *   duration: 3,
   * });
   * ```
   *
   * @param params - [zh-CN] 语音消息创建参数。 [en-US] Parameters for creating a voice message.
   * @returns [zh-CN] 语音消息对象。 [en-US] Voice message object.
   */
  public createVoiceMessage(params: CreateVoiceMessageParams): Message {
    return buildVoiceMessage(params, this.buildMessageSenderOrThrow());
  }

  /**
   * [zh-CN] 创建视频消息对象。支持传入本地视频文件或远程视频地址。
   * [en-US] Creates a video message object. Supports a local video file or a remote video URL.
   *
   * @example
   * ```ts
   * const message = chatManager.createVideoMessage({
   *   conversationId: 'group_1',
   *   conversationType: 'groupChat',
   *   data: videoFile,
   *   duration: 12,
   * });
   * ```
   *
   * @param params - [zh-CN] 视频消息创建参数。 [en-US] Parameters for creating a video message.
   * @returns [zh-CN] 视频消息对象。 [en-US] Video message object.
   */
  public createVideoMessage(params: CreateVideoMessageParams): Message {
    return buildVideoMessage(params, this.buildMessageSenderOrThrow());
  }

  /**
   * [zh-CN] 创建位置消息对象。
   * [en-US] Creates a location message object.
   *
   * @example
   * ```ts
   * const message = chatManager.createLocationMessage({
   *   conversationId: 'user_2',
   *   conversationType: 'singleChat',
   *   latitude: 39.9042,
   *   longitude: 116.4074,
   *   address: 'Beijing',
   * });
   * ```
   *
   * @param params - [zh-CN] 位置消息创建参数。 [en-US] Parameters for creating a location message.
   * @returns [zh-CN] 位置消息对象。 [en-US] Location message object.
   */
  public createLocationMessage(params: CreateLocationMessageParams): Message {
    return buildLocationMessage(params, this.buildMessageSenderOrThrow());
  }

  /**
   * [zh-CN] 创建命令消息对象。命令消息通常用于业务自定义控制信令。
   * [en-US] Creates a command message object. Command messages are usually used for business-defined control signaling.
   *
   * @example
   * ```ts
   * const message = chatManager.createCmdMessage({
   *   conversationId: 'user_2',
   *   conversationType: 'singleChat',
   *   action: 'typing',
   * });
   * ```
   *
   * @param params - [zh-CN] 命令消息创建参数。 [en-US] Parameters for creating a command message.
   * @returns [zh-CN] 命令消息对象。 [en-US] Command message object.
   */
  public createCmdMessage(params: CreateCmdMessageParams): Message {
    return buildCmdMessage(params, this.buildMessageSenderOrThrow());
  }

  /**
   * [zh-CN] 创建自定义消息对象。可通过 `event` 与 `params` 承载业务自定义内容。
   * [en-US] Creates a custom message object. Use `event` and `params` to carry business-defined content.
   *
   * @example
   * ```ts
   * const message = chatManager.createCustomMessage({
   *   conversationId: 'user_2',
   *   conversationType: 'singleChat',
   *   event: 'gift',
   *   params: { id: 'rose' },
   * });
   * ```
   *
   * @param params - [zh-CN] 自定义消息创建参数。 [en-US] Parameters for creating a custom message.
   * @returns [zh-CN] 自定义消息对象。 [en-US] Custom message object.
   */
  public createCustomMessage(params: CreateCustomMessageParams): Message {
    return buildCustomMessage(params, this.buildMessageSenderOrThrow());
  }

  /**
   * [zh-CN] 创建合并消息对象，用于发送聊天记录合集。
   * [en-US] Creates a combine message object for sending a collection of chat records.
   *
   * @example
   * ```ts
   * const message = chatManager.createCombineMessage({
   *   conversationId: 'group_1',
   *   conversationType: 'groupChat',
   *   title: '聊天记录',
   *   summary: '3 条消息',
   *   messageList: selectedMessages,
   * });
   * ```
   *
   * @param params - [zh-CN] 合并消息创建参数。 [en-US] Parameters for creating a combine message.
   * @returns [zh-CN] 合并消息对象。 [en-US] Combine message object.
   */
  public createCombineMessage(params: CreateCombineMessageParams): Message {
    return buildCombineMessage(params, this.buildMessageSenderOrThrow());
  }

  /**
   * [zh-CN] 从本地会话列表缓存中获取会话，支持通过 filter 过滤。
   * [en-US] Gets conversations from the local session-list cache, with optional filtering.
   *
   * @example
   * ```ts
   * // 获取全部会话
   * const all = chatManager.getConversationList();
   * // 获取置顶会话
   * const pinned = chatManager.getConversationList({ isPinned: true });
   * // 获取指定标记的会话
   * const marked = chatManager.getConversationList({ mark: 3 });
   * ```
   *
   * @param filter - [zh-CN] 可选过滤条件。 [en-US] Optional filter criteria.
   * @returns [zh-CN] 匹配条件的会话数组。 [en-US] Array of conversations matching the filter.
   */
  public getConversationList(filter?: ConversationFilter): ReadonlyArray<ConversationItem> {
    if (filter?.mark !== undefined) {
      if (!Number.isInteger(filter.mark) || filter.mark < 0 || filter.mark > 19) {
        throw new ValidationError('filter.mark must be an integer between 0 and 19', {
          code: ERROR_CODES.VALIDATION_INVALID_FORMAT,
          details: {
            fields: [
              {
                path: 'filter.mark',
                message: 'filter.mark must be an integer between 0 and 19',
                rule: 'invalid_format',
              },
            ],
          },
        });
      }
    }
    const sessionList = this.getClientOrThrow().getCacheManager()?.loadSessionList() ?? [];
    const items = sessionList
      .filter(item => {
        if (item.lastMessage === null) {
          return false;
        }
        if (filter?.isPinned !== undefined && item.isPinned !== filter.isPinned) {
          return false;
        }
        if (filter?.mark !== undefined && !hasSessionMark(item, filter.mark)) {
          return false;
        }
        return true;
      })
      .map(toConversationItem);
    this.getClientOrThrow().markConversationAccess(
      items.map(item => ({
        conversationId: item.conversationId,
        type: item.conversationType,
      }))
    );
    return items;
  }

  /**
   * [zh-CN] 设置当前正在浏览的会话。设置后，该会话收到在线消息时 SDK 仍会更新最后消息和列表排序，但不会累加本地未读数。该状态只保存在当前 SDK 会话内存中，切换页面或关闭会话时应调用 `resetCurrentConversation()`。
   * [en-US] Sets the conversation currently being viewed. After it is set, online messages received in this conversation still update the last message and list order, but do not increase the local unread count. This state is kept only in the current SDK session memory; call `resetCurrentConversation()` when leaving or closing the conversation.
   *
   * @example
   * ```ts
   * chatManager.setCurrentConversation({
   *   conversationId: 'user_2',
   *   conversationType: 'singleChat',
   * });
   * ```
   *
   * @param params - [zh-CN] 当前正在浏览的会话定位参数。 [en-US] Locator of the conversation currently being viewed.
   * @returns [zh-CN] 无返回值。 [en-US] No return value.
   */
  public setCurrentConversation(params: ConversationLocator): void {
    this.validateConversationLocator(params);
    this.getClientOrThrow().getCacheManager()?.setCurrentConversation({
      conversationId: params.conversationId,
      type: params.conversationType,
    });
  }

  /**
   * [zh-CN] 重置当前正在浏览的会话。重置后，收到在线消息会按默认规则累加对应会话的本地未读数。
   * [en-US] Resets the conversation currently being viewed. After resetting it, online messages increase the local unread count according to the default rule.
   *
   * @example
   * ```ts
   * chatManager.resetCurrentConversation();
   * ```
   *
   * @returns [zh-CN] 无返回值。 [en-US] No return value.
   */
  public resetCurrentConversation(): void {
    this.getClientOrThrow().getCacheManager()?.resetCurrentConversation();
  }

  /**
   * [zh-CN] 获取当前正在浏览的会话；未设置时返回 `null`。
   * [en-US] Gets the conversation currently being viewed, or `null` when none is set.
   *
   * @example
   * ```ts
   * const current = chatManager.getCurrentConversation();
   * ```
   *
   * @returns [zh-CN] 当前正在浏览的会话定位参数，未设置时为 `null`。 [en-US] Locator of the conversation currently being viewed, or `null` when none is set.
   */
  public getCurrentConversation(): ConversationLocator | null {
    const current = this.getClientOrThrow().getCacheManager()?.getCurrentConversation() ?? null;
    return current
      ? {
          conversationId: current.conversationId,
          conversationType: current.type,
        }
      : null;
  }

  /**
   * [zh-CN] 主动向服务端刷新会话列表，并返回刷新后的公开会话列表。
   * [en-US] Refreshes the conversation list from the server and returns the updated public conversation list.
   *
   * @example
   * ```ts
   * const conversations = await chatManager.refreshSessionList({ includeEmpty: true });
   * ```
   *
   * @param params - [zh-CN] 刷新会话列表的选项。 [en-US] Options for refreshing the session list.
   * @returns [zh-CN] 刷新后的公开会话列表。 [en-US] Refreshed public conversation list.
   */
  public refreshSessionList(
    params?: RefreshSessionListParams
  ): Promise<ReadonlyArray<ConversationItem>> {
    return this.getClientOrThrow().refreshSessionList(params);
  }

  /**
   * [zh-CN] 删除指定会话，可选择同时删除服务端漫游消息。
   * 删除成功后，SDK 会同步删除本地会话列表缓存；如果本地会话列表发生变化，会派发 `onConversationListUpdate`，`reason` 为 `local`。
   * [en-US] Deletes a conversation and can optionally delete server-side roaming messages.
   * After deletion succeeds, the SDK also removes the local conversation-list cache entry. If the local conversation list changes, `onConversationListUpdate` is dispatched with `reason` set to `local`.
   *
   * @example
   * ```ts
   * await chatManager.deleteConversation({
   *   conversationId: 'user_2',
   *   conversationType: 'singleChat',
   *   deleteRoamingMessages: false,
   * });
   * ```
   *
   * @param params - [zh-CN] 删除会话参数。 [en-US] Parameters for deleting a conversation.
   * @returns [zh-CN] 会话删除结果。 [en-US] Conversation deletion result.
   */
  public async deleteConversation(
    params: DeleteConversationParams
  ): Promise<ConversationMutationResult> {
    const context = this.getRestContextOrThrow();
    const result = await requestDeleteConversation(this.getRestClient(context), context, params);
    const client = this.getClientOrThrow();
    const cacheResult = client.getCacheManager()?.deleteConversation({
      conversationId: result.conversationId,
      type: result.conversationType,
    });
    if (cacheResult?.changed) {
      client.emitConversationListUpdate('local');
    }
    return result;
  }

  /**
   * [zh-CN] 设置或取消设置会话置顶状态。
   * [en-US] Pins or unpins a conversation.
   *
   * @example
   * ```ts
   * await chatManager.setConversationPinned({
   *   conversationId: 'group_1',
   *   conversationType: 'groupChat',
   *   pinned: true,
   * });
   * ```
   *
   * @param params - [zh-CN] 会话置顶参数。 [en-US] Parameters for setting the pinned status.
   * @returns [zh-CN] 会话置顶变更结果。 [en-US] Conversation pinned-status mutation result.
   */
  public async setConversationPinned(
    params: SetConversationPinnedParams
  ): Promise<ConversationMutationResult> {
    const context = this.getRestContextOrThrow();
    const result = await requestSetConversationPinned(this.getRestClient(context), context, params);
    const cacheManager = this.getClientOrThrow().getCacheManager();
    const cacheResult = cacheManager?.applyConversationPinnedMutation({
      conversationId: result.conversationId,
      type: result.conversationType,
      isPinned: result.isPinned ?? params.pinned,
      pinnedTime: result.pinnedTime,
    });
    if (cacheResult?.changed) {
      this.getClientOrThrow().emitConversationListUpdate('local');
    }
    return result;
  }

  /**
   * [zh-CN] 为单个或多个会话添加标记。
   * [en-US] Adds a mark to one or more conversations.
   *
   * @example
   * ```ts
   * await chatManager.addConversationMark({
   *   conversationId: 'user_2',
   *   conversationType: 'singleChat',
   *   mark: 0,
   * });
   * ```
   *
   * @param params - [zh-CN] 会话标记参数。 [en-US] Conversation mark parameters.
   * @returns [zh-CN] 会话标记添加结果。 [en-US] Result of adding the conversation mark.
   */
  public async addConversationMark(
    params: ConversationMarkParams
  ): Promise<ConversationMarkMutationResult> {
    const context = this.getRestContextOrThrow();
    const result = await requestAddConversationMark(this.getRestClient(context), context, params);
    const cacheManager = this.getClientOrThrow().getCacheManager();
    const cacheResult = cacheManager?.applyConversationMarkMutation({
      conversations: [
        ...result.succeeded.map(item => ({ ...item, applied: true })),
        ...result.failed.map(item => ({ ...item, applied: false })),
      ],
      mark: result.mark,
      operation: result.operation,
    });
    if (cacheResult?.changed) {
      this.getClientOrThrow().emitConversationListUpdate('local');
    }
    return result;
  }

  /**
   * [zh-CN] 从单个或多个会话移除标记。
   * [en-US] Removes a mark from one or more conversations.
   *
   * @example
   * ```ts
   * await chatManager.removeConversationMark({
   *   conversations: [
   *     { conversationId: 'user_2', conversationType: 'singleChat' },
   *   ],
   *   mark: 0,
   * });
   * ```
   *
   * @param params - [zh-CN] 会话标记参数。 [en-US] Conversation mark parameters.
   * @returns [zh-CN] 会话标记移除结果。 [en-US] Result of removing the conversation mark.
   */
  public async removeConversationMark(
    params: ConversationMarkParams
  ): Promise<ConversationMarkMutationResult> {
    const context = this.getRestContextOrThrow();
    const result = await requestRemoveConversationMark(
      this.getRestClient(context),
      context,
      params
    );
    const cacheManager = this.getClientOrThrow().getCacheManager();
    const cacheResult = cacheManager?.applyConversationMarkMutation({
      conversations: [
        ...result.succeeded.map(item => ({ ...item, applied: true })),
        ...result.failed.map(item => ({ ...item, applied: false })),
      ],
      mark: result.mark,
      operation: result.operation,
    });
    if (cacheResult?.changed) {
      this.getClientOrThrow().emitConversationListUpdate('local');
    }
    return result;
  }

  /**
   * [zh-CN] 清空当前用户的所有会话和服务端漫游消息。
   * 清空成功后，SDK 会同步清空本地 conversation/session-list 缓存；如果本地会话列表发生变化，会派发 `onConversationListUpdate`，`reason` 为 `local`。
   * [en-US] Clears all conversations and server-side roaming messages of the current user.
   * After clearing succeeds, the SDK also clears the local conversation/session-list cache. If the local conversation list changes, `onConversationListUpdate` is dispatched with `reason` set to `local`.
   *
   * @example
   * ```ts
   * await chatManager.clearAllMessagesAndConversations();
   * ```
   *
   * @returns [zh-CN] 清空完成后 resolve。 [en-US] Resolves after the cleanup completes.
   */
  public async clearAllMessagesAndConversations(): Promise<void> {
    const context = this.getRestContextOrThrow();
    await requestClearAllMessagesAndConversations(this.getRestClient(context), context);
    const client = this.getClientOrThrow();
    const cacheResult = client.getCacheManager()?.clearConversations();
    if (cacheResult?.changed) {
      client.emitConversationListUpdate('local');
    }
  }

  /**
   * [zh-CN] 在指定会话中置顶一条消息。
   *
   * 事件触发：会话中的所有成员会收到 `onPinnedMessageChanged` 事件（operation='pin'）。
   *
   * [en-US] Pins a message in the specified conversation.
   *
   * Event triggered: all members in the conversation receive `onPinnedMessageChanged` (operation='pin').
   *
   * @example
   * ```ts
   * await chatManager.pinMessage({
   *   conversationId: 'group_1',
   *   conversationType: 'groupChat',
   *   messageId: 'msg_1',
   * });
   * ```
   *
   * @param params - [zh-CN] 置顶消息参数。 [en-US] Parameters for pinning a message.
   * @returns [zh-CN] 置顶消息结果。 [en-US] Pin-message mutation result.
   */
  public async pinMessage(params: PinMessageParams): Promise<void> {
    const context = this.getRestContextOrThrow();
    const result = await this.executeRestOperation(() =>
      requestPinMessage(this.getRestClient(context), context, params)
    );
    this.dispatchEvent(ChatEventName.PINNED_MESSAGE_CHANGED, {
      messageId: result.messageId,
      conversationId: result.conversationId,
      conversationType: result.conversationType,
      operation: 'pin',
      pinTime: Date.now(),
      operatorId: this.getCurrentUserIdOrThrow(),
    });
  }

  /**
   * [zh-CN] 取消置顶指定会话中的一条消息。
   *
   * 事件触发：会话中的所有成员会收到 `onPinnedMessageChanged` 事件（operation='unpin'）。
   *
   * [en-US] Unpins a message in the specified conversation.
   *
   * Event triggered: all members in the conversation receive `onPinnedMessageChanged` (operation='unpin').
   *
   * @example
   * ```ts
   * await chatManager.unpinMessage({
   *   conversationId: 'group_1',
   *   conversationType: 'groupChat',
   *   messageId: 'msg_1',
   * });
   * ```
   *
   * @param params - [zh-CN] 取消置顶消息参数。 [en-US] Parameters for unpinning a message.
   * @returns [zh-CN] 取消置顶消息结果。 [en-US] Unpin-message mutation result.
   */
  public async unpinMessage(params: PinMessageParams): Promise<void> {
    const context = this.getRestContextOrThrow();
    const result = await this.executeRestOperation(() =>
      requestUnpinMessage(this.getRestClient(context), context, params)
    );
    this.dispatchEvent(ChatEventName.PINNED_MESSAGE_CHANGED, {
      messageId: result.messageId,
      conversationId: result.conversationId,
      conversationType: result.conversationType,
      operation: 'unpin',
      operatorId: this.getCurrentUserIdOrThrow(),
    });
  }

  /**
   * [zh-CN] 获取指定会话内的置顶消息列表。该接口不分页，不接收 messageId，最多返回 20 条。
   * [en-US] Gets pinned messages in a conversation. This API is not paginated, does not accept messageId, and returns at most 20 items.
   *
   * @example
   * ```ts
   * const result = await chatManager.getPinnedMessageList({
   *   conversationId: 'group_1',
   *   conversationType: 'groupChat',
   * });
   * ```
   *
   * @param params - [zh-CN] 会话定位参数。 [en-US] Conversation locator.
   * @returns [zh-CN] 置顶消息列表。 [en-US] Pinned message list.
   */
  public async getPinnedMessageList(
    params: GetPinnedMessageListParams
  ): Promise<PinnedMessageListResult> {
    const context = this.getRestContextOrThrow();
    return this.executeRestOperation(() =>
      requestGetPinnedMessageList(this.getRestClient(context), context, params)
    );
  }

  /**
   * [zh-CN] 注册消息域事件处理器。
   * [en-US] Registers chat-domain event handlers.
   *
   * @example
   * ```ts
   * chatManager.addEventHandler('chat-page', {
   *   onMessage: event => {
   *     console.log(event.messages);
   *   },
   * });
   * ```
   *
   * @param id - [zh-CN] 事件处理器唯一标识。 [en-US] Unique event handler ID.
   * @param handlers - [zh-CN] 消息事件处理器集合。 [en-US] Chat event handler map.
   * @returns [zh-CN] 无返回值。 [en-US] No return value.
   */
  public addEventHandler(id: EventHandlerId, handlers: ChatEventHandlerMap): void {
    this.getEventContextOrThrow().addEventHandler(id, handlers);
  }

  /**
   * [zh-CN] 移除已注册的消息域事件处理器。
   * [en-US] Removes registered chat-domain event handlers.
   *
   * @example
   * ```ts
   * chatManager.removeEventHandler('chat-page');
   * ```
   *
   * @param id - [zh-CN] 事件处理器唯一标识。 [en-US] Unique event handler ID.
   * @returns [zh-CN] 无返回值。 [en-US] No return value.
   */
  public removeEventHandler(id: EventHandlerId): void {
    this.getEventContextOrThrow().removeEventHandler(id);
  }

  /**
   * [zh-CN] 将指定会话标记为已读。
   *
   * 事件触发：单聊对方会收到 `onConversationRead` 事件；本地调用方不会收到该事件。群聊仅清除服务端未读数，不触发对方事件。
   * 标记成功后，SDK 会同步清空本地会话列表中的未读数；如果本地会话列表发生变化，本地调用方会收到 `onConversationListUpdate`，`reason` 为 `local`。
   *
   * [en-US] Marks the specified conversation as read.
   *
   * Event triggered: the other party in a single chat receives `onConversationRead`; the local caller does not receive this event. Group chat only clears the server unread count and does not trigger a peer event.
   * After the mark succeeds, the SDK also clears the local conversation-list unread count. If the local conversation list changes, the local caller receives `onConversationListUpdate` with `reason` set to `local`.
   *
   * @example
   * ```ts
   * await chatManager.markConversationRead({
   *   conversationId: 'user_2',
   *   conversationType: 'singleChat',
   * });
   * ```
   *
   * @param params - [zh-CN] 会话定位参数。 [en-US] Conversation locator.
   * @returns [zh-CN] 标记完成后 resolve。 [en-US] Resolves after the conversation is marked as read.
   */
  public async markConversationRead(params: MarkConversationReadParams): Promise<void> {
    this.validateConversationLocator(params);
    await this.requireConnectedClient().sendMessageAction(
      {
        kind: 'conversationRead',
        conversationId: params.conversationId,
        conversationType: params.conversationType,
      },
      (statusCode, reason) => this.buildActionError(statusCode, reason)
    );
    const client = this.getClientOrThrow();
    const cacheResult = client.getCacheManager()?.markConversationRead({
      conversationId: params.conversationId,
      type: params.conversationType,
    });
    if (cacheResult?.changed) {
      client.emitConversationListUpdate('local');
    }
  }

  /**
   * [zh-CN] 批量标记消息已读。仅能对同一个会话内收到的单聊或群聊消息发送。
   *
   * 事件触发：消息的原始发送方会收到 `onMessageRead` 事件；本地调用方不会收到该事件。
   * 注意：群聊已读回执有效期为 3 天，最多支持 200 人的群。需要在控制台开通。
   *
   * [en-US] Marks messages as read in batch. Only received one-to-one or group messages in the same conversation can be acknowledged.
   *
   * Event triggered: the original message sender receives `onMessageRead`; the local caller does not receive this event.
   * Note: group read receipts are valid for 3 days, max 200 members. Requires console activation.
   *
   * @example
   * ```ts
   * await chatManager.markMessageRead({
   *   messages: [{ message }],
   * });
   *
   * await chatManager.markMessageRead({
   *   messages: [
   *     { message: groupMessage1, ackContent: 'read-1' },
   *     { message: groupMessage2, ackContent: 'read-2' },
   *   ],
   * });
   * ```
   *
   * @param params - [zh-CN] 批量消息已读参数。 [en-US] Parameters for marking messages as read.
   * @returns [zh-CN] 全部已读回执发送完成后 resolve。 [en-US] Resolves after all read receipts are sent.
   */
  public async markMessageRead(params: MarkMessageReadParams): Promise<void> {
    const messages = this.validateReadAckMessages(params);
    const connectedClient = this.requireConnectedClient();
    for (const item of messages) {
      const { message } = item;
      const action =
        message.conversationType === 'groupChat'
          ? {
              kind: 'groupMessageRead' as const,
              conversationId: message.conversationId,
              conversationType: 'groupChat' as const,
              messageId: message.msgServerId,
              ackContent: item.ackContent,
            }
          : {
              kind: 'messageRead' as const,
              conversationId: message.conversationId,
              conversationType: 'singleChat' as const,
              messageId: message.msgServerId,
            };
      await connectedClient.sendMessageAction(action, (statusCode, reason) =>
        this.buildActionError(statusCode, reason)
      );
    }
  }

  /**
   * [zh-CN] 撤回一条已发送消息。
   *
   * 事件触发：会话中的所有成员（含撤回者的其他设备）会收到 `onMessageRecalled` 事件。
   * 注意：默认 2 分钟内可撤回（可在控制台配置最长 7 天）；群主/管理员可撤回他人消息；除 CMD 外所有类型均支持。
   *
   * [en-US] Recalls a sent message.
   *
   * Event triggered: all members in the conversation (including recaller's other devices) receive `onMessageRecalled`.
   * Note: default 2-min window (configurable up to 7 days); group owner/admin can recall others' messages; all types except CMD supported.
   *
   * @example
   * ```ts
   * const result = await chatManager.recallMessage({
   *   conversationId: 'user_2',
   *   conversationType: 'singleChat',
   *   messageId: 'msg_1',
   * });
   * ```
   *
   * @param params - [zh-CN] 撤回消息参数。 [en-US] Parameters for recalling a message.
   * @returns [zh-CN] 撤回动作结果。 [en-US] Recall action result.
   */
  public async recallMessage(params: RecallMessageParams): Promise<ChatActionResult> {
    this.validateConversationLocator(params);
    this.requireNonEmptyString(params.messageId, 'messageId');
    await this.requireConnectedClient().sendMessageAction(
      {
        kind: 'recall',
        conversationId: params.conversationId,
        conversationType: params.conversationType,
        messageId: params.messageId,
        ext: params.ext,
      },
      (statusCode, reason) => this.buildActionError(statusCode, reason)
    );
    const result = {
      messageId: params.messageId,
      conversationId: params.conversationId,
      conversationType: params.conversationType,
      timestamp: Date.now(),
    } as const;
    this.dispatchEvent(ChatEventName.MESSAGE_RECALLED, result);
    return result;
  }

  /**
   * [zh-CN] 编辑一条消息内容。当前仅支持文本消息和自定义消息。
   *
   * 事件触发：会话中的所有成员（含编辑者的其他设备）会收到 `onMessageUpdated` 事件。
   * 注意：最多编辑 10 次；无时间限制；编辑后消息漫游有效期重新计算；需要在控制台开通。
   *
   * [en-US] Edits the content of a message. Currently only text and custom messages are supported.
   *
   * Event triggered: all members in the conversation (including editor's other devices) receive `onMessageUpdated`.
   * Note: max 10 edits; no time limit; message roaming lifetime resets; requires console activation.
   *
   * @example
   * ```ts
   * const updated = await chatManager.modifyMessage({
   *   conversationId: 'user_2',
   *   conversationType: 'singleChat',
   *   messageId: 'msg_1',
   *   message: {
   *     type: 'text',
   *     body: { content: 'updated text' },
   *     ext: {},
   *   },
   * });
   * ```
   *
   * @param params - [zh-CN] 编辑消息参数。 [en-US] Parameters for editing a message.
   * @returns [zh-CN] 编辑后的消息对象。 [en-US] Edited message object.
   */
  public async modifyMessage(params: UpdateMessageParams): Promise<Message> {
    this.validateConversationLocator(params);
    this.requireNonEmptyString(params.messageId, 'messageId');
    if (params.message.type !== 'text' && params.message.type !== 'custom') {
      throw new ValidationError('only text and custom messages are editable', {
        code: ERROR_CODES.OPERATION_UNSUPPORTED,
      });
    }
    await this.requireConnectedClient().sendMessageAction(
      {
        kind: 'update',
        conversationId: params.conversationId,
        conversationType: params.conversationType,
        messageId: params.messageId,
        body: params.message.body,
        messageType: params.message.type,
        ext: params.message.ext,
      },
      (statusCode, reason) => this.buildActionError(statusCode, reason)
    );
    const timestamp = Date.now();
    const currentUserId = this.getCurrentUserIdOrThrow();
    const modifiedInfo = {
      operatorId: currentUserId,
      operationCount: 1,
      operationTime: timestamp,
    };
    const updated: Message = {
      msgServerId: params.messageId,
      msgLocalId: '',
      from: currentUserId,
      to: params.conversationId,
      sender: { userId: currentUserId },
      conversationId: params.conversationId,
      conversationType: params.conversationType,
      type: params.message.type,
      status: 'sent',
      ext: params.message.ext,
      timestamp,
      body: params.message.body,
      direct: 'SEND',
      modifiedInfo,
    };
    this.dispatchEvent(ChatEventName.MESSAGE_UPDATED, {
      messageId: params.messageId,
      conversationId: params.conversationId,
      conversationType: params.conversationType,
      message: {
        type: updated.type,
        body: updated.body,
        ext: updated.ext,
        modifiedInfo: updated.modifiedInfo,
      },
      timestamp: updated.timestamp,
    });
    return updated;
  }

  /**
   * [zh-CN] 从服务端获取历史消息。
   * [en-US] Fetches history messages from the server.
   *
   * @example
   * ```ts
   * const page = await chatManager.getHistoryMessages({
   *   conversationId: 'group_1',
   *   conversationType: 'groupChat',
   *   pageSize: 20,
   *   searchDirection: 'up',
   * });
   * ```
   *
   * @param params - [zh-CN] 历史消息查询参数。 [en-US] History-message query parameters.
   * @returns [zh-CN] 历史消息分页结果。 [en-US] Paginated history-message result.
   */
  public async getHistoryMessages(params: GetHistoryMessagesParams): Promise<MessageHistoryPage> {
    this.validateConversationLocator(params);
    if (
      params.pageSize !== undefined &&
      (!Number.isInteger(params.pageSize) || params.pageSize <= 0)
    ) {
      throw this.buildValidationError('pageSize must be a positive integer', 'pageSize');
    }
    const context = this.getRestContextOrThrow();
    return this.executeRestOperation(() =>
      requestGetHistoryMessages(this.getRestClient(context), context, params, payload =>
        this.getClientOrThrow().decodeServerMessageMeta(payload)
      )
    );
  }

  /**
   * [zh-CN] 服务端消息搜索，根据关键词和过滤条件搜索历史消息。需要在 Console 开通 Message Search 服务。
   * [en-US] Server-side message search by keywords and filters. Requires enabling Message Search in Console.
   *
   * @example
   * ```ts
   * const result = await chatManager.searchMessages({
   *   option: { keywordList: ['hello'] },
   *   pageNum: 1,
   *   pageSize: 20,
   * });
   * ```
   *
   * @param params - [zh-CN] 搜索参数。 [en-US] Search parameters.
   * @returns [zh-CN] 搜索结果。 [en-US] Search result.
   */
  public async searchMessages(params: SearchMessagesParams): Promise<SearchMessagesResult> {
    const validated = Validator.validateOrThrow(searchMessagesSchema, params);
    const context = this.getRestContextOrThrow();
    return this.executeRestOperation(() =>
      requestSearchMessages(this.getRestClient(context), context, validated)
    );
  }

  /**
   * [zh-CN] 下载消息附件，适用于图片、语音、视频和文件等附件消息。
   * [en-US] Downloads a message attachment, such as image, voice, video, or file content.
   *
   * @example
   * ```ts
   * const attachment = await chatManager.downloadAttachment({ message });
   * ```
   *
   * @param params - [zh-CN] 附件下载参数。 [en-US] Parameters for downloading an attachment.
   * @returns [zh-CN] 附件下载结果。 [en-US] Attachment download result.
   */
  public async downloadAttachment(
    params: DownloadAttachmentParams
  ): Promise<MessageAttachmentDownloadResult> {
    return this.getClientOrThrow().downloadAttachment(params.message);
  }

  /**
   * [zh-CN] 下载并解析合并消息内容，返回合并消息中的子消息列表。
   * [en-US] Downloads and parses a combine message, returning the child messages inside it.
   *
   * @example
   * ```ts
   * const messages = await chatManager.downloadAndParseCombineMessage({ message: combineMessage });
   *
   * const messagesFromBody = await chatManager.downloadAndParseCombineMessage({
   *   url: combineMessage.body.url,
   *   secret: combineMessage.body.secret,
   * });
   * ```
   *
   * @param params - [zh-CN] 合并消息解析参数；可传完整合并消息，也可传合并消息体中的最小下载参数。 [en-US] Parameters for parsing a combine message; pass either the full combine message or the minimal download parameters from the combine message body.
   * @returns [zh-CN] 合并消息中的子消息列表。 [en-US] Child messages inside the combine message.
   */
  public async downloadAndParseCombineMessage(
    params: DownloadCombineMessageInput
  ): Promise<ReadonlyArray<Message>> {
    const client = this.getClientOrThrow() as unknown as ChatClientCombineMessageInternal;
    return client.downloadAndParseCombinePayload(this.resolveDownloadCombineMessageParams(params));
  }

  /**
   * [zh-CN] 删除服务端历史消息，可按消息 ID 列表或时间戳删除。
   * [en-US] Removes server-side history messages by message IDs or by timestamp.
   *
   * @example
   * ```ts
   * await chatManager.removeHistoryMessages({
   *   conversationId: 'user_2',
   *   conversationType: 'singleChat',
   *   messageIds: ['msg_1'],
   * });
   * ```
   *
   * @param params - [zh-CN] 删除历史消息参数。 [en-US] Parameters for removing history messages.
   * @returns [zh-CN] 删除完成后 resolve。 [en-US] Resolves after the messages are removed.
   */
  public async removeHistoryMessages(params: RemoveHistoryMessagesParams): Promise<void> {
    this.validateConversationLocator(params);
    if (!params.messageIds && !params.beforeTimestamp) {
      throw this.buildValidationError(
        'messageIds or beforeTimestamp is required',
        'removeHistoryMessages'
      );
    }
    if (params.messageIds && params.messageIds.length === 0) {
      throw this.buildValidationError('messageIds cannot be empty', 'messageIds');
    }
    if (
      params.beforeTimestamp !== undefined &&
      (!Number.isInteger(params.beforeTimestamp) || params.beforeTimestamp <= 0)
    ) {
      throw this.buildValidationError(
        'beforeTimestamp must be a positive integer',
        'beforeTimestamp'
      );
    }
    const context = this.getRestContextOrThrow();
    await this.executeRestOperation(() =>
      requestRemoveHistoryMessages(this.getRestClient(context), context, params)
    );
  }

  /**
   * [zh-CN] 获取指定群消息的已读成员列表。
   * [en-US] Gets the list of users who have read a specified group message.
   *
   * @example
   * ```ts
   * const page = await chatManager.getGroupMessageReadUsers({
   *   groupId: 'group_1',
   *   messageId: 'msg_1',
   *   pageSize: 20,
   * });
   * ```
   *
   * @param params - [zh-CN] 群消息已读成员查询参数。 [en-US] Parameters for querying group-message read users.
   * @returns [zh-CN] 群消息已读成员分页结果。 [en-US] Paginated result of group-message read users.
   */
  public async getGroupMessageReadUsers(
    params: GroupMessageReadUsersParams
  ): Promise<GroupMessageReadUsersResult> {
    this.requireNonEmptyString(params.groupId, 'groupId');
    this.requireNonEmptyString(params.messageId, 'messageId');
    if (
      params.pageSize !== undefined &&
      (!Number.isInteger(params.pageSize) || params.pageSize <= 0)
    ) {
      throw this.buildValidationError('pageSize must be a positive integer', 'pageSize');
    }
    const context = this.getRestContextOrThrow();
    return this.executeRestOperation(() =>
      requestGetGroupMessageReadUsers(this.getRestClient(context), context, params)
    );
  }

  /**
   * [zh-CN] 为消息添加 Reaction。
   *
   * 事件触发：会话中的所有成员会收到 `onReactionChanged` 事件。
   * 注意：仅支持单聊和群聊，不支持聊天室；每个用户对同一消息的同一 Reaction 只能添加一次。
   *
   * [en-US] Adds a reaction to a message.
   *
   * Event triggered: all members in the conversation receive `onReactionChanged`.
   * Note: only single/group chat supported (not chatroom); each user can add the same reaction only once per message.
   *
   * @example
   * ```ts
   * await chatManager.addReaction({
   *   messageId: 'msg_1',
   *   reaction: '👍',
   * });
   * ```
   *
   * @param params - [zh-CN] 添加 Reaction 参数。 [en-US] Parameters for adding a reaction.
   * @returns [zh-CN] 添加完成后 resolve。 [en-US] Resolves after the reaction is added.
   */
  public async addReaction(params: ReactionOperationParams): Promise<void> {
    this.validateReactionParams(params);
    const context = this.getRestContextOrThrow();
    await this.executeRestOperation(() =>
      requestAddReaction(this.getRestClient(context), context, params)
    );
    this.dispatchEvent(ChatEventName.REACTION_CHANGED, {
      messageId: params.messageId,
      reaction: params.reaction,
      operation: 'add',
    });
  }

  /**
   * [zh-CN] 删除当前用户在消息上添加的 Reaction。
   *
   * 事件触发：会话中的所有成员会收到 `onReactionChanged` 事件。
   *
   * [en-US] Removes the current user's reaction from a message.
   *
   * Event triggered: all members in the conversation receive `onReactionChanged`.
   *
   * @example
   * ```ts
   * await chatManager.removeReaction({
   *   messageId: 'msg_1',
   *   reaction: '👍',
   * });
   * ```
   *
   * @param params - [zh-CN] 删除 Reaction 参数。 [en-US] Parameters for removing a reaction.
   * @returns [zh-CN] 删除完成后 resolve。 [en-US] Resolves after the reaction is removed.
   */
  public async removeReaction(params: ReactionOperationParams): Promise<void> {
    this.validateReactionParams(params);
    const context = this.getRestContextOrThrow();
    await this.executeRestOperation(() =>
      requestRemoveReaction(this.getRestClient(context), context, params)
    );
    this.dispatchEvent(ChatEventName.REACTION_CHANGED, {
      messageId: params.messageId,
      reaction: params.reaction,
      operation: 'remove',
    });
  }

  /**
   * [zh-CN] 获取一条或多条消息的 Reaction 汇总列表。
   * [en-US] Gets reaction summaries for one or more messages.
   *
   * @example
   * ```ts
   * const list = await chatManager.getReactionList({
   *   messageId: ['msg_1', 'msg_2'],
   *   conversationType: 'groupChat',
   *   groupId: 'group_1',
   * });
   * ```
   *
   * @param params - [zh-CN] Reaction 汇总查询参数。 [en-US] Parameters for querying reaction summaries.
   * @returns [zh-CN] 消息 Reaction 汇总列表。 [en-US] Message reaction summary list.
   */
  public async getReactionList(
    params: GetReactionListParams
  ): Promise<ReadonlyArray<MessageReactionListItem>> {
    if (!params.messageId || (Array.isArray(params.messageId) && params.messageId.length === 0)) {
      throw this.buildValidationError('messageId is required', 'messageId');
    }
    if (params.conversationType === 'groupChat') {
      this.requireNonEmptyString(params.groupId ?? '', 'groupId');
    }
    const context = this.getRestContextOrThrow();
    return this.executeRestOperation(() =>
      requestGetReactionList(this.getRestClient(context), context, params)
    );
  }

  /**
   * [zh-CN] 获取指定消息 Reaction 的用户明细。
   * [en-US] Gets user details for a specified message reaction.
   *
   * @example
   * ```ts
   * const page = await chatManager.getReactionDetail({
   *   messageId: 'msg_1',
   *   reaction: '👍',
   *   pageSize: 20,
   * });
   * ```
   *
   * @param params - [zh-CN] Reaction 详情查询参数。 [en-US] Parameters for querying reaction details.
   * @returns [zh-CN] Reaction 用户明细分页结果。 [en-US] Paginated reaction user detail result.
   */
  public async getReactionDetail(
    params: GetReactionDetailParams
  ): Promise<MessageReactionDetailPage> {
    this.validateReactionParams(params);
    if (
      params.pageSize !== undefined &&
      (!Number.isInteger(params.pageSize) || params.pageSize <= 0)
    ) {
      throw this.buildValidationError('pageSize must be a positive integer', 'pageSize');
    }
    const context = this.getRestContextOrThrow();
    return this.executeRestOperation(() =>
      requestGetReactionDetail(this.getRestClient(context), context, params)
    );
  }

  /**
   * [zh-CN] 获取翻译服务支持的语言列表。
   * [en-US] Gets the list of languages supported by the translation service.
   *
   * @example
   * ```ts
   * const languages = await chatManager.getSupportedTranslationLanguages();
   * ```
   *
   * @returns [zh-CN] 翻译支持语言列表。 [en-US] Supported translation language list.
   */
  public async getSupportedTranslationLanguages(): Promise<ReadonlyArray<TranslationLanguage>> {
    const context = this.getRestContextOrThrow();
    return this.executeRestOperation(() =>
      requestGetSupportedTranslationLanguages(this.getRestClient(context), context)
    );
  }

  /**
   * [zh-CN] 翻译文本消息内容到一个或多个目标语言。
   * [en-US] Translates a text message into one or more target languages.
   *
   * @example
   * ```ts
   * const result = await chatManager.translateMessage({
   *   message,
   *   targetLanguages: ['en'],
   * });
   * ```
   *
   * @param params - [zh-CN] 消息翻译参数。 [en-US] Parameters for translating a message.
   * @returns [zh-CN] 消息翻译结果。 [en-US] Message translation result.
   */
  public async translateMessage(params: TranslateMessageParams): Promise<MessageTranslationResult> {
    if (params.message.type !== 'text') {
      throw new ValidationError('only text messages can be translated', {
        code: ERROR_CODES.TRANSLATE_PARAM_INVALID,
      });
    }
    const textBody = params.message.body as Message['body'] & { content: string };
    const text = textBody.content.trim();
    if (text.length === 0) {
      throw new ValidationError('message text is required', {
        code: ERROR_CODES.TRANSLATE_PARAM_INVALID,
      });
    }
    if (!Array.isArray(params.targetLanguages) || params.targetLanguages.length === 0) {
      throw new ValidationError('targetLanguages is required', {
        code: ERROR_CODES.TRANSLATE_PARAM_INVALID,
      });
    }
    if (
      params.targetLanguages.some(
        language => typeof language !== 'string' || language.trim().length === 0
      )
    ) {
      throw new ValidationError('targetLanguages contains invalid language code', {
        code: ERROR_CODES.TRANSLATE_PARAM_INVALID,
      });
    }
    const context = this.getRestContextOrThrow();
    return this.executeRestOperation(() =>
      requestTranslateMessage(this.getRestClient(context), context, {
        text,
        targetLanguages: params.targetLanguages,
      })
    );
  }

  /**
   * [zh-CN] 将已发送或已接收的语音消息体转为文字。
   * [en-US] Converts the body of a sent or received voice message to text.
   *
   * @example
   * ```ts
   * const result = await chatManager.voiceMessageToText(voiceMessage.body, {
   *   format: 'amr',
   * });
   * ```
   *
   * @param voiceMessageBody - [zh-CN] 语音消息体。 [en-US] Voice message body.
   * @param voiceParams - [zh-CN] 语音识别参数。 [en-US] Voice recognition parameters.
   * @returns [zh-CN] 语音转文字结果。 [en-US] Voice-to-text result.
   */
  public async voiceMessageToText(
    voiceMessageBody: VoiceMessageBody,
    voiceParams?: VoiceParams
  ): Promise<VoiceToTextResult> {
    validateVoiceMessageSource(voiceMessageBody, voiceParams);
    const context = this.getRestContextOrThrow();
    return this.executeRestOperation(() =>
      requestVoiceMessageToText(this.getRestClient(context), context, voiceMessageBody, voiceParams)
    );
  }

  /**
   * [zh-CN] 上传本地语音文件并转换为文字。
   * [en-US] Uploads a local voice file and converts it to text.
   *
   * @example
   * ```ts
   * const result = await chatManager.voiceFileToText(file, {
   *   format: 'amr',
   * });
   * ```
   *
   * @param file - [zh-CN] 本地语音文件。 [en-US] Local voice file.
   * @param voiceParams - [zh-CN] 语音识别参数。 [en-US] Voice recognition parameters.
   * @returns [zh-CN] 语音转文字结果。 [en-US] Voice-to-text result.
   */
  public async voiceFileToText(
    file: VoiceSourceFile,
    voiceParams?: VoiceParams
  ): Promise<VoiceToTextResult> {
    validateVoiceSourceFile(file, voiceParams);
    const context = this.getRestContextOrThrow();
    const uploadAdapter = this.getClientOrThrow().getUploadAdapter();
    if (!uploadAdapter) {
      throw new SDKError(
        'Upload capability is missing for current platform',
        ERROR_CODES.UPLOAD_REQUIRED_FIELD_MISSING
      );
    }
    return this.executeRestOperation(() =>
      requestVoiceFileToText(uploadAdapter, context, file, voiceParams)
    );
  }

  private dispatchEvent<TName extends keyof import('../types/event-system').EventPayloadMap>(
    eventName: TName,
    payload: import('../types/event-system').EventPayloadMap[TName]
  ): void {
    this.getEventContextOrThrow().dispatch?.(eventName, payload);
  }

  private validateConversationLocator(params: {
    conversationId: string;
    conversationType: string;
  }): void {
    this.requireNonEmptyString(params.conversationId, 'conversationId');
    if (
      params.conversationType !== 'singleChat' &&
      params.conversationType !== 'groupChat' &&
      params.conversationType !== 'chatRoom'
    ) {
      throw this.buildValidationError('conversationType is invalid', 'conversationType');
    }
  }

  private validateReadAckMessage(message: Message): void {
    if (!message || typeof message !== 'object') {
      throw this.buildValidationError('message is required', 'message');
    }
    this.requireNonEmptyString(message.msgServerId, 'message.msgServerId');
    this.requireNonEmptyString(message.conversationId, 'message.conversationId');
    if (message.direct === 'SEND') {
      throw this.buildValidationError('only received messages can send read ack', 'message.direct');
    }
    if (message.conversationType !== 'singleChat' && message.conversationType !== 'groupChat') {
      throw this.buildValidationError(
        'message conversation type is invalid',
        'message.conversationType'
      );
    }
  }

  private validateReadAckMessages(
    params: MarkMessageReadParams
  ): ReadonlyArray<MarkMessageReadItem> {
    if (!params || typeof params !== 'object') {
      throw this.buildValidationError('messages is required', 'messages');
    }
    const candidateMessages: unknown = params.messages;
    if (!Array.isArray(candidateMessages)) {
      throw this.buildValidationError('messages is required', 'messages');
    }
    const messages = candidateMessages as ReadonlyArray<MarkMessageReadItem>;
    if (messages.length === 0) {
      throw this.buildValidationError('messages cannot be empty', 'messages');
    }

    const firstItem = messages[0];
    if (!firstItem) {
      throw this.buildValidationError('messages cannot be empty', 'messages');
    }
    this.validateReadAckMessage(firstItem.message);
    const { conversationId, conversationType } = firstItem.message;

    messages.forEach((item, index) => {
      this.validateReadAckMessage(item.message);
      if (item.message.conversationId !== conversationId) {
        throw this.buildValidationError(
          'all messages must belong to the same conversation',
          `messages.${index}.message.conversationId`
        );
      }
      if (item.message.conversationType !== conversationType) {
        throw this.buildValidationError(
          'all messages must have the same conversation type',
          `messages.${index}.message.conversationType`
        );
      }
      if (item.ackContent !== undefined && item.message.conversationType !== 'groupChat') {
        throw this.buildValidationError(
          'ackContent only applies to group messages',
          `messages.${index}.ackContent`
        );
      }
    });

    return messages;
  }

  private resolveDownloadCombineMessageParams(
    params: DownloadCombineMessageInput
  ): DownloadCombineMessageParams {
    if ('message' in params) {
      if (params.message.type !== 'combine') {
        throw new ValidationError('message must be a combine message', {
          code: ERROR_CODES.VALIDATION_INVALID_FORMAT,
        });
      }
      const combineBody = params.message.body as Message['body'] & {
        url?: string;
        secret?: string;
      };
      return {
        url: combineBody.url ?? '',
        secret: combineBody.secret,
        timeoutMs: params.timeoutMs,
        maxItems: params.maxItems,
      };
    }
    return {
      url: params.url,
      secret: params.secret,
      timeoutMs: params.timeoutMs,
      maxItems: params.maxItems,
    };
  }

  private validateReactionParams(params: ReactionOperationParams): void {
    this.requireNonEmptyString(params.messageId, 'messageId');
    this.requireNonEmptyString(params.reaction, 'reaction');
  }

  private buildActionError(statusCode: number, reason?: string): Error {
    if (statusCode === ERROR_CODES.AUTH_NOT_LOGIN || statusCode === ERROR_CODES.AUTH_UNAUTHORIZED) {
      return new AuthenticationError(reason ?? 'authentication failed', {
        code: statusCode,
      });
    }
    if (
      statusCode === ERROR_CODES.CONNECTION_WEBSOCKET_ERROR ||
      statusCode === ERROR_CODES.CONNECTION_TIMEOUT
    ) {
      return new ConnectionError(reason ?? 'connection unavailable', {
        code: statusCode,
      });
    }
    if (
      statusCode === 107 ||
      statusCode === 110 ||
      statusCode === 205 ||
      statusCode === 500 ||
      statusCode === ERROR_CODES.VALIDATION_REQUIRED ||
      statusCode === ERROR_CODES.VALIDATION_INVALID_FORMAT
    ) {
      return new ValidationError(reason ?? 'invalid parameter', {
        code: statusCode,
      });
    }
    if (statusCode === ERROR_CODES.MESSAGE_RECALL_TIME_LIMIT) {
      return new SDKError(reason ?? 'message recall time limit reached', statusCode);
    }
    if (statusCode === ERROR_CODES.MESSAGE_EDIT_FAILED) {
      return new SDKError(reason ?? 'message update failed', statusCode);
    }
    if (statusCode === ERROR_CODES.OPERATION_UNSUPPORTED) {
      return new ValidationError(reason ?? 'operation unsupported', {
        code: statusCode,
      });
    }
    return new SDKError(reason ?? 'message action failed', statusCode);
  }

  private requireNonEmptyString(value: string, field: string): void {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw this.buildValidationError(`${field} is required`, field);
    }
  }

  private buildValidationError(message: string, path: string): ValidationError {
    return new ValidationError(message, {
      code: ERROR_CODES.VALIDATION_INVALID_FORMAT,
      details: {
        fields: [
          {
            path,
            message,
            rule: 'required',
          },
        ],
      },
    });
  }

  private getEventContextOrThrow(): ManagerEventContext {
    if (!this.eventContext) {
      throw new ValidationError('ChatManager is not bound to event context', {
        code: ERROR_CODES.VALIDATION_REQUIRED,
      });
    }
    return this.eventContext;
  }

  private getClientOrThrow(): ChatClient {
    if (!this.client) {
      throw new ValidationError('ChatManager is not bound to client', {
        code: ERROR_CODES.VALIDATION_REQUIRED,
      });
    }
    return this.client;
  }

  private getRestContextOrThrow(): RestContext {
    return this.getClientOrThrow().getRestContext();
  }

  private getRestClient(context: RestContext): RestClient {
    if (
      this.restClient &&
      this.restBaseUrl === context.restBaseUrl &&
      this.restToken === context.token
    ) {
      return this.restClient;
    }
    this.restClient = new RestClient(context.restBaseUrl, { errorMap: CHAT_REST_ERROR_MAP });
    this.restClient.setAuthToken(context.token);
    this.restBaseUrl = context.restBaseUrl;
    this.restToken = context.token;
    return this.restClient;
  }

  private requireConnectedClient(): ChatClient {
    const client = this.getClientOrThrow();
    if (client.getConnectionState() !== ConnectionStatus.CONNECTED) {
      throw new ConnectionError('client is not connected', {
        code: ERROR_CODES.CONNECTION_WEBSOCKET_ERROR,
      });
    }
    return client;
  }

  private getCurrentUserIdOrThrow(): string {
    const userId = this.getClientOrThrow().getCurrentUserId();
    if (!userId) {
      throw new AuthenticationError('user is not logged in', {
        code: ERROR_CODES.AUTH_NOT_LOGIN,
      });
    }
    return userId;
  }

  private buildMessageSenderOrThrow(): Sender {
    const client = this.getClientOrThrow();
    const userId = this.getCurrentUserIdOrThrow();
    const cachedUserInfo = client.getCacheManager()?.getUserInfoSummaries([userId], false)[0];
    return {
      userId,
      nickname: cachedUserInfo?.nickname,
      avatarUrl: cachedUserInfo?.avatarUrl,
    };
  }

  private async executeRestOperation<TResult>(executor: () => Promise<TResult>): Promise<TResult> {
    try {
      return await executor();
    } catch (error) {
      throw this.mapRestError(error);
    }
  }

  private mapRestError(error: unknown): Error {
    if (
      error instanceof ValidationError ||
      error instanceof AuthenticationError ||
      error instanceof ConnectionError ||
      error instanceof NetworkError
    ) {
      return error;
    }

    if (error instanceof RestTransportError) {
      return new NetworkError(error.message, {
        code: error.code,
        details: error.details,
      });
    }

    if (error instanceof RestBusinessError) {
      switch (error.code) {
        case 107:
        case 110:
        case 205:
        case ERROR_CODES.VALIDATION_REQUIRED:
        case ERROR_CODES.VALIDATION_INVALID_FORMAT:
        case 112:
        case 500:
        case ERROR_CODES.MESSAGE_INCLUDE_ILLEGAL_CONTENT:
        case ERROR_CODES.GROUP_INVALID_ID:
        case ERROR_CODES.TRANSLATE_PARAM_INVALID:
          return new ValidationError(error.message, {
            code: error.code,
            details: error.details,
          });
        case ERROR_CODES.OPERATION_UNSUPPORTED:
          return new ValidationError(error.message, {
            code: error.code,
            details: error.details,
          });
        case ERROR_CODES.AUTH_NOT_LOGIN:
        case ERROR_CODES.AUTH_UNAUTHORIZED:
        case ERROR_CODES.AUTH_FORBIDDEN:
        case ERROR_CODES.AUTH_TOKEN_EXPIRED:
          return new AuthenticationError(error.message, {
            code: error.code,
            details: error.details,
          });
        case ERROR_CODES.CONNECTION_WEBSOCKET_ERROR:
        case ERROR_CODES.CONNECTION_TIMEOUT:
          return new ConnectionError(error.message, {
            code: error.code,
            details: error.details,
          });
        default:
          return error;
      }
    }

    if (!(error instanceof SDKError)) {
      return new SDKError(String(error), ERROR_CODES.UNKNOWN);
    }

    return error;
  }
}
