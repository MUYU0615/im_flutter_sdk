# Feature Specification: Real-Env Robot Test Migration

**Feature Branch**: `041-real-env-robot-migration`  
**Created**: 2026-05-21  
**Status**: Mainline Complete; Deferred Scope Tracked
**Input**: 将 im-auto-test/wayang/TestCase 中的 robot 测试用例迁移到 websdk2/tests/e2e/api，使用 Playwright + 真实环境运行

## 背景

原 robot 测试框架（wayang）通过 WebSocket 桥接器驱动各平台 SDK 执行测试。现需将其中 Web SDK 可覆盖的用例迁移到 `tests/e2e/api/`，直接在浏览器中调用 SDK API 并连接真实服务器验证。

由于 Node 环境在多实例登录、浏览器原生能力与 polyfill 维护上成本过高，041 的最终落点采用浏览器 E2E，而不是继续新增 `tests/real-env/` 或 Node polyfill 方案。

### 迁移范围

| 模块 | robot 文件 | 目标目录 | 状态 |
|------|-----------|---------|------|
| 登录注册 | 登录注册.robot | tests/e2e/api/auth.spec.ts | ✅ 已完成 |
| 好友 | 好友.robot | tests/e2e/api/contact.spec.ts | ✅ 已迁移，已补 ChatClient/ContactManager public API 成功、错误、事件 handler 断言 |
| 用户 | 用户.robot | tests/e2e/api/user-info.spec.ts | ✅ 已迁移，已补主要成功/错误/订阅断言 |
| 在线状态 | 在线状态.robot | tests/e2e/api/presence.spec.ts | ✅ 已迁移，已补 public API 成功、validation、未登录、事件 handler 与真实偏差断言 |
| 会话 | 会话/会话.robot | tests/e2e/api/conversation-manage.spec.ts | ✅ 已迁移，已补会话列表、置顶/标记、删除、清空、未读、latest message 等字段级断言；本地缓存事件差异已记录 |
| 聊天室 | 聊天室/聊天室操作.robot + 消息/聊天室.robot | tests/e2e/api/chatroom.spec.ts | ✅ 已迁移，已补详情/列表、join/leave WebSocket、成员、管理员、禁言、全员禁言、黑名单、白名单、公告、属性、移除成员与聊天室 text/cmd/custom 消息 |
| 群组 | 群组/群组基础操作.robot + 群组操作.robot | tests/e2e/api/group.spec.ts | 已补齐群详情、成员列表、公告、管理员、白名单、禁言、黑名单、权限与 not-found 分支 |
| 消息-单聊 | 消息/单聊.robot | tests/e2e/api/message-single.spec.ts | 已补齐 text/cmd/location/custom 收发、modify、history、read ack、recall 成功与错误分支 |
| 消息-群聊 | 消息/群聊.robot | tests/e2e/api/message-group.spec.ts | 已补齐 text/location/cmd/custom history 收端字段、read ack/read users、recall 与权限错误；群 onMessage 推送仍以 history 稳定验收 |
| 消息-Reaction | 消息/Reaction.robot | tests/e2e/api/reaction.spec.ts | 已补齐 single/group reaction 主流程与不存在消息、未添加移除、群外用户、上限等错误分支 |

> 说明：`消息/聊天室.robot` 的 Webim baseline 为 text/cmd/custom 聊天室消息，已合并到 `chatroom.spec.ts`，不单独拆 `message-chatroom.spec.ts`。

### 当前实现快照（2026-05-25）

- 当前真实落点为 `tests/e2e/api/`，共有 13 个 spec 文件。
- 实际 Playwright `test(...)` 总数为 121 个；这是当前统计真值，优先于旧文档中的数字。
- 最近一次聊天室定向回归结果为 `17 passed`，已覆盖 `消息/聊天室.robot` 对应的聊天室 text/cmd/custom 消息 case。
- 当前完成度应区分为：
  - 041 robot 主迁移已完成：目标模块均已有浏览器 E2E 落点。
  - 断言精度已收紧：成功结果、错误结果、事件 payload 与动态字段按可观测能力拆分断言。
  - Public API 覆盖矩阵已建立：`tests/e2e/api/public-api-coverage-matrix.md` 继续记录 partial、blocked 与 deferred 项。
  - Deferred scope：`ChatThreadManager` 需要独立父群消息/thread fixture，按用户确认不纳入本轮 041 主线收口。
