# 功能规格：AI Skill 分发与安装 CLI

## 背景

当前仓库内已经沉淀了一批对接入、测试、真实环境联调和排障有直接帮助的项目级 skill，但这些内容只存在于本仓库中：

- `.agent/skills/*`
- `.codex/prompts/*`
- `docs/testing/*`
- `docs/reference/*`

外部 SDK 使用者即使安装了 `im-sdk-web`，也无法直接把这些经验同步到自己的 AI 工具里。手工复制规则文件的问题包括：

- 工具目录不统一，容易放错位置
- 用户无法判断哪些文件是接入 guidance，哪些是仓库内部流程
- skill 更新后缺乏版本与覆盖策略
- 团队成员之间无法稳定复用同一套 AI 接入与排障知识

因此需要提供一个可发布、可版本化、可显式安装的 AI skill 分发方案。

## 目标

提供一个独立 npm 包，向外部用户分发“接入 + 排障”两类 AI 辅助资产，并通过 CLI 显式安装到用户项目目录，使其能在 Cursor / 项目级 agent 目录中快速生效。

## 非目标

- 不在 `npm install im-sdk-web` 时自动修改用户目录
- 不强依赖某一个 AI 工具厂商私有协议
- 不把本仓库内部 CI、私有路径、仅适用于本仓库开发的 prompt 直接暴露给外部用户
- 首期不覆盖所有 AI 工具；仅覆盖确定可维护的少量目标

## 用户故事

### 用户故事 1：SDK 使用者安装接入 guidance

作为一个使用 `im-sdk-web` 的业务开发者，  
我希望执行一个命令就能把 SDK 接入 guidance 安装到我的项目，  
以便我的 AI 工具能给出正确的初始化、登录、发消息、常见配置说明。

### 用户故事 2：SDK 使用者安装排障 guidance

作为一个正在排查真实环境、E2E 或 CI 问题的开发者，  
我希望把一套稳定的排障 skill 安装到项目中，  
以便 AI 能优先检查 AppKey、UserId、Token、环境变量、测试门禁和网络路由问题。

### 用户故事 3：团队维护 skill 版本

作为 SDK 维护者，  
我希望 skill 以独立 npm 包形式发布并和 SDK 版本对齐，  
以便用户可以通过版本号明确自己使用的是哪一套接入/排障规则。

## 功能需求

### 1. 独立发布包

1. 系统必须提供独立于主 SDK 的 npm 包，用于承载 AI skill 资产与 CLI。
2. 该包必须支持独立版本发布，并建议与主 SDK 版本保持同步。
3. 该包必须包含：
   - 通用知识文档
   - 针对目标 AI 工具的模板
   - 安装 CLI

### 2. CLI 安装命令

1. 用户必须能够通过 `npx` 执行安装命令。
2. CLI 首期至少提供：
   - `init`
   - `update`
   - `remove`
   - `doctor`
3. `init` 必须支持：
   - 指定目标工具
   - 自动检测目标工具
   - 干跑（dry run）
   - 强制覆盖
   - 仅输出计划不落盘
4. CLI 必须显式打印将写入哪些文件，不得静默修改用户目录。

### 3. 目标工具与目录映射

1. 首期必须明确支持的目标工具集合。
2. 每个工具必须定义安装目录、文件命名和覆盖策略。
3. 首期最小支持范围：
   - `cursor`
   - `codex`
   - `agent`
4. `cursor` 默认安装到项目内 `.cursor/rules/`
5. `codex` 默认安装到项目内 `.codex/prompts/`
6. `agent` 默认安装到项目内 `.agent/skills/websdk2/`

### 4. Skill 内容分层

1. 对外 skill 必须至少分为两类：
   - integration
   - debug
2. integration 类内容必须覆盖：
   - 初始化
   - 登录
   - 发消息
   - 常见配置项
3. debug 类内容必须覆盖：
   - AppKey / UserId / Token 不匹配
   - `.env` / CI secrets 注入
   - E2E 登录失败
   - REST / WebSocket / DNS 路由问题
   - 测试门禁命令映射

### 5. 安全与脱敏

1. 发布到 npm 的 skill 不得包含私有仓库路径、内部账号、私有 token、真实环境固定凭证。
2. skill 文档不得建议在日志中输出明文 token、密码。
3. CLI 运行日志不得打印用户文件中的敏感值。

### 6. 可升级与可诊断

1. CLI 必须在安装后写入安装清单或 manifest，便于后续升级与诊断。
2. `doctor` 必须能够检查：
   - 是否已安装
   - 自动检测到了哪些 AI 工具
   - 已安装哪些模板
   - 目标目录是否存在
   - 版本号是否可识别

## 成功标准

### 可观测成功标准

1. 用户在带有 `.cursor/` 的项目内执行 `npx <ai-kit-package> init` 后，能够在 `.cursor/rules/` 看到可识别的 websdk2 规则文件。
2. 用户在带有 `.codex/` 的项目内执行 `npx <ai-kit-package> init` 后，能够在 `.codex/prompts/` 看到 `websdk2-integration.md` 与 `websdk2-debug.md`。
3. 用户在带有 `.agent/` 的项目内执行 `npx <ai-kit-package> init` 后，能够在 `.agent/skills/websdk2/` 看到 skill 目录和 `SKILL.md`。
4. 用户执行 `doctor` 后，能够看到明确的检测结果、安装状态、模板版本和缺失项提示。
4. 外部发布包中的内容不包含仓库内部绝对路径和真实环境敏感信息。

## 测试分层要求

### 单元测试

- 覆盖范围：
  - CLI 参数解析
  - 工具目录解析
  - 覆盖策略判断
  - manifest 生成
  - 模板渲染/复制清单
- 计划位置：
  - `tests/unit/ai-kit/*`

### 集成测试

- 覆盖范围：
  - 在临时工作区执行 `init / update / remove`
  - 自动检测目录、已存在目录时的 skip / force / dry-run 行为
  - `doctor` 读取 manifest 与目录状态
- 计划位置：
  - `tests/integration/ai-kit/*`

### E2E 测试

- 首期不新增浏览器 E2E。
- 原因：
  - 本特性为本地 CLI + 文件系统安装，不涉及浏览器主链路
  - 用临时工作区集成测试即可覆盖关键风险
