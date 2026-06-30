# 功能规格：ChatRoomManager API 迁移、聊天室对象化与事件标准化

**Feature Branch**: `028-chatroom-manager-api`  
**Created**: 2026-04-09  
**Status**: Draft  
**Input**: 用户需求："参考 027 group manager 写 028 chatroom manager spec，这部分把原工程 `/Users/zhangdong/code/websdk-new/packages/IM/sdk/src/apis/chatRoomApi.ts` 这部分 api 迁移过来，命名按照新规范。rest api 的返回数据你对比一下是不是和群组是相同的，如果相同返回的数据结构就是一样的，如果接口不一样也不能确定返回的数据结构就向我要。仿照群组部分的实现，也提供一个 chatroom 对象，参考移动端 `getId/getName/getDescription/getOwner/getAdminList/getMemberCount/getMaxUsers/getMemberList/getBlacklist/getMuteList/getWhitelist/isAllMemberMuted/getAnnouncement/getChatRoomPermissionType/getCreateTimestamp/isInWhitelist/getMuteExpireTimestamp`，属于聊天室的方法放在 chatroom 对象上。事件监听部分原工程在 `/Users/zhangdong/code/websdk-new/packages/IM/sdk/src/handleMessages/handleMucMsg.ts`，可参考移动端拆分事件。"

**Reference**:

- 原工程 ChatRoom API：`/Users/zhangdong/code/websdk-new/packages/IM/sdk/src/apis/chatRoomApi.ts`
- 原工程聊天室类型：`/Users/zhangdong/code/websdk-new/packages/IM/sdk/src/types/chatRoomApi.ts`
- 原工程聊天室事件分发：`/Users/zhangdong/code/websdk-new/packages/IM/sdk/src/handleMessages/handleMucMsg.ts`
- 原工程聊天室事件类型说明：`/Users/zhangdong/code/websdk-new/packages/IM/sdk/src/types/eventHandler.ts`
- 当前事件系统规范：`/Users/zhangdong/code/websdk2/specs/004-event-system/spec.md`
- 当前 Manager 注册规范：`/Users/zhangdong/code/websdk2/specs/009-manager-usage/spec.md`
- 联系人/用户资料对象化参考：`/Users/zhangdong/code/websdk2/specs/025-contact-manager-api/spec.md`
- 用户资料查询规范：`/Users/zhangdong/code/websdk2/specs/026-user-info-manager-api/spec.md`
- 群组域拆分参考：`/Users/zhangdong/code/websdk2/specs/027-group-manager-api/spec.md`
- 命名规范：`/Users/zhangdong/code/websdk2/docs/reference/sdk-naming-conventions.md`

## Clarifications

### Session 2026-04-09

- Q: `ChatRoom` 同步访问器的语义应如何定义？ → A: `ChatRoom` 不提供同步访问器，也不暴露本地属性；它只作为单聊天室上下文的方法容器，整体参考 027 的 `Group` 对象模型。
- Q: `ChatRoom` 上的读取方法命名应如何收敛？ → A: 对齐 027 的 `Group` 风格，主读取入口收敛为 `getInfo()` 或 `refresh()`；成员、管理员、黑名单、allowlist、禁言、公告、属性等保留独立方法，不再提供字段级 getter。
- Q: 未确认成功响应样例的聊天室接口应如何收敛？ → A: 先列出未明确接口由需求方补样例；同时优先对照群组相同 REST API，若聊天室与群组使用同类 API 且群组返回契约已确认，则聊天室复用相同返回数据结构；仅对不同 API 或仍无法确认的接口继续索要样例。
- Q: 聊天室共享文件事件是否进入新的公开事件模型？ → A: 不进入；新聊天室事件模型严格按已确认的移动端事件列表收敛，不再额外公开共享文件事件。
- Q: `ChatRoomPermissionType` 是否进入 028 首期范围？ → A: 进入，但不再作为单独 getter 暴露；它作为 `getInfo()` 返回体中的 `permissionType` 字段提供。

### Session 2026-05-26

- Q: ChatRoomManager 事件命名是否继续保留 `WhiteList`？ → A: 不保留；公开事件统一改为 `onAllowListAdded` / `onAllowListRemoved`，payload 字段统一为 `allowlist`。
- Q: 聊天室成员加入/退出事件是否继续使用单数事件？ → A: 不保留；只保留 `onMembersJoined` / `onMembersExited`，单成员场景通过单元素 `members` 数组表达，并允许加入事件携带可选 `ext`。
- Q: 聊天室信息变更事件是否继续使用 `onSpecificationChanged`？ → A: 不保留；改为 `onChatRoomInfoChanged`，payload 为 `{ chatRoomId: string; chatRoomInfo: ChatRoomDetail }`。

## 设计决策

- 028 只覆盖旧 `chatRoomApi.ts` 中“聊天室”域公开能力与 `handleMucMsg.ts` 中聊天室分支对应事件，不包含群组、thread、消息收发主链路或新的 demo 页面。
- 本期统一通过 `client.chatRoomManager` 暴露聊天室域入口能力；旧 connection 层聊天室 API 名字、废弃别名、历史 typo 与白名单旧命名全部从公开 API、文档、类型与测试主路径中移除，不保留兼容层。
- 028 采用“`ChatRoomManager` + 轻量 `ChatRoom` 对象”的混合模型：聊天室列表与详情继续返回适合前端 state/缓存的 plain object；单聊天室上下文能力通过 `chatRoomManager.getChatRoom(chatRoomId)` 获取的 `ChatRoom` 对象访问。
- `ChatRoom` 对象对齐 027 的 `Group` 对象模型：不暴露同步访问器与本地属性，只承载单聊天室上下文的方法；聊天室详情读取统一收敛为 `getInfo()` / `refresh()`，成员、管理员、黑名单、allowlist、禁言、公告、共享文件列表/删除、属性等能力通过各自的显式方法访问。
- 公开 API 命名遵循当前 Web SDK 新规范：列表查询使用 `getXxxList`，读取使用 `getXxx`，写操作使用 `add/remove/update/set/mute/unmute/block/unblock/join/leave/destroy`；聊天室公开 API 不再保留 `modifyChatRoom`、`fetchChatRoomAnnouncement`、`getChatRoomSharedFilelist`、`getChatRoomMutelist` 等旧名。
- allowlist 相关公开 API 与事件统一使用 `allowlist` 命名，不再对外暴露 `whitelist` / `WhiteList`。
- 旧工程中聊天室成员、管理员、黑名单、allowlist、禁言列表、所有者这些返回结构，与 027 群组域已确认的接口形态高度同构；因此 028 对这些读取结果统一复用与群组一致的对象化用户视图和归一化规则，而不是继续返回裸 `userId` 字符串。
- 旧工程中聊天室接口若与群组使用同类 REST API 且群组返回契约已在 027 或现有样例中确认，028 直接复用相同业务数据结构；对已由 `docs/reference/chatroom-api.md` 补充样例的差异接口，按真实样例确认契约；仅当实现阶段发现 upstream 与样例/同构接口推断仍不一致时，才继续补充样例。
- 公开事件名覆盖移动端事件业务语义，但按 Web SDK 命名规范收敛；Web 侧 payload 做标准化与对象化，不再公开旧 `onChatroomChange` / `onChatroomEvent` 双轨模型。
- 旧工程聊天室 `uploadFile` / `deleteFile` 事件不进入新的公开事件模型；028 的公开聊天室事件严格收敛到已确认的移动端事件列表。
- 移动端重载事件在 Web 侧收敛为单个类型化事件：例如成员加入通过 `onMembersJoined` 的 `members` 数组表达，`ext` 作为可选字段放进同一 payload；`onMuteListAdded` 统一返回完整禁言条目集合，而不是同时维护多种重载签名。

