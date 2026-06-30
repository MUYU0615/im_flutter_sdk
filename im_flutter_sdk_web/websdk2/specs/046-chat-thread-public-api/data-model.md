# 046 数据模型（Phase 1）

## 1) ChatThreadManager

- **描述**: ChatThread 公开管理器，负责 Thread REST API 编排、单 Thread facade 创建、事件 handler 注册和 raw notify 到公开事件的归一。
- **公开能力**:
  - `getChatThread(chatThreadId)`
  - `createChatThread(params)`
  - `getChatThreadList(params)`
  - `getJoinedChatThreadList(params?)`
  - `getChatThreadInfo(params)`
  - `joinChatThread(params)`
  - `leaveChatThread(params)`
  - `destroyChatThread(params)`
  - `updateChatThreadName(params)`
  - `getChatThreadMemberList(params)`
  - `removeChatThreadMember(params)`
  - `getChatThreadLastMessageList(params)`
  - `addEventHandler(id, handlers)`
  - `removeEventHandler(id)`
- **约束**:
  - 必须先绑定 `ChatClient` 后才能调用 REST 和事件方法。
  - `getChatThread()` 必须校验空白 `chatThreadId`。
  - 不公开、不派发 `onChatThreadChange`。

## 2) ChatThread

- **描述**: 单个 Thread 的对象化入口，绑定一个 `chatThreadId`。
- **公开字段**:
  - `chatThreadId`
- **公开方法**:
  - `getInfo()`
  - `refresh()`
  - `join()`
  - `leave()`
  - `destroy()`
  - `updateName({ name })`
  - `getMemberList({ pageSize, cursor })`
  - `removeMember({ memberId })`
- **约束**:
  - 不自行持有远端状态真相；所有操作代理到 `ChatThreadManager`。
  - 文档不得示例不存在的 `getDetail()`，除非实现阶段新增并测试该 alias。

## 3) CreateChatThreadParams

- **字段**:
  - `parentId`: 子区所属群组 ID，必填非空字符串。
  - `name`: 子区名称，必填非空字符串。
  - `messageId`: 父消息 ID，必填非空字符串。
- **服务端映射**:
  - `parentId` -> `group_id`
  - `messageId` -> `msg_id`

## 4) CreateChatThreadResult

- **字段**:
  - `chatThreadId`: 新建子区 ID。
- **服务端映射**:
  - `thread_id` / `id` -> `chatThreadId`

## 5) GetChatThreadListParams

- **字段**:
  - `parentId`: 子区所属群组 ID，必填非空字符串。
  - `pageSize`: 每页数量，可选，默认 20，范围 1-50。
  - `cursor`: 游标，可选，默认空字符串。

## 6) GetJoinedChatThreadListParams

- **字段**:
  - `parentId`: 子区所属群组 ID，可选；传入时查询指定群内当前用户已加入子区。
  - `pageSize`: 每页数量，可选，默认 20，范围 1-50。
  - `cursor`: 游标，可选，默认空字符串。

## 7) GetChatThreadInfoParams

- **字段**:
  - `chatThreadId`: 子区 ID，必填非空字符串。
- **约束**:
  - 公开类型应定义在 `src/types/chat-thread.ts` 或从该文件重导出。

## 8) ChatThreadMutationTarget

- **字段**:
  - `chatThreadId`: 子区 ID，必填非空字符串。
- **使用场景**:
  - join
  - leave
  - destroy

## 9) UpdateChatThreadNameParams

- **字段**:
  - `chatThreadId`: 子区 ID，必填非空字符串。
  - `name`: 新子区名称，必填非空字符串。

## 10) GetChatThreadMemberListParams

- **字段**:
  - `chatThreadId`: 子区 ID，必填非空字符串。
  - `pageSize`: 每页数量，可选，默认 20，范围 1-50。
  - `cursor`: 游标，可选，默认空字符串。

## 11) RemoveChatThreadMemberParams

- **字段**:
  - `chatThreadId`: 子区 ID，必填非空字符串。
  - `memberId`: 要移除的成员用户 ID，必填非空字符串。
- **服务端映射**:
  - `memberId` 对应原工程 `username`。

## 12) GetChatThreadLastMessageListParams

- **字段**:
  - `chatThreadIds`: 子区 ID 列表，必填，长度 1-20，每项非空字符串。

## 13) ChatThreadSummary

- **字段**:
  - `chatThreadId`
  - `parentId`
  - `name`
  - `ownerId`
  - `memberCount`
  - `messageCount`
  - `lastMessage`
  - `createdAt`
  - `messageId`
- **约束**:
  - 不透传服务端 `thread_id`、`group_id`、`msgId`、`affiliations_count` 等字段。
  - `lastMessage` 使用 SDK 消息摘要类型。

## 14) ChatThreadListResult

- **字段**:
  - `items`: `ReadonlyArray<ChatThreadSummary>`
  - `cursor`: 下一页游标，空字符串表示无或未知。

## 15) ChatThreadMemberEntry

- **字段**:
  - `memberId`
  - `joinedAt`
