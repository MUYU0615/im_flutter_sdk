# Feature Specification: TypeDoc API 文档站点

**Feature Branch**: `001-im-sdk-refactor`  
**Created**: 2026-03-04  
**Status**: Draft  
**Input**: 用户需求：“当前是脚本生成 md，需要使用 TypeDoc 直接生成可部署的 html，并支持中英文切换产出。”

## User Scenarios & Testing _(mandatory)_

### User Story 1 - 生成可部署 HTML API 文档 (Priority: P1)

作为 SDK 使用者，我希望通过标准脚本直接生成 TypeDoc HTML 文档站点，方便部署到静态站点服务并在线查阅 API。

**Why this priority**: 这是文档可交付与可部署的基础能力，不具备则无法满足“可部署 html”目标。

**Independent Test**: 执行 `npm run docs:api:html` 后，在 `docs-site/api/zh-CN` 与 `docs-site/api/en-US` 生成完整 HTML 站点资源。

**Acceptance Scenarios**:

1. **Given** 项目依赖已安装，**When** 执行 `npm run docs:api:html:zh`，**Then** 生成中文 HTML API 站点。
2. **Given** 项目依赖已安装，**When** 执行 `npm run docs:api:html:en`，**Then** 生成英文 HTML API 站点。

---

### User Story 2 - 双语注释切换生成 (Priority: P1)

作为文档维护者，我希望基于同一份源码双语注释，按脚本参数切换输出中文或英文 API 文档，避免重复维护两套源码。

**Why this priority**: 这是 Constitution 新增规则（双语注释 + 可切换产出）的直接落地要求。

**Independent Test**: 对同一对外 API，分别生成 zh/en HTML 后，页面说明语言与脚本参数一致。

**Acceptance Scenarios**:

1. **Given** 注释中含 `[zh-CN]...[en-US]`，**When** 生成 zh 文档，**Then** 页面仅显示中文说明内容。
2. **Given** 注释中含 `[zh-CN]...[en-US]`，**When** 生成 en 文档，**Then** 页面仅显示英文说明内容。

---

### User Story 3 - 文档质量门禁自动化 (Priority: P2)

作为 SDK 维护者，我希望在本地和 CI 可运行注释校验脚本，确保对外 API 的示例、参数、错误、返回值说明完整。

**Why this priority**: 防止后续 API 演进时文档质量退化，降低用户接入成本。

**Independent Test**: 执行 `npm run docs:api:check` 时，注释不完整会失败，完整时通过。

**Acceptance Scenarios**:

1. **Given** 某公开方法缺少 `@example` 或 `@returns`，**When** 执行校验脚本，**Then** 脚本返回非 0 并输出问题清单。
2. **Given** 注释完整且双语标记齐全，**When** 执行校验脚本，**Then** 脚本返回成功。

### Edge Cases

- TypeDoc 运行环境缺少依赖（typedoc 未安装）时，脚本应明确报错并终止。
- 目标输出目录已存在历史产物时，脚本需先清理再生成，避免遗留文件污染。
- 注释缺少双语标记或标签不完整时，校验脚本需给出精确到文件和符号的提示。

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: 系统必须提供基于 TypeDoc 的 HTML 文档生成脚本，输出可部署静态站点。
- **FR-002**: 系统必须支持中文与英文两套 API HTML 站点产物，并通过脚本显式切换。
- **FR-003**: 系统必须复用同一份源码注释，通过 `[zh-CN]/[en-US]` 标记进行语言选择，不允许复制两套源码。
- **FR-004**: 系统必须提供注释完整性校验脚本，校验公开 API 的示例、参数、错误、返回值说明与双语标记。
- **FR-005**: 系统必须保留 Markdown API Reference 产出能力，作为 HTML 之外的轻量产物。
- **FR-006**: 文档生成脚本必须纳入 `package.json` 标准命令，便于本地与 CI 复用。

### Key Entities _(include if feature involves data)_

- **ApiDocGenerationConfig**: 文档生成配置，包含语言、输出目录、入口文件与站点标题。
- **ApiDocValidationResult**: 注释校验结果，包含通过/失败状态和失败项列表。

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: `npm run docs:api:html` 在本地可稳定生成中英文两套 HTML 站点，成功率 100%。
- **SC-002**: `npm run docs:api:check` 能在存在缺失注释时稳定失败，并输出可定位的问题信息。
- **SC-003**: 公开 PushManager API 在 HTML 文档中覆盖率达到 100%（方法与类型均可检索）。
