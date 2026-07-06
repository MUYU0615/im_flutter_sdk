# SDK E2E 入口与报告第一阶段实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `native-auto-test/` 中落地统一的 SDK E2E 执行入口，形成 `prepare -> pytest -> api coverage` 的固定链路，并输出可追踪的 context、case 结果和 API 缺失 backlog。

**Architecture:** `e2e_full_run` 是正式入口，内部顺序调用 `e2e_prepare`、`e2e_run`、`e2e_api_coverage`。`e2e_prepare` 只负责环境和 context，`e2e_run` 只负责 pytest 执行和测试结果落盘，`e2e_api_coverage` 只负责 MethodKey 维度的覆盖统计和缺失列表。第一阶段不改 Flutter 桥接层，不实现自动启动模拟器，不实现升级安装链路。

**Tech Stack:** Python 3、pytest hooks、pytest-html、allure-pytest、YAML、CSV、现有 `native-auto-test/src/tools` 工具、现有 WebSocket 测试 fixtures。

---

## 来源

- 设计 spec：`docs/specs/2026-07-06-sdk-e2e-entrypoint-reporting-spec.md`
- 当前计划只实现第一阶段：入口收敛、运行 context、测试结果表、API 缺失统计骨架。

## 第一阶段边界

- 正式全量入口：`make e2e-full-run ARGS="..."`
- 调试入口：`make e2e-prepare`、`make e2e-run`、`make e2e-api-coverage`
- 低层调试：直接 `pytest ...` 仍可用，但不作为正式覆盖报告入口。
- 设备策略：只支持 `--device-mode existing`，即使用当前已经在线的设备或客户端。
- SDK 版本策略：每个 client 必须能解析出明确版本；可写在 `--client android:a@4.23.0`，也可写在 `--sdk-version android=4.23.0`。
- 账号策略：第一阶段 `e2e_prepare` 不重写现有账号创建和登录 fixture，只把运行所需账号策略写入 context；现有 `tests/conftest.py` 继续负责 session 登录。
- 覆盖策略：第一阶段用 `@pytest.mark.api("Manager.methodKey")` 或已有 marker 作为自动化覆盖证据。
- 平台策略：Android、iOS 作为基线平台，Web 作为待追平目标；报告中必须保留平台字段。

## 明确不做

- 不在本计划中修改 `im_flutter_test` 的 login -> `startCallback`。该改动单独建后续计划。
- 不实现 `e2e_upgrade_run`。
- 不实现 `matrix-mode=full` 的完整组合爆炸。
- 不实现历史账号复用、seed 数据、清理策略。
- 不把 Web 本地 adapter、mock、wrapper mapping 结果记为真实 E2E 覆盖。

## 文件结构

- Create `native-auto-test/src/tools/e2e_cli.py`：解析 `--client`、`--sdk-version`、`--matrix-mode`、`--device-mode`。
- Create `native-auto-test/src/tools/e2e_context.py`：定义运行 context、生成 run id、输出 `context.yaml`。
- Create `native-auto-test/src/tools/e2e_prepare.py`：校验参数、生成 run 目录、写 context。
- Create `native-auto-test/src/tools/e2e_case_results.py`：收集 pytest item marker 和执行结果，写 JSON/CSV。
- Create `native-auto-test/src/tools/e2e_run.py`：包装 pytest，自动带上 context、HTML、Allure、case-results 环境变量。
- Create `native-auto-test/src/tools/e2e_api_coverage.py`：读取 case-results，生成 API coverage 和 gap backlog。
- Create `native-auto-test/src/tools/e2e_full_run.py`：串联 prepare、run、coverage。
- Modify `native-auto-test/tests/conftest.py`：注册 marker，增加 case-results pytest hook。
- Modify `native-auto-test/Makefile`：增加统一入口 target。
- Modify `native-auto-test/config.yaml.template`：补充 `sdk_options` 和 E2E 运行配置说明。
- Modify `native-auto-test/README.md`：写清正式入口、调试入口、参数含义、输出产物。
- Modify `.agents/skills/native-auto-test-framework/SKILL.md`：同步新的入口规则。

---

### Task 1: CLI 参数解析

**Files:**
- Create: `native-auto-test/src/tools/e2e_cli.py`
- Test: `native-auto-test/tests/tools/test_e2e_cli.py`

- [ ] **Step 1: 写失败测试**

```python
import pytest

from src.tools.e2e_cli import (
    ClientRequest,
    parse_client_arg,
    parse_sdk_version_arg,
    resolve_client_versions,
)


def test_parse_client_arg_with_client_version():
    assert parse_client_arg("android:a@4.23.0") == ClientRequest(
        platform="android",
        slot="a",
        sdk_version="4.23.0",
    )


def test_parse_client_arg_without_client_version():
    assert parse_client_arg("ios:b") == ClientRequest(
        platform="ios",
        slot="b",
        sdk_version=None,
    )


def test_parse_sdk_version_arg():
    assert parse_sdk_version_arg("android=4.23.0") == ("android", "4.23.0")


def test_resolve_client_versions_from_platform_version():
    clients = [parse_client_arg("android:a"), parse_client_arg("android:b")]
    resolved = resolve_client_versions(clients, {"android": "4.23.0"})
    assert [client.sdk_version for client in resolved] == ["4.23.0", "4.23.0"]


def test_resolve_client_versions_rejects_missing_version():
    with pytest.raises(ValueError, match="android:a 缺少 SDK 版本"):
        resolve_client_versions([parse_client_arg("android:a")], {})


def test_resolve_client_versions_rejects_conflict():
    with pytest.raises(ValueError, match="版本冲突"):
        resolve_client_versions([parse_client_arg("android:a@4.23.0")], {"android": "4.24.0"})


def test_resolve_client_versions_rejects_duplicate_slot():
    with pytest.raises(ValueError, match="slot 重复"):
        resolve_client_versions(
            [parse_client_arg("android:a@4.23.0"), parse_client_arg("ios:a@1.0.0")],
            {},
        )
```

