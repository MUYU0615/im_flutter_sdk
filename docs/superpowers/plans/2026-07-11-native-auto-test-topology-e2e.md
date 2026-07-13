# Native Auto Test Topology E2E Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first topology-driven native-auto-test E2E milestone: a resolved three-client Android topology, context-driven runner startup, topology-aware pytest fixture/preflight, event-group assertion infrastructure, and representative migrated cases.

**Architecture:** Topology YAML is parsed into an explicit run context under `out/run/<run_id>/`. The runner starts every client declared in that context, while pytest consumes the same context through a `topology` fixture and flow markers. Event assertions move from single "wait next event" calls to scoped event groups with expected, forbidden, ignored, and missing event reporting.

**Tech Stack:** Python 3, pytest, PyYAML, existing `DeviceConnection`, Android adb/flutter runner, Allure attachments, native-auto-test `config.yaml`.

## Global Constraints

- Formal real E2E entrypoint is `--topology`; do not preserve the old `--client android:a@... --client android:b@...` model as the official suite path.
- Do not put passwords, app secrets, REST secrets, tokens, or private keys into `context.yaml`, `topology.resolved.yaml`, reports, or Allure attachments.
- First implementation starts all clients declared by the topology; do not add minimal-client optimization in this milestone.
- Real E2E evidence must come through WebSocket -> `im_flutter_test` -> Flutter SDK/interface/platform wrapper -> real native SDK -> SDK server -> real SDK callback/event.
- Ordinary cases must not call logout. Kick/logout/token/session-invalidating cases must be marked `disruptive_session`.
- New real E2E cases use `topology`; do not add new dependencies on `device_a`, `device_b`, implicit `user_a/user_b`, or hand-built topics.
- Keep generated artifacts under `native-auto-test/out/`; keep long-lived docs under `native-auto-test/docs/` or `docs/superpowers/plans/`.

---

## File Structure

Create:

- `native-auto-test/config/topologies/android-primary-dual-remote.yaml`: default Android topology with primary account on two Android clients and remote account on one Android client.
- `native-auto-test/src/tools/topology_model.py`: dataclasses and pure validation for topology, resolved context, flow requirements, and device overrides.
- `native-auto-test/src/tools/topology_loader.py`: YAML loading, account `user_ref` resolution against local config, Android device auto assignment, and context dict creation.
- `native-auto-test/src/tools/topology_fixture.py`: pytest-facing `Topology` and `TopologyClient` wrappers around existing `DeviceConnection` semantics.
- `native-auto-test/src/tools/preflight.py`: flow/capability support checks and preflight JSON generation.
- `native-auto-test/src/tools/case_scope.py`: per-case marker, start timestamp, drain attachments, and involved-client metadata.
- `native-auto-test/src/tools/event_group_waiter.py`: expected/forbidden event group waiting with matched/missing/ignored reporting.
- `native-auto-test/tests/tools/test_topology_loader.py`: unit tests for topology parsing, validation, account resolution, and context output.
- `native-auto-test/tests/tools/test_preflight.py`: unit tests for flow support and pytest marker interpretation helpers.
- `native-auto-test/tests/tools/test_topology_fixture.py`: unit tests for `Topology` and `TopologyClient`.
- `native-auto-test/tests/tools/test_event_group_waiter.py`: unit tests for event matching, ignored pollution, forbidden events, and timeouts.

Modify:

- `native-auto-test/src/tools/e2e_prepare.py`: add `--topology` and `--device client=device_id`; generate new context files.
- `native-auto-test/src/tools/e2e_full_run.py`: add topology command path and stop routing official Android runs through old android-android client special case when `--topology` is present.
- `native-auto-test/src/tools/android_e2e_runner.py`: add `--run-context`; start Android clients by topology client name instead of hard-coded `deviceA/deviceB`.
- `native-auto-test/tests/conftest.py`: add marker registration, `--run-context`, `topology` fixture, topology preflight hook, and disable legacy global login when topology context is active.
- `native-auto-test/pytest.ini`: register new markers if this project keeps marker declarations there.
- `native-auto-test/tests/chat/_message_helpers.py`: update only representative migrated message helpers to support topology clients and marker-based content.
- A small representative set of chat/contact/conversation tests selected during Task 8.

Do not modify release SDK packages for this milestone.

---

### Task 1: Topology Model And Default YAML

**Files:**
- Create: `native-auto-test/config/topologies/android-primary-dual-remote.yaml`
- Create: `native-auto-test/src/tools/topology_model.py`
- Test: `native-auto-test/tests/tools/test_topology_loader.py`

**Interfaces:**
- Produces: `TopologySpec.from_dict(data: dict[str, Any], source: str) -> TopologySpec`
- Produces: `parse_device_overrides(values: list[str]) -> dict[str, str]`
- Produces: `FLOW_REQUIREMENTS: dict[str, FlowRequirement]`
- Produces: `TopologySpec.validate() -> None`
- Later tasks consume `TopologySpec.clients`, `TopologySpec.accounts`, `TopologySpec.platforms_under_test`, and `FLOW_REQUIREMENTS`.

- [ ] **Step 1: Write failing tests for default topology loading shape**

Add to `native-auto-test/tests/tools/test_topology_loader.py`:

```python
from pathlib import Path

import pytest
import yaml

from src.tools.topology_model import TopologySpec, parse_device_overrides


def test_default_android_topology_declares_primary_dual_remote():
    path = Path("config/topologies/android-primary-dual-remote.yaml")
    data = yaml.safe_load(path.read_text(encoding="utf-8"))

    spec = TopologySpec.from_dict(data, source=str(path))

    assert spec.name == "android_primary_dual_remote"
    assert spec.platforms_under_test == ("android",)
    assert spec.accounts["primary"].user_ref == "a"
    assert spec.accounts["remote"].user_ref == "b"
    assert spec.clients["primary_a"].account == "primary"
    assert spec.clients["primary_b"].account == "primary"
    assert spec.clients["remote_c"].account == "remote"
    assert spec.clients["primary_a"].platform == "android"
    assert spec.requirements.accounts["primary"].min_clients == 2
    assert spec.requirements.accounts["remote"].min_clients == 1
    assert spec.coverage.subject_clients == ("primary_a", "primary_b")
    assert spec.coverage.helper_clients == ("remote_c",)


def test_parse_device_overrides_rejects_invalid_shape():
    assert parse_device_overrides(["primary_a=emulator-5554"]) == {
        "primary_a": "emulator-5554",
    }

    with pytest.raises(ValueError, match="--device 必须是 client=device_id"):
        parse_device_overrides(["primary_a"])
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
cd native-auto-test
pytest -q tests/tools/test_topology_loader.py::test_default_android_topology_declares_primary_dual_remote tests/tools/test_topology_loader.py::test_parse_device_overrides_rejects_invalid_shape
```

Expected: FAIL because `src.tools.topology_model` and the topology YAML do not exist.

- [ ] **Step 3: Add default topology YAML**

Create `native-auto-test/config/topologies/android-primary-dual-remote.yaml`:

```yaml
schema_version: 1
name: android_primary_dual_remote
description: Android SDK multi-device real E2E topology.

platforms_under_test:
  - android

accounts:
  primary:
    user_ref: a
    purpose: account under test
  remote:
    user_ref: b
    purpose: interaction counterparty

clients:
  primary_a:
    platform: android
    sdk_version: "4.23.0"
    account: primary
    device:
      mode: auto
    roles:
      - primary
      - same_account_member

  primary_b:
    platform: android
    sdk_version: "4.23.0"
    account: primary
    device:
      mode: auto
    roles:
      - primary
      - same_account_member

  remote_c:
    platform: android
    sdk_version: "4.23.0"
    account: remote
    device:
      mode: auto
    roles:
      - remote
      - counterparty

requirements:
  accounts:
    primary:
      min_clients: 2
    remote:
      min_clients: 1

coverage:
  subject_clients:
    - primary_a
    - primary_b
  helper_clients:
    - remote_c
```

- [ ] **Step 4: Implement topology dataclasses and validation**

Create `native-auto-test/src/tools/topology_model.py`:

```python
from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class AccountSpec:
    name: str
    user_ref: str
    purpose: str = ""


@dataclass(frozen=True)
class DeviceSpec:
    mode: str = "auto"
    id: str | None = None


@dataclass(frozen=True)
class ClientSpec:
    name: str
    platform: str
    sdk_version: str
    account: str
    device: DeviceSpec
    roles: tuple[str, ...]


@dataclass(frozen=True)
class AccountRequirement:
    min_clients: int = 1


@dataclass(frozen=True)
class TopologyRequirements:
    accounts: dict[str, AccountRequirement]


@dataclass(frozen=True)
class TopologyCoverage:
    subject_clients: tuple[str, ...]
    helper_clients: tuple[str, ...]


@dataclass(frozen=True)
class FlowRequirement:
    primary_clients: int = 0
    remote_clients: int = 0
    server_api: bool = False


FLOW_REQUIREMENTS: dict[str, FlowRequirement] = {
    "local_state": FlowRequirement(primary_clients=1),
    "error_response": FlowRequirement(primary_clients=1),
    "sender_terminal_error": FlowRequirement(primary_clients=1),
    "peer_interaction": FlowRequirement(primary_clients=1, remote_clients=1),
    "remote_fanout": FlowRequirement(primary_clients=2, remote_clients=1),
    "primary_send_sync": FlowRequirement(primary_clients=2, remote_clients=1),
    "account_state_sync": FlowRequirement(primary_clients=2),
    "client_originated_control": FlowRequirement(primary_clients=2),
    "server_originated_control": FlowRequirement(primary_clients=1, server_api=True),
    "callback_event_only": FlowRequirement(primary_clients=1),
}


@dataclass(frozen=True)
class TopologySpec:
    schema_version: int
    name: str
    source: str
    description: str
    platforms_under_test: tuple[str, ...]
    accounts: dict[str, AccountSpec]
    clients: dict[str, ClientSpec]
    requirements: TopologyRequirements
    coverage: TopologyCoverage

    @classmethod
    def from_dict(cls, data: dict[str, Any], *, source: str) -> "TopologySpec":
        accounts = {
            name: AccountSpec(
                name=name,
                user_ref=str(raw.get("user_ref") or ""),
                purpose=str(raw.get("purpose") or ""),
            )
            for name, raw in (data.get("accounts") or {}).items()
        }
        clients = {}
        for name, raw in (data.get("clients") or {}).items():
            raw_device = raw.get("device") or {}
            clients[name] = ClientSpec(
                name=name,
                platform=str(raw.get("platform") or ""),
                sdk_version=str(raw.get("sdk_version") or ""),
                account=str(raw.get("account") or ""),
                device=DeviceSpec(
                    mode=str(raw_device.get("mode") or "auto"),
                    id=raw_device.get("id"),
                ),
                roles=tuple(str(role) for role in (raw.get("roles") or ())),
            )
        raw_requirements = ((data.get("requirements") or {}).get("accounts") or {})
        requirements = TopologyRequirements(
            accounts={
                name: AccountRequirement(min_clients=int(raw.get("min_clients") or 1))
                for name, raw in raw_requirements.items()
            }
        )
        raw_coverage = data.get("coverage") or {}
        spec = cls(
            schema_version=int(data.get("schema_version") or 0),
            name=str(data.get("name") or ""),
            source=source,
            description=str(data.get("description") or ""),
            platforms_under_test=tuple(str(v) for v in (data.get("platforms_under_test") or ())),
            accounts=accounts,
            clients=clients,
            requirements=requirements,
            coverage=TopologyCoverage(
                subject_clients=tuple(str(v) for v in (raw_coverage.get("subject_clients") or ())),
                helper_clients=tuple(str(v) for v in (raw_coverage.get("helper_clients") or ())),
            ),
        )
        spec.validate()
        return spec

    def validate(self) -> None:
        if self.schema_version != 1:
            raise ValueError("topology schema_version 必须是 1")
        if not self.name:
            raise ValueError("topology 缺少 name")
        if not self.platforms_under_test:
            raise ValueError("topology platforms_under_test 不能为空")
        if "primary" not in self.accounts:
            raise ValueError("topology 必须声明 primary account")
        for account_name, account in self.accounts.items():
            if not account.user_ref:
                raise ValueError(f"account {account_name} 缺少 user_ref")
        for client_name, client in self.clients.items():
            if client.account not in self.accounts:
                raise ValueError(f"client {client_name} 引用了不存在的 account {client.account}")
            if not client.platform:
                raise ValueError(f"client {client_name} 缺少 platform")
            if not client.sdk_version:
                raise ValueError(f"client {client_name} 缺少 sdk_version")
        for client_name in (*self.coverage.subject_clients, *self.coverage.helper_clients):
            if client_name not in self.clients:
                raise ValueError(f"coverage 引用了不存在的 client {client_name}")
        for account_name, requirement in self.requirements.accounts.items():
            count = sum(1 for client in self.clients.values() if client.account == account_name)
            if count < requirement.min_clients:
                raise ValueError(
                    f"account {account_name} 至少需要 {requirement.min_clients} 个 client，实际 {count} 个"
                )


def parse_device_overrides(values: list[str]) -> dict[str, str]:
    overrides: dict[str, str] = {}
    for value in values:
        if "=" not in value:
            raise ValueError("--device 必须是 client=device_id")
        client_name, device_id = value.split("=", 1)
        client_name = client_name.strip()
        device_id = device_id.strip()
        if not client_name or not device_id:
            raise ValueError("--device 必须是 client=device_id")
        overrides[client_name] = device_id
    return overrides
```

- [ ] **Step 5: Run tests and verify they pass**

Run:

```bash
cd native-auto-test
pytest -q tests/tools/test_topology_loader.py::test_default_android_topology_declares_primary_dual_remote tests/tools/test_topology_loader.py::test_parse_device_overrides_rejects_invalid_shape
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add native-auto-test/config/topologies/android-primary-dual-remote.yaml native-auto-test/src/tools/topology_model.py native-auto-test/tests/tools/test_topology_loader.py
git commit -m "feat: add e2e topology model"
```

---

### Task 2: Topology Loader And Context Generation

**Files:**
- Create: `native-auto-test/src/tools/topology_loader.py`
- Modify: `native-auto-test/src/tools/e2e_prepare.py`
- Modify: `native-auto-test/src/tools/e2e_context.py`
- Test: `native-auto-test/tests/tools/test_topology_loader.py`

**Interfaces:**
- Consumes: `TopologySpec`, `parse_device_overrides`
- Produces: `load_topology(path: Path) -> TopologySpec`
- Produces: `build_topology_context(...) -> dict[str, Any]`
- Produces: `write_topology_context(context: dict[str, Any], context_path: Path) -> None`
- Produces CLI: `python -m src.tools.e2e_prepare --topology <path> --run-id <id> --device primary_a=...`

- [ ] **Step 1: Add failing tests for context generation**

Append to `native-auto-test/tests/tools/test_topology_loader.py`:

```python
from src.tools.topology_loader import build_topology_context, load_topology


def test_build_topology_context_resolves_accounts_and_devices(tmp_path):
    spec = load_topology(Path("config/topologies/android-primary-dual-remote.yaml"))
    config = {
        "accounts": {
            "users": {
                "a": {"username": "user1"},
                "b": {"username": "user2"},
            }
        },
        "rest_api": {"auth_token": "secret-token"},
    }

    context = build_topology_context(
        spec=spec,
        run_id="android-topology-001",
        output_root=tmp_path,
        config=config,
        available_devices=["emulator-5554", "emulator-5558", "emulator-5560"],
        device_overrides={},
        install_mode="clean",
    )

    assert context["run_id"] == "android-topology-001"
    assert context["topology"]["name"] == "android_primary_dual_remote"
    assert context["accounts"]["primary"]["user_id"] == "user1"
    assert context["accounts"]["remote"]["user_id"] == "user2"
    assert context["clients"]["primary_a"]["device"]["id"] == "emulator-5554"
    assert context["clients"]["primary_b"]["device"]["id"] == "emulator-5558"
    assert context["clients"]["remote_c"]["device"]["id"] == "emulator-5560"
    assert context["clients"]["primary_a"]["relay"]["topic"] == "im-auto-android-topology-001-primary_a"
    assert "secret-token" not in str(context)


def test_build_topology_context_rejects_missing_user_ref(tmp_path):
    spec = load_topology(Path("config/topologies/android-primary-dual-remote.yaml"))

    with pytest.raises(ValueError, match="user_ref a"):
        build_topology_context(
            spec=spec,
            run_id="android-topology-001",
            output_root=tmp_path,
            config={"accounts": {"users": {}}},
            available_devices=["emulator-5554", "emulator-5558", "emulator-5560"],
            device_overrides={},
            install_mode="clean",
        )
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
cd native-auto-test
pytest -q tests/tools/test_topology_loader.py
```

Expected: FAIL because `topology_loader.py` does not exist.

- [ ] **Step 3: Implement topology loader**

Create `native-auto-test/src/tools/topology_loader.py`:

