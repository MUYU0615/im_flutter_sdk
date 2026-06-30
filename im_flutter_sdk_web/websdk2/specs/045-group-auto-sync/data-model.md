# 045 数据模型（Phase 1）

## 1) SyncDataType

- **描述**: 登录后自动同步的数据类型。
- **公开取值**:
  - `conversation`
  - `contact`
  - `group`
- **校验规则**:
  - `enableSyncData` 未传时视为 `['conversation']`
  - `enableSyncData: []` 表示关闭所有登录后自动同步
  - 重复值去重
  - 未知值在初始化校验阶段失败

## 2) SyncDataStartPayload

- **描述**: `ChatClient` 级 `onSyncDataStart` 事件载荷。
- **关键字段**:
  - `dataType`: `SyncDataType`
- **约束**:
  - 只在实际启动或形成同步闭环时派发
  - 同一用户同一 `dataType` 的重复触发不得重复派发 start
  - 不携带本地时间戳等诊断字段

## 3) SyncDataFinishedPayload

- **描述**: `ChatClient` 级 `onSyncDataFinished` 事件载荷。
- **关键字段**:
  - `dataType`: `SyncDataType`
  - `status`: `success | failed`
  - `error`: `SyncDataError | undefined`
- **约束**:
  - 成功时 `error` 不存在
  - 失败时 `error` 必须包含阶段信息
  - `group` 命中服务端单轮上限时仍以 `status: success` 表示同步轮次成功结束，受限/不完整状态保留在内部快照与结构化日志中
  - 取消类内部结束不作为公开 `status`，统一按失败闭环派发，必要时通过 `error.stage: 'cancelled'` 排障
  - 不携带 `finishedAt`、`meta`、`itemCount`、`storageLimit` 或 `serverLimit`

## 4) SyncDataError

- **描述**: 统一同步失败错误详情。
- **关键字段**:
  - `dataType`: `SyncDataType`
  - `stage`: `config | socket_connect | request_send | response_decode | batch_merge | preview_persist | completion_meta | auth | server_limit | cancelled`
  - `message`
  - `code`
  - `retryable`
- **约束**:
  - 不包含 token、完整 URL query token 等敏感信息
  - 必须能覆盖 024 联系人同步原有失败阶段

## 5) JoinedGroupSummary

- **描述**: 第二通道同步得到的当前用户已加入群组轻量业务对象。
- **关键字段**:
  - `groupId`
  - `name`
  - `ownerId`
  - `memberCount`
  - `description`
  - `avatarUrl`
  - `role`: `owner | admin | member`
  - `disabled`
  - `muteAllMembers`
  - `muteExpiration`
  - `remindType`: `DEFAULT | ALL | AT | NONE`
  - `createdAt`
  - `updatedAt`
  - `joinedAt`
- **约束**:
  - 不等价于 `GroupDetail`
  - 不承诺包含成员、管理员、公告、共享文件、黑名单、allowlist、成员属性等字段
  - 协议草案中的畸形字段必须归一为稳定 SDK 字段
  - 协议 `remind_type` 数字值必须归一为与 REST/Push API 一致的 `DEFAULT | ALL | AT | NONE`

## 6) JoinedGroupCacheRecord

- **描述**: 当前登录会话内的已加入群组运行时记录，保存在 `GroupRepository` 或等价内存态中。
- **关键字段**:
  - `summary`: `JoinedGroupSummary`
  - `lastSyncModifyTime`
  - `lastMucUpdateTime`
  - `source`: `sync | muc | rest`
  - `lastAccess`
  - `lastUpdate`
- **合并规则**:
  - 第二通道 `update_at` 晚于本地同字段更新时间时才覆盖轻量字段
  - 第二通道缺失字段不清空本地已有完整详情字段
  - 命中 MUC 删除状态的旧数据不得重新写入

## 7) JoinedGroupPreviewCacheRecord

- **描述**: localStorage 中最多持久化 100 个轻量群组预览，用于冷启动和首屏展示。
- **关键字段**:
  - `summary`: `JoinedGroupSummary`
  - `source`: `localPreview`
  - `lastUpdate`
  - `rank`
