# Case Design And Assertions

## Required Evidence

A case should assert the strongest stable observable for the API. Depending on the API, this can include:

- Sync response envelope and key result fields.
- Receiver-side event or message.
- Sender-side callback or state transition.
- Server state fetched through SDK or REST.
- Local SDK state after refresh or reload.
- Error code and description for invalid input or unsupported state.

Do not accept Promise resolve or WebSocket response alone as proof of business success.

Example: `sendMessage` is not covered by "send call resolved" alone. It should verify the real message content, message id, receiver delivery or event, and any server-observable state available for that scenario.

## Coverage Dimensions

For each API, consider:

- Normal path.
- Invalid or boundary parameters.
- Empty or missing optional fields.
- Permission or role constraints.
- State transitions and idempotency.
- Multi-account or multi-device observation when the feature is distributed.
- Event callback shape and payload.

Not every API needs every dimension in one test, but missing dimensions should be recorded as deferred coverage rather than silently ignored.

## Assertion Rules

- Do not set expected values from the actual response.
- Do not branch around missing events with `if event is not None`.
- Keep ignored keys minimal. Ignore unstable IDs, timestamps, sequence numbers, or environment-specific fields only with a clear reason.
- Freeze known stable errors with exact code and description.
- Prefer real SDK calls for SDK behavior. REST helpers prepare data or verify server state; they do not replace SDK coverage.

## Flow Helpers

Create reusable helper flows when setup repeats across cases:

- Contact friendship and block-list flows.
- Chat send/receive and event flows.
- Group membership, roles, moderation, and server-state flows.
- Chatroom join/leave, member, mute, and attribute flows.

Do not create a separate skill for every module unless the module has enough reusable process to justify it. Keep module-specific flow details in helpers, docs, or focused references.
