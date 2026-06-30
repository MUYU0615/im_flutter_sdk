# 实施方案：用户资料订阅与变更通知

**Branch**: `033-user-info-subscription` | **Date**: 2026-04-23 | **Spec**: [spec.md](/Users/zhangdong/code/websdk2/specs/033-user-info-subscription/spec.md)  
**Input**: Feature specification from `/specs/033-user-info-subscription/spec.md`

## Summary

本特性在 026 `UserInfoManager` 与 025 `ContactManager` 的既有能力之上，补齐“陌生人资料订阅 REST API + 订阅/好友资料变更 notify 处理 + 会话内缓存同步 + 对外回调事件”这一整条链路。方案采用“`UserInfoManager` 公开订阅门面 + `user-info-subscription` REST 适配层 + `MessageReceiver`/`ChatClient` 内部 notify 收口 + 会话级用户资料运行时真相 + `ContactManager` 好友资料事件桥接”的结构：订阅列表相关能力继续归属 `UserInfoManager`，好友资料变化事件继续归属 `ContactManager`；两类 notify 都必须先完成 `lastModified` 保护下的资料 patch 与缓存写回，再派发对外事件；本地持久化仍只保留摘要缓存，不新增新的持久化介质，但会补一层会话级完整资料运行时态，保证 notify 带来的完整字段在当前登录会话内可读。

## Technical Context

**Language/Version**: TypeScript 5.x（strict）  
**Primary Dependencies**: 现有 `UserInfoManager`、`ContactManager`、`RestClient`、`CacheManager`、`EventHub`、MSync protobuf 编解码、Vitest、Vite、eslint  
**Storage**: 不新增新的持久化介质；localStorage 继续只保存 `UserInfoSummary` 摘要缓存；新增的完整资料真相保持会话级内存态；联系人快照继续复用现有 `ContactCache` / `CacheManager`  
**Testing**: `npm run test:run`、`npm run test:gate:pr`、`npm run lint`、`npm run type-check`、`npm run docs:api:check`  
**Target Platform**: Web SDK 主库（浏览器、微信小程序、uni-app、Electron Renderer、React Native 共享逻辑层）  
**Project Type**: 单仓库 SDK 库项目（`src/` + `tests/`）  
**Performance Goals**: 订阅 notify 到达后不要求额外补拉资料即可完成缓存更新与事件派发；`getContacts()` 保持同步读取；订阅 API 参数校验 fail-fast；乱序/重复 notify 不得导致重复刷新或资料回退  
**Constraints**:
- `UserInfoManager` 继续作为“陌生人资料订阅”唯一公开入口，`ContactManager` 继续作为“好友资料变化事件”唯一公开入口
- `subscribe_metadata_updated` 与 `contact_metadata_updated` 都必须遵循“先更新缓存，再派发事件”
- 资料 patch 必须基于服务端 `lastModified` 做版本保护，旧通知不得覆盖新缓存
- SDK 不得在发起订阅前基于本地好友状态做前置拦截
- 已确认 POST / DELETE / GET 成功响应样例：POST body 为 `usernames` 数组、DELETE 为 `usernames` query、GET 的 `data` 返回用户名数组；实现必须基于这些真实结构固化 REST 映射，禁止继续使用占位 envelope 假设
- 不新增新的持久化订阅名单；订阅关系以服务端查询为准
- 新增公开 API、事件、类型和文档必须满足双语注释与 manager 访问规范
**Scale/Scope**: 覆盖订阅/取消订阅/查询订阅、两类资料变更 notify 归一化、会话态资料 patch、`UserInfoManager`/`ContactManager` 事件扩展、测试与文档；不包含陌生人搜索、批量全量资料同步、新的联系人管理能力或 demo 新页面

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

预检结果：