- **约束**:
  - 服务端返回字符串成员或对象成员时都归一为 `memberId`。

## 16) ChatThreadMemberListResult

- **字段**:
  - `items`: `ReadonlyArray<ChatThreadMemberEntry>`
  - `cursor`: 下一页游标。

## 17) ChatThreadLastMessageEntry

- **字段**:
  - `chatThreadId`
  - `lastMessage`: 消息摘要或 `null`

## 18) ChatThreadLastMessageListResult

- **字段**:
  - `items`: `ReadonlyArray<ChatThreadLastMessageEntry>`

## 19) ChatThreadBaseEventPayload

- **描述**: 4 个公开事件共享的基础字段。
- **字段**:
  - `chatThreadId`: 子区 ID。
  - `parentId`: 子区所属群组 ID。
  - `operatorId`: 操作者用户 ID，可选。
  - `timestamp`: 事件时间戳。
- **约束**:
  - 公开事件不得使用 `id`、`name`、`operator`、`userName`、`operation` 作为主要业务字段。

## 20) ChatThreadCreatedEventPayload

- **字段**:
  - `chatThreadId`
  - `chatThreadName`
  - `parentId`
  - `messageId`
  - `operatorId`
  - `timestamp`
  - `thread`: `ChatThreadSummary | undefined`
- **接收方**:
  - 子区所属群组所有成员。

## 21) ChatThreadDestroyedEventPayload

- **字段**:
  - `chatThreadId`
  - `parentId`
  - `operatorId`
  - `timestamp`
- **接收方**:
  - 子区所属群组所有成员。

## 22) ChatThreadUpdatedEventPayload

- **触发条件**:
  - 修改子区名称。
  - 子区中添加回复消息。
  - 子区中撤销回复消息。
- **字段**:
  - `chatThreadId`
  - `chatThreadName`
  - `parentId`
  - `messageId`
  - `messageCount`
  - `lastMessage`
  - `operatorId`
  - `timestamp`
  - `thread`: `ChatThreadSummary | undefined`
- **接收方**:
  - 子区所属群组所有成员。

## 23) ChatThreadUserRemovedEventPayload

- **触发条件**:
  - 当前登录用户被群主或群管理员移出子区。
- **字段**:
  - `chatThreadId`
  - `parentId`
  - `memberId`: 被移出的当前登录用户 ID。
  - `operatorId`: 群主或管理员用户 ID。
  - `timestamp`

## 24) ChatThreadEventHandlerMap

- **字段**:
  - `onChatThreadCreated?: (event: ChatThreadCreatedEventPayload) => void | Promise<void>`
  - `onChatThreadDestroyed?: (event: ChatThreadDestroyedEventPayload) => void | Promise<void>`
  - `onChatThreadUpdated?: (event: ChatThreadUpdatedEventPayload) => void | Promise<void>`
  - `onChatThreadUserRemoved?: (event: ChatThreadUserRemovedEventPayload) => void | Promise<void>`
- **约束**:
  - 不包含 `onChatThreadChange`。

## 25) ChatThreadRawNotifyEvent（内部）

- **描述**: MUC Thread 原始通知内部输入。
- **字段来源**:
  - `operation`: `create | update | update_msg | delete | join | leave | kick`
  - `id`
  - `name`
  - `muc_parent_id`
  - `msg_parent_id`
  - `from`
  - `userIds`
  - `last_message`
  - `message_count`
- **归一规则**:
  - `create` -> `onChatThreadCreated`
  - `delete` -> `onChatThreadDestroyed`
  - `update` / `update_msg` -> `onChatThreadUpdated`
  - `kick` 且目标为当前登录用户 -> `onChatThreadUserRemoved`
  - `join` / `leave` / 其他多设备分支 -> 不派发公开 Thread 变更事件
- **约束**:
  - `@internal`，不得出现在公开 API Reference 中。

## 关系说明

- `ChatClient.use(ChatThreadManager)` 注册 manager capability 后，`MessageReceiver` 才会把 Thread raw notify 路由到 manager。
- `ChatThreadManager` 把 raw notify 归一为 4 个公开事件，并通过 `EventHub` 派发到用户 handler。
- REST 方法使用 `RestClient.request(..., { operation })`，operation 与 `api-errors.json.apis` key 必须一一对应。
- API Reference 从 manager、entity、types 三类入口生成公开文档；raw notify 内部类型隐藏。

## 状态与校验

### REST 参数校验

- 必填字符串：trim 后不能为空。
- `pageSize`: 整数，范围 1-50，未传默认 20。
- `cursor`: 未传默认空字符串；传入必须为字符串。
- `chatThreadIds`: 数组长度 1-20，每项为非空字符串。

### 事件校验

- 缺少 `chatThreadId` 或 `parentId` 的 raw notify 不派发公开事件。
- 未识别 operation 不派发公开事件。
- 未注册 `ChatThreadManager` 时不派发公开 Thread 事件。
- `kick` 事件仅在表示当前登录用户被移出时派发 `onChatThreadUserRemoved`。
