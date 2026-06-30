"""Tests for Web-specific pytest wiring."""

from __future__ import annotations


from tests import conftest


def test_make_api_uses_web_a_device(monkeypatch):
    calls = []

    def fake_request(**kwargs):
        calls.append(kwargs)
        return {"manager": kwargs["manager"], "cmd": kwargs["cmd"], "result": True}

    monkeypatch.setattr(
        "tests.conftest.get_topic",
        lambda device=None: "im-auto-local-webA" if device == "webA" else "adc",
    )
    monkeypatch.setattr("tests.conftest.ws_request", fake_request)

    web_api = conftest._make_api("webA")
    resp = web_api.call("Client", "isConnected", info={})

    assert resp["result"] is True
    assert calls == [
        {
            "manager": "Client",
            "cmd": "isConnected",
            "info": {},
            "topic": "im-auto-local-webA",
            "device": "webA",
        }
    ]


def test_web_state_reset_clears_both_web_devices():
    calls = []

    class _Device:
        def __init__(self, name):
            self.name = name

        def call(self, manager, cmd, info=None):
            calls.append((self.name, manager, cmd, info or {}))
            return {"result": True}

        def drain_events(self, timeout=0.5):
            calls.append((self.name, "drain", timeout, {}))

    primary = _Device("webA")
    secondary = _Device("webB")

    conftest._reset_web_devices(primary, secondary)

    assert calls == [
        ("webA", "Client", "webReset", {}),
        ("webA", "drain", 0.5, {}),
        ("webB", "Client", "webReset", {}),
        ("webB", "drain", 0.5, {}),
    ]
