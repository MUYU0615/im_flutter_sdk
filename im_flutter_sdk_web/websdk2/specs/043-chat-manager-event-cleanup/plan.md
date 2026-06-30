# 实施方案：ChatManager 事件面收敛

**Branch**: `043-chat-manager-event-cleanup` | **Date**: 2026-05-25 | **Spec**: `specs/043-chat-manager-event-cleanup/spec.md`
**Input**: Feature specification from `/specs/043-chat-manager-event-cleanup/spec.md`

## Summary

本期收敛 ChatManager 的公开事件面：合并消息不再通过 `onCombineMessage` 单独分流，而是和普通非流式消息一样进入 `onMessage`；`onMessageStatus` 不再作为全局公开事件暴露，发送状态保留在 `sendMessage` options 回调和 Promise 结果中；消息置顶事件只保留 `onPinnedMessageChanged`，删除未实际派发的 `onMessagePinChange`；`onStreamMessage` 明确保留，继续承载流式消息分片语义。

技术方案保持现有消息链路分层：事件类型收敛在 `src/types/event-system.ts`；合并消息分发调整在 `MessageReceiver.dispatchMessage`；发送状态公开事件删除在 `MessageSender`，同时保留 `onSending/onSuccess/onFailed` 回调；内部 sent 消息上下文不再依赖公开 `onMessageStatus`，改为内部专用路径；置顶事件只保留当前已有的 `PINNED_MESSAGE_CHANGED` 派发路径。文档层完全删除三个旧事件名，不保留 deprecated 或迁移说明。

## Technical Context

**Language/Version**: TypeScript 5.x（strict）
**Primary Dependencies**: 现有 `ChatClient`、`ChatManager`、`MessageReceiver`、`MessageSender`、`StreamMessageHandler`、`EventHub`、MSync codec/proto、Vitest、Vite、Playwright
**Storage**: N/A；本功能只调整事件类型与事件分发，不新增持久化，不改变消息、会话或缓存 schema
**Testing**: Vitest 单元测试、Vitest 集成测试、TypeScript 类型测试；E2E 复用现有 API/浏览器用例，不新增专门 E2E
**Target Platform**: Web SDK 库，兼容浏览器与现有平台适配器环境
**Project Type**: 单仓库 SDK 库项目（`src/`、`tests/`、`specs/`、`docs/`）
**Performance Goals**: 合并消息改派发 `onMessage` 不增加额外异步处理；删除公开发送状态事件后不得增加发送链路额外事件 fan-out；流式消息处理性能保持现状
**Constraints**:
- 直接移除 `onCombineMessage`、`onMessageStatus`、`onMessagePinChange`，不保留 deprecated、双派发或运行时兼容分支
- `onStreamMessage` 保留，流式消息不得改走 `onMessage`
- 合并消息只通过 `message.type === 'combine'` 识别，不新增 `isCombineMessage` 或外层事件元信息
- 发送状态对外只通过 `sendMessage` options 回调和 Promise 表达
- 内部 sent 消息上下文必须保留，不能再依赖公开 `onMessageStatus`
- 文档完全删除三个旧事件名，不保留迁移说明
**Scale/Scope**: 3 个公开事件名删除、1 条合并消息分发路径调整、1 条发送状态内部依赖替换、1 个置顶事件命名收敛、类型测试/单元测试/集成测试/文档/版本治理更新

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- [x] **性能优先**: 设计删除冗余事件分发，不引入额外网络请求、轮询、同步阻塞或全量刷新
- [x] **类型安全**: 公开事件面通过 TypeScript handler map 收敛，删除事件必须在类型层不可注册；禁止使用 `any`
- [x] **测试驱动**: spec 已要求 unit / integration / types，并明确 E2E 复用策略；tasks 阶段需落到具体文件
- [x] **可靠性**: 发送成功上下文从公开事件依赖切到内部路径，避免撤回/编辑/置顶通知定位回退
- [x] **可扩展性**: 保持 `onStreamMessage` 独立，后续若迁移流式事件可单独立项
- [x] **可观测性**: 本期不新增敏感日志；现有发送/接收日志继续脱敏使用
- [x] **版本管理**: 公开事件移除属于破坏性变更，实现完成后必须更新版本号、`CHANGELOG.md` 并提交中文 commit

## Project Structure

### Documentation (this feature)

```text
specs/043-chat-manager-event-cleanup/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/
│   └── requirements.md
├── contracts/
│   └── chat-manager-event-cleanup.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── core/
│   ├── events/
│   │   └── event-hub.ts
│   └── message/
│       ├── message-receiver.ts
│       ├── message-sender.ts
│       └── stream-message-handler.ts
├── managers/
│   └── chat-manager.ts
└── types/
    ├── event-system.ts
    ├── chat-manager.ts
    └── index.ts

tests/
├── unit/
│   ├── core/message/
│   └── managers/
├── integration/
│   ├── chat-manager/
│   └── mock/
├── types/
└── e2e/
    └── api/

docs/
└── reference/
```

