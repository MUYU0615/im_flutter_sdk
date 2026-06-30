from pathlib import Path

import pytest


pytestmark = pytest.mark.no_global_login


WRAPPER = (
    Path(__file__).resolve().parents[3]
    / "im_flutter_sdk_android/android/src/main/java/com/easemob/im_flutter_sdk/PushManagerWrapper.java"
)
PUSH_TEST = (
    Path(__file__).resolve().parents[1]
    / "push/test_push_remaining_api_coverage.py"
)


def test_push_action_parser_rejects_missing_and_invalid_values():
    text = WRAPPER.read_text(encoding="utf-8")

    assert "private static final int INVALID_PARAM = 110;" in text
    assert "if (!params.has(\"action\")" in text
    assert '"\'action\' can not be null"' in text
    assert '"\'action\' is invalid"' in text
    assert 'parsePushAction(params.get("action"))' in text
    assert "private EMPushAction pushActionFromJson(JSONObject params)" not in text
    assert "return index == 0 ? EMPushAction.ARRIVE : EMPushAction.CLICK;" not in text


def test_push_wrapper_source_uses_lf_line_endings_only():
    data = WRAPPER.read_bytes()

    assert b"\r" not in data


def test_push_report_action_e2e_assertions_are_not_shape_only():
    text = PUSH_TEST.read_text(encoding="utf-8")

    assert "def _assert_push_action_result" in text
    assert "if result in (None, True)" in text
    assert "assert result == {" in text
    assert '"Failed to update push configurations"' in text
    assert "test_push_report_push_action_rejects_invalid_action" in text
    assert "test_push_report_push_action_requires_action" in text
