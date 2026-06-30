"""Web ChatManager text message regression cases."""

from __future__ import annotations

import uuid

import pytest

from src import Cmd
from tests.chat._utils import build_text


pytestmark = [pytest.mark.web, pytest.mark.chat]


def test_web_send_text_message(primary_device, assert_api, user_a, user_b, require_capability):
    require_capability("ChatManager", Cmd.sendMessage.value)

    content = f"web-text-{uuid.uuid4().hex[:8]}"
    resp = primary_device.call(
        "ChatManager",
        Cmd.sendMessage.value,
        info=build_text(user_a, user_b, content),
    )

    result = assert_api.get_result(resp)
    assert result["from"] == user_a
    assert result["to"] == user_b
    assert result["convId"] == user_b
    assert result["chatType"] == 0
    assert result["direction"] == 0
    assert result["status"] in (0, 2)
    assert result["body"] == {"type": 0, "content": content}
    assert isinstance(result.get("msgId"), str) and result["msgId"]
