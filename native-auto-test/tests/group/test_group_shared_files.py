"""Group 共享文件（正常 + 异常）。"""
from __future__ import annotations

import os
import subprocess
import time
import uuid
from pathlib import Path

import pytest

from src import Cmd
from tests.group.group_helpers import create_group, destroy_group, new_group_name


pytestmark = [pytest.mark.client, pytest.mark.group]


_NONEXISTENT_GROUP_ID = "nonexistent_group_999999"


def _run_adb(*args: str) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(
            ["adb", *args],
            check=False,
            text=True,
            capture_output=True,
        )
    except FileNotFoundError:
        pytest.skip("adb is not installed or not on PATH for Android shared-file staging")


def _android_serial() -> str:
    configured = os.getenv("ANDROID_SERIAL")
    if configured:
        return configured
    devices = _run_adb("devices")
    if devices.returncode != 0:
        pytest.skip(f"adb devices failed: {devices.stderr.strip() or devices.stdout.strip()}")
    for line in devices.stdout.splitlines()[1:]:
        parts = line.split()
        if len(parts) >= 2 and parts[1] == "device":
            return parts[0]
    pytest.skip("No online Android device available for shared-file staging")


def _push_android_shared_file(local_file: Path, file_name: str) -> str:
    serial = _android_serial()
    remote_path = f"/sdcard/Download/{file_name}"
    pushed = _run_adb("-s", serial, "push", str(local_file), remote_path)
    if pushed.returncode != 0:
        pytest.skip(f"adb push failed: {pushed.stderr.strip() or pushed.stdout.strip()}")
    return remote_path


def _group_file_list(device, assert_api, group_id: str) -> list[dict]:
    resp = device.call(
        "GroupManager",
        Cmd.getGroupFileListFromServer.value,
        info={"groupId": group_id, "pageNum": 1, "pageSize": 20},
    )
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "GroupManager",
            "cmd": Cmd.getGroupFileListFromServer.value,
            "device": "deviceA",
        },
        ignore_keys={"sequence", "result"},
    )
    result = resp.get("result")
    assert isinstance(result, list), f"getGroupFileListFromServer result 不是 list: {resp}"
    assert all(isinstance(item, dict) for item in result), f"共享文件列表元素不是 dict: {resp}"
    return result


def _find_shared_file(files: list[dict], *, file_name: str, before_ids: set[str | None]) -> dict | None:
    for item in files:
        file_id = item.get("fileId") or item.get("id")
        if item.get("name") == file_name and file_id not in before_ids:
            return item
    return None


@pytest.mark.android
@pytest.mark.real_e2e
def test_group_shared_file_upload_list_download_remove_positive_flow(
    device_a,
    assert_api,
    user_a,
    target_platform,
    tmp_path,
):
    if target_platform != "android":
        pytest.skip("Android shared-file positive flow requires Android file staging")

    group_id = ""
    file_name = f"group-shared-{uuid.uuid4().hex}.txt"
    local_file = tmp_path / file_name
    content = f"group-shared-file-content-{uuid.uuid4().hex}\n"
    local_file.write_text(content, encoding="utf-8")
    remote_file_path = _push_android_shared_file(local_file, file_name)
    download_path = f"/sdcard/Download/downloaded-{file_name}"

    try:
        group_id, _ = create_group(
            device_a,
            assert_api,
            owner=user_a,
            group_name=new_group_name("shared_file_flow"),
            invite_members=[],
        )

        before_files = _group_file_list(device_a, assert_api, group_id)
        before_ids = {
            item.get("fileId") or item.get("id")
            for item in before_files
        }

        resp_upload = device_a.call(
            "GroupManager",
            Cmd.uploadGroupSharedFile.value,
            info={"groupId": group_id, "filePath": remote_file_path},
        )
        assert_api.assert_response_matches(
            resp_upload,
            expected={
                "manager": "GroupManager",
                "cmd": Cmd.uploadGroupSharedFile.value,
                "device": "deviceA",
                "result": True,
            },
            ignore_keys={"sequence"},
        )

        shared_file = None
        for _ in range(6):
            files_after_upload = _group_file_list(device_a, assert_api, group_id)
            shared_file = _find_shared_file(files_after_upload, file_name=file_name, before_ids=before_ids)
            if shared_file is not None:
                break
            time.sleep(1.0)
        assert shared_file is not None, (
            f"上传后共享文件列表缺少 {file_name}: before={before_files!r}, after={files_after_upload!r}"
        )

        file_id = shared_file.get("fileId") or shared_file.get("id")
        assert isinstance(file_id, str) and file_id, f"共享文件缺少 fileId: {shared_file}"
        assert shared_file.get("name") == file_name, f"共享文件 name 不匹配: {shared_file}"
        assert shared_file.get("owner") == user_a, f"共享文件 owner 不匹配: {shared_file}"
        assert isinstance(shared_file.get("createTime"), int), f"共享文件 createTime 非 int: {shared_file}"
        file_size = shared_file.get("fileSize")
        assert isinstance(file_size, int) and file_size > 0, f"共享文件 fileSize 非正整数: {shared_file}"

        resp_download = device_a.call(
            "GroupManager",
            Cmd.downloadGroupSharedFile.value,
            info={"groupId": group_id, "fileId": file_id, "savePath": download_path},
        )
        assert_api.assert_response_matches(
            resp_download,
            expected={
                "manager": "GroupManager",
                "cmd": Cmd.downloadGroupSharedFile.value,
                "device": "deviceA",
                "result": True,
            },
            ignore_keys={"sequence"},
        )

        resp_remove = device_a.call(
            "GroupManager",
            Cmd.removeGroupSharedFile.value,
            info={"groupId": group_id, "fileId": file_id},
        )
        assert_api.assert_response_matches(
            resp_remove,
            expected={
                "manager": "GroupManager",
                "cmd": Cmd.removeGroupSharedFile.value,
                "device": "deviceA",
                "result": True,
            },
            ignore_keys={"sequence"},
        )

        files_after_remove = _group_file_list(device_a, assert_api, group_id)
        assert not any(
            (item.get("fileId") == file_id or item.get("id") == file_id)
            for item in files_after_remove
        ), f"删除后共享文件仍存在: file_id={file_id}, files={files_after_remove!r}"
    finally:
        if group_id:
            destroy_group(device_a, assert_api, group_id)


