# 功能规格：消息 webhookEnv 出站路由字段

**Feature Branch**: `040-message-meta-env`
**Created**: 2026-05-19
**Status**: Draft
**Input**: 用户需求："message Meta 新增一个 env，通过发送消息携带给服务端，需要设置在所有消息的结构里面，在创建消息时候可以设置这个值，这个值可以为空。proto.ts 新增 env。只保证出站路由。"

## References

- 当前消息创建规格：`specs/003-message-create/spec.md`
- 当前消息会话字段规格：`specs/037-message-conversation-fields/spec.md`
- 当前消息模型与创建入参：`src/types/index.ts`、`src/types/message-create.ts`、`src/message/create-message.ts`
- 当前消息参数校验：`src/validators/message-create.ts`
- 当前 MSync 协议编解码：`src/protocol/msync/proto-source.json`、`src/protocol/msync/proto.ts`、`src/protocol/msync/codec.ts`

## Clarifications

### Session 2026-05-19

- Q: "所有消息的结构"具体范围是什么？ → A: 对外基础 `Message` 与所有 `Create*MessageParams` 都要支持 `webhookEnv`，不只改 protobuf `Meta`。
- Q: `webhookEnv` 的空值如何处理？ → A: 允许为空；`undefined` 与空字符串都允许，空字符串可以按空串出站。
- Q: 本次是否要求收消息解码后也保留 `webhookEnv`？ → A: 不要求；本次只保证出站路由链路。
- Q: 是否需要新建分支？ → A: 需要，分支名为 `040-message-meta-env`。
- Q: 用户手写 `Message` 后直接调用 `sendMessage(message)` 是否也要支持 `webhookEnv`？ → A: 要支持；只要走公开消息发送主链路，`message.webhookEnv` 都应参与出站编码。
- Q: `combine` 子消息列表是否要求每条子消息都增加独立 `webhookEnv` 语义？ → A: 不要求；只处理外层出站消息的 `webhookEnv`。
- Q: 本期是否需要更新 demo 表单，让页面上可填写 `webhookEnv`？ → A: 需要；demo 发送面板要提供 `webhookEnv` 输入，并把该值接到消息创建主路径。

## Assumptions

- `webhookEnv` 是消息出站时附带给服务端的路由上下文字段，不参与 SDK 当前下行公开消息模型语义设计。
- 本次不新增独立 manager、独立配置项或全局默认值；`webhookEnv` 仅作为单条消息创建参数透传。
- 本次不要求为 `webhookEnv` 增加专门错误码、枚举约束或格式约束；只要求其类型为可选字符串。
- 本次不修改消息接收、历史消息解析、会话缓存、资料同步逻辑。
- 现有所有消息类型都共享 `CreateMessageBaseParams` 与 `Message` 基础结构，因此 `webhookEnv` 以基础字段方式接入全部创建入口。
- 公开 `chatManager.sendMessage(message)` / `client.sendMessage(message)` 若收到带 `webhookEnv` 的 `Message`，应直接沿用该字段参与编码，不要求调用方必须通过 `createXMessage` 创建消息。
- demo UI 只需要覆盖公开消息创建主路径的 `webhookEnv` 输入与透传，不要求展示服务端回包中的 `webhookEnv`。

## User Scenarios & Testing _(mandatory)_

### User Story 1 - 创建消息时声明 webhookEnv (Priority: P1)

作为 SDK 使用者，我希望在创建任意消息时传入 `webhookEnv`，这样业务可以在单条消息级别声明发送环境，而不需要在发送前再做额外协议拼装。

**Why this priority**: 如果创建入口不支持 `webhookEnv`，调用方只能绕过公开 API 改写内部消息对象，破坏消息创建 API 的完整性。

**Independent Test**: 分别调用文本、图片、命令等创建消息 API，断言返回 `Message` 顶层保留 `webhookEnv`，即可独立验收。

**Acceptance Scenarios**:

