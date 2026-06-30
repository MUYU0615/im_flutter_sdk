# 功能规格：合并消息收发（combine）

**Feature Branch**: `019-combine-message`  
**Created**: 2026-02-24  
**Status**: Draft  
**Input**: 用户需求："写 019 spec，实现收发合并消息；合并消息包含 `messageList`，将列表消息编码后以文件上传，拿到 URL 后按文件消息方式发送；协议中包含 `combine` 类型；支持转发合并消息并通过 `combineLevel` 限制最多 10 级；发送与回调逻辑参考旧工程 `mSync.ts` 和 `handleChatMsg.ts`；上传与编码需参考 018 的跨平台兼容方案。"

**Reference**:

- `/Users/zhangdong/code/websdk-new/packages/IM/sdk/src/engineCore/mSync.ts`（`upLoadFile` 中 `message.type === 'combine'`）
- `/Users/zhangdong/code/websdk-new/packages/IM/sdk/src/handleMessages/handleChatMsg.ts`（`generateMessage` 的 `case 8`）
- `/Users/zhangdong/code/websdk-new/packages/IM/sdk/src/engineCore/connection.ts`（`downloadAndParseCombineMessage`）
- `specs/018-cross-platform-adapter/spec.md`

## Clarifications

### Session 2026-02-24

- Q: 接收合并消息时，SDK 是否必须自动下载并解码 `messageList`？ → A: 选项 C：默认只回调元信息，同时提供按需拉取并解码详情的 SDK API，并参考旧工程 `downloadAndParseCombineMessage` 方法语义。
- Q: 合并消息编码时 `messageList` 顺序规则是什么？ → A: 选项 B：严格保持传入 `messageList` 原始顺序，不做 SDK 侧重排。
- Q: `messageList` 是否允许系统消息（ACK/回执/撤回等）？ → A: 选项 B：仅允许业务消息类型（含 `combine`），系统消息拒绝；且系统消息本身不对外回调，业务侧通常无法获取。
- Q: 按需下载并解码合并消息详情时，出现单条子消息解析失败如何处理？ → A: 选项 A：采用整体失败策略，不返回部分成功结果。
- Q: 合并消息条数上限是否在“接收按需解码”阶段同样生效？ → A: 选项 B：发送与接收按需解码均限制 300 条，超限失败。

## 用户场景与测试 _(mandatory)_

### 用户故事 1 - 发送合并消息（Priority: P1）

作为 SDK 使用者，我希望把一组已有消息（文本、图片、文件、自定义、以及合并消息）作为 `messageList` 发送为一条合并消息，业务侧只调用一次发送接口即可完成聚合转发。

**Why this priority**: 合并转发是核心业务能力，直接影响消息分享效率与用户体验。

**Independent Test**: 仅实现该故事即可完成“构造 `messageList` → 发送合并消息 → 对端收到一条 `combine` 消息”的闭环。

**Acceptance Scenarios**:

1. **Given** 业务端传入包含多种消息类型的 `messageList`，**When** 调用发送合并消息，**Then** SDK 产出一条 `type = combine` 的可发送消息并完成发送。
2. **Given** 合并消息内容编码与上传成功，**When** 发送流程继续，**Then** SDK 使用上传返回的资源地址作为合并消息附件地址完成下行投递。
3. **Given** 业务端按指定顺序传入 `messageList`，**When** 编码并发送后再按需解码，**Then** 子消息顺序与传入顺序一致。
4. **Given** 编码或上传失败，**When** 发送流程终止，**Then** SDK 返回明确失败结果且不产生“发送成功”状态。

---

### 用户故事 2 - 接收并回调合并消息（Priority: P1）

作为 SDK 使用者，我希望在接收链路中得到结构化的合并消息对象（含标题、摘要、资源地址、层级等字段），并通过独立事件回调消费该消息。

**Why this priority**: 没有稳定的接收回调，发送能力无法形成完整业务闭环。

**Independent Test**: 仅实现该故事即可通过模拟下行 `combine` 消息验证 SDK 解析字段和回调行为。

**Acceptance Scenarios**:

1. **Given** 服务端下行协议消息标识为 `combine`，**When** SDK 解码消息体，**Then** 生成 `type = combine` 的标准消息对象并触发合并消息回调。
2. **Given** 下行合并消息携带标题、摘要、资源与层级字段，**When** SDK 回调业务层，**Then** 字段语义与发送侧保持一致。
3. **Given** 业务端需要查看合并消息详情，**When** 调用按需拉取并解码接口，**Then** SDK 返回解码后的子消息列表。
4. **Given** 按需解码过程中任一子消息解析失败，**When** SDK 结束本次解码，**Then** 返回整体失败错误且不返回部分子消息列表。
5. **Given** 按需解码发现子消息总数超过 300 条，**When** SDK 校验详情载荷，**Then** 返回超限错误并终止解析。
6. **Given** 非合并消息下行，**When** SDK 处理消息，**Then** 保持原有消息回调行为不变。

---

### 用户故事 3 - 支持合并消息再次转发与层级限制（Priority: P1）

作为 SDK 使用者，我希望把已收到的合并消息再次加入新的 `messageList` 转发，同时确保嵌套层级不超过 10，避免无限嵌套导致稳定性风险。

**Why this priority**: “合并消息再转发”是用户常见操作，层级限制是必须的保护机制。

**Independent Test**: 仅实现该故事即可验证“转发已存在合并消息”与“超过层级限制”两条关键路径。

**Acceptance Scenarios**:

1. **Given** `messageList` 中包含已有 `combine` 消息，**When** 创建新合并消息，**Then** SDK 能正确计算并写入新的 `combineLevel`。
2. **Given** 计算后的 `combineLevel` 小于等于 10，**When** 发送，**Then** 发送成功。
3. **Given** 计算后的 `combineLevel` 大于 10，**When** 发送，**Then** SDK 拒绝发送并返回明确错误。

---

### 用户故事 4 - 跨平台一致的合并消息体验（Priority: P2）

作为 SDK 使用者，我希望在 Web、微信小程序、uni-app、Electron Renderer、React Native 等目标平台上以一致方式收发合并消息，而不需要为平台差异编写分支代码。

**Why this priority**: 018 已确立跨平台统一目标，合并消息必须遵循同一兼容策略。

**Independent Test**: 仅实现该故事即可在各目标平台验证发送/接收合并消息流程与错误语义一致。

**Acceptance Scenarios**:

1. **Given** 在任一受支持平台发送合并消息，**When** 编码与上传执行，**Then** 对外 API 与回调语义保持一致。
2. **Given** 平台缺失合并消息所需关键能力，**When** SDK 初始化或发送，**Then** SDK 以统一错误语义快速失败。

### Edge Cases

