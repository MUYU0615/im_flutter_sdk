# `@easemob/im-sdk-web-ai-kit`

`im-sdk-web` 的 AI skill 辅助包，用于把接入 guidance 与排障 guidance 显式安装到你的项目目录。

## 安装方式

推荐直接使用 `npx`：

```bash
npx @easemob/im-sdk-web-ai-kit init
npx @easemob/im-sdk-web-ai-kit update
npx @easemob/im-sdk-web-ai-kit remove
npx @easemob/im-sdk-web-ai-kit doctor
```

## 支持的目标

- `cursor`
  - 安装到 `.cursor/rules/`
- `codex`
  - 安装到 `.codex/prompts/`
- `agent`
  - 安装到 `.agent/skills/`

## 知识库来源

AI kit 会安装两层内容：

- 主 skill：`websdk2-integration`、`websdk2-debug`、`websdk2-api-patterns`、`websdk2-platform-differences`、`websdk2-ci-testing`
- 详细 references：从主仓库 `docs/integration/` 与 `docs/reference/api-reference.zh-CN.md` 同步生成，安装到目标工具的 `websdk2-references/` 目录

维护者修改集成文档或 Markdown API Reference 后，可执行：

```bash
npm --prefix packages/websdk2-ai-kit run sync:references
```

`npm run build:ai-kit` 会自动执行同步并编译 CLI。

## 命令

### `init`

```bash
npx @easemob/im-sdk-web-ai-kit init
npx @easemob/im-sdk-web-ai-kit init --tool cursor
npx @easemob/im-sdk-web-ai-kit init --tool all --dry-run
```

参数：

- `--tool <auto|cursor|codex|agent|all>`
- `--cwd <path>`
- `--dry-run`
- `--force`

### `update`

```bash
npx @easemob/im-sdk-web-ai-kit update
npx @easemob/im-sdk-web-ai-kit update --tool codex
```

### `remove`

```bash
npx @easemob/im-sdk-web-ai-kit remove
npx @easemob/im-sdk-web-ai-kit remove --tool agent --dry-run
```

### `doctor`

```bash
npx @easemob/im-sdk-web-ai-kit doctor
```

用于检查：

- 是否已安装 websdk2 AI skill
- manifest 是否存在
- 检测到了哪些 AI 工具目录
- 规则文件/skill 文件是否齐全
- 版本号是否可识别

## 维护者发版

在主仓库根目录执行：

```bash
npm run release:ai-kit:check
npm run release:ai-kit:pack:dry-run
npm run release:ai-kit:publish:dry-run
```

正式发布时：

```bash
npm run release:ai-kit:publish
```
