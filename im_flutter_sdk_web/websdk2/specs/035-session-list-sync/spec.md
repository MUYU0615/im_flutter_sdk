# 功能规格：会话列表同步与 SessionItem

**Feature Branch**: `035-session-list-sync`  
**Created**: 2026-04-30  
**Status**: Draft  
**Input**: 用户需求："重新改造会话列表；漫游复用原有逻辑不改造；好友配置同步参考 024-contact-sync；新增公开类型 SessionItem；保留原先会话列表逻辑，新增新的会话列表，新链路不通时仅会话列表回退旧逻辑，后续其他同步链路仍继续走新体系。"

## References

- 需求文档：`/Users/wangmeng/Downloads/IM重构：SDK+使用独立websocket通道拉取离线消息方案.doc`
- 现有会话 REST 与缓存：`specs/034-conversation-rest-api/spec.md`
- 联系人自动同步：`specs/024-contact-sync/spec.md`
- ChatManager 入口收敛：`specs/031-chat-manager-replace-channel/spec.md`
- 事件系统：`specs/004-event-system/spec.md`
- 本地缓存：`specs/014-local-cache-module/spec.md`

## Clarifications

### Session 2026-04-30

- Q: `SessionItem` 在本期中的定位是什么？ → A: 新增一个公开类型 `SessionItem`，承载“新会话列表”的对外业务对象；旧会话列表 DTO 与逻辑继续保留。
- Q: 新旧会话列表链路是否并存？ → A: 并存；新链路优先，失败时仅本次“会话列表”回退到旧逻辑。
- Q: 回退后是否影响后续好友同步、离线消息或其他新链路？ → A: 不影响；只有会话列表回退，后续其他同步链路仍继续走新体系。
- Q: 漫游消息接口是否改造？ → A: 不改造；继续复用原有漫游拉取接口与语义。
- Q: 私有化配置是否另起一套？ → A: 不另起一套；复用 `024-contact-sync` 已定义的同步链路配置形态。
- Q: `SessionItem` 的会话标识与会话类型字段如何定义？ → A: 对外字段固定为 `conversationId` 与 `conversationType`；`conversationId` 直接复用现有会话 `conversationId` 语义，`conversationType` 固定为 `singleChat | groupChat | chatRoom`。
- Q: 新会话列表公开接口挂在哪一层？ → A: 不新增 `ConversationManager`；继续收口到 `ChatManager`，并在其上提供从缓存读取会话列表的公开接口。
- Q: 新链路失败后的重试策略是什么？ → A: 默认主动刷新会优先尝试新链路；但若同一登录周期内已经确认“服务端不支持新协议”或“环境未配置新链路”，则本登录周期后续读取不再重复探测，直接回退旧逻辑，直到下次重新登录再探测。
- Q: `SessionItem` 还应直接承载哪些业务展示字段？ → A: 除基础会话字段外，还应直接承载群名称、群头像与用户属性，调用方自行决定最终展示方式。
- Q: 会话列表真相是否需要缓存化并保持顺序？ → A: 需要；会话列表必须保存在 SDK 缓存中并维护稳定顺序，新链路成功时按完整快照覆盖本地真相。
- Q: 单聊、群聊、聊天室的展示字段如何组织？ → A: 不再使用 `display` 投影；`SessionItem` 顶层直接提供 `conversationName` 与 `conversationAvatar`，调用方可直接用于会话列表展示。
- Q: `ChatManager` 需要暴露哪些会话列表能力？ → A: 同时提供“读缓存接口”和“主动刷新接口”，命名分别为 `getSessionList` 与 `refreshSessionList`。
- Q: 会话列表同步开始/结束是否需要固定公开回调？ → A: 需要；需提供等价于 `onSyncDataStart({ dataType: 'conversation' })` 与 `onSyncDataFinished({ dataType: 'conversation', error })` 的公开回调语义，其中 `error == nil/undefined` 表示成功，非空表示失败。
- Q: 会话列表同步回调在仓库里采用什么注册风格？ → A: 沿用现有 manager 统一风格，通过 `addEventHandler/removeEventHandler` 注册，不新增独立 delegate setter。
- Q: 会话列表同步公开事件名是否按截图保持不变？ → A: 不再保留独立会话列表同步事件；公开事件统一收敛到 `onSyncDataStart` 与 `onSyncDataFinished`，通过 `dataType: 'conversation'` 区分会话列表同步。
- Q: 同步开始/结束回调的精确触发条件是什么？ → A: `start` 仅在真正发起一次新的 WSS 请求时触发；若命中“已在同步中”并复用现有任务，不重复触发。`finish(success)` 仅在最后一批成功入库、完整快照覆盖成功且 `sessions_last_sync_ts` 更新成功后触发；鉴权失败、网络断开、协议不兼容、被踢下线、服务端不可恢复错误等导致未完成游标推进的场景均触发 `finish(error)`。
- Q: 同步游标模型是否需要区分请求游标与完成游标？ → A: 需要；请求继续携带当前设备的 `last_sync_time`，服务端最后一批返回 `last_sync_finished_ts`，本地仅在最终成功时推进 `sessions_last_sync_ts`。
- Q: 完整快照覆盖的删除语义是什么？ → A: 本次快照中不存在但本地仍存在的会话必须在收敛时删除。
- Q: 会话列表的排序语义是否固定？ → A: 固定；服务端快照顺序按 `pinned_time` 降序、再按 `updated_at` 降序，拆批时置顶会话应优先出现在前序批次，客户端必须保持该排序语义。
- Q: 同步协议级去重与事务边界是否需要固化？ → A: 需要；每个请求带唯一 `request_id`，仅接收当前请求匹配的响应；相同 `request_id + batch` 的重复包直接丢弃；每批次写库必须事务化，若最后一批推进游标失败则该批回滚。
- Q: WSS 同步期间若同时收到 MSync 会话变更事件如何收敛？ → A: 新消息、新会话、删除/退出、置顶/标记/未读、免打扰等变化需按 `.doc` 约定与完整快照收敛，优先保证最终本地真相与更晚更新时间一致。
- Q: 错误处理是否需要复用好友同步错误码语义？ → A: 需要；至少覆盖 `INVALID_TOKEN`、`KICKED`、`RATE_LIMIT`、`SYNC_IN_PROGRESS`、`DATA_VERSION_MISMATCH` 等分支，并约定对应重试、回退与清游标策略。
- Q: `remindType` 是否复用 Push/REST 字符串口径？ → A: 是；保留 session-list 专用公开类型名，但字面值固定复用 `DEFAULT | ALL | AT | NONE`，与 Push/REST remindType 保持一致。
- Q: `SessionListRemindType` 的格式是否与 `session_type` 一样？ → A: 一样；协议层继续使用数值枚举，SDK 对外转换为稳定的公开枚举，不直接把协议数字暴露给业务层。
- Q: 若同一时刻重复调用主动刷新接口，返回行为是什么？ → A: 复用当前在途同步任务，返回同一个 Promise，不重复发起新的 WSS 请求，也不重复触发开始回调。
- Q: `SessionListRemindType` 的对外枚举值名如何定义？ → A: 固定为 `DEFAULT | ALL | AT | NONE`，与 Push/REST remindType 保持一致。
- Q: `lastMessage` 对外公开哪些字段？ → A: `lastMessage` 必须符合当前消息结构，至少包含 `msgServerId`、`from`、`to`、`sender`、`timestamp`、`body`；并尽可能补充 `conversationId`、`conversationType`、`type`、`direct`，实时消息 patch 可补充 `status`；`body` 内不得再携带 `type` 字段。
- Q: 服务端未返回 `lastMessage.to` 时如何处理？ → A: SDK 必须从服务端 `from.name` 截取 `_` 后的用户 ID 作为 `from/sender.userId`，并结合 `conversationId` 推断 `to`；单聊 `conversationId` 是对方 userId，若 `from` 等于当前用户则 `to=conversationId`，否则 `to=当前用户`；群聊/聊天室 `to=conversationId`。
- Q: `readReceipt` 与 `pinnedTime` 是否继续作为公开字段？ → A: 不继续；`readReceipt` 改名为 `readAt`，`pinnedTime` 改名为 `pinnedTimestamp`。
- Q: 同步回调在 TypeScript 中采用什么签名？ → A: `onSyncDataStart?: (payload: SyncDataStartPayload) => void`，`onSyncDataFinished?: (payload: SyncDataFinishedPayload) => void`。
- Q: `getSessionList()` 与 `refreshSessionList()` 的网络语义是什么？ → A: `getSessionList()` 纯读缓存、同步返回；`refreshSessionList()` 才主动触发网络同步并返回 Promise。

