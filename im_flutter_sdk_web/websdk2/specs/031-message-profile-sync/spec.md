# 功能规格：消息驱动资料同步与群名片补齐

**Feature Branch**: `031-message-profile-sync`  
**Created**: 2026-04-20  
**Status**: Draft  
**Input**: 用户需求："通过消息更新用户资料。`senderInfo` 由接收侧在收到消息后从缓存或 localStorage 中拼装，不作为消息真值下发；服务端可改 mSync proto，时间戳使用秒级。群名片更新后需要发布事件，由应用层订阅后自行决定是否刷新历史消息，但会话列表与成员卡片需要展示最新值。存储继续复用当前缓存与 localStorage 过期策略，保留自己、联系人和最近活跃用户，其余按 TTL/LRU 淘汰。用户资料补拉只在收到消息后进入队列，不立即拉取；积攒一批，或 7 秒内没有凑够一批也需要主动拉取。群名片只能一个群一个群拉。补拉失败不立即重试，但必须打印错误日志。写 spec 时参考现有用户信息、群组、聊天室等 spec，并兼容小程序环境，例如不能依赖浏览器 `URL` 对象。"

**Reference**:

- `specs/014-local-cache-module/spec.md`
- `specs/018-cross-platform-adapter/spec.md`
- `specs/023-test-layer-strategy/spec.md`
- `specs/024-contact-sync/spec.md`
- `specs/025-contact-manager-api/spec.md`
- `specs/026-user-info-manager-api/spec.md`
- `specs/027-group-manager-api/spec.md`
- `specs/028-chatroom-manager-api/spec.md`
- `specs/030-wechat-miniapp-demo/spec.md`
- `specs/004-event-system/spec.md`
- `specs/012-log-report/spec.md`

## Clarifications

### Session 2026-04-20

- Q: 资料版本字段放在哪里？ → A: 放入 `MessageBody` 内部协议字段。
- Q: 这些字段是否进入 SDK 公开 `Message` 模型？ → A: 不进入公开消息模型，只作为内部协议字段使用。
- Q: `senderInfo` 如何收敛？ → A: 由接收侧在收到消息后基于内存缓存、localStorage 与后续补拉结果拼装，不作为消息真值持久化。
- Q: 当本地已有旧的 `senderInfo`，但消息里的版本戳显示它已过期时，当前消息应先展示什么？ → A: 先展示本地已有的旧 `senderInfo`，待补拉成功后再由应用层感知更新。
- Q: 当本地没有任何 `senderInfo`，且补拉失败时，消息长期应如何兜底展示？ → A: 保持最小身份信息展示，例如 `userId`，直到后续消息或补拉成功带来新资料。
- Q: 补拉成功后，SDK 是否直接回填当前内存中的消息对象 `senderInfo`？ → A: 不直接回填；SDK 只更新缓存并派发事件，由应用层自行决定是否重建消息视图。
- Q: 用户资料版本时间戳如何取值？ → A: 使用秒级时间戳；当前用户发送消息时必须使用服务端返回的真实更新时间。
- Q: 当前用户自己更新资料后，本端后续发送消息如何保证带最新版本？ → A: 本端必须立即更新运行时缓存与持久化缓存，并保证随后发出的下一条消息携带最新的 `userInfoUpdateTime`。
- Q: 当前用户自己主动更新自己的资料后，是否一定触发 `onSelfUserInfoUpdated`？ → A: 是，必须触发，不允许静默只更新缓存。
- Q: 当前用户自己更新某个群内的群名片后，本端后续发送群消息如何保证带最新版本？ → A: 本端必须立即更新该 `groupId + userId` 的运行时缓存与持久化缓存，并保证随后在该群发出的下一条群消息携带最新的 `namecardUpdateTime`。
- Q: 当前用户自己更新自己的群名片后，是否触发 `onUserGroupNamecardUpdated`？ → A: 不触发；只更新本端缓存，并保证后续该群消息携带最新 `namecardUpdateTime`。
- Q: 群名片更新后 SDK 是否主动刷新历史消息？ → A: 不主动刷新；SDK 仅发布事件，由应用层决定是否回刷历史消息。
- Q: 群名片更新事件如何对外暴露？ → A: 通过 `onUserGroupNamecardUpdated(groupId: string, userId: string, namecard: string)` 单用户通知，不额外透出 `namecardUpdateTime`。
- Q: `onUserGroupNamecardUpdated` 是否通知当前用户自己的群名片变化？ → A: 不通知；只触发他人的群名片变更。
- Q: 用户资料补拉策略如何收敛？ → A: 只在收到消息后进入待拉队列，不立即请求；积攒一批，或 7 秒窗口到期后主动拉一次。
- Q: 用户资料批量补拉何时立即触发？ → A: 设一个固定批量门槛，达到门槛立即拉取；未达到门槛时由 7 秒窗口兜底触发。
- Q: 用户资料批量补拉的固定门槛是多少？ → A: 20。
- Q: 用户资料补拉窗口时间是否写死？ → A: 不写死；默认 7 秒，但需要支持独立配置。
- Q: 同一个 `userId` 在同一窗口内被多条消息重复命中时如何收敛？ → A: 只保留一条待补拉记录，并以最大的 `userInfoUpdateTime` 作为目标版本。
- Q: 用户资料批量补拉若只返回部分用户成功结果时如何处理？ → A: 成功返回的用户正常写回缓存并派发事件；未返回的用户记错误日志，等待下一条消息或下一个窗口再次触发。
- Q: 用户资料补拉成功后是否也要发更新事件？ → A: 要，且按批量事件语义发给应用层。
- Q: 用户资料更新事件如何对外暴露？ → A: 对外事件使用 `onSelfUserInfoUpdated(userInfo: UserInfo)` 与 `onUserInfoUpdated(userInfos: Array<UserInfo>)`。
- Q: 当前用户自己的资料更新如何通知？ → A: 通过 `onSelfUserInfoUpdated(userInfo: UserInfo)` 通知，回调完整 `UserInfo`。
- Q: 其他用户的资料补拉成功后如何通知？ → A: 通过 `onUserInfoUpdated(userInfos: Array<UserInfo>)` 通知，回调他人资料的完整 `UserInfo[]`。
- Q: `onUserInfoUpdated` 是否包含当前用户自己？ → A: 不包含；当前用户自己只走 `onSelfUserInfoUpdated`。
- Q: 若同一轮用户资料补拉同时命中当前用户自己和他人，事件如何派发？ → A: 当前用户自己单独走 `onSelfUserInfoUpdated`，他人聚合走 `onUserInfoUpdated`；同一轮中这两个回调都可以发生。
- Q: 用户资料事件是否需要判断字段值真的变化后再触发？ → A: 不需要；只要补拉成功并写回缓存，就全部触发。
- Q: 用户资料事件是否需要透出 `userInfoUpdateTime`？ → A: 不需要额外作为事件字段设计；事件直接沿用 `UserInfo` 语义，`userInfoUpdateTime` 继续作为 SDK 内部版本比较依据。
- Q: 群名片补拉策略如何收敛？ → A: 同一群内保持串行处理，不做跨群合批；不同群之间允许并行执行。
- Q: 群名片命中后是立即拉取还是先进入窗口队列？ → A: 也像用户资料一样，先进入窗口队列，等待一小段时间后再按群拉取。
- Q: 群名片补拉窗口时间是否写死，是否和用户资料共用？ → A: 不写死；默认 7 秒，但与用户资料窗口独立配置，不共用一个值。
- Q: 群名片补拉的并行度如何控制？ → A: 不同群之间的并行个数需要可配置，默认值为 5；同一群内仍保持串行。
- Q: 群名片按群补拉时拉取哪些用户？ → A: 只拉该群里本轮命中的用户名片，不拉全群成员名片全集。
- Q: 群名片补拉成功后如何写回缓存？ → A: 只更新这次命中的 `groupId + userId` 记录，不用接口返回结果覆盖整群当前名片快照。
- Q: 群名片按群补拉若只返回本轮命中用户中的部分结果时如何处理？ → A: 成功返回的 `groupId + userId` 正常写回缓存并触发回调；未返回的记录记错误日志，等待下一条消息或下一个窗口再次触发。
- Q: 群名片缓存里是否允许混入头像、昵称等个人资料字段？ → A: 不允许；群名片缓存只保存群维度名片数据与必要的内部版本元数据。
- Q: 群名片补拉成功后的事件如何派发？ → A: 按单用户事件派发；每个成功写回缓存的 `groupId + userId` 各触发一次 `onUserGroupNamecardUpdated(groupId, userId, namecard)`。
- Q: 同一轮群名片补拉若成功写回多个“他人”用户，`onUserGroupNamecardUpdated` 的触发顺序如何定义？ → A: 按本轮成功写回缓存的处理顺序依次触发，不额外定义排序规则。
- Q: 群名片补拉成功后缓存与 storage 如何更新？ → A: 对本轮命中的 `groupId + userId` 记录直接整体替换，并同步写回运行时缓存与持久化缓存。
- Q: 群名片补拉成功后，SDK 是否直接回填当前内存中的消息对象展示字段？ → A: 不直接回填；SDK 只更新群名片缓存并派发 `onUserGroupNamecardUpdated`，由应用层自行决定是否重建消息视图。
- Q: `namecardUpdateTime` 适用于哪些消息类型？ → A: 仅对群组消息生效，聊天室与单聊不使用该字段。
- Q: 群会话的最后一条消息摘要里是否保留 `namecardUpdateTime`？ → A: 保留，用于冷启动重载消息时继续参与群名片版本判断。
- Q: 单聊会话摘要里是否保留 `namecardUpdateTime`？ → A: 不保留；单聊摘要只保留 `userInfoUpdateTime`。
- Q: 冷启动重载消息时，用户资料与群名片是否需要主动补位？ → A: 需要；冷启动重载到的消息也要像实时消息一样异步补位，但只更新本轮新加载的消息与相关视图，不主动回刷未参与本轮加载的历史消息。
- Q: 若同一用户或同一 `groupId + userId` 同时被冷启动重载消息与实时消息命中，补拉队列如何收敛？ → A: 进入同一个补拉队列统一去重，并以命中消息中的最大版本作为目标版本。
- Q: 补拉失败如何处理？ → A: 打印错误日志，不立即重试，等待下一条消息或下一个窗口再次触发。
- Q: 大型群聊缓存淘汰策略如何收敛？ → A: 保留自己、联系人与最近活跃用户，其余按现有 TTL/LRU 淘汰。
- Q: 是否需要跨 tab 无消息实时同步？ → A: 不需要；空闲 tab 若没有新消息，可等待后续消息、重新登录或主动读取时再感知新状态。
- Q: 小程序兼容边界怎么写？ → A: 本期方案不得依赖浏览器专有对象，如 `URL`、直接访问原生 `localStorage`；需复用现有跨平台适配与存储抽象。

