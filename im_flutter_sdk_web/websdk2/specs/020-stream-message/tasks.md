---
description: "020 流式消息接收回调实现任务清单"
---

# Tasks: 流式消息接收回调（stream）

**Input**: 设计文档来自 `/specs/020-stream-message/`  
**Prerequisites**: plan.md（必需）、spec.md（必需）、research.md、data-model.md、contracts/、quickstart.md  
**Tests**: 需要，包含单元测试、契约测试与回归验证  
**Organization**: 任务按用户故事分组，支持独立实现与独立验证

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行（不同文件、无前置依赖）
- **[Story]**: 仅用户故事阶段使用（`[US1]...[US3]`）
- 每个任务描述都包含明确文件路径

## Phase 1: Setup（共享准备）

**Purpose**: 建立 020 所需测试、契约与样本骨架

- [x] T001 创建流式消息测试文件骨架 `tests/unit/core/message/stream-message-ordering.test.ts`、`tests/unit/core/message/stream-message-fallback-full.test.ts`、`tests/unit/core/message/stream-message-single-full.test.ts`
- [x] T002 创建流式契约测试骨架 `tests/contract/stream-message-event.contract.test.ts`、`tests/contract/stream-send-unsupported.contract.test.ts`
- [x] T003 [P] 创建流式协议样本目录 `tests/test-utils/stream/fixtures/`
- [x] T004 [P] 创建流式测试辅助工具 `tests/test-utils/stream/build-stream-chunk.ts`

---

## Phase 2: Foundational（阻塞基础）

**Purpose**: 完成所有用户故事共享的接收端基础能力（未完成前禁止进入 US 实现）

**⚠️ CRITICAL**: 此阶段完成后，用户故事才能并行推进

- [x] T005 扩展流式消息公共类型定义于 `src/types/index.ts`
- [x] T006 [P] 扩展事件系统新增 `onStreamMessage` 事件常量与载荷映射于 `src/types/event-system.ts`
- [x] T007 [P] 扩展流式错误码常量于 `src/utils/error-codes.ts`
- [x] T008 [P] 扩展 MSync 流式状态/类型常量于 `src/protocol/msync/types.ts`
- [x] T009 在协议解码链路补充流式字段基础映射于 `src/protocol/msync/codec.ts`
- [x] T010 [P] 新增流缓存会话模块于 `src/core/message/stream-message-cache.ts`
- [x] T011 [P] 新增流式分片处理器骨架于 `src/core/message/stream-message-handler.ts`
- [x] T012 在接收器中接入流式处理入口于 `src/core/message/message-receiver.ts`
- [x] T013 [P] 新增流式协议字段解码基础单测于 `tests/unit/protocol/stream-chunk-decode.test.ts`
- [x] T014 [P] 新增流缓存会话基础单测于 `tests/unit/core/message/stream-message-cache.test.ts`
- [x] T015 [P] 新增流式事件类型约束测试于 `tests/types/stream-event-types.test.ts`

**Checkpoint**: 流式共享基础能力可用，后续用户故事可并行

---

## Phase 3: User Story 1 - 按顺序回调流式分片（Priority: P1） 🎯 MVP

**Goal**: 在乱序与缺片场景下实现“单流内严格有序回调 + 去重 + full/delta 文本语义”

**Independent Test**: 注入乱序分片（含缺片后补齐）并验证回调顺序严格递增、重复分片不重复回调、每次回调同时包含 `fullText` 与 `deltaText`

### Tests for User Story 1

- [x] T016 [P] [US1] 完成流式事件顺序契约测试于 `tests/contract/stream-message-event.contract.test.ts`
- [x] T017 [P] [US1] 完成乱序分片顺序回调测试于 `tests/unit/core/message/stream-message-ordering.test.ts`
- [x] T018 [P] [US1] 完成缺片补齐后连续回放测试于 `tests/unit/core/message/stream-message-gap-recovery.test.ts`
- [x] T019 [P] [US1] 完成重复分片去重测试于 `tests/unit/core/message/stream-message-dedup.test.ts`

### Implementation for User Story 1

