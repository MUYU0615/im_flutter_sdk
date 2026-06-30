# 功能规格：联系人管理 API 补齐（阶段二）

**Feature Branch**: `025-contact-manager-api`  
**Created**: 2026-03-19  
**Status**: Draft  
**Input**: 用户需求："写 025 spec，这部分用于补充 ContactManager 原有工程 API。基于现在的 ContactManager 增加原工程 API：`addContact`、`deleteContact`、`getContacts`、`addUsersToBlocklist`、`removeUserFromBlocklist`、`getBlocklist`、`acceptContactInvite`、`declineContactInvite`、`setContactRemark`。要求封装接口返回的数据结构，字段名符合驼峰；如果现有 API 的名字、参数或返回数据不合理则优化。"

**Reference**:

- 原工程 API 入口：`/Users/zhangdong/code/websdk-new/packages/IM/sdk/src/apis/index.ts`
- 当前 ContactManager：`/Users/zhangdong/code/websdk2/src/managers/contact-manager.ts`
- 现有联系人同步规格：`/Users/zhangdong/code/websdk2/specs/024-contact-sync/spec.md`

## Clarifications

### Session 2026-03-23

- Q: 在缺少真实成功响应样例时，`addContact`、`deleteContact`、`acceptContactInvite`、`declineContactInvite`、`setContactRemark` 本期是否统一按 `Promise<void>` 收敛？ → A: 是，5 个接口本期统一定义为成功返回 `void`。
- Q: `getBlocklist()` 本期应返回对象数组还是仅返回 `string[]`？ → A: 返回 `UserInfo[]`，当前每项至少包含 `userId`。
- Q: `addUsersToBlocklist` 与 `removeUserFromBlocklist` 的入参是否统一使用 `userIds: string[]`？ → A: 是，两个接口都统一使用 `userIds: string[]`。
- Q: `userIds` 中出现重复值时应如何处理？ → A: SDK 先去重，再发起请求。

### Session 2026-03-27

- Q: 现有分页联系人公开 API 是否继续对外保留？ → A: 不保留；公开读取入口只保留同步快照式 `getContacts()`，分页联系人能力不再作为 ContactManager 公开 API 维护。
- Q: `getBlocklist()` 是否也要像联系人分页/事件一样补齐用户资料？ → A: 需要；返回的 `UserInfo` 必须带 `userInfo`，至少包含 `userId`，并在可用时补齐用户属性。
- Q: 联系人 roster 对外回调 payload 是否统一带 `userInfo`？ → A: 需要；`onContactInvited`、`onContactAdded`、`onContactRefuse`、`onContactAgreed` 的对外 payload 必须带 `userInfo`。

## User Scenarios & Testing _(mandatory)_

### User Story 1 - 在 ContactManager 上完成联系人关系操作闭环 (Priority: P1)

作为 SDK 使用者，我希望当前 `ContactManager` 直接提供联系人添加、删除、接受申请、拒绝申请与备注修改能力，并且参数与错误语义符合当前 SDK 规范，这样我就不需要继续依赖旧工程的 connection 层 API，也不需要自行解析服务端原始返回结构。

**Why this priority**: 联系人生命周期操作是 ContactManager 的核心职责。如果只保留 024 的只读快照而没有写操作，调用方仍然必须混用旧接口或自行封装，迁移价值不完整。

**Independent Test**: 在已登录场景下，分别调用 `addContact`、`deleteContact`、`acceptContactInvite`、`declineContactInvite`、`setContactRemark`，验证参数校验、统一错误模型以及当前联系人视图的一致性，不依赖其他黑名单能力即可独立验收。

**Acceptance Scenarios**:

1. **Given** 当前用户已登录且传入合法 `userId`，**When** 调用 `addContact` 并可选传入验证消息，**Then** SDK 会发起添加联系人申请，并以当前 SDK 统一错误模型返回结果，而不是透传原始 REST 包装结构。
2. **Given** 当前用户存在待处理的联系人申请，**When** 调用 `acceptContactInvite` 或 `declineContactInvite`，**Then** SDK 会完成相应处理，并对外暴露一致的成功/失败语义。
3. **Given** 当前用户与目标用户已存在联系人关系，**When** 调用 `deleteContact`，**Then** 后续联系人读取结果不会继续保留已删除联系人。
4. **Given** 当前用户与目标用户已存在联系人关系，**When** 调用 `setContactRemark` 更新备注，**Then** 后续联系人读取结果会体现最新 `remark`，且对外字段仍保持驼峰命名。
5. **Given** `addContact` 调用成功但对方尚未接受，**When** 调用方立即读取联系人列表，**Then** SDK 不会伪造一个已经确认建立的联系人关系结果。