- [ ] **Step 2: 执行失败测试**

```bash
cd native-auto-test
python3 -m pytest tests/tools/test_e2e_cli.py -q
```

Expected: `ModuleNotFoundError: No module named 'src.tools.e2e_cli'`

- [ ] **Step 3: 实现 `e2e_cli.py`**

```python
from __future__ import annotations

import re
from dataclasses import dataclass, replace


CLIENT_RE = re.compile(r"^(?P<platform>[a-zA-Z0-9_-]+):(?P<slot>[a-zA-Z0-9_-]+)(?:@(?P<version>[^@\s]+))?$")


@dataclass(frozen=True)
class ClientRequest:
    platform: str
    slot: str
    sdk_version: str | None = None


def parse_client_arg(value: str) -> ClientRequest:
    match = CLIENT_RE.match(value.strip())
    if not match:
        raise ValueError(f"非法 --client 格式：{value}，期望 <platform>:<slot>@<version>")
    return ClientRequest(
        platform=match.group("platform").lower(),
        slot=match.group("slot"),
        sdk_version=match.group("version"),
    )


def parse_sdk_version_arg(value: str) -> tuple[str, str]:
    if "=" not in value:
        raise ValueError(f"非法 --sdk-version 格式：{value}，期望 <platform>=<version>")
    platform, version = value.split("=", 1)
    platform = platform.strip().lower()
    version = version.strip()
    if not platform or not version:
        raise ValueError(f"非法 --sdk-version 格式：{value}，平台和版本不能为空")
    return platform, version


def resolve_client_versions(
    clients: list[ClientRequest],
    platform_versions: dict[str, str],
) -> list[ClientRequest]:
    seen_slots: set[str] = set()
    resolved: list[ClientRequest] = []
    for client in clients:
        if client.slot in seen_slots:
            raise ValueError(f"slot 重复：{client.slot}")
        seen_slots.add(client.slot)
        platform_version = platform_versions.get(client.platform)
        if client.sdk_version and platform_version and client.sdk_version != platform_version:
            raise ValueError(
                f"{client.platform}:{client.slot} 版本冲突：client={client.sdk_version}, platform={platform_version}"
            )
        sdk_version = client.sdk_version or platform_version
        if not sdk_version:
            raise ValueError(
                f"{client.platform}:{client.slot} 缺少 SDK 版本；"
                f"请使用 --client {client.platform}:{client.slot}@<version> "
                f"或 --sdk-version {client.platform}=<version>"
            )
        resolved.append(replace(client, sdk_version=sdk_version))
    return resolved
```

- [ ] **Step 4: 验证通过**

```bash
cd native-auto-test
python3 -m pytest tests/tools/test_e2e_cli.py -q
```

Expected: `7 passed`

---

### Task 2: Run Context 模型与落盘

**Files:**
- Create: `native-auto-test/src/tools/e2e_context.py`
- Test: `native-auto-test/tests/tools/test_e2e_context.py`

- [ ] **Step 1: 写失败测试**

```python
from pathlib import Path

import yaml

from src.tools.e2e_context import (
    ClientContext,
    RunContext,
    SdkVersionCheck,
    build_run_id,
    context_to_dict,
    write_context,
)


def test_build_run_id_contains_platforms_and_timestamp():
    run_id = build_run_id(["android", "ios"], now_text="20260706-153000")
    assert run_id == "android-ios-20260706-153000"


def test_context_yaml_does_not_include_requested_sdk_version_source(tmp_path: Path):
    ctx = RunContext(
        run_id="android-20260706-153000",
        status="ready",
        matrix_mode="pair",
        device_mode="existing",
        install_mode="clean",
        account_mode="fresh",
        sdk_initialized=True,
        sdk_options_summary={
            "source": "config.yaml",
            "profile": "default",
            "app_key_present": True,
            "dns_config_enabled": True,
            "custom_server_present": False,
            "debug_enabled": True,
            "auto_login_enabled": False,
            "resolved": True,
            "resolved_platforms": ["android"],
        },
        clients={
            "a": ClientContext(
                platform="android",
                device_id="emulator-5554",
                device_source="existing",
                topic="im-auto-android-20260706-153000-a",
                requested_sdk_version="4.23.0",
                actual_sdk_version=None,
                version_required=True,
                version_check=SdkVersionCheck(status="not_checked", source="prepare_context"),
            )
        },
        accounts={
            "a": {
                "mode": "fresh",
                "status": "planned",
                "credential_ref": "config.accounts.default_password",
            }
        },
        artifacts={
            "context_path": "out/run/android-20260706-153000/context.yaml",
            "case_results_json": "out/test-results/android-20260706-153000-case-results.json",
        },
    )
    path = tmp_path / "context.yaml"
    write_context(ctx, path)
    data = yaml.safe_load(path.read_text())
    assert data["clients"]["a"]["requested_sdk_version"] == "4.23.0"
    assert data["environment"]["sdk_options_summary"]["app_key_present"] is True
    assert "requested_sdk_version_source" not in data["clients"]["a"]


def test_context_to_dict_has_required_top_level_sections():
    ctx = RunContext.empty_for_test(run_id="r1")
    data = context_to_dict(ctx)
    assert set(data) >= {"run_id", "status", "environment", "run_plan", "clients", "accounts", "artifacts"}
```

