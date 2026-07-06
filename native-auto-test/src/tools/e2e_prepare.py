from __future__ import annotations

import argparse
from pathlib import Path

from .e2e_cli import parse_client_arg, parse_sdk_version_arg, resolve_client_versions
from .e2e_context import ClientContext, RunContext, SdkVersionCheck, build_run_id, write_context


def build_prepare_context(
    *,
    client_args: list[str],
    sdk_version_args: list[str],
    output_root: Path,
    device_mode: str,
    matrix_mode: str,
    install_mode: str,
    account_mode: str,
    run_id: str | None = None,
) -> RunContext:
    if device_mode != "existing":
        raise ValueError("第一阶段只支持 --device-mode existing")
    if account_mode != "fresh":
        raise ValueError("第一阶段只支持 --account-mode fresh")
    clients = [parse_client_arg(value) for value in client_args]
    versions = dict(parse_sdk_version_arg(value) for value in sdk_version_args)
    resolved = resolve_client_versions(clients, versions)
    run_id = run_id or build_run_id([client.platform for client in resolved])
    context_path = output_root / "run" / run_id / "context.yaml"
    case_results_json = output_root / "test-results" / f"{run_id}-case-results.json"
    case_results_csv = output_root / "test-results" / f"{run_id}-case-results.csv"
    return RunContext(
        run_id=run_id,
        status="ready",
        matrix_mode=matrix_mode,
        device_mode=device_mode,
        install_mode=install_mode,
        account_mode=account_mode,
        sdk_initialized=True,
        sdk_options_summary={
            "source": "config.yaml",
            "profile": "default",
            "app_key_present": True,
            "dns_config_enabled": True,
            "custom_server_present": False,
            "debug_enabled": True,
            "auto_login_enabled": False,
            "resolved": True,
            "resolved_platforms": sorted({client.platform for client in resolved}),
        },
        clients={
            client.slot: ClientContext(
                platform=client.platform,
                device_id="",
                device_source="existing",
                topic=f"im-auto-{run_id}-{client.slot}",
                requested_sdk_version=client.sdk_version or "",
                actual_sdk_version=None,
                version_required=True,
                version_check=SdkVersionCheck(status="not_checked", source="prepare_context"),
            )
            for client in resolved
        },
        accounts={
            client.slot: {
                "mode": "fresh",
                "status": "planned",
                "credential_ref": "config.accounts.default_password",
            }
            for client in resolved
        },
        artifacts={
            "context_path": str(context_path),
            "case_results_json": str(case_results_json),
            "case_results_csv": str(case_results_csv),
            "api_coverage_html": str(output_root / "api-coverage" / f"{run_id}-api-coverage.html"),
            "api_gap_backlog_csv": str(output_root / "api-coverage" / f"{run_id}-gap-backlog.csv"),
        },
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="准备 SDK E2E 运行 context。")
    parser.add_argument("--client", action="append", required=True)
    parser.add_argument("--sdk-version", action="append", default=[])
    parser.add_argument("--output-root", default="out")
    parser.add_argument("--run-id")
    parser.add_argument("--device-mode", default="existing", choices=["existing", "auto", "manual"])
    parser.add_argument("--matrix-mode", default="pair", choices=["smoke", "pair", "full"])
    parser.add_argument("--install-mode", default="clean", choices=["clean", "keep", "upgrade"])
    parser.add_argument("--account-mode", default="fresh", choices=["fresh"])
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    ctx = build_prepare_context(
        client_args=args.client,
        sdk_version_args=args.sdk_version,
        output_root=Path(args.output_root),
        device_mode=args.device_mode,
        matrix_mode=args.matrix_mode,
        install_mode=args.install_mode,
        account_mode=args.account_mode,
        run_id=args.run_id,
    )
    write_context(ctx, Path(ctx.artifacts["context_path"]))
    print(ctx.artifacts["context_path"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