- [x] **性能优先**: notify 链路以本地 patch + 事件派发为主，不引入收到 notify 后的强制补拉；`getContacts()` 继续保持同步读取
- [x] **类型安全**: 订阅 API 参数、订阅/好友资料变化事件载荷、内部 notify patch 与错误映射全部按 strict TypeScript 建模，不引入 `any`
- [x] **测试驱动**: 计划覆盖 REST 参数/错误映射、notify 归一化、`lastModified` 比较、缓存先更新后派发、跨 manager 协作与公开类型回归
- [x] **可靠性**: 两类 notify 都会通过统一版本比较与部分字段 merge 规则避免回退、误清空和重复派发
- [x] **可扩展性**: 保持 `UserInfoManager` / `ContactManager` 的公开边界稳定，并把 user-info notify 处理沉淀为可复用的内部归一化链路
- [x] **可观测性**: 订阅 REST、notify 解码失败、旧版本 patch 丢弃、会话态缓存合并与事件派发分支都会补结构化日志
- [x] **版本管理**: 新增公开 API 与事件后，后续实现必须同步更新版本号、`CHANGELOG.md`、双语文档与中文 commit

Phase 1 设计复检预期：条件通过。FR-025 要求的真实 POST / DELETE / GET 成功响应样例已于 2026-04-23 补齐；后续实现必须严格按已确认的 `usernames` body/query 与 GET 用户名数组结构推进，不再允许回退到占位 envelope 假设。

## Project Structure

### Documentation (this feature)

```text
specs/033-user-info-subscription/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/
│   └── requirements.md
├── contracts/
│   └── user-info-subscription.openapi.yaml
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── chat-client.ts
├── core/
│   └── message/
│       └── message-receiver.ts
├── cache/
│   ├── cache-manager.ts
│   ├── cache-types.ts
│   └── user-info-cache.ts
├── managers/
│   ├── user-info-manager.ts
│   ├── contact-manager.ts
│   ├── user-info/
│   │   ├── index.ts
│   │   ├── user-info-notify-normalizer.ts
│   │   └── user-info-runtime-store.ts
│   └── contact/
│       ├── index.ts
│       └── contact-friend-info-event.ts
├── rest/
│   ├── api-errors.json
│   ├── errors.ts
│   ├── user-info.ts
│   └── user-info-subscription.ts
├── types/
│   ├── connection.ts
│   ├── event-system.ts
│   ├── user-info.ts
│   ├── contact.ts
│   └── index.ts
└── index.ts

tests/
├── unit/
│   ├── managers/
│   │   ├── user-info-manager-subscription.test.ts
│   │   └── contact-manager-friend-info.test.ts
│   └── core/
│       └── message/
│           └── message-receiver-user-info-notify.test.ts
├── integration/
│   ├── user-info-manager/
│   │   └── user-info-subscription.integration.test.ts
│   ├── contact-manager/
│   │   └── contact-friend-info.integration.test.ts
│   └── mock/
│       └── manager-public-api.test.ts
├── contract/
│   └── user-info-subscription.contract.test.ts
└── types/
    └── user-info-subscription-types.test.ts
```

**Structure Decision**: 保持单仓库单项目结构，不新建全局 domain 层。033 只在现有 `user-info` / `contact` / `cache` / `core/message` 路径内增量扩展：`UserInfoManager` 承担订阅 API 与订阅事件公开门面，`ContactManager` 承担好友资料变化事件公开门面，`MessageReceiver` 与 `ChatClient` 承担原始 notify 收口与内部编排，`CacheManager` 增加会话级完整资料运行时态但不改变持久化落盘模型，`rest/user-info-subscription.ts` 作为新增 REST 适配层承接订阅接口。

## Phase 0: Research

输出：

- `specs/033-user-info-subscription/research.md`

研究与确认项：

1. 固化订阅接口真实成功响应样例
   - 已确认 POST / DELETE / GET success envelope 共同字段与 `data/count` 语义
   - 已确认 POST body 使用 `usernames`，DELETE 使用 `usernames` query
   - 已确认 GET `data` 为用户名数组，查询链路需要二次 hydrate 才能满足 SDK 对外 `ReadonlyArray<UserInfo>` 语义
   - 将真实样例沉淀为测试 fixture 与契约依据
2. 固化两类 notify 的原始 payload
   - 明确 `subscribe_metadata_updated` / `contact_metadata_updated` 中 `username`、`metadata`、`lastModified` 与可选字段的真实形态
   - 明确字段缺省、空 patch、重复 notify 与多端重复投递的处理边界
