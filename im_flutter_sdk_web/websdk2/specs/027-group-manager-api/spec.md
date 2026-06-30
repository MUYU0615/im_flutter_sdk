# 功能规格：GroupManager API 迁移、命名收敛与事件标准化

**Feature Branch**: `027-group-manager-api`  
**Created**: 2026-04-08  
**Status**: Draft  
**Input**: 用户需求："写 027 spec, 这部分完成groupManager, 把原工程 `/Users/zhangdong/code/websdk-new/packages/IM/sdk/src/apis/groupApi.ts` group相关的api 迁移过来，废弃的api和名字都移除，api命名依照新规范执行，注意：需要封装api返回数据，现在返回userId的接口，需要先获取用户属性（缓存没有就用rest api）然后返回 User 对象。处理事件监听，包含的事件在 `/Users/zhangdong/code/websdk-new/packages/IM/sdk/src/handleMessages/handleMucMsg.ts`。对于不明确rest api返回的数据结构可以向我要"

**Reference**:

- 原工程 Group API：`/Users/zhangdong/code/websdk-new/packages/IM/sdk/src/apis/groupApi.ts`
- 原工程群事件分发：`/Users/zhangdong/code/websdk-new/packages/IM/sdk/src/handleMessages/handleMucMsg.ts`
- 当前事件系统规范：`/Users/zhangdong/code/websdk2/specs/004-event-system/spec.md`
- 当前 Manager 注册规范：`/Users/zhangdong/code/websdk2/specs/009-manager-usage/spec.md`
- 当前联系人域资料补齐参考：`/Users/zhangdong/code/websdk2/specs/025-contact-manager-api/spec.md`
- 当前用户资料查询规范：`/Users/zhangdong/code/websdk2/specs/026-user-info-manager-api/spec.md`
- 命名规范：`/Users/zhangdong/code/websdk2/docs/reference/sdk-naming-conventions.md`

## Clarifications

### Session 2026-04-08

- Q: GroupManager 中原本返回用户 ID 的接口，对外用户对象名称应如何收敛？ → A: 直接继续使用 `UserInfo` 作为 GroupManager 的公开用户对象名。
- Q:  / `getJoinedGroupList` 的公开返回形态应如何收敛？ → A: 统一返回分页结果对象，包含 `items` 和分页字段。
- Q: GroupManager 的公开事件模型应如何收敛？ → A: 覆盖移动端群事件业务语义，但公开事件名按 Web SDK 命名规范收敛，包括 `onInvitationReceived`、`onRequestToJoinReceived`、`onRequestToJoinAccepted`、`onRequestToJoinDeclined`、`onInvitationAccepted`、`onInvitationDeclined`、`onUserRemoved`、`onGroupDestroyed`、`onAutoAcceptInvitationFromGroup`、`onMuteListAdded`、`onMuteListRemoved`、`onAllowListAdded`、`onAllowListRemoved`、`onAllMemberMuteStateChanged`、`onAdminAdded`、`onAdminRemoved`、`onOwnerChanged`、`onMembersJoined`、`onMembersExited`、`onAnnouncementChanged`、`onSharedFileAdded`、`onSharedFileDeleted`、`onGroupInfoChanged`、`onGroupDisabledChanged`、`onGroupMemberAttributeChanged`、`onUserGroupNamecardUpdated`。
- Q: 事件载荷中的用户相关字段应如何表达？ → A: Web 事件载荷升级为标准化对象，用户相关字段返回 `UserInfo` 或对象数组。
- Q: 群详情类事件的群对象语义应如何定义？ → A: `onGroupInfoChanged` 与 `onGroupDisabledChanged` 返回完整标准化群对象；当事件原始字段不足时，允许补拉群详情后再派发。

### Session 2026-05-25

- Q: allowlist 事件是否继续保留移动端 `WhiteList` 命名？ → A: 不保留；公开事件统一改为 `onAllowListAdded` / `onAllowListRemoved`，payload 字段统一为 `allowlist`。
- Q: 成员加入/退出事件是否继续保留单数与复数两套事件？ → A: 不保留；只保留 `onMembersJoined` / `onMembersExited`，单成员场景通过单元素 `members` 数组表达。
- Q: 群信息与群禁用状态事件如何命名？ → A: `onSpecificationChanged` 改为 `onGroupInfoChanged`，payload 为 `{ groupId: string; groupInfo: GroupDetail }`；`onStateChanged` 改为 `onGroupDisabledChanged`，payload 为 `{ groupId: string; groupInfo: GroupDetail; disabled: boolean }`。
- Q: 群详情中的 `shieldgroup` 应如何对外命名？ → A: 对外命名为 `messageBlocked`，表示当前用户是否屏蔽该群消息，不表示群黑名单或群禁用。
- Q: `affiliations` / `affiliationsCount` 概念是否继续对外暴露？ → A: 不暴露；SDK 所有公开接口统一移除 `affiliations` 概念，只使用 `memberCount` 表达成员数量，原始 `affiliations` 数据仅可作为内部归一化来源。

### Session 2026-04-09

- Q: 是否要完全照搬移动端“列表也返回群对象、所有方法都挂在群对象上”的 OO 形式？ → A: 不完全照搬；保留群列表返回纯数据对象，新增 `groupManager.getGroup(groupId)` 返回轻量 `Group` 对象，仅把单群上下文的方法收敛到 `Group` 上。
- Q: `GroupManager` 与 `Group` 的职责如何划分？ → A: `GroupManager` 负责入口、列表、创建、按 ID 获取 `Group`、事件监听与全局能力；`Group` 负责单群上下文读取与操作，如成员、管理员、黑名单、allowlist、禁言、公告、共享文件、成员属性与单群 mutation。
- Q: 对外 API 文档应如何呈现这层拆分？ → A: `GroupManager` 对外文档只展示入口与全局能力；属于 `Group` 对象的方法从 GroupManager 对外 API 文档中隐藏，并以 `groupManager.getGroup(groupId)` 后的调用方式展示。