- [ ] **Step 2: 执行失败测试**

```bash
cd native-auto-test
python3 -m pytest tests/tools/test_e2e_context.py -q
```

Expected: `ModuleNotFoundError: No module named 'src.tools.e2e_context'`

- [ ] **Step 3: 实现 `e2e_context.py`**

```python
from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

import yaml


@dataclass(frozen=True)
class SdkVersionCheck:
    status: str
    source: str


@dataclass(frozen=True)
class ClientContext:
    platform: str
    device_id: str
    device_source: str
    topic: str
    requested_sdk_version: str
    actual_sdk_version: str | None
    version_required: bool
    version_check: SdkVersionCheck


@dataclass(frozen=True)
class RunContext:
    run_id: str
    status: str
    matrix_mode: str
    device_mode: str
    install_mode: str
    account_mode: str
    sdk_initialized: bool
    sdk_options_summary: dict[str, Any]
    clients: dict[str, ClientContext]
    accounts: dict[str, dict[str, Any]]
    artifacts: dict[str, str]
    server: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def empty_for_test(cls, run_id: str) -> "RunContext":
        return cls(
            run_id=run_id,
            status="ready",
            matrix_mode="pair",
            device_mode="existing",
            install_mode="clean",
            account_mode="fresh",
            sdk_initialized=False,
            sdk_options_summary={},
            clients={},
            accounts={},
            artifacts={},
        )


def build_run_id(platforms: list[str], now_text: str | None = None) -> str:
    now_text = now_text or datetime.now().strftime("%Y%m%d-%H%M%S")
    return f"{'-'.join(platforms)}-{now_text}"


def context_to_dict(ctx: RunContext) -> dict[str, Any]:
    return {
        "run_id": ctx.run_id,
        "status": ctx.status,
        "server": ctx.server,
        "environment": {
            "bridge_ready": ctx.status == "ready",
            "sdk_initialized": ctx.sdk_initialized,
            "sdk_options_summary": ctx.sdk_options_summary,
        },
        "run_plan": {
            "matrix_mode": ctx.matrix_mode,
            "device_mode": ctx.device_mode,
            "install_mode": ctx.install_mode,
            "account_mode": ctx.account_mode,
            "requested_clients": [
                {"slot": slot, "platform": client.platform}
                for slot, client in ctx.clients.items()
            ],
        },
        "clients": {slot: asdict(client) for slot, client in ctx.clients.items()},
        "accounts": ctx.accounts,
        "artifacts": ctx.artifacts,
    }


def write_context(ctx: RunContext, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = yaml.safe_dump(context_to_dict(ctx), allow_unicode=True, sort_keys=False)
    path.write_text(text, encoding="utf-8")
```

- [ ] **Step 4: 验证通过**

```bash
cd native-auto-test
python3 -m pytest tests/tools/test_e2e_context.py -q
```

Expected: `3 passed`

---

### Task 3: e2e_prepare 第一阶段

**Files:**
- Create: `native-auto-test/src/tools/e2e_prepare.py`
- Test: `native-auto-test/tests/tools/test_e2e_prepare.py`

- [ ] **Step 1: 写失败测试**

```python
from pathlib import Path

import pytest
import yaml

from src.tools.e2e_prepare import build_prepare_context, main


def test_prepare_rejects_auto_device_mode():
    with pytest.raises(ValueError, match="第一阶段只支持 --device-mode existing"):
        build_prepare_context(
            client_args=["android:a@4.23.0"],
            sdk_version_args=[],
            output_root=Path("out"),
            device_mode="auto",
            matrix_mode="pair",
            install_mode="clean",
            account_mode="fresh",
            run_id="r1",
        )


def test_prepare_builds_context_for_existing_devices(tmp_path: Path):
    ctx = build_prepare_context(
        client_args=["android:a@4.23.0", "android:b@4.23.0"],
        sdk_version_args=[],
        output_root=tmp_path,
        device_mode="existing",
        matrix_mode="pair",
        install_mode="clean",
        account_mode="fresh",
        run_id="android-20260706-153000",
    )
    assert ctx.run_id == "android-20260706-153000"
    assert ctx.clients["a"].topic == "im-auto-android-20260706-153000-a"
    assert ctx.artifacts["case_results_json"].endswith("-case-results.json")


def test_prepare_main_writes_context(tmp_path: Path):
    code = main([
        "--client", "android:a@4.23.0",
        "--client", "android:b@4.23.0",
        "--output-root", str(tmp_path),
        "--run-id", "android-20260706-153000",
    ])
    assert code == 0
    path = tmp_path / "run" / "android-20260706-153000" / "context.yaml"
    data = yaml.safe_load(path.read_text())
    assert data["run_id"] == "android-20260706-153000"
```

