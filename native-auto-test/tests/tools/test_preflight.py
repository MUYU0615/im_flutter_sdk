from pathlib import Path

import pytest

from src.tools.preflight import skip_reason_for_flow, topology_counts
from tests.conftest import pytest_collection_modifyitems


pytestmark = pytest.mark.no_global_login


def test_topology_counts_reads_account_client_lengths():
    assert topology_counts(
        {
            "accounts": {
                "primary": {"clients": ["primary_a", "primary_b"]},
                "remote": {"clients": ["remote_c"]},
                "observer": {},
            }
        }
    ) == {"primary": 2, "remote": 1, "observer": 0}


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


def test_account_state_sync_requires_remote_for_current_chat_mark_case():
    reason = skip_reason_for_flow(
        flow="account_state_sync",
        counts={"primary": 2, "remote": 0},
        capabilities={"server_api": False},
        requires_server_api=False,
    )

    assert reason == "当前 topology 不满足 account_state_sync：要求 remote 账号至少 1 个客户端，实际 0 个。"


def test_unknown_flow_is_rejected():
    with pytest.raises(ValueError, match="未知 e2e_flow"):
        skip_reason_for_flow(
            flow="unknown",
            counts={"primary": 1, "remote": 1},
            capabilities={},
            requires_server_api=False,
        )


class _FakeConfig:
    def __init__(self, run_context: str):
        self._run_context = run_context

    def getoption(self, name: str):
        if name == "--target-platform":
            return "android"
        if name == "--run-context":
            return self._run_context
        raise AssertionError(f"unexpected option: {name}")


class _FakeItem:
    path = Path("tests/chat/test_legacy_real_e2e.py")

    def __init__(self, markers=None):
        self._markers = markers or {}
        self.added_markers = []

    def get_closest_marker(self, name: str):
        return self._markers.get(name)

    def add_marker(self, marker):
        self.added_markers.append(marker)


def test_run_context_skips_real_e2e_case_until_topology_ready(tmp_path):
    context_path = tmp_path / "context.yaml"
    context_path.write_text(
        """
accounts:
  primary:
    clients:
      - primary_a
capabilities:
  server_api: false
""".lstrip(),
        encoding="utf-8",
    )
    item = _FakeItem(markers={"real_e2e": pytest.mark.real_e2e})

    pytest_collection_modifyitems(_FakeConfig(str(context_path)), [item])

    assert item.added_markers
    assert "topology_ready" in str(item.added_markers[0].kwargs["reason"])


def test_run_context_allows_topology_ready_case_without_flow_skip(tmp_path):
    context_path = tmp_path / "context.yaml"
    context_path.write_text(
        """
accounts:
  primary:
    clients:
      - primary_a
capabilities:
  server_api: false
""".lstrip(),
        encoding="utf-8",
    )
    item = _FakeItem(markers={"real_e2e": pytest.mark.real_e2e, "topology_ready": pytest.mark.topology_ready})

    pytest_collection_modifyitems(_FakeConfig(str(context_path)), [item])

    assert item.added_markers == []
