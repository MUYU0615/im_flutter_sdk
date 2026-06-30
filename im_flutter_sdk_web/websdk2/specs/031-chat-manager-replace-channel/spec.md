# Feature Specification: ChatManager 替换 ChannelManager 并补齐消息域能力

**Feature Branch**: `031-chat-manager-replace-channel`  
**Created**: 2026-04-22  
**Status**: Draft  
**Input**: User description: "修改 031 spec，为 ChatManager 增加会话已读、消息已读、群消息已读、撤回、编辑、附件下载、合并消息下载解析、消息事件监听、群消息已读查询、历史消息、删除历史消息、举报、翻译、Reaction、消息置顶等能力；迁移时遵循新 SDK API 风格，不直接返回服务端数据，必要时参考 032 的包装思路，并补齐可确认的错误处理"

## Reference

- 旧工程消息域 API 参考：`/Users/zhangdong/code/websdk-new/packages/IM/sdk/src/apis/index.ts`
- 旧工程翻译 API 参考：`/Users/zhangdong/code/websdk-new/packages/IM/sdk/src/apis/translation.ts`
- 旧工程合并消息下载解析参考：`/Users/zhangdong/code/websdk-new/packages/IM/sdk/src/engineCore/connection.ts`
- 当前 031 既有实现基线：`src/managers/chat-manager.ts`
- 当前 032 内部对象化方向参考：`specs/032-group-internal-oo-pilot/spec.md`

## Clarifications

### Session 2026-04-22

- Q: `ChannelManager` / `Channel` 旧 API 在 Phase 1 的处理方式是什么？ → A: 立即移除旧 API，不保留兼容层
- Q: Phase 1 中 `ChatClient.sendMessage` 应该怎么处理？ → A: 保留 `ChatClient.sendMessage`，同时新增 `chatManager.sendMessage`
- Q: Phase 1 中，`ChatManager` 的消息事件入口采用哪种形式？ → A: 沿用 `addEventHandler/removeEventHandler`
- Q: Phase 1 的 `ChatManager` 是否包含 `onConversationUpdate`？ → A: 保留 `onConversationUpdate`，但不新增 conversation CRUD API

### Session 2026-04-28

- Q: 本次新增能力是否继续挂在 `ChatManager`，还是拆成新的 manager？ → A: 继续集中在 `ChatManager`，作为消息域主门面；本期不新增 `ConversationManager`、`ReactionManager` 或 `TranslationManager`
- Q: 用户给出的旧名如 `fetchHistoryMessages`、`modifyMessage`、`deleteMessage`、`addMessageListener` 是否原样保留？ → A: 不原样保留；公开 API 必须遵循本仓库命名规范，读取类统一收敛到 `getXxx`，删除类优先 `removeXxx`，消息编辑优先 `updateMessage`，事件监听继续统一为 `addEventHandler/removeEventHandler`
- Q: 旧工程里的服务端响应结构是否可以直接透传？ → A: 不可以；所有成功返回都必须是业务对象、业务对象列表、分页业务对象或 `void`，失败统一抛出 SDKError
- Q: 本次是否改变消息创建入口？ → A: 消息创建入口收敛到 `ChatManager.createXMessage`；`ChatClient` 不再公开创建消息方法。
- Q: 用户提到的 `addMessageListener` 在 031 中如何体现？ → A: 需求意图吸收到 `ChatManager.addEventHandler/removeEventHandler` 的事件面扩展中，不新增并行监听 API

### Naming Alignment

- `ackConversationRead()` → `markConversationRead()`
- `ackMessageRead()` / `ackGroupMessageRead()` → `markMessageRead()`
- `modifyMessage()` → `updateMessage()`
- `downloadAttachment()` → `downloadMessageAttachment()`
- `downloadAndParseCombineMessage()` 保留为 `ChatManager` 合并消息下载解析入口
- `fetchGroupReadAcks()` → `getGroupMessageReadUsers()`
- `fetchHistoryMessages()` → `getHistoryMessages()`
- `deleteMessage()` → `removeHistoryMessages()`
- `fetchSupportLanguages()` → `getSupportedTranslationLanguages()`
- `getPinedMessage()` → `getPinnedMessages()`

