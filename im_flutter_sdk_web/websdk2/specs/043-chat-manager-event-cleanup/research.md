# Research: ChatManager 事件面收敛

## Decision: 旧事件直接移除，不做 deprecated 兼容

`onCombineMessage`、`onMessageStatus`、`onMessagePinChange` 在本期直接从公开事件面删除，不保留 deprecated、双派发或运行时兼容分支。

**Rationale**: 本功能目标是收敛公开事件面，继续保留旧事件会让调用方和测试继续面对两套语义。用户已明确选择直接移除，且其中 `onMessagePinChange` 当前没有实际派发点。

**Alternatives considered**:
- 保留一个版本 deprecated 并双派发：迁移更温和，但会扩大测试面，并延长重复 API 存在时间。
- 类型层删除、运行时兼容：行为更隐蔽，容易出现“类型不可用但运行时仍触发”的不一致。

## Decision: 合并消息统一走 `onMessage`

非流式合并消息进入 `onMessage`，调用方仅通过 `message.type === 'combine'` 识别，不新增 `isCombineMessage` 或外层事件元信息。

**Rationale**: 合并消息本质仍是一条消息，`type` 已经是稳定公开字段。使用现有字段能避免重复语义，也符合“普通消息和合并消息统一入口”的用户目标。

**Alternatives considered**:
- 保留 `onCombineMessage`：入口重复，调用方可能漏注册。
- 在消息上增加 `isCombineMessage`：与 `type` 重复，增加长期维护成本。
- 为 `onMessage` 包一层事件 envelope：会破坏现有 `onMessage(message)` 形态，迁移范围更大。

## Decision: 流式消息继续走 `onStreamMessage`

`onStreamMessage` 暂时保留。`isStreamMessage(message)` 判定仍优先进入 `StreamMessageHandler`，继续输出流式状态、增量文本、累计文本、乱序去重和完成/错误语义。

**Rationale**: 流式消息的回调频率和语义与普通消息不同，用户明确要求暂时保留。将其并入 `onMessage` 会改变调用方对“收到一条消息”的预期。

**Alternatives considered**:
- 现在合并到 `onMessage`：事件面更少，但会引入流式分片和普通消息语义混用的问题。
- 同时派发两个事件：会造成重复处理和状态顺序问题。

## Decision: 发送状态通过 `sendMessage` options 和 Promise 表达

删除公开 `onMessageStatus` 后，发送中、发送成功、发送失败继续通过 `sendMessage` 的 `onSending`、`onSuccess`、`onFailed` 回调以及 Promise 成功/失败结果表达。

**Rationale**: 发送状态天然属于某一次发送动作。放在 options 和 Promise 上能保持上下文局部化，避免调用方通过全局事件再反查消息来源。

**Alternatives considered**:
- 只保留 Promise：无法表达发送中状态。
- 新增发送任务对象：能力更强，但超出本次事件面收敛范围。
- 保留 `onMessageStatus`：继续暴露重复事件。

## Decision: sent 消息上下文改为内部机制

当前 `MessageReceiver` 通过内部 handler 监听 `onMessageStatus` 的 `sent` 状态来记录消息上下文。删除公开 `onMessageStatus` 后，该依赖必须改为内部专用路径，例如内部事件名或发送 ACK 成功后的直接内部通知。

**Rationale**: sent 上下文用于后续消息动作通知定位会话，不能随着公开事件一起丢失。但它不应该绑定到 ChatManager 公开事件面。

**Alternatives considered**:
- 继续保留 `onMessageStatus` 仅供内部使用：类型和命名容易继续泄漏到公开面。
- 完全删除上下文记录：会增加撤回、编辑、置顶等通知缺少会话定位的风险。
- 由每个 notify 自行推断上下文：重复逻辑多，且部分 notify 缺字段。

## Decision: 置顶事件只保留 `onPinnedMessageChanged`

保留当前实际派发的 `onPinnedMessageChanged`，删除 `onMessagePinChange`。

**Rationale**: `onPinnedMessageChanged` 已覆盖本地 `pinMessage/unpinMessage` 和远端通知路径。`onMessagePinChange` 当前只存在于类型定义，没有实际派发点，删除它能降低误用。

**Alternatives considered**:
- 保留两个事件：语义重复，调用方不知道哪个是 canonical。
- 改名为 `onMessagePinChanged`：需要额外迁移当前已使用的事件名，收益不足。

## Decision: 文档完全删除旧事件名

API 文档和 reference 中完全删除 `onCombineMessage`、`onMessageStatus`、`onMessagePinChange`，不保留迁移说明或 removed/deprecated 条目。

**Rationale**: 用户已选择直接删除且不写迁移说明。active reference 应只呈现当前可用 API，避免调用方继续搜索到旧事件名。

**Alternatives considered**:
- 增加迁移说明：更友好，但与用户澄清结论冲突。
- 保留 removed 条目：会让旧 API 继续占据公开文档面。

## Decision: E2E 复用现有 API/浏览器用例

本期不新增专门 E2E。合并消息分发、事件类型删除、发送状态和置顶事件命名主要由类型、单元和集成测试精确覆盖；E2E 复用现有消息和置顶 API 用例防止主路径回退。

**Rationale**: 本功能不新增 UI 或真实环境主流程，新增专门 E2E 成本较高且稳定性收益有限。类型和单元/集成测试更适合验证事件面收敛。

**Alternatives considered**:
- 新增合并消息 E2E：能覆盖真实浏览器链路，但依赖真实合并消息发送和收端稳定性。
- 新增置顶 E2E：现有 advanced API 已覆盖 `onPinnedMessageChanged`，重复价值有限。
