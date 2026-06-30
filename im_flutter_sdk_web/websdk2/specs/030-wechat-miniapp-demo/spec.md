# Feature Specification: 微信小程序 Demo

**Feature Branch**: `030-wechat-miniapp-demo`  
**Created**: 2026-04-17  
**Status**: Draft  
**Input**: User description: "再创建一个微信小程序的demo, 和现在的demo目录平级就行。 实现现在 demo里的初始化， 登录， 发送各种类型消息的功能。 初始化可以简单一点不用支持自定义的dns地址。 如果微信小程序的 demo里不能现在这样引用 sdk源码的话使用 build之后的 sdk也行"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - 在微信小程序中完成初始化与登录 (Priority: P1)

作为 SDK 使用者，我希望有一个与现有 Web demo 平级的微信小程序 demo，可以直接在微信开发者工具中完成初始化和登录，这样我可以验证 SDK 在小程序环境下的基本接入路径，而不必先自行搭建示例工程。

**Why this priority**: 初始化和登录是所有后续演示能力的前提，也是判断小程序 demo 是否可用的最低门槛。

**Independent Test**: 在微信开发者工具中打开 demo，填写初始化信息和登录凭证后，能够完成初始化、登录，并看到明确的状态与日志反馈。

**Acceptance Scenarios**:

1. **Given** 用户第一次打开微信小程序 demo，**When** 查看首页，**Then** 可以看到初始化区、登录区和操作反馈区，而不是空白工程或仅有占位内容。
2. **Given** 用户已填写必要的初始化信息，**When** 执行初始化，**Then** demo 应显示初始化成功或失败的明确反馈。
3. **Given** 用户已完成初始化并填写有效登录凭证，**When** 执行登录，**Then** demo 应显示当前登录状态和当前用户信息。
4. **Given** 用户已经登录，**When** 执行登出，**Then** demo 应恢复未登录状态并保留清晰的结果反馈。

---

### User Story 2 - 在微信小程序中发送常见消息类型 (Priority: P1)

作为 SDK 使用者，我希望在微信小程序 demo 中发送常见消息类型，这样我可以验证 SDK 在小程序环境下的消息创建与发送主路径是否可用，而不需要自己写额外测试页面。

**Why this priority**: 用户明确要求覆盖“发送各种类型消息”，这是该 demo 的核心价值，且直接决定小程序环境是否具备实际联调意义。

**Independent Test**: 登录后分别发送文本、图片、语音、视频、文件、位置、命令、自定义消息，确认每种消息都能触发发送流程，并展示成功或失败结果。

**Acceptance Scenarios**:

1. **Given** 用户已经完成初始化和登录，**When** 选择文本消息并发送，**Then** demo 应触发文本消息发送并显示发送结果。
2. **Given** 用户已经完成初始化和登录，**When** 选择图片、语音、视频或文件消息并提供本地素材，**Then** demo 应触发对应附件消息发送并显示发送结果。
3. **Given** 用户已经完成初始化和登录，**When** 选择位置、命令或自定义消息并填写所需内容，**Then** demo 应触发对应消息发送并显示发送结果。
4. **Given** 某一类消息缺少必填信息，**When** 用户尝试发送，**Then** demo 应阻止发送并给出明确提示，而不是静默失败。

---

### User Story 3 - 使用简化初始化配置快速联调 (Priority: P2)

作为 SDK 使用者，我希望微信小程序 demo 的初始化配置比当前 Web demo 更简单，不需要填写自定义 DNS 地址，这样我可以更快完成联调准备，降低配置错误成本。

**Why this priority**: 这是用户明确提出的简化诉求，能显著降低小程序 demo 的使用门槛，但不阻塞“有 demo 可用”的最小价值。

**Independent Test**: 打开 demo 后检查初始化表单，只需要最小必要配置即可执行初始化，不要求手动填写自定义 DNS 地址。

**Acceptance Scenarios**:

1. **Given** 用户准备初始化 SDK，**When** 查看初始化表单，**Then** 不应要求用户填写自定义 DNS 地址。
2. **Given** 用户仅提供最小必要配置，**When** 执行初始化，**Then** demo 应能够进入初始化流程。
3. **Given** 初始化失败，**When** demo 展示错误，**Then** 错误反馈应聚焦于必要配置问题，而不是暴露与自定义 DNS 相关的无关设置。