```python
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import yaml

from .config import get_topic_prefix
from .topology_model import TopologySpec


def load_topology(path: Path) -> TopologySpec:
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    return TopologySpec.from_dict(data, source=str(path))


def _resolve_user(config: dict[str, Any], user_ref: str) -> str:
    users = ((config.get("accounts") or {}).get("users") or {})
    raw = users.get(user_ref)
    if isinstance(raw, str):
        return raw
    if isinstance(raw, dict):
        username = raw.get("username") or raw.get("user_id") or raw.get("userId")
        if username:
            return str(username)
    raise ValueError(f"config.yaml 中找不到 user_ref {user_ref}")


def _assign_devices(
    spec: TopologySpec,
    *,
    available_devices: list[str],
    device_overrides: dict[str, str],
) -> dict[str, str]:
    unknown = sorted(set(device_overrides) - set(spec.clients))
    if unknown:
        raise ValueError(f"--device 引用了不存在的 client: {', '.join(unknown)}")
    assigned: dict[str, str] = {}
    used: set[str] = set()
    for client_name, client in spec.clients.items():
        device_id = device_overrides.get(client_name) or client.device.id
        if not device_id:
            for candidate in available_devices:
                if candidate not in used:
                    device_id = candidate
                    break
        if not device_id:
            raise ValueError(f"client {client_name} 没有可用 Android 设备")
        if device_id in used:
            raise ValueError(f"Android 设备 {device_id} 被重复分配")
        assigned[client_name] = device_id
        used.add(device_id)
    return assigned


def build_topology_context(
    *,
    spec: TopologySpec,
    run_id: str,
    output_root: Path,
    config: dict[str, Any],
    available_devices: list[str],
    device_overrides: dict[str, str],
    install_mode: str,
) -> dict[str, Any]:
    assigned_devices = _assign_devices(
        spec,
        available_devices=available_devices,
        device_overrides=device_overrides,
    )
    accounts: dict[str, Any] = {}
    for account_name, account in spec.accounts.items():
        accounts[account_name] = {
            "user_ref": account.user_ref,
            "user_id": _resolve_user(config, account.user_ref),
            "display_name": account_name,
            "clients": [
                client.name for client in spec.clients.values() if client.account == account_name
            ],
        }
    log_root = output_root / "log" / "-".join(spec.platforms_under_test)
    clients: dict[str, Any] = {}
    for client_name, client in spec.clients.items():
        user_id = accounts[client.account]["user_id"]
        clients[client_name] = {
            "platform": client.platform,
            "account": client.account,
            "user_id": user_id,
            "roles": list(client.roles),
            "sdk_version": client.sdk_version,
            "device": {
                "id": assigned_devices[client_name],
                "mode": client.device.mode,
            },
            "relay": {
                "topic": f"{get_topic_prefix()}-{run_id}-{client_name}",
            },
            "app": {
                "install_mode": install_mode,
                "package": "com.easemob.im_flutter_test",
            },
            "lifecycle": {
                "install": "pending",
                "init": "pending",
                "login": "pending",
                "start_callback": "pending",
            },
        }
    return {
        "schema_version": 1,
        "run_id": run_id,
        "created_at": datetime.now(timezone.utc).astimezone().isoformat(),
        "topology": {
            "name": spec.name,
            "source": spec.source,
            "platforms_under_test": list(spec.platforms_under_test),
        },
        "environment": {
            "logs": {
                "root_dir": str(log_root),
                "adb_dir": str(log_root / f"{run_id}-adb"),
            },
            "allure": {
                "results_dir": str(log_root / f"{run_id}-allure-results"),
                "report_dir": str(log_root / f"{run_id}-allure-report"),
            },
        },
        "accounts": accounts,
        "clients": clients,
        "capabilities": {
            "primary_multi_device_sync": len(accounts["primary"]["clients"]) >= 2,
            "remote_multi_device_sync": len(accounts.get("remote", {}).get("clients", [])) >= 2,
            "server_api": bool((config.get("rest_api") or {}).get("auth_token") or (config.get("rest_api") or {}).get("client_id")),
        },
        "artifacts": {
            "context_path": str(output_root / "run" / run_id / "context.yaml"),
            "topology_resolved_path": str(output_root / "run" / run_id / "topology.resolved.yaml"),
            "preflight_path": str(output_root / "run" / run_id / "preflight.json"),
            "case_results_json": str(output_root / "test-results" / f"{run_id}-case-results.json"),
            "case_results_csv": str(output_root / "test-results" / f"{run_id}-case-results.csv"),
        },
    }


def write_topology_context(context: dict[str, Any], context_path: Path) -> None:
    context_path.parent.mkdir(parents=True, exist_ok=True)
    context_path.write_text(
        yaml.safe_dump(context, allow_unicode=True, sort_keys=False),
        encoding="utf-8",
    )
    resolved_path = Path(context["artifacts"]["topology_resolved_path"])
    resolved_path.parent.mkdir(parents=True, exist_ok=True)
    resolved_path.write_text(
        yaml.safe_dump(context, allow_unicode=True, sort_keys=False),
        encoding="utf-8",
    )
```

- [ ] **Step 4: Add topology mode to e2e_prepare**

Modify `native-auto-test/src/tools/e2e_prepare.py`:

```python
from .config import load_config
from .topology_loader import build_topology_context, load_topology, write_topology_context
from .topology_model import parse_device_overrides
```

Add parser options while keeping old options temporarily for lower-level tests:

```python
parser.add_argument("--topology", default="")
parser.add_argument("--device", action="append", default=[])
parser.add_argument("--client", action="append", default=[])
```

In `main`, before old `build_prepare_context`, add:

```python
    if args.topology:
        from .android_e2e_runner import _connected_android_devices

        spec = load_topology(Path(args.topology))
        context = build_topology_context(
            spec=spec,
            run_id=args.run_id or build_run_id(list(spec.platforms_under_test)),
            output_root=Path(args.output_root),
            config=load_config(),
            available_devices=_connected_android_devices(),
            device_overrides=parse_device_overrides(args.device),
            install_mode=args.install_mode,
        )
        write_topology_context(context, Path(context["artifacts"]["context_path"]))
        print(context["artifacts"]["context_path"])
        return 0
```

Keep the old branch working for existing tests until Task 9 removes it from official entry.

- [ ] **Step 5: Run tests and CLI smoke**

Run:

```bash
cd native-auto-test
pytest -q tests/tools/test_topology_loader.py
python -m src.tools.e2e_prepare --topology config/topologies/android-primary-dual-remote.yaml --run-id topology-plan-smoke --device primary_a=emulator-5554 --device primary_b=emulator-5558 --device remote_c=emulator-5560
```

Expected: tests PASS; CLI prints `out/run/topology-plan-smoke/context.yaml`.

- [ ] **Step 6: Inspect generated context for secrets**

Run:

```bash
cd native-auto-test
rg -n "secret|token|password|client_secret|auth_token" out/run/topology-plan-smoke/context.yaml out/run/topology-plan-smoke/topology.resolved.yaml
```

Expected: no matches for actual sensitive fields. A match on non-secret text must be reviewed and removed if it contains a secret value.

- [ ] **Step 7: Commit**

```bash
git add native-auto-test/src/tools/topology_loader.py native-auto-test/src/tools/e2e_prepare.py native-auto-test/src/tools/e2e_context.py native-auto-test/tests/tools/test_topology_loader.py
git commit -m "feat: generate topology run context"
```

---

### Task 3: Context-Driven Android Runner Startup

**Files:**
- Modify: `native-auto-test/src/tools/android_e2e_runner.py`
- Modify: `native-auto-test/src/tools/e2e_full_run.py`
- Test: `native-auto-test/tests/tools/test_e2e_full_run.py`

**Interfaces:**
- Consumes: `context.yaml` dict from Task 2
- Produces CLI: `python -m src.tools.android_e2e_runner --run-context out/run/<run_id>/context.yaml -- ...`
- Produces: `build_topology_runner_commands(topology: str, run_id: str, output_root: str, device_args: list[str], install_mode: str, pytest_args: list[str]) -> list[list[str]]`

- [ ] **Step 1: Add failing full-run command tests**

Append to `native-auto-test/tests/tools/test_e2e_full_run.py`:

```python
from src.tools.e2e_full_run import build_topology_runner_commands


def test_full_run_topology_builds_prepare_runner_coverage_stages():
    commands = build_topology_runner_commands(
        topology="config/topologies/android-primary-dual-remote.yaml",
        run_id="android-topology-001",
        output_root="out",
        device_args=[
            "primary_a=emulator-5554",
            "primary_b=emulator-5558",
            "remote_c=emulator-5560",
        ],
        install_mode="clean",
        pytest_args=["tests/chat/test_chat_manager_remaining_api_coverage.py::test_chat_manager_send_to_non_friend_message_error_event", "-q"],
    )

    assert [command[2] for command in commands] == [
        "src.tools.e2e_prepare",
        "src.tools.android_e2e_runner",
        "src.tools.e2e_api_coverage",
    ]
    assert "--topology" in commands[0]
    assert "--run-context" in commands[1]
    assert "out/run/android-topology-001/context.yaml" in commands[1]
    assert commands[1][-2:] == [
        "tests/chat/test_chat_manager_remaining_api_coverage.py::test_chat_manager_send_to_non_friend_message_error_event",
        "-q",
    ]
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```bash
cd native-auto-test
pytest -q tests/tools/test_e2e_full_run.py::test_full_run_topology_builds_prepare_runner_coverage_stages
```

Expected: FAIL because `build_topology_runner_commands` does not exist.

- [ ] **Step 3: Implement topology command builder**

Modify `native-auto-test/src/tools/e2e_full_run.py`:

```python
def build_topology_runner_commands(
    *,
    topology: str,
    run_id: str,
    output_root: str,
    device_args: list[str],
    install_mode: str,
    pytest_args: list[str],
) -> list[list[str]]:
    context_path = f"{output_root}/run/{run_id}/context.yaml"
    case_results = f"{output_root}/test-results/{run_id}-case-results.json"
    gap_backlog = f"{output_root}/api-coverage/{run_id}-gap-backlog.csv"
    prepare = [
        sys.executable,
        "-m",
        "src.tools.e2e_prepare",
        "--topology",
        topology,
        "--run-id",
        run_id,
        "--output-root",
        output_root,
        "--install-mode",
        install_mode,
    ]
    for value in device_args:
        prepare.extend(["--device", value])
    runner = [
        sys.executable,
        "-m",
        "src.tools.android_e2e_runner",
        "--run-context",
        context_path,
        "--",
        *pytest_args,
    ]
    coverage = [
        sys.executable,
        "-m",
        "src.tools.e2e_api_coverage",
        "--run-id",
        run_id,
        "--case-results",
        case_results,
        "--output",
        gap_backlog,
        "--platform",
        "android",
    ]
    return [prepare, runner, coverage]