**Structure Decision**: 使用现有单包 SDK 结构。事件名称、payload map、handler map 在 `src/types/event-system.ts` 收敛；消息接收分流在 `src/core/message/message-receiver.ts` 调整；发送状态外部事件删除和 options 回调保留在 `src/core/message/message-sender.ts`；ChatManager 注册入口保持 `addEventHandler/removeEventHandler` 不变；公开文档在 `docs/reference/` 删除旧事件名。

## Phase 0: Research

研究结论见 `research.md`，覆盖：

1. 直接移除 vs deprecated 兼容期的取舍
2. 合并消息使用 `onMessage` + `message.type === 'combine'` 的契约
3. `onMessageStatus` 删除后的发送状态表达方式
4. 内部 sent 上下文替换方案
5. 置顶事件保留 `onPinnedMessageChanged` 的原因
6. 流式消息暂时保留独立事件的边界
7. 文档完全删除旧事件名的影响

## Phase 1: Design & Contracts

设计产物：

- `data-model.md`：定义最终事件面、移除事件、发送状态结果、合并消息识别和内部 sent 上下文
- `contracts/chat-manager-event-cleanup.md`：记录 ChatManager handler contract、消息分发 contract、发送状态 contract、文档删除 contract
- `quickstart.md`：记录推荐验证命令、分层测试入口和 E2E 复用策略

设计要点：

1. **事件 surface**：从 `ChatEventName`、`EventPayloadMap`、`ChatEventHandlerMap` 派生面中删除 `onCombineMessage`、`onMessageStatus`、`onMessagePinChange`；保留 `onMessage`、`onStreamMessage`、`onPinnedMessageChanged` 和其他未列为移除的 ChatManager 事件。
2. **合并消息分发**：`MessageReceiver.dispatchMessage` 对非流式消息统一派发 `onMessage`；不再对 `message.type === 'combine'` 特判到单独事件；`message.type` 仍为唯一公开识别方式。
3. **流式消息保留**：`isStreamMessage(message)` 仍优先进入 `StreamMessageHandler`，最终继续派发 `onStreamMessage`，不触发 `onMessage`。
4. **发送状态公开面**：`MessageSender` 不再 dispatch `onMessageStatus`；`options.onSending`、`options.onSuccess`、`options.onFailed` 和 Promise 成功/失败继续保持。
5. **内部 sent 上下文**：删除 `MessageReceiver` 构造函数中对公开 `onMessageStatus` 的内部 handler 依赖，改为内部专用事件或 `MessageSender` ACK 成功后调用的内部上下文记录机制。该机制不得出现在 ChatManager 公开事件类型中。
6. **置顶事件**：保留 `PINNED_MESSAGE_CHANGED` 的本地操作和远端通知派发；删除 `MESSAGE_PIN_CHANGE` 常量、payload map 和文档引用。
7. **文档策略**：API 文档、API review matrix、命名约定等 active reference 中完全删除三个旧事件名；不新增迁移说明，不标注 deprecated。
8. **测试策略**：类型测试确认旧事件不可注册、保留事件可注册；单元测试覆盖合并/流式/发送状态/置顶；集成测试覆盖 ChatManager handler 和 EventHub 协作；E2E 仅更新/复用现有用例。

## Agent Context Update

执行命令：

```bash
SPECIFY_FEATURE=043-chat-manager-event-cleanup .specify/scripts/bash/update-agent-context.sh codex
```

预期：将 043 的 TypeScript 事件面收敛、ChatManager 公开事件删除、`onStreamMessage` 保留、E2E 复用策略同步到 `AGENTS.md` 的最近技术上下文。

## Phase 2: Task Planning Approach

由 `/speckit.tasks` 拆解为：

1. 先更新事件类型、handler map、公开导出和类型测试
2. 再调整 `MessageReceiver` 合并消息分发和流式消息保留测试
3. 替换 `onMessageStatus` 内部 sent 上下文依赖，保留 `sendMessage` options 回调测试
4. 删除 `onMessagePinChange` 类型和文档引用，验证 `onPinnedMessageChanged`
5. 更新单元、集成、类型、E2E fixture/coverage matrix
6. 更新 reference 文档，完全删除旧事件名
7. 更新版本号、`CHANGELOG.md`
8. 跑验证命令并提交中文 commit

## Post-Design Constitution Check

- [x] **性能优先**: 设计删除冗余事件，不引入额外网络或缓存操作
- [x] **类型安全**: 最终公开事件面由类型测试兜底，旧事件在类型层不可注册
- [x] **测试驱动**: 类型、unit、integration、复用 E2E 的覆盖责任明确
- [x] **可靠性**: sent 上下文保留为内部机制，避免通知定位回退
- [x] **可扩展性**: 流式消息保留单独事件，后续收敛不与本期耦合
- [x] **可观测性**: 不新增日志面，不改变敏感信息处理
- [x] **版本管理**: 破坏性变更纳入 release 治理任务

## Complexity Tracking

无 Constitution 例外。
