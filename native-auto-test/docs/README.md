# Native Auto Test Docs

本目录只放长期人类说明和少量需要人工阅读的设计说明。

SDK E2E、跨平台互测、新 API/新平台适配、版本回归、覆盖统计和报告的 agent 执行规则统一维护在项目 skill：`.agents/skills/native-auto-test-framework/SKILL.md`。

用例编写、文件命名、中文步骤、事件等待、执行入口和报告查看规范见：

```text
docs/case_authoring_guide.md
```

不要在 `docs/` 下放生成报告、历史 case 台账或 agent 台账。生成产物统一输出到 `native-auto-test/out/`。
