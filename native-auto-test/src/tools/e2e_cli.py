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
