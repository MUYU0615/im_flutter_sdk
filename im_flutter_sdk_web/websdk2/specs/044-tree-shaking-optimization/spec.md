# Feature Specification: ChatClient Tree-Shaking 优化

**Feature Branch**: `044-tree-shaking-optimization`  
**Created**: 2026-05-28  
**Status**: Draft  
**Input**: User description: "评估当前 ChatClient + Manager 架构是否达到按需 tree-shaking 目标，尤其小程序平台包体积更苛刻；当前 ChatClient 仍硬引用多个 Manager 域逻辑，需要创建 Speckit spec。补充：当前初始化有自动同步联系人开关，开启后会用到 UserInfoManager；未来群组也会有类似自动同步开关，需要明确是否要求开启开关时必须传对应 manager。"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - 只使用核心能力时不打包未注册 Manager (Priority: P1)

作为 SDK 使用者，我希望只初始化 `ChatClient` 或只注册少量 Manager 时，未使用的群组、聊天室、联系人、用户资料、在线状态、推送等能力不会进入我的业务包，这样 Web 与小程序应用可以按实际功能控制 SDK 体积。

**Why this priority**: `ChatClient + Manager` 架构的核心价值就是按需组合能力。如果只导入核心入口仍拉入大量 Manager 域代码，小程序平台会更容易触及包体积限制，也会削弱 SDK 架构初衷。

**Independent Test**: 构建一个仅初始化 `ChatClient` 且不注册任何 Manager 的最小消费用例，检查产物依赖图中不包含未注册 Manager 的运行时代码，并记录压缩体积基线。

**Acceptance Scenarios**:

1. **Given** 调用方只导入并初始化 `ChatClient`，**When** 构建最小业务包，**Then** 未注册 Manager 的运行时代码不应出现在依赖图中。
2. **Given** 调用方只注册 `ChatManager`，**When** 构建业务包，**Then** 群组、聊天室、联系人、用户资料、在线状态、推送等未注册域的运行时代码不应被 `ChatClient` 间接拉入。
3. **Given** 调用方注册 `GroupManager` 但不注册 `ChatRoomManager`，**When** 构建业务包，**Then** 群组能力可用且聊天室管理能力不应进入运行时依赖图。

---

### User Story 2 - Manager 事件只在对应 Manager 注册后处理 (Priority: P1)

作为 SDK 使用者，我希望群组、聊天室、联系人、会话线程、用户资料等域事件只由对应 Manager 处理，这样未注册的域不会因为 `ChatClient` 默认监听和规范化事件而增加包体积或运行时开销。

**Why this priority**: 当前 `ChatClient` 承担多种域事件规范化、补资料和派发逻辑，是 tree-shaking 泄漏的主要来源。事件处理权下放后，按需注册才具备真实打包收益。

**Independent Test**: 注册单个 Manager 并模拟对应原始通知，验证事件可被该 Manager 转换为公开事件；不注册该 Manager 时，模拟同类通知不会触发该域公开事件，也不会要求加载该域事件处理代码。

**Acceptance Scenarios**:

1. **Given** 调用方注册了 `GroupManager`，**When** SDK 收到群组原始通知，**Then** 群组公开事件应按既有业务语义派发。
2. **Given** 调用方未注册 `GroupManager`，**When** SDK 收到群组原始通知，**Then** SDK 不应执行群组事件规范化、群资料补全或群组公开事件派发。
3. **Given** 调用方注册了 `ChatRoomManager`，**When** SDK 收到聊天室原始通知，**Then** 聊天室公开事件应按既有业务语义派发。
4. **Given** 调用方未注册 `ChatRoomManager`，**When** SDK 收到聊天室原始通知，**Then** SDK 不应执行聊天室事件规范化、聊天室详情拉取或聊天室公开事件派发。

---

### User Story 3 - 自动同步开关显式声明依赖能力 (Priority: P1)

作为 SDK 使用者，我希望开启联系人、用户资料、未来群组等自动同步开关时，SDK 明确要求我注册对应 Manager 或提供对应能力，而不是静默拉入隐藏依赖，这样我能准确知道哪些功能会增加包体积。

**Why this priority**: 自动同步是跨域能力，若 `ChatClient` 为了满足开关隐式创建 `UserInfoManager` 或未来隐式创建 `GroupManager`，就会重新破坏 tree-shaking 边界。显式依赖和 fail-fast 错误能让配置行为可预测。

**Independent Test**: 构建开启自动同步但未注册依赖 Manager 的初始化用例，验证 SDK 在初始化或登录前给出明确配置错误；再注册所需 Manager 后，自动同步流程按预期工作。

**Acceptance Scenarios**:

1. **Given** 调用方开启联系人自动同步且未注册用户资料能力，**When** SDK 校验初始化或登录配置，**Then** SDK 应抛出明确错误，说明需要注册用户资料相关 Manager 或能力提供者。
2. **Given** 调用方开启联系人自动同步且已注册所需用户资料能力，**When** 联系人同步产生资料补全需求，**Then** SDK 应通过显式注册的能力获取资料并更新缓存。
3. **Given** 未来引入群组自动同步开关，**When** 调用方开启该开关但缺少群组同步所需 Manager，**Then** SDK 应 fail fast，而不是隐式拉入群组 Manager 或静默跳过同步。
4. **Given** 调用方关闭自动同步开关，**When** 构建最小业务包，**Then** 自动同步相关可选能力不应因默认配置进入运行时依赖图。

---

### User Story 4 - 小程序用户获得明确的按需导入路径和体积验收 (Priority: P2)

作为小程序开发者，我希望 SDK 明确推荐可 tree-shaking 的导入方式，并提供能验证包体积的检查结果，这样我能在小程序限制下安全选择所需 Manager。

**Why this priority**: 小程序构建链对 ESM、子路径导入和副作用标记的支持可能不同于现代 Web 打包器。只有给出明确导入约束和验收方法，按需打包才可落地。

**Independent Test**: 使用小程序等价消费入口分别构建 `ChatClient only`、`ChatClient + ChatManager`、`ChatClient + GroupManager` 三个场景，验证依赖图和体积阈值符合预期。

**Acceptance Scenarios**:

1. **Given** 调用方按文档使用 Manager 子路径导入，**When** 构建小程序业务包，**Then** 只应包含已导入 Manager 的运行时代码。
2. **Given** 调用方从主入口导入多个 Manager，**When** 该导入方式在目标构建链无法稳定 tree-shaking，**Then** SDK 文档应提示改用子路径导入。
3. **Given** 发布前执行包体积检查，**When** 未注册 Manager 被核心入口拉入，**Then** 检查应失败并指出泄漏域。

### Edge Cases

- 开启自动同步开关但缺少依赖 Manager 时，SDK 必须给出可操作错误，不允许静默降级为 no-op。
- 已注册 Manager 的事件行为必须保持业务兼容；下放事件处理不应改变事件名称、业务 payload、错误语义或缓存更新结果。
- 未注册 Manager 的域通知可以被核心连接层安全忽略，但不得影响连接、收消息、发消息等核心能力。
- 类型导出、文档生成和 API Reference 不应因为拆分 Manager 入口而丢失公开类型。
- IIFE 全量包仍可以包含全部能力，但不得作为小程序按需体积的推荐入口。
- 如果某个能力属于多个域共享，必须明确归属为核心能力或可选能力，避免通过共享工具重新引入完整 Manager。
- 若构建工具不支持有效 tree-shaking，SDK 应通过子路径入口和文档降低风险，而不是承诺所有消费方式都能自动摇掉未用代码。

## Test Layer Requirements _(mandatory)_

### Unit Tests

- Coverage goals: 覆盖 Manager 注册依赖校验、自动同步开关缺少依赖时的 fail-fast 错误、未注册 Manager 时域通知不派发公开事件、已注册 Manager 时域通知仍转换为业务事件、共享能力不会隐式创建 Manager。
- Planned location: `tests/unit/chat-client-tree-shaking/`、`tests/unit/managers/`、`tests/unit/core/message/`
- Not applicable rationale: N/A，本功能改变 Manager 边界和配置校验，单元测试必需。

### Integration Tests

- Coverage goals: 覆盖 `ChatClient`、`CoreSDK`、`MessageReceiver`、EventHub 与各 Manager 的协作；验证联系人自动同步与用户资料能力、未来群组自动同步依赖声明、缓存更新、REST 能力归属和未注册域通知处理。
- Planned location: `tests/integration/tree-shaking/`、`tests/integration/mock/manager-boundaries.test.ts`
- Not applicable rationale: N/A，本功能涉及跨模块协作、事件链路和缓存/同步链路，集成测试必需。

### E2E Tests

- Coverage goals: 覆盖 demo 或等价浏览器入口的基础登录、连接、发消息主路径不回退；覆盖小程序等价消费入口的按需导入和包体积检查。
- Planned location: `tests/e2e/api/`、`tests/e2e/demo/`、新增或复用包体积验证脚本对应 fixtures。
- Not applicable rationale: N/A，本功能的核心收益是消费端构建结果，必须有端到端或等价构建验证兜底。

### Gate Impact

