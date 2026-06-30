# 045 研究记录（Phase 0）

## Decision 1: 自动同步配置只保留 enableSyncData

- **Decision**: 直接移除 `enableAutoSyncContacts`，会话列表、联系人和群组登录后自动同步统一由 `enableSyncData: ['conversation', 'contact', 'group']` 控制；未传时默认 `['conversation']`，显式传 `[]` 才关闭全部自动同步。
- **Rationale**: 用户明确选择不保留兼容期。单一配置入口可以避免 `enableAutoSyncContacts=true` 但 `enableSyncData` 不含 `contact` 这类冲突。
- **Alternatives considered**:
  - 保留 `enableAutoSyncContacts` 兼容期：升级风险较低，但会形成双开关冲突和更复杂的文档/测试矩阵。
  - 长期支持两套配置：对调用方表面友好，但与“统一开关”目标冲突。

## Decision 2: 同步事件统一到 ChatClient 级 onSyncDataStart/onSyncDataFinished

- **Decision**: 直接移除 `onContactSyncStart/onContactSyncFinish`；新增 `ChatClient` 级 `onSyncDataStart/onSyncDataFinished`，payload 通过 `dataType` 区分 `contact` 与 `group`。
- **Rationale**: 同步是登录后跨域调度能力，不再属于单个 manager。放在 `ChatClient` 级可以让业务用一组监听器观察所有自动同步，不需要同时绑定 ContactManager/GroupManager。
- **Alternatives considered**:
  - 保留旧联系人事件并双派发：兼容性好，但会导致重复通知和状态面膨胀。
  - 把群组同步事件挂到 GroupManager：与联系人统一事件目标冲突，也会让登录后调度状态分散。

## Decision 3: group-sync 复用 SyncTransportClient，业务层独立

- **Decision**: 群组同步复用现有 `core/contact-sync/sync-transport-client.ts` 的第二通道 socket 生命周期能力，但新增独立 `core/group-sync` controller/session/merge/normalizer。
- **Rationale**: 024 和 035 已证明独立 WSS + controller/session 是当前仓库同步链路的稳定模式。复用 transport 避免重复处理连接超时、idle timeout 和关闭，但群组完成元信息、MUC 删除状态、3000 限制与 MUC 裁决必须业务隔离。
- **Alternatives considered**:
  - 完全复制一套 websocket client：代码重复，后续维护风险高。
  - 直接复用联系人 controller/session：联系人 cursor/version 与群组 last_sync_time/update_at/cursor 续传语义不同，强耦合会污染状态。

## Decision 3A: 每次登录都执行群组全量同步

- **Decision**: 本期不依赖本地持久化 checkpoint 做增量跳过；每次登录启用 `group` 时都按全量语义请求当前用户已加入群组。正式协议支持 `last_sync_time > 0` 增量，但 045 登录自动同步固定发送 `last_sync_time=0` 或等价全量起点。
- **Rationale**: 用户明确希望“最多只存 100 个用于首屏，然后每次登录仍同步全量群组（最多 3000）”。这能避免 localStorage 只保存预览时还用 checkpoint 做增量导致本地永远补不齐。
- **Alternatives considered**:
  - 持久化 `last_sync_finished_ts` 并按增量同步：服务端协议支持且节省网络，但与只保存 100 个预览冲突，无法重建完整运行时列表。
  - 持久化完整 3000 个群再增量：冷启动数据完整，但存在 localStorage 空间风险，也超出用户确认方案。

## Decision 4: 新增 joined-groups 静态 protobuf adapter

- **Decision**: 新增 `protocol/joined-groups` 静态协议产物，覆盖 `GetJoinedGroupsRequest(type=12)`、`GetJoinedGroupsResponse(type=13)`、`ErrorDetail(type=5)` 和 ping/pong。
- **Rationale**: Constitution 与既有 024/035 都要求协议主路径使用静态产物；用户提供的 proto 草案包含字段笔误，必须通过正式 adapter 归一为稳定 SDK 类型。
- **Alternatives considered**:
  - 运行时动态解析 proto 文本：不符合项目协议静态产物要求，且增加运行时体积/失败面。
  - 复用 session-list proto 命名空间：message type 和业务字段不同，强行复用会让协议含义不清。

