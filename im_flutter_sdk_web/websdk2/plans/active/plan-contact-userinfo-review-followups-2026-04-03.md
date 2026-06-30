# 联系人 / UserInfo review follow-ups 实施计划

## 背景

本次 review follow-up 同时影响：

- `024-contact-sync`
- `025-contact-manager-api`
- `026-user-info-manager-api`

变更包含对外类型命名收敛、联系人模型调整、同步事件语义调整，以及联系人同步 websocket client 的抽象重构，属于跨 feature 的中高风险改动，先落计划再实施。

## 逐条评估

### 1. 对外 `UserInfoProfile` 全部改成 `UserInfo`

结论：应修改。

原因：

- 当前 `UserInfoProfile` 实际已经是 SDK 对外业务对象，不再只是“profile 投影”。
- `ContactUserInfo` 也准备直接复用这套对象时，统一成 `UserInfo` 更自然。
- 当前仓库里该名字已出现在公开类型、JSDoc、文档、spec、contracts、tests，多处需要同步收敛，不能只改代码不改规格。

影响范围：

- `src/types/user-info.ts`
- `src/managers/user-info-manager.ts`
- `src/managers/contact/contact-user-info-resolver.ts`
- `src/chat-client.ts`
- `src/index.ts`
- `docs/reference/user-info-manager-api.md`
- `specs/026-user-info-manager-api/*`
- 相关 unit / integration / types tests

### 2. `core/contact-sync/roster-sync-controller` 里的 `lastSyncTs` 去掉

结论：应修改，而且建议不只删 controller 局部变量，要把“无效状态”整体清理。

原因：

- 当前 `parseRosterItems()` 里计算的 `lastSyncTs` 仅回写到缓存。
- 现有 `buildContactRosterRequest()` 只发送 `version` 和 `cursor`，并不发送 `lastSyncTs`。
- `decision` 虽然会参考 `cacheMeta.lastSyncTs` 决定 `incremental/full`，但请求构造并未消费这个判定，因此这条状态链路当前没有形成有效业务闭环。

建议处理：

- 移除 controller 内解析产出的 `lastSyncTs`
- 评估并同步移除 `ContactCacheMeta.lastSyncTs`、相关 spec/测试中的“按上次同步时间戳增量”表述
- 保留 `version + responseType + cursor` 作为当前已落地的同步判据

风险：

- 这会把 `024` spec 中关于“按上次同步时间戳增量”的描述改成“当前实现不依赖 lastSyncTs”
- 需要同步收敛若干测试 fixture

### 3. `RosterSyncClient` 重构，后续支持一个 websocket 长连接承载多种同步数据

结论：应修改，但本次建议做“抽象边界重构”，不一次把多业务都做进去。

原因：

- 当前 `RosterSyncClient` 命名、协议 codec、错误语义、session 生命周期都绑死在联系人同步。
- 后续若要复用一个 sync websocket 长连接承载多种数据，至少需要把“连接管理 / 会话管理 / 业务协议适配”分层。

建议落地范围：

- 本次先把 `RosterSyncClient` 抽成更通用的 sync socket client / transport 层
- 联系人同步继续作为首个 consumer，保留当前业务行为不变
- 不在本次直接引入“多业务复用一个常驻连接”的完整产品语义；先把代码从“只能联系人”改成“可扩展到多同步域”

原因补充：

- 如果一次性做到“常驻单连接 + 多数据类型多路复用 + 生命周期管理 + 兼容当前联系人同步”，风险过大，不适合和其余 6 个 review 修正在同一批里混做。

### 4. `types/contact.ts`

#### 4a. 移除 `remarkUpdatedAt`

结论：应修改。

原因：

- review 已明确对外不再需要这个字段。
- 当前 `Contact` 快照签名、REST 归一化、缓存投影、测试都依赖它，需要一起收敛。

#### 4b. 增加 `addTs`

结论：应修改。

原因：