---

### User Story 2 - 联系人读取 API 与当前快照语义一致 (Priority: P1)

作为 SDK 使用者，我希望 `ContactManager.getContacts()` 继续作为联系人读取入口，并返回当前 SDK 里标准化后的联系人对象，而不是旧工程的 `name/subscription/jid` 结构，这样我可以在迁移旧代码时直接使用新的联系人视图，不必维护两套模型。

**Why this priority**: 你要求补齐的原工程 API 里包含 `getContacts`，但当前仓库已经有一个同名读取方法。如果不先把该能力的语义固定下来，后续实现会在“本地快照读取”与“远端 roster 查询”之间产生冲突。

**Independent Test**: 在“有快照”“无快照”“联系人刚发生写操作”三种场景下分别调用 `getContacts()`，验证其始终返回统一的 `Contact` 列表、空数组语义和一致联系人视图，不要求额外依赖黑名单接口。

**Acceptance Scenarios**:

1. **Given** 当前用户已有可用联系人快照，**When** 调用 `contactManager.getContacts()`，**Then** 返回值是驼峰命名的联系人业务对象列表，至少包含 `userId`、`nickname`、`avatarUrl`、`sign`、`remark`、`addTs`。
2. **Given** 当前用户暂无联系人结果或联系人列表为空，**When** 调用 `contactManager.getContacts()`，**Then** 返回空数组而不是 `null`、`undefined` 或原始 REST 包装结构。
3. **Given** 当前联系人关系或备注刚发生成功变更，**When** 调用方再次读取 `contactManager.getContacts()`，**Then** 返回结果应与最新业务状态保持一致，而不是继续暴露旧值或半更新中间态。
4. **Given** 当前仓库已经存在 `contactManager.getContacts()`，**When** 本期补齐原工程 API，**Then** 不得把该方法改造成必须联网、必须回调或返回旧工程 `RosterData` 结构的接口。

---

### User Story 3 - 黑名单 API 可直接在 ContactManager 中使用 (Priority: P2)

作为 SDK 使用者，我希望 `ContactManager` 直接提供黑名单添加、移除与查询能力，并对批量输入、空列表和返回字段做统一规范，这样联系人安全相关能力也能与联系人关系操作保持同一入口和同一数据风格。

**Why this priority**: 黑名单是联系人域的重要补充能力，但相对联系人主链路优先级略低于联系人关系增删改查本身，因此放在 P2。

**Independent Test**: 在已登录场景下，分别调用 `addUsersToBlocklist`、`removeUserFromBlocklist`、`getBlocklist`，验证批量输入、空结果、字段驼峰和同会话内结果一致性。

**Acceptance Scenarios**:

1. **Given** 当前用户已登录，**When** 调用 `addUsersToBlocklist` 并传入一个或多个用户 ID，**Then** SDK 会使用统一参数字段完成黑名单添加，并返回标准化后的成功结果，其中可稳定读取成功加入黑名单的 `succeeded[].userId` 与失败项 `failed[].userId`。
2. **Given** `addUsersToBlocklist` 的请求中包含服务端可识别的部分失败项，**When** 调用接口，**Then** SDK 成功返回，并把结果拆分为 `succeeded: UserInfo[]` 与 `failed: UserInfo[]` 两个数组，而不是抛出部分成功错误。
3. **Given** 当前用户黑名单中已有目标用户，**When** 调用 `removeUserFromBlocklist`，**Then** SDK 会将其从黑名单中移除，并在后续查询时不再返回该用户。
4. **Given** `removeUserFromBlocklist` 的目标用户在服务端不存在，**When** 调用接口，**Then** SDK 仍按成功完成语义返回，而不是把该场景误判为失败。
5. **Given** 当前用户调用 `getBlocklist`，**When** 服务端存在黑名单结果，**Then** SDK 返回驼峰命名的业务对象列表，调用方可稳定读取 `userId`，且结果来源于服务端返回的黑名单用户 ID 数组并经过资料补齐。
6. **Given** 当前用户没有任何黑名单用户，**When** 调用 `getBlocklist`，**Then** SDK 返回空数组而不是 `null` 或服务端原始包装结构。