## Decision 5: 第二通道只维护已加入群组轻量快照

- **Decision**: `GroupItem` 同步结果只作为 joined group lightweight summary，不等价于 `GroupDetail`；不包含成员、管理员、黑名单、allowlist、公告、共享文件、成员属性等完整详情。
- **Rationale**: 用户明确说明“同步下来的数据不是群组详情”。把它当完整详情会导致缺失字段覆盖本地已有详情为空，破坏 GroupManager/Group 的现有语义。
- **Alternatives considered**:
  - 把同步结果写成完整 `GroupDetail`：实现读取方便，但会伪造不存在的完整性。
  - 同步后逐个补拉详情：对 3000 群上限账号不可接受，也超出本期范围。

## Decision 6: 第二通道缺失项永不表示删除

- **Decision**: 第二通道响应中缺失某群不删除本地已加入群；删除、退群、踢出、销毁只以 MUC 事件为准。
- **Rationale**: 用户明确确认该规则。服务端 3000 单轮上限会造成缺失项，若当删除处理会误删。
- **Alternatives considered**:
  - 全量响应缺失表示删除：在真正全量且无限制时可行，但与“服务端最多 3000，超过不下发”冲突。
  - 只有删除标记才删除：当前协议草案没有删除标记，且用户要求以 MUC 为准。

## Decision 7: MUC 删除状态防止第二通道旧数据复活

- **Decision**: MUC 删除/退群/踢出/销毁事件写入当前会话删除状态；后续第二通道若返回该 group 且 `update_at` 不晚于 MUC 删除时间，必须丢弃。
- **Rationale**: MUC 是成员关系失效事实来源。如果第二通道旧快照能重新 upsert，本地已加入群组会出现“删后复活”。
- **Alternatives considered**:
  - 仅从 repository 删除不保存删除状态：无法抵御同一登录会话里的旧第二通道数据。
  - 永久删除状态不允许任何恢复：可能阻止用户重新加入同一群后的合法数据；因此需要更新时间裁决。

## Decision 8: update_at 与 MUC 更新时间共同裁决字段覆盖

- **Decision**: 每个 joined group 记录保存第二通道 `update_at` 和本地 MUC 更新时间。第二通道只在 `update_at` 更新时覆盖同类轻量字段；MUC 更新更晚时保留本地值。
- **Rationale**: 服务端正式协议通过 `GroupItem.update_at` 表示群组轻量字段更新时间。字段级 clock 可以避免旧批次反向覆盖实时事件。
- **Alternatives considered**:
  - 第二通道无条件覆盖：实现简单但会丢失实时 MUC 更新。
  - MUC 永远优先：会导致登录后同步无法更新服务端更晚的群名称、头像等字段。

## Decision 8A: cursor 只用于同一轮断点续传

- **Decision**: `GetJoinedGroupsResponse.cursor` 在非最后一批时保存到当前 `GroupSyncSession`，仅用于本轮 websocket 断开后的恢复请求；恢复请求使用相同 `last_sync_time=0` 和最新 cursor。同步成功、失败、取消或账号切换后清理该 cursor，不跨登录持久化。
- **Rationale**: 服务端协议明确全量和增量均支持断点续传。045 仍保持每次登录全量同步，因此 cursor 的职责是提升同一轮可靠性，而不是建立跨登录增量 checkpoint。
- **Alternatives considered**:
  - 不支持 cursor：会让多批同步在中途断连时只能失败，浪费已确认批次。
  - 持久化 cursor 跨登录续传：容易和每次登录全量策略冲突，也会在服务端游标过期时制造不可诊断状态。

## Decision 8B: ErrorDetail 错误码映射为统一同步错误

- **Decision**: `ErrorDetail(type=5)` 中的 `1601`、`1602`、`1002`、`1003` 映射为 `SyncDataError`：参数无效为不可重试配置/请求错误，服务端获取失败和限流按 retryable 处理，鉴权失败映射 auth 且需要重新登录或刷新 token。
- **Rationale**: 统一同步事件需要给业务可诊断、可处理的失败信息。直接暴露原始二进制错误帧会污染 SDK API，也不利于联系人/群组同步错误面统一。
- **Alternatives considered**:
  - 只记录日志不派发错误：业务无法感知同步失败原因。
  - 原样透出服务端错误结构：违反 SDK 对外返回业务对象与统一错误模型的约束。

