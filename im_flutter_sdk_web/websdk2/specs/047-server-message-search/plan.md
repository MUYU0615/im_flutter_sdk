# 实施方案：服务端消息搜索

**Branch**: `047-server-message-search` | **Date**: 2026-06-15 | **Spec**: [spec.md](/Users/wangmeng/IdeaProjects/easemob-font/WEBSDK2/specs/047-server-message-search/spec.md)
**Input**: Feature specification from `/specs/047-server-message-search/spec.md`

## Summary

从 websdk 迁移服务端消息搜索功能到 websdk2。实现方式是：在 `ChatManager` 新增 `searchMessages()` 公开方法，通过纯 REST 调用 POST 搜索接口，返回规范化的分页搜索结果。

涉及层次：类型定义（`SearchMessagesParams`、`MessageSearchOption`、`SearchMessagesResult`、`SearchResultMessage`）→ Zod 参数校验 → REST 纯函数请求构建 → 错误码映射 → Manager 公开方法。不新增独立 Manager、不改 WebSocket、不做本地缓存。

## Technical Context

**Language/Version**: TypeScript 5.x（strict）
**Primary Dependencies**: 现有 `ChatClient`、`ChatManager`、REST 请求模块、zod 校验器、Vitest
**Storage**: N/A；不涉及本地缓存或持久化
**Testing**: `npm run test:run`、`npm run type-check`
**Target Platform**: Web SDK 主库 REST 层 + ChatManager 公开 API
**Project Type**: 单仓库 SDK 库项目（`src/`、`tests/`、`specs/`）
**Performance Goals**: 纯 REST 请求，无额外序列化或异步流程开销
**Constraints**:
- 纯 REST 能力，不涉及 WebSocket
- 归属 `ChatManager`，不新增独立 Manager
- 不做搜索结果本地缓存
- 不支持 `audio`/`cmd` 类型搜索（服务端限制）
- 需 Console 开通 "Message Search" 服务

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- [x] **性能优先**: 纯 REST 单次请求，无额外网络请求或后台任务。
- [x] **类型安全**: 全链路使用显式类型，Zod 运行时校验保障入参合法。
- [x] **测试驱动**: 校验、请求构建、响应规范化均有独立单测覆盖。
- [x] **可靠性**: 错误码映射覆盖服务端异常，不影响既有 ChatManager 方法。
- [x] **可扩展性**: 类型通过 `src/types/` 统一导出，后续扩展搜索条件无侵入。
- [x] **可观测性**: 错误走统一错误映射体系，不引入隐式行为。
- [x] **版本管理**: 实现阶段需按仓库规则补验证、版本号与 CHANGELOG。

## Project Structure

### Documentation (this feature)

```text
specs/047-server-message-search/
├── spec.md
└── plan.md
```

### Source Code (affected paths)

```text
src/
├── types/
│   ├── index.ts              # 导出新类型
│   └── chat-manager.ts       # SearchMessagesParams, MessageSearchOption, SearchMessagesResult, SearchResultMessage
├── validators/
│   └── search-messages.ts    # Zod 校验 schema
├── rest/
│   ├── chat-management.ts    # requestSearchMessages() 纯函数
│   └── error-maps/
│       └── ...               # searchMessages 错误码映射
└── managers/
    └── chat-manager.ts       # searchMessages() 公开方法

tests/
├── unit/
│   ├── rest/
│   │   └── search-messages.test.ts
│   └── validators/
│       └── search-messages.test.ts
└── integration/
    └── chat-manager/
        └── search-messages.integration.test.ts
```

## Phase 0: Research

本特性范围收敛，不需要单独 `research.md`。关键澄清点已在 spec 中固化：

1. 单关键词用 `keyword` 字段，多关键词用 `keywords` + `keywordMatch`
2. 服务端响应消息数组字段可能是 `items` 或 `list`，需兼容
3. 分页信息可能在 `pagination` 子对象或响应顶层
4. `highlight` 为 `Record<string, string[]>`，需扁平化为 `string[]`
5. 消息类型双向映射：`txt↔text`、`img↔image`、`loc↔location`
6. 不支持 `audio`/`cmd` 类型

## Phase 1: Design & Contracts

### 1. 类型层

在 `src/types/chat-manager.ts` 中新增：

- `MessageSearchConversationType`: 会话类型字面量 `'singleChat' | 'groupChat' | 'chatRoom'`
- `MessageSearchOption`: 搜索条件（`keywordList`、`keywordListMatchType`、`conversationId`、`conversationType`、`msgTypes`、`startTime`、`endTime`、`searchScope`、`direction`）
- `SearchMessagesParams`: 顶层入参（`option: MessageSearchOption`、`pageNum?: number`、`pageSize?: number`）
- `SearchResultMessage`: Message 子集 + `conversationId?: string`、`highlight?: ReadonlyArray<string>`、`text?: string`
- `SearchMessagesResult`: `messages: SearchResultMessage[]`、`pageNum`、`pageSize`、`totalPages`、`isLast`

