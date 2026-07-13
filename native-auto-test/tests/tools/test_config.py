import pytest

from src.tools import config


pytestmark = pytest.mark.no_global_login


def test_get_configured_test_users_accepts_string_user_slots(monkeypatch):
    monkeypatch.setattr(
        config,
        "load_config",
        lambda: {"accounts": {"users": {"a": "du001", "b": "du002", "c": "du003"}}},
    )

    assert config.get_configured_test_users() == ("du001", "du002", "du003")


def test_get_configured_test_users_accepts_dict_user_slots(monkeypatch):
    monkeypatch.setattr(
        config,
        "load_config",
        lambda: {
            "accounts": {
                "users": {
                    "a": {"username": "du001", "password": "1"},
                    "b": {"username": "du002", "password": "1"},
                }
            }
        },
    )

    assert config.get_configured_test_users() == ("du001", "du002", "du002")
