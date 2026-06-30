---
name: project-onboarding
description: Use this skill when someone is unfamiliar with the websdk2 repository and asks to understand the project, architecture, module boundaries, document layout, testing strategy, or where to start. Trigger on 了解项目、项目结构、快速上手、从哪开始、先熟悉工程、新人接手.
---

# Project Onboarding

用于帮助第一次接触 `websdk2` 的协作者快速建立工程认知。

## 首选入口

- `README.md`
- `AGENTS.md`
- `.specify/memory/constitution.md`
- `docs/process/project-summary.md`
- `docs/architecture/project-structure.md`
- `docs/testing/testing-architecture.md`

## 输出要求

- 先说明仓库目标与核心模块
- 再说明源码主路径：`src/chat-client.ts`、`src/core/`、`src/managers/`、`src/protocol/`、`src/platform/`
- 明确文档入口、测试入口、常用命令
- 如果用户接下来要改功能，指出建议先读的文件和应补的测试层

## 边界

- 不要一次性展开所有文档
- 只按用户问题加载对应文档
- 优先给“从哪里看、改哪里、怎么验”的答案
