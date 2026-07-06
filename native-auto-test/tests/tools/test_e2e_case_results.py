from pathlib import Path

import json
import pytest

from src.tools.e2e_case_results import CaseResult, marker_value, split_api, write_case_results


pytestmark = pytest.mark.no_global_login


class FakeMarker:
    def __init__(self, *args):
        self.args = args


class FakeItem:
    def __init__(self, markers):
        self._markers = markers

    def get_closest_marker(self, name):
        return self._markers.get(name)


def test_marker_value_reads_first_arg():
    item = FakeItem({"api": FakeMarker("ChatManager.sendMessage")})
    assert marker_value(item, "api") == "ChatManager.sendMessage"


def test_split_api():
    assert split_api("ChatManager.sendMessage") == ("ChatManager", "sendMessage")


def test_write_case_results_json_and_csv(tmp_path: Path):
    result = CaseResult(
        run_id="r1",
        nodeid="tests/chat/test_chat.py::test_send",
        case_id="chat.send_text",
        api="ChatManager.sendMessage",
        manager="ChatManager",
        method_key="sendMessage",
        outcome="passed",
        duration=0.12,
        failure_summary="",
    )
    json_path = tmp_path / "case-results.json"
    csv_path = tmp_path / "case-results.csv"
    write_case_results([result], json_path, csv_path)
    assert json.loads(json_path.read_text())[0]["api"] == "ChatManager.sendMessage"
    assert "chat.send_text" in csv_path.read_text()
