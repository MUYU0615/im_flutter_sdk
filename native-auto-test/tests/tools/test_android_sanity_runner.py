from pathlib import Path

import pytest

from src.tools.android_sanity_runner import build_pytest_args, load_cases


pytestmark = pytest.mark.no_global_login


def test_load_cases_skips_comments_and_blank_lines(tmp_path: Path):
    cases_file = tmp_path / "android_sanity_cases.txt"
    cases_file.write_text(
        "\n".join(
            [
                "# comment",
                "",
                "tests/a.py::test_a",
                "  tests/b.py::test_b  ",
            ]
        ),
        encoding="utf-8",
    )

    assert load_cases(cases_file) == [
        "tests/a.py::test_a",
        "tests/b.py::test_b",
    ]


def test_build_pytest_args_appends_android_real_e2e_defaults():
    args = build_pytest_args(
        ["tests/a.py::test_a", "tests/b.py::test_b"],
        ["-x"],
    )
    assert args == [
        "tests/a.py::test_a",
        "tests/b.py::test_b",
        "--target-platform",
        "android",
        "-m",
        "real_e2e",
        "-q",
        "-x",
    ]
