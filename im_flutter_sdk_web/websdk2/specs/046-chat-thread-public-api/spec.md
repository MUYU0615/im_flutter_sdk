# Feature Specification: ChatThread 公开 API

**Feature Branch**: `046-chat-thread-public-api`
**Created**: 2026-06-04
**Status**: Draft
**Input**: User description: "原本 sdk 是不想暴露 thread 模块的，现在决定加上；看当前 chat-thread-manager 的现状，判断离正式公开还差什么，并决定写计划还是写 spec。用户确认不用新建分支。补充要求：Thread 事件不要全放在 changed 事件里根据 operation 区分，要做成和群组一样的独立事件，payload 字段符合当前命名；实现参考原工程 `/Users/zhangdong/code/websdk-new/packages/IM/sdk/src/apis/threadApi.ts` 和 `/Users/zhangdong/code/websdk-new/packages/IM/sdk/src/handleMessages/handleMucMsg.ts`；必须有测试 case、错误码和 API Reference。更正：Thread 事件需要和移动端对齐，只公开 `onChatThreadCreated`、`onChatThreadDestroyed`、`onChatThreadUpdated`、`onChatThreadUserRemoved` 4 个事件。"

## Clarifications

### Session 2026-06-04

- Q: Thread 独立事件命名采用哪套公开事件名？ → A: 与移动端对齐，最终公开事件为 `onChatThreadCreated`、`onChatThreadDestroyed`、`onChatThreadUpdated`、`onChatThreadUserRemoved`。
- Q: 是否保留旧的 `onChatThreadChange` 兼容事件？ → A: 不公开也不派发 `onChatThreadChange`，只保留内部 raw notify 到独立事件。
- Q: Thread 加入/离开事件的接收语义是什么？ → A: 不公开加入/离开事件；当前登录用户被群主或管理员移出子区时派发 `onChatThreadUserRemoved`。
- Q: Thread 错误码策略是什么？ → A: 在 `api-errors.json` 为每个 Thread operation 补服务端错误和 `localErrors`。
- Q: ChatThread API Reference 公开范围是什么？ → A: 完整公开主入口、`./managers/chat-thread`、`ChatThreadManager`、`ChatThread`、全部类型与独立事件。

## User Scenarios & Testing _(mandatory)_

### User Story 1 - 开发者能发现并注册 ChatThread 能力 (Priority: P1)

SDK 使用者需要在公开入口和文档中明确发现 ChatThread 能力，并能用一致的方式注册 `ChatThreadManager`，获得类型提示和稳定的导入路径。

**Why this priority**: 如果开发者无法可靠发现和注册该能力，后续创建、查询、事件监听都无法形成正式公开能力。

**Independent Test**: 只验证公开入口、类型导出和最小注册示例，即可确认开发者能从 SDK 正式入口使用 ChatThread 能力。

**Acceptance Scenarios**:

1. **Given** 开发者已安装 SDK，**When** 从 SDK 主入口或 manager 子路径导入 ChatThread 能力，**Then** 能获得公开类型、管理器类和实体类。
2. **Given** 开发者已初始化并登录 SDK，**When** 注册 `ChatThreadManager`，**Then** 客户端实例上能以文档声明的属性访问 ChatThread 管理能力。
3. **Given** 开发者查看 API Reference，**When** 搜索 ChatThread 相关能力，**Then** 能看到管理器、实体对象、参数类型、返回类型和事件类型。

---

### User Story 2 - 开发者能完成 Thread 主路径管理 (Priority: P1)

SDK 使用者需要通过正式公开 API 创建 Thread、查询 Thread、加入或退出 Thread、修改名称、销毁 Thread、管理成员，并批量查询 Thread 最后一条消息。

**Why this priority**: 这是 Thread 模块从内部能力转为公开能力的核心用户价值。

**Independent Test**: 使用已登录客户端和可用群组，逐项调用 Thread 管理能力，并断言返回对象、分页结果和无返回值操作符合公开契约。

**Acceptance Scenarios**:

1. **Given** 用户在一个群组中且具备创建 Thread 条件，**When** 创建 Thread，**Then** 返回新 Thread ID，且该 ID 可用于后续查询。
2. **Given** 已存在 Thread，**When** 查询 Thread 详情、群内 Thread 列表或当前用户已加入 Thread 列表，**Then** 返回标准化业务对象，不透传服务端原始响应包装。
3. **Given** 已存在 Thread，**When** 用户加入、退出、修改名称、销毁或移除成员，**Then** 成功时返回空结果，失败时抛出统一 SDK 错误。
4. **Given** 调用方提供多个 Thread ID，**When** 批量查询最后一条消息，**Then** 返回每个可查询 Thread 的最后一条消息摘要或空值。

---

### User Story 3 - 开发者能使用 ChatThread 实体对象 (Priority: P2)

SDK 使用者需要通过管理器获取单个 Thread 实体对象，并围绕该 Thread ID 进行详情、成员和生命周期操作，减少重复传入 Thread ID。

**Why this priority**: 实体对象是当前 SDK manager 体系中常见的对象化用法，正式公开后应与群组、聊天室等模块保持体验一致。

**Independent Test**: 获取同一个 Thread ID 的实体对象并连续调用实体方法，确认所有方法与管理器方法语义一致。

**Acceptance Scenarios**:

1. **Given** 开发者已获得一个 Thread ID，**When** 通过管理器获取 Thread 实体，**Then** 实体暴露该 Thread ID，并能复用同一上下文执行操作。
2. **Given** 开发者调用实体对象的查询或成员方法，**When** 操作成功，**Then** 返回值与对应管理器方法一致。
3. **Given** 开发者传入空 Thread ID，**When** 获取实体对象，**Then** 抛出明确的参数校验错误。

---

### User Story 4 - 开发者能可靠监听移动端对齐的 Thread 事件 (Priority: P2)

SDK 使用者需要监听与移动端对齐的 Thread 独立事件，而不是监听一个聚合变更事件后再根据 `operation` 判断业务动作。

**Why this priority**: Thread 是群组内协作能力，事件一致性直接影响 UI 刷新、消息聚合和多端同步体验；独立事件能减少业务侧分支判断，并与现有群组事件模型保持一致。

**Independent Test**: 模拟或接收 Thread 原始通知，确认创建、解散、更新和当前用户被移出被派发到对应的独立公开事件，payload 字段与当前 SDK 命名一致，且只在注册相关管理器后派发到公开事件处理器。

**Acceptance Scenarios**:

1. **Given** 客户端已注册 ChatThread 能力并添加事件处理器，**When** 收到 Thread 创建通知，**Then** 派发 `onChatThreadCreated`，payload 包含 `chatThreadId`、`chatThreadName`、`parentId`、`operatorId`、`messageId` 和 `timestamp`。
2. **Given** 客户端已注册 ChatThread 能力并添加事件处理器，**When** 收到 Thread 解散通知，**Then** 派发 `onChatThreadDestroyed`，payload 包含 `chatThreadId`、`parentId`、`operatorId` 和 `timestamp`。
3. **Given** 客户端已注册 ChatThread 能力并添加事件处理器，**When** Thread 名称被修改，或 Thread 中添加、撤销回复消息，**Then** 派发 `onChatThreadUpdated`，payload 使用 `chatThreadId`、`chatThreadName`、`parentId`、`operatorId`、`messageId`、`messageCount`、`lastMessage`、`timestamp` 等当前命名字段。
4. **Given** 当前登录用户被群主或群管理员移出 Thread，**When** 收到对应通知，**Then** 派发 `onChatThreadUserRemoved`，payload 包含 `chatThreadId`、`parentId`、`operatorId`、`memberId` 和 `timestamp`。
5. **Given** 客户端未注册 ChatThread 能力，**When** 收到 Thread 原始通知，**Then** 不应向公开事件处理器派发 ChatThread 事件。
6. **Given** 收到无法识别或字段不足的 Thread 通知，**When** 事件归一化失败，**Then** 不应派发不完整的公开事件。

---

### User Story 5 - 开发者能通过文档处理错误和边界 (Priority: P3)

SDK 使用者需要在 API Reference 和集成文档中理解参数限制、权限要求、服务端错误和本地校验错误。

**Why this priority**: 正式公开后，错误码和文档会成为用户排障与客服支持的主要依据。

