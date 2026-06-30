---
description: '019 合并消息收发实现任务清单'
---

# Tasks: 合并消息收发（combine）

**Input**: 设计文档来自 `/specs/019-combine-message/`  
**Prerequisites**: plan.md（必需）、spec.md（必需）、research.md、data-model.md、contracts/、quickstart.md  
**Tests**: 需要，包含单元测试、契约测试与跨平台回归验证  
**Organization**: 任务按用户故事分组，支持独立实现与独立验证

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行（不同文件、无前置依赖）
- **[Story]**: 仅用户故事阶段使用（`[US1]...[US4]`）
- 每个任务描述都包含明确文件路径

## Phase 1: Setup（共享准备）

**Purpose**: 建立 019 开发所需测试与文档骨架

- [x] T001 创建合并消息测试文件骨架 `tests/unit/message/create-combine-message.test.ts`、`tests/unit/core/message/combine-message-sender.test.ts`、`tests/unit/core/message/download-combine-message.test.ts`
- [ ] T002 创建合并消息契约测试骨架 `tests/contract/combine-message-send.contract.test.ts`、`tests/contract/combine-message-details.contract.test.ts`
- [ ] T003 [P] 创建合并消息协议样本目录 `tests/test-utils/combine/fixtures/`

---

## Phase 2: Foundational（阻塞基础）

**Purpose**: 完成所有用户故事共享的基础能力（未完成前禁止进入 US 实现）

**⚠️ CRITICAL**: 此阶段完成后，用户故事才能并行推进

- [x] T004 扩展公共类型以承载 combine 消息实体于 `src/types/index.ts`
- [x] T005 [P] 扩展创建消息入参与 messageList 子项类型于 `src/types/message-create.ts`
- [x] T006 [P] 扩展事件系统 `onCombineMessage` 事件名与载荷映射于 `src/types/event-system.ts`
- [x] T007 [P] 新增 combine 相关错误码常量于 `src/utils/error-codes.ts`
- [x] T008 新增合并消息约束工具（类型白名单、条数、层级）于 `src/message/combine-message-constraints.ts`
- [x] T009 [P] 新增合并消息载荷编解码工具（顺序与校验和）于 `src/message/combine-payload-codec.ts`
- [x] T010 在协议层预留 combine 编解码入口于 `src/protocol/msync/codec.ts`
- [x] T011 [P] 新增基础约束单测于 `tests/unit/message/combine-message-constraints.test.ts`
- [x] T012 [P] 新增载荷编解码单测于 `tests/unit/message/combine-payload-codec.test.ts`
- [ ] T013 [P] 新增事件载荷类型测试于 `tests/unit/core/message/combine-event-types.test.ts`

**Checkpoint**: combine 共享基础能力可用，后续用户故事可并行

---

## Phase 3: User Story 1 - 发送合并消息（Priority: P1） 🎯 MVP

**Goal**: 支持 `messageList` 编码上传并发送 `type=combine` 消息

**Independent Test**: 构造多类型 `messageList` 后执行发送，验证编码->上传->发送闭环成功且字段完整

### Tests for User Story 1

- [ ] T014 [P] [US1] 完成发送契约测试 `tests/contract/combine-message-send.contract.test.ts`
- [x] T015 [P] [US1] 完成创建 combine 消息单测 `tests/unit/message/create-combine-message.test.ts`
- [x] T016 [P] [US1] 完成发送链路单测 `tests/unit/core/message/combine-message-sender.test.ts`
- [x] T017 [P] [US1] 新增协议上行编码测试 `tests/unit/protocol/combine-content-encode.test.ts`

### Implementation for User Story 1

- [x] T018 [US1] 实现 `createCombineMessage` 与导出于 `src/message/create-message.ts`
- [x] T019 [P] [US1] 完成 createCombine 参数校验 schema 于 `src/validators/message-create.ts`
- [x] T020 [US1] 暴露创建合并消息入口于 `src/chat-client.ts`
- [x] T021 [US1] 在发送器接入 combine 编码/上传/回填流程于 `src/core/message/message-sender.ts`
- [x] T022 [P] [US1] 扩展上传器支持 combine 载荷上传于 `src/upload/attachment-uploader.ts`
- [x] T023 [P] [US1] 扩展上传类型定义支持 combine 资源回填于 `src/upload/types.ts`
- [x] T024 [US1] 完成 combine 上行协议字段映射于 `src/protocol/msync/codec.ts`

**Checkpoint**: US1 可独立发送 combine 消息并通过契约验证

---

## Phase 4: User Story 2 - 接收并按需解码合并消息（Priority: P1）

