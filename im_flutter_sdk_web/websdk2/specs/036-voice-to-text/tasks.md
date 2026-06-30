---
description: '036 语音转文字迁移实现任务清单'
---

# Tasks: 语音转文字迁移

**Input**: 设计文档来自 `/specs/036-voice-to-text/`  
**Prerequisites**: plan.md（必需）、spec.md（必需）；`research.md`、`data-model.md`、`contracts/`、`quickstart.md` 可在实现中补齐  
**Tests**: 需要，包含单元测试、集成测试与 E2E 测试；不得省略测试分层，若某层复用现有能力需在任务中写明依据  
**Organization**: 任务按用户故事分组，支持独立实现与独立验证

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行（不同文件、无前置依赖）
- **[Story]**: 仅用户故事阶段使用（`[US1]...[US3]`）
- 每个任务描述都包含明确文件路径

## Phase 1: Setup（共享准备）

**Purpose**: 建立 036 所需文档、contract 与测试骨架

- [ ] T001 创建 036 设计与验证文档骨架 `specs/036-voice-to-text/research.md`、`specs/036-voice-to-text/data-model.md`、`specs/036-voice-to-text/contracts/voice-to-text.openapi.yaml`、`specs/036-voice-to-text/quickstart.md`
- [ ] T002 [P] 创建 036 单元与集成测试骨架 `tests/unit/managers/chat-manager-voice-to-text.test.ts`、`tests/unit/rest/speech-transcription.test.ts`、`tests/unit/rest/speech-recognition.test.ts`、`tests/integration/chat-manager/voice-to-text.integration.test.ts`、`tests/integration/miniapp-demo/voice-to-text.integration.test.ts`
- [ ] T003 [P] 创建 036 E2E 测试骨架 `tests/e2e/voice-to-text.spec.ts`

---

## Phase 2: Foundational（阻塞基础）

**Purpose**: 固化真实样例风险、类型边界、错误码兼容层与共享 speech helper

**⚠️ CRITICAL**: 此阶段完成前不得进入任何用户故事实现

- [ ] T004 在 `specs/036-voice-to-text/research.md`、`specs/036-voice-to-text/contracts/voice-to-text.openapi.yaml`、`specs/036-voice-to-text/quickstart.md` 记录已确认的 `speech/recognitions` 成功/失败样例、`speech/transcriptions` 样例缺口和实现前风险门禁
- [ ] T005 [P] 在 `src/types/chat-manager.ts`、`src/types/index.ts` 定义并导出 036 共用的 `AudioParams`、`VoiceMessageSource`、`VoiceSourceFile`、`VoiceToTextResult` 类型边界与双语注释
- [ ] T006 [P] 在 `src/utils/error-codes.ts`、`src/utils/errors.ts` 设计 036 所需旧兼容错误码常量与挂载策略，明确如何把旧 code/message 附着到抛出的 `SDKError`
- [ ] T007 [P] 在 `src/rest/` 下新增或扩展 speech 共用 helper（建议 `src/rest/speech-helpers.ts` 或同等模块），收敛 `fileId` 提取、speech 响应 envelope 解析、`4001001` 子场景判断与兼容错误映射基础能力
- [ ] T008 [P] 在 `tests/unit/rest/speech-transcription.test.ts`、`tests/unit/rest/speech-recognition.test.ts` 增加基础边界测试：`fileId` 提取、`4001001`/`4001002` 映射、未知 speech 错误兜底、`PCM` 缺少 `audioParams` 不做本地拦截

**Checkpoint**: 真实样例风险、共享类型和兼容错误映射基础设施已就绪，用户故事可围绕同一失败语义推进

---

## Phase 3: User Story 1 - 转写已存在语音消息（Priority: P1） 🎯 MVP

**Goal**: 在 `ChatManager` 上提供 `voiceMessageToText(messageBody, audioParams?)`，保持旧语音消息体入参语义，成功返回 `{ text }`，失败抛兼容错误码 `SDKError`

**Independent Test**: 登录态下传入合法语音消息体即可独立验证 `voiceMessageToText` 的成功路径、本地参数校验、本地 fileId 解析失败和服务端错误映射

### Tests for User Story 1

