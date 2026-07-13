"""Group 共享文件（正常 + 异常）。"""
from __future__ import annotations
from tests.case_steps import describe_case_steps

import os
import shlex
import subprocess
import time
import uuid
from pathlib import Path

import pytest

from src import Cmd
from tests.group.group_helpers import create_group, destroy_group, new_group_name


pytestmark = [pytest.mark.client, pytest.mark.group]


_NONEXISTENT_GROUP_ID = "nonexistent_group_999999"
_ANDROID_TEST_APP_PACKAGE = "com.easemob.im_flutter_test"
_ANDROID_APP_INTERNAL_E2E_DIR = f"/data/user/0/{_ANDROID_TEST_APP_PACKAGE}/files/e2e"
_ANDROID_APP_INTERNAL_E2E_REL_DIR = "files/e2e"


def _run_adb(*args: str, text: bool = True) -> subprocess.CompletedProcess:
    try:
        return subprocess.run(
            ["adb", *args],
            check=False,
            text=text,
            capture_output=True,
        )
    except FileNotFoundError:
        pytest.skip("adb is not installed or not on PATH for Android shared-file staging")


def _android_serial_for_device_a() -> str:
    configured = os.getenv("NATIVE_AUTO_TEST_ANDROID_SERIAL_DEVICEA") or os.getenv("ANDROID_SERIAL_DEVICEA")
    if configured:
        return configured
    pytest.skip(
        "Android shared-file positive flow requires an explicit deviceA serial "
        "(NATIVE_AUTO_TEST_ANDROID_SERIAL_DEVICEA or ANDROID_SERIAL_DEVICEA)"
    )


def _push_android_shared_file(serial: str, local_file: Path, file_name: str) -> str:
    mkdir = _run_adb(
        "-s",
        serial,
        "shell",
        "run-as",
        _ANDROID_TEST_APP_PACKAGE,
        "mkdir",
        "-p",
        _ANDROID_APP_INTERNAL_E2E_REL_DIR,
    )
    if mkdir.returncode != 0:
        raise AssertionError(
            f"adb mkdir failed for Android shared-file staging on {serial}: "
            f"stdout={mkdir.stdout!r}, stderr={mkdir.stderr!r}"
        )
    remote_rel_path = f"{_ANDROID_APP_INTERNAL_E2E_REL_DIR}/{file_name}"
    remote_path = f"{_ANDROID_APP_INTERNAL_E2E_DIR}/{file_name}"
    pushed = subprocess.run(
        [
            "adb",
            "-s",
            serial,
            "exec-in",
            "run-as",
            _ANDROID_TEST_APP_PACKAGE,
            "sh",
            "-c",
            f"cat > {shlex.quote(remote_rel_path)}",
        ],
        input=local_file.read_bytes(),
        check=False,
        capture_output=True,
    )
    if pushed.returncode != 0:
        raise AssertionError(
            f"adb run-as file staging failed for explicit deviceA serial {serial}: "
            f"stdout={pushed.stdout!r}, stderr={pushed.stderr!r}"
        )
    return remote_path


def _read_android_file(serial: str, remote_path: str) -> bytes:
    if remote_path.startswith(f"{_ANDROID_APP_INTERNAL_E2E_DIR}/"):
        rel_path = f"{_ANDROID_APP_INTERNAL_E2E_REL_DIR}/{remote_path.rsplit('/', 1)[-1]}"
        completed = _run_adb(
            "-s",
            serial,
            "exec-out",
            "run-as",
            _ANDROID_TEST_APP_PACKAGE,
            "cat",
            rel_path,
            text=False,
        )
    else:
        completed = _run_adb("-s", serial, "exec-out", "cat", remote_path, text=False)
    if completed.returncode != 0:
        raise AssertionError(
            f"下载文件不存在或不可读: path={remote_path}, "
            f"stdout={completed.stdout!r}, stderr={completed.stderr!r}"
        )
    return completed.stdout