### API 命名收敛

以下旧公开名字在 028 中统一收敛为新的主 API，旧名全部移除：

- `getChatRooms` -> `getChatRoomList`
- `getChatRoomDetails` -> `getChatRoomInfo`
- `modifyChatRoom` -> `updateChatRoomInfo`
- `removeChatRoomMember` / `removeChatRoomMembers` -> `removeMembers`
- `addUsersToChatRoom` -> `addMembers`
- `joinChatRoom` -> `joinChatRoom`
- `quitChatRoom` / `leaveChatRoom` -> `leaveChatRoom`
- `listChatRoomMember` / `listChatRoomMembers` -> `getMemberList`
- `getChatRoomAdmin` -> `getAdminList`
- `setChatRoomAdmin` -> `setAdmin`
- `removeChatRoomAdmin` -> `removeAdmin`
- `muteChatRoomMember` -> `muteMembers`
- `unmuteChatRoomMember` / `removeMuteChatRoomMember` -> `unmuteMembers`
- `getChatRoomMuted` / `getChatRoomMuteList` / `getChatRoomMutelist` -> `getMuteList`
- `blockChatRoomMember` / `blockChatRoomMembers` / `chatRoomBlockSingle` / `chatRoomBlockMulti` -> `blockMembers`
- `unblockChatRoomMember` / `unblockChatRoomMembers` / `removeChatRoomBlockSingle` / `removeChatRoomBlockMulti` -> `unblockMembers`
- `getChatRoomBlacklistNew` / `getChatRoomBlacklist` / `getChatRoomBlocklist` -> `getBlocklist`
- `disableSendChatRoomMsg` / `enableSendChatRoomMsg` -> `muteAllMembers` / `unmuteAllMembers`
- `addUsersToChatRoomWhitelist` / `addUsersToChatRoomAllowlist` -> `addUsersToAllowlist`
- `rmUsersFromChatRoomWhitelist` / `removeChatRoomWhitelistMember` / `removeChatRoomAllowlistMember` -> `removeUsersFromAllowlist`
- `getChatRoomWhitelist` / `getChatRoomAllowlist` -> `getAllowlist`
- `isChatRoomWhiteUser` / `isInChatRoomAllowlist` -> `checkIfInAllowList`
- `isInChatRoomMutelist` -> `isCurrentUserMuted`
- `fetchChatRoomAnnouncement` -> `getAnnouncement`
- `fetchChatRoomSharedFileList` / `getChatRoomSharedFilelist` -> `getSharedFileList`
- `deleteChatRoomSharedFile` -> `deleteSharedFile`
- `getChatRoomAttributes` -> `getAttributes`
- `setChatRoomAttributes` -> `setAttributes`
- `setChatRoomAttribute` -> `setAttribute`
- `removeChatRoomAttributes` -> `removeAttributes`
- `removeChatRoomAttribute` -> `removeAttribute`

## User Scenarios & Testing _(mandatory)_

### User Story 1 - 通过 ChatRoomManager 完成聊天室域公开 API 迁移 (Priority: P1)

作为 SDK 使用者，我希望通过 `client.chatRoomManager` 获得聊天室域入口能力，并能进一步通过 `chatRoomManager.getChatRoom(chatRoomId)` 获取单聊天室上下文对象，这样我既能继续把聊天室列表和详情当作 plain object 用于前端状态管理，也能在聊天室详情页、管理页等场景里用更自然的 `chatRoom.xxx()` 方式操作单个聊天室。

**Why this priority**: 你要求“参考 027 group manager 写 028 chatroom manager spec”，聊天室域入口能力与 `ChatRoom` 对象是整个功能的核心。如果只迁移 REST 方法而不收敛入口与对象模型，后续 API、文档和事件都会继续分裂。

**Independent Test**: 实现 `ChatRoomManager` 入口、`getChatRoom(chatRoomId)` 与 `ChatRoom` 对象职责划分，即可独立验证 028 的主要交付价值，不依赖聊天室事件即可验收。

**Acceptance Scenarios**:

1. **Given** 调用方使用 `client.use(ChatRoomManager)` 或 `ChatClient.init({ managers: [ChatRoomManager] })`，**When** 初始化完成，**Then** 聊天室域入口能力通过 `client.chatRoomManager.xxx()` 访问，而不是继续通过 connection 层聊天室 API 调用。
2. **Given** 调用方需要读取可加入聊天室列表，**When** 调用 `getChatRoomList()`，**Then** 返回标准化后的列表结果对象，不暴露原始 REST envelope，也不把列表项升级为 `ChatRoom` 富对象。
3. **Given** 调用方已持有某个 `chatRoomId`，**When** 调用 `chatRoomManager.getChatRoom(chatRoomId)`，**Then** 返回一个轻量 `ChatRoom` 对象，可在后续单聊天室上下文中继续调用读取与 mutation 方法，而不是依赖同步访问器或字段级 getter。
4. **Given** 调用方需要加入、退出、解散或修改聊天室，**When** 分别通过 `chatRoomManager.joinChatRoom()`、`chatRoom.leaveChatRoom()`、`chatRoom.destroy()`、`chatRoom.updateInfo()` 等入口发起操作，**Then** 使用统一驼峰字段表达参数，不再继续公开 `modifyChatRoom`、`quitChatRoom` 等旧命名。
5. **Given** 当前仓库的公开文档、类型导出与测试示例中存在旧聊天室 API 命名或把单聊天室方法全部挂在 manager 上的示例，**When** 完成 028，**Then** 这些入口必须切换到新的 `ChatRoomManager + ChatRoom` 分层模型，旧别名残留率为 0。

