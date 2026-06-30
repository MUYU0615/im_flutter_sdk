# 任务清单：AI Skill 分发与安装 CLI

## 阶段 1：子包骨架

- [ ] 1.1 新建 `packages/websdk2-ai-kit/`，补 `package.json`、`tsconfig.json`、`README.md`
- [ ] 1.2 配置 CLI 入口 `src/cli.ts` 与 `bin` 字段
- [ ] 1.3 增加共享类型：工具枚举、命令参数、manifest 结构、安装结果

## 阶段 2：知识源与模板

- [x] 2.1 提炼对外可公开的 `integration` 知识源文档
- [x] 2.2 提炼对外可公开的 `debug` 知识源文档
- [x] 2.3 为 `cursor` 生成安装模板
- [x] 2.4 为 `codex` 生成安装模板
- [x] 2.5 为 `agent` 生成安装模板
- [x] 2.6 将 `docs/integration/` 与 `docs/reference/api-reference.zh-CN.md` 同步为可发布 references

## 阶段 3：安装命令

- [ ] 3.1 实现 `init`
- [ ] 3.2 实现自动检测 `cursor / codex / agent`
- [ ] 3.3 实现 `--tool all`
- [ ] 3.4 实现 `--dry-run`
- [ ] 3.5 实现 `--force`
- [ ] 3.6 实现 `update`
- [ ] 3.7 实现 `remove`
- [ ] 3.8 落盘 `.websdk2/ai-kit-manifest.json`

## 阶段 4：诊断命令

- [ ] 4.1 实现 `doctor` 命令
- [ ] 4.2 输出已安装文件、版本、缺失项和建议动作

## 阶段 5：测试

- [x] 5.1 新增单元测试：参数解析、目录解析、manifest、覆盖策略
- [x] 5.2 新增集成测试：临时工作区自动检测安装 `cursor`
- [x] 5.3 新增集成测试：临时工作区安装 `codex`
- [x] 5.4 新增集成测试：临时工作区安装 `agent`
- [ ] 5.5 新增集成测试：`dry-run` / `force` / 冲突处理
- [ ] 5.6 新增集成测试：`doctor`
- [ ] 5.7 新增集成测试：`remove`

## 阶段 6：发布与收尾

- [ ] 6.1 补充 AI kit 使用说明与安装文档
- [ ] 6.2 评估主 SDK README 的入口链接
- [ ] 6.3 验证相关测试与 CLI 命令
- [ ] 6.4 更新版本号、`CHANGELOG.md`
- [ ] 6.5 使用中文 commit 提交
