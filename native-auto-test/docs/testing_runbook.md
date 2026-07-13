# Native Auto Test 测试运行手册

本文是 `native-auto-test/` 的长期运行手册，说明如何准备环境、如何执行真实 SDK E2E、如何查看报告，以及常用脚本应该怎么运行。

## 1. 测试目标

`native-auto-test` 通过 WebSocket 控制 `im_flutter_test`，再经 Flutter SDK wrapper 调用真实原生 SDK 和真实服务。有效 E2E 必须证明真实链路：

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
-> pytest assertion
```

wrapper mapping、fixture、mock、local adapter、unit test 只能作为辅助验证，不能算真实 SDK E2E 覆盖。

## 2. 本地准备

### 2.1 Python 依赖

```bash
cd native-auto-test
python3 -m pip install -r requirements.txt
make help
```

`make help` 能列出当前可执行入口，优先通过 Makefile 调脚本。

### 2.2 本地配置

```bash
cd native-auto-test
cp config.yaml.template config.yaml
```

`config.yaml` 是本地敏感配置唯一来源，至少需要确认：

- `app_key`、REST 凭据和服务器配置正确。
- 测试账号存在，常用账号密码按本地环境填写。
- `sdk_options` 包含当前环境需要的初始化参数。
- 不提交 `config.yaml`，不把密钥写进 topology、context、报告或文档。

SDK 版本、SDK 来源、平台能力差异写在：

```text
native-auto-test/config/sdk_version_capability_policy.yaml
```

### 2.3 Flutter 测试 App

Android 运行前建议先确认测试 App 可构建：

```bash
cd im_flutter_test
flutter analyze
flutter build apk --debug
```

`im_flutter_test` 不读取本地 yaml 配置。SDK 初始化参数由 runner 在登录前通过 WebSocket `Client.init` 下发。

### 2.4 Android 设备

完整 Android topology 当前需要三个可用设备。常用绑定：

```text
primary_a = emulator-5554
primary_b = emulator-5556
remote_c  = emulator-5560
```

检查设备：

```bash
adb devices -l
adb -s emulator-5554 shell getprop sys.boot_completed
adb -s emulator-5556 shell getprop sys.boot_completed
adb -s emulator-5560 shell getprop sys.boot_completed
```

如果出现 DNS、SDK init、登录或大量 `onDisconnected`，本次运行应判为环境失败，先修环境再跑业务 case。

## 3. Android 正式 E2E

正式全量入口只使用 topology：

```bash
cd native-auto-test
RUN_ID=android-full-$(date +%Y%m%d-%H%M%S)
make e2e-full-run ARGS="--topology config/topologies/android-primary-dual-remote.yaml --device primary_a=emulator-5554 --device primary_b=emulator-5556 --device remote_c=emulator-5560 --run-id ${RUN_ID} --install-mode clean -- --target-platform android"
```

topology 语义：

- `primary_a`：Android SDK client，登录 primary 账号。
- `primary_b`：Android SDK client，登录同一个 primary 账号，用于同账号多设备同步证据。
- `remote_c`：真实 SDK client，登录 remote 账号，用于账号间交互证据。

消息类 case 的典型证据：

- `remote_c` 向 primary 账号发消息，`primary_a` 和 `primary_b` 都应收到。
- `primary_a` 向 `remote_c` 发消息，`primary_a` 应收到发送成功，`primary_b` 应收到同账号同步，`remote_c` 应收到对端消息。
- 账号内状态变化只应在 `primary_a` / `primary_b` 间同步，不应把账号内状态事件发给 `remote_c`。

## 4. 快速验证和单 case 调试

Android sanity 用于先确认 runner、登录、`startCallback`、联系人前置和基础消息链正常：

```bash
cd native-auto-test
RUN_ID=android-sanity-$(date +%Y%m%d-%H%M%S)
make android-real-sanity ARGS="--device-ids emulator-5554 emulator-5556 --run-id ${RUN_ID}"
```

单 case 调试：

```bash
cd native-auto-test
RUN_ID=android-debug-$(date +%Y%m%d-%H%M%S)
make android-real-e2e ARGS="--device-ids emulator-5554 emulator-5556 --run-id ${RUN_ID} -- tests/chat/test_chat_reaction_fetch.py::test_chat_add_reaction_invalid_id_response --target-platform android -m real_e2e -q"
```

单 case 调试只用于定位问题。正式报告仍以 `e2e-full-run --topology` 为准。

## 5. 报告查看

Android runner 默认生成：

```text
out/run/<run_id>/context.yaml
out/run/<run_id>/topology.resolved.yaml
out/run/<run_id>/preflight.json
out/log/android/<run_id>-android-pytest.html
out/log/android/<run_id>-allure-results/
out/test-results/<run_id>-case-results.json
out/test-results/<run_id>-case-results.csv
out/api-coverage/<run_id>-gap-backlog.csv
```

`allure-results/` 是原始 JSON 结果目录，不能直接用浏览器打开。需要生成静态报告并启动本地服务：

```bash
cd native-auto-test
allure generate out/log/android/<run_id>-allure-results -o out/log/android/<run_id>-allure-report --clean
python3 -m http.server 8035 --bind 127.0.0.1 --directory out/log/android/<run_id>-allure-report
```

浏览地址：

```text
http://127.0.0.1:8035/
```

每次让 agent 跑 case 后，应单独启动一个 Allure 服务，并把 URL、pytest HTML 路径、allure-results 路径和关键日志路径返回给用户。

## 6. API 覆盖统计

Android 原生 API 覆盖统计：

```bash
cd native-auto-test
make android-api-coverage
```

常见产物：

```text
out/android-4.23-native-api-coverage.html
out/android-4.23-native-api-coverage.csv
out/android-4.23-wrapper-platform-alignment.html
out/android-4.23-wrapper-platform-alignment.csv
out/android-wrapper-274-completion-plan.md
```

覆盖表用于回答“SDK API 是否已被 wrapper 和真实 E2E 覆盖”。测试结果表用于回答“本次执行哪些 case 通过、失败、跳过或阻塞”。两类表不能互相替代。

## 7. 常用脚本入口

所有脚本优先通过 Makefile 调用。

| 入口 | 用途 | 示例 |
|---|---|---|
| `make ws-call` | 手动调用一个 SDK manager/cmd。 | `make ws-call MANAGER=ChatManager CMD=getUnreadMessageCount DEVICE=primary_a` |
| `make ws-wait` | 手动等待某个 cmd 响应或 event。 | `make ws-wait DEVICE=primary_a EVENT=onMessagesReceived TIMEOUT=20` |
| `make create-users` | 通过 REST 创建用户。 | `make create-users USERS='du001 du002' PASSWORD=1` |
| `make delete-user` | 通过 REST 删除用户。 | `make delete-user USERNAME=du001` |
| `make contact-establish` | 建立好友关系。 | `make contact-establish INITIATOR_DEVICE=primary_a PEER_DEVICE=remote_c USER_A=du001 USER_B=du002` |
| `make contact-delete` | 删除好友。 | `make contact-delete INITIATOR_DEVICE=primary_a FRIEND_USER_ID=du002 KEEP_CONVERSATION=1` |
| `make contact-block` | 加入黑名单。 | `make contact-block DEVICE=primary_a USER_ID=du002` |
| `make contact-unblock` | 移出黑名单。 | `make contact-unblock DEVICE=primary_a USER_ID=du002` |
| `make e2e-full-run` | 正式 E2E 总入口。 | 见第 3 节。 |
| `make android-real-sanity` | Android 代表性基线。 | 见第 4 节。 |
| `make android-real-e2e` | Android 单点调试。 | 见第 4 节。 |
| `make android-api-coverage` | Android API 覆盖统计。 | 见第 6 节。 |

## 8. 用例编写和治理规则

用例编写规范见：

```text
native-auto-test/docs/case_authoring_guide.md
```

核心要求：

- 真实 E2E case 必须有 `@pytest.mark.real_e2e`。
- 每个真实 E2E case 必须有中文编号步骤，便于手动复现。
- 文件名使用业务语义，不使用 `s1`、`s23`、`s423` 这类历史阶段编号。
- 普通 case 不应调用 logout，避免破坏共享 session。
- 事件等待必须用业务字段过滤，不能只按 `eventType` 消费第一条事件。
- 发送成功后的消息 id 以最终成功事件为准，不使用发送时临时 id 断言接收方事件。

## 9. 产物清理

生成产物统一放在 `native-auto-test/out/`，平台日志放在 `native-auto-test/out/log/<platform>/`。

清理生成产物：

```bash
cd native-auto-test
make clean
```

不要把生成报告、历史 case 台账、agent 临时计划放进 `docs/`、`tests/` 或 skill 目录。长期设计说明放 `native-auto-test/docs/spec/`；根目录 `docs/` 只保留共享 SDK 级文档。