- [x] T020 [US1] 实现按 `lastDispatchedSeq` 推进的连续分片扫描于 `src/core/message/stream-message-cache.ts`
- [x] T021 [US1] 实现单流内严格有序分发主流程于 `src/core/message/stream-message-handler.ts`
- [x] T022 [US1] 实现缺片缓存与补齐触发回放逻辑于 `src/core/message/stream-message-handler.ts`
- [x] T023 [US1] 在回调事件中填充累计全文与增量文本语义于 `src/core/message/stream-message-handler.ts`
- [x] T024 [US1] 在消息接收器中派发 `onStreamMessage` 事件于 `src/core/message/message-receiver.ts`
- [x] T025 [US1] 增加顺序分发与去重结构化日志于 `src/core/message/stream-message-handler.ts`

**Checkpoint**: US1 可独立完成流式分片顺序回调与补齐回放

---

## Phase 4: User Story 2 - 缺片兜底完成与服务端超时结束（Priority: P1）

**Goal**: 实现“缺片等待 + 兜底末片完成 + 服务端超时错误分片一次性结束”

**Independent Test**: 缺片不补齐时注入兜底末片可完成流；服务端下发超时错误分片（含 512）时仅回调一次错误态并清理会话

### Tests for User Story 2

- [x] T026 [P] [US2] 完成兜底末片完成场景测试于 `tests/unit/core/message/stream-message-fallback-full.test.ts`
- [x] T027 [P] [US2] 完成服务端超时错误分片场景测试于 `tests/unit/core/message/stream-message-timeout-error.test.ts`
- [x] T028 [P] [US2] 完成流完成后清理与后续分片忽略测试于 `tests/unit/core/message/stream-message-cleanup.test.ts`
- [x] T029 [P] [US2] 完成 streamError/finishReason 协议映射测试于 `tests/unit/protocol/stream-error-decode.test.ts`

### Implementation for User Story 2

- [x] T030 [US2] 实现兜底末片（完整文本）完成分支于 `src/core/message/stream-message-handler.ts`
- [x] T031 [US2] 实现服务端超时错误分片触发一次性错误回调于 `src/core/message/stream-message-handler.ts`
- [x] T032 [US2] 实现流完成后会话清理与过期分片丢弃于 `src/core/message/stream-message-cache.ts`
- [x] T033 [US2] 扩展协议层错误码与完成原因映射于 `src/protocol/msync/codec.ts`
- [x] T034 [US2] 补充流式超时错误码语义映射于 `src/utils/error-codes.ts`
- [x] T035 [US2] 更新流式失败与兜底验收说明于 `specs/020-stream-message/quickstart.md`

**Checkpoint**: US2 可独立完成缺片兜底与服务端超时结束语义

---

## Phase 5: User Story 3 - 单片 FULL 与发送边界约束（Priority: P2）

**Goal**: 支持单片 `STREAM_FULL` 语义，并明确 SDK 不支持发送流式消息且非流式链路不回归

**Independent Test**: 单片流仅回调一次 `STREAM_FULL`；尝试发送流式消息返回不支持错误；普通消息接收回归通过

### Tests for User Story 3

- [x] T036 [P] [US3] 完成单片 `STREAM_FULL` 场景测试于 `tests/unit/core/message/stream-message-single-full.test.ts`
- [x] T037 [P] [US3] 完成发送流式消息不支持测试于 `tests/unit/chat-client/send-stream-unsupported.test.ts`
- [x] T038 [P] [US3] 完成非流式消息回归测试于 `tests/unit/core/message/message-receiver-stream-regression.test.ts`
- [x] T039 [P] [US3] 完成发送不支持契约测试于 `tests/contract/stream-send-unsupported.contract.test.ts`

### Implementation for User Story 3

- [x] T040 [US3] 实现单片 `STREAM_FULL` 仅一次回调语义于 `src/core/message/stream-message-handler.ts`
- [x] T041 [US3] 在 ChatClient 发送入口拦截流式发送并返回不支持错误于 `src/chat-client.ts`
- [x] T042 [US3] 在 MessageSender 层增加流式发送二次兜底拦截于 `src/core/message/message-sender.ts`
- [x] T043 [US3] 扩展流式事件模型导出与类型文档于 `src/types/index.ts`
- [x] T044 [US3] 完善流式事件导出注释与对外映射于 `src/types/event-system.ts`
- [x] T045 [US3] 修复并验证非流式接收零回归于 `src/core/message/message-receiver.ts` 与 `tests/unit/core/message/message-receiver.test.ts`

