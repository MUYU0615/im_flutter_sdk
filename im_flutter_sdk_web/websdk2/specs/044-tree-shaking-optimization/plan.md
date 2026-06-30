# 实施方案：ChatClient Tree-Shaking 优化

**Branch**: `044-tree-shaking-optimization` | **Date**: 2026-05-28 | **Spec**: `specs/044-tree-shaking-optimization/spec.md`  
**Input**: Feature specification from `/specs/044-tree-shaking-optimization/spec.md`

## Summary

本期目标是让 `ChatClient + Manager` 架构从“运行时按需注册”升级为“打包时也能按需裁剪”。当前 `ChatClient` 仍硬引用 `UserInfoManager`、group/chatroom REST、group/chatroom/contact 用户资料补全和 profile-sync 编排，导致只使用核心能力时仍拉入多个未注册 Manager 域代码。实施方案是把可选域事件处理、用户资料补全、自动同步依赖和可选 REST 能力从 `ChatClient` 下放到显式注册的 Manager 或可选 capability，并建立消费端依赖图/包体积门禁。

关键设计决策：自动同步开关不再触发 `ChatClient` 隐式创建 Manager。开启联系人自动同步、profile-sync 或未来群组自动同步时，必须显式注册所需 Manager/能力；缺失时 fail fast 抛出可操作配置错误。关闭开关时，相关可选能力不应进入核心依赖图。

## Technical Context

**Language/Version**: TypeScript 5.x（strict）  
**Primary Dependencies**: 现有 `ChatClient`、Manager 注册体系、`CoreSDK`、`MessageReceiver`、`EventHub`、`CacheManager`、`RestClient`、MSync codec/proto、Vitest、Vite、Playwright、现有小程序平台适配与 demo/fixture  
**Storage**: 不新增持久化；继续复用现有 localStorage/CacheManager；本期只调整能力归属、事件处理和构建验证，不改变消息、联系人、用户资料、群组或聊天室缓存 schema  
**Testing**: Vitest 单元测试、Vitest 集成测试、TypeScript 类型检查、构建依赖图/包体积检查、E2E/API 或等价构建验证  
**Target Platform**: Web SDK 库；重点覆盖 ESM 消费端、浏览器构建和小程序等 size-sensitive 消费场景  
**Project Type**: 单仓库 SDK 库项目（`src/`、`tests/`、`specs/`、`docs/`、`demo/`、`scripts/`）  
**Performance Goals**:
- `ChatClient only` 消费场景依赖图中未注册 Manager runtime 模块数量为 0
- `ChatClient + ChatManager` 消费场景不拉入 group/chatroom/contact/presence/push/user-info Manager runtime，除非显式注册或开启对应依赖选项
- 核心消息收发、连接和事件派发不引入额外网络请求、同步阻塞或全量扫描
**Constraints**:
- `ChatClient` 不得 runtime import 或 `new` 可选 Manager
- `ChatClient` 不得直接依赖 group/chatroom/contact/user-info 的事件规范化、资料补全和可选 REST 实现
- 已注册 Manager 的公开事件名称、业务 payload、错误语义和缓存更新必须保持兼容
- 未注册 Manager 的域通知可以被忽略，但不得影响核心连接、发消息、收消息
- 自动同步开关开启时必须显式校验依赖能力，缺失时 fail fast，不允许静默 no-op
- 小程序/size-sensitive 文档必须推荐 Manager 子路径导入；IIFE 只作为全量包，不用于证明 tree-shaking
- 禁止使用 `any`；公共 API 和类型变更需保持双语注释/文档生成要求
**Scale/Scope**: 涉及 `ChatClient` 核心依赖收敛、Manager raw notify 能力、UserInfo/Profile-sync 显式依赖、Group/ChatRoom/Contact/ChatThread/UserInfo 事件处理归属、bundle 分析脚本、文档与测试门禁；不包含协议 codec 大拆分和完整 `api-errors.json` 分片，后两者作为后续增强或独立任务。

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- [x] **性能优先**: 目标是减少核心依赖图和未注册域运行时开销；事件路由保持非阻塞，不新增同步阻塞或额外默认网络请求。
- [x] **类型安全**: 新增 Manager/capability 边界必须通过 TypeScript strict 类型表达；禁止 `any`；配置错误使用现有 SDK 错误模型。
- [x] **可靠性**: 已注册 Manager 的事件处理、缓存更新和自动同步行为必须兼容；缺失依赖 fail fast，避免半启用状态。
- [x] **可扩展性**: 域事件处理下放到 Manager，符合插件化和开闭原则；未来群组自动同步可复用显式依赖模型。
- [x] **可观测性**: 可记录依赖缺失、可选域通知被忽略、bundle 分析结果；不得输出 token 等敏感信息。
- [x] **版本管理**: 配置校验语义和导入推荐会影响使用方式，实现完成后必须更新版本号与 `CHANGELOG.md`，并提交中文 commit。
- [x] **测试分层**: spec 已明确 unit / integration / E2E 或等价构建验证；tasks 阶段需落到具体测试和脚本文件。

