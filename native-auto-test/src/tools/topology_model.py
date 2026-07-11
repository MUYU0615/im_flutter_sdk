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
    "sender_terminal_error": FlowRequirement(primary_clients=1, remote_clients=1),
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
