# 功能规格：消息扩展字段（direct / receiverList / isBroadcast / isContentReplaced / deliverOnlineOnly / priority）

**Feature Branch**: `017-message-extra-fields`  
**Created**: 2026-02-13  
**Status**: Draft  
**Input**: 用户需求："给消息补充 direct、receiverList、isBroadcast、isContentReplaced、deliverOnlineOnly、priority 字段，并实现创建/发送/接收/回调链路行为，同时补齐 spec/plan/tasks/test case。"

**Reference**:
- `specs/003-message-create/spec.md`
- `specs/006-protobuf-ws/spec.md`
- `/Users/zhangdong/code/websdk-new/packages/IM/sdk/src/message/text.ts`

## 用户场景与测试 *(mandatory)*

### 用户故事 1 - 创建并发送带扩展字段的消息（Priority: P1）

作为 SDK 使用者，我需要在创建消息与发送消息时设置投递策略字段（`receiverList`、`deliverOnlineOnly`、`priority`），以支持定向投递、仅在线投递与优先级策略。

**Why this priority**: 这是发送侧核心能力，直接影响消息投递行为。

**Independent Test**: 仅实现该故事即可通过创建接口构造扩展字段消息，并验证发送请求中包含对应策略信息。

**Acceptance Scenarios**:
1. **Given** 创建群组消息并设置 `receiverList`，**When** 执行发送，**Then** 发送请求按定向消息语义处理该列表。
2. **Given** 创建消息并设置 `deliverOnlineOnly = true`，**When** 执行发送，**Then** 发送请求按“仅在线投递”语义处理。
3. **Given** 创建聊天室消息并设置 `priority`，**When** 执行发送，**Then** 发送请求按优先级语义处理。
4. **Given** 未设置上述字段，**When** 创建并发送消息，**Then** 保持当前默认行为不变。

---

### 用户故事 2 - 接收真实消息时回调扩展字段（Priority: P1）

作为 SDK 使用者，我需要在收到真实下行消息时，拿到 `direct`、`isBroadcast`、`isContentReplaced` 等字段，便于业务展示与判定。

**Why this priority**: 接收回调是业务消费入口，字段缺失会导致业务端无法正确判断消息语义。

**Independent Test**: 仅实现该故事即可验证真实消息回调字段完整，且 ACK 不会误回调到 `onMessage`。

**Acceptance Scenarios**:
1. **Given** 服务端下行真实聊天消息，**When** 触发 `onMessage`，**Then** 回调消息包含 `direct = RECEIVE`。
2. **Given** 服务端下行聊天室消息带广播标记，**When** 触发 `onMessage`，**Then** 回调消息包含 `isBroadcast = true`。
3. **Given** 服务端下行消息带内容替换标记，**When** 触发 `onMessage`，**Then** 回调消息包含 `isContentReplaced = true`。
4. **Given** 服务端下行 ACK 类消息，**When** SDK 处理回执，**Then** ACK 仅内部处理，不触发 `onMessage`。

---

### 用户故事 3 - 统一消息方向语义（Priority: P2）

作为 SDK 使用者，我希望消息对象统一具备方向语义，便于 UI 和存储层区分“我发出的消息”和“我收到的消息”。

**Why this priority**: 有助于减少业务层重复判断逻辑，提升可维护性。

**Independent Test**: 仅实现该故事即可验证发送链路与接收链路对消息方向字段赋值一致。

**Acceptance Scenarios**:
1. **Given** 本地创建并发送消息，**When** 消息进入对外消息对象流转，**Then** 消息方向为 `SEND`。
2. **Given** 服务端下行真实消息，**When** 进入 `onMessage` 回调，**Then** 消息方向为 `RECEIVE`。

---

### 用户故事 4 - 向后兼容与平滑升级（Priority: P2）

作为已有 SDK 使用者，我希望不传新增字段时现有行为不变，并且旧业务代码无需改动即可运行。

