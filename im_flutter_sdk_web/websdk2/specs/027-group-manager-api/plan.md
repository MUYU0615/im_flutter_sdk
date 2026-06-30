# 实施方案：GroupManager API 迁移、命名收敛与事件标准化

**Branch**: `027-group-manager-api` | **Date**: 2026-04-08 | **Spec**: `specs/027-group-manager-api/spec.md`  
**Input**: Feature specification from `/specs/027-group-manager-api/spec.md`

## Summary

本特性将把旧工程 `groupApi.ts` 的群组域能力迁移到新的 `GroupManager`，并同时完成四类收敛：一是公开 API 从 connection 风格切换到 `client.groupManager.xxx()`；二是引入 `groupManager.getGroup(groupId)` 返回轻量 `Group` 对象，把单群上下文方法迁入 `Group`，而群列表继续保持 plain object 返回；三是所有公开命名、批量参数与返回结构按当前 SDK 规范收口，移除旧别名、`whitelist` 命名、单/多用户双入口与原始 REST 包装层；四是把旧 `handleMucMsg.ts` 中的群事件映射为 Web SDK 收敛后的多事件模型，载荷采用 Web 对象化语义。方案采用“`GroupManager` 入口门面 + `Group` 单群 façade + 群组 REST 适配层 + 用户资料补齐桥接 + MUC 事件解码映射 + 受控群详情补拉”的结构：列表与详情继续返回业务对象，凡是旧接口返回 `userId` 的地方都先走缓存命中、缺口批量 `fetchUserInfoByUserId`、失败回退最小 `UserInfo`；事件侧在 `msync` 编解码层新增 `MUCBody` 解码与 operation->event 映射，经 `EventHub` 派发到 `GroupManager`，并在 `onGroupInfoChanged` / `onGroupDisabledChanged` 这类群对象事件上按需补拉完整群详情后再对外派发。`Group` 本身不作为前端状态真相，只承担绑定 `groupId` 的单群上下文调用职责。

## Technical Context

**Language/Version**: TypeScript 5.x（strict）  
**Primary Dependencies**: zod、vitest、vite、eslint、现有 `RestClient`、`CacheManager`、`EventHub`、`UserInfoManager`、MSync protobuf 编解码、现有上传下载适配层  
**Storage**: 群组域不新增持久化介质；用户资料继续复用现有 localStorage `CacheManager` / `UserInfoCache` 摘要缓存；群组列表/成员/黑名单/allowlist/禁言列表等默认保持会话级内存态  
**Testing**: Vitest（unit + integration + contract + types/JSDoc 回归）  
**Target Platform**: Web、微信小程序、uni-app（小程序/App/H5）、Electron Renderer、React Native  
**Project Type**: 单仓库 SDK 库项目（`src/` + `tests/`）  
**Performance Goals**: 群列表/详情/成员等接口参数校验 fail-fast；用户资料补齐优先命中缓存并按批量最小化补拉；群事件派发不因资料补齐失败阻塞；`onGroupInfoChanged` / `onGroupDisabledChanged` 仅在原始事件字段不足时才受控补拉详情  
**Constraints**: 必须遵循 009 manager 注册规范；列表查询继续返回业务对象或分页对象，不把列表项升级为 `Group` 富对象；单群上下文能力通过 `getGroup(groupId)` 返回的 `Group` 访问；写接口以 Promise 为主；批量用户输入统一使用 `userIds: string[]`；公开 API 名称移除旧别名与 `whitelist`；事件名按 Web SDK 命名规范收敛且事件载荷保持 Web 对象化模型；错误处理遵循 005；日志遵循 012；实现与测试必须基于真实 REST 响应样例；当前已由 `docs/reference/group-api.md` 确认已加入群列表、群详情、群成员、群管理员、禁言列表、黑名单、allowlist、公告、共享文件、批量成员属性、单成员属性同构约束，剩余未完全确认的接口在实现前不得拍字段
**Scale/Scope**: 覆盖旧 `groupApi.ts` 的群组域 API、MUC 群事件映射、对象化用户返回、公开类型/导出/JSDoc/文档与测试补齐；不包含聊天室、thread、移动端限定 `blockGroupMessages`、新的 demo 页面与真实环境 E2E 主链路

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

预检结果：

