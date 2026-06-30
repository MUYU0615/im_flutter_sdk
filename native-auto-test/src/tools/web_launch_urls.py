"""Print Flutter Web launch URLs for the current native-auto-test topics."""
from __future__ import annotations

import argparse
import urllib.parse

from .config import get_topic, get_ws_base_url, get_run_id, get_topic_prefix


def _build_url(
    app_url: str,
    *,
    bridge_url: str,
    topic: str,
    device: str,
    web_sdk_mode: str | None = None,
    web_sdk_runtime: str | None = None,
) -> str:
    parsed = urllib.parse.urlparse(app_url)
    query = dict(urllib.parse.parse_qsl(parsed.query))
    query.update(
        {
            "bridgeUrl": bridge_url,
            "topic": topic,
            "device": device,
            "autoconnect": "1",
        }
    )
    if web_sdk_mode:
        query["webSdkMode"] = web_sdk_mode
    if web_sdk_runtime:
        query["webSdkRuntime"] = web_sdk_runtime
    return urllib.parse.urlunparse(parsed._replace(query=urllib.parse.urlencode(query)))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--app-url",
        default="http://localhost:8080",
        help="Base URL where im_flutter_test Web is served.",
    )
    parser.add_argument(
        "--bridge-url",
        default=None,
        help="Override websocket.base_url for generated links.",
    )
    parser.add_argument(
        "--devices",
        nargs="+",
        default=["webA", "webB"],
        help="Device names to print URLs for.",
    )
    parser.add_argument(
        "--web-sdk-mode",
        choices=["local_adapter", "real_sdk"],
        default=None,
        help="Override im_flutter_test Web SDK mode via URL query.",
    )
    parser.add_argument(
        "--web-sdk-runtime",
        choices=["legacy_webim", "imsdk"],
        default=None,
        help="Override im_flutter_test Web SDK runtime bundle via URL query.",
    )
    args = parser.parse_args()

    bridge_url = args.bridge_url or get_ws_base_url()
    run_id = get_run_id()
    if run_id:
        print(f"run_id={run_id}")
        print(f"topic_prefix={get_topic_prefix()}")
    for device in args.devices:
        topic = get_topic(device)
        print(f"{device} topic={topic}")
        print(
            _build_url(
                args.app_url,
                bridge_url=bridge_url,
                topic=topic,
                device=device,
                web_sdk_mode=args.web_sdk_mode,
                web_sdk_runtime=args.web_sdk_runtime,
            )
        )


if __name__ == "__main__":
    main()