3. 固化 `lastModified` 与缓存版本关系
   - 明确当前 `UserInfoSummary.lastUpdate`、会话态完整资料版本与 notify `lastModified` 的映射规则
   - 解决当前 `UserInfoCache.setAll()` 覆盖服务器时间戳的问题，避免旧 notify 误覆盖
4. 固化会话级完整资料运行时态
   - 明确哪些字段继续落盘为 summary，哪些字段仅保留会话态
   - 明确登录切换、登出、manager 重绑时的清理边界
5. 固化公开事件归属与 payload
   - `onUserInfoUpdated` 的元信息边界
   - `onContactInfoUpdated` 与 `Contact` 快照可用性规则
   - 明确同一用户既是好友又已订阅时的事件归属只以 notify 类型为准
6. 固化订阅错误映射
   - 把 401、403、400 两类超限的服务端响应样例对齐到 `api-errors.json`
   - 确认错误文案、重试性与推荐 action

## Phase 1: Design & Contracts

输出：

- `specs/033-user-info-subscription/data-model.md`
- `specs/033-user-info-subscription/contracts/user-info-subscription.openapi.yaml`
- `specs/033-user-info-subscription/quickstart.md`

设计要点：

### 1. 扩展用户资料域公开 API 与事件面

- 在 `src/types/user-info.ts` 中新增：
  - `SubscribeUsersInfoParams`
  - `UnsubscribeUsersInfoParams`
  - `SubscribedUserInfoChangedEvent`
  - 订阅列表查询返回与内部 patch 类型
- 在 `src/managers/user-info-manager.ts` 中新增：
  - `subscribeUsersInfo({ userIds })`
  - `unsubscribeUsersInfo({ userIds })`
  - `getSubscribedUsers()`
  - `addEventHandler(id, handlers)` / `removeEventHandler(id)`，用于 `onUserInfoUpdated`
- `src/types/event-system.ts` 中新增 `UserInfoEventName`、`UserInfoEventPayloadMap`、`UserInfoEventHandlerMap`

### 2. 扩展联系人域好友资料变化事件

- 在 `src/types/contact.ts` 中新增 `FriendInfoChangedEvent`
- 在 `src/types/event-system.ts` 中为 `ContactEventName` 增加 `onContactInfoUpdated`
- `ContactManager.addEventHandler()` 继续复用既有入口，但类型面扩展为可监听好友资料变化
- `onContactInfoUpdated` payload 至少包含：
  - `userId`
  - `userInfo`
  - `contact?`
  - `lastModified?`

### 3. 新增订阅 REST 适配层与错误映射

- 新增 `src/rest/user-info-subscription.ts`
- 封装：
  - 订阅新增 endpoint 构造
  - 订阅取消 endpoint 构造
  - 订阅列表查询 endpoint 构造
  - 请求前去重、空值过滤、单次最多 100 人校验
  - POST `userIds -> usernames` body 映射、DELETE `userIds -> usernames=<csv>` query 映射
  - GET success `data: string[]` 通过现有 user-info 查询能力继续 hydrate 为 `ReadonlyArray<UserInfo>`
  - 成功响应归一化为 `void` 或 `ReadonlyArray<UserInfo>`
- 扩展 `src/rest/api-errors.json` 与 `src/rest/errors.ts`
  - 为三类操作补齐 operation name
  - 明确 401、403、400 两种超限错误的统一映射
- success 解析以已确认真实样例为准，不再保留 `pending-real-sample` 占位逻辑

### 4. 建立 user-info notify 内部事件链路

- 在 `src/types/connection.ts` / `src/types/event-system.ts` 中新增 `InternalEventName.USER_INFO_NOTIFY`
- 新增原始内部类型，例如 `UserInfoRawNotifyEvent`
- `src/core/message/message-receiver.ts` 识别：
  - `subscribe_metadata_updated`
  - `contact_metadata_updated`
- `MessageReceiver` 不直接派发公开事件，而是把原始 notify 转成内部事件交给 `ChatClient` 编排，保持与 group/chatroom 当前模式一致

### 5. 在 ChatClient 内统一编排 notify -> manager 的处理顺序

