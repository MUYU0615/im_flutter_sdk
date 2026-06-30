# SDK 第二阶段计划：补齐 Manager 子路径导出

## 背景

在 [sdk-review-2026-04-09.md](/Users/zhangdong/code/websdk2/docs/reviews/sdk-review-2026-04-09.md) 中，第二阶段除了 protobuf 构建策略之外，还明确指出：

- 源码已经存在多个 Manager 子路径入口
- 但 `package.json.exports` 与 `vite.config.ts` 只暴露了 `./managers/channel`
- 这会导致“源码有入口、发布包不可导入”的发布面漂移

上一小阶段已完成 protobuf light runtime 内置打包，本小阶段继续收口第二阶段剩余事项：补齐 Manager 子路径导出。

## 本阶段目标

1. 为当前公开 Manager 补齐子路径导出
2. 为 Vite 多入口构建补齐对应 entry
3. 增加发布面一致性 contract test，避免 `src/managers/*/index.ts`、`vite` entry、`package exports` 再次漂移
4. 保持构建、类型、lint 与覆盖率门禁通过

## 当前应暴露的 Manager 子路径

基于 `src/managers/*/index.ts` 当前仓库实际入口，本阶段补齐：

- `im-sdk-web/managers/channel`
- `im-sdk-web/managers/contact`
- `im-sdk-web/managers/group`
- `im-sdk-web/managers/presence`
- `im-sdk-web/managers/push`
- `im-sdk-web/managers/user-info`

## 修改范围

### 1. 发布配置

- `package.json`
- `vite.config.ts`

目标：

- `exports` 与 `MODULE_ENTRIES` 同步覆盖上述全部 Manager 子路径
- 保持现有 `dist/managers/<name>/index.(js|cjs|d.ts)` 目录约定

### 2. 一致性 contract test

新增测试：

- `tests/contract/manager-exports.contract.test.ts`

覆盖点：

- `src/managers/*/index.ts` 中存在的公开入口必须出现在 `package.json.exports`
- 上述入口必须同步出现在 `vite.config.ts` 的模块构建 entries 中
- `channel/contact/group/presence/push/user-info` 六个已知入口必须全部存在

### 3. 回归验证

验证命令：

- `npm run type-check`
- `npm run lint`
- `npm run test:run -- tests/contract/manager-exports.contract.test.ts`
- `npm run build`
- `npm run test:coverage`

## 不在本阶段处理

- 自动生成 `exports`/`vite entries` 的脚本化方案
- `dist/esm` / `dist/cjs` 目录结构整体重构
- 新增 `chatroom` 等尚未稳定发布的 Manager 子路径

## 风险

1. `package.json.exports` 与现有构建目录命名必须严格对齐，否则会出现运行时解析失败
2. 若 contract test 直接依赖 Vite 配置对象结构，后续配置重构时需要同步维护
3. 当前 `src/managers/contact/index.ts` 与 `src/managers/group/index.ts` 未被 coverage exclude，若后续门禁收紧，需考虑是否将纯导出文件统一排除
