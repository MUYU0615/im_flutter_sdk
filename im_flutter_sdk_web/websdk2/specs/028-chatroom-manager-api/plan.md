# 实施方案：ChatRoomManager API 迁移、聊天室对象化与事件标准化

**Branch**: `028-chatroom-manager-api` | **Date**: 2026-04-10 | **Spec**: `specs/028-chatroom-manager-api/spec.md`  
**Input**: Feature specification from `/specs/028-chatroom-manager-api/spec.md`

## Summary

本特性将把旧工程 `chatRoomApi.ts` 的聊天室域能力迁移到新的 `ChatRoomManager`，并同步完成四类收敛：一是公开入口统一切换到 `client.chatRoomManager.xxx()`；二是引入 `chatRoomManager.getChatRoom(chatRoomId)` 返回轻量 `ChatRoom` 对象，把单聊天室上下文能力迁入 `ChatRoom`，同时保留列表与详情的 plain object 返回；三是所有公开命名、参数模型、返回结构按当前 SDK 规范统一收口，并基于 `docs/reference/chatroom-api.md` 与 027 已确认的群组同构接口确定 REST 归一化契约；四是把旧 `handleMucMsg.ts` 中聊天室相关 MUC operation 映射为 Web SDK 收敛后的多事件模型，payload 采用 Web 对象化语义。方案采用“`ChatRoomManager` 入口门面 + `ChatRoom` 单聊天室 façade + 聊天室 REST 适配层 + 用户资料补齐桥接 + MUC 事件解码映射 + 受控聊天室详情补拉”的结构：`ChatRoom` 不暴露同步属性、同步访问器或字段级 getter，详情统一通过 `getInfo()` / `refresh()` 返回；与群组同构的详情、成员、管理员、禁言、黑名单、allowlist、公告、共享文件列表/删除能力复用 027 的对象化模型；成员、黑名单、allowlist、禁言等集合写操作统一使用批量 `userIds`，管理员变更保持单用户语义；`getAttributes({ keys?: string[] })` 作为统一属性读取入口；聊天室属性接口把 `successKeys/errorKeys` 收敛为稳定业务结果；旧共享文件上传 API 不进入新的公开范围。

## Technical Context

**Language/Version**: TypeScript 5.x（strict）  
**Primary Dependencies**: zod、vitest、vite、eslint、现有 `RestClient`、`CacheManager`、`EventHub`、`UserInfoManager`、MSync protobuf 编解码、现有下载/文件删除适配能力  
**Storage**: 聊天室域不新增持久化介质；用户资料继续复用 localStorage `CacheManager` / `UserInfoCache` 摘要缓存；聊天室列表、成员、管理员、黑名单、allowlist、禁言列表与属性快照默认保持会话级内存态  
**Testing**: Vitest（unit + integration + contract + types/JSDoc 回归）  
**Target Platform**: Web、微信小程序、uni-app（小程序/App/H5）、Electron Renderer、React Native  
**Project Type**: 单仓库 SDK 库项目（`src/` + `tests/`）  
**Performance Goals**: 聊天室列表/详情/成员等接口参数校验 fail-fast；用户资料补齐优先命中缓存并按批量最小化补拉；聊天室事件派发不因资料补齐失败阻塞；`onChatRoomInfoChanged` 仅在原始事件字段不足时受控补拉详情  
**Constraints**: 必须遵循 009 manager 注册规范；列表与详情保持业务对象返回，不把列表项升级为 `ChatRoom` 富对象；单聊天室上下文能力通过 `getChatRoom(chatRoomId)` 返回的 `ChatRoom` 访问；`ChatRoom` 不暴露同步属性、同步访问器或字段级 getter；allowlist 是公开 API 和事件唯一命名；共享文件上传 API 不进入 028 公开范围；实现与测试必须基于 `docs/reference/chatroom-api.md` 的真实样例或 027 已确认的群组同构接口；旧 connection 风格聊天室 API、历史 typo、白名单旧命名与 callback-only 主语义都必须移除  
**Scale/Scope**: 覆盖旧 `chatRoomApi.ts` 的聊天室域 API、`handleMucMsg.ts` 的聊天室事件映射、对象化用户返回、公开类型/导出/JSDoc/文档与测试补齐；不包含群组、thread、消息主链路重构、新 demo 页面、共享文件上传能力与新的真实环境 E2E 主链路

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

预检结果：

