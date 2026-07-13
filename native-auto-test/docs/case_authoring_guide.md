# Native Auto Test Case Authoring Guide

本文定义 `native-auto-test/` 用例的长期编写规范，覆盖文件命名、case 格式、中文步骤、断言方式、事件等待、执行入口和报告查看方式。

## 适用范围

本文适用于 `native-auto-test/tests/` 下的可执行 pytest 用例，尤其是真实 SDK E2E 用例。

真实 E2E 必须走完整链路：

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
-> WebSocket event/response
-> native-auto-test assertions
```

wrapper mapping、fixture、local adapter、unit test 可以存在，但不能算真实 SDK E2E 覆盖，也不能混入默认 Android 全量真实 E2E。

## 目录和文件命名

测试文件只放在 `native-auto-test/tests/` 下，文档、台账和报告不要放进 `tests/`。

推荐目录：

```text
tests/client/
tests/contact/
tests/chat/
tests/chatroom/
tests/group/
tests/presence/
tests/push/
tests/user_info/
tests/tools/
tests/web/
tests/web_real/
```

文件命名规则：

| 类型 | 命名 | 示例 |
|---|---|---|
| 领域主路径 | `test_<domain>.py` | `tests/contact/test_contact.py` |
| Manager 补齐覆盖 | `test_<domain>_remaining_api_coverage.py` | `tests/chat/test_chat_manager_remaining_api_coverage.py` |
| 特定能力分组 | `test_<domain>_<feature>.py` | `tests/chat/test_chat_reaction_fetch.py` |
| 异常矩阵 | `test_<domain>_exceptions_<feature>.py` | `tests/group/test_group_exceptions_lifecycle.py` |
| 语义主题分组 | `test_<domain>_<feature_or_behavior>.py` | `tests/chat/test_chat_non_message_operations.py` |
| 工具单测 | `tests/tools/test_<tool_name>.py` | `tests/tools/test_android_e2e_runner.py` |

命名要求：

- 文件名使用小写 snake_case。
- 禁止使用不透明阶段编号或历史组合编号，例如 `s1`、`s2`、`s3`、`s4`、`s23`、`s423`。应改成可读业务语义，例如 `local_conversation_store`、`non_message_operations`、`message_callbacks_and_combine`。
- 文件名体现领域和能力，不使用 `test_tmp.py`、`test_debug.py`、`test_new.py`。
- 临时探测用例不能并入默认全量；确需保留时必须有明确 skip/xfail 原因，或放入更合适的工具测试。
- Web wrapper mapping 放 `tests/web/`，真实 Web SDK E2E 放 `tests/web_real/`，不要互相混用。

## Case 命名

case 函数使用：

```text
test_<domain>_<api_or_behavior>_<condition>_<expected_result>
```

示例：

```python
def test_chat_add_reaction_invalid_id_response(...):
    ...

def test_group_update_avatar_success(...):
    ...

def test_contact_remove_from_block_list_when_not_blocked(...):
    ...
```

命名要求：

- 能从函数名看出被测领域、行为、条件和预期。
- 成功路径以 `success`、`event`、`sync`、`fetched` 等稳定语义结尾。
- 错误路径以 `error`、`response`、`invalid_*`、`not_found`、`permission_denied` 等稳定语义表达。
- 不使用 `case1`、`normal`、`abnormal`、`test_api` 这类无法复现的名字。

## Marker 规范

真实 SDK E2E case 必须标记：

```python
@pytest.mark.real_e2e
```

推荐补充业务元信息：

```python
@pytest.mark.case_id("chat.add_reaction.invalid_id.response")
@pytest.mark.api("ChatManager.addReaction")
@pytest.mark.clients("primary", "remote")
@pytest.mark.roles_mode("ordered")
@pytest.mark.expects_event
```

常用 marker：

| marker | 用途 |
|---|---|
| `real_e2e` | 真实 SDK、真实服务、真实桥接链路。 |
| `case_id("<id>")` | 稳定 case id，用于报告和覆盖映射。 |
| `api("<Manager.method>")` | 关联 SDK API。 |
| `clients(...)` | 声明参与客户端语义。 |
| `roles_mode("ordered")` | 声明 fixture/client 顺序有意义。 |
| `expects_event` | 声明需要 SDK callback/event 证据。 |
| `topology_ready` | 已迁移到 topology client/account 语义，可进入正式 topology E2E。 |
| `no_global_login` | 仅用于工具/特殊测试，真实 E2E 默认不应使用。 |

新增 marker 前先检查 `pytest.ini`，不要临时发明未注册 marker。

## 中文步骤规范

每个真实 E2E case 必须在 Allure 描述中写清中文手动复现步骤。使用：

```python
from tests.case_steps import describe_case_steps
```

格式要求：

- 使用中文。
- 必须编号。
- 每一步单独换行。
- 格式为 `1. ...；\n2. ...；\n3. ...。`
- 步骤要能让人工按真实客户端和 API 复现，不写“验证功能正常”这种空泛描述。

示例：

```python
def test_chat_add_reaction_invalid_id_response(device_a, assert_api):
    describe_case_steps(
        "1. 使用已登录 Android 客户端作为操作端；\n"
        "2. 调用 ChatManager.addReaction，传入不存在的 msgId 和 reaction；\n"
        "3. 校验 SDK 返回 Unknown server error，不产生消息 reaction 成功事件。"
    )