- [ ] T009 [P] [US1] 在 `tests/unit/managers/chat-manager-voice-to-text.test.ts` 补充 `voiceMessageToText` 的本地参数校验单测：非法消息体、非语音类型、缺失 URL、无法提取 fileId、合法 `audioParams`
- [ ] T010 [P] [US1] 在 `tests/unit/rest/speech-transcription.test.ts` 补充 `speech/transcriptions` 的成功解析、已知服务端错误码映射、未知错误兜底与 `SDKError` 挂载语义单测
- [ ] T011 [P] [US1] 在 `tests/integration/chat-manager/voice-to-text.integration.test.ts` 补充 `chatManager.voiceMessageToText(...)` 的 manager + rest 协作用例，验证成功返回 `{ text }`、失败抛出兼容 `SDKError`
- [ ] T012 [US1] 在 `specs/036-voice-to-text/tasks.md` 记录 US1 的 E2E 复用方式：消息转写的浏览器主路径由 US3 的 demo E2E 统一覆盖，不额外新增 story 专属 E2E

### Implementation for User Story 1

- [ ] T013 [US1] 在 `src/rest/chat-management.ts` 或新增 speech REST 模块中实现 `speech/transcriptions` 请求封装，接收语音消息体 URL 提取的 `fileId` 并返回 `{ text }`
- [ ] T014 [P] [US1] 在 `src/managers/chat-manager.ts` 增加 `voiceMessageToText(messageBody, audioParams?)`，按旧入参语义做本地校验、调用 speech helper，并统一成功/失败返回风格
- [ ] T015 [P] [US1] 在 `src/index.ts`、`src/types/index.ts`、必要的公开类型文件中补齐 `voiceMessageToText` 相关导出与双语注释
- [ ] T016 [US1] 在 `specs/036-voice-to-text/contracts/voice-to-text.openapi.yaml`、`specs/036-voice-to-text/data-model.md`、`specs/036-voice-to-text/quickstart.md` 落实 `voiceMessageToText` 的 SDK-facing 契约、数据模型与调用示例

**Checkpoint**: US1 完成后，SDK 已具备可独立调用的语音消息转写能力

---

## Phase 4: User Story 2 - 转写本地语音文件（Priority: P1）

**Goal**: 在 `ChatManager` 上提供 `voiceFileToText(file, audioParams?)`，明确支持浏览器 `File` 和当前 `MiniAppFile`，成功返回 `{ text }`，失败抛兼容 `SDKError`

**Independent Test**: 登录态下分别传入浏览器 `File` 与当前 `MiniAppFile`，即可独立验证上传链路、本地参数校验、`PCM` 缺少 `audioParams` 的服务端裁决策略和 speech 错误映射

### Tests for User Story 2

- [ ] T017 [P] [US2] 在 `tests/unit/managers/chat-manager-voice-to-text.test.ts` 补充 `voiceFileToText` 的本地参数校验单测：非法输入、`File` 输入、`MiniAppFile` 输入、`PCM` 缺少 `audioParams` 不拦截
- [ ] T018 [P] [US2] 在 `tests/unit/rest/speech-recognition.test.ts` 补充 `speech/recognitions` 的 multipart/字段构造、`4001002`、`4001001`、`4011001`、`4031001`、`4031002` 映射单测
- [ ] T019 [P] [US2] 在 `tests/integration/chat-manager/voice-to-text.integration.test.ts` 补充浏览器 `File` 转写集成用例，验证当前 SDK2 上传能力与 speech 响应解析协作
- [ ] T020 [P] [US2] 在 `tests/integration/miniapp-demo/voice-to-text.integration.test.ts` 补充 `MiniAppFile` 转写集成用例，验证小程序文件对象在当前架构下的上传链路
- [ ] T021 [US2] 在 `specs/036-voice-to-text/tasks.md` 记录 US2 的 E2E 复用方式：本地文件转写的浏览器主路径由 US3 的 demo E2E 统一覆盖，不额外新增 story 专属 E2E

### Implementation for User Story 2