- **约束**:
  - 单用户最多持久化 100 条
  - 只保存轻量字段，不保存完整群详情、成员、管理员等配置
  - 不作为完整群组真相，也不作为跳过登录同步的依据
  - 账号隔离，与联系人、用户资料、会话缓存共用 localStorage 空间时必须控制体积

## 8) JoinedGroupSnapshot

- **描述**: `GroupManager` 本地读取入口返回的当前用户已加入群组快照。
- **关键字段**:
  - `items`: `ReadonlyArray<JoinedGroupSummary>`
  - `meta`: `JoinedGroupSnapshotMeta`
- **约束**:
  - 纯本地读取，不触发网络请求
  - `items` 来自当前用户缓存，不跨账号复用
  - 同步完成前可来自 localStorage 预览；同步完成后来自当前会话运行时仓库

## 9) JoinedGroupSnapshotMeta

- **描述**: 本地群组快照完整性与同步元信息。
- **关键字段**:
  - `integrity`: `preview | synced | limited | incomplete | unknown`
  - `limited`: boolean
  - `storageLimit`: number
  - `serverLimit`: number
  - `source`: `localPreview | sync`
  - `lastSyncFinishedTs`
  - `lastSuccessfulAt`
  - `reason`
- **状态说明**:
  - `preview`: 当前结果来自 localStorage 首屏预览，最多 100 个，不代表完整
  - `synced`: 当前结果来自本轮登录同步且未命中 3000 上限
  - `limited`: 服务端命中单轮 3000 上限，超过部分未下发
  - `incomplete`: 同步失败或缓存损坏
  - `unknown`: 尚未完成过同步

## 10) GroupSyncCompletionMeta

- **描述**: 当前用户群组同步完成元信息。本期每次登录仍全量同步，该实体不作为增量 checkpoint。
- **关键字段**:
  - `lastSyncFinishedTs`: 服务端最终批返回时间
  - `lastSuccessfulAt`
  - `integrity`
  - `limitState`
  - `storageLimit`: 100
  - `serverLimit`: 3000
- **约束**:
  - 仅最后一批成功合并且 100 个预览持久化成功后记录成功完成
  - 任意失败、取消、账号切换不得标记为成功
  - `limited` 状态必须随完成元信息暴露
  - 不决定下一次 `JoinedGroupsRequestFrame.lastSyncTime`

## 11) GroupRemovalState

- **描述**: MUC 删除/退群/踢出/销毁建立的当前会话删除状态。
- **关键字段**:
  - `groupId`
  - `reason`: `destroyed | left | kicked | removed`
  - `mucUpdateTime`
  - `createdAt`
- **约束**:
  - 第二通道旧数据 `updatedAt <= mucUpdateTime` 时不得复活该群
  - 用户后续重新加入同一群时，需通过更新更晚的 MUC 或 REST/同步事实解除删除状态

## 12) JoinedGroupsRequestFrame

- **描述**: group-sync WSS 请求帧。
- **关键字段**:
  - `type`: `MESSAGE_TYPE_JOINED_GROUPS_REQUEST`
  - `header.resource`
  - `header.requestId`
  - `header.protocolVersion`
  - `org`
  - `app`
  - `username`
  - `lastSyncTime`
  - `cursor`
- **校验规则**:
  - `org/app/username` 必填
  - 本期每次登录按全量语义请求，`lastSyncTime = 0` 或等价全量起点
  - 首次请求不带 `cursor`；同一轮断点续传时携带最近一批响应返回的 `cursor`

## 13) JoinedGroupsSyncBatch

- **描述**: group-sync WSS 响应批次。
- **关键字段**:
  - `type`: `MESSAGE_TYPE_JOINED_GROUPS_RESPONSE`
  - `header.requestId`
  - `groups`: `ReadonlyArray<GroupItem>`
  - `isLastBatch`
  - `lastSyncFinishedTs`
  - `cursor`
