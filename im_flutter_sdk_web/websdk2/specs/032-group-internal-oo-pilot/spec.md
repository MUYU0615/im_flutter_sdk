# 功能规格：Group 内部对象化试点

**Feature Branch**: `032-group-internal-oo-pilot`  
**Created**: 2026-04-22  
**Status**: Draft  
**Input**: 用户需求："基于 groupManager 当前设计，新增 032 规格，作为 SDK 内部完全面向对象架构的 group 试点；对外继续保持 plain data API 和轻量 handle，后续其他模块也往这个方向同步"

**Reference**:

- 既有公开 API 基线：`/Users/zhangdong/code/websdk2/specs/027-group-manager-api/spec.md`
- 跨模块架构总方案：`/Users/zhangdong/code/websdk2/plans/active/plan-sdk-internal-oo-architecture-2026-04-22.md`
- 当前 manager 注册规范：`/Users/zhangdong/code/websdk2/specs/009-manager-usage/spec.md`
- 当前事件系统规范：`/Users/zhangdong/code/websdk2/specs/004-event-system/spec.md`

## Clarifications

### Session 2026-04-22

- Q: 032 是否要重写 027 的公开 API 设计结论？ → A: 不重写；032 继承 027 的公开 API 契约，重点是 group 域内部架构重构试点。
- Q: 032 是否把群列表改成返回 `Group[]` 富对象？ → A: 不改；列表继续返回适合前端 state 的 plain data 快照。
- Q: 032 是否把内部领域对象直接暴露给 SDK 调用方？ → A: 不暴露；对外仍是 `GroupManager` + 轻量 `Group` public handle。
- Q: 032 是否同时覆盖 chatroom/contact/user-info？ → A: 不覆盖；032 只做 group 试点，并为后续模块同步提供模板。

## 设计决策

- 032 是对 027 的内部架构试点续作，不替代 027，也不回滚 027 中“列表返回 plain data + `getGroup(groupId)` 返回轻量 `Group`”的公开设计决策。
- 032 采用“内部领域对象 + 仓库 + 领域服务 + DTO/handle 适配层”的架构方向，但对外仍保持 027 的业务语义稳定。
- 032 的重点不是新增群能力，而是把当前堆积在 `GroupManager` 中的状态真相、事件 patch、详情补拉、用户补齐编排和实例复用逻辑从公开门面中拆出去。
- `GroupManager` 在 032 中继续作为公开 facade，负责参数校验、错误归一化、公开入口组织和少量应用层编排；不再承担 group 域运行时状态真相。
- 032 必须保持“内部对象是真相，外部 DTO 是快照”的边界：列表、详情、事件 payload 对外仍返回 plain data，不返回内部实体引用。
- `Group` 在 032 中继续保留为 public handle，但其职责从“薄转发 façade”升级为“绑定固定 `groupId` 的公开单群句柄”，背后接入内部 group 运行时真相，而不是直接暴露内部对象。
- 032 必须建立同一 `groupId` 的唯一运行时真相，避免列表读取、详情读取、`getGroup(groupId)` 和事件派发各自维护分叉状态。
- 032 要为后续 chatroom/contact/user-info 演进提供可复用模式，但不得为了“统一抽象”过早引入万能基类或通用继承体系。

## User Scenarios & Testing _(mandatory)_

### User Story 1 - 对外调用方式保持稳定，但内部状态模型完成收敛 (Priority: P1)

作为 SDK 使用者，我希望在升级到 032 后，现有 `GroupManager` 和 `Group` 的主调用方式保持不变，同时 SDK 内部能减少状态分叉和事件不一致问题，这样我不用修改业务代码，也能获得更稳定的群组行为。

**Why this priority**: 032 的首要价值不是新增群功能，而是在不破坏 027 公开契约的前提下，为 group 域建立可持续扩展的内部架构。如果对外行为变化过大，这次试点就失去意义。

**Independent Test**: 在保持 027 既有调用方式的前提下，验证 `getJoinedGroupList()`、`getGroup(groupId)`、`group.getDetail()`、`group.getMembers()` 和群事件监听等主路径的返回形态与使用方式不变，即可独立验证这一故事。

**Acceptance Scenarios**:

1. **Given** 调用方升级到包含 032 的 SDK，**When** 继续使用 `client.groupManager.getJoinedGroupList()`，**Then** 返回结果仍是 plain data 列表快照，而不是富对象数组。
2. **Given** 调用方继续使用 `client.groupManager.getGroup('g1')`，**When** 获取单群上下文对象，**Then** 得到的仍是公开 `Group` handle，而不是内部领域对象实例。
3. **Given** 调用方继续使用 `group.getDetail()`、`group.getMembers()`、`group.updateInfo()` 等公开方法，**When** 执行主路径操作，**Then** 外部调用方式、Promise 语义和业务返回风格保持与 027 一致。
4. **Given** 调用方持有先前返回的 `GroupSummary`、`GroupDetail` 或事件 payload，**When** 读取或缓存这些对象，**Then** 这些对象仍是独立快照，不会因为内部状态变化而被隐式篡改。