- [ ] T022 [US2] 在 `src/rest/chat-management.ts` 或新增 speech REST 模块中实现 `speech/recognitions` 请求封装，优先复用当前 SDK2 上传能力并返回 `{ text }`
- [ ] T023 [P] [US2] 在 `src/managers/chat-manager.ts` 实现 `voiceFileToText(file, audioParams?)`，支持 `File` 与 `MiniAppFile`，统一成功/失败风格
- [ ] T024 [P] [US2] 在 `src/platform/upload/` 相关模块中补齐 036 所需扩展点（如字段透传、speech 场景响应读取），保持与现有上传抽象一致，不回退到旧 SDK 分叉实现
- [ ] T025 [P] [US2] 在 `src/types/chat-manager.ts`、`src/types/index.ts`、`src/index.ts` 完成 `voiceFileToText` 入参/返回类型与公开导出收口
- [ ] T026 [US2] 在 `specs/036-voice-to-text/contracts/voice-to-text.openapi.yaml`、`specs/036-voice-to-text/data-model.md`、`specs/036-voice-to-text/quickstart.md` 落实 `voiceFileToText` 的契约、平台输入范围和 `PCM` 校验策略说明

**Checkpoint**: US2 完成后，SDK 已具备可独立调用的本地语音文件转写能力，并明确支持 `File` 与 `MiniAppFile`

---

## Phase 5: User Story 3 - 在 demo 页面验证语音转文字（Priority: P2）

**Goal**: 在当前 Web demo 中新增“语音转文字”标签页，支持最近语音消息转写和本地文件转写，并直接展示 `{ text }` 或兼容错误码

**Independent Test**: 打开当前 Web demo，进入新标签页，独立验证最近语音消息转写、本地文件转写、未选择消息/文件时的提示和错误展示

### Tests for User Story 3

- [ ] T027 [P] [US3] 在 `tests/e2e/voice-to-text.spec.ts` 编写 demo 主路径 E2E：进入新 tab、选择最近语音消息、触发 `voiceMessageToText`、选择本地文件、触发 `voiceFileToText`、验证结果/错误展示
- [ ] T028 [P] [US3] 在 `tests/integration/chat-manager/voice-to-text.integration.test.ts` 补充 demo 依赖的消息样本筛选逻辑集成用例，验证最近语音消息来源于当前消息列表而不是伪数据
- [ ] T029 [US3] 在 `tests/unit/managers/chat-manager-voice-to-text.test.ts` 或新增 demo 组件单测中补充无语音消息/未选文件时的提示逻辑验证（若仓库当前不做组件单测，则在本任务中记录复用 E2E 覆盖依据）

### Implementation for User Story 3

- [ ] T030 [US3] 在 `demo/src/App.tsx`、`demo/src/types.ts` 增加 `voice-to-text` tab 注册、类型声明和面板挂载
- [ ] T031 [P] [US3] 新增 `demo/src/components/VoiceToTextPanel.tsx`，实现最近语音消息筛选、本地文件选择、`audioParams` 表单、结果展示和错误展示
- [ ] T032 [P] [US3] 在 `demo/src/index.css` 或对应样式文件中补充语音转文字面板所需样式，保持现有 demo 视觉结构一致
- [ ] T033 [US3] 在 `specs/036-voice-to-text/quickstart.md` 记录 demo 验证步骤、预期结果和当前 `speech/transcriptions` 样例风险提示

**Checkpoint**: US3 完成后，浏览器 demo 已具备可见的语音转文字验证入口

---

## Phase 6: Polish & Cross-Cutting

**Purpose**: 收尾验证、文档同步、版本治理与提交

- [ ] T034 [P] 同步 036 设计文档到实现现实 `specs/036-voice-to-text/research.md`、`specs/036-voice-to-text/data-model.md`、`specs/036-voice-to-text/contracts/voice-to-text.openapi.yaml`、`specs/036-voice-to-text/quickstart.md`
- [ ] T035 [P] 补齐 036 的公开双语注释与文档回归 `src/managers/chat-manager.ts`、`src/types/chat-manager.ts`、`src/types/index.ts`、必要的 `docs/` 文档落点
- [ ] T036 执行 `npm run test:run`、`npm run lint`、`npm run type-check`、`npm run test:gate:pr`，并把 036 相关结果记录到 `specs/036-voice-to-text/quickstart.md`
- [ ] T037 更新版本与变更记录 `package.json`、`package-lock.json`、`CHANGELOG.md`
- [ ] T038 基于 `specs/036-voice-to-text/`、`src/`、`tests/`、`demo/` 提交 036 实现变更（不 push）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 可立即开始
- **Phase 2 (Foundational)**: 依赖 Phase 1 完成，且阻塞所有用户故事
- **Phase 3-5 (User Stories)**: 依赖 Phase 2 完成；建议按 P1 主线先完成 US1、US2，再交付 US3
- **Phase 6 (Polish)**: 依赖已选用户故事完成

