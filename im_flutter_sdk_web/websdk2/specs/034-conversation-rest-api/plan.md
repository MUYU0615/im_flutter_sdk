# 实施方案：会话相关 REST API 收敛（Conversation / Silent Mode / ChatThread）

**Branch**: `034-conversation-rest-api` | **Date**: 2026-04-28 | **Spec**: `specs/034-conversation-rest-api/spec.md`  
**Input**: Feature specification from `/specs/034-conversation-rest-api/spec.md`

## Summary

本特性承接 `031-chat-manager-replace-channel` 的后续阶段，在不回滚其 Phase 1 边界的前提下，补齐旧 `websdk` 中会话相关 REST 能力的三条主线：

1. 会话主线 REST 统一收敛到 `ChatManager`，并把会话列表、置顶、删除、标记、消息置顶能力从旧 `src/apis/index.ts` 的混装实现迁入新的 conversation 领域模块；
2. 会话免打扰继续归属 `PushManager`，不迁入 `ChatManager`，仅在 034 中补齐其在整体会话域迁移图谱中的位置；
3. thread 作为独立资源域新增 `ChatThreadManager` 与 `ChatThread`，以 manager + typed event 的形式承接旧 `threadApi.ts` 与相关通知。

本期同时包含一个明确的 schema 升级目标：conversation cache 必须从当前 `single/group/room` 升级到对外 canonical naming `singleChat/groupChat/chatRoom`，并补充旧数据兼容迁移。会话 mutation 同步策略继续对齐旧 `websdk`：mutation 成功后默认只返回标准化 REST 结果，不立即 patch 当前会话列表；默认一致性机制由调用方在需要时复用 `getConversationList()` 主动刷新，notify 与消息驱动更新作为补充来源。

## Technical Context

**Language/Version**: TypeScript 5.x（strict）  
**Primary Dependencies**: 现有 `ChatClient`、Manager 注册体系、`CacheManager`、`EventHub`、`RestClient`、`PushManager`、MSync protobuf 编解码链路、Vitest、Vite、Playwright  
**Storage**: 继续复用 localStorage conversation cache；本期升级会话缓存 schema、会话类型 canonical naming 与增量字段（`marks` / 扩展 `source` 语义）  
**Testing**: `npm run test:run`、`npm run lint`、`npm run type-check`、`npm run test:gate:pr`、必要时 `npm run test:e2e`  
**Target Platform**: Web SDK 主库 + 浏览器 demo  
**Project Type**: 单仓库 SDK 库项目（`src/`、`tests/`、`demo/`）  
**Performance Goals**: 不在登录后会话同步、消息接收或 notify 分发主链路引入明显额外阻塞；会话 mutation 不做隐式全量刷新；thread / conversation normalize 保持 fail-fast 且最小必要字段转换  
**Constraints**:
- 034 是 `031` 的后续补齐，不重新引入 `ChannelManager` / `Channel`
- 对外会话类型固定为 `singleChat/groupChat/chatRoom`
- ChatManager 会话类 mutation / message pin 入参中的会话类型字段统一命名为 `conversationType`，避免与消息 `conversationType`、返回对象 `conversationType` 混用
- conversation cache schema 升级是本期范围内目标，不可推迟到后续 feature
- `PushManager` 继续拥有 conversation silent mode
- `ChatThreadManager` 为独立 manager，不混入 `ChatManager`
- `ChatThreadManager` 对外使用专属 handler map，但 thread 事件仍进入全局 typed event system
- conversation mutation 成功后不默认 patch 当前会话列表；默认由调用方主动复用 `getConversationList()` 刷新
- 所有 REST 映射与字段归一化必须基于旧工程真实样例或等价 fixture，不能靠猜测固化
**Scale/Scope**: 涉及 `ChatManager`、新增 `ChatThreadManager`、会话缓存、会话同步链路、事件系统、REST 模块、错误映射、demo 主路径、文档与 unit/integration/e2e/contract/types 测试的系统性补齐

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

预检结果：

- [x] **性能优先**: 延续旧 `websdk` mutation 仅返回结果、不立即 patch 列表的策略，避免每次会话操作都触发额外内部同步；登录后同步和 notify/message patch 继续走异步非阻塞链路
- [x] **类型安全**: 对外 conversation/thread DTO、事件 payload、manager handler map 与 cache schema 升级均采用 strict typing，不保留旧弱类型主语义
- [x] **测试驱动**: spec 已显式要求 unit / integration / e2e 三层测试；本计划补 contract、data model、quickstart 以支撑后续任务拆解
- [x] **可靠性**: 继续复用 `RestClient` 错误模型、结构化日志与登录后会话同步机制；cache migration 必须声明失败降级路径
- [x] **可扩展性**: conversation、thread、push 三域职责明确，后续可继续演进 unread、conversation preference 或 thread 更细粒度事件，而不破坏当前入口
- [x] **可观测性**: 会话同步、notify 归一化、thread 事件映射、cache migration 与 mutation 返回路径都可接入现有结构化日志
- [x] **版本管理**: 本期含明确 breaking change 与缓存 schema 变更；实现阶段必须补版本号、`CHANGELOG.md` 与迁移说明