- [x] **性能优先**: 聊天室资料补齐采用 cache-first + batch-fetch-fallback；聊天室对象类事件仅在必要时补拉详情，避免所有事件都走网络补偿
- [x] **类型安全**: ChatRoomManager 公开 API、聊天室事件类型、聊天室对象/成员对象/属性结果全部以 strict TypeScript 建模，不保留旧 `AsyncResult` / 蛇形字段主语义
- [x] **测试驱动**: 计划覆盖 API 命名迁移、`ChatRoom` 方法模型、用户对象化补齐、聊天室列表差异字段归一化、MUC operation 映射、属性结果归一化、旧别名移除与公开导出回归
- [x] **可靠性**: 复用统一 REST 超时与错误归一化；资料补齐失败不吞主业务结果；聊天室对象事件补拉采用受控条件触发，避免事件丢失
- [x] **可扩展性**: ChatRoomManager 作为唯一公开门面，REST 适配、事件映射、用户资料补齐与聊天室对象补拉分层明确，后续可继续扩展聊天室属性、共享文件与更高层 demo
- [x] **可观测性**: 在聊天室 REST 请求、MUC 解码失败、事件映射丢弃、资料补齐失败、详情补拉触发与降级路径上输出结构化日志
- [x] **版本管理**: 028 含公开 API 迁移与旧名移除，实施阶段必须补版本号、CHANGELOG 与迁移说明

Phase 1 设计复检结果：通过（见 `research.md`、`data-model.md`、`contracts/chatroom-manager.openapi.yaml` 与 `quickstart.md`）。

## Project Structure

### Documentation (this feature)

```text
specs/028-chatroom-manager-api/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── chatroom-manager.openapi.yaml
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── managers/
│   ├── chatroom-manager.ts
│   └── chatroom/
│       ├── index.ts
│       ├── chatroom.ts
│       ├── chatroom-normalizers.ts
│       ├── chatroom-event-mapper.ts
│       └── chatroom-event-user-info-resolver.ts
├── rest/
│   ├── client.ts
│   ├── errors.ts
│   ├── api-errors.json
│   └── chatroom-management.ts
├── types/
│   ├── chatroom.ts
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
│   ├── chatroom/
│   ├── rest/
│   ├── protocol/
│   └── core/message/
├── integration/
│   ├── chatroom-manager/
│   └── mock/
├── contract/
│   └── chatroom-manager.contract.test.ts
└── types/
    └── chatroom-manager-types.test.ts
```

**Structure Decision**: 采用与 027 群组域一致的单项目结构。`ChatRoomManager` 负责公开入口、列表、创建、`getChatRoom(chatRoomId)`、参数校验、错误抛出、用户资料补齐编排与部分事件侧详情补偿；`src/managers/chatroom/chatroom.ts` 负责轻量 `ChatRoom` 单聊天室 façade；`src/rest/chatroom-management.ts` 负责旧 `chatRoomApi.ts` 中聊天室 REST endpoint 的 path/body/operation 与 envelope 归一化；`src/protocol/msync/codec.ts` 扩展 `MUCBody` 解码与聊天室 operation->event 映射；`src/types/chatroom.ts` 与 `src/types/event-system.ts` 定义聊天室业务对象、分页对象、`ChatRoom` 接口和 Web SDK 收敛后的多事件类型；必要的用户资料补齐逻辑下沉到 `src/managers/chatroom/` 私有 helper，避免 `ChatRoomManager` 本体膨胀。

## Phase 0: Research

输出：`specs/028-chatroom-manager-api/research.md`

- 固化 `ChatRoomManager + ChatRoom` 的混合模型：`ChatRoomManager` 是聊天室域唯一入口，`ChatRoom` 是单聊天室上下文 façade，旧 connection 风格公开 API 不再提供兼容层
- 固化聊天室对象边界：详情读取统一通过 `getInfo()` / `refresh()` 返回，禁止同步属性、同步访问器与字段级 getter
- 固化与 027 群组域的同构复用策略：聊天室详情、成员、管理员、禁言、黑名单、allowlist、公告、共享文件列表/删除结果统一复用群组同构结构
- 固化 `getChatRoomList()` 的归一化：优先基于真实样例或 027 已确认的群组同构接口处理列表字段映射
- 固化对象化用户补齐策略：所有用户相关读取结果与事件载荷均复用 `UserInfo`，走 cache-first + batch-fetch-fallback
- 固化事件收敛策略：事件名按 Web SDK 命名规范收敛，事件载荷保持 Web 标准化对象模型；共享文件事件不进入公开模型
- 固化聊天室属性结果模型：`successKeys/errorKeys` 转换为稳定业务对象，不直接暴露原始 metadata envelope
- 固化公开范围边界：聊天室共享文件上传 API 从 028 移除，仅保留列表读取与删除

