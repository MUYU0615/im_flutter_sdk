# Research: Manager 独立导出与 Tree Shaking 优化

## 决策 1：ESM 多文件产物使用 preserveModules

- **Decision**: 使用 Vite/Rollup 多入口并开启 `preserveModules`，输出多文件 ESM 以保留模块边界。
- **Rationale**: 保留模块边界是 tree shaking 生效的关键，避免单文件 bundle 降低可摇树性。
- **Alternatives considered**: 仅发布单文件 ESM bundle；结果是树摇效果有限，包体仍包含多余代码。

## 决策 2：同时输出单文件 bundle

- **Decision**: 额外输出单文件 bundle 供 CDN/脚本场景使用。
- **Rationale**: 覆盖无需打包工具的使用场景，提高 SDK 可用性。
- **Alternatives considered**: 仅输出多文件 ESM；对 CDN/脚本用户不友好。

## 决策 3：提供 CJS 兼容入口

- **Decision**: 通过 `exports`/`main`/`require` 字段提供 CJS 入口。
- **Rationale**: 兼容历史 Node/CJS 项目，避免 `type: module` 造成使用门槛。
- **Alternatives considered**: 仅提供 ESM；将导致 CJS 项目无法直接使用。

## 决策 4：子路径导出命名规范

- **Decision**: 使用 `im-sdk-web/managers/<name>` 作为 Manager 子路径导入约定。
- **Rationale**: 路径简洁且语义清晰，便于按需导入。
- **Alternatives considered**: 统一从主入口导入（树摇效果有限）。