- Required gates: `npm run test:run`、`npm run lint`、`npm run type-check`、包体积/依赖图检查脚本；若公开 API 或文档入口调整，补跑 `npm run docs:api:check`。
- Validation notes: PR gate 必须阻塞 `ChatClient only` 产物重新拉入未注册 Manager；Release gate 必须覆盖小程序等价入口和全量入口，避免按需导入回归。

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: SDK MUST preserve the `ChatClient + Manager` usage model where callers explicitly select optional domain capabilities.
- **FR-002**: Importing and initializing `ChatClient` alone MUST NOT require loading unregistered Manager runtime implementations.
- **FR-003**: Registering one Manager MUST NOT require loading unrelated Manager runtime implementations.
- **FR-004**: `ChatClient` MUST NOT implicitly create optional Manager instances to satisfy domain features.
- **FR-005**: Domain notification handling for group, chatroom, contact, chat thread, and user profile capabilities MUST be owned by the corresponding registered Manager or explicitly registered optional capability.
- **FR-006**: When the corresponding Manager is not registered, SDK MUST ignore that domain's optional notification without dispatching its public Manager events.
- **FR-007**: When the corresponding Manager is registered, SDK MUST preserve existing public event names and business payload semantics for that domain.
- **FR-008**: Optional domain REST operations MUST NOT be pulled into the core `ChatClient` path unless the owning Manager or optional capability is registered.
- **FR-009**: User profile enrichment for optional domain events MUST use an explicitly registered user profile capability and MUST NOT cause `ChatClient` to import or instantiate user profile management code.
- **FR-010**: Message/profile synchronization that depends on user profile or group namecard data MUST be disabled by default unless its required explicit capability is present.
- **FR-011**: If a caller enables contact auto-sync and the required user profile capability is missing, SDK MUST fail fast with a clear configuration error before performing sync work.
- **FR-012**: If a caller enables future group auto-sync and required group or user profile capability is missing, SDK MUST fail fast with a clear configuration error before performing sync work.
- **FR-013**: If a caller disables an auto-sync option, SDK MUST NOT load that auto-sync option's optional domain capability solely for background enrichment.
- **FR-014**: SDK MUST document the recommended tree-shakable import style for Manager usage, including subpath imports for size-sensitive consumers.
- **FR-015**: SDK MUST keep public type exports available for documented Manager usage without forcing runtime inclusion of every Manager.
- **FR-016**: SDK MUST provide an automated dependency graph or bundle-size check that verifies `ChatClient only` does not include unregistered Manager runtime modules.
- **FR-017**: SDK MUST provide automated checks for at least `ChatClient only`, `ChatClient + ChatManager`, and `ChatClient + one non-chat Manager` consumption scenarios.
- **FR-018**: SDK MUST treat IIFE/full bundle as an all-capabilities distribution and MUST NOT use it as evidence that tree-shaking goals are met.
- **FR-019**: SDK MUST preserve core connection, login, send message, receive message, cache access, and Manager registration behavior after optional domain code is removed from the core path.
- **FR-020**: SDK MUST keep errors user-actionable when configuration dependencies are missing, including which option caused the dependency and which Manager or capability must be registered.

### Key Entities _(include if feature involves data)_

- **Core Client**: The always-loaded SDK entry that owns initialization, connection lifecycle, message send/receive basics, cache access, and Manager registration.
- **Optional Manager**: A domain capability selected by the caller, such as chat, group, chatroom, contact, presence, push, user profile, or chat thread.
- **Optional Capability Dependency**: A required capability for an enabled option, such as user profile access required by contact auto-sync enrichment.
- **Domain Notification**: A raw runtime notification associated with an optional domain, handled only when the matching Manager or capability is registered.
- **Consumption Scenario**: A representative application import and initialization pattern used to validate dependency graph and package size outcomes.
- **Bundle Size Baseline**: A recorded size and dependency graph expectation for each consumption scenario.

### Assumptions

- This feature prioritizes ESM/module consumers and小程序等 size-sensitive consumers; IIFE remains an all-in-one distribution.
- Existing public `ChatClient.use(Manager)` usage remains valid.
- For size-sensitive consumers, Manager subpath imports are the recommended usage style.
- Fail-fast dependency validation is preferred over silent degradation when a caller explicitly enables an auto-sync option.
- Some protocol, connection, upload, cache, and platform code remains core because it is required by baseline IM messaging.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: In the `ChatClient only` consumption scenario, 0 unregistered Manager runtime modules appear in the verified dependency graph.
- **SC-002**: In the `ChatClient + ChatManager` consumption scenario, 0 group, chatroom, contact, presence, push, or user profile Manager runtime modules appear unless explicitly registered or required by an enabled option.
- **SC-003**: In the `ChatClient + GroupManager` consumption scenario, chatroom, contact, presence, push, and chat-thread Manager runtime modules remain absent from the verified dependency graph.
- **SC-004**: Enabling contact auto-sync without the required user profile capability fails in 100% of covered configuration tests with a user-actionable error.
- **SC-005**: Registered Manager event compatibility tests pass for 100% of domains moved out of `ChatClient`.
- **SC-006**: Size-sensitive consumption documentation includes at least 3 verified import examples: core only, core plus chat, and core plus one non-chat Manager.
- **SC-007**: Release validation records bundle-size or dependency-graph results for Web ESM and小程序-equivalent consumption scenarios.
