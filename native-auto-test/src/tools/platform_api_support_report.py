"""Generate a static Android/iOS/Web API support report.

The report uses the real Web E2E manifest as the shared API baseline and
cross-checks Android/iOS wrapper usage for the same API names.
"""

from __future__ import annotations

import argparse
import html
import json
import re
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml


ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = ROOT.parent
WEB_REAL_MANIFEST = ROOT / "config" / "web_real_e2e_coverage.yaml"
ANDROID_METHOD_KEYS = REPO_ROOT / "im_flutter_sdk_android/android/src/main/java/com/easemob/im_flutter_sdk/MethodKey.java"
ANDROID_WRAPPERS = REPO_ROOT / "im_flutter_sdk_android/android/src/main/java/com/easemob/im_flutter_sdk"
IOS_METHOD_KEYS = REPO_ROOT / "im_flutter_sdk_ios/ios/Classes/MethodKeys.h"
IOS_WRAPPERS = REPO_ROOT / "im_flutter_sdk_ios/ios/Classes"


@dataclass(frozen=True)
class PlatformStatus:
    status: str
    reason_type: str
    reason: str


@dataclass(frozen=True)
class ApiRow:
    manager: str
    api: str
    android: PlatformStatus
    ios: PlatformStatus
    web: PlatformStatus
    web_tests: tuple[str, ...]


def _read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="ignore")


def _load_web_manifest() -> dict[str, Any]:
    with WEB_REAL_MANIFEST.open(encoding="utf-8") as f:
        return yaml.safe_load(f) or {"web_real_e2e": {}}


def _android_key_map() -> dict[str, str]:
    text = _read_text(ANDROID_METHOD_KEYS)
    return {
        value: field
        for field, value in re.findall(
            r"static\s+final\s+String\s+(\w+)\s*=\s*['\"]([^'\"]+)['\"]",
            text,
        )
    }


def _ios_key_map() -> dict[str, str]:
    text = _read_text(IOS_METHOD_KEYS)
    return {
        value: field
        for field, value in re.findall(
            r"static\s+NSString\s+\*const\s+(\w+)\s*=\s*@['\"]([^'\"]+)['\"]",
            text,
        )
    }


def _combined_source(root: Path, suffixes: tuple[str, ...]) -> str:
    chunks: list[str] = []
    for path in sorted(root.glob("*")):
        if path.is_file() and path.suffix in suffixes:
            chunks.append(_read_text(path))
    return "\n".join(chunks)


def _native_status(api: str, key_map: dict[str, str], source: str, platform: str) -> PlatformStatus:
    key = key_map.get(api)
    if not key:
        return PlatformStatus(
            status="missing",
            reason_type="未找到 API",
            reason=f"{platform} MethodKey 中未找到 `{api}` 对应常量。",
        )
    if key not in source:
        return PlatformStatus(
            status="unimplemented",
            reason_type="找到但未实现",
            reason=f"{platform} 已声明 `{api}` 常量 `{key}`，但 wrapper 实现中未引用。",
        )
    return PlatformStatus(
        status="supported",
        reason_type="支持",
        reason=f"{platform} wrapper 已引用 `{key}`。",
    )


def _web_reason_text(info: dict[str, Any]) -> str:
    return str(info.get("reason_zh") or info.get("reason") or "").strip()


def _classify_web_blocked(reason: str) -> str:
    lower = reason.lower()
    not_found_terms = (
        "does not expose",
        "not expose",
        "no real web sdk",
        "no public",
        "not available",
        "missing",
        "未暴露",
        "没有暴露",
        "没有公开",
        "无公开",
        "找不到",
        "未找到",
    )
    implemented_failed_terms = (
        "failed",
        "error",
        "permission",
        "no permission",
        "does not satisfy",
        "does not receive",
        "no callback",
        "执行未通过",
        "失败",
        "报错",
        "权限",
        "没有收到",
        "未收到",
        "不满足",
        "返回",
    )
    local_only_terms = (
        "local",
        "bridge",
        "not wired",
        "no stable",
        "没有稳定",
        "本地",
        "未接",
        "未透传",
        "合成",
    )
    if any(term in lower for term in not_found_terms):
        return "未找到 API"
    if any(term in lower for term in implemented_failed_terms):
        return "已实现但未通过"
    if any(term in lower for term in local_only_terms):
        return "找到但未实现"
    return "待确认"


