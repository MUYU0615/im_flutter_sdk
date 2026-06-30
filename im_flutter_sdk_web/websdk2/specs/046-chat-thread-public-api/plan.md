# 实施方案：ChatThread 公开 API

**Branch**: `046-chat-thread-public-api` | **Date**: 2026-06-04 | **Spec**: `specs/046-chat-thread-public-api/spec.md`
**Input**: Feature specification from `/specs/046-chat-thread-public-api/spec.md`

## Summary

本特性将当前已半公开的 `ChatThreadManager` / `ChatThread` 从内部调试能力升级为正式公开 API。实现重点不是新增服务端业务能力，而是收口公开 surface：主入口与 `./managers/chat-thread` 子路径导出、公开类型与 JSDoc、API Reference、错误码表、集成文档、demo 和测试门禁。

事件模型必须从现有 `onChatThreadChange + operation` 聚合事件改为移动端对齐的 4 个公开事件：`onChatThreadCreated`、`onChatThreadDestroyed`、`onChatThreadUpdated`、`onChatThreadUserRemoved`。旧 `onChatThreadChange` 不公开也不派发；内部 raw notify 仅作为 MUC Thread 原始通知输入，并归一到 4 个独立公开事件。

REST 行为以当前 websdk2 实现为基础，对照原工程 `/Users/zhangdong/code/websdk-new/packages/IM/sdk/src/apis/threadApi.ts` 的路径、参数校验、分页默认值、批量上限和返回字段归一规则；事件行为对照原工程 `/Users/zhangdong/code/websdk-new/packages/IM/sdk/src/handleMessages/handleMucMsg.ts` 的 Thread MUC 来源，但公开结果必须对齐移动端 4 事件契约。

## Technical Context

**Language/Version**: TypeScript 5.x（strict）
**Primary Dependencies**: 现有 `ChatClient`、Manager 注册体系、`ChatThreadManager`、`ChatThread`、`RestClient`、`EventHub`、`MessageReceiver`、MSync MUC Thread 通知链路、`api-errors.json`、API Reference 生成脚本、Vitest、Vite、Playwright
**Storage**: N/A；本功能不新增持久化，不改变消息、会话、联系人、群组、聊天室或 Thread 缓存 schema
**Testing**: Vitest（unit/integration/contract/types）、Playwright E2E 或真实 demo 验证、`npm run lint`、`npm run type-check`、`npm run docs:api:check`、`npm run errors:check`
**Target Platform**: Web SDK 主库 + 浏览器 demo/API E2E；公开契约需与移动端 Thread 事件命名和语义对齐
**Project Type**: 单仓库 SDK 库项目（`src/`、`tests/`、`demo/`、`docs/`、`specs/`、`scripts/`）
**Performance Goals**:
- ChatThread 事件归一化保持同步轻量处理，不引入额外网络请求。
- REST 方法只做参数校验、请求编排和返回归一化，不引入缓存或隐式重试。
- API Reference 与错误码生成只在构建/文档阶段运行，不影响运行时代码体积。
**Constraints**:
- 不新建分支；当前计划产物手工写入 `specs/046-chat-thread-public-api/`。
- 旧 `onChatThreadChange` 不作为公开事件，不在 API Reference 中暴露，也不对用户 handler 派发。
- 公开事件只包含 4 个：`onChatThreadCreated`、`onChatThreadDestroyed`、`onChatThreadUpdated`、`onChatThreadUserRemoved`。
- `onChatThreadUpdated` 同时承载修改名称、添加回复消息和撤销回复消息。
- 加入、离开、成员加入、成员退出、多设备 Thread 分支不得额外公开为 Thread 变更事件。
- REST 服务端业务错误必须从 `src/rest/api-errors.json` 的 `apis.<operation>.errors` 维护；本地参数校验错误通过对应 `localErrors` 维护。
- API Reference 必须完整覆盖主入口、`./managers/chat-thread`、`ChatThreadManager`、`ChatThread`、公开类型和 4 个事件。
**Scale/Scope**: 覆盖 ChatThread 公开 API surface、REST operation 错误码、4 个 Thread 事件、文档生成入口、集成文档、demo 事件监听和分层测试；不新增服务端接口、不新增缓存、不改变 Thread 消息发送协议。

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

