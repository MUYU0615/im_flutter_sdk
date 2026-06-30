# 实施方案：联系人自动同步（阶段一）

**Branch**: `024-contact-sync` | **Date**: 2026-03-18 | **Spec**: `specs/024-contact-sync/spec.md`  
**Input**: Feature specification from `/specs/024-contact-sync/spec.md`

## Summary

本特性为 SDK 增加“登录后可选开启的联系人自动同步”能力：初始化继续使用 `enableAutoSyncContacts` 开关，默认关闭；开启后登录流程先查询联系人版本元数据，再根据“版本元数据结果 + 本地缓存完整性”决定跳过同步、增量同步或强制全量同步。无论 metadata 结果为 `skip`、明确失败、保守失败还是实际进入 websocket 同步阶段，本轮联系人同步流程都必须对外形成统一的 `onContactSyncStart -> onContactSyncFinish` 事件闭环；其中 `onContactSyncStart` 不携带 payload，`onContactSyncFinish` 仅在失败时携带 `error`。联系人同步使用独立的 protobuf 自定义 websocket 协议，地址优先从 DNS 的 `sync-ws` 字段获取；当返回多个地址时先随机打散，再在失败时切换到下一个候选地址，并在单轮 URL 切换之外额外支持一次整轮同步级别的重试。若 DNS 缺少 `sync-ws` 或自动同步补拉 DNS 失败，则本轮自动同步也要以 `start -> finish(error)` 的方式结束，但不影响登录主链路。同步链路通过分页 cursor 接收全量或增量联系人结果，其中“新增联系人/资料更新”允许走增量，“删除联系人”必须切回全量；若同步 websocket 中途断开，则同一轮同步需基于已确认的 `cursor` 续传剩余分页，而不是重新触发主链路预检或从 `cursor: 0` 整轮重来。本轮同步结束后关闭联系人专用链路。对外联系人结构改为 `Contact { userId, userInfo, remark, addTs }`；持久化层继续不重复保存完整 `userInfo` 副本，而是采用“联系人关系缓存 + 用户资料缓存”运行时合并，并通过 `cacheIntegrity` 显式标记缓存是否可直接用于冷启动展示；`RosterItem.metadata` 直接提供 `nickname/avatarUrl/sign`，同步时顺手回填 `userInfo` 缓存。实现上需把当前联系人专用 websocket 客户端重构为可复用的 sync transport，避免后续扩展其他同步类型时再次推翻连接层。

## Technical Context

**Language/Version**: TypeScript 5.x（strict）  
**Primary Dependencies**: zod、protobufjs、long、vitest、vite、eslint  
**Storage**: localStorage（沿用现有 `CacheManager`；联系人关系缓存新增独立 key，用户资料缓存复用现有 `userInfoMap`，以 `cacheIntegrity` 标记冷启动可用性）  
**Testing**: Vitest（单元 + 集成 + 逻辑契约），必要时纳入 `test:gate:pr`  
**Target Platform**: Web、微信小程序、uni-app（小程序/App/H5）、Electron Renderer、React Native  
**Project Type**: 单仓库 SDK 库项目（`src/` + `tests/`）  
**Performance Goals**: 联系人自动同步关闭时登录链路零额外开销；开启时版本元数据查询快速决策；联系人分页同步不阻塞主消息链路；多页合并不出现明显 UI 卡顿；多地址 `sync-ws` 失败切换与同轮续传不出现长时间悬挂  
**Constraints**: 默认关闭；保留 `enableAutoSyncContacts` 字段名；本轮同步完成即关闭联系人 websocket；每轮联系人同步流程都必须派发 `onContactSyncStart -> onContactSyncFinish`，其中 `start` 不携带 payload，`finish` 成功不携带 payload、失败仅携带 `error`；不得为完整 `userInfo` 增加第二份持久化副本；protobuf 协议必须走静态产物；联系人缓存需支持 `cacheIntegrity`；错误处理与事件系统遵循 005/004 规格；失败阶段需能在 `finish.error` 中区分；删除联系人必须走全量同步；主消息 websocket 重连成功后不重新触发联系人预检  
**Scale/Scope**: 仅覆盖联系人自动同步、缓存与事件，不包含联系人操作 API；同步链路包含一个 REST 元数据查询和一个独立 protobuf websocket 分页会话

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

预检结果：

- [x] **性能优先**: 登录后先做轻量元数据判断；联系人分页同步异步处理；本轮完成后立即关闭专用链路，避免长期资源占用
- [x] **类型安全**: 初始化参数、联系人实体、同步事件、分页帧、缓存元数据与错误结构全部使用 strict 类型定义
- [x] **测试驱动**: 计划覆盖开关行为、版本判断、缓存完整性、全量/增量分页、链路关闭、事件与失败恢复
- [x] **可靠性**: 明确元数据优先级、缓存不完整强制全量、metadata 明确错误快速失败、分页 cursor 续拉、`sync-ws` 候选地址切换、单轮额外重试、探活超时与用户切换清理
- [x] **可扩展性**: 联系人同步链路独立于主消息 `msync`；静态 protobuf 生成方式与现有协议一致，便于后续扩展联系人相关消息类型
- [x] **可观测性**: 在版本判断、同步开始、分页推进、链路关闭、失败回退等节点输出结构化日志
- [x] **版本管理**: 文档、脚本、协议产物、版本号与 CHANGELOG 后续按统一发布规则迭代

