# 功能规格：服务端消息搜索

**Feature Branch**: `047-server-message-search`
**Created**: 2026-06-15
**Status**: Draft
**Input**: 从 websdk 迁移服务端消息搜索功能（`searchMessages` API）到 websdk2。原实现位于 `packages/IM/sdk/src/apis/index.ts`。Webhook 功能（`webhookEnv`）已通过 spec 040 以 `Message.env` 完成迁移，本次不再涉及。

## References

- websdk 搜索实现：`packages/IM/sdk/src/apis/index.ts`（`searchMessages`、`buildServerSearchRequestData`、`mapSearchServerMessageToWebMessage`）
- websdk 类型定义：`packages/IM/sdk/src/types/indexApi.ts`（`MessageSearchOption`、`ServerSearchMessagesResult`、`ServerSearchMessage`）
- websdk2 REST 模式：`src/rest/chat-management.ts`
- websdk2 类型模式：`src/types/chat-manager.ts`
- websdk2 校验模式：`src/validators/`
- websdk2 Manager 模式：`src/managers/chat-manager.ts`

## Clarifications

### Session 2026-06-15

- Q: 搜索方法放在哪里？ → A: 放在 `ChatManager` 上，`chatManager.searchMessages(params)`。
- Q: 方法名保持什么？ → A: 保持 `searchMessages`，不使用 connection 调用模式。
- Q: 搜索结果消息格式？ → A: 需要转换为完整的 SDK `Message` 对象。
- Q: 附件 URL 如何处理？ → A: 需要处理，搜索结果中图片/视频/文件消息需要拼接附件访问 URL。
- Q: 是否需要 Demo UI？ → A: 需要，在 demo 中加搜索面板。
- Q: 是否需要新建分支？ → A: 不需要。

### Session 2026-06-15 (补充)

- Q: 附件 URL 拼接逻辑？ → A: 需要新写工具函数，URL 格式为 `${restBaseUrl}/${orgName}/${appName}/chatfiles/${uuid}?em-redirect=true&share-secret=${secret}`。已有的附件下载也需要改为此格式。
- Q: 搜索结果 Message 包含哪些字段？ → A: baseMessage（id/conversationId/chatType/from/to/ext/time）+ 各类型消息体字段 + 搜索附加字段（highlight/text）。具体参照 websdk 的 `mapSearchServerMessageToWebMessage` 映射逻辑。
- Q: Demo 搜索面板范围？ → A: 完整功能：关键词输入、matchType（or/and）、searchScope（none/with/only）、direction（up/down）、msgTypes 多选、conversationId、startTime/endTime、pageNum/pageSize、结果列表展示。
- Q: 搜索结果 status 字段？ → A: 不设置，保持 undefined。搜索结果来自服务端历史，无发送/接收状态语义。
- Q: 是否支持 combine 消息搜索？ → A: 不支持，保持与 websdk 一致，仅支持 txt/img/video/file/loc/custom 六种。

- 消息搜索是纯 REST API 能力，不涉及 WebSocket 协议层。
- 搜索 API 归属 `ChatManager`，公开为 `chatManager.searchMessages(params)`。
- 需要在 Console 开通 "Message Search" 服务；未开通时由服务端错误码映射透传。
- 搜索使用页码分页（`pageNum`/`pageSize`），与 SDK 其他游标分页接口风格不同。
- 搜索结果消息需转换为完整的 SDK `Message` 对象，附件类消息（图片/视频/文件）需拼接附件访问 URL。
- 不支持 `audio` 和 `cmd` 类型消息搜索（服务端限制）。
- 不需要新建 feature 分支。

## User Scenarios & Testing _(mandatory)_

### User Story 1 - 关键词搜索服务端消息 (Priority: P1)

作为 SDK 使用者，我希望调用 `chatManager.searchMessages(params)` 传入关键词，获得分页搜索结果。

**Acceptance Scenarios**:

1. **Given** `keywordList: ['hello']`，**When** 调用搜索，**Then** 返回 `SearchMessagesResult` 含 `messages` 数组和分页信息。
2. **Given** `keywordList: ['hello', 'world']` + `keywordListMatchType: 'and'`，**When** 调用搜索，**Then** 请求体使用 `keywords` + `keywordMatch: 'all'`。
3. **Given** 不传 `pageNum`/`pageSize`，**When** 调用搜索，**Then** 默认 `pageNum: 1`、`pageSize: 20`。
4. **Given** 服务端返回结果，**When** SDK 解析，**Then** 每条消息含 `conversationId`、`highlight`、`text` 及消息体。

---

### User Story 2 - 多条件过滤搜索 (Priority: P1)