Phase 1 设计复检预期：通过。当前 spec 已对 manager 归属、canonical naming、cache 升级、thread handler map 和 mutation 一致性策略完成澄清。

## Project Structure

### Documentation (this feature)

```text
specs/034-conversation-rest-api/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/
│   └── requirements.md
├── contracts/
│   ├── README.md
│   └── conversation-rest-api.openapi.yaml
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── chat-client.ts
├── index.ts
├── apis/
│   └── index.ts
├── cache/
│   ├── cache-manager.ts
│   ├── cache-types.ts
│   └── conversation-cache.ts
├── managers/
│   ├── chat-manager.ts
│   ├── push-manager.ts
│   ├── chat/
│   │   └── index.ts
│   └── push/
│       └── index.ts
├── rest/
│   ├── api-errors.json
│   ├── client.ts
│   └── errors.ts
└── types/
    ├── event-system.ts
    ├── push.ts
    └── index.ts

tests/
├── unit/
│   ├── apis/
│   ├── cache/
│   ├── managers/
│   └── protocol/
├── integration/
│   ├── mock/
│   └── cache/
├── contract/
├── types/
└── e2e/

demo/
├── src/App.tsx
├── src/components/ConversationPanel.tsx
└── src/components/PushPanel.tsx
```

**Structure Decision**: 保持单仓库单项目结构。034 不新建独立子工程，而是在现有 `chat-client / managers / cache / rest / types / demo / tests` 路径内增量补齐。实现层建议新增 `conversation` 与 `chat-thread` 领域模块，分别承接 REST 适配、归一化、repository/service 与事件映射逻辑；`ChatManager` 与 `ChatThreadManager` 继续只做公开编排与参数校验入口。

## Phase 0: Research

输出：

- `specs/034-conversation-rest-api/research.md`

研究与确认项：

1. 固化旧 `websdk` conversation mutation 一致性策略在 034 中的继承方式：
   - mutation 成功仅返回标准化 REST 结果
   - 不立即 patch 当前会话列表
   - 默认由调用方复用 `getConversationList()` 主动刷新
2. 固化 conversation cache schema 升级方案：
   - `single/group/room` -> `singleChat/groupChat/chatRoom`
   - `marks` 字段落盘策略
   - `ConversationUpdatePayload.source` 扩展后的兼容策略
   - 迁移触发时机、失败降级与测试范围
3. 固化 conversation REST 模块边界：
   - 从 `src/apis/index.ts` 中迁出的接口范围
   - 与 `ChatClient.login()` 的同步链路接口形态
   - operation name 与错误映射登记策略
4. 固化 thread 域建模方式：
   - `ChatThreadManager + ChatThread` 的边界
   - 专属 thread handler map 与全局 typed event system 的并存方式
   - thread last-message / detail / member 的标准化范围
5. 固化真实样例 / fixture 策略：
   - 旧 `websdk` 中已存在的请求/响应来源
   - 当前仓库 contract / integration / unit 测试中需要补的等价 fixture
   - 缺样例时哪些字段只能保持最小公开承诺

## Phase 1: Design & Contracts

输出：

- `specs/034-conversation-rest-api/data-model.md`
- `specs/034-conversation-rest-api/contracts/conversation-rest-api.openapi.yaml`
- `specs/034-conversation-rest-api/quickstart.md`

设计要点：

### 1. Conversation 主线收敛

- 在 `ChatManager` 上新增 conversation 主线公开入口：
  - `getConversationList`
  - `getPinnedConversationList`
  - `deleteConversation`
  - `setConversationPinned`
  - `addConversationMark`
  - `removeConversationMark`
  - `getConversationListByMark`
  - `clearAllMessagesAndConversations`
  - `pinMessage`
  - `unpinMessage`
  - `getPinnedMessageList`
- `ChatManager` 继续只承担参数校验、公开入口编排与事件注册；复杂逻辑下沉到 conversation 领域模块与 `ChatClient` 同步链路
- `deleteConversation`、`setConversationPinned`、`addConversationMark`、`removeConversationMark`、`pinMessage`、`unpinMessage`、`getPinnedMessageList` 的公开入参必须使用 `conversationType` 表达会话类型；REST 模块内部再映射为服务端 `conversationType`
- `addConversationMark`、`removeConversationMark` 的公开入参必须支持 `conversations` 批量目标数组；`addConversationMark`、`removeConversationMark` 与 `getConversationListByMark` 的 `mark` 入参必须使用 `ConversationMark`（`0 | ... | 19`）和 `CONVERSATION_MARK` 常量表达，REST 模块内部再映射为服务端 `mark_0` 到 `mark_19`

