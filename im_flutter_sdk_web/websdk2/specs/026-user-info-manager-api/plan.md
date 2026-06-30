# 实施方案：UserInfoManager API 补齐与语义收敛

**Branch**: `026-user-info-manager-api` | **Date**: 2026-03-26 | **Spec**: `specs/026-user-info-manager-api/spec.md`  
**Input**: Feature specification from `/specs/026-user-info-manager-api/spec.md`

## Summary

本特性把当前 `UserInfoManager` 从“旧 Web API 薄兼容层 + 摘要级缓存回填”重构为“按移动端语义对齐的用户资料 manager”。查询侧改为 `fetchUserInfoByUserId` 与 `fetchUserInfoByAttribute` 两个公开入口；更新侧改为 `updateOwnInfo` 与 `updateOwnInfoByAttribute` 两个公开入口，并直接移除旧的 `fetchUserInfoById`、`updateUserInfo`、`updateOwnUserInfo`。方案采用“`UserInfoManager` 公开门面 + 用户资料 REST 适配层 + 业务对象/响应 envelope 双层模型 + 缓存写回兼容桥接”的结构：对外统一返回 `UserInfo`，对内基于已确认的 `{ timestamp, data, lastModified, duration }` 响应 envelope 做归一化；查询响应按 `Record<userId, attributes>` 解析，更新响应按“当前用户已设置过的全部属性”解析；公开字段全部使用驼峰命名，服务端蛇形字段和包装元信息不向默认调用方透出；同时修正文档、导出与示例，使 `UserInfoManager` 的注册/访问方式完全符合 009 manager 规范。

## Technical Context

**Language/Version**: TypeScript 5.x（strict）  
**Primary Dependencies**: zod、vitest、vite、eslint、现有 `RestClient`、`CacheManager`、`ChatClient` manager 注册体系、统一错误模型、结构化日志模块  
**Storage**: 用户资料缓存继续复用现有 localStorage `CacheManager` / `UserInfoCache`；不新增新的持久化介质  
**Testing**: Vitest（unit + integration + contract + types/JSDoc 回归）  
**Target Platform**: Web、微信小程序、uni-app（小程序/App/H5）、Electron Renderer、React Native  
**Project Type**: 单仓库 SDK 库项目（`src/` + `tests/`）  
**Performance Goals**: 查询/更新参数校验 fail-fast；用户资料归一化在单次 REST 响应解析内完成；缓存写回不新增额外网络往返；`use(UserInfoManager)` 注册后不引入额外运行时代理层  
**Constraints**: 必须遵循 009 manager 注册规范；旧查询名与旧更新名直接移除；查询/更新接口均以 Promise 为主；公开字段必须驼峰化；更新请求继续走 `application/x-www-form-urlencoded`；查询与更新都必须基于已确认真实响应样例编写；不得破坏 014 本地缓存的登录加载与写回语义  
**Scale/Scope**: 覆盖 4 个公开 API、类型系统重构、REST 响应归一化、缓存桥接、导出/JSDoc/文档修正、单元/集成/契约测试；不包含新的用户资料搜索、分页、当前用户只读快照 API、事件系统扩展或 demo 新页面

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

预检结果：

- [x] **性能优先**: 资料查询/更新均为单次 REST 请求 + 本地归一化，不引入阻塞式链路或额外同步 I/O
- [x] **类型安全**: 新公开 API、属性枚举、业务对象与 envelope 模型全部按 strict TypeScript 设计，不保留旧弱类型 `(key, value)` 风格
- [x] **测试驱动**: 计划覆盖查询/更新四个公开 API、真实响应样例归一化、文档迁移与旧名移除回归
- [x] **可靠性**: 复用统一 REST 超时/错误映射；查询/更新成功后立即回写缓存，避免同会话继续读到旧值
- [x] **可扩展性**: 以 `UserInfo` 和 envelope 模型分层，未来新增资料字段时不需要再次暴露服务端包装结构
- [x] **可观测性**: 查询/更新请求、归一化失败、字段映射异常、旧名移除迁移路径与缓存写回失败都可输出结构化日志
- [x] **版本管理**: 本期方案显式接受公开 API 的破坏性变更；实现阶段必须更新版本号、CHANGELOG 与迁移说明

Phase 1 设计复检结果：通过（见 `research.md`、`data-model.md`、`contracts/user-info-manager.openapi.yaml` 与 `quickstart.md`）。

## Project Structure

### Documentation (this feature)

```text
specs/026-user-info-manager-api/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── user-info-manager.openapi.yaml
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── managers/
│   ├── user-info-manager.ts
│   └── user-info/
│       └── index.ts
├── rest/
│   ├── client.ts
│   ├── errors.ts
│   └── user-info.ts
├── types/
│   ├── user-info.ts
│   ├── chat-client.ts
│   └── manager.ts
├── cache/
│   ├── cache-manager.ts
│   ├── cache-types.ts
│   └── user-info-cache.ts
├── chat-client.ts
└── index.ts

tests/
├── unit/
│   └── managers/
├── integration/
│   ├── mock/
│   └── user-info-manager/
└── contract/
    └── user-info-manager.contract.test.ts

docs/
└── reference/
    ├── api.md
    ├── RESTful-API-Body-Formats.md
    └── user-info-manager-api.md
```