- [x] **性能优先**: 用户资料补齐采用 cache-first + batch-fetch-fallback；群对象类事件仅在必要时补拉详情，避免所有事件都走网络补偿
- [x] **类型安全**: GroupManager 公开 API、群事件类型、群对象/成员对象/共享文件对象全部以 strict TypeScript 建模，不保留旧 `AsyncResult` / 蛇形字段主语义
- [x] **测试驱动**: 计划覆盖 API 命名迁移、批量参数归一化、对象化用户补齐、MUC operation 映射、群对象事件补拉、错误映射与公开导出回归
- [x] **可靠性**: 复用统一 REST 超时与错误归一化；资料补齐失败不吞主业务结果；群对象事件补拉采用受控条件触发，避免事件丢失
- [x] **可扩展性**: GroupManager 作为唯一公开门面，REST 适配、事件映射、用户资料补齐与群对象补拉分层明确，后续可继续扩展群名片/成员属性/共享文件能力
- [x] **可观测性**: 在群组 REST 请求、MUC 解码失败、事件映射丢弃、资料补齐失败、详情补拉触发与降级路径上输出结构化日志
- [x] **版本管理**: 027 含公开 API 迁移与旧名移除，实施阶段必须补版本号、CHANGELOG 与迁移说明

Phase 1 设计复检结果：通过（见 `research.md`、`data-model.md`、`contracts/group-manager.openapi.yaml` 与 `quickstart.md`）。

## Project Structure

### Documentation (this feature)

```text
specs/027-group-manager-api/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── group-manager.openapi.yaml
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── managers/
│   ├── group-manager.ts
│   └── group/
│       ├── index.ts
│       ├── group.ts
│       ├── group-event-user-info-resolver.ts
│       ├── group-event-mapper.ts
│       └── group-normalizers.ts
├── rest/
│   ├── client.ts
│   ├── errors.ts
│   ├── api-errors.json
│   └── group-management.ts
├── types/
│   ├── group.ts
│   ├── event-system.ts
│   ├── chat-client.ts
│   └── index.ts
├── protocol/
│   └── msync/
│       ├── codec.ts
│       └── proto.ts
├── core/
│   └── message/
│       └── message-receiver.ts
├── chat-client.ts
└── index.ts

tests/
├── unit/
│   ├── managers/
│   └── group/
├── integration/
│   ├── group-manager/
│   └── mock/
├── contract/
│   └── group-manager.contract.test.ts
└── types/
    └── group-manager-types.test.ts
```

**Structure Decision**: 采用单项目结构，延续当前 manager 架构。`GroupManager` 负责公开入口、列表、创建、按 ID 获取 `Group`、参数校验、错误抛出、用户资料补齐编排与部分事件侧详情补偿；`src/managers/group/group.ts` 负责轻量 `Group` 单群 façade；`src/rest/group-management.ts` 负责旧工程 group REST endpoint 的 path/body/operation name 与 envelope 归一化；`src/protocol/msync/codec.ts` 扩展 `MUCBody` 解码与 operation->event 映射；`src/types/group.ts` 与 `src/types/event-system.ts` 定义群组业务对象、分页对象、`Group` 接口和 Web SDK 收敛后的多事件类型；必要的用户资料补齐逻辑下沉到 `src/managers/group/` 私有 helper，避免 `GroupManager` 本体膨胀。

## Phase 0: Research

输出：`specs/027-group-manager-api/research.md`

- 固化 `GroupManager + Group` 的混合模型：`GroupManager` 是群组域唯一入口，`Group` 是单群上下文 façade，旧 connection 风格 group API 不再提供兼容层
- 固化公开命名与参数收敛：列表查询统一 `getXxxList`，群管理批量写接口统一 `userIds: string[]`，allowlist 取代 whitelist
- 固化列表/状态模型边界：群列表保持 plain object 返回，不把 `Group` 实例直接暴露为列表数据结构
- 固化对象化用户补齐策略：所有用户相关读取结果与事件载荷均复用 `UserInfo`，走 cache-first + batch-fetch-fallback
- 固化事件收敛策略：事件名按 Web SDK 命名规范收敛，事件载荷保持 Web 标准化对象模型
- 固化群对象类事件策略：`onGroupInfoChanged` / `onGroupDisabledChanged` 返回完整群对象，必要时受控补拉群详情
- 固化未知 REST 样例治理：在拿到真实响应前，只允许先定义逻辑契约和待确认清单，不拍板具体 envelope 字段
- 固化共享文件与成员属性接口边界：保留回调副语义，但 Promise 仍是主语义；事件与 REST 分别覆盖共享文件/成员属性变更

## Phase 1: Design & Contracts

输出：

- `specs/027-group-manager-api/data-model.md`
- `specs/027-group-manager-api/contracts/group-manager.openapi.yaml`
- `specs/027-group-manager-api/quickstart.md`

设计要点：

