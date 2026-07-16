from __future__ import annotations

import time
from typing import Any

from src import Cmd
from src.tools.event_waiter import wait_event_matching
from tests.chat._utils import build_text


def message_body(message: object) -> dict:
    if not isinstance(message, dict):
        return {}
    body = message.get("body")
    return body if isinstance(body, dict) else {}


def extract_event_message(event: object) -> dict:
    if not isinstance(event, dict):
        return {}
    data = event.get("data")
    if not isinstance(data, dict):
        return {}
    msg = data.get("msg") or data.get("message")
    return msg if isinstance(msg, dict) else {}


def extract_success_message(
    event: object,
    *,
    from_user: str,
    to_user: str,
    content: str,
    chat_type: int = 0,
    min_status: int | None = 2,
) -> dict:
    msg = extract_event_message(event)
    body = message_body(msg)
    status = msg.get("status")
    if min_status is not None and (not isinstance(status, int) or status < min_status):
        return {}
    if (
        msg.get("from") == from_user
        and msg.get("to") == to_user
        and msg.get("convId") == to_user
        and msg.get("chatType") == chat_type
        and body.get("type") == 0
        and body.get("content") == content
        and msg.get("msgId")
    ):
        return msg
    return {}


def matches_received_text(message: object, *, from_user: str, to_user: str, content: str, chat_type: int = 0) -> bool:
    if not isinstance(message, dict):
        return False
    body = message_body(message)
    expected_conv_id = from_user if chat_type == 0 else to_user
    return (
        message.get("from") == from_user
        and message.get("to") == to_user
        and message.get("convId") == expected_conv_id
        and message.get("chatType") == chat_type
        and body.get("type") == 0
        and body.get("content") == content
    )


def received_messages(event: object) -> list[dict]:
    if not isinstance(event, dict):
        return []
    data = event.get("data")
    if not isinstance(data, dict):
        return []
    messages = data.get("messages") or data.get("value") or []
    return [msg for msg in messages if isinstance(msg, dict)] if isinstance(messages, list) else []


def wait_for_matching_event_message(
    device,
    *,
    event_type: str,
    from_user: str,
    to_user: str,
    content: str,
    attempts: int = 5,
    timeout: float = 20.0,
    chat_type: int = 0,
) -> dict:
    matched: dict = {}

    def predicate(event: dict) -> bool:
        nonlocal matched
        for msg in received_messages(event):
            if matches_received_text(msg, from_user=from_user, to_user=to_user, content=content, chat_type=chat_type):
                matched = msg
                return msg
        return False

    wait_event_matching(
        device,
        event_type=event_type,
        predicate=predicate,
        timeout=max(timeout, 0.0) * max(attempts, 1),
        poll_timeout=timeout,
        max_events=attempts,
        description=f"received message content={content}",
    )
    return matched


def wait_for_success_message(
    device,
    *,
    from_user: str,
    to_user: str,
    content: str,
    attempts: int = 5,
    timeout: float = 20.0,
    chat_type: int = 0,
    min_status: int | None = 2,
) -> dict:
    matched: dict = {}

    def predicate(event: dict) -> bool:
        nonlocal matched
        matched = extract_success_message(
            event,
            from_user=from_user,
            to_user=to_user,
            content=content,
            chat_type=chat_type,
            min_status=min_status,
        )
        return bool(matched)

    wait_event_matching(
        device,
        event_type=Cmd.onMessageSuccess.value,
        predicate=predicate,
        timeout=max(timeout, 0.0) * max(attempts, 1),
        poll_timeout=timeout,
        max_events=attempts,
        description=f"message success content={content}",
    )
    return matched


def send_text_and_wait(
    device_a,
    device_b,
    *,
    user_a: str,
    user_b: str,
    content: str,
    chat_type: int = 0,
    receive_attempts: int = 5,
) -> tuple[dict, dict, dict]:
    try:
        device_a.drain_events()
        device_b.drain_events()
    except Exception:
        pass

    resp = device_a.call("ChatManager", Cmd.sendMessage.value, info=build_text(user_a, user_b, content, chat_type=chat_type))
    success_msg = wait_for_success_message(
        device_a,
        from_user=user_a,
        to_user=user_b,
        content=content,
        chat_type=chat_type,
    )
    received_msg = wait_for_matching_event_message(
        device_b,
        event_type=Cmd.onMessagesReceived.value,
        from_user=user_a,
        to_user=user_b,
        content=content,
        chat_type=chat_type,
        attempts=receive_attempts,
    )
    return resp, success_msg, received_msg


def find_message_by_id_or_content(messages: object, *, msg_id: str | None, content: str | None = None) -> dict:
    if not isinstance(messages, list):
        return {}
    for msg in messages:
        if not isinstance(msg, dict):
            continue
        body = message_body(msg)
        if msg_id and msg.get("msgId") == msg_id:
            return msg
        if content is not None and body.get("content") == content:
            return msg
    return {}


def poll_until_message(
    call,
    *,
    msg_id: str | None = None,
    content: str | None = None,
    timeout: float = 10.0,
    interval: float = 0.5,
) -> tuple[dict, dict]:
    deadline = time.monotonic() + timeout
    last_resp = {}
    while time.monotonic() < deadline:
        last_resp = call()
        result = last_resp.get("result") if isinstance(last_resp, dict) else None
        messages = result if isinstance(result, list) else (result or {}).get("list") if isinstance(result, dict) else []
        msg = find_message_by_id_or_content(messages, msg_id=msg_id, content=content)
        if msg:
            return last_resp, msg
        time.sleep(interval)
    raise AssertionError(f"未查询到目标消息: msgId={msg_id}, content={content}, last={last_resp}")
