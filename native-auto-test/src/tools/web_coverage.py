"""Web API coverage manifest helpers."""
from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

from src.sdk_api.cmd_keys import Cmd


VALID_STATUSES = {
    "supported",
    "unsupported",
    "pending",
    "different",
    "not_applicable",
    "blocked",
}

VALID_VERIFICATION_LAYERS = {
    "json_bridge",
    "client_instance_manager",
    "public_dart_api",
}


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def manifest_path() -> Path:
    return _repo_root() / "config" / "web_api_coverage.yaml"


def load_manifest(path: Path | None = None) -> dict[str, Any]:
    target = path or manifest_path()
    with target.open("r", encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    return data


def iter_entries(manifest: dict[str, Any]) -> list[tuple[str, str, dict[str, Any]]]:
    web = manifest.get("web", {})
    entries: list[tuple[str, str, dict[str, Any]]] = []
    for manager, commands in web.items():
        if not isinstance(commands, dict):
            continue
        for cmd, info in commands.items():
            entries.append((str(manager), str(cmd), info or {}))
    return entries


def validate_manifest(manifest: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    seen_cmds: set[str] = set()
    for manager, cmd, info in iter_entries(manifest):
        seen_cmds.add(cmd)
        status = info.get("status")
        if status not in VALID_STATUSES:
            errors.append(f"{manager}.{cmd}: invalid status {status!r}")
        if not info.get("reason"):
            errors.append(f"{manager}.{cmd}: missing reason")
        if status in {"supported", "different"}:
            if not info.get("tests"):
                errors.append(f"{manager}.{cmd}: supported/different API missing tests")
            verified_by = info.get("verified_by")
            if not isinstance(verified_by, list) or not verified_by:
                errors.append(f"{manager}.{cmd}: supported/different API missing verified_by")
            else:
                invalid_layers = [
                    layer
                    for layer in verified_by
                    if layer not in VALID_VERIFICATION_LAYERS
                ]
                if invalid_layers:
                    errors.append(
                        f"{manager}.{cmd}: invalid verified_by layers "
                        f"{', '.join(map(str, invalid_layers))}"
                    )
            if not isinstance(info.get("public_api_verified"), bool):
                errors.append(
                    f"{manager}.{cmd}: supported/different API missing "
                    "boolean public_api_verified"
                )

    all_cmds = {cmd.value for cmd in Cmd}
    missing = sorted(all_cmds - seen_cmds)
    extra = sorted(seen_cmds - all_cmds)
    if missing:
        errors.append(f"missing Cmd entries: {', '.join(missing)}")
    if extra:
        errors.append(f"unknown Cmd entries: {', '.join(extra)}")
    return errors


def status_counts(manifest: dict[str, Any]) -> dict[str, int]:
    counts = {status: 0 for status in sorted(VALID_STATUSES)}
    for _, _, info in iter_entries(manifest):
        status = info.get("status")
        if status in counts:
            counts[status] += 1
    return counts
