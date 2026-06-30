---
description: '018 跨平台适配层实现任务清单'
---

# Tasks: SDK 跨平台适配层（小程序 / uni-app / Electron / React Native）

**Input**: 设计文档来自 `/specs/018-cross-platform-adapter/`  
**Prerequisites**: plan.md（必需）、spec.md（必需）、research.md、data-model.md、contracts/、quickstart.md  
**Tests**: 需要，包含单元测试、契约测试与关键回归验证  
**Organization**: 任务按用户故事分组，支持独立实现与独立验证

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行（不同文件、无前置依赖）
- **[Story]**: 仅用户故事阶段使用（`[US1]...[US5]`）
- 每个任务描述都包含明确文件路径

## Phase 1: Setup（共享准备）

**Purpose**: 建立 018 开发所需目录、基线文件与构建入口

- [x] T001 创建适配层目录骨架 `src/platform/`、`src/platform/{runtime,request,upload,socket,proto,storage}/`
- [x] T002 创建适配层公共导出入口 `src/platform/index.ts`
- [x] T003 [P] 创建适配层核心类型文件 `src/platform/types.ts`
- [x] T004 [P] 创建适配层工厂占位 `src/platform/factory.ts`
- [x] T005 [P] 创建跨平台测试目录 `tests/unit/platform/` 与 `tests/contract/platform/`

---

## Phase 2: Foundational（阻塞基础）

**Purpose**: 完成所有用户故事共享的基础能力（未完成前禁止进入 US 实现）

**⚠️ CRITICAL**: 此阶段完成后，用户故事才能并行推进

- [x] T006 定义 `PlatformAdapterProfile` 与能力注册模型于 `src/platform/types.ts`
- [x] T007 [P] 定义统一错误契约与 fail-fast 初始化规则于 `src/platform/types.ts`
- [x] T008 [P] 实现平台识别策略（显式优先 + 运行时探测）于 `src/platform/factory.ts`
- [x] T009 [P] 实现适配器注入与默认装配流程于 `src/platform/factory.ts`
- [x] T010 在 `src/index.ts` 导出适配层能力（不破坏现有 API）
- [x] T011 [P] 新增基础单测：平台识别/注入/fail-fast 于 `tests/unit/platform/factory.test.ts`
- [x] T012 [P] 新增契约测试骨架（对应 `contracts/sdk-platform-compat.openapi.yaml`）于 `tests/contract/platform/compat-contract.test.ts`

**Checkpoint**: 适配层基础能力可用，后续用户故事可并行

---

## Phase 3: User Story 1 - 一套 API 覆盖多端基础文本消息闭环（Priority: P1）

**Goal**: 同一业务 API 在多端可完成初始化、登录、建连、文本收发

**Independent Test**: 在任一目标平台完成“初始化→登录→连接→发送文本→收到回调”，无需业务层写平台分支

### Tests for User Story 1

- [x] T013 [P] [US1] 新增适配层文本链路单测 `tests/unit/platform/text-flow.test.ts`
- [x] T014 [P] [US1] 新增连接状态语义一致性测试 `tests/unit/platform/connection-state-unify.test.ts`

### Implementation for User Story 1

- [x] T015 [P] [US1] 实现默认 Web RequestAdapter 于 `src/platform/request/web-request-adapter.ts`
- [x] T016 [P] [US1] 实现默认 Web SocketAdapter 于 `src/platform/socket/web-socket-adapter.ts`
- [x] T017 [P] [US1] 实现默认 RuntimeAdapter（网络/前后台）于 `src/platform/runtime/web-runtime-adapter.ts`
- [x] T018 [US1] 在 `src/platform/factory.ts` 注册并装配 Web 默认适配器
- [x] T019 [US1] 在 `src/core/index.ts` 接入适配层请求/连接能力（保持现有对外 API 不变）
- [x] T020 [US1] 在 `src/chat-client.ts` 接入适配层工厂初始化与生命周期绑定

**Checkpoint**: US1 可独立完成并验证

---

## Phase 4: User Story 2 - 附件消息上传跨端语义一致（Priority: P1）

**Goal**: 统一附件上传输入与进度/成功/失败/取消回调语义

**Independent Test**: 不同平台附件源对象均可完成上传并返回统一结果语义

### Tests for User Story 2

