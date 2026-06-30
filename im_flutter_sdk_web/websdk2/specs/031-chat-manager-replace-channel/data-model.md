# Data Model: ChatManager 替换 ChannelManager 并补齐消息域能力

## 1) ChatManager

- **描述**: 031 中唯一公开的消息域 manager，负责消息发送、消息动作、消息查询、消息互动状态、翻译举报和消息域事件订阅。
- **关键字段**:
  - `key`: 固定为 `chatManager`
  - `client`: 绑定的 `ChatClient`
  - `eventContext`: manager 级事件注册上下文
- **关键能力**:
  - `sendMessage(message, options?)`
  - `markConversationRead(input)`
  - `sendMessageReadAck(input)`
  - `sendGroupMessageReadAck(input)`
  - `recallMessage(input)`
  - `updateMessage(input)`
  - `getHistoryMessages(query)`
  - `downloadMessageAttachment(input)`
  - `downloadAndParseCombineMessage(input)`
  - `removeHistoryMessages(input)`
  - `getGroupMessageReadUsers(query)`
  - `addReaction(input)`
  - `removeReaction(input)`
  - `getReactionList(query)`
  - `getReactionDetail(query)`
  - `pinMessage(input)`
  - `unpinMessage(input)`
  - `getPinnedMessages(query)`
  - `getSupportedTranslationLanguages()`
  - `translateMessage(input)`
  - `addEventHandler(id, handlers)`
  - `removeEventHandler(id)`
- **约束**:
  - 未绑定 `client` 时，不允许调用任何消息域动作或查询方法
  - 未绑定 `eventContext` 时，不允许注册或移除事件
  - 公开返回不得透传服务端 envelope

## 2) ConversationLocator

- **描述**: 统一表达目标会话的轻量业务定位结构。
- **关键字段**:
  - `conversationId`
  - `conversationType`
- **有效值**:
  - `singleChat`
  - `groupChat`
  - `chatRoom`
- **约束**:
  - 历史消息、会话已读、置顶消息等 API 统一围绕该结构寻址
  - 对外不暴露旧 `queue/isGroup` 风格参数

## 3) MessageActionInput Family

- **描述**: 围绕消息动作的一组公开输入模型。
- **代表性输入**:
  - `MessageReadAckInput`
  - `GroupMessageReadAckInput`
  - `RecallMessageInput`
  - `UpdateMessageInput`
  - `ReactionInput`
  - `PinMessageInput`
- **共性字段**:
  - `messageId`
  - `conversationId` / `groupId`
  - `conversationType`
  - 与动作相关的补充字段，如 `reaction`、`reportType`、`reportReason`
- **约束**:
  - 必须体现业务语义，而不是直接镜像底层协议字段

## 4) MessageHistoryPage

- **描述**: 历史消息分页业务对象。
- **关键字段**:
  - `items`: `ReadonlyArray<Message>`
  - `cursor` 或等价续传标记
  - `hasMore`
- **约束**:
  - 消息项复用统一 `Message`
  - 不对外暴露底层历史消息响应 envelope

## 5) MessageAttachmentDownloadResult

- **描述**: 附件下载后的业务对象。
- **关键字段**:
  - `filename`
  - `mimeType`
  - `size`
  - `data` 或等价下载结果引用
  - `downloadUrl`（如需调试或回显，可选）
- **约束**:
  - 不得泄露底层下载适配器或平台实现细节
  - 需支持浏览器与跨平台抽象差异

## 6) GroupMessageReadUsersResult

- **描述**: 群消息已读业务对象。
- **关键字段**:
  - `messageId`
  - `groupId`
  - `users`
  - `count`
  - `cursor` / `hasMore`（若服务端支持分页）
- **约束**:
  - 返回用户对象应符合现有仓库用户业务语义
  - 不能直接透传服务端原始用户列表包装

## 7) MessageReactionSummary

- **描述**: 某条消息上的单个 Reaction 摘要。
- **关键字段**:
  - `reaction`
  - `count`
  - `isAddedBySelf`
- **约束**:
  - 为前端渲染直接可用
  - 不保留旧工程中仅服务于内部的兼容字段

## 8) MessageReactionDetailPage

