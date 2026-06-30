# 033 研究结论（Phase 0）

## Decision 1: 订阅接口 success 结构以 2026-04-23 补齐的真实样例固化，查询结果走“用户名列表 + 二次 hydrate”

- **Decision**:
  - `subscribeUsersInfo` 的 upstream request body 固定为 `{"usernames":[...]}`。
  - `unsubscribeUsersInfo` 的 upstream request 固定为 query `?usernames=a,b`，不走 body。
  - POST / DELETE / GET 的 upstream success envelope 共享 `path`、`uri`、`status`、`timestamp`、`organization`、`application`、`entities`、`count`、`data`、`duration`、`applicationName`。
  - GET success 的 `data` 仅返回订阅用户名数组，因此 `getSubscribedUsers()` 需要先获取用户名列表，再复用现有 `fetchUserInfoByUserId` 或等价批量资料查询能力，把结果对外归一化为 `ReadonlyArray<UserInfo>`。
- **Rationale**:
  - 真实样例已经确认 success envelope 的公共字段与请求映射方式，继续保留占位 contract 会制造新的文档歧义。
  - 033 的对外语义已经固定为查询返回 `ReadonlyArray<UserInfo>`；既然 upstream 只给用户名数组，内部二次 hydrate 是维持公开语义和 manager 一致性的最小代价方案。
  - 仓库现有 `UserInfoManager.fetchUserInfoByUserId` 已支持批量资料查询，033 可以直接复用，避免为订阅列表再引入一套新的资料拼装路径。
- **Alternatives considered**:
  - 把 `getSubscribedUsers()` 改成直接返回 `string[]`：虽然更贴近 upstream，但会让同一 manager 内的资料 API 语义突然退化，且与既有 spec 不一致。
  - 在 GET 成功后只返回缓存命中的 `UserInfo`，未命中部分丢弃：会让查询结果受本地预热状态影响，违反稳定 API 预期。

## Decision 2: `UserInfoManager` 继续作为订阅 API 唯一公开入口，`ContactManager` 继续作为好友资料变化事件唯一公开入口

- **Decision**: 033 不新建新的 manager。陌生人资料订阅相关 REST API 和 `onUserInfoUpdated` 归属 `UserInfoManager`；好友资料变化事件 `onContactInfoUpdated` 继续归属 `ContactManager`。
- **Rationale**:
  - 026 已经把用户资料查询/更新语义收敛到 `UserInfoManager`；033 的订阅 API 本质仍是用户资料域能力扩展。
  - 025 已经把联系人读取与联系人事件入口稳定在 `ContactManager`；好友资料变化事件继续沿用这个入口，调用方心智最稳定。
  - 这样可以保持“陌生人订阅”和“好友关系”各自归属对应 manager，而不是把不同业务语义混进新的 manager。
- **Alternatives considered**:
  - 新建 `UserSubscriptionManager`：边界更细，但会额外增加 manager 注册和文档负担。
  - 把好友资料变化事件也并入 `UserInfoManager`：会削弱 `ContactManager` 作为联系人域入口的定位。

## Decision 3: 两类资料变化 notify 统一走新增的内部 user-info notify 通道，再由 `ChatClient` 编排

- **Decision**: `subscribe_metadata_updated` 与 `contact_metadata_updated` 都先由 `MessageReceiver` 识别为内部 user-info notify，再交给 `ChatClient` 统一完成归一化、版本比较、缓存写回和公开事件路由。
- **Rationale**:
  - 当前 group/chatroom 已采用“`MessageReceiver` 识别原始 notify -> `ChatClient` 编排 -> manager 对外派发”的模式，033 沿用这套结构改动最小。
  - 若直接在 `MessageReceiver` 派发公开事件，就会把 manager 依赖、缓存语义和版本比较逻辑推到接收层，导致职责膨胀。
  - 统一由 `ChatClient` 编排，最容易保证“先更新缓存，再派发事件”的顺序在两类 notify 上一致。
- **Alternatives considered**:
  - 在 `MessageReceiver` 直接派发 `onUserInfoUpdated` / `onContactInfoUpdated`：实现路径短，但会把公开语义塞进协议接收层。
  - 分别在 `UserInfoManager` / `ContactManager` 内各自监听原始 notify：会导致两条并行链路重复实现版本比较与 patch 逻辑。

## Decision 4: 资料真相采用“会话级完整资料运行时态 + 持久化摘要投影”双层模型

- **Decision**: 033 不扩展 localStorage 持久化模型，继续让 `UserInfoCache` 只保存摘要字段；完整 `UserInfo` 及其 `lastModified` 版本真相改为保存在当前登录会话内的运行时 store，并在需要时投影为 summary 写回缓存。
- **Rationale**:
  - 当前 `UserInfoSummary` 只能稳定承载 `nickname/avatarUrl/sign/ext`，无法完整承载 033 notify 可能带来的更多公开字段。
  - spec 已明确“不新增持久化介质”，但同时要求 notify 后当前会话内可立即读到最新资料，运行时态正好满足这两个约束。
  - 双层模型可以让 033 在不破坏 014/026 现有缓存落盘结构的前提下，补齐 notify 场景下的完整字段可见性。
