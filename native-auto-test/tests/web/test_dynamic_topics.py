"""Tests for dynamic Web topic generation."""

from __future__ import annotations

from src.tools import config


def test_dynamic_topic_uses_run_id(monkeypatch):
    monkeypatch.setenv("NATIVE_AUTO_TEST_RUN_ID", "run-123")
    monkeypatch.setenv("NATIVE_AUTO_TEST_TOPIC_PREFIX", "im-web")
    monkeypatch.setattr(
        config,
        "load_config",
        lambda: {
            "websocket": {"default_topic": "adc"},
        },
    )

    assert config.get_topic("webA") == "im-web-run-123-webA"
    assert config.get_topic("webB") == "im-web-run-123-webB"


def test_dynamic_topic_keeps_default_topic_for_no_device(monkeypatch):
    monkeypatch.setenv("NATIVE_AUTO_TEST_RUN_ID", "run-123")
    monkeypatch.setattr(
        config,
        "load_config",
        lambda: {
            "websocket": {"default_topic": "adc"},
        },
    )

    assert config.get_topic(None) == "adc"


def test_local_run_id_is_used_when_run_id_is_absent(monkeypatch):
    monkeypatch.delenv("NATIVE_AUTO_TEST_RUN_ID", raising=False)
    monkeypatch.delenv("NATIVE_AUTO_TEST_TOPIC_PREFIX", raising=False)
    monkeypatch.setattr(
        config,
        "load_config",
        lambda: {
            "websocket": {"default_topic": "adc"},
        },
    )

    assert config.get_topic("webA") == "im-auto-local-webA"
    assert config.get_topic("unknown") == "im-auto-local-unknown"
