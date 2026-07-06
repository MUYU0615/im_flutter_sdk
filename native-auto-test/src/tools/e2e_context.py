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
