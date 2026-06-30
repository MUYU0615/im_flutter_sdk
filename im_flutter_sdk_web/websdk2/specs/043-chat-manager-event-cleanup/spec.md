# Feature Specification: ChatManager 事件面收敛

**Feature Branch**: `043-chat-manager-event-cleanup`
**Created**: 2026-05-25
**Status**: Draft
**Input**: User description: "chat-manager 里注册的事件 onCombineMessage onStreamMessage 是不是可以去掉，都用 onMessage 回调出来就行了？onMessageStatus 是什么时候触发的？应该也不需要吧。还有 onMessagePinChange onPinnedMessageChanged 保留一个就行吧。后续确认：其他的同意，onStreamMessage 暂时先保留。"

## Clarifications

### Session 2026-05-25

- Q: 破坏性事件移除采用直接移除还是保留 deprecated 兼容期？ → A: 直接移除，不保留 deprecated 兼容期。
- Q: 删除 `onMessageStatus` 后，`sendMessage` 的发送中、成功、失败状态怎么对外保留？ → A: 保留 `sendMessage` options 回调 `onSending`、`onSuccess`、`onFailed`，并继续保留 Promise 成功/失败结果。
- Q: 合并消息进入 `onMessage` 后是否需要额外公开标记？ → A: 不需要额外标记，仅通过 `message.type === 'combine'` 识别。
- Q: 文档里的已移除事件如何呈现？ → A: 从所有文档完全删除旧事件，不写迁移说明。
- Q: E2E 层是否必须新增专门用例？ → A: 复用现有 E2E/API 浏览器用例，不新增专门 E2E。

## User Scenarios & Testing _(mandatory)_

### User Story 1 - 合并消息统一从 onMessage 接收 (Priority: P1)

作为 SDK 使用者，我希望普通消息和合并消息都通过 `onMessage` 接收，这样消息接收入口保持一致，不需要为合并消息额外注册一个并行回调。

**Why this priority**: `onCombineMessage` 与 `onMessage` 都表达“收到一条消息”，保留两个入口会增加调用方判断成本，也容易出现只监听其中一个导致漏消息的问题。

**Independent Test**: 注册 `onMessage` 后接收一条合并消息，验证回调收到标准消息对象且可通过 `message.type === 'combine'` 识别；同时确认不再需要注册 `onCombineMessage`。

**Acceptance Scenarios**:

1. **Given** 调用方只注册了 `onMessage`，**When** SDK 收到合并消息，**Then** 调用方应能在 `onMessage` 中收到该消息。
2. **Given** 调用方收到一条 `onMessage` 消息，**When** `message.type` 为 `combine`，**Then** 调用方应能继续使用现有合并消息下载解析能力查看详情。
3. **Given** 调用方查看 ChatManager 事件类型，**When** 选择可订阅事件，**Then** 不应再看到 `onCombineMessage` 作为公开事件入口。

---

### User Story 2 - 发送状态不再作为全局公开事件暴露 (Priority: P1)

作为 SDK 使用者，我希望消息发送过程的状态结果通过发送动作本身返回或回调表达，而不是再额外监听一个全局 `onMessageStatus` 事件，这样发送链路更直观。

**Why this priority**: `onMessageStatus` 当前表达发送中、发送成功、发送失败，和发送方法的 Promise 结果及发送选项回调语义重复。移除公开全局事件可以降低 API 面复杂度。

**Independent Test**: 调用 `sendMessage` 时通过发送选项或 Promise 获取发送中、成功、失败结果；类型层确认不能再通过 ChatManager 注册 `onMessageStatus`。

**Acceptance Scenarios**:

1. **Given** 调用方发送一条消息并提供发送中回调，**When** 发送流程开始，**Then** 调用方应能通过发送动作关联的回调获得发送中消息对象。
2. **Given** 调用方发送一条消息，**When** 服务端确认成功，**Then** 调用方应能通过发送动作成功结果获得已发送消息对象。
3. **Given** 调用方发送一条消息失败，**When** 失败发生，**Then** 调用方应能通过发送动作失败结果获得失败消息对象和错误信息。
4. **Given** 调用方查看 ChatManager 事件类型，**When** 选择可订阅事件，**Then** 不应再看到 `onMessageStatus` 作为公开事件入口。

---

### User Story 3 - 消息置顶事件只保留一个公开名称 (Priority: P1)

