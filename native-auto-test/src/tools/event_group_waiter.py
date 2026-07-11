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
        import json

        import allure

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
            remaining = deadline - monotonic()
            event = _poll_client(client, None, max(0.0, min(poll_timeout, remaining)))
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

    started_forbidden_at = monotonic()
    forbidden_deadline = started_forbidden_at + max([item.window for item in forbidden], default=0.0)
    while monotonic() < forbidden_deadline:
        for forbid in forbidden:
            remaining_for_group = forbidden_deadline - monotonic()
            remaining_for_item = started_forbidden_at + forbid.window - monotonic()
            remaining = min(remaining_for_group, remaining_for_item)
            if remaining <= 0:
                continue
            event = _poll_client(forbid.client, forbid.event_type, max(0.0, min(poll_timeout, remaining)))
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
