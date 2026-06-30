# 035 数据模型（Phase 1）

## 1) SessionItem

- **描述**: 新会话列表的公开业务对象，作为 `ChatManager.getSessionList()` 与 `refreshSessionList()` 的唯一返回项结构。
- **关键字段**:
  - `conversationId`: 会话主键，来自协议 `session_id`
  - `conversationType`: `singleChat | groupChat | chatRoom`
  - `unreadCount`: 当前未读数
  - `lastMessage`: `SessionMessageSnippet | null`
  - `lastMessageAt`: 最后一条消息时间（毫秒）
  - `isPinned`: 是否置顶
  - `pinnedTimestamp`: 置顶时间（毫秒）
  - `marks`: 会话标记列表
  - `readAt`: 当前会话读到的位置时间戳（毫秒）
  - `remindType`: `SessionListRemindType`
  - `conversationName`: 会话展示名称
  - `conversationAvatar`: 会话展示头像
- **校验规则**:
  - `conversationId` 必填且非空
  - `conversationType` 仅允许 `singleChat | groupChat | chatRoom`
  - `unreadCount` 必须为 `>= 0` 的整数
  - `pinnedTimestamp/readAt/lastMessageAt` 允许为 `0` 或 `undefined` 表示未知

## 2) 会话展示字段

- **描述**: 会话展示信息直接位于 `SessionItem` 顶层，业务 UI 不再读取 `display` 投影。
- **关键字段**:
  - `conversationName`: 最终展示名称
  - `conversationAvatar`: 最终展示头像
- **合成规则**:
  - 单聊优先级：`remark > nickname > userId`
  - 群聊/聊天室优先级：`group_name/group_avatar > 本地已有群展示信息 > fallback`
  - 无法获得头像时，`conversationAvatar` 可为空字符串或 `undefined`

## 3) SessionMessageSnippet

- **描述**: `SessionItem.lastMessage` 使用的轻量消息摘要，仅承载会话列表展示最小字段。
- **关键字段**:
  - `msgServerId`
  - `from`
  - `to`
  - `sender`
  - `conversationId`（可选）
  - `conversationType`（可选）
  - `type`（可选）
  - `status`（可选，仅在链路可可靠提供时写入）
  - `timestamp`
  - `direct`（可选）
  - `body`
- **约束**:
  - 不得透传完整公开 `Message`
  - `body` 必须符合当前消息结构，不得包含 `type` 字段
  - `from` 与 `sender.userId` 都是 userId；当服务端返回 `from.name` 时，取 `_` 后面的内容作为 userId
  - `sender.nickname` / `sender.avatarUrl` 来自联系人资料或订阅用户资料，并在这些资料更新后刷新本地缓存
  - 服务端未返回 `to` 时，单聊按 `conversationId` 与当前用户推断对方：若 `from` 等于当前用户，则 `to = conversationId`，否则 `to = 当前用户 userId`
  - 服务端未返回 `to` 时，群聊与聊天室统一 `to = conversationId`

## 4) SessionListRemindType

- **描述**: session-list 域专用提醒类型公开枚举。
- **公开取值**:
  - `DEFAULT`
  - `ALL`
  - `AT`
  - `NONE`
- **协议映射**:
  - `0 -> DEFAULT`
  - `1 -> ALL`
  - `2 -> AT`
  - `3 -> NONE`

## 5) SessionListCacheRecord

- **描述**: 本地 session-list 专用缓存实体，是新会话列表的持久真相。
- **关键字段**:
  - `conversationId`
  - `conversationType`
  - `lastMessage`
  - `lastMessageAt`
  - `unreadCount`
  - `isPinned`
  - `pinnedTimestamp`
  - `marks`
  - `readAt`
  - `remindType`
  - `conversationName`
  - `conversationAvatar`
  - `updatedAt`
- **约束**:
  - 本地排序必须按 `pinnedTimestamp desc -> lastMessageAt/updatedAt desc`
  - 完整快照提交时，缓存中不存在于服务端快照的记录必须被删除

## 6) SessionListCheckpoint

- **描述**: 当前用户、当前设备维度的会话列表同步检查点。
- **关键字段**:
  - `lastSyncTime`: 请求时携带的游标
  - `lastSyncFinishedTs`: 服务端最后一批返回的完成时间
  - `sessionsLastSyncTs`: 本地最终成功持久化的 checkpoint
  - `lastSuccessfulAt`: 最近一次成功提交时间