## User Scenarios & Testing _(mandatory)_

### User Story 1 - 登录后优先同步新会话列表 (Priority: P1)

作为 SDK 使用者，我希望登录成功后 SDK 优先尝试通过独立同步链路把当前设备对应的最新会话列表快照拉下来，并在成功后写回本地，这样我一进入业务首页就能拿到更完整、更接近服务端真相的会话列表。

**Why this priority**: 会话列表是聊天首页的主入口，登录后是否能尽快得到最新列表直接影响用户能否看到最近对话、未读数和最新一条消息。

**Independent Test**: 在已存在本地旧会话缓存、服务端存在新增/更新会话的场景下，仅实现本故事也应能验证“登录后先走新会话列表同步，再得到最新快照”的业务价值。

**Acceptance Scenarios**:

1. **Given** 当前账号登录成功且具备新会话列表同步能力，**When** SDK 完成登录后初始化调度，**Then** SDK 必须先发起一次新会话列表同步，再进入后续好友同步和离线消息调度。
2. **Given** 当前设备保存了上一次成功同步的会话列表游标状态，**When** 新会话列表同步开始，**Then** SDK 必须携带当前设备标识与该同步状态向服务端请求当前设备的会话列表快照。
3. **Given** 服务端返回的是分批下发的会话列表快照，**When** SDK 收到全部批次并完成本地覆盖写入，**Then** SDK 才能把本次同步视为成功结束。
4. **Given** 服务端返回“自上次同步以来无变化”，**When** 本轮同步结束，**Then** SDK 仍需形成完整的开始/结束闭环，且不得把本地会话列表误清空。
5. **Given** 本轮同步期间好友同步和漫游消息加载也待执行，**When** SDK 进行调度，**Then** 会话列表同步必须优先，好友同步需在其完成或失败后启动，漫游消息加载优先级最低并排队执行。

