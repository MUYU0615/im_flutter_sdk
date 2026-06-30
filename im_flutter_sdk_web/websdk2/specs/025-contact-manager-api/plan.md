# 实施方案：联系人管理 API 补齐（阶段二）

**Branch**: `025-contact-manager-api` | **Date**: 2026-03-23 | **Spec**: `specs/025-contact-manager-api/spec.md`  
**Input**: Feature specification from `/specs/025-contact-manager-api/spec.md`

## Summary

本特性在现有 `ContactManager` 与 024 联系人同步/缓存能力之上，补齐联系人域的 9 个原工程 API，并恢复原工程常用的 5 个 roster 联系人事件：保留当前同步读取语义的 `getContacts()`，新增 `addContact`、`deleteContact`、`acceptContactInvite`、`declineContactInvite`、`setContactRemark`、`getBlocklist`、`addUsersToBlocklist`、`removeUserFromBlocklist`，并支持 `onContactInvited`、`onContactDeleted`、`onContactAdded`、`onContactRefuse`、`onContactAgreed`。同时，公开联系人结构收敛为 `Contact { userId, userInfo: UserInfo, remark, addTs }`，不再继续对外暴露 `getSnapshot()` 与 `getContactList()`；黑名单与 roster 事件中的 `userInfo` 也统一复用 `UserInfo` 全字段视图，但 localStorage 仍保持摘要缓存 + 运行时合并，不新增完整第二份持久化副本。方案采用“`ContactManager` 公开门面 + 联系人 REST 适配层 + `UserInfoManager` 资料补齐桥接 + msync roster meta 解码 + 024 联系人缓存/同步复用”的结构：所有异步接口统一 Promise 化、驼峰化、错误归一化；`getBlocklist` 固定返回`UserInfo[]`，黑名单写接口统一使用 `userIds: string[]`；联系人写操作按能力差异采用三类协调策略，分别是 `noop`、`local_patch` 与 `controlled_refresh`；联系人 roster 事件通过 `EventHub` 统一派发，并对联系人建立/删除事件执行本地缓存 patch，对 `onContactInvited`、`onContactAdded`、`onContactRefuse`、`onContactAgreed` 补齐 `userInfo` 后再对外派发，保证同一会话内 `getContacts()` 与 `getBlocklist()` 可观察到一致状态。

## Technical Context

**Language/Version**: TypeScript 5.x（strict）  
**Primary Dependencies**: zod、vitest、vite、eslint、现有 `RestClient`、`CacheManager`、`EventHub`、MSync protobuf 编解码、024 联系人同步控制器与错误映射模块  
**Storage**: 联系人关系缓存沿用 localStorage（`ContactCache` / `CacheManager`）；黑名单仅维护会话级内存快照，不新增持久化  
**Testing**: Vitest（unit + integration + contract + types/JSDoc 回归）  
**Target Platform**: Web、微信小程序、uni-app（小程序/App/H5）、Electron Renderer、React Native  
**Project Type**: 单仓库 SDK 库项目（`src/` + `tests/`）  
**Performance Goals**: `getContacts()` 保持纯同步读取且无额外网络开销；联系人/黑名单异步写接口参数校验 fail-fast；联系人写操作后的状态协调不引入长期驻留连接；roster 事件处理必须优先复用缓存，仅在资料缺口存在时触发受控补拉
**Constraints**: `getContacts()` 不得退化为异步远程查询；5 个联系人写接口当前统一成功返回 `void`；`getBlocklist()` 固定返回`UserInfo[]`；黑名单写接口统一 `userIds: string[]` 且本地先去重；不再继续对外暴露 `getSnapshot()` 与 `getContactList()`；联系人/黑名单/roster 事件里的 `userInfo` 统一使用 `UserInfo`；错误处理遵循 005；日志遵循 012；已知黑名单添加 404 样例必须稳定映射；不得破坏 024 的联系人同步事件语义；新增联系人事件必须继续复用 `EventHub` / `contactManager.addEventHandler()`，不得回退到 connection 层 API；资料补拉失败时不得吞掉黑名单结果或联系人事件
**Scale/Scope**: 覆盖联系人增删申请处理、备注更新、黑名单查询/增删、原工程 5 个 roster 联系人事件恢复、返回结构归一化与会话内一致性；不包含联系人申请列表、联系人搜索、分页联系人公开接口、事件模型重写与 demo 新页面

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

