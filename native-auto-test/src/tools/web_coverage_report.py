"""校验并汇总 Web API 覆盖清单。"""
from __future__ import annotations

import argparse
import sys

from collections import defaultdict
from pathlib import Path

from .web_doc_reason_summary import resolve_reason_zh
from .web_coverage import iter_entries, load_manifest, status_counts, validate_manifest


def _manager_counts(manifest: dict) -> dict[str, dict[str, int]]:
    result: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for manager, _, info in iter_entries(manifest):
        result[manager][info.get("status", "unknown")] += 1
    return result


def _reason_groups(manifest: dict, status: str) -> dict[str, list[str]]:
    groups: dict[str, list[str]] = defaultdict(list)
    for manager, cmd, info in iter_entries(manifest):
        if info.get("status") == status:
            groups[resolve_reason_zh(info, "status")].append(f"{manager}.{cmd}")
    return dict(sorted(groups.items(), key=lambda item: (-len(item[1]), item[0])))


def _verification_counts(manifest: dict) -> dict[str, int]:
    counts: dict[str, int] = defaultdict(int)
    for _, _, info in iter_entries(manifest):
        if info.get("status") not in {"supported", "different"}:
            continue
        for layer in info.get("verified_by", []):
            counts[str(layer)] += 1
        if info.get("public_api_verified") is True:
            counts["public_api_verified"] += 1
        else:
            counts["public_api_unverified"] += 1
    return dict(counts)


def _markdown_report(manifest: dict) -> str:
    counts = status_counts(manifest)
    verification_counts = _verification_counts(manifest)
    lines = [
        "# Web Bridge / 本地 Adapter API 覆盖报告",
        "",
        "该报告用于验证本地 Web 测试 bridge 和 Web adapter 的行为。",
        "该报告不证明真实 IM 服务 E2E 收发结果。",
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
            "## 验证层级",
            "",
            "| 层级 | 数量 |",
            "|---|---:|",
        ]
    )
    for layer in (
        "json_bridge",
        "client_instance_manager",
        "public_dart_api",
        "public_api_verified",
        "public_api_unverified",
    ):
        lines.append(f"| {layer} | {verification_counts.get(layer, 0)} |")

    lines.extend(["", "## 按 Manager 统计", "", "| Manager | supported | unsupported | not_applicable | different | blocked | pending |", "|---|---:|---:|---:|---:|---:|---:|"])
    for manager, manager_counts in sorted(_manager_counts(manifest).items()):
        lines.append(
            "| {manager} | {supported} | {unsupported} | {not_applicable} | {different} | {blocked} | {pending} |".format(
                manager=manager,
                supported=manager_counts.get("supported", 0),
                unsupported=manager_counts.get("unsupported", 0),
                not_applicable=manager_counts.get("not_applicable", 0),
                different=manager_counts.get("different", 0),
                blocked=manager_counts.get("blocked", 0),
                pending=manager_counts.get("pending", 0),
            )
        )

    lines.extend(
        [
            "",
            "## E2E 证据",
            "",
            "- `tests/web/test_web_chat_local_store.py` 通过 Web JSON bridge 验证受支持的 ChatManager 本地状态 API。",
            "- `tests/web/test_web_contact.py` 通过 Web JSON bridge 验证受支持的 ContactManager API。",
            "- `tests/web/test_web_unsupported_api.py` 验证 Web adapter API 的代表性 unsupported 行为。",
            "- `tests/web/test_web_fixture.py` 验证持久化 headless Web client 的按 case `Client.webReset` 清理。",
        ]
    )

    lines.extend(["", "## Unsupported 原因分组", ""])
    for reason, apis in _reason_groups(manifest, "unsupported").items():
        lines.append(f"### {reason}")
        for api in apis:
            lines.append(f"- `{api}`")
        lines.append("")

    lines.extend(["## Not Applicable 原因分组", ""])
    for reason, apis in _reason_groups(manifest, "not_applicable").items():
        lines.append(f"### {reason}")
        for api in apis:
            lines.append(f"- `{api}`")
        lines.append("")

    return "\n".join(lines).rstrip() + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--strict", action="store_true", help="当 manifest 不完整时返回非 0。")
    parser.add_argument("--markdown", action="store_true", help="输出 Markdown 报告。")
    parser.add_argument("--output", type=Path, help="将报告写入指定文件。")
    args = parser.parse_args()

    manifest = load_manifest()
    counts = status_counts(manifest)
    if args.markdown:
        output = _markdown_report(manifest)
    else:
        output = "\n".join(f"{status}: {count}" for status, count in counts.items()) + "\n"

    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(output, encoding="utf-8")
    else:
        print(output, end="")

    errors = validate_manifest(manifest)
    if errors:
        print("coverage manifest 错误：", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1 if args.strict else 0
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