---

### User Story 2 - 新会话列表失败时仅回退旧列表逻辑 (Priority: P1)

作为 SDK 使用者，我希望即使新会话列表同步链路不可用，SDK 也只把会话列表这一个能力回退到旧逻辑，而不是让整个登录后同步体系一起退回旧实现，这样我能逐步接入新能力而不放大故障范围。

**Why this priority**: 本期明确要求“仅会话列表回退”，这是灰度发布与私有化兼容的核心约束；如果回退范围失控，会直接破坏 `024-contact-sync` 等已经落地的新链路。

**Independent Test**: 在“缺少同步配置”“服务端明确不支持新协议”“新会话列表建连/鉴权失败”三类场景下，仅实现本故事也应能验证“旧会话列表继续可用，其他同步链路不被拖回旧体系”。

**Acceptance Scenarios**:

1. **Given** 当前环境未提供新会话列表同步所需配置，**When** 登录完成，**Then** SDK 必须仅对会话列表能力回退旧逻辑，并记录可诊断日志。
2. **Given** 服务端明确声明不支持新会话列表协议，**When** SDK 尝试新链路，**Then** SDK 必须结束本轮新会话列表同步并切回旧会话列表逻辑，不得阻断后续好友同步与离线消息调度。
3. **Given** 新会话列表同步在建连、鉴权或协议处理阶段失败且尚未成功提交完整快照，**When** SDK 结束本轮同步，**Then** SDK 必须把本次会话列表能力切回旧逻辑，并通过失败事件与日志暴露原因。
4. **Given** 新会话列表同步已回退到旧逻辑，**When** 后续好友同步、资料同步或离线消息拉取开始，**Then** 这些链路仍必须继续走各自的新体系，不得被整体回退。
5. **Given** 服务端返回 `RATE_LIMIT`、`SYNC_IN_PROGRESS` 或 `DATA_VERSION_MISMATCH` 等错误，**When** SDK 处理本轮会话列表同步失败，**Then** SDK 必须按约定执行退避重试、复用在途结果或清游标重拉，而不是简单吞错。

---

### User Story 3 - 对外暴露稳定的 SessionItem 业务对象 (Priority: P2)

作为 SDK 使用者，我希望新会话列表通过稳定的 `SessionItem` 业务对象对外暴露，并在顶层直接提供 `conversationName`、`conversationAvatar` 等展示字段，同时仅保留轻量展示属性，这样我能逐步迁移 UI，而不需要直接依赖内部缓存或服务端原始字段。

**Why this priority**: 新链路要想真正落地，必须给业务提供一个可长期依赖的公开对象模型；否则会继续把“会话列表展示逻辑”散落在 demo 和业务层。

**Independent Test**: 在新会话列表成功返回的前提下，仅实现本故事也应能验证调用方可通过 `SessionItem` 获得稳定字段，并在单聊、群聊、聊天室场景下通过 `conversationName` 与 `conversationAvatar` 读取展示信息。

**Acceptance Scenarios**:

1. **Given** 调用方读取新会话列表，**When** SDK 返回结果，**Then** 每一项都必须符合 `SessionItem` 的公开结构，而不是原样透传服务端原始字段。
2. **Given** `SessionItem` 表示的是单聊会话，**When** 当前会话内存在联系人快照或用户资料缓存，**Then** `SessionItem` 必须按统一优先级给出可展示的昵称、备注和头像投影。
3. **Given** `SessionItem` 表示的是群聊或聊天室会话，**When** 当前会话存在群名称、群头像或其他轻量展示属性信息，**Then** `SessionItem.conversationName` 与 `SessionItem.conversationAvatar` 必须统一承载这些字段，供调用方直接展示。
3a. **Given** 登录后的群组自动同步返回当前用户已加入群组的名称、头像或可映射的免打扰类型，**When** 本地 session-list 中已存在对应群聊会话，**Then** SDK 必须更新该会话的 `conversationName` / `conversationAvatar`，可映射时同步更新 `remindType`，并在发生变化时触发 `onConversationListUpdate`。
4. **Given** 新旧会话列表在同一版本中并存，**When** 老调用方继续使用旧会话列表 API，**Then** SDK 不得强迫其迁移到 `SessionItem`，且旧返回结构与旧事件语义必须保持可用。
5. **Given** 新会话列表链路已经回退，**When** 调用方读取新会话列表，**Then** SDK 仍必须返回 `SessionItem` 结构，只是其底层来源改为旧会话列表逻辑映射结果。
6. **Given** 调用方主动触发一次新会话列表刷新，**When** 同步开始与结束，**Then** SDK 必须通过 `ChatManager.addEventHandler/removeEventHandler` 订阅到等价于 `onSyncDataStart({ dataType: 'conversation' })` 与 `onSyncDataFinished({ dataType: 'conversation', error })` 的公开回调。
7. **Given** 在同一登录周期内已经确认服务端不支持新协议，**When** 调用方再次主动刷新会话列表，**Then** SDK 必须直接回退旧逻辑，不再重复探测新链路或重复报错。
8. **Given** 本轮同步过程中 MSync 长连接又收到新消息、会话删除或置顶/未读变化，**When** WSS 快照同步完成，**Then** `SessionItem` 最终结果必须与完整快照和更晚更新时间的本地事实一致，不得出现旧数据反向覆盖新数据。

### Edge Cases

- 当前账号首次登录且既没有旧会话缓存，也拿不到新会话列表快照时，SDK 仍需返回空列表而不是挂起加载态。
- 新会话列表同步过程中账号登出、切换账号或连接失效时，SDK 需终止当前用户的同步并防止旧用户结果污染新用户。
- 服务端分批返回快照时如果发生重复批次、乱序批次或中途断开，SDK 不得提交半成品列表为“成功结果”。
- 当前环境缺少新同步配置，但旧会话列表逻辑可用时，SDK 应仅对当前登录周期直接回退，不得持续阻塞当前主路径；重新登录后才允许再次探测新链路。
- 当前登录周期内如果已经确认服务端不支持新协议或环境未配置新链路，后续主动刷新必须直接走旧逻辑，不得重复探测并持续报错；重新登录后才允许再次探测。
- 联系人快照存在但联系人资料缓存已淘汰时，`SessionItem` 的展示字段仍需按 `024-contact-sync` 的不完整缓存语义降级，而不是拼出错误的昵称/备注。
- 同一登录周期内若新会话列表同步已经进行中，不得并发再启动第二轮同类同步。
- 会话列表完整快照覆盖后，SDK 不得打乱服务端确认的排序语义；旧链路映射到 `SessionItem` 时也不得破坏当前缓存顺序。
- 若本轮同步期间被其他设备踢下线或 token 失效，SDK 必须立即终止当前任务、保留旧游标、触发失败回调，并等待重新登录后再发起完整同步。
- 应用在同步过程中被杀或异常恢复时，SDK 仅可保留数据库中的最终成功游标，不得保存半包状态或错误推进游标。
- 仅免打扰状态发生变化时，不应单独触发一次新的会话列表同步；但下一次因其他变更触发同步时，`remindType` 仍需覆盖本地值。
- 若响应 `request_id` 与当前在途请求不匹配，或同一 `request_id + batch` 重复到达，SDK 必须丢弃该响应，不得重复写库。

## Test Layer Requirements _(mandatory)_

### Unit Tests

- Coverage goals: `SessionItem` 公开字段归一化、`conversationId` / `conversationType` 命名映射、`conversationName` / `conversationAvatar` 展示字段、`lastMessage.from/to/sender` 推断、`readAt` / `pinnedTimestamp` / `remindType` 字段映射、缓存读取接口、主动刷新接口、`addEventHandler/removeEventHandler` 下的同步回调语义、同一 Promise 复用、请求去重、批次事务回滚、回退决策、快照覆盖删除语义、账号切换清理与错误码分支。
- Planned location:
  - `tests/unit/chat-client/session-list-sync.test.ts`
  - `tests/unit/cache/session-list-cache.test.ts`
  - `tests/unit/managers/chat-manager-session-item.test.ts`
  - `tests/unit/session-sync/session-item-normalizer.test.ts`
- Not applicable rationale: N/A

### Integration Tests

- Coverage goals: 登录后“新会话列表同步 -> 成功提交/失败回退 -> 后续 024 链路继续执行”的协作链路；新旧会话列表并存时的读取、主动刷新与回调闭环；按用户/设备隔离的同步状态推进；缓存顺序与完整快照覆盖/删除一致性；WSS 同步与 MSync 事件并发时的最终收敛。
- Planned location:
  - `tests/integration/session-list-sync/session-list-sync.integration.test.ts`
  - `tests/integration/session-list-sync/session-list-fallback.integration.test.ts`
  - `tests/integration/session-list-sync/session-item-contact-projection.integration.test.ts`