## 设计决策

- 027 只覆盖旧 `groupApi.ts` 中“群组”域公开能力，不包含聊天室能力、thread 能力与 `blockGroupMessages` 这类移动端限定接口。
- 本期统一通过 `client.groupManager` 暴露群组域入口能力；旧 connection 层 group API 名字、废弃别名、历史 typo 名与白名单命名全部从公开 API、文档、类型与测试主路径中移除，不保留兼容层。
- 027 采用“`GroupManager` + 轻量 `Group` 对象”的混合模型：群列表继续返回适合前端 state/缓存的纯数据对象；单群上下文能力通过 `groupManager.getGroup(groupId)` 获取的 `Group` 对象访问，不把列表结果整体升级为富对象数组。
- 原工程中“单用户 / 多用户”分裂的管理接口统一收敛为批量风格：`userIds: string[]` 为唯一公开输入形态。单用户场景通过单元素数组表达，不再同时维护 `removeGroupMember` / `removeGroupMembers` 这类双入口。
- 原工程中直接返回 `userId`、`username`、`member`、`owner`、`userlist` 的接口，本期统一返回对象化用户视图；当前仓库已有统一 `UserInfo` 模型，因此 027 直接复用 `UserInfo` 作为 GroupManager 的公开用户对象；群事件中的用户相关字段也遵循同一对象化规则。
- 用户资料补齐策略统一复用当前会话缓存与 `UserInfoManager.fetchUserInfoByUserId`：缓存命中优先，缺失批量补拉，补拉失败时保底返回至少带 `userId` 的最小用户对象，不得因资料接口失败吞掉主业务结果或事件。
- 群事件不再继续公开旧工程的 `onGroupChange` / `onPresence` 双轨回调模型，而是统一收敛到 `groupManager.addEventHandler()` 下的类型化多事件入口；公开事件覆盖移动端群事件业务语义，但命名按 Web SDK 规范收敛。
- `onGroupInfoChanged` 与 `onGroupDisabledChanged` 这类群详情事件，统一返回完整标准化群对象；若原始事件字段不足以组装完整对象，可在派发前受控补拉群详情。
- `Group` 对象不是本地状态真相，也不承担自动同步职责；它只是绑定了 `groupId` 的单群 façade，前端状态层仍推荐使用 `GroupSummary` / `GroupDetail` 等纯数据对象。
- 027 需要覆盖 `handleMucMsg.ts` 中所有群组分支对应的业务事件，包括但不限于群创建、群解散、申请入群、邀请入群、成员加入/离开/移除、群信息更新、群禁用状态更新、群主管理员变更、成员禁言/全员禁言、黑名单、allowlist、公告、共享文件、成员属性更新等；聊天室与 thread 分支不在本期范围。

### API 命名收敛

以下旧公开名字在 027 中统一收敛为新的主 API，旧名全部移除：

- `listGroups` / `getPublicGroups` 不再作为公开 API 维护
- 旧 `getJoinedGroups` -> `getJoinedGroupList`
- 旧工程里承担“已加入群列表”语义的 `getGroup` 旧名在 027 中废弃；`getGroup` 重新保留给“按 `groupId` 获取轻量 `Group` 对象”的新语义
- `modifyGroup` -> `updateGroupInfo`
- `listGroupMember` / `listGroupMembers` -> `getGroupMemberList`
- `getGroupAdmin` -> `getGroupAdminList`
- `groupBlockSingle` / `groupBlockMulti` / `blockGroupMember` / `blockGroupMembers` -> `blockGroupMembers`
- `removeGroupBlockSingle` / `removeGroupBlockMulti` / `unblockGroupMember` / `unblockGroupMembers` -> `unblockGroupMembers`
- `getGroupBlacklistNew` / `getGroupBlacklist` / `getGroupBlocklist` -> `getGroupBlocklist`
- `addUsersToGroupWhitelist` / `addUsersToGroupAllowlist` -> `addUsersToGroupAllowlist`
- `rmUsersFromGroupWhitelist` / `removeGroupWhitelistMember` / `removeGroupAllowlistMember` -> `removeUsersFromGroupAllowlist`
- `getGroupWhitelist` / `getGroupAllowlist` -> `getGroupAllowlist`
- `isGroupWhiteUser` / `isInGroupWhiteList` / `isInGroupAllowlist` -> `checkIfInGroupAllowList`
- `mute` / `muteGroupMember` -> `muteGroupMembers`
- `removeMute` / `unmuteGroupMember` -> `unmuteGroupMembers`
- `getMuted` / `getGroupMuteList` / `getGroupMutelist` -> `getGroupMuteList`
- `disableSendGroupMsg` / `enableSendGroupMsg` -> `muteAllGroupMembers` / `unmuteAllGroupMembers`
- `fetchGroupAnnouncement` -> `getGroupAnnouncement`
- `fetchGroupSharedFileList` / `getGroupSharedFilelist` -> `getGroupSharedFileList`
- `changeOwner` / `changeGroupOwner` -> `changeGroupOwner`
- `dissolveGroup` / `destroyGroup` -> `destroyGroup`
- `quitGroup` / `leaveGroup` -> `leaveGroup`
- `inviteToGroup` / `inviteUsersToGroup` -> `inviteUsersToGroup`
- `agreeJoinGroup` / `acceptGroupJoinRequest` -> `acceptGroupJoinRequest`
- `rejectJoinGroup` / `rejectGroupJoinRequest` -> `rejectGroupJoinRequest`
- `agreeInviteIntoGroup` / `acceptGroupInvite` -> `acceptGroupInvite`
- `rejectInviteIntoGroup` / `rejectGroupInvite` -> `rejectGroupInvite`

