from pathlib import Path

import pytest


pytestmark = pytest.mark.no_global_login


WRAPPER = (
    Path(__file__).resolve().parents[3]
    / "im_flutter_sdk_android/android/src/main/java/com/easemob/im_flutter_sdk/GroupManagerWrapper.java"
)


def _download_shared_file_method_body() -> str:
    text = WRAPPER.read_text(encoding="utf-8")
    start = text.index("private void downloadGroupSharedFile")
    end = text.index("private void removeGroupSharedFile", start)
    return text[start:end]


def test_download_group_shared_file_waits_for_sdk_callback_before_success():
    body = _download_shared_file_method_body()

    assert "public void onSuccess()" in body
    assert "onSuccess(result, channelName, true);" in body
    assert "public void onError(int code, String error)" in body
    assert "onError(result, e);" in body
    assert "post(()->" not in body

