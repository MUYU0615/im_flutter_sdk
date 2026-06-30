# Feature Specification: 消息模型替换 channel 为会话字段

**Feature Branch**: `001-im-sdk-refactor`
**Created**: 2026-05-11
**Status**: Draft
**Input**: 用户需求："新建 spec 来替换消息里的 channel；消息体里的 channel 概念去掉，换成 conversationId 和 conversationType，conversationType 使用现有 singleChat | groupChat | chatRoom。"

## Reference

- 当前消息创建规格：`specs/003-message-create/spec.md`
- 当前 ChannelManager 迁移规格：`specs/031-chat-manager-replace-channel/spec.md`
- 当前会话 REST API canonical naming：`specs/034-conversation-rest-api/spec.md`
- 当前消息模型、创建入参、协议编解码、上传与会话缓存实现基线：`src/types/`、`src/message/`、`src/protocol/msync/`、`src/upload/`、`src/cache/`

## Clarifications

### Session 2026-05-11

- Q: `Message` 中替代 `channel` 的字段是什么？ → A: 使用顶层 `conversationId` 与 `conversationType`。
- Q: `conversationType` 使用哪套命名？ → A: 统一使用现有会话类型 `singleChat | groupChat | chatRoom`，不再在公开消息模型中使用 `single | group | room`。
- Q: 本功能是否修改原 031 spec？ → A: 不修改原 031；新建独立 spec 承接新的 breaking change。
- Q: 是否新建分支？ → A: 不新建分支，在当前分支创建规格文件。
- Q: 本次是否同时迁移 ChatManager / Conversation 公开方法中的会话定位参数？ → A: 不迁移；仅迁移 `Message`、`Create*MessageParams`、`CombineMessageItem` 和消息事件中的消息对象。现有 ChatManager / Conversation 方法继续使用既有 `conversationId/conversationType` 参数命名。
- Q: 旧 `channel` 消息对象是否需要公开兼容或迁移？ → A: 不兼容、不迁移；公开输入遇到旧 `channel` 字段直接按参数错误处理，测试 fixture 和 demo 全量改为新字段。
- Q: `ChannelReference` / `ChannelType` 是否继续作为公开类型导出？ → A: 不继续导出；消息域公开类型只保留会话定位相关类型。
- Q: 旧 `channel` 字段误用是否需要专门错误码或迁移提示？ → A: 不需要；复用现有参数校验错误，不新增专门错误码，也不要求错误文案说明 `channel` 已移除或提示新字段名。

## User Scenarios & Testing _(mandatory)_

### User Story 1 - 使用统一会话字段创建和发送消息 (Priority: P1)

作为 SDK 使用者，我希望创建文本、图片、语音、视频、文件、自定义、命令、位置和合并消息时直接传入 `conversationId` 与 `conversationType`，这样消息寻址与 ChatManager / Conversation API 的命名保持一致，不再理解额外的 `channel` 包装对象。

**Why this priority**: 消息创建与发送是所有消息能力的入口；如果这里仍保留 `channel`，其他消息域 API 即使使用 `conversationId/conversationType` 也会形成两套公开心智。

**Independent Test**: 仅实现创建消息入参和 `Message` 输出模型迁移后，通过所有 `createXMessage` 方法构造消息，并调用发送链路 mock 验证协议寻址信息正确，即可独立验收。

**Acceptance Scenarios**:

1. **Given** 调用方创建单聊文本消息，**When** 传入 `conversationId: 'user-2'` 与 `conversationType: 'singleChat'`，**Then** 返回的 `Message` 顶层包含相同字段且不再包含 `channel`。
2. **Given** 调用方创建群聊附件消息，**When** 传入 `conversationId: 'group-1'` 与 `conversationType: 'groupChat'`，**Then** 上传、发送和 ACK 回调中的消息对象都保持同一会话字段。
3. **Given** 调用方创建聊天室消息，**When** 传入 `conversationType: 'chatRoom'`，**Then** SDK 应按聊天室消息语义处理优先级、发送目标和事件回调。
4. **Given** 调用方仍传入旧 `channel` 字段，**When** 本 feature 选择直接 breaking change 实现，**Then** 类型与运行时校验都应明确拒绝旧字段，并给出可判定的参数错误。

---

### User Story 2 - 接收消息和消息事件只暴露 conversationId/conversationType (Priority: P1)

作为 SDK 使用者，我希望所有下行消息、消息状态事件、合并消息内容、流式消息事件和 ChatManager 事件都使用 `conversationId` 与 `conversationType` 表达消息归属，这样 UI 层可以用同一套会话定位字段处理发送、接收和历史消息。

**Why this priority**: 如果仅发送侧迁移，接收事件仍返回 `channel`，调用方仍必须维护双模型，破坏本次调整的主要价值。

