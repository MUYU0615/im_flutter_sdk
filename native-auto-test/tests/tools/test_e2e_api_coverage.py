import csv
from pathlib import Path

import pytest

from src.tools.e2e_api_coverage import ApiGapRow, classify_gap, write_gap_backlog


pytestmark = pytest.mark.no_global_login


def test_classify_gap_order():
    assert classify_gap(method_key_exists=False, wrapper_exists=False, e2e_case_count=0, e2e_fail_count=0) == "method_key_missing"
    assert classify_gap(method_key_exists=True, wrapper_exists=False, e2e_case_count=0, e2e_fail_count=0) == "wrapper_missing"
    assert classify_gap(method_key_exists=True, wrapper_exists=True, e2e_case_count=0, e2e_fail_count=0) == "missing_case"
    assert classify_gap(method_key_exists=True, wrapper_exists=True, e2e_case_count=1, e2e_fail_count=1) == "failed_case"
    assert classify_gap(method_key_exists=True, wrapper_exists=True, e2e_case_count=1, e2e_fail_count=0) == "covered"


def test_write_gap_backlog_csv(tmp_path: Path):
    path = tmp_path / "gap.csv"
    row = ApiGapRow(
        run_id="r1",
        api="ChatManager.sendMessage",
        manager="ChatManager",
        method_key="sendMessage",
        platform="android",
        platform_role="baseline",
        sdk_version="4.23.0",
        gap_type="missing_case",
        target_action="add_real_e2e_case",
        source_platform="android",
        source_evidence="case-results",
        case_id="",
        pytest_report="",
        reason="未发现真实 E2E 用例",
        priority="P1",
    )
    write_gap_backlog([row], path)
    rows = list(csv.DictReader(path.open()))
    assert rows[0]["gap_type"] == "missing_case"
