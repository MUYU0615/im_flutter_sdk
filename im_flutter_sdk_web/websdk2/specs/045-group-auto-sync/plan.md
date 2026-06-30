# 实施方案：登录后自动同步群组数据

**Branch**: `045-group-auto-sync` | **Date**: 2026-06-01 | **Spec**: `specs/045-group-auto-sync/spec.md`
**Input**: Feature specification from `/specs/045-group-auto-sync/spec.md`

## Summary

本特性把登录后自动同步从“联系人专用能力”升级为 `ChatClient` 级统一数据同步体系：初始化只保留 `enableSyncData` 数组开关，支持 `contact` 与 `group`；旧 `enableAutoSyncContacts` 直接移除。联系人同步不再通过 `ContactManager` 的 `onContactSyncStart/onContactSyncFinish` 观察，而是统一迁移到 `ChatClient` 级 `onSyncDataStart/onSyncDataFinished`，通过 `dataType: 'contact' | 'group'` 区分来源。

群组同步复用 024/035 已形成的第二通道 websocket 和 `SyncTransportClient` 心智，新增 group-sync 业务层与静态 protobuf 协议：登录后若 `enableSyncData` 包含 `group`，SDK 使用 `GetJoinedGroupsRequest(type=12)` 携带当前用户和 request metadata 拉取当前用户已加入群组的轻量详情。本期每次登录都按全量同步语义请求，固定发送 `last_sync_time=0` 或等价全量起点；即使服务端协议支持 `last_sync_time > 0` 增量，045 登录自动同步也不依赖本地持久化 checkpoint 跳过全量。服务端返回的 `GroupItem.update_at` 用于与 MUC 更新裁决字段覆盖，响应为 `GetJoinedGroupsResponse(type=13)`，支持多批、`cursor` 断点续传和最终批 `last_sync_finished_ts`；单轮最多同步 3000 个群，超过部分服务端不下发。SDK 必须记录受限/不完整状态，不得把截断结果标记为完整快照。

本期群组同步结果不是完整群详情，不包含成员、管理员、黑名单、allowlist、公告、共享文件等完整配置。同步结果写入当前登录会话的 `GroupRepository`，最多承载服务端本轮下发的 3000 个轻量群组；localStorage 只持久化最多 100 个轻量预览用于冷启动/首屏，不保存完整 3000 群列表。同步结果会让 `GroupManager` 本地读取入口和 `getGroup(groupId)` 都能消费已知轻量字段；缺失项永不表示删除，删除、退群、踢出和销毁只以 MUC 事件为准。第二通道字段与 MUC 字段冲突时按更新时间裁决：若本地 MUC 更新更晚，保留本地事实；若第二通道 `update_at` 更晚，才允许覆盖轻量字段。`GroupManager` 新增纯缓存读取入口读取本地已加入群组快照，现有网络分页 `getJoinedGroupList` 保持不变。

## Technical Context