### 2. Conversation cache 与同步链路升级

- 升级 `src/cache/cache-types.ts` 中的 conversation public/cache canonical naming
- 扩展 `ConversationItem` 与 `ConversationUpdatePayload.source`
- 在 `ConversationCache` / `CacheManager` 中补 schema migration 与向前兼容读取
- `ChatClient.login()` 后的 “load cache -> sync server” 继续保留，但 `source` 从当前 `cache/server` 收敛为 `cache/serverSync`
- 新消息与 notify 补丁分别进入 `message/notify` 事件来源；`localMutation` 仅作为可选来源保留给后续扩展，不要求本期默认使用

### 3. Message pin 与 conversation notify 事件收敛

- 在 `src/types/event-system.ts` 中新增 `onPinnedMessageChanged`
- 会话 mutation 相关旧多端事件不再直接公开 `onMultiDeviceEvent`
- message pin notify 在 normalize 后统一产出 `PinnedMessageChangedEventPayload`
- conversation notify 继续归并到 `onConversationListUpdate`，不把原始 `operation` 暴露给调用方

### 4. ChatThreadManager + ChatThread

- 新增 `ChatThreadManager` 作为独立 manager，公开：
  - `createChatThread`
  - `getJoinedChatThreadList`
  - `getChatThreadList`
  - `getChatThreadLastMessageList`
  - `getChatThread(chatThreadId)`
- 新增轻量 `ChatThread` façade，公开：
  - `getInfo`
  - `join`
  - `leave`
  - `destroy`
  - `updateName`
  - `getMemberList`
  - `removeMember`
- thread 事件使用专属 `ChatThreadEventHandlerMap` 对外暴露，但对应 payload 类型同时进入全局 `EventPayloadMap`

### 5. PushManager 边界保持不变

- 034 不迁移 `PushManager` 的 conversation silent mode 所有权
- contract 与 quickstart 明确：
  - conversation 主线动作走 `chatManager`
  - silent mode 走 `pushManager`
  - thread 走 `chatThreadManager`
- 不为 conversation silent mode 新增公开事件

### 6. REST 模块与错误映射

- conversation 主线从 `src/apis/index.ts` 中逐步迁入独立 `src/rest/conversation-management.ts` 与对应 normalize/helper 模块
- thread 新增 `src/rest/chat-thread-management.ts`
- 所有新增 operation 必须进入 `src/rest/api-errors.json`
- contract 必须标明哪些 path 是 SDK-facing 逻辑契约，哪些是旧 upstream 参考 path

### 7. Demo 与测试主路径

- demo 会话面板显式区分：
  - 事件驱动刷新（`cache/serverSync/message/notify`）
  - 操作后主动刷新（复用 `getConversationList()`）
- 若新增 thread 面板，则通过 `chatThreadManager` 完成 thread CRUD 与事件展示
- 测试层至少覆盖：
  - unit：normalize / validation / event mapping / cache migration
  - integration：login sync、message/notify patch、mutation 后主动刷新、thread manager 协作
  - e2e：会话列表、会话操作、push panel、thread 主路径

## Agent Context Update

执行命令：

```bash
SPECIFY_FEATURE=034-conversation-rest-api .specify/scripts/bash/update-agent-context.sh codex
```

预期：将 034 的 canonical naming、conversation cache 升级范围、旧 `websdk` mutation 一致性策略、`ChatThreadManager` 引入与三域入口分工同步到 agent context，避免后续任务或实现继续沿用旧 `single/group/room` 与 connection 风格心智。

## Phase 2: Task Planning Approach

由 `/speckit.tasks` 继续拆解任务，按以下主线生成：

1. 新增 conversation/thread 公开类型、事件类型与导出面
2. 落 conversation REST 模块与 normalize/helper，替换 `src/apis/index.ts` 的长期职责
3. 升级 conversation cache schema、cache migration 与会话同步载荷
4. 在 `ChatManager` 补齐 conversation 主线公开面，并接入统一错误映射
5. 新增 `ChatThreadManager` / `ChatThread` / thread event mapper / thread REST 模块
6. 改造 `ChatClient` 会话同步、message patch、notify patch 与 event dispatch
7. 更新 demo、文档与 quickstart，明确 mutation 后默认主动刷新
8. 补 unit / integration / contract / types / e2e 测试，最后再做版本号、`CHANGELOG.md` 与中文 commit

## Complexity Tracking

无额外豁免项。
