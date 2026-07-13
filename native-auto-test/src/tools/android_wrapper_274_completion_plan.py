"""Generate the Android wrapper 274 E2E completion plan.

This plan is a working queue derived from the Android API coverage rows:
- P0 means a main-session Android wrapper API still lacks an acceptable coverage path.
- P1 means source evidence exists and needs real Android execution evidence.
- P2 means the API is intentionally outside the main-session queue because it is
  blocked by service/environment, requires session-lifecycle isolation, or is a
  test bridge command.
"""

from __future__ import annotations

import argparse
import csv
from collections import Counter
from pathlib import Path
from typing import Any

from src.tools.android_423_api_coverage_report import ROOT, build_rows


OUTPUT_CSV = ROOT / "out/android-wrapper-274-e2e-completion-plan.csv"
OUTPUT_MD = ROOT / "out/android-wrapper-274-e2e-completion-plan.md"

SPECIAL_NATIVE_CONCLUSIONS = {
    "blocked_by_service_environment",
    "requires_session_lifecycle_isolation",
}


def _special_wrapper_reasons(rows: list[dict[str, str]]) -> dict[tuple[str, str], tuple[str, str]]:
    reasons: dict[tuple[str, str], tuple[str, str]] = {}
    for row in rows:
        if row.get("row_kind") != "native_android_api":
            continue
        conclusion = row.get("coverage_conclusion", "")
        if conclusion not in SPECIAL_NATIVE_CONCLUSIONS:
            continue
        for wrapper in (row.get("covered_by_wrapper_api") or "").split("; "):
            if not wrapper or "." not in wrapper:
                continue
            manager, api = wrapper.split(".", 1)
            reasons[(manager, api)] = (
                conclusion,
                row.get("coverage_reason_zh") or "需专项环境验证。",
            )
    return reasons


def _classify_wrapper_row(
    row: dict[str, str],
    special_wrappers: dict[tuple[str, str], tuple[str, str]],
) -> tuple[str, str, str]:
    key = (row["manager"], row["api"])
    if key in special_wrappers:
        gap_type, reason = special_wrappers[key]
        return "P2", gap_type, reason

    sdk_evidence = row.get("android_wrapper_sdk_call_evidence") or ""
    positive_refs = int(row.get("automation_positive_refs") or 0)
    error_refs = int(row.get("automation_error_only_refs") or 0)
    refs = int(row.get("automation_refs") or 0)

    if sdk_evidence == "bridge":
        return "P2", "test_bridge_control", "测试桥控制命令，不计入真实 SDK 缺口。"
    if sdk_evidence != "yes":
        return "P0", "wrapper_sdk_call_evidence_missing", "先确认 Android wrapper handler 是否真实调用 SDK。"
    if positive_refs > 0:
        return "P1", "needs_real_android_execution_verification", "已有正向自动化引用，需用真实 Android runner 执行并沉淀 case-results。"
    if error_refs > 0:
        return "P0", "positive_case_missing", "只有异常/错误路径，需补成功路径或标明服务/权限阻塞。"
    if refs > 0:
        return "P1", "case_semantics_unclear", "有自动化引用但扫描无法确认正向/错误语义，需人工复核 case。"
    return "P0", "case_missing", "缺少自动化 case。"


def build_completion_plan_rows(rows: list[dict[str, str]]) -> list[dict[str, Any]]:
    special_wrappers = _special_wrapper_reasons(rows)
    plan_rows: list[dict[str, Any]] = []
    for row in rows:
        if row.get("row_kind") != "wrapper_api" or row.get("android_covered") != "yes":
            continue
        priority, gap_type, action = _classify_wrapper_row(row, special_wrappers)
        plan_rows.append(
            {
                "priority": priority,
                "gap_type": gap_type,
                "manager": row["manager"],
                "api": row["api"],
                "android_wrapper_sdk_call_evidence": row.get("android_wrapper_sdk_call_evidence") or "",
                "automation_refs": int(row.get("automation_refs") or 0),
                "automation_positive_refs": int(row.get("automation_positive_refs") or 0),
                "automation_error_only_refs": int(row.get("automation_error_only_refs") or 0),
                "automation_files": row.get("automation_files") or "",
                "target_case": row.get("target_case") or "",
                "recommended_action_zh": action,
            }
        )
    return sorted(plan_rows, key=lambda item: (item["priority"], item["manager"], item["api"]))


def render_csv(rows: list[dict[str, Any]]) -> str:
    if not rows:
        return ""
    from io import StringIO

    buf = StringIO()
    writer = csv.DictWriter(buf, fieldnames=list(rows[0].keys()))
    writer.writeheader()
    writer.writerows(rows)
    return buf.getvalue()


def render_markdown(rows: list[dict[str, Any]]) -> str:
    counts = Counter(row["priority"] for row in rows)
    gaps = Counter(row["gap_type"] for row in rows)
    lines = [
        "# Android wrapper 274 E2E completion plan",
        "",
        f"- Total Android wrapper APIs: {len(rows)}",
        f"- Priority counts: {dict(counts)}",
        f"- Gap counts: {dict(gaps)}",
        "",
        "## P0",
        "",
        "| Manager | API | Gap | Positive refs | Error refs | Action |",
        "|---|---|---|---:|---:|---|",
    ]
    for row in rows:
        if row["priority"] == "P0":
            lines.append(
                "| {manager} | {api} | {gap_type} | {automation_positive_refs} | "
                "{automation_error_only_refs} | {recommended_action_zh} |".format(**row)
            )
    lines.extend(
        [
            "",
            "## P2 / blocked or isolated",
            "",
            "| Manager | API | Gap | Action |",
            "|---|---|---|---|",
        ]
    )
    for row in rows:
        if row["priority"] == "P2":
            lines.append(
                "| {manager} | {api} | {gap_type} | {recommended_action_zh} |".format(**row)
            )
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv-output", type=Path, default=OUTPUT_CSV)
    parser.add_argument("--markdown-output", type=Path, default=OUTPUT_MD)
    args = parser.parse_args()

    rows = build_completion_plan_rows(build_rows())
    args.csv_output.parent.mkdir(parents=True, exist_ok=True)
    args.markdown_output.parent.mkdir(parents=True, exist_ok=True)
    args.csv_output.write_text(render_csv(rows), encoding="utf-8-sig")
    args.markdown_output.write_text(render_markdown(rows), encoding="utf-8")

    counts = Counter(row["priority"] for row in rows)
    gaps = Counter(row["gap_type"] for row in rows)
    print(
        {
            "csv": str(args.csv_output),
            "markdown": str(args.markdown_output),
            "total": len(rows),
            "priority_counts": dict(counts),
            "gap_counts": dict(gaps),
        }
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
