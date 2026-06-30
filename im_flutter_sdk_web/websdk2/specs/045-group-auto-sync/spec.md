# 功能规格：登录后自动同步群组数据

**Feature Branch**: `045-group-auto-sync`
**Created**: 2026-06-01
**Status**: Draft
**Input**: 用户需求："现在写 045spec, 这部分实现登录自动同步群组功能，具体方案：初始化加一个开关，控制是否自动同步数据 `enableSyncData`，传数组，把 024 同步联系人的开关和群组的统一用一个，传 `['contact', 'group']`；实现方案和同步联系人一样，使用单独 websocket，参考联系人部分；对外回调同步事件统一成 `onSyncDataStart` / `onSyncDataFinished`，要把是哪类数据给出来；`GroupManager` 增加获取本地群组的方法；群组列表按上次同步时间增量下发，group 表新增 `modifyTime`，根据 `modifyTime` 先后决定是 MUC 更新还是第二通道数据更新群组表中数据；第二通道给群组详情但不包含群成员以及管理员等；删除和销毁以 MUC 事件为准；好友同步和会话同步一样复用第二通道；服务端限制最多 3000 个；同步下来的数据不是完整群组详情，比群组详情少一些配置字段。"

## References

- 联系人自动同步：`specs/024-contact-sync/spec.md`
- 会话列表同步与第二通道：`specs/035-session-list-sync/spec.md`
- GroupManager API：`specs/027-group-manager-api/spec.md`
- Group 内部对象化试点：`specs/032-group-internal-oo-pilot/spec.md`
- 事件系统：`specs/004-event-system/spec.md`
- 本地缓存：`specs/014-local-cache-module/spec.md`
- 用户提供的第二通道正式协议：`MESSAGE_TYPE_JOINED_GROUPS_REQUEST = 12`、`MESSAGE_TYPE_JOINED_GROUPS_RESPONSE = 13`、`MESSAGE_TYPE_ERROR = 5`、`GetJoinedGroupsRequest`、`GetJoinedGroupsResponse`、`GatewayHeader`、`GroupItem`、`ErrorDetail`

## Clarifications

### Session 2026-06-01

- Q: 自动同步开关是否继续保留联系人专用 `enableAutoSyncContacts`？ → A: 不保留；新能力统一收敛到 `enableSyncData` 数组，`contact` 与 `group` 使用同一配置入口。
- Q: 群组同步是否复用联系人同步链路形态？ → A: 复用；群组同步使用独立第二通道 websocket 和静态 protobuf 协议，连接配置、候选地址、错误闭环与资源释放参考 024 联系人同步。
- Q: 同步事件是否继续按业务域拆分？ → A: 不再新增群组专属同步开始/结束事件；统一公开为 `onSyncDataStart` 与 `onSyncDataFinished`，事件必须携带本轮同步的数据类型。
- Q: 第二通道下发的群组数据是否等价于完整群详情？ → A: 不等价；它是当前用户已加入群组列表的轻量详情快照，不包含群成员、管理员、黑名单、allowlist、共享文件、公告等完整详情配置。
- Q: 群组删除和销毁由哪条链路决定？ → A: 以 MUC 事件为准；第二通道主要用于登录后列表追平和群详情轻量字段更新，不负责表达删除/销毁最终事实。
- Q: 统一同步事件公开 handler 与内部事件名是否带 `on` 前缀？ → A: 公开 handler 和内部事件名都统一使用 `onSyncDataStart` / `onSyncDataFinished`。
- Q: 旧联系人自动同步开关 `enableAutoSyncContacts` 是否保留兼容期？ → A: 不保留；本期直接移除 `enableAutoSyncContacts`，只支持 `enableSyncData`。
- Q: 旧联系人同步事件 `onContactSyncStart` / `onContactSyncFinish` 是否保留兼容期？ → A: 不保留；本期直接移除旧联系人同步事件，只保留统一 `onSyncDataStart` / `onSyncDataFinished`。
- Q: 第二通道群组同步结果中缺失的群是否表示删除？ → A: 不表示；第二通道缺失项永不删除本地群，只有 MUC 删除、退群、踢出或销毁事件能移除本地已加入群。
- Q: 服务端 3000 群组限制是单批限制还是单轮总量限制？ → A: 单轮群组同步最多返回 3000 个群，超过部分服务端不下发；SDK 必须标记结果受限或不完整，不得当作完整快照。
- Q: `onSyncDataStart` / `onSyncDataFinished` 在哪里注册监听？ → A: 统一同步事件在 `ChatClient` 级别注册监听，不挂在 `ContactManager` 或 `GroupManager`。
- Q: 群组同步结果是否全部持久化到 localStorage？ → A: 不持久化全部；localStorage 只保存最多 100 个轻量群组预览用于冷启动/首屏，当前登录会话内存态保存本轮同步到的最多 3000 个群，每次登录仍发起全量群组同步。
- Q: `getGroup(groupId)` 是否应该使用同步下来的群组信息？ → A: 应该；`getGroup(groupId)` 返回的 `Group` facade 需要带上本地预览或当前会话同步得到的轻量群组信息，但不得把它伪装成完整 `GroupDetail`，也不得为了补齐未同步群而隐式请求详情。
- Q: `getJoinedGroupList()` 是否需要把同步 meta 一起返回给业务方？ → A: 不需要；对外只返回 `ReadonlyArray<JoinedGroupSummary>`，完整性、来源、limit 等同步诊断信息保留在内部 snapshot 与结构化日志中，不通过 `onSyncDataFinished` payload 暴露。