- [ ] **Step 2: 执行失败测试**

```bash
cd native-auto-test
python3 -m pytest tests/tools/test_e2e_prepare.py -q
```

Expected: `ModuleNotFoundError: No module named 'src.tools.e2e_prepare'`

- [ ] **Step 3: 实现 `e2e_prepare.py`**

```python
from __future__ import annotations

import argparse
from pathlib import Path

from .e2e_cli import parse_client_arg, parse_sdk_version_arg, resolve_client_versions
from .e2e_context import ClientContext, RunContext, SdkVersionCheck, build_run_id, write_context


def build_prepare_context(
    *,
    client_args: list[str],
    sdk_version_args: list[str],
    output_root: Path,
    device_mode: str,
    matrix_mode: str,
    install_mode: str,
    account_mode: str,
    run_id: str | None = None,
) -> RunContext:
    if device_mode != "existing":
        raise ValueError("第一阶段只支持 --device-mode existing")
    if account_mode != "fresh":
        raise ValueError("第一阶段只支持 --account-mode fresh")
    clients = [parse_client_arg(value) for value in client_args]
    versions = dict(parse_sdk_version_arg(value) for value in sdk_version_args)
    resolved = resolve_client_versions(clients, versions)
    run_id = run_id or build_run_id([client.platform for client in resolved])
    context_path = output_root / "run" / run_id / "context.yaml"
    case_results_json = output_root / "test-results" / f"{run_id}-case-results.json"
    case_results_csv = output_root / "test-results" / f"{run_id}-case-results.csv"
    return RunContext(
        run_id=run_id,
        status="ready",
        matrix_mode=matrix_mode,
        device_mode=device_mode,
        install_mode=install_mode,
        account_mode=account_mode,
        sdk_initialized=True,
        sdk_options_summary={
            "source": "config.yaml",
            "profile": "default",
            "app_key_present": True,
            "dns_config_enabled": True,
            "custom_server_present": False,
            "debug_enabled": True,
            "auto_login_enabled": False,
            "resolved": True,
            "resolved_platforms": sorted({client.platform for client in resolved}),
        },
        clients={
            client.slot: ClientContext(
                platform=client.platform,
                device_id="",
                device_source="existing",
                topic=f"im-auto-{run_id}-{client.slot}",
                requested_sdk_version=client.sdk_version or "",
                actual_sdk_version=None,
                version_required=True,
                version_check=SdkVersionCheck(status="not_checked", source="prepare_context"),
            )
            for client in resolved
        },
        accounts={
            client.slot: {
                "mode": "fresh",
                "status": "planned",
                "credential_ref": "config.accounts.default_password",
            }
            for client in resolved
        },
        artifacts={
            "context_path": str(context_path),
            "case_results_json": str(case_results_json),
            "case_results_csv": str(case_results_csv),
            "api_coverage_html": str(output_root / "api-coverage" / f"{run_id}-api-coverage.html"),
            "api_gap_backlog_csv": str(output_root / "api-coverage" / f"{run_id}-gap-backlog.csv"),
        },
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="准备 SDK E2E 运行 context。")
    parser.add_argument("--client", action="append", required=True)
    parser.add_argument("--sdk-version", action="append", default=[])
    parser.add_argument("--output-root", default="out")
    parser.add_argument("--run-id")
    parser.add_argument("--device-mode", default="existing", choices=["existing", "auto", "manual"])
    parser.add_argument("--matrix-mode", default="pair", choices=["smoke", "pair", "full"])
    parser.add_argument("--install-mode", default="clean", choices=["clean", "keep", "upgrade"])
    parser.add_argument("--account-mode", default="fresh", choices=["fresh"])
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    ctx = build_prepare_context(
        client_args=args.client,
        sdk_version_args=args.sdk_version,
        output_root=Path(args.output_root),
        device_mode=args.device_mode,
        matrix_mode=args.matrix_mode,
        install_mode=args.install_mode,
        account_mode=args.account_mode,
        run_id=args.run_id,
    )
    write_context(ctx, Path(ctx.artifacts["context_path"]))
    print(ctx.artifacts["context_path"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 4: 验证通过**

```bash
cd native-auto-test
python3 -m pytest tests/tools/test_e2e_prepare.py tests/tools/test_e2e_cli.py tests/tools/test_e2e_context.py -q
```

Expected: all tests pass.

---

### Task 4: case-results 工具与 pytest hook

**Files:**
- Create: `native-auto-test/src/tools/e2e_case_results.py`
- Modify: `native-auto-test/tests/conftest.py`
- Test: `native-auto-test/tests/tools/test_e2e_case_results.py`

- [ ] **Step 1: 写失败测试**

```python
from pathlib import Path

import json

from src.tools.e2e_case_results import CaseResult, marker_value, split_api, write_case_results


class FakeMarker:
    def __init__(self, *args):
        self.args = args


class FakeItem:
    def __init__(self, markers):
        self._markers = markers

    def get_closest_marker(self, name):
        return self._markers.get(name)


def test_marker_value_reads_first_arg():
    item = FakeItem({"api": FakeMarker("ChatManager.sendMessage")})
    assert marker_value(item, "api") == "ChatManager.sendMessage"


def test_split_api():
    assert split_api("ChatManager.sendMessage") == ("ChatManager", "sendMessage")


