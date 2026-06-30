# 功能规格：用户资料订阅与变更通知

**Feature Branch**: `033-user-info-subscription`  
**Created**: 2026-04-23  
**Status**: Draft  
**Input**: 用户需求："写 033spec, 这部分实现订阅陌生人的用户信息，当好友或者订阅的用户，用户属性发生变化时，服务器会通过 websocket 下发 notify 消息进行通知。收到变化通知要更新缓存中的信息，并给出回调事件。提供添加订阅、取消订阅、查询订阅 REST 接口；notify 类型包括 `subscribe_metadata_updated` 与 `contact_metadata_updated`；已知错误码包括 401、403、400 超限；数量边界为单个订阅者最多订阅 100 人、单个用户最多被订阅 1000 人；移动端 API 可作为对外语义参考。"

**Reference**:

- 当前用户资料能力基线：`/Users/zhangdong/code/websdk2/specs/026-user-info-manager-api/spec.md`
- 当前联系人事件与资料补齐基线：`/Users/zhangdong/code/websdk2/specs/025-contact-manager-api/spec.md`
- 当前事件系统规范：`/Users/zhangdong/code/websdk2/specs/004-event-system/spec.md`
- 当前 UserInfoManager：`/Users/zhangdong/code/websdk2/src/managers/user-info-manager.ts`
- 当前 ContactManager：`/Users/zhangdong/code/websdk2/src/managers/contact-manager.ts`
- 当前 notify 分发入口：`/Users/zhangdong/code/websdk2/src/core/message/message-receiver.ts`

## 设计决策

- 033 继续以 `UserInfoManager` 作为用户资料域公开入口，新增“订阅陌生人资料变化”的查询与写入 API。
- 订阅对象是“非好友用户”；好友资料变化不通过订阅列表查询暴露，但仍会复用同一条缓存更新链路。
- `subscribe_metadata_updated` 由 `UserInfoManager` 对外派发 `onUserInfoUpdated`；`contact_metadata_updated` 由 `ContactManager` 对外派发 `onContactInfoUpdated`，以保持“陌生人订阅”和“好友关系”分别归属各自 manager。
- 两类 notify 都必须先更新当前会话中的用户资料缓存，再派发对外事件，避免业务侧回调里读到旧值。
- 033 不引入新的持久化介质；继续复用现有 `UserInfo` 缓存与会话态，如需补足当前摘要缓存无法承载的字段，由运行时态在本会话内保证可读性。
- 已确认订阅接口真实 success 样例：POST 请求体使用 `{"usernames":[...]}`，DELETE 使用 query `?usernames=a,b`，三者 success envelope 均包含 `path`、`uri`、`status`、`timestamp`、`organization`、`application`、`entities`、`count`、`data`、`duration`、`applicationName`；其中 GET 的 `data` 仅返回用户名数组，因此 SDK 需要在内部继续补齐资料 hydrate，才能对外维持 `ReadonlyArray<UserInfo>` 语义。

## Clarifications

### Session 2026-04-23

- Q: 同一用户既是好友又在订阅列表里时，若收到资料变化通知，SDK 应如何派发事件？ → A: 保留订阅事件；这种情况下服务端返回 `subscribe_metadata_updated`，SDK 按 notify 类型只派发订阅事件，不额外合成好友事件。
- Q: `onContactInfoUpdated` 的对外 payload 应返回什么形态？ → A: 返回专用事件对象，至少包含 `userId` 和 `userInfo`，并在可用时附带 `contact`。
- Q: `onUserInfoUpdated` 是否需要额外暴露 `changedFields`？ → A: 不需要；订阅事件仅返回最新 `userInfo`。
- Q: SDK 在发起订阅前，是否要先本地校验目标用户不是好友？ → A: 不做本地好友关系拦截；统一发请求，由服务端决定是否接受。

## User Scenarios & Testing _(mandatory)_

### User Story 1 - 订阅、取消订阅并查询陌生人资料变更 (Priority: P1)

作为 SDK 使用者，我希望通过 `UserInfoManager` 订阅非好友用户的资料变化、取消已有订阅，并查询当前已经订阅的用户资料列表，这样业务侧可以只关注需要展示的陌生人资料，而不用自己维护一套后台轮询或自建订阅关系。

