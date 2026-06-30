# SDK 第二阶段计划：protobuf lite 运行时内置打包

## 背景

根据 [sdk-review-2026-04-09.md](/Users/zhangdong/code/websdk2/docs/reviews/sdk-review-2026-04-09.md) 的第二阶段建议，当前 SDK 在 protobuf 相关构建策略上存在两个问题：

- 源码实际使用 `protobufjs`，但 `vite.config.ts` 却错误外置了并不存在的 `protobufjs-lite`
- 默认构建会把完整 `protobufjs` 反射运行时代码打进产物，构建日志出现 `@protobufjs/inquire` 的 `eval` 警告

用户本轮要求明确为：进入第二阶段，并将 protobuf 切到 lite 版，且打包在 SDK 内。

## 本阶段目标

本阶段只处理 protobuf runtime 与构建策略，不混入其他导出面改造：

1. 将 SDK runtime 从 `protobufjs` 切换到适合当前静态 JSON 反射方案的 lite 运行时
2. 确保模块构建与 bundle 构建都不再错误外置 protobuf runtime
3. 保持现有 `Root.fromJSON(...)` / `lookupType(...)` 能力可用
4. 保持现有测试、类型检查和构建通过

## 方案判断

### 为什么不是 `protobufjs/minimal`

当前实现依赖以下反射能力：

- `Root.fromJSON(...)`
- `Namespace` / `Type`
- `lookupType(...)`

这些能力对应的是 `protobufjs/light` 运行时，而不是 `protobufjs/minimal`。若切到 `minimal`，就必须把当前 JSON schema 方案整体升级为静态代码生成，超出本阶段范围。

因此，本阶段采用：

- **源码 runtime 改为 `protobufjs/light`**
- **继续保留现有 proto JSON + reflection registry 方案**
- **构建时将 light runtime 一并打入 SDK 产物**

## 修改范围

### 1. protobuf import 收敛

重点文件：

- `src/platform/proto/proto-adapter.ts`
- `src/platform/proto/static-proto-adapter.ts`
- `src/protocol/msync/root.ts`
- `src/protocol/roster/root.ts`

目标：

- 源码不再从 `protobufjs` 主入口取 runtime
- 统一切到 `protobufjs/light`

### 2. 构建策略修正

重点文件：

- `vite.config.ts`
- `package.json`

目标：

- 默认模块构建不再外置错误的 `protobufjs-lite`
- 明确 protobuf light runtime 随 SDK 一起打包
- 保留 `zod` 的现有外置策略，避免本阶段扩大改动面

### 3. 回归验证

验证命令：

- `npm run type-check`
- `npm run lint`
- `npm run build`
- `npm run test:run -- tests/unit/platform/proto-fail-fast.test.ts tests/unit/protocol/protobuf-static-compat.test.ts tests/unit/core/message/message-receiver.test.ts`

如无额外回归，再执行：

- `npm run test:coverage`

## 不在本阶段处理

- Manager 子路径 exports 全量补齐
- `protobufjs/minimal` 静态代码生成迁移
- ChatClient 单例与 Manager 挂载策略重构
- Group 上传/下载 API 语义重构

## 风险

1. `protobufjs/light` 的类型导出路径与主入口略有差异，需逐个校正 import
2. 若某处隐式依赖 full runtime 的 parser/inquire 行为，切换后可能在构建或测试中暴露
3. 若将 protobuf 完全从 external 中移除，模块构建产物会把 runtime 文件带入 `dist/`，需要用实际 build 结果确认无回归