**Independent Test**: 查看每个公开方法的 API Reference，确认参数、返回值、示例和错误码表完整，并能通过无效参数触发本地校验错误。

**Acceptance Scenarios**:

1. **Given** 开发者查看任一 ChatThread 公开方法，**When** 阅读 API Reference，**Then** 能看到中英文说明、最小调用示例、参数说明、返回说明和可能错误码。
2. **Given** 开发者传入缺失或非法参数，**When** 调用公开方法，**Then** SDK 抛出统一参数校验错误，并在文档中可查到对应处理建议。
3. **Given** 服务端返回业务错误，**When** SDK 抛出错误，**Then** 错误码来自结构化错误码来源，并能在错误码文档中查询。

### Edge Cases

- Thread ID、父级群组 ID、消息 ID、Thread 名称或成员 ID 为空或仅包含空白字符。
- 分页大小未传、超出允许范围、不是整数或游标类型不正确。
- 批量查询最后一条消息时 Thread ID 列表为空、包含空值或超过最大批量限制。
- 服务端返回缺失关键字段、字段命名不一致或最后一条消息摘要为空。
- 当前用户未登录、无权限、未加入对应群组或 Thread 已不存在。
- Thread 事件通知缺失父级群组 ID、事件类型无法识别或重复到达。
- 原工程 Thread MUC 操作码中存在成员加入/退出、多设备等分支，但正式公开事件只对齐移动端 4 个 Thread 变更事件；其他分支不得误暴露为额外公开 Thread 事件。
- 文档示例、类型定义和实际运行行为出现不一致。

## Test Layer Requirements _(mandatory)_

### Unit Tests

- Coverage goals: 覆盖 ChatThreadManager 参数校验、REST 返回归一化、错误包装、ChatThread 实体代理、4 个移动端对齐独立事件归一化、无效通知忽略、导出契约、错误码映射和文档示例类型一致性。
- Planned location: 复用并补强 `tests/unit/rest/chat-thread-management.test.ts`、`tests/unit/managers/chat-thread-manager.test.ts`、`tests/unit/managers/chat-thread.test.ts`、`tests/unit/chat-client/chat-thread-events.test.ts`、`tests/unit/core/message/message-receiver-thread.test.ts`、`tests/contract/manager-exports.contract.test.ts`，必要时新增文档示例类型校验测试。
- Not applicable rationale: N/A，公开 API 必须具备单元覆盖。

### Integration Tests

- Coverage goals: 覆盖 ChatClient 注册 ChatThreadManager 后的管理器属性、事件上下文、raw notify capability 路由、消息接收链路到独立公开事件的协作行为，以及 ChatThread 与消息发送文档主路径的一致性。
- Planned location: 复用或新增 `tests/integration` 下的 manager/event 协作测试；若现有测试层已覆盖同等协作链路，应在 plan 中明确映射关系。
- Not applicable rationale: N/A，本功能涉及管理器协作与事件路由，集成测试默认必需。

### E2E Tests

- Coverage goals: 覆盖浏览器 demo 中 Thread 面板的公开主流程，包括创建、查询、加入、退出、重命名、成员查询、最后消息查询和事件日志展示；真实服务依赖不可用时，至少保留可运行的浏览器主路径或明确记录真实环境验证步骤。
- Planned location: 评估复用 `tests/e2e` 现有 demo/API 流程；若真实环境数据不足，则在 plan 中记录需要真实群组、消息和账号的验证清单。
- Not applicable rationale: N/A，公开能力已有 demo 面板并影响用户可见链路，必须评估 E2E 或真实环境替代验证。

### Gate Impact

