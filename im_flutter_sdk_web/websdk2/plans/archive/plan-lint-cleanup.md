# Lint 历史问题清理计划

## 目标
- 清理当前 `npm run lint` 报告的历史问题，确保 lint 通过。
- 不引入破坏性变更，保持现有行为。

## 现状
lint 报错主要集中在 `src/` 内以下类型：
- 未使用参数（`@typescript-eslint/no-unused-vars`）
- 不必要的类型断言（`@typescript-eslint/no-unnecessary-type-assertion`）
- 字符串转义（`no-useless-escape`）
- `any` 相关不安全使用（`@typescript-eslint/no-unsafe-*`）
- 控制台输出（`no-console`）
- 非空断言（`@typescript-eslint/no-non-null-assertion`）

## 方案
1. **逐文件修复**：按 lint 输出逐项修复，优先保证行为不变。
2. **类型安全**：为 `any` 相关问题补齐类型定义或类型守卫，避免继续使用 `any`。
3. **日志处理**：将 `console` 输出迁移到已有日志工具或临时替换为受控日志函数（如已有 Logger），避免规则冲突。
4. **断言优化**：移除无效断言或替换为正确的类型缩小方式。
5. **注释要求**：新增或改动的代码行补充中文注释，满足项目注释规范。

## 涉及文件（以 lint 输出为准）
- `src/core/connection/connection-manager.ts`
- `src/core/message/message-receiver.ts`
- `src/protocol/msync/codec.ts`
- `src/protocol/msync/lz4-compressor/index.ts`
- `src/protocol/msync/lz4-compressor/lz4.d.ts`
- `src/upload/multipart-upload.ts`
- `src/upload/utils.ts`
- `src/utils/error-codes.ts`

## 风险与应对
- **类型改动风险**：每处类型修复都会保持原逻辑，并补充单元测试或使用现有测试验证。
- **日志行为变化**：仅替换输出方式，不改变输出内容或触发时机。

## 验证
- `npm run lint`
- `npm test -- --run`（真实环境联调用例可能受网络影响，记录失败原因）