- Not applicable rationale: N/A

### E2E Tests

- Coverage goals: 浏览器 demo 登录后读取新会话列表、打印同步开始/结束日志、回退时仍能展示列表、`SessionItem` 关键展示字段可见，以及不会破坏现有旧会话列表调试面板与现有漫游消息入口。
- Planned location:
  - `tests/e2e/session-list.spec.ts`
  - 复用现有 `tests/e2e/conversation-rest.spec.ts` 进行兼容回归
- Not applicable rationale: N/A

### Gate Impact

- Required gates:
  - `npm run test:gate:pr`
  - `npm run test:gate:nightly`
  - `npm run test:gate:release`
- Validation notes:
  - PR gate 必须阻断：`SessionItem` 归一化、回退决策、登录后新旧链路协作的单测与集成测试。
  - Nightly / Release gate 必须追加浏览器 E2E，验证 demo 主路径能读取新会话列表且旧逻辑未被破坏。

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: 系统 MUST 在登录成功后优先尝试一次“新会话列表同步”，并将该步骤排在后续好友同步与离线消息调度之前。
- **FR-002**: 系统 MUST 新增公开业务对象 `SessionItem`，用于承载新会话列表的对外结果。
- **FR-003**: 系统 MUST 保留现有旧会话列表逻辑、旧会话列表 DTO 与现有公开调用方式，不得因引入 `SessionItem` 破坏老调用方。
- **FR-004**: 系统 MUST 在 `ChatManager` 上为新会话列表提供稳定的公开读取入口，使调用方可以直接获得 `ReadonlyArray<SessionItem>` 或等价的列表结果。
- **FR-004A**: `getSessionList()` MUST 作为纯读缓存接口，同步返回当前缓存中的 `ReadonlyArray<SessionItem>`，不得隐式触发网络请求。
- **FR-005**: `SessionItem` MUST 至少表达会话标识、会话类型、未读数、最后一条消息摘要、最后一条消息时间、置顶状态、置顶时间、会话标记，以及统一的展示投影信息。
- **FR-006**: 当 `SessionItem` 表示单聊会话时，系统 MUST 复用 `024-contact-sync` 的联系人快照与资料缓存语义，按统一优先级投影备注、昵称、头像等展示字段。
- **FR-007**: 系统 MUST 对新会话列表同步维护独立于旧会话列表逻辑的同步状态，并按用户与设备维度隔离。
- **FR-008**: 系统 MUST 继续使用设备标识与该设备对应的上次同步时间作为新会话列表同步的状态依据。
- **FR-008A**: 请求 MUST 携带当前设备 `resource` 与 `last_sync_time`；服务端最终成功批次返回的 `last_sync_finished_ts` MUST 作为本地 `sessions_last_sync_ts` 的唯一推进依据。
- **FR-009**: 若服务端按批次返回会话列表快照，系统 MUST 支持按批接收并在确认完整快照后再提交本地覆盖结果。
- **FR-010**: 系统 MUST 只在完整快照成功写回本地且同步状态成功推进后，才将本轮新会话列表同步视为成功。
- **FR-011**: 系统 MUST 提供“新会话列表同步开始”和“新会话列表同步结束”的公开事件语义，其中结束事件需区分成功与失败。
- **FR-011A**: `onSyncDataStart({ dataType: 'conversation' })` 等价回调 MUST 仅在真正发起一次新的 WSS 同步请求时触发；命中“已在同步中”并复用现有任务时不得重复触发。
- **FR-011B**: `onSyncDataFinished({ dataType: 'conversation', error })` 等价回调 MUST 仅在本轮同步形成终态时触发；成功分支要求“最后一批成功入库 + 完整快照覆盖成功 + `sessions_last_sync_ts` 更新成功”，失败分支需覆盖鉴权失败、网络断开、协议不兼容、被踢下线、不可恢复服务端错误等场景。
- **FR-011C**: 新会话列表同步事件 MUST 沿用现有 manager 事件注册模型，通过 `ChatManager.addEventHandler/removeEventHandler` 暴露，不新增独立 delegate setter。
- **FR-011D**: `ChatManager` 暴露的新会话列表同步事件 MUST 复用统一同步事件字段名 `onSyncDataStart` 与 `onSyncDataFinished`，并通过 `dataType: 'conversation'` 标识会话列表同步。
- **FR-011E**: `onSyncDataStart` 的公开签名 MUST 为 `(payload: SyncDataStartPayload) => void`，`onSyncDataFinished` 的公开签名 MUST 为 `(payload: SyncDataFinishedPayload) => void`。
- **FR-012**: 当本轮新会话列表同步失败、被终止或未完成同步状态推进时，系统 MUST 通过结束事件与日志暴露错误信息。
- **FR-013**: 当环境未配置新会话列表同步所需同步通道配置时，系统 MUST 仅对会话列表能力回退到旧逻辑。
- **FR-014**: 当服务端明确声明不支持新会话列表协议时，系统 MUST 仅对会话列表能力回退到旧逻辑。
- **FR-014A**: 当同一登录周期内已确认服务端不支持新会话列表协议时，后续 `refreshSessionList` 调用 MUST 直接回退旧逻辑，不再重复探测新链路；下次重新登录后才允许再次探测。
- **FR-015**: 当新会话列表同步在建连、鉴权、协议处理或快照提交前失败时，系统 MUST 仅对会话列表能力回退到旧逻辑。
- **FR-016**: 会话列表回退 MUST 不影响好友同步、资料同步、离线消息拉取或其他后续同步链路继续使用各自的新体系。
- **FR-017**: 当新会话列表已经回退到旧逻辑时，系统 MUST 仍然向调用方返回 `SessionItem` 结构，只是底层来源改为旧会话列表映射结果。
- **FR-018**: 漫游消息读取接口与对外 API MUST 保持不变，不得因为本期会话列表改造改变调用方式。
- **FR-019**: 系统 MUST 复用 `024-contact-sync` 已定义的同步链路配置形态，不得为新会话列表再引入一套平行的私有化配置字段。
- **FR-020**: 新会话列表同步结果写库流程 MUST 具备幂等性，重复批次或重复触发不得造成脏数据、重复项或错误未读数。
- **FR-020A**: 每个新会话列表 WSS 请求 MUST 生成唯一 `request_id`；客户端仅接收与当前在途请求匹配的响应。
- **FR-020B**: 若同一 `request_id + batch` 重复到达，系统 MUST 丢弃重复包而不重复写库。
- **FR-020C**: 每个批次到达后 MUST 立即以事务方式写库；若最后一批推进 `sessions_last_sync_ts` 失败，则该批事务 MUST 回滚。
- **FR-021**: 当账号登出、切换账号或当前用户状态失效时，系统 MUST 终止当前用户的新会话列表同步，并清理与该用户绑定的运行时同步状态。
- **FR-022**: 若单聊会话所依赖的联系人快照或资料缓存不完整，`SessionItem` MUST 以可诊断、可降级的方式返回展示字段，而不是伪造完整展示信息。
- **FR-023**: 系统 MUST 在同一登录周期内避免并发启动多轮新会话列表同步。
- **FR-024**: 系统 MUST 在新旧会话列表共存阶段保持 demo、SDK 内部调用与外部调用都可明确区分“旧会话列表能力”和“新会话列表能力”。
- **FR-025**: 系统 MUST 将会话列表真相持久保存在 SDK 缓存中，并维护稳定、可重复读取的顺序语义。
- **FR-026**: 系统 MUST 在 `ChatManager` 上提供从缓存读取会话列表的公开接口 `getSessionList()`，返回 `ReadonlyArray<SessionItem>` 或等价结构。
- **FR-027**: 当调用方主动触发 `refreshSessionList()` 时，系统 MUST 优先尝试新链路；但若同一登录周期已确认“服务端不支持新协议”或“环境未配置新链路”，则 MUST 直接回退旧逻辑，不再重复探测，直到下次重新登录。
- **FR-028**: 新会话列表成功提交时，系统 MUST 按完整快照覆盖本地缓存，并保留服务端确认的会话顺序语义。
- **FR-028A**: 完整快照覆盖 MUST 删除本地存在但本次快照中不存在的会话。
- **FR-028B**: 服务端快照顺序 MUST 按 `pinned_time` 降序再按 `updated_at` 降序；若拆批，置顶会话 MUST 优先出现在前序批次，客户端不得打乱该顺序。
- **FR-029**: 系统 MUST 将单聊、群聊、聊天室的展示字段统一归一到 `SessionItem.conversationName` 与 `SessionItem.conversationAvatar`，不得再暴露 `display` 投影。
- **FR-030**: `SessionItem` MUST 不再额外暴露与会话展示重复的 `profile` 或 `display` 公开字段；调用方必须能直接读取顶层 `conversationName` 与 `conversationAvatar`。
- **FR-031**: 系统 MUST 在 `ChatManager` 上同时提供“读取缓存会话列表”的公开接口 `getSessionList()` 与“主动刷新会话列表”的公开接口 `refreshSessionList()`。
- **FR-031A**: `refreshSessionList()` MUST 作为主动网络同步接口返回 `Promise<ReadonlyArray<SessionItem>>` 或等价 Promise 结果。
- **FR-032**: 系统 MUST 提供等价于 `onSyncDataStart({ dataType: 'conversation' })` 的公开回调，在每次新会话列表同步开始时触发。
- **FR-033**: 系统 MUST 提供等价于 `onSyncDataFinished({ dataType: 'conversation', error })` 的公开回调，在每次新会话列表同步结束时触发；`error` 为空表示成功，非空表示失败。
- **FR-034**: `SessionItem` MUST 公开表达 `readAt` 与 `remindType` 等会话核心状态；其中 `readAt` 对外语义固定为时间戳，`remindType` MUST 使用 session-list 专用公开枚举；仅 `remindType` 变化本身不得单独触发新的会话列表同步，但后续同步返回时必须覆盖本地值。
- **FR-034A**: `SessionItem.conversationType` 与 `SessionItem.remindType` MUST 采用同一分层策略：协议层保留数值枚举，SDK 对外转换为稳定的公开字符串枚举。
- **FR-034B**: `SessionListRemindType` 的公开枚举值 MUST 固定为 `DEFAULT`、`ALL`、`AT`、`NONE`，与 REST/Push API 的 remindType 字符串保持一致。
- **FR-034C**: 群组自动同步结果中的 `remindType` 若可映射到 `SessionListRemindType`，SDK SHOULD 用其刷新已存在群聊 `SessionItem.remindType`；该刷新不得单独发起新的会话列表同步，但若本地会话列表字段发生变化，必须触发 `onConversationListUpdate`。
- **FR-035**: 会话列表同步与 Session 内消息加载 MUST 复用同一组 WSS 私有化配置，并通过业务类型区分；SDK 登录成功后直接发起 WSS 同步，不引入额外 REST 预检步骤。
- **FR-036**: WSS 连接 MAY 复用，但单条连接上 MUST 串行处理一个同步请求；会话列表同步任务完成后连接可关闭，空闲连接可按服务端 30 秒策略自动关闭。
- **FR-037**: 登录后的调度策略 MUST 满足：会话列表同步优先，好友同步在其完成或失败后启动，Session 内消息加载优先级最低并排队执行；某一同步失败不得阻塞另一同步，但日志 MUST 记录排队时延与失败原因。
- **FR-038**: WSS 同步期间若 MSync 长连接收到新消息、删除/退出、新会话创建、置顶/标记/未读或免打扰变化，系统 MUST 按更晚更新时间与完整快照统一收敛，避免旧快照覆盖更新本地事实。
- **FR-039**: 错误处理 MUST 复用好友同步错误语义，至少覆盖 `INVALID_TOKEN`、`KICKED`、`RATE_LIMIT`、`SYNC_IN_PROGRESS`、`DATA_VERSION_MISMATCH`，并分别支持终止、被踢处理、指数退避重试、复用在途结果或清游标重拉。
- **FR-040**: 应用在同步过程中被杀或异常恢复时，系统 MUST 清理内存态请求上下文，仅保留数据库中的最终成功游标，不得保存半包状态。
- **FR-041**: Demo MUST 展示新会话列表读取结果，并打印 `onSyncDataStart` 与 `onSyncDataFinished({ dataType: 'conversation', error })` 等价日志；现有漫游消息演示入口必须保持可用。
- **FR-042**: 文档交付 MUST 包含私有化 `syncDataWSHost` / `syncDataWSPort` 配置说明、登录后固定执行会话列表同步说明，以及会话列表同步回调的 API 说明。
- **FR-043**: 若 `refreshSessionList()` 在同一时刻被重复调用，系统 MUST 复用当前在途同步任务并返回同一个 Promise，不得并发发起第二个 WSS 请求。
- **FR-044**: `SessionItem` MUST 至少包含 `conversationName` 与 `conversationAvatar` 两个稳定公开展示字段；无法获得头像时 `conversationAvatar` MAY 为空字符串或 `undefined`，但不得通过 `display.avatarUrl` 暴露。
- **FR-045**: `SessionItem.lastMessage` MUST 符合当前消息结构，至少包含会话列表展示所需最小字段：`msgServerId`、`from`、`to`、`sender`、`timestamp`、`body`，并 SHOULD 在可获得时补充 `conversationId`、`conversationType`、`type`、`direct`；`status` 仅在链路可可靠提供时补充，不得伪造；不得透传完整消息对象，且 `body` 内不得包含 `type` 字段。
- **FR-045A**: `SessionItem.lastMessage.from` 与 `sender.userId` MUST 使用 userId；当服务端返回 `from.name` 时，SDK MUST 截取 `_` 后面的内容作为 userId。
- **FR-045C**: `SessionItem.lastMessage.sender` MUST 使用 `Sender` 对象，至少包含 `userId`，并在联系人同步或订阅用户资料 notify 后按最新联系人资料或用户资料刷新 `nickname` 与 `avatarUrl`。
- **FR-045B**: 当服务端未返回 `lastMessage.to` 时，SDK MUST 根据 `from` 与 `session_id` 推断：单聊会话的 `session_id` 为对方 userId，若 `from` 等于当前用户则 `to = conversationId`，否则 `to = 当前用户 userId`；群聊与聊天室的 `to = conversationId`。

