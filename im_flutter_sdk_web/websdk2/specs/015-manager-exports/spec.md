# Feature Specification: Manager 独立导出与 Tree Shaking 优化

**Feature Branch**: `[015-manager-exports]`  
**Created**: 2026-02-11  
**Status**: Draft  
**Input**: User description: "写015spec 实现每个模块 Manager多文件单独导出，优化tree shakig能力，多文件 ESM + 单文件 bundle，兼容 CJS"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 只引入单个 Manager 以缩小包体 (Priority: P1)

作为 SDK 使用者，我希望能通过子路径仅导入某个 Manager（如 ChannelManager），从而让打包器只包含该 Manager 相关代码，减少最终包体。

**Why this priority**: Tree shaking 的核心价值是按需加载，避免引入全部 Manager 导致包体膨胀。

**Independent Test**: 使用 Vite/rollup 打包示例工程，仅导入 `im-sdk-web/managers/channel`，通过构建分析确认产物中不包含其他 Manager 代码。

**Acceptance Scenarios**:

1. **Given** 应用只导入 `im-sdk-web/managers/channel`，**When** 构建产物生成，**Then** 输出中不应包含其他 Manager 的代码。
2. **Given** 应用导入 `im-sdk-web` 主入口，**When** 构建产物生成，**Then** 输出中包含全部 Manager 导出的聚合能力。

---

### User Story 2 - CDN/脚本引入使用单文件 bundle (Priority: P2)

作为 SDK 使用者，我希望在无需打包的场景通过单文件 bundle 引入 SDK，以便在浏览器脚本环境中快速使用。

**Why this priority**: 便捷性与兼容性是 SDK 采用率的重要因素。

**Independent Test**: 通过单文件 bundle 在简单 HTML 页面中加载并初始化 SDK，验证 API 可用。

**Acceptance Scenarios**:

1. **Given** CDN/脚本方式引入单文件 bundle，**When** 调用初始化与登录流程，**Then** SDK 可正常工作。

---

### User Story 3 - CJS 环境可正常使用 (Priority: P2)

作为 Node/CJS 使用者，我希望能够通过 `require()` 导入 SDK，避免因 `type: module` 产生兼容问题。

**Why this priority**: 历史项目与部分运行时仍依赖 CJS。

**Independent Test**: 在 CJS 环境中 `require('im-sdk-web')` 并使用基础 API，验证无运行时错误。

**Acceptance Scenarios**:

1. **Given** CJS 项目使用 `require` 导入 SDK，**When** 调用基础 API，**Then** SDK 正常工作且类型声明可用。

---

### Edge Cases

- 子路径导出缺失导致 `im-sdk-web/managers/<name>` 无法解析。
- `type: module` 与 CJS `require` 冲突导致加载失败。
- 单文件 bundle 与 ESM 多文件产物共存时，导出字段指向错误产物。
- 子路径导出未生成 `.d.ts`，导致 TypeScript 类型丢失。
- 顶层副作用导致 tree shaking 失效（例如自动注册、全局初始化）。
- Manager 子路径命名不一致导致导入失败（如 `channel` vs `ChannelManager`）。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: SDK 必须为每个 Manager 提供独立子路径导出（例如 `im-sdk-web/managers/channel`）。
- **FR-002**: 必须生成多文件 ESM 产物，保持模块边界以支持 tree shaking。
- **FR-003**: 必须生成单文件 bundle 产物，适配 CDN/脚本场景。
- **FR-004**: 必须提供 CJS 兼容导出（`require` 可用）。
- **FR-005**: 主入口必须继续保留聚合导出，避免破坏现有使用方式。
- **FR-006**: 子路径导出必须包含 `.d.ts` 类型声明。
- **FR-007**: 产物应声明 `sideEffects: false`，并禁止 Manager 顶层副作用逻辑。
- **FR-008**: 子路径导出与主入口导出须保持一致的 API 行为与版本。
- **FR-009**: 产物必须输出到明确目录：`dist/esm/`（preserveModules 的 ESM 多文件）、`dist/cjs/`（CJS 多文件）、`dist/bundle/`（单文件 bundle）。
- **FR-010**: `package.json` 必须通过 `exports` 明确区分 `import`/`require`/`types`，且子路径导出与主入口导出一致。
- **FR-011**: 单文件 bundle 必须为浏览器脚本环境的 IIFE 产物，提供全局变量 `IMSDKWeb`。

### Export Map & 输出结构

示例（需保持一致的真实路径与文件名）：

```json
{
  "exports": {
    ".": {
      "types": "./dist/types/index.d.ts",
      "import": "./dist/esm/index.js",
      "require": "./dist/cjs/index.cjs"
    },
    "./managers/channel": {
      "types": "./dist/types/managers/channel.d.ts",
      "import": "./dist/esm/managers/channel.js",
      "require": "./dist/cjs/managers/channel.cjs"
    }
  }
}
```

输出目录约定：
- `dist/esm/**`：ESM 多文件（preserveModules）
- `dist/cjs/**`：CJS 多文件（与 ESM 结构对齐，`.cjs` 后缀）
- `dist/bundle/im-sdk-web.iife.js`：单文件 bundle（全局 `IMSDKWeb`）

### Key Entities *(include if feature involves data)*

- **Manager Entry Point**: 每个 Manager 对外导出的独立入口文件。
- **ESM Multi-Module Output**: 保留模块结构的 ESM 产物，用于 tree shaking。
- **Single Bundle Output**: 单文件 bundle 产物，用于 CDN/脚本场景。
- **CJS Output**: 面向 `require` 的 CommonJS 产物。

### Assumptions & Dependencies

- 构建工具使用 Vite/Rollup，并支持 `preserveModules` 输出。
- `package.json` 可通过 `exports` 字段配置子路径导出与 CJS 入口。
- 现有 Manager 的导出结构允许独立拆分，不引入额外副作用。
- 当前 Manager 列表以 `src/managers/` 目录为准，子路径命名规则为小写 kebab-case（如 `channel`）。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 在示例项目中仅导入单个 Manager 时，通过构建分析（如 rollup 可视化或 esbuild metafile）确认产物不包含其他 Manager 模块。
- **SC-002**: `im-sdk-web/managers/<name>` 子路径导入在 ESM 环境中可正常使用且具备类型提示。
- **SC-003**: `require('im-sdk-web')` 在 CJS 环境中可正常加载并使用基础 API（命中 `exports` 的 `require` 入口）。
- **SC-004**: 单文件 bundle 在浏览器脚本环境中可正常初始化并调用核心 API。
- **SC-005**: 子路径导出对应的 `.d.ts` 可被 TypeScript 正常解析（无类型缺失）。
