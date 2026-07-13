from pathlib import Path

import pytest


pytestmark = pytest.mark.no_global_login


def test_makefile_has_unified_e2e_targets():
    text = (Path(__file__).resolve().parents[2] / "Makefile").read_text()
    assert "e2e-prepare:" in text
    assert "e2e-run:" in text
    assert "e2e-api-coverage:" in text
    assert "e2e-full-run:" in text
    assert "android-real-sanity:" in text
    assert "android-complete-suite-audit:" in text
    assert "android-wrapper-274-plan:" in text
