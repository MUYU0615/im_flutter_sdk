import pytest

from src.tools.e2e_cli import (
    ClientRequest,
    parse_client_arg,
    parse_sdk_version_arg,
    resolve_client_versions,
)


pytestmark = pytest.mark.no_global_login


def test_parse_client_arg_with_client_version():
    assert parse_client_arg("android:a@4.23.0") == ClientRequest(
        platform="android",
        slot="a",
        sdk_version="4.23.0",
    )


def test_parse_client_arg_without_client_version():
    assert parse_client_arg("ios:b") == ClientRequest(
        platform="ios",
        slot="b",
        sdk_version=None,
    )


def test_parse_sdk_version_arg():
    assert parse_sdk_version_arg("android=4.23.0") == ("android", "4.23.0")


def test_resolve_client_versions_from_platform_version():
    clients = [parse_client_arg("android:a"), parse_client_arg("android:b")]
    resolved = resolve_client_versions(clients, {"android": "4.23.0"})
    assert [client.sdk_version for client in resolved] == ["4.23.0", "4.23.0"]


def test_resolve_client_versions_rejects_missing_version():
    with pytest.raises(ValueError, match="android:a 缺少 SDK 版本"):
        resolve_client_versions([parse_client_arg("android:a")], {})


def test_resolve_client_versions_rejects_conflict():
    with pytest.raises(ValueError, match="版本冲突"):
        resolve_client_versions([parse_client_arg("android:a@4.23.0")], {"android": "4.24.0"})


def test_resolve_client_versions_rejects_duplicate_slot():
    with pytest.raises(ValueError, match="slot 重复"):
        resolve_client_versions(
            [parse_client_arg("android:a@4.23.0"), parse_client_arg("ios:a@1.0.0")],
            {},
        )