- `ContactRelationRecord` 已持久化了 `addTs`，对外模型补出即可，属于现有数据的对外暴露收敛。

#### 4c. `ContactUserInfo` 直接使用 `UserInfo` 全量字段；评估 localStorage 是否还要精简字段

结论：对外应修改；持久化层建议继续精简，不新增完整第二份持久化副本。

原因：

- 对外 `Contact.userInfo` 与联系人事件里的 `userInfo` 直接复用 `UserInfo`，可以避免重复维护两套近似结构。
- 但 localStorage 层当前通过 `UserInfoSummary` + `ContactRelationRecord` 做拆分缓存，这与 `024` 的“不重复持久化完整 userInfo 副本”原则一致。

建议：

- 对外：`Contact.userInfo` / `BlocklistEntry.userInfo` / roster 事件 `userInfo` 全部改为 `UserInfo`
- 对内缓存：继续沿用 `UserInfoSummary` 精简持久化；不要把 `mail/phone/gender/birth` 再复制一份到联系人域 localStorage
- spec 里明确“公开对象使用 `UserInfo`，持久化仍采用摘要缓存 + 运行时合并”

### 5. `ContactManager` 不再暴露 `getSnapshot`、`getContactList`

结论：应修改，属于 025 对外 API 收敛。

原因：

- 当前 review 明确希望联系人域对外只保留快照式 `getContacts()`。
- `getSnapshot()` 暴露了内部完整性/来源元数据，`getContactList()` 又引入单独 REST 读取语义，和“联系人自动同步 + 当前快照读取”方向不一致。

建议：

- 从公开 API、导出、文档、spec、测试里移除这两个方法
- 内部若仍需要快照/分页能力，可保留为 `ChatClient` 或 `ContactManager` 私有 helper，不继续对外文档化

风险：

- 这是破坏性 API 变更，需要在 `025` spec、CHANGELOG、类型测试里明确迁移说明

### 6. `chat-client` 173 行 `triggerContactSync` 是否有必要

结论：当前实现里这次调用大概率没有必要，建议移除，并保留登录完成后的单一触发点。

原因：

- `src/chat-client.ts:173` 触发条件是 `CONNECTED + LOGIN + this.currentUserId`。
- 但首次登录时 `this.currentUserId` 是在 `await this.core.connect()` 之后才赋值；连接事件更早到达时，该条件通常不成立。
- 真正有效的触发点是登录流程后半段的 `src/chat-client.ts:423`，当时缓存和用户态已经初始化完成。

建议：

- 去掉 173 这一处
- 保留登录完成后、缓存初始化完成之后的单一触发路径
- 若后续要改成事件驱动，也应先把用户态初始化顺序调整好，再保留唯一入口

### 7. 自动联系人同步开启时，DNS 里取不到 `sync-ws` 也要回调 `startSync` / `finishedSync(error)`；去掉 `syncFailed`

结论：应修改，且这是 024 对外事件语义的破坏性调整。

现状：

- 目前 `ensureAutoContactSyncAvailable()` 在 DNS 缺失 `sync-ws` 或 DNS 解析失败时直接返回 `false`
- 结果是整轮自动同步被跳过，不派发任何同步事件
- 另外对外还保留了 `onContactSyncFail`

建议收敛：

- 去掉对外 `onContactSyncFail`
- `onContactSyncStart` 只要进入自动同步流程就派发
- `onContactSyncFinish` 增加可选 `error`
- DNS 缺失 `sync-ws`、DNS 解析失败、metadata 失败、socket 失败等都走 `finish({ error })`

需要同步修改：

- `src/types/contact.ts`
- `src/types/event-system.ts`
- `src/chat-client.ts`
- `src/core/contact-sync/roster-sync-controller.ts`
- `024` / `025` spec 与 tasks
- 大量 contact-sync unit / integration tests

## 计划中的实现分组

### A. UserInfo 命名收敛

- 把公开 `UserInfoProfile` 重命名为 `UserInfo`
- 同步更新 contact resolver、导出、文档、spec、contracts、测试