**Language/Version**: TypeScript 5.x（strict）
**Primary Dependencies**: 现有 `ChatClient`、`GroupManager`、`ContactManager`、`CacheManager`、`EventHub`、`SyncTransportClient`、`GroupRepository`、MSync MUC 事件链路、`protobufjs/light` 静态编解码适配层、zod、Vitest、Vite、Playwright
**Storage**: localStorage（沿用 `CacheManager`；仅新增 joined-groups 预览缓存，最多 100 个轻量群组和预览/受限元数据；当前登录会话内 `GroupRepository` 保存本轮同步到的最多 3000 个群；不新增持久化介质，不持久化完整 3000 群列表）
**Testing**: Vitest（unit/integration/types）、Playwright E2E、`npm run lint`、`npm run type-check`、`npm run test:gate:pr`；公开 API 文档受影响时补 `npm run docs:api:check` 与 `npm run errors:check`
**Target Platform**: Web SDK 主库 + 浏览器 demo/API E2E；保持现有微信小程序/uni-app/Electron Renderer/React Native 适配边界
**Project Type**: 单仓库 SDK 库项目（`src/`、`tests/`、`demo/`、`specs/`）
**Performance Goals**:
- `enableSyncData` 不包含 `group` 时登录链路零额外 group-sync websocket 开销
- `GroupManager` 本地群组读取入口纯缓存读取，不触发网络
- 群组同步异步执行，不阻塞主消息 websocket，不阻断登录成功
- 单轮最多处理 3000 个服务端下发群组，合并与排序不得造成明显主线程卡顿；localStorage 持久化裁剪为最多 100 个预览
- 同一用户同一数据类型复用在途任务，避免并发重复同步
**Constraints**:
- `enableAutoSyncContacts` 直接移除；联系人自动同步只通过 `enableSyncData: ['contact']` 开启
- `onContactSyncStart/onContactSyncFinish` 直接移除；联系人同步只通过 `ChatClient` 级统一同步事件观察
- `onSyncDataStart/onSyncDataFinished` 只在 `ChatClient` 级注册，不挂到 `ContactManager` 或 `GroupManager`
- 群组同步使用第二通道 websocket 和静态 protobuf 产物；运行时不得动态解析 `.proto` 文本作为主路径
- `JoinedGroupsResponse` 缺失某群永不表示删除
- MUC 是删除、退群、踢出、销毁的唯一事实来源
- 第二通道轻量详情不得清空本地已有完整群详情字段
- 服务端单轮最多同步 3000 个群，超过部分不下发；SDK 必须记录受限/不完整状态
- 每次登录都执行 group 全量同步；localStorage 预览不得作为跳过登录同步的依据
- 现有 `getJoinedGroupList` 保持网络分页读取语义，不改成缓存读取
**Scale/Scope**: 涉及 `ChatClient` 初始化配置和事件面、联系人同步配置/事件破坏性迁移、group-sync WSS 协议接入、群组轻量缓存、GroupManager 本地读取入口、MUC 与第二通道冲突收敛、unit/integration/E2E/API 文档与版本治理。

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

预检结果：

- [x] **性能优先**: 新能力按 `enableSyncData` 显式开启；关闭时无额外链路；开启后独立异步 websocket 同步并复用在途任务；本地读取纯缓存。
- [x] **类型安全**: `SyncDataType`、统一事件 payload、joined group 轻量对象、完成元信息、完整性状态、协议帧与错误阶段全部要求 strict 类型定义；不对外暴露协议原始畸形字段。
- [x] **测试驱动**: spec 已明确 unit/integration/E2E 三层覆盖；plan 继续补 data model、contract、quickstart 以支撑 tasks。
- [x] **可靠性**: 明确账号隔离、用户切换取消、socket 失败不阻断登录、完成元信息最终批次记录、MUC 删除状态防复活、3000 受限状态和缺失项不删除。
- [x] **可扩展性**: 复用 024/035 的第二通道 transport 心智，同时保持 group-sync 独立 controller/session/cache；统一事件模型可继续扩展更多 `SyncDataType`。
- [x] **可观测性**: 同步开始/结束、socket URL 解析、批次推进、受限状态、MUC 冲突裁决、MUC 删除状态命中和失败阶段都需结构化日志且不泄露 token。
- [x] **版本管理**: 本期包含破坏性公开 API 收敛，必须更新版本号、CHANGELOG、API 文档和迁移说明；当前 spec/plan 阶段先记录破坏性边界。

Phase 1 设计复检结果：通过。研究、数据模型、contract 与 quickstart 已将破坏性配置/事件迁移、ChatClient 级统一事件、3000 单轮上限和 MUC 删除优先级固化为可测试设计约束。

## Project Structure

### Documentation (this feature)

