"""生成真实 Web SDK / 服务 E2E 覆盖报告。"""
from __future__ import annotations

import argparse
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

from src.tools.web_doc_reason_summary import resolve_reason_zh, summarize_reason_zh
from src.tools.web_real_e2e_matrix import (
    load_real_manifest,
    missing_real_e2e_entries,
    status_counts,
    validate_real_manifest,
)


def _manager_counts(manifest: dict[str, Any]) -> dict[str, dict[str, int]]:
    result: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for manager, commands in (manifest.get("web_real_e2e") or {}).items():
        for info in commands.values():
            result[manager][str(info.get("real_e2e_status", "pending"))] += 1
    return result


def _reason_groups(manifest: dict[str, Any], status: str) -> dict[str, list[str]]:
    groups: dict[str, list[str]] = defaultdict(list)
    for manager, commands in (manifest.get("web_real_e2e") or {}).items():
        for cmd, info in commands.items():
            if info.get("real_e2e_status") == status:
                groups[resolve_reason_zh(info, "real_e2e_status")].append(
                    f"{manager}.{cmd}"
                )
    return dict(sorted(groups.items(), key=lambda item: (-len(item[1]), item[0])))


def _blocked_test_category(reason: str) -> str:
    lower = reason.lower()

    if (
        "does not satisfy the flutter contract" in lower
        or "does not expose" in lower
        or "no public" in lower
        or "not hook any real web sdk" in lower
        or "locally synthesizing bridge events" in lower
        or "local bridge" in lower
        or "no /chatfiles upload request is emitted" in lower
    ):
        return "API未对齐iOS/Android"

    return "API执行未通过"


def _blocked_test_groups(manifest: dict[str, Any]) -> dict[str, list[str]]:
    groups: dict[str, list[str]] = defaultdict(list)
    for manager, commands in (manifest.get("web_real_e2e") or {}).items():
        for cmd, info in commands.items():
            if info.get("real_e2e_status") != "blocked":
                continue
            reason = str(info.get("reason", ""))
            groups[_blocked_test_category(reason)].append(f"{manager}.{cmd}")
    return dict(sorted(groups.items(), key=lambda item: (-len(item[1]), item[0])))


def _partial_support_groups(manifest: dict[str, Any]) -> dict[str, list[str]]:
    groups: dict[str, list[str]] = defaultdict(list)
    for manager, commands in (manifest.get("web_real_e2e") or {}).items():
        for cmd, info in commands.items():
            if info.get("real_e2e_status") != "supported":
                continue
            reason_zh = resolve_reason_zh(info, "real_e2e_status")
            if "仅覆盖" in reason_zh or "不能视为同一条能力已通过" in reason_zh:
                groups[reason_zh].append(f"{manager}.{cmd}")
    return dict(sorted(groups.items(), key=lambda item: (-len(item[1]), item[0])))


def markdown_report(manifest: dict[str, Any]) -> str:
    counts = status_counts(manifest)
    lines = [
        "# Web 真实 E2E 覆盖报告",
        "",
        "该报告用于跟踪必须通过真实 Web SDK 和真实 IM 服务验证的 API 覆盖情况。",
        "",
        "## 总览",
        "",
        "| 状态 | 数量 |",
        "|---|---:|",
    ]
    for status, count in counts.items():
        lines.append(f"| {status} | {count} |")

    lines.extend(
        [
            "",
            "## 按 Manager 统计",
            "",
            "| Manager | supported | not_applicable | blocked | pending |",
            "|---|---:|---:|---:|---:|",
        ]
    )
    for manager, manager_counts in sorted(_manager_counts(manifest).items()):
        lines.append(
            "| {manager} | {supported} | {not_applicable} | {blocked} | {pending} |".format(
                manager=manager,
                supported=manager_counts.get("supported", 0),
                not_applicable=manager_counts.get("not_applicable", 0),
                blocked=manager_counts.get("blocked", 0),
                pending=manager_counts.get("pending", 0),
            )
        )

    lines.extend(
        [
            "",
            "## Blocked 测试视角分类",
            "",
            "这里按测试口径拆分 `blocked`：",
            "- `API未对齐iOS/Android`：Web API 能力、行为、契约或回调路径与 iOS/Android 不一致。",
            "- `API执行未通过`：真实 E2E 已发起调用，但执行失败、超时、返回异常，或无法完成稳定闭环。",
            "",
        ]
    )
    for category, apis in _blocked_test_groups(manifest).items():
        lines.append(f"### {category}")
        for api in apis:
            lines.append(f"- `{api}`")
        lines.append("")

    partial_groups = _partial_support_groups(manifest)
    if partial_groups:
        lines.extend(
            [
                "",
                "## Supported 但需额外说明",
                "",
                "这些 API 顶层状态为 `supported`，但只覆盖了部分语义，不能外推为同名全部子能力都已通过。",
                "",
            ]
        )
        for reason, apis in partial_groups.items():
            lines.append(f"### {reason}")
            for api in apis:
                lines.append(f"- `{api}`")
            lines.append("")

    for status, title in (
        ("blocked", "Blocked 原因分组"),
        ("pending", "Pending 原因分组"),
        ("not_applicable", "Not Applicable 原因分组"),
    ):
        lines.extend(["", f"## {title}", ""])
        for reason, apis in _reason_groups(manifest, status).items():
            lines.append(f"### {reason}")
            for api in apis:
                lines.append(f"- `{api}`")
            lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--strict", action="store_true")
    parser.add_argument("--markdown", action="store_true")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    manifest = load_real_manifest()
    counts = status_counts(manifest)
    output = (
        markdown_report(manifest)
        if args.markdown
        else "\n".join(f"{status}: {count}" for status, count in counts.items())
        + "\n"
    )
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(output, encoding="utf-8")
    else:
        print(output, end="")

    errors = validate_real_manifest(manifest)
    missing = missing_real_e2e_entries()
    if errors or missing:
        for error in errors:
            print(f"manifest 错误: {error}", file=sys.stderr)
        for api in missing:
            print(f"缺少 real e2e 条目: {api}", file=sys.stderr)
        return 1 if args.strict else 0
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