---

### User Story 4 - 在导入方式受限时仍可运行 demo (Priority: P2)

作为 SDK 使用者，我希望即使微信小程序环境不能像现有 Web demo 一样直接引用 SDK 源码，demo 仍然有可执行的接入方式，这样我不会因为示例工程的导入方式受限而无法联调。

**Why this priority**: 用户已经明确指出小程序环境可能无法直接引用源码，如果没有可运行的后备方式，demo 很可能只能停留在目录结构层面而无法真实使用。

**Independent Test**: 按 demo 文档执行准备步骤后，无论采用直接引用还是构建后引用，demo 都可以被微信开发者工具打开并运行。

**Acceptance Scenarios**:

1. **Given** 当前导入方式可以直接运行，**When** 用户按文档准备 demo，**Then** demo 应可正常启动。
2. **Given** 当前导入方式无法在小程序环境中运行，**When** 用户按文档切换到可执行的备用方式，**Then** demo 仍应可启动并进入初始化、登录、发消息主流程。
3. **Given** 用户查看 demo 使用说明，**When** 准备运行环境，**Then** 能明确知道需要的前置步骤和当前采用的导入方式。

### Edge Cases

- 当用户未完成初始化就尝试登录或发送消息时，demo 如何阻止错误操作并给出反馈？
- 当用户已初始化但登录失败时，demo 如何保留当前配置并允许重试？
- 当附件类消息在小程序环境中无法选择本地素材、素材读取失败或发送失败时，demo 如何向用户展示明确错误？
- 当某类消息在小程序环境下暂时不具备发送前置条件时，demo 如何避免页面假装支持但实际不可用？
- 当首选导入方式在小程序环境下不可运行时，demo 如何保证仍有清晰的替代运行路径？

## Test Layer Requirements _(mandatory)_

### Unit Tests

- Coverage goals: 覆盖小程序 demo 中与表单校验、消息参数整理、状态切换、错误提示相关的纯逻辑；覆盖导入方式切换或运行模式判断中的关键分支。
- Planned location: `tests/unit/demo/miniapp/` 或与本特性对应的纯逻辑测试目录。
- Not applicable rationale: N/A，本特性存在明确的纯逻辑和错误分支，单元测试必需。

### Integration Tests

- Coverage goals: 覆盖小程序 demo 依赖的 SDK 主路径协作，包括初始化、登录、登出，以及至少一条文本消息和一条附件消息发送链路；覆盖在小程序运行约束下所需的最小兼容行为。
- Planned location: `tests/integration/miniapp-demo/` 及与平台接入相关的集成测试目录。
- Not applicable rationale: N/A，本特性涉及 demo 与 SDK 的协作边界，集成测试必需。

### E2E Tests

- Coverage goals: 评估小程序 demo 主路径的真实环境验证需求，至少形成初始化、登录、发送各类消息、登出的手工验证清单。
- Planned location: 不新增仓库自动化 E2E 文件；验证清单落在 `miniprogram-demo/README.md` 或本 feature 文档中。
- Not applicable rationale: 当前仓库已有的浏览器 E2E 基础设施不直接适用于微信小程序运行容器，因此本特性不新增自动化 E2E，但必须提供手工验证清单。

### Gate Impact