在 `src/types/index.ts` 中统一导出以上类型。

### 2. 校验层

在 `src/validators/search-messages.ts` 中用 Zod 实现 `searchMessagesSchema`：

- `keywordList`: 非空数组，最多 5 个，每项 trim 后 1-512 字符
- `keywordListMatchType`: optional enum `'or' | 'and'`
- `conversationId`/`conversationType`: 须同时提供或都不提供；`conversationType` 须为 `'singleChat' | 'groupChat' | 'chatRoom'` 之一
- `msgTypes`: optional，不允许含 `'audio'` / `'cmd'`
- `startTime`/`endTime`: 须同时提供或都不提供；同时提供时 `endTime >= startTime`
- `pageNum`: >= 1，默认 1
- `pageSize`: 1-100，默认 20

### 3. REST 层

在 `src/rest/chat-management.ts` 中新增 `requestSearchMessages()` 纯函数：

- POST `/{orgName}/{appName}/users/{userId}/messages/search/get`
- 请求体构建逻辑：
  - 单关键词（trim 过滤后仅 1 个）→ `keyword: string`
  - 多关键词 → `keywords: string[]` + `keywordMatch`: `or→'any'`、`and→'all'`
  - 会话过滤：根据 `conversationType` 映射 → `singleChat` 使用 `participantPairs: [{ userId1: currentUserId, userId2: conversationId }]`；`groupChat` 使用 `groupIds: [conversationId]`；`chatRoom` 使用 `chatroomIds: [conversationId]`
  - `contentType`: `msgTypes` 映射后逗号拼接（`txt→text`、`img→image`、`loc→location`、其余同名）
  - `sort`: `up→'sentTime:asc'`、`down→'sentTime:desc'`
  - `searchExt`: 透传 `searchScope`
  - `highlightEnable: true`（固定）
  - `page`: pageNum、`size`: pageSize

### 4. 响应规范化

- 消息列表：优先取 `items`，fallback `list`
- 分页：优先取 `pagination` 子对象，fallback 顶层字段
- `isLast`: `isFinished === 1` → `true`
- `highlight`: `Record<string, string[]>` → `Object.values().flat()` 扁平化
- 消息类型反向映射：`text→txt`、`image→img`、`location→loc`

### 5. 错误映射

在 `src/rest/error-maps/` 中为 `searchMessages` 操作添加错误码映射，覆盖服务端常见错误（未开通服务、参数非法等）。

### 6. Manager 层

在 `src/managers/chat-manager.ts` 的 `ChatManager` 中新增：

```typescript
async searchMessages(params: SearchMessagesParams): Promise<SearchMessagesResult>
```

流程：校验 → 构建请求 → 发起 REST 调用 → 规范化响应 → 返回。

## Post-Design Constitution Check

- [x] **性能优先**: 纯 REST 单次请求，请求体构建为同步 O(n) 映射
- [x] **类型安全**: 入参 Zod 校验 + 出参显式类型，无 `any`
- [x] **测试驱动**: 校验、请求构建、响应规范化各自独立可测
- [x] **可靠性**: 错误映射覆盖服务端异常，兼容 `items`/`list` 双字段
- [x] **可扩展性**: 类型统一导出，后续扩展搜索条件仅需修改类型和校验
- [x] **可观测性**: 错误走统一映射，不新增隐式行为
- [x] **版本管理**: 实现阶段需按仓库规则补验证、版本号、CHANGELOG 与中文 commit

## Phase 2: Task Planning Input

后续 `tasks.md` 至少拆成以下工作组：

1. 类型定义：`MessageSearchConversationType`、`SearchMessagesParams`、`MessageSearchOption`、`SearchMessagesResult`、`SearchResultMessage` 及导出
2. Zod 校验：`search-messages.ts` schema 实现（含 conversationId/conversationType 配对校验）
3. REST 纯函数：`requestSearchMessages()` 请求体构建 + 响应规范化
4. 错误映射：`searchMessages` 操作错误码
5. Manager 接入：`ChatManager.searchMessages()` 公开方法
6. 单元测试：校验、请求构建、响应规范化、类型映射、highlight 扁平化
7. 集成测试：ChatManager 入口到 REST 请求完整链路
8. 收尾验证：`type-check`、`test:run`、版本号、CHANGELOG

## Complexity Tracking

无 Constitution 例外。复杂度中等，主要风险：

- 请求体单/多关键词分支逻辑
- `conversationType` 到 `participantPairs`/`groupIds`/`chatroomIds` 的映射（需要 `currentUserId` 参与 singleChat 场景）
- 响应 `items`/`list` + `pagination` 子对象/顶层字段兼容
- 消息类型双向映射一致性
- `highlight` 扁平化边界（空对象、嵌套空数组）

这些风险通过请求构建和响应规范化的独立单元测试覆盖控制。
