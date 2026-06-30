"""Tests for REST authentication config handling."""

from __future__ import annotations

import json

from src.tools import config


class _Response:
    def __init__(self, body: dict):
        self._body = json.dumps(body).encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def read(self):
        return self._body


def _reset_token_cache(monkeypatch):
    monkeypatch.setattr(config, "_REST_AUTH_TOKEN_CACHE", None)


def test_rest_auth_token_takes_precedence(monkeypatch):
    _reset_token_cache(monkeypatch)
    calls = []
    monkeypatch.setattr(
        config,
        "load_config",
        lambda: {
            "rest_api": {
                "base_url": "https://a1.example/org/app",
                "auth_token": "Bearer configured-token",
                "client_id": "id",
                "client_secret": "secret",
            }
        },
    )
    monkeypatch.setattr(config.urllib.request, "urlopen", lambda *a, **k: calls.append((a, k)))

    assert config.get_rest_authorization_header() == "Bearer configured-token"
    assert calls == []


def test_rest_auth_fetches_token_with_client_credentials(monkeypatch):
    _reset_token_cache(monkeypatch)
    captured = {}

    def fake_urlopen(req, timeout=30, context=None):
        captured["url"] = req.full_url
        captured["headers"] = dict(req.header_items())
        captured["body"] = json.loads(req.data.decode("utf-8"))
        return _Response({"access_token": "fetched-token"})

    monkeypatch.setattr(
        config,
        "load_config",
        lambda: {
            "rest_api": {
                "base_url": "https://a1.example/org/app",
                "auth_token": "",
                "client_id": "id",
                "client_secret": "secret",
                "verify_ssl": True,
            }
        },
    )
    monkeypatch.setattr(config.urllib.request, "urlopen", fake_urlopen)

    assert config.get_rest_authorization_header() == "Bearer fetched-token"
    assert config.get_rest_authorization_header() == "Bearer fetched-token"
    assert captured == {
        "url": "https://a1.example/org/app/token",
        "headers": {
            "Accept": "application/json",
            "Content-type": "application/json",
        },
        "body": {
            "grant_type": "client_credentials",
            "client_id": "id",
            "client_secret": "secret",
        },
    }


def test_rest_base_url_pins_app_key(monkeypatch):
    monkeypatch.setattr(
        config,
        "load_config",
        lambda: {
            "rest_api": {
                "base_url": "https://a1.example",
                "app_key": "org#app",
            }
        },
    )

    assert config.get_rest_base_url() == "https://a1.example/org/app"


def test_rest_base_url_reuses_sdk_app_key(monkeypatch):
    monkeypatch.setattr(
        config,
        "load_config",
        lambda: {
            "rest_api": {
                "base_url": "https://a1.example",
            },
            "sdk_options": {
                "app_key": "sdk-org#sdk-app",
            },
        },
    )

    assert config.get_rest_base_url() == "https://a1.example/sdk-org/sdk-app"


def test_rest_user_access_token_uses_password_grant(monkeypatch):
    _reset_token_cache(monkeypatch)
    captured = {}

    def fake_urlopen(req, timeout=30, context=None):
        captured["url"] = req.full_url
        captured["headers"] = dict(req.header_items())
        captured["body"] = json.loads(req.data.decode("utf-8"))
        return _Response(
            {
                "access_token": "user-access-token",
                "expires_in": 86400,
                "user": {"username": "u1"},
            }
        )

    monkeypatch.setattr(
        config,
        "load_config",
        lambda: {
            "rest_api": {
                "base_url": "https://a1.example",
                "app_key": "org#app",
                "client_id": "id",
                "client_secret": "secret",
                "verify_ssl": True,
            }
        },
    )
    monkeypatch.setattr(config.urllib.request, "urlopen", fake_urlopen)

    assert config.get_rest_user_access_token("u1", "p1") == "user-access-token"
    assert captured == {
        "url": "https://a1.example/org/app/token",
        "headers": {
            "Accept": "application/json",
            "Content-type": "application/json",
        },
        "body": {
            "grant_type": "password",
            "username": "u1",
            "password": "p1",
            "client_id": "id",
            "client_secret": "secret",
        },
    }


def test_rest_base_url_raises_for_invalid_app_key(monkeypatch):
    monkeypatch.setattr(
        config,
        "load_config",
        lambda: {
            "rest_api": {
                "base_url": "https://a1.example",
                "app_key": "invalid",
            }
        },
    )

    try:
        config.get_rest_base_url()
    except RuntimeError as exc:
        assert "org#app" in str(exc)
    else:
        raise AssertionError("expected RuntimeError")


def test_rest_auth_returns_empty_without_credentials(monkeypatch):
    _reset_token_cache(monkeypatch)
    monkeypatch.setattr(
        config,
        "load_config",
        lambda: {"rest_api": {"base_url": "https://a1.example/org/app"}},
    )

    assert config.get_rest_auth_token() == ""
    assert config.get_rest_authorization_header() == ""


def test_web_sdk_mode_defaults_to_real_sdk(monkeypatch):
    monkeypatch.setattr(config, "load_config", lambda: {})

    assert config.get_web_sdk_mode() == "real_sdk"


def test_web_sdk_mode_accepts_real_sdk(monkeypatch):
    monkeypatch.setattr(config, "load_config", lambda: {"web": {"sdk_mode": "real_sdk"}})

    assert config.get_web_sdk_mode() == "real_sdk"


def test_web_sdk_mode_rejects_invalid_value(monkeypatch):
    monkeypatch.setattr(config, "load_config", lambda: {"web": {"sdk_mode": "invalid"}})

    try:
        config.get_web_sdk_mode()
    except RuntimeError as exc:
        assert "web.sdk_mode" in str(exc)
    else:
        raise AssertionError("expected RuntimeError")
