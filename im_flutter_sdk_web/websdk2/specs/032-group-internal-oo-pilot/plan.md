# 实施方案：Group 内部对象化试点

**Branch**: `032-group-internal-oo-pilot` | **Date**: 2026-04-22 | **Spec**: [spec.md](/Users/zhangdong/code/websdk2/specs/032-group-internal-oo-pilot/spec.md)  
**Input**: Feature specification from `/specs/032-group-internal-oo-pilot/spec.md`

## Summary

本特性在不改变 027 既有公开 API 契约的前提下，把 group 域作为 SDK 内部完全面向对象架构的第一阶段试点。对外继续保持 `GroupManager` 入口、`getGroup(groupId)` 返回轻量 `Group` public handle、列表与事件 payload 返回 plain data 快照；对内则把当前散落在 `GroupManager` 中的状态真相、实例复用、详情补拉、事件 patch 合并和 DTO 导出逻辑收敛为“内部 group 运行时对象 + repository + snapshot mapper + event sync”结构。方案采用“`GroupManager` 公开 facade + `Group` public handle + `internal-group` 运行时真相 + `group-repository` 唯一访问入口 + `group-event-sync` 事件收敛 + `group-snapshot-mapper` 对外快照导出”的过渡实现，不直接引入全仓级 `src/domain/` 重排，而是先在 `src/managers/group/internal/` 下验证模式，待 group 试点稳定后再同步 chatroom/contact/user-info。

## Technical Context

**Language/Version**: TypeScript 5.x（strict）  
**Primary Dependencies**: 现有 `GroupManager` / `Group` 公开 API、`RestClient`、`CacheManager`、`UserInfoManager`、`EventHub`、MSync protobuf 编解码、Vitest、Vite、eslint  
**Storage**: 不新增持久化介质；group 域内部运行时真相保持会话级内存态；用户资料缓存继续复用现有 localStorage `CacheManager` / `UserInfoCache` 摘要缓存  
**Testing**: `npm run test:run`、`npm run test:gate:pr`、`npm run lint`、`npm run type-check`  
**Target Platform**: Web SDK 主库（浏览器、微信小程序、uni-app、Electron Renderer、React Native 共享逻辑层）  
**Project Type**: 单仓库 SDK 库项目（`src/` + `tests/`）  
**Performance Goals**: 不引入公开 API 额外网络往返；同一 `groupId` 在单个 client 会话内只维护一份内部运行时真相；详情补拉仍保持受控触发，不因为对象化试点把所有事件都退化为先拉详情再派发  
**Constraints**:
- 必须保持 027 公开 API 契约稳定，不改变列表返回、`Group` public handle、Promise 语义和事件监听方式
- 不得把内部运行时对象或可变引用泄漏到公开返回值
- 不得引入属性式隐式网络加载
- 不做全仓级 `src/domain/` 重排，group 试点优先采用局部目录过渡
- 事件链路必须先更新内部真相，再导出公开 payload
- 必须明确 client 解绑、登出重登、manager 重建时的运行时对象清理边界
**Scale/Scope**: 仅覆盖 group 域内部架构重构试点、相关测试与文档；不新增群能力，不改 027 公开 API，不同步实现 chatroom/contact/user-info

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

预检结果：

- [x] **性能优先**: 维持现有公开链路语义，不新增默认网络往返；详情补拉仍受控；内部对象化主要是状态收敛，不是链路扩张
- [x] **类型安全**: `GroupManager`、`Group`、内部运行时对象、snapshot mapper 与事件 patch 全部按 strict TypeScript 建模，不引入 `any`
- [x] **测试驱动**: 计划覆盖内部运行时真相、实例唯一性、快照隔离、事件先更新后派发、公开边界不回归
- [x] **可靠性**: 通过 repository 唯一入口和事件 patch 收敛减少 group 域状态分叉；仍复用统一错误模型与受控补拉策略
- [x] **可扩展性**: 先在 group 域落地内部对象模式，再为 chatroom/contact/user-info 提供可复用模板；避免全仓一次性重写
- [x] **可观测性**: 在 repository 命中/创建、事件 patch 合并、详情补拉、用户补齐失败和运行时对象失效路径上补结构化日志
- [x] **版本管理**: 本期目标是内部重构试点，预期不引入对外 breaking change；实现完成后仍需按仓库规则更新版本号、`CHANGELOG.md` 和中文 commit

