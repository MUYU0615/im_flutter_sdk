# Data मॉडल：Manager 独立导出与 Tree Shaking 优化

本特性不引入新的业务数据实体，但存在构建与导出层面的“概念实体”用于约束输出结构。

## 概念实体

### ManagerEntryPoint

- **描述**: 每个 Manager 的独立入口文件，用于子路径导出。
- **字段**:
  - `name`: string（Manager 名称，例如 `channel`）
  - `entryPath`: string（入口文件路径，如 `src/managers/channel/index.ts`）
  - `exportPath`: string（npm 子路径，如 `im-sdk-web/managers/channel`）

### ESMModuleOutput

- **描述**: 多文件 ESM 产物单元。
- **字段**:
  - `filePath`: string（产物路径，如 `dist/managers/channel/index.js`）
  - `typesPath`: string（类型声明路径，如 `dist/managers/channel/index.d.ts`）

### BundleOutput

- **描述**: 单文件 bundle 产物。
- **字段**:
  - `filePath`: string（产物路径，如 `dist/bundle/im-sdk-web.js`）
  - `format`: string（IIFE/UMD/ESM）

### CJSOutput

- **描述**: CommonJS 入口产物。
- **字段**:
  - `filePath`: string（产物路径，如 `dist/index.cjs`）
  - `requirePath`: string（`package.json` 中的 `exports.require` 映射）