作为 SDK 使用者，我希望按会话、消息类型、时间范围、搜索范围和排序进行过滤。

**Acceptance Scenarios**:

1. **Given** `conversationId: 'user1'` + `conversationType: 'singleChat'`，**When** 构造请求，**Then** 请求体含 `participantPairs: [{ userId1: currentUserId, userId2: 'user1' }]`。
2. **Given** `conversationId: 'group1'` + `conversationType: 'groupChat'`，**When** 构造请求，**Then** 请求体含 `groupIds: ['group1']`。
3. **Given** `conversationId: 'room1'` + `conversationType: 'chatRoom'`，**When** 构造请求，**Then** 请求体含 `chatroomIds: ['room1']`。
4. **Given** `msgTypes: ['txt', 'img']`，**When** 构造请求，**Then** 映射为 `contentType: 'text,image'`。
5. **Given** `startTime` + `endTime`，**When** 构造请求，**Then** 请求体含对应时间戳。
6. **Given** `searchScope: 'with'`，**When** 构造请求，**Then** 请求体含 `searchExt: 'with'`。
7. **Given** `direction: 'up'`，**When** 构造请求，**Then** 请求体含 `sort: 'sentTime:asc'`。

---

### User Story 3 - 参数校验 (Priority: P2)

作为 SDK 使用者，我希望非法参数时得到明确校验错误。

**Acceptance Scenarios**:

1. `keywordList` 为空数组 → 校验错误。
2. `keywordList` 超过 5 个 → 校验错误。
3. 单个关键词超 512 字符 → 校验错误。
4. 只传 `startTime` 不传 `endTime` → 校验错误。
5. `endTime < startTime` → 校验错误。
6. `pageSize` 为 0 或超 100 → 校验错误。
7. `msgTypes` 含 `'audio'` 或 `'cmd'` → 校验错误。
8. 只传 `conversationId` 不传 `conversationType` → 校验错误。
9. 只传 `conversationType` 不传 `conversationId` → 校验错误。
10. `conversationType` 不在 `'singleChat' | 'groupChat' | 'chatRoom'` 范围内 → 校验错误。

### Out of Scope

- 客户端本地消息搜索。
- 搜索结果本地缓存。
- 新增独立 Manager。
- 搜索结果中附件 URL 的重签拼装（透传服务端返回值）。

### Edge Cases

- 关键词前后空格自动 trim，trim 后为空的关键词自动过滤。
- 单关键词用 `keyword` 字段，多关键词用 `keywords` 字段。
- 服务端响应的消息数组字段可能是 `items` 或 `list`。
- 分页信息可能在 `pagination` 子对象或响应顶层。
- `highlight` 为 `Record<string, string[]>`，需扁平化为 `string[]`。
- 消息类型需双向映射：`txt↔text`、`img↔image`、`loc↔location`。
- 附件 URL 中若 `remotePath` 已包含 `?em-redirect`，不重复追加参数。
- 附件无 `secretKey` 时仅追加 `?em-redirect=true`，不追加 `share-secret`。
- 图片消息缩略图：若无 thumb 字段，使用 `${url}&thumbnail=true`。
- 搜索结果中未知消息类型仅保留 baseMessage 字段。

## Test Layer Requirements _(mandatory)_

### Unit Tests

- Coverage: Zod 校验、请求体构建、响应规范化、类型映射、分页解析、highlight 扁平化。
- Location: `tests/unit/rest/search-messages.test.ts`、`tests/unit/validators/search-messages.test.ts`

### Integration Tests

- Coverage: `ChatManager.searchMessages()` 从公开入口到 REST 请求构造的完整链路。
- Location: `tests/integration/chat-manager/search-messages.integration.test.ts`

### E2E Tests

- Not applicable: 需要手动开通 Message Search 服务，索引有延迟，不适合自动化。

### Gate Impact