- **状态约束**:
  - 仅最后一批成功入库且成功推进 checkpoint 后，`sessionsLastSyncTs` 才允许更新
  - 任意中途失败、回滚、取消或被踢下线都不得推进 `sessionsLastSyncTs`

## 7) SessionListCapabilityState

- **描述**: 当前登录周期对新链路可用性的运行时判定结果。
- **关键字段**:
  - `status`: `unknown | available | unsupported | unconfigured`
  - `determinedAt`
  - `reason`
- **约束**:
  - `unsupported/unconfigured` 仅保存在本登录周期内存态，不持久化
  - 重新登录后重置为 `unknown`

## 8) SessionListSyncRequest

- **描述**: 单次 WSS 会话列表同步请求模型。
- **关键字段**:
  - `requestId`
  - `resource`
  - `protocolVersion`
  - `org`
  - `app`
  - `username`
  - `lastSyncTime`
- **校验规则**:
  - `requestId` 必填且唯一
  - `resource/org/app/username` 必填
  - 首次同步允许 `lastSyncTime = 0`

## 9) SessionListSyncBatch

- **描述**: 单批会话列表同步响应。
- **关键字段**:
  - `requestId`
  - `sessions`
  - `isLastBatch`
  - `lastSyncFinishedTs`
  - `batchSequence`
- **约束**:
  - 非最后一批不得推进 checkpoint
  - 相同 `requestId + batchSequence` 的重复包必须丢弃

## 10) SessionListSyncSession

- **描述**: 单轮会话列表 WSS 同步会话状态。
- **关键字段**:
  - `requestId`
  - `userId`
  - `resource`
  - `status: idle | connecting | syncing | completed | failed | cancelled`
  - `receivedBatches`
  - `seenBatchKeys`
  - `startedAt`
  - `finishedAt`
- **状态流转**:
  - `idle -> connecting -> syncing -> completed`
  - `idle -> connecting -> syncing -> failed`
  - `connecting|syncing -> cancelled`

## 11) SessionListFallbackContext

- **描述**: 新链路不可用时回退旧会话列表的运行时上下文。
- **关键字段**:
  - `source`: `oldConversationList`
  - `reason`: `unconfigured | unsupported | connect_failed | auth_failed | protocol_failed | sync_failed`
  - `mappedAt`
- **约束**:
  - 回退仅作用于新会话列表能力，不影响后续联系人同步与漫游消息链路

## 12) SessionListSyncEventPayload

- **描述**: 会话列表同步事件对外载荷。
- **事件签名**:
  - `onSyncDataStart?: (payload: SyncDataStartPayload) => void`
  - `onSyncDataFinished?: (payload: SyncDataFinishedPayload) => void`
- **约束**:
  - `start` payload 必须携带 `dataType: 'conversation'`
  - `finish` payload 必须携带 `dataType: 'conversation'` 与终态 `status`，失败时携带 `error`

## 关系说明

- `SessionListCacheRecord` 经 normalizer 映射后得到对外 `SessionItem`
- `SessionListCheckpoint` 与 `SessionListCapabilityState` 共同决定本次 `refreshSessionList()` 是否走新链路还是直接回退
- `SessionListSyncBatch` 在 `SessionListSyncSession` 生命周期内被持续接收与去重，最终提交为一份完整 `SessionListSnapshot`
- `conversationName` 与 `conversationAvatar` 由联系人缓存、用户资料缓存、群资料字段与协议 metadata 共同归一生成

## 状态流转

### Capability 状态

- `unknown -> available`：本登录周期首次成功探测到可用新链路
- `unknown -> unsupported`：服务端明确声明不支持新协议
- `unknown -> unconfigured`：当前环境缺少新同步配置
- `available -> available`：后续 refresh 继续允许发起新链路

### 同步任务状态

- `idle -> connecting -> syncing -> completed`
- `idle -> connecting -> syncing -> failed`
- `idle -> connecting -> syncing -> cancelled`

### 列表真相状态

- `旧缓存可用 -> 新快照覆盖成功`：切换到新 session-list 缓存真相
- `新链路失败 -> 旧逻辑映射`：对外返回 `SessionItem`，但底层来源改为旧会话列表
- `MSync 事件中途到达 -> 完整快照统一收敛`：最终结果以更晚更新时间和完整快照删除语义为准
