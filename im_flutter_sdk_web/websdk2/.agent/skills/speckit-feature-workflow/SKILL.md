---
name: speckit-feature-workflow
description: Use this skill when working in websdk2 and the user asks to 写 spec、写规格、澄清需求、出 plan、拆 tasks、implement、按 Speckit 流程执行, or mentions spec.md/plan.md/tasks.md. This skill routes to the repository-local prompt files under .codex/prompts.
---

# Speckit Feature Workflow

该 skill 负责把用户请求路由到仓库内的 Speckit prompt，而不是重复解释流程。

## 路由规则

- `写 spec` / `规格` / `需求` -> `.codex/prompts/speckit.specify.md`
- `澄清需求` / `clarify` -> `.codex/prompts/speckit.clarify.md`
- `出 plan` / `技术方案` -> `.codex/prompts/speckit.plan.md`
- `拆 tasks` / `任务拆解` -> `.codex/prompts/speckit.tasks.md`
- `implement` / `开始实现` -> `.codex/prompts/speckit.implement.md`
- `analyze` -> `.codex/prompts/speckit.analyze.md`
- `checklist` -> `.codex/prompts/speckit.checklist.md`

## 必须同时参考

- `.specify/memory/constitution.md`
- `README.md`
- `AGENTS.md`

## 执行要求

- 优先使用仓库内 prompt 作为流程真源
- 新功能默认提醒评估测试分层
- 正式方案优先落到 `specs/<feature-id>/plan.md`
- 仅跨 feature 的临时计划才写到 `plans/active/`