### 参数形态收敛

- `removeGroupMembers({ groupId, userIds })` 取代单个/多个移除成员双 API。
- `blockGroupMembers({ groupId, userIds })` 与 `unblockGroupMembers({ groupId, userIds })` 作为唯一黑名单写入口。
- `muteGroupMembers({ groupId, userIds, muteDuration })` 与 `unmuteGroupMembers({ groupId, userIds })` 作为唯一禁言写入口。
- `addUsersToGroupAllowlist({ groupId, userIds })` 与 `removeUsersFromGroupAllowlist({ groupId, userIds })` 作为唯一 allowlist 写入口。
- `acceptGroupInvite` / `rejectGroupInvite` 不再要求传入冗余的 `invitee`；当前登录用户即受邀人。
- `getGroupInfo` 与 `getGroupInfoList` 拆分单查/批量查，避免沿用 `string | string[]` 的弱类型参数。

## User Scenarios & Testing _(mandatory)_

### User Story 1 - 通过 GroupManager 完成群组域公开 API 迁移 (Priority: P1)

作为 SDK 使用者，我希望通过 `client.groupManager` 获得群组域入口能力，并能进一步用 `groupManager.getGroup(groupId)` 获取单群上下文对象，这样我既能保持 Web 侧列表/状态数据的 plain object 体验，也能在群详情页等场景里用更自然的 `group.xxx()` 方式操作单个群。

**Why this priority**: 你明确要求“完成 GroupManager，并迁移旧工程 group 相关 API”，这是 027 的主目标。如果只迁移部分能力或继续保留旧名字，后续 plan 与实现会继续背着双轨 API 包袱。

**Independent Test**: 实现 `GroupManager` 的入口 API、`getGroup(groupId)` 与 `Group` 对象职责划分，即可独立验证 027 的主交付价值，不依赖事件系统即可验收。

**Acceptance Scenarios**:

1. **Given** 调用方使用 `client.use(GroupManager)` 或 `ChatClient.init({ managers: [GroupManager] })`，**When** 初始化完成，**Then** 群组域入口能力通过 `client.groupManager.xxx()` 访问，而不是继续通过 connection 层 group API 调用。
2. **Given** 调用方需要读取公开群列表或已加入群列表，**When** 分别调用 `()` 与 `getJoinedGroupList()`，**Then** 返回标准化的分页结果对象，至少包含 `items` 和分页字段，不暴露原始 REST envelope，也不把列表项升级为 `Group` 富对象。
3. **Given** 调用方已持有某个 `groupId`，**When** 调用 `groupManager.getGroup(groupId)`，**Then** 返回一个轻量 `Group` 对象，可在后续单群上下文中继续调用读取与 mutation 方法。
4. **Given** 调用方需要修改群信息，**When** 通过 `group.updateInfo()` 或等价单群入口发起更新，**Then** 使用统一驼峰字段表达可修改项，不再继续公开 `modifyGroup` 与蛇形字段。
5. **Given** 当前仓库的公开文档、类型导出与测试示例中存在旧 group API 命名或把单群方法全部挂在 `GroupManager` 的示例，**When** 完成 027，**Then** 这些入口都必须切换到新的主 API 名称与 `GroupManager + Group` 分层模型，旧别名残留率为 0。

---

### User Story 2 - 读取用户列表类结果时直接拿到对象化用户视图 (Priority: P1)

作为 SDK 使用者，我希望所有原本只返回 `userId` 或 `username` 的群组接口，在新 SDK 中都直接返回对象化的用户结果，这样我不需要额外手动再调一次用户资料接口，也不会在群成员、管理员、黑名单、禁言列表、已读用户列表这些场景里重复做资料拼装。

**Why this priority**: 这是你在输入中单独强调的要求，并且会直接影响 027 的 API 返回模型。如果不在 spec 阶段明确，后续实现容易退回“只返回 ID，再让业务自己补资料”的旧模式。

**Independent Test**: 单独验证 `Group` 对象上的成员列表、管理员列表、黑名单、allowlist、禁言列表与相关事件载荷的资料补齐逻辑，即可独立证明返回模型完成了从“ID 列表”到“业务对象列表”的迁移。

**Acceptance Scenarios**:

1. **Given** `group.getMembers()`、`group.getAdmins()`、`group.getBlocklist()`、`group.getAllowlist()`、`group.getMuteList()` 任一接口成功返回目标用户 ID 集合，**When** SDK 对外返回结果，**Then** 每个用户相关条目都必须带对象化用户视图，至少稳定提供 `userId`。
2. **Given** 当前会话缓存中已存在所需用户资料，**When** 调用上述接口，**Then** SDK 优先复用缓存，不重复发起资料补拉请求。
3. **Given** 缓存中缺少部分用户资料，**When** 调用上述接口或派发相关事件，**Then** SDK 必须批量调用 `fetchUserInfoByUserId` 补齐缺失资料，而不是逐个串行查询。
4. **Given** 用户资料补拉部分失败、超时或服务端未命中某些用户，**When** 主业务接口本身成功，**Then** SDK 仍需返回主业务结果，并对未补齐用户回退最小 `userId` 视图，而不是整体失败。
5. **Given** 某个 mutation 成功响应或事件 payload 中携带 `owner`、`member`、`userlist`、`username`、`invitee`、`applicant` 等历史用户字段，**When** SDK 对外归一化结果，**Then** 这些用户引用必须映射为对象化用户字段，而不是把原始 `userId` 字段原样透传为最终业务返回结构。