```text
specs/045-group-auto-sync/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/
│   └── requirements.md
├── contracts/
│   └── group-auto-sync.openapi.yaml
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── chat-client.ts
├── index.ts
├── validators/
│   └── chat-client.ts
├── types/
│   ├── chat-client.ts
│   ├── event-system.ts
│   ├── sync-data.ts              # new
│   └── group.ts
├── cache/
│   ├── cache-manager.ts
│   ├── cache-types.ts
│   ├── cache-keys.ts
│   └── joined-group-preview-cache.ts # new
├── core/
│   ├── contact-sync/
│   │   └── sync-transport-client.ts
│   └── group-sync/                # new
│       ├── group-sync-controller.ts
│       ├── group-sync-runner.ts
│       ├── group-sync-session.ts
│       ├── group-sync-normalizer.ts
│       ├── group-sync-merge.ts
│       └── group-sync-types.ts
├── managers/
│   ├── contact-manager.ts
│   └── group-manager.ts
├── managers/group/internal/
│   ├── group-repository.ts
│   └── group-event-sync.ts
└── protocol/
    └── joined-groups/             # new static protobuf adapter
        ├── codec.ts
        ├── types.ts
        ├── gateway.ts
        ├── proto.ts
        └── proto-source.json

scripts/
└── generate-joined-groups-proto.js # new or fold into existing generator

tests/
├── unit/
│   ├── sync-data/
│   ├── group-sync/
│   ├── cache/
│   ├── protocol/
│   └── managers/
├── integration/
│   ├── sync-data/
│   └── group-sync/
├── e2e/
│   └── api/
└── types/
```

**Structure Decision**: 保持单仓库 SDK 库结构。`ChatClient` 负责初始化配置、登录后同步调度与统一事件派发；`core/group-sync` 承担 group-sync 业务编排、批次状态、合并和失败阶段；`protocol/joined-groups` 承担静态 protobuf 编解码；`cache/joined-group-preview-cache` 只保存本地已加入群组轻量预览和状态元数据；当前会话完整同步结果进入 `GroupRepository`；`GroupManager` 新增本地读取入口并复用内部 `GroupRepository` 真相。

## Phase 0: Research

输出：`specs/045-group-auto-sync/research.md`

研究结论：

1. 配置面直接破坏性收敛：`enableAutoSyncContacts` 移除，`enableSyncData` 成为联系人/群组自动同步唯一入口。
2. 事件面直接破坏性收敛：`onContactSyncStart/onContactSyncFinish` 移除，统一事件在 `ChatClient` 级注册，payload 携带 `dataType` 和失败阶段。
3. 第二通道 transport 复用 024/035 的 `SyncTransportClient`；045 新增 group-sync 业务层，不复制 socket 生命周期实现。
4. 群组同步协议采用 joined-groups 静态 protobuf 产物，message type 固定为 request=12、response=13、error=5，并继续支持 ping/pong。
5. 群组轻量快照与完整群详情分层；同步结果不包含成员/管理员/公告等完整配置，也不得清空本地已有完整详情字段。
6. MUC 删除优先级最高：第二通道缺失项不删除，旧数据不能复活 MUC 删除状态。
7. `update_at` 与本地 MUC 更新时间共同决定字段覆盖，避免第二通道旧快照反向覆盖实时事件。
8. 服务端单轮最多同步 3000 个群，超过部分不下发；SDK 记录 limited/incomplete，不视为完整快照。
9. localStorage 只持久化最多 100 个轻量群组预览；每次登录仍全量同步，当前会话仓库保存本轮最多 3000 个结果。
10. `getGroup(groupId)` 使用已知轻量群组信息构建/绑定 `Group` facade，但完整详情仍由显式 detail API 获取。

## Phase 1: Design & Contracts

输出：

- `specs/045-group-auto-sync/data-model.md`
- `specs/045-group-auto-sync/contracts/group-auto-sync.openapi.yaml`
- `specs/045-group-auto-sync/quickstart.md`

设计要点：

### 1. ChatClient 统一同步配置与事件