---

### User Story 4 - ContactManager 可监听原工程 roster 联系人事件 (Priority: P1)

作为 SDK 使用者，我希望当前 `ContactManager` 除了 024 的联系人同步事件外，还能继续监听原工程里常用的 `onContactInvited`、`onContactDeleted`、`onContactAdded`、`onContactRefuse`、`onContactAgreed` 事件，这样旧业务迁移到新 SDK 时可以保留原有的联系人事件处理逻辑，而不需要回退到 connection 层或自己解析底层 protobuf。

**Why this priority**: 025 的目标是补齐原工程 Contact API。如果只补 REST 写接口而没有补齐 roster 事件监听，调用方仍然无法无缝迁移旧工程的联系人申请/删除通知主链路。

**Independent Test**: 在不依赖黑名单接口的情况下，通过模拟 roster 下行 meta 分别触发 5 种联系人事件，验证 `contactManager.addEventHandler()` 能收到兼容 payload；其中 `onContactInvited`、`onContactAdded`、`onContactRefuse`、`onContactAgreed` 必须带 `userInfo`，并且 `onContactAdded` / `onContactDeleted` 发生后，同一会话中 `getContacts()` 能立即观察到更新后的联系人列表。

**Acceptance Scenarios**:

1. **Given** 当前用户收到新的好友申请 roster 事件，**When** SDK 解码该下行 meta，**Then** `contactManager.addEventHandler()` 注册的 `onContactInvited` 会收到兼容的联系人事件 payload，且 payload 中包含该用户的 `userInfo`。
2. **Given** 当前用户联系人被对端删除，**When** SDK 收到 `onContactDeleted` 对应的 roster 事件，**Then** 事件会对外派发，且当前会话联系人缓存中的该联系人会被同步移除。
3. **Given** 当前用户与目标用户刚建立联系人关系，**When** SDK 收到 `onContactAdded` 或 `onContactAgreed` 对应的 roster 事件，**Then** 事件会对外派发，payload 中包含该用户的 `userInfo`，且当前会话联系人列表会补入该联系人，避免必须重新登录或手动刷新后才能读到。
4. **Given** 当前用户的联系人申请被对方拒绝，**When** SDK 收到 `onContactRefuse` 对应的 roster 事件，**Then** 事件会对外派发，payload 中包含该用户的 `userInfo`，但不会伪造一条已建立的联系人记录。
5. **Given** roster 事件同时带有 `rosterVer`，**When** SDK 成功处理联系人新增/删除事件，**Then** 系统会同步更新当前联系人版本状态，以便后续 024 同步链路继续沿用最新版本号。

### Edge Cases