- Required gates: `npm run test:run`、`npm run lint`、`npm run type-check`，并评估 `npm run test:integration` 是否需要补充到本次改动范围。
- Validation notes: 小程序 demo 相关纯逻辑与 SDK 协作回归必须阻塞 PR；微信开发者工具中的手工验证结果作为发布前补充验收，不替代仓库自动化门禁。

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: 系统 MUST 新增一个与现有 Web demo 平级的微信小程序 demo，用于演示 SDK 在微信小程序环境中的基础接入与发消息能力。
- **FR-002**: 微信小程序 demo MUST 支持初始化、登录、登出三条基础主路径，并向用户展示明确的状态与结果反馈。
- **FR-003**: 微信小程序 demo 的初始化流程 MUST 采用简化配置，不要求用户填写自定义 DNS 地址。
- **FR-004**: 微信小程序 demo MUST 支持发送以下消息类型：文本、图片、语音、视频、文件、位置、命令、自定义。
- **FR-005**: 对于每一种支持的消息类型，用户 MUST 能在 demo 中完成必要信息填写、触发发送，并看到清晰的发送成功或失败反馈。
- **FR-006**: 当消息发送所需信息缺失或无效时，demo MUST 在发送前阻止错误操作，并向用户说明缺少的必要信息。
- **FR-007**: demo MUST 明确区分“未初始化”“已初始化未登录”“已登录”三类主要状态，并据此约束可执行操作。
- **FR-008**: demo MUST 为初始化、登录、登出、消息发送等关键操作提供可读的日志或结果记录，便于联调定位问题。
- **FR-009**: 微信小程序 demo MUST 只覆盖基础接入与发消息主路径，不要求复刻现有 Web demo 中的联系人、群组、聊天室、在线状态、推送、缓存调试、会话列表等高级面板。
- **FR-010**: 对于附件类消息，demo MUST 支持在微信小程序环境中选择或提供可发送的本地素材，并走通对应消息发送流程。
- **FR-011**: 如果首选的 SDK 引入方式在微信小程序环境中不可运行，系统 MUST 提供可执行的替代引入方式，使 demo 仍可运行。
- **FR-012**: demo 的使用说明 MUST 清楚说明运行前置条件、启动步骤、当前采用的 SDK 引入方式，以及在引入方式受限时的备用路径。
- **FR-013**: 微信小程序 demo MUST 保持与现有 Web demo 一致的核心用户目标，即让开发者能够快速验证初始化、登录和各类消息发送，而不要求理解内部实现细节。
- **FR-014**: 当某类消息在当前运行环境下不满足发送前提时，demo MUST 给出显式说明，不得让用户误以为该能力已经可用。
- **FR-015**: 本特性 MUST 不破坏现有 Web demo 的可运行性与现有主路径能力。

### Key Entities _(include if feature involves data)_

- **MiniAppDemoSession**: 小程序 demo 当前会话状态，包含初始化状态、登录状态、当前用户和最近一次操作结果。
- **MiniAppInitInput**: 小程序 demo 初始化所需的最小输入集合，用于驱动简化初始化流程。
- **MiniAppMessageDraft**: 小程序 demo 中待发送消息的草稿数据，按消息类型收集各自必要字段。
- **MiniAppAttachmentSelection**: 附件类消息在小程序环境中的本地素材引用，用于表示用户已选择的图片、音频、视频或文件素材。
- **MiniAppLogEntry**: demo 展示给用户的操作日志项，记录关键操作、结果和错误信息。

### Assumptions

- 本特性中的“发送各种类型消息”默认指现有发送面板覆盖的 8 类消息：文本、图片、语音、视频、文件、位置、命令、自定义，不包含合并消息、流式消息或各类管理器能力。
- 微信小程序 demo 的目标是验证基础接入与主路径联调，不承担替代现有 Web demo 全量功能的职责。
- 小程序运行环境可能对 SDK 的直接引用方式有限制，因此规格要求必须存在至少一种可执行的运行路径，但不预先限定具体实现形式。
- 当前仓库自动化 E2E 基础设施不直接适用于微信小程序运行容器，因此本特性以自动化单元/集成验证加手工验收清单的组合方式完成验收。

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 开发者能够在阅读 demo 说明后，于 15 分钟内完成小程序 demo 的准备并进入初始化页面。
- **SC-002**: 在有效凭证和可用环境下，开发者首次尝试即可完成初始化与登录的成功率达到 90% 以上。
- **SC-003**: 文本、图片、语音、视频、文件、位置、命令、自定义这 8 类消息的主路径均具备可验证的发送结果，验收覆盖率达到 100%。
- **SC-004**: 当用户在错误状态下执行登录或发送消息时，100% 能收到明确反馈，而不是静默失败。
- **SC-005**: 当首选 SDK 引入方式不可用时，开发者仍可通过文档提供的备用方式完成 demo 启动，保证 demo 在小程序环境中具备可运行路径。