---

### User Story 2 - 群列表、详情与事件围绕同一运行时真相协作 (Priority: P1)

作为 SDK 使用者，我希望同一个群在列表查询、详情查询、单群 handle 调用和事件更新之间拥有一致的运行时语义，这样我不会遇到“详情是新的、事件是旧的、handle 里又是另一份状态”的分叉问题。

**Why this priority**: 如果 032 不能解决 group 域内部状态分叉问题，那么“内部对象化试点”就只是在换写法，没有带来真正的架构收益。

**Independent Test**: 模拟同一 `groupId` 先后经历列表读取、详情读取、事件更新和再次查询，验证公开返回虽然是快照，但内部状态演进是一致的，即可独立证明这条主价值链。

**Acceptance Scenarios**:

1. **Given** 同一个 `groupId` 已分别通过列表读取、详情读取和 `getGroup(groupId)` 进入 SDK 内部，**When** 后续收到该群的规格变更或状态变更事件，**Then** SDK 内部必须把这些路径收敛到同一运行时真相，而不是各自维护独立实例。
2. **Given** 某个群事件只携带部分字段，**When** SDK 需要对外派发完整群对象语义的事件，**Then** SDK 可以先对内部状态打 patch、标记失效或受控补拉详情，再导出标准化快照。
3. **Given** 调用方先获取了 `Group` handle，后续该群状态通过事件发生变化，**When** 调用方再次调用 `group.getDetail()` 或相关公开方法，**Then** 这些方法应基于更新后的内部真相导出结果，而不是固化在 handle 创建时的旧状态。
4. **Given** 调用方修改了外部拿到的 plain data 快照对象，**When** 后续再次从 SDK 读取同一群信息，**Then** SDK 内部运行时真相不应被外部 DTO 的本地修改污染。

---

### User Story 3 - 事件链路先更新内部状态，再对外导出标准化 payload (Priority: P1)

作为 SDK 使用者，我希望群事件在对外派发前已经完成内部状态更新和必要的补齐，这样我监听到的 payload 与后续主动读取结果能保持一致，不需要自己处理“事件和查询不一致”的收敛逻辑。

**Why this priority**: group 域当前最复杂、最容易失控的部分就是事件与读取链路的协作。032 如果不把这条链路收紧，后续 chatroom 也无法安全复用该模式。

**Independent Test**: 独立验证 `onSpecificationChanged`、`onStateChanged`、成员变更和管理员变更等关键事件在对外派发前已完成内部状态处理，即可独立验收这条故事。

**Acceptance Scenarios**:

1. **Given** SDK 收到群规格变更事件，**When** 需要对外派发 `onSpecificationChanged`，**Then** 应先更新内部 group 真相，再导出标准化 `GroupDetail` 快照作为事件 payload。
2. **Given** SDK 收到群状态变更事件且原始事件字段不足，**When** 对外派发 `onStateChanged`，**Then** SDK 必须先完成受控补偿或失效处理，不能直接把不完整原始字段作为最终 payload。
3. **Given** SDK 收到成员、管理员、禁言或 allowlist 相关事件，**When** 对外派发这些事件，**Then** 事件里的用户对象和群对象语义必须与后续主动读取结果保持一致，而不是各走一套拼装逻辑。
4. **Given** 用户资料补齐失败或部分缺失，**When** 主事件本身有效，**Then** SDK 仍需继续派发事件，并回退最小用户视图，而不能因为补齐失败丢弃整条事件。

---

### User Story 4 - 为后续 chatroom/contact/user-info 迁移提供稳定模板 (Priority: P2)

作为 SDK 维护者，我希望 group 先完成一轮受控的内部对象化试点，并把边界、职责和风险沉淀清楚，这样后续 chatroom、contact、user-info 迁移时不需要再从头定义架构规则。

**Why this priority**: 你已经明确这不是 group 的一次性优化，而是后续多个模块的统一方向。group 试点必须产出可复制的结构，而不是领域内特例。

**Independent Test**: 在 032 完成后，能够用清晰文档描述哪些边界可复用、哪些仅限 group 领域，即可独立证明本故事。

**Acceptance Scenarios**:

1. **Given** 维护者阅读 032 的 spec 与后续 plan，**When** 评估如何迁移 chatroom，**Then** 能清楚知道哪些模式可直接复用，例如内部对象、repository、snapshot mapper 和事件 patch 协作。
2. **Given** group 试点已经完成，**When** 规划 contact 或 user-info 的内部对象化，**Then** 能明确哪些原则通用、哪些必须按领域差异单独设计，而不是误以为所有模块都要照搬 `Group` handle 形式。
3. **Given** 032 的实现和验证结束，**When** 进入后续模块 spec 阶段，**Then** 后续特性可以把 032 作为已验证架构前提，而不是重新讨论“是否继续 plain data、是否公开内部对象”这类基础问题。

### Out of Scope

- 修改 027 已确定的群组公开 API 命名、返回形态或 `GroupManager + Group` 分层模型。
- 把群列表 API 改成返回 `Group[]` 富对象数组。
- 直接把内部领域对象暴露为公开 API 返回值。
- 在 032 中同步实现 chatroom、contact、user-info 的同类重构。
- 引入新的群组能力、扩展新的群事件集合或新增 demo 群组主路径。

### Edge Cases

- 同一个 `groupId` 在短时间内先被列表读取、再被详情读取、再被事件 patch 时，SDK 如何避免内部状态分叉。
- 群规格/状态事件原始字段不完整时，SDK 如何在“不阻塞主事件”和“保持 payload 完整语义”之间平衡。
- 用户资料补齐失败时，如何保证内部真相、事件 payload 和主动读取结果仍然可用。
- 调用方修改外部快照对象后，如何确保该修改不会反向污染 SDK 内部运行时状态。
- client 重新绑定、登出再登录或 manager 重建后，如何避免上一会话残留的内部对象泄漏到下一会话。
- 事件到达顺序与主动拉取结果交错时，如何避免旧详情覆盖新 patch。

## Test Layer Requirements _(mandatory)_

### Unit Tests

- Coverage goals: 覆盖 group 内部对象状态迁移、唯一实例语义、快照导出边界、事件 patch 合并、失效标记、用户资料补齐协作回退，以及 `Group` public handle 与内部对象分离约束。
- Planned location: `tests/unit/group/`、`tests/unit/managers/group-manager.test.ts`、`tests/types/group-manager-types.test.ts`
- Not applicable rationale: N/A，032 的主要价值来自内部状态模型与公开边界重构，单元测试必需。

### Integration Tests

- Coverage goals: 覆盖 `GroupManager` facade、内部 repository、REST 读取链路、用户资料补齐、EventHub 事件同步和公开 DTO 导出之间的协作；验证同一 `groupId` 在列表/详情/事件/handle 场景下围绕同一内部真相协作。
- Planned location: `tests/integration/group-manager/`、`tests/integration/mock/manager-public-api.test.ts`
- Not applicable rationale: N/A，032 直接影响 manager 协作与事件链路，集成测试必需。

### E2E Tests

- Coverage goals: 本期主要评估现有 demo 主路径是否受到公开 API 回归影响；不把 group 内部对象化本身纳入新的浏览器交互主路径。
- Planned location: 复用 `tests/e2e/` 现有结构；本期默认不新增 group 专项用例。
- Not applicable rationale: 032 不新增或改写浏览器 demo 的群组主交互路径，主要风险在 SDK 内部协作和公开语义保持，因此以单元 + 集成为主；若后续把 group 公开主路径接入 demo，再补 E2E。

### Gate Impact

