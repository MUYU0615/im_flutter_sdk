"""Web ChatManager media download regression cases."""

from __future__ import annotations

import contextlib
import threading
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest

from src import Cmd


pytestmark = [pytest.mark.web, pytest.mark.chat]


@contextlib.contextmanager
def _download_server(content: bytes, *, fail_paths: set[str] | None = None):
    hits: list[str] = []
    failed = fail_paths or set()

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            hits.append(self.path)
            if self.path in failed:
                self.send_response(500)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                return
            self.send_response(200)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)

        def log_message(self, format, *args):
            return

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield server, hits
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


def _message(
    *,
    from_user: str,
    to_user: str,
    body: dict,
    msg_id: str | None = None,
) -> dict:
    return {
        "from": from_user,
        "to": to_user,
        "chatType": 0,
        "direction": 0,
        "convId": to_user,
        "msgId": msg_id or f"web-media-{uuid.uuid4().hex[:8]}",
        "body": body,
        "hasReadAck": False,
        "needGroupAck": False,
        "isThread": False,
        "deliverOnlineOnly": False,
    }


def test_web_chat_media_downloads_request_remote_urls(
    primary_device,
    assert_api,
    require_capability,
    user_a,
    user_b,
):
    for cmd in (
        Cmd.downloadAttachment,
        Cmd.downloadBigImage,
        Cmd.downloadThumbnail,
        Cmd.onMessageProgress,
        Cmd.onMessageProgressUpdate,
    ):
        manager = "MessageManager" if cmd.name.startswith("on") else "ChatManager"
        require_capability(manager, cmd.value)

    primary_device.call("Client", Cmd.startCallback.value, info={})
    primary_device.drain_events(timeout=0.2)

    content = b"web media payload"
    with _download_server(content) as (server, hits):
        base_url = f"http://127.0.0.1:{server.server_port}"
        file_message = _message(
            from_user=user_a,
            to_user=user_b,
            body={
                "type": 2,
                "localPath": "",
                "displayName": "web-file.bin",
                "remotePath": f"{base_url}/attachment.bin",
                "fileStatus": 0,
                "fileSize": len(content),
            },
        )
        image_message = _message(
            from_user=user_a,
            to_user=user_b,
            body={
                "type": 1,
                "localPath": "",
                "displayName": "web-image.jpg",
                "remotePath": f"{base_url}/image.jpg",
                "thumbnailRemotePath": f"{base_url}/thumbnail.jpg",
                "fileStatus": 0,
                "thumbnailStatus": 0,
                "fileSize": len(content),
                "width": 100,
                "height": 100,
            },
        )

        attachment = primary_device.call(
            "ChatManager",
            Cmd.downloadAttachment.value,
            info={"message": file_message},
        )
        assert_api.assert_result_equals(attachment, None)
        progress_event = primary_device.receive_message(
            match_event_type=Cmd.onMessageProgress.value,
            timeout=5.0,
        )
        assert progress_event is not None
        assert progress_event.get("eventType") == Cmd.onMessageProgress.value
        progress_data = progress_event.get("data")
        assert isinstance(progress_data, dict)
        assert progress_data.get("operation") == "message_progress"
        assert progress_data.get("localId") == file_message["msgId"]
        assert progress_data.get("progress") == 100

        progress_update_event = primary_device.receive_message(
            match_event_type=Cmd.onMessageProgressUpdate.value,
            timeout=5.0,
        )
        assert progress_update_event is not None
        assert progress_update_event.get("eventType") == Cmd.onMessageProgressUpdate.value
        progress_update_data = progress_update_event.get("data")
        assert isinstance(progress_update_data, dict)
        assert progress_update_data.get("operation") == "message_progress_update"
        assert progress_update_data.get("localId") == file_message["msgId"]
        assert progress_update_data.get("progress") == 100

        big_image = primary_device.call(
            "ChatManager",
            Cmd.downloadBigImage.value,
            info={"message": image_message},
        )
        assert_api.assert_result_equals(big_image, None)

        thumbnail = primary_device.call(
            "ChatManager",
            Cmd.downloadThumbnail.value,
            info={"message": image_message},
        )
        assert_api.assert_result_equals(thumbnail, None)

        assert "/attachment.bin" in hits
        assert "/image.jpg" in hits
        assert "/thumbnail.jpg" in hits