### Key Entities _(include if feature involves data)_

- **SessionItem**: 新会话列表的公开业务对象，至少包含：
  - `conversationId`: 会话主键标识
  - `conversationType`: 会话类型（`singleChat` / `groupChat` / `chatRoom`）
  - `unreadCount`: 当前未读数
  - `lastMessage`: 最后一条消息摘要
  - `lastMessageAt`: 最后一条消息时间
  - `isPinned` / `pinnedTimestamp`: 置顶状态与时间
  - `marks`: 会话标记集合
  - `readAt`: 当前会话读到的位置或等价公开状态
  - `remindType`: 会话免打扰状态，使用 session-list 专用公开枚举
  - `conversationName` / `conversationAvatar`: 会话顶层展示名称与头像，可覆盖单聊、群聊、聊天室所需展示信息
- **SessionListRemindType**: session-list 专用提醒类型枚举，对应协议的“不设置免打扰 / 全部提醒 / 仅 mention / 全量免打扰”语义，并与 Push/REST remindType 字符串保持一致。
  - 协议层数值映射：`0 | 1 | 2 | 3`
  - SDK 对外公开：`DEFAULT | ALL | AT | NONE`，不直接暴露协议数字
- **SessionMessageSnippet**: `SessionItem.lastMessage` 使用的轻量消息摘要，至少包含 `msgServerId`、`from`、`to`、`sender`、`timestamp`、`body` 六个会话列表展示所需最小字段；可包含 `conversationId`、`conversationType`、`type`、`status`、`direct` 等与 `Message` 对齐的字段；`sender` 为 `Sender` 对象，至少包含 `userId`，可包含 `nickname` 与 `avatarUrl`；`body` 内不得包含 `type` 字段。
- **SessionListSnapshot**: 当前用户、当前设备下的新会话列表完整快照，是一次同步成功后写入本地的最终列表真相。
- **SessionSyncCheckpoint**: 新会话列表同步检查点，至少包括请求使用的 `last_sync_time`、服务端返回的 `last_sync_finished_ts` 以及本地最终持久化的 `sessions_last_sync_ts`。
- **SessionSyncRequestContext**: 单次 WSS 同步请求上下文，至少包含 `request_id`、用户/设备标识、批次去重信息与终态控制信息；该上下文仅保存在运行时内存，不跨应用恢复持久化。

