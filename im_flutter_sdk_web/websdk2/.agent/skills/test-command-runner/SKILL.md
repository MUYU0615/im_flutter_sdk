---
name: test-command-runner
description: Use this skill when the user asks to run tests or gates in websdk2, including 跑单测、跑集成测试、跑 mock、跑真实环境、出覆盖率、跑 PR gate、跑 nightly、跑 release gate. This skill maps user intent to the repository's standard npm scripts and summarizes the results.
---

# Test Command Runner

该 skill 用于把用户的自然语言测试请求稳定映射到 `websdk2` 的标准命令。

## 命令映射

- `跑单测` / `做一下单测`
  - `npm run test:run -- tests/unit`
- `跑集成测试`
  - `npm run test:integration`
- `跑 mock 集成测试`
  - `npm run test:integration:mock`
- `跑真实环境核心链路`
  - `npm run test:integration:real`
- `出覆盖率`
  - `npm run test:coverage`
- `跑 PR 门禁`
  - `npm run test:gate:pr`
- `跑 nightly 门禁`
  - `npm run test:gate:nightly`
- `跑 release 门禁`
  - `npm run test:gate:release`
- `跑 E2E`
  - `npm run test:e2e`

## 执行要求

- 优先使用仓库已有脚本，不要临时拼装替代命令
- 涉及真实环境命令时，先结合 `real-env-test-runner` 判断环境是否满足
- 执行完成后要总结：
  - 跑了什么命令
  - 通过 / 失败情况
  - 关键失败点
  - 是否需要下一步动作

## 边界

- 该 skill 负责“命令执行入口”和“结果摘要”
- 不负责深度解释真实环境问题，真实环境归因交给 `real-env-test-runner`
