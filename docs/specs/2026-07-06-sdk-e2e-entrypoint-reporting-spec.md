# SDK E2E prepare/context/matrix 设计讨论稿

> 状态：讨论稿。本文只记录当前设计结论，后续确认后再整理成正式 plan，并落到 README、skill、配置和实现中。

## 1. 分层边界

| 层 | 职责 | 不负责 |
|---|---|---|
| `e2e_prepare` | 准备真实测试环境，生成本次运行的 `context.yaml`。 | 不跑业务 case，不做业务断言，不决定 SDK API 覆盖结果。 |
| `context.yaml` | 记录 prepare 后的事实快照：真实客户端、设备、topic、版本检测、安装结果、init 结果。 | 不作为人工输入，不维护 case 矩阵，不维护平台组合规则。 |
| `pytest` / `e2e_run` | 读取 context，选择 case，绑定客户端角色，执行断言，输出报告。 | 不负责启动模拟器、卸载安装 App、启动 WebSocket relay。 |
| `e2e_upgrade_run` | 编排覆盖安装/升级测试：旧包 prepare、pre case、新包覆盖安装、post case、升级报告。 | 不把升级前业务动作写死在 prepare 中。 |
| `sdk_version_capability_policy.yaml` | 维护机器难以推导的事实：测试版本、SDK 来源、版本 API 增量、平台差异、语义映射例外。 | 不手写全量 API 表、全量 case 表、平台组合矩阵、详细断言步骤。 |

## 2. `e2e_prepare` 输入参数

`e2e_prepare` 输入只表达“我要准备什么环境”。真实设备、topic、实际 SDK 版本、日志路径等由 prepare 自动生成。

示例：

```bash
e2e_prepare \
  --client android:a@4.23.0 \
  --client android:b@4.23.0 \
  --install-mode clean \
  --matrix-mode pair \
  --init
```

| 参数 | 必填 | 默认值 | 示例 | 含义 | 失败规则 |
|---|---:|---|---|---|---|
| `--client` | 是 | 无 | `android:a@4.23.0` | 请求准备一个客户端。格式为 `<platform>:<slot>@<sdk_version>`；也允许 `<platform>:<slot>`，但必须通过 `--sdk-version <platform>=<version>` 补齐版本。可重复传多个。 | 平台不可识别、slot 重复、缺少 SDK 版本、版本冲突、没有可用设备时失败。 |
| `--sdk-version` | 条件必填 | 无 | `android=4.23.0` | 平台级 SDK 版本。用于给同平台所有未在 `--client` 中写版本的 client 补齐版本。它不是唯一写法，但每个 client 最终都必须有明确版本。 | 与 `--client` 中同平台 client 版本冲突、无法下载/切换/构建/检测到该版本时失败。 |
| `--install-mode` | 否 | `clean` | `clean` | App 安装策略，决定是否卸载旧 App、安装新 App 或复用现有 App。 | 模式非法、安装失败、正式 E2E 使用非推荐模式但未显式允许时失败。 |
| `--matrix-mode` | 否 | `smoke` | `pair` | 本次预计的 case 客户端绑定展开模式。prepare 只记录和校验，不执行 case 展开。 | 客户端数量或平台准备无法满足该模式时失败或降级需显式确认。 |
| `--account-mode` | 否 | `fresh` | `fresh` | 账号准备模式。当前只确认 `fresh`：通过 Server REST 为本次 run 新建账号。 | REST 配置缺失、账号创建失败、user_id 连续冲突时失败。 |
| `--init` | 否 | 默认启用 | `--init` | prepare 阶段读取 `config.yaml.sdk_options` 并调用 `Client.init`。 | init 参数缺失或 init 失败时失败。 |
| `--no-init` | 否 | 关闭 init | `--no-init` | prepare 阶段不调用 `Client.init`，用于测试 `Client.init`、SDK options、DNS、指定服务器地址。 | 与 `--init` 同时出现时失败。 |
| `--sdk-options-profile` | 否 | `default` | `private_deploy` | 选择 `config.yaml` 中哪套 SDK init options。第一版可只支持 `default`。 | profile 不存在、必要 init 字段缺失或 resolver 转换失败时失败。 |
| `--device-mode` | 否 | `auto` | `auto` | 设备准备策略。`auto` 表示已有设备不足时可启动模拟器；`existing` 表示只用在线设备；`manual` 表示不启动不安装，只等待外部客户端连接。 | 模式非法或无法满足 `--client` 请求时失败。 |
| `--run-id` | 否 | 自动生成 | `android-20260703-001` | 指定本次运行 ID，用于 context、日志、报告、账号名前缀和输出目录关联。 | 已存在且不允许覆盖时失败。 |
| `--config` | 否 | `config.yaml` | `config.local.yaml` | 指定本地敏感配置文件。包含 appkey、REST 凭据、SDK options、fresh 账号默认密码等。 | 文件不存在或必要字段缺失时失败。 |

SDK 版本规则：

- `--sdk-version` 这个参数名不是强制必须写，但每个 `--client` 最终必须解析出明确 `requested_sdk_version`。
- 版本可以写在 client 上：`--client android:a@4.23.0`。
- 版本也可以写在平台上：`--client android:a --client android:b --sdk-version android=4.23.0`。
- 如果 client 级版本和平台级版本同时存在且一致，允许。
- 如果 client 级版本和平台级版本冲突，prepare 失败。
- 如果某个 client 最终没有版本，prepare 失败。
- `actual_sdk_version` 必须与 `requested_sdk_version` 匹配，否则 prepare 失败。

示例：client 级版本。

```bash
e2e_prepare \
  --client android:a@4.23.0 \
  --client ios:b@4.23.0 \
  --install-mode clean \
  --matrix-mode pair
```

示例：平台级版本。

```bash
e2e_prepare \
  --client android:a \
  --client android:b \
  --sdk-version android=4.23.0 \
  --install-mode clean \
  --matrix-mode pair
```

`--matrix-mode` 同时出现在 prepare 和 pytest/e2e_run 中，但含义不同：

| 阶段 | 作用 |
|---|---|
| `e2e_prepare --matrix-mode` | 作为本次运行计划写入 `context.run_plan.matrix_mode`，并提前校验准备的客户端数量和平台是否满足预计执行模式。 |
| `pytest/e2e_run --matrix-mode` | 真正执行 case 时使用，决定如何把 context 中的客户端绑定到 case 语义角色。 |

pytest/e2e_run 如果没有显式传 `--matrix-mode`，应读取 `context.run_plan.matrix_mode`；如果显式传了，则以显式参数为准，但必须重新校验不能超出 prepare 出来的客户端能力。

## 3. `--install-mode` 取值

