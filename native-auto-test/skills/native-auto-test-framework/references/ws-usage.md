# WebSocket SDK Usage

## Purpose

Use WebSocket only as the control channel to drive the SDK demo or test app. A WebSocket response means the bridge returned a result; it does not by itself prove SDK business success.

## Prerequisites

- Python 3.9+.
- Dependencies installed with `pip install -r requirements.txt`.
- `config.yaml` includes `websocket.base_url`, `websocket.default_topic`, and dynamic topic settings such as `topic_prefix`.

## Quick Commands

Request and response:

```bash
skills/im-ws/scripts/ws_call.py --manager ContactManager --cmd addContact --info-json '{"userId":"u2"}'
```

Request and wait for an event:

```bash
skills/im-ws/scripts/ws_call.py --manager ContactManager --cmd addContact --info-json '{"userId":"u2"}' --wait-event CONTACT_INVITED
```

Wait for a matching event:

```bash
skills/im-ws/scripts/ws_wait.py --event CONTACT_INVITED
```

## Debugging

- `WS_DEBUG=1` dumps inbound messages.
- `WS_RELAX=1` loosens event matching for discovery only.

After discovery, remove relaxed matching and assert the exact stable payload.

## References

- `src/tools/ws_client.py`
- `skills/im-ws/scripts/ws_call.py`
- `skills/im-ws/scripts/ws_wait.py`
