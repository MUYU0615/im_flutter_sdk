---
description: '031 ChatManager 消息域能力扩展任务清单'
---

# Tasks: ChatManager 替换 ChannelManager 并补齐消息域能力

**Input**: 设计文档来自 `/specs/031-chat-manager-replace-channel/`  
**Prerequisites**: plan.md（必需）、spec.md（必需）；`research.md`、`data-model.md`、`contracts/`、`quickstart.md` 需与本任务保持同步  
**Tests**: 需要，包含单元测试、集成测试与浏览器 E2E；若某个故事不新增某层测试，必须在本文件中显式记录复用依据  
**Organization**: 任务按用户故事分组，支持独立实现与独立验证

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行（不同文件、无前置依赖）
- **[Story]**: 仅用户故事阶段使用（`[US1]...[US4]`）
- 每个任务描述都包含明确文件路径

## Phase 1: Setup（共享准备）

**Purpose**: 先把 031 文档与测试入口切换到新的消息域范围

- [x] T001 同步 031 设计文档到新范围 `specs/031-chat-manager-replace-channel/spec.md`、`plan.md`、`research.md`、`data-model.md`、`contracts/chat-manager-api.md`、`quickstart.md`
- [x] T002 [P] 建立/整理 ChatManager 扩展能力的测试骨架 `tests/unit/managers/chat-manager.test.ts`、`tests/types/chat-manager-events.d.ts`、`tests/integration/chat-manager/`、`tests/e2e/message-actions.spec.ts`

---

## Phase 2: Foundational（阻塞基础）

**Purpose**: 建立所有用户故事共享的公开类型、错误边界与内部编排入口

**⚠️ CRITICAL**: 此阶段完成前不得进入任何用户故事实现

- [x] T003 在 `src/managers/chat-manager.ts` 预留新的消息域方法签名与统一绑定校验
- [x] T004 [P] 扩展消息域公开类型、错误码引用面与业务对象 `src/types/index.ts`、`src/types/event-system.ts`
- [x] T005 [P] 梳理并保留 `Message.channel` 所需最小引用模型 `src/types/channel.ts`
- [x] T006 [P] 建立消息域 REST / internal service 编排入口，并预留统一错误映射点 `src/rest/`、`src/managers/chat/` 或等价内部模块
- [x] T007 [P] 更新 manager 导出契约与子路径入口 `src/index.ts`、`src/managers/chat/index.ts`、`package.json`、`vite.config.ts`

**Checkpoint**: `ChatManager` 已具备扩展能力的类型面、导出面和内部编排骨架

---

## Phase 3: User Story 1 - 发送后控制动作（Priority: P1） 🎯 MVP

**Goal**: 在 `ChatManager` 上补齐会话已读、消息已读、群消息已读、撤回与编辑能力

**Independent Test**: 发送一条消息后，分别调用 `markConversationRead`、`sendMessageReadAck`、`sendGroupMessageReadAck`、`recallMessage`、`updateMessage`，验证返回值和事件语义正确

### Tests for User Story 1

- [x] T008 [P] [US1] 为 read/recall/update 参数校验与错误映射补单测 `tests/unit/managers/chat-manager.test.ts`
- [x] T009 [P] [US1] 为新增消息域 action 事件补类型测试 `tests/types/chat-manager-events.d.ts`
- [x] T010 [P] [US1] 为 read ack、recall、update 的 manager 编排补集成测试 `tests/integration/chat-manager/message-actions.integration.test.ts`
- [x] T011 [US1] 评估并补一条浏览器消息动作 E2E `tests/e2e/message-actions.spec.ts`

### Implementation for User Story 1

- [x] T012 [US1] 在 `src/managers/chat-manager.ts` 实现 `markConversationRead`、`sendMessageReadAck`、`sendGroupMessageReadAck`
- [x] T013 [P] [US1] 在 `src/managers/chat-manager.ts` 实现 `recallMessage`、`updateMessage`
- [x] T014 [P] [US1] 在消息发送/协议编排层补齐 read ack、撤回、编辑所需内部协作 `src/chat-client.ts`、`src/core/message/`、`src/core/index.ts`
- [x] T015 [P] [US1] 为新增 action 定义业务对象、silent-fail 收口和错误码映射 `src/types/index.ts`、`src/utils/error-codes.ts`、`src/utils/errors.ts`

