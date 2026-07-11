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
    debug: bool = False
    _conn: DeviceConnection | None = None

    def start(self) -> None:
        if self._conn is None:
            self._conn = DeviceConnection(device=self.name, topic=self.topic, debug=self.debug)
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
    def from_context(
        cls,
        context: dict[str, Any],
        *,
        start_connections: bool = True,
        debug: bool = False,
    ) -> "Topology":
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
                debug=debug,
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
        import pytest

        from .preflight import skip_reason_for_flow, topology_counts

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
