# Flutter SDK API 自动化测试（Cases 端）

通过 WebSocket 与 Flutter demo 端通信，对环信 Flutter SDK 的 API 做自动化测试。Flutter 端需连接**同一 WebSocket 服务**且使用**相同 topic**。

## WebSocket 两种用法

1. **请求/响应**：`api.call(manager, cmd, info)` — 发一条请求，等一条对应响应（按 id/sequence 匹配），适合单次调用、结果断言。
2. **纯接收（主动下发）**：`MessageListener` — 连接后只收不发，用于拿服务端主动推送的消息（如事件、多端回调）。
   - `message_listener.start()` 后，用 `receive_message(match_cmd=..., match_event_type=..., timeout=...)` 按条件取**第一条匹配**消息。
   - **多条/不匹配**：未匹配到的消息会进缓冲，下次 `receive_message` 会先查缓冲（可换条件或 `match_cmd`/`match_event_type` 都不传取任意一条）；`drain_buffer()` 可一次性取出当前缓冲并清空。

## 协议说明

- **请求**：`{ "manager", "cmd", "info", "id"? | "sequence"? }`，可选 `type`、`objId`、`device`（多端）。
- **成功响应**：原请求体带回 `result`，去掉 `info`，即含 `cmd`、`manager`、`result`。
- **失败响应**：`{ "success": false, "error": { "code", "description" }, "id"? }`。

## 环境

- Python 3.9+
- 安装依赖：`pip install -r requirements.txt`

## 配置

`cp config.yaml.template config.yaml`
- `websocket.base_url`：WS 服务地址（与 Flutter 端一致）。
- `websocket.default_topic`：默认 topic（与 Flutter 端 `IMWebSocketBridge.instance.start(topic: '...')` 一致）。
- 设置 `NATIVE_AUTO_TEST_RUN_ID` 后，topic 会按 `{topic_prefix}-{run_id}-{device}` 动态生成，
  适合长期回归和 CI 并发。
- 未设置 `NATIVE_AUTO_TEST_RUN_ID` 时，run id 固定为 `local`，topic 默认按
  `{topic_prefix}-local-{device}` 生成。

## 本地 WebSocket Relay

长期回归使用本地 topic relay：

```bash
python -m src.tools.local_ws_relay --host 127.0.0.1 --port 2000
```

配置：

```yaml
websocket:
  base_url: "ws://127.0.0.1:2000/iov/websocket/dual"
```

动态 topic 示例：

```bash
export NATIVE_AUTO_TEST_RUN_ID="$(date +%Y%m%d-%H%M%S)"
python -m src.tools.web_launch_urls \
  --app-url http://localhost:8080 \
  --bridge-url ws://127.0.0.1:2000/iov/websocket/dual
```

输出会包含 `webA` / `webB` 各自的启动 URL。两个 Flutter Web 测试端分别用对应
URL 打开后，再运行：

```bash
pytest tests/web --target-platform web -m web -v
```

## 运行用例

```bash
# 运行全部用例
pytest

# 只跑 Client 相关
pytest -m client

# 生成 HTML 报告
pytest --html=out/report.html --self-contained-html

# 使用当前动态 topic 规则运行 Client 用例
pytest tests/test_client.py -v
```

## 报告

- **HTML 报告**：`pytest --html=out/report.html --self-contained-html`，用浏览器打开 `out/report.html`。
- **Allure**（推荐）：依赖已写入 `requirements.txt`。运行后报告会包含请求、响应、比对结果等详情。
  ```bash
  pytest --alluredir=out/allure-results
  allure serve out/allure-results
  ```
  **报告中会输出：**
  - **请求**：每次 `api.call` 的请求体（manager、cmd、info、topic、device 等）以 JSON 附件挂在对应 step 下。
  - **响应**：该次调用的完整响应 JSON 附件。
  - **比对结果**：调用 `assert_response_matches` 时，会附加「预期响应」「实际响应」「比对结果」；不一致时为「比对结果（差异）」并列出缺少/多出/值不同的字段。

## 多端测试（多 topic）

- 框架按 `device` 自动生成 topic，例如 `im-auto-local-deviceA`、`im-auto-local-deviceB`。
- 设置 `NATIVE_AUTO_TEST_RUN_ID` 可让每次运行生成独立 topic，避免并发或历史连接串消息。

## Flutter Web Regression

Web 平台长期通过 `im_flutter_test` 测试 App 接入，不在 `im_flutter_sdk` 中新增
Web 平台包，也不使用一次性 Node driver。Web 端目标行为与 Android/iOS 一致：
`webA/webB` 作为设备对参与 session 自动登录、清回调、`startCallback`、case
执行和 logout。

推荐使用一键编排命令。它会启动本地 relay、`im_flutter_test` Flutter web-server、
两个 headless Chrome 端，并在 pytest 结束后清理进程：

```bash
make web-e2e ARGS="-- tests/web --target-platform web -v"
```

