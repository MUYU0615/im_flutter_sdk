---
id: ci-testing
name: websdk2-ci-testing
title: websdk2 CI And Testing
description: Use when diagnosing im-sdk-web test gates, coverage failures, nightly workflows, or E2E CI triage.
cursorGlobs: **/*.{ts,tsx,js,jsx,md,yml,yaml,json}
referenceIds:
  - generated/api-reference-index
  - error-catalog
  - upgrade-and-compatibility
---
# websdk2 CI And Testing

Use when diagnosing `im-sdk-web` test gates, coverage failures, nightly workflows, or E2E CI triage.

## 测试命令分层

| 场景 | 命令 | 目的 |
|------|------|------|
| 定向回归 | `npm run test:run -- <path>` | 只验证改动相关测试 |
| 全量单测/集成 | `npm run test:run` | 本地全量回归 |
| 覆盖率门禁 | `npm run test:coverage` | 检查 global threshold |
| PR 门禁 | `npm run test:gate:pr` | 快速分层门禁 |
| Nightly | `npm run test:gate:nightly` | 含真实环境 E2E 的定时门禁 |
| Release | `npm run test:gate:release` | 发布前的更严格门禁 |

## CI 失败排查顺序

1. 先看失败层级：单测、契约、类型、集成、E2E、coverage
2. 再看是否是环境问题：依赖未安装、secrets 缺失、真实环境登录失败
3. 最后看是否是功能回归：断言变化、类型签名变化、公开导出变化

## Coverage 不达标时的补测策略

- 优先补关键路径，不要先补纯 getter/setter
- 优先看最近改动文件和覆盖率最低的高频模块
- 单测负责分支覆盖，集成测试负责主链路
- 对复杂真实链路，先补 deterministic 的单元/集成，再考虑 E2E

## E2E/真实环境判断

- `nightly` / `release` 往往依赖真实凭证
- 如果日志里出现 `Provision rejected`，先判断 token 与环境是否匹配
- 如果 dev server 启动失败，先查依赖、Vite 配置、demo 子项目安装
- 如果 workflow 被 skip，先查触发条件、schedule、手动 rerun 的 job 过滤条件

## 输出建议

- 先指出失败层
- 再给最短修复路径
- 需要用户补环境变量时，明确写变量名，不输出真实值