**Checkpoint**: US1 完成后，`ChatManager` 可以覆盖主要发送后动作闭环

### Follow-up：撤回消息参数收敛（2026-05-18）

- [x] T053 [US1] 移除 `RecallMessageParams` 中未参与协议发送的 `message` 参数
- [x] T054 [P] [US1] 删除 `recallMessage` 的 message 本地前置校验路径，并更新集成测试与 API 文档

---

## Phase 4: User Story 2 - 历史消息、下载与删除（Priority: P1）

**Goal**: 在 `ChatManager` 上补齐历史消息、附件下载、合并消息下载解析与历史删除能力

**Independent Test**: 通过 `getHistoryMessages` 取回标准化消息分页，对附件消息和合并消息完成下载，再执行 `removeHistoryMessages`

### Tests for User Story 2

- [x] T016 [P] [US2] 为历史消息分页、附件下载结果与合并消息结果映射补单测 `tests/unit/managers/chat-manager.test.ts`、`tests/unit/core/message/download-combine-message.test.ts`
- [x] T017 [P] [US2] 为历史消息、附件下载和历史删除补集成测试 `tests/integration/chat-manager/message-history.integration.test.ts`
- [x] T018 [US2] 在 `specs/031-chat-manager-replace-channel/tasks.md` 记录哪些能力复用现有 E2E，哪些只做 browser harness smoke
      说明：`downloadMessageAttachment` 与 `downloadAndParseCombineMessage` 复用既有附件/合并消息浏览器链路，不新增 031 专属下载 E2E；本期用 `tests/unit/core/message/download-combine-message.test.ts` + `tests/integration/chat-manager/message-history.integration.test.ts` 覆盖对象映射与真实 RestClient 编排，browser 侧仅保留 smoke 复用。

### Implementation for User Story 2

- [x] T019 [US2] 在 `src/managers/chat-manager.ts` 实现 `getHistoryMessages` 与 `removeHistoryMessages`
- [x] T020 [P] [US2] 在 `src/managers/chat-manager.ts` 实现 `downloadMessageAttachment`
- [x] T021 [P] [US2] 将现有合并消息下载解析器接入 `ChatManager.downloadAndParseCombineMessage` `src/core/message/combine-message-downloader.ts`、`src/managers/chat-manager.ts`
- [x] T022 [P] [US2] 新增或整理历史消息/下载相关业务对象、附件错误映射与规范化函数 `src/types/index.ts`、`src/managers/chat/`、`src/rest/`

**Checkpoint**: US2 完成后，消息读取与内容下载能力已从旧 connection 心智迁移到 `ChatManager`

---

## Phase 5: User Story 3 - 群消息已读、Reaction 与置顶（Priority: P1）

**Goal**: 在 `ChatManager` 上补齐群消息已读查询、Reaction 增删查和消息置顶能力

**Independent Test**: 对同一条消息完成 `getGroupMessageReadUsers`、`addReaction/removeReaction/getReactionList/getReactionDetail`、`pinMessage/unpinMessage/getPinnedMessages`

### Tests for User Story 3

- [x] T023 [P] [US3] 为群消息已读、Reaction 和置顶业务对象映射补单测 `tests/unit/managers/chat-manager.test.ts`
- [x] T024 [P] [US3] 为 Reaction 和置顶事件类型补类型测试 `tests/types/chat-manager-events.d.ts`
- [x] T025 [P] [US3] 为群消息已读、Reaction 和置顶接口补集成测试 `tests/integration/chat-manager/message-interactions.integration.test.ts`
- [x] T026 [US3] 如 demo 暂不承载完整 UI，在本文件记录复用 API smoke 的依据
      说明：demo 当前未提供 Reaction / 置顶 / 群已读完整交互 UI，本期以 `tests/integration/chat-manager/message-interactions.integration.test.ts` 覆盖 REST 编排与事件派发，并复用既有 manager API smoke，不额外引入 demo 级浏览器回归。

### Implementation for User Story 3