- 当前 `tests/e2e/README.md` 中的模块用例数已同步到当前代码统计。

### 当前已识别缺口

- `message-single.spec.ts` / `message-group.spec.ts`：核心 robot 热路径已覆盖；仍可继续补更多 send failure、禁言/黑名单、history filter 与 validation 分支。
- `chat-manager-advanced.spec.ts`：远程 URL 媒体创建、合并消息创建、置顶、删除历史、翻译/语音转文字 validation 已覆盖；上传型附件下载成功、合并消息下载成功、语音转文字成功仍依赖稳定文件 fixture/服务能力。
- `group.spec.ts`：主线、owner transfer、shared file、member attributes、邀请/申请/管理员/白名单/禁言/黑名单已覆盖；部分 not-found/invalid 分支和若干 real-env optional 事件仍记录为 partial。
- `chatroom.spec.ts`：管理主线与聊天室 text/cmd/custom 消息已覆盖；创建/销毁聊天室不是当前 SDK2 ChatRoomManager public API，destroy callback 只能在后续具备创建/销毁公开入口或专用 fixture 后补。
- `conversation-manage.spec.ts`：会话主流程和本地 cache 断言已覆盖；`deleteConversation` / `clearAllMessagesAndConversations` 当前不更新本地会话缓存、不派发 `onConversationUpdate`，按 SDK 问题候选记录。
- `PushManager`：已补真实环境 E2E，覆盖 token 上传、免打扰、语言偏好、提醒类型分页与 validation 错误。
- `ChatThreadManager`：按本轮用户要求 deferred，后续单独开阶段补真实 E2E。

### 当前已知不一致

- `presence` 订阅超限，当前真实环境仍返回通用 `110`，尚未对齐 robot 期望的细分错误码。
- `reaction` 重复添加，当前真实环境仍返回通用 `110`，尚未稳定对齐 `1301`。
- `user-info` 订阅陌生人资料变化，当前真实环境可能返回 `303`，与 robot 基线不完全一致。
- `presence` 订阅列表与状态变更事件在全量串跑下存在时序抖动；当前 case 已改为“结果必断，事件到达则细断 payload”的稳定写法。
- `presence` 取消订阅自己当前真实环境 resolve，与 robot 期望的 `1101` 不一致；未登录调用当前优先返回 `restBaseUrl is required`，不是 mobile robot 中的 `201`。
- `auth` 无效 token 登录在真实环境下可能表现为明确 reject，也可能表现为在限定时间内始终无法建立连接；当前 case 已按“不建立有效连接”收口。
- `contact` 不存在用户分支存在服务端/映射不一致：`addContact`、`acceptContactInvite`、`declineContactInvite` 当前 resolve；`deleteContact` 返回未映射 `303 + service_resource_not_found`，而错误表期望为 `204`；`addUsersToBlocklist` 可稳定映射为 `204`。
- `ChatManager.deleteConversation` / `clearAllMessagesAndConversations` 当前 SDK 不更新本地会话缓存，也不派发 `onConversationUpdate`。
- `GroupManager` 中部分事件在 real-env 下不稳定或不派发，case 采用“状态必断，事件到达则精确断 payload”的稳定写法。
- `ChatRoomManager.checkIfInMuteList` 当前 real-env 返回 `RestBusinessError(303)`；禁言状态以 `getMuteList` 列表结果稳定验收。
- `消息/聊天室.robot` 已按 text/cmd/custom 合并到 `chatroom.spec.ts`；原 robot 中 location 分支处于注释状态，未作为 Webim baseline。

### 排除范围

- `[Tags] Mobile` 标记的用例：涉及本地数据库操作（getLocalContacts、getLocalBlockList 等），Web SDK 不支持
- `[Tags] Mobile` 中的会话本地操作（InsertMessage、LoadMessages、GetMessageCount 等）：Web SDK 无本地消息数据库
- ChatThreadManager：属于 public manager 后续覆盖，不纳入本轮 041 robot 主迁移收口

### 特殊标记处理

