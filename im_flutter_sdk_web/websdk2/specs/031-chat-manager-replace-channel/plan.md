# 实施方案：ChatManager 替换 ChannelManager 并补齐消息域能力

**Branch**: `031-chat-manager-replace-channel` | **Date**: 2026-04-28 | **Spec**: [spec.md](/Users/zhangdong/code/websdk2/specs/031-chat-manager-replace-channel/spec.md)  
**Input**: Feature specification from `/specs/031-chat-manager-replace-channel/spec.md`

## Summary

031 不再只是一次“把 `ChannelManager` 改名为 `ChatManager`”的受控迁移，而是把 `ChatManager` 扩展成新的消息域主门面；创建消息入口收敛到 `ChatManager.createXMessage`，`ChatClient` 不再公开创建消息方法，发送链路继续复用 `ChatClient.sendMessage` 基线。方案分为五条并行主线：

1. 完成 `ChannelManager/Channel` 的公开移除与 `ChatManager` 入口收口；
2. 在 `ChatManager` 上补齐发送后动作：会话已读、消息已读、群消息已读、撤回、编辑；
3. 在 `ChatManager` 上补齐消息查询与内容能力：历史消息、附件下载、合并消息下载解析、历史删除；
4. 在 `ChatManager` 上补齐消息互动能力：群消息已读查询、Reaction、消息置顶；
5. 在 `ChatManager` 上补齐消息域辅助能力与事件面：举报、翻译、扩展事件回调。
6. 参考移动端错误矩阵补齐 Web SDK 的 ChatManager 领域错误码、错误分类和重试/降级策略。

整个实现必须保持“对外返回业务对象、失败抛出 SDKError、事件继续走 `addEventHandler/removeEventHandler`、不直接泄露服务端 DTO”这四条公开边界。

## Technical Context

**Language/Version**: TypeScript 5.x（strict）  
**Primary Dependencies**: 现有 `ChatClient`、Manager 注册体系、`EventHub`、消息创建模块、消息发送/接收链路、`RestClient`、现有合并消息下载解析器、Vitest、Vite、Playwright  
**Storage**: 不新增持久化；继续沿用现有消息、上传、缓存与合并消息链路；公开消息定位以 `conversationId/conversationType` 为准
**Testing**: `npm run test:run`、`npm run test:gate:pr`、`npm run test:e2e`、`npm run lint`、`npm run type-check`  
**Target Platform**: Web SDK 主库 + 浏览器 demo  
**Project Type**: 单仓库 SDK 库项目（`src/`、`tests/`、`demo/`）  
**Performance Goals**: 不为消息动作引入额外会话对象创建或冗余网络往返；历史消息与下载链路复用现有能力，不造成明显性能回退  
**Constraints**:
- `ChannelManager` / `Channel` 为显式 breaking change，不保留兼容层
- 必须保留 `ChatClient.sendMessage` 发送能力；消息创建入口必须通过 `ChatManager.createXMessage` 对外暴露
- 继续使用 `addEventHandler/removeEventHandler`，不新增 `addMessageListener`
- 公开命名遵循仓库 Constitution：读取类优先 `getXxx`，删除类优先 `removeXxx`
- 公开返回禁止透传服务端 `code/data/message`
- 可借鉴 032 的内部包装思路，但对外仍以 plain data 为主
**Scale/Scope**: 涉及 manager 入口、公开类型、事件系统、REST 映射、消息下载链路、demo、文档与测试门禁的系统性扩展

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

预检结果：