预检结果：

- [x] **性能优先**: 本功能只调整公开 API、REST 归一化、事件映射和文档；事件归一化是本地轻量同步处理，不新增阻塞主线程的流程。
- [x] **类型安全**: 4 个公开事件 payload、REST 参数、返回类型、manager/event handler map 都需要显式 interface；禁止用 `any` 暴露公开类型。
- [x] **测试驱动**: spec 已要求 unit/integration/E2E/API 文档/错误码门禁；plan 将测试文件与覆盖点固化。
- [x] **可靠性**: REST 本地参数校验、服务端错误映射、未知/字段不足 raw notify 忽略、未注册 manager 不派发公开事件均纳入测试。
- [x] **可扩展性**: 保持 Manager capability 路由与 EventHub 模型，不引入跨域耦合；Thread 公开类型独立于 Group/ChatRoom。
- [x] **可观测性**: REST operation 失败继续经 `SDKError` 与结构化日志路径；不得记录 token、完整鉴权头或敏感上下文。
- [x] **版本管理**: 公开 API surface 与文档发生变化，实施完成后必须更新版本号、CHANGELOG，并提交中文 commit message。

Phase 1 设计复检结果：通过。research、data-model、contracts 与 quickstart 已将移动端 4 事件、错误码治理、API Reference 入口和测试门禁固化为可执行设计。

## Project Structure

### Documentation (this feature)

```text
specs/046-chat-thread-public-api/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/
│   └── requirements.md
├── contracts/
│   └── chat-thread-public-api.openapi.yaml
└── tasks.md              # 后续由 /speckit.tasks 生成
```

### Source Code (repository root)

```text
src/
├── index.ts
├── chat-client.ts
├── core/
│   └── message/
│       └── message-receiver.ts
├── managers/
│   ├── chat-thread-manager.ts
│   └── chat-thread/
│       ├── index.ts
│       └── chat-thread.ts
├── rest/
│   ├── api-errors.json
│   └── chat-thread-management.ts
├── types/
│   ├── chat-thread.ts
│   ├── event-system.ts
│   └── index.ts
└── utils/
    └── error-codes.ts

scripts/
├── api-doc-entry-points.js
├── api-error-operation-aliases.js
├── generate-api-error-docs.mjs
├── generate-typedoc-html.js
└── check-api-doc-comments.js

docs/
├── integration/
│   └── thread.md
└── reference/

demo/
└── src/
    ├── App.tsx
    └── components/
        └── ChatThreadPanel.tsx

tests/
├── contract/
│   └── manager-exports.contract.test.ts
├── unit/
│   ├── rest/
│   │   └── chat-thread-management.test.ts
│   ├── managers/
│   │   ├── chat-thread-manager.test.ts
│   │   └── chat-thread.test.ts
│   ├── chat-client/
│   │   └── chat-thread-events.test.ts
│   └── core/
│       └── message/
│           └── message-receiver-thread.test.ts
├── integration/
│   └── chat-thread/
└── e2e/
    └── api/
```

**Structure Decision**: 保持单仓库 SDK 库结构。`ChatThreadManager` 负责公开 REST 编排和事件 handler 注册；`MessageReceiver` 继续接收 MUC Thread raw notify；`ChatThreadManager.handleRawNotify` 或等价内部 mapper 将 raw notify 归一为 4 个公开事件；`types/chat-thread.ts` 作为公开类型来源；`api-errors.json` 作为错误码结构化来源；API Reference 生成脚本显式纳入 ChatThread manager、entity 和类型文件。

