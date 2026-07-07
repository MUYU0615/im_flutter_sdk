# Native Auto Test

`native-auto-test` 是 Flutter SDK 发版测试主工程，用 Python pytest 驱动多个 `im_flutter_test` 客户端，通过真实 SDK 和真实服务链路验证 Android、iOS、HMOS、Windows、Web 以及后续新增平台的 SDK 能力。

完整 E2E 信道：

```text
test -> WebSocket server -> im_flutter_test(client1)
-> im_flutter_sdk_interface -> platform wrapper -> native SDK
-> SDK server -> native SDK -> im_flutter_test(client2)
-> WebSocket server -> test
```

测试端既要校验 client1 的同步调用结果，也要校验 client2 的 SDK callback/event、服务端状态或本地状态。缺参、非法类型、权限错误、状态冲突等反向 case 也应通过同一通道返回并断言。

## 目录结构

| 路径 | 作用 |
|---|---|
| `tests/` | 可执行 pytest 用例。 |
| `src/` | WebSocket client、runner、断言、REST、覆盖统计工具。 |
| `config/` | 能力配置、版本能力策略、覆盖配置。 |
| `scripts/` | WebSocket、REST 用户、Contact flow 等辅助工具。 |
| `docs/` | 长期人类说明。生成报告不放入 docs。 |
| `out/` | 所有生成产物、HTML 报告、CSV、日志、审计结果。 |

Agent 执行规范统一维护在项目 skill：`.agents/skills/native-auto-test-framework/SKILL.md`。

## 配置

复制本地配置：

```bash
cp config.yaml.template config.yaml
```

`config.yaml` 是 E2E 初始化和控制端敏感信息的唯一事实源，可包含 app key、REST 凭据、WebSocket 地址、测试账号和 `sdk_options`，不应提交。SDK 初始化参数、指定服务器地址、DNS 开关等由 runner 在登录前通过 `Client.init` 下发给客户端。

配置边界：

- `native-auto-test/config.yaml.template`：可提交模板，只写占位值和字段说明。
- `native-auto-test/config.yaml`：本地真实配置，已被 `.gitignore` 忽略。
- `src/tools/sdk_options_resolver.py`：负责把 `config.yaml.sdk_options` 校验并转换成 bridge `Client.init` JSON。
- `im_flutter_test/`：只接收 WebSocket 下发的 init 参数，不读取 yaml，不打包 SDK options。
- `im_flutter_test/assets/`：只允许放测试媒体等非敏感素材，不允许放 `assets/config.yaml`。
- `native-auto-test/flutter_config.yaml`、`im_flutter_test/lib/sdk_config_loader.dart`：旧设计文件，不应恢复。

版本能力策略维护在：

```text
config/sdk_version_capability_policy.yaml
```

这里记录当前测试平台版本、SDK 来源/下载地址、按版本新增/变更/移除的 API、平台差异、暂不覆盖和平台专属能力。它不保存 app key、REST token、账号密码或服务器私密配置。Android 4.23.0 只是当前追平阶段的本次基线，不是永久基线。

### 版本能力策略字段说明

`sdk_version_capability_policy.yaml` 是“当前测什么版本、SDK 从哪里来、哪些 API 因版本或平台差异暂不覆盖”的维护入口。它不手写维护全量 API 表；全量 API 应由真实 SDK 扫描、wrapper 扫描和 case 扫描生成。

#### `test_versions`

描述本次发版测试采用哪些平台、哪些 SDK 版本。

| 字段 | 含义 | 使用方式 |
|---|---|---|
| `baseline_platform` | 本次 API 对齐的基准平台。当前追平阶段用 `android`。 | API 覆盖工具优先以该平台真实 SDK 扫描结果作为主基线。 |
| `purpose` | 这组版本配置的说明。 | 写清本次为什么这样选版本，例如“Android 4.23.0 追平基线”。 |
| `platforms.<platform>.version` | 当前测试的平台 SDK 版本。 | runner 和覆盖工具按这个版本生成有效覆盖策略。 |
| `platforms.<platform>.enabled` | 当前是否参与本次测试。 | `false` 表示预留平台或本轮不执行。 |
| `platforms.<platform>.role` | 平台角色，常用 `baseline` 或 `target`。 | `baseline` 用于主基线，`target` 用于对齐或回归。 |
| `platforms.<platform>.source_ref` | 指向 `sdk_sources.<platform>.versions` 中某条 SDK 来源记录的引用键。 | 用来把“当前测试版本”绑定到具体 SDK 下载地址、源码位置或本地 artifact 提示。 |

