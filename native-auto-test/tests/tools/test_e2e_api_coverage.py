import csv
import json
from pathlib import Path

import pytest

from src.tools.e2e_api_coverage import (
    ApiGapRow,
    build_rows_from_case_results,
    classify_gap,
    write_gap_backlog,
)


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


def test_build_rows_from_case_results_groups_api_outcomes(tmp_path: Path):
    case_results = tmp_path / "case-results.json"
    case_results.write_text(
        json.dumps(
            [
                {
                    "run_id": "run-1",
                    "nodeid": "tests/chat/test_chat_crud.py::test_chat_send_and_received",
                    "case_id": "chat.send_message.text.success",
                    "api": "ChatManager.sendMessage",
                    "manager": "ChatManager",
                    "method_key": "sendMessage",
                    "outcome": "passed",
                    "duration": 1.2,
                    "failure_summary": "",
                },
                {
                    "run_id": "run-1",
                    "nodeid": "tests/contact/test_contact.py::test_contact_case",
                    "case_id": "contact.save_black_list.server.success",
                    "api": "ContactManager.saveBlackList",
                    "manager": "ContactManager",
                    "method_key": "saveBlackList",
                    "outcome": "failed",
                    "duration": 0.2,
                    "failure_summary": "bad response",
                },
                {
                    "run_id": "run-1",
                    "nodeid": "tests/client/test_client_single_device_smoke.py::test_single_device_login_and_get_current_user",
                    "case_id": "",
                    "api": "",
                    "manager": "",
                    "method_key": "",
                    "outcome": "passed",
                    "duration": 0.1,
                    "failure_summary": "",
                },
                {
                    "run_id": "run-1",
                    "nodeid": "tests/user_info/test_user_info.py::test_user_info_subscribe_fetch_and_unsubscribe_users_info",
                    "case_id": "user_info.subscribe_fetch_unsubscribe.success",
                    "api": "UserInfoManager.subscribeUsersInfo",
                    "manager": "UserInfoManager",
                    "method_key": "subscribeUsersInfo",
                    "outcome": "skipped",
                    "duration": 0.1,
                    "failure_summary": "当前 appkey 未开通用户资料订阅服务",
                },
            ]
        ),
        encoding="utf-8",
    )

    rows = build_rows_from_case_results(
        run_id="run-1",
        case_results_path=case_results,
        pytest_report="out/log/android/run-1-android-pytest.html",
        platform="android",
        sdk_version="4.23.0",
    )

    by_key = {(row.manager, row.method_key, row.gap_type): row for row in rows}
    assert by_key[("ChatManager", "sendMessage", "covered")].reason == "真实 E2E 用例已通过"
    failed = by_key[("ContactManager", "saveBlackList", "failed_case")]
    assert failed.target_action == "fix_real_e2e_case"
    assert failed.reason == "真实 E2E 用例失败：bad response"
    blocked = by_key[("UserInfoManager", "subscribeUsersInfo", "blocked")]
    assert blocked.target_action == "resolve_environment_or_service"
    assert blocked.reason == "真实 E2E 用例被跳过：当前 appkey 未开通用户资料订阅服务"
    unmapped = by_key[("", "", "case_api_unmapped")]
    assert unmapped.target_action == "add_api_marker"
    assert "test_single_device_login_and_get_current_user" in unmapped.source_evidence