| 取值 | 行为 | 适用场景 | 是否正式推荐 |
|---|---|---|---|
| `clean` | 卸载旧 App，安装本次构建或指定的测试 App，启动 App。 | 正式 SDK E2E、全量回归、发版验证。 | 是，默认值。 |
| `reuse` | 不卸载、不安装，只启动已安装 App。 | 快速调试、手工复用现有 App。 | 否，仅调试。 |
| `none` | 不处理 App，只等待客户端连接 WebSocket。 | 手动启动客户端、Web 调试、特殊排障。 | 否，仅特殊场景。 |

覆盖安装/升级测试不放入普通 `e2e_prepare --install-mode`。因为升级流程中间需要插入 pytest case，应使用单独的 `e2e_upgrade_run`。

## 3.1 `--device-mode` 取值

`e2e_prepare` 是唯一负责启动、发现、分配设备和启动测试 App 的入口。`e2e_run` / pytest 不启动模拟器，只消费 `context.yaml` 中已经 ready 的 client；`e2e_api_coverage` 不需要设备；`e2e_upgrade_run` 通过 prepare 能力启动设备。

| 取值 | 行为 | 适用场景 |
|---|---|---|
| `auto` | 默认。优先使用已在线设备；数量不足时自动启动模拟器。 | 正式 E2E、CI。 |
| `existing` | 只使用已在线设备，不自动启动模拟器。 | 本地已手动启动足够设备时。 |
| `manual` | 不启动模拟器，不安装 App，不执行 adb reverse / flutter run，只等待外部 client 连接。 | 远程真机、特殊平台、手动调试。 |

### `auto` 模式流程

```text
1. 按 --client 统计每个平台需要几个设备。
2. 查询已在线设备。
3. 分配已有设备给 slot。
4. 如果数量不足，启动可用模拟器。
5. 等待 device online。
6. Android 执行 adb reverse；其他平台执行等价网络准备。
7. 按 install-mode 卸载/安装/启动 App。
8. 等待 bridge ready。
9. 写入 context。
```

context 记录设备来源：

```yaml
clients:
  a:
    platform: android
    device_id: emulator-5554
    device_source: existing
  b:
    platform: android
    device_id: emulator-5558
    device_source: started_by_prepare
```

### `existing` 模式流程

```text
1. 查询已在线设备。
2. 如果数量足够，分配给 slot。
3. 如果数量不足，prepare 失败。
4. 不启动新模拟器。
```

### `manual` 模式流程

```text
1. 不启动模拟器。
2. 不安装 App。
3. 不执行 adb reverse / flutter run。
4. 启动或等待 WebSocket relay。
5. 等外部 im_flutter_test client 按约定 topic 连进来。
6. 超时未连接则 prepare 失败。
```

第一版不要求用户指定具体设备 ID。后续如需排障或 CI 固定设备，可以增加调试参数：

```bash
--device android:a=emulator-5554
```

它只用于把某个 slot 绑定到指定设备，不作为主路径。

### 平台差异

| 平台 | prepare 行为 |
|---|---|
| Android | `adb devices` / emulator 启动 / `adb reverse` / 安装或启动 APK。 |
| iOS | `simctl list` / boot simulator / 安装或启动 app。 |
| Web | 启动浏览器或 headless client，不叫模拟器。 |
| Windows/HMOS | 后续按平台接入 device provider。 |

### 失败规则

| 情况 | 结果 |
|---|---|
| `auto` 模式下模拟器启动失败 | prepare 失败。 |
| `existing` 模式下在线设备不足 | prepare 失败。 |
| `manual` 模式下超时没有 client 连接 | prepare 失败。 |
| 分配到的设备 SDK 版本无法校验 | prepare 失败。 |
| App 安装或启动失败 | prepare 失败。 |
| bridge ready 超时 | prepare 失败。 |

## 4. `context.yaml` 输出字段

`context.yaml` 是 prepare 自动生成的事实快照，不是用户手写输入。

示例：

```yaml
run_id: android-20260703-001
status: ready

server:
  websocket_url: "ws://127.0.0.1:2000/iov/websocket/dual"
  started_by_prepare: true

environment:
  bridge_ready: true
  sdk_initialized: true
  sdk_options_summary:
    # SDK init 配置摘要；只记录类别和开关，不记录 app_key、server 地址、client_secret、token 等敏感值。
    source: config.yaml
    profile: default
    app_key_present: true
    dns_config_enabled: true
    custom_server_present: false
    debug_enabled: true
    auto_login_enabled: false
    resolved: true
    resolved_platforms:
      - android

run_plan:
  matrix_mode: pair
  requested_clients:
    - slot: a
      platform: android
    - slot: b
      platform: android

clients:
  a:
    platform: android
    device_id: emulator-5554
    device_source: existing
    topic: im-auto-android-20260703-001-a
    app_package: com.easemob.im_flutter_test
    requested_sdk_version: "4.23.0"
    actual_sdk_version: "4.23.0"
    version_required: true
    version_check:
      status: matched
      source: runtime_api
  b:
    platform: android
    device_id: emulator-5558
    device_source: started_by_prepare
    topic: im-auto-android-20260703-001-b
    app_package: com.easemob.im_flutter_test
    requested_sdk_version: "4.23.0"
    actual_sdk_version: "4.23.0"
    version_required: true
    version_check:
      status: matched
      source: runtime_api

accounts:
  a:
    user_id: im_e2e_20260706153001_a_x7k2
    source: server_rest
    credential_ref: config.accounts.default_password
    status: ready
    action: created
  b:
    user_id: im_e2e_20260706153001_b_p9m4
    source: server_rest
    credential_ref: config.accounts.default_password
    status: ready
    action: created

install:
  mode: clean
  artifacts:
    android:
      target:
        path: out/app/android/im_flutter_test-android-sdk-4.23.0-debug.apk
        sdk_version: "4.23.0"
        source_ref: android-4.23.0

artifacts:
  log_dir: out/log/android/android-20260703-001
  context_path: out/run/android-20260703-001/context.yaml
```

### 4.1 顶层字段

| 字段 | 含义 | 来源 |
|---|---|---|
| `run_id` | 本次 prepare/run 的唯一 ID。 | `--run-id` 或自动生成。 |
| `status` | prepare 结果，例如 `ready`、`failed`。 | prepare 生成。 |
| `server.websocket_url` | 本次 WebSocket relay 地址。 | prepare 启动或配置。 |
| `server.started_by_prepare` | relay 是否由 prepare 启动。 | prepare 生成。 |
| `environment.bridge_ready` | 客户端是否已连上 WebSocket 并 ready。 | prepare 检测。 |
| `environment.sdk_initialized` | prepare 是否已调用 `Client.init`。 | `--init` / `--no-init` 和执行结果。 |
| `environment.sdk_options_summary` | SDK init 配置摘要，只记录类别和开关，不记录敏感值。 | `config.yaml` 和 `sdk_options_resolver`。 |
| `run_plan.matrix_mode` | 本次预计的 case 客户端绑定展开模式。 | `e2e_prepare --matrix-mode`。 |
| `run_plan.requested_clients` | 用户请求准备的客户端平台和 slot。 | `e2e_prepare --client`。 |

