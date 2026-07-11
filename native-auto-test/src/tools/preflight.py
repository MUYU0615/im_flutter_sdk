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
        return None
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


def should_skip_case(
    flow: str | None,
    capabilities: dict[str, bool],
    counts: dict[str, int],
    requires_server_api: bool,
) -> str | None:
    return skip_reason_for_flow(
        flow=flow,
        counts=counts,
        capabilities=capabilities,
        requires_server_api=requires_server_api,
    )
