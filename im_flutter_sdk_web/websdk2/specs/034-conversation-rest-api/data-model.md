# 034 数据模型（Phase 1）

## 1) ConversationPublicType

- **描述**: 对外公开的会话类型 canonical naming。
- **允许值**:
  - `singleChat`
  - `groupChat`
  - `chatRoom`
- **约束**:
  - 所有公开入参与返回值都只能使用该命名
  - `single/group/room` 只允许在 SDK 内部兼容层存在

## 2) ConversationMark

- **描述**: 会话标记槽位。
- **类型**: `0 | 1 | ... | 19`
- **辅助常量**: `CONVERSATION_MARK.MARK_0` 到 `CONVERSATION_MARK.MARK_19`
- **允许范围**:
  - `0` 到 `19`
- **约束**:
  - 保留旧 `websdk` 标记槽位语义
  - 类型层不再接受任意 `number`
  - 去重后保持稳定顺序

## 3) MessageSnippet

- **描述**: 会话摘要中的最后一条消息最小视图。
- **关键字段**:
  - `msgId: string`
  - `type: string`
  - `body: Record<string, unknown>`
  - `timestamp: number`
  - `userInfoUpdateTime?: number`
  - `namecardUpdateTime?: number`
- **约束**:
  - 对外不暴露旧 `meta.payload` 原始包装
  - 仅承诺摘要级字段，不承诺完整 `Message`

## 4) ConversationItem

- **描述**: 会话列表页与 `onConversationListUpdate` 中的单条会话摘要。
- **关键字段**:
  - `conversationId: string`
  - `type: ConversationPublicType`
  - `lastMessage: MessageSnippet | null`
  - `unreadCount: number`
  - `isPinned?: boolean`
  - `pinnedTime?: number`
  - `marks: ReadonlyArray<ConversationMark>`
  - `lastAccess: number`
  - `lastUpdate: number`
- **约束**:
  - `marks` 本期成为稳定字段，即使为空也应可安全读取
  - cache 与公开 DTO 的命名保持一致

## 5) ConversationPage

- **描述**: `getConversationList()`、`getPinnedConversationList()`、`getConversationListByMark()` 的统一分页结果。
- **关键字段**:
  - `items: ReadonlyArray<ConversationItem>`
  - `cursor: string`
- **约束**:
  - 不再对外暴露 `channel_infos`、`session_to`、`session_type`
  - 不臆造额外分页字段

## 6) ConversationIdentifier

- **描述**: 会话定位标识。
- **关键字段**:
  - `conversationId: string`
  - `conversationType: ConversationPublicType`
- **用途**:
  - ChatManager 的 delete / pin / mark / pinned message 等操作的共同定位基线

## 7) DeleteConversationInput

- **描述**: 删除单个会话的输入模型。
- **关键字段**:
  - `conversationId: string`
  - `conversationType: ConversationPublicType`
  - `deleteRoamingMessages?: boolean`
- **校验规则**:
  - `conversationId` 必填
  - `conversationType` 必须是 canonical naming

## 8) SetConversationPinnedInput

- **描述**: 设置或取消会话置顶。
- **关键字段**:
  - `conversationId: string`
  - `conversationType: ConversationPublicType`
  - `pinned: boolean`

## 9) ConversationMarkMutationInput

- **描述**: 增加或移除多个会话标记的统一输入。
- **关键字段**:
  - `conversations: ReadonlyArray<ConversationMarkTarget>`
  - `mark: ConversationMark`
- **校验规则**:
  - `conversations` 必须至少包含 1 个会话
  - 每个会话项必须包含 `conversationId` 与 `conversationType`
  - `mark` 必须在 `0-19`

## 10) ConversationMarkMutationResult

- **描述**: add/remove mark 的批量 mutation 返回。
- **关键字段**:
  - `conversations: ReadonlyArray<ConversationMarkMutationItem>`
  - `mark: ConversationMark`
  - `applied: boolean`
  - `operation: 'addMark' | 'removeMark'`
- **约束**:
  - `applied` 表示所有目标是否均生效
  - 单个目标是否生效以 `ConversationMarkMutationItem.applied` 为准

## 11) ConversationMutationResult

- **描述**: delete / setPinned 等单会话 mutation 的标准化返回。
- **关键字段**:
  - `conversationId: string`
  - `type: ConversationPublicType`
  - `applied: boolean`
  - `operation: 'delete' | 'setPinned'`
- **约束**:
  - 返回 mutation 结果本身，不承诺当前会话列表已经同步更新

## 12) PinnedMessageSummary

- **描述**: 会话内被 pin 的消息摘要。
- **关键字段**:
  - `messageId: string`
  - `conversationId: string`
  - `type: ConversationPublicType`
  - `operatorId?: string`
  - `pinnedAt: number`
  - `message?: MessageSnippet | null`
- **约束**:
  - 是否携带 `message` 取决于 upstream 可确认字段；没有样例时只承诺最小 pin 元数据

## 13) PinnedMessageListResult

- **描述**: `getPinnedMessageList()` 的返回模型。
- **关键字段**:
  - `items: ReadonlyArray<PinnedMessageSummary>`
- **约束**:
  - 不分页
  - 不接收 `messageId`
  - 服务端最多返回 20 条置顶消息

## 14) PinMessageInput

- **描述**: `pinMessage()` / `unpinMessage()` 的定位输入。
- **关键字段**:
  - `conversationId: string`
  - `conversationType: ConversationPublicType`
  - `messageId: string`

## 15) ConversationListUpdateReason