def test_group_upload_shared_file_current_invalid_file_behavior(device_a, assert_api, user_a):
    group_id = ""
    try:
        group_id, _ = create_group(
            device_a,
            assert_api,
            owner=user_a,
            group_name=new_group_name("shared_file_upload"),
            invite_members=[],
        )

        tmp_file = Path("/private/tmp/group_shared_upload_auto.txt")
        tmp_file.write_text("group-shared-file-content", encoding="utf-8")

        resp_upload = device_a.call(
            "GroupManager",
            Cmd.uploadGroupSharedFile.value,
            info={"groupId": group_id, "filePath": str(tmp_file)},
        )
        assert_api.assert_error(resp_upload, code=401, description="Invalid file")
    finally:
        if group_id:
            destroy_group(device_a, assert_api, group_id)


def test_group_upload_shared_file_nonexistent_group(device_a, assert_api):
    resp = device_a.call(
        "GroupManager",
        Cmd.uploadGroupSharedFile.value,
        info={"groupId": _NONEXISTENT_GROUP_ID, "filePath": "/private/tmp/x.txt"},
    )
    assert_api.assert_error(resp, code=600, description="do not find this group")


def test_group_download_shared_file_nonexistent_group_current_behavior(device_a, assert_api):
    resp = device_a.call(
        "GroupManager",
        Cmd.downloadGroupSharedFile.value,
        info={"groupId": _NONEXISTENT_GROUP_ID, "fileId": "1", "savePath": "/private/tmp"},
    )
    assert_api.assert_response_matches(
        resp,
        expected={
            "manager": "GroupManager",
            "cmd": Cmd.downloadGroupSharedFile.value,
            "device": "deviceA",
            "result": True,
        },
        ignore_keys={"sequence"},
    )


def test_group_remove_shared_file_nonexistent_group(device_a, assert_api):
    resp = device_a.call(
        "GroupManager",
        Cmd.removeGroupSharedFile.value,
        info={"groupId": _NONEXISTENT_GROUP_ID, "fileId": "1"},
    )
    assert_api.assert_error(resp, code=600, description="do not find this group")


def test_group_upload_shared_file_invalid_path(device_a, assert_api, user_a):
    group_id = ""
    try:
        group_id, _ = create_group(
            device_a,
            assert_api,
            owner=user_a,
            group_name=new_group_name("shared_file_invalid"),
            invite_members=[],
        )
        resp = device_a.call(
            "GroupManager",
            Cmd.uploadGroupSharedFile.value,
            info={"groupId": group_id, "filePath": "/private/tmp/this_file_should_not_exist_123456789.txt"},
        )
        assert_api.assert_error(resp, code=401, description="Invalid file")
    finally:
        if group_id:
            destroy_group(device_a, assert_api, group_id)