### 4.2 `clients.<slot>` 字段

| 字段 | 含义 | 来源 |
|---|---|---|
| `platform` | 真实平台，例如 `android`、`ios`、`web`。 | `--client` 输入。 |
| `device_id` | 实际分配到的设备 ID。 | prepare 自动发现/分配。 |
| `device_source` | 设备来源，例如 `existing`、`started_by_prepare`、`manual`。 | `--device-mode` 和 prepare 执行结果。 |
| `topic` | WebSocket topic。 | prepare 自动生成。 |
| `app_package` | 测试 App 包名或等价标识。 | 平台配置/prepare 生成。 |
| `requested_sdk_version` | 本次要求的 SDK 版本。每个 client 必须有明确值。 | `--client <platform>:<slot>@<version>` 或 `--sdk-version <platform>=<version>`；context 只记录解析后的最终值。 |
| `actual_sdk_version` | 客户端启动后实际检测到的 SDK 版本。 | runtime API、build meta 或 artifact meta。 |
| `version_required` | 本次版本是否强约束。正式 E2E 恒为 `true`。 | prepare 生成。 |
| `version_check.status` | 版本校验状态。 | prepare 生成。 |
| `version_check.source` | 版本信息来源。 | prepare 生成。 |

### 4.3 `version_check.status` 取值

| 取值 | 含义 | 是否允许进入 pytest |
|---|---|---|
| `matched` | `actual_sdk_version` 与 `requested_sdk_version` 一致。 | 是。 |
| `mismatch` | 实际版本与要求版本不一致。 | 否。 |
| `unknown` | 未能可靠检测版本。 | 否。 |

### 4.4 `version_check.source` 取值

| 取值 | 含义 | 优先级 |
|---|---|---:|
| `runtime_api` | 启动客户端后调用 SDK API 获取版本，例如 `Client.getSdkInfo`。 | 最高 |
| `build_meta` | 测试 App 构建时写入的版本元信息。 | 中 |
| `artifact_meta` | APK/IPA/Web bundle 旁边的 meta 文件。 | 中 |
| `none` | 无可靠来源。 | 最低 |

### 4.5 `accounts.<slot>` 字段

prepare 可以为每个 client slot 准备基础账号，但不登录。当前先只确认 `fresh` 新账号场景：正式 E2E 默认使用本次 run 新建账号，不复用已存在账号，不讨论历史数据、seed 或升级数据。

账号创建只能由 `native-auto-test` 控制端通过 Server REST 完成，不能由被测 SDK client 注册账号。SDK 注册账号如果需要覆盖，必须作为独立 real E2E case，不能被 prepare 当作普通账号前置。

| 字段 | 含义 | 来源 |
|---|---|---|
| `user_id` | 绑定到该 slot 的账号 ID。 | Server REST 创建。 |
| `source` | 账号来源。 | prepare 生成。 |
| `credential_ref` | 凭据引用路径，不写明文密码。 | prepare 根据 `config.yaml` 生成。 |
| `status` | 账号准备结果。 | prepare 生成。 |
| `action` | prepare 对账号执行的动作。 | prepare 生成。 |

当前已确认的 `source`：

| 取值 | 含义 |
|---|---|
| `server_rest` | prepare 通过 `native-auto-test` 的 Server REST 辅助层创建新账号。 |

fresh 模式下的账号生成规则：

```text
<prefix>_<yyyymmddHHMMSS>_<slot>_<random>
```

例如：

```text
im_e2e_20260706153001_a_x7k2
im_e2e_20260706153001_b_p9m4
```

要求：

- 能看出是自动化账号。
- 能关联运行时间和 slot。
- 冲突概率低。
- 长度满足服务端 user_id 限制。

fresh 模式处理已存在账号的规则：

| 情况 | 处理 |
|---|---|
| 生成的 `user_id` 不存在 | 通过 Server REST 创建，成功后使用。 |
| 生成的 `user_id` 已存在 | 不复用，重新生成新的 `user_id`。 |
| 连续冲突超过 `accounts.create_retry` | prepare 失败。 |
| REST 配置缺失或 token 获取失败 | prepare 失败。 |
| REST 创建失败 | prepare 失败。 |
| 创建成功但账号不可用 | prepare 失败。 |

示例：fresh 新账号，使用统一默认密码：

```yaml
run_plan:
  account_mode: fresh

accounts:
  a:
    user_id: im_e2e_20260706153001_a_x7k2
    source: server_rest
    credential_ref: config.accounts.default_password
    status: ready
    action: created
  b:
    user_id: im_e2e_20260706153001_b_p9m4
    source: server_rest
    credential_ref: config.accounts.default_password
    status: ready
    action: created
```

禁止普通 prepare 使用 SDK client 注册账号作为账号来源：

```yaml
accounts:
  a:
    source: sdk_client  # 禁止
```

登录归属：

- prepare 创建账号，但不调用 SDK login。
- pytest fixture 或具体 login case 负责通过 SDK 登录。
- 如果 case 专门测试 login API，fixture 不应提前登录。
- fresh 模式只保证账号身份新、凭据可用、后续可登录；不讨论已有账号历史数据。

登录 fixture 说明：

- “登录 fixture” 指 pytest fixture 在 case 执行前，通过 WebSocket 控制 `im_flutter_test` 调用被测 SDK 的 `Client.login` API。
- 它不是 REST 登录，不是 WebSocket 登录，不是 SDK options 中的 `autoLogin`，也不是 prepare 行为。
- 普通业务 case 默认执行登录 fixture，确保绑定到 case 的客户端已通过真实 SDK 登录。
- `Client.login`、`Client.logout`、未登录错误等专项 case 必须禁止登录 fixture，由 case 自己调用 SDK API 并断言。

`startCallback` 规则：

- `startCallback` 只属于 `im_flutter_test` 测试 App 的登录后保护动作，用于防止 Flutter/UI/bridge 未准备好时丢失 SDK 回调。
- `startCallback` 不是 SDK API 覆盖目标，不应出现在 pytest case、pytest fixture、native-auto-test helper、原生 SDK wrapper 或发布 SDK 代码中。
- 任何路径只要通过 `im_flutter_test` 处理 `Client.login` 命令，并且 SDK login 成功，`im_flutter_test` 就必须在同一处立即调用 `startCallback`。
- `im_flutter_test` 应在 `startCallback` 成功后再返回 login 成功；如果 SDK login 成功但 `startCallback` 失败，应返回测试桥接准备失败，不能继续当作普通业务前置成功。

建议 marker：

| marker | 含义 |
|---|---|
| `no_login_fixture` | pytest 不在 case 前自动调用 SDK `Client.login`。用于 login/logout/未登录错误等专项 case。 |
| `expects_event` | case 会等待并断言 WebSocket 事件。它只用于报告、事件等待和审计，不控制 `startCallback`。 |

