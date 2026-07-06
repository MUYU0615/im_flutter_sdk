from pathlib import Path

import pytest

from src.tools.e2e_run import build_marker_expression, build_pytest_args


pytestmark = pytest.mark.no_global_login


def test_build_pytest_args_adds_reports_and_context(tmp_path: Path):
    context_path = tmp_path / "run" / "r1" / "context.yaml"
    args = build_pytest_args(
        run_context=context_path,
        run_id="r1",
        platform_matrix="android-android",
        extra_args=[],
    )
    assert args[:2] == ["tests", "-s"]
    assert ["-m", "real_e2e and not web"] == args[2:4]
    assert "--html" in args
    assert "--alluredir" in args
    assert "--run-context" in args


def test_build_marker_expression_uses_platform_matrix():
    assert build_marker_expression("android-android") == "real_e2e and not web"
    assert build_marker_expression("ios-ios") == "real_e2e and not web"
    assert build_marker_expression("android-ios") == "real_e2e and not web"
    assert build_marker_expression("web-web") == "real_e2e and web"
    assert build_marker_expression("android-web") == "real_e2e"
