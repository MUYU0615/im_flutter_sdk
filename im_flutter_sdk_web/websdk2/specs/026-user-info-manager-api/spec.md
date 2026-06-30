# 功能规格：UserInfoManager API 补齐与语义收敛

**Feature Branch**: `026-user-info-manager-api`  
**Created**: 2026-03-26  
**Status**: Draft  
**Input**: 用户需求："写 026 spec，这部分完成 userinfo manager；若现有 userInfo manager 不符合 `specs/009-manager-usage/spec.md` 可直接修改。包含的 API 有 `updateUserInfo`、`fetchUserInfoById`。原工程代码位置 `/Users/zhangdong/code/websdk-new/packages/IM/sdk/src/apis/index.ts`。同时评估这两个 API 是否需要根据参数拆分；如果不能推断 API 返回值则需要进一步索要样例。"

**Reference**:

- 原工程 API 入口：`/Users/zhangdong/code/websdk-new/packages/IM/sdk/src/apis/index.ts`
- 当前 UserInfoManager：`/Users/zhangdong/code/websdk2/src/managers/user-info-manager.ts`
- Manager 注册规范：`/Users/zhangdong/code/websdk2/specs/009-manager-usage/spec.md`
- 本地缓存规范：`/Users/zhangdong/code/websdk2/specs/014-local-cache-module/spec.md`
- 当前公开示例：`/Users/zhangdong/code/websdk2/docs/reference/api.md`
- 后续 REST/SDK 返回对照文档参考：`/Users/zhangdong/code/websdk2/docs/reference/contact-manager-api.md`

## Clarifications

### Session 2026-03-26

- Q: 查询 API 是否要拆分；若拆分，按“单查/批量”还是参考移动端按“是否指定属性集”拆分？ → A: 参考移动端，拆成 `fetchUserInfoByUserId` 与 `fetchUserInfoByAttribute`。
- Q: 旧的 `fetchUserInfoById` 是否保留为兼容别名？ → A: 不保留，直接移除。
- Q: 更新 API 是否也对齐移动端双入口，若是采用什么名字与返回语义？ → A: 提供 `updateOwnInfo(userInfo)` 和 `updateOwnInfoByAttribute(attribute, value)`；`updateOwnInfo` 返回 `userInfo`。
- Q: 旧的 `updateUserInfo` / `updateOwnUserInfo` 是否保留兼容别名？ → A: 不保留，直接移除。
- Q: `updateOwnInfoByAttribute` 的返回是否与 `updateOwnInfo` 保持一致？更新接口真实成功响应结构是什么？ → A: 保持一致；成功响应样例为 `{ timestamp, data, lastModified, duration }`，其中 `data` 包含当前用户已设置过的全部属性。
- Q: 查询接口（`getUserInfo` / 对应 fetch API）的真实成功响应结构是什么？ → A: 成功响应样例为 `{ timestamp, data, lastModified, duration }`，其中 `data` 以 `userId` 为 key，value 为该用户已设置过的属性对象；`lastModified` 以 `userId` 为 key 返回各用户资料更新时间。

## 设计决策

- 更新能力参考移动端拆分为 `updateOwnInfo(userInfo)` 与 `updateOwnInfoByAttribute(attribute, value)`；不再把“整对象更新”和“单属性更新”压在同一个 API 上。
- 查询能力参考移动端拆分为 `fetchUserInfoByUserId({ userIds })` 与 `fetchUserInfoByAttribute({ userIds, attributes })`；不再按“单查/批量”拆分，避免一个方法同时承担“默认全字段查询”和“显式属性查询”两种语义。
- `updateOwnInfo` 作为当前用户整对象更新主入口，成功返回标准化后的 `UserInfo`；`updateOwnInfoByAttribute` 作为单属性更新主入口。
- 旧的 `updateUserInfo` 与 `updateOwnUserInfo` 不保留兼容层，更新侧直接切换到移动端风格命名。
- 已确认查询接口成功响应样例结构为 `{ timestamp, data, lastModified, duration }`；其中 `data` 是以 `userId` 为 key 的用户属性映射，`lastModified` 是以 `userId` 为 key 的更新时间映射。SDK 对外返回应基于 `data` 归一化为业务对象数组，而不是透传包装字段。
- 已确认更新接口成功响应样例结构为 `{ timestamp, data, lastModified, duration }`；其中 `data` 表示当前用户已设置过的全部属性。SDK 对外返回应基于 `data` 归一化为业务对象，而不是透传包装字段。

