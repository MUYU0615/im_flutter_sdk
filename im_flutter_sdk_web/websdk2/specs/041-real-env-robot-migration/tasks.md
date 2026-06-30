# Tasks: Real-Env Robot Test Migration

**Input**: Design documents from `/specs/041-real-env-robot-migration/`
**Prerequisites**: plan.md, spec.md

**Tests**: 本 spec 产出即为测试代码，不需要额外的测试层。所有任务本身就是浏览器 E2E 真实环境测试。

**Case Baseline**: 以 `wayang/TestCase/*.robot` 的流程 + `wayang/Resource/*.resource` 的 `Resp_*` / `Exclude` 为参照；每个 case 必须拆成“成功结果、错误结果、事件 payload、动态字段”四类断言，不能只按测试名迁移。

**Current Snapshot (2026-05-25)**:

- 当前真实实现位于 `tests/e2e/api/`，共有 13 个 spec 文件、121 个 Playwright API case。
- 最近一次聊天室定向回归为 `17 passed`，已覆盖 `消息/聊天室.robot` 的 text/cmd/custom 聊天室消息 case。
- 当前状态应判断为“041 robot 主迁移已完成、断言精度显著提升，public API 覆盖矩阵继续跟踪 partial/deferred 项”。
- `PushManager` 已补齐真实环境 E2E；`ChatThreadManager` 已按用户确认 deferred，不计入本轮 041 主线未完成项。
- `tests/e2e/README.md` 的模块用例数已同步到当前代码统计。

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: 基础设施

**Purpose**: 构建 real-env 测试共享工具，所有模块迁移依赖此阶段完成

- [x] T001 [P] 实现 `tests/e2e/fixtures/sdk-flow.ts` 的 token / 登录封装 — 真实环境凭证获取与注入（支持 password/token，两套路径都要保留）
- [x] T002 [P] 实现 `tests/e2e/fixtures/sdk-api.ts` 的事件缓冲池 — bind/unbind/waitForEvent/waitForEventMatching/assertNoEvent/clear，超时时输出已缓存事件列表
- [x] T003 [P] 实现多浏览器上下文 / 多账号管理 — userA/userB/thirdUser 独立页面实例，避免单例互相顶下线
- [x] T004 [P] 实现浏览器侧数据清理工具 — 好友/群组/聊天室/黑名单清理，保证每个 spec 可重复运行
- [x] T005 扩展 `tests/test-utils/layered/real-env-runner.ts` 的 RealEnvConfig — 新增 password/secondPassword/thirdUserId/thirdToken/thirdPassword/chatroomId/restUrl 字段及对应 .env 解析
- [x] T006 更新 `.env.example` — 补充所有新增环境变量

**Checkpoint**: 基础设施就绪，可开始模块迁移

---

## Phase 2: 好友管理（US1, Priority: P1）

**Goal**: 迁移好友.robot 中 Webim 标记的用例，按 robot 的响应样板细化断言

- [x] T007 [US1] 实现 `tests/e2e/api/contact.spec.ts` — 包含以下用例：
  - 添加好友：`addContact` 后断 `onContactInvited.from/to/status/type`，再接受后断 `onContactAgreed.from/to/status`，并验证双方联系人列表包含对方
  - 拒绝好友：`declineContactInvite` 后断 `onContactRefuse.from/to/status`
  - 事件 handler：直接调用 `contactManager.addEventHandler/removeEventHandler`，验证移除后不再收到 `onContactInvited`
  - 删除好友：`deleteContact` 后断 `onContactDeleted.from/to/status`，并验证双方列表移除对方
  - 添加黑名单：`addUsersToBlocklist` 后断返回的 `userIds`，并验证 `getBlocklist` 内容
  - 移除黑名单：`removeUserFromBlocklist` 后断 `getBlocklist` 不包含目标用户
  - 获取联系人列表：`getContacts` 逐字段断 `userId`、`remark`、`addTs`、`userInfo.userId`，并覆盖清空 remark
  - 异常参数：空 userId、空 userIds、非法字段类型、非好友修改备注、不存在用户等错误/行为都要逐项断；若真实环境与 robot 或错误表不一致，必须在 case 与矩阵中记录

**Checkpoint**: 好友模块独立可运行

---

## Phase 3: 用户信息（US2, Priority: P1）

**Goal**: 迁移用户.robot 中 Webim 标记的用例，逐字段验证返回结构