- `[Tags] ThreeUsers`：需要 3 个用户账号，通过 `.env` 配置 `EASEMOB_THIRD_USERID` / `EASEMOB_THIRD_TOKEN` 支持
- `[Tags] Webim`：Web SDK 专属用例，优先迁移
- `[Tags] AllFeatureEnabled`：需要服务端开启对应功能，标记为条件跳过
- `[Tags] WebimFailed`：已知 Web 端失败的用例，暂不迁移
- `[Tags] Unstable`：不稳定用例，暂不迁移

### 断言规则

- 以 `wayang/Resource/*.resource` 的 `Resp_*` / `Exclude` 样板为基线，优先迁移 robot 中已有的成功/失败/事件断言，不以 `TestCase/*.robot` 的 case 名称为唯一依据。
- 每个 API case 必须拆成四层断言：成功结果、错误结果、事件 payload、动态字段。
- 稳定字段使用精确相等断言；动态字段仅断类型、格式或存在性，不允许只断 `defined` 或 `contains`。
- 错误 case 必须断 `error/code/message/reason`；robot 里存在的嵌套 `reason.data` 也要尽量逐项对齐。
- 事件 case 必须断事件名与关键 payload 字段，例如 `from`、`to`、`userId`、`conversationId`、`msgId`、`type`、`body`、`ext`。
- 浏览器 E2E 只迁移当前 Web SDK 可观测字段，不复制原生平台不可见的内部字段。

---

## User Scenarios & Testing

### User Story 1 - 好友管理（Priority: P1）

迁移好友模块的 Webim 用例：添加/删除好友、添加/删除黑名单、获取联系人列表、分页获取联系人。

**Why this priority**: 好友是 IM 核心社交关系，且双账号互发消息的前置条件。

**Independent Test**: 两个账号互相添加好友、验证 `onContactInvited/onContactAgreed/onContactRefuse/onContactDeleted` 与联系人列表字段。

**Acceptance Scenarios**:

1. **Given** 两个已登录用户, **When** user1 发送好友请求, **Then** user2 收到 `onContactInvited`，且 `from/to/status` 与 robot 对照一致
2. **Given** user2 收到好友请求, **When** user2 接受邀请, **Then** user1 收到 `onContactAgreed`，双方联系人列表包含对方，且 `getAllContacts` / `getContacts` 的 `remark`、空列表都要逐项验证
3. **Given** 双方已是好友, **When** user1 删除好友, **Then** user2 收到 `onContactDeleted`，双方联系人列表不包含对方
4. **Given** user2 收到好友请求, **When** user2 拒绝邀请, **Then** user1 收到 `onContactRefuse`
5. **Given** 已登录用户, **When** 添加用户到黑名单, **Then** 返回的 `userIds`、黑名单列表、移除后列表都要逐项验证
6. **Given** 已登录用户, **When** 使用 cursor 分页获取联系人, **Then** `cursor`、`contacts`、`remark`、空分页结果以及 `pageSize` 边界值都要逐项验证
7. **Given** 空 userId / 不存在用户 / 非好友修改备注 / pageSize 越界 / 非法 cursor, **Then** 返回与 robot 一致的错误码、错误信息与嵌套 reason

---

### User Story 2 - 用户信息（Priority: P1）

迁移用户信息模块的 Webim 用例：获取用户信息、获取多用户信息。

**Why this priority**: 用户信息是基础能力，其他模块依赖。

**Independent Test**: 获取自己和他人的用户信息，验证返回结构。

**Acceptance Scenarios**:

1. **Given** 已登录用户, **When** 获取自己的用户信息, **Then** 返回包含 `userId/nickname/avatarUrl/mail/phone/gender/birth/sign/ext` 的完整信息，并逐字段验证
2. **Given** 已登录用户, **When** 批量获取多个用户信息, **Then** 返回所有请求用户的信息数组，数组长度、顺序和字段内容要校验
3. **Given** 已登录用户, **When** 获取不存在的用户信息, **Then** 返回空结果或特定错误，且错误结构要与 robot 对齐

---

### User Story 3 - 在线状态（Priority: P2）

迁移在线状态模块：发布状态、订阅/取消订阅、获取状态、事件通知。

**Why this priority**: 在线状态是独立功能模块，不阻塞其他模块。

**Independent Test**: user1 订阅 user2，user2 发布状态，user1 收到变更事件。

