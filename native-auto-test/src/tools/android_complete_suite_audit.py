from __future__ import annotations

import argparse
import ast
import csv
import html
import json
import os
import subprocess
import sys
import tempfile
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
DEFAULT_TEST_PATHS = (
    "tests/client",
    "tests/contact",
    "tests/chat",
    "tests/chatroom",
    "tests/group",
    "tests/presence",
    "tests/push",
    "tests/user_info",
)
DEVICE_FIXTURES = {
    "device",
    "device_a",
    "device_b",
    "device_c",
    "primary_device",
    "secondary_device",
    "ws_device",
    "api_device_a",
    "api_device_b",
}
SDK_CALL_NAMES = {"call", "request", "request_and_wait_for_event"}
NON_E2E_MARKERS = {"unit", "fixture", "wrapper_mapping", "capability", "no_global_login"}


@dataclass(frozen=True)
class SuiteAuditRow:
    nodeid: str
    path: str
    status: str
    should_include_android_complete: bool
    has_real_e2e_marker: bool
    markers: str
    fixtures: str
    reason_zh: str


class _SdkCallVisitor(ast.NodeVisitor):
    def __init__(self) -> None:
        self.found = False

    def visit_Call(self, node: ast.Call) -> None:
        func = node.func
        if isinstance(func, ast.Attribute) and func.attr in SDK_CALL_NAMES:
            self.found = True
        elif isinstance(func, ast.Name) and func.id in {"ws_request", "ws_request_and_wait_event"}:
            self.found = True
        self.generic_visit(node)


class _DynamicDeviceFixtureVisitor(ast.NodeVisitor):
    def __init__(self) -> None:
        self.found = False

    def visit_Call(self, node: ast.Call) -> None:
        func = node.func
        if (
            isinstance(func, ast.Attribute)
            and func.attr == "getfixturevalue"
            and node.args
            and isinstance(node.args[0], ast.Constant)
            and isinstance(node.args[0].value, str)
            and node.args[0].value in DEVICE_FIXTURES
        ):
            self.found = True
        self.generic_visit(node)


def is_sdk_e2e_candidate(source: str) -> bool:
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return any(token in source for token in (".call(", "ws_request(", "request_and_wait_for_event("))
    visitor = _SdkCallVisitor()
    visitor.visit(tree)
    return visitor.found


def uses_dynamic_device_fixture(source: str) -> bool:
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return any(f'getfixturevalue("{fixture}")' in source for fixture in DEVICE_FIXTURES)
    visitor = _DynamicDeviceFixtureVisitor()
    visitor.visit(tree)
    return visitor.found


def classify_case(
    *,
    nodeid: str,
    path: str,
    markers: set[str],
    fixtures: set[str],
    source: str,
) -> SuiteAuditRow:
    has_real = "real_e2e" in markers
    has_device = bool(fixtures & DEVICE_FIXTURES) or uses_dynamic_device_fixture(source)
    sdk_candidate = is_sdk_e2e_candidate(source)

    if has_real and has_device:
        status = "included_real_e2e"
        include = True
        reason = "已标记 real_e2e，且通过真实 device fixture 调用 SDK。"
    elif has_real:
        status = "real_e2e_marker_needs_review"
        include = True
        reason = "已标记 real_e2e，但未发现标准 device fixture，需要人工确认是否为真实 Android E2E。"
    elif markers & NON_E2E_MARKERS:
        status = "not_real_e2e"
        include = False
        reason = "标记为 unit/fixture/wrapper/capability/no_global_login，不纳入真实 Android E2E。"
    elif has_device and sdk_candidate:
        status = "missing_real_e2e_marker"
        include = True
        reason = "疑似真实 SDK E2E，但缺少 real_e2e marker。"
    elif sdk_candidate:
        status = "needs_review"
        include = False
        reason = "发现 SDK 调用痕迹，但缺少标准 device fixture，需要人工确认。"
    else:
        status = "not_real_e2e"
        include = False
        reason = "未发现真实 device fixture + SDK 调用证据。"

    return SuiteAuditRow(
        nodeid=nodeid,
        path=path,
        status=status,
        should_include_android_complete=include,
        has_real_e2e_marker=has_real,
        markers=";".join(sorted(markers)),
        fixtures=";".join(sorted(fixtures)),
        reason_zh=reason,
    )