### Session 2026-06-09

- Q: 服务端正式 joined-groups 协议是否改变 045 的同步策略？ → A: 不改变登录自动同步策略；045 仍保持每次登录全量同步，`last_sync_time=0`，不使用历史 `last_sync_finished_ts` 发起增量。
- Q: 正式协议中的消息类型和更新时间字段是什么？ → A: `GetJoinedGroupsRequest(type=12)`、`GetJoinedGroupsResponse(type=13)`、`ErrorDetail(type=5)`；早期草案里的 `modifyTime` 在正式协议中按 `GroupItem.update_at` 映射。
- Q: 正式协议中的 `cursor` 如何使用？ → A: 仅用于同一轮同步的断点续传；首次全量请求不传，非最后一批返回后保存到当前 session，断线恢复时携带相同 `last_sync_time=0` 与最新 `cursor`，不跨登录持久化。

## User Scenarios & Testing _(mandatory)_

### User Story 1 - 登录后按统一开关自动同步群组 (Priority: P1)

作为 SDK 使用者，我希望在初始化时通过同一个 `enableSyncData` 数组选择是否自动同步联系人和群组，这样我可以按业务需要开启 `contact`、`group` 或两者，并在用户登录后自动得到当前已加入群组的可用本地快照。

**Why this priority**: 群组列表是群聊入口和会话展示的重要依赖。若联系人和群组分别使用不同开关，业务接入和后续扩展都会产生重复配置与不一致行为。

**Independent Test**: 初始化分别传入 `[]`、`['contact']`、`['group']`、`['contact', 'group']`，验证登录后只启动被启用的数据同步类型；其中开启 `group` 时应能写入当前会话群组仓库，并仅持久化最多 100 个本地预览用于冷启动读取，旧 `enableAutoSyncContacts` 不再作为有效初始化参数。

**Acceptance Scenarios**:

1. **Given** 初始化未传 `enableSyncData` 或传入空数组，**When** 当前用户登录成功，**Then** SDK 不会自动启动联系人或群组第二通道同步。
2. **Given** 初始化传入 `enableSyncData: ['group']`，**When** 当前用户登录成功，**Then** SDK 会自动启动群组同步，但不会自动启动联系人同步。
3. **Given** 初始化传入 `enableSyncData: ['contact', 'group']`，**When** 当前用户登录成功，**Then** SDK 会自动同步联系人和群组，并确保两类同步状态彼此隔离。
4. **Given** 当前用户首次登录且没有本地群组缓存，**When** 群组同步成功完成，**Then** `GroupManager` 的本地读取入口能返回本轮同步得到的已加入群组列表或空列表。
5. **Given** 当前用户本地已有最多 100 个群组预览缓存，**When** 登录后群组同步尚未完成，**Then** 业务侧可以先读取该预览结果，并在同步完成后读取当前会话内存态的最新同步结果。
6. **Given** 调用方仍传入旧 `enableAutoSyncContacts`，**When** 类型检查或初始化校验执行，**Then** SDK 不再接受该字段，调用方必须改用 `enableSyncData: ['contact']`。

---

### User Story 2 - 通过第二通道全量追平已加入群组列表 (Priority: P1)

作为 SDK 使用者，我希望群组同步能复用现有第二通道能力，每次登录后拉取当前用户已加入群组的轻量信息，并在多批次结果全部完成后形成当前会话可用快照，这样登录后群组列表能快速追平服务端状态。

**Why this priority**: 群组数量可能较多，服务端单轮最多同步 3000 个群，超过部分不会下发。SDK 必须支持全量登录同步、分批和完成状态记录，并显式识别受限结果，避免把截断数据误当完整群组列表。

**Independent Test**: 使用模拟第二通道服务端返回全量、多批、空结果、超过单轮 3000 上限和错误响应，验证当前会话群组快照、100 个本地预览、受限状态和事件闭环符合预期。

**Acceptance Scenarios**:

1. **Given** 当前用户登录且启用 `group` 同步，**When** 群组同步开始，**Then** 请求应按本次登录全量同步语义拉取当前已加入群组列表，`last_sync_time` 固定发送 `0` 或等价全量起点；即使服务端协议支持增量，本期登录自动同步也不得用历史 `last_sync_finished_ts` 跳过全量。
2. **Given** 服务端 group 表中任一字段发生变化，**When** 该群组在本轮同步结果中返回，**Then** 响应条目必须携带可用于与 MUC 更新裁决的 `update_at` 或等价服务端更新时间。
3. **Given** 服务端返回多个批次，**When** SDK 尚未收到最后一批，**Then** 本轮不得提前把当前会话群组快照标记为同步完成。
4. **Given** 服务端最后一批返回 `last_sync_finished_ts`，**When** SDK 已成功合并所有批次，**Then** 本轮同步完成元信息只允许记录到该时间，且不得在本期登录自动同步中把该值作为下一次 `last_sync_time`。
5. **Given** 服务端返回本轮无新增或更新群组，**When** 同步结束，**Then** SDK 保留已有本地群组快照并仍派发成功完成事件。
6. **Given** 服务端单轮最多同步 3000 个群组且超过部分不会下发，**When** 当前用户加入群组超过 3000 个，**Then** SDK 必须把本地结果标记为受限或不完整，并通过内部快照或结构化日志保留该状态，不得把前 3000 个静默标记为完整快照。
7. **Given** 本地已有某个群组但第二通道本轮未返回该群，**When** 本轮同步成功结束，**Then** SDK 不得仅因为缺失该群而从本地已加入群组列表删除它。

---

### User Story 3 - 统一感知同步过程和结果类型 (Priority: P1)

作为 SDK 使用者，我希望联系人、群组等登录后自动同步流程使用统一的同步开始/完成事件，并能从事件中明确知道是哪类数据在同步，这样业务可以用一套加载、日志和错误处理逻辑覆盖多种数据。

**Why this priority**: 自动同步类型会继续扩展。如果每个数据域都新增一套 start/finish 事件，事件面会快速膨胀，业务层也难以统一处理。

**Independent Test**: 注册统一同步事件后分别触发联系人同步、群组同步、失败同步和跳过同步，验证每次事件都携带 `dataType`，且每轮同步都形成 `onSyncDataStart -> onSyncDataFinished` 闭环。

**Acceptance Scenarios**:

1. **Given** 群组自动同步即将开始，**When** 同步流程真正启动，**Then** 业务侧会收到 `onSyncDataStart`，其中 `dataType` 为 `group`。
2. **Given** 群组自动同步成功完成，**When** 本地快照和检查点已提交，**Then** 业务侧会收到 `onSyncDataFinished`，其中 `dataType` 为 `group` 且不携带错误。
3. **Given** 群组自动同步失败，**When** 本轮流程结束，**Then** 业务侧会收到 `onSyncDataFinished`，其中 `dataType` 为 `group` 且携带可诊断错误。
4. **Given** 同一登录流程同时启用 `contact` 与 `group`，**When** 两类同步分别开始和结束，**Then** 业务侧可通过 `dataType` 区分事件来源，且一类失败不得吞掉另一类事件。
5. **Given** 联系人同步迁移到统一事件后，**When** 联系人同步开始或完成，**Then** 统一事件中的 `dataType` 必须为 `contact`，语义不低于 024 已定义的同步事件闭环。
6. **Given** 调用方在 `ChatClient` 级别注册 `onSyncDataStart` / `onSyncDataFinished`，**When** 任一登录后自动同步流程开始或结束，**Then** 调用方能通过该 `ChatClient` 监听器收到统一同步事件。
7. **Given** 调用方仍尝试在 `ContactManager` 或 `GroupManager` 注册同步开始/完成事件，**When** 类型检查或事件注册校验执行，**Then** SDK 不再接受这些 manager 级同步事件名，调用方必须改用 `ChatClient` 级统一同步事件。

---

### User Story 4 - 通过 GroupManager 与 getGroup 消费本地群组信息 (Priority: P2)

作为 SDK 使用者，我希望 `GroupManager` 提供一个明确的本地群组读取入口，并让 `getGroup(groupId)` 能使用自动同步得到的轻量群组信息，这样群组列表首屏和单群对象都能消费本地数据，而不是每次进入群组列表页面都发起网络分页请求。

**Why this priority**: 自动同步的价值需要通过 `getJoinedGroupList` 被业务消费。该公开 API 现在表示“读取登录同步后的本地已加入群组快照”，不再表示 REST 分页查询。

**Independent Test**: 完成一次群组同步后调用本地读取入口和 `getGroup(groupId)`，验证返回的是当前用户已加入群组轻量信息；在未同步、只有本地 100 个预览、同步失败、账号切换和 MUC 更新后分别验证读取结果。

**Acceptance Scenarios**:

1. **Given** 当前用户完成一次群组同步，**When** 调用 `GroupManager.getJoinedGroupList()`，**Then** 返回当前用户已加入群组的本地快照。
2. **Given** 当前用户尚未完成群组同步但存在本地 100 个以内预览，**When** 调用 `GroupManager.getJoinedGroupList()`，**Then** 返回预览群组列表，不得隐式发起网络请求；预览来源和完整性仅作为内部同步诊断信息保留。
3. **Given** 已有群组同步缓存，**When** MUC 事件更新某个群组名称、头像、禁用状态或当前用户角色，**Then** `getJoinedGroupList()` 返回的同一群组应体现最终收敛结果。
4. **Given** 当前用户登出并切换到另一个账号，**When** 新账号调用 `getJoinedGroupList()`，**Then** 不得读取到旧账号的群组列表。
5. **Given** 调用方需要完整群详情、成员或管理员列表，**When** 只调用 `getJoinedGroupList()`，**Then** SDK 不承诺返回这些完整详情字段，调用方仍应使用对应单群详情或成员 API。
6. **Given** 当前用户的本地预览或当前会话同步结果中包含群 G 的轻量信息，**When** 调用 `groupManager.getGroup(G)`，**Then** 返回的 `Group` 对象应能携带这些已知轻量字段，且不触发详情网络请求。
7. **Given** 当前用户未同步到群 H 且本地预览中也不存在群 H，**When** 调用 `groupManager.getGroup(H)`，**Then** SDK 仍按现有语义返回单群 facade，但不自动请求详情；调用方可显式调用 `group.getDetail()` 或 `groupManager.getGroupInfo()` 获取完整详情。

### Edge Cases

- 当前账号首次登录且已加入群组为空时，SDK 仍需完成 `onSyncDataStart(group) -> onSyncDataFinished(group)` 成功闭环，并保存可识别的空快照状态。
- DNS 缺少第二通道同步地址、同步 websocket 建连失败、鉴权失败或协议不兼容时，登录主链路不得失败，但本轮群组同步必须派发带错误的完成事件。
- 群组同步 websocket 中途断开且已经确认部分批次时，SDK 应保存最近一批响应中的 `cursor`，并在同一轮恢复时使用相同 `last_sync_time=0` 与该 `cursor` 续传剩余批次；无法恢复时不得提交半成品为成功快照。
- 同一用户同一数据类型在任意时刻只允许存在一轮进行中的自动同步；重复触发应复用、合并或忽略，不得并发污染结果。
- 用户登出、切换账号、被踢或 token 失效时，当前群组同步必须终止，旧用户的后续响应不得写入新用户缓存。
- 第二通道返回的群组轻量详情缺少完整群配置字段时，不得覆盖本地已有的更完整详情字段为空值。
- 第二通道返回的 `update_at` 早于本地 MUC 事件已确认更新时间时，不得用旧快照反向覆盖 MUC 更新。
- MUC 事件表示用户被移出群、主动退群、群解散或群被销毁时，本地已加入群组列表必须以 MUC 事件为准删除或标记失效。
- 第二通道响应不得通过“结果中缺失某群”表达删除；缺失项只能表示本轮没有该群的轻量详情更新。
- 第二通道下发某个已被 MUC 删除或销毁的群组旧数据时，SDK 必须按更高优先级规则防止该群重新出现在本地已加入列表中。
- 服务端批次重复、乱序或 `last_sync_finished_ts` 缺失时，SDK 必须输出可诊断失败，且不得把当前会话结果标记为同步完成。
- 群组数量超过服务端单轮 3000 个限制时，超过部分服务端不会下发；SDK 必须暴露受限或不完整状态，不得把截断结果标记为完整。
- localStorage 中群组预览最多保存 100 个轻量记录；超过 100 的同步结果只保存在当前登录会话内存态，不得为了完整持久化 3000 个群而挤占现有联系人、用户资料和会话缓存空间。
- 冷启动读取到的 100 个预览只代表首屏可用数据，不代表完整已加入群组列表；登录后的全量群组同步完成后，当前会话快照应替换为本轮最多 3000 个结果。
- 初始化数组中出现未知同步类型时，SDK 必须在初始化阶段给出明确校验错误或忽略策略；最终行为需在 plan 中固化。

## Test Layer Requirements _(mandatory)_

### Unit Tests

- Coverage goals: 覆盖 `enableSyncData` 校验与默认值、旧联系人开关移除后的类型/API 边界、同步类型去重、统一同步事件 payload、群组同步完成元信息、100 个本地预览裁剪、`update_at` 冲突裁决、cursor 断点续传、服务端 `ErrorDetail(type=5)` 错误码映射、MUC 删除优先级、轻量详情字段合并、3000 上限处理、`getGroup(groupId)` 复用轻量信息、账号隔离、重复同步防护和本地读取入口纯读语义。
- Planned location:
  - `tests/unit/sync-data/enable-sync-data.test.ts`
  - `tests/unit/sync-data/sync-data-events.test.ts`
  - `tests/unit/group-sync/group-sync-decision.test.ts`
  - `tests/unit/group-sync/group-snapshot-merge.test.ts`
  - `tests/unit/managers/group-manager-local-groups.test.ts`