**Why this priority**: 订阅 API 是本特性的公开主入口；如果只能接收 notify 而不能管理订阅关系，业务无法稳定控制订阅范围与配额使用。

**Independent Test**: 在已登录场景下，分别验证添加订阅、取消订阅、查询订阅、空输入、重复用户、401/403/400 错误和超限边界，即可独立验收该故事。

**Acceptance Scenarios**:

1. **Given** 当前用户已登录且传入一组合法陌生人用户 ID，**When** 调用 `client.userInfoManager.subscribeUsersInfo({ userIds })`，**Then** SDK 成功建立订阅关系，并对外保持统一 Promise 成功语义，而不是透传原始 REST 包装结构。
2. **Given** 当前用户已存在部分订阅关系，**When** 调用 `client.userInfoManager.unsubscribeUsersInfo({ userIds })`，**Then** SDK 成功移除这些订阅关系，且后续查询结果不再包含已取消的用户。
3. **Given** 当前用户已建立订阅关系，**When** 调用 `client.userInfoManager.getSubscribedUsers()`，**Then** SDK 先消费服务端 success envelope 中的用户名数组，再归一化为标准化后的 `ReadonlyArray<UserInfo>` 对外返回，而不是把用户名字符串列表或原始 REST envelope 直接暴露给调用方。
4. **Given** 调用方传入重复用户 ID、空字符串或非法用户 ID，**When** 调用订阅或取消订阅 API，**Then** SDK 必须在发起请求前完成参数校验、去重并抛出统一参数错误，而不是把非法输入直接交给服务端。
5. **Given** 调用方单次请求的唯一用户 ID 数量超过 `metadataSubscriptionLimit` 默认值 100，**When** 调用订阅 API，**Then** SDK 必须返回统一的超限错误，不允许以成功语义提交超长请求。
6. **Given** 服务端返回 401、403 或 400 超限错误，**When** 调用订阅相关 API，**Then** SDK 必须把“鉴权失败”“服务未开通”“订阅人数超限 / 被订阅人数超限”映射为可区分的统一 SDK 错误，而不是让业务侧自行解析原始 `error_description`。
7. **Given** 调用方传入的目标用户在本地会话里恰好已是好友，**When** 调用订阅 API，**Then** SDK 不得在请求前基于本地好友状态直接拦截，而应交由服务端返回最终结果。

---

### User Story 2 - 订阅用户资料变化时自动更新缓存并派发事件 (Priority: P1)

作为 SDK 使用者，我希望当已订阅的陌生人资料发生变化时，SDK 能在收到 `subscribe_metadata_updated` notify 后自动更新缓存，并通过稳定的回调事件把最新资料通知给我，这样我不需要再手动补拉用户资料或自己对比变更字段。

**Why this priority**: 订阅的核心价值不是“维护一张名单”，而是“在资料变化时得到可靠通知并读到最新值”。缺少这一条链路，订阅功能实际不可用。

**Independent Test**: 在无需好友链路参与的情况下，模拟 `subscribe_metadata_updated` notify、旧版本 notify、部分字段 patch、缓存为空和重复事件场景，验证缓存更新与事件派发顺序即可独立验收。

**Acceptance Scenarios**:

1. **Given** 当前用户已订阅目标陌生人，**When** websocket 收到 `subscribe_metadata_updated` notify，**Then** SDK 必须先把 notify 中的 `metadata` 归一化并回写当前会话用户资料缓存，再通过 `client.userInfoManager.addEventHandler()` 注册的 `onUserInfoUpdated` 派发对外事件。
2. **Given** notify 只包含部分变化字段，**When** SDK 处理该通知，**Then** 仅更新本次实际变化的字段，未出现在 notify 中的既有字段不得被清空。
3. **Given** 当前缓存里已存在同一用户更新更晚的资料版本，**When** SDK 收到 `lastModified` 更旧的 notify，**Then** SDK 不得用旧数据覆盖新缓存，也不得派发表示“资料已回退”的误导性事件。
4. **Given** 当前会话中还未主动查询过该订阅用户资料，**When** 先收到 `subscribe_metadata_updated` notify，**Then** SDK 仍必须建立最小可用的资料缓存并派发事件，而不是因为本地没有预热状态就丢弃通知。
5. **Given** 业务侧在 `onUserInfoUpdated` 回调中立即读取该用户资料，**When** 读取缓存或再次调用资料查询入口，**Then** 读到的必须是更新后的视图，而不是 notify 到达前的旧值。
6. **Given** 同一用户既是好友又处于订阅列表中，**When** 服务端下发 `subscribe_metadata_updated`，**Then** SDK 只派发 `onUserInfoUpdated`，不得额外合成 `onContactInfoUpdated`。
7. **Given** 业务侧收到 `onUserInfoUpdated`，**When** 读取事件 payload，**Then** 事件仅提供最新 `userInfo` 语义，不额外暴露 `changedFields` 一类 patch 字段。