---

### User Story 2 - ChatRoom 对象按 Group 模式承载单聊天室方法，并复用群组同构数据结构 (Priority: P1)

作为 SDK 使用者，我希望 `ChatRoom` 对象像 027 的 `Group` 一样，只承担单聊天室上下文的方法容器角色，而不是再引入同步属性、同步访问器或字段级 getter；同时对同构的 REST 结果复用群组域已经确认的归一化结构和用户对象化策略，这样我在跨端迁移时可以保持一致的对象模型，不需要额外理解一套聊天室专属本地快照语义。

**Why this priority**: 你已明确 `ChatRoom` 要参考 027 的 `Group` 对象，而不是新增同步访问器模型。这会直接影响对象职责、测试策略和 API 文档呈现方式。

**Independent Test**: 单独验证 `ChatRoom` 的单聊天室读取与 mutation 方法挂载、聊天室详情/成员/管理员/黑名单/allowlist/禁言列表/公告读取与用户对象化策略，即可独立证明 028 完成了“Group 风格对象 + Web 标准化返回”的迁移。

**Acceptance Scenarios**:

1. **Given** 调用方通过 `chatRoomManager.getChatRoom(chatRoomId)` 获得 `ChatRoom` 对象，**When** 查看其公开能力，**Then** 该对象只暴露单聊天室上下文方法，不暴露同步属性、同步访问器或字段级 getter；如需读取聊天室详情字段与权限类型，应通过 `getInfo()` 或 `refresh()` 返回体获取。
2. **Given** 调用方在 `ChatRoom` 对象上调用聊天室详情、成员、管理员、黑名单、allowlist、禁言列表、公告等读取方法，**When** SDK 对外返回结果，**Then** 所有用户相关条目都必须遵循与 027 群组域一致的对象化规则，至少稳定提供 `userId`，不继续返回裸字符串数组作为默认业务模型。
3. **Given** 旧工程中聊天室详情、成员列表、管理员列表、禁言列表、黑名单、allowlist、公告、共享文件这些接口的类型结构与群组同构，**When** 新 SDK 归一化它们，**Then** 这些接口必须复用与群组域一致的业务对象结构和字段命名，而不是再造一套聊天室专属变体。
5. **Given** 缓存中缺少部分用户资料，**When** 调用上述用户相关读取接口，**Then** SDK 必须复用当前会话缓存并批量调用 `fetchUserInfoByUserId` 补齐缺失资料；当补齐失败时，仍需返回至少带 `userId` 的最小用户对象，而不是整体失败。

---

### User Story 3 - 通过 ChatRoomManager 统一监听聊天室事件，并按 Web SDK 规范收敛 (Priority: P1)

作为 SDK 使用者，我希望聊天室相关的 socket 下行事件都能通过 `chatRoomManager.addEventHandler()` 监听到，并且事件名按 Web SDK 规范收敛、载荷结构稳定、字段驼峰化、用户字段对象化，这样我就不需要继续兼容旧工程的 `onChatroomChange`、`onChatroomEvent` 与 `onPresence` 三套回调模型，也能减少跨端差异。

**Why this priority**: 你明确要求“事件监听部分参考移动端拆分事件”，并进一步确认公开命名需要按 GroupManager 的 Web SDK 口径收敛。对于 ChatRoomManager 来说，API 迁移如果缺少事件迁移，聊天室管理链路是不完整的。

**Independent Test**: 单独实现聊天室事件解码映射、事件名类型定义、事件注册入口与事件派发，即可独立验证 028 的第二条主链路，不依赖所有 REST API 完整实现。

**Acceptance Scenarios**:

1. **Given** 调用方通过 `client.chatRoomManager.addEventHandler('room-ui', { onChatRoomDestroyed, onMembersJoined, onAttributesUpdate })` 注册事件，**When** 收到对应的聊天室 MUC 事件，**Then** 对应回调可以收到覆盖移动端业务语义且符合 Web 命名规范的标准化 payload。
2. **Given** 旧 `handleMucMsg.ts` 中聊天室分支存在成员加入/退出、被移出聊天室、管理员变更、群主变更、公告变更、allowlist 变更、全员禁言、聊天室属性更新/删除等 operation，**When** 这些事件发生，**Then** 新 SDK 必须对外派发等价聊天室业务事件，而不是只覆盖 join/leave/destroy 基础事件。
3. **Given** 移动端存在成员加入与禁言列表的重载，**When** Web SDK 对外暴露事件，**Then** 单次派发的 payload 必须统一为一个稳定对象，其中 `members`、`ext`、`muteInfo` 等差异字段作为标准字段或可选字段承载。
4. **Given** 聊天室事件中涉及用户引用，**When** 事件对外派发，**Then** payload 中的 `members`、`operator`、`owner`、`admin`、`allowlist`、`muteList` 等用户字段必须采用与读取类 API 相同的对象化补齐策略。
5. **Given** 旧工程中某些聊天室事件只通过 `onChatroomEvent.operation` 表达，**When** 迁移到 028，**Then** 调用方只需要订阅新的多事件模型，不再需要解析原始 `operation` 字段。

---

### User Story 4 - 共享文件、公告与聊天室属性能力在 ChatRoom 对象上形成闭环 (Priority: P2)

作为 SDK 使用者，我希望聊天室公告、共享文件和聊天室属性相关能力都能收敛到 `ChatRoom` 对象上，并保持与群组域一致的命名与错误语义，这样我就能在单聊天室上下文里完成公告管理、文件管理和属性读写，不需要继续理解旧工程里分散的 callback 风格 API。

**Why this priority**: 这些能力是聊天室域的重要补充，但相对 manager 入口、对象化快照与事件迁移优先级略低，因此放在 P2。