- `messageList` 为空、缺失或仅包含不支持的消息类型时，发送行为与错误语义。
- `messageList` 混入系统消息（ACK/回执/撤回等）时，校验拒绝与错误提示一致性。
- `messageList` 中包含多层嵌套合并消息时，`combineLevel` 的计算与越界处理。
- 合并消息编码成功但上传失败、或上传成功但发送失败时的状态一致性。
- 合并消息详情按需下载成功但解析失败时，错误类型与重试语义。
- 合并消息详情中仅个别子消息损坏时，必须整体失败且不返回部分结果。
- 合并消息详情载荷中子消息数量超过 300 条时，必须按超限错误处理。
- 收到 `combine` 消息但缺失资源地址或关键字段时的容错与错误策略。
- 受支持平台之间对文件对象/路径表示差异导致的兼容性处理。

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: SDK MUST 提供合并消息创建与发送能力，输入模型包含 `messageList` 字段。
- **FR-002**: `messageList` MUST 支持混合消息类型输入，且允许包含已有 `combine` 消息用于再次转发。
- **FR-002A**: `messageList` MUST 仅接受业务消息类型（`txt`、`img`、`video`、`audio`、`file`、`loc`、`custom`、`combine`）；系统消息（ACK/回执/撤回等）必须在校验阶段拒绝。
- **FR-003**: 发送合并消息时，SDK MUST 将 `messageList` 编码为单一可上传载荷，并通过附件上传链路获取资源地址后再发送最终消息。
- **FR-003A**: SDK MUST 在编码、上传与按需解码链路中保持 `messageList` 的原始顺序一致性，不得自动重排。
- **FR-004**: 最终发送的合并消息 MUST 以 `combine` 语义对外呈现，并携带 `title`、`summary`、`compatibleText`、`filename`、`url`、`secret`、`file_length`、`combineLevel` 等字段。
- **FR-005**: 协议契约 MUST 明确包含 `combine` 消息类型，并保证发送与接收链路的类型映射一致。
- **FR-006**: SDK MUST 在接收链路解析 `combine` 消息并触发独立的合并消息回调事件，回调字段语义与发送侧一致。
- **FR-006A**: SDK MUST 提供“按需下载并解码合并消息详情”的公开能力，返回 `messageList` 对应的子消息列表；该能力默认不在接收回调阶段自动触发。
- **FR-006B**: 按需解码合并消息详情时，SDK MUST 采用“全量成功或整体失败”语义；任一子消息解析失败时必须返回整体失败错误，不得返回部分成功结果。
- **FR-007**: SDK MUST 支持“合并消息再次转发”；当 `messageList` 包含已存在的 `combineLevel` 时，需基于输入计算新的层级。
- **FR-008**: SDK MUST 强制执行 `combineLevel <= 10` 的约束；超过限制时必须拒绝发送并返回可识别错误。
- **FR-009**: SDK MUST 对合并消息链路中的编码失败、上传失败、发送失败分别返回明确错误，且不得误报成功状态。
- **FR-010**: SDK MUST 复用 018 跨平台适配能力处理合并消息的编码载荷与上传输入差异，确保各目标平台对外行为一致。
- **FR-011**: 当平台缺失合并消息所需关键能力时，SDK MUST 采用 fail-fast 策略并返回统一错误语义。
- **FR-012**: 在不使用 `combine` 能力时，SDK MUST 保持现有普通消息发送/接收行为不回归。
- **FR-013**: 单条合并消息的 `messageList` 条数 MUST 有明确上限并在超限时拒绝发送；本期默认沿用现网规则上限 300 条。
- **FR-013A**: SDK MUST 在“按需下载并解码合并消息详情”阶段执行同一条数上限（300 条）；超过上限时必须返回超限错误并停止解析。

### Key Entities _(include if feature involves data)_

- **CombineMessageDraft**: 业务侧创建的合并消息草稿，包含 `messageList`、展示字段（标题/摘要）与可选兼容文本。
- **CombineEncodedPayload**: 由 `messageList` 编码得到的上传载荷实体，承载被合并消息的序列化内容。
- **CombineAttachmentResource**: 上传成功后返回的资源描述（地址、访问密钥、文件长度等），用于最终发送 `combine` 消息。
- **CombineMessageEvent**: SDK 对外回调的合并消息对象，包含消息标识、会话信息、展示字段、资源字段与 `combineLevel`。

### Assumptions

- 合并消息上传沿用现有附件上传鉴权与资源访问模型，不新增独立上传通道。
- 合并消息在协议层作为独立消息语义对外暴露（`type = combine`），并保留兼容文本字段用于旧端展示。
- 跨平台行为边界与 018 一致：Web、微信小程序、uni-app（小程序 / App / H5）、Electron Renderer、React Native。
- `combineLevel` 由 SDK 在发送时计算与校验，业务侧不允许绕过层级限制。

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 合并消息发送闭环测试（编码→上传→发送）在目标平台兼容基线中的通过率达到 100%。
- **SC-001A**: `messageList` 顺序一致性测试通过率达到 100%（输入顺序与按需解码输出顺序完全一致）。
- **SC-001B**: `messageList` 类型校验测试通过率达到 100%，系统消息混入场景拦截成功率达到 100%。
- **SC-002**: 合并消息接收与回调字段契约测试通过率达到 100%，并且 `onCombineMessage` 误触发率为 0。
- **SC-002A**: 合并消息详情按需下载与解码场景测试通过率达到 100%，且失败场景能返回可识别错误。
- **SC-002B**: 合并消息详情解码的“整体失败”契约测试通过率达到 100%，失败场景下部分结果返回次数为 0。
- **SC-002C**: 合并消息详情条数超限（>300）场景拦截成功率达到 100%。
- **SC-003**: 嵌套层级测试中，`combineLevel` 计算准确率达到 100%，超过 10 级时拦截成功率达到 100%。
- **SC-004**: 合并消息转发场景测试通过率达到 100%，包含“普通消息组合转发”和“已合并消息再次转发”。
- **SC-005**: 非合并消息回归用例通过率达到 100%，确认引入 `combine` 后无行为回归。
