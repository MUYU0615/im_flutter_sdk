from __future__ import annotations

import pytest

from src.tools.android_complete_suite_audit import classify_case, is_sdk_e2e_candidate


pytestmark = pytest.mark.no_global_login


def test_is_sdk_e2e_candidate_detects_device_call_case():
    source = """
def test_chat_send(device_a, assert_api):
    resp = device_a.call("ChatManager", "sendMessage", info={})
    assert_api.assert_response_matches(resp, expected={})
"""

    assert is_sdk_e2e_candidate(source)


def test_is_sdk_e2e_candidate_rejects_helper_only_case():
    source = """
def test_helper():
    assert split_api("ChatManager.sendMessage") == ("ChatManager", "sendMessage")
"""

    assert not is_sdk_e2e_candidate(source)


def test_classify_case_marks_included_real_e2e():
    row = classify_case(
        nodeid="tests/chat/test_chat.py::test_send",
        path="tests/chat/test_chat.py",
        markers={"real_e2e", "topology_ready", "chat"},
        fixtures={"device_a", "assert_api"},
        source='device_a.call("ChatManager", "sendMessage", info={})',
    )

    assert row.status == "included_topology_ready"
    assert row.should_include_android_complete is True
    assert row.reason_zh == "已标记 real_e2e 和 topology_ready，可纳入正式 topology E2E。"


def test_classify_case_marks_legacy_real_e2e_pending_topology():
    row = classify_case(
        nodeid="tests/chat/test_chat.py::test_send",
        path="tests/chat/test_chat.py",
        markers={"real_e2e", "chat"},
        fixtures={"device_a", "assert_api"},
        source='device_a.call("ChatManager", "sendMessage", info={})',
    )

    assert row.status == "legacy_real_e2e_pending_topology"
    assert row.should_include_android_complete is True
    assert "topology_ready" in row.reason_zh


def test_classify_case_treats_target_pair_devices_as_real_e2e_devices():
    row = classify_case(
        nodeid="tests/contact/test_contact_remaining_api_coverage.py::test_save_black_list",
        path="tests/contact/test_contact_remaining_api_coverage.py",
        markers={"real_e2e", "contact"},
        fixtures={"primary_device", "secondary_device", "assert_api"},
        source='primary_device.call("ContactManager", "saveBlackList", info={})',
    )

    assert row.status == "legacy_real_e2e_pending_topology"
    assert row.should_include_android_complete is True


def test_classify_case_treats_request_getfixturevalue_devices_as_real_e2e():
    row = classify_case(
        nodeid="tests/chat/test_chat.py::test_dynamic_device",
        path="tests/chat/test_chat.py",
        markers={"real_e2e", "chat"},
        fixtures={"request", "assert_api"},
        source='''
def test_dynamic_device(request, assert_api):
    device_a = request.getfixturevalue("device_a")
    resp = device_a.call("ChatManager", "addReaction", info={})
    assert_api.assert_response_matches(resp, expected={})
''',
    )

    assert row.status == "legacy_real_e2e_pending_topology"
    assert row.should_include_android_complete is True


def test_classify_case_finds_missing_real_e2e_marker():
    row = classify_case(
        nodeid="tests/group/test_group.py::test_create",
        path="tests/group/test_group.py",
        markers={"group"},
        fixtures={"device_a", "assert_api"},
        source='resp = device_a.call("GroupManager", "createGroup", info={})',
    )

    assert row.status == "missing_real_e2e_marker"
    assert row.should_include_android_complete is True
    assert row.reason_zh == "疑似真实 SDK E2E，但缺少 real_e2e marker。"


def test_classify_case_marks_non_e2e_helper():
    row = classify_case(
        nodeid="tests/tools/test_report.py::test_report",
        path="tests/tools/test_report.py",
        markers={"unit"},
        fixtures=set(),
        source="assert render_report([])",
    )

    assert row.status == "not_real_e2e"
    assert row.should_include_android_complete is False


def test_classify_case_no_global_login_excludes_real_e2e_from_formal_suite():
    row = classify_case(
        nodeid="tests/client/test_client.py::test_client_change_app_id",
        path="tests/client/test_client.py",
        markers={"real_e2e", "no_global_login", "client"},
        fixtures={"device_a", "assert_api"},
        source='device_a.call("Client", "changeAppId", info={})',
    )

    assert row.status == "not_real_e2e"
    assert row.should_include_android_complete is False


def test_classify_case_skip_excludes_real_e2e_from_formal_suite():
    row = classify_case(
        nodeid="tests/group/test_group.py::test_legacy_reproduction",
        path="tests/group/test_group.py",
        markers={"real_e2e", "skip", "group"},
        fixtures={"device_a", "assert_api"},
        source='device_a.call("GroupManager", "getGroupWithId", info={})',
    )

    assert row.status == "not_real_e2e"
    assert row.should_include_android_complete is False