- Required gates: `npm run type-check`、`npm run test:run`

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: `ChatManager` MUST 新增 `searchMessages(params: SearchMessagesParams): Promise<SearchMessagesResult>`。
- **FR-002**: `SearchMessagesParams` MUST 包含 `option: MessageSearchOption`、`pageNum?: number`、`pageSize?: number`。
- **FR-003**: `MessageSearchOption` MUST 包含必填 `keywordList: ReadonlyArray<string>` 及可选 `keywordListMatchType`、`conversationId`、`conversationType`、`msgTypes`、`startTime`、`endTime`、`searchScope`、`direction`。
- **FR-003a**: `MessageSearchConversationType` 为 `'singleChat' | 'groupChat' | 'chatRoom'`，用于指定会话类型过滤。
- **FR-004**: `keywordList` 校验：非空数组，最多 5 个，每个 trim 后 1-512 字符。
- **FR-005**: `msgTypes` 不允许 `'audio'` 或 `'cmd'`。
- **FR-006**: `startTime`/`endTime` 须同时提供或都不提供；同时提供时 `endTime >= startTime`。
- **FR-006a**: `conversationId` 和 `conversationType` MUST 同时提供或都不提供；`conversationType` 须为 `'singleChat' | 'groupChat' | 'chatRoom'` 之一。
- **FR-007**: `pageNum` >= 1（默认 1），`pageSize` 1-100（默认 20）。
- **FR-008**: REST 层实现 `requestSearchMessages()` 纯函数，POST 到 `/{orgName}/{appName}/users/{userId}/messages/search/get`。
- **FR-009**: 请求体映射：`keyword`/`keywords`、`keywordMatch`（`or→any`、`and→all`）、`contentType`（逗号分隔）、`searchExt`、`sort`（`up→sentTime:asc`、`down→sentTime:desc`）、`highlightEnable: true`、`page`、`size`。
- **FR-009a**: 会话过滤映射：当 `conversationType` 为 `'singleChat'` 时，请求体使用 `participantPairs: [{ userId1: currentUserId, userId2: conversationId }]`；为 `'groupChat'` 时使用 `groupIds: [conversationId]`；为 `'chatRoom'` 时使用 `chatroomIds: [conversationId]`。
- **FR-010**: 消息类型映射：`txt→text`、`img→image`、`video→video`、`file→file`、`loc→location`、`custom→custom`。
- **FR-011**: `SearchMessagesResult` MUST 包含 `messages`、`pageNum`、`pageSize`、`totalPages`、`isLast`。
- **FR-012**: `SearchResultMessage` 为完整 SDK `Message` 对象加 `conversationId?: string`、`highlight?: ReadonlyArray<string>`、`text?: string`。附件类消息（图片/视频/文件）MUST 拼接附件访问 URL，格式为 `${restBaseUrl}/${orgName}/${appName}/chatfiles/${uuid}?em-redirect=true&share-secret=${secret}`。
- **FR-012a**: 已有的附件下载/历史消息中的附件 URL 也 MUST 统一为 `?em-redirect=true&share-secret=xxx` 格式。
- **FR-013**: 响应规范化支持 `items`/`list` 双字段兼容。
- **FR-014**: 分页信息支持从 `pagination` 子对象或顶层读取；`isLast` 由 `isFinished === 1` 判断。
- **FR-015**: `highlight` 从 `Record<string, string[]>` 扁平化为 `ReadonlyArray<string>`。
- **FR-016**: 错误映射在 `src/rest/error-maps/` 中为 `searchMessages` 操作添加。
- **FR-017**: 所有新增类型通过 `src/types/` 统一导出。
- **FR-018**: Demo MUST 提供消息搜索面板，包含：关键词输入、matchType（or/and）、searchScope（none/with/only）、direction（up/down）、msgTypes 多选（txt/img/video/file/loc/custom）、conversationId（可选）、conversationType（singleChat/groupChat/chatRoom，与 conversationId 联动）、startTime/endTime、pageNum/pageSize，以及搜索结果列表展示。
- **FR-019**: 搜索结果消息 MUST NOT 设置 `status` 字段，保持 undefined。
- **FR-020**: 搜索结果仅支持 txt/img/video/file/loc/custom 六种消息类型，不支持 combine/audio/cmd。

### Key Entities

| 实体 | 说明 |
|------|------|
| `SearchMessagesParams` | 顶层入参：搜索选项 + 分页 |
| `MessageSearchOption` | 搜索条件：关键词、匹配模式、过滤条件 |
| `MessageSearchConversationType` | 会话类型：`'singleChat' \| 'groupChat' \| 'chatRoom'` |
| `SearchMessagesResult` | 分页响应：消息列表 + 分页元数据 |
| `SearchResultMessage` | 单条搜索结果：完整 `Message` 对象 + 搜索元数据（conversationId/highlight/text） |

## Success Criteria _(mandatory)_

- **SC-001**: `chatManager.searchMessages(params)` 类型检查通过。
- **SC-002**: Zod 校验单测覆盖 FR-004 ~ FR-007 及 FR-006a 全部约束。
- **SC-003**: REST 请求体构建单测覆盖单/多关键词、类型映射、时间范围、排序方向、conversationType 到 participantPairs/groupIds/chatroomIds 的映射。
- **SC-004**: 响应规范化单测覆盖 `items`/`list` 兼容、分页解析、highlight 扁平化、类型反向映射。
- **SC-005**: `npm run type-check` + `npm run test:run` 无回归。