**Goal**: 下行先回调元信息，再通过 API 按需下载并解码详情

**Independent Test**: 收到 combine 后触发 `onCombineMessage`，调用按需 API 成功获取顺序一致的子消息列表

### Tests for User Story 2

- [ ] T025 [P] [US2] 完成详情契约测试 `tests/contract/combine-message-details.contract.test.ts`
- [x] T026 [P] [US2] 新增 combine 下行解码测试 `tests/unit/protocol/combine-content-decode.test.ts`
- [x] T027 [P] [US2] 新增接收分发测试 `tests/unit/core/message/combine-message-receiver.test.ts`
- [x] T028 [P] [US2] 完成按需下载解码 API 测试 `tests/unit/core/message/download-combine-message.test.ts`

### Implementation for User Story 2

- [x] T029 [US2] 实现 combine 下行解码映射于 `src/protocol/msync/codec.ts`
- [x] T030 [US2] 在接收器分发 `onCombineMessage` 事件于 `src/core/message/message-receiver.ts`
- [x] T031 [P] [US2] 新增按需下载解码服务于 `src/core/message/combine-message-downloader.ts`
- [x] T032 [US2] 在核心模块暴露下载解码能力于 `src/core/index.ts`
- [x] T033 [US2] 在 ChatClient 暴露 `downloadAndParseCombineMessage` API 于 `src/chat-client.ts`
- [x] T034 [P] [US2] 扩展请求适配器类型支持二进制响应于 `src/platform/types.ts`
- [x] T035 [US2] 实现 Web 请求适配器二进制下载能力于 `src/platform/request/web-request-adapter.ts`

**Checkpoint**: US2 可独立完成接收回调与按需解码闭环

---

## Phase 5: User Story 3 - 嵌套层级与边界约束（Priority: P1）

**Goal**: 保证 `combineLevel<=10`、条数<=300、系统消息拒绝、解码整体失败

**Independent Test**: 通过边界测试验证超限与非法输入都被拦截，且失败场景不会返回部分结果

### Tests for User Story 3

- [ ] T036 [P] [US3] 新增层级计算测试 `tests/unit/message/combine-level.test.ts`
- [ ] T037 [P] [US3] 新增系统消息拦截测试 `tests/unit/message/combine-message-whitelist.test.ts`
- [ ] T038 [P] [US3] 新增整体失败策略测试 `tests/unit/core/message/combine-detail-all-or-nothing.test.ts`

### Implementation for User Story 3

- [x] T039 [US3] 在发送链路集成层级与条数校验于 `src/core/message/message-sender.ts`
- [x] T040 [US3] 在下载解码链路集成条数上限与整体失败语义于 `src/core/message/combine-message-downloader.ts`
- [ ] T041 [US3] 完善 combine 错误分类与错误对象映射于 `src/utils/errors.ts`
- [x] T042 [US3] 完善 combine 错误码枚举与阶段映射于 `src/utils/error-codes.ts`
- [ ] T043 [US3] 补充发送/接收边界回归用例于 `tests/unit/core/message/combine-message-sender.test.ts` 与 `tests/unit/core/message/download-combine-message.test.ts`

**Checkpoint**: US3 约束策略可独立验证并达成 100% 边界拦截

---

## Phase 6: User Story 4 - 跨平台一致性（Priority: P2）

**Goal**: 在目标平台保持 combine 上传、下载、错误语义一致

**Independent Test**: 多平台执行发送与按需解码用例，字段、顺序、错误语义一致

### Tests for User Story 4

- [ ] T044 [P] [US4] 新增跨平台 combine 上传源兼容测试 `tests/unit/platform/combine-upload-source.test.ts`
- [ ] T045 [P] [US4] 新增跨平台二进制下载兼容测试 `tests/unit/platform/combine-download-adapter.test.ts`
- [ ] T046 [P] [US4] 新增跨平台契约回归测试 `tests/contract/platform/combine-message-compat.contract.test.ts`

### Implementation for User Story 4

- [ ] T047 [US4] 扩展上传源规范化支持 combine 载荷文件化于 `src/platform/upload/upload-source.ts`
- [ ] T048 [US4] 扩展上传工具兼容 combine 资源元数据于 `src/upload/utils.ts`
- [ ] T049 [US4] 在平台工厂装配 combine 下载/上传能力并执行 fail-fast 校验于 `src/platform/factory.ts`
- [ ] T050 [US4] 在能力校验器补充 combine 所需能力检查于 `src/platform/capability-validator.ts`
- [ ] T051 [US4] 更新 combine 跨平台使用文档于 `docs/reference/api.md` 与 `docs/architecture/cross-platform-sdk-plan.md`

