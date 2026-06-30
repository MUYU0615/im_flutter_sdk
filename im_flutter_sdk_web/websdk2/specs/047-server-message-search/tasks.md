# Tasks: 服务端消息搜索

**Input**: Design documents from `/specs/047-server-message-search/`
**Prerequisites**: plan.md, spec.md

**Tests**: 本 feature 涉及 REST 搜索 API、参数校验和响应规范化，必须覆盖 unit 测试和 integration 测试；实现后需完成 `type-check` 与 `test:run`。

**Organization**: Tasks are grouped by phase to enable incremental delivery.

## Format: `[ID] [P?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions

- SDK source: `src/`
- Tests: `tests/`
- Planning docs: `specs/047-server-message-search/`

## Phase 1: Setup (Shared Context)

**Purpose**: 审查现有 ChatManager REST 层、types 层、validators 层，确认插入点和现有模式。

- [ ] T001 [P] Review REST layer patterns in `src/rest/chat-management.ts` and `src/rest/error-maps/`
- [ ] T002 [P] Review types layer in `src/types/chat-manager.ts` and `src/types/index.ts`
- [ ] T003 [P] Review validators layer patterns in `src/validators/` (pick any existing schema as reference)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 新增类型定义和 Zod 校验 schema，为后续实现提供类型基础。

**CRITICAL**: Phase 3 实现必须等待本阶段完成。

- [ ] T004 Add `MessageSearchConversationType`, `MessageSearchOption`, `SearchMessagesParams`, `SearchMessagesResult`, `SearchResultMessage` types to `src/types/chat-manager.ts`
- [ ] T005 Export new types from `src/types/index.ts`
- [ ] T006 Implement `searchMessagesSchema` Zod validation in `src/validators/search-messages.ts` (keywordList constraints, msgTypes exclusion, conversationId/conversationType pairing, time range pairing, pagination defaults)

**Checkpoint**: 类型定义和校验 schema 就绪，`npm run type-check` 通过。

---

## Phase 3: US1+US2 Implementation

**Purpose**: 实现 REST 请求函数、错误映射和 ChatManager 公开方法。

- [ ] T007 Implement `requestSearchMessages()` in `src/rest/chat-management.ts`:
  - 请求体构建：keyword/keywords 分支、keywordMatch 映射、conversationType 到 participantPairs/groupIds/chatroomIds 映射（singleChat 需传入 currentUserId）、contentType 拼接、sort 映射、searchExt 透传、highlightEnable 固定 true、page/size
  - 响应规范化：items/list 兼容、pagination 双来源、isFinished→isLast、highlight 扁平化、消息类型反向映射
- [ ] T008 Add `searchMessages` error map in `src/rest/error-maps/`
- [ ] T009 Add `ChatManager.searchMessages()` method in `src/managers/chat-manager.ts` (validate → build request → call REST → normalize → return)

**Checkpoint**: 完整链路可调用，`npm run type-check` 通过。

---

## Phase 4: Tests

**Purpose**: 单元测试和集成测试覆盖校验、请求构建、响应规范化。

- [ ] T010 [P] Add validator unit tests in `tests/unit/validators/search-messages.test.ts`: keywordList constraints (empty/overflow/length), msgTypes exclusion (audio/cmd), conversationId/conversationType pairing (missing one, invalid type), time range pairing, pageSize bounds
- [ ] T011 [P] Add REST unit tests in `tests/unit/rest/search-messages.test.ts`: request body construction (single/multi keyword, type mapping, sort, contentType, conversationType→participantPairs/groupIds/chatroomIds), response normalization (items/list compat, pagination parsing, highlight flattening, type reverse mapping)
- [ ] T012 Add integration test in `tests/integration/chat-manager/search-messages.integration.test.ts`: ChatManager.searchMessages() full path from public entry to REST request construction

**Checkpoint**: 所有测试通过。

---

## Phase 5: Polish & Cross-Cutting

**Purpose**: 最终验证、版本更新和收尾。

- [ ] T013 [P] Run `npm run type-check` and fix any issues
- [ ] T014 [P] Run `npm run test:run` and fix any regressions
- [ ] T015 Update version and changelog in `package.json`, `CHANGELOG.md`
- [ ] T016 Commit with Chinese commit message

---

## Dependencies & Execution Order

### Phase Dependencies

```text
Phase 1 (Setup)         → no deps, all tasks parallel
Phase 2 (Foundational)  → depends on Phase 1; blocks Phase 3
Phase 3 (Implementation)→ depends on Phase 2; T007 → T008 → T009 sequential
Phase 4 (Tests)         → depends on Phase 3; T010/T011 parallel, T012 after both
Phase 5 (Polish)        → depends on Phase 4; T013/T014 parallel, T015 → T016 sequential
```

### Critical Path

```text
T001-T003 → T004-T006 → T007 → T009 → T010-T012 → T013-T014 → T015 → T016
```

## Parallel Opportunities

- T001-T003: all parallel (read-only review)
- T010-T011: parallel (separate test files, no shared state)
- T013-T014: parallel (independent verification commands)

## Implementation Strategy

### MVP First

1. Complete Phase 1 review to confirm insertion points.
2. Complete Phase 2 types + schema.
3. Implement REST function (T007) as the core logic unit.
4. Wire ChatManager method (T009).
5. Validate with tests before polish.

### Incremental Delivery

1. Types & schema → type-check 通过
2. REST function + error map + Manager method → 链路可用
3. Tests → 覆盖全部 acceptance scenarios
4. Polish → version bump + commit

### Risk Controls

- 请求体单/多关键词分支逻辑：通过单元测试独立验证两条路径
- conversationType 映射逻辑：单测分别覆盖 singleChat→participantPairs、groupChat→groupIds、chatRoom→chatroomIds 三条路径
- 响应 items/list 兼容：单测同时覆盖两种服务端返回格式
- 消息类型映射一致性：正向/反向映射使用同一 map 定义
- highlight 边界：单测覆盖空对象、嵌套空数组、正常多 key 场景