- 当前仓库已存在同步读取型 `getContacts()`；本期不得为了兼容旧工程而把它改造成异步远程查询入口，避免破坏 024 的快照读取语义。
- `setContactRemark` 传入空字符串时，系统应将其视为“清空备注”的合法场景，而不是参数非法。
- `addUsersToBlocklist` 与 `removeUserFromBlocklist` 传入单个用户或批量用户时，系统都应统一使用清晰的 `userIds` 语义，并处理空字符串、重复值与空数组；其中重复值由 SDK 在请求前去重。
- 联系人或黑名单查询在服务端返回空结果时，系统应统一返回空数组，不得让调用方额外判断 `null`、`undefined` 或包装层字段缺失。
- `addUsersToBlocklist` 若服务端返回部分成功语义，SDK 必须按成功完成处理，并把成功项与失败项分别放入 `succeeded` / `failed` 数组；若服务端把整次请求判定为业务失败，则仍抛出统一 SDK 错误。
- `removeUserFromBlocklist` 在服务端返回成功且无业务载荷时，应按幂等成功语义处理；即使目标用户在服务端不存在，也不得构造额外失败。
- 当联系人删除、接受申请或备注修改成功后，本地联系人读取结果不得长时间停留在旧状态。
- 当联系人 roster 事件与当前本地快照交错到达时，`onContactAdded` / `onContactDeleted` 的本地缓存修补必须保持幂等；重复新增不得产生重复联系人，重复删除不得抛错。
- `onContactAdded` / `onContactAgreed` 事件到达时，若当前本地还没有对应联系人详情缓存，SDK 可以先写入最小联系人关系记录，并允许 `nickname/avatarUrl/sign/remark` 为空；不得因为缺少 userInfo 就放弃更新联系人关系本身。
- `getBlocklist()` 或联系人事件进行资料补拉时，若 `fetchUserInfoByUserId` 仅返回部分用户资料，系统必须优先回填已命中的资料，并对未命中的用户保留最小 `userInfo`（至少包含 `userId`）。
- `onContactInvited`、`onContactRefuse` 事件只负责通知，不得伪造已建立联系人关系或修改现有联系人备注。
- 当 `onContactInvited`、`onContactAdded`、`onContactRefuse`、`onContactAgreed` 的资料补拉失败时，系统仍必须派发联系人事件；payload 中的 `userInfo` 至少包含 `userId`，并尽量复用当前缓存中的资料，而不是因为资料接口失败吞掉事件。
- 若 roster 事件缺少可识别的 `from/to/operation` 或 payload 非法，系统必须忽略该事件而不是向调用方派发结构不完整的联系人事件。
- 当联系人写操作失败时，SDK 不得把失败前后的联系人结果混成一个中间态快照。
- 若目标用户不存在、已是好友、已被对方拉黑或邀请状态已失效，SDK 应向调用方抛出统一错误，而不是透传原始错误包装。

## Test Layer Requirements _(mandatory)_

### Unit Tests

- Coverage goals: 覆盖 9 个 API 的参数校验、单个/批量 `userIds` 归一化、驼峰字段映射、空结果处理、`getContacts()` 兼容语义、`getBlocklist()` 资料补拉、备注清空语义、已知业务错误映射、黑名单添加部分成功结构、整单失败映射与移除幂等成功语义，以及 roster 联系人事件解码、事件分发、事件 `userInfo` 补齐与 `onContactAdded/onContactDeleted` 缓存 patch。
- Planned location: `tests/unit/contact-manager/`
- Not applicable rationale: N/A

### Integration Tests

- Coverage goals: 覆盖 `ContactManager` 与 `RestClient`、`UserInfoManager`、联系人快照/缓存、024 同步结果读接口之间的协作；验证 `addContact/deleteContact/acceptContactInvite/declineContactInvite/setContactRemark/getBlocklist/addUsersToBlocklist/removeUserFromBlocklist` 的成功/失败路径、同会话数据一致性、真实 REST fixture 归一化、`getBlocklist()` 的资料补拉，以及 roster 联系人事件到达后对外事件派发、事件资料补齐与本地联系人快照修补。
- Planned location: `tests/integration/contact-manager/`
- Not applicable rationale: N/A

### E2E Tests

- Coverage goals: 评估是否需要在 demo 中增加联系人管理与黑名单交互主路径；若本期 demo 尚无对应入口，则记录为暂不新增，并由集成测试覆盖 API 主链路。
- Planned location: `tests/e2e/contact-manager/` 或复用现有 demo 主链路用例
- Not applicable rationale: 若 demo 侧本期不新增联系人管理入口，则不强制增加新的浏览器端 E2E；原因是当前变更主要为 SDK 管理器 API 能力补齐，核心风险更适合由集成测试与真实 REST fixture 覆盖。

### Gate Impact