- [x] T008 [P] [US2] 实现 `tests/e2e/api/user-info.spec.ts` — 包含以下用例：
  - 获取用户信息(Webim)：`fetchUserInfoByIds([self])` → 逐字段验证 `userId/nickname/avatarUrl/mail/phone/gender/birth/sign/ext`
  - 获取多用户信息(Webim)：`fetchUserInfoByIds([user1, user2])` → 验证数组长度、顺序、字段内容
  - 获取不存在的用户信息：`fetchUserInfoByIds(['nonexistent'])` → 验证空结果或特定错误结构，错误时 `reason.data` 也要逐项对齐

**Checkpoint**: 用户信息模块独立可运行

---

## Phase 4: 在线状态（US3, Priority: P2）

**Goal**: 迁移在线状态.robot 全部用例，断事件与返回 payload

- [x] T009 [US3] 实现 `tests/e2e/api/presence.spec.ts` — 包含以下用例：
  - 基本操作：`subscribePresence` → `publishPresence` → 等待 `onPresenceStatusChange` 事件 → `getPresenceStatus` / `getSubscribedPresenceList` 逐字段验证，重点断 `publisher/ext/statusDetails/lastTime/expiry/totalnum/sublist`
  - 异常操作：订阅不存在用户、订阅超过限制、订阅自己、取消订阅自己返回的错误体要与 robot 一致，`reason.data` 必须可对照 `Presence.resource`
  - 未登录调用：logout 后调用 presence API 返回未登录错误

**Checkpoint**: 在线状态模块独立可运行

---

## Phase 5: 单聊消息（US4, Priority: P1）

**Goal**: 迁移消息/单聊.robot 中 Webim 标记的用例，消息字段必须逐项断言

- [x] T010 [US4] 实现 `tests/e2e/api/message-single.spec.ts` — 包含以下用例：
  - 发送文本消息：`createTextMessage + sendMessage` → `onMessage`，验证 `type/from/to/body.content/msgId/timestamp/localTime`
  - 发送 location 消息：验证 latitude/longitude/address 等关键 body 字段
  - 发送 cmd 消息：验证 action 字段
  - 发送 custom 消息：验证 customEvent/customExts
  - 撤回消息：`send → recallMessage` → `onRecallMessage`，验证 `messageId` 与原消息一致
  - 撤回异常：撤回不存在的消息、越权撤回、非法参数返回错误，错误体对齐 robot 的 `reason` / `reason.data`
  - 修改消息：`modifyMessage` 修改 text/custom body → 验证返回成功与回调
  - 漫游/加载消息：`loadMsgWithId/loadMsgWithStartId/loadMsgWithKeywords/loadMsgWithTime` 的列表长度、顺序、动态字段都要逐字段断

**Checkpoint**: 单聊消息模块独立可运行

---

## Phase 6: 群组管理（US6, Priority: P2）

**Goal**: 迁移群组.robot 中 Webim 标记的用例，权限与列表变化都要精确验证

- [x] T011 [US6] 实现 `tests/e2e/api/group.spec.ts` — 包含以下用例：
  - 创建并删除群组：`createGroup` → `getJoinedGroups` 包含 → `destroyGroup` → 不包含，重点断 `groupid/groupname/disabled/memberCount`
  - 修改群组公告 web 端：`changeGroupAnnouncement` → `getGroupAnnouncement` 验证内容
  - 获取公开群组列表：`getPublicGroupsFromServer` 返回分页数据，cursor/count/list 逐项验证
  - 添加/获取群组白名单：`addGroupWhiteList` → `getGroupWhiteList` 包含
  - 是否在群组白名单：`isMemberInWhiteList` 返回 true/false
  - 管理员移除管理员(Webim)：admin 调用 `removeGroupAdmin` 验证结果与权限错误
  - 群详情/管理员/禁言/黑名单/错误分支：`getGroupInfo/setGroupAdmin/removeAdmin/destroyGroup` 的 `reason.data`、`newadmin/oldadmin`、`resource_not_found/group_authorization` 都要逐项断

**Checkpoint**: 群组管理模块独立可运行

---

## Phase 7: 群聊消息（US5, Priority: P2）

**Goal**: 迁移消息/群聊.robot 中 Webim 标记的用例，群消息 payload 要逐项验证

**依赖**: T011（需要群组创建能力）

- [x] T012 [US5] 实现 `tests/e2e/api/message-group.spec.ts` — 包含以下用例：
  - 群聊消息(user1发user2收)(Webim)：`beforeAll` 创建群组并邀请 user2 → user1 发送 text/location/cmd/custom → user2 收到 `onMessage`，逐字段断 `type/from/to/body/msgId`
  - 撤回消息：owner 撤回自己的消息 → 群成员收到 `onRecallMessage`
  - afterAll 销毁群组