**Checkpoint**: US3 可独立完成单片 FULL 与发送边界目标

---

## Phase 6: Polish & Cross-Cutting

**Purpose**: 跨用户故事收尾、验证与发布

- [x] T046 [P] 对齐 spec/plan/tasks 术语一致性（`fullText`/`deltaText`/`msgId`）于 `specs/020-stream-message/spec.md`、`specs/020-stream-message/plan.md`、`specs/020-stream-message/tasks.md`
- [x] T047 [P] 回填 quickstart 实测结果与已知风险于 `specs/020-stream-message/quickstart.md`
- [x] T048 执行 020 相关测试并记录命令输出于 `specs/020-stream-message/quickstart.md`
- [x] T049 执行 lint 并修复 020 相关告警于 `src/` 与 `tests/`
- [x] T050 更新版本与变更记录于 `package.json`、`package-lock.json`、`CHANGELOG.md`
- [x] T051 提交 020 实现变更（不 push）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 可立即开始
- **Phase 2 (Foundational)**: 依赖 Phase 1 完成，且阻塞所有用户故事
- **Phase 3-5 (User Stories)**: 依赖 Phase 2 完成；可并行或按优先级推进
- **Phase 6 (Polish)**: 依赖已选用户故事完成

### User Story Dependencies

- **US1 (P1)**: Phase 2 后可开始，作为 MVP 主路径
- **US2 (P1)**: Phase 2 后可开始，建议在 US1 顺序分发稳定后联调
- **US3 (P2)**: 建议在 US1、US2 稳定后推进边界与回归

### Within Each User Story

- 先写测试（应先失败）
- 再实现缓存/处理器核心逻辑
- 再接入接收器与事件分发
- 最后完成故事级独立验证

### Parallel Opportunities

- Phase 1、2 中所有标记 `[P]` 的任务可并行
- Phase 2 完成后，US1 与 US2 可并行推进
- US3 的测试任务可与 US1/US2 收尾并行
- Phase 6 文档与验证类任务可并行

---

## Parallel Example: User Story 1

```bash
Task: "T016 tests/contract/stream-message-event.contract.test.ts"
Task: "T017 tests/unit/core/message/stream-message-ordering.test.ts"
Task: "T018 tests/unit/core/message/stream-message-gap-recovery.test.ts"
Task: "T019 tests/unit/core/message/stream-message-dedup.test.ts"
```

## Parallel Example: User Story 2

```bash
Task: "T026 tests/unit/core/message/stream-message-fallback-full.test.ts"
Task: "T027 tests/unit/core/message/stream-message-timeout-error.test.ts"
Task: "T028 tests/unit/core/message/stream-message-cleanup.test.ts"
Task: "T029 tests/unit/protocol/stream-error-decode.test.ts"
```

## Parallel Example: User Story 3

```bash
Task: "T036 tests/unit/core/message/stream-message-single-full.test.ts"
Task: "T037 tests/unit/chat-client/send-stream-unsupported.test.ts"
Task: "T038 tests/unit/core/message/message-receiver-stream-regression.test.ts"
Task: "T039 tests/contract/stream-send-unsupported.contract.test.ts"
```

---

## Implementation Strategy

### MVP First（仅 US1）

1. 完成 Phase 1 + Phase 2
2. 完成 US1（顺序回调/缺片补齐/去重）
3. **STOP and VALIDATE**：仅验证 US1 独立通过
4. 通过后再推进兜底与超时策略

### Incremental Delivery

1. Setup + Foundational 打底
2. 交付 US1（顺序回调能力）
3. 交付 US2（兜底与超时完成语义）
4. 交付 US3（单片 FULL 与发送边界）
5. 收尾发布（Phase 6）

### Parallel Team Strategy

- 开发 A：US1（顺序分发、缺片补齐、去重）
- 开发 B：US2（兜底末片、超时错误分片、完成清理）
- 开发 C：US3（单片 FULL、发送边界、非流式回归）

---

## Notes

- 所有任务均遵循 `- [ ] Txxx [P] [USx] 描述+路径` 规范
- 用户故事阶段均保留 `[USx]` 标签，便于追踪与独立验收
- 每个故事可单独验证，不依赖后续故事完成
- 每轮实现完成后按规则更新版本号、CHANGELOG 并提交 commit