**Acceptance Scenarios**:

1. **Given** user1 已订阅 user2, **When** user2 发布自定义状态, **Then** user1 收到 `onPresenceStatusChange`，并验证 `userId/ext/statusDetails/lastTime/expire`
2. **Given** 已登录用户, **When** 获取指定用户在线状态, **Then** 返回结果数组及其字段、`statusDetails` 和 `lastTime` 要逐项验证
3. **Given** 已登录用户, **When** 订阅用户在线状态, **Then** 返回被订阅用户当前状态，且 `expiry`、`status`、`ext`、`totalnum/sublist` 与 robot 对照一致
4. **Given** 已订阅用户, **When** 取消订阅, **Then** 不再收到该用户的状态变更事件
5. **Given** 已登录用户, **When** 获取已订阅用户列表, **Then** `totalnum/sublist` 和列表项字段要逐项验证
6. **Given** 已登录用户, **When** 订阅不存在的用户/订阅自己/超过数量限制, **Then** 返回对应错误，且错误码/消息/嵌套 data 要对齐 robot
7. **Given** 未登录状态, **When** 调用 presence API, **Then** 返回未登录错误

---

### User Story 4 - 消息-单聊（Priority: P1）

迁移单聊消息模块的 Webim 用例：发送/接收各类型消息、撤回消息、消息已读回执。

**Why this priority**: 消息收发是 IM SDK 最核心能力。

**Independent Test**: user1 发送消息给 user2，user2 收到 onMessage 事件并验证消息内容。

**Acceptance Scenarios**:

1. **Given** 两个已登录用户互为好友, **When** user1 发送文本消息, **Then** user2 收到 `onMessage`，并验证 `type/from/to/body.content/msgId`
2. **Given** 同上, **When** user1 发送 location/cmd/custom 消息, **Then** user2 收到对应类型消息，并校验各自的关键 body 字段
3. **Given** user1 已发送消息, **When** user1 撤回该消息, **Then** user2 收到 `onRecallMessage`，且 `messageId` 与原消息一致
4. **Given** user2 收到消息, **When** user2 发送已读回执, **Then** user1 收到已读通知，并验证读回执关联字段
5. **Given** 已登录用户, **When** 修改已发送的文本/custom 消息, **Then** 修改成功，回调/返回值要与 robot 一致
6. **Given** 已登录用户, **When** 拉取漫游消息, **Then** 列表顺序、条数、动态字段与 robot 约定一致，`msgId/timestamp/localTime` 只做类型或存在性断言

---

### User Story 5 - 消息-群聊（Priority: P2）

迁移群聊消息模块：群内发送/接收消息、撤回消息。

**Why this priority**: 群聊是 IM 第二核心场景。

**Independent Test**: user1 在群内发送消息，user2 作为群成员收到消息。

**Acceptance Scenarios**:

1. **Given** user1 和 user2 在同一群组, **When** user1 发送群文本消息, **Then** user2 收到群消息事件，并校验 `type/from/to/body.content/msgId`
2. **Given** 同上, **When** user1 发送 location/cmd/custom 群消息, **Then** user2 收到对应类型群消息，并校验关键 body 字段、事件 payload 与动态字段
3. **Given** user1 已发送群消息, **When** user1（owner）撤回消息, **Then** user2 收到撤回通知，`messageId` 与原消息一致
4. **Given** user1 已发送群消息, **When** 非发送者非管理员撤回, **Then** 返回权限错误，错误体要对齐 robot

---

### User Story 6 - 群组管理（Priority: P2）

迁移群组模块的 Webim 用例：创建/销毁群组、管理员设置、邀请成员、公告、白名单/黑名单/禁言。

**Why this priority**: 群组管理是群聊消息的前置条件。

**Independent Test**: 创建群组、邀请成员、设置管理员、销毁群组。

**Acceptance Scenarios**:

1. **Given** 已登录用户, **When** 创建群组, **Then** 返回群组 ID，获取已加入群组列表包含该群，且 `groupid/groupname/disabled/memberCount` 等关键字段逐项验证
2. **Given** 群主, **When** 销毁群组, **Then** 成功，已加入群组列表不包含该群
3. **Given** 群主, **When** 设置/移除管理员, **Then** 操作成功且管理员列表变化、`result/newadmin/oldadmin` 要校验
4. **Given** 群主, **When** 转移群主, **Then** 新群主获得 owner 权限
5. **Given** 群主, **When** 邀请成员（不需确认）, **Then** 被邀请者自动加入群组，成员列表和事件要校验
6. **Given** 群主, **When** 修改群公告, **Then** 获取公告返回新内容
7. **Given** 群主, **When** 添加/移除白名单/黑名单/禁言, **Then** 对应列表、`successKeys/errorKeys` 和错误分支都要细化验证
8. **Given** 非群主, **When** 尝试设置管理员/转移群主, **Then** 返回权限错误，错误码/消息/原因要对齐 robot

---

### User Story 7 - 会话管理（Priority: P2）

迁移会话模块的 Webim 用例：置顶/取消置顶会话、标记会话、获取服务端会话列表。

**Why this priority**: 会话列表是 IM 客户端核心 UI 数据源。

**Independent Test**: 发送消息产生会话，置顶会话，获取置顶列表验证。

**Acceptance Scenarios**:

1. **Given** 已有单聊会话, **When** 置顶会话, **Then** 获取置顶会话列表包含该会话，且 `isPinned/pinnedTime/unReadCount/lastMessage` 变化要校验
2. **Given** 已置顶会话, **When** 取消置顶, **Then** 置顶列表不包含该会话
3. **Given** 已有会话, **When** 标记会话, **Then** 获取标记列表包含该会话，且 `marks`/相关字段要校验
4. **Given** 已标记会话, **When** 取消标记, **Then** 标记列表不包含该会话，且 `marks` 变化要校验

---

### User Story 8 - 聊天室管理（Priority: P3）

迁移聊天室模块的 Webim 用例：创建/销毁聊天室、加入/退出、管理员/黑名单/白名单/禁言、属性、公告、回调事件。

**Why this priority**: 聊天室是独立场景，优先级低于单聊/群聊。

**Independent Test**: 创建聊天室、加入、设置属性、验证回调事件、退出、销毁。

**Acceptance Scenarios**:

1. **Given** 已登录用户, **When** 创建聊天室, **Then** 返回聊天室 ID，且基础字段逐项验证；聊天室消息 case 若有则并入本模块
2. **Given** 已创建聊天室, **When** user2 加入, **Then** 已加入列表包含该聊天室，owner 收到 memberPresence 事件
3. **Given** user2 已加入聊天室, **When** user2 退出, **Then** 已加入列表不包含该聊天室
4. **Given** 聊天室 owner, **When** 修改描述/公告, **Then** 获取详情返回新内容，成员收到回调事件
5. **Given** 聊天室 owner, **When** 设置/移除管理员, **Then** 操作成功，成员收到回调事件
6. **Given** 聊天室 owner, **When** 添加/移除黑名单/白名单/禁言, **Then** 对应列表正确更新
7. **Given** 聊天室 owner, **When** 设置/获取/移除属性, **Then** 属性正确更新，成员收到属性变更事件
8. **Given** 已登录用户, **When** 销毁聊天室, **Then** 成员收到 destroy 事件，且回调 payload 逐字段校验

---

### User Story 9 - Reaction（Priority: P3）

迁移消息 Reaction 模块的 Webim 用例：添加/移除 Reaction、获取 Reaction 列表。

**Why this priority**: Reaction 是增值功能，优先级较低。

**Acceptance Scenarios**:

1. **Given** user1 已发送消息, **When** user2 添加 Reaction, **Then** 获取 Reaction 详情包含该 Reaction，且返回结构逐项校验，`reaction/count/isAddedBySelf/userList/cursor` 不能只断存在
2. **Given** 已添加 Reaction, **When** 移除 Reaction, **Then** Reaction 列表为空
3. **Given** 已登录用户, **When** 重复添加相同 Reaction, **Then** 返回错误，错误码/消息对齐 robot
4. **Given** 已登录用户, **When** 对不存在的消息添加 Reaction, **Then** 返回错误，错误结构对齐 robot

---

### Edge Cases