- `ChatClient.init()` 配置新增/保留唯一字段：
  - `enableSyncData?: ReadonlyArray<'conversation' | 'contact' | 'group'>`
  - 未传默认 `['conversation']`；显式传 `[]` 时关闭所有登录后自动同步。
- 移除：
  - `enableAutoSyncContacts`
- `ChatClient.addEventHandler/removeEventHandler` 支持：
  - `onSyncDataStart?: (payload: SyncDataStartPayload) => void`
  - `onSyncDataFinished?: (payload: SyncDataFinishedPayload) => void`
- `SyncDataStartPayload` 仅携带 `dataType`；`SyncDataFinishedPayload` 仅携带 `dataType`、`status` 和失败时的 `error`。
- `SyncDataFinishedPayload.status` 仅为 `success | failed`；受限/不完整等诊断信息保留在内部快照与结构化日志中，不通过公开事件 payload 暴露。
- 旧 `ContactManager` 同步事件删除；`ContactManager` 继续保留 roster 联系人业务事件。

### 2. 登录后调度

- 登录成功后读取标准化 `enableSyncData`：
  - 包含 `conversation`：触发会话列表同步，并通过 `onSyncDataStart/Finished` 派发 `dataType: 'conversation'`。
  - 包含 `contact`：触发现有联系人同步 controller，但事件桥接到 `ChatClient` 级统一同步事件。
  - 包含 `group`：触发新 group-sync controller。
- 各数据类型状态隔离；一类失败不得阻断另一类同步，也不得阻断登录主链路。
- 同一用户同一 `dataType` 只允许一个进行中任务；重复触发复用或忽略。

### 3. Joined Groups 协议与 transport

- 新增 `protocol/joined-groups` 静态 adapter：
  - `GetJoinedGroupsRequest(type=12)`
  - `GetJoinedGroupsResponse(type=13)`
  - `ErrorDetail(type=5)`
  - `PingRequest(type=1)` / `PongResponse(type=2)`
- 请求字段：`header.request_id/protocol_version/resource`、`org`、`app`、`username`、`last_sync_time`、`cursor`。
- 本期同步策略：每次登录按全量语义发起，`last_sync_time` 固定发送 `0` 或等价全量起点；`last_sync_finished_ts` 只记录完成元信息，不作为下次登录增量起点。
- 断点续传策略：首次请求不带 `cursor`；非最后一批响应返回 `cursor` 时写入当前 session；同一轮断线恢复时携带相同 `last_sync_time=0` 与最新 cursor。
- 响应字段：`groups`、`is_last_batch`、`last_sync_finished_ts`、`cursor`。
- `GroupItem` 标准化为 SDK 轻量字段，映射 `group_id/group_name/group_owner/members_count/mute_all/disabled/description/group_avatar/role/mute_expiration/remind_type/create_at/update_at/joined_timestamp`，不把协议 snake_case 原始字段直接外露。
- `ErrorDetail(type=5)` 映射服务端错误码：`1601` 请求参数无效、`1602` 服务端获取群组失败、`1002` 鉴权失败、`1003` 请求限流。

### 4. 缓存与合并

- 新增 joined group preview cache：
  - 当前用户 key
  - `items` 最多 100 个轻量预览
  - `meta.integrity`: `preview | synced | limited | incomplete | unknown`
  - `meta.storageLimit = 100`
  - `meta.serverLimit = 3000`
  - `meta.source`: `localPreview | sync`
- 当前登录会话 `GroupRepository` 保存本轮同步到的最多 3000 个轻量群组，作为同步完成后的读取真相。
- `last_sync_finished_ts` 只在最后一批成功合并且 100 个预览 flush 成功后记录为完成元信息。
- 第二通道缺失项不删除本地群。
- 第二通道只更新 lightweight 字段；缺失字段不覆盖本地已有 detail。
- MUC 删除状态命中时丢弃第二通道旧数据。
- `limitState = limited` 时，读取接口必须暴露可诊断状态或至少在 meta 中保留，避免当完整快照使用。