## Project Structure

### Documentation (this feature)

```text
specs/044-tree-shaking-optimization/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/
│   └── requirements.md
├── contracts/
│   └── manager-boundary-contract.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── chat-client.ts
├── core/
│   ├── index.ts
│   └── message/
│       └── message-receiver.ts
├── managers/
│   ├── chat-manager.ts
│   ├── chat-thread-manager.ts
│   ├── chatroom-manager.ts
│   ├── contact-manager.ts
│   ├── group-manager.ts
│   ├── user-info-manager.ts
│   ├── chatroom/
│   ├── contact/
│   ├── group/
│   └── user-info/
├── rest/
│   ├── chatroom-management.ts
│   ├── group-management.ts
│   └── user-info*.ts
├── types/
│   ├── chat-client.ts
│   ├── event-system.ts
│   └── manager.ts
└── validators/
    └── chat-client.ts

tests/
├── unit/
│   ├── chat-client-tree-shaking/
│   ├── core/message/
│   └── managers/
├── integration/
│   ├── mock/
│   └── tree-shaking/
├── types/
└── e2e/
    ├── api/
    └── demo/

scripts/
└── bundle or import-graph analysis scripts

docs/
├── reference/
└── guides or API reference entries affected by import recommendations
```

**Structure Decision**: 使用现有单包 SDK 结构。`ChatClient` 保留核心生命周期和 Manager 注册；可选域通知、资料补全、REST 调用和自动同步处理迁移到对应 Manager 或显式 capability。构建验证脚本放在 `scripts/`，测试覆盖放在现有 `tests/unit`、`tests/integration`、`tests/e2e` 或等价构建 fixtures。

## Phase 0: Research

研究结论见 `research.md`，覆盖：

1. 隐式 Manager vs 显式 capability 的取舍
2. 自动同步缺依赖时 fail fast vs no-op 的取舍
3. raw notify 路由放在 `ChatClient` 还是 `MessageReceiver/CoreSDK` 的边界
4. Manager 子路径导入 vs 主入口聚合导入的文档策略
5. bundle 依赖图检查口径和小程序等价验证策略
6. 本期是否拆 protocol codec 和 `api-errors.json` 的范围控制

## Phase 1: Design & Contracts

设计产物：

- `data-model.md`：定义核心客户端、可选 Manager、capability 依赖、raw notify、消费场景和 bundle baseline
- `contracts/manager-boundary-contract.md`：定义 Manager 边界、自动同步依赖校验、raw notify 处理、导入方式和 bundle gate contract
- `quickstart.md`：记录推荐导入方式、验证命令、依赖图检查和分层测试入口

设计要点：