- **约束**:
  - 只接收当前 requestId 的响应
  - 非最后一批不得标记本轮同步完成
  - 非最后一批返回 `cursor` 时写入当前 session，用于同一轮断线恢复
  - 服务端单轮总量最多 3000；命中上限需设置 `limited`

## 14) GroupSyncSession

- **描述**: 一轮群组同步运行时状态。
- **关键字段**:
  - `userId`
  - `requestId`
  - `status`: `idle | connecting | syncing | completed | failed | cancelled`
  - `receivedCount`
  - `limited`
  - `resumeCursor`
  - `startedAt`
  - `finishedAt`
- **状态流转**:
  - `idle -> connecting -> syncing -> completed`
  - `idle -> connecting -> syncing -> failed`
  - `connecting|syncing -> cancelled`

## 15) JoinedGroupsErrorFrame

- **描述**: group-sync WSS 错误响应帧，对应服务端 `ErrorDetail(type=5)`。
- **关键字段**:
  - `type`: `MESSAGE_TYPE_ERROR`
  - `code`
  - `message`
  - `requestId` 或等价追踪信息（若服务端错误帧携带）
- **错误码映射**:
  - `1601`: 请求参数无效，映射为参数/请求阶段错误，默认不可重试
  - `1602`: 服务端获取群组失败，映射为服务端同步失败，默认可重试
  - `1002`: 鉴权失败，映射为 `auth` 阶段错误，需重新登录或刷新 token
  - `1003`: 请求限流，映射为限流错误，默认可延迟重试
- **约束**:
  - 不把原始二进制错误帧作为公开事件 payload 透出
  - 必须转为 `SyncDataError` 并通过 `onSyncDataFinished(dataType='group', status='failed')` 派发
  - 未知服务端错误码应保留 code/message，并标记为可诊断失败

## 关系说明

- `enableSyncData` 决定 `ChatClient` 登录后是否创建 `GroupSyncSession`
- `JoinedGroupsSyncBatch` 经 normalizer 转为 `JoinedGroupSummary`
- `JoinedGroupCacheRecord` 在当前会话内合并第二通道、MUC 和 REST 产生的轻量字段
- `JoinedGroupPreviewCacheRecord` 将当前会话同步结果裁剪为最多 100 个预览写入 localStorage
- `GroupRemovalState` 约束第二通道旧数据不能复活已失效群
- `JoinedGroupSnapshot` 由 `GroupManager` 本地读取入口返回
- `GroupSyncCompletionMeta` 记录同步完成状态，但不决定下一次 `JoinedGroupsRequestFrame.lastSyncTime`
- `GroupSyncSession.resumeCursor` 只在当前同步轮次内使用；成功、失败、取消或账号切换后清理
- `JoinedGroupsErrorFrame` 经错误映射后成为 `SyncDataError`
- `groupManager.getGroup(groupId)` 从当前会话记录或 localStorage 预览中读取已知 `JoinedGroupSummary`，并绑定到 `Group` facade

## 状态流转

### 快照完整性

- `unknown -> preview`: 冷启动读取到 localStorage 预览但本次登录同步尚未完成
- `unknown|preview|incomplete -> synced`: 本轮登录同步成功且未命中 3000 上限
- `unknown|preview|synced -> limited`: 同步成功但命中 3000 单轮上限
- `unknown|preview|synced|limited -> incomplete`: 解码、合并或预览持久化失败
- `incomplete -> synced|limited`: 后续同步成功

### 群组记录

- `missing -> active`: 第二通道或 REST/MUC 提供有效加入事实
- `active -> active`: 第二通道 `updatedAt` 或 MUC 更新时间更新轻量字段
- `active -> removed`: MUC 删除、退群、踢出或销毁
- `removed -> active`: 后续更晚的重新加入事实到达

### 本地预览

- `empty -> preview`: 同步完成后从当前会话结果中选择最多 100 个轻量群组写入 localStorage
- `preview -> preview`: 后续登录同步完成后覆盖旧预览
- `preview -> incomplete`: 预览损坏、账号不匹配或读取失败