def _group_file_list(device, assert_api, group_id: str) -> list[dict]:
    expected_device = getattr(device, "name", "deviceA")
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
            "device": expected_device,
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
@pytest.mark.case_id("group.shared_file.upload_list_download_remove.success")
@pytest.mark.api("GroupManager.uploadGroupSharedFile")
@pytest.mark.api("GroupManager.getGroupFileListFromServer")
@pytest.mark.api("GroupManager.downloadGroupSharedFile")
@pytest.mark.api("GroupManager.removeGroupSharedFile")
def test_group_shared_file_upload_list_download_remove_positive_flow(
    device_a,
    assert_api,
    user_a,
    target_platform,
    tmp_path,
):
    """
    1. 在已登录的 Android 共享 session 中准备群组查询/拉取场景所需的测试数据，场景为群组、shared、file、upload、列表、download、移除、positive；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.uploadGroupSharedFile、GroupManager.getGroupFileListFromServer、GroupManager.downloadGroupSharedFile、GroupManager.removeGroupSharedFile，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组查询/拉取场景所需的测试数据，场景为群组、shared、file、upload、列表、download、移除、positive；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.uploadGroupSharedFile、GroupManager.getGroupFileListFromServer、GroupManager.downloadGroupSharedFile、GroupManager.removeGroupSharedFile，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回列表、对象字段、本地状态或服务端状态符合预期。'
    )
    if target_platform != "android":
        pytest.skip("Android shared-file positive flow requires Android file staging")

    group_id = ""
    file_name = f"group-shared-{uuid.uuid4().hex}.txt"
    local_file = tmp_path / file_name
    content = f"group-shared-file-content-{uuid.uuid4().hex}\n"
    local_file.write_text(content, encoding="utf-8")
    android_serial = _android_serial_for_device_a()
    remote_file_path = _push_android_shared_file(android_serial, local_file, file_name)
    download_path = f"{_ANDROID_APP_INTERNAL_E2E_DIR}/downloaded-{file_name}"

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
        downloaded_content = _read_android_file(android_serial, download_path)
        assert downloaded_content == content.encode(), (
            f"下载文件内容不匹配: savePath={download_path}, expected={content!r}, actual={downloaded_content!r}"
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


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
def test_group_upload_shared_file_current_invalid_file_behavior(topology_primary_or_device_a, assert_api, user_a):
    """
    1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、upload、shared、file、current、无效参数、file、behavior；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.uploadGroupSharedFile，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、upload、shared、file、current、无效参数、file、behavior；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.uploadGroupSharedFile，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    client = topology_primary_or_device_a
    group_id = ""
    try:
        group_id, _ = create_group(
            client,
            assert_api,
            owner=user_a,
            group_name=new_group_name("shared_file_upload"),
            invite_members=[],
        )

        tmp_file = Path("/private/tmp/group_shared_upload_auto.txt")
        tmp_file.write_text("group-shared-file-content", encoding="utf-8")

        resp_upload = client.call(
            "GroupManager",
            Cmd.uploadGroupSharedFile.value,
            info={"groupId": group_id, "filePath": str(tmp_file)},
        )
        assert_api.assert_error(resp_upload, code=401, description="Invalid file")
    finally:
        if group_id:
            destroy_group(client, assert_api, group_id)


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
def test_group_upload_shared_file_nonexistent_group(topology_primary_or_device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、upload、shared、file、不存在对象、群组；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.uploadGroupSharedFile，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、upload、shared、file、不存在对象、群组；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.uploadGroupSharedFile，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp = topology_primary_or_device_a.call(
        "GroupManager",
        Cmd.uploadGroupSharedFile.value,
        info={"groupId": _NONEXISTENT_GROUP_ID, "filePath": "/private/tmp/x.txt"},
    )
    assert_api.assert_error(resp, code=600, description="do not find this group")


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
def test_group_download_shared_file_nonexistent_group(topology_primary_or_device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、download、shared、file、不存在对象、群组；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.downloadGroupSharedFile，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、download、shared、file、不存在对象、群组；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.downloadGroupSharedFile，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp = topology_primary_or_device_a.call(
        "GroupManager",
        Cmd.downloadGroupSharedFile.value,
        info={"groupId": _NONEXISTENT_GROUP_ID, "fileId": "1", "savePath": "/private/tmp"},
    )
    assert_api.assert_error(resp, code=600, description="do not find this group")


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
def test_group_remove_shared_file_nonexistent_group(topology_primary_or_device_a, assert_api):
    """
    1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、移除、shared、file、不存在对象、群组；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.removeGroupSharedFile，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、移除、shared、file、不存在对象、群组；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.removeGroupSharedFile，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    resp = topology_primary_or_device_a.call(
        "GroupManager",
        Cmd.removeGroupSharedFile.value,
        info={"groupId": _NONEXISTENT_GROUP_ID, "fileId": "1"},
    )
    assert_api.assert_error(resp, code=600, description="do not find this group")


@pytest.mark.real_e2e
@pytest.mark.e2e_flow("error_response")
@pytest.mark.topology_ready
def test_group_upload_shared_file_invalid_path(topology_primary_or_device_a, assert_api, user_a):
    """
    1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、upload、shared、file、无效参数、path；
    2. 通过 WebSocket 控制测试 App 调用 GroupManager.uploadGroupSharedFile，使用当前 case 定义的参数执行真实 SDK 请求；
    3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。
    """
    describe_case_steps(
        '1. 在已登录的 Android 共享 session 中准备群组异常/边界场景所需的测试数据，场景为群组、upload、shared、file、无效参数、path；\n'
        '2. 通过 WebSocket 控制测试 App 调用 GroupManager.uploadGroupSharedFile，使用当前 case 定义的参数执行真实 SDK 请求；\n'
        '3. 校验返回错误码、错误描述和响应信封符合 Android 当前 SDK 行为。'
    )
    client = topology_primary_or_device_a
    group_id = ""
    try:
        group_id, _ = create_group(
            client,
            assert_api,
            owner=user_a,
            group_name=new_group_name("shared_file_invalid"),
            invite_members=[],
        )
        resp = client.call(
            "GroupManager",
            Cmd.uploadGroupSharedFile.value,
            info={"groupId": group_id, "filePath": "/private/tmp/this_file_should_not_exist_123456789.txt"},
        )
        assert_api.assert_error(resp, code=401, description="Invalid file")
    finally:
        if group_id:
            destroy_group(client, assert_api, group_id)
