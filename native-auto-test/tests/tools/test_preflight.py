import pytest

from src.tools.preflight import skip_reason_for_flow


pytestmark = pytest.mark.no_global_login


def test_skip_reason_for_missing_remote_is_chinese():
    reason = skip_reason_for_flow(
        flow="peer_interaction",
        counts={"primary": 1, "remote": 0},
        capabilities={"server_api": False},
        requires_server_api=False,
    )

    assert reason == "当前 topology 不满足 peer_interaction：要求 remote 账号至少 1 个客户端，实际 0 个。"


def test_primary_send_sync_supported_by_dual_primary_and_remote():
    assert skip_reason_for_flow(
        flow="primary_send_sync",
        counts={"primary": 2, "remote": 1},
        capabilities={"server_api": False},
        requires_server_api=False,
    ) is None


def test_unknown_flow_is_rejected():
    with pytest.raises(ValueError, match="未知 e2e_flow"):
        skip_reason_for_flow(
            flow="unknown",
            counts={"primary": 1, "remote": 1},
            capabilities={},
            requires_server_api=False,
        )