```

Update parser:

```python
parser.add_argument("--topology", default="")
parser.add_argument("--device", action="append", default=[])
parser.add_argument("--client", action="append", default=[])
```

At the top of `main`, after pytest arg normalization:

```python
    if args.topology:
        commands = build_topology_runner_commands(
            topology=args.topology,
            run_id=args.run_id,
            output_root=args.output_root,
            device_args=args.device,
            install_mode=args.install_mode,
            pytest_args=pytest_args,
        )
    elif _is_android_android_matrix(args.platform_matrix, args.client, args.sdk_version):
        ...
```

- [ ] **Step 4: Add run-context parsing to Android runner**

Modify `native-auto-test/src/tools/android_e2e_runner.py`:

```python
import yaml
```

Add:

```python
def _load_run_context(path: str) -> dict:
    if not path:
        return {}
    return yaml.safe_load(Path(path).read_text(encoding="utf-8")) or {}


def _android_clients_from_context(context: dict) -> list[dict]:
    clients = []
    for name, raw in (context.get("clients") or {}).items():
        if raw.get("platform") != "android":
            continue
        clients.append(
            {
                "name": name,
                "device_id": raw["device"]["id"],
                "topic": raw["relay"]["topic"],
                "account": raw["account"],
                "user_id": raw["user_id"],
            }
        )
    return clients
```

Change `_build_commands` to accept `device_names: list[str] | None = None` and `topics: list[str] | None = None`. Replace generated `deviceA/deviceB` names and topics with:

```python
    device_names = device_names or [f"device{chr(ord('A') + index)}" for index in range(len(device_ids))]
    topics = topics or [f"{get_topic_prefix()}-{run_id}-{device_name}" for device_name in device_names]
```

In `run(args)`, load context:

```python
    context = _load_run_context(args.run_context)
    context_clients = _android_clients_from_context(context)
    if context_clients:
        run_id = context["run_id"]
        args.device_ids = [client["device_id"] for client in context_clients]
        device_names = [client["name"] for client in context_clients]
        topics = [client["topic"] for client in context_clients]
    else:
        device_names = None
        topics = None
```

Pass `device_names=device_names` and `topics=topics` into `_build_commands`.

Set required device count:

```python
    required_device_count = len(context_clients) if context_clients else _required_device_count(pytest_args)
```

When initializing bridge devices, use the actual topology client name:

```python
        for index, flutter_run in enumerate(commands.flutter_run[:required_device_count]):
            device_name = device_names[index] if device_names else f"device{chr(ord('A') + index)}"
```

Add parser option:

```python
parser.add_argument("--run-context", default="")
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
cd native-auto-test
pytest -q tests/tools/test_e2e_full_run.py::test_full_run_topology_builds_prepare_runner_coverage_stages tests/tools/test_e2e_full_run.py
```

Expected: PASS.

- [ ] **Step 6: Dry-run command inspection**

Run:

```bash
cd native-auto-test
python - <<'PY'
from src.tools.e2e_full_run import build_topology_runner_commands
for command in build_topology_runner_commands(
    topology="config/topologies/android-primary-dual-remote.yaml",
    run_id="android-topology-001",
    output_root="out",
    device_args=["primary_a=emulator-5554", "primary_b=emulator-5558", "remote_c=emulator-5560"],
    install_mode="clean",
    pytest_args=["tests/client/test_client_single_device_smoke.py", "-q"],
):
    print(command)
PY
```

Expected: prepare command contains `--topology`; runner command contains `--run-context out/run/android-topology-001/context.yaml`.

- [ ] **Step 7: Commit**

```bash
git add native-auto-test/src/tools/e2e_full_run.py native-auto-test/src/tools/android_e2e_runner.py native-auto-test/tests/tools/test_e2e_full_run.py
git commit -m "feat: run android e2e from topology context"
```

---

### Task 4: Topology Fixture And Preflight Markers

**Files:**
- Create: `native-auto-test/src/tools/topology_fixture.py`
- Create: `native-auto-test/src/tools/preflight.py`
- Modify: `native-auto-test/tests/conftest.py`
- Modify: `native-auto-test/pytest.ini`
- Test: `native-auto-test/tests/tools/test_topology_fixture.py`
- Test: `native-auto-test/tests/tools/test_preflight.py`

**Interfaces:**
- Consumes: `context.yaml`
- Produces: `Topology.from_context(context: dict, debug: bool = False) -> Topology`
- Produces: `Topology.primary_client(index: int) -> TopologyClient`
- Produces: `Topology.supports(name: str) -> bool`
- Produces: `should_skip_case(flow: str | None, capabilities: dict[str, bool], counts: dict[str, int], requires_server_api: bool) -> str | None`

- [ ] **Step 1: Write failing fixture tests**

Create `native-auto-test/tests/tools/test_topology_fixture.py`:

```python
from src.tools.topology_fixture import Topology


def _context():
    return {
        "run_id": "run-1",
        "accounts": {
            "primary": {"user_id": "user1", "clients": ["primary_a", "primary_b"]},
            "remote": {"user_id": "user2", "clients": ["remote_c"]},
        },
        "clients": {
            "primary_a": {
                "platform": "android",
                "account": "primary",
                "user_id": "user1",
                "sdk_version": "4.23.0",
                "device": {"id": "emulator-5554"},
                "relay": {"topic": "im-auto-run-1-primary_a"},
            },
            "primary_b": {
                "platform": "android",
                "account": "primary",
                "user_id": "user1",
                "sdk_version": "4.23.0",
                "device": {"id": "emulator-5558"},
                "relay": {"topic": "im-auto-run-1-primary_b"},
            },
            "remote_c": {
                "platform": "android",
                "account": "remote",
                "user_id": "user2",
                "sdk_version": "4.23.0",
                "device": {"id": "emulator-5560"},
                "relay": {"topic": "im-auto-run-1-remote_c"},
            },
        },
        "capabilities": {
            "primary_multi_device_sync": True,
            "remote_multi_device_sync": False,
            "server_api": True,
        },
    }


def test_topology_returns_role_clients_without_starting_connection():
    topology = Topology.from_context(_context(), start_connections=False)

    assert topology.primary_client(0).name == "primary_a"
    assert topology.primary_client(1).user_id == "user1"
    assert topology.remote_client(0).name == "remote_c"
    assert topology.supports("primary_multi_device_sync") is True
    assert topology.supports("remote_multi_device_sync") is False
    assert topology.marker("send-text").startswith("run-1-send-text-")
```

Create `native-auto-test/tests/tools/test_preflight.py`:

```python
import pytest

from src.tools.preflight import topology_counts, skip_reason_for_flow


def test_skip_reason_for_missing_remote_is_chinese():
    reason = skip_reason_for_flow(
        flow="peer_interaction",
        counts={"primary": 1, "remote": 0},
        capabilities={"server_api": False},
        requires_server_api=False,
    )

    assert reason == "当前 topology 不满足 peer_interaction：要求 remote 账号至少 1 个客户端，实际 0 个。"


def test_primary_send_sync_supported_by_dual_primary_and_remote():
    assert skip_reason_for_flow(
        flow="primary_send_sync",
        counts={"primary": 2, "remote": 1},
        capabilities={"server_api": False},
        requires_server_api=False,
    ) is None


def test_unknown_flow_is_rejected():
    with pytest.raises(ValueError, match="未知 e2e_flow"):
        skip_reason_for_flow(
            flow="unknown",
            counts={"primary": 1, "remote": 1},
            capabilities={},
            requires_server_api=False,
        )
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
cd native-auto-test
pytest -q tests/tools/test_topology_fixture.py tests/tools/test_preflight.py
```

Expected: FAIL because modules do not exist.

- [ ] **Step 3: Implement preflight helpers**

Create `native-auto-test/src/tools/preflight.py`:

```python
from __future__ import annotations

from typing import Any

from .topology_model import FLOW_REQUIREMENTS


def topology_counts(context: dict[str, Any]) -> dict[str, int]:
    accounts = context.get("accounts") or {}
    return {
        name: len(raw.get("clients") or [])
        for name, raw in accounts.items()
    }