def test_write_case_results_json_and_csv(tmp_path: Path):
    result = CaseResult(
        run_id="r1",
        nodeid="tests/chat/test_chat.py::test_send",
        case_id="chat.send_text",
        api="ChatManager.sendMessage",
        manager="ChatManager",
        method_key="sendMessage",
        outcome="passed",
        duration=0.12,
        failure_summary="",
    )
    json_path = tmp_path / "case-results.json"
    csv_path = tmp_path / "case-results.csv"
    write_case_results([result], json_path, csv_path)
    assert json.loads(json_path.read_text())[0]["api"] == "ChatManager.sendMessage"
    assert "chat.send_text" in csv_path.read_text()
```

- [ ] **Step 2: 执行失败测试**

```bash
cd native-auto-test
python3 -m pytest tests/tools/test_e2e_case_results.py -q
```

Expected: `ModuleNotFoundError: No module named 'src.tools.e2e_case_results'`

- [ ] **Step 3: 实现 `e2e_case_results.py`**

```python
from __future__ import annotations

import csv
import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class CaseResult:
    run_id: str
    nodeid: str
    case_id: str
    api: str
    manager: str
    method_key: str
    outcome: str
    duration: float
    failure_summary: str


def marker_value(item: Any, name: str) -> str:
    marker = item.get_closest_marker(name)
    if not marker or not marker.args:
        return ""
    return str(marker.args[0])


def split_api(api: str) -> tuple[str, str]:
    if "." not in api:
        return "", api
    manager, method_key = api.split(".", 1)
    return manager, method_key


def write_case_results(results: list[CaseResult], json_path: Path, csv_path: Path) -> None:
    json_path.parent.mkdir(parents=True, exist_ok=True)
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    rows = [asdict(result) for result in results]
    json_path.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    with csv_path.open("w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=list(CaseResult.__dataclass_fields__))
        writer.writeheader()
        writer.writerows(rows)
```

- [ ] **Step 4: 修改 `tests/conftest.py` 注册 marker 和 hook**

在 `pytest_addoption` 所在文件中增加：

```python
def pytest_configure(config):
    config.addinivalue_line("markers", "case_id(id): 稳定用例 ID，用于报告")
    config.addinivalue_line("markers", "api(name): 本用例覆盖的 Manager.methodKey")
    config.addinivalue_line("markers", "clients(*roles): 本用例使用的 client 角色")
    config.addinivalue_line("markers", "roles_mode(mode): ordered 或 symmetric")
    config.addinivalue_line("markers", "expects_event: 本用例会等待并断言 websocket event")
    config.addinivalue_line("markers", "no_login_fixture: 本用例不使用默认登录 fixture")
    config._e2e_case_results = []
```

并增加 hook：

```python
import os

from src.tools.e2e_case_results import CaseResult, marker_value, split_api, write_case_results


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    report = outcome.get_result()
    if report.when != "call":
        return
    api_name = marker_value(item, "api")
    manager, method_key = split_api(api_name)
    item.config._e2e_case_results.append(
        CaseResult(
            run_id=os.environ.get("NATIVE_AUTO_TEST_RUN_ID", ""),
            nodeid=item.nodeid,
            case_id=marker_value(item, "case_id"),
            api=api_name,
            manager=manager,
            method_key=method_key,
            outcome=report.outcome,
            duration=float(report.duration),
            failure_summary=str(report.longrepr)[:1000] if report.failed else "",
        )
    )


def pytest_sessionfinish(session, exitstatus):
    json_path = os.environ.get("NATIVE_AUTO_TEST_CASE_RESULTS_JSON")
    csv_path = os.environ.get("NATIVE_AUTO_TEST_CASE_RESULTS_CSV")
    if json_path and csv_path:
        write_case_results(session.config._e2e_case_results, Path(json_path), Path(csv_path))
```

- [ ] **Step 5: 验证通过**

```bash
cd native-auto-test
python3 -m pytest tests/tools/test_e2e_case_results.py -q
```

Expected: all tests pass.

---

### Task 5: e2e_run pytest 包装入口

**Files:**
- Create: `native-auto-test/src/tools/e2e_run.py`
- Test: `native-auto-test/tests/tools/test_e2e_run.py`

- [ ] **Step 1: 写失败测试**

```python
from pathlib import Path

from src.tools.e2e_run import build_pytest_args


def test_build_pytest_args_adds_reports_and_context(tmp_path: Path):
    context_path = tmp_path / "run" / "r1" / "context.yaml"
    args = build_pytest_args(
        run_context=context_path,
        run_id="r1",
        platform_matrix="android-android",
        extra_args=[],
    )
    assert args[:2] == ["tests", "-s"]
    assert ["-m", "real_e2e"] == args[2:4]
    assert "--html" in args
    assert "--alluredir" in args
    assert "--run-context" in args
```

- [ ] **Step 2: 执行失败测试**

```bash
cd native-auto-test
python3 -m pytest tests/tools/test_e2e_run.py -q
```

Expected: `ModuleNotFoundError: No module named 'src.tools.e2e_run'`

- [ ] **Step 3: 实现 `e2e_run.py`**

```python
from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path


def build_pytest_args(
    *,
    run_context: Path,
    run_id: str,
    platform_matrix: str,
    extra_args: list[str],
) -> list[str]:
    log_dir = Path("out") / "log" / platform_matrix
    return [
        "tests",
        "-s",
        "-m",
        "real_e2e",
        "--run-context",
        str(run_context),
        "--html",
        str(log_dir / f"{run_id}-pytest.html"),
        "--self-contained-html",
        "--alluredir",
        str(log_dir / f"{run_id}-allure-results"),
        *extra_args,
    ]


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="运行 SDK E2E pytest 用例。")
    parser.add_argument("--run-context", required=True)
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--platform-matrix", required=True)
    parser.add_argument("pytest_args", nargs=argparse.REMAINDER)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    pytest_args = args.pytest_args
    if pytest_args and pytest_args[0] == "--":
        pytest_args = pytest_args[1:]
    case_json = Path("out") / "test-results" / f"{args.run_id}-case-results.json"
    case_csv = Path("out") / "test-results" / f"{args.run_id}-case-results.csv"
    env = os.environ.copy()
    env["NATIVE_AUTO_TEST_RUN_ID"] = args.run_id
    env["NATIVE_AUTO_TEST_RUN_CONTEXT"] = args.run_context
    env["NATIVE_AUTO_TEST_CASE_RESULTS_JSON"] = str(case_json)
    env["NATIVE_AUTO_TEST_CASE_RESULTS_CSV"] = str(case_csv)
    command = [sys.executable, "-m", "pytest", *build_pytest_args(
        run_context=Path(args.run_context),
        run_id=args.run_id,
        platform_matrix=args.platform_matrix,
        extra_args=pytest_args,
    )]
    return subprocess.call(command, env=env)


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 4: 验证通过**

