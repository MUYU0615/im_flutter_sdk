import pytest

from src.tools.capabilities import api_status


def test_pending_web_api_can_be_skipped():
    if api_status("web", "ChatManager", "getMessage") == "pending":
        pytest.skip("ChatManager.getMessage is pending on web")
