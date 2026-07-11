from __future__ import annotations

from dataclasses import dataclass, field
from time import monotonic
from typing import Any

from .event_group_waiter import _redact_sensitive


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
                raise

    def _attach(self, name: str, payload: Any) -> None:
        try:
            import json

            import allure

            allure.attach(
                json.dumps(_redact_sensitive(payload), ensure_ascii=False, indent=2, default=str),
                name,
                allure.attachment_type.JSON,
            )
        except Exception:
            return
