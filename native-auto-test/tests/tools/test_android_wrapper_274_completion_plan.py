from collections import Counter

import pytest

from src.tools.android_423_api_coverage_report import build_rows
from src.tools.android_wrapper_274_completion_plan import build_completion_plan_rows


pytestmark = pytest.mark.no_global_login


def test_android_wrapper_274_completion_plan_has_no_p0_after_review_classification():
    rows = build_completion_plan_rows(build_rows())

    assert len(rows) == 274
    counts = Counter(row["priority"] for row in rows)
    gaps = Counter(row["gap_type"] for row in rows)

    assert counts["P0"] == 0
    assert counts["P1"] == 262
    assert counts["P2"] == 12
    assert gaps["blocked_by_service_environment"] == 2
    assert gaps["requires_session_lifecycle_isolation"] == 9
    assert gaps["test_bridge_control"] == 1


def test_android_wrapper_274_completion_plan_keeps_blocked_and_isolated_reasons():
    rows = build_completion_plan_rows(build_rows())
    by_key = {(row["manager"], row["api"]): row for row in rows}

    voice = by_key[("ChatManager", "voiceFileToText")]
    assert voice["priority"] == "P2"
    assert voice["gap_type"] == "blocked_by_service_environment"
    assert "语音转写服务能力" in voice["recommended_action_zh"]

    room = by_key[("ChatRoomManager", "createChatRoom")]
    assert room["priority"] == "P2"
    assert room["gap_type"] == "blocked_by_service_environment"
    assert "703" in room["recommended_action_zh"]

    logout = by_key[("Client", "logout")]
    assert logout["priority"] == "P2"
    assert logout["gap_type"] == "requires_session_lifecycle_isolation"
    assert "普通 E2E 共享 session" in logout["recommended_action_zh"]
