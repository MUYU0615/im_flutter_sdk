from __future__ import annotations

import csv
import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class CaseResult:
    run_id: str
    nodeid: str
    case_id: str
    api: str
    manager: str
    method_key: str
    outcome: str
    duration: float
    failure_summary: str


def marker_value(item: Any, name: str) -> str:
    marker = item.get_closest_marker(name)
    if not marker or not marker.args:
        return ""
    return str(marker.args[0])


def split_api(api: str) -> tuple[str, str]:
    if "." not in api:
        return "", api
    manager, method_key = api.split(".", 1)
    return manager, method_key


def write_case_results(results: list[CaseResult], json_path: Path, csv_path: Path) -> None:
    json_path.parent.mkdir(parents=True, exist_ok=True)
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    rows = [asdict(result) for result in results]
    json_path.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    with csv_path.open("w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=list(CaseResult.__dataclass_fields__))
        writer.writeheader()
        writer.writerows(rows)