---

### User Story 3 - 好友资料变化时同步刷新联系人视图并给出好友事件 (Priority: P1)

作为 SDK 使用者，我希望当好友资料发生变化时，SDK 在收到 `contact_metadata_updated` notify 后，不仅更新统一用户资料缓存，还能同步刷新联系人视图，并通过好友专属回调把更新结果暴露出来，这样联系人列表、会话头像和好友详情能在同一会话内保持一致。

**Why this priority**: 你明确要求“好友或者订阅的用户”变化都要处理。若只处理订阅用户、不处理好友资料变化，业务侧仍需保留旧 SDK 或自行拼接联系人刷新逻辑。

**Independent Test**: 在已存在好友关系的前提下，模拟 `contact_metadata_updated` notify、联系人缓存已加载 / 未加载、资料补丁为空和重复 notify 场景，验证 `getContacts()` 与好友回调的一致性即可独立验收。

**Acceptance Scenarios**:

1. **Given** 当前用户与目标用户已是好友，**When** websocket 收到 `contact_metadata_updated` notify，**Then** SDK 必须先更新统一用户资料缓存，再刷新当前会话可见的联系人资料视图，并通过 `client.contactManager.addEventHandler()` 暴露 `onContactInfoUpdated`。
2. **Given** 业务侧已持有联系人列表快照，**When** 好友资料变化 notify 被处理完成，**Then** 后续 `client.contactManager.getContacts()` 读到的好友资料必须与 `onContactInfoUpdated` 回调里的资料保持一致。
3. **Given** 当前联系人快照中缺少该好友的 remark 或 addTs 等关系字段，**When** 派发 `onContactInfoUpdated`，**Then** SDK 仍不得丢弃事件，而应至少提供带 `userId` 与最新 `userInfo` 的专用事件对象，并把 `contact` 视为可选字段。
4. **Given** 同一好友在短时间内收到多条重复或乱序 notify，**When** SDK 处理这些通知，**Then** 联系人视图与好友回调都必须遵循最新 `lastModified` 结果，不得出现资料回退或重复等价刷新风暴。

### Out of Scope

- 新增用户搜索、推荐订阅、分页浏览订阅关系或“按关键字发现陌生人”能力。
- 重新设计 026 已交付的 `UserInfoManager` 查询 / 更新 API 命名与语义。
- 新增独立的订阅关系持久化介质或离线订阅同步数据库。
- 新增 demo 页面、可视化订阅管理 UI 或面向运营后台的订阅配置能力。
- 把好友资料变化事件改造成新的联系人申请 / 联系人同步体系。

### Edge Cases

- 单次订阅请求用户数超过 100，或服务端因累计订阅数达到 100 而返回超限错误时，SDK 应如何区分并对外暴露。
- 目标用户已达到“最多被订阅 1000 人”的上限时，SDK 如何把服务端错误稳定映射为“被订阅人数超限”而不是笼统参数错误。
- 本地好友快照缺失、过期或尚未完成同步时，SDK 如何避免因为错误的本地好友判断而误拦截订阅请求。
- notify 到达时本地没有该用户缓存、联系人快照未加载或订阅列表尚未查询，SDK 如何仍然构造最小可用结果。
- notify 的 `metadata` 仅包含部分字段，或包含当前 SDK 不支持的字段时，SDK 如何保证“已知字段可见、未知字段不污染公开类型”。
- 多条 notify 乱序到达时，SDK 如何利用 `lastModified` 保证不会用旧值覆盖新值。
- 外部业务在回调中同步读取缓存或联系人列表时，如何保证先更新缓存、后派发事件的顺序。
- 订阅列表查询接口的真实成功结构尚未确认前，如何在不破坏对外语义的前提下保留与真实服务端对齐空间。
- 同一用户同时满足“好友 + 已订阅”关系时，SDK 如何严格以服务端 notify 类型作为唯一事件来源，避免重复派发。