一键编排命令默认会生成 pytest HTML 报告，输出目录固定为：

```text
/Users/dujiepeng/work/qa/hub_all/im_flutter_sdk/native-auto-test/out
```

默认报告文件名使用 run id，例如：

```text
out/web-20260629-150639.html
```

如果 pytest 参数里已经显式传入 `--html` 或 `--html=...`，则使用调用方指定的 HTML 路径，不再追加默认报告参数。
pytest 执行结束后，无论用例通过或失败，都会重新扫描当前代码和覆盖配置，并刷新：

```text
out/platform-api-support.html
out/platform-api-support.csv
```

需要固定 run id 时：

```bash
make web-e2e ARGS="--run-id web-local-smoke -- tests/web --target-platform web -v"
```

等价 Python module 命令：

```bash
python -m src.tools.web_e2e_runner -- tests/web --target-platform web -v
```

Web API 覆盖报告可用下面命令刷新：

```bash
make web-coverage-report
```

Web real E2E 审计文档可用下面命令刷新：

```bash
python -m src.tools.web_real_e2e_no_real_api_audit \
  --output docs/agents/web/WEB_REAL_E2E_NO_REAL_API_AUDIT.md
```

推荐统一刷新 real Web 文档：

```bash
make web-real-docs
```

该命令会同时刷新 matrix、coverage report、no-real-api audit，并对审计分类执行严格校验。

当前推荐的全量 real Web 基线执行入口：

```bash
make web-real-full-baseline
```

等价命令：

```bash
python -m src.tools.web_e2e_runner \
  --run-id web-real-full-baseline \
  --web-sdk-mode real_sdk \
  --headless-startup-wait 150 \
  --startup-timeout 240 \
  --flutter-timeout 300 \
  -- tests/web_real --target-platform web -q
```

2026-06-23 当前基线结果：
- `63 passed`
- `1 warning`
- 耗时约 `205.51s`

排障时也可以继续使用手动流程：

1. 启动 WebSocket 服务，保持 `websocket.base_url` 与 Flutter Web 端一致。
2. 设置 `NATIVE_AUTO_TEST_RUN_ID` 并用 `python -m src.tools.web_launch_urls` 输出
   `webA` / `webB` 两个启动 URL。
3. 启动两个 Flutter Web 测试端，分别打开对应 URL。
4. 运行 Web regression：

```bash
pytest tests/web --target-platform web -m web -v
```

只做离线 fixture/capability 测试时可跳过 session 登录：

```bash
pytest tests/web/test_web_fixture.py tests/web/test_capabilities.py --skip-global-login -q
```

Web E2E 默认使用 `real_sdk`，即通过 `im_flutter_sdk_web` 调用真实 Web IM SDK / 真实 IM 服务端。只有明确做 wrapper JSON 映射验证时，才手动指定 Web 兼容模式 `local_adapter`。

API 能力差异由 `config/web_capabilities.yaml` 表达：

- `supported`：正常执行并断言成功。
- `unsupported`：运行并断言稳定 unsupported/error。
- `pending`：跳过，不计入失败。
- `different`：运行 Web 专属期望。

## 项目结构

```
flutter-auto-test/
├── config.yaml           # WebSocket 与 topic 配置
├── pyproject.toml
├── requirements.txt
├── pytest.ini
├── src/
│   ├── config.py         # 读取 config.yaml
│   ├── ws_client.py     # WebSocket 请求/响应、多 topic
│   ├── assertions.py    # 成功/失败、result 断言
│   └── response_match.py # 预期 JSON 比对、占位符、忽略时间戳
└── tests/
    ├── conftest.py      # api、assert_api、ws_topic 等 fixture
    ├── test_client.py   # Client 登录/登出等
    └── test_client_init.py
```
## Specs & Testing System

- 文档入口：
  - 用例规范（通用 + 模块速查）：`docs/spec/CASES_SPEC.md`
  - 依赖升级：`docs/spec/DEPS_SPEC.md`
  - Agent 执行总规范：`docs/agents/AGENTS.zh.md`
  - 用例风格以 `docs/spec/CASES_SPEC.md` 为准（其他模块请按该规范收敛：最小忽略集、禁止自证式 result、稳定后锁定唯一真实返回、不再分支判断）。

- 断言收敛（长期稳定）：
  - 仅使用两类断言：assert_api.assert_response_matches、assert_api.assert_error
  - 成功体必须断言 result 全结构；未知时先发现（CASES_DISCOVER=1）后冻结
  - 最小忽略集：sequence/id、所有时间类、broadcast/onlineState、偶发 receiverList；翻译 targetLanguages/deliverOnlineOnly 暂忽略

- 发现 → 严格：
  - 发现单例：CASES_DISCOVER=1 WS_DEBUG=1 pytest -q tests/test_chat.py::test_chat_send_and_received -s
  - 严格复跑：pytest -q tests/test_chat.py::test_chat_send_and_received -s
  - 全量（排除已知 bug）：pytest -q tests/test_chat.py -s -k 'not test_chat_translate_message_nonexistent_message'