- Required gates: PR gate 至少覆盖单元测试、类型检查、lint、manager 导出契约、API 文档注释校验、错误码治理检查；Release gate 需要包含 API Reference 生成和真实环境或 demo 主路径验证记录。
- Validation notes: 公开 API 的导出、文档、错误码和示例一致性必须阻塞 PR；真实服务联调失败时不得静默放行，需要记录环境原因和补测任务。

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: SDK MUST 将 ChatThread 能力作为正式公开模块提供，包含管理器、单个 Thread 实体、参数类型、返回类型和事件类型。
- **FR-002**: SDK MUST 提供稳定的主入口导入和 `./managers/chat-thread` manager 子路径导入方式，并在发布产物中包含对应类型声明。
- **FR-003**: 开发者 MUST 能注册 ChatThread 管理器，并通过注册后的客户端访问 Thread 管理能力。
- **FR-004**: ChatThread 管理器 MUST 支持创建 Thread、获取群内 Thread 列表、获取当前用户已加入 Thread 列表、获取 Thread 详情、加入 Thread、退出 Thread、销毁 Thread、更新 Thread 名称、获取 Thread 成员列表、移除 Thread 成员、批量获取 Thread 最后一条消息。
- **FR-005**: ChatThread 实体 MUST 支持围绕单个 Thread ID 的详情刷新、加入、退出、销毁、更新名称、获取成员列表和移除成员操作。
- **FR-006**: 所有公开方法 MUST 返回标准化业务对象或空结果，不得向调用方透传服务端原始响应包装。
- **FR-007**: 所有公开方法 MUST 对必填字符串、分页大小、游标和批量数量进行明确校验，并在失败时抛出统一 SDK 错误。
- **FR-008**: ChatThread 事件 MUST 采用与群组事件一致的独立事件模型，不得公开或派发 `onChatThreadChange`，也不得要求调用方根据 `operation` 区分公开业务动作。
- **FR-009**: ChatThread 公开事件 MUST 与移动端对齐，只公开 `onChatThreadCreated`、`onChatThreadDestroyed`、`onChatThreadUpdated`、`onChatThreadUserRemoved` 4 个事件。
- **FR-009a**: `onChatThreadCreated` 和 `onChatThreadDestroyed` MUST 由子区所属群组的所有成员接收。
- **FR-009b**: `onChatThreadUpdated` MUST 在修改子区名称，或子区中添加、撤销回复消息时触发，并由子区所属群组的所有成员接收。
- **FR-009c**: `onChatThreadUserRemoved` MUST 只表示当前登录用户被群主或群管理员移出子区。
- **FR-010**: ChatThread 公开事件 payload MUST 使用当前 SDK 命名风格，包括 `chatThreadId`、`chatThreadName`、`parentId`、`operatorId`、`memberId`、`messageId`、`messageCount`、`lastMessage`、`timestamp`、`createdAt` 等字段；不得在公开 payload 中使用旧工程的 `id`、`name`、`operator`、`userName` 或 `operation` 作为主要业务字段。
- **FR-011**: ChatThread 原始通知 MUST 仅作为内部输入处理，不得在正式公开文档中作为用户直接依赖的事件契约；内部 raw notify 只能归一到独立 Thread 公开事件。
- **FR-012**: ChatThread 事件 MUST 只在开发者显式注册 ChatThread 管理器后对外派发。
- **FR-013**: ChatThread 事件实现 MUST 对照原工程 Thread MUC 事件来源，覆盖原工程 `handleMucMsg.ts` 中 Thread 创建、销毁、更新和当前用户被移除分支，并在 websdk2 中归一为移动端对齐的 4 个独立公开事件；加入、离开或其他多设备 Thread 分支不得额外公开为 Thread 变更事件。
- **FR-014**: ChatThread REST API 行为 MUST 对照原工程 `threadApi.ts` 的请求路径、参数校验、分页默认值、批量上限和返回字段归一规则，确认当前公开契约与服务端真实行为一致。
- **FR-015**: API Reference MUST 完整公开主入口、`./managers/chat-thread`、`ChatThreadManager`、`ChatThread`、全部公开参数类型、返回类型、独立事件类型和关键字段，并提供中英双语说明。
- **FR-016**: API Reference MUST 为每个 ChatThread 公开方法提供最小调用示例、参数说明、返回说明、可能错误码和处理建议。
- **FR-017**: REST 服务端业务错误 MUST 通过 `api-errors.json` 的每个 Thread operation 维护；本地参数校验错误 MUST 通过对应 operation 的 `localErrors` 维护。
- **FR-018**: ChatThread 每个公开 REST operation 和每个需要公开的本地参数校验错误 MUST 出现在错误码文档和 API Reference 的错误码表中。
- **FR-019**: 集成文档 MUST 与实际公开类型和运行行为一致，不得包含不存在的方法、错误参数名、聚合事件 `operation` 分支示例或过期事件字段。
- **FR-020**: Thread 中发送消息的公开方式 MUST 在文档中明确；如果当前 SDK 尚未公开专用字段或方法，文档不得示例化不存在的调用方式。
- **FR-021**: 正式公开前 MUST 明确权限和能力前提，包括登录状态、群组关系、控制台能力开通、管理员操作限制和 Thread 存在性。
- **FR-022**: 正式公开前 MUST 完成导出契约、类型契约、错误码治理、API 文档生成、单元测试、集成测试和 demo/真实环境验证评估。
- **FR-023**: 正式公开前 MUST 增加或更新测试 case，覆盖每个公开 REST 方法、4 个独立 Thread 事件、非公开 Thread 分支不派发、错误码生成/校验、API Reference 生成入口和文档示例一致性。

