# Tasks: 工程测试分层规范

**Input**: 设计文档来自 `/specs/023-test-layer-strategy/`  
**Prerequisites**: `plan.md`（必需）、`spec.md`（必需）、`research.md`、`data-model.md`、`contracts/`、`quickstart.md`

**Tests**: 本特性本身即测试体系建设，必须包含测试任务。  
**Organization**: 任务按用户故事分组，保证每个故事可独立实现、独立验证、独立交付。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行执行（不同文件、无前置依赖冲突）
- **[Story]**: 用户故事标签（`[US1]`、`[US2]`、`[US3]`）
- 每条任务描述都包含明确文件路径

## Phase 1: Setup（共享基础准备）

**Purpose**: 创建三层测试目录与执行入口，补齐 E2E 基础依赖与命令骨架。

- [x] T001 创建测试分层目录骨架 `tests/e2e/`、`tests/integration/mock/`、`tests/test-utils/layered/`、`scripts/test/`
- [x] T002 更新测试脚本入口（`test:gate:pr`、`test:gate:nightly`、`test:gate:release`、`test:e2e`）到 `package.json`
- [x] T003 [P] 新增 Playwright 基础配置文件 `playwright.config.ts`
- [x] T004 [P] 新增 E2E 环境说明与参数模板 `tests/e2e/README.md`
- [x] T005 补充测试环境变量说明（真实环境 + 分层门禁）到 `docs/testing/testing-layered-env.md`

---

## Phase 2: Foundational（阻塞性前置能力）

**Purpose**: 构建所有用户故事共享的执行编排、数据隔离、失败证据与策略模型。

**⚠️ CRITICAL**: 本阶段完成前不得开始任何用户故事实现。

- [x] T006 实现分层执行策略类型与常量（`pr_gate`/`nightly_full`/`release_gate`）于 `tests/test-utils/layered/execution-policy.ts`
- [x] T007 [P] 实现场景目录与风险等级定义于 `tests/test-utils/layered/scenario-catalog.ts`
- [x] T008 [P] 实现测试数据隔离工具（账号池、前缀、清理）于 `tests/test-utils/layered/test-data-scope.ts`
- [x] T009 [P] 实现失败证据结构化记录工具于 `tests/test-utils/layered/failure-evidence.ts`
- [x] T010 实现真实环境重试与阻断判定工具于 `tests/test-utils/layered/real-env-retry.ts`
- [x] T011 实现分层门禁编排脚本于 `scripts/test/run-layered-tests.mjs`
- [x] T012 新增分层执行编排契约测试于 `tests/contract/test-layer-orchestrator.contract.test.ts`

**Checkpoint**: 分层编排与基础治理能力可用，用户故事可并行推进。

---

## Phase 3: User Story 1 - 协议链路真实可用验证（Priority: P1） 🎯 MVP

**Goal**: 在真实测试环境中稳定验证连接、鉴权、收发、回执核心主链路，并纳入 PR 阻断门禁。  
**Independent Test**: 执行 `npm run test:smoke:real-env` 时，真实环境核心链路用例可通过；环境不可达重试后会输出明确证据。

### Tests for User Story 1

- [x] T013 [P] [US1] 新增真实环境核心主链路测试（连接/鉴权/发/收/回执）于 `tests/smoke/real-env/real-env-core-path.test.ts`
- [x] T014 [P] [US1] 新增真实环境不可达重试后阻断测试于 `tests/smoke/real-env/real-env-retry.test.ts`
- [x] T015 [US1] 为真实环境门禁结果补充证据断言于 `tests/contract/real-env-gate-evidence.contract.test.ts`

### Implementation for User Story 1

- [x] T016 [P] [US1] 抽离真实环境连接与发送复用工具于 `tests/test-utils/layered/real-env-runner.ts`
- [x] T017 [US1] 重构现有真实联调测试入口为核心链路用例集于 `tests/smoke/real-env/real-env.test.ts`
- [x] T018 [US1] 实现真实环境门禁执行脚本（含重试策略调用）于 `scripts/test/run-real-env-core.mjs`
- [x] T019 [US1] 将 US1 场景接入分层编排器 `pr_gate` 流程于 `scripts/test/run-layered-tests.mjs`

**Checkpoint**: US1 可独立通过并形成可阻断的 PR 核心门禁（MVP）。