## Phase 0: Research

输出：`specs/046-chat-thread-public-api/research.md`

研究结论：

1. ChatThread 公开能力不是新业务实现，而是从半公开状态补齐公开治理：导出、类型、JSDoc、API Reference、错误码、测试和 demo。
2. 事件模型与移动端对齐，只公开 4 个事件：created、destroyed、updated、userRemoved。
3. 旧 `onChatThreadChange + operation` 不公开也不派发，只作为原工程/服务端 raw notify 参考。
4. 原工程 `threadApi.ts` 是 REST 路径、参数和返回字段归一的对照来源；当前 websdk2 已有大部分 REST 方法，但需要修正文档、类型和错误码。
5. 原工程 `handleMucMsg.ts` 是 Thread MUC 操作来源参考，但 websdk2 只把 create/delete/update/update_msg/kick 等相关来源映射为 4 个移动端事件。
6. API Reference 需要恢复 ChatThread manager/entity/types 的生成入口，并确保 `@internal` raw notify 不出现在公开页面。
7. `api-errors.json` 当前 Thread operation 为空占位，必须补服务端业务错误和 `localErrors`。
8. 集成文档当前存在过期示例，需要与真实公开 API 对齐。

## Phase 1: Design & Contracts

输出：

- `specs/046-chat-thread-public-api/data-model.md`
- `specs/046-chat-thread-public-api/contracts/chat-thread-public-api.openapi.yaml`
- `specs/046-chat-thread-public-api/quickstart.md`

设计要点：

### 1. 公开入口与类型

- 主入口继续导出：
  - `ChatThreadManager`
  - `ChatThread`
  - ChatThread 参数、返回、事件 payload 类型
- 子路径 `./managers/chat-thread` 保持导出：
  - `ChatThreadManager`
  - `ChatThread`
- `src/types/chat-thread.ts` 必须补齐中英双语 JSDoc 和字段注释。
- `GetChatThreadInfoParams` 等散落在 manager 文件里的公开参数类型应统一移动或重导出到 `types/chat-thread.ts`。

### 2. REST API 公开契约

保留当前 websdk2 方法命名：

- `createChatThread`
- `getChatThreadList`
- `getJoinedChatThreadList`
- `getChatThreadInfo`
- `joinChatThread`
- `leaveChatThread`
- `destroyChatThread`
- `updateChatThreadName`
- `getChatThreadMemberList`
- `removeChatThreadMember`
- `getChatThreadLastMessageList`

对照原工程确认：

- `parentId` 对应服务端 `group_id` / `groupId`
- `messageId` 对应服务端 `msg_id` / `msgId`
- `chatThreadId` 对应服务端 `thread_id` / `id`
- `memberId` 对应原工程 `username`，公开侧统一使用 `memberId`
- `pageSize` 默认 20，范围 1-50
- 最后一条消息批量查询最多 20 个 Thread ID

### 3. 事件契约

公开事件只包含：

- `onChatThreadCreated`
- `onChatThreadDestroyed`
- `onChatThreadUpdated`
- `onChatThreadUserRemoved`

事件接收语义：

- `onChatThreadCreated`: 子区所属群组所有成员可收到。
- `onChatThreadDestroyed`: 子区所属群组所有成员可收到。
- `onChatThreadUpdated`: 修改子区名称、添加回复消息、撤销回复消息时触发；子区所属群组所有成员可收到。
- `onChatThreadUserRemoved`: 当前登录用户被群主或群管理员移出子区时触发。

事件实现要求：

- 不公开、不派发 `onChatThreadChange`。
- raw notify 保持内部输入，`ChatThreadRawNotifyEvent` 等类型继续 `@internal` 或移出公开入口。
- `create` 映射为 `onChatThreadCreated`。
- `delete` 映射为 `onChatThreadDestroyed`。
- `update` 与 `update_msg` 映射为 `onChatThreadUpdated`。
- `kick` 或当前用户被移除来源映射为 `onChatThreadUserRemoved`。
- `join`、`leave`、成员加入/退出、多设备 Thread 分支不得额外派发公开 Thread 变更事件。