---

### User Story 3 - 通过 GroupManager 统一监听群事件，并覆盖旧 MUC 群事件范围 (Priority: P1)

作为 SDK 使用者，我希望群组相关的 socket 下行事件都能通过 `groupManager.addEventHandler()` 监听到，并且公开事件名符合 Web SDK 命名规范、载荷结构稳定、字段驼峰化，这样我就不需要同时兼容旧工程的 `onGroupChange`、`onGroupEvent` 与 `onPresence` 三套回调语义，也能减少跨端差异。

**Why this priority**: 你明确要求处理事件监听，并指定以 `handleMucMsg.ts` 为范围来源。对于 GroupManager 来说，API 迁移若缺少事件迁移，业务闭环是不完整的。

**Independent Test**: 单独实现群事件解码映射、事件名类型定义、事件注册入口与事件派发，即可独立验证 027 的第二条主链路，不依赖所有 REST API 完整实现。

**Acceptance Scenarios**:

1. **Given** 调用方通过 `client.groupManager.addEventHandler('group-ui', { onInvitationReceived, onRequestToJoinReceived, onGroupDestroyed })` 注册事件，**When** 收到对应的 MUC 群事件，**Then** 对应回调可以收到覆盖移动端业务语义且符合 Web 命名规范的标准化载荷。
2. **Given** 旧 `handleMucMsg.ts` 中存在群公告、共享文件、allowlist、全员禁言、成员属性更新等群事件分支，**When** 这些事件发生，**Then** 新 SDK 也必须对外派发等价业务事件，而不是只覆盖最基础的 join/leave/destroy。
3. **Given** 旧工程同一事件会同时触发 `onGroupChange` 与 `onGroupEvent`，**When** 迁移到 027，**Then** 新 SDK 只保留一套 GroupManager 的类型化事件模型，不再要求调用方理解旧双轨事件模型。
4. **Given** 群事件中涉及用户引用，**When** 事件对外派发，**Then** 事件载荷中的操作者、目标用户、申请人、受邀人、已读用户等字段也要走同一套资料补齐策略，并以对象化字段暴露，而不是只暴露裸字符串。
5. **Given** 群成员属性更新来自当前用户其他设备，**When** 对外派发事件，**Then** SDK 仍应通过 `onGroupMemberAttributeChanged` 等 GroupManager 事件暴露该变化，并显式标明其来源，而不是继续依赖未类型化的旧 `onMultiDeviceEvent`。
6. **Given** 触发 `onGroupInfoChanged` 或 `onGroupDisabledChanged` 时原始事件只包含部分群字段，**When** SDK 对外派发事件，**Then** 仍需返回完整标准化群对象；必要时允许先补拉群详情再派发。

---

### User Story 4 - 高阶群能力也遵循同一命名和返回模型 (Priority: P2)

作为 SDK 使用者，我希望群公告、群共享文件、群成员属性等相对高阶的群能力，也能在 `Group` 对象上以单群上下文方式使用，同时保持同一命名规则、同一错误模型和同一返回风格，这样我迁移时不需要在 `GroupManager` 里再面对一套“基础接口新风格 + 高阶接口旧风格”的混合设计。

**Why this priority**: 这些接口虽然优先级略低于群生命周期与事件主链路，但它们都位于旧 `groupApi.ts` 的群域范围内。如果 027 不一起规划，后续仍会留下大量“半迁移”能力。

**Independent Test**: 单独验证公告、共享文件、成员属性接口的命名收敛、分页/对象化结果和统一错误语义，即可独立展示 P2 价值。

**Acceptance Scenarios**:

1. **Given** 调用方需要读取或更新群公告，**When** 使用 `group.getAnnouncement()` / `group.updateAnnouncement()`，**Then** 查询接口使用 `get` 命名，返回业务对象，不继续公开 `fetchGroupAnnouncement`。
2. **Given** 调用方需要管理群共享文件，**When** 使用 `group.getSharedFileList()`、`group.uploadSharedFile()`、`group.deleteSharedFile()`、`group.downloadSharedFile()`，**Then** 这些接口都挂载在 `Group` 下，并遵循统一参数与错误语义。
3. **Given** 调用方需要设置或读取群成员属性，**When** 使用 `group.setMemberAttributes()` 与 `group.getMembersAttributes()`，**Then** 这些接口也必须与 `Group` 其余 API 保持同一命名、类型与文档风格；单成员读取通过 `getMembersAttributes({ userIds: [userId] })` 表达，不再公开单独的 `getMemberAttributes()`。

### Out of Scope

- 聊天室 API 与聊天室事件迁移。
- thread API 与 thread 事件迁移。
- 移动端限定的 `blockGroupMessages` / `blockGroup` 能力。
- 新增群组 demo 页面或新的真实环境 E2E 入口。

### Edge Cases

- 批量 `userIds` 输入存在重复值、空字符串、顺序混乱时，SDK 应如何去重并保持稳定返回顺序。
- 主业务接口成功但用户资料补齐失败时，如何保证返回结果与事件仍可用。
- 同一群事件可能同时包含 `groupName`、`reason`、`memberCount`、`announcement`、`detail` 等不同字段时，如何保证 payload 的判别字段稳定。
- `acceptGroupInvite` / `rejectGroupInvite` 移除 `invitee` 入参后，如何明确“当前登录用户即受邀人”的语义。
- 旧工程里只提供单用户删除 allowlist、单用户 membership check；新 SDK 需要明确批量能力与分页语义边界。
- 共享文件上传/下载保留进度回调时，Promise 主语义与回调副语义如何并存。
- 来自当前用户其他设备的群成员属性更新，如何通过 GroupManager 事件模型暴露且避免与普通群事件混淆。