- Not applicable rationale: N/A，本功能新增公开配置、公开事件、缓存合并和本地读取行为，单元测试必需。

### Integration Tests

- Coverage goals: 覆盖登录后按 `enableSyncData` 调度联系人和群组同步、复用第二通道 websocket、群组协议编解码、多批次合并、cursor 断点续传、服务端错误帧映射、同步失败不影响登录主链路、GroupManager 本地读取、localStorage 100 个预览与当前会话最多 3000 个结果分层、`getGroup(groupId)` 读取已知轻量信息、MUC 事件与第二通道结果最终收敛、账号切换清理、ChatClient 级统一同步事件行为，以及联系人/群组 manager 级旧同步事件移除后的边界。
- Planned location:
  - `tests/integration/group-sync/group-auto-sync.integration.test.ts`
  - `tests/integration/group-sync/group-sync-transport.integration.test.ts`
  - `tests/integration/group-sync/group-sync-muc-merge.integration.test.ts`
  - `tests/integration/sync-data/sync-data-login.integration.test.ts`
- Not applicable rationale: N/A，本功能涉及登录调度、Manager、缓存、事件系统、协议链路和 MUC 协作，集成测试必需。

### E2E Tests

- Coverage goals: 评估复用现有浏览器 demo/API 登录主路径，验证开启 `enableSyncData: ['group']` 后群组同步事件可见、本地群组可读取、同步失败不阻塞登录；若当前 demo 无群组列表 UI，可先增加 API 级浏览器用例而不新增完整 UI 页面。
- Planned location:
  - `tests/e2e/api/group-sync.spec.ts`
  - 复用现有 demo 登录用例补充同步事件日志断言
- Not applicable rationale: N/A，本功能影响登录后用户可见数据可用性，应至少有 API 级浏览器 E2E 或明确在 tasks 中说明现有真实环境限制。

### Gate Impact

- Required gates:
  - `npm run test:run`
  - `npm run lint`
  - `npm run type-check`
  - `npm run test:gate:pr`
  - 若公开 API 文档或错误码表受影响，补跑 `npm run docs:api:check` 与 `npm run errors:check`