## User Scenarios & Testing _(mandatory)_

### User Story 1 - 按移动端语义查询用户资料，并获得完整字段投影 (Priority: P1)

作为 SDK 使用者，我希望 `UserInfoManager` 的查询能力参考移动端拆成“按用户 ID 查询默认字段”和“按用户 ID + 属性集查询指定字段”两个接口，并把旧工程里的用户属性结果统一成当前 SDK 的业务对象，这样我在迁移多端代码时不需要继续维护 Web 独有的混合参数 API，也不会因为当前实现只返回摘要字段而丢失 `mail/phone/gender/birth` 等属性。

**Why this priority**: 用户资料查询是 UserInfoManager 的核心职责，也是当前实现最明显的能力缺口。若继续沿用旧工程一个方法同时处理“默认字段查询”和“显式属性查询”，后续跨端对齐、类型定义和测试都容易持续发散。

**Independent Test**: 在已登录场景下，分别执行 `fetchUserInfoByUserId`、`fetchUserInfoByAttribute`、空结果与字段筛选场景，验证返回对象字段、顺序、空结果与错误语义，不依赖更新接口即可独立验收。

**Acceptance Scenarios**:

1. **Given** 当前用户已登录且传入多个合法 `userIds`，**When** 调用 `userInfoManager.fetchUserInfoByUserId({ userIds })`，**Then** SDK 返回标准化后的用户资料数组，字段使用驼峰命名，不暴露 `username/avatarurl/data` 包装层。
2. **Given** 当前用户已登录且传入多个合法 `userIds` 与显式属性集，**When** 调用 `userInfoManager.fetchUserInfoByAttribute({ userIds, attributes })`，**Then** SDK 返回标准化后的用户资料数组，并仅请求所需属性。
3. **Given** 调用方需要默认字段查询，**When** 调用查询 API，**Then** 应使用 `fetchUserInfoByUserId`，而不是在属性查询 API 上再传空属性集。
4. **Given** 查询结果中部分用户不存在或服务端未返回该用户资料，**When** 调用任一查询 API，**Then** SDK 只返回成功命中的用户资料对象，不伪造空对象占位。
5. **Given** 调用方仍按旧工程方式调用 `fetchUserInfoById`，**When** 升级到本期 API，**Then** 编译期或文档迁移信息必须明确提示改用新的查询 API，而不是继续提供旧名兼容层。
6. **Given** 查询结果包含 `mail/phone/gender/birth`，**When** 调用方读取返回值，**Then** 这些字段必须可稳定获取，而不是被当前摘要模型丢弃。

---

### User Story 2 - 按移动端语义更新当前用户资料，并获得一致的更新结果 (Priority: P1)

作为 SDK 使用者，我希望当前用户资料更新能力也对齐移动端，分别提供“整对象更新”的 `updateOwnInfo` 和“单属性更新”的 `updateOwnInfoByAttribute`，这样我在跨端迁移时不需要继续理解 Web 旧有的混合更新风格，也能明确区分完整资料 patch 和单字段快捷更新。

**Why this priority**: 旧工程 Web 更新 API 的参数形态混杂，而移动端已经形成更清晰的双入口模型。若不在 026 明确收敛，更新语义会继续与查询侧的跨端对齐目标脱节。