示例：普通业务 case 默认走登录 fixture。

```python
@pytest.mark.real_e2e
@pytest.mark.case_id("chat.send_text.success")
@pytest.mark.api("ChatManager.sendMessage")
@pytest.mark.clients("sender", "receiver")
@pytest.mark.roles_mode("symmetric")
@pytest.mark.expects_event
def test_send_text(sender, receiver):
    ...
```

示例：登录专项 case 禁止登录 fixture。

```python
@pytest.mark.real_e2e
@pytest.mark.case_id("client.login.success")
@pytest.mark.api("Client.login")
@pytest.mark.clients("client")
@pytest.mark.no_login_fixture
def test_login_success(client):
    ...
```

## 5. init 配置来源

| 配置 | 文件 | 原因 |
|---|---|---|
| appkey、REST 凭据、指定服务器地址、DNS、SDK options | `native-auto-test/config.yaml` | 敏感或环境相关，不应提交。 |
| SDK 版本、SDK 下载地址、版本 API 增量、平台差异、暂不覆盖策略 | `native-auto-test/config/sdk_version_capability_policy.yaml` | 发版测试策略，可提交。 |

SDK 初始化配置属于本地敏感/环境配置，放在 `config.yaml` 的 `sdk_options` 中，不放入 `sdk_version_capability_policy.yaml`。prepare 默认执行 `--init`，会读取 `sdk_options`，通过 resolver 转成各平台 `Client.init` 需要的 JSON 后下发给 `im_flutter_test`。

### 5.1 `sdk_options` 示例

```yaml
sdk_options:
  app_key: "easemob#dutest"
  auto_login: false
  debug_model: true

  # DNS / 指定服务器地址
  enable_dns_config: true
  im_server: ""
  im_port: null
  rest_server: ""
  dns_url: ""

  # 可选环境参数
  area_code: ""
  using_https_only: true
  delete_messages_as_exit_group: false
  delete_messages_as_exit_room: false
  require_ack: true
  require_delivery_ack: false
  sort_message_by_server_time: true
```

这里写的是平台无关的核心参数。平台差异由 `sdk_options_resolver` 处理：

```text
config.yaml.sdk_options
  -> sdk_options_resolver
  -> Android Client.init info
  -> iOS Client.init info
  -> Web Client.init info
```

### 5.2 profile

第一版可以只支持默认 profile。后续如果需要多套环境，可以扩展为：

```yaml
sdk_options_profiles:
  default:
    app_key: "easemob#dutest"
    enable_dns_config: true

  private_deploy:
    app_key: "xxx#yyy"
    enable_dns_config: false
    im_server: "im.example.com"
    im_port: 6717
    rest_server: "https://a1.example.com"
```

prepare 使用：

```bash
e2e_prepare ... --sdk-options-profile private_deploy
```

### 5.3 prepare 行为

默认：

```text
e2e_prepare 默认等价于 --init。
```

执行顺序：

```text
1. 读取 config.yaml 的 sdk_options 或指定 profile。
2. 校验 app_key 等必填项。
3. 根据 client platform 转成该平台 init JSON。
4. 通过 WebSocket 调 im_flutter_test 的 Client.init。
5. 写入 context.environment.sdk_initialized = true。
```

如果使用：

```bash
e2e_prepare ... --no-init
```

则不下发 SDK init，输出：

```yaml
environment:
  sdk_initialized: false
```

用于专门测试：

```text
Client.init
SDK options
DNS
指定服务器地址
```

### 5.4 context 摘要

context 不写完整 `sdk_options`，避免泄露 appkey、服务器地址或其他敏感配置。只写摘要：

```yaml
environment:
  sdk_initialized: true
  sdk_options_summary:
    # SDK init 配置摘要；只记录类别和开关，不记录敏感值。
    source: config.yaml
    profile: default
    app_key_present: true
    dns_config_enabled: true
    custom_server_present: false
    debug_enabled: true
    auto_login_enabled: false
    resolved: true
    resolved_platforms:
      - android
      - ios
```

字段说明：

| 字段 | 含义 |
|---|---|
| `source` | 来源配置文件，默认 `native-auto-test/config.yaml`。 |
| `profile` | 使用的 `sdk_options` profile。第一版默认 `default`。 |
| `app_key_present` | 是否配置 app_key；不记录具体 appkey。 |
| `dns_config_enabled` | 是否启用 DNS 配置。 |
| `custom_server_present` | 是否配置自定义服务器地址，例如 `im_server`、`rest_server`、`dns_url`。 |
| `debug_enabled` | 是否启用 SDK debug。 |
| `auto_login_enabled` | SDK init options 中是否启用 `auto_login`；不是 pytest 登录 fixture。 |
| `resolved` | `sdk_options_resolver` 是否成功完成平台参数转换。 |
| `resolved_platforms` | 本次已转换 init 参数的平台。 |

fresh 新账号模式需要的 REST 服务地址、REST 鉴权、新账号默认密码、账号名前缀和重试次数也放在 `config.yaml`。示例：

```yaml
rest:
  base_url: "https://a1.easemob.com"
  org_name: "easemob"
  app_name: "dutest"
  client_id: "xxx"
  client_secret: "xxx"

accounts:
  mode: fresh
  default_password: "xxx"
  user_id_prefix: "im_e2e"
  create_retry: 5
  cleanup_policy: keep
```

| 字段 | 含义 |
|---|---|
| `rest.base_url` | REST API 基础地址。 |
| `rest.org_name` / `rest.app_name` | REST app 标识，可由 appkey 拆分，也可显式配置。 |
| `rest.client_id` / `rest.client_secret` | REST token 获取凭据。 |
| `accounts.mode` | 默认账号模式。当前讨论阶段只确认 `fresh`。 |
| `accounts.default_password` | fresh 账号统一密码，只放在 `config.yaml`，不写入 context。 |
| `accounts.user_id_prefix` | 自动化账号名前缀。 |
| `accounts.create_retry` | user_id 冲突或创建失败时的重试次数。 |
| `accounts.cleanup_policy` | 账号清理策略。第一阶段默认 `keep`，不自动删除，便于失败排查。 |

## 6. pytest / e2e_run 参数

正式推荐使用 `e2e_run` 执行 case。`e2e_run` 负责读取 context、选择 case、展开客户端角色、自动拼 pytest 参数、执行断言、生成 pytest-html / Allure / case-results。

直接执行 pytest 仍然保留，但只作为低层调试入口，不作为正式发版推荐入口。

推荐命令：

```bash
e2e_run --run-context out/run/android-20260703-001/context.yaml
```

`e2e_run` 自动做：

