from __future__ import annotations

from pathlib import Path

import pytest


pytestmark = pytest.mark.no_global_login


ROOT = Path(__file__).resolve().parents[2]
CHAT_DIR = ROOT / "tests" / "chat"

HIGH_RISK_PATTERNS = (
    "receive_message(match_event_type=Cmd.onMessageSuccess.value",
    "receive_message(match_event_type=Cmd.onMessagesReceived.value",
)

ALLOWED = {
    "tests/chat/test_chat.py",
    "tests/chat/test_chat_ack_read_strict.py",
    "tests/chat/test_chat_crud.py",
    "tests/chat/test_chat_manager_remaining_api_coverage.py",
    "tests/chat/test_chat_reaction_fetch.py",
    "tests/chat/test_chat_conversation_sorting.py",
    "tests/chat/test_chat_local_conversation_store.py",
    "tests/chat/test_chat_message_callbacks_and_combine.py",
    "tests/chat/test_chat_message_content_changed.py",
    "tests/chat/test_chat_thread_user_removed.py",
    "tests/chat/test_chat_search_db.py",
    "tests/chat/test_chat_send_with_type.py",
    "tests/chat/test_chat_thread_remaining_api_coverage.py",
    "tests/chat/test_conversation_remaining_api_coverage.py",
}


def test_high_risk_chat_event_waits_are_tracked():
    hits = []
    for path in sorted(CHAT_DIR.glob("test_*.py")):
        rel = path.relative_to(ROOT).as_posix()
        text = path.read_text(encoding="utf-8")
        if any(pattern in text for pattern in HIGH_RISK_PATTERNS):
            hits.append(rel)

    untracked = [rel for rel in hits if rel not in ALLOWED]
    assert not untracked, f"Untracked high-risk naked event waits: {untracked}"