1. 新增 `src/types/group.ts`
   - 定义 `GroupSummary`、`GroupListResult`、`GroupDetail`、`Group`、`GroupMemberEntry`、`GroupMuteEntry`、`GroupAllowlistEntry`、`GroupBlocklistEntry`、`GroupSharedFile`
   - 定义 `CreateGroupParams`、`UpdateGroupInfoParams`、`GroupUserBatchParams`、`MuteGroupMembersParams` 等公开输入类型
   - 定义 Web SDK 收敛后的群事件 payload 类型，并明确其中用户字段对象化
2. 新增 `src/rest/group-management.ts`
   - 封装旧 `groupApi.ts` 中群组域 REST endpoint
   - 负责 path/body/query 组装、operation name 归一化与原始 envelope 剥离
   - 已确认样例直接固化归一化规则；对尚未确认的响应结构仅保留内部 envelope placeholder 与 fixture 钩子，不对公开返回做拍脑袋字段映射
3. 新增 `src/managers/group-manager.ts`
   - 作为公开入口门面，承载列表、创建、`getGroup(groupId)`、参数校验、Promise 主语义、用户资料补齐编排与统一错误抛出
   - 保留全局/批量能力，把单群上下文能力委托给 `Group`
   - 对 `onGroupInfoChanged` / `onGroupDisabledChanged` 事件提供受控群详情补拉编排
4. 新增 `src/managers/group/group.ts`
   - 作为轻量单群 façade，承载成员、管理员、黑名单、allowlist、禁言、公告、共享文件、成员属性与单群 mutation
   - 复用 `GroupManager` 的校验、REST 和对象化补齐 helper，不自行维护本地状态真相
5. 新增 `src/managers/group/` 私有 helper
   - `group-normalizers.ts`: 负责把 REST 响应和事件原始字段归一化为群对象/成员对象/共享文件对象
   - `group-event-mapper.ts`: 负责旧 MUC operation 到 Web SDK 群事件的映射
   - `group-event-user-info-resolver.ts`: 负责群事件用户字段对象化与失败回退
6. 扩展 `src/protocol/msync/codec.ts` 与 `src/core/message/message-receiver.ts`
   - 在现有 roster/event 解码链路中新增 `MUCBody` 解码分支
   - 把群组 operation 映射成新的 GroupManager 事件，再通过 `EventHub` 派发
7. 扩展 `src/types/event-system.ts` 与 `src/index.ts`
   - 新增 `GroupEventHandlerMap`、Group 事件名和 payload map
   - 导出 `GroupManager`、`Group`、群对象类型和群事件类型
8. 共享文件与成员属性能力的设计边界
   - 共享文件上传/下载继续复用现有上传下载适配层，公开 API Promise 化，进度回调作为补充
   - 成员属性读取样例已确认 `data[userId] -> attribute map`，且单用户读取与批量读取返回结构同构；群名片更新字段解析仍依赖后续事件样例在实现阶段细化
9. 测试切面
   - 单元：命名迁移、`getGroup(groupId)`、批量 `userIds` 归一化、对象化用户补齐、MUC event mapping、群对象事件详情补拉条件
   - 集成：`client.groupManager` 公开入口、`Group` 单群 façade、REST 请求组装、EventHub 派发、对象化事件载荷、资料补齐失败不吞结果
   - 契约：SDK 逻辑契约与已确认/待确认的 upstream endpoint 说明
   - 类型：公开导出、`Group` / `GroupManager` 分层、事件 handler map 与 manager 注册后的访问方式

## Agent Context Update

执行命令：

```bash
SPECIFY_FEATURE=027-group-manager-api .specify/scripts/bash/update-agent-context.sh codex
```

预期：把 027 的当前活跃技术、GroupManager API 迁移范围、事件模型与待补真实响应样例清单补充到仓库 agent 上下文，供 `/speckit.tasks` 与实现阶段使用。

## Phase 2: Task Planning Approach

由 `/speckit.tasks` 继续拆解任务，按以下主线生成：

1. 新增群组类型、导出、`GroupManager` 公开门面与 `Group` 轻量对象
2. 实现群组 REST 适配层与基础归一化
3. 实现对象化用户补齐与会话级 helper
4. 把单群上下文能力从 GroupManager 收敛到 `Group`
5. 扩展 MSync `MUCBody` 解码、群事件映射与 EventHub 派发
6. 实现 `onGroupInfoChanged` / `onGroupDisabledChanged` 的群详情受控补拉
7. 补齐共享文件、成员属性、allowlist/blacklist/mute list 等高阶能力
8. 补齐单元/集成/契约/类型测试、文档、版本与 CHANGELOG

## Complexity Tracking

无额外豁免项。