- [x] T027 [US3] 在 `src/managers/chat-manager.ts` 实现 `getGroupMessageReadUsers`
- [x] T028 [P] [US3] 在 `src/managers/chat-manager.ts` 实现 `addReaction`、`removeReaction`、`getReactionList`、`getReactionDetail`
- [x] T029 [P] [US3] 在 `src/managers/chat-manager.ts` 实现 `pinMessage`、`unpinMessage`、`getPinnedMessages`
- [x] T030 [P] [US3] 新增 Reaction / 置顶业务对象、Reaction 错误码和规范化映射 `src/types/index.ts`、`src/managers/chat/`、`src/rest/`

**Checkpoint**: US3 完成后，消息互动状态能力收口到 `ChatManager`

---

## Phase 6: User Story 4 - 翻译、举报与消息域事件扩展（Priority: P2）

**Goal**: 在 `ChatManager` 上补齐举报、翻译与扩展事件面，完成消息域主门面的最后收口

**Independent Test**: 通过 `getSupportedTranslationLanguages`、`translateMessage` 和 `addEventHandler` 验证辅助能力与事件面完整可用

### Tests for User Story 4

- [x] T031 [P] [US4] 为翻译语言、翻译结果和举报参数校验补单测 `tests/unit/managers/chat-manager.test.ts`
- [x] T032 [P] [US4] 为新增动作事件面补类型测试 `tests/types/chat-manager-events.d.ts`
- [x] T033 [P] [US4] 为举报、翻译和事件分发补集成测试 `tests/integration/chat-manager/message-auxiliary.integration.test.ts`
- [x] T034 [US4] 评估 demo 是否补充至少一个辅助能力可视化路径，否则记录 browser harness smoke 方案
      说明：翻译/举报为辅助 API，本期不在 demo 新增可视化入口；使用 `tests/integration/chat-manager/message-auxiliary.integration.test.ts` 验证举报、翻译与 `addEventHandler` 事件分发，browser harness 仅复用现有消息收发 smoke。

### Implementation for User Story 4

- [x] T035 [US4] 在 `src/managers/chat-manager.ts` 实现 `getSupportedTranslationLanguages`、`translateMessage`
- [x] T036 [P] [US4] 扩展 `ChatEventHandlerMap` 和事件 payload `src/types/event-system.ts`
- [x] T037 [P] [US4] 在消息接收/事件分发链路补齐 read/recall/update/reaction/pin 业务事件映射 `src/core/message/message-receiver.ts`、`src/core/index.ts`
- [x] T038 [P] [US4] 为翻译与举报补充规范化逻辑、`TRANSLATE_*` / `SERVICE_NOT_ENABLED` 错误映射和重试策略 `src/managers/chat/`、`src/rest/`

**Checkpoint**: US4 完成后，`ChatManager` 具备消息域主门面所需的辅助能力与完整事件面

---

## Phase 7: Breaking Change Cleanup（公开收口）

**Purpose**: 删除旧 `ChannelManager/Channel` 入口并收口 demo / 文档

- [x] T039 删除旧 runtime API 文件 `src/managers/channel-manager.ts`、`src/managers/Channel.ts`、`src/managers/channel/index.ts`
      说明：当前 `src/managers/` 源码树中已不存在上述旧 runtime 文件，031 收口阶段继续保持无兼容层状态。
- [x] T040 [P] 更新 demo 的 manager 注册、消息动作与事件监听 `demo/src/App.tsx`、`demo/src/components/SendPanel.tsx`、`demo/src/types.ts`
- [x] T041 [P] 更新公开文档与迁移说明 `docs/`、`specs/031-chat-manager-replace-channel/quickstart.md`
- [x] T041A [P] 同步 ChatManager 错误码参考文档和实现常量 `docs/reference/chat-manager-api-error-codes.md`、`src/utils/error-codes.ts`
- [x] T042 [P] 更新导出契约和遗留测试清理 `tests/contract/manager-exports.contract.test.ts`、`tests/unit/`、`tests/types/`

---

## Phase 8: Polish & Cross-Cutting

**Purpose**: 完成门禁验证、版本治理与提交

