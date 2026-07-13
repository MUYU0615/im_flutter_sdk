from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

from .topology_loader import load_topology


def build_topology_runner_commands(
    *,
    topology: str,
    run_id: str,
    output_root: str,
    device_args: list[str],
    install_mode: str,
    pytest_args: list[str],
) -> list[list[str]]:
    context_path = f"{output_root}/run/{run_id}/context.yaml"
    case_results = f"{output_root}/test-results/{run_id}-case-results.json"
    gap_backlog = f"{output_root}/api-coverage/{run_id}-gap-backlog.csv"
    pytest_report = f"{output_root}/log/android/{run_id}-android-pytest.html"
    topology_spec = load_topology(Path(topology))
    subject_versions = {
        topology_spec.clients[name].sdk_version
        for name in topology_spec.coverage.subject_clients
        if name in topology_spec.clients
    }
    if len(subject_versions) != 1:
        raise ValueError(
            "topology coverage subject clients 必须声明同一个 sdk_version，"
            f"当前为: {', '.join(sorted(subject_versions)) or '(none)'}"
        )
    sdk_version = next(iter(subject_versions))
    prepare = [
        sys.executable,
        "-m",
        "src.tools.e2e_prepare",
        "--topology",
        topology,
        "--run-id",
        run_id,
        "--output-root",
        output_root,
        "--install-mode",
        install_mode,
    ]
    for value in device_args:
        prepare.extend(["--device", value])
    runner = [
        sys.executable,
        "-m",
        "src.tools.android_e2e_runner",
        "--run-context",
        context_path,
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
        sdk_version,
    ]
    return [prepare, runner, coverage]


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="正式 SDK E2E 全流程入口。")
    parser.add_argument("--topology", required=True)
    parser.add_argument("--device", action="append", default=[])
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--output-root", default="out")
    parser.add_argument("--install-mode", default="clean")
    parser.add_argument("pytest_args", nargs=argparse.REMAINDER)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    pytest_args = args.pytest_args
    if pytest_args and pytest_args[0] == "--":
        pytest_args = pytest_args[1:]
    commands = build_topology_runner_commands(
        topology=args.topology,
        run_id=args.run_id,
        output_root=args.output_root,
        device_args=args.device,
        install_mode=args.install_mode,
        pytest_args=pytest_args,
    )
    for command in commands:
        code = subprocess.call(command)
        if code != 0:
            return code
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