**Independent Test**: 构造单聊、群聊、聊天室下行协议 fixture，解码后断言 `onMessage`、`onMessageStatus`、`onConversationUpdate` 相关消息对象均不包含 `channel`。

**Acceptance Scenarios**:

1. **Given** SDK 收到单聊下行消息，**When** 解码为公开 `Message`，**Then** `conversationId` 应表示对端用户 ID，`conversationType` 应为 `singleChat`。
2. **Given** SDK 收到群聊下行消息，**When** 解码为公开 `Message`，**Then** `conversationId` 应表示群组 ID，`conversationType` 应为 `groupChat`。
3. **Given** SDK 收到聊天室下行消息，**When** 解码为公开 `Message`，**Then** `conversationId` 应表示聊天室 ID，`conversationType` 应为 `chatRoom`。
4. **Given** SDK 派发消息状态、撤回、编辑、Reaction、置顶或已读相关事件，**When** 事件 payload 包含消息对象或消息定位信息，**Then** 不得再暴露 `channel.channelId` 或 `channel.type`。

---

### User Story 3 - 会话缓存、上传、历史消息和资料同步统一使用 canonical conversationType (Priority: P2)

作为 SDK 使用者，我希望消息驱动的会话摘要、附件上传、历史消息、合并消息详情、用户资料同步和群名片同步都遵循 `conversationId/conversationType`，这样同一条消息在 SDK 内外不会因为 `single/group/room` 与 `singleChat/groupChat/chatRoom` 混用而产生归属错误。

**Why this priority**: 这些链路不一定是公开入口，但会影响消息发送、接收后的真实行为；若内部仍以旧 `channel` 为真相，迁移会留下隐性兼容问题。

**Independent Test**: 通过单元和集成测试覆盖消息入缓存、附件上传 header、历史消息解析、合并消息解码与资料同步队列入参，验证所有链路使用同一会话字段。

**Acceptance Scenarios**:

1. **Given** 收到或发送一条群聊消息，**When** SDK 更新会话摘要缓存，**Then** 会话 key 使用 `conversationId` 与 `groupChat`，不得依赖旧 `channel` 字段。
2. **Given** 发送附件消息，**When** SDK 发起上传请求，**Then** 上传目标应从 `conversationId/conversationType` 映射，不再读取 `message.channel`。
3. **Given** 群聊消息触发群名片资料同步，**When** SDK 计算群 ID，**Then** 应从 `conversationId` 获取，且仅在 `conversationType === 'groupChat'` 时执行群名片逻辑。
4. **Given** 下载或解码合并消息详情，**When** 子消息被公开返回，**Then** 子消息项也应使用 `conversationId/conversationType`，不再使用 `channel`。

---

### User Story 4 - 升级用户获得明确迁移边界和文档 (Priority: P2)

作为 SDK 升级用户，我希望文档、类型注释、demo 和错误信息都清楚说明 `channel` 已被移除，以及如何迁移到 `conversationId/conversationType`，这样可以有计划地修改业务代码，而不是在运行时才发现消息字段变化。

**Why this priority**: 本功能是 breaking change；没有迁移说明会显著增加升级成本和线上风险。

**Independent Test**: 检查公开 API 文档、demo 发送面板、README/API reference 与类型测试，确认所有消息创建示例都使用新字段，且不存在公开示例继续构造 `channel`。

**Acceptance Scenarios**:

1. **Given** 用户阅读消息创建文档，**When** 查看任一 `createXMessage` 示例，**Then** 示例应使用 `conversationId` 与 `conversationType`。
2. **Given** 用户从旧版本迁移，**When** 搜索迁移说明，**Then** 能看到 `channel.channelId -> conversationId`、`channel.type -> conversationType` 的映射规则。
3. **Given** demo 发送消息，**When** 用户选择单聊、群聊或聊天室，**Then** demo 内部创建消息时应传入 canonical `conversationType`。
4. **Given** 用户误用旧字段，**When** 运行时校验触发错误，**Then** SDK 应按普通参数校验失败处理，不新增迁移专用错误码。

### Out of Scope

- 不重新引入 `ChannelManager`、`Channel` runtime 或旧 `ChannelReference` 作为公开消息模型。
- 不继续公开导出 `ChannelReference` 或 `ChannelType`；若内部协议映射仍需等价概念，应作为私有实现细节处理。
- 不新增新的会话类型命名；公开层只允许 `singleChat | groupChat | chatRoom`。
- 不把本功能扩展为 conversation CRUD、PushManager、ChatThreadManager 或群组/聊天室管理 API 的能力补齐。
- 不改变服务端协议字段本身；服务端仍可继续使用其既有 chat type、JID、target 等概念，SDK 内部负责映射。
- 不保留旧 `channel` 入参兼容层，也不对旧完整消息对象做公开迁移；测试 fixture、demo 和示例必须全量切换到新字段。

