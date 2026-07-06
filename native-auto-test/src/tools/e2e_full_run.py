from __future__ import annotations

import argparse
import subprocess
import sys


def build_stage_commands(
    *,
    client_args: list[str],
    sdk_version_args: list[str],
    run_id: str,
    output_root: str,
    matrix_mode: str,
    install_mode: str,
    account_mode: str,
    device_mode: str,
    platform_matrix: str,
    pytest_args: list[str],
) -> list[list[str]]:
    context_path = f"{output_root}/run/{run_id}/context.yaml"
    case_results = f"{output_root}/test-results/{run_id}-case-results.json"
    gap_backlog = f"{output_root}/api-coverage/{run_id}-gap-backlog.csv"
    prepare = [
        sys.executable,
        "-m",
        "src.tools.e2e_prepare",
        "--run-id",
        run_id,
        "--output-root",
        output_root,
        "--matrix-mode",
        matrix_mode,
        "--install-mode",
        install_mode,
        "--account-mode",
        account_mode,
        "--device-mode",
        device_mode,
    ]
    for value in client_args:
        prepare.extend(["--client", value])
    for value in sdk_version_args:
        prepare.extend(["--sdk-version", value])
    run = [
        sys.executable,
        "-m",
        "src.tools.e2e_run",
        "--run-context",
        context_path,
        "--run-id",
        run_id,
        "--platform-matrix",
        platform_matrix,
        "--",
        *pytest_args,
    ]
    coverage = [
        sys.executable,
        "-m",
        "src.tools.e2e_api_coverage",
        "--run-id",
        run_id,
        "--case-results",
        case_results,
        "--output",
        gap_backlog,
    ]
    return [prepare, run, coverage]


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="正式 SDK E2E 全流程入口。")
    parser.add_argument("--client", action="append", required=True)
    parser.add_argument("--sdk-version", action="append", default=[])
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--output-root", default="out")
    parser.add_argument("--matrix-mode", default="pair")
    parser.add_argument("--install-mode", default="clean")
    parser.add_argument("--account-mode", default="fresh")
    parser.add_argument("--device-mode", default="existing")
    parser.add_argument("--platform-matrix", default="android-android")
    parser.add_argument("pytest_args", nargs=argparse.REMAINDER)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    pytest_args = args.pytest_args
    if pytest_args and pytest_args[0] == "--":
        pytest_args = pytest_args[1:]
    for command in build_stage_commands(
        client_args=args.client,
        sdk_version_args=args.sdk_version,
        run_id=args.run_id,
        output_root=args.output_root,
        matrix_mode=args.matrix_mode,
        install_mode=args.install_mode,
        account_mode=args.account_mode,
        device_mode=args.device_mode,
        platform_matrix=args.platform_matrix,
        pytest_args=pytest_args,
    ):
        code = subprocess.call(command)
        if code != 0:
            return code
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