- 网络超时：WebSocket 连接建立超时或 provision 超时
- Token 过期：测试执行过程中 token 过期需要自动续期或重新获取
- 事件乱序：多个事件同时到达时的处理（需要事件缓冲池）
- 并发操作：两个用户同时操作同一资源（如同时加好友）
- 数据残留：上一次测试失败后残留数据影响下一次测试

---

## 架构设计

### 1. Token 获取策略

Robot 通过 REST API 用密码换取 token（`grant_type: password`）。迁移后采用相同策略：

```ts
// tests/e2e/fixtures/sdk-flow.ts
async function fetchUserToken(appKey: string, userId: string, password: string): Promise<string>
```

- 测试启动时通过 REST API 获取 token，而非在 `.env` 中硬编码
- `.env` 改为配置 `EASEMOB_APPKEY`、`EASEMOB_USERID`、`EASEMOB_PASSWORD`（以及 second/third user）
- REST 地址通过 `EASEMOB_REST_URL` 配置（默认 `https://a1.easemob.com`），支持私有部署
- 保留 `EASEMOB_TOKEN` 作为可选覆盖（手动指定 token 时跳过自动获取）

### 2. 数据清理策略

对标 robot 的 Setup/Teardown 模式：

```ts
// 每个测试文件的 beforeAll/afterAll 负责清理
beforeAll(async () => {
  // 清理残留数据（好友关系、群组等）
  await cleanupContacts(clientA, clientB);
});

afterAll(async () => {
  // 恢复初始状态
  await cleanupContacts(clientA, clientB);
  await clientA.logout();
  await clientB.logout();
});
```

- 群组测试：afterAll 中销毁所有测试创建的群组
- 聊天室测试：afterAll 中销毁所有测试创建的聊天室
- 好友测试：beforeAll 中清除所有好友关系

### 3. 事件缓冲池

对标 robot 的 WebSocket Cache Mode，实现事件收集器：

```ts
// tests/e2e/fixtures/sdk-api.ts
class EventCollector {
  private events: Map<string, unknown[]> = new Map();

  /** 注册到 client 的 eventHandler，按事件类型缓存 */
  bind(client: ChatClient, handlerId: string): void;

  /** 等待指定事件到达，支持超时 */
  async waitForEvent(eventName: string, timeout?: number): Promise<unknown>;

  /** 等待满足条件的事件 */
  async waitForEventMatching(
    eventName: string,
    predicate: (payload: unknown) => boolean,
    timeout?: number
  ): Promise<unknown>;

  /** 清空缓存 */
  clear(): void;

  /** 解绑 */
  unbind(client: ChatClient, handlerId: string): void;
}
```

核心行为：
- 事件到达时立即缓存，不依赖接收顺序
- `waitForEvent` 先检查缓存，缓存无则等待新事件到达
- 超时后抛出明确错误（包含已收到的事件列表，便于排查）

### 4. 多账号支持

扩展 `.env` 配置：

```env
EASEMOB_APPKEY=your-appkey
EASEMOB_USERID=user1
EASEMOB_PASSWORD=password1
EASEMOB_TOKEN=              # 可选，手动覆盖
EASEMOB_SECOND_USERID=user2
EASEMOB_SECOND_PASSWORD=password2
EASEMOB_SECOND_TOKEN=       # 可选
EASEMOB_THIRD_USERID=user3  # ThreeUsers 场景
EASEMOB_THIRD_PASSWORD=password3
EASEMOB_THIRD_TOKEN=        # 可选
EASEMOB_GROUP_ID=           # 预置群组 ID
EASEMOB_CHATROOM_ID=        # 预置聊天室 ID
```

多实例创建模式（绕过单例）：

```ts
function createClient(appKey: string): ChatClient {
  (ChatClient as any).instance = null;
  return ChatClient.init({ appKey, useFixedDeviceId: true });
}
```

### 5. 日志与排错

测试失败时需要足够信息排查问题：

- 每个测试用例开始时记录 testName + timestamp
- 事件收集器超时时输出：已等待时间、期望事件名、已收到的所有事件列表
- API 调用失败时输出：完整 error 对象（code + message + details）
- 使用 Playwright 的失败上下文输出 browser context 状态和最近事件

### 6. 精确断言策略

对标 robot 的 DeepDiff + Exclude 模式，迁移后使用精确字段断言：