## Test Layer Requirements _(mandatory)_

### Unit Tests

- Coverage goals: 覆盖 GroupManager 参数校验、命名收敛后的输入输出归一化、批量 `userIds` 去重与顺序保持、用户资料补齐回退逻辑、事件映射表、旧 MUC operation 到新事件 payload 的转换逻辑、旧别名移除后的类型与导出约束。
- Planned location: `tests/unit/managers/group-manager*.test.ts`、`tests/unit/group/group-event-mapper.test.ts`、`tests/unit/group/group-user-info-resolver.test.ts`、`tests/types/group-manager-types.test.ts`
- Not applicable rationale: N/A

### Integration Tests

- Coverage goals: 覆盖 GroupManager 与 RestClient、UserInfoManager、CacheManager、EventHub、MUC 解码层之间的协作；验证“先主接口后资料补齐”“资料补齐失败不吞主结果”“REST envelope 到业务对象映射”“群事件进入 EventHub 后由 GroupManager 对外派发”。
- Planned location: `tests/integration/group-manager/group-manager.integration.test.ts`、`tests/integration/group-manager/group-events.integration.test.ts`
- Not applicable rationale: N/A

### E2E Tests

- Coverage goals: 评估通过现有 demo 或最小浏览器入口验证 GroupManager 注册、基础调用链与群事件派发；当前不新增真实群组 UI 路径，但需明确本期不把 GroupManager 纳入浏览器交互主路径。
- Planned location: 复用 `tests/e2e/` 现有结构；本期默认不新增用例。
- Not applicable rationale: 当前 demo 尚未提供群组管理主路径，027 的主要风险集中在 manager API 与事件映射，不在浏览器 UI 交互层；因此本期以单元 + 集成为主，E2E 暂不新增，但需在后续若 demo 增加群能力时补齐。

### Gate Impact