- [x] **性能优先**: 发送、已读、撤回、编辑与下载能力优先复用既有链路，不新增多余对象生命周期
- [x] **类型安全**: 新增 `ChatManager` 方法、事件和业务对象都必须保持 strict typing，禁止 `any`
- [x] **测试驱动**: spec 已明确要求单元、集成和 E2E 三层测试
- [x] **可靠性**: 所有公开动作都要求参数校验、错误归一化和超时/下载失败处理
- [x] **可扩展性**: 以 `ChatManager` 收拢消息域边界，为后续 conversation 能力或内部对象化预留清晰演进点
- [x] **可观测性**: 事件扩展、下载失败和消息动作错误必须可通过现有日志与测试观测
- [x] **版本管理**: 属于公开 API 扩展与 breaking change 收口，完成实现后必须更新版本号、`CHANGELOG.md` 和中文 commit

设计复检预期：通过。当前 spec 已明确新增方法范围、命名收口、错误边界和事件入口约束。

## Project Structure

### Documentation (this feature)

```text
specs/031-chat-manager-replace-channel/
├── spec.md
├── plan.md
├── tasks.md
├── checklists/
│   └── requirements.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    └── chat-manager-api.md
```

### Source Code (repository root)

```text
src/
├── chat-client.ts
├── index.ts
├── managers/
│   ├── chat-manager.ts
│   ├── chat/
│   │   └── index.ts
│   ├── channel-manager.ts
│   ├── Channel.ts
│   └── channel/
│       └── index.ts
├── types/
│   ├── channel.ts
│   ├── event-system.ts
│   └── index.ts
├── rest/
└── core/
    ├── index.ts
    └── message/
        ├── combine-message-downloader.ts
        ├── message-receiver.ts
        ├── message-sender.ts
        └── stream-message-handler.ts

tests/
├── contract/
├── integration/
│   ├── mock/
│   └── chat-manager/
├── types/
├── unit/
│   ├── chat-client/
│   ├── managers/
│   └── core/
└── e2e/

demo/
└── src/
```

**Structure Decision**: 保持单仓库单项目结构，在既有 `chat-client / managers / rest / core / types / demo / tests` 路径内增量扩展 `ChatManager`，不另建 conversation/translation/reaction manager。

## Phase 0: Research

输出：

- `specs/031-chat-manager-replace-channel/research.md`

研究与确认项：

1. 建立旧工程能力到新 SDK 方法的映射表，明确：
   - 哪些能力走 WebSocket ack / mSync
   - 哪些能力走现有 RESTClient
   - 哪些能力已在当前仓库存在可复用实现，如合并消息下载解析
2. 明确公开命名和参数模型，确认：
   - 使用 `ConversationLocator` / `Message` / 业务动作参数，而不是旧 `queue` / `isGroup` / 原始 REST chat type
   - `addMessageListener` 需求收敛到 `addEventHandler/removeEventHandler`
3. 明确消息域业务对象边界，整理：
   - 历史消息分页
   - 附件下载结果
   - 群消息已读结果
   - Reaction 摘要/明细
   - 置顶消息分页
   - 翻译语言与翻译结果
4. 明确错误映射来源，确认：
   - 参数校验错误
   - 权限/不可编辑/不可撤回错误
   - 下载/解析失败错误
   - 不支持的消息类型或错误会话类型
5. 明确移动端 silent-fail / bool false API 在 Web SDK 的语义收口，确认：
   - 哪些场景视为幂等成功
   - 哪些场景必须抛显式错误
   - 哪些缺失错误码需要在 `src/utils/error-codes.ts` 新增

## Phase 1: Design & Contracts

输出：

- `specs/031-chat-manager-replace-channel/data-model.md`
- `specs/031-chat-manager-replace-channel/contracts/chat-manager-api.md`
- `specs/031-chat-manager-replace-channel/quickstart.md`

设计要点：

### 1. 公开入口与破坏性迁移收口

- `ChatManager` 继续作为唯一公开消息 manager
- `ChatManager.key = 'chatManager'`
- 主入口与子路径导出统一切到 `ChatManager`
- 移除 `ChannelManager`、`Channel`、`./managers/channel`

### 2. 发送后动作能力编排

