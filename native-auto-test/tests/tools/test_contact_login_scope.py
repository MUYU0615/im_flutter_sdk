from __future__ import annotations

import ast
from pathlib import Path

import pytest


pytestmark = pytest.mark.no_global_login


def test_android_contact_save_black_list_case_uses_global_login_scope():
    path = Path(__file__).resolve().parents[1] / "contact" / "test_contact_remaining_api_coverage.py"
    tree = ast.parse(path.read_text())
    target = next(
        node
        for node in tree.body
        if isinstance(node, ast.FunctionDef)
        and node.name == "test_contact_save_black_list_then_fetch_from_server"
    )
    decorator_names = {
        ast.unparse(decorator)
        for decorator in target.decorator_list
        if hasattr(ast, "unparse")
    }

    assert "pytest.mark.no_global_login" not in decorator_names


def test_friend_info_auto_sync_restores_session_login_on_failure():
    path = Path(__file__).resolve().parents[1] / "contact" / "test_friend_info_sync.py"
    tree = ast.parse(path.read_text())
    target = next(
        node
        for node in tree.body
        if isinstance(node, ast.FunctionDef)
        and node.name == "test_friend_info_auto_sync_after_login"
    )

    assert any(isinstance(node, ast.Try) and node.finalbody for node in ast.walk(target))
    assert "_restore_login" in ast.unparse(target)


def test_chat_legacy_module_fixture_does_not_shadow_shared_friend_setup():
    path = Path(__file__).resolve().parents[1] / "chat" / "test_chat.py"
    tree = ast.parse(path.read_text())

    shadowing_fixtures = []
    for node in tree.body:
        if not isinstance(node, ast.FunctionDef) or node.name != "ensure_friends":
            continue
        decorator_names = {
            ast.unparse(decorator)
            for decorator in node.decorator_list
            if hasattr(ast, "unparse")
        }
        if any(name.startswith("pytest.fixture") for name in decorator_names):
            shadowing_fixtures.append(node.name)

    assert shadowing_fixtures == []


def test_android_real_e2e_cases_do_not_logout_inside_case():
    tests_root = Path(__file__).resolve().parents[1]
    offenders = []

    for path in tests_root.rglob("test_*.py"):
        relative = path.relative_to(tests_root)
        if relative.parts[0] in {"web", "web_real"}:
            continue

        tree = ast.parse(path.read_text())
        module_marked_real_e2e = any(
            "pytest.mark.real_e2e" in ast.unparse(node)
            for node in tree.body
            if isinstance(node, ast.Assign) and any(getattr(target, "id", "") == "pytestmark" for target in node.targets)
        )

        for node in tree.body:
            if not isinstance(node, ast.FunctionDef) or not node.name.startswith("test_"):
                continue
            source = ast.unparse(node)
            function_marked_real_e2e = any(
                ast.unparse(decorator) == "pytest.mark.real_e2e"
                for decorator in node.decorator_list
            )
            if (module_marked_real_e2e or function_marked_real_e2e) and "Cmd.logout.value" in source:
                offenders.append(f"{relative}::{node.name}")

    assert offenders == []


def test_ack_conversation_read_invalid_conv_id_cases_expect_android_param_error():
    cases = [
        (Path(__file__).resolve().parents[1] / "chat" / "test_chat.py", "test_chat_ack_conversation_read_invalid_id_response"),
        (Path(__file__).resolve().parents[1] / "chat" / "test_chat_crud.py", "test_chat_ack_conversation_read_invalid_id_response"),
        (Path(__file__).resolve().parents[1] / "chat" / "test_chat_non_message_operations.py", "test_chat_ack_conversation_read_invalid_conv_id"),
        (Path(__file__).resolve().parents[1] / "chat" / "test_chat_non_message_operations.py", "test_chat_ack_conversation_read_empty_conv_id"),
    ]

    for path, function_name in cases:
        tree = ast.parse(path.read_text())
        target = next(
            node
            for node in tree.body
            if isinstance(node, ast.FunctionDef) and node.name == function_name
        )
        source = ast.unparse(target)
        assert "code=110" in source or '"code": 110' in source or "'code': 110" in source
        assert "Message is invalid" not in source


def test_chat_add_reaction_invalid_id_response_has_chinese_steps():
    cases = [
        Path(__file__).resolve().parents[1] / "chat" / "test_chat.py",
        Path(__file__).resolve().parents[1] / "chat" / "test_chat_crud.py",
    ]

    for path in cases:
        tree = ast.parse(path.read_text())
        target = next(
            node
            for node in tree.body
            if isinstance(node, ast.FunctionDef)
            and node.name == "test_chat_add_reaction_invalid_id_response"
        )
        doc = ast.get_docstring(target) or ""
        assert "1. deviceA 调用 ChatManager.addReaction" in doc
        assert "2. 校验响应信封" in doc
        assert "3. 校验 SDK 返回错误体" in doc
        assert "Unknown server error" in doc
        assert "msgbody is not_found" not in ast.unparse(target)
        assert "describe_case_steps(" in ast.unparse(target)


def test_android_real_e2e_cases_have_chinese_manual_steps():
    tests_root = Path(__file__).resolve().parents[1]
    target_dirs = {"client", "contact", "chat", "chatroom", "group", "presence", "push", "user_info"}
    missing = []

    for path in tests_root.rglob("test_*.py"):
        relative = path.relative_to(tests_root)
        if not relative.parts or relative.parts[0] not in target_dirs:
            continue

        tree = ast.parse(path.read_text())
        module_marked_real_e2e = any(
            "pytest.mark.real_e2e" in ast.unparse(node)
            for node in tree.body
            if isinstance(node, ast.Assign)
            and any(getattr(target, "id", "") == "pytestmark" for target in node.targets)
        )

        for node in tree.body:
            if not isinstance(node, ast.FunctionDef) or not node.name.startswith("test_"):
                continue
            function_marked_real_e2e = any(
                ast.unparse(decorator) == "pytest.mark.real_e2e"
                for decorator in node.decorator_list
            )
            if not (module_marked_real_e2e or function_marked_real_e2e):
                continue
            source = ast.unparse(node)
            text = (ast.get_docstring(node) or "") + "\n" + source
            has_steps = "1. " in text and "2. " in text and "describe_case_steps(" in source
            if not has_steps:
                missing.append(f"{relative}::{node.name}")

    assert missing == []


def test_session_lifecycle_cases_have_chinese_manual_steps():
    tests_root = Path(__file__).resolve().parents[1]
    missing = []

    for path in tests_root.rglob("test_*.py"):
        relative = path.relative_to(tests_root)
        if relative.parts and relative.parts[0] in {"web", "web_real", "tools"}:
            continue

        tree = ast.parse(path.read_text())
        module_marked_lifecycle = any(
            "pytest.mark.session_lifecycle" in ast.unparse(node)
            for node in tree.body
            if isinstance(node, ast.Assign)
            and any(getattr(target, "id", "") == "pytestmark" for target in node.targets)
        )

        for node in tree.body:
            if not isinstance(node, ast.FunctionDef) or not node.name.startswith("test_"):
                continue
            function_marked_lifecycle = any(
                ast.unparse(decorator) == "pytest.mark.session_lifecycle"
                for decorator in node.decorator_list
            )
            if not (module_marked_lifecycle or function_marked_lifecycle):
                continue
            source = ast.unparse(node)
            text = (ast.get_docstring(node) or "") + "\n" + source
            has_steps = "1. " in text and "2. " in text and "3. " in text and "describe_case_steps(" in source
            if not has_steps:
                missing.append(f"{relative}::{node.name}")

    assert missing == []
