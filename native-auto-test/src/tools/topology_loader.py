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
            "server_api": bool(
                (config.get("rest_api") or {}).get("auth_token")
                or (config.get("rest_api") or {}).get("client_id")
            ),
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