- Required gates: `npm run test:run`、`npm run lint`、`npm run type-check`、`npm run test:gate:pr`
- Validation notes: PR 门禁至少需要阻断参数校验、错误映射、驼峰字段归一化、现有 `getContacts()` 兼容语义和联系人视图一致性的回归；若后续 demo 增加联系人管理入口，再评估 Nightly / Release gate 的 E2E 要求。

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: 系统必须在当前 `ContactManager` 上提供以下联系人域公开 API：`addContact`、`deleteContact`、`getContacts`、`addUsersToBlocklist`、`removeUserFromBlocklist`、`getBlocklist`、`acceptContactInvite`、`declineContactInvite`、`setContactRemark`。
- **FR-002**: 上述 API 的对外参数字段与返回字段必须遵循当前 SDK 的驼峰命名规范，不得直接暴露旧工程里的 `name`、`avatarurl`、`data` 包装层或其他蛇形字段。
- **FR-003**: `addContact` 必须允许调用方传入目标 `userId` 与可选验证消息 `message`，成功时返回无业务数据的完成语义。
- **FR-004**: `deleteContact` 必须允许调用方传入目标 `userId`，成功时返回无业务数据的完成语义。
- **FR-005**: `acceptContactInvite` 与 `declineContactInvite` 必须允许调用方传入目标 `userId`，并以统一成功/失败语义完成邀请处理；在当前阶段缺少真实成功响应样例时，两者成功返回统一为 `void` 完成语义。
- **FR-006**: `setContactRemark` 必须允许调用方传入目标 `userId` 与 `remark`；其中空字符串必须被视为合法输入，用于清空备注；在当前阶段缺少真实成功响应样例时，成功返回统一为 `void` 完成语义。
- **FR-007**: `addUsersToBlocklist` 必须支持一次添加一个或多个用户，并对外使用清晰的 `userIds` 参数语义，而不是旧工程中语义含混的 `name` 字段；成功时返回的标准化结果包含 `succeeded` 与 `failed` 两类用户资料数组。
- **FR-008**: `removeUserFromBlocklist` 必须支持一次移除一个或多个用户；即使保留该旧工程方法名，对外参数也必须使用 `userIds: string[]` 这一统一且清晰的字段；成功时由于服务端无稳定业务载荷，对外返回完成语义即可。
- **FR-009**: `getBlocklist` 必须返回标准化后的黑名单业务对象列表 `UserInfo[]`；对外字段至少包含 `userId`，其中 `userId` 为必填，并允许未来在不破坏兼容性的前提下扩展更多字段；结果应来源于服务端成功响应里的黑名单用户 ID 数组，不得直接对外退化为 `string[]`。
- **FR-010**: 当前仓库已存在的 `contactManager.getContacts()` 必须继续保留为联系人读取入口，并返回标准化 `Contact` 列表，而不是旧工程 `RosterData` 结构。
- **FR-011**: `contactManager.getContacts()` 必须继续保持同步读取当前结果的语义；本期补齐原工程 API 时不得把它改造成必须联网才能返回结果的异步接口。
- **FR-012**: `contactManager.getContacts()` 返回的联系人对象必须与 024 已定义的联系人投影保持一致，至少包含 `userId`、`nickname`、`avatarUrl`、`sign`、`remark`、`addTs`。
- **FR-013**: 当联系人列表为空或当前没有可用联系人结果时，`getContacts()` 必须返回空数组，而不是 `null`、`undefined` 或服务端响应包装体。
- **FR-014**: 当黑名单列表为空时，`getBlocklist()` 必须返回空数组，而不是 `null`、`undefined` 或服务端响应包装体。
- **FR-015**: 所有联系人域异步 API 在失败时必须抛出当前 SDK 统一错误对象；不得把 `{ code, message, data }` 之类的服务端包装结构直接作为成功返回值交给调用方自行判断。
- **FR-016**: 所有联系人域 API 必须对 `userId/userIds/message/remark` 做输入校验，并对缺失、空字符串、数组空值、重复值和非法类型提供可诊断错误。
- **FR-017**: 当 `deleteContact`、`acceptContactInvite` 或 `setContactRemark` 成功后，系统必须让同一登录会话中的联系人读取结果与最新业务状态保持一致，不得要求调用方必须重新登录才能读到新结果。
- **FR-018**: 当 `addContact` 成功但联系人关系尚未被对方接受时，系统不得在当前联系人读取结果中伪造一条已确认建立的联系人记录。
- **FR-019**: 当黑名单增删操作成功后，系统必须保证当前登录会话后续读取黑名单结果时能够观察到一致状态，不得长期保留旧值。
- **FR-020**: `addUsersToBlocklist` 的输出模型必须支持部分成功；当服务端返回可区分的成功/失败项时，系统必须成功返回 `succeeded: UserInfo[]` 与 `failed: UserInfo[]`，两者都为数组；当服务端把整次请求判定为业务失败时，系统必须抛出统一 SDK 错误。
- **FR-021**: `addUsersToBlocklist` 遇到服务端“资源不存在”错误时，至少必须稳定映射当前已确认的 `404 + service_resource_not_found + UserNotFoundException` 场景。
- **FR-022**: `removeUserFromBlocklist` 在服务端成功响应且无业务载荷时必须按完成语义返回；当目标用户在服务端不存在时也必须保持成功语义，不得误报失败。
- **FR-023**: 当前 024 中定义的联系人快照、联系人同步事件与读取语义必须保持兼容；本期不得破坏 `addEventHandler()`、`removeEventHandler()` 以及联系人同步事件的既有对外行为。
- **FR-024**: 当前阶段必须复用现有联系人领域模型作为读取结果，不得重新引入旧工程里仅含 `name/subscription/jid` 的过时联系人展示结构。
- **FR-025**: 对外 API 文档与注释必须明确区分“同步读取当前联系人结果”的 `getContacts()` 与“异步发起联系人关系/黑名单操作”的其他管理器方法，避免调用方误判语义。
- **FR-026**: 已知的 `addContact` 业务错误至少必须能稳定映射“用户不存在”“已是好友”“被对方拉黑”等场景；其他联系人域 REST 错误在缺少真实样例前不得以猜测字段完成实现。
- **FR-027**: 当前阶段的联系人 API 补齐范围仅限上述 9 个 API、联系人结果结构归一化，以及相关 roster 事件兼容；不包含联系人申请列表、联系人搜索、分页联系人公开接口、全新分页模型设计、批量备注更新、邀请事件模型重写等额外能力。
- **FR-028**: 当前阶段必须以 `ContactManager` 作为唯一公开入口，不得重新引入旧工程 connection 层风格的联系人 API 暴露方式。
- **FR-029**: 在当前阶段缺少真实成功响应样例时，`addContact`、`deleteContact`、`acceptContactInvite`、`declineContactInvite`、`setContactRemark` 必须统一定义为成功返回 `void`，不得预先暴露未被真实响应证明的业务对象。
- **FR-030**: `getBlocklist()` 在当前阶段必须固定返回 `UserInfo[]`，而不是 `string[]` 或额外包裹的 `BlocklistEntry[]`；每个条目至少保证 `userId` 可用，以维持联系人域返回格式一致性和后续兼容扩展能力。
- **FR-031**: `addUsersToBlocklist` 与 `removeUserFromBlocklist` 在当前阶段必须统一使用 `userIds: string[]` 作为唯一入参形态，不提供 `userId: string` 或 `string | string[]` 的重载，以保持联系人域批量操作接口的一致性。
- **FR-032**: `addUsersToBlocklist` 与 `removeUserFromBlocklist` 在处理 `userIds` 时必须先由 SDK 去重，再发起服务端请求；去重不得改变剩余有效用户 ID 的相对顺序。
- **FR-033**: 当前 `ContactManager.addEventHandler()` / `removeEventHandler()` 除 024 的 `onContactSyncStart`、`onContactSyncFinish(error?)` 外，还必须支持原工程联系人事件 `onContactInvited`、`onContactDeleted`、`onContactAdded`、`onContactRefuse`、`onContactAgreed`。
- **FR-034**: 上述 5 个联系人 roster 事件的对外 payload 必须保持稳定的驼峰结构，至少包含 `type`、`from`、`to`、`status`，并允许携带 `rosterVersion` 以表示当前服务端联系人版本。
- **FR-035**: 系统必须从 msync 下行中解析 `NameSpace.ROSTER` 对应的 `RosterBody` protobuf，并将 `ADD`、`REMOVE`、`ACCEPT`、`DECLINE`、`REMOTE_ACCEPT`、`REMOTE_DECLINE` 映射到上述联系人事件，而不是要求调用方自行解析底层协议。
- **FR-036**: 当收到 `onContactDeleted` 对应的 roster 事件时，系统必须同步修补当前登录会话的联系人缓存，使后续 `getContacts()` 不再返回该联系人。
- **FR-037**: 当收到 `onContactAdded` 对应的 roster 事件时，系统必须同步修补当前登录会话的联系人缓存，使后续 `getContacts()` 可以立即读取到新联系人。
- **FR-038**: 为保证“我发起邀请、对方稍后同意”的会话一致性，系统应将 `onContactAgreed` 也视为联系人关系已建立事件，并与 `onContactAdded` 使用相同的联系人缓存补丁策略。
- **FR-039**: 当收到 `onContactInvited` 或 `onContactRefuse` 对应的 roster 事件时，系统必须只派发通知事件，不得修改当前联系人列表。
- **FR-040**: 当 roster 事件包含 `rosterVer` 时，系统必须把该版本号写入当前会话的联系人版本状态，并标记来源为 roster notice，以便 024 后续同步链路继续基于最新版本工作。
- **FR-041**: 新增联系人事件能力不得破坏现有 `ContactManager` 联系人同步事件、联系人快照读取语义与黑名单 API。
- **FR-042**: `onContactInvited`、`onContactAdded`、`onContactRefuse`、`onContactAgreed` 4 个联系人 roster 事件的对外 payload 必须包含 `userInfo` 字段；该字段至少包含 `userId`，并在可用时补齐 `nickname`、`avatarUrl`、`mail`、`phone`、`gender`、`sign`、`birth`、`ext` 等当前 `UserInfo` 视图支持的字段。
- **FR-045**: 上述 4 个联系人事件在派发前必须优先复用当前会话缓存中的用户资料；若缓存无法满足最小需求，系统必须对缺失资料的目标用户批量触发 `fetchUserInfoByUserId` 补拉，再组装最终事件 payload。
- **FR-046**: 当联系人事件的资料补拉失败、超时或仅部分命中时，系统仍必须继续派发事件，不得因资料接口异常吞掉业务事件；此时 payload 中的 `userInfo` 至少包含 `userId`，并尽量回退到当前缓存中可用的资料字段。
- **FR-048**: `getBlocklist()` 在服务端返回黑名单用户 ID 列表后，必须与联系人分页/事件使用同一套资料补齐策略：优先复用当前会话缓存中的用户资料，对缺失用户批量调用 `fetchUserInfoByUserId`，并在失败或未命中时回退最小 `userInfo`。