### 4. 错误码与 API Reference

- 为每个 Thread REST operation 补 `api-errors.json.apis.<operation>.errors`。
- 为每个公开方法需要展示的本地校验补 `localErrors.<publicMethod>`。
- 若公开方法名与 operation 不一致，在 `scripts/api-error-operation-aliases.js` 补 alias。
- `scripts/api-doc-entry-points.js` 纳入：
  - `src/managers/chat-thread-manager.ts`
  - `src/managers/chat-thread/chat-thread.ts`
  - `src/types/chat-thread.ts`
- 生成后的 API Reference 应包含 ChatThread 公开方法的错误码表，且不包含 raw notify 内部类型。

### 5. 文档与 demo

- 修正 `docs/integration/thread.md`：
  - `thread.getDetail()` 改为真实方法，或新增真实公开 alias 后再写文档。
  - `removeChatThreadMember` 参数从 `userId` 改为 `memberId`。
  - 事件示例改为 4 个独立事件。
  - Thread 发消息示例只保留当前 SDK 实际支持的字段/方法。
- 更新 demo Thread 面板事件监听和日志展示，避免展示旧 `onChatThreadChange`。

### 6. 测试与门禁

- Unit:
  - REST 参数校验、路径、body、返回归一、错误包装。
  - ChatThread facade 方法代理。
  - 4 个事件 raw notify 映射。
  - 非公开 Thread 分支不派发。
  - 未注册 ChatThreadManager 不派发公开事件。
  - `api-errors.json` 与 API Reference 入口治理。
- Integration:
  - `ChatClient.use(ChatThreadManager)` 后事件上下文与 raw notify capability 协作。
  - MessageReceiver -> raw notify -> ChatThreadManager -> EventHub 4 事件链路。
- E2E/真实环境:
  - demo 或 API 主路径覆盖创建、查询、加入、退出、重命名、销毁、最后消息查询。
  - 事件可通过模拟、真实服务或可控 fixture 验证；真实环境不足时记录账号/群组/消息前提。

## Agent Context Update

本计划未运行 `.specify/scripts/bash/setup-plan.sh --json`，因为当前分支不是 `046-chat-thread-public-api`，脚本会指向 `001-im-sdk-refactor`。后续若切换到正确 feature 分支，可执行：

```bash
SPECIFY_FEATURE=046-chat-thread-public-api .specify/scripts/bash/update-agent-context.sh codex
```

预期：把 046 的技术栈、移动端对齐 4 个 Thread 事件、错误码/API Reference 门禁补充到 Codex 上下文。

## Phase 2: Task Planning Approach

由 `/speckit.tasks` 继续拆解任务，建议按以下主线生成：

1. 公开类型与导出：收敛 `types/chat-thread.ts`、主入口、`./managers/chat-thread`、manager/entity 返回类型和 JSDoc。
2. REST 契约修正：对照原工程补齐参数校验、返回归一、真实响应 fixture 和 REST 单测。
3. 事件模型迁移：移除公开 `onChatThreadChange` 派发，新增 4 个公开事件类型、handler map、EventHub payload、raw notify mapper 和测试。
4. 错误码治理：补 `api-errors.json` 的 Thread errors/localErrors、alias、错误码生成和治理测试。
5. API Reference：更新 entry points、JSDoc、生成 Markdown/HTML，确保内部 raw notify 隐藏。
6. 文档/demo：修正 `docs/integration/thread.md`、demo 事件监听和 Thread 面板示例。
7. 分层测试与收尾：unit/integration/e2e 或真实环境验证、`docs:api:check`、`errors:check`、`lint`、`type-check`、版本号、CHANGELOG、中文 commit。

## Complexity Tracking

无 Constitution 例外。