def skip_reason_for_flow(
    *,
    flow: str | None,
    counts: dict[str, int],
    capabilities: dict[str, bool],
    requires_server_api: bool,
) -> str | None:
    if not flow:
        return "缺少 e2e_flow marker，无法判断当前 topology 是否支持。"
    requirement = FLOW_REQUIREMENTS.get(flow)
    if requirement is None:
        raise ValueError(f"未知 e2e_flow: {flow}")
    primary_count = counts.get("primary", 0)
    remote_count = counts.get("remote", 0)
    if primary_count < requirement.primary_clients:
        return (
            f"当前 topology 不满足 {flow}：要求 primary 账号至少 "
            f"{requirement.primary_clients} 个客户端，实际 {primary_count} 个。"
        )
    if remote_count < requirement.remote_clients:
        return (
            f"当前 topology 不满足 {flow}：要求 remote 账号至少 "
            f"{requirement.remote_clients} 个客户端，实际 {remote_count} 个。"
        )
    if (requires_server_api or requirement.server_api) and not capabilities.get("server_api", False):
        return f"当前 topology 不满足 {flow}：要求 server_api 能力。"
    return None
```

- [ ] **Step 4: Implement topology fixture wrappers**

Create `native-auto-test/src/tools/topology_fixture.py`:

```python
from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from uuid import uuid4

from .ws_client import DeviceConnection


@dataclass
class TopologyClient:
    name: str
    platform: str
    account_name: str
    user_id: str
    device_id: str
    topic: str
    sdk_version: str
    _conn: DeviceConnection | None = None

    def start(self) -> None:
        if self._conn is None:
            self._conn = DeviceConnection(device=self.name, topic=self.topic)
            self._conn.start()

    def stop(self) -> None:
        if self._conn is not None:
            self._conn.stop()
            self._conn = None

    def call(self, manager: str, cmd: str, info: dict | None = None, **kwargs):
        self.start()
        assert self._conn is not None
        return self._conn.call(manager, cmd, info, **kwargs)

    def receive_message(self, *, match_cmd=None, match_event_type=None, timeout=10.0):
        self.start()
        assert self._conn is not None
        return self._conn.receive_message(
            match_cmd=match_cmd,
            match_event_type=match_event_type,
            timeout=timeout,
        )

    def drain_events(self, timeout: float = 2.0) -> None:
        self.start()
        assert self._conn is not None
        self._conn.drain_events(timeout=timeout)


class Topology:
    def __init__(
        self,
        *,
        run_id: str,
        accounts: dict[str, Any],
        clients: dict[str, TopologyClient],
        capabilities: dict[str, bool],
    ):
        self.run_id = run_id
        self.accounts = accounts
        self._clients = clients
        self._capabilities = capabilities

    @classmethod
    def from_context(cls, context: dict[str, Any], *, start_connections: bool = True) -> "Topology":
        clients = {}
        for name, raw in (context.get("clients") or {}).items():
            client = TopologyClient(
                name=name,
                platform=raw["platform"],
                account_name=raw["account"],
                user_id=raw["user_id"],
                device_id=raw["device"]["id"],
                topic=raw["relay"]["topic"],
                sdk_version=raw["sdk_version"],
            )
            if start_connections:
                client.start()
            clients[name] = client
        return cls(
            run_id=context["run_id"],
            accounts=context.get("accounts") or {},
            clients=clients,
            capabilities=context.get("capabilities") or {},
        )

    def close(self) -> None:
        for client in self._clients.values():
            client.stop()

    def account(self, name: str) -> dict[str, Any]:
        return self.accounts[name]

    def client(self, name: str) -> TopologyClient:
        return self._clients[name]

    def clients(self, *, account: str | None = None, platform: str | None = None) -> list[TopologyClient]:
        values = list(self._clients.values())
        if account is not None:
            values = [client for client in values if client.account_name == account]
        if platform is not None:
            values = [client for client in values if client.platform == platform]
        return values

    def primary_clients(self) -> list[TopologyClient]:
        return self.clients(account="primary")

    def remote_clients(self) -> list[TopologyClient]:
        return self.clients(account="remote")

    def primary_client(self, index: int) -> TopologyClient:
        return self.primary_clients()[index]

    def remote_client(self, index: int) -> TopologyClient:
        return self.remote_clients()[index]

    def supports(self, name: str) -> bool:
        return bool(self._capabilities.get(name, False))

    def require(self, flow: str) -> None:
        from .preflight import skip_reason_for_flow, topology_counts
        import pytest

        reason = skip_reason_for_flow(
            flow=flow,
            counts=topology_counts({"accounts": self.accounts}),
            capabilities=self._capabilities,
            requires_server_api=False,
        )
        if reason:
            pytest.skip(reason)

    def marker(self, label: str) -> str:
        safe_label = "".join(ch if ch.isalnum() or ch in "-_" else "-" for ch in label)
        return f"{self.run_id}-{safe_label}-{uuid4().hex[:8]}"
```

- [ ] **Step 5: Integrate with pytest conftest**

Modify `native-auto-test/tests/conftest.py`:

Add imports:

```python
import yaml
from src.tools.preflight import skip_reason_for_flow, topology_counts
from src.tools.topology_fixture import Topology
```

Register markers in `pytest_configure`:

```python
    config.addinivalue_line("markers", "e2e_flow(name): topology interaction flow required by this case")
    config.addinivalue_line("markers", "e2e_optional(*names): optional topology capabilities asserted when present")
    config.addinivalue_line("markers", "disruptive_session: case changes login/session state and must be isolated")
    config.addinivalue_line("markers", "requires_server_api: case requires REST/server API support")
    config.addinivalue_line("markers", "requires_capability(name): case requires platform or SDK capability")
```

Add helpers:

```python
def _load_pytest_run_context(config):
    path = config.getoption("--run-context")
    if not path:
        return {}
    return yaml.safe_load(Path(path).read_text(encoding="utf-8")) or {}
```

Add fixture:

```python
@pytest.fixture(scope="session")
def topology(request, ws_debug):
    context = _load_pytest_run_context(request.config)
    if not context:
        pytest.skip("未提供 --run-context，无法使用 topology fixture")
    topo = Topology.from_context(context, start_connections=True)
    try:
        yield topo
    finally:
        topo.close()
```

In `global_login_logout`, before legacy login setup:

```python
    if request.config.getoption("--run-context"):
        yield
        return
```

In `pytest_collection_modifyitems`, add:

```python
    context = _load_pytest_run_context(config)
    if context:
        counts = topology_counts(context)
        capabilities = context.get("capabilities") or {}
        for item in items:
            flow_marker = item.get_closest_marker("e2e_flow")
            flow = flow_marker.args[0] if flow_marker and flow_marker.args else None
            requires_server_api = item.get_closest_marker("requires_server_api") is not None
            reason = skip_reason_for_flow(
                flow=flow,
                counts=counts,
                capabilities=capabilities,
                requires_server_api=requires_server_api,
            )
            if reason:
                item.add_marker(pytest.mark.skip(reason=reason))
```

- [ ] **Step 6: Run tests**

Run:

```bash
cd native-auto-test
pytest -q tests/tools/test_topology_fixture.py tests/tools/test_preflight.py
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add native-auto-test/src/tools/topology_fixture.py native-auto-test/src/tools/preflight.py native-auto-test/tests/conftest.py native-auto-test/pytest.ini native-auto-test/tests/tools/test_topology_fixture.py native-auto-test/tests/tools/test_preflight.py
git commit -m "feat: add topology pytest fixture and preflight"
```

---

### Task 5: Case Scope And Event Group Waiter

**Files:**
- Create: `native-auto-test/src/tools/case_scope.py`
- Create: `native-auto-test/src/tools/event_group_waiter.py`
- Test: `native-auto-test/tests/tools/test_event_group_waiter.py`

**Interfaces:**
- Produces: `CaseScope(marker: str, started_at: float, clients: list[Any])`
- Produces: `EventExpectation(name: str, client: Any, event_type: str, predicate: Callable[[dict], bool], correlation: str = "strong", required: bool = True)`
- Produces: `ForbiddenEvent(name: str, client: Any, event_type: str, predicate: Callable[[dict], bool], window: float = 2.0)`
- Produces: `wait_event_group(expected: list[EventExpectation], forbidden: list[ForbiddenEvent] | None = None, timeout: float = 30.0, poll_timeout: float = 0.5, description: str = "") -> EventGroupResult`

- [ ] **Step 1: Write failing event group tests**

Create `native-auto-test/tests/tools/test_event_group_waiter.py`:

```python
import pytest

from src.tools.event_group_waiter import EventExpectation, ForbiddenEvent, wait_event_group


class FakeClient:
    def __init__(self, name, events):
        self.name = name
        self.events = list(events)

    def receive_message(self, *, match_event_type=None, timeout=0.5):
        while self.events:
            event = self.events.pop(0)
            if match_event_type is None or event.get("eventType") == match_event_type:
                return event
        raise TimeoutError("no event")


