---
name: release-change-check
description: Use this skill when finishing changes in websdk2 and the user asks to 收尾、准备提交、提交前检查、发版前检查、更新版本号、写 changelog, or wants the standard verification and commit flow.
---

# Release Change Check

该 skill 用于处理 `websdk2` 中编码完成后的标准收尾流程。

## 必查项

- 是否完成必要验证
- 是否更新版本号
- 是否更新 `CHANGELOG.md`
- 是否有需要同步的文档或 spec/tasks
- 是否只暂存本次相关文件

## 验证选择

- 文档/skill/README 调整：至少跑 `npx prettier --check ...`
- 测试策略或脚本调整：补跑对应测试命令
- 代码功能调整：按改动范围选择单测 / 集成 / E2E / 门禁命令

## 提交流程

1. 验证通过
2. 更新版本号
3. 更新 `CHANGELOG.md`
4. `git add` 仅本次相关文件
5. `git commit`

## 约束

- 不要 `git push`
- 不要把用户无关脏文件带进提交
- 如果是新功能，先确认是否需要新分支