```text
1. 读取 context。
2. 读取 context.run_plan.matrix_mode。
3. 默认选择真实 E2E：-m real_e2e。
4. 默认输出 pytest-html 到 out/log/<platform-matrix>/<run_id>-pytest.html。
5. 默认输出 Allure 到 out/log/<platform-matrix>/<run_id>-allure-results/。
6. 解析 pytest 执行结果，输出 out/test-results/<run_id>-case-results.json/html/csv。
7. 调用 pytest。
```

底层等价 pytest 示例：

```bash
pytest -q tests -s \
  --run-context out/run/android-20260703-001/context.yaml \
  --matrix-mode pair \
  -m real_e2e
```

这条 pytest 命令只是展开效果和调试入口。正式执行不要求用户每次手工输入这一长串。

| 参数 | 示例 | 含义 |
|---|---|---|
| `--run-context` | `out/run/xxx/context.yaml` | prepare 生成的 context。pytest 通过它知道有哪些真实客户端。 |
| `--target-platform` | `android` | 可选。只执行某个平台相关 case；已有参数可保留。 |
| `--matrix-mode` | `pair` | 控制客户端角色绑定展开强度。不传时读取 `context.run_plan.matrix_mode`。 |
| `-m` | `real_e2e` | pytest 原生 marker 选择。 |
| `--api` | `ChatManager.sendMessage` | 可选。只跑某个 wrapper/API 关联 case。 |
| `--case-id` | `chat.send_text.success` | 可选。只跑某个稳定 case ID。 |
| `--html` | `out/log/...html` | pytest-html 报告路径。 |
| `--alluredir` | `out/log/...allure-results` | Allure 结果目录。 |
| `--reuse-context` | 无 | 明确表示复用旧 context 调试 case；正式 E2E 不应依赖该模式。 |

### 6.1 执行入口选择

| 入口 | 用途 | 是否正式推荐 |
|---|---|---|
| `e2e_full_run ...` | 正式一键完整执行：prepare、run、api coverage。 | 是 |
| `e2e_run --run-context ...` | 正式执行已准备好的环境，自动拼 pytest 参数和报告路径。 | 是 |
| `e2e_run --run-context ... --reuse-context` | 调试时复用旧 context 重跑 case。 | 否 |
| `pytest -q tests ...` | 低层调试，手动选择 case 或排查 fixture。 | 否 |

## 7. pytest case marker

case 不直接写平台组合。第一版以 `Manager.methodKey` 作为完整 E2E 的覆盖主维度，case 只描述自己验证的 wrapper/API 入口、需要的客户端语义角色，以及角色是否可互换。

第一版不强制引入 `semantic`。当 Android/iOS/Web 方法名不同但语义相同、别名越来越多或一个 MethodKey 无法表达业务语义时，再升级为 semantic 层。

### 7.1 通用 marker

| marker | 示例 | 含义 |
|---|---|---|
| `real_e2e` | `@pytest.mark.real_e2e` | 真实 SDK 链路 case，可计入真实 E2E 覆盖。 |
| `case_id` | `@pytest.mark.case_id("chat.send_text.success")` | 稳定 case ID，用于报告和覆盖关联。 |
| `api` | `@pytest.mark.api("ChatManager.sendMessage")` | 第一版覆盖主键，格式为 `Manager.methodKey`。工具可拆成 `manager=ChatManager`、`method_key=sendMessage`。 |
| `clients` | `@pytest.mark.clients("sender", "receiver")` | case 需要的语义角色。不是平台、账号或设备号。 |
| `roles_mode` | `@pytest.mark.roles_mode("symmetric")` | 角色关系：可互换或有固定方向。 |
| `expects_event` | `@pytest.mark.expects_event` | case 会等待并断言 WebSocket 事件；不控制 `startCallback`。 |
| `no_login_fixture` | `@pytest.mark.no_login_fixture` | pytest 不在 case 前自动调用 SDK `Client.login`。用于 login/logout/未登录错误等专项 case。 |
| `init_case` | `@pytest.mark.init_case` | case 专门测试 init/options，通常要求 prepare 使用 `--no-init`。 |

### 7.2 `roles_mode` 取值

| 取值 | 含义 | 示例 |
|---|---|---|
| `symmetric` | 角色可互换。runner 可以把 `a/b` 互换绑定。 | `sender/receiver`、`caller/callee`。 |
| `ordered` | 角色有固定业务方向，runner 不能自动互换。 | `owner/member`、`admin/user`、`inviter/invitee`。 |

发送消息示例：

```python
@pytest.mark.real_e2e
@pytest.mark.case_id("chat.send_message.text.success")
@pytest.mark.api("ChatManager.sendMessage")
@pytest.mark.clients("sender", "receiver")
@pytest.mark.roles_mode("symmetric")
@pytest.mark.expects_event
def test_send_text(sender, receiver):
    ...
```

群邀请示例：

```python
@pytest.mark.real_e2e
@pytest.mark.case_id("group.invite_member.success")
@pytest.mark.api("GroupManager.inviteUser")
@pytest.mark.clients("owner", "member")
@pytest.mark.roles_mode("ordered")
def test_invite_member(owner, member):
    ...
```

## 8. `--matrix-mode`

`matrix-mode` 控制“context 中的真实客户端如何绑定到 case 声明的语义角色”。它既可以在 prepare 阶段声明为运行计划，也可以在 pytest/e2e_run 阶段显式覆盖。

取值确定规则：

| 优先级 | 来源 | 说明 |
|---:|---|---|
| 1 | `pytest/e2e_run --matrix-mode` | 执行时显式指定，优先级最高。必须校验 context 中的客户端能力足够。 |
| 2 | `context.run_plan.matrix_mode` | prepare 阶段写入的运行计划。推荐正式执行使用这个值。 |
| 3 | 默认值 `smoke` | 两边都未指定时使用。适合调试，不适合作为正式发版默认。 |

假设 context：

```yaml
clients:
  a:
    platform: android
  b:
    platform: ios
  c:
    platform: web
```

case：

```python
@pytest.mark.clients("sender", "receiver")
@pytest.mark.roles_mode("symmetric")
```

| `matrix-mode` | 含义 | 三客户端示例 | 两客户端示例 |
|---|---|---|---|
| `smoke` | 每个 case 只选一组最小可用绑定。 | `a -> b` | `a -> b` |
| `pair` | 选一对客户端；`symmetric` 跑双向，`ordered` 只跑正向。 | `a -> b`、`b -> a` | `a -> b`、`b -> a` |
| `full` | 对所有可用客户端做完整有向组合。 | `a -> b`、`b -> a`、`a -> c`、`c -> a`、`b -> c`、`c -> b` | `a -> b`、`b -> a` |

对 `roles_mode("ordered")`：

| `matrix-mode` | 行为 |
|---|---|
| `smoke` | 选择一组有序绑定，例如 `owner=a, member=b`。 |
| `pair` | 选择一组有序绑定，不自动反向。 |
| `full` | 是否展开所有有序组合要由 fixture 能否为每组准备业务身份决定；默认应谨慎。 |