def test_wait_event_group_matches_unordered_and_records_ignored():
    primary = FakeClient("primary_a", [
        {"eventType": "onMessagesReceived", "data": {"content": "external"}},
        {"eventType": "onMessageSuccess", "data": {"content": "marker-1"}},
    ])
    remote = FakeClient("remote_c", [
        {"eventType": "onMessagesReceived", "data": {"content": "marker-1"}},
    ])

    result = wait_event_group(
        expected=[
            EventExpectation(
                name="send success",
                client=primary,
                event_type="onMessageSuccess",
                predicate=lambda event: event["data"]["content"] == "marker-1",
            ),
            EventExpectation(
                name="remote receive",
                client=remote,
                event_type="onMessagesReceived",
                predicate=lambda event: event["data"]["content"] == "marker-1",
            ),
        ],
        timeout=1.0,
        poll_timeout=0.01,
    )

    assert result.ok is True
    assert sorted(result.matched) == ["remote receive", "send success"]
    assert result.ignored["primary_a"][0]["data"]["content"] == "external"


def test_wait_event_group_fails_on_forbidden_event():
    remote = FakeClient("remote_c", [
        {"eventType": "onConversationChanged", "data": {"operation": "pin"}},
    ])

    with pytest.raises(AssertionError, match="禁止事件"):
        wait_event_group(
            expected=[],
            forbidden=[
                ForbiddenEvent(
                    name="remote account state",
                    client=remote,
                    event_type="onConversationChanged",
                    predicate=lambda event: event["data"]["operation"] == "pin",
                    window=0.01,
                )
            ],
            timeout=0.01,
            poll_timeout=0.01,
        )
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
cd native-auto-test
pytest -q tests/tools/test_event_group_waiter.py
```

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement event group waiter**

Create `native-auto-test/src/tools/event_group_waiter.py`:

```python
from __future__ import annotations

from dataclasses import dataclass, field
from time import monotonic
from typing import Any, Callable


@dataclass(frozen=True)
class EventExpectation:
    name: str
    client: Any
    event_type: str
    predicate: Callable[[dict], bool]
    correlation: str = "strong"
    required: bool = True


@dataclass(frozen=True)
class ForbiddenEvent:
    name: str
    client: Any
    event_type: str
    predicate: Callable[[dict], bool]
    window: float = 2.0


@dataclass
class EventGroupResult:
    ok: bool
    matched: dict[str, dict] = field(default_factory=dict)
    missing: list[str] = field(default_factory=list)
    ignored: dict[str, list[dict]] = field(default_factory=dict)
    forbidden: dict[str, dict] = field(default_factory=dict)


def _client_name(client: Any) -> str:
    return str(getattr(client, "name", getattr(client, "_device", "unknown")))


def _attach_allure(name: str, payload: Any) -> None:
    try:
        import allure
        import json

        allure.attach(
            json.dumps(payload, ensure_ascii=False, indent=2, default=str),
            name,
            allure.attachment_type.JSON,
        )
    except Exception:
        return


def _poll_client(client: Any, event_type: str | None, poll_timeout: float) -> dict | None:
    try:
        return client.receive_message(match_event_type=event_type, timeout=poll_timeout)
    except Exception:
        return None


def wait_event_group(
    *,
    expected: list[EventExpectation],
    forbidden: list[ForbiddenEvent] | None = None,
    timeout: float = 30.0,
    poll_timeout: float = 0.5,
    description: str = "",
) -> EventGroupResult:
    forbidden = forbidden or []
    result = EventGroupResult(ok=False)
    pending = {item.name: item for item in expected if item.required}
    clients = []
    for item in [*expected, *forbidden]:
        if item.client not in clients:
            clients.append(item.client)
            result.ignored[_client_name(item.client)] = []

    deadline = monotonic() + timeout
    while monotonic() < deadline and pending:
        progressed = False
        for client in clients:
            event = _poll_client(client, None, poll_timeout)
            if event is None:
                continue
            progressed = True
            for forbid in forbidden:
                if forbid.client is client and event.get("eventType") == forbid.event_type and forbid.predicate(event):
                    result.forbidden[forbid.name] = event
                    _attach_allure("event_group_forbidden", result.forbidden)
                    raise AssertionError(f"命中禁止事件: {forbid.name}")
            matched_name = None
            for name, item in list(pending.items()):
                if item.client is client and event.get("eventType") == item.event_type and item.predicate(event):
                    matched_name = name
                    result.matched[name] = event
                    del pending[name]
                    break
            if matched_name is None:
                result.ignored[_client_name(client)].append(event)
        if not progressed:
            continue

    result.missing = list(pending)
    if result.missing:
        _attach_allure("event_group_matched", result.matched)
        _attach_allure("event_group_missing", result.missing)
        _attach_allure("event_group_ignored", result.ignored)
        raise AssertionError(f"缺失事件: {', '.join(result.missing)}")

    forbidden_deadline = monotonic() + max([item.window for item in forbidden], default=0.0)
    while monotonic() < forbidden_deadline:
        for forbid in forbidden:
            event = _poll_client(forbid.client, forbid.event_type, poll_timeout)
            if event is not None and forbid.predicate(event):
                result.forbidden[forbid.name] = event
                _attach_allure("event_group_forbidden", result.forbidden)
                raise AssertionError(f"命中禁止事件: {forbid.name}")

    result.ok = True
    _attach_allure("event_group_matched", result.matched)
    _attach_allure("event_group_ignored", result.ignored)
    if description:
        _attach_allure("event_group_description", {"description": description})
    return result
```

- [ ] **Step 4: Implement case scope**

Create `native-auto-test/src/tools/case_scope.py`:

```python
from __future__ import annotations

from dataclasses import dataclass, field
from time import monotonic
from typing import Any


@dataclass
class CaseScope:
    marker: str
    clients: list[Any]
    started_at: float = field(default_factory=monotonic)

    def drain(self, timeout: float = 0.5) -> None:
        for client in self.clients:
            try:
                client.drain_events(timeout=timeout)
            except Exception as exc:
                self._attach(f"drain-before-case-{getattr(client, 'name', 'client')}", {"error": str(exc)})

    def _attach(self, name: str, payload: Any) -> None:
        try:
            import allure
            import json

            allure.attach(
                json.dumps(payload, ensure_ascii=False, indent=2, default=str),
                name,
                allure.attachment_type.JSON,
            )
        except Exception:
            return
```

Add to `Topology` in `topology_fixture.py`:

```python
    def case_scope(self, label: str, clients: list[TopologyClient] | None = None):
        from .case_scope import CaseScope

        selected = clients if clients is not None else list(self._clients.values())
        scope = CaseScope(marker=self.marker(label), clients=selected)
        scope.drain()
        return scope
```

- [ ] **Step 5: Run tests**

Run:

```bash
cd native-auto-test
pytest -q tests/tools/test_event_group_waiter.py tests/tools/test_topology_fixture.py
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add native-auto-test/src/tools/case_scope.py native-auto-test/src/tools/event_group_waiter.py native-auto-test/src/tools/topology_fixture.py native-auto-test/tests/tools/test_event_group_waiter.py native-auto-test/tests/tools/test_topology_fixture.py
git commit -m "feat: add scoped event group waiter"
```

---

### Task 6: Lifecycle Reporting And Environment Failure Handling

**Files:**
- Modify: `native-auto-test/src/tools/android_e2e_runner.py`
- Create: `native-auto-test/tests/tools/test_android_topology_runner.py`

**Interfaces:**
- Consumes: `context.yaml`
- Produces: `out/run/<run_id>/context.yaml` lifecycle updates or `out/run/<run_id>/lifecycle.yaml`
- Produces: fail-fast behavior when install/init/login/startCallback fails.

- [ ] **Step 1: Add tests for lifecycle update helper**

Create `native-auto-test/tests/tools/test_android_topology_runner.py`:

```python
from pathlib import Path

import yaml

from src.tools.android_e2e_runner import _write_client_lifecycle


def test_write_client_lifecycle_updates_context(tmp_path):
    context_path = tmp_path / "context.yaml"
    context_path.write_text(
        yaml.safe_dump(
            {
                "run_id": "run-1",
                "clients": {
                    "primary_a": {
                        "lifecycle": {
                            "install": "pending",
                            "init": "pending",
                            "login": "pending",
                            "start_callback": "pending",
                        }
                    }
                },
            }
        ),
        encoding="utf-8",
    )

    _write_client_lifecycle(
        context_path,
        "primary_a",
        {"install": "success", "init": "success", "login": "failed", "login_error": {"code": 110}},
    )

    updated = yaml.safe_load(context_path.read_text(encoding="utf-8"))
    assert updated["clients"]["primary_a"]["lifecycle"]["install"] == "success"
    assert updated["clients"]["primary_a"]["lifecycle"]["login"] == "failed"
    assert updated["clients"]["primary_a"]["lifecycle"]["login_error"]["code"] == 110
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```bash
cd native-auto-test
pytest -q tests/tools/test_android_topology_runner.py
```

Expected: FAIL because `_write_client_lifecycle` does not exist.

- [ ] **Step 3: Implement lifecycle write helper**

Modify `native-auto-test/src/tools/android_e2e_runner.py`:

```python
def _write_client_lifecycle(context_path: Path, client_name: str, updates: dict) -> None:
    if not context_path:
        return
    data = yaml.safe_load(context_path.read_text(encoding="utf-8")) or {}
    lifecycle = data.setdefault("clients", {}).setdefault(client_name, {}).setdefault("lifecycle", {})
    lifecycle.update(updates)
    context_path.write_text(
        yaml.safe_dump(data, allow_unicode=True, sort_keys=False),
        encoding="utf-8",
    )
```

During runner startup, after uninstall succeeds for a context client:

```python
_write_client_lifecycle(Path(args.run_context), device_name, {"install": "success"})
```

After `_init_bridge_device` succeeds:

```python
_write_client_lifecycle(Path(args.run_context), device_name, {"init": "success"})
```

If `_init_bridge_device` raises, catch, write:

```python
_write_client_lifecycle(Path(args.run_context), device_name, {"init": "failed", "init_error": {"message": str(exc)}})
raise
```

Login/startCallback lifecycle should be added in the same place that topology login is implemented. If the current runner still delegates login to pytest fixtures, this task should explicitly record `login: external` and `start_callback: external` until Task 7 moves login into runner.

- [ ] **Step 4: Run tests**

Run:

```bash
cd native-auto-test
pytest -q tests/tools/test_android_topology_runner.py
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add native-auto-test/src/tools/android_e2e_runner.py native-auto-test/tests/tools/test_android_topology_runner.py
git commit -m "feat: record topology client lifecycle"
```

---

### Task 7: Runner-Owned Topology Login And Callback Startup

**Files:**
- Modify: `native-auto-test/src/tools/android_e2e_runner.py`
- Modify: `native-auto-test/tests/conftest.py`
- Test: `native-auto-test/tests/tools/test_android_topology_runner.py`

**Interfaces:**
- Consumes: context clients with `account`, `user_id`, and `user_ref`
- Produces: `_login_context_client(client_name: str, context: dict, use_token_login: bool = False) -> None`
- Produces: all topology clients logged in before pytest starts.

- [ ] **Step 1: Add tests for login payload selection**

Append to `native-auto-test/tests/tools/test_android_topology_runner.py`:

```python
from src.tools.android_e2e_runner import _login_payload_for_client


def test_login_payload_for_context_client_uses_user_ref_without_secret_in_context():
    context = {
        "accounts": {
            "primary": {"user_ref": "a", "user_id": "user1"},
        },
        "clients": {
            "primary_a": {"account": "primary", "user_id": "user1"},
        },
    }
    config = {"accounts": {"default_password": "pwd"}}

    payload = _login_payload_for_client(context, config, "primary_a")

    assert payload == {"userId": "user1", "password": "pwd"}
```

- [ ] **Step 2: Run test and verify it fails**

Run:

```bash
cd native-auto-test
pytest -q tests/tools/test_android_topology_runner.py::test_login_payload_for_context_client_uses_user_ref_without_secret_in_context
```

Expected: FAIL because helper does not exist.

- [ ] **Step 3: Implement login helpers**

Modify `native-auto-test/src/tools/android_e2e_runner.py`:

```python
from .config import load_config
```

Add:

```python
def _login_payload_for_client(context: dict, config: dict, client_name: str) -> dict:
    raw_client = context["clients"][client_name]
    raw_account = context["accounts"][raw_client["account"]]
    user_id = raw_account["user_id"]
    accounts_cfg = config.get("accounts") or {}
    users_cfg = accounts_cfg.get("users") or {}
    user_ref = raw_account.get("user_ref", "")
    user_cfg = users_cfg.get(user_ref) if isinstance(users_cfg, dict) else {}
    password = ""
    if isinstance(user_cfg, dict):
        password = str(user_cfg.get("password") or "")
    password = password or str(accounts_cfg.get("default_password") or "")
    if not password:
        raise RuntimeError(f"client {client_name} 无法解析登录密码")
    return {"userId": user_id, "password": password}


def _login_context_client(client_name: str, context: dict) -> None:
    conn = DeviceConnection(device=client_name, topic=context["clients"][client_name]["relay"]["topic"])
    conn.start()
    try:
        payload = _login_payload_for_client(context, load_config(), client_name)
        resp = conn.call("Client", "login", info=payload, timeout=60.0)
        if resp.get("success") is False or resp.get("error"):
            raise RuntimeError(f"login failed for {client_name}: {resp}")
        cb_resp = conn.call("Client", "startCallback", info={}, timeout=30.0)
        if cb_resp.get("success") is False or cb_resp.get("error"):
            raise RuntimeError(f"startCallback failed for {client_name}: {cb_resp}")
    finally:
        conn.stop()
```

After init for each context client succeeds, call `_login_context_client(device_name, context)` and update lifecycle:

```python
try:
    _login_context_client(device_name, context)
    _write_client_lifecycle(Path(args.run_context), device_name, {"login": "success", "start_callback": "success"})
except Exception as exc:
    _write_client_lifecycle(Path(args.run_context), device_name, {"login": "failed", "login_error": {"message": str(exc)}})
    raise
```

- [ ] **Step 4: Ensure legacy pytest global login stays disabled under topology**

Confirm `global_login_logout` in `tests/conftest.py` yields immediately when `--run-context` is present. If not, add:

```python
    if request.config.getoption("--run-context"):
        yield
        return
```

- [ ] **Step 5: Run tests**

Run:

```bash
cd native-auto-test
pytest -q tests/tools/test_android_topology_runner.py
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add native-auto-test/src/tools/android_e2e_runner.py native-auto-test/tests/conftest.py native-auto-test/tests/tools/test_android_topology_runner.py
git commit -m "feat: login topology clients in runner"
```

---

### Task 8: Representative Case Migration

**Files:**
- Modify: `native-auto-test/tests/chat/test_chat_manager_remaining_api_coverage.py`
- Modify: `native-auto-test/tests/chat/test_chat_reaction_fetch.py`
- Modify: `native-auto-test/tests/chat/_message_helpers.py`
- Modify or create: `native-auto-test/tests/chat/message_event_matchers.py`
- Test: run selected representative cases on Android topology.

**Interfaces:**
- Consumes: `topology` fixture, `wait_event_group`, `EventExpectation`, `ForbiddenEvent`
- Produces: at least one migrated case for `error_response`, one for `sender_terminal_error`, and one for `primary_send_sync` or `peer_interaction`.

- [ ] **Step 1: Select three concrete cases**

Use these first three because they map to previously discussed failures:

```text
tests/chat/test_chat_reaction_fetch.py::test_chat_add_reaction_invalid_id_response
tests/chat/test_chat_manager_remaining_api_coverage.py::test_chat_manager_send_to_non_friend_message_error_event
tests/chat/test_chat_manager_remaining_api_coverage.py::test_chat_manager_conversation_marks_and_fetch_options
```

Classify:

```text
test_chat_add_reaction_invalid_id_response -> error_response
test_chat_manager_send_to_non_friend_message_error_event -> sender_terminal_error
test_chat_manager_conversation_marks_and_fetch_options -> account_state_sync
```

- [ ] **Step 2: Add marker and Chinese step helper usage**

For each selected case, add:

```python
@pytest.mark.real_e2e
@pytest.mark.e2e_flow("error_response")
@allure.title("聊天消息：对不存在的消息添加 reaction 返回服务端错误")
```

At the start of the case:

```python
case_steps(
    "1. 准备 primary_a 客户端并确认已登录。\n"
    "2. 调用 MessageManager.addReaction，messageId 使用不存在的值。\n"
    "3. 断言接口返回 code=600，description=Unknown server error。\n"
    "4. 断言不会产生 reaction 添加成功事件。"
)
```

For topology migration, replace `device_a` with:

```python
primary_a = topology.primary_client(0)
```

For account sync cases, also use:

```python
primary_b = topology.primary_client(1)
remote_c = topology.remote_client(0)
```

- [ ] **Step 3: Add marker-based message matcher helpers**

Create `native-auto-test/tests/chat/message_event_matchers.py`:

```python
from src.tools.event_group_waiter import EventExpectation


def expect_message_error(client, *, marker: str):
    return EventExpectation(
        name=f"{client.name} message error",
        client=client,
        event_type="onMessageError",
        predicate=lambda event: marker in str(event),
        correlation="strong",
    )


def expect_received_message(client, *, marker: str):
    return EventExpectation(
        name=f"{client.name} received message",
        client=client,
        event_type="onMessagesReceived",
        predicate=lambda event: marker in str(event),
        correlation="strong",
    )
```

- [ ] **Step 4: Migrate sender terminal error wait**

In `test_chat_manager_send_to_non_friend_message_error_event`, replace direct `receive_message(...)` with:

```python
scope = topology.case_scope("send-to-non-friend", clients=[primary_a])
marker = scope.marker
content = f"non-friend-{marker}"
resp = primary_a.call("ChatManager", Cmd.sendMessage.value, info=build_text(primary_a.user_id, user_c, content))
assert_api.assert_success(resp)
wait_event_group(
    expected=[expect_message_error(primary_a, marker=marker)],
    timeout=20.0,
    description="非好友发送消息只应在发送端收到失败 callback",
)
```