- Required gates: `npm run test:gate:pr`
- Validation notes: PR gate 需覆盖 GroupManager 单元与 mock-only 集成测试；Nightly/Release gate 暂不新增专属 E2E 前提，但未来若加入真实群组 demo 主链路，需把群事件与群管理调用纳入更高层门禁。

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: SDK MUST 提供 `GroupManager`，并遵循 `specs/009-manager-usage/spec.md`，通过 `client.use(GroupManager)` 或 `ChatClient.init({ managers: [GroupManager] })` 绑定到 `client.groupManager`。
- **FR-001A**: SDK MUST 提供 `groupManager.getGroup(groupId)`，返回绑定指定 `groupId` 的轻量 `Group` 对象；该对象不承担本地状态真相职责，只作为单群上下文 façade。
- **FR-002**: 027 的公开范围 MUST 覆盖旧 `groupApi.ts` 中所有群组域公开 API，但 MUST 排除聊天室、thread 与移动端限定 `blockGroupMessages`。
- **FR-003**: 所有旧 group API 的废弃别名、历史 typo 名、白名单命名与 connection 层旧入口 MUST 从公开 API、类型导出、文档示例与测试主路径中移除，不保留兼容层。
- **FR-004**: 群组读取类公开 API MUST 按新命名规范使用 `getXxx` / `getXxxList`，不得继续公开 `listGroups`、`getGroup`、`getJoinedGroups`、`fetchGroupAnnouncement`、`getGroupSharedFilelist` 等历史名字。
- **FR-005**: `GroupManager` MUST 提供至少以下主 API：`createGroup`、`getJoinedGroupList`、`getGroup`、`getGroupInfo`、`getGroupInfoList`、`joinGroup`、`inviteUsersToGroup`、`acceptGroupJoinRequest`、`rejectGroupJoinRequest`、`acceptGroupInvite`、`rejectGroupInvite`。
- **FR-006**: `Group` MUST 提供至少以下成员/权限 API：`getMembers`、`removeMembers`、`getAdmins`、`setAdmin`、`removeAdmin`、`muteMembers`、`unmuteMembers`、`getMuteList`、`muteAllMembers`、`unmuteAllMembers`、`blockMembers`、`unblockMembers`、`getBlocklist`、`addUsersToAllowlist`、`removeUsersFromAllowlist`、`getAllowlist`、`checkIfInAllowList`、`isCurrentUserMuted`。
- **FR-007**: `Group` MUST 提供至少以下高阶 API：`getAnnouncement`、`updateAnnouncement`、`uploadSharedFile`、`deleteSharedFile`、`downloadSharedFile`、`getSharedFileList`、`setMemberAttributes`、`getMembersAttributes`、`getDetail` 或 `refresh`。
- **FR-008**: 单用户/多用户双 API MUST 统一收敛为批量参数对象，公开入参统一使用 `userIds: ReadonlyArray<string>`；不再对外暴露 `username` / `usernames` 混用、单个字符串重载或单独的 single/multi API。
- **FR-009**: `acceptGroupInvite` 与 `rejectGroupInvite` MUST 不再要求传入 `invitee`，而是以当前登录用户作为受邀对象来源。
- **FR-010**: `getGroupInfo` 与 `getGroupInfoList` MUST 拆分单查/批量查，禁止继续沿用 `groupId: string | string[]` 这类弱类型公开参数。
- **FR-011**: 所有 GroupManager / Group API MUST 以 Promise 作为主语义；如保留上传/下载进度等回调，仅可作为附加能力，不得替代 Promise 主返回模型；仅 `getGroup(groupId)` 允许同步返回轻量对象。
- **FR-012**: 所有 GroupManager / Group API MUST 返回业务对象或 `void`；不得把服务端 `data/entities/path/uri/timestamp/duration` 等包装字段原样透传给调用方。
- **FR-013**: 所有 GroupManager / Group API 在参数非法时 MUST 在发起网络请求前抛出统一 `ValidationError`；网络或业务失败 MUST 抛出统一 SDK 错误对象。
- **FR-014**: 原工程中返回 `userId` 列表或以 `username/member/owner/user/userlist` 表达用户的读取接口，027 对外 MUST 返回对象化用户结果，而不是裸字符串数组。
- **FR-015**: 原工程中 mutation 成功结果若包含用户引用字段，027 对外 MUST 归一化为对象化用户字段或对象化条目，不得继续透传旧 `userId` 字段作为最终业务模型。
- **FR-016**: 用户对象补齐 MUST 统一复用当前会话缓存；缓存缺失时 MUST 批量调用 `UserInfoManager.fetchUserInfoByUserId`，不得逐个串行拉取。
- **FR-017**: 当用户资料补齐失败、超时或仅部分命中时，只要主业务接口本身成功，SDK MUST 继续返回主业务结果，并以至少包含 `userId` 的最小对象回退。
- **FR-018**: `getMembers`、`getAdmins`、`getBlocklist`、`getAllowlist`、`getMuteList` MUST 全部使用同一套资料补齐策略与同一 `UserInfo` 业务对象视图。
- **FR-019**: 027 的群域用户对象 MUST 直接复用当前仓库 `UserInfo` 公开字段语义，至少支持 `userId`、`nickname`、`avatarUrl`、`mail`、`phone`、`gender`、`sign`、`birth`、`ext`。
- **FR-020**: `getJoinedGroupList` MUST 返回标准化后的分页结果对象，至少包含 `items` 与分页字段，并对群组条目完成字段驼峰化；不得暴露 `groupid/groupname/maxusers/membersonly/allowinvites/affiliations/affiliations_count` 等旧字段名。
- **FR-020A**: SDK 所有公开群组接口、事件 payload、文档与类型 MUST 移除 `affiliations` 与 `affiliationsCount` 概念；成员数量统一使用 `memberCount`，服务端原始 `affiliations` / `affiliations_count` 仅可作为内部归一化来源。
- **FR-020B**: `GroupDetail` MUST 将服务端原始 `shieldgroup` 归一化为 `messageBlocked`，表示当前用户是否屏蔽该群消息；不得对外暴露 `shieldGroup`，且不得把该字段用于表达群黑名单或群禁用状态。
- **FR-021**: `group.updateInfo()` MUST 作为推荐的群信息更新入口，至少支持群名称、群描述、是否公开、是否需审批、是否允许邀请、最大人数、是否需要受邀确认、扩展信息等当前旧工程已支持的可变字段。
- **FR-022**: `createGroup` MUST 沿用当前 SDK 业务对象返回原则；若成功响应中没有稳定业务载荷，允许返回最小群组结果，但不得把旧 envelope 直接透出。
- **FR-023**: `getAnnouncement` MUST 使用 `get` 命名；`updateAnnouncement` MUST 返回标准化业务结果，不得继续公开 `fetchGroupAnnouncement`。
- **FR-024**: `getSharedFileList` MUST 使用统一列表查询命名；共享文件条目 MUST 使用驼峰字段，如 `fileId`、`fileName`、`fileOwner`、`fileSize`、`createdAt`。
- **FR-025**: 群消息已读成员查询 MUST 归属 ChatManager，不得通过 `GroupManager` 或 `Group` 公开 `getGroupMessageReadUserList` / `getMessageReadUserList`。
- **FR-026**: `group.muteAllMembers()` / `group.unmuteAllMembers()` MUST 作为全员禁言的公开 API 名称，取代旧 `disableSendGroupMsg` / `enableSendGroupMsg`。
- **FR-027**: allowlist 相关公开命名 MUST 统一使用 `allowlist`，不得再对外暴露 `whitelist`。
- **FR-028**: `GroupManager` MUST 提供类型化事件注册入口 `addEventHandler(id, handlers)` 与 `removeEventHandler(id)`，并遵循 `specs/004-event-system/spec.md` 的 Manager 事件约束。
- **FR-029**: 027 MUST 在统一事件系统中新增 GroupManager 专属事件类型定义；调用方只能在 `groupManager.addEventHandler()` 上订阅群组域事件。
- **FR-030**: 027 MUST 以 `handleMucMsg.ts` 中群组分支为范围来源，把所有群组相关 MUC operation 映射到覆盖移动端业务语义、但按 Web SDK 命名规范收敛的 GroupManager 公开事件模型。
- **FR-031**: GroupManager 的公开事件名 MUST 至少包含 `onInvitationReceived`、`onRequestToJoinReceived`、`onRequestToJoinAccepted`、`onRequestToJoinDeclined`、`onInvitationAccepted`、`onInvitationDeclined`、`onUserRemoved`、`onGroupDestroyed`、`onAutoAcceptInvitationFromGroup`、`onMuteListAdded`、`onMuteListRemoved`、`onAllowListAdded`、`onAllowListRemoved`、`onAllMemberMuteStateChanged`、`onAdminAdded`、`onAdminRemoved`、`onOwnerChanged`、`onMembersJoined`、`onMembersExited`、`onAnnouncementChanged`、`onSharedFileAdded`、`onSharedFileDeleted`、`onGroupInfoChanged`、`onGroupDisabledChanged`、`onGroupMemberAttributeChanged`、`onUserGroupNamecardUpdated`。
- **FR-031A**: GroupManager 公开事件名 MUST 移除 `onWhiteListAdded`、`onWhiteListRemoved`、`onMemberJoined`、`onMemberExited`、`onSpecificationChanged`、`onStateChanged`；单成员加入/退出也 MUST 通过 `onMembersJoined` / `onMembersExited` 的单元素 `members` 数组表达。
- **FR-032**: 旧 `onGroupChange`、`onPresence` 与旧 `eventData.operation` / `info.type` 双轨模型 MUST 不再作为 GroupManager 的公开事件 API 保留。
- **FR-033**: 群事件 payload 中涉及的用户引用 MUST 使用与读取类 API 相同的用户资料补齐策略，并以 `UserInfo` 或对象数组对外暴露；Web 侧不得退回纯字符串用户字段模型。
- **FR-034**: 成员属性更新事件 MUST 支持区分“普通群事件”与“当前用户其他设备同步过来的事件来源”，以满足 `onGroupMemberAttributeChanged` 等事件的来源判别。
- **FR-035**: 群信息更新事件 MUST 对齐 `onGroupInfoChanged` 语义，payload MUST 为 `{ groupId: string; groupInfo: GroupDetail }`，并完成旧 `name/title/description/public/members_only/allow_user_invites/max_users/invite_need_confirm/custom/last_modified` 字段到新驼峰字段的映射。
- **FR-035A**: `onGroupInfoChanged` 与 `onGroupDisabledChanged` MUST 返回完整标准化群对象，而不是仅返回 patch 字段；当原始事件字段不足时，SDK MAY 受控补拉群详情后再派发事件。
- **FR-035B**: 群禁用状态事件 MUST 对齐 `onGroupDisabledChanged` 语义，payload MUST 为 `{ groupId: string; groupInfo: GroupDetail; disabled: boolean }`；`disabled` MUST 与 `groupInfo.disabled` 保持一致。
- **FR-036**: 事件派发 MUST 覆盖至少以下业务变化：邀请接收、入群申请接收、入群申请通过/拒绝、邀请通过/拒绝、被移出群、群解散、自动通过邀请、禁言列表变更、allowlist 变更、全员禁言状态变更、管理员变更、群主变更、成员加入/退出、公告变更、共享文件变更、群规格变更、群状态变更、群成员属性变更、群名片变更。
- **FR-037**: 当群事件的用户资料补齐失败时，SDK MUST 继续派发群事件，不得因资料接口异常导致事件丢失。
- **FR-038**: 027 的文档、JSDoc、导出类型与示例 MUST 全部使用新的 GroupManager API 名称，并补充旧工程到新 SDK 的迁移说明。
- **FR-038A**: GroupManager 对外 API 文档 MUST 只展示入口、列表、创建、按 ID 获取 `Group`、事件监听与全局能力；属于 `Group` 的单群方法 MUST 从 GroupManager 文档隐藏，并在 `Group` 小节中单独展示。
- **FR-039**: 027 的测试与实现 MUST 基于真实 REST 返回结构编写；当前 `docs/reference/group-api.md` 已确认已加入群列表、群详情、群成员列表、群管理员列表、禁言列表、黑名单、allowlist、公告、共享文件列表、批量成员属性、单成员属性同构约束；对于其余尚未确认的接口响应结构，plan/implement 阶段 MUST 先向需求方索要真实样例，再完成解析与测试。
- **FR-040**: 当前仍无法完全确认真实返回结构的群接口，至少包括公开群列表与群详情批量查询；这些接口在 027 implement 阶段 MUST 被继续显式列入待确认数据契约清单。
- **FR-041**: SDK MUST 在 `api-errors.json` 中为每个群组 API 定义可能的错误码，并通过 `error-codes.ts` 导出 `GROUP_*` 前缀常量（600-613），数值与移动端 C++ SDK 完全对齐。错误码详情见 `docs/reference/group-manager-error-codes.md`。
- **FR-042**: `leaveGroup` 的服务端错误映射 MUST 覆盖 `error_description` 包含 `"owner can not quit group"` 的场景，映射为 `GROUP_PERMISSION_DENIED`(603)。
- **FR-043**: `joinGroup` 的服务端错误映射 MUST 同时支持 error key 精确匹配和 `error_description` 子串匹配（`"member list is full"` → 604、`"is in the blacklist"` → 613），以兜底服务端返回通用 403 的场景。
- **FR-044**: `setGroupMemberAttributes` 的服务端错误映射 MUST 按 `error_code` 整数字段做细分映射（60005→610、60006→609、60007→4、60009→611、600010→612、60003→602、60001/60002→210、60004→305），不得将这些场景统一归为通用错误码。