`source_ref` 不是 SDK API，也不是版本号本身。它只是一个稳定引用键。例如：

```yaml
test_versions:
  platforms:
    android:
      version: "4.23.0"
      source_ref: android-4.23.0

sdk_sources:
  android:
    versions:
      android-4.23.0:
        version: "4.23.0"
        download_url: "..."
```

这样后续切到 `4.24.0` 时，只需要把 `version` 和 `source_ref` 指到新的来源记录，工具就能知道当前应扫描或下载哪个 SDK。

#### `sdk_sources`

描述各平台 SDK 的来源。

| 字段 | 含义 | 使用方式 |
|---|---|---|
| `sdk_sources.<platform>.artifact` | SDK 包名、Pod 名、npm 包名或内部 artifact 名。 | 供工具和人工确认依赖来源。 |
| `source_dir` | 当前仓库内对应平台 wrapper 或源码目录。 | 用于扫描 wrapper、MethodKeys 或平台实现。 |
| `download_url_template` | SDK 下载地址模板。 | 多版本可共用模板时填写，例如包含 `{version}`。 |
| `docs_url` | SDK 官方文档或 release note 地址。 | 用于追溯 API 来源。 |
| `versions.<source_ref>.version` | 某条 SDK 来源记录对应的真实 SDK 版本。 | 应与 `test_versions.platforms.<platform>.version` 对齐。 |
| `versions.<source_ref>.download_url` | 该版本 SDK 的明确下载地址。 | 方便补 API 或切版本时直接获取 SDK。 |
| `versions.<source_ref>.local_artifact_hint` | 本地 artifact 查找提示。 | 例如 Gradle cache、CocoaPods cache、vendor 目录。 |

#### `api_changes`

按版本记录增量 API，不维护全量 API。

| 字段 | 含义 | 使用方式 |
|---|---|---|
| `api_changes.<version>.release_note_url` | 该版本 release note 或来源链接。 | 用于追溯新增/变更依据。 |
| `<platform>.added` | 该平台该版本新增 API。 | 工具可累加到当前版本应覆盖 API 集。 |
| `<platform>.changed` | 该平台该版本行为或参数变更。 | 用于触发回归或参数 case 补充。 |
| `<platform>.removed` | 该平台该版本移除 API。 | 工具应从目标版本应覆盖 API 集中排除。 |

`added` 可以是字符串，也可以是对象。推荐对象形式：

```yaml
added:
  - api: "ChatManager.saveMessage"
    native: "EMChatManager.saveMessage"
    reason: "Android 4.23.0 新增。"
```

| 字段 | 含义 |
|---|---|
| `api` | Flutter wrapper/API 统计名，通常是 `Manager.cmd`。 |
| `native` | 原生 SDK API 名。 |
| `reason` | 为什么加入本次增量的中文说明。 |

#### `api_policy`

描述单个 API 在不同平台或版本下的策略。这里只记录差异和例外，不写全量覆盖结果。

| 字段 | 含义 | 使用方式 |
|---|---|---|
| `api_policy.<api>.introduced.<platform>` | 该 API 在某平台首次出现的 SDK 版本。 | 判断目标版本是否应该覆盖。 |
| `api_policy.<api>.status.<platform>.status` | 某平台当前策略状态。 | 用于报告中的跳过、不适用、版本差异等分类。 |
| `api_policy.<api>.status.<platform>.reason` | 中文原因。 | HTML/CSV 报告必须输出给测试和发版人员看。 |

常见 `status`：

| 状态 | 含义 |
|---|---|
| `version_gap` | 目标平台当前 SDK 版本低，暂不覆盖。 |
| `platform_only` | 平台专属能力。 |
| `not_applicable` | 该平台不适用。 |
| `known_gap` | 已知缺口，后续补齐。 |
| `blocked` | 环境、服务、权限或依赖阻塞。 |
| `not_in_sdk_version` | 当前 SDK 版本没有该 API。 |
| `required` | 当前版本应覆盖。 |
| `covered` | 已确认覆盖。 |

维护原则：

- 当前测试版本写在 `test_versions`，不要写死在用例里。
- SDK 下载和源码位置写在 `sdk_sources`，不要只写在聊天记录或临时文档里。
- 每个版本只在 `api_changes` 记录新增、变更、移除，不重复维护全量 API。
- 版本差异、平台专属、暂不覆盖写在 `api_policy`，不要散落成 pytest skip。
- 最终是否真的覆盖，以 `out/` 下生成的 API 级覆盖表和测试结果表为准。

## 报告产物

每次有效发版测试至少要有两类输出：

