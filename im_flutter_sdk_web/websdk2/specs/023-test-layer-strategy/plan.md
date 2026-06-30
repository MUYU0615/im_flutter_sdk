# Implementation Plan: 工程测试分层规范

**Branch**: `023-test-layer-strategy` | **Date**: 2026-03-06 | **Spec**: `specs/023-test-layer-strategy/spec.md`  
**Input**: Feature specification from `/specs/023-test-layer-strategy/spec.md`

## Summary

本特性在保留现有单元测试的前提下，将协议/集成测试收敛为 mock-only / local-only 场景，并用独立真实环境 smoke 补充真实接入验证；浏览器 E2E 继续负责真实 demo 关键用户流。门禁策略采用“PR 阶段阻断单元 + mock 集成；Nightly / Release 执行单元 + mock 集成 + E2E”。真实环境验证不再进入 gate，而是保留独立 smoke 入口与失败证据输出。

## Technical Context

**Language/Version**: TypeScript 5.x（strict）  
**Primary Dependencies**: vitest、@vitest/coverage-v8、Playwright（E2E）、现有 CoreSDK/EventHub/协议编解码模块  
**Storage**: N/A（不引入业务持久化，仅依赖测试环境数据与测试日志产物）  
**Testing**: Vitest（unit/integration/contract/types）+ Playwright（headless E2E）  
**Target Platform**: Node.js 18+ CI Runner、Chromium Headless、现有 Web SDK demo 页面  
**Project Type**: 单仓库 SDK 库项目（`src/` + `tests/` + `demo/`）  
**Performance Goals**: PR 快速门禁（单元 + mock 集成）整体耗时 <= 10 分钟  
**Constraints**: E2E 不作为每次 PR 必跑项；E2E 定时执行且主干发布前必过；真实环境验证保留为独立 smoke；异常链路以 mock 为主  
**Scale/Scope**: 覆盖三层 gate 测试治理（单元保留、协议/集成增强、E2E 引入）+ 独立真实环境 smoke；不包含线上合成监控

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

验证本实现方案是否符合 IM SDK Web Constitution 的核心原则：

- [x] **性能优先**: 分层门禁策略将重型 E2E 从 PR 快速门禁中解耦，保障核心验证效率与非阻塞执行
- [x] **类型安全**: 测试场景目录、环境画像、执行结果模型均采用 TypeScript strict 类型约束（规划阶段无 `any`）
- [x] **测试驱动**: 本特性本质为测试体系建设，优先定义可执行验收路径与失败判定
- [x] **可靠性**: 引入 mock 主链路验证 + 独立真实环境 smoke + E2E 生命周期验证，提升故障发现能力
- [x] **可扩展性**: 三层职责边界清晰，可按场景目录增量扩展而不破坏现有测试资产
- [x] **可观测性**: 要求失败证据统一输出（层级、场景、原因、时间），便于回归定位
- [x] **版本管理**: 按 SemVer、CHANGELOG 与提交规范执行文档与实施变更治理

如存在违反原则的情况，必须在 Complexity Tracking 中说明理由。

## Project Structure

### Documentation (this feature)

```text
specs/023-test-layer-strategy/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── test-layer-orchestrator.openapi.yaml
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── core/
├── managers/
├── protocol/
├── platform/
└── utils/

tests/
├── unit/
├── integration/
├── smoke/
├── contract/
├── types/
└── e2e/                 # 本特性新增，承载 Playwright 场景

demo/
└── src/components/

scripts/
└── test/                # 本特性新增，承载 mock server 与分层执行脚本
```

**Structure Decision**: 采用单仓库结构，延续 `src/ + tests/ + demo/` 组织；在 `tests/e2e/` 与 `scripts/test/` 增量落地新测试层，不拆分子项目。

## Phase 0: Research

输出：`specs/023-test-layer-strategy/research.md`

- 明确三层测试边界与职责（单元、协议/集成、E2E）
- 明确 PR/定时/发布前门禁策略与触发时机
- 明确真实环境不可达时的重试与失败判定策略
- 明确 mock server 的异常注入方式与覆盖范围
- 明确测试数据隔离与失败证据归档的最小标准

## Phase 1: Design & Contracts

输出：

- `specs/023-test-layer-strategy/data-model.md`
- `specs/023-test-layer-strategy/contracts/test-layer-orchestrator.openapi.yaml`
- `specs/023-test-layer-strategy/quickstart.md`

设计要点：

1. 建立 `TestLayerDefinition / ScenarioCatalog / ExecutionPolicy / FailureEvidence` 等核心实体
2. 建立“mock 主链路 + mock 异常链路 + E2E 用户链路 + 独立 real-env smoke”的覆盖矩阵
3. 建立 smoke 不可达重试与可诊断输出规范
4. 定义测试执行编排契约，支持 PR 快速门禁、定时执行、发布前门禁
5. 明确数据隔离策略（测试账号、会话前缀、清理钩子）与结果追溯策略

## Agent Context Update

执行命令：

```bash
SPECIFY_FEATURE=023-test-layer-strategy .specify/scripts/bash/update-agent-context.sh codex
```

预期：更新 Codex 上下文中的活跃技术与近期特性记录，确保后续 `/speckit.tasks` 与实现阶段上下文一致。

## Phase 2: Task Planning Approach

由 `/speckit.tasks` 继续拆解任务，按以下主线生成：

1. 分层测试目录与脚本骨架（含 PR gate profile）
2. mock server 场景注入能力与异常回归用例
3. 独立真实环境 smoke 用例与环境重试策略
4. Playwright E2E 场景（初始化、连接、收发、断网恢复）
5. 测试数据隔离、失败证据结构化输出与 CI 集成
6. 文档、版本号与 CHANGELOG 更新

## Complexity Tracking

无额外豁免项。