def _web_status(info: dict[str, Any]) -> PlatformStatus:
    status = str(info.get("real_e2e_status") or "pending")
    reason = _web_reason_text(info)
    if status == "supported":
        return PlatformStatus("supported", "支持", "Web 真实 E2E 已通过。")
    if status == "not_applicable":
        return PlatformStatus("not_applicable", "Web 不适用", reason or "浏览器 Web 场景不适用。")
    if status == "blocked":
        return PlatformStatus("blocked", _classify_web_blocked(reason), reason or "Web 真实 E2E blocked。")
    return PlatformStatus("pending", "待确认", reason or "尚未完成最终定性。")


def _iter_rows() -> list[ApiRow]:
    manifest = _load_web_manifest()
    android_keys = _android_key_map()
    ios_keys = _ios_key_map()
    android_source = _combined_source(ANDROID_WRAPPERS, (".java",))
    ios_source = _combined_source(IOS_WRAPPERS, (".m", ".h"))

    rows: list[ApiRow] = []
    for manager, commands in sorted((manifest.get("web_real_e2e") or {}).items()):
        for api, info in sorted(commands.items()):
            if not isinstance(info, dict):
                info = {}
            rows.append(
                ApiRow(
                    manager=manager,
                    api=api,
                    android=_native_status(api, android_keys, android_source, "Android"),
                    ios=_native_status(api, ios_keys, ios_source, "iOS"),
                    web=_web_status(info),
                    web_tests=tuple(str(item) for item in info.get("tests", []) if item),
                )
            )
    return rows


def _platform_count(rows: list[ApiRow], attr: str) -> Counter[str]:
    return Counter(getattr(row, attr).status for row in rows)


def _status_badge(status: PlatformStatus) -> str:
    labels = {
        "supported": "支持",
        "blocked": "未通过",
        "not_applicable": "不适用",
        "pending": "待确认",
        "missing": "未找到",
        "unimplemented": "未实现",
    }
    label = labels.get(status.status, status.status)
    return f'<span class="badge {html.escape(status.status)}">{html.escape(label)}</span>'


def _reason_cell(row: ApiRow) -> str:
    parts: list[str] = []
    for label, status in (("Android", row.android), ("iOS", row.ios), ("Web", row.web)):
        if status.status == "supported":
            continue
        parts.append(
            '<div class="reason-item">'
            f'<strong>{html.escape(label)}：{html.escape(status.reason_type)}</strong>'
            f'<span>{html.escape(status.reason)}</span>'
            "</div>"
        )
    if not parts:
        return '<span class="muted">三端均支持。</span>'
    return "".join(parts)


def _tests_cell(row: ApiRow) -> str:
    if not row.web_tests:
        return '<span class="muted">-</span>'
    items = "".join(f"<li>{html.escape(test)}</li>" for test in row.web_tests)
    return f"<ul>{items}</ul>"


def _summary_cards(rows: list[ApiRow]) -> str:
    android = _platform_count(rows, "android")
    ios = _platform_count(rows, "ios")
    web = _platform_count(rows, "web")
    cards = [
        ("全部 API", len(rows), "Dart/Web coverage 基准清单"),
        ("Android 支持", android.get("supported", 0), f"未找到 {android.get('missing', 0)} / 未实现 {android.get('unimplemented', 0)}"),
        ("iOS 支持", ios.get("supported", 0), f"未找到 {ios.get('missing', 0)} / 未实现 {ios.get('unimplemented', 0)}"),
        ("Web 支持", web.get("supported", 0), f"blocked {web.get('blocked', 0)} / 不适用 {web.get('not_applicable', 0)} / pending {web.get('pending', 0)}"),
    ]
    return "".join(
        '<section class="card">'
        f'<div class="card-value">{value}</div>'
        f'<div class="card-title">{html.escape(title)}</div>'
        f'<div class="card-note">{html.escape(note)}</div>'
        "</section>"
        for title, value, note in cards
    )