## 9. 平台类型和发收方向

| 问题 | 设计 |
|---|---|
| 怎么指定客户端类型？ | 用户在 `e2e_prepare --client android:a --client ios:b` 中指定平台。case 不写死平台组合。 |
| 怎么指定谁发谁收？ | case 用 `clients("sender", "receiver")` 指定语义角色，runner 生成 `sender -> a`、`receiver -> b` 绑定。 |
| 两个设备是否互发？ | 取决于 `--matrix-mode`。`pair/full` 下 `roles_mode("symmetric")` 会生成 `a -> b` 和 `b -> a`。 |
| 三个设备为什么更多组合？ | `full` 会对所有可用客户端做有向两两组合。 |
| Android/iOS/Web 方法名不同但语义相同怎么办？ | 第一版先用 `method_key_aliases` 处理少量别名；当别名增多或 MethodKey 无法表达语义时，再引入 `semantic` 层。 |

## 9.1 prepare 阶段如何使用 `matrix-mode`

prepare 不执行 case 展开，但要用 `matrix-mode` 做最低环境校验：

| `matrix-mode` | prepare 校验 |
|---|---|
| `smoke` | 至少准备 1 个客户端；多客户端 case 运行时可能被 skip。正式 E2E 不推荐只准备 1 个。 |
| `pair` | 至少准备 2 个客户端。适合 Android-A/Android-B、Android/iOS 等双端互测。 |
| `full` | 至少准备 2 个客户端；如果希望覆盖多平台全组合，应在 `--client` 中显式准备多个平台。 |

示例：

```bash
e2e_prepare \
  --client android:a \
  --client android:b \
  --matrix-mode pair
```

prepare 输出：

```yaml
run_plan:
  matrix_mode: pair
  requested_clients:
    - slot: a
      platform: android
    - slot: b
      platform: android
```

pytest 执行时可以不再传：

```bash
pytest -q tests -s --run-context out/run/<run_id>/context.yaml -m real_e2e
```

pytest 读取 `context.run_plan.matrix_mode=pair` 后展开。

## 10. MethodKey 覆盖主线与平台基准

第一版完整 E2E 覆盖以 `Manager.methodKey` 为主维度。原因是当前自动化请求统一经过：

```text
manager/cmd/info -> im_flutter_test -> im_flutter_sdk_interface -> platform wrapper -> native SDK
```

其中 `cmd` 对应 MethodKey 或平台等价 key，是自动化可控制、可扫描、可统计的入口。

### 10.1 第一版主键

| 字段 | 示例 | 含义 |
|---|---|---|
| `manager` | `ChatManager` | SDK manager。 |
| `method_key` | `sendMessage` | MethodKey / cmd / 等价 key。 |
| `api` | `ChatManager.sendMessage` | 第一版覆盖主键，可由 `manager + method_key` 拼出。 |

case 第一版只需要：

```python
@pytest.mark.api("ChatManager.sendMessage")
```

工具从 `api` 拆出：

```text
manager = ChatManager
method_key = sendMessage
```

### 10.2 平台角色

当前假设只有 Android 和 iOS 是第一版主基线，Web 是后补目标平台，不能默认认为 Web 正确。

| 平台 | 第一版角色 | 说明 |
|---|---|---|
| Android | baseline | 扫描真实 Android SDK、Android MethodKey 和 wrapper 实现，作为主基线之一。 |
| iOS | baseline | 扫描真实 iOS SDK、iOS MethodKeys 和 wrapper 实现，作为主基线之一。 |
| Web | target | 后补对齐平台，只统计缺失、未实现、版本差异和真实 E2E 结果，不作为正确性来源。 |
| HMOS/Windows | target | 后续新增目标平台。 |

策略文件建议表达为：

```yaml
platform_roles:
  android: baseline
  ios: baseline
  web: target
  hmos: target
  windows: target
```

或在 `test_versions.platforms.<platform>.role` 中使用同样语义。

### 10.3 Web 处理规则

Web 不能因为 wrapper 有方法或 key 存在就视为通过。Web 只有经过真实 Web SDK 全链路 E2E 并断言通过，才算覆盖。

| 状态 | 含义 |
|---|---|
| `missing` | Web 没有该 MethodKey/API。 |
| `unimplemented` | Web 找到 key 或 wrapper 入口，但没有真实 Web SDK 调用。 |
| `version_gap` | Web 当前 SDK 版本未提供该能力。 |
| `not_applicable` | Web 平台确实不适用。 |
| `pending_validation` | Web 有实现，但还没通过真实 E2E 验证。 |
| `covered` | Web 真实 E2E 已通过。 |

Web 的 local adapter、模拟行为、fixture、wrapper 映射测试不能计入真实 SDK E2E 覆盖。

### 10.4 别名处理

如果 Android/iOS 命名不同但语义相同，第一版先用 `method_key_aliases` 记录少量别名，不急着引入完整 semantic 层。

```yaml
method_key_aliases:
  ChatManager.ackConversationRead:
    ios:
      api: "ChatManager.markConversationAsRead"
      manager: "ChatManager"
      method_key: "markConversationAsRead"
      reason: "iOS 命名不同但语义为会话已读。"
```

当出现大量别名、一个 MethodKey 对多个语义、多个 MethodKey 对一个语义，或平台命名差异无法靠别名维护时，再引入 `semantic_apis`。

### 10.5 覆盖报告字段

API 覆盖表第一版按 `manager + method_key + platform` 展开：

| 字段 | 含义 |
|---|---|
| `manager` | SDK manager。 |
| `method_key` | MethodKey / cmd。 |
| `api` | `Manager.methodKey`。 |
| `platform` | android / ios / web / hmos / windows。 |
| `platform_role` | baseline / target。 |
| `sdk_version` | 当前平台 SDK 版本。 |
| `native_api` | 扫描到的真实原生 SDK API，能确认则填写。 |
| `method_key_status` | 平台 MethodKey / 等价 key 是否存在。 |
| `wrapper_status` | wrapper 是否真实处理。 |
| `e2e_status` | 是否有真实 E2E case 并通过。 |
| `reason` | 中文原因。 |

## 11. 覆盖安装 / 升级测试

升级测试使用单独入口 `e2e_upgrade_run`，不作为普通 `e2e_prepare --install-mode`。

示例：

```bash
e2e_upgrade_run \
  --client android:a \
  --client android:b \
  --from-sdk-version android=4.22.0 \
  --to-sdk-version android=4.23.0 \
  --scenario chat_local_message \
  --matrix-mode pair
```

### 11.1 参数