**Independent Test**: 在已登录场景下，分别验证 `updateOwnInfo` 的整对象更新、`updateOwnInfoByAttribute` 的单属性更新、空字符串清空、`false/0` 等合法值、旧名迁移提示与错误分支，不依赖批量查询即可独立验收。

**Acceptance Scenarios**:

1. **Given** 当前用户已登录，**When** 调用 `userInfoManager.updateOwnInfo({ nickname, avatarUrl, mail, phone, gender, sign, birth, ext })` 更新一个或多个字段，**Then** SDK 完成整对象更新，并返回标准化后的当前用户资料视图。
2. **Given** 当前用户已登录，**When** 调用 `userInfoManager.updateOwnInfoByAttribute(attribute, value)` 更新单个属性，**Then** SDK 仅更新指定属性，并维持与整对象更新一致的错误模型、缓存结果与返回结构。
3. **Given** 调用方把 `nickname/avatarUrl/mail/phone/sign/birth/ext` 中任一字符串字段显式传为 `''`，**When** 调用 `updateOwnInfo` 或对应属性更新入口，**Then** SDK 必须将其视为“清空该字段”的有效请求，而不是把该字段静默丢弃。
4. **Given** 调用方把 `gender` 传为 `false`、`0` 或其他合法布尔/数字值，**When** 调用更新 API，**Then** SDK 必须保留该值并正确发起更新，不得因真假值判断把它遗漏。
5. **Given** 调用方仍按旧 Web 方式调用 `updateUserInfo` 或 `updateOwnUserInfo`，**When** 升级到本期 API，**Then** 编译期或文档迁移信息必须明确提示改用新的更新 API，而不是继续提供旧名兼容层。
6. **Given** 调用方未提供任何可写字段，或 `updateOwnInfoByAttribute` 缺少合法 `attribute/value`，**When** 调用更新 API，**Then** SDK 在发起网络请求前返回统一参数错误。

---

### User Story 3 - UserInfoManager 的公开使用方式与 009 Manager 规范保持一致 (Priority: P2)

作为 SDK 使用者，我希望 `UserInfoManager` 的注册、访问、文档示例与其他 manager 保持同一套规则，这样我在使用 `client.use(UserInfoManager)` 或 `ChatClient.init({ managers })` 时可以获得稳定的类型提示，不会因为示例错误把 `use()` 返回值误当成 manager 实例。

**Why this priority**: 当前仓库已经有 `009-manager-usage` 规范，但 `docs/reference/api.md` 里的示例与该规范不一致。若不在 026 顺手收敛，后续实现再正确，调用方仍可能按错误方式接入。

**Independent Test**: 通过 `use(UserInfoManager)`、`init({ managers: [UserInfoManager] })` 与公开文档示例校验，即可独立验证 009 对齐要求。

**Acceptance Scenarios**:

1. **Given** 已初始化的 `client`，**When** 调用 `client.use(UserInfoManager)`，**Then** 返回值仍是扩展后的 `client` 实例，调用入口为 `client.userInfoManager`，而不是把 `use()` 返回值当成 manager 实例。
2. **Given** 调用方使用 `ChatClient.init({ managers: [UserInfoManager] })`，**When** 初始化完成，**Then** `client.userInfoManager` 与 `use(UserInfoManager)` 场景下具有相同 API 与行为。
3. **Given** 当前公开文档、注释或示例中存在 `const userInfoManager = client.use(UserInfoManager)` 这类不符合 009 的写法，**When** 本期完成后，**Then** 对外示例必须统一修正为 009 规范写法。

### Edge Cases