1. SDK API 级覆盖表：以原生 SDK API 为主线，记录平台、SDK 版本、封装状态、真实 E2E 覆盖状态、关联 case 和中文原因。
2. 测试用例结果表：以本次执行为主线，记录日期时间、run_id、平台、设备组合、case、结果、失败摘要、关联 API、日志路径和 HTML 报告路径。

产物统一输出到 `out/`，平台日志放到 `out/log/<platform>/`。推荐 run id：

```text
<platform>-<yyyymmdd-HHMMSS>-<purpose>
```

Android 当前追平 API 报告：

```text
out/android-4.23-native-api-coverage.html
out/android-4.23-native-api-coverage.csv
out/android-4.23-wrapper-platform-alignment.html
out/android-4.23-wrapper-platform-alignment.csv
```

其中 `native-api-coverage` 是原生 API 级主表，`wrapper-platform-alignment` 只是三端 wrapper 对齐辅助表。

## SDK E2E 正式入口

正式发版测试入口是 `e2e-full-run`。

当前已落地的真实环境编排是 `android-android`：入口会委托 Android runner 启动 WebSocket relay、执行 `adb reverse`、卸载旧 App、启动两个 `im_flutter_test` 客户端、登录前下发 `Client.init`、运行 pytest，并在最后生成 API 覆盖缺口文件。

其他平台矩阵仍走通用阶段入口：

```text
e2e_prepare -> e2e_run(pytest) -> e2e_api_coverage
```

通用阶段入口目前主要用于 context、报告路径和后续跨平台编排设计，不应把它当作已经完成 iOS/Web/HMOS/Windows 环境启动的真实 runner。

示例：

```bash
make e2e-full-run ARGS="--client android:a@4.23.0 --client android:b@4.23.0 --run-id android-20260706-153000 --platform-matrix android-android --install-mode clean --matrix-mode pair --account-mode fresh"
```

只跑当前 Android real_e2e 小全集时，可以把 pytest 参数显式透传到 `--` 后：

```bash
make e2e-full-run ARGS="--client android:a@4.23.0 --client android:b@4.23.0 --run-id android-20260706-153000 --platform-matrix android-android --install-mode clean --matrix-mode pair --account-mode fresh -- tests --target-platform android -m 'real_e2e and not web' -q"
```

阶段调试入口：

```bash
make e2e-prepare ARGS="--client android:a@4.23.0 --client android:b@4.23.0 --run-id android-20260706-153000"
make e2e-run ARGS="--run-context out/run/android-20260706-153000/context.yaml --run-id android-20260706-153000 --platform-matrix android-android"
make e2e-api-coverage ARGS="--run-id android-20260706-153000 --case-results out/test-results/android-20260706-153000-case-results.json --output out/api-coverage/android-20260706-153000-gap-backlog.csv"
```

执行分支：

- `--platform-matrix android-android` 且所有 `--client` 都是 Android 时，`e2e-full-run` 会走 Android 专用 runner 分支：
  - 启动 relay
  - 自动选择空闲 relay 端口
  - 模拟器使用 `10.0.2.2`，真机保留 `adb reverse`
  - 启动两个 `im_flutter_test` 客户端
  - 下发 `Client.init`
  - 执行 pytest
  - 生成 Android API gap backlog
- 其他矩阵当前仍走通用三阶段分支：
  - `e2e_prepare`
  - `e2e_run`
  - `e2e_api_coverage`

这两条分支都会生成 `case-results` 和 gap backlog，但只有 Android 专用 runner 目前真正接入了客户端启动、bridge ready 检测和真实设备编排。

参数说明（正式入口）：

| 参数 | 作用 |
|---|---|
| `--client <platform>:<slot>@<version>` | 声明一个测试客户端。`slot` 是测试拓扑角色，不是账号。`@<version>` 是该客户端期望 SDK 版本。 |
| `--sdk-version <platform>=<version>` | 平台级 SDK 版本。可替代 client 上的 `@<version>`，但不能与 client 版本冲突。 |
| `--run-id` | 本次执行 ID，用于关联 context、日志、case-results 和 API coverage。 |
| `--platform-matrix` | 本次执行的平台组合，例如 `android-android`、`android-ios`。 |
| `--matrix-mode` | 用例角色展开方式。第一阶段默认 `pair`。 |
| `--install-mode` | 安装策略。第一阶段写入 context，升级安装另行实现。 |
| `--account-mode` | 账号策略。第一阶段只支持 `fresh`。 |
| `--device-mode` | 设备策略。第一阶段只支持 `existing`。 |
| `--` 后面的 pytest 参数 | 透传给 pytest。Android-Android 矩阵下由 Android runner 执行，并自动补 HTML、Allure 和 case-results 环境变量。 |

