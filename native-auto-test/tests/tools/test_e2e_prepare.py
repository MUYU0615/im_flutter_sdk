from pathlib import Path

import pytest
import yaml

from src.tools.e2e_prepare import build_prepare_context, main


pytestmark = pytest.mark.no_global_login


def test_prepare_rejects_auto_device_mode():
    with pytest.raises(ValueError, match="第一阶段只支持 --device-mode existing"):
        build_prepare_context(
            client_args=["android:a@4.23.0"],
            sdk_version_args=[],
            output_root=Path("out"),
            device_mode="auto",
            matrix_mode="pair",
            install_mode="clean",
            account_mode="fresh",
            run_id="r1",
        )


def test_prepare_builds_context_for_existing_devices(tmp_path: Path):
    ctx = build_prepare_context(
        client_args=["android:a@4.23.0", "android:b@4.23.0"],
        sdk_version_args=[],
        output_root=tmp_path,
        device_mode="existing",
        matrix_mode="pair",
        install_mode="clean",
        account_mode="fresh",
        run_id="android-20260706-153000",
    )
    assert ctx.run_id == "android-20260706-153000"
    assert ctx.clients["a"].topic == "im-auto-android-20260706-153000-a"
    assert ctx.artifacts["case_results_json"].endswith("-case-results.json")


def test_prepare_main_writes_context(tmp_path: Path):
    code = main([
        "--client", "android:a@4.23.0",
        "--client", "android:b@4.23.0",
        "--output-root", str(tmp_path),
        "--run-id", "android-20260706-153000",
    ])
    assert code == 0
    path = tmp_path / "run" / "android-20260706-153000" / "context.yaml"
    data = yaml.safe_load(path.read_text())
    assert data["run_id"] == "android-20260706-153000"
