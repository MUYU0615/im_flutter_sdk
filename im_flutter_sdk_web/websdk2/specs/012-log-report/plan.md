# 实施计划：日志分级与 DNS 控制上报

**Branch**: `012-log-report` | **Date**: 2026-02-04 | **Spec**: /Users/zhangdong/code/websdk2/specs/012-log-report/spec.md
**Input**: Feature specification from `/Users/zhangdong/code/websdk2/specs/012-log-report/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

基于 012 规格实现日志分级与上报能力：日志仅保留 debug/warn/error，info 统一重分类；DNS 接口新增 `enableReportLogs` 开关控制是否上报；DNS 成功前日志缓存、成功后按 5 分钟定时上报，并在登录成功与退出时立即上报一次；补充日志脱敏与 API 调用最小必要日志策略；实现上报分片（2MB）与失败回退。设计与约束详见 `research.md` 与 `contracts/`。

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: TypeScript 5.0+（strict）  
**Primary Dependencies**: zod、protobufjs、vitest、vite、eslint  
**Storage**: N/A（内存日志缓冲）  
**Testing**: vitest（`npm run test:run`）、eslint（`npm run lint`）  
**Target Platform**: Web SDK（浏览器/Node 运行时）  
**Project Type**: 单项目 SDK 库  
**Performance Goals**: 日志采集与上报不阻塞主线程，单次上报分片 ≤2MB  
**Constraints**: 日志脱敏与最小必要原则；上报间隔固定 5 分钟  
**Scale/Scope**: 中等规模 SDK（核心模块改动在 `src/`）

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

验证本实现方案是否符合 IM SDK Web Constitution 的核心原则：

- [x] **性能优先**: 日志采集与上报采用异步非阻塞流程，分片上传避免阻塞主线程  
- [x] **类型安全**: TypeScript strict mode，更新类型与校验时禁止 `any`  
- [x] **测试驱动**: 针对日志分级与上报关键路径补充单元测试  
- [x] **可靠性**: 上报失败回退、DNS 失败不影响主流程  
- [x] **可扩展性**: 日志策略与上报实现保持可扩展结构  
- [x] **可观测性**: 覆盖 API 调用与关键链路日志，提供结构化信息  
- [x] **版本管理**: 遵循 SemVer，并同步 CHANGELOG

如存在违反原则的情况，必须在 Complexity Tracking 中说明理由。

## Project Structure

### Documentation (this feature)

```text
specs/012-log-report/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
src/
├── chat-client.ts
├── core/
├── rest/
├── types/
└── utils/

tests/
├── integration/
└── unit/
```

**Structure Decision**: 单仓库 SDK 项目，功能实现集中在 `src/utils`、`src/rest`、`src/types` 与 `src/core`，测试位于 `tests/unit` 与 `tests/integration`。

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| 无 | 无 | 无 |