第一阶段限制：

- `e2e_prepare` 当前只接受：
  - `--device-mode existing`
  - `--account-mode fresh`
- 如果传入：
  - `--device-mode auto`
  - `--device-mode manual`
  - 未来扩展外的 `--account-mode`
  当前会直接报错，而不是静默降级。
- `--matrix-mode` 虽然支持 `smoke / pair / full` 三个取值，但第一阶段主要先把它写入 context 和报告，只有 `pair` 是当前默认的正式执行模式。
- `--install-mode upgrade` 现在仍主要是 context 层语义，Android 专用 runner 当前稳定验证过的是 `clean` 路径。

版本解析规则：

- 每个 client 最终都必须解析出一个 SDK 版本。
- 版本可以来自：
  - `--client android:a@4.23.0`
  - 或 `--sdk-version android=4.23.0`
- 两边同时写时，不能冲突。
- Android `e2e-full-run` 会把解析出的 Android 版本继续写入 gap backlog 的 `sdk_version` 字段，作为本次报告的版本证据。

直接 `pytest` 只作为低层调试入口，不作为正式覆盖报告入口。正式执行必须能生成：

```text
out/run/<run_id>/context.yaml
out/log/<platform-matrix>/<run_id>-pytest.html
out/log/<platform-matrix>/<run_id>-allure-results/
out/test-results/<run_id>-case-results.json
out/test-results/<run_id>-case-results.csv
out/api-coverage/<run_id>-gap-backlog.csv
```

Android-Android 当前实际日志目录是 `out/log/android/`，例如：

```text
out/log/android/<run_id>-android-pytest.html
out/log/android/<run_id>-allure-results/
```

Context 文件关键信息：

- `out/run/<run_id>/context.yaml` 由 `e2e_prepare` 生成，或由正式入口间接生成。
- 里面至少会写入：
  - `run_id`
  - `matrix_mode`
  - `device_mode`
  - `install_mode`
  - `account_mode`
  - `sdk_initialized`
  - `sdk_options_summary`
  - `clients.<slot>.requested_sdk_version`
  - `clients.<slot>.version_check.status`
- 当前 `version_check.status` 在 prepare 阶段只会先写成 `not_checked`；真正的运行时版本校验，要以后续 runner 或客户端主动回报为准，不要把 prepare 阶段的 context 误读成“已经验证版本一致”。

## Android sanity 入口

如果只是要验证当前 Android 真实 runner、登录回调、联系人准备和基础消息链是否正常，优先使用固定 sanity 入口：

```bash
make android-real-sanity ARGS="--device-ids emulator-5554 emulator-5558 --run-id android-sanity-20260707-001"
```

这个入口会读取 `config/android_sanity_cases.txt`，执行一组已经验证过的正式 Android `real_e2e` case，目前包含：

- `Client.getCurrentUser` 单设备登录 smoke
- `ContactManager.acceptInvitation / getAllContactsFromServer`
- `ChatManager.sendMessage`
- `ChatRoomManager.createChatRoom / fetchChatRoomInfoFromServer`
- `GroupManager.updateGroupAvatar`
- `PresenceManager.publishPresenceWithDescription / presenceSubscribe / fetchPresenceStatus / fetchSubscribedMembersWithPageNum / presenceUnsubscribe`

维护规则：

- `config/android_sanity_cases.txt` 是这组 sanity case 的唯一事实源；需要增删 Android 基线 case 时，只改这个文件。
- `src/tools/android_sanity_runner.py` 只负责读取清单并委托 `android_e2e_runner` 执行，不在代码里硬编码某一条业务 case。
- 新加入 sanity 的 case 必须已经在真实 Android runner 下稳定通过，并且能代表一个明确的 manager 或链路，不把临时调试 case、discover case 或环境脆弱 case 放进来。
- 这组 sanity 的目标是快速确认 runner、`Client.init`、登录后 `startCallback`、联系人前置和基础消息链是否可用；它不是 Android 全量发版回归的替代。

产物位置：

- pytest HTML：`out/log/android/<run_id>-android-pytest.html`
- Allure：`out/log/android/<run_id>-allure-results/`
- case 结果：`out/test-results/<run_id>-case-results.json`、`out/test-results/<run_id>-case-results.csv`

当 sanity 失败时，应先看 HTML 报告和 `out/log/android/` 下同一 `run_id` 的日志，再决定是否进入更大范围的 `e2e-full-run`。