| 参数 | 示例 | 含义 |
|---|---|---|
| `--client` | `android:a` | 同 prepare，准备客户端 slot。 |
| `--from-sdk-version` | `android=4.22.0` | 旧 SDK 版本。 |
| `--to-sdk-version` | `android=4.23.0` | 新 SDK 版本。 |
| `--from-artifact` | `out/app/...4.22.0.apk` | 可选，直接指定旧 App 包。 |
| `--to-artifact` | `out/app/...4.23.0.apk` | 可选，直接指定新 App 包。 |
| `--scenario` | `chat_local_message` | 只跑某个升级场景。 |
| `--matrix-mode` | `pair` | 升级 case 的客户端绑定展开模式，同时写入 old/new context 的 `run_plan.matrix_mode`。 |

### 11.2 固定流程

```text
1. 卸载当前设备上的已有 App。
2. 安装旧版本测试 App。
3. 启动旧版本 App。
4. prepare 输出 old context。
5. pytest 跑 pre_upgrade case。
6. 不卸载 App，覆盖安装新版本测试 App。
7. 启动新版本 App。
8. prepare/runner 输出 new context。
9. pytest 跑 post_upgrade case。
10. 输出升级测试报告。
```

### 11.3 升级 case marker

升级前：

```python
@pytest.mark.upgrade
@pytest.mark.pre_upgrade
@pytest.mark.upgrade_scenario("chat_local_message")
```

升级后：

```python
@pytest.mark.upgrade
@pytest.mark.post_upgrade
@pytest.mark.upgrade_scenario("chat_local_message")
```

升级 case 的业务动作由 pytest 实现。例如旧版写入本地消息、新版验证本地消息仍可读取。prepare 只负责安装、启动、连接和版本检测。

### 11.4 升级输出目录

```text
out/run/upgrade-20260703-001/
  old/context.yaml
  new/context.yaml
  pre-upgrade-pytest.html
  post-upgrade-pytest.html
  upgrade-summary.html
```

## 12. 推荐默认命令

| 场景 | 命令 |
|---|---|
| 正式完整 E2E | `e2e_full_run --client android:a@4.23.0 --client android:b@4.23.0 --install-mode clean --matrix-mode pair --account-mode fresh` |
| 只准备环境 | `e2e_prepare --client android:a@4.23.0 --client android:b@4.23.0 --install-mode clean --matrix-mode pair --account-mode fresh` |
| 复用 context 调试 case | `e2e_run --run-context out/run/<run_id>/context.yaml --reuse-context -m real_e2e` |
| 覆盖安装升级 | `e2e_upgrade_run --client android:a --client android:b --from-sdk-version android=4.22.0 --to-sdk-version android=4.23.0 --scenario chat_local_message` |
| API 覆盖和缺口统计 | `e2e_api_coverage --run-context out/run/<run_id>/context.yaml --case-results out/test-results/<run_id>-case-results.json` |

## 13. 入口收敛

当前 Makefile、runner、Web 专项报告、Android 4.23 专项报告、pytest-html、Allure 都已经存在，但入口较多。重构时要收敛为少量主入口，其他命令逐步变成兼容封装或内部工具。

### 13.1 对外主入口

| 入口 | 职责 | 输出 |
|---|---|---|
| `e2e_full_run` | 正式完整 E2E 主入口；顺序执行 prepare、run、api coverage。 | `out/run/...`、`out/log/...`、`out/test-results/...`、`out/api-coverage/...` |
| `e2e_prepare` | 准备真实测试环境：设备/App/WebSocket/init/fresh 账号/版本校验/context。 | `out/run/<run_id>/context.yaml` |
| `e2e_run` | 读取 context 执行 pytest case，处理 matrix、case marker、pytest-html、Allure、case-results。 | `out/log/...`、`out/test-results/...` |
| `e2e_api_coverage` | 读取 context、SDK/wrapper 扫描、case marker、case-results，生成 API 覆盖和缺口统计。 | `out/api-coverage/...` |
| `e2e_upgrade_run` | 编排覆盖安装升级：旧包 prepare、pre case、新包覆盖安装、post case、升级报告。 | `out/run/upgrade-...` |

### 13.2 兼容入口

现有入口不应立即删除，但应收敛成主入口的薄封装：

| 现有入口 | 收敛方向 |
|---|---|
| `make android-real-e2e` | 包装 `e2e_prepare + e2e_run + e2e_api_coverage`，默认 Android 双设备。 |
| `make ios-real-e2e` | 包装 `e2e_prepare + e2e_run + e2e_api_coverage`，默认 iOS。 |
| `make web-real-e2e` | 包装主入口，Web 作为 target 平台。 |
| `make test-html` / `make test-allure` | 保留为低层调试命令，不作为正式发版主入口。 |
| `make android-api-coverage` | 迁移为 `e2e_api_coverage` 的 Android/iOS baseline 模式；旧 Android 4.23 专项作为兼容模式。 |
| Web 专项 report targets | 降级为历史/迁移辅助，不作为主覆盖报告来源。 |

### 13.3 正式执行推荐流程

正式发版 E2E 推荐一条命令：

```bash
e2e_full_run \
  --client android:a@4.23.0 \
  --client android:b@4.23.0 \
  --install-mode clean \
  --matrix-mode pair \
  --account-mode fresh
```

`e2e_full_run` 内部固定顺序：

```text
1. e2e_prepare
2. e2e_run
3. e2e_api_coverage
```

它不引入新的事实来源，只是编排三个阶段。

分步命令只用于调试和排障：

```bash
e2e_prepare ...
e2e_run --run-context out/run/<run_id>/context.yaml --reuse-context
e2e_api_coverage --run-context out/run/<run_id>/context.yaml --case-results out/test-results/<run_id>-case-results.json
```

正式 E2E 每次都应执行 prepare。直接 `e2e_run --run-context <old>` 复用旧 context 只允许调试，并必须显式带 `--reuse-context`；复用 context 的结果不作为正式发版默认覆盖依据。

### 13.4 `e2e_full_run` 参数归属

`e2e_full_run` 是正式入口，用户只传一次参数。内部按职责分发给 `e2e_prepare`、`e2e_run` 和 `e2e_api_coverage`。

| 参数 | 归属阶段 | 示例 | 含义 |
|---|---|---|---|
| `--client` | prepare | `android:a@4.23.0` | 请求准备客户端。 |
| `--sdk-version` | prepare | `android=4.23.0` | 平台级 SDK 版本，用于补齐未在 client 上声明的版本。 |
| `--install-mode` | prepare | `clean` | App 安装策略。 |
| `--matrix-mode` | prepare + run | `pair` | prepare 写入 run_plan 并校验客户端数量；run 阶段展开 case 角色绑定。 |
| `--account-mode` | prepare | `fresh` | 账号准备模式。第一版确认 `fresh`。 |
| `--init` / `--no-init` | prepare | `--no-init` | 是否在 prepare 阶段调用 `Client.init`。 |
| `--sdk-options-profile` | prepare | `default` | SDK init 配置 profile。 |
| `--device-mode` | prepare | `auto` | 设备准备策略。 |
| `--run-id` | all | `android-20260706-001` | 贯穿 context、日志、case-results、coverage。 |
| `--config` | prepare + run | `config.yaml` | 敏感配置来源。 |
| `-m` / `--mark` | run | `real_e2e` | pytest marker 表达式。默认 `real_e2e`。 |
| `--api` | run + coverage | `ChatManager.sendMessage` | 只跑/统计某个 API。 |
| `--case-id` | run | `chat.send_message.text.success` | 只跑某个 case。 |
| `--target-platform` | run + coverage | `android` | 限定目标平台；通常从 context 推导。 |
| `--pytest-args` | run | `"tests/chat -q"` | 透传 pytest 额外参数，调试用。 |
| `--skip-api-coverage` | full_run | 无 | 只跑 case，不生成 API 覆盖。调试用。 |

