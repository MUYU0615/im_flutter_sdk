"""Run the fixed Android real E2E sanity pack through android_e2e_runner."""
from __future__ import annotations

import argparse
from pathlib import Path

from . import android_e2e_runner


def _default_cases_file() -> Path:
    return Path(__file__).resolve().parents[2] / "config" / "android_sanity_cases.txt"


def load_cases(path: Path) -> list[str]:
    cases: list[str] = []
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        cases.append(line)
    if not cases:
        raise RuntimeError(f"Android sanity cases file is empty: {path}")
    return cases


def build_pytest_args(cases: list[str], extra_args: list[str]) -> list[str]:
    return [*cases, "--target-platform", "android", "-m", "real_e2e", "-q", *extra_args]


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--cases-file",
        default=str(_default_cases_file()),
        help="Path to Android sanity case list.",
    )
    parser.add_argument("--run-id", default=None)
    parser.add_argument("--run-context", default=None)
    parser.add_argument("--output-root", default="out")
    parser.add_argument(
        "--device-ids",
        nargs="+",
        default=None,
        help="Android device ids. Provide two ids for full deviceA/deviceB sanity.",
    )
    parser.add_argument("--device-id", default=None, help="Compatibility alias for one Android device id.")
    parser.add_argument("--package-name", default="com.easemob.im_flutter_test")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--relay-port", type=int, default=2000)
    parser.add_argument(
        "--no-auto-relay-port",
        dest="auto_relay_port",
        action="store_false",
        default=True,
        help="Use the fixed relay port instead of choosing a free local port automatically.",
    )
    parser.add_argument("--bridge-url", default="ws://127.0.0.1:2000/iov/websocket/dual")
    parser.add_argument("--startup-timeout", type=float, default=60.0)
    parser.add_argument("--flutter-timeout", type=float, default=180.0)
    parser.add_argument("--bridge-timeout", type=float, default=60.0)
    parser.add_argument(
        "--no-html-report",
        dest="html_report",
        action="store_false",
        default=True,
        help="Do not append pytest-html output under native-auto-test/out/log/android.",
    )
    parser.add_argument(
        "--no-allure-report",
        dest="allure_report",
        action="store_false",
        default=True,
        help="Do not append pytest allure output under native-auto-test/out/log/android.",
    )
    parser.add_argument("pytest_args", nargs=argparse.REMAINDER)
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    if args.pytest_args and args.pytest_args[0] == "--":
        args.pytest_args = args.pytest_args[1:]
    cases = load_cases(Path(args.cases_file))
    args.pytest_args = build_pytest_args(cases, args.pytest_args)
    if args.device_ids is None:
        args.device_ids = [args.device_id] if args.device_id else android_e2e_runner._connected_android_devices()
    elif args.device_id:
        args.device_ids = [args.device_id, *args.device_ids]
    return android_e2e_runner.run(args)


if __name__ == "__main__":
    raise SystemExit(main())
