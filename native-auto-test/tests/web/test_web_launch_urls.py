"""Tests for generated Flutter Web launch URLs."""

from __future__ import annotations

from src.tools.web_launch_urls import _build_url


def test_build_url_adds_bridge_topic_device_and_autoconnect():
    url = _build_url(
        "http://localhost:8080",
        bridge_url="ws://127.0.0.1:2000/iov/websocket/dual",
        topic="im-web-run-webA",
        device="webA",
    )

    assert url == (
        "http://localhost:8080?bridgeUrl=ws%3A%2F%2F127.0.0.1%3A2000"
        "%2Fiov%2Fwebsocket%2Fdual&topic=im-web-run-webA&device=webA"
        "&autoconnect=1"
    )


def test_build_url_can_override_web_sdk_mode():
    url = _build_url(
        "http://localhost:8080",
        bridge_url="ws://127.0.0.1:2000/iov/websocket/dual",
        topic="im-web-run-webA",
        device="webA",
        web_sdk_mode="real_sdk",
    )

    assert url.endswith("&autoconnect=1&webSdkMode=real_sdk")
