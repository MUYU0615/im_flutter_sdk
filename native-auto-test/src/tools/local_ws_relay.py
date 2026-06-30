"""Local topic-based WebSocket relay for native-auto-test."""
from __future__ import annotations

import argparse
import asyncio
import contextlib
import urllib.parse
from collections import defaultdict
from typing import DefaultDict

from websockets.legacy.server import WebSocketServerProtocol, serve


TopicClients = DefaultDict[str, set[WebSocketServerProtocol]]


def _topic_from_path(path: str, default_topic: str) -> str:
    parsed = urllib.parse.urlparse(path)
    query = urllib.parse.parse_qs(parsed.query)
    topic = (query.get("topic") or [default_topic])[0]
    return topic or default_topic


async def _broadcast(
    clients: TopicClients,
    topic: str,
    message: str | bytes,
) -> None:
    peers = list(clients.get(topic, set()))
    if not peers:
        return
    await asyncio.gather(
        *(peer.send(message) for peer in peers if not peer.closed),
        return_exceptions=True,
    )


async def _handler(
    websocket: WebSocketServerProtocol,
    path: str,
    *,
    clients: TopicClients,
    default_topic: str,
    verbose: bool,
) -> None:
    topic = _topic_from_path(path, default_topic)
    clients[topic].add(websocket)
    if verbose:
        print(f"[relay] connected topic={topic} peers={len(clients[topic])}")
    try:
        async for message in websocket:
            if verbose:
                print(f"[relay] topic={topic} bytes={len(message)}")
            await _broadcast(clients, topic, message)
    finally:
        clients[topic].discard(websocket)
        if not clients[topic]:
            clients.pop(topic, None)
        if verbose:
            print(f"[relay] disconnected topic={topic}")


async def run_server(
    *,
    host: str,
    port: int,
    path: str,
    default_topic: str,
    verbose: bool,
) -> None:
    clients: TopicClients = defaultdict(set)

    async def handler(websocket: WebSocketServerProtocol, request_path: str) -> None:
        parsed = urllib.parse.urlparse(request_path)
        if parsed.path != path:
            await websocket.close(code=1008, reason=f"unsupported path: {parsed.path}")
            return
        await _handler(
            websocket,
            request_path,
            clients=clients,
            default_topic=default_topic,
            verbose=verbose,
        )

    async with serve(handler, host, port):
        print(f"[relay] ws://{host}:{port}{path}?topic={default_topic}")
        await asyncio.Future()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=2000)
    parser.add_argument("--path", default="/iov/websocket/dual")
    parser.add_argument("--default-topic", default="adc")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    with contextlib.suppress(KeyboardInterrupt):
        asyncio.run(
            run_server(
                host=args.host,
                port=args.port,
                path=args.path,
                default_topic=args.default_topic,
                verbose=args.verbose,
            )
        )


if __name__ == "__main__":
    main()