### Key Entities _(include if feature involves data)_

- **GroupSummary**: 群组列表对象，表示公开群列表或已加入群列表中的一项；至少包含 `groupId`、`name`、`description`、`memberCount`、`public`、`joinApprovalRequired`、`allowInvites`、`maxMembers`，并按需要携带当前用户角色等扩展字段。
- **GroupListResult**: 群组列表分页结果对象，表示公开群列表或已加入群列表的查询结果；至少包含 `items` 与可继续查询所需的分页字段。
- **Group**: 由 `groupManager.getGroup(groupId)` 返回的轻量单群对象，绑定固定 `groupId`，负责单群上下文读取与 mutation；不作为列表项与前端 state 的主数据结构。
- **GroupDetail**: 群组详情对象，表示单个群组的完整可读视图；至少包含群组基础信息、群主、成员统计、当前用户角色、配置开关、扩展字段、当前用户消息屏蔽状态与可用的加入时间信息；成员统计统一通过 `memberCount` 表达，当前用户角色由 v3 详情响应 `permission` 归一为 `role`，当前用户屏蔽群消息状态统一通过 `messageBlocked` 表达。
- **GroupUserInfo**: GroupManager 公开使用的用户业务对象，直接复用当前 `UserInfo` 模型，至少包含 `userId`，并在可用时附带用户资料字段。
- **GroupMemberEntry**: 群成员条目对象，表示成员列表中的一项；至少包含 `user`、`role`、`joinedAt` 等字段。
- **GroupMuteEntry**: 禁言条目对象，表示群禁言列表中的一项；至少包含 `user` 与禁言截止时间或剩余时长。
- **GroupAllowlistEntry**: allowlist 条目对象，表示群 allowlist 中的一项；至少包含 `user`。
- **GroupBlocklistEntry**: 黑名单条目对象，表示群黑名单中的一项；至少包含 `user`。
- **GroupSharedFile**: 群共享文件对象，至少包含 `fileId`、`fileName`、`fileOwner`、`fileSize`、`createdAt`。
- **GroupEventPayloads**: GroupManager 的一组公开事件载荷，按 Web SDK 命名规范拆分；每个事件按需携带 `groupId`、`groupName`、`inviter`、`applicant`、`accepter`、`decliner`、`invitee`、`administrator`、`oldOwner`、`newOwner`、`members`、`allowlist`、`announcement`、`sharedFile`、`groupInfo`、`disabled`、`attribute`、`from`、`source` 等字段，其中用户相关字段优先对象化为 `UserInfo` 或其数组，而 `onGroupInfoChanged` / `onGroupDisabledChanged` 中的 `groupInfo` 必须是完整标准化群对象。

