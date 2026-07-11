from __future__ import annotations

from dataclasses import dataclass, field
from copy import deepcopy
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
    errors: dict[str, str] = field(default_factory=dict)


def _client_name(client: Any) -> str:
    return str(getattr(client, "name", getattr(client, "_device", "unknown")))


def _redact_sensitive(payload: Any) -> Any:
    sensitive_keys = {"token", "password", "secret", "authorization", "client_secret", "private_key"}
    redacted = deepcopy(payload)

    def redact(value: Any) -> Any:
        if isinstance(value, dict):
            return {
                key: "***REDACTED***" if str(key).lower() in sensitive_keys else redact(item)
                for key, item in value.items()
            }
        if isinstance(value, list):
            return [redact(item) for item in value]
        return value

    return redact(redacted)


def _attach_allure(name: str, payload: Any) -> None:
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


def _poll_client(client: Any, event_type: str | None, poll_timeout: float) -> dict | None:
    try:
        return client.receive_message(match_event_type=event_type, timeout=poll_timeout)
    except TimeoutError:
        return None


def _match_event(
    *,
    event: dict,
    client: Any,
    pending: dict[str, EventExpectation],
    result: EventGroupResult,
) -> str | None:
    for name, item in list(pending.items()):
        if item.client is client and event.get("eventType") == item.event_type and item.predicate(event):
            result.matched[name] = event
            del pending[name]
            return name
    return None


def _missing_message(result: EventGroupResult) -> str:
    parts = [f"缺失事件: {', '.join(result.missing)}"]
    if result.matched:
        parts.append(f"已匹配事件: {', '.join(sorted(result.matched))}")
    ignored_counts = {
        client_name: len(events)
        for client_name, events in result.ignored.items()
        if events
    }
    if ignored_counts:
        ignored_summary = ", ".join(f"{client}:{count}" for client, count in sorted(ignored_counts.items()))
        parts.append(f"ignored={ignored_summary}")
    return "；".join(parts)


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
    optional = {item.name: item for item in expected if not item.required}
    clients = []
    for item in [*expected, *forbidden]:
        if item.client not in clients:
            clients.append(item.client)
            result.ignored[_client_name(item.client)] = []

    deadline = monotonic() + timeout
    while monotonic() < deadline and (pending or optional):
        progressed = False
        for client in clients:
            remaining = deadline - monotonic()
            try:
                event = _poll_client(client, None, max(0.0, min(poll_timeout, remaining)))
            except Exception as exc:
                client_name = _client_name(client)
                result.errors[client_name] = str(exc)
                _attach_allure("event_group_errors", result.errors)
                raise AssertionError(f"事件接收异常: {client_name}: {exc}") from exc
            if event is None:
                continue
            progressed = True
            for forbid in forbidden:
                if forbid.client is client and event.get("eventType") == forbid.event_type and forbid.predicate(event):
                    result.forbidden[forbid.name] = event
                    _attach_allure("event_group_forbidden", result.forbidden)
                    raise AssertionError(f"命中禁止事件: {forbid.name}")
            matched_name = _match_event(event=event, client=client, pending=pending, result=result)
            if matched_name is None:
                matched_name = _match_event(event=event, client=client, pending=optional, result=result)
            if matched_name is None:
                result.ignored[_client_name(client)].append(event)
        if not progressed:
            if not pending:
                break
            continue

    result.missing = list(pending)
    if result.missing:
        _attach_allure("event_group_matched", result.matched)
        _attach_allure("event_group_missing", result.missing)
        _attach_allure("event_group_ignored", result.ignored)
        raise AssertionError(_missing_message(result))

    started_forbidden_at = monotonic()
    forbidden_deadline = started_forbidden_at + max([item.window for item in forbidden], default=0.0)
    while monotonic() < forbidden_deadline:
        for forbid in forbidden:
            remaining_for_group = forbidden_deadline - monotonic()
            remaining_for_item = started_forbidden_at + forbid.window - monotonic()
            remaining = min(remaining_for_group, remaining_for_item)
            if remaining <= 0:
                continue
            try:
                event = _poll_client(forbid.client, forbid.event_type, max(0.0, min(poll_timeout, remaining)))
            except Exception as exc:
                client_name = _client_name(forbid.client)
                result.errors[client_name] = str(exc)
                _attach_allure("event_group_errors", result.errors)
                raise AssertionError(f"事件接收异常: {client_name}: {exc}") from exc
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
