# 024 数据模型（Phase 1）

## 1) ContactRelationRecord

- **描述**: 联系人关系缓存实体，仅保存联系人域独有字段与同步所需元信息，不重复保存 `nickname/avatarUrl`。
- **关键字段**:
  - `userId`: 联系人用户 ID
  - `remark`: 联系人备注
  - `sign`: 联系人签名（当前阶段保留在联系人域）
  - `addTs`: 建联时间（毫秒）
  - `updatedAt`: 联系人关系记录最后更新时间（毫秒）
  - `metadataUpdatedAt`: 联系人 metadata 最后更新时间（毫秒）
- **校验规则**:
  - `userId` 必填且非空
  - `addTs/updatedAt/metadataUpdatedAt` 为毫秒时间戳，允许为 `0` 表示未知

## 2) ContactVersionState

- **描述**: 当前用户已知的联系人集合版本状态。
- **关键字段**:
  - `version`: 联系人集合版本号
  - `lastVersionCheckAt`: 最近一次 metadata version 查询时间
  - `lastVersionSource`: `metadata | sync_page | roster_notice`
- **校验规则**:
  - `version` 允许为空字符串（表示尚未建立基线）

## 3) ContactCacheMeta

- **描述**: 联系人缓存元数据，决定冷启动时是否允许直接使用本地联系人缓存。
- **关键字段**:
  - `cacheIntegrity`: `complete | incomplete`
  - `reason`: `quota_exceeded | user_info_missing | corrupted | first_sync_pending | manual_reset`
  - `lastSyncTs`: 最近一次成功同步完成时间
  - `lastSuccessfulVersion`: 最近一次成功同步后的联系人版本号
  - `lastSyncMode`: `full | incremental | skipped`
- **状态语义**:
  - `complete`: 当前联系人关系缓存与用户资料缓存可拼出完整联系人结果
  - `incomplete`: 当前本地缓存不可直接用于完整联系人展示，下次登录需至少全量同步一次

## 4) ContactProjection

- **描述**: 运行时合并后的完整联系人展示对象，对外读取和事件回调均以该结构为准。
- **关键字段**:
  - `userId`
  - `nickname`
  - `avatarUrl`
  - `sign`
  - `remark`
  - `addTs`
- **合成规则**:
  - `nickname/avatarUrl` 来自 `UserInfoSummary`
  - `remark/addTs/sign` 来自 `ContactRelationRecord`
  - 若 `nickname/avatarUrl` 缺失，则当前联系人投影视为“不完整”

## 5) ContactSnapshot

- **描述**: 某一时刻对外可消费的完整联系人列表快照。
- **关键字段**:
  - `items: ContactProjection[]`
  - `source: cache | sync`
  - `version`
  - `complete: boolean`
- **约束**:
  - 对外事件和读取结果均输出完整快照，而不是局部 patch

## 6) ContactSyncDecision

- **描述**: 登录后联系人同步决策结果。
- **枚举值**:
  - `skip`: metadata 判定无需同步且本地缓存完整
  - `incremental`: metadata 判定需要同步且存在有效基线
  - `full`: 本地无基线或缓存不完整，需要完整同步

## 7) RosterSyncRequestFrame

- **描述**: 联系人同步请求帧，对应 protobuf `GetRosterRequest`。
- **关键字段**:
  - `resource`
  - `requestId`
  - `protocolVersion`
  - `org`
  - `app`
  - `username`
  - `version`
  - `cursor`
- **校验规则**:
  - `username/org/app` 必填
  - `version` 允许为空（首次全量）
  - `cursor = 0` 表示首页

## 8) RosterSyncPage

- **描述**: 单页联系人同步响应，对应 protobuf `GetRosterResponse`。
- **关键字段**:
  - `items: RosterItem[]`
  - `cursor`
  - `version`
  - `responseType: incremental | full`
- **约束**:
  - `responseType = full` 时，本轮同步结果应覆盖旧联系人集合
  - `responseType = incremental` 时，本轮同步结果按关系记录进行 upsert / remove / metadata update

## 9) RosterItem

- **描述**: 服务端返回的单个联系人记录。
- **关键字段**:
  - `contact`: 联系人用户 ID
  - `remark`
  - `metadata`
  - `createdAt`
  - `updatedAt`
  - `metadataUpdatedAt`
- **派生字段**:
  - `metadata` 需要在业务层解析为 SDK 可用字段（至少支持 `sign`）

## 10) ContactSyncSession

- **描述**: 单轮联系人同步 websocket 会话状态。
- **关键字段**:
  - `requestId`
  - `decision: ContactSyncDecision`
  - `expectedVersion`
  - `cursor`
  - `pageCount`
  - `startedAt`
  - `status: idle | connecting | syncing | completed | failed | cancelled`
- **状态流转**:
  - `idle -> connecting -> syncing -> completed`
  - `idle -> connecting -> syncing -> failed`
  - `connecting|syncing -> cancelled`

## 11) ContactSyncEventPayload

- **描述**: 联系人同步事件统一载荷。
- **关键字段**:
  - `error`
- **事件映射**:
  - `onContactSyncStart`: 每轮联系人同步流程开始时派发，不携带 payload
  - `onContactSyncFinish`: 本轮同步结束；成功时不携带 payload，失败时仅通过 `error` 字段返回原因

## 关系说明

- `ContactRelationRecord` 与 `UserInfoSummary` 按 `userId` 在运行时合并成 `ContactProjection`
- `ContactCacheMeta` 与 `ContactVersionState` 共同决定 `ContactSyncDecision`
- `RosterSyncPage` 在 `ContactSyncSession` 生命周期内被持续合并，最终产出 `ContactSnapshot`

## 状态流转

### 缓存完整性状态

- `incomplete -> complete`：一次成功全量/增量同步后，联系人关系缓存与用户资料缓存均满足完整展示条件
- `complete -> incomplete`：关联 `userInfo` 被淘汰、缓存损坏、落盘失败或手动清理

### 同步决策状态

- `skip`：metadata 判定无需同步且 `cacheIntegrity = complete`
- `incremental`：metadata 判定需同步，且本地存在有效 version 基线
- `full`：首次登录、缓存不完整、缓存损坏或无有效基线
