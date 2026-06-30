# ChatThread 子区 API Review Matrix

生成时间：2026-05-12

来源：[Web SDK2 对外 API Review Matrix](./websdk2-api-review-matrix.md)

移动端对照列先留空：补齐后可在 `差异/Review 结论` 写命名、参数字段、返回结构或语义差异。

## ChatThread 子区

| Web API | Web 参数 | Web 参数字段展开 | Web 返回值 | 移动端 API | 移动端参数 | 移动端返回值 | 差异/Review 结论 | 来源 | 备注 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ChatThreadManager.addEventHandler | id: EventHandlerId, handlers: ChatThreadEventHandlerMap | handlers: onChatThreadChange?: ((event: ChatThreadChangeEvent) => void \| Promise<void>) \| undefined | void |  |  |  |  | src/managers/chat-thread-manager.ts:64 |  |
| ChatThreadManager.removeEventHandler | id: EventHandlerId | - | void |  |  |  |  | src/managers/chat-thread-manager.ts:68 |  |
| ChatThreadManager.getChatThread | chatThreadId: string | - | ChatThread |  |  |  |  | src/managers/chat-thread-manager.ts:72 |  |
| ChatThreadManager.createChatThread | params: CreateChatThreadParams | params: parentId: string; name: string; messageId: string | Promise<CreateChatThreadResult> |  |  |  |  | src/managers/chat-thread-manager.ts:97 |  |
| ChatThreadManager.getChatThreadList | params: GetChatThreadListParams | params: parentId: string; pageSize?: number \| undefined; cursor?: string \| undefined | Promise<ChatThreadListResult> |  |  |  |  | src/managers/chat-thread-manager.ts:104 |  |
| ChatThreadManager.getJoinedChatThreadList | params?: GetJoinedChatThreadListParams | params: parentId?: string \| undefined; pageSize?: number \| undefined; cursor?: string \| undefined | Promise<ChatThreadListResult> |  |  |  |  | src/managers/chat-thread-manager.ts:113 |  |
| ChatThreadManager.getChatThreadInfo | params: GetChatThreadInfoParams | params: chatThreadId: string | Promise<ChatThreadSummary> |  |  |  |  | src/managers/chat-thread-manager.ts:122 |  |
| ChatThreadManager.joinChatThread | params: ChatThreadMutationTarget | params: chatThreadId: string | Promise<void> |  |  |  |  | src/managers/chat-thread-manager.ts:131 |  |
| ChatThreadManager.leaveChatThread | params: ChatThreadMutationTarget | params: chatThreadId: string | Promise<void> |  |  |  |  | src/managers/chat-thread-manager.ts:138 |  |
| ChatThreadManager.destroyChatThread | params: ChatThreadMutationTarget | params: chatThreadId: string | Promise<void> |  |  |  |  | src/managers/chat-thread-manager.ts:145 |  |
| ChatThreadManager.updateChatThreadName | params: UpdateChatThreadNameParams | params: name: string; chatThreadId: string | Promise<void> |  |  |  |  | src/managers/chat-thread-manager.ts:152 |  |
| ChatThreadManager.getChatThreadMemberList | params: GetChatThreadMemberListParams | params: chatThreadId: string; pageSize?: number \| undefined; cursor?: string \| undefined | Promise<ChatThreadMemberListResult> |  |  |  |  | src/managers/chat-thread-manager.ts:159 |  |
| ChatThreadManager.removeChatThreadMember | params: RemoveChatThreadMemberParams | params: memberId: string; chatThreadId: string | Promise<void> |  |  |  |  | src/managers/chat-thread-manager.ts:168 |  |
| ChatThreadManager.getChatThreadLastMessageList | params: GetChatThreadLastMessageListParams | params: chatThreadIds: readonly string[] | Promise<ChatThreadLastMessageListResult> |  |  |  |  | src/managers/chat-thread-manager.ts:175 |  |
| ChatThread.getInfo | - | - | Promise<ChatThreadSummary> |  |  |  |  | src/managers/chat-thread/chat-thread.ts:18 |  |
| ChatThread.refresh | - | - | Promise<ChatThreadSummary> |  |  |  |  | src/managers/chat-thread/chat-thread.ts:24 |  |
| ChatThread.join | - | - | Promise<void> |  |  |  |  | src/managers/chat-thread/chat-thread.ts:28 |  |
| ChatThread.leave | - | - | Promise<void> |  |  |  |  | src/managers/chat-thread/chat-thread.ts:34 |  |
| ChatThread.destroy | - | - | Promise<void> |  |  |  |  | src/managers/chat-thread/chat-thread.ts:40 |  |
| ChatThread.updateName | input: { readonly name: string } | input: name: string | Promise<void> |  |  |  |  | src/managers/chat-thread/chat-thread.ts:46 |  |
| ChatThread.getMemberList | query?: {<br>    readonly pageSize?: number;<br>    readonly cursor?: string;<br>  } | query: pageSize?: number \| undefined; cursor?: string \| undefined | Promise<ChatThreadMemberListResult> |  |  |  |  | src/managers/chat-thread/chat-thread.ts:53 |  |
| ChatThread.removeMember | input: Omit<RemoveChatThreadMemberParams, 'chatThreadId'> | input: memberId: string | Promise<void> |  |  |  |  | src/managers/chat-thread/chat-thread.ts:63 |  |