### Edge Cases

- 单聊下行消息中当前用户可能出现在发送方或接收方，SDK 必须稳定计算对端用户作为 `conversationId`。
- 历史消息、离线消息或 ACK 回调缺少足够的发送方/接收方信息时，SDK 必须抛出或记录可诊断错误，不能生成空 `conversationId`。
- 群聊和聊天室都可能映射到服务端 conference 域，SDK 必须用消息类型或等价上下文区分 `groupChat` 与 `chatRoom`。
- `receiverList` 仅允许群聊定向投递；迁移后规则必须基于 `conversationType === 'groupChat'`。
- 聊天室消息优先级、仅在线投递、广播消息、内容审核替换等扩展字段不得因字段迁移丢失。
- 合并消息中的历史子消息可能来自不同会话；每个子消息必须携带自己的 `conversationId/conversationType`，不能默认继承外层消息。
- 旧本地缓存、测试 fixture 或 demo 草稿中若存在 `channel` 字段，读取或迁移策略必须明确，避免静默生成错误会话摘要。

## Test Layer Requirements _(mandatory)_

### Unit Tests

- Coverage goals: 覆盖消息类型、创建入参校验、`createXMessage` 输出、`receiverList` 规则、协议 chat type 映射、下行解码、附件上传目标、会话摘要计算、合并消息子项、资料同步条件和错误路径。
- Planned location: `tests/unit/message/`、`tests/unit/core/message/`、`tests/unit/protocol/`、`tests/unit/cache/`、`tests/unit/chat-client/`、`tests/types/`
- Not applicable rationale: N/A，本功能修改公开消息模型和核心消息链路，单元测试必需。

### Integration Tests

- Coverage goals: 覆盖 `chatManager.createXMessage + chatManager.sendMessage`、附件上传准备、MSync 编解码、EventHub 消息事件、会话缓存更新、历史消息和合并消息下载解析之间的协作。
- Planned location: `tests/integration/chat-manager/`、`tests/integration/miniapp-demo/`、`tests/integration/mock/`
- Not applicable rationale: N/A，本功能影响协议编解码、上传、缓存和 manager 协作，集成测试必需。

### E2E Tests

- Coverage goals: 覆盖浏览器 demo 发送单聊、群聊消息的主路径，以及至少一条消息动作链路，确认 UI 层不再依赖 `channel` 字段。
- Planned location: `tests/e2e/message-actions.spec.ts`、`tests/e2e/fixtures/sdk-flow.ts`
- Not applicable rationale: N/A，本功能影响 demo 发消息主路径和用户可见 API，必须评估并补充 E2E。

### Gate Impact

