# 修复 lint 计划

## 背景
- 当前执行 `npm run lint` 有大量错误与警告，涉及类型安全、返回类型、未处理 Promise 等问题。
- 需要在不改变业务语义的前提下修复 lint，并完成版本号迭代与提交。

## 目标
- 清理所有 lint 错误与警告，确保 `npm run lint` 通过。
- 保持现有行为不变或可控变更，并补充必要的类型信息。
- 完成版本号迭代与更新日志记录。

## 范围
- `src/chat-client.ts`
- `src/core/connection/connection-manager.ts`
- `src/core/connection/heartbeat.ts`
- `src/core/index.ts`
- `src/core/message/message-receiver.ts`
- `src/core/message/message-sender.ts`
- `src/core/storage/indexeddb-storage.ts`
- `src/protocol/protobuf/decoder.ts`
- `src/rest/client.ts`
- `src/rest/errors.ts`
- `src/utils/logger.ts`
- `src/utils/retry.ts`
- `src/validators/validator.ts`

## 实施步骤
1. 重新运行 `npm run lint`，确认当前问题清单与影响范围。
2. 分类型修复：
   - 补齐显式返回类型。
   - 移除 `any`/`Function`，改为明确类型与类型守卫。
   - 处理未 await 的 Promise、无效的 try/catch、无用导入等问题。
   - 调整 `unknown` 联合类型的错误用法。
3. 保持行为不变：修复只做类型与结构调整，不改业务逻辑。
4. 运行 `npm test -- --run` 与 `npm run lint` 验证。
5. 版本号迭代（预计 0.1.5 → 0.1.6），更新 `CHANGELOG.md`。
6. `git add` 并提交（不 push）。

## 风险与控制
- 风险：类型修复可能改变运行时分支或错误处理路径。
- 控制：每处改动保持最小化，优先使用类型守卫与窄化，不引入新逻辑。

## 需要确认
- 你希望我严格遵守“每行代码都要注释”的规则吗？这会和当前“注释应尽量少”的开发规范冲突，并显著增加改动范围。
- 若你同意，我将只在复杂逻辑处添加必要注释，避免逐行注释带来的噪声。