### Session 2026-04-21

- Q: 是否需要增加开关来控制消息是否携带 `userInfoUpdateTime` / `namecardUpdateTime`？ → A: 需要；对外初始化配置中增加 `enableUserInfoSync` 开关，默认 `false`。
- Q: `enableUserInfoSync` 在本仓库 Web SDK 中如何建模？ → A: 对齐现有 `ChatClient.init(InitConfig)` 入口，在 `InitConfig` 下增加 `enableUserInfoSync?: boolean`；其语义与既有平台的用户资料同步开关保持一致。
- Q: `enableUserInfoSync=false` 时发送消息是否携带 `userInfoUpdateTime` / `namecardUpdateTime`？ → A: 不携带；单聊/群聊/聊天室都不写入这两个内部版本字段。
- Q: `enableUserInfoSync=false` 时收到消息后是否还要做版本比较、补拉、基于版本的缓存更新与资料同步事件派发？ → A: 不做；关闭时只保留普通消息主链路，不进入消息驱动资料版本同步与群名片同步链路。
- Q: `enableUserInfoSync=false` 时是否影响 `UserInfoManager` / `GroupManager` 的直接读写接口？ → A: 不影响；关闭的只是“消息携带版本戳 + 接收侧按版本比较/补拉/派发事件”的链路，不改变直接调用资料接口或群成员属性接口的原有语义。
- Q: 资料补位窗口、批量门槛、并行度配置何时生效？ → A: 这些配置由 SDK 内部默认值控制，仅在 `enableUserInfoSync=true` 时生效；关闭时保持静默，不触发消息驱动同步逻辑。

## 设计决策