**Independent Test**: 单独验证 `ChatRoom` 对象上的公告、共享文件列表/删除和属性读写能力，以及公告/属性相关事件派发，即可独立展示 028 的补充价值。

**Acceptance Scenarios**:

1. **Given** 调用方需要读取或更新聊天室公告，**When** 使用 `chatRoom.getAnnouncement()` / `chatRoom.updateAnnouncement()`，**Then** 查询接口使用 `get` 命名并返回标准化业务结果，不继续公开 `fetchChatRoomAnnouncement`。
2. **Given** 调用方需要管理聊天室共享文件，**When** 使用 `chatRoom.getSharedFileList()`、`chatRoom.deleteSharedFile()`，**Then** 这些接口都挂载在 `ChatRoom` 下，并遵循统一参数与错误语义；旧 `uploadSharedFile` 不再进入新的公开 API。
3. **Given** 调用方需要读取或修改聊天室属性，**When** 使用 `chatRoom.getAttributes()`、`chatRoom.setAttributes()`、`chatRoom.setAttribute()`、`chatRoom.removeAttributes()`、`chatRoom.removeAttribute()`，**Then** 这些接口必须与 `ChatRoom` 其余 API 保持同一命名、类型与文档风格。
4. **Given** 聊天室属性更新或删除事件发生，**When** `chatRoomManager` 派发 `onAttributesUpdate` 或 `onAttributesRemoved`，**Then** payload 中的属性键值、操作者与聊天室 ID 都必须使用标准化字段表达。

### Out of Scope

- 群组 API 与群组事件迁移。
- thread API 与 thread 事件迁移。
- 聊天室消息发送、消息回执、消息漫游或离线消息逻辑重构。
- 新增聊天室 demo 页面或新的真实环境 E2E 入口。

### Edge Cases

- `getChatRoomList()` 的真实成功响应结构目前未在仓库中沉淀样例；若与群组公开群列表不一致，plan/implement 阶段必须先向需求方索要样例，不能凭旧 TypeScript 声明猜字段。
- 聊天室成员数在事件里超过 2000 时可能不返回 `memberCount`；事件 payload 需允许该字段缺失，但不能因此丢事件。
- `joinChatRoom` 允许携带 `ext` 与 `leaveOtherRooms`；新 SDK 必须保留这两种语义，且不能因为附加字段存在就回退到 callback 风格。
- `ChatRoom` 不维护本地快照与同步属性，因此聊天室详情字段与 `permissionType` 都必须统一走 `getInfo()` 或 `refresh()` 的返回结果；系统不能隐式依赖半成品本地状态。
- `onRemovedFromChatRoom` 可能同时覆盖“被踢出聊天室”和“被加入黑名单”两类旧事件来源；新 SDK 必须通过 `reason` 或标准化原因字段区分。
- `onMuteListAdded` 既可能只有统一过期时间，也可能需要表达按用户区分的过期时间；Web 侧必须以统一条目结构表达，避免同一事件存在两套 payload 形态。
- allowlist 对外 API 与事件都必须使用 `allowlist`；文档与类型不得继续暴露 `whitelist` / `WhiteList`。
- 聊天室属性批量写入/删除存在部分成功、部分失败的旧响应语义；新 SDK 必须收敛为稳定业务对象或统一错误，不得直接透传服务端格式化结果。

## Test Layer Requirements _(mandatory)_

### Unit Tests

- Coverage goals: 覆盖 ChatRoomManager 参数校验、命名收敛后的输入输出归一化、`ChatRoom` 方法模型约束、列表/详情/成员/管理员/黑名单/allowlist/禁言列表的数据映射、用户资料补齐回退逻辑、聊天室权限类型判定、旧 MUC operation 到新事件 payload 的转换逻辑、属性事件映射、allowlist 事件名与 API 名称差异，以及旧别名移除后的类型与导出约束。
- Planned location: `tests/unit/managers/chatroom-manager.test.ts`、`tests/unit/chatroom/chatroom.test.ts`、`tests/unit/chatroom/chatroom-event-mapper.test.ts`、`tests/unit/chatroom/chatroom-event-user-info-resolver.test.ts`、`tests/types/chatroom-manager-types.test.ts`
- Not applicable rationale: N/A

### Integration Tests

- Coverage goals: 覆盖 ChatRoomManager 与 RestClient、UserInfoManager、CacheManager、EventHub、MUC 解码层之间的协作；验证“先主接口后资料补齐”“资料补齐失败不吞主结果”“REST envelope 到业务对象映射”“聊天室事件进入 EventHub 后由 ChatRoomManager 对外派发”“属性读写与属性事件协作”“列表/详情 contract 映射”。
- Planned location: `tests/integration/chatroom-manager/chatroom-manager.integration.test.ts`、`tests/integration/chatroom-manager/chatroom-events.integration.test.ts`
- Not applicable rationale: N/A

### E2E Tests

- Coverage goals: 评估通过现有 demo 或最小浏览器入口验证 ChatRoomManager 注册、基础调用链与聊天室事件派发；当前不新增聊天室管理 UI 主路径，但需明确本期不把 ChatRoomManager 纳入浏览器交互主路径。
- Planned location: 复用 `tests/e2e/` 现有结构；本期默认不新增用例。
- Not applicable rationale: 当前 demo 尚未提供聊天室管理主路径，028 的主要风险集中在 manager API、数据归一化与事件映射，不在浏览器 UI 交互层；因此本期以单元 + 集成为主，E2E 暂不新增，但后续若 demo 增加聊天室能力时需补齐。

### Gate Impact

