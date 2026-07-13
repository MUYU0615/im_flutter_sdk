from __future__ import annotations

import argparse
from pathlib import Path

from .config import load_config
from .topology_loader import build_topology_context, load_topology, write_topology_context
from .topology_model import parse_device_overrides


def build_run_id(platforms: list[str]) -> str:
    from datetime import datetime

    return f"{'-'.join(platforms)}-{datetime.now().strftime('%Y%m%d-%H%M%S')}"


def build_prepare_context(
    *,
    topology: str,
    output_root: Path,
    device_args: list[str],
    install_mode: str,
    run_id: str | None = None,
    available_devices: list[str] | None = None,
    config: dict | None = None,
) -> dict:
    spec = load_topology(Path(topology))
    if available_devices is None:
        from .android_e2e_runner import _connected_android_devices

        available_devices = _connected_android_devices()
    return build_topology_context(
        spec=spec,
        run_id=run_id or build_run_id(list(spec.platforms_under_test)),
        output_root=output_root,
        config=config or load_config(),
        available_devices=available_devices,
        device_overrides=parse_device_overrides(device_args),
        install_mode=install_mode,
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="准备 SDK E2E 运行 context。")
    parser.add_argument("--topology", required=True)
    parser.add_argument("--device", action="append", default=[])
    parser.add_argument("--output-root", default="out")
    parser.add_argument("--run-id")
    parser.add_argument("--install-mode", default="clean", choices=["clean", "keep", "upgrade"])
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    context = build_prepare_context(
        topology=args.topology,
        output_root=Path(args.output_root),
        device_args=args.device,
        install_mode=args.install_mode,
        run_id=args.run_id,
    )
    write_topology_context(context, Path(context["artifacts"]["context_path"]))
    print(context["artifacts"]["context_path"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