- 本期采用“消息携带版本戳、接收侧按需补齐资料”的方案，而不是在每条消息中携带完整用户资料快照。
- `senderInfo` 作为接收侧运行时 hydrated view 存在，可被消息展示层消费，但不作为消息事实数据、历史消息真值或单独持久化副本。
- 当本地已经存在旧的 `senderInfo` 时，即使消息版本戳提示资料已过期，当前消息也优先复用旧资料展示；补拉完成后的新资料通过缓存回写与事件派发逐步收敛到最新状态。
- 当本地完全没有 `senderInfo` 且补拉失败时，消息展示层继续保留最小可用身份信息，例如 `userId`，直到后续成功获取资料为止。
- 补拉成功后的资料更新不直接回填当前仍在内存中的消息对象；SDK 只负责更新缓存与派发事件，消息视图是否重建由应用层自行决定。
- 用户资料版本与群名片版本是两条独立链路：用户资料按 `userId` 比较版本；群名片按 `groupId + userId` 比较版本。
- 当前用户自己更新资料后，本端应立即更新运行时缓存与持久化缓存，并保证同一端随后发送的下一条消息携带最新服务端 `userInfoUpdateTime`。
- 当前用户自己更新某个群内的群名片后，本端应立即更新对应 `groupId + userId` 的运行时缓存与持久化缓存，并保证同一端随后在该群发送的下一条群消息携带最新服务端 `namecardUpdateTime`。
- 新增对外初始化开关 `enableUserInfoSync`，用于控制是否启用“消息携带资料版本戳 + 接收侧按版本比较/补拉”的整条链路；默认值为 `false`。
- 当 `enableUserInfoSync=false` 时，消息主链路仍保持可用，但发送侧不得写入 `userInfoUpdateTime` / `namecardUpdateTime`，接收侧也不得因为消息而触发资料版本比较、待补拉入队、基于版本的缓存收敛或资料同步事件派发。
- 当 `enableUserInfoSync=true` 时，登录后同步本人资料版本、发送侧挂载版本字段、接收侧补拉与缓存/事件收敛才整体生效；资料补位窗口、批量与并行度使用 SDK 内部默认配置，并仅在此模式下生效。
- 用户资料补拉使用“消息驱动 + 固定门槛聚合”策略：消息到达后先入队，达到 20 个用户的固定批量门槛时立即触发；未达到门槛则由“默认 7 秒、可独立配置”的窗口超时触发；不在空闲场景主动轮询。
- 用户资料待补拉队列按 `userId` 去重收敛：同一窗口内若同一用户被多条消息重复命中，仅保留一条待补拉记录，并以最大的 `userInfoUpdateTime` 作为目标版本。
- 用户资料待补拉队列对冷启动重载消息与实时消息一视同仁：两类来源进入同一个补拉队列统一去重，并以命中消息中的最大 `userInfoUpdateTime` 作为目标版本。
- 用户资料批量补拉允许“部分成功”收敛：单次返回中成功命中的用户先写回缓存并正常派发事件，未成功返回的用户仅记录错误日志，等待后续消息或下一窗口再次进入补拉流程。
- 用户资料更新只有一层对外事件：资料补拉或主动更新成功后，SDK 先直接完成缓存与 localStorage 回写，再派发 `onSelfUserInfoUpdated(userInfo: UserInfo)` 与 `onUserInfoUpdated(userInfos: Array<UserInfo>)`。`onUserInfoUpdated` 不包含当前用户自己。只要资料补拉成功并写回缓存，就全部触发，不依赖字段值是否真的变化。应用层可据此刷新会话列表、资料卡片等依赖用户资料缓存的视图。
- 当前用户自己主动更新自己的资料时，也必须触发 `onSelfUserInfoUpdated`，不得静默只更新缓存。
- 同一轮用户资料补拉结果若同时包含当前用户自己和他人，SDK 需要拆分派发：当前用户自己的记录单独触发 `onSelfUserInfoUpdated`，他人记录聚合触发 `onUserInfoUpdated`，两类事件可在同一轮中同时发生。
- 群名片补拉使用“窗口队列 + 同群串行 + 跨群并行 + 命中用户收敛”策略：命中后先进入窗口队列，等待“默认 7 秒、可独立配置”的窗口后再按群执行；不同群之间允许并行处理，且并行个数需可配置，默认值为 5；同一群内仍保持串行，不跨群合并请求，且每次仅拉取该群本轮命中的用户名片，避免混淆不同群内的名片版本并控制大群请求体量。
- 群名片待补拉队列同样对冷启动重载消息与实时消息统一收敛：同一 `groupId + userId` 的命中记录进入同一个队列去重，并以命中消息中的最大 `namecardUpdateTime`` 作为目标版本。
- 群名片补拉成功后仅回写本轮命中的 `groupId + userId` 记录，不以单次接口返回结果覆盖整群名片快照；对这些命中记录采用整体替换写回运行时缓存与持久化缓存，不再逐字段判断差异。
- 群名片按群补拉允许“部分成功”收敛：单次返回中成功命中的 `groupId + userId` 先写回缓存并按单用户回调派发事件，未成功返回的命中记录仅记录错误日志，等待后续消息或下一窗口再次进入补拉流程。
- 群名片缓存仅承载群维度名片数据：记录中只保留 `groupId`、`userId`、`namecard` 以及必要的内部版本/同步元数据，不混入头像、昵称或其他全局个人资料字段。
- 群名片更新也只有一层对外事件：SDK 直接完成群名片缓存与 localStorage 回写后，再派发 `onUserGroupNamecardUpdated(groupId: string, userId: string, namecard: string)`。每个成功写回缓存的“他人”命中用户各触发一次单用户事件，不保留批量事件模型，也不额外透出 `namecardUpdateTime`；当前用户自己的群名片变化不走这个事件。
- 同一轮群名片补拉若成功写回多个“他人”用户，`onUserGroupNamecardUpdated` 按本轮成功写回缓存的处理顺序依次触发，不额外定义跨用户排序规则。
- 当前用户自己主动更新自己的群名片时，同样不触发 `onUserGroupNamecardUpdated`；该链路只负责更新本端缓存，并保证后续发送群消息携带最新版本。
- 群名片补拉成功后同样不直接回填当前仍在内存中的消息对象展示字段；SDK 仅负责更新群名片缓存并派发 `onUserGroupNamecardUpdated`，由应用层决定是否重建消息视图。
- 本期继续复用现有缓存架构：Web 端热点数据继续落在 localStorage；跨平台环境继续通过现有存储抽象承载，不要求调用方直接使用 `localStorage`。
- 小程序、uni-app 等非浏览器环境与 Web 对外语义保持一致；资料字段中的 URL 仍以普通字符串语义表达，不要求存在浏览器 `URL` 对象。
- 会话列表最新消息摘要只在原有消息结构上补充版本字段，不引入第二套最新消息 JSON 模型；群会话摘要保留 `userInfoUpdateTime` 与 `namecardUpdateTime`，单聊摘要只保留 `userInfoUpdateTime`。
- 冷启动重载消息时，重载到的消息也参与资料版本判断与异步补位；用户资料与群名片都应按与实时消息一致的规则进入各自补拉流程，但补位结果只更新本轮新加载消息与相关视图，不主动回刷未参与本轮加载的历史消息。
- 群名片更新事件仅存在于群组域，并复用现有群组管理器监听器体系，不单独新增一套未归属 manager 的事件通道。

## User Scenarios & Testing _(mandatory)_

### User Story 1 - 接收消息时按版本戳异步补齐发送者资料 (Priority: P1)

作为 SDK 使用者，我希望消息在接收时先走正常的收消息主链路，再由 SDK 基于消息里的资料版本戳去查本地缓存、拼接 `senderInfo`、并在版本落后时异步批量补拉，这样我既不会因为资料同步阻塞消息展示，也能逐步拿到最新资料。

**Why this priority**: 这是本次需求的主路径。如果这条链路不稳定，消息展示、资料一致性和性能三者都会同时出问题。

**Independent Test**: 构造“本地版本已新于消息”“本地版本落后于消息”“本地没有资料”三类场景，验证 SDK 的消息派发、资料查找、队列聚合和补拉行为是否符合预期。

**Acceptance Scenarios**:

1. **Given** 本地缓存中存在发送者资料，且其 `userInfoUpdateTime` 不小于消息中的版本戳，**When** SDK 收到该消息，**Then** SDK 直接使用本地资料拼装 `senderInfo`，且不会把该用户加入补拉队列。
2. **Given** 本地没有发送者资料，或本地 `userInfoUpdateTime` 小于消息中的版本戳，**When** SDK 收到该消息，**Then** SDK 先完成消息派发，再把该用户加入待补拉队列，而不是等待资料接口返回后才回调消息。
3. **Given** 本地已有发送者的旧资料，且其 `userInfoUpdateTime` 小于消息中的版本戳，**When** SDK 收到该消息，**Then** SDK 先使用这份旧资料拼装并展示当前消息，再把该用户加入待补拉队列。
4. **Given** 7 秒窗口内收到同一批用户发来的多条消息，**When** SDK 处理这些消息，**Then** SDK 会按 `userId` 去重并合并为一批资料补拉，并以这些消息中最大的 `userInfoUpdateTime` 作为目标版本，而不是重复请求相同用户资料。
5. **Given** 待补拉用户数量达到固定批量门槛，**When** SDK 聚合该批用户，**Then** SDK 会立即触发一次资料补拉，而不是继续等待 7 秒窗口结束。
6. **Given** 7 秒窗口内没有积攒到固定批量门槛的待补拉用户，**When** 窗口到期，**Then** SDK 仍会主动发起一次资料补拉，避免队列长期滞留。
7. **Given** 某次他人资料补拉成功返回了一批用户资料，**When** SDK 完成缓存与持久化回写，**Then** SDK 还会通过 `onUserInfoUpdated(userInfos: Array<UserInfo>)` 对外派发一条批量更新通知，供应用层按批刷新相关视图。
8. **Given** 当前用户自己的资料更新成功并写回缓存，**When** SDK 处理该结果，**Then** SDK 会通过 `onSelfUserInfoUpdated(userInfo: UserInfo)` 对外通知当前用户资料已更新。
9. **Given** 当前用户自己刚完成资料更新并拿到服务端最新版本，**When** 同一端随后发送下一条消息，**Then** 该消息必须携带最新的 `userInfoUpdateTime`。
10. **Given** 当前用户自己主动更新了自己的资料，**When** SDK 写回本端缓存，**Then** SDK 必须触发 `onSelfUserInfoUpdated(userInfo)`，不允许静默只更新缓存。
11. **Given** 某批资料补拉成功，但部分字段值与本地缓存一致，**When** SDK 处理返回结果，**Then** SDK 仍直接替换这些记录并触发 `onUserInfoUpdated` 或 `onSelfUserInfoUpdated`，而不是逐字段比对后再决定是否派发。
12. **Given** 某次资料补拉失败，**When** 本轮处理结束，**Then** SDK 打印错误日志，但不立即针对同一批用户再次重试。
13. **Given** 某一轮用户资料补拉结果同时包含当前用户自己和他人，**When** SDK 写回缓存并对外派发事件，**Then** SDK 同时触发 `onSelfUserInfoUpdated(userInfo)` 与 `onUserInfoUpdated(userInfos)`，且当前用户自己不得出现在 `onUserInfoUpdated` 中。
14. **Given** 本地没有发送者资料且本轮资料补拉失败，**When** 应用层继续展示这条消息，**Then** SDK 保持最小可用身份信息展示，例如 `userId`，直到后续成功补拉为止。
15. **Given** 某次用户资料批量补拉只返回了部分用户成功结果，**When** SDK 处理该批返回，**Then** SDK 对成功返回的用户正常写回缓存并派发事件，对缺失的用户打印错误日志，并等待后续消息或下一窗口再次触发。
16. **Given** 冷启动阶段重新加载了一批新消息，且其中部分发送者资料本地缺失或版本落后，**When** SDK 处理这批重载消息，**Then** SDK 仍会像实时消息一样异步触发用户资料补拉，但补位结果只更新这批新加载消息与相关视图，不主动回刷未参与本轮加载的历史消息。
17. **Given** 同一 `userId` 同时被冷启动重载消息与随后到达的实时消息命中，**When** SDK 收敛待补拉队列，**Then** SDK 将这两类来源统一进入同一个用户资料补拉队列去重，并以两者中最大的 `userInfoUpdateTime` 作为目标版本。
18. **Given** 某条消息已经使用旧的 `senderInfo` 完成展示，**When** 后续资料补拉成功，**Then** SDK 只更新缓存并派发事件，不直接修改当前内存中的消息对象；是否重建消息视图由应用层决定。
19. **Given** `enableUserInfoSync=true` 且消息未携带 `userInfoUpdateTime`，但本地已有发送者资料缓存，**When** SDK 收到该消息，**Then** SDK 直接复用本地缓存拼装展示，并且不因为“缺少版本字段”重复触发资料补拉。
20. **Given** `enableUserInfoSync=true` 且消息未携带 `userInfoUpdateTime`，同时本地没有发送者资料缓存，**When** SDK 收到该消息，**Then** SDK 先完成消息主链路派发，再按 `userId` 异步触发一次兜底资料补拉；后续消息可直接复用这次补拉写回的缓存。
21. **Given** `enableUserInfoSync=false`，**When** 当前用户发送单聊消息、群消息或聊天室消息，**Then** SDK 不得在消息内部协议中携带 `userInfoUpdateTime`，且群消息也不得携带 `namecardUpdateTime`。
22. **Given** `enableUserInfoSync=false`，**When** SDK 收到消息，**Then** SDK 不得因该消息触发资料版本比较、待补拉入队、用户资料/群名片补拉、基于版本的缓存更新，或 `onSelfUserInfoUpdated` / `onUserInfoUpdated` / `onUserGroupNamecardUpdated` 的消息驱动派发。
23. **Given** `enableUserInfoSync=true`，**When** SDK 初始化并登录后进入正常收发消息流程，**Then** 本规格定义的版本字段挂载、补拉聚合、缓存收敛与事件派发行为全部生效。

---

### User Story 2 - 群聊中的群名片按群维度独立更新并发布事件 (Priority: P1)

作为 SDK 使用者，我希望群组消息中的群名片版本与用户资料版本独立处理，SDK 在发现群名片版本落后时按群维度拉取最新名片，并通过群组事件把变化通知给应用层，这样会话列表和成员卡片能展示最新名片，而历史消息是否回刷仍由应用层决定。

**Why this priority**: 群名片是群聊里和全局用户资料不同的第二条主链路。如果不单独建模，会把同一用户在不同群里的名片错误混在一起。

**Independent Test**: 构造同一用户在不同群中拥有不同名片版本的场景，验证 SDK 是否按 `groupId + userId` 维度独立比较版本、触发按群补拉，并发布完整事件 payload。

**Acceptance Scenarios**:

1. **Given** 群聊消息中的 `namecardUpdateTime` 大于本地该 `groupId + userId` 的名片版本，**When** SDK 收到该消息，**Then** SDK 将该群加入窗口待处理队列，而不是立刻发起名片补拉。
2. **Given** 同一时间窗口内多个群都出现名片版本更新，**When** 窗口到期后 SDK 执行补拉，**Then** SDK 可以对不同群并行发起补拉，但不得把多个群混在同一请求中，且同一群内仍保持串行执行。
3. **Given** 某一轮群名片待补拉队列中只命中了该群的部分用户，**When** SDK 执行该群的名片补拉，**Then** SDK 只拉取本轮命中的这些用户，而不是退化为拉取全群成员名片全集。
4. **Given** 某次群名片补拉成功返回了该群的部分名片结果，**When** SDK 写回缓存，**Then** SDK 只更新本轮命中的 `groupId + userId` 记录，而不是覆盖整群当前名片快照。
5. **Given** 群名片补拉成功且本轮命中了多个“他人”用户，**When** SDK 更新缓存后对外派发事件，**Then** SDK 会针对每个成功写回缓存的 `groupId + userId` 分别调用一次 `onUserGroupNamecardUpdated(groupId, userId, namecard)`。
6. **Given** 群名片补拉成功且本轮只命中一个“他人”用户，**When** SDK 对外派发事件，**Then** SDK 仅调用一次 `onUserGroupNamecardUpdated(groupId, userId, namecard)`，不再包装为批量事件。
7. **Given** 群名片补拉成功命中了当前用户自己的群名片记录，**When** SDK 写回缓存，**Then** SDK 不调用 `onUserGroupNamecardUpdated`。
8. **Given** 某批命中的群名片拉取成功，但个别字段值与本地缓存一致，**When** SDK 处理返回结果，**Then** SDK 仍直接替换这些命中记录并对每个命中的“他人”用户触发单独回调，而不是逐字段比对后再决定是否派发。
9. **Given** SDK 写回群名片缓存，**When** 应用层随后读取该群名片记录，**Then** 记录中只包含群维度名片数据与内部版本元数据，不包含头像、昵称等个人资料字段。
10. **Given** 应用层没有主动回刷历史消息，**When** 群名片事件发出后，**Then** 会话列表和成员卡片等读取最新缓存的视图仍能展示新名片。
11. **Given** 群名片补拉失败，**When** 本轮处理结束，**Then** SDK 打印错误日志，并等待后续消息或下一个窗口再次触发。
12. **Given** 某次群名片补拉只返回了本轮命中用户中的部分结果，**When** SDK 处理该批返回，**Then** SDK 对成功返回的 `groupId + userId` 正常写回缓存并逐个触发 `onUserGroupNamecardUpdated`，对缺失的记录打印错误日志，并等待后续消息或下一窗口再次触发。
13. **Given** 冷启动阶段重新加载了一批群消息，且其中部分 `groupId + userId` 的群名片本地缺失或版本落后，**When** SDK 处理这批重载消息，**Then** SDK 会像实时消息一样异步触发群名片补拉，但补位结果只更新这批新加载消息与相关视图，不主动回刷未参与本轮加载的历史消息。
14. **Given** 同一 `groupId + userId` 同时被冷启动重载消息与随后到达的实时群消息命中，**When** SDK 收敛待补拉队列，**Then** SDK 将这两类来源统一进入同一个群名片补拉队列去重，并以两者中最大的 `namecardUpdateTime` 作为目标版本。
15. **Given** 某条群消息已经使用旧的群名片信息完成展示，**When** 后续群名片补拉成功，**Then** SDK 只更新群名片缓存并触发 `onUserGroupNamecardUpdated`，不直接修改当前内存中的消息对象；是否重建消息视图由应用层决定。
16. **Given** 当前用户自己刚完成某个群内的群名片更新并拿到服务端最新版本，**When** 同一端随后在该群发送下一条群消息，**Then** 该消息必须携带最新的 `namecardUpdateTime`，且对应 `groupId + userId` 缓存已完成更新。
17. **Given** 当前用户自己刚完成自己的群名片更新，**When** SDK 写回本端对应 `groupId + userId` 缓存，**Then** SDK 不触发 `onUserGroupNamecardUpdated`，仅保证后续该群消息携带最新 `namecardUpdateTime`。
18. **Given** 同一轮群名片补拉成功写回了多个“他人”用户，**When** SDK 对外派发 `onUserGroupNamecardUpdated`，**Then** SDK 按本轮成功写回缓存的处理顺序依次触发这些单用户回调，不额外定义排序规则。
19. **Given** `enableUserInfoSync=false`，**When** 当前用户发送群消息或收到群消息，**Then** SDK 不得携带或比较 `namecardUpdateTime`，也不得触发按群名片补拉与 `onUserGroupNamecardUpdated` 链路。

---

### User Story 3 - 热点资料在 Web 与小程序环境中都能稳定缓存 (Priority: P1)

作为 SDK 使用者，我希望资料缓存继续复用现有缓存层和过期淘汰策略，在 Web 端保持 localStorage 热点缓存能力，在小程序等非浏览器环境中通过现有适配层继续工作，并优先保留自己、联系人和最近活跃用户，这样大群场景不会因为冷数据无限增长而拖垮存储。

**Why this priority**: 这决定了方案是否能在大型群聊和跨平台环境里长期运行，而不是只在浏览器单页小样本场景里可用。

**Independent Test**: 构造热点用户、联系人和大量冷数据并触发缓存过期、LRU 淘汰与配额回退，验证保留策略、跨平台存储抽象和消息主链路稳定性。

**Acceptance Scenarios**:

1. **Given** 缓存需要执行过期或 LRU 淘汰，**When** SDK 进行资料清理，**Then** 自己、联系人和最近活跃用户会优先保留，其余冷数据优先被淘汰。
2. **Given** Web 端 localStorage 写入触发配额问题，**When** SDK 执行现有清理与重试语义，**Then** 消息主链路保持可用，且热点资料尽可能被保留。
3. **Given** 运行环境是小程序或其他无浏览器 `URL` 对象的环境，**When** SDK 拼装 `senderInfo` 或缓存头像地址，**Then** SDK 继续以普通字符串 URL 语义工作，不要求存在 `URL` 实例。
4. **Given** 运行环境没有浏览器原生 `localStorage`，**When** SDK 读写资料缓存，**Then** SDK 必须通过现有存储适配层完成等价操作，而不是直接依赖浏览器存储 API。
5. **Given** 某个空闲 tab 没有收到新消息，**When** 另一个页面更新了资料缓存，**Then** 空闲 tab 不要求实时刷新，直到后续消息、重新登录或主动读取时再感知新状态。

### Out of Scope

- 在每条消息中携带完整用户资料或群名片快照。
- 自动批量刷新历史消息 UI。
- 为本功能新增独立的全量成员长期持久化数据库方案。
- 新增专门的资料同步 demo 页面或新的公开 manager。
- 强制要求多 tab 在无消息场景下做实时状态广播同步。

### Edge Cases

- 消息中的 `userInfoUpdateTime` 或 `namecardUpdateTime` 缺失、非法或回退时，SDK 必须安全降级为“不按版本触发补拉”，而不是污染本地缓存版本；当 `enableUserInfoSync=true` 且对应资料缓存缺失时，SDK MAY 按 `userId` 或 `groupId + userId` 触发一次异步兜底补拉。
- 同一用户在多个群中的名片版本不同，系统必须以 `groupId + userId` 为唯一比较维度，不能错误复用全局名片。
- 7 秒窗口内收到大量陌生用户的群消息时，SDK 需要避免相同用户重复入队，也不能因为单次失败而立即持续重试。
- 本地完全没有发送者资料时，UI 可先展示最小身份信息（如 `userId`），资料补齐后再更新展示。
- 用户资料补拉成功但群名片补拉失败，或反之，SDK 必须允许两条链路独立收敛，不得相互阻塞。
- 会话列表最新消息摘要回放后，如果版本字段存在但本地资料缓存缺失，SDK 仍应允许下一次收到消息时继续触发补拉。
- Web 端使用 localStorage，非 Web 端使用存储抽象；方案不得把“必须存在 localStorage”写死为唯一前提。

## Test Layer Requirements _(mandatory)_

### Unit Tests

- Coverage goals: 覆盖秒级版本比较、资料查找优先级、用户补拉去重、7 秒窗口超时触发、群名片按群排队、热点用户保留规则、失败不立即重试、以及非浏览器环境下不依赖 `URL` 对象的字符串语义处理。
- Planned location: `tests/unit/core/message/`、`tests/unit/cache/`、`tests/unit/chat-client/`、`tests/unit/platform/`
- Not applicable rationale: N/A

### Integration Tests

- Coverage goals: 覆盖 mSync `MessageBody` 新增内部版本字段的编解码、消息接收后 `UserInfoManager` / 群成员属性接口 / `CacheManager` 的协作、窗口聚合补拉、群名片事件派发、Web 端 localStorage 回写与小程序等非浏览器环境下的存储适配协作。
- Planned location: `tests/integration/message-profile-sync/`、必要时复用 `tests/integration/cache/`、`tests/integration/group-manager/`、`tests/integration/miniapp-demo/`
- Not applicable rationale: N/A

### E2E Tests

- Coverage goals: 复用现有 Web 端发送/接收 smoke，确认内部版本字段和异步补拉不会破坏消息主链路；小程序环境维持手工验证清单，不在本期新增自动化小程序 E2E。
- Planned location: 复用 `tests/e2e/send-receive.spec.ts`；小程序验证说明在后续 `quickstart` 或计划文档中补充
- Not applicable rationale: 当前仓库的自动化 E2E 基础设施仍以浏览器为主，不直接适用于微信小程序运行容器；因此小程序以集成验证和手工验收为主

### Gate Impact

- Required gates: `npm run test:run`、`npm run lint`、`npm run type-check`、`npm run test:gate:pr`
- Validation notes: 版本字段编解码、消息后补拉、热点缓存淘汰、群名片事件派发必须进入 PR 门禁；跨平台适配回归至少覆盖 Web 与小程序兼容路径的单元/集成用例

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: 系统 MUST 在内部 `MessageBody` 协议中新增 `userInfoUpdateTime` 与 `namecardUpdateTime` 两个秒级版本字段。
- **FR-002**: 这两个版本字段 MUST 作为内部协议语义存在，不得默认透出为公开 `Message` 对象字段。
- **FR-003**: 系统 MUST 继续把消息本身作为业务真值；`senderInfo` 仅作为接收侧运行时拼装出的展示视图，不得成为消息持久化真值。
- **FR-003A**: 系统 MUST 在对外初始化配置中新增 `enableUserInfoSync` 开关；对本仓库 Web SDK，开关形态 MUST 为 `ChatClient.init(InitConfig)` 下的 `InitConfig.enableUserInfoSync?: boolean`，默认值 MUST 为 `false`。
- **FR-003B**: `enableUserInfoSync` MUST 用于控制“消息携带资料版本戳 + 接收侧按版本比较/补拉 + 基于版本的缓存收敛 + 资料同步事件派发”整条链路的启停。
- **FR-003C**: 系统 MUST NOT 因本期开关新增新的公开 manager；对外回调仍仅使用 `onSelfUserInfoUpdated`、`onUserInfoUpdated`、`onUserGroupNamecardUpdated`。
- **FR-004**: 当 `enableUserInfoSync=true` 时，当前登录用户在登录成功后 MUST 主动同步自己的资料，并把同步结果写入运行时缓存与持久化缓存。
- **FR-004A**: 当 `enableUserInfoSync=false` 时，系统 MUST NOT 因登录成功自动进入“本人资料版本同步 -> 后续消息携带版本戳”的预热链路。
- **FR-005**: 当 `enableUserInfoSync=true` 时，当前登录用户后续发送消息时 MUST 携带服务端返回的真实 `userInfoUpdateTime`，不得使用本地时间推算。
- **FR-005A**: 当 `enableUserInfoSync=true` 且当前用户自己更新资料成功后，系统 MUST 立即更新本端运行时缓存与持久化缓存，并保证同一端随后发送的下一条消息携带最新服务端 `userInfoUpdateTime`。
- **FR-005B**: 当 `enableUserInfoSync=false` 时，系统 MUST NOT 在发送消息时写入 `userInfoUpdateTime`；群消息也 MUST NOT 写入 `namecardUpdateTime`。
- **FR-005C**: 当 `enableUserInfoSync=false` 时，系统 MUST NOT 因收到消息而执行资料版本比较、待补拉入队、用户资料/群名片补拉、基于版本的缓存更新，或消息驱动的资料同步事件派发。
- **FR-006**: 接收消息时，系统 MUST 先尝试从运行时缓存获取发送者资料，未命中时再读取持久化缓存，并在需要时拼装最小可用 `senderInfo` 视图。
- **FR-006A**: 当 `enableUserInfoSync=true` 且消息未携带 `userInfoUpdateTime` 时，系统 MUST 继续优先复用本地发送者资料缓存；若缓存缺失，系统 MUST 在不阻塞消息主链路的前提下按 `userId` 异步触发一次兜底资料补拉。
- **FR-007**: 当本地资料不存在或本地 `userInfoUpdateTime` 小于消息中的版本戳时，系统 MUST 将该用户加入待补拉队列，但不得阻塞消息接收主链路。
- **FR-007A**: 当本地存在发送者旧资料但版本落后于消息中的版本戳时，系统 MUST 优先复用该旧资料展示当前消息，再异步补拉最新资料。
- **FR-008**: 当本地资料版本不小于消息中的版本戳时，系统 MUST 直接复用本地资料，不得重复触发该用户的资料补拉。
- **FR-009**: 用户资料补拉 MUST 仅由“收到消息”驱动进入队列，不得在无消息场景下自行轮询。
- **FR-010**: 用户资料补拉 MUST 支持按 `userId` 去重和窗口聚合；同一窗口内同一用户只能进入一次待补拉批次。
- **FR-010A**: 同一窗口内若同一 `userId` 被多条消息重复命中，系统 MUST 仅保留一条待补拉记录，并以最大的 `userInfoUpdateTime` 作为该用户的目标版本。
- **FR-010B**: 冷启动重载消息与实时消息命中同一 `userId` 时，系统 MUST 将两者统一纳入同一个用户资料补拉队列去重，并以最大的 `userInfoUpdateTime` 作为目标版本。
- **FR-011**: 当 `enableUserInfoSync=true` 时，用户资料补拉 MUST 在达到 20 个用户的固定批量门槛时立即触发；若未达到该门槛，也 MUST 在补拉窗口到期后主动触发一次；该窗口默认值为 7 秒，且 MUST 支持独立配置。
- **FR-011A**: 资料补位窗口、批量门槛与并行度配置 MUST 由 SDK 内部默认值控制，并仅在 `enableUserInfoSync=true` 时生效；当开关关闭时，这些配置不得触发消息驱动同步行为。
- **FR-012**: 群名片版本比较 MUST 基于 `groupId + userId` 维度，且不得与全局用户资料版本混用。
- **FR-012A**: 当 `enableUserInfoSync=true` 且当前用户自己更新某个群内的群名片成功后，系统 MUST 立即更新本端对应 `groupId + userId` 的运行时缓存与持久化缓存，并保证同一端随后在该群发送的下一条群消息携带最新服务端 `namecardUpdateTime`。
- **FR-013**: 当 `enableUserInfoSync=true` 时，`namecardUpdateTime` MUST 仅对群组消息生效；聊天室消息与单聊消息不得使用该字段参与版本比较或补拉决策。
- **FR-013A**: 当 `enableUserInfoSync=true` 且群消息未携带 `namecardUpdateTime` 时，系统 MUST 继续优先复用本地 `groupId + userId` 群名片缓存；若缓存缺失，系统 MUST 在不阻塞消息主链路的前提下按 `groupId + userId` 异步触发一次兜底群名片补拉。
- **FR-014**: 当群名片版本落后时，系统 MUST 按群把对应群组加入待处理队列，并按群维度执行补拉。
- **FR-014A**: 群名片补拉 MUST 先进入窗口队列，不得在收到命中消息后立即对单条消息直接发起补拉请求；该窗口默认值为 7 秒，且 MUST 支持与用户资料补拉窗口独立配置。
- **FR-014B**: 当多个群同时存在待处理补拉任务时，系统 MUST 允许不同群之间并行执行，且该并行个数 MUST 支持配置，默认值为 5。
- **FR-014C**: 同一群内的群名片补拉任务 MUST 保持串行执行，不得并发对同一群发起多次补拉请求。
- **FR-015**: 群名片补拉 MUST 不支持跨群合批请求。
- **FR-016**: 群名片按群补拉时 MUST 只拉取该群本轮命中的用户名片，不得退化为全群成员名片全量拉取。
- **FR-017**: 群名片待补拉队列 MUST 按 `groupId + userId` 去重；同一窗口内若同一记录被多条消息重复命中，系统 MUST 只保留一条待补拉记录，并以最大的 `namecardUpdateTime` 作为目标版本。
- **FR-017A**: 冷启动重载消息与实时消息命中同一 `groupId + userId` 时，系统 MUST 将两者统一纳入同一个群名片补拉队列去重，并以最大的 `namecardUpdateTime` 作为目标版本。
- **FR-018**: 群名片补拉成功后 MUST 只更新本轮命中的 `groupId + userId` 缓存记录，不得用单次接口返回结果覆盖整群当前名片快照；对这些命中记录 MUST 采用整体替换写回缓存与 storage，而不是逐字段差异合并。
- **FR-019**: 用户资料补拉成功后，系统 MUST 更新运行时缓存与持久化缓存，使后续消息展示与列表展示可读取最新资料。
- **FR-019A**: 当单次用户资料批量补拉仅部分成功时，系统 MUST 仅对成功返回的用户写回缓存并派发事件；未成功返回的用户 MUST 记录错误日志，并等待后续消息或下一个窗口再次触发。
- **FR-020**: 他人资料补拉成功后，系统 MUST 通过 `onUserInfoUpdated(userInfos: Array<UserInfo>)` 对外通知；回调参数 MUST 为本轮成功写回缓存的他人资料完整 `UserInfo[]`，且不得包含当前用户自己。
- **FR-021**: 当前用户自己的资料更新成功后，系统 MUST 通过 `onSelfUserInfoUpdated(userInfo: UserInfo)` 对外通知；回调参数 MUST 为当前用户的完整 `UserInfo`，且当前用户自己不得出现在 `onUserInfoUpdated` 中。
- **FR-021C**: 当前用户自己主动更新自己的资料成功后，系统 MUST 触发 `onSelfUserInfoUpdated(userInfo: UserInfo)`，不得静默只更新缓存。
- **FR-021A**: 用户资料补拉成功后，系统 MUST 不依赖字段级差异判断来决定是否替换缓存或是否派发事件；只要记录成功写回缓存，就应触发 `onUserInfoUpdated` 或 `onSelfUserInfoUpdated`。
- **FR-021B**: 当同一轮用户资料补拉结果同时包含当前用户自己与他人时，系统 MUST 拆分派发事件：当前用户自己单独触发 `onSelfUserInfoUpdated`，他人聚合触发 `onUserInfoUpdated`，且两类事件 MAY 在同一轮中同时发生。
- **FR-022**: 群名片补拉成功后，系统 MUST 更新运行时缓存与持久化缓存，使会话列表和成员卡片可读取最新名片。
- **FR-022A**: 当单次群名片补拉仅部分成功时，系统 MUST 仅对成功返回的 `groupId + userId` 写回缓存并按单用户回调语义派发事件；未成功返回的命中记录 MUST 记录错误日志，并等待后续消息或下一个窗口再次触发。
- **FR-023**: 群名片更新后，系统 MUST 通过 `onUserGroupNamecardUpdated(groupId: string, userId: string, namecard: string)` 对外通知；每个成功写回缓存的“他人”命中用户各触发一次回调。
- **FR-024**: 群名片事件 MUST 使用单用户回调语义，不得再设计或保留批量事件结构。
- **FR-025**: 群名片补拉成功后，系统 MUST 不依赖字段级差异判断来决定是否替换缓存或是否派发事件；只要“他人”的命中记录拉取成功并写回，就应按单用户回调语义对外通知。
- **FR-026**: 当前用户自己的群名片变化 MUST 不触发 `onUserGroupNamecardUpdated`。
- **FR-026A**: 当前用户自己主动更新自己的群名片成功后，系统 MUST NOT 触发 `onUserGroupNamecardUpdated`；系统 MUST 仅更新本端缓存并保证后续该群消息携带最新 `namecardUpdateTime`。
- **FR-027**: 群名片缓存记录 MUST 仅包含群维度名片数据与必要的内部版本/同步元数据，不得写入头像、昵称或其他全局个人资料字段。
- **FR-027A**: 群名片补拉成功后，系统 MUST NOT 直接回填当前仍在内存中的消息对象展示字段；系统 MUST 仅更新群名片缓存并派发 `onUserGroupNamecardUpdated`，由应用层决定是否重建消息视图。
- **FR-027B**: 当同一轮群名片补拉成功写回多个“他人”用户时，系统 MUST 按本轮成功写回缓存的处理顺序依次派发 `onUserGroupNamecardUpdated`，且不额外定义跨用户排序规则。
- **FR-028**: 系统 MUST 不主动刷新历史消息展示；历史消息是否回刷由应用层基于事件自行决定。
- **FR-029**: 会话列表“最新一条消息” MUST 在原有消息摘要结构上补充版本字段，不得单独引入第二套最新消息 JSON 结构；其中群会话摘要 MUST 保留 `userInfoUpdateTime` 与 `namecardUpdateTime`，单聊摘要 MUST 只保留 `userInfoUpdateTime`。
- **FR-029A**: 冷启动阶段若 SDK 重新加载消息，系统 MUST 让这些新加载消息像实时消息一样参与用户资料与群名片的版本判断和异步补拉流程。
- **FR-029B**: 冷启动重载消息触发的补位结果 MUST 仅更新本轮新加载消息与相关视图，不得主动回刷未参与本轮加载的历史消息。
- **FR-030**: 持久化缓存 MUST 继续复用现有缓存模块与过期策略；Web 端继续使用现有 localStorage 方案，非 Web 端继续通过现有存储适配层承载等价语义。
- **FR-031**: 缓存淘汰时 MUST 优先保留自己、联系人与最近活跃用户资料，其余资料按现有 TTL/LRU 规则淘汰。
- **FR-032**: 当持久化写入触发配额问题时，系统 MUST 复用现有清理与重试语义，并保证消息主链路保持可用。
- **FR-033**: 用户资料补拉或群名片补拉失败时，系统 MUST 打印明确错误日志，以满足现有可观测性要求。
- **FR-034**: 用户资料补拉或群名片补拉失败时，系统 MUST 不立即对同一批失败对象执行同步重试，而是等待后续消息或下一个窗口再次触发。
- **FR-035**: 当本地完全没有发送者资料时，系统 MUST 允许调用方先展示最小可用身份信息，如 `userId`，待补拉成功后再感知更新结果。
- **FR-035A**: 当本地完全没有发送者资料且补拉失败时，系统 MUST 继续维持最小可用身份信息展示，不得伪造空资料或阻塞消息展示。
- **FR-035B**: 资料补拉成功后，系统 MUST NOT 直接回填当前仍在内存中的消息对象 `senderInfo`；系统 MUST 仅更新缓存并派发事件，由应用层决定是否重建消息视图。
- **FR-036**: 其他设备上的本人资料更新通知到达当前会话时，系统 MUST 更新本地资料缓存，并保证后续发消息携带最新服务端版本；若本地当前用户资料完成更新，也 MUST 触发 `onSelfUserInfoUpdated`。
- **FR-037**: 本期 MUST 不要求多个空闲 tab 在无消息场景下做强实时同步；无消息 tab 可在后续消息、重新登录或主动读取时再感知最新资料。
- **FR-038**: 本期跨平台实现语义 MUST 不依赖浏览器专有对象，如 `URL`、直接原生 `localStorage` 或其他仅浏览器存在的运行时能力。
- **FR-039**: 头像地址、资料里的链接字段与 `senderInfo` 相关 URL 字段 MUST 继续以普通字符串语义存在，不得要求存在浏览器 `URL` 实例。
- **FR-040**: 小程序、uni-app、React Native 等非浏览器环境 MUST 能通过现有跨平台适配层参与同一套资料查找、补拉、缓存与事件语义，而不需要业务层分叉调用方式。
- **FR-041**: 本期范围 MUST 限定为“由 `enableUserInfoSync` 开关控制的消息驱动资料版本同步、群名片补拉、缓存收敛与事件派发”；不包含新的全量成员长期存储方案，也不包含新的公开 manager。

### API Surface Changes

- **ASC-001**: 对外初始化配置 MUST 新增 `enableUserInfoSync` 开关；在本仓库 Web SDK 中，其签名为 `ChatClient.init({ enableUserInfoSync?: boolean })`，默认值为 `false`。
- **ASC-002**: `enableUserInfoSync` 的语义 MUST 与既有平台的用户资料同步开关对齐：开启后，登录同步本人资料版本、发送消息时携带 `userInfoUpdateTime` / `namecardUpdateTime`、接收侧按版本比较并进入补拉/缓存/事件链路；关闭后，这整条消息驱动链路静默。
- **ASC-003**: 本期不得新增新的公开资料同步回调；对外仍仅保留 `onSelfUserInfoUpdated`、`onUserInfoUpdated`、`onUserGroupNamecardUpdated` 三个回调入口。
- **ASC-004**: `profileSync` 不作为公开初始化配置项；资料补位窗口、批量门槛、并行度等行为 MUST 使用 SDK 内部默认值，并仅在 `enableUserInfoSync=true` 时生效。
- **ASC-005**: `UserInfoManager`、`GroupManager` 及其既有直接读写 API 的 Promise 返回值与错误语义 MUST 保持不变；`enableUserInfoSync` 只影响消息携带版本戳及由消息驱动的版本同步链路。

### Key Entities _(include if feature involves data)_

- **MessageProfileVersion**: 消息内部携带的资料版本视图，描述发送者用户资料版本和群名片版本的秒级时间语义。
- **EnableUserInfoSyncOption**: 对外初始化开关，控制是否启用消息携带 `userInfoUpdateTime` / `namecardUpdateTime` 及接收侧由版本驱动的比较、补拉、缓存收敛和事件派发；默认值为 `false`。
- **SenderInfoView**: 接收侧基于缓存和补拉结果拼装出的发送者展示对象，不作为消息真值。
- **UserProfileCacheRecord**: 本地用户资料缓存记录，至少包含资料字段、真实服务端更新时间和最近同步时间。
- **SelfUserInfoUpdatedEvent**: 当前用户自己的资料更新成功后通过 `onSelfUserInfoUpdated` 派发的事件，参数为完整 `UserInfo`。
- **UserInfoUpdatedEvent**: 他人资料补拉成功后通过 `onUserInfoUpdated` 派发的批量事件，参数为本轮成功写回缓存的完整 `UserInfo[]`。
- **GroupNamecardCacheRecord**: 本地群名片缓存记录，仅包含 `groupId`、`userId`、`namecard` 以及必要的内部版本/同步元数据（如 `namecardUpdateTime`、最近同步时间）；不得混入头像、昵称等个人资料字段。
- **ProfileHydrationBatch**: 由收到消息后聚合形成的一批待补拉用户资料集合，具备去重、窗口聚合与超时触发语义；窗口默认值为 7 秒，且支持独立配置。
- **GroupNamecardHydrationTask**: 某个群维度下的名片补拉任务，先进入窗口队列后再执行；不同群任务允许并行调度，且并行个数支持配置、默认值为 5；同一群任务必须串行处理，不得重入。同一窗口内按 `groupId + userId` 去重，并以最大的 `namecardUpdateTime` 作为每条记录的目标版本；窗口默认值为 7 秒，且与用户资料补拉窗口独立配置。
- **UserGroupNamecardUpdatedEvent**: 群名片补拉成功后通过 `onUserGroupNamecardUpdated(groupId, userId, namecard)` 派发的单用户事件，参数描述一个成功写回缓存的群成员名片最新值。
- **LatestMessageVersionProjection**: 会话列表最新消息摘要上的版本字段投影；群会话包含 `userInfoUpdateTime` 与 `namecardUpdateTime`，单聊只包含 `userInfoUpdateTime`，用于冷启动后继续参与版本比较。

### Assumptions & Dependencies

- 服务端可在用户资料查询、更新以及群成员属性查询链路中返回可用于比较的真实秒级更新时间。
- 用户资料补拉继续复用现有 `UserInfoManager` 查询能力，群名片补拉继续复用现有群成员属性读取能力。
- 消息主链路优先于资料同步链路；资料同步属于最终一致语义，而非同步阻塞语义。
- Web 端当前持久化缓存以 localStorage 为热点缓存承载；非 Web 端通过存储抽象提供等价能力，但不承诺完全相同的底层实现。
- 本期不引入浏览器 `URL` 对象依赖，所有 URL 类字段继续以字符串表达，以保证小程序等环境可用。
- 大型群聊场景下，本地缓存仍定位为热点缓存，而不是全量成员长期数据库。

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 在“本地资料已新”“本地资料落后”“本地资料缺失”三类接收场景下，消息主链路通过率达到 100%，且资料补拉决策准确率达到 100%。
- **SC-002**: 同一 7 秒窗口内，相同 `userId` 的重复资料补拉请求次数降为 0。
- **SC-003**: 对外事件 `onUserInfoUpdated` 的投递完整率达到 100%，应用层可基于完整 `UserInfo[]` 刷新会话列表、资料卡片等依赖用户资料缓存的视图。
- **SC-004**: 对外事件 `onSelfUserInfoUpdated` 的投递完整率达到 100%，当前用户自己的资料更新可被应用层稳定感知。
- **SC-005**: 对外事件 `onUserGroupNamecardUpdated` 的投递完整率达到 100%，且只针对他人的群名片变更触发；应用层可基于 `groupId`、`userId`、`namecard` 稳定刷新群维度展示。
- **SC-006**: 群名片缓存纯度达到 100%，即缓存记录中不出现头像、昵称等全局个人资料字段。
- **SC-007**: 在缓存过期、LRU 淘汰和配额回退场景下，自己、联系人与最近活跃用户资料保留准确率达到 100%，且消息主链路不被阻塞。
- **SC-008**: 非浏览器环境下资料同步相关逻辑不依赖浏览器专有对象的兼容用例通过率达到 100%。
- **SC-009**: 资料补拉或群名片补拉失败时，错误日志记录率达到 100%，且系统不会在同一失败窗口内立即重复请求。