- Required gates: `npm run test:gate:pr`
- Validation notes: PR gate 需覆盖 ChatRoomManager 单元与 mock-only 集成测试；Nightly/Release gate 暂不新增专属 E2E 前提，但未来若加入真实聊天室 demo 主链路，需把聊天室事件与聊天室管理调用纳入更高层门禁。

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: SDK MUST 提供 `ChatRoomManager`，并遵循 `specs/009-manager-usage/spec.md`，通过 `client.use(ChatRoomManager)` 或 `ChatClient.init({ managers: [ChatRoomManager] })` 绑定到 `client.chatRoomManager`。
- **FR-001A**: SDK MUST 提供 `chatRoomManager.getChatRoom(chatRoomId)`，返回绑定指定 `chatRoomId` 的轻量 `ChatRoom` 对象；该对象不承担本地状态真相职责，只作为单聊天室上下文 façade。
- **FR-002**: 028 的公开范围 MUST 覆盖旧 `chatRoomApi.ts` 中所有聊天室域公开 API，包括聊天室属性能力，但 MUST 排除群组、thread 与消息主链路重构。
- **FR-003**: 所有旧聊天室 API 的废弃别名、历史 typo 名、白名单旧命名与 connection 层旧入口 MUST 从公开 API、类型导出、文档示例与测试主路径中移除，不保留兼容层。
- **FR-004**: 聊天室读取类公开 API MUST 按新命名规范使用 `getXxx` / `getXxxList`，不得继续公开 `getChatRooms`、`getChatRoomDetails`、`fetchChatRoomAnnouncement`、`getChatRoomSharedFilelist`、`getChatRoomMutelist` 等历史名字。
- **FR-005**: `ChatRoomManager` MUST 提供至少以下主 API：`getChatRoomList`、`getChatRoomInfo`、`getChatRoom`、`joinChatRoom`。
- **FR-006**: `ChatRoom` MUST 对齐 027 的 `Group` 对象模型：不暴露同步属性与同步访问器，只作为单聊天室上下文的方法容器。
- **FR-007**: `ChatRoom` MUST 提供至少以下 mutation/远端读取能力：`getInfo` 或 `refresh`、`updateInfo`、`destroy`、`leaveChatRoom`、`addMembers`、`removeMembers`、`getAdminList`、`setAdmin`、`removeAdmin`、`getMemberList`、`muteMembers`、`unmuteMembers`、`getMuteList`、`muteAllMembers`、`unmuteAllMembers`、`blockMembers`、`unblockMembers`、`getBlocklist`、`addUsersToAllowlist`、`removeUsersFromAllowlist`、`getAllowlist`、`checkIfInAllowList`、`isCurrentUserMuted`、`getAnnouncement`、`updateAnnouncement`、`getSharedFileList`、`deleteSharedFile`、`getAttributes`、`setAttributes`、`setAttribute`、`removeAttributes`、`removeAttribute`。
- **FR-008**: 成员、黑名单、allowlist、禁言等集合操作 MUST 统一收敛为批量参数对象，公开入参统一使用 `userIds: ReadonlyArray<string>`；`setAdmin` / `removeAdmin` 继续保持单用户语义，不再对外暴露 `username` / `usernames` 混用、单个字符串重载或 single/multi 双入口。
- **FR-009**: `joinChatRoom` MUST 保留 `ext` 与 `leaveOtherRooms` 语义，并继续以 Promise 作为主语义，不得退回纯 callback 风格。
- **FR-010**: 所有 ChatRoomManager / ChatRoom API MUST 返回业务对象或 `void`；不得把服务端 `data/entities/path/uri/timestamp/duration` 等包装字段原样透传给调用方。
- **FR-011**: 所有 ChatRoomManager / ChatRoom API 在参数非法时 MUST 在发起网络请求前抛出统一 `ValidationError`；网络或业务失败 MUST 抛出统一 SDK 错误对象。
- **FR-012**: 原工程中返回 `userId` 列表、`owner`、`member`、`newadmin`、`oldadmin`、`user`、`member`、`newmembers` 等用户引用字段的聊天室读取接口与写接口结果，028 对外 MUST 返回对象化用户结果，而不是裸字符串。
- **FR-013**: 用户对象补齐 MUST 统一复用当前会话缓存；缓存缺失时 MUST 批量调用 `UserInfoManager.fetchUserInfoByUserId`，不得逐个串行拉取。
- **FR-014**: 当用户资料补齐失败、超时或仅部分命中时，只要主业务接口本身成功，SDK MUST 继续返回主业务结果，并以至少包含 `userId` 的最小对象回退。
- **FR-015**: `getInfo()` / `refresh()` 返回中的 `owner` 字段、`getAdminList`、`getMemberList`、`getBlocklist`、`getAllowlist`、`getMuteList` 与相关事件 MUST 全部使用同一套资料补齐策略与同一 `UserInfo` 业务对象视图。
- **FR-016**: 当前仓库聊天室域用户对象 MUST 直接复用 `UserInfo` 公开字段语义，至少支持 `userId`、`nickname`、`avatarUrl`、`mail`、`phone`、`gender`、`sign`、`birth`、`ext`。
- **FR-017**: `getChatRoomInfo` MUST 返回标准化后的聊天室详情对象，并对 `id/name/description/maxusers/owner/created/mute/affiliations_count/affiliations/public/membersonly/allowinvites/custom/shieldgroup` 等旧字段完成驼峰化和业务语义收敛。
- **FR-018**: `getChatRoomInfo`、`getMemberList`、`getAdminList`、`getMuteList`、`getBlocklist`、`getAllowlist`、`getAnnouncement`、`getSharedFileList` 当前已可从旧类型定义看出与群组域同构或近同构；028 对这些接口 MUST 复用与 027 对应业务对象一致的字段命名与数据结构。
- **FR-020**: `getChatRoomList` MUST 返回标准化后的列表结果对象，至少包含 `items` 与分页字段；若真实 REST 响应与当前推断不一致，plan/implement 阶段 MUST 先基于真实样例调整契约，再开始实现。
- **FR-021**: 聊天室创建能力不属于当前 `ChatRoomManager` 公开面，不得继续公开 `createChatRoom`。
- **FR-022**: `updateChatRoomInfo` MUST 作为推荐的聊天室信息更新入口，至少支持名称、描述、最大人数等旧工程已支持的可变字段。
- **FR-023**: `muteAllMembers` / `unmuteAllMembers` MUST 作为全员禁言公开 API 名称，取代旧 `disableSendChatRoomMsg` / `enableSendChatRoomMsg`。
- **FR-024**: allowlist 相关公开命名 MUST 统一使用 `allowlist`，不得再对外暴露 `whitelist` / `WhiteList`；事件名 MUST 使用 `onAllowListAdded` / `onAllowListRemoved`，payload 字段 MUST 使用 `allowlist`。
- **FR-025**: `ChatRoom` 的单聊天室读取能力 MUST 通过显式方法语义返回结果；系统不得在对象属性、同步访问器或字段级 getter 上暴露聊天室状态，以免引入不透明的本地快照语义。
- **FR-025A**: 聊天室详情字段读取 MUST 统一收敛到 `getInfo()` 或 `refresh()` 的返回对象；不得再额外提供 `getName`、`getOwner`、`getCreateTimestamp` 这类字段级 getter。
- **FR-026**: `getInfo()` 或 `refresh()` 的返回结果 MUST 包含 `permissionType` 字段，用于表达当前用户在聊天室中的权限视图，并至少能区分聊天室所有者、管理员、普通成员与未知/未加入状态。
- **FR-027**: `checkIfInAllowList`、`isCurrentUserMuted` 与 `getInfo()` / `refresh()` 返回中的当前用户状态字段 MUST 对外暴露“当前登录用户在当前聊天室中的 allowlist/禁言状态”语义；若需要禁言到期时间，必须通过标准化返回对象字段提供，不得新增 `getMuteExpireTimestamp` 这类字段级 getter，也不得要求调用方自行拼装旧 `isChatRoomWhiteUser` 或 `isInChatRoomMutelist` 返回结构。
- **FR-028**: `getSharedFileList` MUST 使用统一列表查询命名；共享文件条目 MUST 使用驼峰字段，如 `fileId`、`fileName`、`fileOwner`、`fileSize`、`createdAt`。
- **FR-029**: 聊天室共享文件公开能力本期 MUST 只覆盖列表读取与删除；`uploadSharedFile` MUST 从 028 的公开 API、类型、文档与测试范围中移除，不继续迁移旧 callback-only 上传入口。
- **FR-030**: `getAttributes` MUST 采用 `getAttributes({ keys?: string[] })` 形式，支持“按 keys 查询指定属性”与“不传 keys 获取全部属性”两种语义；其结果 MUST 归一化为标准聊天室属性视图，而不是旧 REST 包装结构。
- **FR-031**: `setAttributes`、`setAttribute`、`removeAttributes`、`removeAttribute` MUST 把旧工程属性接口的部分成功/部分失败结果收敛为稳定业务对象或统一错误，不得继续直接暴露 `successKeys/errorKeys/status` 的原始结构作为默认返回模型。
- **FR-032**: `ChatRoomManager` MUST 提供类型化事件注册入口 `addEventHandler(id, handlers)` 与 `removeEventHandler(id)`，并遵循 `specs/004-event-system/spec.md` 的 Manager 事件约束。
- **FR-033**: 028 MUST 在统一事件系统中新增 ChatRoomManager 专属事件类型定义；调用方只能在 `chatRoomManager.addEventHandler()` 上订阅聊天室域事件。
- **FR-034**: 028 MUST 以 `handleMucMsg.ts` 中聊天室分支为范围来源，把所有聊天室相关 MUC operation 映射到覆盖移动端业务语义、但按 Web SDK 命名规范收敛的 ChatRoomManager 公开事件模型。
- **FR-035**: ChatRoomManager 的公开事件名 MUST 至少包含 `onChatRoomDestroyed`、`onMembersJoined`、`onMembersExited`、`onRemovedFromChatRoom`、`onMuteListAdded`、`onMuteListRemoved`、`onAllowListAdded`、`onAllowListRemoved`、`onAllMemberMuteStateChanged`、`onAdminAdded`、`onAdminRemoved`、`onOwnerChanged`、`onAnnouncementChanged`、`onChatRoomInfoChanged`、`onAttributesUpdate`、`onAttributesRemoved`。
- **FR-035A0**: ChatRoomManager 公开事件名 MUST 移除 `onWhiteListAdded`、`onWhiteListRemoved`、`onMemberJoined`、`onMemberExited`、`onSpecificationChanged`；单成员加入/退出也 MUST 通过 `onMembersJoined` / `onMembersExited` 的单元素 `members` 数组表达。
- **FR-035A**: 旧工程聊天室 `uploadFile` / `deleteFile` operation MUST NOT 作为新的 ChatRoomManager 公开事件继续暴露；如需内部兼容处理，必须限制在内部层，不进入公开事件类型。
- **FR-036**: `onMembersJoined` 的 payload MUST 允许携带可选 `ext` 字段，以承载旧 `joinChatRoom` 事件中的扩展信息；Web 侧不得再拆成两个不同事件名。
- **FR-037**: `onMuteListAdded` 的 payload MUST 统一表达完整禁言条目集合，并能同时覆盖“统一过期时间”与“按用户区分过期时间”两类旧事件语义。
- **FR-038**: `onRemovedFromChatRoom` MUST 至少稳定提供 `reason`、`chatRoomId`、`chatRoomName` 与被移除用户信息，以区分“被踢出聊天室”“被加入黑名单”等业务语义。
- **FR-039**: `onChatRoomInfoChanged` MUST 返回完整标准化后的聊天室对象，payload MUST 为 `{ chatRoomId: string; chatRoomInfo: ChatRoomDetail }`，而不是仅返回 patch 字段；当原始事件字段不足时，SDK MAY 受控补拉聊天室详情后再派发事件。
- **FR-040**: `onAttributesUpdate` 与 `onAttributesRemoved` MUST 返回标准化后的属性键值或属性键列表，并带上 `from` 语义字段，不能继续要求调用方自行解析旧 `ext` JSON。
- **FR-041**: 旧 `onChatroomChange`、`onChatroomEvent` 与旧 `eventData.operation` 双轨模型 MUST 不再作为 ChatRoomManager 的公开事件 API 保留。
- **FR-042**: 聊天室事件 payload 中涉及的用户引用 MUST 使用与读取类 API 相同的用户资料补齐策略，并以 `UserInfo` 或对象数组对外暴露；事件名虽与移动端对齐，但 Web 侧不得退回纯字符串用户字段模型。
- **FR-043**: 当聊天室事件的用户资料补齐失败时，SDK MUST 继续派发聊天室事件，不得因资料接口异常导致事件丢失。
- **FR-044**: 028 的文档、JSDoc、导出类型与示例 MUST 全部使用新的 ChatRoomManager / ChatRoom API 名称，并补充旧工程到新 SDK 的迁移说明。
- **FR-045**: ChatRoomManager 对外 API 文档 MUST 只展示入口、列表、创建、按 ID 获取 `ChatRoom`、加入聊天室与事件监听等全局能力；属于 `ChatRoom` 的单聊天室方法 MUST 从 manager 文档隐藏，并在 `ChatRoom` 小节中单独展示。
- **FR-046**: 028 的测试与实现 MUST 基于真实 REST 返回结构编写；若聊天室接口与群组使用同类 REST API 且群组返回契约已在 027 或现有样例中确认，则聊天室 MUST 复用相同业务数据结构。
- **FR-047**: 028 implement 阶段 MUST 以 `docs/reference/chatroom-api.md` 与 027 已确认的群组同构接口为准编写解析与测试；若实现阶段发现某个聊天室 endpoint 的 upstream 返回与当前样例或同构接口推断不一致，必须先回填新的真实样例，再调整契约与实现。
- **FR-048**: SDK MUST 在 `api-errors.json` 的 `common` 段新增 `chatroom` 错误分类，定义以下聊天室专属错误码：`CHATROOM_INVALID_ID`(700)、`CHATROOM_NOT_JOINED`(702)、`CHATROOM_PERMISSION_DENIED`(703)、`CHATROOM_MEMBERS_FULL`(704)、`CHATROOM_NOT_EXIST`(705)、`CHATROOM_OWNER_NOT_ALLOW_LEAVE`(706)、`CHATROOM_USER_IN_BLOCKLIST`(707)；并在 `error-codes.ts` 中导出对应的 `CHATROOM_` 前缀常量，与群组域 `GROUP_` 前缀常量保持对称。
- **FR-049**: 所有 ChatRoomManager / ChatRoom 公开 API 的客户端参数校验（chatRoomId 为空、userIds 为空等）MUST 统一使用 `ValidationError` + `ERROR_CODES.VALIDATION_REQUIRED`(110)，与现有 REST 层 `normalizeChatRoomId` / `normalizeChatRoomUserIds` 的校验模式保持一致；不得为参数校验引入新的错误码。
- **FR-050**: 聊天室属性 API（`setAttributes`、`setAttribute`、`removeAttributes`、`removeAttribute`）的服务端错误响应 MUST 按 HTTP 400 响应体中的 `error_code` 整数字段做细分映射：`60010` → `CHATROOM_PERMISSION_DENIED`(703)、`60011` → `CHATROOM_NOT_JOINED`(702)、`60012` → `SERVICE_LIMIT_EXCEEDED`(4)；不得将这三种场景统一归为 `INVALID_PARAM`(110) 或 `REST_BUSINESS_UNKNOWN`(303)。
- **FR-051**: 聊天室属性批量写入/删除的响应中包含 `successKeys` 与 `errorKeys` 时，SDK MUST 按以下规则判定：(1) 所有 key 都成功 → 正常返回；(2) 部分 key 成功、部分失败 → 返回 `ChatRoomAttributeMutationResult`，其中 `successKeys: string[]` 和 `errorKeys: Record<string, { code: ErrorCode; message: string }>` 均可访问，同时错误码设为 `PARTIAL_SUCCESS`(7)；(3) 所有 key 都失败 → 抛出 `SDKError`，错误码取第一个 errorKey 的映射码。
- **FR-052**: 聊天室属性 `errorKeys` 中每个 key 的错误描述 MUST 按以下字符串匹配规则映射为具体错误码：包含 `"is exceeding maximum limit"` → `SERVICE_LIMIT_EXCEEDED`(4)；包含 `"size of metadata"` + `"exceeds"` → `SERVICE_LIMIT_EXCEEDED`(4)；包含 `"is not part of you"` → `CHATROOM_PERMISSION_DENIED`(703)；包含 `"is not Legal"` 或 `"is not exist"` → `VALIDATION_REQUIRED`(110)；其他 → `REST_BUSINESS_UNKNOWN`(303)。
- **FR-053**: `joinChatRoom` 的服务端错误映射 MUST 补充以下场景：HTTP 403 + `error_description` 包含 `"member list is full"` → `CHATROOM_MEMBERS_FULL`(704)；HTTP 403 + `error_description` 包含 `"is in the blacklist"` → `CHATROOM_USER_IN_BLOCKLIST`(707)。
- **FR-054**: `leaveChatRoom` MUST 在客户端校验阶段检查当前用户是否为聊天室 owner 且配置不允许 owner 退出；若命中，MUST 抛出 `SDKError` + `CHATROOM_OWNER_NOT_ALLOW_LEAVE`(706)，不发起网络请求。
- **FR-055**: 聊天室 MUC 事件中 `ADD_MUTE`（`onMuteListAdded`）的 payload 解析 MUST 优先从 `ext` JSON 的 `user_mute_time` 对象中提取按用户区分的禁言到期时间戳；若 `ext` 解析失败或 `user_mute_time` 为空，MUST 回退到 `body.tos()` 用户列表 + 默认过期时间 `4638873600000`（约 2116 年），不得因解析失败丢弃事件。
- **FR-056**: 聊天室 MUC 事件中 `KICK`（`onRemovedFromChatRoom`）的 payload MUST 通过 `reason` 字段区分至少两种场景：`reason === "chatroom kick offline user"` 表示因离线被踢（`BE_KICKED_FOR_OFFLINE`），其他 reason 表示被管理员踢出（`BE_KICKED`）。
- **FR-057**: 聊天室 MUC 事件中 `PRESENCE`（`onMembersJoined`）和 `ABSENCE`（`onMembersExited`）的 payload 解析 MUST 优先从 `body.getMUCMembers()` 获取成员列表；若列表为空，MUST 回退到 `body.from().userName()` 作为单个成员；同时 MUST 携带 `memberCount` 字段（可选，允许缺失）。
- **FR-058**: `api-errors.json` 中聊天室属性 API（`setChatRoomAttributes`、`setChatRoomAttribute`、`removeChatRoomAttributes`、`removeChatRoomAttribute`）的错误定义 MUST 补充 `error_code` 字段级映射（60010/60011/60012），不得仅依赖 HTTP 状态码 + `error` 字符串做粗粒度匹配。

