from pathlib import Path

import pytest
import yaml

from src.tools.e2e_run import build_marker_expression, build_pytest_args, platforms_from_context


pytestmark = pytest.mark.no_global_login


def test_build_pytest_args_adds_reports_and_context(tmp_path: Path):
    context_path = tmp_path / "run" / "r1" / "context.yaml"
    log_dir = tmp_path / "log" / "android"
    args = build_pytest_args(
        run_context=context_path,
        run_id="r1",
        platforms=["android"],
        log_dir=log_dir,
        extra_args=[],
    )
    assert args[:2] == ["tests", "-s"]
    assert ["-m", "real_e2e and not web"] == args[2:4]
    assert "--html" in args
    assert str(log_dir / "r1-pytest.html") in args
    assert "--alluredir" in args
    assert str(log_dir / "r1-allure-results") in args
    assert "--run-context" in args


def test_build_marker_expression_uses_topology_platforms():
    assert build_marker_expression(["android"]) == "real_e2e and not web"
    assert build_marker_expression(["ios"]) == "real_e2e and not web"
    assert build_marker_expression(["android", "ios"]) == "real_e2e and not web"
    assert build_marker_expression(["web"]) == "real_e2e and web"
    assert build_marker_expression(["android", "web"]) == "real_e2e"


def test_platforms_from_context_reads_topology_platforms(tmp_path: Path):
    context_path = tmp_path / "context.yaml"
    context_path.write_text(
        yaml.safe_dump({"topology": {"platforms_under_test": ["android"]}}),
        encoding="utf-8",
    )
    context = yaml.safe_load(context_path.read_text())
    assert platforms_from_context(context) == ["android"]
