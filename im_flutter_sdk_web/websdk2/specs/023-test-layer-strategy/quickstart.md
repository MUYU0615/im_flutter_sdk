# 023 快速验证指南（Phase 1）

## 目标

验证三层测试策略可执行并符合已澄清规则：

- 保留单元测试
- PR 门禁阻断：单元 + mock 协议集成
- E2E 定时执行，主干发布前必过
- 真实环境 smoke 独立执行，不进入 gate
- 异常链路由 mock 覆盖

## 前置准备

1. 安装依赖：

```bash
npm install
```

2. 准备真实环境变量（项目根目录 `.env` 或 CI Secret）：

```env
EASEMOB_APPKEY=...
EASEMOB_USERID=...
EASEMOB_TOKEN=...
EASEMOB_TARGET_ID=...
EASEMOB_EXPECT_INBOUND=0
```

3. 确保 demo 页面可被无头浏览器访问（本地或 CI 临时服务）。

## 步骤 1：单元测试基线

```bash
npm run test:run -- tests/unit
```

期望：单元测试通过，作为基础质量门禁。

## 步骤 2：协议/集成层（mock 异常场景）

```bash
npm run test:run -- tests/integration/mock
```

期望：

- mock WebSocket + protobuf 场景（正常链路、超时断连、乱序重复 ACK、非法 payload）可稳定复现
- 每个异常场景都有可验证的期望结果

## 步骤 3：真实环境 smoke（独立执行）

```bash
npm run test:smoke:real-env
```

期望：

- 连接、鉴权、发消息、收消息、回执主链路通过
- 环境不可达时触发自动重试；重试后失败应输出明确诊断原因

## 步骤 4：浏览器 E2E（无头）

```bash
npx playwright test tests/e2e --project=chromium
```

期望：

- 真实 demo 页面可完成初始化、登录连接、文本消息发送、登出关键流程
- 填写无效 `AppKey` 时会明确失败，不会出现“假通过”
- 日志中可追溯场景 ID 与失败原因

## 步骤 5：按策略执行（PR / 定时 / 发布前）

示例策略：

1. `pr_gate`：步骤 1 + 步骤 2
2. `nightly_full`：步骤 1 + 步骤 2 + 步骤 4
3. `release_gate`：要求最近一次步骤 4 通过，且当前 `pr_gate` 通过

## 验收清单（对应 spec）

- 核心协议主链路自动化覆盖率：100%
- 约定高风险异常场景（mock）覆盖率：100%
- PR 门禁耗时：<= 10 分钟
- 失败定位信息完整率：100%
- E2E 关键链路稳定通过率：>= 95%

## 常见失败定位

- 真实环境 smoke 不可达：优先检查环境变量、网络连通性与测试账号有效性。
- mock 场景不稳定：检查异常注入是否与场景目录一一对应。
- E2E 偶发失败：检查真实环境凭证、页面等待条件与测试数据隔离策略。
- 门禁超时：检查是否误把全量 E2E 纳入 PR 快速门禁。

## 实测记录（2026-03-09）

- `npm run test:run -- tests/integration/mock`：通过（mock-only integration）
- `npm run test:run -- tests/integration/mock tests/contract/mock-failure-evidence.contract.test.ts tests/contract/release-gate-e2e.contract.test.ts`：通过（mock/contract）
- `LAYERED_GATE_STRICT=1 npm run test:gate:pr`：应通过（单元 + mock/contract）
- `npm run test:smoke:real-env`：按需执行，用于独立验证真实环境主链路