## Test Layer Requirements _(mandatory)_

### Unit Tests

- Coverage goals: 覆盖订阅 / 取消订阅 / 查询订阅参数校验、去重与超限判断；401/403/400 错误映射；`subscribe_metadata_updated` / `contact_metadata_updated` notify 归一化；`lastModified` 新旧比较；部分字段 patch 合并；事件派发前缓存更新顺序。
- Planned location: `tests/unit/managers/user-info-manager-subscription.test.ts`、`tests/unit/managers/contact-manager-friend-info.test.ts`、`tests/unit/core/message/message-receiver-user-info-notify.test.ts`
- Not applicable rationale: N/A，033 的主要风险集中在参数、错误语义、notify 归一化和缓存 patch 逻辑，单元测试必需。

### Integration Tests

- Coverage goals: 覆盖 `UserInfoManager` / `ContactManager` 与 `RestClient`、`CacheManager`、`EventHub`、`MessageReceiver` 的协作；验证订阅 API 请求路径与返回归一化、notify 到达后的缓存回写、`getContacts()` 与好友事件一致性、订阅事件回调与当前会话缓存一致性。
- Planned location: `tests/integration/user-info-manager/user-info-subscription.integration.test.ts`、`tests/integration/contact-manager/contact-friend-info.integration.test.ts`、`tests/integration/mock/manager-public-api.test.ts`
- Not applicable rationale: N/A，033 同时涉及 REST、缓存、notify 分发和跨 manager 协作，集成测试必需。

### E2E Tests

- Coverage goals: 本期只评估是否需要把“订阅陌生人资料变化”接入现有 demo 主路径；默认不把后台订阅关系管理纳入浏览器交互验收。
- Planned location: 复用 `tests/e2e/` 现有结构；本期默认不新增 033 专项用例。
- Not applicable rationale: 当前仓库尚无“资料订阅管理” demo 入口，本期主要风险在 SDK 内部协议、缓存和事件协作，因此以单元 + 集成为主；若后续 demo 增加订阅管理界面，再补 E2E。

### Gate Impact

