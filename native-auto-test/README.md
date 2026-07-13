# Native Auto Test

`native-auto-test` 是 Flutter SDK 发版测试主工程，用 Python pytest 驱动多个 `im_flutter_test` 客户端，通过真实 SDK 和真实服务链路验证 Android、iOS、HMOS、Windows、Web 以及后续新增平台的 SDK 能力。

完整 E2E 信道：

```text
native-auto-test
-> WebSocket relay
-> im_flutter_test
-> im_flutter_sdk_interface
-> platform wrapper
-> native SDK
-> SDK server
-> native SDK
-> im_flutter_test
-> WebSocket response/event
-> native-auto-test assertions
```

测试端既要校验调用端同步返回，也要校验 SDK callback/event、服务端状态或本地状态。缺参、非法类型、权限错误、状态冲突等反向 case 也必须通过同一通道返回并断言。

## 目录结构

| 路径 | 作用 |
|---|---|
| `tests/` | 可执行 pytest 用例。 |
| `src/` | WebSocket client、runner、断言、REST、覆盖统计工具。 |
| `config/` | 能力配置、topology、版本能力策略、覆盖配置。 |
| `scripts/` | WebSocket、REST 用户、Contact flow 等辅助工具。 |
| `docs/` | 长期人类说明。生成报告不放入 docs。 |
| `out/` | 所有生成产物、HTML 报告、CSV、日志、审计结果。 |

Agent 执行规范统一维护在项目 skill：

```text
../.agents/skills/native-auto-test-framework/SKILL.md
```

## 核心文档

| 文档 | 用途 |
|---|---|
| `docs/testing_runbook.md` | 如何准备环境、如何测试、如何看报告、脚本如何运行。 |
| `docs/case_authoring_guide.md` | 用例命名、中文步骤、事件等待、断言和治理规则。 |
| `config/sdk_version_capability_policy.yaml` | 当前 SDK 版本、SDK 来源、版本差异、平台能力策略。 |
| `docs/spec/topology_e2e_redesign_spec.md` | topology E2E 设计背景。当前执行以 runbook 为准。 |
| `docs/spec/event_isolation_spec.md` | 事件隔离和消息匹配设计背景。当前执行以 runbook 为准。 |

## 快速入口

查看可执行任务：

```bash
cd native-auto-test
make help
```

准备本地敏感配置：

```bash
cd native-auto-test
cp config.yaml.template config.yaml
```

Android 正式真实 E2E 使用 topology：

```bash
cd native-auto-test
RUN_ID=android-full-$(date +%Y%m%d-%H%M%S)
make e2e-full-run ARGS="--topology config/topologies/android-primary-dual-remote.yaml --device primary_a=emulator-5554 --device primary_b=emulator-5556 --device remote_c=emulator-5560 --run-id ${RUN_ID} --install-mode clean -- --target-platform android"
```

Android sanity：

```bash
cd native-auto-test
RUN_ID=android-sanity-$(date +%Y%m%d-%H%M%S)
make android-real-sanity ARGS="--device-ids emulator-5554 emulator-5556 --run-id ${RUN_ID}"
```

Android API 覆盖统计：

```bash
cd native-auto-test
make android-api-coverage
```

完整准备、执行、报告和脚本说明见 `docs/testing_runbook.md`。

## 报告产物

每次有效发版测试至少要有两类输出：

1. SDK API 级覆盖表：以原生 SDK API 为主线，记录平台、SDK 版本、封装状态、真实 E2E 覆盖状态、关联 case 和中文原因。
2. 测试用例结果表：以本次执行为主线，记录日期时间、run_id、平台、设备组合、case、结果、失败摘要、关联 API、日志路径和 HTML 报告路径。

产物统一输出到 `out/`，平台日志放到 `out/log/<platform>/`。不要把生成报告、临时台账或 agent 计划放进 `docs/`、`tests/` 或 skill 目录。

## 用例要求摘要

完整规范见 `docs/case_authoring_guide.md`。关键约束：

- 默认全量必须是真实 SDK E2E，不是 wrapper mapping、fixture、local adapter 或 unit。
- 平台必须显式写真实名称，不要用 `mobile` 替代 Android/iOS/Web/HMOS/Windows。
- 每个真实 E2E case 必须有中文编号步骤，便于手动复现。
- 普通 case 不应调用 logout，避免破坏共享 session。
- 断言使用最强稳定证据：同步响应、发送端 callback、同账号同步、对端事件、服务端状态或本地状态。
- 事件等待必须用业务字段过滤，不能只按 `eventType` 消费第一条事件。
- 禁止用实际结果构造预期，禁止只断言 `is not None`、Promise 完成或 WebSocket 有响应。

## 项目 Skills

当前只保留两个项目 skill：

- `native-auto-test-framework`：真实 SDK E2E、跨平台互测、发版测试、报告和版本回归主入口。
- `android-api-coverage`：Android 原生 SDK API 到 Flutter wrapper 和自动化覆盖的专项统计。

辅助工具放在 `scripts/`，不要恢复旧模块级 skill 或 `docs/agents` 台账。
