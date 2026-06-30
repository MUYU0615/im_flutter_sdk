# Integration Mock-Only 测试策略调整计划

## 目标

- 将 `tests/integration` 收敛为 `mock-only`，不再依赖真实后端服务。
- 将 `nightly_full` 从分层门禁中移除真实环境测试，避免前端测试受后端环境波动影响。
- 保留独立的真实环境 smoke 验证能力，但不再归类为 integration，也不进入日常/夜间集成门禁。
- 补齐 `CoreSDK + mock server` 的主链路集成测试，避免去掉 real-env integration 后出现 SDK 主链路覆盖缺口。

## 现状

- 当前分层策略将协议/集成测试定义为“mock 异常链路 + 真实环境核心主链路”。
- `pr_gate`、`nightly_full`、`release_gate` 都会执行 `scripts/test/run-real-env-core.mjs`。
- `tests/integration/mock/*` 已统一复用 `scripts/test/mock-server.mjs`。
- `tests/integration/real-env-core-path.test.ts` 覆盖的是 `CoreSDK` 连接、鉴权、发送、回执与可选下行消息。
- 现有 `tests/integration/mock/*` 主要覆盖协议级场景，尚未完整覆盖 `CoreSDK + mock server` 的 SDK 主链路行为。
- `tests/integration/connection-message.test.ts` 使用进程内 `MockWebSocket`，不符合新的 integration 定义。

## 调整原则

1. `integration` 只验证前端 SDK 与 mock server/本地依赖的协作行为。
2. 真实环境验证保留，但改为独立 smoke，不纳入 integration 与 nightly gate。
3. PR 和 nightly 的失败结论必须只由本地可控测试决定。
4. release 前如需真实环境校验，应作为独立 smoke 或人工/发布校验步骤，不与 integration 混用。

## 计划变更

### 1. 测试目录与职责重划

- 保留 `tests/integration/mock/` 作为 WebSocket/protobuf/mock-server 集成测试主目录。
- 保留 `tests/integration/cache/`，因为它不依赖真实后端，仍符合多模块协作测试定义。
- 将 `tests/integration/real-env-core-path.test.ts`、`tests/integration/real-env.test.ts` 迁移到新的 smoke 目录。
  - 建议目标：`tests/smoke/real-env/`
- 将 `tests/integration/real-env-unreachable-gate.test.ts` 迁出 integration。
  - 建议目标：`tests/smoke/real-env/real-env-retry.test.ts` 或测试治理目录。
- 评估并迁移 `tests/integration/connection-message.test.ts`。
  - 优先方案：迁到 `tests/unit/` 或新建 `tests/component/`。
  - 迁移前不删除，避免直接丢失内部协作回归保护。

### 2. 补齐 mock-only integration 覆盖

- 新增 `CoreSDK + mock server` 主链路集成用例，至少覆盖：
  - 连接 mock server 并完成 provision
  - `sendMessage()` 后收到 ACK，消息状态变为 `sent`
  - mock server 主动下行消息，`EventHub/onMessage` 被触发
  - mock server 返回 provision 失败时，SDK 进入预期失败路径
  - 超时断连、乱序重复 ACK、非法 payload 下，SDK 状态机与错误处理符合预期
- 复用 `scripts/test/mock-server.mjs` 与 `tests/test-utils/layered/mock-server-control.ts`，避免每个测试重复实现服务端。
- 如现有 mock server 场景不足以支撑 SDK 级用例，需要增补场景能力，但仍保持统一脚本入口。

### 3. 脚本与门禁调整

- 更新 `package.json`
  - `test:integration` 只跑 mock-only integration 与本地 integration
  - `test:integration:mock` 继续保留
  - `test:integration:real` 重命名为 `test:smoke:real-env`
- 更新 `scripts/test/run-layered-tests.mjs`
  - `pr_gate` 去掉真实环境步骤
  - `nightly_full` 去掉真实环境步骤
  - `release_gate` 去掉真实环境步骤，避免继续把 real-env 视作 integration
- 保留 `scripts/test/run-real-env-core.mjs`，但定位改为独立 smoke runner
- 如果仓库仍需要真实环境自动化入口，新增单独命令：
  - `npm run test:smoke:real-env`

### 4. 文档与规格同步

- 更新 `docs/testing/testing-architecture.md`
  - 将 integration 定义改为 mock-only/local-only
  - 增加 smoke/真实环境验证的定位说明
- 更新 `docs/testing/testing-layered-strategy.md`
  - 调整 `pr_gate`、`nightly_full`、`release_gate` 矩阵
  - 删除“真实环境属于 integration”的表述
- 更新 `README.md` 中的测试命令与门禁说明
- 补充 `plans/archive` / `specs/023-test-layer-strategy/` 的后续说明，避免旧文档继续误导

## 实施顺序

1. 新增 `CoreSDK + mock server` 主链路集成测试，先补覆盖再迁策略。
2. 迁移 real-env 测试到 `tests/smoke/real-env/`。
3. 调整脚本入口与 gate 编排。
4. 迁移或重分类 `connection-message.test.ts`。
5. 更新文档、版本号、`CHANGELOG.md`，最后提交 `git commit`。

## 风险与应对

- **风险：移除 real-env integration 后，SDK 主链路覆盖下降**
  - 应对：先补 `CoreSDK + mock server` 主链路用例，再迁 real-env。
- **风险：mock server 行为与真实后端漂移**
  - 应对：保留独立 real-env smoke，作为非 integration 的补充验证。
- **风险：旧测试目录语义混乱**
  - 应对：明确迁目录，不保留“real-env 还挂在 integration 里”的折中状态。
- **风险：门禁策略变化影响现有 CI 预期**
  - 应对：同步更新脚本、文档与 contract test，确保 gate 行为可验证。

## 验证

- `npm run test:run -- tests/integration/mock`
- `npm run test:run -- tests/integration`
- `npm run test:gate:pr`
- `npm run test:gate:nightly`
- `npm run lint`
- `npm run type-check`
- 如保留独立真实环境验证入口，再单独执行：`npm run test:smoke:real-env`

## 待确认

- `release_gate` 是否也一并移除真实环境自动化，仅保留 mock-only gate。
- `connection-message.test.ts` 最终迁到 `tests/unit/` 还是新增 `tests/component/`。
