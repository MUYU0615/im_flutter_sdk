"""生成 Web 真实 E2E 中缺少真实 API 路径的审计报告。"""
from __future__ import annotations

import argparse
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

from src.tools.web_doc_reason_summary import resolve_reason_zh, summarize_reason_zh
from src.tools.web_real_e2e_matrix import load_real_manifest


ROOT = Path(__file__).resolve().parents[2]


def _iter_entries(manifest: dict[str, Any]):
    for manager, commands in sorted((manifest.get("web_real_e2e") or {}).items()):
        for api, info in sorted(commands.items()):
            yield manager, api, info


def _categorize_no_real_api(reason: str, status: str) -> tuple[str, bool]:
    lower = reason.lower()

    if status == "not_applicable" and "does not expose" in lower:
        return "vendor_no_real_api", True
    if status == "not_applicable" and "no real browser web sdk/service e2e entry point" in lower:
        return "vendor_no_real_api", True

    if "current web " in lower and "implementation only" in lower:
        return "adapter_local_stub", True
    if "current web " in lower and "returns null without any real" in lower:
        return "adapter_local_stub", True
    if "current web " in lower and "stores member attributes" in lower:
        return "adapter_local_stub", True
    if "current web " in lower and "reads member attributes" in lower:
        return "adapter_local_stub", True
    if "current web " in lower and "reads members'" in lower:
        return "adapter_local_stub", True
    if "local in-memory" in lower or "hard-coded" in lower or "constant local value" in lower:
        return "adapter_local_stub", True

    if "emits this event locally" in lower:
        return "local_bridge_synthesized_event", True
    if "local bridge after command" in lower:
        return "local_bridge_synthesized_event", True
    if "locally synthesizing bridge events" in lower:
        return "local_bridge_synthesized_event", True

    if "does not expose" in lower:
        return "vendor_no_real_api", True
    if "does not expose a callable" in lower:
        return "vendor_no_real_api", True
    if "no public chat-room owner api" in lower:
        return "vendor_no_real_api", True
    if "undefined (reading 'apply')" in lower:
        return "vendor_no_real_api", True

    if "does not hook any real web sdk" in lower:
        return "callback_path_not_wired", True
    if "received no real sdk callback" in lower:
        return "callback_path_not_wired", True

    return "not_no_real_api", False


def _category_title(category: str) -> str:
    return {
        "adapter_local_stub": "Adapter 本地 Stub",
        "local_bridge_synthesized_event": "Bridge 本地合成事件",
        "vendor_no_real_api": "Vendor 无真实 API",
        "callback_path_not_wired": "真实回调路径未接通",
        "not_no_real_api": "不属于无真实 API",
    }[category]


def _collect(manifest: dict[str, Any]) -> tuple[dict[str, list[dict[str, Any]]], list[dict[str, Any]]]:
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    excluded: list[dict[str, Any]] = []
    for manager, api, info in _iter_entries(manifest):
        status = str(info.get("real_e2e_status", "pending"))
        reason = str(info.get("reason") or "").strip()
        category, include = _categorize_no_real_api(reason, status)
        entry = {
            "manager": manager,
            "api": api,
            "status": status,
            "reason": reason,
            "tests": list(info.get("tests") or []),
            "verified_by": list(info.get("verified_by") or []),
            "category": category,
        }
        if include:
            groups[category].append(entry)
        elif status == "blocked":
            excluded.append(entry)
    return dict(groups), excluded