- [x] T021 [P] [US2] 新增上传源规范化测试 `tests/unit/platform/upload-source-normalize.test.ts`
- [x] T022 [P] [US2] 新增上传回调语义一致性测试 `tests/unit/platform/upload-callback-unify.test.ts`

### Implementation for User Story 2

- [x] T023 [P] [US2] 定义统一上传源模型与转换器 `src/platform/upload/upload-source.ts`
- [x] T024 [P] [US2] 实现 Web UploadAdapter（复用现有 XHR 能力）`src/platform/upload/web-upload-adapter.ts`
- [x] T025 [US2] 在 `src/upload/attachment-uploader.ts` 接入 UploadAdapter 抽象
- [x] T026 [US2] 在 `src/upload/utils.ts` 完成 `File/path/uri` 三类输入的统一规范化
- [x] T027 [US2] 统一上传错误映射与进度事件结构 `src/platform/upload/upload-error-mapper.ts`

**Checkpoint**: US2 可独立完成并验证

---

## Phase 5: User Story 3 - 长连接与生命周期事件跨端一致（Priority: P1）

**Goal**: 网络变化、前后台切换、异常断连时对外语义一致

**Independent Test**: 离线恢复、前后台切换、异常断连三类场景下事件序列一致

### Tests for User Story 3

- [x] T028 [P] [US3] 新增网络变化到连接恢复测试 `tests/unit/platform/network-recover.test.ts`
- [x] T029 [P] [US3] 新增前后台切换探测测试 `tests/unit/platform/foreground-check.test.ts`

### Implementation for User Story 3

- [x] T030 [P] [US3] 抽象运行时生命周期事件桥接 `src/platform/runtime/runtime-event-bridge.ts`
- [x] T031 [US3] 在 `src/core/index.ts` 使用 RuntimeAdapter 替代直接 `window/document` 监听
- [x] T032 [US3] 在 `src/core/connection/connection-manager.ts` 对齐跨平台重连触发语义
- [x] T033 [US3] 统一连接状态事件映射与去重策略 `src/platform/runtime/connection-event-normalizer.ts`

**Checkpoint**: US3 可独立完成并验证

---

## Phase 6: User Story 4 - 小程序受限环境编解码一致（Priority: P2）

**Goal**: 单一静态 protobuf 方案跨平台可用，消息语义一致

**Independent Test**: 同一样本消息在多端 encode/decode 关键字段一致

### Tests for User Story 4

- [x] T034 [P] [US4] 新增静态 protobuf 编解码一致性样本测试 `tests/unit/protocol/protobuf-static-compat.test.ts`
- [x] T035 [P] [US4] 新增编解码初始化失败 fail-fast 测试 `tests/unit/platform/proto-fail-fast.test.ts`

### Implementation for User Story 4

- [x] T036 [P] [US4] 定义 ProtoAdapter 接口与注册器 `src/platform/proto/proto-adapter.ts`
- [x] T037 [P] [US4] 接入静态 protobuf codec 到 ProtoAdapter `src/platform/proto/static-proto-adapter.ts`
- [x] T038 [US4] 在 `src/protocol/msync/root.ts` 与相关调用链切换为单一静态方案入口
- [x] T039 [US4] 在 `src/platform/factory.ts` 强制同版本单一编解码策略并移除运行时回退分支

**Checkpoint**: US4 可独立完成并验证

---

## Phase 7: User Story 5 - 平台能力可扩展与可注入（Priority: P2）

**Goal**: 支持自定义适配器注入与非默认平台扩展

**Independent Test**: 注入自定义适配器后无需改业务 API 即可运行

### Tests for User Story 5

- [x] T040 [P] [US5] 新增自定义适配器注入测试 `tests/unit/platform/custom-adapter-injection.test.ts`
- [x] T041 [P] [US5] 新增关键能力缺失 fail-fast 错误契约测试 `tests/unit/platform/missing-capability-init.test.ts`

### Implementation for User Story 5

- [x] T042 [P] [US5] 扩展工厂支持 overrides 注入 `src/platform/factory.ts`
- [x] T043 [US5] 新增平台能力校验器 `src/platform/capability-validator.ts`
- [x] T044 [US5] 在 `src/chat-client.ts` 暴露适配器注入配置入口（保持向后兼容默认值）
- [x] T045 [US5] 文档化扩展入口与错误语义 `docs/architecture/cross-platform-sdk-plan.md`