- `fetchUserInfoByUserId` 与 `fetchUserInfoByAttribute` 传入空数组、包含空值、重复值或顺序混杂时，系统必须先校验并按稳定规则去重；去重不得改变剩余有效用户 ID 的相对顺序。
- `attributes` 对外字段名必须使用驼峰命名；若调用方传入旧工程的 `avatarurl` 或未知字段，系统必须返回明确错误，而不是静默回退或直接透传服务端。
- 查询结果可能出现 `response.entities`、`response.data.entities`、`response.data.<userId>` 等多种结构；SDK 必须统一归一化。
- 查询接口服务端返回中的 `lastModified` 为按 `userId` 建立的映射，SDK 可用于补充资料更新时间，但不得直接把该包装映射作为默认返回结构暴露给调用方。
- 查询接口服务端返回中的 `timestamp`、`duration` 属于包装元信息；SDK 不得直接将其作为默认返回结构暴露给调用方。
- 批量查询部分未命中时，两个查询 API 都只返回命中项，不抛出部分失败错误，也不返回带空洞的数组。
- `fetchUserInfoByAttribute` 不得把空属性数组静默降级成“查全部”；应要求调用方显式改用 `fetchUserInfoByUserId` 或提供有效属性集。
- 本期移除 `fetchUserInfoById` 后，类型导出、示例、测试和文档不得继续残留旧名，否则会造成公开 API 双轨并存。
- `updateOwnInfo` 传入的字符串字段若为 `''`，必须按显式清空处理；不得因 `if (value)` 之类真假值判断被忽略。
- `updateOwnInfoByAttribute` 传入空属性、未知属性或缺失值时，必须返回明确错误。
- 本期移除 `updateUserInfo` 与 `updateOwnUserInfo` 后，类型导出、示例、测试和文档不得继续残留旧名，否则会造成公开 API 双轨并存。
- 更新 API 传入 `gender: false`、`gender: 0` 等合法值时，必须保留更新意图。
- 更新接口服务端返回中的 `timestamp`、`lastModified`、`duration` 属于包装元信息；SDK 不得直接将其作为默认返回结构暴露给调用方。
- 更新接口服务端返回中的 `data` 表示当前用户已设置过的全部属性；SDK 归一化返回时必须以该对象作为主数据来源。
- 更新成功后，若当前本地缓存只存展示摘要字段，系统也不得让对外返回结果丢失本次已确认写入的字段。

## Test Layer Requirements _(mandatory)_

### Unit Tests

- Coverage goals: 覆盖 `fetchUserInfoByUserId` / `fetchUserInfoByAttribute` 的参数校验、`attributes` 驼峰字段校验与服务端字段映射、查询结果归一化、批量去重与顺序保持、空属性集错误、旧查询名与旧更新名移除后的类型/导出收敛、`updateOwnInfo` / `updateOwnInfoByAttribute` 对空字符串与 `false/0` 的处理、更新属性名校验、以及 `use()`/`init({ managers })` 对 009 访问方式的一致性。
- Planned location: `tests/unit/managers/user-info-manager.test.ts`、必要时补充 `tests/unit/chat-client/` 与 `tests/unit/types/`
- Not applicable rationale: N/A

### Integration Tests

- Coverage goals: 覆盖 `UserInfoManager` 与 `RestClient`、缓存模块、Manager 注册体系的协作；验证 `/metadata/user/get` 在默认字段查询与显式属性查询两种入口下的请求组装、已确认查询成功响应 `{ timestamp, data, lastModified, duration }` 的归一化、`updateOwnInfo` 与 `updateOwnInfoByAttribute` 的请求组装、已确认更新成功响应 `{ timestamp, data, lastModified, duration }` 的归一化、查询/更新成功后的缓存回写、公开入口 `client.userInfoManager` 的实际可用性，以及旧查询名和旧更新名移除后的公开 API 面收敛。
- Planned location: `tests/integration/mock/manager-public-api.test.ts`、必要时新增 `tests/integration/user-info-manager/`
- Not applicable rationale: N/A

### E2E Tests

- Coverage goals: 评估是否需要在 demo 中增加用户资料查询/更新入口；若本期 demo 不新增对应界面，则以集成测试覆盖 SDK 主链路，并在计划中记录暂不新增 E2E 的原因。
- Planned location: `tests/e2e/user-info-manager/` 或复用现有 demo 主链路用例
- Not applicable rationale: 当前变更主要集中在 SDK 管理器 API、类型与缓存一致性，若 demo 本期没有新增用户资料界面，则不强制新增浏览器端 E2E。