- `ChatClient` 监听 `InternalEventName.USER_INFO_NOTIFY`
- 编排顺序固定为：
  1. 归一化 raw notify
  2. 执行 `lastModified` 比较
  3. 合并到会话级资料真相与 summary 投影
  4. 根据 notify 类型路由到 `UserInfoManager` 或 `ContactManager`
  5. 最后派发公开事件
- 这样可以避免在 `MessageReceiver` 直接依赖 manager，也能统一处理“先更新缓存，再派发”

### 6. 增加会话级完整资料运行时真相

- 当前 localStorage `UserInfoSummary` 只能承载 `nickname/avatarUrl/sign/ext`
- 033 需要在 notify 场景下保证更多公开字段在当前会话可读，因此需要新增会话级完整资料运行时态
- 设计上采用“运行时完整资料 + 持久化摘要投影”双层模型：
  - 完整资料运行时态只保留在内存
  - 摘要字段继续投影到 `CacheManager` / `UserInfoCache`
- `lastModified` 版本比较以运行时完整资料真相为准；summary 的 `lastUpdate` 需要保留服务器时间戳语义，不能再统一覆写为 `Date.now()`

### 7. 收口部分字段 patch 合并策略

- notify 归一化采用 patch merge，而不是全量替换
- 未出现在 notify 中的字段保持已有值
- 若当前缓存不存在该用户，则基于 notify 建立最小可用 `UserInfo`
- 对等价重复 notify：
  - 不重复刷新缓存版本
  - 不重复派发无意义事件
- 对旧版本 notify：
  - 记录结构化日志
  - 丢弃 patch
  - 不派发“回退型”事件

### 8. ContactManager 与联系人快照协作

- 好友资料变化的真相仍先写入 user-info 运行时态与摘要缓存
- `ContactManager.getContacts()` 继续通过联系人关系快照 + 最新用户资料投影构建结果
- `onContactInfoUpdated` 事件在可构建完整联系人快照时附带 `contact`
- 若 remark / addTs 等关系字段当前不可用，仍要继续派发至少带 `userId`、`userInfo` 的事件

### 9. 文档、契约与测试切面

- `contracts/user-info-subscription.openapi.yaml` 约束：
  - 订阅新增 / 取消 / 查询三项 SDK-facing REST 语义
  - 原始成功 envelope 与 SDK 业务返回模型
  - `SubscribedUserInfoChangedEvent` / `FriendInfoChangedEvent` schema
- `quickstart.md` 说明：
  - 如何注册 `UserInfoManager` / `ContactManager`
  - 如何调用订阅 API
  - 如何监听两类资料变化事件
  - 如何验证“先更新缓存，再派发”
- 测试切面：
  - 单元：参数、错误映射、patch merge、版本比较、事件顺序
  - 集成：REST + CacheManager + EventHub + MessageReceiver + ChatClient 协作
  - 契约：真实响应 fixture 与 contract 同步
  - 类型/JSDoc：根导出、事件处理器类型、双语注释与 docs gate

## Agent Context Update

执行命令：

```bash
SPECIFY_FEATURE=033-user-info-subscription .specify/scripts/bash/update-agent-context.sh codex
```

预期：把 033 的当前活跃技术、用户资料订阅边界、notify 处理链与“实现前必须补齐真实成功响应样例”的约束同步到 agent context，供 `/speckit.tasks` 与后续实现阶段使用。

## Phase 2: Task Planning Approach

由 `/speckit.tasks` 继续拆解任务，按以下主线生成：

1. 扩展 `user-info` / `contact` 公开类型、事件类型与根导出
2. 落地订阅 REST 适配层、参数校验与统一错误映射
3. 在 `CacheManager` 建立“完整资料运行时态 + 摘要投影”双层缓存
4. 为 `MessageReceiver` / `ChatClient` 增加 user-info notify 内部事件与编排链路
5. 在 `UserInfoManager` 中实现订阅 API、订阅事件与 notify patch 合并
6. 在 `ContactManager` 中实现好友资料变化事件桥接与联系人快照协作
7. 补齐单元、集成、契约、类型与 docs gate 测试
8. 完成版本号、`CHANGELOG.md`、验证与中文 commit

## Complexity Tracking

无额外豁免项。