**Structure Decision**: 采用单项目结构，延续当前 manager 模式。`UserInfoManager` 负责公开 API、参数校验、缓存协调与 Promise/error 语义；新增或拆分 `src/rest/user-info.ts` 承担 `/metadata/user/get` 与 `/metadata/user/{userId}` 的 REST 适配与 envelope 归一化；`src/types/user-info.ts` 从旧 Web 风格参数升级为移动端风格查询/更新模型；缓存继续复用现有 `CacheManager` / `UserInfoCache`，但需要增加“完整资料对象 -> 摘要缓存”的桥接规则；API 对照文档复用 `docs/reference/contact-manager-api.md` 的结构，新增 `docs/reference/user-info-manager-api.md`。

## Phase 0: Research

输出：`specs/026-user-info-manager-api/research.md`

- 固化跨端命名策略：查询和更新都对齐移动端双入口，旧 Web 名称全部移除
- 固化真实响应 envelope 解析策略：查询与更新共享 `{ timestamp, data, lastModified, duration }` 包装，但 `data` / `lastModified` 的语义不同
- 固化公开返回模型：统一返回 `UserInfo`，不透出 envelope 元信息
- 固化缓存桥接策略：完整资料对象归一化后写入当前 `UserInfoCache` 摘要模型，同时保留内部完整对象供当前调用返回
- 固化破坏性迁移策略：类型导出、JSDoc、对照文档、CHANGELOG 和示例全部切到新 API，并补迁移说明

## Phase 1: Design & Contracts

输出：

- `specs/026-user-info-manager-api/data-model.md`
- `specs/026-user-info-manager-api/contracts/user-info-manager.openapi.yaml`
- `specs/026-user-info-manager-api/quickstart.md`

设计要点：

1. 重构 `src/types/user-info.ts`
   - 删除旧 `FetchUserInfoParams` / `UpdateOwnUserInfoParams` 的公开主语义
   - 新增 `UserInfo`、`UserInfoAttribute`、`FetchUserInfoByUserIdParams`、`FetchUserInfoByAttributeParams`、`UpdateOwnInfoParams`、`UpdateOwnInfoByAttributeParams`
   - 明确公开字段使用驼峰命名；服务端字段映射仅存在于内部适配层
2. 重构 `src/managers/user-info-manager.ts`
   - 移除 `fetchUserInfoById`、`updateOwnUserInfo` 的公开主实现
   - 新增 `fetchUserInfoByUserId`、`fetchUserInfoByAttribute`、`updateOwnInfo`、`updateOwnInfoByAttribute`
   - 保留 `bind` 与 `RestClient` 复用逻辑，但补上属性名校验、旧名移除后的日志与错误语义
3. 拆分或新增 `src/rest/user-info.ts`
   - 统一构造 `/metadata/user/get` 与 `/metadata/user/{userId}` 请求
   - 查询请求体分别支持默认属性查询和显式属性查询
   - 更新请求继续输出 `application/x-www-form-urlencoded`
4. 新增 envelope 归一化层
   - 查询：`{ data: Record<userId, attributes>, lastModified: Record<userId, number> } -> ReadonlyArray<UserInfo>`
   - 更新：`{ data: attributes, lastModified: number } -> UserInfo`
   - 服务端 `avatarurl` / `avatarUrl`、`lastModified` 与缓存 `lastUpdate` 的转换都在这一层完成
5. 复用并桥接缓存
   - 对外返回完整 `UserInfo`
   - 对内把 `UserInfo` 投影成 `UserInfoSummary` 写入 `CacheManager`
   - 查询与更新成功后都复用同一写回 helper，避免字段回填分叉
6. 文档与导出收敛
   - 更新 `src/index.ts` 的类型导出与 manager 导出注释
   - 更新 `docs/reference/api.md` 的使用示例
   - 新增 `docs/reference/user-info-manager-api.md`，结构对齐 `contact-manager-api.md`
   - 更新 `docs/reference/RESTful-API-Body-Formats.md` 中 user-info 相关说明
7. 测试切面
   - 单元：参数校验、属性映射、真假值处理、去重、envelope 归一化、缓存投影
   - 集成：公开入口 `client.userInfoManager`、请求组装、真实样例 fixture 解析、查询/更新后缓存一致性
   - 契约：基于你提供的查询/更新成功响应样例校验 `contracts/user-info-manager.openapi.yaml`
   - 文档/类型：旧名移除后公开 API、JSDoc 与导出回归

## Agent Context Update

执行命令：

```bash
SPECIFY_FEATURE=026-user-info-manager-api .specify/scripts/bash/update-agent-context.sh codex
```

预期：把 026 的当前活跃技术、用户资料 manager API 语义、真实查询/更新响应样例与迁移约束补充到仓库 agent 上下文，供 `/speckit.tasks` 与实现阶段使用。

## Phase 2: Task Planning Approach

由 `/speckit.tasks` 继续拆解任务，按以下主线生成：

1. 重构用户资料类型、公开 API 命名与 `src/index.ts` 导出
2. 实现用户资料 REST 适配层与 envelope 归一化
3. 重构 `UserInfoManager` 公开门面与缓存桥接
4. 修正文档、JSDoc、API 对照文档和迁移说明
5. 补齐单元/集成/契约测试与 docs/type gate
6. 最终执行版本号、CHANGELOG、验证与提交流程

## Complexity Tracking

无额外豁免项。