需要临时追加 pytest 参数时，仍然放到 `ARGS` 末尾，例如：

```bash
make android-real-sanity ARGS="--device-ids emulator-5554 emulator-5558 --run-id android-sanity-20260707-001 -- -x"
```

## 常用命令

查看任务：

```bash
make help
```

校验项目 skills：

```bash
make skills-validate
```

生成 Android 当前追平 API 覆盖统计：

```bash
make android-api-coverage
```

运行 Android sanity：

```bash
make android-real-sanity ARGS="--device-ids emulator-5554 emulator-5558 --run-id android-sanity-20260707-001"
```

运行 Android 正式发版 E2E：

```bash
make e2e-full-run ARGS="--client android:a@4.23.0 --client android:b@4.23.0 --run-id android-20260706-153000 --platform-matrix android-android --install-mode clean --matrix-mode pair --account-mode fresh"
```

底层 Android runner 调试：

```bash
make android-real-e2e ARGS="--device-ids emulator-5554 emulator-5558 --run-id android-debug-20260707 -- tests --target-platform android -m real_e2e -q"
```

运行 iOS 真实 E2E：

```bash
make ios-real-e2e
```

运行 Web 真实 E2E：

```bash
make web-real-e2e
```

运行 Web 全量基线：

```bash
make web-real-full-baseline
```

生成 pytest HTML：

```bash
make test-html ARGS="tests --target-platform android -m real_e2e"
```

生成 Allure 结果：

```bash
make test-allure ARGS="tests --target-platform android -m real_e2e"
```

Android 正式发版 E2E 推荐使用 `e2e-full-run`。当 `--platform-matrix android-android` 且 client 都是 Android 时，它会委托 Android runner；runner 会启动 WebSocket relay、拉起 Android 设备、下发 `Client.init`，再调用 pytest，并默认同时输出 HTML 与 Allure。

`android-real-e2e` 是底层 runner 调试入口，用于只验证某个 Android case、runner 启动链路或设备连接问题，不作为发版报告的首选入口：

```bash
make android-real-e2e ARGS="--device-ids emulator-5554 emulator-5558 --run-id android-debug-20260707 -- tests/chat/test_chat_crud.py::test_chat_send_and_received --target-platform android -m real_e2e -q"
```

默认报告位置：

```text
out/log/android/<run_id>-android-pytest.html
out/log/android/<run_id>-allure-results/
```

如果只想直接复用已在线客户端执行 pytest，可使用 `make test-allure`；这种方式不会负责设备启动、旧 App 卸载、SDK init 或 WebSocket topic 编排。

## WebSocket 辅助

一次调用：

```bash
make ws-call MANAGER=ContactManager CMD=addContact INFO='{"userId":"u2"}' DEVICE=device_a
```

调用并等待事件：

```bash
make ws-call MANAGER=ContactManager CMD=addContact INFO='{"userId":"u2"}' EVENT=CONTACT_INVITED
```

等待事件：

```bash
make ws-wait EVENT=CONTACT_INVITED DEVICE=device_b TIMEOUT=15
```

## REST 和 Contact 辅助

```bash
make create-users USERS='uA uB'
make delete-user USERNAME=uA
make contact-establish INITIATOR_DEVICE=device_a PEER_DEVICE=device_b USER_A=uA USER_B=uB
make contact-delete INITIATOR_DEVICE=device_a FRIEND_USER_ID=uB
make contact-block DEVICE=device_a USER_ID=uB
make contact-unblock DEVICE=device_a USER_ID=uB
```

## 用例要求

- 默认全量应是真实 SDK E2E，不是 wrapper mapping、fixture 或 unit。
- 平台必须显式写真实名称，不要用 `mobile` 替代 Android/iOS/Web/HMOS/Windows。
- 需要 SDK callback/event 的 case 必须先启动 callback。
- 断言使用最强稳定证据：同步响应、接收端事件、服务端状态、本地状态和稳定错误。
- 成功断言优先使用 `assert_response_matches`；失败断言优先使用 `assert_error`。
- 禁止用实际结果构造预期，禁止只断言 `is not None`、Promise 完成或 WebSocket 有响应。

## 项目 Skills

当前只保留两个项目 skill：

- `native-auto-test-framework`：真实 SDK E2E、跨平台互测、发版测试、报告和版本回归主入口。
- `android-api-coverage`：Android 原生 SDK API 到 Flutter wrapper 和自动化覆盖的专项统计。

辅助工具放在 `scripts/`，不要恢复旧模块级 skill 或 `docs/agents` 台账。