1. **核心依赖收敛**：`ChatClient` 只能依赖核心连接、消息、缓存、平台、基础 REST 和 Manager 注册抽象。对 `managers/*` 的 runtime import 默认禁止；必要类型使用 `import type`。
2. **Manager raw notify 能力**：Manager 可声明处理某类原始通知的能力；核心只按已注册 Manager/capability 路由，不做域级规范化、资料补全或公开事件 payload 构建。
3. **Group/ChatRoom 下放**：群组和聊天室事件规范化、详情拉取、用户资料补全和事件派发迁入各自 Manager。未注册时忽略对应 raw notify。
4. **Contact/UserInfo/Thread 下放**：联系人事件资料补全、用户资料通知、会话线程通知分别归属对应 Manager 或显式 capability；`ChatClient` 不再创建 `UserInfoManager` 辅助实例。
5. **Profile-sync 显式依赖**：消息用户资料/群名片同步不再是核心默认能力。开启相关开关时校验已注册用户资料/群组能力；缺失则 fail fast。关闭时不加载相关队列、resolver 或 REST。
6. **自动同步开关依赖表**：联系人自动同步至少依赖联系人同步核心能力和用户资料能力；未来群组自动同步至少依赖群组能力，若需要资料补全则同时依赖用户资料能力。依赖缺失错误必须指出 option 名称和所需 Manager/capability。
7. **导入策略**：保留主入口兼容，但文档对小程序/包体积敏感场景推荐 `im-sdk-web/managers/*` 子路径导入；禁止把 IIFE 全量包作为按需体积示例。
8. **构建门禁**：新增 dependency graph 或 bundle-size 检查，至少覆盖 `ChatClient only`、`ChatClient + ChatManager`、`ChatClient + GroupManager`。检查必须能识别未注册 Manager runtime 模块泄漏。
9. **延后范围**：MSync codec 单体拆分和 `api-errors.json` 按域分片收益明确，但风险较高，本期只记录为后续优化；如实现中发现 `api-errors.json` 是阻塞性泄漏，可单独补充 task/计划。

## Agent Context Update

计划执行：

```bash
SPECIFY_FEATURE=044-tree-shaking-optimization .specify/scripts/bash/update-agent-context.sh codex
```

预期：将 044 的 TypeScript tree-shaking、Manager 边界、显式 capability、自动同步 fail-fast、小程序包体积验证同步到 `AGENTS.md` 的最近技术上下文。

## Phase 2: Task Planning Approach

由 `/speckit.tasks` 拆解为：

1. 先补 bundle/import-graph 基线检查脚本和 fixtures，锁定当前泄漏模块
2. 定义 Manager/capability raw notify contract 和缺依赖错误模型
3. 移除 `ChatClient` 对 `UserInfoManager` 和 profile-sync 支撑代码的 runtime 硬引用
4. 将 Group/ChatRoom 事件规范化、详情拉取和资料补全迁入对应 Manager
5. 将 Contact/UserInfo/ChatThread 通知处理迁入对应 Manager 或 capability
6. 调整联系人自动同步和 profile-sync 开关依赖校验，缺依赖 fail fast
7. 更新导入文档、API 文档和小程序/size-sensitive quickstart
8. 补 unit、integration、bundle gate、E2E 或等价构建验证
9. 更新版本号、`CHANGELOG.md`
10. 跑验证命令并提交中文 commit

## Post-Design Constitution Check

- [x] **性能优先**: 方案以减少核心依赖和默认运行时工作为目标，不引入默认额外网络请求。
- [x] **类型安全**: capability、raw notify 和配置错误需要类型化；后续 tasks 必须加入类型测试或 type-check 覆盖。
- [x] **可靠性**: 缺依赖 fail fast，避免用户开启同步但实际不工作；已注册 Manager 行为由兼容测试兜底。
- [x] **可扩展性**: Manager/capability 边界可复用于未来群组自动同步和更多可选域。
- [x] **可观测性**: bundle gate 和配置错误均可诊断；日志不得泄漏敏感信息。
- [x] **版本管理**: 需要在实现收尾阶段更新版本号、`CHANGELOG.md` 并提交中文 commit。
- [x] **测试分层**: unit/integration/E2E 或等价构建验证职责明确。

## Complexity Tracking

无 Constitution 例外。