作为 SDK 使用者，我希望消息置顶变化只通过一个事件名称通知，这样本地置顶、取消置顶和远端置顶变化不会出现两个近似事件名。

**Why this priority**: `onMessagePinChange` 与 `onPinnedMessageChanged` 语义重复，其中调用方只需要一个稳定事件名来处理置顶状态变化。

**Independent Test**: 注册 `onPinnedMessageChanged` 后执行置顶、取消置顶或接收远端置顶变化，验证事件载荷稳定；类型层确认不能再注册 `onMessagePinChange`。

**Acceptance Scenarios**:

1. **Given** 调用方注册了 `onPinnedMessageChanged`，**When** 当前用户置顶一条消息，**Then** 调用方应收到包含消息、会话、操作和操作者信息的置顶变化事件。
2. **Given** 调用方注册了 `onPinnedMessageChanged`，**When** 当前用户取消置顶一条消息，**Then** 调用方应收到取消置顶事件。
3. **Given** 其他端或其他用户触发消息置顶变化，**When** SDK 收到对应通知，**Then** 调用方应仍通过 `onPinnedMessageChanged` 收到事件。
4. **Given** 调用方查看 ChatManager 事件类型，**When** 选择可订阅事件，**Then** 不应再看到 `onMessagePinChange` 作为公开事件入口。

---

### User Story 4 - 流式消息事件保持现状 (Priority: P2)

作为 SDK 使用者，我希望流式消息仍通过 `onStreamMessage` 接收，以便继续按分片、增量文本、累计文本和流状态处理实时输出。

**Why this priority**: 流式消息与普通消息的触发频率和处理方式不同，当前需求明确要求暂时保留 `onStreamMessage`，避免在本次事件收敛中扩大迁移范围。

**Independent Test**: 注册 `onStreamMessage` 后接收流式消息分片，验证仍按原有流式事件语义触发；同时确认流式消息不会因为本次调整改走普通 `onMessage`。

**Acceptance Scenarios**:

1. **Given** 调用方注册了 `onStreamMessage`，**When** SDK 收到流式消息分片，**Then** 调用方应继续收到流式消息事件。
2. **Given** 流式消息分片存在乱序或重复，**When** SDK 处理后派发事件，**Then** 调用方应继续获得稳定的增量文本、累计文本和状态信息。
3. **Given** 本次事件面收敛完成，**When** 调用方查看可订阅事件，**Then** `onStreamMessage` 仍应保留。

### Edge Cases

- 合并消息是离线补偿、历史同步或实时下行时，都应保持通过 `onMessage` 对外呈现，不因来源不同出现两个事件入口。
- 发送状态公开事件移除后，发送失败、发送超时、服务端拒绝和本地连接不可用仍必须能通过发送动作自身被调用方感知。
- 内部如果仍需要发送成功后的消息上下文用于后续通知定位，必须继续保证撤回、编辑、置顶等通知能找到正确会话。
- 置顶事件同时存在本地操作回调和远端通知时，不应因为删除重复事件名导致调用方收不到状态变化。
- 流式消息与合并消息同时具备扩展字段时，流式判定优先保持既有流式事件语义，避免被误归入普通消息入口。

## Test Layer Requirements _(mandatory)_

### Unit Tests

- Coverage goals: 覆盖 ChatManager 事件类型边界、合并消息接收事件分发、发送状态公开事件移除后的发送结果表达、置顶事件唯一公开名称、流式消息继续走 `onStreamMessage`。
- Planned location: `tests/unit/core/message/`、`tests/unit/managers/chat-manager.test.ts`、`tests/types/chat-manager-events.d.ts`
- Not applicable rationale: N/A，本功能直接改变公开事件面和消息分发行为，单元测试必需。

### Integration Tests

- Coverage goals: 覆盖 `ChatManager.addEventHandler` 与 EventHub、消息接收器、消息发送器之间的协作；验证合并消息进入 `onMessage` 后不会影响会话消息更新、发送 Promise / 回调语义、置顶事件本地与远端路径。
- Planned location: `tests/integration/chat-manager/`、`tests/integration/mock/chat-manager-public-api.test.ts`
- Not applicable rationale: N/A，本功能涉及 manager 事件入口、消息发送链路和接收链路协作，集成测试必需。

### E2E Tests

