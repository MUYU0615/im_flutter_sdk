# Implementation Plan: Manager 独立导出与 Tree Shaking 优化

**Branch**: `001-im-sdk-refactor`（不新建分支） | **Date**: 2026-02-11 | **Spec**: `specs/015-manager-exports/spec.md`
**Input**: Feature specification from `/specs/015-manager-exports/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

为每个 Manager 提供独立子路径导出，并同时输出多文件 ESM 与单文件 bundle，兼容 CJS。实现方式以 Vite/Rollup 多入口构建为主，ESM 产物启用 `preserveModules` 保留模块边界，`package.json` 使用 `exports` 映射子路径与 CJS 入口，保证主入口保持兼容。

## Technical Context

**Language/Version**: TypeScript 5.x（strict）  
**Primary Dependencies**: Vite 5、Rollup（Vite 内置）、TypeScript、Vitest  
**Storage**: N/A  
**Testing**: Vitest  
**Target Platform**: Web SDK（浏览器 + Node，npm 发布）
**Project Type**: 单项目（src/ + tests/）  
**Performance Goals**: 子路径按需导入减少包体，保证 tree shaking 有效  
**Constraints**: 保持主入口兼容；避免顶层副作用；同时输出 ESM 多文件 + 单文件 bundle；支持 CJS  
**Scale/Scope**: 覆盖 `src/managers/` 下所有 Manager 的独立导出

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

验证本实现方案是否符合 IM SDK Web Constitution 的核心原则：

- [x] **性能优先**: 构建产物优化包体体积，运行时无额外阻塞逻辑
- [x] **类型安全**: 使用 TypeScript strict mode，公共 API 提供完整类型定义，禁止使用 `any`
- [x] **测试驱动**: 若涉及实现变更，补充/验证单元测试并满足覆盖要求
- [x] **可靠性**: 产物调整不削弱现有重连/超时等可靠性能力
- [x] **可扩展性**: 子路径导出不影响协议扩展与插件化能力
- [x] **可观测性**: 构建层变更不影响现有日志/监控
- [x] **版本管理**: 遵循 SemVer，变更同步更新版本号与 CHANGELOG

如存在违反原则的情况，必须在 Complexity Tracking 中说明理由。

## Project Structure

### Documentation (this feature)

```text
specs/015-manager-exports/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── index.ts
├── managers/
│   └── ...
├── types/
└── utils/

tests/
├── unit/
└── integration/

vite.config.ts
package.json
```

**Structure Decision**: 单项目结构，核心代码位于 `src/`，测试位于 `tests/`，构建与导出配置在 `vite.config.ts` 与 `package.json` 中完成。

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| 无 | 无 | 无 |

## Constitution Check (Post-Design)

- [x] 设计产物已覆盖 ESM 多文件、单文件 bundle 与 CJS 兼容策略
- [x] 子路径导出与类型声明策略明确，满足 tree shaking 与类型提示要求