正式默认行为：

```text
--install-mode clean
--account-mode fresh
--init
--device-mode auto
-m real_e2e
生成 pytest-html
生成 Allure
生成 case-results
生成 api-coverage
生成 gap-backlog
```

`--matrix-mode` 建议正式命令显式传入。示例使用 `pair`。如果未来需要默认值，可以按 client 数量推导：client 数量为 1 时默认 `smoke`，client 数量大于等于 2 时默认 `pair`。

### 13.5 `e2e_full_run` 阶段失败规则

| 阶段 | 失败时行为 |
|---|---|
| `e2e_prepare` 失败 | 不执行 `e2e_run`，不执行 `e2e_api_coverage`，输出 prepare failure summary。 |
| `e2e_run` 有失败 case | 仍执行 `e2e_api_coverage`，API 覆盖表和 gap backlog 中体现 `failed_case`。 |
| `e2e_run` 基础环境整体失败，例如 DNS/init/login 全局失败 | 生成 case 失败摘要；可执行 API coverage，但应把相关 API 标记为环境失败，不误判为缺 case。 |
| `e2e_api_coverage` 失败 | `e2e_full_run` 最终失败，但保留 pytest-html、Allure、case-results。 |

原则：

```text
case 失败本身是覆盖结论的一部分，所以 run 阶段失败后仍应尽量生成 api-coverage 和 gap-backlog。
prepare 失败表示没有有效测试环境，不能继续执行 case。
```

## 14. API 缺失统计和补齐 backlog

API 缺失统计不应依赖 pytest-html/Allure。pytest-html/Allure 只回答 case 是否通过；API 缺失和补齐动作由 `e2e_api_coverage` 生成。

### 14.1 输入

| 输入 | 用途 |
|---|---|
| `context.yaml` | 当前 run_id、平台、SDK 版本、平台角色、客户端组合。 |
| Android/iOS 真实 SDK 扫描 | 形成第一版 baseline。 |
| Android/iOS/Web MethodKey / 等价 key 扫描 | 判断平台 key 是否存在。 |
| wrapper 实现扫描 | 判断是否真实处理、是否调用真实 SDK。 |
| pytest marker 扫描 | 判断哪些 case 覆盖了 `Manager.methodKey`。 |
| pytest 执行结果 / case-results | 判断本次是否执行、是否通过。 |
| `sdk_version_capability_policy.yaml` | 处理版本差异、平台专属、暂不覆盖、别名。 |

### 14.2 输出

| 输出 | 用途 |
|---|---|
| `out/api-coverage/<run_id>-api-coverage.html` | 可过滤的 API 覆盖主表。 |
| `out/api-coverage/<run_id>-api-coverage.csv` | 机器可读覆盖明细。 |
| `out/api-coverage/<run_id>-gap-backlog.csv` | 给补 API 用的缺口清单。 |
| `out/api-coverage/<run_id>-summary.json` | 汇总统计，供 CI 或后续工具读取。 |

### 14.3 gap 类型和补齐动作

| gap_type | 含义 | target_action |
|---|---|---|
| `method_key_missing` | baseline 有能力，目标平台没有 MethodKey / 等价 key。 | `add_method_key_or_mark_policy` |
| `wrapper_missing` | MethodKey 存在，但 wrapper 没有分发或没有处理。 | `implement_wrapper` |
| `unimplemented` | 找到入口，但没有真实 SDK 调用，可能是空实现、本地模拟或 local adapter。 | `replace_with_real_sdk_or_mark_policy` |
| `missing_case` | wrapper 已实现，但没有真实 E2E case。 | `add_real_e2e_case` |
| `failed_case` | 有真实 E2E case，但本次失败。 | `debug_case_with_pytest_report` |
| `version_gap` | 目标平台当前 SDK 版本不支持。 | `record_version_policy` |
| `not_applicable` | 平台确实不适用。 | `record_not_applicable_policy` |
| `covered` | 已有真实 E2E 通过。 | `none` |

### 14.4 gap-backlog 字段

| 字段 | 含义 |
|---|---|
| `run_id` | 本次运行 ID。 |
| `api` | `Manager.methodKey`。 |
| `manager` | SDK manager。 |
| `method_key` | MethodKey / cmd。 |
| `platform` | 缺口所在平台。 |
| `platform_role` | baseline / target。 |
| `sdk_version` | 当前平台 SDK 版本。 |
| `gap_type` | 缺口类型。 |
| `target_action` | 建议补齐动作。 |
| `source_platform` | 该能力来自哪个 baseline 平台。 |
| `source_evidence` | baseline 证据，例如原生 API、wrapper 文件、MethodKey。 |
| `case_id` | 关联 case，若无则为空。 |
| `pytest_report` | 失败 case 的 pytest-html/Allure 链接。 |
| `reason` | 中文原因。 |
| `priority` | P0/P1/P2。 |

### 14.5 补齐闭环

```text
e2e_api_coverage 生成 gap-backlog
-> 按 gap_type 补 MethodKey / wrapper / policy / case
-> 重新 e2e_run
-> 重新 e2e_api_coverage
-> gap 从 missing/unimplemented/missing_case/failed_case 收敛到 covered 或明确 policy
```

## 15. 尚未最终确认的问题

| 问题 | 当前倾向 |
|---|---|
| 何时引入 `semantic_apis`？ | 第一版先用 `Manager.methodKey` 和 `method_key_aliases`；当别名和语义差异变多时再引入。 |
| 账号是在 prepare 准备还是 pytest fixture 准备？ | 倾向 prepare 准备基础账号池，不登录；pytest fixture 负责登录和业务关系。 |
| `roles_mode("ordered")` 在 `matrix-mode full` 下是否默认展开所有有序组合？ | 倾向默认不自动 full，除非 fixture 声明可为每组准备业务身份。 |
| 是否允许 client 没有 SDK 版本？ | 不允许。可以不写 `--sdk-version` 参数名，但每个 `--client` 必须通过 `@version` 或平台级 `--sdk-version` 解析出明确版本。 |