```ts
// 不使用 toMatchObject（太宽松），使用精确字段断言
expect(err.code).toBe(ERROR_CODES.AUTH_UNAUTHORIZED);
expect(err.message).toBe('Provision rejected');

// 对于返回结构，逐字段验证
expect(result.userId).toBe(expectedUserId);
expect(result.nickname).toBe(expectedNickname);
// 动态字段单独验证类型
expect(typeof result.timestamp).toBe('number');
```

---

## 文件结构

```text
tests/e2e/
├── fixtures/
│   ├── sdk-flow.ts               # 真实 demo 页面流程封装
│   └── sdk-api.ts                # 多页面多账号 API 封装与事件收集
└── api/
    ├── auth.spec.ts              # 登录注册
    ├── contact.spec.ts           # 好友管理
    ├── user-info.spec.ts         # 用户信息
    ├── presence.spec.ts          # 在线状态
    ├── conversation-manage.spec.ts # 会话管理（含 REST 相关断言）
    ├── group.spec.ts             # 群组管理
    ├── chatroom.spec.ts          # 聊天室管理（含聊天室消息 case）
    ├── message-single.spec.ts    # 单聊消息
    ├── message-group.spec.ts     # 群聊消息
    └── reaction.spec.ts          # Reaction
```

---

## Test Layer Requirements

### Unit Tests

- Coverage goals: N/A — 本 spec 不涉及新业务逻辑，仅迁移测试用例
- Not applicable rationale: 迁移的是端到端真实环境测试，不产生需要单测的代码

### Integration Tests

- Coverage goals: N/A
- Not applicable rationale: 同上

### E2E Tests

- Coverage goals: 本 spec 产出的就是真实环境 E2E 测试
- Planned location: `tests/e2e/api/`
- 运行方式: `npm run test:e2e`

### Gate Impact

- Required gates: 不纳入 `test:gate:pr`（需要真实环境凭证）
- Validation notes: 通过 `npm run test:e2e` 独立执行，CI 中作为可选 nightly job

---

## Requirements

### Functional Requirements

- **FR-001**: 每个迁移的测试用例 MUST 对标 robot `Resource/*.resource` 的验证逻辑，按成功/失败/事件/动态字段拆分精确断言
- **FR-002**: 测试 MUST 支持通过 REST API 自动获取 token，不依赖手动配置
- **FR-003**: 测试 MUST 在 beforeAll/afterAll 中清理测试数据，确保用例间隔离
- **FR-004**: 事件等待 MUST 使用缓冲池模式，容忍事件乱序到达
- **FR-005**: 需要多账号的测试 MUST 在缺少对应账号配置时自动 skip
- **FR-006**: 测试失败时 MUST 输出足够的上下文信息（连接状态、已收事件、错误详情）
- **FR-007**: 所有 API 返回值断言 MUST 使用精确匹配（toBe/toEqual），动态字段只允许类型/格式断言，不使用 toMatchObject
- **FR-010**: 浏览器 E2E MUST 与 `tests/e2e/README.md` 的真实 demo 路线保持一致，不再回退到 `tests/real-env/` / Node polyfill 方案
- **FR-008**: `[Tags] Mobile` 用例中涉及本地数据库操作的 MUST NOT 迁移
- **FR-009**: `[Tags] ThreeUsers` 用例 MUST 支持第三账号配置，缺少时 skip

### Key Entities

- **EventCollector**: 事件缓冲池，按事件类型缓存，支持异步等待
- **TokenProvider**: REST API token 获取器，支持缓存和自动续期
- **MultiClientManager**: 多 ChatClient 实例管理，处理单例绕过和生命周期

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: 所有 Webim 标记的 robot 用例（非 WebimFailed/Unstable）在 browser E2E 中有对应测试
- **SC-002**: `npm run test:e2e` 在有效凭证下全部通过
- **SC-003**: 测试失败时日志信息足以定位问题，无需额外调试
- **SC-004**: 单次完整运行时间 < 5 分钟（含网络延迟）
- **SC-005**: 测试间无数据依赖，可单独运行任意测试文件

---

## Clarifications

### Session 2026-05-21

- Q: Token 获取的 REST API 地址策略？ → A: 从 `.env` 新增 `EASEMOB_REST_URL` 变量，支持私有部署环境（默认值 `https://a1.easemob.com`）