### B. Contact 对外模型收敛

- `Contact.userInfo` 改为 `UserInfo`
- 移除 `remarkUpdatedAt`
- 增加 `addTs`
- `BlocklistEntry.userInfo` / roster 事件 `userInfo` 一并复用 `UserInfo`
- 保持持久化层继续使用 `UserInfoSummary`

### C. ContactManager API 面收敛

- 移除对外 `getSnapshot`
- 移除对外 `getContactList`
- 清理文档、导出、types tests、integration tests 中的公开使用路径

### D. Contact Sync 语义收敛

- 移除无效的 `lastSyncTs` 状态链路
- 去掉 `onContactSyncFail`
- `onContactSyncFinish` 改为可携带 `error`
- DNS 缺失 `sync-ws` / DNS 失败时也要形成 `start -> finish(error)` 闭环
- 去掉 `chat-client.ts:173` 的冗余触发

### E. Sync Client 抽象重构

- 将 `RosterSyncClient` 从“联系人专属 client”重构成可复用的 sync transport / socket client
- 联系人同步保留为第一层业务包装
- 本次不直接引入多业务共享常驻连接的完整产品行为

## Spec 同步范围

需要至少更新：

- `specs/024-contact-sync/spec.md`
- `specs/024-contact-sync/plan.md`
- `specs/024-contact-sync/tasks.md`
- `specs/025-contact-manager-api/spec.md`
- `specs/025-contact-manager-api/plan.md`
- `specs/025-contact-manager-api/tasks.md`
- `specs/026-user-info-manager-api/spec.md`
- `specs/026-user-info-manager-api/plan.md`
- `specs/026-user-info-manager-api/tasks.md`

重点同步内容：

- `UserInfoProfile -> UserInfo`
- `Contact` 对外字段从 `remarkUpdatedAt` 改为 `addTs`
- `ContactManager` 公开 API 面缩减
- 联系人同步事件从 `start/finish/fail` 改为 `start/finish(error?)`
- 删除 `lastSyncTs` 相关 requirement / entity / success criteria / task
- `RosterSyncClient` 的设计从“联系人专属实现”改成“可扩展同步 transport”

## 测试分层

### 单元测试

- `tests/unit/managers/user-info-manager.test.ts`
- `tests/unit/managers/contact-manager.test.ts`
- `tests/unit/contact-sync/roster-sync-controller.test.ts`
- `tests/unit/contact-sync/roster-sync-client.test.ts`
- `tests/unit/contact-sync/contact-cache.test.ts`
- `tests/unit/chat-client/contact-roster-events.test.ts`
- `tests/types/user-info-manager-types.test.ts`

覆盖重点：

- `UserInfo` 命名与返回类型
- `Contact` 字段变更
- 同步 finish error 语义
- DNS 缺失 `sync-ws` 也派发 `start -> finish(error)`
- 公开 API 移除后的类型面

### 集成测试

- `tests/integration/contact-sync/contact-sync-login.integration.test.ts`
- `tests/integration/contact-manager/contact-manager.integration.test.ts`

覆盖重点：

- 自动同步 DNS 缺失 / DNS 失败闭环
- `onContactSyncFail` 移除后的事件观察方式
- `ContactManager` 只保留 `getContacts()` 的对外读取路径

### E2E

- 本轮预计不新增
- 理由：变更主要集中在 SDK API、同步状态机和文档类型面，现有集成测试足以兜底

## 验证

- `npm run test:run`
- `npm run lint`
- `npm run type-check`
- `npm run docs:api:check`

## 收尾

实现完成后按仓库规则执行：

1. 完整验证
2. 更新版本号
3. 更新 `CHANGELOG.md`
4. 提交 `git commit`

## 待你确认

- 是否按上述范围一起收敛 `024/025/026` 的 spec、plan、tasks
- `RosterSyncClient` 本次是否按“先抽 transport 层，不直接做常驻多业务复用”执行