### Key Entities _(include if feature involves data)_

- **ChatRoomSummary**: 聊天室列表对象，表示可加入聊天室列表或已加入聊天室列表中的一项；至少包含 `chatRoomId`、`name`、`owner`、`memberCount`、`disabled` 等列表可稳定返回字段。
- **ChatRoomListResult**: 聊天室列表分页结果对象，表示 `getChatRoomList` 的查询结果；至少包含 `items` 与分页字段。
- **ChatRoom**: 由 `chatRoomManager.getChatRoom(chatRoomId)` 返回的轻量单聊天室对象，绑定固定 `chatRoomId`，只负责单聊天室读取与 mutation 方法；详情读取统一通过 `getInfo()` 或 `refresh()` 返回，不暴露同步属性、同步访问器或字段级 getter，也不作为列表项与前端 state 的主数据结构。
- **ChatRoomDetail**: 聊天室详情对象，表示单个聊天室的完整可读视图；至少包含基础信息、所有者、成员统计、`maxMembers`、扩展字段、公告与 `permissionType` 形式的当前用户权限视图；不暴露群组专属的邀请、公开群或成员准入配置字段。
- **ChatRoomPermissionType**: 当前登录用户在某个聊天室中的权限类型，至少可表示所有者、管理员、普通成员与未知/未加入。
- **ChatRoomMemberEntry**: 聊天室成员条目对象，表示成员列表中的一项；至少包含 `user`、`role`、`joinedAt` 等字段。
- **ChatRoomMuteEntry**: 聊天室禁言条目对象，表示禁言列表中的一项；至少包含 `user` 与禁言截止时间。
- **ChatRoomAllowlistEntry**: 聊天室 allowlist 条目对象，表示 allowlist 中的一项；至少包含 `user`。
- **ChatRoomBlocklistEntry**: 聊天室黑名单条目对象，表示黑名单中的一项；至少包含 `user`。
- **ChatRoomSharedFile**: 聊天室共享文件对象，至少包含 `fileId`、`fileName`、`fileOwner`、`fileSize`、`createdAt`。
- **ChatRoomAttributesSnapshot**: 聊天室属性读取结果对象，表示一个聊天室当前可见的属性键值集合。
- **ChatRoomEventPayloads**: ChatRoomManager 的一组公开事件载荷，按 Web SDK 命名规范拆分；每个事件按需携带 `chatRoomId`、`chatRoomName`、`members`、`operator`、`owner`、`admin`、`announcement`、`attributes`、`from`、`reason`、`muteList`、`allowlist`、`chatRoomInfo` 等字段，其中用户相关字段优先对象化为 `UserInfo` 或其数组，而 `onChatRoomInfoChanged` 中的 `chatRoomInfo` 必须是完整标准化聊天室对象。

