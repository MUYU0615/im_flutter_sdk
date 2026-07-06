# 根目录文档边界

根目录 `docs/` 只保留发布 SDK 和平台封装层共享的长期人类说明。

当前保留：

- 本 README。

自动化测试的 agent 执行规则统一维护在项目 skill：

- `.agents/skills/native-auto-test-framework/SKILL.md`
- `.agents/skills/android-api-coverage/SKILL.md`

自动化测试的人类说明放在 `native-auto-test/docs/`；生成报告、历史 case 台账、一次性审计记录和项目 skills 不放在根目录 `docs/` 下。
