# Implementation Plan: TypeDoc API 文档站点

**Branch**: `001-im-sdk-refactor` | **Date**: 2026-03-04 | **Spec**: `specs/022-typedoc-api-site/spec.md`  
**Input**: Feature specification from `/specs/022-typedoc-api-site/spec.md`

## Summary

引入 TypeDoc 生成可部署 HTML API 文档站点；在双语注释基础上通过脚本切换语言输出；保留 Markdown 产物并增加注释完整性门禁校验。

## Technical Context

**Language/Version**: TypeScript 5.x + Node.js 脚本  
**Primary Dependencies**: TypeDoc 0.27+、现有 TypeScript 编译配置  
**Storage**: N/A（静态文件产物）  
**Testing**: npm 脚本验证 + vitest 现有单测回归  
**Target Platform**: Web SDK 文档站点（静态托管）  
**Project Type**: 单仓库前端 SDK  
**Performance Goals**: 文档生成 1 分钟内完成（本地常规机器）  
**Constraints**: 必须符合 Constitution 双语注释与可切换文档产出规则  
**Scale/Scope**: 先覆盖 PushManager 对外 API，后续可扩展到全 SDK

## Constitution Check

- [x] 性能优先：仅新增文档构建脚本，不影响运行时链路
- [x] 类型安全：脚本不引入 `any`，对外类型注释完整
- [x] 测试驱动：增加文档校验命令并执行现有回归测试
- [x] 可靠性：脚本包含失败退出与错误提示
- [x] 可扩展性：语言切换与入口文件可配置
- [x] 可观测性：脚本输出生成路径与校验结果
- [x] 版本管理：同步版本号与 CHANGELOG

## Project Structure

```text
specs/022-typedoc-api-site/
├── plan.md
├── spec.md
└── tasks.md

scripts/
├── generate-typedoc-html.js
├── generate-api-reference.js
└── check-api-doc-comments.js

docs/
├── api-reference.zh-CN.md
└── api-reference.en-US.md

docs-site/
└── api/
    ├── zh-CN/
    └── en-US/
```

## Implementation Strategy

1. 补齐 PushManager 与 push 类型的双语 JSDoc（方法/参数/返回类型字段）。
2. 增加 TypeDoc HTML 生成脚本，支持语言切换与目录输出。
3. 将脚本挂载到 `package.json`，并保留 Markdown 生成能力。
4. 执行注释校验 + 文档生成 + 回归测试 + 格式化检查。