### Assumptions & Dependencies

- `specs/009-manager-usage/spec.md` 已定义 manager 注册与访问方式；028 必须在该规范内完成 ChatRoomManager，不另起 connection 风格公开入口。
- `specs/004-event-system/spec.md` 已定义 Manager 事件模式；028 只允许新增 ChatRoomManager 专属事件类型，不回退到 `on/off` 或旧 presence-style API。
- `specs/026-user-info-manager-api/spec.md` 已确认 `fetchUserInfoByUserId` 可作为批量资料补拉入口；028 复用该能力，不再自建另一套用户资料查询协议。
- `specs/027-group-manager-api/spec.md` 已确认群组域对同构 REST 结构的标准化方式；028 对聊天室详情、成员、管理员、禁言列表、黑名单、allowlist、公告、共享文件等同构接口复用相同业务对象结构与字段命名。
- 公开事件模型已确认采用“移动端业务语义 + Web SDK 命名规范 + Web 对象化 payload”的方案：用户相关字段按 Web SDK 业务对象语义返回。
- 共享文件管理 API 仍在 028 范围内，但共享文件变更事件不纳入新的公开聊天室事件模型。
- 当前仓库尚未存在 `ChatRoomManager`、聊天室专属类型与聊天室事件类型；028 将补齐这些能力。
- 旧 `chatRoomApi.ts` 中若某些接口成功响应没有稳定业务载荷，028 可按 `Promise<void>` 或最小业务对象返回建模，但必须在 plan 阶段结合真实样例最终确认。
- 按 Constitution 要求，涉及真实 REST 结构解析与测试时必须基于真实返回样例；028 先按“与群组同类 REST API 是否已确认”做一轮收敛，仅对仍无法通过群组同类 API 确认的聊天室接口继续向需求方索要样例。
- 当前阶段不要求引入新的聊天室 demo 页面；因此 E2E 不新增，但后续若 demo 增加聊天室能力，应把 028 的核心路径纳入更高层验证。

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 旧 `chatRoomApi.ts` 中聊天室域公开能力在新 `ChatRoomManager` / `ChatRoom` 中迁移完成，功能缺失率为 0。
- **SC-002**: 新公开 API 面中，旧聊天室 API 名字、废弃别名、`whitelist` 旧命名与历史 typo 名残留率为 0。
- **SC-003**: 所有 ChatRoomManager / ChatRoom 读取与写入结果中的蛇形字段与原始 REST envelope 外泄率为 0。
- **SC-004**: 聊天室详情、成员、管理员、黑名单、allowlist、禁言列表、公告、共享文件这些与群组同构的读取接口，在新 SDK 中统一使用一致的业务对象结构，结构分叉率为 0。
- **SC-005**: 原本返回用户 ID 的聊天室接口与事件在新 SDK 中都能稳定返回对象化用户结果，最小 `userId` 可用率达到 100%。
- **SC-006**: 当资料补拉失败时，聊天室接口与聊天室事件仍能继续返回主业务结果，因资料接口异常导致的业务结果/事件丢失率为 0。
- **SC-007**: `handleMucMsg.ts` 中聊天室相关 operation 在新 SDK 中都能映射为 Web SDK 收敛后的 ChatRoomManager 公开事件，事件缺失率为 0。
- **SC-008**: 调用方只使用 `chatRoomManager.addEventHandler()` 即可完成聊天室事件订阅，旧 `onChatroomChange` / `onChatroomEvent` / `onPresence` 双轨公开模型残留率为 0。
- **SC-009**: `ChatRoom` 对象对齐 027 的 `Group` 模型，不暴露同步属性或同步访问器；所有单聊天室能力都通过方法暴露，对象模型分叉率为 0。
- **SC-010**: 单用户/多用户双入口收敛后，成员管理、管理员管理、黑名单、禁言、allowlist 等写接口的公开参数模型统一率达到 100%。
- **SC-011**: 发布后的公开文档、类型与示例中，ChatRoomManager 的调用方式全部符合 manager 规范与命名规范，错误示例残留率为 0。
- **SC-012**: ChatRoomManager 对外文档中，属于 `ChatRoom` 的单聊天室方法误挂在 manager 名下的残留率为 0。
- **SC-013**: 公开类型、文档和事件 payload 中 `onWhiteListAdded`、`onWhiteListRemoved`、`onMemberJoined`、`onMemberExited`、`onSpecificationChanged`、`whitelist` 残留率为 0。