```bash
cd native-auto-test
python3 -m pytest tests/tools/test_e2e_run.py -q
```

Expected: all tests pass.

---

### Task 6: e2e_api_coverage 缺失统计骨架

**Files:**
- Create: `native-auto-test/src/tools/e2e_api_coverage.py`
- Test: `native-auto-test/tests/tools/test_e2e_api_coverage.py`

- [ ] **Step 1: 写失败测试**

```python
import csv
from pathlib import Path

from src.tools.e2e_api_coverage import ApiGapRow, classify_gap, write_gap_backlog


def test_classify_gap_order():
    assert classify_gap(method_key_exists=False, wrapper_exists=False, e2e_case_count=0, e2e_fail_count=0) == "method_key_missing"
    assert classify_gap(method_key_exists=True, wrapper_exists=False, e2e_case_count=0, e2e_fail_count=0) == "wrapper_missing"
    assert classify_gap(method_key_exists=True, wrapper_exists=True, e2e_case_count=0, e2e_fail_count=0) == "missing_case"
    assert classify_gap(method_key_exists=True, wrapper_exists=True, e2e_case_count=1, e2e_fail_count=1) == "failed_case"
    assert classify_gap(method_key_exists=True, wrapper_exists=True, e2e_case_count=1, e2e_fail_count=0) == "covered"


def test_write_gap_backlog_csv(tmp_path: Path):
    path = tmp_path / "gap.csv"
    row = ApiGapRow(
        run_id="r1",
        api="ChatManager.sendMessage",
        manager="ChatManager",
        method_key="sendMessage",
        platform="android",
        platform_role="baseline",
        sdk_version="4.23.0",
        gap_type="missing_case",
        target_action="add_real_e2e_case",
        source_platform="android",
        source_evidence="case-results",
        case_id="",
        pytest_report="",
        reason="未发现真实 E2E 用例",
        priority="P1",
    )
    write_gap_backlog([row], path)
    rows = list(csv.DictReader(path.open()))
    assert rows[0]["gap_type"] == "missing_case"
```

- [ ] **Step 2: 执行失败测试**

```bash
cd native-auto-test
python3 -m pytest tests/tools/test_e2e_api_coverage.py -q
```

Expected: `ModuleNotFoundError: No module named 'src.tools.e2e_api_coverage'`

- [ ] **Step 3: 实现 `e2e_api_coverage.py`**

```python
from __future__ import annotations

import csv
from dataclasses import asdict, dataclass
from pathlib import Path


@dataclass(frozen=True)
class ApiGapRow:
    run_id: str
    api: str
    manager: str
    method_key: str
    platform: str
    platform_role: str
    sdk_version: str
    gap_type: str
    target_action: str
    source_platform: str
    source_evidence: str
    case_id: str
    pytest_report: str
    reason: str
    priority: str


def classify_gap(
    *,
    method_key_exists: bool,
    wrapper_exists: bool,
    e2e_case_count: int,
    e2e_fail_count: int,
) -> str:
    if not method_key_exists:
        return "method_key_missing"
    if not wrapper_exists:
        return "wrapper_missing"
    if e2e_case_count == 0:
        return "missing_case"
    if e2e_fail_count > 0:
        return "failed_case"
    return "covered"


def write_gap_backlog(rows: list[ApiGapRow], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=list(ApiGapRow.__dataclass_fields__))
        writer.writeheader()
        writer.writerows(asdict(row) for row in rows)
```

- [ ] **Step 4: 增加 CLI 骨架**

在同一文件追加：