## User Scenarios & Testing _(mandatory)_

### User Story 1 - 通过 ChatManager 完成消息发送后的控制动作 (Priority: P1)

作为 SDK 使用者，我希望在 `ChatManager` 上直接完成会话已读、消息已读、群消息已读、撤回消息和编辑消息，这样消息主链路从创建、发送到后续控制都能收敛在同一个 manager 中，而不必继续依赖旧工程连接层心智。

**Why this priority**: 这些是发送后最核心的消息控制能力，若仍分散在底层连接 API 或遗留概念里，031 的 `ChatManager` 只能算“半迁移”。

**Independent Test**: 初始化并登录后，使用 `chatManager.createXMessage + chatManager.sendMessage` 完成发消息，再分别调用 `markConversationRead`、`sendMessageReadAck`、`sendGroupMessageReadAck`、`recallMessage`、`updateMessage`，验证返回值、错误语义与消息事件即可独立验收。

**Acceptance Scenarios**:

1. **Given** 当前用户已进入某个会话并已消费最新消息，**When** 调用 `chatManager.markConversationRead(...)`，**Then** SDK 应发送会话级已读语义并返回 `void`，而不是原始 channel ack 响应。
2. **Given** 当前用户需要对单聊消息发送已读回执，**When** 调用 `chatManager.sendMessageReadAck(...)`，**Then** SDK 应完成消息级 read ack 发送，并对参数不合法、连接不可用等情况返回明确 SDKError。
3. **Given** 当前用户需要对群消息发送已读回执，**When** 调用 `chatManager.sendGroupMessageReadAck(...)`，**Then** SDK 应按群消息语义发送回执，而不是复用单聊回执的模糊入参。
4. **Given** 当前用户撤回自己可撤回的消息，**When** 调用 `chatManager.recallMessage(...)`，**Then** SDK 应返回业务语义明确的结果，并继续通过消息域事件向外暴露撤回结果。
5. **Given** 当前用户编辑可编辑的文本、自定义或允许更新扩展字段的消息，**When** 调用 `chatManager.updateMessage(...)`，**Then** SDK 应返回标准化消息业务对象或更新结果；若消息类型不支持编辑、消息不属于当前用户或已不可编辑，**Then** 应抛出可判定错误。

---

### User Story 2 - 通过 ChatManager 查询、下载和删除消息内容 (Priority: P1)

作为 SDK 使用者，我希望在 `ChatManager` 上统一完成历史消息查询、附件下载、合并消息下载解析和历史消息删除，这样消息读取与内容获取能力不需要再散落在旧 `connection` 或工具函数中。

**Why this priority**: 如果只迁移“发消息”和“消息动作”，但历史查询和内容下载仍停留在旧连接层，对外心智仍然割裂，迁移收益不完整。

**Independent Test**: 对已存在消息的会话调用 `getHistoryMessages`，再对附件消息与合并消息分别调用 `downloadMessageAttachment` 和 `downloadAndParseCombineMessage`，最后对指定消息调用 `removeHistoryMessages`，即可独立验证这条故事。

**Acceptance Scenarios**:

1. **Given** 指定会话存在历史消息，**When** 调用 `chatManager.getHistoryMessages(...)`，**Then** SDK 应返回标准化历史消息分页结果，消息项复用统一 `Message` 业务对象，而不是返回旧工程 `queue/start/isGroup` 语义或服务端原始 envelope。
2. **Given** 某条消息包含图片、语音、视频或文件附件，**When** 调用 `chatManager.downloadMessageAttachment(...)`，**Then** SDK 应返回带文件元信息与下载结果的业务对象，并支持进度、密钥或下载失败的明确错误语义。
3. **Given** 某条消息是合并消息，**When** 调用 `chatManager.downloadAndParseCombineMessage(...)`，**Then** SDK 应下载并解析为 `Message[]` 业务对象集合，沿用当前仓库已落地的合并消息校验与整体失败语义。
4. **Given** 调用方需要删除历史消息，**When** 调用 `chatManager.removeHistoryMessages(...)` 传入消息 ID 列表或时间边界，**Then** SDK 应按会话维度完成单向删除，并返回 `void`，不透传原始服务端响应。
5. **Given** 下载密钥缺失、会话类型错误、锚点参数不合法或请求超时，**When** 调用上述方法，**Then** SDK 应抛出归一化 SDKError，而不是底层字符串错误或未处理异常。