### Key Entities _(include if feature involves data)_

- **Contact**: 当前 SDK 标准联系人视图对象，表示当前用户对某一联系人的可读结果，结构为 `Contact { userId, userInfo: UserInfo, remark, addTs }`。
- **UserInfo**: 黑名单条目对象，表示当前用户黑名单中的一个目标用户；当前阶段至少包含 `userId`，后续可兼容扩展更多字段。
- **BlocklistAddResult**: 黑名单添加成功结果对象，表示一次 `addUsersToBlocklist` 成功加入黑名单的用户集合；当前阶段包含 `succeeded` 与 `failed`。
- **ContactInviteAction**: 联系人申请处理动作对象，表示对某个目标用户发起添加、接受或拒绝联系人申请的输入语义。
- **ContactRemarkUpdate**: 联系人备注更新对象，表示对某个已存在联系人的备注变更请求。
- **ContactRosterEvent**: 原工程联系人 roster 事件的标准化对外载荷，表示一次联系人邀请、同意、拒绝或删除通知；至少包含 `type`、`from`、`to`、`status`，可选包含 `rosterVersion`。

### Assumptions & Dependencies

- 024 已提供联系人同步、联系人缓存与 `ContactManager.getContacts()` 基础能力；025 在此基础上补齐联系人管理 API，不重写 024 的主语义。
- 当前 `ContactManager.getContacts()` 已经存在，因此本期将其视为“旧工程 `getContacts` 能力在新 SDK 中的优化版本”，而不是新加一个返回旧 `RosterData` 的远程查询接口。
- 当前联系人分页能力不再对外暴露，因此本次需求不包含分页联系人公开接口的继续维护。
- `setContactRemark` 允许通过空字符串清空备注；若服务端对空字符串有额外限制，需在实现前以真实接口样例确认。
- 对于成功响应没有稳定业务载荷的联系人写操作，当前阶段默认对外返回 `void`，而不是人为拼装服务端未承诺的数据对象。
- 在补齐真实成功响应样例前，`addContact`、`deleteContact`、`acceptContactInvite`、`declineContactInvite`、`setContactRemark` 统一按 `Promise<void>` 设计，避免后续对外 API 二次破坏性调整。
- 已确认 `getBlocklist` 的服务端成功响应通过 `data: string[]` 返回黑名单用户 ID 列表；SDK 归一化时应以该数组作为主数据来源，而不是向外暴露 `uri/timestamp/entities/action/duration` 等包装字段。
- `getBlocklist()` 对外统一返回 `UserInfo[]`，并与联系人事件一样补齐 `userInfo`；若资料接口失败，仍需保证 `userId` 可用。
- 黑名单写接口即使只处理单个用户，也统一通过单元素 `userIds: string[]` 表达，不额外提供单值重载。
- `userIds` 中的重复值由 SDK 在本地去重后再请求服务端，以降低无效重复请求和服务端结果歧义。
- 已确认 `addUsersToBlocklist` 的服务端成功响应通过 `data: string[]` 返回成功加入黑名单的用户 ID 列表；若后续真实响应包含失败项，SDK 需将其对象化到 `failed: UserInfo[]`，若服务端返回 `404 + service_resource_not_found + UserNotFoundException` 这类整单失败，则继续按统一错误抛出。
- 已确认 `removeUserFromBlocklist` 的服务端成功响应不包含稳定业务数据；因此 SDK 对外应返回完成语义。当前已知样例中，即使目标用户在服务端不存在，移除接口仍返回成功。
- 当前 websocket 下行协议仍包含 `NameSpace.ROSTER` 与 `RosterBody`；025 在此基础上补齐对外联系人事件，不重写 024 的全量/增量联系人同步协议。
- 当前阶段联系人 roster 事件的最小兼容目标是原工程已有的 5 个事件：`onContactInvited`、`onContactDeleted`、`onContactAdded`、`onContactRefuse`、`onContactAgreed`；不扩展为新的申请列表或事件中心二次封装。
- `onContactAdded` 与 `onContactAgreed` 都代表“当前用户与目标用户的联系人关系已经建立”；为保证会话内一致性，SDK 可对这两类事件采用同一联系人缓存 patch 策略。
- 联系人事件和黑名单所需的资料补拉统一复用 `UserInfoManager.fetchUserInfoByUserId` 已确认的默认字段查询语义；若返回结果不完整，SDK 需对缺失用户保留最小 `userInfo` 回退。
- 若联系人写操作成功后无法仅靠本地补丁得到可靠一致结果，系统可通过受控刷新或局部重取保证读取结果一致；具体机制在 `plan.md` 阶段明确。
- 当前阶段不要求引入新的联系人管理 E2E 页面；若 demo 后续补联系人管理入口，再补充更高层验收。

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 当前 `ContactManager` 对外可稳定提供这 9 个联系人域 API，功能缺失率为 0。
- **SC-002**: 联系人域 API 的对外参数字段与返回字段全部使用驼峰命名，蛇形字段与原始包装层泄漏率为 0。
- **SC-003**: `contactManager.getContacts()` 在“有联系人”“空联系人”“刚发生联系人写操作”三类场景下都能返回一致的 `Contact` 列表，异常结构返回率为 0。
- **SC-004**: `deleteContact`、`acceptContactInvite`、`setContactRemark` 在成功场景下，同一登录会话内后续联系人读取结果与最新业务状态一致，错误可见旧值残留率为 0。
- **SC-005**: `addContact` 在申请成功但未接受场景下，不会让调用方读到伪造的确认联系人记录，误报率为 0。
- **SC-006**: `getBlocklist` 在“有数据”和“空数据”两种场景下都能返回统一业务结构，空结果兼容率达到 100%。
- **SC-007**: 输入校验失败与已知业务错误场景都能抛出统一 SDK 错误对象；其中 `addUsersToBlocklist` 的“目标用户不存在”场景必须稳定映射为统一错误，原始服务端包装体外泄率为 0。
- **SC-008**: 在保留 024 联系人同步能力的前提下，本期补齐不会破坏现有联系人同步事件使用方式，兼容回归率达到 100%。
- **SC-009**: 原工程 5 个联系人 roster 事件在新 SDK 中都可通过 `contactManager.addEventHandler()` 监听到，事件缺失率为 0。
- **SC-010**: `onContactAdded` / `onContactAgreed` / `onContactDeleted` 触发后，同一登录会话中的 `getContacts()` 结果能立即反映联系人关系变化，缓存滞后率为 0。
- **SC-012**: `onContactInvited`、`onContactAdded`、`onContactRefuse`、`onContactAgreed` 四个事件的 payload 都可稳定读取 `userId`，并在资料接口成功时返回补齐后的用户属性；事件因资料补拉失败而丢失的比例为 0。
