# Implementation Plan: 本地缓存模块

**Branch**: `[014-local-cache-module]` | **Date**: 2026-02-11 | **Spec**: `specs/014-local-cache-module/spec.md`
**Input**: Feature specification from `/specs/014-local-cache-module/spec.md`

**Note**: 本计划由 speckit.plan 流程生成并补齐本地缓存模块的落地设计产物。

## Summary

本功能为 SDK 增加本地缓存模块能力，提供统一缓存读写接口，支持批量读写以避免主线程阻塞、同步更新与过期丢弃机制。登录成功后需读取本地会话缓存并触发 `onConversationUpdate`，再通过服务端拉取会话列表递归获取全部会话，差异时再次触发回调并回写缓存。用户信息默认上限 1000 条，需在 `fetchUserInfoById`/`updateOwnUserInfo` 成功后写入缓存，并在登录后加载至内存；写入触发 `QuotaExceededError` 时执行 TTL + LRU 清理并重试一次，仍失败则降级放弃写入。

## Technical Context

**Language/Version**: TypeScript 5.0+（strict）  
**Primary Dependencies**: zod、protobufjs、vitest、vite、eslint  
**Storage**: localStorage（浏览器端）  
**Testing**: vitest（`npm run test:run`）  
**Target Platform**: Web（浏览器环境）  
**Project Type**: single（SDK 单体项目）  
**Performance Goals**: 缓存读写不产生可感知 UI 卡顿，批量写入在空闲/节流时机执行  
**Constraints**: localStorage 容量有限（约 5MB），不计算 size；会话仅缓存 lastMessage；用户信息默认 1000 条；TTL 过期丢弃；写入超限触发清理重试  
**Scale/Scope**: 规模以条数与超限清理为准，优先保障会话缓存，其次用户信息缓存

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

验证本实现方案是否符合 IM SDK Web Constitution 的核心原则：

- [x] **性能优先**: 核心逻辑异步/批量处理，避免主线程阻塞
- [x] **类型安全**: TypeScript strict mode，公共 API 完整类型定义
- [x] **测试驱动**: 关键逻辑可通过单元测试覆盖
- [x] **可靠性**: 读写失败可降级、缓存不影响核心业务
- [x] **可扩展性**: 缓存模块独立，接口可扩展
- [x] **可观测性**: 关键操作具备日志与可诊断信息
- [x] **版本管理**: 遵循 SemVer 与变更记录规范

## Project Structure

### Documentation (this feature)

```text
specs/014-local-cache-module/
├── plan.md              # 本文件（实施计划）
├── research.md          # Phase 0 输出（研究结论）
├── data-model.md        # Phase 1 输出（数据模型）
├── quickstart.md        # Phase 1 输出（验收/验证指引）
├── contracts/           # Phase 1 输出（接口契约）
└── tasks.md             # Phase 2 输出（任务清单）
```

### Source Code (repository root)

```text
src/
├── apis/                # REST API 封装（新增）
├── cache/               # 本地缓存模块（新增）
│   ├── cache-manager.ts
│   ├── cache-store.ts
│   ├── cache-keys.ts
│   ├── cache-types.ts
│   └── cache-utils.ts
├── config/
├── core/
├── managers/
│   ├── user-info-manager.ts
└── utils/

tests/
├── unit/
├── integration/
└── contract/
```

**Structure Decision**: 采用单体 SDK 结构，在 `src/cache/` 内新增缓存模块文件，与现有 `config/`、`core/`、`utils/` 保持一致的分层方式。

## Complexity Tracking

无（当前方案不违反 Constitution）。