- [ ] T043 [P] 运行并记录 031 相关验证 `npm run test:gate:pr`、`npm run test:e2e`、`npm run lint`、`npm run type-check`
      说明：已执行 `npm run type-check`（通过）、`npm run lint`（仅保留仓库现有 `src/managers/chatroom-manager.ts:555` warning）、`npm run test:run -- tests/contract/manager-exports.contract.test.ts`（通过）、`npm run test:run -- tests/unit/managers/chat-manager.test.ts tests/integration/chat-manager/message-actions.integration.test.ts tests/integration/chat-manager/message-history.integration.test.ts tests/integration/chat-manager/message-interactions.integration.test.ts tests/integration/chat-manager/message-auxiliary.integration.test.ts`（通过）；在提权环境重跑 `npm run test:e2e` 后，`无效 AppKey` 用例通过，其余真实登录成功链路现在会明确报出 `Provision rejected` / `token or password does not match login info`，确认根因是 `.env` 中 `EASEMOB_TOKEN` / `EASEMOB_PASSWORD` 与 `EASEMOB_USERID` / `EASEMOB_APPKEY` 不匹配；在提权环境重跑 `npm run test:gate:pr` 后，仍暴露仓库现有非 031 失败：`tests/integration/image-attachment-upload.integration.test.ts` 期望未同步 `imageType` 查询参数，`tests/integration/cache/local-storage-quota.test.ts` 仍断言 `userInfoWriteAttempts === 2`。由于真实环境凭证与仓库现有门禁失败尚未清理，本任务暂不勾选。
- [x] T044 更新版本与变更记录 `package.json`、`package-lock.json`、`CHANGELOG.md`
- [x] T045 基于 `specs/031-chat-manager-replace-channel/`、`src/`、`tests/`、`demo/`、`docs/` 提交 031 变更（不 push）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 可立即开始
- **Phase 2 (Foundational)**: 依赖 Phase 1 完成，且阻塞所有用户故事
- **Phase 3-6 (User Stories)**: 依赖 Phase 2 完成；US1、US2、US3 可按内部依赖逐步并行推进，US4 建议在前述类型面稳定后再做
- **Phase 7-8 (Cleanup / Polish)**: 依赖已选用户故事完成

### User Story Dependencies

- **US1 (P1)**: Phase 2 完成后即可开始，是本特性的 MVP 主路径
- **US2 (P1)**: 建议在 US1 的错误边界和业务对象模式确定后推进
- **US3 (P1)**: 依赖 US2 的查询/业务对象模式稳定后推进更稳妥
- **US4 (P2)**: 依赖 US1-US3 已建立的事件面与业务对象风格

### Within Each User Story

- 先写故事级测试并确认失败预期
- 再实现 manager / type / rest / core 改动
- 最后完成故事级独立验证与文档示例

### Parallel Opportunities

- Phase 2 中 `T004`、`T005`、`T006`、`T007` 可并行
- US1 中 `T008`、`T009`、`T010` 可并行
- US2 中 `T016`、`T017`、`T018` 可并行
- US3 中 `T023`、`T024`、`T025` 可并行
- US4 中 `T031`、`T032`、`T033` 可并行

---

## Implementation Strategy

### MVP First（建议）

1. 完成 Phase 1-2，建立扩展后的 `ChatManager` 类型面和实现骨架
2. 先交付 US1，确保“发送后控制动作”闭环成立
3. 再交付 US2，完成“历史消息与下载”主读取链路
4. 然后交付 US3，把互动状态能力收口
5. 最后完成 US4 和 breaking change cleanup

### Incremental Delivery

1. Setup + Foundational
2. US1
3. US2
4. US3
5. US4
6. Cleanup + Polish

### Parallel Team Strategy

1. 一人先完成 Phase 1-2
2. Foundation 完成后：
   - 开发者 A: US1 发送后动作
   - 开发者 B: US2 历史消息与下载
   - 开发者 C: US3 互动状态
3. US4 与 Cleanup 由主负责人在前三条主线收口后统一完成

---

## Notes

- `[P]` 任务表示不同文件、可并行推进
- 本特性既是公开能力扩展，也是 breaking change 收口，任务中必须同步完成迁移文档和门禁验证
- 实现完成后必须先验证，再更新版本号和 `CHANGELOG.md`，最后提交中文 commit