Keep existing code/error assertions that verify the error callback details, but source the event from `result.matched[...]` if needed.

- [ ] **Step 5: Run selected cases with existing runner topology**

Run with three Android devices:

```bash
cd native-auto-test
make e2e-full-run ARGS="--topology config/topologies/android-primary-dual-remote.yaml --run-id android-topology-representative-001 --install-mode clean --device primary_a=emulator-5554 --device primary_b=emulator-5558 --device remote_c=emulator-5560 -- tests/chat/test_chat_reaction_fetch.py::test_chat_add_reaction_invalid_id_response tests/chat/test_chat_manager_remaining_api_coverage.py::test_chat_manager_send_to_non_friend_message_error_event tests/chat/test_chat_manager_remaining_api_coverage.py::test_chat_manager_conversation_marks_and_fetch_options -q"
```

Expected: runner starts three clients. Passing is preferred, but if SDK behavior fails, the report must show topology clients, Chinese steps, and event-group attachments.

- [ ] **Step 6: Commit**

```bash
git add native-auto-test/tests/chat/test_chat_reaction_fetch.py native-auto-test/tests/chat/test_chat_manager_remaining_api_coverage.py native-auto-test/tests/chat/_message_helpers.py native-auto-test/tests/chat/message_event_matchers.py
git commit -m "test: migrate representative chat cases to topology"
```

---

### Task 9: Official Entry Cleanup And Old Model Guardrails

**Files:**
- Modify: `native-auto-test/src/tools/e2e_full_run.py`
- Modify: `native-auto-test/src/tools/e2e_prepare.py`
- Modify: `native-auto-test/Makefile`
- Modify: `native-auto-test/README.md` if it documents official E2E commands.
- Test: `native-auto-test/tests/tools/test_e2e_full_run.py`

**Interfaces:**
- Produces official command requiring `--topology`.
- Keeps old lower-level functions only where existing tests still need them, but they are not documented as official full-run path.

- [ ] **Step 1: Add test that full-run parser accepts topology without client**

Add to `tests/tools/test_e2e_full_run.py`:

```python
def test_topology_command_does_not_require_client_args():
    commands = build_topology_runner_commands(
        topology="config/topologies/android-primary-dual-remote.yaml",
        run_id="android-topology-002",
        output_root="out",
        device_args=[],
        install_mode="clean",
        pytest_args=[],
    )

    assert "--client" not in commands[0]
    assert "--topology" in commands[0]
```

- [ ] **Step 2: Make `--client` optional in full-run parser**

In `e2e_full_run.py`, ensure:

```python
parser.add_argument("--client", action="append", default=[])
```

At runtime:

```python
    if not args.topology and not args.client:
        parser.error("正式 E2E 需要 --topology；旧 --client 仅用于兼容调试。")
```

- [ ] **Step 3: Update Makefile help target text**

Change official E2E example from old `--client ... --platform-matrix android-android` to:

```bash
make e2e-full-run ARGS="--topology config/topologies/android-primary-dual-remote.yaml --run-id <run_id> --install-mode clean"
```

Keep `android-real-e2e` documented as a low-level debugging entry only if needed.

- [ ] **Step 4: Run command-building tests**

Run:

```bash
cd native-auto-test
pytest -q tests/tools/test_e2e_full_run.py
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add native-auto-test/src/tools/e2e_full_run.py native-auto-test/src/tools/e2e_prepare.py native-auto-test/Makefile native-auto-test/README.md native-auto-test/tests/tools/test_e2e_full_run.py
git commit -m "chore: make topology the official e2e entry"
```

---

### Task 10: First Topology Android Smoke Run And Report

**Files:**
- No source changes expected unless Tasks 1-9 reveal defects.
- Generated artifacts under `native-auto-test/out/`.

**Interfaces:**
- Consumes: official topology full-run command.
- Produces: Allure results/report, context, resolved topology, preflight, case results.

- [ ] **Step 1: Confirm devices**

Run:

```bash
adb devices
```

Expected: at least three `device` rows, or provide three explicit `--device client=id` mappings.

- [ ] **Step 2: Run representative topology suite**

Run:

```bash
cd native-auto-test
make e2e-full-run ARGS="--topology config/topologies/android-primary-dual-remote.yaml --run-id android-topology-smoke-001 --install-mode clean -- tests/chat/test_chat_reaction_fetch.py::test_chat_add_reaction_invalid_id_response tests/chat/test_chat_manager_remaining_api_coverage.py::test_chat_manager_send_to_non_friend_message_error_event tests/chat/test_chat_manager_remaining_api_coverage.py::test_chat_manager_conversation_marks_and_fetch_options -q"
```

Expected: runner starts three Android clients named `primary_a`, `primary_b`, and `remote_c`; pytest receives `--run-context`; Allure results are written under `out/log/android/...`.

- [ ] **Step 3: Generate or serve Allure report**

Run:

```bash
cd native-auto-test
allure generate out/log/android/android-topology-smoke-001-allure-results -o out/log/android/android-topology-smoke-001-allure-report --clean
allure open out/log/android/android-topology-smoke-001-allure-report --port 18088
```

Expected: browser URL opens on port `18088`; report shows Chinese numbered steps and event attachments for migrated cases.

- [ ] **Step 4: Verify run artifacts**

Run:

```bash
cd native-auto-test
ls out/run/android-topology-smoke-001/context.yaml out/run/android-topology-smoke-001/topology.resolved.yaml out/run/android-topology-smoke-001/preflight.json
ls out/test-results/android-topology-smoke-001-case-results.json out/test-results/android-topology-smoke-001-case-results.csv
```

Expected: all files exist. If `preflight.json` is not yet written by Task 4, add the missing write before accepting this task.

- [ ] **Step 5: Commit any fixes only**

If code fixes were needed:

```bash
git add <changed-source-files>
git commit -m "fix: stabilize topology smoke run"
```

Do not commit generated `out/` artifacts unless project policy explicitly changes.

---

### Task 11: Batch Migration Inventory

**Files:**
- Create: `native-auto-test/config/e2e_case_flows.yaml`
- Create or modify: `native-auto-test/src/tools/e2e_case_flow_audit.py`
- Test: `native-auto-test/tests/tools/test_e2e_case_flow_audit.py`

**Interfaces:**
- Produces a machine-readable inventory of existing real E2E cases and intended flow.
- Does not migrate all 535 cases in this task.

- [ ] **Step 1: Add initial inventory for migrated representative cases**

Create `native-auto-test/config/e2e_case_flows.yaml`:

```yaml
tests/chat/test_chat_reaction_fetch.py::test_chat_add_reaction_invalid_id_response:
  flow: error_response
  capabilities:
    - chat.message.reaction
  notes: 不需要 remote，不应等待接收端事件。

tests/chat/test_chat_manager_remaining_api_coverage.py::test_chat_manager_send_to_non_friend_message_error_event:
  flow: sender_terminal_error
  notes: 非好友发送失败，只断言发送端错误 callback。

tests/chat/test_chat_manager_remaining_api_coverage.py::test_chat_manager_conversation_marks_and_fetch_options:
  flow: account_state_sync
  optional:
    - primary_multi_device_sync
  notes: primary_a 操作，primary_b 同步，remote_c 不参与账号内同步。
```

- [ ] **Step 2: Add audit test**

Create `native-auto-test/tests/tools/test_e2e_case_flow_audit.py`:

```python
from pathlib import Path

import yaml

from src.tools.topology_model import FLOW_REQUIREMENTS


def test_case_flow_inventory_uses_known_flows():
    data = yaml.safe_load(Path("config/e2e_case_flows.yaml").read_text(encoding="utf-8")) or {}

    assert data
    for nodeid, raw in data.items():
        assert "::" in nodeid
        assert raw["flow"] in FLOW_REQUIREMENTS
```

- [ ] **Step 3: Run test**

Run:

```bash
cd native-auto-test
pytest -q tests/tools/test_e2e_case_flow_audit.py
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add native-auto-test/config/e2e_case_flows.yaml native-auto-test/tests/tools/test_e2e_case_flow_audit.py
git commit -m "chore: add e2e flow migration inventory"
```

---

## Self-Review Checklist

- Spec coverage:
  - Topology YAML and context are covered by Tasks 1-2.
  - Context-driven runner and three-client startup are covered by Tasks 3, 6, and 7.
  - Pytest markers, topology fixture, and preflight are covered by Task 4.
  - Event pollution and unordered event handling are covered by Task 5.
  - Representative migration and Chinese report steps are covered by Task 8.
  - Official entry cleanup is covered by Task 9.
  - Smoke run and Allure report are covered by Task 10.
  - Batch migration classification is covered by Task 11.
- Scope note: full migration of all existing cases is intentionally not in this milestone. Task 11 creates the inventory that enables subsequent batch plans.
- Placeholder scan: the plan contains no `TBD`, `TODO`, or undefined future placeholders.
- Type consistency: `TopologySpec`, `Topology`, `TopologyClient`, `EventExpectation`, `ForbiddenEvent`, and `wait_event_group` names are introduced before downstream tasks consume them.