- **描述**: `onConversationListUpdate` 的来源类型。
- **允许值**:
  - `conversation` — 会话列表服务端同步或缓存加载
  - `profile` — 用户资料/群名片变化导致的显示刷新
  - `message` — 新消息触发的会话摘要更新
  - `local` — 本地操作（删除、置顶、标记等）

## 15) ConversationListUpdatePayload

- **描述**: 会话摘要变化事件。
- **关键字段**:
  - `items: ReadonlyArray<ConversationItem>`
  - `reason: ConversationListUpdateReason`
- **约束**:
  - 只表达最新摘要视图与来源，不透传旧 `operation`

## 16) PinnedMessageChangedEventPayload

- **描述**: 会话内消息 pin / unpin 变化事件。
- **关键字段**:
  - `conversationId: string`
  - `type: ConversationPublicType`
  - `messageId: string`
  - `operation: 'pin' | 'unpin'`
  - `operatorId?: string`
  - `timestamp: number`
- **约束**:
  - 单聊 / 群聊的原始差异在 SDK 内部归一化

## 17) ConversationSnapshotModel

- **描述**: SDK 内部当前会话状态模型，用于承接缓存、服务端同步、消息和 notify patch。
- **关键字段**:
  - `conversationId: string`
  - `type: ConversationPublicType`
  - `lastMessage: MessageSnippet | null`
  - `unreadCount: number`
  - `isPinned?: boolean`
  - `pinnedTime?: number`
  - `marks: ReadonlyArray<ConversationMark>`
  - `lastAccess: number`
  - `lastUpdate: number`
- **约束**:
  - 默认与公开 `ConversationItem` 保持近同构
  - 允许内部补充 compare/signature 所需字段，但不应反向泄漏到公开模型

## 18) ConversationCacheRecord

- **描述**: conversation 落盘记录。
- **关键字段**:
  - 同 `ConversationSnapshotModel`
  - `schemaVersion: number`（通过上层 metadata 间接约束）
- **迁移规则**:
  - 读取旧 `single/group/room` 时转为 canonical naming
  - 缺失 `marks` 时回填为空数组
  - 读取到旧 `source: 'server'` 的事件相关残留时只在内存兼容，不反写旧值

## 19) ChatThreadSummary

- **描述**: thread 列表项摘要。
- **关键字段**:
  - `chatThreadId: string`
  - `parentId: string`
  - `name: string`
  - `ownerId?: string`
  - `memberCount?: number`
  - `messageCount?: number`
  - `lastMessage?: MessageSnippet | null`
  - `createdAt?: number`
- **约束**:
  - 不对外暴露 `thread_id`、`groupId`、`affiliations_count` 等旧字段名

## 20) ChatThreadListPage

- **描述**: joined/list 两类 thread 分页结果。
- **关键字段**:
  - `items: ReadonlyArray<ChatThreadSummary>`
  - `cursor?: string`

## 21) CreateChatThreadInput

- **描述**: 创建子区输入。
- **关键字段**:
  - `parentId: string`
  - `name: string`
  - `messageId: string`

## 22) ChatThread

- **描述**: `chatThreadManager.getChatThread(chatThreadId)` 返回的轻量句柄。
- **关键字段**:
  - `chatThreadId: string`
- **关键方法**:
  - `getInfo(): Promise<ChatThreadDetail>`
  - `join(): Promise<void>`
  - `leave(): Promise<void>`
  - `destroy(): Promise<void>`
  - `updateName(input: { name: string }): Promise<void>`
  - `getMemberList(): Promise<ChatThreadMemberListResult>`
  - `removeMember(input: { memberId: string }): Promise<void>`
- **约束**:
  - 仅作为单 thread façade，不承担本地状态主真相

## 23) ChatThreadDetail

- **描述**: 单个 thread 的完整视图。
- **关键字段**:
  - `chatThreadId: string`
  - `parentId: string`
  - `name: string`
  - `ownerId?: string`
  - `memberCount?: number`
  - `messageCount?: number`
  - `createdAt?: number`
  - `lastMessage?: MessageSnippet | null`

## 24) ChatThreadMemberEntry

- **描述**: thread 成员列表条目。
- **关键字段**:
  - `memberId: string`
  - `joinedAt?: number`
- **约束**:
  - 若当前样例不足以对象化为完整 `UserInfo`，则先稳定暴露最小成员身份字段

## 25) ChatThreadMemberListResult

- **描述**: thread 成员列表查询结果。
- **关键字段**:
  - `items: ReadonlyArray<ChatThreadMemberEntry>`
  - `cursor?: string`

## 26) ChatThreadLastMessageListResult

- **描述**: 批量查询多个 thread 最后一条消息的结果。
- **关键字段**:
  - `items: ReadonlyArray<{
      chatThreadId: string;
      lastMessage: MessageSnippet | null;
    }>`

## 27) ChatThreadChangeType

- **描述**: thread 变化类型。
- **允许值**:
  - `created`
  - `updated`
  - `destroyed`
  - `joined`
  - `left`
  - `memberRemoved`

## 28) ChatThreadChangeEvent

- **描述**: `onChatThreadChange` 的 typed payload。
- **关键字段**:
  - `change: ChatThreadChangeType`
  - `chatThreadId: string`
  - `parentId: string`
  - `operatorId?: string`
  - `memberId?: string`
  - `thread?: ChatThreadSummary`
  - `timestamp: number`
- **约束**:
  - 不对外暴露原始 `operation`
  - 通过 `chatThreadManager.addEventHandler()` 的专属 handler map 暴露
