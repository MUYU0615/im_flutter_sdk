---
name: test-layer-enforcer
description: Use this skill when the user asks how to test a change in websdk2, wants to add tests, asks whether unit/integration/e2e/contract/type tests are needed, or needs gate-aware validation. Trigger on 补测试、测试方案、集成测试、e2e、契约测试、类型测试、门禁.
---

# Test Layer Enforcer

该 skill 用于在 `websdk2` 中判断一个改动应该补哪些测试层，而不是只补最容易写的单测。

## 首选文档

- `docs/testing/testing-architecture.md`
- `docs/testing/testing-layered-strategy.md`
- `docs/testing/testing-layered-env.md`

## 判断顺序

1. 先判断改动属于哪类模块：纯工具 / manager / protocol / platform / demo / 测试治理
2. 逐层评估是否需要：
   - 单元测试
   - 集成测试
   - E2E
   - 契约测试
   - 类型测试
3. 明确给出：
   - 该补哪层
   - 建议放在哪个目录
   - 推荐执行哪些门禁命令

## 项目约束

- 新功能不能只说“按需补测试”，必须明确哪些层适用、哪些层不适用
- 涉及公开 API、协议边界、平台适配时，优先考虑集成/契约/类型测试
- 涉及真实环境验证时，区分 mock 链路与 real-env 链路
