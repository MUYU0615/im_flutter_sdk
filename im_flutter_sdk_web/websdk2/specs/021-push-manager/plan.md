# 实施方案：PushManager 推送与免打扰管理

**Branch**: `021-push-manager` | **Date**: 2026-02-26 | **Spec**: `specs/021-push-manager/spec.md`  
**Input**: Feature specification from `/specs/021-push-manager/spec.md`

## Summary

本特性在 SDK 中新增 `PushManager`，统一承接旧工程 `uploadPushTokenToServer` 与 `silentModeApi.ts` 的全部能力，并对接口进行强类型重构：通过可判别联合类型表达三类免打扰策略（提醒类型、时长、时间区间），限制会话类型仅 `singleChat/groupChat`，批量查询上限固定 20 且超限返回 `INVALID_PARAM (110)`，时间区间按设备本地时区解释，同 `deviceId` 重复上传 token 采用幂等覆盖。错误处理全面对齐 `specs/005-error-handling/spec.md`，且本期仅保留新 API（不提供旧 API 兼容别名）。

## Technical Context

**Language/Version**: TypeScript 5.x（strict）  
**Primary Dependencies**: zod、vitest、vite、eslint、现有 `RestClient` 与错误映射模块  
**Storage**: N/A（仅 REST 读写，不引入本地持久化）  
**Testing**: Vitest（unit + contract + types 回归）  
**Target Platform**: Web、微信小程序、uni-app（小程序/App/H5）、Electron Renderer、React Native  
**Project Type**: 单仓库 SDK 库项目（`src/` + `tests/`）  
**Performance Goals**: 参数校验 fail-fast 且不触发无效网络请求；PushManager 接口在正常网络下保持与现有 manager 同级响应体验，不引入额外阻塞链路  
**Constraints**: 仅支持 `singleChat/groupChat`；旧 API 不兼容；时间区间固定设备本地时区；批量查询上限 20（超限必须 `INVALID_PARAM (110)`）；重复 token 上传幂等覆盖；错误统一 Promise reject  
**Scale/Scope**: 覆盖推送 token、全局/会话免打扰、批量查询、语言设置、分页查询；不扩展服务端协议，不增加全局错误总线

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

预检结果：

- [x] **性能优先**: PushManager 仅编排参数校验与异步 REST 调用，不引入阻塞式流程
- [x] **类型安全**: 公共 API 使用 `interface` 与可判别联合类型，不使用 `any`
- [x] **测试驱动**: 计划覆盖参数校验、错误映射、幂等上传、分页与批量边界场景
- [x] **可靠性**: 复用统一超时机制与 REST 传输/业务错误分类，保证失败语义一致
- [x] **可扩展性**: 按 manager 分层接入，不破坏现有 Channel/Presence/UserInfo 管理器结构
- [x] **可观测性**: 在 token 上传、免打扰设置/查询、错误分支输出结构化日志并遵循日志脱敏规范
- [x] **版本管理**: 后续实现阶段按 SemVer、CHANGELOG 与迁移说明要求推进（本期为破坏性 API 变更）

Phase 1 设计复检结果：通过（研究结论、数据模型与契约未引入额外宪章冲突）。

## Project Structure

### Documentation (this feature)

```text
specs/021-push-manager/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── push-manager.openapi.yaml
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── managers/
│   ├── push-manager.ts
│   └── push/
│       └── index.ts
├── types/
│   ├── push.ts
│   ├── event-system.ts
│   └── index.ts
├── chat-client.ts
├── index.ts
├── rest/
│   ├── api-errors.json
│   └── errors.ts
└── utils/
    └── error-codes.ts

tests/
├── unit/managers/
│   └── push-manager.test.ts
├── contract/
│   └── push-manager.contract.test.ts
└── types/
    └── push-manager-types.test.ts
```

**Structure Decision**: 采用单项目结构，延续现有 manager 架构（`manager -> rest client -> error mapping`），新增 `push` 领域类型与测试，不拆分子工程。

## Phase 0: Research

输出：`specs/021-push-manager/research.md`

- 固化“新 API 破坏性替代旧 API”边界与迁移影响
- 固化免打扰规则建模方式（可判别联合类型 + 单语义请求）
- 固化会话类型限制、批量上限与时间区间时区语义
- 固化 Push 错误码区间与 `INVALID_PARAM (110)` 细分规则
- 固化重复 token 上传的幂等覆盖语义

## Phase 1: Design & Contracts

输出：

- `specs/021-push-manager/data-model.md`
- `specs/021-push-manager/contracts/push-manager.openapi.yaml`
- `specs/021-push-manager/quickstart.md`

设计要点：

1. 定义 PushToken、SilentModeRule、会话快照、语言设置、分页结果等核心实体
2. 把旧“多语义混合 API”拆为语义清晰的新 API，避免弱类型 `paramType` 直传
3. 明确参数校验策略：字段缺失、会话类型非法、批量超限、时间区间非法均 fail-fast
4. 明确错误契约：参数错误、连接/鉴权错误、REST 传输错误、REST 业务错误统一结构
5. 明确兼容策略：旧 API 不保留别名，调用旧入口返回明确不可用语义

## Agent Context Update

执行命令：

```bash
.specify/scripts/bash/update-agent-context.sh codex
```

预期：更新 Codex 上下文中的当前活跃技术与最近特性记录，保证后续 `/speckit.tasks` 与实现阶段一致。

## Phase 2: Task Planning Approach

由 `/speckit.tasks` 继续拆解任务，按以下主线生成：

1. `PushManager` 骨架、`ChatClient` 挂载与对外导出
2. Push token 上传与幂等覆盖语义实现
3. 全局/会话免打扰设置与查询 API 实现（含规则拆分）
4. 批量查询、语言设置、分页 API 实现
5. 错误码映射与参数校验落地（含 `details.fields`）
6. 单元/契约/类型测试、版本号与 CHANGELOG 更新

## Complexity Tracking

无额外豁免项。