### 5. GroupManager 本地读取

- 公开读取入口固定为 `getJoinedGroupList(): ReadonlyArray<JoinedGroupSummary>`，只返回业务可直接使用的轻量群组列表；`integrity/limited/lastSyncFinishedTs` 等诊断信息保留在内部 snapshot 与结构化日志中，不通过 `onSyncDataFinished` payload 暴露。
- `getJoinedGroupList()` 不接收分页参数，不发起 REST 请求；它只读取 localStorage 预览或当前会话运行时同步快照。
- `getJoinedGroupList()` 在同步完成前可返回 localStorage 预览列表；同步完成后返回当前会话仓库列表。
- 不新增 `getLocalJoinedGroupSnapshot()` 公开 API。
- `getGroup(groupId)` 从 `GroupRepository` 读取已知轻量字段：若来自 localStorage 预览或当前会话同步结果，`Group` facade 应绑定这些摘要信息；若未知，保持现有无网络 facade 语义。
- `getGroup(groupId)` 不隐式调用详情 API；`group.getDetail()` / `groupManager.getGroupInfo()` 仍是获取完整详情的显式路径。

### 6. MUC 冲突裁决

- MUC 删除/退群/踢出/销毁：
  - 删除本地 joined group
  - 写入当前会话删除状态
  - 阻止第二通道旧数据复活
- MUC 信息更新：
  - 写入 `mucUpdatedAt` 或等价 update clock
- 第二通道 `update_at` 更晚才可覆盖相同字段
- 第二通道 `update_at` 缺失时按保守策略处理：只填充本地缺失字段，不覆盖已有 MUC 字段。

### 7. 测试与门禁

- 单元测试：配置校验、统一事件、协议 codec、合并/MUC 删除状态/limitState、cache、本地读取。
- 集成测试：登录后调度、联系人统一事件迁移、group-sync transport、多批次与 3000 受限、MUC 冲突、账号切换。
- E2E：API 级浏览器用例验证 `ChatClient` 级统一事件和 `GroupManager` 本地读取，不强制新增完整 UI。

## Agent Context Update

需要执行：

```bash
SPECIFY_FEATURE=045-group-auto-sync .specify/scripts/bash/update-agent-context.sh codex
```

预期：把 045 的技术栈、统一同步配置/事件、joined-groups 第二通道协议与最近变更补充到 Codex 上下文。

## Phase 2: Task Planning Approach

由 `/speckit.tasks` 继续拆解任务，建议按以下主线生成：

1. 配置与事件破坏性收敛：移除 `enableAutoSyncContacts`、移除 ContactManager 同步事件、增加 `enableSyncData` 与 ChatClient 级统一事件。
2. 第二通道协议：新增 joined-groups proto、生成脚本、codec、类型、协议单测。
3. group-sync controller/session/runner：复用 `SyncTransportClient`，实现请求、批次、完成元信息、失败阶段、取消和在途复用。
4. joined group preview cache 与 merge：100 个本地预览、当前会话最多 3000 个 runtime snapshot、`update_at` 裁决、MUC 删除优先级、3000 limited/incomplete 状态。
5. GroupManager 本地读取：新增本地 snapshot API，保持 `getJoinedGroupList` 网络语义，并让 `getGroup(groupId)` 复用已知轻量信息。
6. 联系人同步迁移：现有 024 controller 事件桥接到 ChatClient 级统一事件，删除旧公开事件。
7. 分层测试、docs/api、CHANGELOG、版本号与最终 commit。

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| 破坏性移除旧联系人配置与事件 | 用户明确要求统一到 `enableSyncData` 和统一同步事件；长期双轨会制造冲突和重复通知 | 保留兼容期会让同一同步轮次同时存在旧/新事件面，增加业务误用与测试矩阵 |