def audit_classification_errors(manifest: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    groups, excluded = _collect(manifest)
    categorized_total = sum(len(items) for items in groups.values())
    if any(key == "not_no_real_api" for key in groups):
        errors.append("unexpected not_no_real_api category present in included groups")
    for entry in excluded:
        if entry["category"] != "not_no_real_api":
            errors.append(
                "blocked entry should not be excluded after classification: "
                f"{entry['manager']}.{entry['api']} -> {entry['category']}"
            )
    if categorized_total < 0:
        errors.append("categorized_total must not be negative")
    return errors


def markdown_report(manifest: dict[str, Any]) -> str:
    groups, excluded = _collect(manifest)
    total = sum(len(items) for items in groups.values())
    blocked_total = sum(
        1
        for _, _, info in _iter_entries(manifest)
        if str(info.get("real_e2e_status", "pending")) == "blocked"
    )
    not_applicable_total = sum(
        1
        for _, _, info in _iter_entries(manifest)
        if str(info.get("real_e2e_status", "pending")) == "not_applicable"
    )

    lines = [
        "# Web 真实 E2E 无真实 API 审计",
        "",
        "该文档用于审计“当前 Web 真实 E2E 覆盖中，没有真实 API 路径”的项。",
        "它和 coverage matrix/report 的区别是：",
        "- 这里只收录“没有真实 API / 没有真实回调路径 / 只是本地 stub”的项。",
        "- 已经能真实调用、但因为契约不一致或读回面缺失而 blocked 的项，不放进主清单。",
        "",
        "## 总览",
        "",
        f"- `no_real_api_total`: {total}",
        f"- `blocked_total`: {blocked_total}",
        f"- `not_applicable_total`: {not_applicable_total}",
        "",
        "## 分类定义",
        "",
        "- `adapter_local_stub`：Flutter Web adapter 只改本地内存、返回常量或直接 `null`，没有真实 SDK / 服务路径。",
        "- `local_bridge_synthesized_event`：事件是 bridge 在命令成功后本地合成出来的，不是来自真实 Web SDK callback。",
        "- `vendor_no_real_api`：当前 bundled/vendor Web SDK 没有对应公开 API，或运行时找不到可调用方法。",
        "- `callback_path_not_wired`：真实 SDK / 消息可能存在，但当前 Web real adapter 没把真实 callback 流接出来。",
        "",
    ]

    for category in (
        "adapter_local_stub",
        "local_bridge_synthesized_event",
        "vendor_no_real_api",
        "callback_path_not_wired",
    ):
        entries = groups.get(category, [])
        lines.extend(
            [
                f"## {_category_title(category)}",
                "",
                f"- 数量：{len(entries)}",
                "",
            ]
        )
        for entry in entries:
            lines.append(f"### `{entry['manager']}.{entry['api']}`")
            lines.append(f"- 状态：`{entry['status']}`")
            lines.append(
                f"- 原因：{resolve_reason_zh(entry, 'status')}"
            )
            tests = entry["tests"] or []
            if tests:
                lines.append("- 用例：")
                for test in tests:
                    lines.append(f"  - `{test}`")
            verified_by = entry["verified_by"] or []
            if verified_by:
                lines.append("- 验证方式：")
                for item in verified_by:
                    lines.append(f"  - `{item}`")
            lines.append("")

    lines.extend(
        [
            "## 已 Blocked 但不在主审计清单中",
            "",
            "下面这些项当前也是 `blocked`，但它们不属于“没有真实 API”这一类，通常是：",
            "- 已经存在真实调用，但行为不满足 Flutter 契约；",
            "- 已经存在真实调用，但读回面/返回载荷不足以形成稳定闭环；",
            "- 环境权限问题，而不是 API 本身不存在。",
            "",
            f"- 数量：{len(excluded)}",
            "",
        ]
    )
    for entry in excluded:
        lines.append(
            f"- `{entry['manager']}.{entry['api']}`: "
            f"{resolve_reason_zh(entry, 'status')}"
        )
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--strict", action="store_true")
    args = parser.parse_args()

    manifest = load_real_manifest()
    output = markdown_report(manifest)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(output, encoding="utf-8")
    else:
        print(output, end="")

    if args.strict:
        errors = audit_classification_errors(manifest)
        if errors:
            for error in errors:
                print(error, file=sys.stderr)
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