---

## Phase 4: User Story 2 - 异常场景稳定复现与回归（Priority: P1）

**Goal**: 通过 mock server 稳定注入高风险异常，形成可重复回归的协议/集成异常测试层。  
**Independent Test**: 执行 mock 异常用例套件时，超时/断连/乱序/非法响应均能稳定复现并得到预期处理结果。

### Tests for User Story 2

- [x] T020 [P] [US2] 新增 mock 超时与断连异常测试于 `tests/integration/mock/mock-timeout-disconnect.test.ts`
- [x] T021 [P] [US2] 新增 mock 乱序与重复响应测试于 `tests/integration/mock/mock-outoforder-duplicate.test.ts`
- [x] T022 [P] [US2] 新增 mock 非法响应与协议异常测试于 `tests/integration/mock/mock-invalid-payload.test.ts`
- [x] T023 [US2] 新增异常场景证据完整性断言于 `tests/contract/mock-failure-evidence.contract.test.ts`

### Implementation for User Story 2

- [x] T024 [P] [US2] 实现可编排异常注入的 mock server 于 `scripts/test/mock-server.mjs`
- [x] T025 [P] [US2] 实现 mock 场景启动与清理工具于 `tests/test-utils/layered/mock-server-control.ts`
- [x] T026 [US2] 实现异常场景目录与 mock server 行为映射于 `tests/test-utils/layered/mock-scenario-map.ts`
- [x] T027 [US2] 将 US2 场景接入分层编排器 `pr_gate` 与 `nightly_full` 流程于 `scripts/test/run-layered-tests.mjs`

**Checkpoint**: US2 异常链路可独立回归，且不依赖真实环境异常复现。

---

## Phase 5: User Story 3 - 浏览器端真实 demo 主链路验证（Priority: P2）

**Goal**: 使用无头浏览器自动验证真实 demo 页面在真实测试环境下的初始化、登录连接、文本消息发送与登出主链路。  
**Independent Test**: 执行 `npm run test:e2e` 可完成真实 demo 的初始化登录、无效 `AppKey` 失败、文本消息发送成功、登出恢复等关键场景并产出结构化结果。

### Tests for User Story 3

- [x] T028 [P] [US3] 重写 E2E 初始化与连接场景为真实 demo 初始化、登录连接与无效 `AppKey` 失败验证于 `tests/e2e/init-connect.spec.ts`
- [x] T029 [P] [US3] 重写 E2E 消息收发场景为真实 demo 文本消息发送成功验证于 `tests/e2e/send-receive.spec.ts`
- [x] T030 [P] [US3] 新增真实 demo 登出恢复场景于 `tests/e2e/logout.spec.ts`
- [x] T031 [US3] 新增 E2E 发布前门禁判定测试于 `tests/contract/release-gate-e2e.contract.test.ts`
- [x] T041 [P] [US3] 为真实 demo 初始化与登录场景增加根目录 `.env` 凭证校验与严格模式失败逻辑于 `tests/e2e/fixtures/sdk-flow.ts`
- [x] T042 [P] [US3] 为真实 demo 发送场景补充日志与消息列表成功断言于 `tests/e2e/send-receive.spec.ts`
- [x] T043 [P] [US3] 为真实 demo 页面补充稳定 E2E 测试锚点于 `demo/src/App.tsx`、`demo/src/components/InitPanel.tsx`、`demo/src/components/LoginPanel.tsx`、`demo/src/components/SendPanel.tsx`、`demo/src/components/LogPanel.tsx`、`demo/src/components/MessagePanel.tsx`
- [x] T044 [US3] 移除不再满足目标的 harness 页面入口与旧场景文件于 `demo/src/main.tsx`、`demo/src/test-harness.tsx`、`tests/e2e/network-recover.spec.ts`、`tests/e2e/snapshot-consistency.spec.ts`

### Implementation for User Story 3