## Phase 1: Design & Contracts

输出：

- `specs/028-chatroom-manager-api/data-model.md`
- `specs/028-chatroom-manager-api/contracts/chatroom-manager.openapi.yaml`
- `specs/028-chatroom-manager-api/quickstart.md`

设计要点：

1. 新增 `src/types/chatroom.ts`
   - 定义 `ChatRoomSummary`、`ChatRoomListResult`、`ChatRoomDetail`、`ChatRoom`、`ChatRoomMemberEntry`、`ChatRoomMuteEntry`、`ChatRoomAllowlistEntry`、`ChatRoomBlocklistEntry`、`ChatRoomSharedFile`、`ChatRoomAttributeMutationResult`
   - 定义 `UpdateChatRoomInfoParams`、`ChatRoomUserBatchParams`、`ChatRoomAdminInput`、`GetChatRoomAttributesInput`、`MuteChatRoomMembersParams` 等公开输入类型
   - 定义 Web SDK 收敛后的聊天室事件 payload 类型，并明确其中用户字段对象化
2. 新增 `src/rest/chatroom-management.ts`
   - 封装旧 `chatRoomApi.ts` 中聊天室域 REST endpoint
   - 负责 path/body/query 组装、operation name 归一化与原始 envelope 剥离
   - 已确认样例直接固化归一化规则；与群组同构的接口显式复用 027 业务结构；共享文件上传 endpoint 不纳入公开 contract
3. 新增 `src/managers/chatroom-manager.ts`
   - 作为公开入口门面，承载列表、`getChatRoom(chatRoomId)`、加入聊天室、参数校验、Promise 主语义、用户资料补齐编排与统一错误抛出
   - 保留全局/批量能力，把单聊天室上下文能力委托给 `ChatRoom`
   - 对 `onChatRoomInfoChanged` 事件提供受控聊天室详情补拉编排
4. 新增 `src/managers/chatroom/chatroom.ts`
   - 作为轻量单聊天室 façade，承载详情、成员、管理员、黑名单、allowlist、禁言、公告、共享文件列表/删除、属性与单聊天室 mutation
   - 复用 `ChatRoomManager` 的校验、REST 和对象化补齐 helper，不自行维护本地状态真相
5. 新增 `src/managers/chatroom/` 私有 helper
   - `chatroom-normalizers.ts`: 把 REST 响应和事件原始字段归一化为聊天室对象、成员对象、共享文件对象与属性结果
   - `chatroom-event-mapper.ts`: 负责旧 MUC operation 到 Web SDK 聊天室事件的映射
   - `chatroom-event-user-info-resolver.ts`: 负责聊天室事件用户字段对象化与失败回退
6. 扩展 `src/protocol/msync/codec.ts` 与 `src/core/message/message-receiver.ts`
   - 在现有 roster/event 解码链路中新增聊天室 `MUCBody` 解码分支
   - 把聊天室 operation 映射成新的 ChatRoomManager 事件，再通过 `EventHub` 派发
7. 扩展 `src/types/event-system.ts` 与 `src/index.ts`
   - 新增 `ChatRoomEventHandlerMap`、聊天室事件名和 payload map
   - 导出 `ChatRoomManager`、`ChatRoom`、聊天室对象类型和聊天室事件类型
8. 公告、共享文件与属性能力的设计边界
   - 公告读写与共享文件列表/删除挂到 `ChatRoom`
   - `uploadSharedFile` 明确不迁移，不出现在公开 contract、类型、文档和任务范围中
   - 属性读写沿 metadata/chatroom endpoint，默认返回稳定业务结果而非裸 `successKeys/errorKeys`
9. 测试切面
   - 单元：命名迁移、`getChatRoom(chatRoomId)`、列表差异字段归一化、对象化用户补齐、聊天室属性结果收敛、MUC event mapping
   - 集成：`client.chatRoomManager` 公开入口、`ChatRoom` 单聊天室 façade、REST 请求组装、EventHub 派发、对象化事件载荷、资料补齐失败不吞结果
   - 契约：SDK 逻辑契约与 `docs/reference/chatroom-api.md` / 群组同构接口说明
   - 类型：公开导出、`ChatRoom` / `ChatRoomManager` 分层、事件 handler map 与 manager 注册后的访问方式
