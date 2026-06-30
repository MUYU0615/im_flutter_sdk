# 实施方案：AI Skill 分发与安装 CLI

**Branch**: `001-im-sdk-refactor` | **Date**: 2026-05-06 | **Spec**: `specs/038-ai-skill-distribution/spec.md`
**Input**: Feature specification from `/specs/038-ai-skill-distribution/spec.md`

## Summary

本特性为 `im-sdk-web` 补充一个独立发布的 AI 辅助包，用于把“接入 guidance + 排障 guidance”分发到外部用户项目，并通过显式 CLI 安装到目标 AI 工具目录。首期不追求覆盖所有工具，而是优先稳定支持 `cursor` 与项目级 `agent` 目录。

方案核心是三层结构：

1. **知识源层**：把对外可公开的接入/排障知识沉淀为中立文档；
2. **模板层**：按工具转换为可安装模板；
3. **CLI 层**：通过 `setup-skills` / `doctor` 完成安装、诊断和升级辅助。

## Technical Context

**Language/Version**: TypeScript 5.x（strict） + Node.js CLI  
**Primary Dependencies**: 现有 TypeScript/Vitest/eslint；Node.js `fs/path/process`；尽量避免引入重 CLI 框架  
**Storage**: 用户项目本地文件系统；安装 manifest 以 JSON 文件形式落盘  
**Testing**: `npm run test:run`、定向 `tests/unit/ai-kit/*`、`tests/integration/ai-kit/*`  
**Target Platform**: npm 分发包、Node.js CLI、用户项目目录  
**Project Type**: 单仓库 SDK 项目内新增一个独立发布子包  
**Performance Goals**: 单次安装保持在秒级；扫描逻辑只处理少量目标目录，不做全盘搜索  
**Constraints**:
- 不使用 `postinstall` 自动写入用户目录
- 不依赖 `node_modules` 被 AI 工具自动发现
- 不输出敏感值，不携带仓库内部私有路径
- 首期只支持 `cursor` / `agent`
- 主 SDK 与 AI kit 可以版本同步，但运行职责必须解耦
**Scale/Scope**: 新增独立发布子包、CLI、模板目录、manifest、单元/集成测试、对外文档

## Constitution Check

_GATE: Must pass before implementation._

- [x] **性能与响应性**: CLI 仅进行有限目录写入与校验，不引入长耗时扫描
- [x] **类型安全**: 参数解析、工具映射、模板清单与 manifest 使用 strict typing
- [x] **可靠性与韧性**: 覆盖已存在文件、冲突目录、dry-run、force、未知工具等异常路径
- [x] **可扩展性**: 知识源、模板适配与 CLI 安装分层，便于后续增补 `claude` / `continue` / `cline`
- [x] **可观测性**: CLI 输出明确安装计划、实际写入结果与 doctor 诊断摘要
- [x] **版本治理**: 独立包版本可识别；实现阶段需补版本、`CHANGELOG.md` 与发布说明
- [x] **安全与合规**: 对外 skill 只保留公开知识，不包含真实环境私密凭证与内部路径

## Structure Decision

### 目录布局

首期建议在仓库内增加独立子包，而不是把 CLI 混入主 SDK 运行时入口。

```text
packages/
└── websdk2-ai-kit/
    ├── package.json
    ├── tsconfig.json
    ├── src/
    │   ├── cli.ts
    │   ├── commands/
    │   │   ├── setup-skills.ts
    │   │   └── doctor.ts
    │   ├── installers/
    │   │   ├── cursor-installer.ts
    │   │   └── agent-installer.ts
    │   ├── templates/
    │   │   ├── cursor/
    │   │   └── agent/
    │   ├── knowledge/
    │   │   ├── integration.md
    │   │   └── debug.md
    │   └── shared/
    │       ├── manifest.ts
    │       ├── project-root.ts
    │       ├── template-copy.ts
    │       └── types.ts
    └── README.md
```

对应测试目录：

```text
tests/
├── unit/
│   └── ai-kit/
└── integration/
    └── ai-kit/
```

### 结构选择理由

- 不污染主 SDK 包体与安装体验
- 发布、版本、CLI、模板可独立演进
- 未来需要额外 AI 工具支持时，只在子包内扩展

## Key Decisions

### 1. 发布模型

决策：采用**独立 npm 包**，首选命名为 `@easemob/im-sdk-web-ai-kit`。

理由：

- 避免主 SDK 用户被迫接收与 AI 工具相关的额外资产
- `npx @easemob/im-sdk-web-ai-kit init` 语义清晰
- 有利于单独维护 README、CLI 与模板版本

备选但暂不采用：

- 把 CLI 放进主包，提供 `npx im-sdk-web setup-skills`
- 使用 `postinstall` 自动复制模板

### 2. CLI 入口

决策：首期提供四个命令，并在 `init/update/remove` 中支持自动检测。

```bash
npx @easemob/im-sdk-web-ai-kit init
npx @easemob/im-sdk-web-ai-kit init --tool cursor
npx @easemob/im-sdk-web-ai-kit init --tool all --dry-run
npx @easemob/im-sdk-web-ai-kit update
npx @easemob/im-sdk-web-ai-kit remove --tool agent
npx @easemob/im-sdk-web-ai-kit doctor
```

