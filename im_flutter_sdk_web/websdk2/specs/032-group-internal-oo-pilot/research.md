# Research: Group 内部对象化试点

## Decision 1: 先采用 `src/managers/group/internal/` 过渡目录，而不是立即引入全局 `src/domain/`

- **Decision**: 032 先在 `src/managers/group/internal/` 下引入 `internal-group`、`group-repository`、`group-event-sync` 和 `group-snapshot-mapper`，不在试点阶段直接做全仓级目录重排。
- **Rationale**:
  - 本期目标是验证 group 域内部对象化模式，而不是同时完成仓库目录治理。
  - 当前 group 相关逻辑已经集中在 `src/managers/group/` 与 `src/managers/group-manager.ts`，在局部目录内试点改动最小。
  - 若试点失败，局部回退成本远低于全局 `src/domain/` 重排。
- **Alternatives considered**:
  - 立即引入全局 `src/domain/`：长期形态更整洁，但会过早扩大影响面。
  - 继续把新逻辑堆在 `GroupManager` 与 `group.ts`：无法验证清晰的内部对象边界。

## Decision 2: `Group` 继续作为 public handle，不直接升级为内部真相对象

- **Decision**: 对外 `Group` 继续保留为绑定 `groupId` 的 public handle，内部运行时真相由 `InternalGroup` 承担。
- **Rationale**:
  - 027 已经明确 `Group` 不是本地状态真相，而是单群上下文 façade。
  - 如果直接把 `Group` 升级为内部真相对象，会把内部生命周期、缓存语义和事件同步细节泄漏到公开 API。
  - 保留 handle 语义，最容易做到“内部重构、外部不变”。
- **Alternatives considered**:
  - 让 `Group === InternalGroup`：实现简单，但公开边界被破坏。
  - 彻底取消 `Group`：与 027 公开契约冲突。

## Decision 3: 通过 `GroupRepository` 提供同一 `groupId` 的唯一运行时真相

- **Decision**: 以 `GroupRepository` 作为内部 group 真相唯一访问入口，统一管理 `groupId -> InternalGroup` identity map。
- **Rationale**:
  - 当前 group 域已有列表读取、详情读取、event payload 和 `getGroup(groupId)` 多条入口。
  - 没有 repository，内部对象化会继续退化成“多处各自 new 对象”的伪 OO。
  - repository 可以显式承接实例复用、清理和失效边界，便于后续复用到 chatroom。
- **Alternatives considered**:
  - 继续保留 `GroupManager.groupRegistry`：只解决 `getGroup(groupId)` 复用，解决不了列表/详情/事件统一真相。
  - 把 identity map 放在 `InternalGroup` 静态属性：会把生命周期与 client 会话边界做乱。

## Decision 4: 事件必须先更新内部真相，再导出公开 payload

- **Decision**: 032 中所有 group 域关键事件都先通过 `group-event-sync` 更新或失效内部真相，再由 mapper 导出最终 payload。
- **Rationale**:
  - 这是解决“事件看到的数据”和“后续主动读取的数据”不一致的关键。
  - 对 `onSpecificationChanged` / `onStateChanged` 这类完整对象事件，必须先收敛内部状态，才能安全导出完整快照。
  - 该模式后续可直接复用到 chatroom。
- **Alternatives considered**:
  - 继续直接从事件原始字段拼 payload：实现简单，但长期会和主动查询分叉。
  - 每次事件都先拉详情：过重，且会放大网络依赖和时延。

## Decision 5: 列表、详情和事件 payload 继续保持快照语义

- **Decision**: `GroupSummary`、`GroupDetail` 和事件中的群对象 payload 都由 `group-snapshot-mapper` 导出独立快照，不返回内部可变引用。
- **Rationale**:
  - Web SDK 调用方普遍会把这些对象直接放入 state、缓存和序列化链路。
  - 快照语义能避免外部修改对象后污染 SDK 内部运行时真相。
  - 这与 027 的公开模型保持一致。
- **Alternatives considered**:
  - 返回只读代理包装内部对象：语义复杂且容易泄漏实现。
  - 返回内部对象自身：与对外 plain data 方向冲突。

## Decision 6: 用户资料补齐策略继续复用现有 resolver，但由 repository 协调调用时机

- **Decision**: 现有 `group-event-user-info-resolver` 和相关 hydrate 逻辑继续保留，032 主要调整调用归属和协作边界，不重写 user-info 补齐机制。
- **Rationale**:
  - 现有 cache-first + batch-fetch-fallback 策略已经在 027 中验证过。
  - 032 的重点是状态真相和对象边界，不是 user-info 域重构。
  - repository 协调调用时机即可解决“事件一套、查询一套”的分叉，而不必重写 resolver。
- **Alternatives considered**:
  - 同时重构 user-info 补齐体系：会扩大 032 范围。
  - 完全不调整补齐调用归属：难以达成事件和主动查询的一致性。

## Decision 7: client 生命周期切换时显式清理 repository

- **Decision**: 当 `GroupManager` 重新 bind、新 client 初始化、登出重登或用户身份切换时，repository 中的内部运行时对象必须显式失效或清空。
- **Rationale**:
  - `groupId` 本身不能代表跨会话有效性；不同用户、不同 token 下的群状态可能不同。
  - 不清理 identity map 会导致跨会话污染，这是对象化试点的主要风险之一。
  - 显式清理比尝试自动“猜测还能不能复用”更安全。
- **Alternatives considered**:
  - 仅按 `groupId` 长期复用：存在跨会话脏状态风险。
  - 每次公开调用都重新创建内部对象：失去对象化试点的意义。

## Decision 8: 成员类事件优先做 `memberCount` runtime patch，无基线时再回退 `stale`

- **Decision**: `onMemberJoined` / `onMembersJoined` / `onMemberExited` / `onMembersExited` 不再一律把 detail 标记为 `stale`；当当前 `GroupDetail` 已知 `memberCount` 时，直接在 runtime 上按事件人数增减 patch，只有拿不到计数基线时才回退为 `stale -> getDetail()` 的受控补拉。
- **Rationale**:
  - 成员进出事件是最频繁的 group 状态变更之一，全部退化为补拉会让内部对象化失去价值。
  - `memberCount` 是少数可以从事件中稳定、安全做增量 patch 的 detail 字段，适合作为 032 的第一批细粒度 patch 试点。
  - 保留“无基线则 stale”的兜底策略，能兼顾正确性与渐进演进。
- **Alternatives considered**:
  - 一律 `stale`：正确但保守，无法体现 internal runtime 的持续价值。
  - 一律相信事件并 patch：在初始 detail 不完整时容易制造错误计数。

## Decision 9: 群失效类事件和主动 mutation 成功后要直接清理单群 runtime

- **Decision**: `onUserRemoved`、`onGroupDestroyed`、`destroyGroup()`、`leaveGroup()` 成功后，不再只标记对应 group `stale`，而是直接从 `GroupRepository` 删除该 `groupId` 的 runtime。
- **Rationale**:
  - 这类语义不是“当前详情过期”，而是“这份内部真相本身已经失效”，继续保留缓存会让公开 `Group` handle 命中过期详情。
  - 删除单群 runtime 后，后续 `group.getDetail()` 会重新走显式详情读取，语义更贴近真实生命周期。
  - 这套“stale 与 delete 分离”的策略后续可直接迁移到 chatroom。
- **Alternatives considered**:
  - 继续仅 `markStale`：下一次读取仍可能先接触到已失效 runtime，语义不够干净。
  - 直接清空整个 repository：范围过大，会误伤同会话下其他群组的有效缓存。
