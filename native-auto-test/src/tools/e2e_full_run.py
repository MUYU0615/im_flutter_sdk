from __future__ import annotations

import argparse
import subprocess
import sys

from .e2e_cli import parse_client_arg, parse_sdk_version_arg, resolve_client_versions


def _is_android_android_matrix(platform_matrix: str, client_args: list[str], sdk_version_args: list[str]) -> bool:
    if platform_matrix != "android-android":
        return False
    clients = [parse_client_arg(value) for value in client_args]
    versions = dict(parse_sdk_version_arg(value) for value in sdk_version_args)
    resolved = resolve_client_versions(clients, versions)
    return bool(resolved) and all(client.platform == "android" for client in resolved)


def build_android_runner_commands(
    *,
    client_args: list[str],
    sdk_version_args: list[str],
    run_id: str,
    output_root: str,
    platform_matrix: str,
    pytest_args: list[str],
) -> list[list[str]]:
    if not _is_android_android_matrix(platform_matrix, client_args, sdk_version_args):
        raise ValueError("--platform-matrix android-android 只能搭配 android client")
    case_results = f"{output_root}/test-results/{run_id}-case-results.json"
    gap_backlog = f"{output_root}/api-coverage/{run_id}-gap-backlog.csv"
    pytest_report = f"{output_root}/log/android/{run_id}-android-pytest.html"
    android_version = resolve_client_versions(
        [parse_client_arg(value) for value in client_args],
        dict(parse_sdk_version_arg(value) for value in sdk_version_args),
    )[0].sdk_version
    runner = [
        sys.executable,
        "-m",
        "src.tools.android_e2e_runner",
        "--run-id",
        run_id,
        "--output-root",
        output_root,
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
        "--pytest-report",
        pytest_report,
        "--platform",
        "android",
        "--sdk-version",
        android_version or "",
    ]
    return [runner, coverage]


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
    if _is_android_android_matrix(args.platform_matrix, args.client, args.sdk_version):
        commands = build_android_runner_commands(
            client_args=args.client,
            sdk_version_args=args.sdk_version,
            run_id=args.run_id,
            output_root=args.output_root,
            platform_matrix=args.platform_matrix,
            pytest_args=pytest_args,
        )
    else:
        commands = build_stage_commands(
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
        )
    for command in commands:
        code = subprocess.call(command)
        if code != 0:
            return code
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