- Required gates: `npm run test:gate:pr`
- Validation notes: PR gate 必须覆盖订阅 API、notify 归一化、好友资料变化回调和缓存一致性回归；Nightly / Release gate 本期不新增专门前置条件，但不得放松现有 manager 公共 API 与 notify 协作检查。

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: 033 MUST 继续以 `UserInfoManager` 作为用户资料域的公开 manager，并在其上补齐“陌生人资料变化订阅”能力。
- **FR-002**: `UserInfoManager` 对外 MUST 新增 `subscribeUsersInfo({ userIds })`、`unsubscribeUsersInfo({ userIds })`、`getSubscribedUsers()` 三个公开 API。
- **FR-003**: `subscribeUsersInfo` 与 `unsubscribeUsersInfo` MUST 使用对象参数 `{ userIds: string[] }`，并以 Promise 作为主语义；成功时对外返回 `Promise<void>`，不得透传原始服务端 envelope。
- **FR-004**: `getSubscribedUsers()` MUST 以 `Promise<ReadonlyArray<UserInfo>>` 返回当前用户已订阅的陌生人资料列表，且对外字段使用现有 `UserInfo` 驼峰命名视图；鉴于已确认的 GET success 样例中 `data` 仅返回用户名数组，SDK MUST 在内部基于该数组继续完成资料 hydrate，空数组时直接返回空列表。
- **FR-005**: 订阅相关 API MUST 在发起请求前校验 `userIds` 非空、元素合法且去重；去重不得改变剩余有效用户 ID 的相对顺序。
- **FR-005A**: SDK MUST NOT 在发起订阅请求前基于本地好友关系做前置拦截；目标是否允许被订阅由服务端最终判定。
- **FR-006**: `subscribeUsersInfo` MUST 对单次请求数量边界进行前置校验；当唯一用户 ID 数量超过 `metadataSubscriptionLimit` 默认值 100 时，不得继续发起网络请求。
- **FR-007**: 033 MUST 显式处理服务端已知错误：401 鉴权失败、403 服务未开通、400 订阅人数超限、400 被订阅人数超限，并映射为统一 SDK 错误，而不是要求调用方直接解析 `error`、`exception`、`error_description`。
- **FR-008**: 对于两类 400 超限错误，SDK MUST 能区分“当前登录用户订阅数超限”和“目标用户被订阅数超限”这两种业务语义。
- **FR-009**: 033 MUST 识别 websocket notify 中的 `subscribe_metadata_updated` 与 `contact_metadata_updated` 两种用户资料变化事件。
- **FR-010**: SDK MUST 把 notify 中的 `username`、`metadata`、`lastModified` 归一化为当前 SDK 的 `UserInfo` 视图；其中 `avatarurl` 必须映射为 `avatarUrl`。
- **FR-011**: notify 归一化时 MUST 仅更新本次变化中出现的字段；未在 notify 中出现的既有用户资料字段不得被静默清空。
- **FR-012**: notify 处理链路 MUST 先更新当前会话中的用户资料缓存，再派发对外事件，保证业务侧在回调中立即读取到最新值。
- **FR-013**: 若 notify 的 `lastModified` 早于当前缓存中的该用户资料版本，SDK MUST 忽略该旧版本 patch，不得让缓存或事件结果回退。
- **FR-014**: 即使当前会话尚未主动查询该用户资料、联系人快照尚未加载或订阅列表尚未拉取，SDK 在收到合法 notify 时仍 MUST 建立最小可用的资料结果，而不是丢弃事件。
- **FR-015**: `subscribe_metadata_updated` MUST 通过 `UserInfoManager` 的事件入口对外派发 `onUserInfoUpdated`，并允许业务通过 `client.userInfoManager.addEventHandler(id, handlers)` / `removeEventHandler(id)` 订阅与移除回调。
- **FR-016**: `onUserInfoUpdated` 的对外 payload MUST 以最新 `userInfo` 作为主语义，并可附带 `lastModified`、`source` 等元信息；不得直接暴露原始 notify JSON，也不得要求业务依赖 `changedFields` 一类 patch 字段才能消费事件。
- **FR-016A**: 当同一用户同时满足“好友 + 已订阅”关系，且服务端实际下发的是 `subscribe_metadata_updated` 时，SDK MUST 仅派发 `onUserInfoUpdated`；事件归属以服务端 notify 类型为准，不得额外合成好友资料变化事件。
- **FR-017**: `contact_metadata_updated` MUST 通过 `ContactManager` 的事件入口对外派发 `onContactInfoUpdated`，并保持与现有联系人事件注册方式一致。
- **FR-018**: `onContactInfoUpdated` 的对外 payload MUST 使用专用事件对象；该对象至少包含 `userId` 与最新 `userInfo`，并可在当前联系人快照可用时附带 `contact`，不得直接暴露移动端 `EMContact`、原始 notify JSON 或仅返回用户名字符串。
- **FR-019**: 处理 `contact_metadata_updated` 后，`ContactManager.getContacts()` 在同一登录会话中的读取结果 MUST 与 `onContactInfoUpdated` 回调里暴露的好友资料保持一致。
- **FR-020**: 好友资料变化事件在缺少完整联系人关系字段时 MUST 仍然继续派发，且至少保证 `userId` 与最新 `userInfo` 可用，不得因 remark / addTs 缺失吞掉整条事件。
- **FR-021**: 033 MUST 继续复用现有用户资料缓存与会话态，不新增新的持久化介质；若 notify 包含的公开字段超出现有摘要缓存承载范围，SDK MUST 在当前会话内保证这些字段可读。
- **FR-022**: `getSubscribedUsers()` 返回的列表 MUST 只表达“已订阅的陌生人”关系，不得把好友自动混入该列表。
- **FR-023**: 033 MUST 不要求调用方在收到 notify 后手动再次调用资料查询 API 才能拿到更新结果；notify 自身处理完成后，缓存与事件语义应已闭环。
- **FR-024**: 新增订阅 API、事件名称、事件载荷类型、JSDoc 和公开文档 MUST 满足仓库现有双语注释与 manager 访问规范。
- **FR-025**: 033 的实现与测试在进入编码前 MUST 以真实的 POST / DELETE / GET 成功响应样例补齐 REST 映射依据；在样例未补齐前，不得凭猜测固化服务端 envelope 解析逻辑。
- **FR-026**: 033 的范围 MUST 限定为“陌生人资料订阅 API + 好友 / 订阅资料变化 notify 处理 + 缓存同步 + 回调事件”，不得顺带扩展为新的陌生人搜索、批量资料全量同步或新的联系人管理能力。