`init` 参数：

- `--tool <auto|cursor|codex|agent|all>`
- `--cwd <path>`：可选，指定目标项目目录
- `--dry-run`
- `--force`

`update` 参数：

- `--tool <auto|cursor|codex|agent|all>`
- `--cwd <path>`：可选，指定目标项目目录
- `--dry-run`

`remove` 参数：

- `--tool <auto|cursor|codex|agent|all>`
- `--cwd <path>`：可选，指定目标项目目录
- `--dry-run`

`doctor` 输出：

- 当前项目根目录
- 自动检测到的工具
- 已识别的安装 manifest
- 每个工具模板的安装状态
- 缺失目录或版本不匹配提示

### 3. 目标目录映射

决策：

- `cursor` → `<projectRoot>/.cursor/rules/`
- `codex` → `<projectRoot>/.codex/prompts/`
- `agent` → `<projectRoot>/.agent/skills/websdk2/`

模板命名策略：

- Cursor：输出 2 个规则文件
  - `websdk2-integration.mdc`
  - `websdk2-debug.mdc`
- Codex：输出 2 个 prompt 文件
  - `websdk2-integration.md`
  - `websdk2-debug.md`
- Agent：输出 2 个 skill 目录
  - `websdk2-integration/SKILL.md`
  - `websdk2-debug/SKILL.md`

### 4. Manifest 与升级策略

决策：安装后写入统一 manifest：

```text
<projectRoot>/.websdk2/ai-kit-manifest.json
```

manifest 至少记录：

- `packageName`
- `packageVersion`
- `installedAt`
- `projectRoot`
- `tools`
- `files`

用途：

- `doctor` 读取安装结果
- 后续升级时判断哪些文件由 CLI 管理
- 避免误删用户自建 skill

### 5. 知识源与模板分离

决策：先维护中立知识文档，再生成各工具模板。

知识源最小集合：

- `integration.md`
  - 初始化
  - 登录
  - 发消息
  - 常见配置
  - 接入建议
- `debug.md`
  - AppKey / UserId / Token 排查
  - `.env` / CI secrets 排查
  - E2E 登录失败排查
  - 测试命令映射
  - REST / WebSocket / DNS 路由排查

这样可以降低多工具适配时的内容漂移风险。

## Implementation Phases

### Phase 1: 子包与 CLI 骨架

- 新建 `packages/websdk2-ai-kit/`
- 配置 `package.json`、`bin`、`tsconfig`
- 增加 `src/cli.ts`
- 增加命令分发与参数解析

### Phase 2: 模板与安装器

- 新增 `knowledge/` 中立文档
- 新增 `templates/cursor/` 与 `templates/agent/`
- 实现 `cursor-installer`、`agent-installer`
- 实现 dry-run / force / 覆盖策略

### Phase 3: doctor 与 manifest

- 实现 manifest 写入与读取
- 增加 `doctor` 命令
- 输出缺失项、版本信息与建议修复动作

### Phase 4: 文档与测试

- 补充子包 README
- 补 CLI 单元测试
- 补临时工作区集成测试
- 明确发布步骤与版本同步策略

## Testing Strategy

### 单元测试

- 参数解析
- 目标目录解析
- 文件复制计划生成
- 覆盖策略
- manifest 读写

### 集成测试

- 临时项目内执行 `setup-skills --tool cursor`
- 临时项目内执行 `setup-skills --tool agent`
- 已存在文件时 `--dry-run` 不落盘
- 已存在文件时 `--force` 覆盖
- `doctor` 正常读取 manifest

### E2E

- 本特性不新增浏览器 E2E
- 原因：文件系统安装型 CLI，更适合临时工作区集成测试

## Risks

### 1. 工具目录规范差异

风险：不同 AI 工具目录结构可能变化或版本差异较大。

缓解：

- 首期只支持 `cursor` / `agent`
- 目录与文件名通过显式映射常量管理
- 不做隐式自动发现和写入用户主目录

### 2. 模板内容与 SDK 演进脱节

风险：接入文档和排障指导容易随 SDK 演进过期。

缓解：

- 统一从中立知识源生成模板
- 把 AI kit 版本与 SDK 版本对齐
- 在发布 checklist 中加入 AI kit 文档校验

### 3. 用户已有自定义规则冲突

风险：CLI 可能覆盖用户手写规则。

缓解：

- 默认不覆盖
- 仅 `--force` 覆盖
- manifest 只管理 CLI 自己安装的文件

## Recommended MVP

首版只做以下能力：

- 独立包 `@easemob/im-sdk-web-ai-kit`
- `setup-skills`
- `doctor`
- `cursor` / `agent`
- `integration` / `debug`
- manifest

以下内容留到后续版本：

- 更多 AI 工具
- 模板定制风格
- 主 SDK 包内快捷代理命令
- 在线更新/远程模板拉取

## Open Questions

1. 子包是否采用 npm workspaces 管理，还是保持独立目录 + 独立构建脚本
2. Cursor 规则文件最终采用 `.md` 还是 `.mdc`
3. 是否需要在主 SDK README 中加入“一键安装 AI skill”章节
4. 是否需要后续支持全局安装（写入用户主目录）模式