**Checkpoint**: 群聊消息模块独立可运行

---

## Phase 8: 会话管理（US7, Priority: P2）

**Goal**: 迁移会话/会话.robot 中 Webim 标记的用例，响应对象必须细化到字段级

- [x] T013 [US7] 实现 `tests/e2e/api/conversation-manage.spec.ts` — 包含以下用例：
  - 置顶/取消置顶会话(Webim)：`pinConversation` → `getServerPinnedConversations` 包含 → `unpinConversation` → 不包含，重点断 `isPinned/pinnedTime/lastMessage`
  - 标记会话/取消标记：`markConversation` → `getServerConversationsByFilter(mark)` 包含 → `unmarkConversation` → 不包含，重点断 `marks`
  - `getConversation` / `getConversationList` / `deleteConversation` / `syncConversationExt` / unread / latest message 等返回对象要逐字段断言
  - 空会话、不存在会话、非法 conversationType/messageId 的错误体要与 robot 一致

**Checkpoint**: 会话管理模块独立可运行

---

## Phase 9: 聊天室管理（US8, Priority: P3）

**Goal**: 迁移聊天室/聊天室操作.robot 中 Webim 标记的用例，事件和权限错误都要细化

- [x] T014 [US8] 实现 `tests/e2e/api/chatroom.spec.ts` — 包含以下用例：
  - 创建聊天室(Webim)：`createChatRoom` → 返回 `chatroomId`
  - 销毁聊天室(Webim)：`destroyChatRoom` → 成功
  - 设置单个聊天室属性(Webim)：`setChatRoomAttribute` → `getChatRoomAttributes` 验证
  - 非 owner 修改属性(Webim)：验证权限行为与错误体
  - 移除单个聊天室属性(Webim)：`removeChatRoomAttribute` → 验证移除
  - 查询是否在禁言列表(Webim)：`isChatRoomMemberInMuteList` 验证
  - 回调事件验证(Webim)：销毁/白名单/禁言/管理员/描述/公告/属性/成员加入退出 → 对应事件到达，payload 逐字段断
  - 聊天室消息 case 若存在，必须并入该 spec 而不是单独拆文件

**Checkpoint**: 聊天室管理模块独立可运行

---

## Phase 10: Reaction（US9, Priority: P3）

**Goal**: 迁移消息/Reaction.robot 中 Webim 标记的用例，错误 case 也要精确断言

- [x] T015 [P] [US9] 实现 `tests/e2e/api/reaction.spec.ts` — 包含以下用例：
  - 添加消息 Reaction(Webim)：`send message → addReaction → getReactionDetail` 验证，重点断 `reaction/count/isAddedBySelf/userList/cursor`
  - 移除 Reaction：`removeReaction → getReactionDetail` 为空
  - 重复添加 Reaction / 对不存在消息添加 Reaction / 超上限 / 无权限：返回错误，错误体对齐 robot

**Checkpoint**: Reaction 模块独立可运行

---

## Phase 11: 收尾

**Purpose**: 更新文档和配置

- [x] T016 [P] 更新 `tests/e2e/README.md` — 补充 browser E2E 路线、多账号配置说明、`tests/e2e/api/` 模块列表与断言规则
- [x] T017 [P] 更新 `specs/041-real-env-robot-migration/spec.md` / `plan.md` 的完成态说明 — 明确已从 Node real-env 迁移到 browser E2E，且当前实现落点是 `tests/e2e/api/`

---

## Phase 12: 缺口收口（2026-05-22 增补）

**Purpose**: 基于当前真实状态，继续把 coverage gap 和 robot 差异显式收口

