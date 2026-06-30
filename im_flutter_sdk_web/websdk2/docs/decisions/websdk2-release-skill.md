# websdk2-release Skill 落地计划

> 说明：本计划保留为历史决策记录。当前仓库已改为优先使用项目级 `.agent/skills/`，不再以 `~/.codex/skills/` 作为主落点。

## 背景

当前 `websdk2` 项目已经具备相对稳定的修改收尾流程，包括：

- 依据变更类型迭代版本号
- 追加更新 `CHANGELOG.md`
- 按改动范围选择验证命令
- 验证通过后执行 `git commit`
- 新功能开发时先确认是否创建分支

这些动作重复频率高，且对顺序和完整性有要求，适合沉淀为项目专用 skill。

## 目标

新增一个名为 `websdk2-release` 的 Codex skill，用于在本项目中处理“编码完成后的标准收尾流程”。

Skill 需要覆盖以下能力：

- 根据变更性质判断版本号升级级别
- 按仓库既有格式更新 `CHANGELOG.md`
- 根据改动范围选择验证命令
- 验证通过后生成规范化提交信息并执行提交
- 遵守项目特殊规则，例如新功能先确认分支、大改动先写计划

## 交付物

计划产出以下文件：

- `~/.codex/skills/websdk2-release/SKILL.md`
- `~/.codex/skills/websdk2-release/agents/openai.yaml`
- `~/.codex/skills/websdk2-release/references/test-matrix.md`
- `~/.codex/skills/websdk2-release/references/changelog-template.md`

如有必要，再补充少量脚本，但第一版默认不引入脚本，先保持轻量。

## 实施步骤

1. 使用 `skill-creator` 的 `init_skill.py` 初始化 skill 目录骨架
2. 编写 `SKILL.md`
3. 编写两个参考文件：
   - `test-matrix.md`：记录改动类型与推荐验证命令
   - `changelog-template.md`：记录本仓库 changelog 条目格式
4. 生成并检查 `agents/openai.yaml`
5. 使用 `quick_validate.py` 对 skill 做快速校验
6. 视结果修正 skill 内容

## 风险与处理

### 风险 1：技能目录不在当前工作区

真正可触发的 Codex skill 通常需要写入 `~/.codex/skills/`。当前会话默认可写目录不包含该路径，因此创建 skill 时大概率需要申请额外权限。

处理方式：

- 先在计划中明确该行为
- 在执行创建时申请一次性授权

### 风险 2：项目规则与 skill 指令重复

如果把 AGENTS 中已经明确的编码规范大量复制进 skill，会导致 skill 臃肿、触发后上下文成本变高。

处理方式：

- skill 只保留“执行顺序”和“决策规则”
- 通用编码规范继续依赖项目既有 AGENTS

### 风险 3：验证矩阵过细导致维护成本升高

如果第一版把所有测试场景都写死，会增加后续维护负担。

处理方式：

- 第一版先覆盖主路径
- 复杂场景只给出升级规则，不列出过细的命令组合

## 验证方式

完成后执行：

- `python3 /Users/zhangdong/.codex/skills/.system/skill-creator/scripts/quick_validate.py ~/.codex/skills/websdk2-release`

如有需要，再补充读取校验后的关键文件内容，确认触发描述与流程描述准确。

## 预期结果

完成后，后续在本项目中出现如下请求时，可以稳定触发该 skill：

- “帮我按项目规范收尾这次修改”
- “更新版本号、changelog 并提交”
- “按 websdk2 的流程做发布前整理”