预检结果：

- [x] **性能优先**: 保留 `getContacts()` 同步快照读取；联系人写操作只触发必要的本地补丁或受控刷新，不增加常驻链路；分页/事件资料补齐仅在缓存缺口存在时触发
- [x] **类型安全**: 对外参数、返回结构、黑名单结果与内部归一化模型全部使用 strict 类型；不暴露旧工程弱类型 `name` / `AsyncResult`
- [x] **测试驱动**: 计划覆盖 9 个 API 的参数校验、错误映射、快照协调、`getBlocklist()` 资料补拉、事件 `userInfo` 补齐、黑名单部分成功结构、整单失败映射与移除幂等成功
- [x] **可靠性**: 复用统一 REST 超时/传输错误处理；联系人写操作后采用受控缓存协调，避免同会话长期读到旧值
- [x] **可扩展性**: 维持 `ContactManager` 单入口，不引入 connection 风格别名；黑名单对象层与联系人事件对象层都为后续扩展字段保留兼容边界
- [x] **可观测性**: 在联系人/黑名单 REST 调用、归一化失败、缓存补丁、受控刷新、资料补拉命中率与错误分支输出结构化日志
- [x] **版本管理**: 本期先完成方案设计；实现阶段按版本号、CHANGELOG、commit 流程执行

Phase 1 设计复检结果：通过（见 `research.md`、`data-model.md` 与 `contracts/contact-manager.openapi.yaml`，未引入额外宪章冲突）。

## Project Structure

### Documentation (this feature)

```text
specs/025-contact-manager-api/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── contact-manager.openapi.yaml
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── managers/
│   ├── contact-manager.ts
│   └── contact/
│       └── index.ts
├── rest/
│   ├── client.ts
│   ├── contact-management.ts
│   ├── api-errors.json
│   └── errors.ts
├── cache/
│   ├── cache-manager.ts
│   ├── cache-types.ts
│   └── contact-cache.ts
├── types/
│   ├── contact.ts
│   ├── chat-client.ts
│   └── index.ts
├── chat-client.ts
└── index.ts

tests/
├── unit/
│   └── contact-manager/
├── integration/
│   └── contact-manager/
└── contract/
    └── contact-manager.contract.test.ts
```

**Structure Decision**: 采用单项目结构，延续仓库当前 manager 模式。`ContactManager` 负责公开 API、参数校验与会话内状态协调；`src/rest/contact-management.ts` 负责旧工程 REST endpoint 适配与服务端响应归一化；联系人快照一致性继续复用 024 的 `CacheManager` / `ContactCache` / `RosterSyncController`，并通过 `UserInfoManager` 或等价资料查询桥接为联系人分页和指定联系人事件补齐 `userInfo`；黑名单仅在 manager 内维护会话级快照，不新增持久化层。

## Phase 0: Research

输出：`specs/025-contact-manager-api/research.md`

- 固化 `getContacts()` 继续作为同步快照读取入口，不回退到旧工程远程 roster 接口
- 固化 `getBlocklist()` 与 roster 事件的资料补齐顺序：优先复用现有快照，再按批量补拉缺失用户属性
- 固化联系人写操作的三类协调策略：`noop`、`local_patch`、`controlled_refresh`
- 固化黑名单建模：对外对象数组、会话级内存快照、写接口统一 `userIds: string[]`
- 固化联系人 REST 适配策略：旧 endpoint 保留，返回结构全部在 SDK 内做驼峰化与包装层剥离
- 固化错误契约：联系人/黑名单业务错误进入统一 `api-errors.json` 与 `RestBusinessError`
- 固化与 024 的协作边界：复用联系人缓存/同步，不重写同步协议、不破坏现有事件
- 固化联系人事件资料补齐回退策略：资料接口失败时继续派发事件，但 `userInfo` 至少保留 `userId`