```python
import argparse


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="生成 SDK API 覆盖和缺失 backlog。")
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--case-results", required=True)
    parser.add_argument("--output", required=True)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    write_gap_backlog([], Path(args.output))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 5: 验证通过**

```bash
cd native-auto-test
python3 -m pytest tests/tools/test_e2e_api_coverage.py -q
```

Expected: all tests pass.

---

### Task 7: e2e_full_run 编排入口

**Files:**
- Create: `native-auto-test/src/tools/e2e_full_run.py`
- Test: `native-auto-test/tests/tools/test_e2e_full_run.py`

- [ ] **Step 1: 写失败测试**

```python
from src.tools.e2e_full_run import build_stage_commands


def test_full_run_builds_prepare_run_coverage_stages():
    commands = build_stage_commands(
        client_args=["android:a@4.23.0", "android:b@4.23.0"],
        sdk_version_args=[],
        run_id="android-20260706-153000",
        output_root="out",
        matrix_mode="pair",
        install_mode="clean",
        account_mode="fresh",
        device_mode="existing",
        platform_matrix="android-android",
        pytest_args=[],
    )
    assert [command[2] for command in commands] == [
        "src.tools.e2e_prepare",
        "src.tools.e2e_run",
        "src.tools.e2e_api_coverage",
    ]
    assert "--run-context" in commands[1]
```

- [ ] **Step 2: 执行失败测试**

```bash
cd native-auto-test
python3 -m pytest tests/tools/test_e2e_full_run.py -q
```

Expected: `ModuleNotFoundError: No module named 'src.tools.e2e_full_run'`

- [ ] **Step 3: 实现 `e2e_full_run.py`**

```python
from __future__ import annotations

import argparse
import subprocess
import sys


def build_stage_commands(
    *,
    client_args: list[str],
    sdk_version_args: list[str],
    run_id: str,
    output_root: str,
    matrix_mode: str,
    install_mode: str,
    account_mode: str,
    device_mode: str,
    platform_matrix: str,
    pytest_args: list[str],
) -> list[list[str]]:
    context_path = f"{output_root}/run/{run_id}/context.yaml"
    case_results = f"{output_root}/test-results/{run_id}-case-results.json"
    gap_backlog = f"{output_root}/api-coverage/{run_id}-gap-backlog.csv"
    prepare = [
        sys.executable, "-m", "src.tools.e2e_prepare",
        "--run-id", run_id,
        "--output-root", output_root,
        "--matrix-mode", matrix_mode,
        "--install-mode", install_mode,
        "--account-mode", account_mode,
        "--device-mode", device_mode,
    ]
    for value in client_args:
        prepare.extend(["--client", value])
    for value in sdk_version_args:
        prepare.extend(["--sdk-version", value])
    run = [
        sys.executable, "-m", "src.tools.e2e_run",
        "--run-context", context_path,
        "--run-id", run_id,
        "--platform-matrix", platform_matrix,
        "--",
        *pytest_args,
    ]
    coverage = [
        sys.executable, "-m", "src.tools.e2e_api_coverage",
        "--run-id", run_id,
        "--case-results", case_results,
        "--output", gap_backlog,
    ]
    return [prepare, run, coverage]


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="正式 SDK E2E 全流程入口。")
    parser.add_argument("--client", action="append", required=True)
    parser.add_argument("--sdk-version", action="append", default=[])
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--output-root", default="out")
    parser.add_argument("--matrix-mode", default="pair")
    parser.add_argument("--install-mode", default="clean")
    parser.add_argument("--account-mode", default="fresh")
    parser.add_argument("--device-mode", default="existing")
    parser.add_argument("--platform-matrix", default="android-android")
    parser.add_argument("pytest_args", nargs=argparse.REMAINDER)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    pytest_args = args.pytest_args
    if pytest_args and pytest_args[0] == "--":
        pytest_args = pytest_args[1:]
    for command in build_stage_commands(
        client_args=args.client,
        sdk_version_args=args.sdk_version,
        run_id=args.run_id,
        output_root=args.output_root,
        matrix_mode=args.matrix_mode,
        install_mode=args.install_mode,
        account_mode=args.account_mode,
        device_mode=args.device_mode,
        platform_matrix=args.platform_matrix,
        pytest_args=pytest_args,
    ):
        code = subprocess.call(command)
        if code != 0:
            return code
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 4: 验证通过**

```bash
cd native-auto-test
python3 -m pytest tests/tools/test_e2e_full_run.py -q
```

Expected: all tests pass.

---

### Task 8: Makefile 入口收敛

**Files:**
- Modify: `native-auto-test/Makefile`
- Test: `native-auto-test/tests/tools/test_makefile_e2e_targets.py`

- [ ] **Step 1: 写失败测试**

```python
from pathlib import Path


def test_makefile_has_unified_e2e_targets():
    text = Path("Makefile").read_text()
    assert "e2e-prepare:" in text
    assert "e2e-run:" in text
    assert "e2e-api-coverage:" in text
    assert "e2e-full-run:" in text
```

- [ ] **Step 2: 执行失败测试**

```bash
cd native-auto-test
python3 -m pytest tests/tools/test_makefile_e2e_targets.py -q
```

Expected: fail until targets are added.

- [ ] **Step 3: 修改 Makefile**

```make
e2e-prepare:
	$(PY) -m src.tools.e2e_prepare $(ARGS)

e2e-run:
	$(PY) -m src.tools.e2e_run $(ARGS)

e2e-api-coverage:
	$(PY) -m src.tools.e2e_api_coverage $(ARGS)

e2e-full-run:
	$(PY) -m src.tools.e2e_full_run $(ARGS)
```

