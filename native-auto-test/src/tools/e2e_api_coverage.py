from __future__ import annotations

import argparse
import csv
import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any


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


def _load_case_results(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        raise FileNotFoundError(f"case-results 不存在：{path}")
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError(f"case-results 必须是 list：{path}")
    return [row for row in data if isinstance(row, dict)]


def _target_action_for_gap(gap_type: str) -> str:
    if gap_type == "covered":
        return "none"
    if gap_type == "failed_case":
        return "fix_real_e2e_case"
    if gap_type == "blocked":
        return "resolve_environment_or_service"
    if gap_type == "case_api_unmapped":
        return "add_api_marker"
    return "add_real_e2e_case"


def _reason_for_api_rows(rows: list[dict[str, Any]], gap_type: str) -> str:
    if gap_type == "covered":
        return "真实 E2E 用例已通过"
    if gap_type == "failed_case":
        failures = [
            str(row.get("failure_summary") or "").strip()
            for row in rows
            if row.get("outcome") == "failed" and str(row.get("failure_summary") or "").strip()
        ]
        return "真实 E2E 用例失败：" + (failures[0] if failures else "未提供失败摘要")
    if gap_type == "blocked":
        skips = [
            str(row.get("failure_summary") or "").strip()
            for row in rows
            if row.get("outcome") == "skipped" and str(row.get("failure_summary") or "").strip()
        ]
        return "真实 E2E 用例被跳过：" + (skips[0] if skips else "未提供跳过原因")
    return "未发现真实 E2E 用例通过"


def build_rows_from_case_results(
    *,
    run_id: str,
    case_results_path: Path,
    pytest_report: str = "",
    platform: str = "android",
    sdk_version: str = "",
) -> list[ApiGapRow]:
    case_results = _load_case_results(case_results_path)
    grouped: dict[tuple[str, str, str], list[dict[str, Any]]] = {}
    unmapped: list[dict[str, Any]] = []
    for row in case_results:
        api = str(row.get("api") or "")
        manager = str(row.get("manager") or "")
        method_key = str(row.get("method_key") or "")
        if not api:
            unmapped.append(row)
            continue
        grouped.setdefault((api, manager, method_key), []).append(row)

    rows: list[ApiGapRow] = []
    for (api, manager, method_key), api_rows in sorted(grouped.items()):
        fail_count = sum(1 for row in api_rows if row.get("outcome") == "failed")
        pass_count = sum(1 for row in api_rows if row.get("outcome") == "passed")
        skip_count = sum(1 for row in api_rows if row.get("outcome") == "skipped")
        gap_type = (
            "failed_case"
            if fail_count
            else ("covered" if pass_count else ("blocked" if skip_count else "missing_case"))
        )
        case_ids = sorted({str(row.get("case_id") or "") for row in api_rows if row.get("case_id")})
        evidence = sorted({str(row.get("nodeid") or "") for row in api_rows if row.get("nodeid")})
        rows.append(
            ApiGapRow(
                run_id=run_id,
                api=api,
                manager=manager,
                method_key=method_key,
                platform=platform,
                platform_role="baseline" if platform == "android" else "target",
                sdk_version=sdk_version,
                gap_type=gap_type,
                target_action=_target_action_for_gap(gap_type),
                source_platform=platform,
                source_evidence=";".join(evidence),
                case_id=";".join(case_ids),
                pytest_report=pytest_report,
                reason=_reason_for_api_rows(api_rows, gap_type),
                priority="P0" if gap_type == "failed_case" else ("P1" if gap_type == "blocked" else "P2"),
            )
        )

    for row in unmapped:
        nodeid = str(row.get("nodeid") or "")
        outcome = str(row.get("outcome") or "")
        rows.append(
            ApiGapRow(
                run_id=run_id,
                api="",
                manager="",
                method_key="",
                platform=platform,
                platform_role="baseline" if platform == "android" else "target",
                sdk_version=sdk_version,
                gap_type="case_api_unmapped",
                target_action="add_api_marker",
                source_platform=platform,
                source_evidence=nodeid,
                case_id=str(row.get("case_id") or ""),
                pytest_report=pytest_report,
                reason=f"真实 E2E 用例缺少 @pytest.mark.api，outcome={outcome}",
                priority="P1",
            )
        )
    return rows


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="生成 SDK API 覆盖和缺失 backlog。")
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--case-results", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--pytest-report", default="")
    parser.add_argument("--platform", default="android")
    parser.add_argument("--sdk-version", default="")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    rows = build_rows_from_case_results(
        run_id=args.run_id,
        case_results_path=Path(args.case_results),
        pytest_report=args.pytest_report,
        platform=args.platform,
        sdk_version=args.sdk_version,
    )
    write_gap_backlog(rows, Path(args.output))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