## Phase 1: Design & Contracts

输出：

- `specs/025-contact-manager-api/data-model.md`
- `specs/025-contact-manager-api/contracts/contact-manager.openapi.yaml`
- `specs/025-contact-manager-api/quickstart.md`

设计要点：

1. 扩展 `src/types/contact.ts`，增加联系人/黑名单管理 API 的请求与响应类型，并为公开方法补齐双语 JSDoc
2. 新增 `src/rest/contact-management.ts`，封装旧工程 8 个异步 REST endpoint 的 path、body、operation name 与原始响应归一化
3. 在 `src/protocol/msync/codec.ts`、`src/core/message/message-receiver.ts` 与 `src/types/event-system.ts` 中补齐 roster meta 解码与联系人事件派发，把原工程 `ADD/REMOVE/ACCEPT/DECLINE/REMOTE_ACCEPT/REMOTE_DECLINE` 映射为 `ContactManager` 可监听的 5 个联系人事件
4. 在 `ChatClient` / `CacheManager` 中补齐联系人 roster 事件的会话内缓存 patch：`onContactAdded` / `onContactAgreed` 写入最小联系人关系，`onContactDeleted` 删除联系人，并同步更新 `rosterVer`
5. 在 `ContactManager` 中落地三类联系人写操作协调策略：
   - `addContact` / `declineContactInvite`：成功仅返回 `void`，不修改当前联系人快照
   - `deleteContact` / `setContactRemark`：对 `ContactCache` 增加本地补丁 helper，成功后立即重建快照
   - `acceptContactInvite`：新增 ChatClient 内部受控刷新 helper，复用 024 联系人同步控制器获取完整联系人投影
6. 为黑名单建立会话级快照：`getBlocklist` 首次从服务端获取并补齐 `userInfo`，`addUsersToBlocklist` / `removeUserFromBlocklist` 在成功后本地补丁，保证同会话一致性
7. 扩展 `src/rest/api-errors.json` 与必要错误码使用约定，至少覆盖已确认的 `addUsersToBlocklist` 404 not found 业务错误
8. 在 `ContactManager` 中为 `getBlocklist()` 与 roster 事件增加基于缺口用户集合的资料补齐编排，统一复用 `fetchUserInfoByUserId` 默认字段查询结果组装 `UserInfo[]`
9. 在联系人事件派发链路中为 `onContactInvited`、`onContactAdded`、`onContactRefuse`、`onContactAgreed` 增加 `userInfo` 组装，优先命中缓存、缺失时受控补拉、失败时回退最小 `userInfo`
10. 明确测试切面：参数校验、原始响应 fixture 归一化、缓存补丁、受控刷新触发、`getBlocklist()` 资料补拉、roster 事件解码与派发、事件 `userInfo` 回退、黑名单快照补丁、JSDoc 与类型导出

## Agent Context Update

执行命令：

```bash
SPECIFY_FEATURE=025-contact-manager-api .specify/scripts/bash/update-agent-context.sh codex
```

预期：把 025 的当前活跃技术、联系人管理 API 范围与最近变更补充到仓库 agent 上下文，供 `/speckit.tasks` 与实现阶段使用。

## Phase 2: Task Planning Approach

由 `/speckit.tasks` 继续拆解任务，按以下主线生成：

1. `ContactManager` 公开 API、类型导出与双语 JSDoc 扩展
2. 联系人 REST 适配层与统一错误映射落地
3. `deleteContact` / `setContactRemark` 的联系人缓存本地补丁 helper
4. `acceptContactInvite` 的受控联系人刷新内部 helper 与 024 同步复用
5. 黑名单会话快照、查询/增删归一化、部分成功返回、整单失败映射与幂等成功语义
6. roster 联系人事件解码、对外分发与联系人缓存 patch
7. `getBlocklist()` 与联系人事件资料补齐桥接
8. 单元/集成/契约/类型测试、版本号与 CHANGELOG 更新

## Complexity Tracking

无额外豁免项。
