from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path
from typing import Any

import yaml


def load_run_context(path: Path) -> dict[str, Any]:
    return yaml.safe_load(path.read_text(encoding="utf-8")) or {}


def platforms_from_context(context: dict[str, Any]) -> list[str]:
    topology = context.get("topology") or {}
    platforms = topology.get("platforms_under_test") or []
    return [str(platform).lower() for platform in platforms if platform]


def build_marker_expression(platforms: list[str]) -> str:
    platform_set = {part.lower() for part in platforms if part}
    if not platform_set:
        return "real_e2e"
    if platform_set == {"web"}:
        return "real_e2e and web"
    if "web" not in platform_set:
        return "real_e2e and not web"
    return "real_e2e"


def build_pytest_args(
    *,
    run_context: Path,
    run_id: str,
    platforms: list[str],
    log_dir: Path,
    extra_args: list[str],
) -> list[str]:
    return [
        "tests",
        "-s",
        "-m",
        build_marker_expression(platforms),
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
    context = load_run_context(Path(args.run_context))
    platforms = platforms_from_context(context)
    log_root = (
        ((context.get("environment") or {}).get("logs") or {}).get("root_dir")
        or str(Path("out") / "log" / "-".join(platforms or ["unknown"]))
    )
    command = [
        sys.executable,
        "-m",
        "pytest",
        *build_pytest_args(
            run_context=Path(args.run_context),
            run_id=args.run_id,
            platforms=platforms,
            log_dir=Path(log_root),
            extra_args=pytest_args,
        ),
    ]
    return subprocess.call(command, env=env)


if __name__ == "__main__":
    raise SystemExit(main())
