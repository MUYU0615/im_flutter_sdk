# Research: ChatClient Multi-Device Listener

## Decision: 公开监听面采用分类回调

采用 `onMultiDeviceContact`、`onMultiDeviceGroup`、`onMultiDeviceThread`、`onMultiDeviceConversation`、`onMultiDeviceMessageRemoved` 五个 ChatClient 事件回调。

**Rationale**: 该形态与移动端 `EMMultiDeviceListener` 的类别边界一致，也符合当前 SDK `addEventHandler` 以事件名映射 handler 的模型。业务侧可以按领域只订阅需要的回调，TypeScript 也能为每类 payload 提供更窄的字段提示。

**Alternatives considered**:
- 单一 `onMultiDeviceEvent` 总线：实现简单，但业务需要自行 switch category，类型收窄较弱。
- 挂到各 manager 事件：会把跨设备来源语义和业务状态事件混在一起，破坏 spec 要求的边界。

## Decision: 来源设备统一暴露为 `deviceId?: string`

服务端 `resource`、`clientResource` 或未来 `deviceId` 都归一为 `deviceId?: string`。缺失时保持 `undefined`。

**Rationale**: Web 侧不应把协议字段名直接泄漏为多个公开字段。统一字段能避免调用方同时判断 `resource/clientResource/deviceId`，也让现有业务事件不需要补设备字段。

**Alternatives considered**:
- 同时暴露 `resource` 和 `clientResource`：贴近协议但增加公开 API 噪声。
- 缺失时填当前设备 ID：会伪造来源，导致同设备过滤和业务判断错误。

## Decision: MultiDevice 事件只保证派发，不强制缓存收敛

本期不新增联系人、群组、子区、会话或消息缓存强制更新策略。现有业务事件、manager 同步和显式刷新仍负责本地状态收敛。

**Rationale**: MultiDevice 是跨设备操作通知面，不等同于缓存同步协议。把事件派发和缓存更新强绑定会扩大实现风险，也容易和现有 manager 同步链路产生重复或顺序冲突。

**Alternatives considered**:
- 收到 MultiDevice 后立即 patch 缓存：短期体验更直接，但需要为每类 operation 定义完整冲突解决和失败回滚。
- 收到 MultiDevice 后触发全量刷新：实现简单但性能不可控，且违反“不新增额外刷新风暴”的约束。

## Decision: 同设备回声在可识别时过滤

当 upstream 来源 `deviceId/resource/clientResource` 等于当前 `clientResource` 时，不派发 MultiDevice 事件。缺少来源字段时不做伪造过滤，按 payload 有效性决定是否派发。

**Rationale**: MultiDevice 语义是“当前账号其他设备操作”。同设备回流会造成业务重复处理。缺少来源字段时无法安全判断同设备，不能用当前设备兜底。

**Alternatives considered**:
- 所有当前用户操作都派发：会让 MultiDevice 语义失真。
- 缺少来源字段时全部丢弃：会损失服务端不完整但仍有用的同步事件。

## Decision: 漫游消息删除支持 ID 列表或时间戳范围

`onMultiDeviceMessageRemoved` 支持 `messageIds?: string[]` 和 `beforeTimestamp?: number`，派发前要求至少一个存在。

**Rationale**: 不同服务端删除语义可能是精确消息 ID 或“删除某时间前漫游消息”。同时支持两者可避免丢失语义，并通过“至少一个存在”保证 payload 可执行。

**Alternatives considered**:
- 只支持 `messageIds`：无法表达按时间清理。
- 只支持 `beforeTimestamp`：无法表达精确删除。

## Decision: 移动端 operation 名称映射为 Web 稳定 union

Web 公开 operation 使用大写字符串 union，如 `CONTACT_ACCEPT`、`GROUP_ADD_ADMIN`、`THREAD_CREATE`、`CONVERSATION_PINNED`。未识别 operation 归一为 `UNKNOWN` 或记录日志后丢弃。

**Rationale**: 字符串 union 比数字 operation 更适合对外 API 和 exhaustiveness 检查，也避免把旧协议数字常量绑定到公开契约。

**Alternatives considered**:
- 直接暴露协议数字：不利于文档和跨端一致性。
- 使用 TypeScript enum：项目 Constitution 优先联合类型，除非需要反向映射。

## Decision: E2E 以 handler API 为稳定覆盖，真实双设备触发可进 nightly/backlog

PR gate 先覆盖 handler 注册/移除、类型和 fixture 注入链路；真实服务可稳定触发的类别再进入 E2E API 或 nightly。

**Rationale**: 多设备事件依赖真实账号双资源在线和服务端 notify 行为，部分 operation 在 CI 中不可稳定复现。用 fixture 覆盖协议和事件链路能保证核心 SDK 行为，真实环境状态在 quickstart 中记录。

**Alternatives considered**:
- 所有类别都要求真实 E2E：CI 可靠性风险高。
- 完全不做 E2E：公开 ChatClient handler 能力缺少浏览器入口验证。
