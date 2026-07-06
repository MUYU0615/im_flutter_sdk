from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path


def build_marker_expression(platform_matrix: str) -> str:
    platforms = {part.lower() for part in platform_matrix.split("-") if part}
    if not platforms:
        return "real_e2e"
    if platforms == {"web"}:
        return "real_e2e and web"
    if "web" not in platforms:
        return "real_e2e and not web"
    return "real_e2e"


def build_pytest_args(
    *,
    run_context: Path,
    run_id: str,
    platform_matrix: str,
    extra_args: list[str],
) -> list[str]:
    log_dir = Path("out") / "log" / platform_matrix
    return [
        "tests",
        "-s",
        "-m",
        build_marker_expression(platform_matrix),
        "--run-context",
        str(run_context),
        "--html",
        str(log_dir / f"{run_id}-pytest.html"),
        "--self-contained-html",
        "--alluredir",
        str(log_dir / f"{run_id}-allure-results"),
        *extra_args,
    ]


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="运行 SDK E2E pytest 用例。")
    parser.add_argument("--run-context", required=True)
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--platform-matrix", required=True)
    parser.add_argument("pytest_args", nargs=argparse.REMAINDER)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    pytest_args = args.pytest_args
    if pytest_args and pytest_args[0] == "--":
        pytest_args = pytest_args[1:]
    case_json = Path("out") / "test-results" / f"{args.run_id}-case-results.json"
    case_csv = Path("out") / "test-results" / f"{args.run_id}-case-results.csv"
    env = os.environ.copy()
    env["NATIVE_AUTO_TEST_RUN_ID"] = args.run_id
    env["NATIVE_AUTO_TEST_RUN_CONTEXT"] = args.run_context
    env["NATIVE_AUTO_TEST_CASE_RESULTS_JSON"] = str(case_json)
    env["NATIVE_AUTO_TEST_CASE_RESULTS_CSV"] = str(case_csv)
    command = [
        sys.executable,
        "-m",
        "pytest",
        *build_pytest_args(
            run_context=Path(args.run_context),
            run_id=args.run_id,
            platform_matrix=args.platform_matrix,
            extra_args=pytest_args,
        ),
    ]
    return subprocess.call(command, env=env)


if __name__ == "__main__":
    raise SystemExit(main())