- [x] T025 [US1] 补齐 `tests/e2e/api/auth.spec.ts` / `contact.spec.ts` 中 ChatClient 与 ContactManager 的 public API 覆盖 — 包含 logout 幂等、ChatClient direct event handler、ContactManager direct event handler、联系人 validation details、不存在用户真实行为、黑名单 validation 与幂等行为
- [x] T026 [US3] 补齐 `tests/e2e/api/presence.spec.ts` 中 PresenceManager 的 public API 覆盖 — 包含 direct event handler、publish validation、subscribe/unsubscribe/getStatus validation、取消订阅自己真实行为、不存在用户离线结构、未登录 validation details
- [x] T018 [US4] 收紧 `tests/e2e/api/message-single.spec.ts` — 补 location、`modifyMessage`、history/load、错误撤回与已读 ack 断言，至少覆盖 text + location + custom + recall + modify + error 的组合
- [x] T019 [US5] 收紧 `tests/e2e/api/message-group.spec.ts` — 补接收端 `onMessage` / `onMessageRecalled` 字段级断言，以及 location/cmd/custom、权限错误、群消息已读回执
- [x] T020 [US6] 收紧 `tests/e2e/api/group.spec.ts` — 补 `updateGroupAnnouncement`、`addGroupAdmin/removeGroupAdmin/getGroupAdminList`、allowlist、权限错误、not-found 分支
- [x] T021 [US8] 收紧 `tests/e2e/api/chatroom.spec.ts` — 在 `EASEMOB_CHATROOM_ID` 可用时补 owner 侧管理员/白名单/公告/回调验证，并复核 `消息/聊天室.robot` 是否已完整并入
- [x] T022 [US9] 收紧 `tests/e2e/api/reaction.spec.ts` — 补不存在消息、超上限、群场景、无权限等错误分支；若真实环境返回与 robot 不一致，需要在 case 中显式记录
- [x] T023 [US7] 产出 public API 覆盖矩阵 — 以 `chatManager/groupManager/chatRoomManager/contactManager/presenceManager/userInfoManager` 为维度，列出已覆盖/未覆盖 public API，避免后续只按模块名判断“已完成”；落点：`tests/e2e/api/public-api-coverage-matrix.md`
- [x] T024 [P] 记录真实环境与 robot 基线不一致项 — 当前至少包括 `presence` 超限错误码、取消订阅自己 resolve、未登录返回 `restBaseUrl required`，`reaction` 重复添加错误码，`user-info` 订阅陌生人返回 `303`，`contact` 不存在用户分支 resolve 或返回未映射 `303`，`ChatManager.deleteConversation/clearAllMessagesAndConversations` 当前 SDK 不更新本地会话缓存也不派发 `onConversationUpdate`；若后续确认是 SDK 映射问题，应转入代码修复任务
- [x] T027 [US4] 补齐 ChatManager public API 覆盖缺口 — 新增 `tests/e2e/api/chat-manager-advanced.spec.ts` 并扩展 `conversation-manage.spec.ts`，覆盖媒体/合并消息创建、会话列表/session-list、置顶会话、会话已读、历史删除、消息置顶、下载/合并下载 validation、翻译与语音转文字 validation/feature-gated 行为

## Phase 13: Deferred scope

**Purpose**: 明确不纳入本轮 041 主线收口、后续需独立规划的 public manager。

- [x] T028 [US4] PushManager real-env E2E — 新增 `tests/e2e/api/push.spec.ts`，覆盖 push token 上传、全局/会话免打扰、批量查询、清除、语言偏好、本地 session-list 提醒类型分页与 validation 错误精确断言
- [ ] T029 [Deferred] ChatThreadManager real-env E2E — 需要父群消息与 thread fixture，后续单独规划

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (基础设施) ← 无依赖，立即开始
  │
  ├── Phase 2 (好友) ← 依赖 Phase 1
  ├── Phase 3 (用户信息) ← 依赖 Phase 1，可与 Phase 2 并行
  ├── Phase 4 (在线状态) ← 依赖 Phase 1
  ├── Phase 5 (单聊消息) ← 依赖 Phase 1
  ├── Phase 6 (群组管理) ← 依赖 Phase 1
  ├── Phase 7 (群聊消息) ← 依赖 Phase 1 + Phase 6
  ├── Phase 8 (会话管理) ← 依赖 Phase 1
  ├── Phase 9 (聊天室) ← 依赖 Phase 1
  └── Phase 10 (Reaction) ← 依赖 Phase 1
        │
Phase 11 (收尾) ← 依赖所有模块完成
```

### Parallel Opportunities

- Phase 1 内 T001-T004 可完全并行（不同文件）
- Phase 2-10 中标记 [P] 的任务可与其他模块并行
- Phase 3 (用户信息) 和 Phase 10 (Reaction) 不依赖其他模块，可最早并行

### 推荐执行顺序（单人）

1. T001-T006（基础设施）
2. T007（好友）— 验证双账号 + 事件缓冲池工作正常
3. T010（单聊消息）— 验证消息收发核心链路
4. T008（用户信息）— 简单模块，快速产出
5. T011（群组）→ T012（群聊消息）
6. T009（在线状态）
7. T013（会话）
8. T014（聊天室）
9. T015（Reaction）
10. T016-T017（收尾）