### Key Entities _(include if feature involves data)_

- **SubscribedUserInfoTarget**: 订阅目标实体，表示当前登录用户主动订阅资料变化的非好友用户。
- **SubscribedUserInfoChangedEvent**: 订阅用户资料变化事件实体，表示一次 `subscribe_metadata_updated` notify 归一化后的对外载荷，以最新 `userInfo` 为核心，并可附带 `lastModified`、`source` 等事件元信息。
- **FriendInfoChangedEvent**: 好友资料变化事件实体，表示一次 `contact_metadata_updated` notify 处理完成后，对外派发的专用事件对象；至少包含 `userId`、`userInfo`，并可选包含当前会话中的 `contact` 快照。
- **UserInfoNotifyPatch**: 用户资料通知补丁实体，表示 notify 中本次实际变化的字段集合及其服务端更新时间，用于和当前缓存做 patch 合并。
- **MetadataSubscriptionLimitState**: 订阅边界状态实体，表示当前账号在“最多订阅 100 人”和“最多被订阅 1000 人”两个限制下的校验与错误语义。

### Assumptions & Dependencies

- 026 已定义 `UserInfo` 公开字段与 `UserInfoManager` 查询 / 更新语义；033 在其基础上补齐订阅与 notify，不重写 026 的既有公开 API。
- 025 已定义 `ContactManager` 的联系人视图与事件注册模式；033 的好友资料变化事件复用这一入口，不另起一套好友 manager。
- 当前已确认的订阅接口路径为：
  - `POST /{org}/{app}/user/{username}/metadata/subscription`
  - `DELETE /{org}/{app}/user/{username}/metadata/subscription?usernames=...`
  - `GET /{org}/{app}/user/{username}/metadata/subscription`
- 当前已确认的 notify 类型为 `subscribe_metadata_updated` 与 `contact_metadata_updated`，且 notify payload 中 `lastModified` 可作为版本先后判断依据。
- 已确认的真实 success 样例表明：POST body 使用 `usernames` 数组，DELETE 使用 `usernames` query，POST / DELETE / GET 的 success envelope 都复用同一组公共字段；其中 GET 的 `data` 是用户名数组而不是完整资料对象。因此 033 需要在保留对外业务语义不变的前提下，把查询链路设计为“先取订阅用户名列表，再按现有 user-info 查询能力补齐 `ReadonlyArray<UserInfo>`”。
- `metadataSubscriptionLimit` 默认值为 100，表示单个订阅者最多订阅人数；`metadataSubscribedLimit` 默认值为 1000，表示单个用户最多被订阅人数。第二类边界主要依赖服务端返回，SDK 负责稳定错误映射。
- 033 不新增新的持久化存储；如果当前 `UserInfoSummary` 持久化模型只能承载部分字段，则由运行时态兜住本会话内的完整可见性。
- 订阅关系本身属于服务端真相，SDK 本地不要求维护一份独立持久化订阅名单；需要时通过查询接口获取最新结果。

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: `UserInfoManager` 对外可稳定提供“添加订阅 / 取消订阅 / 查询订阅”三项能力，功能缺失率为 0。
- **SC-002**: 订阅相关 API 对外字段与返回值保持驼峰业务语义，原始 REST envelope 与蛇形字段泄漏率为 0。
- **SC-003**: 在已订阅用户资料变化场景下，`subscribe_metadata_updated` notify 处理后业务侧无需手动补拉即可读到最新值，缓存滞后率为 0。
- **SC-004**: 在好友资料变化场景下，`onContactInfoUpdated` 回调与同一会话中的 `getContacts()` 结果一致率达到 100%。
- **SC-005**: 对 401、403、400 订阅人数超限、400 被订阅人数超限四类已知错误，SDK 错误映射正确率达到 100%。
- **SC-006**: 在 notify 乱序或重复到达场景下，基于 `lastModified` 的资料回退率为 0，重复等价刷新率为 0。
- **SC-007**: 订阅相关公开文档、类型和事件说明在本期发布后覆盖率达到 100%，不存在未说明的新 API 或未声明的新事件。
