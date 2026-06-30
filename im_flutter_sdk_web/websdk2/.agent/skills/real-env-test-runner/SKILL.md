---
name: real-env-test-runner
description: Use this skill when the user asks about real environment testing in websdk2, including 真实环境测试、联调、real env、为什么 env 改错还通过、e2e 是否连真实环境、mock 还是真实环境. This skill decides whether to run mock, real-env integration, or E2E, checks required environment variables, and explains whether failures are caused by code, credentials, or environment setup.
---

# Real Env Test Runner

该 skill 用于处理 `websdk2` 的真实环境测试判断、执行前检查和失败归因。

## 首选文档与文件

- `docs/testing/testing-layered-env.md`
- `docs/testing/testing-layered-strategy.md`
- `tests/integration/real-env.test.ts`
- `tests/integration/real-env-core-path.test.ts`
- `tests/e2e/README.md`

## 使用场景

- 用户问“这个场景该跑 mock 还是真实环境”
- 用户要求执行真实环境测试或联调
- 用户问“为什么改错 env / AppKey 测试还通过”
- 用户怀疑 E2E 没连上真实环境

## 执行规则

1. 先判断目标是：
   - mock 集成测试
   - real-env 集成测试
   - 浏览器 E2E
2. 执行真实环境前，先检查相关环境变量是否齐备
3. 如果用户要跑命令，再调用 `test-command-runner` 中的标准命令
4. 结果解释时，明确区分：
   - 代码问题
   - 环境变量缺失或错误
   - 账号 / token / AppKey 问题
   - 测试策略本身允许跳过

## 输出要求

- 明确告诉用户“为什么这次该跑 mock / real-env / e2e”
- 真实环境失败时不要只贴报错，要给出归因判断
- 如果命令因为策略跳过，也要解释“跳过是预期还是异常”
