from __future__ import annotations

import json
import time
from collections.abc import Callable
from typing import Any


def _event_messages(event: object) -> list[dict[str, Any]]:
    if not isinstance(event, dict):
        return []
    data = event.get("data")
    if not isinstance(data, dict):
        return []
    msg = data.get("msg") or data.get("message")
    if isinstance(msg, dict):
        return [msg]
    messages = data.get("messages") or data.get("value")
    if isinstance(messages, list):
        return [m for m in messages if isinstance(m, dict)]
    return []


def _message_body(message: dict[str, Any]) -> dict[str, Any]:
    body = message.get("body")
    return body if isinstance(body, dict) else {}


def summarize_event(event: object) -> dict[str, Any]:
    message = _event_messages(event)[0] if _event_messages(event) else {}
    body = _message_body(message)
    data = event.get("data") if isinstance(event, dict) and isinstance(event.get("data"), dict) else {}
    return {
        "eventType": event.get("eventType") if isinstance(event, dict) else None,
        "from": message.get("from"),
        "to": message.get("to"),
        "convId": message.get("convId"),
        "chatType": message.get("chatType"),
        "msgId": message.get("msgId"),
        "status": message.get("status"),
        "body.type": body.get("type"),
        "body.content": body.get("content"),
        "operation": data.get("operation") if isinstance(data, dict) else None,
    }


def _attach_ignored_events(description: str, ignored: list[dict[str, Any]]) -> None:
    if not ignored:
        return
    try:
        import allure

        allure.attach(
            json.dumps(ignored, ensure_ascii=False, indent=2),
            name=f"ignored-events-{description or 'event-wait'}",
            attachment_type=allure.attachment_type.JSON,
        )
    except Exception:
        return


def wait_event_matching(
    device: Any,
    *,
    event_type: str,
    predicate: Callable[[dict[str, Any]], bool],
    timeout: float = 20.0,
    poll_timeout: float = 1.0,
    max_events: int = 50,
    description: str = "",
    ignored_limit: int = 20,
) -> dict[str, Any]:
    deadline = time.monotonic() + timeout
    ignored: list[dict[str, Any]] = []
    seen = 0

    while time.monotonic() < deadline and seen < max_events:
        remaining = deadline - time.monotonic()
        event = device.receive_message(
            match_event_type=event_type,
            timeout=max(0.0, min(poll_timeout, remaining)),
        )
        if event is None:
            continue
        seen += 1
        if predicate(event):
            return event
        if len(ignored) < ignored_limit:
            ignored.append(summarize_event(event))

    _attach_ignored_events(description, ignored)
    summary = json.dumps(ignored, ensure_ascii=False)
    raise AssertionError(
        "未收到目标事件: "
        f"eventType={event_type}, description={description}, timeout={timeout}, "
        f"max_events={max_events}, seen_events={seen}, ignored_events={seen if seen <= ignored_limit else f'{seen}+'}, "
        f"recent_ignored={summary}"
    )