def _manager_options(rows: list[ApiRow]) -> str:
    managers = sorted({row.manager for row in rows})
    return "".join(f'<option value="{html.escape(manager)}">{html.escape(manager)}</option>' for manager in managers)


def _reason_options(rows: list[ApiRow]) -> str:
    reasons = sorted(
        {
            status.reason_type
            for row in rows
            for status in (row.android, row.ios, row.web)
            if status.reason_type != "支持"
        }
    )
    return "".join(f'<option value="{html.escape(reason)}">{html.escape(reason)}</option>' for reason in reasons)


def _table_rows(rows: list[ApiRow]) -> str:
    output: list[str] = []
    for row in rows:
        search_blob = " ".join(
            [
                row.manager,
                row.api,
                row.android.reason_type,
                row.android.reason,
                row.ios.reason_type,
                row.ios.reason,
                row.web.reason_type,
                row.web.reason,
                " ".join(row.web_tests),
            ]
        ).lower()
        output.append(
            "<tr "
            f'data-manager="{html.escape(row.manager)}" '
            f'data-android="{html.escape(row.android.status)}" '
            f'data-ios="{html.escape(row.ios.status)}" '
            f'data-web="{html.escape(row.web.status)}" '
            f'data-reasons="{html.escape(json.dumps([row.android.reason_type, row.ios.reason_type, row.web.reason_type], ensure_ascii=False))}" '
            f'data-search="{html.escape(search_blob)}">'
            f"<td>{html.escape(row.manager)}</td>"
            f"<td><code>{html.escape(row.api)}</code></td>"
            f"<td>{_status_badge(row.android)}</td>"
            f"<td>{_status_badge(row.ios)}</td>"
            f"<td>{_status_badge(row.web)}</td>"
            f"<td>{_reason_cell(row)}</td>"
            f"<td>{_tests_cell(row)}</td>"
            "</tr>"
        )
    return "\n".join(output)


