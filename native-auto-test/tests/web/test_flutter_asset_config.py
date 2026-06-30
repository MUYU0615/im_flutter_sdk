"""Checks for the Flutter test app's packaged config asset."""

from __future__ import annotations

from pathlib import Path

import yaml


REPO_ROOT = Path(__file__).resolve().parents[3]
FLUTTER_ASSET_CONFIG = REPO_ROOT / "im_flutter_test/assets/config.yaml"
FLUTTER_CONFIG = REPO_ROOT / "native-auto-test/flutter_config.yaml"


def test_flutter_asset_config_uses_sanitized_config_file():
    assert FLUTTER_ASSET_CONFIG.is_symlink()
    assert FLUTTER_ASSET_CONFIG.resolve() == FLUTTER_CONFIG.resolve()


def test_flutter_asset_config_does_not_package_rest_credentials():
    data = yaml.safe_load(FLUTTER_CONFIG.read_text(encoding="utf-8")) or {}

    assert "rest_api" not in data
    assert "sdk_options" in data
    assert "web" in data


def test_flutter_asset_config_defaults_to_real_sdk():
    data = yaml.safe_load(FLUTTER_CONFIG.read_text(encoding="utf-8")) or {}

    assert data["web"]["sdk_mode"] == "real_sdk"
