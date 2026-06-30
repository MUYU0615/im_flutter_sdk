from __future__ import annotations

from pathlib import Path


def test_makefile_exposes_web_e2e_and_coverage_report_targets():
    makefile = Path("Makefile").read_text(encoding="utf-8")

    assert "web-e2e:" in makefile
    assert "web-wrapper-mapping:" in makefile
    assert "web-coverage-report:" in makefile
    assert "src.tools.web_e2e_runner" in makefile
    assert "src.tools.web_coverage_report" in makefile


def test_makefile_exposes_cross_platform_real_e2e_targets():
    makefile = Path("Makefile").read_text(encoding="utf-8")

    assert "android-real-e2e:" in makefile
    assert "ios-real-e2e:" in makefile
    assert "web-real-e2e:" in makefile
    assert "--target-platform android -m real_e2e" in makefile
    assert "--target-platform ios -m real_e2e" in makefile
    assert "--target-platform web -m real_e2e" in makefile
    assert "$(if $(ARGS),$(ARGS)," in makefile