### Key Entities

- **ChatThreadManager**: Thread 公开管理器，负责 Thread 创建、查询、成员管理、生命周期操作、最后消息查询和事件订阅入口。
- **ChatThread**: 单个 Thread 的对象化入口，绑定一个 Thread ID，提供无需重复传入 Thread ID 的操作方法。
- **ChatThreadSummary**: Thread 摘要，包含 Thread ID、父级群组 ID、名称、所有者、成员数、消息数、创建时间和最后消息摘要等用户可见信息。
- **ChatThreadMemberEntry**: Thread 成员条目，描述成员 ID 和加入时间等成员列表信息。
- **ChatThreadCreatedEventPayload**: Thread 创建事件载荷，描述 Thread ID、Thread 名称、父级群组 ID、父消息 ID、操作者和事件时间。
- **ChatThreadDestroyedEventPayload**: Thread 销毁事件载荷，描述 Thread ID、父级群组 ID、操作者和事件时间。
- **ChatThreadUpdatedEventPayload**: Thread 更新事件载荷，描述 Thread ID、Thread 名称、父级群组 ID、父消息 ID、消息数、最后一条消息、操作者和事件时间；修改名称、添加回复消息和撤销回复消息均使用该事件。
- **ChatThreadUserRemovedEventPayload**: 当前登录用户被移出 Thread 事件载荷，描述 Thread ID、父级群组 ID、被移出成员 ID、操作者和事件时间。
- **ChatThreadLastMessageEntry**: Thread 最后一条消息结果，描述 Thread ID 与最后一条消息摘要。

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 开发者可在 5 分钟内根据公开文档完成 ChatThread 管理器注册并成功调用至少一个查询方法。
- **SC-002**: API Reference 覆盖 100% ChatThread 公开类、公开方法、公开参数类型、公开返回类型和独立公开事件类型。
- **SC-003**: ChatThread 公开方法的本地参数校验、成功返回、主要错误路径和 4 个移动端对齐独立事件具备 100% 对外 API 单元覆盖。
- **SC-004**: 文档中的 ChatThread 示例与公开类型保持 100% 一致，不包含不存在的方法、参数、聚合事件 `operation` 分支或过期事件字段。
- **SC-005**: 错误码文档覆盖 100% ChatThread REST operation 和需要公开的本地校验错误，并通过错误码治理检查。
- **SC-006**: 注册 ChatThread 管理器后的事件链路在测试中能稳定覆盖 Thread 创建、销毁、更新和当前用户被移出 4 个独立事件，且未注册时不会对外派发公开事件。
- **SC-007**: Release 前至少完成一次 demo 主路径或真实环境主路径验证，并记录验证结果、账号/环境前提和任何未覆盖限制。

## Assumptions

- 本功能只将现有 ChatThread 能力正式公开，不新增新的服务端 Thread 业务能力。
- 本功能不改变现有消息、会话、联系人、群组或聊天室缓存 schema。
- ChatThread 是群组内子会话能力，使用前需要用户已登录，并具备对应群组和服务端能力条件。
- 公开化优先保证 API、文档、错误码和测试契约一致；若发现当前实现与真实服务返回不一致，应以真实返回样例修正公开契约。
- 原工程仍使用 `onChatThreadChange + operation` 的聚合事件；websdk2 正式公开时按用户要求升级为移动端对齐的 4 个独立事件，同时保留原工程作为服务端操作码和字段归一参考。