1. **Given** 调用方创建文本消息，**When** 传入 `webhookEnv: 'gray'`，**Then** 返回的 `Message` 顶层应包含 `webhookEnv: 'gray'`。
2. **Given** 调用方创建附件消息，**When** 传入 `webhookEnv: 'prod-a'`，**Then** 返回的 `Message` 顶层应保留相同 `webhookEnv`。
3. **Given** 调用方创建消息时不传 `webhookEnv`，**When** SDK 完成创建，**Then** 返回的 `Message` 仍然有效，且 `webhookEnv` 为 `undefined`。
4. **Given** 调用方创建消息时传入 `webhookEnv: ''`，**When** SDK 完成创建，**Then** 返回的 `Message` 应保留空字符串，不得因为空值被判为非法。

---

### User Story 2 - 发送消息时把 webhookEnv 编码进 Meta (Priority: P1)

作为 SDK 使用者，我希望 SDK 在发送消息时把 `message.webhookEnv` 编码到 protobuf `Meta.env`，这样服务端可以按该字段执行出站路由逻辑。

**Why this priority**: `webhookEnv` 的唯一业务价值在于出站时传给服务端；如果编码链路未覆盖，创建时保留该字段也没有意义。

**Independent Test**: 构造携带 `webhookEnv` 的消息，执行 `encodeChatMessage()` 并解码 `CommSyncUL.meta`，断言 `meta.env` 正确即可独立验收。

**Acceptance Scenarios**:

1. **Given** 一条带 `webhookEnv: 'gray'` 的文本消息，**When** SDK 编码出站协议，**Then** `Meta.env` 应为 `'gray'`。
2. **Given** 一条带 `webhookEnv: ''` 的文本消息，**When** SDK 编码出站协议，**Then** `Meta.env` 应为 `''`。
3. **Given** 一条未传 `webhookEnv` 的消息，**When** SDK 编码出站协议，**Then** 不应因缺少 `webhookEnv` 影响消息发送编码成功。
4. **Given** 群聊定向、聊天室优先级或群已读回执等已有出站字段同时存在，**When** SDK 编码消息，**Then** `webhookEnv` 的加入不得覆盖或破坏这些已有字段。
5. **Given** 调用方手写一条公开 `Message` 并直接调用 `sendMessage(message)`，**When** `message.webhookEnv` 有值，**Then** SDK 仍应把它编码到 `Meta.env`。

---

### User Story 3 - 所有创建消息入口统一支持 webhookEnv (Priority: P2)

作为 SDK 使用者，我希望所有 `createXMessage` 入口都统一支持 `webhookEnv`，这样业务切换消息类型时不需要记忆哪些类型可以带环境字段。

**Why this priority**: 若仅部分消息类型支持 `webhookEnv`，公开 API 会出现不一致，容易在附件、命令、自定义等非文本场景下产生灰度遗漏。

**Independent Test**: 使用类型测试或编译测试覆盖所有 `Create*MessageParams`，确认都接受 `webhookEnv?: string`。

**Acceptance Scenarios**:

1. **Given** `createTextMessage` 与 `createCmdMessage`，**When** 调用方传入 `webhookEnv`，**Then** 类型检查与运行时校验都应通过。
2. **Given** `createImageMessage`、`createFileMessage`、`createVoiceMessage`、`createVideoMessage`，**When** 调用方传入 `webhookEnv`，**Then** 不得影响原有媒体参数校验。
3. **Given** `createLocationMessage`、`createCustomMessage`、`createCombineMessage`，**When** 调用方传入 `webhookEnv`，**Then** 返回消息都应保留该字段。
4. **Given** ChatManager 作为公开消息创建入口，**When** 业务使用任意 `chatManager.createXMessage(...)`，**Then** `webhookEnv` 都应以同样方式工作。

---

### User Story 4 - Demo 发送面板可填写 webhookEnv (Priority: P2)

作为 demo 使用者，我希望在发送面板中直接填写 `webhookEnv`，这样可以不改代码就验证 SDK 是否把该字段带到出站消息里。

**Why this priority**: 本期新增的是可选出站路由字段；如果 demo 不能输入它，联调和回归验证都要依赖手写代码，降低可验证性。