**Checkpoint**: US5 可独立完成并验证

---

## Phase 8: Polish & Cross-Cutting

**Purpose**: 跨用户故事收尾、回归与发布

- [x] T046 [P] 补充 018 quickstart 验收记录 `specs/018-cross-platform-adapter/quickstart.md`
- [x] T047 [P] 更新 API 文档中的跨平台说明 `docs/reference/api.md`
- [x] T048 运行目标测试集合并修复问题 `npm run test:run -- tests/unit/platform tests/unit/protocol`
- [x] T049 运行全量 lint 并修复问题 `npm run lint`
- [x] T050 更新版本号与 CHANGELOG `package.json`、`package-lock.json`、`CHANGELOG.md`
- [x] T051 提交实现变更（不 push）

---

## Phase 9: Service Worker 请求兼容补充（2026-02-28）

**Purpose**: 补充 018 的 Service Worker 运行时请求兼容能力，确保无 `XMLHttpRequest` 环境可用

- [x] T052 [US1] 调整运行时识别与默认装配，允许 Worker 场景走 Web 请求适配能力 `src/platform/factory.ts`
- [x] T053 [US1] 为 Web UploadAdapter 增加无 `XMLHttpRequest` 场景的 `fetch` 兜底 `src/platform/upload/web-upload-adapter.ts`
- [x] T054 [P] [US1] 新增 Service Worker 请求/上传兜底测试 `tests/unit/platform/service-worker-request-fallback.test.ts`
- [x] T055 [US1] 执行相关测试并更新文档版本信息 `specs/018-cross-platform-adapter/tasks.md`、`CHANGELOG.md`、`package.json`、`package-lock.json`
- [x] T056 [US1] 提交本次补充实现（不 push）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 可立即开始
- **Phase 2 (Foundational)**: 依赖 Phase 1 完成，且阻塞所有用户故事
- **Phase 3-7 (User Stories)**: 依赖 Phase 2 完成；可并行或按优先级推进
- **Phase 8 (Polish)**: 依赖已选用户故事完成

### User Story Dependencies

- **US1 (P1)**: Phase 2 后可开始，作为 MVP 主路径
- **US2 (P1)**: 依赖 Phase 2；与 US1 可并行，但需要复用 US1 的适配层骨架
- **US3 (P1)**: 依赖 Phase 2；与 US1/US2 并行
- **US4 (P2)**: 建议在 US1 基础链路稳定后推进
- **US5 (P2)**: 依赖工厂与类型稳定，建议 US1 完成后推进

### Within Each User Story

- 先写测试（应先失败）
- 再实现模型/适配器
- 再接入核心链路
- 最后做故事级独立验证

### Parallel Opportunities

- Phase 1、2 中所有标记 `[P]` 的任务可并行
- Phase 2 完成后，US1/US2/US3 可以多人与多分支并行推进
- US4 与 US5 可在 P1 主路径稳定后并行推进

---

## Parallel Example: User Story 2

```bash
# 并行执行（不同文件）
Task: "T021 tests/unit/platform/upload-source-normalize.test.ts"
Task: "T022 tests/unit/platform/upload-callback-unify.test.ts"
Task: "T023 src/platform/upload/upload-source.ts"
Task: "T024 src/platform/upload/web-upload-adapter.ts"
```

---

## Implementation Strategy

### MVP First（先交付 P1 核心）

1. 完成 Phase 1 + Phase 2
2. 完成 US1（文本消息跨端闭环）
3. 完成 US2（附件上传统一语义）
4. 完成 US3（连接生命周期统一）
5. 进行一次 P1 验收与回归

### Incremental Delivery

1. P1 三个故事先达成可发布增量
2. 再追加 US4（单一静态 protobuf）
3. 最后完成 US5（扩展注入能力）
4. 每个故事完成后可独立演示与验收

### Team Parallel Strategy

- 开发 A：US1 + 工厂接入
- 开发 B：US2 上传链路
- 开发 C：US3 生命周期事件
- 开发 D：US4 编解码策略 + US5 注入机制

---

## Notes

- 所有任务遵循 `- [ ] Txxx [P] [USx] 描述+路径` 规范
- 用户故事阶段必须保留 `[USx]` 标签，便于追踪与独立验收
- 每次较大变更后先执行故事级测试，再执行全量回归
- 每次迭代按规则更新版本号与 CHANGELOG，并提交 commit
