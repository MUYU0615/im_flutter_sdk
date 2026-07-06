from __future__ import annotations

import argparse
import csv
from dataclasses import asdict, dataclass
from pathlib import Path


@dataclass(frozen=True)
class ApiGapRow:
    run_id: str
    api: str
    manager: str
    method_key: str
    platform: str
    platform_role: str
    sdk_version: str
    gap_type: str
    target_action: str
    source_platform: str
    source_evidence: str
    case_id: str
    pytest_report: str
    reason: str
    priority: str


def classify_gap(
    *,
    method_key_exists: bool,
    wrapper_exists: bool,
    e2e_case_count: int,
    e2e_fail_count: int,
) -> str:
    if not method_key_exists:
        return "method_key_missing"
    if not wrapper_exists:
        return "wrapper_missing"
    if e2e_case_count == 0:
        return "missing_case"
    if e2e_fail_count > 0:
        return "failed_case"
    return "covered"


def write_gap_backlog(rows: list[ApiGapRow], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=list(ApiGapRow.__dataclass_fields__))
        writer.writeheader()
        writer.writerows(asdict(row) for row in rows)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="生成 SDK API 覆盖和缺失 backlog。")
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--case-results", required=True)
    parser.add_argument("--output", required=True)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    write_gap_backlog([], Path(args.output))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
