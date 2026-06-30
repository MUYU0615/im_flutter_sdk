# 023 数据模型（Phase 1）

## 1) TestLayerDefinition

- **描述**: 三层 gate 测试能力定义，约束每层目标、触发策略与通过标准，并补充独立 smoke 验证。
- **关键字段**:
  - `layerId`: 层级标识（`unit` / `protocol_integration` / `e2e_browser` / `smoke_real_env`）
  - `goal`: 层级目标说明
  - `entry`: 执行入口（脚本或命令标识）
  - `gatePolicy`: 门禁策略（`pr_required` / `scheduled` / `release_required`）
  - `scopeBoundary`: 覆盖边界说明
- **校验规则**:
  - 每个 `layerId` 必须唯一
  - 每层必须定义至少一个独立验收场景

## 2) ScenarioCatalog

- **描述**: 测试场景目录，统一维护主链路与异常链路场景。
- **关键字段**:
  - `scenarioId`: 场景唯一标识（如 `REAL_CONNECT_SEND_ACK`）
  - `layerId`: 所属测试层
  - `category`: 场景类别（`happy_path` / `error_path` / `recovery`）
  - `riskLevel`: 风险等级（`high` / `medium` / `low`）
  - `preconditions`: 前置条件列表
  - `expectedOutcome`: 期望结果描述
- **校验规则**:
  - `scenarioId` 全局唯一
  - `high` 风险场景必须至少定义一条自动化用例

## 3) EnvironmentProfile

- **描述**: 测试环境画像，定义真实环境与 mock 环境能力。
- **关键字段**:
  - `profileId`: 环境标识（`real_test_env` / `mock_env` / `browser_e2e_env`）
  - `availabilityRequirement`: 可用性要求
  - `retryPolicy`: 重试策略（最大次数、间隔）
  - `credentialsRef`: 凭证来源标识（环境变量名集合）
  - `failureHandling`: 不可达时的处理规则
- **校验规则**:
  - 真实环境 `failureHandling` 必须包含“重试后阻断”语义
  - 环境定义必须指向可审计的凭证来源

## 4) TestDataScope

- **描述**: 测试数据隔离策略，避免不同场景相互污染。
- **关键字段**:
  - `scopeId`: 数据作用域标识
  - `accountPool`: 账号池引用
  - `conversationPrefix`: 会话或消息前缀规则
  - `cleanupPolicy`: 清理策略（`after_each` / `after_suite`）
  - `parallelismLevel`: 并行等级限制
- **校验规则**:
  - 不同并行分片必须具备可区分的数据前缀
  - 清理策略必须与场景粒度对应

## 5) ExecutionPolicy

- **描述**: 分层执行策略定义，控制 PR、定时、发布前运行集合；真实环境 smoke 独立于 gate。
- **关键字段**:
  - `policyId`: 策略标识（`pr_gate` / `nightly_full` / `release_gate`）
  - `includedLayers`: 包含层级列表
  - `requiredScenarios`: 必过场景列表
  - `timeoutBudgetMinutes`: 时长预算
  - `passCriteria`: 通过判定规则
- **校验规则**:
  - `pr_gate` 必须包含 `unit` 与 `protocol_integration`
  - `release_gate` 必须包含 `e2e_browser` 最近一次通过要求

## 6) FailureEvidence

- **描述**: 失败证据模型，用于定位与回归分析。
- **关键字段**:
  - `runId`: 执行批次 ID
  - `layerId`: 失败所在层级
  - `scenarioId`: 失败场景 ID
  - `failureType`: 失败类型（`assertion` / `env_unreachable` / `timeout` / `protocol_mismatch`）
  - `message`: 失败摘要
  - `occurredAt`: 失败时间
  - `retryCount`: 重试次数
- **校验规则**:
  - 每条失败必须关联 `layerId` 与 `scenarioId`
  - 真实环境 smoke 不可达必须归类为 `env_unreachable`

## 关系说明

- `ExecutionPolicy` 通过 `includedLayers` 关联多个 `TestLayerDefinition`
- `ScenarioCatalog` 依赖 `TestLayerDefinition` 标识所属层
- `EnvironmentProfile` 与 `ExecutionPolicy` 组合决定 gate 执行可达性；`smoke_real_env` 独立输出验证结果
- `TestDataScope` 为 `ScenarioCatalog` 提供隔离上下文
- `FailureEvidence` 回溯到 `ExecutionPolicy`、`TestLayerDefinition` 与 `ScenarioCatalog`

## 状态流转

### 测试运行状态（TestRunState）

- `queued` -> `running`
- `running` -> `passed`
- `running` -> `failed`
- `running` -> `blocked`（例如真实环境重试后仍不可达）

### 场景执行状态（ScenarioState）

- `pending` -> `executing`
- `executing` -> `passed`
- `executing` -> `failed`
- `executing` -> `skipped`（仅策略显式允许时）