---

### User Story 3 - 通过 ChatManager 处理群消息已读、Reaction 与置顶状态 (Priority: P1)

作为 SDK 使用者，我希望 `ChatManager` 能统一提供群消息已读查询、Reaction 增删查和消息置顶能力，这样所有“围绕消息的互动状态”都可以通过同一入口完成，并返回适合前端消费的 plain data 结果。

**Why this priority**: 这些能力虽然不是“发消息”本身，但都以消息 ID 和会话为核心对象，天然属于消息域；如果不放到 `ChatManager`，消息域边界会继续碎片化。

**Independent Test**: 发送一条群消息并调用 `getGroupMessageReadUsers`，再对一条消息执行 `addReaction`/`removeReaction`/`getReactionList`/`getReactionDetail` 与 `pinMessage`/`unpinMessage`/`getPinnedMessages`，即可独立验证本故事。

**Acceptance Scenarios**:

1. **Given** 群消息支持已读回执统计，**When** 调用 `chatManager.getGroupMessageReadUsers(...)`，**Then** SDK 应返回消息已读用户列表或等价业务聚合对象，并对群外场景、分页参数和不存在消息做显式校验。
2. **Given** 调用方要给消息加或删 Reaction，**When** 分别调用 `chatManager.addReaction(...)` 与 `chatManager.removeReaction(...)`，**Then** SDK 应返回 `void` 并通过消息域事件通知 Reaction 变化，而不是要求调用方解析原始 REST 结果。
3. **Given** 调用方要渲染消息上的 Reaction 汇总，**When** 调用 `chatManager.getReactionList(...)`，**Then** SDK 应返回标准化的 Reaction 摘要列表，至少包含 reaction 文本、数量和当前用户是否已添加等业务字段。
4. **Given** 调用方要查看更多已添加某个 Reaction 的用户，**When** 调用 `chatManager.getReactionDetail(...)`，**Then** SDK 应返回带分页游标的用户明细业务对象，而不是服务端字段直传。
5. **Given** 调用方置顶或取消置顶某条消息，**When** 分别调用 `chatManager.pinMessage(...)` 与 `chatManager.unpinMessage(...)`，**Then** SDK 应完成消息置顶状态切换；当调用 `chatManager.getPinnedMessages(...)` 时，**Then** 应返回带游标的置顶消息业务对象列表，消息项仍复用统一 `Message` 业务模型。

---

### User Story 4 - 通过 ChatManager 暴露消息域事件、举报和翻译能力 (Priority: P2)

作为 SDK 使用者，我希望 `ChatManager` 不仅能执行消息域动作，也能统一提供消息域事件监听、消息举报和翻译能力，这样消息交互闭环可以在一个 manager 内完成，并保持新的公开 API 风格。

**Why this priority**: 这组能力不是消息主发送链路的最小闭环，但它们直接决定 `ChatManager` 是否足以替代旧连接层成为消息域的完整门面。

**Independent Test**: 通过 `chatManager.addEventHandler(...)` 订阅消息事件后，触发 read/recall/update/reaction/pin 等变化；再分别调用 `getSupportedTranslationLanguages`、`translateMessage`，即可独立验收。

**Acceptance Scenarios**:

1. **Given** 调用方需要监听消息域事件，**When** 使用 `chatManager.addEventHandler(id, handlers)` 注册回调，**Then** 除现有 `onMessage`、`onCombineMessage`、`onStreamMessage`、`onMessageStatus`、`onConversationUpdate` 外，还应能监听消息已读、会话已读、撤回、编辑、Reaction 变化和消息置顶变化等事件。
2. **Given** 调用方不再需要监听消息事件，**When** 调用 `chatManager.removeEventHandler(id)`，**Then** 该 handler 组应被完整移除，不新增平行的 `addMessageListener/removeMessageListener` 心智。
4. **Given** 调用方需要展示翻译语言列表，**When** 调用 `chatManager.getSupportedTranslationLanguages()`，**Then** SDK 应返回语言业务对象列表，而不是服务端原始数据包装。
5. **Given** 调用方需要翻译一条文本消息，**When** 调用 `chatManager.translateMessage(...)`，**Then** SDK 应返回标准化翻译结果；若消息类型不支持翻译或源内容为空，**Then** 应抛出可识别错误。

### Out of Scope

- conversation 列表、conversation CRUD、未读数聚合或单独的 conversation manager 设计
- 新增 thread 专项 CRUD、引用转发 UI 语义或新的消息创建 API
- 重新引入 `ChannelManager/Channel` 作为公开消息创建入口，或移除 `ChatClient.sendMessage`
- 直接公开旧工程 `connection`/`ajax`/原始 REST DTO 作为新的 SDK 对外契约
- 围绕 031 一次性引入完整的内部对象化重构；若后续需要内部领域对象，可参考 032，但本期对外仍以 plain data 为主

### Edge Cases

- 同一条消息先被编辑、再被撤回，或先被撤回后又收到迟到的编辑/Reaction/pin 事件时，SDK 如何保证对外事件顺序与最终状态一致
- 调用 `updateMessage` 时消息类型不支持编辑、消息不是当前用户发送、消息已经被撤回或服务端策略禁止编辑时，错误语义如何稳定
- 单聊消息错误调用群消息已读能力、群消息错误调用单聊 read ack 能力时，SDK 如何在参数层快速拒绝
- 历史消息查询使用锚点翻页、最新消息翻页和删除时间边界组合时，结果如何保持会话语义稳定
- 附件下载遇到 secret 缺失、链接过期、跨平台下载能力不足或浏览器环境无法直接落盘时，SDK 如何返回统一业务错误
- 翻译目标语言包含重复项、无效语言码，或尝试翻译非文本消息、空文本、被内容审核替换后的文本时，SDK 如何处理
- Reaction、置顶或举报动作作用于已删除、已撤回或不属于该会话的消息时，SDK 如何避免静默成功

## Test Layer Requirements _(mandatory)_

### Unit Tests

- Coverage goals: 覆盖 `ChatManager` 新增公开方法的参数校验、方法编排、错误映射、返回结果标准化与事件注册类型边界；覆盖历史消息分页、附件下载结果、合并消息解码结果、群消息已读、Reaction、置顶消息和翻译结果的纯映射逻辑。
- Planned location: `tests/unit/managers/chat-manager.test.ts`、`tests/unit/chat-client/chat-manager-use.test.ts`、`tests/unit/core/message/`、`tests/unit/rest/` 与 `tests/types/chat-manager-events.d.ts`
- Not applicable rationale: N/A，031 扩展的是一组新的公开消息域 API，单元测试必需。

### Integration Tests

- Coverage goals: 覆盖 `ChatManager` 与 REST 请求层、消息发送链路、EventHub、缓存/历史消息读取、合并消息下载解析、Reaction/置顶/翻译接口映射之间的协作；覆盖 read ack、recall、update、reaction、pin 等动作触发后的事件分发。
- Planned location: `tests/integration/chat-manager/`、`tests/integration/mock/chat-manager-public-api.test.ts`、现有消息发送/接收/合并消息相关集成测试文件
- Not applicable rationale: N/A，本特性直接影响 manager 协作、消息协议动作与多类 REST 映射，集成测试必需。

### E2E Tests