**Independent Test**: 在 demo 发送面板填写 `webhookEnv` 后发送文本消息，检查构建出的消息对象日志包含 `webhookEnv`，并由发送主路径完成消息发送。

**Acceptance Scenarios**:

1. **Given** 用户打开 demo 发送面板，**When** 需要发送带路由环境的消息，**Then** 面板上应有可编辑的 `webhookEnv` 输入项。
2. **Given** 用户在 demo 中填写 `webhookEnv: 'gray'` 并发送文本消息，**When** demo 调用 `createTextMessage(...)`，**Then** 传入参数中应包含 `webhookEnv: 'gray'`。
3. **Given** 用户清空 demo 中的 `webhookEnv` 输入项，**When** 再次发送消息，**Then** demo 不得因为空值阻止发送。
4. **Given** 用户切换图片、文件、语音、视频、自定义、命令或位置消息，**When** 使用统一发送面板发送，**Then** `webhookEnv` 输入项仍应复用并接入对应创建消息参数。

### Out of Scope

- 不实现收消息解码后的 `webhookEnv` 公开透传。
- 不为 `webhookEnv` 增加服务端回包解析、会话缓存持久化或历史消息补齐。
- 不实现全局默认 `webhookEnv`、`ChatClient` 级默认 `webhookEnv` 或初始化配置注入。
- 不对 `webhookEnv` 的取值做白名单、长度限制、枚举化或服务端联调校验。
- 不为 `combine` 子消息列表新增独立 `webhookEnv` 字段或逐条编码语义。
- 不要求 demo 在消息列表、日志面板或接收消息 UI 中额外解析展示服务端回包里的 `webhookEnv`。

### Edge Cases

- `webhookEnv` 为 `undefined` 时，消息创建、发送、重试与 ACK 链路都必须保持兼容。
- `webhookEnv` 为空字符串时，运行时校验不得误判为空参数错误；编码链路必须允许空串出站。
- `webhookEnv` 与 `receiverList`、`deliverOnlineOnly`、`needGroupReadReceipt`、`priority` 同时存在时，字段间不得互相覆盖。
- 合并消息作为一种普通出站消息类型时，外层消息可以携带 `webhookEnv`；本次不要求对子消息列表逐条增加独立 `webhookEnv` 语义。
- 对于当前不走 `encodeChatMessage()` 的其他出站协议分支，若未来也承载公开 `Message` 发送语义，需要沿用相同 `webhookEnv` 透传原则。

## Test Layer Requirements _(mandatory)_

### Unit Tests

- Coverage goals: 覆盖 `CreateMessageBaseParams` 校验、`createXMessage` 返回值透传、`Meta.env` 编码、空字符串场景、未传场景以及与既有出站字段的并存场景。
- Planned location: `tests/unit/message/`、`tests/unit/protocol/`
- Not applicable rationale: N/A，本功能直接修改公开消息创建能力和核心协议编码。

### Integration Tests

- Coverage goals: 评估 `chatManager.createXMessage + sendMessage` 主路径，确认 `webhookEnv` 从公开创建入口传入后能进入发送链路。
- Planned location: `tests/integration/chat-manager/` 或现有 mock 发送链路测试
- Not applicable rationale: 若单元测试已覆盖完整创建与编码闭环，可在实现阶段评估是否暂不新增集成测试，但需要明确记录原因。

### E2E Tests

- Coverage goals: 评估 demo 发送面板填写 `webhookEnv` 的主路径，至少覆盖一条文本消息发送流程，确认 UI 输入已接入消息创建参数。
- Planned location: 复用现有 demo 发送 E2E 或在实现阶段记录手动验证路径
- Not applicable rationale: 若自动化 E2E 当前无法稳定断言协议载荷，可先通过控制台构建消息日志与单元测试闭环验证，但需要在 quick verification 中记录 UI 手动验证结果。

### Gate Impact

