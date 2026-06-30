# Quickstart: ChatClient Multi-Device Listener

## Recommended Validation Flow

1. Run type checks:

   ```bash
   npm run type-check
   ```

2. Run targeted unit tests:

   ```bash
   npm run test:run -- tests/unit/multi-device tests/unit/core/message tests/types
   ```

3. Run targeted integration tests:

   ```bash
   npm run test:run -- tests/integration/multi-device
   ```

4. Run E2E API tests:

   ```bash
   npm run test:e2e:api -- tests/e2e/api/multi-device.spec.ts
   ```

5. Run lint before release:

   ```bash
   npm run lint
   ```

6. Run API docs check after public type/JSDoc changes:

   ```bash
   npm run docs:api:check
   ```

## Manual Smoke Scenario

```ts
client.addEventHandler('multi-device-smoke', {
  onMultiDeviceContact: event => {
    console.log(event.operation, event.targetUserId, event.deviceId);
  },
  onMultiDeviceGroup: event => {
    console.log(event.operation, event.groupId, event.userIds);
  },
  onMultiDeviceThread: event => {
    console.log(event.operation, event.threadId, event.parentId);
  },
  onMultiDeviceConversation: event => {
    console.log(event.operation, event.conversationId, event.conversationType);
  },
  onMultiDeviceMessageRemoved: event => {
    console.log(event.conversationId, event.messageIds, event.beforeTimestamp);
  },
});
```

Expected behavior:
- Other-device operations trigger the matching MultiDevice callback when the upstream notify is received.
- Same-device echoes are filtered when source resource can be identified.
- Existing business callbacks continue to work without adding `deviceId`.
- Missing source device produces `deviceId === undefined`, not an empty string or current resource.

## E2E Notes

Real MultiDevice E2E may require the same account to be logged in with two different resources. If the CI environment cannot reliably trigger a specific server notify, use a browser-side fixture injection that exercises the public handler API and record the true real-env coverage gap in this file during implementation.

Stable PR coverage should include:
- `addEventHandler/removeEventHandler` for all five callback names.
- At least one fixture-driven MultiDevice event delivered through the same SDK event path used by production code.
- Removal test proving the removed handler ID does not receive later events.

Current `tests/e2e/api/multi-device.spec.ts` is a fixture-driven public-API smoke test: it validates all five handler names, handler removal, and the public `addInternalEvent` dispatch path. It does not depend on server-side MultiDevice push delivery.

Nightly/real-env backlog should include:
- Contact accept or remove from another device.
- Group admin/mute/allowlist operation from another device.
- Thread create/update/delete from another device.
- Conversation pin/mark/mute operation from another device.
- Roam message delete from another device if the test account has service support.