- Coverage goals: 至少覆盖浏览器 demo 的消息主路径仍使用 `ChatManager`，并验证其中一条“发送后动作”链路（如历史消息读取、撤回或编辑）可通过真实 UI 或浏览器 harness 跑通；若本期 demo 未接入 Reaction/举报/翻译/置顶完整 UI，则这些能力至少需要有浏览器 API smoke 级验证，不强制新增独立交互页面。
- Planned location: `tests/e2e/send-receive.spec.ts`、`tests/e2e/message-actions.spec.ts`，以及必要的浏览器 harness 用例
- Not applicable rationale: 031 已从“仅换 manager 名称”升级为消息域主门面扩展，仍会影响真实 demo 主路径，因此必须评估并补充 E2E。

### Gate Impact

- Required gates: `npm run test:gate:pr`、`npm run test:gate:nightly`、`npm run test:gate:release`、`npm run test:e2e`
- Validation notes: PR gate 必须阻塞公开 API、类型、消息动作和返回结构回归；Nightly/Release gate 必须覆盖至少一条真实浏览器消息动作链路，防止 `ChatManager` 扩展后公开主路径失效。

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: `ChatManager` MUST 继续作为 031 的消息域主公开入口，并通过 `client.use(ChatManager)` 或 `ChatClient.init({ managers: [ChatManager] })` 暴露 `chatManager` 属性。
- **FR-002**: 031 MUST 通过 `ChatManager.createXMessage` 暴露消息创建入口，`sender` 由 SDK 内部根据当前登录态填充；`ChatClient` MUST NOT 公开创建消息方法。
- **FR-003**: `ChatManager` MUST 提供 `markConversationRead(...)`，用于表达“当前会话已读”的业务语义；该方法成功时返回 `Promise<void>`，不得透传旧工程 channel ack 响应。
- **FR-004**: `ChatManager` MUST 提供 `sendMessageReadAck(...)`，用于发送单聊消息已读回执，并对会话类型、消息归属和连接状态进行显式校验。
- **FR-005**: `ChatManager` MUST 提供 `sendGroupMessageReadAck(...)`，用于发送群消息已读回执，并将其与单聊 read ack 的参数模型和错误语义区分开。
- **FR-006**: `ChatManager` MUST 提供 `recallMessage(...)`，用于撤回符合服务端规则的消息；公开入参不得接收 `message` 对象，必须通过 `messageId`、`conversationId` 与 `conversationType` 定位撤回目标；成功返回值必须是业务语义明确的结果对象或标准化消息对象，而不是底层发送回执结构。
- **FR-007**: `ChatManager` MUST 提供 `updateMessage(...)` 作为消息编辑入口，并对支持编辑的消息类型、编辑权限、被撤回状态和参数合法性进行显式约束。
- **FR-008**: `ChatManager` MUST 提供 `downloadMessageAttachment(...)`，用于下载图片、语音、视频或文件消息附件；返回值必须是包含附件元信息与下载结果的业务对象，而不是底层下载响应。
- **FR-009**: `ChatManager` MUST 提供 `downloadAndParseCombineMessage(...)`，用于下载并解析合并消息内容，返回值为标准化 `Message` 业务对象列表，并沿用当前仓库已确立的合并消息校验约束。
- **FR-010**: `ChatManager` MUST 继续以 `addEventHandler(id, handlers)` / `removeEventHandler(id)` 作为唯一官方事件注册入口，不新增对外平行的 `addMessageListener/removeMessageListener` API。
- **FR-011**: `ChatManager` 的事件面 MUST 继续包含 `onMessage`、`onCombineMessage`、`onStreamMessage`、`onMessageStatus`、`onConversationUpdate`，并新增可类型化订阅的消息已读、会话已读、消息撤回、消息编辑、Reaction 变化和消息置顶变化事件。
- **FR-012**: 031 MUST 为新增消息域事件定义稳定的公开 payload 业务模型，不得把旧工程下行 notify 原始字段或 REST DTO 直接暴露给事件监听方。
- **FR-013**: `ChatManager` MUST 提供 `getGroupMessageReadUsers(...)`，用于查询群消息已读用户或等价已读业务聚合对象；返回模型必须适合前端直接消费，而非服务端原始列表包装。
- **FR-014**: `ChatManager` MUST 提供 `getHistoryMessages(...)`，用于分页查询指定会话的历史消息；调用方入参必须体现会话业务语义，而不是直接暴露旧工程 `queue`、`isGroup` 之类底层参数。
- **FR-015**: `getHistoryMessages(...)` 的返回值 MUST 使用标准化历史消息业务分页对象，消息项复用统一 `Message` 模型，并包含继续翻页所需的业务游标或等价锚点信息。
- **FR-016**: `ChatManager` MUST 提供 `removeHistoryMessages(...)`，支持按消息 ID 集合或时间边界删除指定会话的历史消息，并返回 `Promise<void>`。
- **FR-018**: `ChatManager` MUST 提供 `getSupportedTranslationLanguages()`，返回翻译能力支持的语言业务对象列表。
- **FR-019**: `ChatManager` MUST 提供 `translateMessage(...)`，用于翻译文本消息或等价可翻译消息内容；返回值必须包含源语言识别结果与目标语言译文的业务对象。
- **FR-020**: `translateMessage(...)` MUST 对空文本、无效语言码、重复语言码和不支持翻译的消息类型给出可判定错误，而不是静默忽略。
- **FR-021**: `ChatManager` MUST 提供 `addReaction(...)` 与 `removeReaction(...)`，用于对指定消息添加或移除 Reaction；成功返回 `void`。
- **FR-022**: `ChatManager` MUST 提供 `getReactionList(...)`，返回消息 Reaction 摘要列表；摘要对象至少需表达 reaction 内容、计数和当前用户是否已添加。
- **FR-023**: `ChatManager` MUST 提供 `getReactionDetail(...)`，返回某个 Reaction 的用户明细分页业务对象。
- **FR-024**: `ChatManager` MUST 提供 `pinMessage(...)` 与 `unpinMessage(...)`，用于对指定会话中的消息执行置顶和取消置顶动作。
- **FR-025**: `ChatManager` MUST 提供 `getPinnedMessages(...)`，返回指定会话的置顶消息分页业务对象；每一项必须包含标准化消息对象、置顶时间和操作人等业务字段。
- **FR-026**: 所有新增公开方法 MUST 在成功时返回业务对象、业务对象列表、分页业务对象或 `void`；不得返回原始 `code/data/message` 包装。
- **FR-027**: 所有新增公开方法在失败时 MUST 抛出符合 `specs/005-error-handling/spec.md` 的 SDKError 或其已定义子类，而不是抛出未归一化字符串错误。
- **FR-028**: 所有新增公开方法 MUST 在参数层显式校验 `messageId`、会话标识、会话类型、分页参数、语言码、Reaction 文本、时间边界和权限前提等关键输入。
- **FR-029**: 当消息域能力需要复用现有 group/read-user、combine download、消息格式化或缓存协作逻辑时，031 SHOULD 复用既有内部能力，但 MUST 保持 `ChatManager` 的公开返回语义稳定且 plain-data 化。
- **FR-030**: 031 MUST 不把本次消息域扩展解释为 conversation CRUD 补齐；获取 conversation 列表、删除 conversation、批量未读管理等能力仍不在本期公开范围内。
- **FR-031**: 031 MUST 为上述新增方法补齐中英双语注释、最小调用示例、参数说明、错误说明和返回值说明，并同步纳入公开 API 文档生成链路。
- **FR-032**: 031 MUST 以 [chat-manager-api-error-codes.md](/Users/zhangdong/code/websdk2/docs/reference/chat-manager-api-error-codes.md) 作为 ChatManager 错误码矩阵参考，明确每个公开 API 的错误类别、错误码映射和推荐处理方式。
- **FR-033**: 对于移动端中以 `false` 或静默失败表达的会话已读、消息已读和群消息已读场景，Web SDK MUST 统一转换为“幂等成功”或“显式抛出归一化错误”，不得保留 silent-fail 公开语义。
- **FR-034**: 031 MUST 在 `src/utils/error-codes.ts` 中补齐 ChatManager 领域缺失错误码，至少包括 unsupported、server busy、attachment not found/invalid/expired、message recall time limit、message edit failed、service not enabled、translate domain 和 reaction domain 等错误码。
- **FR-035**: ChatManager 的 REST 类 API MUST 复用现有认证刷新和传输重试基础设施（若当前仓库已有），并在最终失败时稳定映射为 `AuthenticationError`、`NetworkError`、`RestTransportError`、`RestBusinessError` 或 `SDKError`。

