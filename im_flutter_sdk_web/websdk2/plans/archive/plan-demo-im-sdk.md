# Demo 集成 IM SDK 计划

## 目标
- 在项目根目录新增 `demo/`，提供可 `npm link` 当前 SDK 的前端示例。
- Demo 支持输入 `userId` 与 `token`，完成登录与发送文本消息。
- Demo 参考旧工程 UI 风格，但发送逻辑使用当前 SDK。

## 方案概述
1. **新增 Demo 应用（Vite + React）**
   - 创建 `demo/`，包含 `package.json`、`index.html`、`vite.config.ts`、`tsconfig.json` 等。
   - 实现 `src/App.tsx`：初始化 SDK、登录/登出、发送消息、事件日志与消息列表。
   - UI 结构与旧 demo 风格保持一致。
2. **使用说明文档**
   - 新增 `demo/README.md`，说明 `npm link` 与启动步骤。
3. **版本与变更记录**
   - 迭代 `package.json` 版本号（minor）。
   - 更新 `CHANGELOG.md`，记录新增 demo 与 API 变更。

## 详细步骤
1. 新建 `demo/` 目录与基础配置文件。
2. 实现 `demo/src/App.tsx`、`demo/src/main.tsx`、`demo/src/index.css` 等 UI 与逻辑。
3. 编写 `demo/README.md` 使用说明。
4. 更新版本号与 `CHANGELOG.md`。
5. 运行验证：`npm test && npm run lint`。

## 风险与应对
- **SDK 导出能力不足**：demo 先保留调用占位，后续再补齐 SDK API。
- **npm link 依赖编译**：在说明中强调先构建 SDK，再 link 使用。
- **严格注释规则**：所有新增代码逐行注释，保证符合规则。

## 测试计划
- `npm test`
- `npm run lint`
- （手动）进入 `demo/` 执行 `npm install`、`npm run dev` 验证 UI 与登录/发送流程