- Required gates: `npm run test:gate:pr`
- Validation notes: PR gate 必须覆盖 group 内部对象化试点带来的单元、集成和类型边界回归；Nightly/Release gate 本期不新增 group 专项前提，但不得放松现有公开 API 回归检查。

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: 032 MUST 继承 `027-group-manager-api` 已定义的群组公开 API 契约，不得以内部架构试点为由改变既有主路径调用方式。
- **FR-002**: `getPublicGroupList` 与 `getJoinedGroupList` MUST 继续返回 plain data 列表结果，不得改成返回富对象数组。
- **FR-003**: `groupManager.getGroup(groupId)` MUST 继续返回公开 `Group` handle，而不是内部领域对象实例。
- **FR-004**: 032 MUST 在 group 域内部建立单个群组的唯一运行时真相，使同一 `groupId` 在列表、详情、事件和 public handle 链路中不再出现分叉状态。
- **FR-005**: 032 MUST 为 group 域建立明确的内部对象访问入口，以避免多个调用路径各自 `new` 出互不感知的群对象运行时实例。
- **FR-006**: `GroupManager` 在 032 中 MUST 继续作为公开 facade，负责参数校验、错误归一化、公开入口组织与少量应用层编排；不得继续承担 group 域的主要运行时状态真相。
- **FR-007**: 032 MUST 把当前聚集在 `GroupManager` 中的状态协调逻辑逐步收敛到内部对象协作层，包括但不限于实例复用、详情补拉决策、事件 patch 合并和快照导出前的状态整理。
- **FR-008**: 对外返回的 `GroupSummary`、`GroupDetail`、成员列表、管理员列表、共享文件列表和事件 payload MUST 保持快照语义，不得暴露内部对象可变引用。
- **FR-009**: SDK MUST 保证调用方对外部 DTO 的本地修改不会回写或污染内部 group 运行时真相。
- **FR-010**: 任何需要网络访问的公开群方法 MUST 继续保持显式异步语义，不得因为内部对象化而引入属性式隐式加载。
- **FR-011**: 032 MUST 在群事件对外派发前先完成内部 group 真相更新，再导出公开 payload。
- **FR-012**: 对于 `onSpecificationChanged`、`onStateChanged` 这类要求完整群对象语义的事件，032 MUST 在内部状态不足时执行受控补偿、失效标记或等价收敛策略，确保最终对外 payload 仍满足 027 的完整语义要求。
- **FR-013**: 群事件与主动查询 MUST 共享同一套群对象标准化与用户资料补齐协作规则，不得形成“事件一套、查询一套”的长期分叉。
- **FR-014**: 当用户资料补齐失败或部分缺失时，只要主业务数据有效，032 MUST 继续导出主结果或主事件，并回退最小用户对象视图。
- **FR-015**: `Group` public handle MUST 绑定固定 `groupId`，并通过内部运行时真相提供后续读取与 mutation 能力；handle 本身不得成为另一份独立状态真相。
- **FR-016**: 032 MUST 明确 group 域内部运行时对象在 client 重新绑定、登出重登或 manager 生命周期变化时的清理/失效边界，避免跨会话污染。
- **FR-017**: 032 SHOULD 为后续 chatroom 迁移沉淀可复用模式，如内部对象、唯一实例访问、快照导出与事件 patch 协作，但 MUST NOT 以引入复杂通用基类为前提。
- **FR-018**: 032 MUST 在文档和测试中清楚区分“公开 `Group` handle”与“内部 group 真相对象”，避免后续模块误把两者视为同一概念。
- **FR-019**: 032 MUST 保持与 `specs/004-event-system/spec.md` 和 `specs/009-manager-usage/spec.md` 的兼容，不得因内部重构破坏现有 manager 注册或事件监听模式。
- **FR-020**: 032 MUST 作为 group 域内部对象化试点，为后续 chatroom/contact/user-info spec 提供可引用的已验证边界，但 032 自身不得扩大为跨模块一次性重构。

### Key Entities _(include if feature involves data)_

- **Internal Group Runtime**: group 域内部唯一运行时真相，表示某个 `groupId` 在当前 client 会话内的已知状态、失效状态和事件合并结果；不对外暴露。
- **Group Repository**: group 域内部对象访问入口，负责定位、复用、更新和失效处理单个群的内部运行时真相。
- **Group Public Handle**: 由 `groupManager.getGroup(groupId)` 返回的公开句柄，绑定固定 `groupId`，负责承载公开单群调用，但不承担内部状态真相职责。
- **Group Snapshot**: 对外返回的群列表项、群详情或事件中的标准化群对象快照，适用于前端 state、缓存和序列化。
- **Group Event Patch**: 从原始群事件中提取出的内部状态变更片段，用于更新内部运行时真相，再导出公开 payload。

### Assumptions

- 027 已经定义并交付了 group 域的公开 API 边界，032 不再重新讨论这些基础决策。
- group 是最适合内部对象化试点的模块，因为它已经存在 `GroupManager + Group` 的公开边界雏形。
- chatroom 与 group 同构度较高，若 032 试点成功，后续优先同步 chatroom。
- contact 和 user-info 的内部对象化方向会复用 032 的边界原则，但不会简单复制 `Group` public handle 形态。
- 当前 demo 不以 group 作为浏览器主路径，因此 032 的核心验证重点在 SDK 内部协作而非 UI 演示。

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 032 完成后，027 已定义的 group 主调用方式在主示例和主测试路径中的改动需求为 0，调用方无需因为内部对象化试点修改既有主路径代码。
- **SC-002**: 针对同一 `groupId` 的列表读取、详情读取、public handle 调用和事件更新，在 032 新增或更新的测试覆盖场景中，100% 围绕单一内部运行时真相协作，不再出现已知状态分叉回归。
- **SC-003**: `onSpecificationChanged` 和 `onStateChanged` 在 032 覆盖的验证场景中，100% 继续返回满足 027 语义的完整群对象 payload，而不是退化为不完整 patch。
- **SC-004**: 032 新增的单元、集成和类型测试能够明确证明“内部对象不对外暴露、外部 DTO 不反向污染内部状态、事件先更新内部再对外派发”三条核心边界。
- **SC-005**: 032 完成后，后续模块 spec 可以直接引用其已验证结论，明确延续“内部对象化、对外 plain data”的总方向，而不必重新定义 group 试点中已确认的基础边界。