- **Alternatives considered**:
  - 直接把 `UserInfoCache` 扩成完整持久化模型：收益不够高，且会影响现有缓存 schema 和兼容性。
  - 只写 summary、不保留完整运行时态：无法满足 FR-021 对更多公开字段“当前会话内可读”的要求。

## Decision 5: `lastModified` 比较以服务端版本为准，不能继续用 `Date.now()` 覆盖 summary 更新时间

- **Decision**: 033 的版本保护以服务端 `lastModified` 为准；summary `lastUpdate` 必须保留服务器时间戳语义，`UserInfoCache.setAll()` 不能再无条件覆写成 `Date.now()`。
- **Rationale**:
  - spec 明确要求旧 notify 不得覆盖新缓存，而这一点必须建立在可靠的服务端版本比较之上。
  - 当前 `UserInfoManager.projectToSummary()` 虽然会把 `lastModified` 投影到 `lastUpdate`，但 `UserInfoCache.setAll()` 又会统一覆写为当前时间，这会破坏版本语义。
  - 若不修正这一点，乱序 notify 场景下 SDK 可能把“后到达但更旧”的 patch 误判为新数据。
- **Alternatives considered**:
  - 继续用本地接收时间做新旧比较：实现简单，但无法正确处理多端重复投递和网络乱序。
  - 只在运行时态做版本保护，忽略 summary `lastUpdate`：会让缓存投影与运行时真相产生时间语义分叉。

## Decision 6: notify patch 合并采用“部分字段 merge + 等价重复去重 + 旧版本丢弃”策略

- **Decision**: 033 对 notify 中的 `metadata` 采用 patch merge，而不是全量替换；未出现的字段保持旧值；等价重复通知不重复派发；旧版本通知直接丢弃并记录日志。
- **Rationale**:
  - spec 明确指出 notify 可能只包含部分字段，未出现字段不能被静默清空。
  - 订阅与好友资料变化都属于高频通知场景，若对等价重复通知重复刷新和派发，会制造无意义抖动。
  - 旧版本 patch 若不丢弃，会直接破坏 FR-013 和 SC-006。
- **Alternatives considered**:
  - 每次 notify 视为全量资料快照：最简单，但会错误清空未出现字段。
  - 不做重复判定，每次都派发事件：逻辑更直接，但业务侧会收到大量等价噪音事件。

## Decision 7: 事件归属严格以服务端 notify 类型为准，不做本地二次推断

- **Decision**: 同一用户即使同时满足“好友 + 已订阅”，SDK 仍严格按服务端下发的 notify 类型派发事件：`subscribe_metadata_updated` 只派发 `onUserInfoUpdated`，`contact_metadata_updated` 只派发 `onContactInfoUpdated`。
- **Rationale**:
  - 这是 spec clarification 已经明确的业务规则，避免 SDK 本地基于关系推断额外合成事件。
  - 按 notify 类型派发可保持服务端真相与 SDK 对外语义一致，减少重复事件和跨 manager 职责混乱。
  - 这样也能让事件消费方基于事件名直接区分“订阅用户变化”和“好友资料变化”。
- **Alternatives considered**:
  - 同时派发订阅事件和好友事件：对业务方噪音更大，且与澄清结果冲突。
  - 本地根据好友关系重写事件类型：会让 SDK 语义脱离服务端真实下发。

## Decision 8: 联系人视图仍以关系快照为主，好友资料变化只更新 user-info 真相并按需重建联系人投影

- **Decision**: `contact_metadata_updated` 到来后，先更新统一 user-info 真相，再基于现有联系人关系快照重建联系人资料投影；若当前关系字段不完整，`onContactInfoUpdated` 仍派发最小事件，不因缺少 `remark/addTs` 吞掉整条通知。
- **Rationale**:
  - 025 已经把 `ContactManager.getContacts()` 固定为“关系快照 + userInfo 投影”的读取语义，033 不应改写这条主路径。
  - spec 明确要求 `getContacts()` 与好友事件保持一致，同时允许关系字段暂时缺失时仍继续派发事件。
  - 先更新 user-info 真相，再重建联系人投影，是保证“回调与后续读取一致”的最小改动方案。
- **Alternatives considered**:
  - 收到好友 notify 后强制远程刷新联系人：成本更高，也不符合“notify 自身完成闭环”的目标。
  - 关系字段缺失时直接放弃派发好友事件：与 FR-020 冲突。

## Decision 9: 订阅错误继续复用统一 REST 业务错误映射体系

- **Decision**: 033 的 401、403、400 两类超限错误继续走 `src/rest/api-errors.json` + `src/rest/errors.ts` + `RestBusinessError` 体系，不新增订阅专属异常基类。
- **Rationale**:
  - 仓库现有 manager 的 REST 业务错误都走统一映射体系，调用方已经形成稳定消费方式。
  - 033 已知错误数量有限，扩展统一映射比引入新异常层级更轻量。
  - 对“当前用户订阅数超限”和“目标用户被订阅数超限”做细分，适合在统一错误 entry 中通过 reason/action 表达。
- **Alternatives considered**:
  - 新建 `UserInfoSubscriptionError`：分类更细，但会让错误消费模型分裂。
  - 全部回退为 `REST_BUSINESS_UNKNOWN`：无法满足 FR-007 / FR-008 的可区分语义要求。