def test_web_chat_media_download_error_emits_message_error(
    primary_device,
    require_capability,
    user_a,
    user_b,
):
    require_capability("ChatManager", Cmd.downloadAttachment.value)
    require_capability("MessageManager", Cmd.onMessageError.value)

    primary_device.call("Client", Cmd.startCallback.value, info={})
    primary_device.drain_events(timeout=0.2)

    with _download_server(b"", fail_paths={"/missing.bin"}) as (server, hits):
        message = _message(
            from_user=user_a,
            to_user=user_b,
            body={
                "type": 2,
                "localPath": "",
                "displayName": "missing.bin",
                "remotePath": f"http://127.0.0.1:{server.server_port}/missing.bin",
                "fileStatus": 0,
                "fileSize": 0,
            },
        )

        failed = primary_device.call(
            "ChatManager",
            Cmd.downloadAttachment.value,
            info={"message": message},
        )
        assert failed.get("success") is False
        assert "/missing.bin" in hits

        error_event = primary_device.receive_message(
            match_event_type=Cmd.onMessageError.value,
            timeout=5.0,
        )
        assert error_event is not None
        assert error_event.get("eventType") == Cmd.onMessageError.value
        error_data = error_event.get("data")
        assert isinstance(error_data, dict)
        assert error_data.get("operation") == "message_error"
        assert error_data.get("localId") == message["msgId"]
        assert error_data.get("msg", {}).get("msgId") == message["msgId"]
        assert "500" in error_data.get("error", {}).get("description", "")


def test_web_chat_combine_parse_and_inner_downloads_request_remote_urls(
    primary_device,
    assert_api,
    require_capability,
    user_a,
    user_b,
):
    for cmd in (
        Cmd.importMessages,
        Cmd.downloadAndParseCombineMessage,
        Cmd.downloadMessageAttachmentInCombine,
        Cmd.downloadMessageThumbnailInCombine,
    ):
        require_capability("ChatManager", cmd.value)

    content = b"web combine payload"
    with _download_server(content) as (server, hits):
        base_url = f"http://127.0.0.1:{server.server_port}"
        image_msg_id = f"web-combine-image-{uuid.uuid4().hex[:8]}"
        image_message = _message(
            from_user=user_a,
            to_user=user_b,
            msg_id=image_msg_id,
            body={
                "type": 1,
                "localPath": "",
                "displayName": "web-combine-image.jpg",
                "remotePath": f"{base_url}/combine-image.jpg",
                "thumbnailRemotePath": f"{base_url}/combine-thumbnail.jpg",
                "fileStatus": 0,
                "thumbnailStatus": 0,
                "fileSize": len(content),
                "width": 100,
                "height": 100,
            },
        )
        file_msg_id = f"web-combine-file-{uuid.uuid4().hex[:8]}"
        file_message = _message(
            from_user=user_a,
            to_user=user_b,
            msg_id=file_msg_id,
            body={
                "type": 2,
                "localPath": "",
                "displayName": "web-combine-file.bin",
                "remotePath": f"{base_url}/combine-file.bin",
                "fileStatus": 0,
                "fileSize": len(content),
            },
        )
        combine_message = _message(
            from_user=user_a,
            to_user=user_b,
            body={
                "type": 8,
                "title": "web-combine",
                "summary": "image and file",
                "messageList": [image_msg_id, file_msg_id],
                "compatibleText": "combine-compatible",
                "fileStatus": 0,
            },
        )

        imported = primary_device.call(
            "ChatManager",
            Cmd.importMessages.value,
            info={"messages": [image_message, file_message, combine_message]},
        )
        assert_api.assert_result_equals(imported, True)

        parsed = primary_device.call(
            "ChatManager",
            Cmd.downloadAndParseCombineMessage.value,
            info={"message": combine_message},
        )
        inner_messages = assert_api.get_result(parsed)
        assert isinstance(inner_messages, list)
        inner_by_id = {item["msgId"]: item for item in inner_messages}
        assert set(inner_by_id) == {image_msg_id, file_msg_id}
        assert inner_by_id[image_msg_id]["body"]["type"] == 1
        assert inner_by_id[file_msg_id]["body"]["type"] == 2

        attachment = primary_device.call(
            "ChatManager",
            Cmd.downloadMessageAttachmentInCombine.value,
            info={"message": inner_by_id[file_msg_id]},
        )
        assert_api.assert_result_equals(attachment, None)

        thumbnail = primary_device.call(
            "ChatManager",
            Cmd.downloadMessageThumbnailInCombine.value,
            info={"message": inner_by_id[image_msg_id]},
        )
        assert_api.assert_result_equals(thumbnail, None)

        assert "/combine-file.bin" in hits
        assert "/combine-thumbnail.jpg" in hits