### Key Entities _(include if feature involves data)_

- **ConversationLocator**: 对外表达目标会话的轻量业务定位结构，包含会话 ID 与会话类型，用于历史消息、已读、置顶等消息域 API 的统一寻址。
- **MessageHistoryPage**: 历史消息分页业务对象，包含标准化 `Message` 列表以及继续翻页所需的游标、锚点或等价续传信息。
- **MessageAttachmentDownloadResult**: 附件下载业务对象，包含附件元信息、下载结果以及对前端友好的数据访问语义，不暴露底层下载协议细节。
- **GroupMessageReadUsersResult**: 群消息已读业务对象，包含消息标识、已读用户列表、数量和分页信息或等价聚合信息。
- **MessageReactionSummary**: 消息某个 Reaction 的摘要业务对象，至少表达 reaction 文本、数量和当前用户是否已添加。
- **MessageReactionDetailPage**: 某个 Reaction 的用户明细分页业务对象，包含用户列表与分页游标。
- **PinnedMessage**: 置顶消息业务对象，包含标准化消息对象、置顶时间和操作人标识。
- **TranslationLanguage**: 翻译语言业务对象，包含语言码、展示名和原生名。
- **MessageTranslationResult**: 消息翻译业务对象，包含原文语言识别结果以及多个目标语言的译文结果。
- **MessageActionEventPayload**: 消息域动作事件统一业务载荷模型，用于表达已读、撤回、编辑、Reaction 变化和置顶变化等事件，而不直接泄露底层通知格式。