- Required gates: `npm run test:gate:pr`、`npm run test:e2e`、`npm run docs:api:check`
- Validation notes: PR gate 必须阻塞公开类型、消息创建、发送、接收和缓存回归；E2E gate 覆盖 demo 主路径；API 文档 gate 必须确保公开注释与示例已迁移。

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: `Message` 公开模型 MUST 移除 `channel` 字段，并新增必填 `conversationId: string` 与 `conversationType: 'singleChat' | 'groupChat' | 'chatRoom'` 字段。
- **FR-002**: 所有 `Create*MessageParams` 公开入参 MUST 移除 `channel` 字段，并改为必填 `conversationId` 与 `conversationType`。
- **FR-003**: `CombineMessageItem` MUST 使用 `conversationId/conversationType` 表达每条子消息归属，不得继续暴露 `channel`。
- **FR-004**: SDK 公开导出的消息会话类型 MUST 复用或对齐现有 `ChatConversationType`，公开取值只能是 `singleChat`、`groupChat`、`chatRoom`。
- **FR-005**: SDK MUST 从公开导出面移除消息域旧 `ChannelReference` 与 `ChannelType` 类型，避免调用方继续以 channel 模型创建或处理消息。
- **FR-006**: SDK MUST 在创建消息时校验 `conversationId` 非空，并校验 `conversationType` 属于 canonical 取值集合。
- **FR-007**: SDK MUST 将 `receiverList` 的合法性规则迁移为只允许 `conversationType === 'groupChat'` 的消息使用。
- **FR-008**: SDK MUST 在发送消息时从 `conversationId/conversationType` 映射服务端协议所需的目标、域名、消息类型和路由类型。
- **FR-009**: SDK MUST 在接收消息时从协议上下文解码出 `conversationId/conversationType`，并保证公开 `Message` 不包含旧 `channel`。
- **FR-010**: 单聊下行消息的 `conversationId` MUST 表示当前用户以外的对端用户；发送侧单聊消息的 `conversationId` MUST 表示目标用户。
- **FR-011**: 群聊消息的 `conversationId` MUST 表示群组 ID，聊天室消息的 `conversationId` MUST 表示聊天室 ID。
- **FR-012**: 附件上传、上传预检、分片上传和自定义上传回调 MUST 从 `conversationId/conversationType` 获取上传目标信息。
- **FR-013**: 会话摘要缓存、消息驱动会话更新和 `onConversationUpdate` MUST 使用 `conversationId/conversationType` 作为消息归属来源。
- **FR-014**: 用户资料同步和群名片同步 MUST 基于 `conversationType` 判断是否需要群名片逻辑，并基于 `conversationId` 获取群 ID。
- **FR-015**: 消息状态、消息接收、合并消息、流式消息、撤回、编辑、已读、Reaction 和置顶等公开事件 payload MUST 不再暴露 `channel`。
- **FR-016**: `ChatManager` 中接受 `Message` 的校验逻辑 MUST 从 `message.channel.type` 迁移为 `message.conversationType`。
- **FR-017**: 历史消息、附件下载、合并消息下载解析、消息翻译、举报、Reaction、置顶等返回的 `Message` 对象 MUST 全部使用新字段。
- **FR-018**: SDK MUST 更新浏览器 demo、小程序 demo 或相关示例中的消息创建流程，使其使用 `conversationId/conversationType`。
- **FR-019**: SDK MUST 更新公开 API JSDoc、中文/英文 API 文档、迁移说明和错误文档，明确旧 `channel` 与新字段的映射关系。
- **FR-020**: SDK MUST 更新类型测试，确保公开 `Message`、`Create*MessageParams`、事件 payload 和合并消息子项不再接受或暴露 `channel`。
- **FR-021**: SDK MUST 更新协议/缓存/测试 fixture，避免 fixture 继续以 `channel` 作为公开消息字段。
- **FR-022**: 对仍传入旧 `channel` 的公开运行时调用，SDK MUST 抛出归一化参数校验错误，不得自动转换为 `conversationId/conversationType`，也不得新增迁移专用错误码。
- **FR-023**: SDK MUST 保持对服务端原始协议命名的内部兼容，但兼容字段不得泄漏到公开消息模型。
- **FR-024**: SDK MUST 在 CHANGELOG 和版本号中标记本功能为 breaking change，并提供最小迁移示例。

### Key Entities _(include if feature involves data)_

- **MessageConversationLocator**: 消息归属定位字段集合，由 `conversationId` 与 `conversationType` 组成，替代旧 `ChannelReference`，并作为消息域唯一公开定位模型。
- **Message**: 公开消息对象，表达消息 ID、发送者、消息类型、状态、扩展、时间戳、消息体、方向以及新的会话定位字段。
- **CreateMessageBaseParams**: 所有消息创建 API 的基础入参，必须包含新的会话定位字段。
- **CombineMessageItem**: 合并消息详情中的子消息项，每条子消息必须独立携带会话定位字段。
- **ChatConversationType**: 公开 canonical 会话类型，取值为 `singleChat | groupChat | chatRoom`。

### Assumptions

- 本功能作为 breaking change 处理，不保留旧 `channel` 作为公开输入输出兼容层。
- 旧 `channel` 完整消息对象不进入迁移路径；若测试 fixture、demo 草稿或业务示例仍包含旧字段，应直接改写为新模型。
- 服务端协议与内部 REST 字段不必同步改名；SDK 内部负责在公开 canonical 字段和服务端协议字段之间转换。
- 031 中“Message.channel 继续作为消息寻址基线”的旧约束被本 feature 取代；后续实现以本 feature 为新的消息模型真相。
- 034 已确认会话公开类型使用 `singleChat/groupChat/chatRoom`，本 feature 复用该命名以避免消息域与会话域分叉。

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 公开 TypeScript 类型中 `Message`、`Create*MessageParams`、`CombineMessageItem` 和消息事件 payload 的 `channel` 字段出现次数为 0。
- **SC-002**: 所有消息创建 API 均能使用 `conversationId/conversationType` 构造消息，并在单聊、群聊、聊天室三类场景通过单元测试。
- **SC-003**: 单聊、群聊、聊天室下行消息解码后均返回正确的 `conversationId/conversationType`，且不暴露旧 `channel`。
- **SC-004**: 发送附件消息时，上传目标 100% 来源于 `conversationId/conversationType`，相关上传测试覆盖简单上传与分片上传。
- **SC-005**: demo 发消息主路径和至少一条消息动作 E2E 用例通过，证明业务侧无需读取或构造 `channel`。
- **SC-006**: API 文档检查通过，并包含从 `channel.channelId/type` 迁移到 `conversationId/conversationType` 的示例。