- Coverage goals: 复用现有真实环境和浏览器 API 用例验证普通消息主路径不回退；本期不新增专门 E2E，用单元、集成与类型测试精确覆盖事件面收敛。
- Planned location: `tests/e2e/api/message-single.spec.ts`、`tests/e2e/api/chat-manager-advanced.spec.ts`、`tests/e2e/fixtures/sdk-api.ts`
- Not applicable rationale: 本次不新增用户可见 UI 流程；E2E 复用现有 API 级浏览器用例，不新增专门 E2E。

### Gate Impact

- Required gates: `npm run test:run`、`npm run lint`、`npm run type-check`；若文档 API 校验受事件类型变更影响，则补跑 `npm run docs:api:check`。
- Validation notes: PR gate 必须阻塞公开事件类型回归、合并消息事件分发回归、发送主链路回归和置顶事件命名回归；流式消息事件保留必须有回归测试兜底。

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: ChatManager MUST keep `onMessage` as the unified public event for non-stream incoming messages.
- **FR-002**: ChatManager MUST deliver combine messages through `onMessage`.
- **FR-003**: ChatManager MUST allow callers to identify combine messages only through the existing `message.type === 'combine'` value, without adding another public combine marker.
- **FR-004**: ChatManager MUST remove `onCombineMessage` from the public event registration surface.
- **FR-005**: ChatManager MUST keep `onStreamMessage` as a public event in this feature.
- **FR-006**: Stream messages MUST continue to be delivered through `onStreamMessage`, preserving existing stream status, delta text, full text, ordering, deduplication, completion, and error semantics.
- **FR-007**: ChatManager MUST remove `onMessageStatus` from the public event registration surface.
- **FR-008**: Message sending MUST continue to expose sending, success, and failure outcomes through `sendMessage` options callbacks `onSending`, `onSuccess`, `onFailed`, plus the existing Promise success and failure result.
- **FR-009**: Removing public `onMessageStatus` MUST NOT prevent internal message context tracking needed by later message action notifications.
- **FR-010**: ChatManager MUST keep `onPinnedMessageChanged` as the single public event for message pin and unpin changes.
- **FR-011**: ChatManager MUST remove `onMessagePinChange` from the public event registration surface.
- **FR-012**: Local pin and unpin operations MUST continue to notify callers through `onPinnedMessageChanged`.
- **FR-013**: Remote pin and unpin notifications MUST continue to notify callers through `onPinnedMessageChanged`.
- **FR-014**: Event payloads kept by this feature MUST remain business-level payloads and MUST NOT expose raw protocol notification shapes.
- **FR-015**: Public documentation and type references MUST describe the final event surface consistently: `onMessage`, `onStreamMessage`, `onPinnedMessageChanged`, and other unrelated existing ChatManager events that remain in scope.
- **FR-016**: Existing unrelated ChatManager events MUST remain available unless explicitly listed for removal in this specification.
- **FR-017**: Public documentation MUST completely remove `onCombineMessage`, `onMessageStatus`, and `onMessagePinChange`; it MUST NOT keep separate migration guidance or removed-event entries for these names.

### Key Entities _(include if feature involves data)_

- **Incoming Message Event**: A public message delivery event used for ordinary and combine messages. It carries the standard message object and allows consumers to inspect message type.
- **Stream Message Event**: A public stream delivery event that carries incremental stream information and remains separate from ordinary incoming message delivery.
- **Message Send Outcome**: The sending operation's own observable states and results, including sending, success, and failure outcomes.
- **Pinned Message Changed Event**: The public event representing message pin or unpin changes from either local operations or remote notifications.

### Assumptions

- This feature is a breaking public API cleanup because it removes event handler keys that callers may currently use.
- Removed public events are deleted directly in this feature; no deprecated compatibility period or dual-dispatch behavior is required.
- `onStreamMessage` remains public in this feature and should not be migrated to `onMessage` yet.
- `onPinnedMessageChanged` is the preferred retained event name because it is already the event used by existing pin/unpin flows.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of combine message receive tests observe combine messages through `onMessage`.
- **SC-002**: 0 public ChatManager event handler types expose `onCombineMessage`, `onMessageStatus`, or `onMessagePinChange`.
- **SC-003**: 100% of existing stream message behavior tests continue to pass with `onStreamMessage`.
- **SC-004**: 100% of pin/unpin event tests use `onPinnedMessageChanged`.
- **SC-005**: Sending success and failure remain observable through the send operation in all covered send-path tests.
- **SC-006**: Public reference documentation contains no mention of `onCombineMessage`, `onMessageStatus`, or `onMessagePinChange`.
