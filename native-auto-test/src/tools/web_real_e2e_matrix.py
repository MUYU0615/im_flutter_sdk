"""校验并输出真实 Web SDK / 服务 E2E 覆盖矩阵。"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any

import yaml

from src.tools.web_doc_reason_summary import resolve_reason_zh
from src.tools.web_coverage import load_manifest


ROOT = Path(__file__).resolve().parents[2]
REAL_MANIFEST = ROOT / "config" / "web_real_e2e_coverage.yaml"
ALLOWED = {"supported", "not_applicable", "blocked", "pending"}


def load_real_manifest() -> dict[str, Any]:
    if not REAL_MANIFEST.exists():
        return {"web_real_e2e": {}}
    with REAL_MANIFEST.open(encoding="utf-8") as f:
        return yaml.safe_load(f) or {"web_real_e2e": {}}


def validate_real_manifest(manifest: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    root = manifest.get("web_real_e2e")
    if not isinstance(root, dict):
        return ["缺少 web_real_e2e 映射"]
    for manager, commands in root.items():
        if not isinstance(commands, dict):
            errors.append(f"{manager}: commands 必须是映射")
            continue
        for cmd, info in commands.items():
            if not isinstance(info, dict):
                errors.append(f"{manager}.{cmd}: info 必须是映射")
                continue
            status = info.get("real_e2e_status")
            if status not in ALLOWED:
                errors.append(f"{manager}.{cmd}: 非法 real_e2e_status {status!r}")
            tests = info.get("tests", [])
            if not isinstance(tests, list):
                errors.append(f"{manager}.{cmd}: tests 必须是列表")
            if status == "supported" and not tests:
                errors.append(f"{manager}.{cmd}: supported 必须填写 tests")
            verified_by = info.get("verified_by", [])
            if not isinstance(verified_by, list):
                errors.append(f"{manager}.{cmd}: verified_by 必须是列表")
            if status == "supported" and not verified_by:
                errors.append(f"{manager}.{cmd}: supported 必须填写 verified_by")
            reason = str(info.get("reason") or "").strip()
            if status in {"not_applicable", "blocked", "pending"} and not reason:
                errors.append(f"{manager}.{cmd}: {status} 必须填写 reason")
    return errors


def missing_real_e2e_entries() -> list[str]:
    bridge = load_manifest().get("web", {})
    real = load_real_manifest().get("web_real_e2e", {})
    missing: list[str] = []
    for manager, commands in bridge.items():
        real_commands = real.get(manager, {})
        for cmd in commands:
            if cmd not in real_commands:
                missing.append(f"{manager}.{cmd}")
    return sorted(missing)


def status_counts(manifest: dict[str, Any]) -> dict[str, int]:
    counts = {status: 0 for status in sorted(ALLOWED)}
    for commands in (manifest.get("web_real_e2e") or {}).values():
        for info in commands.values():
            status = str(info.get("real_e2e_status", "pending"))
            counts[status] = counts.get(status, 0) + 1
    return counts


def markdown_matrix(manifest: dict[str, Any]) -> str:
    lines = [
        "# Web 真实 E2E API 矩阵",
        "",
        "| Manager | API | 真实 E2E 状态 | 用例 | 验证方式 | 说明 |",
        "|---|---|---|---|---|---|",
    ]
    for manager, commands in sorted((manifest.get("web_real_e2e") or {}).items()):
        for cmd, info in sorted(commands.items()):
            tests = "<br>".join(info.get("tests") or [])
            verified_by = ", ".join(info.get("verified_by") or [])
            reason = resolve_reason_zh(info, "real_e2e_status").replace("|", "\\|")
            lines.append(
                f"| {manager} | {cmd} | {info.get('real_e2e_status')} | {tests} | {verified_by} | {reason} |"
            )
    return "\n".join(lines).rstrip() + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--strict", action="store_true")
    parser.add_argument("--markdown", action="store_true")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    manifest = load_real_manifest()
    errors = validate_real_manifest(manifest)
    missing = missing_real_e2e_entries()
    output = (
        markdown_matrix(manifest)
        if args.markdown
        else "\n".join(
            f"{status}: {count}" for status, count in status_counts(manifest).items()
        )
        + "\n"
    )
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(output, encoding="utf-8")
    else:
        print(output, end="")

    if errors or missing:
        for error in errors:
            print(f"manifest 错误: {error}", file=sys.stderr)
        for api in missing:
            print(f"缺少 real e2e 条目: {api}", file=sys.stderr)
        return 1 if args.strict else 0
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