- [x] T032 [P] [US3] 为真实 demo 页面提供可稳定编排的测试锚点与运行摘要区域于 `demo/src/App.tsx` 及相关组件
- [x] T033 [US3] 重写 E2E 场景公共操作封装，改为驱动真实 demo 页面与真实环境凭证于 `tests/e2e/fixtures/sdk-flow.ts`
- [x] T034 [US3] 实现 E2E 执行脚本（定时/发布前模式）于 `scripts/test/run-e2e-gate.mjs`
- [x] T035 [US3] 将 US3 场景接入分层编排器 `nightly_full` 与 `release_gate` 流程于 `scripts/test/run-layered-tests.mjs`
- [x] T045 [US3] 扩展 E2E 公共夹具能力（状态读取、登录成功/失败等待、发送成功与登出等待）于 `tests/e2e/fixtures/sdk-flow.ts`
- [x] T046 [US3] 为 E2E 增加本地 demo 自动启动能力（`webServer`）于 `playwright.config.ts`
- [x] T047 [US3] 更新 E2E 场景说明文档为真实 demo + 真实环境说明于 `tests/e2e/README.md`

**Checkpoint**: US3 浏览器真实 demo 主链路可独立执行并可作为发布前门禁。

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 收敛跨故事事项，固化 CI、文档、验收与发布信息。

- [x] T036 [P] 新增分层门禁 CI 工作流（PR/定时/发布前）于 `.github/workflows/layered-test-gates.yml`
- [x] T037 [P] 更新工程测试策略文档与执行矩阵于 `docs/testing/testing-layered-strategy.md`
- [x] T038 在 `README.md` 补充分层测试命令入口与门禁说明
- [x] T039 执行 `specs/023-test-layer-strategy/quickstart.md` 全流程自检并回填结果到 `specs/023-test-layer-strategy/quickstart.md`
- [x] T040 更新版本号与变更日志于 `package.json`、`package-lock.json`、`CHANGELOG.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1（Setup）**: 无依赖，可立即开始
- **Phase 2（Foundational）**: 依赖 Phase 1，且阻塞所有用户故事
- **Phase 3~5（User Stories）**: 全部依赖 Phase 2 完成
- **Phase 6（Polish）**: 依赖目标用户故事完成后执行

### User Story Dependencies

- **US1（P1）**: 仅依赖 Foundational，可先作为 MVP 交付
- **US2（P1）**: 依赖 Foundational；与 US1 可并行，但建议在 US1 稳定后合并到 PR 门禁
- **US3（P2）**: 依赖 Foundational；建议在 US1/US2 稳定后接入发布前门禁

### Within Each User Story

- 先编写并执行故事测试任务，再完成实现任务
- 场景定义/工具层先于脚本接入
- 脚本接入先于门禁策略合并

### Parallel Opportunities

- Phase 1 的 T003/T004/T005 可并行
- Phase 2 的 T007/T008/T009 可并行
- US1 的 T013/T014 可并行
- US2 的 T020/T021/T022 及 T024/T025 可并行
- US3 的 T028/T029/T030 及 T032 可并行
- Phase 6 的 T036/T037 可并行

---

## Parallel Example: User Story 2

```bash
# 并行启动 US2 异常测试编写
Task: "T020 [US2] tests/integration/mock/mock-timeout-disconnect.test.ts"
Task: "T021 [US2] tests/integration/mock/mock-outoforder-duplicate.test.ts"
Task: "T022 [US2] tests/integration/mock/mock-invalid-payload.test.ts"

# 并行实现 mock 注入能力
Task: "T024 [US2] scripts/test/mock-server.mjs"
Task: "T025 [US2] tests/test-utils/layered/mock-server-control.ts"
```

---

## Implementation Strategy

### MVP First（仅 US1）

1. 完成 Phase 1 + Phase 2
2. 完成 Phase 3（US1）
3. 验证 `pr_gate` 可稳定阻断并给出失败证据
4. 先交付“真实核心链路可自动化阻断”的最小价值

### Incremental Delivery

1. MVP（US1）
2. 增量接入 US2 异常回归
3. 最后接入 US3 浏览器 E2E 与发布前门禁
4. 每个阶段都保持可独立验证与可回滚

### Parallel Team Strategy

1. 全员先完成 Phase 1 + Phase 2
2. 开发者 A 负责 US1、开发者 B 负责 US2、开发者 C 负责 US3
3. 通过分层编排器统一汇总执行结果与失败证据

---

## Notes

- 所有 `[P]` 任务需保证文件无冲突且依赖已满足
- 每个用户故事都可独立完成并独立验收
- 若真实环境不可达，必须遵循“重试后阻断”规则，不允许静默跳过
- 每个阶段完成后建议单独提交一次，降低回滚成本