### Assumptions & Dependencies

- `specs/009-manager-usage/spec.md` 已定义 manager 注册与访问方式；027 必须在该规范内完成 GroupManager，不另起 connection 风格公开入口。
- `specs/004-event-system/spec.md` 已定义 Manager 事件模式；027 只允许新增 GroupManager 专属事件类型，不回退到 `on/off` 或旧 presence-style API。
- `specs/026-user-info-manager-api/spec.md` 已确认 `fetchUserInfoByUserId` 可作为批量资料补拉入口；027 复用该能力，不再自建另一套用户资料查询协议。
- 当前仓库尚未存在 `GroupManager`、群组专属类型与群组事件类型；027 将补齐这些能力。
- 群事件公开模型已确认采用类型化多事件命名，而非单一 `onGroupEvent` 总入口。
- 群事件公开模型已确认采用“覆盖移动端业务语义 + Web 命名收敛 + Web 对象化载荷”的方案：用户相关字段按 Web SDK 业务对象语义返回。
- 群详情类事件已确认返回完整标准化群对象；若事件原始字段不足，可在事件派发前补拉一次群详情。
- 当前仓库已有统一 `UserInfo` 类型；027 直接复用该类型作为群域用户业务对象，避免新增 `User` 别名或重复造型。
- 旧 `groupApi.ts` 中若某些接口成功响应没有稳定业务载荷，027 可按 `Promise<void>` 或最小业务对象返回建模，但必须在 plan 阶段结合真实样例最终确认。
- 按 Constitution 要求，涉及真实 REST 结构解析与测试时必须基于真实返回样例；当前仍需要需求方继续补充响应样例的接口收敛为：`getGroupInfoList`。
- 群列表公开返回形态已确认统一为分页结果对象；具体分页字段名与翻页语义仍需结合真实 REST 响应样例在 plan 阶段最终定稿。
- 当前阶段不要求引入新的群组 demo 页面；因此 E2E 不新增，但后续若 demo 增加群能力，应把 027 的核心路径纳入更高层验证。

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 旧 `groupApi.ts` 中群组域公开能力在新 `GroupManager` 中迁移完成，功能缺失率为 0。
- **SC-002**: 新公开 API 面中，旧 group API 名字、废弃别名、`whitelist` 旧命名与历史 typo 名残留率为 0。
- **SC-003**: 所有 GroupManager 读取/写入返回结果中的蛇形字段与原始 REST envelope 外泄率为 0。
- **SC-004**: 原本返回用户 ID 的群接口在新 SDK 中都能稳定返回对象化用户结果，最小 `userId` 可用率达到 100%。
- **SC-005**: 群成员、管理员、黑名单、allowlist、禁言列表在资料可用场景下，用户资料补齐成功可见率达到 100%。
- **SC-006**: 当资料补拉失败时，群接口与群事件仍能继续返回主业务结果，因资料接口异常导致的业务结果/事件丢失率为 0。
- **SC-007**: `handleMucMsg.ts` 中群组相关 operation 在新 SDK 中都能映射为覆盖对应业务语义的 GroupManager 公开事件，事件缺失率为 0。
- **SC-008**: 调用方只使用 `groupManager.addEventHandler()` 即可完成群事件订阅，旧 `onGroupChange` / `onPresence` 双轨公开模型残留率为 0。
- **SC-008A**: `onGroupInfoChanged` / `onGroupDisabledChanged` 在事件原始字段不完整场景下仍能稳定返回完整标准化群对象，局部 patch 外泄率为 0。
- **SC-008B**: 公开类型、文档和事件 payload 中 `onWhiteListAdded`、`onWhiteListRemoved`、`onMemberJoined`、`onMemberExited`、`onSpecificationChanged`、`onStateChanged`、`whitelist`、`shieldGroup`、`affiliations`、`affiliationsCount` 残留率为 0。
- **SC-009**: 单用户/多用户双入口收敛后，成员移除、黑名单、禁言、allowlist 等写接口的公开参数模型统一率达到 100%。
- **SC-010**: 发布后的公开文档、类型与示例中，GroupManager 的调用方式全部符合 manager 规范与命名规范，错误示例残留率为 0。
- **SC-011**: GroupManager 对外文档中，属于 `Group` 的单群方法误挂在 GroupManager 名下的残留率为 0。
