# Demo 多类型消息与组件拆分计划

## 目标
- 在 demo 中补齐发送多种消息类型：image、voice、video、file、custom、cmd、location。
- 保持“只在 demo 调用 SDK 创建消息，不改 SDK 实现”的约束。
- 将 `App.tsx` 拆分为多个组件，提升可维护性。

## 方案概述
1. **组件拆分**
   - `App.tsx` 负责状态与 SDK 初始化。
   - 拆分：`InitPanel`（初始化）、`LoginPanel`（登录/登出）、`SendPanel`（发送）、`MessagePanel`（消息列表）、`LogPanel`（日志）。
2. **多类型消息发送 UI**
   - 在 `SendPanel` 中增加切换消息类型（text/image/voice/video/file/custom/cmd/location）。
   - 根据类型渲染对应输入项，并调用 `client.createXxxMessage` 生成消息。
   - 调用 `client.sendMessage` 仍保留“可选/占位”逻辑。
3. **类型与工具**
   - 抽出通用类型与工具函数至 `demo/src/types.ts` 与 `demo/src/utils.ts`。
4. **文档与版本**
   - 更新 `demo/README.md` 说明多类型消息与附件说明。
   - 迭代 `package.json` 版本号（minor），更新 `CHANGELOG.md`。

## 详细步骤
1. 新建 `demo/src/components/` 并迁移 UI 逻辑。
2. 新建 `demo/src/types.ts`、`demo/src/utils.ts`。
3. 改造 `App.tsx` 使用组件组合。
4. 增加多类型消息输入与创建调用。
5. 更新文档与版本号。
6. 运行验证：`npm test -- --run`、`npm run lint`（如仍有历史问题，记录说明）。

## 风险与应对
- **SDK 暂未支持发送**：保留能力检测与提示，仅创建消息不阻断。
- **附件字段校验**：提示用户填写必要字段，避免 demo 误导。

## 测试计划
- `npm test -- --run`
- `npm run lint`
- 手动：`cd demo && npm run dev` 验证各类型表单与日志
