from __future__ import annotations

import ast
from pathlib import Path

import pytest


pytestmark = pytest.mark.no_global_login


def test_case_steps_helper_exists_and_uses_allure_dynamic_description():
    path = Path(__file__).resolve().parents[1] / "case_steps.py"
    tree = ast.parse(path.read_text())
    names = {
        node.name
        for node in tree.body
        if isinstance(node, ast.FunctionDef)
    }

    assert "describe_case_steps" in names
    assert "allure.dynamic.description" in ast.unparse(tree)


def test_case_steps_helper_preserves_numbered_multiline_text():
    from tests.case_steps import describe_case_steps

    steps = "1. 打开测试场景；\n2. 调用目标 API；\n3. 校验响应。"
    assert describe_case_steps(steps) is None


def test_case_steps_helper_allure_smoke():
    from tests.case_steps import describe_case_steps

    describe_case_steps("1. 准备本地 smoke 场景；\n2. 写入 Allure 描述；\n3. 校验 result JSON。")