### Gate Impact

- Required gates: `npm run test:run`、`npm run lint`、`npm run type-check`、`npm run docs:api:check`
- Validation notes: PR 阶段至少应阻塞单元/集成、类型与公开注释文档校验；若 demo 新增用户资料交互入口，再评估是否纳入更高层 gate。

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: 系统必须继续以 `UserInfoManager` 作为用户资料域的唯一公开 manager，并遵循 `specs/009-manager-usage/spec.md` 的注册与访问方式。
- **FR-002**: `UserInfoManager` 对外必须至少提供 `fetchUserInfoByUserId`、`fetchUserInfoByAttribute`、`updateOwnInfo`、`updateOwnInfoByAttribute` 这四个公开 API。
- **FR-003**: `fetchUserInfoByUserId` 必须接受对象参数 `{ userIds }`，并用于“按用户 ID 查询默认字段”场景；成功时返回标准化后的 `ReadonlyArray<UserInfo>`。
- **FR-004**: `fetchUserInfoByAttribute` 必须接受对象参数 `{ userIds, attributes }`，并用于“按用户 ID + 属性集查询指定字段”场景；成功时返回标准化后的 `ReadonlyArray<UserInfo>`。
- **FR-005**: 查询 API 不得再按“单个 ID / ID 数组”混合重载，也不得继续让一个方法同时承担“默认字段查询”和“显式属性查询”两种语义。
- **FR-005A**: 旧的 `fetchUserInfoById` 本期必须从公开 API、类型导出、文档示例与测试主路径中移除，不再提供兼容别名。
- **FR-006**: 对外 `attributes` 字段名必须采用驼峰命名业务字段，至少支持 `nickname`、`avatarUrl`、`mail`、`phone`、`gender`、`sign`、`birth`、`ext`；不得继续把 `avatarurl` 作为公开字段名暴露给调用方。
- **FR-007**: `fetchUserInfoByUserId` 必须承担默认字段查询语义；`fetchUserInfoByAttribute` 必须要求调用方显式传入有效属性集，不得把空属性数组静默降级成“查询全部”。
- **FR-008**: 查询成功返回的业务对象必须能够承载上述全部用户资料字段；不得继续把公开返回值收敛为只包含 `nickname/avatarUrl/sign/ext` 的摘要对象。
- **FR-009**: 查询结果中的服务端字段 `username`、`avatarurl` 及各种 `data/entities` 包装层必须在 SDK 内部完成归一化；调用方只能看到驼峰命名的业务对象。
- **FR-009A**: 查询接口当前已确认的服务端成功响应结构为 `{ timestamp, data, lastModified, duration }`；其中 `data` 为 `Record<userId, attributes>`，`lastModified` 为 `Record<userId, timestamp>`。实现与测试必须基于该结构编写，并以 `data` 作为资料归一化主数据来源。
- **FR-010**: 两个查询 API 在部分用户未命中时都必须仅返回命中项，不构造占位对象，也不把未命中视为整体失败。
- **FR-011**: 两个查询 API 对输入 `userIds` 都必须先做参数校验与去重；去重不得改变其余有效用户 ID 的相对顺序。
- **FR-012**: `updateOwnInfo` 必须作为当前用户资料整对象更新的主 API，对外接受对象参数，并至少覆盖 `nickname`、`avatarUrl`、`mail`、`phone`、`gender`、`sign`、`birth`、`ext` 这些可写字段。
- **FR-013**: `updateOwnInfoByAttribute` 必须作为当前用户资料单属性更新 API，对外接受明确的 `attribute` 与 `value` 输入，而不是继续沿用旧工程 `(key, value)` 的弱类型风格。
- **FR-014**: `updateOwnInfo` 成功时必须返回标准化后的当前用户资料视图 `UserInfo`，至少稳定包含 `userId` 与本次成功写入的字段；不得透传服务端原始响应包装。
- **FR-015**: `updateOwnInfoByAttribute` 成功后必须保证当前登录会话内的用户资料缓存与后续查询结果保持一致；其返回语义必须与 `updateOwnInfo` 保持一致，同样返回标准化后的 `UserInfo`，不得引入另一套原始服务端包装。
- **FR-015A**: 旧的 `updateUserInfo` 与 `updateOwnUserInfo` 本期必须从公开 API、类型导出、文档示例与测试主路径中移除，不再提供兼容别名。
- **FR-016**: 调用方显式传入 `''` 的字符串字段或属性值时，系统必须将其视为合法的“清空字段”请求，而不是忽略该字段。
- **FR-017**: 调用方显式传入 `false`、`0` 等合法布尔或数字值时，系统必须保留该值，不得因真假值判断丢失更新意图。
- **FR-018**: 两个更新 API 与查询 API 在成功后都必须更新当前登录会话可见的用户资料缓存或内存态，以满足 `specs/014-local-cache-module/spec.md` 的回写要求；同时不得因缓存仍为摘要模型而丢失本期新增公开字段的可见性。
- **FR-019**: 所有用户资料域 API 必须优先以 Promise 作为主返回方式；如保留 `success/error` 回调，仅可作为兼容能力，不得替代 Promise 主语义。
- **FR-020**: 所有用户资料域 API 在参数非法时必须在发起网络请求前抛出统一的 `ValidationError`；网络或业务失败时必须抛出统一 SDK 错误对象，不得把旧工程 `{ data, entities, path, timestamp }` 等包装结构直接交给调用方判断。
- **FR-021**: `UserInfoManager` 通过 `client.use(UserInfoManager)` 注册后，对外调用方式必须是 `client.userInfoManager.xxx()`；`ChatClient.init({ managers: [UserInfoManager] })` 也必须保持同一访问方式。
- **FR-022**: 当前公开文档、示例、JSDoc 与类型导出必须以 `updateOwnInfo`、`updateOwnInfoByAttribute`、`fetchUserInfoByUserId`、`fetchUserInfoByAttribute` 为主展示名称，并修正所有不符合 009 的 `use()` 使用示例。
- **FR-022A**: 当前公开文档、示例、JSDoc、类型导出与测试示例中若存在 `fetchUserInfoById`，必须同步替换为新的查询 API，并提供明确迁移说明。
- **FR-022B**: 当前公开文档、示例、JSDoc、类型导出与测试示例中若存在 `updateUserInfo` 或 `updateOwnUserInfo`，必须同步替换为新的更新 API，并提供明确迁移说明。
- **FR-023**: 026 的范围仅限用户资料查询/更新 manager API、对应类型、文档与测试对齐，不包含新的“当前用户资料快照只读 API”、搜索用户、分页查询用户资料或额外社交资料字段扩展。
- **FR-024**: 更新接口当前已确认的服务端成功响应结构为 `{ timestamp, data, lastModified, duration }`；实现与测试必须基于该结构编写，并以 `data` 作为用户属性归一化的主数据来源。