- Validation notes:
  - PR gate 必须阻断 `enableSyncData` 配置回归、统一事件 payload 回归、群组同步快照合并回归、MUC 删除优先级回归和本地群组读取入口回归。
  - Nightly / Release gate 应覆盖第二通道异常、浏览器 API 主路径和真实环境兼容性。

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: SDK MUST provide an initialization option `enableSyncData` that controls login-time automatic data synchronization.
- **FR-002**: `enableSyncData` MUST support at least the data types `conversation`, `contact` and `group`.
- **FR-003**: The default behavior MUST automatically synchronize the conversation list only; contact and group data synchronization remain disabled unless explicitly enabled.
- **FR-004**: When `enableSyncData` contains `group`, SDK MUST start group data synchronization after the current user logs in successfully.
- **FR-005**: When `enableSyncData` does not contain `group`, SDK MUST NOT automatically start group data synchronization or establish the group sync websocket.
- **FR-006**: When `enableSyncData` contains `contact`, contact automatic synchronization MUST preserve the behavioral contract defined by `specs/024-contact-sync/spec.md`.
- **FR-007**: SDK MUST remove the existing `enableAutoSyncContacts` initialization option in this feature; callers MUST use `enableSyncData: ['contact']` to enable contact auto sync.
- **FR-008**: SDK MUST validate unknown or duplicate `enableSyncData` values deterministically and document the chosen behavior.
- **FR-009**: Automatic synchronization state MUST be isolated by current user and data type.
- **FR-010**: SDK MUST ensure one user cannot observe or write another user's group sync snapshot, local preview, completion metadata, or in-flight result.
- **FR-011**: Group synchronization MUST use the shared second-channel sync websocket capability rather than the main message websocket.
- **FR-012**: Group synchronization MUST reuse the same sync transport configuration shape as contact and session-list synchronization, including private deployment sync websocket addresses.
- **FR-013**: When sync websocket candidates are unavailable or cannot be resolved, SDK MUST keep the login main flow successful and end this group sync round with a diagnostic failure event.
- **FR-014**: Group synchronization MUST use a static protobuf-generated protocol path for `GetJoinedGroupsRequest(type=12)` and `GetJoinedGroupsResponse(type=13)`; runtime dynamic parsing of `.proto` text MUST NOT be the main path.
- **FR-015**: `GetJoinedGroupsRequest` MUST carry the current org, app, username, request metadata, and full-sync semantics for this login; SDK MUST send `last_sync_time=0` or an equivalent full-sync value in this phase rather than relying on a persisted incremental checkpoint.
- **FR-015A**: Although the service protocol supports incremental sync with `last_sync_time > 0`, 045 login-time automatic group sync MUST remain full sync on every login; `last_sync_finished_ts` MUST NOT be used as the next automatic-login `last_sync_time` in this phase.
- **FR-015B**: `GetJoinedGroupsRequest` MUST support `cursor` for same-round resume; initial requests omit `cursor`, and resume requests reuse the same `last_sync_time=0` with the latest accepted response cursor.
- **FR-016**: `GetJoinedGroupsResponse` MUST support repeated group items, `is_last_batch`, `last_sync_finished_ts`, and `cursor`.
- **FR-017**: SDK MUST treat `last_sync_finished_ts` from the final successful response as completion metadata for the current round only; it MUST NOT be used to skip the next login-time full group sync in this phase.
- **FR-018**: SDK MUST NOT mark the group sync round complete when any batch in the current round fails to decode, merge, persist the 100-item preview, or verify.
- **FR-018A**: When the sync websocket disconnects after one or more non-terminal batches, SDK MUST keep the latest accepted `cursor` in the current round and attempt same-round resume before failing the round, subject to existing retry and cancellation limits.
- **FR-019**: Server-side group update time MUST be included or mapped into group sync items via protocol `update_at` so SDK can decide whether second-channel data or MUC data is newer; any field change in the group table SHOULD advance `update_at`.
- **FR-020**: SDK MUST compare second-channel group item update time with locally known MUC update time before overwriting group snapshot fields.
- **FR-021**: If the MUC update is newer than the second-channel group item, SDK MUST keep the MUC-derived local value.
- **FR-022**: If the second-channel group item is newer than the local MUC-derived value, SDK MAY update the lightweight group snapshot fields from the second-channel data.
- **FR-023**: Group deletion, destroy, leave, kick, and removal semantics MUST be decided by MUC events rather than inferred from missing second-channel items.
- **FR-023A**: Missing groups in a second-channel full or incremental response MUST NOT remove local joined groups; absence only means this round has no lightweight update for that group.
- **FR-024**: Second-channel group synchronization MUST NOT resurrect a group that has already been removed or destroyed by a newer MUC event.
- **FR-025**: Group sync results MUST represent joined group lightweight details, not full group detail.
- **FR-026**: Group sync results MUST NOT be assumed to contain members, administrators, blocklist, allowlist, announcement, shared files, member attributes, or all group configuration fields.
- **FR-027**: SDK MUST merge second-channel lightweight group details without clearing existing richer local group detail fields that are absent from the sync payload.
- **FR-028**: SDK MUST map protocol `GroupItem` to stable public group summary fields, including at minimum group id, group name, owner, member count, description, avatar, current user role, disabled state, mute-all state, current user mute expiration, remind type, create time, update time, and joined timestamp when available.
- **FR-028A**: `JoinedGroupSummary.remindType` MUST expose `DEFAULT | ALL | AT | NONE`, matching REST/Push API remindType strings; protocol `remind_type` remains numeric and MUST be mapped as `0 -> DEFAULT`, `1 -> ALL`, `2 -> AT`, `3 -> NONE`.
- **FR-029**: SDK MUST normalize protocol naming and invalid draft-field shapes into stable SDK fields; public APIs MUST NOT expose malformed protocol names such as `bool uint64 createAt`.
- **FR-030**: SDK MUST support successful synchronization of an empty joined group list.
- **FR-031**: SDK MUST support multi-batch group synchronization when the server cannot return all joined groups in one response.
- **FR-031A**: SDK MUST ignore response frames whose `header.request_id` does not match the current group sync round request id.
- **FR-032**: SDK MUST explicitly handle the server limit of at most 3000 groups per sync round; groups beyond that limit are not delivered by the server, and SDK MUST NOT silently mark truncated results as complete.
- **FR-032A**: When a group sync round hits the service-side per-round limit, SDK MUST preserve a limited/incomplete state internally so SDK logic and diagnostics can distinguish it from a complete joined-group snapshot; the public `onSyncDataFinished` payload MUST NOT expose local or service limit values.
- **FR-033**: SDK MUST deduplicate repeated group items within a round by group id and the newest accepted update time.
- **FR-034**: SDK MUST detect duplicate, stale, or out-of-order batches enough to avoid corrupting the local snapshot or marking a false successful completion.
- **FR-035**: SDK MUST close or release the sync websocket for the group sync round after the round succeeds, fails, or is cancelled, unless a later plan explicitly defines shared idle reuse semantics.
- **FR-036**: SDK MUST prevent concurrent group sync rounds for the same user; repeated triggers must reuse, merge, or ignore the in-flight task.
- **FR-037**: SDK MUST cancel or invalidate in-flight group sync work when the user logs out, switches account, is kicked, or loses valid authentication.
- **FR-038**: SDK MUST expose unified public sync events named `onSyncDataStart` and `onSyncDataFinished`.
- **FR-039**: `onSyncDataStart` MUST include the synchronized data type, at least `contact` or `group`.
- **FR-040**: `onSyncDataFinished` MUST include the synchronized data type and MUST include diagnostic error information when the round fails.
- **FR-041**: Every started group sync round MUST emit exactly one `onSyncDataStart` and exactly one terminal `onSyncDataFinished`.
- **FR-041A**: Unified sync events MUST be registered at the `ChatClient` level; `ContactManager` and `GroupManager` MUST NOT expose separate sync start/finish registration surfaces for this feature.
- **FR-042**: A group sync round MAY skip network work only when configuration or authentication prerequisites are unavailable; because this phase performs login-time full group sync, SDK MUST NOT skip group sync merely because a previous completion timestamp exists.
- **FR-043**: Contact sync MUST migrate into the unified `onSyncDataStart` / `onSyncDataFinished` event model without losing the failure-stage information required by 024.
- **FR-043A**: SDK MUST remove public `onContactSyncStart` and `onContactSyncFinish` event names in this feature; callers MUST observe contact sync through `ChatClient` level `onSyncDataStart` / `onSyncDataFinished` with `dataType: 'contact'`.
- **FR-044**: Group sync failure details MUST distinguish at least configuration, socket connection, request send, response decode, batch merge, preview persistence, completion metadata, authentication, server limit, and cancellation stages.
- **FR-044A**: SDK MUST decode `ErrorDetail(type=5)` frames and map at least service codes `1601` invalid request parameters, `1602` server group retrieval failure, `1002` authentication failure, and `1003` rate limited into diagnostic `SyncDataError` values with retryability guidance.
- **FR-045**: GroupManager MUST expose `getJoinedGroupList()` as the public local joined-group read method with pure cache-read semantics.
- **FR-046**: `getJoinedGroupList()` MUST NOT implicitly trigger network requests.
- **FR-047**: `getJoinedGroupList()` MUST return the current user's local joined groups as stable `JoinedGroupSummary` business objects, not raw protocol `GroupItem`.
- **FR-048**: `getJoinedGroupList()` MUST return an empty list when no local group data exists.
- **FR-049**: SDK MUST NOT expose a separate `getLocalJoinedGroupSnapshot()` public API; the public API name remains `getJoinedGroupList()`.
- **FR-050**: Group sync local persistence MUST store only a bounded preview of at most 100 lightweight joined groups plus metadata sufficient to determine cache ownership, preview status, server limit state, last successful completion time, and source.
- **FR-050A**: Group sync MUST keep the current login session's runtime joined-group repository capable of holding the full server-delivered result up to 3000 groups without requiring all 3000 groups to be persisted in localStorage.
- **FR-051**: Group sync MUST update GroupManager's internal group repository or equivalent local truth so that later `getGroup(groupId)` and event handling operate on the same known lightweight group snapshot.
- **FR-051A**: `groupManager.getGroup(groupId)` MUST use known lightweight group information from local preview or current session sync when available, MUST NOT implicitly fetch full group detail, and MUST NOT present lightweight sync data as complete `GroupDetail`.
- **FR-051B**: After a successful group sync, SDK MUST patch existing local group-chat `SessionItem` records with joined-group `name` and `avatarUrl` into `conversationName` and `conversationAvatar`; when joined-group `remindType` can be mapped to `SessionListRemindType`, SDK SHOULD patch `SessionItem.remindType` as well and MUST dispatch `onConversationListUpdate` if any session-list item changes.
- **FR-052**: Group sync MUST NOT require fetching every group member or administrator before the joined group list is considered synchronized.
- **FR-053**: SDK MUST log diagnostic information for group sync start, finish, failure, server limit handling, preview persistence, completion metadata recording, and MUC conflict resolution without exposing sensitive authentication data.
- **FR-054**: Public documentation and examples MUST describe `enableSyncData`, ChatClient-level unified sync events, and the distinction between local group list and full group detail.
- **FR-055**: Public documentation and examples MUST remove `enableAutoSyncContacts` and show `enableSyncData: ['contact']` as the only contact auto-sync configuration.