## Assumptions & Dependencies

- 服务端可以按“当前用户 + 当前设备 resource + 上次同步时间”返回最新会话列表快照，且可能采用分批下发。
- 现有旧会话列表逻辑在本期内继续保留，作为新会话列表不可用时的兼容回退路径。
- `024-contact-sync` 已定义的“按用户隔离缓存、缓存完整性语义、同步链路配置形态”可以被新会话列表复用，但新会话列表的同步状态与联系人同步状态彼此独立。
- 漫游消息拉取接口继续有效，且本期不要求更改其公开入参与返回结构。
- 当前 demo 会同时承载旧会话列表调试面板与新会话列表展示入口，用于迁移期并行验证。
- 好友同步定义的错误码语义、WSS 配置与设备 `resource` 约束可被本方案直接复用。

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 在支持新会话列表同步的环境中，登录后 100% 会先触发新会话列表同步，再进入后续好友同步与离线消息调度。
- **SC-002**: 在“无配置 / 服务端不支持 / 新链路失败”三类回退场景中，100% 仅回退会话列表能力，后续其他同步链路不受影响。
- **SC-003**: 在服务端存在会话变化的场景下，SDK 能在一次登录流程内把最新会话列表快照写回本地，列表遗漏率和重复率均为 0。
- **SC-004**: `SessionItem` 对外字段在新链路成功与旧链路回退两种模式下保持结构一致，调用方无需根据来源分支适配两套对象模型。
- **SC-005**: 单聊 `SessionItem` 的展示字段在联系人快照完整场景下命中正确备注/昵称/头像的正确率达到 100%，在缓存不完整场景下不输出伪造展示值。
- **SC-006**: 当新会话列表同步失败时，开始/结束事件与日志都能给出稳定的可诊断结果，错误暴露缺失率为 0。
- **SC-007**: 在重复包、批次写库失败、网络断开、被踢下线和应用异常恢复场景下，`sessions_last_sync_ts` 错误推进率为 0。
- **SC-008**: 在服务端完整快照删除会话、置顶重排和 `remindType` 回填场景下，本地缓存与 `SessionItem` 读取结果和服务端顺序/字段语义保持 100% 一致。