### Key Entities _(include if feature involves data)_

- **UserInfo**: 用户资料业务对象，表示 SDK 对外暴露的一条标准化用户资料结果；至少包含 `userId`，并可携带 `nickname`、`avatarUrl`、`mail`、`phone`、`gender`、`sign`、`birth`、`ext`。
- **FetchUserInfoByUserIdParams**: 默认字段查询参数对象，表示针对多个目标用户发起“按用户 ID 查询默认字段”的输入语义。
- **FetchUserInfoByAttributeParams**: 属性查询参数对象，表示针对多个目标用户发起“按用户 ID + 属性集查询指定字段”的输入语义。
- **UserInfoFetchResponseEnvelope**: 查询接口服务端成功响应包装，包含 `timestamp`、`lastModified`、`duration` 与 `data`；其中 `data` 以 `userId` 为 key 存放该用户已设置过的属性对象。
- **UpdateOwnInfoParams**: 当前用户资料整对象更新参数，表示一次对当前登录用户资料的字段 patch。
- **UpdateOwnInfoByAttributeParams**: 当前用户资料单属性更新参数，表示一次对指定用户资料属性的更新请求。
- **UserInfoUpdateResponseEnvelope**: 更新接口服务端成功响应包装，包含 `timestamp`、`lastModified`、`duration` 与 `data`；其中 `data` 表示当前用户已设置过的全部属性。

