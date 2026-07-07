---
name: native-auto-test-framework
description: 当处理 native-auto-test 的真实 SDK E2E、跨平台互测、新 API 或新平台适配、SDK 版本回归、覆盖统计、测试报告时使用。
---

# Native Auto Test Framework

## 使用边界

`native-auto-test` 是 SDK 发版测试主工程。有效覆盖必须证明真实 SDK 和真实服务链路：

```text
test -> WebSocket -> im_flutter_test -> im_flutter_sdk_interface
-> platform wrapper -> native SDK -> SDK server -> native SDK
-> im_flutter_test -> WebSocket -> test
```

wrapper mapping、fixture、mock、local adapter、unit 只能作为辅助验证，不能算真实 SDK E2E。

## 执行入口

正式发版测试使用统一入口：

```bash
cd native-auto-test
make e2e-full-run ARGS="--client android:a@4.23.0 --client android:b@4.23.0 --run-id <run_id> --platform-matrix android-android --install-mode clean --matrix-mode pair --account-mode fresh"
```

`android-android` 矩阵已接入真实 Android runner：会启动 relay、执行 `adb reverse`、卸载旧 App、启动两个 `im_flutter_test` 客户端、下发 `Client.init`、执行 pytest，并生成 HTML、Allure、case-results 和 API gap backlog。其他矩阵仍处在通用 prepare/run/coverage 阶段，不要把它描述成已经完成真实设备编排。

阶段调试才拆开执行：

- `make e2e-prepare ARGS="..."`：准备环境和 `out/run/<run_id>/context.yaml`。
- `make e2e-run ARGS="..."`：执行 pytest，输出 HTML、Allure、case-results。
- `make e2e-api-coverage ARGS="..."`：基于 case-results 和扫描结果输出 API 覆盖缺口。

直接 `pytest` 只用于低层调试，不作为正式发版报告入口。

Android 已有一个固定代表性基线入口：

```bash
cd native-auto-test
make android-real-sanity ARGS="--device-ids emulator-5554 emulator-5558 --run-id <run_id>"
```

它会读取 `config/android_sanity_cases.txt`，执行一组已验证过的正式 Android `real_e2e` case，用于快速确认 runner、登录/startCallback、联系人前置和基础消息链是否正常。需要回归更大范围前，优先先跑这组 sanity。

`make android-real-e2e` 是底层 Android runner 调试入口，用于只验证单个 case、设备连接或 runner 启动链路；正式发版报告优先使用 `e2e-full-run`，代表性基线优先使用 `android-real-sanity`。

## 环境和 Case 分层

环境准备负责：

- 启动 WebSocket relay/server。
- 选择并启动真实平台客户端。
- Android 需要时执行 `adb reverse`、卸载旧 App、安装或覆盖安装 App。
- 等待 bridge ready。
- 登录前下发 `Client.init`。
- 绑定账号、topic、设备角色和 SDK 版本。

case 负责：

- 调用 SDK API。
- 等待同步响应和 SDK callback/event。
- 断言发送端结果、接收端事件、服务端状态或本地状态。
- 覆盖参数错误、权限错误、状态错误等反向路径。

不要在 case 中散落 relay 启动、App 安装、SDK init 或设备编排逻辑。

## 配置规则

- `native-auto-test/config.yaml` 是本地敏感配置唯一来源，包含 app key、REST 凭据、账号和 `sdk_options`。
- `sdk_options` 由 `src/tools/sdk_options_resolver.py` 转换后通过 WebSocket `Client.init` 下发。
- 不要恢复 `native-auto-test/flutter_config.yaml`、`im_flutter_test/assets/config.yaml` 或 `im_flutter_test/lib/sdk_config_loader.dart`。
- SDK 版本、SDK 来源、版本差异、平台专属和暂不覆盖原因写入 `native-auto-test/config/sdk_version_capability_policy.yaml`。
- 每个 client 必须能解析出 SDK 版本；版本来自 `--client <platform>:<slot>@<version>` 或 `--sdk-version <platform>=<version>`。

## 登录和回调

- DNS、SDK init 或登录整体失败时，本次真实 E2E 应直接判为环境失败，后续 API case 不再继续。
- 任何地方调用 login 后，`im_flutter_test` 必须立刻调用 `startCallback`。
- `startCallback` 是 Flutter 测试 App 的回调桥保护措施，不写进原生 SDK 或业务 case。

## 新 API / 新平台流程

1. 先确认当前测试版本的真实原生 SDK 是否存在该 API。
2. 再确认 Flutter wrapper 是否暴露到 MethodKey 或等价入口。
3. 补齐 `im_flutter_sdk_interface`、Dart model、事件序列化和平台实现。
4. 补齐 `native-auto-test` 的 cmd/event key、能力配置或扫描映射。
5. 增加真实 E2E case，至少覆盖成功路径、关键参数、错误路径和事件/状态证据。
6. 更新报告，让缺失、未实现、不适用、版本差异、服务未开通等原因用中文可见。

平台差异不要写成散落 skip；应进入版本能力策略或覆盖统计。

## 报告要求

每次有效执行都要在 `native-auto-test/out/` 下生成两类结果：

- SDK API 级覆盖表：回答原生 SDK API 是否被 wrapper 和真实 E2E 覆盖。
- 测试用例结果表：回答本次 run 哪些 case 通过、失败或阻塞。

日志放在 `out/log/<platform>/` 或 `out/log/<platform-matrix>/`。生成报告、审计结果和临时产物不要放入 `docs/`、`tests/` 或 skill 目录。

## 相关入口

- 项目规则：`native-auto-test/AGENTS.md`
- 命令总览：`cd native-auto-test && make help`
- Android 原生 API 覆盖专项：使用 `android-api-coverage` skill。