## Decision 9: 3000 是单轮总量上限，超过不下发

- **Decision**: 服务端单轮群组同步最多返回 3000 个群，超过部分不会下发；SDK 必须记录 `limited/incomplete` 状态。
- **Rationale**: 用户已确认该语义。客户端不能通过多批保证完整，因此必须把前 3000 个与完整快照区分开。
- **Alternatives considered**:
  - 单批 3000、多批完整：与用户最终确认不符。
  - 不记录受限状态：业务会误以为本地群组列表完整。

## Decision 10: localStorage 只持久化 100 个群组预览

- **Decision**: localStorage 中每个用户最多保存 100 个 `JoinedGroupPreviewCacheRecord`，用于冷启动或首屏；当前登录会话内的 `GroupRepository` 保存本轮同步到的最多 3000 个群组。
- **Rationale**: 联系人、用户资料、会话列表已经占用 localStorage。群组最多 3000 个且字段较多，全部持久化会增加配额风险；100 个预览可以覆盖首屏体验，同时登录后全量同步恢复运行时完整性。
- **Alternatives considered**:
  - 不保存任何群组：避免配额风险，但冷启动群组首屏完全空白。
  - 保存全部 3000 个群：首屏完整，但容易挤占已有缓存，尤其在浏览器配额较低或开启缓存加密时风险更高。
  - 按 LRU 动态保存不设硬上限：实现复杂且难以给业务稳定预期。

## Decision 11: getJoinedGroupList 对外返回裸数组

- **Decision**: 公开 `getJoinedGroupList()` 返回 `ReadonlyArray<JoinedGroupSummary>`；不再新增 `getLocalJoinedGroupSnapshot()` 公开入口。`integrity/limited/lastSyncFinishedTs` 等诊断信息保留在内部 snapshot 与结构化日志中，不通过 `onSyncDataFinished` payload 暴露。
- **Rationale**: 业务方主要需要登录同步下来的群组业务列表，直接返回数组更符合使用预期；预览、limit 和完整性属于 SDK 内部同步诊断信息，公开事件只表达数据类型、完成状态和失败详情，避免把本地或服务端上限固化到对外 API。
- **Alternatives considered**:
  - 返回 `{ items, meta }`：诊断信息完整，但用户侧拿到 meta 后缺少直接业务价值，增加 API 使用成本。
  - 通过 `onSyncDataFinished(group).meta` 暴露诊断字段：可编程处理更强，但会把 `itemCount/storageLimit/serverLimit` 等易变实现细节固化成公开 API。

## Decision 12: getGroup(groupId) 使用已知轻量群组信息

- **Decision**: `groupManager.getGroup(groupId)` 返回的 `Group` facade 应从 localStorage 预览或当前会话同步结果中读取已知 `JoinedGroupSummary` 并绑定到内部 repository；未知群仍保持现有无网络 facade 语义。
- **Rationale**: 用户指出如果 `getGroup(groupId)` 不带同步下来的群组信息，自动同步数据就难以被单群 API 消费。绑定轻量信息可以提升首屏和单群上下文可用性，同时不改变完整详情的显式获取语义。
- **Alternatives considered**:
  - `getGroup(groupId)` 完全忽略同步结果：实现简单，但自动同步价值被限制在列表读取入口。
  - `getGroup(groupId)` 自动补拉详情：数据更完整，但会引入隐式网络请求，破坏现有 facade 轻量语义，也可能造成群列表首屏大量详情请求。

## Decision 13: 未知 enableSyncData 值 fail fast

- **Decision**: 初始化校验遇到未知 `enableSyncData` 值时抛参数校验错误；重复值去重。
- **Rationale**: 自动同步会建立额外网络链路，未知值若静默忽略会隐藏接入错误；重复值去重可避免重复同步。
- **Alternatives considered**:
  - 静默忽略未知值：兼容性强但不利于 fail fast。
  - 保留未知值供未来扩展：当前没有插件化 sync type 注册机制，容易造成误触发。