### Assumptions & Dependencies

- `specs/009-manager-usage/spec.md` 已定义 manager 通过 `use()` / `init({ managers })` 注册，并通过 `client.<managerKey>` 访问；026 只允许在此规范内补齐 UserInfoManager。
- 当前 `docs/reference/api.md` 中把 `client.use(UserInfoManager)` 的返回值直接当成 manager 使用，这与 009 不一致；026 需要同步修正。
- 查询接口现已确认一种真实成功响应结构：`{ timestamp, data, lastModified, duration }`，其中 `data` 与 `lastModified` 都按 `userId` 建立映射；实现与测试应以该结构为主，同时兼容当前代码中已出现的历史响应变体。
- 本期接受查询 API 的破坏性调整，即旧的 `fetchUserInfoById` 不再保留兼容层；迁移成本通过文档、类型与变更说明承担。
- 本期接受更新 API 的破坏性调整，即旧的 `updateUserInfo` 与 `updateOwnUserInfo` 不再保留兼容层；迁移成本通过文档、类型与变更说明承担。
- 已确认更新接口成功响应中的 `data` 返回“当前用户已设置过的全部属性”；SDK 归一化时应优先信任该对象，而不是仅根据请求参数回填结果。
- 后续若为 UserInfoManager 生成类似 ContactManager 的“REST 与 SDK 返回对照”文档，应复用 `docs/reference/contact-manager-api.md` 的结构与写法。
- 014 当前的缓存摘要对象偏展示态，无法承载全部用户资料字段；026 需要确保对外查询/更新结果不再受该摘要模型限制。
- 本期不强制引入新的 demo 页面；若后续 demo 新增用户资料查询/更新入口，再补充更高层验收。

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: `UserInfoManager` 对外查询结果可稳定覆盖 `nickname/avatarUrl/mail/phone/gender/sign/birth/ext` 这些字段，资料字段缺失率为 0。
- **SC-002**: `fetchUserInfoByUserId` 与 `fetchUserInfoByAttribute` 的返回结果中，蛇形字段和原始包装层泄漏率为 0。
- **SC-002A**: 发布后的公开 API 面中，旧查询名 `fetchUserInfoById` 残留率为 0。
- **SC-003**: `updateOwnInfo` 与 `updateOwnInfoByAttribute` 在“多字段更新”“单属性更新”“空字符串清空”“`false/0` 合法值”四类场景下都能维持一致成功语义与返回结构，误丢字段率为 0。
- **SC-003A**: 发布后的公开 API 面中，旧更新名 `updateUserInfo` 与 `updateOwnUserInfo` 残留率为 0。
- **SC-004**: 当前公开文档与示例中，`UserInfoManager` 的 `use()` 接入方式全部与 009 规范一致，错误示例残留率为 0。
- **SC-005**: 旧更新名迁移到 `updateOwnInfo` / `updateOwnInfoByAttribute` 的替换路径清晰可执行，文档迁移指引覆盖率为 100%。
- **SC-006**: 基于已确认的更新成功响应样例，`updateOwnInfo` 与 `updateOwnInfoByAttribute` 都能稳定返回同一 `UserInfo` 语义，原始服务端包装字段外泄率为 0。