Phase 1 设计复检结果：通过（见 `research.md`、`data-model.md` 与 `contracts/contact-sync.openapi.yaml`，未引入额外宪章冲突）。

## Project Structure

### Documentation (this feature)

```text
specs/024-contact-sync/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── contact-sync.openapi.yaml
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── chat-client.ts
├── cache/
│   ├── cache-keys.ts
│   ├── cache-types.ts
│   ├── cache-manager.ts
│   └── contact-cache.ts
├── config/
├── core/
│   └── contact-sync/
│       ├── roster-sync-client.ts
│       ├── roster-sync-session.ts
│       ├── roster-sync-controller.ts
│       └── roster-sync-types.ts
├── protocol/
│   └── roster/
│       ├── proto-source.json
│       ├── proto.ts
│       ├── root.ts
│       ├── codec.ts
│       └── types.ts
├── managers/
│   └── contact-manager.ts
├── rest/
│   ├── contact-metadata.ts
│   └── dns-config.ts
├── types/
│   ├── contact.ts
│   ├── event-system.ts
│   └── chat-client.ts
└── utils/

scripts/
└── generate-roster-proto.js

tests/
├── unit/contact-sync/
├── unit/protocol/
├── integration/contact-sync/
└── contract/
```

**Structure Decision**: 采用单项目结构，联系人自动同步单独收敛到 `src/core/contact-sync/` 与 `src/protocol/roster/`，避免污染现有 `msync` 主消息链路；REST 元数据查询与 DNS 解析沿用 `src/rest/` 体系；持久化通过 `src/cache/` 扩展联系人域缓存。

## Phase 0: Research

输出：`specs/024-contact-sync/research.md`

- 固化“元数据优先 + 缓存完整性兜底 + metadata 显式错误快速失败 + 其他失败稳定性优先处理”的同步判定顺序
- 固化联系人持久化结构：关系字段保留在联系人域，完整 `userInfo` 不双存
- 固化对外 `Contact` 新结构：`userId + userInfo + remark + addTs`
- 固化联系人专用 protobuf 静态产物生成策略，沿用现有 static proto adapter 机制
- 固化 `sync-ws` DNS 解析、缺失时 `start -> finish(error)` 降级、随机打散与失败切换策略
- 固化分页 cursor、全量/增量合并、断线续传、单轮额外重试与链路关闭语义，特别是“新增走增量、删除走全量”
- 固化 `onContactSyncStart/onContactSyncFinish` 事件载荷边界与失败阶段 `finish.error` 语义，明确所有分支都走 `start -> finish`，且 `start` 不携带 payload、`finish` 成功不携带 payload

## Phase 1: Design & Contracts

输出：

- `specs/024-contact-sync/data-model.md`
- `specs/024-contact-sync/contracts/contact-sync.openapi.yaml`
- `specs/024-contact-sync/quickstart.md`

设计要点：

1. 定义联系人关系缓存、用户资料缓存、缓存完整性元数据与运行时合并后的联系人展示模型，并把对外 `Contact` 收敛为 `userInfo` 嵌套结构
2. 定义登录后的同步判定流程：读取缓存 -> 查 metadata version -> 判定跳过/增量/全量/metadata 明确错误快速失败 -> 建立联系人同步链路
3. 设计联系人同步协议栈：静态 protobuf root、codec、可复用 sync transport、分页 session、ping/pong、断线后的 `cursor` 续传、单轮额外重试、失败阶段 `finish.error` 语义与结束关闭规则
4. 明确 DNS 到 `sync-ws` 的地址解析、缺失时 `start -> finish(error)` 降级、随机打散与失败切换策略，并补充私有化直连场景下“主链路 REST/WS + 同步链路 REST/WS”统一地址结构
5. 明确分页合并算法：`response_type + version + cursor` 协同处理，全量覆盖、增量 upsert、删除切全量；同步成功结束时无论是否有变更都派发一次 `finish`
6. 明确 `RosterItem.metadata` 字段解析、`userInfo` 回填时机，以及 `addTs` 的来源与持久化方式
7. 明确脚本与构建影响：增加 roster proto 静态生成与校验脚本，并纳入现有 `proto:gen / proto:check / prebuild`

## Agent Context Update

执行命令：

```bash
SPECIFY_FEATURE=024-contact-sync .specify/scripts/bash/update-agent-context.sh codex
```

预期：把 024 的技术栈、协议静态产物与最近变更补充到仓库 agent 上下文，供 `/speckit.tasks` 与实现阶段使用。

## Phase 2: Task Planning Approach

由 `/speckit.tasks` 继续拆解任务，按以下主线生成：

1. 初始化参数与 ContactManager/事件类型扩展，包括统一的私有化 URL 结构
2. DNS `sync-ws` 解析、缺失时 `start -> finish(error)` 降级、多地址随机化、失败切换与单轮额外重试
3. 联系人元数据 REST 查询、明确错误快速失败与同步决策编排
4. 联系人 protobuf 静态产物、codec 与同步 websocket client
5. 分页 session、`cursor` 续传、全量/增量合并、删除切全量与链路关闭
6. 联系人缓存、`cacheIntegrity`、`RosterItem.metadata` 解析、`addTs` 与运行时联系人投影
7. 单元/集成/契约测试与 gate 校验

## Complexity Tracking

无额外豁免项。
