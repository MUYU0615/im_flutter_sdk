"""Checks that SDK config is not packaged into the Flutter test app."""

from __future__ import annotations

from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parents[3]
PUBSPEC = REPO_ROOT / "im_flutter_test/pubspec.yaml"
SDK_CONFIG_LOADER = REPO_ROOT / "im_flutter_test/lib/sdk_config_loader.dart"
LEGACY_FLUTTER_CONFIG = REPO_ROOT / "native-auto-test/flutter_config.yaml"

pytestmark = pytest.mark.no_global_login


def test_flutter_test_app_does_not_package_sdk_config_asset():
    pubspec = PUBSPEC.read_text(encoding="utf-8")
    lines = {line.strip() for line in pubspec.splitlines()}

    assert "assets/config.yaml" not in pubspec
    assert "- assets/" not in lines
    assert "- assets/media/" in lines


def test_flutter_test_app_does_not_read_yaml_sdk_config():
    pubspec = PUBSPEC.read_text(encoding="utf-8")

    assert "yaml:" not in pubspec
    assert not SDK_CONFIG_LOADER.exists()


def test_native_auto_test_does_not_keep_legacy_flutter_config():
    assert not LEGACY_FLUTTER_CONFIG.exists()
