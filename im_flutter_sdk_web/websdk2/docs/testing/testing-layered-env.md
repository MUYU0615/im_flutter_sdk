# 分层测试环境变量说明

## 目标

本文档定义当前测试分层方案所需环境变量，覆盖 mock-only integration、独立真实环境 smoke 与 E2E 门禁执行场景。

## 真实环境变量（smoke）

| 变量名                   | 是否必填 | 说明                            |
| ------------------------ | -------- | ------------------------------- |
| `EASEMOB_APPKEY`         | 是       | 应用标识                        |
| `EASEMOB_USERID`         | 是       | 测试用户 ID                     |
| `EASEMOB_TOKEN`          | 是       | 测试用户 token                  |
| `EASEMOB_TARGET_ID`      | 否       | 发送消息目标 ID，默认回环到自己 |
| `EASEMOB_EXPECT_INBOUND` | 否       | `1` 表示必须等待入站消息回调    |

## 分层门禁变量

| 变量名                 | 是否必填 | 说明                                               |
| ---------------------- | -------- | -------------------------------------------------- |
| `LAYERED_GATE_STRICT`  | 否       | `1` 时开启严格门禁，gate 中的 mock/E2E 失败会阻断  |
| `LAYERED_EVIDENCE_DIR` | 否       | 失败证据输出目录，默认 `coverage/layered-evidence` |

## 真实环境 smoke 扩展变量

| 变量名                    | 是否必填 | 说明                              |
| ------------------------- | -------- | --------------------------------- |
| `REAL_ENV_RETRY_MAX`      | 否       | 真实环境 smoke 重试次数，默认 `2` |
| `REAL_ENV_RETRY_DELAY_MS` | 否       | smoke 重试间隔毫秒，默认 `3000`   |

## mock server 变量（协议/集成）

| 变量名                | 是否必填 | 说明                                              |
| --------------------- | -------- | ------------------------------------------------- |
| `MOCK_SERVER_PORT`    | 否       | mock server 监听端口，默认 `19360`                |
| `MOCK_SERVER_WS_PATH` | 否       | mock WebSocket 路径，默认 `/websocket`            |
| `MOCK_SCENARIO`       | 否       | 可选默认场景（测试通常通过 `/scenario` 动态设置） |

## E2E 变量

| 变量名         | 是否必填 | 说明                                           |
| -------------- | -------- | ---------------------------------------------- |
| `E2E_BASE_URL` | 否       | E2E 页面访问地址，默认 `http://127.0.0.1:5173` |
| `E2E_MODE`     | 否       | `nightly` 或 `release`，用于门禁模式区分       |

## 建议

- PR / Nightly / Release gate 推荐启用：`LAYERED_GATE_STRICT=1`
- 本地快速验证可关闭严格模式：`LAYERED_GATE_STRICT=0`
- 真实环境 smoke 建议在本地或独立 workflow 中按需执行，不与集成门禁绑定
- 真实环境凭证通过 `.env` 或 CI Secret 注入，避免写入仓库