```

建议同时保留函数 docstring，内容与 `describe_case_steps` 一致或更简略，方便不打开 Allure 时阅读源码。

## Fixture 和拓扑语义

新 case 优先使用 topology 语义，不要继续扩大旧 `device_a/device_b` 心智模型。

当前 Android 拓扑：

```text
primary_a: Android SDK client，登录 primary 账号
primary_b: Android SDK client，登录同一个 primary 账号
remote_c: Android SDK client，登录 remote 账号
```

语义：

- `primary`：被测账号。
- `remote`：与被测账号交互的对端账号。
- `primary_a` / `primary_b`：同一账号的多设备。
- `remote_c`：另一个账号的真实 SDK 客户端。

消息类 case 常见断言：

- `remote_c -> primary`：`primary_a` 和 `primary_b` 都应收到消息。
- `primary_a -> remote_c`：`primary_a` 收到发送成功；`primary_b` 收到同账号消息同步；`remote_c` 收到对端消息。
- 账号内状态操作，如会话置顶：`primary_b` 应收到同账号同步，`remote_c` 不应收到账号内状态事件。

本地-only 操作可以只断言本地插入和读取一致，不强行要求多设备同步。

设备控制类操作可以改变角色。例如 `primary_a` 踢掉 `primary_b` 时，`primary_b` 是事件接收者。

## Case 基本结构

推荐结构：

```python
@pytest.mark.real_e2e
@pytest.mark.case_id("chat.send_message.text.success")
@pytest.mark.api("ChatManager.sendMessage")
@pytest.mark.expects_event
def test_chat_send_message_text_success(topology, assert_api):
    describe_case_steps(
        "1. 使用 primary_a 和 remote_c 登录两个不同账号；\n"
        "2. primary_a 调用 ChatManager.sendMessage 发送文本消息给 remote_c；\n"
        "3. 校验 primary_a 收到发送成功回调，remote_c 收到消息事件。"
    )

    primary_a = topology.client("primary_a")
    remote_c = topology.client("remote_c")
    primary_user = topology.user("primary")
    remote_user = topology.user("remote")

    primary_a.drain_events()
    remote_c.drain_events()

    content = f"send-text-{uuid.uuid4().hex[:6]}"
    response = primary_a.call(
        "ChatManager",
        Cmd.sendMessage.value,
        info=build_text(primary_user, remote_user, content),
    )

    success_event = wait_for_success_message(
        primary_a,
        from_user=primary_user,
        to_user=remote_user,
        content=content,
    )

    assert_api.assert_response_matches(
        response,
        expected={...},
        context={...},
        ignore_keys={"sequence", "serverTime", "localTime"},
    )
    assert_api.assert_response_matches(
        success_event,
        expected={...},
        context={...},
        ignore_keys={"sequence", "timestamp", "serverTime", "localTime"},
    )