- 在 `ChatManager` 上新增：
  - `markConversationRead`
  - `sendMessageReadAck`
  - `sendGroupMessageReadAck`
  - `recallMessage`
  - `updateMessage`
- 这些方法只做参数校验、错误归一化和消息域编排，底层尽量复用现有发送/ack 链路

### 3. 查询、下载与删除能力编排

- 在 `ChatManager` 上新增：
  - `getHistoryMessages`
  - `downloadMessageAttachment`
  - `downloadAndParseCombineMessage`
  - `removeHistoryMessages`
- 历史消息返回统一分页业务对象
- 附件下载和合并消息解析不得直接暴露底层响应结构

### 4. 消息互动状态能力编排

- 在 `ChatManager` 上新增：
  - `getGroupMessageReadUsers`
  - `addReaction`
  - `removeReaction`
  - `getReactionList`
  - `getReactionDetail`
  - `pinMessage`
  - `unpinMessage`
  - `getPinnedMessages`
- 对外统一输出 plain data 业务对象

### 5. 翻译、举报与事件扩展

- 在 `ChatManager` 上新增：
  - `getSupportedTranslationLanguages`
  - `translateMessage`
- 事件系统扩展新增消息域 action callbacks，但继续沿用 `addEventHandler/removeEventHandler`

### 6. 业务对象与类型面补齐

- 在 `src/types/` 补充消息域业务对象：
  - `ConversationLocator`
  - `MessageHistoryPage`
  - `MessageAttachmentDownloadResult`
  - `GroupMessageReadUsersResult`
  - `MessageReactionSummary`
  - `MessageReactionDetailPage`
  - `PinnedMessage`
  - `TranslationLanguage`
  - `MessageTranslationResult`
- `ChatEventHandlerMap` 扩展新增消息域动作事件

### 7. 错误码与错误处理收口

- 以 `docs/reference/chat-manager-api-error-codes.md` 为参考，建立 ChatManager 领域错误矩阵
- 在 `src/utils/error-codes.ts` 补齐缺失的 ChatManager 领域错误码
- 明确各 API 的错误分类：
  - 参数错误 -> `ValidationError`
  - 登录/401 -> `AuthenticationError`
  - MSync/连接失败 -> `ConnectionError`
  - 传输失败 -> `NetworkError` / `RestTransportError`
  - 服务端业务错误 -> `SDKError` / `RestBusinessError`
- 把移动端的 silent false 场景改为 Web SDK 的显式错误或幂等成功

### 8. Demo 与文档迁移

- demo 继续以 `ChatManager` 为唯一消息主入口
- quickstart 至少覆盖：
  - 注册 `ChatManager`
  - 发送消息
  - 历史消息查询
  - 一条消息动作示例
  - 一条辅助能力示例（如 Reaction 或翻译）
- 补充 breaking change 与命名映射说明
- 补充错误码参考文档与 API 文档的错误说明一致性

## Agent Context Update

执行命令：

```bash
SPECIFY_FEATURE=031-chat-manager-replace-channel .specify/scripts/bash/update-agent-context.sh codex
```

预期：将 031 当前的公开 API 范围、命名映射、消息域业务对象和 breaking change 影响面同步到 agent context。

## Phase 2: Task Planning Approach

由 `/speckit.tasks` 继续拆解任务，按以下主线生成：

1. 清理 `ChannelManager/Channel` 公开出口，收口 `ChatManager` 导出与注册
2. 实现发送后动作能力：会话已读、消息已读、群消息已读、撤回、编辑
3. 实现查询下载能力：历史消息、附件下载、合并消息解析、历史删除
4. 实现互动状态能力：群消息已读查询、Reaction、消息置顶
5. 实现辅助能力与事件扩展：举报、翻译、消息域 action 事件
6. 补齐错误码、错误映射、类型测试、集成测试、E2E、文档、版本号与 `CHANGELOG.md`

## Complexity Tracking

无额外豁免项。