**Why this priority**: 降低升级成本，避免对既有业务造成回归风险。

**Independent Test**: 仅实现该故事即可验证历史创建/发送/接收场景行为保持一致。

**Acceptance Scenarios**:
1. **Given** 旧代码不传新增字段，**When** 创建/发送/接收消息，**Then** 行为与改造前保持一致。
2. **Given** 旧业务只消费原有字段，**When** SDK 升级后运行，**Then** 不会因为新增字段导致异常。

### Edge Cases

- `receiverList` 为空数组或包含空字符串时的处理策略。
- 非群组消息设置 `receiverList` 时的处理策略（校验失败或忽略，需统一）。
- 同时设置 `receiverList` 与 `deliverOnlineOnly` 时的优先级策略。
- 下行消息缺失广播/内容替换标记时，`isBroadcast` 与 `isContentReplaced` 的默认值。
- ACK、回执、撤回等内部消息类型必须不进入 `onMessage`。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: SDK MUST 在公开 `Message` 模型中支持以下扩展字段：`direct`、`receiverList`、`deliverOnlineOnly`、`priority`、`isBroadcast`、`isContentReplaced`。
- **FR-002**: SDK MUST 在创建消息参数层支持 `receiverList`、`deliverOnlineOnly`、`priority` 输入，并进行可测试的参数校验。
- **FR-003**: `receiverList` MUST 用于群组消息定向投递语义；当输入不满足规则时必须返回明确错误信息。
- **FR-004**: `deliverOnlineOnly` MUST 表达“仅在线投递”语义，不设置时保持默认投递行为。
- **FR-005**: `priority` MUST 支持 `'high' | 'normal' | 'low'`，并在适用场景下影响服务端投递优先级语义。
- **FR-006**: 对外真实消息回调 MUST 带 `direct` 字段；发送侧消息为 `SEND`，下行真实消息为 `RECEIVE`。
- **FR-007**: ACK 及其他仅供 SDK 内部处理的消息 MUST NOT 触发 `onMessage` 回调。
- **FR-008**: SDK MUST 解析下行消息中的广播语义并映射为 `isBroadcast` 字段（适用于聊天室语义）。
- **FR-009**: SDK MUST 解析下行消息中的“内容被替换”语义并映射为 `isContentReplaced` 字段。
- **FR-010**: 新增字段改造 MUST 覆盖创建、发送、接收、事件回调、单元测试与集成测试链路。
- **FR-011**: 规格文档 MUST 同步更新到与该能力相关的 spec/plan/tasks 文档集合，确保需求与执行文档一致。
- **FR-012**: 在不传新增字段时，SDK MUST 保持与当前版本兼容，不改变既有默认行为。

### Key Entities *(include if feature involves data)*

- **ExtendedMessage**: 对外暴露的消息对象，新增方向、投递策略与下行语义字段。
- **DeliveryPolicy**: 发送策略集合（`receiverList`、`deliverOnlineOnly`、`priority`），用于表达投递约束与优先级。
- **DownlinkMessageSemantics**: 从服务端下行消息中解析出的语义信息（`isBroadcast`、`isContentReplaced`、`direct`）。

### Assumptions

- `priority` 在非聊天室消息中允许透传但不改变默认业务语义；聊天室场景为主要生效场景。
- `isBroadcast` 仅在聊天室语义下有意义，其他会话类型默认不置为 `true`。
- 方向字段 `direct` 仅出现在真实消息对象上；ACK/内部回执消息不对外暴露。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 扩展字段相关测试场景覆盖创建、发送、接收、回调四条链路，新增用例通过率达到 100%。
- **SC-002**: ACK 误回调到 `onMessage` 的问题在回归测试中为 0 次出现。
- **SC-003**: 在真实下行消息场景中，`direct/isBroadcast/isContentReplaced` 字段解析准确率达到 100%（以契约用例为准）。
- **SC-004**: 不使用新增字段的历史调用样例可无改造运行，回归用例通过率达到 100%。