**Checkpoint**: US4 可独立完成跨平台一致性验收

---

## Phase 7: Polish & Cross-Cutting

**Purpose**: 跨用户故事收尾、回归与发布

- [ ] T052 [P] 同步 quickstart 验证结果与问题记录于 `specs/019-combine-message/quickstart.md`
- [ ] T053 [P] 校准契约与数据模型字段一致性于 `specs/019-combine-message/contracts/combine-message.openapi.yaml` 与 `specs/019-combine-message/data-model.md`
- [ ] T054 执行 019 关键测试并记录命令输出于 `specs/019-combine-message/quickstart.md`
- [ ] T055 执行 lint 并修复告警（涉及 `src/` 与 `tests/`）
- [ ] T056 更新版本与变更记录于 `package.json`、`package-lock.json`、`CHANGELOG.md`
- [ ] T057 提交 019 实现变更（不 push）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 可立即开始
- **Phase 2 (Foundational)**: 依赖 Phase 1 完成，且阻塞所有用户故事
- **Phase 3-6 (User Stories)**: 依赖 Phase 2 完成；可并行或按优先级推进
- **Phase 7 (Polish)**: 依赖已选用户故事完成

### User Story Dependencies

- **US1 (P1)**: Phase 2 后可开始，作为 MVP 主路径
- **US2 (P1)**: Phase 2 后可开始，建议在 US1 协议上行稳定后联调
- **US3 (P1)**: 依赖 US1 与 US2 的主流程成型后收敛边界策略
- **US4 (P2)**: 建议在 P1 三个故事通过后进行跨平台一致性收尾

### Within Each User Story

- 先写测试（应先失败）
- 再实现模型/协议映射
- 再接入发送或接收主链路
- 最后完成故事级独立验证

### Parallel Opportunities

- Phase 1、2 中所有标记 `[P]` 的任务可并行
- Phase 2 完成后，US1/US2 可并行推进
- US3 可在 US1/US2 稳定后并行补边界测试与实现
- US4 的平台测试与文档任务可并行

---

## Parallel Example: User Story 1

```bash
Task: "T014 tests/contract/combine-message-send.contract.test.ts"
Task: "T015 tests/unit/message/create-combine-message.test.ts"
Task: "T016 tests/unit/core/message/combine-message-sender.test.ts"
Task: "T017 tests/unit/protocol/combine-content-encode.test.ts"
```

## Parallel Example: User Story 2

```bash
Task: "T026 tests/unit/protocol/combine-content-decode.test.ts"
Task: "T027 tests/unit/core/message/combine-message-receiver.test.ts"
Task: "T028 tests/unit/core/message/download-combine-message.test.ts"
Task: "T031 src/core/message/combine-message-downloader.ts"
```

## Parallel Example: User Story 3

```bash
Task: "T036 tests/unit/message/combine-level.test.ts"
Task: "T037 tests/unit/message/combine-message-whitelist.test.ts"
Task: "T038 tests/unit/core/message/combine-detail-all-or-nothing.test.ts"
Task: "T041 src/utils/errors.ts"
```

## Parallel Example: User Story 4

```bash
Task: "T044 tests/unit/platform/combine-upload-source.test.ts"
Task: "T045 tests/unit/platform/combine-download-adapter.test.ts"
Task: "T046 tests/contract/platform/combine-message-compat.contract.test.ts"
Task: "T051 docs/reference/api.md 与 docs/architecture/cross-platform-sdk-plan.md"
```

---

## Implementation Strategy

### MVP First（仅 US1）

1. 完成 Phase 1 + Phase 2
2. 完成 US1（发送 combine 闭环）
3. **STOP and VALIDATE**：仅验证发送能力与契约
4. 通过后进入接收与边界能力

### Incremental Delivery

1. Setup + Foundational 打底
2. 交付 US1（发送）
3. 交付 US2（接收 + 按需解码）
4. 交付 US3（边界与失败策略）
5. 交付 US4（跨平台一致性）

### Parallel Team Strategy

- 开发 A：US1 发送与协议上行
- 开发 B：US2 接收与下载解码
- 开发 C：US3 约束与错误体系
- 开发 D：US4 跨平台适配与契约回归

---

## Notes

- 所有任务均遵循 `- [ ] Txxx [P] [USx] 描述+路径` 规范
- 用户故事阶段均保留 `[USx]` 标签，便于追踪与独立验收
- 每个故事都可单独验证，不依赖后续故事完成
- 每轮实现完成后按规则更新版本号、CHANGELOG 并提交 commit
