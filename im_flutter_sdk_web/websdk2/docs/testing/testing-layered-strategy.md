# 工程测试分层策略（023）

## 概览

本策略将工程测试拆为三层：

1. 单元测试（`unit`）：纯逻辑校验，快速反馈。
2. 协议/集成测试（`protocol_integration`）：mock server / 本地依赖驱动的 SDK 协作链路。
3. 浏览器 E2E（`e2e_browser`）：无头浏览器驱动真实 demo 页面并验证真实环境关键用户路径。
4. 真实环境 smoke（`smoke_real_env`）：独立验证真实环境接入可用性，不纳入 integration gate。

## 门禁矩阵

| 策略           | 单元 | 协议/集成（mock/local-only） | E2E                    | 阻断规则     |
| -------------- | ---- | ---------------------------- | ---------------------- | ------------ |
| `pr_gate`      | 必跑 | 必跑                         | 不跑                   | 阻断         |
| `nightly_full` | 必跑 | 必跑                         | 必跑                   | 阻断并留证据 |
| `release_gate` | 必跑 | 必跑                         | 必跑（需最近通过记录） | 阻断         |

## 执行入口

- `npm run test:integration`
- `npm run test:integration:mock`
- `npm run test:smoke:real-env`
- `npm run test:gate:pr`
- `npm run test:gate:nightly`
- `npm run test:gate:release`
- `npm run test:e2e`

说明：

- `test:integration` 只运行 `tests/integration` 下的 mock-only / local-only 集成测试。
- `test:gate:pr`、`test:gate:nightly`、`test:gate:release` 中的 integration 步骤同样覆盖 `tests/integration` 下的 mock-only / local-only 集成测试，而不再只限于 `tests/integration/mock`。
- `test:smoke:real-env` 复用 `scripts/test/run-real-env-core.mjs`，依赖 `.env` 中的真实环境凭证，作为独立 smoke 验证入口。

## mock 协议层实现说明

- mock 服务由 `scripts/test/mock-server.mjs` 提供，测试执行时自动拉起并自动关闭。
- 控制面为 HTTP（`/health`、`/scenario`），数据面为 WebSocket（`/websocket`）。
- WebSocket 数据面使用 protobuf `MSync/Provision/CommSync`，覆盖：
  - `NORMAL_FLOW`：provision 成功、SYNC ACK、下行消息推送
  - `MOCK_PROVISION_REJECTED`：provision 被拒绝，SDK 连接失败
  - `MOCK_TIMEOUT_DISCONNECT`：发送 SYNC 后超时并断连
  - `MOCK_OUTOFORDER_DUPLICATE`：ACK 乱序且重复
  - `MOCK_INVALID_PAYLOAD`：返回非法 protobuf 包体

## 失败证据

失败证据默认输出到：

```text
coverage/layered-evidence/failures.ndjson
```

每条记录至少包含：

- `runId`
- `layerId`
- `scenarioId`
- `failureType`
- `message`
- `occurredAt`
- `retryCount`

## 真实环境 smoke

- 真实环境验证保留为独立 smoke，不纳入 `pr_gate`、`nightly_full`、`release_gate`。
- smoke 只覆盖真实环境接入可用性与核心主路径，不承担日常集成回归职责。
- 真实环境不可达时，smoke 入口会保留重试与失败证据，但不会影响 mock/local-only integration 结论。

## 关键规则

- 协议/集成层默认只依赖 mock server 或本地可控依赖，不依赖真实后端。
- `CoreSDK + mock server` 主链路必须覆盖连接、provision、ACK、下行消息等关键协作。
- E2E 定时执行，发布前严格模式下必须满足最近通过记录。
- 浏览器 E2E 以真实 demo 主链路为主，不承担大量协议异常覆盖。