def render_html(rows: list[ApiRow]) -> str:
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Android / iOS / Web API 支持矩阵</title>
  <style>
    :root {{
      color-scheme: light;
      --bg: #f6f7f9;
      --panel: #ffffff;
      --text: #17202a;
      --muted: #637083;
      --line: #d9dee7;
      --green: #147a4b;
      --green-bg: #e6f5ed;
      --red: #a12b2b;
      --red-bg: #fae7e7;
      --amber: #8a5a00;
      --amber-bg: #fff1cc;
      --gray: #56616f;
      --gray-bg: #eef1f5;
      --blue: #2459a6;
      --blue-bg: #e7effc;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font: 14px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }}
    header {{
      padding: 24px 28px 12px;
      border-bottom: 1px solid var(--line);
      background: var(--panel);
    }}
    h1 {{
      margin: 0 0 8px;
      font-size: 24px;
      font-weight: 680;
      letter-spacing: 0;
    }}
    .subtitle {{
      margin: 0;
      color: var(--muted);
      max-width: 980px;
    }}
    main {{ padding: 18px 28px 32px; }}
    .cards {{
      display: grid;
      grid-template-columns: repeat(4, minmax(160px, 1fr));
      gap: 12px;
      margin-bottom: 16px;
    }}
    .card {{
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 14px 16px;
    }}
    .card-value {{ font-size: 26px; font-weight: 700; }}
    .card-title {{ font-weight: 650; margin-top: 2px; }}
    .card-note {{ color: var(--muted); margin-top: 4px; font-size: 12px; }}
    .toolbar {{
      display: grid;
      grid-template-columns: minmax(220px, 1.5fr) repeat(5, minmax(130px, 1fr));
      gap: 10px;
      padding: 12px;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      margin-bottom: 14px;
    }}
    input, select {{
      width: 100%;
      height: 36px;
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 0 10px;
      background: #fff;
      color: var(--text);
      font: inherit;
    }}
    .table-wrap {{
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      overflow: auto;
    }}
    table {{
      width: 100%;
      min-width: 1180px;
      border-collapse: collapse;
    }}
    th, td {{
      padding: 10px 12px;
      border-bottom: 1px solid var(--line);
      vertical-align: top;
      text-align: left;
    }}
    th {{
      position: sticky;
      top: 0;
      background: #f9fafc;
      z-index: 1;
      font-size: 12px;
      color: #3b4655;
      user-select: none;
      cursor: pointer;
    }}
    tr.hidden {{ display: none; }}
    code {{
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
    }}
    .badge {{
      display: inline-flex;
      align-items: center;
      min-height: 24px;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 650;
      white-space: nowrap;
    }}
    .supported {{ color: var(--green); background: var(--green-bg); }}
    .blocked, .missing, .unimplemented {{ color: var(--red); background: var(--red-bg); }}
    .not_applicable {{ color: var(--gray); background: var(--gray-bg); }}
    .pending {{ color: var(--amber); background: var(--amber-bg); }}
    .reason-item {{ margin-bottom: 8px; }}
    .reason-item:last-child {{ margin-bottom: 0; }}
    .reason-item strong {{ display: block; margin-bottom: 2px; }}
    .reason-item span {{ color: var(--muted); }}
    .muted {{ color: var(--muted); }}
    ul {{ margin: 0; padding-left: 18px; }}
    .count-line {{
      margin: 8px 0 12px;
      color: var(--muted);
    }}
    @media (max-width: 1100px) {{
      .cards {{ grid-template-columns: repeat(2, minmax(160px, 1fr)); }}
      .toolbar {{ grid-template-columns: repeat(2, minmax(160px, 1fr)); }}
    }}
  </style>
</head>
<body>
  <header>
    <h1>Android / iOS / Web API 支持矩阵</h1>
    <p class="subtitle">以 Web real E2E coverage 的 API 清单为基准；Android/iOS 通过 MethodKey 与 wrapper 引用扫描判断是否暴露实现；Web 采用真实 WebSDK2 / 服务 E2E 状态。</p>
  </header>
  <main>
    <div class="cards">{_summary_cards(rows)}</div>
    <div class="toolbar">
      <input id="search" placeholder="搜索 Manager、API、原因、case">
      <select id="manager"><option value="">全部 Manager</option>{_manager_options(rows)}</select>
      <select id="android"><option value="">Android 全部</option><option value="supported">支持</option><option value="missing">未找到</option><option value="unimplemented">未实现</option></select>
      <select id="ios"><option value="">iOS 全部</option><option value="supported">支持</option><option value="missing">未找到</option><option value="unimplemented">未实现</option></select>
      <select id="web"><option value="">Web 全部</option><option value="supported">支持</option><option value="blocked">未通过</option><option value="not_applicable">不适用</option><option value="pending">待确认</option></select>
      <select id="reason"><option value="">全部原因</option>{_reason_options(rows)}</select>
    </div>
    <div class="count-line"><span id="visible-count">{len(rows)}</span> / {len(rows)} 条 API</div>
    <div class="table-wrap">
      <table id="matrix">
        <thead>
          <tr>
            <th data-key="manager">Manager</th>
            <th data-key="api">API</th>
            <th data-key="android">Android</th>
            <th data-key="ios">iOS</th>
            <th data-key="web">Web</th>
            <th data-key="reason">未支持原因 / 备注</th>
            <th data-key="tests">Web case</th>
          </tr>
        </thead>
        <tbody>
          {_table_rows(rows)}
        </tbody>
      </table>
    </div>
  </main>
  <script>
    const controls = ["search", "manager", "android", "ios", "web", "reason"].map(id => document.getElementById(id));
    const rows = Array.from(document.querySelectorAll("#matrix tbody tr"));
    const visibleCount = document.getElementById("visible-count");
    function matches(row) {{
      const search = document.getElementById("search").value.trim().toLowerCase();
      const manager = document.getElementById("manager").value;
      const android = document.getElementById("android").value;
      const ios = document.getElementById("ios").value;
      const web = document.getElementById("web").value;
      const reason = document.getElementById("reason").value;
      if (search && !row.dataset.search.includes(search)) return false;
      if (manager && row.dataset.manager !== manager) return false;
      if (android && row.dataset.android !== android) return false;
      if (ios && row.dataset.ios !== ios) return false;
      if (web && row.dataset.web !== web) return false;
      if (reason) {{
        const reasons = JSON.parse(row.dataset.reasons || "[]");
        if (!reasons.includes(reason)) return false;
      }}
      return true;
    }}
    function applyFilters() {{
      let count = 0;
      rows.forEach(row => {{
        const ok = matches(row);
        row.classList.toggle("hidden", !ok);
        if (ok) count += 1;
      }});
      visibleCount.textContent = String(count);
    }}
    controls.forEach(control => control.addEventListener("input", applyFilters));
    let sortState = {{ key: "manager", dir: 1 }};
    document.querySelectorAll("th[data-key]").forEach(th => {{
      th.addEventListener("click", () => {{
        const key = th.dataset.key;
        sortState.dir = sortState.key === key ? -sortState.dir : 1;
        sortState.key = key;
        const index = Array.from(th.parentElement.children).indexOf(th);
        const tbody = document.querySelector("#matrix tbody");
        rows.sort((a, b) => a.children[index].innerText.localeCompare(b.children[index].innerText, "zh-CN") * sortState.dir);
        rows.forEach(row => tbody.appendChild(row));
      }});
    }});
  </script>
</body>
</html>
"""


def render_csv(rows: list[ApiRow]) -> str:
    lines = ["manager,api,android,ios,web,android_reason,ios_reason,web_reason"]
    for row in rows:
        values = [
            row.manager,
            row.api,
            row.android.status,
            row.ios.status,
            row.web.status,
            row.android.reason,
            row.ios.reason,
            row.web.reason,
        ]
        escaped = [f'"{str(value).replace(chr(34), chr(34) + chr(34))}"' for value in values]
        lines.append(",".join(escaped))
    return "\n".join(lines) + "\n"


def print_summary(rows: list[ApiRow]) -> None:
    print(f"total: {len(rows)}")
    for name in ("android", "ios", "web"):
        counts = _platform_count(rows, name)
        detail = ", ".join(f"{key}: {counts[key]}" for key in sorted(counts))
        print(f"{name}: {detail}")
    web_reason_counts: dict[str, int] = defaultdict(int)
    for row in rows:
        if row.web.status != "supported":
            web_reason_counts[row.web.reason_type] += 1
    if web_reason_counts:
        detail = ", ".join(f"{key}: {web_reason_counts[key]}" for key in sorted(web_reason_counts))
        print(f"web unsupported reasons: {detail}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        type=Path,
        default=ROOT / "out/platform-api-support.html",
        help="HTML output path.",
    )
    parser.add_argument("--csv-output", type=Path, help="Optional CSV output path.")
    args = parser.parse_args()

    rows = _iter_rows()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(render_html(rows), encoding="utf-8")
    if args.csv_output:
        args.csv_output.parent.mkdir(parents=True, exist_ok=True)
        args.csv_output.write_text(render_csv(rows), encoding="utf-8")
    print_summary(rows)
    print(f"html: {args.output}")
    if args.csv_output:
        print(f"csv: {args.csv_output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