Phase 1 设计复检预期：通过。当前 spec 已把“公开契约不变、内部对象化、group 先行试点”的关键边界澄清完成。

## Project Structure

### Documentation (this feature)

```text
specs/032-group-internal-oo-pilot/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── group-internal-oo-pilot.md
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
│       ├── group-normalizers.ts
│       └── internal/
│           ├── internal-group.ts
│           ├── group-repository.ts
│           ├── group-event-sync.ts
│           └── group-snapshot-mapper.ts
├── rest/
│   ├── client.ts
│   ├── errors.ts
│   ├── api-errors.json
│   └── group-management.ts
├── types/
│   ├── group.ts
│   ├── event-system.ts
│   └── index.ts
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

**Structure Decision**: 保持单仓库单项目结构，并采用最小扰动的试点路径：不立即新增全局 `src/domain/`，而是在 `src/managers/group/internal/` 下引入 group 域内部对象、repository、event sync 和 snapshot mapper。这样可以在不大面积移动既有文件的前提下验证架构模式，同时保留后续把成熟模式上提为共享目录的空间。`GroupManager` 与 `Group` 继续作为公开层；`src/rest/group-management.ts` 继续承担 upstream REST 适配；`src/protocol/msync` / `src/core/message` 继续承担协议和事件入口，新增的只是 group 域内部状态收敛层。

## Phase 0: Research

输出：

- `specs/032-group-internal-oo-pilot/research.md`

研究与确认项：

1. 固化内部对象与公开 `Group` handle 的关系
   - 明确 public handle 不是内部真相对象
   - 明确 handle 如何访问内部真相而不泄漏引用
2. 固化 repository 模式
   - 明确同一 `groupId` 的 identity map 语义
   - 明确创建、命中、失效、清理和跨会话隔离边界
3. 固化事件收敛策略
   - 明确原始事件进入后如何 patch 内部真相
   - 明确何时直接 patch、何时标记 stale、何时受控补拉详情
4. 固化快照导出边界
   - 明确 `GroupSummary` / `GroupDetail` / 事件 payload 的导出来源
   - 明确如何防止 DTO 被外部修改后反向污染内部真相
5. 固化用户资料补齐协作模式
   - 明确补齐逻辑继续沿用现有 resolver 还是部分下沉到 repository
   - 明确事件与主动查询共享同一补齐规则
6. 固化最小目录方案
   - 验证 `src/managers/group/internal/` 是否足够承载试点
   - 仅在该方案明显阻碍后续复用时，才考虑把内部结构上提为全局目录

## Phase 1: Design & Contracts

输出：

- `specs/032-group-internal-oo-pilot/data-model.md`
- `specs/032-group-internal-oo-pilot/contracts/group-internal-oo-pilot.md`
- `specs/032-group-internal-oo-pilot/quickstart.md`

设计要点：

### 1. 引入 group 域内部运行时真相

- 新增 `internal-group.ts`
- 绑定固定 `groupId`
- 维护已知详情快照、列表快照补丁、失效状态、最近事件 patch 结果和必要的用户补齐上下文
- 不直接暴露给公开 API

### 2. 引入 `GroupRepository`

- 作为内部 group 真相的唯一访问入口
- 管理 `groupId -> InternalGroup` identity map
- 负责：
  - 获取或创建内部对象
  - 合并列表读取结果
  - 合并详情读取结果
  - 执行受控失效
  - 在 client 生命周期变化时清理运行时对象

### 3. 引入 `GroupSnapshotMapper`

- 把内部真相导出为：
  - `GroupSummary`
  - `GroupDetail`
  - 事件中的完整群对象 payload
- 输出必须保持快照语义
- 禁止返回内部可变引用

### 4. 引入 `GroupEventSync`

- 承接 group 域事件 patch 合并逻辑
- 对来自 `EventHub` 的群事件执行：
  - 定位内部对象
  - 直接 patch 或标记 stale
  - 必要时触发受控详情补拉
  - 导出标准化 payload
- 目标是把“事件先更新内部，再对外派发”的规则显式化

### 5. 收缩 `GroupManager`

- `GroupManager` 保留：
  - 公开入口
  - 参数校验
  - 错误归一化
  - facade 层编排
- `GroupManager` 下沉或委托：
  - `groupRegistry` 的实例复用职责
  - 群详情 hydrate 前后的真相合并
  - 事件到 payload 的中间状态收敛

### 6. 收敛 `Group` public handle

- `Group` 保留现有公开方法集
- 但不再只做“manager 纯转发”
- `Group` 通过 repository 访问对应 `groupId` 的内部真相
- 仍不在 handle 上暴露同步状态字段或可变属性

### 7. 明确 client 生命周期处理

- 需要定义以下动作对 repository 的影响：
  - manager bind
  - client 重新初始化
  - 登出/切换用户
  - token/连接状态重建
- 目标是避免跨会话残留状态污染

### 8. 公开契约不变的约束测试

- 列表仍返回 plain data
- `getGroup(groupId)` 仍返回 `Group`
- 事件 payload 仍是标准化业务对象
- DTO 不携带内部引用

### 9. 契约文档范围

- 032 的 contract 不再描述 upstream REST，而是描述内部对象化试点对外必须保持的公开行为契约：
  - 列表/详情/handle/事件之间的语义关系
  - 快照隔离
  - 事件完整对象语义
  - 生命周期与状态不污染边界

## Agent Context Update

执行命令：

```bash
SPECIFY_FEATURE=032-group-internal-oo-pilot .specify/scripts/bash/update-agent-context.sh codex
```

说明：

- 当前 git 分支不是 `032-group-internal-oo-pilot`，因此这里显式使用 `SPECIFY_FEATURE`，避免脚本错误地把上下文更新到 `001-im-sdk-refactor`。

预期：把 032 的内部对象化试点目标、group 先行策略、公开契约不变边界和后续模块同步方向补充到 agent context，供 `/speckit.tasks` 与实现阶段使用。

## Phase 2: Task Planning Approach

由 `/speckit.tasks` 继续拆解任务，按以下主线生成：

1. 建立 `internal-group`、`group-repository`、`group-snapshot-mapper`、`group-event-sync` 基础骨架
2. 把现有 `groupRegistry` 和 group 运行时真相职责从 `GroupManager` 收敛到 repository
3. 把详情读取、列表读取和事件 patch 的状态合并逻辑接到内部真相
4. 调整 `Group` public handle，使其通过 repository 访问内部真相但不泄漏内部实现
5. 收敛 `onSpecificationChanged` / `onStateChanged` 等关键事件的“先更新内部再派发”流程
6. 补齐 DTO 快照隔离、用户资料补齐共享逻辑和 client 生命周期清理
7. 补齐单元、集成、类型测试与回归验证
8. 完成版本号、`CHANGELOG.md`、验证和中文 commit

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Repository pattern | group 域当前已经存在列表、详情、事件、public handle 四条状态入口，需要唯一运行时真相 | 继续把状态编排堆在 `GroupManager` 里无法解决长期分叉问题 |
| Internal runtime object | 需要承载事件 patch、失效标记和详情合并，而这些语义不适合直接放到公开 `Group` handle | 直接把 `Group` 升级为内部真相会把实现语义泄漏到公开 API |