### Key Entities _(include if feature involves data)_

- **SyncDataType**: 自动同步数据类型，当前至少包含 `contact` 与 `group`，用于初始化配置、调度和统一同步事件。
- **SyncDataEvent**: `ChatClient` 级统一同步事件载荷，表示某类数据同步开始或完成，完成事件在失败时携带错误与阶段信息。
- **JoinedGroupPreviewCache**: 当前用户 localStorage 中最多 100 个轻量群组预览，用于冷启动和首屏读取，不代表完整群组真相。
- **GroupSyncCompletionMeta**: 当前用户群组同步完成元信息，记录上次完成时间、预览状态、服务端 3000 上限状态和当前用户归属；本期不作为增量同步检查点。
- **GroupSyncRound**: 一次群组同步会话，包含请求身份、同步起点、批次状态、候选地址、取消状态和最终结果。
- **JoinedGroupRuntimeSnapshot**: 当前登录会话内已同步的最多 3000 个已加入群组轻量快照，供 `GroupManager` 和 `getGroup(groupId)` 使用。
- **JoinedGroupSnapshot**: 当前用户已加入群组可读取快照；同步完成前可来自 100 个本地预览，同步完成后来自当前会话运行时仓库。
- **JoinedGroupSummary**: 第二通道下发并标准化后的轻量群组业务对象，不等价于完整群详情。
- **GroupUpdateClock**: 群组字段更新裁决信息，用于比较 MUC 事件更新时间和第二通道 `update_at`，决定哪个来源可以覆盖本地字段。
- **GroupRemovalState**: 由 MUC 删除、退出、踢出或销毁事件建立的当前会话删除状态，用于防止旧第二通道数据重新恢复已失效群组。
- **JoinedGroupsSyncPage**: 群组同步批次结果，包含群组条目、是否最后一批、续传 cursor 和本轮成功完成时间。