- [ ] **Step 4: 验证通过**

```bash
cd native-auto-test
python3 -m pytest tests/tools/test_makefile_e2e_targets.py -q
```

Expected: all tests pass.

---

### Task 9: 配置模板和文档

**Files:**
- Modify: `native-auto-test/config.yaml.template`
- Modify: `native-auto-test/README.md`
- Modify: `native-auto-test/AGENTS.md`
- Modify: `.agents/skills/native-auto-test-framework/SKILL.md`

- [ ] **Step 1: 更新配置模板**

在 `native-auto-test/config.yaml.template` 增加或对齐以下结构：

```yaml
sdk_options:
  # SDK 初始化 app key。真实值只写 config.yaml，不提交。
  app_key: ""
  # SDK 是否开启自动登录。E2E 默认 false，登录由测试链路控制。
  auto_login: false
  # SDK debug 开关。
  debug_model: true
  # 是否启用 SDK DNS 配置。
  enable_dns_config: true
  # 指定 IM 长连接服务器。为空表示使用 SDK 默认。
  im_server: ""
  # 指定 IM 长连接端口。为空表示使用 SDK 默认。
  im_port:
  # 指定 REST server。为空表示使用 SDK 默认。
  rest_server: ""
  # 指定 DNS URL。为空表示使用 SDK 默认。
  dns_url: ""

e2e:
  # 第一阶段只支持 existing。
  device_mode: existing
  # 默认矩阵模式。
  matrix_mode: pair
  # 默认安装模式。
  install_mode: clean
  # 第一阶段只支持 fresh。
  account_mode: fresh

accounts:
  # fresh 账号默认密码。真实值只写 config.yaml，不提交。
  default_password: ""
  # fresh 账号名前缀。
  user_id_prefix: "im_e2e"
  # 生成账号重试次数。
  create_retry: 5
```

- [ ] **Step 2: 更新 README 正式入口**

在 `native-auto-test/README.md` 增加：

```markdown
## SDK E2E 正式入口

正式发版测试入口：

```bash
make e2e-full-run ARGS="--client android:a@4.23.0 --client android:b@4.23.0 --run-id android-20260706-153000 --platform-matrix android-android --install-mode clean --matrix-mode pair --account-mode fresh"
```

阶段调试入口：

- `make e2e-prepare ARGS="..."`：生成 `out/run/<run_id>/context.yaml`
- `make e2e-run ARGS="--run-context out/run/<run_id>/context.yaml --run-id <run_id> --platform-matrix android-android"`：执行 pytest 并输出 pytest-html、Allure、case-results
- `make e2e-api-coverage ARGS="--run-id <run_id> --case-results out/test-results/<run_id>-case-results.json --output out/api-coverage/<run_id>-gap-backlog.csv"`：生成 API 缺失列表

直接 `pytest` 只作为低层调试入口，不作为正式覆盖报告入口。
```
```

- [ ] **Step 3: 更新 skill 规则**

在 `.agents/skills/native-auto-test-framework/SKILL.md` 写清：

```markdown
## 统一入口规则

- 正式 SDK E2E 发版测试使用 `make e2e-full-run ARGS="..."`。
- `e2e_prepare` 只准备 context 和环境，不承载真实 case 断言。
- `e2e_run` 才执行 pytest case，并负责 pytest-html、Allure、case-results。
- `e2e_api_coverage` 读取 case-results 和扫描结果，输出 API coverage 和 gap backlog。
- 每个 client 必须解析出明确 SDK 版本。
- Web adapter、mock、wrapper mapping 不能算真实 E2E 覆盖。
```

- [ ] **Step 4: 文档校验**

```bash
cd native-auto-test
python3 -m pytest tests/tools/test_makefile_e2e_targets.py tests/tools/test_e2e_cli.py tests/tools/test_e2e_context.py tests/tools/test_e2e_prepare.py tests/tools/test_e2e_case_results.py tests/tools/test_e2e_run.py tests/tools/test_e2e_api_coverage.py tests/tools/test_e2e_full_run.py -q
```

Expected: all tests pass.

---

## 后续计划

- `docs/plans/<date>-im-flutter-test-login-start-callback-plan.md`：把 `startCallback` 内聚到 `im_flutter_test` 的 login 成功路径。
- `docs/plans/<date>-sdk-e2e-upgrade-install-plan.md`：实现 clean install -> old app case -> upgrade install -> new app case。
- `docs/plans/<date>-sdk-api-native-scan-coverage-plan.md`：把 Android/iOS/Web 真实 SDK 扫描结果接入 `e2e_api_coverage`。
- `docs/plans/<date>-e2e-account-fresh-rest-plan.md`：把 fresh account REST 创建从现有 fixture 迁移到 prepare。

## 自审结果

- 已把正式 spec/plan 放在 `docs/specs` 和 `docs/plans`，不再以 `tmp/` 作为正式来源。
- 第一阶段计划只覆盖 Python 工具链和报告入口，避免同时修改 Flutter 桥接层导致范围过大。
- 每个任务都有明确文件、失败测试、实现代码和验证命令。
- `--sdk-version` 规则、context 结构、case-results、API gap backlog 和 Makefile 入口均有任务覆盖。
- 直接 `pytest` 被定义为调试入口，正式报告入口收敛到 `e2e_full_run`。