- Required gates: `npm run type-check`、`npm run test:run`
- Validation notes: 需要重点阻塞公开类型回归和协议编码回归；若实现阶段修改了文档导出或 demo，再追加对应 gate。

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: SDK MUST 在 protobuf `Meta` 定义中新增可选字段 `env`，字段号为 `13`，类型为 `string`。
- **FR-002**: SDK MUST 在协议源定义与运行时 `proto.ts` 生成产物中保持 `Meta.env` 一致。
- **FR-003**: 公开 `Message` 基础类型 MUST 新增可选字段 `webhookEnv?: string`。
- **FR-004**: `CreateMessageBaseParams` MUST 新增可选字段 `webhookEnv?: string`，以便所有 `Create*MessageParams` 自动继承该能力。
- **FR-005**: 所有公开消息创建入口 `createTextMessage`、`createImageMessage`、`createFileMessage`、`createVoiceMessage`、`createVideoMessage`、`createLocationMessage`、`createCmdMessage`、`createCustomMessage`、`createCombineMessage` MUST 支持传入 `webhookEnv`。
- **FR-006**: 运行时消息创建参数校验 MUST 接受 `webhookEnv` 为可选字符串，且 MUST 允许空字符串。
- **FR-007**: SDK MUST 在创建消息时将 `params.webhookEnv` 透传到返回的 `Message.webhookEnv`。
- **FR-008**: SDK MUST 在出站编码聊天消息时，将 `message.webhookEnv` 写入 protobuf `Meta.env`。
- **FR-009**: 当 `message.webhookEnv` 为 `undefined` 时，SDK MUST 保持发送链路兼容，不得因缺少该字段导致编码失败。
- **FR-010**: 当 `message.webhookEnv` 为空字符串时，SDK MUST 允许编码为空字符串出站。
- **FR-011**: `webhookEnv` 的加入 MUST NOT 改变 `receiverList`、`deliverOnlineOnly`、`priority`、`needGroupReadReceipt`、`ext` 等既有字段的校验与编码语义。
- **FR-012**: `webhookEnv` 的加入 MUST NOT 影响当前消息发送主路径的 `Message` 状态流转、附件暂存、上传准备和 ACK 处理。
- **FR-013**: 本功能 MUST 只保证出站路由能力；SDK MUST NOT 以本需求为由新增下行 `webhookEnv` 解析与公开透传要求。
- **FR-014**: 相关类型导出 MUST 保持调用方可直接从公开入口获得带 `webhookEnv` 的消息创建参数类型。
- **FR-015**: demo 发送面板 MUST 提供一个可选 `webhookEnv` 输入项，并将其接入各类消息的 `createXMessage(...)` 调用参数。
- **FR-016**: demo 中清空 `webhookEnv` 输入项时，发送流程 MUST 继续可用，不得因为空值阻断发送。
- **FR-017**: demo 的 `webhookEnv` 输入项 MUST 复用于统一发送面板支持的各类消息类型，而不是只支持文本消息。
- **FR-018**: 单元测试 MUST 覆盖 `webhookEnv` 正常值、空字符串和未传三类场景；demo 变更 MUST 至少有一条可执行的 UI 验证路径。

### Key Entities

- **Meta.env**: protobuf `Meta` 中的可选字符串字段（协议层名称），用于消息出站时向服务端声明环境路由信息。
- **Message.webhookEnv**: SDK 公开消息对象上的可选字符串字段，承载单条消息的出站环境声明。
- **CreateMessageBaseParams.webhookEnv**: 所有创建消息 API 共用的可选入参字段，是 `webhookEnv` 进入公开消息对象与出站协议的唯一标准入口。

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 所有公开 `Create*MessageParams` 均接受 `webhookEnv?: string`，类型检查通过。
- **SC-002**: 创建消息单元测试中，`webhookEnv: 'gray'`、`webhookEnv: ''` 与未传 `webhookEnv` 三类场景均能成功构造消息。
- **SC-003**: 协议编码测试中，带 `webhookEnv` 的消息 100% 能在解码后的 `Meta` 上读取到相同值。
- **SC-004**: 既有 `receiverList`、`priority`、`needGroupReadReceipt` 相关单元测试在接入 `webhookEnv` 后无回归。
- **SC-005**: demo 发送面板可以填写 `webhookEnv` 并成功发送至少一条消息，且构建出的消息对象日志能看到相同 `webhookEnv` 值。