```

旧 case 如果还在使用 `device_a`、`device_b`、`user_a`、`user_b`，可以暂时保留在代码里作为待迁移资产，但不能进入正式 topology run。case 完成 topology 迁移后必须添加 `@pytest.mark.topology_ready`。

## 断言规范

成功响应优先使用：

```python
assert_api.assert_response_matches(actual, expected=..., context=..., ignore_keys=...)
```

错误响应优先使用：

```python
assert_api.assert_error(resp, code=110, description="...")
```

断言要求：

- 禁止用实际结果拼完整 expected 后再断言。
- 禁止只断言 `resp is not None`、`result is not None`、WebSocket 有返回。
- 稳定字段必须断言，如 `manager`、`cmd`、`type`、`eventType`、`code`、关键业务字段。
- `ignore_keys` 保持最小，只忽略时间、sequence、服务端生成 id 等不稳定字段。
- 错误 code 和 description 如果已稳定，应冻结到断言里。
- 如果 description 与预期不同，先记录实际返回并列出差异，不要静默放宽。

事件断言必须至少包含：

```python
expected={
    "type": "event",
    "eventType": Cmd.onMessagesReceived.value,
    "data": {...},
}
```

## 事件等待和污染处理

事件等待不能只按 `eventType` 拿第一条。必须使用可关联字段过滤，例如：

- `msgId`
- `content`
- `from`
- `to`
- `convId`
- `groupId`
- `chatroomId`
- `threadId`
- 操作生成的唯一 name / reason / ext 字段

消息发送特别注意：

- `sendMessage` 同步响应里的 `msgId` 可能是临时 id。
- 成功消息 id 应以发送成功事件里的最终 `msgId` 为准。
- 需要对接收端操作时，优先使用接收端真实收到的消息 id。

case 开始前可以 `drain_events()` 清理当前队列，但不能把它当作唯一隔离手段。事件断言必须能忽略无关事件，并通过业务字段匹配目标事件。

当一个操作会产生多个客户端事件时，使用事件组思路：

- 发送端成功事件。
- 同账号其他设备同步事件。
- 对端接收事件。
- 不应收到事件的客户端要断言 forbidden event。

没有稳定独立 id 的事件，例如好友、踢设备、聊天室成员变化，需要在请求里构造唯一 reason/name/ext，或用操作对象、操作者、目标用户和时间窗口组合匹配。

## 数据准备和清理

case 只负责业务数据准备，不负责 relay、App 安装、SDK init 和全局登录。

规则：

- 不要在普通 case 中 logout。会破坏共享 session，导致后续 case 登录状态污染。
- 需要改变登录态的 case 必须隔离到专门文件或 marker，并从默认共享 session 全量中剔除。
- 好友、群、聊天室、presence 等前置数据优先使用已有 flow/helper。
- 清理失败不能掩盖主断言；必要时 cleanup 使用 `wait_event=False` 或容忍已不存在。
- 测试内容使用唯一前缀，例如 `s3-history-<uuid>`，便于事件过滤和人工排查。

## Skip、XFail 和环境失败

真实服务能力未开通、SDK 当前版本不支持、平台未实现时，可以 skip/xfail，但必须写中文原因。

适用方式：

```python
pytest.skip("Android 4.23.0 当前不支持 xxx API，见 sdk_version_capability_policy.yaml")
pytest.xfail("当前 appkey reaction 服务返回 303 Unknown server error，按服务能力限制处理")
```

环境级失败不要伪造成 case 失败：

- DNS 不通。
- SDK init 失败。
- 登录整体失败。
- bridge 无法连接。
- 大量 SDK `onDisconnected`。

这些情况应先停止或判定本次 run 环境失败，修复环境后重跑。

## 正式执行方式

Android 正式全量入口：

```bash
cd native-auto-test
make e2e-full-run ARGS="--topology config/topologies/android-primary-dual-remote.yaml --device primary_a=emulator-5554 --device primary_b=emulator-5556 --device remote_c=emulator-5560 --run-id <run_id> --install-mode clean -- --target-platform android"
```

带 `--run-context` 的正式 topology run 只执行已标记 `topology_ready` 的真实 E2E case。未迁移的旧 fixture case 会被跳过，并在报告中显示“仍需从 device_a/device_b 旧语义迁移”的中文原因。

Android sanity：

```bash
cd native-auto-test
make android-real-sanity ARGS="--device-ids emulator-5554 emulator-5556 --run-id <run_id>"
```

单 case 调试：

```bash
cd native-auto-test
make android-real-e2e ARGS="--device-ids emulator-5554 emulator-5556 --run-id <run_id> -- tests/chat/test_chat_crud.py::test_chat_send_and_received --target-platform android -m real_e2e -q"
```

不推荐直接 `pytest tests ...` 作为正式报告入口，因为它不负责设备启动、App 安装、relay、Client.init、topic 编排和 API gap backlog。

## 报告查看

Android runner 默认产物：

```text
out/run/<run_id>/context.yaml
out/log/android/<run_id>-android-pytest.html
out/log/android/<run_id>-allure-results/
out/test-results/<run_id>-case-results.json
out/test-results/<run_id>-case-results.csv
out/api-coverage/<run_id>-gap-backlog.csv
```

生成静态 Allure：

```bash
cd native-auto-test
allure generate out/log/android/<run_id>-allure-results -o out/log/android/<run_id>-allure-report --clean
python3 -m http.server 8035 --bind 127.0.0.1 --directory out/log/android/<run_id>-allure-report
```

浏览：

```text
http://127.0.0.1:8035/
```

不要直接用浏览器打开 `allure-results/`。`allure-results/` 是原始 JSON 结果目录，直接打开会 404 或 loading。

## 新增 API Case Checklist

新增或补齐一个 API 时按以下顺序处理：

1. 确认当前测试版本真实原生 SDK 是否存在该 API。
2. 确认 Flutter wrapper、MethodKey 或等价 key 是否暴露。
3. 确认 `src/sdk_api/cmd_keys.py` / `event_keys.py` 是否已有 cmd/event。
4. 设计至少一条成功路径和一条关键错误/边界路径。
5. 明确证据：同步响应、发送端 callback、同账号同步、对端事件、服务端状态、本地状态。
6. 编写中文 Allure 步骤。
7. 使用严格断言，不用实际结果自证。
8. 单 case 跑通后再并入模块或全量。
9. 更新或确认 API 覆盖统计能关联该 case。

## Review Checklist

提交前自查：

- 文件名、case 名能表达领域、API、条件和预期。
- case 有 `@pytest.mark.real_e2e` 或明确属于非 E2E 层。
- case 有中文编号步骤。
- 没有普通 case 调用 logout。
- 没有直接依赖前一个 case 的状态。
- 事件等待包含业务过滤条件。
- `ignore_keys` 没有过度放宽。
- 错误 code/description 按实际稳定返回冻结。
- 运行命令能生成 HTML、Allure results、case-results。
- 正式 Android 全量使用 `e2e-full-run --topology`。
- 进入正式 topology run 的 case 已标记 `topology_ready`。