10. 错误处理设计（FR-048 ~ FR-058）
    - **聊天室专属错误码**：在 `api-errors.json` 的 `common.chatroom` 段定义 7 个聊天室专属错误码（700-707），在 `error-codes.ts` 导出 `CHATROOM_INVALID_ID` / `CHATROOM_NOT_JOINED` / `CHATROOM_PERMISSION_DENIED` / `CHATROOM_MEMBERS_FULL` / `CHATROOM_NOT_EXIST` / `CHATROOM_OWNER_NOT_ALLOW_LEAVE` / `CHATROOM_USER_IN_BLOCKLIST`，与群组域 `GROUP_` 前缀常量保持对称。
    - **参数校验统一模式**：所有客户端参数校验（chatRoomId 为空、userIds 为空等）统一使用 `ValidationError` + `ERROR_CODES.VALIDATION_REQUIRED`(110)，复用 REST 层已有的 `normalizeChatRoomId` / `normalizeChatRoomUserIds` helper，不为参数校验引入新错误码。
    - **属性 API error_code 细分映射**：聊天室属性 API 的 HTTP 400 响应需按 `error_code` 整数字段做细分：`60010` → `CHATROOM_PERMISSION_DENIED`(703)、`60011` → `CHATROOM_NOT_JOINED`(702)、`60012` → `SERVICE_LIMIT_EXCEEDED`(4)。在 `api-errors.json` 的 4 个属性 API 定义中补充 `matchField: "error_code"` + `matchValue` 条目，REST 错误映射层需支持按 `error_code` 字段匹配。
    - **PARTIAL_SUCCESS 判定**：属性批量写入/删除响应中 `successKeys > 0 && errorKeys 非空` 时，返回 `ChatRoomAttributeMutationResult`（含 `successKeys: string[]` 和 `errorKeys: Record<string, { code: ErrorCode; message: string }>`），错误码设为 `PARTIAL_SUCCESS`(7)；所有 key 都失败时抛出 `SDKError`，取第一个 errorKey 的映射码。`errorKeys` 中每个 value 的错误描述按字符串匹配规则映射（见 FR-052）。
    - **joinChatRoom 补充场景**：在 `api-errors.json` 的 `joinChatRoom` 中补充 `members_full`(704, matchPattern: "member list is full") 和 `user_in_blocklist`(707, matchPattern: "is in the blacklist")。
    - **leaveChatRoom owner 校验**：在客户端校验阶段检查当前用户是否为聊天室 owner 且配置不允许 owner 退出，命中时抛出 `SDKError` + `CHATROOM_OWNER_NOT_ALLOW_LEAVE`(706)，不发起网络请求。
    - **事件 payload 解析规则**：`ADD_MUTE` 事件优先从 ext JSON 的 `user_mute_time` 提取按用户区分的禁言到期时间戳，解析失败回退到 `body.tos()` + 默认过期时间 `4638873600000`；`KICK` 事件通过 `reason` 字段区分 `BE_KICKED_FOR_OFFLINE` 和 `BE_KICKED`；`PRESENCE`/`ABSENCE` 事件优先从 `getMUCMembers()` 获取成员列表，为空时回退到 `from().userName()`。
    - **参考文档**：`docs/reference/chatroom-manager-error-codes.md` 提供了移动端 C++ SDK 的完整错误码对照与判断逻辑。

## Agent Context Update

执行命令：

```bash
SPECIFY_FEATURE=028-chatroom-manager-api .specify/scripts/bash/update-agent-context.sh codex
```

预期：把 028 的当前活跃技术、ChatRoomManager API 迁移范围、聊天室对象模型、事件模型与 REST 样例来源补充到仓库 agent 上下文，供 `/speckit.tasks` 与实现阶段使用。

## Phase 2: Task Planning Approach

由 `/speckit.tasks` 继续拆解任务，按以下主线生成：

1. 新增聊天室类型、导出、`ChatRoomManager` 公开门面与 `ChatRoom` 轻量对象
2. 实现聊天室 REST 适配层与基础归一化
3. 实现对象化用户补齐与会话级 helper
4. 把单聊天室上下文能力从 ChatRoomManager 收敛到 `ChatRoom`
5. 扩展 MSync `MUCBody` 解码、聊天室事件映射与 EventHub 派发
6. 实现 `onChatRoomInfoChanged` 的聊天室详情受控补拉与属性事件模型
7. 补齐公告、共享文件列表/删除、allowlist/blacklist/mute list、聊天室属性等高阶能力
8. 补齐单元/集成/契约/类型测试、双语注释与文档、版本与 CHANGELOG

## Complexity Tracking

无额外豁免项。