- **描述**: 某个 Reaction 的用户明细分页业务对象。
- **关键字段**:
  - `reaction`
  - `users`
  - `cursor`
  - `hasMore`
- **约束**:
  - 用户列表结构需符合当前仓库用户对象规范

## 9) PinnedMessage

- **描述**: 会话中的置顶消息业务对象。
- **关键字段**:
  - `message`: `Message`
  - `pinTime`
  - `operatorId`
- **约束**:
  - 消息项继续使用统一 `Message`
  - 分页查询应基于 `PinnedMessage[]` 输出，而不是直接暴露服务端原始消息结构

## 10) TranslationLanguage

- **描述**: 翻译支持语言业务对象。
- **关键字段**:
  - `code`
  - `name`
  - `nativeName`
- **约束**:
  - 直接适合语言选择器或设置页面使用

## 11) MessageTranslationResult

- **描述**: 消息翻译结果业务对象。
- **关键字段**:
  - `detectedLanguage`
  - `translations`
- **`translations` 子字段**:
  - `text`
  - `to`
- **约束**:
  - 对外表达“翻译消息内容”的业务语义
  - 不暴露翻译服务端 envelope

## 12) ChatManagerEventSurface

- **描述**: `ChatManager` 的对外事件集合。
- **基础事件**:
  - `onMessage`
  - `onCombineMessage`
  - `onStreamMessage`
  - `onMessageStatus`
  - `onConversationUpdate`
- **扩展动作事件**:
  - `onMessageRead`
  - `onConversationRead`
  - `onMessageRecalled`
  - `onMessageUpdated`
  - `onReactionChanged`
  - `onPinnedMessageChanged`
- **注册形式**:
  - `addEventHandler(id, handlers)`
  - `removeEventHandler(id)`
- **约束**:
  - 继续沿用统一事件系统
  - 新增事件 payload 必须是业务对象

## 13) Retained Baseline Types

- **Message**
  - 继续作为统一消息业务对象
  - 本期不改结构
- **Message.channel / ChannelReference**
  - 继续作为消息寻址模型
  - 本期不改字段名和语义
- **ChatClient.sendMessage**
  - 继续保留为 client 级并行入口

## 14) Removed Public APIs

- **移除对象**:
  - `ChannelManager`
  - `Channel`
  - `channelManager.createChannel`
  - `channelManager.getChannel`
  - `channelManager.getChannels`
  - `channel.createXMessage`
  - `channel.sendMessage`
- **约束**:
  - 不提供 deprecated 桥接层
  - demo、导出和文档不得继续使用这些入口

## Relationships

- `ChatManager` 依赖 `ChatClient` 绑定后才能工作
- `ChatManager.sendMessage` 委托 `ChatClient.sendMessage`
- `ConversationLocator` 为会话级 API 提供统一寻址
- `MessageHistoryPage`、`PinnedMessage`、`GroupMessageReadUsersResult`、`MessageReactionDetailPage` 都围绕统一 `Message` 或用户业务对象展开
- `ChatManagerEventSurface` 通过 `eventContext` 接入统一 `EventHub`
- `Message.channel` 继续被发送、上传、协议和历史消息标准化链路消费

## State Notes

### Message Action State

- `message_sent` -> `conversation_read_marked`
- `message_sent` -> `message_read_acked`
- `message_sent` -> `group_message_read_acked`
- `message_sent` -> `message_recalled`
- `message_sent` -> `message_updated`
- `message_sent` -> `reaction_added | reaction_removed`
- `message_sent` -> `message_pinned | message_unpinned`

### Query / Download State

- `history_query_requested` -> `history_page_loaded`
- `attachment_download_requested` -> `attachment_downloaded | attachment_download_failed`
- `combine_download_requested` -> `combine_messages_loaded | combine_parse_failed`

### Event Registration State

- `manager_bound` -> `event_handler_registered`
- `event_handler_registered` -> `event_dispatched`
- `event_handler_registered` -> `event_handler_removed`

## Non-goals in Data Model

- 不在本期引入 `Conversation` 富对象或 conversation 列表模型
- 不在本期为翻译、Reaction、置顶单独定义新的公开 manager
- 不在本期把消息寻址从 `channel` 改名为其他结构