def _source_for_item(path: str, name: str) -> str:
    file_path = ROOT / path
    if not file_path.exists():
        return ""
    source = file_path.read_text(encoding="utf-8")
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return source
    target_name = name.split("[", 1)[0]
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == target_name:
            return ast.get_source_segment(source, node) or ""
    return source


def build_rows(items: list[dict[str, Any]]) -> list[SuiteAuditRow]:
    rows: list[SuiteAuditRow] = []
    for item in items:
        path = str(item.get("path") or "")
        name = str(item.get("name") or "")
        rows.append(
            classify_case(
                nodeid=str(item.get("nodeid") or ""),
                path=path,
                markers=set(item.get("markers") or []),
                fixtures=set(item.get("fixtures") or []),
                source=_source_for_item(path, name),
            )
        )
    return rows


def write_reports(rows: list[SuiteAuditRow], csv_path: Path, html_path: Path) -> None:
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    html_path.parent.mkdir(parents=True, exist_ok=True)
    with csv_path.open("w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=list(SuiteAuditRow.__dataclass_fields__))
        writer.writeheader()
        writer.writerows(asdict(row) for row in rows)

    counts: dict[str, int] = {}
    for row in rows:
        counts[row.status] = counts.get(row.status, 0) + 1
    summary = "".join(f"<li>{html.escape(key)}: {value}</li>" for key, value in sorted(counts.items()))
    body_rows = "\n".join(
        "<tr>"
        f"<td>{html.escape(row.status)}</td>"
        f"<td>{html.escape(str(row.should_include_android_complete))}</td>"
        f"<td>{html.escape(row.nodeid)}</td>"
        f"<td>{html.escape(row.markers)}</td>"
        f"<td>{html.escape(row.fixtures)}</td>"
        f"<td>{html.escape(row.reason_zh)}</td>"
        "</tr>"
        for row in rows
    )
    html_path.write_text(
        "<!doctype html><html><head><meta charset='utf-8'><title>Android Complete E2E Suite Audit</title>"
        "<style>body{font-family:Arial,sans-serif;margin:24px}table{border-collapse:collapse;width:100%}"
        "td,th{border:1px solid #ddd;padding:6px;font-size:12px}th{background:#f4f4f4}</style></head><body>"
        "<h1>Android Complete E2E Suite Audit</h1>"
        f"<ul>{summary}</ul>"
        "<table><thead><tr><th>Status</th><th>Include</th><th>Nodeid</th><th>Markers</th><th>Fixtures</th><th>Reason</th></tr></thead>"
        f"<tbody>{body_rows}</tbody></table></body></html>",
        encoding="utf-8",
    )


def _collector_plugin_code(output_path: Path) -> str:
    return f"""
import json

def pytest_collection_finish(session):
    rows = []
    for item in session.items:
        rows.append({{
            "nodeid": item.nodeid,
            "path": str(item.path.relative_to(session.config.rootpath)),
            "name": item.name,
            "markers": sorted({{marker.name for marker in item.iter_markers()}}),
            "fixtures": sorted(set(getattr(item, "fixturenames", []) or [])),
        }})
    with open({str(output_path)!r}, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)
"""


def collect_items(test_paths: tuple[str, ...] = DEFAULT_TEST_PATHS) -> list[dict[str, Any]]:
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        items_json = tmp_path / "items.json"
        plugin = tmp_path / "collector_plugin.py"
        plugin.write_text(_collector_plugin_code(items_json), encoding="utf-8")
        env = os.environ.copy()
        env["PYTHONPATH"] = str(tmp_path) + os.pathsep + env.get("PYTHONPATH", "")
        command = [
            sys.executable,
            "-m",
            "pytest",
            "--collect-only",
            "-q",
            "-p",
            "collector_plugin",
            *test_paths,
            "--target-platform",
            "android",
        ]
        result = subprocess.run(command, cwd=ROOT, env=env, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if result.returncode not in (0, 5):
            raise RuntimeError(result.stdout + result.stderr)
        return json.loads(items_json.read_text(encoding="utf-8"))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Audit Android complete real E2E suite candidates.")
    parser.add_argument("--output-csv", default="out/android-complete-e2e-suite-audit.csv")
    parser.add_argument("--output-html", default="out/android-complete-e2e-suite-audit.html")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    rows = build_rows(collect_items())
    write_reports(rows, ROOT / args.output_csv, ROOT / args.output_html)
    counts: dict[str, int] = {}
    for row in rows:
        counts[row.status] = counts.get(row.status, 0) + 1
    print(json.dumps(counts, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
