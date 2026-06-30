# Contract: Manager Boundary and Tree-Shaking

## 1. Core Import Boundary

**Rule**: Core Client runtime code must not import optional Manager implementations.

**Allowed**:

- Core lifecycle, connection, message, cache, platform, validation, base REST client.
- `import type` references to public Manager-related types when required for typing only.
- Abstract Manager/capability interfaces.

**Forbidden**:

- Runtime import of `UserInfoManager`, `GroupManager`, `ChatRoomManager`, `ContactManager`, `ChatThreadManager`, `PresenceManager`, `PushManager`, or their domain helper modules from `ChatClient`.
- Runtime import of optional domain REST modules from `ChatClient`, such as group/chatroom management APIs.
- `new OptionalManager()` inside `ChatClient`.

## 2. Raw Notify Handling Contract

**Given** a raw domain notification is received  
**When** a Manager/capability for that domain is registered  
**Then** the raw notification is routed to that Manager/capability and converted into existing public business events.

**Given** a raw domain notification is received  
**When** no Manager/capability for that domain is registered  
**Then** the notification is ignored without public event dispatch and without loading that domain runtime implementation.

Compatibility requirements:

- Public event names remain unchanged for registered Managers.
- Public event payloads remain business-level payloads, not raw protocol objects.
- Existing cache updates owned by the registered Manager remain intact.

## 3. Optional Capability Dependency Contract

**Given** a caller enables an option that depends on optional capabilities  
**When** required capability is missing  
**Then** SDK fails before performing sync work with a `ValidationError`/SDK configuration error containing:

- The option name.
- The missing capability.
- The Manager/capability the caller should register.
- A short remediation suggestion.

Required dependency examples:

| Option | Required capability | User-facing remediation |
|--------|---------------------|-------------------------|
| `enableAutoSyncContacts` | user profile read/enrichment capability | Register UserInfo-related Manager/capability with the client |
| message profile sync enabled | user profile read capability; group namecard capability for group messages when enabled | Register UserInfo and, for group namecards, Group-related capability |
| future group auto-sync | group read/sync capability; user profile capability when enrichment is enabled | Register Group-related Manager/capability and UserInfo-related capability if required |

## 4. Import Usage Contract

Recommended size-sensitive usage:

```ts
import { ChatClient } from 'im-sdk-web';
import { ChatManager } from 'im-sdk-web/managers/chat';
import { GroupManager } from 'im-sdk-web/managers/group';
```

Compatibility usage:

```ts
import { ChatClient, ChatManager, GroupManager } from 'im-sdk-web';
```

Documentation rule:

- Size-sensitive and小程序 guides must recommend subpath Manager imports.
- Main entry aggregate imports may remain documented only as compatibility/general Web usage if verified by bundler tests.
- IIFE/full bundle must be described as all-capabilities, not tree-shakable.

## 5. Bundle Gate Contract

Minimum consumption scenarios:

| Scenario | Imports | Forbidden runtime modules |
|----------|---------|---------------------------|
| `core-only` | `ChatClient` only | all optional Manager runtime implementations |
| `core-chat` | `ChatClient` + `ChatManager` | group, chatroom, contact, presence, push, user-info Manager runtime unless explicitly required |
| `core-group` | `ChatClient` + `GroupManager` | chatroom, contact, presence, push, chat-thread runtime |

Failure rule:

- If a forbidden runtime module appears in the dependency graph, the check fails.
- If only size changes but no forbidden module appears, the check may warn unless a configured budget is exceeded.

## 6. Compatibility Contract

Must remain unchanged:

- `ChatClient.init(...)`
- `client.use(Manager)`
- Existing registered Manager public methods.
- Existing registered Manager public event names and payload semantics.
- Core login/connect/send/receive flows.

Allowed behavior change:

- Domain notifications for unregistered Managers are ignored.
- Auto-sync options with missing explicit dependencies now fail fast instead of implicitly working through hidden Manager creation.