### User Story Dependencies

- **US1 (P1)**: Phase 2 完成后即可开始，是 036 的 MVP 主路径
- **US2 (P1)**: 依赖 Phase 2 的共享 speech helper、类型和错误兼容层；建议在 US1 确认公开签名稳定后推进
- **US3 (P2)**: 依赖 US1/US2 的公开 API 已可用，才能在 demo 中接线与做 E2E

### Within Each User Story

- 先补故事级测试并确认当前实现尚未满足新约束
- 再实现 REST / manager / demo / 类型与契约逻辑
- 最后完成故事级独立验证和文档同步

### Parallel Opportunities

- Phase 1 中 `T002`、`T003` 可并行
- Phase 2 中 `T005`、`T006`、`T007`、`T008` 可在 `T004` 风险门禁明确后并行
- US1 中 `T009`、`T010`、`T011` 可并行
- US2 中 `T017`、`T018`、`T019`、`T020` 可并行
- US3 中 `T027`、`T028`、`T029` 可并行
- Polish 中 `T034`、`T035` 可并行

---

## Parallel Example: User Story 1

```bash
Task: "T009 tests/unit/managers/chat-manager-voice-to-text.test.ts"
Task: "T010 tests/unit/rest/speech-transcription.test.ts"
Task: "T011 tests/integration/chat-manager/voice-to-text.integration.test.ts"
```

## Parallel Example: User Story 2

```bash
Task: "T017 tests/unit/managers/chat-manager-voice-to-text.test.ts"
Task: "T018 tests/unit/rest/speech-recognition.test.ts"
Task: "T019 tests/integration/chat-manager/voice-to-text.integration.test.ts"
Task: "T020 tests/integration/miniapp-demo/voice-to-text.integration.test.ts"
```

## Parallel Example: User Story 3

```bash
Task: "T027 tests/e2e/voice-to-text.spec.ts"
Task: "T028 tests/integration/chat-manager/voice-to-text.integration.test.ts"
Task: "T031 demo/src/components/VoiceToTextPanel.tsx"
Task: "T032 demo/src/index.css"
```

---

## Implementation Strategy

### MVP First（建议）

1. 完成 Phase 1-2，先补齐真实样例风险门禁、共享类型和错误兼容层
2. 交付 US1，确保语音消息转写已可独立使用
3. **停止并验证**：确认 `voiceMessageToText` 已满足“旧入参语义 + 新成功返回 + 失败抛兼容 `SDKError`”
4. 再进入 US2，补齐本地文件转写与 `MiniAppFile` 支持
5. 最后交付 US3，接入 demo 和 E2E

### Incremental Delivery

1. Setup + Foundational 打底
2. 交付 US1（语音消息转写）
3. 交付 US2（本地语音文件转写）
4. 交付 US3（demo 面板与浏览器验证）
5. 最后完成文档、验证、版本治理和提交

### Parallel Team Strategy

1. 一人先完成 Phase 1-2
2. Foundation 完成后：
   - 开发者 A：US1 `voiceMessageToText` + transcription 映射
   - 开发者 B：US2 `voiceFileToText` + 上传链路与 `MiniAppFile`
   - 开发者 C：US3 demo 面板与 E2E

---

## Notes

- `[P]` 任务表示不同文件、可并行推进
- 036 的硬门槛是明确 `speech/recognitions` 已确认样例和 `speech/transcriptions` 仍缺真实样例的风险；未补齐前不得伪称 transcription 契约已完全真实对齐
- 本期必须同时满足三层测试要求：unit、integration、E2E
- 实现完成后必须先验证，再更新版本号、`CHANGELOG.md`，最后提交中文 commit
