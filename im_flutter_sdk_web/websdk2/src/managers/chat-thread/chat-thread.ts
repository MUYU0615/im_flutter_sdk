import type { ChatThreadManager } from '../chat-thread-manager';
import type {
  ChatThreadDetail,
  ChatThreadMemberListResult,
  RemoveChatThreadMemberParams,
} from '../../types/chat-thread';

/**
 * [zh-CN] 绑定固定 `chatThreadId` 的单子区上下文对象。
 * [en-US] Single chat-thread context object bound to a fixed `chatThreadId`.
 */
export class ChatThread {
  public readonly chatThreadId: string;

  private readonly manager: ChatThreadManager;

  public constructor(chatThreadId: string, manager: ChatThreadManager) {
    this.chatThreadId = chatThreadId;
    this.manager = manager;
  }

  /**
   * [zh-CN] 获取当前子区详情。
   * [en-US] Gets details of the current chat thread.
   *
   * @example [zh-CN] 调用示例（获取详情） [en-US] Usage example (get detail)
   * ```ts
   * const thread = client.chatThreadManager.getChatThread('thread-1');
   * const detail = await thread.getInfo();
   * ```
   *
   * @param this - [zh-CN] 当前 `ChatThread` 对象已绑定固定 `chatThreadId`，无需额外参数。 [en-US] The current `ChatThread` object is bound to a fixed `chatThreadId`; no extra parameter is required.
   * @operation getChatThreadInfo
   * @returns {Promise<ChatThreadDetail>} [zh-CN] 返回子区详情。 [en-US] Returns chat thread details.
   */
  public getInfo(): Promise<ChatThreadDetail> {
    return this.manager.getChatThreadInfo({
      chatThreadId: this.chatThreadId,
    });
  }

  /**
   * [zh-CN] 刷新并返回当前子区详情，等价于 `getInfo()`。
   * [en-US] Refreshes and returns the current chat thread detail; equivalent to `getInfo()`.
   *
   * @example [zh-CN] 调用示例（刷新详情） [en-US] Usage example (refresh detail)
   * ```ts
   * const detail = await thread.refresh();
   * ```
   *
   * @param this - [zh-CN] 当前 `ChatThread` 对象已绑定固定 `chatThreadId`，无需额外参数。 [en-US] The current `ChatThread` object is bound to a fixed `chatThreadId`; no extra parameter is required.
   * @operation getChatThreadInfo
   * @returns {Promise<ChatThreadDetail>} [zh-CN] 返回最新子区详情。 [en-US] Returns the latest chat thread details.
   */
  public refresh(): Promise<ChatThreadDetail> {
    return this.getInfo();
  }

  /**
   * [zh-CN] 加入当前子区。
   * [en-US] Joins the current chat thread.
   *
   * @example [zh-CN] 调用示例（加入子区） [en-US] Usage example (join thread)
   * ```ts
   * await thread.join();
   * ```
   *
   * @param this - [zh-CN] 当前 `ChatThread` 对象已绑定固定 `chatThreadId`，无需额外参数。 [en-US] The current `ChatThread` object is bound to a fixed `chatThreadId`; no extra parameter is required.
   * @operation joinChatThread
   * @returns {Promise<void>} [zh-CN] 成功时无返回业务数据。 [en-US] Resolves with no business payload on success.
   */
  public join(): Promise<void> {
    return this.manager.joinChatThread({
      chatThreadId: this.chatThreadId,
    });
  }

  /**
   * [zh-CN] 退出当前子区。
   * [en-US] Leaves the current chat thread.
   *
   * @example [zh-CN] 调用示例（退出子区） [en-US] Usage example (leave thread)
   * ```ts
   * await thread.leave();
   * ```
   *
   * @param this - [zh-CN] 当前 `ChatThread` 对象已绑定固定 `chatThreadId`，无需额外参数。 [en-US] The current `ChatThread` object is bound to a fixed `chatThreadId`; no extra parameter is required.
   * @operation leaveChatThread
   * @returns {Promise<void>} [zh-CN] 成功时无返回业务数据。 [en-US] Resolves with no business payload on success.
   */
  public leave(): Promise<void> {
    return this.manager.leaveChatThread({
      chatThreadId: this.chatThreadId,
    });
  }

  /**
   * [zh-CN] 解散当前子区。
   * [en-US] Destroys the current chat thread.
   *
   * @example [zh-CN] 调用示例（解散子区） [en-US] Usage example (destroy thread)
   * ```ts
   * await thread.destroy();
   * ```
   *
   * @param this - [zh-CN] 当前 `ChatThread` 对象已绑定固定 `chatThreadId`，无需额外参数。 [en-US] The current `ChatThread` object is bound to a fixed `chatThreadId`; no extra parameter is required.
   * @operation destroyChatThread
   * @returns {Promise<void>} [zh-CN] 成功时无返回业务数据。 [en-US] Resolves with no business payload on success.
   */
  public destroy(): Promise<void> {
    return this.manager.destroyChatThread({
      chatThreadId: this.chatThreadId,
    });
  }

  /**
   * [zh-CN] 更新当前子区名称。
   * [en-US] Updates the current chat thread name.
   *
   * @example [zh-CN] 调用示例（更新名称） [en-US] Usage example (update name)
   * ```ts
   * await thread.updateName({ name: 'New topic' });
   * ```
   *
   * @param input - [zh-CN] 更新输入，`name` 为新子区名称。 [en-US] Update input; `name` is the new chat thread name.
   * @operation updateChatThreadName
   * @returns {Promise<void>} [zh-CN] 成功时无返回业务数据。 [en-US] Resolves with no business payload on success.
   */
  public updateName(input: { readonly name: string }): Promise<void> {
    return this.manager.updateChatThreadName({
      chatThreadId: this.chatThreadId,
      name: input.name,
    });
  }

  /**
   * [zh-CN] 获取当前子区成员列表。
   * [en-US] Lists members of the current chat thread.
   *
   * @example [zh-CN] 调用示例（查询成员） [en-US] Usage example (list members)
   * ```ts
   * const page = await thread.getMemberList({ pageSize: 20 });
   * ```
   *
   * @param query - [zh-CN] 游标分页参数。 [en-US] Cursor pagination parameters.
   * @operation getChatThreadMemberList
   * @returns {Promise<ChatThreadMemberListResult>} [zh-CN] 返回成员列表和下一页游标。 [en-US] Returns members and the next cursor.
   */
  public getMemberList(query: {
    readonly pageSize?: number;
    readonly cursor?: string;
  } = {}): Promise<ChatThreadMemberListResult> {
    return this.manager.getChatThreadMemberList({
      chatThreadId: this.chatThreadId,
      ...query,
    });
  }

  /**
   * [zh-CN] 从当前子区移除成员。
   * [en-US] Removes a member from the current chat thread.
   *
   * @example [zh-CN] 调用示例（移除成员） [en-US] Usage example (remove member)
   * ```ts
   * await thread.removeMember({ memberId: 'user-1' });
   * ```
   *
   * @param input - [zh-CN] 移除输入，包含成员 ID。 [en-US] Removal input including the member ID.
   * @operation removeChatThreadMember
   * @returns {Promise<void>} [zh-CN] 成功时无返回业务数据。 [en-US] Resolves with no business payload on success.
   */
  public removeMember(input: Omit<RemoveChatThreadMemberParams, 'chatThreadId'>): Promise<void> {
    return this.manager.removeChatThreadMember({
      chatThreadId: this.chatThreadId,
      memberId: input.memberId,
    });
  }
}