### Assumptions & Dependencies

- 本期目标是登录后自动同步“当前用户已加入群组列表的轻量详情”，不是补齐完整群详情、群成员、管理员或群配置 API。
- 服务端正式协议通过 `GroupItem.update_at` 表达群组轻量字段更新时间，并保证任一会进入增量结果的 group 表字段变更都会推进该字段，以便客户端和 MUC 更新时间裁决覆盖顺序。
- 服务端第二通道协议以用户提供的 `GetJoinedGroupsRequest` / `GetJoinedGroupsResponse` / `ErrorDetail` 为准；SDK 本期仍将自动登录同步固定为全量，不启用服务端增量模式。
- 服务端单轮群组同步最多只给 3000 个群组，超过部分不会下发；客户端必须防截断并记录受限或不完整状态。
- MUC 事件仍是群组删除、销毁、退出和踢出等成员关系失效语义的最终来源。
- 本期不把 3000 个群全部写入 localStorage；只持久化最多 100 个轻量预览用于冷启动首屏，登录后仍每次全量同步本轮最多 3000 个群并写入当前会话运行时仓库。
- 公开 `getJoinedGroupList()` 读取登录同步后的本地群组列表，对外不返回 meta；`preview | synced | limited | incomplete | unknown` 等完整性状态保留在内部 snapshot 和统一同步完成事件 meta 中；不再新增 `getLocalJoinedGroupSnapshot()`。
- 现有 `getGroup(groupId)` 入口保持返回 `Group` facade；本期要求它能绑定已知轻量群组信息，但完整详情仍需调用方显式请求。
- 同步联系人已有 024 实现；本期直接移除 024 的旧 `enableAutoSyncContacts` 配置入口和 `ContactManager` 级 `onContactSyncStart` / `onContactSyncFinish` 事件入口，并统一迁移到 `enableSyncData` 与 `ChatClient` 级 `onSyncDataStart` / `onSyncDataFinished`。

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 在 `enableSyncData` 不包含 `group` 的登录场景中，群组自动同步误触发率为 0。
- **SC-002**: 在 `enableSyncData: ['group']` 的登录场景中，群组自动同步启动成功率达到 100%，前提是同步配置有效。
- **SC-003**: 在首次登录且服务端已加入群组为空的场景中，SDK 100% 完成成功同步闭环并返回空本地群组列表。
- **SC-004**: 在多批次群组同步场景中，当前会话快照完整率为 100%，且完成元信息仅在最后一批成功提交后记录。
- **SC-005**: 在 MUC 更新比第二通道数据更新的场景中，旧第二通道数据反向覆盖新 MUC 状态的次数为 0。
- **SC-006**: 在群删除、退群、被踢和群销毁场景中，已失效群组重新出现在本地已加入列表的次数为 0。
- **SC-007**: 统一同步事件中，100% 的 start/finished 事件都携带正确 `dataType`。
- **SC-008**: 每轮已启动的群组同步都形成一次且仅一次 `onSyncDataStart(group) -> onSyncDataFinished(group)` 终态闭环。
- **SC-009**: 在账号切换、登出或被踢场景中，旧账号群组同步结果污染新账号本地快照的次数为 0。
- **SC-010**: 本地群组读取入口在所有覆盖场景中均不发起网络请求，纯缓存读取符合率为 100%。
- **SC-011**: 在超过 3000 个已加入群组的场景中，SDK 100% 暴露受限或不完整状态，不把服务端截断结果标记为完整快照。
- **SC-012**: localStorage 群组预览持久化数量始终不超过 100 个；登录完成后当前会话可读取服务端本轮下发的最多 3000 个轻量群组。
- **SC-013**: 对本地预览或当前会话同步结果中已知的群调用 `getGroup(groupId)` 时，100% 能读取到已知轻量字段，且不会隐式请求完整详情。