- 依赖升级（4.19.1）：
  - cd im_flutter_sdk && HY_CHAT_VERSION=4.19.1 ./scripts/update_hyphenate.sh all --build
  - 详见 docs/spec/DEPS_SPEC.md

## 断言用法

- `assert_api.assert_success(resp)`：要求成功。
- `assert_api.assert_error(resp, code=..., description=...)`：要求失败并校验错误。
- `assert_api.assert_result_equals(resp, expected)`：`result == expected`。
- `assert_api.assert_result_matches(resp, key=value, ...)`：`result` 为 dict 且包含指定键值。

### 预期 JSON 比对（占位符 + 忽略时间戳）

- `assert_api.assert_response_matches(actual, expected, context=None, ignore_keys=None)`：用预期 JSON 与 actual 比对，**不一致时列出所有差异**。
- **占位符**：在 expected 里用 `{{key}}` 或 `{{path.to.key}}`，从 `context` 取值替换（如请求里的 userId 可带入预期）。
- **忽略字段**：时间戳等变化字段默认不参与比对（见 `response_match.DEFAULT_IGNORE_KEYS`）；可传 `ignore_keys` 追加。
- **比对规则**：只校验 expected 中出现的键；actual 多出的键不报错；列表按顺序逐项比对。

示例：

```python
# 请求参数已知，带入预期
context = {"userId": USER_B, "request": {"info": {"userId": USER_B}}}
assert_api.assert_response_matches(
    resp_add,
    expected={"manager": "ContactManager", "cmd": "addContact", "result": "{{userId}}"},
    context=context,
)
# 需额外忽略的 key
assert_api.assert_response_matches(actual, expected, ignore_keys={"requestId"})
```


from src import gt, lt, ne, ge, le, eq
assert_api.assert_response_matches(
    resp_status,
    expected={
        "manager": "PresenceManager",
        "cmd": Cmd.fetchPresenceStatus.value,
        "result": [
            {
                "statusDescription": eq("online"),   # 等于字符串
                "publisher":         "{{publisher}}", # 占位符，同之前
                "lastTime":          gt(0),           # 大于 0
                "expiryTime":        gt(0),           # 大于 0
                "active":            ne(False),       # 不等于 false
            }
        ],
    },
    context={"publisher": USER_A},
    ignore_keys={"statusDetails"},
)

## Repo-local Skills

This repository includes Codex skills under `skills/` following the create-skill guidelines:

- `skills/native-auto-test-framework` — primary entry for SDK API coverage, Web/Android/iOS parity, case design, WebSocket calls, REST user setup, release-note mapping, and report rules.
- Legacy helper entries remain for old prompts and scripts:
  - `skills/im-ws` — WebSocket request/response and event listening scripts.
  - `skills/im-rest-users` — REST user provisioning scripts.
  - `skills/im-contact-flow` — contact flow setup script.
  - `skills/release-note-case-mapping` — release-note mapping compatibility entry.

Start with `skills/native-auto-test-framework/SKILL.md`; read its `references/` files only for the task-specific details you need. Make sure `config.yaml` is configured before using helper scripts.

## Make Tasks

- Show help
  - `make help`
- WebSocket
  - Call once: `make ws-call MANAGER=ContactManager CMD=addContact INFO='{"userId":"u2"}' [DEVICE=device_a]`
  - Call and wait for event: `make ws-call MANAGER=ContactManager CMD=addContact INFO='{"userId":"u2"}' EVENT=CONTACT_INVITED`
  - Wait for first matching event: `make ws-wait EVENT=CONTACT_INVITED [DEVICE=device_b] [TIMEOUT=15]`
- REST users
  - Create: `make create-users USERS='uA uB' [PASSWORD=1]`
  - Create from file: `make create-users FROM_FILE=users.json`
  - Delete: `make delete-user USERNAME=uA`
- Contact flow
  - Establish friends: `make contact-establish INITIATOR_DEVICE=device_a PEER_DEVICE=device_b USER_A=uA USER_B=uB [REASON=flow]`
  - Delete friend: `make contact-delete INITIATOR_DEVICE=device_a FRIEND_USER_ID=uB [KEEP_CONVERSATION=1]`
  - Block/Unblock: `make contact-block DEVICE=device_a USER_ID=uB` / `make contact-unblock DEVICE=device_a USER_ID=uB`

Tips
- JSON 参数请用单引号包裹（避免 shell 转义）。
- 运行前确保 `config.yaml` 配置正确；REST 需 `rest_api.base_url`、`rest_api.app_key`，以及 `rest_api.auth_token` 或 `rest_api.client_id/client_secret`。
- 校验技能目录：`make skills-validate`。

pytest -q tests -s --alluredir=out/allure-results
allure generate out/allure-results -o out/allure-report --clean
open out/allure-report/index.html