### Assumptions

- 031 的目标已经从“仅替换 `ChannelManager` 发送入口”扩展为“由 `ChatManager` 承接主要消息域动作与查询能力”，但公开边界仍然限定在消息域，不扩展到 conversation CRUD。
- 用户给出的旧工程方法名主要用于定位能力来源，不构成新 SDK 对外命名的硬性约束；本期优先遵循仓库 Constitution 中的命名规范。
- `addMessageListener` 的真实需求是“补齐消息域监听能力”，因此 031 继续复用统一事件系统，而不是引入新的监听范式。
- `translateMessage` 的公开能力面向“翻译消息内容”这一业务语义；对不具备可翻译文本的消息类型，允许直接在参数层拒绝。
- 当某些旧工程能力内部本质上仍依赖 REST、WebSocket ack、缓存或下载适配器时，对外 API 仍必须屏蔽这些实现细节并返回 plain data。
- 若内部需要借鉴 032 的包装思路，可在实现阶段引入消息域内部服务或轻量领域对象，但 031 对外不承诺返回富对象。
- 移动端里通过 `bool false`、`error_description` 字符串匹配或服务端 flag 传递的错误，在 Web SDK 中需要进一步收敛到稳定的 `ERROR_CODES + SDKError` 体系。

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 用户本次提出的 21 项能力在 031 规格中都存在明确的 `ChatManager` 能力映射，且不存在“仍需直接调用旧 connection API”的公开空洞。
- **SC-002**: 031 新增的全部 `ChatManager` 公开方法在实现完成后，其成功返回值 100% 为业务对象或 `void`，原始服务端 envelope 透传率为 0。
- **SC-003**: 031 新增的消息域事件在类型测试与集成测试覆盖场景中，100% 通过 `chatManager.addEventHandler()` 暴露，不新增第二套公开监听模型。
- **SC-004**: 031 的公开 `ChatManager` 方法在实现完成后达到 100% 公开 API 覆盖，并通过至少一条浏览器端消息动作 E2E 主路径验证。
- **SC-005**: 升级用户能够仅通过 `chatManager.createXMessage + chatManager.*` 完成消息发送、控制、查询、互动和翻译的主要闭环，不再需要理解 `ChannelManager/Channel` 或直接拼装旧工程底层参数。
