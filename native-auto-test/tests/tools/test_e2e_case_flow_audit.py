from pathlib import Path

import pytest
import yaml

from src.tools.topology_model import FLOW_REQUIREMENTS


@pytest.mark.no_global_login
def test_case_flow_inventory_uses_known_flows():
    data = yaml.safe_load(Path("config/e2e_case_flows.yaml").read_text(encoding="utf-8")) or {}

    assert data
    for nodeid, raw in data.items():
        assert "::" in nodeid
        assert raw["flow"] in FLOW_REQUIREMENTS
