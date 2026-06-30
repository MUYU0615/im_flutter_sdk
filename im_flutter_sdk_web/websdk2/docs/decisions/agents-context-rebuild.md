# AGENTS 上下文重建改造计划

## 背景与问题

当前项目的 `AGENTS.md` 同时包含两类内容：

1. 手工维护的中文规则与说明
2. `update-agent-context.sh` 自动追加的英文区块

这导致以下问题：

- 脚本只识别并维护 `## Active Technologies`、`## Recent Changes` 等英文区块，无法维护现有中文结构
- 脚本默认只读取当前 feature 对应的单个 `plan.md`，无法按 `specs/001...023` 全量重建上下文
- `AGENTS.md` 中同时存在旧的自动区块与手工规则，结构逐渐失真，最近变更与活跃技术栈不再可靠
- 对 Codex 来说，`AGENTS.md` 是高价值上下文文件，当前内容不稳定会直接影响后续协作效率

## 改造目标

1. 保留现有 `AGENTS.md` 的中文主体结构与手工规则
2. 让脚本直接维护中文区块，而不是继续追加英文区块
3. 支持从 `specs/` 目录扫描全部 feature 的 `plan.md`
4. 基于所有可用 `plan.md` 全量重建以下内容：
   - 当前活跃技术
   - 最近变更
   - 顶部“当前技术栈 / 最近更新”等摘要区块
5. 保留 `<!-- MANUAL ADDITIONS START -->` 与 `<!-- MANUAL ADDITIONS END -->` 之间的手工内容
6. 保持 `codex` 调用方式不变，仍通过：

```bash
SPECIFY_FEATURE=023-test-layer-strategy .specify/scripts/bash/update-agent-context.sh codex
```

说明：执行时允许指定 feature 作为“当前特性”，但生成内容不再仅依赖该单个 feature，而是以全量 `specs/*/plan.md` 为主。

## 实现方案

### 一、重构脚本的数据来源

- 在 `update-agent-context.sh` 中新增“扫描全部规格目录”的逻辑
- 从 `specs/*/plan.md` 提取统一字段：
  - `Language/Version`
  - `Primary Dependencies`
  - `Storage`
  - `Project Type`
  - `Date`
- 按规格编号排序，保证输出稳定
- 最近变更按规格编号或计划日期取最近若干项，避免受当前 git 分支影响

### 二、重构输出模型

- 以中文区块为主输出：
  - `## 当前技术栈`
  - `## 项目结构`
  - `## 常用命令`
  - `## 代码风格`
  - `## 最近更新`
  - `## 当前活跃技术`
  - `## 最近变更`
- 如果检测到旧英文区块：
  - 不再继续维护
  - 在本次重建时统一清理，避免中英文重复区块长期共存

### 三、保留手工内容

- 继续保留 `MANUAL ADDITIONS` 标记区
- 仅重建自动区块，不覆盖项目自定义规则正文
- 若 `AGENTS.md` 已存在，则在保留前半部分手工规则的前提下，仅替换自动汇总区

### 四、模板调整

- 将 [agent-file-template.md](/Users/zhangdong/code/websdk2/.specify/templates/agent-file-template.md) 改为中文模板
- 模板内容与当前仓库 `AGENTS.md` 的汇总区命名保持一致
- 避免后续新仓库初次生成时仍落成英文区块

### 五、兼容性策略

- `cursor-agent` 对应文件仍沿用现有逻辑，不强行把中文格式写入 Cursor 规则文件
- 本次重点保证 `codex -> AGENTS.md` 行为正确
- 如脚本内部已有多 agent 分支逻辑，先最小化改造，避免误伤其他 agent 文件

## 风险与处理

### 风险一：误删已有手工内容

处理方式：

- 只替换明确的自动汇总区块
- 对 `MANUAL ADDITIONS` 区域做原样保留
- 改造后通过 diff 检查 `AGENTS.md` 非目标区域是否被误改

### 风险二：不同 `plan.md` 格式不完全一致

处理方式：

- 字段提取保持宽容，缺失字段时跳过而不是中断
- 对旧 spec 的英文/中文格式兼容解析

### 风险三：最近变更排序不稳定

处理方式：

- 优先按规格编号排序
- 若需要最近 3 项，则取编号最大的 3 个 feature

### 风险四：影响现有 Cursor 工作流

处理方式：

- 优先限定 `codex` 路径行为
- 对 `cursor-agent` 输出逻辑尽量不改或仅做无害封装

## 实施步骤

1. 调整模板为中文自动汇总模板
2. 重构 `update-agent-context.sh` 的数据采集逻辑，支持扫描全部 `specs/*/plan.md`
3. 为 `codex` 目标实现中文区块全量重建
4. 清理旧英文自动区块，避免重复输出
5. 执行脚本生成新的 `AGENTS.md`
6. 检查生成结果是否覆盖 `001` 到 `023` 的有效上下文
7. 更新 `CHANGELOG.md` 与版本号
8. 执行验证命令并提交 git commit

## 验证计划

计划至少执行以下验证：

```bash
SPECIFY_FEATURE=023-test-layer-strategy .specify/scripts/bash/update-agent-context.sh codex
```

检查项：

- `AGENTS.md` 中不存在重复的英文自动区块
- `AGENTS.md` 的中文区块被正确刷新
- `当前活跃技术` 包含 `001` 到 `023` 间已有 `plan.md` 的有效技术信息
- `最近变更` 能反映最近若干个 feature
- `MANUAL ADDITIONS` 区域保持不变

如项目存在格式化配置，额外执行：

```bash
npx prettier --check AGENTS.md .specify/templates/agent-file-template.md CHANGELOG.md
```

## 预期结果

改造完成后：

- `AGENTS.md` 会成为“中文规则正文 + 中文自动汇总区”的统一文件
- Codex 更新上下文时可以直接依赖全量 `specs/*/plan.md`
- 后续即使长期只在一个 git 分支开发，也能通过显式脚本触发获得完整、最新的项目上下文
